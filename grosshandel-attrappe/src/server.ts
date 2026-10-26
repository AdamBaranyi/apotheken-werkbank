import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { Anmeldung, basicLesen } from './anmeldung.ts';
import type { Bestellbuch } from './fachlich/bestellbuch.ts';
import type { Lager } from './fachlich/lager.ts';
import type { Mandant } from './fachlich/mandanten.ts';
import { bestellen } from './funktionen/bestellen.ts';
import { bestellstatusAbfragen } from './funktionen/bestellstatus.ts';
import { verbindungTesten, vertragsdatenAbfragen } from './funktionen/einfach.ts';
import type { Funktion } from './funktionen/kontext.ts';
import { verfuegbarkeitAnfragen } from './funktionen/verfuegbarkeit.ts';
import { Zaehler } from './grenzen.ts';
import { grundkopf, herkunft, koerperLesen, senden } from './http-hilfen.ts';
import { fault, umschlag } from './soap/antwort.ts';
import { Msv3Fehler, validierungsfehler } from './soap/fehler.ts';
import { umschlagLesen } from './soap/umschlag.ts';

/**
 * Der MSV3-Dienst der Attrappe (Pflichtenheft Kap. 2.3.1): je Funktion eine
 * eigene Adresse unter /msv3/v1.0 (Produktion) und /msv3test/v1.0 (Test).
 * Reihenfolge je Anfrage: Adresse, Sperre der Herkunft, Anmeldung, Grenze des
 * Mandanten, Grösse, erst dann wird XML gelesen.
 */
const FUNKTIONEN: Record<string, Funktion> = {
  verbindungTesten,
  vertragsdatenAbfragen,
  verfuegbarkeitAnfragen,
  bestellen,
  bestellstatusAbfragen,
};

/** Gibt es im Pflichtenheft, sind aber in keinem Vertrag der Attrappe vereinbart. */
const NICHT_VEREINBART = new Set(['verfuegbarkeitAnfragenBulk', 'ruecknahmeangebotAnfordern']);

const ADRESSE = /^\/(msv3|msv3test)\/v1\.0\/([A-Za-z]+)$/;
const MAX_BYTES = 200_000;

export interface ServerOptionen {
  mandanten: readonly Mandant[];
  lager: Lager;
  buch: Bestellbuch;
  uhr?: () => Date;
  nachtbetrieb?: (jetzt: Date) => boolean;
  proxyVertrauen?: boolean;
  fehlversuche?: Zaehler;
  anfragen?: Zaehler;
  protokoll?: (eintrag: Record<string, unknown>) => void;
}

function versionen(basis: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?><msv3Versionen>' +
    `<version><kennung>v1.0</kennung><pfad>/${basis}/v1.0</pfad></version></msv3Versionen>`
  );
}

export function serverErzeugen(optionen: ServerOptionen): Server {
  const anmeldung = new Anmeldung(optionen.mandanten);
  const uhr = optionen.uhr ?? (() => new Date());
  const nachtbetrieb = optionen.nachtbetrieb ?? (() => false);
  const fehlversuche = optionen.fehlversuche ?? new Zaehler(30, 15 * 60_000);
  const anfragen = optionen.anfragen ?? new Zaehler(120, 60_000);

  async function soapBearbeiten(req: IncomingMessage, res: ServerResponse, funktionsname: string) {
    const quelle = herkunft(req, optionen.proxyVertrauen ?? false);
    const jetzt = uhr();
    if (fehlversuche.gesperrt(quelle, jetzt.getTime())) {
      const sekunden = String(fehlversuche.restSekunden(quelle, jetzt.getTime()));
      return senden(res, 429, 'Zu viele Fehlversuche', 'text/plain; charset=utf-8', {
        'Retry-After': sekunden,
        Connection: 'close',
      });
    }
    if (!req.headers.authorization) {
      return senden(res, 401, 'Anmeldung erforderlich', 'text/plain; charset=utf-8', {
        'WWW-Authenticate': 'Basic realm="MSV3", charset="UTF-8"',
        Connection: 'close',
      });
    }
    const mandant = await anmeldung.pruefen(basicLesen(req.headers.authorization));
    if (!mandant) {
      fehlversuche.zaehlen(quelle, jetzt.getTime());
      return senden(res, 401, 'Anmeldung fehlgeschlagen', 'text/plain; charset=utf-8', {
        'WWW-Authenticate': 'Basic realm="MSV3", charset="UTF-8"',
        Connection: 'close',
      });
    }
    if (!anfragen.zaehlen(mandant.kundenkennung, jetzt.getTime())) {
      const sekunden = anfragen.restSekunden(mandant.kundenkennung, jetzt.getTime());
      throw new Msv3Fehler(
        'DenialOfServiceException',
        'D-GRENZE',
        `Zu viele Anfragen. Zugang für ${sekunden} Sekunden gesperrt.`,
      );
    }
    if (NICHT_VEREINBART.has(funktionsname)) {
      throw new Msv3Fehler(
        'AuthorizationException',
        'A-NICHT-VEREINBART',
        'Diese Funktion ist nicht vereinbart.',
      );
    }
    const funktion = FUNKTIONEN[funktionsname];
    if (!funktion) throw validierungsfehler('V-FUNKTION', 'Unbekannte Funktion.');
    const koerper = await koerperLesen(req, MAX_BYTES);
    if (koerper === null) {
      throw validierungsfehler('V-GROESSE', 'Die Anfrage ist zu gross (höchstens 200 000 Byte).');
    }
    const aufruf = umschlagLesen(koerper);
    if (aufruf.funktion !== funktionsname) {
      throw validierungsfehler('V-FUNKTION', 'Funktion passt nicht zur Adresse.');
    }
    const kontext = {
      mandant,
      lager: optionen.lager,
      buch: optionen.buch,
      jetzt,
      nachtbetrieb: nachtbetrieb(jetzt),
    };
    senden(res, 200, umschlag(funktion(aufruf.inhalt, kontext)));
    return mandant.kundenkennung;
  }

  async function bearbeiten(req: IncomingMessage, res: ServerResponse) {
    grundkopf(res);
    const pfad = new URL(req.url ?? '/', 'http://attrappe').pathname;
    if (req.method === 'GET' && pfad === '/gesundheit') return senden(res, 200, 'ok', 'text/plain');
    if (req.method === 'GET' && (pfad === '/msv3' || pfad === '/msv3test')) {
      return senden(res, 200, versionen(pfad.slice(1)));
    }
    const treffer = ADRESSE.exec(pfad);
    if (!treffer?.[2]) return senden(res, 404, 'Nicht gefunden', 'text/plain');
    if (req.method !== 'POST') return senden(res, 405, 'Nur POST', 'text/plain', { Allow: 'POST' });
    try {
      return await soapBearbeiten(req, res, treffer[2]);
    } catch (fehler) {
      const msv3 =
        fehler instanceof Msv3Fehler
          ? fehler
          : new Msv3Fehler(
              'ServerException',
              'S-INTERN',
              'Interner Fehler beim Grosshändler.',
              'unerwartet',
            );
      if (!(fehler instanceof Msv3Fehler)) optionen.protokoll?.({ fehler: String(fehler) });
      senden(res, 500, fault(msv3), 'text/xml; charset=utf-8', { Connection: 'close' });
    }
  }

  return createServer((req, res) => {
    const beginn = Date.now();
    void bearbeiten(req, res).then((kennung) =>
      optionen.protokoll?.({
        methode: req.method,
        pfad: req.url?.split('?')[0],
        status: res.statusCode,
        mandant: typeof kennung === 'string' ? kennung : undefined,
        ms: Date.now() - beginn,
      }),
    );
  });
}

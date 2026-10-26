import 'server-only';
import { XMLParser } from 'fast-xml-parser';
import { umgebung } from '@/lib/umgebung';

/**
 * MSV3-Client (Pflichtenheft 1.0h, docs/MSV3.md): je Funktion eine eigene
 * Adresse, Anmeldung über HTTP Basic, Zeitgrenzen 10 s (zeitkritisch) oder
 * 30 s, höchstens 200 000 Byte. Der Server ruft nur Basisadressen auf, die in
 * GROSSHANDEL_ERLAUBT stehen – sonst könnte ein Zugang mit erfundener Adresse
 * die App interne Adressen abfragen lassen (SSRF).
 */
export interface Zugang {
  basisUrl: string;
  kundenkennung: string;
  passwort: string;
}

export type Exceptiontyp =
  | 'ServerException'
  | 'AuthorizationException'
  | 'DenialOfServiceException'
  | 'ValidationException'
  | 'TimeoutException'
  | 'ClientException';

export class Msv3Fehler extends Error {
  readonly exceptiontyp: Exceptiontyp;
  readonly errorCode: string;
  readonly endanwenderText: string;

  constructor(exceptiontyp: Exceptiontyp, errorCode: string, endanwenderText: string) {
    super(`${exceptiontyp} ${errorCode}`);
    this.exceptiontyp = exceptiontyp;
    this.errorCode = errorCode;
    this.endanwenderText = endanwenderText;
  }
}

const MAX_BYTES = 200_000;
const NAMENSRAUM = 'http://werkbank.example/msv3/v1.0';
const LISTEN = new Set([
  'artikel',
  'anteil',
  'auftrag',
  'position',
  'bestellfenster',
  'erlaubteAuftragsart',
]);

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
  htmlEntities: false,
  isArray: (name) => LISTEN.has(name),
});

export function xmlText(wert: string | number | boolean): string {
  return String(wert)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function umschlag(koerper: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" xmlns:m="${NAMENSRAUM}">` +
    `<s:Body>${koerper}</s:Body></s:Envelope>`
  );
}

function pruefeErlaubt(basisUrl: string): void {
  if (!umgebung().grosshandelErlaubt.includes(basisUrl)) {
    throw new Msv3Fehler(
      'ClientException',
      'C-NICHT-FREIGEGEBEN',
      'Dieser Grosshändler ist nicht freigegeben.',
    );
  }
}

function koerperLesen(xml: string, funktion: string): unknown {
  if (/<!(DOCTYPE|ENTITY)/i.test(xml)) {
    throw new Msv3Fehler('ClientException', 'C-DTD', 'Antwort des Grosshändlers ist ungültig.');
  }
  const dokument = parser.parse(xml) as { Envelope?: { Body?: Record<string, unknown> } };
  const koerper = dokument.Envelope?.Body;
  const fault = koerper?.Fault as { detail?: { msv3Fehler?: Record<string, string> } } | undefined;
  if (fault) {
    const f = fault.detail?.msv3Fehler ?? {};
    throw new Msv3Fehler(
      (f.exceptiontyp as Exceptiontyp | undefined) ?? 'ServerException',
      f.errorCode ?? 'UNBEKANNT',
      f.endanwenderText ?? 'Der Grosshändler meldet einen Fehler.',
    );
  }
  const antwort = koerper?.[`${funktion}Antwort`];
  if (antwort === undefined) {
    throw new Msv3Fehler(
      'ClientException',
      'C-ANTWORT',
      'Antwort des Grosshändlers ist unvollständig.',
    );
  }
  return antwort === '' ? {} : antwort;
}

function httpFehler(status: number): Msv3Fehler | null {
  if (status === 401)
    return new Msv3Fehler(
      'AuthorizationException',
      'HTTP-401',
      'Der Grosshändler lehnt die Zugangsdaten ab.',
    );
  if (status === 429)
    return new Msv3Fehler(
      'DenialOfServiceException',
      'HTTP-429',
      'Zu viele Versuche. Bitte später erneut.',
    );
  if (status === 404)
    return new Msv3Fehler(
      'ClientException',
      'HTTP-404',
      'Diese Funktion gibt es beim Grosshändler nicht.',
    );
  return null;
}

/** Ruft eine MSV3-Funktion auf und liefert den Inhalt des Antwort-Elements. */
export async function aufrufen(
  zugang: Zugang,
  funktion: string,
  inhalt: string,
  zeitkritisch: boolean,
): Promise<unknown> {
  pruefeErlaubt(zugang.basisUrl);
  const anmeldung = Buffer.from(`${zugang.kundenkennung}:${zugang.passwort}`).toString('base64');
  let antwort: Response;
  try {
    antwort = await fetch(`${zugang.basisUrl}/v1.0/${funktion}`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${anmeldung}`,
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: '""',
      },
      body: umschlag(`<m:${funktion}>${inhalt}</m:${funktion}>`),
      signal: AbortSignal.timeout(zeitkritisch ? 10_000 : 30_000),
      redirect: 'error',
      cache: 'no-store',
    });
  } catch (fehler) {
    const zeit = (fehler as Error).name === 'TimeoutError';
    throw new Msv3Fehler(
      zeit ? 'TimeoutException' : 'ClientException',
      zeit ? 'C-ZEIT' : 'C-NETZ',
      zeit
        ? 'Der Grosshändler antwortet nicht rechtzeitig.'
        : 'Der Grosshändler ist nicht erreichbar.',
    );
  }
  const vorab = httpFehler(antwort.status);
  if (vorab) throw vorab;
  const roh = Buffer.from(await antwort.arrayBuffer());
  if (roh.length > MAX_BYTES) {
    throw new Msv3Fehler('ClientException', 'C-GROESSE', 'Antwort des Grosshändlers ist zu gross.');
  }
  return koerperLesen(roh.toString('utf8'), funktion);
}

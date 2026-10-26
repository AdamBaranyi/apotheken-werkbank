import { randomBytes, randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { passwortHashen } from '../src/anmeldung.ts';
import { Bestellbuch } from '../src/fachlich/bestellbuch.ts';
import { katalogLaden } from '../src/fachlich/katalog.ts';
import { Lager } from '../src/fachlich/lager.ts';
import { VERTRAEGE, type Mandant } from '../src/fachlich/mandanten.ts';
import { Zaehler } from '../src/grenzen.ts';
import { serverErzeugen, type ServerOptionen } from '../src/server.ts';

/*
 * Testaufbau: zwei Mandanten mit je Lauf erzeugten Passwörtern (kein
 * Geheimnis im Repo), eine feste Uhr (Montag, 26.10.2026, 10:30 Berlin) und
 * ein Server auf einem freien Port.
 */
export const JETZT = new Date('2026-10-26T09:30:00Z');

export interface Testumgebung {
  basis: string;
  server: Server;
  nord: { kennung: string; passwort: string };
  sued: { kennung: string; passwort: string };
  lager: Lager;
}

function passwort(): string {
  return randomBytes(18)
    .toString('base64')
    .replace(/[^A-Za-z0-9]/g, 'x');
}

async function mandant(kennung: string, vertrag: 'standard' | 'spaet', btm: boolean) {
  const klar = passwort();
  const daten: Mandant = {
    kundenkennung: kennung,
    name: `Testapotheke ${kennung}`,
    passwortHash: await passwortHashen(klar),
    btmErlaubnis: btm,
    vertrag: VERTRAEGE[vertrag],
  };
  return { daten, zugang: { kennung, passwort: klar } };
}

export async function umgebungStarten(extra: Partial<ServerOptionen> = {}): Promise<Testumgebung> {
  const nord = await mandant('nord1001', 'standard', true);
  const sued = await mandant('sued2002', 'spaet', false);
  const lager = new Lager(katalogLaden());
  const server = serverErzeugen({
    mandanten: [nord.daten, sued.daten],
    lager,
    buch: new Bestellbuch(),
    uhr: () => JETZT,
    fehlversuche: new Zaehler(5, 60_000),
    anfragen: new Zaehler(50, 60_000),
    ...extra,
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  const { port } = server.address() as AddressInfo;
  return { basis: `http://127.0.0.1:${port}`, server, nord: nord.zugang, sued: sued.zugang, lager };
}

export function basic(kennung: string, passwort: string): string {
  return `Basic ${Buffer.from(`${kennung}:${passwort}`).toString('base64')}`;
}

export function umschlag(koerper: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" ' +
    'xmlns:m="http://werkbank.example/msv3/v1.0"><s:Body>' +
    koerper +
    '</s:Body></s:Envelope>'
  );
}

export async function rufen(
  u: Testumgebung,
  funktion: string,
  koerper: string,
  zugang: { kennung: string; passwort: string } | null = u.nord,
) {
  const antwort = await fetch(`${u.basis}/msv3/v1.0/${funktion}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      ...(zugang ? { Authorization: basic(zugang.kennung, zugang.passwort) } : {}),
    },
    body: umschlag(koerper),
  });
  return { status: antwort.status, text: await antwort.text(), kopf: antwort.headers };
}

export function bestellungXml(positionen: string, art = 'NORMAL', id = randomUUID()): string {
  return (
    '<m:bestellen><m:clientSoftwareKennung>Werkbank-Test 1.0</m:clientSoftwareKennung>' +
    `<m:bestellung><m:id>${id}</m:id><m:bestellSupportId>1</m:bestellSupportId>` +
    `<m:auftrag><m:id>${randomUUID()}</m:id><m:auftragsart>${art}</m:auftragsart>` +
    `<m:auftragskennung>${art}</m:auftragskennung><m:auftragsSupportId>1</m:auftragsSupportId>` +
    `${positionen}</m:auftrag></m:bestellung></m:bestellen>`
  );
}

export function position(pzn: string, menge: number, vorgabe = 'Normal'): string {
  return `<m:position><m:pzn>${pzn}</m:pzn><m:menge>${menge}</m:menge><m:liefervorgabe>${vorgabe}</m:liefervorgabe></m:position>`;
}

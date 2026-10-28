import { randomUUID } from 'node:crypto';
import { createServer, request, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { umgebungStarten, type Testumgebung } from '../../../grosshandel-attrappe/test/hilfen.ts';
import { bestellen, bestellstatusAbfragen, type Bestellauftrag } from './anfragen';
import { Msv3Fehler, type Zugang } from './client';

/*
 * Bestellen und Status gegen den echten Server der Attrappe. Der Abbruch
 * nach dem Buchen läuft über einen Zwischen-Server: Er reicht die Anfrage
 * weiter, wartet die Antwort ab und kappt dann die Verbindung. Genau dann
 * weiss die Apotheke nicht, ob bestellt ist (Pflichtenheft Kap. 2.3.6).
 */
let u: Testumgebung;
let nacht: Testumgebung;
let kappen: Server;
let zugang: Zugang;
let gekappt: Zugang;
let nachts: Zugang;

function zwischenServer(ziel: string): Server {
  return createServer((ein, aus) => {
    const weiter = request(
      `${ziel}${ein.url}`,
      { method: ein.method, headers: ein.headers },
      (antwort) => {
        antwort.resume();
        antwort.on('end', () => aus.socket?.destroy());
      },
    );
    ein.pipe(weiter);
  });
}

beforeAll(async () => {
  u = await umgebungStarten();
  nacht = await umgebungStarten({ nachtbetrieb: () => true });
  kappen = zwischenServer(u.basis);
  await new Promise<void>((ok) => kappen.listen(0, '127.0.0.1', ok));
  const kappenBasis = `http://127.0.0.1:${(kappen.address() as AddressInfo).port}`;
  zugang = {
    basisUrl: `${u.basis}/msv3`,
    kundenkennung: u.nord.kennung,
    passwort: u.nord.passwort,
  };
  gekappt = { ...zugang, basisUrl: `${kappenBasis}/msv3` };
  nachts = {
    basisUrl: `${nacht.basis}/msv3`,
    kundenkennung: nacht.nord.kennung,
    passwort: nacht.nord.passwort,
  };
  process.env.SUPABASE_URL = 'http://127.0.0.1:54401';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
  process.env.ZUGANG_SCHLUESSEL = Buffer.alloc(32).toString('base64');
  process.env.GROSSHANDEL_ERLAUBT = [zugang, gekappt, nachts].map((z) => z.basisUrl).join(',');
});
afterAll(() => {
  for (const server of [u.server, nacht.server, kappen]) server.close();
});

const auftrag = (pzn = '99101373', menge = 6): Bestellauftrag => ({
  id: randomUUID(),
  supportId: 7,
  auftragId: randomUUID(),
  liefervorgabe: 'MaxVerbund',
  positionen: [{ pzn, menge }],
});

describe('Bestellen über MSV3', () => {
  it('Liefervorgabe Normal: nur Hauptlager, der Verbund bleibt «möglich»', async () => {
    // Gebuchte Mengen gehen vom Lager ab: Jeder Test nimmt seinen eigenen Artikel.
    const antwort = await bestellen(zugang, {
      ...auftrag('99117813', 30),
      liefervorgabe: 'Normal',
    });
    expect(antwort.auftrag[0]?.position[0]?.anteil.map((a) => [a.typ, a.menge])).toEqual([
      ['Normal', 25],
      ['KeineLieferungAberVerbundMoeglich', 5],
    ]);
  });

  it('Liefervorgabe MaxVerbund: Hauptlager und Verbund, wie die Verfügbarkeit zeigte', async () => {
    const antwort = await bestellen(zugang, auftrag());
    expect(antwort.nachtbetrieb).toBe(false);
    expect(antwort.auftrag[0]?.auftragsfehler).toBeUndefined();
    expect(antwort.auftrag[0]?.position[0]?.anteil.map((a) => [a.typ, a.menge])).toEqual([
      ['Normal', 3],
      ['Verbund', 3],
    ]);
  });

  it('dieselbe Bestell-ID ein zweites Mal lehnt der Grosshändler ab', async () => {
    const einmal = auftrag('99100008', 1);
    await bestellen(zugang, einmal);
    const fehler = (await bestellen(zugang, { ...einmal, auftragId: randomUUID() }).catch(
      (e: unknown) => e,
    )) as Msv3Fehler;
    expect(fehler).toBeInstanceOf(Msv3Fehler);
    expect([fehler.exceptiontyp, fehler.errorCode]).toEqual([
      'ValidationException',
      'V-ID-BENUTZT',
    ]);
  });

  it('die Statusabfrage liefert am selben Tag dieselbe Antwort, eine fremde ID ist unbekannt', async () => {
    const bestellt = auftrag('99100008', 2);
    const antwort = await bestellen(zugang, bestellt);
    const status = await bestellstatusAbfragen(zugang, bestellt.id);
    expect(status.status).toBe('BestellantwortVerfuegbar');
    expect(status.bestellung).toEqual(antwort);
    expect((await bestellstatusAbfragen(zugang, randomUUID())).status).toBe('KennungUnbekannt');
  });

  it('bricht die Verbindung nach dem Buchen ab: Fehler ohne Antwort, der Status kennt die Bestellung', async () => {
    const bestellt = auftrag('99100008', 1);
    const fehler = (await bestellen(gekappt, bestellt).catch((e: unknown) => e)) as Msv3Fehler;
    expect([fehler.exceptiontyp, fehler.errorCode]).toEqual(['ClientException', 'C-NETZ']);
    const status = await bestellstatusAbfragen(zugang, bestellt.id);
    expect(status.status).toBe('BestellantwortVerfuegbar');
  });

  it('im Nachtbetrieb bestätigt der Grosshändler nur den Empfang', async () => {
    const antwort = await bestellen(nachts, auftrag());
    expect(antwort.nachtbetrieb).toBe(true);
    expect(antwort.auftrag[0]?.position).toEqual([]);
  });
});

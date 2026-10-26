import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import soap from 'soap';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { umgebungStarten, type Testumgebung } from './hilfen.ts';

/*
 * Passen WSDL und Server zusammen? Ein generischer SOAP-Client (node-soap)
 * erzeugt seine Aufrufe allein aus der WSDL – so wie Apothekensoftware ihren
 * Client offline aus der WSDL erzeugt (Pflichtenheft Kap. 2.3.1). Läuft er
 * gegen den Server durch, stimmen Namen, Reihenfolge und Typen überein.
 */
const WSDL = fileURLToPath(new URL('../wsdl/msv3-v1.0.wsdl', import.meta.url));
let u: Testumgebung;

beforeEach(async () => {
  u = await umgebungStarten();
});
afterEach(() => u.server.close());

async function client(funktion: string) {
  const c = await soap.createClientAsync(WSDL);
  c.setSecurity(new soap.BasicAuthSecurity(u.nord.kennung, u.nord.passwort));
  c.setEndpoint(`${u.basis}/msv3/v1.0/${funktion}`);
  return c;
}

type Aufruf = (args: object) => Promise<[Record<string, unknown>]>;
function methode(c: soap.Client, name: string): Aufruf {
  return (c as unknown as Record<string, Aufruf>)[`${name}Async`] as Aufruf;
}

describe('WSDL gegen Server (node-soap)', () => {
  it('verbindungTesten', async () => {
    const c = await client('verbindungTesten');
    await expect(
      methode(c, 'verbindungTesten')({ clientSoftwareKennung: 'node-soap' }),
    ).resolves.toBeDefined();
  });

  it('vertragsdatenAbfragen liefert Bestellfenster und Auftragsarten', async () => {
    const c = await client('vertragsdatenAbfragen');
    const [antwort] = await methode(
      c,
      'vertragsdatenAbfragen',
    )({ clientSoftwareKennung: 'node-soap' });
    const vertrag = antwort.vertragsdaten as Record<string, unknown>;
    expect(vertrag.kundenkennung).toBe(u.nord.kennung);
    expect(vertrag.erlaubteAuftragsart).toEqual(['NORMAL', 'STAPEL']);
    expect((vertrag.bestellfenster as unknown[]).length).toBe(16);
  });

  it('verfuegbarkeitAnfragen teilt auf Anteile auf', async () => {
    const c = await client('verfuegbarkeitAnfragen');
    const [antwort] = await methode(
      c,
      'verfuegbarkeitAnfragen',
    )({
      clientSoftwareKennung: 'node-soap',
      artikel: [
        { pzn: '99100008', menge: 3 },
        { pzn: '99101373', menge: 6 },
      ],
    });
    expect(antwort.rTyp).toBe('Spezifisch');
    const artikel = antwort.artikel as { pzn: string; anteil: { typ: string; menge: number }[] }[];
    expect(artikel[0]?.anteil.map((a) => a.typ)).toEqual(['Normal']);
    expect(artikel[1]?.anteil.map((a) => [a.typ, a.menge])).toEqual([
      ['Normal', 3],
      ['Verbund', 3],
    ]);
  });

  it('bestellen und danach bestellstatusAbfragen', async () => {
    const id = randomUUID();
    const bestellen = await client('bestellen');
    const [antwort] = await methode(
      bestellen,
      'bestellen',
    )({
      clientSoftwareKennung: 'node-soap',
      bestellung: {
        id,
        bestellSupportId: 7,
        auftrag: [
          {
            id: randomUUID(),
            auftragsart: 'NORMAL',
            auftragskennung: 'NORMAL',
            auftragsSupportId: 1,
            position: [{ pzn: '99104118', menge: 2, liefervorgabe: 'MaxNachlieferung' }],
          },
        ],
      },
    });
    const bestellung = antwort.bestellung as Record<string, unknown>;
    expect(bestellung.id).toBe(id);
    const status = await client('bestellstatusAbfragen');
    const [stand] = await methode(
      status,
      'bestellstatusAbfragen',
    )({ clientSoftwareKennung: 'node-soap', bestellId: id });
    expect(stand.status).toBe('BestellantwortVerfuegbar');
  });

  it('meldet Fehler als SOAP-Fault mit MSV3-Angaben', async () => {
    const c = await client('verfuegbarkeitAnfragen');
    const fehler = await methode(
      c,
      'verfuegbarkeitAnfragen',
    )({
      clientSoftwareKennung: 'node-soap',
      artikel: [{ pzn: '99101374', menge: 1 }],
    }).catch((e: unknown) => e);
    const detail = JSON.stringify((fehler as { root?: unknown }).root);
    expect(detail).toContain('ValidationException');
    expect(detail).toContain('V-FELD');
  });
});

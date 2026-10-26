import { afterEach, describe, expect, it } from 'vitest';
import { bestellungXml, position, rufen, umgebungStarten, type Testumgebung } from './hilfen.ts';

let u: Testumgebung;
afterEach(() => u?.server.close());

const TESTEN =
  '<m:verbindungTesten><m:clientSoftwareKennung>Test</m:clientSoftwareKennung></m:verbindungTesten>';

describe('Anmeldung und Grenzen', () => {
  it('verlangt eine Anmeldung und nennt das Verfahren', async () => {
    u = await umgebungStarten();
    const a = await rufen(u, 'verbindungTesten', TESTEN, null);
    expect(a.status).toBe(401);
    expect(a.kopf.get('www-authenticate')).toContain('Basic');
  });

  it('nimmt richtige Zugangsdaten an, auch mit Niederlassung vor der Kennung', async () => {
    u = await umgebungStarten();
    expect((await rufen(u, 'verbindungTesten', TESTEN)).status).toBe(200);
    const mitNl = { kennung: `filiale7\\${u.nord.kennung}`, passwort: u.nord.passwort };
    expect((await rufen(u, 'verbindungTesten', TESTEN, mitNl)).status).toBe(200);
  });

  it('weist falsche Passwörter ab und sperrt die Herkunft nach fünf Fehlversuchen', async () => {
    u = await umgebungStarten();
    const falsch = { kennung: u.nord.kennung, passwort: 'falschesPasswort1' };
    for (let i = 0; i < 5; i++)
      expect((await rufen(u, 'verbindungTesten', TESTEN, falsch)).status).toBe(401);
    const gesperrt = await rufen(u, 'verbindungTesten', TESTEN);
    expect(gesperrt.status).toBe(429);
    expect(Number(gesperrt.kopf.get('retry-after'))).toBeGreaterThan(0);
  });

  it('sperrt einen Mandanten nach zu vielen Anfragen mit DenialOfServiceException', async () => {
    u = await umgebungStarten();
    for (let i = 0; i < 50; i++) await rufen(u, 'verbindungTesten', TESTEN);
    const zuViel = await rufen(u, 'verbindungTesten', TESTEN);
    expect(zuViel.status).toBe(500);
    expect(zuViel.text).toContain('DenialOfServiceException');
    // Der andere Mandant ist davon nicht betroffen.
    expect((await rufen(u, 'verbindungTesten', TESTEN, u.sued)).status).toBe(200);
  });
});

describe('Schutz beim Lesen', () => {
  it('weist eine DTD ab, bevor XML gelesen wird', async () => {
    u = await umgebungStarten();
    const res = await fetch(`${u.basis}/msv3/v1.0/verbindungTesten`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${u.nord.kennung}:${u.nord.passwort}`).toString('base64')}`,
      },
      body: '<?xml version="1.0"?><!DOCTYPE a [<!ENTITY x "xx">]><a>&x;</a>',
    });
    expect(res.status).toBe(500);
    expect(await res.text()).toContain('V-DTD');
  });

  it('weist Anfragen über 200 000 Byte ab', async () => {
    u = await umgebungStarten();
    const gross = `<m:verbindungTesten><m:clientSoftwareKennung>${'x'.repeat(200_001)}</m:clientSoftwareKennung></m:verbindungTesten>`;
    const a = await rufen(u, 'verbindungTesten', gross);
    expect(a.text).toContain('V-GROESSE');
  });

  it('nimmt eine Funktion nur unter ihrer eigenen Adresse an', async () => {
    u = await umgebungStarten();
    const a = await rufen(u, 'bestellen', TESTEN);
    expect(a.text).toContain('V-FUNKTION');
  });

  it('meldet nicht vereinbarte Funktionen als AuthorizationException', async () => {
    u = await umgebungStarten();
    const a = await rufen(u, 'verfuegbarkeitAnfragenBulk', TESTEN);
    expect(a.text).toContain('AuthorizationException');
  });

  it('kennt nur Adressen nach dem Pflichtenheft', async () => {
    u = await umgebungStarten();
    expect((await fetch(`${u.basis}/msv3/v2.0/bestellen`, { method: 'POST' })).status).toBe(404);
    expect((await fetch(`${u.basis}/msv3/v1.0/bestellen`)).status).toBe(405);
    const versionen = await fetch(`${u.basis}/msv3test`);
    expect(await versionen.text()).toContain('/msv3test/v1.0');
  });
});

describe('Mandanten bleiben getrennt', () => {
  it('ein anderer Mandant erfährt nichts über fremde Bestellungen', async () => {
    u = await umgebungStarten();
    const id = '3f1c2b9e-1111-4c4c-9a9a-0123456789ab';
    expect(
      (await rufen(u, 'bestellen', bestellungXml(position('99100008', 1), 'NORMAL', id))).status,
    ).toBe(200);
    const status = `<m:bestellstatusAbfragen><m:clientSoftwareKennung>T</m:clientSoftwareKennung><m:bestellId>${id}</m:bestellId></m:bestellstatusAbfragen>`;
    expect((await rufen(u, 'bestellstatusAbfragen', status)).text).toContain(
      'BestellantwortVerfuegbar',
    );
    expect((await rufen(u, 'bestellstatusAbfragen', status, u.sued)).text).toContain(
      'KennungUnbekannt',
    );
    // Dieselbe ID ist für den anderen Mandanten nicht «schon benutzt» – auch das wäre eine Auskunft.
    expect(
      (await rufen(u, 'bestellen', bestellungXml(position('99100008', 1), 'NORMAL', id), u.sued))
        .status,
    ).toBe(200);
  });
});

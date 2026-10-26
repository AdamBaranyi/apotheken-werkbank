import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { umgebungStarten, type Testumgebung } from '../../../grosshandel-attrappe/test/hilfen.ts';
import { verfuegbarkeitAnfragen, vertragsdatenAbfragen } from './anfragen';
import { Msv3Fehler, type Zugang } from './client';

/*
 * Der Client der Web-App gegen den echten Server der Attrappe, ohne Browser:
 * Stimmen Umschlag, Anmeldung, Fehlerübersetzung und die Freigabeliste?
 */
let u: Testumgebung;
let zugang: Zugang;

beforeAll(async () => {
  u = await umgebungStarten();
  zugang = {
    basisUrl: `${u.basis}/msv3`,
    kundenkennung: u.nord.kennung,
    passwort: u.nord.passwort,
  };
  process.env.SUPABASE_URL = 'http://127.0.0.1:54401';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
  process.env.ZUGANG_SCHLUESSEL = Buffer.alloc(32).toString('base64');
  process.env.GROSSHANDEL_ERLAUBT = zugang.basisUrl;
});
afterAll(() => u.server.close());

describe('MSV3-Client', () => {
  it('liest die Vertragsdaten', async () => {
    const vertrag = await vertragsdatenAbfragen(zugang);
    expect(vertrag.kundenkennung).toBe(u.nord.kennung);
    expect(vertrag.bestellfenster.length).toBeGreaterThan(0);
  });

  it('fragt Verfügbarkeit an und bekommt Anteile', async () => {
    const antwort = await verfuegbarkeitAnfragen(zugang, [{ pzn: '99101373', menge: 6 }]);
    expect(antwort.artikel[0]?.anteil.map((a) => [a.typ, a.menge])).toEqual([
      ['Normal', 3],
      ['Verbund', 3],
    ]);
  });

  it('übersetzt einen SOAP-Fault in eine Meldung für Menschen', async () => {
    const fehler = await verfuegbarkeitAnfragen(zugang, [{ pzn: '99101374', menge: 1 }]).catch(
      (e: unknown) => e,
    );
    expect(fehler).toBeInstanceOf(Msv3Fehler);
    expect((fehler as Msv3Fehler).exceptiontyp).toBe('ValidationException');
  });

  it('meldet falsche Zugangsdaten verständlich', async () => {
    const falsch = { ...zugang, passwort: 'falschesPasswort9' };
    const fehler = (await vertragsdatenAbfragen(falsch).catch((e: unknown) => e)) as Msv3Fehler;
    expect(fehler.endanwenderText).toBe('Der Grosshändler lehnt die Zugangsdaten ab.');
  });

  it('ruft keine Adresse auf, die nicht freigegeben ist (SSRF)', async () => {
    // Zuerst eine erreichbare Adresse: Ohne die Prüfung käme eine echte Antwort.
    for (const basisUrl of [`${u.basis}/msv3test`, 'http://169.254.169.254/msv3']) {
      const fehler = (await vertragsdatenAbfragen({ ...zugang, basisUrl }).catch(
        (e: unknown) => e,
      )) as Msv3Fehler;
      expect(fehler.errorCode).toBe('C-NICHT-FREIGEGEBEN');
    }
  });
});

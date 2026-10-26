import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { passwortPruefen } from '../grosshandel-attrappe/src/anmeldung.ts';
import { zugaengeErzeugen } from '../scripts/produktion-zugaenge.ts';
import { entschluesseln } from '../web/lib/verschluesselung.ts';

/*
 * Die Produktion bekommt dasselbe Passwort zweimal, in zwei Formen: als
 * scrypt-Hash für die Attrappe auf vps1 und als Geheimtext für Supabase. Das
 * Passwort selbst existiert nur während des Laufs. Passen beide nicht
 * zusammen, scheitert jede Anfrage mit 401 – und das fiele erst live auf.
 */
const schluessel = randomBytes(32);
const BASIS = 'https://grosshandel.example/msv3';

describe('Zugänge für die Produktion', () => {
  it('Geheimtext und Hash gehören zum selben Passwort', async () => {
    const { mandanten, zugaenge } = await zugaengeErzeugen(schluessel, BASIS);
    expect(zugaenge.map((z) => z.kennung)).toEqual(['nord1001', 'sued2002']);
    for (const z of zugaenge) {
      const mandant = mandanten.find((m) => m.kundenkennung === z.kennung);
      const passwort = entschluesseln(z.geheimtext, schluessel);
      expect(await passwortPruefen(passwort, mandant?.passwortHash ?? '')).toBe(true);
    }
  });

  it('schreibt kein Passwort in die SQL, nur Geheimtext', async () => {
    const { zugaenge, sql } = await zugaengeErzeugen(schluessel, BASIS);
    for (const z of zugaenge) {
      expect(sql).toContain(z.geheimtext);
      expect(sql).not.toContain(entschluesseln(z.geheimtext, schluessel));
    }
    expect(sql).toContain(BASIS);
  });

  it('erzeugt bei jedem Lauf neue Passwörter', async () => {
    const a = await zugaengeErzeugen(schluessel, BASIS);
    const b = await zugaengeErzeugen(schluessel, BASIS);
    const pw = (x: typeof a) => x.zugaenge.map((z) => entschluesseln(z.geheimtext, schluessel));
    expect(pw(a)).not.toEqual(pw(b));
  });

  it('verlangt einen Schlüssel von 32 Byte', async () => {
    await expect(zugaengeErzeugen(randomBytes(16), BASIS)).rejects.toThrow('32 Byte');
  });
});

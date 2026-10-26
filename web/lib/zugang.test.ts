import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { Msv3Fehler } from './msv3/client';
import { verschluesseln } from './verschluesselung';
import { zugangAusZeile } from './zugang';

describe('Grosshändler-Zugang aus der Datenbankzeile', () => {
  const schluessel = randomBytes(32);
  const zeile = (passwort_verschluesselt: string) => ({
    basis_url: 'https://grosshandel.example/msv3',
    kundenkennung: 'nord1001',
    passwort_verschluesselt,
  });

  it('entschlüsselt das Passwort', () => {
    const zugang = zugangAusZeile(zeile(verschluesseln('geheim123', schluessel)), schluessel);
    expect(zugang).toEqual({
      basisUrl: 'https://grosshandel.example/msv3',
      kundenkennung: 'nord1001',
      passwort: 'geheim123',
    });
  });

  it('meldet einen falschen Schlüssel verständlich, statt die Seite abstürzen zu lassen', () => {
    let fehler: unknown;
    try {
      zugangAusZeile(zeile(verschluesseln('geheim123', schluessel)), randomBytes(32));
    } catch (e) {
      fehler = e;
    }
    expect(fehler).toBeInstanceOf(Msv3Fehler);
    expect((fehler as Msv3Fehler).errorCode).toBe('C-SCHLUESSEL');
  });
});

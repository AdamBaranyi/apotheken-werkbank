import { describe, expect, it } from 'vitest';
import { schritteFuer } from './schritte';

describe('Rundgang', () => {
  it('erklärt Bestellen und Kasse mit eigenen Schritten', () => {
    expect(schritteFuer('/bestellen').map((s) => s.titel)).toContain('Verfügbarkeit prüfen');
    expect(schritteFuer('/kasse').map((s) => s.titel)).toContain('Verkauf buchen');
  });

  it('andere Seiten bekommen den kurzen Rundgang', () => {
    expect(schritteFuer('/kasse/belege').map((s) => s.titel)).toEqual([
      'Willkommen in der Werkbank',
      'Die Bereiche',
    ]);
  });

  it('jeder Schritt hat Titel und Text', () => {
    for (const pfad of ['/bestellen', '/kasse', '/bestellungen']) {
      for (const s of schritteFuer(pfad)) {
        expect(s.titel.length, pfad).toBeGreaterThan(3);
        expect(s.text.length, pfad).toBeGreaterThan(20);
      }
    }
  });
});

import { describe, expect, it } from 'vitest';
import { SCHRITTE } from './schritte';

describe('Rundgang', () => {
  it('führt der Reihe nach durch alle Bereiche der Werkbank', () => {
    const pfade = [...new Set(SCHRITTE.flatMap((s) => (s.pfad ? [s.pfad] : [])))];
    expect(pfade).toEqual([
      '/bestellen',
      '/bestellungen',
      '/kasse',
      '/kasse/belege',
      '/kasse/abschluss',
    ]);
  });

  it('beginnt und endet dort, wo man gerade ist', () => {
    expect(SCHRITTE[0]?.pfad).toBeUndefined();
    expect(SCHRITTE.at(-1)?.pfad).toBeUndefined();
  });

  it('jeder Schritt hat Titel und Text, kein Titel doppelt', () => {
    for (const s of SCHRITTE) {
      expect(s.titel.length, s.titel).toBeGreaterThan(3);
      expect(s.text.length, s.titel).toBeGreaterThan(20);
    }
    expect(new Set(SCHRITTE.map((s) => s.titel)).size).toBe(SCHRITTE.length);
  });
});

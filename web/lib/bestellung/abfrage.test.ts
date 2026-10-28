import { describe, expect, it } from 'vitest';
import { abfragbar, abfrageAb } from './abfrage';

/*
 * Wann die Statusabfrage etwas klären kann. Gleich nach einem Abbruch
 * verarbeitet der Grosshändler die Bestellung vielleicht noch; eine Abfrage
 * hiesse dann «nicht angekommen» und lüde zum zweiten Bestellen ein. Darum
 * frühestens eine Minute nach der letzten Änderung.
 */
const GESENDET = '2026-10-28T10:00:00.000Z';
const ABGEBROCHEN = '2026-10-28T10:00:30.000Z';
const um = (zeit: string) => new Date(`2026-10-28T${zeit}.000Z`);

describe('Statusabfrage', () => {
  it('«unklar»: erst eine Minute nach dem Abbruch', () => {
    const b = { status: 'unklar', erstellt_am: GESENDET, aktualisiert_am: ABGEBROCHEN } as const;
    expect(abfragbar(b, um('10:01:00'))).toBe(false);
    expect(abfragbar(b, um('10:01:30'))).toBe(true);
    expect(abfrageAb(b)).toEqual(um('10:01:30'));
  });

  it('«wird gesendet»: erst eine Minute nach dem Senden', () => {
    const b = { status: 'wird_gesendet', erstellt_am: GESENDET, aktualisiert_am: null } as const;
    expect(abfragbar(b, um('10:00:59'))).toBe(false);
    expect(abfragbar(b, um('10:01:00'))).toBe(true);
    expect(abfrageAb(b)).toEqual(um('10:01:00'));
  });

  it('«nicht angekommen»: jederzeit erneut', () => {
    const b = {
      status: 'nicht_angekommen',
      erstellt_am: GESENDET,
      aktualisiert_am: ABGEBROCHEN,
    } as const;
    expect(abfragbar(b, um('10:00:31'))).toBe(true);
  });

  it('Endzustände: keine Abfrage', () => {
    for (const status of ['bestaetigt', 'abgelehnt', 'ohne_antwort'] as const) {
      const b = { status, erstellt_am: GESENDET, aktualisiert_am: ABGEBROCHEN };
      expect(abfragbar(b, um('11:00:00')), status).toBe(false);
      expect(abfrageAb(b), status).toBeNull();
    }
  });
});

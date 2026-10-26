import { describe, expect, it } from 'vitest';
import { ausOrtszeit, isoMitVersatz, tagesschluessel } from '../src/fachlich/berlin.ts';
import { naechsteTouren, type Bestellfenster } from '../src/fachlich/touren.ts';

const WERKTAGE = [1, 2, 3, 4, 5];
const FENSTER: Bestellfenster[] = [
  { wochentage: WERKTAGE, ende: '09:59', tour: 'T1', lieferungNachMinuten: 90 },
  { wochentage: WERKTAGE, ende: '13:59', tour: 'T2', lieferungNachMinuten: 90 },
  { wochentage: WERKTAGE, ende: '17:59', tour: 'T3', lieferungNachMinuten: 90 },
  { wochentage: [6], ende: '11:59', tour: 'S1', lieferungNachMinuten: 60 },
];

describe('Berliner Ortszeit', () => {
  it('kennt Winter- und Sommerzeit', () => {
    // Montag, 26.10.2026: seit dem 25.10. Winterzeit (+01:00)
    expect(isoMitVersatz(ausOrtszeit(2026, 10, 26, 10, 30))).toBe('2026-10-26T10:30:00+01:00');
    // Freitag, 23.10.2026: noch Sommerzeit (+02:00)
    expect(isoMitVersatz(ausOrtszeit(2026, 10, 23, 10, 30))).toBe('2026-10-23T10:30:00+02:00');
  });

  it('zählt den Kalendertag in Berlin, nicht in UTC', () => {
    // 23:30 Berlin am 26.10. ist 22:30 UTC – noch derselbe Tag
    expect(tagesschluessel(ausOrtszeit(2026, 10, 26, 23, 30))).toBe(20261026);
    // 00:30 Berlin am 27.10. ist 23:30 UTC am 26. – in Berlin schon der nächste Tag
    expect(tagesschluessel(ausOrtszeit(2026, 10, 27, 0, 30))).toBe(20261027);
  });
});

describe('naechsteTouren', () => {
  it('nimmt das laufende Fenster für Normal und das nächste für Verbund', () => {
    const touren = naechsteTouren(FENSTER, ausOrtszeit(2026, 10, 26, 10, 30));
    expect(touren).toEqual([
      { tour: 'T2', tourId: '20261026-T2', lieferzeitpunkt: '2026-10-26T15:29:00+01:00' },
      { tour: 'T3', tourId: '20261026-T3', lieferzeitpunkt: '2026-10-26T19:29:00+01:00' },
    ]);
  });

  it('zählt bis 59 Sekunden nach dem Ende noch zum alten Fenster', () => {
    const knapp = new Date(ausOrtszeit(2026, 10, 26, 13, 59).getTime() + 59_000);
    expect(naechsteTouren(FENSTER, knapp, 1)[0]?.tour).toBe('T2');
    const zuSpaet = new Date(ausOrtszeit(2026, 10, 26, 13, 59).getTime() + 60_000);
    expect(naechsteTouren(FENSTER, zuSpaet, 1)[0]?.tour).toBe('T3');
  });

  it('springt am Freitagabend auf Samstag und dann auf Montag', () => {
    const touren = naechsteTouren(FENSTER, ausOrtszeit(2026, 10, 30, 18, 30));
    expect(touren.map((t) => t.tourId)).toEqual(['20261031-S1', '20261102-T1']);
  });

  it('rechnet über ein Monatsende', () => {
    // Samstag, 31.10.2026, 12:30: Samstagsfenster vorbei → Montag, 2.11.
    const touren = naechsteTouren(FENSTER, ausOrtszeit(2026, 10, 31, 12, 30), 1);
    expect(touren[0]?.tourId).toBe('20261102-T1');
  });
});

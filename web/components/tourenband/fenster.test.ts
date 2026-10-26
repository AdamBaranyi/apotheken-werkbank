import { describe, expect, it } from 'vitest';
import type { Vertragsdaten } from '@/lib/msv3/schema';
import type { Ortszeit } from '@/lib/zeit';
import { fensterVonHeute, naechstesFenster } from './fenster';

const VERTRAG: Vertragsdaten = {
  gueltigAb: '2026-10-01',
  kundenkennung: 'nord1001',
  erlaubteAuftragsart: ['NORMAL'],
  verfuegbarkeitEinzelnSpezifisch: true,
  bestellfenster: [
    { wochentag: 'Mo', ende: '13:59', tour: 'T2' },
    { wochentag: 'Mo', ende: '09:59', tour: 'T1' },
    { wochentag: 'Mo', ende: '17:59', tour: 'T3' },
    { wochentag: 'Sa', ende: '11:59', tour: 'S1' },
  ],
};

const um = (wochentag: Ortszeit['wochentag'], hhmm: string): Ortszeit => {
  const [h, m] = hhmm.split(':').map(Number);
  return { wochentag, minuten: (h ?? 0) * 60 + (m ?? 0), text: hhmm };
};

describe('Bestellfenster', () => {
  it('ordnet nach Ende und markiert genau ein laufendes Fenster', () => {
    const fenster = fensterVonHeute(VERTRAG, um('Mo', '10:30'));
    expect(fenster.map((f) => [f.tour, f.stand])).toEqual([
      ['T1', 'vorbei'],
      ['T2', 'laeuft'],
      ['T3', 'kommt'],
    ]);
  });

  it('zählt die Endminute noch zum Fenster', () => {
    expect(fensterVonHeute(VERTRAG, um('Mo', '13:59'))[1]?.stand).toBe('laeuft');
    expect(fensterVonHeute(VERTRAG, um('Mo', '14:00'))[1]?.stand).toBe('vorbei');
  });

  it('nennt nach dem letzten Fenster das nächste an einem anderen Tag', () => {
    expect(naechstesFenster(VERTRAG, um('Mo', '19:00'))).toEqual({
      wochentag: 'Sa',
      tour: 'S1',
      ende: '11:59',
    });
    expect(naechstesFenster(VERTRAG, um('Fr', '19:00'))).toEqual({
      wochentag: 'morgen',
      tour: 'S1',
      ende: '11:59',
    });
  });
});

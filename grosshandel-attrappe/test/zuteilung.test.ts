import { describe, expect, it } from 'vitest';
import type { Artikel } from '../src/fachlich/typen.ts';
import { unspezifisch, zuteilen } from '../src/fachlich/zuteilung.ts';

function artikel(teile: Partial<Artikel> = {}): Artikel {
  return {
    pzn: '99101373',
    name: 'Erfundenes Mittel',
    bestand: 0,
    verbundBestand: 0,
    nachlieferbar: false,
    lagerartikel: true,
    btm: false,
    ...teile,
  };
}

describe('zuteilen', () => {
  it('liefert alles aus dem Hauptlager, wenn genug da ist', () => {
    const z = zuteilen(artikel({ bestand: 10 }), 3, 'Normal', false);
    expect(z.anteile).toEqual([{ typ: 'Normal', menge: 3 }]);
    expect(z.ausHauptlager).toBe(3);
  });

  it('teilt auf Hauptlager und Verbund, wenn die Vorgabe Verbund erlaubt', () => {
    const z = zuteilen(artikel({ bestand: 2, verbundBestand: 5 }), 6, 'MaxVerbund', false);
    expect(z.anteile).toEqual([
      { typ: 'Normal', menge: 2 },
      { typ: 'Verbund', menge: 4 },
    ]);
    expect(z.ausVerbund).toBe(4);
  });

  it('meldet Verbund nur als möglich, wenn die Vorgabe nur Normal erlaubt', () => {
    const z = zuteilen(artikel({ bestand: 2, verbundBestand: 5 }), 6, 'Normal', false);
    expect(z.anteile).toEqual([
      { typ: 'Normal', menge: 2 },
      { typ: 'KeineLieferungAberVerbundMoeglich', menge: 4, defektgrund: 'FehltZurzeit' },
    ]);
    expect(z.ausVerbund).toBe(0);
  });

  it('lässt den Hersteller nachliefern, wenn es die Vorgabe erlaubt', () => {
    const z = zuteilen(artikel({ bestand: 1, nachlieferbar: true }), 4, 'MaxNachlieferung', false);
    expect(z.anteile).toEqual([
      { typ: 'Normal', menge: 1 },
      { typ: 'Nachlieferung', menge: 3, defektgrund: 'FehltZurzeit' },
    ]);
  });

  it('meldet Nachlieferung nur als möglich unter der Vorgabe Verbund', () => {
    const z = zuteilen(artikel({ nachlieferbar: true }), 2, 'MaxVerbund', false);
    expect(z.anteile).toEqual([
      { typ: 'KeineLieferungAberNachlieferungMoeglich', menge: 2, defektgrund: 'FehltZurzeit' },
    ]);
  });

  it('meldet den Rest als nicht lieferbar, wenn kein Weg mehr bleibt', () => {
    const z = zuteilen(artikel({ bestand: 1 }), 3, 'MaxDispo', false);
    expect(z.anteile).toEqual([
      { typ: 'Normal', menge: 1 },
      { typ: 'NichtLieferbar', menge: 2, defektgrund: 'NichtLieferbar' },
    ]);
  });

  it('kennt unbekannte, gesperrte und BtM-Artikel ohne Erlaubnis', () => {
    expect(zuteilen(undefined, 1, 'Normal', false).anteile[0]?.defektgrund).toBe(
      'ArtikelNrUnbekannt',
    );
    expect(
      zuteilen(artikel({ bestand: 9, sperre: 'AusserHandel' }), 1, 'Normal', false).anteile[0],
    ).toEqual({ typ: 'NichtLieferbar', menge: 1, defektgrund: 'AusserHandel' });
    expect(zuteilen(artikel({ bestand: 9, btm: true }), 1, 'Normal', false).anteile[0]).toEqual({
      typ: 'NichtLieferbar',
      menge: 1,
      defektgrund: 'KeinBezug',
    });
    expect(zuteilen(artikel({ bestand: 9, btm: true }), 1, 'Normal', true).anteile[0]?.typ).toBe(
      'Normal',
    );
  });

  it('bestellt Nicht-Lagerartikel nur als Dispo', () => {
    expect(zuteilen(artikel({ lagerartikel: false }), 2, 'MaxDispo', false).anteile).toEqual([
      { typ: 'Dispo', menge: 2, defektgrund: 'NichtGefuehrt' },
    ]);
    expect(zuteilen(artikel({ lagerartikel: false }), 2, 'Normal', false).anteile[0]?.typ).toBe(
      'KeineLieferungAberDispoMoeglich',
    );
  });

  it('die Mengen aller Anteile ergeben immer die angefragte Menge', () => {
    const lager = artikel({ bestand: 3, verbundBestand: 2, nachlieferbar: true });
    for (const vorgabe of ['Normal', 'MaxVerbund', 'MaxNachlieferung', 'MaxDispo'] as const) {
      for (const menge of [1, 3, 4, 6, 9]) {
        const summe = zuteilen(lager, menge, vorgabe, false).anteile.reduce(
          (s, a) => s + (a.menge ?? 0),
          0,
        );
        expect(summe, `${vorgabe} ${menge}`).toBe(menge);
      }
    }
  });
});

describe('unspezifisch', () => {
  it('voll lieferbar heisst Normal ohne Angabe', () => {
    expect(unspezifisch(zuteilen(artikel({ bestand: 5 }), 2, 'MaxDispo', false))).toEqual({
      typ: 'Normal',
      defektgrund: 'KeineAngabe',
    });
  });

  it('teilweise lieferbar heisst Teildefekt', () => {
    expect(
      unspezifisch(zuteilen(artikel({ bestand: 1, verbundBestand: 4 }), 3, 'MaxDispo', false)),
    ).toEqual({ typ: 'Normal', defektgrund: 'TeilDefekt' });
  });

  it('gar nicht lieferbar nennt den Grund', () => {
    expect(unspezifisch(zuteilen(undefined, 3, 'MaxDispo', false))).toEqual({
      typ: 'NichtLieferbar',
      defektgrund: 'ArtikelNrUnbekannt',
    });
  });
});

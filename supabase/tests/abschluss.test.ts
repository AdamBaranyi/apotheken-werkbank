import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { als, poolSchliessen, weltAbbauen, weltBauen, type Welt } from './hilfen.ts';
import { buchen, PROBATIN, stornieren, VITAMIN } from './kasse-hilfen.ts';

/*
 * Tagesabschluss («Z-Bon»): fasst alle Belege seit dem letzten Abschluss
 * zusammen. Wer abschliesst, schickt nur die Apotheke; Nummer, Belegbereich
 * und Summen rechnet die Datenbank, und kein Beleg fällt zwischen zwei
 * Abschlüsse.
 */
interface Abschluss {
  nummer: number;
  von_beleg: number;
  bis_beleg: number;
  anzahl_belege: number;
  umsatz_cent: number;
  bar_cent: number;
  karte_cent: number;
  stornos: number;
  storno_cent: number;
  steuern: {
    satz_promille: number;
    brutto_cent: number;
    steuer_cent: number;
    netto_cent: number;
  }[];
}

let w: Welt;
beforeEach(async () => {
  w = await weltBauen();
});
afterEach(async () => {
  await weltAbbauen(w);
});
afterAll(async () => {
  await poolSchliessen();
});

function abschliessen(wer: string, apotheke: string) {
  return als<Abschluss>(
    w,
    wer,
    `insert into public.tagesabschluesse (apotheke_id) values ($1)
     returning nummer, von_beleg, bis_beleg, anzahl_belege, umsatz_cent, bar_cent, karte_cent,
               stornos, storno_cent, steuern`,
    [apotheke],
    { behalten: true },
  );
}

describe('Tagesabschluss', () => {
  it('summiert je Zahlart und je Steuersatz, wie auf den Belegen gerundet', async () => {
    await buchen(w, w.inhaberNord, w.nord, [{ pzn: PROBATIN, menge: 2 }], {
      zahlart: 'bar',
      gegeben: 1000,
    });
    await buchen(w, w.inhaberNord, w.nord, [
      { pzn: VITAMIN, menge: 1 },
      { pzn: PROBATIN, menge: 1 },
    ]);
    const z = await abschliessen(w.inhaberNord, w.nord);
    expect(z.fehler).toBeUndefined();
    expect(z.zeilen[0]).toMatchObject({
      nummer: 1,
      von_beleg: 1,
      bis_beleg: 2,
      anzahl_belege: 2,
      umsatz_cent: 1634,
      bar_cent: 790,
      karte_cent: 844,
      stornos: 0,
      storno_cent: 0,
    });
    // 19 %: 1,26 € (Beleg 1) + 0,63 € (Beleg 2); 7 %: 4,49 × 7/107 = 0,29 €.
    expect(z.zeilen[0]?.steuern).toEqual([
      { satz_promille: 70, brutto_cent: 449, steuer_cent: 29, netto_cent: 420 },
      { satz_promille: 190, brutto_cent: 1185, steuer_cent: 189, netto_cent: 996 },
    ]);
  });

  it('der nächste Abschluss beginnt beim ersten Beleg nach dem vorigen', async () => {
    await buchen(w, w.inhaberNord, w.nord, [{ pzn: PROBATIN, menge: 1 }]);
    await abschliessen(w.inhaberNord, w.nord);
    await buchen(w, w.inhaberNord, w.nord, [{ pzn: VITAMIN, menge: 1 }]);
    const zweiter = await abschliessen(w.inhaberNord, w.nord);
    expect(zweiter.zeilen[0]).toMatchObject({ nummer: 2, von_beleg: 2, bis_beleg: 2 });
  });

  it('ohne neue Belege gibt es keinen Abschluss, auch nicht beim zweiten Klick', async () => {
    expect((await abschliessen(w.inhaberNord, w.nord)).fehler).toBe('WK009');
    await buchen(w, w.inhaberNord, w.nord, [{ pzn: PROBATIN, menge: 1 }]);
    await abschliessen(w.inhaberNord, w.nord);
    expect((await abschliessen(w.inhaberNord, w.nord)).fehler).toBe('WK009');
  });

  it('ein Storno zählt mit: als Beleg, als Storno und mit negativem Betrag', async () => {
    const original = await buchen(w, w.inhaberNord, w.nord, [{ pzn: PROBATIN, menge: 2 }], {
      zahlart: 'bar',
      gegeben: 1000,
    });
    await stornieren(w, w.inhaberNord, original.zeilen[0]?.id ?? '');
    const z = await abschliessen(w.inhaberNord, w.nord);
    expect(z.zeilen[0]).toMatchObject({
      anzahl_belege: 2,
      umsatz_cent: 0,
      bar_cent: 0,
      stornos: 1,
      storno_cent: -790,
    });
  });

  it('jedes Mitglied schliesst ab, nur für die eigene Apotheke', async () => {
    await buchen(w, w.mitarbeiterSued, w.sued, [{ pzn: PROBATIN, menge: 1 }]);
    expect((await abschliessen(w.inhaberNord, w.sued)).fehler).toBe('42501');
    expect((await abschliessen(w.fremd, w.sued)).fehler).toBe('42501');
    expect((await abschliessen('anon', w.sued)).fehler).toBe('42501');
    expect((await abschliessen(w.mitarbeiterSued, w.sued)).fehler).toBeUndefined();
  });

  it('Summen setzt nur die Datenbank, und kein Abschluss wird geändert oder gelöscht', async () => {
    await buchen(w, w.inhaberNord, w.nord, [{ pzn: PROBATIN, menge: 1 }]);
    const geschoent = await als(
      w,
      w.inhaberNord,
      'insert into public.tagesabschluesse (apotheke_id, umsatz_cent) values ($1, 1)',
      [w.nord],
    );
    expect(geschoent.fehler).toBe('42501');
    await abschliessen(w.inhaberNord, w.nord);
    for (const sql of [
      'update public.tagesabschluesse set umsatz_cent = 1 where apotheke_id = $1',
      'delete from public.tagesabschluesse where apotheke_id = $1',
    ]) {
      expect((await als(w, w.inhaberNord, sql, [w.nord])).fehler, sql).toBe('42501');
    }
  });

  it('andere Apotheken sehen den Abschluss nicht', async () => {
    await buchen(w, w.inhaberNord, w.nord, [{ pzn: PROBATIN, menge: 1 }]);
    await abschliessen(w.inhaberNord, w.nord);
    for (const wer of [w.mitarbeiterSued, w.fremd]) {
      const { zeilen } = await als<{ n: number }>(
        w,
        wer,
        'select count(*)::int as n from public.tagesabschluesse',
      );
      expect(zeilen[0]?.n).toBe(0);
    }
  });
});

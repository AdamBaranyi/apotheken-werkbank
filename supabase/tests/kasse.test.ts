import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { als, alsBesitzer, poolSchliessen, weltAbbauen, weltBauen, type Welt } from './hilfen.ts';
import {
  beleg,
  buchen,
  FICTOLAT,
  PFLASTER,
  PROBATIN,
  stornieren,
  VITAMIN,
} from './kasse-hilfen.ts';

/*
 * Kasse: Verkauf, Beleg und Storno gegen die echte Datenbank. Belege werden
 * nur angehängt, nie geändert. Preise, Steuersätze und Belegnummern setzt die
 * Datenbank selbst; wer bucht, schickt nur PZN, Menge und Zahlung. Die Codes
 * WK… kommen aus den Regeln an den Tabellen (Migration «kasse»).
 */
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

describe('Steuersätze je Land', () => {
  it('Deutschland: Arzneimittel 19 %, Lebensmittel 7 %; Schweiz: Arzneimittel 2,6 %', async () => {
    const { zeilen } = await als<{ land: string; steuergruppe: string; satz_promille: number }>(
      w,
      w.mitarbeiterSued,
      `select land, steuergruppe, satz_promille from public.steuersaetze
       where (land, steuergruppe) in (('DE','arzneimittel'), ('DE','lebensmittel'), ('CH','arzneimittel'))
       order by land desc, steuergruppe`,
    );
    expect(zeilen).toEqual([
      { land: 'DE', steuergruppe: 'arzneimittel', satz_promille: 190 },
      { land: 'DE', steuergruppe: 'lebensmittel', satz_promille: 70 },
      { land: 'CH', steuergruppe: 'arzneimittel', satz_promille: 26 },
    ]);
  });
});

describe('Verkauf buchen', () => {
  it('Preis und Satz kommen aus Katalog und Land, Rückgeld aus dem Beleg', async () => {
    const gebucht = await buchen(w, w.inhaberNord, w.nord, [{ pzn: PROBATIN, menge: 2 }], {
      zahlart: 'bar',
      gegeben: 1000,
    });
    expect(gebucht.fehler).toBeUndefined();
    expect(gebucht.zeilen[0]?.belegnummer).toBe(1);
    const id = gebucht.zeilen[0]?.id ?? '';
    expect(await beleg(w, w.inhaberNord, id)).toMatchObject({
      summe_cent: 790,
      rueckgeld_cent: 210,
    });
    const steuern = await als<{ satz_promille: number; brutto_cent: number; steuer_cent: number }>(
      w,
      w.inhaberNord,
      'select satz_promille, brutto_cent, steuer_cent from public.beleg_steuern where verkauf_id = $1',
      [id],
    );
    // 7,90 € brutto mit 19 %: 790 × 190 / 1190 = 126,1 → 1,26 € Steuer.
    expect(steuern.zeilen).toEqual([{ satz_promille: 190, brutto_cent: 790, steuer_cent: 126 }]);
  });

  it('Schweiz: derselbe Artikel trägt dort 2,6 % statt 19 %', async () => {
    await alsBesitzer(w, `update public.apotheken set land = 'CH' where id = $1`, [w.nord]);
    const gebucht = await buchen(w, w.inhaberNord, w.nord, [
      { pzn: PROBATIN, menge: 1 },
      { pzn: PFLASTER, menge: 1 },
    ]);
    const steuern = await als<{ satz_promille: number; steuer_cent: number }>(
      w,
      w.inhaberNord,
      'select satz_promille, steuer_cent from public.beleg_steuern where verkauf_id = $1 order by 1',
      [gebucht.zeilen[0]?.id],
    );
    expect(steuern.zeilen).toEqual([
      { satz_promille: 26, steuer_cent: 10 },
      { satz_promille: 81, steuer_cent: 90 },
    ]);
  });

  it('ein Land ohne hinterlegte Sätze bucht nicht', async () => {
    await alsBesitzer(w, `update public.apotheken set land = 'AT' where id = $1`, [w.nord]);
    const gebucht = await buchen(w, w.inhaberNord, w.nord, [{ pzn: PROBATIN, menge: 1 }]);
    expect(gebucht.fehler).toBe('WK007');
  });

  it('Belegnummern laufen je Apotheke ohne Lücke', async () => {
    const a = await buchen(w, w.inhaberNord, w.nord, [{ pzn: PROBATIN, menge: 1 }]);
    const b = await buchen(w, w.inhaberNord, w.nord, [{ pzn: VITAMIN, menge: 1 }]);
    const c = await buchen(w, w.mitarbeiterSued, w.sued, [{ pzn: PROBATIN, menge: 1 }]);
    expect([a, b, c].map((x) => x.zeilen[0]?.belegnummer)).toEqual([1, 2, 1]);
  });

  it('derselbe Schlüssel zweimal ergibt einen Beleg und keine Lücke', async () => {
    const schluessel = randomUUID();
    const positionen = [{ pzn: PROBATIN, menge: 1 }];
    const erst = await buchen(w, w.inhaberNord, w.nord, positionen, undefined, schluessel);
    const nochmal = await buchen(w, w.inhaberNord, w.nord, positionen, undefined, schluessel);
    expect(nochmal.zeilen).toEqual(erst.zeilen);
    const naechster = await buchen(w, w.inhaberNord, w.nord, positionen);
    expect(naechster.zeilen[0]?.belegnummer).toBe(2);
  });

  it('derselbe Schlüssel mit anderem Inhalt: Fehler statt still der alte Beleg', async () => {
    // Nach einem Abbruch den Bon geändert oder mit «Zurück» zur alten Kasse: Der
    // neue Verkauf darf nicht still als der alte Beleg erscheinen.
    const schluessel = randomUUID();
    await buchen(w, w.inhaberNord, w.nord, [{ pzn: PROBATIN, menge: 1 }], undefined, schluessel);
    for (const [positionen, zahlung] of [
      [[{ pzn: PROBATIN, menge: 2 }], { zahlart: 'karte' }],
      [[{ pzn: VITAMIN, menge: 1 }], { zahlart: 'karte' }],
      [[{ pzn: PROBATIN, menge: 1 }], { zahlart: 'bar', gegeben: 500 }],
    ] as const) {
      const anders = await buchen(w, w.inhaberNord, w.nord, [...positionen], zahlung, schluessel);
      expect(anders.fehler, JSON.stringify(positionen)).toBe('WK011');
    }
  });

  it('rezeptpflichtig ohne vorgelegtes Rezept: abgelehnt, mit Rezept: gebucht', async () => {
    const ohne = await buchen(w, w.inhaberNord, w.nord, [{ pzn: FICTOLAT, menge: 1 }]);
    expect(ohne.fehler).toBe('WK002');
    const mit = await buchen(w, w.inhaberNord, w.nord, [
      { pzn: FICTOLAT, menge: 1, rezept_vorgelegt: true },
    ]);
    expect(mit.fehler).toBeUndefined();
  });

  it('bar: Der gegebene Betrag muss reichen', async () => {
    const knapp = await buchen(w, w.inhaberNord, w.nord, [{ pzn: PROBATIN, menge: 2 }], {
      zahlart: 'bar',
      gegeben: 789,
    });
    expect(knapp.fehler).toBe('WK003');
  });

  it('Mengen ausserhalb 1 bis 999 und unbekannte PZN werden abgelehnt', async () => {
    for (const menge of [0, -1, 1000]) {
      const falsch = await buchen(w, w.inhaberNord, w.nord, [{ pzn: PROBATIN, menge }]);
      expect(falsch.fehler, String(menge)).toBe('WK010');
    }
    const unbekannt = await buchen(w, w.inhaberNord, w.nord, [{ pzn: '99999994', menge: 1 }]);
    expect(unbekannt.fehler).toBe('WK008');
  });

  it('niemand bucht für eine fremde Apotheke; ohne Anmeldung gar nicht', async () => {
    const position = [{ pzn: PROBATIN, menge: 1 }];
    expect((await buchen(w, w.inhaberNord, w.sued, position)).fehler).toBe('42501');
    expect((await buchen(w, w.fremd, w.nord, position)).fehler).toBe('42501');
    expect((await buchen(w, 'anon', w.nord, position)).fehler).toBe('42501');
  });

  it('eine spätere Preisänderung ändert keinen gebuchten Beleg', async () => {
    const gebucht = await buchen(w, w.inhaberNord, w.nord, [{ pzn: PROBATIN, menge: 1 }]);
    await alsBesitzer(w, `update public.artikel set preis_cent = 999 where pzn = $1`, [PROBATIN]);
    expect((await beleg(w, w.inhaberNord, gebucht.zeilen[0]?.id ?? ''))?.summe_cent).toBe(395);
  });
});

describe('Belege sind unveränderlich', () => {
  it('Mitglieder ändern und löschen weder Kopf noch Positionen', async () => {
    const gebucht = await buchen(w, w.inhaberNord, w.nord, [{ pzn: PROBATIN, menge: 1 }]);
    const id = gebucht.zeilen[0]?.id;
    for (const sql of [
      `update public.verkaeufe set zahlart = 'bar' where id = $1`,
      'delete from public.verkaeufe where id = $1',
      'update public.verkaufspositionen set menge = 9 where verkauf_id = $1',
      'delete from public.verkaufspositionen where verkauf_id = $1',
    ]) {
      expect((await als(w, w.inhaberNord, sql, [id])).fehler, sql).toBe('42501');
    }
  });

  it('ein Kopf ohne Positionen scheitert beim Abschluss der Anfrage', async () => {
    const direkt = await als(
      w,
      w.inhaberNord,
      `insert into public.verkaeufe (id, apotheke_id, zahlart) values ($1, $2, 'karte')`,
      [randomUUID(), w.nord],
    );
    expect(direkt.fehler).toBe('WK001');
  });

  it('Preis und Satz lassen sich nicht mitschicken', async () => {
    const gebucht = await buchen(w, w.inhaberNord, w.nord, [{ pzn: PROBATIN, menge: 1 }]);
    const falsch = await als(
      w,
      w.inhaberNord,
      `insert into public.verkaufspositionen (verkauf_id, pzn, menge, einzelpreis_cent) values ($1, $2, 1, 1)`,
      [gebucht.zeilen[0]?.id, VITAMIN],
    );
    expect(falsch.fehler).toBe('42501');
  });

  it('an einen Beleg aus einer früheren Anfrage hängt niemand Positionen an', async () => {
    const alt = randomUUID();
    await alsBesitzer(
      w,
      `insert into public.verkaeufe (id, apotheke_id, zahlart, erstellt_am)
       values ($1, $2, 'karte', now() - interval '1 hour')`,
      [alt, w.nord],
    );
    await alsBesitzer(
      w,
      'insert into public.verkaufspositionen (verkauf_id, pzn, menge) values ($1, $2, 1)',
      [alt, PROBATIN],
    );
    const anhaengen = await als(
      w,
      w.inhaberNord,
      'insert into public.verkaufspositionen (verkauf_id, pzn, menge) values ($1, $2, 1)',
      [alt, VITAMIN],
    );
    expect(anhaengen.fehler).toBe('42501');
  });

  it('Belege anderer Apotheken bleiben unsichtbar', async () => {
    await buchen(w, w.inhaberNord, w.nord, [{ pzn: PROBATIN, menge: 1 }]);
    for (const wer of [w.mitarbeiterSued, w.fremd]) {
      for (const tabelle of ['verkaeufe', 'verkaufspositionen', 'belege', 'beleg_steuern']) {
        const { zeilen } = await als<{ n: number }>(
          w,
          wer,
          `select count(*)::int as n from public.${tabelle}`,
        );
        expect(zeilen[0]?.n, tabelle).toBe(0);
      }
    }
  });
});

describe('Storno', () => {
  it('Inhaber storniert: Gegenbeleg mit den Preisen des Originals, auch nach Preisänderung', async () => {
    const original = (
      await buchen(w, w.inhaberNord, w.nord, [{ pzn: PROBATIN, menge: 2 }], {
        zahlart: 'bar',
        gegeben: 1000,
      })
    ).zeilen[0];
    await alsBesitzer(w, `update public.artikel set preis_cent = 999 where pzn = $1`, [PROBATIN]);
    const storno = await stornieren(w, w.inhaberNord, original?.id ?? '');
    expect(storno.fehler).toBeUndefined();
    expect(storno.zeilen[0]?.belegnummer).toBe(2);
    expect(await beleg(w, w.inhaberNord, storno.zeilen[0]?.id ?? '')).toMatchObject({
      summe_cent: -790,
    });
    expect((await beleg(w, w.inhaberNord, original?.id ?? ''))?.storniert_durch).toBe(
      storno.zeilen[0]?.id,
    );
  });

  it('derselbe Schlüssel für das Storno eines anderen Belegs: Fehler', async () => {
    const a = (await buchen(w, w.inhaberNord, w.nord, [{ pzn: PROBATIN, menge: 1 }])).zeilen[0];
    const b = (await buchen(w, w.inhaberNord, w.nord, [{ pzn: VITAMIN, menge: 1 }])).zeilen[0];
    const schluessel = randomUUID();
    await stornieren(w, w.inhaberNord, a?.id ?? '', schluessel);
    expect((await stornieren(w, w.inhaberNord, b?.id ?? '', schluessel)).fehler).toBe('WK011');
  });

  it('Mitarbeiter stornieren nicht', async () => {
    const original = (await buchen(w, w.mitarbeiterSued, w.sued, [{ pzn: PROBATIN, menge: 1 }]))
      .zeilen[0];
    expect((await stornieren(w, w.mitarbeiterSued, original?.id ?? '')).fehler).toBe('42501');
  });

  it('ein Beleg wird nur einmal storniert, ein Storno gar nicht', async () => {
    const original = (await buchen(w, w.inhaberNord, w.nord, [{ pzn: PROBATIN, menge: 1 }]))
      .zeilen[0];
    const storno = await stornieren(w, w.inhaberNord, original?.id ?? '');
    expect((await stornieren(w, w.inhaberNord, original?.id ?? '')).fehler).toBe('23505');
    expect((await stornieren(w, w.inhaberNord, storno.zeilen[0]?.id ?? '')).fehler).toBe('WK005');
  });

  it('einen fremden oder unbekannten Beleg storniert niemand', async () => {
    const fremd = (await buchen(w, w.mitarbeiterSued, w.sued, [{ pzn: PROBATIN, menge: 1 }]))
      .zeilen[0];
    expect((await stornieren(w, w.inhaberNord, fremd?.id ?? '')).fehler).toBe('WK004');
    expect((await stornieren(w, w.inhaberNord, randomUUID())).fehler).toBe('WK004');
  });

  it('ein Storno von Hand muss das Original genau spiegeln', async () => {
    const original = (
      await buchen(w, w.inhaberNord, w.nord, [
        { pzn: PROBATIN, menge: 2 },
        { pzn: VITAMIN, menge: 1 },
      ])
    ).zeilen[0];
    // Zwei Anweisungen wie zwei Aufrufe an die REST-Schnittstelle in einer
    // Transaktion; die Kennungen stammen aus randomUUID, nicht von aussen.
    const id = randomUUID();
    const teil = await als(
      w,
      w.inhaberNord,
      `do $$ begin
         insert into public.verkaeufe (id, apotheke_id, zahlart, storno_von)
           values ('${id}', '${w.nord}', 'karte', '${original?.id}');
         insert into public.verkaufspositionen (verkauf_id, pzn, menge) values ('${id}', '${PROBATIN}', -2);
       end $$`,
    );
    expect(teil.fehler).toBe('WK006');
  });
});

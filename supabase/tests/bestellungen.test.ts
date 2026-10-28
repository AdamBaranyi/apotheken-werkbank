import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { als, alsBesitzer, poolSchliessen, weltAbbauen, weltBauen, type Welt } from './hilfen.ts';
import { PROBATIN, VITAMIN } from './kasse-hilfen.ts';

/*
 * Bestellungen beim Grosshändler: Die ID legt die App vor dem Senden fest und
 * schickt sie als MSV3-Bestell-ID mit. So wird ein Doppelklick nie zur
 * zweiten Bestellung, und nach einem Abbruch lässt sich der Status beim
 * Grosshändler abfragen. Der Status in der Datenbank ist eine Kopie seiner
 * Antwort; aus einem Endzustand führt kein Weg zurück.
 */
interface Angelegt {
  id: string;
  auftrag_id: string;
  support_id: number;
  neu: boolean;
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

function anlegen(
  wer: string,
  zugang: string,
  positionen: { pzn: string; menge: number }[],
  id: string = randomUUID(),
) {
  return als<Angelegt>(
    w,
    wer,
    'select * from public.bestellung_anlegen($1, $2, $3::jsonb)',
    [id, zugang, JSON.stringify(positionen)],
    { behalten: true },
  );
}

function status(wer: string, id: string, neu: string, antwort: object | null = null) {
  return als<{ status: string }>(
    w,
    wer,
    `update public.bestellungen set status = $2, meldung = 'Test', antwort = $3::jsonb
     where id = $1 returning status`,
    [id, neu, antwort ? JSON.stringify(antwort) : null],
    { behalten: true },
  );
}

describe('Bestellung anlegen', () => {
  it('Mitglied legt an: Support-Nummer fortlaufend, Status «wird_gesendet»', async () => {
    const erste = await anlegen(w.inhaberNord, w.zugangNord, [{ pzn: PROBATIN, menge: 3 }]);
    expect(erste.fehler).toBeUndefined();
    expect(erste.zeilen[0]).toMatchObject({ support_id: 1, neu: true });
    const zweite = await anlegen(w.inhaberNord, w.zugangNord, [{ pzn: VITAMIN, menge: 1 }]);
    expect(zweite.zeilen[0]?.support_id).toBe(2);
    const { zeilen } = await als<{ status: string; apotheke_id: string }>(
      w,
      w.inhaberNord,
      'select status, apotheke_id from public.bestellungen where id = $1',
      [erste.zeilen[0]?.id],
    );
    expect(zeilen).toEqual([{ status: 'wird_gesendet', apotheke_id: w.nord }]);
  });

  it('derselbe Schlüssel zweimal: dieselbe Bestellung, nichts doppelt', async () => {
    const id = randomUUID();
    const erst = await anlegen(w.inhaberNord, w.zugangNord, [{ pzn: PROBATIN, menge: 3 }], id);
    const nochmal = await anlegen(w.inhaberNord, w.zugangNord, [{ pzn: PROBATIN, menge: 3 }], id);
    expect(nochmal.zeilen[0]).toEqual({ ...erst.zeilen[0], neu: false });
    const { zeilen } = await als<{ menge: number }>(
      w,
      w.inhaberNord,
      'select menge from public.bestellpositionen where bestellung_id = $1',
      [id],
    );
    expect(zeilen).toEqual([{ menge: 3 }]);
  });

  it('derselbe Schlüssel mit anderen Mengen: Fehler statt still die alte Bestellung', async () => {
    const id = randomUUID();
    await anlegen(w.inhaberNord, w.zugangNord, [{ pzn: PROBATIN, menge: 3 }], id);
    for (const positionen of [
      [{ pzn: PROBATIN, menge: 4 }],
      [{ pzn: VITAMIN, menge: 3 }],
      [
        { pzn: PROBATIN, menge: 3 },
        { pzn: VITAMIN, menge: 1 },
      ],
    ]) {
      expect((await anlegen(w.inhaberNord, w.zugangNord, positionen, id)).fehler).toBe('WB004');
    }
  });

  it('nur mit einem Zugang der eigenen Apotheke; ohne Anmeldung gar nicht', async () => {
    const positionen = [{ pzn: PROBATIN, menge: 1 }];
    expect((await anlegen(w.inhaberNord, w.zugangSued, positionen)).fehler).toBe('WB002');
    expect((await anlegen(w.fremd, w.zugangNord, positionen)).fehler).toBe('WB002');
    expect((await anlegen('anon', w.zugangNord, positionen)).fehler).toBe('42501');
  });

  it('ohne Positionen und mit Mengen über 9999 wird nichts angelegt', async () => {
    expect((await anlegen(w.inhaberNord, w.zugangNord, [])).fehler).toBe('WB003');
    const zuViel = await anlegen(w.inhaberNord, w.zugangNord, [{ pzn: PROBATIN, menge: 10000 }]);
    expect(zuViel.fehler).toBe('23514');
  });
});

describe('Status einer Bestellung', () => {
  it('folgt der Antwort des Grosshändlers; aus einem Endzustand führt kein Weg zurück', async () => {
    const b = (await anlegen(w.inhaberNord, w.zugangNord, [{ pzn: PROBATIN, menge: 1 }])).zeilen[0];
    const id = b?.id ?? '';
    expect((await status(w.inhaberNord, id, 'unklar')).zeilen).toEqual([{ status: 'unklar' }]);
    expect(
      (await status(w.inhaberNord, id, 'bestaetigt', { positionen: [] })).fehler,
    ).toBeUndefined();
    expect((await status(w.inhaberNord, id, 'unklar')).fehler).toBe('WB001');
  });

  it('springt nicht über den Grosshändler hinweg', async () => {
    const b = (await anlegen(w.inhaberNord, w.zugangNord, [{ pzn: PROBATIN, menge: 1 }])).zeilen[0];
    // «nicht angekommen» weiss nur, wer den Status beim Grosshändler abgefragt hat.
    expect((await status(w.inhaberNord, b?.id ?? '', 'nicht_angekommen')).fehler).toBe('WB001');
  });

  it('Mitglieder ändern nur Status, Meldung und Antwort, und nur bei der eigenen Apotheke', async () => {
    const b = (await anlegen(w.inhaberNord, w.zugangNord, [{ pzn: PROBATIN, menge: 1 }])).zeilen[0];
    const id = b?.id ?? '';
    for (const sql of [
      'update public.bestellungen set apotheke_id = $2 where id = $1',
      'update public.bestellungen set support_id = 99 where id = $1 and $2::uuid is not null',
      'update public.bestellpositionen set menge = 9 where bestellung_id = $1 and $2::uuid is not null',
      'delete from public.bestellungen where id = $1 and $2::uuid is not null',
    ]) {
      expect((await als(w, w.inhaberNord, sql, [id, w.sued])).fehler, sql).toBe('42501');
    }
    const fremd = await als<{ id: string }>(
      w,
      w.mitarbeiterSued,
      `update public.bestellungen set status = 'unklar' where id = $1 returning id`,
      [id],
    );
    expect(fremd.zeilen).toEqual([]);
  });
});

describe('Positionen und Sichtbarkeit', () => {
  it('an eine Bestellung aus einer früheren Anfrage hängt niemand Positionen an', async () => {
    const alt = randomUUID();
    await alsBesitzer(
      w,
      `insert into public.bestellungen (id, apotheke_id, zugang_id, erstellt_am)
       values ($1, $2, $3, now() - interval '1 hour')`,
      [alt, w.nord, w.zugangNord],
    );
    await alsBesitzer(
      w,
      'insert into public.bestellpositionen (bestellung_id, pzn, menge) values ($1, $2, 1)',
      [alt, PROBATIN],
    );
    const anhaengen = await als(
      w,
      w.inhaberNord,
      'insert into public.bestellpositionen (bestellung_id, pzn, menge) values ($1, $2, 1)',
      [alt, VITAMIN],
    );
    expect(anhaengen.fehler).toBe('42501');
  });

  it('eine Bestellung ohne Positionen scheitert beim Abschluss der Anfrage', async () => {
    const direkt = await als(
      w,
      w.inhaberNord,
      'insert into public.bestellungen (id, apotheke_id, zugang_id) values ($1, $2, $3)',
      [randomUUID(), w.nord, w.zugangNord],
    );
    expect(direkt.fehler).toBe('WB003');
  });

  it('ein Zugang einer fremden Apotheke passt nicht, auch nicht direkt eingefügt', async () => {
    const direkt = await als(
      w,
      w.inhaberNord,
      'insert into public.bestellungen (id, apotheke_id, zugang_id) values ($1, $2, $3)',
      [randomUUID(), w.nord, w.zugangSued],
    );
    expect(direkt.fehler).toBe('23503');
  });

  it('fremde Bestellungen bleiben unsichtbar', async () => {
    await anlegen(w.inhaberNord, w.zugangNord, [{ pzn: PROBATIN, menge: 1 }]);
    for (const wer of [w.mitarbeiterSued, w.fremd]) {
      for (const tabelle of ['bestellungen', 'bestellpositionen']) {
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

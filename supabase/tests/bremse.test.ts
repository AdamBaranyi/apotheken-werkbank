import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  als,
  alsBesitzer,
  DB_URL,
  poolSchliessen,
  weltAbbauen,
  weltBauen,
  type Welt,
} from './hilfen.ts';

/*
 * Die Bremse gegen zu viele Versuche: Zähler in der Datenbank, damit alle
 * Funktionen auf Vercel dieselbe Grenze sehen. Prüfen und Zählen geschehen in
 * einem Schritt unter einer Sperre je Schlüssel; ein Erfolg gibt seine
 * Zählung frei. Erreichbar nur über die eigene Rolle werkbank_bremse, die
 * sonst nichts darf – nicht über die REST-Schnittstelle.
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

/** Wie die Web-App: angemeldet als werkbank_bremse (im Test über SET ROLE). */
async function alsBremse<T extends Record<string, unknown>>(sql: string, werte: unknown[] = []) {
  const c = w.client;
  await c.query('savepoint bremse');
  try {
    await c.query('grant werkbank_bremse to current_user with set true, inherit false');
    await c.query('set local role werkbank_bremse');
    const { rows } = await c.query<T>(sql, werte);
    await c.query('reset role');
    await c.query('release savepoint bremse');
    return { zeilen: rows, fehler: undefined as string | undefined };
  } catch (fehler) {
    await c.query('rollback to savepoint bremse');
    await c.query('reset role');
    return { zeilen: [] as T[], fehler: (fehler as { code?: string }).code };
  }
}

const versuchen = async (schluessel: string[], grenzen: number[], fenster = 900) =>
  (
    await alsBremse<{ ids: string[] | null }>('select privat.bremse_versuchen($1, $2, $3) as ids', [
      schluessel,
      grenzen,
      fenster,
    ])
  ).zeilen[0]?.ids;
const freigeben = (ids: string[]) => alsBremse('select privat.bremse_freigeben($1)', [ids]);
const anzahl = async (schluessel: string) =>
  (
    await w.client.query<{ n: number }>(
      'select count(*)::int as n from privat.bremsen where schluessel = $1',
      [schluessel],
    )
  ).rows[0]?.n;

describe('Bremse', () => {
  it('zählt jeden Versuch und bremst, sobald ein Schlüssel seine Grenze erreicht', async () => {
    for (let i = 0; i < 5; i++) expect(await versuchen(['konto:a'], [5])).toHaveLength(1);
    expect(await versuchen(['konto:a'], [5])).toBeNull();
    expect(await versuchen(['konto:b'], [5])).toHaveLength(1);
    // Gesperrt, sobald einer gesperrt ist – und dann zählt auch der andere nicht.
    expect(await versuchen(['konto:b', 'konto:a'], [5, 5])).toBeNull();
    expect(await anzahl('konto:b')).toBe(1);
  });

  it('ein freigegebener Versuch zählt nicht mehr', async () => {
    const ids = (await versuchen(['konto:a'], [1])) ?? [];
    expect(await versuchen(['konto:a'], [1])).toBeNull();
    await freigeben(ids);
    expect(await versuchen(['konto:a'], [1])).toHaveLength(1);
  });

  it('zählt nur Versuche im Fenster und räumt Einträge älter als einen Tag weg', async () => {
    await alsBesitzer(
      w,
      `insert into privat.bremsen (schluessel, zeitpunkt)
       select 'konto:a', now() - interval '20 minutes' from generate_series(1, 5)
       union all select 'konto:a', now() - interval '2 days'`,
    );
    expect(await versuchen(['konto:a'], [5])).toHaveLength(1);
    const { rows } = await w.client.query<{ n: number }>(
      `select count(*)::int as n from privat.bremsen where zeitpunkt < now() - interval '1 day'`,
    );
    expect(rows[0]?.n).toBe(0);
  });

  it('verlangt zu jedem Schlüssel eine Grenze ab 1', async () => {
    for (const [schluessel, grenzen] of [
      [['konto:a', 'ip:b'], [5]],
      [['konto:a'], [0]],
      [['konto:a'], [null]],
      [[], []],
    ]) {
      const falsch = await alsBremse('select privat.bremse_versuchen($1, $2, 900)', [
        schluessel,
        grenzen,
      ]);
      expect(falsch.fehler, JSON.stringify(grenzen)).toBe('22023');
    }
  });

  it('parallele Versuche kommen nacheinander dran: Bei Grenze 1 kommt nur einer durch', async () => {
    // Eigene Verbindungen: Die Sperre wirkt zwischen Transaktionen, nicht in einer.
    const schluessel = `parallel:${randomUUID()}`;
    const a = new pg.Client({ connectionString: DB_URL });
    const b = new pg.Client({ connectionString: DB_URL });
    await a.connect();
    await b.connect();
    const sql = 'select privat.bremse_versuchen($1, $2, 60) as ids';
    let zweiter: Promise<pg.QueryResult<{ ids: string[] | null }>> | undefined;
    try {
      await a.query('begin');
      const erster = await a.query<{ ids: string[] | null }>(sql, [[schluessel], [1]]);
      zweiter = b.query<{ ids: string[] | null }>(sql, [[schluessel], [1]]);
      await new Promise((weiter) => setTimeout(weiter, 300));
      await a.query('commit');
      expect(erster.rows[0]?.ids).toHaveLength(1);
      expect((await zweiter).rows[0]?.ids).toBeNull();
    } finally {
      await a.query('rollback');
      await zweiter?.catch(() => undefined);
      await a.query('delete from privat.bremsen where schluessel = $1', [schluessel]);
      await a.end();
      await b.end();
    }
  });

  it('die Rolle der Bremse liest und schreibt sonst nichts', async () => {
    for (const sql of [
      'select 1 from public.apotheken limit 1',
      'select 1 from privat.bremsen limit 1',
      `insert into privat.bremsen (schluessel) values ('x')`,
      'select privat.meine_apotheken()',
    ]) {
      expect((await alsBremse(sql)).fehler, sql).toBe('42501');
    }
  });

  it('weder anon noch angemeldete Personen erreichen die Bremse', async () => {
    for (const wer of ['anon', w.inhaberNord]) {
      for (const sql of [
        `select privat.bremse_versuchen(array['konto:a'], array[5], 900)`,
        'select privat.bremse_freigeben(array[1::bigint])',
      ]) {
        expect((await als(w, wer, sql)).fehler, `${wer}: ${sql}`).toBe('42501');
      }
    }
  });
});

import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { als, alsBesitzer, poolSchliessen, weltAbbauen, weltBauen, type Welt } from './hilfen.ts';

/*
 * Die Bremse gegen zu viele Versuche: Zähler in der Datenbank, damit alle
 * Funktionen auf Vercel dieselbe Grenze sehen. Erreichbar nur über die eigene
 * Rolle werkbank_bremse, die sonst nichts darf – nicht über die
 * REST-Schnittstelle, also ohne Advisor-Befund und ohne Geheimschlüssel.
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

const frei = (schluessel: string[], grenzen: number[], fenster = 900) =>
  alsBremse<{ frei: boolean }>('select privat.bremse_frei($1, $2, $3) as frei', [
    schluessel,
    grenzen,
    fenster,
  ]);
const zaehlen = (schluessel: string[]) =>
  alsBremse('select privat.bremse_zaehlen($1)', [schluessel]);

describe('Bremse', () => {
  it('ist frei, bis ein Schlüssel seine Grenze im Fenster erreicht', async () => {
    for (let i = 0; i < 5; i++) await zaehlen(['konto:a']);
    expect((await frei(['konto:a'], [5])).zeilen[0]?.frei).toBe(false);
    expect((await frei(['konto:a'], [6])).zeilen[0]?.frei).toBe(true);
    expect((await frei(['konto:b'], [5])).zeilen[0]?.frei).toBe(true);
    // Mehrere Schlüssel: gesperrt, sobald einer gesperrt ist.
    expect((await frei(['konto:b', 'konto:a'], [5, 5])).zeilen[0]?.frei).toBe(false);
  });

  it('zählt nur Versuche im Fenster und räumt Einträge älter als einen Tag weg', async () => {
    await alsBesitzer(
      w,
      `insert into privat.bremsen (schluessel, zeitpunkt)
       select 'konto:a', now() - interval '20 minutes' from generate_series(1, 5)
       union all select 'konto:a', now() - interval '2 days'`,
    );
    expect((await frei(['konto:a'], [5])).zeilen[0]?.frei).toBe(true);
    await zaehlen(['konto:a']);
    const { rows } = await w.client.query<{ n: number }>(
      `select count(*)::int as n from privat.bremsen where zeitpunkt < now() - interval '1 day'`,
    );
    expect(rows[0]?.n).toBe(0);
  });

  it('verlangt zu jedem Schlüssel eine Grenze', async () => {
    expect((await frei(['konto:a', 'ip:b'], [5])).fehler).toBe('22023');
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
      const versuch = await als(w, wer, `select privat.bremse_zaehlen(array['konto:a'])`);
      expect(versuch.fehler).toBe('42501');
    }
  });
});

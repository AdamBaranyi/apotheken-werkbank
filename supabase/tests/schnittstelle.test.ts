import { readFileSync } from 'node:fs';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DB_URL } from './hilfen.ts';

/*
 * Was die REST-Schnittstelle von Supabase von aussen erreicht: jede Funktion in
 * einem veröffentlichten Schema, die anon oder authenticated ausführen dürfen.
 * Funktionen mit SECURITY DEFINER laufen dort mit den Rechten ihres Besitzers,
 * darum ist jede einzelne ein Entscheid. Der Test prüft dasselbe wie der
 * Advisor 0029 von Supabase, aber schon in der CI und nicht erst nach dem Deploy.
 */
const KONFIG = readFileSync(new URL('../config.toml', import.meta.url), 'utf8');
const VEROEFFENTLICHT = JSON.parse(/^schemas = (\[.*\])$/m.exec(KONFIG)?.[1] ?? '[]') as string[];

const db = new pg.Client({ connectionString: DB_URL });
beforeAll(() => db.connect());
afterAll(() => db.end());

describe('REST-Schnittstelle', () => {
  it('liest die veröffentlichten Schemas aus der Konfiguration', () => {
    expect(VEROEFFENTLICHT).toContain('public');
  });

  it('erreicht nur eine Funktion mit fremden Rechten: die für Zugangsdaten (E17)', async () => {
    const { rows } = await db.query<{ funktion: string; rolle: string }>(
      `select n.nspname || '.' || p.proname as funktion, r.rolle
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       cross join (values ('anon'), ('authenticated')) as r(rolle)
       where n.nspname = any($1) and p.prosecdef
         and has_function_privilege(r.rolle, p.oid, 'execute')
       order by 1, 2`,
      [VEROEFFENTLICHT],
    );
    expect(rows).toEqual([{ funktion: 'public.zugang_fuer_bestellung', rolle: 'authenticated' }]);
  });
});

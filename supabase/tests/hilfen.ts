import { randomUUID } from 'node:crypto';
import pg from 'pg';

/*
 * Jeder Test läuft in einer eigenen Transaktion, die am Ende zurückgerollt
 * wird: Die Testdaten berühren nie den Stand der Entwicklungsdatenbank, und
 * Tests stören sich nicht gegenseitig. Rollen werden mit `set local role`
 * gewechselt, die Kennung des Benutzers kommt wie bei Supabase aus
 * `request.jwt.claims` (auth.uid() liest sie dort).
 */
export const DB_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:54402/postgres';

export interface Welt {
  client: pg.PoolClient;
  inhaberNord: string;
  mitarbeiterSued: string;
  fremd: string;
  nord: string;
  sued: string;
  zugangNord: string;
  zugangSued: string;
}

const pool = new pg.Pool({ connectionString: DB_URL, max: 4 });

export async function poolSchliessen(): Promise<void> {
  await pool.end();
}

async function benutzer(client: pg.PoolClient, email: string): Promise<string> {
  const id = randomUUID();
  await client.query(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, '', now(), now())`,
    [id, email],
  );
  return id;
}

/** Baut zwei Apotheken mit je einem Mitglied, einen Fremden und je einen Grosshändler-Zugang. */
export async function weltBauen(): Promise<Welt> {
  const client = await pool.connect();
  try {
    return await weltFuellen(client);
  } catch (fehler) {
    // Ohne Rückgabe hinge jede weitere Probe am leeren Pool.
    await client.query('rollback').catch(() => undefined);
    client.release();
    throw fehler;
  }
}

async function weltFuellen(client: pg.PoolClient): Promise<Welt> {
  await client.query('begin');
  const inhaberNord = await benutzer(client, `inhaber.${randomUUID()}@werkbank.test`);
  const mitarbeiterSued = await benutzer(client, `mitarbeit.${randomUUID()}@werkbank.test`);
  const fremd = await benutzer(client, `fremd.${randomUUID()}@werkbank.test`);
  const apo = await client.query<{ id: string }>(
    `insert into public.apotheken (name) values ('Testapotheke Nord'), ('Testapotheke Süd') returning id`,
  );
  const [nord, sued] = apo.rows.map((r) => r.id) as [string, string];
  await client.query(
    `insert into public.mitglieder (apotheke_id, user_id, rolle) values ($1, $2, 'inhaber'), ($3, $4, 'mitarbeiter')`,
    [nord, inhaberNord, sued, mitarbeiterSued],
  );
  const zugang = await client.query<{ id: string }>(
    `insert into public.grosshaendler_zugaenge (apotheke_id, bezeichnung, basis_url, kundenkennung, passwort_verschluesselt)
     values ($1, 'Attrappe', 'https://grosshandel.test/msv3', 'nord1001', 'v1:geheim-nord'),
            ($2, 'Attrappe', 'https://grosshandel.test/msv3', 'sued2002', 'v1:geheim-sued')
     returning id`,
    [nord, sued],
  );
  const [zugangNord, zugangSued] = zugang.rows.map((r) => r.id) as [string, string];
  return { client, inhaberNord, mitarbeiterSued, fremd, nord, sued, zugangNord, zugangSued };
}

export async function weltAbbauen(welt: Welt): Promise<void> {
  await welt.client.query('rollback');
  welt.client.release();
}

/** Führt eine Abfrage als Rolle aus, in einem Sicherungspunkt, damit ein Fehler die Transaktion nicht beendet. */
export async function als<T extends pg.QueryResultRow>(
  welt: Welt,
  wer: 'anon' | string,
  sql: string,
  werte: unknown[] = [],
): Promise<{ zeilen: T[]; fehler?: string }> {
  const c = welt.client;
  await c.query('savepoint probe');
  try {
    if (wer === 'anon') {
      await c.query(`select set_config('request.jwt.claims', '{"role":"anon"}', true)`);
      await c.query('set local role anon');
    } else {
      const claims = JSON.stringify({ sub: wer, role: 'authenticated' });
      await c.query(`select set_config('request.jwt.claims', $1, true)`, [claims]);
      await c.query('set local role authenticated');
    }
    const ergebnis = await c.query<T>(sql, werte);
    return { zeilen: ergebnis.rows };
  } catch (fehler) {
    return { zeilen: [], fehler: (fehler as { code?: string }).code ?? String(fehler) };
  } finally {
    await c.query('rollback to savepoint probe');
    await c.query('reset role');
  }
}

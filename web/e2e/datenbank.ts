import pg from 'pg';

/** Dieselbe lokale Datenbank wie in supabase/tests/hilfen.ts. */
const DB_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:54402/postgres';

/**
 * Nur für Tests: Das Konto vergisst, dass es den Rundgang schon gesehen hat.
 * So prüft der Test das erste Anmelden bei jedem Lauf, auch lokal mehrmals.
 */
export async function rundgangVergessen(email: string): Promise<void> {
  const db = new pg.Client({ connectionString: DB_URL });
  await db.connect();
  try {
    await db.query(
      "update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'rundgang_gesehen' where email = $1",
      [email],
    );
  } finally {
    await db.end();
  }
}

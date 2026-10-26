import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DEMO_APOTHEKEN } from '../../scripts/demo-apotheken.ts';
import { zugaengeErzeugen } from '../../scripts/produktion-zugaenge.ts';
import { DB_URL } from './hilfen.ts';

/*
 * Die SQL für die Produktion gegen eine echte Datenbank, in einer Transaktion,
 * die am Ende zurückgerollt wird. Sonst fiele ein Fehler darin erst in der
 * Cloud auf.
 */
const db = new pg.Client({ connectionString: DB_URL });
beforeAll(() => db.connect());
afterAll(() => db.end());
beforeEach(() => db.query('begin'));
afterEach(() => db.query('rollback'));

async function kontenAnlegen(): Promise<void> {
  const emails = DEMO_APOTHEKEN.map((a) => a.email);
  await db.query('delete from auth.users where email = any($1)', [emails]);
  for (const email of emails) {
    await db.query(
      `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
       values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $1, '', now(), now())`,
      [email],
    );
  }
}

describe('SQL der Produktionszugänge', () => {
  it('legt beide Apotheken mit Konto und Zugang an, auch beim zweiten Lauf nur einmal', async () => {
    await kontenAnlegen();
    const { sql } = await zugaengeErzeugen(randomBytes(32), 'https://grosshandel.example/msv3');
    await db.query(sql);
    await db.query(sql);
    const { rows } = await db.query<{ name: string; rolle: string; kennung: string }>(
      `select a.name, m.rolle, z.kundenkennung as kennung
       from public.apotheken a
       join public.mitglieder m on m.apotheke_id = a.id
       join public.grosshaendler_zugaenge z on z.apotheke_id = a.id
       where a.name like '%(erfunden)'
       order by a.name`,
    );
    expect(rows).toEqual([
      { name: 'Apotheke am Nordtor (erfunden)', rolle: 'inhaber', kennung: 'nord1001' },
      { name: 'Süd-Apotheke Musterstadt (erfunden)', rolle: 'mitarbeiter', kennung: 'sued2002' },
    ]);
  });

  it('bricht ab, solange die Konten fehlen', async () => {
    await db.query('delete from auth.users where email = any($1)', [
      DEMO_APOTHEKEN.map((a) => a.email),
    ]);
    const { sql } = await zugaengeErzeugen(randomBytes(32), 'https://grosshandel.example/msv3');
    await expect(db.query(sql)).rejects.toThrow('Konten');
  });
});

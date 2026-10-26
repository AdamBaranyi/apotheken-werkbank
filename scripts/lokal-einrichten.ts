/**
 * Richtet die lokale Umgebung ein (auch in der CI): Mandanten der
 * Grosshandel-Attrappe, zwei Testkonten, zwei erfundene Apotheken und je einen
 * verschlüsselten Grosshändler-Zugang. Passwörter entstehen bei jedem Lauf neu
 * und landen nur in .lokal/ (nie im Repo); der Schlüssel für die Zugänge
 * bleibt zwischen Läufen gleich.
 *
 * Läuft nur gegen eine lokale Supabase (127.0.0.1 oder localhost).
 * Aufruf: node scripts/lokal-einrichten.ts
 */
import { createCipheriv, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import pg from 'pg';
import { passwortHashen } from '../grosshandel-attrappe/src/anmeldung.ts';

const ORDNER = '.lokal';
const ATTRAPPE = 'http://127.0.0.1:3501/msv3';

interface Status {
  API_URL: string;
  DB_URL: string;
  PUBLISHABLE_KEY: string;
  SECRET_KEY: string;
}

function status(): Status {
  const roh = execFileSync('./node_modules/.bin/supabase', ['status', '-o', 'json'], {
    encoding: 'utf8',
  });
  const s = JSON.parse(roh.slice(roh.indexOf('{'))) as Status;
  if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(s.API_URL))
    throw new Error('Nur gegen eine lokale Supabase.');
  return s;
}

function geheim(): string {
  return randomBytes(18)
    .toString('base64')
    .replace(/[^A-Za-z0-9]/g, 'k');
}

function schluessel(): string {
  const datei = `${ORDNER}/zugang-schluessel.txt`;
  if (existsSync(datei)) return readFileSync(datei, 'utf8').trim();
  const neu = randomBytes(32).toString('base64');
  writeFileSync(datei, neu, { mode: 0o600 });
  return neu;
}

function verschluesseln(klartext: string, schluesselB64: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', Buffer.from(schluesselB64, 'base64'), iv);
  const text = Buffer.concat([c.update(klartext, 'utf8'), c.final()]);
  return [
    'v1',
    iv.toString('base64'),
    c.getAuthTag().toString('base64'),
    text.toString('base64'),
  ].join(':');
}

async function kontoAnlegen(s: Status, email: string, passwort: string): Promise<string> {
  const antwort = await fetch(`${s.API_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: s.SECRET_KEY,
      Authorization: `Bearer ${s.SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password: passwort, email_confirm: true }),
  });
  if (!antwort.ok) throw new Error(`Konto ${email}: ${antwort.status} ${await antwort.text()}`);
  return ((await antwort.json()) as { id: string }).id;
}

const APOTHEKEN = [
  {
    name: 'Apotheke am Nordtor (erfunden)',
    email: 'inhaber.nord@werkbank.test',
    rolle: 'inhaber',
    kennung: 'nord1001',
    vertrag: 'standard',
    btm: true,
  },
  {
    name: 'Süd-Apotheke Musterstadt (erfunden)',
    email: 'mitarbeit.sued@werkbank.test',
    rolle: 'mitarbeiter',
    kennung: 'sued2002',
    vertrag: 'spaet',
    btm: false,
  },
] as const;

async function main() {
  mkdirSync(ORDNER, { recursive: true, mode: 0o700 });
  const s = status();
  const zugangSchluessel = schluessel();
  const db = new pg.Client({ connectionString: s.DB_URL });
  await db.connect();
  await db.query("delete from auth.users where email like '%@werkbank.test'");
  await db.query("delete from public.apotheken where name like '%(erfunden)'");

  const mandanten = [];
  const konten = [];
  for (const a of APOTHEKEN) {
    const ghPasswort = geheim();
    mandanten.push({
      kundenkennung: a.kennung,
      name: a.name,
      passwortHash: await passwortHashen(ghPasswort),
      btmErlaubnis: a.btm,
      vertrag: a.vertrag,
    });
    const kontoPasswort = geheim();
    const userId = await kontoAnlegen(s, a.email, kontoPasswort);
    konten.push({ email: a.email, passwort: kontoPasswort, apotheke: a.name, rolle: a.rolle });
    const { rows } = await db.query<{ id: string }>(
      'insert into public.apotheken (name) values ($1) returning id',
      [a.name],
    );
    const apothekeId = rows[0]?.id;
    await db.query(
      'insert into public.mitglieder (apotheke_id, user_id, rolle) values ($1, $2, $3)',
      [apothekeId, userId, a.rolle],
    );
    await db.query(
      'insert into public.grosshaendler_zugaenge (apotheke_id, bezeichnung, basis_url, kundenkennung, passwort_verschluesselt) values ($1, $2, $3, $4, $5)',
      [
        apothekeId,
        'Grosshandel-Attrappe',
        ATTRAPPE,
        a.kennung,
        verschluesseln(ghPasswort, zugangSchluessel),
      ],
    );
  }
  await db.end();

  writeFileSync(`${ORDNER}/mandanten.json`, JSON.stringify(mandanten, null, 2), { mode: 0o600 });
  writeFileSync(`${ORDNER}/konten.json`, JSON.stringify(konten, null, 2), { mode: 0o600 });
  writeFileSync(
    'web/.env.local',
    [
      `SUPABASE_URL=${s.API_URL}`,
      `SUPABASE_PUBLISHABLE_KEY=${s.PUBLISHABLE_KEY}`,
      `ZUGANG_SCHLUESSEL=${zugangSchluessel}`,
      `GROSSHANDEL_ERLAUBT=${ATTRAPPE}`,
      '',
    ].join('\n'),
    { mode: 0o600 },
  );
  console.log(
    `Eingerichtet: ${konten.length} Konten (.lokal/konten.json), Mandanten (.lokal/mandanten.json), web/.env.local.`,
  );
}

await main();

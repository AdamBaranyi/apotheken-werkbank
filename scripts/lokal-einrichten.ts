/**
 * Richtet die lokale Umgebung ein (auch in der CI): Mandanten der
 * Grosshandel-Attrappe, zwei Testkonten (dazu eines, das den Rundgang noch
 * nicht kennt, E43), zwei erfundene Apotheken, je einen
 * verschlüsselten Grosshändler-Zugang, je ein Engine-Konto für den
 * Flow-Monitor und das Passwort der Rolle für die Bremse. Passwörter entstehen bei jedem Lauf neu
 * und landen nur in .lokal/ (nie im Repo); der Schlüssel für die Zugänge
 * bleibt zwischen Läufen gleich.
 *
 * Läuft nur gegen eine lokale Supabase (127.0.0.1 oder localhost).
 * Aufruf: node scripts/lokal-einrichten.ts
 */
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import pg from 'pg';
import { passwortHashen } from '../grosshandel-attrappe/src/anmeldung.ts';
import { verschluesseln } from '../web/lib/verschluesselung.ts';
import { DEMO_APOTHEKEN, passwortErzeugen } from './demo-apotheken.ts';

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

function schluessel(): string {
  const datei = `${ORDNER}/zugang-schluessel.txt`;
  if (existsSync(datei)) return readFileSync(datei, 'utf8').trim();
  const neu = randomBytes(32).toString('base64');
  writeFileSync(datei, neu, { mode: 0o600 });
  return neu;
}

// Testkonten kennen den Rundgang schon; sonst startete er in jedem Browser-Test von selbst.
const KENNT_RUNDGANG = { rundgang_gesehen: 'einrichtung' };

async function kontoAnlegen(
  s: Status,
  email: string,
  passwort: string,
  metadaten: Record<string, string> = KENNT_RUNDGANG,
): Promise<string> {
  const antwort = await fetch(`${s.API_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: s.SECRET_KEY,
      Authorization: `Bearer ${s.SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password: passwort,
      email_confirm: true,
      user_metadata: metadaten,
    }),
  });
  if (!antwort.ok) throw new Error(`Konto ${email}: ${antwort.status} ${await antwort.text()}`);
  return ((await antwort.json()) as { id: string }).id;
}

async function main() {
  mkdirSync(ORDNER, { recursive: true, mode: 0o700 });
  const s = status();
  const zugangSchluessel = schluessel();
  const db = new pg.Client({ connectionString: s.DB_URL });
  await db.connect();
  // Passwort der Rolle für die Bremse (lib/bremse.ts), je Lauf neu.
  const bremsePasswort = passwortErzeugen();
  const { rows: befehl } = await db.query<{ sql: string }>(
    "select format('alter role werkbank_bremse password %L', $1::text) as sql",
    [bremsePasswort],
  );
  await db.query(befehl[0]?.sql ?? '');
  const bremseUrl = new URL(s.DB_URL);
  bremseUrl.username = 'werkbank_bremse';
  bremseUrl.password = bremsePasswort;
  // Zähler der Bremse leeren: Fehlversuche früherer Testläufe sperrten sonst Konten.
  await db.query('delete from privat.bremsen');
  await db.query("delete from auth.users where email like '%@werkbank.test'");
  await db.query("delete from public.apotheken where name like '%(erfunden)'");

  const mandanten = [];
  const konten = [];
  const engine = [];
  for (const a of DEMO_APOTHEKEN) {
    const ghPasswort = passwortErzeugen();
    mandanten.push({
      kundenkennung: a.kennung,
      name: a.name,
      passwortHash: await passwortHashen(ghPasswort),
      btmErlaubnis: a.btm,
      vertrag: a.vertrag,
    });
    const kontoPasswort = passwortErzeugen();
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
    // Ein Konto ohne Merker, nur für den Test des ersten Anmeldens (E43).
    if (a.kasse === 'nord') {
      const rundgangPasswort = passwortErzeugen();
      const rundgangEmail = 'rundgang.nord@werkbank.test';
      const rundgangId = await kontoAnlegen(s, rundgangEmail, rundgangPasswort, {});
      await db.query(
        'insert into public.mitglieder (apotheke_id, user_id, rolle) values ($1, $2, $3)',
        [apothekeId, rundgangId, 'mitarbeiter'],
      );
      konten.push({
        email: rundgangEmail,
        passwort: rundgangPasswort,
        apotheke: a.name,
        rolle: 'mitarbeiter',
        zweck: 'rundgang',
      });
    }
    await db.query(
      'insert into public.grosshaendler_zugaenge (apotheke_id, bezeichnung, basis_url, kundenkennung, passwort_verschluesselt) values ($1, $2, $3, $4, $5)',
      [
        apothekeId,
        'Grosshandel-Attrappe',
        ATTRAPPE,
        a.kennung,
        verschluesseln(ghPasswort, Buffer.from(zugangSchluessel, 'base64')),
      ],
    );
    // Engine-Konto: kein Mitglied, darf nur Läufe dieser Apotheke melden.
    const enginePasswort = passwortErzeugen();
    const engineEmail = `engine.${a.kasse}@werkbank.test`;
    const engineId = await kontoAnlegen(s, engineEmail, enginePasswort);
    await db.query(
      'insert into public.engine_konten (user_id, apotheke_id, bezeichnung) values ($1, $2, $3)',
      [engineId, apothekeId, 'Kasse 1'],
    );
    engine.push({
      kasse: a.kasse,
      email: engineEmail,
      passwort: enginePasswort,
      url: s.API_URL,
      schluessel: s.PUBLISHABLE_KEY,
    });
  }
  await db.end();

  writeFileSync(`${ORDNER}/mandanten.json`, JSON.stringify(mandanten, null, 2), { mode: 0o600 });
  writeFileSync(`${ORDNER}/konten.json`, JSON.stringify(konten, null, 2), { mode: 0o600 });
  writeFileSync(`${ORDNER}/engine.json`, JSON.stringify(engine, null, 2), { mode: 0o600 });
  writeFileSync(
    'web/.env.local',
    [
      `SUPABASE_URL=${s.API_URL}`,
      `SUPABASE_PUBLISHABLE_KEY=${s.PUBLISHABLE_KEY}`,
      `ZUGANG_SCHLUESSEL=${zugangSchluessel}`,
      `GROSSHANDEL_ERLAUBT=${ATTRAPPE}`,
      `BREMSE_DATENBANK_URL=${bremseUrl.toString()}`,
      '',
    ].join('\n'),
    { mode: 0o600 },
  );
  console.log(
    `Eingerichtet: ${konten.length} Konten (.lokal/konten.json), ${engine.length} Engine-Konten (.lokal/engine.json), Mandanten (.lokal/mandanten.json), web/.env.local.`,
  );
}

await main();

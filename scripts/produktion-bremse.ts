/**
 * Passwort der Rolle werkbank_bremse für die Produktion (E23). Supabase
 * bekommt nur den SCRAM-Verifier, so wie Postgres Passwörter selbst
 * speichert; der Klartext steht nur in der Adresse für Vercel
 * (BREMSE_DATENBANK_URL). Beide Dateien landen in .lokal/produktion/:
 *
 * - bremse.sql: «alter role … password 'SCRAM-SHA-256$…'» für den SQL-Editor
 * - bremse-url.txt: Adresse über den Pooler, für Vercel
 *
 * Nach einem neuen Lauf beide ausrollen; die alte Adresse gilt dann nicht mehr.
 * Aufruf: node scripts/produktion-bremse.ts
 */
import { createHash, createHmac, pbkdf2Sync, randomBytes } from 'node:crypto';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { passwortErzeugen } from './demo-apotheken.ts';

const ORDNER = '.lokal/produktion';
const PROJEKT = 'uvrmdlmpegubqeqpxjpn';
/** Pooler im Transaktionsmodus (6543): kurze Verbindungen aus Funktionen, nur IPv4 nötig. */
const POOLER = 'aws-1-eu-central-1.pooler.supabase.com';

/** SCRAM-SHA-256 nach RFC 5802/7677, im Format von Postgres (pg_authid.rolpassword). */
export function scramVerifier(passwort: string, salz = randomBytes(16), runden = 4096): string {
  const gesalzen = pbkdf2Sync(passwort, salz, runden, 32, 'sha256');
  const clientKey = createHmac('sha256', gesalzen).update('Client Key').digest();
  const storedKey = createHash('sha256').update(clientKey).digest();
  const serverKey = createHmac('sha256', gesalzen).update('Server Key').digest();
  return `SCRAM-SHA-256$${runden}:${salz.toString('base64')}$${storedKey.toString('base64')}:${serverKey.toString('base64')}`;
}

/** Ohne sslmode: TLS mit der CA von Supabase stellt lib/bremse.ts selbst ein. */
export function poolerUrl(passwort: string): string {
  return `postgresql://werkbank_bremse.${PROJEKT}:${passwort}@${POOLER}:6543/postgres`;
}

function schreiben(datei: string, inhalt: string): void {
  writeFileSync(datei, inhalt, { mode: 0o600 });
  chmodSync(datei, 0o600);
}

function main(): void {
  // 48 Zeichen aus Buchstaben und Ziffern: nichts, was in einer Adresse maskiert werden müsste.
  const passwort = passwortErzeugen() + passwortErzeugen();
  mkdirSync(ORDNER, { recursive: true, mode: 0o700 });
  schreiben(
    `${ORDNER}/bremse.sql`,
    '-- Erzeugt von scripts/produktion-bremse.ts. Nur der Verifier, kein Passwort.\n' +
      `alter role werkbank_bremse password '${scramVerifier(passwort)}';\n`,
  );
  schreiben(`${ORDNER}/bremse-url.txt`, poolerUrl(passwort));
  console.log(
    `Erzeugt: ${ORDNER}/bremse.sql (für Supabase) und ${ORDNER}/bremse-url.txt ` +
      '(für Vercel, BREMSE_DATENBANK_URL). Beide gehören zusammen; docs/BETRIEB.md.',
  );
}

if (import.meta.main) main();

import 'server-only';
import { createHmac, hkdfSync } from 'node:crypto';
import { isIP } from 'node:net';
import pg from 'pg';
import { SUPABASE_ROOT_CA } from '@/lib/supabase-ca';
import { umgebung } from '@/lib/umgebung';

/**
 * Bremse gegen zu viele Versuche (E23). Die Zähler liegen in der Datenbank,
 * damit alle Funktionen auf Vercel dieselbe Grenze sehen. Erreicht wird sie
 * über die eigene Rolle werkbank_bremse und den Pooler von Supabase, nicht
 * über die REST-Schnittstelle: Vor der Anmeldung gibt es keine Sitzung.
 *
 * In der Datenbank stehen nur HMAC-Werte, nie E-Mail oder IP. Antwortet die
 * Datenbank nicht, lässt die Bremse durch und schreibt es ins Protokoll:
 * Ein Ausfall soll die Apotheke nicht aussperren; Supabase begrenzt
 * Anmeldungen zusätzlich selbst.
 */
export type BremsenArt = 'konto' | 'konto-ip' | 'ip' | 'grosshandel';

export interface BremsenEintrag {
  schluessel: string;
  grenze: number;
}

let hmacSchluessel: Buffer | undefined;

/** Eigener Schlüssel für die Bremse, abgeleitet (HKDF) aus dem Schlüssel des Servers. */
function hmac(wert: string): string {
  hmacSchluessel ??= Buffer.from(
    hkdfSync(
      'sha256',
      Buffer.from(umgebung().ZUGANG_SCHLUESSEL, 'base64'),
      Buffer.alloc(0),
      'apotheken-werkbank/bremse',
      32,
    ),
  );
  return createHmac('sha256', hmacSchluessel).update(wert).digest('hex');
}

export function bremseSchluessel(art: BremsenArt, wert: string): string {
  return `${art}:${hmac(`${art}:${wert.trim().toLowerCase()}`)}`;
}

/**
 * Die IP der anfragenden Person, aber nur auf Vercel: Dort setzt der Rand
 * x-real-ip selbst und überschreibt, was der Browser schickt. Anderswo
 * (lokal, CI) könnte jeder die Kopfzeile fälschen – dann zählt nur das Konto.
 */
export function vertrauteIp(
  kopf: Headers,
  env: Record<string, string | undefined> = process.env,
): string | null {
  if (env.VERCEL !== '1') return null;
  const ip = kopf.get('x-real-ip')?.trim() ?? '';
  return isIP(ip) ? ip : null;
}

function tls(url: string): false | { ca: string; rejectUnauthorized: true } {
  const host = new URL(url).hostname;
  if (host === '127.0.0.1' || host === 'localhost') return false;
  return { ca: SUPABASE_ROOT_CA, rejectUnauthorized: true };
}

async function mitDatenbank<T>(arbeit: (c: pg.Client) => Promise<T>, ersatz: T): Promise<T> {
  const url = umgebung().BREMSE_DATENBANK_URL;
  if (!url) return ersatz;
  const client = new pg.Client({
    connectionString: url,
    ssl: tls(url),
    connectionTimeoutMillis: 3000,
    query_timeout: 3000,
  });
  try {
    await client.connect();
    return await arbeit(client);
  } catch (fehler) {
    const f = fehler as { code?: string; name?: string };
    console.error('Bremse nicht erreichbar, lasse durch', f.code ?? f.name);
    return ersatz;
  } finally {
    await client.end().catch(() => undefined);
  }
}

/** Frei, solange jeder Schlüssel im Fenster unter seiner Grenze liegt. Zählt nicht. */
export function bremseFrei(eintraege: BremsenEintrag[], fensterSekunden: number): Promise<boolean> {
  return mitDatenbank(async (c) => {
    const { rows } = await c.query<{ frei: boolean }>(
      'select privat.bremse_frei($1, $2, $3) as frei',
      [eintraege.map((e) => e.schluessel), eintraege.map((e) => e.grenze), fensterSekunden],
    );
    return rows[0]?.frei ?? true;
  }, true);
}

/** Zählt einen Versuch je Schlüssel, etwa nach einer gescheiterten Anmeldung. */
export function bremseZaehlen(schluessel: string[]): Promise<void> {
  return mitDatenbank(async (c) => {
    await c.query('select privat.bremse_zaehlen($1)', [schluessel]);
  }, undefined);
}

/**
 * Aufrufe beim Grosshändler je Apotheke: höchstens 60 je Minute. Ein Skript
 * in einer Schleife soll nicht dazu führen, dass der Grosshändler den Zugang
 * der Apotheke sperrt. Prüft und zählt in einer Verbindung.
 */
export function grosshandelBremse(apothekeId: string): Promise<string | null> {
  const schluessel = bremseSchluessel('grosshandel', apothekeId);
  return mitDatenbank(async (c) => {
    const { rows } = await c.query<{ frei: boolean }>(
      'select privat.bremse_frei($1, $2, 60) as frei',
      [[schluessel], [60]],
    );
    if (rows[0]?.frei === false)
      return 'Zu viele Anfragen an den Grosshändler. Bitte in einer Minute erneut.';
    await c.query('select privat.bremse_zaehlen($1)', [[schluessel]]);
    return null;
  }, null);
}

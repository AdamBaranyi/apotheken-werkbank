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
 * Prüfen und Zählen geschehen in einem Aufruf unter einer Sperre je
 * Schlüssel; so kommen auch gleichzeitige Versuche nicht über die Grenze. In
 * der Datenbank stehen nur HMAC-Werte, nie E-Mail oder IP. Antwortet die
 * Datenbank nicht, meldet die Bremse «gestört»; was dann gilt, entscheidet der
 * Aufrufer: Die Anmeldung sperrt, der Aufruf beim Grosshändler läuft weiter.
 */
export type BremsenArt = 'konto' | 'konto-ip' | 'ip' | 'grosshandel';

export interface BremsenEintrag {
  schluessel: string;
  grenze: number;
}

/** «aus»: keine Adresse eingerichtet (lokal ohne Einrichtung, Vorschau). */
export type BremsenStand =
  | { stand: 'frei'; ids: string[] }
  | { stand: 'gebremst' }
  | { stand: 'aus' }
  | { stand: 'gestoert' };

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

/**
 * Eine Verbindung je Aufruf. Auf Vercel ruht eine Instanz zwischen Anfragen;
 * eine gemerkte Verbindung wäre danach oft tot, und eine tote Verbindung hiesse
 * bei der Anmeldung «gestört».
 */
async function mitVerbindung<T>(url: string, arbeit: (c: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({
    connectionString: url,
    ssl: tls(url),
    connectionTimeoutMillis: 3000,
    query_timeout: 3000,
  });
  // Ein Abriss der Verbindung darf den Server nicht beenden; die Anfrage scheitert ohnehin.
  client.on('error', () => undefined);
  try {
    await client.connect();
    return await arbeit(client);
  } finally {
    await client.end().catch(() => undefined);
  }
}

function protokoll(fehler: unknown): void {
  const f = fehler as { code?: string; name?: string };
  console.error('Bremse nicht erreichbar', f.code ?? f.name);
}

/**
 * Prüft und zählt einen Versuch je Schlüssel. «frei» trägt die Nummern der
 * Einträge; ein gelungener Versuch gibt sie mit bremseFreigeben zurück.
 */
export async function bremseVersuch(
  eintraege: BremsenEintrag[],
  fensterSekunden: number,
): Promise<BremsenStand> {
  const url = umgebung().BREMSE_DATENBANK_URL;
  if (!url) return { stand: 'aus' };
  try {
    const { rows } = await mitVerbindung(url, (c) =>
      c.query<{ ids: string[] | null }>('select privat.bremse_versuchen($1, $2, $3) as ids', [
        eintraege.map((e) => e.schluessel),
        eintraege.map((e) => e.grenze),
        fensterSekunden,
      ]),
    );
    const ids = rows[0]?.ids;
    return ids ? { stand: 'frei', ids } : { stand: 'gebremst' };
  } catch (fehler) {
    protokoll(fehler);
    return { stand: 'gestoert' };
  }
}

/** Ein gelungener Versuch zählt nicht mehr. Scheitert das, zählt er bis zum Ende des Fensters. */
export async function bremseFreigeben(ids: string[]): Promise<void> {
  const url = umgebung().BREMSE_DATENBANK_URL;
  if (!url || ids.length === 0) return;
  try {
    await mitVerbindung(url, (c) => c.query('select privat.bremse_freigeben($1::bigint[])', [ids]));
  } catch (fehler) {
    protokoll(fehler);
  }
}

/**
 * Aufrufe beim Grosshändler je Apotheke: höchstens 60 je Minute. Ein Skript
 * in einer Schleife soll nicht dazu führen, dass der Grosshändler den Zugang
 * der Apotheke sperrt. Bei gestörter Bremse geht Bestellen vor.
 */
export async function grosshandelBremse(apothekeId: string): Promise<string | null> {
  const versuch = await bremseVersuch(
    [{ schluessel: bremseSchluessel('grosshandel', apothekeId), grenze: 60 }],
    60,
  );
  return versuch.stand === 'gebremst'
    ? 'Zu viele Anfragen an den Grosshändler. Bitte in einer Minute erneut.'
    : null;
}

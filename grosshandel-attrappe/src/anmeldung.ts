import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { Mandant } from './fachlich/mandanten.ts';

/**
 * Anmeldung nach Pflichtenheft Kap. 2.3.3: HTTP Basic über HTTPS,
 * Benutzer = Kundenkennung (optional «Niederlassung\Kennung»), Passwort mit
 * 8 bis 80 Zeichen aus a–z, A–Z, 0–9. Gespeichert wird nur ein scrypt-Hash.
 * Unbekannte Kennungen werden gegen einen Schein-Hash geprüft, damit die
 * Antwortzeit nicht verrät, welche Kennungen es gibt.
 */
const N = 16384;
const R = 8;
const P = 1;
const LAENGE = 32;

function ableiten(passwort: string, salz: Buffer, n = N, r = R, p = P): Promise<Buffer> {
  return new Promise((ok, fehler) => {
    scrypt(passwort, salz, LAENGE, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (err, schluessel) =>
      err ? fehler(err) : ok(schluessel),
    );
  });
}

export async function passwortHashen(passwort: string): Promise<string> {
  const salz = randomBytes(16);
  const hash = await ableiten(passwort, salz);
  return `scrypt:${N}:${R}:${P}:${salz.toString('base64')}:${hash.toString('base64')}`;
}

export async function passwortPruefen(passwort: string, gespeichert: string): Promise<boolean> {
  const [art, n, r, p, salz, hash] = gespeichert.split(':');
  const zahlen = [n, r, p].map(Number);
  if (art !== 'scrypt' || !salz || !hash || !zahlen.every((z) => Number.isInteger(z) && z > 0)) {
    return false;
  }
  const [kosten = N, block = R, parallel = P] = zahlen;
  const erwartet = Buffer.from(hash, 'base64');
  const berechnet = await ableiten(passwort, Buffer.from(salz, 'base64'), kosten, block, parallel);
  return erwartet.length === berechnet.length && timingSafeEqual(erwartet, berechnet);
}

export interface Zugangsdaten {
  kundenkennung: string;
  niederlassung?: string;
  passwort: string;
}

/** Liest «Authorization: Basic …». Alles, was nicht dem Pflichtenheft entspricht, ist null. */
export function basicLesen(kopf: string | undefined): Zugangsdaten | null {
  const treffer = /^Basic ([A-Za-z0-9+/=]{1,400})$/.exec(kopf ?? '');
  if (!treffer?.[1]) return null;
  const klar = Buffer.from(treffer[1], 'base64').toString('utf8');
  const trenner = klar.indexOf(':');
  if (trenner < 0) return null;
  const benutzer = klar.slice(0, trenner);
  const passwort = klar.slice(trenner + 1);
  const teile = /^(?:([A-Za-z0-9]{1,80})\\)?([A-Za-z0-9]{1,80})$/.exec(benutzer);
  if (!teile?.[2] || !/^[A-Za-z0-9]{8,80}$/.test(passwort)) return null;
  return {
    kundenkennung: teile[2],
    passwort,
    ...(teile[1] ? { niederlassung: teile[1] } : {}),
  };
}

export class Anmeldung {
  readonly #mandanten: Map<string, Mandant>;
  #scheinHash: Promise<string>;

  constructor(mandanten: readonly Mandant[]) {
    this.#mandanten = new Map(mandanten.map((m) => [m.kundenkennung, m]));
    this.#scheinHash = passwortHashen(randomBytes(24).toString('base64url'));
  }

  /** Der Mandant zu gültigen Zugangsdaten, sonst null – immer mit einer scrypt-Rechnung. */
  async pruefen(zugang: Zugangsdaten | null): Promise<Mandant | null> {
    const mandant = zugang ? this.#mandanten.get(zugang.kundenkennung) : undefined;
    const hash = mandant?.passwortHash ?? (await this.#scheinHash);
    const passt = await passwortPruefen(zugang?.passwort ?? 'ungueltig0', hash);
    return mandant && passt ? mandant : null;
  }
}

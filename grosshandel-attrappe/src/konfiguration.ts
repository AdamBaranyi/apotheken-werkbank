import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { ortszeit } from './fachlich/berlin.ts';
import { mandantenLesen, type Mandant } from './fachlich/mandanten.ts';

/**
 * Konfiguration nur aus der Umgebung. Pflicht ist MANDANTEN_DATEI: eine
 * JSON-Datei ausserhalb des Repos mit den Mandanten und ihren scrypt-Hashes
 * (anlegen mit `bun run mandant:anlegen`). Fehlt sie, startet der Dienst
 * nicht – eine stille Vorgabe wäre ein Zugang mit bekanntem Passwort.
 */
const umgebungSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3501),
  HOST: z.string().default('127.0.0.1'),
  MANDANTEN_DATEI: z.string().min(1),
  /** «nie», «immer» oder ein Zeitraum «HH:MM-HH:MM» in Berliner Ortszeit. */
  NACHTBETRIEB: z
    .string()
    .regex(/^(nie|immer|\d{2}:\d{2}-\d{2}:\d{2})$/)
    .default('02:00-03:00'),
  PROXY_VERTRAUEN: z.enum(['0', '1']).default('0'),
});

export interface Konfiguration {
  port: number;
  host: string;
  mandanten: Mandant[];
  nachtbetrieb: (jetzt: Date) => boolean;
  proxyVertrauen: boolean;
}

export function nachtbetriebRegel(regel: string): (jetzt: Date) => boolean {
  if (regel === 'nie') return () => false;
  if (regel === 'immer') return () => true;
  const [von = 0, bis = 0] = regel.split('-').map((t) => {
    const [h, m] = t.split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  });
  return (jetzt) => {
    const o = ortszeit(jetzt);
    const minute = o.stunde * 60 + o.minute;
    return von <= bis ? minute >= von && minute < bis : minute >= von || minute < bis;
  };
}

export function konfigurationLesen(umgebung: NodeJS.ProcessEnv = process.env): Konfiguration {
  const u = umgebungSchema.parse(umgebung);
  const mandanten = mandantenLesen(JSON.parse(readFileSync(u.MANDANTEN_DATEI, 'utf8')));
  return {
    port: u.PORT,
    host: u.HOST,
    mandanten,
    nachtbetrieb: nachtbetriebRegel(u.NACHTBETRIEB),
    proxyVertrauen: u.PROXY_VERTRAUEN === '1',
  };
}

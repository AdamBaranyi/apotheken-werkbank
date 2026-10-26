import 'server-only';
import { z } from 'zod';

/**
 * Umgebung des Servers, einmal geprüft. Nichts davon gelangt in den Browser:
 * Der Browser spricht nur mit dieser App, nie direkt mit Supabase oder dem
 * Grosshändler.
 */
const schema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().startsWith('sb_publishable_'),
  /** 32 Byte als Base64, für die Passwörter der Grosshändler-Zugänge (AES-256-GCM). */
  ZUGANG_SCHLUESSEL: z
    .string()
    .refine((s) => Buffer.from(s, 'base64').length === 32, '32 Byte als Base64 erwartet'),
  /** Kommagetrennte Basisadressen, die der Server aufrufen darf (Schutz vor SSRF). */
  GROSSHANDEL_ERLAUBT: z.string().min(1),
});

export type Umgebung = z.infer<typeof schema> & { grosshandelErlaubt: string[] };

let geprueft: Umgebung | undefined;

export function umgebung(): Umgebung {
  if (!geprueft) {
    const roh = schema.parse(process.env);
    geprueft = {
      ...roh,
      grosshandelErlaubt: roh.GROSSHANDEL_ERLAUBT.split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };
  }
  return geprueft;
}

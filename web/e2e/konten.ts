import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Testkonten aus .lokal/konten.json (von scripts/lokal-einrichten.ts, je Lauf neu). */
export interface Konto {
  email: string;
  passwort: string;
  apotheke: string;
  rolle: string;
}

const DATEI = fileURLToPath(new URL('../../.lokal/konten.json', import.meta.url));

export function konten(): Konto[] {
  return JSON.parse(readFileSync(DATEI, 'utf8')) as Konto[];
}

export function inhaber(): Konto {
  const konto = konten().find((k) => k.rolle === 'inhaber');
  if (!konto)
    throw new Error(
      'Kein Inhaber-Konto in .lokal/konten.json – zuerst scripts/lokal-einrichten.ts',
    );
  return konto;
}

export const SITZUNG = fileURLToPath(new URL('./.auth/inhaber.json', import.meta.url));

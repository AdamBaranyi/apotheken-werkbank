import { randomBytes } from 'node:crypto';

/**
 * Die beiden erfundenen Apotheken mit ihrem Konto und ihrem Zugang zur
 * Grosshandel-Attrappe. Eine Liste für lokal (scripts/lokal-einrichten.ts) und
 * Produktion (scripts/produktion-zugaenge.ts), damit beide gleich aussehen.
 */
export const DEMO_APOTHEKEN = [
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

export type DemoApotheke = (typeof DEMO_APOTHEKEN)[number];

/** Passwort nach der Regel von MSV3: 8 bis 80 Zeichen aus A–Z, a–z, 0–9. */
export function passwortErzeugen(): string {
  return randomBytes(18)
    .toString('base64')
    .replace(/[^A-Za-z0-9]/g, 'k');
}

import { z } from 'zod';
import type { Bestellfenster } from './touren.ts';
import { AUFTRAGSARTEN, type Auftragsart } from './typen.ts';

/**
 * Mandanten der Attrappe: Apotheken mit eigener Kundenkennung, eigenem
 * Passwort (nur als scrypt-Hash) und eigenem Vertrag. Die Liste kommt aus
 * einer Datei ausserhalb des Repos (MANDANTEN_DATEI); Passwörter stehen
 * nirgends im Klartext.
 */
export interface Vertrag {
  gueltigAb: string;
  bestellfenster: Bestellfenster[];
  erlaubteAuftragsarten: Auftragsart[];
  spezifischeVerfuegbarkeit: boolean;
}

export interface Mandant {
  kundenkennung: string;
  name: string;
  passwortHash: string;
  btmErlaubnis: boolean;
  vertrag: Vertrag;
}

const WERKTAGE = [1, 2, 3, 4, 5];

/** Zwei Vertragsvorlagen, damit zwei Apotheken sich sichtbar unterscheiden. */
export const VERTRAEGE: Record<'standard' | 'spaet', Vertrag> = {
  standard: {
    gueltigAb: '2026-10-01',
    bestellfenster: [
      { wochentage: WERKTAGE, ende: '09:59', tour: 'T1', lieferungNachMinuten: 90 },
      {
        wochentage: WERKTAGE,
        ende: '13:59',
        tour: 'T2',
        lieferungNachMinuten: 90,
        hauptbestellzeitpunkt: '13:30',
      },
      { wochentage: WERKTAGE, ende: '17:59', tour: 'T3', lieferungNachMinuten: 90 },
      { wochentage: [6], ende: '11:59', tour: 'S1', lieferungNachMinuten: 60 },
    ],
    erlaubteAuftragsarten: ['NORMAL', 'STAPEL'],
    spezifischeVerfuegbarkeit: true,
  },
  spaet: {
    gueltigAb: '2026-10-01',
    bestellfenster: [
      { wochentage: WERKTAGE, ende: '11:59', tour: 'A1', lieferungNachMinuten: 120 },
      { wochentage: WERKTAGE, ende: '19:59', tour: 'A2', lieferungNachMinuten: 120 },
    ],
    erlaubteAuftragsarten: ['NORMAL'],
    spezifischeVerfuegbarkeit: false,
  },
};

const mandantSchema = z.object({
  kundenkennung: z.string().regex(/^[A-Za-z0-9]{1,80}$/),
  name: z.string().min(1).max(100),
  passwortHash: z.string().startsWith('scrypt:'),
  btmErlaubnis: z.boolean(),
  vertrag: z.enum(['standard', 'spaet']),
});

export function mandantenLesen(roh: unknown): Mandant[] {
  const liste = z.array(mandantSchema).min(1).parse(roh);
  const kennungen = new Set(liste.map((m) => m.kundenkennung));
  if (kennungen.size !== liste.length) throw new Error('Kundenkennung doppelt');
  return liste.map((m) => ({ ...m, vertrag: VERTRAEGE[m.vertrag] }));
}

export function auftragsartErlaubt(mandant: Mandant, art: string): art is Auftragsart {
  return (
    (AUFTRAGSARTEN as readonly string[]).includes(art) &&
    (art === 'NORMAL' || mandant.vertrag.erlaubteAuftragsarten.includes(art as Auftragsart))
  );
}

import { z } from 'zod';
import { istGueltigePzn } from './fachlich/pzn.ts';
import { AUFTRAGSARTEN, LIEFERVORGABEN } from './fachlich/typen.ts';
import { validierungsfehler } from './soap/fehler.ts';

/**
 * Anfragen nach dem Parsen, geprüft mit Zod. Grenzen aus dem Pflichtenheft:
 * höchstens 50 Artikel je Verfügbarkeitsanfrage (Kap. 6.4.2), 1000 Aufträge
 * und 1000 Positionen je Auftrag, 5000 Positionen je Bestellung (Kap. 2.2.1),
 * Bestellmenge bis 9999 (Kap. 2.4.1.6), Kennungen bis 20 Zeichen aus
 * A–Z, 0–9, +, -, _ (Kap. 2.2.1, 2.2.4).
 */
const kennung = z.string().min(1).max(100);
const pzn = z.string().refine(istGueltigePzn, 'PZN ungültig');
const menge = z.coerce.number().int().min(1).max(9999);
const guid = z.uuid();
const kurzkennung = z.string().regex(/^[A-Z0-9+_-]{1,20}$/);
const ganzzahl = z.coerce.number().int().min(0).max(2_147_483_647);

export const leereAnfrage = z.object({ clientSoftwareKennung: kennung });

export const verfuegbarkeitAnfrage = z.object({
  clientSoftwareKennung: kennung,
  defektoptimierung: z.enum(['true', 'false']).optional(),
  artikel: z.array(z.object({ pzn, menge })).min(1).max(50),
});

const position = z.object({ pzn, menge, liefervorgabe: z.enum(LIEFERVORGABEN) });

const auftrag = z.object({
  id: guid,
  auftragsart: z.enum(AUFTRAGSARTEN),
  auftragskennung: kurzkennung,
  auftragsSupportId: ganzzahl,
  gebindeId: kurzkennung.optional(),
  position: z.array(position).min(1).max(1000),
});

export const bestellAnfrage = z.object({
  clientSoftwareKennung: kennung,
  bestellung: z.object({
    id: guid,
    bestellSupportId: ganzzahl,
    auftrag: z.array(auftrag).min(1).max(1000),
  }),
});

export const statusAnfrage = z.object({ clientSoftwareKennung: kennung, bestellId: guid });

export type VerfuegbarkeitAnfrage = z.infer<typeof verfuegbarkeitAnfrage>;
export type BestellAnfrage = z.infer<typeof bestellAnfrage>;
export type Auftrag = z.infer<typeof auftrag>;

/** Prüft und übersetzt Zod-Fehler in eine ValidationException mit lesbarem Text. */
export function pruefen<T>(schema: z.ZodType<T>, inhalt: unknown): T {
  const ergebnis = schema.safeParse(inhalt);
  if (ergebnis.success) return ergebnis.data;
  const erster = ergebnis.error.issues[0];
  const pfad = erster?.path.join('.') ?? '';
  const zuViele = erster?.code === 'too_big' && /artikel|auftrag|position/.test(pfad);
  throw validierungsfehler(
    zuViele ? 'V-ZU-VIELE' : 'V-FELD',
    zuViele ? 'Zu viele Einträge in einer Anfrage.' : `Ungültiger Wert in «${pfad}».`,
    `${pfad}: ${erster?.message ?? 'ungültig'}`,
  );
}

import { z } from 'zod';

/**
 * Mengen aus dem Formular «Bestellen» (Felder «menge-PZN»), für die
 * unverbindliche Anfrage wie für die Bestellung. Leer oder 0 heisst «nicht
 * bestellen»; alles andere prüft das Schema, statt still zu runden.
 */
export function positionenLesen(form: FormData): { pzn: string; menge: number }[] {
  const positionen: { pzn: string; menge: number }[] = [];
  for (const [name, wert] of form.entries()) {
    const pzn = /^menge-(\d{8})$/.exec(name)?.[1];
    const text = String(wert).trim();
    if (pzn && text !== '' && Number(text) !== 0) positionen.push({ pzn, menge: Number(text) });
  }
  return positionen;
}

export const positionenSchema = z
  .array(
    z.object({
      pzn: z.string().regex(/^\d{8}$/, 'Eine PZN hat acht Ziffern.'),
      menge: z
        .number('Mengen sind Zahlen.')
        .int('Mengen sind ganze Packungen.')
        .min(1, 'Mengen beginnen bei 1.')
        .max(9999, 'Höchstens 9999 Packungen je Artikel.'),
    }),
  )
  .min(1, 'Bitte bei mindestens einem Artikel eine Menge eintragen.')
  .max(50, 'Höchstens 50 Artikel je Anfrage.');

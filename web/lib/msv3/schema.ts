import { z } from 'zod';

/**
 * Antworten des Grosshändlers, geprüft wie jede fremde Eingabe. Werte kommen
 * als Text aus dem XML; Zahlen und Wahrheitswerte werden hier umgewandelt.
 */
const zahl = z.coerce.number().int().min(0);
const wahr = z.enum(['true', 'false']).transform((w) => w === 'true');

export const ANTEIL_TYPEN = [
  'Normal',
  'Verbund',
  'Nachlieferung',
  'Dispo',
  'NichtLieferbar',
  'KeineLieferungAberNormalMoeglich',
  'KeineLieferungAberVerbundMoeglich',
  'KeineLieferungAberNachlieferungMoeglich',
  'KeineLieferungAberDispoMoeglich',
] as const;

export const anteilSchema = z.object({
  typ: z.enum(ANTEIL_TYPEN),
  menge: zahl.optional(),
  lieferzeitpunkt: z.string().optional(),
  tour: z.string().optional(),
  tourId: z.string().optional(),
  defektgrund: z.string().optional(),
});
export type Anteil = z.infer<typeof anteilSchema>;

export const verfuegbarkeitSchema = z.object({
  rTyp: z.enum(['Spezifisch', 'Unspezifisch']),
  artikel: z
    .array(z.object({ pzn: z.string(), menge: zahl, anteil: z.array(anteilSchema).min(1) }))
    .default([]),
});
export type Verfuegbarkeit = z.infer<typeof verfuegbarkeitSchema>;

export const vertragsdatenSchema = z.object({
  vertragsdaten: z.object({
    gueltigAb: z.string(),
    kundenkennung: z.string(),
    bestellfenster: z
      .array(
        z.object({
          wochentag: z.enum(['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']),
          ende: z.string().regex(/^\d{2}:\d{2}$/),
          tour: z.string(),
          hauptbestellzeitpunkt: z.string().optional(),
        }),
      )
      .default([]),
    erlaubteAuftragsart: z.array(z.string()).default([]),
    verfuegbarkeitEinzelnSpezifisch: wahr,
  }),
});
export type Vertragsdaten = z.infer<typeof vertragsdatenSchema>['vertragsdaten'];

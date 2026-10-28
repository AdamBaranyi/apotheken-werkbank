import 'server-only';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * Tagesabschlüsse lesen. Die Steuern liegen als JSON in der Datenbank; wie
 * jede Eingabe von aussen prüft sie Zod, bevor die Seite sie zeigt.
 */
const steuerSchema = z.array(
  z.object({
    satz_promille: z.number().int(),
    brutto_cent: z.number().int(),
    steuer_cent: z.number().int(),
    netto_cent: z.number().int(),
  }),
);

export const abschlussSchema = z.object({
  id: z.uuid(),
  nummer: z.number().int(),
  von_beleg: z.number().int(),
  bis_beleg: z.number().int(),
  anzahl_belege: z.number().int(),
  umsatz_cent: z.number().int(),
  bar_cent: z.number().int(),
  karte_cent: z.number().int(),
  stornos: z.number().int(),
  storno_cent: z.number().int(),
  steuern: steuerSchema,
  waehrung: z.enum(['EUR', 'CHF']),
  erstellt_am: z.string(),
});
export type Abschluss = z.infer<typeof abschlussSchema>;

const SPALTEN =
  'id, nummer, von_beleg, bis_beleg, anzahl_belege, umsatz_cent, bar_cent, karte_cent, stornos, storno_cent, steuern, waehrung, erstellt_am';

export async function abschluesseLaden(apothekeId: string): Promise<Abschluss[]> {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from('tagesabschluesse')
    .select(SPALTEN)
    .eq('apotheke_id', apothekeId)
    .order('nummer', { ascending: false })
    .limit(30);
  return z.array(abschlussSchema).parse(data ?? []);
}

export async function abschlussLaden(id: string): Promise<Abschluss | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from('tagesabschluesse')
    .select(SPALTEN)
    .eq('id', id)
    .maybeSingle();
  return data ? abschlussSchema.parse(data) : null;
}

export interface Offen {
  anzahl: number;
  umsatz_cent: number;
  bar_cent: number;
  karte_cent: number;
  waehrung: 'EUR' | 'CHF';
}

/** Was der nächste Abschluss enthielte: alle Belege nach dem letzten Abschluss. */
export async function offenLaden(apothekeId: string, letzterBeleg: number): Promise<Offen> {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from('belege')
    .select('zahlart, summe_cent, waehrung')
    .eq('apotheke_id', apothekeId)
    .gt('belegnummer', letzterBeleg)
    .limit(5000);
  const belege = (data ?? []) as { zahlart: string; summe_cent: number; waehrung: string }[];
  const summe = (art?: string) =>
    belege.filter((b) => !art || b.zahlart === art).reduce((s, b) => s + b.summe_cent, 0);
  return {
    anzahl: belege.length,
    umsatz_cent: summe(),
    bar_cent: summe('bar'),
    karte_cent: summe('karte'),
    waehrung: belege[0]?.waehrung === 'CHF' ? 'CHF' : 'EUR',
  };
}

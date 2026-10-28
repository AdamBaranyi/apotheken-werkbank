import 'server-only';
import { cache } from 'react';
import { z } from 'zod';
import { anteilSchema } from '@/lib/msv3/schema';
import { supabaseServer } from '@/lib/supabase/server';
import type { Bestellstatus, GespeicherteAntwort } from './status';

/**
 * Bestellungen lesen. Status und Antwort darf jedes Mitglied der Apotheke
 * schreiben (sie sind eine Kopie der Antwort des Grosshändlers); darum prüft
 * Zod das JSON, bevor die Seite es zeigt.
 */
const antwortSchema = z.object({
  nachtbetrieb: z.boolean(),
  positionen: z.array(
    z.object({ pzn: z.string(), menge: z.number().int(), anteile: z.array(anteilSchema) }),
  ),
});

const STATUS = [
  'wird_gesendet',
  'bestaetigt',
  'abgelehnt',
  'unklar',
  'nicht_angekommen',
  'ohne_antwort',
] as const satisfies readonly Bestellstatus[];

const zeileSchema = z.object({
  id: z.uuid(),
  support_id: z.number().int(),
  status: z.enum(STATUS),
  meldung: z.string().nullable(),
  antwort: antwortSchema.nullable().catch(null),
  erstellt_am: z.string(),
  aktualisiert_am: z.string().nullable(),
  zugang_id: z.uuid(),
  grosshaendler_zugaenge: z.object({ bezeichnung: z.string() }).nullable(),
  bestellpositionen: z.array(
    z.object({
      pzn: z.string(),
      menge: z.number().int(),
      artikel: z.object({ name: z.string(), packung: z.string() }).nullable(),
    }),
  ),
});

export type Bestellung = z.infer<typeof zeileSchema> & { antwort: GespeicherteAntwort | null };

const SPALTEN =
  'id, support_id, status, meldung, antwort, erstellt_am, aktualisiert_am, zugang_id, grosshaendler_zugaenge ( bezeichnung ), bestellpositionen ( pzn, menge, artikel ( name, packung ) )';

export const bestellungLaden = cache(async (id: string): Promise<Bestellung | null> => {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await supabaseServer();
  const { data } = await supabase.from('bestellungen').select(SPALTEN).eq('id', id).maybeSingle();
  return data ? zeileSchema.parse(data) : null;
});

export async function bestellungenLaden(apothekeId: string): Promise<Bestellung[]> {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from('bestellungen')
    .select(SPALTEN)
    .eq('apotheke_id', apothekeId)
    .order('support_id', { ascending: false })
    .limit(50);
  return z.array(zeileSchema).parse(data ?? []);
}

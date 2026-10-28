import 'server-only';
import { cache } from 'react';
import { z } from 'zod';
import { istWaehrung } from '@/lib/geld';
import { supabaseServer } from '@/lib/supabase/server';
import type { BelegDaten, BelegPosition, BelegSteuer, BelegVerweis } from './beleg-daten';

interface Kopf {
  id: string;
  apotheke_id: string;
  belegnummer: number;
  land: string;
  waehrung: string;
  zahlart: 'bar' | 'karte';
  gegeben_cent: number | null;
  summe_cent: number;
  rueckgeld_cent: number | null;
  erstellt_am: string;
  storno_von: string | null;
  storniert_durch: string | null;
}

/**
 * Lädt einen Beleg mit der Sitzung der angemeldeten Person. Welche Belege sie
 * sieht, entscheidet die Datenbank (RLS); ein fremder Beleg ist «nicht da».
 * Je Anfrage einmal: Titel und Seite teilen das Ergebnis.
 */
export const belegLaden = cache(async (id: string): Promise<BelegDaten | null> => {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await supabaseServer();
  const { data: kopf } = await supabase
    .from('belege')
    .select(
      'id, apotheke_id, belegnummer, land, waehrung, zahlart, gegeben_cent, summe_cent, rueckgeld_cent, erstellt_am, storno_von, storniert_durch',
    )
    .eq('id', id)
    .maybeSingle<Kopf>();
  if (!kopf || !istWaehrung(kopf.waehrung)) return null;

  const verweise = [kopf.storno_von, kopf.storniert_durch].filter((x): x is string => x !== null);
  const [positionen, steuern, apotheke, bezuege] = await Promise.all([
    supabase
      .from('verkaufspositionen')
      .select(
        'nr, pzn, name, packung, menge, einzelpreis_cent, satz_promille, rezeptpflichtig, rezept_vorgelegt',
      )
      .eq('verkauf_id', id)
      .order('nr'),
    supabase
      .from('beleg_steuern')
      .select('satz_promille, brutto_cent, steuer_cent')
      .eq('verkauf_id', id)
      .order('satz_promille', { ascending: false }),
    supabase
      .from('apotheken')
      .select('name')
      .eq('id', kopf.apotheke_id)
      .maybeSingle<{ name: string }>(),
    verweise.length > 0
      ? supabase.from('verkaeufe').select('id, belegnummer').in('id', verweise)
      : Promise.resolve({ data: [] }),
  ]);
  const gefunden = (bezuege.data ?? []) as BelegVerweis[];
  const verweis = (wer: string | null) => gefunden.find((b) => b.id === wer) ?? null;
  return {
    ...kopf,
    waehrung: kopf.waehrung,
    apotheke: apotheke.data?.name ?? '',
    storno_von: verweis(kopf.storno_von),
    storniert_durch: verweis(kopf.storniert_durch),
    positionen: (positionen.data ?? []) as BelegPosition[],
    steuern: (steuern.data ?? []) as BelegSteuer[],
  };
});

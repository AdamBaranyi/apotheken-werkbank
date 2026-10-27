'use server';

import { redirect } from 'next/navigation';
import { arbeitsplatzLaden } from '@/lib/apotheke';
import { meldungAusFehler } from '@/lib/fehler';
import { supabaseServer } from '@/lib/supabase/server';

export interface AbschlussStand {
  fehler?: string;
}

/**
 * Schliesst den Tag ab. Geschickt wird nur die Apotheke aus der Sitzung;
 * Nummer, Belegbereich und Summen rechnet die Datenbank, und ein Verkauf, der
 * gerade bucht, landet sicher in diesem oder im nächsten Abschluss.
 */
export async function tagAbschliessen(_vorher: AbschlussStand): Promise<AbschlussStand> {
  const platz = await arbeitsplatzLaden();
  if (!platz) return { fehler: 'Dieses Konto gehört zu keiner Apotheke.' };
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from('tagesabschluesse')
    .insert({ apotheke_id: platz.apotheke.id })
    .select('id')
    .single<{ id: string }>();
  if (error || !data) {
    return { fehler: meldungAusFehler(error ?? {}, 'Der Abschluss wurde nicht gebucht.') };
  }
  redirect(`/kasse/abschluss/${data.id}`);
}

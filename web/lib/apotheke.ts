import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { sitzungLesen, supabaseServer } from '@/lib/supabase/server';

export interface Arbeitsplatz {
  userId: string;
  email: string;
  apotheke: { id: string; name: string; land: string };
  rolle: 'inhaber' | 'mitarbeiter';
}

/**
 * Wer angemeldet ist und für welche Apotheke. Ohne Sitzung zur Anmeldung,
 * ohne Mitgliedschaft eine klare Meldung statt einer leeren Seite. Jede Seite
 * ruft das selbst auf – das Layout allein ist keine Sperre.
 */
export const arbeitsplatzLaden = cache(async (): Promise<Arbeitsplatz | null> => {
  const sitzung = await sitzungLesen();
  if (!sitzung) redirect('/anmelden');
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from('mitglieder')
    .select('rolle, apotheken ( id, name, land )')
    .eq('user_id', sitzung.userId)
    .limit(1)
    .maybeSingle();
  const apotheke = data?.apotheken as unknown as Arbeitsplatz['apotheke'] | null | undefined;
  if (!data || !apotheke) return null;
  return {
    userId: sitzung.userId,
    email: sitzung.email,
    apotheke,
    rolle: data.rolle as Arbeitsplatz['rolle'],
  };
});

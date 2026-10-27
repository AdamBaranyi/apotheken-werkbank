'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { arbeitsplatzLaden } from '@/lib/apotheke';
import { meldungAusFehler } from '@/lib/fehler';
import { supabaseServer } from '@/lib/supabase/server';

export interface StornoStand {
  fehler?: string;
}

const eingabe = z.object({ original: z.uuid(), schluessel: z.uuid() });

/** Bucht den Gegenbeleg. Wer stornieren darf, prüft die Datenbank (nur die Inhaberin, der Inhaber). */
export async function stornieren(_vorher: StornoStand, form: FormData): Promise<StornoStand> {
  const platz = await arbeitsplatzLaden();
  if (!platz) return { fehler: 'Dieses Konto gehört zu keiner Apotheke.' };
  const geprueft = eingabe.safeParse({
    original: form.get('original'),
    schluessel: form.get('schluessel'),
  });
  if (!geprueft.success) return { fehler: 'Die Seite ist veraltet. Bitte neu laden.' };
  const { original, schluessel } = geprueft.data;
  const supabase = await supabaseServer();
  const buchen = () =>
    supabase.rpc('verkauf_stornieren', { p_id: schluessel, p_original: original });
  let { error } = await buchen();
  // 23505 heisst entweder «gleicher Klick zweimal» (dann liefert der zweite
  // Aufruf das Storno) oder «schon storniert» (dann bleibt der Fehler).
  if (error?.code === '23505') ({ error } = await buchen());
  if (error?.code === '23505') return { fehler: 'Dieser Beleg ist schon storniert.' };
  if (error) return { fehler: meldungAusFehler(error, 'Das Storno wurde nicht gebucht.') };
  redirect(`/kasse/belege/${schluessel}`);
}

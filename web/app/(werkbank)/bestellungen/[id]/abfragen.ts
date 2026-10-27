'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { arbeitsplatzLaden } from '@/lib/apotheke';
import { abfragbar, bestellungLaden } from '@/lib/bestellung/laden';
import { statusUndAuswerten } from '@/lib/bestellung/senden';
import { meldungAusFehler } from '@/lib/fehler';
import { supabaseServer } from '@/lib/supabase/server';

export interface AbfrageStand {
  fehler?: string;
}

/**
 * Statusabfrage beim Grosshändler (MSV3 bestellstatusAbfragen) mit derselben
 * ID wie beim Senden. Eine Bestellung, die noch «wird gesendet» heisst, war
 * unterbrochen: Sie wird zuerst «unklar» (so verlangt es die Datenbank) und
 * dann zum Ergebnis der Abfrage.
 */
export async function statusAbfragen(_vorher: AbfrageStand, form: FormData): Promise<AbfrageStand> {
  const platz = await arbeitsplatzLaden();
  if (!platz) return { fehler: 'Dieses Konto gehört zu keiner Apotheke.' };
  const id = z.uuid().safeParse(form.get('bestellung'));
  const b = id.success ? await bestellungLaden(id.data) : null;
  if (!b) return { fehler: 'Diese Bestellung gibt es nicht.' };
  if (!abfragbar(b, new Date())) redirect(`/bestellungen/${b.id}`);
  const ergebnis = await statusUndAuswerten(b.zugang_id, b.id);
  const supabase = await supabaseServer();
  if (b.status === 'wird_gesendet') {
    await supabase
      .from('bestellungen')
      .update({ status: 'unklar', meldung: 'Das Senden wurde unterbrochen.' })
      .eq('id', b.id);
  }
  const { error } = await supabase.from('bestellungen').update(ergebnis).eq('id', b.id);
  if (error) return { fehler: meldungAusFehler(error, 'Der Status wurde nicht gespeichert.') };
  redirect(`/bestellungen/${b.id}`);
}

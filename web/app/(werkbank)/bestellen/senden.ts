'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { arbeitsplatzLaden } from '@/lib/apotheke';
import { sendenUndAuswerten } from '@/lib/bestellung/senden';
import { meldungAusFehler } from '@/lib/fehler';
import { supabaseServer } from '@/lib/supabase/server';
import { positionenLesen, positionenSchema } from './eingabe';

export interface SendeStand {
  fehler?: string;
}

interface Angelegt {
  id: string;
  auftrag_id: string;
  support_id: number;
  neu: boolean;
}

const eingabe = z.object({
  schluessel: z.uuid('Die Seite ist veraltet. Bitte neu laden.'),
  zugangId: z.uuid(),
  positionen: positionenSchema,
});

/**
 * Bestellt verbindlich: zuerst die Zeile in der Datenbank (ihre ID ist die
 * Bestell-ID beim Grosshändler), dann senden, dann der Status aus der
 * Antwort. Bricht etwas zwischen Senden und Antwort ab, bleibt die Bestellung
 * «unklar», und die Statusabfrage klärt es – nie ein zweites Senden.
 */
export async function bestellungSenden(_vorher: SendeStand, form: FormData): Promise<SendeStand> {
  const platz = await arbeitsplatzLaden();
  if (!platz) return { fehler: 'Dieses Konto gehört zu keiner Apotheke.' };
  const geprueft = eingabe.safeParse({
    schluessel: form.get('schluessel'),
    zugangId: form.get('zugangId'),
    positionen: positionenLesen(form),
  });
  if (!geprueft.success)
    return { fehler: geprueft.error.issues[0]?.message ?? 'Eingabe ungültig.' };
  const { schluessel, zugangId, positionen } = geprueft.data;
  const supabase = await supabaseServer();
  const anlegen = () =>
    supabase
      .rpc('bestellung_anlegen', { p_id: schluessel, p_zugang: zugangId, p_positionen: positionen })
      .single<Angelegt>();
  let { data, error } = await anlegen();
  // Zwei Klicks im selben Augenblick: Der zweite liest die schon angelegte Bestellung.
  if (error?.code === '23505') ({ data, error } = await anlegen());
  if (error || !data) {
    return { fehler: meldungAusFehler(error ?? {}, 'Die Bestellung wurde nicht angelegt.') };
  }
  // Nur wer die Bestellung angelegt hat, sendet sie; ein zweiter Klick zeigt sie nur.
  if (data.neu) {
    const ergebnis = await sendenUndAuswerten(zugangId, {
      id: data.id,
      supportId: data.support_id,
      auftragId: data.auftrag_id,
      liefervorgabe: 'MaxVerbund',
      positionen,
    });
    const { error: speichern } = await supabase
      .from('bestellungen')
      .update(ergebnis)
      .eq('id', data.id);
    if (speichern) console.error('Bestellung: Status nicht gespeichert', speichern.code);
  }
  redirect(`/bestellungen/${data.id}`);
}

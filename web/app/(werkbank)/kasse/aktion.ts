'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { arbeitsplatzLaden } from '@/lib/apotheke';
import { meldungAusFehler } from '@/lib/fehler';
import { centAusEingabe } from '@/lib/geld';
import { supabaseServer } from '@/lib/supabase/server';

export interface KassenStand {
  fehler?: string;
}

const position = z.object({
  pzn: z.string().regex(/^\d{8}$/, 'Eine PZN hat acht Ziffern.'),
  menge: z
    .number('Bitte bei jeder Position eine Menge eintragen.')
    .int('Mengen sind ganze Packungen.')
    .min(1, 'Die Menge muss mindestens 1 sein.')
    .max(999, 'Höchstens 999 Packungen je Position.'),
  rezept_vorgelegt: z.boolean(),
});

const eingabe = z.object({
  schluessel: z.uuid('Der Bon ist veraltet. Bitte die Seite neu laden.'),
  zahlart: z.enum(['bar', 'karte'], 'Bitte bar oder Karte wählen.'),
  gegeben: z.number().int().nullable(),
  positionen: z
    .array(position)
    .min(1, 'Der Bon ist leer. Bitte zuerst einen Artikel erfassen.')
    .max(50, 'Höchstens 50 Positionen je Beleg.'),
});

function positionenLesen(form: FormData) {
  const positionen: { pzn: string; menge: number; rezept_vorgelegt: boolean }[] = [];
  for (const [name, wert] of form.entries()) {
    const pzn = /^menge-(\d{8})$/.exec(name)?.[1];
    if (!pzn) continue;
    const text = String(wert).trim();
    positionen.push({
      pzn,
      menge: text === '' ? Number.NaN : Number(text),
      rezept_vorgelegt: form.get(`rezept-${pzn}`) === 'ja',
    });
  }
  return positionen;
}

/**
 * Bucht einen Verkauf. Die Apotheke kommt aus der Sitzung, nie aus dem
 * Formular; Preise, Sätze und Nummer setzt die Datenbank. Der Schlüssel
 * stammt aus dem Seitenaufbau: Ein zweiter Klick bucht nichts doppelt.
 */
export async function verkaufBuchen(_vorher: KassenStand, form: FormData): Promise<KassenStand> {
  const platz = await arbeitsplatzLaden();
  if (!platz) return { fehler: 'Dieses Konto gehört zu keiner Apotheke.' };
  const zahlart = form.get('zahlart');
  const gegeben = zahlart === 'bar' ? centAusEingabe(String(form.get('gegeben') ?? '')) : null;
  if (zahlart === 'bar' && gegeben === null) {
    return { fehler: 'Bitte den gegebenen Betrag eintragen, etwa 20,00.' };
  }
  const geprueft = eingabe.safeParse({
    schluessel: form.get('schluessel'),
    zahlart,
    gegeben,
    positionen: positionenLesen(form),
  });
  if (!geprueft.success) {
    return { fehler: geprueft.error.issues[0]?.message ?? 'Eingabe ungültig.' };
  }
  const v = geprueft.data;
  const supabase = await supabaseServer();
  const buchen = () =>
    supabase.rpc('verkauf_buchen', {
      p_id: v.schluessel,
      p_apotheke: platz.apotheke.id,
      p_zahlart: v.zahlart,
      p_gegeben_cent: v.gegeben,
      p_positionen: v.positionen,
    });
  let { error } = await buchen();
  // Zwei Klicks im selben Augenblick: Der zweite stösst auf die schon
  // gebuchte ID; noch einmal gefragt, liefert die Datenbank den Beleg.
  if (error?.code === '23505') ({ error } = await buchen());
  if (error)
    return {
      fehler: meldungAusFehler(error, 'Der Verkauf wurde nicht gebucht. Bitte erneut versuchen.'),
    };
  redirect(`/kasse/belege/${v.schluessel}`);
}

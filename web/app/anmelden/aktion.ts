'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { bremseFrei, bremseSchluessel, bremseZaehlen, vertrauteIp } from '@/lib/bremse';
import { supabaseServer } from '@/lib/supabase/server';

export interface AnmeldeStand {
  fehler?: string;
  email?: string;
}

const eingabe = z.object({
  email: z.email().max(200),
  passwort: z.string().min(1).max(200),
});

/** Gleiche Meldung für unbekannte Adresse und falsches Passwort: verrät keine Konten. */
const ABGELEHNT = 'E-Mail oder Passwort stimmt nicht.';
const GEBREMST = 'Zu viele Versuche. Bitte in 15 Minuten erneut.';

/**
 * Höchstens 5 Fehlversuche je Konto und 20 je IP in 15 Minuten (E23). Gezählt
 * werden nur Fehlversuche, sonst sperrten sich Apotheken mit einer IP selbst.
 * Die Grenze je Konto gilt auch für Adressen, die es nicht gibt: So verrät
 * die Sperre nicht, welche Konten bestehen.
 */
const FENSTER_SEKUNDEN = 900;

export async function anmelden(_vorher: AnmeldeStand, form: FormData): Promise<AnmeldeStand> {
  const roh = {
    email: String(form.get('email') ?? '').trim(),
    passwort: String(form.get('passwort') ?? ''),
  };
  const geprueft = eingabe.safeParse(roh);
  if (!geprueft.success) return { fehler: 'Bitte E-Mail und Passwort eingeben.', email: roh.email };

  const ip = vertrauteIp(await headers());
  const bremse = [
    { schluessel: bremseSchluessel('konto', geprueft.data.email), grenze: 5 },
    ...(ip ? [{ schluessel: bremseSchluessel('ip', ip), grenze: 20 }] : []),
  ];
  if (!(await bremseFrei(bremse, FENSTER_SEKUNDEN))) return { fehler: GEBREMST, email: roh.email };

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({
    email: geprueft.data.email,
    password: geprueft.data.passwort,
  });
  if (error) {
    const gesperrt = error.status === 429;
    if (!gesperrt) await bremseZaehlen(bremse.map((b) => b.schluessel));
    return { fehler: gesperrt ? GEBREMST : ABGELEHNT, email: roh.email };
  }
  redirect('/bestellen');
}

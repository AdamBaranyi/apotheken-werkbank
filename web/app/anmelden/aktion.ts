'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
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

export async function anmelden(_vorher: AnmeldeStand, form: FormData): Promise<AnmeldeStand> {
  const roh = {
    email: String(form.get('email') ?? '').trim(),
    passwort: String(form.get('passwort') ?? ''),
  };
  const geprueft = eingabe.safeParse(roh);
  if (!geprueft.success) return { fehler: 'Bitte E-Mail und Passwort eingeben.', email: roh.email };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({
    email: geprueft.data.email,
    password: geprueft.data.passwort,
  });
  if (error) {
    const gesperrt = error.status === 429;
    return {
      fehler: gesperrt ? 'Zu viele Versuche. Bitte in einigen Minuten erneut.' : ABGELEHNT,
      email: roh.email,
    };
  }
  redirect('/bestellen');
}

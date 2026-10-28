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
 * Fehlversuche in 15 Minuten (E23): 5 je Konto und IP (eine Quelle, ein
 * Konto), 10 je Konto (verteilte Versuche), 30 je IP (eine Quelle, viele
 * Konten). Eine Sperre nur je Konto liesse jeden mit fünf Fehlversuchen die
 * Apotheke aussperren; die höhere Grenze macht das teurer. Gezählt werden nur
 * Fehlversuche, auch für Adressen, die es nicht gibt: So verrät die Sperre
 * nicht, welche Konten bestehen. Ohne verlässliche IP (lokal) gilt nur die
 * Grenze je Konto.
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
  const email = geprueft.data.email;
  const bremse = [
    { schluessel: bremseSchluessel('konto', email), grenze: 10 },
    ...(ip
      ? [
          { schluessel: bremseSchluessel('konto-ip', `${email}|${ip}`), grenze: 5 },
          { schluessel: bremseSchluessel('ip', ip), grenze: 30 },
        ]
      : []),
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

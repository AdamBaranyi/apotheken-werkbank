'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { bremseFreigeben, bremseSchluessel, bremseVersuch, vertrauteIp } from '@/lib/bremse';
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
const GESTOERT = 'Die Anmeldung ist gerade gestört. Bitte in einigen Minuten erneut.';

/**
 * Fehlversuche in 15 Minuten (E23): 5 je Konto und IP (eine Quelle, ein
 * Konto), 10 je Konto (verteilte Versuche), 30 je IP (eine Quelle, viele
 * Konten). Eine Sperre nur je Konto liesse jeden mit fünf Fehlversuchen die
 * Apotheke aussperren; die höhere Grenze macht das teurer. Jeder Versuch
 * zählt vor der Prüfung des Passworts, ein gelungener gibt seine Zählung
 * wieder frei: So kommen auch gleichzeitige Versuche nicht über die Grenze, und
 * es zählen nur Fehlversuche, auch für Adressen, die es nicht gibt (die Sperre
 * verrät keine Konten). Ohne verlässliche IP (lokal) gilt nur die Grenze je
 * Konto. Ist die Bremse gestört, kommt niemand herein: Sonst liesse sie sich
 * gezielt überlasten und danach unbegrenzt raten.
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
  const versuch = await bremseVersuch(bremse, FENSTER_SEKUNDEN);
  if (versuch.stand === 'gestoert') return { fehler: GESTOERT, email: roh.email };
  if (versuch.stand === 'gebremst') return { fehler: GEBREMST, email: roh.email };

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({
    email: geprueft.data.email,
    password: geprueft.data.passwort,
  });
  if (error) return { fehler: error.status === 429 ? GEBREMST : ABGELEHNT, email: roh.email };
  if (versuch.stand === 'frei') await bremseFreigeben(versuch.ids);
  redirect('/bestellen');
}

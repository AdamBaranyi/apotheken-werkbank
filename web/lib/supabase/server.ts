import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { umgebung } from '@/lib/umgebung';
import { SITZUNGS_COOKIE } from './cookies';

/**
 * Supabase im Namen der angemeldeten Person: Jede Abfrage läuft mit ihrer
 * Sitzung, die Datenbank prüft die Rechte selbst (RLS). Kein Geheimschlüssel
 * in der App.
 */
export async function supabaseServer() {
  const u = umgebung();
  const speicher = await cookies();
  return createServerClient(u.SUPABASE_URL, u.SUPABASE_PUBLISHABLE_KEY, {
    cookieOptions: SITZUNGS_COOKIE,
    cookies: {
      getAll: () => speicher.getAll(),
      setAll: (liste) => {
        try {
          for (const { name, value, options } of liste) speicher.set(name, value, options);
        } catch {
          // In Server-Komponenten sind Cookies nur lesbar; die Sitzung frischt proxy.ts auf.
        }
      },
    },
  });
}

export interface Sitzung {
  userId: string;
  email: string;
  /** Hat das Konto den Rundgang schon einmal von selbst bekommen (E43)? */
  rundgangGesehen: boolean;
}

/** Die angemeldete Person, je Anfrage einmal geprüft (Layout und Seite teilen das Ergebnis). */
export const sitzungLesen = cache(async (): Promise<Sitzung | null> => {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return {
    userId: data.user.id,
    email: data.user.email ?? '',
    rundgangGesehen: Boolean(data.user.user_metadata?.rundgang_gesehen),
  };
});

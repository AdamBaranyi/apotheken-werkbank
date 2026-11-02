'use server';

import { supabaseServer } from '@/lib/supabase/server';

/**
 * Merkt am Konto, dass der Rundgang einmal von selbst lief (E43). Nur ein
 * Merker in den eigenen Kontodaten; scheitert er, kommt der Rundgang beim
 * nächsten Anmelden eben noch einmal.
 */
export async function rundgangGesehen(): Promise<void> {
  const supabase = await supabaseServer();
  await supabase.auth.updateUser({ data: { rundgang_gesehen: new Date().toISOString() } });
}

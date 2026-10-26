import 'server-only';
import type { Zugang } from '@/lib/msv3/client';
import { supabaseServer } from '@/lib/supabase/server';
import { umgebung } from '@/lib/umgebung';
import { entschluesseln } from '@/lib/verschluesselung';

/**
 * Holt einen Grosshändler-Zugang samt Passwort. Die Datenbank gibt den
 * Geheimtext nur über eine Funktion heraus, die die Mitgliedschaft prüft;
 * entschlüsselt wird hier, mit dem Schlüssel aus der Umgebung des Servers.
 */
export async function zugangLaden(zugangId: string): Promise<Zugang | null> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc('zugang_fuer_bestellung', { p_zugang: zugangId });
  const zeile = Array.isArray(data) ? data[0] : undefined;
  if (error || !zeile) return null;
  const schluessel = Buffer.from(umgebung().ZUGANG_SCHLUESSEL, 'base64');
  return {
    basisUrl: zeile.basis_url as string,
    kundenkennung: zeile.kundenkennung as string,
    passwort: entschluesseln(zeile.passwort_verschluesselt as string, schluessel),
  };
}

import 'server-only';
import { Msv3Fehler, type Zugang } from '@/lib/msv3/client';
import { supabaseServer } from '@/lib/supabase/server';
import { umgebung } from '@/lib/umgebung';
import { entschluesseln } from '@/lib/verschluesselung';

interface Zeile {
  basis_url: string;
  kundenkennung: string;
  passwort_verschluesselt: string;
}

/**
 * Entschlüsselt das Passwort eines Zugangs. Ein falscher Schlüssel (etwa nach
 * einem Wechsel in der Umgebung) wird zur Meldung statt zum Absturz der Seite.
 */
export function zugangAusZeile(zeile: Zeile, schluessel: Buffer): Zugang {
  let passwort: string;
  try {
    passwort = entschluesseln(zeile.passwort_verschluesselt, schluessel);
  } catch {
    throw new Msv3Fehler(
      'ClientException',
      'C-SCHLUESSEL',
      'Die gespeicherten Zugangsdaten lassen sich nicht lesen.',
    );
  }
  return { basisUrl: zeile.basis_url, kundenkennung: zeile.kundenkennung, passwort };
}

/**
 * Holt einen Grosshändler-Zugang samt Passwort. Die Datenbank gibt den
 * Geheimtext nur über eine Funktion heraus, die die Mitgliedschaft prüft;
 * entschlüsselt wird hier, mit dem Schlüssel aus der Umgebung des Servers.
 */
export async function zugangLaden(zugangId: string): Promise<Zugang | null> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc('zugang_fuer_bestellung', { p_zugang: zugangId });
  const zeile = Array.isArray(data) ? (data[0] as Zeile | undefined) : undefined;
  if (error || !zeile) return null;
  return zugangAusZeile(zeile, Buffer.from(umgebung().ZUGANG_SCHLUESSEL, 'base64'));
}

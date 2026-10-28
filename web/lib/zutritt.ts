/**
 * Entscheidet in proxy.ts, ob eine Anfrage ohne Sitzung zur Anmeldung geht.
 *
 * Nie bei Aufrufen von Server-Aktionen (Issue #1): Der Browser folgte einer
 * Umleitung mit POST auf die Anmeldung, und Next verstünde die Antwort nicht –
 * es bliebe eine Fehlerseite. Die Sicherheit hängt nicht daran: Jede Aktion
 * prüft die Sitzung selbst und leitet mit redirect() um, und die Datenbank
 * prüft die Rechte noch einmal (RLS).
 */
const OEFFENTLICH = ['/anmelden'];

export function zurAnmeldung({
  angemeldet,
  pfad,
  serverAktion,
}: {
  angemeldet: boolean;
  pfad: string;
  serverAktion: boolean;
}): boolean {
  return !angemeldet && !OEFFENTLICH.includes(pfad) && !serverAktion;
}

/**
 * Kommt eine Anfrage von dieser App? Browser schicken bei POST immer einen
 * Origin-Kopf mit. Fehlt er, kommt die Anfrage nicht aus einem Browser und
 * trägt keine fremden Cookies. «null» und Unlesbares gelten als fremd.
 */
export function gleicheHerkunft(origin: string | null, host: string | null): boolean {
  if (origin === null) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

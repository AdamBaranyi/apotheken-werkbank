/**
 * Meldung für Menschen aus einem Fehler der Datenbank. Die eigenen Regeln
 * (WK… Kasse, WB… Bestellung) melden schon auf Deutsch und ohne Interna; alles
 * andere bleibt allgemein und kommt nur mit dem Code ins Protokoll.
 */
export function meldungAusFehler(
  fehler: { code?: string; message?: string },
  allgemein: string,
): string {
  if (fehler.code && /^W[KB]\d{3}$/.test(fehler.code) && fehler.message) return fehler.message;
  if (fehler.code === '42501') return 'Dafür fehlt die Berechtigung.';
  console.error('Datenbank meldet', fehler.code ?? 'ohne Code');
  return allgemein;
}

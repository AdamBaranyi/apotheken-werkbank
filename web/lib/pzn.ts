/**
 * Pharmazentralnummer: acht Ziffern, die letzte ist eine Prüfziffer
 * (Modulo 11 über die ersten sieben mit den Gewichten 1 bis 7). Dieselbe
 * Regel prüft die Datenbank (public.pzn_gueltig) und die Grosshandel-Attrappe;
 * hier fängt sie einen Tippfehler, bevor der Artikel gesucht wird.
 */
export function pznGueltig(pzn: string): boolean {
  if (!/^\d{8}$/.test(pzn)) return false;
  const summe = [...pzn.slice(0, 7)].reduce((s, ziffer, i) => s + Number(ziffer) * (i + 1), 0);
  return summe % 11 === Number(pzn[7]);
}

/** Die PZN am Anfang einer Eingabe, etwa aus dem Vorschlag «99100008 Probatin …». */
export function pznAusEingabe(eingabe: string): { pzn: string } | { fehler: string } {
  const pzn = /^\s*(\d{8})(?!\d)/.exec(eingabe)?.[1];
  if (!pzn) return { fehler: 'Bitte eine PZN mit acht Ziffern eingeben.' };
  if (!pznGueltig(pzn))
    return { fehler: `Die Prüfziffer der PZN ${pzn} stimmt nicht. Tippfehler?` };
  return { pzn };
}

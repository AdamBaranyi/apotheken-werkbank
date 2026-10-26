/**
 * Satzregel für Packungen, Stärken und Uhrzeiten: Zahl und folgendes Wort
 * («100 ml», «5 mg», «09:59 Uhr») brechen nicht auseinander. Nur für die
 * Anzeige; Beschriftungen für Screenreader bleiben mit normalem Leerzeichen.
 */
export function zusammenhalten(text: string): string {
  return text.replace(/(\d) (?=\S)/g, '$1 ');
}

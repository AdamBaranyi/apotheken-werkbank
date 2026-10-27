/**
 * Geldbeträge als ganze Cent, nie als Kommazahl: Gerechnet wird in der
 * Datenbank, hier wird nur gezeigt und gelesen. Euro wie in Deutschland
 * («12,50 €»), Franken wie in der Schweiz («CHF 12.50»).
 */
const FORMAT = {
  EUR: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }),
  CHF: new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }),
} as const;

export type Waehrung = keyof typeof FORMAT;

export function istWaehrung(wert: string): wert is Waehrung {
  return wert in FORMAT;
}

export function betragText(cent: number, waehrung: Waehrung = 'EUR'): string {
  return FORMAT[waehrung].format(cent / 100);
}

/** Höchstens 100 000,00; Komma oder Punkt; keine Tausenderpunkte, nichts Negatives. */
const BETRAG = /^(\d{1,6})(?:[.,](\d{1,2}))?$/;

export function centAusEingabe(text: string): number | null {
  const treffer = BETRAG.exec(text.trim());
  if (!treffer) return null;
  const cent = Number(treffer[1]) * 100 + Number((treffer[2] ?? '').padEnd(2, '0'));
  return cent <= 10_000_000 ? cent : null;
}

const PROZENT = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });

/** Steuersatz aus Promille: 190 → «19 %», 26 → «2,6 %». */
export function satzText(promille: number): string {
  return `${PROZENT.format(promille / 10)} %`;
}

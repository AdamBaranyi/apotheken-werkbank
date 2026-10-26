import type { Vertragsdaten } from '@/lib/msv3/schema';
import { minutenAus, type Ortszeit } from '@/lib/zeit';

export type FensterStand = 'vorbei' | 'laeuft' | 'kommt';

export interface Fenster {
  tour: string;
  ende: string;
  endeMinuten: number;
  beginnMinuten: number;
  stand: FensterStand;
  hauptbestellzeitpunkt?: string;
}

const WOCHE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;

/** Das erste Fenster an einem der folgenden Tage, wenn heute keines mehr läuft. */
export function naechstesFenster(
  vertrag: Vertragsdaten,
  jetzt: Ortszeit,
): { wochentag: string; tour: string; ende: string } | null {
  const heute = WOCHE.indexOf(jetzt.wochentag as (typeof WOCHE)[number]);
  for (let versatz = 1; versatz <= 7; versatz++) {
    const tag = WOCHE[(heute + versatz) % 7];
    const erstes = vertrag.bestellfenster
      .filter((f) => f.wochentag === tag)
      .sort((a, b) => minutenAus(a.ende) - minutenAus(b.ende))[0];
    if (erstes)
      return {
        wochentag: versatz === 1 ? 'morgen' : erstes.wochentag,
        tour: erstes.tour,
        ende: erstes.ende,
      };
  }
  return null;
}

/**
 * Die Bestellfenster von heute aus den Vertragsdaten des Grosshändlers. Ein
 * Fenster läuft bis zu seinem Ende plus 59 Sekunden (Pflichtenheft
 * Kap. 2.2.5); auf die Minute gerechnet heisst das: bis einschliesslich Ende.
 */
export function fensterVonHeute(vertrag: Vertragsdaten, jetzt: Ortszeit): Fenster[] {
  const heute = vertrag.bestellfenster
    .filter((f) => f.wochentag === jetzt.wochentag)
    .map((f) => ({ ...f, endeMinuten: minutenAus(f.ende) }))
    .sort((a, b) => a.endeMinuten - b.endeMinuten);
  let laeuftVergeben = false;
  return heute.map((f, i) => {
    const beginnMinuten = i === 0 ? 0 : (heute[i - 1]?.endeMinuten ?? 0) + 1;
    let stand: FensterStand = 'kommt';
    if (jetzt.minuten > f.endeMinuten) stand = 'vorbei';
    else if (!laeuftVergeben) {
      stand = 'laeuft';
      laeuftVergeben = true;
    }
    return {
      tour: f.tour,
      ende: f.ende,
      endeMinuten: f.endeMinuten,
      beginnMinuten,
      stand,
      ...(f.hauptbestellzeitpunkt ? { hauptbestellzeitpunkt: f.hauptbestellzeitpunkt } : {}),
    };
  });
}

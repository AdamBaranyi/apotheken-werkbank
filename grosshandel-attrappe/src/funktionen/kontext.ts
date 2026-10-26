import type { Bestellbuch } from '../fachlich/bestellbuch.ts';
import type { Lager } from '../fachlich/lager.ts';
import type { Mandant } from '../fachlich/mandanten.ts';
import type { Anteil } from '../fachlich/typen.ts';
import { el, gruppe } from '../soap/antwort.ts';

/** Was jede Funktion braucht: angemeldeter Mandant, Lager, Buch, Uhr, Nachtbetrieb. */
export interface Kontext {
  mandant: Mandant;
  lager: Lager;
  buch: Bestellbuch;
  jetzt: Date;
  nachtbetrieb: boolean;
}

export type Funktion = (inhalt: unknown, kontext: Kontext) => string;

export function anteilXml(anteil: Anteil): string {
  return gruppe(
    'anteil',
    el('typ', anteil.typ) +
      el('menge', anteil.menge) +
      el('lieferzeitpunkt', anteil.lieferzeitpunkt) +
      el('tour', anteil.tour) +
      el('tourId', anteil.tourId) +
      el('defektgrund', anteil.defektgrund),
  );
}

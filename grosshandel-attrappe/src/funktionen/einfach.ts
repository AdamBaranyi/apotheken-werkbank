import { el, gruppe } from '../soap/antwort.ts';
import { leereAnfrage, pruefen } from '../schema.ts';
import type { Funktion } from './kontext.ts';

const TAGE = ['', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/** verbindungTesten (Kap. 6.6): ohne Fehler heisst erreichbar und angemeldet. Auch nachts verfügbar. */
export const verbindungTesten: Funktion = (inhalt) => {
  pruefen(leereAnfrage, inhalt);
  return '<m:verbindungTestenAntwort/>';
};

/** vertragsdatenAbfragen (Kap. 6.7): Bestellfenster der Woche, Auftragsarten, Vereinbarungen. */
export const vertragsdatenAbfragen: Funktion = (inhalt, { mandant }) => {
  pruefen(leereAnfrage, inhalt);
  const v = mandant.vertrag;
  const fenster = v.bestellfenster
    .flatMap((f) =>
      f.wochentage.map((tag) =>
        gruppe(
          'bestellfenster',
          el('wochentag', TAGE[tag]) +
            el('ende', f.ende) +
            el('tour', f.tour) +
            el('hauptbestellzeitpunkt', f.hauptbestellzeitpunkt),
        ),
      ),
    )
    .join('');
  const arten = v.erlaubteAuftragsarten.map((a) => el('erlaubteAuftragsart', a)).join('');
  return gruppe(
    'vertragsdatenAbfragenAntwort',
    gruppe(
      'vertragsdaten',
      el('gueltigAb', v.gueltigAb) +
        el('kundenkennung', mandant.kundenkennung) +
        fenster +
        arten +
        el('substitutionsvereinbarung', false) +
        el('verfuegbarkeitEinzelnSpezifisch', v.spezifischeVerfuegbarkeit) +
        el('verfuegbarkeitBulk', false) +
        el('ruecknahmeangebot', false),
    ),
  );
};

import { naechsteTouren } from '../fachlich/touren.ts';
import type { Anteil } from '../fachlich/typen.ts';
import { unspezifisch, zuteilen } from '../fachlich/zuteilung.ts';
import { el, gruppe } from '../soap/antwort.ts';
import { Msv3Fehler } from '../soap/fehler.ts';
import { pruefen, verfuegbarkeitAnfrage } from '../schema.ts';
import { anteilXml, type Funktion, type Kontext } from './kontext.ts';

/**
 * verfuegbarkeitAnfragen (Kap. 6.4.2 und 6.4.3): unverbindlich, reserviert
 * nichts. Ohne Liefervorgabe gelten alle Wege (MaxDispo), darum kommen nur die
 * fünf Typen Normal, Verbund, Nachlieferung, Dispo und NichtLieferbar vor.
 * Spezifisch oder unspezifisch entscheidet der Vertrag des Mandanten.
 */
function mitTour(anteil: Anteil, kontext: Kontext): Anteil {
  const [normal, verbund] = naechsteTouren(kontext.mandant.vertrag.bestellfenster, kontext.jetzt);
  const tour = anteil.typ === 'Normal' ? normal : anteil.typ === 'Verbund' ? verbund : undefined;
  return tour ? { ...anteil, lieferzeitpunkt: tour.lieferzeitpunkt, tour: tour.tour } : anteil;
}

export const verfuegbarkeitAnfragen: Funktion = (inhalt, kontext) => {
  const anfrage = pruefen(verfuegbarkeitAnfrage, inhalt);
  if (kontext.nachtbetrieb) {
    throw new Msv3Fehler(
      'ServerException',
      'S-NACHTBETRIEB',
      'Die Warenwirtschaft des Grosshändlers ist gerade nicht verfügbar (Nachtbetrieb).',
    );
  }
  const spezifisch = kontext.mandant.vertrag.spezifischeVerfuegbarkeit;
  const artikel = anfrage.artikel
    .map(({ pzn, menge }) => {
      const zuteilung = zuteilen(
        kontext.lager.finden(pzn),
        menge,
        'MaxDispo',
        kontext.mandant.btmErlaubnis,
      );
      const anteile = spezifisch
        ? zuteilung.anteile.map((a) => mitTour(a, kontext))
        : [unspezifisch(zuteilung)];
      return gruppe(
        'artikel',
        el('pzn', pzn) + el('menge', menge) + anteile.map(anteilXml).join(''),
      );
    })
    .join('');
  return gruppe(
    'verfuegbarkeitAnfragenAntwort',
    el('rTyp', spezifisch ? 'Spezifisch' : 'Unspezifisch') + artikel,
  );
};

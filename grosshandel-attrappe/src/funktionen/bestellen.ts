import { auftragsartErlaubt } from '../fachlich/mandanten.ts';
import { naechsteTouren, type Tour } from '../fachlich/touren.ts';
import type { Anteil } from '../fachlich/typen.ts';
import { zuteilen } from '../fachlich/zuteilung.ts';
import { el, gruppe } from '../soap/antwort.ts';
import { validierungsfehler } from '../soap/fehler.ts';
import { bestellAnfrage, pruefen, type Auftrag, type BestellAnfrage } from '../schema.ts';
import { anteilXml, type Funktion, type Kontext } from './kontext.ts';

/**
 * bestellen (Pflichtenheft Kap. 6.2): verbindlich. Prüft zuerst alles, was die
 * ganze Bestellung ungültig macht (dann wurde nichts ausgeführt), danach je
 * Auftrag; ein nicht vereinbarter Auftrag wird einzeln abgelehnt, die übrigen
 * gelten. Gebuchte Mengen gehen vom gemeinsamen Lager ab.
 */
function ganzeBestellungPruefen(anfrage: BestellAnfrage, kontext: Kontext): void {
  const { bestellung } = anfrage;
  const positionen = bestellung.auftrag.reduce((s, a) => s + a.position.length, 0);
  if (positionen > 5000) {
    throw validierungsfehler(
      'V-ZU-VIELE',
      'Zu viele Positionen in einer Bestellung (höchstens 5000).',
    );
  }
  const ids = [bestellung.id, ...bestellung.auftrag.map((a) => a.id)];
  if (new Set(ids).size !== ids.length) {
    throw validierungsfehler('V-ID-DOPPELT', 'Eine Kennung kommt in der Bestellung doppelt vor.');
  }
  for (const auftrag of bestellung.auftrag) {
    const pzns = auftrag.position.map((p) => p.pzn);
    if (new Set(pzns).size !== pzns.length) {
      throw validierungsfehler('V-PZN-DOPPELT', 'Eine PZN kommt in einem Auftrag doppelt vor.');
    }
  }
  if (kontext.buch.idBenutzt(kontext.mandant.kundenkennung, ids, kontext.jetzt)) {
    throw validierungsfehler(
      'V-ID-BENUTZT',
      'Diese Bestellung wurde schon übertragen. Bitte den Status abfragen statt neu zu bestellen.',
    );
  }
}

function anteilMitTour(anteil: Anteil, normal?: Tour, verbund?: Tour): Anteil {
  const tour = anteil.typ === 'Normal' ? normal : anteil.typ === 'Verbund' ? verbund : undefined;
  return tour ? { ...anteil, ...tour } : anteil;
}

function auftragAusfuehren(auftrag: Auftrag, kontext: Kontext): string {
  const kopf =
    el('id', auftrag.id) +
    el('auftragsart', auftrag.auftragsart) +
    // Ohne vereinbarte freie Kennungen gilt die Standardkennung der Auftragsart (Kap. 6.2.3).
    el('auftragskennung', auftrag.auftragsart);
  if (!auftragsartErlaubt(kontext.mandant, auftrag.auftragsart) || auftrag.gebindeId) {
    const fehler =
      el('errorCode', 'A-AUFTRAGSART') +
      el('endanwenderText', `Auftragsart ${auftrag.auftragsart} ist nicht vereinbart.`) +
      el('technischerText', 'Auftragsart oder Gebinde nicht im Vertrag');
    return gruppe('auftrag', kopf + gruppe('auftragsfehler', fehler));
  }
  const [normal, verbund] = naechsteTouren(kontext.mandant.vertrag.bestellfenster, kontext.jetzt);
  const positionen = auftrag.position.map((p) => {
    const zuteilung = zuteilen(
      kontext.lager.finden(p.pzn),
      p.menge,
      p.liefervorgabe,
      kontext.mandant.btmErlaubnis,
    );
    kontext.lager.reservieren(p.pzn, zuteilung.ausHauptlager, zuteilung.ausVerbund);
    const anteile = zuteilung.anteile.map((a) => anteilXml(anteilMitTour(a, normal, verbund)));
    return gruppe(
      'position',
      el('pzn', p.pzn) +
        el('menge', p.menge) +
        el('liefervorgabe', p.liefervorgabe) +
        anteile.join(''),
    );
  });
  return gruppe('auftrag', kopf + positionen.join(''));
}

/** Nachtbetrieb (Kap. 6.2.6): nur Empfangsbestätigung, ohne Defekte und Touren. */
function nurEmpfang(auftrag: Auftrag): string {
  return gruppe(
    'auftrag',
    el('id', auftrag.id) +
      el('auftragsart', auftrag.auftragsart) +
      el('auftragskennung', auftrag.auftragsart),
  );
}

export const bestellen: Funktion = (inhalt, kontext) => {
  const anfrage = pruefen(bestellAnfrage, inhalt);
  ganzeBestellungPruefen(anfrage, kontext);
  const { bestellung } = anfrage;
  const auftraege = bestellung.auftrag
    .map((a) => (kontext.nachtbetrieb ? nurEmpfang(a) : auftragAusfuehren(a, kontext)))
    .join('');
  const antwort = gruppe(
    'bestellung',
    el('id', bestellung.id) + el('nachtbetrieb', kontext.nachtbetrieb) + auftraege,
  );
  kontext.buch.speichern(
    kontext.mandant.kundenkennung,
    bestellung.id,
    bestellung.auftrag.map((a) => a.id),
    { eingang: kontext.jetzt, nachtbetrieb: kontext.nachtbetrieb, antwortXml: antwort },
  );
  return gruppe('bestellenAntwort', antwort);
};

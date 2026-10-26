import { ausOrtszeit, isoMitVersatz, ortszeit } from './berlin.ts';

/**
 * Bestellfenster und Touren (Pflichtenheft Kap. 2.2.5 und 6.7): Ein Fenster
 * endet zu einer vereinbarten Minute; technisch zählt eine Bestellung bis
 * 59 Sekunden danach noch zum alten Fenster. Zu jedem Fenster gehört eine Tour
 * mit festem Lieferzeitpunkt.
 */
export interface Bestellfenster {
  /** 1 = Montag … 7 = Sonntag */
  wochentage: number[];
  /** Ende als Ortszeit «HH:MM». */
  ende: string;
  tour: string;
  /** Lieferzeitpunkt = Ende des Fensters plus so viele Minuten. */
  lieferungNachMinuten: number;
  hauptbestellzeitpunkt?: string;
}

export interface Tour {
  tour: string;
  /** Eindeutig für mindestens sieben Tage: Datum und Tour, höchstens 20 Zeichen. */
  tourId: string;
  lieferzeitpunkt: string;
}

const PUFFER_MS = 59_000;

function stundeMinute(text: string): [number, number] {
  const [h, m] = text.split(':').map(Number);
  return [h ?? 0, m ?? 0];
}

function tourAmTag(fenster: Bestellfenster, jahr: number, monat: number, tag: number) {
  const [h, m] = stundeMinute(fenster.ende);
  const ende = ausOrtszeit(jahr, monat, tag, h, m);
  const lieferung = new Date(ende.getTime() + fenster.lieferungNachMinuten * 60_000);
  const datum = `${jahr}${String(monat).padStart(2, '0')}${String(tag).padStart(2, '0')}`;
  return {
    endeMitPuffer: ende.getTime() + PUFFER_MS,
    tour: {
      tour: fenster.tour,
      tourId: `${datum}-${fenster.tour}`.slice(0, 20),
      lieferzeitpunkt: isoMitVersatz(lieferung),
    },
  };
}

/** Die nächsten Touren ab jetzt, in zeitlicher Folge; die erste ist die Normal-Tour. */
export function naechsteTouren(fenster: Bestellfenster[], jetzt: Date, anzahl = 2): Tour[] {
  const ergebnis: Tour[] = [];
  const heute = ortszeit(jetzt);
  for (let versatz = 0; versatz < 8 && ergebnis.length < anzahl; versatz++) {
    // Mittag des Tages als Anker: Date.UTC rechnet Monatsenden selbst um.
    const tagDatum = ortszeit(ausOrtszeit(heute.jahr, heute.monat, heute.tag + versatz, 12, 0));
    const kandidaten = fenster
      .filter((f) => f.wochentage.includes(tagDatum.wochentag))
      .map((f) => tourAmTag(f, tagDatum.jahr, tagDatum.monat, tagDatum.tag))
      .filter((k) => k.endeMitPuffer >= jetzt.getTime())
      .sort((a, b) => a.endeMitPuffer - b.endeMitPuffer);
    for (const k of kandidaten) if (ergebnis.length < anzahl) ergebnis.push(k.tour);
  }
  return ergebnis;
}

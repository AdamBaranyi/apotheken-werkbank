/**
 * Wo die Rundgang-Karte steht (E46): direkt unter dem erklärten Element, sonst darüber,
 * mittig dazu und immer ganz im Fenster. Passt beides nicht, weil das Element zu hoch ist oder
 * die Seite nicht weiter rollt, liegt sie am Fensterrand bündig mit der rechten Kante des
 * Elements, und dessen Anfang bleibt frei. Ohne Element steht sie in
 * der Mitte. Die Seite selbst verschiebt sich dafür nie. Alle Werte in Pixeln, bezogen aufs Fenster.
 */
export interface Masse {
  breite: number;
  hoehe: number;
}

export interface Kasten extends Masse {
  oben: number;
  links: number;
}

export interface Lage {
  art: 'unten' | 'oben' | 'frei';
  oben: number;
  links: number;
  /** Abstand der Zeigerspitze vom linken Kartenrand. */
  zeiger: number;
}

/** Zwischen Element und Karte: Umriss mit Versatz (9 px), Zeiger und etwas Luft. */
export const ABSTAND = 24;
/** Mindestabstand der Karte zum Fensterrand. */
export const RAND = 16;
/** Umriss der Hervorhebung samt Versatz (globals.css). */
const UMRISS = 9;
/** Der Zeiger bleibt so weit von den runden Ecken weg. */
const ZEIGER_RAND = 24;

function zwischen(wert: number, min: number, max: number): number {
  return Math.min(Math.max(wert, min), Math.max(min, max));
}

export function lageBerechnen(ziel: Kasten | null, karte: Masse, fenster: Masse): Lage {
  if (!ziel) {
    return {
      art: 'frei',
      oben: Math.max(RAND, (fenster.hoehe - karte.hoehe) / 2),
      links: Math.max(RAND, (fenster.breite - karte.breite) / 2),
      zeiger: 0,
    };
  }
  const mitte = ziel.links + ziel.breite / 2;
  const links = zwischen(mitte - karte.breite / 2, RAND, fenster.breite - RAND - karte.breite);
  const zeiger = zwischen(mitte - links, ZEIGER_RAND, karte.breite - ZEIGER_RAND);
  const passt = (oben: number) => oben >= RAND && oben + karte.hoehe <= fenster.hoehe - RAND;

  const darunter = ziel.oben + ziel.hoehe + ABSTAND;
  if (passt(darunter)) return { art: 'unten', oben: darunter, links, zeiger };
  const darueber = ziel.oben - ABSTAND - karte.hoehe;
  if (passt(darueber)) return { art: 'oben', oben: darueber, links, zeiger };

  // Kein Platz: unten an den Fensterrand und rechtsbündig, damit oben der Anfang des Elements
  // und links der Anfang jeder Zeile lesbar bleiben. Oben am Rand wäre nie besser: Wo dort
  // Platz ist, passt die Karte schon direkt über das Element.
  const oben = Math.max(RAND, fenster.hoehe - RAND - karte.hoehe);
  const rechtsbuendig = zwischen(
    ziel.links + ziel.breite - karte.breite,
    RAND,
    fenster.breite - RAND - karte.breite,
  );
  return { art: 'frei', oben, links: rechtsbuendig, zeiger: 0 };
}

/**
 * Wie weit die Seite rollen muss: Element und Karte zusammen in der Mitte des Fensters. Ist das
 * Element dafür zu hoch, kommt sein Anfang oben ins Fenster.
 */
export function rollweg(ziel: Kasten, karte: Masse, fenster: Masse): number {
  const block = ziel.hoehe + ABSTAND + karte.hoehe;
  const oben = block + 2 * RAND <= fenster.hoehe ? (fenster.hoehe - block) / 2 : RAND + UMRISS;
  return ziel.oben - oben;
}

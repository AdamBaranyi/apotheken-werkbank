/**
 * Zählt Ereignisse je Schlüssel in festen Zeitfenstern. Genutzt für
 * Fehlversuche bei der Anmeldung (je Herkunft) und für Anfragen je Mandant
 * (DenialOfServiceException, Pflichtenheft Kap. 2.3.6).
 */
export class Zaehler {
  readonly #max: number;
  readonly #fensterMs: number;
  readonly #stand = new Map<string, { beginn: number; anzahl: number }>();

  constructor(max: number, fensterMs: number) {
    this.#max = max;
    this.#fensterMs = fensterMs;
  }

  /** Zählt ein Ereignis; false, wenn die Grenze damit überschritten ist. */
  zaehlen(schluessel: string, jetzt: number): boolean {
    const eintrag = this.#aktuell(schluessel, jetzt);
    eintrag.anzahl += 1;
    return eintrag.anzahl <= this.#max;
  }

  /** true, wenn die Grenze schon erreicht ist, ohne zu zählen. */
  gesperrt(schluessel: string, jetzt: number): boolean {
    return this.#aktuell(schluessel, jetzt).anzahl >= this.#max;
  }

  /** Sekunden bis zum Ende des laufenden Fensters. */
  restSekunden(schluessel: string, jetzt: number): number {
    const eintrag = this.#aktuell(schluessel, jetzt);
    return Math.max(1, Math.ceil((eintrag.beginn + this.#fensterMs - jetzt) / 1000));
  }

  #aktuell(schluessel: string, jetzt: number) {
    let eintrag = this.#stand.get(schluessel);
    if (!eintrag || jetzt - eintrag.beginn >= this.#fensterMs) {
      eintrag = { beginn: jetzt, anzahl: 0 };
      this.#stand.set(schluessel, eintrag);
    }
    if (this.#stand.size > 10_000) this.#ausduennen(jetzt);
    return eintrag;
  }

  #ausduennen(jetzt: number): void {
    for (const [schluessel, eintrag] of this.#stand) {
      if (jetzt - eintrag.beginn >= this.#fensterMs) this.#stand.delete(schluessel);
    }
  }
}

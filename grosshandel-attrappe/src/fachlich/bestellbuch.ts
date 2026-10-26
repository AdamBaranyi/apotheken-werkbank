import { tagesschluessel } from './berlin.ts';

/**
 * Merkt sich Bestellungen je Mandant (Pflichtenheft Kap. 2.1.1 AF2 und 6.3):
 * am selben Tag gibt es die Antwort noch einmal, danach sieben Tage lang nur
 * «nicht mehr verfügbar», danach ist die Kennung unbekannt. Kennungen gelten je
 * Mandant: Ein anderer Mandant erfährt nie, ob eine fremde ID existiert.
 */
export type Bestellstatus =
  'KennungUnbekannt' | 'BestellantwortNichtVerfuegbar' | 'BestellantwortVerfuegbar';

interface Eintrag {
  eingang: Date;
  nachtbetrieb: boolean;
  antwortXml: string;
}

const TAG_MS = 86_400_000;

function tageZwischen(von: Date, bis: Date): number {
  const zuDatum = (schluessel: number) =>
    Date.UTC(
      Math.floor(schluessel / 10000),
      (Math.floor(schluessel / 100) % 100) - 1,
      schluessel % 100,
    );
  return Math.round((zuDatum(tagesschluessel(bis)) - zuDatum(tagesschluessel(von))) / TAG_MS);
}

export class Bestellbuch {
  readonly #bestellungen = new Map<string, Eintrag>();
  readonly #auftraege = new Map<string, Date>();

  /** true, wenn eine der IDs bei diesem Mandanten in den letzten acht Tagen benutzt wurde. */
  idBenutzt(kundenkennung: string, ids: readonly string[], jetzt: Date): boolean {
    this.#aufraeumen(jetzt);
    return ids.some(
      (id) =>
        this.#bestellungen.has(`${kundenkennung}|${id}`) ||
        this.#auftraege.has(`${kundenkennung}|${id}`),
    );
  }

  speichern(
    kundenkennung: string,
    bestellId: string,
    auftragIds: readonly string[],
    eintrag: Eintrag,
  ): void {
    this.#bestellungen.set(`${kundenkennung}|${bestellId}`, eintrag);
    for (const id of auftragIds) this.#auftraege.set(`${kundenkennung}|${id}`, eintrag.eingang);
  }

  status(
    kundenkennung: string,
    bestellId: string,
    jetzt: Date,
  ): { status: Bestellstatus; antwortXml?: string } {
    this.#aufraeumen(jetzt);
    const eintrag = this.#bestellungen.get(`${kundenkennung}|${bestellId}`);
    if (!eintrag) return { status: 'KennungUnbekannt' };
    const tage = tageZwischen(eintrag.eingang, jetzt);
    if (tage === 0 && !eintrag.nachtbetrieb) {
      return { status: 'BestellantwortVerfuegbar', antwortXml: eintrag.antwortXml };
    }
    if (tage <= 7) return { status: 'BestellantwortNichtVerfuegbar' };
    return { status: 'KennungUnbekannt' };
  }

  #aufraeumen(jetzt: Date): void {
    for (const [schluessel, eintrag] of this.#bestellungen) {
      if (tageZwischen(eintrag.eingang, jetzt) > 7) this.#bestellungen.delete(schluessel);
    }
    for (const [schluessel, eingang] of this.#auftraege) {
      if (tageZwischen(eingang, jetzt) > 7) this.#auftraege.delete(schluessel);
    }
  }
}

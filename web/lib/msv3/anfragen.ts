import 'server-only';
import { aufrufen, Msv3Fehler, xmlText, type Zugang } from './client';
import {
  bestellantwortSchema,
  bestellstatusSchema,
  verfuegbarkeitSchema,
  vertragsdatenSchema,
  type Bestellantwort,
  type Bestellstatusantwort,
  type Verfuegbarkeit,
  type Vertragsdaten,
} from './schema';

/** Kennung dieser Software, die jede Anfrage mitschickt (Pflichtenheft Kap. 2.3.3). */
const SOFTWARE = 'Apotheken-Werkbank 0.1';

function geprueft<T>(
  schema: { safeParse: (x: unknown) => { success: boolean; data?: T } },
  wert: unknown,
): T {
  const ergebnis = schema.safeParse(wert);
  if (!ergebnis.success || ergebnis.data === undefined) {
    throw new Msv3Fehler(
      'ClientException',
      'C-SCHEMA',
      'Antwort des Grosshändlers hat ein unerwartetes Format.',
    );
  }
  return ergebnis.data;
}

export async function vertragsdatenAbfragen(zugang: Zugang): Promise<Vertragsdaten> {
  const inhalt = `<m:clientSoftwareKennung>${xmlText(SOFTWARE)}</m:clientSoftwareKennung>`;
  const antwort = await aufrufen(zugang, 'vertragsdatenAbfragen', inhalt, true);
  return geprueft(vertragsdatenSchema, antwort).vertragsdaten;
}

export interface Anfrageposition {
  pzn: string;
  menge: number;
}

export async function verfuegbarkeitAnfragen(
  zugang: Zugang,
  positionen: readonly Anfrageposition[],
): Promise<Verfuegbarkeit> {
  const artikel = positionen
    .map(
      (p) =>
        `<m:artikel><m:pzn>${xmlText(p.pzn)}</m:pzn><m:menge>${xmlText(p.menge)}</m:menge></m:artikel>`,
    )
    .join('');
  const inhalt = `<m:clientSoftwareKennung>${xmlText(SOFTWARE)}</m:clientSoftwareKennung>${artikel}`;
  const antwort = await aufrufen(zugang, 'verfuegbarkeitAnfragen', inhalt, true);
  return geprueft(verfuegbarkeitSchema, antwort);
}

export interface Bestellauftrag {
  /** Bestell-ID (GUID der Apotheke); dieselbe ID fragt später den Status ab. */
  id: string;
  /** Für Rückfragen beim Grosshändler lesbar, fortlaufend je Apotheke. */
  supportId: number;
  auftragId: string;
  /**
   * Was der Grosshändler liefern darf (Pflichtenheft Tabelle 7, aufsteigend):
   * «MaxVerbund» heisst Hauptlager und zweites Lager. Die Verfügbarkeit zeigt
   * dagegen alles Mögliche, auch Nachlieferung und Dispo.
   */
  liefervorgabe: 'Normal' | 'MaxVerbund' | 'MaxNachlieferung' | 'MaxDispo';
  positionen: readonly Anfrageposition[];
}

/**
 * Verbindliche Bestellung, ein Auftrag der Art NORMAL (Pflichtenheft
 * Kap. 6.2). Nicht zeitkritisch: 30 s Geduld.
 */
export async function bestellen(zugang: Zugang, auftrag: Bestellauftrag): Promise<Bestellantwort> {
  const positionen = auftrag.positionen
    .map(
      (p) =>
        `<m:position><m:pzn>${xmlText(p.pzn)}</m:pzn><m:menge>${xmlText(p.menge)}</m:menge>` +
        `<m:liefervorgabe>${xmlText(auftrag.liefervorgabe)}</m:liefervorgabe></m:position>`,
    )
    .join('');
  const inhalt =
    `<m:clientSoftwareKennung>${xmlText(SOFTWARE)}</m:clientSoftwareKennung>` +
    `<m:bestellung><m:id>${xmlText(auftrag.id)}</m:id>` +
    `<m:bestellSupportId>${xmlText(auftrag.supportId)}</m:bestellSupportId>` +
    `<m:auftrag><m:id>${xmlText(auftrag.auftragId)}</m:id><m:auftragsart>NORMAL</m:auftragsart>` +
    '<m:auftragskennung>NORMAL</m:auftragskennung>' +
    `<m:auftragsSupportId>${xmlText(auftrag.supportId)}</m:auftragsSupportId>${positionen}` +
    '</m:auftrag></m:bestellung>';
  const antwort = await aufrufen(zugang, 'bestellen', inhalt, false);
  return geprueft(bestellantwortSchema, antwort).bestellung;
}

/** Hat der Grosshändler eine Bestellung? Nach einem Abbruch statt doppelt zu bestellen. */
export async function bestellstatusAbfragen(
  zugang: Zugang,
  bestellId: string,
): Promise<Bestellstatusantwort> {
  const inhalt =
    `<m:clientSoftwareKennung>${xmlText(SOFTWARE)}</m:clientSoftwareKennung>` +
    `<m:bestellId>${xmlText(bestellId)}</m:bestellId>`;
  const antwort = await aufrufen(zugang, 'bestellstatusAbfragen', inhalt, true);
  return geprueft(bestellstatusSchema, antwort);
}

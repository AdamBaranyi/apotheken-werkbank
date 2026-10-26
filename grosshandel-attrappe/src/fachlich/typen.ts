/**
 * Begriffe aus dem Pflichtenheft MSV3 1.0h (siehe docs/MSV3.md).
 * Tabelle 2 (Anteil-Typen), Tabelle 7 (Liefervorgaben), Tabelle 8 (Defektgründe).
 */
export const LIEFERVORGABEN = ['Normal', 'MaxVerbund', 'MaxNachlieferung', 'MaxDispo'] as const;
export type Liefervorgabe = (typeof LIEFERVORGABEN)[number];

export const ANTEIL_TYPEN = [
  'Normal',
  'Verbund',
  'Nachlieferung',
  'Dispo',
  'NichtLieferbar',
  'KeineLieferungAberNormalMoeglich',
  'KeineLieferungAberVerbundMoeglich',
  'KeineLieferungAberNachlieferungMoeglich',
  'KeineLieferungAberDispoMoeglich',
] as const;
export type AnteilTyp = (typeof ANTEIL_TYPEN)[number];

export const DEFEKTGRUENDE = [
  'FehltZurzeit',
  'NichtLieferbar',
  'NurDirekt',
  'NichtGefuehrt',
  'ArtikelNrUnbekannt',
  'AusserHandel',
  'KeinBezug',
  'Transportausschluss',
  'TeilDefekt',
  // Nur bei der unspezifischen Verfügbarkeitsanfrage für voll lieferbare Artikel (Kap. 6.4.2).
  'KeineAngabe',
] as const;
export type Defektgrund = (typeof DEFEKTGRUENDE)[number];

export const AUFTRAGSARTEN = ['NORMAL', 'STAPEL', 'SONDER', 'VERSAND'] as const;
export type Auftragsart = (typeof AUFTRAGSARTEN)[number];

export type Sperre = 'NurDirekt' | 'AusserHandel' | 'NichtGefuehrt' | 'Transportausschluss';

/** Ein Artikel im Lager der Attrappe. Alle Artikel sind erfunden. */
export interface Artikel {
  pzn: string;
  name: string;
  /** Bestand im Hauptlager, liefert zur nächsten Tour (Normal). */
  bestand: number;
  /** Bestand in einem zweiten Lager, liefert eine Tour später (Verbund). */
  verbundBestand: number;
  /** Der Hersteller kann nachliefern (Nachlieferung, Defektgrund FehltZurzeit). */
  nachlieferbar: boolean;
  /** Kein Lagerartikel: nur als Dispo bestellbar. */
  lagerartikel: boolean;
  /** Braucht eine Erlaubnis für Betäubungsmittel (sonst KeinBezug). */
  btm: boolean;
  sperre?: Sperre;
}

export interface Anteil {
  typ: AnteilTyp;
  /** Fehlt nur bei der unspezifischen Verfügbarkeitsanfrage. */
  menge?: number;
  defektgrund?: Defektgrund;
  lieferzeitpunkt?: string;
  tour?: string;
  tourId?: string;
}

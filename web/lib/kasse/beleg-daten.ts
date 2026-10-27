import type { Waehrung } from '@/lib/geld';

/** Ein Beleg, wie ihn Seite und PDF zeigen. Alle Beträge in Cent, so wie die Datenbank sie rechnet. */
export interface BelegPosition {
  nr: number;
  pzn: string;
  name: string;
  packung: string;
  menge: number;
  einzelpreis_cent: number;
  satz_promille: number;
  rezeptpflichtig: boolean;
  rezept_vorgelegt: boolean;
}

export interface BelegSteuer {
  satz_promille: number;
  brutto_cent: number;
  steuer_cent: number;
}

export interface BelegVerweis {
  id: string;
  belegnummer: number;
}

export interface BelegDaten {
  id: string;
  belegnummer: number;
  apotheke: string;
  land: string;
  waehrung: Waehrung;
  zahlart: 'bar' | 'karte';
  gegeben_cent: number | null;
  summe_cent: number;
  rueckgeld_cent: number | null;
  erstellt_am: string;
  storno_von: BelegVerweis | null;
  storniert_durch: BelegVerweis | null;
  positionen: BelegPosition[];
  steuern: BelegSteuer[];
}

/** Kennbuchstaben je Steuersatz, der höchste Satz zuerst: A, B, … */
export function steuerBuchstaben(steuern: readonly BelegSteuer[]): Map<number, string> {
  const saetze = [...new Set(steuern.map((s) => s.satz_promille))].sort((a, b) => b - a);
  return new Map(saetze.map((satz, i) => [satz, String.fromCharCode(65 + i)]));
}

const ZEIT = {
  DE: new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    dateStyle: 'medium',
    timeStyle: 'short',
  }),
  CH: new Intl.DateTimeFormat('de-CH', {
    timeZone: 'Europe/Zurich',
    dateStyle: 'medium',
    timeStyle: 'short',
  }),
};

/** Zeitpunkt in der Zeit der Apotheke, nicht in der des Servers (Vercel rechnet in UTC). */
export function zeitText(iso: string, land: string): string {
  return (land === 'CH' ? ZEIT.CH : ZEIT.DE).format(new Date(iso));
}

import { z } from 'zod';

/*
 * Flow-Monitor: Berichte der Engine lesen und in Worte fassen. Ein Bericht
 * kommt als JSON von einem Engine-Konto; Zod prüft ihn, bevor die Seite ihn
 * zeigt. Lokale Pfade aus dem Bericht (etwa zum Bildschirmfoto) zeigt die
 * Seite nicht: Das Foto liegt in engine_fotos.
 */

export type Laufstatus =
  'ok' | 'bereits-gebucht' | 'nichts-offen' | 'abgebrochen' | 'unklar' | 'trocken';

/** Status in Worten; die Farbe kommt nur dazu. */
export const STATUS_TEXT: Record<Laufstatus, string> = {
  ok: 'Erledigt',
  'bereits-gebucht': 'Schon gebucht',
  'nichts-offen': 'Nichts offen',
  abgebrochen: 'Abgebrochen',
  unklar: 'Unklar, bitte prüfen',
  trocken: 'Trockenlauf',
};

/** Was der Status für die Apotheke heisst. */
export const STATUS_ERKLAERUNG: Record<Laufstatus, string> = {
  ok: 'Die Engine hat den Ablauf zu Ende gebracht.',
  'bereits-gebucht':
    'Diese Kennung hatte schon einen Beleg. Die Engine hat nichts gebucht, so gibt es keinen doppelten Verkauf.',
  'nichts-offen': 'Es gab nichts abzuschliessen.',
  abgebrochen:
    'Die Engine hat aufgehört, bevor sie buchte, oder die Kasse hat abgelehnt. Gebucht ist nichts.',
  unklar:
    'Ein buchender Schritt ist gesendet, die Bestätigung fehlt. Denselben Auftrag noch einmal laufen lassen: Die Engine sucht die Kennung und bucht nur, wenn es keinen Beleg gibt.',
  trocken: 'Trockenlauf ohne Eingabe: nur geprüft, ob Fenster und Anker zu sehen sind.',
};

const FLOW_TEXT: Record<string, string> = { verkauf: 'Verkauf', abschluss: 'Tagesabschluss' };
const KASSE_TEXT: Record<string, string> = { nord: 'Nord', sued: 'Süd' };

export function flowText(flow: string): string {
  return FLOW_TEXT[flow] ?? flow;
}

export function kasseText(kasse: string): string {
  return KASSE_TEXT[kasse] ?? kasse;
}

const SCHRITT_TEXT: Record<string, (ziel: string) => string> = {
  klicke: (z) => `Klick auf «${z}»`,
  eingeben: (z) => `Eingabe bei «${z}»`,
  taste: (z) => `Taste ${z}`,
  'warte-bis': (z) => `Warten auf «${z}»`,
  pruefe: (z) => `Prüfen: «${z}»`,
  lies: (z) => `Lesen: «${z}»`,
  'beenden-wenn': (z) => `Ende, wenn «${z}»`,
};

/** Ein Schritt so, wie man ihn an der Kasse sagen würde. */
export function schrittText(s: { art: string; ziel: string }): string {
  const text = SCHRITT_TEXT[s.art];
  return text ? text(s.ziel) : `${s.art} «${s.ziel}»`;
}

const ZAHL = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });

/** 4200 ms als «4,2 s», ab einer Minute «1 min 5 s». */
export function dauerText(ms: number): string {
  if (ms < 60_000) return `${ZAHL.format(ms / 1000)} s`;
  const sekunden = Math.round(ms / 1000);
  return `${Math.floor(sekunden / 60)} min ${sekunden % 60} s`;
}

/** bytea aus der REST-Schnittstelle («\x89504e…») als Bytes. */
export function fotoBytes(hex: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(Buffer.from(hex.replace(/^\\x/, ''), 'hex'));
}

const Schritt = z.object({
  nr: z.string(),
  art: z.string(),
  ziel: z.string(),
  ergebnis: z.string(),
  versuche: z.number().int(),
  dauerMs: z.number(),
  meldung: z.string().nullable().catch(''),
});

const Heilung = z.object({
  schritt: z.string(),
  aktion: z.string(),
  ziel: z.string(),
  taste: z.string(),
  begruendung: z.string(),
  erlaubt: z.boolean(),
  ausgefuehrt: z.boolean(),
  grund: z.string(),
  ergebnis: z.string(),
  kostenUsd: z.number(),
  heiler: z.string().optional(),
});

const Dialog = z.object({ text: z.string(), klick: z.string(), zeit: z.string() });

const Bericht = z.object({
  schritte: z.array(Schritt),
  heilungen: z.array(Heilung).catch([]),
  dialoge: z.array(Dialog).catch([]),
  werte: z.record(z.string(), z.string()).catch({}),
  ocr: z.string().nullable().catch(null),
  fehler: z.object({ schritt: z.string().nullable(), meldung: z.string() }).nullable().catch(null),
});

export type Laufbericht = z.infer<typeof Bericht>;

/** Prüft einen Bericht aus der Datenbank; null, wenn er nicht passt. */
export function berichtLesen(roh: unknown): Laufbericht | null {
  const ergebnis = Bericht.safeParse(roh);
  return ergebnis.success ? ergebnis.data : null;
}

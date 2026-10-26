import type { Anteil } from '@/lib/msv3/schema';

/** Wörter für die Lieferarten aus MSV3 (Pflichtenheft Tabelle 2), so wie die Apotheke sie liest. */
export const ART: Record<Anteil['typ'], string> = {
  Normal: 'mit Tour',
  Verbund: 'später aus zweitem Lager, Tour',
  Nachlieferung: 'Nachlieferung',
  Dispo: 'Dispo beim Hersteller',
  NichtLieferbar: 'nicht lieferbar',
  KeineLieferungAberNormalMoeglich: 'nicht bestellt, normal möglich',
  KeineLieferungAberVerbundMoeglich: 'nicht bestellt, Verbund möglich',
  KeineLieferungAberNachlieferungMoeglich: 'nicht bestellt, Nachlieferung möglich',
  KeineLieferungAberDispoMoeglich: 'nicht bestellt, Dispo möglich',
};

/** Defektgründe (Pflichtenheft Tabelle 8). */
export const GRUND: Record<string, string> = {
  FehltZurzeit: 'fehlt zurzeit',
  NichtLieferbar: 'Hersteller liefert nicht',
  NurDirekt: 'nur direkt beim Hersteller',
  NichtGefuehrt: 'nicht im Sortiment',
  ArtikelNrUnbekannt: 'PZN unbekannt',
  AusserHandel: 'ausser Handel',
  KeinBezug: 'kein Bezug erlaubt (BtM)',
  Transportausschluss: 'Transport ausgeschlossen (Kühlkette)',
  TeilDefekt: 'nur teilweise lieferbar',
};

/** Gruppe für Farbe und Muster: Was kommt mit der Tour, was später, was gar nicht. */
export function gruppe(
  typ: Anteil['typ'],
): 'normal' | 'verbund' | 'nachlieferung' | 'dispo' | 'defekt' {
  if (typ === 'Normal') return 'normal';
  if (typ === 'Verbund') return 'verbund';
  if (typ === 'Nachlieferung') return 'nachlieferung';
  if (typ === 'Dispo') return 'dispo';
  return 'defekt';
}

const TAG = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin',
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
});
const DATUM = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'short' });

/**
 * Lieferzeitpunkt lesbar: «heute 15:29», «morgen 11:29» oder «Mi., 28.10., 11:29».
 * Die Uhrzeit steht im ISO-Wert schon in deutscher Ortszeit.
 */
export function lieferung(iso: string | undefined, jetzt: Date): string | null {
  const zeit = iso ? /T(\d{2}:\d{2})/.exec(iso)?.[1] : undefined;
  if (!iso || !zeit) return null;
  const tag = new Date(iso);
  const morgen = new Date(jetzt.getTime() + 86_400_000);
  if (DATUM.format(tag) === DATUM.format(jetzt)) return `heute ${zeit}`;
  if (DATUM.format(tag) === DATUM.format(morgen)) return `morgen ${zeit}`;
  return `${TAG.format(tag)}, ${zeit}`;
}

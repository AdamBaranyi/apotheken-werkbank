import type { Bestellstatus } from './status';

/**
 * Wann die Statusabfrage beim Grosshändler etwas klären kann. Gleich nach
 * einem Abbruch verarbeitet der Grosshändler die Bestellung vielleicht noch;
 * eine Abfrage hiesse dann «nicht angekommen» und lüde zum zweiten Bestellen
 * ein. Darum frühestens eine Minute nach der letzten Änderung.
 */
const WARTEZEIT_MS = 60_000;

interface Stand {
  status: Bestellstatus;
  erstellt_am: string;
  aktualisiert_am: string | null;
}

/** Ab wann abgefragt werden darf; null, wenn die Abfrage nichts mehr klärt. */
export function abfrageAb(b: Stand): Date | null {
  if (b.status === 'nicht_angekommen') return new Date(Date.parse(b.erstellt_am));
  if (b.status !== 'unklar' && b.status !== 'wird_gesendet') return null;
  return new Date(Date.parse(b.aktualisiert_am ?? b.erstellt_am) + WARTEZEIT_MS);
}

export function abfragbar(b: Stand, jetzt: Date): boolean {
  const ab = abfrageAb(b);
  return ab !== null && jetzt.getTime() >= ab.getTime();
}

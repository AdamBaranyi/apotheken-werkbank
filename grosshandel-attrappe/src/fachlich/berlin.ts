/**
 * Uhrzeit des Grosshändlers. Massgeblich für Bestellfenster ist seine
 * Systemzeit (Pflichtenheft Kap. 2.2.5); die Attrappe steht in Deutschland,
 * also Europe/Berlin mit Sommer- und Winterzeit.
 */
const ZONE = 'Europe/Berlin';

export interface Ortszeit {
  jahr: number;
  monat: number;
  tag: number;
  /** 1 = Montag … 7 = Sonntag */
  wochentag: number;
  stunde: number;
  minute: number;
  sekunde: number;
}

const WOCHENTAGE: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

const formatierer = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export function ortszeit(zeitpunkt: Date): Ortszeit {
  const teile = Object.fromEntries(
    formatierer.formatToParts(zeitpunkt).map((teil) => [teil.type, teil.value]),
  );
  return {
    jahr: Number(teile.year),
    monat: Number(teile.month),
    tag: Number(teile.day),
    wochentag: WOCHENTAGE[teile.weekday ?? ''] ?? 0,
    stunde: Number(teile.hour),
    minute: Number(teile.minute),
    sekunde: Number(teile.second),
  };
}

/** Versatz der Ortszeit zu UTC in Minuten (+60 im Winter, +120 im Sommer). */
function versatzMinuten(zeitpunkt: Date): number {
  const o = ortszeit(zeitpunkt);
  const alsUtc = Date.UTC(o.jahr, o.monat - 1, o.tag, o.stunde, o.minute, o.sekunde);
  return Math.round((alsUtc - Math.floor(zeitpunkt.getTime() / 1000) * 1000) / 60000);
}

/** Zeitpunkt zu einer Ortszeit in Berlin. Zweimal korrigiert, damit die Umstellung stimmt. */
export function ausOrtszeit(
  jahr: number,
  monat: number,
  tag: number,
  stunde: number,
  minute: number,
): Date {
  const naiv = Date.UTC(jahr, monat - 1, tag, stunde, minute);
  let ergebnis = new Date(naiv - versatzMinuten(new Date(naiv)) * 60000);
  ergebnis = new Date(naiv - versatzMinuten(ergebnis) * 60000);
  return ergebnis;
}

/** ISO-8601 mit Versatz, etwa 2026-10-26T15:30:00+01:00 (für xsd:dateTime). */
export function isoMitVersatz(zeitpunkt: Date): string {
  const o = ortszeit(zeitpunkt);
  const versatz = versatzMinuten(zeitpunkt);
  const vorzeichen = versatz >= 0 ? '+' : '-';
  const h = String(Math.floor(Math.abs(versatz) / 60)).padStart(2, '0');
  const m = String(Math.abs(versatz) % 60).padStart(2, '0');
  const zwei = (n: number) => String(n).padStart(2, '0');
  return (
    `${o.jahr}-${zwei(o.monat)}-${zwei(o.tag)}T${zwei(o.stunde)}:${zwei(o.minute)}:` +
    `${zwei(o.sekunde)}${vorzeichen}${h}:${m}`
  );
}

/** Kalendertag in Berlin als Zahl JJJJMMTT, zum Vergleichen von Tagen. */
export function tagesschluessel(zeitpunkt: Date): number {
  const o = ortszeit(zeitpunkt);
  return o.jahr * 10000 + o.monat * 100 + o.tag;
}

/**
 * Uhrzeit in Deutschland (Europe/Berlin), auch wenn der Server in UTC läuft.
 * Bestellfenster gelten in der Zeit des Grosshändlers.
 */
const TAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] as const;
export type Wochentag = (typeof TAGE)[number];

const formatierer = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin',
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export interface Ortszeit {
  wochentag: Wochentag;
  minuten: number;
  text: string;
}

export function ortszeit(zeitpunkt: Date): Ortszeit {
  const teile = Object.fromEntries(
    formatierer.formatToParts(zeitpunkt).map((t) => [t.type, t.value]),
  );
  const tag = String(teile.weekday ?? '').slice(0, 2) as Wochentag;
  const stunde = Number(teile.hour);
  const minute = Number(teile.minute);
  return {
    wochentag: TAGE.includes(tag) ? tag : 'Mo',
    minuten: stunde * 60 + minute,
    text: `${String(stunde).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
  };
}

export function minutenAus(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function dauerText(minuten: number): string {
  const h = Math.floor(minuten / 60);
  const m = minuten % 60;
  if (h === 0) return `${m} Min.`;
  return m === 0 ? `${h} Std.` : `${h} Std. ${m} Min.`;
}

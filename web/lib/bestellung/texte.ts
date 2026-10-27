import type { Bestellstatus } from './status';

/** Status in Worten. Status zeigt die Werkbank nie nur über Farbe. */
export const STATUS_TEXT: Record<Bestellstatus, string> = {
  wird_gesendet: 'Wird gesendet',
  bestaetigt: 'Bestätigt',
  abgelehnt: 'Abgelehnt',
  unklar: 'Unklar',
  nicht_angekommen: 'Nicht angekommen',
  ohne_antwort: 'Angekommen, ohne Antwort',
};

/** Was der Status für die Apotheke heisst. */
export const STATUS_ERKLAERUNG: Record<Bestellstatus, string> = {
  wird_gesendet: 'Die Bestellung ist unterwegs zum Grosshändler.',
  bestaetigt: 'Der Grosshändler hat die Bestellung gebucht. Was er liefert, steht je Artikel.',
  abgelehnt: 'Der Grosshändler hat die Bestellung nicht ausgeführt. Sie kann neu bestellt werden.',
  unklar:
    'Die Antwort des Grosshändlers fehlt. Bitte den Status abfragen, bevor neu bestellt wird – sonst kommt die Ware vielleicht doppelt.',
  nicht_angekommen: 'Der Grosshändler kennt diese Bestellung nicht. Sie kann neu bestellt werden.',
  ohne_antwort:
    'Die Bestellung ist angekommen. Die Antwort mit den Lieferungen gibt der Grosshändler nur am Tag der Bestellung heraus.',
};

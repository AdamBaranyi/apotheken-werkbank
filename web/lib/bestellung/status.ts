import type { Anteil, Bestellantwort, Bestellstatusantwort } from '@/lib/msv3/schema';

/**
 * Was eine Antwort oder ein Fehler des Grosshändlers für den Status einer
 * Bestellung heisst. Die Regel aus dem Pflichtenheft (Kap. 2.3.6): Meldet der
 * Server eine Exception, wurde die Funktion nicht ausgeführt. Nach Zeitablauf,
 * Netzfehler oder unlesbarer Antwort weiss es niemand – dann klärt die
 * Statusabfrage, statt ein zweites Mal zu bestellen.
 */
export type Bestellstatus =
  'wird_gesendet' | 'bestaetigt' | 'abgelehnt' | 'unklar' | 'nicht_angekommen' | 'ohne_antwort';

export interface GespeicherteAntwort {
  nachtbetrieb: boolean;
  positionen: { pzn: string; menge: number; anteile: Anteil[] }[];
}

export interface Ergebnis {
  status: Bestellstatus;
  meldung: string | null;
  antwort: GespeicherteAntwort | null;
}

const NICHT_AUSGEFUEHRT = new Set([
  'ServerException',
  'AuthorizationException',
  'DenialOfServiceException',
  'ValidationException',
]);

/** Fehler, bei denen nichts gesendet wurde oder der Grosshändler die Funktion nicht kennt. */
const NICHT_GESENDET = new Set(['C-NICHT-FREIGEGEBEN', 'C-SCHLUESSEL', 'HTTP-404']);

export function ausAntwort(b: Bestellantwort): Ergebnis {
  const auftrag = b.auftrag[0];
  if (auftrag?.auftragsfehler) {
    return { status: 'abgelehnt', meldung: auftrag.auftragsfehler.endanwenderText, antwort: null };
  }
  return {
    status: 'bestaetigt',
    meldung: b.nachtbetrieb
      ? 'Nachtbetrieb: Der Grosshändler hat nur den Empfang bestätigt. Mengen und Touren meldet er nicht.'
      : null,
    antwort: {
      nachtbetrieb: b.nachtbetrieb,
      positionen: (auftrag?.position ?? []).map((p) => ({
        pzn: p.pzn,
        menge: p.menge,
        anteile: p.anteil,
      })),
    },
  };
}

export function ausFehler(f: {
  exceptiontyp: string;
  errorCode: string;
  endanwenderText: string;
}): Ergebnis {
  if (NICHT_AUSGEFUEHRT.has(f.exceptiontyp) || NICHT_GESENDET.has(f.errorCode)) {
    return { status: 'abgelehnt', meldung: f.endanwenderText, antwort: null };
  }
  return {
    status: 'unklar',
    meldung: `${f.endanwenderText} Ob die Bestellung angekommen ist, zeigt die Statusabfrage.`,
    antwort: null,
  };
}

export function ausStatus(s: Bestellstatusantwort): Ergebnis {
  if (s.status === 'BestellantwortVerfuegbar' && s.bestellung) return ausAntwort(s.bestellung);
  if (s.status === 'BestellantwortNichtVerfuegbar') {
    return {
      status: 'ohne_antwort',
      meldung:
        'Die Bestellung ist angekommen. Die Antwort gibt der Grosshändler nur am Tag der Bestellung heraus.',
      antwort: null,
    };
  }
  return {
    status: 'nicht_angekommen',
    meldung: 'Der Grosshändler kennt diese Bestellung nicht. Sie kann neu bestellt werden.',
    antwort: null,
  };
}

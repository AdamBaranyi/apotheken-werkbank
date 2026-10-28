import { describe, expect, it } from 'vitest';
import type { Bestellantwort } from '@/lib/msv3/schema';
import { ausAntwort, ausFehler, ausStatus } from './status';

const ANTWORT: Bestellantwort = {
  id: 'b',
  nachtbetrieb: false,
  auftrag: [
    {
      id: 'a',
      auftragsart: 'NORMAL',
      auftragskennung: 'NORMAL',
      position: [
        {
          pzn: '99101373',
          menge: 6,
          liefervorgabe: 'MaxVerbund',
          anteil: [
            { typ: 'Normal', menge: 3 },
            { typ: 'Verbund', menge: 3 },
          ],
        },
      ],
    },
  ],
};

describe('Status einer Bestellung', () => {
  it('eine Antwort mit Positionen heisst «bestätigt», die Anteile werden gespeichert', () => {
    expect(ausAntwort(ANTWORT)).toEqual({
      status: 'bestaetigt',
      meldung: null,
      antwort: {
        nachtbetrieb: false,
        positionen: [
          { pzn: '99101373', menge: 6, anteile: ANTWORT.auftrag[0]!.position[0]!.anteil },
        ],
      },
    });
  });

  it('ein Auftragsfehler heisst «abgelehnt», mit dem Text für Menschen', () => {
    const fehler = {
      ...ANTWORT,
      auftrag: [
        {
          ...ANTWORT.auftrag[0]!,
          position: [],
          auftragsfehler: {
            errorCode: 'A',
            endanwenderText: 'Nicht vereinbart.',
            technischerText: 't',
          },
        },
      ],
    };
    expect(ausAntwort(fehler)).toMatchObject({ status: 'abgelehnt', meldung: 'Nicht vereinbart.' });
  });

  it('Nachtbetrieb: bestätigt, aber mit Hinweis, dass Mengen und Touren fehlen', () => {
    const nachts = {
      ...ANTWORT,
      nachtbetrieb: true,
      auftrag: [{ ...ANTWORT.auftrag[0]!, position: [] }],
    };
    expect(ausAntwort(nachts)).toMatchObject({ status: 'bestaetigt' });
    expect(ausAntwort(nachts).meldung).toContain('Nachtbetrieb');
  });

  it('Fehler des Servers: nicht ausgeführt, also abgelehnt', () => {
    for (const exceptiontyp of [
      'ServerException',
      'AuthorizationException',
      'DenialOfServiceException',
      'ValidationException',
    ]) {
      const f = { exceptiontyp, errorCode: 'X', endanwenderText: 'Nein.' };
      expect(ausFehler(f).status, exceptiontyp).toBe('abgelehnt');
    }
  });

  it('nichts gesendet (nicht freigegeben, Schlüssel falsch): abgelehnt', () => {
    for (const errorCode of ['C-NICHT-FREIGEGEBEN', 'C-SCHLUESSEL', 'HTTP-404']) {
      const f = { exceptiontyp: 'ClientException', errorCode, endanwenderText: 'Nein.' };
      expect(ausFehler(f).status, errorCode).toBe('abgelehnt');
    }
  });

  it('Zeit abgelaufen, Netz weg oder Antwort unlesbar: unklar, mit Hinweis auf die Statusabfrage', () => {
    for (const [exceptiontyp, errorCode] of [
      ['TimeoutException', 'C-ZEIT'],
      ['ClientException', 'C-NETZ'],
      ['ClientException', 'C-SCHEMA'],
      ['ClientException', 'C-DTD'],
    ] as const) {
      const ergebnis = ausFehler({ exceptiontyp, errorCode, endanwenderText: 'Weg.' });
      expect(ergebnis.status, errorCode).toBe('unklar');
      expect(ergebnis.meldung).toContain('Status');
    }
  });

  it('Statusabfrage: verfügbar, nicht mehr verfügbar, unbekannt', () => {
    expect(ausStatus({ status: 'BestellantwortVerfuegbar', bestellung: ANTWORT }).status).toBe(
      'bestaetigt',
    );
    expect(ausStatus({ status: 'BestellantwortNichtVerfuegbar' }).status).toBe('ohne_antwort');
    expect(ausStatus({ status: 'KennungUnbekannt' }).status).toBe('nicht_angekommen');
  });

  it('«Antwort verfügbar» ohne Antwort: unklar, nicht «nicht angekommen»', () => {
    // Angekommen ist sie; «nicht angekommen» lüde zum zweiten Bestellen ein.
    const ergebnis = ausStatus({ status: 'BestellantwortVerfuegbar' });
    expect(ergebnis.status).toBe('unklar');
    expect(ergebnis.meldung).toContain('angekommen');
  });

  it('ein Fault ohne MSV3-Angaben heisst «unklar»: ob ausgeführt, weiss niemand', () => {
    const ergebnis = ausFehler({
      exceptiontyp: 'ClientException',
      errorCode: 'C-FAULT',
      endanwenderText: 'Der Grosshändler meldet einen Fehler ohne nähere Angaben.',
    });
    expect(ergebnis.status).toBe('unklar');
  });
});

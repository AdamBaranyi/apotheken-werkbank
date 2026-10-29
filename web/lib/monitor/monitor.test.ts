import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { berichtLesen, dauerText, fotoBytes, schrittText, STATUS_TEXT } from './texte';

// Ein echter Bericht der Engine (Fake-Treiber, geheilter Lauf), so wie
// PowerShell ihn als JSON schreibt.
const geheilt = JSON.parse(
  readFileSync(new URL('./bericht-geheilt.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;

describe('berichtLesen', () => {
  it('liest Schritte, Heilung, Dialog und Werte aus einem Bericht der Engine', () => {
    const b = berichtLesen(geheilt);
    expect(b?.schritte).toHaveLength(13);
    expect(b?.schritte[0]).toMatchObject({
      nr: '1',
      art: 'klicke',
      ziel: 'Bon leeren',
      versuche: 1,
    });
    expect(b?.heilungen[0]).toMatchObject({ aktion: 'klicke', ziel: 'OK', ergebnis: 'geholfen' });
    expect(b?.dialoge[0]).toMatchObject({ text: 'Neue Preisliste verfügbar', klick: 'Später' });
    expect(b?.werte).toEqual({ beleg: '1001' });
    expect(b?.fehler).toBeNull();
  });

  it('nimmt einen Abbruch mit Meldung', () => {
    const b = berichtLesen({
      ...geheilt,
      fehler: { schritt: '5.2.2', meldung: 'Eingabe nicht sichtbar', foto: 'C:\\x\\fehler.png' },
    });
    expect(b?.fehler).toEqual({ schritt: '5.2.2', meldung: 'Eingabe nicht sichtbar' });
  });

  it('lehnt einen Bericht ab, der nicht von der Engine stammt', () => {
    expect(berichtLesen({ schritte: [{ nr: 1 }] })).toBeNull();
    expect(berichtLesen('kaputt')).toBeNull();
  });
});

describe('Texte', () => {
  it('sagt jeden Status in Worten', () => {
    expect(STATUS_TEXT.unklar).toBe('Unklar, bitte prüfen');
    expect(STATUS_TEXT['bereits-gebucht']).toBe('Schon gebucht');
  });

  it('schreibt Dauer in Sekunden und Minuten', () => {
    expect(dauerText(4200)).toBe('4,2 s');
    expect(dauerText(65_000)).toBe('1 min 5 s');
  });

  it('beschreibt einen Schritt so, wie man ihn an der Kasse sagen würde', () => {
    expect(schrittText({ art: 'klicke', ziel: 'Bar' })).toBe('Klick auf «Bar»');
    expect(schrittText({ art: 'eingeben', ziel: 'PZN' })).toBe('Eingabe bei «PZN»');
    expect(schrittText({ art: 'taste', ziel: 'Enter' })).toBe('Taste Enter');
    expect(schrittText({ art: 'neu', ziel: 'x' })).toBe('neu «x»');
  });

  it('macht aus bytea in Hex wieder Bytes', () => {
    expect([...fotoBytes('\\x426f6e')]).toEqual([0x42, 0x6f, 0x6e]);
  });
});

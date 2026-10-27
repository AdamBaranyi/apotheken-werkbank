import { describe, expect, it } from 'vitest';
import type { BelegDaten } from './beleg-daten';
import { BREITE, belegZeilen } from './beleg-zeilen';

const BAR: BelegDaten = {
  id: '00000000-0000-4000-8000-000000000007',
  belegnummer: 7,
  apotheke: 'Apotheke am Nordtor (erfunden)',
  land: 'DE',
  waehrung: 'EUR',
  zahlart: 'bar',
  gegeben_cent: 1000,
  summe_cent: 790,
  rueckgeld_cent: 210,
  erstellt_am: '2026-10-27T13:32:00Z',
  storno_von: null,
  storniert_durch: null,
  positionen: [
    {
      nr: 1,
      pzn: '99100008',
      name: 'Probatin 400 mg Filmtabletten',
      packung: '20 St.',
      menge: 2,
      einzelpreis_cent: 395,
      satz_promille: 190,
      rezeptpflichtig: false,
      rezept_vorgelegt: false,
    },
  ],
  steuern: [{ satz_promille: 190, brutto_cent: 790, steuer_cent: 126 }],
};

const texte = (b: BelegDaten) => belegZeilen(b).map((z) => z.text);

describe('Beleg als Textzeilen', () => {
  it('keine Zeile ist breiter als die Rolle', () => {
    const lang: BelegDaten = {
      ...BAR,
      positionen: [{ ...BAR.positionen[0]!, name: 'Sehr lange Bezeichnung '.repeat(4) }],
    };
    for (const zeile of texte(lang)) expect(zeile.length, zeile).toBeLessThanOrEqual(BREITE);
  });

  it('Kopf mit Apotheke, Nummer und Zeit in Deutschland', () => {
    const t = texte(BAR);
    expect(t[0]?.trim()).toBe('Apotheke am Nordtor (erfunden)');
    expect(t).toContain(`Beleg 7${' '.repeat(BREITE - 7 - 17)}27.10.2026, 14:32`);
  });

  it('Position, Summe fett, Bargeld und Rückgeld rechtsbündig', () => {
    const zeilen = belegZeilen(BAR);
    const t = zeilen.map((z) => z.text);
    expect(t).toContain('2 × Probatin 400 mg Filmtabletten');
    expect(t.find((z) => z.startsWith('    20 St.'))).toMatch(/je 3,95 € +7,90 € A$/);
    const summe = zeilen.find((z) => z.text.startsWith('SUMME'));
    expect(summe).toEqual({ text: `SUMME${' '.repeat(BREITE - 5 - 6)}7,90 €`, fett: true });
    expect(t.some((z) => /^Rückgeld +2,10 €$/.test(z))).toBe(true);
  });

  it('Steuer je Satz mit Kennbuchstaben, Netto aus Brutto minus Steuer', () => {
    expect(texte(BAR)).toContain(
      `A ${'19 %'.padStart(7)}${'6,64 €'.padStart(11)}${'1,26 €'.padStart(11)}${'7,90 €'.padStart(11)}`,
    );
  });

  it('ein Storno sagt, zu welchem Beleg, und zahlt aus', () => {
    const storno: BelegDaten = {
      ...BAR,
      belegnummer: 8,
      gegeben_cent: null,
      rueckgeld_cent: null,
      summe_cent: -790,
      storno_von: { id: BAR.id, belegnummer: 7 },
      positionen: [{ ...BAR.positionen[0]!, menge: -2 }],
      steuern: [{ satz_promille: 190, brutto_cent: -790, steuer_cent: -126 }],
    };
    const t = texte(storno);
    expect(t).toContain('STORNO zu Beleg 7');
    expect(t.some((z) => /^Auszahlung bar +7,90 €$/.test(z))).toBe(true);
  });

  it('endet mit dem Hinweis, dass dies kein Beleg nach KassenSichV ist', () => {
    expect(texte(BAR).join(' ')).toContain('kein Beleg nach § 6 KassenSichV');
  });
});

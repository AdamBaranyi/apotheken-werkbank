import { describe, expect, it } from 'vitest';
import { pznAusEingabe, pznGueltig } from './pzn';

describe('PZN', () => {
  it('prüft die Prüfziffer (Modulo 11, Gewichte 1 bis 7)', () => {
    expect(pznGueltig('99100008')).toBe(true);
    expect(pznGueltig('99104118')).toBe(true);
    expect(pznGueltig('99100009')).toBe(false);
    expect(pznGueltig('9910000')).toBe(false);
  });

  it('nimmt die PZN aus einer Eingabe, auch aus dem Vorschlag mit Namen', () => {
    expect(pznAusEingabe('99100008')).toEqual({ pzn: '99100008' });
    expect(pznAusEingabe(' 99100008 Probatin 400 mg, 20 St.')).toEqual({ pzn: '99100008' });
  });

  it('meldet Tippfehler an der Prüfziffer und fehlende Ziffern verständlich', () => {
    expect(pznAusEingabe('99100009')).toEqual({
      fehler: 'Die Prüfziffer der PZN 99100009 stimmt nicht. Tippfehler?',
    });
    expect(pznAusEingabe('Probatin')).toEqual({
      fehler: 'Bitte eine PZN mit acht Ziffern eingeben.',
    });
  });
});

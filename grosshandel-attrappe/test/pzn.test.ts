import { describe, expect, it } from 'vitest';
import { istGueltigePzn, pruefzifferBerechnen } from '../src/fachlich/pzn.ts';

describe('PZN', () => {
  it('rechnet die Prüfziffer mit Gewichten 1 bis 7 modulo 11', () => {
    // 9·1 + 9·2 + 1·3 + 0·4 + 1·5 + 3·6 + 7·7 = 102; 102 mod 11 = 3
    expect(pruefzifferBerechnen('9910137')).toBe(3);
    // 1·1 + 7·7 = 50; 50 mod 11 = 6
    expect(pruefzifferBerechnen('1000007')).toBe(6);
  });

  it('vergibt keine Nummer, wenn der Rest 10 ist', () => {
    // 1·1 + 1·2 + 1·3 + 1·4 = 10
    expect(pruefzifferBerechnen('1111000')).toBeNull();
  });

  it('erkennt gültige und ungültige Nummern', () => {
    expect(istGueltigePzn('99101373')).toBe(true);
    expect(istGueltigePzn('99101374')).toBe(false);
    expect(istGueltigePzn('9910137')).toBe(false);
    expect(istGueltigePzn('9910137X')).toBe(false);
    expect(istGueltigePzn(' 99101373')).toBe(false);
  });
});

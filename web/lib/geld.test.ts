import { describe, expect, it } from 'vitest';
import { betragText, centAusEingabe, satzText } from './geld';

describe('Beträge', () => {
  it('zeigt Euro wie in Deutschland und Franken wie in der Schweiz', () => {
    expect(betragText(1250, 'EUR')).toBe('12,50 €');
    expect(betragText(-790, 'EUR')).toBe('-7,90 €');
    expect(betragText(123456, 'EUR')).toBe('1.234,56 €');
    expect(betragText(1250, 'CHF')).toBe('CHF 12.50');
  });

  it('liest Eingaben mit Komma oder Punkt als Cent', () => {
    expect(centAusEingabe('20')).toBe(2000);
    expect(centAusEingabe(' 20,5 ')).toBe(2050);
    expect(centAusEingabe('20,05')).toBe(2005);
    expect(centAusEingabe('0.99')).toBe(99);
  });

  it('weist Unklares ab, statt zu raten', () => {
    for (const falsch of ['', 'abc', '20,555', '1.234,56', '-5', '20,', '1e3', '100000,01']) {
      expect(centAusEingabe(falsch), falsch).toBeNull();
    }
  });

  it('schreibt Steuersätze mit Komma', () => {
    expect(satzText(190)).toBe('19 %');
    expect(satzText(26)).toBe('2,6 %');
  });
});

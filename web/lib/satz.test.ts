import { describe, expect, it } from 'vitest';
import { zusammenhalten } from './satz';

const NBSP = ' ';

describe('Zahl und Einheit zusammenhalten', () => {
  it('bindet eine Zahl an das folgende Wort', () => {
    expect(zusammenhalten('Fictolat Saft, 100 ml')).toBe(`Fictolat Saft, 100${NBSP}ml`);
    expect(zusammenhalten('5 Fertigspritzen')).toBe(`5${NBSP}Fertigspritzen`);
    expect(zusammenhalten('Probatin 400 mg Filmtabletten')).toBe(
      `Probatin 400${NBSP}mg Filmtabletten`,
    );
  });

  it('lässt Leerzeichen ohne Zahl davor stehen', () => {
    expect(zusammenhalten('Wundprobe Gel, 20 g')).toBe(`Wundprobe Gel, 20${NBSP}g`);
    expect(zusammenhalten('Lehrsalbe')).toBe('Lehrsalbe');
  });
});

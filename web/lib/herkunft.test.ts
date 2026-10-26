import { describe, expect, it } from 'vitest';
import { gleicheHerkunft } from './herkunft';

describe('Herkunft einer Anfrage', () => {
  it('nimmt die eigene Adresse an', () => {
    expect(gleicheHerkunft('https://werkbank.example', 'werkbank.example')).toBe(true);
  });

  it('weist eine fremde Adresse ab', () => {
    expect(gleicheHerkunft('https://fremd.example', 'werkbank.example')).toBe(false);
  });

  it('weist «null» und Unlesbares ab, ohne abzustürzen', () => {
    expect(gleicheHerkunft('null', 'werkbank.example')).toBe(false);
    expect(gleicheHerkunft('::', 'werkbank.example')).toBe(false);
  });

  it('lässt Anfragen ohne Origin durch: Ohne Browser gibt es keine fremden Cookies', () => {
    expect(gleicheHerkunft(null, 'werkbank.example')).toBe(true);
  });
});

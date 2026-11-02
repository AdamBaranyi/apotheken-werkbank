import { describe, expect, it } from 'vitest';
import { ABSTAND, lageBerechnen, RAND, rollweg } from './lage';

const FENSTER = { breite: 1440, hoehe: 900 };
const KARTE = { breite: 384, hoehe: 240 };

describe('Lage der Rundgang-Karte', () => {
  it('steht ohne Element in der Mitte des Fensters', () => {
    expect(lageBerechnen(null, KARTE, FENSTER)).toEqual({
      art: 'frei',
      oben: 330,
      links: 528,
      zeiger: 0,
    });
  });

  it('steht unter dem Element, mittig, und zeigt auf seine Mitte', () => {
    const knopf = { oben: 300, links: 600, breite: 200, hoehe: 48 };
    expect(lageBerechnen(knopf, KARTE, FENSTER)).toEqual({
      art: 'unten',
      oben: 348 + ABSTAND,
      links: 508,
      zeiger: 192,
    });
  });

  it('steht über dem Element, wenn darunter kein Platz ist', () => {
    const knopf = { oben: 760, links: 600, breite: 200, hoehe: 48 };
    expect(lageBerechnen(knopf, KARTE, FENSTER)).toMatchObject({
      art: 'oben',
      oben: 760 - ABSTAND - 240,
    });
  });

  it('bleibt im Fenster, wenn das Element am Rand steht; der Zeiger folgt dem Element', () => {
    const feld = { oben: 200, links: 24, breite: 120, hoehe: 48 };
    const lage = lageBerechnen(feld, KARTE, FENSTER);
    expect(lage.links).toBe(RAND);
    expect(lage.zeiger).toBe(84 - RAND);
  });

  it('liegt bei einem zu hohen Element unten rechts im Fenster; dessen Anfang bleibt frei', () => {
    const tabelle = { oben: 25, links: 177, breite: 1086, hoehe: 1400 };
    expect(lageBerechnen(tabelle, KARTE, FENSTER)).toEqual({
      art: 'frei',
      oben: 900 - RAND - 240,
      links: 177 + 1086 - 384,
      zeiger: 0,
    });
  });

  it('nimmt schmal die ganze Breite abzüglich Rand', () => {
    const schmal = { breite: 320, hoehe: 720 };
    const karte = { breite: 288, hoehe: 330 };
    const pzn = { oben: 180, links: 16, breite: 288, hoehe: 48 };
    expect(lageBerechnen(pzn, karte, schmal)).toMatchObject({ art: 'unten', links: RAND });
  });
});

describe('Rollweg zum Element', () => {
  it('stellt Element und Karte zusammen in die Mitte des Fensters', () => {
    const tabelle = { oben: 1200, links: 177, breite: 1086, hoehe: 400 };
    const block = 400 + ABSTAND + 240;
    expect(rollweg(tabelle, KARTE, FENSTER)).toBe(1200 - (900 - block) / 2);
  });

  it('stellt ein zu hohes Element mit seinem Anfang oben ins Fenster', () => {
    const tabelle = { oben: 1200, links: 177, breite: 1086, hoehe: 1400 };
    expect(rollweg(tabelle, KARTE, FENSTER)).toBeLessThan(1200);
    expect(1200 - rollweg(tabelle, KARTE, FENSTER)).toBeLessThanOrEqual(2 * RAND);
  });
});

import { describe, expect, it } from 'vitest';
import { pdfBauen, winAnsi } from './pdf';

/*
 * Der PDF-Schreiber für Belege, geprüft am Aufbau der Datei: Jeder Eintrag im
 * Verzeichnis (xref) muss genau auf sein Objekt zeigen, sonst müssen
 * Programme die Datei reparieren oder lehnen sie ab.
 */
const text = (bytes: Uint8Array) => Buffer.from(bytes).toString('latin1');

function beispiel(zeilen = [{ text: 'Beleg 7' }, { text: 'Summe 7,90 €', fett: true }]) {
  return text(pdfBauen({ titel: 'Beleg 7', breitePt: 226.8, zeilen }));
}

describe('PDF für Belege', () => {
  it('beginnt mit der Kennung und endet mit %%EOF', () => {
    const pdf = beispiel();
    expect(pdf.startsWith('%PDF-1.7\n')).toBe(true);
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('jeder Eintrag im Verzeichnis zeigt auf sein Objekt, startxref auf das Verzeichnis', () => {
    const pdf = beispiel();
    const start = Number(/startxref\n(\d+)\n%%EOF/.exec(pdf)?.[1]);
    expect(pdf.slice(start, start + 4)).toBe('xref');
    const eintraege = [...pdf.slice(start).matchAll(/^(\d{10}) 00000 n \n/gm)].map((m) =>
      Number(m[1]),
    );
    expect(eintraege.length).toBeGreaterThanOrEqual(6);
    eintraege.forEach((versatz, i) => {
      expect(pdf.slice(versatz, versatz + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`);
    });
  });

  it('die Länge des Inhalts stimmt aufs Byte', () => {
    const pdf = beispiel();
    const treffer = /<< \/Length (\d+) >>\nstream\n/.exec(pdf);
    const beginn = (treffer?.index ?? 0) + (treffer?.[0].length ?? 0);
    expect(pdf.slice(beginn + Number(treffer?.[1]), beginn + Number(treffer?.[1]) + 10)).toBe(
      '\nendstream',
    );
  });

  it('Klammern und Rückstriche im Text können keine Befehle einschleusen', () => {
    const pdf = beispiel([{ text: 'x) Tj (eingeschleust\\' }]);
    expect(pdf).toContain('(x\\) Tj \\(eingeschleust\\\\) Tj');
  });

  it('Umlaute, ß und € gehen als WinAnsi, alles andere als Fragezeichen', () => {
    expect([...winAnsi('äöüß€–«»')]).toEqual([0xe4, 0xf6, 0xfc, 0xdf, 0x80, 0x96, 0xab, 0xbb]);
    expect([...winAnsi('→ẞ')]).toEqual([0x3f, 0x3f]);
    // Im Inhalt als Oktalfolge: Die Datei bleibt reines ASCII, Versätze bleiben Byte-genau.
    expect(beispiel([{ text: 'Grüße' }])).toContain('(Gr\\374\\337e) Tj');
  });

  it('die Seite wächst mit der Zahl der Zeilen', () => {
    const hoehe = (n: number) =>
      Number(
        /\/MediaBox \[0 0 [\d.]+ ([\d.]+)\]/.exec(
          beispiel(Array.from({ length: n }, (_, i) => ({ text: `Zeile ${i}` }))),
        )?.[1],
      );
    expect(hoehe(40)).toBeGreaterThan(hoehe(10));
  });
});

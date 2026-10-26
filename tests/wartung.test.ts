import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * Eine Wartungsliste, die Skripte nennt, die es nicht gibt, wird abgehakt,
 * ohne dass etwas passiert (in einem Schwesterprojekt am 25.10.2026 gefunden).
 * Darum muss jeder Pfad in Backticks, den die monatliche Erinnerung nennt,
 * im Repository existieren.
 */
const ERINNERUNG = '.github/workflows/erinnerung-monatlich.yml';

function genanntePfade(): string[] {
  const text = readFileSync(ERINNERUNG, 'utf8');
  const treffer = [...text.matchAll(/`([\w./-]+\/[\w.-]+\.\w+)`/g)].map(([, pfad]) => pfad ?? '');
  return [...new Set(treffer)];
}

describe('monatliche Erinnerung', () => {
  it('nennt mindestens einen Pfad, sonst prüft dieser Test nichts', () => {
    expect(genanntePfade().length).toBeGreaterThan(0);
  });

  it('jeder genannte Pfad existiert', () => {
    for (const pfad of genanntePfade()) expect(existsSync(pfad), pfad).toBe(true);
  });
});

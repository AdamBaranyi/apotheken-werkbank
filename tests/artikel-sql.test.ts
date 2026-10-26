import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error – Skript in JavaScript ohne Typen
import { MIGRATION, artikelSql } from '../scripts/artikel-sql.mjs';

/*
 * daten/artikel.json ist die eine Quelle für Grosshandel und Web-App. Die
 * Migration ist daraus erzeugt; ändert jemand die Datei ohne neu zu erzeugen,
 * wird dieser Test rot.
 */
describe('Artikel-Migration', () => {
  it('stimmt mit daten/artikel.json überein', () => {
    const daten = JSON.parse(readFileSync('daten/artikel.json', 'utf8'));
    expect(readFileSync(MIGRATION as string, 'utf8')).toBe(
      (artikelSql as (d: unknown) => string)(daten),
    );
  });
});

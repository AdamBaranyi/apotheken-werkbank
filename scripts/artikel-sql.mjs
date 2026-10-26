#!/usr/bin/env node
/**
 * Erzeugt die Migration für den Artikelkatalog aus daten/artikel.json – der
 * einen Quelle für Grosshandel und Web-App. tests/artikel-sql.test.ts hält die
 * Datei mit der Quelle gleich.
 *
 * Aufruf: node scripts/artikel-sql.mjs   (schreibt die Migration neu)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const MIGRATION = 'supabase/migrations/20261026160100_artikel.sql';

function text(wert) {
  return `'${String(wert).replaceAll("'", "''")}'`;
}

export function artikelSql(daten) {
  const zeilen = daten.artikel.map(
    (a) =>
      `  (${text(a.pzn)}, ${text(a.name)}, ${text(a.packung)}, ${a.rezeptpflichtig}, ` +
      `${text(a.mwst)}, ${Number(a.preisCent)})`,
  );
  return (
    '-- Erzeugt von scripts/artikel-sql.mjs aus daten/artikel.json. Nicht von Hand ändern.\n' +
    '-- Alle Artikel sind erfunden.\n' +
    'insert into public.artikel (pzn, name, packung, rezeptpflichtig, mwst_kategorie, preis_cent)\nvalues\n' +
    zeilen.join(',\n') +
    '\non conflict (pzn) do update set name = excluded.name, packung = excluded.packung,\n' +
    '  rezeptpflichtig = excluded.rezeptpflichtig, mwst_kategorie = excluded.mwst_kategorie,\n' +
    '  preis_cent = excluded.preis_cent;\n'
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const daten = JSON.parse(readFileSync('daten/artikel.json', 'utf8'));
  writeFileSync(MIGRATION, artikelSql(daten));
  console.log(`${MIGRATION} geschrieben (${daten.artikel.length} Artikel).`);
}

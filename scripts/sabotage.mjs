#!/usr/bin/env node
/**
 * Sabotage-Runde: Jede Schutzfunktion wird einmal absichtlich kaputt gemacht,
 * der zugehörige Test muss rot werden. Danach wird die Datei Byte für Byte
 * zurückgesetzt. Ein Eintrag, dessen Suchtext nicht mehr passt, zählt als
 * Fehler – sonst veraltet die Liste still.
 *
 * Aufruf: node scripts/sabotage.mjs        (Code, ohne Datenbank)
 *         node scripts/sabotage.mjs db     (Datenbankregeln; braucht `supabase start`)
 * Exit 0 nur, wenn alle Sabotagen gefangen wurden.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { SABOTAGEN } from './sabotagen.mjs';
import { SABOTAGEN_DB } from './sabotagen-db.mjs';

const liste = process.argv[2] === 'db' ? SABOTAGEN_DB : SABOTAGEN;

function ausfuehren(befehl) {
  if (!befehl) return;
  const lauf = spawnSync('sh', ['-c', befehl], { encoding: 'utf8' });
  if (lauf.status !== 0) throw new Error(`Vorbereitung gescheitert: ${befehl}\n${lauf.stderr}`);
}

function pruefen(s) {
  const konfig = s.konfig ? ['-c', s.konfig] : [];
  return spawnSync('bunx', ['vitest', 'run', ...konfig, ...s.tests], { encoding: 'utf8' });
}

let fehler = 0;
for (const s of liste) {
  const original = readFileSync(s.datei, 'utf8');
  if (!original.includes(s.suche)) {
    console.error(`VERALTET  ${s.name}: Suchtext nicht in ${s.datei}`);
    fehler++;
    continue;
  }
  writeFileSync(s.datei, original.replace(s.suche, s.ersatz));
  let lauf;
  try {
    ausfuehren(s.vorbereiten);
    lauf = pruefen(s);
  } finally {
    writeFileSync(s.datei, original);
    ausfuehren(s.vorbereiten);
  }
  if (readFileSync(s.datei, 'utf8') !== original) {
    throw new Error(`Rückbau gescheitert: ${s.datei}`);
  }
  const rot = lauf.status !== 0;
  console.log(`${rot ? 'GEFANGEN ' : 'ÜBERSEHEN'} ${s.name}`);
  if (!rot) fehler++;
}
console.log(`\n${liste.length - fehler} von ${liste.length} Sabotagen gefangen.`);
process.exit(fehler === 0 ? 0 : 1);

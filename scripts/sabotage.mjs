#!/usr/bin/env node
/**
 * Sabotage-Runde: Jede Schutzfunktion wird einmal absichtlich kaputt gemacht,
 * der zugehörige Test muss rot werden. Danach wird die Datei Byte für Byte
 * zurückgesetzt. Ein Eintrag, dessen Suchtext nicht mehr passt, zählt als
 * Fehler – sonst veraltet die Liste still.
 *
 * Aufruf: node scripts/sabotage.mjs   (Exit 0 nur, wenn alle Sabotagen gefangen wurden)
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { SABOTAGEN } from './sabotagen.mjs';

let fehler = 0;
for (const s of SABOTAGEN) {
  const original = readFileSync(s.datei, 'utf8');
  if (!original.includes(s.suche)) {
    console.error(`VERALTET  ${s.name}: Suchtext nicht in ${s.datei}`);
    fehler++;
    continue;
  }
  writeFileSync(s.datei, original.replace(s.suche, s.ersatz));
  const lauf = spawnSync('bunx', ['vitest', 'run', ...s.tests], { encoding: 'utf8' });
  writeFileSync(s.datei, original);
  if (readFileSync(s.datei, 'utf8') !== original)
    throw new Error(`Rückbau gescheitert: ${s.datei}`);
  const rot = lauf.status !== 0;
  console.log(`${rot ? 'GEFANGEN ' : 'ÜBERSEHEN'} ${s.name}`);
  if (!rot) fehler++;
}
console.log(`\n${SABOTAGEN.length - fehler} von ${SABOTAGEN.length} Sabotagen gefangen.`);
process.exit(fehler === 0 ? 0 : 1);

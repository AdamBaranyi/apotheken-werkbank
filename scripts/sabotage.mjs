#!/usr/bin/env node
/**
 * Sabotage-Runde: Jede Schutzfunktion wird einmal absichtlich kaputt gemacht,
 * der zugehörige Test muss rot werden. Danach wird die Datei Byte für Byte
 * zurückgesetzt. Ein Eintrag, dessen Suchtext nicht mehr passt, zählt als
 * Fehler – sonst veraltet die Liste still.
 *
 * Aufruf: node scripts/sabotage.mjs         (Code, ohne Datenbank)
 *         node scripts/sabotage.mjs db      (Datenbankregeln; braucht `supabase start`)
 *         node scripts/sabotage.mjs engine  (Engine und Kassen-Attrappe; braucht pwsh und Pester)
 * Exit 0 nur, wenn alle Sabotagen gefangen wurden.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { SABOTAGEN } from './sabotagen.mjs';
import { SABOTAGEN_DB } from './sabotagen-db.mjs';
import { SABOTAGEN_ENGINE } from './sabotagen-engine.mjs';

const LISTEN = { db: SABOTAGEN_DB, engine: SABOTAGEN_ENGINE };
const liste = LISTEN[process.argv[2]] ?? SABOTAGEN;

function ausfuehren(befehl) {
  if (!befehl) return;
  const lauf = spawnSync('sh', ['-c', befehl], { encoding: 'utf8' });
  if (lauf.status !== 0) throw new Error(`Vorbereitung gescheitert: ${befehl}\n${lauf.stderr}`);
}

function pruefen(s) {
  if (s.pester) {
    // Pfade und Namen sind feste Werte aus der Liste, ohne Anführungszeichen.
    const pfade = s.tests.map((t) => `'${t}'`).join(', ');
    const namen = s.nur ? ` -Name ${s.nur.map((n) => `'*${n}*'`).join(', ')}` : '';
    const befehl = `& ./engine/tests/pester.ps1 -Pfad ${pfade}${namen}`;
    return spawnSync('pwsh', ['-NoProfile', '-Command', befehl], { encoding: 'utf8' });
  }
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
  // Als Funktion: Ein Ersatztext als Zeichenkette deutet «$$» als «$» und
  // zerstörte so jedes SQL mit Dollar-Quoting.
  writeFileSync(
    s.datei,
    original.replace(s.suche, () => s.ersatz),
  );
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
  // Ein Name ohne passenden Test lässt Pester grün enden: kein Fang, sondern ein Tippfehler.
  const leer = !rot && s.nur && /Tests Passed: 0, Failed: 0/.test(lauf.stdout);
  console.log(`${rot ? 'GEFANGEN ' : leer ? 'KEIN TEST' : 'ÜBERSEHEN'} ${s.name}`);
  if (!rot) fehler++;
}
console.log(`\n${liste.length - fehler} von ${liste.length} Sabotagen gefangen.`);
process.exit(fehler === 0 ? 0 : 1);

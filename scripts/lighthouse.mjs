#!/usr/bin/env node
/**
 * Lighthouse gegen den Produktionsbuild, angemeldet mit der Sitzung der
 * Browser-Tests (web/e2e/.auth/inhaber.json). Hart geprüft werden
 * Barrierefreiheit und gute Praxis ab 95: Sie hängen nicht vom Rechner ab.
 * Die Leistung schwankt auf geteilten Läufern stark; sie steht im Protokoll,
 * zusammen mit dem Leistungsindex des Rechners, und zählt hart nur mit
 * --streng (lokal, auf ruhigem Rechner, Median aus drei Messungen).
 * SEO fehlt bewusst: Die Werkbank ist ein Werkzeug hinter einer Anmeldung und
 * sagt Suchmaschinen «noindex».
 *
 * Lighthouse läuft über npx mit fester Fassung (Unterpakete ohne Lockfile, im
 * CI-Lauf ohne Geheimnisse; docs/SECURITY.md).
 *
 * Vorher: bun run test:e2e (Build und Sitzung). Aufruf: node scripts/lighthouse.mjs [--streng]
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const STRENG = process.argv.includes('--streng');
const GRENZE = 0.95;
const BASIS = 'http://localhost:3502';
const LIGHTHOUSE = 'lighthouse@13.5.0';
const SEITEN = [
  { pfad: '/anmelden', angemeldet: false },
  { pfad: '/kasse', angemeldet: true },
  { pfad: '/kasse/belege', angemeldet: true },
  { pfad: '/kasse/abschluss', angemeldet: true },
  { pfad: '/bestellen', angemeldet: true },
  { pfad: '/bestellungen', angemeldet: true },
  { pfad: '/monitor', angemeldet: true },
];
const KATEGORIEN = ['accessibility', 'best-practices', 'performance'];

function cookieKopf() {
  const zustand = JSON.parse(readFileSync('web/e2e/.auth/inhaber.json', 'utf8'));
  return zustand.cookies
    .filter((c) => c.domain === 'localhost')
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
}

async function bereit(url) {
  for (let i = 0; i < 120; i++) {
    const ok = await fetch(url, { redirect: 'manual' }).then(
      (a) => a.status < 500,
      () => false,
    );
    if (ok) return;
    await new Promise((weiter) => setTimeout(weiter, 500));
  }
  throw new Error(`Nicht bereit: ${url}`);
}

function messen(seite, ordner, versuch, cookie) {
  const bericht = join(ordner, `${seite.pfad.replaceAll('/', '_')}-${versuch}.json`);
  const argumente = [
    '-y',
    LIGHTHOUSE,
    `${BASIS}${seite.pfad}`,
    '--quiet',
    '--output=json',
    `--output-path=${bericht}`,
    `--only-categories=${KATEGORIEN.join(',')}`,
    '--chrome-flags=--headless=new',
  ];
  if (seite.angemeldet) argumente.push(`--extra-headers=${JSON.stringify({ Cookie: cookie })}`);
  // Lighthouse bricht gelegentlich ab, ohne dass die Seite schuld ist
  // («NO_NAVSTART … Please run Lighthouse again»). Dann bis zu zweimal neu;
  // die Punkte prüft erst der gelungene Lauf.
  let lauf = spawnSync('npx', argumente, { stdio: ['ignore', 'ignore', 'inherit'] });
  for (let neu = 1; neu <= 2 && lauf.status !== 0; neu++) {
    console.error(`neu      ${seite.pfad}: Lighthouse brach ab, Versuch ${neu + 1} von 3`);
    lauf = spawnSync('npx', argumente, { stdio: ['ignore', 'ignore', 'inherit'] });
  }
  if (lauf.status !== 0) throw new Error(`Lighthouse scheiterte für ${seite.pfad}`);
  const { categories, environment, finalDisplayedUrl } = JSON.parse(readFileSync(bericht, 'utf8'));
  if (!finalDisplayedUrl.endsWith(seite.pfad)) {
    throw new Error(`${seite.pfad} leitete um nach ${finalDisplayedUrl}: Sitzung abgelaufen?`);
  }
  return {
    ...Object.fromEntries(KATEGORIEN.map((k) => [k, Math.round(categories[k].score * 100)])),
    index: Math.round(environment.benchmarkIndex),
  };
}

const attrappe = spawn('node', ['src/start.ts'], {
  cwd: 'grosshandel-attrappe',
  env: { ...process.env, MANDANTEN_DATEI: '../.lokal/mandanten.json', NACHTBETRIEB: 'nie' },
  stdio: 'ignore',
});
const app = spawn('./node_modules/.bin/next', ['start', '--port', '3502'], {
  cwd: 'web',
  stdio: 'ignore',
});

let fehler = 0;
try {
  await bereit('http://127.0.0.1:3501/gesundheit');
  await bereit(`${BASIS}/anmelden`);
  const cookie = cookieKopf();
  const ordner = mkdtempSync(join(tmpdir(), 'lighthouse-'));
  for (const seite of SEITEN) {
    const laeufe = Array.from({ length: STRENG ? 3 : 1 }, (_, i) =>
      messen(seite, ordner, i, cookie),
    );
    laeufe.sort((a, b) => a.performance - b.performance);
    const mitte = laeufe[Math.floor(laeufe.length / 2)];
    const hart = STRENG ? KATEGORIEN : KATEGORIEN.filter((k) => k !== 'performance');
    const zuTief = hart.filter((k) => mitte[k] < GRENZE * 100);
    console.log(
      `${zuTief.length ? 'ZU TIEF ' : 'ok      '} ${seite.pfad.padEnd(18)}`,
      KATEGORIEN.map((k) => `${k} ${mitte[k]}`).join(', '),
      `(Leistung ${laeufe.map((l) => l.performance).join('/')}, Index ${laeufe.map((l) => l.index).join('/')})`,
    );
    fehler += zuTief.length;
  }
} finally {
  attrappe.kill();
  app.kill();
}
if (fehler > 0) {
  console.error(`\n${fehler} Werte unter ${GRENZE * 100}.`);
  process.exit(1);
}

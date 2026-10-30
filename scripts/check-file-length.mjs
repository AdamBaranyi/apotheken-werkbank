#!/usr/bin/env node
/**
 * Projektregel: keine projekteigene Code-Datei über 400 physische Zeilen.
 *
 * Zählweise: physische Zeilen einschliesslich Leerzeilen und Kommentaren.
 * Ein einzelner abschliessender Zeilenumbruch erzeugt keine zusätzliche Zeile.
 *
 * Findet auch neue, noch nicht eingecheckte Dateien, weil das Dateisystem
 * durchlaufen wird und nicht der Git-Index.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_LINES = 400;
const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Verzeichnisse, die nie projekteigenen Code enthalten. */
const SKIPPED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.turbo',
  '.next',
  'test-results',
  'playwright-report',
]);

/**
 * Dokumentierte Ausschlüsse: reine Daten-Fixtures sind kein handgeschriebener
 * Code. Die Ausnahme erlaubt nicht, eigene Logik dorthin zu verschieben.
 */
const EXCLUDED_PATHS = ['tests/fixtures/'];

const CODE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.css',
  '.sql',
  '.yml',
  '.yaml',
  '.sh',
  '.ps1',
  '.psm1',
  '.psd1',
  '.cs',
  '.wsdl',
  '.xsd',
]);

/** Dateien ohne aussagekräftige Endung, die trotzdem Code sind. */
const CODE_FILENAMES = [/^Dockerfile(\..+)?$/, /^Caddyfile(\..+)?$/];

/**
 * @param {string} relPath Pfad relativ zum Repository-Wurzelverzeichnis.
 * @returns {boolean}
 */
function isExcluded(relPath) {
  const posix = relPath.split(sep).join('/');
  return EXCLUDED_PATHS.some((prefix) => posix.startsWith(prefix));
}

/**
 * @param {string} name Dateiname ohne Pfad.
 * @returns {boolean}
 */
function isCodeFile(name) {
  const dot = name.lastIndexOf('.');
  const ext = dot === -1 ? '' : name.slice(dot);
  if (CODE_EXTENSIONS.has(ext)) return true;
  return CODE_FILENAMES.some((pattern) => pattern.test(name));
}

/**
 * Zählt physische Zeilen. Genau ein abschliessender Zeilenumbruch wird nicht
 * als weitere Zeile gewertet, jeder weitere schon.
 *
 * @param {string} content
 * @returns {number}
 */
export function countLines(content) {
  if (content === '') return 0;
  const parts = content.split('\n');
  if (parts[parts.length - 1] === '') parts.pop();
  return parts.length;
}

/**
 * @param {string} dir Absoluter Pfad.
 * @param {string[]} out Sammler für gefundene Dateien.
 */
function walk(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIPPED_DIRS.has(entry.name)) continue;
      walk(join(dir, entry.name), out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!isCodeFile(entry.name)) continue;
    const absolute = join(dir, entry.name);
    const relPath = relative(ROOT, absolute);
    if (isExcluded(relPath)) continue;
    out.push(absolute);
  }
}

function main() {
  /** @type {string[]} */
  const files = [];
  walk(ROOT, files);
  files.sort();

  /** @type {{ path: string, lines: number }[]} */
  const violations = [];
  /** @type {{ path: string, reason: string }[]} */
  const unreadable = [];

  for (const absolute of files) {
    const relPath = relative(ROOT, absolute).split(sep).join('/');
    let content;
    try {
      content = readFileSync(absolute, 'utf8');
    } catch (error) {
      // Nicht lesbare Dateien werden nicht still übersprungen.
      unreadable.push({ path: relPath, reason: String(error) });
      continue;
    }
    const lines = countLines(content);
    if (lines > MAX_LINES) violations.push({ path: relPath, lines });
  }

  if (unreadable.length > 0) {
    console.error(`Nicht lesbar (${unreadable.length}):`);
    for (const item of unreadable) console.error(`  ${item.path} — ${item.reason}`);
  }

  if (violations.length > 0) {
    console.error(`\nÜber der Grenze von ${MAX_LINES} Zeilen (${violations.length}):\n`);
    for (const item of violations) {
      console.error(`  ${item.path}:1  ${item.lines} Zeilen  (+${item.lines - MAX_LINES})`);
    }
    console.error('\nTeile diese Dateien fachlich auf: je Aufgabe eine Datei.');
    process.exit(1);
  }

  if (unreadable.length > 0) process.exit(1);

  const longest = files.reduce(
    (acc, absolute) => {
      const lines = countLines(readFileSync(absolute, 'utf8'));
      return lines > acc.lines ? { path: relative(ROOT, absolute), lines } : acc;
    },
    { path: '—', lines: 0 },
  );

  console.log(
    `check:file-length ok — ${files.length} Dateien geprüft, ` +
      `längste ${longest.path} mit ${longest.lines} Zeilen (Grenze ${MAX_LINES}).`,
  );
}

// Nur ausführen, wenn direkt aufgerufen — der Test importiert countLines.
if (process.argv[1] && statSync(process.argv[1]).isFile()) {
  const invoked = relative(ROOT, process.argv[1]).split(sep).join('/');
  if (invoked === 'scripts/check-file-length.mjs') main();
}

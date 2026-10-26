import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

/*
 * Die Prüfung der Dateilänge wird selbst geprüft: in einem leeren Ordner mit
 * einer Kopie des Skripts und genau einer Datei an der Grenze. Ein Prüfskript,
 * das bei einer zu langen Datei mit 0 endet, wäre schlimmer als keines.
 */
let ordner = '';
afterEach(() => rmSync(ordner, { recursive: true, force: true }));

function pruefen(dateiname: string, zeilen: number): number | null {
  ordner = mkdtempSync(join(tmpdir(), 'werkbank-laenge-'));
  mkdirSync(join(ordner, 'scripts'));
  copyFileSync('scripts/check-file-length.mjs', join(ordner, 'scripts/check-file-length.mjs'));
  writeFileSync(join(ordner, dateiname), 'x\n'.repeat(zeilen));
  return spawnSync('node', ['scripts/check-file-length.mjs'], { cwd: ordner }).status;
}

describe('scripts/check-file-length.mjs', () => {
  it('lässt 400 Zeilen durch', () => {
    expect(pruefen('kurz.ts', 400)).toBe(0);
  });

  it('weist 401 Zeilen ab', () => {
    expect(pruefen('lang.ts', 401)).toBe(1);
  });

  it('prüft auch PowerShell', () => {
    expect(pruefen('lang.psm1', 401)).toBe(1);
  });

  it('prüft auch Workflows', () => {
    expect(pruefen('lang.yml', 401)).toBe(1);
  });
});

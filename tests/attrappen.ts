import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/*
 * Shell-Skripte werden im Ablauf geprüft, nicht an ihrem Text: Fremde
 * Programme (bun, gh) ersetzt eine kleine Attrappe vorn auf PATH. Jede
 * Attrappe schreibt ihre Aufrufe in die Datei `aufrufe`; ein Aufruf, den sie
 * nicht kennt, landet in `unbekannt` — sonst liefen Skript und Attrappe still
 * auseinander.
 */

export function attrappenOrdner(programme: Record<string, string>): string {
  const ordner = mkdtempSync(join(tmpdir(), 'werkbank-attrappe-'));
  for (const [name, inhalt] of Object.entries(programme)) {
    const pfad = join(ordner, name);
    writeFileSync(pfad, inhalt);
    chmodSync(pfad, 0o755);
  }
  return ordner;
}

export function ordnerEntfernen(ordner: string): void {
  rmSync(ordner, { recursive: true, force: true });
}

export function skriptAusfuehren(
  skript: string,
  argumente: string[],
  ordner: string,
  umgebung: Record<string, string> = {},
  shell = 'bash',
): { code: number | null; ausgabe: string } {
  const ergebnis = spawnSync(shell, [skript, ...argumente], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${ordner}:${process.env.PATH}`,
      ATTRAPPE_DIR: ordner,
      ...umgebung,
    },
  });
  return { code: ergebnis.status, ausgabe: `${ergebnis.stdout}${ergebnis.stderr}` };
}

export function aufrufe(ordner: string): string[] {
  return zeilen(join(ordner, 'aufrufe'));
}

export function unbekannteAufrufe(ordner: string): string[] {
  return zeilen(join(ordner, 'unbekannt'));
}

export function lesen(ordner: string, datei: string): string {
  const pfad = join(ordner, datei);
  return existsSync(pfad) ? readFileSync(pfad, 'utf8') : '';
}

function zeilen(pfad: string): string[] {
  if (!existsSync(pfad)) return [];
  return readFileSync(pfad, 'utf8').split('\n').filter(Boolean);
}

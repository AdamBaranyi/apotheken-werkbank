import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { attrappenOrdner, aufrufe, ordnerEntfernen, skriptAusfuehren } from './attrappen';

/*
 * scripts/audit.sh ist die eine Stelle für Stufe und Ausnahmen: Die CI ruft
 * es mit «high» auf und blockiert, der tägliche Lauf mit «moderate» und
 * meldet. Die Attrappe für bun schreibt die Argumente mit und endet mit dem
 * Code aus ATTRAPPE_EXIT.
 */
const BUN = `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$ATTRAPPE_DIR/aufrufe"
exit "\${ATTRAPPE_EXIT:-0}"
`;

function ausnahmen(): string[] {
  const skript = existsSync('scripts/audit.sh') ? readFileSync('scripts/audit.sh', 'utf8') : '';
  return [...skript.matchAll(/^\s*--ignore (GHSA-[a-z0-9-]+)/gm)].map(([, nummer]) => nummer ?? '');
}

let ordner = '';
afterEach(() => ordnerEntfernen(ordner));

describe('scripts/audit.sh', () => {
  it('gibt die Stufe an bun audit weiter, mit allen Ausnahmen', () => {
    ordner = attrappenOrdner({ bun: BUN });
    const { code } = skriptAusfuehren('scripts/audit.sh', ['moderate'], ordner);

    expect(code).toBe(0);
    const [aufruf = ''] = aufrufe(ordner);
    expect(aufruf).toMatch(/^audit --audit-level=moderate( |$)/);
    for (const nummer of ausnahmen()) expect(aufruf).toContain(`--ignore ${nummer}`);
  });

  it('prüft ohne Angabe ab high', () => {
    ordner = attrappenOrdner({ bun: BUN });
    skriptAusfuehren('scripts/audit.sh', [], ordner);

    expect(aufrufe(ordner)[0]).toMatch(/^audit --audit-level=high( |$)/);
  });

  it('bricht bei einer unbekannten Stufe ab, statt still schwächer zu prüfen', () => {
    ordner = attrappenOrdner({ bun: BUN });
    const { code, ausgabe } = skriptAusfuehren('scripts/audit.sh', ['hihg'], ordner);

    expect(code).toBe(2);
    expect(ausgabe).toContain('Unbekannte Stufe');
    expect(aufrufe(ordner)).toEqual([]);
  });

  it('lässt den Exit-Code von bun audit durch, damit die CI blockiert', () => {
    ordner = attrappenOrdner({ bun: BUN });
    const { code } = skriptAusfuehren('scripts/audit.sh', ['high'], ordner, { ATTRAPPE_EXIT: '1' });

    expect(code).toBe(1);
  });

  it('läuft ohne Ausnahmen, auch mit bash 3.2 von macOS', () => {
    ordner = attrappenOrdner({ bun: BUN });
    const kopie = join(ordner, 'audit-ohne-ausnahmen.sh');
    const skript = readFileSync('scripts/audit.sh', 'utf8');
    writeFileSync(kopie, skript.replace(/ausnahmen=\(\n[\s\S]*?\n\)/, 'ausnahmen=()'));

    const { code, ausgabe } = skriptAusfuehren(kopie, [], ordner, {}, '/bin/bash');

    expect(ausgabe).toBe('');
    expect(code).toBe(0);
    expect(aufrufe(ordner)).toEqual(['audit --audit-level=high']);
  });

  it('Skript und docs/SECURITY.md nennen dieselben Ausnahmen, jede befristet', () => {
    const ignoreZeilen = readFileSync('scripts/audit.sh', 'utf8')
      .split('\n')
      .filter((zeile) => zeile.trim().startsWith('--ignore'));
    expect(ausnahmen()).toHaveLength(ignoreZeilen.length);

    const doku = readFileSync('docs/SECURITY.md', 'utf8');
    const kapitel = doku.split(/^## /m).find((teil) => teil.startsWith('Ausnahmen\n')) ?? '';
    const eintraege = kapitel.split(/^### /m).slice(1);
    const dokumentiert = eintraege.map((eintrag) => eintrag.split(' ')[0]);

    expect(dokumentiert.sort()).toEqual([...ausnahmen()].sort());
    for (const eintrag of eintraege) {
      expect(eintrag).toMatch(/Prüfen bis:\*\*\s*\d{2}\.\d{2}\.\d{4}/);
    }
  });
});

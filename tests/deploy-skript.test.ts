import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  attrappenOrdner,
  aufrufe,
  ordnerEntfernen,
  skriptAusfuehren,
  unbekannteAufrufe,
} from './attrappen.ts';

/*
 * infra/deploy.sh im Ablauf, mit Attrappen für docker, git, chown und chmod.
 * Das Skript läuft aus einer Kopie in einem leeren Ordner; die Mandanten
 * liegen im Test daneben statt unter /etc (WERKBANK_MANDANTEN; sudo setzt die
 * Umgebung zurück, auf dem Server gilt immer der feste Pfad).
 */
const DOCKER = `#!/usr/bin/env bash
d="$ATTRAPPE_DIR"
case " $* " in
  " build "*) printf 'docker %s\\n' "$*" >> "$d/aufrufe" ;;
  " compose "*" up "*|" compose "*" ps ")
    printf 'docker %s [Version %s]\\n' "$*" "\${WERKBANK_VERSION:-}" >> "$d/aufrufe" ;;
  *) printf '%s\\n' "$*" >> "$d/unbekannt"; exit 1 ;;
esac
`;

const GIT = `#!/usr/bin/env bash
printf 'git %s\\n' "$*" >> "$ATTRAPPE_DIR/aufrufe"
case " $* " in
  *" rev-parse --short HEAD ") echo abc1234 ;;
  *" checkout --detach origin/"*) [ "\${NUR_COMMIT:-}" = 1 ] && exit 1 ;;
esac
exit 0
`;

const RECHTE = (name: string) => `#!/usr/bin/env bash
printf '${name} %s\\n' "$*" >> "$ATTRAPPE_DIR/aufrufe"
`;

let ordner = '';
let wurzel = '';
afterEach(() => {
  expect(unbekannteAufrufe(ordner)).toEqual([]);
  ordnerEntfernen(ordner);
  rmSync(wurzel, { recursive: true, force: true });
});

function ausrollen(
  argumente: string[] = [],
  {
    mitMandanten = true,
    umgebung = {},
  }: { mitMandanten?: boolean; umgebung?: Record<string, string> } = {},
) {
  ordner = attrappenOrdner({
    docker: DOCKER,
    git: GIT,
    chown: RECHTE('chown'),
    chmod: RECHTE('chmod'),
  });
  wurzel = mkdtempSync(join(tmpdir(), 'werkbank-deploy-'));
  mkdirSync(join(wurzel, 'infra'));
  copyFileSync('infra/deploy.sh', join(wurzel, 'infra', 'deploy.sh'));
  const mandanten = join(wurzel, 'mandanten.json');
  if (mitMandanten) writeFileSync(mandanten, '[]');
  const lauf = skriptAusfuehren(join(wurzel, 'infra', 'deploy.sh'), argumente, ordner, {
    WERKBANK_MANDANTEN: mandanten,
    ...umgebung,
  });
  return { ...lauf, liste: aufrufe(ordner), mandanten };
}

describe('infra/deploy.sh', () => {
  it('bricht ohne Mandanten ab, bevor es etwas holt oder baut', () => {
    const { code, ausgabe, liste } = ausrollen([], { mitMandanten: false });
    expect(code).toBe(1);
    expect(ausgabe).toContain('mandanten.json');
    expect(liste).toEqual([]);
  });

  it('schützt die Mandanten, holt main, baut frisch und wartet, bis der Dienst gesund ist', () => {
    const { code, liste, mandanten } = ausrollen();
    expect(code).toBe(0);
    expect(liste).toEqual([
      `chown root:1000 ${mandanten}`,
      `chmod 440 ${mandanten}`,
      `git -C ${wurzel} fetch --prune origin`,
      `git -C ${wurzel} checkout --detach origin/main`,
      `git -C ${wurzel} rev-parse --short HEAD`,
      `docker build --pull -f ${wurzel}/grosshandel-attrappe/Dockerfile -t werkbank-grosshandel:abc1234 ${wurzel}`,
      `docker compose -f ${wurzel}/infra/compose.prod.yml up -d --wait --wait-timeout 120 --remove-orphans [Version abc1234]`,
      `docker compose -f ${wurzel}/infra/compose.prod.yml ps [Version abc1234]`,
    ]);
  });

  it('nimmt einen Commit, wenn es keinen gleichnamigen Branch gibt', () => {
    const { code, liste } = ausrollen(['abc1234'], { umgebung: { NUR_COMMIT: '1' } });
    expect(code).toBe(0);
    expect(liste).toContain(`git -C ${wurzel} checkout --detach origin/abc1234`);
    expect(liste).toContain(`git -C ${wurzel} checkout --detach abc1234`);
  });
});

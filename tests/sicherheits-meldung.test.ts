import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  attrappenOrdner,
  aufrufe,
  lesen,
  ordnerEntfernen,
  skriptAusfuehren,
  unbekannteAufrufe,
} from './attrappen';

/*
 * Der tägliche Lauf wird nicht mehr rot, wenn eine Abhängigkeit eine Meldung
 * hat. Stattdessen hält scripts/sicherheits-meldung.sh genau ein Issue: neu
 * beim ersten Fund, ergänzt nur bei geänderten Kennungen, offen und mit
 * «keine Befunde» beschriftet, sobald nichts mehr ansteht. Jede Mail an Adam soll eine Änderung bedeuten, nie eine Wiederholung.
 */
const GH = readFileSync('tests/gh-attrappe.sh', 'utf8');

const KOPF = 'bun audit v1.3.14 (0d9b296a)\n';
const NEXT =
  'next  >=16.0.0 <16.3.8\n  (direct dependency)\n' +
  '  high: Next.js has Server-Side Request Forgery in Image Optimization - https://github.com/advisories/GHSA-cjq9-62q9-8jv4\n';
const SHARP =
  'sharp  <0.35.5\n  @huggingface/transformers › sharp\n' +
  '  high: sharp : Vulnerability in librsvg dependency - https://github.com/advisories/GHSA-wq5f-xc86-pv6w\n';

const BERICHT = {
  next: `${KOPF}${NEXT}1 vulnerabilities (1 high)\n`,
  beide: `${KOPF}${NEXT}${SHARP}2 vulnerabilities (2 high)\n`,
  beideUmgekehrt: `${KOPF}${SHARP}${NEXT}2 vulnerabilities (2 high)\n`,
  sauber: KOPF,
  gescheitert: `${KOPF}ConnectionRefused: audit request failed\n`,
};

let ordner = '';
afterEach(() => {
  expect(unbekannteAufrufe(ordner)).toEqual([]);
  ordnerEntfernen(ordner);
});

function melden(bericht: string, ...argumente: string[]) {
  const datei = join(ordner, 'audit.txt');
  writeFileSync(datei, bericht);
  return skriptAusfuehren('scripts/sicherheits-meldung.sh', [datei, ...argumente], ordner, {
    GH_TOKEN: 'attrappe',
    GH_REPO: 'AdamBaranyi/Apotheken-Werkbank',
  });
}

/** Erster Lauf mit Fund; danach muss das Issue offen sein. */
function angelegt(bericht: string): number {
  expect(melden(bericht, '1').code).toBe(0);
  expect(lesen(ordner, 'nummer').trim()).toBe('7');
  return aufrufe(ordner).length;
}

/*
 * Ein Lockvogel: Im öffentlichen Repo kann jedes Konto ein Issue mit demselben
 * Titel eröffnen und dessen Text jederzeit ändern, auch mit der Markierung des
 * aktuellen Stands. Labels setzen kann es nicht, und es ist nicht der Bot.
 */
function lockvogel(
  nummer: number,
  body: string,
  { autor = 'angreifer', labels = [] as string[] } = {},
): void {
  writeFileSync(
    join(ordner, 'fremd.json'),
    JSON.stringify([
      {
        number: nummer,
        title: 'Sicherheitsmeldungen',
        author: { login: autor },
        labels: labels.map((name) => ({ name })),
        body,
      },
    ]),
  );
}

/** Die Markierung, die ein Angreifer aus den öffentlichen Kennungen nachrechnet. */
const STAND_NEXT = createHash('sha256').update('GHSA-cjq9-62q9-8jv4').digest('hex').slice(0, 12);

/** Aufrufe, die etwas ändern oder eine Mail auslösen. */
function schreibend(ab = 0): string[] {
  return aufrufe(ordner)
    .slice(ab)
    .filter((aufruf) => !aufruf.startsWith('issue list') && !aufruf.startsWith('issue view'));
}

describe('scripts/sicherheits-meldung.sh', () => {
  it('legt beim ersten Fund ein Issue an, mit Label und Zuweisung', () => {
    ordner = attrappenOrdner({ gh: GH });
    const { code } = melden(BERICHT.next, '1');

    expect(code).toBe(0);
    expect(aufrufe(ordner)[0]).toBe('issue list state=open label= search=');
    expect(schreibend()).toEqual([
      'label create sicherheit',
      'issue create title=Sicherheitsmeldungen label=sicherheit assignee=AdamBaranyi',
    ]);
    expect(lesen(ordner, 'body')).toContain('GHSA-cjq9-62q9-8jv4');
  });

  it('derselbe Befund am nächsten Tag schickt keine zweite Meldung', () => {
    ordner = attrappenOrdner({ gh: GH });
    const bisher = angelegt(BERICHT.next);

    const { code } = melden(BERICHT.next, '1');

    expect(code).toBe(0);
    expect(schreibend(bisher)).toEqual([]);
  });

  it('gleiche Kennungen in anderer Reihenfolge gelten als unverändert', () => {
    ordner = attrappenOrdner({ gh: GH });
    const bisher = angelegt(BERICHT.beide);

    melden(BERICHT.beideUmgekehrt, '1');

    expect(schreibend(bisher)).toEqual([]);
  });

  it('eine neue Kennung ergänzt das Issue und kommentiert die Änderung', () => {
    ordner = attrappenOrdner({ gh: GH });
    const bisher = angelegt(BERICHT.next);

    const { code } = melden(BERICHT.beide, '1');

    expect(code).toBe(0);
    expect(schreibend(bisher)).toEqual(['issue edit 7', 'issue comment 7']);
    expect(lesen(ordner, 'body')).toContain('GHSA-wq5f-xc86-pv6w');
    expect(lesen(ordner, 'kommentar')).toContain('GHSA-wq5f-xc86-pv6w');
  });

  it('ohne Befund bleibt das Issue offen und sagt «keine Befunde»', () => {
    ordner = attrappenOrdner({ gh: GH });
    const bisher = angelegt(BERICHT.next);

    const { code } = melden(BERICHT.sauber, '0');

    expect(code).toBe(0);
    expect(schreibend(bisher)).toEqual(['issue edit 7']);
    expect(lesen(ordner, 'body')).toContain('keine Befunde');
    const danach = aufrufe(ordner).length;
    melden(BERICHT.sauber, '0');
    expect(schreibend(danach)).toEqual([]);
  });

  it('nach einem sauberen Tag ergänzt ein neuer Fund dasselbe Issue', () => {
    ordner = attrappenOrdner({ gh: GH });
    angelegt(BERICHT.next);
    melden(BERICHT.sauber, '0');
    const danach = aufrufe(ordner).length;

    melden(BERICHT.beide, '1');

    expect(schreibend(danach)).toEqual(['issue edit 7', 'issue comment 7']);
  });

  it('ohne Befund und ohne offenes Issue bleibt es still', () => {
    ordner = attrappenOrdner({ gh: GH });
    const { code } = melden(BERICHT.sauber, '0');

    expect(code).toBe(0);
    expect(schreibend()).toEqual([]);
  });

  it('ein gescheiterter Audit schliesst nichts und färbt den Lauf rot', () => {
    ordner = attrappenOrdner({ gh: GH });
    const bisher = angelegt(BERICHT.next);

    const { code, ausgabe } = melden(BERICHT.gescheitert, '1');

    expect(code).toBe(1);
    expect(schreibend(bisher)).toEqual([]);
    expect(ausgabe).toContain('ohne Ergebnis');
  });

  it('ohne Exit-Code des Audits bricht es ab, statt zu raten', () => {
    ordner = attrappenOrdner({ gh: GH });
    const { code } = melden(BERICHT.sauber);

    expect(code).toBe(2);
    expect(aufrufe(ordner)).toEqual([]);
  });

  it('Farbcodes aus der Ausgabe von bun landen nicht im Issue', () => {
    ordner = attrappenOrdner({ gh: GH });
    melden(`\u001b[0m\u001b[1mbun audit \u001b[0m\u001b[2mv1.3.14\u001b[0m\n${NEXT}`, '1');

    expect(lesen(ordner, 'body')).toContain('bun audit v1.3.14');
    expect(lesen(ordner, 'body')).not.toContain('\u001b');
  });
  it('ein fremdes Issue mit gleichem Titel und passender Markierung wird übergangen', () => {
    ordner = attrappenOrdner({ gh: GH });
    lockvogel(99, `<!-- stand:${STAND_NEXT} -->`);

    const { code } = melden(BERICHT.next, '1');

    expect(code).toBe(0);
    expect(schreibend()).toEqual([
      'label create sicherheit',
      'issue create title=Sicherheitsmeldungen label=sicherheit assignee=AdamBaranyi',
    ]);
  });

  it('neben einem fremden Issue bleibt das eigene das Ziel', () => {
    ordner = attrappenOrdner({ gh: GH });
    const bisher = angelegt(BERICHT.next);
    lockvogel(99, 'Alles in Ordnung, hier nichts melden.');

    melden(BERICHT.beide, '1');

    expect(schreibend(bisher)).toEqual(['issue edit 7', 'issue comment 7']);
  });

  it('ohne Befund lässt es ein fremdes Issue in Ruhe', () => {
    ordner = attrappenOrdner({ gh: GH });
    lockvogel(99, 'irgendein Text');

    const { code } = melden(BERICHT.sauber, '0');

    expect(code).toBe(0);
    expect(schreibend()).toEqual([]);
  });
  /*
   * Jede der beiden Prüfungen hält einen Fremden schon allein ab. Die zwei
   * Fälle hier fängt nur je eine: ein Issue mit Label, aber nicht vom Bot, und
   * eines vom Bot, aber ohne Label, etwa aus einer anderen Automatisierung, die
   * Titel aus fremder Eingabe übernimmt.
   */
  it('ein Issue mit Label, aber nicht vom Bot, zählt nicht', () => {
    ordner = attrappenOrdner({ gh: GH });
    lockvogel(98, `<!-- stand:${STAND_NEXT} -->`, {
      autor: 'mitwirkender',
      labels: ['sicherheit'],
    });

    melden(BERICHT.next, '1');

    expect(schreibend()).toContain(
      'issue create title=Sicherheitsmeldungen label=sicherheit assignee=AdamBaranyi',
    );
  });

  it('ein Issue vom Bot, aber ohne Label, zählt nicht', () => {
    ordner = attrappenOrdner({ gh: GH });
    lockvogel(97, `<!-- stand:${STAND_NEXT} -->`, { autor: 'app/github-actions' });

    melden(BERICHT.next, '1');

    expect(schreibend()).toContain(
      'issue create title=Sicherheitsmeldungen label=sicherheit assignee=AdamBaranyi',
    );
  });
});

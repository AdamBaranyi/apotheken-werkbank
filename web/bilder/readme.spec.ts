import { test, type Page } from '@playwright/test';
import { erfassen, FICTOLAT, PROBATIN } from '../e2e/kasse-hilfen';
import { SITZUNG } from '../e2e/konten';

/*
 * Bilder fürs README: Ausschnitt 1440 × 900 mit doppelter Pixeldichte, hell und
 * dunkel. Erzeugen mit `bun run bilder`, danach je Bild nach docs/bilder/:
 * `cwebp -q 82 -resize 1760 0 web/bilder/ausgabe/readme-NAME-hell.png -o docs/bilder/NAME-hell.webp`
 * (ebenso dunkel). Alle Daten sind erfunden.
 */
test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'breit-1440', 'Bilder fürs README nur in der breiten Ansicht');
});

async function festhalten(seite: Page, name: string): Promise<void> {
  for (const [schema, wort] of [
    ['light', 'hell'],
    ['dark', 'dunkel'],
  ] as const) {
    await seite.emulateMedia({ colorScheme: schema });
    await seite.evaluate(() => document.fonts.ready);
    await seite.screenshot({ path: `bilder/ausgabe/readme-${name}-${wort}.png` });
  }
}

test('README: Anmeldung', async ({ page }) => {
  await page.goto('/anmelden');
  await page.waitForFunction(() => {
    const bild = document.querySelector<HTMLImageElement>('figure img');
    return bild !== null && bild.complete && bild.naturalWidth > 1;
  });
  await festhalten(page, 'anmelden');
});

test.describe('README angemeldet', () => {
  test.use({ storageState: SITZUNG });

  test('README: Bestellen mit Verfügbarkeit', async ({ page }) => {
    await page.goto('/bestellen');
    const mengen: [string, string][] = [
      ['Menge Allergomuster 10 mg Tabletten, 50 St.', '30'],
      ['Menge Probatin 400 mg Filmtabletten, 50 St.', '6'],
      ['Menge Fictolat Saft, 100 ml', '4'],
      ['Menge Direktan Pflaster, 10 St.', '2'],
    ];
    for (const [feld, wert] of mengen) await page.getByLabel(feld).fill(wert);
    await page.getByRole('button', { name: 'Verfügbarkeit prüfen' }).click();
    await page
      .getByRole('row', { name: /Allergomuster/ })
      .getByText('25 von 30', { exact: true })
      .waitFor();
    await page.evaluate(() => window.scrollTo(0, 0));
    await festhalten(page, 'bestellen');
  });

  test('README: Kasse', async ({ page }) => {
    await page.goto('/kasse');
    await erfassen(page, PROBATIN, PROBATIN, FICTOLAT, '99113703');
    await page.getByLabel('Rezept liegt vor').check();
    await page.getByLabel('Gegeben').fill('50');
    await page.evaluate(() => window.scrollTo(0, 0));
    await festhalten(page, 'kasse');
  });

  test('README: Flow-Monitor und ein abgebrochener Lauf', async ({ page }) => {
    await page.goto('/monitor');
    await page.getByRole('table', { name: 'Läufe der Engine' }).waitFor();
    await festhalten(page, 'monitor');
    await page
      .getByRole('row', { name: /Abgebrochen/ })
      .first()
      .getByRole('link')
      .click();
    await page.getByRole('heading', { level: 2, name: 'Status: Abgebrochen' }).waitFor();
    await festhalten(page, 'monitor-lauf');
  });
});

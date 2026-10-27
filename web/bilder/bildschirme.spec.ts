import { test, type Page, type TestInfo } from '@playwright/test';
import { erfassen, FICTOLAT, PROBATIN } from '../e2e/kasse-hilfen';
import { SITZUNG } from '../e2e/konten';

/* Zwischenbilder je Breite. Alle Daten sind erfunden. */
async function festhalten(seite: Page, info: TestInfo, name: string): Promise<void> {
  await seite.evaluate(() => document.fonts.ready);
  await seite.screenshot({
    path: `bilder/ausgabe/${info.project.name}-${name}.png`,
    fullPage: true,
  });
}

test('Anmeldung', async ({ page }, info) => {
  await page.goto('/anmelden');
  await festhalten(page, info, 'anmelden');
});

test.describe('angemeldet', () => {
  test.use({ storageState: SITZUNG });

  test('Bestellen mit Verfügbarkeit', async ({ page }, info) => {
    await page.goto('/bestellen');
    const mengen: [string, string][] = [
      ['Menge Allergomuster 10 mg Tabletten, 50 St.', '30'],
      ['Menge Probatin 400 mg Filmtabletten, 50 St.', '6'],
      ['Menge Fictolat Saft, 100 ml', '4'],
      ['Menge Direktan Pflaster, 10 St.', '2'],
      ['Menge Kaltprobe Injektionslösung, 5 Fertigspritzen', '1'],
      ['Menge Seltenol Kapseln, 30 St.', '3'],
    ];
    for (const [feld, wert] of mengen) await page.getByLabel(feld).fill(wert);
    await page.getByRole('button', { name: 'Verfügbarkeit prüfen' }).click();
    await page
      .getByRole('row', { name: /Allergomuster/ })
      .getByText('25 von 30', { exact: true })
      .waitFor();
    await festhalten(page, info, 'bestellen');
  });

  test('Kasse, Beleg und Abschluss', async ({ page }, info) => {
    await page.goto('/kasse');
    await erfassen(page, PROBATIN, PROBATIN, FICTOLAT, '99113703');
    await page.getByLabel('Rezept liegt vor').check();
    await page.getByLabel('Gegeben').fill('50');
    await festhalten(page, info, 'kasse');
    await page.getByRole('button', { name: 'Verkauf buchen' }).click();
    await page.getByRole('heading', { level: 1, name: /^Beleg \d+$/ }).waitFor();
    await festhalten(page, info, 'beleg');
    await page.goto('/kasse/belege');
    await festhalten(page, info, 'belege');
    await page.goto('/kasse/abschluss');
    await festhalten(page, info, 'abschluss-offen');
  });
});

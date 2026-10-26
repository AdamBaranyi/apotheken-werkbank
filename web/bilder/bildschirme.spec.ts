import { test, type Page, type TestInfo } from '@playwright/test';
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
});

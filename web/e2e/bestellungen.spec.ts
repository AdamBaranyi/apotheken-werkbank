import { expect, test } from '@playwright/test';
import { SITZUNG } from './konten';
import { bildschirmPruefen } from './pruefen';

test.use({ storageState: SITZUNG });

/*
 * Verbindlich bestellen über MSV3 bei der Attrappe. Probatin 20 St. hat 120
 * Packungen im Hauptlager: Drei Breiten mit je 3 Packungen ändern an den
 * anderen Tests nichts.
 */
test.describe('Bestellungen', () => {
  test('verbindlich bestellen: bestätigt, Lieferung je Artikel, in der Liste', async ({ page }) => {
    await page.goto('/bestellen');
    await page.getByLabel('Menge Probatin 400 mg Filmtabletten, 20 St.').fill('3');
    await page.getByRole('button', { name: 'Verbindlich bestellen' }).click();

    await expect(page).toHaveURL(/\/bestellungen\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { level: 2, name: 'Status: Bestätigt' })).toBeVisible();
    const zeile = page.getByRole('row', { name: /Probatin 400 mg Filmtabletten, 20 St\./ });
    await expect(zeile.getByText('3 von 3', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Status beim Grosshändler abfragen' }),
    ).toHaveCount(0);
    await bildschirmPruefen(page);

    const titel = (await page.getByRole('heading', { level: 1 }).textContent()) ?? '';
    await page.goto('/bestellungen');
    await expect(
      page
        .getByRole('navigation', { name: 'Bereiche' })
        .getByRole('link', { name: 'Bestellungen' }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('link', { name: titel, exact: true })).toBeVisible();
    await bildschirmPruefen(page);
  });

  test('ohne Menge wird nichts bestellt', async ({ page }) => {
    await page.goto('/bestellen');
    await page.getByRole('button', { name: 'Verbindlich bestellen' }).click();
    await expect(page.getByRole('main').getByRole('alert').filter({ hasText: 'Menge' })).toHaveText(
      'Bitte bei mindestens einem Artikel eine Menge eintragen.',
    );
    await expect(page).toHaveURL(/\/bestellen$/);
  });

  test('Enter in einem Mengenfeld prüft nur, bestellt nicht', async ({ page }) => {
    await page.goto('/bestellen');
    const feld = page.getByLabel('Menge Probatin 400 mg Filmtabletten, 20 St.');
    await feld.fill('1');
    await feld.press('Enter');
    await expect(
      page.getByRole('row', { name: /Probatin.*20 St/ }).getByText('1 von 1', { exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/bestellen$/);
  });
});

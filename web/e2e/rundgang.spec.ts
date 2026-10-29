import { expect, test } from '@playwright/test';
import { SITZUNG } from './konten';
import { bildschirmPruefen } from './pruefen';

test.use({ storageState: SITZUNG });

test.describe('Rundgang', () => {
  test('erklärt «Bestellen» Schritt für Schritt und hebt das Ziel hervor', async ({ page }) => {
    await page.goto('/bestellen');
    await page.getByRole('button', { name: 'Rundgang' }).click();
    const willkommen = page.getByRole('dialog', { name: 'Willkommen in der Werkbank' });
    await expect(willkommen).toBeVisible();
    await expect(willkommen.getByRole('button', { name: 'Weiter' })).toBeFocused();
    await bildschirmPruefen(page);

    await willkommen.getByRole('button', { name: 'Weiter' }).click();
    await expect(page.getByRole('dialog', { name: 'Bestellfenster heute' })).toBeVisible();
    await expect(page.locator('[data-rundgang-ziel]')).toHaveCount(1);

    for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Weiter' }).click();
    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('[data-rundgang-ziel]')).toHaveCount(0);
  });

  test('Escape schliesst den Rundgang an der Kasse', async ({ page }) => {
    await page.goto('/kasse');
    await page.getByRole('button', { name: 'Rundgang' }).click();
    await expect(page.getByRole('dialog', { name: 'Willkommen in der Werkbank' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

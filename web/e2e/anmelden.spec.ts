import { expect, test } from '@playwright/test';
import { inhaber } from './konten';
import { bildschirmPruefen } from './pruefen';

test.describe('Anmeldung', () => {
  test('ohne Sitzung führt jede Seite zur Anmeldung', async ({ page }) => {
    await page.goto('/bestellen');
    await expect(page).toHaveURL(/\/anmelden$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Anmelden' })).toBeVisible();
    await bildschirmPruefen(page);
  });

  test('falsches Passwort: Meldung, Fokus bleibt auf dem Knopf', async ({ page }) => {
    await page.goto('/anmelden');
    await page.getByLabel('E-Mail').fill(inhaber().email);
    await page.getByLabel('Passwort').fill('ganzFalschesPasswort1');
    const knopf = page.getByRole('button', { name: 'Anmelden' });
    await knopf.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('main').getByRole('alert')).toHaveText(
      'E-Mail oder Passwort stimmt nicht.',
    );
    await expect(knopf).toBeFocused();
    await expect(page.getByLabel('E-Mail')).toHaveValue(inhaber().email);
  });

  test('richtiges Passwort führt zum Bestellen', async ({ page }) => {
    const konto = inhaber();
    await page.goto('/anmelden');
    await page.getByLabel('E-Mail').fill(konto.email);
    await page.getByLabel('Passwort').fill(konto.passwort);
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Bestellen' })).toBeVisible();
    await expect(page.getByText(konto.apotheke)).toBeVisible();
  });
});

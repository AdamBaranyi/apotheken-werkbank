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

  test('richtiges Passwort führt zum Bestellen; die Sitzung liest nur der Server', async ({
    page,
    context,
  }) => {
    const konto = inhaber();
    await page.goto('/anmelden');
    await page.getByLabel('E-Mail').fill(konto.email);
    await page.getByLabel('Passwort').fill(konto.passwort);
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Bestellen' })).toBeVisible();
    await expect(page.getByText(konto.apotheke)).toBeVisible();
    const sitzung = (await context.cookies()).filter((c) => c.name.startsWith('sb-'));
    expect(sitzung.length).toBeGreaterThan(0);
    expect(sitzung.every((c) => c.httpOnly && c.sameSite === 'Lax')).toBe(true);
    expect(await page.evaluate(() => document.cookie)).not.toContain('sb-');
  });

  test('nach fünf Fehlversuchen bremst die Anmeldung, auch bei unbekannter Adresse', async ({
    page,
  }, info) => {
    test.skip(
      info.project.name !== 'breit-1440',
      'Ablauf ohne eigenen Bildschirm: eine Breite genügt',
    );
    const email = `niemand.${Date.now()}@werkbank.test`;
    const meldung = page.getByRole('main').getByRole('alert');
    await page.goto('/anmelden');
    const versuchen = async () => {
      await page.getByLabel('E-Mail').fill(email);
      await page.getByLabel('Passwort').fill('ganzFalschesPasswort1');
      await Promise.all([
        page.waitForResponse(
          (r) => r.request().method() === 'POST' && r.url().endsWith('/anmelden'),
        ),
        page.getByRole('button', { name: 'Anmelden' }).click(),
      ]);
    };
    for (let i = 0; i < 5; i++) {
      await versuchen();
      await expect(meldung).toHaveText('E-Mail oder Passwort stimmt nicht.');
    }
    await versuchen();
    await expect(meldung).toHaveText('Zu viele Versuche. Bitte in 15 Minuten erneut.');
  });
});

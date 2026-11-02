import { expect, test } from '@playwright/test';
import { rundgangVergessen } from './datenbank';
import { rundgangKonto, SITZUNG } from './konten';
import { bildschirmPruefen } from './pruefen';

test.use({ storageState: SITZUNG });

/** Titel und Seite jedes Schritts nach «Willkommen», in der Reihenfolge des Rundgangs. */
const WEG: [string, RegExp][] = [
  ['Bestellfenster heute', /\/bestellen$/],
  ['Mengen eintragen', /\/bestellen$/],
  ['Verfügbarkeit prüfen', /\/bestellen$/],
  ['Verbindlich bestellen', /\/bestellen$/],
  ['Bestellungen', /\/bestellungen$/],
  ['Artikel erfassen', /\/kasse$/],
  ['Der Bon', /\/kasse$/],
  ['Zahlung und Buchen', /\/kasse$/],
  ['Belege', /\/kasse\/belege$/],
  ['Seit dem letzten Abschluss', /\/kasse\/abschluss$/],
  ['Tag abschliessen', /\/kasse\/abschluss$/],
  ['Flow-Monitor', /\/monitor$/],
  ['Geschafft', /\/monitor$/],
];

test.describe('Rundgang', () => {
  test('führt von jeder Seite aus durch alle Bereiche und hebt das Ziel hervor', async ({
    page,
  }) => {
    await page.goto('/kasse/belege');
    await page.getByRole('button', { name: 'Rundgang' }).click();
    const willkommen = page.getByRole('dialog', { name: 'Willkommen in der Werkbank' });
    await expect(willkommen).toBeVisible();
    await expect(willkommen.getByRole('button', { name: 'Weiter' })).toBeFocused();
    await bildschirmPruefen(page);

    for (const [titel, seite] of WEG) {
      await page.getByRole('button', { name: 'Weiter' }).click();
      await expect(page.getByRole('dialog', { name: titel, exact: true })).toBeVisible();
      await expect(page).toHaveURL(seite);
    }
    await expect(page.locator('[data-rundgang-ziel]')).toHaveCount(1);
    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('[data-rundgang-ziel]')).toHaveCount(0);
  });

  test('Zurück führt zum vorigen Schritt, Escape schliesst', async ({ page }) => {
    await page.goto('/bestellen');
    await page.getByRole('button', { name: 'Rundgang' }).click();
    await page.getByRole('button', { name: 'Weiter' }).click();
    await expect(page.getByRole('dialog', { name: 'Bestellfenster heute' })).toBeVisible();
    await expect(page.locator('[data-rundgang-ziel]')).toHaveCount(1);
    await page.getByRole('button', { name: 'Zurück' }).click();
    await expect(page.getByRole('dialog', { name: 'Willkommen in der Werkbank' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

// Ein eigenes Konto, das den Rundgang noch nicht kennt: Alle anderen Testkonten haben ihn
// schon gesehen, sonst stünde er in jedem Test im Weg (E28, E43).
test.describe('Rundgang beim ersten Anmelden', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('startet beim ersten Anmelden von selbst, danach nicht mehr', async ({ page }, info) => {
    test.skip(info.project.name !== 'breit-1440', 'Ein Konto, ein erstes Mal: eine Breite genügt');
    const konto = rundgangKonto();
    await rundgangVergessen(konto.email);
    await page.goto('/anmelden');
    await page.getByLabel('E-Mail').fill(konto.email);
    await page.getByLabel('Passwort').fill(konto.passwort);
    const gemerkt = page.waitForResponse(
      (r) => r.request().method() === 'POST' && r.url().endsWith('/bestellen'),
    );
    await page.getByRole('button', { name: 'Anmelden' }).click();
    const willkommen = page.getByRole('dialog', { name: 'Willkommen in der Werkbank' });
    await expect(willkommen).toBeVisible();
    await expect(willkommen.getByRole('button', { name: 'Weiter' })).toBeFocused();
    await gemerkt;
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Bestellen' })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

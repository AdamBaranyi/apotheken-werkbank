import { expect, test } from '@playwright/test';
import { erfassen, FICTOLAT, PROBATIN, verkaufen } from './kasse-hilfen';
import { SITZUNG } from './konten';
import { bildschirmPruefen } from './pruefen';

test.use({ storageState: SITZUNG });

test.describe('Kasse', () => {
  test('leerer Bon und Navigation zeigen, wo man ist', async ({ page }) => {
    await page.goto('/kasse');
    await expect(page.getByRole('heading', { level: 1, name: 'Kasse' })).toBeVisible();
    await expect(page.getByText('Der Bon ist leer.')).toBeVisible();
    const bereiche = page.getByRole('navigation', { name: 'Bereiche' });
    await expect(bereiche.getByRole('link', { name: 'Kasse' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await bildschirmPruefen(page);
  });

  test('ein Tippfehler in der PZN fällt an der Prüfziffer auf', async ({ page }) => {
    await page.goto('/kasse');
    await page.getByLabel('PZN oder Artikel').fill('99100009');
    await page.getByRole('button', { name: 'Hinzufügen' }).click();
    await expect(page.getByLabel('PZN oder Artikel')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#pzn-hinweis')).toHaveText(
      'Die Prüfziffer der PZN 99100009 stimmt nicht. Tippfehler?',
    );
  });

  test('Enter im Mengenfeld bucht nicht, sondern führt zurück zur Erfassung', async ({ page }) => {
    await page.goto('/kasse');
    await erfassen(page, PROBATIN);
    const menge = page.getByLabel(/^Menge Probatin/);
    await menge.fill('3');
    await menge.press('Enter');
    await expect(page.getByLabel('PZN oder Artikel')).toBeFocused();
    await expect(page.getByRole('row', { name: /Summe/ })).toContainText('11,85 €');
    await expect(page).toHaveURL(/\/kasse$/);
  });

  test('bar mit Rx-Artikel: ohne Rezept abgelehnt, dann Beleg mit Rückgeld und PDF', async ({
    page,
  }) => {
    await page.goto('/kasse');
    await erfassen(page, PROBATIN, FICTOLAT);
    await expect(page.getByRole('status')).toContainText('Fictolat Saft, 100 ml erfasst');
    await expect(page.getByRole('row', { name: /Summe/ })).toContainText('16,85 €');
    await page.getByLabel('Gegeben').fill('20');
    await expect(page.getByText('Rückgeld 3,15 €')).toBeVisible();
    await bildschirmPruefen(page);

    await page.getByRole('button', { name: 'Verkauf buchen' }).click();
    const meldung = page
      .getByRole('main')
      .getByRole('alert')
      .filter({ hasText: 'rezeptpflichtig' });
    await expect(meldung).toHaveText(
      'Fictolat Saft ist rezeptpflichtig: ohne vorgelegtes Rezept kein Verkauf.',
    );
    await page.getByLabel('Rezept liegt vor').check();
    await page.getByRole('button', { name: 'Verkauf buchen' }).click();

    await expect(page).toHaveURL(/\/kasse\/belege\/[0-9a-f-]{36}$/);
    const beleg = page.getByRole('article', { name: /^Beleg \d+$/ });
    await expect(beleg.getByRole('definition').filter({ hasText: '16,85 €' })).toBeVisible();
    await expect(beleg.getByRole('definition').filter({ hasText: '3,15 €' })).toBeVisible();
    await bildschirmPruefen(page);

    const pdf = await page.request.get(`${page.url()}/pdf`);
    expect(pdf.headers()['content-type']).toBe('application/pdf');
    expect(pdf.headers()['cache-control']).toContain('no-store');
    const text = (await pdf.body()).toString('latin1');
    expect(text.startsWith('%PDF-1.7')).toBe(true);
    // Im PDF stehen Klammern maskiert, damit Text nie zum Befehl wird.
    expect(text).toContain('Fictolat Saft \\(Rx\\)');
    expect(text).toContain('KassenSichV');
  });

  test('Storno durch die Inhaberin: Gegenbeleg, und das Original zeigt darauf', async ({
    page,
  }) => {
    const nummer = await verkaufen(page);
    const original = page.url();
    await page.getByText('Beleg stornieren', { exact: true }).click();
    await page.getByRole('button', { name: 'Ja, Beleg stornieren' }).click();
    await expect(page.getByRole('heading', { level: 1, name: /^Beleg \d+$/ })).not.toHaveText(
      `Beleg ${nummer}`,
    );
    await expect(page.getByText(`Storno zu Beleg ${nummer}`)).toBeVisible();
    await bildschirmPruefen(page);

    await page.goto(original);
    await expect(page.getByText(/^Storniert durch Beleg \d+$/)).toBeVisible();
    await expect(page.getByText('Beleg stornieren', { exact: true })).toHaveCount(0);
  });

  test('ein fremder oder unbekannter Beleg ist «nicht gefunden»', async ({ page }) => {
    const antwort = await page.goto('/kasse/belege/00000000-0000-4000-8000-000000000000');
    expect(antwort?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: 'Nicht gefunden' })).toBeVisible();
    const pdf = await page.request.get('/kasse/belege/00000000-0000-4000-8000-000000000000/pdf');
    expect(pdf.status()).toBe(404);
  });

  test('die Belegliste führt zum Beleg', async ({ page }) => {
    const nummer = await verkaufen(page);
    await page.goto('/kasse/belege');
    await expect(
      page.getByRole('navigation', { name: 'Bereiche' }).getByRole('link', { name: 'Belege' }),
    ).toHaveAttribute('aria-current', 'page');
    await bildschirmPruefen(page);
    await page.getByRole('link', { name: `Beleg ${nummer}`, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: `Beleg ${nummer}` })).toBeVisible();
  });
});

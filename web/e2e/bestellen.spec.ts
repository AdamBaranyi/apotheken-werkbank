import { expect, test } from '@playwright/test';
import { SITZUNG } from './konten';
import { bildschirmPruefen } from './pruefen';

test.use({ storageState: SITZUNG });

test.describe('Bestellen', () => {
  test('zeigt die Bestellfenster aus den Vertragsdaten des Grosshändlers', async ({ page }) => {
    await page.goto('/bestellen');
    const band = page.getByRole('region', { name: 'Bestellfenster heute' });
    await expect(band).toBeVisible();
    await expect(band.getByText('Stand')).toBeVisible();
    await bildschirmPruefen(page);
  });

  test('Verfügbarkeit: Teillieferung, Verbund und Defekt stehen beim Artikel', async ({ page }) => {
    await page.goto('/bestellen');
    await page.getByLabel('Menge Allergomuster 10 mg Tabletten, 50 St.').fill('30');
    await page.getByLabel('Menge Direktan Pflaster, 10 St.').fill('1');
    await page.getByRole('button', { name: 'Verfügbarkeit prüfen' }).click();

    const allergo = page.getByRole('row', { name: /Allergomuster/ });
    await expect(allergo.getByText('25 von 30', { exact: true })).toBeVisible();
    await expect(allergo.getByText('5 von 30', { exact: true })).toBeVisible();
    await expect(allergo.getByText(/später aus zweitem Lager/)).toBeVisible();
    const direktan = page.getByRole('row', { name: /Direktan/ });
    await expect(direktan.getByText(/nur direkt beim Hersteller/)).toBeVisible();
    // Die Mengen bleiben nach dem Senden stehen.
    await expect(page.getByLabel('Menge Allergomuster 10 mg Tabletten, 50 St.')).toHaveValue('30');
    await bildschirmPruefen(page);
  });

  test('ohne Menge kommt eine klare Meldung', async ({ page }) => {
    await page.goto('/bestellen');
    await page.getByRole('button', { name: 'Verfügbarkeit prüfen' }).click();
    await expect(page.getByRole('main').getByRole('alert').filter({ hasText: 'Menge' })).toHaveText(
      'Bitte bei mindestens einem Artikel eine Menge eintragen.',
    );
  });

  test('«Rx» steht beim Artikelnamen, nicht bei den Beschriftungen', async ({ page }) => {
    await page.goto('/bestellen');
    const zeile = page.getByRole('row', { name: /Fictolat/ });
    const rx = await zeile.getByText('Rx', { exact: true }).boundingBox();
    const rahmen = await zeile.boundingBox();
    // Schmal stehen die Beschriftungen in einer Spalte von 7rem (112 px) links.
    expect(rx && rahmen && rx.x - rahmen.x).toBeGreaterThanOrEqual(112);
  });

  test('jedes Zeichen der Legende trägt Farbe oder Muster, keines wirkt wie ein Kästchen', async ({
    page,
  }) => {
    await page.goto('/bestellen');
    await page.getByLabel('Menge Seltenol Kapseln, 30 St.').fill('3');
    await page.getByLabel('Menge Allergomuster 10 mg Tabletten, 50 St.').fill('30');
    await page.getByRole('button', { name: 'Verfügbarkeit prüfen' }).click();
    await expect(page.getByText(/Dispo beim Hersteller/)).toBeVisible();
    const leer = await page
      .locator('li[data-gruppe] > span[aria-hidden="true"]')
      .evaluateAll((zeichen) =>
        zeichen
          .filter((z) => {
            const stil = getComputedStyle(z);
            return stil.backgroundImage === 'none' && stil.backgroundColor === 'rgba(0, 0, 0, 0)';
          })
          .map((z) => z.parentElement?.getAttribute('data-gruppe')),
      );
    expect(leer).toEqual([]);
  });

  test('schmal: ohne Ergebnis keine leere Zeile «Verfügbarkeit»', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) > 768, 'nur in der schmalen Ansicht');
    await page.goto('/bestellen');
    const zeile = page.getByRole('row', { name: /Lehrsalbe/ });
    // Über das Attribut, nicht die Rolle: Eine ausgeblendete Zelle hat keine Rolle mehr.
    const zelle = zeile.locator('td[data-titel="Verfügbarkeit"]');
    await expect(zelle).toHaveCount(1);
    await expect(zelle).toBeHidden();
  });
});

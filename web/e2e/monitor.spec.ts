import { expect, test } from '@playwright/test';
import { SITZUNG } from './konten';
import { bildschirmPruefen } from './pruefen';

/*
 * Flow-Monitor mit den Läufen aus engine/monitor-fuellen.ps1 (in der CI nach
 * der Einrichtung): erledigt, schon gebucht, geheilt, abgebrochen, unklar,
 * Abschluss in Nord und ein Verkauf in Süd, den Nord nicht sehen darf.
 */
test.use({ storageState: SITZUNG });

test.describe('Flow-Monitor', () => {
  test('zeigt die Läufe der eigenen Apotheke mit Status in Worten', async ({ page }) => {
    await page.goto('/monitor');
    await expect(page.getByRole('heading', { level: 1, name: 'Flow-Monitor' })).toBeVisible();
    await expect(
      page
        .getByRole('navigation', { name: 'Bereiche' })
        .getByRole('link', { name: 'Flow-Monitor' }),
    ).toHaveAttribute('aria-current', 'page');
    const tabelle = page.getByRole('table', { name: 'Läufe der Engine' });
    for (const status of ['Erledigt', 'Schon gebucht', 'Abgebrochen', 'Unklar, bitte prüfen']) {
      await expect(tabelle.getByText(status, { exact: true }).first()).toBeVisible();
    }
    await expect(tabelle.getByText('geheilt').first()).toBeVisible();
    // Der Verkauf der Süd-Apotheke gehört einer anderen Apotheke (RLS).
    await expect(tabelle.getByText('Kasse Süd')).toHaveCount(0);
    await bildschirmPruefen(page);
  });

  test('zeigt einen Abbruch mit Meldung und dem Bildschirm, den die Engine sah', async ({
    page,
  }) => {
    await page.goto('/monitor');
    await page
      .getByRole('row', { name: /Abgebrochen/ })
      .first()
      .getByRole('link')
      .click();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Status: Abgebrochen' }),
    ).toBeVisible();
    await expect(page.getByText(/Gebucht ist nichts/)).toBeVisible();
    await expect(page.getByLabel('Bildschirm als Text, so wie die Engine ihn las')).toContainText(
      'Bondrucker: Papier fast leer',
    );
    await expect(page.getByRole('region', { name: 'Schritte' })).toContainText('Eingabe bei «PZN»');
    await bildschirmPruefen(page);
  });

  test('zeigt die Selbstheilung mit Vorschlag, Begründung und Wirkung', async ({ page }) => {
    await page.goto('/monitor');
    await page
      .getByRole('row', { name: /geheilt/ })
      .first()
      .getByRole('link')
      .click();
    const heilung = page.getByRole('region', { name: 'Selbstheilung (Stufe 2)' });
    await expect(heilung).toContainText('Klick auf «OK»');
    await expect(heilung).toContainText('hat geholfen');
    await expect(heilung).toContainText('Der Dialog meldet nur wenig Papier');
    await expect(heilung).toContainText('Attrappe (Test)');
    await bildschirmPruefen(page);
  });

  test('erklärt «unklar» und was jetzt zu tun ist', async ({ page }) => {
    await page.goto('/monitor');
    await page
      .getByRole('row', { name: /Unklar/ })
      .first()
      .getByRole('link')
      .click();
    await expect(page.getByText(/Denselben Auftrag noch einmal laufen lassen/)).toBeVisible();
    await bildschirmPruefen(page);
  });

  test('Marken sind so breit wie ihr Wort, auch schmal', async ({ page }) => {
    await page.goto('/monitor');
    const zeile = page
      .getByRole('table', { name: 'Läufe der Engine' })
      .getByRole('row')
      .filter({ hasText: 'Tagesabschluss' })
      .first();
    const rahmen = await zeile.boundingBox();
    for (const wort of ['Test', 'Erledigt']) {
      const marke = await zeile.getByText(wort, { exact: true }).boundingBox();
      // Schmal wäre eine gestreckte Marke breiter als die halbe Zeile und sähe aus wie ein Feld.
      expect(marke && rahmen && marke.width / rahmen.width).toBeLessThan(0.4);
    }
  });
});

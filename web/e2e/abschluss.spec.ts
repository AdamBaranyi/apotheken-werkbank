import { expect, test } from '@playwright/test';
import { verkaufen } from './kasse-hilfen';
import { SITZUNG } from './konten';
import { bildschirmPruefen } from './pruefen';

test.use({ storageState: SITZUNG });

/*
 * Mehrere Tests buchen und schliessen gleichzeitig für dieselbe Apotheke ab.
 * Geprüft wird darum nicht «mein Abschluss», sondern: Der eigene Beleg steht in
 * genau einem Abschluss, und dessen Seite zeigt Summen und Steuer.
 */
test.describe('Tagesabschluss', () => {
  test('der eigene Beleg landet in genau einem Abschluss', async ({ page }) => {
    const nummer = await verkaufen(page);
    await page.goto('/kasse/abschluss');
    await bildschirmPruefen(page);
    const knopf = page.getByRole('button', { name: 'Tag abschliessen' });
    if ((await knopf.count()) > 0) {
      await knopf.click();
      const eigener = page.getByRole('heading', { level: 1, name: /^Abschluss \d+$/ });
      const schnellerWarJemand = page
        .getByRole('main')
        .getByRole('alert')
        .filter({ hasText: 'keine Belege' });
      await expect(eigener.or(schnellerWarJemand)).toBeVisible();
    }

    await page.goto('/kasse/abschluss');
    const zeilen = await page
      .locator('tbody tr')
      .evaluateAll((trs) =>
        trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent ?? '')),
      );
    const treffer = zeilen.filter(([, , bereich]) => {
      const [, von, bis] = /(\d+) bis (\d+)/.exec(bereich ?? '') ?? [];
      return Number(von) <= nummer && nummer <= Number(bis);
    });
    expect(treffer).toHaveLength(1);
    await page.getByRole('link', { name: treffer[0]?.[0] ?? '', exact: true }).click();
    await expect(page.getByRole('table', { name: 'Steuer je Satz' })).toContainText('19 %');
    await bildschirmPruefen(page);
  });
});

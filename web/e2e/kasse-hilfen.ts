import { expect, type Page } from '@playwright/test';

/** Erfundene Artikel aus daten/artikel.json. */
export const PROBATIN = '99100008'; // Probatin 400 mg Filmtabletten, 20 St., 3,95 €
export const FICTOLAT = '99104118'; // Fictolat Saft, 100 ml, 12,90 €, rezeptpflichtig

/** Erfasst Artikel über die PZN wie mit einem Scanner: tippen, Enter. */
export async function erfassen(page: Page, ...pzns: string[]): Promise<void> {
  const feld = page.getByLabel('PZN oder Artikel');
  for (const pzn of pzns) {
    await feld.fill(pzn);
    await feld.press('Enter');
    await expect(feld).toHaveValue('');
  }
}

/** Verkauft einen Artikel mit Karte und gibt die Nummer des Belegs zurück. */
export async function verkaufen(page: Page, pzn = PROBATIN): Promise<number> {
  await page.goto('/kasse');
  await erfassen(page, pzn);
  await page.getByRole('radio', { name: 'Karte' }).check();
  await page.getByRole('button', { name: 'Verkauf buchen' }).click();
  const titel = page.getByRole('heading', { level: 1, name: /^Beleg \d+$/ });
  await expect(titel).toBeVisible();
  return Number((await titel.textContent())?.replace('Beleg ', ''));
}

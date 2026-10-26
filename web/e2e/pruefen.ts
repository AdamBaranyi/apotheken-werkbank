import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/**
 * Gemeinsame Prüfung für jeden Bildschirm: Titel gesetzt (Next streamt ihn
 * nach), keine axe-Befunde, keine Schrift unter 16 px, kein Querscrollen.
 */
export async function bildschirmPruefen(seite: Page): Promise<void> {
  await expect(seite).toHaveTitle(/\S/);
  await seite.evaluate(() => document.fonts.ready);

  const axe = await new AxeBuilder({ page: seite })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);

  const kleineSchrift = await seite.evaluate(() =>
    [...document.querySelectorAll('body *')]
      .filter((el) => {
        const text = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim());
        const stil = getComputedStyle(el);
        const sichtbar =
          stil.visibility !== 'hidden' && stil.display !== 'none' && el.getClientRects().length > 0;
        const unsichtbarFuerAuge = el.closest('.unsichtbar') !== null;
        return text && sichtbar && !unsichtbarFuerAuge && parseFloat(stil.fontSize) < 16;
      })
      .map(
        (el) =>
          `${el.tagName.toLowerCase()} ${getComputedStyle(el).fontSize}: ${el.textContent?.trim().slice(0, 30)}`,
      ),
  );
  expect(kleineSchrift).toEqual([]);

  const ueberstand = await seite.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(ueberstand).toBeLessThanOrEqual(0);
}

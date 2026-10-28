import { expect, test } from '@playwright/test';
import { SITZUNG } from './konten';

test.use({ storageState: SITZUNG });

/*
 * Issue #1: Läuft die Sitzung ab, während ein Formular offen ist, führt das
 * Senden zur Anmeldung, mit Hinweis – nicht zu einer Fehlerseite. Die
 * Werkbank bleibt in der Apotheke den ganzen Tag offen.
 */
test('abgelaufene Sitzung: Senden führt zur Anmeldung mit Hinweis', async ({
  page,
  context,
}, info) => {
  test.skip(
    info.project.name !== 'breit-1440',
    'Ablauf ohne eigenen Bildschirm: eine Breite genügt',
  );
  await page.goto('/bestellen');
  await page.getByLabel('Menge Probatin 400 mg Filmtabletten, 20 St.').fill('2');
  await context.clearCookies();
  await page.getByRole('button', { name: 'Verfügbarkeit prüfen' }).click();
  await expect(page).toHaveURL(/\/anmelden\?sitzung=abgelaufen$/);
  await expect(page.getByRole('status')).toHaveText(
    'Die Sitzung ist abgelaufen. Bitte neu anmelden.',
  );
});

import { chromium, type FullConfig } from '@playwright/test';
import { inhaber, SITZUNG } from './konten';

/**
 * Einmal anmelden, Sitzung speichern: Die Tests danach starten angemeldet und
 * zählen nicht gegen die Grenze der Anmeldeversuche von Supabase.
 */
export default async function anmeldenEinmal(config: FullConfig) {
  const basis = config.projects[0]?.use.baseURL ?? 'http://localhost:3502';
  const konto = inhaber();
  const browser = await chromium.launch();
  const seite = await browser.newPage({ baseURL: basis, locale: 'de-DE' });
  await seite.goto('/anmelden');
  await seite.getByLabel('E-Mail').fill(konto.email);
  await seite.getByLabel('Passwort').fill(konto.passwort);
  await seite.getByRole('button', { name: 'Anmelden' }).click();
  await seite.waitForURL('**/bestellen');
  await seite.context().storageState({ path: SITZUNG });
  await browser.close();
}

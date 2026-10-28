import { expect, test } from '@playwright/test';
import { SITZUNG } from './konten';

test.use({ storageState: SITZUNG });

test.describe('Sicherheit im Browser', () => {
  test('Kopfzeilen: CSP mit Nonce, kein X-Powered-By, keine Rahmen', async ({ request }) => {
    const antwort = await request.get('/anmelden');
    const kopf = antwort.headers();
    expect(kopf['content-security-policy']).toMatch(
      /script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/,
    );
    expect(kopf['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(kopf['x-powered-by']).toBeUndefined();
    expect(kopf['x-content-type-options']).toBe('nosniff');
    expect(kopf['cross-origin-resource-policy']).toBe('same-origin');
    expect(kopf['permissions-policy']).toContain('camera=()');
  });

  test('Seiten mit Daten landen in keinem Zwischenspeicher', async ({ request }) => {
    const antwort = await request.get('/kasse');
    expect(antwort.headers()['cache-control']).toContain('no-store');
  });

  test('der Browser spricht nur mit der eigenen Adresse und verletzt die CSP nie', async ({
    page,
    baseURL,
  }) => {
    const fremd: string[] = [];
    page.on('request', (r) => {
      if (!r.url().startsWith(baseURL ?? '') && !r.url().startsWith('data:')) fremd.push(r.url());
    });
    await page.addInitScript(() => {
      (window as unknown as { cspVerstoesse: string[] }).cspVerstoesse = [];
      document.addEventListener('securitypolicyviolation', (e) =>
        (window as unknown as { cspVerstoesse: string[] }).cspVerstoesse.push(e.violatedDirective),
      );
    });
    await page.goto('/bestellen');
    await page.getByLabel('Menge Probatin 400 mg Filmtabletten, 20 St.').fill('2');
    await page.getByRole('button', { name: 'Verfügbarkeit prüfen' }).click();
    await expect(
      page.getByRole('row', { name: /Probatin.*20 St/ }).getByText('2 von 2', { exact: true }),
    ).toBeVisible();
    expect(fremd).toEqual([]);
    expect(
      await page.evaluate(() => (window as unknown as { cspVerstoesse: string[] }).cspVerstoesse),
    ).toEqual([]);
  });
});

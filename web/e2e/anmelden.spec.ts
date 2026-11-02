import { expect, test } from '@playwright/test';
import { inhaber } from './konten';
import { bildschirmPruefen } from './pruefen';

test.describe('Anmeldung', () => {
  test('ohne Sitzung führt jede Seite zur Anmeldung', async ({ page }) => {
    await page.goto('/bestellen');
    await expect(page).toHaveURL(/\/anmelden$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Anmelden' })).toBeVisible();
    await bildschirmPruefen(page);
  });

  // Breit steht links die Willkommensfläche mit der Illustration. Schmal bleibt die
  // Anmeldung oben, und die Seite lädt das Bild gar nicht erst.
  test('Willkommensfläche: breit mit Bild und drei Arbeitsfeldern, schmal ohne Bild', async ({
    page,
  }) => {
    const bilder: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('willkommen-')) bilder.push(r.url());
    });
    await page.goto('/anmelden');
    const flaeche = page.getByRole('region', { name: 'Apotheken-Werkbank' });
    if ((page.viewportSize()?.width ?? 0) >= 1024) {
      const bild = flaeche.getByRole('img', { name: /Apotheker arbeitet an der Theke/ });
      await expect(bild).toBeVisible();
      // Mehr als 1 Pixel: Die Quelle für breite Bildschirme gilt, nicht der leere Platzhalter.
      await expect
        .poll(() => bild.evaluate((b: HTMLImageElement) => b.naturalWidth))
        .toBeGreaterThan(1);
      await expect(flaeche.getByRole('listitem')).toHaveCount(3);
      expect(bilder).toHaveLength(1);
    } else {
      await expect(flaeche).toBeHidden();
      await expect(page.getByRole('heading', { level: 1, name: 'Anmelden' })).toBeInViewport();
      expect(bilder).toEqual([]);
    }
    await bildschirmPruefen(page);
  });

  // Laptop-Grössen, die die Projekte nicht abdecken: Bei 1024 px hat die Karte Abstand zur
  // Fläche und zum Rand, der Knopf ist ganz zu sehen. Bis 720 px Höhe weichen die
  // Beschreibungen nur fürs Auge; im Baum für Screenreader bleiben sie.
  test('Willkommensfläche auf Laptops: Karte mit Rand, Beschreibungen für Screenreader', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'breit-1440', 'Die Grössen setzt der Test selbst');
    await page.setViewportSize({ width: 1024, height: 600 });
    await page.goto('/anmelden');
    const flaeche = page.getByRole('region', { name: 'Apotheken-Werkbank' });
    const karte = page.getByRole('heading', { level: 1, name: 'Anmelden' }).locator('..');
    const f = await flaeche.boundingBox();
    const k = await karte.boundingBox();
    if (!f || !k) throw new Error('Fläche oder Karte fehlt');
    expect(k.x - (f.x + f.width)).toBeGreaterThanOrEqual(16);
    expect(1024 - (k.x + k.width)).toBeGreaterThanOrEqual(16);
    await expect(page.getByRole('button', { name: 'Anmelden' })).toBeInViewport({ ratio: 1 });
    await bildschirmPruefen(page);

    await page.setViewportSize({ width: 1280, height: 700 });
    const liste = await flaeche.getByRole('list').ariaSnapshot();
    expect(liste).toContain('Verfügbarkeit und Tour prüfen, dann bestellen.');
    expect(liste).toContain('Bedient die Kasse; der Flow-Monitor zeigt jeden Lauf.');
  });

  // Fehlversuche nie mit dem echten Konto: Die Bremse sperrte es sonst für die anderen Tests.
  test('falsche Anmeldedaten: Meldung, Fokus bleibt auf dem Knopf', async ({ page }, info) => {
    const email = `niemand.${info.project.name}.${Date.now()}@werkbank.test`;
    await page.goto('/anmelden');
    await page.getByLabel('E-Mail').fill(email);
    await page.getByLabel('Passwort').fill('ganzFalschesPasswort1');
    const knopf = page.getByRole('button', { name: 'Anmelden' });
    await knopf.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('main').getByRole('alert')).toHaveText(
      'E-Mail oder Passwort stimmt nicht.',
    );
    await expect(knopf).toBeFocused();
    await expect(page.getByLabel('E-Mail')).toHaveValue(email);
  });

  test('richtiges Passwort führt zum Bestellen; die Sitzung liest nur der Server', async ({
    page,
    context,
  }) => {
    const konto = inhaber();
    await page.goto('/anmelden');
    await page.getByLabel('E-Mail').fill(konto.email);
    await page.getByLabel('Passwort').fill(konto.passwort);
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Bestellen' })).toBeVisible();
    await expect(page.getByText(konto.apotheke)).toBeVisible();
    const sitzung = (await context.cookies()).filter((c) => c.name.startsWith('sb-'));
    expect(sitzung.length).toBeGreaterThan(0);
    expect(sitzung.every((c) => c.httpOnly && c.sameSite === 'Lax')).toBe(true);
    expect(await page.evaluate(() => document.cookie)).not.toContain('sb-');
  });

  test('nach zehn Fehlversuchen bremst die Anmeldung, auch bei unbekannter Adresse', async ({
    page,
  }, info) => {
    test.skip(
      info.project.name !== 'breit-1440',
      'Ablauf ohne eigenen Bildschirm: eine Breite genügt',
    );
    const email = `niemand.${Date.now()}@werkbank.test`;
    const meldung = page.getByRole('main').getByRole('alert');
    await page.goto('/anmelden');
    const versuchen = async () => {
      await page.getByLabel('E-Mail').fill(email);
      await page.getByLabel('Passwort').fill('ganzFalschesPasswort1');
      await Promise.all([
        page.waitForResponse(
          (r) => r.request().method() === 'POST' && r.url().endsWith('/anmelden'),
        ),
        page.getByRole('button', { name: 'Anmelden' }).click(),
      ]);
    };
    for (let i = 0; i < 10; i++) {
      await versuchen();
      await expect(meldung).toHaveText('E-Mail oder Passwort stimmt nicht.');
    }
    await versuchen();
    await expect(meldung).toHaveText('Zu viele Versuche. Bitte in 15 Minuten erneut.');
  });
});

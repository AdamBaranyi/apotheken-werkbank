import { expect, test, type Page } from '@playwright/test';
import { rundgangVergessen } from './datenbank';
import { rundgangKonto, SITZUNG } from './konten';
import { bildschirmPruefen } from './pruefen';

test.use({ storageState: SITZUNG });

/** Titel und Seite jedes Schritts nach «Willkommen», in der Reihenfolge des Rundgangs. */
const WEG: [string, RegExp][] = [
  ['Bestellfenster heute', /\/bestellen$/],
  ['Mengen eintragen', /\/bestellen$/],
  ['Verfügbarkeit prüfen', /\/bestellen$/],
  ['Verbindlich bestellen', /\/bestellen$/],
  ['Bestellungen', /\/bestellungen$/],
  ['Artikel erfassen', /\/kasse$/],
  ['Der Bon', /\/kasse$/],
  ['Zahlung und Buchen', /\/kasse$/],
  ['Belege', /\/kasse\/belege$/],
  ['Seit dem letzten Abschluss', /\/kasse\/abschluss$/],
  ['Tag abschliessen', /\/kasse\/abschluss$/],
  ['Flow-Monitor', /\/monitor$/],
  ['Geschafft', /\/monitor$/],
];

/**
 * Die Karte steht beim erklärten Element (E46): ganz im Fenster, direkt darunter oder darüber.
 * Ist dafür kein Platz (hohe Tabelle, Seite rollt nicht weiter), liegt sie unten am Fensterrand
 * über dem Element, und dessen Anfang bleibt darüber frei. Nie abseits am Bildschirmrand.
 */
async function lagePruefen(page: Page, { nurNebenan = false, titel = '' } = {}) {
  // Ohne Daten fehlt manche Tabelle; dann hebt der Rundgang nichts hervor, und nichts ist verdeckt.
  const hervorgehoben = await page
    .waitForFunction(() => document.querySelector('[data-rundgang-ziel]') !== null, null, {
      timeout: 2000,
    })
    .then(
      () => true,
      () => false,
    );
  if (!hervorgehoben) return;
  const messen = () =>
    page.evaluate(() => {
      const d = document.querySelector('dialog[open]')?.getBoundingClientRect();
      const z = document.querySelector('[data-rundgang-ziel]')?.getBoundingClientRect();
      if (!d || !z) return null;
      const breite = document.documentElement.clientWidth;
      const hoehe = document.documentElement.clientHeight;
      const imFenster = d.top >= 0 && d.left >= 0 && d.bottom <= hoehe && d.right <= breite;
      const ueberDemElement = d.left < z.right && d.right > z.left;
      const luecke =
        z.bottom <= d.top ? d.top - z.bottom : z.top >= d.bottom ? z.top - d.bottom : -1;
      const nebenan = luecke >= 0 && luecke <= 48 && ueberDemElement;
      const angedockt = d.bottom >= hoehe - 17 && ueberDemElement && z.top >= 0 && z.top < d.top;
      const masse = [z.top, z.height, d.top, d.height, hoehe].map(Math.round).join(' ');
      return { imFenster, nebenan, beimElement: nebenan || angedockt, masse };
    });
  await expect
    .poll(messen, {
      message: `Lage der Karte bei «${titel}» (Ziel oben, Höhe; Karte oben, Höhe; Fenster)`,
    })
    .toMatchObject(
      nurNebenan ? { imFenster: true, nebenan: true } : { imFenster: true, beimElement: true },
    );
}

/** Lage von Kopf, Bereichen und Arbeitsbereich auf der Seite, dazu ihre Grösse. */
function seiteVermessen(page: Page) {
  return page.evaluate(() => {
    const lage = (selektor: string) => {
      const r = document.querySelector(selektor)?.getBoundingClientRect();
      return r ? [r.left + scrollX, r.top + scrollY, r.width, r.height].map(Math.round) : null;
    };
    const wurzel = document.documentElement;
    return {
      bereiche: lage('nav[aria-label="Bereiche"]'),
      inhalt: lage('#inhalt'),
      titel: lage('#inhalt h1'),
      seite: [wurzel.scrollWidth, wurzel.scrollHeight],
    };
  });
}

/** Alle Schritte nach «Willkommen»: richtige Seite, und die Karte steht beim Element. */
async function durchlaufen(page: Page) {
  for (const [titel, seite] of WEG) {
    await page.getByRole('button', { name: 'Weiter' }).click();
    await expect(page.getByRole('dialog', { name: titel, exact: true })).toBeVisible();
    await expect(page).toHaveURL(seite);
    await lagePruefen(page, { titel });
  }
}

test.describe('Rundgang', () => {
  test('führt von jeder Seite aus durch alle Bereiche und hebt das Ziel hervor', async ({
    page,
  }) => {
    await page.goto('/kasse/belege');
    await page.getByRole('button', { name: 'Rundgang' }).click();
    const willkommen = page.getByRole('dialog', { name: 'Willkommen in der Werkbank' });
    await expect(willkommen).toBeVisible();
    await expect(willkommen.getByRole('button', { name: 'Weiter' })).toBeFocused();
    await bildschirmPruefen(page);

    await durchlaufen(page);
    await expect(page.locator('[data-rundgang-ziel]')).toHaveCount(1);
    // Letzter Schritt: die Bereiche in der dunklen Leiste. Die Hervorhebung muss sich abheben.
    const farben = await page.locator('[data-rundgang-ziel]').evaluate((el) => ({
      umriss: getComputedStyle(el).outlineColor,
      leiste: getComputedStyle(el.closest('header') ?? document.body).backgroundColor,
    }));
    expect(farben.umriss).not.toBe(farben.leiste);
    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('[data-rundgang-ziel]')).toHaveCount(0);
  });

  test('auch schmal und niedrig (320 × 560) steht die Karte beim Element', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'schmal-320', 'Eine Grösse genügt');
    await page.setViewportSize({ width: 320, height: 560 });
    await page.goto('/kasse/belege');
    await page.getByRole('button', { name: 'Rundgang' }).click();
    await expect(page.getByRole('dialog', { name: 'Willkommen in der Werkbank' })).toBeVisible();
    await durchlaufen(page);
  });

  test('Öffnen und Weiterblättern verschiebt auf der Seite nichts', async ({ page }) => {
    await page.goto('/bestellen');
    await page.evaluate(() => document.fonts.ready);
    const vorher = await seiteVermessen(page);
    expect(vorher.inhalt).not.toBeNull();

    await page.getByRole('button', { name: 'Rundgang' }).click();
    await expect(page.getByRole('dialog', { name: 'Willkommen in der Werkbank' })).toBeVisible();
    expect(await seiteVermessen(page)).toEqual(vorher);

    await page.getByRole('button', { name: 'Weiter' }).click();
    await expect(page.getByRole('dialog', { name: 'Bestellfenster heute' })).toBeVisible();
    // Das Tourenband ist niedrig: Die Karte hat in jeder Breite direkt darunter Platz.
    await lagePruefen(page, { nurNebenan: true });
    expect(await seiteVermessen(page)).toEqual(vorher);
  });

  test('Zurück führt zum vorigen Schritt, Escape schliesst', async ({ page }) => {
    await page.goto('/bestellen');
    await page.getByRole('button', { name: 'Rundgang' }).click();
    await page.getByRole('button', { name: 'Weiter' }).click();
    await expect(page.getByRole('dialog', { name: 'Bestellfenster heute' })).toBeVisible();
    await expect(page.locator('[data-rundgang-ziel]')).toHaveCount(1);
    await page.getByRole('button', { name: 'Zurück' }).click();
    await expect(page.getByRole('dialog', { name: 'Willkommen in der Werkbank' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

// Ein eigenes Konto, das den Rundgang noch nicht kennt: Alle anderen Testkonten haben ihn
// schon gesehen, sonst stünde er in jedem Test im Weg (E28, E43).
test.describe('Rundgang beim ersten Anmelden', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('startet beim ersten Anmelden von selbst, danach nicht mehr', async ({ page }, info) => {
    test.skip(info.project.name !== 'breit-1440', 'Ein Konto, ein erstes Mal: eine Breite genügt');
    const konto = rundgangKonto();
    await rundgangVergessen(konto.email);
    await page.goto('/anmelden');
    await page.getByLabel('E-Mail').fill(konto.email);
    await page.getByLabel('Passwort').fill(konto.passwort);
    const gemerkt = page.waitForResponse(
      (r) => r.request().method() === 'POST' && r.url().endsWith('/bestellen'),
    );
    await page.getByRole('button', { name: 'Anmelden' }).click();
    const willkommen = page.getByRole('dialog', { name: 'Willkommen in der Werkbank' });
    await expect(willkommen).toBeVisible();
    await expect(willkommen.getByRole('button', { name: 'Weiter' })).toBeFocused();
    await gemerkt;
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Bestellen' })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

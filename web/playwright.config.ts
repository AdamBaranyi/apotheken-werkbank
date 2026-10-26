import { defineConfig, devices } from '@playwright/test';

/*
 * Browser-Tests in drei Breiten. Lokal laufen sie gegen den Entwicklungsserver
 * (BASIS_URL=http://localhost:3500), in der CI gegen den Produktionsbuild auf
 * 3502 mit der Grosshandel-Attrappe auf 3501. Konten und Zugänge legt
 * scripts/lokal-einrichten.ts vorher an.
 */
const BASIS = process.env.BASIS_URL ?? 'http://localhost:3502';
const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: CI ? 1 : 0,
  workers: CI ? 1 : 2,
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './e2e/anmeldung.setup.ts',
  use: {
    baseURL: BASIS,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'schmal-320',
      use: { ...devices['Desktop Chrome'], viewport: { width: 320, height: 720 } },
    },
    {
      name: 'tablet-768',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'breit-1440',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  ...(process.env.BASIS_URL
    ? {}
    : {
        webServer: [
          {
            command: 'MANDANTEN_DATEI=../.lokal/mandanten.json NACHTBETRIEB=nie node src/start.ts',
            cwd: '../grosshandel-attrappe',
            url: 'http://127.0.0.1:3501/gesundheit',
            reuseExistingServer: !CI,
          },
          {
            command: './node_modules/.bin/next start --port 3502',
            url: 'http://localhost:3502/anmelden',
            reuseExistingServer: !CI,
            timeout: 120_000,
          },
        ],
      }),
});

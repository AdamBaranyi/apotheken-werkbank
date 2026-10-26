import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/*
 * Unit-Tests ohne Datenbank: Skripte im Wurzelverzeichnis, Grosshandel-Attrappe
 * und die reinen Teile der Web-App. Datenbank- und Browser-Tests haben eigene
 * Konfigurationen (vitest.db.config.ts, web/playwright.config.ts).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'grosshandel-attrappe/test/**/*.test.ts', 'web/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'web/e2e/**', 'web/.next/**'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./web', import.meta.url)),
      'server-only': fileURLToPath(
        new URL('./tests/attrappen-module/server-only.ts', import.meta.url),
      ),
    },
  },
});

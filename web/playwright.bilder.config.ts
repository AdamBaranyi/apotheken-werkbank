import { defineConfig } from '@playwright/test';
import haupt from './playwright.config';

/*
 * Zwischenbilder für Bericht und Fallstudie: dieselben Server, Breiten und
 * Konten wie die Browser-Tests, aber eigene Ablage (bilder/ausgabe, nicht im
 * Repo). Aufruf aus dem Wurzelordner: bun run bilder
 */
export default defineConfig({
  ...haupt,
  testDir: './bilder',
  retries: 0,
  reporter: 'list',
});

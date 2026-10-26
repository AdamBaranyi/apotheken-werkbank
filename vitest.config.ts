import { defineConfig } from 'vitest/config';

/*
 * Tests der Skripte im Wurzelverzeichnis. Web-App und Grosshandel-Attrappe
 * bringen eigene Tests mit, sobald es sie gibt.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});

import { defineConfig } from 'vitest/config';

/*
 * Tests der Skripte im Wurzelverzeichnis und der Grosshandel-Attrappe. Die
 * Web-App bringt ihre eigenen Tests mit.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'grosshandel-attrappe/test/**/*.test.ts'],
  },
});

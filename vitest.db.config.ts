import { defineConfig } from 'vitest/config';

/*
 * Tests der Datenbankregeln gegen die lokale Supabase-Datenbank
 * (`bunx supabase start`, Port 54402). Ohne laufende Datenbank scheitern sie –
 * sie überspringen sich nie still. Dateien laufen nacheinander, jede Probe in
 * einer eigenen Transaktion mit Rollback.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['supabase/tests/**/*.test.ts'],
    fileParallelism: false,
  },
});

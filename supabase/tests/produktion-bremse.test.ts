import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { poolerUrl, scramVerifier } from '../../scripts/produktion-bremse.ts';
import { DB_URL } from './hilfen.ts';

/*
 * Das Passwort der Rolle werkbank_bremse gelangt nie im Klartext nach
 * Supabase, nur als SCRAM-Verifier – so, wie Postgres es selbst speichert.
 * Ob der selbst gerechnete Verifier stimmt, zeigt nur Postgres: Mit dem
 * Klartext muss eine Rolle hereinkommen, mit einem anderen nicht.
 */
describe('Passwort der Bremse für die Produktion', () => {
  it('Postgres nimmt den Verifier an und prüft das Passwort damit', async () => {
    const rolle = `probe_scram_${randomBytes(4).toString('hex')}`;
    const passwort = randomBytes(24).toString('hex');
    const verwaltung = new pg.Client({ connectionString: DB_URL });
    await verwaltung.connect();
    await verwaltung.query(`create role ${rolle} login password '${scramVerifier(passwort)}'`);
    const als = (pw: string) => {
      const url = new URL(DB_URL);
      url.username = rolle;
      url.password = pw;
      return new pg.Client({ connectionString: url.toString() });
    };
    try {
      const richtig = als(passwort);
      await richtig.connect();
      const { rows } = await richtig.query<{ wer: string }>('select current_user as wer');
      expect(rows[0]?.wer).toBe(rolle);
      await richtig.end();
      await expect(als('falsch').connect()).rejects.toThrow(/password authentication failed/);
    } finally {
      await verwaltung.query(`drop role ${rolle}`);
      await verwaltung.end();
    }
  });

  it('der Verifier hat das Format von Postgres und verrät das Passwort nicht', () => {
    const verifier = scramVerifier('geheim123');
    expect(verifier).toMatch(
      /^SCRAM-SHA-256\$4096:[A-Za-z0-9+/=]{24}\$[A-Za-z0-9+/=]{44}:[A-Za-z0-9+/=]{44}$/,
    );
    expect(verifier).not.toContain('geheim123');
    expect(scramVerifier('geheim123')).not.toBe(verifier);
  });

  it('die Adresse für Vercel geht über den Pooler, ohne sslmode', () => {
    expect(poolerUrl('abc')).toMatch(
      /^postgresql:\/\/werkbank_bremse\.[a-z]{20}:abc@aws-\d-eu-central-1\.pooler\.supabase\.com:6543\/postgres$/,
    );
  });
});

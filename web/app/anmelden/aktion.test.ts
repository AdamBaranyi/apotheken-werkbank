import { beforeAll, describe, expect, it, vi } from 'vitest';

/*
 * Die Anmeldung bei gestörter Bremse. Liesse sie dann durch, könnte jemand die
 * Bremse gezielt überlasten (die Rolle hat höchstens 20 Verbindungen) und
 * danach unbegrenzt Passwörter raten. Darum: lieber niemanden hereinlassen.
 * Die Zählregeln selbst prüfen die Datenbank- und Browser-Tests.
 */
const { anmeldung } = vi.hoisted(() => ({ anmeldung: vi.fn() }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/navigation', () => ({
  redirect: (ziel: string) => {
    throw new Error(`weiter nach ${ziel}`);
  },
}));
vi.mock('@/lib/supabase/server', () => ({
  supabaseServer: async () => ({ auth: { signInWithPassword: anmeldung } }),
}));

beforeAll(() => {
  process.env.SUPABASE_URL = 'http://127.0.0.1:54401';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
  process.env.ZUGANG_SCHLUESSEL = Buffer.alloc(32).toString('base64');
  process.env.GROSSHANDEL_ERLAUBT = 'http://127.0.0.1:3501/msv3';
  // Port 9 (discard) nimmt nichts an: Die Bremse ist eingerichtet, aber gestört.
  process.env.BREMSE_DATENBANK_URL = 'postgres://werkbank_bremse:x@127.0.0.1:9/postgres';
});

describe('Anmeldung', () => {
  it('bei gestörter Bremse: kein Passwort geprüft, Meldung der Störung', async () => {
    anmeldung.mockResolvedValue({ error: { status: 400, message: 'Invalid login credentials' } });
    const protokoll = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { anmelden } = await import('./aktion');
    const form = new FormData();
    form.set('email', 'inhaber.nord@werkbank.test');
    form.set('passwort', 'geraten');
    expect(await anmelden({}, form)).toEqual({
      fehler: 'Die Anmeldung ist gerade gestört. Bitte in einigen Minuten erneut.',
      email: 'inhaber.nord@werkbank.test',
    });
    expect(anmeldung).not.toHaveBeenCalled();
    protokoll.mockRestore();
  });
});

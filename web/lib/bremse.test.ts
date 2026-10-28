import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { bremseSchluessel, bremseVersuch, grosshandelBremse, vertrauteIp } from './bremse';

/*
 * Die App-Seite der Bremse. Die Zählregeln selbst prüfen die Datenbanktests
 * (supabase/tests/bremse.test.ts); hier: Schlüssel ohne Klartext, IP nur von
 * Vercel, und was ein Ausfall der Datenbank heisst. Die Bremse meldet ihn;
 * die Anmeldung sperrt dann (app/anmelden/aktion.test.ts), der Aufruf beim
 * Grosshändler läuft weiter.
 */
beforeAll(() => {
  process.env.SUPABASE_URL = 'http://127.0.0.1:54401';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
  process.env.ZUGANG_SCHLUESSEL = Buffer.alloc(32).toString('base64');
  process.env.GROSSHANDEL_ERLAUBT = 'http://127.0.0.1:3501/msv3';
  // Port 9 (discard) nimmt nichts an: die Datenbank ist «ausgefallen».
  process.env.BREMSE_DATENBANK_URL = 'postgres://werkbank_bremse:x@127.0.0.1:9/postgres';
});
afterAll(() => {
  delete process.env.BREMSE_DATENBANK_URL;
});

describe('Bremse in der App', () => {
  it('Schlüssel sind HMAC je Art, ohne E-Mail oder IP im Klartext', () => {
    const konto = bremseSchluessel('konto', 'Inhaber.Nord@werkbank.test');
    expect(konto).toMatch(/^konto:[0-9a-f]{64}$/);
    expect(konto).not.toContain('werkbank');
    expect(bremseSchluessel('konto', ' inhaber.nord@werkbank.test ')).toBe(konto);
    expect(bremseSchluessel('ip', 'Inhaber.Nord@werkbank.test').slice(3)).not.toBe(konto.slice(6));
  });

  it('nimmt die IP nur auf Vercel, wo der Rand die Kopfzeile selbst setzt', () => {
    const kopf = new Headers({ 'x-real-ip': '203.0.113.7' });
    expect(vertrauteIp(kopf, { VERCEL: '1' })).toBe('203.0.113.7');
    expect(vertrauteIp(kopf, {})).toBeNull();
    expect(
      vertrauteIp(new Headers({ 'x-real-ip': '1.2.3.4, 5.6.7.8' }), { VERCEL: '1' }),
    ).toBeNull();
  });

  it('meldet «gestört», wenn die Datenbank nicht antwortet, und schreibt es ins Protokoll', async () => {
    const protokoll = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await bremseVersuch([{ schluessel: 'konto:a', grenze: 1 }], 900)).toEqual({
      stand: 'gestoert',
    });
    expect(protokoll).toHaveBeenCalledWith('Bremse nicht erreichbar', 'ECONNREFUSED');
    protokoll.mockRestore();
  });

  it('beim Grosshändler lässt eine gestörte Bremse durch: Bestellen geht vor', async () => {
    const protokoll = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await grosshandelBremse('3f6b1c1e-0000-4000-8000-000000000001')).toBeNull();
    protokoll.mockRestore();
  });
});

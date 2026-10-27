import { describe, expect, it } from 'vitest';
import { zurAnmeldung } from './zutritt';

describe('Zutritt ohne Sitzung', () => {
  it('leitet Seitenaufrufe ohne Sitzung zur Anmeldung', () => {
    expect(zurAnmeldung({ angemeldet: false, pfad: '/bestellen', serverAktion: false })).toBe(true);
  });

  it('lässt Angemeldete und die Anmeldung selbst durch', () => {
    expect(zurAnmeldung({ angemeldet: true, pfad: '/bestellen', serverAktion: false })).toBe(false);
    expect(zurAnmeldung({ angemeldet: false, pfad: '/anmelden', serverAktion: false })).toBe(false);
  });

  it('leitet Server-Aktionen nie um: Die Aktion prüft selbst und leitet so um, dass Next es versteht (#1)', () => {
    expect(zurAnmeldung({ angemeldet: false, pfad: '/bestellen', serverAktion: true })).toBe(false);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { meldungAusFehler } from './fehler';

describe('Meldung aus einem Fehler der Datenbank', () => {
  it('zeigt die Meldung der eigenen Regeln (WK…, WB…) wörtlich', () => {
    const fehler = { code: 'WK002', message: 'Fictolat Saft ist rezeptpflichtig.' };
    expect(meldungAusFehler(fehler, 'allgemein')).toBe('Fictolat Saft ist rezeptpflichtig.');
  });

  it('zeigt bei fehlender Berechtigung keine Interna', () => {
    const fehler = {
      code: '42501',
      message: 'new row violates row-level security policy for table "verkaeufe"',
    };
    expect(meldungAusFehler(fehler, 'allgemein')).toBe('Dafür fehlt die Berechtigung.');
  });

  it('alles andere bleibt allgemein und landet nur mit Code im Protokoll', () => {
    const protokoll = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fehler = { code: '23502', message: 'null value in column "geheim" violates …' };
    expect(meldungAusFehler(fehler, 'Nicht gebucht.')).toBe('Nicht gebucht.');
    expect(protokoll).toHaveBeenCalledWith('Datenbank meldet', '23502');
    protokoll.mockRestore();
  });
});

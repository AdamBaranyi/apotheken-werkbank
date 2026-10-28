import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Vertragsdaten } from '@/lib/msv3/schema';

/*
 * Die Vertragsdaten (Bestellfenster, Touren) für die Seite «Bestellen». Jeder
 * Aufruf der Seite fragte beim Grosshändler nach, ungebremst. Jetzt: je
 * Zugang höchstens alle fünf Minuten, und jede Anfrage zählt in der Bremse.
 */
const { abfragen, bremse } = vi.hoisted(() => ({ abfragen: vi.fn(), bremse: vi.fn() }));
vi.mock('@/lib/msv3/anfragen', () => ({ vertragsdatenAbfragen: abfragen }));
vi.mock('@/lib/bremse', () => ({ grosshandelBremse: bremse }));
vi.mock('@/lib/zugang', () => ({
  zugangLaden: async () => ({ basisUrl: 'http://x/msv3', kundenkennung: 'k', passwort: 'p' }),
}));

const { vertragLaden } = await import('./vertrag');
const VERTRAG = { kundenkennung: 'k', bestellfenster: [] } as unknown as Vertragsdaten;
const T = Date.parse('2026-10-28T10:00:00.000Z');

beforeEach(() => {
  abfragen.mockReset().mockResolvedValue(VERTRAG);
  bremse.mockReset().mockResolvedValue(null);
});

describe('Vertragsdaten', () => {
  it('je Zugang höchstens alle fünf Minuten beim Grosshändler', async () => {
    expect(await vertragLaden('apotheke', 'zugang-1', T)).toBe(VERTRAG);
    expect(await vertragLaden('apotheke', 'zugang-1', T + 299_000)).toBe(VERTRAG);
    expect(abfragen).toHaveBeenCalledTimes(1);
    await vertragLaden('apotheke', 'zugang-1', T + 300_000);
    expect(abfragen).toHaveBeenCalledTimes(2);
    expect(bremse).toHaveBeenCalledTimes(2);
  });

  it('gebremst: die Meldung statt einer Anfrage', async () => {
    bremse.mockResolvedValue(
      'Zu viele Anfragen an den Grosshändler. Bitte in einer Minute erneut.',
    );
    expect(await vertragLaden('apotheke', 'zugang-2', T)).toBe(
      'Zu viele Anfragen an den Grosshändler. Bitte in einer Minute erneut.',
    );
    expect(abfragen).not.toHaveBeenCalled();
  });

  it('ein anderer Zugang fragt selbst nach', async () => {
    await vertragLaden('apotheke', 'zugang-3', T);
    await vertragLaden('apotheke', 'zugang-4', T);
    expect(abfragen).toHaveBeenCalledTimes(2);
  });
});

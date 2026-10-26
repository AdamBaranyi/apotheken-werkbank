import type { Artikel } from './typen.ts';

/**
 * Lager der Attrappe, im Speicher. Der Bestand gilt für alle Mandanten
 * gemeinsam: Wer zuerst bestellt, bekommt die Ware – wie bei einem echten
 * Grosshändler. Ein Neustart setzt den Bestand auf den Ausgangsstand zurück.
 */
export class Lager {
  readonly #artikel = new Map<string, Artikel>();

  constructor(ausgangsstand: readonly Artikel[]) {
    for (const a of ausgangsstand) this.#artikel.set(a.pzn, { ...a });
  }

  finden(pzn: string): Artikel | undefined {
    const artikel = this.#artikel.get(pzn);
    return artikel ? { ...artikel } : undefined;
  }

  /** Bucht die zugeteilten Mengen ab. Mehr als vorhanden geht nie ab. */
  reservieren(pzn: string, ausHauptlager: number, ausVerbund: number): void {
    const artikel = this.#artikel.get(pzn);
    if (!artikel) return;
    artikel.bestand = Math.max(0, artikel.bestand - ausHauptlager);
    artikel.verbundBestand = Math.max(0, artikel.verbundBestand - ausVerbund);
  }
}

import type { Anteil, Artikel, Defektgrund, Liefervorgabe } from './typen.ts';

/**
 * Verteilt die angefragte Menge einer Position auf Anteile nach Tabelle 2 des
 * Pflichtenhefts: zuerst Hauptlager (Normal), dann zweites Lager (Verbund),
 * dann Hersteller (Nachlieferung). Was die Liefervorgabe nicht erlaubt, kommt
 * als «KeineLieferungAber…Moeglich» zurück. Reine Funktion: Sie reserviert
 * nichts, sie sagt nur, wie viel aus welchem Lager käme.
 */
export interface Zuteilung {
  anteile: Anteil[];
  ausHauptlager: number;
  ausVerbund: number;
}

const RANG: Record<Liefervorgabe, number> = {
  Normal: 0,
  MaxVerbund: 1,
  MaxNachlieferung: 2,
  MaxDispo: 3,
};

function erlaubt(vorgabe: Liefervorgabe, mindestens: Liefervorgabe): boolean {
  return RANG[vorgabe] >= RANG[mindestens];
}

/** Gründe, aus denen ein Artikel gar nicht geliefert wird. */
export function sperrgrund(artikel: Artikel | undefined, darfBtm: boolean): Defektgrund | null {
  if (!artikel) return 'ArtikelNrUnbekannt';
  if (artikel.sperre) return artikel.sperre;
  if (artikel.btm && !darfBtm) return 'KeinBezug';
  return null;
}

function nurDispo(menge: number, vorgabe: Liefervorgabe): Zuteilung {
  const typ = erlaubt(vorgabe, 'MaxDispo') ? 'Dispo' : 'KeineLieferungAberDispoMoeglich';
  return {
    anteile: [{ typ, menge, defektgrund: 'NichtGefuehrt' }],
    ausHauptlager: 0,
    ausVerbund: 0,
  };
}

export function zuteilen(
  artikel: Artikel | undefined,
  menge: number,
  vorgabe: Liefervorgabe,
  darfBtm: boolean,
): Zuteilung {
  const grund = sperrgrund(artikel, darfBtm);
  if (grund || !artikel) {
    return {
      anteile: [{ typ: 'NichtLieferbar', menge, defektgrund: grund ?? 'ArtikelNrUnbekannt' }],
      ausHauptlager: 0,
      ausVerbund: 0,
    };
  }
  if (!artikel.lagerartikel) return nurDispo(menge, vorgabe);

  const anteile: Anteil[] = [];
  const ausHauptlager = Math.min(menge, Math.max(artikel.bestand, 0));
  if (ausHauptlager > 0) anteile.push({ typ: 'Normal', menge: ausHauptlager });
  let rest = menge - ausHauptlager;

  let ausVerbund = 0;
  const verbundMoeglich = Math.min(rest, Math.max(artikel.verbundBestand, 0));
  if (verbundMoeglich > 0) {
    if (erlaubt(vorgabe, 'MaxVerbund')) {
      anteile.push({ typ: 'Verbund', menge: verbundMoeglich });
      ausVerbund = verbundMoeglich;
    } else {
      anteile.push({
        typ: 'KeineLieferungAberVerbundMoeglich',
        menge: verbundMoeglich,
        defektgrund: 'FehltZurzeit',
      });
    }
    rest -= verbundMoeglich;
  }

  if (rest > 0 && artikel.nachlieferbar) {
    const typ = erlaubt(vorgabe, 'MaxNachlieferung')
      ? 'Nachlieferung'
      : 'KeineLieferungAberNachlieferungMoeglich';
    anteile.push({ typ, menge: rest, defektgrund: 'FehltZurzeit' });
    rest = 0;
  }
  if (rest > 0) anteile.push({ typ: 'NichtLieferbar', menge: rest, defektgrund: 'NichtLieferbar' });

  return { anteile, ausHauptlager, ausVerbund };
}

/**
 * Unspezifische Rückmeldung (Kap. 6.4.2): genau ein Anteil ohne Menge.
 * Voll lieferbar → Normal mit «KeineAngabe»; gar nicht → NichtLieferbar mit
 * Grund; teilweise oder nur über Umwege → erster lieferbarer Typ mit TeilDefekt.
 */
export function unspezifisch(zuteilung: Zuteilung): Anteil {
  const [erster] = zuteilung.anteile;
  if (zuteilung.anteile.length === 1 && erster?.typ === 'Normal') {
    return { typ: 'Normal', defektgrund: 'KeineAngabe' };
  }
  const lieferbar = zuteilung.anteile.find((a) =>
    ['Normal', 'Verbund', 'Nachlieferung', 'Dispo'].includes(a.typ),
  );
  if (lieferbar) return { typ: lieferbar.typ, defektgrund: 'TeilDefekt' };
  return { typ: 'NichtLieferbar', defektgrund: erster?.defektgrund ?? 'NichtLieferbar' };
}

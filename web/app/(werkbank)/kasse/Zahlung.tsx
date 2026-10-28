'use client';

import { useState } from 'react';
import { betragText, centAusEingabe, type Waehrung } from '@/lib/geld';
import styles from './kasse.module.css';

/**
 * Zahlung bar oder mit Karte, als Buchung ohne Zahlungsanbieter. Bei Bargeld
 * zeigt die Vorschau das Rückgeld; verbindlich prüft die Datenbank, ob der
 * Betrag reicht.
 */
export function Zahlung({ summe, waehrung }: { summe: number; waehrung: Waehrung }) {
  const [zahlart, setZahlart] = useState<'bar' | 'karte'>('bar');
  const [gegeben, setGegeben] = useState('');
  const cent = centAusEingabe(gegeben);
  const rueckgeld = cent !== null && cent >= summe ? cent - summe : null;
  const passend = (summe / 100).toFixed(2).replace('.', ',');

  return (
    <fieldset className={styles.zahlung}>
      <legend>Zahlung</legend>
      <div className={styles.zahlarten}>
        {(['bar', 'karte'] as const).map((art) => (
          <label key={art} className={styles.zahlart}>
            <input
              type="radio"
              name="zahlart"
              value={art}
              checked={zahlart === art}
              onChange={() => setZahlart(art)}
            />
            {art === 'bar' ? 'Bar' : 'Karte'}
          </label>
        ))}
      </div>
      {zahlart === 'bar' ? (
        <div className={styles.gegeben}>
          <label htmlFor="gegeben">Gegeben</label>
          <div className={styles.erfassenZeile}>
            <input
              id="gegeben"
              name="gegeben"
              inputMode="decimal"
              autoComplete="off"
              value={gegeben}
              onChange={(e) => setGegeben(e.target.value)}
              aria-describedby="rueckgeld"
              className={styles.betrag}
            />
            <button type="button" className={styles.zweitknopf} onClick={() => setGegeben(passend)}>
              Passend
            </button>
          </div>
          <p id="rueckgeld" className={`${styles.rueckgeld} ziffern`}>
            {rueckgeld !== null
              ? `Rückgeld ${betragText(rueckgeld, waehrung)}`
              : 'Betrag eintragen, etwa 20,00'}
          </p>
        </div>
      ) : (
        <p className={styles.karteHinweis}>Die Karte wird nur gebucht, ohne Zahlungsanbieter.</p>
      )}
    </fieldset>
  );
}

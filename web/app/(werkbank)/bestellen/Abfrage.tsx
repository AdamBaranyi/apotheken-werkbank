'use client';

import { useActionState } from 'react';
import { Anteile } from '@/components/anteile/Anteile';
import { pruefen, type PruefStand } from './aktion';
import styles from './bestellen.module.css';

export interface KatalogArtikel {
  pzn: string;
  name: string;
  packung: string;
  rezeptpflichtig: boolean;
}

/**
 * Mengen eintragen und beim Grosshändler anfragen. Die Antwort steht direkt
 * beim Artikel. Mengen bleiben nach dem Senden stehen (React setzt ein
 * Formular sonst zurück); der Knopf behält den Fokus und sperrt sich nur
 * per aria-disabled.
 */
export function Abfrage({ artikel, zugangId }: { artikel: KatalogArtikel[]; zugangId: string }) {
  const [stand, aktion, laeuft] = useActionState<PruefStand, FormData>(pruefen, { mengen: {} });
  return (
    <form action={aktion} className={styles.abfrage}>
      <input type="hidden" name="zugangId" value={zugangId} />
      <table className={styles.tabelle}>
        <caption className="unsichtbar">Artikel mit Menge und Verfügbarkeit</caption>
        <thead>
          <tr>
            <th scope="col">PZN</th>
            <th scope="col">Artikel</th>
            <th scope="col">Menge</th>
            <th scope="col">Verfügbarkeit</th>
          </tr>
        </thead>
        <tbody>
          {artikel.map((a) => {
            const ergebnis = stand.ergebnisse?.[a.pzn];
            const menge = stand.mengen[a.pzn];
            return (
              <tr key={a.pzn}>
                <td data-titel="PZN" className="ziffern">
                  {a.pzn}
                </td>
                <td data-titel="Artikel">
                  {a.name}, {a.packung}
                  {a.rezeptpflichtig ? <span className={styles.rx}>Rx</span> : null}
                </td>
                <td data-titel="Menge">
                  <input
                    name={`menge-${a.pzn}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={9999}
                    defaultValue={menge ?? ''}
                    aria-label={`Menge ${a.name}, ${a.packung}`}
                    className={styles.menge}
                  />
                </td>
                <td data-titel="Verfügbarkeit">
                  {ergebnis && menge ? <Anteile anteile={ergebnis} angefragt={menge} /> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className={styles.fuss}>
        <p role="alert" className={stand.fehler ? styles.fehler : 'unsichtbar'}>
          {stand.fehler ?? ''}
        </p>
        <button
          type="submit"
          className={styles.knopf}
          aria-disabled={laeuft}
          onClick={(e) => {
            if (laeuft) e.preventDefault();
          }}
        >
          {laeuft ? 'Frage den Grosshändler …' : 'Verfügbarkeit prüfen'}
        </button>
      </div>
    </form>
  );
}

'use client';

import { useActionState } from 'react';
import { Anteile } from '@/components/anteile/Anteile';
import { zusammenhalten } from '@/lib/satz';
import { pruefen, type PruefStand } from './aktion';
import styles from './bestellen.module.css';
import { bestellungSenden, type SendeStand } from './senden';

export interface KatalogArtikel {
  pzn: string;
  name: string;
  packung: string;
  rezeptpflichtig: boolean;
}

/**
 * Mengen eintragen und beim Grosshändler anfragen. Die Antwort steht direkt
 * beim Artikel. Mengen bleiben nach dem Senden stehen (React setzt ein
 * Formular sonst zurück); die Knöpfe behalten den Fokus und sperren sich nur
 * per aria-disabled. Enter löst den ersten Knopf aus, die unverbindliche
 * Anfrage; bestellt wird nur mit dem zweiten. Der Schlüssel stammt aus dem
 * Seitenaufbau und wird zur Bestell-ID: Ein zweiter Klick bestellt nichts doppelt.
 */
export function Abfrage({
  artikel,
  zugangId,
  schluessel,
}: {
  artikel: KatalogArtikel[];
  zugangId: string;
  schluessel: string;
}) {
  const [stand, aktion, laeuft] = useActionState<PruefStand, FormData>(pruefen, { mengen: {} });
  const [sendeStand, senden, sendet] = useActionState<SendeStand, FormData>(bestellungSenden, {});
  const beschaeftigt = laeuft || sendet;
  const fehler = sendeStand.fehler ?? stand.fehler;
  return (
    <form action={aktion} className={styles.abfrage}>
      <input type="hidden" name="zugangId" value={zugangId} />
      <input type="hidden" name="schluessel" value={schluessel} />
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
                  {/* Ein Kind für das Raster der schmalen Ansicht: Name und Rx bleiben zusammen. */}
                  <span>
                    {zusammenhalten(`${a.name}, ${a.packung}`)}
                    {a.rezeptpflichtig ? (
                      <span className={styles.rx}>
                        <span aria-hidden="true">Rx</span>
                        <span className="unsichtbar">rezeptpflichtig</span>
                      </span>
                    ) : null}
                  </span>
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
        <p role="alert" className={fehler ? styles.fehler : 'unsichtbar'}>
          {fehler ?? ''}
        </p>
        <div className={styles.knoepfe}>
          <button
            type="submit"
            className={styles.zweitknopf}
            aria-disabled={beschaeftigt}
            onClick={(e) => {
              if (beschaeftigt) e.preventDefault();
            }}
          >
            {laeuft ? 'Frage den Grosshändler …' : 'Verfügbarkeit prüfen'}
          </button>
          <button
            type="submit"
            formAction={senden}
            className={styles.knopf}
            aria-disabled={beschaeftigt}
            onClick={(e) => {
              if (beschaeftigt) e.preventDefault();
            }}
          >
            {sendet ? 'Bestellung wird gesendet …' : 'Verbindlich bestellen'}
          </button>
        </div>
      </div>
    </form>
  );
}

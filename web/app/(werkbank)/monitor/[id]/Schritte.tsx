import { dauerText, schrittText, type Laufbericht } from '@/lib/monitor/texte';
import listen from '../../liste.module.css';
import styles from '../monitor.module.css';

/** Die Schritte eines Laufs: was die Engine tat, wie oft, wie lange. */
export function Schritte({ schritte }: { schritte: Laufbericht['schritte'] }) {
  if (schritte.length === 0) return null;
  return (
    <section aria-labelledby="schritte-titel" className={styles.abschnitt}>
      <h2 id="schritte-titel">Schritte</h2>
      <table className={listen.tabelle}>
        <caption className="unsichtbar">Schritte des Laufs</caption>
        <thead>
          <tr>
            <th scope="col">Nr.</th>
            <th scope="col">Schritt</th>
            <th scope="col">Ergebnis</th>
            <th scope="col" className={listen.zahl}>
              Dauer
            </th>
          </tr>
        </thead>
        <tbody>
          {schritte.map((s) => (
            <tr key={`${s.nr}-${s.art}`}>
              <td data-titel="Nr." className="ziffern">
                {s.nr}
              </td>
              <td data-titel="Schritt" className={styles.umbruch}>
                {schrittText(s)}
              </td>
              <td data-titel="Ergebnis">
                {s.ergebnis === 'ok' ? 'erledigt' : 'gescheitert'}
                {s.versuche > 1 ? `, ${s.versuche} Versuche` : null}
                {s.meldung ? <span className={styles.schrittmeldung}>{s.meldung}</span> : null}
              </td>
              <td data-titel="Dauer" className={`${listen.zahl} ziffern`}>
                {dauerText(s.dauerMs)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

import type { Anteil } from '@/lib/msv3/schema';
import { ART, GRUND, gruppe, lieferung } from './texte';
import styles from './anteile.module.css';

/**
 * Zeigt, wie der Grosshändler eine Menge aufteilt: ein Balken aus Segmenten
 * (Breite = Menge, aus denselben Zahlen wie der Text) und darunter jede
 * Lieferart in Worten. Farbe nie allein – jede Art hat ein eigenes Muster.
 */
function zeile(a: Anteil, jetzt: Date): string {
  const wann = lieferung(a.lieferzeitpunkt, jetzt);
  const tour = a.tour ? `${ART[a.typ]} ${a.tour}${wann ? `, ${wann}` : ''}` : ART[a.typ];
  const grund = a.defektgrund ? GRUND[a.defektgrund] : undefined;
  return grund ? `${tour}, ${grund}` : tour;
}

export function Anteile({ anteile, angefragt }: { anteile: Anteil[]; angefragt: number }) {
  const mitMenge = anteile.every((a) => a.menge !== undefined);
  const jetzt = new Date();
  return (
    <div className={styles.anteile}>
      {mitMenge ? (
        <div className={styles.balken} aria-hidden="true">
          {anteile.map((a, i) => (
            <span
              key={i}
              className={styles.segment}
              data-gruppe={gruppe(a.typ)}
              style={{ flexGrow: a.menge ?? 0 }}
            />
          ))}
        </div>
      ) : null}
      <ul className={styles.liste}>
        {anteile.map((a, i) => (
          <li key={i} data-gruppe={gruppe(a.typ)}>
            <span className={styles.zeichen} aria-hidden="true" />
            <span>
              {a.menge !== undefined ? (
                <strong className={`ziffern ${styles.zahl}`}>
                  {a.menge} von {angefragt}
                </strong>
              ) : null}{' '}
              {zeile(a, jetzt)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

'use client';

import { useActionState } from 'react';
import { statusAbfragen, type AbfrageStand } from './abfragen';
import styles from './bestellung.module.css';

/** Fragt beim Grosshändler nach, ob die Bestellung angekommen ist – statt sie ein zweites Mal zu senden. */
export function StatusAbfrage({ bestellung }: { bestellung: string }) {
  const [stand, aktion, laeuft] = useActionState<AbfrageStand, FormData>(statusAbfragen, {});
  return (
    <form action={aktion} className={styles.abfrage}>
      <input type="hidden" name="bestellung" value={bestellung} />
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
        {laeuft ? 'Frage den Grosshändler …' : 'Status beim Grosshändler abfragen'}
      </button>
    </form>
  );
}

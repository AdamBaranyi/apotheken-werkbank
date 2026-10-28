'use client';

import { useActionState } from 'react';
import { stornieren, type StornoStand } from './stornieren';
import styles from './beleg.module.css';

/**
 * Storno mit Rückfrage: Erst das Aufklappen zeigt den Knopf, der bucht. Ein
 * Storno ändert den Beleg nicht, es bucht einen Gegenbeleg.
 */
export function Storno({ original, schluessel }: { original: string; schluessel: string }) {
  const [stand, aktion, laeuft] = useActionState<StornoStand, FormData>(stornieren, {});
  return (
    <details className={styles.storno}>
      <summary>Beleg stornieren</summary>
      <p>
        Das Storno bucht einen Gegenbeleg mit denselben Positionen und Preisen. Dieser Beleg bleibt
        unverändert und zeigt danach auf das Storno.
      </p>
      <form action={aktion} className={styles.stornoFormular}>
        <input type="hidden" name="original" value={original} />
        <input type="hidden" name="schluessel" value={schluessel} />
        <p role="alert" className={stand.fehler ? styles.fehler : 'unsichtbar'}>
          {stand.fehler ?? ''}
        </p>
        <button
          type="submit"
          className={styles.gefahr}
          aria-disabled={laeuft}
          onClick={(e) => {
            if (laeuft) e.preventDefault();
          }}
        >
          {laeuft ? 'Wird storniert …' : 'Ja, Beleg stornieren'}
        </button>
      </form>
    </details>
  );
}

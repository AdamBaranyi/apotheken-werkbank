'use client';

import { useActionState } from 'react';
import { tagAbschliessen, type AbschlussStand } from './aktion';
import styles from './abschluss.module.css';

export function Abschliessen() {
  const [stand, aktion, laeuft] = useActionState<AbschlussStand>(tagAbschliessen, {});
  return (
    <form action={aktion} className={styles.formular}>
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
        {laeuft ? 'Wird abgeschlossen …' : 'Tag abschliessen'}
      </button>
    </form>
  );
}

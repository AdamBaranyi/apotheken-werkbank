'use client';

import { useActionState } from 'react';
import { anmelden, type AnmeldeStand } from './aktion';
import styles from './anmelden.module.css';

export function Formular() {
  const [stand, aktion, laeuft] = useActionState<AnmeldeStand, FormData>(anmelden, {});
  return (
    <form action={aktion} className={styles.formular} noValidate>
      <label className={styles.feld}>
        <span>E-Mail</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={stand.email ?? ''}
          autoCapitalize="none"
          spellCheck={false}
        />
      </label>
      <label className={styles.feld}>
        <span>Passwort</span>
        <input name="passwort" type="password" autoComplete="current-password" required />
      </label>
      {/* Der Meldebereich steht leer im Dokument, damit Screenreader die Meldung ansagen. */}
      <p role="alert" className={stand.fehler ? styles.meldung : 'unsichtbar'}>
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
        {laeuft ? 'Wird angemeldet …' : 'Anmelden'}
      </button>
    </form>
  );
}

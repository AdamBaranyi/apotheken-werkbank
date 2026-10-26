import type { Metadata } from 'next';
import { Formular } from './Formular';
import styles from './anmelden.module.css';

export const metadata: Metadata = { title: 'Anmelden' };

export default function Anmelden() {
  return (
    <main className={styles.seite}>
      <p className={styles.marke}>Apotheken-Werkbank</p>
      <h1>Anmelden</h1>
      <p className={styles.hinweis}>
        Übungsprojekt mit erfundenen Apotheken, Artikeln und Grosshändlern. Konten legt die Apotheke
        an; eine Registrierung gibt es nicht.
      </p>
      <Formular />
    </main>
  );
}

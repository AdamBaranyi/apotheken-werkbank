import type { Metadata } from 'next';
import Link from 'next/link';
import styles from './not-found.module.css';

export const metadata: Metadata = { title: 'Nicht gefunden' };

/** Auch für fremde Belege: «nicht gefunden» verrät nicht, ob es sie gibt. */
export default function NichtGefunden() {
  return (
    <main id="inhalt" className={styles.seite}>
      <h1>Nicht gefunden</h1>
      <p>Diese Seite gibt es nicht, oder sie gehört zu einer anderen Apotheke.</p>
      <p>
        <Link href="/kasse">Zur Kasse</Link>
      </p>
    </main>
  );
}

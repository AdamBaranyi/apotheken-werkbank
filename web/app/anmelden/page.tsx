import type { Metadata } from 'next';
import { Fusszeile } from '@/components/fuss/Fusszeile';
import { Formular } from './Formular';
import { Willkommen } from './Willkommen';
import styles from './anmelden.module.css';

export const metadata: Metadata = { title: 'Anmelden' };

type Props = { searchParams: Promise<{ sitzung?: string | string[] }> };

export default async function Anmelden({ searchParams }: Props) {
  const { sitzung } = await searchParams;
  return (
    <div className={styles.seite}>
      <Willkommen />
      <div className={styles.rechts}>
        <main className={styles.spalte}>
          <p className={styles.marke}>Apotheken-Werkbank</p>
          <h1>Anmelden</h1>
          {/* Von einer Server-Aktion, deren Sitzung abgelaufen war (#1). */}
          {sitzung === 'abgelaufen' ? (
            <p role="status" className={styles.abgelaufen}>
              Die Sitzung ist abgelaufen. Bitte neu anmelden.
            </p>
          ) : null}
          <p className={styles.zweck}>
            Die Werkbank für Vor-Ort-Apotheken: beim Grosshandel über MSV3 bestellen, an der Kasse
            verkaufen und sehen, was die Kassen-Engine tut.
          </p>
          <p className={styles.hinweis}>
            Übungsprojekt mit erfundenen Apotheken, Artikeln und Grosshändlern. Konten legt die
            Apotheke an; eine Registrierung gibt es nicht. Als Demo ohne Zwei-Faktor-Anmeldung; im
            echten Betrieb gehört sie dazu.
          </p>
          <Formular />
        </main>
        <Fusszeile />
      </div>
    </div>
  );
}

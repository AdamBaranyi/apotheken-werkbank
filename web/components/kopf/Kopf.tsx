import Link from 'next/link';
import { Rundgang } from '@/components/rundgang/Rundgang';
import { Bereiche } from './Bereiche';
import styles from './kopf.module.css';

/** Kopf der Werkbank: Marke, Bereiche, Apotheke, Abmelden. */

interface Props {
  apotheke: string;
  email: string;
  /** Erstes Anmelden: Der Rundgang startet von selbst (E43). */
  rundgangVonSelbst: boolean;
}

export function Kopf({ apotheke, email, rundgangVonSelbst }: Props) {
  return (
    <header className={styles.kopf}>
      <a href="#inhalt" className={styles.sprung}>
        Zum Inhalt
      </a>
      <div className={styles.zeile}>
        <Link href="/bestellen" className={styles.marke}>
          Apotheken-Werkbank
        </Link>
        <Bereiche />
        <div className={styles.konto}>
          <span className={styles.apotheke}>{apotheke}</span>
          <span className={styles.email}>{email}</span>
          <Rundgang vonSelbst={rundgangVonSelbst} />
          <form action="/abmelden" method="post">
            <button type="submit" className={styles.abmelden}>
              Abmelden
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

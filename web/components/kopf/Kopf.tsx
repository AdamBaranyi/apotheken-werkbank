import Link from 'next/link';
import styles from './kopf.module.css';

/** Kopf der Werkbank: Marke, Bereiche, Apotheke, Abmelden. Nur Bereiche, die es schon gibt. */
const BEREICHE = [{ pfad: '/bestellen', name: 'Bestellen' }];

export function Kopf({ apotheke, email }: { apotheke: string; email: string }) {
  return (
    <header className={styles.kopf}>
      <a href="#inhalt" className={styles.sprung}>
        Zum Inhalt
      </a>
      <div className={styles.zeile}>
        <Link href="/bestellen" className={styles.marke}>
          Apotheken-Werkbank
        </Link>
        <nav aria-label="Bereiche">
          <ul className={styles.bereiche}>
            {BEREICHE.map((b) => (
              <li key={b.pfad}>
                <Link href={b.pfad}>{b.name}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.konto}>
          <span className={styles.apotheke}>{apotheke}</span>
          <span className={styles.email}>{email}</span>
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

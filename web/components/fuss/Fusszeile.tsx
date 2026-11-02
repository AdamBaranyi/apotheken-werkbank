import styles from './fusszeile.module.css';

const IMPRESSUM = 'https://adambaranyi.xyz/de/impressum/';
const QUELLTEXT = 'https://github.com/AdamBaranyi/apotheken-werkbank';

/**
 * Copyright wie in den anderen Apps (E45): Jahr, Name und der Hinweis auf
 * erfundene Daten, dazu Impressum und Quelltext. Beide öffnen in neuem Tab,
 * damit die Werkbank offen bleibt.
 */
export function Fusszeile() {
  return (
    <footer className={styles.fuss}>
      <p>© 2026 Adam Baranyi. Übungsprojekt mit erfundenen Daten.</p>
      <ul className={styles.links}>
        <li>
          <a href={IMPRESSUM} target="_blank" rel="noopener noreferrer">
            Impressum<span className="unsichtbar"> (öffnet in neuem Tab)</span>
          </a>
        </li>
        <li>
          <a href={QUELLTEXT} target="_blank" rel="noopener noreferrer">
            Quelltext auf GitHub<span className="unsichtbar"> (öffnet in neuem Tab)</span>
          </a>
        </li>
      </ul>
    </footer>
  );
}

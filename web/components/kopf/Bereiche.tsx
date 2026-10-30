'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './kopf.module.css';

/** Die Bereiche der Werkbank. Der aktuelle trägt aria-current, sichtbar unterstrichen. */
const BEREICHE = [
  { pfad: '/kasse', name: 'Kasse' },
  { pfad: '/kasse/belege', name: 'Belege' },
  { pfad: '/kasse/abschluss', name: 'Tagesabschluss' },
  { pfad: '/bestellen', name: 'Bestellen' },
  { pfad: '/bestellungen', name: 'Bestellungen' },
  { pfad: '/monitor', name: 'Flow-Monitor' },
];

function aktiv(pfad: string, aktuell: string): boolean {
  // Der längste passende Bereich gewinnt: /kasse/belege/… ist «Belege», nicht «Kasse».
  const passend = BEREICHE.filter((b) => aktuell === b.pfad || aktuell.startsWith(`${b.pfad}/`));
  const laengster = passend.sort((a, b) => b.pfad.length - a.pfad.length)[0];
  return laengster?.pfad === pfad;
}

export function Bereiche() {
  const aktuell = usePathname();
  return (
    <nav aria-label="Bereiche">
      <ul className={styles.bereiche}>
        {BEREICHE.map((b) => (
          <li key={b.pfad}>
            <Link href={b.pfad} aria-current={aktiv(b.pfad, aktuell) ? 'page' : undefined}>
              {b.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

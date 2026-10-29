import type { Laufbericht } from '@/lib/monitor/texte';
import styles from '../monitor.module.css';

const ERGEBNIS: Record<string, string> = {
  geholfen: 'hat geholfen',
  'nicht geholfen': 'hat nicht geholfen',
  abgelehnt: 'nicht ausgeführt',
  offen: 'offen',
};

const KOSTEN = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 5,
});

function vorschlagText(h: Laufbericht['heilungen'][number]): string {
  if (h.aktion === 'klicke') return `Klick auf «${h.ziel}»`;
  if (h.aktion === 'taste') return `Taste ${h.taste}`;
  if (h.aktion === 'warten') return 'Warten';
  if (h.aktion === 'abbrechen') return 'Abbrechen';
  return 'keine Frage gestellt';
}

/** Selbstheilung (Stufe 2): jeder Vorschlag mit Begründung, Prüfung und Wirkung. */
export function Heilungen({ heilungen }: { heilungen: Laufbericht['heilungen'] }) {
  if (heilungen.length === 0) return null;
  return (
    <section aria-labelledby="heilung-titel" className={styles.abschnitt}>
      <h2 id="heilung-titel">Selbstheilung (Stufe 2)</h2>
      <ol className={styles.heilungen}>
        {heilungen.map((h, i) => (
          <li key={`${h.schritt}-${i}`}>
            <p>
              <strong>{vorschlagText(h)}</strong> bei Schritt {h.schritt}:{' '}
              {ERGEBNIS[h.ergebnis] ?? h.ergebnis}
            </p>
            {h.begruendung ? <p>Begründung: {h.begruendung}</p> : null}
            {h.grund ? <p className={styles.schrittmeldung}>{h.grund}</p> : null}
            <p className={styles.leise}>
              Heiler: {h.heiler === 'attrappe' ? 'Attrappe (Test)' : (h.heiler ?? 'unbekannt')}
              {h.kostenUsd > 0 ? `, Kosten ${KOSTEN.format(h.kostenUsd)}` : null}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

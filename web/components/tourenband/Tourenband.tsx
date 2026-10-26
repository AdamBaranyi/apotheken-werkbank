import type { Vertragsdaten } from '@/lib/msv3/schema';
import { dauerText, ortszeit } from '@/lib/zeit';
import { fensterVonHeute, naechstesFenster, type Fenster } from './fenster';
import styles from './tourenband.module.css';

/**
 * Das Tourenband: Bestellfenster von heute mit Markierung «jetzt». In der
 * Apotheke zählt beim Bestellen vor allem, mit welcher Tour die Ware kommt.
 */
const TAG_BEGINN = 6 * 60;

function zustand(f: Fenster, minuten: number): string {
  if (f.stand === 'vorbei') return 'vorbei';
  if (f.stand === 'laeuft') return `läuft, noch ${dauerText(f.endeMinuten - minuten + 1)}`;
  return 'danach';
}

function Eintrag({ f, minuten }: { f: Fenster; minuten: number }) {
  const beginn = Math.max(f.beginnMinuten, TAG_BEGINN);
  const breite = Math.max(f.endeMinuten - beginn, 30);
  const jetztAnteil = f.stand === 'laeuft' ? ((minuten - beginn) / breite) * 100 : null;
  return (
    <li className={styles.fenster} data-stand={f.stand} style={{ flexGrow: breite }}>
      <span className={styles.tour}>{f.tour}</span>
      <span className={styles.ende}>bis {f.ende}</span>
      <span className={styles.zustand}>{zustand(f, minuten)}</span>
      {f.hauptbestellzeitpunkt ? (
        <span className={styles.haupt}>Hauptbestellung {f.hauptbestellzeitpunkt}</span>
      ) : null}
      {jetztAnteil !== null ? (
        <span
          className={styles.jetzt}
          style={{ left: `${Math.min(Math.max(jetztAnteil, 2), 98)}%` }}
          aria-hidden="true"
        />
      ) : null}
    </li>
  );
}

export function Tourenband({ vertrag, zeitpunkt }: { vertrag: Vertragsdaten; zeitpunkt: Date }) {
  const jetzt = ortszeit(zeitpunkt);
  const fenster = fensterVonHeute(vertrag, jetzt);
  const allesVorbei = fenster.every((f) => f.stand === 'vorbei');
  const naechstes = allesVorbei ? naechstesFenster(vertrag, jetzt) : null;
  return (
    <section className={styles.band} aria-labelledby="touren-titel">
      <div className={styles.kopf}>
        <h2 id="touren-titel">Bestellfenster heute</h2>
        <p className={styles.stand}>Stand {jetzt.text} Uhr</p>
      </div>
      {fenster.length > 0 ? (
        <ol className={styles.liste}>
          {fenster.map((f) => (
            <Eintrag key={f.tour} f={f} minuten={jetzt.minuten} />
          ))}
        </ol>
      ) : null}
      {naechstes ? (
        <p className={styles.naechstes}>
          Heute geht keine Tour mehr. Nächstes Fenster: {naechstes.wochentag}, Tour {naechstes.tour}{' '}
          bis {naechstes.ende} Uhr.
        </p>
      ) : null}
    </section>
  );
}

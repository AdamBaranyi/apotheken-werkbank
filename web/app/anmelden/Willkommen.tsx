import gross from './willkommen-2000.webp';
import klein from './willkommen-1000.webp';
import styles from './willkommen.module.css';

// Willkommensfläche der Anmeldung: Name, was die Werkbank macht, die
// Illustration und die drei Arbeitsfelder. Der Text steht im Code statt im
// Bild: So bleibt er scharf, richtig geschrieben und für Screenreader lesbar.

// 1 × 1 Pixel, durchsichtig: Schmal zeigt die Seite kein Bild und lädt keins.
const LEER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const BESCHREIBUNG =
  'Ein Apotheker arbeitet an der Theke. Daneben Lieferwannen vom Grosshandel, ' +
  'Verfügbarkeitsbalken und Tourenband, die Kasse mit Beleg und ein Roboterarm, ' +
  'der den Kassenbildschirm bedient.';

type Art = 'wanne' | 'beleg' | 'engine';

const FELDER: { art: Art; titel: string; text: string }[] = [
  {
    art: 'wanne',
    titel: 'Bestellen über MSV3',
    text: 'Verfügbarkeit und Tour prüfen, dann bestellen.',
  },
  {
    art: 'beleg',
    titel: 'Kasse mit Beleg',
    text: 'Verkaufen, stornieren, den Tag abschliessen.',
  },
  {
    art: 'engine',
    titel: 'Kassen-Engine',
    text: 'Bedient die Kasse; der Flow-Monitor zeigt jeden Lauf.',
  },
];

export function Willkommen() {
  return (
    <section className={styles.flaeche} aria-labelledby="willkommen-name">
      <p className={styles.marke}>
        <Zeichen />
        <span id="willkommen-name">Apotheken-Werkbank</span>
      </p>
      <p className={styles.titel}>Bestellen, verkaufen, automatisieren.</p>
      <p className={styles.text}>Die Werkbank für Vor-Ort-Apotheken.</p>
      <Illustration />
      <ul className={styles.felder}>
        {FELDER.map((feld) => (
          <li key={feld.art}>
            <Symbol art={feld.art} />
            <strong>{feld.titel}</strong>
            <span>{feld.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Ein schlichtes img in picture statt next/image: Die Bildoptimierung von Next
 * ist abgeschaltet (next.config.ts). Ab 64rem gilt die Quelle mit zwei Grössen.
 */
function Illustration() {
  return (
    <figure className={styles.bild}>
      <picture>
        <source
          media="(min-width: 64rem)"
          srcSet={`${klein.src} ${klein.width}w, ${gross.src} ${gross.width}w`}
          sizes="(min-width: 80rem) 45vw, 50vw"
        />
        <img
          src={LEER}
          alt={BESCHREIBUNG}
          width={gross.width}
          height={gross.height}
          fetchPriority="high"
        />
      </picture>
    </figure>
  );
}

/** Das Zeichen: ein Verfügbarkeitsbalken wie beim Bestellen, voll und schraffiert. */
function Zeichen() {
  return (
    <svg className={styles.zeichen} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <defs>
        <pattern id="zeichen-schraffur" width="4" height="4" patternUnits="userSpaceOnUse">
          <path className={styles.schraffur} d="M-1 1l2-2M0 4l4-4M3 5l2-2" />
        </pattern>
      </defs>
      <rect className={styles.zeichenGrund} x="1" y="1" width="38" height="38" rx="9" />
      <rect className={styles.zeichenVoll} x="8" y="15" width="15" height="10" rx="2" />
      <rect x="24" y="15" width="8" height="10" rx="2" fill="url(#zeichen-schraffur)" />
    </svg>
  );
}

function Symbol({ art }: { art: Art }) {
  return (
    <svg className={styles.symbol} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      {art === 'wanne' ? (
        <>
          <path d="M4 12h24l-2.5 14h-19z" />
          <path d="M4 12l2-5h20l2 5" />
          <path d="M13 17h6" />
        </>
      ) : null}
      {art === 'beleg' ? (
        <>
          <path d="M8 4h16v24l-4-2.5-4 2.5-4-2.5-4 2.5z" />
          <path d="M12 10h8M12 15h8M12 20h5" />
        </>
      ) : null}
      {art === 'engine' ? (
        <>
          <rect x="4" y="6" width="24" height="20" rx="2" />
          <path d="M4 11h24" />
          <path d="M11 18l3 3 7-7" />
        </>
      ) : null}
    </svg>
  );
}

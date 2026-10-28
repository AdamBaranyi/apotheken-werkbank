'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { SCHRITTE, type Ziel } from './schritte';
import styles from './rundgang.module.css';

function zielFinden(ziel: Ziel | undefined): HTMLElement | null {
  if (!ziel) return null;
  if ('selektor' in ziel) return document.querySelector<HTMLElement>(ziel.selektor);
  const knoepfe = document.querySelectorAll<HTMLButtonElement>('#inhalt button');
  return [...knoepfe].find((k) => k.textContent?.trim() === ziel.knopf) ?? null;
}

/**
 * Rundgang durch die ganze Werkbank: ein echter modaler Dialog (Fokusfalle,
 * Escape vom Browser), der von Seite zu Seite führt und das erklärte Element
 * hervorhebt. Die Leiste bleibt beim Seitenwechsel stehen, darum bleibt auch
 * der Dialog offen. Startet nur auf Knopfdruck.
 */
export function Rundgang() {
  const pfad = usePathname();
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const weiter = useRef<HTMLButtonElement>(null);
  const [nummer, setNummer] = useState<number | null>(null);
  const schritt = nummer === null ? undefined : SCHRITTE[nummer];

  useEffect(() => {
    if (!schritt) return;
    if (schritt.pfad && schritt.pfad !== pfad) {
      router.push(schritt.pfad);
      return;
    }
    let ziel: HTMLElement | null = null;
    const bild = requestAnimationFrame(() => {
      ziel = zielFinden(schritt.ziel);
      const ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      ziel?.setAttribute('data-rundgang-ziel', '');
      ziel?.scrollIntoView({ block: 'center', behavior: ruhig ? 'auto' : 'smooth' });
    });
    weiter.current?.focus();
    return () => {
      cancelAnimationFrame(bild);
      ziel?.removeAttribute('data-rundgang-ziel');
    };
  }, [schritt, pfad, router]);

  const starten = () => {
    setNummer(0);
    dialog.current?.showModal();
  };
  const beenden = () => dialog.current?.close();
  const letzter = nummer !== null && nummer + 1 >= SCHRITTE.length;

  return (
    <>
      <button type="button" className={styles.knopf} onClick={starten}>
        Rundgang
      </button>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby="rundgang-titel"
        onClose={() => setNummer(null)}
      >
        {schritt && nummer !== null ? (
          <>
            <p className={styles.zaehler}>
              Schritt {nummer + 1} von {SCHRITTE.length}
            </p>
            <h2 id="rundgang-titel" className={styles.titel}>
              {schritt.titel}
            </h2>
            <p className={styles.text}>{schritt.text}</p>
            <div className={styles.knoepfe}>
              <button type="button" className={styles.zweit} onClick={beenden}>
                Schliessen
              </button>
              {nummer > 0 ? (
                <button
                  type="button"
                  className={styles.zweit}
                  onClick={() => setNummer(nummer - 1)}
                >
                  Zurück
                </button>
              ) : null}
              <button
                ref={weiter}
                type="button"
                className={styles.haupt}
                onClick={() => (letzter ? beenden() : setNummer(nummer + 1))}
              >
                {letzter ? 'Fertig' : 'Weiter'}
              </button>
            </div>
          </>
        ) : null}
      </dialog>
    </>
  );
}

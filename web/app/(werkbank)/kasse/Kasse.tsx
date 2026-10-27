'use client';

import { useActionState, useMemo, useRef, useState, type FormEvent } from 'react';
import { betragText, type Waehrung } from '@/lib/geld';
import { pznAusEingabe } from '@/lib/pzn';
import { verkaufBuchen, type KassenStand } from './aktion';
import { Bon, type BonZeile } from './Bon';
import { Zahlung } from './Zahlung';
import styles from './kasse.module.css';

export interface KassenArtikel {
  pzn: string;
  name: string;
  packung: string;
  rezeptpflichtig: boolean;
  preis_cent: number;
}

/**
 * Die Kasse: PZN erfassen (Tastatur oder Scanner, Enter fügt hinzu), Bon
 * bearbeiten, bezahlen. Der Bon lebt im Browser, bis gebucht ist; die Summe
 * hier ist eine Vorschau, verbindlich rechnet die Datenbank.
 */
export function Kasse({
  artikel,
  waehrung,
  schluessel,
}: {
  artikel: KassenArtikel[];
  waehrung: Waehrung;
  schluessel: string;
}) {
  const katalog = useMemo(() => new Map(artikel.map((a) => [a.pzn, a])), [artikel]);
  const [zeilen, setZeilen] = useState<BonZeile[]>([]);
  const [eingabe, setEingabe] = useState('');
  const [hinweis, setHinweis] = useState('');
  const [ansage, setAnsage] = useState('');
  const [stand, aktion, laeuft] = useActionState<KassenStand, FormData>(verkaufBuchen, {});
  const feld = useRef<HTMLInputElement>(null);

  const summeVon = (liste: BonZeile[]) =>
    liste.reduce((s, z) => s + (katalog.get(z.pzn)?.preis_cent ?? 0) * (Number(z.menge) || 0), 0);
  const summe = summeVon(zeilen);

  function hinzufuegen(e: FormEvent) {
    e.preventDefault();
    const ergebnis = pznAusEingabe(eingabe);
    const a = 'pzn' in ergebnis ? katalog.get(ergebnis.pzn) : undefined;
    if (!a) {
      setHinweis('fehler' in ergebnis ? ergebnis.fehler : 'Diese PZN steht nicht im Katalog.');
      return;
    }
    const neu = zeilen.some((z) => z.pzn === a.pzn)
      ? zeilen.map((z) =>
          z.pzn === a.pzn ? { ...z, menge: String(Math.min((Number(z.menge) || 0) + 1, 999)) } : z,
        )
      : [...zeilen, { pzn: a.pzn, menge: '1', rezept: false }];
    setZeilen(neu);
    setEingabe('');
    setHinweis('');
    setAnsage(`${a.name}, ${a.packung} erfasst. Summe ${betragText(summeVon(neu), waehrung)}.`);
    feld.current?.focus();
  }

  const aendern = (pzn: string, teil: Partial<BonZeile>) =>
    setZeilen((alt) => alt.map((z) => (z.pzn === pzn ? { ...z, ...teil } : z)));
  const entfernen = (pzn: string) => {
    setZeilen((alt) => alt.filter((z) => z.pzn !== pzn));
    setAnsage(`${katalog.get(pzn)?.name ?? pzn} entfernt.`);
    feld.current?.focus();
  };

  return (
    <div className={styles.kasse}>
      <form onSubmit={hinzufuegen} className={styles.erfassen} aria-label="Artikel erfassen">
        <label htmlFor="pzn">PZN oder Artikel</label>
        <div className={styles.erfassenZeile}>
          <input
            id="pzn"
            ref={feld}
            list="katalog"
            value={eingabe}
            onChange={(e) => setEingabe(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={hinweis ? true : undefined}
            aria-describedby="pzn-hinweis"
            className={styles.pzn}
          />
          <button type="submit" className={styles.zweitknopf}>
            Hinzufügen
          </button>
        </div>
        <datalist id="katalog">
          {artikel.map((a) => (
            <option key={a.pzn} value={`${a.pzn} ${a.name}, ${a.packung}`} />
          ))}
        </datalist>
        <p id="pzn-hinweis" role="alert" className={hinweis ? styles.hinweis : 'unsichtbar'}>
          {hinweis}
        </p>
      </form>
      <p role="status" className="unsichtbar">
        {ansage}
      </p>

      <form action={aktion} className={styles.verkauf}>
        <input type="hidden" name="schluessel" value={schluessel} />
        <Bon
          zeilen={zeilen}
          katalog={katalog}
          waehrung={waehrung}
          summe={summe}
          onAendern={aendern}
          onEntfernen={entfernen}
        />
        {zeilen.length > 0 ? <Zahlung summe={summe} waehrung={waehrung} /> : null}
        <div className={styles.fuss}>
          <p role="alert" className={stand.fehler ? styles.fehler : 'unsichtbar'}>
            {stand.fehler ?? ''}
          </p>
          <button
            type="submit"
            className={styles.knopf}
            aria-disabled={laeuft || zeilen.length === 0}
            onClick={(e) => {
              if (laeuft || zeilen.length === 0) e.preventDefault();
            }}
          >
            {laeuft ? 'Wird gebucht …' : 'Verkauf buchen'}
          </button>
        </div>
      </form>
    </div>
  );
}

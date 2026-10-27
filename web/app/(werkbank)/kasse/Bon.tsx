import { betragText, type Waehrung } from '@/lib/geld';
import { zusammenhalten } from '@/lib/satz';
import type { KassenArtikel } from './Kasse';
import styles from './kasse.module.css';

export interface BonZeile {
  pzn: string;
  /** Als Text, damit sich die Zahl beim Tippen leeren lässt. */
  menge: string;
  rezept: boolean;
}

interface Props {
  zeilen: BonZeile[];
  katalog: Map<string, KassenArtikel>;
  waehrung: Waehrung;
  summe: number;
  onAendern: (pzn: string, teil: Partial<BonZeile>) => void;
  onEntfernen: (pzn: string) => void;
}

/**
 * Der Bon: eine Zeile je Artikel. Die Felder heissen «menge-PZN» und
 * «rezept-PZN»; so liest sie die Aktion. Rezeptpflichtige Artikel brauchen das
 * Häkchen «Rezept liegt vor», sonst lehnt die Datenbank den Verkauf ab.
 */
export function Bon({ zeilen, katalog, waehrung, summe, onAendern, onEntfernen }: Props) {
  if (zeilen.length === 0) {
    return (
      <p className={styles.leer}>Der Bon ist leer. Erfassen Sie einen Artikel über die PZN.</p>
    );
  }
  const geld = (cent: number) => betragText(cent, waehrung);
  return (
    <table className={styles.bon}>
      <caption className="unsichtbar">Bon</caption>
      <thead>
        <tr>
          <th scope="col">Artikel</th>
          <th scope="col">Menge</th>
          <th scope="col">Einzelpreis</th>
          <th scope="col">Betrag</th>
          <th scope="col">
            <span className="unsichtbar">Entfernen</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {zeilen.map((z) => {
          const a = katalog.get(z.pzn);
          if (!a) return null;
          const name = `${a.name}, ${a.packung}`;
          return (
            <tr key={z.pzn}>
              <td data-titel="Artikel">
                {/* Ein Kind für das Raster der schmalen Ansicht. */}
                <div>
                  {zusammenhalten(name)}
                  {a.rezeptpflichtig ? (
                    <span className={styles.rx}>
                      <span aria-hidden="true">Rx</span>
                      <span className="unsichtbar">rezeptpflichtig</span>
                    </span>
                  ) : null}
                  {a.rezeptpflichtig ? (
                    <label className={styles.rezept}>
                      <input
                        type="checkbox"
                        name={`rezept-${z.pzn}`}
                        value="ja"
                        checked={z.rezept}
                        onChange={(e) => onAendern(z.pzn, { rezept: e.target.checked })}
                      />
                      Rezept liegt vor
                    </label>
                  ) : null}
                </div>
              </td>
              <td data-titel="Menge">
                <input
                  name={`menge-${z.pzn}`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={999}
                  value={z.menge}
                  onChange={(e) => onAendern(z.pzn, { menge: e.target.value })}
                  aria-label={`Menge ${name}`}
                  className={styles.menge}
                />
              </td>
              <td data-titel="Einzelpreis" className="ziffern">
                {geld(a.preis_cent)}
              </td>
              <td data-titel="Betrag" className="ziffern">
                {geld(a.preis_cent * (Number(z.menge) || 0))}
              </td>
              <td data-titel="">
                <button
                  type="button"
                  className={styles.entfernen}
                  onClick={() => onEntfernen(z.pzn)}
                  aria-label={`${name} entfernen`}
                >
                  Entfernen
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row" colSpan={3}>
            Summe
          </th>
          <td className="ziffern">{geld(summe)}</td>
          <td />
        </tr>
      </tfoot>
    </table>
  );
}

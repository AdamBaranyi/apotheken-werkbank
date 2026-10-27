import Link from 'next/link';
import { betragText, satzText } from '@/lib/geld';
import { steuerBuchstaben, zeitText, type BelegDaten } from '@/lib/kasse/beleg-daten';
import { zusammenhalten } from '@/lib/satz';
import styles from './beleg.module.css';

/** Der Beleg im Browser: dieselben Angaben wie im PDF, als Tabelle lesbar. */
export function BelegAnsicht({ beleg: b }: { beleg: BelegDaten }) {
  const geld = (cent: number) => betragText(cent, b.waehrung);
  const buchstaben = steuerBuchstaben(b.steuern);
  return (
    <article className={styles.beleg} aria-label={`Beleg ${b.belegnummer}`}>
      <dl className={styles.kopf}>
        <div>
          <dt>Apotheke</dt>
          <dd>{b.apotheke}</dd>
        </div>
        <div>
          <dt>Zeit</dt>
          <dd className="ziffern">{zeitText(b.erstellt_am, b.land)}</dd>
        </div>
        <div>
          <dt>Zahlung</dt>
          <dd>{b.zahlart === 'bar' ? 'Bar' : 'Karte'}</dd>
        </div>
      </dl>
      {b.storno_von ? (
        <p className={styles.verweis}>
          Storno zu{' '}
          <Link href={`/kasse/belege/${b.storno_von.id}`}>Beleg {b.storno_von.belegnummer}</Link>
        </p>
      ) : null}
      {b.storniert_durch ? (
        <p className={styles.verweis}>
          Storniert durch{' '}
          <Link href={`/kasse/belege/${b.storniert_durch.id}`}>
            Beleg {b.storniert_durch.belegnummer}
          </Link>
        </p>
      ) : null}

      <table className={styles.tabelle}>
        <caption className="unsichtbar">Positionen</caption>
        <thead>
          <tr>
            <th scope="col">Artikel</th>
            <th scope="col">Menge</th>
            <th scope="col">Einzelpreis</th>
            <th scope="col">Betrag</th>
          </tr>
        </thead>
        <tbody>
          {b.positionen.map((p) => (
            <tr key={p.nr}>
              <td data-titel="Artikel">
                {/* Ein Element je Zelle: Schmal ist die Zelle ein Flex-Container. */}
                <span>
                  {zusammenhalten(`${p.name}, ${p.packung}`)}
                  {p.rezeptpflichtig ? (
                    <span className={styles.notiz}> Rx, Rezept vorgelegt</span>
                  ) : null}
                </span>
              </td>
              <td data-titel="Menge" className="ziffern">
                {p.menge}
              </td>
              <td data-titel="Einzelpreis" className="ziffern">
                {geld(p.einzelpreis_cent)}
              </td>
              <td data-titel="Betrag" className="ziffern">
                <span>
                  {geld(p.menge * p.einzelpreis_cent)}{' '}
                  <abbr title={`Steuersatz ${satzText(p.satz_promille)}`}>
                    {buchstaben.get(p.satz_promille)}
                  </abbr>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className={styles.summen}>
        <div className={styles.summe}>
          <dt>Summe</dt>
          <dd className="ziffern">{geld(b.summe_cent)}</dd>
        </div>
        {b.storno_von ? (
          <div>
            <dt>{b.zahlart === 'bar' ? 'Auszahlung bar' : 'Gutschrift auf Karte'}</dt>
            <dd className="ziffern">{geld(-b.summe_cent)}</dd>
          </div>
        ) : b.zahlart === 'bar' ? (
          <>
            <div>
              <dt>Bar gegeben</dt>
              <dd className="ziffern">{geld(b.gegeben_cent ?? 0)}</dd>
            </div>
            <div>
              <dt>Rückgeld</dt>
              <dd className="ziffern">{geld(b.rueckgeld_cent ?? 0)}</dd>
            </div>
          </>
        ) : null}
      </dl>

      <table className={styles.tabelle}>
        <caption>Steuer</caption>
        <thead>
          <tr>
            <th scope="col">Satz</th>
            <th scope="col">Netto</th>
            <th scope="col">Steuer</th>
            <th scope="col">Brutto</th>
          </tr>
        </thead>
        <tbody>
          {b.steuern.map((s) => (
            <tr key={s.satz_promille}>
              <td data-titel="Satz">
                {buchstaben.get(s.satz_promille)} {satzText(s.satz_promille)}
              </td>
              <td data-titel="Netto" className="ziffern">
                {geld(s.brutto_cent - s.steuer_cent)}
              </td>
              <td data-titel="Steuer" className="ziffern">
                {geld(s.steuer_cent)}
              </td>
              <td data-titel="Brutto" className="ziffern">
                {geld(s.brutto_cent)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.notiz}>
        Übungsbeleg mit erfundenen Daten. Ohne TSE: keine Seriennummer, kein Signaturzähler, kein
        Prüfwert – kein Beleg nach § 6 KassenSichV.
      </p>
    </article>
  );
}

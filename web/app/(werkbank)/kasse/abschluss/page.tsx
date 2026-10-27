import type { Metadata } from 'next';
import Link from 'next/link';
import { arbeitsplatzLaden } from '@/lib/apotheke';
import { betragText } from '@/lib/geld';
import { abschluesseLaden, offenLaden } from '@/lib/kasse/abschluss';
import { zeitText } from '@/lib/kasse/beleg-daten';
import liste from '../../liste.module.css';
import { Abschliessen } from './Abschliessen';
import styles from './abschluss.module.css';

export const metadata: Metadata = { title: 'Tagesabschluss' };

export default async function Tagesabschluss() {
  const platz = await arbeitsplatzLaden();
  if (!platz) return null;
  const abschluesse = await abschluesseLaden(platz.apotheke.id);
  const offen = await offenLaden(platz.apotheke.id, abschluesse[0]?.bis_beleg ?? 0);
  const geld = (cent: number) => betragText(cent, offen.waehrung);
  return (
    <>
      <h1>Tagesabschluss</h1>
      <section className={styles.offen} aria-labelledby="offen-titel">
        <h2 id="offen-titel">Seit dem letzten Abschluss</h2>
        {offen.anzahl === 0 ? (
          <p>Keine neuen Belege. Ein Abschluss braucht mindestens einen Beleg.</p>
        ) : (
          <>
            <dl className={styles.zahlen}>
              <div>
                <dt>Belege</dt>
                <dd className="ziffern">{offen.anzahl}</dd>
              </div>
              <div>
                <dt>Umsatz</dt>
                <dd className="ziffern">{geld(offen.umsatz_cent)}</dd>
              </div>
              <div>
                <dt>Bar</dt>
                <dd className="ziffern">{geld(offen.bar_cent)}</dd>
              </div>
              <div>
                <dt>Karte</dt>
                <dd className="ziffern">{geld(offen.karte_cent)}</dd>
              </div>
            </dl>
            <Abschliessen />
          </>
        )}
      </section>

      <h2>Abschlüsse</h2>
      {abschluesse.length === 0 ? (
        <p className={liste.leer}>Noch kein Abschluss.</p>
      ) : (
        <table className={liste.tabelle}>
          <caption className="unsichtbar">Abschlüsse, der neueste zuerst</caption>
          <thead>
            <tr>
              <th scope="col">Abschluss</th>
              <th scope="col">Zeit</th>
              <th scope="col">Belege</th>
              <th scope="col" className={liste.zahl}>
                Umsatz
              </th>
            </tr>
          </thead>
          <tbody>
            {abschluesse.map((a) => (
              <tr key={a.id}>
                <td data-titel="Abschluss">
                  <Link href={`/kasse/abschluss/${a.id}`}>Abschluss {a.nummer}</Link>
                </td>
                <td data-titel="Zeit" className="ziffern">
                  {zeitText(a.erstellt_am, a.waehrung === 'CHF' ? 'CH' : 'DE')}
                </td>
                <td data-titel="Belege" className="ziffern">
                  {a.von_beleg} bis {a.bis_beleg}
                </td>
                <td data-titel="Umsatz" className={`${liste.zahl} ziffern`}>
                  {betragText(a.umsatz_cent, a.waehrung)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

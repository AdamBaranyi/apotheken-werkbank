import type { Metadata } from 'next';
import Link from 'next/link';
import { arbeitsplatzLaden } from '@/lib/apotheke';
import { bestellungenLaden } from '@/lib/bestellung/laden';
import { STATUS_TEXT } from '@/lib/bestellung/texte';
import { zeitText } from '@/lib/kasse/beleg-daten';
import styles from '../liste.module.css';

export const metadata: Metadata = { title: 'Bestellungen' };

/** Die letzten 50 Bestellungen beim Grosshändler, die neueste zuerst. */
export default async function Bestellungen() {
  const platz = await arbeitsplatzLaden();
  if (!platz) return null;
  const bestellungen = await bestellungenLaden(platz.apotheke.id);
  return (
    <>
      <h1>Bestellungen</h1>
      <p className={styles.einleitung}>
        Verbindliche Bestellungen beim Grosshändler über MSV3. Der Status ist die Antwort des
        Grosshändlers; fehlt sie, klärt die Statusabfrage, ob die Bestellung angekommen ist.
      </p>
      {bestellungen.length === 0 ? (
        <p className={styles.leer}>
          Noch keine Bestellung. <Link href="/bestellen">Zum Bestellen</Link>
        </p>
      ) : (
        <table className={styles.tabelle}>
          <caption className="unsichtbar">Bestellungen, die neueste zuerst</caption>
          <thead>
            <tr>
              <th scope="col">Bestellung</th>
              <th scope="col">Zeit</th>
              <th scope="col">Artikel</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {bestellungen.map((b) => (
              <tr key={b.id}>
                <td data-titel="Bestellung">
                  <Link href={`/bestellungen/${b.id}`}>Bestellung {b.support_id}</Link>
                </td>
                <td data-titel="Zeit" className="ziffern">
                  {zeitText(b.erstellt_am, 'DE')}
                </td>
                <td data-titel="Artikel" className="ziffern">
                  {b.bestellpositionen.length}
                </td>
                <td data-titel="Status">
                  <span className={styles.marke}>{STATUS_TEXT[b.status]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { arbeitsplatzLaden } from '@/lib/apotheke';
import { betragText, istWaehrung } from '@/lib/geld';
import { zeitText } from '@/lib/kasse/beleg-daten';
import { supabaseServer } from '@/lib/supabase/server';
import styles from '../../liste.module.css';

export const metadata: Metadata = { title: 'Belege' };

interface Zeile {
  id: string;
  belegnummer: number;
  land: string;
  waehrung: string;
  zahlart: 'bar' | 'karte';
  summe_cent: number;
  erstellt_am: string;
  storno_von: string | null;
  storniert_durch: string | null;
}

/** Die letzten 50 Belege der Apotheke, der neueste zuerst. */
export default async function Belege() {
  const platz = await arbeitsplatzLaden();
  if (!platz) return null;
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from('belege')
    .select(
      'id, belegnummer, land, waehrung, zahlart, summe_cent, erstellt_am, storno_von, storniert_durch',
    )
    .eq('apotheke_id', platz.apotheke.id)
    .order('belegnummer', { ascending: false })
    .limit(50);
  const belege = (data ?? []) as Zeile[];
  return (
    <>
      <h1>Belege</h1>
      <p className={styles.einleitung}>
        Die letzten 50 Belege, der neueste zuerst. Ein Beleg wird nie geändert; ein Storno ist ein
        eigener Beleg.
      </p>
      {belege.length === 0 ? (
        <p className={styles.leer}>
          Noch keine Belege. <Link href="/kasse">Zur Kasse</Link>
        </p>
      ) : (
        <table className={styles.tabelle}>
          <caption className="unsichtbar">Belege</caption>
          <thead>
            <tr>
              <th scope="col">Beleg</th>
              <th scope="col">Zeit</th>
              <th scope="col">Zahlung</th>
              <th scope="col" className={styles.zahl}>
                Summe
              </th>
              <th scope="col">Hinweis</th>
            </tr>
          </thead>
          <tbody>
            {belege.map((b) => (
              <tr key={b.id}>
                <td data-titel="Beleg">
                  <Link href={`/kasse/belege/${b.id}`}>Beleg {b.belegnummer}</Link>
                </td>
                <td data-titel="Zeit" className="ziffern">
                  {zeitText(b.erstellt_am, b.land)}
                </td>
                <td data-titel="Zahlung">{b.zahlart === 'bar' ? 'Bar' : 'Karte'}</td>
                <td data-titel="Summe" className={`${styles.zahl} ziffern`}>
                  {betragText(b.summe_cent, istWaehrung(b.waehrung) ? b.waehrung : 'EUR')}
                </td>
                <td data-titel="Hinweis">
                  {b.storno_von ? <span className={styles.marke}>Storno</span> : null}
                  {b.storniert_durch ? <span className={styles.marke}>storniert</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

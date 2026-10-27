import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { arbeitsplatzLaden } from '@/lib/apotheke';
import { betragText, satzText } from '@/lib/geld';
import { abschlussLaden } from '@/lib/kasse/abschluss';
import { zeitText } from '@/lib/kasse/beleg-daten';
import styles from '../abschluss.module.css';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const abschluss = await abschlussLaden((await params).id);
  return { title: abschluss ? `Abschluss ${abschluss.nummer}` : 'Abschluss' };
}

/** Ein Abschluss («Z-Bon»): Summen je Zahlart und je Steuersatz, so wie die Datenbank sie gerechnet hat. */
export default async function AbschlussSeite({ params }: Props) {
  const platz = await arbeitsplatzLaden();
  if (!platz) return null;
  const a = await abschlussLaden((await params).id);
  if (!a) notFound();
  const geld = (cent: number) => betragText(cent, a.waehrung);
  const zeilen: [string, string][] = [
    ['Zeit', zeitText(a.erstellt_am, a.waehrung === 'CHF' ? 'CH' : 'DE')],
    ['Belege', `${a.anzahl_belege} (Nummer ${a.von_beleg} bis ${a.bis_beleg})`],
    ['Umsatz', geld(a.umsatz_cent)],
    ['Bar', geld(a.bar_cent)],
    ['Karte', geld(a.karte_cent)],
    ['Stornos', `${a.stornos} (${geld(a.storno_cent)})`],
  ];
  return (
    <>
      <h1>Abschluss {a.nummer}</h1>
      <article className={styles.zbon} aria-label={`Abschluss ${a.nummer}`}>
        <dl className={styles.liste}>
          {zeilen.map(([titel, wert]) => (
            <div key={titel}>
              <dt>{titel}</dt>
              <dd className="ziffern">{wert}</dd>
            </div>
          ))}
        </dl>
        <table className={styles.tabelle}>
          <caption>Steuer je Satz</caption>
          <thead>
            <tr>
              <th scope="col">Satz</th>
              <th scope="col">Netto</th>
              <th scope="col">Steuer</th>
              <th scope="col">Brutto</th>
            </tr>
          </thead>
          <tbody>
            {a.steuern.map((s) => (
              <tr key={s.satz_promille}>
                <td>{satzText(s.satz_promille)}</td>
                <td className="ziffern">{geld(s.netto_cent)}</td>
                <td className="ziffern">{geld(s.steuer_cent)}</td>
                <td className="ziffern">{geld(s.brutto_cent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
      <p className={styles.zurueck}>
        <Link href="/kasse/abschluss">Alle Abschlüsse</Link>
      </p>
    </>
  );
}

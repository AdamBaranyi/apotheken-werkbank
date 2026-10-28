import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Anteile } from '@/components/anteile/Anteile';
import { arbeitsplatzLaden } from '@/lib/apotheke';
import { abfragbar, abfrageAb } from '@/lib/bestellung/abfrage';
import { bestellungLaden } from '@/lib/bestellung/laden';
import { STATUS_ERKLAERUNG, STATUS_TEXT } from '@/lib/bestellung/texte';
import { uhrzeitText, zeitText } from '@/lib/kasse/beleg-daten';
import { zusammenhalten } from '@/lib/satz';
import styles from './bestellung.module.css';
import { StatusAbfrage } from './StatusAbfrage';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const b = await bestellungLaden((await params).id);
  return { title: b ? `Bestellung ${b.support_id}` : 'Bestellung' };
}

export default async function BestellungSeite({ params }: Props) {
  const platz = await arbeitsplatzLaden();
  if (!platz) return null;
  const b = await bestellungLaden((await params).id);
  if (!b) notFound();
  const lieferung = new Map(b.antwort?.positionen.map((p) => [p.pzn, p]) ?? []);
  const abfrage = abfrageAb(b);
  return (
    <>
      <h1>Bestellung {b.support_id}</h1>
      <section className={styles.status} aria-labelledby="status-titel">
        <h2 id="status-titel">
          Status: <span className={styles.marke}>{STATUS_TEXT[b.status]}</span>
        </h2>
        <p>{STATUS_ERKLAERUNG[b.status]}</p>
        {b.meldung ? <p className={styles.meldung}>{b.meldung}</p> : null}
        {abfrage === null ? null : abfragbar(b, new Date()) ? (
          <StatusAbfrage bestellung={b.id} />
        ) : (
          <p className={styles.meldung}>
            Statusabfrage ab <span className="ziffern">{uhrzeitText(abfrage)}</span> Uhr: So lange
            verarbeitet der Grosshändler die Bestellung vielleicht noch. Danach die Seite neu laden.
          </p>
        )}
      </section>
      <dl className={styles.angaben}>
        <div>
          <dt>Zeit</dt>
          <dd className="ziffern">{zeitText(b.erstellt_am, 'DE')}</dd>
        </div>
        <div>
          <dt>Grosshändler</dt>
          <dd>{b.grosshaendler_zugaenge?.bezeichnung ?? 'unbekannt'}</dd>
        </div>
        <div>
          <dt>Lieferung</dt>
          <dd>aus Hauptlager und Verbund</dd>
        </div>
        <div>
          <dt>Bestell-ID für Rückfragen</dt>
          <dd className={`${styles.kennung} ziffern`}>{b.id}</dd>
        </div>
      </dl>
      <table className={styles.tabelle}>
        <caption>Artikel</caption>
        <thead>
          <tr>
            <th scope="col">PZN</th>
            <th scope="col">Artikel</th>
            <th scope="col">Menge</th>
            <th scope="col">Lieferung</th>
          </tr>
        </thead>
        <tbody>
          {b.bestellpositionen.map((p) => {
            const antwort = lieferung.get(p.pzn);
            return (
              <tr key={p.pzn}>
                <td data-titel="PZN" className="ziffern">
                  {p.pzn}
                </td>
                <td data-titel="Artikel">
                  {zusammenhalten(p.artikel ? `${p.artikel.name}, ${p.artikel.packung}` : p.pzn)}
                </td>
                <td data-titel="Menge" className="ziffern">
                  {p.menge}
                </td>
                <td data-titel="Lieferung">
                  {antwort && antwort.anteile.length > 0 ? (
                    <Anteile anteile={antwort.anteile} angefragt={p.menge} />
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p>
        <Link href="/bestellen">Neue Bestellung</Link>
      </p>
    </>
  );
}

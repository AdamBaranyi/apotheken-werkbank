import { randomUUID } from 'node:crypto';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { arbeitsplatzLaden } from '@/lib/apotheke';
import { belegLaden } from '@/lib/kasse/beleg-laden';
import { BelegAnsicht } from './BelegAnsicht';
import { Storno } from './Storno';
import styles from './beleg.module.css';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const beleg = await belegLaden((await params).id);
  return { title: beleg ? `Beleg ${beleg.belegnummer}` : 'Beleg' };
}

export default async function BelegSeite({ params }: Props) {
  const platz = await arbeitsplatzLaden();
  if (!platz) return null;
  const beleg = await belegLaden((await params).id);
  if (!beleg) notFound();
  // Stornieren darf nur, wer die Apotheke führt (die Datenbank prüft es noch einmal).
  const stornierbar = platz.rolle === 'inhaber' && !beleg.storno_von && !beleg.storniert_durch;
  return (
    <>
      <h1>Beleg {beleg.belegnummer}</h1>
      <BelegAnsicht beleg={beleg} />
      <div className={styles.aktionen}>
        <a href={`/kasse/belege/${beleg.id}/pdf`} className={styles.zweitknopf}>
          Beleg als PDF
        </a>
        <Link href="/kasse" className={styles.knopf}>
          Neuer Verkauf
        </Link>
      </div>
      {stornierbar ? <Storno original={beleg.id} schluessel={randomUUID()} /> : null}
    </>
  );
}

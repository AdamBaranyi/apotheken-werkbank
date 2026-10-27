import { randomUUID } from 'node:crypto';
import type { Metadata } from 'next';
import { arbeitsplatzLaden } from '@/lib/apotheke';
import { supabaseServer } from '@/lib/supabase/server';
import { Kasse, type KassenArtikel } from './Kasse';
import styles from './kasse.module.css';

export const metadata: Metadata = { title: 'Kasse' };

export default async function KassenSeite() {
  const platz = await arbeitsplatzLaden();
  if (!platz) return null;
  const supabase = await supabaseServer();
  const { data: artikel } = await supabase
    .from('artikel')
    .select('pzn, name, packung, rezeptpflichtig, preis_cent')
    .order('name');
  return (
    <>
      <h1>Kasse</h1>
      <p className={styles.einleitung}>
        Artikel über die PZN erfassen, Zahlung wählen, buchen. Preise, Steuersätze und die
        Belegnummer setzt die Datenbank beim Buchen; alle Artikel sind erfunden.
      </p>
      {/* Ein neuer Schlüssel je Seitenaufbau: Ein zweiter Klick auf «Buchen» trifft denselben Beleg. */}
      <Kasse
        artikel={(artikel ?? []) as KassenArtikel[]}
        waehrung={platz.apotheke.land === 'CH' ? 'CHF' : 'EUR'}
        schluessel={randomUUID()}
      />
    </>
  );
}

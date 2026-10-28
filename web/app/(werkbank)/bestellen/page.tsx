import { randomUUID } from 'node:crypto';
import type { Metadata } from 'next';
import { Tourenband } from '@/components/tourenband/Tourenband';
import { arbeitsplatzLaden } from '@/lib/apotheke';
import { vertragLaden } from '@/lib/bestellung/vertrag';
import { supabaseServer } from '@/lib/supabase/server';
import { Abfrage, type KatalogArtikel } from './Abfrage';
import styles from './bestellen.module.css';

export const metadata: Metadata = { title: 'Bestellen' };

export default async function Bestellen() {
  const platz = await arbeitsplatzLaden();
  if (!platz) return null;
  const supabase = await supabaseServer();
  const [{ data: artikel }, { data: zugaenge }] = await Promise.all([
    supabase.from('artikel').select('pzn, name, packung, rezeptpflichtig').order('name'),
    supabase
      .from('grosshaendler_zugaenge')
      .select('id, bezeichnung')
      .eq('apotheke_id', platz.apotheke.id),
  ]);
  const zugang = zugaenge?.[0];
  const vertrag = zugang ? await vertragLaden(platz.apotheke.id, zugang.id) : null;

  return (
    <>
      <h1>Bestellen</h1>
      <p className={styles.einleitung}>
        Verfügbarkeit beim Grosshändler über MSV3 prüfen; die Anfrage ist unverbindlich und
        reserviert nichts. «Verbindlich bestellen» sendet die Mengen als Bestellung.
        {zugang ? ` Grosshändler: ${zugang.bezeichnung}.` : ''}
      </p>
      {!zugang ? (
        <p role="alert">Für diese Apotheke ist noch kein Grosshändler-Zugang eingetragen.</p>
      ) : typeof vertrag === 'string' ? (
        <p role="alert" className={styles.fehler}>
          Bestellfenster nicht verfügbar: {vertrag}
        </p>
      ) : vertrag ? (
        <Tourenband vertrag={vertrag} zeitpunkt={new Date()} />
      ) : null}
      {zugang ? (
        <Abfrage
          artikel={(artikel ?? []) as KatalogArtikel[]}
          zugangId={zugang.id}
          schluessel={randomUUID()}
        />
      ) : null}
    </>
  );
}

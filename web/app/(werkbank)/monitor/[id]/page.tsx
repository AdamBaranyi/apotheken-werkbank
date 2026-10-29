import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { arbeitsplatzLaden } from '@/lib/apotheke';
import { zeitText } from '@/lib/kasse/beleg-daten';
import {
  berichtLesen,
  dauerText,
  flowText,
  fotoBytes,
  kasseText,
  STATUS_ERKLAERUNG,
  STATUS_TEXT,
  type Laufstatus,
} from '@/lib/monitor/texte';
import { supabaseServer } from '@/lib/supabase/server';
import listen from '../../liste.module.css';
import styles from '../monitor.module.css';
import { Heilungen } from './Heilungen';
import { Schritte } from './Schritte';

type Props = { params: Promise<{ id: string }> };

interface Lauf {
  id: string;
  lauf: string;
  flow: string;
  kasse: string;
  status: Laufstatus;
  kennung: string;
  beginn: string;
  dauer_ms: number;
  treiber: 'windows' | 'fake';
  bericht: unknown;
}

async function laufLaden(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from('engine_laeufe')
    .select('id, lauf, flow, kasse, status, kennung, beginn, dauer_ms, treiber, bericht')
    .eq('id', id)
    .maybeSingle();
  if (!data) return null;
  const { data: foto } = await supabase
    .from('engine_fotos')
    .select('art, inhalt')
    .eq('lauf_id', id)
    .maybeSingle();
  return { lauf: data as Lauf, foto: foto as { art: 'png' | 'text'; inhalt: string } | null };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const geladen = await laufLaden((await params).id);
  return { title: geladen ? `Lauf ${geladen.lauf.lauf}` : 'Lauf' };
}

export default async function LaufSeite({ params }: Props) {
  const platz = await arbeitsplatzLaden();
  if (!platz) return null;
  const geladen = await laufLaden((await params).id);
  if (!geladen) notFound();
  const { lauf: l, foto } = geladen;
  const bericht = berichtLesen(l.bericht);
  return (
    <>
      <h1 className={styles.lauf}>Lauf {l.lauf}</h1>
      <section className={styles.kasten} aria-labelledby="status-titel">
        <h2 id="status-titel">
          Status:{' '}
          <span className={styles.status} data-status={l.status}>
            {STATUS_TEXT[l.status]}
          </span>
        </h2>
        <p>{STATUS_ERKLAERUNG[l.status]}</p>
        {bericht?.fehler ? (
          <p className={styles.meldung}>
            {bericht.fehler.schritt ? `Schritt ${bericht.fehler.schritt}: ` : null}
            {bericht.fehler.meldung.replace(/^Schritt [\d.]+: /, '')}
          </p>
        ) : null}
      </section>
      <dl className={styles.angaben}>
        <div>
          <dt>Ablauf</dt>
          <dd>
            {flowText(l.flow)}, Kasse {kasseText(l.kasse)}
          </dd>
        </div>
        <div>
          <dt>Beginn</dt>
          <dd className="ziffern">{zeitText(l.beginn, platz.apotheke.land)}</dd>
        </div>
        <div>
          <dt>Dauer</dt>
          <dd className="ziffern">{dauerText(l.dauer_ms)}</dd>
        </div>
        <div>
          <dt>Kennung des Auftrags</dt>
          <dd className="ziffern">{l.kennung || 'keine'}</dd>
        </div>
        <div>
          <dt>Treiber</dt>
          <dd>
            {l.treiber === 'windows'
              ? `Windows${bericht?.ocr ? `, OCR ${bericht.ocr}` : ''}`
              : 'Test (ohne Bildschirm)'}
          </dd>
        </div>
        {Object.entries(bericht?.werte ?? {}).map(([name, wert]) => (
          <div key={name}>
            <dt>Gelesen: {name}</dt>
            <dd className="ziffern">{wert}</dd>
          </div>
        ))}
      </dl>
      {bericht ? (
        <>
          <Schritte schritte={bericht.schritte} />
          <Heilungen heilungen={bericht.heilungen} />
          {bericht.dialoge.length > 0 ? (
            <section aria-labelledby="dialoge-titel" className={styles.abschnitt}>
              <h2 id="dialoge-titel">Bekannte Dialoge (Stufe 1)</h2>
              <ul>
                {bericht.dialoge.map((d) => (
                  <li key={d.zeit}>
                    «{d.text}»: geklickt auf «{d.klick}»
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : (
        <p className={listen.leer}>Der Bericht dieses Laufs lässt sich nicht lesen.</p>
      )}
      {foto ? (
        <section aria-labelledby="foto-titel" className={styles.abschnitt}>
          <h2 id="foto-titel">Bildschirm beim Abbruch</h2>
          {foto.art === 'png' ? (
            // Kein next/image: Das Bild kommt aus der eigenen Route mit Sitzung, ohne Optimierung.
            <img
              src={`/monitor/${l.id}/foto`}
              alt="Bildschirmfoto der Kasse im Moment des Abbruchs"
              className={styles.foto}
            />
          ) : (
            <pre
              className={styles.textkarte}
              aria-label="Bildschirm als Text, so wie die Engine ihn las"
            >
              {new TextDecoder().decode(fotoBytes(foto.inhalt))}
            </pre>
          )}
        </section>
      ) : null}
      <p>
        <Link href="/monitor">Alle Läufe</Link>
      </p>
    </>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { arbeitsplatzLaden } from '@/lib/apotheke';
import { zeitText } from '@/lib/kasse/beleg-daten';
import { dauerText, flowText, kasseText, STATUS_TEXT, type Laufstatus } from '@/lib/monitor/texte';
import { supabaseServer } from '@/lib/supabase/server';
import listen from '../liste.module.css';
import styles from './monitor.module.css';

export const metadata: Metadata = { title: 'Flow-Monitor' };

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
  heilungen: number;
}

/** Die letzten 50 Läufe der Engine für diese Apotheke, der neueste zuerst. */
export default async function Monitor() {
  const platz = await arbeitsplatzLaden();
  if (!platz) return null;
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from('engine_laeufe')
    .select('id, lauf, flow, kasse, status, kennung, beginn, dauer_ms, treiber, heilungen')
    .eq('apotheke_id', platz.apotheke.id)
    .order('beginn', { ascending: false })
    .limit(50);
  const laeufe = (data ?? []) as Lauf[];
  return (
    <>
      <h1>Flow-Monitor</h1>
      <p className={listen.einleitung}>
        Was die Engine an den Kassen dieser Apotheke getan hat: jeder Lauf mit Status, Dauer und
        Selbstheilung. Die Engine meldet mit einem eigenen Konto und darf hier nichts lesen.
      </p>
      {laeufe.length === 0 ? (
        <p className={listen.leer}>
          Noch keine Läufe. Die Engine meldet sie mit <code>engine/werkbank.ps1 run -Melden</code>.
        </p>
      ) : (
        <table className={listen.tabelle}>
          <caption className="unsichtbar">Läufe der Engine</caption>
          <thead>
            <tr>
              <th scope="col">Lauf</th>
              <th scope="col">Zeit</th>
              <th scope="col">Ablauf</th>
              <th scope="col">Status</th>
              <th scope="col" className={listen.zahl}>
                Dauer
              </th>
            </tr>
          </thead>
          <tbody>
            {laeufe.map((l) => (
              <tr key={l.id}>
                <td data-titel="Lauf">
                  <Link href={`/monitor/${l.id}`} className={styles.lauf}>
                    {l.lauf}
                  </Link>
                </td>
                <td data-titel="Zeit" className="ziffern">
                  {zeitText(l.beginn, platz.apotheke.land)}
                </td>
                <td data-titel="Ablauf">
                  {flowText(l.flow)}, Kasse {kasseText(l.kasse)}
                  {l.kennung ? (
                    <span className={`${styles.kennung} ziffern`}> {l.kennung}</span>
                  ) : null}
                  {l.treiber === 'fake' ? (
                    <span className={`${listen.marke} ${styles.abstand}`}>Test</span>
                  ) : null}
                </td>
                <td data-titel="Status">
                  <span className={styles.status} data-status={l.status}>
                    {STATUS_TEXT[l.status]}
                  </span>
                  {l.heilungen > 0 ? <span className={listen.marke}>geheilt</span> : null}
                </td>
                <td data-titel="Dauer" className={`${listen.zahl} ziffern`}>
                  {dauerText(l.dauer_ms)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

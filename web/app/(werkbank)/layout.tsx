import type { ReactNode } from 'react';
import { Kopf } from '@/components/kopf/Kopf';
import { arbeitsplatzLaden } from '@/lib/apotheke';
import styles from './werkbank.module.css';

export default async function WerkbankRahmen({ children }: { children: ReactNode }) {
  const platz = await arbeitsplatzLaden();
  return (
    <>
      <Kopf
        apotheke={platz?.apotheke.name ?? 'ohne Apotheke'}
        email={platz?.email ?? ''}
        rundgangVonSelbst={platz !== null && !platz.rundgangGesehen}
      />
      <main id="inhalt" className={styles.inhalt}>
        {platz ? (
          children
        ) : (
          <p role="alert">
            Dieses Konto gehört zu keiner Apotheke. Die Apotheke muss es zuerst als Mitglied
            eintragen.
          </p>
        )}
      </main>
    </>
  );
}

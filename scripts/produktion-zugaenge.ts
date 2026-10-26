/**
 * Zugänge der beiden Demo-Apotheken für die Produktion. Je Apotheke ein neues
 * Passwort für die Grosshandel-Attrappe, das nur während des Laufs existiert:
 *
 * - .lokal/produktion/mandanten.json: Hash für die Attrappe auf vps1
 * - .lokal/produktion/zugaenge.sql: Geheimtext für Supabase, dazu Apotheken
 *   und Mitgliedschaften (die Konten selbst legt Adam in Supabase an)
 *
 * Verschlüsselt wird mit .lokal/produktion/zugang-schluessel.txt, demselben
 * Schlüssel wie ZUGANG_SCHLUESSEL in Vercel. Beide Dateien gehören zusammen:
 * Nach einem neuen Lauf müssen beide ausgerollt werden (docs/BETRIEB.md).
 *
 * Aufruf: node scripts/produktion-zugaenge.ts
 */
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { passwortHashen } from '../grosshandel-attrappe/src/anmeldung.ts';
import { verschluesseln } from '../web/lib/verschluesselung.ts';
import { DEMO_APOTHEKEN, passwortErzeugen } from './demo-apotheken.ts';

const ORDNER = '.lokal/produktion';
const BASIS_URL = 'https://grosshandel.adambaranyi.xyz/msv3';

interface Mandant {
  kundenkennung: string;
  name: string;
  passwortHash: string;
  btmErlaubnis: boolean;
  vertrag: string;
}

interface Zugang {
  kennung: string;
  geheimtext: string;
}

function sqlText(wert: string): string {
  return `'${wert.replaceAll("'", "''")}'`;
}

function sqlBauen(basisUrl: string, zugaenge: Zugang[]): string {
  const emails = DEMO_APOTHEKEN.map((a) => a.email);
  const pruefung = `do $$
begin
  if (select count(*) from auth.users where email in (${emails.map(sqlText).join(', ')})) <> ${emails.length} then
    raise exception 'Zuerst die Konten anlegen: %', ${sqlText(emails.join(', '))};
  end if;
end $$;`;
  // Ein zweiter Lauf ersetzt die Demo-Apotheken; Mitgliedschaften und Zugänge
  // gehen per Fremdschlüssel mit.
  const aufraeumen = `delete from public.apotheken where name in (${DEMO_APOTHEKEN.map((a) => sqlText(a.name)).join(', ')});`;
  const anlegen = DEMO_APOTHEKEN.map(
    (a, i) => `with apotheke as (
  insert into public.apotheken (name) values (${sqlText(a.name)}) returning id
), mitglied as (
  insert into public.mitglieder (apotheke_id, user_id, rolle)
  select apotheke.id, u.id, ${sqlText(a.rolle)} from apotheke, auth.users u where u.email = ${sqlText(a.email)}
)
insert into public.grosshaendler_zugaenge (apotheke_id, bezeichnung, basis_url, kundenkennung, passwort_verschluesselt)
select id, 'Grosshandel-Attrappe', ${sqlText(basisUrl)}, ${sqlText(a.kennung)}, ${sqlText(zugaenge[i]?.geheimtext ?? '')} from apotheke;`,
  );
  return [
    '-- Erzeugt von scripts/produktion-zugaenge.ts. Nur Geheimtext, kein Passwort.',
    pruefung,
    aufraeumen,
    ...anlegen,
  ].join('\n\n');
}

export async function zugaengeErzeugen(
  schluessel: Buffer,
  basisUrl: string,
): Promise<{ mandanten: Mandant[]; zugaenge: Zugang[]; sql: string }> {
  if (schluessel.length !== 32) throw new Error('Der Schlüssel muss 32 Byte lang sein.');
  const mandanten: Mandant[] = [];
  const zugaenge: Zugang[] = [];
  for (const a of DEMO_APOTHEKEN) {
    const passwort = passwortErzeugen();
    mandanten.push({
      kundenkennung: a.kennung,
      name: a.name,
      passwortHash: await passwortHashen(passwort),
      btmErlaubnis: a.btm,
      vertrag: a.vertrag,
    });
    zugaenge.push({ kennung: a.kennung, geheimtext: verschluesseln(passwort, schluessel) });
  }
  return { mandanten, zugaenge, sql: `${sqlBauen(basisUrl, zugaenge)}\n` };
}

function schreiben(datei: string, inhalt: string): void {
  writeFileSync(datei, inhalt, { mode: 0o600 });
  chmodSync(datei, 0o600);
}

async function main(): Promise<void> {
  const roh = readFileSync(`${ORDNER}/zugang-schluessel.txt`, 'utf8').trim();
  const { mandanten, sql } = await zugaengeErzeugen(Buffer.from(roh, 'base64'), BASIS_URL);
  mkdirSync(ORDNER, { recursive: true, mode: 0o700 });
  schreiben(`${ORDNER}/mandanten.json`, `${JSON.stringify(mandanten, null, 2)}\n`);
  schreiben(`${ORDNER}/zugaenge.sql`, sql);
  console.log(
    `Erzeugt: ${ORDNER}/mandanten.json (für vps1) und ${ORDNER}/zugaenge.sql (für Supabase). ` +
      'Beide gehören zusammen; Schritte in docs/BETRIEB.md.',
  );
}

if (import.meta.main) await main();

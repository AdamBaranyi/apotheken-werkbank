/**
 * Sabotagen an den Datenbankregeln. Jede setzt die lokale Datenbank neu auf
 * (Migrationen von vorn), prüft und setzt sie danach wieder richtig auf.
 */
const M = 'supabase/migrations/20261026160000_grundschema.sql';
const RESET = './node_modules/.bin/supabase db reset >/dev/null 2>&1';
const KONFIG = 'vitest.db.config.ts';
const TESTS = ['supabase/tests/rls.test.ts'];

export const SABOTAGEN_DB = [
  {
    name: 'Zugänge für alle sichtbar',
    datei: M,
    suche: `create policy zugaenge_lesen on public.grosshaendler_zugaenge for select to authenticated
  using (apotheke_id in (select public.meine_apotheken()));`,
    ersatz: `create policy zugaenge_lesen on public.grosshaendler_zugaenge for select to authenticated
  using (true);`,
    vorbereiten: RESET,
    konfig: KONFIG,
    tests: TESTS,
  },
  {
    name: 'Verschlüsseltes Passwort lesbar',
    datei: M,
    suche: 'grant select (id, apotheke_id, bezeichnung, basis_url, kundenkennung, erstellt_am)',
    ersatz:
      'grant select (id, apotheke_id, bezeichnung, basis_url, kundenkennung, erstellt_am, passwort_verschluesselt)',
    vorbereiten: RESET,
    konfig: KONFIG,
    tests: TESTS,
  },
  {
    name: 'Passwort-Funktion ohne Mitgliedschaft',
    datei: M,
    suche: `  where z.id = p_zugang
    and z.apotheke_id in (`,
    ersatz: `  where z.id = p_zugang
    and true or z.apotheke_id in (`,
    vorbereiten: RESET,
    konfig: KONFIG,
    tests: TESTS,
  },
  {
    name: 'Mitarbeiter gilt als Inhaber',
    datei: M,
    suche: "m.user_id = (select auth.uid()) and m.rolle = 'inhaber'",
    ersatz: 'm.user_id = (select auth.uid())',
    vorbereiten: RESET,
    konfig: KONFIG,
    tests: TESTS,
  },
  {
    name: 'Apotheke ohne Rechte-Entzug für anon',
    datei: M,
    suche: `revoke all on public.apotheken, public.mitglieder, public.artikel, public.grosshaendler_zugaenge
  from anon, authenticated;`,
    ersatz: `revoke all on public.mitglieder, public.artikel, public.grosshaendler_zugaenge
  from anon, authenticated;
grant select on public.apotheken to anon;`,
    vorbereiten: RESET,
    konfig: KONFIG,
    tests: TESTS,
  },
];

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
  {
    name: 'Hilfsfunktion bleibt über die REST-Schnittstelle erreichbar',
    datei: 'supabase/migrations/20261026190000_hilfsfunktionen_privat.sql',
    // Nicht die Verschiebung streichen: Spätere Migrationen rufen privat.ist_inhaber.
    suche: 'alter function public.ist_inhaber(uuid) set schema privat;',
    ersatz: `alter function public.ist_inhaber(uuid) set schema privat;
create function public.ist_inhaber(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$ select privat.ist_inhaber(p) $$;`,
    vorbereiten: RESET,
    konfig: KONFIG,
    tests: ['supabase/tests/schnittstelle.test.ts'],
  },
  ...kasseUndBestellung(),
  ...engineMonitor(),
];

/** Die Regeln von Abend 2: Kasse, Abschluss, Bestellungen, Bremse, Befunde der Durchsicht. */
function kasseUndBestellung() {
  const KASSE = 'supabase/migrations/20261027120000_kasse.sql';
  const BESTELLUNG = 'supabase/migrations/20261027120200_bestellungen.sql';
  const DURCHSICHT = 'supabase/migrations/20261028090000_durchsicht.sql';
  const kasse = ['supabase/tests/kasse.test.ts'];
  return [
    {
      name: 'Positionen lassen sich an gebuchte Belege anhängen',
      datei: KASSE,
      suche: 'where v.id = verkauf_id and v.erstellt_am = now()',
      ersatz: 'where v.id = verkauf_id',
      tests: kasse,
    },
    {
      name: 'Preis kommt vom Aufrufer',
      datei: KASSE,
      suche: 'grant insert (verkauf_id, pzn, menge, rezept_vorgelegt)',
      ersatz: 'grant insert (verkauf_id, pzn, menge, rezept_vorgelegt, einzelpreis_cent)',
      tests: kasse,
    },
    {
      name: 'Mitarbeiter stornieren',
      datei: KASSE,
      suche: 'and (storno_von is null or privat.ist_inhaber(apotheke_id))',
      ersatz: 'and true',
      tests: kasse,
    },
    {
      name: 'Rezeptpflicht wird nicht geprüft',
      datei: KASSE,
      suche: 'if v_artikel.rezeptpflichtig and not coalesce(new.rezept_vorgelegt, false) then',
      ersatz: 'if false then',
      tests: kasse,
    },
    {
      name: 'Abschluss beginnt immer bei Beleg 1',
      datei: 'supabase/migrations/20261027120010_tagesabschluss.sql',
      suche: 'new.von_beleg := v_letzter + 1;',
      ersatz: 'new.von_beleg := 1;',
      tests: ['supabase/tests/abschluss.test.ts'],
    },
    {
      name: 'Bestellstatus springt beliebig',
      datei: BESTELLUNG,
      suche: '  if not (\n    (old.status',
      ersatz: '  if false and not (\n    (old.status',
      tests: ['supabase/tests/bestellungen.test.ts'],
    },
    {
      name: 'Bremse für Angemeldete erreichbar',
      datei: DURCHSICHT,
      suche: 'grant execute on function privat.bremse_freigeben(bigint[]) to werkbank_bremse;',
      ersatz:
        'grant execute on function privat.bremse_freigeben(bigint[]) to werkbank_bremse, authenticated;',
      tests: ['supabase/tests/bremse.test.ts'],
    },
    {
      name: 'Bremse ohne Sperre: Gleichzeitige Versuche kommen über die Grenze',
      datei: DURCHSICHT,
      suche: '    perform pg_advisory_xact_lock(v_sperre);',
      ersatz: '    null;',
      tests: ['supabase/tests/bremse.test.ts'],
    },
    {
      name: 'Gleicher Schlüssel, andere Zahlung: still der alte Beleg',
      datei: DURCHSICHT,
      suche:
        '      or v_alt.zahlart is distinct from p_zahlart\n      or v_alt.gegeben_cent is distinct from p_gegeben_cent\n',
      ersatz: '',
      tests: kasse,
    },
    {
      name: 'Gleicher Schlüssel, anderes Original: still das alte Storno',
      datei: DURCHSICHT,
      suche: '    if v_alt.storno_von is distinct from p_original then',
      ersatz: '    if false then',
      tests: kasse,
    },
    {
      name: 'Gleicher Schlüssel, andere Mengen: still die alte Bestellung',
      datei: DURCHSICHT,
      suche: '    if v_alt.zugang_id is distinct from p_zugang\n      or exists (',
      ersatz: '    if v_alt.zugang_id is distinct from p_zugang\n      or false and exists (',
      tests: ['supabase/tests/bestellungen.test.ts'],
    },
  ].map((s) => ({ ...s, vorbereiten: RESET, konfig: KONFIG }));
}

/** Die Regeln des Flow-Monitors: Engine-Konten melden, Mitglieder lesen. */
function engineMonitor() {
  const ENGINE = 'supabase/migrations/20261029120000_engine_laeufe.sql';
  const tests = ['supabase/tests/engine.test.ts'];
  return [
    {
      name: 'Engine-Konto liest Läufe',
      datei: ENGINE,
      suche: `create policy engine_laeufe_lesen on public.engine_laeufe for select to authenticated
  using (apotheke_id in (select privat.meine_apotheken()));`,
      ersatz: `create policy engine_laeufe_lesen on public.engine_laeufe for select to authenticated
  using (true);`,
      tests,
    },
    {
      name: 'Meldung ohne Engine-Konto erlaubt',
      datei: ENGINE,
      suche: '    apotheke_id = (select privat.meine_engine_apotheke())\n    and gemeldet_von',
      ersatz: '    gemeldet_von',
      tests,
    },
    {
      name: 'Foto zu einem Lauf einer anderen Apotheke',
      datei: ENGINE,
      suche:
        'foreign key (lauf_id, apotheke_id) references public.engine_laeufe (id, apotheke_id) on delete cascade',
      ersatz: 'foreign key (lauf_id) references public.engine_laeufe (id) on delete cascade',
      tests,
    },
    {
      name: 'Läufe lassen sich ändern und löschen',
      datei: ENGINE,
      suche:
        'grant all on public.engine_konten, public.engine_laeufe, public.engine_fotos to service_role;',
      ersatz:
        'grant all on public.engine_konten, public.engine_laeufe, public.engine_fotos to service_role;\ngrant update, delete on public.engine_laeufe to authenticated;\ncreate policy offen on public.engine_laeufe for all to authenticated using (true);',
      tests,
    },
  ].map((s) => ({ ...s, vorbereiten: RESET, konfig: KONFIG }));
}

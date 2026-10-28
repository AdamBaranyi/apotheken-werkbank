-- Tagesabschluss («Z-Bon»): fasst alle Belege seit dem letzten Abschluss
-- zusammen, je Zahlart und je Steuersatz. Wer abschliesst, schickt nur die
-- Apotheke; Nummer, Belegbereich und Summen rechnet die Datenbank. Gleiche
-- Grundsätze wie die Kasse (20261027120000_kasse.sql): nur anhängen, nie
-- ändern; Regeln an der Tabelle. Fehlercode WK009.

create table public.tagesabschluesse (
  id uuid primary key default gen_random_uuid(),
  apotheke_id uuid not null references public.apotheken (id) on delete cascade,
  nummer integer not null,
  von_beleg integer not null,
  bis_beleg integer not null,
  anzahl_belege integer not null,
  umsatz_cent integer not null,
  bar_cent integer not null,
  karte_cent integer not null,
  stornos integer not null,
  storno_cent integer not null,
  steuern jsonb not null,
  waehrung text not null,
  erstellt_von uuid,
  erstellt_am timestamptz not null default now(),
  unique (apotheke_id, nummer)
);

create function privat.abschluss_rechnen() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_letzter integer;
  v_bis integer;
begin
  -- Sperrt den Belegzähler: Ein Verkauf, der gerade bucht, kommt noch hinein,
  -- jeder spätere in den nächsten Abschluss. Kein Beleg fällt dazwischen.
  perform 1 from privat.zaehler z where z.apotheke_id = new.apotheke_id and z.art = 'beleg' for update;
  select coalesce(max(t.bis_beleg), 0) into v_letzter
    from public.tagesabschluesse t where t.apotheke_id = new.apotheke_id;
  select max(v.belegnummer) into v_bis from public.verkaeufe v where v.apotheke_id = new.apotheke_id;
  if v_bis is null or v_bis <= v_letzter then
    raise exception using errcode = 'WK009', message = 'Seit dem letzten Abschluss gibt es keine Belege.';
  end if;
  new.von_beleg := v_letzter + 1;
  new.bis_beleg := v_bis;
  new.nummer := privat.naechste_nummer(new.apotheke_id, 'abschluss');
  select count(*)::integer,
    coalesce(sum(b.summe_cent), 0)::integer,
    coalesce(sum(b.summe_cent) filter (where b.zahlart = 'bar'), 0)::integer,
    coalesce(sum(b.summe_cent) filter (where b.zahlart = 'karte'), 0)::integer,
    (count(*) filter (where b.storno_von is not null))::integer,
    coalesce(sum(b.summe_cent) filter (where b.storno_von is not null), 0)::integer,
    min(b.waehrung)
    into new.anzahl_belege, new.umsatz_cent, new.bar_cent, new.karte_cent, new.stornos,
      new.storno_cent, new.waehrung
    from public.belege b
    where b.apotheke_id = new.apotheke_id and b.belegnummer between new.von_beleg and new.bis_beleg;
  select coalesce(jsonb_agg(jsonb_build_object(
      'satz_promille', s.satz, 'brutto_cent', s.brutto, 'steuer_cent', s.steuer,
      'netto_cent', s.brutto - s.steuer) order by s.satz), '[]'::jsonb)
    into new.steuern
    from (
      select st.satz_promille as satz, sum(st.brutto_cent)::integer as brutto,
        sum(st.steuer_cent)::integer as steuer
      from public.beleg_steuern st
      join public.verkaeufe v on v.id = st.verkauf_id
      where v.apotheke_id = new.apotheke_id and v.belegnummer between new.von_beleg and new.bis_beleg
      group by st.satz_promille
    ) s;
  new.erstellt_von := (select auth.uid());
  new.erstellt_am := now();
  return new;
end $$;
revoke all on function privat.abschluss_rechnen() from public, anon, authenticated;
create trigger abschluss_rechnen before insert on public.tagesabschluesse
  for each row execute function privat.abschluss_rechnen();

alter table public.tagesabschluesse enable row level security;
alter table public.tagesabschluesse force row level security;

create policy abschluesse_lesen on public.tagesabschluesse for select to authenticated
  using (apotheke_id in (select privat.meine_apotheken()));
-- Jedes Mitglied schliesst ab, wie am Abend an der Kasse üblich.
create policy abschluesse_anlegen on public.tagesabschluesse for insert to authenticated
  with check (apotheke_id in (select privat.meine_apotheken()));

revoke all on public.tagesabschluesse from anon, authenticated;
grant select on public.tagesabschluesse to authenticated;
grant insert (apotheke_id) on public.tagesabschluesse to authenticated;
grant all on public.tagesabschluesse to service_role;

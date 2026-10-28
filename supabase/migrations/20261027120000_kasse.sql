-- Kasse: Steuersätze je Land, Verkäufe mit Positionen und Storno. Der Tagesabschluss
-- folgt in der nächsten Migration.
--
-- Grundsatz (docs/ENTSCHEIDE.md E22): Belege werden nur angehängt, nie
-- geändert oder gelöscht, auch nicht von der Datenbank selbst. Wer bucht,
-- schickt PZN, Menge, Rezept-Häkchen und Zahlung; Preise, Steuersätze,
-- Belegnummern und Summen setzt die Datenbank. Die Regeln stehen an den
-- Tabellen (Trigger, Prüfungen, RLS) und gelten damit für jeden Weg, auch für
-- einen direkten Aufruf der REST-Schnittstelle. Die Trigger laufen mit den
-- Rechten des Besitzers und liegen im Schema privat, das die REST-Schnittstelle
-- nicht erreicht. Fehlercodes WK001–WK010, Meldungen für Menschen.

-- 1 Steuergruppe statt «voll/ermässigt»: Der Satz hängt am Land. Ein
--   Arzneimittel trägt in Deutschland 19 %, in der Schweiz 2,6 %.
alter table public.artikel
  add column steuergruppe text check (steuergruppe in ('arzneimittel', 'lebensmittel', 'sonstiges'));
update public.artikel
  set steuergruppe = case mwst_kategorie when 'ermaessigt' then 'lebensmittel' else 'arzneimittel' end;
alter table public.artikel alter column steuergruppe set not null;
alter table public.artikel drop column mwst_kategorie;

create table public.steuersaetze (
  land text not null check (land in ('DE', 'CH', 'AT')),
  steuergruppe text not null check (steuergruppe in ('arzneimittel', 'lebensmittel', 'sonstiges')),
  gueltig_ab date not null,
  satz_promille integer not null check (satz_promille between 0 and 1000),
  primary key (land, steuergruppe, gueltig_ab)
);
-- Geprüft am 27.10.2026, Quellen in docs/KASSE.md. Deutschland seit dem Ende
-- der befristeten Senkung (2020) wieder 19 % und 7 %; Nahrungsergänzung ist
-- Lebensmittel. Schweiz seit 1.1.2024: 8,1 %, Medikamente und Lebensmittel
-- 2,6 %. Österreich fehlt bewusst: Eine Apotheke dort bucht nicht (WK007).
insert into public.steuersaetze (land, steuergruppe, gueltig_ab, satz_promille) values
  ('DE', 'arzneimittel', '2021-01-01', 190),
  ('DE', 'lebensmittel', '2021-01-01', 70),
  ('DE', 'sonstiges', '2021-01-01', 190),
  ('CH', 'arzneimittel', '2024-01-01', 26),
  ('CH', 'lebensmittel', '2024-01-01', 26),
  ('CH', 'sonstiges', '2024-01-01', 81);

-- 2 Lückenlose Nummern je Apotheke. Ein Abbruch rollt den Zähler mit zurück.
create table privat.zaehler (
  apotheke_id uuid not null references public.apotheken (id) on delete cascade,
  art text not null check (art in ('beleg', 'abschluss', 'bestellung')),
  wert integer not null,
  primary key (apotheke_id, art)
);
revoke all on privat.zaehler from public, anon, authenticated;

create function privat.naechste_nummer(p_apotheke uuid, p_art text) returns integer
language sql volatile set search_path = ''
as $$
  insert into privat.zaehler as z (apotheke_id, art, wert) values (p_apotheke, p_art, 1)
  on conflict (apotheke_id, art) do update set wert = z.wert + 1
  returning z.wert
$$;
revoke all on function privat.naechste_nummer(uuid, text) from public, anon, authenticated;

-- 3 Verkäufe (Belege) und ihre Positionen.
create table public.verkaeufe (
  id uuid primary key default gen_random_uuid(),
  apotheke_id uuid not null references public.apotheken (id) on delete cascade,
  belegnummer integer not null,
  land text not null,
  waehrung text not null check (waehrung in ('EUR', 'CHF')),
  zahlart text not null check (zahlart in ('bar', 'karte')),
  gegeben_cent integer check (gegeben_cent between 0 and 10000000),
  storno_von uuid,
  erstellt_von uuid,
  erstellt_am timestamptz not null default now(),
  unique (apotheke_id, belegnummer),
  unique (id, apotheke_id),
  -- Ein Beleg wird höchstens einmal storniert, nur innerhalb der Apotheke.
  unique (storno_von, apotheke_id),
  foreign key (storno_von, apotheke_id) references public.verkaeufe (id, apotheke_id),
  check (zahlart = 'bar' or gegeben_cent is null),
  check (storno_von is null or gegeben_cent is null)
);

create table public.verkaufspositionen (
  verkauf_id uuid not null references public.verkaeufe (id) on delete cascade,
  nr smallint not null,
  pzn text not null references public.artikel (pzn),
  name text not null,
  packung text not null,
  menge integer not null check (menge between -999 and 999 and menge <> 0),
  einzelpreis_cent integer not null check (einzelpreis_cent > 0),
  steuergruppe text not null,
  satz_promille integer not null,
  rezeptpflichtig boolean not null,
  rezept_vorgelegt boolean not null default false,
  primary key (verkauf_id, nr),
  unique (verkauf_id, pzn)
);
create index verkaufspositionen_pzn_idx on public.verkaufspositionen (pzn);

-- Kopf: Nummer, Land, Währung und wer bucht. Ein Storno übernimmt Zahlart
-- und Land des Originals; ein Storno selbst wird nie storniert.
create function privat.verkauf_vorbereiten() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_original public.verkaeufe;
begin
  select a.land into new.land from public.apotheken a where a.id = new.apotheke_id;
  if new.storno_von is not null then
    select * into v_original from public.verkaeufe o
      where o.id = new.storno_von and o.apotheke_id = new.apotheke_id;
    if not found then
      raise exception using errcode = 'WK004', message = 'Diesen Beleg gibt es nicht.';
    end if;
    if v_original.storno_von is not null then
      raise exception using errcode = 'WK005', message = 'Ein Storno lässt sich nicht stornieren.';
    end if;
    new.zahlart := v_original.zahlart;
    new.land := v_original.land;
  end if;
  new.waehrung := case new.land when 'CH' then 'CHF' else 'EUR' end;
  new.belegnummer := privat.naechste_nummer(new.apotheke_id, 'beleg');
  new.erstellt_von := (select auth.uid());
  return new;
end $$;
revoke all on function privat.verkauf_vorbereiten() from public, anon, authenticated;
create trigger verkauf_vorbereiten before insert on public.verkaeufe
  for each row execute function privat.verkauf_vorbereiten();

-- Position: Name, Preis und Satz aus Katalog und Land zum Zeitpunkt des
-- Verkaufs; beim Storno genau die Werte der Originalposition.
create function privat.position_vorbereiten() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_kopf public.verkaeufe;
  v_artikel public.artikel;
  v_original public.verkaufspositionen;
  v_satz integer;
begin
  select * into v_kopf from public.verkaeufe v where v.id = new.verkauf_id;
  if not found then
    raise exception using errcode = 'WK004', message = 'Diesen Beleg gibt es nicht.';
  end if;
  if v_kopf.storno_von is not null then
    select * into v_original from public.verkaufspositionen p
      where p.verkauf_id = v_kopf.storno_von and p.pzn = new.pzn;
    if not found or new.menge is distinct from -v_original.menge then
      raise exception using errcode = 'WK006', message = 'Das Storno passt nicht zum Beleg.';
    end if;
    v_artikel.name := v_original.name;
    v_artikel.packung := v_original.packung;
    v_artikel.preis_cent := v_original.einzelpreis_cent;
    v_artikel.steuergruppe := v_original.steuergruppe;
    v_artikel.rezeptpflichtig := v_original.rezeptpflichtig;
    v_satz := v_original.satz_promille;
    new.rezept_vorgelegt := v_original.rezept_vorgelegt;
  else
    if new.menge is null or new.menge not between 1 and 999 then
      raise exception using errcode = 'WK010', message = 'Die Menge muss zwischen 1 und 999 liegen.';
    end if;
    select * into v_artikel from public.artikel a where a.pzn = new.pzn;
    if not found then
      raise exception using errcode = 'WK008',
        message = format('Einen Artikel mit der PZN %s gibt es nicht.', new.pzn);
    end if;
    if v_artikel.rezeptpflichtig and not coalesce(new.rezept_vorgelegt, false) then
      raise exception using errcode = 'WK002',
        message = format('%s ist rezeptpflichtig: ohne vorgelegtes Rezept kein Verkauf.', v_artikel.name);
    end if;
    -- Der Tag des Verkaufs in der Zeit der Apotheke, nicht in UTC.
    select s.satz_promille into v_satz from public.steuersaetze s
      where s.land = v_kopf.land and s.steuergruppe = v_artikel.steuergruppe
        and s.gueltig_ab <= (v_kopf.erstellt_am at time zone
          case v_kopf.land when 'CH' then 'Europe/Zurich' else 'Europe/Berlin' end)::date
      order by s.gueltig_ab desc
      limit 1;
    if v_satz is null then
      raise exception using errcode = 'WK007',
        message = format('Für das Land %s ist kein Steuersatz hinterlegt.', v_kopf.land);
    end if;
    new.rezept_vorgelegt := coalesce(new.rezept_vorgelegt, false);
  end if;
  new.name := v_artikel.name;
  new.packung := v_artikel.packung;
  new.einzelpreis_cent := v_artikel.preis_cent;
  new.steuergruppe := v_artikel.steuergruppe;
  new.rezeptpflichtig := v_artikel.rezeptpflichtig;
  new.satz_promille := v_satz;
  new.nr := coalesce((select max(p.nr) from public.verkaufspositionen p where p.verkauf_id = new.verkauf_id), 0) + 1;
  return new;
end $$;
revoke all on function privat.position_vorbereiten() from public, anon, authenticated;
create trigger position_vorbereiten before insert on public.verkaufspositionen
  for each row execute function privat.position_vorbereiten();

-- Beim Abschluss der Anfrage (aufgeschoben): Positionen da, Bargeld reicht,
-- Storno spiegelt das Original vollständig.
create function privat.beleg_pruefen() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_anzahl integer;
  v_summe integer;
begin
  select count(*), coalesce(sum(p.menge * p.einzelpreis_cent), 0)
    into v_anzahl, v_summe
    from public.verkaufspositionen p where p.verkauf_id = new.id;
  if v_anzahl = 0 then
    raise exception using errcode = 'WK001', message = 'Ein Beleg braucht mindestens eine Position.';
  end if;
  if new.storno_von is not null then
    if exists (
      select 1 from public.verkaufspositionen o
      where o.verkauf_id = new.storno_von
        and not exists (
          select 1 from public.verkaufspositionen s where s.verkauf_id = new.id and s.pzn = o.pzn
        )
    ) then
      raise exception using errcode = 'WK006', message = 'Das Storno passt nicht zum Beleg.';
    end if;
  elsif new.zahlart = 'bar' and coalesce(new.gegeben_cent, -1) < v_summe then
    raise exception using errcode = 'WK003', message = 'Der gegebene Betrag reicht nicht.';
  end if;
  return null;
end $$;
revoke all on function privat.beleg_pruefen() from public, anon, authenticated;
create constraint trigger beleg_pruefen after insert on public.verkaeufe
  deferrable initially deferred for each row execute function privat.beleg_pruefen();

-- 4 Sichten für Beleg und Steuer. security_invoker: Es gelten die Regeln der
--   Person, die liest. Steuer je Satz auf dem Beleg kaufmännisch gerundet,
--   bei einem Storno spiegelbildlich (round rundet von null weg).
create view public.belege with (security_invoker = true) as
select v.id, v.apotheke_id, v.belegnummer, v.land, v.waehrung, v.zahlart, v.gegeben_cent,
  v.storno_von, v.erstellt_von, v.erstellt_am, s.summe_cent,
  case when v.zahlart = 'bar' and v.storno_von is null then v.gegeben_cent - s.summe_cent end
    as rueckgeld_cent,
  (select x.id from public.verkaeufe x where x.storno_von = v.id) as storniert_durch
from public.verkaeufe v
cross join lateral (
  select coalesce(sum(p.menge * p.einzelpreis_cent), 0)::integer as summe_cent
  from public.verkaufspositionen p where p.verkauf_id = v.id
) s;

create view public.beleg_steuern with (security_invoker = true) as
select p.verkauf_id, p.satz_promille,
  sum(p.menge * p.einzelpreis_cent)::integer as brutto_cent,
  round(sum(p.menge * p.einzelpreis_cent)::numeric * p.satz_promille / (1000 + p.satz_promille))::integer
    as steuer_cent
from public.verkaufspositionen p
group by p.verkauf_id, p.satz_promille;

-- 5 Zugriffe für die Kasse. Zwei Schritte in einer Anfrage, damit ein
--   Doppelklick denselben Beleg trifft (gleiche ID) und nichts halb gebucht wird.
create function public.verkauf_buchen(
  p_id uuid, p_apotheke uuid, p_zahlart text, p_gegeben_cent integer, p_positionen jsonb
) returns table (id uuid, belegnummer integer)
language plpgsql security invoker set search_path = ''
as $$
#variable_conflict use_column
begin
  -- Gleiche ID noch einmal (Doppelklick, Neuladen): derselbe Beleg. Kein
  -- «on conflict do nothing»: Der Trigger hätte den Zähler schon erhöht, und
  -- es entstünde eine Lücke in den Belegnummern.
  return query select v.id, v.belegnummer from public.verkaeufe v where v.id = p_id;
  if found then
    return;
  end if;
  if jsonb_typeof(p_positionen) is distinct from 'array' or jsonb_array_length(p_positionen) = 0 then
    raise exception using errcode = 'WK001', message = 'Ein Beleg braucht mindestens eine Position.';
  end if;
  insert into public.verkaeufe (id, apotheke_id, zahlart, gegeben_cent)
    values (p_id, p_apotheke, p_zahlart, p_gegeben_cent);
  insert into public.verkaufspositionen (verkauf_id, pzn, menge, rezept_vorgelegt)
    select p_id, x.pzn, x.menge, coalesce(x.rezept_vorgelegt, false)
    from jsonb_to_recordset(p_positionen) as x (pzn text, menge integer, rezept_vorgelegt boolean);
  return query select v.id, v.belegnummer from public.verkaeufe v where v.id = p_id;
end $$;
revoke all on function public.verkauf_buchen(uuid, uuid, text, integer, jsonb) from public, anon, authenticated;
grant execute on function public.verkauf_buchen(uuid, uuid, text, integer, jsonb) to authenticated;

create function public.verkauf_stornieren(p_id uuid, p_original uuid)
returns table (id uuid, belegnummer integer)
language plpgsql security invoker set search_path = ''
as $$
#variable_conflict use_column
declare
  v_apotheke uuid;
begin
  return query select v.id, v.belegnummer from public.verkaeufe v where v.id = p_id;
  if found then
    return;
  end if;
  select o.apotheke_id into v_apotheke from public.verkaeufe o where o.id = p_original;
  if not found then
    raise exception using errcode = 'WK004', message = 'Diesen Beleg gibt es nicht.';
  end if;
  -- Zahlart, Land und Preise übernimmt der Trigger aus dem Original.
  insert into public.verkaeufe (id, apotheke_id, zahlart, storno_von)
    values (p_id, v_apotheke, 'karte', p_original);
  insert into public.verkaufspositionen (verkauf_id, pzn, menge)
    select p_id, p.pzn, -p.menge from public.verkaufspositionen p where p.verkauf_id = p_original;
  return query select v.id, v.belegnummer from public.verkaeufe v where v.id = p_id;
end $$;
revoke all on function public.verkauf_stornieren(uuid, uuid) from public, anon, authenticated;
grant execute on function public.verkauf_stornieren(uuid, uuid) to authenticated;

-- 6 Row Level Security, erzwungen, und Rechte: zuerst alles weg, dann gezielt.
alter table public.steuersaetze enable row level security;
alter table public.steuersaetze force row level security;
alter table public.verkaeufe enable row level security;
alter table public.verkaeufe force row level security;
alter table public.verkaufspositionen enable row level security;
alter table public.verkaufspositionen force row level security;

create policy steuersaetze_lesen on public.steuersaetze for select to authenticated using (true);
create policy verkaeufe_lesen on public.verkaeufe for select to authenticated
  using (apotheke_id in (select privat.meine_apotheken()));
-- Stornieren darf nur, wer die Apotheke führt.
create policy verkaeufe_anlegen on public.verkaeufe for insert to authenticated
  with check (
    apotheke_id in (select privat.meine_apotheken())
    and (storno_von is null or privat.ist_inhaber(apotheke_id))
  );
create policy positionen_lesen on public.verkaufspositionen for select to authenticated
  using (exists (
    select 1 from public.verkaeufe v
    where v.id = verkauf_id and v.apotheke_id in (select privat.meine_apotheken())
  ));
-- Positionen nur zu einem Beleg aus derselben Anfrage (now() ist der Beginn
-- der Transaktion): Einen gebuchten Beleg ergänzt niemand nachträglich.
create policy positionen_anlegen on public.verkaufspositionen for insert to authenticated
  with check (exists (
    select 1 from public.verkaeufe v
    where v.id = verkauf_id and v.erstellt_am = now()
      and v.apotheke_id in (select privat.meine_apotheken())
  ));

revoke all on public.steuersaetze, public.verkaeufe, public.verkaufspositionen,
  public.belege, public.beleg_steuern from anon, authenticated;
grant select on public.steuersaetze, public.verkaeufe, public.verkaufspositionen,
  public.belege, public.beleg_steuern to authenticated;
grant insert (id, apotheke_id, zahlart, gegeben_cent, storno_von) on public.verkaeufe to authenticated;
grant insert (verkauf_id, pzn, menge, rezept_vorgelegt) on public.verkaufspositionen to authenticated;
grant all on public.steuersaetze, public.verkaeufe, public.verkaufspositionen,
  public.belege, public.beleg_steuern to service_role;

-- Bestellungen beim Grosshändler über MSV3.
--
-- Die ID legt die App vor dem Senden fest und schickt sie als Bestell-ID mit
-- (MSV3 verlangt eine GUID je Bestellung, Pflichtenheft Kap. 2.2.1). Ein
-- Doppelklick trifft dieselbe Zeile, und nach einem Abbruch fragt die App mit
-- dieser ID den Status ab, statt doppelt zu bestellen (Kap. 6.3). Der Status
-- ist eine Kopie der Antwort des Grosshändlers; massgeblich bleibt der
-- Grosshändler. Positionen werden nie geändert. Fehlercodes WB001–WB003.

-- Für den zusammengesetzten Fremdschlüssel: Eine Bestellung nutzt nur einen
-- Zugang ihrer eigenen Apotheke (ein Fremdschlüssel prüft an RLS vorbei).
alter table public.grosshaendler_zugaenge
  add constraint grosshaendler_zugaenge_id_apotheke_key unique (id, apotheke_id);

create table public.bestellungen (
  id uuid primary key default gen_random_uuid(),
  apotheke_id uuid not null references public.apotheken (id) on delete cascade,
  zugang_id uuid not null,
  auftrag_id uuid not null default gen_random_uuid(),
  support_id integer not null,
  status text not null default 'wird_gesendet' check (status in (
    'wird_gesendet', 'bestaetigt', 'abgelehnt', 'unklar', 'nicht_angekommen', 'ohne_antwort'
  )),
  meldung text check (char_length(meldung) <= 500),
  antwort jsonb check (antwort is null or jsonb_typeof(antwort) = 'object'),
  erstellt_von uuid,
  erstellt_am timestamptz not null default now(),
  aktualisiert_am timestamptz,
  unique (apotheke_id, support_id),
  -- Ohne «on delete»: Ein Zugang mit Bestellungen lässt sich nicht einzeln
  -- löschen; mit der ganzen Apotheke gehen beide.
  foreign key (zugang_id, apotheke_id) references public.grosshaendler_zugaenge (id, apotheke_id)
);
create index bestellungen_zugang_idx on public.bestellungen (zugang_id, apotheke_id);

create table public.bestellpositionen (
  bestellung_id uuid not null references public.bestellungen (id) on delete cascade,
  pzn text not null references public.artikel (pzn),
  menge integer not null check (menge between 1 and 9999),
  primary key (bestellung_id, pzn)
);
create index bestellpositionen_pzn_idx on public.bestellpositionen (pzn);

create function privat.bestellung_vorbereiten() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.support_id := privat.naechste_nummer(new.apotheke_id, 'bestellung');
  new.status := 'wird_gesendet';
  new.meldung := null;
  new.antwort := null;
  new.aktualisiert_am := null;
  new.erstellt_von := (select auth.uid());
  return new;
end $$;
revoke all on function privat.bestellung_vorbereiten() from public, anon, authenticated;
create trigger bestellung_vorbereiten before insert on public.bestellungen
  for each row execute function privat.bestellung_vorbereiten();

-- Nur Wechsel, die eine Antwort des Grosshändlers erklärt. «nicht angekommen»
-- und «ohne Antwort» kennt nur, wer den Status abgefragt hat; aus «bestätigt»,
-- «abgelehnt» und «ohne Antwort» führt kein Weg zurück.
create function privat.bestellstatus_pruefen() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if not (
    (old.status = 'wird_gesendet' and new.status in ('bestaetigt', 'abgelehnt', 'unklar'))
    or (old.status in ('unklar', 'nicht_angekommen') and new.status in (
      'bestaetigt', 'abgelehnt', 'unklar', 'nicht_angekommen', 'ohne_antwort'
    ))
  ) then
    raise exception using errcode = 'WB001',
      message = format('Der Status «%s» lässt sich nicht in «%s» ändern.', old.status, new.status);
  end if;
  new.aktualisiert_am := now();
  return new;
end $$;
revoke all on function privat.bestellstatus_pruefen() from public, anon, authenticated;
create trigger bestellstatus_pruefen before update on public.bestellungen
  for each row execute function privat.bestellstatus_pruefen();

create function privat.bestellung_pruefen() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.bestellpositionen p where p.bestellung_id = new.id) then
    raise exception using errcode = 'WB003', message = 'Eine Bestellung braucht mindestens eine Position.';
  end if;
  return null;
end $$;
revoke all on function privat.bestellung_pruefen() from public, anon, authenticated;
create constraint trigger bestellung_pruefen after insert on public.bestellungen
  deferrable initially deferred for each row execute function privat.bestellung_pruefen();

create function public.bestellung_anlegen(p_id uuid, p_zugang uuid, p_positionen jsonb)
returns table (id uuid, auftrag_id uuid, support_id integer, neu boolean)
language plpgsql security invoker set search_path = ''
as $$
#variable_conflict use_column
declare
  v_apotheke uuid;
begin
  -- Gleiche ID noch einmal: dieselbe Bestellung, nichts doppelt.
  return query
    select b.id, b.auftrag_id, b.support_id, false from public.bestellungen b where b.id = p_id;
  if found then
    return;
  end if;
  if jsonb_typeof(p_positionen) is distinct from 'array' or jsonb_array_length(p_positionen) = 0 then
    raise exception using errcode = 'WB003', message = 'Eine Bestellung braucht mindestens eine Position.';
  end if;
  select z.apotheke_id into v_apotheke from public.grosshaendler_zugaenge z where z.id = p_zugang;
  if not found then
    raise exception using errcode = 'WB002',
      message = 'Diesen Grosshändler-Zugang gibt es für Ihre Apotheke nicht.';
  end if;
  insert into public.bestellungen (id, apotheke_id, zugang_id) values (p_id, v_apotheke, p_zugang);
  insert into public.bestellpositionen (bestellung_id, pzn, menge)
    select p_id, x.pzn, x.menge from jsonb_to_recordset(p_positionen) as x (pzn text, menge integer);
  return query
    select b.id, b.auftrag_id, b.support_id, true from public.bestellungen b where b.id = p_id;
end $$;
revoke all on function public.bestellung_anlegen(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.bestellung_anlegen(uuid, uuid, jsonb) to authenticated;

alter table public.bestellungen enable row level security;
alter table public.bestellungen force row level security;
alter table public.bestellpositionen enable row level security;
alter table public.bestellpositionen force row level security;

create policy bestellungen_lesen on public.bestellungen for select to authenticated
  using (apotheke_id in (select privat.meine_apotheken()));
create policy bestellungen_anlegen on public.bestellungen for insert to authenticated
  with check (apotheke_id in (select privat.meine_apotheken()));
create policy bestellungen_status on public.bestellungen for update to authenticated
  using (apotheke_id in (select privat.meine_apotheken()))
  with check (apotheke_id in (select privat.meine_apotheken()));
create policy bestellpositionen_lesen on public.bestellpositionen for select to authenticated
  using (exists (
    select 1 from public.bestellungen b
    where b.id = bestellung_id and b.apotheke_id in (select privat.meine_apotheken())
  ));
-- Wie bei den Belegen: Positionen nur in derselben Anfrage wie der Kopf.
create policy bestellpositionen_anlegen on public.bestellpositionen for insert to authenticated
  with check (exists (
    select 1 from public.bestellungen b
    where b.id = bestellung_id and b.erstellt_am = now()
      and b.apotheke_id in (select privat.meine_apotheken())
  ));

revoke all on public.bestellungen, public.bestellpositionen from anon, authenticated;
grant select on public.bestellungen, public.bestellpositionen to authenticated;
grant insert (id, apotheke_id, zugang_id) on public.bestellungen to authenticated;
grant update (status, meldung, antwort) on public.bestellungen to authenticated;
grant insert (bestellung_id, pzn, menge) on public.bestellpositionen to authenticated;
grant all on public.bestellungen, public.bestellpositionen to service_role;

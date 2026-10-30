-- Flow-Monitor: Die Engine meldet ihre Läufe mit einem eigenen Konto.
--
-- Ein Engine-Konto steht in engine_konten, nicht in mitglieder. Alle Regeln
-- der übrigen Tabellen fragen mitglieder; ein Engine-Konto sieht dort also
-- nichts, ohne dass eine Regel geändert wird. Es darf genau zwei Dinge:
-- einen Lauf seiner Apotheke melden und dazu ein Bildschirmfoto. Welche
-- Apotheke, setzt die Datenbank. Lesen dürfen die Mitglieder. Läufe und Fotos
-- werden nie geändert oder gelöscht (ausser mit der Apotheke).

create table public.engine_konten (
  user_id uuid primary key references auth.users (id) on delete cascade,
  apotheke_id uuid not null references public.apotheken (id) on delete cascade,
  bezeichnung text not null check (char_length(bezeichnung) between 1 and 60),
  erstellt_am timestamptz not null default now()
);
create index engine_konten_apotheke_idx on public.engine_konten (apotheke_id);

create function privat.meine_engine_apotheke() returns uuid
language sql stable security definer set search_path = ''
as $$
  select k.apotheke_id from public.engine_konten k where k.user_id = (select auth.uid())
$$;
revoke all on function privat.meine_engine_apotheke() from public, anon, authenticated;
grant execute on function privat.meine_engine_apotheke() to authenticated;

create table public.engine_laeufe (
  -- Die Engine wählt die ID selbst: Sie meldet danach das Foto dazu, ohne den
  -- Lauf lesen zu dürfen.
  id uuid primary key,
  apotheke_id uuid not null default privat.meine_engine_apotheke()
    references public.apotheken (id) on delete cascade,
  lauf text not null check (lauf ~ '^L-[0-9]{8}-[0-9]{6}-[2-9A-Z]{4}$'),
  flow text not null check (flow ~ '^[a-z][a-z0-9-]{1,30}$'),
  kasse text not null check (kasse ~ '^[a-z][a-z0-9-]{1,30}$'),
  status text not null check (
    status in ('ok', 'bereits-gebucht', 'nichts-offen', 'abgebrochen', 'unklar', 'trocken')
  ),
  kennung text not null default '' check (kennung ~ '^([2-9A-Z]{2}-[2-9A-Z]{4})?$'),
  beginn timestamptz not null,
  dauer_ms integer not null check (dauer_ms between 0 and 86400000),
  treiber text not null check (treiber in ('windows', 'fake')),
  heilungen integer not null default 0 check (heilungen between 0 and 100),
  bericht jsonb not null check (octet_length(bericht::text) <= 200000),
  gemeldet_von uuid not null default auth.uid() references auth.users (id) on delete cascade,
  gemeldet_am timestamptz not null default now(),
  unique (apotheke_id, lauf),
  unique (id, apotheke_id)
);
create index engine_laeufe_liste_idx on public.engine_laeufe (apotheke_id, beginn desc);
create index engine_laeufe_gemeldet_idx on public.engine_laeufe (gemeldet_von);

create table public.engine_fotos (
  lauf_id uuid primary key,
  apotheke_id uuid not null default privat.meine_engine_apotheke(),
  art text not null check (art in ('png', 'text')),
  inhalt bytea not null check (octet_length(inhalt) between 1 and 1048576),
  -- Zusammengesetzt: Ein Foto gehört zu einem Lauf derselben Apotheke. Der
  -- Fremdschlüssel prüft an RLS vorbei, darum hier und nicht in einer Regel.
  foreign key (lauf_id, apotheke_id) references public.engine_laeufe (id, apotheke_id) on delete cascade
);

alter table public.engine_konten enable row level security;
alter table public.engine_konten force row level security;
alter table public.engine_laeufe enable row level security;
alter table public.engine_laeufe force row level security;
alter table public.engine_fotos enable row level security;
alter table public.engine_fotos force row level security;

create policy engine_konten_lesen on public.engine_konten for select to authenticated
  using (apotheke_id in (select privat.meine_apotheken()));
create policy engine_laeufe_lesen on public.engine_laeufe for select to authenticated
  using (apotheke_id in (select privat.meine_apotheken()));
create policy engine_laeufe_melden on public.engine_laeufe for insert to authenticated
  with check (
    apotheke_id = (select privat.meine_engine_apotheke())
    and gemeldet_von = (select auth.uid())
  );
create policy engine_fotos_lesen on public.engine_fotos for select to authenticated
  using (apotheke_id in (select privat.meine_apotheken()));
create policy engine_fotos_melden on public.engine_fotos for insert to authenticated
  with check (apotheke_id = (select privat.meine_engine_apotheke()));

-- Rechte: zuerst alles weg, dann gezielt, bis auf die Spalten. Die Spalten
-- apotheke_id und gemeldet_von setzt nur die Datenbank.
revoke all on public.engine_konten, public.engine_laeufe, public.engine_fotos
  from anon, authenticated;
grant select on public.engine_konten, public.engine_laeufe, public.engine_fotos to authenticated;
grant insert (id, lauf, flow, kasse, status, kennung, beginn, dauer_ms, treiber, heilungen, bericht)
  on public.engine_laeufe to authenticated;
grant insert (lauf_id, art, inhalt) on public.engine_fotos to authenticated;
-- Engine-Konten legt die Einrichtung an, mit dem Geheimschlüssel.
grant all on public.engine_konten, public.engine_laeufe, public.engine_fotos to service_role;

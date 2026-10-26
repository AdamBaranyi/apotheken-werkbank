-- Grundschema: Apotheken, Mitglieder, Artikel, Grosshändler-Zugänge.
--
-- Regeln (docs/SECURITY.md): Jede Tabelle startet ohne Rechte für anon und
-- authenticated; Rechte kommen gezielt dazu, bis auf einzelne Spalten. RLS ist
-- an und erzwungen. Funktionen haben einen festen, leeren search_path, und
-- ihre Ausführungsrechte stehen direkt unter ihnen.

create function public.pzn_gueltig(p text) returns boolean
language sql immutable set search_path = ''
as $$
  select case
    when p ~ '^[0-9]{8}$' then
      (substr(p, 1, 1)::int * 1 + substr(p, 2, 1)::int * 2 + substr(p, 3, 1)::int * 3
        + substr(p, 4, 1)::int * 4 + substr(p, 5, 1)::int * 5 + substr(p, 6, 1)::int * 6
        + substr(p, 7, 1)::int * 7) % 11 = substr(p, 8, 1)::int
    else false
  end
$$;
revoke all on function public.pzn_gueltig(text) from public, anon, authenticated;

create table public.apotheken (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  land text not null default 'DE' check (land in ('DE', 'CH', 'AT')),
  erstellt_am timestamptz not null default now()
);

create table public.mitglieder (
  apotheke_id uuid not null references public.apotheken (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rolle text not null check (rolle in ('inhaber', 'mitarbeiter')),
  erstellt_am timestamptz not null default now(),
  primary key (apotheke_id, user_id)
);
create index mitglieder_user_idx on public.mitglieder (user_id);

create table public.artikel (
  pzn text primary key check (public.pzn_gueltig(pzn)),
  name text not null check (char_length(name) between 1 and 120),
  packung text not null check (char_length(packung) between 1 and 40),
  rezeptpflichtig boolean not null,
  mwst_kategorie text not null check (mwst_kategorie in ('voll', 'ermaessigt')),
  preis_cent integer not null check (preis_cent > 0)
);

create table public.grosshaendler_zugaenge (
  id uuid primary key default gen_random_uuid(),
  apotheke_id uuid not null references public.apotheken (id) on delete cascade,
  bezeichnung text not null check (char_length(bezeichnung) between 1 and 60),
  -- https überall; http nur für die Attrappe auf dem eigenen Rechner. Welche
  -- Adressen der Server wirklich aufruft, entscheidet zusätzlich eine Liste in
  -- seiner Umgebung (Schutz vor Anfragen an interne Adressen).
  basis_url text not null check (
    basis_url ~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?(/[A-Za-z0-9._-]+)*/msv3(test)?$'
    or basis_url ~ '^http://(localhost|127\.0\.0\.1):[0-9]+/msv3(test)?$'
  ),
  kundenkennung text not null check (kundenkennung ~ '^([A-Za-z0-9]{1,80}\\)?[A-Za-z0-9]{1,80}$'),
  -- AES-256-GCM im Server der Web-App; der Schlüssel liegt nur dort.
  passwort_verschluesselt text not null check (passwort_verschluesselt like 'v1:%'),
  erstellt_am timestamptz not null default now()
);
create index zugaenge_apotheke_idx on public.grosshaendler_zugaenge (apotheke_id);

-- Hilfsfunktionen für die Regeln. SECURITY DEFINER, damit die Regel auf
-- mitglieder nicht sich selbst aufruft; sie liefern nur Kennungen der eigenen
-- Apotheken.
create function public.meine_apotheken() returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select m.apotheke_id from public.mitglieder m where m.user_id = (select auth.uid())
$$;
revoke all on function public.meine_apotheken() from public, anon, authenticated;
grant execute on function public.meine_apotheken() to authenticated;

create function public.ist_inhaber(p_apotheke uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.mitglieder m
    where m.apotheke_id = p_apotheke and m.user_id = (select auth.uid()) and m.rolle = 'inhaber'
  )
$$;
revoke all on function public.ist_inhaber(uuid) from public, anon, authenticated;
grant execute on function public.ist_inhaber(uuid) to authenticated;

-- Das verschlüsselte Passwort gibt es nur hier, nur für Mitglieder der
-- Apotheke, und nur für den Server, der es zum Bestellen entschlüsselt.
create function public.zugang_fuer_bestellung(p_zugang uuid)
returns table (basis_url text, kundenkennung text, passwort_verschluesselt text)
language sql stable security definer set search_path = ''
as $$
  select z.basis_url, z.kundenkennung, z.passwort_verschluesselt
  from public.grosshaendler_zugaenge z
  where z.id = p_zugang
    and z.apotheke_id in (
      select m.apotheke_id from public.mitglieder m where m.user_id = (select auth.uid())
    )
$$;
revoke all on function public.zugang_fuer_bestellung(uuid) from public, anon, authenticated;
grant execute on function public.zugang_fuer_bestellung(uuid) to authenticated;

-- Row Level Security, erzwungen.
alter table public.apotheken enable row level security;
alter table public.apotheken force row level security;
alter table public.mitglieder enable row level security;
alter table public.mitglieder force row level security;
alter table public.artikel enable row level security;
alter table public.artikel force row level security;
alter table public.grosshaendler_zugaenge enable row level security;
alter table public.grosshaendler_zugaenge force row level security;

create policy apotheken_lesen on public.apotheken for select to authenticated
  using (id in (select public.meine_apotheken()));
create policy mitglieder_lesen on public.mitglieder for select to authenticated
  using (apotheke_id in (select public.meine_apotheken()));
create policy artikel_lesen on public.artikel for select to authenticated using (true);
create policy zugaenge_lesen on public.grosshaendler_zugaenge for select to authenticated
  using (apotheke_id in (select public.meine_apotheken()));
create policy zugaenge_anlegen on public.grosshaendler_zugaenge for insert to authenticated
  with check (public.ist_inhaber(apotheke_id));
create policy zugaenge_aendern on public.grosshaendler_zugaenge for update to authenticated
  using (public.ist_inhaber(apotheke_id)) with check (public.ist_inhaber(apotheke_id));
create policy zugaenge_loeschen on public.grosshaendler_zugaenge for delete to authenticated
  using (public.ist_inhaber(apotheke_id));

-- Rechte: zuerst alles weg, dann gezielt.
revoke all on public.apotheken, public.mitglieder, public.artikel, public.grosshaendler_zugaenge
  from anon, authenticated;
grant select on public.apotheken, public.mitglieder, public.artikel to authenticated;
grant select (id, apotheke_id, bezeichnung, basis_url, kundenkennung, erstellt_am)
  on public.grosshaendler_zugaenge to authenticated;
grant insert (apotheke_id, bezeichnung, basis_url, kundenkennung, passwort_verschluesselt)
  on public.grosshaendler_zugaenge to authenticated;
grant update (bezeichnung, basis_url, kundenkennung, passwort_verschluesselt)
  on public.grosshaendler_zugaenge to authenticated;
grant delete on public.grosshaendler_zugaenge to authenticated;
-- Verwaltung (Konten und Apotheken anlegen) nur mit dem Geheimschlüssel.
grant all on public.apotheken, public.mitglieder, public.artikel, public.grosshaendler_zugaenge
  to service_role;

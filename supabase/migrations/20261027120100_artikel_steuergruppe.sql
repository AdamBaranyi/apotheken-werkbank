-- Erzeugt von scripts/artikel-sql.mjs aus daten/artikel.json. Nicht von Hand ändern.
-- Alle Artikel sind erfunden.
insert into public.artikel (pzn, name, packung, rezeptpflichtig, steuergruppe, preis_cent)
values
  ('99100008', 'Probatin 400 mg Filmtabletten', '20 St.', false, 'arzneimittel', 395),
  ('99101373', 'Probatin 400 mg Filmtabletten', '50 St.', false, 'arzneimittel', 795),
  ('99102740', 'Demoxan Nasenspray', '10 ml', false, 'arzneimittel', 549),
  ('99104118', 'Fictolat Saft', '100 ml', true, 'arzneimittel', 1290),
  ('99105483', 'Lehrsalbe', '50 g', false, 'arzneimittel', 875),
  ('99106850', 'Musterzin Augentropfen', '10 ml', true, 'arzneimittel', 1645),
  ('99108228', 'Erfundol 5 mg Tabletten', '100 St.', true, 'arzneimittel', 4320),
  ('99109593', 'Kaltprobe Injektionslösung', '5 Fertigspritzen', true, 'arzneimittel', 18990),
  ('99110969', 'Seltenol Kapseln', '30 St.', true, 'arzneimittel', 6250),
  ('99112336', 'Direktan Pflaster', '10 St.', false, 'sonstiges', 1199),
  ('99113703', 'Vitaminmuster Brausetabletten', '20 St.', false, 'lebensmittel', 449),
  ('99115079', 'Hustenmuster Pastillen', '24 St.', false, 'arzneimittel', 689),
  ('99116446', 'Wundprobe Gel', '20 g', false, 'arzneimittel', 925),
  ('99117813', 'Allergomuster 10 mg Tabletten', '50 St.', false, 'arzneimittel', 1495)
on conflict (pzn) do update set name = excluded.name, packung = excluded.packung,
  rezeptpflichtig = excluded.rezeptpflichtig, steuergruppe = excluded.steuergruppe,
  preis_cent = excluded.preis_cent;

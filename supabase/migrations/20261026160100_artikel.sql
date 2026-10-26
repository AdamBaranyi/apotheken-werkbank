-- Erzeugt von scripts/artikel-sql.mjs aus daten/artikel.json. Nicht von Hand ändern.
-- Alle Artikel sind erfunden.
insert into public.artikel (pzn, name, packung, rezeptpflichtig, mwst_kategorie, preis_cent)
values
  ('99100008', 'Probatin 400 mg Filmtabletten', '20 St.', false, 'voll', 395),
  ('99101373', 'Probatin 400 mg Filmtabletten', '50 St.', false, 'voll', 795),
  ('99102740', 'Demoxan Nasenspray', '10 ml', false, 'voll', 549),
  ('99104118', 'Fictolat Saft', '100 ml', true, 'voll', 1290),
  ('99105483', 'Lehrsalbe', '50 g', false, 'voll', 875),
  ('99106850', 'Musterzin Augentropfen', '10 ml', true, 'voll', 1645),
  ('99108228', 'Erfundol 5 mg Tabletten', '100 St.', true, 'voll', 4320),
  ('99109593', 'Kaltprobe Injektionslösung', '5 Fertigspritzen', true, 'voll', 18990),
  ('99110969', 'Seltenol Kapseln', '30 St.', true, 'voll', 6250),
  ('99112336', 'Direktan Pflaster', '10 St.', false, 'voll', 1199),
  ('99113703', 'Vitaminmuster Brausetabletten', '20 St.', false, 'ermaessigt', 449),
  ('99115079', 'Hustenmuster Pastillen', '24 St.', false, 'voll', 689),
  ('99116446', 'Wundprobe Gel', '20 g', false, 'voll', 925),
  ('99117813', 'Allergomuster 10 mg Tabletten', '50 St.', false, 'voll', 1495)
on conflict (pzn) do update set name = excluded.name, packung = excluded.packung,
  rezeptpflichtig = excluded.rezeptpflichtig, mwst_kategorie = excluded.mwst_kategorie,
  preis_cent = excluded.preis_cent;

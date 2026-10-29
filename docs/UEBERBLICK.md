# Überblick: Automatisierung der Vor-Ort-Apotheke

Dieses Repo ist ein Übungs- und Portfolio-Projekt. Es baut drei Arbeitsfelder nach, in denen
Software heute deutschen Vor-Ort-Apotheken Handarbeit abnimmt, und lernt dabei deren Eigenheiten
kennen. Kein Produkt, kein Kunde, keine echten Daten: Kasse und Grosshandel sind Attrappen, alle
Artikel sind erfunden und als erfunden gekennzeichnet.

Die Datei wächst mit: Jeder Bauabend ergänzt unten, was das Bauen gelehrt hat.

## Die Lage

- **Wer:** inhabergeführte Apotheken in Deutschland, oft als Verbund aus einer Hauptapotheke und
  bis zu drei Filialen. Verkauft wird in der Offizin, dem Verkaufsraum, am HV-Tisch
  (Handverkauf).
- **Womit:** Ein Warenwirtschafts- und Kassensystem auf Windows-Arbeitsplätzen ist das Zentrum.
  Daran hängen der Grosshandel (Bestellung über MSV3), das E-Rezept über die
  Telematikinfrastruktur, oft ein Kommissionierautomat und das Kartenterminal.
- **Das Problem:** Viele Abläufe laufen noch von Hand, weil zwischen den Systemen Schnittstellen
  fehlen, teuer sind oder nur einen Teil der Aufgabe abdecken. Wer automatisieren will, muss
  entweder eine Schnittstelle nutzen, die es gibt, oder die Oberfläche bedienen wie ein Mensch.
- **Die Regeln:** Apotheken verarbeiten Gesundheitsdaten (besondere Kategorie nach Art. 9
  DSGVO), echte Rezepte und echte Bestellungen. Fehler kosten Geld oder gefährden Patienten.
  Darum gilt: lieber abbrechen und melden als raten.

## Drei Arbeitsfelder und was dieses Repo davon nachbaut

### 1. Kasse ohne Schnittstelle bedienen (Computer-Use)

Eine Engine bedient die Kassensoftware nur über den Bildschirm: Bildschirmfoto, Text und Lage
per OCR lesen, Maus und Tastatur steuern, das Ergebnis wieder per OCR prüfen. Ein **Flow** ist
dabei ein Arbeitsablauf an der Kasse (Verkauf buchen, Tagesabschluss), beschrieben als Datei.
Jede Apotheke hat eigene Fenstertitel, Feldnamen und Layouts; einen Flow für eine neue Apotheke
**ausrollen** heisst, ihn mit deren Parametern anzulegen, zu prüfen und freizugeben. **Stabil
halten** heisst: auf Bildschirmzustände warten statt fest zu schlafen, nach jedem Schritt prüfen,
nie doppelt buchen, jeden Fehlschlag mit Bildschirmfoto und Laufbericht melden.

Der Unterschied zu klassischer Robotersteuerung (RPA): Findet die Engine den erwarteten Zustand
nicht, schlägt ein Modell mit Bildverständnis genau eine Aktion aus einer festen Liste vor
(«Selbstheilung»), und die Engine führt nur Erlaubtes aus. Bei einer echten Kasse zeigt jedes
Bildschirmfoto Gesundheitsdaten; ein solches Modell darf dort nur laufen, wo die Daten bleiben
dürfen (lokal oder mit Vertrag und Schwärzung). Dieses Repo schickt nur Bildschirmfotos der
Attrappe mit erfundenen Daten an ein Modell.

**Hier nachgebaut:** `engine/` (PowerShell 7, Treiber für Windows und für Tests),
`attrappe/` (Kassen-Attrappe als WinForms-Fenster in zwei Layouts = zwei Apotheken), `flows/`
(Flows je Apotheke), Windows-Läufe in der CI mit echtem Bildschirmfoto, OCR und Eingabe, dazu der
Flow-Monitor in der Web-App.

### 2. Nicht vorrätige Artikel beim Grosshandel bestellen (MSV3)

Fehlt ein Artikel im Lager (in der Apotheke heisst er dann «Defekt»), fragt die Apotheke beim
Grosshandel die Verfügbarkeit ab und bestellt. Die Schnittstelle dafür ist MSV3, eine
SOAP-Schnittstelle des deutschen pharmazeutischen Grosshandels. Ein Bestell-Tool, das mehrere
Apotheken und Standorte bedient, ist mandantenfähig: Jede Apotheke hat eigene Zugänge je
Grosshändler. Die nächste Stufe ist ein **virtueller Grosshandel**: ein eigener MSV3-Dienst, an
den die Apotheken bestellen und der die Bestellung an echte Grosshändler weitergibt, nach Preis,
Verfügbarkeit und Lieferzeit.

**Hier nachgebaut:** `grosshandel-attrappe/` als MSV3-Dienst mit eigener WSDL, Lager je Artikel,
Teillieferung, Ablehnungsgründen und mehreren Mandanten (also die Server-Seite), und in `web/`
das Bestell-Tool als Client (Artikel, Verfügbarkeit, Warenkorb, Bestellung, Status). Operationen,
Versionen und Fehlercodes stehen mit Quellen in `docs/MSV3.md`.

### 3. Cannabis-Versorgung über die Apotheke

Seit dem 1. April 2024 ist Medizinalcannabis in Deutschland kein Betäubungsmittel mehr. Rezepte
kommen oft von Telemedizin-Anbietern; Apotheken brauchen dafür Webshop, Warenwirtschaft,
Anbindung der Telemediziner, Prüf- und Herstellungsprotokolle mit qualifizierter elektronischer
Signatur (QES) und Controlling. Die Regeln sind in Bewegung: Der Gesetzentwurf BT-Drs. 21/3061
will Blüten nur noch nach persönlichem Arztkontakt verschreiben lassen und den Versand von Blüten
verbieten; im Januar 2026 war die Anhörung, im August 2026 lief die Beratung laut Lobbyregister
noch. Ein Versandverbot stärkt die Vor-Ort-Apotheke.

**Hier nachgebaut:** bewusst nicht als eigener Teil, weil echte Rezeptdaten und Signaturen kein
Übungsmaterial sind. Der Prototyp «Rezeptdatensatz → Kasse» berührt die Nahtstelle: Ein
erfundener Rezeptdatensatz aus einer Telemedizin-Attrappe legt über die Engine den Verkauf in der
Kassen-Attrappe an.

### Dazu: Kassentool und schnelle Prototypen

- **Kassentool** in `web/`: Verkauf mit Kennzeichen rezeptpflichtig oder frei, Mehrwertsteuer aus
  der Konfiguration (Vorgabe Deutschland), Zahlung bar oder Karte als Buchung ohne
  Zahlungsanbieter, Beleg als PDF, Tagesabschluss. Dazu Anmeldung, Rechte je Apotheke in der
  Datenbank, Sicherheits-Kopfzeilen und Grenzen gegen Missbrauch.
- **Prototypen** in `prototypen/` nach `docs/PROTOTYP-REZEPT.md`: zwei Stunden von der Frage bis
  zum Entscheid. Ein **Paket** ist hier ein Leistungsbündel für eine Apotheke: welche Teile,
  wie viele Standorte, welche Flows. Neue Paketideen werden als Prototyp geprüft, bevor jemand
  sie baut.

## Begriffe

| Begriff  | Bedeutung                                                                                          |
| -------- | -------------------------------------------------------------------------------------------------- |
| Offizin  | Verkaufsraum der Apotheke                                                                          |
| HV-Tisch | Handverkaufstisch, der Platz an der Kasse                                                          |
| Defekt   | Artikel, der gerade nicht am Lager ist und bestellt werden muss                                    |
| PZN      | Pharmazentralnummer, acht Stellen, die letzte ist eine Prüfziffer; Hauptkennzeichen eines Artikels |
| GTIN     | weltweite Artikelnummer (Strichcode), steht neben der PZN                                          |
| Rx / OTC | rezeptpflichtig / frei verkäuflich                                                                 |
| MSV3     | SOAP-Schnittstelle zwischen Apotheke und pharmazeutischem Grosshandel                              |
| E-Rezept | elektronisches Rezept über die Telematikinfrastruktur, für Kassenpatienten seit 2024 Pflicht       |
| QES      | qualifizierte elektronische Signatur, rechtlich der Unterschrift gleichgestellt                    |
| Flow     | Arbeitsablauf an der Kasse als Datei, je Apotheke parametriert                                     |

## Rahmen des Trainings

- **Markt Deutschland:** PZN, deutsche Mehrwertsteuer, Beträge in Euro im deutschen Format.
- **Web-App auf Vercel (Hobby):** Funktionen laufen in genau einer Region, hier Frankfurt
  (`fra1`; ohne Einstellung wäre es Washington, `iad1`). Cron-Aufträge nur einmal täglich, mit
  bis zu 59 Minuten Spielraum. Im Monat inbegriffen: 1 Million Funktionsaufrufe, 4 Stunden
  Rechenzeit, 100 GB Transfer. Nur für nicht kommerzielle, persönliche Nutzung; dieses Repo ist
  genau das. Stand 26.10.2026, Vercel-Dokumentation.
- **Datenbank Supabase (Gratis):** Region Frankfurt, nahe bei den Funktionen. Gratis-Projekte
  schlafen nach sieben Tagen ohne Aufruf ein.
- **Grosshandel-Attrappe auf einem eigenen Server:** Ein SOAP-Dienst braucht einen Dauerprozess,
  den Vercel-Funktionen nicht bieten. So reden Bestell-Tool und Grosshandel über das Netz wie in
  der Wirklichkeit.
- **Windows nur in der CI:** Die Engine läuft echt auf Windows-Läufern von GitHub Actions
  (kostenlos für öffentliche Repos); auf dem Mac laufen ihre Tests gegen einen Test-Treiber.

## Was das Bauen gelehrt hat

Wird an jedem Bauabend ergänzt.

### Abend 1, MSV3

- MSV3 ist keine einzelne Schnittstelle, sondern **sieben kleine SOAP-Dienste je Grosshändler**,
  jeder unter eigener Adresse. Ein Bestell-Tool für mehrere Apotheken spricht also mit vielen
  Diensten, je mit eigenen Zugangsdaten und eigenen Bestellfenstern.
- Die wichtigste Regel steckt in der Fehlerbehandlung: Meldet der Server einen Fehler, ist
  nachweislich nichts passiert; bricht dagegen die Verbindung ab, weiss die Apotheke es nicht.
  Darum trägt jede Bestellung eine eigene ID und es gibt `bestellstatusAbfragen` – ohne das
  gäbe es Doppelbestellungen.
- Eine Antwort ist selten «lieferbar» oder «nicht lieferbar»: Die Menge wird auf bis zu neun
  Anteile verteilt (Hauptlager, zweites Lager, Nachlieferung durch den Hersteller …), gesteuert
  durch die Liefervorgabe der Apotheke. Ein virtueller Grosshandel optimiert genau hier.
- Die WSDL der Norm ist nicht öffentlich; die Namen der Attrappe sind eine Näherung. Ein echter
  Grosshändler-Client liefe nicht ohne Anpassung.

### Abend 1, Web-App

- Die Bestellfenster gehören zum Vertrag mit dem Grosshändler und gelten bis zum Ende plus 59
  Sekunden. Für die Apotheke zählt nicht die Liste, sondern ob die nächste Tour noch erreichbar
  ist; danach richtet sich die Oberfläche.
- Weil der Server die Adresse des Grosshändlers aus der Datenbank nimmt, ist das Bestell-Tool
  ein SSRF-Ziel: Wer einen Zugang anlegen darf, könnte sonst interne Adressen abfragen lassen.
- Vercel-Funktionen erreichen keinen Dienst auf dem eigenen Rechner. Die Attrappe braucht für
  den Deploy eine öffentliche Adresse – wie ein echter Grosshändler.
- Zwei Messungen widersprachen der Erwartung: Supabase schaltet mit `[auth.email]
enable_signup = false` auch die Anmeldung ab, und Node 24 nimmt bei AES-GCM ohne
  `authTagLength` einen auf 4 Byte gekürzten Prüfwert an.
- Beim ersten Deploy auf Vercel: Die CLI lädt ohne `.vercelignore` alles hoch, auch was Git
  ignoriert, und `vercel link` legte ungefragt eine `.env.local` mit einem Token an und
  ergänzte `.gitignore`. Gebaut wird in Washington (`iad1`), die Funktionen laufen trotzdem in
  Frankfurt (`fra1`); das zeigt die Kopfzeile `x-vercel-id`.

### Abend 2, Kasse und Bestellung

- Der Mehrwertsatz hängt nicht am Artikel, sondern an Land und Warengruppe: Ein Arzneimittel
  trägt in Deutschland 19 %, in der Schweiz 2,6 %. «Voll» und «ermässigt» im Artikel war ein
  Modellfehler von Abend 1, sichtbar erst, als das Land umschaltbar wurde.
- Eine echte Kasse in Deutschland braucht eine TSE: Jede Buchung wird signiert, der Beleg nennt
  Seriennummern, Signaturzähler und Prüfwert (§ 6 KassenSichV). Die Kasse der Werkbank sagt auf
  jedem Beleg, dass das fehlt (docs/KASSE.md).
- Belege werden nie geändert; korrigiert wird mit einem Storno. Lückenlose Nummern gehen nur mit
  einem Zähler in derselben Transaktion – und nicht mit `on conflict do nothing`, weil ein
  Trigger davor schon hochzählt.
- Doppelklick und Abbruch löst dieselbe Idee: Die ID entsteht vor dem Senden. Beim Beleg kommt
  sie aus dem Seitenaufbau, bei der Bestellung geht sie als Bestell-ID an den Grosshändler, und
  nach einem Abbruch fragt man mit ihr nach, statt neu zu bestellen.
- Was die Verfügbarkeit zeigt, ist nicht, was bestellt wird: Die Liefervorgabe entscheidet, ob
  der Verbund mitliefert. Erst ein Test machte den Unterschied sichtbar.
- Läuft die Sitzung ab, während ein Formular offen ist, darf `proxy.ts` den Aufruf einer
  Server-Aktion nicht umleiten; Next versteht die Umleitung nicht und zeigt eine Fehlerseite
  (#1, die erste Bug-Kette).
- Auf Vercel sieht Supabase nur die IP des Servers. Eine Bremse für die Anmeldung braucht darum
  eigene Zähler; die IP der Person liefert Vercel in `x-real-ip`. Der Pooler von Supabase zeigt
  ein Zertifikat einer eigenen CA, die man mitliefern muss, statt die Prüfung abzuschalten.
- Eine Sperre nur je Konto ist selbst ein Angriffspunkt: Fünf falsche Passwörter von irgendwem
  sperren die Apotheke aus. Gemessen im eigenen Test, als das Testkonto gesperrt war.
- Eine Bremse muss prüfen und zählen in einem Schritt, sonst kommen gleichzeitige Versuche
  gemeinsam durch; und lässt sie bei Störung durch, lässt sie sich abschalten: erst überlasten,
  dann raten. Beides fand die Durchsicht vor dem Merge, nicht die Tests.

### Abend 3, Engine

- Ein Windows-Läufer von GitHub hat eine echte Sitzung mit Bildschirm: Fenster, Bildschirmfoto,
  Klick und Eingabe funktionieren dort wie an einem Arbeitsplatz. Nur Deutsch fehlt der OCR, und
  es nachzuinstallieren dauerte länger als zwölf Minuten. Englisch liest Umlaute trotzdem.
- Kassenschrift ist klein. Dreifach hochskaliert las die OCR alle 20 Prüfwörter, in echter Grösse
  18; doppelt wurde «15,34» zu «1 5,34».
- Eine Oberfläche ohne Schnittstelle zu bedienen heisst vor allem wissen, wann man etwas nicht
  weiss: kein Klick auf ein Ziel, das an zwei Stellen steht, kein zweiter buchender Klick, und
  «unklar» statt raten. Danach klärt die Kennung auf dem Beleg, ob gebucht wurde.
- Die heikelsten Fehler steckten im Lesen alter Zustände: ein Suchergebnis von vorhin, eine
  Meldung, die schon dastand. Die Regel: Nach einer Aktion zählt nur, was vorher nicht da war.
- Wie eine Kasse gestaltet ist, entscheidet, wie gut sie sich automatisieren lässt. Ein Haken statt
  eines Textes, dasselbe Wort auf Knopf und Beschriftung, «Karte» im Status neben dem Knopf
  «Karte»: Die Attrappe vermeidet das. Eine echte Kasse lässt sich nicht ändern; dort muss der
  Flow mit Bereich und genauem Vergleich arbeiten.

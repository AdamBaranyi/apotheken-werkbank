# MSV3 – was die Schnittstelle vorschreibt und was die Attrappe davon nachbaut

Recherchiert am 26.10.2026, Zeitbox 30 Minuten. Nichts hier stammt aus dem Gedächtnis; jede Angabe
hat eine Quelle mit Kapitelnummer.

## Quellen

1. **Pflichtenheft MSV3, Version 1.0h, Stand 13.05.2014**, DATEG Datenfernübertragungsgeräte-
   Gesellschaft mbH, 90 Seiten. Öffentlich abrufbar als PDF
   (`https://www.gebrauchs.info/assets/data/MSV3_Normen_1.0.pdf`, abgerufen 26.10.2026). Das ist
   die Primärquelle dieser Datei; Kapitelangaben beziehen sich darauf.
2. **pharmazie.com, «MSV3 interface»** (Sekundärquelle eines Softwareanbieters, abgerufen
   26.10.2026): MSV3 wird gemeinsam von DAV (Apotheken), PHAGRO (Grosshandel) und ADAS
   (Apotheken-Softwarehäuser) gepflegt; Release 2 erreichte die Fassung 2.0i am 18.06.2018 und
   brachte Lieferschein und Retoure dazu.

**Grenze:** Die WSDL- und XSD-Dateien gibt die DATEG nur an registrierte Nutzer (Kap. 2.3.5). Die
Funktionsnamen und Fachbegriffe stehen im Pflichtenheft; die genauen XML-Elementnamen, Namensräume
und Datentypen nicht. Die WSDL der Attrappe ist darum eine **Näherung** mit Namen aus dem
Pflichtenheft, nicht die Norm-WSDL. Release 2 (Lieferschein, Retoure) ist nicht öffentlich und
nicht nachgebaut.

## Was MSV3 ist

Die Internet-Schnittstelle, über die eine Apotheke beim pharmazeutischen Grosshandel
Verfügbarkeit abfragt und bestellt, als Ersatz des alten MSV2-Protokolls (Kap. 0). Jeder
Grosshändler betreibt seinen eigenen Dienst; es gibt keine zentrale Stelle (Quelle 2). Technisch:
SOAP-Webservices, beschrieben durch WSDL (Kap. 2.3.1, Anhang 12.1).

## Adressierung und Versionen (Kap. 2.3.1)

- Je Grosshändler zwei feste HTTPS-Basisadressen: Produktion endet auf `/msv3`, Test auf
  `/msv3test`.
- Dahinter die Version `/v1.0`, dann **je Funktion ein eigener SOAP-Dienst** (Lastverteilung über
  HTTP). Beispiel: `https://<gh>/<pfad>/msv3/v1.0/bestellen`.
- Höchstens zwei Versionen laufen parallel; eine alte Version bleibt mindestens sechs Monate nach
  Verfügbarkeit der neuen.
- Der Server bietet **keinen** WSDL-Download an; Clients erzeugen ihren Code offline.

## Anmeldung (Kap. 2.3.3, 6.1.2, 6.6)

- HTTP Basic Authentication über HTTPS, Benutzer = Kundenkennung, dazu Passwort. Optional eine
  Niederlassung vor der Kundenkennung, getrennt mit `\` (`niederlassung1\benutzer123`).
- Erlaubte Zeichen: `a-z`, `A-Z`, `0-9`, in der Kundenkennung zusätzlich `\`. Passwort mindestens
  8, höchstens 80 Zeichen; Kundenkennung bis 80 Zeichen.
- Der Server muss beide Varianten können: Anfrage ohne Anmeldung → 401 → mit Anmeldung, und
  Anmeldung sofort mit der ersten Anfrage.
- Nur Zertifikate einer öffentlichen Stelle, keine selbst signierten.
- Jede Anfrage trägt eine Kennung der Apothekensoftware (`ClientSoftwareKennung`).

## Die sieben Funktionen (Kap. 2.3.1, 6.2–6.7)

| Funktion                     | Zweck                                                                                                    | Grenzen                                                                             | Zeitklasse         |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------ |
| `verbindungTesten`           | Erreichbarkeit und Zugangsdaten prüfen; keine Exception heisst Erfolg                                    | –                                                                                   | zeitkritisch       |
| `vertragsdatenAbfragen`      | Vertragsdaten: gültig ab, Bestellfenster der Woche, erlaubte Auftragsarten, Ja/Nein-Vereinbarungen       | –                                                                                   | zeitkritisch       |
| `verfuegbarkeitAnfragen`     | Verfügbarkeit weniger Artikel mit Menge, spezifisch (bis 5 Anteile) oder unspezifisch (genau ein Anteil) | höchstens 50 Artikel                                                                | zeitkritisch       |
| `verfuegbarkeitAnfragenBulk` | nur «verfügbar» oder nicht, ohne Menge                                                                   | höchstens 10 000 PZN                                                                | nicht zeitkritisch |
| `bestellen`                  | verbindliche Bestellung                                                                                  | höchstens 1000 Aufträge, 1000 Positionen je Auftrag, 5000 Positionen je Übertragung | nicht zeitkritisch |
| `bestellstatusAbfragen`      | Antwort einer früheren Bestellung erneut abrufen                                                         | –                                                                                   | zeitkritisch       |
| `ruecknahmeangebotAnfordern` | Rücknahmeangebot, Bestätigung mit Referenz                                                               | höchstens 1000 Positionen                                                           | nicht zeitkritisch |

**Zeitgrenzen (Kap. 2.3.7):** zeitkritisch 10 s beim Client, 5 s beim Server; nicht zeitkritisch
30 s und 25 s; höchstens 200 000 Byte je Anfrage oder Antwort.

## Bestellung (Kap. 2.2.1, 6.2.1)

- **Bestellübertragung** mit `ID` (GUID der Apotheke) und `BestellSupportID` (Zahl, für den
  Support lesbar) → ein oder mehrere **Aufträge** mit `ID`, `Auftragsart`, `Auftragskennung`,
  `AuftragsSupportID`, optional `GebindeID` → **Positionen** mit `PZN` und `Menge`.
- Jede PZN höchstens einmal je Auftrag. IDs sind global eindeutig; eine schon benutzte ID wird
  abgelehnt (Schutz vor Doppelbestellung).
- **Auftragsarten:** `NORMAL` (immer erlaubt), `STAPEL`, `SONDER`, `VERSAND` (mit `GebindeID`).
  Die vordefinierten Kennungen gehören fest zu ihrer Art.
- **Auftragskennung:** bis 20 Zeichen aus `A–Z`, `0–9`, `+`, `-`, `_`.
- **Liefervorgabe je Position:** `Normal`, `MaxVerbund`, `MaxNachlieferung`, `MaxDispo`.
- **Antwort je Position:** Die Menge wird auf bis zu neun Anteile verteilt. Anteil-Typen:
  `Normal`, `Verbund`, `Nachlieferung`, `Dispo`, `NichtLieferbar`,
  `KeineLieferungAberNormalMoeglich`, `KeineLieferungAberVerbundMoeglich`,
  `KeineLieferungAberNachlieferungMoeglich`, `KeineLieferungAberDispoMoeglich` (Kap. 2.2.6,
  Tabelle 2). `Normal` und `Verbund` haben nie einen Defektgrund, alle anderen immer. Dazu
  Lieferzeitpunkt und/oder Tour, und eine `TourID` (bis 20 Zeichen, sieben Tage eindeutig).
- Optional je Position eine **Substitution** mit Grund `Nachfolgeprodukt`, `ReUndParallelImport`
  oder `Vorschlag`.
- Ein Auftrag kann einzeln abgelehnt werden (Auftragsfehler mit `ErrorCode`, Text für
  Endanwender, technischem Text); die anderen Aufträge der Übertragung gelten weiter.
- **Nachtbetrieb (Kap. 6.2.6):** Ist die Warenwirtschaft des Grosshändlers offline, darf er nur
  den Empfang bestätigen, ohne Defekte und Touren.

## Defektgründe (Kap. 6.2.1, Tabelle 8)

| Defektgrund           | Bedeutung                                                             |
| --------------------- | --------------------------------------------------------------------- |
| `FehltZurzeit`        | geführt, aber kein Bestand; Lieferant kann liefern                    |
| `NichtLieferbar`      | Lagerartikel, vom Hersteller nicht geliefert                          |
| `NurDirekt`           | nicht über den Grosshandel lieferbar                                  |
| `NichtGefuehrt`       | nicht im Sortiment                                                    |
| `ArtikelNrUnbekannt`  | PZN unbekannt                                                         |
| `AusserHandel`        | Artikel ausser Handel                                                 |
| `KeinBezug`           | Kunde nicht berechtigt (etwa fehlende BtM-Erlaubnis)                  |
| `Transportausschluss` | etwa Kühlware ohne Kühlkette                                          |
| `TeilDefekt`          | nur ein Teil verfügbar (nur bei unspezifischer Verfügbarkeitsanfrage) |

## Bestellstatus (Kap. 2.1.1 AF2, 6.3)

Antwort mit der ID einer Bestellung, drei Fälle: `KennungUnbekannt` (in den letzten sieben Tagen
keine Bestellung mit dieser ID), `BestellantwortNichtVerfuegbar` (ab 0 Uhr des Folgetags, sieben
Tage lang), `BestellantwortVerfuegbar` mit derselben Antwort wie beim Bestellen (am selben Tag).
Damit prüft die Apotheke nach einem Verbindungsabbruch, ob eine Bestellung angekommen ist, statt
doppelt zu bestellen.

## Fehler (Kap. 2.3.6, 6.1.1)

Jede Funktion definiert Exceptions als SOAP-Faults: `ServerException`, `AuthorizationException`,
`DenialOfServiceException` (Konto vorübergehend gesperrt), `ValidationException` (Anfrage nicht
schemakonform oder verletzt eine Regel, etwa mehr als 50 Artikel); beim Client zusätzlich
`TimeoutException` und `ClientException`. Jede trägt Exceptiontyp, Errorcode, technischen Text und
eine Meldung für Endanwender. **Wichtig:** Bei einer Exception des Servers wurde die Funktion
nachweislich nicht ausgeführt; nach Timeout oder Client-Fehler dagegen vielleicht doch, darum dann
`bestellstatusAbfragen`.

## Bestellfenster und Touren (Kap. 2.2.5, 6.7)

Feste Lieferzeitpunkte je Tour; ein Bestellfenster endet zu einer vereinbarten Minute plus 59
Sekunden technischem Puffer, massgeblich ist die Uhr des Grosshändlers. Optional ein
Hauptbestellzeitpunkt, zu dem die Software gesammelte Positionen sendet.

## Was die Grosshandel-Attrappe nachbaut

- **Funktionen:** `verbindungTesten`, `vertragsdatenAbfragen`, `verfuegbarkeitAnfragen`
  (spezifisch und unspezifisch je Vertrag), `bestellen`, `bestellstatusAbfragen`; je ein eigener
  Endpunkt unter `/msv3/v1.0/<funktion>` und `/msv3test/v1.0/<funktion>`.
- **Mandanten:** mehrere Apotheken mit eigener Kundenkennung, eigenem Passwort (nur als Hash
  gespeichert) und eigenen Vertragsdaten; ein Mandant sieht nie die Bestellungen eines anderen.
- **Fachlich:** Lager je Artikel, Teillieferung über Anteile, Liefervorgaben nach Tabelle 2,
  Defektgründe nach Tabelle 8, Schutz vor doppelter ID, Bestellstatus über sieben Tage,
  Nachtbetrieb zum Ausprobieren, Grenzen (50 Artikel, 5000 Positionen, 200 000 Byte) als
  `ValidationException`, Sperre nach zu vielen Anfragen als `DenialOfServiceException`.
- **Nicht nachgebaut:** Bulk-Verfügbarkeit, Rücknahmeangebot, Substitution, Gebinde und
  Auftragskennungen jenseits der vier Standardkennungen, Release 2. Begründung: Für das
  Bestell-Tool der Übung reichen Verfügbarkeit, Bestellung und Status; der Rest wäre Umfang ohne
  neuen Lerneffekt.
- **Näherung:** Element- und Typnamen der WSDL sind aus den Begriffen des Pflichtenhefts
  abgeleitet. Ein echter Grosshändler-Client würde gegen diese WSDL nicht ohne Anpassung laufen.

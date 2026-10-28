# Kasse – was sie tut, was sie bewusst nicht tut, und woher die Zahlen stammen

Die Kasse der Werkbank ist ein Übungsstück: erfundene Artikel, erfundene Apotheken, keine echte
Zahlung. Sie bildet nach, was ein Kassentool ausmacht, und benennt offen, was einer echten
Apothekenkasse in Deutschland fehlen würde.

## Ablauf

1. **Erfassen:** PZN eintippen oder scannen. Die Prüfziffer (Modulo 11 über die ersten sieben
   Stellen, Gewichte 1 bis 7) fängt einen Tippfehler, bevor gesucht wird. Enter in einem
   Mengenfeld führt zurück zur Erfassung und bucht nicht.
2. **Rezept:** Ein rezeptpflichtiger Artikel braucht das Häkchen «Rezept liegt vor»; ohne lehnt
   die Datenbank den Verkauf ab (WK002).
3. **Zahlung:** bar mit gegebenem Betrag und Rückgeld, oder Karte als reine Buchung.
4. **Buchen:** Die Datenbank setzt Preise, Steuersätze, Belegnummer und Summen. Die ID des
   Belegs stammt aus dem Seitenaufbau; ein zweiter Klick trifft denselben Beleg. Kommt dieselbe
   ID mit anderem Inhalt (etwa nach einem Abbruch den Bon geändert), lehnt die Datenbank ab
   (WK011) und nennt den vorhandenen Beleg.
5. **Beleg:** im Browser als Tabelle, als PDF für eine 80-mm-Rolle.
6. **Storno:** nur durch die Inhaberin oder den Inhaber, als Gegenbeleg mit den Preisen des
   Originals. Der Beleg selbst bleibt unverändert und zeigt auf das Storno.
7. **Tagesabschluss:** alle Belege seit dem letzten Abschluss, je Zahlart und je Steuersatz.

## Steuersätze (geprüft am 27.10.2026)

Der Satz hängt am Land und an der Steuergruppe des Artikels, nicht am Artikel allein. Die
Tabelle `steuersaetze` trägt zu jedem Satz das Datum, ab dem er gilt; gebucht wird der Satz, der
am Tag des Verkaufs in der Zeit der Apotheke gilt.

| Land        | Arzneimittel | Lebensmittel (etwa Nahrungsergänzung) | Sonstiges (etwa Pflaster) |
| ----------- | ------------ | ------------------------------------- | ------------------------- |
| Deutschland | 19 %         | 7 %                                   | 19 %                      |
| Schweiz     | 2,6 %        | 2,6 %                                 | 8,1 %                     |

- Deutschland: Regelsatz 19 % (§ 12 Abs. 1 UStG); 7 % nur für Gegenstände aus Anlage 2
  (§ 12 Abs. 2 Nr. 1 UStG), etwa Lebensmittel. Arzneimittel stehen nicht darin. Eine Senkung für
  Arzneimittel wird seit Jahren gefordert; beschlossen war sie bei der Recherche am 27.10.2026
  nicht. Vor einem echten Einsatz gehört der Stand erneut geprüft. Die Senkung für Speisen in der
  Gastronomie ab 1.1.2026 betrifft Apotheken nicht.
- Schweiz: Sätze seit 1.1.2024, Medikamente zum reduzierten Satz (Art. 49 MWSTV); Quelle:
  Eidgenössische Steuerverwaltung, «Aktuell geltende Mehrwertsteuersätze». Eine weitere Erhöhung
  zugunsten der AHV ist laut Recherche frühestens für 2028 im Gespräch.
- Österreich ist als Land zugelassen, hat aber keine Sätze: Arzneimittel tragen dort 10 %; für
  Grundnahrungsmittel nennen Ratgeber einen neuen, tieferen Satz ab Juli 2026, geprüft ist das
  nicht. Eine Apotheke in Österreich bucht darum nicht (WK007), statt mit einem geratenen Satz.

Die Steuer je Satz rechnet der Beleg aus dem Bruttobetrag: Brutto × Satz / (100 + Satz),
kaufmännisch gerundet; bei einem Storno spiegelbildlich. Der Tagesabschluss summiert die Steuer
der Belege, so wie sie auf den Belegen steht.

## Was einer echten Kasse in Deutschland fehlen würde

- **Technische Sicherheitseinrichtung (TSE).** Elektronische Kassen müssen jede Buchung über ein
  zertifiziertes Sicherheitsmodul signieren (§ 146a AO, Kassensicherungsverordnung). Ein Beleg
  nennt dann nach § 6 KassenSichV unter anderem die Seriennummern von Kasse und
  Sicherheitsmodul, den Signaturzähler und den Prüfwert, auf Wunsch als QR-Code nach DSFinV-K.
  Die Werkbank hat keine TSE; jeder Beleg sagt das ausdrücklich.
- **Anschrift und Vorgangszeiten.** Ein echter Beleg trägt die volle Anschrift des Unternehmens
  sowie Beginn und Ende des Vorgangs; die Werkbank kennt nur den Namen und einen Zeitpunkt.
- **Abrechnung mit der Krankenkasse.** Bei einem Kassenrezept zahlt die Krankenkasse, die
  Patientin oder der Patient nur die Zuzahlung. Die Werkbank bucht jeden Artikel zum vollen
  Preis.
- **Kassenbuch und Export.** Ein echtes System führt Kassenbestand, Ein- und Auszahlungen und
  einen Export für die Prüfung (DSFinV-K). Der Tagesabschluss der Werkbank ist nur die Summe.

## Unveränderlich

Gebuchte Belege und Abschlüsse lassen sich nicht ändern oder löschen, auch nicht über die
REST-Schnittstelle mit dem eigenen Token: Die Rechte dafür fehlen, und neue Positionen nimmt die
Datenbank nur in derselben Anfrage wie den Kopf an. Belegnummern laufen je Apotheke lückenlos;
ein abgebrochener Verkauf rollt die Nummer mit zurück. Die Gründe stehen in E22.

## Bestellen beim Grosshändler

- «Verfügbarkeit prüfen» ist unverbindlich; «Verbindlich bestellen» sendet die Mengen als
  Bestellung mit der Liefervorgabe «MaxVerbund» (E25).
- Die Bestellung steht vor dem Senden in der Datenbank. Bricht die Verbindung ab, heisst sie
  «unklar», und die Statusabfrage beim Grosshändler klärt, ob sie angekommen ist – nie ein
  zweites Senden mit neuer ID. Die Abfrage gibt es erst eine Minute nach dem Abbruch: Vorher
  verarbeitet der Grosshändler die Bestellung vielleicht noch (E25).
- Höchstens 60 Aufrufe beim Grosshändler je Minute und Apotheke (E23): Ein Skript in einer
  Schleife soll nicht dazu führen, dass der Grosshändler den Zugang sperrt. Die Vertragsdaten
  (Bestellfenster, Touren) fragt die Seite je Zugang höchstens alle fünf Minuten ab.

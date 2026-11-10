# Gutscheine Basel-Landschaft

Das Gutscheinbuch **Basel-Landschaft (Liestal & Oberes Baselbiet 2027)** als vollständige, eigenständig funktionierende Offline-Website.

## Website öffnen

**[Vollständige index.html herunterladen](https://github.com/Bektoud/2f1/raw/refs/heads/main/index.html)** und im Browser öffnen. Ein Doppelklick auf die lokal gespeicherte Datei genügt.

Die Website benötigt nur diese eine Datei: HTML, CSS, JavaScript, alle 128 Angebote und alle 381 unterschiedlichen, passend zugeordneten Bildinhalte sind darin eingebettet. Auch Merkliste und Textexport funktionieren offline.

**Dateigrösse: 32’858’066 Bytes = 32,86 MB = 31,34 MiB.** Die schonende Bildqualität mit ungefähr 33 MB wurde ausdrücklich gewählt.

## Funktionen

- 128 Gutschein-Tickets, gegliedert in fünf farblich unterschiedene Kategorien.
- Kombinierbare Kategorie-, Deal- und Merkliste-Filter, freie Suche und Live-Trefferzahl.
- Sieben grössere Highlights mit Ortsangabe, Leistung, Einlösebedingungen und Gültigkeit. Horizontal scrollbar, mit Pfeilknöpfen und Direktwahl; auf der Tastatur mit Pfeiltasten, Pos1 und Ende bedienbar.
- Vorder-/Rückseiten im Detailfenster, vollständiges Einpassen in einen stabilen Bildbereich und Vergrösserung auf die volle eingebettete Auflösung.
- Vor-/Zurückblättern im Detailfenster mit Knöpfen oder Pfeiltasten, einschliesslich Ringnavigation. Die Reihenfolge entspricht der beim Öffnen gewählten Liste; Highlights öffnen die Gesamtliste.
- Synchronisierte Herz-Knöpfe in Übersicht, Highlights und Detailfenster.
- Sitzungsbezogene Merkliste in `sessionStorage`, mit Arbeitsspeicher-Fallback bei blockiertem Speicher.
- Gruppierte Merkliste mit Einzelentfernung, bestätigtem Leeren und `.txt`-Download.
- UTF-8-Textexport mit BOM, Windows-Zeilenumbrüchen, Exportdatum und alphabetischer Sortierung innerhalb der Kategorien.
- Responsive Gestaltung, Geräte-Hell-/Dunkelmodus, reduzierte Bewegung, Tastaturbedienung, Fokusführung und Live-Ansagen.
- Keine externen Laufzeitbibliotheken, Schriftdateien, Bilder oder Netzwerkanfragen.

Die Angebotstexte behalten ihre Schreibweise. Auf den Übersichtskarten wird bei einfachen 2für1-/50-%-Deals das bereits separat gezeigte Präfix entfernt. Mischformen und Bedingungen wie «50 % ODER MAX. 100 CHF …» bleiben vollständig erhalten. Der Export verwendet immer die Originaltexte.

### Ausgewählte Angebote

Die Highlights zeigen sole uno (Nr. 126), FC Basel – 1. Mannschaft (45), aquabasilea (119), Seilpark Balmberg (61), Restaurant Seegarten (17), Kino Sputnik (53) und Metzgerei Zimmermann (103). Die ergänzenden Texte sind sachliche Zusammenfassungen der jeweiligen Gutschein-Rückseite; Ort, Einlösebedingungen und Gültigkeit wurden dort visuell abgeglichen. Die vollständige Rückseite lässt sich über das Angebot öffnen.

Die Auswahl und Zusatzangaben stehen in `src/highlights.json`. Die Karten wechseln alle fünf Sekunden zum nächsten Angebot und beginnen nach dem letzten wieder beim ersten. Sobald der Highlight-Bereich mit Maus, Touch, Scrollrad oder Tastatur bedient wird, endet das automatische Blättern bis zum Neuladen. Auch das Darüberfahren mit der Maus hält die Auswahl an; anschliessend lässt sie sich manuell durchblättern.

Ausserhalb des sichtbaren Bereichs, in einem inaktiven Tab und während geöffneter Dialogfenster pausiert die Automatik. Die Geräteeinstellung für reduzierte Bewegung deaktiviert sie. Automatische Wechsel lösen keine fortlaufenden Screenreader-Ansagen aus. Beim Ändern der Fensterbreite bleibt das ausgewählte Highlight sichtbar.

## Daten und Bilder

Die Kategorien sind aus den Randfarben der Originalkarten abgeleitet: orange, blau, grün, gelb und pink. Die Namen «Essen & Trinken», «Ausgang & Nachtleben», «Freizeit & Sport», «Einkaufen & Dienstleistungen» und «Wellness & Beauty» sind die Interpretation der Quelldatei.

Die Filter «2für1» und «50 % Rabatt» zählen jeweils nur die reine Angebotsart: 86 beziehungsweise 37 Angebote. Die fünf weiteren Angebote, darunter Kombinationen, 4für2 und 8für4, stehen unter «Weitere». Insgesamt sind 128 Angebote von 118 unterschiedlichen Firmen enthalten. Sämtliche Filterzahlen werden aus den Angebotsdaten berechnet.

Technische Angaben zur Datenquelle, Bildzuordnung und Dateigrösse werden hier dokumentiert. Einzelheiten zu einem Gutschein stehen auf seiner Rückseite. Die Merkliste wird nur für die jeweilige Tab-Sitzung gespeichert und lässt sich mit «Als Text exportieren» als Datei sichern.

### Bildzuordnung und bestätigte Lücken

Das hochgeladene ZIP enthält bereits benannte JPG-Dateien in 128 Angebots-ID-Ordnern sowie ein `manifest.json`:

```text
<Angebots-ID>/
  angebotsbild.jpg
  vorderseite.jpg
  rueckseite.jpg
manifest.json
```

Die Zuordnung erfolgt über Angebots-ID und Bildart im Manifest und wird gegen die JSON-Daten sowie den ID-Ordner geprüft. Die JPG-Erkennung erfolgt anhand der Bytes `FF D8 FF` und durch tatsächliches Dekodieren, unabhängig von der Dateiendung. Die ZIP-Reihenfolge wird nicht als Zuordnung verwendet.

**Ergebnis:** 382 gültige JPG-Dateien, keine unzugeordneten Bilder. Eine der Dateien ist eine falsche Doppelablage. Folgende Rückseiten erhalten nach ausdrücklicher Bestätigung eine Ersatzdarstellung:

| Nr. in der JSON | Firma / Angebot | Befund |
| --- | --- | --- |
| 70 | Tenniscenter Ergolz | Als Rückseite ist eine bytegleiche Kopie der Museum.BL-Vorderseite abgelegt. Der Bildinhalt ist bei Museum.BL korrekt eingebettet. |
| 71 | Tennisclub Sissach | Rückseite fehlt im ZIP und im Manifest. |
| 121 | Atelier ZwygArt GmbH – Haarschnitt | Rückseite fehlt im ZIP und im Manifest. |

Alle übrigen Bilder sind eingebettet: **128 Angebotsbilder, 128 Vorderseiten und 125 Rückseiten**. Alle 128 Angebote bleiben vollständig enthalten. Die beiden Original-Eingabedateien sind ebenfalls im Repository abgelegt.

### Bildqualität

| Bildart | Eingebettete Auflösung | WebP-Qualität |
| --- | --- | --- |
| Angebotsbild | 480 Pixel breit, Seitenverhältnis erhalten | 80 |
| Vorderseite | 1064 × 1500 Pixel | 84 |
| Rückseite | 1206 × 1700 Pixel, volle Originalauflösung | 88 |

Die eingebetteten Bilddateien enthalten jeweils den vollständigen Bildinhalt. Die Vorschaubilder füllen ihre Bildfläche ohne seitliche Leerstreifen. Im Detailfenster werden Vorder- und Rückseite vollständig eingepasst und lassen sich vergrössern. Die Binär-Bilddaten benötigen zusammen 24’527’354 Bytes; Base64 und der Anwendungscode ergeben die oben genannte HTML-Endgrösse. Die erste Kompression benötigt etwas Zeit; weitere Builds verwenden einen lokalen, ignorierten Bildcache.

Die Bilddaten stehen in der HTML-Datei getrennt vom Anwendungscode in `application/json`-Blöcken, jeweils mit `data-image-id="<Angebots-ID>"`. Erst beim Zugriff wird ein Block geparst. Angebotsbilder werden bei Annäherung an den sichtbaren Bereich geladen, Gutscheinseiten erst beim Öffnen der jeweiligen Ansicht dekodiert.

## Quellen und Wartung

| Datei | Zweck |
| --- | --- |
| `index.html` | Vollständige, direkt nutzbare Einzeldatei |
| `angebote_basel-landschaft.json` | Unveränderte Angebotsdaten |
| `basel-landschaft-gutscheine-2027-bilder.zip` | Unverändertes Bildarchiv mit Manifest |
| `src/seite.template.html` | Lesbare Vorlage mit HTML, CSS und JavaScript |
| `src/highlights.json` | Sieben Angebotsverweise mit sachlichen Zusatzangaben aus den Gutschein-Rückseiten |
| `tools/build.py` | Eingabeprüfung, Kompression und Einzeldatei-Build |
| `bildpruefung.json` | Maschinenlesbarer Bildbefund, Grössen und SHA-256 der Ausgabedatei |
| `tests/check_build.py` | Prüfung der tatsächlichen Ausgabedatei und aller eingebetteten Bilder |
| `tests/browser.cjs` | Offline-Browser-, Export- und Barrierefreiheitstests |
| `PRUEFBERICHT.md` | Ergebnisse der abschliessenden Prüfung |

Änderungen am Layout oder Verhalten in `src/seite.template.html` vornehmen und anschliessend neu bauen. Die Platzhalter werden vollständig ersetzt; die ausgelieferte `index.html` benötigt keine der Entwicklungsdateien.

### Neu bauen

Python mit Pillow wird nur für den Build benötigt:

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements-build.txt
.venv/bin/python tools/build.py --audit
.venv/bin/python tools/build.py
```

Der Build prüft alle Angebote, das Manifest, Magic Bytes, Abmessungen, Bildlücken und doppelte Bildinhalte. Er lädt keine Bilder aus dem Internet. Die falsche Ergolz-Rückseite ist als bestätigte Ausnahme dokumentiert. Bei einer anderen, uneindeutigen Archivstruktur muss die Zuordnung erneut geprüft werden.

### Tests ausführen

Node.js ab Version 22.12.0 und die folgenden Entwicklungsabhängigkeiten werden ausschliesslich zum Testen benötigt:

```sh
npm ci
npx playwright install chromium firefox
.venv/bin/python tests/check_build.py
npm run test:browser
```

Wenn Pillow bereits für `python3` verfügbar ist, führt `npm test` beide Prüfschritte aus. Mit `TEST_BROWSER=chromium` oder `TEST_BROWSER=firefox` lässt sich ein einzelner Browser auswählen. Berichte, Screenshots und die tatsächlich heruntergeladenen Textdateien landen standardmässig im ignorierten Ordner `test-results/`.

# PokéForest Web (iPhone & iPad)

Eine Web-App, die denselben Spielstand wie die Mac-App nutzt. Kein Build-Schritt: reine HTML/CSS/JS-Dateien.

## Was sie kann (wie die Mac-App)
- **Pokétch:** der Timer als Uhr aus Diamant/Perl, mit den Apps Fokus-Uhr, Schrittzähler, Pokémon-Liste, Freundschaftstest, Kalender und Analoguhr. Leertaste startet eine Runde, Tasten 1–5 wechseln die Seiten. Memo-App für Aufgaben, Pausen-Timer, Abbruch-Gründe. 2 EP pro Fokus-Minute.
- **Training:** eigenes Pokémon (Lv. 1–100, Entwicklungen, Mega) oder wilde Begegnung (#1–#1025, vier Seltenheiten), Ring-Timer 5–180 Min, Pomodoro-Ketten, Ewigstein-Pause, Beeren, Knursp, Fokus-Tags, Notizen, Vorlagen, Runden-Rückblick. Läuft weiter, wenn du die App schließt.
- **Safari:** 9 Sinnoh-Lebensräume im Stil der Diamant/Perl-Kampfhintergründe (PC-Pokémon mit passendem Typ ziehen ein und trainieren mit, täglich ein Massenauftreten), Pension Trostu mit Eiern, wandernde Legendäre (Selfe, Vesprit, Tobutz, Cresselia), Team & PC (Boxen, Sortieren, Suchen, Tauschen, EP-Teiler), Expeditionen, Statistik (Heute/Woche/Monat/Gesamt, 28-Tage-Karte, Fokus-Tags), Logbuch.
- **Untergrund:** pro 25 Fokus-Minuten eine Grabung mit Kugeln, Herzschuppen, Fossilien und 10 Entwicklungssteinen.
- **Typen:** Jagdgebiete mit Pokéradar-Ketten, Tageszeiten wie auf dem DS, Typ-Tagesquest, Raids und Arenen mit Original-Typtabelle, Konter-Vorschläge.
- **Trainer:** 8 Sinnoh-Arenen mit Top Vier und Champ Cynthia, Kampfzone mit Kampfturm und Kampfpunkte-Laden, Pokémon-Wettbewerb mit Konditionen und Bändern, Trainerpass als Bild, Wochen-Quests, 30 Orden, Raids, Tagesquests, Eier, Pension, Forschung mit Regionen, Wochen-Liga mit Rivalen, Pokédex, Profil und Profilbilder.
- **Shop:** Beerenbeete in Flori, Linien freischalten, Exemplare adoptieren, Beeren, Knursp-Bäckerei, Wunder-Tausch, Profilbild-Kapsel.
- **Mehr:** PokéRadio (ein Player, Senderliste, Atmosphäre-Kacheln), Tagesziel, Erscheinungsbild, strenger Modus, Fokus-Tags, Sync.
- **Für Einsteiger:** Tutorial mit Prof. Eibe beim ersten Start, Spielhilfe A–Z, „Neu in dieser Version“.
- **Neu in 5.9:** Aufgeräumte Seiten mit ⓘ-Erklärungen, „Heute“-Streifen, Trainer in vier Bereichen, Lebensräume als Raster, Chronik, Shop-Typfilter, Geheimbasis mit Einkaufsfenster.
- **Neu in 5.8:** Team Galaktik, Rivale Barry, Speersäule, Geheimbasis, Mitnahme, Box-Hintergründe, Sinnoh-Dex.
- Offline nutzbar nach dem ersten Öffnen. Unter Mehr › Einstellungen lassen sich alle 1025 DS-Sprites speichern.

Nur am Mac: Apps und Websites sperren (Fokus-Wächter), Mini-HUD, Menüleiste. In der Web-App ersetzt der strenge Modus den Fokus-Wächter: Wer die App länger als 15 Sekunden verlässt, beendet die Runde.

## Abgleich mit dem Mac
Beide Seiten nutzen `iCloud Drive › PokéForest › PokéForest_Sync.json`.
- Mac → iPhone: Mac „Einstellungen › iPhone & iPad › Jetzt sichern“, dann in der Web-App „Sync › Vom Mac laden“.
- iPhone → Mac: Web-App „Sync › Für den Mac sichern“ und die Datei in iCloud Drive › PokéForest ersetzen. Am Mac „Stand vom iPhone/iPad laden“.
- Am Mac kann „Nach jeder Runde automatisch nach iCloud Drive sichern“ eingeschaltet werden.

Es zählt der zuletzt geladene Stand. Nicht gleichzeitig auf beiden Geräten trainieren.

## Lokal testen
```bash
python3 scripts/dev_server.py
```
Dann http://localhost:8765 öffnen.

## Veröffentlichen
```bash
scripts/publish_web.sh "Was sich geändert hat"
```
Die App liegt dann unter https://28hugo.github.io/pokeforest/. Auf iPhone/iPad in Safari öffnen › Teilen › „Zum Home-Bildschirm“.

Neue Pokémon-Daten aus der Mac-App übernehmen: `scripts/export_web_catalog.sh`.

Sprites kommen von https://github.com/PokeAPI/sprites. Pokémon und zugehörige Namen/Grafiken gehören ihren Rechteinhabern; PokéForest ist ein inoffizielles Fanprojekt.

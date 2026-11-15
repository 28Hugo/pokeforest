# PokéForest Web (iPhone & iPad)

Eine Web-App, die denselben Spielstand wie die Mac-App nutzt. Kein Build-Schritt: reine HTML/CSS/JS-Dateien.

## Was sie kann
- Fokus-Training mit deinem Partner (Ring-Timer, 5–180 Min), läuft weiter, wenn du die App schließt
- Team & PC: Partner wählen, Team ⇄ PC, Tauschen, EP-Teiler
- Expeditionen starten, zurückrufen, abholen
- Pokémon des Tages (+50 % EP), Level-ups, Entwicklungs-Animation
- Safari-Wiese mit deinem Team
- Strenger Modus: Verlassen der App länger als 15 Sekunden beendet die Runde
- Offline nutzbar nach dem ersten Öffnen

Noch nicht in der Web-App: wilde Begegnungen, Shop, Raids, Orden, Radio.

## Abgleich mit dem Mac
Beide Seiten nutzen `iCloud Drive › PokéForest › PokéForest_Sync.json`.
- Mac → iPhone: Mac „Einstellungen › iPhone & iPad › Jetzt sichern“, dann in der Web-App „Sync › Vom Mac laden“.
- iPhone → Mac: Web-App „Sync › Für den Mac sichern“ und die Datei in iCloud Drive › PokéForest ersetzen. Am Mac „Stand vom iPhone/iPad laden“.
- Am Mac kann „Nach jeder Runde automatisch nach iCloud Drive sichern“ eingeschaltet werden.

Es zählt der zuletzt geladene Stand. Nicht gleichzeitig auf beiden Geräten trainieren.

## Lokal testen
```bash
python3 -m http.server 8765 --directory web
```
Dann http://localhost:8765 öffnen.

## Veröffentlichen (GitHub Pages, kostenlos)
1. Ein GitHub-Repository anlegen und den Inhalt des Ordners `web/` hochladen.
2. Repository › Settings › Pages › Branch `main`, Ordner `/ (root)`.
3. Die angezeigte Adresse auf iPhone/iPad in Safari öffnen › Teilen › „Zum Home-Bildschirm“.

Sprites kommen von https://github.com/PokeAPI/sprites. Pokémon und zugehörige Namen/Grafiken gehören ihren Rechteinhabern; PokéForest ist ein inoffizielles Fanprojekt.

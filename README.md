# 🦄 Vokabel-Einhorn

Ein kleines Browser-Spiel zum Lernen von Englisch-Vokabeln für die 5. Klasse.

Das Spiel läuft komplett im Browser (HTML, CSS, JavaScript) und benötigt keinen Server oder externe Dienste.

## 🎮 Spielprinzip

- Ein deutsches oder englisches Wort wird angezeigt.
- Es gibt **4 Antwortmöglichkeiten**.
- Du hast nur **wenige Sekunden Zeit**.
- Ein **Einhorn läuft über einen Regenbogen** und wird von einer Gewitterwolke verfolgt.
- Wenn die Zeit abläuft, holt die Wolke das Einhorn ein → **Game Over**.

## 🧠 Lernmodi

- **Deutsch → Englisch**
- **Englisch → Deutsch**
- **Zufall** (abwechselnd Deutsch und Englisch)

## ⭐ Features

- Startscreen mit Name und Schwierigkeitsgrad
- 4 Multiple-Choice Antworten
- Timer als grafische Animation (Einhorn + Wolke)
- Gewonnen-Screen nach 10 richtigen Antworten
- Fehler-Training für falsch beantwortete Wörter
- Lokale Highscore-Liste (im Browser gespeichert)

## 📂 Vokabeln

Die Vokabeln werden aus der Datei `vocab.txt` geladen.

Format:
english_word"TAB"german_word

Beispiel:
house"TAB"Haus
dog"TAB"Hund
cat"TAB"Katze
school"TAB"Schule

## 🚀 Spiel starten

### Lokal

Einfach `index.html` im Browser öffnen.

Wenn die Vokabeldatei nicht geladen wird, starte einen kleinen lokalen Server, z.B.:
python3 -m http.server

Dann im Browser öffnen: http://localhost:8000

### Online

Das Spiel kann direkt über **GitHub Pages** gespielt werden.

## 🛠 Technologie

- HTML
- CSS
- JavaScript (Vanilla)

Keine Frameworks oder externe Dienste.

## 👧 Zielgruppe

Das Spiel wurde als einfacher Vokabeltrainer für Schülerinnen und Schüler der **5. Klasse** entwickelt.

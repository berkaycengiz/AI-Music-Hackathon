# Bild → Musik → CHORDCAT

Ubuntu-Schnellstart für das Team. ZIP entpacken, den Ordner **chordcat-image-sonification** öffnen und dort ein Terminal öffnen (Rechtsklick → „Im Terminal öffnen“).

## Die drei Befehle

```bash
bash setup.sh
bash analyze.sh "examples/sample.png"
bash play.sh
```

1. **setup.sh** installiert die Python-Pakete einschließlich `python-rtmidi` in einer eigenen `.venv`. Dafür wird Internet benötigt. Falls Ubuntu meldet, dass `venv` fehlt: `sudo apt install python3-venv`, danach den ersten Befehl wiederholen.
2. **analyze.sh** erzeugt aus dem Bild 16 zusammengehörige Musiktakte. Ersetze `examples/sample.png` durch deinen Bildpfad, etwa `"/home/alex/Bilder/foto.jpg"`. Die Anführungszeichen sind bei Leerzeichen wichtig.
3. **play.sh** startet den XY-Player. CHORDCAT per USB anschließen, einschalten und in **Chord Cruiser** schalten. Beim ersten Start wird automatisch kalibriert: die Felder 0 bis 15 nach Aufforderung drücken und loslassen. Anschließend startet die Wiedergabe. Die Kalibrierung wird lokal gespeichert.

Das Beispiel funktioniert direkt nach dem Entpacken. Keine Pfade vom Rechner der Entwicklerin müssen angepasst werden. Benötigt werden Ubuntu, Python 3.10 oder neuer und für die Wiedergabe ein CHORDCAT mit hörbar eingerichtetem MIDI-Empfang.

## Was passiert beim Drücken?

Jedes Feld startet den entsprechenden Takt mit Melodie und Akkordbegleitung. Ein neuer Druck unterbricht das vorherige Motiv und beendet dessen gehaltene Noten. **Strg+C** stoppt den Player. Das Gerät bzw. ein angeschlossener Synthesizer erzeugt den Klang; das Skript selbst rendert kein Audio.

Die Noten werden standardmäßig auf MIDI-Kanal 1 ausgegeben. Für einen anderen Empfängerkanal: `bash play.sh --output-channel 3`. Bei mehreren Geräten lassen sich `--port "Eingangsname" --output-port "Ausgangsname"` ergänzen. Eine Liste liefert `.venv/bin/python chordcat_xy_player.py --list`.

## Ein anderes Bild

Den Player mit Strg+C stoppen. Nur Befehl 2 mit dem neuen Bildpfad und anschließend Befehl 3 wiederholen. Die Installation und die vorhandene Kalibrierung müssen nicht wiederholt werden.

Die aktuellen Ergebnisse liegen unter:

- `results/musik.mid`: 16 Takte in Reihenfolge der Felder 0–15.
- `results/analysis.json`: Bildmerkmale und musikalische Daten.
- `results/raster.png`: Originalbild, beschriftetes Raster und Farbpaletten.

Befehl 2 ersetzt diese drei Ergebnisdateien. Wer Ergebnisse behalten möchte, kopiert sie vorher in einen anderen Ordner. Das Raster öffnet sich mit `xdg-open results/raster.png`.

Jedes Team kalibriert sein eigenes Gerät. Eine fremde Kalibrierung wird deshalb nicht mitgeliefert. Bei geänderter Pad-Belegung kann die Kalibrierung mit `.venv/bin/python chordcat_xy_player.py --calibrate` wiederholt werden.

## Code und Prüfung

`sonification/` trennt Bildmerkmale und musikalische Regeln. `main.py` erstellt die Ergebnisse. `chordcat_xy_player.py` lädt die erzeugte MIDI und steuert die Wiedergabe. Details zur Bildanalyse, den Regeln und der Python-API stehen in `docs/SONIFICATION.md`.

Automatisierte Analyse- und MIDI-Tests: `.venv/bin/python -m unittest discover -s tests -v`.

Eine MIDI-Datei ohne Hardware prüfen: `.venv/bin/python chordcat_xy_player.py --midi results/musik.mid --check-midi`.

Die Python-Umgebung ist nicht in der ZIP enthalten und wird auf jedem Rechner neu installiert. Die Installation nutzt kompatible Versionsbereiche; für exakt reproduzierbare spätere Experimente sollten die Teams dieselben Paketversionen verwenden. Der XY-Player wurde zusätzlich mit neun automatisierten Tests zu Tempo, Taktgrenzen, Abbruch, Retrigger und Notenfreigabe geprüft. Diese Repository-spezifischen Tests sind hier nicht enthalten. Ein Hardwaretest auf den Rechnern der Teammitglieder steht aus.

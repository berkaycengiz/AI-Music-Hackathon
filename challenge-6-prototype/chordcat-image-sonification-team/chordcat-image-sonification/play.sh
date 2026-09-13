#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
if [[ ! -x .venv/bin/python ]]; then
  echo 'Bitte zuerst bash setup.sh ausführen.' >&2
  exit 1
fi
if [[ ! -f results/musik.mid ]]; then
  echo 'Bitte zuerst bash analyze.sh "/pfad/zum/bild.jpg" ausführen.' >&2
  exit 1
fi
# Validate the music before asking the user to interact with the device.
.venv/bin/python chordcat_xy_player.py --midi results/musik.mid --check-midi
if [[ ! -f chordcat_xy_mapping.json ]]; then
  echo 'Erster Start: CHORDCAT in Chord Cruiser schalten und die 16 Felder kalibrieren.'
  .venv/bin/python chordcat_xy_player.py --calibrate "$@"
  if [[ ! -f chordcat_xy_mapping.json ]]; then
    echo 'Kalibrierung nicht abgeschlossen; Wiedergabe wurde nicht gestartet.' >&2
    exit 1
  fi
fi
exec .venv/bin/python chordcat_xy_player.py --midi results/musik.mid "$@"

#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ $# -ne 1 ]]; then
  echo 'Aufruf: bash analyze.sh "/pfad/zum/bild.jpg"' >&2
  exit 2
fi
# Resolve the image relative to the caller before changing to the project folder.
image_file="$(realpath -- "$1")"
cd -- "$project_dir"
if [[ ! -x .venv/bin/python ]]; then
  echo 'Bitte zuerst bash setup.sh ausführen.' >&2
  exit 1
fi
.venv/bin/python main.py "$image_file" --json results/analysis.json --midi results/musik.mid --debug results/raster.png
printf '\nErstellt: results/analysis.json, results/musik.mid, results/raster.png\nWeiter: bash play.sh\n'

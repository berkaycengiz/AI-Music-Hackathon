#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
if ! command -v python3 >/dev/null; then
  echo 'Python 3 fehlt. Unter Ubuntu: sudo apt install python3 python3-venv' >&2
  exit 1
fi
if [[ ! -x .venv/bin/python ]]; then
  if ! python3 -m venv .venv; then
    echo 'Falls venv fehlt: sudo apt install python3-venv; danach bash setup.sh wiederholen.' >&2
    exit 1
  fi
fi
.venv/bin/python -m pip install --timeout 120 --retries 10 -r requirements.txt
printf '\nInstallation fertig. Weiter: bash analyze.sh "examples/sample.png"\n'

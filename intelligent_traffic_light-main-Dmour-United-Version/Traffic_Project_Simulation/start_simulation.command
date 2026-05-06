#!/bin/zsh
# Wadi Saqra Live Digital Twin — one-click launcher (macOS / Linux)

cd "$(dirname "$0")"

# Activate venv if present, otherwise fall back to system Python
VENV_PYTHON=""
for candidate in ".venv/bin/python3" "../.venv/bin/python3"; do
  if [ -f "$candidate" ]; then
    VENV_PYTHON="$candidate"
    break
  fi
done

if [ -n "$VENV_PYTHON" ]; then
  echo "Using virtualenv: $VENV_PYTHON"
  "$VENV_PYTHON" scripts/start_live_simulation.py --open
else
  echo "No virtualenv found — using system Python."
  echo "Run: pip3 install -r requirements-live.txt  if dependencies are missing."
  python3 scripts/start_live_simulation.py --open
fi

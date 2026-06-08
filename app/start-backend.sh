#!/usr/bin/env bash
# Start the backend dev server
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Use the venv created in home dir (workaround for colon in path)
PYTHON="${PYTHON:-$HOME/vishwakarma-venv/bin/python3}"

if [ ! -f "$SCRIPT_DIR/backend/.env" ]; then
  echo "⚠  No .env found. Copying .env.example..."
  cp "$SCRIPT_DIR/backend/.env.example" "$SCRIPT_DIR/backend/.env"
  echo "Edit app/backend/.env and set ANTHROPIC_API_KEY, then re-run."
  exit 1
fi

echo "Starting FastAPI backend on http://localhost:9000 ..."
cd "$SCRIPT_DIR/backend"
"$PYTHON" -m uvicorn main:app --reload --host 0.0.0.0 --port 9000

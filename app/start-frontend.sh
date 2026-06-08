#!/usr/bin/env bash
# Start the frontend dev server
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "Starting Vite frontend on http://localhost:5173 ..."
cd "$SCRIPT_DIR/frontend"
./node_modules/.bin/vite

#!/usr/bin/env bash
# ============================================================
#  Vishwakarma AI — Replit Startup Script
#  Runs on every "Run" press in Replit.
#  1. Installs Python backend deps (cached after first run)
#  2. Builds the React frontend into app/frontend/dist/
#  3. Starts FastAPI on port 8000 (serves API + static frontend)
# ============================================================
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/app/backend"
FRONTEND_DIR="$ROOT_DIR/app/frontend"
DIST_DIR="$FRONTEND_DIR/dist"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║       VISHWAKARMA AI — Replit Startup        ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── 1. Validate required secrets ─────────────────────────────
echo "🔑 Checking required environment variables..."

if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo ""
  echo "❌ ANTHROPIC_API_KEY is not set!"
  echo "   → Go to Replit sidebar: Tools → Secrets"
  echo "   → Add key: ANTHROPIC_API_KEY"
  echo "   → Value: your sk-ant-... key from https://console.anthropic.com/"
  echo ""
  exit 1
fi

if [ -z "$MONGODB_URL" ]; then
  echo ""
  echo "❌ MONGODB_URL is not set!"
  echo "   → Go to Replit sidebar: Tools → Secrets"
  echo "   → Add key: MONGODB_URL"
  echo "   → Value: your MongoDB Atlas connection string"
  echo "   → Free Atlas cluster: https://www.mongodb.com/atlas"
  echo ""
  exit 1
fi

echo "   ✅ ANTHROPIC_API_KEY is set"
echo "   ✅ MONGODB_URL is set"
echo ""

# ── 2. Install Python backend dependencies ────────────────────
echo "📦 Installing Python backend dependencies..."
cd "$BACKEND_DIR"
pip install -e . --quiet --no-warn-script-location
echo "   ✅ Python dependencies installed"
echo ""

# ── 3. Build the React frontend ───────────────────────────────
if [ ! -d "$DIST_DIR" ] || [ "$FORCE_REBUILD" = "1" ]; then
  echo "🏗️  Building React frontend (first-time build, ~60 seconds)..."
  cd "$FRONTEND_DIR"
  npm install --silent
  npm run build
  echo "   ✅ Frontend built → app/frontend/dist/"
else
  echo "⚡ Frontend already built — skipping (set FORCE_REBUILD=1 to force)"
fi
echo ""

# ── 4. Write backend .env from Replit Secrets ─────────────────
echo "⚙️  Writing backend configuration..."
cat > "$BACKEND_DIR/.env" <<EOF
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
MONGODB_URL=${MONGODB_URL}
MONGODB_DB_NAME=${MONGODB_DB_NAME:-vishwakarma}
JWT_SECRET_KEY=${JWT_SECRET_KEY:-$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")}
CORS_ORIGINS=["*"]
DATA_DIR=./data
LOG_LEVEL=${LOG_LEVEL:-INFO}
EOF
echo "   ✅ .env written"
echo ""

# ── 5. Start FastAPI (API + serves static frontend) ───────────
echo "🚀 Starting Vishwakarma AI server on port 8000..."
echo "   API docs  → /docs"
echo "   Health    → /healthz"
echo "   App       → / (React frontend)"
echo ""
cd "$BACKEND_DIR"
exec uvicorn main:app --host 0.0.0.0 --port 8000

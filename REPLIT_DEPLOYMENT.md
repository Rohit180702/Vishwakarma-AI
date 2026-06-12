# 🚀 Deploying Vishwakarma on Replit

A complete step-by-step guide to running Vishwakarma AI on Replit — from your GitHub repo to a live public URL.

---

## Architecture on Replit

On Replit, the app runs as a **single unified server** on port 8000:

```
Browser → https://<your-repl>.replit.app
              │
              ▼
    FastAPI (port 8000)
    ├── /api/v1/*    → Python API routes
    ├── /docs        → Swagger UI
    ├── /healthz     → Health check
    └── /*           → React SPA (built static files)
```

**Key differences from local dev:**
| Local Dev | Replit |
|---|---|
| Vite dev server (port 5173) + FastAPI (port 9000) | Single FastAPI server (port 8000) |
| Docker MongoDB (port 27018) | MongoDB Atlas (cloud, free tier) |
| `.env` file | Replit Secrets |

---

## Prerequisites

Before starting, get these ready:

1. **Anthropic API Key** → https://console.anthropic.com/
2. **MongoDB Atlas account** (free) → https://www.mongodb.com/atlas
3. **GitHub repo** → `https://github.com/twlabs/GlobalHack-Vishwakarma-AI`
4. **Replit account** → https://replit.com

---

## Step 1 — Set Up MongoDB Atlas (Free Cloud Database)

Replit does not support Docker, so we use MongoDB Atlas's free M0 cluster instead.

### 1.1 Create a free cluster

1. Go to https://www.mongodb.com/atlas and sign in / sign up
2. Click **"Build a Database"**
3. Choose **M0 Free** tier (512 MB, free forever)
4. Select any cloud provider and region closest to you
5. Name your cluster `vishwakarma` (or any name)
6. Click **"Create Deployment"**

### 1.2 Create a database user

1. In the setup wizard, create a **Database User**:
   - Username: `vishwakarma`
   - Password: click **"Autogenerate Secure Password"** → copy and save it
2. Click **"Create Database User"**

### 1.3 Allow network access from Replit

1. Click **"Add My Current IP"** (or use `0.0.0.0/0` to allow all IPs)
   > ⚠️ For production use, restrict to specific IPs. For Replit demos, `0.0.0.0/0` is easiest since Replit IPs are dynamic.
2. Click **"Finish and Close"**

### 1.4 Get your connection string

1. On the Atlas dashboard, click **"Connect"** on your cluster
2. Choose **"Drivers"**
3. Copy the connection string — it looks like:
   ```
   mongodb+srv://vishwakarma:<password>@vishwakarma.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
4. Replace `<password>` with the password you saved in step 1.2
5. **Save this full string** — you'll need it in Step 3

---

## Step 2 — Import the GitHub Repo into Replit

### 2.1 Create the Repl from GitHub

1. Go to https://replit.com and sign in
2. Click **"+ Create Repl"**
3. Select **"Import from GitHub"**
4. Paste your GitHub repo URL:
   ```
   https://github.com/twlabs/GlobalHack-Vishwakarma-AI
   ```
   > If the repo is private, you'll need to connect your GitHub account to Replit first (Settings → Connected Services → GitHub)
5. Replit will detect the language — if prompted, choose **Bash** or **Python**
6. Click **"Import from GitHub"**

Replit will clone your repo. This takes 30–60 seconds.

---

## Step 3 — Configure Secrets (Environment Variables)

**Never put API keys or passwords in code.** Replit's Secrets are the equivalent of `.env` files — they are encrypted and not visible in your code.

### 3.1 Open the Secrets panel

In your Repl, look at the left sidebar and click **"Tools"** → **"Secrets"**
(Or press the 🔒 padlock icon)

### 3.2 Add required secrets

Add each of these key/value pairs by clicking **"+ New Secret"**:

#### Required

| Key | Value | Notes |
|-----|-------|-------|
| `ANTHROPIC_API_KEY` | `sk-ant-api03-xxxxx` | From https://console.anthropic.com/ |
| `MONGODB_URL` | `mongodb+srv://vishwakarma:PASSWORD@...` | Full Atlas connection string from Step 1.4 |

#### Recommended (secure your deployment)

| Key | Value | Notes |
|-----|-------|-------|
| `JWT_SECRET_KEY` | `<random 32-char string>` | Generate with: `python3 -c "import secrets; print(secrets.token_urlsafe(32))"` |
| `MONGODB_DB_NAME` | `vishwakarma` | Can keep as-is |

> If you skip `JWT_SECRET_KEY`, the startup script auto-generates one — but it changes on every restart, logging all users out.

---

## Step 4 — Run the Application

Click the green **▶ Run** button at the top of the Replit editor.

The `start-replit.sh` script will:

```
Step 1 → Validate secrets (exits with clear error if missing)
Step 2 → pip install -e . (installs all Python dependencies)
Step 3 → npm install + npm run build (builds React → dist/)
Step 4 → Write .env from Replit secrets
Step 5 → uvicorn main:app --host 0.0.0.0 --port 8000
```

> **⏱️ First run takes 5–15 minutes** because it:
> - Installs Python packages including `docling` (heavy ML library for PDF parsing)
> - Installs all Node.js packages
> - Compiles TypeScript and bundles the React app
>
> **Subsequent runs are faster** — the frontend build is cached (skipped unless you set `FORCE_REBUILD=1`)

### What success looks like in the console

```
╔══════════════════════════════════════════════╗
║       VISHWAKARMA AI — Replit Startup        ║
╚══════════════════════════════════════════════╝

🔑 Checking required environment variables...
   ✅ ANTHROPIC_API_KEY is set
   ✅ MONGODB_URL is set

📦 Installing Python backend dependencies...
   ✅ Python dependencies installed

🏗️  Building React frontend (first-time build, ~60 seconds)...
   ✅ Frontend built → app/frontend/dist/

⚙️  Writing backend configuration...
   ✅ .env written

🚀 Starting Vishwakarma AI server on port 8000...
   API docs  → /docs
   Health    → /healthz
   App       → / (React frontend)

INFO:     Started server process
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

---

## Step 5 — Access Your Live App

Once the server is running, Replit shows a **preview pane** on the right side with your app URL.

Your app is live at:
```
https://<your-repl-name>.<your-username>.replit.app
```

| URL | What it opens |
|-----|---------------|
| `https://your-repl.replit.app/` | Vishwakarma AI application |
| `https://your-repl.replit.app/docs` | FastAPI Swagger UI (API explorer) |
| `https://your-repl.replit.app/healthz` | Health check → `{"status":"ok"}` |

---

## Step 6 — Register and Use the App

1. Open the Replit URL in your browser
2. Click **"Register"**
3. Enter your name, email, password, and choose a role:
   - **Author** — creates and generates HLDs
   - **Reviewer** — reviews and approves submitted HLDs
4. Upload a requirements document (PDF, DOCX, TXT, or MD)
5. Go through the AI interview and generate your first ERD!

---

## Replit Deployment (Always-On)

By default, free Replit repls **sleep after inactivity**. To keep Vishwakarma always on:

### Option A: Replit Core (paid)
Enable **"Always On"** in your Repl's settings.

### Option B: Deploy to Replit Cloud (recommended for demos)

1. Click **"Deploy"** button (top right, rocket icon 🚀)
2. Choose **"Autoscale"** deployment
3. Click **"Deploy"** — Replit builds and hosts a production copy
4. Your production URL is permanent:
   ```
   https://<repl-name>.<username>.replit.app
   ```

> ⚠️ Replit Deployments use the `[deployment]` section of `.replit` automatically.

---

## Troubleshooting

### ❌ `ANTHROPIC_API_KEY is not set`
→ Go to **Tools → Secrets** and add the key. Secrets are NOT automatically loaded until you restart.

### ❌ `MONGODB_URL is not set`
→ Same as above — add it to Secrets.

### ❌ `pymongo.errors.ServerSelectionTimeoutError`
MongoDB Atlas is unreachable. Check:
1. Your connection string is correct (password replaced, not literal `<password>`)
2. In Atlas → Network Access → you have `0.0.0.0/0` allowed
3. The Atlas cluster is running (not paused — free clusters pause after 60 days of inactivity)

**To resume a paused Atlas cluster:**
- Go to Atlas dashboard → your cluster → click **"Resume"**

### ❌ `pip install` takes too long / times out
The `docling` library (PDF/DOCX parser) pulls in heavy ML dependencies (~1 GB).
- Be patient on first run — it can take 10–15 minutes
- Subsequent runs use Replit's package cache and are instant

### ❌ Frontend shows blank page or 404
The React frontend wasn't built. Force a rebuild:
1. In Replit Secrets, add `FORCE_REBUILD` = `1`
2. Press **Run**
3. After a successful build, delete the `FORCE_REBUILD` secret

### ❌ `ModuleNotFoundError` on startup
Dependencies weren't installed. In the Replit Shell, run:
```bash
cd app/backend && pip install -e .
```

### ❌ JWT errors / users randomly logged out
Set a **permanent** `JWT_SECRET_KEY` in Secrets (see Step 3). Without it, a new random key is generated on every restart.

### ❌ CORS errors in the browser console
Since FastAPI serves both the frontend and API from the same origin on Replit, CORS is not needed. The startup script sets `CORS_ORIGINS=["*"]` automatically. If you still see CORS errors, verify the `.env` in `app/backend/` was written correctly:
```bash
cat app/backend/.env
```

---

## Updating the App After Code Changes

When you push new code to GitHub:

1. In your Replit Shell, pull the latest changes:
   ```bash
   git pull origin main
   ```
2. If frontend code changed, force a rebuild:
   - Add `FORCE_REBUILD=1` to Secrets temporarily
3. Press **Run** again

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | ✅ Yes | — | Claude API key |
| `MONGODB_URL` | ✅ Yes | — | MongoDB Atlas connection string |
| `MONGODB_DB_NAME` | No | `vishwakarma` | MongoDB database name |
| `JWT_SECRET_KEY` | Recommended | auto-generated | Secret for JWT signing |
| `CORS_ORIGINS` | No | `["*"]` | Allowed CORS origins |
| `DATA_DIR` | No | `./data` | Directory for session files |
| `LOG_LEVEL` | No | `INFO` | Logging level |
| `FORCE_REBUILD` | No | — | Set to `1` to force frontend rebuild |

---

## Files Added for Replit

These files were added to the repo specifically for Replit deployment:

| File | Purpose |
|------|---------|
| `.replit` | Tells Replit which command to run and which port to expose |
| `replit.nix` | Declares system-level dependencies (Python 3.11, Node 20) |
| `start-replit.sh` | Startup script: validates secrets → builds frontend → starts backend |

These changes were also made to existing files:

| File | Change |
|------|--------|
| `app/backend/main.py` | Added static file serving — FastAPI now serves the built React app |
| `app/backend/pyproject.toml` | Added `aiofiles` dependency (required by FastAPI's `StaticFiles`) |

---

## Local Dev Is Unchanged

The Replit changes are fully backward-compatible with local development:

```bash
# Local dev still works exactly as before
docker compose up -d                        # MongoDB
cd app/backend && ./start-backend.sh        # FastAPI on :9000
cd app/frontend && npm run dev              # Vite on :5173
```

The static file serving in `main.py` only activates when `app/frontend/dist/` exists.
In local dev, that directory doesn't exist (you use Vite's dev server instead), so there's no conflict.

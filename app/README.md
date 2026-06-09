# Vishwakarma AI

Turns product specifications into reviewed High-Level Design documents — with C4 diagrams, ADRs, and a live architecture chat sidekick.

---

## Flow

```
Upload spec  →  Interview  →  Pick template  →  Generate HLD
    /               /interview      /format           /generate
```

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, React Router |
| Backend | Python 3.11, FastAPI, Pydantic v2, Uvicorn |
| LLM | Anthropic Claude (streaming SSE) |
| Database | MongoDB (session metadata) |
| File storage | Local disk — `backend/data/sessions/{id}/` |

---

## Prerequisites

- Python 3.11+
- Node 18+
- Docker (for MongoDB)
- An [Anthropic API key](https://console.anthropic.com/)

---

## Setup

### 1. Start MongoDB

```bash
# from the repo root (vishwakarma/)
docker compose up -d
```

This starts two containers:

| Container | Port | Purpose |
|---|---|---|
| `vishwakarma-mongo` | 27018 | MongoDB database |
| `vishwakarma-mongo-ui` | 8081 | Mongo Express browser UI |

Browse your data at **http://localhost:8081** (no login required).

---

### 2. Backend

```bash
cd app/backend

# One-time: create venv and install deps
python3 -m venv .venv
.venv/bin/pip install -e .

# Copy and fill in environment variables
cp .env.example .env
# Edit .env — set ANTHROPIC_API_KEY
```

`.env` values:

```env
ANTHROPIC_API_KEY=sk-ant-...          # required
MONGODB_URL=mongodb://localhost:27018  # matches docker-compose port
MONGODB_DB_NAME=vishwakarma
DATA_DIR=./data                        # session files stored here
```

Start the backend:

```bash
cd app   # (one level up from backend/)
./start-backend.sh
# → http://localhost:9000
# → http://localhost:9000/docs  (Swagger UI)
```

---

### 3. Frontend

```bash
cd app/frontend
npm install
npm run dev
# → http://localhost:5173
```

Vite proxies all `/api/*` requests to `http://localhost:9000` automatically.

---

## Project structure

```
vishwakarma/
├── docker-compose.yml          ← MongoDB + Mongo Express
└── app/
    ├── start-backend.sh
    ├── backend/
    │   ├── api/
    │   │   └── routes/         ← FastAPI route handlers
    │   ├── application/        ← use-case logic (interview, HLD gen, chat)
    │   ├── domain/             ← pure models + ports
    │   ├── infrastructure/     ← Anthropic LLM adapter, MongoDB models, file storage
    │   ├── prompts/            ← Claude prompt templates (Markdown)
    │   ├── data/
    │   │   └── sessions/
    │   │       └── {session_id}/
    │   │           ├── input.md        ← converted spec
    │   │           ├── answers.json    ← interview Q&A
    │   │           └── hld.json        ← generated HLD
    │   ├── config.py
    │   ├── main.py
    │   ├── pyproject.toml
    │   └── .env.example
    └── frontend/
        └── src/
            ├── api/            ← fetch client (all backend calls)
            ├── components/     ← AppHeader, FlowStepper, Button
            ├── features/
            │   ├── spec-upload/        ← upload page + session history
            │   ├── interview/          ← Q&A interview page
            │   ├── format-selection/   ← template picker + section editor
            │   └── hld-output/         ← document, ADR, chat panels
            ├── styles/         ← design tokens, global CSS
            └── types/          ← shared TypeScript interfaces
```

---

## API reference

```
POST /api/v1/specs/upload              multipart file upload → { session_id }
POST /api/v1/interview/start           { session_id } → question list
POST /api/v1/interview/submit          { session_id, answers } → saved
GET  /api/v1/hld/stream                SSE — generates HLD token by token
GET  /api/v1/sessions                  list past sessions
GET  /api/v1/sessions/{id}             full session detail
DELETE /api/v1/sessions/{id}           delete session
POST /api/v1/hld/chat/stream           { hld_json, history, message } → SSE
GET  /healthz                          → { status: "ok" }
GET  /docs                             Swagger UI
```

---

## Data storage

Vishwakarma uses a **hybrid** storage model:

| What | Where |
|---|---|
| Session metadata (ID, project name, template, timestamps) | MongoDB — `vishwakarma.hld_sessions` |
| Raw spec (`input.md`) | `data/sessions/{id}/input.md` |
| Interview answers (`answers.json`) | `data/sessions/{id}/answers.json` |
| Generated HLD (`hld.json`) | `data/sessions/{id}/hld.json` |

MongoDB is the index; the filesystem holds the content. This keeps the database lean and the actual artifacts inspectable on disk.

---

## Notes

- **Streaming**: HLD generation and chat both use SSE. The frontend reads token-by-token via `ReadableStream`.
- **Idempotent interview**: Hitting `/interview/start` twice for the same session returns cached questions — no duplicate LLM calls.
- **Session resume**: The upload page detects each session's furthest stage and resumes from there (Interview → Template → Generate).

# Vishwakarma AI — Real Application

Turns product specifications into reviewed High-Level Design documents with C4 diagrams and a live architecture sidekick.

## Screens

| Route | Screen | Purpose |
|---|---|---|
| `/` | Spec Upload | Drag/drop or paste spec, triggers quality analysis |
| `/format` | Format Selection | Pick HLD template (arc42, Org Standard, AWS WAF, ISO 42010) |
| `/generate` | HLD Output | Document tab + Architecture Diagram tab + Chat sidekick |

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, React Router, TanStack Query, React Flow |
| Backend | Python 3.11, FastAPI, Pydantic v2, Uvicorn |
| LLM | Anthropic Claude 3.5 Sonnet (direct SDK, streaming SSE) |

## Project structure

```
app/
├── backend/
│   ├── domain/          ← pure models + ports (no framework)
│   ├── application/     ← use cases (spec analysis, HLD generation, chat)
│   ├── infrastructure/  ← Anthropic LLM adapter
│   ├── api/             ← FastAPI routes, Pydantic request/response models
│   ├── config.py        ← pydantic-settings, loaded once at startup
│   └── main.py          ← FastAPI app factory
└── frontend/
    └── src/
        ├── api/         ← centralised fetch client
        ├── components/  ← Button, Card, Spinner
        ├── features/
        │   ├── spec-upload/
        │   ├── format-selection/
        │   └── hld-output/   ← HLDOutput, ChatPanel, DocumentPanel, DiagramPanel
        ├── styles/      ← tokens.css, global.css
        └── types/       ← shared TypeScript interfaces
```

## API endpoints

```
POST /api/v1/specs/analyze        multipart file OR JSON { spec_text }
POST /api/v1/specs/analyze/json   JSON { spec_text }
POST /api/v1/hld/generate         JSON { spec_text, template } → full HLDDocument
POST /api/v1/hld/generate/stream  same → SSE token stream
POST /api/v1/hld/chat             JSON { hld_json, history, message }
POST /api/v1/hld/chat/stream      same → SSE token stream
GET  /healthz                     → { status: "ok" }
GET  /docs                        → Swagger UI
```

## Getting started

### 1. Backend

```bash
# If you haven't created the venv yet (one-time)
python3 -m venv ~/vishwakarma-venv
~/vishwakarma-venv/bin/pip install fastapi "uvicorn[standard]" pydantic pydantic-settings anthropic python-multipart

# Set your API key
cp app/backend/.env.example app/backend/.env
# Edit .env: ANTHROPIC_API_KEY=sk-ant-...

# Start
./app/start-backend.sh
# or directly:
cd app/backend && ~/vishwakarma-venv/bin/python -m uvicorn main:app --reload
```

### 2. Frontend

```bash
cd app/frontend
npm install
npm run dev
# → http://localhost:5173
```

The Vite dev server proxies `/api/*` to `http://localhost:8000` automatically.

## Notes

- **Venv location**: Due to a colon (`:`) in the repo path, Python cannot create a venv inside `app/backend/`. Use `~/vishwakarma-venv` or any path without colons.
- **Streaming**: Both HLD generation and chat use server-sent events (SSE). The frontend reads the stream token-by-token via `ReadableStream`.
- **No database**: All state is stateless per session. The full `HLDDocument` is sent back with every chat request.

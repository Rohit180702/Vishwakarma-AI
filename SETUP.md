# 🛠️ Vishwakarma AI - Setup Guide

Complete installation and configuration guide for Vishwakarma AI.

---

## 📋 Prerequisites

Before you begin, ensure you have:

- **Python 3.11+** - [Download](https://www.python.org/downloads/)
- **Node.js 18+** - [Download](https://nodejs.org/)
- **Docker** - [Download](https://www.docker.com/get-started)
- **Anthropic API Key** - [Get yours](https://console.anthropic.com/)

### Verify Installation

```bash
python --version    # Should be 3.11+
node --version      # Should be 18+
docker --version    # Any recent version
```

---

## 🚀 Installation Steps

### Step 1: Clone the Repository

```bash
git clone https://github.com/rohit18-tw/vishwakarma.git
cd vishwakarma
```

---

### Step 2: Start MongoDB

We use Docker Compose to run MongoDB and Mongo Express (web UI).

```bash
# From the repo root (vishwakarma/)
docker compose up -d
```

This starts two containers:

| Container | Port | Purpose |
|-----------|------|---------|
| `vishwakarma-mongo` | 27018 | MongoDB database |
| `vishwakarma-mongo-ui` | 8081 | Mongo Express browser UI |

**Verify MongoDB is running:**
```bash
docker ps
# You should see both containers running
```

**Access MongoDB UI:**
- Open http://localhost:8081 in your browser
- No login required
- You can browse collections and documents here

---

### Step 3: Backend Setup

#### Create Virtual Environment

```bash
cd app/backend

# Create virtual environment
python3 -m venv .venv

# Activate it
# On macOS/Linux:
source .venv/bin/activate
# On Windows:
.venv\Scripts\activate
```

#### Install Dependencies

```bash
# Install in editable mode
pip install -e .
```

This installs all dependencies from `pyproject.toml`:
- FastAPI, Uvicorn
- Anthropic SDK
- MongoDB drivers (motor, beanie)
- Document processing (docling)
- Authentication (JWT, bcrypt)
- And more...

#### Configure Environment Variables

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your favorite editor
nano .env  # or vim, code, etc.
```

**Required `.env` configuration:**

```env
# Required - Get from https://console.anthropic.com/
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# MongoDB connection (matches docker-compose.yml)
MONGODB_URL=mongodb://localhost:27018
MONGODB_DB_NAME=vishwakarma

# Data storage location
DATA_DIR=./data

# JWT secret (generate a random string)
JWT_SECRET_KEY=your-secret-key-here-change-this

# CORS origins (frontend URL)
CORS_ORIGINS=["http://localhost:5173"]
```

**Generate a secure JWT secret:**
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
# Copy the output to JWT_SECRET_KEY
```

#### Start Backend Server

```bash
# Go to app directory (one level up from backend/)
cd ..

# Start the server using the helper script
./start-backend.sh
```

The backend will start on **http://localhost:9000**

**Verify backend is running:**
- API: http://localhost:9000
- Health check: http://localhost:9000/healthz
- API docs: http://localhost:9000/docs (Swagger UI)

---

### Step 4: Frontend Setup

Open a **new terminal** (keep backend running).

```bash
cd app/frontend

# Install dependencies
npm install
```

#### Start Development Server

```bash
npm run dev
```

The frontend will start on **http://localhost:5173**

Vite automatically proxies all `/api/*` requests to the backend at `http://localhost:9000`.

---

## 🎉 Verify Installation

### 1. Open the Application

Open http://localhost:5173 in your browser.

### 2. Register a User

1. Click "Register" or "Get Started"
2. Choose role: **Author** or **Reviewer**
3. Enter name, email, password
4. Click "Register"

### 3. Create Your First HLD

**As Author:**
1. Upload a requirements document (PDF, DOCX, TXT, or MD)
2. Go through the AI interview (or skip it)
3. Choose a template
4. Watch AI generate your HLD!

**As Reviewer:**
1. Wait for an author to submit an HLD for review
2. See pending reviews in your dashboard
3. Add comments and approve/reject

---

## 📁 Project Structure

```
vishwakarma/
├── docker-compose.yml          # MongoDB + Mongo Express
├── .gitignore
├── LICENSE
├── README.md
├── SETUP.md                    # This file
└── app/
    ├── start-backend.sh        # Backend startup script
    ├── start-frontend.sh       # Frontend startup script
    ├── backend/
    │   ├── .env.example        # Environment template
    │   ├── .env                # Your config (gitignored)
    │   ├── config.py           # Configuration loader
    │   ├── main.py             # FastAPI app entry point
    │   ├── pyproject.toml      # Python dependencies
    │   ├── api/
    │   │   ├── __init__.py
    │   │   ├── deps.py         # FastAPI dependencies
    │   │   ├── middleware.py   # CORS, etc.
    │   │   └── routes/         # API endpoints
    │   │       ├── auth.py     # User auth (login, register)
    │   │       ├── users.py    # User management
    │   │       ├── specs.py    # Document upload
    │   │       ├── characteristics.py  # Quality attributes
    │   │       ├── interview.py        # AI interview
    │   │       ├── hld.py      # HLD generation
    │   │       ├── chat.py     # Architecture chat
    │   │       ├── reviews.py  # Review workflow
    │   │       └── sessions.py # Session management
    │   ├── application/        # Business logic
    │   │   ├── characteristics_service.py
    │   │   ├── interview_service.py
    │   │   ├── hld_generation.py
    │   │   ├── hld_chat.py
    │   │   └── impact_service.py
    │   ├── domain/             # Core models
    │   │   ├── models.py
    │   │   ├── constants.py
    │   │   └── ports.py
    │   ├── infrastructure/     # External adapters
    │   │   ├── llm/
    │   │   │   └── anthropic_llm.py
    │   │   ├── database.py     # MongoDB models
    │   │   ├── auth.py         # JWT auth
    │   │   ├── session_storage.py
    │   │   └── parser.py
    │   ├── prompts/            # AI prompt templates
    │   │   ├── characteristics/
    │   │   ├── interview/
    │   │   ├── hld/
    │   │   ├── chat/
    │   │   └── impact/
    │   └── data/
    │       └── sessions/
    │           └── {session_id}/
    │               ├── input.md        # Converted spec
    │               ├── answers.json    # Interview Q&A
    │               └── hld.json        # Generated HLD
    └── frontend/
        ├── package.json
        ├── vite.config.ts
        ├── tsconfig.json
        └── src/
            ├── main.tsx
            ├── App.tsx
            ├── api/
            │   └── client.ts           # Backend API calls
            ├── components/
            │   ├── AppHeader/
            │   ├── Button/
            │   ├── Card/
            │   ├── FlowStepper/
            │   ├── Spinner/
            │   ├── Toast/
            │   └── UserProfile/
            ├── contexts/
            │   └── AuthContext.tsx
            ├── features/
            │   ├── auth/               # Login/Register
            │   ├── spec-upload/        # Upload page
            │   ├── characteristics/    # Quality attributes
            │   ├── interview/          # AI interview
            │   ├── format-selection/   # Template picker
            │   ├── hld-output/         # Main HLD view
            │   └── dashboard/          # User dashboard
            ├── styles/
            │   ├── global.css
            │   └── tokens.css
            └── types/
                └── index.ts
```

---

## 🔧 Advanced Configuration

### Change Backend Port

Edit `app/start-backend.sh`:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000  # Change 9000 to 8000
```

Then update `app/frontend/vite.config.ts`:
```typescript
proxy: {
  '/api': {
    target: 'http://localhost:8000',  // Match backend port
    // ...
  }
}
```

### Change Frontend Port

Edit `app/frontend/package.json`:
```json
{
  "scripts": {
    "dev": "vite --port 3000"  // Change from default 5173
  }
}
```

### Use Different MongoDB

Edit `.env`:
```env
MONGODB_URL=mongodb://your-mongodb-host:27017
MONGODB_DB_NAME=your-database-name
```

### Custom Data Directory

Edit `.env`:
```env
DATA_DIR=/path/to/your/data/directory
```

---

## 🐛 Troubleshooting

### Backend won't start

**Error:** `ModuleNotFoundError: No module named 'fastapi'`

**Solution:** Install dependencies
```bash
cd app/backend
pip install -e .
```

---

**Error:** `anthropic.APIError: Invalid API key`

**Solution:** Check your `.env` file
```bash
# Make sure ANTHROPIC_API_KEY is set correctly
cat .env | grep ANTHROPIC_API_KEY
```

---

**Error:** `pymongo.errors.ServerSelectionTimeoutError`

**Solution:** MongoDB isn't running
```bash
# Check if containers are running
docker ps

# Restart MongoDB
docker compose down
docker compose up -d
```

---

### Frontend won't start

**Error:** `Cannot find module 'react'`

**Solution:** Install dependencies
```bash
cd app/frontend
npm install
```

---

**Error:** `EADDRINUSE: address already in use :::5173`

**Solution:** Port is already in use
```bash
# Option 1: Kill the process
lsof -ti:5173 | xargs kill -9

# Option 2: Use different port
npm run dev -- --port 3000
```

---

### API calls fail

**Error:** `Failed to fetch` or `Network Error`

**Solution:** Backend not running or wrong URL
```bash
# Check backend is running
curl http://localhost:9000/healthz

# Should return: {"status":"ok"}
```

---

### MongoDB UI not accessible

**Error:** Cannot access http://localhost:8081

**Solution:** Check container status
```bash
docker ps | grep mongo

# Restart if needed
docker compose restart vishwakarma-mongo-ui
```

---

## 📊 Database Management

### View Data

1. Open http://localhost:8081
2. Click `vishwakarma` database
3. Browse collections:
   - `users` - User accounts
   - `hld_sessions` - Session metadata
   - `review_requests` - Review submissions
   - `comments` - Review comments
   - `hld_versions` - HLD versions

### Backup Data

```bash
# Backup MongoDB
docker exec vishwakarma-mongo mongodump --out=/tmp/backup

# Copy from container
docker cp vishwakarma-mongo:/tmp/backup ./mongodb-backup

# Backup files
tar -czf data-backup.tar.gz app/backend/data/
```

### Reset Data

```bash
# WARNING: This deletes all data!

# Stop containers
docker compose down

# Remove volumes
docker volume rm vishwakarma_mongodb-data

# Remove session files
rm -rf app/backend/data/sessions/*

# Start fresh
docker compose up -d
```

---

## 🚀 Production Deployment

### Environment Variables

Set these in production:

```env
# Use production MongoDB
MONGODB_URL=mongodb://prod-host:27017

# Strong JWT secret
JWT_SECRET_KEY=<generate-strong-random-key>

# Production API key
ANTHROPIC_API_KEY=sk-ant-prod-xxxxx

# Production CORS
CORS_ORIGINS=["https://your-domain.com"]

# Secure data directory
DATA_DIR=/var/lib/vishwakarma/data
```

### Build Frontend

```bash
cd app/frontend
npm run build

# Outputs to dist/ folder
# Serve with nginx, Apache, or CDN
```

### Run Backend with Gunicorn

```bash
cd app/backend

# Install gunicorn
pip install gunicorn

# Run with workers
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:9000
```

---

## 📞 Support

- **GitHub Issues:** [Report bugs](https://github.com/rohit18-tw/vishwakarma/issues)
- **Discussions:** [Ask questions](https://github.com/rohit18-tw/vishwakarma/discussions)

---

## 🎯 Next Steps

After setup:
1. ✅ Register as Author
2. ✅ Upload a sample requirements document
3. ✅ Go through AI interview
4. ✅ Generate your first HLD
5. ✅ Explore features (chat, diagrams, presentation mode)
6. ✅ Register as Reviewer (different email)
7. ✅ Test review workflow

**Happy architecting!** 🏗️

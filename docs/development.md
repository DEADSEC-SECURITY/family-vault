---
layout: default
title: Development Setup
nav_order: 3
---

# Development Setup

Local development environment with VS Code debugging, Docker infrastructure, and hot reload.

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Python 3.13+](https://www.python.org/downloads/)
- [Node.js 22+](https://nodejs.org/)
- [VS Code](https://code.visualstudio.com/) with recommended extensions (prompted on first open)

## Quick Start

1. **Clone the repo**
   ```bash
   git clone https://github.com/DEADSEC-SECURITY/family-vault.git
   cd family-vault
   ```

2. **First-time setup** — run these VS Code tasks (`Ctrl+Shift+P` → "Run Task"):
   - `Dev: Setup Backend` — creates Python venv and installs dependencies
   - `Dev: Setup Frontend` — runs `npm install`

3. **Start developing** — press `F5` and select **"Full Stack: Debug All"**

   This automatically:
   - Starts PostgreSQL + MinIO in Docker (waits for healthy)
   - Runs Alembic database migrations
   - Launches the FastAPI backend with Python debugger attached
   - Launches the Next.js dev server with Node.js debugger attached
   - Opens Chrome with the frontend debugger connected

4. **Open** `http://localhost:3000` and register a new account.

## Architecture

The dev environment runs **infrastructure in Docker** and **application code locally**:

```
┌─────────────────────────────────────────────┐
│  Docker Desktop                             │
│  ┌──────────────┐  ┌─────────────────────┐  │
│  │ PostgreSQL   │  │ MinIO (S3)          │  │
│  │ :5432        │  │ :9000 API / :9001 UI│  │
│  └──────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────┘
         ▲                    ▲
         │  localhost:5432    │  localhost:9000
         │                    │
┌────────┴────────────────────┴───────────────┐
│  Local machine (VS Code)                    │
│  ┌──────────────┐  ┌─────────────────────┐  │
│  │ FastAPI      │  │ Next.js             │  │
│  │ :8000        │  │ :3000               │  │
│  │ (debugpy)    │  │ (Node inspector)    │  │
│  └──────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────┘
```

This gives you native breakpoints, hot reload, and full debugger access — no remote debugging needed.

## Environment Variables

Development defaults are in `.env.development` (committed to git). This file is loaded automatically by all VS Code launch configurations and by the Docker `full` profile.

All values point to `localhost` to match the Docker port mappings:

| Variable | Default | Notes |
|----------|---------|-------|
| `DATABASE_URL` | `postgresql://familyvault:familyvault@localhost:5432/familyvault` | Matches Postgres container |
| `S3_ENDPOINT_URL` | `http://localhost:9000` | Matches MinIO container |
| `S3_ACCESS_KEY` | `minioadmin` | MinIO default |
| `S3_SECRET_KEY` | `minioadmin` | MinIO default |
| `SECRET_KEY` | `dev-only-insecure-key...` | Dev only — never use in production |
| `CORS_ORIGINS` | `["http://localhost:3000"]` | Allows frontend requests |

To override any value locally, create `backend/.env` (gitignored) — it takes precedence via pydantic-settings.

## VS Code Tasks

Run with `Ctrl+Shift+P` → "Run Task".

### Local Development

| Task | What it does |
|------|-------------|
| `Dev: Start Infrastructure` | Start Postgres + MinIO in Docker, wait until healthy |
| `Dev: Run Migrations` | Run `alembic upgrade head` |
| `Dev: Prepare` | Infrastructure + migrations (used as pre-launch for debugger) |
| `Dev: Setup Backend` | Create Python venv, install requirements |
| `Dev: Setup Frontend` | Run `npm install` |
| `Dev: Backend` | Start uvicorn with hot reload (no debugger) |
| `Dev: Frontend` | Start Next.js dev server (no debugger) |
| `Dev: Start All` | Infrastructure + migrations + backend + frontend (no debugger) |
| `Dev: Stop Infrastructure` | Stop Docker containers |

### Docker Deploy

These build and run the full stack inside Docker using the `full` compose profile.

| Task | What it does |
|------|-------------|
| `Docker: Deploy (Dev Build)` | Build from local code, start all services |
| `Docker: Force Recreate` | Rebuild images + recreate containers |
| `Docker: Force Recreate (No Cache)` | Full clean rebuild — no Docker layer cache |
| `Docker: Deploy (Production Images)` | Deploy using pre-built Docker Hub images |
| `Docker: Down` | Stop all containers (keeps data) |
| `Docker: Down + Volumes` | Stop containers and **delete all data** |
| `Docker: Logs` | Tail logs from all services |

### Testing

| Task | What it does |
|------|-------------|
| `Test: Backend` | Run pytest |
| `Test: Frontend` | Run vitest |

## VS Code Debug Configurations

Press `F5` or open the Run and Debug panel (`Ctrl+Shift+D`).

| Configuration | What it does |
|---------------|-------------|
| **Backend: FastAPI** | Launch uvicorn with Python debugger. Auto-starts infrastructure + migrations. Set breakpoints in any `.py` file. |
| **Backend: FastAPI (all code)** | Same but also stops in library code (SQLAlchemy, FastAPI internals). |
| **Backend: Current File** | Debug the currently open Python file. |
| **Backend: Pytest** | Run and debug tests with breakpoints (`-xvs` flags). |
| **Frontend: Next.js** | Launch dev server + auto-open Chrome with debugger attached. |
| **Frontend: Chrome Attach** | Attach Chrome debugger to an already-running frontend. |
| **Full Stack: Debug All** | Launch backend + frontend debuggers together. Auto-starts infrastructure. |

## Docker Compose Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | **Production** — uses pre-built images from Docker Hub |
| `docker-compose.dev.yml` | **Development** — infra only by default, `--profile full` for full stack |

### docker-compose.dev.yml Profiles

```bash
# Default: infrastructure only (for local dev)
docker compose -f docker-compose.dev.yml up -d

# Full: build and run everything in Docker (for testing containers)
docker compose -f docker-compose.dev.yml --profile full up -d --build

# Force recreate everything from scratch
docker compose -f docker-compose.dev.yml --profile full up -d --build --force-recreate
```

## Common Workflows

### Day-to-day development

1. Press `F5` → select **"Full Stack: Debug All"**
2. Set breakpoints in Python or TypeScript files
3. Edit code — both backend (uvicorn) and frontend (Next.js) hot-reload automatically
4. When done, press the Stop button in the debug toolbar

### Run without debugger

`Ctrl+Shift+B` runs the default build task (**"Dev: Start All"**), which starts everything without the debugger overhead.

### Test a Docker build before pushing

Run task **"Docker: Force Recreate"** — builds images from your local code and runs the full stack in Docker, just like production.

### Reset the database

Run task **"Docker: Down + Volumes"**, then **"Dev: Start Infrastructure"** to start fresh.

### Add a new Python dependency

```bash
# Add to requirements.txt, then:
# Run task "Dev: Setup Backend" to reinstall
```

### Access MinIO console

Open `http://localhost:9001` — login with `minioadmin` / `minioadmin`.

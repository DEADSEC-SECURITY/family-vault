# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Family Vault is a self-hosted "Family Operating System" for securely managing IDs, insurance, business documents, and important family information. It uses AES-256-GCM envelope encryption for all uploaded files.

## Commands

### Frontend (from `frontend/`)
```bash
npm run dev          # Next.js dev server (http://localhost:3000)
npm run build        # Production build (standalone output)
npm run lint         # ESLint
npm test             # Vitest (run once)
npm run test:watch   # Vitest (watch mode)
```

### Backend (from `backend/`)
```bash
uvicorn app.main:app --reload          # Dev server (http://localhost:8000)
pytest                                  # Run all tests
pytest tests/test_items.py             # Run specific test file
pytest -v --tb=short                   # Verbose with short tracebacks
alembic upgrade head                   # Apply all migrations
alembic downgrade -1                   # Rollback one migration
alembic revision -m "description"      # Create new migration
python -m app.seed                     # Seed demo data
```

### Infrastructure
```bash
docker-compose up -d                   # Start all services
docker-compose up postgres minio       # Start only DB & storage (for local dev)
```

## Architecture

**Stack**: Next.js 16 (App Router) + FastAPI + PostgreSQL 17 + MinIO (S3-compatible)

### Backend Module Pattern

Every backend module in `backend/app/` follows: `models.py` → `schemas.py` → `service.py` → `router.py`

Key modules: `auth`, `orgs`, `items`, `categories`, `files`, `reminders`, `contacts`, `coverage`, `vehicles`, `people`, `search`, `business_reminders`, `item_links`, `saved_contacts`

### Entity-Attribute-Value (EAV) Pattern

Items use a flexible EAV schema instead of per-category tables:
- `Item` table: id, name, category, subcategory, org_id
- `ItemFieldValue` table: item_id, field_key, value (dynamic fields)
- Field definitions are **code-only** in `backend/app/categories/definitions.py` (not stored in DB)
- Adding a new field to a category requires no schema migration

### Multi-Tenancy

All data is scoped to organizations via `org_id`. Always use the shared helpers:
```python
from app.orgs.service import get_active_org_id, get_active_org
org_id = get_active_org_id(user, db)       # When you just need the ID
org = get_active_org(user, db)             # When you need the encryption key
```

Use `verify_item_ownership(db, item_id, org_id)` from `app.dependencies` to check item access.

### File Encryption

Envelope encryption: master key (from `SECRET_KEY` via HKDF) → per-org key → per-file AES-256-GCM encryption. IV + auth tag stored in DB; encrypted blob stored in MinIO.

### Authentication

Session-based with Bearer tokens. `get_current_user()` dependency validates the token on every request. Sessions expire after 72 hours.

### Frontend Structure

- `src/app/(auth)/` — Login/register (no sidebar layout)
- `src/app/(app)/` — Protected pages (sidebar layout)
- `src/components/ui/` — shadcn/ui primitives
- `src/components/items/` — Item-specific components (`ItemPage`, `ItemCard`, `SubcategoryIcon`, `ReminderCard`)
- `src/lib/api.ts` — Centralized API client with auth header injection
- `src/lib/format.ts` — Shared formatting (`humanize`, `titleCase`, `formatDate`, `getFieldValue`)
- Path alias: `@/*` → `./src/*`

### Frontend Patterns

- **API calls**: All go through `src/lib/api.ts` — never call `fetch` directly
- **Icons**: Use `SubcategoryIcon` component (config-driven) instead of switch statements
- **Reminders**: Use `ReminderCard` with variants: `default`, `compact`, `sidebar`
- **Auto-save**: `ItemPage` debounces field changes (800ms) and auto-saves via API
- **UI components**: shadcn/ui + Tailwind CSS 4 + Radix UI primitives

## Adding a New Category

1. Define in `backend/app/categories/definitions.py` (fields, file_slots, coverage definitions if insurance)
2. Add icon mapping in `frontend/src/components/items/SubcategoryIcon.tsx`
3. Create route in `frontend/src/app/(app)/<category>/`
4. Add to sidebar in `frontend/src/components/layout/Sidebar.tsx`

## Database Migrations

After creating a migration with `alembic revision -m "name"`:
1. Edit the generated file in `backend/alembic/versions/`
2. Test: `alembic upgrade head` → `alembic downgrade -1` → `alembic upgrade head`
3. Import new models in `backend/app/main.py` (lifespan function)

## Conventions

- **Backend**: PEP 8, full type hints, organized imports (stdlib → third-party → local)
- **Frontend**: TypeScript strict mode, functional components, PascalCase components, camelCase utilities
- **Commits**: Conventional commits format — `type(scope): subject` (e.g., `feat(items): add passport selector`)
- **Backend config**: Pydantic Settings in `backend/app/config.py`, loaded from env vars
- **Frontend env**: `API_URL` env var points to backend (default `http://localhost:8000/api`)

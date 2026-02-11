# Family Vault — Backend

Python FastAPI backend with SQLAlchemy 2.0, Alembic migrations, and AES-256-GCM file encryption.

## Quick Start

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start Postgres + MinIO (via Docker)
docker compose up -d postgres minio

# Run migrations
alembic upgrade head

# Seed demo data
python -m app.seed

# Start dev server
uvicorn app.main:app --reload
```

The API runs at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

### Demo Credentials

| Field    | Value                    |
| -------- | ------------------------ |
| Email    | `demo@familyvault.local` |
| Password | `demo1234`               |

## Project Structure

```
app/
├── main.py             # FastAPI app, lifespan, router registration
├── config.py           # Pydantic settings (all env vars)
├── database.py         # SQLAlchemy engine, SessionLocal, Base
├── dependencies.py     # get_current_user (Bearer token auth)
├── seed.py             # Demo user/org seeder
│
├── auth/               # Authentication (register, login, logout, me)
├── orgs/               # Organizations (multi-tenant, encryption keys)
├── categories/         # Category definitions (static, no DB)
├── items/              # Items CRUD (EAV pattern)
├── files/              # File upload/download (AES-256-GCM encrypted)
├── reminders/          # Auto-detected + custom reminders
├── contacts/           # Linked contacts (phone, email, url, address)
├── coverage/           # Insurance coverage details
├── vehicles/           # Org-wide vehicle database
├── people/             # Org-wide people database
├── visas/              # Visa types & country contacts
├── providers/          # Insurance provider data (static)
├── search/             # Full-text search
├── dashboard/          # Dashboard statistics
└── email/              # SMTP email notifications
```

## Module Pattern

Each module follows a consistent structure:

```
module/
├── models.py     # SQLAlchemy ORM models
├── schemas.py    # Pydantic request/response schemas
├── service.py    # Business logic
└── router.py     # API endpoints
```

Not all modules have all files (e.g., `search/` has no `models.py`).

## Key Patterns

### Shared Org Helpers

All routers need the active org ID for scoping queries. Use the shared helpers from `orgs/service.py`:

```python
from app.orgs.service import get_active_org_id, get_active_org

@router.get("/my-endpoint")
def my_endpoint(user = Depends(get_current_user), db = Depends(get_db)):
    org_id = get_active_org_id(user, db)  # Just the ID string
    # or
    org = get_active_org(user, db)         # Full org object (for encryption key)
```

### EAV Pattern

Items use Entity-Attribute-Value for flexible fields:

```python
# Item table: common fields (name, category, subcategory, org_id)
# ItemFieldValue table: key-value pairs per item
# Field definitions come from categories/definitions.py (not the DB)
```

### File Encryption

Files are encrypted with AES-256-GCM before upload to MinIO:

```
Upload:  raw file → encrypt(org_key) → MinIO  (IV + tag stored in DB)
Download: MinIO → decrypt(org_key, IV, tag) → stream to user
```

## Migrations

```bash
# Apply all migrations
alembic upgrade head

# Create a new migration
alembic revision -m "description"

# Rollback one step
alembic downgrade -1
```

| Migration | Description |
|-----------|-------------|
| 001 | Initial schema (users, sessions, orgs, items, files) |
| 002 | Custom reminders table |
| 003 | Add repeat to reminders |
| 004 | Item contacts table |
| 005 | Coverage tables |
| 006 | Contacts sort order |
| 007 | Structured address fields |
| 008 | Vehicles tables |
| 009 | Rename home insurance |
| 010 | People table |
| 011 | Vehicle year/make/model fields |
| 012 | Encrypt sensitive fields |
| 013 | Reminder enhancements |

## Environment Variables

See `.env.example` in the project root. Key variables:

| Variable | Default | Required |
|----------|---------|----------|
| `DATABASE_URL` | `postgresql://...localhost:5432` | Yes |
| `SECRET_KEY` | `change-me-in-production` | Yes (change it!) |
| `S3_ENDPOINT_URL` | `http://localhost:9000` | Yes |
| `S3_ACCESS_KEY` | `minioadmin` | Yes |
| `S3_SECRET_KEY` | `minioadmin` | Yes |
| `S3_BUCKET` | `familyvault` | Yes |
| `SMTP_HOST` | (empty = disabled) | No |

## API Routes

All endpoints require `Authorization: Bearer <token>` (except `/api/auth/*`).

| Prefix | Module | Endpoints |
|--------|--------|-----------|
| `/api/auth` | auth | register, login, logout, me |
| `/api/categories` | categories | list, get |
| `/api/items` | items | CRUD + list |
| `/api/files` | files | upload, download, delete |
| `/api/reminders` | reminders | list, overdue, custom CRUD |
| `/api/contacts` | contacts | CRUD + reorder |
| `/api/coverage` | coverage | rows, limits, providers |
| `/api/vehicles` | vehicles | CRUD + assign/unassign |
| `/api/people` | people | CRUD |
| `/api/visas` | visas | types, country contacts |
| `/api/providers` | providers | insurance list + details |
| `/api/search` | search | full-text search |
| `/api/dashboard` | dashboard | org statistics |
| `/api/health` | main | health check |

## Dependencies

Key packages (see `requirements.txt` for full list):

- `fastapi` + `uvicorn` — Web framework + ASGI server
- `sqlalchemy` + `alembic` — ORM + migrations
- `pydantic` + `pydantic-settings` — Validation + config
- `bcrypt` — Password hashing
- `boto3` — S3/MinIO client
- `cryptography` — AES-256-GCM encryption
- `apscheduler` — Background job scheduler (reminder emails)
- `psycopg2-binary` — PostgreSQL driver

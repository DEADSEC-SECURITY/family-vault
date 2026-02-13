---
layout: default
title: Backend Guide
nav_order: 5
---

# Backend Guide

Python FastAPI backend with SQLAlchemy 2.0, Alembic, and zero-knowledge encryption.

---

## Module Structure

Each module follows a consistent pattern:

```
module/
├── models.py     # SQLAlchemy ORM models
├── schemas.py    # Pydantic request/response schemas
├── service.py    # Business logic
└── router.py     # API endpoints
```

## Modules

| Module | Tables | Purpose |
|--------|--------|---------|
| `auth` | users, sessions | Registration, login, session management |
| `orgs` | organizations, org_memberships | Multi-tenant orgs, encryption keys |
| `categories` | (none) | Static category/field definitions |
| `items` | items, item_field_values | Core CRUD with EAV fields |
| `files` | file_attachments | Encrypted file upload/download |
| `reminders` | custom_reminders | Auto-detected + custom reminders |
| `contacts` | item_contacts | Linked contacts (phone, email, url, address) |
| `coverage` | coverage_rows, plan_limits, providers | Insurance coverage details |
| `vehicles` | vehicles, item_vehicles | Org-wide vehicle database |
| `people` | people | Org-wide people database |
| `visas` | (none) | Visa types + country embassy contacts |
| `providers` | (none) | Insurance provider data |
| `search` | (none) | Full-text search |
| `dashboard` | (none) | Org statistics |
| `email` | (none) | SMTP email sending |
| `audit` | audit_logs | Audit logging for key actions |
| `invitations` | invitations | Org invitation management |
| `business_reminders` | (none) | Business-specific reminder queries |
| `item_links` | item_links | Parent-child item linking |
| `saved_contacts` | saved_contacts | Reusable contact templates |

## Shared Helpers

### `get_active_org_id(user, db)`

All routers need the active org ID for scoping queries. Use the shared helper:

```python
from app.orgs.service import get_active_org_id

@router.get("/my-endpoint")
def my_endpoint(user = Depends(get_current_user), db = Depends(get_db)):
    org_id = get_active_org_id(user, db)
```

### `get_active_org(user, db)`

Returns the full `Organization` object. Used when you need the encryption key:

```python
from app.orgs.service import get_active_org, get_org_encryption_key

org = get_active_org(user, db)
org_key = get_org_encryption_key(db, org, settings.SECRET_KEY)
```

## EAV Pattern

Items use Entity-Attribute-Value for flexible fields:

```
Item table:           id, category, subcategory, name, org_id, ...
ItemFieldValue table: id, item_id, field_key, field_value, field_type
```

Field definitions come from `categories/definitions.py` (Python dict, not the database). Adding new categories or fields requires no migrations.

**Update strategy**: On item update, all `ItemFieldValue` rows are deleted and re-created. The frontend must send ALL field values on every save.

## Encryption

### Current: Zero-Knowledge (v2)

Client-side encryption using Web Crypto API. The server stores only encrypted blobs:

```
User Password → PBKDF2 → Master Key → HKDF → Symmetric Key
Symmetric Key encrypts user's RSA private key (stored on server)
Org Key (AES-256-GCM) wrapped per-member via RSA public key
Items/files encrypted client-side with org key before upload
```

### Legacy: Server-Side (v1)

Items with `encryption_version=1` use the old server-side envelope encryption:

```
SECRET_KEY → HKDF → Master Key → encrypts → Org Key (in DB)
Org Key + random IV → AES-256-GCM → encrypted file (in MinIO)
```

Legacy items are lazily migrated to v2 as they are accessed. IV and auth tag stored in `file_attachments` table.

## Migrations

Alembic migrations run automatically on container startup (`alembic upgrade head`).

```bash
# Create a new migration
alembic revision -m "description"

# Apply
alembic upgrade head

# Rollback
alembic downgrade -1
```

Always import new models in `main.py`'s lifespan function so SQLAlchemy knows about them.

## Adding a New Module

1. Create `backend/app/mymodule/` with `__init__.py`, `models.py`, `schemas.py`, `router.py`
2. Import models in `main.py` lifespan function
3. Register the router in `main.py`: `app.include_router(my_router)`
4. Use `get_active_org_id(user, db)` for org-scoped queries
5. Create a migration if you added database tables
6. Rebuild the backend container

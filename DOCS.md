# FamilyVault — Master Documentation

> **Self-hosted, open-source family document vault.**
> Store, organize, and manage insurance policies, IDs, business documents, and more — all encrypted at rest.
> A privacy-first alternative to Trustworthy.com.

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Architecture Overview](#2-architecture-overview)
3. [Project Structure](#3-project-structure)
4. [Backend Reference](#4-backend-reference)
5. [Frontend Reference](#5-frontend-reference)
6. [Database Schema](#6-database-schema)
7. [API Reference](#7-api-reference)
8. [Security & Encryption](#8-security--encryption)
9. [Category & Field System](#9-category--field-system)
10. [Coverage System (Insurance)](#10-coverage-system-insurance)
11. [Contacts System](#11-contacts-system)
12. [Reminders System](#12-reminders-system)
13. [Vehicles System](#13-vehicles-system)
14. [People System](#14-people-system)
15. [Visa System](#15-visa-system)
16. [Image Editor & Auto-Detect](#16-image-editor--auto-detect)
17. [Provider Data](#17-provider-data)
18. [Shared Utilities & Reusable Components](#18-shared-utilities--reusable-components)
19. [Environment Variables](#19-environment-variables)
20. [Docker & Deployment](#20-docker--deployment)
21. [Migrations](#21-migrations)
22. [Troubleshooting & Lessons Learned](#22-troubleshooting--lessons-learned)

---

## 1. Quick Start

```bash
# Clone the repo
git clone <repo-url>
cd "Trustworthy Open Source"

# Copy env file and customize
cp .env.example .env

# Launch all services (postgres, minio, backend, frontend)
docker compose up -d --build

# Wait ~30s for startup, then open:
#   Frontend:  http://localhost:3000
#   Backend:   http://localhost:8000/api/health
#   MinIO:     http://localhost:9001  (minioadmin / minioadmin)
```

### Demo Credentials

| Field    | Value                    |
| -------- | ------------------------ |
| Email    | `demo@familyvault.local` |
| Password | `demo1234`               |

The demo user and org are auto-seeded on first backend boot via `backend/app/seed.py`.

---

## 2. Architecture Overview

```
┌───────────────────────────────────────────────────────────────────┐
│                        DOCKER COMPOSE                            │
│                                                                  │
│  ┌─────────────┐   ┌─────────────┐   ┌────────────────────────┐ │
│  │  PostgreSQL  │   │    MinIO     │   │       Backend          │ │
│  │  Port 5432   │   │  Port 9000  │   │    FastAPI + Uvicorn   │ │
│  │             ◄├───┤►S3-compat   │   │      Port 8000         │ │
│  │  7 tables    │   │  Encrypted  │   │   10 API routers       │ │
│  │  + coverage  │   │  file blobs │   │   AES-256-GCM encrypt  │ │
│  └──────▲───────┘   └──────▲──────┘   │   APScheduler (email)  │ │
│         │                  │          └──────────▲─────────────┘ │
│         │    SQLAlchemy     │   boto3             │               │
│         └──────────────────┼─────────────────────┘               │
│                            │                                     │
│  ┌─────────────────────────┼─────────────────────────────────┐   │
│  │            Frontend — Next.js 15 (App Router)             │   │
│  │                     Port 3000                             │   │
│  │   TypeScript · Tailwind CSS · shadcn/ui · react-easy-crop │   │
│  │                                                           │   │
│  │   Pages:  /login  /register  /dashboard                   │   │
│  │           /ids  /insurance  /business  (+ /new, /[itemId])│   │
│  │           /reminders  /search                             │   │
│  └───────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer      | Technology                                              |
| ---------- | ------------------------------------------------------- |
| Frontend   | Next.js 15, TypeScript, Tailwind CSS, shadcn/ui         |
| Backend    | Python 3.13, FastAPI, SQLAlchemy 2.0, Alembic           |
| Database   | PostgreSQL 17 (Alpine)                                  |
| Storage    | MinIO (S3-compatible) — files encrypted with AES-256-GCM|
| Auth       | Session-based: bcrypt password hashing + opaque tokens  |
| Encryption | AES-256-GCM envelope encryption (per-org keys)          |
| Scheduler  | APScheduler (hourly reminder email checks)              |
| Container  | Docker Compose (4 services)                             |

### Data Flow

1. **User logs in** → backend creates a `Session` row with a random 64-char hex token
2. **Frontend stores token** in `localStorage` → sends as `Authorization: Bearer <token>` header
3. **All data is scoped to an Organization** → user's first org is auto-selected
4. **Items** belong to an org, are categorized (ids/insurance/business), and have:
   - EAV field values (ItemFieldValue table)
   - Encrypted file attachments (MinIO)
   - Linked contacts (ItemContact table)
   - Reminders (auto-detected from dates + custom)
   - Coverage details (insurance subcategories only)
5. **Files are encrypted** client → server → AES-256-GCM → MinIO. Decrypted on download.

---

## 3. Project Structure

```
Trustworthy Open Source/
├── docker-compose.yml          # 4 services: postgres, minio, backend, frontend
├── .env.example                # Environment variable template
├── DOCS.md                     # ← YOU ARE HERE
│
├── backend/
│   ├── Dockerfile              # Python 3.13-slim, runs alembic + seed + uvicorn
│   ├── requirements.txt        # Python dependencies
│   ├── alembic.ini             # Alembic config (points to app.database)
│   │
│   ├── alembic/
│   │   ├── env.py              # Migration environment
│   │   └── versions/           # 13 migration files (001–013)
│   │
│   └── app/
│       ├── main.py             # FastAPI app, lifespan, router registration
│       ├── config.py           # Pydantic settings (env vars)
│       ├── database.py         # SQLAlchemy engine, SessionLocal, Base
│       ├── dependencies.py     # get_current_user dependency (Bearer token)
│       ├── seed.py             # Demo user + org seeder
│       │
│       ├── auth/               # Authentication (register, login, logout, me)
│       │   ├── models.py       #   User, Session tables
│       │   ├── schemas.py      #   UserCreate, UserLogin, TokenResponse
│       │   ├── service.py      #   Password hashing, session CRUD
│       │   └── router.py       #   /api/auth/* endpoints
│       │
│       ├── orgs/               # Organizations (multi-tenant)
│       │   ├── models.py       #   Organization, OrgMembership tables
│       │   ├── schemas.py      #   (minimal)
│       │   ├── service.py      #   Org CRUD, encryption key management
│       │   └── router.py       #   /api/orgs/* endpoints
│       │
│       ├── categories/         # Category definitions (IDs, Insurance, Business)
│       │   ├── definitions.py  #   CATEGORIES dict, COVERAGE_DEFINITIONS dict
│       │   ├── schemas.py      #   CategoryListItem, SubcategoryInfo, FieldDefinition
│       │   └── router.py       #   /api/categories/* endpoints
│       │
│       ├── items/              # Items CRUD (the core entity)
│       │   ├── models.py       #   Item, ItemFieldValue tables (EAV pattern)
│       │   ├── schemas.py      #   ItemCreate, ItemResponse, FieldValueIn/Out
│       │   ├── service.py      #   Create, read, update, delete, list
│       │   └── router.py       #   /api/items/* endpoints
│       │
│       ├── files/              # File attachments (encrypted storage)
│       │   ├── models.py       #   FileAttachment table
│       │   ├── schemas.py      #   FileUploadResponse
│       │   ├── encryption.py   #   AES-256-GCM encrypt/decrypt functions
│       │   ├── storage.py      #   MinIO/S3 client wrapper (singleton)
│       │   └── router.py       #   /api/files/* endpoints (upload, download, delete)
│       │
│       ├── reminders/          # Reminders (auto + custom)
│       │   ├── models.py       #   CustomReminder table
│       │   ├── schemas.py      #   CustomReminderCreate
│       │   ├── service.py      #   Auto-detect from dates + custom CRUD + email
│       │   └── router.py       #   /api/reminders/* endpoints
│       │
│       ├── contacts/           # Linked contacts (phone, email, URL, address)
│       │   ├── models.py       #   ItemContact table (with structured address cols)
│       │   ├── schemas.py      #   ItemContactCreate/Out/Update, reorder schemas
│       │   └── router.py       #   /api/contacts/* endpoints
│       │
│       ├── coverage/           # Insurance coverage details
│       │   ├── models.py       #   CoverageRow, CoveragePlanLimit, InNetworkProvider
│       │   ├── schemas.py      #   CoverageRowOut, PlanLimitOut, etc.
│       │   └── router.py       #   /api/coverage/* endpoints
│       │
│       ├── providers/          # Insurance provider data
│       │   ├── data.py         #   INSURANCE_PROVIDERS list, PROVIDER_DETAILS dict
│       │   └── router.py       #   /api/providers/* endpoints
│       │
│       ├── vehicles/           # Org-wide vehicle database
│       │   ├── models.py       #   Vehicle, ItemVehicle tables
│       │   ├── schemas.py      #   VehicleCreate/Out, AssignVehicle
│       │   └── router.py       #   /api/vehicles/* endpoints
│       │
│       ├── people/             # Org-wide people database
│       │   ├── models.py       #   Person table
│       │   ├── schemas.py      #   PersonCreate/Out
│       │   └── router.py       #   /api/people/* endpoints
│       │
│       ├── visas/              # Visa types & country contacts
│       │   ├── data.py         #   VISA_TYPES list, COUNTRY_CONTACTS dict
│       │   └── router.py       #   /api/visas/* endpoints
│       │
│       ├── dashboard/          # Dashboard statistics
│       │   └── router.py       #   /api/dashboard endpoint
│       │
│       ├── business_reminders/ # Business-specific reminders
│       │   └── router.py       #   /api/business-reminders endpoint
│       │
│       ├── search/             # Full-text search across items
│       │   ├── service.py      #   ILIKE search on name + field values
│       │   └── router.py       #   /api/search endpoint
│       │
│       └── email/              # Email notifications
│           └── service.py      #   SMTP sending (threaded), reminder templates
│
├── frontend/
│   ├── Dockerfile              # Multi-stage: build + standalone runner
│   ├── package.json            # Node dependencies
│   ├── next.config.ts          # Next.js config (standalone output)
│   ├── tsconfig.json           # TypeScript config
│   ├── components.json         # shadcn/ui config
│   │
│   └── src/
│       ├── app/
│       │   ├── layout.tsx              # Root layout (Geist font)
│       │   ├── page.tsx                # Home → redirects to /dashboard
│       │   │
│       │   ├── (auth)/                 # Auth route group (no sidebar)
│       │   │   ├── login/page.tsx      #   Login form
│       │   │   └── register/page.tsx   #   Registration form
│       │   │
│       │   └── (app)/                  # Protected route group (with sidebar)
│       │       ├── layout.tsx          #   App shell: Sidebar + Header + RemindersPanel
│       │       ├── dashboard/page.tsx  #   Category cards with item counts
│       │       ├── ids/               #   IDs category pages
│       │       │   ├── page.tsx       #     Category listing
│       │       │   ├── new/page.tsx   #     Create new ID item
│       │       │   └── [itemId]/page.tsx  # View/edit ID item
│       │       ├── insurance/         #   Insurance category pages (same structure)
│       │       ├── business/          #   Business category pages (same structure)
│       │       ├── reminders/page.tsx  #   All reminders view
│       │       └── search/page.tsx    #   Search results page
│       │
│       ├── components/
│       │   ├── auth/
│       │   │   ├── LoginForm.tsx       # Login form component
│       │   │   └── RegisterForm.tsx    # Registration form component
│       │   │
│       │   ├── layout/
│       │   │   ├── Sidebar.tsx         # Left navigation sidebar
│       │   │   ├── Header.tsx          # Top header bar
│       │   │   ├── RemindersPanel.tsx  # Slide-out reminders panel
│       │   │   └── PageTransition.tsx  # Framer-motion page transitions
│       │   │
│       │   ├── items/
│       │   │   ├── ItemPage.tsx        # ★ MAIN ITEM VIEW (Overview/Files/Notes tabs)
│       │   │   ├── CategoryPage.tsx    # Category listing with subcategory sections
│       │   │   ├── SubcategorySection.tsx # Subcategory accordion with item cards
│       │   │   ├── ItemCard.tsx        # Item card in list view
│       │   │   ├── SubcategoryIcon.tsx # Config-driven icon for all subcategories
│       │   │   ├── ReminderCard.tsx    # Reusable reminder card (3 variants)
│       │   │   ├── ReminderEditDialog.tsx # Edit dialog for custom reminders
│       │   │   ├── ItemDetailView.tsx  # Compact item detail (used in lists)
│       │   │   ├── ItemFormDialog.tsx  # Create/edit item dialog
│       │   │   ├── FieldRenderer.tsx   # Dynamic field rendering by type
│       │   │   ├── ProviderCombobox.tsx # Insurance provider autocomplete
│       │   │   ├── VisaFieldCombobox.tsx # Visa type autocomplete
│       │   │   ├── PersonSelector.tsx  # Person picker from org people
│       │   │   ├── PassportSelector.tsx # Passport picker for visa linking
│       │   │   ├── VehiclesSection.tsx # Vehicle assignment for auto insurance
│       │   │   ├── FileUploader.tsx    # Drag-and-drop file upload
│       │   │   ├── FileList.tsx        # File attachment list
│       │   │   ├── ImageEditor.tsx     # Crop/rotate/auto-detect image editor
│       │   │   └── CoverageTab.tsx     # Insurance coverage details tab
│       │   │
│       │   └── ui/                     # shadcn/ui primitives (15 components)
│       │
│       ├── lib/
│       │   ├── api.ts             # ★ API client + all TypeScript interfaces
│       │   ├── auth.ts            # Token/user localStorage helpers
│       │   ├── format.ts          # Shared formatting utilities (humanize, titleCase, etc.)
│       │   ├── utils.ts           # cn() Tailwind utility
│       │   └── image-utils.ts     # Image crop/rotate/auto-detect algorithms
│       │
│       └── types/
│           ├── index.ts           # Re-exports User, AuthResponse, etc.
│           └── user.ts            # User-related type definitions
```

---

## 4. Backend Reference

### 4.1 Entry Point — `main.py`

The FastAPI application is created with:
- **Lifespan**: Imports all models (so SQLAlchemy knows about them), starts the APScheduler for hourly reminder email checks, and shuts down the scheduler on exit.
- **CORS middleware**: Allows the frontend origin (default `http://localhost:3000`).
- **10 routers** registered under `/api/*`.
- **Health check**: `GET /api/health` → `{"status": "ok"}`.

### 4.2 Configuration — `config.py`

Uses `pydantic-settings` to load environment variables. Reads from `.env` if present.

| Setting              | Default                          | Description                      |
| -------------------- | -------------------------------- | -------------------------------- |
| `DATABASE_URL`       | `postgresql://...localhost:5432` | PostgreSQL connection string     |
| `SECRET_KEY`         | `change-me-in-production`        | Master key for encryption (HKDF) |
| `SESSION_EXPIRY_HOURS` | `72`                           | Session token lifetime           |
| `S3_ENDPOINT_URL`    | `http://localhost:9000`          | MinIO/S3 endpoint                |
| `S3_ACCESS_KEY`      | `minioadmin`                     | MinIO access key                 |
| `S3_SECRET_KEY`      | `minioadmin`                     | MinIO secret key                 |
| `S3_BUCKET`          | `familyvault`                    | S3 bucket name                   |
| `CORS_ORIGINS`       | `["http://localhost:3000"]`      | Allowed CORS origins             |
| `SMTP_HOST`          | (empty = disabled)               | SMTP server for email alerts     |

### 4.3 Database — `database.py`

- `engine`: SQLAlchemy `create_engine` with `pool_pre_ping=True`
- `SessionLocal`: Session factory (`autocommit=False`, `autoflush=False`)
- `Base`: Declarative base for all models
- `get_db()`: FastAPI dependency that yields a session and closes it after the request

### 4.4 Auth Dependency — `dependencies.py`

`get_current_user()` extracts the Bearer token from the `Authorization` header, looks up the session in the database, verifies it hasn't expired, and returns the `User` object. Returns 401 on failure.

### 4.5 Module: `auth/`

**Tables**: `users`, `sessions`

| Endpoint               | Method | Description                              |
| ---------------------- | ------ | ---------------------------------------- |
| `/api/auth/register`   | POST   | Create user + auto-org + session token   |
| `/api/auth/login`      | POST   | Verify password, create session token    |
| `/api/auth/logout`     | POST   | Delete session token                     |
| `/api/auth/me`         | GET    | Get current user info                    |

**Password hashing**: bcrypt (via `bcrypt` library).
**Session tokens**: 64-char random hex (`secrets.token_hex(32)`), stored in `sessions` table with expiry.

### 4.6 Module: `orgs/`

**Tables**: `organizations`, `org_memberships`

Organizations provide multi-tenant isolation. Each org has:
- A random 256-bit **encryption key** (encrypted with the master key derived from `SECRET_KEY` via HKDF)
- Members via `OrgMembership` (role: `owner` or `member`)

**Key functions**:
- `create_organization()`: Generates random org key, encrypts it with master key, creates org + owner membership
- `get_org_encryption_key()`: Decrypts and returns the org's 256-bit encryption key
- `get_user_orgs()`: Returns all orgs a user belongs to
- `get_active_org(user, db)`: Shared helper returning the user's first org (full object). Used by routers that need the encryption key.
- `get_active_org_id(user, db)`: Shared helper returning just the org ID string. Used by all routers for org-scoped queries. Eliminates per-router `_get_active_org_id()` duplication.

### 4.7 Module: `categories/`

**No database tables** — categories are defined in code in `definitions.py`.

The `CATEGORIES` dict defines three top-level categories:
- **ids** (Family IDs): drivers_license, passport, social_security, birth_certificate, custom_id
- **insurance** (Insurance): auto_insurance, health_insurance, home_insurance, life_insurance, other_insurance
- **business** (Business): llc, corporation, partnership, sole_proprietorship, business_license, business_insurance, tax_document

Each subcategory has:
- `fields[]`: List of `FieldDefinition` objects (key, label, type, required, options)
- `file_slots[]`: Named file upload slots (e.g., `front_image`, `back_image`)
- `recommended`: Whether to show prominently in the UI

**Field types**: `text`, `date`, `number`, `textarea`, `provider`, `select` (with options)

### 4.8 Module: `items/`

**Tables**: `items`, `item_field_values`

The core entity. Uses the **EAV (Entity-Attribute-Value) pattern**:
- `Item` table stores common fields (name, category, subcategory, notes, org_id)
- `ItemFieldValue` table stores dynamic fields as key-value pairs
- Field definitions come from `categories/definitions.py`

**Important behaviors**:
- **Soft delete**: `delete_item()` sets `is_archived=True` (never hard-deletes)
- **Auto-save**: Item creation skips required field validation (`check_required=False`) because items are created instantly and fields are filled incrementally
- **Update replaces all fields**: On update, all existing `ItemFieldValue` rows are deleted and re-created

### 4.9 Module: `files/`

**Tables**: `file_attachments`

Handles encrypted file upload/download via MinIO (S3-compatible).

**Upload flow**:
1. Validate MIME type (jpeg, png, webp, gif, pdf, doc, docx) and size (≤ 25MB)
2. Encrypt file bytes with org's AES-256-GCM key → returns `(ciphertext, iv, tag)`
3. Upload `ciphertext + tag` to MinIO at key: `{org_id}/{item_id}/{purpose}_{uuid}.{ext}.enc`
4. Store metadata (file_name, storage_key, file_size, mime_type, encryption_iv, encryption_tag) in DB

**Download flow**:
1. Fetch encrypted blob from MinIO
2. Split into ciphertext + tag
3. Decrypt with org key + iv + tag
4. Return plaintext as HTTP response with `Content-Disposition: inline`

### 4.10 Module: `reminders/`

**Tables**: `custom_reminders`

Two types of reminders:

1. **Auto-detected**: Scans `ItemFieldValue` for `expiration_date` or `end_date` fields within the next 90 days. No storage — computed on the fly from item data.
2. **Custom**: User-created reminders stored in `custom_reminders` table with title, date, note, and repeat schedule.

**Repeat options**: `none`, `weekly`, `monthly`, `quarterly`, `yearly`

**Email scheduler**: APScheduler runs `check_due_reminders()` every hour. It finds custom reminders where `remind_date <= today` and `email_sent == False`, sends HTML emails to all org members via SMTP, then marks `email_sent = True`.

### 4.11 Module: `contacts/`

**Tables**: `item_contacts`

Linked contacts for items (phone numbers, emails, URLs, addresses).

**Contact types**: `phone`, `email`, `url`, `address`

**Address handling**: When `contact_type = "address"`, structured fields are stored:
- `address_line1`, `address_line2`, `address_city`, `address_state`, `address_zip`
- The `value` column is auto-composed from parts: `"Line1, Line2, City, State Zip"`
- On type change away from address, all address columns are cleared

**Reordering**: PUT `/api/contacts/reorder` accepts a list of `{id, sort_order}` pairs for drag-and-drop reordering.

### 4.12 Module: `coverage/`

**Tables**: `coverage_rows`, `coverage_plan_limits`, `in_network_providers`

Insurance coverage tracking with different layouts per subcategory:
- **health**: In-network/out-of-network columns (copay, coinsurance, deductible_applies, notes)
- **standard**: Coverage limit + deductible columns (auto, home, business insurance)
- **life**: Same as standard but different default rows

**Upsert pattern**: PUT endpoints delete all existing rows and replace with new ones (bulk replace).

### 4.13 Module: `providers/`

**No database tables** — provider data is hardcoded in `data.py`.

- `INSURANCE_PROVIDERS`: List of 150+ US insurance provider names
- `PROVIDER_DETAILS`: Dict of contact info for major providers (portal URL, claims address, phone numbers)

When a user selects a provider in the UI, the frontend fetches `PROVIDER_DETAILS` and can auto-populate linked contacts.

### 4.14 Module: `vehicles/`

**Tables**: `vehicles`, `item_vehicles`

Org-wide vehicle database. Vehicles are managed at the org level and can be assigned to auto insurance items via a many-to-many junction table.

| Endpoint                                    | Method | Description                        |
| ------------------------------------------- | ------ | ---------------------------------- |
| `/api/vehicles`                             | GET    | List all org vehicles              |
| `/api/vehicles`                             | POST   | Create a new vehicle               |
| `/api/vehicles/{id}`                        | PATCH  | Update vehicle details             |
| `/api/vehicles/{id}`                        | DELETE | Delete vehicle (cascades)          |
| `/api/vehicles/item/{item_id}`              | GET    | List vehicles assigned to an item  |
| `/api/vehicles/item/{item_id}`              | POST   | Assign a vehicle to an item        |
| `/api/vehicles/item/{item_id}/{vehicle_id}` | DELETE | Unassign a vehicle from an item    |

### 4.15 Module: `people/`

**Tables**: `people`

Org-wide people database. People can be linked to items via `PersonSelector` on the frontend (e.g., insured person on a policy, ID holder).

| Endpoint             | Method | Description           |
| -------------------- | ------ | --------------------- |
| `/api/people`        | GET    | List all org people   |
| `/api/people`        | POST   | Create a person       |
| `/api/people/{id}`   | PATCH  | Update person details |
| `/api/people/{id}`   | DELETE | Delete person         |

### 4.16 Module: `visas/`

**No database tables** — visa type data and country embassy contacts are hardcoded in `data.py`.

- `VISA_TYPES`: List of common visa categories (B-1, F-1, H-1B, etc.)
- `COUNTRY_CONTACTS`: Dict of country embassy/consulate contact info

Used by the `VisaFieldCombobox` on the frontend for visa subcategory items.

### 4.17 Module: `dashboard/`

**No database tables** — aggregates data from items.

Returns org-level statistics: total items per category, items with upcoming expirations, and recent activity.

### 4.18 Module: `search/`

**No database tables** — queries `items` and `item_field_values`.

Uses PostgreSQL `ILIKE` to search item names and field values. Returns up to 50 matching items.

### 4.19 Module: `email/`

**No database tables.**

SMTP email service for sending reminder notifications. Uses `smtplib` with TLS support. Emails are sent in background threads to avoid blocking. If `SMTP_HOST` is empty, email is disabled (no-op).

---

## 5. Frontend Reference

### 5.1 App Layout

```
┌─────────────────────────────────────────────────────────┐
│ Sidebar │ Header ─────────────────────────────────────│ │
│  (nav)  │                                             │ │
│         │  <main className="bg-gray-50 p-6">         │ │
│  IDs    │    <PageTransition>                         │ │
│  Insur  │      {children}  ← page content             │ │
│  Biz    │    </PageTransition>                        │ │
│         │  </main>                                    │ │
│  Remind │                                             │ │
│  Search │                                             │ │
└─────────┴─────────────────────────────────────────────┘
```

- **`(auth)/` layout**: No sidebar or header. Used for login/register pages.
- **`(app)/` layout**: Full app shell. Checks `isAuthenticated()` on mount; redirects to `/login` if no token. Includes `Sidebar`, `Header`, `RemindersPanel` (slide-out panel), and `PageTransition`.

### 5.2 API Client — `lib/api.ts`

Central `api` object with methods for all backend endpoints. Uses `fetchAPI<T>()`:
- Attaches `Authorization: Bearer <token>` header from localStorage
- On 401 (non-auth endpoints): clears token, redirects to `/login`
- On 204: returns `undefined`
- Throws `ApiError` on non-ok responses

**API modules**: `api.auth`, `api.categories`, `api.items`, `api.files`, `api.reminders`, `api.search`, `api.providers`, `api.contacts`, `api.coverage`

**Type exports**: All TypeScript interfaces matching backend Pydantic schemas are defined at the bottom of this file. Import from `@/lib/api`.

### 5.3 Auth Helpers — `lib/auth.ts`

localStorage-based token management:
- `getToken()` / `setToken()` / `removeToken()` — session token
- `getStoredUser()` / `setStoredUser()` — cached user info (avoids re-fetching `/me`)
- `getActiveOrgId()` / `setActiveOrgId()` — active organization ID
- `isAuthenticated()` — returns `true` if token exists

**Storage keys**: `familyvault_token`, `familyvault_user`, `familyvault_org_id`

### 5.4 ItemPage Component — `components/items/ItemPage.tsx`

The **main item view** — the most complex component in the app. It renders the full item detail page with tabs, sidebar, and auto-save.

#### Layout Diagram

```
┌──────────────────────────────────────────────────────────────┐
│  Breadcrumb (Insurance > Health Insurance > item.name)        │
├──────────────────────────────────────────────────────────────┤
│  [Overview]  [Files]  [Notes]  [Coverage]  ← Tabs            │
├─────────────────────────────────────┬────────────────────────┤
│  Tab Content (left 2/3)             │  RightSidebar (1/3)    │
│                                     │                        │
│  OVERVIEW TAB:                      │  Linked Contacts       │
│  ┌─ Card ─────────────────────┐     │  ┌─────────────────┐   │
│  │  2-column grid of fields   │     │  │ Customer Care   │   │
│  │  [Full Name: ___________]  │     │  │ 1-800-xxx-xxxx  │   │
│  │  [Policy #:  ___________]  │     │  │                 │   │
│  │  [Provider:  [combobox] ]  │     │  │ Claims Address  │   │
│  │  [Start Date: [picker]  ]  │     │  │ 123 Main St     │   │
│  │                            │     │  │ City, ST 12345  │   │
│  │  Inline File Zones         │     │  └─────────────────┘   │
│  │  ┌──────┐  ┌──────┐       │     │                        │
│  │  │Front │  │Back  │       │     │  Custom Reminders      │
│  │  │Image │  │Image │       │     │  ┌─────────────────┐   │
│  │  └──────┘  └──────┘       │     │  │ Renewal Due     │   │
│  └────────────────────────────┘     │  │ 2025-06-15      │   │
│                                     │  └─────────────────┘   │
│  FILES TAB:                         │                        │
│  Drag-and-drop zone + file list     │                        │
│                                     │                        │
│  NOTES TAB:                         │                        │
│  Textarea (auto-saves)              │                        │
│                                     │                        │
│  COVERAGE TAB (insurance only):     │                        │
│  Coverage rows table + plan limits  │                        │
└─────────────────────────────────────┴────────────────────────┘
```

#### Key Behaviors

- **Auto-save**: Debounced at 800ms. Reads from refs (not state) to capture the freshest values. Saves name, notes, and all field values to `api.items.update()`.
- **Create mode**: When `isNew=true`, the item is created via `api.items.create()` immediately, then the page transitions to edit mode. Pending contacts and reminders are queued locally and saved after the item ID is available.
- **RightSidebar**: Uses `forwardRef` + `useImperativeHandle` to expose methods like `savePendingContacts()` and `savePendingReminders()` to the parent.
- **Provider auto-populate**: When a provider is selected via `ProviderCombobox`, the parent fetches `api.providers.details(name)` and auto-populates linked contacts (phone numbers, claims address, portal URL).

#### Spacing Reference

| Element                     | Class            | Purpose                           |
| --------------------------- | ---------------- | --------------------------------- |
| Page outer padding          | `p-6`            | Set by `(app)/layout.tsx` `<main>`|
| Below breadcrumb            | `mb-6`           | Space before tabs                 |
| Below tab list              | `mb-6`           | Space between tabs and content    |
| Card internal padding       | `p-6`            | Inside the white Card component   |
| Field grid                  | `gap-x-6 gap-y-4`| 2-column field layout             |
| Below white card to page end| `mb-6`           | Margin at bottom of tab content   |
| Right sidebar top offset    | `pt-[64px]`      | Aligns with tab content card      |

### 5.5 ImageEditor Component — `components/items/ImageEditor.tsx`

Full-featured image editor with:
- **Crop**: Powered by `react-easy-crop` (pinch/zoom/drag)
- **Rotate**: 90° increments
- **Auto-detect**: Sobel edge detection to find card/document bounds (see Section 13)
- **Save**: Exports cropped image as JPEG blob, replaces the original file

### 5.6 CoverageTab Component — `components/items/CoverageTab.tsx`

Renders the insurance coverage details table. Layout varies by subcategory:
- **health**: Split into In-Network / Out-of-Network columns with copay, coinsurance, deductible applies, notes
- **standard**: Coverage Limit + Deductible columns (auto, home insurance)
- **life**: Same layout as standard but different default rows

Also includes:
- **Plan limits**: Editable deductible/OOP max values
- **In-network providers**: CRUD for doctors/facilities with name, specialty, phone, address

### 5.7 SubcategoryIcon Component — `components/items/SubcategoryIcon.tsx`

Config-driven icon component that replaces per-category icon switch statements. Maps subcategory keys to icon + color configurations.

```typescript
// Usage
<SubcategoryIcon subcategory="auto_insurance" category="insurance" size="md" />
```

- **`SUBCATEGORY_ICONS`**: Record mapping subcategory keys to `{ icon, bgColor, iconColor }`
- **`CATEGORY_DEFAULTS`**: Fallback icons per category when subcategory isn't found
- **`size` prop**: `"sm"` (32px) or `"md"` (48px)
- Used by `ItemCard` and `SubcategorySection` for consistent iconography

### 5.8 ReminderCard Component — `components/items/ReminderCard.tsx`

Reusable reminder display component with three variants for different contexts:

| Variant   | Used In              | Layout                                          |
| --------- | -------------------- | ----------------------------------------------- |
| `default` | Reminders page       | Full card with urgency colors, overdue badges   |
| `compact` | RemindersPanel       | Compact row with item name, days until, link    |
| `sidebar` | ItemPage RightSidebar| Border card with edit/delete buttons             |

Props: `reminder`, `variant`, `onEdit`, `onDelete`, `onClose`, `showItemLink`

### 5.9 Shared Format Utilities — `lib/format.ts`

Centralized formatting functions used across multiple components:

| Function        | Purpose                                     | Example                                |
| --------------- | ------------------------------------------- | -------------------------------------- |
| `humanize()`    | Replace underscores with spaces             | `"auto_insurance"` → `"auto insurance"` |
| `titleCase()`   | Humanize + capitalize words                 | `"auto_insurance"` → `"Auto Insurance"` |
| `formatDate()`  | ISO date to locale display                  | `"2025-01-15"` → `"Jan 15, 2025"`     |
| `getFieldValue()` | Get field from item's EAV fields         | `getFieldValue(item, "policy_number")` |
| `repeatLabel()` | Repeat frequency to human label             | `"quarterly"` → `"Every 3 months"`    |
| `REPEAT_OPTIONS`| Const array of repeat frequency options     | Used by reminder forms                 |

### 5.10 Other Key Components

| Component              | File                    | Description                                    |
| ---------------------- | ----------------------- | ---------------------------------------------- |
| `CategoryPage`         | `CategoryPage.tsx`      | Lists subcategories with item counts and cards  |
| `SubcategorySection`   | `SubcategorySection.tsx`| Accordion section for a subcategory             |
| `ItemFormDialog`       | `ItemFormDialog.tsx`    | Create/edit dialog with dynamic fields          |
| `FieldRenderer`        | `FieldRenderer.tsx`     | Renders field inputs by type (text/date/select) |
| `ProviderCombobox`     | `ProviderCombobox.tsx`  | Autocomplete dropdown for insurance providers   |
| `VisaFieldCombobox`    | `VisaFieldCombobox.tsx` | Autocomplete for visa types                     |
| `PersonSelector`       | `PersonSelector.tsx`    | Person picker from org people database          |
| `PassportSelector`     | `PassportSelector.tsx`  | Passport picker for visa linking                |
| `VehiclesSection`      | `VehiclesSection.tsx`   | Vehicle assignment for auto insurance items     |
| `ReminderEditDialog`   | `ReminderEditDialog.tsx`| Edit dialog for existing custom reminders       |
| `FileUploader`         | `FileUploader.tsx`      | Drag-and-drop file upload zone                  |
| `FileList`             | `FileList.tsx`          | List of file attachments with download/delete   |
| `Sidebar`              | `Sidebar.tsx`           | Left navigation with category links             |
| `Header`               | `Header.tsx`            | Top bar with search and user menu               |
| `RemindersPanel`       | `RemindersPanel.tsx`    | Slide-out panel showing upcoming reminders      |

---

## 6. Database Schema

### Entity-Relationship Diagram

```
users ─────────────┐
  │                 │
  │ (1:N)           │ (1:N)
  ▼                 ▼
sessions        org_memberships ──── organizations
                                        │
                    ┌───────────────────┤
                    │ (1:N)             │ (1:N)
                    ▼                   ▼
                  items            (encryption key)
                    │
      ┌─────────────┼──────────────┬──────────────────┐
      │ (1:N)       │ (1:N)        │ (1:N)            │ (1:N)
      ▼             ▼              ▼                  ▼
item_field_values  file_attachments  custom_reminders  item_contacts
                                                       │
                                     ┌─────────────────┤
                                     │ (1:N)           │ (1:N)
                                     ▼                 │
                               coverage_rows           │
                               coverage_plan_limits    │
                               in_network_providers    │
```

### Table Details

#### `users`
| Column        | Type         | Notes                          |
| ------------- | ------------ | ------------------------------ |
| id            | VARCHAR(36)  | PK, UUID                       |
| email         | VARCHAR(255) | Unique, indexed                |
| password_hash | VARCHAR(255) | bcrypt hash                    |
| full_name     | VARCHAR(255) |                                |
| created_at    | TIMESTAMPTZ  | server_default=now()           |
| updated_at    | TIMESTAMPTZ  | server_default=now(), onupdate |

#### `sessions`
| Column     | Type         | Notes                    |
| ---------- | ------------ | ------------------------ |
| id         | VARCHAR(36)  | PK, UUID                 |
| user_id    | VARCHAR(36)  | FK → users.id            |
| token      | VARCHAR(64)  | Unique, indexed          |
| expires_at | TIMESTAMPTZ  | Token expiration time    |
| created_at | TIMESTAMPTZ  |                          |

#### `organizations`
| Column             | Type         | Notes                                  |
| ------------------ | ------------ | -------------------------------------- |
| id                 | VARCHAR(36)  | PK, UUID                               |
| name               | VARCHAR(255) |                                        |
| encryption_key_enc | TEXT         | Org AES key, encrypted with master key |
| created_by         | VARCHAR(36)  | FK → users.id                          |
| created_at         | TIMESTAMPTZ  |                                        |
| updated_at         | TIMESTAMPTZ  |                                        |

#### `org_memberships`
| Column     | Type         | Notes                              |
| ---------- | ------------ | ---------------------------------- |
| id         | VARCHAR(36)  | PK, UUID                           |
| org_id     | VARCHAR(36)  | FK → organizations.id              |
| user_id    | VARCHAR(36)  | FK → users.id                      |
| role       | VARCHAR(20)  | `owner` or `member`                |
| created_at | TIMESTAMPTZ  |                                    |
| **UQ**     |              | `(org_id, user_id)` unique together|

#### `items`
| Column      | Type         | Notes                       |
| ----------- | ------------ | --------------------------- |
| id          | VARCHAR(36)  | PK, UUID                    |
| org_id      | VARCHAR(36)  | FK → organizations.id       |
| created_by  | VARCHAR(36)  | FK → users.id               |
| category    | VARCHAR(50)  | `ids`, `insurance`, `business` |
| subcategory | VARCHAR(50)  | e.g. `health_insurance`     |
| name        | VARCHAR(255) | User-given name             |
| notes       | TEXT         | Nullable                    |
| is_archived | BOOLEAN      | Soft delete flag            |
| created_at  | TIMESTAMPTZ  |                             |
| updated_at  | TIMESTAMPTZ  |                             |

#### `item_field_values` (EAV)
| Column      | Type         | Notes                                  |
| ----------- | ------------ | -------------------------------------- |
| id          | VARCHAR(36)  | PK, UUID                               |
| item_id     | VARCHAR(36)  | FK → items.id (CASCADE)                |
| field_key   | VARCHAR(100) | e.g. `policy_number`, `provider`       |
| field_value | TEXT         | The stored value (always a string)     |
| field_type  | VARCHAR(20)  | `text`, `date`, `number`, etc.         |
| **UQ**      |              | `(item_id, field_key)` unique together |

#### `file_attachments`
| Column         | Type         | Notes                                |
| -------------- | ------------ | ------------------------------------ |
| id             | VARCHAR(36)  | PK, UUID                             |
| item_id        | VARCHAR(36)  | FK → items.id (CASCADE)              |
| uploaded_by    | VARCHAR(36)  | FK → users.id                        |
| file_name      | VARCHAR(255) | Original filename                    |
| storage_key    | VARCHAR(500) | MinIO object key (path)              |
| file_size      | INTEGER      | Original (unencrypted) file size     |
| mime_type      | VARCHAR(100) | e.g. `image/jpeg`, `application/pdf` |
| purpose        | VARCHAR(50)  | e.g. `front_image`, `policy_document`|
| encryption_iv  | VARCHAR(32)  | Base64-encoded AES-GCM IV (12 bytes) |
| encryption_tag | VARCHAR(32)  | Base64-encoded AES-GCM tag (16 bytes)|
| created_at     | TIMESTAMPTZ  |                                      |

#### `custom_reminders`
| Column     | Type         | Notes                                     |
| ---------- | ------------ | ----------------------------------------- |
| id         | VARCHAR(36)  | PK, UUID                                  |
| item_id    | VARCHAR(36)  | FK → items.id (CASCADE)                   |
| org_id     | VARCHAR(36)  | FK → organizations.id (CASCADE)           |
| created_by | VARCHAR(36)  | FK → users.id                             |
| title      | VARCHAR(255) | Reminder title                            |
| remind_date| DATE         | When to remind                            |
| note       | TEXT         | Optional note                             |
| repeat     | VARCHAR(20)  | `none`, `weekly`, `monthly`, `quarterly`, `yearly` |
| email_sent | BOOLEAN      | Whether email notification was sent       |
| created_at | TIMESTAMPTZ  |                                           |

#### `item_contacts`
| Column        | Type         | Notes                                |
| ------------- | ------------ | ------------------------------------ |
| id            | VARCHAR(36)  | PK, UUID                             |
| item_id       | VARCHAR(36)  | FK → items.id (CASCADE)              |
| org_id        | VARCHAR(36)  | FK → organizations.id (CASCADE)      |
| label         | VARCHAR(100) | e.g. "Customer Care", "Claims Dept"  |
| value         | VARCHAR(255) | Phone/email/url, or composed address |
| contact_type  | VARCHAR(20)  | `phone`, `email`, `url`, `address`   |
| sort_order    | INTEGER      | For drag-and-drop ordering           |
| address_line1 | VARCHAR(255) | Structured address (nullable)        |
| address_line2 | VARCHAR(255) | Structured address (nullable)        |
| address_city  | VARCHAR(100) | Structured address (nullable)        |
| address_state | VARCHAR(100) | Structured address (nullable)        |
| address_zip   | VARCHAR(20)  | Structured address (nullable)        |
| created_at    | TIMESTAMPTZ  |                                      |

#### `coverage_rows`
| Column                 | Type         | Notes                           |
| ---------------------- | ------------ | ------------------------------- |
| id                     | VARCHAR(36)  | PK, UUID                        |
| item_id                | VARCHAR(36)  | FK → items.id (CASCADE)         |
| org_id                 | VARCHAR(36)  | FK → organizations.id (CASCADE) |
| service_key            | VARCHAR(100) | e.g. `pcp_visit`, `collision`   |
| service_label          | VARCHAR(200) | Display label                   |
| sort_order             | INTEGER      |                                 |
| in_copay               | VARCHAR(50)  | Health: in-network copay        |
| in_coinsurance         | VARCHAR(50)  | Health: in-network coinsurance  |
| in_deductible_applies  | VARCHAR(10)  | Health: `yes`/`no`              |
| in_notes               | TEXT         | Health: in-network notes        |
| out_copay              | VARCHAR(50)  | Health: out-of-network copay    |
| out_coinsurance        | VARCHAR(50)  | Health: OON coinsurance         |
| out_deductible_applies | VARCHAR(10)  | Health: OON deductible          |
| out_notes              | TEXT         | Health: OON notes               |
| coverage_limit         | VARCHAR(100) | Standard: limit amount          |
| deductible             | VARCHAR(100) | Standard: deductible amount     |
| notes                  | TEXT         | Standard: general notes         |
| created_at             | TIMESTAMPTZ  |                                 |
| updated_at             | TIMESTAMPTZ  |                                 |

#### `coverage_plan_limits`
| Column      | Type         | Notes                              |
| ----------- | ------------ | ---------------------------------- |
| id          | VARCHAR(36)  | PK, UUID                           |
| item_id     | VARCHAR(36)  | FK → items.id (CASCADE)            |
| org_id      | VARCHAR(36)  | FK → organizations.id (CASCADE)    |
| limit_key   | VARCHAR(100) | e.g. `deductible_individual_in`    |
| limit_label | VARCHAR(200) | e.g. "Individual Deductible"       |
| limit_value | VARCHAR(100) | e.g. "$1,500"                      |
| sort_order  | INTEGER      |                                    |
| created_at  | TIMESTAMPTZ  |                                    |
| updated_at  | TIMESTAMPTZ  |                                    |

#### `in_network_providers`
| Column        | Type         | Notes                          |
| ------------- | ------------ | ------------------------------ |
| id            | VARCHAR(36)  | PK, UUID                       |
| item_id       | VARCHAR(36)  | FK → items.id (CASCADE)        |
| org_id        | VARCHAR(36)  | FK → organizations.id (CASCADE)|
| provider_name | VARCHAR(255) | Doctor/facility name           |
| specialty     | VARCHAR(100) | e.g. "Primary Care"           |
| phone         | VARCHAR(50)  | Contact phone                  |
| address       | TEXT         | Office address                 |
| network_tier  | VARCHAR(50)  | e.g. "Tier 1"                 |
| notes         | TEXT         | Additional notes               |
| created_at    | TIMESTAMPTZ  |                                |

#### `vehicles`
| Column        | Type         | Notes                                |
| ------------- | ------------ | ------------------------------------ |
| id            | VARCHAR(36)  | PK, UUID                             |
| org_id        | VARCHAR(36)  | FK → organizations.id (CASCADE)      |
| name          | VARCHAR(100) | e.g. "2020 Toyota Camry"            |
| year          | INTEGER      | Vehicle year (nullable)              |
| make          | VARCHAR(100) | Vehicle make (nullable)              |
| model         | VARCHAR(100) | Vehicle model (nullable)             |
| license_plate | VARCHAR(20)  | Nullable                             |
| vin           | VARCHAR(17)  | Nullable                             |
| created_at    | TIMESTAMPTZ  |                                      |
| updated_at    | TIMESTAMPTZ  |                                      |

#### `item_vehicles`
| Column     | Type         | Notes                                     |
| ---------- | ------------ | ----------------------------------------- |
| id         | VARCHAR(36)  | PK, UUID                                  |
| item_id    | VARCHAR(36)  | FK → items.id (CASCADE)                   |
| vehicle_id | VARCHAR(36)  | FK → vehicles.id (CASCADE)                |
| org_id     | VARCHAR(36)  | FK → organizations.id (CASCADE)           |
| created_at | TIMESTAMPTZ  |                                           |
| **UQ**     |              | `(item_id, vehicle_id)` unique together   |

#### `people`
| Column       | Type         | Notes                               |
| ------------ | ------------ | ----------------------------------- |
| id           | VARCHAR(36)  | PK, UUID                            |
| org_id       | VARCHAR(36)  | FK → organizations.id (CASCADE)     |
| first_name   | VARCHAR(100) | NOT NULL                            |
| last_name    | VARCHAR(100) | NOT NULL                            |
| email        | VARCHAR(255) | Nullable                            |
| phone        | VARCHAR(50)  | Nullable                            |
| relationship | VARCHAR(100) | e.g. "Spouse", "Child" (nullable)   |
| created_at   | TIMESTAMPTZ  |                                     |
| updated_at   | TIMESTAMPTZ  |                                     |

---

## 7. API Reference

Base URL: `http://localhost:8000/api`

All endpoints (except auth) require `Authorization: Bearer <token>` header.

### Auth

| Method | Path                | Body                                   | Response          |
| ------ | ------------------- | -------------------------------------- | ----------------- |
| POST   | `/auth/register`    | `{email, password, full_name}`         | `{token, user}`   |
| POST   | `/auth/login`       | `{email, password}`                    | `{token, user}`   |
| POST   | `/auth/logout`      | —                                      | 204               |
| GET    | `/auth/me`          | —                                      | `UserResponse`    |

### Categories

| Method | Path                 | Query    | Response                    |
| ------ | -------------------- | -------- | --------------------------- |
| GET    | `/categories`        | —        | `CategoryListItem[]`        |
| GET    | `/categories/{slug}` | —        | `CategoryResponse` (+ subs) |

### Items

| Method | Path             | Body/Query                   | Response           |
| ------ | ---------------- | ---------------------------- | ------------------ |
| GET    | `/items`         | `?category&subcategory&page` | `ItemListResponse` |
| POST   | `/items`         | `ItemCreate`                 | `ItemResponse`     |
| GET    | `/items/{id}`    | —                            | `ItemResponse`     |
| PUT    | `/items/{id}`    | `ItemUpdate`                 | `ItemResponse`     |
| DELETE | `/items/{id}`    | —                            | 204 (soft delete)  |

### Files

| Method | Path               | Body                        | Response             |
| ------ | ------------------ | --------------------------- | -------------------- |
| POST   | `/files/upload`    | multipart: file, item_id    | `FileUploadResponse` |
| GET    | `/files/{id}`      | —                           | Binary (decrypted)   |
| DELETE | `/files/{id}`      | —                           | 204                  |

### Reminders

| Method | Path                       | Body/Query           | Response      |
| ------ | -------------------------- | -------------------- | ------------- |
| GET    | `/reminders`               | —                    | `Reminder[]`  |
| GET    | `/reminders/overdue`       | —                    | `Reminder[]`  |
| GET    | `/reminders/custom`        | `?item_id`           | `Reminder[]`  |
| POST   | `/reminders/custom`        | `CustomReminderCreate` | `Reminder`  |
| DELETE | `/reminders/custom/{id}`   | —                    | 204           |

### Contacts

| Method | Path                     | Body/Query              | Response          |
| ------ | ------------------------ | ----------------------- | ----------------- |
| GET    | `/contacts`              | `?item_id`              | `ItemContact[]`   |
| POST   | `/contacts`              | `ItemContactCreate`     | `ItemContact`     |
| PUT    | `/contacts/reorder`      | `ContactReorderRequest` | `{ok: true}`      |
| PATCH  | `/contacts/{id}`         | `ItemContactUpdate`     | `ItemContact`     |
| DELETE | `/contacts/{id}`         | —                       | 204               |

### Coverage

| Method | Path                      | Body/Query                 | Response                |
| ------ | ------------------------- | -------------------------- | ----------------------- |
| GET    | `/coverage/rows`          | `?item_id`                 | `CoverageRow[]`         |
| PUT    | `/coverage/rows`          | `{item_id, rows[]}`        | `CoverageRow[]`         |
| GET    | `/coverage/limits`        | `?item_id`                 | `PlanLimit[]`           |
| PUT    | `/coverage/limits`        | `{item_id, limits[]}`      | `PlanLimit[]`           |
| GET    | `/coverage/providers`     | `?item_id`                 | `InNetworkProvider[]`   |
| POST   | `/coverage/providers`     | `InNetworkProviderCreate`  | `InNetworkProvider`     |
| DELETE | `/coverage/providers/{id}`| —                          | 204                     |

### Vehicles

| Method | Path                                     | Body/Query              | Response         |
| ------ | ---------------------------------------- | ----------------------- | ---------------- |
| GET    | `/vehicles`                              | —                       | `Vehicle[]`      |
| POST   | `/vehicles`                              | `VehicleCreate`         | `Vehicle`        |
| PATCH  | `/vehicles/{id}`                         | `VehicleUpdate`         | `Vehicle`        |
| DELETE | `/vehicles/{id}`                         | —                       | 204              |
| GET    | `/vehicles/item/{item_id}`               | —                       | `Vehicle[]`      |
| POST   | `/vehicles/item/{item_id}`               | `{vehicle_id}`          | `{ok: true}`     |
| DELETE | `/vehicles/item/{item_id}/{vehicle_id}`  | —                       | 204              |

### People

| Method | Path            | Body/Query      | Response    |
| ------ | --------------- | --------------- | ----------- |
| GET    | `/people`       | —               | `Person[]`  |
| POST   | `/people`       | `PersonCreate`  | `Person`    |
| PATCH  | `/people/{id}`  | `PersonUpdate`  | `Person`    |
| DELETE | `/people/{id}`  | —               | 204         |

### Visas

| Method | Path                          | Query | Response              |
| ------ | ----------------------------- | ----- | --------------------- |
| GET    | `/visas/types`                | `?q`  | `string[]`            |
| GET    | `/visas/contacts/{country}`   | —     | `CountryContacts`     |

### Providers

| Method | Path                               | Query | Response                   |
| ------ | ---------------------------------- | ----- | -------------------------- |
| GET    | `/providers/insurance`             | `?q`  | `{providers: string[]}`   |
| GET    | `/providers/insurance/{name}/details`| —   | `ProviderDetails`          |

### Search

| Method | Path       | Query | Response           |
| ------ | ---------- | ----- | ------------------ |
| GET    | `/search`  | `?q`  | `ItemListResponse` |

### Dashboard

| Method | Path          | Response                                |
| ------ | ------------- | --------------------------------------- |
| GET    | `/dashboard`  | `{categories, recentItems, reminders}`  |

### Health Check

| Method | Path          | Response         |
| ------ | ------------- | ---------------- |
| GET    | `/api/health` | `{status: "ok"}` |

---

## 8. Security & Encryption

### Envelope Encryption Architecture

```
SECRET_KEY (env var)
    │
    ├─ HKDF (SHA-256, salt, info)
    │
    ▼
Master Key (256-bit, derived)
    │
    ├─ AES-256-GCM encrypt/decrypt
    │
    ▼
Org Key (256-bit, random per-org)
    │  Stored encrypted in organizations.encryption_key_enc
    │
    ├─ AES-256-GCM encrypt/decrypt
    │
    ▼
File Data (encrypted before MinIO upload)
```

1. **Master key derivation**: `SECRET_KEY` → HKDF (SHA-256, hardcoded salt + info strings) → 256-bit master key
2. **Org key generation**: Random 256-bit key generated per organization via `os.urandom(32)`
3. **Org key storage**: Org key is encrypted with master key using AES-256-GCM, stored as base64 in `organizations.encryption_key_enc`
4. **File encryption**: Each file is encrypted with the org key using AES-256-GCM. The 12-byte IV and 16-byte auth tag are stored in the `file_attachments` table. The ciphertext + tag are stored together in MinIO.

### Auth Security

- **Passwords**: Hashed with bcrypt (auto-salted)
- **Session tokens**: 64-character random hex strings (`secrets.token_hex(32)`)
- **Session expiry**: 72 hours (configurable via `SESSION_EXPIRY_HOURS`)
- **Token validation**: On every API request via `get_current_user()` dependency
- **Logout**: Deletes the session row from the database

### File Upload Security

- **Allowed MIME types**: `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- **Max file size**: 25 MB
- **Storage path**: `{org_id}/{item_id}/{purpose}_{uuid}.{ext}.enc` — org-scoped, item-scoped, randomized filename

---

## 9. Category & Field System

### How Categories Work

Categories are defined in Python code (`backend/app/categories/definitions.py`), not in the database. This makes them immutable and predictable.

```python
CATEGORIES = {
    "ids": {
        "label": "Family IDs",
        "subcategories": {
            "drivers_license": {
                "fields": [
                    {"key": "full_name", "label": "Full Name", "type": "text", "required": True},
                    {"key": "expiration_date", "label": "Expiration Date", "type": "date", "required": True},
                    ...
                ],
                "file_slots": ["front_image", "back_image"],
            },
        },
    },
}
```

### Field Types

| Type       | Input Rendered           | Storage                  | Notes                                    |
| ---------- | ------------------------ | ------------------------ | ---------------------------------------- |
| `text`     | `<input type="text">`    | String in field_value    | Standard text field                      |
| `date`     | `<input type="date">`    | `YYYY-MM-DD` string     | Triggers auto-reminders if key matches   |
| `number`   | `<input type="number">`  | Numeric string           | Displayed with formatting                |
| `textarea` | `<textarea>`             | String in field_value    | Multi-line text                          |
| `provider` | `ProviderCombobox`       | Provider name string     | Autocomplete from INSURANCE_PROVIDERS    |
| `select`   | `<select>` dropdown      | Selected value string    | Options from `FieldDefinition.options[]` |

### Reminder Trigger Fields

Fields with keys in `REMINDER_FIELD_KEYS = {"expiration_date", "end_date"}` automatically generate reminders when the date is within 90 days.

### Field Groups

Some subcategories use `field_groups` to organize fields into visually separate cards:

```python
"llc": {
    "field_groups": [
        {
            "label": "Business Details",
            "fields": [
                {"key": "business_name", ...},
                {"key": "ein", ...},
            ]
        },
        {
            "label": "Business Address",
            "fields": [
                {"key": "business_address_line1", ...},
                {"key": "business_city", ...},
            ]
        }
    ],
    "file_slots": [...]
}
```

When `field_groups` is present, the frontend renders each group in its own white card. When absent, all fields appear in a single card (the default flat `fields` array).

### Adding a New Category

1. Add the category + subcategories to `CATEGORIES` in `definitions.py`
2. Add the subcategory icon in `SubcategoryIcon.tsx` (`SUBCATEGORY_ICONS` map)
3. If it has insurance-like coverage, add to `COVERAGE_DEFINITIONS`
4. Create frontend route pages under `frontend/src/app/(app)/{slug}/`
5. Add the sidebar link in `Sidebar.tsx`

---

## 10. Coverage System (Insurance)

The coverage system provides detailed insurance plan tracking. It is only available for insurance subcategories.

### Coverage Layouts

| Layout     | Used By                     | Columns                                           |
| ---------- | --------------------------- | -------------------------------------------------- |
| `health`   | Health Insurance            | In-Network (copay, coinsurance, ded, notes) + Out-of-Network (same) |
| `standard` | Auto, Home, Business Ins.   | Coverage Limit + Deductible + Notes                |
| `life`     | Life Insurance              | Same as standard, different default rows           |

### How It Works

1. When a user opens an insurance item's Coverage tab, the frontend fetches coverage definition from the category API
2. If no saved rows exist, default rows from `COVERAGE_DEFINITIONS` are pre-populated
3. User edits values inline — changes are saved via PUT `/api/coverage/rows` (bulk upsert: deletes all + re-creates)
4. Plan limits (deductibles, OOP max) are managed separately via `/api/coverage/limits`
5. In-network providers (doctors, facilities) are managed via `/api/coverage/providers`

---

## 11. Contacts System

Linked contacts are displayed in the RightSidebar of the item page.

### Contact Types

| Type      | Value Field                     | Additional Fields            |
| --------- | ------------------------------- | ---------------------------- |
| `phone`   | Phone number string             | —                            |
| `email`   | Email address string            | —                            |
| `url`     | URL string                      | —                            |
| `address` | Auto-composed from parts        | line1, line2, city, state, zip |

### Address Handling

When `contact_type = "address"`:
- Frontend renders 5 input fields (AddressInput component)
- Backend stores structured fields in dedicated columns (`address_line1`..`address_zip`)
- Backend auto-composes `value` from parts: `"123 Main St, Apt 4, Springfield, IL 62701"`
- Frontend's `formatAddressLines()` reads structured fields first, falls back to `value` for legacy/provider-populated data

### Provider Auto-Populate

When a user selects an insurance provider (e.g., "Aetna"):
1. Frontend fetches `GET /api/providers/insurance/Aetna/details`
2. Response includes `contacts[]` with pre-defined phone numbers
3. Frontend auto-creates linked contacts for the item (Customer Care, TTY, Prior Auth, etc.)
4. If `claims_address` exists, it's added as an address-type contact

### Reordering

Contacts support drag-and-drop reordering via `PUT /api/contacts/reorder` with an array of `{id, sort_order}` pairs.

---

## 12. Reminders System

### Auto-Detected Reminders

Items with `expiration_date` or `end_date` fields automatically appear in the reminders list when within 90 days. These are **computed on the fly** (not stored) by scanning `ItemFieldValue` records.

### Custom Reminders

Users can create custom reminders on any item with:
- **Title**: What to be reminded about
- **Date**: When to remind
- **Note**: Optional details
- **Repeat**: `none`, `weekly`, `monthly`, `quarterly`, `yearly`

### Email Notifications

If SMTP is configured, the backend sends email notifications for due reminders:
1. APScheduler runs `check_due_reminders()` every hour
2. Finds custom reminders where `remind_date <= today` and `email_sent == False`
3. Sends HTML email to all organization members
4. Sets `email_sent = True`

### UI

- **RemindersPanel** (Sidebar): Slide-out panel showing all upcoming reminders (auto + custom), sorted by days until due
- **RightSidebar** (Item page): Shows custom reminders for the current item with create/delete controls
- **Reminders page** (`/reminders`): Full-page view of all reminders

---

## 13. Vehicles System

Org-wide vehicle database for tracking cars across auto insurance policies.

### Architecture

- **Vehicles** are org-scoped (shared across all items)
- **Item-Vehicle links** are many-to-many via `item_vehicles` junction table
- The same vehicle can be assigned to multiple auto insurance items
- Deleting a vehicle cascades to all `item_vehicles` links

### Frontend Integration

`VehiclesSection` renders in the Overview tab only when `subcategory === "auto_insurance"`. It provides:
- List of assigned vehicles with name, plate, and VIN
- "+ Add" button with two options: create new or assign existing
- Inline edit (pencil icon) for vehicle details
- Remove (X) unassigns from item without deleting the org vehicle

---

## 14. People System

Org-wide people database for linking individuals to items.

### Architecture

- **People** are org-scoped (e.g., family members)
- People can be referenced from items via `PersonSelector` (e.g., the insured person, ID holder)
- Fields: `first_name`, `last_name`, `email`, `phone`, `relationship`

### Frontend Integration

`PersonSelector` is a combobox that lists org people and allows creating new ones inline. Used in field definitions where `type: "person"` would be appropriate (linked from item fields).

---

## 15. Visa System

Visa management for the Family IDs category.

### Architecture

- `visa` is a subcategory under `ids` with specialized fields: visa_type, country, entry_type, issue_date, expiration_date
- `PassportSelector` links a visa to an existing passport item
- `VisaFieldCombobox` provides autocomplete for visa types (B-1, F-1, H-1B, etc.)
- Country-specific embassy/consulate contacts are served from `backend/app/visas/data.py`

### Country Contacts

When a country is selected, the frontend can fetch embassy contacts via `/api/visas/contacts/{country}`. This auto-populates linked contacts on the item.

---

## 16. Image Editor & Auto-Detect

### Features

- **Crop**: Click-and-drag or pinch-to-zoom crop area (powered by `react-easy-crop`)
- **Rotate**: 90° increment rotation buttons
- **Auto-Detect**: Automatically finds the card/document rectangle in a photo
- **Save**: Exports the cropped/rotated result as a JPEG blob and replaces the original file

### Auto-Detect Algorithm (`detectCardBounds`)

Located in `frontend/src/lib/image-utils.ts`.

```
Photo of card on desk
         │
         ▼
1. Downscale to max 400px (performance)
         │
         ▼
2. Grayscale conversion (weighted: 0.299R + 0.587G + 0.114B)
         │
         ▼
3. Double Gaussian blur (5×5 kernel, σ ≈ 1.4)
   Suppresses texture noise (carpet, wood grain, text on card)
         │
         ▼
4. Sobel edge detection (3×3 gradient magnitude)
   Highlights strong boundaries (card edges)
         │
         ▼
5. Integral image (summed area table)
   Enables O(1) rectangle-sum queries for scoring
         │
         ▼
6. Coarse scan: Test candidate rectangles (step=6px)
   Score = f(border edge strength, aspect ratio, size, edge distance)
   Key: ALL 4 sides must have strong edges (min-side emphasis)
         │
         ▼
7. Fine scan: Refine top 30 candidates (step=1px)
         │
         ▼
8. Apply inward margin (1% of min dimension)
         │
         ▼
9. Scale back to original image coordinates
         │
         ▼
10. Transform for current rotation (0°/90°/180°/270°)
```

### Scoring Function

```
score = edgeScore × arBonus × sizeBonus × edgePenalty × minSide
```

- **edgeScore**: 0.6 × min(4 sides) + 0.4 × avg(4 sides) — ensures all 4 borders have edges
- **arBonus**: 1.5× for credit-card-like aspect ratios (1.3–2.0), 1.2× for 1.0–2.5
- **sizeBonus**: Mild preference for larger rectangles: `(area/imageArea)^0.15`
- **edgePenalty**: 0.2× if touching image edge, 0.6× if within 2px

### Debug Mode

Set `NEXT_PUBLIC_DEBUG_DETECT=true` in docker-compose.yml to show a debug panel in the image editor with:
- Blurred grayscale image
- Sobel edge magnitude map
- Result overlay with detected rectangle highlighted in green

---

## 17. Provider Data

### Insurance Providers List

`backend/app/providers/data.py` contains:

- **`INSURANCE_PROVIDERS`**: 150+ US insurance company names (sourced from NAIC market share data)
  - Used by `ProviderCombobox` autocomplete on the frontend
  - Searched via `GET /api/providers/insurance?q=<query>`

- **`PROVIDER_DETAILS`**: Contact info for 18 major providers including:
  - `portal_url`: Website URL
  - `claims_address`: Mailing address for claims
  - `contacts[]`: Array of phone numbers with labels (Customer Care, TTY, Prior Auth, Pharmacy)

### Supported Providers with Details

Aetna, Anthem, Blue Cross Blue Shield, Cigna, Humana, Kaiser Permanente, United Healthcare, TRICARE, MetLife, Guardian Life, Delta Dental, State Farm, GEICO, Progressive, Allstate, USAA, Liberty Mutual, Nationwide

---

## 18. Shared Utilities & Reusable Components

### Backend: Shared Org Helpers (`orgs/service.py`)

All routers need the active org ID for scoping queries. Instead of duplicating a `_get_active_org_id()` helper in each router, two shared functions are provided:

```python
from app.orgs.service import get_active_org, get_active_org_id

# In any router:
@router.get("/items")
def list_items(user = Depends(get_current_user), db = Depends(get_db)):
    org_id = get_active_org_id(user, db)  # Returns str
    # ... org-scoped query
```

- **`get_active_org(user, db)`** — Returns the full `Organization` object. Used by `files/router.py` which needs the encryption key.
- **`get_active_org_id(user, db)`** — Returns just the org ID string. Used by all other routers.

### Frontend: `lib/format.ts`

Centralized formatting utilities extracted from duplicated code across components. See [Section 5.9](#59-shared-format-utilities--libformatts) for the full API.

### Frontend: `SubcategoryIcon` Component

Config-driven icon component replacing 3 duplicated switch-statement functions. See [Section 5.7](#57-subcategoryicon-component--componentsitemssubcategoryicontsx).

### Frontend: `ReminderCard` Component

Reusable reminder display with 3 variants for consistent rendering. See [Section 5.8](#58-remindercard-component--componentsitemsremindercardtsx).

### Design Principles

1. **Extract shared helpers when >2 modules duplicate the same logic** (e.g., `get_active_org_id`)
2. **Use config-driven components over switch statements** (e.g., `SubcategoryIcon` over `ProviderLogo`/`IDIcon`/`BusinessIcon`)
3. **Create variant-based components for reuse across contexts** (e.g., `ReminderCard` with `default`/`compact`/`sidebar` variants)
4. **Centralize formatting in `lib/format.ts`** — avoid per-component `formatDate()`, `humanize()`, etc.

---

## 19. Environment Variables

Copy `.env.example` to `.env` and customize:

| Variable           | Required | Default                       | Description                              |
| ------------------ | -------- | ----------------------------- | ---------------------------------------- |
| `SECRET_KEY`       | **Yes**  | `change-me-in-production`     | Master encryption key seed (change this!)|
| `POSTGRES_HOST`    | No       | `postgres`                    | Database host                            |
| `POSTGRES_PORT`    | No       | `5432`                        | Database port                            |
| `POSTGRES_USER`    | No       | `familyvault`                 | Database user                            |
| `POSTGRES_PASSWORD`| No       | `familyvault`                 | Database password                        |
| `POSTGRES_DB`      | No       | `familyvault`                 | Database name                            |
| `S3_ENDPOINT_URL`  | No       | `http://minio:9000`           | MinIO/S3 endpoint                        |
| `S3_ACCESS_KEY`    | No       | `minioadmin`                  | MinIO access key                         |
| `S3_SECRET_KEY`    | No       | `minioadmin`                  | MinIO secret key                         |
| `S3_BUCKET`        | No       | `familyvault`                 | S3 bucket name                           |
| `S3_REGION`        | No       | `us-east-1`                   | S3 region                                |
| `API_URL`          | No       | `http://localhost:8000/api`   | Frontend API base URL (build-time)       |
| `CORS_ORIGINS`     | No       | `["http://localhost:3000"]`   | Allowed CORS origins (JSON array)        |
| `SMTP_HOST`        | No       | (empty = disabled)            | SMTP server for email reminders          |
| `SMTP_PORT`        | No       | `587`                         | SMTP port                                |
| `SMTP_USER`        | No       | (empty)                       | SMTP username                            |
| `SMTP_PASSWORD`    | No       | (empty)                       | SMTP password                            |
| `SMTP_FROM`        | No       | `noreply@familyvault.local`   | Email sender address                     |
| `SMTP_USE_TLS`     | No       | `true`                        | Use STARTTLS for SMTP                    |

---

## 20. Docker & Deployment

### Services

| Service    | Image              | Port | Depends On        | Healthcheck         |
| ---------- | ------------------ | ---- | ----------------- | ------------------- |
| `postgres` | postgres:17-alpine | 5432 | —                 | `pg_isready`        |
| `minio`    | minio/minio:latest | 9000, 9001 | —           | `curl /minio/health`|
| `backend`  | ./backend          | 8000 | postgres (healthy)| —                   |
| `frontend` | ./frontend         | 3000 | backend           | —                   |

### Backend Dockerfile

```dockerfile
FROM python:3.13-slim
# Install libpq-dev for psycopg2
# pip install requirements.txt
# CMD: alembic upgrade head && python -m app.seed && uvicorn app.main:app
```

**Startup sequence**: Run migrations → Seed demo user → Start Uvicorn

### Frontend Dockerfile

```dockerfile
# Stage 1: Build with Node 22
FROM node:22-alpine AS builder
# npm ci && npm run build (with NEXT_PUBLIC_API_URL build arg)

# Stage 2: Standalone runner
FROM node:22-alpine AS runner
# Copy .next/standalone + static + public
# CMD: node server.js
```

Uses Next.js standalone output mode for minimal production image.

### Common Commands

```bash
# Build and start all services
docker compose up -d --build

# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Restart a single service
docker compose restart backend

# Run a migration manually
docker compose exec backend alembic upgrade head

# Access PostgreSQL
docker compose exec postgres psql -U familyvault

# Access MinIO console
# Open http://localhost:9001 (minioadmin / minioadmin)

# Full rebuild (nuclear option)
docker compose down -v && docker compose up -d --build
```

### Volumes

| Volume          | Purpose                              |
| --------------- | ------------------------------------ |
| `postgres_data` | PostgreSQL data directory             |
| `minio_data`    | MinIO object storage                  |

**Warning**: `docker compose down -v` destroys both volumes (all data + files).

---

## 21. Migrations

Migrations are managed by Alembic. They run automatically on backend startup via `alembic upgrade head`.

| Migration | File                                 | Description                                |
| --------- | ------------------------------------ | ------------------------------------------ |
| 001       | `001_initial_schema.py`              | users, sessions, organizations, org_memberships, items, item_field_values, file_attachments |
| 002       | `002_custom_reminders.py`            | custom_reminders table                     |
| 003       | `003_add_repeat_to_reminders.py`     | Add `repeat` column to custom_reminders    |
| 004       | `004_item_contacts.py`               | item_contacts table                        |
| 005       | `005_coverage_tables.py`             | coverage_rows, coverage_plan_limits, in_network_providers |
| 006       | `006_contacts_sort_order.py`         | Add `sort_order` column to item_contacts   |
| 007       | `007_structured_address_fields.py`   | Add address_line1..address_zip to item_contacts |
| 008       | `008_vehicles.py`                    | vehicles, item_vehicles tables             |
| 009       | `009_rename_home_insurance.py`       | Rename home insurance subcategory keys     |
| 010       | `010_people.py`                      | people table                               |
| 011       | `011_vehicle_fields.py`              | Add year, make, model to vehicles          |
| 012       | `012_encrypt_sensitive_fields.py`    | Encrypt sensitive field values at rest     |
| 013       | `013_reminder_enhancements.py`       | Reminder system enhancements               |

### Creating a New Migration

```bash
# Generate a migration from model changes
docker compose exec backend alembic revision --autogenerate -m "description"

# Or create a manual migration
docker compose exec backend alembic revision -m "description"

# Apply migrations
docker compose exec backend alembic upgrade head

# Rollback one step
docker compose exec backend alembic downgrade -1
```

---

## 22. Troubleshooting & Lessons Learned

### Common Issues

| Problem                        | Solution                                                |
| ------------------------------ | ------------------------------------------------------- |
| Frontend shows stale data      | Rebuild: `docker compose up -d --build frontend`        |
| 401 on all API calls           | Token expired — log out and back in                     |
| MinIO bucket not found         | Backend creates bucket on first file operation          |
| Migration already applied      | `alembic stamp head` to mark current state              |
| Port conflict (5432/3000/8000) | Change ports in docker-compose.yml or stop conflicting services |

### Development Lessons

1. **Radix Tabs eat click events** — Keep interactive elements (buttons, inputs) outside of Radix Tabs components. If you must put them inside, they won't receive click events reliably.

2. **Always add `type="button"`** — All buttons inside `<form>` elements need `type="button"` to prevent accidental form submission on click.

3. **RightSidebar alignment** — Use `pt-[64px]` on the right sidebar container to align its content with the tab content card. This accounts for the tab list height + spacing.

4. **Provider details endpoint** — Use `/api/providers/insurance/{name}/details` (not just `/providers/{name}`).

5. **Contacts endpoint** — `/api/contacts` with CRUD operations. Query by `?item_id=`.

6. **Auto-save reads from refs** — The debounced auto-save timer reads from React refs (not state) to capture the most recent values, avoiding stale closure issues.

7. **Create mode queues locally** — When creating a new item, contacts and reminders are queued in local state. They're saved to the backend after the item is created and has an ID.

8. **EAV update strategy** — On item update, all `ItemFieldValue` rows are deleted and re-created (not merged). This simplifies the logic but means the frontend must send ALL field values on every save.

9. **Padding vs Margin for card spacing** — Use `mb-6` (margin) on the tab content wrapper, not `pb-12` (padding), because the visible boundary is the Card component inside. Padding inside the wrapper doesn't create visual space below the card.

10. **Structured address backward compatibility** — `formatAddressLines()` reads from backend address columns first, falls back to the single `value` field for legacy data or provider-auto-populated addresses.

---

*Last updated: February 2025*
*Built with Next.js 15, FastAPI, PostgreSQL, MinIO*

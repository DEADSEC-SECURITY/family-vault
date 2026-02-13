---
layout: default
title: Architecture
nav_order: 2
---

# Architecture Documentation

This document explains how Family Vault works under the hood.

## Table of Contents

- [System Overview](#system-overview)
- [Backend Architecture](#backend-architecture)
- [Frontend Architecture](#frontend-architecture)
- [Database Schema](#database-schema)
- [File Encryption](#file-encryption)
- [Authentication & Authorization](#authentication--authorization)
- [API Design](#api-design)
- [Deployment Architecture](#deployment-architecture)

## System Overview

Family Vault is a full-stack web application built with:

```
┌─────────────────────────────────────────────────────────────┐
│                         User Browser                        │
│                      (React/Next.js)                        │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS
                     │
┌────────────────────▼────────────────────────────────────────┐
│                      Frontend Service                        │
│                    Next.js 16 (Port 3000)                   │
│   • Server-side rendering                                   │
│   • Static page generation                                   │
│   • API route handling                                       │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP
                     │
┌────────────────────▼────────────────────────────────────────┐
│                      Backend Service                         │
│                   FastAPI (Port 8000)                       │
│   • RESTful API endpoints                                    │
│   • Business logic                                           │
│   • File encryption/decryption                               │
│   • Email notifications                                      │
└─────────┬──────────────────────────┬────────────────────────┘
          │                          │
          │ SQL                      │ S3 API
          │                          │
┌─────────▼────────────┐   ┌─────────▼────────────┐
│   PostgreSQL 17      │   │   MinIO (S3)        │
│   (Port 5432)        │   │   (Port 9000)       │
│   • User data        │   │   • Encrypted files │
│   • Items & fields   │   │   • Card images     │
│   • Metadata         │   │   • Documents       │
└──────────────────────┘   └─────────────────────┘
```

## Backend Architecture

### Project Structure

```
backend/
├── app/
│   ├── main.py                 # FastAPI app + lifespan + router includes
│   ├── config.py               # Pydantic settings (env vars)
│   ├── database.py             # SQLAlchemy engine + session
│   ├── dependencies.py         # Reusable dependencies (get_db, get_current_user)
│   │
│   ├── auth/                   # Authentication module
│   │   ├── models.py           # User, Session tables
│   │   ├── schemas.py          # Pydantic request/response models
│   │   ├── router.py           # /api/auth endpoints
│   │   └── service.py          # Password hashing, session management
│   │
│   ├── orgs/                   # Organizations module
│   │   ├── models.py           # Organization, OrgMembership
│   │   └── ...
│   │
│   ├── categories/             # Item categories (static definitions)
│   │   ├── definitions.py      # CATEGORIES dict with all fields
│   │   ├── router.py           # /api/categories endpoints
│   │   └── schemas.py
│   │
│   ├── items/                  # Main item CRUD
│   │   ├── models.py           # Item, ItemFieldValue (EAV pattern)
│   │   ├── router.py           # /api/items endpoints
│   │   ├── service.py          # Business logic + validation
│   │   └── schemas.py
│   │
│   ├── files/                  # File upload/download
│   │   ├── models.py           # FileAttachment
│   │   ├── router.py           # /api/files endpoints
│   │   ├── storage.py          # S3 client wrapper
│   │   └── encryption.py       # AES-256-GCM implementation
│   │
│   ├── reminders/              # Reminder system
│   │   ├── models.py           # CustomReminder
│   │   ├── service.py          # Query upcoming/overdue
│   │   └── router.py
│   │
│   ├── contacts/               # Linked contacts
│   ├── coverage/               # Insurance coverage
│   ├── vehicles/               # Vehicle database
│   ├── people/                 # People database
│   ├── providers/              # Insurance provider data
│   ├── visas/                  # Visa types & contacts database
│   ├── search/                 # Full-text search
│   ├── dashboard/              # Dashboard stats
│   ├── email/                  # SMTP email service
│   ├── audit/                  # Audit logging
│   ├── invitations/            # Org invitation management
│   ├── business_reminders/     # Business-specific reminders
│   ├── item_links/             # Parent-child item linking
│   └── saved_contacts/         # Reusable contact templates
│
└── alembic/                    # Database migrations
    ├── versions/               # Migration scripts
    └── env.py                  # Alembic config
```

### Key Design Patterns

#### 1. EAV (Entity-Attribute-Value) Pattern

Items use a flexible schema to avoid per-category tables:

```python
# Instead of separate tables for each item type:
# drivers_license(id, license_number, state, expiration_date)
# passport(id, passport_number, country, expiration_date)
# ...

# We have:
Item(id, category, subcategory, name, org_id)
ItemFieldValue(id, item_id, field_key, field_value, field_type)

# Example:
Item: { id: "123", category: "ids", subcategory: "passport", name: "John's Passport" }
ItemFieldValue: [
  { item_id: "123", field_key: "full_name", field_value: "John Doe", field_type: "text" },
  { item_id: "123", field_key: "passport_number", field_value: "AB1234567", field_type: "text" },
  { item_id: "123", field_key: "expiration_date", field_value: "2028-12-31", field_type: "date" }
]
```

**Benefits**:
- Add new categories without database migrations
- Flexible field definitions per subcategory
- Easy to extend

**Trade-offs**:
- Complex queries for filtering by field values
- No database-level validation for field types

#### 2. Modular Router Design

Each feature is a self-contained module with:
- **models.py** - SQLAlchemy ORM models
- **schemas.py** - Pydantic validation models
- **service.py** - Business logic
- **router.py** - API endpoints

All routers are included in `main.py`:
```python
app.include_router(auth_router)
app.include_router(items_router)
app.include_router(files_router)
# ...
```

#### 3. Shared Org Helpers

All routers need the active org for scoping queries. Instead of per-router `_get_active_org_id()` functions, shared helpers in `orgs/service.py` are used:

```python
from app.orgs.service import get_active_org_id, get_active_org

# get_active_org_id(user, db) → str (just the ID)
# get_active_org(user, db) → Organization (full object, for encryption key)
```

#### 4. Dependency Injection

FastAPI's dependency system provides reusable components:

```python
# dependencies.py
def get_db():
    """Provide database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(db: Session = Depends(get_db), token: str = Header(...)):
    """Verify session and return current user."""
    session = db.query(Session).filter(Session.token == token).first()
    if not session or session.expires_at < datetime.now():
        raise HTTPException(401, "Invalid session")
    return session.user

# router.py
@router.get("/items")
def list_items(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # user and db are automatically injected
    ...
```

## Frontend Architecture

### Project Structure

```
frontend/
└── src/
    ├── app/                          # Next.js App Router
    │   ├── layout.tsx                # Root layout
    │   ├── page.tsx                  # Home page (redirects to /dashboard)
    │   ├── globals.css               # Tailwind CSS
    │   │
    │   ├── (auth)/                   # Auth route group
    │   │   ├── login/page.tsx
    │   │   ├── register/page.tsx
    │   │   └── accept-invite/page.tsx
    │   │
    │   └── (app)/                    # Authenticated route group
    │       ├── layout.tsx            # Sidebar + header layout
    │       ├── dashboard/page.tsx
    │       ├── ids/
    │       │   ├── page.tsx          # List view
    │       │   ├── [itemId]/page.tsx # Detail view
    │       │   └── new/page.tsx      # Create view
    │       ├── insurance/
    │       ├── business/
    │       ├── people/
    │       ├── vehicles/
    │       ├── reminders/
    │       └── search/
    │
    ├── components/
    │   ├── ui/                       # shadcn/ui primitives
    │   │   ├── button.tsx
    │   │   ├── card.tsx
    │   │   ├── dialog.tsx
    │   │   └── ...
    │   │
    │   ├── layout/                   # Layout components
    │   │   ├── Sidebar.tsx
    │   │   ├── Header.tsx
    │   │   └── RemindersPanel.tsx
    │   │
    │   └── items/                    # Item-specific components
    │       ├── ItemPage.tsx          # Main item editor
    │       ├── ItemCard.tsx          # Card display
    │       ├── CategoryPage.tsx      # Category list page
    │       ├── SubcategoryIcon.tsx   # Config-driven subcategory icons
    │       ├── ReminderCard.tsx      # Reusable reminder card (3 variants)
    │       ├── VehiclesSection.tsx   # Vehicle assignment (auto insurance)
    │       ├── FileUploader.tsx      # File upload
    │       ├── ImageEditor.tsx       # Crop/rotate images
    │       ├── CoverageTab.tsx       # Insurance coverage
    │       ├── PersonSelector.tsx    # Person picker
    │       ├── PassportSelector.tsx  # Passport picker
    │       └── ...
    │
    └── lib/
        ├── api.ts                    # API client + types
        ├── auth.ts                   # Auth helpers (token/user storage)
        ├── crypto.ts                 # Web Crypto API (PBKDF2, RSA, AES-GCM)
        ├── key-store.ts              # In-memory key singleton
        ├── format.ts                 # Shared formatting utilities
        ├── utils.ts                  # General utilities (cn)
        └── image-utils.ts            # Image processing
```

### Key Patterns

#### 1. Server Components by Default

Next.js 16 App Router uses React Server Components:

```tsx
// app/(app)/dashboard/page.tsx
export default async function DashboardPage() {
  // This runs on the server
  const user = await getCurrentUser();

  return <ClientDashboard user={user} />;
}
```

**Benefits**:
- Faster initial page loads
- SEO-friendly
- Reduced client bundle size

#### 2. Client Components for Interactivity

Components with state/interactivity must be client components:

```tsx
'use client';  // This directive marks it as a client component

export function ItemPage() {
  const [name, setName] = useState("");
  // ... interactive logic
}
```

#### 3. Shared API Client

Centralized API calls with TypeScript types:

```typescript
// lib/api.ts
export const api = {
  items: {
    list: (params) => fetchAPI<ItemListResponse>("/items", { params }),
    get: (id) => fetchAPI<Item>(`/items/${id}`),
    create: (data) => fetchAPI<Item>("/items", { method: "POST", body: data }),
    // ...
  },
  files: { ... },
  reminders: { ... },
};

// Usage in components
const items = await api.items.list({ category: "ids" });
```

#### 4. Shared Formatting (`lib/format.ts`)

Centralized utility functions used by multiple components:

- `humanize()` — Replace underscores with spaces
- `titleCase()` — Humanize + capitalize words
- `formatDate()` — ISO date to locale display
- `getFieldValue()` — Get field from item's EAV fields
- `repeatLabel()` — Repeat frequency to human label
- `REPEAT_OPTIONS` — Const array of repeat options

#### 5. Reusable Components

Config-driven and variant-based components avoid duplication:

- **`SubcategoryIcon`** — Maps subcategory keys to icon + color via `SUBCATEGORY_ICONS` config (replaces 3 switch-statement icon functions)
- **`ReminderCard`** — 3 variants (`default`, `compact`, `sidebar`) for different contexts

#### 6. Auto-Save with Debouncing

ItemPage uses a debounced auto-save pattern:

```tsx
const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

function scheduleAutoSave() {
  if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
  setSaveStatus("idle");

  autoSaveTimer.current = setTimeout(async () => {
    setSaveStatus("saving");
    await api.items.update(itemId, { name, fields, notes });
    setSaveStatus("saved");
  }, 800);  // 800ms debounce
}

// Trigger on any change
function handleFieldChange(key, value) {
  setFieldValues(prev => ({ ...prev, [key]: value }));
  scheduleAutoSave();
}
```

## Database Schema

### Core Tables

```sql
-- Users & Authentication (ZK fields)
users (id, email, password_hash, full_name, encrypted_private_key,
       public_key, kdf_iterations, recovery_encrypted_private_key, created_at)
sessions (id, user_id, token, expires_at)

-- Organizations (multi-user support)
organizations (id, name, encryption_key_enc, created_by, created_at)
org_memberships (id, org_id, user_id, role)  -- role: owner/admin/member/viewer
org_member_keys (id, org_id, user_id, encrypted_org_key)  -- RSA-wrapped org keys

-- Items (main data model)
items (id, org_id, created_by, category, subcategory, name, encrypted_name, notes,
       is_archived, encryption_version, created_at)
item_field_values (id, item_id, field_key, field_value, field_type)  -- EAV pattern

-- Files
file_attachments (id, item_id, uploaded_by, file_name, storage_key, file_size,
                  mime_type, purpose, encryption_iv, encryption_tag,
                  encryption_version, created_at)

-- Reminders
custom_reminders (id, item_id, org_id, created_by, title, remind_date, note,
                  email_sent, repeat, created_at)

-- Contacts
item_contacts (id, item_id, label, value, contact_type, sort_order,
               address_line1, address_line2, address_city, address_state, address_zip)

-- Insurance Coverage
coverage_rows (id, item_id, org_id, service_key, service_label, in_copay,
               in_coinsurance, out_copay, coverage_limit, deductible, notes)
coverage_plan_limits (id, item_id, org_id, limit_key, limit_label, limit_value)
in_network_providers (id, item_id, org_id, provider_name, specialty, phone, address)

-- Vehicles & People (org-wide databases)
vehicles (id, org_id, name, license_plate, vin)
item_vehicles (id, item_id, vehicle_id, org_id)  -- junction table

people (id, org_id, first_name, last_name, email, phone, relationship)

-- Audit
audit_logs (id, org_id, user_id, action, resource_type, resource_id, details, created_at)
```

### Relationships

```
Organization (1) → (N) Items
Organization (1) → (N) OrgMemberships → (1) User
Item (1) → (N) ItemFieldValues
Item (1) → (N) FileAttachments
Item (1) → (N) CustomReminders
Item (1) → (N) ItemContacts
Item (N) ← (junction) → (N) Vehicles
```

## Encryption

### Zero-Knowledge Architecture

Family Vault uses a zero-knowledge encryption model where the server never sees plaintext data. All encryption and decryption happens client-side using the Web Crypto API.

### Key Hierarchy

```
User Password
    ├─► PBKDF2(600k iter, salt=email) ──► Master Key (256-bit)
    │       ├─► HKDF("enc") ──► Symmetric Key (encrypts RSA private key)
    │       └─► HKDF("mac") ──► MAC Key (future use)
    └─► PBKDF2(masterKey, password, 1 iter) ──► Master Password Hash (sent to server)

Per-User RSA-OAEP Keypair (2048-bit):
    ├─► Public key: stored plaintext on server
    └─► Private key: encrypted with Symmetric Key, stored on server

Org Key (AES-256-GCM, 256-bit):
    └─► Wrapped with each member's RSA public key → stored in org_member_keys
```

### Client-Side Encryption Flow

**Item Fields**: Encrypted with the org key (AES-256-GCM) in the browser before being sent to the server. Decrypted client-side on retrieval.

**File Upload**:
```
1. User selects file in browser
2. Browser encrypts file with org key (AES-256-GCM, random IV)
3. Encrypted blob is uploaded to server → stored in MinIO
4. IV + auth tag stored in database
```

**File Download**:
```
1. Browser fetches encrypted blob from server
2. Browser decrypts with org key + stored IV/tag
3. Plaintext displayed to user
```

### Key Ceremony (Org Key Sharing)

When a new member joins an organization:
1. New member generates RSA keypair on registration/invite acceptance
2. Existing member fetches new member's public key
3. Existing member wraps the org key with the new member's RSA public key
4. Wrapped key is stored in `org_member_keys`
5. New member unwraps org key with their private key on login

### Legacy Server-Side Encryption (v1)

Older items/files may use server-side encryption (encryption_version=1). These use an envelope encryption scheme with a server master key derived from `SECRET_KEY` via HKDF. Items are lazily migrated to client-side encryption (v2) as they are accessed.

### Security Properties

- **Zero-knowledge** — server stores only encrypted blobs; cannot read user data
- **Per-file keys** — each file gets a unique IV; compromising one doesn't expose others
- **Authenticated encryption** — GCM mode prevents tampering
- **Key separation** — org key compromise doesn't reveal master passwords
- **Multi-user support** — org key is shared via RSA key wrapping per member

## Authentication & Authorization

### Zero-Knowledge Auth

The server never sees the user's raw password or master key.

1. **Registration**:
   ```
   Browser: derive masterKey = PBKDF2(password, email, 600k iter)
   Browser: derive masterPasswordHash = PBKDF2(masterKey, password, 1 iter)
   Browser: generate RSA-OAEP 2048-bit keypair
   Browser: encrypt private key with symmetric key derived from masterKey
   Browser: send masterPasswordHash + encrypted keys to server
   Server: bcrypt(masterPasswordHash) → stored as password_hash
   Server: creates User + default Organization + OrgMembership (owner role)
   Server: returns session token
   ```

2. **Login**:
   ```
   Browser: GET /api/auth/prelogin?email=... → returns KDF iterations
   Browser: derive masterKey + masterPasswordHash (same as registration)
   Browser: send masterPasswordHash to server
   Server: verifies bcrypt(masterPasswordHash) against stored hash
   Server: creates Session record (expires in 72 hours)
   Server: returns token + encrypted private key + public key
   Browser: decrypts private key → unwraps org key → stores in memory
   ```

3. **Authenticated Requests**:
   ```
   Client includes token in Authorization header
   → Backend validates token + expiration
   → Loads user + org
   → Executes request
   ```

### Authorization Levels

| Role | View | Edit | Delete | Invite | Manage Org |
|------|------|------|--------|--------|------------|
| Owner | ✅ | ✅ | ✅ | ✅ | ✅ |
| Admin | ✅ | ✅ | ✅ | ✅ | ❌ |
| Member | ✅ | ✅ | ❌ | ❌ | ❌ |
| Viewer | ✅ | ❌ | ❌ | ❌ | ❌ |

## API Design

### RESTful Conventions

- **GET** `/api/items` - List items (with filters)
- **POST** `/api/items` - Create item
- **GET** `/api/items/{id}` - Get single item
- **PUT** `/api/items/{id}` - Update item
- **DELETE** `/api/items/{id}` - Delete item

### Response Format

```json
// Success
{
  "id": "123",
  "name": "John's Passport",
  "category": "ids",
  "fields": [...],
  ...
}

// Error
{
  "detail": "Item not found"
}
```

### Pagination

```
GET /api/items?page=2&limit=20

Response:
{
  "items": [...],
  "total": 150,
  "page": 2,
  "limit": 20
}
```

## Deployment Architecture

### Production Setup

```
                      ┌──────────────────┐
                      │   CloudFlare     │
                      │   (CDN + DDoS)   │
                      └────────┬─────────┘
                               │ HTTPS
                               │
                      ┌────────▼─────────┐
                      │  Nginx/Caddy     │
                      │  (Reverse Proxy) │
                      └────────┬─────────┘
                               │
              ┌────────────────┴────────────────┐
              │                                 │
    ┌─────────▼────────┐            ┌──────────▼────────┐
    │  Frontend        │            │  Backend          │
    │  (Next.js)       │            │  (FastAPI)        │
    │  Port 3000       │            │  Port 8000        │
    └──────────────────┘            └────────┬──────────┘
                                             │
                            ┌────────────────┴────────────┐
                            │                             │
                   ┌────────▼────────┐          ┌────────▼────────┐
                   │  PostgreSQL     │          │  MinIO/S3       │
                   │  (RDS/Cloud SQL)│          │  (S3/GCS)       │
                   └─────────────────┘          └─────────────────┘
```

### Scaling Considerations

- **Horizontal scaling**: Run multiple backend/frontend instances behind load balancer
- **Database**: Use managed PostgreSQL (RDS, Cloud SQL) with read replicas
- **File storage**: Use cloud storage (S3, GCS) for scalability
- **Caching**: Add Redis for session caching
- **CDN**: Serve static assets from CDN

## Background Jobs

### Reminder Email Scheduler

Uses APScheduler to check for due reminders every hour:

```python
# main.py
from apscheduler.schedulers.background import BackgroundScheduler

def check_due_reminders():
    """Run every hour, send emails for due reminders."""
    db = SessionLocal()
    try:
        due_reminders = get_due_reminders_for_email(db)
        for reminder in due_reminders:
            send_reminder_email(reminder)
            reminder.email_sent = True
        db.commit()
    finally:
        db.close()

scheduler = BackgroundScheduler()
scheduler.add_job(check_due_reminders, 'interval', hours=1)
scheduler.start()
```

## Performance Optimization

### Database Indexes

```sql
-- Critical indexes
CREATE INDEX idx_items_org_category ON items(org_id, category);
CREATE INDEX idx_items_archived ON items(is_archived);
CREATE INDEX idx_field_values_item ON item_field_values(item_id);
CREATE INDEX idx_sessions_token ON sessions(token);
```

### Query Optimization

- **Eager loading**: Use `joinedload()` to avoid N+1 queries
- **Pagination**: Always paginate large lists
- **Field filtering**: Only fetch needed columns

### Frontend Optimization

- **Code splitting**: Automatic with Next.js
- **Image optimization**: Use Next.js `<Image>` component
- **Static generation**: Pre-render category pages
- **Bundle size**: Tree-shaking + lazy loading

---

This architecture supports thousands of users while maintaining security and performance. For questions, see [CONTRIBUTING.md](../CONTRIBUTING.md).

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
│                    Next.js 15 (Port 3000)                   │
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
│   └── email/                  # SMTP email service
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

#### 3. Dependency Injection

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
    │   │   └── register/page.tsx
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
    │       ├── FileUploader.tsx      # File upload
    │       ├── ImageEditor.tsx       # Crop/rotate images
    │       ├── CoverageTab.tsx       # Insurance coverage
    │       ├── PersonSelector.tsx    # Person picker
    │       ├── PassportSelector.tsx  # Passport picker
    │       └── ...
    │
    └── lib/
        ├── api.ts                    # API client + types
        ├── auth.ts                   # Auth helpers
        ├── utils.ts                  # General utilities
        └── image-utils.ts            # Image processing
```

### Key Patterns

#### 1. Server Components by Default

Next.js 15 App Router uses React Server Components:

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

#### 4. Auto-Save with Debouncing

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
-- Users & Authentication
users (id, email, password_hash, full_name, created_at)
sessions (id, user_id, token, expires_at)

-- Organizations (multi-user support)
organizations (id, name, encryption_key_enc, created_by, created_at)
org_memberships (id, org_id, user_id, role)  -- role: owner/admin/member/viewer

-- Items (main data model)
items (id, org_id, created_by, category, subcategory, name, notes, is_archived, created_at)
item_field_values (id, item_id, field_key, field_value, field_type)  -- EAV pattern

-- Files
file_attachments (id, item_id, uploaded_by, file_name, storage_key, file_size,
                  mime_type, purpose, encryption_iv, encryption_tag, created_at)

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

## File Encryption

### Envelope Encryption Architecture

Family Vault uses multi-layer encryption for maximum security:

```
┌────────────────────────────────────────────────────────────┐
│ 1. SERVER MASTER KEY (derived from SECRET_KEY env var)    │
│    • Used via HKDF-SHA256                                  │
│    • Never stored in database                              │
│    • Same across all orgs                                  │
└─────────────────┬──────────────────────────────────────────┘
                  │ encrypts
                  ▼
┌────────────────────────────────────────────────────────────┐
│ 2. ORG ENCRYPTION KEYS (one per organization)             │
│    • Random 256-bit keys                                   │
│    • Encrypted with server master key                      │
│    • Stored in organizations.encryption_key_enc            │
└─────────────────┬──────────────────────────────────────────┘
                  │ derives
                  ▼
┌────────────────────────────────────────────────────────────┐
│ 3. FILE DATA ENCRYPTION KEYS (one per file)               │
│    • Derived from org key + random IV                      │
│    • Not stored (regenerated from IV + org key)            │
│    • Used with AES-256-GCM                                 │
└─────────────────┬──────────────────────────────────────────┘
                  │ encrypts
                  ▼
┌────────────────────────────────────────────────────────────┐
│ 4. ENCRYPTED FILE BLOBS (stored in MinIO/S3)              │
│    • Unreadable without org key + IV + auth tag           │
│    • IV stored in file_attachments.encryption_iv           │
│    • Auth tag in file_attachments.encryption_tag           │
└────────────────────────────────────────────────────────────┘
```

### Encryption Flow

**Upload**:
```python
1. User uploads file via /api/files/upload
2. Backend fetches org's encrypted key from database
3. Backend decrypts org key using server master key
4. Backend generates random IV (12 bytes)
5. Backend encrypts file using AES-256-GCM:
   - Key: derived from org key + IV
   - Output: ciphertext + authentication tag
6. Backend uploads ciphertext to MinIO
7. Backend stores IV + tag in database
```

**Download**:
```python
1. User requests /api/files/{file_id}
2. Backend verifies user owns the org that owns the item
3. Backend fetches encrypted file from MinIO
4. Backend fetches IV + tag from database
5. Backend decrypts org key using server master key
6. Backend decrypts file using AES-256-GCM
7. Backend streams plaintext to user
```

### Security Properties

✅ **Zero-knowledge storage** - MinIO/S3 bucket contains only encrypted blobs
✅ **Per-file keys** - Compromising one file doesn't expose others
✅ **Authenticated encryption** - GCM mode prevents tampering
✅ **Forward secrecy** - Rotating SECRET_KEY forces re-encryption of org keys
✅ **Multi-user support** - Org key is shared, not per-user

## Authentication & Authorization

### Session-Based Auth

1. **Registration**:
   ```
   User submits email + password
   → Backend hashes password (bcrypt, 12 rounds)
   → Creates User record
   → Creates default Organization + OrgMembership (owner role)
   → Returns session token
   ```

2. **Login**:
   ```
   User submits email + password
   → Backend verifies password hash
   → Creates Session record with random token
   → Sets expiration (30 days)
   → Returns token
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

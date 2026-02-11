---
layout: default
title: Frontend Guide
nav_order: 4
---

# Frontend Guide

Next.js 15 (App Router) frontend with TypeScript, Tailwind CSS, and shadcn/ui.

---

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/             # Login, Register (no sidebar)
│   └── (app)/              # Protected pages (sidebar + header)
│       ├── dashboard/
│       ├── ids/
│       ├── insurance/
│       ├── business/
│       ├── reminders/
│       └── search/
├── components/
│   ├── ui/                 # shadcn/ui primitives
│   ├── layout/             # Sidebar, Header, RemindersPanel
│   └── items/              # Item-specific components (19 files)
└── lib/
    ├── api.ts              # API client + TypeScript types
    ├── auth.ts             # Token management
    ├── format.ts           # Shared formatting utilities
    ├── utils.ts            # cn() Tailwind utility
    └── image-utils.ts      # Image processing algorithms
```

## Key Components

### ItemPage (`components/items/ItemPage.tsx`)

The main item view — the most complex component. Features:
- **Tab layout**: Overview, Files, Notes, Coverage (insurance only)
- **Auto-save**: 800ms debounce, reads from refs to avoid stale closures
- **RightSidebar**: Linked contacts + custom reminders with create/edit/delete
- **Create mode**: Queues contacts and reminders locally, saves after item creation
- **Provider auto-populate**: Fetches provider details and creates linked contacts

### SubcategoryIcon (`components/items/SubcategoryIcon.tsx`)

Config-driven icon component mapping subcategory keys to icons and colors:

```tsx
import { SubcategoryIcon } from "@/components/items/SubcategoryIcon";

<SubcategoryIcon subcategory="auto_insurance" category="insurance" size="md" />
```

Replaces three duplicated switch-statement functions (`ProviderLogo`, `IDIcon`, `BusinessIcon`) with a single lookup table.

### ReminderCard (`components/items/ReminderCard.tsx`)

Reusable reminder display with three variants:

| Variant | Context | Features |
|---------|---------|----------|
| `default` | Reminders page | Full card, urgency colors, overdue badges |
| `compact` | RemindersPanel | Compact row, item link, days until |
| `sidebar` | ItemPage RightSidebar | Border card, edit/delete buttons |

```tsx
<ReminderCard reminder={r} variant="compact" onClose={onClose} />
```

### CoverageTab (`components/items/CoverageTab.tsx`)

Insurance coverage table with layout variants:
- **health**: In-network / out-of-network columns
- **standard**: Coverage limit + deductible (auto, home)
- **life**: Key-value rows

## Shared Utilities

### `lib/format.ts`

| Function | Purpose | Example |
|----------|---------|---------|
| `humanize()` | Underscore to spaces | `"auto_insurance"` → `"auto insurance"` |
| `titleCase()` | Humanize + capitalize | `"auto_insurance"` → `"Auto Insurance"` |
| `formatDate()` | ISO to locale | `"2025-01-15"` → `"Jan 15, 2025"` |
| `getFieldValue()` | Get EAV field value | `getFieldValue(item, "policy_number")` |
| `repeatLabel()` | Repeat freq label | `"quarterly"` → `"Every 3 months"` |

### `lib/api.ts`

Centralized API client with typed methods:

```typescript
const items = await api.items.list({ category: "ids" });
const item = await api.items.get(itemId);
await api.reminders.create({ item_id, title, remind_date });
await api.vehicles.assign(itemId, vehicleId);
```

Handles auth token injection, 401 redirects, and error handling.

### `lib/auth.ts`

localStorage-based token management:

```typescript
getToken() / setToken() / removeToken()
getStoredUser() / setStoredUser()
getActiveOrgId() / setActiveOrgId()
isAuthenticated()
```

## Patterns

### Auto-Save

```
Field change → update state → schedule timer (800ms)
Timer fires → read refs (freshest values) → api.items.update()
```

Reads from refs (not state) to avoid stale closure issues in the debounce timer.

### Create Mode

When creating a new item (`isNew=true`):
1. Item is created immediately via `api.items.create()` (minimal data)
2. Page transitions to edit mode with the new item ID
3. Pending contacts and reminders (queued in local state) are saved
4. Auto-save begins for subsequent changes

### Field Groups

Subcategories can define `field_groups` for multi-card layouts:
- If present: each group renders in its own white card
- If absent: all fields in a single card (flat `fields` array)

Used by LLC, Corporation, and other business subcategories to separate business details from address.

# Family Vault — Frontend

Next.js 15 (App Router) frontend for Family Vault. Built with TypeScript, Tailwind CSS, and shadcn/ui.

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server (requires backend + postgres + minio running)
npm run dev

# Production build
npm run build
```

The frontend runs at `http://localhost:3000` and expects the backend API at `http://localhost:8000/api` (configurable via `NEXT_PUBLIC_API_URL`).

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout (Geist font)
│   ├── page.tsx                # Home → redirects to /dashboard
│   ├── globals.css             # Tailwind CSS
│   ├── (auth)/                 # Auth pages (no sidebar)
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   └── (app)/                  # Protected pages (sidebar + header)
│       ├── layout.tsx          # App shell
│       ├── dashboard/page.tsx
│       ├── ids/                # Family IDs category
│       ├── insurance/          # Insurance category
│       ├── business/           # Business category
│       ├── reminders/page.tsx
│       └── search/page.tsx
│
├── components/
│   ├── ui/                     # shadcn/ui primitives (~15 components)
│   ├── layout/
│   │   ├── Sidebar.tsx         # Left navigation
│   │   ├── Header.tsx          # Top bar with search
│   │   └── RemindersPanel.tsx  # Slide-out reminders panel
│   └── items/
│       ├── ItemPage.tsx        # Main item view (tabs, sidebar, auto-save)
│       ├── CategoryPage.tsx    # Category listing with subcategory sections
│       ├── ItemCard.tsx        # Item card in list view
│       ├── SubcategoryIcon.tsx # Config-driven subcategory icons
│       ├── ReminderCard.tsx    # Reusable reminder card (3 variants)
│       ├── CoverageTab.tsx     # Insurance coverage details
│       ├── ImageEditor.tsx     # Crop/rotate/auto-detect editor
│       ├── VehiclesSection.tsx # Vehicle assignment for auto insurance
│       └── ...                 # 10+ more item components
│
└── lib/
    ├── api.ts                  # API client + TypeScript interfaces
    ├── auth.ts                 # Token/user localStorage helpers
    ├── format.ts               # Shared formatting utilities
    ├── utils.ts                # cn() Tailwind utility
    └── image-utils.ts          # Image crop/rotate/auto-detect algorithms
```

## Key Patterns

### API Client (`lib/api.ts`)

All backend calls go through the centralized `api` object:

```typescript
import { api } from "@/lib/api";

const items = await api.items.list({ category: "ids" });
const item = await api.items.get(itemId);
await api.items.update(itemId, { name, fields, notes });
```

### Shared Utilities (`lib/format.ts`)

Centralized formatting functions to avoid duplication:

```typescript
import { humanize, titleCase, formatDate, getFieldValue, repeatLabel } from "@/lib/format";

humanize("auto_insurance")     // "auto insurance"
titleCase("auto_insurance")    // "Auto Insurance"
formatDate("2025-01-15")       // "Jan 15, 2025"
```

### Reusable Components

- **`SubcategoryIcon`** — Config-driven icon for all subcategories (replaces per-category switch statements)
- **`ReminderCard`** — 3 variants: `default` (full page), `compact` (panel), `sidebar` (item page)
- **`ItemPage`** — Auto-save with 800ms debounce, tab-based layout, RightSidebar with contacts/reminders

### Auto-Save

ItemPage debounces field changes at 800ms, reads from refs (not state) to avoid stale closures, and saves via `api.items.update()`.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000/api` | Backend API base URL |
| `NEXT_PUBLIC_DEBUG_DETECT` | — | Enable image auto-detect debug panel |

## Build

```bash
npm run build    # Production build (standalone output)
npm start        # Start production server
```

The Dockerfile uses multi-stage builds: Node 22 builder → standalone runner.

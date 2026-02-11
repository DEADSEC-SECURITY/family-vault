# Codebase Analysis Report

Generated: 2026-02-09

---

## CRITICAL Issues

| # | Area | Issue | Impact |
|---|------|-------|--------|
| 1 | Backend | **N+1 query in `_item_to_response()`** — makes 50+ org lookups per list request instead of 1 | Performance bottleneck on every item list page |
| 2 | Frontend | **~800 lines of duplicated selector pattern** across PersonSelector, PassportSelector, ProviderCombobox | Maintenance nightmare, bugs fixed in one but not others |
| 3 | Frontend | **ItemPage.tsx 1000+ lines**, 10+ responsibilities | Hard to maintain, test, or extend |
| 4 | Frontend | **ItemCard.tsx 633 lines**, 4 category variants in one file | Same problem |
| 5 | Frontend | **401 error handling race condition** in api.ts — redirects AND throws | Can cause double-redirect or unhandled errors |
| 6 | Infra | **Hardcoded default secrets** (SECRET_KEY, S3 creds, DB creds) | Security risk if deployed without changing |
| 7 | Infra | **CORS allows all methods** (`allow_methods=["*"]`) | Overly permissive |
| 8 | Infra | **No tests in CI/CD** — neither pytest nor vitest configured | No safety net for regressions |

## HIGH Issues

| # | Area | Issue |
|---|------|-------|
| 9 | Backend | Item verification pattern duplicated 5x across routers |
| 10 | Backend | Inconsistent HTTP methods (items uses PUT but implements PATCH semantics) |
| 11 | Backend | Missing `response_model` on several endpoints |
| 12 | Backend | No pagination on vehicles, people, contacts, reminders |
| 13 | Frontend | Error handling inconsistency (silent fails vs console.error vs toast vs inline) |
| 14 | Frontend | Data fetching uses 3 different patterns across the app |
| 15 | Frontend | Missing aria labels on interactive elements |
| 16 | Infra | No non-root user in Dockerfiles |
| 17 | Infra | No security headers middleware |
| 18 | Infra | No rate limiting |
| 19 | Infra | Missing DB connection pool configuration |
| 20 | Infra | Loose dependency versions (`>=`) in requirements.txt |

## MEDIUM Issues

| # | Area | Issue |
|---|------|-------|
| 21 | Backend | Missing index on `field_key` in ItemFieldValue |
| 22 | Backend | Schema inconsistencies (date types, Optional patterns) |
| 23 | Frontend | VehiclesSection has 16 state variables |
| 24 | Frontend | Duplicated empty state patterns across pages |
| 25 | Frontend | Console statements left in production code |
| 26 | Infra | MinIO image not pinned to version |
| 27 | Infra | .gitignore missing secret file patterns |

---

## Recommended Priority Order

### Quick wins (high impact, low effort)

1. Fix N+1 query in `_item_to_response()` — pass org_id instead of re-querying
2. Fix 401 race condition in api.ts — redirect OR throw, not both
3. Add `response_model` to all endpoints
4. Restrict CORS methods to `["GET", "POST", "PUT", "PATCH", "DELETE"]`
5. Pin dependency versions in requirements.txt
6. Add missing DB index on `field_key`

### Medium effort, high value

7. Extract shared `SearchableSelector` component from the 3 duplicated selectors
8. Split ItemPage.tsx into sub-components (OverviewTab, FilesTab, NotesTab as separate files)
9. Split ItemCard.tsx into per-category card components
10. Standardize error handling pattern across frontend
11. Add security headers middleware to FastAPI
12. Add non-root users to Dockerfiles

### Larger effort

13. Set up pytest + vitest with CI/CD integration
14. Add pagination to all list endpoints
15. Standardize data fetching pattern (custom hook or SWR/React Query)

---

## Detailed Findings

### Backend Details

#### N+1 Query in `_item_to_response()` (CRITICAL)
- Location: `backend/app/items/service.py`
- The `_item_to_response()` function calls `get_active_org_id()` or does org lookups for each item
- When listing 50 items, this causes 50+ extra DB queries
- Fix: Accept `org_id` as a parameter, query it once in the router and pass it through

#### Item Verification Duplication (HIGH)
- The pattern of fetching an item and verifying org ownership is repeated in:
  - `items/router.py`
  - `contacts/router.py`
  - `coverage/router.py`
  - `vehicles/router.py`
  - `reminders/router.py`
- Fix: Extract a shared `get_verified_item(item_id, org_id, db)` dependency

#### Missing `response_model` (HIGH)
- Several endpoints don't declare `response_model` in the decorator
- This means FastAPI doesn't validate/filter the response, risking data leaks
- Fix: Add `response_model=SchemaName` to all endpoint decorators

#### Missing Pagination (HIGH)
- `GET /api/vehicles`, `GET /api/people`, `GET /api/contacts`, `GET /api/reminders` return all records
- Fix: Add `page` and `limit` query parameters with defaults (page=1, limit=50)

#### Missing Index (MEDIUM)
- `item_field_values.field_key` is frequently queried but has no index
- Fix: Add index in a new migration

#### Schema Inconsistencies (MEDIUM)
- Some schemas use `date` type, others use `str` for dates
- Inconsistent use of `Optional[str]` vs `str | None`
- Fix: Standardize on `str | None` and ISO date strings

### Frontend Details

#### Duplicated Selector Pattern (CRITICAL)
- `PersonSelector.tsx`, `PassportSelector.tsx`, `ProviderCombobox.tsx` all implement:
  - Search input with debounce
  - Dropdown with filtered results
  - "Create new" option at bottom
  - Selection callback
- ~800 lines of nearly identical code
- Fix: Create a generic `SearchableSelector<T>` component with render props for customization

#### ItemPage.tsx Too Large (CRITICAL)
- 1000+ lines handling: overview tab, files tab, notes tab, coverage tab, right sidebar, auto-save, create mode, breadcrumbs
- Fix: Extract each tab into its own component file:
  - `OverviewTab.tsx`
  - `FilesTab.tsx`
  - `NotesTab.tsx`
  - Keep `ItemPage.tsx` as orchestrator

#### ItemCard.tsx Too Large (CRITICAL)
- 633 lines with 4 different rendering paths for ids/insurance/business/default
- Fix: Split into `IDItemCard.tsx`, `InsuranceItemCard.tsx`, `BusinessItemCard.tsx` with shared base

#### 401 Race Condition (CRITICAL)
- Location: `frontend/src/lib/api.ts`
- On 401 response, the code both redirects to `/login` AND throws an error
- The calling code may catch the error and show an error message while redirect is happening
- Fix: Redirect only, don't throw (or throw a special `AuthError` that callers ignore)

#### Error Handling Inconsistency (HIGH)
- Some components silently swallow errors
- Some log to console.error
- Some show toast notifications
- Some show inline error messages
- Fix: Establish a standard pattern (toast for user-facing errors, console.error for dev, error boundaries for crashes)

#### VehiclesSection State Bloat (MEDIUM)
- 16 separate `useState` calls
- Fix: Consolidate related state into objects or use `useReducer`

#### Console Statements (MEDIUM)
- `console.log` and `console.error` left in production code
- Fix: Remove console.log, keep console.error only where needed

### Infrastructure Details

#### Hardcoded Secrets (CRITICAL)
- `docker-compose.yml` has default values for SECRET_KEY, DB password, S3 credentials
- Fix: Remove defaults for SECRET_KEY, require it to be set; add startup validation

#### CORS Too Permissive (CRITICAL)
- `allow_methods=["*"]` allows HEAD, OPTIONS, TRACE, etc.
- Fix: Restrict to `["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]`

#### No Tests (CRITICAL)
- No pytest configuration or test files in backend
- No vitest/jest configuration in frontend
- CI/CD pipeline doesn't run tests
- Fix: Add pytest + vitest setup, add test step to CI/CD

#### Docker Security (HIGH)
- Both Dockerfiles run as root
- Fix: Add `RUN adduser` and `USER` directives

#### No Security Headers (HIGH)
- Missing headers: X-Content-Type-Options, X-Frame-Options, Strict-Transport-Security
- Fix: Add FastAPI middleware for security headers

#### No Rate Limiting (HIGH)
- Auth endpoints (login, register) have no rate limiting
- Fix: Add `slowapi` or similar rate limiting middleware

#### DB Connection Pool (HIGH)
- `database.py` uses default SQLAlchemy pool settings
- Fix: Configure `pool_size`, `max_overflow`, `pool_pre_ping`

#### Loose Dependency Versions (HIGH)
- `requirements.txt` uses `>=` which can break on major version bumps
- Fix: Pin to specific versions or use `~=` for compatible releases

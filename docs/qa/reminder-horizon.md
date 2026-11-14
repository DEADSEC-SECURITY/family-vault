# Reminder horizon QA

Local verification on 2026-11-13 used base `058502825acdf4f002fa3ed5072ded043d01ed1d`
(tree `e90dd86d1057a81d382c7b260775c16ea43b6762`) and independently reviewed code
`6f20b62f52ed9b15ed0c47ea335b63ad1db3287e`
(tree `61e74fee95251c0f7d4aae0d4474127f1d1e3546`). This document and the two
approved screenshots were added afterward. Hosted results belong to the PR's
checks on its latest head; local results below do not imply hosted CI passed.

## Feature and test contract

On `/reminders`, Date range selects the next 30, 90 (default), or 365 days.
Changing the range fetches new results; overdue reminders remain visible.
The selection is page-local and resets to 90 days when the page remounts.
Loading hides previous results, a failed request offers Try again, and a response
from an earlier selection cannot replace the current results.

Authenticated clients can call `GET /api/reminders?days_ahead=30`. The optional
`days_ahead` integer defaults to 90 and accepts 1 through 365 inclusive. The
cutoff is inclusive, with no lower cutoff for overdue records. Both custom and
date-field reminders are restricted to the active organization and exclude
archived items. Invalid values return HTTP 422; unauthenticated calls return 401.
The separate `/api/reminders/overdue` endpoint is unchanged.

`backend/tests/test_reminder_horizon.py` documents and checks this API contract.
Its registration helper creates only synthetic accounts. Its seed helper adds
one date field and one custom reminder per item, with offsets relative to today.
The parametrized cases cover cutoffs and overdue records for both sources;
separate cases cover the default, organization isolation, invalid values and
authentication. Run it from `backend` with
`pytest tests/test_reminder_horizon.py --tb=short -q`.

## Local checks

Python **3.12.16**, Node **20.20.2**. Commands run from the repository root
with the matching Python environment and Node version active:

```sh
python -m pip install -r backend/requirements.txt
(cd backend && pytest --tb=short -q)
(cd frontend && npm ci)
(cd frontend && npm run lint)
(cd frontend && npm test)
(cd frontend && npm run build)
```

The pilot installed Python requirements with
`uv pip install --python .openhands-trial/venv/bin/python -r backend/requirements.txt`
and invoked `../.openhands-trial/venv/bin/pytest --tb=short -q` from `backend`.
Node 20's binary directory was prepended to PATH for every frontend check.
All listed checks passed: **53 backend tests** (baseline 41), **51 frontend
tests in 8 files** (baseline 47 in 6 files), lint with zero errors, and production
build. The untouched baseline was verified from a `git archive master` snapshot.

Tests cover inclusive 1/30/90/365-day cutoffs, overdue retention, invalid input
(HTTP 422), default 90-day behavior, authentication, organization isolation and
archived-item exclusion. Frontend tests cover range/API interaction, loading,
failure/retry and stale responses. The stale-response test resolves its controlled
promise inside awaited React `act`; temporarily removing the response guard made
it fail with the stale row present. The guard was restored before full checks.

## Browser and Docker evidence

An isolated **playwright_vm Chromium** session successfully navigated to
`about:blank`, then logged into the synthetic account through `/login` on
`http://localhost:13000`. The existing legacy-account encryption upgrade prompt
was dismissed. The sidebar Reminders button opens the existing panel; the full
page was opened explicitly at `/reminders`.

Five synthetic custom reminders were created through the real API: 7 days overdue,
10, 60, 200 and 400 days ahead. No real family data was used.

| Action | Visible records | Absent records | Backend response |
| --- | --- | --- | --- |
| Open page; default next 90 days | overdue, 10, 60 | 200, 400 | `days_ahead=90`, 200 |
| Select next 30 days | overdue, 10 | 60, 200, 400 | `days_ahead=30`, 200 |
| Select next 365 days | overdue, 10, 60, 200 | 400 | `days_ahead=365`, 200 |
| Return to next 90 days | overdue, 10, 60 | 200, 400 | `days_ahead=90`, 200 |

Each selection awaited the actual response from
`http://localhost:18080/api/reminders?days_ahead=…` and loading completion,
asserted visible and absent names, and checked HTTP 200 and response titles.
Backend access logs corroborated the requests. The cases passed again after the
final Docker rebuild. Browser console: **zero warnings/errors**; full observed
network traffic, including static resources: **no failed requests or HTTP 4xx/5xx**.
Loading/error races were tested in frontend tests, not by inducing browser outages.

Only these two independently reviewed synthetic UI screenshots are published:

- [Next 30 days](reminder-horizon/reminders-30.png)
- [Next 365 days](reminder-horizon/reminders-365.png)

Both actual repository Dockerfiles built locally for **linux/amd64**. Their
runtime bases are Python 3.13 and Node 22, distinct from the CI test versions.
Docker **29.9.3**, Compose **5.7.1**; final `up --wait` returned 0. All four
containers were healthy: PostgreSQL (`pg_isready`), MinIO (readiness HTTP), backend
(`/api/health`), frontend (`/login`). The disposable stack remained running for
review. Published ports bind only to loopback: frontend 13000, API 18080,
PostgreSQL 15432, MinIO 19000/19001. API port 18000 was already occupied.

## Safe disposable reproduction

Use a dedicated disposable Docker daemon/project and empty volumes, never an
existing family database. Keep every local env file, override and seed under
`.openhands-trial/`; exclude that path and `.playwright-mcp/` in `.git/info/exclude`.
Generate fresh local-only passwords/keys (for example `secrets.token_hex(32)` in
Python); never reuse or publish existing credentials. Use `umask 077` when creating
env files. No account data, credentials, raw logs or browser diagnostics belong in
a commit.

Create `.openhands-trial/compose.env` with fresh values for `POSTGRES_PASSWORD`,
`S3_SECRET_KEY`, `SECRET_KEY`, plus `POSTGRES_DB=pilot`, `POSTGRES_USER=pilot`,
`S3_ACCESS_KEY=pilotminio` and `API_URL=http://localhost:18080/api`.
Create `.openhands-trial/backend.env` with the same generated `SECRET_KEY` and S3
values, `S3_BUCKET=pilot`, `SMTP_HOST=` (disabled), `SMTP_USER=`, `SMTP_PASSWORD=`,
`FRONTEND_URL=http://localhost:13000` and
`CORS_ORIGINS=["http://localhost:13000","http://127.0.0.1:13000"]`.
Compose supplies the internal database URL and MinIO endpoint.

Use this **local-only** `.openhands-trial/override.yml` (Compose supporting
`!override` is required). Repository Compose files remain unchanged:

```yaml
services:
  postgres:
    ports: !override ["127.0.0.1:15432:5432"]
  minio:
    image: bitnamilegacy/minio@sha256:953d489a81cc4de7975f90e07202189c4325da39b0b92470b6a13c7ea99e36cd
    user: "0:0"
    entrypoint: ["/opt/bitnami/minio/bin/minio"]
    ports: !override ["127.0.0.1:19000:9000", "127.0.0.1:19001:9001"]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/ready"]
  backend:
    build:
      network: host
    env_file: !override [".openhands-trial/backend.env"]
    ports: !override ["127.0.0.1:18080:8000"]
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')"]
      interval: 5s
      timeout: 3s
      retries: 10
  frontend:
    build:
      network: host
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:18080/api
      HOSTNAME: 0.0.0.0
    ports: !override ["127.0.0.1:13000:3000"]
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/login').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
      interval: 5s
      timeout: 3s
      retries: 10
```

Build-time host networking worked around build DNS failure in this environment;
runtime services use their isolated Compose project network. `HOSTNAME=0.0.0.0`
is internal to the frontend container; host publication remains loopback-only.
From the repository root, the exact Compose invocation was:

```sh
sudo docker compose --env-file .openhands-trial/compose.env \
  -p family-vault-pilot -f docker-compose.dev.yml \
  -f .openhands-trial/override.yml --profile full build
sudo docker compose --env-file .openhands-trial/compose.env \
  -p family-vault-pilot -f docker-compose.dev.yml \
  -f .openhands-trial/override.yml --profile full up -d --no-build --wait --wait-timeout 90
sudo docker compose --env-file .openhands-trial/compose.env \
  -p family-vault-pilot -f docker-compose.dev.yml \
  -f .openhands-trial/override.yml --profile full ps
```

Create a fresh synthetic account through the existing registration API, create
synthetic items through `/api/items`, then custom reminders through
`/api/reminders/custom` using the offsets above. Keep the generated account and
session data local. Sign in through the UI and repeat the table's cases.

## Limits and existing findings

- Both baseline and changed `npm ci` reported **36 audit findings: 3 low,
  6 moderate, 23 high, 4 critical**. Dependencies were not changed or audited away.
- Both lint runs reported the same two warnings: unused `GripVertical` in
  `CoverageTab.tsx` and unused expression in `InlineFileZone.tsx`.
- Backend tests retained one Starlette/anyio `BlockingPortal` deprecation warning.
- The original MinIO tag `minio/minio:RELEASE.2025-01-20T14-49-07Z` could not be
  pulled. The disposable local override pins the Bitnami legacy distribution
  above (2025.7.23-debian-12-r3), runs its MinIO binary directly, and uses a
  readiness probe. This is a local test workaround, not a production recommendation
  or a repository Compose change.
- The UI account used legacy API registration and synthetic server-encrypted
  items. **No zero-knowledge migration was tested in the browser.** Existing ZK
  backend tests pass; authentication and encryption code is unchanged.
- Browser cases use custom reminders; backend tests also cover date-field
  reminders. Local Docker builds cover amd64 only; hosted amd64/arm64 validation
  must be read from the latest PR workflow results. No manual publishing workflow
  was dispatched as part of this pilot.

# Dependency PR 6 acceptance

Tested unchanged PR #6 commit `401afa0adcb229598c4a4dd16fd20253517ba022`, tree
`20b88377e3d3807ecc99cc818f4f02d5249d2739`, parent/default
`058502825acdf4f002fa3ed5072ded043d01ed1d`. No application fix was needed.
This evidence-only proposal is separate from the Dependabot branch.

## Local checks

On both untouched baseline and exact PR source, Docker build harnesses used
Node 20 and Python 3.12, matching CI. Commands inside the harnesses:

```sh
npm ci
npm run lint
npm test
npm run build
pip install -r requirements.txt
pytest --tb=short -q
```

All checks passed: 47 frontend tests in six files, 41 backend tests, lint with
zero errors and two existing warnings, production build including TypeScript.
The two lint warnings and one backend deprecation warning remain.
Install audit findings remain: baseline 36, PR 35, including four critical each.
These findings are not claimed fixed.

Both actual repository Dockerfiles built successfully for amd64 on baseline
and PR. Build commands used `docker compose --env-file <ignored synthetic env>
-p apollo-0d9bb949 -f docker-compose.dev.yml -f <ignored override> --profile full
build`, exit 0. Build-only `network: host` avoids local build DNS failure.
Runtime services retain the isolated Compose network.

A focused [synthetic Hono regression](dependency-6/hono-regression.mjs) exercises
JSON validator rejection of `admin:true` with four Content-Type formats.
Run with `node /qa.mjs` in the matching installed frontend harness (`/app`).
Baseline 4.11.8 returns 200 for whitespace before the semicolon (expected
regression failure, exit 1); 4.13.18 returns 400 for all four inputs (exit 0).
This checks the validator advisory, not every upstream security fix.
Hono is a dev-only transitive dependency through shadcn/MCP SDK; application
source does not import Hono. The additional lock entries are optional bundled
Tailwind WASI dependencies. [Upstream release](https://github.com/honojs/hono/releases/tag/v4.13.18).

## Disposable stack and browser

The public reminder-horizon recipe's digest-pinned local-only MinIO override
was used unchanged in principle, with fresh synthetic credentials and data.
Repository Compose remains unchanged. All four services passed health checks:
PostgreSQL pg_isready, MinIO readiness HTTP, API /api/health, frontend /login.
`up -d --no-build --wait --wait-timeout 90` returned 0.
All services carry job label `com.apollo.maintenance.job=0d9bb949-9790-4078-83e5-7c78f79b6b31`.
Published ports bind only loopback: frontend 22880, API 22881, Postgres 22882,
MinIO 22883/22884. SMTP disabled; no production services or real account data.

Isolated playwright_vm Chromium:

- Signed in via /login with a new synthetic account; real login HTTP 200.
- Dismissed the existing legacy encryption migration prompt (migration not tested).
- Opened /reminders. Real API HTTP 200 returned overdue, 10-day and 60-day
  reminders; 200-day reminder absent. Asserted corresponding visible text.
- Deleted the 10-day reminder through its button: HTTP 204; row disappeared.
- Reloaded at 390x844: real API HTTP 200 with two records; deletion persisted,
  overdue and 60-day records present, 200-day record absent.
- Zero observed console warnings/errors; observed requests had no failures or
  HTTP 4xx/5xx, including static resources.

An initial exact-text assertion timed out because the card appends the category
label; matching its actual visible label passed. No application change was made.
Current head has no 30/90/365 selector; that unmerged feature was not tested.

Reviewed public-safe screenshots:

- [Desktop before deletion](dependency-6/reminders-desktop.png)
- [Mobile after deletion](dependency-6/reminders-mobile.png)
- [Untouched baseline mobile](dependency-6/baseline-mobile.png)

Mobile content is visibly clipped beside the fixed sidebar. Baseline and PR
mobile PNGs have identical SHA256
`5fb41501e27bdd6ada1760f7c0cc7ed2bc5c3097731acc9bcee13dd7f2b5d886`.
This is an existing layout limitation, not a Hono regression or a claimed fix.
DOM scroll-width alone did not detect the clipping; visual inspection did.

## Hosted checks

On unchanged PR head:

- [Frontend Tests](https://github.com/DEADSEC-SECURITY/family-vault/actions/runs/43355870922): success.
- [Docker](https://github.com/DEADSEC-SECURITY/family-vault/actions/runs/43355870919): success,
  backend amd64/arm64 and frontend amd64. Login correctly skipped in PR mode;
  no manual dispatch or image publication performed.
- Backend workflow is path-filtered for this lockfile-only PR; all backend tests
  were run locally on both revisions.

No approval, merge, ready transition, alert dismissal or bot-history modification.
Disposable project is removed after evidence and receipt are saved.

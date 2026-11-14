# PR 7 documentation feedback QA

Validated on 2026-11-14, starting from PR head
`35a5a47344d6f2ee584bce9415f47802d28c50a6` and default branch `master`
`058502825acdf4f002fa3ed5072ded043d01ed1d`. The follow-up adds docstrings to
all helpers and cases in `backend/tests/test_reminder_horizon.py`, and documents
the UI/API contract and fixture design in [the feature guide](reminder-horizon.md).
An AST comparison with docstrings removed confirmed unchanged executable test
logic. The existing meaningful regression tests and assertions are preserved.

## Commands and results

Python 3.12.16 and Node 20.20.2 match the CI major versions. The Python environment
was installed using `uv venv --python 3.12 .openhands-maintenance/venv` and
`uv pip install --python .openhands-maintenance/venv/bin/python -r backend/requirements.txt`.
Node 20 was installed locally under the ignored job directory and its binary
folder prepended to PATH. An initial npm install-script restriction left Node 24
active; that preliminary frontend run was superseded by full baseline and final
runs on verified Node 20.20.2 and npm 10.9.10. The final invocation used:

```sh
export PATH="$PWD/.openhands-maintenance/node/node_modules/node-linux-x64/bin:$PATH"
FV_NPM_CLI="$PWD/.openhands-maintenance/node/node_modules/npm/bin/npm-cli.js"
node --version
node "$FV_NPM_CLI" --version
# In each frontend directory:
node "$FV_NPM_CLI" ci
node "$FV_NPM_CLI" run lint
node "$FV_NPM_CLI" test
node "$FV_NPM_CLI" run build
```

No saved settings or authentication were changed.

| Command | Untouched master | Follow-up |
| --- | --- | --- |
| `pytest --tb=short -q` in backend | 41 passed, exit 0 | 53 passed, exit 0 |
| `npm ci` in frontend | exit 0 | exit 0 |
| `npm run lint` | exit 0, two warnings | exit 0, same two warnings |
| `npm test` | 47 passed in 6 files, exit 0 | 51 passed in 8 files, exit 0 |
| `npm run build` | exit 0 | exit 0; TypeScript check included |
| `git diff --check` | applicable changes only | exit 0 |

Baseline was an untouched `git archive master` snapshot inside the ignored job
directory. The follow-up was committed locally before final verification; the
published commit/tree mapping and hosted CI links are recorded in the PR reply.
Final checks also run after committing this evidence and screenshots.

Existing findings remain: 36 npm audit findings (3 low, 6 moderate, 23 high,
4 critical), the unused `GripVertical` and `InlineFileZone` expression lint
warnings, and one backend Starlette/anyio deprecation warning. No fix is claimed.

## Docker builds and health

Both actual repository Dockerfiles built successfully for local linux/amd64,
using Docker 29.9.3. The frontend uses Node 22 and backend Python 3.13 at runtime.
The disposable daemon uses its own data directory and socket; existing lab
services were not accessed or changed. Project `fv-c29b7632` uses fresh volumes.
Every service has label
`com.apollo.maintenance.job=c29b7632-b6b0-4d03-b7fd-c516f0ce4de2`.

The ignored local override follows [the public recipe](reminder-horizon.md#safe-disposable-reproduction),
including build.network=host (runtime uses the project bridge), frontend
HOSTNAME=0.0.0.0, matching API/CORS, and the validated MinIO digest/binary/readiness
workaround. Repository Compose is unchanged. SMTP is disabled. Credentials are
fresh synthetic fixtures and are not published.

Compose command prefix (the local script adds only these arguments):

```sh
sudo -n docker -H unix:///tmp/fv-c29b7632.sock compose \
  --env-file .openhands-maintenance/compose.env -p fv-c29b7632 \
  -f docker-compose.dev.yml -f .openhands-maintenance/override.yml --profile full
```

`build` and `up -d --no-build --wait --wait-timeout 90` both returned 0.
`ps` verified all four services healthy:

| Service | Health probe | Loopback publication |
| --- | --- | --- |
| PostgreSQL | pg_isready | 127.0.0.1:22832 |
| MinIO | /minio/health/ready | 127.0.0.1:22900 |
| Backend | /api/health | 127.0.0.1:22880 |
| Frontend | /login | 127.0.0.1:22300 |

Selected ports were checked free before startup. No runtime host networking or
external services were used. Cleanup removes only this job's stack and images.

## Browser verification

An isolated playwright_vm Chromium session opened `/login`, signed in to a fresh
synthetic account, dismissed the legacy encryption upgrade prompt, then visited
`/reminders`. Five synthetic custom reminders used offsets -7, 10, 60, 200, 400.
Assertions awaited actual backend responses and checked both API row labels and
visible/absent synthetic item names:

| Selection | Visible offsets | Excluded offsets | Actual API |
| --- | --- | --- | --- |
| 90 default | -7, 10, 60 | 200, 400 | days_ahead=90, HTTP 200 |
| 30 | -7, 10 | 60, 200, 400 | days_ahead=30, HTTP 200 |
| 365 | -7, 10, 60, 200 | 400 | days_ahead=365, HTTP 200 |
| back to 90 | -7, 10, 60 | 200, 400 | days_ahead=90, HTTP 200 |

The default exact-label assertion initially timed out because the label includes
` · passport`; corrected item-name assertions passed. No application failure was
observed. Console: zero warnings/errors. Observed network requests returned 200;
no failed requests or HTTP 4xx/5xx were observed. The 390x844 mobile viewport also
selected 365 and received HTTP 200 with the 200-day record present in the DOM.
The existing fixed sidebar clips content on mobile despite scrollWidth=390;
mobile layout quality is a limitation, not a fix in this documentation follow-up.

Only visually reviewed synthetic UI screenshots are included:

- [30 days, desktop](reminder-feedback-7/reminders-30.png)
- [365 days, desktop](reminder-feedback-7/reminders-365.png)
- [Mobile clipping limitation](reminder-feedback-7/reminders-mobile.png)

No browser diagnostics, session state, headers, credentials or raw logs are
published. Browser coverage uses legacy synthetic server-encrypted items; no
zero-knowledge migration was tested. Existing backend ZK tests pass. Loading,
retry and stale-response behavior are covered by the existing frontend tests.
Local builds cover amd64; latest-head hosted Docker CI must cover backend
amd64/arm64 and frontend amd64 before handoff. No workflow dispatch, image/package
publication, merge, approval, ready transition or thread resolution is authorized.

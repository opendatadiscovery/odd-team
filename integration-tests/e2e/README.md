# e2e — UI end-to-end integration tests (self-contained)

The **user-flow half** of the odd-team integration suite. These drive the **real ODD
React UI** in a browser (Playwright) and read ground truth from Postgres — so they
catch user-observable defects that an API probe structurally cannot (e.g. the F-001
view_count double-count, which is a React `useEffect` bug invisible to an HTTP call).

Self-contained and odd-team-owned: it brings up its own stack (the same `odd-minimal`
docker-compose the API-probe runtime uses) and does **not** depend on the upstream
`odd-platform/tests/` harness. Local-only.

## Why a separate rail from the API probes

| rail | tool | sees | home |
|---|---|---|---|
| API probe | `probe-runtime/runner.py` | backend/DB deltas, status codes | `lineage/odd-platform/probes/` |
| **UI e2e (this)** | Playwright (real browser) | the **user-observable** behaviour, incl. UI-only bugs | `integration-tests/e2e/` |

An integration test for a user-facing feature is the **end-to-end user scenario**
(UI → backend → DB), anchored on documented + intended behaviour. The API probe is a
useful backend sub-check, not the integration test.

## Prerequisites

- **Docker** running (the stack is brought up automatically).
- **Node 18+**. The system node is often too old (Ubuntu ships v12 → Playwright fails
  with `SyntaxError: Unexpected token '?'`, because its code uses `??`). If `node --version`
  is < 18 and you have no `nvm`/`fnm`, install user-space (no sudo, mirrors the JDK-in-`~/.local`
  pattern):
  ```bash
  cd /tmp && curl -fsSLO https://nodejs.org/dist/v24.13.0/node-v24.13.0-linux-x64.tar.xz \
    && mkdir -p ~/.local/node \
    && tar -xf node-v24.13.0-linux-x64.tar.xz -C ~/.local/node --strip-components=1
  export PATH="$HOME/.local/node/bin:$PATH"   # add to ~/.bashrc to persist
  ```
  `run-suite.sh` auto-detects `~/.local/node`; `.nvmrc` (v24.13.0) is for `nvm`/`fnm` users.

## Run

```bash
cd integration-tests/e2e
npm install                 # once
npm run browser             # once — downloads the Chromium build
npm test                    # brings up odd-minimal → runs specs → tears it down (-v)
```

Or via the suite runner (from the workspace root): `integration-tests/run-suite.sh ui-e2e`.

Options:
- `ODD_STACK_EXTERNAL=1 npm test` — run against a stack you started yourself (no bring-up/teardown).
- `ODD_BASE_URL=...` / `ODD_DB_URL=...` — point at a non-default stack.
- `npm run test:headed` — watch it drive the browser.

## Layout

```
e2e/
  package.json            playwright + pg
  playwright.config.ts    baseURL :18080, single-worker, no-retry (a pin must not be masked)
  global-setup.ts         docker-compose up odd-minimal + wait for /actuator/health
  global-teardown.ts      docker-compose down -v
  helpers/db.ts           seed + read ground truth in Postgres (view_count, search_facets, tags, attachment entity)
  helpers/net.ts          intercept/mutate the dashboard JSON response (UI-resilience tests)
  helpers/docker.ts       recreate the platform container (durability tests — the redeploy event)
  helpers/attachments.ts  the shared 3-step attachment upload flow (IT-007 + IT-008)
  helpers/stack.ts        generic self-managed docker-compose stack lifecycle (up/down + health)
  helpers/minio-stack.ts  REMOTE/MinIO stack wrapper (IT-008)
  helpers/loginform-stack.ts  LOGIN_FORM (enforcing) stack wrapper (IT-009)
  helpers/ldap-stack.ts   LDAP (enforcing, non-admin user) stack wrapper (IT-010)
  helpers/notifications-stack.ts  notifications/WAL (logical-replication) stack wrapper (IT-011)
  specs/
    view-count-overview.spec.ts          IT-002 — opening the Overview page must register +1 (pins the +2 bug)
    search-tsquery-poisoning.spec.ts     IT-003 — a search metacharacter must not 500/poison the session (PLT-090/127)
    quality-dashboard-unknown-status.spec.ts  IT-004 — an unknown run status must degrade, not blank the dashboard (PLT-052)
    top-tags-ordering.spec.ts            IT-005 — Top Tags must show most-popular, not oldest-by-id (PLT-026)
    error-boundary-containment.spec.ts   IT-006 — a render throw must be contained, not white-screen the app (TEST-GAP-1013)
    attachment-local-durability.spec.ts  IT-007 — an uploaded file must survive a container recreate; LOCAL loses it (LSN-001/PLT-086)
    attachment-remote-roundtrip.spec.ts  IT-008 — REMOTE/S3 (MinIO) attachment storage round-trips (F-027 REMOTE; GREEN)
    auth-mode-boundary.spec.ts           IT-009 — DISABLED open vs LOGIN_FORM authenticated (ADR-0074; GREEN)
    ldap-rbac-enforcement.spec.ts        IT-010 — a non-admin LDAP USER is denied a gated admin mutation (ADR-0002/0003; GREEN)
    notifications-wal-lifecycle.spec.ts  IT-011 — WAL slot+publication exist only when notifications enabled (ADR-0040/0044; GREEN)
```

Note: most specs drive the real browser; **IT-007 + IT-008 are integration-class** — they drive
the REST upload/download + a real container lifecycle (`helpers/docker.ts` recreate /
`helpers/minio-stack.ts` bring-up), no browser, because attachment storage durability/backend
has no UI-only facet. IT-008 brings up its own REMOTE/MinIO stack (distinct ports from
odd-minimal); run it focused with `ODD_STACK_EXTERNAL=1` to skip the unused odd-minimal bring-up.

## Adding an e2e test

1. Add `specs/{slug}.spec.ts` (seed via `helpers/db` or the API, drive the UI, assert the user-observable result + read ground truth from the DB).
2. Author the protocol `../protocols/IT-NNN-{slug}.md` with `test_class: e2e` and `automation: e2e:specs/{slug}.spec.ts`.
3. Add the protocol id to a suite in `../suites.yaml`; run it; log the result in `../run-log/`.

## Expected state of `view-count-overview.spec.ts`

**RED today** — one Overview page-open registers **+2**, not +1 (LSN-017 / PLT-104).
The red is the regression signal; it goes green when PLT-104 is fixed. This is the
worked example proving the UI-e2e rail catches a bug the API probe (P-001) cannot.

---
id: IT-060
title: "Ingestion credential lifecycle — one-time reveal, plaintext-at-rest, orphan-forever on delete"
gates:
  validates: [F-125]
  enforces: []
  regresses: [PLT-085]
test_class: integration
stack: odd-minimal
automation: "e2e:ingestion-credential-lifecycle.spec.ts"
plan_ref: I5
status: ready
---

# IT-060 — F-125 Ingestion Credential Storage & Lifecycle

## 1. What this checks

The 40-char bearer token every collector presents on `POST /ingestion/*` is the SECURITY load-bearing
credential beneath ingestion auth. F-125's reflection says the lifecycle has issue/rotate/view but **no
retire** path. Three claims, two of them LSN-029 characterization pins of CURRENT (broken/known) behaviour:

- **UC-004 (happy path, CONFIRMED):** a freshly minted collector reveals its 40-char plaintext token
  exactly once on create; a later list read returns it MASKED (`******`+last6). Secret-reveal-once.
- **UC-001 (teardown, CONTRADICTED → RED pin):** deleting the collector soft-deletes the parent
  (`deleted_at` stamped, row kept) but the token row SURVIVES — orphaned, never reclaimed. The `token`
  table has no `deleted_at` and `HousekeepingJobManager` has no token-purge leg. **KNOWN BUG** (F-125 H-001;
  PLT-087 D1 covers only the DataSource per-delete leg — the Collector delete + the daily housekeeping
  sweep are net_new).
- **UC-005 (render, CONTRADICTED → RED pin):** `token.value` in Postgres is byte-identical to the plaintext
  the API revealed — no hash, no encryption at rest. A DB-side reader (replica / pg_dump / backup) recovers
  every live credential with one SELECT; combined with UC-001, every credential EVER minted. **KNOWN BUG**
  (PLT-085 — odd-platform's `CollectorTokenStorageKnownBugTest` pins the same plaintext lookup at the unit
  tier; this is its end-to-end mint-side companion).

**Operator consequence:** a DISABLED deployment mints these tokens anonymously, stores them in clear text,
and never reclaims them on delete. A single backup/replica leak exposes every credential ever issued.

## 2. Preparation

- **Stack:** `odd-minimal` (`auth.type=DISABLED` — the default). `ODD_STACK_EXTERNAL=1` reuses a running stack.
- **Auth/config:** DISABLED → anonymous collector create/delete is permitted (no credential).
- **Seed:** none. Each test creates its own `it060_`-prefixed collector via the API and soft-deletes it at the end.

## 3. Readiness check

- Health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- `token` table shape (root-cause precondition): no `deleted_at`/`is_deleted` column —
  `SELECT column_name FROM information_schema.columns WHERE table_name='token'`
  → `id, value, created_at, created_by, updated_at, updated_by`.

## 4. Run protocol

1. `POST /api/collectors {name: it060_..., namespace_name: it060-ns}` (no auth) → 200 + `token.value` = 40-char plaintext.
2. `GET /api/collectors?query=<name>` → the same collector's `token.value` is MASKED `******`+last6.
3. Read at rest: `SELECT t.value FROM token t JOIN collector c ON c.token_id=t.id WHERE c.id=<id>` → equals step-1 plaintext.
4. `DELETE /api/collectors/<id>` → 204. `SELECT deleted_at FROM collector WHERE id=<id>` → stamped (row kept).
   `SELECT count(*) FROM token WHERE id=<token_id>` → **1** (orphaned).

**Automated rail:** `ODD_STACK_EXTERNAL=1 integration-tests/run-suite.sh IT-060`
(or `PATH=… ODD_STACK_EXTERNAL=1 npx playwright test specs/ingestion-credential-lifecycle.spec.ts`).

## 5. Assertions

- **PASS (current platform)** when: create reveals a 40-char plaintext; list read is masked; the at-rest DB
  value equals the revealed plaintext; after delete the parent is soft-deleted (row kept, `deleted_at` set,
  hidden from list) and the token row count is unchanged (orphan survives); `token` has no soft-delete column.
- **FLIPS (RED)** when: the at-rest value is no longer the plaintext (hash-at-rest shipped — PLT-085 fixed),
  OR the orphan token is purged on delete / by housekeeping (orphan-sweep shipped — F-125 H-001 fixed), OR
  the create response stops revealing the plaintext. Each flip is a measurable hardening — re-scope the pin.

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-060.md`.

## Cross-references
- Source: F-125 H-004 (one-time reveal, confirmed) · H-001 (orphan-forever, HIGH, contradicted) · H-005
  (plaintext-at-rest, HIGH, contradicted — PLT-085 pinned at unit tier).
- Plan: `lineage/odd-platform/test-plan.md` batch I5 (ingestion identity/credential).
- Related: IT-046 (anon collector/token MINT under DISABLED — F-008 UC-10); this protocol adds the
  reveal/at-rest/orphan lifecycle.

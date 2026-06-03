---
id: IT-021
title: "The detail header renders the entity lifecycle status badge (data-driven)"
gates:
  validates: [F-044]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:specs/entity-status-display.spec.ts"
plan_ref: ""
status: ready
---

# IT-021 — Lifecycle status badge on the detail header (F-044)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The data-entity detail **header** renders the entity's lifecycle **status** as a badge
(`DataEntityStatusDto`: UNASSIGNED/DRAFT/STABLE/DEPRECATED/DELETED). The badge is data-driven — it
reflects the actual `data_entity.status`, so a different status name is NOT shown. If it FAILS, the
status→header projection (F-044) is broken. Verified live (2026-06-03): status 3 → "STABLE", 4 →
"DEPRECATED" (verbatim uppercase). Source: feature-flow F-044; `DataEntityDetailsHeader.tsx`.

> Scope: F-044's lifecycle has a documented `status_updated_at_never_set_breaks_30_day_ttl` drift on
> the WRITE/auto-flip path (separate write-side pin). This IT covers the READ/display contract.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Brought up by the runner during the e2e run.
- **Seed data**: entity `2001` via `helpers/db.ts seedEntityStatus(code)` — sets
  `data_entity.status` (smallint) to a `DataEntityStatusDto` id (3=STABLE, 4=DEPRECATED; avoid
  5=DELETED — it soft-deletes/hides the entity).

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Seed present: `SELECT status FROM data_entity WHERE id = 2001;`.
- API projection: `curl -s http://localhost:18080/api/dataentities/2001` → `status` (snake_case wire).

## 4. Run protocol
1. SUCCESS: `seedEntityStatus(4)` (DEPRECATED); open `/dataentities/2001/overview`; wait for the
   `GET /api/dataentities/2001` detail response; observe the header status badge.
2. NEGATIVE: `seedEntityStatus(3)` (STABLE); open `/dataentities/2001/overview`; wait for detail; observe.

**Automated rail**: `integration-tests/run-suite.sh IT-021` (Playwright `e2e/specs/entity-status-display.spec.ts`).

## 5. What it checks — assertions
- **SUCCESS (PASS):** the status badge (DEPRECATED) renders in the header.
  (FAIL: the status never appears → the status→header projection is broken.)
- **NEGATIVE (PASS):** with status STABLE, the header shows STABLE and does NOT show DEPRECATED
  (count 0) — the badge is data-driven.

## 6. Result log
- 2026-06-03 — authored; status-badge labels ground-truth verified (STABLE/DEPRECATED); run via
  run-suite.sh IT-021 (see run-log/).

---
id: IT-028
title: "The owners management list searches/filters the owner directory"
gates:
  validates: [F-019]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:specs/owners-management-search.spec.ts"
plan_ref: ""
status: ready
---

# IT-028 — Owners management list search (F-019)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The owners management list (`/management/owners` → `GET /api/owners`) lists owners and **filters** by
the "Search owner" box (server-side, debounced on type). This IT verifies a seeded owner is findable
by name and that the search filters (a non-matching owner is excluded), plus that a non-matching
query returns nothing. If it FAILS, owner management/discovery (F-019 Owner Lifecycle Management) is
broken at the management surface. Distinct from IT-015 (ownership DISPLAY on an entity overview).
Source: feature-flow F-019; `Management/OwnersList`.

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Brought up by the runner during the e2e run.
- **Seed data**: `helpers/db.ts seedOwner(name)` — inserts an `owner` (SELECT-then-INSERT, idempotent).

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Seed present: `SELECT name FROM owner WHERE name LIKE 'IT028Owner%';`.
- API: `curl -s 'http://localhost:18080/api/owners?page=1&size=30&query=IT028OwnerAlpha'` → the owner in `items[]`.

## 4. Run protocol
1. SUCCESS: `seedOwner("<a>")` + `seedOwner("<b>")`; open `/management/owners`; type `<a>` into
   "Search owner"; wait for `GET /api/owners?query=`; observe the list.
2. NEGATIVE: open `/management/owners`; type a non-matching query (`ZZZNoSuchOwnerZZZ`); wait for owners; observe.

**Automated rail**: `integration-tests/run-suite.sh IT-028` (Playwright `e2e/specs/owners-management-search.spec.ts`).

## 5. What it checks — assertions
- **SUCCESS (PASS):** the searched owner is listed AND the other seeded owner is filtered out (visible count 0).
- **NEGATIVE (PASS):** a non-matching query returns neither owner (visible count 0).

## 6. Result log
- 2026-06-03 — authored; owners list + search ground-truth verified (filters on type); run via run-suite.sh IT-028 (see run-log/).

---
id: IT-085
title: "Query Examples list page renders a seeded example + faceted search finds it by definition"
gates:
  validates: [F-025]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:query-examples-crud-search.spec.ts"
plan_ref: I9
status: ready
---

# IT-085 — Query Examples list + faceted search (F-025)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
The Data Modelling **Query Examples** list page (`/data-modelling/query-examples`) renders a query
example, and the page's **faceted search** finds that example by a token in its `definition`. If it
FAILS, the catalog read + search surface of F-025 (Query Examples CRUD + Faceted Search) is broken —
operators cannot find curated query snippets. Covers F-025 UC-002 (list render) + UC-003 (faceted
search). Source: feature-flow F-025; the surface is ungated for read under DISABLED auth (the
read-collaborative posture).

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Brought up by the runner during the e2e run.
- **Seed data** (ids 20850-20859, `it085_` prefix; via `helpers/db.ts dbQuery`):
  1. `query_example(id=20850, definition, query, created_at, updated_at, is_deleted=false)` — the
     `definition` contains a unique token (`it085zqltoken`).
  2. `query_example_search_entrypoint(query_example_id=20850, query_example_vector =
     to_tsvector('english', definition || ' ' || query))`. NOTE: `search_vector` is a GENERATED
     column (`query_example_vector || data_entity_vector`) — set `query_example_vector`, never
     `search_vector`.
  Idempotent (DELETE entrypoint then example on the fixed id).

## 3. Readiness check
- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- Search wiring: `POST /api/queryexample/search {"query":"it085zqltoken"}` → `total:1`; then
  `GET /api/queryexample/search/{search_id}/results?page=1&size=30` returns the seeded example.

## 4. Run protocol
1. SUCCESS: open `/data-modelling/query-examples` (the page auto-creates an empty search session +
   pushes `?querySearchId=`). Type `it085zqltoken` into the "Search query examples" box and press
   Enter (fires `PUT /api/queryexample/search/{id}` → list refetch). Observe the row.
2. NEGATIVE: same page; search a token present in NO example (`it085nomatchzzz`); assert the seeded
   example is absent.

**Automated rail**: `integration-tests/run-suite.sh IT-085` (Playwright
`e2e/specs/query-examples-crud-search.spec.ts`).

## 5. What it checks — assertions
- **SUCCESS (PASS):** after the matching search, the list renders the example's `definition` and a
  link to the example by id (20850).
- **NEGATIVE (PASS):** after a non-matching search, the seeded example's definition is absent
  (visible count 0) — the faceted search is data-driven, not show-all.
- **FAIL:** the example never appears for a matching token (search/list surface broken), or appears
  for a non-matching token (search not actually filtering).

## 6. Result log
- 2026-06-07 — authored; ground-truth verified (seeded `query_example_vector` → live
  `POST /api/queryexample/search` returns total:1 + the example in results). Run via
  `run-suite.sh IT-085`. PASS (2/2) against the shared odd-minimal stack.

## Cross-references
- Source: F-025 (feature-flows/detail/F-025.yaml) UC-002, UC-003
- Plan: `lineage/odd-platform/test-plan.md` batch I9
- Automation: `integration-tests/e2e/specs/query-examples-crud-search.spec.ts`

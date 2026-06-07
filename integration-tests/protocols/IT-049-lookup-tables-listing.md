---
id: IT-049
title: "The Lookup Tables list page (P-03's sole UI surface) renders created lookup tables and is data-driven by search"
gates:
  validates: [F-058]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:lookup-tables-listing.spec.ts"
plan_ref: I3
status: ready
---

# IT-049 — F-058 Lookup Tables Listing UX

> A protocol is the **source of truth** — a human can execute every step below WITHOUT any
> tooling. The `automation:` e2e spec runs the same steps and writes the same result.

## 1. What this checks

`/master-data/lookup-tables` is the SOLE user-observable surface of pillar P-03 (Master Data
Management). The page (`LookupTables.tsx`) bootstraps a server search session
(`POST /api/referencedata/search` → `?searchId=<uuid>`), renders an H1 + a "<N> lookup tables
overall" counter from `facets.total`, then `LookupTablesList` renders the result rows; each row's
name is a `<Link>` showing `item.name` verbatim (`LookupTablesListItem.tsx:30-34`). Per F-058
`use_case_coverage` this surface ships ZERO tests — this is its first automated guard.

- **UC-002 (CONFIRMED):** a tenant at N≤30 tables sees the entire catalog on first load — a created
  lookup table is rendered in the list. **Consequence if it FAILS:** the pillar's only UI does not
  show operator-curated reference data.
- **UC-004 (CONFIRMED):** the list is data-driven — typing in the search box narrows it to FTS
  matches (the box drives `PUT` facets → the same FTS the list reads). A unique-prefixed table is
  found; a ghost name is not.

**Deferred (documented, not faked):** the HIGH silent-30-row-cap bug (F-058-UC-001) lives at
`LookupTablesList.tsx:53` `scrollableTarget='directory-entities-list'` — a non-existent DOM id, so
`fetchNextPage` never fires from scrolling and any tenant with >30 tables silently sees only 30.
Pinning it needs 30+ seeded rows, which would pollute the GLOBAL `facets.total` counter every other
agent on the shared stack reads; it is therefore deferred to a dedicated isolated-stack run rather
than faked here.

## 2. Preparation — build the test stand

- **Stack:** `odd-minimal`, `AUTH_TYPE=DISABLED` (anonymous = `admin` with all permissions, so the
  page + `+Add new` render). The e2e harness brings the stack up/down; `ODD_STACK_EXTERNAL=1` reuses
  a running one.
- **Seed data:** `ensureNamespace('it049_ns')`, then create lookup tables via the REAL API (the
  arrange). Prior `it049_`-prefixed tables are dropped first (idempotent). The create flow also
  populates `lookup_tables_search_entrypoint.search_vector`, so the table is immediately searchable
  + listed (verified live).

## 3. Readiness check

- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- The list route serves the SPA: `curl -s -o /dev/null -w '%{http_code}' http://localhost:18080/master-data/lookup-tables` → `200`
- Namespace present: `SELECT 1 FROM namespace WHERE name='it049_ns'`

## 4. Run protocol

1. `POST /api/referencedata/table` `{name:'it049_visible_codes', namespace_name:'it049_ns', ...}` → **200**.
2. Open `http://localhost:18080/master-data/lookup-tables` in a browser; wait for the
   `GET /api/referencedata/search/{id}/results` response. The H1 "Lookup Tables" + a row showing
   `it049_visible_codes` must be visible (UC-002).
3. Create `{name:'it049_searchable_unique', ...}` → **200**. Drive the page's search:
   `POST /api/referencedata/search {query:'it049_searchable_unique'}` → `{search_id}`;
   `GET /api/referencedata/search/{search_id}/results?page=1&size=30` → the result items contain
   `it049_searchable_unique` (UC-004). A `{query:'it049_no_such_table_zzz'}` search does NOT contain it.

**Automated rail:** `integration-tests/run-suite.sh IT-049`
(runs `e2e/specs/lookup-tables-listing.spec.ts`).

## 5. What it checks — assertions

- **PASS** when: the list page renders the H1 + the created table's name (UC-002); AND the
  reference-data search returns a created name and excludes a ghost name (UC-004).
- **FAIL** when: the created table never renders on the page (the list did not compose); OR the
  search omits a created table / returns a ghost (the data-driven contract broke).

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-049.md` (+ Playwright report/screenshot/trace on failure).

## Cross-references
- Source: F-058 UC-002 (catalog renders) + UC-004 (search narrows);
  `lineage/odd-platform/feature-flows/detail/F-058.yaml`. Deferred: facet
  `silent_30_row_cap_via_scrollable_target_mismatch` (HIGH, F-058-UC-001).
- Code: `LookupTables.tsx:30-71` (search-session bootstrap + counter + search box),
  `LookupTablesList.tsx:21-66` (results render; the `scrollableTarget` bug at line 53),
  `LookupTablesListItem.tsx:30-44` (row name/description/namespace render).
- Plan: `lineage/odd-platform/test-plan.md` batch I3 (Master Data Management UI).

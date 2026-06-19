---
id: IT-049
title: "The Lookup Tables list page (P-03's sole UI surface) renders created lookup tables and is data-driven by search"
gates:
  validates: [F-058]
  enforces: []
  regresses: [PLT-057]
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

- **UC-001 (was CONTRADICTED, FIXED by PLT-057 / #1753 Defect 1):** a tenant with >30 lookup tables
  sees ALL of them — the list is not capped at the first page. The bug lived at `LookupTablesList.tsx:53`
  `scrollableTarget='directory-entities-list'` — a DOM id absent on this page (the Directory list's id,
  copy-pasted), so `getElementById` returned null, InfiniteScroll fell back to the `window` listener, and
  the rows scrolling inside the `overflow:auto` `#lookup-tables-list` container never fired
  `fetchNextPage` — the list silently stopped at 30. The fix sources the container id and the scroll
  target through ONE constant so they cannot drift. **Consequence if it FAILS (the pre-fix bug):** P-03's
  sole UI silently truncates for any medium+ deployment. This was previously DEFERRED (30+ seeded rows
  would pollute the GLOBAL `facets.total`); it is now realized SAFELY — seed 31 under a unique sub-prefix,
  build a search session scoped to that prefix via the API, and deep-link `?searchId=` so the H1 + list
  are scoped to exactly those 31 (no global-counter assertion, no FE search-box timing), cleaned up after.

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
4. (UC-001 — the >30-row cap) Create 31 tables `it049bulk_01..31` → **200** each.
   `POST /api/referencedata/search {query:'it049bulk'}` → `{search_id, total:31}`. Open
   `http://localhost:18080/master-data/lookup-tables?searchId={search_id}`; the H1 reads "31 lookup
   tables overall". Scroll the `#lookup-tables-list` container to the bottom; ALL 31 rows must render
   (pre-fix: stuck at 30 — `fetchNextPage` never fires from the window-fallback listener).

**Automated rail:** `integration-tests/run-suite.sh IT-049`
(runs `e2e/specs/lookup-tables-listing.spec.ts`). RED proof for UC-001: `ODD_SUT=ref:main integration-tests/run-suite.sh IT-049`.

## 5. What it checks — assertions

- **PASS** when: the list page renders the H1 + the created table's name (UC-002); the
  reference-data search returns a created name and excludes a ghost name (UC-004); AND with 31
  prefix-scoped tables the list renders ALL 31 after scrolling (UC-001 — the cap is fixed).
- **FAIL** when: the created table never renders on the page (the list did not compose); OR the
  search omits a created table / returns a ghost (the data-driven contract broke); OR the 31-table
  list stops at 30 after scrolling (UC-001 — the `scrollableTarget` DOM-id mismatch regressed).

## 6. Result log

Appends to `integration-tests/run-log/{YYYY-MM-DD}-IT-049.md` (+ Playwright report/screenshot/trace on failure).

## Cross-references
- Source: F-058 UC-002 (catalog renders) + UC-004 (search narrows) + UC-001 (>30 rows all load);
  `lineage/odd-platform/feature-flows/detail/F-058.yaml`. Covered (was deferred): facet
  `silent_30_row_cap_via_scrollable_target_mismatch` (HIGH, F-058-UC-001) — FIXED by PLT-057 / #1753 D1.
- Code: `LookupTables.tsx:30-71` (search-session bootstrap + counter + search box),
  `LookupTablesList.tsx` (results render; `SCROLLABLE_TARGET_ID` constant feeds both the container id
  and the InfiniteScroll `scrollableTarget` — the fix),
  `LookupTablesListItem.tsx:30-44` (row name/description/namespace render).
- Plan: `lineage/odd-platform/test-plan.md` batch I3 (Master Data Management UI).

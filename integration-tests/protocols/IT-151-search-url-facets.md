---
id: IT-151
title: "Search FACETS live in the URL (?entityClasses[]=…&my=…) — shareable, back/forward, removable (ST-1b / D10)"
gates:
  validates: [F-017]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:search-url-facets.spec.ts"
plan_ref: "contributor/CTRIB-049.md (ST-1b of #1825 search overhaul); ADR adrs/drafts/unified-asset-search.md D10/D9"
status: ready
---

# IT-151 — Search facets in the URL (F-017 / ST-1b / ADR D10)

> A protocol is the source of truth — a human can execute every step below without tooling.

## 1. What this checks
ST-1b (the facet half of ST-1) moves the **8 facets + My Objects** into the URL, layered on ST-1a's `?q=`. A
**faceted** search becomes shareable, bookmarkable, and back/forward-correct. We exercise the on-page **class
tab** (`Results.tsx` / `SearchResultsTabs`) — the round-1 write surface that is **not** in the Filters sidebar
(a sidebar-only URL-writer would silently break it). Applying the Datasets tab navigates to the canonical
**`/search?…&entityClasses[]=<id>`**; the page runs the filtered search **from the URL**; a shared faceted URL
reproduces it with no prior session; back/forward navigate facet states; and the **All** tab **removes** the
facet from the URL and broadens the results. Removal is the round-2 correctness point: the server's
`updateFacets` MERGEs (can't remove a facet the URL dropped), so the reader **CREATEs a fresh session per URL
state** (`search()` = `removeUnselected` = REPLACE) — the URL is the complete, authoritative facet spec.
If this FAILS, the shareable/removable faceted-search contract (ADR D10) is broken.

> The class tab renders as a MUI `role="tab"` with the literal label ("All", "Datasets", …) + a count hint
> (`SearchResultsTabs.tsx`). `seedSearchableEntity(id,name)` seeds a DATA_SET; a non-DATA_SET class is seeded
> inline via `dbQuery` (IT-068 precedent — `db.ts` has no class-parameterised seeder).

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Brought up by the runner.
- **Seed data**: `seedSearchableEntity(21500,"it150facets_dataset")` (DATA_SET {1}) +
  `seedSearchableOfClass(21501,"it150facets_group","{8}",17)` (DATA_ENTITY_GROUP {8}). IT-151-specific ids.

## 3. Readiness check
- `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`.
- `POST /api/search {"query":"it150facets","filters":{}}` → `total >= 2` (both classes match the FTS token).

## 4. Run protocol
1. **Class tab → facet URL:** open `/search`; search `it150facets`; observe both rows under **All**; click the
   **Datasets** tab; observe the URL gains `…&entityClasses[]=<id>` and the group-class row is filtered out.
2. **Remove via All:** click the **All** tab; observe `entityClasses[]` LEAVES the URL and the group returns.
3. **Share/bookmark:** open the captured faceted URL in a fresh context (no prior session); observe the
   dataset-filtered result reproduced.
4. **Back/forward:** from the faceted URL, `goBack()` → the facet leaves the URL + the group returns;
   `goForward()` → the facet re-applies + the group is filtered out.

**Automated rail**: `integration-tests/run-suite.sh IT-151` (Playwright `e2e/specs/search-url-facets.spec.ts`).

## 5. What it checks — assertions
- **Class tab (PASS):** `page.url()` matches `/entityClasses(\[\]|%5B%5D)=\d+/`; the group row count is 0; the
  dataset row is visible. (FAIL: the URL never gains the facet — the class tab only PUT it to the session.)
- **Remove (PASS):** after the All tab, the URL no longer matches the facet regex AND the group row is visible.
- **Share (PASS):** the faceted URL, loaded fresh, reproduces the dataset-only result.
- **Back/forward (PASS):** back leaves the facet URL + broadens; forward re-applies the facet URL + narrows.

## 6. RED proof (the base, pre-ST-1b)
`ODD_SUT=ref:main` (CTRIB-049 base, `f63d3915` — ST-1a merged, so `?q=` exists but facets do NOT): a class tab
dispatches a PUT `/facets` that never touches the URL, so the facet-URL / share / back-forward / removal
assertions FAIL — the facet-in-URL contract does not exist yet. GREEN on the working-tree SUT.

## 7. Result log
- 2026-07-01 — authored for CTRIB-049 / ST-1b (#1825). RED proof base `ref:f63d3915` (post-ST-1a, pre-ST-1b).
  See run-log/ for the working-tree GREEN + the ref:main RED.

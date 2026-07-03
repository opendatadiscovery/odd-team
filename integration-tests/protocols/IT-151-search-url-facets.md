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

**B1 rework (2026-07-01) — the SIDEBAR facets + `statuses`.** The class tab above is the *immune* facet (echoed
as a full histogram). Two cases cover the non-immune sidebar facets, where the create-per-URL-state REPLACE
originally stranded `isFacetsStateSynced` (blocking the `Results.tsx` re-fetch) and the `statuses` facet was
never echoed:
- **Sidebar-deselect reload:** deep-link a shareable link with a **tag** facet (dataset only), then **Clear All**
  → the results must **broaden** (the group returns). On the buggy build the deselected tag is carried as a
  phantom → `synced` stranded → the results never re-fetch (stuck), so the group never returns. A **Back** after
  the deselect must land on the tagged state and stay there (no stale-mirror URL bounce).
- **Status select + deep-link:** picking **STABLE** in the Statuses sidebar facet must reach the URL
  (`statuses[]=3`), refilter server-side, and the **chip must stay labelled** after the create settles — the
  URL-derived create echoes the request's names (`null` on the wire; captured live), so the reducer must keep
  the label it already knows. A `/search?…&statuses[]=3` deep-link must reproduce the filtered result (results
  must settle) **and render the chip LABELLED**. On the buggy build the server never echoed `statuses`, so a
  status select stranded `synced` and froze the results; the un-merged echo also blanked every sidebar chip label
  ~1s after selection.
  *(**ST-1d (shipped):** a fresh deep-link now renders LABELLED chips — the server resolves facet names in the
  echo (`SearchServiceImpl.resolveFacetNames`), so a URL-derived id-only request echoes `SearchFilter.name`, also
  making the echo honour the spec's `SearchFilter.required: [id, name]`. Asserted in the deep-link flow below.)*

> The class tab renders as a MUI `role="tab"` with the literal label ("All", "Datasets", …) + a count hint
> (`SearchResultsTabs.tsx`). `seedSearchableEntity(id,name)` seeds a DATA_SET; a non-DATA_SET class is seeded
> inline via `dbQuery` (IT-068 precedent — `db.ts` has no class-parameterised seeder).

## 2. Preparation — build the test stand
- **Stack**: `odd-minimal` (AUTH_TYPE=DISABLED). Brought up by the runner.
- **Seed data**: `seedSearchableEntity(21500,"it150facets_dataset")` (DATA_SET {1}) +
  `seedSearchableOfClass(21501,"it150facets_group","{8}",17)` (DATA_ENTITY_GROUP {8}). IT-151-specific ids.
- **B1 seeds** (inline `dbQuery`): a **tag** linked to the dataset (21500) only — its id is read back at runtime,
  never hardcoded; `data_entity.status` set to **STABLE (3)** on the dataset and **DEPRECATED (4)** on the group
  (`DataEntityStatusDto`: STABLE=3, DEPRECATED=4), so `statuses[]=3` narrows to the dataset.

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
5. **B1 — sidebar-deselect reload:** open `/search?q=it150facets&tags[]=<tagId>`; observe only the dataset (the
   group has no tag); click **Clear All**; observe the URL drops `tags[]` AND the group **returns** (results
   re-fetched). The URL must NOT revert back to the tag link afterwards. Then **Back** → the tagged URL + the
   dataset-only result reproduce, and the URL is not bounced by a late mirror write.
6. **B1 + ST-1d — status select + deep-link:** search `it150facets`; pick **STABLE** in the **Statuses** sidebar
   facet; observe the URL gains `statuses[]=3`, the DEPRECATED group is filtered out, and — after the search
   settles (~2 s) — the **STABLE chip is still labelled** (B1 label-preserve). Then open
   `/search?q=it150facets&statuses[]=3` fresh; observe the dataset-only result renders (results settle) **and the
   STABLE chip is LABELLED** (ST-1d — the server resolves the facet name in the echo). RED on `ref:main`
   (ab63b6d3, pre-ST-1d: the fresh deep-link chip has no label) → GREEN on the fix.

**Automated rail**: `integration-tests/run-suite.sh IT-151` (Playwright `e2e/specs/search-url-facets.spec.ts`).

## 5. What it checks — assertions
- **Class tab (PASS):** `page.url()` matches `/entityClasses(\[\]|%5B%5D)=\d+/`; the group row count is 0; the
  dataset row is visible. (FAIL: the URL never gains the facet — the class tab only PUT it to the session.)
- **Remove (PASS):** after the All tab, the URL no longer matches the facet regex AND the group row is visible.
- **Share (PASS):** the faceted URL, loaded fresh, reproduces the dataset-only result.
- **Back/forward (PASS):** back leaves the facet URL + broadens; forward re-applies the facet URL + narrows.
- **B1 sidebar-deselect (PASS):** after Clear All, the group row is visible AND the URL no longer matches the tag
  regex (and does not revert); Back lands on the tagged URL, the tag re-applies, and the URL stays put.
  (FAIL on the B1 build: `synced` stranded → the group never returns.)
- **B1 status select + deep-link (PASS):** the select puts `statuses[]=3` in the URL, filters out the group, and
  the **STABLE** chip (Typography `title="STABLE"`) is still visible ~2 s after settle; the deep-link renders the
  dataset-only result. (FAIL on the B1 build: the un-echoed status strands `synced` → the results freeze; FAIL
  without the label-preserving merge: the chip blanks after the create response.)
- **#1835 chip renders the RAW value (PASS):** the STABLE chip's TEXT equals `STABLE`, not the capitalized
  `Stable`, so the chip and the sidebar dropdown option agree. (FAIL on `ref:main`: the chip ran the value through
  `TextFormatted`→`capitalize` → `Stable`.)

## 6. RED proof (two bases)
- **Feature base — `ODD_SUT=ref:main` (`f63d3915`, ST-1a merged, no facets in URL):** the whole facet-in-URL
  contract is absent → every case FAILS. GREEN on the working-tree SUT.
- **B1 base — `ODD_SUT=ref:f89c9a65` (ST-1b WITH B1):** the class-tab / share / back-forward cases pass (the
  immune facet), but the two B1 cases FAIL — the sidebar-deselect leaves the results stuck (stranded `synced`,
  the group never returns) and the status select/deep-link freezes the results (no echo → `synced` stranded).
  GREEN only after the B1 fix (mapDto echoes `statuses` + the slice reconciles optimistic-vs-requested + the
  label-preserving merge keeps the chip label across the name-less echo).
- **#1835 casing base — `ODD_SUT=ref:main` (post-ST-1d):** every case passes EXCEPT the new chip-TEXT assertion —
  the chip renders `Stable` (TextFormatted `capitalize`), not the raw `STABLE`. GREEN on the working-tree SUT.

## 7. Result log
- 2026-07-01 — authored for CTRIB-049 / ST-1b (#1825). RED proof base `ref:f63d3915` (post-ST-1a, pre-ST-1b).
  See run-log/ for the working-tree GREEN + the ref:main RED.
- 2026-07-02 — B1-rework ladder (CTRIB-049 resume; fix commit `02f0ee60`): **GREEN on the fix SUT 4/4**
  (incl. the 2 new B1 cases) · **RED on `ref:f89c9a65` 2 failed / 2 passed** — exactly the two B1 cases fail,
  the immune class-tab cases pass · **RED on `ref:f63d3915` 4/4 failed** (no facet-URL contract on the feature
  base). One earlier e2e:FAIL entry same day = the spec's own afterAll FK-ordering bug (tag link vs entity
  DELETE) — fixed in the spec teardown, not a SUT defect. See run-log/2026-07-02-IT-151.md for digests.

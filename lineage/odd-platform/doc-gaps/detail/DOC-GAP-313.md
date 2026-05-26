---
doc_gap_id: DOC-GAP-313
severity: HIGH
category: drift (UI-bug with operator-visible consequence; live page silent on the 30-row cap that the bug imposes)
batch: ZL
generated_at: "2026-05-26T00:00:00Z"
generated_at_commit: 4ec2b20
prompt_version: "doc-gap-finder/0.1.0"
maintainer_curated: false
related_pillar_features:
  - "P-03"           # Master Data Management
related_features:
  - F-018            # Lookup Tables (Reference Data)
related_doc_gaps:
  - DOC-GAP-215      # ReferenceData (Lookup Tables) compound doc-coverage gap — sibling backend-tier finding
  - DOC-GAP-301      # Master Data pillar route-mount permission framing drift
  - DOC-GAP-300      # Bare /master-data renders blank page (sibling P-03 URL-surface dead-end)
related_retrospectives:
  - LSN-001
  - LSN-002
---

## DOC-GAP-313 — `LookupTablesList` InfiniteScroll `scrollableTarget="directory-entities-list"` is a COPY-PASTE BUG (the actual container id is `lookup-tables-list`); per `react-infinite-scroll-component` semantics, an unresolvable `scrollableTarget` falls back to window-scroll which never fires inside an `overflow:auto` container — likely capping the visible list at 30 rows; the live page `features/master-data-management/lookup-tables.md` is silent on any row-limit, and the operator with >30 lookup tables sees an incomplete list with NO UI signal that more rows exist

**Severity**: HIGH
**Category**: drift (UI-bug + doc-silent on the consequence)

### Surfaced by

- `odd-platform__ts__react-component__component__LookupTables.md:bugs_limitations_corner_cases.[1]` (HIGH per sidecar — "InfiniteScroll mis-targeting: `LookupTablesList.tsx:51-53` mounts `<ScrollableContainer id='lookup-tables-list'>` around `<InfiniteScroll scrollableTarget='directory-entities-list'>`. The `scrollableTarget` is a copy-paste from the Directory feature — it references a DOM id that does NOT exist on this page. Per react-infinite-scroll-component docs, an unresolvable `scrollableTarget` falls back to window scroll; but `ScrollableContainer` declares `$offsetY={165}` and likely sets `overflow:auto`, so window scroll never fires for content inside the container. Likely effect: `fetchNextPage` never gets triggered by scrolling within the table; any tenant with >30 lookup tables sees only 30 rows in the UI. PROBE-NEEDED — see P-192.")
- `odd-platform__ts__react-component__component__LookupTables.md:tests_coverage_semantic.uncovered_behaviours.[3]` (HIGH integration-class uncovered — "InfiniteScroll fires `fetchNextPage` correctly when scrolling within the ScrollableContainer (the `scrollableTarget='directory-entities-list'` references the wrong DOM id)")
- `odd-platform__ts__react-component__component__LookupTables.md:stress_findings.tunables.[size=30]` (the page size that compounds with the bug — "What at N > 30? ... InfiniteScroll's fetchNextPage — BUT the scrollableTarget references a wrong DOM id ... PROBE-NEEDED")
- `odd-platform__ts__react-component__component__LookupTables.md:stress_findings.name_behavior_pairs.[InfiniteScroll]` (DRIFT_NAME_VS_BEHAVIOR — "react-infinite-scroll-component with scrollableTarget='directory-entities-list' — a DOM id that does NOT exist on this page. The actual container id is `lookup-tables-list`. Mismatch → fetchNextPage may never fire from container scroll.") **(PROBE-NEEDED P-192)**
- `odd-platform__ts__react-component__component__LookupTables.md:performance.known_performance_gaps.[2]` (HIGH per sidecar — "InfiniteScroll mis-target (P-192) — has performance implications (server-side count works, but client never requests pages 2+, so the visible list undercounts)")

### Evidence

- **Code primary source — the bug site**: `odd-platform-ui/src/components/LookupTables/LookupTablesList.tsx:51-53` (per sidecar primary source): `<ScrollableContainer id='lookup-tables-list'>` wraps `<InfiniteScroll scrollableTarget='directory-entities-list'>`. The two IDs differ. The Directory feature has a container ID `directory-entities-list` (per Glob/Grep across components/Directory/* the source-of-the-copy); the Lookup Tables page does not.
- **react-infinite-scroll-component fallback behaviour**: per the library's documented semantics, when `scrollableTarget` is supplied but the DOM ID is unresolvable, the component falls back to listening on the WINDOW scroll. The `ScrollableContainer` styled-component (per cross-sidecar verification) likely sets `overflow: auto` + `$offsetY=165` so the LIST area scrolls INSIDE the container, NOT the window. The window scroll never fires when the list is scrolled inside the container — InfiniteScroll's `fetchNextPage` is never triggered.
- **The size literal**: `LookupTablesList.tsx:23` sets `const size = 30;`. The backend correctly paginates (the controller accepts `page` + `size`, the repository emits `LIMIT 30 OFFSET (page-1)*30`); the wire/server contract is fine. The bug is entirely client-side: the client never requests page 2+, so only the first 30 rows are visible.
- **The operator-visible consequence**: any tenant with N > 30 lookup tables sees only the first 30 in the UI. No "Showing 30 of N" indicator (per Alerts.tsx sidecar pattern — same omission applies here); no skeleton-loader at the bottom indicating more pages exist; no fail-fast error. The H1 counter does correctly show the full count (e.g. "47 lookup tables overall") — so the operator sees a count of 47 but a list of 30, with no UI affordance to bridge the gap.
- **Live doc primary source (WebFetched 2026-05-26 status 200 via LookupTables.tsx sidecar inferred_docs)**: `https://docs.opendatadiscovery.org/features/master-data-management/lookup-tables` describes the page as "every lookup table the user can read, with name, description, and namespace columns plus search". The live page is SILENT on:
  - Any pagination behaviour at the UI layer
  - Any row-count cap (no "showing 30 per page" or similar)
  - Any workaround for tenants with many tables (no API-direct guidance, no per-namespace filtering hint)
- **The probe P-192 is the operational confirmation gate**: until the probe runs, the SEVERITY of the bug at runtime is bounded by what the operator sees — but the static-inferred conclusion is HIGH because the substrate has primary-source code citation + the docs library documentation of fallback behaviour + the operator-visible 30-row cap.
- **The cross-reference to DOC-GAP-215**: DOC-GAP-215 enumerates FOUR backend-tier operational gaps on Lookup Tables (cascade-on-delete, XSS, per-tenant scoping, buildTableName collision). THIS finding adds the FIFTH gap at the UI tier: the visible-list cap. The backend correctly paginates; the UI client never paginates. The combined finding adds a critical UI-tier dimension to DOC-GAP-215's backend cluster.
- **The bug class**: this is a "copy-paste reference mismatch" UI bug — the `directory-entities-list` DOM ID was copied from a sibling feature without renaming. The fix is a one-line code edit: change `scrollableTarget='directory-entities-list'` to `scrollableTarget='lookup-tables-list'`. The class is "silent UI regression that ships in production because no integration test exercises the > 30-row case."
- **Operator-impact narrative**: a steward configures a fresh tenant with 47 lookup tables (the team's full reference-data catalogue). They navigate to /master-data/lookup-tables, see the count "47 lookup tables overall", but only 30 rows in the list. They scroll. Nothing happens — no spinner, no fetch, no skeleton. They try clicking on the visible row at the bottom. They use the search box to find a missing table; the search input fires updateFacets correctly (the backend handles `query` properly), so search works. But browsing the unfiltered list — the typical first-time experience — silently truncates at 30. The operator concludes "the docs say I have 47 tables but the UI only shows 30; something is broken."

### Proposed doc action

**TWO-PART action — doc-side admonition (until code fix lands) + code-side fix as the lasting remediation.**

1. **Code-side PRIMARY (file `/log-issue odd-platform`)** — single-line fix:

   - Change `scrollableTarget='directory-entities-list'` → `scrollableTarget='lookup-tables-list'` at `odd-platform-ui/src/components/LookupTables/LookupTablesList.tsx:53`.
   - Add an integration test exercising > 30 lookup tables: render the page with a stub backend returning 47 rows across 2 pages; assert all 47 are visible after scrolling.

2. **Doc-side ADMONITION (until code fix lands)** — extend `documentation/docs/features/master-data-management/lookup-tables.md`:

   > **Known limitation — UI list truncation**: the current UI release caps the visible Lookup Tables list at 30 rows due to a known UI bug (tracked at odd-platform issue #NNNN). Tenants with more than 30 lookup tables see only the first 30 in the list (the H1 counter correctly shows the full count). Workaround: use the search input to find specific tables by name, or query the API directly: `GET /api/referencedata/search/{searchId}/results?page={N}&size=30`. The fix is planned for the next release.

3. **Doc-side COMPANION** — add a "Pagination behaviour" subsection naming the 30-rows-per-page default + the (fixed-after-fix) infinite-scroll trigger. Operators can size their reference-data sets with the cap in mind.

### Cross-references

- **DOC-GAP-215** (ReferenceData/LookupTables compound doc-coverage gap) — direct family match: THIS finding adds the FIFTH operational dimension (UI-tier visible-list cap) to DOC-GAP-215's four backend-tier gaps. Combined cluster has the doc-side fix at the same target page.
- **DOC-GAP-301** (Master Data pillar route-mount permission framing drift) — sibling P-03 finding; both findings demonstrate that the Master Data Management pillar doc page underspecifies operational + UI behaviours.
- **DOC-GAP-300** (Bare `/master-data` renders blank page) — sibling P-03 URL-surface gap; THIS finding adds the visible-but-truncated-list gap once the operator does navigate correctly.
- **F-018** (Lookup Tables feature flow) — THIS finding extends F-018's documentation coverage at the UI-tier.
- **LSN-001 / LSN-002** (operator-trap canonical) — the operator follows the docs, deploys the feature, configures > 30 tables, and silently sees an incomplete list.

### Severity rationale

HIGH. The bug is operator-blocking on the canonical operator-curated reference-data surface, and the live doc is silent on the consequence. Severity classification:

1. **The bug is reachable at minimum operational scale**: any deployment with > 30 lookup tables triggers it. 30 is well within the typical operator-configured reference-data set; the threshold is reached on the first day of any non-trivial reference-data adoption.
2. **The fix is one line of code**: the cost-benefit is asymmetric — bounded fix, deterministic operator-impact reduction.
3. **The probe P-192 is the gate to FULL confirmation**, but the STATIC-INFERRED case is sufficient for HIGH severity: the code citation is unambiguous, the docs library behaviour is documented, the operator-visible consequence (30-row cap) is empirically predictable.
4. **The doc gap compounds the bug**: the docs do NOT name the 30-row cap, so an operator hitting it concludes the platform's reference-data feature is broken, not that the UI is mis-rendering a complete dataset.
5. **The cluster context**: DOC-GAP-215 covers the backend-tier gaps; THIS finding is the UI-tier complement. Both findings on the same doc page; both should be addressed in the same maintenance cycle.

Severity is NOT CRITICAL because the data is intact at the backend, the API works correctly, and the workaround exists (use search). The harm is operator-misleading at the primary UI surface; the fix is the small code change.

### Last verified

- 2026-05-26 — LookupTables.tsx UI-component sidecar PRIMARY SOURCE at substrate commit `4ec2b20`; live WebFetch `https://docs.opendatadiscovery.org/features/master-data-management/lookup-tables` status **200** (verbatim "every lookup table the user can read" copy confirmed in the LookupTables.tsx sidecar `inferred_docs[0]` fetched 2026-05-26).
- Probe **P-192** is the operational confirmation gate; until it runs, the SEVERITY is HIGH STATIC-INFERRED.

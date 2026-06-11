---
node_id: "odd-platform ts react-component component:DataEntityDetails"
node_kind: react-component
axis: ui_components
extracted_at_commit: ede5d277
enriched_at_commit: 8c142e15+CTRIB-004-uncommitted   # branch contrib/CTRIB-004-view-count-double-fetch — base main @ 8c142e15 + uncommitted #1764 fix in working tree
extractor_version: 0.1.0
prompt_version: file-analyser/0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-06-11-CTRIB-004-fix-refresh
schema_version: v0.3.0
canonical_status: LSN-017 PRIMARY-SOURCE (HISTORICAL) — this file was the platform-wide canonical instance of the response-derived-dep-array doubling bug; **FIXED in the working tree** (CTRIB-004 / GitHub #1764): the dep-array no longer contains `details.status?.status`, one mount = one fetch = +1 view_count (IT-002 GREEN 2026-06-11; P-004 assertion flipped 2→1). The LSN-017 provenance (P-004 run R-20260519T010758Z measured +2 pre-fix) is preserved below as history.
related_features:
  - F-001   # P-01:F-001 Popular Entities Ranking — this component is hop-1 (producer) of the view_count chain; post-fix multiplicity 1, no longer an amplifier
related_pillar_features:
  - P-01:F-001   # Popular Entities Ranking — pre-fix the doubling AMPLIFIED the home-page ranking signal 2×; post-fix the UI contributes at parity with direct API calls
related_retrospectives:
  - LSN-017   # PRIMARY retrospective — this file is the canonical source-code anchor; bug now fixed at the same locus (dep-array, was lines 56-64 pre-fix, now lines 61-68 post-fix with deps at 63-68)
  - LSN-018   # coherence — cross-checks the F-001 chain (DataEntityDetails + fetchDataEntityDetails + PopularStrip + ReactiveDataEntityRepositoryImpl + DataEntityServiceImpl) + batch-Q negative cluster reconciliation
related_refactoring_scopes:
  - REFACTOR-201   # view-count UPDATE inside @ReactiveTransactional — backend half of the F-001 producer; UNCHANGED by this UI fix (read-as-write + no idempotency / no rate-limit / no debounce remain)
  - REFACTOR-220   # view_count inflation loop — UI amplifier removed by CTRIB-004; the backend +1-per-GET read-as-write and absence of rate-limiting remain the open scope
  - REFACTOR-221   # No index on `data_entity.view_count` — seq-scan-per-Popular-render cost remains; the 2× UI growth-rate amplifier is removed
related_lsn_negative_cluster:
  description: |
    Batch-Q UI LSN-017 negative-findings cluster — 4 SIBLING UI shell components
    (PolicyList / RolesList / OwnersList / CollectorsList) explicitly checked for
    the LSN-017 dep-array shape and FOUND NEGATIVE. Batch-U added a 5th sibling
    (TermDetails). DataEntityDetails was the SOLE platform-wide instance of the
    response-derived-dep-array bug — a discrete one-component defect, not a
    project-wide pattern. CTRIB-004 removes that sole instance: post-fix, ZERO
    components in the catalog carry the shape, and the fix comment at
    DataEntityDetails.tsx:56-60 turns the convention into stated intent.
  ui_siblings_lsn_017_negative:
    - odd-platform__ts__react-component__component__PolicyList.md
    - odd-platform__ts__react-component__component__RolesList.md
    - odd-platform__ts__react-component__component__OwnersList.md
    - odd-platform__ts__react-component__component__CollectorsList.md
    - odd-platform__ts__react-component__component__TermDetails.md
related_test_gaps:
  - TEST-GAP-256   # backend: no test asserts UPDATE happens exactly once per call — still open (backend tier)
  - TEST-GAP-259   # backend: incrementViewCount unit coverage — still open (backend tier)
  - TEST-GAP-309   # cross-layer: scripted detail-reads pump entity to top of /popular — still open (backend rate-limit absence persists post-fix)
  - TEST-GAP-310   # UI: useEffect dispatches exactly once per mount — NOW PINNED at the integration tier by odd-team IT-002 (GREEN post-fix, run-log 2026-06-11); in-repo Vitest component pin still absent
related_doc_gaps:
  - DOC-GAP-085   # view-count side-effect — RESOLVED on live docs (entity-detail-page "General panel — view count caveats" verified 2026-06-11); 0.28.0 fixed-note rides release/0.28.0
  - DOC-GAP-101   # LSN-017 doubling surfaced to operators — RESOLVED on live docs (the +2 is documented verbatim, correct for the latest published release)
related_probes:
  - P-001   # 5 sequential GETs → +5 view_count (backend per-call +1 contract — UNCHANGED by the UI fix; re-pinned via IT-001)
  - P-002   # DISABLED-mode anonymous reachability → 10 anon GETs = +10 view_count (backend posture, unchanged)
  - P-003   # latency baseline (p50=106ms, p95=202ms, p99=1539ms)
  - P-004   # HISTORICAL EMPIRICAL PIN of the bug — headless Chromium page-open observed xhr_count=2 + DB delta=2 (run R-20260519T010758Z-P-004); assertion FLIPPED 2→1 post-fix (2026-06-11)
---

# DataEntityDetails — semantic understanding

## understanding

`DataEntityDetails` is the **top-level React component for the per-entity detail page** — every navigation to `/dataentities/{id}/*` mounts this single component (route registration `App.tsx:69-71`), which orchestrates the data-fetch lifecycle, renders the persistent shell (header + tabs strip + content slot via nested `<Routes>`), and gates child mutation affordances on a `WithPermissionsProvider` context. **This file is the historical canonical source-code anchor of LSN-017, and the bug is FIXED in the working tree (CTRIB-004 / #1764)**: the details-fetch `useEffect` (lines 61-68) now lists only externally-driven dependencies (`dataEntityId` + three DEG-membership flags, lines 64-67) — the response-derived `details.status?.status` dep that re-fired the effect once per first visit (two `GET /api/dataentities/{id}` per page-open → +2 view_count, measured by probe P-004 run R-20260519T010758Z) is removed, and a comment block at lines 56-60 documents the prohibition and cites #1764. One mount now = one `fetchDataEntityDetails` dispatch = +1 view_count (IT-002 RED pre-fix / GREEN post-fix, odd-team run-log 2026-06-11). The refetch-after-status-change that the removed dep used to provide reactively is now dispatched **explicitly** by `StatusSettingsForm.onSubmit` after a successful status update (`StatusSettingsForm.tsx:100`, with its own #1764 provenance comment at lines 96-99). A second `useEffect` (lines 70-80) issues 4 ancillary dispatches per mount (alerts count, DQ test report, SLA report, resource permissions), keyed on `[dataEntityId]` alone — both effects now share the same externally-driven-only dep-array shape.

## concepts

- entities: [
    "`DataEntityDetails` payload — the 34-field response from `GET /api/dataentities/{id}` (per the `DataEntityDetails` TypeScript type imported from `generated-sources` via `dataentities.thunks.ts:17`); the component reads `id`, `internalName`, `externalName`, `entityClasses`, `type`, `manuallyCreated`, `lastIngestedAt`, `isStale`, `status` from it (`DataEntityDetails.tsx:95-103`)",
    "Redux store slice `dataEntities.byId[id]` (per `dataentities.slice.ts:97-99` reducer that handles `fetchDataEntityDetails.fulfilled`) — the source the component reads via `getDataEntityDetails(id)` selector (`dataentity.selectors.ts:93-97`)",
    "fetching status sub-state — `isLoading` / `isNotLoaded` flags surfaced via `getDataEntityDetailsFetchingStatuses` (`dataentity.selectors.ts:159-161`); error envelope via `getDataEntityDetailsFetchingError` (`dataentity.selectors.ts:162-164`)",
    "permission context — `resourcePermissions` for the `DATA_ENTITY` resource type, keyed on `dataEntityId` (`DataEntityDetails.tsx:35-37`), filtered against three permissions: `DATA_ENTITY_INTERNAL_NAME_UPDATE`, `DATA_ENTITY_GROUP_UPDATE`, `DATA_ENTITY_STATUS_UPDATE` (`DataEntityDetails.tsx:88-90`)",
    "route param `dataEntityId` — extracted from `useDataEntityRouteParams()` (`routes/dataEntitiesRoutes.ts:47-59`); the raw string from React Router is parsed via `parseInt(dataEntityId, 10)` (`dataEntitiesRoutes.ts:53`)",
    "group-membership flags — `isDataEntityGroupUpdated`, `isDataEntityAddedToGroup`, `isDataEntityDeletedFromGroup` (`DataEntityDetails.tsx:39-54`) — three independent Redux statuses signalling DEG-membership mutations elsewhere in the app should re-fetch this page's details"
  ]
- operations: [
    "extract `dataEntityId` from URL params via `useDataEntityRouteParams()` (line 32)",
    "subscribe to `details`, `resourcePermissions`, and three group-status flags + fetch-status + error from Redux (lines 34-54)",
    "**on mount + on each externally-driven dep change, dispatch `fetchDataEntityDetails({ dataEntityId })` exactly once (lines 61-68) — the FIXED LSN-017 locus; the dep-array (lines 63-68) contains `dataEntityId` + the 3 DEG flags ONLY; the guard comment at lines 56-60 states `details.status?.status` must NOT be a dependency and cites #1764**",
    "on mount only, dispatch four parallel data fetches: `fetchDataEntityAlertsCounts({ dataEntityId, status: OPEN })`, `fetchDataSetQualityTestReport({ dataEntityId })`, `fetchDataSetQualitySLAReport({ dataEntityId })`, `fetchResourcePermissions({ resourceId: dataEntityId, permissionResourceType: DATA_ENTITY })` (lines 70-80) — dep-array `[dataEntityId]` at line 80",
    "render `DataEntityDetailsHeader` inside a `WithPermissionsProvider` only when `details.id` is set AND `isDataEntityDetailsFetching` is false (lines 84-106)",
    "render the persistent `DataEntityDetailsTabs` strip below the header (lines 107-109)",
    "render `DataEntityDetailsRoutes` (the nested `<Routes>` switcher: 13 top-level Route registrations = 12 named sub-tabs + the index redirect to overview, per `DataEntityDetailsRoutes.tsx:42-151`) — always, regardless of fetching state (line 119)",
    "render `DataEntityDetailsSkeleton` while fetching (lines 112-118)",
    "render `AppErrorPage` when `isDataEntityDetailsNotFetched` is true (lines 120-123)"
  ]
- invariants: [
    "The component never directly fetches data — every read goes through `dispatch(...)` of a Redux thunk; the Redux slice owns the status / cache lifecycle",
    "**Per-mount steady-state dispatch profile is 5 logical AND 5 actual: 1 × `fetchDataEntityDetails` (post-fix) + 1 × alerts-counts + 1 × DQ-test-report + 1 × SLA-report + 1 × resource-permissions = 5 backend HTTP calls per page-open. Net backend view_count delta per page-open: +1 (hop-1 multiplicity=1 × hop-2 thunk ×1 × hop-3 controller ×1 × hop-3.5 service ×1 × hop-4 repo +1 UPDATE). Pre-fix this read 6 calls / +2 — the historical LSN-017 state pinned by P-004**",
    "The 4-element dep-array (lines 63-68) on the details fetch contains ONLY externally-driven values (`dataEntityId` + three group-status flags) — the response-derived 5th dep is removed and its prohibition is documented in-source (lines 56-60)",
    "Refetch-after-status-change is an explicit dispatch at the mutation site (`StatusSettingsForm.tsx:100`), not a reactive dep — the two-writer contract: this component owns mount/navigation/DEG-driven fetches; the status form owns the post-status-update fetch",
    "Skeleton, content, and error UI are exclusive but the routes outlet (`<DataEntityDetailsRoutes />`) renders unconditionally (line 119) — child route components must handle the loading state themselves",
    "`DataEntityDetailsRoutes` is a sibling, not a child, of the header+tabs render — child route components share the same `details` Redux state via their own `useAppSelector(getDataEntityDetails(dataEntityId))` calls (verified in `DataEntityDetailsTabs.tsx:37`)",
    "**ZERO components in the catalog now carry the response-derived-dep-array shape** — the batch-Q negative cluster (PolicyList, RolesList, OwnersList, CollectorsList) + batch-U TermDetails were already negative; CTRIB-004 removes the sole positive instance (this file)"
  ]
- audiences: [
    "ODD Platform UI end-user — every entity-detail page navigation lands on this component (the only entry point for `/dataentities/:id/*` routes per `App.tsx:69-71`; the component renders 12 named sub-tabs)",
    "Redux store (downstream side-effect consumers — owners.slice, metadata.slice, dataentities.slice all `addCase` against `fetchDataEntityDetails.fulfilled`)",
    "F-001 P-01:F-001 Popular Entities Ranking — post-fix, each page-open contributes exactly +1 to the view_count signal the home-page Popular strip ranks by (parity with direct API calls; the 2× UI amplifier is removed)"
  ]

## upstream_callers

**Schema v0.3.0 — who triggers this component / what entry path mounts it.**

- `react-router-dom <Route>` registration `App.tsx:69-71` — `<Route path={dataEntitiesPath()}>` wrapping `<Route path=':dataEntityId/*' element={<DataEntityDetails />} />` (lazy import at `App.tsx:31`); base path `/dataentities` per `routes/dataEntitiesRoutes.ts:4`. Every internal link constructed via `dataEntityDetailsPath(id, path)` (`routes/dataEntitiesRoutes.ts:66-73`) navigates here. — confidence: HIGH (route mount read directly this pass).
- Direct deep-link navigation from external sources (browser bookmarks, Slack alert links, email notifications) — the operator-facing landing page for any lookup that resolves to a numeric data entity id; the platform's primary URL-shareable surface.
- Internal navigation from within the UI: Search results, Catalog Overview's Popular / My Objects / Upstream / Downstream tiles, Directory leaves, Lineage graph node clicks, Alert list rows, DEG member list, Activity feed entity references, Query Examples linked datasets, Term linked entities — each constructs links via `dataEntityDetailsPath(id)` (`routes/dataEntitiesRoutes.ts:66-73`).
- **PopularStrip click-target — F-001 loop, post-fix at parity**: the home-page Popular column (rendered by `OwnerEntitiesList.tsx:99-105`) wraps each tile in a `<Link to={dataEntityDetailsPath(item.id)}>` (`DataEntityList.tsx:38`). Clicking a Popular tile mounts THIS component, which fires `fetchDataEntityDetails` ONCE, incrementing `view_count` by +1 — ordinary view-feedback, no longer the 2×-amplified self-reinforcement loop pre-fix (history: pre-fix each click contributed +2, PRIMARY-SOURCE CONFIRMED batch-J via the PopularStrip sidecar).
- Mount multiplicity per navigation: **1 dispatch of the details fetch per mount** (post-fix; dep-array lines 63-68 contains no response-derived value). Pre-fix this was 2 (the LSN-017 headline, P-004-measured).

## downstream_side_effects

**Schema v0.3.0 — what this component's lifecycle actually causes when mounted.**

- **5 Redux thunk dispatches per mount = 5 backend HTTP requests per mount** (post-fix; pre-fix 6 due to LSN-017) — confidence: HIGH (dep-arrays read directly; e2e pinned by IT-002 GREEN 2026-06-11):
  - **1 × `dispatch(fetchDataEntityDetails({ dataEntityId }))` (line 62).** Issues `GET /api/dataentities/{id}` (`dataentities.thunks.ts:35-42`); backend per-call side effect is `UPDATE data_entity SET view_count = view_count + 1` (`ReactiveDataEntityRepositoryImpl.java:173-180` via `DataEntityServiceImpl.getDetails` @ReactiveTransactional — backend contract UNCHANGED by the fix, re-pinned by IT-001/P-001). The `switchOffErrorMessage: true` (`dataentities.thunks.ts:41`) suppresses the global error toast; AppErrorPage handles error display.
  - 1 × `dispatch(fetchDataEntityAlertsCounts({ dataEntityId, status: AlertStatus.OPEN }))` (line 71).
  - 1 × `dispatch(fetchDataSetQualityTestReport({ dataEntityId }))` (line 72).
  - 1 × `dispatch(fetchDataSetQualitySLAReport({ dataEntityId }))` (line 73).
  - 1 × `dispatch(fetchResourcePermissions({ resourceId: dataEntityId, permissionResourceType: DATA_ENTITY }))` (lines 74-79).
- **Backend `view_count` mutation per mount: +1 (FIXED).** Empirical evidence: IT-002 (odd-team integration-tests, run-log 2026-06-11) RED pre-fix (one page-open → view_count 2) and GREEN post-fix (==1); probe P-004's assertion flipped 2→1. Historical: P-004 run R-20260519T010758Z measured xhr_count=2 + DB delta=2 against the pre-fix code. The per-call +1 backend delta (hop-4) is unchanged (P-001/IT-001). — confidence: HIGH (MEASURED at both states).
- **Redux store mutations on response landing** (triple-slice fan-out, re-verified this pass):
  - `dataentities.slice.ts:97-99` — `byId[id]` populated with the full `DataEntityDetails` payload.
  - `owners.slice.ts:53` — owner records extracted from the response and merged into the owners slice.
  - `metadata.slice.ts:18` — metadata field values merged into the metadata slice.
  - A field-name change on the DataEntityDetails contract could silently break the metadata-slice or owners-slice extraReducer without breaking compilation.
- **Re-fetch triggers (the dep-array at lines 63-68)** — all 4 are externally driven; confidence: HIGH:
  - `dataEntityId` change → navigating between entities.
  - `isDataEntityGroupUpdated` change → user updated DEG metadata elsewhere; re-fetch picks up changed group membership.
  - `isDataEntityAddedToGroup` change → entity added to a DEG; re-fetch surfaces the new group.
  - `isDataEntityDeletedFromGroup` change → entity removed from a DEG; re-fetch drops the group.
  - (REMOVED: `details.status?.status` — the LSN-017 bug dep. Status-driven refetch now arrives as an external dispatch from `StatusSettingsForm.tsx:100`, which also costs +1 view_count per status change — see performance.)
- **Render-time UI render of**: `DataEntityDetailsHeader` (9 props, lines 94-104), `DataEntityDetailsTabs` (no props; reads Redux directly), `DataEntityDetailsRoutes` (lazy-loaded sub-route switcher, line 119).

## dependencies_semantic

- requires-feature: [
    "Data Discovery — live page `https://docs.opendatadiscovery.org/features/data-discovery/entity-detail-page` (status 200, WebFetched 2026-06-11) documents this exact surface including the 'General panel — view count caveats' section; live page `.../catalog-overview` (status 200, WebFetched 2026-06-11) documents the Popular tile this component's view_count signal feeds",
    "**F-001 P-01:F-001 Popular Entities Ranking — this component is the PRODUCER (hop-1) of the `view_count` signal** consumed by the Popular tile (consumer orderBy `view_count DESC` at `ReactiveDataEntityRepositoryImpl.java:633` per REFACTOR-220). Post-fix the producer multiplicity is 1 per page-open; the backend-side REFACTOR-220 concerns (read-as-write, no rate-limit, no dedup) remain open and are NOT addressed by this UI fix",
    "the sub-tab surfaces reachable from the routes outlet: Overview / Structure (datasets) / Lineage / Test reports (datasets) / History / Alerts / Linked entities / Activity / Discussions / Query examples / Data / Relationships (per `DataEntityDetailsRoutes.tsx:42-151` and `DataEntityDetailsTabs.tsx:45-...`)"
  ]
- requires-config: [] — N/A. The component reads no runtime config keys; behaviour is entirely fixed at compile time.
- requires-runtime: [
    "React 18 / `useEffect` semantics — `Object.is` comparison per dep between renders; post-fix all 4 deps are externally driven so the effect cannot be re-fired by its own response (the pre-fix bug mechanism)",
    "Redux Toolkit `createAsyncThunk` with `handleResponseAsyncThunk` wrapper (`redux/lib/handleResponseThunk`) — provides the `.fulfilled` action type the slice reducers match on",
    "react-router-dom v6 `useParams` + `useDataEntityRouteParams()` helper at `routes/dataEntitiesRoutes.ts:47-59` — parses `:dataEntityId` as a base-10 integer (no NaN guard; an invalid route param yields `NaN` which passes through every selector and the API call)",
    "the generated `DataEntityApi` client (`generated-sources`) — the actual transport for `GET /api/dataentities/{id}`",
    "Material-UI `Grid` — single layout primitive used at line 107",
    "Vitest as the project's test runner (per `odd-platform-ui/package.json:10`: `\"test\": \"vitest\"`)"
  ]
- couples-to: [
    "`fetchDataEntityDetails` thunk (`redux/thunks/dataentities.thunks.ts:35-42`) — wraps `dataEntityApi.getDataEntityDetails({ dataEntityId })`; post-fix this component dispatches it once per mount/dep-change. The thunk's invariants (one-call-per-dispatch, no cache, no retry, no debounce, no in-flight de-dup) are unchanged",
    "**`StatusSettingsForm` (`components/shared/elements/EntityStatus/StatusSettingsForm/StatusSettingsForm.tsx`) — the second dispatcher of `fetchDataEntityDetails` for this page.** Its `onSubmit` (lines 77-102) awaits the status PUT (line 94), optimistically writes the new status into `dataEntities.byId` via `updateEntityStatus` (line 95 → slice reducer `dataentities.slice.ts:73-83`), then explicitly re-fetches the full entity (line 100) because status changes have server-side effects beyond the status field (comment lines 96-99, citing #1764). This is the relocated refetch the removed dep used to provide",
    "`fetchDataEntityAlertsCounts`, `fetchDataSetQualityTestReport`, `fetchDataSetQualitySLAReport`, `fetchResourcePermissions` thunks (imported at `DataEntityDetails.tsx:4-10`)",
    "`getDataEntityDetails` selector (`redux/selectors/dataentity.selectors.ts:93-97`) — falls back to `emptyObj` when the entry is missing, so `details.id` is `undefined` on first render (gating line 84's render)",
    "`getDataEntityDetailsFetchingStatuses` + `getDataEntityDetailsFetchingError` selectors (`dataentity.selectors.ts:159-164`) — drive Skeleton / Error UI",
    "`getResourcePermissions` selector (populates `WithPermissionsProvider`)",
    "`getDataEntityAddToGroupStatuses`, `getDataEntityDeleteFromGroupStatuses`, `getDataEntityGroupUpdatingStatuses` selectors (`DataEntityDetails.tsx:39-54`) — DEG-membership lifecycle flags that legitimately trigger re-fetch",
    "`useDataEntityRouteParams` (`routes/dataEntitiesRoutes.ts:47-59`)",
    "`DataEntityDetailsHeader` child (`./DataEntityDetailsHeader/DataEntityDetailsHeader.tsx`)",
    "`DataEntityDetailsTabs` child (`./DataEntityDetailsTabs/DataEntityDetailsTabs.tsx:27-44`) — reads same details via `getDataEntityDetails(dataEntityId)` independently (line 37)",
    "`DataEntityDetailsRoutes` child (`./DataEntityDetailsRoutes/DataEntityDetailsRoutes.tsx:32-156`) — owns the sub-route switcher",
    "`DataEntityDetailsSkeleton`, `AppErrorPage`, `SkeletonWrapper`, `WithPermissionsProvider` (shared elements)",
    "Backend endpoint `GET /api/dataentities/{id}` (hop-3 controller per neighbour sidecar `odd-platform__java__DataEntityController__controller-method__getDataEntityDetails.md` — per-call +1 view_count confirmed by P-001/IT-001) → service `DataEntityServiceImpl.getDetails` (@ReactiveTransactional, REFACTOR-201 read-as-write) → repository `ReactiveDataEntityRepositoryImpl.incrementViewCount` (`:173-180`) → DB row write-lock"
  ]

## tests_coverage_semantic

- covered_behaviours:
  - behaviour: "**One UI page-open registers exactly +1 view_count end-to-end (UI mount → single GET → backend UPDATE)** — the LSN-017 regression-pin"
    test_class: integration
    test_files: ["odd-team `integration-tests` IT-002 (run-log 2026-06-11: RED pre-fix with view_count==2, GREEN post-fix with view_count==1) — lives in the odd-team workspace, NOT in the odd-platform repo", "probe P-004 (assertion flipped 2→1 post-fix; historical run R-20260519T010758Z-P-004 measured the pre-fix +2)"]
    confidence: HIGH
  - behaviour: "Backend per-call contract `GET /api/dataentities/{id}` → +1 view_count is unchanged by the UI fix"
    test_class: integration
    test_files: ["odd-team IT-001 / probe P-001 (5 sequential GETs → +5)"]
    confidence: HIGH
- uncovered_behaviours:
  - behaviour: "**In-repo Vitest component pin: useEffect dispatches `fetchDataEntityDetails` exactly once per mount, and NEVER re-fires when the fulfilled response updates `details.status`** — the component-level regression-pin that would catch a reintroduced response-derived dep at PR time, without needing the full e2e stack (IT-002 covers this only at the odd-team integration tier)"
    test_class: unit
    criticality: HIGH
    note: "react-testing-library mount inside MemoryRouter + mock store; assert 1 dispatch on mount, 0 additional after fulfilled lands. The guard comment (lines 56-60) is prose; only a test makes it executable."
  - behaviour: "useEffect re-fires exactly once when `dataEntityId` changes (URL navigation between two entities)"
    test_class: unit
    criticality: MEDIUM
    note: "rerender with a different `:dataEntityId` route param; total = 2 dispatches across the 2 mounts"
  - behaviour: "useEffect re-fires when `isDataEntityGroupUpdated` / `isDataEntityAddedToGroup` / `isDataEntityDeletedFromGroup` flips — the legitimate dep-array entries (lines 65-67)"
    test_class: unit
    criticality: MEDIUM
    note: "proves the dep-array correctly catches DEG mutations — the deps that must STAY when someone 'cleans up' the array"
  - behaviour: "second useEffect (lines 70-80) dispatches the 4 ancillary fetches exactly once per mount, not re-firing on details-fetch completion"
    test_class: unit
    criticality: MEDIUM
    note: "locks the `[dataEntityId]` dep-array shape at line 80"
  - behaviour: "StatusSettingsForm.onSubmit dispatches exactly one `fetchDataEntityDetails` after a successful status update (the relocated refetch — `StatusSettingsForm.tsx:100`)"
    test_class: unit
    criticality: HIGH
    note: "the OTHER half of the CTRIB-004 contract: if this dispatch is dropped, status changes stop refreshing the page (stale lineage/group relations after DELETED/restore); if it is duplicated, the doubling returns via a different door. Cross-component — belongs to the StatusSettingsForm node but recorded here because the contract is bilateral."
  - behaviour: "renders `DataEntityDetailsSkeleton` while fetching; `AppErrorPage` when `isNotLoaded`; routes outlet renders unconditionally (line 119)"
    test_class: unit
    criticality: LOW
    note: "render-state machine assertions (lines 84-123)"
  - behaviour: "invalid route param `:dataEntityId='abc'` yields `NaN` and the component dispatches `fetchDataEntityDetails({ dataEntityId: NaN })`"
    test_class: unit
    criticality: LOW
    note: "documents the missing NaN guard (`dataEntitiesRoutes.ts:53`)"
- test_files: [] — **No test files exist in the odd-platform repo that exercise this component.** Re-verified 2026-06-11 at the current working tree: Glob `odd-platform-ui/src/**/*.{test,spec}.{ts,tsx}` under `<odd-platform-repo>` → no files; Glob `odd-platform-ui/src/**/__tests__/**` → no files; Glob `tests/**` under `<odd-platform-repo>` → no files (no repo-root e2e harness in this checkout). The regression coverage that exists (IT-002, P-004) lives in the odd-team workspace.
- gaps: |
    Post-fix, the highest-leverage gap shifts from "pin the bug" to "make the fix cheap to defend": IT-002 (odd-team, full docker stack) catches a reintroduced doubling but runs outside odd-platform's CI. The missing in-repo Vitest pin ("exactly 1 details dispatch per mount; 0 after fulfilled") would catch the regression at PR time for the cost of a component test — the guard comment at lines 56-60 is the intent, the test is the enforcement. Second-priority: the bilateral contract with StatusSettingsForm (its explicit dispatch at line 100) has no test on either side; dropping it silently degrades status-change UX (stale soft-delete/lineage state) rather than breaking loudly. The unit tier has the worst coverage on this node (zero in-repo tests); the integration tier is the only covered tier and it lives out-of-repo.

## docs_link_semantic

- declared_docs: [] — no `@docs` annotation in the component file or its imports.
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/entity-detail-page"
    anchor: "#general-panel-view-count-caveats"
    rationale: "The live page documenting THIS surface (titled 'Data entity detail page'), including a 'General panel — view count caveats' section that documents the view-count mechanism end-to-end."
    last_verified_at: "2026-06-11T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Verbatim (WebFetched 2026-06-11): "Opening a detail page registers as +2, not +1. Each page-open fetches the entity detail twice, and each fetch bumps the view count by one — so a single visit adds **2** to the number, not 1."
      Verbatim: "View count is the sole signal behind the home-page Popular ranking, and it is trivially inflatable."
      Verbatim: "View count is bumped on every detail-page fetch with no rate limit, no per-user de-duplication, and no authentication required... A short scripted read loop can therefore push any chosen entity to the top of the Popular column."
      NOTE: the +2 claim is CORRECT for the latest published release (<= 0.27.x, which ships the pre-fix UI). The working-tree fix (CTRIB-004 / #1764) makes it +1 from 0.28.0.
    pending_release: "0.28.0"
    train_ref: "release/0.28.0 @ a0199ae — the fixed-note (+1 from 0.28.0) rides the documentation release train and publishes at the release gate"
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/catalog-overview"
    anchor: ""
    rationale: "Documents the Popular tile (the consumer of the view_count signal this component produces) and the per-entity Overview tab framing."
    last_verified_at: "2026-06-11T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Verbatim (WebFetched 2026-06-11): Popular tile = "the most-viewed data entities across the catalog, ranked by view count alone (highest first)".
      Verbatim: "View count, in turn, is bumped by **+1 every time a detail page is fetched**, with no rate limit... and opening a detail page registers as **+2**, not +1".
      Verbatim: per-entity Overview tab = "the landing tab inside any data entity's detail page — entity description, owners, tags, terms, custom metadata".
      Same release-train state as entity-detail-page: the "+2" sentence describes the latest published release and is updated on the 0.28.0 train.
    pending_release: "0.28.0"
    train_ref: "release/0.28.0 @ a0199ae"
- doc_drift_findings:
  - "**No active drift.** The live docs' '+2 per page-open' statement (both pages, verified 2026-06-11) is CORRECT for the latest published release; the working-tree fix is unreleased. The corrected '+1 from 0.28.0' note rides documentation branch `release/0.28.0` (commit a0199ae) and publishes at the release gate — managed release-train routing per `adrs/drafts/release-train-doc-gating.md`, NOT drift. A post-0.28.0-release enrichment must re-verify the live pages flipped to +1 (if 0.28.0 publishes and the live pages still say +2, THAT becomes drift)."
  - "RESOLVED (was drift in the 2026-05-19/20 enrichment): the view-count side-effect and the LSN-017 doubling were then undocumented end-to-end (DOC-GAP-085 / DOC-GAP-101). The live `entity-detail-page` 'General panel — view count caveats' section now documents the mechanism, the doubling, the no-rate-limit posture, and the inflation warning verbatim."

## implicit_adrs

- "**Response-derived values are banned from fetch-effect dependency arrays; refetch-after-mutation is dispatched explicitly at the mutation site.** The decision (introduced by CTRIB-004 / #1764) splits fetch ownership: the page component's effect re-fetches only on externally-driven signals (route param, DEG flags); any mutation needing a fresh read dispatches the fetch itself after the mutation succeeds. This is now stated intent, not just convention." — evidence: DataEntityDetails.tsx:56-60 + StatusSettingsForm.tsx:96-99 — intent_anchor: "details.status?.status must NOT be a dependency here: it is populated by this fetch's own fulfilled action, so listing it re-fires the effect once per first visit — every page-open registered two GET /api/dataentities/{id} calls and the backend counted +2 views per visit (#1764). The refetch a status change needs is dispatched explicitly by StatusSettingsForm after the status update succeeds." — confidence: HIGH
- "**The component owns the data-fetch lifecycle, not the route shell or a feature provider.** Fetching is colocated at the page-component layer rather than (a) a route loader (react-router-dom@6 `loader` unused), (b) an outer context provider, or (c) the child Overview tab. Consistent across the platform's detail pages." — evidence: DataEntityDetails.tsx:61-80 (two useEffects co-located in the top page component) — intent_anchor: "the structural pattern of `useEffect → dispatch(...)` at the page-component layer applied consistently across `/dataentities/:id/*` AND across the LSN-017 negative cluster (PolicyList, RolesList, OwnersList, CollectorsList, TermDetails)" — confidence: HIGH
- "**Skeleton + content + error are exclusive renders, but the routes outlet renders unconditionally.** Header+tabs are visible only when content is ready (line 84 `details.id && !isDataEntityDetailsFetching`), but `DataEntityDetailsRoutes` always renders (line 119) — child route components handle their own loading state independently." — evidence: DataEntityDetails.tsx:82-125 (the conditional vs unconditional split) — intent_anchor: "the unconditional `<DataEntityDetailsRoutes />` at line 119, parallel to the conditional header+tabs at lines 84-110" — confidence: HIGH
- "**Permissions are passed via context, not via props.** The header is wrapped in `WithPermissionsProvider` carrying 3 allowedPermissions + the `resourcePermissions` selector result (lines 86-92) — React Context rather than prop-drilling permission checks through the header → action buttons chain." — evidence: DataEntityDetails.tsx:86-106 — intent_anchor: "the `WithPermissionsProvider` wrapper as the consistent permission-gating primitive across pages (TermDetails uses the same pattern with [TERM_UPDATE, TERM_DELETE])" — confidence: HIGH

## bugs_limitations_corner_cases

- "**LSN-017 — FIXED IN WORKING TREE (CTRIB-004 / #1764), history preserved.** Pre-fix, the 5th dep-array element `details.status?.status` was derived from the fetch response: the first fetch landing flipped the dep from `undefined` to a concrete enum value, triggering a second identical fetch — exactly 2 GETs / +2 view_count per page-open, empirically pinned by probe P-004 (run R-20260519T010758Z-P-004: xhr_count=2 + DB delta=2). Post-fix the dep-array (lines 63-68) holds only `dataEntityId` + the 3 DEG flags; the guard comment (lines 56-60) documents the prohibition; the status-change refetch moved to `StatusSettingsForm.tsx:100`. Verified: IT-002 RED pre-fix (view_count==2 per open) → GREEN post-fix (==1), odd-team run-log 2026-06-11; P-004 assertion flipped 2→1. Pre-fix blast radius (historical): 2× Popular-ranking signal per open, 2×-cheaper UI inflation vs API, 2× REFACTOR-221 seq-scan growth rate, 2× REFACTOR-201 txn contention. **Residual risk**: the fix is enforced by comment + out-of-repo IT-002 only — no in-repo Vitest pin guards the dep-array against a future 'refetch on status change' re-addition (see tests_coverage_semantic)." — evidence: DataEntityDetails.tsx:56-68 (fixed locus) + StatusSettingsForm.tsx:94-101 (relocated refetch) + retrospectives/LSN-017-per-node-scan-cannot-see-cross-layer-user-effects.md + lineage/odd-platform/probe-runs/2026-05-19-P-004.yaml (pre-fix measurement) — severity: LOW (was HIGH pre-fix; residual = regression-protection gap, not active defect)
- "**Invalid route param `:dataEntityId` yields `NaN` with no client-side guard.** `useDataEntityRouteParams()` (`routes/dataEntitiesRoutes.ts:47-59`) calls `parseInt(dataEntityId, 10)` with no `Number.isNaN` check — a manually-typed bad URL dispatches `fetchDataEntityDetails({ dataEntityId: NaN })`, travelling to the backend as the literal `'NaN'`. The backend rejects it but no UI-side error is emitted at the source. A `Number.isFinite` guard at the top of the component would surface the error at the right layer. Same gap in TermDetails (`routes/termsRoutes.ts`)." — evidence: routes/dataEntitiesRoutes.ts:53 + DataEntityDetails.tsx:32 (consumes the parsed value) + DataEntityDetails.tsx:62 (dispatches without validation) — severity: LOW
- "**No abort/cleanup on either useEffect — rapid URL navigation issues overlapping fetches with no cancellation.** Navigating A → B → C quickly fires 5 dispatches per transition; a slow A-fetch resolving after the user reached C still applies to `byId[A]` (store stays consistent, keyed by id) but the network round-trip and the backend view_count increment for A are spent. No AbortController plumbing exists; the thunk wrapper (`dataentities.thunks.ts:35-42`) accepts no signal. Post-fix the waste is half the pre-fix rate (1 details GET per transition, not 2)." — evidence: DataEntityDetails.tsx:61-80 (no cleanup function returned) + dataentities.thunks.ts:35-42 — severity: LOW
- "**The component does not discriminate backend error types.** Fetch lifecycle surfaces `isNotLoaded` + the stored error envelope to `AppErrorPage` (lines 120-123) with no status-specific branching in this component — a 403 (if per-entity authz ever lands) would be indistinguishable from a 404 at this layer." — evidence: DataEntityDetails.tsx:120-123 — severity: LOW (forward-looking)
- "**Skeleton-flicker on every re-fetch — including the new explicit status-change refetch.** Any `fetchDataEntityDetails` dispatch flips `isDataEntityDetailsFetching=true`, hiding header+tabs (line 84 predicate fails on `!isDataEntityDetailsFetching`) until the response lands. This affects DEG-flag re-fetches AND the relocated status-change refetch from `StatusSettingsForm.tsx:100` — after every status update the page chrome blinks once. A `isFetching && !details.id` (first-load-only skeleton) split would smooth it. Post-fix the flicker fires once per trigger (pre-fix: twice)." — evidence: DataEntityDetails.tsx:84 (the render gate) + StatusSettingsForm.tsx:100 (the new trigger) — severity: LOW

## security

- **auth_mode_relevance**: `INTERNAL_ONLY` — a UI component in the user's browser; it does not enforce auth modes. Every backend call it triggers inherits the platform's auth posture per neighbour sidecar `odd-platform__java__DataEntityController__controller-method__getDataEntityDetails.md`: LOGIN_FORM / OAUTH2 / LDAP require authentication; DISABLED admits anonymous callers; S2S `N/A` (UI surface, not ingestion). Under `auth.type=DISABLED`, opening this page anonymously triggers a +1 view_count side-effect (post-fix; was +2) with no audit trail — the backend per-call posture is P-002-proven (run R-20260519T003811Z-P-002: 10 anon GETs = +10).
- **ingestion_filter_relevance**: `NO — UI/API surface on /api/dataentities/{id}, not /ingestion/entities`.
- **authorization_assertions**: [] — the component enforces no authorization. It passes a 3-permission vector (`DATA_ENTITY_INTERNAL_NAME_UPDATE`, `DATA_ENTITY_GROUP_UPDATE`, `DATA_ENTITY_STATUS_UPDATE`, lines 88-90) to `WithPermissionsProvider` for descendant mutation affordances; the **read** of the entity payload is unguarded. Any user who can reach the route (per the platform's auth mode) can mount this page and trigger all 5 dispatches.
- **owner_scoping**: `BYPASSES — no owner predicate at this layer` — the component passes `dataEntityId` directly to thunks without owner filtering; backend applies no owner scoping on the GET (read-collaborative posture per neighbour sidecar). No UI banner or signal marks reading another owner's entity.
- **data_exposure**:
  - "Triggers display of the full 34-field DataEntityDetails payload (description, ownership, tags, terms, metadata, dataSource, linkedUrlList, soft-delete state) to any user able to mount the route — same exposure as the backend endpoint, surfaced visually"
  - "Triggers display of alert counts, DQ test reports, SLA reports (lines 71-73) — under the read-collaborative posture an authenticated user sees every entity's alert/quality status"
  - "Permissions vector via WithPermissionsProvider — absent permissions hide UI affordances but do NOT block backend access (backend owns the load-bearing authz layer)"
- **known_security_gaps**:
  - "**view_count inflation parity restored — the UI is no longer a 2× amplifier.** Pre-fix, one page-render = +2 vs one curl = +1 (UI inflation twice as cheap, P-004-measured). Post-fix both paths cost +1 per request. The REMAINING inflation surface is backend-owned: no rate-limit, no per-user dedup, no auth requirement under DISABLED on the +1-per-GET endpoint (REFACTOR-220; live docs now warn operators verbatim: 'A short scripted read loop can therefore push any chosen entity to the top of the Popular column'). Nothing in this component can or should fix that." — evidence: DataEntityDetails.tsx:61-68 (single dispatch) + lineage/odd-platform/refactoring-scopes/detail/REFACTOR-220.md + WebFetch entity-detail-page 2026-06-11 — severity: LOW (was MEDIUM pre-fix; residual concern is backend-side)
  - "**DISABLED-mode page-open is anonymous and inflates view_count (+1 post-fix).** P-002 confirmed the backend admits anonymous GETs under `auth.type=DISABLED`; opening this UI component anonymously contributes +1 per open with no audit trail. The home-page Popular strip is hidden under DISABLED (`Overview.tsx:25-27` `isShowOwnerAssociation` gate per F-001.yaml facet), but direct deep-links to `/dataentities/{id}/overview` and the raw API path remain open." — evidence: DataEntityDetails.tsx:61-80 (no auth-mode-aware gating) + lineage/odd-platform/probe-runs/2026-05-19-P-002.yaml + F-001.yaml facet `disabled_mode_bypass` — severity: MEDIUM (under default config; the 2× amplifier component of the pre-fix HIGH rating is removed)
  - "**Permission gating is silent — no access-level indicator for the user.** Absent permissions make edit affordances disappear with no tooltip/banner; users cannot self-diagnose and operators auditing intent have no trail." — evidence: DataEntityDetails.tsx:86-106 (silent gating via WithPermissionsProvider) — severity: LOW (UX-adjacent)

## performance

- **hot_paths**:
  - "**Component mount → 5 Redux dispatches → 5 backend GET requests (post-fix; was 6).** Every entity-detail navigation runs this lifecycle. Probe P-003 baseline (run R-20260519T003916Z-P-003): backend `GET /api/dataentities/{id}` p50=106ms, p95=202ms, p99=1539ms. Mount wall-clock latency is bounded by `max(per-fetch-latency)` of the 5 parallel requests. F-001 chain composition post-fix: 1 (this hop) × 1 (thunk) × 1 (controller) × 1 (service) × +1 (repository UPDATE) = +1 view_count per page-open; the redundant duplicate GET + duplicate hot-row UPDATE per open is eliminated." — evidence: DataEntityDetails.tsx:61-80 + lineage/odd-platform/probe-runs/2026-05-19-P-003.yaml + odd-team IT-002 run-log 2026-06-11
  - "Re-fetch on DEG-membership change — flipping any of the 3 group flags triggers one fresh `fetchDataEntityDetails` (was two pre-fix)." — evidence: DataEntityDetails.tsx:63-68
  - "**New post-fix cost: every status change = 1 status PUT + 1 full details re-fetch (+1 view_count).** The explicit refetch at `StatusSettingsForm.tsx:100` re-reads the entity after each status update because status mutations have server-side effects beyond the status field (soft-delete/restore of lineage and group relations, per the comment at lines 96-99). Deliberate trade: full-payload re-read + view-count tick per status change, instead of the reactive dep that doubled EVERY page-open." — evidence: StatusSettingsForm.tsx:94-101
- **throughput_characteristics**:
  - "Single mount per route navigation — no batch / no multiplexing; each detail-page open is one independent request set."
  - "Post-fix the hottest UI path issues exactly one `GET /api/dataentities/{id}` per open. The REFACTOR-221 concern (no index on view_count → seq-scan per Popular render) persists, but the 2× growth-rate amplifier on distinct view_count values is removed."
- **resource_allocation**:
  - "No client-side caching layer between Redux and the network — every dispatch issues a fresh fetch; `byId[id]` serves only in-session selector reads."
  - "5 parallel thunks per mount each open a separate XHR — under Chrome's ~6-per-host parallelism limit with headroom of 1 (pre-fix the 6th LSN-017 call consumed the full budget)."
  - "No virtualisation needed at this component (single page, not a list); virtualisation lives in child components."
- **scaling_characteristics**:
  - "Stateless component — tabs/users navigate independently; no shared state."
  - "No pagination at this surface (single entity render per route)."
  - "**Hot-row contention on `data_entity.view_count` is back to 1× per page-open.** The REFACTOR-201 read-as-write @ReactiveTransactional scope still holds the row write-lock for the full enrichment chain per GET — but two concurrent operators opening the same entity now fire 2 transactions total, not 4 (pre-fix the LSN-017 doubling multiplied lock-acquisition rate 2×)." — evidence: DataEntityDetails.tsx:61-68 + lineage/odd-platform/refactoring-scopes/detail/REFACTOR-201.md
- **known_performance_gaps**:
  - "**No request coalescing / deduplication at the thunk layer.** Two simultaneous dispatches of `fetchDataEntityDetails({ dataEntityId: 42 })` fire independent fetches — no in-flight tracking. Practical risk is low (this component dispatches once per mount post-fix; StatusSettingsForm dispatches only after a successful PUT), but the pattern remains unguarded — a third dispatcher added later would stack freely." — evidence: dataentities.thunks.ts:35-42 (fire-and-await wrapper, no in-flight check) — severity: LOW
  - "**Skeleton flicker on every re-fetch (DEG flags + the explicit status-change refetch)** — render gate at line 84 hides the chrome whenever `isDataEntityDetailsFetching` is true; cost is UX-only, once per trigger post-fix." — evidence: DataEntityDetails.tsx:84 + StatusSettingsForm.tsx:100 — severity: LOW
  - "RESOLVED (was MEDIUM): the LSN-017 2× network + 2× hot-row-UPDATE cost per page-open is eliminated by the dep-array fix; at the pre-fix hypothetical 1000 opens/hour the surplus was 1000 redundant GETs + 1000 redundant view_count UPDATEs per hour." — evidence: DataEntityDetails.tsx:61-68 + odd-team IT-002 (GREEN ==1)

## sources

- understanding ← odd-platform-ui/src/components/DataEntityDetails/DataEntityDetails.tsx:1-128 (whole file re-read 2026-06-11 at working tree 8c142e15+CTRIB-004; fix comment 56-60, fixed dep-array 63-68) + odd-platform-ui/src/components/shared/elements/EntityStatus/StatusSettingsForm/StatusSettingsForm.tsx:77-102 (relocated refetch) + odd-platform-ui/src/components/App.tsx:69-71 (route mount) + LSN-017 case-law + odd-team IT-002 run-log 2026-06-11
- concepts.entities ← DataEntityDetails.tsx:32-54,88-90,95-103 + odd-platform-ui/src/redux/thunks/dataentities.thunks.ts:17,35-42 + odd-platform-ui/src/redux/selectors/dataentity.selectors.ts:93-97,159-164 + odd-platform-ui/src/redux/slices/dataentities.slice.ts:97-99 + odd-platform-ui/src/routes/dataEntitiesRoutes.ts:47-59
- concepts.operations ← DataEntityDetails.tsx:30-125 (re-anchored against the post-fix line layout) + DataEntityDetailsRoutes.tsx:42-151
- concepts.invariants ← DataEntityDetails.tsx:56-80 (both dep-arrays + guard comment) + DataEntityDetails.tsx:119 (unconditional routes render) + StatusSettingsForm.tsx:94-101 (two-writer contract) + DataEntityDetailsTabs.tsx:37 (independent selector read) + retrospectives/LSN-017-per-node-scan-cannot-see-cross-layer-user-effects.md
- concepts.audiences ← DataEntityDetails.tsx:82-125 + dataentities.slice.ts:97 + owners.slice.ts:53 + metadata.slice.ts:18 (grep `fetchDataEntityDetails` over odd-platform-ui/src/redux/slices — exactly 3 fulfilled-consumers) + App.tsx:69-71
- upstream_callers ← App.tsx:31,69-71 (lazy import + route mount, read this pass) + routes/dataEntitiesRoutes.ts:4,47-59,66-73 + OwnerEntitiesList.tsx:99-105 + DataEntityList.tsx:38 (PopularStrip click target, carried from batch-J PRIMARY-SOURCE confirmation)
- downstream_side_effects ← DataEntityDetails.tsx:61-80 (the 2 useEffects, post-fix) + dataentities.thunks.ts:35-42 + dataentities.slice.ts:97-99 + owners.slice.ts:53 + metadata.slice.ts:18 + lineage/odd-platform/probe-runs/2026-05-19-P-004.yaml (pre-fix +2 measurement, historical) + odd-team IT-002 run-log 2026-06-11 (post-fix ==1) + StatusSettingsForm.tsx:95,100
- dependencies_semantic.requires-feature ← WebFetch https://docs.opendatadiscovery.org/features/data-discovery/entity-detail-page 2026-06-11 status 200 + WebFetch https://docs.opendatadiscovery.org/features/data-discovery/catalog-overview 2026-06-11 status 200 + lineage/odd-platform/refactoring-scopes/detail/REFACTOR-220.md + DataEntityDetailsRoutes.tsx:42-151
- dependencies_semantic.requires-runtime ← DataEntityDetails.tsx:1-28 (imports) + routes/dataEntitiesRoutes.ts:47-59 + odd-platform-ui/package.json:10 (Vitest)
- dependencies_semantic.couples-to ← DataEntityDetails.tsx:1-28 + StatusSettingsForm.tsx:12-13,77-102 + dataentities.slice.ts:73-83 (updateEntityStatus reducer) + DataEntityDetailsRoutes.tsx:32-156 + DataEntityDetailsTabs.tsx:27-44 + neighbour sidecars (getDataEntityDetails controller-method, DataEntityServiceImpl, ReactiveDataEntityRepositoryImpl)
- tests_coverage_semantic ← Glob `odd-platform-ui/src/**/*.{test,spec}.{ts,tsx}` under `<odd-platform-repo>` (no files, 2026-06-11) + Glob `odd-platform-ui/src/**/__tests__/**` (no files) + Glob `tests/**` under `<odd-platform-repo>` (no files — no repo-root e2e harness in this checkout) + odd-team IT-001/IT-002 run-log 2026-06-11 + lineage/odd-platform/probe-runs/2026-05-19-P-004.yaml
- docs_link_semantic.inferred_docs ← WebFetch https://docs.opendatadiscovery.org/features/data-discovery/entity-detail-page 2026-06-11 status 200 (excerpts quoted verbatim) + WebFetch https://docs.opendatadiscovery.org/features/data-discovery/catalog-overview 2026-06-11 status 200 (excerpts quoted verbatim); release-train state per refresh-context routing (documentation branch release/0.28.0 @ a0199ae) per adrs/drafts/release-train-doc-gating.md
- implicit_adrs.[0] ← DataEntityDetails.tsx:56-60 (guard comment, quoted verbatim as intent_anchor) + StatusSettingsForm.tsx:96-99 (mirror comment)
- implicit_adrs.[1] ← DataEntityDetails.tsx:61-80 + cross-cluster verification (TermDetails + PolicyList / RolesList / OwnersList / CollectorsList sidecars, carried from batch Q/U)
- implicit_adrs.[2] ← DataEntityDetails.tsx:82-125
- implicit_adrs.[3] ← DataEntityDetails.tsx:86-106
- bugs_limitations_corner_cases.[0] ← DataEntityDetails.tsx:56-68 (fixed locus) + StatusSettingsForm.tsx:94-101 + retrospectives/LSN-017-per-node-scan-cannot-see-cross-layer-user-effects.md + lineage/odd-platform/probe-runs/2026-05-19-P-004.yaml + odd-team IT-002 run-log 2026-06-11
- bugs_limitations_corner_cases.[1] ← routes/dataEntitiesRoutes.ts:53 + DataEntityDetails.tsx:32,62
- bugs_limitations_corner_cases.[2] ← DataEntityDetails.tsx:61-80 + dataentities.thunks.ts:35-42
- bugs_limitations_corner_cases.[3] ← DataEntityDetails.tsx:120-123
- bugs_limitations_corner_cases.[4] ← DataEntityDetails.tsx:84 + StatusSettingsForm.tsx:100
- security.auth_mode_relevance ← DataEntityDetails.tsx:30-128 (no auth-mode-aware code) + neighbour sidecar odd-platform__java__DataEntityController__controller-method__getDataEntityDetails.md + lineage/odd-platform/probe-runs/2026-05-19-P-002.yaml
- security.authorization_assertions ← DataEntityDetails.tsx:86-92 (3-permission vector; no programmatic check on read)
- security.owner_scoping ← DataEntityDetails.tsx:62 (dispatch with id only) + neighbour sidecar owner_scoping
- security.known_security_gaps.[0] ← DataEntityDetails.tsx:61-68 + REFACTOR-220.md + WebFetch entity-detail-page 2026-06-11 (inflation warning quoted)
- security.known_security_gaps.[1] ← DataEntityDetails.tsx:61-80 + lineage/odd-platform/probe-runs/2026-05-19-P-002.yaml + F-001.yaml facet `disabled_mode_bypass`
- performance.hot_paths ← DataEntityDetails.tsx:61-80 + lineage/odd-platform/probe-runs/2026-05-19-P-003.yaml + StatusSettingsForm.tsx:94-101 + odd-team IT-002 run-log 2026-06-11
- performance.scaling_characteristics ← DataEntityDetails.tsx:30-128 (stateless) + REFACTOR-201.md (read-as-write txn scope; contention now 1× per open)
- performance.known_performance_gaps ← dataentities.thunks.ts:35-42 + DataEntityDetails.tsx:84 + DataEntityDetails.tsx:61-68

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- upstream_callers: HIGH (route mount App.tsx:69-71 read directly this pass; PopularStrip closure carried from batch-J primary-source confirmation)
- downstream_side_effects: HIGH (post-fix +1 MEASURED by IT-002 GREEN 2026-06-11; pre-fix +2 MEASURED by P-004; both states empirically pinned)
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (in-repo absence re-verified at the working tree with named search roots; out-of-repo coverage cited to IT-001/IT-002 run-log)
- docs_link_semantic: HIGH (both live pages WebFetched 2026-06-11 status 200; release-train routing state recorded per refresh-context + release-train-doc-gating ADR — the train_ref commit a0199ae is orchestrator-provided, not independently read this session)
- implicit_adrs: HIGH (the new [0] is anchored on explicit in-source intent comments, quoted verbatim)
- bugs_limitations_corner_cases: HIGH (the headline item is the FIX, evidenced at both states; residual items re-anchored to post-fix lines)
- security: HIGH
- performance: HIGH (P-003 baseline measured; post-fix call-count and contention derived from the read dep-arrays + IT-002)

## Maintainer notes

(reserved — no existing maintainer-authored block to inherit from at batch ZA finalization)

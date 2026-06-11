---
node_id: "odd-platform ts redux-thunk thunk:fetchDataEntityDetails"
node_kind: redux-thunk
axis: ui_redux_thunks
extracted_at_commit: 80637ed
enriched_at_commit: contrib/CTRIB-004-view-count-double-fetch (base main @ 8c142e15)
extractor_version: 0.1.0
prompt_version: file-analyser/0.5.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-06-11-refresh-fetchDataEntityDetails
---

# fetchDataEntityDetails — semantic understanding

## understanding

`fetchDataEntityDetails` is a Redux Toolkit `createAsyncThunk` (built via the project's local `handleResponseAsyncThunk` wrapper) that takes `{ dataEntityId }`, calls `dataEntityApi.getDataEntityDetails({ dataEntityId })` (the OpenAPI-generated client for `GET /api/dataentities/{data_entity_id}`), and on `fulfilled` fans the resolved `DataEntityDetails` payload into **three** extraReducers — `dataentities.slice` (the entity minus metadata + ownership), `metadata.slice` (`metadataFieldValues`), and `owners.slice` (`ownership`). Since the #1764 fix (branch CTRIB-004, ships in 0.28.0) it is dispatched from exactly TWO sites: the `DataEntityDetails.tsx` useEffect — now exactly **one** dispatch per detail-page mount, the LSN-017 self-feeding `details.status?.status` dependency having been removed from the dep array (guard comment at `DataEntityDetails.tsx:56-60`) — and `StatusSettingsForm.onSubmit`, which refetches explicitly after a successful status update (`StatusSettingsForm.tsx:100`). Because the backend GET is not idempotent (+1 `data_entity.view_count` per call, per batch F sidecar), each dispatch still contributes one view to the Catalog Overview "Popular" ranking: one page-open = +1, PROBE-VERIFIED post-fix by P-004 (assertions flipped 2→1) and IT-002 (run-log 2026-06-11: pre-fix `Received: 2`, post-fix `1 passed`). Errors never toast (`{ switchOffErrorMessage: true }`) — the rejected `AppError` lands in `loader.errors['dataEntities/fetchDataEntityDetails']` and renders as the full-page `<AppErrorPage>` banner.

## concepts

- entities: [
    "`DataEntityDetails` (OpenAPI-generated response payload — 34 fields per batch F sidecar's enumeration; `dataentities.thunks.ts:36`)",
    "`DataEntityApiGetDataEntityDetailsRequest` (request envelope — `{ dataEntityId: number }`; `dataentities.thunks.ts:37`)",
    "`AppError` (error payload shape; `lib/errorHandling.tsx:5-10` — `{ status, statusText, url, message }`)",
    "Redux loader-slice (the cross-thunk pending/fulfilled/rejected ledger keyed by action type; `redux/slices/loader.slice.ts:14-51`)",
    "`fetchDataEntityDetailsActionType` (the dispatch-type prefix `'dataEntities/fetchDataEntityDetails'`; `redux/actions/dataentity.actions.ts:10-13`)",
    "soft-deleted entity (backend returns these intentionally; the thunk has no client-side filter — see batch F sidecar `bugs_limitations_corner_cases`)"
  ]
- operations: [
    "dispatch the thunk → write `pending` into `loader.statuses['dataEntities/fetchDataEntityDetails']` (`redux/slices/loader.slice.ts:28-34`)",
    "call `dataEntityApi.getDataEntityDetails({ dataEntityId })` (the OpenAPI-generated client; `dataentities.thunks.ts:40`)",
    "on success: write `fulfilled` to loader-slice + run three extraReducers that splice the payload into three different slices (`dataentities.slice.ts:97-99` + `metadata.slice.ts:18-36` + `owners.slice.ts:52-54`)",
    "on success: SKIP the success-toast — no `setSuccessOptions` passed (`dataentities.thunks.ts:41`)",
    "on error: write `rejected` + `AppError` payload to loader-slice (`redux/slices/loader.slice.ts:42-49`)",
    "on error: SKIP the error-toast — `{ switchOffErrorMessage: true }` short-circuits `showServerErrorToast` (`dataentities.thunks.ts:41` + `redux/lib/handleResponseThunk.ts:37-39`)",
    "feed `getDataEntityDetailsFetchingStatuses` + `getDataEntityDetailsFetchingError` selectors with the loader-slice state (`redux/selectors/dataentity.selectors.ts:159-164`)"
  ]
- invariants: [
    "exactly one HTTP call per dispatch (no client-side caching, no retry, no debounce, no in-flight de-dup) — verified by tracing `dataentities.thunks.ts:35-42` → no de-dup wrapper around `dataEntityApi.getDataEntityDetails`",
    "exactly ONE dispatch per detail-page mount since #1764 — the dep array at `DataEntityDetails.tsx:63-68` contains only `dataEntityId` + the three group-mutation loader booleans; `details.status?.status` is excluded and the exclusion is defended by the guard comment at `DataEntityDetails.tsx:56-60`",
    "the resolved payload fans into THREE slices simultaneously via three independent `extraReducers` (dataentities/metadata/owners) — they all consume the same `{ payload }` and partition it by field",
    "the action-type string is a STABLE prefix (`'dataEntities/fetchDataEntityDetails'`) — Redux Toolkit auto-appends `/pending`, `/fulfilled`, `/rejected`; the loader-slice's three matchers key on these suffixes (`loader.slice.ts:27-49`)",
    "errors are persisted in store EVEN WHEN the toast is suppressed — `switchOffErrorMessage: true` only short-circuits the toast, not `rejectWithValue` (`redux/lib/handleResponseThunk.ts:34-41`)",
    "status-driven refetch is EXPLICIT, not reactive — `StatusSettingsForm.onSubmit` dispatches the thunk after `updateStatus` resolves (`StatusSettingsForm.tsx:94-100`); no fetched-data field re-enters the mount effect's deps"
  ]
- audiences: [
    "`DataEntityDetails` React component (`DataEntityDetails.tsx:30-128`) — the per-entity detail page's mount-time loader",
    "`StatusSettingsForm` (`StatusSettingsForm.tsx:34-222`) — the status-change dialog that refetches the entity after every successful status update",
    "indirectly: every child component reading `state.dataentities.byId[dataEntityId]`, `state.metadata`, or `state.owners` after the fulfilled action lands (Header, Tabs, Routes — `DataEntityDetails.tsx:86-119`)"
  ]

## dependencies_semantic

- requires-feature: [
    "P-01 Data Discovery — the detail page this thunk loads is the destination of every catalog click; live page `https://docs.opendatadiscovery.org/features/data-discovery/entity-detail-page` (status 200, WebFetch 2026-06-11) now documents the detail-page mechanics including the view-count caveat section",
    "P-01 Catalog Overview — the 'Popular' column consumes the `view_count` counter that THIS thunk's HTTP call increments; live page `https://docs.opendatadiscovery.org/features/data-discovery/catalog-overview` (status 200, WebFetch 2026-06-11; fetched_excerpt verbatim: 'The most-viewed data entities across the catalog, ranked by view count alone (highest first).')"
  ]
- requires-config: [] — N/A (thunk reads no env-time config; `VITE_API_URL` is read once at module-init in `lib/api.ts:42-45` for the shared `apiConf`, not per-call)
- requires-runtime: [
    "Redux Toolkit `createAsyncThunk` + `extraReducers` semantics (`redux/lib/handleResponseThunk.ts:19-43`)",
    "the OpenAPI-generated `DataEntityApi#getDataEntityDetails` client method (imported from `generated-sources` per `dataentities.thunks.ts:1-26`)",
    "`fetch` API with `credentials: 'same-origin'` for cookie-based auth — `lib/api.ts:42-47` constructs the shared `apiConf`; `dataEntityApi` instantiated at `lib/api.ts:52`",
    "`react-hot-toast` for the success/error toast surface (`lib/errorHandling.tsx:2, 33-38`) — bypassed here for both directions",
    "the global `<AppErrorPage>` component that reads `loader.errors[fetchDataEntityDetails]` and shows a full-page banner when `isNotLoaded` is true (`DataEntityDetails.tsx:120-123`)"
  ]
- couples-to: [
    "`dataEntityApi.getDataEntityDetails` — the OpenAPI-generated client; sole call site at `dataentities.thunks.ts:40`",
    "`handleResponseAsyncThunk` — the project's wrapper around `createAsyncThunk` (`redux/lib/handleResponseThunk.ts:19-43`); the ONLY `createAsyncThunk` entry point in the package (grep `createAsyncThunk` across `<odd-platform-ui-repo>/src` → 1 file: the helper itself)",
    "`dataentities.slice.ts:97-99` — extraReducer that calls `updateDataEntity(state, payload)` (`dataentities.slice.ts:20-67`); strips `metadata` + `ownership` (held in their own slices), splits `sourceList`/`targetList`/`inputList`/`outputList` into known + unknown-count variants",
    "`dataentities.slice.ts:73-83` — the `updateEntityStatus` plain reducer that `StatusSettingsForm` dispatches IMMEDIATELY BEFORE this thunk (optimistic local status write, then full refetch — `StatusSettingsForm.tsx:95,100`)",
    "`metadata.slice.ts:18-36` — extraReducer extracting `metadataFieldValues` only (peer-slice)",
    "`owners.slice.ts:52-54` — extraReducer extracting `ownership` only (peer-slice; comment at line 51: `// get ownership from data entity details`)",
    "`loader.slice.ts:27-49` — global matcher observing ALL `*/pending`, `*/fulfilled`, `*/rejected` actions; this thunk's three lifecycle events flow through it",
    "`DataEntityDetails.tsx:61-68` + `StatusSettingsForm.tsx:100` — the two dispatch sites (verified by `grep -n 'dispatch(fetchDataEntityDetails' <odd-platform-ui-repo>/src` → exactly 2 matches: `DataEntityDetails.tsx:62`, `StatusSettingsForm.tsx:100`)",
    "`useUpdateDataEntityStatus` (`lib/hooks/api/dataEntity.ts:147-153`) — the react-query mutation whose success precedes the StatusSettingsForm dispatch; status updates themselves bypass Redux thunks entirely",
    "batch F sidecar `DataEntityController#getDataEntityDetails` — the backend hop this thunk wraps; carries the +1 view_count side-effect"
  ]

## upstream_callers

- caller: "`DataEntityDetails` React component — `DataEntityDetails.tsx:61-68` (the mount/group-refresh useEffect; dispatch at line 62)"
  multiplicity: "**1 dispatch per detail-page mount** (PROBE-VERIFIED: P-004 asserts `xhr_count == 1`; IT-002 run-log 2026-06-11 post-fix `1 passed`; pre-#1764 this was 2 — run R-20260519T-P-004 measured xhr_count=2, delta=2). PLUS group-mutation refires: the dep array (`DataEntityDetails.tsx:63-68`) holds three loader booleans (`isDataEntityGroupUpdated`, `isDataEntityAddedToGroup`, `isDataEntityDeletedFromGroup`); the FIRST completed group mutation of a session adds 1 refire (isLoaded false→true on the fulfilled edge); each SUBSEQUENT group mutation adds 2 refires (true→false on the pending edge, false→true on the fulfilled edge) — static inference from `createStatusesSelector` (`loader-selectors.ts:12-22`, `isLoaded = status === 'fulfilled'`) + the loader matchers (`loader.slice.ts:27-49`)"
  call_path: |
    User clicks an entity row in Search/Directory/Catalog Overview → React Router resolves to `/dataentities/:dataEntityId/...` → `DataEntityDetails` mounts → `useDataEntityRouteParams()` extracts `dataEntityId` (`DataEntityDetails.tsx:32`) → useEffect dep array evaluates ([dataEntityId, isDataEntityGroupUpdated, isDataEntityAddedToGroup, isDataEntityDeletedFromGroup] — `details.status?.status` REMOVED by #1764; guard comment at lines 56-60 explains why) → effect fires ONCE → `dispatch(fetchDataEntityDetails({ dataEntityId }))` → thunk calls `dataEntityApi.getDataEntityDetails` → BACKEND: `GET /api/dataentities/{id}` runs `UPDATE data_entity SET view_count = view_count + 1` then returns the payload (batch F sidecar) → `fulfilled` → three extraReducers run → `details.status` is now populated but is NOT in the dep array → NO refire.
- caller: "`StatusSettingsForm.onSubmit` — `StatusSettingsForm.tsx:100` (explicit refetch after a successful status update; NEW caller introduced by #1764)"
  multiplicity: "1 dispatch per successful status-change submit. EVERY status change routes through this form: `SelectableEntityStatus.tsx:66-80` wraps each status-menu item in a `StatusSettingsForm` whose open button is the menu item itself, so there is no settings-free direct-update path."
  call_path: |
    User clicks the entity-status chip in the detail-page header → `SelectableEntityStatus` opens the status menu → user picks a status → `StatusSettingsForm` dialog opens → Apply submits → `onSubmit` (`StatusSettingsForm.tsx:77-102`): `await updateStatus(params)` (react-query PUT via `useUpdateDataEntityStatus`, `lib/hooks/api/dataEntity.ts:147-153`) → `dispatch(updateEntityStatus({ dataEntityId, status }))` (optimistic local write, line 95) → `dispatch(fetchDataEntityDetails({ dataEntityId }))` (line 100; the comment at lines 96-99 explains the refetch is needed because status changes have server-side effects beyond the status field — DELETED/restore soft-delete/restore lineage and group relations — and cites #1764 as the reason the refetch is now explicit).
- caller: "(no other dispatch sites) — verified by `grep -n 'dispatch(fetchDataEntityDetails' <odd-platform-ui-repo>/src` → exactly 2 matches (`DataEntityDetails.tsx:62`, `StatusSettingsForm.tsx:100`)"
  multiplicity: "0"
  call_path: "N/A"

## downstream_side_effects

- side_effect: "HTTP call: `GET /api/dataentities/{data_entity_id}` (the OpenAPI-generated `dataEntityApi.getDataEntityDetails` resolves to this — see batch F sidecar `DataEntityController#getDataEntityDetails`)"
  evidence: "dataentities.thunks.ts:40 + lib/api.ts:42-47,52 (`apiConf` configures `basePath: import.meta.env.VITE_API_URL || ''`, `credentials: 'same-origin'`)"
  cardinality_per_call: 1
  reachable_from_entry_points: ["ui_route:/dataentities/{id}/* (mount)", "ui_action:status-change Apply (StatusSettingsForm)", "ui_action:group add/remove/update (loader-edge refire)"]
  scope: "network"
- side_effect: "+1 to `data_entity.view_count` row on the backend per dispatch (per batch F sidecar: 'every successful read increments view_count by 1 in the same transaction'). Post-#1764: one page-open = +1 (PROBE-VERIFIED, P-004 assertion `final_view_count - initial_view_count == 1` + IT-002 run-log 2026-06-11); pre-fix one page-open = +2."
  evidence: "transitive via batch F sidecar `DataEntityController#getDataEntityDetails` (`ReactiveDataEntityRepositoryImpl.java:174-180`) + lineage/odd-platform/probes/P-004.yaml + integration-tests/protocols/IT-002-view-count-ui-overview.md"
  cardinality_per_call: 1
  reachable_from_entry_points: ["ui_route:/dataentities/{id}/* (mount)", "ui_action:status-change Apply", "ui_action:group add/remove/update"]
  scope: "external-db-mutation (indirect — happens on the backend in response to this thunk's HTTP call)"
- side_effect: "write `pending` to `loader.statuses['dataEntities/fetchDataEntityDetails']` (visible to every component reading `getDataEntityDetailsFetchingStatuses`)"
  evidence: "redux/slices/loader.slice.ts:28-34 + redux/selectors/dataentity.selectors.ts:159-161"
  cardinality_per_call: 1
  scope: "store"
- side_effect: "on fulfilled: write the full `DataEntityDetails` payload (minus metadata + ownership) into `state.dataentities.byId[payload.id]` — `sourceList`/`targetList`/`inputList`/`outputList` partitioned into known/unknown-count buckets, plus view-count, status, type, all descriptive fields"
  evidence: "redux/slices/dataentities.slice.ts:97-99 (extraReducer) → updateDataEntity at lines 20-67"
  cardinality_per_call: 1
  scope: "store"
- side_effect: "on fulfilled: write `metadataFieldValues` into `state.metadata` (the metadata-by-entity index)"
  evidence: "redux/slices/metadata.slice.ts:18-36 (`const { id: dataEntityId, metadataFieldValues } = payload; ...`)"
  cardinality_per_call: 1
  scope: "store"
- side_effect: "on fulfilled: write `ownership` into `state.owners` (the owners-by-entity index)"
  evidence: "redux/slices/owners.slice.ts:52-54 (`const { id: dataEntityId, ownership: dataEntityOwnership } = payload; ...`)"
  cardinality_per_call: 1
  scope: "store"
- side_effect: "on rejected: persist `AppError { status, statusText, url, message }` into `loader.errors['dataEntities/fetchDataEntityDetails']`"
  evidence: "redux/lib/handleResponseThunk.ts:34-41 + redux/slices/loader.slice.ts:42-49"
  cardinality_per_call: "1 if the HTTP call rejects, else 0"
  scope: "store"
- side_effect: "NO toast on success (no `setSuccessOptions` — `dataentities.thunks.ts:41`); NO toast on error (`switchOffErrorMessage: true` short-circuits `showServerErrorToast` — `redux/lib/handleResponseThunk.ts:37-39`)"
  evidence: "dataentities.thunks.ts:41 (literal `{ switchOffErrorMessage: true }`)"
  cardinality_per_call: 0
  scope: "ui-suppressed"

## tests_coverage_semantic

- covered_behaviours:
  - behaviour: "One detail-page open dispatches exactly ONE fetchDataEntityDetails → exactly one `GET /api/dataentities/{id}` → `view_count` +1. A measured 2 = the LSN-017 double-fetch regressed."
    test_class: integration
    test_files: [
      "integration-tests/protocols/IT-002-view-count-ui-overview.md (odd-team workspace; Playwright spec `integration-tests/e2e/specs/view-count-overview.spec.ts`; status `ready`, expected GREEN since #1764; run-log 2026-06-11: pre-fix `Received: 2`, post-fix `1 passed`)",
      "lineage/odd-platform/probes/P-004.yaml (maintainer-curated; assertions `xhr_count == 1` + `final_view_count - initial_view_count == 1`, flipped from 2 with the fix exactly as the original authoring note anticipated)"
    ]
- uncovered_behaviours:
  - behaviour: "happy-path: `fulfilled` payload lands in `state.dataentities.byId[id]` with the right fields preserved and metadata/ownership stripped"
    test_class: unit
    criticality: MEDIUM
  - behaviour: "fan-out: the SAME fulfilled payload writes to dataentities + metadata + owners slices simultaneously"
    test_class: unit
    criticality: HIGH
    note: "a field-name change on the DataEntityDetails contract could silently break one of the three extraReducers"
  - behaviour: "rejected: `AppError` reaches `loader.errors[...]` even when `switchOffErrorMessage: true` suppresses the toast; `<AppErrorPage>` renders it"
    test_class: unit
    criticality: MEDIUM
  - behaviour: "no `requestId`-based stale-response protection — rapid entity-id switching must not let a late A-response overwrite fresh C-data"
    test_class: unit
    criticality: MEDIUM
  - behaviour: "loader-edge double-refire: the 2nd-and-later group mutation in a session fires the mount effect twice (pending edge + fulfilled edge) → 2 redundant fetches → +2 view_count"
    test_class: integration
    criticality: MEDIUM
    note: "same harness as IT-002; the LSN-017 family member still present after #1764"
  - behaviour: "status-change refetch fires exactly once per StatusSettingsForm submit (and therefore +1 view_count per status change)"
    test_class: integration
    criticality: LOW
  - behaviour: "the OpenAPI request envelope `{ dataEntityId }` is wired correctly to the client method — no field-name drift"
    test_class: unit
    criticality: LOW
- test_files: [
    "odd-platform-ui unit tests: 7 files exist in the package (glob `**/*.{test,spec}.{ts,tsx,js,jsx}` under `<odd-platform-ui-repo>/src` → 7 hits, all under `components/Overview/DataEntitiesUsageInfo/**` and `components/shared/elements/{BooleanFormatted,EntityClassItem,NumberFormatted,TextFormatted}/__tests__/`). NONE touch this thunk, the redux layer, or `DataEntityDetails` — zero hits under `src/redux/` or `src/components/DataEntityDetails/`.",
    "Vitest infra IS present: `odd-platform-ui/package.json:10-11` (`\"test\": \"vitest\"`, `\"test:coverage\": \"vitest run --coverage\"`; vitest ^4.0.17 + @testing-library/jest-dom ^6.9.1)."
  ]
- gaps: |
    The headline LSN-017 behaviour is now pinned end-to-end (IT-002 e2e + P-004 probe, both in the odd-team workspace — the regression gate lives OUTSIDE odd-platform's own CI). What remains uncovered: (1) the redux layer of this thunk has zero unit tests despite the package now having Vitest infrastructure — the fan-out invariant, the rejected-path store write, and the requestId staleness are all unguarded in-repo; (2) the loader-edge double-refire on 2nd+ group mutations is the surviving member of the LSN-017 family (loader booleans in dep arrays) and no test pins it; (3) a regression that re-adds a fetched-data field to the dep array would be caught by IT-002 only via the view-count symptom — a variant that doubles a NON-counting fetch (e.g. the alerts salvo) would pass IT-002 silently. Highest-leverage next test: a unit suite for the thunk + dep-array contract in odd-platform-ui's own CI, so the regression gate does not depend solely on the odd-team harness being run.

## docs_link_semantic

- declared_docs: [] — no `@docs` annotation in the source (re-verified this session by reading `dataentities.thunks.ts:1-257` end-to-end; no `// @docs:` anywhere)
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/entity-detail-page"
    anchor: "#general-panel--view-count-caveats"
    rationale: "the page documenting the detail page this thunk loads, including a dedicated view-count caveat section describing the exact fetch behaviour this thunk drives"
    last_verified_at: "2026-06-11T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      Verbatim (live WebFetch 2026-06-11): "Opening a detail page registers as +2, not +1. Each page-open fetches the entity detail twice, and each fetch bumps the view count by one — so a single visit adds **2** to the number, not 1." Also: "View count is bumped on every detail-page fetch with no rate limit, no per-user de-duplication, and no authentication required." Heading "General panel — view count caveats" confirmed present (anchor `#general-panel--view-count-caveats`). No version notes on the live page.
      NOTE: the live +2 text is RELEASE-ACCURATE for the latest published release (<=0.27.x). It is NOT drift — see pending_release below.
    pending_release: "0.28.0"
    train_ref: "release/0.28.0 @ a0199ae docs/data-discovery/entity-detail-page.md#general-panel-view-count-caveats"
    train_excerpt: |
      Verbatim (read from the documentation working tree, entity-detail-page.md:44): "**One page-open registers one view as of 0.28.0 — releases up to 0.27.x counted +2.** In earlier releases each page-open fetched the entity detail twice (a front-end double-fetch), so a single visit added **2** to the number. From 0.28.0 a visit adds exactly 1. Counts accumulated on earlier releases overstate real visits by roughly a factor of two, and the counter is not rebased on upgrade — treat pre-0.28.0 numbers as a relative popularity hint, not an exact visit tally."
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/catalog-overview"
    anchor: "#recommended"
    rationale: "the 'Popular' column on the Catalog Overview consumes the view_count this thunk's HTTP call increments — the user-visible consequence of dispatching this thunk"
    last_verified_at: "2026-06-11T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      Verbatim (live WebFetch 2026-06-11): "The most-viewed data entities across the catalog, ranked by view count alone (highest first)." Warning box: "The Popular column ranks by view count alone, and view count is trivially inflatable — treat it as a rough popularity hint, not a trustworthy signal." + "a short scripted read loop can push any chosen entity to the top of the Popular column". The live page still carries the +2 statement ("opening a detail page registers as +2, not +1") — release-accurate for <=0.27.x.
    pending_release: "0.28.0"
    train_ref: "release/0.28.0 @ a0199ae docs/data-discovery/catalog-overview.md (warning hint, line 57)"
    train_excerpt: |
      Verbatim (read from the documentation working tree, catalog-overview.md:57): "...one page-open registers one view as of 0.28.0 — releases up to 0.27.x double-counted each open; see [Data entity detail page → view count](entity-detail-page.md#general-panel-view-count-caveats)..."
- doc_drift_findings:
  - "NO drift at refresh time. The two findings recorded by the 2026-05-19 enrichment are RESOLVED: (1) the trigger mechanism for the Popular ranking (detail-page fetch = +1 view) is now documented live on both pages, including the no-rate-limit / no-de-dup / no-auth inflatability caveat; (2) the page-open multiplicity is now documented live (+2 — correct for the latest published release <=0.27.x). The +2→+1 transition introduced by #1764 is ROUTING STATE, not drift: the corrected text rides documentation `release/0.28.0 @ a0199ae` and publishes at the release gate, per the release-train ADR (`adrs/drafts/release-train-doc-gating.md`). Live WebFetch of both pages 2026-06-11, both status 200."

## implicit_adrs

- "The project standardises **all** async data-fetching through `handleResponseAsyncThunk` (a thin wrapper around Redux Toolkit's `createAsyncThunk`) that bakes in the success-toast / error-toast / `rejectWithValue(AppError)` triad — `createAsyncThunk` appears in exactly ONE file in the package (the helper itself; grep `createAsyncThunk` across `<odd-platform-ui-repo>/src` → 1 file: `redux/lib/handleResponseThunk.ts`)." — evidence: `redux/lib/handleResponseThunk.ts:19-43` — intent_anchor: the helper's TYPE SIGNATURE makes `setSuccessOptions` and `switchOffErrorMessage` first-class options of the thunk-factory (`HandleResponseAsyncThunkOptions<ThunkArg>` interface at `handleResponseThunk.ts:14-17`); a thunk authored outside this wrapper would have to duplicate the try/catch/getErrorResponse/showServerErrorToast/rejectWithValue logic. The wrapper IS the project's standard. — confidence: HIGH
- "**Selective error-toast suppression** is the project's pattern for 'expected failure' loads. `switchOffErrorMessage: true` (`dataentities.thunks.ts:41`) signals that the detail-page load's failure is communicated by the full-page `<AppErrorPage>` banner, not a transient toast. 9 thunk files + the helper share the field (grep `switchOffErrorMessage` across `<odd-platform-ui-repo>/src` → 10 files: 9 under `redux/thunks/` + `redux/lib/handleResponseThunk.ts`)." — evidence: `redux/lib/handleResponseThunk.ts:14-17` (type signature) + `dataentities.thunks.ts:41` (this thunk's opt-in). — intent_anchor: `switchOffErrorMessage?: boolean` is an optional field with NO default; setting it `true` is an opt-in, and the error path reads it (`if (!options.switchOffErrorMessage) { await showServerErrorToast(...); }` at `handleResponseThunk.ts:37-39`). — confidence: HIGH
- "The fulfilled payload is intentionally **fanned across three slices** rather than nested into a single dataentities-slice shape — side-by-side normalised slices (dataentities + metadata + owners), each with its own extraReducer on the same `fetchDataEntityDetails.fulfilled` action (`dataentities.slice.ts:97-99`, `metadata.slice.ts:18`, `owners.slice.ts:52-54`)." — evidence: `dataentities.slice.ts:55` + `metadata.slice.ts:18` + `owners.slice.ts:52-54`. — intent_anchor: verbatim comment at `dataentities.slice.ts:55`: `// Metadata and Ownership are being stored in MetadataState and OwnersState`. — confidence: HIGH
- "**Refetch-on-status-change is EXPLICIT (event-driven at the mutation site), never REACTIVE (fetched-data fields in effect dep arrays)** — the #1764 decision. The mount effect's dep array deliberately excludes `details.status?.status`; the refetch a status change needs is dispatched by `StatusSettingsForm` after the update succeeds. Both halves of the decision carry explanatory comments naming the bug class they prevent." — evidence: `DataEntityDetails.tsx:56-60` + `StatusSettingsForm.tsx:96-99`. — intent_anchor: verbatim comment at `DataEntityDetails.tsx:56-60`: "details.status?.status must NOT be a dependency here: it is populated by this fetch's own fulfilled action, so listing it re-fires the effect once per first visit — every page-open registered two GET /api/dataentities/{id} calls and the backend counted +2 views per visit (#1764). The refetch a status change needs is dispatched explicitly by StatusSettingsForm after the status update succeeds." Mirrored at `StatusSettingsForm.tsx:96-99`: "...This refetch used to be triggered reactively by details.status?.status sitting in the DataEntityDetails effect deps — the mechanism that double-counted views (#1764)." — confidence: HIGH

## bugs_limitations_corner_cases

- "**[FIXED by #1764 — CTRIB-004, 2026-06-11, ships in 0.28.0] Self-feeding double-fetch loop on detail-page open.** Pre-fix, the useEffect dep array included `details.status?.status` — part of the payload the thunk itself writes — so every page-open dispatched twice and the backend counted +2 views per visit (LSN-017; probe run R-20260519T-P-004 measured xhr_count=2, delta=2). The fix removes the dep and adds the explicit StatusSettingsForm refetch; post-fix multiplicity is 1, PROBE-VERIFIED (P-004 assertions flipped 2→1; IT-002 run-log 2026-06-11 `1 passed`). RESIDUE for operators: view counts accumulated on <=0.27.x overstate real visits ~2x and are NOT rebased on upgrade — documented on the 0.28.0 doc train (entity-detail-page.md:44 @ a0199ae)." — evidence: `DataEntityDetails.tsx:56-68` (fixed dep array + guard comment) + `StatusSettingsForm.tsx:96-100` + lineage/odd-platform/probes/P-004.yaml + integration-tests/protocols/IT-002-view-count-ui-overview.md — severity: RESOLVED (residue: LOW)
- "**Loader-edge double-refire on 2nd-and-later group mutations — the surviving LSN-017 family member.** The dep array still holds three GLOBAL loader booleans (`isDataEntityGroupUpdated`, `isDataEntityAddedToGroup`, `isDataEntityDeletedFromGroup`). `isLoaded = status === 'fulfilled'` (`loader-selectors.ts:12-22`), and the loader matchers rewrite the status to `'pending'` when a thunk re-runs (`loader.slice.ts:28-34`). So the FIRST completed group mutation of a session refires the detail fetch once (false→true), but EVERY SUBSEQUENT group mutation refires it TWICE — once on the pending edge (true→false) and once on the fulfilled edge (false→true) — i.e. 2 redundant GETs and +2 view_count per later group edit, with the pending-edge fetch racing the mutation itself. No comment defends the pattern." — evidence: `DataEntityDetails.tsx:63-68` (dep array) + `redux/selectors/loader-selectors.ts:12-22` + `redux/slices/loader.slice.ts:27-49` — severity: MEDIUM
- "**No `requestId`-based stale-response protection.** Redux Toolkit's `createAsyncThunk` ships built-in `requestId` tracking, but `handleResponseAsyncThunk` does not propagate or check it. A user clicking through entities A → B → C rapidly can land in a state where A's late-arriving response overwrites C's fresh data; the reducer writes `[payload.id]: { ...payload }` unconditionally." — evidence: `redux/lib/handleResponseThunk.ts:24-43` (no `thunkAPI.requestId` check) + `dataentities.slice.ts:49-66` — severity: MEDIUM
- "**`AppError.message` falls back to the literal `'An error occurred'`** when the backend returns a non-JSON body or a body without `message`. A 502/504 with an HTML error body renders the same opaque full-page banner as a real 404 — operators cannot tell from the UI whether the entity is missing or the backend is down." — evidence: `lib/errorHandling.tsx:12-26` (fallback at line 24) + `DataEntityDetails.tsx:120-123` (`<AppErrorPage>`) — severity: MEDIUM
- "**No retry, no debounce, no in-flight de-dup.** Rapid route-param changes or group-mutation cycles fire concurrent dispatches, each individually +1-ing the backend's `view_count`. URL replay remains a denial-of-correctness vector for the Popular ranking — now DOCUMENTED live ('a short scripted read loop can push any chosen entity to the top of the Popular column', catalog-overview warning, WebFetch 2026-06-11) but not mitigated in code." — evidence: `dataentities.thunks.ts:35-42` (no wrappers) + `DataEntityDetails.tsx:63-68` — severity: MEDIUM
- "**`view_count` counts FETCHES, not page-opens.** Post-#1764 a page-open is exactly +1, but every status change (+1 via the StatusSettingsForm refetch, `StatusSettingsForm.tsx:100`) and every group-membership edit (+1 first, +2 subsequent — see the loader-edge entry) also increment the counter without a new visit. The doc train's wording ('running total of times this entity's detail page has been fetched', entity-detail-page.md:41 @ a0199ae) is accurate about this; readers equating views with visits will still over-count on heavily-edited entities." — evidence: `StatusSettingsForm.tsx:94-100` + `DataEntityDetails.tsx:63-68` + batch F sidecar (+1 per GET) — severity: LOW
- "**Silent client-side stripping of empty external-name entries** — `updateDataEntity` filters out any `sourceList`/`targetList`/`inputList`/`outputList` entry with falsy `externalName`, replacing them with `unknown*Count` fields. A backend regression emitting null externalName for known entities would silently disappear from the detail page's lineage shortcuts." — evidence: `dataentities.slice.ts:28-47` (the filter loops) + `dataentities.slice.ts:49-66` (the write) — severity: LOW
- "**No `dataEntityId` validation** — the route param from `useDataEntityRouteParams()` flows into the dispatch with no client-side guard; a negative or zero id passes through to the backend." — evidence: `dataentities.thunks.ts:36-41` + `DataEntityDetails.tsx:32, 62` — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "dataentities.thunks.ts:41"
      name: "switchOffErrorMessage (boolean behaviour gate; no numeric tunables exist in this node)"
      value: "true"
      questions:
        - q: "What happens when true (this node's setting)?"
          a: "The catch path skips showServerErrorToast entirely; the AppError still reaches rejectWithValue → loader.errors → <AppErrorPage> full-page banner. Failure feedback is banner-only."
          confidence: STATIC-INFERRED
          evidence: "handleResponseThunk.ts:34-41 + loader.slice.ts:42-49 + DataEntityDetails.tsx:120-123"
        - q: "What happens when false/absent (the default)?"
          a: "showServerErrorToast fires a react-hot-toast keyed by response.url with body.message or 'An error occurred'; the store write is identical either way."
          confidence: STATIC-INFERRED
          evidence: "handleResponseThunk.ts:37-39 + errorHandling.tsx:48-68"
        - q: "What does the operator see at the gate?"
          a: "Detail-page load failures NEVER toast. If <AppErrorPage> rendering ever regressed, a 5xx would leave a blank page with zero feedback — the gate concentrates all failure UX in one component."
          confidence: STATIC-INFERRED
          evidence: "DataEntityDetails.tsx:120-123"
  name_behavior_pairs:
    - name: "fetchDataEntityDetails"
      promise: "a read-only fetch of the entity's details (the verb 'fetch' implies no side effects)"
      implementation: "the GET it issues is non-idempotent server-side: +1 data_entity.view_count per call (batch F sidecar; ReactiveDataEntityRepositoryImpl.java:174-180). Every dispatch — mount, group-mutation refire, status-change refetch — registers a view."
      drift: MINOR
      operator_visible_consequence: "callers using this thunk as a generic 'refresh entity' primitive (StatusSettingsForm does, deliberately) inflate the Popular-ranking counter by +1 per refresh; views != visits."
      confidence: STATIC-INFERRED
      evidence: "dataentities.thunks.ts:40 + StatusSettingsForm.tsx:100 + batch F sidecar; runtime composition PROBE-VERIFIED by P-004/IT-002 (1 dispatch = +1)"
    - name: "switchOffErrorMessage"
      promise: "switches off the error message"
      implementation: "switches off the error TOAST only; the error message itself still renders — persisted to loader.errors and shown by <AppErrorPage> with status, statusText, url, message."
      drift: MINOR
      operator_visible_consequence: "none harmful — the deliberate UX split (banner instead of toast); the option name over-promises suppression scope to a code reader."
      confidence: STATIC-INFERRED
      evidence: "handleResponseThunk.ts:37-41 + DataEntityDetails.tsx:120-123"
  orderings: []   # no ORDER BY / sort / pagination / aggregation in this node — single-entity fetch by id
  auth_gates:
    - location: "dataentities.thunks.ts:35-42 + DataEntityDetails.tsx:61-68 + StatusSettingsForm.tsx:100"
      endpoint: "client of GET /api/dataentities/{data_entity_id} (this node is not an HTTP endpoint itself)"
      questions:
        - q: "What does the underlying endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "Backend posture — owned by the batch F sidecar (DataEntityController#getDataEntityDetails): no @PreAuthorize; succeeds for any authenticated principal, and for ANY caller under DISABLED. The thunk sends credentials: 'same-origin' so the session cookie travels under all modes."
          confidence: REFERENCE
          evidence: "lib/api.ts:42-47 + node_id: odd-platform java controller-method DataEntityController#getDataEntityDetails (batch F sidecar)"
        - q: "What does an unauthenticated caller see?"
          a: "Under LOGIN_FORM/OAUTH2/LDAP the backend rejects → the thunk's catch path persists the AppError → full-page <AppErrorPage> banner (no toast). Under DISABLED the fetch succeeds anonymously."
          confidence: STATIC-INFERRED
          evidence: "handleResponseThunk.ts:34-41 + DataEntityDetails.tsx:120-123 (UI half); status codes per batch F sidecar"
        - q: "What does a wrong-role caller see?"
          a: "The full payload — the FETCH is permission-ungated client-side. resourcePermissions gate only the EDIT affordances in the header (internal-name / group / status update), never the read."
          confidence: STATIC-INFERRED
          evidence: "DataEntityDetails.tsx:35-37 (selector) + 86-91 (allowedPermissions only wraps the header)"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "Nowhere client-side (verified by reading both dispatch sites + the thunk); nowhere backend-side per batch F (the platform's read-collaborative posture). The combined absence is the documented-live inflatability caveat, not an undocumented hole."
          confidence: REFERENCE
          evidence: "dataentities.thunks.ts:35-42 + batch F sidecar + live catalog-overview warning (WebFetch 2026-06-11)"
  resource_boundaries:
    - location: "dataentities.thunks.ts:35-42 (no lock, no cache, no de-dup around the call)"
      kind: concurrency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "Store-corrupting: no — last-writer-wins per entity id. Staleness: yes — no requestId guard means a late response for entity A can overwrite fresh data after the user navigated to C; loader.statuses is keyed by action TYPE (not entity id), so concurrent dispatches interleave a single global pending/fulfilled flag."
          confidence: STATIC-INFERRED
          evidence: "handleResponseThunk.ts:24-43 + dataentities.slice.ts:49-66 + loader.slice.ts:27-49"
        - q: "Is the call replay-safe?"
          a: "Client store: idempotent (same payload → same state). System: NOT replay-safe — each dispatch adds +1 to view_count server-side. Measured: 1 dispatch = +1 (P-004 cross-check assertion `final - initial == xhr_count`; IT-002 run-log 2026-06-11)."
          confidence: PROBE-VERIFIED
          evidence: "lineage/odd-platform/probes/P-004.yaml (assertions) + integration-tests/protocols/IT-002-view-count-ui-overview.md (run-log 2026-06-11)"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No cache at any layer in this node — every dispatch is a network call; byId would support a has-it-already check but the thunk never consults it. (react-query is used elsewhere in the package — e.g. useUpdateDataEntityStatus — but NOT for this fetch.)"
          confidence: STATIC-INFERRED
          evidence: "dataentities.thunks.ts:35-42 + lib/hooks/api/dataEntity.ts:147-153 (the react-query boundary sits on the status mutation, not this read)"
  request_inputs:
    - location: "dataentities.thunks.ts:35-41 (thunk argument)"
      input_kind: body-field
      input_name: "dataEntityId"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The numeric primary id of the data entity whose details to fetch."
          confidence: STATIC-INFERRED
          evidence: "dataentities.thunks.ts:37 (DataEntityApiGetDataEntityDetailsRequest = { dataEntityId: number })"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Passed verbatim to dataEntityApi.getDataEntityDetails({ dataEntityId }) → the path parameter of GET /api/dataentities/{data_entity_id} (OpenAPI-generated client) → backend primary-key lookup. UI-side chain fully read: route param (DataEntityDetails.tsx:32) or form context (StatusSettingsForm.tsx:43,87) → dispatch → thunk → client."
          confidence: STATIC-INFERRED
          evidence: "dataentities.thunks.ts:40 + DataEntityDetails.tsx:32,62 + StatusSettingsForm.tsx:43,100"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — the id selects exactly the named entity; the SQL tail (PK lookup + the view_count UPDATE on the same row) is owned by the batch F sidecar, which confirms no translation."
          drift: NONE
          confidence: REFERENCE
          evidence: "node_id: odd-platform java controller-method DataEntityController#getDataEntityDetails (batch F sidecar)"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — no silent translation; verdict is MATCHES."
          confidence: STATIC-INFERRED
          evidence: "dataentities.thunks.ts:40"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE — the request envelope has exactly one field and it is used."
          confidence: STATIC-INFERRED
          evidence: "dataentities.thunks.ts:37-40"
  probes_emitted: []   # none needed — the runtime questions this node raises are already answered by P-004 (maintainer-curated, assertions current) and IT-002 (run-log 2026-06-11)
  stress_summary:
    triggers_total: 6
    questions_total: 17
    answers_static_inferred: 13
    answers_probe_needed: 0
    answers_probe_verified: 1
    answers_reference: 3
    drift_flags: 2   # both MINOR (fetch-with-server-side-write; switchOffErrorMessage suppresses toast only)
```

## security

- **auth_mode_relevance**: INTERNAL_ONLY (client-side Redux thunk — auth modes apply at the HTTP boundary where the backend serves the GET; the thunk inherits the deployment's posture. `lib/api.ts:44` sets `credentials: 'same-origin'` so session cookies travel regardless of active mode.) — evidence: `lib/api.ts:42-47` + cross-ref batch F sidecar `security.auth_mode_relevance` (`LOGIN_FORM | OAUTH2 | LDAP | DISABLED`).
- **ingestion_filter_relevance**: N/A — not an ingestion path. The thunk targets `GET /api/dataentities/{id}`, not `/ingestion/*`.
- **authorization_assertions**: [] — no client-side authorization check on the fetch. `<DataEntityDetails>` reads `resourcePermissions` (`DataEntityDetails.tsx:35-37`) but uses it only to gate three EDIT permissions on the header (`DATA_ENTITY_INTERNAL_NAME_UPDATE` / `DATA_ENTITY_GROUP_UPDATE` / `DATA_ENTITY_STATUS_UPDATE`, `DataEntityDetails.tsx:87-91`); the FETCH itself is unconditional from both dispatch sites. (cross-ref batch F: the backend GET has no `@PreAuthorize`.)
- **owner_scoping**: BYPASSES — only `dataEntityId` is passed; no owner / namespace / role filter client-side, none backend-side per batch F. Any authenticated user can fetch any entity's detail payload. — evidence: `dataentities.thunks.ts:38-40`.
- **data_exposure**:
  - "full `DataEntityDetails` payload (34 fields per batch F enumeration) → any authenticated user under LOGIN_FORM/OAUTH2/LDAP (any anonymous caller under `auth.type=DISABLED`) who knows or can guess a `dataEntityId`."
  - "the `<AppErrorPage>` banner displays `error.status`, `error.statusText`, `error.url`, and `error.message` from the backend's error response — including the full request URL; a 500-level body carrying server diagnostics in `message` renders verbatim. — evidence: `lib/errorHandling.tsx:12-26` + `DataEntityDetails.tsx:120-123`."
- **known_security_gaps**:
  - "Detail-page mount via this thunk cross-confirms the platform's read-collaborative posture (every authenticated user sees every entity); no defending intent in this file. UPDATE 2026-06-11: the operator-facing consequence (view-count inflatability with 'no rate limit, no per-user de-duplication, and no authentication required', including under DISABLED) is now DOCUMENTED LIVE on both the entity-detail-page and catalog-overview pages (WebFetch 2026-06-11) — the posture is published, the code-side mitigation remains absent. — evidence: `dataentities.thunks.ts:35-42` + `DataEntityDetails.tsx:61-68` + live WebFetch quotes in docs_link_semantic — severity: MEDIUM"
  - "Error-payload reflection — `AppError.url` carries the request URL into the error banner; for deployments exposing the platform directly this reveals the backend's API path. Defense-in-depth gap. — evidence: `lib/errorHandling.tsx:20-25` — severity: LOW"

## performance

- **hot_paths**:
  - "Detail-page mount is a hot path — every entity click lands in `<DataEntityDetails>`, which now fires this thunk exactly ONCE per mount (#1764; was twice). The thunk triggers the backend's most expensive read (per batch F: CTE + four reactive zip-merges + a write). — evidence: `DataEntityDetails.tsx:61-68` + P-004 (`xhr_count == 1`)."
  - "The second useEffect (`DataEntityDetails.tsx:70-80`) fires a parallel salvo of 4 additional thunks on the same mount (`fetchDataEntityAlertsCounts`, `fetchDataSetQualityTestReport`, `fetchDataSetQualitySLAReport`, `fetchResourcePermissions`) — a single detail-page open now dispatches 5 thunks / 5 HTTP calls (was 6 pre-fix). — evidence: `DataEntityDetails.tsx:61-80`."
- **throughput_characteristics**:
  - "single-request-per-dispatch — no batching, no payload coalescing"
  - "synchronous fan-out at fulfilled-time — three slices update in the same Redux dispatch tick"
- **resource_allocation**:
  - "No client-side caching — every dispatch issues a network call; `byId` would support a has-it-already check but the thunk never consults it. — evidence: `dataentities.thunks.ts:35-42` + `dataentities.slice.ts:49-66`."
  - "Responses are held in memory for the session (no `resetLoaderByAction` cleanup on unmount in `DataEntityDetails.tsx`); navigating 100 entities grows `state.dataentities.byId` to 100 entries. — evidence: `DataEntityDetails.tsx:30-128` (no cleanup return) + `loader.slice.ts:18-24` (`resetLoaderByAction` exists, uncalled here)."
- **scaling_characteristics**:
  - "stateless thunk (idempotent at the CLIENT layer; the BACKEND read is NOT idempotent per batch F)"
  - "no client-side rate-limiting — the effect refires on every dep-array change with no debounce or throttle"
- **known_performance_gaps**:
  - "[RESOLVED by #1764] the 2-dispatch-per-mount baseline that doubled load on the backend's hottest read endpoint — post-fix multiplicity is 1 (PROBE-VERIFIED, P-004 + IT-002 run-log 2026-06-11). — evidence: `DataEntityDetails.tsx:56-68` — severity: RESOLVED"
  - "**Loader-edge double-refire on 2nd+ group mutations** — 2 redundant fetches (each running the backend CTE + UPDATE) per group edit after the first, with the pending-edge fetch racing the mutation. — evidence: `DataEntityDetails.tsx:63-68` + `loader-selectors.ts:12-22` + `loader.slice.ts:27-49` — severity: MEDIUM"
  - "**No in-flight de-dup or cache** — rapid entity-id flips can fire several concurrent dispatches before the first fulfils; each runs the backend CTE + UPDATE. — evidence: `dataentities.thunks.ts:35-42` — severity: MEDIUM"
  - "**5-thunk parallel salvo per detail-page mount** (this thunk + 4 in the second useEffect) — five concurrent requests per page-open per navigation. — evidence: `DataEntityDetails.tsx:61-80` — severity: MEDIUM"

## sources

- understanding ← dataentities.thunks.ts:35-42 + DataEntityDetails.tsx:56-68 + StatusSettingsForm.tsx:77-102 + redux/lib/handleResponseThunk.ts:19-43 + redux/slices/dataentities.slice.ts:97-99 + redux/slices/metadata.slice.ts:18-36 + redux/slices/owners.slice.ts:52-54 + lineage/odd-platform/probes/P-004.yaml + integration-tests/protocols/IT-002-view-count-ui-overview.md + batch F sidecar `DataEntityController#getDataEntityDetails`
- concepts.entities.DataEntityDetails ← dataentities.thunks.ts:36 + batch F sidecar's enumeration
- concepts.entities.AppError ← lib/errorHandling.tsx:5-10
- concepts.operations.dispatch ← redux/lib/handleResponseThunk.ts:24-32 + redux/slices/loader.slice.ts:28-34
- concepts.operations.api-call ← dataentities.thunks.ts:40 + lib/api.ts:42-52
- concepts.operations.fan-out ← redux/slices/dataentities.slice.ts:97-99 + redux/slices/metadata.slice.ts:18-36 + redux/slices/owners.slice.ts:52-54
- concepts.invariants.one-dispatch-per-mount ← DataEntityDetails.tsx:56-68 + P-004 assertions
- concepts.invariants.explicit-status-refetch ← StatusSettingsForm.tsx:94-100
- dependencies_semantic.requires-feature ← WebFetch https://docs.opendatadiscovery.org/features/data-discovery/entity-detail-page 2026-06-11 status 200 + WebFetch https://docs.opendatadiscovery.org/features/data-discovery/catalog-overview 2026-06-11 status 200
- dependencies_semantic.requires-runtime.openapi-client ← dataentities.thunks.ts:1-26 + lib/api.ts:42-52
- dependencies_semantic.couples-to.handleResponseAsyncThunk ← redux/lib/handleResponseThunk.ts:19-43 + grep `createAsyncThunk` across `<odd-platform-ui-repo>/src` (1 file)
- dependencies_semantic.couples-to.updateEntityStatus ← dataentities.slice.ts:73-83 + StatusSettingsForm.tsx:12,95
- dependencies_semantic.couples-to.useUpdateDataEntityStatus ← lib/hooks/api/dataEntity.ts:147-153
- dependencies_semantic.couples-to.two-dispatch-sites ← grep `dispatch(fetchDataEntityDetails` across `<odd-platform-ui-repo>/src` (2 matches)
- upstream_callers.[0] ← DataEntityDetails.tsx:61-68 + loader-selectors.ts:12-22 + loader.slice.ts:27-49 + P-004 + IT-002
- upstream_callers.[1] ← StatusSettingsForm.tsx:77-102 + SelectableEntityStatus.tsx:66-80 + lib/hooks/api/dataEntity.ts:147-153
- upstream_callers.[2] ← grep `dispatch(fetchDataEntityDetails` (2 matches)
- downstream_side_effects.HTTP-call ← dataentities.thunks.ts:40 + lib/api.ts:42-47,52
- downstream_side_effects.view-count-increment ← batch F sidecar + lineage/odd-platform/probes/P-004.yaml + integration-tests/protocols/IT-002-view-count-ui-overview.md
- downstream_side_effects.store-fan-out ← redux/slices/dataentities.slice.ts:97-99 + metadata.slice.ts:18-36 + owners.slice.ts:52-54 + loader.slice.ts:27-49
- tests_coverage_semantic.covered ← integration-tests/protocols/IT-002-view-count-ui-overview.md (frontmatter + section 1 run-log note) + lineage/odd-platform/probes/P-004.yaml (assert block)
- tests_coverage_semantic.test_files ← Glob `**/*.{test,spec}.{ts,tsx,js,jsx}` under `<odd-platform-ui-repo>/src` (7 hits, named in section) + odd-platform-ui/package.json:10-11
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/features/data-discovery/entity-detail-page 2026-06-11 status 200 + documentation working tree docs/data-discovery/entity-detail-page.md:39-49 (train @ a0199ae)
- docs_link_semantic.inferred_docs.[1] ← WebFetch https://docs.opendatadiscovery.org/features/data-discovery/catalog-overview 2026-06-11 status 200 + documentation working tree docs/data-discovery/catalog-overview.md:52,56-58 (train @ a0199ae)
- docs_link_semantic.doc_drift_findings.[0] ← both WebFetches 2026-06-11 + adrs/drafts/release-train-doc-gating.md (routing rule)
- implicit_adrs.[0] ← redux/lib/handleResponseThunk.ts:14-43 + grep `createAsyncThunk` across `<odd-platform-ui-repo>/src` (1 file)
- implicit_adrs.[1] ← redux/lib/handleResponseThunk.ts:14-17,37-39 + dataentities.thunks.ts:41 + grep `switchOffErrorMessage` across `<odd-platform-ui-repo>/src` (10 files: 9 thunk files + the helper)
- implicit_adrs.[2] ← redux/slices/dataentities.slice.ts:55 (verbatim comment quoted in intent_anchor)
- implicit_adrs.[3] ← DataEntityDetails.tsx:56-60 + StatusSettingsForm.tsx:96-99 (verbatim comments quoted in intent_anchor)
- bugs_limitations_corner_cases.fixed-double-fetch ← DataEntityDetails.tsx:56-68 + StatusSettingsForm.tsx:96-100 + P-004 (history block + assertions) + IT-002 (run-log note) + documentation entity-detail-page.md:44 @ a0199ae
- bugs_limitations_corner_cases.loader-edge-refire ← DataEntityDetails.tsx:63-68 + redux/selectors/loader-selectors.ts:12-22 + redux/slices/loader.slice.ts:27-49
- bugs_limitations_corner_cases.no-requestId ← redux/lib/handleResponseThunk.ts:24-43 + dataentities.slice.ts:49-66
- bugs_limitations_corner_cases.generic-error-fallback ← lib/errorHandling.tsx:12-26 + DataEntityDetails.tsx:120-123
- bugs_limitations_corner_cases.no-dedup ← dataentities.thunks.ts:35-42 + WebFetch catalog-overview 2026-06-11 (the documented inflatability)
- bugs_limitations_corner_cases.fetches-not-visits ← StatusSettingsForm.tsx:94-100 + DataEntityDetails.tsx:63-68 + documentation entity-detail-page.md:41 @ a0199ae
- bugs_limitations_corner_cases.silent-stripping ← dataentities.slice.ts:28-47,49-66
- bugs_limitations_corner_cases.no-id-validation ← dataentities.thunks.ts:36-41 + DataEntityDetails.tsx:32,62
- stress_findings ← all anchors inlined per question (see block)
- security.auth_mode_relevance ← lib/api.ts:42-47 + batch F sidecar
- security.authorization_assertions ← DataEntityDetails.tsx:35-37,87-91 + dataentities.thunks.ts:38-40
- security.owner_scoping ← dataentities.thunks.ts:38-40 + batch F sidecar
- security.data_exposure ← batch F sidecar + lib/errorHandling.tsx:12-26 + DataEntityDetails.tsx:120-123
- security.known_security_gaps.[0] ← dataentities.thunks.ts:35-42 + DataEntityDetails.tsx:61-68 + WebFetch quotes 2026-06-11
- security.known_security_gaps.[1] ← lib/errorHandling.tsx:20-25
- performance.hot_paths.[0] ← DataEntityDetails.tsx:61-68 + P-004 + batch F sidecar
- performance.hot_paths.[1] ← DataEntityDetails.tsx:61-80
- performance.known_performance_gaps.[0] ← DataEntityDetails.tsx:56-68 + P-004 + IT-002 (resolved provenance)
- performance.known_performance_gaps.[1] ← DataEntityDetails.tsx:63-68 + loader-selectors.ts:12-22 + loader.slice.ts:27-49
- performance.known_performance_gaps.[2] ← dataentities.thunks.ts:35-42
- performance.known_performance_gaps.[3] ← DataEntityDetails.tsx:61-80

## confidence_per_field

- understanding: HIGH (every claim traces to a file:line read this session, a live WebFetch this session, or an in-repo probe/IT artefact read this session)
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (the covered behaviour cites the actual probe assertions + IT run-log; the in-package absence is scoped by a named glob — 7 files found, zero under src/redux/ or src/components/DataEntityDetails/)
- docs_link_semantic: HIGH (both live URLs WebFetched 2026-06-11 at status 200 with verbatim quotes; train state read from the documentation working tree and recorded as pending_release routing, per the release-train ADR)
- implicit_adrs: HIGH (4 ADRs, each with a verbatim intent anchor — two of them the #1764 guard comments added by the fix itself)
- bugs_limitations_corner_cases: HIGH (the FIXED entry carries probe-verified provenance; the loader-edge refire is a complete static trace through selector + matcher + dep-array semantics)
- security: HIGH
- performance: HIGH
- upstream_callers: HIGH (both callers fully read; mount multiplicity PROBE-VERIFIED; the 2-site caller set grep-verified)
- downstream_side_effects: HIGH (the view-count side effect is the one transitive claim, and it is probe-verified end-to-end)
- stress_findings: HIGH (0 of 17 questions PROBE-NEEDED; 13 STATIC-INFERRED, 1 PROBE-VERIFIED, 3 REFERENCE to the in-repo batch F sidecar)

## Maintainer notes


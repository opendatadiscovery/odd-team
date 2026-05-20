---
node_id: "odd-platform ts redux-thunk thunk:fetchDataEntityDetails"
node_kind: redux-thunk
axis: ui_redux_thunks
extracted_at_commit: 80637ed
enriched_at_commit: 80637ed
extractor_version: 0.1.0
prompt_version: file-analyser/0.3.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-19-J-fetchDataEntityDetails
---

# fetchDataEntityDetails — semantic understanding

## understanding

`fetchDataEntityDetails` is a Redux Toolkit `createAsyncThunk` (wrapped by the project's local `handleResponseAsyncThunk` helper) that takes `{ dataEntityId }`, calls `dataEntityApi.getDataEntityDetails({ dataEntityId })` (the OpenAPI-generated client for `GET /api/dataentities/{data_entity_id}`), and on `fulfilled` lets the resolved `DataEntityDetails` payload fan into **three** extraReducers — `dataentities.slice` (the entity itself, minus metadata + ownership), `metadata.slice` (the `metadataFieldValues` chunk), and `owners.slice` (the `ownership` chunk) — that together rehydrate the per-entity slice of the Redux store on every detail-page mount or status change. The thunk is dispatched from `DataEntityDetails.tsx` inside a `useEffect` whose dependency array includes `details.status?.status` — and `details.status` is part of the very payload the thunk just wrote into state, creating a **second-render refire** every time a status update completes (mount → fetch → status arrives → effect re-evaluates → fetch fires again). Because the backend's `GET` is **not idempotent** (each successful call runs `UPDATE data_entity SET view_count = view_count + 1` inside the same `@ReactiveTransactional` boundary — see batch F sidecar `DataEntityController#getDataEntityDetails`), this hop is the UI side of the P-01 view-count chain that feeds the Catalog Overview's "Popular" panel: **one detail-page open = at minimum 2 view_count increments** (mount + status-arrived re-fire). Errors are deliberately silenced at the toast layer via `{ switchOffErrorMessage: true }` — but the `rejected` action still writes the `AppError` into `loader.errors[fetchDataEntityDetails]`, where `<AppErrorPage>` renders it as a full-page banner with status, statusText and message.

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
    "on success: write `fulfilled` to loader-slice + run three extraReducers that splice the payload into three different slices (`dataentities.slice.ts:97-99` + `metadata.slice.ts:18` + `owners.slice.ts:53-54`)",
    "on success: SKIP the success-toast — no `setSuccessOptions` passed (`dataentities.thunks.ts:41`)",
    "on error: write `rejected` + `AppError` payload to loader-slice (`redux/slices/loader.slice.ts:42-48`)",
    "on error: SKIP the error-toast — `{ switchOffErrorMessage: true }` short-circuits `showServerErrorToast` (`dataentities.thunks.ts:41` + `redux/lib/handleResponseThunk.ts:37-39`)",
    "feed `getDataEntityDetailsFetchingStatuses` selector + `getDataEntityDetailsFetchingError` selector with the loader-slice state (`redux/selectors/dataentity.selectors.ts:159-164`)"
  ]
- invariants: [
    "exactly one HTTP call per dispatch (no client-side caching, no retry, no debounce, no in-flight de-dup) — verified by tracing `dataentities.thunks.ts:35-42` → no de-dup wrapper around `dataEntityApi.getDataEntityDetails`",
    "the resolved payload fans into THREE slices simultaneously via three independent `extraReducers` (dataentities/metadata/owners) — they all consume the same `{ payload }` and partition it by field",
    "the action-type string is a STABLE prefix (`'dataEntities/fetchDataEntityDetails'`) — Redux Toolkit auto-appends `/pending`, `/fulfilled`, `/rejected`; the loader-slice's three matchers key on these suffixes (`loader.slice.ts:28-49`)",
    "errors are persisted in store EVEN WHEN the toast is suppressed — `switchOffErrorMessage: true` only short-circuits the toast, not `rejectWithValue` (`redux/lib/handleResponseThunk.ts:35-41`)",
    "the dispatch loop in `DataEntityDetails.tsx` is gated by a 5-element dep array including `details.status?.status` — every dispatch that updates that field re-fires this thunk (`DataEntityDetails.tsx:58-64`)"
  ]
- audiences: [
    "`DataEntityDetails` React component (`DataEntityDetails.tsx:30-122`) — the per-entity detail page's mount-time loader",
    "indirectly: every child component reading `state.dataentities.byId[dataEntityId]`, `state.metadata`, or `state.owners` after the fulfilled action lands (Header, Tabs, Routes — `DataEntityDetails.tsx:90-100`)"
  ]

## dependencies_semantic

- requires-feature: [
    "P-01 Data Discovery — the detail page this thunk loads is the destination of every catalog click; verified live page `https://docs.opendatadiscovery.org/features/data-discovery` (status 200, 2026-05-19; fetched_excerpt: 'Data Discovery section's role as an entry point for locating entities through search and browsing'; the page describes the ENTRY paths but is silent on the destination detail-page mechanics — see `docs_link_semantic.doc_drift_findings`)",
    "P-01 Catalog Overview — the 'Popular' recommendation panel consumes the `view_count` counter that THIS thunk's HTTP call indirectly increments; live page `https://docs.opendatadiscovery.org/features/data-discovery/catalog-overview` (status 200, 2026-05-19; fetched_excerpt verbatim: 'Popular — the most-viewed or most-used data entities across the catalog.' — the FEATURE is documented; the trigger mechanism (clicking into the detail page) is NOT)"
  ]
- requires-config: [] — N/A (thunk reads no env-time config; `VITE_API_URL` is read once at module-init in `lib/api.ts:42-45` for the shared `apiConf`, not per-call)
- requires-runtime: [
    "Redux Toolkit `createAsyncThunk` + `extraReducers` semantics (`redux/lib/handleResponseThunk.ts:24-43`)",
    "the OpenAPI-generated `DataEntityApi#getDataEntityDetails` client method (imported from `generated-sources` per `dataentities.thunks.ts:1-23`)",
    "`fetch` API with `credentials: 'same-origin'` for cookie-based auth — `lib/api.ts:42-45` constructs the shared `apiConf` for `dataEntityApi`",
    "`react-hot-toast` for the success/error toast surface (`lib/errorHandling.tsx:2, 34-37`) — bypassed here for both directions",
    "the global `<AppErrorPage>` rendering component that reads `loader.errors[fetchDataEntityDetails]` and shows a full-page banner when `isNotLoaded` is true (`DataEntityDetails.tsx:116-119`)"
  ]
- couples-to: [
    "`dataEntityApi.getDataEntityDetails` — the OpenAPI-generated client; sole call site at `dataentities.thunks.ts:40`",
    "`handleResponseAsyncThunk` — the project's wrapper around `createAsyncThunk` (`redux/lib/handleResponseThunk.ts:19-43`); standardises success-toast + error-toast + reject-with-AppError handling across ~55 thunks per-grep",
    "`dataentities.slice.ts:97-99` — extraReducer that calls `updateDataEntity(state, payload)` (`dataentities.slice.ts:20-67`); strips out `metadata` + `ownership` because they're held in their own slices, splits `sourceList`/`targetList`/`inputList`/`outputList` into known + unknown (count-only) variants",
    "`metadata.slice.ts:18` — extraReducer extracting `metadataFieldValues` only (peer-slice)",
    "`owners.slice.ts:52-54` — extraReducer extracting `ownership` only (peer-slice)",
    "`loader.slice.ts:28-49` — global matcher that observes ALL `*/pending`, `*/fulfilled`, `*/rejected` actions; this thunk's three lifecycle events flow through it",
    "`DataEntityDetails.tsx:56-64` — the sole dispatch site for this thunk (no other component dispatches `fetchDataEntityDetails`; verified by `grep fetchDataEntityDetails <odd-platform-ui-repo>/src` — 7 hits: 5 wiring files + this useEffect + the thunk's own export)",
    "batch F sidecar `DataEntityController#getDataEntityDetails` — the backend hop that this thunk wraps; carries the +1 view_count side-effect that composes with the dispatch loop here"
  ]

## upstream_callers

- caller: "`DataEntityDetails` React component — `DataEntityDetails.tsx:56-64` (the useEffect that dispatches the thunk on entity-id change, group-update, group-add, group-delete, AND `details.status?.status` change)"
  multiplicity: "1+ dispatches per detail-page open — exactly one on initial mount; one ADDITIONAL dispatch every time `details.status?.status` changes (which itself is updated by the thunk's fulfilled action, producing a self-feeding refire even with no user interaction); MORE dispatches every time the user changes the entity's group membership while staying on the page"
  call_path: |
    User clicks an entity row in Search/Directory/Catalog Overview → React Router resolves to `/dataentities/:dataEntityId/...` → `DataEntityDetails` mounts → `useDataEntityRouteParams()` extracts `dataEntityId` → useEffect dep array evaluates ([dataEntityId, isDataEntityGroupUpdated, isDataEntityAddedToGroup, isDataEntityDeletedFromGroup, details.status?.status]) → first render: all deps are initial (false/undefined) → effect fires → `dispatch(fetchDataEntityDetails({ dataEntityId }))` → thunk calls `dataEntityApi.getDataEntityDetails` → BACKEND: `GET /api/dataentities/{id}` runs `UPDATE data_entity SET view_count = view_count + 1` then returns the full DataEntityDetails payload (batch F sidecar evidence) → `fulfilled` action → three extraReducers run → `state.dataentities.byId[id].status` is now populated → React re-renders → useEffect dep array re-evaluates → `details.status?.status` has changed from `undefined` to the actual status → effect fires AGAIN → second `dispatch(fetchDataEntityDetails(...))` → second `+1` increment on the backend.
- caller: "(no other dispatch sites) — verified by `grep -n 'dispatch(fetchDataEntityDetails' <odd-platform-ui-repo>/src` → returns exactly one match at `DataEntityDetails.tsx:57`"
  multiplicity: "0"
  call_path: "N/A"

## downstream_side_effects

- side_effect: "HTTP call: `GET /api/dataentities/{data_entity_id}` (the OpenAPI-generated `dataEntityApi.getDataEntityDetails` resolves to this — see batch F sidecar `DataEntityController#getDataEntityDetails`)"
  evidence: "dataentities.thunks.ts:40 + lib/api.ts:42-45 (`apiConf` configures `basePath: import.meta.env.VITE_API_URL || ''`, `credentials: 'same-origin'`)"
  scope: "network"
- side_effect: "+1 to `data_entity.view_count` row on the backend (per batch F sidecar: 'every successful read increments view_count by 1 in the same transaction')"
  evidence: "transitive via batch F sidecar `DataEntityController#getDataEntityDetails` (file:line `ReactiveDataEntityRepositoryImpl.java:174-180`)"
  scope: "external-db-mutation (indirect — happens on the backend in response to this thunk's HTTP call)"
- side_effect: "write `pending` to `loader.statuses['dataEntities/fetchDataEntityDetails']` (visible to every component reading `getDataEntityDetailsFetchingStatuses`)"
  evidence: "redux/slices/loader.slice.ts:28-34 + redux/selectors/dataentity.selectors.ts:159-161"
  scope: "store"
- side_effect: "on fulfilled: write the full `DataEntityDetails` payload (minus metadata + ownership) into `state.dataentities.byId[payload.id]` — including `sourceList`/`targetList`/`inputList`/`outputList` partitioned into known/unknown-count buckets, view-count, status, type, ALL the entity's descriptive fields"
  evidence: "redux/slices/dataentities.slice.ts:97-99 (extraReducer) → updateDataEntity at lines 20-67"
  scope: "store"
- side_effect: "on fulfilled: write `metadataFieldValues` into `state.metadata` slice (the metadata-by-entity index)"
  evidence: "redux/slices/metadata.slice.ts:18-22 (verified via Grep — `builder.addCase(thunks.fetchDataEntityDetails.fulfilled, (state, { payload }) => { const { id: dataEntityId, metadataFieldValues } = payload; ...`)"
  scope: "store"
- side_effect: "on fulfilled: write `ownership` into `state.owners` slice (the owners-by-entity index)"
  evidence: "redux/slices/owners.slice.ts:52-54 (verified via Grep — `builder.addCase(thunks.fetchDataEntityDetails.fulfilled, (state, { payload }): OwnersState => { const { id: dataEntityId, ownership: dataEntityOwnership } = payload; ...`)"
  scope: "store"
- side_effect: "on rejected: persist `AppError { status, statusText, url, message }` into `loader.errors['dataEntities/fetchDataEntityDetails']`"
  evidence: "redux/lib/handleResponseThunk.ts:34-41 + redux/slices/loader.slice.ts:42-48"
  scope: "store"
- side_effect: "NO toast on success (no `setSuccessOptions` passed — `dataentities.thunks.ts:41`); NO toast on error (`switchOffErrorMessage: true` short-circuits `showServerErrorToast` — `redux/lib/handleResponseThunk.ts:37-39`)"
  evidence: "dataentities.thunks.ts:41 (literal `{ switchOffErrorMessage: true }`)"
  scope: "ui-suppressed"

## tests_coverage_semantic

- covered_behaviours: [] — N/A: there are ZERO test files in the entire `odd-platform-ui` package — verified by `find <odd-platform-ui-repo>/src -name '*.test.*' -o -name '*.spec.*'` returning zero results (also no Vitest / Jest config files for tests under `odd-platform-ui` per the same find).
- uncovered_behaviours:
  - behaviour: "happy-path: `fulfilled` payload lands in `state.dataentities.byId[id]` with the right fields preserved and metadata/ownership stripped"
    test_class: "redux-thunk-unit-test (would mock `dataEntityApi.getDataEntityDetails`)"
  - behaviour: "fan-out: the SAME fulfilled payload writes to dataentities + metadata + owners slices simultaneously"
    test_class: "redux-integration-test (would dispatch and assert against all three slices)"
  - behaviour: "rejected: `AppError` payload reaches `loader.errors[...]` even when `switchOffErrorMessage: true` suppresses the toast"
    test_class: "redux-thunk-unit-test"
  - behaviour: "rejected: `<AppErrorPage>` reads the `AppError` from store and renders the banner"
    test_class: "react-component-test (would render `<DataEntityDetails>` with a mocked store)"
  - behaviour: "double-dispatch loop: when `details.status?.status` changes from `undefined` to a value (the fulfilled-action result), the useEffect refires the thunk"
    test_class: "react-component-integration-test (would mount `<DataEntityDetails>` with a mocked store + spy on `dispatch`)"
  - behaviour: "dispatch count per detail-page open is bounded (i.e. there is no infinite-fetch loop) under typical group-update scenarios"
    test_class: "react-component-integration-test"
  - behaviour: "`switchOffErrorMessage: true` flag observed by the helper — no `showServerErrorToast` is invoked on rejection"
    test_class: "redux-thunk-unit-test (would spy on `showServerErrorToast`)"
  - behaviour: "the OpenAPI-generated request envelope `{ dataEntityId }` is wired correctly to the API method — no field-name drift between thunk and client"
    test_class: "contract-test (type-level + runtime-mock)"
  - behaviour: "rapid entity-id change (user clicks through 3 entities quickly) — confirm the last `fulfilled` is the one that lands (no stale-response overwrite of a newer fetch)"
    test_class: "redux-thunk-unit-test (would assert against `redux-toolkit`'s built-in `requestId` matching, which `createAsyncThunk` does support but the project does not exercise)"
- test_files: [] — N/A: no test files exist for this thunk or for any thunk in `odd-platform-ui`
- gaps: |
    The platform's primary detail-page-loading thunk — the hop that triggers the +1 view_count side-effect on the backend AND fans the response into three slices simultaneously AND silently swallows errors at the toast layer — has zero test coverage AND lives in a UI codebase with zero test infrastructure (no Vitest, no Jest, no Cypress, no Playwright e2e suite within `odd-platform-ui`). The most operationally-significant gaps are: (1) the self-feeding refire loop driven by `details.status?.status` in the useEffect dep array, which today emits 2 view_count increments per page-open and which a regression that adds another `details.*` field to the dep array could amplify to N increments; (2) the silent failure mode — `switchOffErrorMessage: true` means an HTTP 5xx on detail-page load shows ONLY the full-page `<AppErrorPage>` banner, not a toast; a regression that breaks `<AppErrorPage>` rendering would leave users with a blank detail page and no feedback; (3) the fan-out invariant — a future field-name change on the `DataEntityDetails` contract could silently break the metadata-slice or owners-slice extraReducer without breaking compilation if the field becomes optional; (4) `requestId`-based stale-response protection — Redux Toolkit's `createAsyncThunk` ships this protection out of the box but the project's wrapper does not opt in; rapid entity-id switching can produce stale-payload writes. A `vitest` + `@testing-library/react` suite covering points (1)-(4) would catch every regression in this list and ground a baseline for the rest of the UI codebase.

## docs_link_semantic

- declared_docs: [] — no `@docs` annotation in the source (verified by reading `dataentities.thunks.ts:1-257` end-to-end and `DataEntityDetails.tsx:1-125` end-to-end; no `// @docs:` / JSDoc `@docs` / TypeScript decorator anywhere)
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-discovery"
    anchor: ""
    rationale: "P-01 Data Discovery is the pillar this thunk's parent component (`<DataEntityDetails>`) belongs to — the detail page is the destination of every Search/Directory click"
    last_verified_at: "2026-05-19T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      Verbatim (live WebFetch 2026-05-19): "Data Discovery section's role as an entry point for locating entities through search and browsing." The page describes entry paths and annotation features, but is silent on detail-page UI mechanics — confirmed by WebFetch ask-prompt 2026-05-19.
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/catalog-overview"
    anchor: "#recommended"
    rationale: "The 'Popular' surface on the Catalog Overview is what consumes the view_count this thunk indirectly increments — closest live doc evidence for the user-visible consequence of opening a detail page"
    last_verified_at: "2026-05-19T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      Verbatim (live WebFetch 2026-05-19): "Popular — the most-viewed or most-used data entities across the catalog." The page documents the FEATURE but is silent on the trigger mechanism (which is: opening any data-entity detail page → calling `GET /api/dataentities/{id}` → the backend's `UPDATE ... SET view_count = view_count + 1`) — confirmed by WebFetch ask-prompt 2026-05-19.
- doc_drift_findings:
  - "The doc-product never tells operators or readers that **opening a data-entity detail page contributes to the entity's 'Popular' ranking**. The trigger mechanism for the most user-visible consequence of `view_count` is undocumented. Live doc evidence: 'Popular — the most-viewed or most-used data entities across the catalog' (`catalog-overview` page, WebFetch 2026-05-19) — feature documented; trigger mechanism (each detail-page open is +1) undocumented. Repeats the doc-side gap recorded in batch F (`DataEntityController#getDataEntityDetails` sidecar `doc_drift_findings`)."
  - "The doc-product never tells operators that the detail-page load fires **at least 2** view_count increments per page-open under the current UI dep-array wiring (mount + status-arrived refire). A reader checking 'how popular is this entity' against the UI's view-count display has a 2x inflation baseline before counting actual repeat visits. Evidence (UI-side, this sidecar): `DataEntityDetails.tsx:58-64` (5-element dep array including `details.status?.status` which IS itself fetched-and-populated by this thunk). Evidence (backend-side, batch F sidecar): `ReactiveDataEntityRepositoryImpl.java:174-180`."

## implicit_adrs

- "The project standardises **all** async data-fetching through `handleResponseAsyncThunk` (a thin wrapper around Redux Toolkit's `createAsyncThunk`) that bakes in the success-toast / error-toast / `rejectWithValue(AppError)` triad — verified by Grep counts: `setSuccessOptions` 55 occurrences across 15 thunk files; `switchOffErrorMessage` 14 occurrences across 10 thunk files; ZERO direct `createAsyncThunk` usage outside this helper (project does not call `createAsyncThunk` from any non-helper file)." — evidence: `redux/lib/handleResponseThunk.ts:19-43` (the helper's exported surface; the only entry point) + grep counts (`grep -rln setSuccessOptions <odd-platform-ui-repo>/src/redux/thunks` = 14 files; `grep -rln switchOffErrorMessage <odd-platform-ui-repo>/src/redux/thunks` = 9 thunk files + 1 lib file). — intent_anchor: the helper's TYPE SIGNATURE makes `setSuccessOptions` and `switchOffErrorMessage` first-class options of the thunk-factory (`HandleResponseAsyncThunkOptions<ThunkArg>` interface at `handleResponseThunk.ts:14-17`); a thunk factory authored without using this wrapper would have to manually duplicate the try/catch/getErrorResponse/showServerErrorToast/rejectWithValue logic. The wrapper IS the project's standard. — confidence: HIGH
- "**Selective error-toast suppression** is the project's pattern for handling 'expected failure' loads. `switchOffErrorMessage: true` (`dataentities.thunks.ts:41`) signals that the detail-page load is one of the loaders whose failure is expected to be communicated by the full-page `<AppErrorPage>` banner, not by a transient toast. The decision is encoded in the type: `switchOffErrorMessage?: boolean` is an opt-in field of `HandleResponseAsyncThunkOptions`. 14 occurrences across 10 thunk files share this stance (loaders of large entities — fetchDataEntityDetails, fetchTermDetails, fetchPolicy, fetchDataEntityAlertList, fetchDatasetStructure, fetchAlerts, fetchActivity, fetchPolicyList, fetchDataEntityLineage, fetchDataQualityTest)." — evidence: `redux/lib/handleResponseThunk.ts:14-17` (type signature) + `dataentities.thunks.ts:41` (this thunk's opt-in) + `grep -rln switchOffErrorMessage <odd-platform-ui-repo>/src/redux/thunks` (10 files; same pattern). — intent_anchor: `switchOffErrorMessage?: boolean` is an optional field with NO default; setting it `true` is an opt-in, and the rest of the codebase reads the field on the error path (`if (!options.switchOffErrorMessage) { await showServerErrorToast(...); }` at `handleResponseThunk.ts:37`). — confidence: HIGH
- "The fulfilled action's payload is intentionally **fanned across three slices** rather than nested into a single dataentities-slice shape. The author rejected a 'nested entity record' shape in favour of side-by-side normalised slices (dataentities + metadata + owners), each with its own extraReducer registering on the same `fetchDataEntityDetails.fulfilled` action — visible in `dataentities.slice.ts:97`, `metadata.slice.ts:18`, `owners.slice.ts:52`. The COMMENT in `dataentities.slice.ts:55` makes the intent explicit." — evidence: `dataentities.slice.ts:55` (comment `// Metadata and Ownership are being stored in MetadataState and OwnersState`) + `metadata.slice.ts:18` + `owners.slice.ts:52-54`. — intent_anchor: verbatim comment at `dataentities.slice.ts:55`: `// Metadata and Ownership are being stored in MetadataState and OwnersState`. — confidence: HIGH

## bugs_limitations_corner_cases

- "**Self-feeding double-fetch loop on every detail-page open.** The useEffect at `DataEntityDetails.tsx:56-64` depends on `details.status?.status`, but `details.status` is part of the very payload the thunk writes into the store. First render: `details.status?.status` is `undefined` → effect fires → fetch + `+1 view_count` server-side. Fulfilled action populates `state.dataentities.byId[id].status` → re-render → dep array changes → effect fires AGAIN → second fetch + second `+1 view_count`. No comment or eslint-disable acknowledges this pattern. Net effect on Catalog Overview's 'Popular' counter: **every detail-page open inflates view_count by at least 2**, before counting any actual user-driven status edits." — evidence: `DataEntityDetails.tsx:58-64` (the dep array includes `details.status?.status` despite that field being populated by the same thunk's fulfilled action) + cross-ref batch F sidecar `DataEntityController#getDataEntityDetails` `bugs_limitations_corner_cases` (the server-side +1 evidence). — severity: HIGH
- "**No `requestId`-based stale-response protection.** Redux Toolkit's `createAsyncThunk` ships with built-in `requestId` tracking that lets reducers reject stale fulfilled actions, but `handleResponseAsyncThunk` does not propagate or check this. A user clicking through entities A → B → C rapidly can land in a state where A's late-arriving response overwrites C's fresh data in `state.dataentities.byId`. No comment or test guards against this; the splice-into-byId reducer at `dataentities.slice.ts:49-66` writes payload.id unconditionally." — evidence: `redux/lib/handleResponseThunk.ts:24-43` (no `requestId` parameter passed to the inner thunk; no `thunkAPI.requestId` check on fulfilled) + `dataentities.slice.ts:49-66` (the reducer just writes `[payload.id]: { ...payload }`; no checking against a "current entity id" in state). — severity: MEDIUM
- "**`AppError.message` falls back to the literal string `'An error occurred'`** when the backend returns a non-JSON body or a body without a `message` field. The detail page on error renders this generic string via `<AppErrorPage>`. A 502/504 from the platform process or an intervening proxy with an HTML error body becomes the same opaque banner as a real 404 — operators have no way to tell from the UI whether the entity doesn't exist or the backend is down." — evidence: `lib/errorHandling.tsx:12-26` (the fallback at line 24: `message: body?.message || 'An error occurred'`) + `DataEntityDetails.tsx:116-119` (`<AppErrorPage>` is what renders this on `isDataEntityDetailsNotFetched`). — severity: MEDIUM
- "**No retry, no debounce, no in-flight de-dup.** A user can mash the entity-id route param (or trigger group-add → group-delete → group-add quickly) and produce a series of fetches that each individually `+1` the backend's `view_count`. The UI provides no protection. For the `getPopular` ranking this is a denial-of-correctness vector — a user (or a misbehaving bot) can artificially inflate any entity's view-count by replaying the URL." — evidence: `dataentities.thunks.ts:35-42` (no de-dup/retry/debounce wrappers around the API call) + the dep array at `DataEntityDetails.tsx:58-64` (group-mutation flags are part of the dep array, so any group flip refires the thunk). — severity: MEDIUM
- "**Silent client-side stripping of empty external-name entries** — `updateDataEntity` at `dataentities.slice.ts:28-47` walks `sourceList`/`targetList`/`inputList`/`outputList` and **filters out any entry where `externalName` is falsy**, replacing them with `unknownSourcesCount` / `unknownTargetsCount` / `unknownInputsCount` / `unknownOutputsCount`. This is a client-side data-shape transformation that is opaque to anyone reading the raw API payload; the UI shows '+ N more' chips for these but the data is gone from the store. A backend regression that starts emitting null externalName for known entities would silently disappear from the lineage shortcuts on the detail page." — evidence: `dataentities.slice.ts:28-47` (the filter loop) + `dataentities.slice.ts:55-65` (the reducer that writes the filtered arrays + the count fields into the state). — severity: LOW
- "**No `dataEntityId` validation** — the thunk's request envelope is `{ dataEntityId: number }` (per the OpenAPI-generated `DataEntityApiGetDataEntityDetailsRequest` type) but the route param comes from `useDataEntityRouteParams()` which parses the URL. A negative or zero `dataEntityId` is passed through to the backend without a client-side guard." — evidence: `dataentities.thunks.ts:36-41` (no validation in the payload creator) + `DataEntityDetails.tsx:32, 57` (the route-param flows directly into the dispatch). — severity: LOW

## security

- **auth_mode_relevance**: INTERNAL_ONLY (this is a client-side Redux thunk — auth modes apply at the HTTP boundary where the backend serves the GET; the thunk inherits whatever auth posture the deployment runs under. `lib/api.ts:44` sets `credentials: 'same-origin'` so session cookies travel with the request regardless of which UI auth mode is active.) — evidence: `lib/api.ts:42-47` + cross-ref batch F sidecar `DataEntityController#getDataEntityDetails` `security.auth_mode_relevance` (`LOGIN_FORM | OAUTH2 | LDAP | DISABLED`).
- **ingestion_filter_relevance**: N/A — not an ingestion path. The thunk targets `GET /api/dataentities/{id}`, not `/ingestion/*`.
- **authorization_assertions**: [] — the thunk performs no client-side authorization check. The downstream `<DataEntityDetails>` component reads `resourcePermissions = useAppSelector(getResourcePermissions(PermissionResourceType.DATA_ENTITY, dataEntityId))` (`DataEntityDetails.tsx:35-37`) and uses it to gate three EDIT permissions on the header (`DATA_ENTITY_INTERNAL_NAME_UPDATE` / `DATA_ENTITY_GROUP_UPDATE` / `DATA_ENTITY_STATUS_UPDATE` at `DataEntityDetails.tsx:82-87`) — but the FETCH itself is unconditional. Any authenticated user can dispatch this thunk for any `dataEntityId`. (cross-ref batch F sidecar's finding that the backend GET has no `@PreAuthorize`.)
- **owner_scoping**: BYPASSES — the thunk passes only `dataEntityId` to the API; no owner / namespace / role filter is applied client-side. The backend (per batch F) also does not scope by owner. Combined: any authenticated user can fetch any entity's detail payload. — evidence: `dataentities.thunks.ts:38-40` (request envelope is `{ dataEntityId }` only).
- **data_exposure**:
  - "full `DataEntityDetails` payload (34 fields per batch F sidecar enumeration — id, oddrn, externalName, internalName, ownership[], dataSource, lookupTableId, status, viewCount, isStale, descriptions, terms, tags, metadataFieldValues[], versionList, sourceList/targetList/inputList/outputList, latestRun, …) → any authenticated user under LOGIN_FORM/OAUTH2/LDAP (any anonymous caller under `auth.type=DISABLED`) who knows or can guess a `dataEntityId`."
  - "the `<AppErrorPage>` banner displays `error.status`, `error.statusText`, `error.url`, and `error.message` from the backend's error response — including the full request URL. A 500-level error response carrying server diagnostics (e.g. stack trace fragments in `body.message`) would be rendered verbatim into the UI. — evidence: `lib/errorHandling.tsx:12-26` (the AppError shape) + `<AppErrorPage>` rendering at `DataEntityDetails.tsx:116-119`."
- **known_security_gaps**:
  - "Detail-page mount via this thunk **cross-confirms the platform's read-collaborative posture** (every authenticated user sees every entity). The thunk itself has no defending intent against this — no comment, no permission check, no warning. Combined with batch F's evidence that the backend GET has no `@PreAuthorize`, this is the UI-side half of the read-collaborative ADR (per `system-mission.md` P-09 Maintainer notes). — evidence: `dataentities.thunks.ts:35-42` (no auth check) + `DataEntityDetails.tsx:56-64` (no permission gate on the dispatch). — severity: MEDIUM"
  - "**Error-payload reflection** — `AppError.url` carries the request URL into the UI's error banner. For a deployment behind a reverse proxy that strips internal paths, this is harmless; for a deployment exposing the platform directly, the banner reveals the backend's actual API path (`/api/dataentities/{id}`). Low-severity defense-in-depth gap. — evidence: `lib/errorHandling.tsx:20-25`. — severity: LOW"

## performance

- **hot_paths**:
  - "Detail-page mount is a hot path — every entity click in Search/Directory/Catalog Overview lands in `<DataEntityDetails>`, which fires this thunk at least once (twice given the self-feeding refire — see `bugs_limitations_corner_cases`). The thunk in turn triggers the backend's most expensive read (per batch F: one CTE + four reactive zip-merges + a write — `ReactiveDataEntityRepositoryImpl.java:174-225`). — evidence: `DataEntityDetails.tsx:56-64`."
  - "`useEffect` at `DataEntityDetails.tsx:66-76` fires a parallel salvo of 4 additional thunks on the same mount: `fetchDataEntityAlertsCounts`, `fetchDataSetQualityTestReport`, `fetchDataSetQualitySLAReport`, `fetchResourcePermissions`. So a single detail-page open dispatches ~5 thunks (this thunk + 4 in the second useEffect), each making an independent HTTP call. — evidence: `DataEntityDetails.tsx:66-76`."
- **throughput_characteristics**:
  - "single-request-per-dispatch — no batching, no GraphQL-style payload coalescing"
  - "synchronous fan-out at fulfilled-time — three slices update in the same Redux action dispatch tick; no async/debounced reducer composition"
- **resource_allocation**:
  - "No client-side caching — every dispatch issues a network call. The `dataentities.slice.byId[id]` shape would support a 'has-it-already' check but the thunk does not consult it before fetching. — evidence: `dataentities.thunks.ts:35-42` (no cache check) + `dataentities.slice.ts:49-66` (`byId` keyed by entity id available)."
  - "the thunk's response is held in memory across the session (no `resetLoaderByAction` invocation on entity unmount visible in `DataEntityDetails.tsx`) — for a user navigating through 100 entities in a session, `state.dataentities.byId` grows to 100 entries. — evidence: `DataEntityDetails.tsx:1-125` (no cleanup useEffect-return) + `loader.slice.ts:18-23` (`resetLoaderByAction` exists but is not called from this component)."
- **scaling_characteristics**:
  - "stateless thunk (idempotent at the CLIENT layer — the SAME dispatch always produces the same store-update behaviour; the BACKEND read is NOT idempotent per batch F)"
  - "no client-side rate-limiting on dispatch — `<DataEntityDetails>` will refire the thunk on every dep-array change with no debounce or throttle"
- **known_performance_gaps**:
  - "**2-dispatch-per-mount baseline** (the self-feeding refire) — minimum doubles the load on `GET /api/dataentities/{id}`, the backend's hottest read endpoint (per batch F). A platform with N concurrent detail-page-views handles 2N+ of this endpoint's calls per session. — evidence: `DataEntityDetails.tsx:58-64`. — severity: HIGH"
  - "**No in-flight de-dup or cache** — rapid entity-id flips or group-mutation cycles can fire 4-6 concurrent dispatches of this thunk before the first one fulfils. No deduplication; each one runs the backend CTE + UPDATE. — evidence: `dataentities.thunks.ts:35-42`. — severity: MEDIUM"
  - "**5-thunk parallel salvo on detail-page mount** (this thunk + 4 others in the second useEffect) — each thunk's HTTP call is independent; the platform handles five concurrent requests per page-open for every navigation. For a user paging through entities at the keyboard's rate, that's the per-second floor. — evidence: `DataEntityDetails.tsx:56-76`. — severity: MEDIUM"

## sources

- understanding ← dataentities.thunks.ts:35-42 + DataEntityDetails.tsx:56-64 + redux/lib/handleResponseThunk.ts:19-43 + redux/slices/dataentities.slice.ts:97-99 + redux/slices/metadata.slice.ts:18 + redux/slices/owners.slice.ts:52-54 + batch F sidecar `DataEntityController#getDataEntityDetails`
- concepts.entities.DataEntityDetails ← dataentities.thunks.ts:36 + batch F sidecar's enumeration
- concepts.entities.AppError ← lib/errorHandling.tsx:5-10
- concepts.operations.dispatch ← redux/lib/handleResponseThunk.ts:24-32 + redux/slices/loader.slice.ts:28-34
- concepts.operations.api-call ← dataentities.thunks.ts:40 + lib/api.ts:42-52
- concepts.operations.fan-out ← redux/slices/dataentities.slice.ts:97-99 + redux/slices/metadata.slice.ts:18 + redux/slices/owners.slice.ts:52-54
- concepts.invariants.no-cache ← dataentities.thunks.ts:35-42 (no de-dup wrapper)
- concepts.invariants.dep-array-refire ← DataEntityDetails.tsx:58-64
- dependencies_semantic.requires-feature.P-01 ← WebFetch https://docs.opendatadiscovery.org/features/data-discovery 2026-05-19 + WebFetch https://docs.opendatadiscovery.org/features/data-discovery/catalog-overview 2026-05-19
- dependencies_semantic.requires-runtime.openapi-client ← dataentities.thunks.ts:1-23 + lib/api.ts:42-52
- dependencies_semantic.couples-to.handleResponseAsyncThunk ← redux/lib/handleResponseThunk.ts:19-43
- dependencies_semantic.couples-to.three-slices ← dataentities.slice.ts:55 (the intent comment) + metadata.slice.ts:18 + owners.slice.ts:52-54
- dependencies_semantic.couples-to.batch-F-sidecar ← lineage/odd-platform/understanding/odd-platform__java__DataEntityController__controller-method__getDataEntityDetails.md
- upstream_callers.[0] ← DataEntityDetails.tsx:56-64 + grep `dispatch(fetchDataEntityDetails`
- downstream_side_effects.HTTP-call ← dataentities.thunks.ts:40 + lib/api.ts:42-45
- downstream_side_effects.view-count-increment ← batch F sidecar's transitive evidence
- downstream_side_effects.store-fan-out ← redux/slices/dataentities.slice.ts:97-99 + metadata.slice.ts:18 + owners.slice.ts:52-54 + loader.slice.ts:28-49
- tests_coverage_semantic ← Glob `**/redux/**/*.test.*` returns 0 + `**/*.test.ts` returns 0 + `**/*.spec.ts*` returns 0
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/features/data-discovery 2026-05-19 status 200
- docs_link_semantic.inferred_docs.[1] ← WebFetch https://docs.opendatadiscovery.org/features/data-discovery/catalog-overview 2026-05-19 status 200
- docs_link_semantic.doc_drift_findings.[0] ← WebFetch ask-result 2026-05-19 (live page silent on view_count trigger) + batch F sidecar `doc_drift_findings`
- docs_link_semantic.doc_drift_findings.[1] ← DataEntityDetails.tsx:58-64 + batch F sidecar
- implicit_adrs.[0] ← redux/lib/handleResponseThunk.ts:14-43 + grep counts (`grep -rln setSuccessOptions <odd-platform-ui-repo>/src/redux/thunks` 14 files, `grep -rln switchOffErrorMessage <odd-platform-ui-repo>/src/redux/thunks` 9 files)
- implicit_adrs.[1] ← redux/lib/handleResponseThunk.ts:14-17 (type signature) + dataentities.thunks.ts:41 + grep `switchOffErrorMessage`
- implicit_adrs.[2] ← redux/slices/dataentities.slice.ts:55 (verbatim comment quoted in intent_anchor)
- bugs_limitations_corner_cases.self-feeding-loop ← DataEntityDetails.tsx:58-64 + batch F sidecar (server-side +1 evidence)
- bugs_limitations_corner_cases.no-requestId ← redux/lib/handleResponseThunk.ts:24-43 + dataentities.slice.ts:49-66
- bugs_limitations_corner_cases.generic-error-fallback ← lib/errorHandling.tsx:12-26 + DataEntityDetails.tsx:116-119
- bugs_limitations_corner_cases.no-dedup ← dataentities.thunks.ts:35-42 + DataEntityDetails.tsx:58-64
- bugs_limitations_corner_cases.silent-stripping ← dataentities.slice.ts:28-47, 55-65
- bugs_limitations_corner_cases.no-id-validation ← dataentities.thunks.ts:36-41 + DataEntityDetails.tsx:32, 57
- security.auth_mode_relevance ← lib/api.ts:42-47 + batch F sidecar
- security.authorization_assertions ← DataEntityDetails.tsx:35-37, 82-87 + dataentities.thunks.ts:38-40 (no client-side check)
- security.owner_scoping ← dataentities.thunks.ts:38-40 + batch F sidecar
- security.data_exposure ← batch F sidecar + lib/errorHandling.tsx:20-25
- security.known_security_gaps.[0] ← dataentities.thunks.ts:35-42 + DataEntityDetails.tsx:56-64 + system-mission.md P-09 Maintainer notes
- security.known_security_gaps.[1] ← lib/errorHandling.tsx:20-25
- performance.hot_paths.[0] ← DataEntityDetails.tsx:56-64 + batch F sidecar
- performance.hot_paths.[1] ← DataEntityDetails.tsx:66-76
- performance.scaling_characteristics.no-rate-limit ← dataentities.thunks.ts:35-42 + DataEntityDetails.tsx:58-64
- performance.known_performance_gaps.[0] ← DataEntityDetails.tsx:58-64 (the self-feeding refire dep)
- performance.known_performance_gaps.[1] ← dataentities.thunks.ts:35-42 (no de-dup)
- performance.known_performance_gaps.[2] ← DataEntityDetails.tsx:56-76 (the 5-thunk salvo)

## confidence_per_field

- understanding: HIGH (every claim traces to a file:line read in this session or a cross-reference to batch F sidecar already in-repo)
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (the negative — zero tests — is empirically verified by Glob returning zero results across three patterns; the "would-be" behaviour list is exhaustive enough for the test-coverage-mapper reducer)
- docs_link_semantic: HIGH (both live URLs WebFetched in this session at status 200; both excerpts directly quoted)
- implicit_adrs: HIGH (3 ADRs with explicit intent anchors — a type signature, an opt-in field, and a verbatim source comment)
- bugs_limitations_corner_cases: HIGH (6 corner cases, every one traced to a file:line; severities reflect operator impact)
- security: HIGH (file-local signals well-anchored; the file-level posture is correctly framed as the UI-side half of an aggregate read-collaborative position already documented in batch F + system-mission P-09 Maintainer notes)
- performance: HIGH

## Maintainer notes


---
node_id: "odd-platform ts jotai-store store:DataQualityStore"
node_kind: jotai-store
axis: jotai-store
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.5.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-22-ZC
related_pillar_features:
  - "P-04:F-002"  # Quality Dashboard — this node is the client-side filter store backing the /data-quality page
related_concepts:
  - data-quality-dashboard
  - dashboard-filter-set
  - jotai-feature-store
---

# DataQualityStore — semantic understanding

## understanding

`DataQualityStore.ts` is the client-side state store for the standalone Data
Quality Dashboard (`/data-quality`). It is a `jotai` atom module exporting one
source-of-truth atom (`formFiltersAtom`) holding the operator's two filter sets
— five table-side keys and five test-side keys, each a `FilterOption[]` —
plus a derived read-only atom (`filtersAtom`) that projects the selected
options into the `DataQualityRunsApiGetDataQualityTestsRunsRequest` shape the
dashboard fetch consumes, and two write-only "clear" atoms that empty one side
at a time. The store does NOT fetch data, does NOT touch the backend, and does
NOT persist — it is purely the in-memory filter selection that `DataQualityContent`
reads to build the dashboard query and that `DataQualityFilters` writes when the
operator picks a filter chip. It is the only Data Quality node that uses `jotai`;
the surrounding `/data-quality` feature is `jotai`-based while most of
`odd-platform-ui` is `redux` + `redux-thunk` — a deliberate per-feature-store
convention (see `implicit_adrs`).

## concepts

- entities: [FormFiltersAtom (the 10-key filter-selection record), FilterOption (`{id, name}` pair), DataQualityRunsApiGetDataQualityTestsRunsRequest (the projected dashboard-query shape), table-side filter set (`deNamespaceIds`/`deDatasourceIds`/`deOwnerIds`/`deTitleIds`/`deTagIds`), test-side filter set (`namespaceIds`/`datasourceIds`/`ownerIds`/`titleIds`/`tagIds`)]
- operations: [hold-filter-selection (`formFiltersAtom`), project-selection-to-query (`filtersAtom`), build-single-field-read-write-atom (`getFieldFilterAtom`), clear-table-side-filters (`clearTableFiltersAtom`), clear-test-side-filters (`clearTestFiltersAtom`)]
- invariants: [every `DataQualityRunsApiGetDataQualityTestsRunsRequest` key is represented in `formFiltersAtom` — enforced by the `[Property in keyof ...]-?` mapped type at line 5-7; an empty-array filter key is dropped from the projected query — enforced by the `length === 0` skip at line 36; the table-side and test-side filter sets are independent — the two clear atoms each touch only their own five keys]
- audiences: [the operator viewing `/data-quality` — the filter chips they select and the "Clear" buttons they press; `DataQualityContent` (derived-atom reader); `DataQualityFilters` and its `useFilter` hook (source-atom writers)]

## dependencies_semantic

- requires-feature: ["P-04:F-002 Quality Dashboard — this store has no purpose outside the `/data-quality` page; it is mounted only inside `DataQuality.tsx`"]
- requires-config: ["N/A — no config keys; pure client-side in-memory state"]
- requires-runtime: ["jotai ^2.3.1 (`odd-platform-ui/package.json:71`) — the atom primitive and Provider", "a `jotai` `<Provider>` ancestor — supplied by `DataQualityProvider.tsx` (`DataQualityAtomProvider`); without it the atoms fall back to jotai's default global store"]
- coupling: ["tight type coupling to `generated-sources/apis/DataQualityRunsApi` — `FormFiltersAtom` is a mapped type over `DataQualityRunsApiGetDataQualityTestsRunsRequest`; if the OpenAPI generator adds/removes a request key, `formFiltersAtom`'s initial-value object literal (lines 12-21) must be updated by hand or TypeScript fails to compile (the `-?` mapped type makes every key required)"]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "`filtersAtom` drops empty-array filter keys and keeps the projection to `{id}` arrays — at zero filters it returns `{}`, at N filters it returns N keys of number[]"
    test_class: unit
    criticality: MEDIUM
    note: "pure derived-atom logic (lines 32-42), trivially unit-testable with a jotai test store; the empty-key-skip is the operator-visible 'no filter = catalog-wide' behaviour"
  - behaviour: "`clearTableFiltersAtom` empties only the five `de*` keys and leaves the test-side keys untouched; `clearTestFiltersAtom` is the mirror"
    test_class: unit
    criticality: MEDIUM
    note: "the table/test independence invariant — a regression that cleared both sides would be operator-visible and is not asserted anywhere"
  - behaviour: "the store resets to all-empty when the `/data-quality` route unmounts and remounts (per-Provider-mount scope)"
    test_class: integration
    criticality: HIGH
    note: "navigate-away-and-back behaviour; requires a mounted router — see stress_findings Category E / probe P-120"
- test_files: ["none found — Grep for `DataQualityStore` / `formFiltersAtom` / `filtersAtom` under `odd-platform-ui/src` returns only the production files DataQualityStore.ts, DataQualityContent.tsx, DataQualityFilters.tsx, hooks/index.ts"]
- gaps: |
    Zero test coverage on this store. The highest-leverage gap is the
    integration class: the per-mount reset behaviour (does the operator's
    filter selection survive a navigate-away?) is the kind of UX contract a
    redux store would make global by default and a per-Provider jotai store
    inverts — exactly the sort of behaviour-shift a regression test should
    pin. The unit-class gaps (`filtersAtom` projection, the two clear atoms)
    are cheap and would catch a generated-sources key drift silently
    changing the projected query shape.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-quality"
    anchor: ""
    rationale: "the feature page for the Data Quality area this store belongs to — no `@docs` annotation exists in DataQualityStore.ts; inferred from the feature mapping"
    last_verified_at: "2026-05-22"
    last_verified_status: 200
    confidence: LOW
  - url: "https://docs.opendatadiscovery.org/features/data-quality/dashboard"
    anchor: ""
    rationale: "the Quality Dashboard sub-page — describes the `/data-quality` page and its table-side vs test-side filter sets that this store holds"
    last_verified_at: "2026-05-22"
    last_verified_status: 200
    confidence: LOW
  - url: "https://docs.opendatadiscovery.org/features/data-quality/quality-dashboard"
    anchor: ""
    rationale: "candidate URL tried for the dashboard sub-page — does not exist; recorded so a future refresh does not retry it"
    last_verified_at: "2026-05-22"
    last_verified_status: 404
    confidence: LOW
- fetched_excerpts: |
    From `https://docs.opendatadiscovery.org/features/data-quality/dashboard`
    (WebFetched 2026-05-22, status 200): "The two filter sets are independent
    — you can hold the tables-side filter at one slice and the tests-side at
    another." And: "Tables-side filters — narrow the Table Health and
    Monitored Tables rings to the selected slice of tables. Tests-side filters
    — narrow the Test Results Breakdown ring to tests with the selected
    attributes." The page explicitly states: "The page does not specify what
    the dashboard displays initially or what the default filter state is
    before any filters are applied." From `.../features/data-quality`
    (WebFetched 2026-05-22, status 200): "the cross-catalog quality dashboard
    ... the per-side filter sets (tables vs tests)".
- doc_drift_findings:
  - "The live `.../features/data-quality/dashboard` page documents the table-side/test-side independence and the per-side filters but is silent on the default state and on filter persistence — it does not tell the operator that filters reset on navigate-away (the per-Provider-mount behaviour, see stress_findings Category E). This is a doc-gap, not a contradiction: for a pure client-state node the absence of internal-state documentation is expected, but the navigate-away reset is operator-visible UX and a candidate DOC-NNN follow-up for doc-gap-finder."

## implicit_adrs

- "The `/data-quality` feature manages its filter state with `jotai` atoms scoped by a feature-local `<Provider>`, deliberately diverging from the `redux` + `redux-thunk` store that the rest of `odd-platform-ui` uses — this is a consistently-applied per-feature-store convention, not a one-off." — evidence: DataQualityStore.ts:1 (`import { atom } from 'jotai'`) + DataQualityProvider.tsx:1-7 + the same `*Store/*Atoms.ts` + `*Provider.tsx` pattern in OwnerAssociations (`Management/OwnerAssociations/OwnerAssociationsStore/`), DEGLineage (`DataEntityDetails/Lineage/DEGLineage/lib/atoms.ts` + `DEGLineageAtomProvider.tsx`), and DatasetStructure (`DataEntityDetails/DatasetStructure/DatasetStructureOverview/lib/atoms.ts` + `DatasetStructureCompare/lib/atoms.ts`) — 4 feature areas, 26 files importing `jotai` — intent_anchor: `OwnerAssociationsAtomProvider` (`Management/OwnerAssociations/OwnerAssociationsStore/OwnerAssociationsProvider.tsx:1-8`) is byte-for-byte the same shape as `DataQualityAtomProvider` (`const X: React.FC<React.PropsWithChildren> = ({ children }) => <Provider>{children}</Provider>`) — a copied convention applied verbatim across feature areas is intentional, not accidental — confidence: HIGH
- "The store scopes its atoms per-feature-mount: `DataQualityProvider.tsx` wraps the dashboard in a bare `jotai` `<Provider>` rather than letting the atoms use jotai's global default store — the decision makes the dashboard's filter selection feature-local and mount-lifetime-bound rather than application-global." — evidence: DataQualityProvider.tsx:4-6 (`<Provider>{children}</Provider>`) + DataQuality.tsx:8-17 (the `<DataQualityAtomProvider>` wraps both `<DataQualityFilters>` and `<DataQualityContent>` and nothing else) — intent_anchor: the `<Provider>` is mounted at the feature-root level, the narrowest scope that still lets the sidebar filters and the content area share state — confidence: HIGH

## bugs_limitations_corner_cases

- "`formFiltersAtom`'s initial value is a hand-written object literal of 10 keys (lines 12-21) that must stay in lockstep with `keyof DataQualityRunsApiGetDataQualityTestsRunsRequest`; the `-?` mapped type (`FormFiltersAtom`, line 6) makes every generated-sources key required, so a key added by the OpenAPI generator breaks compilation until the literal is updated by hand — there is no comment marking this coupling, and a maintainer regenerating sources would have to read the type error to discover it." — evidence: DataQualityStore.ts:5-22 — severity: LOW
- "The filter selection does not survive navigating away from `/data-quality` and back: the route mounts `<DataQuality>` via a single non-wildcard `<Route path={dataQualityPath()} element={<DataQuality />} />` (App.tsx:73), React Router unmounts the `element` on navigation away, that destroys `<DataQualityAtomProvider>` and its `jotai` `<Provider>`, and the next mount starts a fresh store at the all-empty `formFiltersAtom` default — the operator loses their filter slice with no warning. (The URL search params written by `DataQualityFilters`' second `useEffect` are the only persistence channel; whether they fully reconstruct state on remount is a sibling-component behaviour — see references.)" — evidence: DataQualityStore.ts:11-22 (all-empty default) + DataQualityProvider.tsx:4-6 + App.tsx:39,73 (`lazy()` + single `<Route>`) — severity: MEDIUM
- "`getFieldFilterAtom` (lines 24-30) is exported but has no caller within the Data Quality component tree — `DataQualityFilters` and `useFilter` write `formFiltersAtom` directly; `DataQualityContent` reads `filtersAtom`. A dead-or-future export; a maintainer cannot tell from the file whether it is intentionally-public API or an abandoned earlier design." — evidence: DataQualityStore.ts:24-30 (declaration) — confirmed unused by Grep for `getFieldFilterAtom` across `odd-platform-ui/src` returning only this file — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "DataQualityStore.ts:11-22"
      name: "formFiltersAtom initial value"
      value: "all 10 filter keys = [] (empty array)"
      questions:
        - q: "What at N = 0? (the empty-state — no filter selected)"
          a: "At zero selected filters every key of `formFiltersAtom` is `[]`. `filtersAtom` (lines 32-42) skips every key whose array `length === 0` (line 36), so it returns `{}` — the empty object. `DataQualityContent` passes that to `useGetDataQualityDashboard({})` (DataQualityContent.tsx:23-24), which fetches the dashboard with no filter params — i.e. the catalog-wide unfiltered view. This is the default the operator sees on first open of `/data-quality`."
          confidence: STATIC-INFERRED
          evidence: "DataQualityStore.ts:11-22,32-42 + DataQualityContent.tsx:22-24"
        - q: "What at N = 1? (a single filter chip selected)"
          a: "With one chip selected on one key, that key's array has length 1, the other 9 stay `[]`. `filtersAtom` emits a one-key object: `{ <thatKey>: [<id>] }` (the `.map(({id}) => id)` at line 37 projects each `FilterOption` to its numeric id). The dashboard query carries exactly that one filter."
          confidence: STATIC-INFERRED
          evidence: "DataQualityStore.ts:32-42"
        - q: "What does the operator see at the empty-state boundary?"
          a: "The dashboard renders with the React Query `initialData` (dataQuality.ts:34-72): three donut rings all at 0 and six anomaly-class categories all at 0, until the real `{}`-filtered fetch resolves and replaces it. So before the network completes the operator sees an all-zero dashboard, then the true catalog-wide numbers — this is a property of the fetch hook's `initialData`, not of this store, but it is the boundary the store's all-empty default leads into."
          confidence: STATIC-INFERRED
          evidence: "DataQualityStore.ts:11-22 + dataQuality.ts:34-72,74-82 (`initialData`)"
  name_behavior_pairs:
    - name: "filtersAtom"
      promise: "an atom holding 'the filters' — by name, the current filter state"
      implementation: "a read-only DERIVED atom (no write fn — `atom(get => ...)`, line 32) that PROJECTS `formFiltersAtom` into the API request shape: it drops every empty key and maps each remaining `FilterOption[]` to a `number[]` of ids. It is not the source of filter state — `formFiltersAtom` is. `filtersAtom` is the query-shaped read-only view."
      drift: MINOR
      operator_visible_consequence: "No operator-visible consequence — purely a naming nuance for maintainers: `filtersAtom` is read-only and derived; the writable source is `formFiltersAtom`. A maintainer who tries to `set(filtersAtom, ...)` gets a no-write atom."
      confidence: STATIC-INFERRED
      evidence: "DataQualityStore.ts:11-22 (source) vs 32-42 (derived read-only)"
    - name: "clearTableFiltersAtom / clearTestFiltersAtom"
      promise: "clear the table / clear the test filters"
      implementation: "write-only atoms (`atom(null, (get, set) => ...)`, lines 44, 56). `clearTableFiltersAtom` resets exactly the five `de*` keys (deNamespaceIds, deDatasourceIds, deOwnerIds, deTitleIds, deTagIds — lines 48-52) and spreads the rest unchanged; `clearTestFiltersAtom` resets exactly the five non-`de` keys (namespaceIds, datasourceIds, ownerIds, titleIds, tagIds — lines 60-64). The two are exact mirrors and each touches only its own side."
      drift: NONE
      operator_visible_consequence: ""
      confidence: STATIC-INFERRED
      evidence: "DataQualityStore.ts:44-54,56-66"
  orderings: []
  auth_gates: []
  resource_boundaries:
    - location: "DataQualityProvider.tsx:4-6"
      kind: concurrency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "The store is per-Provider-mount. `DataQuality.tsx` mounts exactly one `<DataQualityAtomProvider>` (line 8) wrapping the single sidebar + content pair, and the `/data-quality` route is a single `<Route>` (App.tsx:73) — so within one browser tab there is one store instance and the React render loop serialises all atom writes; no concurrent corruption is possible inside a tab. Writes through `useFilter` (hooks/index.ts:22-37) and the clear atoms (DataQualityStore.ts:44-66) all read-modify-write `formFiltersAtom` synchronously via jotai's `get`/`set`, which jotai applies atomically per write. Two browser tabs each get their own store (no shared backend state in this node), so cross-tab is not a concurrency concern for the store itself."
          confidence: STATIC-INFERRED
          evidence: "DataQualityProvider.tsx:1-7 + DataQuality.tsx:8 + App.tsx:73 + DataQualityStore.ts:24-30,44-66"
        - q: "Is the call replay-safe?"
          a: "Yes for the store itself — setting `formFiltersAtom` to the same value twice yields the same state; the clear atoms are idempotent (clearing an already-empty side is a no-op-equivalent). The store has no side effects of its own. (A `formFiltersAtom` write does trigger a re-render of `DataQualityContent`, which re-derives `filtersAtom` and may issue a new dashboard fetch — the multiplicity of that fetch is a sibling-component concern, see references / LSN-017.)"
          confidence: STATIC-INFERRED
          evidence: "DataQualityStore.ts:32-66"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No cache fronts the store. The store IS in-memory state; it has no TTL. The downstream React Query cache keyed `['dataQualityDashboard', params]` (dataQuality.ts:78) is fed by the derived `filtersAtom` value but lives in the fetch hook, not this node. The store-relevant lifecycle fact is the per-mount RESET: the store's lifetime equals the `<DataQualityAtomProvider>` mount lifetime — navigating away from `/data-quality` unmounts the route element, destroys the Provider, and the next visit starts a fresh all-empty store. Whether the URL search params (written by `DataQualityFilters`' useEffect) repopulate state on remount is verified by probe P-120."
          confidence: PROBE-NEEDED
          evidence: "P-120"
  request_inputs: []
  probes_emitted:
    - probe_id: P-120
      question: "Does the operator's filter selection survive navigating away from /data-quality and back, or does the per-Provider-mount jotai store reset to the all-empty default? And do the URL search params written by DataQualityFilters fully reconstruct the selection on remount?"
      probe_path: "lineage/odd-platform/probes/P-120.yaml"
  stress_summary:
    triggers_total: 5
    questions_total: 11
    answers_static_inferred: 10
    answers_probe_needed: 1
    answers_reference: 0
    drift_flags: 1
```

## security

- auth_mode_relevance: N/A — client-side React state module; not on the HTTP surface. The `/data-quality` route is reachable only inside the authenticated SPA shell, but this node enforces nothing about auth mode.
- ingestion_filter_relevance: N/A — not HTTP, not ingestion.
- authorization_assertions: []
- owner_scoping: "N/A — the store holds only filter-chip selections (FilterOption `{id, name}` pairs); it reads and writes no entity data and applies no owner filter. Owner-scoping of the dashboard data is decided server-side by the DataQualityRuns endpoint that consumes the projected query — out of scope for this node."
- data_exposure: ["Selected filter ids → the browser URL: `DataQualityFilters`' second `useEffect` writes each non-empty filter key as a JSON-stringified query param into the address bar (DataQualityFilters.tsx:46-54). The values originate in `formFiltersAtom`. The exposed data is namespace/datasource/owner/title/tag ids the operator themselves selected — already-visible-to-them catalog metadata, not a secret — but it does mean a shared/bookmarked `/data-quality?...` URL carries the filter selection. This write happens in the sibling component; the store is the source of the values."]
- known_security_gaps: []

## performance

- hot_paths: ["`filtersAtom` re-derivation runs on every `formFiltersAtom` change — i.e. on every filter chip select/deselect. The derivation is an `Object.keys(...).reduce(...)` over exactly 10 keys with a `.map` per non-empty key (DataQualityStore.ts:34-39): O(10 + total-selected-options), trivially cheap. Each `formFiltersAtom` write also re-renders every component subscribed to it or to a derived atom — `DataQualityContent` (filtersAtom) and `DataQualityFilters` (formFiltersAtom) — and a new `filtersAtom` value re-triggers `useGetDataQualityDashboard`, issuing a backend fetch. The fetch is the real cost on this path; the store math is negligible."]
- throughput_characteristics: ["single-user client state — one store per browser tab; no batching, no streaming concern."]
- resource_allocation: ["holds at most 10 arrays of `FilterOption` objects in memory; bounded by how many filter chips the operator selects. Negligible memory footprint."]
- scaling_characteristics: ["per-mount, per-tab stateful — does not scale beyond one operator's session and does not need to. Each `formFiltersAtom` write produces a fresh object via spread (lines 28, 47-53, 59-65) — standard immutable-update, no accumulation."]
- known_performance_gaps: ["Every single filter chip toggle triggers a full dashboard re-fetch (no debounce / batch-apply): `formFiltersAtom` write → `filtersAtom` re-derive → new React Query `queryKey` → network request. An operator building a multi-chip filter slice fires one backend dashboard query per chip rather than one on an 'Apply' action. This is a sibling-component (DataQualityFilters / DataQualityContent) design property — the store merely makes each write immediately observable — but it is the latency-relevant fact a maintainer reading this store should know. — evidence: DataQualityStore.ts:32-42 (derived atom updates synchronously on every source write) + DataQualityContent.tsx:23-24 (no debounce around `useGetDataQualityDashboard`) — severity: MEDIUM"]

## upstream_callers

- entry_point: "ui_route:/data-quality"
  caller_node: "odd-platform ts react-component:DataQualityFilters.tsx"
  multiplicity_per_trigger: unresolved
  evidence: "DataQualityFilters.tsx:22-24 binds `formFiltersAtom`, `clearTableFiltersAtom`, `clearTestFiltersAtom` via `useAtom`; writes occur per operator filter-chip toggle and per Clear-button click, plus a mount-time write inside the searchParams-sync `useEffect` (DataQualityFilters.tsx:28-43) when the URL carries filter params. Per-trigger multiplicity (e.g. whether the mount useEffect double-fires under StrictMode) is a sibling-component concern."
  observation_class: ui-call
  unresolved: true
- entry_point: "ui_route:/data-quality"
  caller_node: "odd-platform ts react-component:DataQualityContent.tsx"
  multiplicity_per_trigger: 1
  evidence: "DataQualityContent.tsx:23 reads `filtersAtom` via `useAtom` (read-only — destructures `[filterState]` only); re-reads on every `formFiltersAtom` change. One read-subscription per mount."
  observation_class: ui-call
  unresolved: true
- entry_point: "ui_route:/data-quality"
  caller_node: "odd-platform ts hook:useFilter (DataQualityFilters/hooks/index.ts)"
  multiplicity_per_trigger: unresolved
  evidence: "hooks/index.ts:12 binds `formFiltersAtom` via `useAtom`; `onSelectOption`/`onDeselectOption` (lines 19-37) write it per chip toggle. One `useFilter` instance is created per FilterItem (NamespaceFilter, DatasourceFilter, OwnerFilter, TitleFilter, TagFilter — instantiated 10× across the two filter sets in DataQualityFilters.tsx:70-89)."
  observation_class: ui-call
  unresolved: true
- entry_point: "ui_route:/data-quality"
  caller_node: "odd-platform ts react-component:DataQuality.tsx"
  multiplicity_per_trigger: 1
  evidence: "DataQuality.tsx:8 mounts `<DataQualityAtomProvider>` (DataQualityProvider.tsx) which establishes the jotai `<Provider>` scope these atoms resolve against — not a direct atom caller, but the node that gives the store its lifetime. One Provider per route mount."
  observation_class: ui-call
  unresolved: true

## downstream_side_effects

- side_effect_class: cache-mutate
  description: "A `formFiltersAtom` write mutates jotai store state; jotai propagates the change to every subscribed component in the Provider scope (`DataQualityContent` via `filtersAtom`, `DataQualityFilters` via `formFiltersAtom`), causing a re-render. This is in-process React state, not a persisted cache."
  evidence: "DataQualityStore.ts:11-30,44-66 — every write atom calls `set(formFiltersAtom, ...)`"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/data-quality"

- side_effect_class: external-call
  description: "INDIRECT: a `formFiltersAtom` write changes the derived `filtersAtom` value, which is the `useGetDataQualityDashboard` argument in DataQualityContent; a changed value produces a new React Query `queryKey` and triggers a GET to the DataQualityRuns dashboard endpoint. The store does not issue the call itself — it is the upstream cause. Recorded as a reference: the fetch and its multiplicity belong to DataQualityContent's sidecar (LSN-017 class — re-render/re-dispatch multiplicity)."
  evidence: "DataQualityStore.ts:32-42 (derived atom) → DataQualityContent.tsx:23-24 (`useGetDataQualityDashboard(filterState)`) → dataQuality.ts:74-82"
  cardinality_per_call: "1 fetch per distinct projected filter value (React Query dedupes identical queryKeys); 0 if the projection is unchanged"
  reachable_from_entry_points:
    - "ui_route:/data-quality"

## sources

- understanding ← DataQualityStore.ts:1-66 + DataQualityContent.tsx:11,22-24 + DataQualityFilters.tsx:14-24 + DataQuality.tsx:1-20
- concepts.entities.FormFiltersAtom ← DataQualityStore.ts:5-22
- concepts.entities.FilterOption ← interfaces.ts:3-6
- concepts.operations.project-selection-to-query ← DataQualityStore.ts:32-42
- concepts.invariants ← DataQualityStore.ts:5-7,36,44-66
- dependencies_semantic.requires-runtime ← DataQualityStore.ts:1 + DataQualityProvider.tsx:1-7 + package.json:71
- dependencies_semantic.coupling ← DataQualityStore.ts:2,5-22
- tests_coverage_semantic.test_files ← Grep `DataQualityStore`/`formFiltersAtom`/`filtersAtom` under odd-platform-ui/src (no test file in results)
- docs_link_semantic.inferred_docs ← WebFetch https://docs.opendatadiscovery.org/features/data-quality (200) + .../features/data-quality/dashboard (200) + .../features/data-quality/quality-dashboard (404)
- docs_link_semantic.fetched_excerpts ← WebFetch .../features/data-quality + .../features/data-quality/dashboard, 2026-05-22
- implicit_adrs.[0] ← DataQualityStore.ts:1 + DataQualityProvider.tsx:1-7 + Management/OwnerAssociations/OwnerAssociationsStore/OwnerAssociationsProvider.tsx:1-8 (byte-identical Provider) + Grep `from 'jotai'` (26 files across OwnerAssociations / DEGLineage / DatasetStructure / DataQuality)
- implicit_adrs.[1] ← DataQualityProvider.tsx:4-6 + DataQuality.tsx:8-17
- bugs_limitations_corner_cases.[0] ← DataQualityStore.ts:5-22
- bugs_limitations_corner_cases.[1] ← DataQualityStore.ts:11-22 + DataQualityProvider.tsx:4-6 + App.tsx:39,73 + routes/dataQualityRoutes.ts:1-2
- bugs_limitations_corner_cases.[2] ← DataQualityStore.ts:24-30 + Grep `getFieldFilterAtom` (only this file)
- stress_findings.tunables ← DataQualityStore.ts:11-22,32-42 + DataQualityContent.tsx:22-24 + dataQuality.ts:34-82
- stress_findings.name_behavior_pairs ← DataQualityStore.ts:32-66
- stress_findings.resource_boundaries ← DataQualityProvider.tsx:1-7 + DataQuality.tsx:8 + App.tsx:73 + DataQualityStore.ts:24-66
- security.data_exposure ← DataQualityFilters.tsx:46-54
- performance.hot_paths ← DataQualityStore.ts:32-42 + DataQualityContent.tsx:23-24
- performance.known_performance_gaps ← DataQualityStore.ts:32-42 + DataQualityContent.tsx:23-24
- upstream_callers.[0-3] ← DataQualityFilters.tsx:22-24,28-43,70-89 + DataQualityContent.tsx:23 + hooks/index.ts:12,19-37 + DataQuality.tsx:8
- downstream_side_effects.[0] ← DataQualityStore.ts:11-66
- downstream_side_effects.[1] ← DataQualityStore.ts:32-42 + DataQualityContent.tsx:23-24 + dataQuality.ts:74-82

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: MEDIUM
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH
- upstream_callers: MEDIUM
- downstream_side_effects: MEDIUM
- stress_findings: HIGH

## Maintainer notes


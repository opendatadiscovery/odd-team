---
node_id: "odd-platform ts react-component component:DataQualityFilters"
node_kind: react-component
axis: react-component
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.5.0
enrichment_status: complete
confidence_overall: MEDIUM
session_id: session-2026-05-22-ZC
related_pillar_features:
  - "P-04:F-002"  # Quality Dashboard — this node IS the dashboard's filter panel (first sidecar of the feature)
related_features:
  - F-022  # per-dataset DQ test reports + SLA badge — DISTINCT surface; cross-referenced, not duplicated
related_concepts:
  - data-quality-dashboard
  - dashboard-filter-panel
  - jotai-scoped-atom
  - request-input-naming-drift
---

# DataQualityFilters — semantic understanding

## understanding

`DataQualityFilters` is the sticky left-sidebar filter panel of the standalone Data Quality Dashboard (the `/data-quality` route). It renders TWO independent filter blocks — "Filters for tables" and "Filters for tests" — each containing the same five sub-filters (Namespace, Datasource, Owner, Title, Tag); the two blocks write ten distinct keys into the jotai `formFiltersAtom` (`deNamespaceIds`/`namespaceIds`, `deDatasourceIds`/`datasourceIds`, etc.) where the `de*`-prefixed keys scope the **dataset/table** entities and the unprefixed keys scope the **test/job** entities (`DataQualityFilters.tsx:70-89`, `DataQualityStore.ts:11-22`). The panel is a pure form: it never fetches the dashboard itself — it owns the URL `searchParams` round-trip (two `useEffect` hooks bi-directionally sync `formFilters` ↔ the query string at `DataQualityFilters.tsx:28-54`) and the sibling `DataQualityContent` reads the derived `filtersAtom` and issues the actual `getDataQualityTestsRuns` request. Each filter's selected ids ultimately bind, at the `ReactiveDataQualityRunsRepositoryImpl` SQL layer, to a different table — and the "Title" filter in particular binds to `OWNERSHIP.TITLE_ID` (an ownership role such as "Data Steward"), NOT to any dataset name/title, an input-name-vs-implementation mismatch the operator cannot see from the bare label.

## concepts

- entities: [
    "FilterOption — {id: number, name: string} — the unit a user selects in any filter (`interfaces.ts:3-6`)",
    "formFiltersAtom — jotai atom holding ten FilterOption[] arrays, one per (side × dimension) (`DataQualityStore.ts:11-22`)",
    "filtersAtom — derived read-only jotai atom projecting formFiltersAtom into the id-array request shape consumed by the dashboard query (`DataQualityStore.ts:32-42`)",
    "DataQualityRunsApiGetDataQualityTestsRunsRequest — the generated request type whose ten optional `*Ids: number[]` fields are the filter keys (`DataQualityStore.ts:2, 5-7`)",
    "Tables-side filters — deNamespaceIds / deDatasourceIds / deOwnerIds / deTitleIds / deTagIds — narrow Table Health + Monitored Tables (`DataQualityFilters.tsx:70-74`)",
    "Tests-side filters — namespaceIds / datasourceIds / ownerIds / titleIds / tagIds — narrow Test Results Breakdown (`DataQualityFilters.tsx:85-89`)"
  ]
- operations: [
    "render-two-filter-blocks — one 'Filters for tables', one 'Filters for tests', each with 5 sub-filters (`DataQualityFilters.tsx:56-91`)",
    "sync-formFilters-from-url — on mount/searchParams-change, parse JSON-encoded query params into formFiltersAtom (`DataQualityFilters.tsx:28-43`)",
    "sync-url-from-formFilters — on formFilters change, JSON-encode non-empty arrays into the query string with `replace: true` (`DataQualityFilters.tsx:46-54`)",
    "clear-tables-filters — reset the five `de*` keys to [] (`DataQualityFilters.tsx:64-68` → `DataQualityStore.ts:44-54`)",
    "clear-tests-filters — reset the five unprefixed keys to [] (`DataQualityFilters.tsx:79-83` → `DataQualityStore.ts:56-66`)"
  ]
- invariants: [
    "Each sub-filter receives a `filterKey` prop typed `keyof DataQualityRunsApiGetDataQualityTestsRunsRequest` — the same component instance serves both sides, differentiated only by which of the 10 keys it is given (`NamespaceFilter.tsx:10-12`, `DataQualityFilters.tsx:70-89`)",
    "URL ↔ atom sync uses `JSON.stringify`/`JSON.parse` of the full FilterOption[] (id+name), so the query string carries names, not just ids (`DataQualityFilters.tsx:33, 35, 50`)",
    "Only non-empty filter arrays are written to the URL; an empty filter contributes no query param (`DataQualityFilters.tsx:49`)",
    "filtersAtom drops empty arrays and maps each FilterOption[] to its `id` list — the dashboard request never carries names (`DataQualityStore.ts:34-41`)",
    "The five filters are visually labelled Namespace / Datasource / Owner / Title / Tag via `t(...)` i18n keys with no scope qualifier (`NamespaceFilter.tsx:29`, `DatasourceFilter.tsx:29`, `OwnerFIlter.tsx:29`, `TitleFilter.tsx:29`, `TagFilter.tsx:29`)"
  ]
- audiences: [
    "data-quality-engineer / data-platform-operator — opens `/data-quality` to triage catalog-wide test health and narrows the three breakdown rings by the five filter dimensions (per live doc `https://docs.opendatadiscovery.org/features/data-quality/dashboard` 2026-05-22 status 200: 'Filter the dashboard by five dimensions: Namespace, Datasource, Owner, Title, and Tag.')"
  ]

## dependencies_semantic

- requires-feature: [
    "P-04:F-002 Quality Dashboard — this node is the dashboard's filter panel; the dashboard rings are rendered by sibling `DataQualityContent` (REFERENCE — sibling node, not yet enriched)",
    "Catalog metadata for the five filter dimensions — the autocompletes are populated by `useGetNamespaceList` / `useGetDataSourceList` / `useGetOwnerList` / `useGetTitleList` / `useGetTagList`, so the dashboard's filterability depends on those four list APIs being populated (`NamespaceFilter.tsx:4`, `DatasourceFilter.tsx:3`, `OwnerFIlter.tsx:4`, `TitleFilter.tsx:4`, `TagFilter.tsx:4`)"
  ]
- requires-config: [] — N/A. The component reads no `@Value`-equivalent env/config; the only literals are the autocomplete page/size in `useFilter` (see stress_findings.tunables).
- requires-runtime: [
    "React 18 — `useEffect`, `FC` (`DataQualityFilters.tsx:1-2`)",
    "jotai — `useAtom` over `formFiltersAtom` and the two clear-atoms; the atoms live in a nested `<Provider>` created by `DataQualityProvider` so they are scoped per dashboard mount (`DataQualityFilters.tsx:3, 22-24`, `DataQualityProvider.tsx:4-6`)",
    "react-router-dom — `useSearchParams` for the URL round-trip (`DataQualityFilters.tsx:7, 25`)",
    "react-i18next — `useTranslation` for all visible labels (`DataQualityFilters.tsx:4, 21`)",
    "@mui/material — `Grid`, `Typography`; `Autocomplete` in the sub-filter autocomplete (`DataQualityFilters.tsx:5`, `MultipleFilterItemAutocomplete.tsx:9`)"
  ]
- couples-to: [
    "`DataQualityStore.ts` — imports `clearTableFiltersAtom`, `clearTestFiltersAtom`, `formFiltersAtom` (`DataQualityFilters.tsx:14-18`); the panel is the sole WRITER of `formFiltersAtom` (`DataQualityContent` is the reader-via-`filtersAtom`)",
    "`FilterItem/{Namespace,Datasource,Owner,Title,Tag}Filter.tsx` — the five sub-filter components, each thin wrappers over `useFilter` + `MultipleFilterItem` (`DataQualityFilters.tsx:9-13`)",
    "`DataQualityFilters/hooks/index.ts` `useFilter` — the shared hook every sub-filter calls; binds `formFiltersAtom[filterKey]` to select/deselect handlers and runs the list query (`hooks/index.ts:7-47`)",
    "`DataQualityContent` (sibling, REFERENCE — not yet enriched) — reads `filtersAtom` and calls `useGetDataQualityDashboard` → `dataQualityRunsApi.getDataQualityTestsRuns` (`DataQualityContent.tsx:11, 23-24`)"
  ]

## tests_coverage_semantic

- covered_behaviours: [] — no test file exists for this component or its sub-filters (see test_files).
- uncovered_behaviours:
  - behaviour: "URL ↔ formFilters bidirectional sync — open `/data-quality?namespaceIds=[{...}]`, assert the panel hydrates the Namespace tests-side filter; select a filter, assert the query string updates with `replace: true`"
    test_class: integration
    criticality: HIGH
    note: "the two useEffects at DataQualityFilters.tsx:28-54 are the deep-linking / shareable-URL contract; a regression silently breaks bookmarked dashboards"
  - behaviour: "clear-tables vs clear-tests isolation — assert the 'Clear' button in the tables block resets only the five `de*` keys and leaves the tests-side selections intact"
    test_class: unit
    criticality: MEDIUM
    note: "clearTableFiltersAtom / clearTestFiltersAtom (DataQualityStore.ts:44-66) are the only thing keeping the two sides independent"
  - behaviour: "filterKey wiring — assert each of the 10 (side × dimension) slots passes the correct key (NamespaceFilter gets `deNamespaceIds` in the tables block and `namespaceIds` in the tests block, etc.)"
    test_class: unit
    criticality: MEDIUM
    note: "a copy-paste swap of two filterKey props would route a filter to the wrong backend parameter with no compile error — both are valid keys of the same union type"
  - behaviour: "autocomplete options-loading state — assert `optionsLoading` returns to false after the list query resolves, for the success AND error paths"
    test_class: unit
    criticality: MEDIUM
    note: "MultipleFilterItemAutocomplete.tsx:91-104 sets optionsLoading true then false only inside the `isSuccess` branch (see bugs_limitations_corner_cases)"
  - behaviour: "Title-filter scope — assert that selecting a value in the 'Title' filter narrows the dashboard by ownership title, not by dataset name (the Category-F drift)"
    test_class: integration
    criticality: HIGH
    note: "no test pins what the 'Title' filter actually filters by; the SQL bind is OWNERSHIP.TITLE_ID"
- test_files: [] — `grep -rln 'DataQualityFilters' <odd-platform>/odd-platform-ui/src` returned no `*.test.*` / `*.spec.*` file (run 2026-05-22).
- gaps: |
    The entire Data Quality Dashboard front-end is untested at every test_class. The highest-leverage gap is integration: there is no test that mounts `<DataQuality>`, selects a filter, and asserts the resulting `getDataQualityTestsRuns` request carries the expected `*Ids` parameter — which is exactly the boundary where the Category-F "Title" mismatch and the namespace-widening live. A unit test of the `filterKey` wiring is cheap and would catch the copy-paste-swap class. The autocomplete stale-closure (`optionsLoading` stuck true) is a unit-testable React-state bug with no test guarding it.

## docs_link_semantic

- declared_docs: [] — N/A. `DataQualityFilters.tsx` carries no `// @docs:` annotation; this matches the repo-wide UI convention (no React component declares `@docs`).
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-quality/dashboard"
    anchor: ""
    rationale: "Dedicated sub-page for the Quality Dashboard at `/data-quality`; explicitly enumerates the five filter dimensions this component renders and the tables-vs-tests split"
    last_verified_at: "2026-05-22T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      Filter capability (verbatim): "Filter the dashboard by five dimensions: Namespace, Datasource, Owner, Title, and Tag."

      Dual filter sets (verbatim): tables-side filters "narrow the Table Health and Monitored Tables rings to the selected slice of tables." tests-side filters "narrow the Test Results Breakdown ring to tests with the selected attributes."

      Independence (verbatim): "The two filter sets are independent — you can hold the tables-side filter at one slice and the tests-side at another."

      Conjunction (verbatim): "For simplicity the platform implements only one logical conjunction across filter dimensions — `AND`."

      Verbatim ABSENCE: the page "does not explain what the 'Title' filter specifically filters by" and "does not explain whether the Namespace filter includes the datasource's namespace."
  - url: "https://docs.opendatadiscovery.org/features/data-quality"
    anchor: ""
    rationale: "P-04 pillar landing page; names the `/data-quality` route and the 'per-side filter sets (tables vs tests)'"
    last_verified_at: "2026-05-22T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      Verbatim: "the catalog-wide quality view at `/data-quality` — three breakdown rings (Table Health / Test Results / Monitored Tables), six anomaly-class metrics, and the per-side filter sets (tables vs tests)."
- doc_drift_findings:
  - "**DOC DRIFT — the 'Title' filter is undocumented and its name is misleading.** The live `dashboard` page (WebFetched 2026-05-22 status 200) lists 'Title' as one of the five filter dimensions but explicitly does NOT explain what it filters by. The UI label is the bare i18n key `t('Title')` (`TitleFilter.tsx:29`). The `titleIds` parameter binds at the SQL layer to `OWNERSHIP.TITLE_ID` (`ReactiveDataQualityRunsRepositoryImpl.java:301, 309`) — the ownership *title/role* (e.g. 'Data Steward', 'Owner'), a concept distinct from a dataset's name. An operator reading 'Title' will reasonably expect to filter by a dataset's title/name and instead filters by ownership role; the docs offer no correction. Severity: HIGH — same shape as LSN-020 (`userIds` → `OWNER_ID`)."
  - "**DOC DRIFT — the Namespace filter's datasource-inheritance widening is undocumented.** The `dashboard` page does not state that the Namespace filter also matches datasource-level namespaces. The SQL joins `NAMESPACE.ID.in(namespaceIds)` against `DATA_ENTITY.NAMESPACE_ID` **OR `DATA_SOURCE.NAMESPACE_ID`** (`ReactiveDataQualityRunsRepositoryImpl.java:288-293`). A namespace selected in the filter therefore matches both entities directly assigned to it and entities whose datasource carries it — a wider result set than 'Namespace' alone implies. Severity: MEDIUM."
  - "**DOC DRIFT — the filter panel's whole interaction model is undocumented despite a dedicated dashboard doc page.** The `dashboard` page describes the rings and names the filters but never documents: that filter selections are reflected into the URL query string (deep-linkable / shareable), that there are two 'Clear' buttons scoped per side, or that the autocomplete searches by name. The dashboard doc covers the read surface and is silent on the operator's primary interaction surface. Severity: MEDIUM (the operator gets less than the product offers — no harm, but the doc under-delivers)."

## implicit_adrs

- "**The dashboard's filter state is isolated in a dedicated nested jotai `<Provider>` rather than the app-global atom store.** `DataQualityProvider` wraps the whole dashboard subtree in a fresh `<Provider>` from jotai (`DataQualityProvider.tsx:4-6`), and `DataQuality.tsx:8` mounts it. The effect is that `formFiltersAtom` / `filtersAtom` are scoped to one dashboard mount — leaving `/data-quality` and returning resets all ten filters to `[]`. The intent is a self-contained feature store: the dashboard's filter selections do not leak into, or get polluted by, any other page's atom state. The decision is the deliberate `<Provider>` wrapper — jotai atoms are global by default; introducing a scoped Provider is an explicit choice." — evidence: `DataQualityProvider.tsx:1-6` (the nested Provider) + `DataQuality.tsx:7-18` (the dashboard mounts the provider as its outermost element) — intent_anchor: "export const DataQualityAtomProvider: React.FC<React.PropsWithChildren> = ({ children }) => <Provider>{children}</Provider>" (`DataQualityProvider.tsx:4-6`) — confidence: HIGH

- "**The same five filter components are reused across the tables and tests sides via a single `filterKey` prop typed against the request shape.** `NamespaceFilter` / `DatasourceFilter` / `OwnerFilter` / `TitleFilter` / `TagFilter` each declare `filterKey: keyof DataQualityRunsApiGetDataQualityTestsRunsRequest` (`NamespaceFilter.tsx:10-12` and the four siblings) and `DataQualityFilters` instantiates each one twice with a different key (`DataQualityFilters.tsx:70-74` tables, `85-89` tests). The intent is DRY: ten filter slots, one component each, the only variation being which of the ten request keys it binds. The decision is the type-parameterised `filterKey` prop — a maintainer chose generic reuse over ten bespoke components." — evidence: `NamespaceFilter.tsx:10-23` + `DataQualityFilters.tsx:70-89` (each component mounted twice with distinct keys) — intent_anchor: "interface NamespaceFilterProps { filterKey: keyof DataQualityRunsApiGetDataQualityTestsRunsRequest; }" (`NamespaceFilter.tsx:10-12`) — confidence: HIGH

- "**Filter selections are mirrored into the URL query string so the dashboard view is deep-linkable and shareable.** Two `useEffect` hooks form a bidirectional bridge: one hydrates `formFiltersAtom` from `searchParams` on mount (`DataQualityFilters.tsx:28-43`), the other writes `formFiltersAtom` back to the query string with `{ replace: true }` on every change (`DataQualityFilters.tsx:46-54`). The intent is that an operator can bookmark or paste a `/data-quality?...` URL and land on the same filtered view; `replace: true` avoids polluting browser history with every keystroke-driven filter change. The decision is the explicit URL round-trip — a filter panel that only used jotai would lose state on reload." — evidence: `DataQualityFilters.tsx:25, 28-54` (the `useSearchParams` hook + the two sync effects) — intent_anchor: "// sync formFilters with searchParams on mount" + "// sync searchParams with formFilters on formFilters change" (`DataQualityFilters.tsx:27, 45`) — confidence: HIGH

## bugs_limitations_corner_cases

- "**[RESOLVED 2026-06-13 — CTRIB-011 / odd-platform#1767, ships 0.28.0]** The next entry (the 'Title' filter mislabel) is FIXED: the filter is relabelled to `t('Owner title')` (`TitleFilter.tsx:29`, a dedicated i18n key added to all 7 locales) and both `titleIds`/`deTitleIds` params on `getDataQualityTestsRuns` carry a clarifying OpenAPI `description`. The `OWNERSHIP.TITLE_ID` bind is INTENTIONAL ownership-role semantics and is deliberately unchanged (relabel-not-rebind). Docs updated: `data-quality/dashboard.md` (DOC-453, `documentation@release/0.28.0`). Covered by a FE unit test (`FilterItem/__tests__/TitleFilter.test.tsx`) + e2e IT-130. The original drift entry is retained below as the historical record." — severity: RESOLVED

- "**The 'Title' filter (`titleIds` / `deTitleIds`) binds to `OWNERSHIP.TITLE_ID` — ownership role, not dataset title — with no UI signal of the translation.** The label is the bare `t('Title')` (`TitleFilter.tsx:29`). Traced through `filtersAtom` → `getDataQualityTestsRuns` → `DataQualityRunsServiceImpl` → `DataQualityTestFiltersMapper` → `ReactiveDataQualityRunsRepositoryImpl.getConditionsForFilters`, `titleIds` binds to `OWNERSHIP.TITLE_ID.in(titleIds)` (`ReactiveDataQualityRunsRepositoryImpl.java:301, 309`). `OWNERSHIP.TITLE_ID` references the `TITLE` table — the ownership *role* assigned alongside an owner (e.g. 'Data Steward'). An operator who selects a value in the 'Title' filter expecting to narrow the dashboard to a named dataset narrows it instead to datasets where someone holds that ownership title. This is the LSN-020 input-name-vs-implementation drift class, instantiated on the dashboard. The 'Title' autocomplete is populated by `useGetTitleList` (`TitleFilter.tsx:4`), which lists ownership titles — so a careful operator who opens the dropdown sees role names and can infer the meaning; the bare label alone is misleading." — evidence: `TitleFilter.tsx:29` (label) + `DataQualityFilters.tsx:73, 88` (the `titleIds`/`deTitleIds` keys) + `DataQualityStore.ts:32-42` (`filtersAtom` projection) + `DataQualityContent.tsx:23-24` (request issue) + `ReactiveDataQualityRunsRepositoryImpl.java:296-311` (the `OWNERSHIP.TITLE_ID.in(...)` bind) — severity: HIGH

- "**`MultipleFilterItemAutocomplete` has no debounce on the search input — every keystroke triggers a list-API request.** The autocomplete's `onInputChange` calls `setSearchText(query)` directly (`MultipleFilterItemAutocomplete.tsx:57-66`); `searchText` is passed straight into `useFilter`'s `useHook({ page: 1, size: 30, query: searchText })` (`hooks/index.ts:13-17`), and `searchText` is the React-Query key (`namespace.ts:7`), so each character types a fresh GET to `/api/namespaces` (or datasources/owners/titles/tags). Typing a 10-character namespace name fires up to 10 list requests. There is no `useDebounce`, no minimum-character gate. React Query's per-key cache de-duplicates repeats but not the distinct prefixes. With 5 filters × 2 sides, an operator filling out the panel generates a request burst." — evidence: `MultipleFilterItemAutocomplete.tsx:57-66` (`setSearchText` on every `'input'` event) + `hooks/index.ts:11-17` (`searchText` → `query` param, no debounce) + `namespace.ts:6-9` (`params` in the queryKey) — severity: MEDIUM

- "**`MultipleFilterItemAutocomplete`'s options-loading effect has a stale-closure / stuck-spinner bug.** The effect at `MultipleFilterItemAutocomplete.tsx:91-104` sets `setOptionsLoading(true)` unconditionally, then sets it back to `false` ONLY inside `if (hookResult.isSuccess)`. Its dependency array is `[searchText, autocompleteOpen]` — `hookResult` is NOT in it. Consequences: (a) if the list query is still pending or has errored when the effect runs, `optionsLoading` stays `true` and the `noOptionsText` renders empty-string forever (`MultipleFilterItemAutocomplete.tsx:162`), so a failed list call shows neither options nor a 'No options' message; (b) because `hookResult` is excluded from deps, the effect does not re-run when the query later resolves, so freshly-arrived options are not flushed into `options` until the next `searchText`/`autocompleteOpen` change. The autocomplete can show stale or empty options after a slow/failed metadata fetch." — evidence: `MultipleFilterItemAutocomplete.tsx:91-104` (effect body + dep array) + `MultipleFilterItemAutocomplete.tsx:162` (`noOptionsText={optionsLoading ? '' : 'No options'}`) — severity: MEDIUM

- "**The autocomplete fetches a fixed first page of 30 options and never paginates — catalogs with >30 namespaces/owners/tags are not fully filterable.** `useFilter` hard-codes `{ page: 1, size: 30 }` (`hooks/index.ts:13-16`) and there is no page-increment, no infinite-scroll, no 'load more'. The server query DOES receive the `query` text, so server-side name search narrows the 30; but `getFilterOptions` ALSO re-filters client-side (`MultipleFilterItemAutocomplete.tsx:75-89`). If an operator's catalog has 200 owners and the desired owner is not in the first 30 the server returns for a given search prefix, it cannot be selected via that prefix. For short or empty search text the operator sees only the first 30 of the dimension." — evidence: `hooks/index.ts:13-16` (`page: 1, size: 30` literal) + `MultipleFilterItemAutocomplete.tsx:75-89` (redundant client-side filter) + `interfaces.ts:11-19` (the Hook contract fixes page/size/query) — severity: MEDIUM

- "**Every sub-filter instance subscribes to the ENTIRE `formFiltersAtom` via `useFilter`, so any single filter change re-renders all ten filter components.** `useFilter` does `const [selectedOptions, setSelectedOptions] = useAtom(formFiltersAtom)` (`hooks/index.ts:12`) — it reads the whole atom, not a per-key slice, even though `DataQualityStore.ts:24-30` defines a `getFieldFilterAtom(key)` focused-atom helper that is the correct tool and is NOT used here. Selecting one Tag re-renders all ten `FilterItem` autocompletes. For a 10-filter panel this is a real but bounded render cost; the unused `getFieldFilterAtom` shows the codebase already has the fix and the panel does not apply it." — evidence: `hooks/index.ts:12` (subscribes to `formFiltersAtom` whole) + `DataQualityStore.ts:24-30` (the unused `getFieldFilterAtom` focused-atom factory) — severity: LOW

- "**URL-sync round-trip is lossy on hand-edited query strings and silently swallows malformed JSON.** The mount effect does `JSON.parse(value)` on each query-param value with no try/catch (`DataQualityFilters.tsx:35`). A user who hand-edits `/data-quality?namespaceIds=foo` (not valid JSON) causes `JSON.parse` to throw inside the effect; React surfaces this as an uncaught render-time error. Additionally the effect only copies a key if `key in newFilters` (`DataQualityFilters.tsx:32`), so an unknown query param is silently ignored — acceptable — but a malformed value for a KNOWN key crashes rather than degrading. There is no schema validation on the parsed shape (a param parsed to a non-array, or to objects missing `id`, flows straight into `formFiltersAtom`)." — evidence: `DataQualityFilters.tsx:31-39` (the `for...of` over searchParams, the unguarded `JSON.parse`) — severity: LOW

- "**The `de*`/unprefixed key split is the only thing separating tables-side from tests-side filters, and a swapped `filterKey` prop would mis-route a filter with no compile error.** Both `deTitleIds` and `titleIds` are valid members of `keyof DataQualityRunsApiGetDataQualityTestsRunsRequest`, so `<TitleFilter filterKey='titleIds' />` placed in the tables block (`DataQualityFilters.tsx:73` expects `deTitleIds`) would type-check and silently filter the wrong side. No test guards the wiring (see tests_coverage_semantic)." — evidence: `DataQualityFilters.tsx:70-74, 85-89` (the 10 prop assignments) + `DataQualityStore.ts:5-22` (both prefixed and unprefixed keys in the same type) — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "hooks/index.ts:13-16"
      name: "useFilter autocomplete list-query page/size"
      value: "page: 1, size: 30"
      questions:
        - q: "What at N = 0? At N = 1?"
          a: "size is fixed at 30, not operator-controllable. With 0 matching options the autocomplete shows 'No options' (or empty string while optionsLoading is true — see the stale-closure bug). With 1 option, that single option renders. page is fixed at 1 — there is no page 0."
          confidence: STATIC-INFERRED
          evidence: "hooks/index.ts:13-16 + MultipleFilterItemAutocomplete.tsx:162"
        - q: "What at N = 30? At N = 31? At N = 3000?"
          a: "At exactly 30 results the full first page renders. At 31+ the 31st onward is unreachable: there is no page-increment and no infinite scroll, so any dimension value not in the server's first-30 for a given search prefix cannot be selected. At 3000 the operator still only ever sees 30 per prefix. Silent truncation — no 'showing 30 of N' indicator."
          confidence: STATIC-INFERRED
          evidence: "hooks/index.ts:13-16 (no page increment) + MultipleFilterItemAutocomplete.tsx:75-104 (no load-more)"
        - q: "What does the operator see at the truncation boundary?"
          a: "Nothing distinguishes a truncated list from a complete one — the autocomplete renders 30 options identically whether the dimension has 30 or 3000 values. The operator cannot tell their target is simply on page 2. This routes to bugs_limitations_corner_cases (no pagination)."
          confidence: STATIC-INFERRED
          evidence: "MultipleFilterItemAutocomplete.tsx:146-178 (render has no count/truncation hint)"
    - location: "DataQualityFilters.tsx:70-89"
      name: "filter-dimension count per side"
      value: "5 filters × 2 sides = 10 keys"
      questions:
        - q: "What at N = 0 selected filters?"
          a: "With zero filters selected, filtersAtom yields {} (DataQualityStore.ts:34-41 drops empty arrays), and getDataQualityTestsRuns runs with all ten param lists null/empty — the dashboard shows catalog-wide unfiltered totals."
          confidence: STATIC-INFERRED
          evidence: "DataQualityStore.ts:32-42 + ReactiveDataQualityRunsRepositoryImpl.java:323-337 (shouldAddFilters* both false → no filter CTEs)"
        - q: "What at all 10 filters populated?"
          a: "All ten *Ids lists are non-empty; the SQL builds both a test-filters CTE and a data-entity-filters CTE and joins DATA_SOURCE/NAMESPACE/OWNERSHIP/TAG_TO_DATA_ENTITY conditionally. All dimensions combine with AND (confirmed by live doc). REFERENCE to the backend sidecar for the full multi-join cost."
          confidence: REFERENCE
          evidence: "odd-platform java DataQualityRunsController controller-class:DataQualityRunsController (not yet enriched)"
        - q: "What does the operator see at each boundary?"
          a: "Empty → unfiltered dashboard. Fully populated → the intersected slice. No error state on the panel side regardless of selection count."
          confidence: STATIC-INFERRED
          evidence: "DataQualityFilters.tsx:56-91 (panel renders identically; it never reflects request state)"
  name_behavior_pairs:
    - name: "clearTableFiltersAtom / 'Clear' button in 'Filters for tables' block"
      promise: "Clears the table-side filters"
      implementation: "Resets exactly the five `de*` keys (deNamespaceIds, deDatasourceIds, deOwnerIds, deTitleIds, deTagIds) to [], leaving the five unprefixed test-side keys untouched (DataQualityStore.ts:44-54)."
      drift: NONE
      operator_visible_consequence: ""
      confidence: STATIC-INFERRED
      evidence: "DataQualityFilters.tsx:64-68 + DataQualityStore.ts:44-54"
    - name: "clearTestFiltersAtom / 'Clear' button in 'Filters for tests' block"
      promise: "Clears the test-side filters"
      implementation: "Resets exactly the five unprefixed keys to [], leaving the five `de*` keys untouched (DataQualityStore.ts:56-66)."
      drift: NONE
      operator_visible_consequence: ""
      confidence: STATIC-INFERRED
      evidence: "DataQualityFilters.tsx:79-83 + DataQualityStore.ts:56-66"
    - name: "formFiltersAtom / 'form filters'"
      promise: "Holds the in-progress (form) state of the filter panel, distinct from the applied filter"
      implementation: "There is no separate apply step. `filtersAtom` is a DERIVED atom that recomputes from `formFiltersAtom` on every change (DataQualityStore.ts:32-42), and `DataQualityContent` reads `filtersAtom` directly into `useGetDataQualityDashboard` (DataQualityContent.tsx:23-24). So every selection applies immediately — 'form' implies a stage-then-submit model the code does not have."
      drift: MINOR
      operator_visible_consequence: "Each filter selection immediately re-queries the dashboard; there is no 'Apply' button. The naming `formFiltersAtom` mildly over-promises a draft stage; behaviour (live filtering) is fine but not what the name suggests."
      confidence: STATIC-INFERRED
      evidence: "DataQualityStore.ts:32-42 + DataQualityContent.tsx:23-24"
  orderings:
    - location: "MultipleFilterItemAutocomplete.tsx:75-89"
      questions:
        - q: "What is the actual ordering of autocomplete options at the lowest layer?"
          a: "Options arrive from the list API (`useGetNamespaceList` etc.) in whatever order the backend returns; this component does not sort them — `getFilterOptions` only FILTERS (removes already-selected, substring-matches searchText). The MUI Autocomplete renders them in array order. The backend list-endpoint ordering is REFERENCE — owned by the namespace/datasource/owner/title/tag list-API sidecars."
          confidence: REFERENCE
          evidence: "MultipleFilterItemAutocomplete.tsx:75-89 (filter only, no sort) — backend list ordering: namespace/owner/tag list-API sidecars (not enriched)"
        - q: "What is the tie-breaker when option names are equal?"
          a: "No client-side tie-break; two options with the same name de-dup partially — `getFilterOptions` excludes a server option if a SELECTED option has the same `name` (MultipleFilterItemAutocomplete.tsx:77-80), name-based not id-based, so two distinct entities sharing a name collide: selecting one hides the other from the list."
          confidence: STATIC-INFERRED
          evidence: "MultipleFilterItemAutocomplete.tsx:77-80 (selectedOption.name === option.name)"
        - q: "Which subset is returned when result-set > page size?"
          a: "First 30 only (size: 30, page: 1, hooks/index.ts:13-16). See tunables — no pagination."
          confidence: STATIC-INFERRED
          evidence: "hooks/index.ts:13-16"
        - q: "Does any upstream layer re-sort or filter the result?"
          a: "Yes — `getFilterOptions` does redundant client-side substring filtering (MultipleFilterItemAutocomplete.tsx:81-86) on top of the server-side `query` search. With both layers filtering on the same searchText this is duplicated work; it does not hide a backend bug but it is wasteful and means client-filtered results are a subset of an already server-filtered 30."
          confidence: STATIC-INFERRED
          evidence: "MultipleFilterItemAutocomplete.tsx:81-86 + hooks/index.ts:13-17"
  auth_gates: []  # No auth gate at this layer — this is a React component. The route `/data-quality` is mounted inside the authenticated app shell (App.tsx:73); the backend `getDataQualityTestsRuns` endpoint's auth posture is REFERENCE (DataQualityRunsController sidecar, not yet enriched). No `@PreAuthorize`-equivalent exists or is expected in a UI component.
  resource_boundaries:
    - location: "DataQualityProvider.tsx:4-6"
      kind: concurrency
      questions:
        - q: "Can two simultaneous mounts produce corrupted state?"
          a: "No. `DataQualityProvider` creates a fresh jotai `<Provider>` per mount, so each `/data-quality` mount has its own isolated `formFiltersAtom`. Two browser tabs each get independent atom stores; there is no shared mutable state across mounts."
          confidence: STATIC-INFERRED
          evidence: "DataQualityProvider.tsx:4-6 + DataQuality.tsx:8 (Provider is the dashboard's outermost element)"
        - q: "Is the filter panel replay-safe?"
          a: "Yes for the panel itself — it is a pure form with no side effect beyond writing the atom and the URL. Re-mounting with the same `/data-quality?...` URL reproduces the same `formFiltersAtom` via the mount-sync effect (DataQualityFilters.tsx:28-43). The dashboard query it indirectly drives is a GET (idempotent)."
          confidence: STATIC-INFERRED
          evidence: "DataQualityFilters.tsx:28-54 (only side effects are setFormFilters + setSearchParams)"
        - q: "If a cache fronts this, what is the staleness window?"
          a: "React Query caches the dashboard result keyed by ['dataQualityDashboard', params] (dataQuality.ts:78) and each list query keyed by its params. No explicit staleTime is set on either — React Query's default (data considered stale immediately, refetched on remount/refocus). The filter panel does not manage this cache; staleness behaviour is REFERENCE to the DataQualityContent sibling for the dashboard query."
          confidence: REFERENCE
          evidence: "dataQuality.ts:77-81 (no staleTime) — DataQualityContent sibling (not enriched)"
  request_inputs:
    - location: "DataQualityFilters.tsx:70, 85 (NamespaceFilter filterKey='deNamespaceIds' | 'namespaceIds')"
      input_kind: form-field
      input_name: "Namespace filter (deNamespaceIds / namespaceIds)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The label `t('Namespace')` promises: narrow the dashboard to data entities belonging to the selected namespace(s)."
          confidence: STATIC-INFERRED
          evidence: "NamespaceFilter.tsx:29 (name={t('Namespace')})"
        - q: "When supplied, what does the implementation USE it for?"
          a: "DataQualityFilters writes the selected FilterOption[] into formFiltersAtom[namespaceIds|deNamespaceIds] → filtersAtom maps to id[] (DataQualityStore.ts:34-41) → DataQualityContent calls getDataQualityTestsRuns (DataQualityContent.tsx:23-24) → DataQualityRunsController.getDataQualityTestsRuns (DataQualityRunsController.java:19-32) → DataQualityRunsServiceImpl → DataQualityTestFiltersMapper.mapToDto → ReactiveDataQualityRunsRepositoryImpl.getConditionsForFilters joins NAMESPACE on `NAMESPACE.ID.in(namespaceIds).and(NAMESPACE.ID.eq(DATA_ENTITY.NAMESPACE_ID).or(NAMESPACE.ID.eq(DATA_SOURCE.NAMESPACE_ID)))` (ReactiveDataQualityRunsRepositoryImpl.java:288-293)."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:288-293"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY — the SQL matches the entity's OWN namespace OR its DATASOURCE's namespace. 'Namespace' implies the entity's namespace; the OR-clause silently widens the match to datasource-inherited namespaces. The dashboard doc does not disclose this widening."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:291-292 (the .or(NAMESPACE.ID.eq(DATA_SOURCE.NAMESPACE_ID)))"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "An operator filtering by namespace X sees MORE entities than expected: every entity whose datasource is in namespace X is included even if the entity itself has no namespace or a different one. Result counts in the rings are wider than 'entities in namespace X'."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:288-293"
        - q: "Is there a column/field that DOES match the name and is NOT used? (available-but-unused)"
          a: "DATA_ENTITY.NAMESPACE_ID alone IS the literal-match column and IS used — the widening is the addition of DATA_SOURCE.NAMESPACE_ID via OR, not a substitution. So the strict-match interpretation is available and partly honoured; the drift is over-inclusion, not mis-binding."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:291 (DATA_ENTITY.NAMESPACE_ID is in the OR)"
      routes_to_finding: "docs_link_semantic.doc_drift_findings[1]"
    - location: "DataQualityFilters.tsx:71, 86 (DatasourceFilter filterKey='deDatasourceIds' | 'datasourceIds')"
      input_kind: form-field
      input_name: "Datasource filter (deDatasourceIds / datasourceIds)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The label `t('Datasource')` promises: narrow the dashboard to entities belonging to the selected data source(s)."
          confidence: STATIC-INFERRED
          evidence: "DatasourceFilter.tsx:29 (name={t('Datasource')})"
        - q: "When supplied, what does the implementation USE it for?"
          a: "Same chain as Namespace; at the SQL layer joins DATA_SOURCE on `DATA_SOURCE.ID.in(datasourceIds).and(DATA_SOURCE.ID.eq(DATA_ENTITY.DATA_SOURCE_ID))` (ReactiveDataQualityRunsRepositoryImpl.java:280-283)."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:280-283"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — `datasourceIds` binds to `DATA_SOURCE.ID` joined on the entity's `DATA_SOURCE_ID`. The name and the column align."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:280-283"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — MATCHES."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:280-283"
        - q: "Is there a column/field that DOES match the name and is NOT used? (available-but-unused)"
          a: "NONE — DATA_SOURCE.ID is the correct and used column."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:282-283"
      routes_to_finding: "(no finding — MATCHES)"
    - location: "DataQualityFilters.tsx:72, 87 (OwnerFilter filterKey='deOwnerIds' | 'ownerIds')"
      input_kind: form-field
      input_name: "Owner filter (deOwnerIds / ownerIds)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The label `t('Owner')` promises: narrow the dashboard to entities owned by the selected owner(s)."
          confidence: STATIC-INFERRED
          evidence: "OwnerFIlter.tsx:29 (name={t('Owner')})"
        - q: "When supplied, what does the implementation USE it for?"
          a: "Same chain; at the SQL layer joins OWNERSHIP on `OWNERSHIP.OWNER_ID.in(ownerIds).and(OWNERSHIP.DATA_ENTITY_ID.eq(DATA_ENTITY.ID))` (ReactiveDataQualityRunsRepositoryImpl.java:303-306; or the combined branch 297-302 when titleIds is also present)."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:296-311"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — `ownerIds` binds to `OWNERSHIP.OWNER_ID` joined on the entity's id. Unlike LSN-020's Activity Feed `userIds`→`OWNER_ID` (where the name said 'user'), here the name IS 'Owner' and the column IS OWNER_ID. CAVEAT: when both Owner and Title are selected they share ONE ownership join with AND (same ownership row must carry both that owner and that title) — see the Title entry's Q4."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:297-306"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A for the name binding (MATCHES). The combined-with-Title AND-semantics is documented under the Title entry."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:297-302"
        - q: "Is there a column/field that DOES match the name and is NOT used? (available-but-unused)"
          a: "NONE — OWNERSHIP.OWNER_ID is correct and used."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:305"
      routes_to_finding: "(no finding — MATCHES)"
    - location: "DataQualityFilters.tsx:73, 88 (TitleFilter filterKey='deTitleIds' | 'titleIds')"
      input_kind: form-field
      input_name: "Title filter (deTitleIds / titleIds)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The bare label `t('Title')` most plausibly reads, to an operator, as 'filter by the dataset's title/name'. 'Title' is a generic word; in a data catalog it strongly suggests the human-readable name of an entity."
          confidence: STATIC-INFERRED
          evidence: "TitleFilter.tsx:29 (name={t('Title')})"
        - q: "When supplied, what does the implementation USE it for?"
          a: "Same chain; at the SQL layer joins OWNERSHIP on `OWNERSHIP.TITLE_ID.in(titleIds)` (ReactiveDataQualityRunsRepositoryImpl.java:301 combined branch, 309 title-only branch). OWNERSHIP.TITLE_ID references the TITLE table — an ownership ROLE (e.g. 'Data Steward'). The 'Title' autocomplete options come from `useGetTitleList` (TitleFilter.tsx:4) which lists ownership titles, confirming the bound concept."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:296-311 + TitleFilter.tsx:4"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY — the label 'Title' implies dataset name; the implementation filters by OWNERSHIP.TITLE_ID (ownership role). This is the LSN-020 class: the named input operates on a different entity than its name promises, with no UI qualifier. (A careful operator who opens the dropdown sees role names — partial mitigation — but the label alone misleads.)"
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:301, 309 + TitleFilter.tsx:29"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "(a) An operator selecting a value in 'Title' expecting to isolate a named dataset instead narrows the rings to entities where SOME owner holds that ownership role — a completely different and far wider slice. (b) When BOTH Owner and Title are selected, the SQL puts them in ONE OWNERSHIP join joined by AND (ReactiveDataQualityRunsRepositoryImpl.java:297-302): the result is entities where THAT owner holds THAT title — not entities matching that owner OR that title, and not even entities where the owner exists and (separately) someone has that title. An operator expecting 'owned by Alice AND tagged with title X' may get an empty dashboard if Alice's ownership row has a different title. (c) Title-only selection narrows to entities that have an ownership row with that title regardless of owner."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:297-311"
        - q: "Is there a column/field that DOES match the name and is NOT used? (available-but-unused)"
          a: "DATA_ENTITY has name columns (e.g. internal/external name) that a literal 'Title'-as-dataset-name filter would target; none is used by this filter. If the intent were to filter by dataset name, the entity name column is the available-but-unused candidate. If the intent is genuinely ownership-role filtering, the fix is a clearer label (e.g. 'Ownership Title' / 'Ownership Role'), not a column change."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:296-311 (no DATA_ENTITY name column referenced for titleIds)"
      routes_to_finding: "bugs_limitations_corner_cases[0] AND docs_link_semantic.doc_drift_findings[0]"
    - location: "DataQualityFilters.tsx:74, 89 (TagFilter filterKey='deTagIds' | 'tagIds')"
      input_kind: form-field
      input_name: "Tag filter (deTagIds / tagIds)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The label `t('Tag')` promises: narrow the dashboard to entities carrying the selected tag(s)."
          confidence: STATIC-INFERRED
          evidence: "TagFilter.tsx:29 (name={t('Tag')})"
        - q: "When supplied, what does the implementation USE it for?"
          a: "Same chain; at the SQL layer joins TAG_TO_DATA_ENTITY on `TAG_TO_DATA_ENTITY.TAG_ID.in(tagIds).and(TAG_TO_DATA_ENTITY.DATA_ENTITY_ID.eq(DATA_ENTITY.ID))` (ReactiveDataQualityRunsRepositoryImpl.java:314-317)."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:314-317"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — `tagIds` binds to `TAG_TO_DATA_ENTITY.TAG_ID`, the tag-to-entity association table. Name and column align."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:314-317"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — MATCHES."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:314-317"
        - q: "Is there a column/field that DOES match the name and is NOT used? (available-but-unused)"
          a: "NONE — TAG_TO_DATA_ENTITY.TAG_ID is correct and used."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:316"
      routes_to_finding: "(no finding — MATCHES)"
  probes_emitted:
    - probe_id: P-110
      question: "Does the 'Title' filter narrow the dashboard by ownership title (OWNERSHIP.TITLE_ID), not by dataset name? Confirm the Category-F drift end-to-end."
      probe_path: "lineage/odd-platform/probes/P-110.yaml"
    - probe_id: P-111
      question: "Does typing into a filter autocomplete fire one list-API request per keystroke (no debounce)?"
      probe_path: "lineage/odd-platform/probes/P-111.yaml"
  stress_summary:
    triggers_total: 12
    questions_total: 43
    answers_static_inferred: 37
    answers_probe_needed: 2
    answers_reference: 4
    drift_flags: 3
```

## security

- **auth_mode_relevance**: `INTERNAL_ONLY` — this is a React component, not an HTTP surface. The `/data-quality` route is registered inside the authenticated app shell (`App.tsx:73`, mounted within the app's `<Route>` tree). Whichever of `LOGIN_FORM | OAUTH2 | LDAP` is active gates access to the whole SPA, not this component specifically. Under `DISABLED` the SPA is anonymous. The backend `getDataQualityTestsRuns` endpoint's own auth posture is REFERENCE — `DataQualityRunsController` sidecar (not yet enriched).
- **ingestion_filter_relevance**: `N/A — not HTTP`. This is a UI component; the ingestion filter (`/ingestion/entities`) is unrelated.
- **authorization_assertions**: [] — N/A. A React component declares no authorization gate. The filter panel does not itself check permissions.
- **owner_scoping**:
  - "N/A at this layer — the panel writes filter ids; whether the dashboard query owner-scopes its result is decided in `ReactiveDataQualityRunsRepositoryImpl`. Note from the traced SQL: `getConditionsForFilters` joins `OWNERSHIP` ONLY when `ownerIds`/`titleIds` are supplied as filters — it is a user-driven filter, NOT a principal-derived security scope. There is no current-user predicate in the dashboard query. The dashboard shows catalog-wide DQ data to any authenticated user (consistent with the read-collaborative posture noted in the `DataQualityController` sidecar). Confirming the absence of a principal scope on the dashboard endpoint is REFERENCE to the `DataQualityRunsController` sidecar." — evidence: `ReactiveDataQualityRunsRepositoryImpl.java:296-312` (OWNERSHIP join is filter-conditional, not always-on)
- **data_exposure**:
  - "The filter panel itself exposes nothing — it reads catalog metadata lists (namespaces, datasources, owners, titles, tags) into autocompletes and writes filter ids. The metadata names ARE shown to any user who can reach `/data-quality`: an operator can enumerate all namespace / datasource / owner / title / tag names via the five autocompletes (each list API returns up to 30 per search prefix). For an operator who should not see, e.g., the full owner roster, the autocomplete is an enumeration surface — but this is the same exposure every catalog list view already has." — evidence: `NamespaceFilter.tsx:4` + `OwnerFIlter.tsx:4` + `hooks/index.ts:13-17` (the list queries)
- **known_security_gaps**:
  - "Filter selections (including which owners/namespaces an operator is investigating) are written verbatim into the URL query string with their names (`DataQualityFilters.tsx:50` JSON-stringifies the full FilterOption[] including `name`). The URL is therefore visible in browser history, server access logs, and any referer header — a low-sensitivity leak of which catalog objects an operator filtered by. Severity: LOW — the data is catalog metadata, not credentials." — evidence: `DataQualityFilters.tsx:48-52` (`JSON.stringify(value)` writes id+name to the query string)

## performance

- **hot_paths**:
  - "On every keystroke in any of the ten filter autocompletes, `setSearchText` updates `searchText`, which is a React-Query key for the corresponding list API — so the search input is on a per-keystroke network path with no debounce. Filling the panel generates a burst of list requests." — evidence: `MultipleFilterItemAutocomplete.tsx:57-66` + `hooks/index.ts:11-17` + `namespace.ts:6-9`
  - "Every selection/deselection in any filter mutates `formFiltersAtom`, which (a) re-derives `filtersAtom`, triggering a new `getDataQualityTestsRuns` request in `DataQualityContent`, and (b) re-runs both URL-sync effects. The dashboard re-queries on every single filter change (no debounce, no Apply gate)." — evidence: `DataQualityStore.ts:27-30, 32-42` + `DataQualityFilters.tsx:46-54` + `DataQualityContent.tsx:23-24`
- **throughput_characteristics**:
  - "Single GET per filter change for the dashboard query; single GET per keystroke for autocomplete list queries. No batching. React Query de-duplicates identical concurrent keys." — evidence: `dataQuality.ts:77-81` + `namespace.ts:6-9`
- **resource_allocation**:
  - "Every `useFilter` instance subscribes to the WHOLE `formFiltersAtom` (`hooks/index.ts:12`), so one filter change re-renders all ten `FilterItem` components. Bounded (10 components) but avoidable — the codebase ships an unused per-key `getFieldFilterAtom` (`DataQualityStore.ts:24-30`)." — evidence: `hooks/index.ts:12` + `DataQualityStore.ts:24-30`
  - "Each autocomplete holds at most 30 options in `useState` (`MultipleFilterItemAutocomplete.tsx:44, 96-101`); memory is trivial." — evidence: `MultipleFilterItemAutocomplete.tsx:44, 91-104` + `hooks/index.ts:13-16`
- **scaling_characteristics**:
  - "The component is stateful only through jotai atoms scoped to a per-mount nested `<Provider>` (`DataQualityProvider.tsx:4-6`) — no cross-mount shared state, no app-global pollution." — evidence: `DataQualityProvider.tsx:4-6`
  - "Autocomplete options are capped at 30 with no pagination — a catalog with thousands of owners/tags is not fully filterable from a single prefix (see bugs_limitations_corner_cases). This is a usability ceiling, not a perf failure." — evidence: `hooks/index.ts:13-16`
- **known_performance_gaps**:
  - "No debounce on the autocomplete search input — one list request per keystroke." — evidence: `MultipleFilterItemAutocomplete.tsx:57-66` + `hooks/index.ts:11-17` — severity: MEDIUM
  - "No debounce / no Apply gate between filter selection and dashboard re-query — the full `getDataQualityTestsRuns` (multi-CTE, multi-join SQL) runs on every single filter change." — evidence: `DataQualityStore.ts:32-42` + `DataQualityContent.tsx:23-24` — severity: MEDIUM
  - "Whole-atom subscription re-renders all ten filter components on any one change; the focused-atom fix (`getFieldFilterAtom`) exists in the same file but is unused." — evidence: `hooks/index.ts:12` + `DataQualityStore.ts:24-30` — severity: LOW
  - "Redundant client-side substring filtering layered on top of server-side `query` search in the autocomplete." — evidence: `MultipleFilterItemAutocomplete.tsx:75-89` + `hooks/index.ts:13-17` — severity: LOW

## upstream_callers

- entry_point: "ui_route:/data-quality"
  caller_node: "ts react-component:DataQuality.tsx"
  multiplicity_per_trigger: 1
  evidence: "DataQuality.tsx:7-18 — `<DataQuality>` mounts `<DataQualityFilters />` once inside `<Layout.Sidebar $position='sticky'>`; the route is registered at App.tsx:73 (`<Route path={dataQualityPath()} element={<DataQuality />} />`)"
  observation_class: ui-call
- entry_point: "ui_route:/data-quality"
  caller_node: "REFERENCE — ts react-component:DataQuality (sibling, not yet enriched; being enriched in parallel batch ZC)"
  multiplicity_per_trigger: 1
  unresolved: true
  evidence: "DataQuality.tsx:1-20 — sibling node; this sidecar records its half (DataQualityFilters), the DataQuality sidecar will record the parent composition"
  observation_class: ui-call

## downstream_side_effects

- side_effect_class: cache-mutate
  description: "Writes the user's filter selections into the jotai `formFiltersAtom` (10 keys) on every select/deselect/clear; this is the in-memory state the sibling `DataQualityContent` reads back via the derived `filtersAtom`"
  evidence: "DataQualityFilters.tsx:22, 41 + hooks/index.ts:24, 31-34 + DataQualityStore.ts:44-66 (clear atoms)"
  cardinality_per_call: "1 atom write per user filter action"
  reachable_from_entry_points:
    - "ui_route:/data-quality"
- side_effect_class: redirect-issue
  description: "Updates the browser URL query string (`replace: true`, so it overwrites the current history entry rather than pushing) on every `formFilters` change — the dashboard view becomes deep-linkable / bookmarkable"
  evidence: "DataQualityFilters.tsx:46-54 — `setSearchParams(newSearchParams, { replace: true })`"
  cardinality_per_call: "1 history-entry replacement per formFilters change"
  reachable_from_entry_points:
    - "ui_route:/data-quality"
- side_effect_class: external-call
  description: "Indirectly drives a `GET /api/dataqualitytest/runs` (operationId getDataQualityTestsRuns) — NOT issued by this component; issued by sibling `DataQualityContent` which reads the `filtersAtom` this panel writes. Recorded here because the panel's atom write is the trigger."
  evidence: "DataQualityContent.tsx:23-24 (`useGetDataQualityDashboard(filterState)`) + dataQuality.ts:74-81 — REFERENCE: the request and its side effects belong to the DataQualityContent sibling sidecar (not yet enriched)"
  cardinality_per_call: "1 dashboard GET per filter change (no debounce)"
  reachable_from_entry_points:
    - "ui_route:/data-quality"
- side_effect_class: external-call
  description: "Each filter autocomplete, while open, issues `GET` to a catalog list API (`/api/namespaces`, `/api/datasources`, `/api/owners`, `/api/titles`, `/api/tags`) via `useGetNamespaceList` etc. — one request per distinct `searchText` value (per keystroke, no debounce)"
  evidence: "NamespaceFilter.tsx:4, 23 + hooks/index.ts:13-17 + namespace.ts:6-9 — the list-API endpoints themselves are REFERENCE (separate controller sidecars)"
  cardinality_per_call: "up to 1 list GET per keystroke per open autocomplete"
  reachable_from_entry_points:
    - "ui_route:/data-quality"

## sources

- understanding ← `DataQualityFilters.tsx:1-93` (full file) + `DataQuality.tsx:7-18` + `DataQualityStore.ts:1-67` + `DataQualityContent.tsx:11, 22-24` + `ReactiveDataQualityRunsRepositoryImpl.java:296-311`
- concepts.entities ← `interfaces.ts:3-19` + `DataQualityStore.ts:5-22, 32-42` + `DataQualityFilters.tsx:70-89`
- concepts.operations ← `DataQualityFilters.tsx:28-91` + `DataQualityStore.ts:44-66`
- concepts.invariants ← `NamespaceFilter.tsx:10-12` + `DataQualityFilters.tsx:33-35, 49-50, 70-89` + `DataQualityStore.ts:34-41` + `TitleFilter.tsx:29` (+ four sibling filter `t(...)` labels)
- concepts.audiences ← WebFetch `https://docs.opendatadiscovery.org/features/data-quality/dashboard` 2026-05-22 status 200
- dependencies_semantic.requires-runtime ← `DataQualityFilters.tsx:1-7` + `DataQualityProvider.tsx:1-6` + `MultipleFilterItemAutocomplete.tsx:9`
- dependencies_semantic.couples-to ← `DataQualityFilters.tsx:9-18` + `hooks/index.ts:1-47` + `DataQualityContent.tsx:5, 11, 23-24`
- tests_coverage_semantic ← `grep -rln 'DataQualityFilters' <odd-platform>/odd-platform-ui/src` (no test file, run 2026-05-22)
- docs_link_semantic.inferred_docs ← WebFetch `https://docs.opendatadiscovery.org/features/data-quality/dashboard` + `https://docs.opendatadiscovery.org/features/data-quality` 2026-05-22 status 200
- docs_link_semantic.doc_drift_findings[0] ← `TitleFilter.tsx:29` + `ReactiveDataQualityRunsRepositoryImpl.java:301, 309` + WebFetch dashboard page 2026-05-22 (verbatim absence)
- docs_link_semantic.doc_drift_findings[1] ← `ReactiveDataQualityRunsRepositoryImpl.java:288-293` + WebFetch dashboard page 2026-05-22
- implicit_adrs[0] ← `DataQualityProvider.tsx:1-6` + `DataQuality.tsx:7-18`
- implicit_adrs[1] ← `NamespaceFilter.tsx:10-23` + `DataQualityFilters.tsx:70-89`
- implicit_adrs[2] ← `DataQualityFilters.tsx:25, 27-54`
- bugs_limitations_corner_cases[0] ← `TitleFilter.tsx:29` + `DataQualityFilters.tsx:73, 88` + `DataQualityStore.ts:32-42` + `DataQualityContent.tsx:23-24` + `ReactiveDataQualityRunsRepositoryImpl.java:296-311`
- bugs_limitations_corner_cases[1] ← `MultipleFilterItemAutocomplete.tsx:57-66` + `hooks/index.ts:11-17` + `namespace.ts:6-9`
- bugs_limitations_corner_cases[2] ← `MultipleFilterItemAutocomplete.tsx:91-104, 162`
- bugs_limitations_corner_cases[3] ← `hooks/index.ts:13-16` + `MultipleFilterItemAutocomplete.tsx:75-89` + `interfaces.ts:11-19`
- bugs_limitations_corner_cases[4] ← `hooks/index.ts:12` + `DataQualityStore.ts:24-30`
- bugs_limitations_corner_cases[5] ← `DataQualityFilters.tsx:31-39`
- bugs_limitations_corner_cases[6] ← `DataQualityFilters.tsx:70-74, 85-89` + `DataQualityStore.ts:5-22`
- stress_findings.request_inputs ← `DataQualityFilters.tsx:70-89` + `NamespaceFilter.tsx:29` + `DatasourceFilter.tsx:29` + `OwnerFIlter.tsx:29` + `TitleFilter.tsx:29` + `TagFilter.tsx:29` + `DataQualityRunsController.java:19-32` + `DataQualityRunsServiceImpl.java:22-43` + `DataQualityTestFiltersMapper.java:9-26` + `ReactiveDataQualityRunsRepositoryImpl.java:271-321`
- stress_findings.tunables ← `hooks/index.ts:13-16` + `MultipleFilterItemAutocomplete.tsx:146-178`
- stress_findings.orderings ← `MultipleFilterItemAutocomplete.tsx:75-104` + `hooks/index.ts:13-17`
- security.owner_scoping ← `ReactiveDataQualityRunsRepositoryImpl.java:296-312`
- security.known_security_gaps ← `DataQualityFilters.tsx:48-52`
- performance.hot_paths ← `MultipleFilterItemAutocomplete.tsx:57-66` + `DataQualityStore.ts:27-42` + `DataQualityFilters.tsx:46-54` + `DataQualityContent.tsx:23-24`
- upstream_callers ← `DataQuality.tsx:7-18` + `App.tsx:39, 73`
- downstream_side_effects ← `DataQualityFilters.tsx:22, 41, 46-54` + `hooks/index.ts:24, 31-34` + `DataQualityStore.ts:44-66` + `DataQualityContent.tsx:23-24` + `namespace.ts:6-9`

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: MEDIUM
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: MEDIUM
- performance: HIGH
- upstream_callers: MEDIUM
- downstream_side_effects: MEDIUM
- stress_findings: MEDIUM

(`docs_link_semantic` is MEDIUM: the live pages were WebFetched and quoted, but the dashboard sub-page does not document the filter-panel internals so confidence in doc COVERAGE is low even though doc EXISTENCE is verified. `security` is MEDIUM: the component is not an HTTP surface so most security questions resolve through the backend `DataQualityRunsController` sidecar, which is not yet enriched. `upstream_callers` / `downstream_side_effects` are MEDIUM because the parent `DataQuality` and reader `DataQualityContent` are unresolved REFERENCE entries — siblings being enriched in parallel. `stress_findings` is MEDIUM: 2 of the load-bearing questions are PROBE-NEEDED and 4 are REFERENCE; the Category-F Title drift itself is STATIC-INFERRED with strong SQL evidence, but the full multi-join scaling and the per-keystroke request count want runtime confirmation.)

## Maintainer notes

(none — fresh node)

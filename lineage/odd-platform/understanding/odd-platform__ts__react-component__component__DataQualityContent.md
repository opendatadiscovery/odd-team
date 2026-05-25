---
node_id: "odd-platform ts react-component component:DataQualityContent"
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
  - "P-04:F-002"  # Quality Dashboard — THIS node is the dashboard body; first sidecar of the feature
related_features:
  - F-022  # per-dataset DQ Test reports + SLA badge — DISTINCT surface; cross-referenced, not duplicated
related_concepts:
  - data-quality-dashboard
  - data-quality-test-category
  - data-quality-run-status
  - tables-health-aggregate
  - monitored-tables-aggregate
---

# DataQualityContent — semantic understanding

## understanding

`DataQualityContent` is the body of the standalone Data Quality Dashboard mounted at the `/data-quality` UI route — the catalog-wide aggregate quality view, distinct from the per-dataset "Test reports" tab (F-022). It reads the sidebar filter selections from a jotai derived atom (`filtersAtom`) and issues a single aggregate fetch via `useGetDataQualityDashboard(filterState)`, then renders three `DonutChart` rings — Table Health, Test Results Breakdown, Monitored Tables — plus one `TestCategoryResults` panel per backend-supplied test category (`DataQualityContent.tsx:22-147`). The single server contract behind the whole component is `GET /api/dataqatests/runs` (operationId `getDataQualityTestsRuns`), served by `DataQualityRunsController` and returning the `DataQualityResults` DTO (`dataQuality.ts:74-82`, `DataQualityRunsController.java:18-33`, `openapi.yaml:1973-2087`). The component holds no state of its own beyond memoised chart-data derivations; it is a pure projection of one DTO into three donuts and an alphabetically-sorted list of category cards.

## concepts

- entities: [
    "DataQualityResults — the single dashboard DTO: `testResults[]` (per-category run-status counts) + `tablesDashboard` (tables-health + monitored-tables aggregates) (`DataQualityContent.tsx:24`, `dataQuality.ts:34-72`, `components.yaml:3748-3760`)",
    "DataQualityCategoryResults — one test category: a free-text `category` string + `results[]` of run-status counts (`TestCategoryResults.tsx:8`, `components.yaml:3802-3813`; the category is `type: string`, NOT an enum)",
    "DataQualityRunStatusCount — a `(DataEntityRunStatus, count)` pair; the unit the breakdown ring and category cards aggregate (`components.yaml:3815-3825`)",
    "TablesHealthDashboard — `{ healthyTables, warningTables, errorTables }` int32 counts (`DataQualityContent.tsx:55`, `components.yaml:3772-3787`)",
    "MonitoredTablesDashboard — `{ monitoredTables, notMonitoredTables }` int32 counts (`DataQualityContent.tsx:67`, `components.yaml:3789-3800`)",
    "DataEntityRunStatus — the run-status enum {SUCCESS, FAILED, SKIPPED, BROKEN, ABORTED, UNKNOWN} driving the legend and the breakdown colours (`DataQualityContent.tsx:3, 83`, `components.yaml:1407-1415`)",
    "filterState — the request object derived from the sidebar (10 `List<Long>` id arrays) (`DataQualityContent.tsx:23`, `DataQualityStore.ts:32-42`)"
  ]
- operations: [
    "read-dashboard-filter-state (`useAtom(filtersAtom)`, `DataQualityContent.tsx:23`)",
    "fetch-aggregate-dashboard (`useGetDataQualityDashboard(filterState)` → `GET /api/dataqatests/runs`, `DataQualityContent.tsx:24`)",
    "aggregate-test-results-breakdown (`calcTestResultsBreakdown` — reduce over `testResults[].results[]` summing count per status, `DataQualityContent.tsx:28-41`)",
    "project-table-health-to-donut (`tableHealthData` — three fixed slices Healthy/Warning/Error, `DataQualityContent.tsx:53-63`)",
    "project-monitored-tables-to-donut (`tableMonitoredTables` — two slices Monitored/Non-Monitored, `DataQualityContent.tsx:65-73`)",
    "sort-categories-alphabetically (`data.testResults.toSorted((a,b) => a.category.localeCompare(b.category))`, `DataQualityContent.tsx:75-77`)",
    "render-category-cards (`testResults.map(... <TestCategoryResults>)`, `DataQualityContent.tsx:115-120`)"
  ]
- invariants: [
    "Empty-data guard — every memoised derivation returns `[]` or an init breakdown when `!data`; `testResults` returns `[]` unless `isSuccess` (`DataQualityContent.tsx:33, 44, 54, 66, 75-77`)",
    "`useGetDataQualityDashboard` supplies `initialData` (all-zero `DataQualityResults` with 6 named categories), so `data` is NEVER undefined after the first render — the `!data` guards are effectively dead while `initialData` is set (`dataQuality.ts:34-81`)",
    "Each `DonutChart` self-handles its own zero-total case — when all slice values sum to 0 it renders one grey 'No data' slice (`DonutChart.tsx:88-98`)",
    "Category ordering is the Unicode collation order of the `category` label string, applied client-side via `toSorted` + `localeCompare` (`DataQualityContent.tsx:76`); the backend `getDataQualityTestsRuns` imposes no ordering on `testResults`",
    "Run-status colour is `palette.runStatus[status].color` with a `?? palette.dataQualityDashboard.unknown` fallback; the fallback is unreachable under the current contract — `palette.runStatus` is a `Record<DataEntityRunStatus, ItemColors>` keyed by all 6 enum values (`DataQualityContent.tsx:47-48`, `interfaces.ts:55`)"
  ]
- audiences: [
    "data-quality-engineer / data-platform-operator — opens `/data-quality` to see the catalog-wide quality posture: how many tables are healthy, how many are monitored, how test runs break down by status, and per-category test counts (per live doc `https://docs.opendatadiscovery.org/features/data-quality/dashboard` 2026-05-22 status 200: 'the catalog-wide quality view')",
    "any-authenticated-user — the `/data-quality` route has no `WithPermissionsProvider` wrapper (`App.tsx:73`); the dashboard is reachable from the main toolbar tab `data-quality` (`ToolbarTabs.tsx:47-48`) by any logged-in user"
  ]

## dependencies_semantic

- requires-feature: [
    "P-04 Data Quality test-results-import pipeline — the dashboard aggregates ALREADY-INGESTED DQ test runs; ODD performs no checks itself (per live doc `https://docs.opendatadiscovery.org/features/data-quality` 2026-05-22 status 200)",
    "the `GET /api/dataqatests/runs` server endpoint — operationId `getDataQualityTestsRuns`, the SINGLE backend contract for the entire component (`openapi.yaml:1973-2087`)",
    "DonutChart shared element — `components/shared/elements` (`DataQualityContent.tsx:6`, `DonutChart.tsx:85-135`)",
    "TestCategoryResults sibling component — renders one category card (`DataQualityContent.tsx:10`, `TestCategoryResults.tsx`)",
    "DataQualityStore jotai atoms — `filtersAtom` (the request shape) is a derived atom over `formFiltersAtom` written by `DataQualityFilters` (`DataQualityContent.tsx:11`, `DataQualityStore.ts:32-42`)",
    "DataQualityAtomProvider — the jotai `Provider` scoping the atoms to the `/data-quality` subtree (`DataQuality.tsx:8`, `DataQualityProvider.tsx:4-6`)"
  ]
- requires-config: [] — N/A. The component reads no `@Value`-equivalent env var, no feature flag, no runtime config; it is a pure data projection.
- requires-runtime: [
    "React 18+ — `useCallback`, `useMemo`, FC (`DataQualityContent.tsx:1`); `toSorted` (line 76) requires ES2023 `Array.prototype.toSorted` — needs a runtime / transpile target that polyfills or natively supports it (Chrome 110+, Node 20+)",
    "jotai — `useAtom(filtersAtom)` for the derived filter state (`DataQualityContent.tsx:2, 23`)",
    "@tanstack/react-query — `useGetDataQualityDashboard` wraps `useQuery` (`dataQuality.ts:1, 77`)",
    "styled-components `useTheme` — supplies `palette.runStatus` and `palette.dataQualityDashboard` colour tokens (`DataQualityContent.tsx:7, 25`)",
    "react-i18next `useTranslation` — every chart label and legend string is `t(...)`-wrapped (`DataQualityContent.tsx:8, 26`)",
    "recharts — the underlying chart engine inside `DonutChart` (`DonutChart.tsx:2`)"
  ]
- couples-to: [
    "`DataQualityRunsApiGetDataQualityTestsRunsRequest` — the generated request type; the SHAPE of `filterState` and of every sidebar filter key is dictated by this generated interface (`DataQualityStore.ts:2-7`, `dataQuality.ts:2`)",
    "`generated-sources` models `DataEntityRunStatus`, `DataQualityResults`, `DataQualityCategoryResults`, `DataQualityRunStatusCount` — all OpenAPI-generated from `components.yaml`",
    "`DataQuality.styles.ts` (`S.*`) — Section / SubSection / DashboardLegend / ChartWrapper layout primitives (`DataQualityContent.tsx:9`)"
  ]

## tests_coverage_semantic

- covered_behaviours: [] — no covered behaviours found for this component.
- uncovered_behaviours:
  - behaviour: "`calcTestResultsBreakdown` correctly sums `count` per `status` across all categories and total"
    test_class: unit
    criticality: MEDIUM
    note: "Pure reduce — trivially unit-testable with a hand-built `DataQualityResults`; currently zero coverage."
  - behaviour: "`tableHealthData` / `tableMonitoredTables` map the DTO sub-objects onto the correct fixed slices and colours"
    test_class: unit
    criticality: LOW
    note: "Static field-to-slice mapping; a regression would silently swap Healthy/Warning/Error colours."
  - behaviour: "category panels render in alphabetical (`localeCompare`) order regardless of API order"
    test_class: integration
    criticality: MEDIUM
    note: "The LSN-019-class ordering claim — see stress_findings.orderings; probe P-100."
  - behaviour: "dashboard fetches exactly once on plain `/data-quality` open and does not over-fetch on no-op filter churn"
    test_class: integration
    criticality: MEDIUM
    note: "Rule 6 multiplicity — probe P-101."
  - behaviour: "the component renders without crashing when the API returns a `status` value outside the `DataEntityRunStatus` enum"
    test_class: integration
    criticality: HIGH
    note: "`palette.runStatus[status].color` at line 48 throws TypeError if `status` is not a `runStatus` key — see stress_findings.tunables / bugs_limitations_corner_cases."
  - behaviour: "zero-data dashboard (no ingested DQ tests) renders three 'No data' donuts and no category panels — not a blank page or error"
    test_class: integration
    criticality: MEDIUM
    note: "Live doc is silent on the empty state (`dashboard` page 2026-05-22)."
- test_files: [] — no `DataQualityContent.test.tsx`, no `DataQuality*.test.tsx`, and no `__tests__` directory under `components/DataQuality/` (Glob `**/components/DataQuality/**` 2026-05-22 returned only source files, zero test files).
- gaps: |
    The entire `components/DataQuality/` subtree has zero test files. The highest-leverage
    gap is the **integration** class: the component is a thin projection, so unit-testing
    the reduce/map helpers catches little, but the cross-layer behaviours (fetch
    multiplicity, alphabetical category ordering, the line-48 status-colour crash on an
    out-of-enum status, the empty-state render) have no coverage and would each ship a
    user-visible regression with the build green. The line-48 crash is the worst: a
    backend that adds a 7th `DataEntityRunStatus` value (or returns a malformed status)
    takes the whole dashboard down with a TypeError, and nothing in the test suite or
    the type system would flag it before runtime.

## docs_link_semantic

- declared_docs: [] — N/A. `DataQualityContent.tsx` carries no `// @docs:` annotation; this matches the repo-wide UI-component convention (no React component declares `@docs`).
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-quality/dashboard"
    anchor: ""
    rationale: "The dedicated Quality Dashboard sub-page — describes the `/data-quality` aggregate view, the three rings, the two-set filter sidebar, and the test categories that this component renders"
    last_verified_at: "2026-05-22T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      Table Health ring (verbatim): "Table Health — the count of tables broken down by
      their aggregate health status (success / failed / broken)."

      Monitored Tables ring (verbatim): "Monitored Tables — the count of tables broken
      down by whether they are monitored (have at least one DQ test) or unmonitored."
      Plus a clarifying note: this "applies specifically to table-type datasets only."

      Test Results Breakdown ring (verbatim): "Test Results Breakdown — the count of
      test runs broken down by status (passed / failed / skipped)."

      Filter sidebar (verbatim): two filter sets, "Tables-side filters: narrow the Table
      Health and Monitored Tables rings" and "Tests-side filters: narrow the Test
      Results Breakdown ring"; both filter by Namespace, Datasource, Owner, Title, Tag;
      "The two filter sets are independent — you can hold the tables-side filter at one
      slice and the tests-side at another."

      Test categories listed, in this order: Assertion Tests, Column Values Anomalies,
      Freshness Anomalies, Schema Changes, Unknown Category, Volume Anomalies.

      Zero-data state: the page is SILENT — no content describes dashboard behaviour
      when no DQ data exists.
  - url: "https://docs.opendatadiscovery.org/features/data-quality"
    anchor: ""
    rationale: "The P-04 pillar landing page — names the dashboard at `/data-quality` and its three rings; the parent of the dashboard sub-page"
    last_verified_at: "2026-05-22T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      Dashboard mention (verbatim): "the catalog-wide quality view at `/data-quality` —
      three breakdown rings (Table Health / Test Results / Monitored Tables), six
      anomaly-class metrics".

      Filter mention (verbatim): "per-side filter sets (tables vs tests)" — no further
      elaboration on the landing page.

      Subsections named: "Test Results Import", "Quality Dashboard", "Dataset Quality
      Statuses (SLA)".
- doc_drift_findings:
  - "**DOC DRIFT — Table Health ring labels disagree between doc and code.** The live `dashboard` page (2026-05-22 status 200) describes Table Health as 'success / failed / broken'. The component renders the slices labelled **`Healthy` / `Warning` / `Error`** from `tablesDashboard.tablesHealth.{healthyTables, warningTables, errorTables}` (`DataQualityContent.tsx:55-62`, `components.yaml:3772-3787`). The DTO field set has no `failed` or `broken` — it has `warning` and `error`. An operator reading the docs looking for a 'broken tables' count will not find that label on the screen. Severity: MEDIUM — the concepts roughly correspond but the doc's vocabulary is not the product's vocabulary."
  - "**DOC DRIFT — Test Results Breakdown ring is described as 3 statuses, code renders up to 6.** The live `dashboard` page describes the breakdown ring as 'passed / failed / skipped' (3 statuses). The component builds the breakdown slices dynamically from `DataEntityRunStatus`, which has SIX values — SUCCESS, FAILED, SKIPPED, BROKEN, ABORTED, UNKNOWN (`DataQualityContent.tsx:43-51, 83`, `components.yaml:1407-1415`) — and the legend (`DataQualityContent.tsx:83-89`) renders all six. An operator who sees a `BROKEN` or `ABORTED` slice has no doc explaining it. Severity: MEDIUM."
  - "**DOC DRIFT — category ordering is undocumented as alphabetical and the doc list omits one category the code knows.** The component sorts categories by `localeCompare` (`DataQualityContent.tsx:76`); the live `dashboard` page lists six categories in alphabetical order but never STATES the order is alphabetical (vs severity / failure-count). Separately, the hook's hardcoded `initialData` knows the six categories Assertion Tests / Freshness Anomalies / Schema Changes / Volume Anomalies / Column Values Anomalies / Unknown category (`dataQuality.ts:34-60`) — but the live category set is whatever the backend returns, not this list. If the backend yields a category outside these six, the dashboard renders it and the docs do not mention it. Severity: LOW."
  - "**DOC DRIFT — the empty-state is undocumented.** The live `dashboard` page says nothing about what the dashboard shows when no DQ tests are ingested. The code path: `DonutChart` renders a single grey 'No data' slice per ring (`DonutChart.tsx:94-95`) and zero category panels render (`testResults` is `[]`). An operator on a fresh install opening `/data-quality` sees three grey donuts and an otherwise empty page with no explanatory copy. Severity: LOW — the silence is a doc-gap; the code's behaviour is benign."

## implicit_adrs

- "**The dashboard is a single-fetch projection — one `GET /api/dataqatests/runs` call serves all three rings and every category card.** Rather than one endpoint per ring or per-category lazy loading, the component issues exactly one aggregate fetch and derives all five visual blocks from the one `DataQualityResults` DTO (`DataQualityContent.tsx:24` → `dataQuality.ts:74-82`; the backend `DataQualityRunsServiceImpl.getDataQualityTestsRuns` itself fans out to three repository queries and zips them into one DTO, `DataQualityRunsServiceImpl.java:36-43`). The intent — visible in the DTO shape — is that the dashboard is a single atomic snapshot: all rings reflect the same filter application at the same instant, no partial-load skew." — evidence: `DataQualityContent.tsx:24, 43-77` (one `data` source, five derivations) + `dataQuality.ts:74-82` (single `useQuery`) + `DataQualityRunsServiceImpl.java:36-42` (server-side zip into one DTO) — intent_anchor: "`.testResults(testsMapper.mapToDto(item.getT1())).tablesDashboard(tablesDashboardMapper.mapToDto(item.getT2().getT1(), item.getT2().getT2()))`" (`DataQualityRunsServiceImpl.java:40-42` — three query results composed into one response object) — confidence: HIGH"
- "**The dashboard is a read-only, owner-unscoped catalog-wide view — no per-component permission gate.** The `/data-quality` route is mounted bare (`App.tsx:73` — `<Route path={dataQualityPath()} element={<DataQuality />} />`, with NO `WithPermissionsProvider` wrapper, unlike `lookupTablesPath` at `App.tsx:75-84`), and the component issues only a GET. The intent — consistent with ODD's read-collaborative catalog posture (ADR-CANDIDATE-003) — is that catalog-wide quality posture is visible to every authenticated user; the dashboard exposes no mutation and no owner-scoped data. The component contributes the UI half of that posture; the backend half (whether the SQL filters by the caller's owners) is the DataQualityRunsController/repository's to enforce." — evidence: `App.tsx:73` (bare route mount, no permission wrapper) + `DataQualityContent.tsx:22-147` (no `Permission` import, no `WithPermissionsProvider`, only a GET via the hook) — intent_anchor: "`<Route path={dataQualityPath()} element={<DataQuality />} />`" (`App.tsx:73` — the absence of the `WithPermissionsProvider` wrapper that `App.tsx:75-84` applies to the adjacent gated route is the deliberate contrast) — confidence: MEDIUM"
- "**Category labels are treated as opaque backend strings, sorted client-side — the UI carries no category taxonomy.** The component never enumerates categories; it renders whatever `data.testResults` contains, keyed and sorted by the raw `category` string (`DataQualityContent.tsx:76, 117`). The OpenAPI `DataQualityCategoryResults.category` is `type: string`, not an enum (`components.yaml:3805-3806`). The intent is that the category set is owned entirely by the backend's category mapper — the UI is a generic renderer that adapts to new categories without a frontend change. The hook's `initialData` six-category list (`dataQuality.ts:34-60`) is only a loading-state placeholder, not a contract." — evidence: `DataQualityContent.tsx:75-77, 115-120` (renders + sorts raw strings; no category enum referenced) + `components.yaml:3805-3806` (`category` is `type: string`) + `dataQuality.ts:34-60` (`initialData` categories used only as `initialData`) — intent_anchor: "`category: 'Assertion Tests'`" inside the `initialData` literal (`dataQuality.ts:37` — categories are data, supplied as a placeholder, not a typed enum the UI branches on) — confidence: MEDIUM"

## bugs_limitations_corner_cases

- "**`palette.runStatus[status].color` (line 48) throws an uncaught TypeError and blanks the whole dashboard if the backend returns a run-status outside the `DataEntityRunStatus` enum.** `testResultsBreakdownChartData` does `palette.runStatus[status].color ?? palette.dataQualityDashboard.unknown` (`DataQualityContent.tsx:47-48`). `palette.runStatus` is a `Record<DataEntityRunStatus, ItemColors>` (`interfaces.ts:55`) — keyed by exactly the 6 enum values. If `status` is any other string (a new backend enum value not yet in the generated frontend types, a stale generated-sources build, or malformed data), `palette.runStatus[status]` is `undefined` and `.color` throws BEFORE the `??` is evaluated — the `??` guards a missing `.color` on a PRESENT entry, not a missing entry. The error propagates out of the `useMemo` and crashes the component tree. The same risk does NOT apply to `tableHealthData`/`tableMonitoredTables` (lines 53-73) — those read fixed `palette.dataQualityDashboard` keys, not status-indexed lookups." — evidence: `DataQualityContent.tsx:47-48` (the unsafe indexed access) + `interfaces.ts:55` (`RunStatus = Record<DataEntityRunStatus, ItemColors>`) + `components.yaml:1407-1415` (the 6-value enum) — severity: HIGH
- "**Category panel ordering is alphabetical by label, not by severity or failure count — the worst-failing category is not surfaced first.** `DataQualityContent.tsx:76` sorts `testResults` by `category.localeCompare`. An operator opening `/data-quality` to find 'which category of tests is failing worst' must scan all panels; the panel order conveys nothing about quality. With the six current categories the order is fixed (Assertion Tests, Column Values Anomalies, Freshness Anomalies, Schema Changes, Unknown category, Volume Anomalies). The live `dashboard` doc lists categories in this same alphabetical order but does not state the ordering is alphabetical, so a reader cannot tell the order is not meaningful. See stress_findings.orderings; probe P-100." — evidence: `DataQualityContent.tsx:75-77` (the `toSorted(localeCompare)`) + `DataQualityRunsServiceImpl.java:36-42` (backend imposes no ordering) — severity: MEDIUM
- "**`localeCompare` with no explicit locale is runtime-locale-dependent — category order can differ per user if a non-ASCII category label is ever introduced.** `DataQualityContent.tsx:76` calls `a.localeCompare(b)` with no locale argument; the runtime default locale (the browser's `navigator.language`) drives the collation. The six current category labels are ASCII-only, so all locales agree today — but a future accented or non-Latin category name would sort differently for, e.g., an `en-US` user vs a `tr-TR` user, and the doc's stated order would be wrong for some users. See stress_findings.orderings; probe P-100." — evidence: `DataQualityContent.tsx:76` (`localeCompare` with no locale arg) — severity: LOW
- "**The `if (!data) return ...` guards in every memo are dead code while the hook sets `initialData`.** `useGetDataQualityDashboard` always passes `initialData` (`dataQuality.ts:80`), so react-query's `data` is never `undefined` — it is the all-zero placeholder until the fetch resolves. The five `if (!data)` early-returns (`DataQualityContent.tsx:33, 44, 54, 66`) and the `isSuccess ? ... : []` at line 75 therefore never take their false branch in normal operation. This is benign (the placeholder renders three 'No data' donuts via `DonutChart`'s own zero-total path), but it is misleading defensive code — a maintainer reading it would believe a loading state is handled here when it is the hook's `initialData` doing the work. If `initialData` is ever removed from the hook, these guards become live and the behaviour silently changes." — evidence: `dataQuality.ts:74-81` (`initialData` always supplied) + `DataQualityContent.tsx:33, 44, 54, 66, 75` (the guards) — severity: LOW
- "**`capitalizeFirstLetter` (line 13-15) throws on an empty string.** `[...str][0].toUpperCase()` indexes `[0]` of the spread array; for `str === ''` that is `undefined` and `.toUpperCase()` throws. It is called on `status.toLowerCase()` at `DataQualityContent.tsx:86` where `status` is a `DataEntityRunStatus` enum value, so it is never empty in practice — but the helper is unguarded and would crash if reused on user-supplied or empty input." — evidence: `DataQualityContent.tsx:13-15` (the unguarded helper) + `DataQualityContent.tsx:86` (the only call site) — severity: LOW
- "**No error UI — a failed dashboard fetch shows the all-zero `initialData` placeholder, indistinguishable from a genuinely empty catalog.** The component destructures only `{ data, isSuccess }` from `useGetDataQualityDashboard` (`DataQualityContent.tsx:24`) — never `isError` / `error`. On a 4xx/5xx from `GET /api/dataqatests/runs`, react-query keeps `data` at `initialData` (all zeros), `isSuccess` stays false, `testResults` is `[]`, and the operator sees three grey 'No data' donuts with no error message. A real backend failure is presented as 'your catalog has no data quality tests'. See stress_findings.resource_boundaries." — evidence: `DataQualityContent.tsx:24` (only `data, isSuccess` destructured; no `isError`) + `dataQuality.ts:77-81` (`useQuery` with `initialData`, no error surface) — severity: MEDIUM
- "**No coverage and no observability — the entire `components/DataQuality/` subtree has zero test files.** Glob `**/components/DataQuality/**` (2026-05-22) returned 21 source files and zero test files. A regression in the category ordering, the status-colour crash, the fetch multiplicity, or the empty-state render would ship with the build green." — evidence: Glob `**/components/DataQuality/**` over `<odd-platform-repo>/odd-platform-ui` 2026-05-22 — severity: MEDIUM

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "DataQualityContent.tsx:17-20"
      name: "DONUT_CHART_WIDTH / DONUT_CHART_HEIGHT / DONUT_CHART_INNER_RADIUS / DONUT_CHART_OUTER_RADIUS"
      value: "300 / 300 / 66 / 90"
      questions:
        - q: "What at N > tunable? (e.g. a chart with more slices than the geometry comfortably shows)"
          a: "These four constants are fixed pixel dimensions passed straight to `DonutChart` (and onward to recharts `PieChart`/`Pie`, DonutChart.tsx:107-120). They do not gate row counts or truncate data — the donut renders all slices of `data` regardless of slice count; many slices just produce thin arcs. There is no N-vs-tunable boundary: the constants size the SVG, not the dataset. The Test Results Breakdown ring can have up to 6 slices (one per DataEntityRunStatus); 6 slices in a 300x300 donut is geometrically fine."
          confidence: STATIC-INFERRED
          evidence: "DataQualityContent.tsx:17-20, 93-101 + DonutChart.tsx:107-129"
        - q: "What at tunable x 100? / negative / non-numeric?"
          a: "Not reachable — the constants are module-level literals, never derived from input or config; an operator cannot set them. A negative radius would be a code edit, not a runtime case."
          confidence: STATIC-INFERRED
          evidence: "DataQualityContent.tsx:17-20 (const literals, no @Value/env source)"
        - q: "What does the operator see at each boundary?"
          a: "No operator-visible boundary tied to these constants. The genuine boundary case for this component is not a tunable but the run-status-color lookup at line 48: `palette.runStatus[status].color ?? palette.dataQualityDashboard.unknown`. The `?? unknown` fallback is DEAD under the current contract — `palette.runStatus` is keyed by all 6 DataEntityRunStatus values (interfaces.ts:55), so `.color` is always present. But if the backend returns a status OUTSIDE the enum, `palette.runStatus[status]` is `undefined` and `.color` throws TypeError before `??` evaluates — the whole dashboard blanks. The `?? unknown` is mis-written defensive code (it guards a missing `.color`, not a missing entry)."
          confidence: STATIC-INFERRED
          evidence: "DataQualityContent.tsx:47-48 + interfaces.ts:55 + components.yaml:1407-1415"
  name_behavior_pairs:
    - name: "useGetDataQualityDashboard"
      promise: "Fetch the data-quality dashboard aggregate."
      implementation: "Wraps `useQuery` with queryKey ['dataQualityDashboard', params], queryFn calling `dataQualityRunsApi.getDataQualityTestsRuns(params)` → HTTP `GET /api/dataqatests/runs` (dataQuality.ts:74-82, openapi.yaml:1973-1977). The endpoint path's noun is `dataqatests/runs` — the response IS the dashboard DTO (DataQualityResults). The hook name says 'Dashboard', the endpoint says 'TestsRuns'; they describe the same payload from two angles (the endpoint emphasises the source data, the hook emphasises the consuming surface). No drift — the hook honestly returns the dashboard aggregate."
      drift: NONE
      operator_visible_consequence: "n/a"
      confidence: STATIC-INFERRED
      evidence: "dataQuality.ts:74-82 + DataQualityRunsController.java:18-33 + openapi.yaml:1973-1977"
    - name: "calcTestResultsBreakdown"
      promise: "Compute the test-results breakdown (counts per run status, plus a total)."
      implementation: "Reduces `data.testResults` (all categories), and for each category reduces `results[]`, summing `count` into a `Map<DataEntityRunStatus, number>` and into `total` (DataQualityContent.tsx:28-41). It does exactly what the name says — a cross-category sum of run-status counts. Note `total` is mutated in place inside the inner `forEach` while the same object is returned from the outer reduce; the result is correct but the mutation-inside-reduce style is fragile."
      drift: NONE
      operator_visible_consequence: "n/a"
      confidence: STATIC-INFERRED
      evidence: "DataQualityContent.tsx:28-41"
  orderings:
    - location: "DataQualityContent.tsx:75-77"
      questions:
        - q: "What is the actual ordering at the lowest layer?"
          a: "The lowest layer is the backend: `DataQualityRunsServiceImpl.getDataQualityTestsRuns` zips three repository query results into `DataQualityResults` and imposes NO ORDER BY on `testResults` — the order is whatever `DataQualityCategoryMapper.mapToDto` + the underlying SQL yields (DataQualityRunsServiceImpl.java:36-42; the SQL is in ReactiveDataQualityRunsRepository, beyond this sidecar's 1-hop budget — REFERENCE: the DataQualityRunsRepository node). The UI then OVERRIDES whatever the backend returned with `data.testResults.toSorted((a,b) => a.category.localeCompare(b.category))` — so the operator-visible order is the client-side Unicode collation of the `category` label string, NOT the backend order."
          confidence: STATIC-INFERRED
          evidence: "DataQualityContent.tsx:76 + DataQualityRunsServiceImpl.java:36-42"
        - q: "What is the tie-breaker when sort-key values are equal?"
          a: "`category` strings are expected to be distinct (one entry per category from the backend mapper). If two entries shared a category string, `toSorted` is stable in modern V8 (Array.prototype.toSorted preserves the relative order of equal elements) — so duplicates would render in backend order. Not a practical case under the current contract."
          confidence: STATIC-INFERRED
          evidence: "DataQualityContent.tsx:76 (toSorted is documented-stable) + components.yaml:3802-3813 (category is the natural key)"
        - q: "Which subset is returned when result-set > page size?"
          a: "N/A — the dashboard endpoint is not paginated (openapi.yaml:1973-2087 declares no page/size params); `testResults` is the full category set and all of it renders."
          confidence: STATIC-INFERRED
          evidence: "openapi.yaml:1973-2087 (no pagination params) + DataQualityContent.tsx:115-120 (renders all)"
        - q: "Does any upstream layer re-sort or filter the result?"
          a: "Within the breakdown ring (`calcTestResultsBreakdown` + `testResultsBreakdownChartData`) the per-status slices are produced by `Array.from(Map)` iteration — Map preserves INSERTION order, which is first-encounter order while reducing `testResults[].results[]` (DataQualityContent.tsx:46) — so the breakdown ring's slice order is data-dependent, not sorted. Separately, the sibling TestCategoryResults re-orders each card's status rows by the fixed `DataEntityRunStatus` enum order (TestCategoryResults.tsx:19-25) — so within a card the statuses are enum-ordered, but the breakdown DONUT's slices are insertion-ordered. Two different orderings of the same status set coexist on one screen. ALPHABETICAL ordering optimises 'find a category by name', not 'find the worst category' — a UX trade-off recorded as a caveat, not a code bug. Probe P-100 pins the alphabetical claim and the locale-sensitivity question."
          confidence: PROBE-NEEDED
          evidence: "P-100"
  auth_gates: []   # this is a UI component, not an HTTP endpoint — it declares no @PreAuthorize-equivalent. The route-mount auth observation (the /data-quality route has no WithPermissionsProvider wrapper) is recorded in implicit_adrs[1] and security.authorization_assertions; the backend gate on GET /api/dataqatests/runs belongs to the DataQualityRunsController node (REFERENCE — not yet enriched).
  resource_boundaries:
    - location: "DataQualityContent.tsx:24"
      kind: cache
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "No shared mutable state in this component. The fetch is via react-query `useQuery`; concurrent renders with the same queryKey are deduped by react-query into one in-flight request. The jotai `filtersAtom` is read-only here (`useAtom` destructured to `[filterState]` only — DataQualityContent.tsx:23). No corruption surface."
          confidence: STATIC-INFERRED
          evidence: "DataQualityContent.tsx:23-24 + dataQuality.ts:77-82"
        - q: "Is the call replay-safe?"
          a: "Yes — `GET /api/dataqatests/runs` is a read; repeated identical requests return the same DTO (modulo newly-ingested test runs). No side effects, idempotent."
          confidence: STATIC-INFERRED
          evidence: "DataQualityRunsController.java:18-33 (GET, delegates to a read service)"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "react-query fronts this with queryKey ['dataQualityDashboard', params]. The hook (dataQuality.ts:77-81) sets `initialData` but no explicit `staleTime` / `gcTime` / `refetchOnWindowFocus` — so react-query's defaults apply (staleTime 0 → data is stale immediately; a refetch fires on remount / window-focus / reconnect). Stale window: between a DQ-test ingestion and the next refetch trigger the dashboard shows the prior snapshot. The `initialData` (all zeros) is shown until the first fetch resolves AND is also what is shown if the fetch FAILS (no `isError` handling — see bugs_limitations_corner_cases), meaning a failed fetch is indistinguishable from an empty catalog. Probe P-101 measures the fetch multiplicity per page-open and per filter change."
          confidence: PROBE-NEEDED
          evidence: "P-101"
  request_inputs:
    - location: "DataQualityContent.tsx:23-24"
      input_kind: local-variable
      input_name: "filterState"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "`filterState` promises 'the current set of dashboard filters the operator has selected'. It is the jotai derived atom `filtersAtom` (DataQualityStore.ts:32-42), shaped as `DataQualityRunsApiGetDataQualityTestsRunsRequest` — i.e. it carries up to 10 arrays of numeric ids. The name is honest at this level: it IS the filter state."
          confidence: STATIC-INFERRED
          evidence: "DataQualityContent.tsx:23 + DataQualityStore.ts:2-7, 32-42"
        - q: "When supplied, what does the implementation actually USE the input for?"
          a: "filterState is passed verbatim into `useGetDataQualityDashboard(filterState)` (DataQualityContent.tsx:24) → `dataQualityRunsApi.getDataQualityTestsRuns(params)` (dataQuality.ts:79) → HTTP query params on `GET /api/dataqatests/runs` → `DataQualityRunsController.getDataQualityTestsRuns(namespaceIds, datasourceIds, ownerIds, titleIds, tagIds, deNamespaceIds, deDatasourceIds, deOwnerIds, deTitleIds, deTagIds)` (DataQualityRunsController.java:19-29) → `DataQualityRunsServiceImpl` (line 23-32) → `DataQualityTestFiltersMapper.mapToDto` which is a pure 1:1 pass-through, no renaming (DataQualityTestFiltersMapper.java:9-26) → `DataQualityTestFiltersDto` record (DataQualityTestFiltersDto.java:7-16) → three repository queries `getLatestDataQualityRunsResults` / `getLatestTablesHealth` / `getMonitoredTables` (DataQualityRunsServiceImpl.java:36-39). The SQL WHERE-predicate binding of each id array is inside ReactiveDataQualityRunsRepository — BEYOND this sidecar's 1-hop budget."
          confidence: STATIC-INFERRED
          evidence: "DataQualityContent.tsx:24 + dataQuality.ts:74-82 + DataQualityRunsController.java:19-32 + DataQualityTestFiltersMapper.java:9-26"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "UNRESOLVED for the individual filter fields. `filterState` as a whole matches its name (it is the filter request). But the 10 component fields fork into two named families whose names carry promises this sidecar cannot fully verify: the non-prefixed five (`namespaceIds`/`datasourceIds`/`ownerIds`/`titleIds`/`tagIds`) and the `de`-prefixed five (`deNamespaceIds`/.../`deTagIds`). The UI labels them: `DataQualityFilters.tsx:70-74` binds the `de`-prefixed five under the section header `t('Filters for tables')` (line 63), and `DataQualityFilters.tsx:85-89` binds the non-prefixed five under `t('Filters for tests')` (line 78). So the OPERATOR-VISIBLE promise is: `de*` = filters for the TABLE-side rings (Table Health, Monitored Tables), non-prefixed = filters for the TEST-side ring (Test Results Breakdown) — consistent with the live doc's 'tables-side vs tests-side filters'. Whether the backend SQL actually binds `deNamespaceIds` to a data-entity namespace and `namespaceIds` to a test namespace (and not the reverse, or not to some adjacent column) cannot be confirmed from this node — the bind site is in ReactiveDataQualityRunsRepository."
          drift: NONE
          confidence: REFERENCE
          evidence: "odd-platform java ... ReactiveDataQualityRunsRepository (backend repository node — not yet enriched; owns the SQL WHERE predicates)"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "Not yet classifiable as TRANSLATES_SILENTLY from this node — the trace exits scope at the repository SQL. The risk to flag for the downstream repository sidecar: the `de` prefix is undocumented to an operator reading the OpenAPI spec alone — `openapi.yaml:1973-2078` declares all 10 parameters as bare `namespaceIds` / `deNamespaceIds` arrays with NO `description` field on any of them. An API consumer hitting `GET /api/dataqatests/runs` directly (not via the UI) has no way to know `de` means 'data entity / table-side' vs the non-prefixed 'test-side'. The UI disambiguates via the two section headers; the API surface does not. This is a Category-F doc-gap routed to docs_link_semantic and to the repository sidecar."
          confidence: REFERENCE
          evidence: "openapi.yaml:1973-2078 (10 params, zero descriptions) + DataQualityFilters.tsx:63, 70-74, 78, 85-89 (the UI labels that supply the only disambiguation)"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "Not determinable from this node — would require reading the DQ run SQL schema. REFERENCE the ReactiveDataQualityRunsRepository sidecar."
          confidence: REFERENCE
          evidence: "odd-platform java ... ReactiveDataQualityRunsRepository (backend repository node — not yet enriched)"
      routes_to_finding: "docs_link_semantic.doc_drift_findings (the `de`-prefix params undocumented on the OpenAPI surface) — full drift classification deferred to the ReactiveDataQualityRunsRepository sidecar"
  probes_emitted:
    - probe_id: P-100
      question: "Is the category-panel ordering alphabetical (toSorted/localeCompare), and is localeCompare locale-stable for the current category labels?"
      probe_path: "lineage/odd-platform/probes/P-100.yaml"
    - probe_id: P-101
      question: "How many times does GET /api/dataqatests/runs fire per /data-quality open and per filter change? (LSN-017 multiplicity)"
      probe_path: "lineage/odd-platform/probes/P-101.yaml"
  stress_summary:
    triggers_total: 6
    questions_total: 19
    answers_static_inferred: 13
    answers_probe_needed: 2
    answers_reference: 4
    drift_flags: 0
```

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` — the dashboard's backing endpoint `GET /api/dataqatests/runs` is on the `/api/*` surface protected by those three modes; under `DISABLED` the dashboard (and its fetch) is anonymously reachable. The component itself is `INTERNAL_ONLY` in the sense that it does no auth logic — it is a React view; the auth gate is global Spring Security on the endpoint, not in this file.
- **ingestion_filter_relevance**: `NO — UI component, not /ingestion/entities`. The dashboard fetch hits `/api/dataqatests/runs`, an API-surface read; the S2S `IngestionDataEntitiesFilter` does not match.
- **authorization_assertions**:
  - "[] — the component declares no permission gate; the `/data-quality` route is mounted WITHOUT a `WithPermissionsProvider` wrapper (`App.tsx:73`, contrast `App.tsx:75-84` for `lookupTablesPath`). Any authenticated user reaching the `data-quality` toolbar tab (`ToolbarTabs.tsx:47-48`) renders this component." — evidence: `App.tsx:73` + `ToolbarTabs.tsx:47-48` + `DataQualityContent.tsx:22-147` (no `Permission` import)
- **owner_scoping**: `N/A — the component is not data-scoped at the UI layer`. Whether the dashboard's `GET /api/dataqatests/runs` data is owner-filtered is determined by the backend `DataQualityRunsController` / `ReactiveDataQualityRunsRepository` SQL — not enrichable from this node. REFERENCE: the `DataQualityRunsController` node (not yet enriched). If that endpoint is owner-unscoped (consistent with the `DataQualityController` read-collaborative posture, see `odd-platform__java__DataQualityController__controller-class__DataQualityController.md`), the dashboard shows catalog-wide quality posture to every authenticated user.
- **data_exposure**:
  - "Catalog-wide DQ aggregate (per-category run-status counts + tables-health counts + monitored-tables counts) → any authenticated user under LOGIN_FORM/OAUTH2/LDAP via the `/data-quality` page" — evidence: `App.tsx:73` (bare route) + `DataQualityContent.tsx:24` (the fetch) + `components.yaml:3748-3825` (the DTO shape)
  - "Same aggregate → anonymous callers under `auth.type=DISABLED`" — evidence: `App.tsx:73` (no permission wrapper) + global DISABLED-mode auth bypass (per cross-sidecar `DisabledAuthSecurityConfiguration` reference)
- **known_security_gaps**:
  - "The `/data-quality` route has no `WithPermissionsProvider` and the component issues a bare GET — there is no UI-side permission gate. This is consistent with ODD's read-collaborative catalog posture (ADR-CANDIDATE-003) IF the backend endpoint is intentionally owner-unscoped; the actionable item is to confirm the backend `GET /api/dataqatests/runs` scoping (REFERENCE the DataQualityRunsController node) and to disclose the read-collaborative posture in the live `dashboard` doc page, which is currently silent on access control." — evidence: `App.tsx:73` + `DataQualityContent.tsx:22-147` + WebFetch `dashboard` page 2026-05-22 (silent on access control) — severity: MEDIUM

## performance

- **hot_paths**:
  - "The component issues exactly one `GET /api/dataqatests/runs` per `/data-quality` mount (and a refetch on filter change / window-focus per react-query defaults). The backend resolves it as THREE repository queries zipped server-side (`DataQualityRunsServiceImpl.java:36-39`). The per-render cost on the client is three `useMemo` reductions over `testResults` — cheap, bounded by the number of categories (~6) times statuses (~6)." — evidence: `DataQualityContent.tsx:24, 28-77` + `DataQualityRunsServiceImpl.java:36-42`
- **throughput_characteristics**:
  - "Single aggregate fetch — no per-ring or per-category lazy loading; all three rings + all category cards come from one DTO" — evidence: `DataQualityContent.tsx:24` + `dataQuality.ts:74-82`
  - "react-query dedupes concurrent identical-key requests; a filter change creates a new queryKey and triggers one refetch (probe P-101 confirms multiplicity)" — evidence: `dataQuality.ts:77-78`
- **resource_allocation**:
  - "Client memory is bounded by the `DataQualityResults` DTO size — per-category arrays of at most ~6 status counts; trivial. `calcTestResultsBreakdown` builds one `Map`; `Array.from(Map)` materialises a small array. No large allocation." — evidence: `DataQualityContent.tsx:28-51`
  - "`DonutChart` re-renders are recharts SVG renders — three donuts per dashboard; recharts cost is bounded by slice count (<=6)" — evidence: `DataQualityContent.tsx:93-142` + `DonutChart.tsx:107-129`
- **scaling_characteristics**:
  - "Stateless presentational component — scales with the browser; no client-side state beyond memoised derivations and the jotai filter atom" — evidence: `DataQualityContent.tsx:22-147`
  - "No pagination — `testResults` is the full category set; the category count is small and backend-bounded, so this is not a scaling concern at the UI layer" — evidence: `DataQualityContent.tsx:115-120` + `openapi.yaml:1973-2087` (no page/size params)
- **known_performance_gaps**:
  - "No `staleTime` / `gcTime` configured on `useGetDataQualityDashboard` — react-query default `staleTime: 0` means the dashboard refetches on every remount and window-focus. For an operator who tabs away and back, every focus re-runs the three backend queries. A modest `staleTime` would cut redundant fetches with no correctness loss (DQ aggregates do not change second-to-second)." — evidence: `dataQuality.ts:77-81` (no `staleTime`) — severity: LOW
  - "`toSorted` on every render — `testResults` (DataQualityContent.tsx:75-77) is computed OUTSIDE a `useMemo`, so the array is re-sorted on every component render even when `data` is unchanged (e.g. a parent re-render). Cheap for ~6 categories, but inconsistent with the surrounding `useMemo`-wrapped derivations." — evidence: `DataQualityContent.tsx:75-77` (no `useMemo` wrapper, unlike lines 43-73) — severity: LOW

## upstream_callers

- entry_point: "ui_route:/data-quality"
  caller_node: "odd-platform ts react-component component:DataQuality"
  multiplicity_per_trigger: 1
  evidence: "DataQuality.tsx:13-15 — `<Layout.Content><DataQualityContent /></Layout.Content>`; `DataQuality` is mounted at `App.tsx:73` `<Route path={dataQualityPath()} element={<DataQuality />} />`; `dataQualityPath()` returns `/data-quality` (dataQualityRoutes.ts:1-3). One mount of `DataQualityContent` per page open."
  observation_class: ui-call
  unresolved: true   # the DataQuality.tsx parent node is not yet enriched (sibling, this batch)

- entry_point: "ui_route:/data-quality"
  caller_node: "REST GET /api/dataqatests/runs (the dashboard fetch this component originates)"
  multiplicity_per_trigger: "1 on plain open; 2 on open with a filter pre-set in the URL query string"
  evidence: "DataQualityContent.tsx:24 calls `useGetDataQualityDashboard(filterState)` once per render; react-query dedupes by queryKey so a plain open yields 1 fetch. On a deeplink open (`/data-quality?deNamespaceIds=[1]`), DataQualityFilters.tsx:28-43's mount useEffect sets `formFiltersAtom` from `searchParams` AFTER the first render — the derived `filtersAtom` then recomputes and a second fetch fires with the URL filters. Probe P-101 pins this; LSN-017 class."
  observation_class: rest-call
  unresolved: true   # multiplicity PROBE-NEEDED — see P-101

## downstream_side_effects

- side_effect_class: external-call
  description: "Issues HTTP `GET /api/dataqatests/runs` to the platform API — the single aggregate dashboard fetch"
  evidence: "DataQualityContent.tsx:24 → dataQuality.ts:79 (`dataQualityRunsApi.getDataQualityTestsRuns(params)`) → DataQualityRunsController.java:18-33"
  cardinality_per_call: "1 per component render, deduped by react-query queryKey to 1 per distinct filterState (1 per plain page-open; 2 on a URL-deeplinked open — see upstream_callers)"
  reachable_from_entry_points:
    - "ui_route:/data-quality"

- side_effect_class: page-render
  description: "Renders three DonutChart rings (Table Health, Test Results Breakdown, Monitored Tables) plus one TestCategoryResults card per backend test category, plus two status legends"
  evidence: "DataQualityContent.tsx:79-145"
  cardinality_per_call: "3 donuts + N category cards (N = number of categories in the API response, ~6) + 2 legends, per render"
  reachable_from_entry_points:
    - "ui_route:/data-quality"

- side_effect_class: external-call
  description: "REFERENCE — the backend GET /api/dataqatests/runs fans out to three DB queries (getLatestDataQualityRunsResults / getLatestTablesHealth / getMonitoredTables). The DB-read side effect is owned by the DataQualityRunsController / ReactiveDataQualityRunsRepository nodes."
  evidence: "DataQualityRunsServiceImpl.java:36-39"
  cardinality_per_call: "3 DB queries per dashboard fetch (server-side; not this node's side effect — recorded as a reference so the chain resolves)"
  reachable_from_entry_points:
    - "ui_route:/data-quality"
  unresolved: true   # the DataQualityRunsController + ReactiveDataQualityRunsRepository nodes are not yet enriched

## sources

- understanding ← DataQualityContent.tsx:1-147 (full file) + dataQuality.ts:74-82 (the hook) + DataQualityRunsController.java:18-33 (the backend controller) + openapi.yaml:1973-2087 (the endpoint spec) + DataQuality.tsx:1-21 (the parent)
- concepts.entities ← DataQualityContent.tsx:3, 24, 55, 67, 83 + dataQuality.ts:34-72 + components.yaml:3748-3825 (the DTO schemas) + components.yaml:1407-1415 (DataEntityRunStatus enum) + TestCategoryResults.tsx:8
- concepts.operations ← DataQualityContent.tsx:23-24, 28-77, 115-120
- concepts.invariants[0-1] ← DataQualityContent.tsx:33, 44, 54, 66, 75-77 + dataQuality.ts:34-81 (initialData always supplied)
- concepts.invariants[2] ← DonutChart.tsx:88-98 (the zero-total 'No data' path)
- concepts.invariants[3] ← DataQualityContent.tsx:75-77 + DataQualityRunsServiceImpl.java:36-42 (no backend ORDER BY)
- concepts.invariants[4] ← DataQualityContent.tsx:47-48 + interfaces.ts:55 (RunStatus = Record<DataEntityRunStatus, ItemColors>)
- concepts.audiences ← App.tsx:73 + ToolbarTabs.tsx:47-48 + WebFetch https://docs.opendatadiscovery.org/features/data-quality/dashboard 2026-05-22 status 200
- dependencies_semantic.requires-feature ← WebFetch data-quality + dashboard pages 2026-05-22 + openapi.yaml:1973-2087 + DonutChart.tsx:85-135 + DataQualityStore.ts:32-42 + DataQualityProvider.tsx:4-6
- dependencies_semantic.requires-runtime ← DataQualityContent.tsx:1-8, 76 + dataQuality.ts:1 + DonutChart.tsx:2
- dependencies_semantic.couples-to ← DataQualityStore.ts:2-7 + dataQuality.ts:2 + DataQualityContent.tsx:9 + components.yaml (OpenAPI-generated models)
- tests_coverage_semantic ← Glob `**/components/DataQuality/**` over <odd-platform-repo>/odd-platform-ui 2026-05-22 (21 source files, 0 test files)
- docs_link_semantic.inferred_docs[0] ← WebFetch https://docs.opendatadiscovery.org/features/data-quality/dashboard 2026-05-22 status 200
- docs_link_semantic.inferred_docs[1] ← WebFetch https://docs.opendatadiscovery.org/features/data-quality 2026-05-22 status 200
- docs_link_semantic.doc_drift_findings[0] (Table Health label drift) ← WebFetch dashboard page 2026-05-22 ('success / failed / broken') + DataQualityContent.tsx:55-62 (Healthy/Warning/Error) + components.yaml:3772-3787
- docs_link_semantic.doc_drift_findings[1] (breakdown 3-vs-6 statuses) ← WebFetch dashboard page 2026-05-22 ('passed / failed / skipped') + DataQualityContent.tsx:43-51, 83 + components.yaml:1407-1415
- docs_link_semantic.doc_drift_findings[2] (category ordering undocumented) ← WebFetch dashboard page 2026-05-22 + DataQualityContent.tsx:76 + dataQuality.ts:34-60
- docs_link_semantic.doc_drift_findings[3] (empty-state undocumented) ← WebFetch dashboard page 2026-05-22 (silent) + DonutChart.tsx:94-95
- implicit_adrs[0] (single-fetch projection) ← DataQualityContent.tsx:24, 43-77 + dataQuality.ts:74-82 + DataQualityRunsServiceImpl.java:36-42
- implicit_adrs[1] (read-only owner-unscoped, bare route) ← App.tsx:73 (bare route mount) + App.tsx:75-84 (the contrasting gated route) + DataQualityContent.tsx:22-147
- implicit_adrs[2] (category labels opaque, client-sorted) ← DataQualityContent.tsx:75-77, 115-120 + components.yaml:3805-3806 + dataQuality.ts:34-60
- bugs_limitations_corner_cases[0] (line-48 status-color crash) ← DataQualityContent.tsx:47-48 + interfaces.ts:55 + components.yaml:1407-1415
- bugs_limitations_corner_cases[1] (alphabetical category order) ← DataQualityContent.tsx:75-77 + DataQualityRunsServiceImpl.java:36-42
- bugs_limitations_corner_cases[2] (locale-dependent localeCompare) ← DataQualityContent.tsx:76
- bugs_limitations_corner_cases[3] (dead !data guards) ← dataQuality.ts:74-81 + DataQualityContent.tsx:33, 44, 54, 66, 75
- bugs_limitations_corner_cases[4] (capitalizeFirstLetter empty-string) ← DataQualityContent.tsx:13-15, 86
- bugs_limitations_corner_cases[5] (no error UI) ← DataQualityContent.tsx:24 + dataQuality.ts:77-81
- bugs_limitations_corner_cases[6] (zero test files) ← Glob `**/components/DataQuality/**` 2026-05-22
- stress_findings ← DataQualityContent.tsx:17-20, 24, 28-77 + dataQuality.ts:74-82 + DataQualityRunsController.java:19-32 + DataQualityRunsServiceImpl.java:36-42 + DataQualityTestFiltersMapper.java:9-26 + DataQualityTestFiltersDto.java:7-16 + DataQualityFilters.tsx:63, 70-74, 78, 85-89 + openapi.yaml:1973-2078 + interfaces.ts:55 + components.yaml:1407-1415, 3802-3825 + probes P-100, P-101
- security ← App.tsx:73 + App.tsx:75-84 + ToolbarTabs.tsx:47-48 + DataQualityContent.tsx:22-147 + components.yaml:3748-3825 + WebFetch dashboard page 2026-05-22
- performance ← DataQualityContent.tsx:24, 28-77, 75-77, 93-142 + dataQuality.ts:74-82 + DataQualityRunsServiceImpl.java:36-42 + DonutChart.tsx:107-129 + openapi.yaml:1973-2087
- upstream_callers ← DataQuality.tsx:13-15 + App.tsx:73 + dataQualityRoutes.ts:1-3 + DataQualityContent.tsx:24 + DataQualityFilters.tsx:28-43 + probe P-101
- downstream_side_effects ← DataQualityContent.tsx:24, 79-145 + dataQuality.ts:79 + DataQualityRunsController.java:18-33 + DataQualityRunsServiceImpl.java:36-39

## confidence_per_field

- understanding: HIGH (every claim verified against the component, the hook, the backend controller, the OpenAPI spec, and the parent route mount)
- concepts: HIGH (entities/operations/invariants traced to file:line in the component and the OpenAPI schemas)
- dependencies_semantic: HIGH (the single-endpoint contract and the generated-type coupling are directly readable)
- tests_coverage_semantic: HIGH (the zero-coverage finding is a verified file-system absence)
- docs_link_semantic: MEDIUM (two live URLs WebFetched 2026-05-22 status 200 with verbatim excerpts; confidence is MEDIUM not HIGH because the dashboard doc page is inferred — there is no `@docs` annotation — and the doc-drift findings are concrete code-vs-doc divergences with file:line + URL evidence)
- implicit_adrs: MEDIUM (ADR[0] is HIGH — the single-fetch shape is structural; ADR[1] and ADR[2] are MEDIUM — the intent is inferred from the bare route mount and the opaque-string handling, plausible but not anchored to a comment or exception)
- bugs_limitations_corner_cases: HIGH (each is a verified code observation; the line-48 crash is statically certain from the type definition; the ordering and multiplicity claims are flagged PROBE-NEEDED in stress_findings, not asserted here as fact)
- security: MEDIUM (the bare-route observation is HIGH; owner-scoping is N/A at this layer and explicitly deferred to the unenriched DataQualityRunsController node)
- performance: MEDIUM (the single-fetch + memoisation claims are HIGH; the staleTime/refetch behaviour relies on react-query defaults — STATIC-INFERRED, not probe-verified)
- upstream_callers: MEDIUM (the parent-mount caller is clear; the fetch multiplicity is PROBE-NEEDED — P-101 — and the parent DataQuality node is an unresolved reference, sibling this batch)
- downstream_side_effects: MEDIUM (the fetch + render side effects are clear; the backend DB-query side effect is an unresolved reference to nodes not yet enriched)
- stress_findings: MEDIUM (13 of 19 questions STATIC-INFERRED; 2 PROBE-NEEDED — both load-bearing operator-observable claims, the category ordering and the fetch multiplicity; 4 REFERENCE — the Category F filter-name trace exits scope at the backend repository; HIGH is not warranted while the two load-bearing claims await probes P-100/P-101)

## Maintainer notes

---
node_id: "odd-platform ts react-component component:TestCategoryResults"
node_kind: react-component
axis: react-component
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.5.0
schema_version: 0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-22-ZC
related_pillar_features:
  - "P-04:F-002"  # Quality Dashboard — this component is the per-test-category result row on the /data-quality page
related_features:
  - F-022  # per-dataset DQ test reports + SLA badge — SIBLING surface; F-022 is the dataset-detail "Test reports" tab, this node is the standalone catalog-wide dashboard. No code shared; both consume run-status enums.
related_concepts:
  - data-quality-category
  - data-entity-run-status
  - data-quality-dashboard
---

# TestCategoryResults — semantic understanding

## understanding

`TestCategoryResults` is a 48-line leaf presentational React component on the standalone
Data Quality Dashboard (`/data-quality`, Pillar P-04:F-002). It renders one horizontal
result row for a single data-quality test category — the category name as a heading, a
large total-count number, and a fixed row of six per-run-status count tiles
(`TestCategoryResults.tsx:11-45`). It receives a single `categoryResults` prop of
generated type `DataQualityCategoryResults` and is rendered once per category by the
sibling `DataQualityContent` component, which maps over `data.testResults`
(`DataQualityContent.tsx:115-120`). The component performs no data fetch and no mutation:
`total` is an in-component `reduce` over the prop's `results` array, and `sortedResults`
re-orders that array into `DataEntityRunStatus` enum-declaration order so the six tiles
always appear in a stable position regardless of the order the backend serialised them
(`TestCategoryResults.tsx:14-25`). Its only externally observable output is the rendered
DOM.

## concepts

- entities: [
    "DataQualityCategoryResults — the prop: { category: string, results: DataQualityRunStatusCount[] } (`TestCategoryResults.tsx:3, 8`; OpenAPI schema `odd-platform-specification/components.yaml:3802-3813`)",
    "DataQualityRunStatusCount — one element of `results`: { status: DataEntityRunStatus, count: integer } (OpenAPI schema `components.yaml:3815-3825`)",
    "DataEntityRunStatus — the six-value run-status enum SUCCESS | FAILED | SKIPPED | BROKEN | ABORTED | UNKNOWN (`TestCategoryResults.tsx:4`; OpenAPI schema `components.yaml:1407-1415`)",
    "test category — a class of data-quality test; the `category` string carries a `DataQualityCategory.getDescription()` value: 'Assertion Tests' | 'Volume Anomalies' | 'Freshness Anomalies' | 'Column Values Anomalies' | 'Schema Changes' | 'Unknown category' (`odd-platform-api/.../dto/DataQualityCategory.java:12-17`)"
  ]
- operations: [
    "compute-category-total — sum every `count` in `results` into one number (`TestCategoryResults.tsx:14-17`)",
    "stabilise-status-order — re-order `results` into DataEntityRunStatus enum-declaration order, dropping any status the array does not contain (`TestCategoryResults.tsx:19-25`)",
    "render-category-row — emit the category heading, the total, and one count tile per status (`TestCategoryResults.tsx:27-45`)"
  ]
- invariants: [
    "Pure leaf component — no useEffect, no hook that fetches or dispatches; both `useMemo`s are pure derivations of the `results` prop (`TestCategoryResults.tsx:1-25`)",
    "A count tile shows the literal en-dash character `\\u2013` when `count` is 0 or negative, the numeric count otherwise (`TestCategoryResults.tsx:39`)",
    "Tile colour is keyed by run status via `theme.palette.runStatus[$status].color` — SUCCESS green, FAILED red, BROKEN orange, SKIPPED blue, ABORTED purple, UNKNOWN grey (`TestCategoryResults.styles.ts:27-36`; `odd-platform-ui/src/theme/palette.ts:122-129`)",
    "The component renders ONLY statuses present in `results`; `sortedResults` is `enum.map(find).flatMap(present-only)` so an absent status produces no tile (`TestCategoryResults.tsx:19-25`)"
  ]
- audiences: [
    "data-quality-engineer / data-engineer — the operator viewing the catalog-wide `/data-quality` dashboard to read the spread of test-run outcomes per test category"
  ]

## dependencies_semantic

- requires-feature: [
    "Data Quality Dashboard data path — the `GET /api/dataqa/dashboard`-class endpoint feeding `DataQualityResults.test_results`; produced server-side by `DataQualityRunsServiceImpl.getDataQualityTestsRuns` → `DataQualityCategoryMapperImpl.mapToDto` (`odd-platform-api/.../service/DataQualityRunsServiceImpl.java:36-43`, `.../mapper/DataQualityCategoryMapperImpl.java:21-43`)"
  ]
- requires-config: [] — N/A. No `@Value`-equivalent, no env read, no feature flag; the component is pure UI.
- requires-runtime: [
    "React 18 + `useMemo` (`TestCategoryResults.tsx:2`)",
    "MUI `Typography` for the heading / total / count text (`TestCategoryResults.tsx:1, 29-40`)",
    "styled-components — the three styled wrappers in `TestCategoryResults.styles.ts`, parameterised by `$status` for the per-status colour (`TestCategoryResults.styles.ts:1-36`)",
    "the OpenAPI-generated `generated-sources` module for the `DataQualityCategoryResults` type and `DataEntityRunStatus` enum value-object (`TestCategoryResults.tsx:3-4`) — `generated-sources` is build-generated from `odd-platform-specification`, not checked into the repo"
  ]
- couples-to: [
    "`DataQualityContent` (sibling) — the sole renderer; passes one `categoryResults` element per `data.testResults` row, keyed by `categoryResults.category` (`DataQualityContent.tsx:115-120`) — REFERENCE, sibling node in batch ZC, not yet enriched",
    "`theme.palette.runStatus` — the per-status colour map consumed by `TestCategoryResultsItem` (`TestCategoryResults.styles.ts:33`); a status added to `DataEntityRunStatus` without a matching `runStatus` palette entry would throw at render"
  ]

## tests_coverage_semantic

- covered_behaviours: [] — N/A. No test file references `TestCategoryResults` (Grep for `TestCategoryResults` across `odd-platform-ui/src` returned only the component, its styles, and `DataQualityContent`; no `.test.tsx` / `.spec.tsx` / story file).
- uncovered_behaviours:
  - behaviour: "`total` correctly sums every `count` in `results` (including zero-count entries the backend always injects)"
    test_class: unit
    criticality: LOW
    note: "Trivial reduce; a regression would be visually obvious on the dashboard."
  - behaviour: "`sortedResults` produces tiles in fixed DataEntityRunStatus enum order regardless of the order the backend serialised `results`"
    test_class: unit
    criticality: MEDIUM
    note: "This is the component's one non-trivial behaviour — it exists to make tile position stable. A regression (e.g. switching to a plain `results.map`) silently makes column position track backend serialisation order, so a category's FAILED tile could land in a different slot than its neighbours' FAILED tiles. No test pins it."
  - behaviour: "a count tile renders the en-dash `\\u2013` for count 0 and the numeral for count > 0"
    test_class: unit
    criticality: LOW
  - behaviour: "render survives a `results` array missing one or more status entries (the `flatMap(f ? [f] : [])` drop-branch)"
    test_class: unit
    criticality: MEDIUM
    note: "Untested defensive branch — see bugs_limitations_corner_cases. In production the backend mapper guarantees all six statuses, so this branch is dead under the real data path; a test would document that contract dependency."
- test_files: [] — none found.
- gaps: |
    Zero test coverage on this node. The highest-leverage gap is the `sortedResults`
    enum-ordering behaviour (test_class: unit): it is the only logic in the file with a
    failure mode that is not visually self-evident — a broken sort silently mis-aligns
    count tiles between adjacent category rows. Unit is the only relevant class; the
    component has no boundary to integration-test and no performance or security surface.
    A single render test asserting tile order + the en-dash zero-state would cover the
    file's entire behavioural surface.

## docs_link_semantic

- declared_docs: [] — N/A. TS/TSX files in this repo carry no `// @docs:` annotations; the file has none.
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-quality"
    anchor: ""
    rationale: "Pillar P-04 landing page; names the `/data-quality` view and links the Quality Dashboard sub-page."
    last_verified_at: "2026-05-22T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      Dashboard description (verbatim): "the catalog-wide quality view at `/data-quality` — three breakdown rings (Table Health / Test Results / Monitored Tables), six anomaly-class metrics, and the per-side filter sets (tables vs tests)"

      Sub-page links named: "Test Results Import", "Quality Dashboard (`/features/data-quality/dashboard.md`)", "Dataset Quality Statuses (SLA)", "Visibility for Data Quality Engineer", "Alerting", "Main Concepts".

      The landing page does NOT mention test categories or a per-status (SUCCESS/FAILED/SKIPPED/BROKEN/ABORTED/UNKNOWN) count breakdown.
  - url: "https://docs.opendatadiscovery.org/features/data-quality/dashboard"
    anchor: ""
    rationale: "Quality Dashboard sub-feature page — the closest live documentation of the `/data-quality` page this component is part of."
    last_verified_at: "2026-05-22T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      Test-Results panel (verbatim): "Test Results Breakdown — the count of test runs broken down by status (passed / failed / skipped)."

      Anomaly classes (verbatim, the doc's list of six): "Assertion Tests, Column Values Anomalies, Freshness Anomalies, Schema Changes, Unknown Category, and Volume Anomalies."

      Per-category matrix (verbatim): "a per-test-category matrix on the right showing per-anomaly-class counts."

      The page does NOT describe how a zero / empty count is displayed.

- doc_drift_findings:
  - "**DOC DRIFT — the per-status breakdown documents only three statuses; the code renders six.** The live `dashboard` page (WebFetched 2026-05-22, status 200) describes the Test Results breakdown as 'broken down by status (passed / failed / skipped)' — three statuses. The component renders a tile for every value of `DataEntityRunStatus`, which has SIX values: SUCCESS, FAILED, SKIPPED, BROKEN, ABORTED, UNKNOWN (`components.yaml:1407-1415`; iterated at `TestCategoryResults.tsx:21`). An operator reading the docs will expect three columns and see six. Severity: MEDIUM — doc-gap on the standalone dashboard; the three statuses named are a subset, so the doc is incomplete rather than contradictory."
  - "**DOC GAP — the per-category result ROW (this component) is undocumented.** The live `dashboard` page describes 'three breakdown rings' and 'a per-test-category matrix … showing per-anomaly-class counts' but does not describe the per-category row this component renders: a category name + a total + a row of per-run-status count tiles. The presentation an operator actually sees on `/data-quality` for each test category is not documented. Severity: MEDIUM."
  - "**DOC DRIFT — minor casing mismatch on the 'Unknown' category label.** The live `dashboard` page lists the anomaly class as 'Unknown Category' (capital C). The code's `DataQualityCategory.UNKNOWN` description — the exact string rendered as the category heading by this component (`TestCategoryResults.tsx:30`) — is 'Unknown category' (lowercase c) (`odd-platform-api/.../dto/DataQualityCategory.java:17`). An operator sees 'Unknown category'. Severity: LOW."

## implicit_adrs

- "**Fixed-position status tiles via enum-order re-sort, not server-order rendering.** `sortedResults` deliberately discards the order the backend serialised `results` in and rebuilds the array by iterating `Object.values(DataEntityRunStatus)` and `find`-ing each status (`TestCategoryResults.tsx:19-25`). The decision is visible in the code shape: a plain `results.map(...)` would have been shorter; the developer chose the enum-driven re-sort specifically so every category row shows its SUCCESS / FAILED / SKIPPED / BROKEN / ABORTED / UNKNOWN tiles in the same horizontal slots, making the dashboard columns visually comparable across category rows. The same enum-iteration pattern is used for the shared dashboard legend in the sibling (`DataQualityContent.tsx:83-89`), so legend order and tile order are guaranteed to match." — evidence: `TestCategoryResults.tsx:19-25` (the enum-map-then-flatMap re-sort) + `DataQualityContent.tsx:83-89` (the legend using the identical `Object.values(DataEntityRunStatus)` iteration) — intent_anchor: "Object.values(DataEntityRunStatus).map(status => results.find(result => result.status === status)).flatMap(f => (f ? [f] : []))" (`TestCategoryResults.tsx:21-23`) — confidence: HIGH

## bugs_limitations_corner_cases

- "**The `flatMap(f => (f ? [f] : []))` drop-branch silently omits a status tile if `results` is missing that status — but in production it is dead code, masking a contract dependency.** `sortedResults` keeps only statuses actually present in `results`; a `DataEntityRunStatus` value absent from the array yields NO tile and NO placeholder (`TestCategoryResults.tsx:22-23`). This never triggers against the real backend: `DataQualityCategoryMapperImpl.addMissingStatuses` injects a zero-count `DataQualityRunStatusCount` for every `DataEntityRunStatus` value not already present, so every category's `results` array always has all six entries (`odd-platform-api/.../mapper/DataQualityCategoryMapperImpl.java:45-60`). The corner case: if that backend invariant ever regresses (or a future caller passes a partial `categoryResults`), category rows would show a varying NUMBER of tiles, breaking the column alignment the component exists to provide — and the drop is silent. The component does not enforce the six-status contract it depends on; it trusts the mapper. Severity: LOW (no production trigger today) — but it is an undocumented cross-tier coupling: the UI's correctness depends on a backend mapper guarantee that nothing in the UI asserts." — evidence: `TestCategoryResults.tsx:19-25` (the present-only flatMap) + `odd-platform-api/.../mapper/DataQualityCategoryMapperImpl.java:45-60` (`addMissingStatuses` — the backend guarantee the UI silently relies on) — severity: LOW
- "**A negative `count` renders as an en-dash, identical to a zero count — the two are indistinguishable to the operator.** The tile shows `count > 0 ? count : '\\u2013'` (`TestCategoryResults.tsx:39`), so `count === 0` and any `count < 0` both render `\\u2013`. The OpenAPI schema types `count` as `integer` with no `minimum: 0` constraint (`components.yaml:3820-3822`), so a negative value is schema-valid; it would also corrupt `total` (the `reduce` at `TestCategoryResults.tsx:14-17` sums it in) without any visible signal that a tile contributed a negative number. There is no production path that produces a negative count (the backend `count` is `row.taskRunsCount()`, a COUNT aggregate), so this is a latent robustness gap, not an active bug. Severity: LOW." — evidence: `TestCategoryResults.tsx:14-17` (the unguarded sum) + `TestCategoryResults.tsx:39` (the `count > 0` ternary collapsing 0 and negatives) + `components.yaml:3820-3822` (`count: integer`, no `minimum`) — severity: LOW
- "**`category` is rendered verbatim as a raw `DataQualityCategory.getDescription()` string with no i18n.** The category heading is `{category}` directly (`TestCategoryResults.tsx:30`) — unlike `DataQualityContent`, which wraps every other label in `t(...)` (`DataQualityContent.tsx:98, 109, 127`). The category labels ('Assertion Tests', 'Volume Anomalies', etc.) are therefore always English regardless of the user's selected locale, and the strings are server-defined enum descriptions, not part of the UI translation catalog. Severity: LOW (consistency / localisation gap; not a correctness bug)." — evidence: `TestCategoryResults.tsx:30` (`{category}` un-translated) vs `DataQualityContent.tsx:98, 109, 127` (`t(...)` used for every sibling label) + `odd-platform-api/.../dto/DataQualityCategory.java:12-17` (the server-defined English descriptions) — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables: []   # No numeric literal > 1, no constant, no magic string gating behaviour in this 48-line file. The only literal compared is `count > 0` (TestCategoryResults.tsx:39) — a zero-boundary, classified under request_inputs Q-on-`results`, not a tunable.
  name_behavior_pairs:
    - name: "sortedResults"
      promise: "A variable named `sortedResults` promises the `results` array sorted by some ordering criterion."
      implementation: "`Object.values(DataEntityRunStatus).map(status => results.find(...)).flatMap(present-only)` — it does not SORT the array in place; it REBUILDS it by iterating the DataEntityRunStatus enum in declaration order (SUCCESS, FAILED, SKIPPED, BROKEN, ABORTED, UNKNOWN) and picking the matching `results` element, dropping any status not found (`TestCategoryResults.tsx:19-25`). The 'sort key' is the enum's declaration order in `components.yaml:1407-1415` — not a value-derived comparator. Equivalent to a sort, but the name slightly understates: it is also a FILTER (statuses absent from `results` are dropped, not retained as zeros)."
      drift: MINOR
      operator_visible_consequence: "None today — the backend always supplies all six statuses, so the filter never drops anything. The MINOR flag records that the name says 'sorted' but the code also silently drops absent statuses; a maintainer reading only the name would not expect the drop branch."
      confidence: STATIC-INFERRED
      evidence: "TestCategoryResults.tsx:19-25 (the map/find/flatMap chain) + components.yaml:1407-1415 (the enum declaration order that IS the sort key)"
    - name: "total"
      promise: "`total` promises the total count for the category."
      implementation: "`results.reduce((acc, {count}) => acc + count, 0)` — sums every `count` in `results` (`TestCategoryResults.tsx:14-17`). Because the backend injects zero-count rows for every absent status (`DataQualityCategoryMapperImpl.java:45-60`), the sum is over all six status buckets and equals the count of latest data-quality task runs across all statuses for that category. Matches the promise."
      drift: NONE
      confidence: STATIC-INFERRED
      evidence: "TestCategoryResults.tsx:14-17 + odd-platform-api/.../mapper/DataQualityCategoryMapperImpl.java:32-38"
  orderings:
    - location: "TestCategoryResults.tsx:19-25"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer?"
          a: "There is no SQL ORDER BY at this node — this is a UI in-memory ordering. The tile order is fixed by the iteration order of `Object.values(DataEntityRunStatus)`, which for a TS string enum is the source-declaration order: SUCCESS, FAILED, SKIPPED, BROKEN, ABORTED, UNKNOWN (the enum is declared in `components.yaml:1407-1415` and code-generated into `generated-sources`). The order does NOT depend on `count`, on `category`, or on the order the backend serialised `results`."
          confidence: STATIC-INFERRED
          evidence: "TestCategoryResults.tsx:21 (Object.values(DataEntityRunStatus)) + components.yaml:1407-1415 (the enum declaration order)"
        - q: "What is the tie-breaker when sort-key values are equal?"
          a: "Not applicable — the sort key is the enum position, which is unique per status; no two tiles can have an equal sort key. Each of the six statuses appears exactly once."
          confidence: STATIC-INFERRED
          evidence: "TestCategoryResults.tsx:21-23 (one find() per distinct enum value)"
        - q: "Which subset is returned when result-set > page size?"
          a: "Not applicable — there is no pagination and no LIMIT. `results` has a fixed cardinality of six (one per DataEntityRunStatus, guaranteed by the backend `addMissingStatuses`). `sortedResults` renders all of them; it can only ever render FEWER than six (if a status is missing — see request_inputs), never more."
          confidence: STATIC-INFERRED
          evidence: "TestCategoryResults.tsx:36-42 (sortedResults.map renders every element) + odd-platform-api/.../mapper/DataQualityCategoryMapperImpl.java:45-60"
        - q: "Does any upstream layer re-sort or filter the result?"
          a: "Yes — the parent `DataQualityContent` sorts the CATEGORY rows (the outer array `data.testResults`) alphabetically by `category` via `.toSorted((a,b) => a.localeCompare(b))` (DataQualityContent.tsx:75-77). That is an orthogonal axis: the parent orders the category ROWS, this component orders the status TILES within one row. Neither re-sort hides a backend ordering issue — both impose a deterministic UI order over a backend response whose order is unspecified."
          confidence: STATIC-INFERRED
          evidence: "DataQualityContent.tsx:75-77 (parent toSorted on category) + TestCategoryResults.tsx:19-25 (this node's tile sort)"
  auth_gates: []   # This is a leaf presentational component with no HTTP endpoint, no @PreAuthorize, no permission call. Auth for the /data-quality page is enforced upstream (the route mount + the `useGetDataQualityDashboard` fetch in the sibling DataQualityContent / DataQualityStore). Not in scope of this node.
  resource_boundaries: []   # No @Transactional-equivalent, no lock, no cache, no idempotency concern, no shared mutable state. Both useMemo hooks are pure, dependency-keyed on `results`; React re-runs them only when the `results` reference changes. No concurrency surface.
  request_inputs:
    - location: "TestCategoryResults.tsx:7-12 (the TestCategoryResultsProps interface + the destructure of `categoryResults`)"
      input_kind: body-field
      input_name: "categoryResults"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "`categoryResults` promises the data-quality test RESULTS for one test CATEGORY — i.e. the per-status outcome counts for a single category of tests."
          confidence: STATIC-INFERRED
          evidence: "TestCategoryResults.tsx:7-12"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Destructured into `{ category, results }` (TestCategoryResults.tsx:12). `category` → rendered verbatim as the row heading (line 30) and used as the React `key` (line 28). `results` → reduced into `total` (lines 14-17) and re-ordered into `sortedResults` for the tile row (lines 19-25, 36-42). The prop is supplied by the parent `DataQualityContent`, which passes one element of `data.testResults` per render (DataQualityContent.tsx:115-119). `data.testResults` is the `test_results` array of the `DataQualityResults` payload (components.yaml:3748-3759), built server-side by `DataQualityCategoryMapperImpl.mapToDto` (odd-platform-api/.../mapper/DataQualityCategoryMapperImpl.java:21-43)."
          confidence: STATIC-INFERRED
          evidence: "TestCategoryResults.tsx:12-25, 30 + DataQualityContent.tsx:115-119 + components.yaml:3748-3759 + odd-platform-api/.../mapper/DataQualityCategoryMapperImpl.java:21-43"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES. `categoryResults.category` is a real test-category description (one of DataQualityCategory's six getDescription() strings — DataQualityCategory.java:12-17) and `categoryResults.results` is the genuine per-run-status count array for that category. The component renders exactly the category's results; no translation, no scope shift."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "TestCategoryResults.tsx:12 + odd-platform-api/.../dto/DataQualityCategory.java:12-17"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "Not applicable — no silent translation. One LSN-023-class sub-finding worth recording: the prop sub-field `results` (typed `DataQualityRunStatusCount[]`) is NOT rendered exhaustively — `sortedResults` keeps only statuses present in the array (the `flatMap(f ? [f] : [])` drop, lines 22-23). A consumer assuming 'every element of `results` becomes a tile' is correct, but a consumer assuming 'every DataEntityRunStatus gets a tile' is relying on the backend's `addMissingStatuses` guarantee, not on this component. The component renders what `results` CONTAINS, which today equals all six statuses only because the backend mapper makes it so. Recorded in bugs_limitations_corner_cases[0]."
          confidence: STATIC-INFERRED
          evidence: "TestCategoryResults.tsx:19-25 (present-only flatMap) + odd-platform-api/.../mapper/DataQualityCategoryMapperImpl.java:45-60 (the backend six-status guarantee)"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE. `DataQualityCategoryResults` has exactly two fields — `category` and `results` (components.yaml:3802-3813) — and both are consumed. `DataQualityRunStatusCount` has exactly two fields — `status` and `count` (components.yaml:3815-3825) — and both are consumed (`status` keys the tile and its colour; `count` drives the number and the total). No field of either DTO is read-but-ignored."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:3802-3825 + TestCategoryResults.tsx:12-42"
      routes_to_finding: "bugs_limitations_corner_cases[0] (the present-only flatMap drop / cross-tier six-status coupling) — no DRIFT_INPUT_NAME_VS_IMPLEMENTATION; the prop name matches the implementation."
  probes_emitted: []   # All stress questions resolved STATIC-INFERRED. This is a 48-line pure leaf component; every behaviour (the enum-order tile sort, the total reduce, the zero-state en-dash, the six-status backend guarantee) is fully determinable from the source read + the 1-hop neighbours (the styles file, the OpenAPI schema, the backend mapper). No runtime question remains; no probe is warranted.
  stress_summary:
    triggers_total: 4          # 2 name_behavior_pairs (sortedResults, total), 1 ordering site, 1 request_input (categoryResults)
    questions_total: 11        # 2 name_behavior_pairs + 4 ordering Qs + 5 request_input Qs
    answers_static_inferred: 11
    answers_probe_needed: 0
    answers_reference: 0
    drift_flags: 1             # name_behavior_pairs[0] sortedResults — MINOR (name says 'sorted', code also filters)
```

## security

- **auth_mode_relevance**: `INTERNAL_ONLY` — this is a UI presentational component, not an HTTP surface. It does not read an auth mode, a token, or a cookie. Authentication / authorisation for the `/data-quality` page is enforced upstream: the React route mount and the data fetch (`useGetDataQualityDashboard`) in the sibling `DataQualityContent` / the `DataQualityStore`-driven flow. Whatever auth mode (DISABLED / LOGIN_FORM / OAUTH2 / LDAP) protects the dashboard endpoint applies to the data this component receives, but the component itself imposes no gate.
- **ingestion_filter_relevance**: `N/A — not HTTP`. Not on any `/ingestion/entities` path; a UI component.
- **authorization_assertions**: [] — N/A. No `@PreAuthorize`-equivalent, no permission check; a leaf component cannot gate.
- **owner_scoping**: `N/A — code is not data-scoped`. The component renders whatever `categoryResults` prop it is handed; any owner-scoping (or its absence) on the dashboard data set is decided server-side in the dashboard query path, not here. The sibling `DataQualityController` sidecar records the read-collaborative posture for the related per-dataset endpoints; this node has no scoping role.
- **data_exposure**:
  - "Renders a test category name + per-run-status test-run counts (one category's slice of `DataQualityResults.test_results`) into the DOM → whichever user the upstream route + fetch already authorised to view the `/data-quality` dashboard" — evidence: `TestCategoryResults.tsx:27-45` (the render) + `DataQualityContent.tsx:24, 115-119` (the upstream fetch + prop pass)
- **known_security_gaps**: [] — N/A. A leaf presentational component with no fetch, no mutation, no auth surface, no user-supplied input (the only input is a typed prop from a sibling component). No file-local security concern. The category name is rendered with React's default JSX escaping, so the verbatim `{category}` render (`TestCategoryResults.tsx:30`) is not an injection vector even though the string is server-defined.

## performance

- **hot_paths**:
  - "Rendered once per test category on each `/data-quality` dashboard load — at most six instances (one per `DataQualityCategory` value), since the backend mapper produces exactly one `DataQualityCategoryResults` per category (`odd-platform-api/.../mapper/DataQualityCategoryMapperImpl.java:24-30, 40-42`). Not a hot path: a bounded, tiny render." — evidence: `DataQualityContent.tsx:115-120` + `odd-platform-api/.../mapper/DataQualityCategoryMapperImpl.java:24-43`
- **throughput_characteristics**:
  - "No fetch, no mutation, no async — pure synchronous render. Re-renders only when the parent re-renders or the `categoryResults` prop reference changes." — evidence: `TestCategoryResults.tsx:11-46`
- **resource_allocation**:
  - "Two `useMemo`s allocate one number (`total`) and one array of at most six elements (`sortedResults`) per dependency change; both are keyed on `results` so they recompute only when `results` changes (`TestCategoryResults.tsx:14-25`). Negligible — the working set is six small objects." — evidence: `TestCategoryResults.tsx:14-25`
- **scaling_characteristics**:
  - "Render cost is O(6) — fixed by the `DataEntityRunStatus` enum cardinality, independent of how many data-quality tests or test runs exist in the catalog. The dashboard scales by the number of categories (bounded at six), not by data volume. No pagination needed; none present." — evidence: `TestCategoryResults.tsx:21, 36-42` (six-element iterations) + `components.yaml:1407-1415` (six-value enum)
- **known_performance_gaps**: [] — N/A. The component's cost is constant and tiny; there is no performance gap to record.

## upstream_callers

- entry_point: "ui_route:/data-quality"
  caller_node: "odd-platform ts react-component component:DataQualityContent"
  multiplicity_per_trigger: "1 per test category — bounded at 6 (one per DataQualityCategory value)"
  evidence: "DataQualityContent.tsx:115-120 — `testResults.map(categoryResults => <TestCategoryResults key=... categoryResults=.../>)`; `testResults` is `data.testResults` sorted by category name (line 75-77). The backend mapper emits exactly one DataQualityCategoryResults per DataQualityCategory enum value (DataQualityCategoryMapperImpl.java:24-30), so the map yields at most 6 instances."
  observation_class: ui-call
  unresolved: true   # DataQualityContent is a sibling node in batch ZC, not yet enriched — REFERENCE entry per Rule 6.

## downstream_side_effects

- side_effect_class: page-render
  description: "Renders one Data Quality Dashboard category row into the DOM: a centred category heading (h4), a large total-count number (h1), and a horizontal row of per-run-status count tiles (one per status present in `results`, colour-keyed by run status)."
  evidence: "TestCategoryResults.tsx:27-45"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/data-quality"

# No db-write, activity-emit, external-call, sse-push, cache-mutate, header-set, redirect-issue,
# log-emit, or metric-emit side effects. This is a pure leaf display component: its only
# externally observable consequence is the rendered DOM. It calls no service, dispatches no
# action, mutates no store. Confirmed by the full file read (TestCategoryResults.tsx:1-48):
# no fetch hook, no useEffect, no jotai setter, no event handler.

## sources

- understanding ← `TestCategoryResults.tsx:1-48` (full file) + `DataQualityContent.tsx:115-120` (the sole call site) + `odd-platform/odd-platform-specification/components.yaml:3802-3825` (the prop's OpenAPI schema)
- concepts.entities ← `TestCategoryResults.tsx:3-4, 8` + `components.yaml:3802-3825` (DataQualityCategoryResults + DataQualityRunStatusCount) + `components.yaml:1407-1415` (DataEntityRunStatus enum) + `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/dto/DataQualityCategory.java:11-17` (the category descriptions)
- concepts.operations ← `TestCategoryResults.tsx:14-17` (total), `:19-25` (sortedResults), `:27-45` (render)
- concepts.invariants[0] ← `TestCategoryResults.tsx:1-25` (no useEffect / no dispatch; pure useMemo derivations)
- concepts.invariants[1] ← `TestCategoryResults.tsx:39` (`count > 0 ? count : '–'`)
- concepts.invariants[2] ← `TestCategoryResults.styles.ts:27-36` + `odd-platform-ui/src/theme/palette.ts:122-129` (the runStatus colour map)
- concepts.invariants[3] ← `TestCategoryResults.tsx:19-25` (the present-only flatMap)
- dependencies_semantic.requires-feature ← `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataQualityRunsServiceImpl.java:36-43` + `odd-platform-api/.../mapper/DataQualityCategoryMapperImpl.java:21-43`
- dependencies_semantic.requires-runtime ← `TestCategoryResults.tsx:1-5` + `TestCategoryResults.styles.ts:1-36`
- dependencies_semantic.couples-to ← `DataQualityContent.tsx:115-120` (the renderer) + `TestCategoryResults.styles.ts:33` (the theme.palette.runStatus coupling)
- tests_coverage_semantic ← Grep `TestCategoryResults` across `odd-platform-ui/src` (only the component + styles + DataQualityContent matched; no test/story file)
- docs_link_semantic.inferred_docs[0] ← WebFetch `https://docs.opendatadiscovery.org/features/data-quality` 2026-05-22 status 200
- docs_link_semantic.inferred_docs[1] ← WebFetch `https://docs.opendatadiscovery.org/features/data-quality/dashboard` 2026-05-22 status 200
- docs_link_semantic.doc_drift_findings ← WebFetch dashboard page 2026-05-22 (3 statuses) vs `components.yaml:1407-1415` (6-value enum) + `TestCategoryResults.tsx:21, 30` + `odd-platform-api/.../dto/DataQualityCategory.java:17` (the 'Unknown category' casing)
- implicit_adrs[0] ← `TestCategoryResults.tsx:19-25` + `DataQualityContent.tsx:83-89` (the legend using the identical enum iteration)
- bugs_limitations_corner_cases[0] ← `TestCategoryResults.tsx:19-25` + `odd-platform-api/.../mapper/DataQualityCategoryMapperImpl.java:45-60`
- bugs_limitations_corner_cases[1] ← `TestCategoryResults.tsx:14-17, 39` + `components.yaml:3820-3822`
- bugs_limitations_corner_cases[2] ← `TestCategoryResults.tsx:30` vs `DataQualityContent.tsx:98, 109, 127` + `odd-platform-api/.../dto/DataQualityCategory.java:12-17`
- stress_findings.name_behavior_pairs ← `TestCategoryResults.tsx:14-25` + `components.yaml:1407-1415` + `odd-platform-api/.../mapper/DataQualityCategoryMapperImpl.java:32-38`
- stress_findings.orderings ← `TestCategoryResults.tsx:19-25` + `components.yaml:1407-1415` + `DataQualityContent.tsx:75-77`
- stress_findings.request_inputs ← `TestCategoryResults.tsx:7-25, 30` + `DataQualityContent.tsx:115-119` + `components.yaml:3748-3825` + `odd-platform-api/.../mapper/DataQualityCategoryMapperImpl.java:21-60`
- security ← `TestCategoryResults.tsx:1-48` (no auth surface) + `DataQualityContent.tsx:24, 115-119` (upstream fetch)
- performance ← `TestCategoryResults.tsx:11-46` + `odd-platform-api/.../mapper/DataQualityCategoryMapperImpl.java:24-43` (the bounded-at-six category cardinality)
- upstream_callers[0] ← `DataQualityContent.tsx:115-120`
- downstream_side_effects[0] ← `TestCategoryResults.tsx:27-45`

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH — confirmed zero test coverage by Grep; the absence is a fact, not an inference.
- docs_link_semantic: HIGH — both doc pages WebFetched live 2026-05-22, status 200; drift findings are code-vs-live-doc comparisons with both sides cited.
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH — every item is a statically-determined fact with both the code anchor and (for the corner case) the backend-mapper anchor cited.
- security: HIGH — the absence of a security surface on a pure leaf component is statically certain.
- performance: HIGH
- upstream_callers: HIGH — the sole caller and the multiplicity bound are statically determined; `unresolved: true` reflects only that the sibling sidecar is not yet written, not uncertainty about the fact.
- downstream_side_effects: HIGH — full file read confirms page-render is the only side-effect class.
- stress_findings: HIGH — all 11 stress questions resolved STATIC-INFERRED with strong code evidence; zero PROBE-NEEDED.

## Maintainer notes

(none)

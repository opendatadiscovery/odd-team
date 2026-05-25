---
node_id: "odd-platform java DataQualityRunsController controller-class:DataQualityRunsController"
node_kind: controller-class
axis: controllers
extracted_at_commit: 4ec2b20
enriched_at_commit: 4ec2b20
extractor_version: 0.1.0
prompt_version: file-analyser/0.5.0
schema_version: 0.3.0
enrichment_status: complete
confidence_overall: MEDIUM
session_id: session-2026-05-25-ZG
related_pillar_features:
  - "P-04:F-002"  # Quality Dashboard — THIS controller is the sole backing endpoint of /data-quality
related_features:
  - F-022  # per-dataset Test Reports tab (DataQualityController) — DISTINCT surface; per-entity drill-down vs catalog-wide aggregate
related_refactors:
  - REFACTOR-024  # cross-owner enumeration family — this controller's lone endpoint is a NEW invocation site of the read-collaborative posture
related_adr_candidates:
  - ADR-CANDIDATE-003  # read-collaborative catalog (borderline-resolved-as-intentional)
  - ADR-CANDIDATE-114  # read-cardinality split — batch reads owner-scoped except listAll; this endpoint is a "listAll-like" aggregate
related_concepts:
  - data-quality-dashboard
  - last-run-aggregation
  - request-input-naming-drift
  - cross-owner-read-posture
references:
  - kind: sibling-callee
    node: "odd-platform ts react-component component:DataQualityContent"
    unresolved: true
    note: "the UI consumer issuing this endpoint via useGetDataQualityDashboard"
  - kind: sibling-peer
    node: "odd-platform java DataQualityController controller-class:DataQualityController"
    unresolved: false
    note: "per-entity DQ surface; same pillar P-04, distinct controller; cross-referenced for the read-collaborative posture and the aggregator-only pillar invariant"
  - kind: sibling-peer
    node: "odd-platform java DataEntityRunController controller-class:DataEntityRunController"
    unresolved: false
    note: "per-entity run-list surface (paginated DataEntityRunList); this controller is the catalog-wide aggregate counterpart"
---

# DataQualityRunsController — semantic understanding

## understanding

`DataQualityRunsController` is the single-endpoint HTTP entry point that backs the catalog-wide Data Quality Dashboard (`/data-quality` UI route, pillar P-04:F-002). It is a 22-line `@RestController` implementing the OpenAPI-generated `DataQualityRunsApi` and exposing exactly ONE operation — `getDataQualityTestsRuns` at `GET /api/dataqatests/runs` (`DataQualityRunsController.java:13-34`, `openapi.yaml:1973-2087`) — that accepts ten `List<Long>` filter parameters (two per-dimension across two "sides": tests-side `namespaceIds | datasourceIds | ownerIds | titleIds | tagIds`, tables-side `deNamespaceIds | deDatasourceIds | deOwnerIds | deTitleIds | deTagIds`) and returns a single `DataQualityResults` aggregate envelope carrying THREE composed slices: per-category × per-status test-result counts (`test_results`), table-health classification counts (`tables_dashboard.tables_health`: healthy/warning/error), and monitored-vs-not-monitored table counts (`tables_dashboard.monitored_tables`) (`DataQualityRunsServiceImpl.java:36-43`, `components.yaml:3748-3800`). Despite its operation name and OpenAPI summary "Get Data Quality tests runs", the endpoint does NOT return run instances — every numeric count is derived from `DATA_ENTITY_TASK_LAST_RUN` (a denormalised "latest run per test" table whose `task_oddrn` is a `PRIMARY KEY` — exactly one row per test), so `test_results` is "number of TESTS whose latest run has status X grouped by category", not "number of test runs with status X". The controller has no `@PreAuthorize`, no entry in `SecurityConstants.SECURITY_RULES`, no owner predicate at the repository tier — any authenticated user sees catalog-wide DQ aggregates, including via `DISABLED` mode where the surface is anonymous (read-collaborative posture, ADR-CANDIDATE-003 / REFACTOR-024). Two of the ten filter parameters carry the LSN-020 input-name-vs-implementation drift documented in the companion `DataQualityFilters` sidecar: `titleIds`/`deTitleIds` bind to `OWNERSHIP.TITLE_ID` (ownership role like "Data Steward") not to dataset title; `namespaceIds`/`deNamespaceIds` silently widen the match via `OR NAMESPACE.ID.eq(DATA_SOURCE.NAMESPACE_ID)`.

## concepts

- entities: [
    "DataQualityResults — the envelope: `{testResults: List<DataQualityCategoryResults>, tablesDashboard: TablesDashboard}` (`components.yaml:3748-3759`)",
    "DataQualityCategoryResults — per-category bucket: `{category: String, results: List<DataQualityRunStatusCount>}` (`components.yaml:3802-3813`)",
    "DataQualityRunStatusCount — the leaf cell: `{status: DataEntityRunStatus, count: int}` (`components.yaml:3815-3825`)",
    "DataQualityCategory enum — 6 categories: ASSERTION / VOLUME_ANOMALY / FRESHNESS_ANOMALY / COLUMN_VALUES_ANOMALY / SCHEMA_CHANGE / UNKNOWN (`DataQualityCategory.java:11-17`)",
    "DataEntityRunStatus enum — 6 statuses padded to every category by the mapper: SUCCESS / FAILED / SKIPPED / BROKEN / ABORTED / UNKNOWN (`DataQualityCategoryMapperImpl.java:45-60`)",
    "TablesDashboard — `{tablesHealth: TablesHealthDashboard, monitoredTables: MonitoredTablesDashboard}` (`components.yaml:3761-3770`)",
    "TablesHealthDashboard — `{healthyTables, warningTables, errorTables: int}` derived from each table's latest-run status pattern (`components.yaml:3772-3787`)",
    "MonitoredTablesDashboard — `{monitoredTables, notMonitoredTables: int}` — TABLE-type entities with vs without any DQ-test relation (`components.yaml:3789-3800`)",
    "DataQualityTestFiltersDto — `record` with 10 `List<Long>` fields, two prefixes × five dimensions (`DataQualityTestFiltersDto.java:7-16`)",
    "DATA_ENTITY_TASK_LAST_RUN — denormalised PK-per-task last-run table, the single source of `status` for both test_results and tables_health (`V0_0_45__last_runs_table.sql:7-13`)"
  ]
- operations: [
    "list-aggregate-dq-runs (`getDataQualityTestsRuns`, GET `/api/dataqatests/runs`) — fetches all three slices in parallel via `Mono.zipWith` (`DataQualityRunsServiceImpl.java:36-39`)",
    "compute-latest-runs-per-category-and-status (`ReactiveDataQualityRunsRepositoryImpl.getLatestDataQualityRunsResults:65-105`) — multi-CTE JOOQ chain: tests-filter CTE → joins DATA_ENTITY_TASK_LAST_RUN → optionally joins data-entity-filter CTE via DATA_QUALITY_TEST_RELATIONS → groups (category, status)",
    "compute-table-health (`ReactiveDataQualityRunsRepositoryImpl.getLatestTablesHealth:108-173`) — three CTE-derived slices counted via UNION ALL: HEALTHY = `NOT EXISTS non-SUCCESS last_run`; ERROR = `EXISTS BROKEN|FAILED last_run` AND `NOT IN healthy`; WARNING = `NOT IN healthy NOT IN error`",
    "compute-monitored-tables (`ReactiveDataQualityRunsRepositoryImpl.getMonitoredTables:176-196`) — restricted to TABLE-type data entities; MONITORED = `EXISTS DATA_QUALITY_TEST_RELATIONS`, NOT_MONITORED = `NOT EXISTS`",
    "pad-missing-statuses (`DataQualityCategoryMapperImpl.addMissingStatuses:45-60`) — fills every (category, status) cell with `count=0` so the UI rings always have a full status legend"
  ]
- invariants: [
    "Reactive single-call signature — returns `Mono<ResponseEntity<DataQualityResults>>` with `.map(ResponseEntity::ok)`; success always emits 200 OK (`DataQualityRunsController.java:18-33`)",
    "Three parallel sub-queries composed via `Mono.zipWith(other.zipWith(yet-another))` — one DB round-trip per CTE chain (`DataQualityRunsServiceImpl.java:36-39`)",
    "`test_results` counts ONE row per test (its latest run) — NOT one row per historical run. `DATA_ENTITY_TASK_LAST_RUN.task_oddrn` is `PRIMARY KEY` (`V0_0_45__last_runs_table.sql:9`); the count is therefore the number of TESTS whose latest run has status X, not the number of TEST RUNS with status X",
    "Categories enum is closed at 6 — `ASSERTION | VOLUME_ANOMALY | FRESHNESS_ANOMALY | COLUMN_VALUES_ANOMALY | SCHEMA_CHANGE | UNKNOWN` — and any unrecognised category string in the JSON specific_attributes is mapped to UNKNOWN (`DataQualityCategory.java:11-31`)",
    "The SQL `ORDER BY category` (alphabetic) is at the lowest layer (`ReactiveDataQualityRunsRepositoryImpl.java:101`); the UI re-sorts via `localeCompare` (`DataQualityContent.tsx:75-77`) — both layers do the SAME ordering, so the re-sort is redundant but not divergent",
    "Test-filter CTE matches `DATA_ENTITY.TYPE_ID = JOB.id` AND `DATA_QUALITY_TEST_TYPE` json-path IS NOT NULL — i.e. only data entities that are JOB type AND carry the `specific_attributes->'DATA_QUALITY_TEST'->'expectation'->>'category'` attribute (`ReactiveDataQualityRunsRepositoryImpl.java:67-73, 246-256`)",
    "Data-entity-filter CTE EXCLUDES JOB and JOB_RUN type entities — only datasets and other non-job entities qualify (`ReactiveDataQualityRunsRepositoryImpl.java:266`)",
    "Monitored Tables CTE is restricted to `TYPE_ID = TABLE.id` ONLY — Views, Files, Topics, and other dataset sub-types are NOT counted in 'monitored' or 'not monitored' (`ReactiveDataQualityRunsRepositoryImpl.java:179`)",
    "Table-health classification is mutually exclusive and exhaustive: every dataset with a DQ test falls into exactly one of {healthy, error, warning} per the CTE algebra (`ReactiveDataQualityRunsRepositoryImpl.java:111-157`)",
    "Mapper pads every category × every status with `count=0` if absent — the response envelope is always 6 categories × 6 statuses = 36 cells regardless of data (`DataQualityCategoryMapperImpl.java:45-60`)"
  ]
- audiences: [
    "data-quality-engineer / data-platform-operator — opens `/data-quality` to triage catalog-wide test health (per live doc `https://docs.opendatadiscovery.org/features/data-quality/dashboard` 2026-05-25 status 200: 'Test Results Breakdown — the count of test runs broken down by status (passed / failed / skipped)' + 'Monitored Tables — the count of tables broken down by whether they are monitored (have at least one DQ test) or unmonitored')",
    "odd-platform-ui-end-user — any authenticated user reaching `/data-quality`; no permission filter on the route (`App.tsx:73`); no entry in `SecurityConstants.SECURITY_RULES` for the path (`SecurityConstants.java:98-355` audited)"
  ]

## dependencies_semantic

- requires-feature: [
    "Data Quality test-results-import pipeline — every value this endpoint computes is derived from already-ingested test-result data via DATA_ENTITY_TASK_RUN → DATA_ENTITY_TASK_LAST_RUN; the platform aggregates results produced by external tools (per live doc `https://docs.opendatadiscovery.org/features/data-quality` 2026-05-25 status 200: 'ODD covers Data Quality fully as an aggregator. Quality checks are not performed inside ODD Platform')",
    "DATA_ENTITY_TASK_LAST_RUN denormalisation — the `task_oddrn`-keyed last-run table populated by the ingestion path (`V0_0_45__last_runs_table.sql:7-25`); without it the dashboard cannot resolve 'latest run per test' without an O(N×M) scan of DATA_ENTITY_TASK_RUN",
    "DATA_QUALITY_TEST_RELATIONS table — the (data_quality_test_oddrn ↔ dataset_oddrn) relation; required to resolve which dataset a test covers and used in all three sub-queries (`ReactiveDataQualityRunsRepositoryImpl.java:82-88, 117-153, 198-220`)",
    "P-04:F-002 frontend — the React `<DataQuality>` route component + sibling `DataQualityFilters` and `DataQualityContent` consume this endpoint via `useGetDataQualityDashboard` (`dataQuality.ts:74-82`)"
  ]
- requires-config: [] — N/A. This controller declares no `@ConditionalOnProperty`, no `@Value`, no `@ConfigurationProperties` dependency; auth wiring is global via `*SecurityConfiguration` beans, not local to this controller.
- requires-runtime: [
    "Spring WebFlux — `@RestController` + `Mono<ResponseEntity<T>>` return type + `ServerWebExchange` parameter (`DataQualityRunsController.java:8-10, 18-33`)",
    "Reactor Core — `Mono.zipWith(other.zipWith(...))` composition fans out 3 parallel DB sub-queries (`DataQualityRunsServiceImpl.java:36-39`)",
    "jOOQ reactive DB session — `JooqReactiveOperations.flux(...)` runs all three SQL chains against PostgreSQL (`ReactiveDataQualityRunsRepositoryImpl.java:103, 159, 189`)",
    "PostgreSQL JSONB operators — `specific_attributes->'DATA_QUALITY_TEST'->'expectation'->>'category'` is a JSONB path-extract on the `DATA_ENTITY.specific_attributes` column (`ReactiveDataQualityRunsRepositoryImpl.java:46-47, 69`); the dashboard query is therefore Postgres-specific",
    "Lombok `@RequiredArgsConstructor` — constructor-injection of `DataQualityRunsService` (`DataQualityRunsController.java:14, 16`)"
  ]
- couples-to: [
    "`DataQualityRunsApi` (OpenAPI-generated interface) — supplies `@RequestMapping(GET /api/dataqatests/runs)`, the 10 `@RequestParam` declarations, and the `getDataQualityTestsRuns` operation id (`openapi.yaml:1973-2087`)",
    "`DataQualityRunsService` interface — sole downstream; one method (`DataQualityRunsService.java:7-13`)",
    "`DataQualityRunsServiceImpl` — composes the three repository calls and delegates mapping (`DataQualityRunsServiceImpl.java:1-44`)",
    "`ReactiveDataQualityRunsRepository` — three methods: `getLatestDataQualityRunsResults`, `getLatestTablesHealth`, `getMonitoredTables` (`ReactiveDataQualityRunsRepository.java:7-25`)",
    "`DataQualityTestFiltersMapper` — controller-param-list → DTO record (`DataQualityTestFiltersMapper.java:1-27`); pure-shape, no business logic",
    "`DataQualityCategoryMapper`/`Impl` — repository-row records → `List<DataQualityCategoryResults>` with status-padding (`DataQualityCategoryMapperImpl.java:18-61`)",
    "`TablesDashboardMapper`/`Impl` — repository-row records → `TablesDashboard` (`TablesDashboardMapperImpl.java:10-39`)",
    "`SecurityConstants.SECURITY_RULES` — NEGATIVE coupling: this controller's path has NO entry (`SecurityConstants.java:98-355`); the absence is the decision (read-collaborative posture)"
  ]

## tests_coverage_semantic

- covered_behaviours:
  - behaviour: "Repository-tier — `getLatestDataQualityRunsResults` returns one row per (category, status) when generated test data spans 5 categories × varied statuses; counts match the per-category test counts"
    test_class: integration
    test_files: ["odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/ReactiveDataQualityRunsRepositoryTest.java:91-99"]
  - behaviour: "Repository-tier — `getMonitoredTables` distinguishes TABLE-type entities with vs without DQ-test relations; `notMonitoredTables` count matches additional unrelated tables seeded"
    test_class: integration
    test_files: ["odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/ReactiveDataQualityRunsRepositoryTest.java:101-119"]
- uncovered_behaviours:
  - behaviour: "HTTP-level smoke test for `GET /api/dataqatests/runs` — assert status 200, content-type application/json, DataQualityResults schema-conforming"
    test_class: integration
    criticality: HIGH
    note: "no `@WebFluxTest(DataQualityRunsController.class)` and no `WebTestClient` test exists; the controller-mapper-service-repository wiring is unverified at the HTTP boundary"
  - behaviour: "Category-F TitleIds drift — supplying `titleIds=[X]` must filter by OWNERSHIP.TITLE_ID, not by dataset title; supplying a value that is an entity-name-but-not-a-title returns empty"
    test_class: integration
    criticality: HIGH
    note: "the LSN-020 class drift is unguarded; a future maintainer 'fixing' the SQL to filter by dataset name would silently invert the surface"
  - behaviour: "Category-F NamespaceIds widening — supplying `namespaceIds=[N]` includes entities whose own NAMESPACE_ID is null/different but whose DATA_SOURCE.NAMESPACE_ID = N"
    test_class: integration
    criticality: HIGH
    note: "the OR-widening at ReactiveDataQualityRunsRepositoryImpl.java:288-293 is unguarded by tests"
  - behaviour: "`getLatestTablesHealth` — a dataset whose ONLY DQ test's latest run is SUCCESS classifies as healthy; same dataset with a single FAILED latest-run classifies as error; a dataset with mixed pass/skip latest runs classifies as warning"
    test_class: integration
    criticality: HIGH
    note: "no test exercises `getLatestTablesHealth`; the 3-way classification (healthy / error / warning) is unverified"
  - behaviour: "Latest-run vs all-runs semantics — a test that has run 100 times (90 SUCCESS, 10 FAILED, latest=FAILED) contributes ONE count to FAILED bucket, not 90/10 split"
    test_class: integration
    criticality: HIGH
    note: "the load-bearing 'count of tests by latest-run-status, not count of test runs' invariant has no test pinning it; a future schema change that switched DATA_ENTITY_TASK_LAST_RUN to multi-row per task (or fan-out reverted to DATA_ENTITY_TASK_RUN) would silently change the dashboard semantics"
  - behaviour: "Authorization — call without authentication under LOGIN_FORM/OAUTH2/LDAP returns 401; call with any authenticated principal (no owner association) returns 200 with full catalog data"
    test_class: security
    criticality: HIGH
    note: "the controller has no @PreAuthorize, no SecurityRule entry; the read-collaborative posture (catalog-wide DQ visible to any authenticated user) is unguarded by tests"
  - behaviour: "Performance — endpoint completes in <500ms p95 for a catalog with 1K data entities and 10K DQ tests with all-empty filters"
    test_class: performance
    criticality: MEDIUM
    note: "the three sub-queries are CTE-heavy with multi-join + JSONB extracts; no benchmark exists; for a 100K-test catalog the response time is unmeasured"
  - behaviour: "Filter combination — all 10 filters supplied AND non-overlapping (no entity matches all dimensions) returns DataQualityResults with all-zero counts, NOT an error"
    test_class: integration
    criticality: MEDIUM
    note: "the mapper pads missing (category, status) with 0; verify the pad survives empty-result responses"
- test_files: [
    "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/ReactiveDataQualityRunsRepositoryTest.java:1-213 — two test methods (`testGetLatestDataQualityRunsResults`, `testGetMonitoredTables`); no test for `getLatestTablesHealth`",
    "[NO MATCH] — `find <odd-platform> -path '*test*' -name 'DataQualityRunsController*'` returned no files (2026-05-25)",
    "[NO MATCH] — `find <odd-platform> -path '*test*' -name 'DataQualityRunsService*'` returned no files (2026-05-25)"
  ]
- gaps: |
    Coverage is asymmetric: integration coverage exists at the repository tier for two of the three sub-queries (latest-run results, monitored tables) but NOT for the third (table health). The service tier, the controller tier, and the HTTP boundary are entirely uncovered. The load-bearing invariant — `DATA_ENTITY_TASK_LAST_RUN` is single-row-per-task, so `test_results` counts tests not runs — has no test pinning it; a future maintainer reverting the denormalisation, or schema-evolving the table, would silently change the dashboard's meaning. The Category-F drift (titleIds → OWNERSHIP.TITLE_ID, namespaceIds widening) has no integration test guarding the current behaviour or pinning the divergence between input-name and SQL-bind. The highest-leverage gap class is integration: one well-constructed test class running against Testcontainers Postgres exercising the full controller-to-SQL path against 5-10 seeded entities would close 5 of the 7 HIGH-criticality gaps above. A security test class is the next gap (cross-mode authorization posture, the LOGIN_FORM-OAUTH2 asymmetry from sibling IngestionController would apply here too — REFERENCE: probe P-146 already exists for the IngestionController side; the same shape needs replication for this controller).

## docs_link_semantic

- declared_docs: [] — N/A. The source file `DataQualityRunsController.java` carries no `@docs` Javadoc annotation; this matches the repo-wide convention (no controller in the package bootstraps `@docs` annotations).
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-quality/dashboard"
    anchor: ""
    rationale: "Dedicated sub-page for the Quality Dashboard at `/data-quality`; explicitly names the three breakdown rings (Test Results, Table Health, Monitored Tables) and the six anomaly classes this endpoint computes"
    last_verified_at: "2026-05-25T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Test Results Breakdown definition (verbatim): "Test Results Breakdown — the count of test runs broken down by status (passed / failed / skipped)."

      Table Health definition (verbatim): "Table Health — the count of tables broken down by their aggregate health status (success / failed / broken)."

      Monitored Tables definition (verbatim): "Monitored Tables — the count of tables broken down by whether they are monitored (have at least one DQ test) or unmonitored." + "The 'Monitored vs Unmonitored' framing applies specifically to Table-type datasets."

      Six anomaly classes (verbatim):
        1. "Assertion Tests — validations or checks put in place to ensure that specific conditions or assertions about the data are met."
        2. "Column Values Anomalies — irregularities or unexpected values in the data that deviate from a predefined set of acceptable or standard values."
        3. "Freshness Anomalies — staleness signals — checking whether the data is up-to-date and falls within the acceptable time frame."
        4. "Schema Changes — modifications in the structure or organization of the data, with a focus on monitoring whether the data schema remains consistent over time."
        5. "Unknown Category — data placed into a category that was not foreseen or specified in the established data model or schema."
        6. "Volume Anomalies — unexpected changes in the quantity or volume of data."

      Backend endpoint / parameters (verbatim absence): the page "provides no information about backend endpoints, API parameters, or technical implementation details".

      "Latest run" semantics (verbatim absence): the page is silent on which task run is counted (latest vs all).

      Table Health rules (verbatim absence): the page enumerates three statuses but "does not provide explicit definitions for 'healthy,' 'warning,' or 'error' states".

      Authentication / authorization (verbatim absence): "Not addressed on this page."

      Filter semantics for Title / Namespace (verbatim absence): the page references the dual filter sets and "AND conjunction" but "provides no guidance on filter semantics for specific fields like 'Title' or 'Namespace,' nor any discussion of cross-tenant exposure."
  - url: "https://docs.opendatadiscovery.org/features/data-quality"
    anchor: ""
    rationale: "P-04 pillar landing page; names the `/data-quality` route, the three breakdown rings, and the per-side filter sets backing this endpoint"
    last_verified_at: "2026-05-25T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Landing description (verbatim): "ODD covers Data Quality fully as an aggregator. Quality checks are not performed inside ODD Platform — the platform integrates with leading tools in the field and surfaces their results in one operator-friendly view."

      Dashboard reference (verbatim): "three breakdown rings (Table Health / Test Results / Monitored Tables), six anomaly-class metrics" + "per-side filter sets (tables vs tests)".

      Backend endpoint URL / operationId (verbatim absence): "Not provided on this page."

      Authentication / authorization (verbatim absence): "Not discussed on this page."

      Latest-run / aggregation logic (verbatim absence): "Not mentioned on this page."
- doc_drift_findings:
  - "**DOC DRIFT — `test_results` counts TESTS, not RUNS, contrary to the dashboard doc's verbatim definition.** The live `https://docs.opendatadiscovery.org/features/data-quality/dashboard` page (WebFetched 2026-05-25 status 200) defines Test Results Breakdown as 'the count of test runs broken down by status (passed / failed / skipped)' — implying every historical run contributes to the count. The implementation joins `DATA_ENTITY_TASK_LAST_RUN` (`ReactiveDataQualityRunsRepositoryImpl.java:76, 95`), whose `task_oddrn` is `PRIMARY KEY` (`V0_0_45__last_runs_table.sql:9`) — exactly one row per test. A test that ran 100 times (90 SUCCESS, 10 FAILED, latest=FAILED) contributes ONE row to the FAILED bucket, not 90/10. The dashboard doc says 'count of test runs'; the code computes 'count of tests by their latest-run status'. The operator-visible consequence: a test that flapped many times but recently succeeded shows as one SUCCESS, with the failure history invisible; a test that succeeded for years and just started failing shows as one FAILED, eclipsing the success history. This is the LSN-019 class (`listMostPopular` → not popularity-ordered) instantiated on the dashboard endpoint. Severity: HIGH — the dashboard caption 'Test Results Breakdown' and the live doc both describe a per-run count; the platform delivers a per-test count keyed on the latest run."
  - "**DOC DRIFT — `titleIds`/`deTitleIds` filter binds to OWNERSHIP.TITLE_ID (ownership role), not to dataset title.** The live dashboard page acknowledges 'Title' as one of the five filter dimensions on each side but explicitly does not document what it filters by. The SQL bind is `OWNERSHIP.TITLE_ID.in(titleIds)` (`ReactiveDataQualityRunsRepositoryImpl.java:301, 309`); the autocomplete is populated by `useGetTitleList` (a list of ownership titles like 'Data Steward'). This is the LSN-020 input-name-vs-implementation drift instantiated on the dashboard endpoint. Severity: HIGH — identical shape and same documentation gap as the companion `DataQualityFilters` sidecar's doc_drift_findings[0]."
  - "**DOC DRIFT — `namespaceIds`/`deNamespaceIds` filter silently widens via DATA_SOURCE.NAMESPACE_ID.** The SQL joins `NAMESPACE.ID.in(namespaceIds).and(NAMESPACE.ID.eq(DATA_ENTITY.NAMESPACE_ID).or(NAMESPACE.ID.eq(DATA_SOURCE.NAMESPACE_ID)))` (`ReactiveDataQualityRunsRepositoryImpl.java:288-293`). The dashboard doc names the filter but does not state that an entity whose datasource's namespace matches is ALSO included. An operator filtering by namespace X sees more entities than 'entities directly assigned to namespace X' implies. Severity: MEDIUM — same shape and identical doc-side absence as `DataQualityFilters` sidecar's doc_drift_findings[1]."
  - "**DOC DRIFT — Table Health classification rules entirely undocumented.** The dashboard page enumerates the three categories (healthy / warning / error) but provides no rules. The SQL implements: HEALTHY = `dataset has NO last_run with status != SUCCESS`; ERROR = `dataset has a last_run with status in {BROKEN, FAILED}` AND NOT in healthy; WARNING = `everything else with a DQ test` (i.e. has a DQ test, last runs include non-SUCCESS but no BROKEN/FAILED — typical case: status in {SKIPPED, ABORTED, UNKNOWN}). The doc-vs-code divergence is doc-SILENT not doc-WRONG: the operator cannot predict which colour their dataset will render. Severity: MEDIUM."
  - "**DOC DRIFT — Monitored Tables restricted to TABLE-only data-entity type, not to all datasets.** The dashboard page says 'The Monitored vs Unmonitored framing applies specifically to Table-type datasets', which is consistent. But the operator may not realise that Views, Files, Topics, Streams (all 'dataset' entity classes) are simply absent from the monitored/not-monitored count entirely — they are not 'not monitored', they are 'not counted'. The CTE filter `DATA_ENTITY.TYPE_ID.eq(DataEntityTypeDto.TABLE.getId())` (`ReactiveDataQualityRunsRepositoryImpl.java:179`) is restrictive. Severity: LOW — the doc states the restriction, so this is documentation-CORRECT but operator-surprise-shaped."
  - "**DOC DRIFT — read-endpoint authorization scoping silent.** The live `data-quality.md` and `data-quality/dashboard.md` pages collectively make NO statement about who can view the catalog-wide dashboard. The code permits any authenticated user (no SecurityRule entry; falls through to `.authenticated()`). The downstream SQL has no owner predicate. Coherent with the cross-owner read-collaborative posture (ADR-CANDIDATE-003 / REFACTOR-024) but undocumented. Severity: MEDIUM — same shape as `DataQualityController` sidecar's doc_drift_findings[1] applied to the catalog-wide aggregate."

## implicit_adrs

- "**The dashboard reads a denormalised 'latest run per test' table rather than aggregating over the full task-run history at query time.** The endpoint joins `DATA_ENTITY_TASK_LAST_RUN` (`ReactiveDataQualityRunsRepositoryImpl.java:76, 95, 117-141`) — a table whose `task_oddrn` is `PRIMARY KEY` and whose state is maintained out-of-band by the ingestion path (`V0_0_45__last_runs_table.sql:7-25`). The decision is to PRE-COMPUTE 'latest run per test' at write time (denormalisation) rather than computing `DISTINCT ON (task_oddrn) ORDER BY end_time DESC` at every dashboard load. The intent is throughput: the dashboard query is hit on every filter change in the UI with no debounce (per `DataQualityFilters` sidecar's performance.hot_paths), and recomputing 'latest run' across DATA_ENTITY_TASK_RUN (which grows linearly with ingestion volume) would scale poorly. The denormalisation IS the decision — it changes the dashboard's semantic from 'count of test runs by status' to 'count of tests by their latest-run-status'." — evidence: `V0_0_45__last_runs_table.sql:7-25` (the table creation + the back-fill `DISTINCT ON (tr.task_oddrn) ORDER BY tr.task_oddrn, tr.end_time DESC ... ON CONFLICT DO UPDATE`) + `ReactiveDataQualityRunsRepositoryImpl.java:41, 76, 95` (joins consume the denormalised table) — intent_anchor: "DISTINCT ON (tr.task_oddrn) tr.task_oddrn AS task_oddrn, tr.oddrn AS last_task_run_oddrn, tr.end_time AS end_time, tr.status AS status FROM data_entity_task_run tr ORDER BY tr.task_oddrn, tr.end_time DESC" (`V0_0_45__last_runs_table.sql:15-21`) — confidence: HIGH

- "**The dashboard exposes the catalog-wide DQ aggregate to any authenticated user with no owner predicate — read-collaborative posture (ADR-CANDIDATE-003) applied to P-04.** This controller has no `@PreAuthorize`, no entry in `SecurityConstants.SECURITY_RULES` (`SecurityConstants.java:98-355` audited 2026-05-25), and the downstream `ReactiveDataQualityRunsRepositoryImpl` SQL has no owner / principal predicate (`ReactiveDataQualityRunsRepositoryImpl.java:65-196` — every JOIN is filter-derived from the request params, not principal-derived). The path falls through to `AuthorizationCustomizer.pathMatchers('/**').authenticated()`. The decision is the deliberate ABSENCE of a SecurityRule: a maintainer added rules for severity-mutation and admin-only paths (`SecurityConstants.java:243-246` and others) but explicitly did not for `/api/dataqatests/runs`. The intent is the same read-collaborative posture used across the platform (Data Entity reads, Alert reads, per-dataset DQ reads in the sibling `DataQualityController` — all cross-owner) — a maintainer made a deliberate read-vs-write asymmetric authorization choice." — evidence: `DataQualityRunsController.java:13-34` (no annotations) + `SecurityConstants.java:98-355` (the path is absent from SECURITY_RULES; verified by `grep dataqatests/runs` returning no match) + `AuthorizationCustomizer.java:29-30` (catch-all `.authenticated()`) + `ReactiveDataQualityRunsRepositoryImpl.java:65-196` (no OWNERSHIP join driven by principal) — intent_anchor: "SecurityRule(DATA_ENTITY, new PathPatternParserServerWebExchangeMatcher(\"/api/datasets/{data_entity_id}/dataqatests/{dataqa_test_id}/severity\", PUT), DATASET_TEST_RUN_SET_SEVERITY)" (`SecurityConstants.java:243-246` — a sibling DQ rule WAS registered for severity-set; the absence here is by-contrast deliberate) — confidence: HIGH

- "**The endpoint returns an envelope of THREE composed slices via parallel sub-queries — not three endpoints, not one denormalised query.** The service implementation calls all three repository methods in parallel via `Mono.zipWith(other.zipWith(yet-another))` (`DataQualityRunsServiceImpl.java:36-39`), then composes the result envelope. The decision is composition-at-the-service: rather than (a) exposing three endpoints the UI must orchestrate, or (b) building one giant CTE that emits all three slices in a single result set, the service issues three parallel queries and zips. The intent is per-slice query simplicity (each sub-query has its own CTE algebra) traded for per-request connection cost (3 sub-queries × 1 connection each, parallel). The trade-off makes sense in a reactive non-blocking context: connection acquisition is cheap, parallel I/O dominates latency, and each sub-query is independently readable / maintainable / testable." — evidence: `DataQualityRunsServiceImpl.java:36-39` (the `.zipWith(other.zipWith(...))` chain) + `ReactiveDataQualityRunsRepositoryImpl.java:64-105, 107-173, 175-196` (three distinct method implementations with non-overlapping CTE chains) — intent_anchor: "return dataQualityRunsRepository.getLatestDataQualityRunsResults(filtersDto).collectList().zipWith(dataQualityRunsRepository.getLatestTablesHealth(filtersDto).collectList().zipWith(dataQualityRunsRepository.getMonitoredTables(filtersDto).collectList()))" (`DataQualityRunsServiceImpl.java:36-39`) — confidence: HIGH

- "**Test categories are a closed enum padded with UNKNOWN as a catch-all; the response envelope is always 36 cells (6 categories × 6 statuses) regardless of data shape.** `DataQualityCategory` declares 5 named categories + `UNKNOWN` (`DataQualityCategory.java:11-17`); `resolveByName` returns UNKNOWN for any input that doesn't match a declared name (`DataQualityCategory.java:29-31`). The mapper then iterates every declared category AND every DataEntityRunStatus enum value, padding with `count=0` where absent (`DataQualityCategoryMapperImpl.java:25-30, 45-60`). The decision is to expose the schema-shape to the UI deterministically: regardless of what categories appear in the data, the UI always receives a stable 36-cell matrix and can render rings + legend entries without conditional logic. The intent is to externalise category-set evolution: adding a new category enum value (e.g. ML_DATA_QUALITY) adds a new row to the response automatically once data carries the new attribute string; the UI does NOT need a deployment to render it. This is the 'closed enum + UNKNOWN fallback + always-padded response' pattern." — evidence: `DataQualityCategory.java:11-31` (closed enum + UNKNOWN-resolve) + `DataQualityCategoryMapperImpl.java:24-43, 45-60` (padding loop) — intent_anchor: "Arrays.stream(DataQualityCategory.values()).collect(Collectors.toMap(Function.identity(), value -> new DataQualityCategoryResults().category(value.getDescription()).results(new ArrayList<>())))" (`DataQualityCategoryMapperImpl.java:24-30`) + "Arrays.stream(DataEntityRunStatus.values()).filter(value -> !existedElements.contains(value)).forEach(value -> dataQualityCategoryResults.getResults().add(new DataQualityRunStatusCount().status(value).count(0)))" (`DataQualityCategoryMapperImpl.java:51-56`) — confidence: HIGH

- "**Monitored vs Not-Monitored is scoped to TABLE-only, deliberately excluding non-Table datasets.** The CTE filter `DATA_ENTITY.TYPE_ID.eq(DataEntityTypeDto.TABLE.getId())` (`ReactiveDataQualityRunsRepositoryImpl.java:179`) restricts the monitored-tables CTE to TABLE-type entities only. The decision is to make 'monitored' a TABLE-specific concept: Views, Files, Topics, Streams (all valid 'dataset' classes per `DataEntityTypeDto`) are NOT included in either bucket. The intent is operator clarity: the dashboard's 'Monitored Tables' ring labels its slices 'Monitored / Non-Monitored Tables' explicitly (`DataQualityContent.tsx:68-72, 140`), and the doc page confirms 'The Monitored vs Unmonitored framing applies specifically to Table-type datasets' (per live doc 2026-05-25). A maintainer made the deliberate choice to scope the concept rather than counting all dataset types." — evidence: `ReactiveDataQualityRunsRepositoryImpl.java:177-179` (the TABLE.id filter) + `DataEntityTypeDto.java` (TABLE is one of several dataset sub-types) + WebFetch dashboard doc 2026-05-25 (explicit TABLE-only language) — intent_anchor: "DSL.select(DATA_ENTITY.ID, DATA_ENTITY.ODDRN).from(DATA_ENTITY).where(DATA_ENTITY.TYPE_ID.eq(DataEntityTypeDto.TABLE.getId())).asTable(DATA_ENTITY_CTE)" (`ReactiveDataQualityRunsRepositoryImpl.java:177-179`) — confidence: HIGH

## bugs_limitations_corner_cases

- "**`test_results` counts TESTS keyed on latest-run-status, not RUNS — diverges from the user-facing label and from the live documentation.** Trace: the OpenAPI operation summary says 'Get Data Quality tests runs' (`openapi.yaml:1975-1976`), the UI title chart label says 'Test Results Breakdown' (`DataQualityContent.tsx:110`), and the live doc says 'count of test runs broken down by status'. The SQL joins `DATA_ENTITY_TASK_LAST_RUN` (`ReactiveDataQualityRunsRepositoryImpl.java:76, 95`); `task_oddrn` is `PRIMARY KEY` (`V0_0_45__last_runs_table.sql:9`), guaranteeing one row per test. Concrete consequence: a test with 100 historical runs (99 SUCCESS, 1 latest FAILED) contributes 1 to FAILED bucket; the dashboard cannot distinguish 'one transient failure on a healthy test' from 'a test that fails every time it runs'. An operator triaging will see a count and assume it reflects run volume; the count actually reflects test count whose most recent execution had that status. This is the LSN-019 class transcription drift. Severity: HIGH." — evidence: `openapi.yaml:1975-1976` (operation summary) + `DataQualityContent.tsx:110` (UI label) + WebFetch dashboard doc 2026-05-25 (verbatim 'count of test runs') + `ReactiveDataQualityRunsRepositoryImpl.java:76, 95` (the join) + `V0_0_45__last_runs_table.sql:9` (PK constraint) — severity: HIGH

- "**`titleIds`/`deTitleIds` filter binds to OWNERSHIP.TITLE_ID — ownership role, not dataset title — with no UI signal of the translation.** Trace: controller params (`DataQualityRunsController.java:22, 27`) → service (`DataQualityRunsServiceImpl.java:26, 31`) → mapper (`DataQualityTestFiltersMapper.java:18, 23`) → repository SQL bind `OWNERSHIP.TITLE_ID.in(titleIds)` (`ReactiveDataQualityRunsRepositoryImpl.java:301, 309`). `OWNERSHIP.TITLE_ID` references the `TITLE` table — the ownership role assigned alongside an owner (e.g. 'Data Steward'). An operator who selects a value in the 'Title' filter expecting to narrow the dashboard to a named dataset narrows it to entities where someone holds that ownership title. This is the LSN-020 class drift. The companion `DataQualityFilters` UI sidecar records the same finding with `routes_to_finding: bugs_limitations_corner_cases[0]` — this entry is the backend confirmation. Severity: HIGH." — evidence: `DataQualityRunsController.java:22, 27` + `DataQualityRunsServiceImpl.java:26, 31` + `DataQualityTestFiltersMapper.java:18, 23` + `ReactiveDataQualityRunsRepositoryImpl.java:296-311` — severity: HIGH

- "**`namespaceIds`/`deNamespaceIds` filter silently widens the match: 'Namespace X' includes entities whose own NAMESPACE_ID is null/different but whose DATA_SOURCE.NAMESPACE_ID = X.** The SQL: `NAMESPACE.ID.in(namespaceIds).and(NAMESPACE.ID.eq(DATA_ENTITY.NAMESPACE_ID).or(NAMESPACE.ID.eq(DATA_SOURCE.NAMESPACE_ID)))` (`ReactiveDataQualityRunsRepositoryImpl.java:288-293`). Operator-visible consequence: filtering by namespace X yields a wider set than 'entities in namespace X' — every entity whose datasource is in namespace X is also included. There is no UI signal of this widening; the dashboard doc does not state it. Severity: MEDIUM." — evidence: `ReactiveDataQualityRunsRepositoryImpl.java:288-293` — severity: MEDIUM

- "**Controller has no @PreAuthorize, no SecurityRule entry; the catalog-wide DQ aggregate is visible to any authenticated user including all five filter dimensions enumerated.** No entry in `SecurityConstants.SECURITY_RULES` for `/api/dataqatests/runs` (`SecurityConstants.java:98-355` audited via grep 2026-05-25). The path falls through to `.pathMatchers('/**').authenticated()` (`AuthorizationCustomizer.java:29-30`). Downstream `ReactiveDataQualityRunsRepositoryImpl` has no owner predicate (`ReactiveDataQualityRunsRepositoryImpl.java:65-196` — every condition is filter-derived). Coherent with the read-collaborative posture (ADR-CANDIDATE-003 + REFACTOR-024); a NEW invocation site of the cross-owner enumeration family applied to the dashboard surface. Severity: MEDIUM (intentional posture; the actionable finding is the doc-side absence)." — evidence: `DataQualityRunsController.java:13-34` (no annotations) + `SecurityConstants.java:98-355` (path absent) + `AuthorizationCustomizer.java:29-30` (fallthrough) + `ReactiveDataQualityRunsRepositoryImpl.java:65-196` (no owner predicate) — severity: MEDIUM

- "**Under `auth.type=DISABLED`, the dashboard endpoint is anonymously reachable — catalog-wide DQ aggregate leaks to anyone on the network.** DISABLED is documented as dev-only; this controller (and every other) becomes anonymous in DISABLED mode because auth wiring is global, not method-level. A misconfigured production deployment exposes catalog-wide DQ data + every namespace/datasource/owner/title/tag name (via the dashboard query's filter completion path). Severity: LOW (operator misuse of dev-only mode)." — evidence: `DataQualityRunsController.java:13-34` (no method-level `@ConditionalOnProperty`) + global auth wiring via `*SecurityConfiguration` beans — severity: LOW

- "**No HTTP-level test for the controller; the controller-mapper-service-repository wiring is unverified at the HTTP boundary.** `find <odd-platform> -path '*test*' -name 'DataQualityRunsController*'` returned no files (run 2026-05-25). Repository-tier tests exist but cover only 2 of 3 sub-queries (latest-run results, monitored tables) — `getLatestTablesHealth` has no test. A regression in: WebFlux routing, OpenAPI-generated `@RequestParam` deserialisation of 10 List<Long> arrays, the three-way `Mono.zipWith` composition, content-negotiation, Jackson serialisation of the nested envelope — would silently break the dashboard with the build still green. Severity: MEDIUM." — evidence: `find <odd-platform> -path '*test*' -name 'DataQualityRunsController*'` empty (2026-05-25) + `ReactiveDataQualityRunsRepositoryTest.java:91-119` (only 2 of 3 sub-queries tested) — severity: MEDIUM

- "**Table Health computation has a subtle classification gap: a dataset whose latest runs are all SUCCESS but include a SKIPPED is classified HEALTHY; the operator may expect SKIPPED to be a 'caution' state.** The HEALTHY CTE: `NOT EXISTS last_run WHERE STATUS != SUCCESS` (`ReactiveDataQualityRunsRepositoryImpl.java:118-124`). A dataset with 10 tests where 9 latest-runs are SUCCESS and 1 is SKIPPED is classified NOT-HEALTHY (because SKIPPED != SUCCESS) but also NOT-ERROR (no BROKEN/FAILED) → WARNING. Conversely a dataset with ALL SUCCESS latest-runs IS healthy. The classification is correct per the CTE algebra; the operator-visible expectation depends on whether SKIPPED counts as 'failing'. The doc does not disclose this. Severity: LOW (correctness depends on operator-mental-model alignment, which the doc could fix)." — evidence: `ReactiveDataQualityRunsRepositoryImpl.java:111-126` (HEALTHY CTE — `STATUS notIn(SUCCESS)`) + `ReactiveDataQualityRunsRepositoryImpl.java:127-146` (ERROR CTE — STATUS in BROKEN/FAILED only) + `ReactiveDataQualityRunsRepositoryImpl.java:148-157` (WARNING CTE — fallthrough) — severity: LOW

- "**Monitored Tables CTE is restricted to TABLE-type ONLY — Views, Files, Topics are NEITHER monitored NOR not-monitored.** `DATA_ENTITY.TYPE_ID.eq(DataEntityTypeDto.TABLE.getId())` (`ReactiveDataQualityRunsRepositoryImpl.java:179`) excludes all other dataset types. The dashboard's 'Monitored Tables' ring does NOT account for them at all — they are silent absent. The doc states 'applies specifically to Table-type datasets' so this is doc-consistent. The operator confusion: a deployment with 100 Views and 0 Tables shows 0 monitored / 0 not-monitored — an empty ring, which may read as 'nothing has DQ tests' when actually 'no Tables exist'. Severity: LOW." — evidence: `ReactiveDataQualityRunsRepositoryImpl.java:177-179` + WebFetch dashboard doc 2026-05-25 (doc-consistent) — severity: LOW

- "**Filter combinations using BOTH ownerIds AND titleIds enforce same-ownership-row AND constraint — operator-surprising AND semantics across two distinct dimensions.** The combined branch at `ReactiveDataQualityRunsRepositoryImpl.java:297-302`: when both ownerIds and titleIds are non-empty, the SQL joins ONE `OWNERSHIP` row that must satisfy `OWNER_ID.in(ownerIds) AND TITLE_ID.in(titleIds)` — i.e. that single ownership entry must have both the owner AND the title. An operator selecting 'Owner: Alice' AND 'Title: Data Steward' will see ONLY datasets where Alice is specifically the Data Steward — not datasets where Alice is the owner under a different title, and not datasets where someone else is the Data Steward. The companion `DataQualityFilters` sidecar records this under the Title filter's stress_findings. Severity: LOW (the SQL is consistent; the surface labels are operator-misleading)." — evidence: `ReactiveDataQualityRunsRepositoryImpl.java:297-302` (the combined branch) vs the owner-only branch 303-306 and the title-only branch 307-311 — severity: LOW

- "**No pagination on the endpoint — though the response is bounded by the closed 36-cell category×status matrix + 2 table-health sections + 2 monitored-tables sections (~ <100 fields), there is no rate-limit / no caching / no observable.** Every UI filter change triggers this full multi-CTE query (per the companion `DataQualityFilters` sidecar's performance.hot_paths, no debounce). For a catalog with 100K data entities and a UI with 10 active operators each filtering, the endpoint runs ~10×N filter-keystrokes per second of three parallel multi-CTE queries against PostgreSQL. No `@Timed`, no Micrometer counter, no Cache-Control / ETag header. Severity: MEDIUM (not a correctness bug; an observability + caching gap)." — evidence: `DataQualityRunsController.java:13-34` (no observability annotations, no caching headers) + cross-reference `DataQualityFilters.md:performance.hot_paths` (no debounce) — severity: MEDIUM

## stress_findings

```yaml
stress_findings:
  tunables: []  # No tunables at the controller layer — no numeric literals, no @Value, no constants > 1; the only constants are static strings (CTE names, JSON path strings) in ReactiveDataQualityRunsRepositoryImpl (lines 46-60). The closed enum cardinalities (6 categories × 6 statuses) are types, not tunables.
  name_behavior_pairs:
    - name: "getDataQualityTestsRuns / GET /api/dataqatests/runs"
      promise: "Operation name and OpenAPI summary 'Get Data Quality tests runs' promise a list of test-run instances or a stream of run-level data. The path segment 'runs' reinforces this — a caller reading the endpoint URL expects to retrieve runs."
      implementation: "Returns an aggregate envelope (DataQualityResults) with three composed slices: per-category × per-status counts, table-health counts, monitored-tables counts. NO run-level data is returned — the response contains numeric cells only (`components.yaml:3748-3825`). The slices are derived from DATA_ENTITY_TASK_LAST_RUN (one row per test) — so even the underlying SQL never iterates run instances at the catalog level."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "A developer reading the OpenAPI spec or the URL pattern who expects to GET a paginated list of test-run instances (matching the per-entity DataEntityRunController shape at `/api/dataentities/{id}/runs`) receives instead a fixed-shape aggregate. The endpoint name promises detail granularity; the response delivers summary granularity. A BI tool wiring this URL hoping to enumerate runs cannot — it must enumerate per-dataset via DataEntityRunController and aggregate client-side."
      confidence: STATIC-INFERRED
      evidence: "DataQualityRunsController.java:19, openapi.yaml:1975-1977 (name + summary) vs components.yaml:3748-3825 (response shape) + ReactiveDataQualityRunsRepositoryImpl.java:91-105 (the SQL emits aggregate counts, not run rows)"
    - name: "getLatestDataQualityRunsResults / 'latest dq runs results' / response field test_results"
      promise: "The name 'LatestDataQualityRunsResults' and the OpenAPI field 'test_results' (combined with the dashboard doc's 'count of test runs broken down by status') promise count of test-run-instances grouped by category and status."
      implementation: "Counts test ENTITIES (DATA_ENTITY rows with category attribute) joined to their single DATA_ENTITY_TASK_LAST_RUN row, grouped by (category, status). Because DATA_ENTITY_TASK_LAST_RUN.task_oddrn is PRIMARY KEY (V0_0_45__last_runs_table.sql:9), every test contributes exactly one row to the count — so the count IS 'number of tests whose latest run has status X', NOT 'number of test runs with status X'."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "A test that ran 100 times with 99 SUCCESS and 1 most-recent FAILED contributes 1 to FAILED. A test that has run only once contributes 1 to whichever bucket its sole run hit. A test that flapped 50/50 over its history but most recently succeeded contributes 1 to SUCCESS. The dashboard cannot distinguish 'one transient failure on a stable test' from 'a test that fails every run'. Run-count semantics (the doc's verbatim definition) and test-count-by-latest-status semantics (the implementation) diverge significantly for any test with history > 1 run."
      confidence: STATIC-INFERRED
      evidence: "ReactiveDataQualityRunsRepositoryImpl.java:76, 95, 100 (the JOIN + GROUP BY + COUNT) + V0_0_45__last_runs_table.sql:9 (PRIMARY KEY on task_oddrn) + WebFetch https://docs.opendatadiscovery.org/features/data-quality/dashboard 2026-05-25 (verbatim 'count of test runs')"
    - name: "getLatestTablesHealth / 'tables health' / TablesHealthDashboard"
      promise: "The name 'TablesHealth' and the dashboard ring titled 'Table Health' promise classification of tables by their health status."
      implementation: "Classifies tables (datasets reached via DATA_QUALITY_TEST_RELATIONS) into HEALTHY (all latest-run statuses are SUCCESS), ERROR (any latest-run status in BROKEN/FAILED and not in healthy), WARNING (everything with a DQ test that is neither healthy nor error). The classification is mutually exclusive but only applies to datasets with at least one DQ test — datasets with NO DQ tests are silently absent from all three buckets. The dashboard doc says the three categories are 'success / failed / broken' but the implementation uses descriptive labels 'healthy / warning / error' (`TablesDashboardMapperImpl.java:9-11` + UI labels at DataQualityContent.tsx:58-62)."
      drift: MINOR
      operator_visible_consequence: "Datasets without any DQ tests do not appear in the Table Health ring — they appear only in the 'Not Monitored' slice of Monitored Tables. A maintainer reading the ring titled 'Table Health' may expect every Table-type dataset to be counted; only those WITH a DQ test are. Also: doc labels are 'success / failed / broken'; UI labels are 'healthy / warning / error'; SQL constants are GOOD_HEALTH / WARNING / ERROR — three different lexicons for the same three buckets."
      confidence: STATIC-INFERRED
      evidence: "ReactiveDataQualityRunsRepositoryImpl.java:111-157 (CTE algebra) + TablesDashboardMapper.java:9-11 (constant names) + DataQualityContent.tsx:58-62 (UI labels) + WebFetch dashboard doc 2026-05-25 (doc labels)"
    - name: "getMonitoredTables / 'monitored tables'"
      promise: "The name 'monitored tables' promises a count of tables that are being monitored vs not."
      implementation: "Counts TABLE-type data entities (only) classified by whether at least one DATA_QUALITY_TEST_RELATIONS row references the table's oddrn. Views, Files, Topics, Streams (all dataset sub-types per DataEntityTypeDto) are NOT counted in either bucket."
      drift: MINOR
      operator_visible_consequence: "A deployment with 100 Views and 0 Tables shows 0/0 in the Monitored Tables ring. The dashboard doc states the TABLE-restriction explicitly, so this is documented; but an operator who reads the ring label first and the doc second may interpret '0 monitored, 0 not-monitored' as 'no DQ tests configured anywhere' when actually the entire deployment uses Views, Files, or other non-TABLE datasets."
      confidence: STATIC-INFERRED
      evidence: "ReactiveDataQualityRunsRepositoryImpl.java:179 (the TABLE.id filter) + WebFetch dashboard doc 2026-05-25 (TABLE-only language disclosed)"
  orderings:
    - location: "ReactiveDataQualityRunsRepositoryImpl.java:101 (.orderBy(category)) + DataQualityContent.tsx:75-77 (.toSorted localeCompare category)"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer (the SQL the database executes)?"
          a: "The SQL has `.orderBy(categoriesSubTable.field(CATEGORY, String.class))` (`ReactiveDataQualityRunsRepositoryImpl.java:101`) — alphabetic ordering on the JSON-extracted category string. Categories returned in order: 'ASSERTION', 'COLUMN_VALUES_ANOMALY', 'FRESHNESS_ANOMALY', 'SCHEMA_CHANGE', 'UNKNOWN', 'VOLUME_ANOMALY' (enum names). NOTE: the mapper THEN replaces enum names with descriptions via `DataQualityCategoryMapperImpl.java:25-30` — so the response category strings are: 'Assertion Tests', 'Column Values Anomalies', 'Freshness Anomalies', 'Schema Changes', 'Unknown category', 'Volume Anomalies'. Alphabetic-by-description: same order as alphabetic-by-enum-name in this case (coincidentally — Assertion=A < Column=C < Freshness=F < Schema=S < Unknown=U < Volume=V)."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:91-101 + DataQualityCategory.java:11-23 (enum-to-description) + DataQualityCategoryMapperImpl.java:24-30"
        - q: "What is the tie-breaker when sort-key values are equal?"
          a: "Within a single category there is NO secondary sort — `groupBy(category, status)` + `orderBy(category)` (`ReactiveDataQualityRunsRepositoryImpl.java:100-101`). The status enum within each category arrives in whatever order Postgres returns. The mapper then iterates this ordered-by-category-only stream and appends to per-category buckets (`DataQualityCategoryMapperImpl.java:32-38`); padding fills missing statuses LAST (`addMissingStatuses:45-60`) — so the statuses within each category are: actual-statuses-in-DB-order first, then padded-zero statuses last."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:91-101 (no secondary sort) + DataQualityCategoryMapperImpl.java:32-38 (insertion order)"
        - q: "Which subset is returned when result-set > page size?"
          a: "No pagination on this endpoint — the response is bounded by the closed enum cardinalities (6 categories × 6 statuses padded = 36 cells, +2 table-health + 2 monitored = 40 numeric fields total). There is no LIMIT clause on any of the three sub-queries. The maximum response cardinality is therefore a constant ~40 numeric leaves regardless of catalog size."
          confidence: STATIC-INFERRED
          evidence: "DataQualityRunsController.java:18-33 (no page/size params) + openapi.yaml:1973-2087 (no page/size in spec) + ReactiveDataQualityRunsRepositoryImpl.java:65-196 (no LIMIT)"
        - q: "Does any upstream layer re-sort or filter the result?"
          a: "Yes — `DataQualityContent.tsx:75-77` does `data.testResults.toSorted(({ category: a }, { category: b }) => a.localeCompare(b))` — redundant client-side re-sort on category description. Since both the SQL ORDER BY (alphabetic on the enum-name, which happens to coincide with alphabetic on description in this case) and the client-side `localeCompare` (alphabetic on description) yield the same order, this is a no-op duplicate sort. If a future maintainer adds a new category whose description starts with a different letter from its enum name (e.g. enum-name 'A_NEW' description 'Z-Latest'), the two layers would diverge — server returns A-order, client re-sorts into Z-order."
          confidence: STATIC-INFERRED
          evidence: "DataQualityContent.tsx:75-77 (localeCompare on category description)"
  auth_gates:
    - location: "DataQualityRunsController.java:13-34 (controller class — no annotations) + SecurityConstants.java:98-355 (no rule entry)"
      endpoint: "GET /api/dataqatests/runs (getDataQualityTestsRuns)"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "DISABLED → 200 OK to anonymous callers (no auth applied globally). LOGIN_FORM → 200 OK to any authenticated user (session cookie required); per LoginFormSecurityConfiguration the path `/api/dataqatests/runs` is NOT in permittedPaths so falls through to `pathMatchers('/**').authenticated()`. OAUTH2 → 200 OK to any authenticated user (OAuth bearer token required); the AuthorizationCustomizer iterates SECURITY_RULES (none match) then applies the fallthrough `.authenticated()`. LDAP → same as OAUTH2 (LDAPSecurityConfiguration uses the same AuthorizationCustomizer)."
          confidence: STATIC-INFERRED
          evidence: "DataQualityRunsController.java:13-34 (no annotations) + SecurityConstants.java:98-355 (path absent — grep verified 2026-05-25) + AuthorizationCustomizer.java:29-30 (fallthrough) + cross-reference DataQualityController.md security section (same posture)"
        - q: "What does an unauthenticated caller see?"
          a: "Under LOGIN_FORM / OAUTH2 / LDAP: 401 Unauthorized (or 302 to login under LOGIN_FORM with Accept: text/html). Under DISABLED: 200 OK with full catalog DQ data."
          confidence: STATIC-INFERRED
          evidence: "AuthorizationCustomizer.java:29-30 (authenticated()) + DisabledAuthSecurityConfiguration (all paths permitAll)"
        - q: "What does a wrong-role caller see?"
          a: "No role gate exists; any authenticated principal succeeds. A 'READ_ONLY' role + a principal with no owner association both succeed. The endpoint returns the SAME catalog-wide aggregate regardless of caller identity — there is no principal-derived predicate in the SQL."
          confidence: STATIC-INFERRED
          evidence: "DataQualityRunsController.java:18-33 (no @PreAuthorize) + ReactiveDataQualityRunsRepositoryImpl.java:65-196 (no current-user / principal predicate in any sub-query) + the controller does not consume ServerWebExchange's authentication beyond passing it to the framework"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "Nowhere — the catch-all `.authenticated()` is the only gate. Read-collaborative posture (ADR-CANDIDATE-003 / REFACTOR-024 applied to P-04:F-002)."
          confidence: STATIC-INFERRED
          evidence: "DataQualityRunsController.java:13-34 + DataQualityRunsServiceImpl.java:14-44 (no auth checks) + ReactiveDataQualityRunsRepositoryImpl.java:43-338 (no owner predicate) + SecurityConstants.java:98-355 (no rule)"
  resource_boundaries: []  # The endpoint is read-only, no @Transactional, no synchronized, no cache, no @Async, no @Cacheable, no lock acquisition. Three parallel reactive sub-queries via Mono.zipWith — concurrent reads, no shared state mutation. Race-free, replay-safe by construction (idempotent GET).
  request_inputs:
    - location: "DataQualityRunsController.java:19 (namespaceIds parameter; openapi.yaml:1979-1988)"
      input_kind: query-param
      input_name: "namespaceIds"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "Filter test-side data entities by namespace — entities whose namespace is one of the supplied ids."
          confidence: STATIC-INFERRED
          evidence: "openapi.yaml:1979 (name: namespaceIds) + DataQualityFilters.tsx:85 (the tests-side Namespace filter feeds this param)"
        - q: "When supplied, what does the implementation USE it for?"
          a: "Trace: controller param → service.getDataQualityTestsRuns(namespaceIds, ...) (DataQualityRunsController.java:30) → DataQualityRunsServiceImpl.getDataQualityTestsRuns (DataQualityRunsServiceImpl.java:23-43) → DataQualityTestFiltersMapper.mapToDto (DataQualityTestFiltersMapper.java:14-25) wrapping into DTO → ReactiveDataQualityRunsRepositoryImpl.generateTestFiltersCte calls getConditionsForFilters(..., filtersDto.namespaceIds(), ...) (line 250-251) → joins NAMESPACE on `NAMESPACE.ID.in(namespaceIds).and(NAMESPACE.ID.eq(DATA_ENTITY.NAMESPACE_ID).or(NAMESPACE.ID.eq(DATA_SOURCE.NAMESPACE_ID)))` (line 288-293) inside the test-filter CTE."
          confidence: STATIC-INFERRED
          evidence: "DataQualityRunsController.java:30 + DataQualityRunsServiceImpl.java:34-35 + DataQualityTestFiltersMapper.java:15 + ReactiveDataQualityRunsRepositoryImpl.java:250-251, 288-293"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY — the SQL matches the entity's OWN namespace OR its DATASOURCE's namespace via OR. 'namespaceIds' promises filtering by entity-namespace; the OR-widening to datasource-inherited namespace is implicit. The companion DataQualityFilters sidecar already documents this drift; this entry confirms it at the controller layer (same SQL evidence chain)."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:291-292 (.or(NAMESPACE.ID.eq(DATA_SOURCE.NAMESPACE_ID)))"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "An operator filtering by namespace X sees MORE entities than expected: every entity whose datasource is in namespace X is included even if the entity itself has no namespace or a different one. Dashboard ring counts are wider than 'entities in namespace X' implies. For a deployment where datasources are organised by namespace but entities are scattered, the effective namespace filter is the datasource's namespace, not the entity's."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:288-293"
        - q: "Is there a column/field that DOES match the name and is NOT used? (available-but-unused)"
          a: "DATA_ENTITY.NAMESPACE_ID is the strict-match column and IS used as one half of the OR; the widening is the addition, not a substitution. Strict-match is partly honoured; the drift is over-inclusion. A fix would be to drop the OR clause."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:291 (DATA_ENTITY.NAMESPACE_ID is the first disjunct)"
      routes_to_finding: "bugs_limitations_corner_cases[2] AND docs_link_semantic.doc_drift_findings[2]"
    - location: "DataQualityRunsController.java:20 (datasourceIds parameter; openapi.yaml:1989-1998)"
      input_kind: query-param
      input_name: "datasourceIds"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "Filter test-side data entities by data source — entities whose data source is one of the supplied ids."
          confidence: STATIC-INFERRED
          evidence: "openapi.yaml:1989"
        - q: "When supplied, what does the implementation USE it for?"
          a: "Joins DATA_SOURCE on `DATA_SOURCE.ID.in(datasourceIds).and(DATA_SOURCE.ID.eq(DATA_ENTITY.DATA_SOURCE_ID))` (ReactiveDataQualityRunsRepositoryImpl.java:280-283)."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:280-283"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — datasourceIds binds to DATA_SOURCE.ID joined on DATA_ENTITY.DATA_SOURCE_ID. The name and the column align."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:280-283"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — MATCHES."
          confidence: STATIC-INFERRED
          evidence: "N/A"
        - q: "Is there a column/field that DOES match the name and is NOT used? (available-but-unused)"
          a: "NONE — DATA_SOURCE.ID is correct and used."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:282-283"
      routes_to_finding: "(no finding — MATCHES)"
    - location: "DataQualityRunsController.java:21 (ownerIds parameter; openapi.yaml:1999-2008)"
      input_kind: query-param
      input_name: "ownerIds"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "Filter test-side data entities by owner — entities owned by the supplied owner ids."
          confidence: STATIC-INFERRED
          evidence: "openapi.yaml:1999"
        - q: "When supplied, what does the implementation USE it for?"
          a: "Joins OWNERSHIP on `OWNERSHIP.OWNER_ID.in(ownerIds).and(OWNERSHIP.DATA_ENTITY_ID.eq(DATA_ENTITY.ID))` (ReactiveDataQualityRunsRepositoryImpl.java:303-306; or the combined branch 297-302 when titleIds is also present)."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:296-311"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — ownerIds binds to OWNERSHIP.OWNER_ID joined on the entity's id. Unlike LSN-020's Activity Feed `userIds`→`OWNER_ID` (where the name said 'user'), here the name IS 'owner' and the column IS OWNER_ID. CAVEAT: when both ownerIds and titleIds are supplied, the SQL puts them in ONE OWNERSHIP join with AND — see Title entry's Q4."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:297-306"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A for the name binding (MATCHES). The combined-with-Title AND-semantics is documented under the Title entry and at bugs_limitations_corner_cases[9]."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:297-302"
        - q: "Is there a column/field that DOES match the name and is NOT used? (available-but-unused)"
          a: "NONE — OWNERSHIP.OWNER_ID is correct and used."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:305"
      routes_to_finding: "(no finding — MATCHES)"
    - location: "DataQualityRunsController.java:22 (titleIds parameter; openapi.yaml:2009-2018)"
      input_kind: query-param
      input_name: "titleIds"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The bare parameter name 'titleIds' and the UI label `t('Title')` (TitleFilter.tsx:29) most plausibly read, to an operator, as 'filter by the dataset's title/name'. 'Title' is a generic word; in a data catalog it strongly suggests the human-readable name of an entity. The OpenAPI spec gives no clarifying description (openapi.yaml:2009-2018 — just an integer array, no description text)."
          confidence: STATIC-INFERRED
          evidence: "DataQualityRunsController.java:22 + openapi.yaml:2009-2018 + TitleFilter.tsx:29"
        - q: "When supplied, what does the implementation USE it for?"
          a: "Joins OWNERSHIP on `OWNERSHIP.TITLE_ID.in(titleIds)` (ReactiveDataQualityRunsRepositoryImpl.java:301 combined branch, 309 title-only branch). OWNERSHIP.TITLE_ID references the TITLE table — an ownership ROLE (e.g. 'Data Steward'). The 'Title' autocomplete options come from `useGetTitleList` (TitleFilter.tsx:4) which lists ownership titles, confirming the bound concept."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:296-311 + TitleFilter.tsx:4"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY — the parameter name 'titleIds' implies dataset title; the implementation filters by OWNERSHIP.TITLE_ID (ownership role). This is the LSN-020 class: the named input operates on a different entity than its name promises, with no OpenAPI description or UI qualifier explaining the translation."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:301, 309 + openapi.yaml:2009-2018 (no description)"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "(a) An operator (or a 3rd-party API consumer reading the OpenAPI spec without dashboard context) supplying titleIds expecting to filter by named datasets instead narrows the dashboard to entities where some owner holds that ownership role — a completely different and far wider slice. (b) When BOTH ownerIds and titleIds are supplied, the SQL puts them in ONE OWNERSHIP join with AND — result is entities where THAT owner holds THAT title only. (c) Title-only selection narrows to entities that have an ownership row with that title regardless of owner."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:297-311"
        - q: "Is there a column/field that DOES match the name and is NOT used? (available-but-unused)"
          a: "DATA_ENTITY.INTERNAL_NAME / EXTERNAL_NAME would be a literal 'Title'-as-dataset-name match; neither is used by this filter. If the intent were to filter by dataset name, the entity name columns are the available-but-unused candidates. If the intent is genuinely ownership-role filtering, the fix is a clearer parameter name ('ownershipTitleIds') and a clearer UI label ('Ownership Title' / 'Ownership Role')."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:296-311 (no DATA_ENTITY name column referenced for titleIds)"
      routes_to_finding: "bugs_limitations_corner_cases[1] AND docs_link_semantic.doc_drift_findings[1]"
    - location: "DataQualityRunsController.java:23 (tagIds parameter; openapi.yaml:2019-2028)"
      input_kind: query-param
      input_name: "tagIds"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "Filter test-side data entities by tag — entities tagged with the supplied tag ids."
          confidence: STATIC-INFERRED
          evidence: "openapi.yaml:2019"
        - q: "When supplied, what does the implementation USE it for?"
          a: "Joins TAG_TO_DATA_ENTITY on `TAG_TO_DATA_ENTITY.TAG_ID.in(tagIds).and(TAG_TO_DATA_ENTITY.DATA_ENTITY_ID.eq(DATA_ENTITY.ID))` (ReactiveDataQualityRunsRepositoryImpl.java:314-317)."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:314-317"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — tagIds binds to TAG_TO_DATA_ENTITY.TAG_ID, the tag-to-entity association table. Name and column align."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:314-317"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — MATCHES."
          confidence: STATIC-INFERRED
          evidence: "N/A"
        - q: "Is there a column/field that DOES match the name and is NOT used? (available-but-unused)"
          a: "NONE — TAG_TO_DATA_ENTITY.TAG_ID is correct and used."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:316"
      routes_to_finding: "(no finding — MATCHES)"
    - location: "DataQualityRunsController.java:24-28 (deNamespaceIds, deDatasourceIds, deOwnerIds, deTitleIds, deTagIds — five tables-side parameters; openapi.yaml:2029-2078)"
      input_kind: query-param
      input_name: "de{Namespace,Datasource,Owner,Title,Tag}Ids — five tables-side parameters batched"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The 'de' prefix in deNamespaceIds etc. is documented in the OpenAPI spec only as parameter names (no description). The companion DataQualityFilters UI sidecar establishes the convention: 'de' = 'data entity' = tables-side filters (vs unprefixed = tests-side). An operator reading the OpenAPI spec alone has no signal what 'de' means; an operator reading the UI sees 'Filters for tables' header. The promise is the same as the unprefixed counterparts but applied to the dataset/table entity instead of the test/job entity."
          confidence: STATIC-INFERRED
          evidence: "openapi.yaml:2029-2078 (no descriptions) + DataQualityFilters.tsx:61-89 (the UI section headers 'Filters for tables' / 'Filters for tests' tie the prefix to the side)"
        - q: "When supplied, what does the implementation USE it for?"
          a: "Trace: controller params (DataQualityRunsController.java:24-28) → service (DataQualityRunsServiceImpl.java:28-31) → mapper → DataQualityTestFiltersDto.de* fields → ReactiveDataQualityRunsRepositoryImpl.shouldAddFiltersForDataEntity (line 331-337) checks if any non-empty → generateDataEntityFiltersCte (line 259-269) calls getConditionsForFilters with the five de* lists → SAME getConditionsForFilters logic as the test-side filters (lines 271-321) but JOINED on different CTE. The data-entity-filter CTE filters by `DATA_ENTITY.TYPE_ID.notIn(JOB.id, JOB_RUN.id)` (line 266) — i.e. all entities EXCEPT job/job-run; in particular all dataset types (TABLE, VIEW, FILE, TOPIC, ...). The de-filter CTE is INNER JOINED to DATA_QUALITY_TEST_RELATIONS to scope the result to entities that are subjects of the DQ tests."
          confidence: STATIC-INFERRED
          evidence: "DataQualityRunsController.java:24-28 + DataQualityRunsServiceImpl.java:28-31 + DataQualityTestFiltersMapper.java:20-24 + ReactiveDataQualityRunsRepositoryImpl.java:81-89, 259-269, 271-321, 331-337"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "The 'de' prefix matches: the de* filters constrain the dataset side (the entity the DQ test covers). HOWEVER: (a) deTitleIds inherits the LSN-020 drift — OWNERSHIP.TITLE_ID, same as the unprefixed titleIds (line 301/309 are reused); (b) deNamespaceIds inherits the same OR widening to DATA_SOURCE.NAMESPACE_ID; (c) the prefix itself is undocumented in the OpenAPI spec — a 3rd-party API consumer reading the spec doesn't know that 'de' means 'dataset side'."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:271-321 (the SAME getConditionsForFilters function runs over deTitleIds → OWNERSHIP.TITLE_ID, deNamespaceIds → OR-widened) + openapi.yaml:2029-2078 (the 'de' prefix has no description)"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "(a) deTitleIds: same LSN-020 drift as titleIds — narrows to entities owned by someone with that ownership role, NOT to entities with that title-named-dataset; (b) deNamespaceIds: same widening as namespaceIds — entities whose datasource has that namespace are included; (c) for 3rd-party API consumers: the 'de' prefix is opaque in the OpenAPI spec, so a developer integrating against this endpoint who doesn't know about the UI's 'tables vs tests' distinction will guess what 'de' means. Possible misinterpretations: 'delete' / 'derived' / 'detail' / 'data engineer'."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:271-321 (Title and Namespace drifts inherited) + openapi.yaml:2029-2078 (no description)"
        - q: "Is there a column/field that DOES match the name and is NOT used? (available-but-unused)"
          a: "Same as their unprefixed counterparts: deTitleIds COULD bind to DATA_ENTITY name columns (INTERNAL_NAME / EXTERNAL_NAME) if the intent is dataset title; deNamespaceIds' OR widening could be dropped."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataQualityRunsRepositoryImpl.java:271-321"
      routes_to_finding: "bugs_limitations_corner_cases[1, 2] AND docs_link_semantic.doc_drift_findings[1, 2]"
  probes_emitted:
    - probe_id: P-156
      question: "Does test_results count TESTS (not RUNS) by their latest-run-status? Confirm the LSN-019-class drift end-to-end via REST + SQL inspection."
      probe_path: "lineage/odd-platform/probes/P-156.yaml"
    - probe_id: P-157
      question: "Under DISABLED auth mode, is GET /api/dataqatests/runs anonymously reachable? Under LOGIN_FORM/OAUTH2, is the endpoint accessible to any authenticated principal regardless of owner association — confirming the cross-owner read-collaborative posture?"
      probe_path: "lineage/odd-platform/probes/P-157.yaml"
  stress_summary:
    triggers_total: 12
    questions_total: 47
    answers_static_inferred: 47
    answers_probe_needed: 0
    answers_reference: 0
    drift_flags: 7
```

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` — the three modes that protect the `/api/*` surface this controller is mounted on. Under `DISABLED` the endpoint becomes anonymously reachable (no method-level `@ConditionalOnProperty`; auth is enforced globally via `*SecurityConfiguration` beans). `S2S` is not relevant — S2S protects `/ingestion/entities` only, not `/api/dataqatests/runs`. No SecurityRule entry exists for this path in `SecurityConstants.SECURITY_RULES` (`SecurityConstants.java:98-355` audited 2026-05-25 via grep).
- **ingestion_filter_relevance**: `NO — UI/API surface, not /ingestion/entities`. The `IngestionDataEntitiesFilter` matches `/ingestion/entities` POST only; this controller's `/api/dataqatests/runs` path does not match.
- **authorization_assertions**: [] — N/A. No `@PreAuthorize`, no programmatic `permissionService.hasPermission(...)` call, no `SecurityRule` entry. The catch-all `.pathMatchers('/**').authenticated()` in `AuthorizationCustomizer.java:29-30` is the only gate.
- **owner_scoping**:
  - "BYPASSES — returns catalog-wide DQ aggregate across all owners. The downstream `ReactiveDataQualityRunsRepositoryImpl` SQL has no owner predicate, no current-user reference, no principal-derived filter. The OWNERSHIP join appears ONLY when the caller supplies ownerIds/titleIds/deOwnerIds/deTitleIds as filter input — and even then, it filters by the supplied ids, not by the current user's owners." — evidence: `ReactiveDataQualityRunsRepositoryImpl.java:65-196` (no principal predicate in any sub-query) + `DataQualityRunsServiceImpl.java:14-44` (no Authentication injection)
- **data_exposure**:
  - "DataQualityResults envelope (test_results category×status counts + tables_health counts + monitored_tables counts) → ANY authenticated user under LOGIN_FORM/OAUTH2/LDAP via `GET /api/dataqatests/runs`" — evidence: `DataQualityRunsController.java:18-33`
  - "Same envelope → ANONYMOUS callers under `auth.type=DISABLED`" — evidence: absence of any auth annotation + DISABLED mode skips auth globally per `DisabledAuthSecurityConfiguration`
  - "Catalog-wide cardinality leakage: the response numbers reveal aggregate test counts, table counts, and DQ monitoring coverage even when no specific entity name is exposed. An attacker enumerating namespaces / datasources via the filter API can pinpoint which namespace has X failing tests vs Y healthy tables. Combined with the 5-dimensional filter completion APIs (namespaces, datasources, owners, titles, tags), an authenticated probe can map the platform's test infrastructure." — evidence: `DataQualityRunsController.java:19-29` (the 10 filter dimensions) + `ReactiveDataQualityRunsRepositoryImpl.java:65-196` (the filter algebra)
- **known_security_gaps**:
  - "No entry in `SecurityConstants.SECURITY_RULES` (`SecurityConstants.java:98-355`) and falls through to `.pathMatchers('/**').authenticated()`. Downstream SQL has no owner predicate. The live dashboard doc is silent on access control. NEW invocation site of the REFACTOR-024 cross-owner-read family applied to P-04 Data Quality dashboard." — evidence: `DataQualityRunsController.java:13-34` + `SecurityConstants.java:98-355` + `AuthorizationCustomizer.java:29-30` + `ReactiveDataQualityRunsRepositoryImpl.java:65-196` + WebFetch dashboard doc 2026-05-25 — severity: MEDIUM (intentional posture; documentation drift is the actionable finding)
  - "Under `auth.type=DISABLED`, the endpoint is anonymously reachable. DISABLED is documented as dev-only per `documentation/docs/configuration-and-deployment/enable-security/authentication.md`. A misconfigured production deployment exposes the full catalog-wide DQ aggregate to anyone on the network." — evidence: `DataQualityRunsController.java:13-34` (no method-level conditional) — severity: LOW (operator misuse of dev-only mode)
  - "Filter-dimension enumeration: a 3rd-party API consumer authenticated with any role can call this endpoint with each candidate id range (e.g. ownerIds=[1,2,3,...]) to probe which owners exist (200 with non-zero counts) vs which do not (200 with zero counts). The catalog list APIs (/api/owners, /api/namespaces, etc.) already expose names; this endpoint exposes which owners have failing tests, which namespaces have unmonitored tables — meta-information about catalog quality that could be sensitive for risk-assessment audiences." — evidence: `DataQualityRunsController.java:19-29` (the 10 filter parameters all enumerate by id) — severity: LOW

## performance

- **hot_paths**:
  - "Every UI filter change in the `/data-quality` dashboard triggers this endpoint. Per the companion `DataQualityFilters` sidecar's performance.hot_paths: no debounce on filter changes; the full multi-CTE query runs on every selection/deselection. For a UI session with 10 filter actions per minute, the endpoint runs every ~6 seconds during active triage." — evidence: cross-reference `DataQualityFilters.md:performance.hot_paths` + `DataQualityRunsController.java:18-33` (no caching annotations)
  - "Three parallel sub-queries via `Mono.zipWith` (`DataQualityRunsServiceImpl.java:36-39`) — each is a multi-CTE chain. Per-request DB cost is approximately 3 × the per-CTE cost; parallelism keeps wall-clock latency near max(per-CTE) rather than sum." — evidence: `DataQualityRunsServiceImpl.java:36-39` + `ReactiveDataQualityRunsRepositoryImpl.java:64-196`
- **throughput_characteristics**:
  - "Reactive `Mono<ResponseEntity<DataQualityResults>>` signature — non-blocking I/O; no thread is held during the DB await. The endpoint composes well with concurrent callers (each request gets its own reactive context)." — evidence: `DataQualityRunsController.java:18-33`
  - "Single GET per dashboard render; no batch / bulk variant. The full envelope is computed in one round-trip." — evidence: `DataQualityRunsController.java:18-33`
- **resource_allocation**:
  - "Response envelope size is bounded by closed enum cardinalities: 6 categories × 6 statuses (padded to 36 cells) + 3 table-health cells + 2 monitored-tables cells = ~41 numeric fields per response. Per-request JSON payload < 2 KB regardless of catalog size." — evidence: `DataQualityCategoryMapperImpl.java:24-30, 45-60` (always-padded shape) + `components.yaml:3748-3825` (response schema)
  - "DB-side cost scales with catalog size: each sub-query joins DATA_ENTITY (up to N rows for a catalog of N entities) × DATA_ENTITY_TASK_LAST_RUN (up to M rows for M tests). The latest-run CTE is bounded by the test count M; the table-health CTE iterates over DATA_QUALITY_TEST_RELATIONS-joined datasets; the monitored-tables CTE iterates over all TABLE-type entities. For a catalog of 100K entities with 10K tests, each sub-query scans tens of thousands of rows; aggregation reduces to constant cells but Postgres still expends CPU on the joins + JSONB extracts (`DATA_QUALITY_TEST_TYPE` is a `jsonb -> jsonb -> jsonb ->> 'category'` chain)." — evidence: `ReactiveDataQualityRunsRepositoryImpl.java:46-47 (the JSONB path)` + `64-196` (the multi-CTE chains)
  - "The JSONB path extract `specific_attributes->'DATA_QUALITY_TEST'->'expectation'->>'category'` is recomputed at every query — there is no functional index visible (`grep -i 'CREATE INDEX.*specific_attributes' <odd-platform>/odd-platform-api/src/main/resources/db/migration/` returned no DQ-category-specific index 2026-05-25). For a catalog with hundreds of thousands of data entities, the index absence means each query does a Seq Scan + per-row JSONB extract." — evidence: `ReactiveDataQualityRunsRepositoryImpl.java:46-47` + db/migration directory audit 2026-05-25
- **scaling_characteristics**:
  - "Stateless controller — horizontal scaling unconstrained at this layer" — evidence: `DataQualityRunsController.java:13-34` (no instance state beyond the `@RequiredArgsConstructor`-injected service)
  - "No pagination on response; response cardinality is constant by construction. The dashboard works the same for a 10-entity catalog and a 100K-entity catalog — only the DB query latency varies." — evidence: `DataQualityRunsController.java:18-33` (no page/size) + `DataQualityCategoryMapperImpl.java:45-60` (always-padded shape)
  - "No caching layer — every UI filter change does a fresh DB round-trip. No `Cache-Control`, no `ETag`, no `@Cacheable`. For a BI tool polling the dashboard at fixed intervals, each poll is a fresh 3-sub-query fan-out." — evidence: `DataQualityRunsController.java:18-33` + `DataQualityRunsServiceImpl.java:14-44`
- **known_performance_gaps**:
  - "JSONB path extract on `DATA_ENTITY.specific_attributes` is recomputed at every query without a functional index — Seq Scan + per-row extract for a catalog with hundreds of thousands of data entities. A `CREATE INDEX ... ON data_entity ((specific_attributes->'DATA_QUALITY_TEST'->'expectation'->>'category'))` would convert this to an index scan." — evidence: `ReactiveDataQualityRunsRepositoryImpl.java:46-47` + db/migration directory audit (no such index) — severity: MEDIUM
  - "No HTTP caching headers — every dashboard re-render and every BI-tool poll hits the platform fresh. For an environment with a stable test mix, an `ETag` derived from `MAX(end_time) FROM DATA_ENTITY_TASK_LAST_RUN` + filter-input-hash would enable cheap conditional GETs." — evidence: `DataQualityRunsController.java:18-33` (no header manipulation) — severity: LOW-MEDIUM
  - "No method-level observability — no `@Timed`, no Micrometer counter, no structured log on entry/exit. Latency regressions on the dashboard hot path surface only in WebFlux / DB metrics, not at the controller boundary. Per the companion DataQualityFilters sidecar's performance.hot_paths, the endpoint runs on every UI filter change with no debounce — observability would tell the maintainer how often." — evidence: `DataQualityRunsController.java:18-33` (no observability annotations) — severity: LOW
  - "No debounce / no Apply gate — the UI fires the request on every filter change (per the companion `DataQualityFilters` sidecar's bugs_limitations_corner_cases). At the backend layer there is no rate-limiting, no de-duplication of in-flight identical requests, no shared cache." — evidence: cross-reference `DataQualityFilters.md:bugs_limitations_corner_cases` + `DataQualityRunsController.java:18-33` — severity: MEDIUM

## upstream_callers

- entry_point: "ui_route:/data-quality"
  caller_node: "ts react-component:DataQualityContent (REFERENCE — sibling of DataQualityFilters, not yet enriched as a standalone sidecar)"
  multiplicity_per_trigger: "1 + N per filter-change (N = number of filter selections after mount)"
  evidence: "DataQualityContent.tsx:23-24 — `const { data, isSuccess } = useGetDataQualityDashboard(filterState);` reads filterState from filtersAtom; useGetDataQualityDashboard issues `dataQualityRunsApi.getDataQualityTestsRuns(params)` via React Query (`dataQuality.ts:74-82`). The query key includes the params, so each distinct filter state triggers a fresh fetch (no debounce). Companion DataQualityFilters sidecar records the no-debounce dispatch pattern."
  observation_class: ui-call
  unresolved: true
- entry_point: "rest:GET /api/dataqatests/runs"
  caller_node: "external 3rd-party API consumer (OpenAPI client)"
  multiplicity_per_trigger: 1
  evidence: "openapi.yaml:1973-2087 — the endpoint is part of the public OpenAPI surface (tag: dataQualityRuns); any client generated from the spec (Python, Go, Java, etc.) can call it"
  observation_class: rest-call

## downstream_side_effects

- side_effect_class: external-call
  description: "Issues 3 parallel SELECT queries to PostgreSQL: getLatestDataQualityRunsResults (multi-CTE: tests-filter + categories CTE + DATA_ENTITY_TASK_LAST_RUN join + GROUP BY), getLatestTablesHealth (4 CTEs: deOddrns + healthy + error + warning + UNION ALL), getMonitoredTables (3 CTEs: dataEntityCTE + monitored + notMonitored + UNION ALL). Total per-request DB work: 3 parallel JOOQ-generated SQL statements."
  evidence: "DataQualityRunsServiceImpl.java:36-39 + ReactiveDataQualityRunsRepositoryImpl.java:64-196"
  cardinality_per_call: 3
  reachable_from_entry_points:
    - "ui_route:/data-quality"
    - "rest:GET /api/dataqatests/runs"
- side_effect_class: page-render
  description: "Returns DataQualityResults JSON envelope (~41 numeric fields, < 2 KB body) to the caller. The UI uses this to render three DonutCharts (Table Health, Test Results Breakdown, Monitored Tables) + 6 TestCategoryResults rows."
  evidence: "DataQualityRunsController.java:32 (`.map(ResponseEntity::ok)`) + DataQualityContent.tsx:79-145 (the three rings + the per-category list)"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/data-quality"
- side_effect_class: log-emit
  description: "No structured business-event log emitted from this controller / service / repository. Only the default WebFlux access log (if enabled in application.yml) records the request. No `@Slf4j`-injected log, no audit-event, no Micrometer counter."
  evidence: "DataQualityRunsController.java:1-34 + DataQualityRunsServiceImpl.java:1-44 + ReactiveDataQualityRunsRepositoryImpl.java:1-338 (no `log.info`, `log.debug`, `auditService.emit`, `meterRegistry.counter` references in the entire trace)"
  cardinality_per_call: 0
  reachable_from_entry_points:
    - "ui_route:/data-quality"
    - "rest:GET /api/dataqatests/runs"

## sources

- understanding ← `DataQualityRunsController.java:1-34` (full file) + `DataQualityRunsServiceImpl.java:14-44` + `ReactiveDataQualityRunsRepositoryImpl.java:43-196` + `V0_0_45__last_runs_table.sql:1-25` + `openapi.yaml:1973-2087` + `SecurityConstants.java:98-355` (path-absence audit)
- concepts.entities ← `components.yaml:3748-3800, 3802-3825` (response schemas) + `DataQualityCategory.java:11-23` (enum) + `DataQualityTestFiltersDto.java:7-16` (DTO record) + `V0_0_45__last_runs_table.sql:7-13` (DATA_ENTITY_TASK_LAST_RUN table)
- concepts.operations ← `DataQualityRunsController.java:18-33` + `DataQualityRunsServiceImpl.java:22-43` + `ReactiveDataQualityRunsRepositoryImpl.java:64-196`
- concepts.invariants[0-2] ← `DataQualityRunsController.java:18-33` (single endpoint, reactive Mono) + `DataQualityRunsServiceImpl.java:36-39` (3-parallel zipWith) + `V0_0_45__last_runs_table.sql:9` (PRIMARY KEY on task_oddrn)
- concepts.invariants[3-4] ← `DataQualityCategory.java:11-31` (closed enum with UNKNOWN catch-all) + `ReactiveDataQualityRunsRepositoryImpl.java:101` (ORDER BY category) + `DataQualityContent.tsx:75-77` (UI re-sort)
- concepts.invariants[5] ← `ReactiveDataQualityRunsRepositoryImpl.java:67-73` (the test-filter CTE) + `:246-256` (generateTestFiltersCte)
- concepts.invariants[6] ← `ReactiveDataQualityRunsRepositoryImpl.java:259-269` (generateDataEntityFiltersCte; `TYPE_ID.notIn(JOB, JOB_RUN)`)
- concepts.invariants[7] ← `ReactiveDataQualityRunsRepositoryImpl.java:177-179` (TABLE.id filter on monitored-tables CTE)
- concepts.invariants[8] ← `ReactiveDataQualityRunsRepositoryImpl.java:111-157` (the three CTEs for healthy / error / warning)
- concepts.invariants[9] ← `DataQualityCategoryMapperImpl.java:24-30, 45-60` (always-pad shape)
- concepts.audiences ← WebFetch `https://docs.opendatadiscovery.org/features/data-quality/dashboard` 2026-05-25 status 200 + `App.tsx:73` (route mount inside the authenticated app shell) + `SecurityConstants.java:98-355` (no rule)
- dependencies_semantic.requires-feature ← WebFetch `https://docs.opendatadiscovery.org/features/data-quality` 2026-05-25 status 200 + `V0_0_45__last_runs_table.sql:1-25` + `ReactiveDataQualityRunsRepositoryImpl.java:82-88, 117-153, 198-220` (DATA_QUALITY_TEST_RELATIONS usage) + cross-reference `DataQualityFilters.md`
- dependencies_semantic.requires-runtime ← `DataQualityRunsController.java:1-17` + `DataQualityRunsServiceImpl.java:36-39` + `ReactiveDataQualityRunsRepositoryImpl.java:46-47` (JSONB extract — Postgres-specific)
- dependencies_semantic.couples-to ← `DataQualityRunsController.java:5, 15` (DataQualityRunsApi) + `DataQualityRunsServiceImpl.java:14-21` (service+mapper dependencies) + `ReactiveDataQualityRunsRepository.java:7-25` + `SecurityConstants.java:98-355` (NEGATIVE coupling — absence)
- tests_coverage_semantic.covered_behaviours ← `ReactiveDataQualityRunsRepositoryTest.java:91-119`
- tests_coverage_semantic.uncovered_behaviours ← `find <odd-platform> -path '*test*' -name 'DataQualityRunsController*'` empty (2026-05-25) + `ReactiveDataQualityRunsRepositoryTest.java:1-213` (only 2 of 3 sub-queries tested) + cross-reference Category F drifts in `bugs_limitations_corner_cases[1, 2]`
- tests_coverage_semantic.test_files ← `find <odd-platform> -path '*test*' -name 'DataQualityRunsController*'` (no match) + `find <odd-platform> -path '*test*' -name 'DataQualityRunsService*'` (no match) (run 2026-05-25)
- docs_link_semantic.inferred_docs ← WebFetch `https://docs.opendatadiscovery.org/features/data-quality/dashboard` 2026-05-25 status 200 + WebFetch `https://docs.opendatadiscovery.org/features/data-quality` 2026-05-25 status 200
- docs_link_semantic.doc_drift_findings[0] (LSN-019 class: count of tests vs runs) ← WebFetch dashboard doc 2026-05-25 ("count of test runs") + `ReactiveDataQualityRunsRepositoryImpl.java:76, 95` (the join) + `V0_0_45__last_runs_table.sql:9` (PK)
- docs_link_semantic.doc_drift_findings[1] (LSN-020 class: titleIds → OWNERSHIP.TITLE_ID) ← `ReactiveDataQualityRunsRepositoryImpl.java:301, 309` + `TitleFilter.tsx:29` + cross-reference `DataQualityFilters.md:doc_drift_findings[0]`
- docs_link_semantic.doc_drift_findings[2] (namespaceIds OR widening) ← `ReactiveDataQualityRunsRepositoryImpl.java:288-293` + cross-reference `DataQualityFilters.md:doc_drift_findings[1]`
- docs_link_semantic.doc_drift_findings[3] (table health rules undocumented) ← `ReactiveDataQualityRunsRepositoryImpl.java:111-157` + WebFetch dashboard doc 2026-05-25 (verbatim absence)
- docs_link_semantic.doc_drift_findings[4] (Monitored Tables TABLE-only) ← `ReactiveDataQualityRunsRepositoryImpl.java:179` + WebFetch dashboard doc 2026-05-25 (TABLE-only language IS in doc, this is operator-surprise-shaped not doc-WRONG)
- docs_link_semantic.doc_drift_findings[5] (authorization silent) ← `SecurityConstants.java:98-355` + `AuthorizationCustomizer.java:29-30` + `ReactiveDataQualityRunsRepositoryImpl.java:65-196` + WebFetch dashboard doc 2026-05-25
- implicit_adrs[0] (denormalised last-run table) ← `V0_0_45__last_runs_table.sql:7-25` + `ReactiveDataQualityRunsRepositoryImpl.java:41, 76, 95`
- implicit_adrs[1] (read-collaborative posture) ← `DataQualityRunsController.java:13-34` (no annotations) + `SecurityConstants.java:98-355` (no rule) + `AuthorizationCustomizer.java:29-30` (fallthrough) + `ReactiveDataQualityRunsRepositoryImpl.java:65-196` (no principal predicate) + cross-reference `DataQualityController.md:implicit_adrs[0]`
- implicit_adrs[2] (3-parallel zipWith composition) ← `DataQualityRunsServiceImpl.java:36-39` + `ReactiveDataQualityRunsRepositoryImpl.java:64-105, 107-173, 175-196`
- implicit_adrs[3] (closed enum + UNKNOWN + always-padded) ← `DataQualityCategory.java:11-31` + `DataQualityCategoryMapperImpl.java:24-30, 45-60`
- implicit_adrs[4] (Monitored Tables TABLE-only deliberate) ← `ReactiveDataQualityRunsRepositoryImpl.java:177-179` + WebFetch dashboard doc 2026-05-25
- bugs_limitations_corner_cases[0] (LSN-019 class — count of tests vs runs) ← `openapi.yaml:1975-1976` + `DataQualityContent.tsx:110` + WebFetch dashboard doc 2026-05-25 + `ReactiveDataQualityRunsRepositoryImpl.java:76, 95` + `V0_0_45__last_runs_table.sql:9`
- bugs_limitations_corner_cases[1] (LSN-020 class — titleIds → OWNERSHIP.TITLE_ID) ← `DataQualityRunsController.java:22, 27` + `DataQualityRunsServiceImpl.java:26, 31` + `DataQualityTestFiltersMapper.java:18, 23` + `ReactiveDataQualityRunsRepositoryImpl.java:296-311`
- bugs_limitations_corner_cases[2] (namespace OR widening) ← `ReactiveDataQualityRunsRepositoryImpl.java:288-293`
- bugs_limitations_corner_cases[3] (no @PreAuthorize, cross-owner) ← `DataQualityRunsController.java:13-34` + `SecurityConstants.java:98-355` + `AuthorizationCustomizer.java:29-30` + `ReactiveDataQualityRunsRepositoryImpl.java:65-196`
- bugs_limitations_corner_cases[4] (DISABLED anonymous) ← `DataQualityRunsController.java:13-34` (no method-level conditional)
- bugs_limitations_corner_cases[5] (no HTTP-level test) ← find empty (2026-05-25) + `ReactiveDataQualityRunsRepositoryTest.java:91-119`
- bugs_limitations_corner_cases[6] (table health SKIPPED ambiguity) ← `ReactiveDataQualityRunsRepositoryImpl.java:118-124, 127-146, 148-157`
- bugs_limitations_corner_cases[7] (Monitored TABLE-only) ← `ReactiveDataQualityRunsRepositoryImpl.java:177-179`
- bugs_limitations_corner_cases[8] (combined owner+title AND) ← `ReactiveDataQualityRunsRepositoryImpl.java:297-302`
- bugs_limitations_corner_cases[9] (no observability / caching) ← `DataQualityRunsController.java:13-34` + cross-reference `DataQualityFilters.md:performance.hot_paths`
- security.auth_mode_relevance ← `DataQualityRunsController.java:13-34` + `SecurityConstants.java:98-355` (grep verified 2026-05-25)
- security.owner_scoping ← `ReactiveDataQualityRunsRepositoryImpl.java:65-196` + `DataQualityRunsServiceImpl.java:14-44`
- security.known_security_gaps ← `DataQualityRunsController.java:13-34` + `SecurityConstants.java:98-355` + `AuthorizationCustomizer.java:29-30` + `ReactiveDataQualityRunsRepositoryImpl.java:65-196` + WebFetch dashboard doc 2026-05-25
- performance.hot_paths ← cross-reference `DataQualityFilters.md:performance.hot_paths` + `DataQualityRunsServiceImpl.java:36-39`
- performance.resource_allocation ← `ReactiveDataQualityRunsRepositoryImpl.java:46-47` (JSONB path) + db/migration directory audit 2026-05-25
- performance.known_performance_gaps ← `ReactiveDataQualityRunsRepositoryImpl.java:46-47` + `DataQualityRunsController.java:18-33` (no caching/observability)
- upstream_callers ← `DataQualityContent.tsx:23-24` + `dataQuality.ts:74-82` + `openapi.yaml:1973-2087`
- downstream_side_effects ← `DataQualityRunsServiceImpl.java:36-39` + `ReactiveDataQualityRunsRepositoryImpl.java:64-196` + `DataQualityRunsController.java:32`

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: MEDIUM
- upstream_callers: MEDIUM
- downstream_side_effects: HIGH
- stress_findings: HIGH

(`performance` is MEDIUM: the JSONB-no-index claim is static-inferred from a directory audit; the actual query plan and timing on a real-sized catalog would require a probe — but the absence of a functional index is verifiable from the migration files. `upstream_callers` is MEDIUM because `DataQualityContent` is an `unresolved: true` REFERENCE — it is the immediate UI caller but not yet enriched as its own sidecar. `confidence_overall` is MEDIUM because of the upstream-caller resolution gap, NOT because of the stress findings — every load-bearing stress claim is STATIC-INFERRED with strong SQL+schema evidence. The two emitted probes are confirmatory, not load-bearing for the analysis already done.)

## Maintainer notes

(none — fresh node)

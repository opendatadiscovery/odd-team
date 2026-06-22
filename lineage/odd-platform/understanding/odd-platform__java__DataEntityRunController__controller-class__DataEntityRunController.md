---
node_id: "odd-platform java DataEntityRunController controller-class:DataEntityRunController"
node_kind: controller-class
axis: controllers
extracted_at_commit: 4ec2b20
enriched_at_commit: 4ec2b20
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
schema_version: 0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-25-ZG
related_features:
  - F-022  # P-04:F-001 Per-Dataset Data Quality Test Reports & SLA — companion read surface (per-dataset aggregate); /runs is the per-test run-history complement
related_pillar_features:
  - "P-04:F-001"  # Test Results Import — produces the data this controller reads
  - "P-04:F-002"  # Quality Dashboard — sibling read surface (aggregate); /runs is per-test detail
related_refactors:
  - REFACTOR-024  # cross-owner-read family — runs-history is a NEW invocation site of the same posture (5th site in the DQ family after the 4 DataQualityController GETs)
related_adr_candidates:
  - ADR-CANDIDATE-003  # read-collaborative-catalog posture (cross-owner read is intentional vs accidental)
  - ADR-CANDIDATE-114  # read-cardinality split — per-entity reads unscoped, batch reads owner-scoped except listAll
related_concepts:
  - data-entity-run-status
  - data-quality-test
  - data-transformer
  - task-run
  - read-collaborative-catalog-posture
---

# DataEntityRunController — semantic understanding

## understanding

`DataEntityRunController` is the per-data-entity run-history HTTP entry point — a thin `@RestController` implementing the OpenAPI-generated `DataEntityRunApi` interface, exposing ONE GET endpoint `GET /api/dataentities/{data_entity_id}/runs` that returns a paginated `DataEntityRunList` of past executions for either a Data Quality Test or a Data Transformer (`DataEntityRunController.java:13-28`, `openapi.yaml:1363-1386`). The controller delegates to `DataEntityRunService.getDataEntityRuns(...)` which (i) loads the data entity, 404-ing if absent, (ii) rejects the request with `BadUserRequestException` if the entity's class is neither `DATA_TRANSFORMER` (2) nor `DATA_QUALITY_TEST` (4) (`DataEntityRunServiceImpl.java:32-44`), and (iii) reads the run records from `data_entity_task_run` ORDERED BY `end_time DESC` via the JOOQ paginate helper (`ReactiveDataEntityTaskRunRepositoryImpl.java:176-182`). The endpoint is NOT listed in `SecurityConstants.SECURITY_RULES` — it falls through to `.pathMatchers("/**").authenticated()` (`AuthorizationCustomizer.java:29-30`), so any authenticated user can read any data entity's run history regardless of ownership: a NEW invocation site of the read-collaborative-catalog posture observed at the four DataQualityController GETs (REFACTOR-024 family). The UI mounts this endpoint at two sites — the dedicated `/dataentities/{id}/history` route (page-size 100, infinite scroll, status-filter dropdown — `TestRunsHistory.tsx:24-122`) and the test-report-details first-10-runs preview (`TestReportDetailsHistory.tsx:30-32`).

## concepts

- entities: [
    "DataEntityRunList — paginated list-of-DataEntityRun wrapper with `items[]` + `pageInfo{total, hasNext}` (`DataEntityRunController.java:5, 19`, `components.yaml:1037-1048`)",
    "DataEntityRun — a single execution record: data_entity_id + start_time + end_time + status_reason + status (`components.yaml:960-980`); the wire-side projection of `data_entity_task_run` rows joined to their parent entity",
    "DataEntityRunStatus — six-value wire enum SUCCESS | FAILED | SKIPPED | BROKEN | ABORTED | UNKNOWN (`components.yaml:1407-1415`); DOES NOT contain RUNNING (asymmetry with the DB-side IngestionTaskRunStatus seven-value enum at `IngestionTaskRun.java:28-36`)",
    "data_entity_task_run row — the underlying DB record produced by the ingestion pipeline (TaskRunIngestionRequestProcessor) and queried by this controller; columns oddrn, task_oddrn, name, start_time, end_time, status, status_reason, type"
  ]
- operations: [
    "list-runs-for-dq-test-or-transformer (`getRuns`, GET `/api/dataentities/{data_entity_id}/runs`) — the lone op on this controller"
  ]
- invariants: [
    "Reactive signature — returns `Mono<ResponseEntity<DataEntityRunList>>`; success always emits `200 OK` via `.map(ResponseEntity::ok)` (`DataEntityRunController.java:18-27`)",
    "Path variable name vs method-parameter name: OpenAPI `data_entity_id` → Java `dataEntityId` (`DataEntityRunController.java:19`)",
    "Entity-class gate — the service throws `BadUserRequestException` (400) if the entity is neither DATA_TRANSFORMER (class id 2) nor DATA_QUALITY_TEST (class id 4) (`DataEntityRunServiceImpl.java:32-44`); the test-result-run class ids 3 (DATA_TRANSFORMER_RUN) and 5 (DATA_QUALITY_TEST_RUN) are NOT accepted — only the parent jobs",
    "404 on missing entity — `dataEntityRepository.get(dataEntityId).switchIfEmpty(NotFoundException(\"Data entity\", id))` (`DataEntityRunServiceImpl.java:32-34`)",
    "SQL ordering — `paginate(..., DATA_ENTITY_TASK_RUN.END_TIME, SortOrder.DESC, ...)` produces an outer `ORDER BY end_time DESC` with NO tie-breaker, NO NULLS-FIRST/LAST directive (`ReactiveDataEntityTaskRunRepositoryImpl.java:176-182`, `JooqQueryHelper.java:55-90`)",
    "Status filter — when `status` query param is supplied, applies `DATA_ENTITY_TASK_RUN.STATUS.eq(status.name())` to the SQL `WHERE` (`ReactiveDataEntityTaskRunRepositoryImpl.java:166-168`); null `status` returns ALL run rows (including RUNNING ones whose status is not in the wire enum)",
    "Pagination contract — page index is 1-based; offset = `(page - 1) * size` (`ReactiveDataEntityTaskRunRepositoryImpl.java:180`); no upper bound on `size` (OpenAPI spec declares it required int32 with no min/max — `components.yaml:4222-4229`)"
  ]
- audiences: [
    "data-quality-engineer — opens a DQ test's `/history` tab to inspect past run timeline and failure reasons (the dedicated UI surface at `DataEntityDetailsRoutes.tsx:85-94`)",
    "data-engineer-analyst — uses the test-report-details preview (first 10 runs) to glance recent execution outcomes (`TestReportDetailsHistory.tsx:30-32`)",
    "any authenticated platform user — read posture is cross-owner; no owner-scoping gate prevents read across the catalog (see security section)"
  ]

## dependencies_semantic

- requires-feature: [
    "Data Quality Test ingestion pipeline — the upstream IngestionService + TaskRunIngestionRequestProcessor populate `data_entity_task_run` rows that this controller surfaces (see sidecar `odd-platform__java__service__service__IngestionService.md` lines 55: `TaskRunIngestionRequestProcessor` bulk-INSERT/UPDATE into `data_entity_task_run` + `last_runs`)",
    "Data Transformer ingestion — DATA_TRANSFORMER_RUN entity-class items routed through the same JOB_RUN ingestion path (`IngestionServiceImpl.java:84-91`)",
    "Data Entity catalog — `ReactiveDataEntityRepository.get(id)` must resolve the entity before the runs query fires (`DataEntityRunServiceImpl.java:32`)"
  ]
- requires-config: [] — N/A. This controller declares no `@ConditionalOnProperty`, no `@Value`, no `@ConfigurationProperties` dependency; auth wiring is global via the three `*SecurityConfiguration` beans, not local to this controller.
- requires-runtime: [
    "Spring WebFlux — `@RestController` + `Mono<ResponseEntity<T>>` + `ServerWebExchange` (`DataEntityRunController.java:8-11, 13`)",
    "Reactor Core — `Mono.map` composition (`DataEntityRunController.java:24-26`)",
    "jOOQ reactive DB session — `JooqReactiveOperations` runs the paginated query against PostgreSQL (`ReactiveDataEntityTaskRunRepositoryImpl.java:41, 184-190`)",
    "MapStruct — `DataEntityRunMapper` flat-maps `DataEntityTaskRunPojo` → `DataEntityRun` (`DataEntityRunMapper.java:12-25`)"
  ]
- couples-to: [
    "`DataEntityRunApi` (OpenAPI-generated interface) — supplies `@RequestMapping`, content-type, parameter validation, and the operation id `getRuns` (`openapi.yaml:1363-1386`)",
    "`DataEntityRunService` interface — sole downstream dependency (`DataEntityRunController.java:7, 16, 24`); concrete impl `DataEntityRunServiceImpl` injects `ReactiveDataEntityTaskRunRepository`, `ReactiveDataEntityRepository`, `DataEntityRunMapper` (`DataEntityRunServiceImpl.java:23-25`)",
    "`SecurityConstants.SECURITY_RULES` — NO entry for `/api/dataentities/{data_entity_id}/runs` (verified: grep over SecurityConstants.java:98-355 returns zero matches for `/runs`); falls through to the AuthorizationCustomizer catch-all `.pathMatchers(\"/**\").authenticated()` (`AuthorizationCustomizer.java:29-30`)"
  ]

## tests_coverage_semantic

- covered_behaviours:
  - behaviour: "Ordering — `getDataEntityRuns(...)` returns rows sorted by end_time DESC; verified with 10 SUCCESS/BROKEN/ABORTED/UNKNOWN/RUNNING runs across two pages of size 5 (`DataEntityRunRepositoryImplTest.java:34-79`)"
    test_class: integration
    test_files: ["odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/DataEntityRunRepositoryImplTest.java:57-79"]
  - behaviour: "Pagination — page 1 size 5 returns hasNext=true total=10; page 2 size 5 returns hasNext=false (`DataEntityRunRepositoryImplTest.java:65-79`)"
    test_class: integration
    test_files: ["odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/DataEntityRunRepositoryImplTest.java:65-79"]
  - behaviour: "Status filter — `status=SUCCESS` returns only 5 SUCCESS rows out of 10 mixed; hasNext=false; ordering preserved (`DataEntityRunRepositoryImplTest.java:81-93`)"
    test_class: integration
    test_files: ["odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/DataEntityRunRepositoryImplTest.java:81-93"]
- uncovered_behaviours:
  - behaviour: "Controller-level test — there is NO test exercising the controller's HTTP boundary; only the repository is covered. The 404 path (data entity does not exist), 400 path (entity class is not transformer/quality-test), 200-with-empty-list path, and the cross-mapper failure case (RUNNING status row hitting `DataEntityRunStatus` enum) all need controller-level WebFlux tests"
    test_class: integration
    criticality: HIGH
    note: "the entity-class gate at DataEntityRunServiceImpl.java:35-37 produces an operator-facing 400 with a sentence that requires verification at the wire"
  - behaviour: "RUNNING status row in result set — DB column accepts `RUNNING` (`IngestionTaskRunStatus.java:34`); wire enum `DataEntityRunStatus` does NOT contain RUNNING. The mapper at `DataEntityRunMapper.java:13-14` flat-maps the String `status` field into the wire enum target; MapStruct's `Enum.valueOf()` strategy throws `IllegalArgumentException` on unknown literals — but there's no integration test asserting whether the operator sees 500 or some softer fallback"
    test_class: integration
    criticality: HIGH
    note: "RESOLVED 2026-06-19 (PR #1793 / PLT-021 / CTRIB-024) — NOW COVERED. RUNNING is a wire-enum value and the mapper degrades unmapped statuses to UNKNOWN; the endpoint returns 200 (was 500). Covered by DataEntityRunMapperImplTest.mapDataEntityRuns_runningStatus_mapsToRunning + ...unmappableStatus_degradesToUnknownNotThrow (unit), DataEntityRunRepositoryImplTest in-flight ordering (Testcontainers), and odd-team IT-059 dq-run-history (API 200 + RUNNING-at-top + status filter + browser badge; RED on ref:main). P-151 retired (superseded by IT-059). [maintainer-annotated 2026-06-22; full /enrich re-derivation pending]"
  - behaviour: "NULL end_time ordering — what does the operator see when a RUNNING task (end_time=null) co-exists with completed runs? Postgres default for `ORDER BY end_time DESC` is NULLS FIRST; the UI labels each row by `startTime` (`TestRunItem.tsx:30`). No test asserts the head-of-list behaviour"
    test_class: integration
    criticality: MEDIUM
    note: "see P-150"
  - behaviour: "Tie-breaker on identical end_time — when two completed runs share end_time, ordering between them is implementation-defined. The InfiniteScroll consumer (TestRunsHistory.tsx:90-113) accumulates pages; ties may duplicate or skip across page boundaries"
    test_class: integration
    criticality: MEDIUM
    note: "see P-150"
  - behaviour: "Cross-owner-read posture — bob (non-owner) can read alice's DQ-test run history including status_reason text"
    test_class: security
    criticality: HIGH
    note: "see P-152; status_reason commonly carries diagnostic detail (failed-row samples) populated by Great Expectations / dbt / custom frameworks"
  - behaviour: "Page-size unbounded — OpenAPI `SizeParam` has no max constraint (`components.yaml:4222-4229`); the UI ships size=100 (`TestRunsHistory.tsx:27`) and size=10 (`TestReportDetailsHistory.tsx:31`). An attacker / curious operator can request size=1000000 and exhaust memory"
    test_class: performance
    criticality: MEDIUM
    note: "no test asserts a server-side cap; the operator may DoS the runs endpoint with a single large page request"
- test_files:
  - "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/DataEntityRunRepositoryImplTest.java"
- gaps: |
    The repository ordering / status filter / pagination is well-covered at the integration layer; the controller is NOT. The two highest-leverage uncovered gaps are (a) the RUNNING-status-mapper-failure path (P-151 hypothesis: HTTP 500 silently kills the page while a test is in flight — the moment the operator most wants to see the page) and (b) the cross-owner-read posture (P-152 hypothesis: any logged-in user reads any DQ test's diagnostic stream including PII-bearing status_reason text). Both are security/availability concerns that would not surface in the existing integration test (which only exercises the repository SQL).

## docs_link_semantic

- declared_docs: [] — N/A. No `@docs` annotation in `DataEntityRunController.java`; no other source-side annotation pointing to a canonical doc page.
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-quality"
    anchor: null
    rationale: "The endpoint exposes Data Quality test run history; this is the pillar's landing page"
    last_verified_at: "2026-05-25T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
  - url: "https://docs.opendatadiscovery.org/features/data-quality/test-results"
    anchor: null
    rationale: "Plausible canonical URL for a runs-history doc — does not exist"
    last_verified_at: "2026-05-25T00:00:00Z"
    last_verified_status: 404
    confidence: LOW
  - url: "https://docs.opendatadiscovery.org/features/data-quality/test-results-import"
    anchor: null
    rationale: "Adjacent page covering the ingestion side; does not document the read-side runs-history endpoint"
    last_verified_at: "2026-05-25T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
- doc_drift_findings:
  - "DOC GAP: the per-data-entity runs-history endpoint `GET /api/dataentities/{id}/runs` is NOT documented anywhere on `docs.opendatadiscovery.org`. WebFetch of `/features/data-quality` (2026-05-25 status 200) returned no content covering the runs UI / endpoint / pagination / status filter; WebFetch of `/features/data-quality/test-results` returned 404; WebFetch of `/features/data-quality/test-results-import` (status 200) documents the INGESTION side but not the runs-history READ side. Operator opening the `/history` tab on a DQ-test details page has no documentation to refer to: the size=100 page-size, the end_time-DESC ordering, the RUNNING-state behaviour, and the cross-owner-read posture are all undocumented."
  - "DOC GAP: the six-value wire enum `DataEntityRunStatus` (components.yaml:1407-1415) is not listed on the data-quality doc page; the dashboard.md doc mentions 'passed / failed / skipped' (three values per the data-entity-run-status concept-index entry at concepts/index.yaml:664) — operator has no source for the full BROKEN / ABORTED / UNKNOWN set."
  - "DOC GAP: status_reason is a free-form diagnostic field surfaced verbatim to the UI (TestRunStatusReasonModal); not documented as such. Operators integrating ODD with frameworks that put rich diagnostic detail in status_reason (Great Expectations, dbt) have no warning that the text is rendered with no redaction and visible to any authenticated user across the catalog."

## implicit_adrs

- "Entity-class gate at the SERVICE tier, not the controller — `checkIfDeClassSupposedToHaveRuns()` rejects non-transformer / non-quality-test data entities with `BadUserRequestException` (400) at the service level (`DataEntityRunServiceImpl.java:35-44`)." — evidence: DataEntityRunServiceImpl.java:35-44 — intent_anchor: "throw new BadUserRequestException(\"Data entity with id %d is not supposed to have runs due to its class\".formatted(dataEntityId))" — confidence: HIGH
- "Run ordering is intentionally by `end_time DESC` (not by `start_time`, not by `id`, not by `created_at`) — chosen at the JOOQ paginate call site (`ReactiveDataEntityTaskRunRepositoryImpl.java:176-182`). The choice prioritises 'most-recently-completed run first' over 'most-recently-started run first', and the repository integration test EXPLICITLY asserts this with `DataEntityTaskRunPojoEndTimeComparator` (`DataEntityRunRepositoryImplTest.java:22-23, 62`)." — evidence: ReactiveDataEntityTaskRunRepositoryImpl.java:178, DataEntityRunRepositoryImplTest.java:22-23 — intent_anchor: "private final Comparator<DataEntityTaskRunPojo> endTimeComparator = new DataEntityTaskRunPojoEndTimeComparator().reversed();" — confidence: HIGH
- "Reactive `Mono` chain with no `onErrorResume` — the controller propagates mapper / SQL exceptions verbatim to Spring's default error handler (`DataEntityRunController.java:24-26`, `DataEntityRunServiceImpl.java:32-39`). The convention across all controllers in the repo: NotFoundException and BadUserRequestException carry HTTP semantics resolved by the global exception handler; the controller class itself stays thin." — evidence: DataEntityRunController.java:24-26 — intent_anchor: ".map(ResponseEntity::ok)" — confidence: MEDIUM

## bugs_limitations_corner_cases

- "Page-size unbounded — `OpenAPI SizeParam` has no min/max constraint (components.yaml:4222-4229); the controller's `Integer size` parameter is passed through verbatim to the SQL `LIMIT`. A request with size=1000000 will attempt to materialise a million rows in memory through the JOOQ paginate window-function plan + jOOQ result mapping + MapStruct + Jackson serialisation. No bounds-check anywhere in the chain." — evidence: DataEntityRunController.java:19-26, ReactiveDataEntityTaskRunRepositoryImpl.java:180-181 — severity: MEDIUM
- "Wire enum vs DB enum asymmetry — DB column `data_entity_task_run.status` accepts the seven-value `IngestionTaskRunStatus` enum (SUCCESS|FAILED|SKIPPED|BROKEN|ABORTED|RUNNING|UNKNOWN, IngestionTaskRun.java:28-36) but the wire enum `DataEntityRunStatus` declares only six values (RUNNING is missing, components.yaml:1407-1415). The DataEntityRunMapper flat-maps the String → wire enum target; MapStruct's String-to-enum conversion uses `Enum.valueOf()` which throws on unknown literals. Hypothesis: the runs-history endpoint returns HTTP 500 for any result set containing a RUNNING row — making the page UNAVAILABLE exactly while a test is in flight." — evidence: IngestionTaskRun.java:28-36, components.yaml:1407-1415, DataEntityRunMapper.java:13-14, MapperConfig.java:7-13 — severity: HIGH
- "NULL end_time ordering not specified — when a row has `end_time = NULL` (RUNNING task), the JOOQ paginate emits `ORDER BY end_time DESC` with no `NULLS FIRST/LAST` directive (ReactiveDataEntityTaskRunRepositoryImpl.java:178, JooqQueryHelper.java:74-89). Postgres default for DESC is NULLS FIRST, so RUNNING rows appear AT THE TOP of the runs list. The UI labels each row by `startTime` (TestRunItem.tsx:30) with an empty Duration column when endTime is null (TestRunItem.tsx:53-57); operator sees an undated-looking row first, with no visual signal that it represents an in-flight test." — evidence: ReactiveDataEntityTaskRunRepositoryImpl.java:176-182, JooqQueryHelper.java:55-90, TestRunItem.tsx:25-60 — severity: MEDIUM
- "No tie-breaker on identical end_time — when two completed runs share `end_time`, ordering between them is Postgres physical-storage-defined. The InfiniteScroll consumer (TestRunsHistory.tsx:90-113) appends successive pages via independent SQL invocations; if a tie splits across the page boundary differently on each fetch, the operator sees duplicated or skipped rows in the rendered list." — evidence: ReactiveDataEntityTaskRunRepositoryImpl.java:176-182, TestRunsHistory.tsx:88-113 — severity: LOW
- "UI sort key (start_time) ≠ backend sort key (end_time) — the operator looking at the runs list sees `startTime` rendered in the leftmost column (TestRunsHistory.tsx:75-77, TestRunItem.tsx:30) and naturally expects ordering by that column. Backend orders by end_time. For typical completed runs the two are correlated (end ~ start + duration); for long-running tests the divergence is operator-visible (a slow run started yesterday may appear ABOVE a fast run started today)." — evidence: ReactiveDataEntityTaskRunRepositoryImpl.java:178, TestRunsHistory.tsx:74-87, TestRunItem.tsx:25-32 — severity: LOW
- "Endpoint is NOT in SecurityConstants.SECURITY_RULES — no permission gate; the AuthorizationCustomizer catch-all `.pathMatchers(\"/**\").authenticated()` is the only filter (AuthorizationCustomizer.java:29-30, SecurityConstants.java:98-355 — verified: zero hits on `/runs` in the rule table). Any authenticated user can read any DQ test's or transformer's run history across the whole catalog. status_reason is a free-form text field set by the test framework (Great Expectations / dbt / custom) and commonly contains failed-row diagnostics — a non-owner gets a data-quality-diagnostic leak channel via this surface." — evidence: SecurityConstants.java:98-355, AuthorizationCustomizer.java:29-30 — severity: HIGH
- "Entity-class gate accepts only parent classes (DATA_TRANSFORMER=2, DATA_QUALITY_TEST=4) and rejects the RUN classes (DATA_TRANSFORMER_RUN=3, DATA_QUALITY_TEST_RUN=5) (DataEntityRunServiceImpl.java:42-45, DataEntityClassDto.java:44-47). The error message reads `\"Data entity with id %d is not supposed to have runs due to its class\"` — operator hitting this on a JOB_RUN entity sees a generic message with no hint that they should look up the parent JOB / DQ TEST instead." — evidence: DataEntityRunServiceImpl.java:42-45 — severity: LOW
- "No `existsIncludingSoftDeleted` — the read path uses `dataEntityRepository.get(id)` which (per the soft-delete convention captured in batch-T's DataQualityController sidecar) does NOT include soft-deleted entities. A DQ test whose status is `DELETED` cannot have its run history viewed for forensic purposes — inconsistent with DataQualityController's deliberate forensic-coverage preservation." — evidence: DataEntityRunServiceImpl.java:32, comparison with DataQualityServiceImpl.java:55-58 (existsIncludingSoftDeleted convention) — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "TestRunsHistory.tsx:27"
      name: "pageSize"
      value: "100"
      questions:
        - q: "What at N > tunable (operator with >100 runs)?"
          a: "InfiniteScroll fetches page 2 via fetchPage(pageInfo.page + 1) — backend serves the next 100 ordered by end_time DESC. No upper bound; the operator scrolls through all history."
          confidence: STATIC-INFERRED
          evidence: "TestRunsHistory.tsx:43-52, 88-113; ReactiveDataEntityTaskRunRepositoryImpl.java:180-181"
        - q: "What at tunable × 100 (i.e. operator manually crafts size=10000)?"
          a: "PROBE-NEEDED — OpenAPI SizeParam has no max; backend has no cap; the LIMIT 10000 query attempts to materialise 10K rows."
          confidence: PROBE-NEEDED
          evidence: "P-150 partial coverage (size=100 in arrange); a dedicated DoS probe would be its own skeleton"
        - q: "What does the operator see at each boundary?"
          a: "At N ≤ 100, single page renders fully; at N > 100, infinite-scroll triggers; at size=very-large, response latency spikes and may OOM the API tier."
          confidence: PROBE-NEEDED
          evidence: "no integration test exercises the upper-bound path"
    - location: "TestReportDetailsHistory.tsx:31"
      name: "size"
      value: "10"
      questions:
        - q: "What at N = 0?"
          a: "Empty items[] returned; pageInfo.total=0; pageInfo.hasNext=false. The preview shows the EmptyContentPlaceholder branch."
          confidence: STATIC-INFERRED
          evidence: "JooqQueryHelper.java:92-105 (pageifyResult emptyList branch), TestReportDetailsHistory.tsx:33-72 (renders only if list has items)"
        - q: "What at N > 10 (more than 10 runs exist for the entity)?"
          a: "Only the most-recent 10 by end_time DESC are returned; the preview is a fixed-10 strip with no 'see more' affordance. The user must navigate to /history (TestRunsHistory) for the full list."
          confidence: STATIC-INFERRED
          evidence: "TestReportDetailsHistory.tsx:30-32; no pagination in this UI"
        - q: "What does the operator see at each boundary?"
          a: "0 runs: empty preview block. >10 runs: top 10 visible — no indication that more exist (no '+N more' badge)."
          confidence: STATIC-INFERRED
          evidence: "TestReportDetailsHistory.tsx:34-72"
  name_behavior_pairs:
    - name: "getRuns"
      promise: "OpenAPI summary: 'Get runs for DataTransformer or DataQualityTest' (openapi.yaml:1365-1366); the operation returns the run history for the named entity."
      implementation: "Controller -> DataEntityRunService.getDataEntityRuns(...) -> ReactiveDataEntityTaskRunRepository.getDataEntityRuns(...) -> JOOQ chain ORDER BY end_time DESC, LIMIT/OFFSET pagination, optional status filter. Returns Page<DataEntityTaskRunPojo> mapped to DataEntityRunList."
      drift: MINOR
      operator_visible_consequence: "Name does NOT promise ordering by end_time; the SQL chooses end_time over start_time / id / created_at. The UI displays the start_time column, creating a display-key vs sort-key mismatch. For long-running tests the ordering may surprise (a run STARTED yesterday but ENDED today appears above a run STARTED + ENDED earlier today)."
      confidence: STATIC-INFERRED
      evidence: "ReactiveDataEntityTaskRunRepositoryImpl.java:176-182, TestRunsHistory.tsx:74-87, TestRunItem.tsx:25-32"
    - name: "checkIfDeClassSupposedToHaveRuns"
      promise: "Method name promises a binary 'does this entity class have runs at all' check."
      implementation: "Accepts DATA_TRANSFORMER (2) OR DATA_QUALITY_TEST (4); rejects everything else including DATA_TRANSFORMER_RUN (3) and DATA_QUALITY_TEST_RUN (5). Returns boolean; caller throws BadUserRequestException on false."
      drift: NONE
      operator_visible_consequence: "n/a — implementation matches the gate spirit. Caveat: the error message is generic ('not supposed to have runs due to its class') without telling the operator which classes ARE supported — UX gap, not a behaviour drift."
      confidence: STATIC-INFERRED
      evidence: "DataEntityRunServiceImpl.java:35-45, DataEntityClassDto.java:44-47"
  orderings:
    - location: "ReactiveDataEntityTaskRunRepositoryImpl.java:176-182"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer?"
          a: "Outer SELECT emits `ORDER BY end_time DESC` (single field, no tie-breaker, no NULLS-FIRST/LAST directive). Postgres default for DESC is NULLS FIRST, meaning NULL end_time rows (RUNNING tasks) appear AT THE TOP."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityTaskRunRepositoryImpl.java:176-182, JooqQueryHelper.java:74-89"
        - q: "What is the tie-breaker when sort-key values are equal?"
          a: "PROBE-NEEDED. No tie-breaker is declared; Postgres returns rows in physical-storage / heap order, which is implementation-defined and non-deterministic across vacuum / reindex events."
          confidence: PROBE-NEEDED
          evidence: "P-150"
        - q: "Which subset is returned when result-set > page size?"
          a: "OFFSET = (page-1) * size, LIMIT = size — returns the top-N most-recently-completed runs (with NULL end_time taking the top slot under Postgres default)."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityTaskRunRepositoryImpl.java:180-181"
        - q: "Does any upstream layer re-sort or filter the result?"
          a: "UI re-displays the rows in array order; no second sort on the client. The mapper preserves order. The InfiniteScroll consumer appends page 2 to page 1 in order."
          confidence: STATIC-INFERRED
          evidence: "TestRunsHistory.tsx:104-113, DataEntityRunMapper.java:16-24"
  auth_gates:
    - location: "DataEntityRunController.java (entire class — no @PreAuthorize) + SecurityConstants.java:98-355 (no rule entry for /runs)"
      endpoint: "GET /api/dataentities/{data_entity_id}/runs"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "DISABLED — open (no auth enforcement). LOGIN_FORM — requires session cookie via catch-all .authenticated(); any logged-in user proceeds. OAUTH2 — requires bearer token via the same catch-all; any authenticated user proceeds. LDAP — same posture as OAUTH2 (shares AuthorizationCustomizer per SecurityConstants design)."
          confidence: STATIC-INFERRED
          evidence: "AuthorizationCustomizer.java:29-30, SecurityConstants.java:98-355 (no /runs entry), SecurityConstants.java:95-96 (WHITELIST_PATHS includes /actuator + /ingestion + /img + /favicon + /api/slack/events — not /api/dataentities/*/runs)"
        - q: "What does an unauthenticated caller see?"
          a: "401 Unauthorized (or 302 to /login under LOGIN_FORM if Accept: text/html) via the catch-all .authenticated() — the endpoint is NOT whitelisted."
          confidence: STATIC-INFERRED
          evidence: "AuthorizationCustomizer.java:29-30"
        - q: "What does a wrong-role caller see?"
          a: "200 OK with the full payload. There is NO role/permission gate — any authenticated user reads any entity's run history (cross-owner-read posture)."
          confidence: PROBE-NEEDED
          evidence: "P-152"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "Nowhere meaningful — the controller has no @PreAuthorize; the service has no permission check; the repository has no owner-scoped predicate; the SECURITY_RULES table has no entry. The catch-all .authenticated() is the entire gate."
          confidence: STATIC-INFERRED
          evidence: "DataEntityRunController.java (no annotations), DataEntityRunServiceImpl.java (no permission calls), ReactiveDataEntityTaskRunRepositoryImpl.java:164-191 (no owner predicate), SecurityConstants.java:98-355 (no /runs rule)"
  resource_boundaries: []  # no @Transactional, no synchronized, no cache, no idempotency / concurrency state — pure read path with no shared mutable state
  request_inputs:
    - location: "DataEntityRunController.java:19"
      input_kind: path-param
      input_name: "dataEntityId"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The numeric id of the data entity (DQ test or transformer) whose run history to fetch."
          confidence: STATIC-INFERRED
          evidence: "DataEntityRunController.java:19, openapi.yaml:1369 (DataEntityIdParam)"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Passed as `Long dataEntityId` to DataEntityRunService.getDataEntityRuns(...) (DataEntityRunController.java:24-25), which loads the entity via ReactiveDataEntityRepository.get(dataEntityId) (DataEntityRunServiceImpl.java:32) and then queries `data_entity_task_run JOIN data_entity ON oddrn` filtered by `DATA_ENTITY.ID.eq(dataQualityTestId)` (ReactiveDataEntityTaskRunRepositoryImpl.java:165). The bind target is DATA_ENTITY.ID — matches the input name."
          confidence: STATIC-INFERRED
          evidence: "DataEntityRunController.java:19,24-25; DataEntityRunServiceImpl.java:32; ReactiveDataEntityTaskRunRepositoryImpl.java:161-174"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — `dataEntityId` binds to `data_entity.id`. The JOIN translates the entity id into the task-runs that reference the entity's oddrn (DATA_ENTITY_TASK_RUN.TASK_ODDRN.eq DATA_ENTITY.ODDRN), so the runs returned are exclusively those whose parent task is THIS data entity."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityTaskRunRepositoryImpl.java:165, 173"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — no silent translation."
          confidence: STATIC-INFERRED
          evidence: "n/a"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "n/a"
      routes_to_finding: "n/a — no drift"
    - location: "DataEntityRunController.java:20"
      input_kind: query-param
      input_name: "page"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "1-based page index for the paginated result."
          confidence: STATIC-INFERRED
          evidence: "openapi.yaml:1370 + components.yaml:4213-4220 (PageParam)"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Passed through controller → service → repository → JOOQ paginate as `(page - 1) * size` offset (ReactiveDataEntityTaskRunRepositoryImpl.java:180)."
          confidence: STATIC-INFERRED
          evidence: "DataEntityRunController.java:20, DataEntityRunServiceImpl.java:30,38, ReactiveDataEntityTaskRunRepositoryImpl.java:180"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — 1-based indexing convention is consistent across the platform's other paginated endpoints."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityTaskRunRepositoryImpl.java:180; consistent with TagController/AlertController/etc paginate calls"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — no silent translation. Caveat: page=0 produces offset = -size (negative offset). The repository test does not cover this edge; the JOOQ paginate behaviour for negative offset is implementation-defined."
          confidence: PROBE-NEEDED
          evidence: "no test asserts page=0 behaviour"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "n/a"
      routes_to_finding: "n/a"
    - location: "DataEntityRunController.java:21"
      input_kind: query-param
      input_name: "size"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "Number of items per page."
          confidence: STATIC-INFERRED
          evidence: "openapi.yaml:1371 + components.yaml:4222-4229 (SizeParam)"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Passed through to JOOQ paginate LIMIT (ReactiveDataEntityTaskRunRepositoryImpl.java:181). No bounds check anywhere in the chain."
          confidence: STATIC-INFERRED
          evidence: "DataEntityRunController.java:21, ReactiveDataEntityTaskRunRepositoryImpl.java:181"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES on the in-range path. TRANSLATES_SILENTLY on the unbounded path: the operator's expectation that 'size' is reasonable is not enforced by the API contract — size=10000000 reaches the SQL as-is."
          drift: MINOR
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityTaskRunRepositoryImpl.java:181, components.yaml:4222-4229 (no max constraint)"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "A very large size returns a very large result set; latency spikes; memory load on the API tier. No 4xx error rejecting the request."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityTaskRunRepositoryImpl.java:184-190"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "n/a"
      routes_to_finding: "bugs_limitations_corner_cases (page-size unbounded)"
    - location: "DataEntityRunController.java:22"
      input_kind: query-param
      input_name: "status"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "Filter the runs list to a single status from the DataEntityRunStatus enum (SUCCESS | FAILED | SKIPPED | BROKEN | ABORTED | UNKNOWN)."
          confidence: STATIC-INFERRED
          evidence: "openapi.yaml:1372-1376 (DataEntityRunStatus query param), components.yaml:1407-1415"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Bound as `DATA_ENTITY_TASK_RUN.STATUS.eq(status.name())` in the SQL WHERE clause (ReactiveDataEntityTaskRunRepositoryImpl.java:167); null is skipped (the WHERE has only the entity id predicate)."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataEntityTaskRunRepositoryImpl.java:166-168"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_LEGITIMATELY — the wire enum (6 values) is a subset of the DB column's possible values (7 values: + RUNNING). The filter `STATUS.eq(SUCCESS)` correctly returns only SUCCESS rows. The caller CANNOT filter for RUNNING because the wire enum has no such literal; the workaround is to omit the status filter entirely (returns all statuses including RUNNING — at which point the unknown-enum mapper risk fires, see bug above)."
          drift: MINOR
          confidence: STATIC-INFERRED
          evidence: "IngestionTaskRun.java:28-36 vs components.yaml:1407-1415; ReactiveDataEntityTaskRunRepositoryImpl.java:166-168"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "Caller assumption 'I can filter by any status' is partially correct — only 6 of the 7 DB-side statuses are filter-targetable. Caller wanting to see ONLY in-flight runs has no API path; they must fetch all and client-filter, which triggers the wire-enum-unmarshal-bug (P-151)."
          confidence: PROBE-NEEDED
          evidence: "P-151"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE on the input side. On the OUTPUT side, the `status` field of each returned DataEntityRun row carries the wire enum — if any returned row is RUNNING, mapper fails. The RUNNING value is 'available-in-the-DB' but unavailable-on-the-wire."
          confidence: STATIC-INFERRED
          evidence: "IngestionTaskRun.java:34, components.yaml:1407-1415"
      routes_to_finding: "bugs_limitations_corner_cases (wire enum vs DB enum asymmetry) + docs_link_semantic.doc_drift_findings (six-value wire enum undocumented)"
  probes_emitted:
    - probe_id: P-150
      question: "C-Q-NULL — when a RUNNING task with end_time=NULL co-exists with completed runs, what does the operator see at the top of the list, and what is the tie-breaker behaviour on identical end_time across paginated fetches?"
      probe_path: "lineage/odd-platform/probes/P-150.yaml"
    - probe_id: P-151
      question: "B/F-Q-WIRE-ENUM — does the runs endpoint return HTTP 500 when the result set contains a RUNNING row (DB enum has 7 values; wire enum has 6)?"
      probe_path: "lineage/odd-platform/probes/P-151.yaml"
    - probe_id: P-152
      question: "D-Q-OWNER — can bob (non-owner) read alice's DQ-test run history including status_reason text? Cross-owner-read posture verification, REFACTOR-024 family extension."
      probe_path: "lineage/odd-platform/probes/P-152.yaml"
  stress_summary:
    triggers_total: 11
    questions_total: 30
    answers_static_inferred: 24
    answers_probe_needed: 6
    answers_reference: 0
    drift_flags: 3  # name_behavior_pairs[0] MINOR (sort vs display key), request_inputs[size] MINOR (unbounded), request_inputs[status] MINOR (wire vs DB enum)
```

## security

- auth_mode_relevance: LOGIN_FORM, OAUTH2, LDAP — the three modes that protect the UI/API surface. DISABLED skips auth entirely (operator opt-in dev mode per docs). S2S does not apply (this is not an ingestion path; `/ingestion/**` is whitelisted in SecurityConstants.WHITELIST_PATHS but `/api/dataentities/*/runs` is not).
- ingestion_filter_relevance: NO — this is a UI/API read surface; the IngestionDataEntitiesFilter (`auth.ingestion.filter.enabled`) only applies on `POST /ingestion/entities`. (`IngestionDataEntitiesFilter.java:21`)
- authorization_assertions: [] — N/A. The endpoint is NOT listed in `SecurityConstants.SECURITY_RULES` (verified: grep over SecurityConstants.java:98-355 returns zero matches for `runs`). No `@PreAuthorize` annotation on the controller. No programmatic `permissionService.hasPermission(...)` call in the service. The catch-all `.pathMatchers("/**").authenticated()` (`AuthorizationCustomizer.java:29-30`) is the entire gate.
- owner_scoping: BYPASSES — no owner-context check at any layer (controller / service / repository). Verified: `ReactiveDataEntityTaskRunRepositoryImpl.getDataEntityRuns` (lines 161-191) filters only on `DATA_ENTITY.ID.eq(dataQualityTestId)` and optionally `STATUS.eq(...)`; there is no JOIN to `ownership` and no filter by the calling user's owners. This is a NEW invocation site of the cross-owner-read posture in the REFACTOR-024 family (extension to 5th site: the four DataQualityController GETs + this runs-history GET).
- data_exposure:
  - "DataEntityRunList payload (items[].{startTime, endTime, status, statusReason, dataEntityId}) → any authenticated user, no owner filter applied at any layer"
  - "status_reason free-form text (commonly contains test-framework diagnostics: column names, failed-row counts, sample failing values for Great Expectations; table/column names for dbt) → any authenticated user; non-owners get a data-quality-diagnostic leak channel"
  - "Cross-owner DQ-test execution timeline (the full history of when tests run, succeed, fail) → any authenticated user; allows enumerating which datasets are tested + the failure cadence across the catalog regardless of which team owns the dataset"
- known_security_gaps:
  - "controller has no @PreAuthorize; service has no programmatic permission check; repository has no owner-scoping predicate; SecurityConstants.SECURITY_RULES has no entry — the read-collaborative-catalog posture applies but is undocumented for this surface and the data-shape leaked (status_reason free-form text) is qualitatively different from the namespaces/owners/tags lists also exposed by cross-owner-read" — evidence: DataEntityRunController.java:1-28 + DataEntityRunServiceImpl.java:1-46 + ReactiveDataEntityTaskRunRepositoryImpl.java:161-191 + SecurityConstants.java:98-355 — severity: HIGH
  - "status_reason payload is operator-supplied (ingested verbatim from the test framework) and not redacted at the API boundary; combined with cross-owner-read, this is a diagnostic-text broadcast channel — frameworks like Great Expectations emit failed-row sample values which may contain PII" — evidence: components.yaml:974-976 (statusReason free-form string in the wire model), ReactiveDataEntityTaskRunRepositoryImpl.java:170-191 (read path emits the column verbatim) — severity: HIGH
  - "endpoint accepts unauthenticated traffic when auth.type=DISABLED — no fail-closed behaviour for an explicit-misconfiguration scenario; DISABLED is dev-only per the configuration-and-deployment docs, but operators who misconfigure prod see all run history publicly" — evidence: AuthorizationCustomizer.java (only active when AUTH_TYPE != DISABLED; DISABLED has no AuthorizationCustomizer wired) — severity: LOW (DISABLED is documented dev-only)

## performance

- hot_paths:
  - "List query runs synchronously per request, paginated, no cache: SELECT data_entity_task_run.* FROM data_entity_task_run JOIN data_entity ON data_entity.oddrn = data_entity_task_run.task_oddrn WHERE data_entity.id = ? AND status = ? ORDER BY end_time DESC LIMIT ? OFFSET ?. Plus a `SELECT COUNT(*)` over the base query for pageInfo.total. Two DB round-trips per request" — evidence: ReactiveDataEntityTaskRunRepositoryImpl.java:170-191
- throughput_characteristics:
  - "Reactive Mono/Flux signature — non-blocking I/O; each request consumes one Postgres connection from the reactive pool for the duration of the two queries"
  - "UI default page-size 100 (TestRunsHistory.tsx:27) — typical request returns up to 100 rows; the InfiniteScroll consumer accumulates pages client-side, so a user scrolling through 1000 runs triggers 10 round-trips"
- resource_allocation:
  - "No upper bound on size param — a single request with size=1000000 would attempt to materialise 1M rows through JOOQ + MapStruct + Jackson. The window-function-based paginate (count(*) over() + row_number() over(orderBy)) is O(N) on the result set; large pages stress both DB and API memory" — evidence: JooqQueryHelper.java:73-83, components.yaml:4222-4229 (no max constraint)
  - "Two queries per request (the paginated SELECT + the COUNT subquery) — fetchCount(baseQuery) wraps the base query in `SELECT COUNT(*) FROM (...)` (ReactiveDataEntityTaskRunRepositoryImpl.java:205-209). For very large data-entity-task-run tables, the count subquery is the slow path; no cache"
- scaling_characteristics:
  - "Stateless controller — instances scale horizontally"
  - "No pagination upper bound and no rate limit — operator with high-volume DQ ingestion + large size param can sustain DB pressure"
  - "Endpoint has no caching layer; every request re-runs both queries"
- known_performance_gaps:
  - "size parameter unbounded — components.yaml:4222-4229 declares int32 with no min/max. The OpenAPI client (UI) sends size=100; a deliberately-crafted curl with size=10000000 reaches the DB as-is" — evidence: ReactiveDataEntityTaskRunRepositoryImpl.java:180-181, components.yaml:4222-4229 — severity: MEDIUM
  - "Two-query pattern per request (data + count) — the COUNT subquery is unnecessary if `hasNext` could be computed from `LIMIT size+1` peek; the current code computes total via a full count" — evidence: ReactiveDataEntityTaskRunRepositoryImpl.java:205-209 — severity: LOW (premature optimisation; only relevant at scale)
  - "No cache at the controller / service layer; popular DQ tests with stable history re-run the same query per page-load" — evidence: DataEntityRunController.java (no @Cacheable), DataEntityRunServiceImpl.java (no cache wrapper) — severity: LOW

## upstream_callers

- entry_point: "ui_route:/dataentities/{id}/history"
  caller_node: "ts react-component:TestRunsHistory.tsx"
  multiplicity_per_trigger: 1
  evidence: "TestRunsHistory.tsx:54-56 — useEffect dispatches fetchPage(1) on mount + when alertStatus (status filter) changes; each fetch resolves to a single fetchDataEntityRuns thunk → single backend call. Infinite scroll fires additional fetchPage(page+1) calls on user scroll — those are additional triggers, not additional dispatches per trigger."
  observation_class: ui-call
- entry_point: "ui_route:/dataentities/{id}/test-report (test-report-details child)"
  caller_node: "ts react-component:TestReportDetailsHistory.tsx"
  multiplicity_per_trigger: 1
  evidence: "TestReportDetailsHistory.tsx:30-32 — useEffect dispatches fetchDataEntityRuns({page:1, size:10}) on mount + when dataQATestId changes"
  observation_class: ui-call
- entry_point: "rest:GET /api/dataentities/{id}/runs"
  caller_node: "<third-party-api-consumer>"
  multiplicity_per_trigger: 1
  evidence: "Third-party API consumers (custom dashboards, monitoring scripts, BI tools) hitting the documented OpenAPI endpoint — each call invokes the controller method exactly once. Cardinality of EXTERNAL callers is unknown from static analysis."
  observation_class: rest-call

## downstream_side_effects

- side_effect_class: db-write
  description: "NONE — this is a read-only path. The controller produces no DB write."
  evidence: "DataEntityRunController.java (no write paths), DataEntityRunServiceImpl.java (no write paths), ReactiveDataEntityTaskRunRepositoryImpl.getDataEntityRuns (lines 160-191 — pure SELECT)"
  cardinality_per_call: 0
  reachable_from_entry_points: []

- side_effect_class: page-render
  description: "Returns DataEntityRunList payload (paginated items[] + pageInfo{total, hasNext}) to the caller"
  evidence: "DataEntityRunController.java:24-26"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/dataentities/{id}/history"
    - "ui_route:/dataentities/{id}/test-report"
    - "rest:GET /api/dataentities/{id}/runs"

- side_effect_class: log-emit
  description: "Default Spring WebFlux access log (request method + path + status + latency); the controller itself emits no domain-level log lines"
  evidence: "DataEntityRunController.java (no @Slf4j, no log statements); DataEntityRunServiceImpl.java (no log statements)"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/dataentities/{id}/history"
    - "ui_route:/dataentities/{id}/test-report"
    - "rest:GET /api/dataentities/{id}/runs"

## sources

- understanding ← DataEntityRunController.java:13-28 + DataEntityRunServiceImpl.java:32-44 + ReactiveDataEntityTaskRunRepositoryImpl.java:160-191 + SecurityConstants.java:98-355 + AuthorizationCustomizer.java:29-30 + TestRunsHistory.tsx:24-122 + TestReportDetailsHistory.tsx:30-32 + DataEntityDetailsRoutes.tsx:85-94
- concepts.entities.DataEntityRunList ← DataEntityRunController.java:5,19 + components.yaml:1037-1048
- concepts.entities.DataEntityRun ← components.yaml:960-980
- concepts.entities.DataEntityRunStatus ← components.yaml:1407-1415 + IngestionTaskRun.java:28-36
- concepts.entities.data_entity_task_run ← ReactiveDataEntityTaskRunRepositoryImpl.java:35-36, 162-181
- concepts.invariants.entity-class-gate ← DataEntityRunServiceImpl.java:35-45 + DataEntityClassDto.java:44-47
- concepts.invariants.sql-ordering ← ReactiveDataEntityTaskRunRepositoryImpl.java:176-182 + JooqQueryHelper.java:55-90
- dependencies_semantic.requires-feature.* ← IngestionService sidecar lineage/odd-platform/understanding/odd-platform__java__service__service__IngestionService.md (lines 55) + IngestionServiceImpl.java:84-91
- dependencies_semantic.couples-to.DataEntityRunApi ← openapi.yaml:1363-1386
- dependencies_semantic.couples-to.SecurityConstants ← SecurityConstants.java:98-355
- tests_coverage_semantic.covered_behaviours.* ← DataEntityRunRepositoryImplTest.java:34-93 + DataEntityTaskRunPojoEndTimeComparator.java:6-23
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/features/data-quality 2026-05-25 status 200 (no per-test-runs-history coverage)
- docs_link_semantic.inferred_docs.[1] ← WebFetch https://docs.opendatadiscovery.org/features/data-quality/test-results 2026-05-25 status 404
- docs_link_semantic.inferred_docs.[2] ← WebFetch https://docs.opendatadiscovery.org/features/data-quality/test-results-import 2026-05-25 status 200 (covers ingestion, not read-side)
- implicit_adrs.[0] ← DataEntityRunServiceImpl.java:35-45
- implicit_adrs.[1] ← ReactiveDataEntityTaskRunRepositoryImpl.java:178 + DataEntityRunRepositoryImplTest.java:22-23
- implicit_adrs.[2] ← DataEntityRunController.java:24-26
- bugs_limitations_corner_cases.[0] ← DataEntityRunController.java:19-26 + ReactiveDataEntityTaskRunRepositoryImpl.java:180-181
- bugs_limitations_corner_cases.[1] ← IngestionTaskRun.java:28-36 + components.yaml:1407-1415 + DataEntityRunMapper.java:13-14 + MapperConfig.java:7-13
- bugs_limitations_corner_cases.[2] ← ReactiveDataEntityTaskRunRepositoryImpl.java:176-182 + JooqQueryHelper.java:55-90 + TestRunItem.tsx:25-60
- bugs_limitations_corner_cases.[3] ← ReactiveDataEntityTaskRunRepositoryImpl.java:176-182 + TestRunsHistory.tsx:88-113
- bugs_limitations_corner_cases.[4] ← ReactiveDataEntityTaskRunRepositoryImpl.java:178 + TestRunsHistory.tsx:74-87 + TestRunItem.tsx:25-32
- bugs_limitations_corner_cases.[5] ← SecurityConstants.java:98-355 + AuthorizationCustomizer.java:29-30
- bugs_limitations_corner_cases.[6] ← DataEntityRunServiceImpl.java:42-45
- bugs_limitations_corner_cases.[7] ← DataEntityRunServiceImpl.java:32 (comparison to DataQualityServiceImpl.java:55-58)
- stress_findings.tunables ← TestRunsHistory.tsx:27 + TestReportDetailsHistory.tsx:31
- stress_findings.name_behavior_pairs ← ReactiveDataEntityTaskRunRepositoryImpl.java:176-182 + DataEntityRunServiceImpl.java:35-45
- stress_findings.orderings ← ReactiveDataEntityTaskRunRepositoryImpl.java:176-182 + JooqQueryHelper.java:55-90 + TestRunsHistory.tsx:104-113 + DataEntityRunMapper.java:16-24
- stress_findings.auth_gates ← AuthorizationCustomizer.java:29-30 + SecurityConstants.java:95-355 + DataEntityRunController.java (full) + DataEntityRunServiceImpl.java (full)
- stress_findings.request_inputs ← DataEntityRunController.java:19-23 + ReactiveDataEntityTaskRunRepositoryImpl.java:165-191 + openapi.yaml:1369-1376 + components.yaml:1407-1415 + IngestionTaskRun.java:28-36
- security.auth_mode_relevance ← AuthorizationCustomizer.java + SecurityConstants.java:95-96 (WHITELIST_PATHS)
- security.ingestion_filter_relevance ← IngestionDataEntitiesFilter.java:21
- security.owner_scoping ← ReactiveDataEntityTaskRunRepositoryImpl.java:161-191 (no ownership join)
- security.known_security_gaps.[0] ← full call chain SecurityConstants.java:98-355 + DataEntityRunController.java + DataEntityRunServiceImpl.java + ReactiveDataEntityTaskRunRepositoryImpl.java
- security.known_security_gaps.[1] ← components.yaml:974-976 + ReactiveDataEntityTaskRunRepositoryImpl.java:170-191
- performance.hot_paths.[0] ← ReactiveDataEntityTaskRunRepositoryImpl.java:170-191
- performance.resource_allocation.[0] ← JooqQueryHelper.java:73-83 + components.yaml:4222-4229
- performance.known_performance_gaps.[0] ← ReactiveDataEntityTaskRunRepositoryImpl.java:180-181 + components.yaml:4222-4229
- upstream_callers.[0] ← TestRunsHistory.tsx:24-122 + DataEntityDetailsRoutes.tsx:85-94
- upstream_callers.[1] ← TestReportDetailsHistory.tsx:30-32
- downstream_side_effects.[0..2] ← DataEntityRunController.java + DataEntityRunServiceImpl.java + ReactiveDataEntityTaskRunRepositoryImpl.java

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH  # the doc-gap finding is anchored to three concrete WebFetch results
- implicit_adrs: MEDIUM  # adr 3 (thin reactive Mono chain) is convention-derived, not file-comment-anchored
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: MEDIUM  # size-unbounded is HIGH-confidence; the two-query-pattern and no-cache observations are accurate but the operational impact requires load-probe data
- upstream_callers: HIGH
- downstream_side_effects: HIGH
- stress_findings: MEDIUM  # 6 of 30 questions PROBE-NEEDED (20%); 3 of 11 triggers carry drift flags; load-bearing claims (cross-owner-read, wire-enum-asymmetry, NULLS-FIRST ordering) are STATIC-INFERRED with strong evidence + 3 emitted probes

## Maintainer notes

- 2026-06-22 (maintainer-annotated, NOT a full re-enrich): the highest-severity finding on this node —
  `bugs_limitations_corner_cases.[1]`, the RUNNING wire/DB enum asymmetry that 500'd the runs-history page
  during an in-flight test — was FIXED upstream by PR #1793 / PLT-021 / CTRIB-024. RUNNING is now a value of
  the wire enum `DataEntityRunStatus` (== the 7-value DB `IngestionTaskRunStatus`) and `DataEntityRunMapper`
  degrades any unmapped/future status to `UNKNOWN` instead of throwing; the endpoint returns 200 with the
  in-flight run at the top. NOW TEST-COVERED at both buckets: `DataEntityRunMapperImplTest` (RUNNING→RUNNING,
  unknown→UNKNOWN) + `DataEntityRunRepositoryImplTest` (in-flight ordering) [unit/CI], and odd-team
  `IT-059 dq-run-history` (API + browser, RED on `ref:main`) [integration]. The companion invariant
  (`concepts/detail/invariants/wire-enum-running-asymmetry-data-entity-run-status.yaml`) and probe `P-151`
  are flipped to RESOLVED; `feature-flows/detail/F-040.yaml` already recorded the resolution (2026-06-19).
  This sidecar was enriched at commit `4ec2b20` (pre-fix); a full `/enrich` against current HEAD is the
  deeper refresh — it will re-derive `bugs[1]` severity, the docs six-value-enum finding (now seven), the
  `status` filter request-input drift, and `confidence`. Reducer rollups that still cite the open bug
  (`test-map.yaml`, `implicit-adrs.md`, `refactoring-scopes.md`, operation `list-runs-for-data-entity.yaml`)
  refresh on the next reducer pass.

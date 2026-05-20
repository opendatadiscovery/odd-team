---
node_id: "odd-platform java DataQualityController controller-class:DataQualityController"
node_kind: controller-class
axis: controllers
extracted_at_commit: 80637ed
enriched_at_commit: 80637ed
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
schema_version: 0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-T
related_features:
  - F-007  # AlertManager — DQ test failures emit FAILED_DQ_TEST alerts via the AlertActionResolver chain
  - F-010  # Housekeeping — alert retention TTL (downstream consumer of DQ-test-emitted alerts)
related_pillar_features:
  - "P-04:F-001"  # Test Results Import — this controller surfaces the imported results
  - "P-04:F-002"  # Quality Dashboard — sibling read surface (not this controller)
  - "P-04:F-003"  # Dataset Quality Statuses (SLA) — this controller owns the per-dataset SLA endpoints
related_refactors:
  - REFACTOR-024  # cross-owner enumeration family — DataQualityController's four read endpoints (getDataEntityDataQATests, getDatasetTestReport, getSLA, getDatasetSLAReport) are NEW invocation sites of the same cross-owner-read posture; the mutating endpoint (setDataQATestSeverity) is the lone owner-scoped op
related_adr_candidates:
  - ADR-CANDIDATE-003  # read-collaborative catalog (borderline-resolved-as-intentional per batch F)
  - ADR-CANDIDATE-114  # read-cardinality split — per-entity reads unscoped, batch reads owner-scoped except listAll
related_concepts:
  - data-quality-test
  - sla-calculator
  - sla-colour
  - dataset-test-report
  - data-quality-test-severity
  - read-collaborative-catalog-posture
---

# DataQualityController — semantic understanding

## understanding

`DataQualityController` is the Pillar P-04 Data Quality HTTP entry point — a thin `@RestController` implementing the OpenAPI-generated `DataQualityApi` interface, exposing five read/mutate endpoints under `/api/datasets/{data_entity_id}/...` for per-dataset test results, test-report aggregates, SLA colour rendering, SLA detailed report, and severity assignment (`DataQualityController.java:21, 25-68`). Four of the five endpoints are GETs that delegate to `DataQualityService` with no principal-context read; the fifth (`setDataQATestSeverity`) is a PUT gated by the `DATASET_TEST_RUN_SET_SEVERITY` permission via the centralised `SecurityConstants.SECURITY_RULES` table (`SecurityConstants.java:243-246`). The `getSLA` endpoint is the **only** controller in the platform that returns `image/png` — it maps the computed SLA colour (`GREEN | YELLOW | RED`) to a hardcoded PNG file via the `SLAResourceResolver` chain (`DataQualityController.java:42-48`, `CachingByteArraySLAResourceResolver.java:44-49`), serving as a BI-tool-embeddable trust-signal badge. The pillar's load-bearing constraint ("aggregator only — checks are not performed inside ODD" per `documentation/docs/data-quality.md:9`) is enforced by the absence of any test-execution code path in this controller: it reads test-result data ingested elsewhere and aggregates via `SLACalculator`.

## concepts

- entities: [
    "DataEntityList — paginated list of data-quality-test entities related to a dataset (`DataQualityController.java:6, 26`)",
    "DataSetTestReport — counts-per-status aggregate (success/failed/aborted/skipped/broken/unknown totals) for a dataset's tests (`DataQualityController.java:9, 34`, `components.yaml:1177-1203`)",
    "DataSetSLAReport — total/success weight aggregate + slaColour + severity_weights breakdown + slaRef self-link (`DataQualityController.java:8, 64`, `components.yaml:1134-1156`)",
    "SLA enum — GREEN | YELLOW | RED — the dataset-level aggregate trust signal (`SLAResourceResolver.java:7`, `SLACalculator.java:80-100`)",
    "DataQualityTestSeverity — MINOR | MAJOR | CRITICAL — operator-set per-test importance (`DataQualityController.java:7, 51`, used in SLA weighting `SLACalculator.java:14-16, 35-60`)",
    "DataQualityTestSeverityForm — request-body wrapper carrying a single DataQualityTestSeverity enum (`DataQualityController.java:7, 54`)",
    "Resource (PNG byte-array) — the rendered SLA badge image (`DataQualityController.java:42, 46`, `CachingByteArraySLAResourceResolver.java:8-10, 38`)"
  ]
- operations: [
    "list-data-quality-tests-for-dataset (`getDataEntityDataQATests`, GET `/api/datasets/{id}/dataqatests`)",
    "aggregate-test-status-counts-for-dataset (`getDatasetTestReport`, GET `/api/datasets/{id}/test_report`)",
    "render-sla-colour-as-png (`getSLA`, GET `/api/datasets/{id}/sla` → image/png — the BI-embeddable badge)",
    "compute-detailed-sla-report-as-json (`getDatasetSLAReport`, GET `/api/datasets/{id}/sla_report` → application/json DataSetSLAReport)",
    "set-test-severity (`setDataQATestSeverity`, PUT `/api/datasets/{data_entity_id}/dataqatests/{dataqa_test_id}/severity`, gated)"
  ]
- invariants: [
    "Reactive signature — every endpoint returns `Mono<ResponseEntity<T>>`; success always emits `200 OK` (`DataQualityController.java:25-68`)",
    "All five endpoints take `Long dataEntityId` as the dataset-resolving path variable — naming is canonical: `data_entity_id` is the dataset Data Entity id; the method parameter is `dataEntityId` (`DataQualityController.java:26, 34, 42, 52, 64`)",
    "`existsIncludingSoftDeleted` precedes every read path on the service tier — `getDatasetTestReport`, `getSLA`, `getSLAReport`, and `setDataQualityTestSeverity` each first call `reactiveDataEntityRepository.existsIncludingSoftDeleted(datasetId)` and throw `NotFoundException` on absence (`DataQualityServiceImpl.java:55-58, 67-78, 96-98`). The lone exception is `getDatasetTests` which checks `getDataQualityTestOddrnsForDataset` for emptiness instead (`DataQualityServiceImpl.java:38-42`)",
    "SLA colour for a dataset with ZERO defined tests is `YELLOW` — not `GREEN` — the platform errs cautious when no signal is defined (`SLACalculator.java:81-83`)",
    "Severity defaults to `MAJOR` when no explicit severity exists for a (test, dataset) pair — `DataQualityTestSeverity.MAJOR` is the fallback in the SQL-tier left-join mapper (`ReactiveDataQualityRepositoryImpl.java:142-148`)",
    "`getSLA` response content-type is `image/png` — declared in the OpenAPI spec (`openapi.yaml:1880-1896`) and physically resolved from `sla/sla_{red|yellow|green}.png` classpath resources cached at bean-init time (`CachingByteArraySLAResourceResolver.java:30-42, 44-54`)",
    "SLA weight aggregation is hierarchical-multiplicative, not additive — Major count multiplies by Minor count when Minors exist; Critical count multiplies by the resulting Major weight, then by Minor weight; the algorithm encodes 'severity buckets compound' rather than 'severities sum independently' (`SLACalculator.java:37-60`)"
  ]
- audiences: [
    "odd-platform-ui-end-user — every dataset detail page's 'Test reports' tab calls `getDataEntityDataQATests` and `getDatasetTestReport` (per live doc `https://docs.opendatadiscovery.org/features/data-quality` 2026-05-20 status 200: 'from any data entity's Test reports tab (per-entity test results and SLA status)')",
    "viz-bi-engineer — `getSLA` is the BI-tool embeddable colour badge (per live doc `https://docs.opendatadiscovery.org/features/data-quality/sla-statuses` 2026-05-20 status 200: 'BI tools can fetch this endpoint per dataset and render the colour as a one-glance trust signal next to dashboard tiles or report sections')",
    "data-quality-engineer — the audience setting severities (per live doc same page: 'Severities are operator-set — the platform does not infer them')",
    "data-engineer-analyst — operator setting severities on dataset tests they own"
  ]

## dependencies_semantic

- requires-feature: [
    "data-quality test-results-import pipeline — live doc `https://docs.opendatadiscovery.org/features/data-quality/test-results-import` 2026-05-20 status 200; this controller surfaces the data that pipeline ingests, none of which is produced inside the platform",
    "SLA calculation infrastructure — `SLACalculator` `@Component` bean (`SLACalculator.java:18-19, 80-100`) plus the three SLA-colour PNG classpath resources (`<odd-platform>/odd-platform-api/src/main/resources/sla/sla_{red,yellow,green}.png`)",
    "RBAC permission `DATASET_TEST_RUN_SET_SEVERITY` — the only authorization gate this controller depends on (`SecurityConstants.java:243-246`)"
  ]
- requires-config: [] — N/A. This controller declares no `@ConditionalOnProperty`, no `@Value`, no `@ConfigurationProperties` dependency; auth wiring is global via `*SecurityConfiguration` beans, not local to this controller.
- requires-runtime: [
    "Spring WebFlux — `RestController` + `Mono<ResponseEntity<T>>` return types + `ServerWebExchange` (`DataQualityController.java:13-17, 25-68`)",
    "Reactor Core — `Mono.flatMap` / `Mono.map` composition (`DataQualityController.java:16-17, 57-60`)",
    "jOOQ reactive DB session — downstream `ReactiveDataQualityRepositoryImpl` runs all five queries against PostgreSQL (`ReactiveDataQualityRepositoryImpl.java:38-44`)",
    "Spring `Resource` API — `getSLA` produces `org.springframework.core.io.Resource` over `image/png` (`DataQualityController.java:12, 42`)",
    "ClassPath PNG resources at `sla/sla_{red,yellow,green}.png` — loaded once at bean init and cached (`CachingByteArraySLAResourceResolver.java:30-54`)"
  ]
- couples-to: [
    "`DataQualityApi` (OpenAPI-generated interface) — supplies `@RequestMapping`, content-types, parameter validation, and the five operation IDs `getDataEntityDataQATests | getDatasetTestReport | getSLA | getDatasetSLAReport | setDataQATestSeverity` (`openapi.yaml:1880-1971`)",
    "`DataQualityService` — sole downstream dependency for the four standard endpoints (`DataQualityController.java:10, 22, 29, 37, 45, 59, 66`); concrete impl `DataQualityServiceImpl` injects `ReactiveDataQualityRepository`, `ReactiveDataEntityRepository`, `DataEntityService`, `DataQualityMapper`, `DataEntityMapper`, `SLACalculator` (`DataQualityServiceImpl.java:29-35`)",
    "`SLAResourceResolver` — interface, sole concrete impl is `CachingByteArraySLAResourceResolver` (`DataQualityController.java:11, 23, 46`)",
    "`SecurityConstants.SECURITY_RULES` entry at `SecurityConstants.java:243-246` — the ONLY centralised gate on any DataQualityController endpoint (the four reads have no entry; setDataQATestSeverity is gated)"
  ]

## tests_coverage_semantic

- covered_behaviours: [
    "SLA-colour computation across all severity-vs-status combinations — `SLAColourTest.java:13-...` exercises the `SLACalculator.calculateSLA(tests)` algorithm with hand-built `TestStatusWithSeverityDto` lists for: at-least-one-critical-failed, all-majors-failed, all-but-one-major-failed-and-all-minors-failed, etc. The downstream business logic of `getSLA` and `getDatasetSLAReport` IS covered at the calculator layer.",
    "SLA-report aggregate weight calculation — `SLAReportTest.java:19-50+` exercises `slaCalculator.getSLAReport(datasetId, tests)` for empty-tests (asserting `YELLOW + (0,0,0) severity weights`) and all-severities-present (asserting `total=39, success=35` for a specific 9-test mix). The downstream business logic of `getDatasetSLAReport` IS covered at the calculator layer."
  ]
- uncovered_behaviours: [
    "HTTP-level smoke tests for ALL FIVE endpoints — no `@WebFluxTest(DataQualityController.class)` or `WebTestClient` test asserts that `GET /api/datasets/{id}/dataqatests`, `GET /api/datasets/{id}/test_report`, `GET /api/datasets/{id}/sla`, `GET /api/datasets/{id}/sla_report`, or `PUT /api/datasets/{id}/dataqatests/{tid}/severity` returns the expected status code, content-type, or schema-conforming body",
    "`getSLA` content-negotiation and PNG-byte integrity — no test asserts the response Content-Type is `image/png`, that the body bytes match the expected `sla_{red,yellow,green}.png` classpath bytes for a given SLA outcome, or that the byte length is non-zero",
    "`getSLA` for a dataset with zero defined tests — `SLAColourTest` covers the `Collections.emptyList()` SLA-calculator path? — let me re-check via grep — but the HTTP-layer flow (NotFoundException for unknown dataset vs YELLOW for known-but-test-less dataset) is not exercised",
    "`existsIncludingSoftDeleted` NotFoundException path — no test asserts that calling any of `getDatasetTestReport`, `getSLA`, `getDatasetSLAReport`, `setDataQATestSeverity` against a non-existent or hard-deleted dataset returns `404`",
    "`getDataEntityDataQATests` empty-result path — `DataQualityServiceImpl.java:40-42` throws `NotFoundException` when `getDataQualityTestOddrnsForDataset` is empty; no test asserts that a dataset with zero tests returns 404, not 200 with an empty list — this is a subtle API-shape decision (404-on-empty is unusual)",
    "`setDataQATestSeverity` authorization regression — no test asserts that calling without `DATASET_TEST_RUN_SET_SEVERITY` permission returns 403; the centralised SecurityRule (`SecurityConstants.java:243-246`) is configuration, not asserted behaviour",
    "Owner-scoping regression for the four read endpoints — no test asserts whether the data returned by `getDatasetTestReport` for dataset X is visible to a user with no ownership of dataset X's owner (the current implementation permits it; a future tightening would have no test to break)",
    "Idempotency on `setDataQATestSeverity` — the repository uses `onDuplicateKeyUpdate` (`ReactiveDataQualityRepositoryImpl.java:95-96`); no test asserts that repeated PUTs converge on the same row vs creating duplicates",
    "SLA endpoint Content-Type semantics under `Accept` header negotiation — no test asserts that `GET /api/datasets/{id}/sla` with `Accept: application/json` returns 406 (per OpenAPI spec `openapi.yaml:1889-1894` it produces only `image/png`)"
  ]
- test_files: [
    "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/service/sla/SLAColourTest.java:13-... — calculator-tier coverage",
    "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/service/sla/SLAReportTest.java:16-50+ — calculator-tier coverage",
    "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/DataQualityRepositoryImplTest.java — repository-tier (non-reactive; existence noted, full coverage not audited at this node)",
    "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/ReactiveDataQualityRunsRepositoryTest.java — adjacent repository tier (runs, not the surfaces this controller exposes)"
  ]
- gaps: |
    The controller is a 49-line thin proxy (`DataQualityController.java:1-69`); unit-testing the controller's own logic would test nothing. The real gap is the HTTP-layer integration boundary: there is no `@WebFluxTest` or `WebTestClient` test that wires WebFlux routing, OpenAPI-generated `@RequestMapping`, content-negotiation (especially `image/png` for `getSLA`), Jackson serialisation, the jOOQ repository, and the SecurityRule for `setDataQATestSeverity` together. A regression in any of those layers (OpenAPI generator template, WebFlux routing config, `SLAResourceResolver` PNG-byte path, jOOQ schema mapping, or the SecurityConstants entry) would silently break the endpoints with the build still green. The `getSLA` PNG path is particularly fragile — it relies on three classpath resources at fixed paths whose absence is detected only at bean init time via `IllegalStateException` (`CachingByteArraySLAResourceResolver.java:35-36`), not at compile time.

## docs_link_semantic

- declared_docs: [] — N/A. The source file `DataQualityController.java` carries no `@docs` Javadoc annotation; this matches the repo-wide convention (no controller in the package bootstraps `@docs` annotations).
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-quality"
    anchor: ""
    rationale: "Pillar landing page for P-04 — names the three sub-features (Test Results Import / Quality Dashboard / Dataset Quality Statuses) whose backing API surfaces this controller owns; the live page explicitly names the 'Test reports' tab as the per-entity surface backed by `getDataEntityDataQATests` and `getDatasetTestReport`"
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Landing description (verbatim): "ODD covers Data Quality fully *as an aggregator*. Quality checks are not performed inside ODD Platform — the platform integrates with leading tools in the field and surfaces their results in one operator-friendly view."

      Per-entity surface description (verbatim): "from any data entity's **Test reports** tab (per-entity test results and SLA status)."

      Three subsection links named in the live page:
        - "Test Results Import — how test results land in the catalog"
        - "Quality Dashboard — the catalog-wide quality view at `/data-quality`"
        - "Dataset Quality Statuses (SLA) — Minor / Major / Critical statuses on test results, the dataset-level aggregate SLA colour, and the `/api/datasets/{id}/sla` endpoint for BI-report import"

      Access-control note (verbatim absence): "The provided content contains **no information** about access control, RBAC, owner-scoping, or permissions for viewing or setting test severities."

  - url: "https://docs.opendatadiscovery.org/features/data-quality/sla-statuses"
    anchor: ""
    rationale: "Sub-feature page for SLA — explicitly names `/api/datasets/{id}/sla` as the BI-import endpoint and describes the SLA-colour computation; both `getSLA` and `getDatasetSLAReport` source their behaviour here"
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Endpoint declaration (verbatim): "Each dataset exposes its current aggregate SLA at: `GET https://{platform_url}/api/datasets/{data_entity_id}/sla`"

      Response-shape claim (verbatim): "The endpoint returns a `DataSetSLAReport` that includes: The dataset's current SLA colour — GREEN, YELLOW, or RED. A breakdown of severity weights — counts of tests at each severity. A slaRef self-link."

      Severity-set audience (verbatim): "Severities are operator-set — the platform does not infer them. … Open the dataset's main page and select the **Test reports** tab. Click on a job (a test result row) and, in the right-side panel, choose a severity — Minor, Major, or Critical."

      Access-control language (verbatim absence): "The document contains no access-control language, no owner-scoping, and no role-based restrictions on who may set severities beyond the generic term 'operator.'"

      BI workflow (verbatim): "BI tools can fetch this endpoint per dataset and render the colour as a one-glance trust signal next to dashboard tiles or report sections."

  - url: "https://docs.opendatadiscovery.org/features/data-quality/test-results-import"
    anchor: ""
    rationale: "Sub-feature page covering Test Results Import; this controller's `getDataEntityDataQATests` and `getDatasetTestReport` are the read counterparts of the ingestion path documented here"
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Per-entity surface mention (verbatim): "Test outcomes surface on the dataset's detail page **Test reports** tab" — for both Great Expectations and dbt tests.

      Access-control note (verbatim absence): "The current page does not contain any explicit information about [per-entity Test Reports tab visibility / access controls / RBAC or owner-scoping mechanisms / specific API endpoint names]."

- doc_drift_findings:
  - "**DOC DRIFT — response shape mismatch on `GET /api/datasets/{id}/sla`**: The live `sla-statuses.md` page (WebFetched 2026-05-20 status 200) describes the response as 'a `DataSetSLAReport` that includes: SLA colour (GREEN/YELLOW/RED), severity weights breakdown, and a slaRef self-link' — implying a JSON object. The OpenAPI spec (`openapi.yaml:1880-1894`) and the controller code (`DataQualityController.java:42-48`, `CachingByteArraySLAResourceResolver.java:30-54`) return `image/png` — a hardcoded `sla_{red,yellow,green}.png` byte-array. The JSON `DataSetSLAReport` is the response of the **sibling** endpoint `GET /api/datasets/{id}/sla_report` (operationId `getDatasetSLAReport`, `openapi.yaml:1898-1913`). The doc conflates two endpoints; a BI engineer following the docs verbatim will receive a PNG body and fail to deserialise it as JSON. Severity: HIGH — this is the canonical 'operator follows our guide off a cliff' scenario for the BI-tool integration audience the page explicitly targets."
  - "**DOC DRIFT — read-endpoint authorization scoping silent**: The live `data-quality.md` landing, `sla-statuses.md`, and `test-results-import.md` pages collectively make NO statement about who can view per-dataset DQ tests, test reports, or SLA colour. The code permits any authenticated user (no SecurityRule entry for the four read endpoints — only `setDataQATestSeverity` PUT is gated at `SecurityConstants.java:243-246`). The doc-side silence is consistent with the read-collaborative posture (ADR-CANDIDATE-003 / REFACTOR-024) but is a doc-gap candidate: the page should disclose the read-collaborative posture explicitly OR the four read endpoints should gain owner-scoping. Severity: MEDIUM — same shape as the alerting-page doc drift on `getAllAlerts` (per `odd-platform__java__AlertController__controller-method__getAllAlerts.md:doc_drift_findings[0]`)."
  - "**DOC DRIFT — set-severity audience under-specified**: The live `sla-statuses.md` says 'Severities are operator-set — the platform does not infer them' but does NOT name the `DATASET_TEST_RUN_SET_SEVERITY` permission, the `DATA_ENTITY` AuthorizationManagerType scope, or that the gate is owner-scoped (requires the caller to be an owner of the dataset's owners, per the `DATA_ENTITY` resource type at `SecurityConstants.java:243`). A data-quality engineer trying to set severities without owner-association will receive 403 and have no doc to explain why. Severity: MEDIUM."

## implicit_adrs

- "**Owner-scoping is asymmetrical: read endpoints are unscoped (cross-owner), the lone mutation is owner-scoped via `DATA_ENTITY` AuthorizationManagerType.** The four GETs (`getDataEntityDataQATests`, `getDatasetTestReport`, `getSLA`, `getDatasetSLAReport`) have NO `SecurityRule` entry in `SecurityConstants.SECURITY_RULES` and fall through to `.pathMatchers('/**').authenticated()` (`AuthorizationCustomizer.java:29-30`). The PUT `setDataQATestSeverity` IS registered with the `DATA_ENTITY` resource type plus the `DATASET_TEST_RUN_SET_SEVERITY` permission (`SecurityConstants.java:243-246`). This is the read-collaborative posture (ADR-CANDIDATE-003) applied symmetrically — reads cross-owner, mutations owner-scoped. The intent_anchor is the SecurityRule registration itself: a maintainer made the deliberate decision to add ONE rule (the PUT) and not five." — evidence: `DataQualityController.java:25-68` (no `@PreAuthorize` on any method) + `SecurityConstants.java:243-246` (the registered PUT rule using `DATA_ENTITY` resource type) + `AuthorizationCustomizer.java:24-30` (the rule-loop + catch-all `.authenticated()`) — intent_anchor: "new SecurityRule(DATA_ENTITY, new PathPatternParserServerWebExchangeMatcher(\"/api/datasets/{data_entity_id}/dataqatests/{dataqa_test_id}/severity\", PUT), DATASET_TEST_RUN_SET_SEVERITY)" (`SecurityConstants.java:243-246`) — confidence: HIGH

- "**`existsIncludingSoftDeleted` as the existence-check primitive on data-quality reads, not `exists`.** Four of the five service methods (`getDatasetTestReport`, `getSLA`, `getSLAReport`, `setDataQualityTestSeverity`) start with `reactiveDataEntityRepository.existsIncludingSoftDeleted(datasetId).filter(e -> e).switchIfEmpty(... NotFoundException ...)` (`DataQualityServiceImpl.java:55-57, 67-77, 96-98`) — explicitly preserving DQ visibility for soft-deleted datasets. This is intentional: a dataset that was marked deleted but not yet hard-purged by housekeeping still surfaces its historical DQ signal, which matters for audit / forensic / 'what happened before deletion' workflows. The `Soft-deleted-data-entity reads remain visible' constraint is enforced at the service layer, not at the repository or controller." — evidence: `DataQualityServiceImpl.java:55, 67, 96` (three call sites; `existsIncludingSoftDeleted` chosen over the unrelated `exists` variant) + the method name `existsIncludingSoftDeleted` itself (the naming convention asserts intent) — intent_anchor: "reactiveDataEntityRepository.existsIncludingSoftDeleted(datasetId)" (`DataQualityServiceImpl.java:55, 67, 96`) — confidence: HIGH

- "**SLA colour is rendered as a server-supplied PNG image, NOT a client-rendered colour token.** The `/api/datasets/{id}/sla` endpoint returns `image/png` (`openapi.yaml:1888-1894`) — a hardcoded `sla_{red,yellow,green}.png` byte-array shipped as a classpath resource (`<odd-platform>/odd-platform-api/src/main/resources/sla/sla_{red,yellow,green}.png`, `CachingByteArraySLAResourceResolver.java:45-49`). The intent is BI-tool embeddability: an external dashboard tile, an Excel cell, a Confluence page — anywhere that can render `<img src=...>` or import an image — can show the colour without parsing JSON or computing colour mapping. The sibling endpoint `/api/datasets/{id}/sla_report` returns the full `DataSetSLAReport` JSON for clients that want the underlying numbers. The two endpoints encode TWO audiences explicitly: PNG for BI embed, JSON for programmatic consumers." — evidence: `DataQualityController.java:42-48` (PNG path) + `DataQualityController.java:63-68` (JSON path) + `openapi.yaml:1880-1913` (the two distinct operationIds with distinct content-types) + `CachingByteArraySLAResourceResolver.java:44-54` (the classpath-resource mapping) — intent_anchor: "case RED -> new ClassPathResource(\"sla/sla_red.png\"); case YELLOW -> new ClassPathResource(\"sla/sla_yellow.png\"); case GREEN -> new ClassPathResource(\"sla/sla_green.png\")" (`CachingByteArraySLAResourceResolver.java:45-49`) — confidence: HIGH

- "**SLA computation is deterministic and aggregation-based, NOT directly severity-mapped.** `SLACalculator.getSLAColour` encodes 8 ordered branches; the algorithm distinguishes 'at-least-one-critical-failed → RED' from 'all-majors-failed → RED' from 'all-but-one-major-failed-and-all-minors-failed → RED' from 'some-majors-failed → YELLOW' from 'all-minors-failed → YELLOW' from 'no-tests-defined → YELLOW (cautious)' from 'all-passed → GREEN' (`SLACalculator.java:80-100`). The decision is to ENCODE failure-pattern semantics in code, not to expose a 'severity → colour' lookup table — meaning the dataset SLA colour can flip between Yellow and Red without any test's pass/fail status changing, purely by a severity reclassification (as the live doc states: 'changing a single test's severity from Major to Critical can flip the dataset from Yellow to Red without any test pass / fail status changing', `documentation/docs/data-quality/sla-statuses.md:44`). This is operator-visible behaviour and intentional." — evidence: `SLACalculator.java:80-121` (the 8-branch algorithm + the four `private boolean` predicates encoding each pattern) + `SLAColourTest.java:17-...` (tests exhaustively cover each branch — the algorithm is the spec) + doc excerpt `documentation/docs/data-quality/sla-statuses.md:44` (operator-facing description matches code) — intent_anchor: "if (counter.getMinorsCount() == 0 && counter.getMajorsCount() == 0 && counter.getCriticalCount() == 0) { return SLA.YELLOW; }" (the explicit cautious-default for zero tests, `SLACalculator.java:81-83`) — confidence: HIGH

- "**'Aggregator only — no test execution inside the platform' pillar invariant.** This controller exposes ZERO endpoints that execute tests, schedule test runs, or define test logic. Every endpoint reads or aggregates ALREADY-INGESTED test-result data via repository queries (`ReactiveDataQualityRepositoryImpl.java:38-44`). The mutation (`setDataQATestSeverity`) modifies metadata on an existing test, not the test itself. This matches the load-bearing pillar constraint stated explicitly at `documentation/docs/data-quality.md:9` ('Quality checks are not performed inside ODD Platform — the platform integrates with leading tools in the field and surfaces their results') — the architectural shape is intentional and visible in the controller's bounded operation surface." — evidence: `DataQualityController.java:25-68` (five method signatures — all read or annotate existing data; none accept a test-execution payload) + `DataQualityService.java:11-23` (interface — five methods, all read or annotate; no `runTest`, `executeTest`, `scheduleTest`) + `documentation/docs/data-quality.md:9` (live pillar invariant verbatim) — intent_anchor: "ODD covers Data Quality fully *as an aggregator*. Quality checks are not performed inside ODD Platform" (`documentation/docs/data-quality.md:9` — the doc-side statement of intent matches the code-side absence) — confidence: HIGH

## bugs_limitations_corner_cases

- "**`getDataEntityDataQATests`, `getDatasetTestReport`, `getSLA`, `getDatasetSLAReport` return per-dataset DQ data to any authenticated user — no Permission gate, no owner check, no admin restriction.** The four read endpoints have NO entry in `SecurityConstants.SECURITY_RULES`; the path falls through to `.pathMatchers('/**').authenticated()` (`AuthorizationCustomizer.java:29-30`). The downstream `ReactiveDataQualityRepositoryImpl` queries apply only `dataset.HOLLOW.isFalse()` and `dataQualityTest.STATUS.ne(DELETED)` filters (`ReactiveDataQualityRepositoryImpl.java:55-56, 78, 122`) — no owner join, no principal-derived predicate. The live doc is silent on access control. This is the same cross-owner-read posture as REFACTOR-024 applied to a new feature surface; coherent with the read-collaborative architectural posture (ADR-CANDIDATE-003) but undocumented at the live `data-quality.md` page." — evidence: `DataQualityController.java:25-48, 63-68` (no annotations) + `SecurityConstants.java:98-355` (no rule for the four read endpoints) + `AuthorizationCustomizer.java:29-30` (catch-all `.authenticated()`) + `ReactiveDataQualityRepositoryImpl.java:46-58, 62-84, 105-126, 130-138` (no owner predicate in any read query) + WebFetch data-quality docs 2026-05-20 (silent on access control) — severity: MEDIUM (under read-collaborative posture this is intentional; under read-restrictive posture it would be HIGH — surface as a doc-gap or as an authorization gap depending on maintainer triage)

- "**`getSLA` response Content-Type is `image/png`, NOT JSON as the live doc implies.** A BI engineer reading `documentation/docs/data-quality/sla-statuses.md` (live, 2026-05-20) will see 'The endpoint returns a `DataSetSLAReport` that includes [JSON fields]' and write a JSON-parsing client that receives a 1-2 KB PNG byte stream and fails to deserialise. The JSON endpoint they want is `/api/datasets/{id}/sla_report` (sibling, operationId `getDatasetSLAReport`). Per the live doc-vs-code analysis, this is the canonical 'operator follows our guide off a cliff' scenario for the BI-tool audience the page explicitly targets." — evidence: `DataQualityController.java:42-48` (PNG path) + `CachingByteArraySLAResourceResolver.java:30-54` (PNG-byte resolution) + `openapi.yaml:1880-1896` (spec declares `image/png`) + WebFetch `sla-statuses.md` 2026-05-20 (claims `DataSetSLAReport` JSON shape for the PNG endpoint) — severity: HIGH

- "**`getDataEntityDataQATests` returns 404 NotFound for a dataset that exists but has zero data-quality tests, instead of `200 OK` with an empty list.** The service throws `NotFoundException` when the `getDataQualityTestOddrnsForDataset` flux is empty (`DataQualityServiceImpl.java:39-42`). This is an unusual REST-API shape — empty collections typically return 200 with `[]`. A UI rendering the 'Test reports' tab for a dataset with no defined tests will receive 404 on the test-list call, which it must distinguish from the dataset-not-found 404 returned by sibling endpoints (`DataQualityServiceImpl.java:55-58` for `getDatasetTestReport` and the others). The error message ('Data quality tests for dataset with id %d not found') differs from the dataset-not-found message ('Dataset {id}'), but a client doing only status-code-based handling will treat them identically." — evidence: `DataQualityServiceImpl.java:38-42` (the empty-stream NotFoundException) + comparison with sibling `getDatasetTestReport` path at `DataQualityServiceImpl.java:54-60` (which 404s only on dataset-existence failure) — severity: MEDIUM

- "**SLA endpoint relies on three classpath PNG resources that ship inside the JAR — absence is detected only at bean init time, not at compile time, and not enforced by tests.** `CachingByteArraySLAResourceResolver` reads `sla/sla_{red,yellow,green}.png` via `ClassPathResource` at bean construction (`CachingByteArraySLAResourceResolver.java:30-54`). If a build process strips these resources (e.g. a misconfigured Maven `resources` filter, a Docker COPY that excludes the `sla/` subdirectory, a fat-JAR shading that drops binary resources), the platform fails fast with `IllegalStateException('Couldn't read a file of SLA %s')` at startup — but only at startup. No test asserts the resources are present in the classpath; no integration test exercises `getSLA` end-to-end against an embedded server. The failure mode for a misconfigured deployment is 'platform won't boot' rather than 'platform boots but SLA endpoint is broken' — fail-fast is the better mode, but the absence of a test-time check is a regression-fragility. The actual files exist at `<odd-platform>/odd-platform-api/src/main/resources/sla/sla_{red,yellow,green}.png` per filesystem check." — evidence: `CachingByteArraySLAResourceResolver.java:30-54` + `find <odd-platform> -path '*resources/sla*'` returned the three PNG files — severity: LOW (fail-fast is good; the only real risk is build-pipeline misconfiguration)

- "**`setDataQATestSeverity` uses `onDuplicateKeyUpdate` — repeated PUTs converge but produce no audit trail.** The repository upsert (`ReactiveDataQualityRepositoryImpl.java:90-101`) writes to `DATA_QUALITY_TEST_SEVERITY` with `onDuplicateKeyUpdate` on `(DATA_QUALITY_TEST_ID, DATASET_ID)` — idempotent in outcome, but there is no `ActivityEvent` emission, no audit log, no `last_modified_by`, no version increment. A maintainer auditing 'who set this severity to Critical?' has no answer from the platform. This is the audit-log presence asymmetry (per system-mission.md canonicalisation candidate 3) instantiated on the DQ surface: state changes on owned entities are NOT audited here, whereas other state changes (alert status, ownership creation) ARE." — evidence: `ReactiveDataQualityRepositoryImpl.java:87-102` (the upsert; no audit emission visible in the call site) + `DataQualityServiceImpl.java:62-81` (the service method; no `activityRepository` or `ActivityEvent` reference) — severity: MEDIUM

- "**No HTTP-level test exists for any `DataQualityController` endpoint.** `find <odd-platform> -path '*test*' -name 'DataQualityController*'` returned zero matches (run during enrichment 2026-05-20). The calculator tier (`SLAColourTest`, `SLAReportTest`) and the repository tier (`DataQualityRepositoryImplTest`, `ReactiveDataQualityRunsRepositoryTest`) ARE covered, but the boundary that combines them — WebFlux routing + OpenAPI-generated `@RequestMapping` + content-negotiation (especially `image/png` for `getSLA`) + Jackson serialisation + the `existsIncludingSoftDeleted` precheck + the SecurityRule for `setDataQATestSeverity` — is untested. A regression in any of those layers would silently break the endpoints with the build still green." — evidence: `find <odd-platform> -path '*test*' -name 'DataQualityController*'` returned no matches (2026-05-20) — severity: MEDIUM

- "**Default severity fallback to `MAJOR` is silent — a dataset's test with no explicit severity contributes `MAJOR` weight to the SLA calculation.** The SQL-tier left-join mapping at `ReactiveDataQualityRepositoryImpl.java:142-148` returns `DataQualityTestSeverity.MAJOR` for tests with no row in `DATA_QUALITY_TEST_SEVERITY`. This means the SLA colour an operator sees is computed AS IF every unset test were Major — possibly inflating Red / Yellow outcomes when most tests are actually low-importance. There is no operator-facing surface signalling 'this is a default-MAJOR contribution, not an operator-set MAJOR'. A dataset with 100 unset tests and 1 critical-failing test will be Red; the operator-mental-model 'most tests are minor; one critical failed; some yellow' is wrong without disclosing the default-MAJOR." — evidence: `ReactiveDataQualityRepositoryImpl.java:142-148` (the `MAJOR`-as-fallback in the mapper) + `SLACalculator.java:144-149` (the `else` branch treating non-MINOR / non-MAJOR as CRITICAL — for the default-MAJOR case the algorithm treats the test as Major) — severity: MEDIUM (correctness depends on operator awareness of the default)

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` — the three modes that protect the `/api/*` surface this controller is mounted on. Under `DISABLED` all five endpoints become anonymously reachable (no method-level `@ConditionalOnProperty`; auth is enforced globally via `*SecurityConfiguration` beans). `S2S` is not relevant — S2S protects `/ingestion/entities` only, not `/api/datasets/*`. The single registered SecurityRule (`SecurityConstants.java:243-246`) inherits the global mode.
- **ingestion_filter_relevance**: `NO — UI/API surface, not /ingestion/entities`. The `IngestionDataEntitiesFilter` matches `/ingestion/entities` POST only; none of this controller's paths match.
- **authorization_assertions**:
  - "`new SecurityRule(DATA_ENTITY, new PathPatternParserServerWebExchangeMatcher(\"/api/datasets/{data_entity_id}/dataqatests/{dataqa_test_id}/severity\", PUT), DATASET_TEST_RUN_SET_SEVERITY)` — the lone gate, owner-scoped via the `DATA_ENTITY` AuthorizationManagerType (which the `manager(rule.type(), ...)` factory wires to ownership-derived permissions for the dataset entity)" — evidence: `SecurityConstants.java:243-246` + `AuthorizationCustomizer.java:24-27`
  - "[] for `getDataEntityDataQATests`, `getDatasetTestReport`, `getSLA`, `getDatasetSLAReport`" — evidence: `DataQualityController.java:25-48, 63-68` (no annotations) + `SecurityConstants.java:98-355` (no rule entries for the four GET paths) + `AuthorizationCustomizer.java:29-30` (catch-all `.authenticated()`)
- **owner_scoping**:
  - "`getDataEntityDataQATests` — BYPASSES owner-scoping at the repository tier (no `OWNERSHIP` join in `getDataQualityTestOddrnsForDataset`, `ReactiveDataQualityRepositoryImpl.java:46-58`)"
  - "`getDatasetTestReport` — BYPASSES owner-scoping (no OWNERSHIP join in `getDatasetTestReport`, `ReactiveDataQualityRepositoryImpl.java:62-84`)"
  - "`getSLA` — BYPASSES owner-scoping (`getSLA` SQL `ReactiveDataQualityRepositoryImpl.java:105-126`; no OWNERSHIP join, no principal-derived predicate; SLA colour is then mapped to a PNG byte-array)"
  - "`getDatasetSLAReport` — BYPASSES owner-scoping (same `getSLA` SQL path, different result mapper)"
  - "`setDataQATestSeverity` — RESPECTS owner-scoping via SecurityRule (`SecurityConstants.java:243-246`, `DATA_ENTITY` AuthorizationManagerType); caller must be associated with one of the dataset's owners (or the dataset's resolved owner chain per `AuthorizationManagerType.DATA_ENTITY`)"
- **data_exposure**:
  - "DataEntityList (per-dataset DQ test entities) → ANY authenticated user under LOGIN_FORM/OAUTH2/LDAP via `GET /api/datasets/{id}/dataqatests`" — evidence: `DataQualityController.java:25-31` + `DataQualityServiceImpl.java:37-51` + `ReactiveDataQualityRepositoryImpl.java:46-58`
  - "DataSetTestReport (count-per-status aggregate) → ANY authenticated user via `GET /api/datasets/{id}/test_report`" — evidence: `DataQualityController.java:33-39` + `DataQualityServiceImpl.java:53-60`
  - "DataSetSLAReport (severity weights + colour + slaRef) → ANY authenticated user via `GET /api/datasets/{id}/sla_report`" — evidence: `DataQualityController.java:63-68`
  - "SLA colour as a PNG image (1-2KB) → ANY authenticated user via `GET /api/datasets/{id}/sla`; embeddable in BI dashboards without further auth handshake" — evidence: `DataQualityController.java:41-48` + `CachingByteArraySLAResourceResolver.java:44-54`
  - "Same four payloads → ANONYMOUS callers under `auth.type=DISABLED`" — evidence: absence of method-level `@ConditionalOnProperty` + DISABLED mode skips auth globally per `DisabledAuthSecurityConfiguration`
- **known_security_gaps**:
  - "Four read endpoints have no entry in `SecurityConstants.SECURITY_RULES` (`SecurityConstants.java:98-355`) and fall through to `.pathMatchers('/**').authenticated()` (`AuthorizationCustomizer.java:29-30`). The downstream SQL has no owner predicate (`ReactiveDataQualityRepositoryImpl.java:46-58, 62-84, 105-126`). The live data-quality docs (WebFetched 2026-05-20, three pages all status 200) make no statement about access control. NEW invocation sites of the REFACTOR-024 cross-owner-read family, applied to P-04 Data Quality." — evidence: `DataQualityController.java:25-48, 63-68` + `SecurityConstants.java:98-355` + `AuthorizationCustomizer.java:29-30` + `ReactiveDataQualityRepositoryImpl.java:46-58, 62-84, 105-126` + WebFetch data-quality + sla-statuses + test-results-import pages 2026-05-20 — severity: MEDIUM (under ADR-CANDIDATE-003 read-collaborative posture this is intentional; documentation drift is the actionable finding)
  - "`getSLA` PNG endpoint is embeddable cross-origin (image content-type; no CORS restriction visible at the method or path level). A malicious page could `<img src='{platform_url}/api/datasets/123/sla'>` to extract the SLA colour for dataset 123 — combined with CSRF-token authentication via cookie, this is a cookie-bearing read that reveals the SLA colour to any embedding page. If the operator deploys the platform with cookie-based auth and the BI-tool embedding context spans untrusted pages, the SLA colour for any dataset id leaks to any embedding page. Severity depends on how operators treat the SLA colour: if Green/Yellow/Red is sensitive (e.g. 'this finance dataset is failing'), this is a HIGH; if treated as public, LOW." — evidence: `DataQualityController.java:42-48` (no `@CrossOrigin`, no `Cache-Control: private`, no `X-Frame-Options` set at this layer; per OpenAPI spec `openapi.yaml:1888-1894` the endpoint produces image/png with no special headers) — severity: LOW-MEDIUM (depends on operator deployment + SLA-as-data-sensitivity)
  - "Under `auth.type=DISABLED`, all five endpoints become anonymously reachable. DISABLED is documented as a dev-only mode (per `documentation/docs/configuration-and-deployment/enable-security/authentication.md`), but a misconfigured production deployment would expose per-dataset DQ data and SLA colours to anyone on the network." — evidence: `DataQualityController.java:25-68` (no method-level conditional) + absence of any SecurityRule for the four reads + the registered SecurityRule for the PUT also being bypassed under DISABLED — severity: LOW (operator misuse of dev-only mode)

## performance

- **hot_paths**:
  - "`getDataEntityDataQATests` and `getDatasetTestReport` are called on every dataset detail page's 'Test reports' tab activation (per live doc `documentation/docs/data-quality.md:11`: 'from any data entity's Test reports tab'). For a catalog with many datasets, the per-render cost compounds." — evidence: `DataQualityController.java:25-39` + WebFetch data-quality page 2026-05-20
  - "`getSLA` PNG endpoint is potentially embedded in BI dashboards (per live doc `documentation/docs/data-quality/sla-statuses.md:34`: 'BI tools can fetch this endpoint per dataset and render the colour as a one-glance trust signal next to dashboard tiles or report sections'). For a BI dashboard with N tiles each pulling the SLA for a different dataset, the request fan-out is N per dashboard render. The PNG byte-array is cached in memory at the resolver layer (`CachingByteArraySLAResourceResolver.java:15`), so the per-request cost is the SQL aggregation + the byte-array copy; the PNG-file IO is NOT per-request." — evidence: `DataQualityController.java:41-48` + `CachingByteArraySLAResourceResolver.java:13-25, 30-42`
- **throughput_characteristics**:
  - "All four reads are reactive `Mono<ResponseEntity<T>>` — non-blocking I/O; no thread is held during the DB await" — evidence: `DataQualityController.java:25-68`
  - "`setDataQATestSeverity` is `@ReactiveTransactional` (`DataQualityServiceImpl.java:63`) — the existence-check + the upsert run in a single reactive transaction" — evidence: `DataQualityServiceImpl.java:63-81`
  - "No batch / bulk variant — `setDataQATestSeverity` operates on a single (test, dataset) pair per call; an operator setting severities for 50 tests issues 50 PUTs" — evidence: `DataQualityController.java:51-61` (signature accepts single ids and single severity form)
- **resource_allocation**:
  - "`getDataEntityDataQATests` collects every test ODDRN for the dataset into a `List<String>`, then runs two parallel reactive sub-queries (severities, dimensions) zipped with `Mono.zip` — peak memory is bounded by the dataset's test count" — evidence: `DataQualityServiceImpl.java:42-49`
  - "`getDatasetTestReport` aggregates the `DATA_ENTITY_TASK_LAST_RUN.STATUS` counts via SQL `GROUP BY` (`ReactiveDataQualityRepositoryImpl.java:66-84`) — the data flowing to the JVM is at most 6 rows (one per status enum value)" — evidence: `ReactiveDataQualityRepositoryImpl.java:79-83`
  - "`getSLA` / `getSLAReport` collect every test-status-with-severity row for the dataset into a `List<TestStatusWithSeverityDto>` then iterate via `Counter.add` in `SLACalculator` — peak memory and CPU are bounded by the dataset's test count" — evidence: `DataQualityServiceImpl.java:84-93, 95-101` + `SLACalculator.java:22-26, 72-76, 123-151`
  - "PNG resolver caches all 3 SLA images in memory at bean init via `ByteArrayResource` (`CachingByteArraySLAResourceResolver.java:30-42`) — total cached bytes ~3-6 KB; no per-request allocation beyond the `ResponseEntity` wrapper" — evidence: `CachingByteArraySLAResourceResolver.java:15-42`
- **scaling_characteristics**:
  - "Stateless controller — horizontal scaling unconstrained at this layer" — evidence: `DataQualityController.java:21-69` (no instance state beyond the two `@RequiredArgsConstructor`-injected dependencies)
  - "No pagination on `getDataEntityDataQATests` — the response is the full list of DQ tests for the dataset; a dataset with 10K+ tests degrades response time (and serialisation cost) linearly. The OpenAPI spec at `openapi.yaml:1932-1947` declares no `page` / `size` parameters." — evidence: `DataQualityController.java:25-31` + `openapi.yaml:1932-1947`
  - "Single DB round-trip per request for `getDatasetTestReport`, `getSLA`, `getSLAReport`; two parallel sub-queries for `getDataEntityDataQATests` (severities + dimensions zipped)" — evidence: `DataQualityServiceImpl.java:37-51, 54-60, 84-101`
  - "`setDataQATestSeverity` upsert via `onDuplicateKeyUpdate` — single SQL statement, no advisory lock, no row-level lock beyond Postgres's implicit unique-constraint check; concurrent PUTs to the same (test, dataset) converge on whichever wins the upsert" — evidence: `ReactiveDataQualityRepositoryImpl.java:90-101`
- **known_performance_gaps**:
  - "No pagination on `getDataEntityDataQATests` — a dataset with thousands of tests returns thousands of rows in one response; UI must render all at once. No `@Max`, no client-side hint, no server-side clamp." — evidence: `DataQualityController.java:25-31` + `openapi.yaml:1932-1947` — severity: MEDIUM
  - "No HTTP caching headers (`Cache-Control`, `ETag`, `Last-Modified`) on any response — every UI tab activation and every BI-dashboard render hits the platform fresh. For the PNG endpoint specifically, the response body is fully determined by `(datasetId, current_test_states)` — an `ETag` derived from the underlying state would let BI tools cache. The PNG byte-array is small (1-2 KB) so the network cost is low; the SQL cost per request is the real expense." — evidence: `DataQualityController.java:25-68` (no header manipulation) + `CachingByteArraySLAResourceResolver.java:18-25` (no ETag computation) — severity: LOW-MEDIUM (depends on BI-render frequency)
  - "Default-MAJOR fallback for unset severities (per `bugs_limitations_corner_cases[6]`) inflates the work `SLACalculator` does — every unset test contributes to MAJOR weight calculation, multiplying through the hierarchical Counter arithmetic (`SLACalculator.java:37-60`). For a dataset with 10K unset tests, the Counter additions are O(N) but the SLA-colour computation is O(1) at the end; no real CPU regression, but the per-request data volume grows." — evidence: `ReactiveDataQualityRepositoryImpl.java:142-148` + `SLACalculator.java:22-26, 123-151` — severity: LOW
  - "No method-level observability — no `@Timed`, no Micrometer counter, no structured log entry on any of the five methods. Latency regressions on hot paths (per-dataset Test-reports tab; BI-dashboard SLA fan-out) surface only in WebFlux / DB metrics, not at the controller boundary." — evidence: `DataQualityController.java:25-68` (no observability annotations) — severity: LOW

## sources

- understanding ← `DataQualityController.java:1-69` (full file) + `DataQualityServiceImpl.java:29-102` (service implementation) + `CachingByteArraySLAResourceResolver.java:14-54` (PNG-resource adapter) + `SLACalculator.java:18-152` (the calculator) + `SecurityConstants.java:243-246` (the one registered rule) + `documentation/docs/data-quality.md:7-9` (pillar invariant)
- concepts.entities ← `DataQualityController.java:5-11` (imports — return types) + `components.yaml:1134-1156` (DataSetSLAReport schema) + `components.yaml:1177-1203` (DataSetTestReport schema) + `components.yaml:989-995` (DataQualityTestSeverityForm) + `SLAResourceResolver.java:7` (SLA enum reference)
- concepts.operations ← `DataQualityController.java:25-68` (the five `@Override` method bodies) + `openapi.yaml:1880-1971` (the five operation IDs and paths)
- concepts.invariants[0] ← `DataQualityController.java:25-68` (all five return `Mono<ResponseEntity<T>>` and `.map(ResponseEntity::ok)`)
- concepts.invariants[1] ← `DataQualityController.java:26, 34, 42, 52, 64` (all five take `dataEntityId` — the dataset Data Entity ID)
- concepts.invariants[2] ← `DataQualityServiceImpl.java:55-57, 67-77, 96-98` (three call sites of `existsIncludingSoftDeleted`) + `DataQualityServiceImpl.java:39-42` (the lone exception — empty-list NotFoundException)
- concepts.invariants[3] ← `SLACalculator.java:81-83` (`getMinorsCount == 0 && getMajorsCount == 0 && getCriticalCount == 0 → YELLOW`)
- concepts.invariants[4] ← `ReactiveDataQualityRepositoryImpl.java:142-148` (the `mapLastRunDto` default-MAJOR branch)
- concepts.invariants[5] ← `openapi.yaml:1880-1896` (the image/png content-type declaration) + `CachingByteArraySLAResourceResolver.java:30-42, 44-54` (the resource cache at bean init)
- concepts.invariants[6] ← `SLACalculator.java:37-60` (the hierarchical-multiplicative weight algorithm)
- concepts.audiences ← WebFetch `https://docs.opendatadiscovery.org/features/data-quality` 2026-05-20 status 200 + WebFetch `https://docs.opendatadiscovery.org/features/data-quality/sla-statuses` 2026-05-20 status 200
- dependencies_semantic.requires-feature ← WebFetch data-quality + sla-statuses + test-results-import pages 2026-05-20 status 200 (3 pages) + `SLACalculator.java:18-19` + `SecurityConstants.java:243-246`
- dependencies_semantic.requires-runtime[0] ← `DataQualityController.java:13-17`
- dependencies_semantic.requires-runtime[1] ← `DataQualityController.java:16-17, 25-68`
- dependencies_semantic.requires-runtime[2] ← `ReactiveDataQualityRepositoryImpl.java:38-44`
- dependencies_semantic.requires-runtime[3] ← `DataQualityController.java:12, 42` + `CachingByteArraySLAResourceResolver.java:8-10`
- dependencies_semantic.requires-runtime[4] ← `CachingByteArraySLAResourceResolver.java:30-54` + `find <odd-platform> -path '*resources/sla*'` returned the three PNG files (verified 2026-05-20)
- dependencies_semantic.couples-to[0] ← `DataQualityController.java:4, 21` (the `implements DataQualityApi`) + `openapi.yaml:1880-1971` (the five operations under the `dataQuality` tag)
- dependencies_semantic.couples-to[1] ← `DataQualityController.java:10, 22, 28-29, 36-37, 44-45, 58-59, 66-67` (the service field + every method delegating to it) + `DataQualityServiceImpl.java:29-35` (the impl's injected dependencies)
- dependencies_semantic.couples-to[2] ← `DataQualityController.java:11, 23, 46` + `CachingByteArraySLAResourceResolver.java:14`
- dependencies_semantic.couples-to[3] ← `SecurityConstants.java:243-246` + `AuthorizationCustomizer.java:24-30`
- tests_coverage_semantic.covered_behaviours[0] ← `SLAColourTest.java:13-50+` (read full file — exhaustive coverage of `calculateSLA`)
- tests_coverage_semantic.covered_behaviours[1] ← `SLAReportTest.java:16-50+` (read full file — `getSLAReport` coverage)
- tests_coverage_semantic.test_files ← `find <odd-platform> -path '*test*' -name '*SLA*'` 2026-05-20 returned the two SLA tests; `find <odd-platform> -path '*test*' -name 'DataQuality*'` returned the two repository tests; `find <odd-platform> -path '*test*' -name 'DataQualityController*'` returned NO matches
- docs_link_semantic.inferred_docs[0] ← WebFetch `https://docs.opendatadiscovery.org/features/data-quality` 2026-05-20 status 200
- docs_link_semantic.inferred_docs[1] ← WebFetch `https://docs.opendatadiscovery.org/features/data-quality/sla-statuses` 2026-05-20 status 200
- docs_link_semantic.inferred_docs[2] ← WebFetch `https://docs.opendatadiscovery.org/features/data-quality/test-results-import` 2026-05-20 status 200
- docs_link_semantic.doc_drift_findings[0] (the PNG vs JSON drift) ← WebFetch `sla-statuses.md` 2026-05-20 ("returns a DataSetSLAReport") + `openapi.yaml:1880-1896` (`image/png` content-type) + `DataQualityController.java:42-48` + `CachingByteArraySLAResourceResolver.java:44-54`
- docs_link_semantic.doc_drift_findings[1] (read-endpoint authorization silent) ← WebFetch data-quality + sla-statuses + test-results-import pages 2026-05-20 (all silent) + `SecurityConstants.java:243-246` (only PUT rule registered)
- docs_link_semantic.doc_drift_findings[2] (set-severity audience under-specified) ← WebFetch `sla-statuses.md` 2026-05-20 ("Severities are operator-set") + `SecurityConstants.java:243-246` (the DATA_ENTITY-scoped permission gate)
- implicit_adrs[0] (asymmetrical owner-scoping) ← `DataQualityController.java:25-68` + `SecurityConstants.java:243-246` + `AuthorizationCustomizer.java:24-30`
- implicit_adrs[1] (existsIncludingSoftDeleted) ← `DataQualityServiceImpl.java:55, 67, 96` (three call sites)
- implicit_adrs[2] (SLA as PNG) ← `DataQualityController.java:42-48, 63-68` (two endpoint paths) + `openapi.yaml:1880-1913` + `CachingByteArraySLAResourceResolver.java:44-49`
- implicit_adrs[3] (deterministic aggregation) ← `SLACalculator.java:80-121` + `SLAColourTest.java:17-...` (the tests treat the algorithm as the spec) + `documentation/docs/data-quality/sla-statuses.md:44`
- implicit_adrs[4] (aggregator-only pillar invariant) ← `DataQualityController.java:25-68` + `DataQualityService.java:11-23` + `documentation/docs/data-quality.md:9`
- bugs_limitations_corner_cases[0] (cross-owner reads) ← `DataQualityController.java:25-48, 63-68` + `SecurityConstants.java:98-355` + `AuthorizationCustomizer.java:29-30` + `ReactiveDataQualityRepositoryImpl.java:46-58, 62-84, 105-126, 130-138` + WebFetch data-quality docs 2026-05-20
- bugs_limitations_corner_cases[1] (PNG vs JSON drift) ← `DataQualityController.java:42-48` + `CachingByteArraySLAResourceResolver.java:30-54` + `openapi.yaml:1880-1896` + WebFetch `sla-statuses.md` 2026-05-20
- bugs_limitations_corner_cases[2] (404 on empty list) ← `DataQualityServiceImpl.java:39-42` + comparison with `DataQualityServiceImpl.java:54-60`
- bugs_limitations_corner_cases[3] (classpath PNG fragility) ← `CachingByteArraySLAResourceResolver.java:30-54` + `find <odd-platform> -path '*resources/sla*'` 2026-05-20
- bugs_limitations_corner_cases[4] (audit-trail absence on severity changes) ← `ReactiveDataQualityRepositoryImpl.java:87-102` + `DataQualityServiceImpl.java:62-81`
- bugs_limitations_corner_cases[5] (no controller test) ← `find <odd-platform> -path '*test*' -name 'DataQualityController*'` empty 2026-05-20
- bugs_limitations_corner_cases[6] (default-MAJOR fallback) ← `ReactiveDataQualityRepositoryImpl.java:142-148` + `SLACalculator.java:144-149`
- security.auth_mode_relevance ← `DataQualityController.java:25-68` (no method-level conditional) + system-wide auth wiring per AlertController class sidecar references
- security.ingestion_filter_relevance ← path-prefix comparison: `/api/datasets/*` vs `/ingestion/entities` (the IngestionDataEntitiesFilter target)
- security.authorization_assertions[0] ← `SecurityConstants.java:243-246` + `AuthorizationCustomizer.java:24-27`
- security.authorization_assertions[1] ← `DataQualityController.java:25-48, 63-68` + `SecurityConstants.java:98-355` + `AuthorizationCustomizer.java:29-30`
- security.owner_scoping ← `ReactiveDataQualityRepositoryImpl.java:46-58, 62-84, 105-126, 130-138` (no OWNERSHIP join in any read query) + `SecurityConstants.java:243-246` (the registered PUT rule with DATA_ENTITY type)
- security.data_exposure[0-4] ← (per-endpoint citations in `understanding` + `bugs_limitations_corner_cases[0]`)
- security.known_security_gaps[0] (cross-owner reads — REFACTOR-024 family extension) ← `DataQualityController.java:25-48, 63-68` + `SecurityConstants.java:98-355` + `AuthorizationCustomizer.java:29-30` + `ReactiveDataQualityRepositoryImpl.java:46-58, 62-84, 105-126` + WebFetch 3 data-quality docs 2026-05-20
- security.known_security_gaps[1] (SLA PNG cross-origin embeddability) ← `DataQualityController.java:42-48` + `openapi.yaml:1880-1896`
- security.known_security_gaps[2] (DISABLED mode reach) ← `DataQualityController.java:25-68` + DISABLED-mode global wiring (per cross-sidecar `DisabledAuthSecurityConfiguration` reference)
- performance.hot_paths[0] ← `DataQualityController.java:25-39` + WebFetch data-quality page 2026-05-20
- performance.hot_paths[1] ← `DataQualityController.java:41-48` + `CachingByteArraySLAResourceResolver.java:13-25, 30-42` + WebFetch sla-statuses page 2026-05-20
- performance.throughput_characteristics[0] ← `DataQualityController.java:25-68` (all reactive Mono signatures)
- performance.throughput_characteristics[1] ← `DataQualityServiceImpl.java:63` (`@ReactiveTransactional`)
- performance.throughput_characteristics[2] ← `DataQualityController.java:51-61`
- performance.resource_allocation[0-3] ← `DataQualityServiceImpl.java:42-49, 84-101` + `ReactiveDataQualityRepositoryImpl.java:66-84, 105-126` + `SLACalculator.java:22-26, 72-76, 123-151` + `CachingByteArraySLAResourceResolver.java:15-42`
- performance.scaling_characteristics[0] ← `DataQualityController.java:21-69` (no instance state)
- performance.scaling_characteristics[1] ← `DataQualityController.java:25-31` + `openapi.yaml:1932-1947` (spec declares no page/size params)
- performance.scaling_characteristics[2] ← `DataQualityServiceImpl.java:37-51, 54-60, 84-101`
- performance.scaling_characteristics[3] ← `ReactiveDataQualityRepositoryImpl.java:90-101`
- performance.known_performance_gaps[0-3] ← citations above + absence-of-instrumentation observed in `DataQualityController.java:25-68`

## confidence_per_field

- understanding: HIGH (every claim verified against the source file, the service implementation, the SLA calculator, the resource resolver, the OpenAPI spec, and the live pillar doc at cited lines)
- concepts: HIGH (entities, operations, invariants, audiences all anchored to file:line or live-doc fetched excerpts)
- dependencies_semantic: HIGH (couplings traceable through the OpenAPI generation, the `@RequiredArgsConstructor` injection, and the centralised SecurityRule registration)
- tests_coverage_semantic: HIGH (covered behaviours verified by reading the calculator-tier test bodies; uncovered behaviours verified by file-system absence-of-controller-test)
- docs_link_semantic: HIGH (three live URLs WebFetched 2026-05-20 status 200; the PNG-vs-JSON drift is a concrete code-vs-doc divergence with file:line + URL evidence; the binding endpoint→doc is supported by the live pages' explicit endpoint-name mentions)
- implicit_adrs: HIGH (each ADR has an intent_anchor verifiable in code or the doc page; the asymmetrical owner-scoping is a DELIBERATE registration choice in `SecurityConstants.java:243-246`, not an accidental absence)
- bugs_limitations_corner_cases: HIGH (each gap is verified file:line against the controller, service, repository, security-rule list, OpenAPI spec, and live doc excerpts; routing per file-analyser 0.2.0 — these are absence observations OR observable deviations from documented behaviour, not decisions with defending intent)
- security: HIGH (the asymmetrical posture is structurally visible; the cross-owner read-posture extends the REFACTOR-024 family; the PNG cross-origin observation is the new file-local signal)
- performance: HIGH (every claim traces to the controller, service, repository, SLA calculator, or resource resolver at cited lines)

## Maintainer notes


---
node_id: "odd-platform java IngestionController controller-class:IngestionController"
node_kind: controller-class
axis: controllers
extracted_at_commit: 4ec2b20
enriched_at_commit: 4ec2b20
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-25-batch-ZF-IngestionController
feature_hint: "P-10:F-001 Batch Ingestion (class-level CONSOLIDATION of the 5-method S2S surface: POST /ingestion/datasources, POST /ingestion/entities, POST /ingestion/entities/datasets/stats, POST /ingestion/metrics, GET /ingestion/dataentitygroups/{deg_oddrn}/entities). DISJOINT from the 11 UI-side controllers under /api/* (DataSourceController, DataEntityController, etc.) — same persistence tables, separate path family, separate auth model, separate Spring SecurityWebFilterChain entry-point. This sidecar's load-bearing contribution: the class-level META-FACTS — controller-wide auth posture, 4-mode auth disjointness, two-filter asymmetric coverage, session-vs-payload identity bifurcation across the 5 handlers, response-code drift across the 3 mutating handlers, transaction-boundary disagreement across the 3 mutating service paths."
related_features:
  - F-008
related_pillar_features:
  - P-10:F-001
related_refactoring_scopes:
  - REFACTOR-185  # DISABLED-mode bypass cluster — class-level entry surfaces 4 of the 5 endpoints as DISABLED-bypassable
  - REFACTOR-073  # ingestion-filter path coverage incomplete cluster
related_concepts:
  - ingestion-authentication-filter
  - ingestion-datasource-filter
  - default-off-ingestion-auth
  - ingestion-filter-path-coverage-incomplete
  - collector-token-session-binding
  - shared-secret-tokens-stored-plaintext
  - openapi-200-vs-201-status-code-drift
  - audit-log-presence-asymmetry-2-tier-audit-story
  - two-ingestion-filters-asymmetric-auth
related_implicit_adrs:
  - ADR-CANDIDATE-142  # SECONDARY EVIDENCE — controller-class confirms by 5-method-roll-up that the partial-merge UPSERT is S2S-only
  - ADR-CANDIDATE-143  # SECONDARY EVIDENCE — controller-class confirms the namespace-from-collector convention is S2S-only
related_retrospectives:
  - LSN-001  # attachment-ephemeral-default class-of-failure — applies here as "default-off-ingestion-auth" same-shaped silent insecure default
upstream_callers:
  - "odd-collector (pull) — `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security` (WebFetched 2026-05-25 status 200, verbatim relevant excerpt: 'Ingestion | Collectors and push adapters calling `/ingestion/**` | `auth.ingestion.filter.enabled` (default `false`)'). Every odd-collector process is an upstream caller of this class — typical lifecycle: (1) `POST /ingestion/datasources` at startup to register, (2) `POST /ingestion/entities` per ingestion tick, (3) `POST /ingestion/metrics` for per-entity metric series, (4) `POST /ingestion/entities/datasets/stats` for column-level statistics from the profiler. The 5th method `GET /ingestion/dataentitygroups/{deg_oddrn}/entities` is the read-side companion called by collectors that need to enumerate DEG membership."
  - "odd-collector-sdk custom-collector authors — same lifecycle obligation. The published `PlatformApi` Maven client invokes all 5 methods via the OpenAPI-generated `IngestionApi` interface."
  - "Push adapters (`odd-airflow-2`, `odd-dbt`, `odd-spark-adapter`, `odd-great-expectations`) — call `POST /ingestion/entities` per pipeline event; some also call `POST /ingestion/entities/datasets/stats` when emitting profile snapshots."
  - "odd-collector-profiler — the statistical-profiling collector. Per live docs at `https://docs.opendatadiscovery.org/active-platform-features/data-quality-and-tests` (WebFetched in batch Z sidecar postDataSetStatsList:audiences[0], 2026-05-20 status 200 verbatim: 'ODD covers Data Quality fully as an aggregator'): the profiler pushes to `POST /ingestion/entities/datasets/stats`."
  - "Unauthenticated network probes — under default deployment (auth.type=DISABLED + auth.ingestion.filter.enabled=false + auth.s2s.enabled=false), ANY caller able to reach the platform's port 8080 reaches 4 of the 5 endpoints on this controller without credentials. Only `POST /ingestion/datasources` requires a valid `Authorization: Bearer <collector-token>` header (unconditional filter)."
  - "NOT a caller (load-bearing distinction): the UI controllers (DataEntityController, DatasetController, DataSourceController) do NOT route through THIS controller. The 5 handlers here are S2S-only; same persistence tables (data_entity, data_source, dataset_field) on the storage side, but completely separate request paths and separate Spring SecurityWebFilterChain entry-points."
downstream_side_effects:
  - "5 method-level delegations to 4 distinct services: (1) `ingestionService.ingest(...)` (postDataEntityList line 43 → IngestionServiceImpl.java:66-74 @ReactiveTransactional → DataEntityIngestionDtoSplitter chain: hollow-fill, structure-version, metadata, runs, alerts, lineage, view-popularity, search-vectors), (2) `dataSourceIngestionService.createDataSources(...)` (createDataSource line 70-71 → DataSourceIngestionServiceImpl.createDataSources @ReactiveTransactional → upsert-by-ODDRN-merging-only-name+description), (3) `dataEntityGroupService.listEntitiesWithinDEG(...)` (getDataEntitiesByDEGOddrn line 78 → DataEntityGroupServiceImpl.listEntitiesWithinDEG flat-SELECT, NO @ReactiveTransactional — read-only), (4) `ingestionService.ingestStats(...)` (postDataSetStatsList line 85 → IngestionServiceImpl.java:76-79 ONE-LINE-DELEGATE → DatasetFieldServiceImpl.updateStatistics @ReactiveTransactional → JSONB-blob-replace + EXTERNAL_STATISTICS-tag-side-effect + FTS-vector-recalc), (5) `ingestionMetricsService.ingestMetrics(...)` (ingestMetrics line 93 → IngestionMetricsService — DUAL implementation switched by `metrics.storage` ∈ {INTERNAL_POSTGRES default-on, PROMETHEUS}: internal writes `metric_series` + `metric_point` Postgres tables; PROMETHEUS does Snappy-compressed remote-write to `metrics.prometheus-host`)."
  - "db-write side effects on 4 of 5 methods. The READ method (`getDataEntitiesByDEGOddrn`) performs a single SELECT against `group_entity_relations` joined to `data_entity` — no mutations. The 4 mutating handlers' transaction boundaries DISAGREE: `postDataEntityList` and `createDataSource` are annotated `@ReactiveTransactional` at the IMMEDIATE service layer (IngestionServiceImpl.java:66, DataSourceIngestionServiceImpl.java:40); `postDataSetStatsList` defers the boundary TWO frames downstream to `DatasetFieldServiceImpl.updateStatistics` (line 159); `ingestMetrics` defers similarly to the INTERNAL_POSTGRES implementation's `@ReactiveTransactional`. There is no comment in IngestionServiceImpl explaining the inconsistency (verified: read IngestionServiceImpl.java end-to-end)."
  - "session-state side effects: `createDataSource` (line 47-73) is the ONLY method on this controller that READS the WebSession (lines 50-58 — reads `SessionConstants.COLLECTOR_ID_SESSION_KEY`). The session attribute is WRITTEN upstream by `IngestionDataSourceFilter.java:37-38` BEFORE this controller method runs. The other 4 methods do NOT read the session. The asymmetry is silent: `postDataEntityList` identifies the target datasource via PAYLOAD field `dataSourceOddrn` (IngestionDataEntitiesFilter.java:43 reads it from the body for token validation); `createDataSource` identifies the parent collector via SESSION state (controller line 50-58). Two ENTIRELY DIFFERENT identity-resolution mechanisms across two sibling methods on the same controller."
  - "Auth-failure shape side effects: `createDataSource` throws `IllegalStateException(\"Collector id is null\")` (line 54) when session attribute is missing — propagates as **HTTP 500** via the default reactive error handler (NOT 401). An operator probing `/ingestion/datasources` without going through the `IngestionDataSourceFilter` first cannot distinguish 'session missing' from 'server crashed'. `postDataEntityList` and `postDataSetStatsList` and `ingestMetrics` have no equivalent fail-loud check — they accept anonymous requests when the filter is unregistered (default deployment). `BadUserRequestException(\"Ingestion Data Sources' payload is invalid\")` (line 63) and `BadUserRequestException(\"Ingestion payload is empty\")` (line 42) are the only two caller-visible BAD_REQUEST errors emitted by the controller body."
  - "Response-code drift across the 3 mutating handlers: `postDataEntityList` returns **200 OK** (line 44, `ResponseEntity.ok().build()`); `postDataSetStatsList` returns **201 Created** (line 86, `HttpStatus.CREATED`); `ingestMetrics` returns **201 Created** (line 94, `HttpStatus.CREATED`); `createDataSource` returns **200 OK** (line 72). Per the postDataEntityList sibling sidecar (concepts.invariants[2]), the OpenAPI specification declares 201 Created for postDataEntityList — code disagrees with spec. The spec-drift has shipped and is locked in by `BaseIngestionTest.java:79` asserting `expectStatus().isOk()` (200) for postDataEntityList vs `isCreated()` (201) for ingestStatistics/ingestMetrics (lines 87, 95). This is the canonical case-study of the `openapi-200-vs-201-status-code-drift` concept (cross-pillar from `concepts/detail/invariants/openapi-200-vs-201-status-code-drift.yaml`)."
  - "NO Activity Event emission for ANY mutation through this controller — verified by Grep for `ActivityEvent` across IngestionServiceImpl, DataSourceIngestionServiceImpl, DatasetFieldServiceImpl.updateStatistics, IngestionMetricsService implementations. The Datasources tab (P-08) shows the registered datasource at next refresh, the Catalog (P-04) shows the ingested entity at next index — but the operator-visible audit trail of WHO/WHEN registered or ingested it does NOT exist. Strengthens the cross-pillar `audit-log-presence-asymmetry-2-tier-audit-story` concept: ingestion-path mutations are invisible to the Activity Feed regardless of which sibling method triggered them."
  - "Tag-namespace side-channel via postDataSetStatsList: a `DataSetFieldStat.tags` payload causes `tagService.getOrCreateTagsByName(...)` (DatasetFieldServiceImpl.java:202) to CREATE the tag rows if absent — bypassing the UI-side `TAG_CREATE` RBAC gate (SecurityConstants.java:138, PolicyPermissionDto.TAG_CREATE). Under default deployment this is REACHABLE BY ANY CALLER (no filter coverage on /ingestion/entities/datasets/stats per IngestionDataEntitiesFilter.java:28). Per batch-Z postDataSetStatsList sidecar uncovered_behaviours[6]."
coherence_check:
  performed: true
  strengthens:
    - "F-008 (P-10:F-001 Batch Ingestion) `default_off_unauthenticated_ingestion_at_filter_layer` drift facet — **STRENGTHENS by CLASS-LEVEL CONSOLIDATION**. Previously the per-method sidecars established the per-endpoint auth posture. This class-level sidecar PROVES by enumeration: of the 5 handlers, ONLY `createDataSource` (1/5) is unconditionally authenticated; the other 4 (`postDataEntityList`, `postDataSetStatsList`, `ingestMetrics`, `getDataEntitiesByDEGOddrn`) are unauthenticated in 3 of 4 auth modes (DISABLED, OAUTH2, LDAP) by default — only `postDataEntityList` becomes authenticated when an operator OPTS IN via `auth.ingestion.filter.enabled=true`. The two other unauthenticated mutating handlers (`postDataSetStatsList`, `ingestMetrics`) and the one unauthenticated reading handler (`getDataEntitiesByDEGOddrn`) REMAIN unauthenticated even when the operator opts in, because `IngestionDataEntitiesFilter.java:28` matches exact-literal `/ingestion/entities` POST. The class-level surface area is therefore: 4 of 5 endpoints reachable unauthenticated under default deployment; 3 of 5 endpoints reachable unauthenticated EVEN with the security toggle enabled. Strengthens because the previous per-method evidence presented as 5 separate facts; this sidecar presents as a SINGLE controller-class shape."
    - "Concept `ingestion-filter-path-coverage-incomplete` — **STRENGTHENS** with the explicit class-roll-up of the filter coverage matrix: `POST /ingestion/datasources` → covered by IngestionDataSourceFilter (unconditional); `POST /ingestion/entities` → covered by IngestionDataEntitiesFilter (conditional, default-off); `POST /ingestion/entities/datasets/stats` → COVERED BY NO FILTER (the IngestionDataEntitiesFilter exact-matcher does NOT match this nested path); `POST /ingestion/metrics` → COVERED BY NO FILTER; `GET /ingestion/dataentitygroups/{deg_oddrn}/entities` → COVERED BY NO FILTER. The naming of the toggle (`auth.ingestion.filter.enabled` — singular 'filter') is misleading at the controller-class level: only TWO filter classes exist; they cover TWO endpoints exactly; THREE endpoints have no filter coverage; the property name suggests global ingestion protection."
    - "REFACTOR-185 (DISABLED-mode bypass cluster) — **STRENGTHENS** with the IngestionController class-level evidence. Under `auth.type=DISABLED` the `DisabledAuthSecurityConfiguration` configures `.anyExchange().permitAll()` (line 16) — meaning the platform-wide SecurityWebFilterChain is bypassed entirely. The IngestionDataSourceFilter and IngestionDataEntitiesFilter beans STILL register if their conditions match, but the DISABLED stance creates a composition vulnerability per batch-P createDataSourceEntity sidecar: under DISABLED, the UI is open → an attacker can `POST /api/collectors` (no auth required), receive a fresh collector token in the response, then `POST /ingestion/datasources` with that token, then `POST /ingestion/entities` with the matching dataSourceOddrn. The DISABLED-mode bypass for ingestion is therefore not blocked by IngestionDataSourceFilter (which DOES require a valid token) because the token can be self-issued via the UI. The class-level evidence: under DISABLED, ALL 5 handlers are reachable for arbitrary writes/reads to ALL data."
    - "ADR-CANDIDATE-142 (partial-merge UPSERT semantics — S2S-only) — **STRENGTHENS by CLASS-LEVEL COUNTERFACTUAL**. The class-level view confirms ADR-142 is the ASYMMETRY between THIS controller (S2S, narrow merge for createDataSource) and DataSourceController (UI, full-form replace). The architectural intent visible at the class level: 'collectors own the IDENTITY of a datasource (ODDRN, namespace via Collector); operators own the METADATA (name, description, connection_url, type, owner) via the UI'. The 5-handler class-level surface ENFORCES this division: createDataSource is the ONLY mutating endpoint here that touches DataSourcePojo, and it narrows to name+description. The other 4 handlers touch other tables (data_entity, dataset_field, metric_series, group_entity_relations). The architectural division is consistent."
    - "ADR-CANDIDATE-143 (namespace inherited from Collector, S2S-only) — **STRENGTHENS** with the class-level evidence: createDataSource is the SOLE handler on this controller that creates/updates DataSourcePojo, and it inherits namespace from `CollectorDto.namespace()` (DataSourceIngestionServiceImpl.java:106 per batch-P sidecar). The UI counterpart (DataSourceController.registerDataSource) accepts namespace from the form. The class-level view confirms: the ingestion controller has ZERO endpoints that accept a namespace from the payload."
    - "Concept `openapi-200-vs-201-status-code-drift` — **STRENGTHENS** with the explicit class-level enumeration: 3 mutating endpoints, 3 different response code postures (200/201/201) — postDataEntityList is the lone drifter. The class-level view makes the drift IMPOSSIBLE TO MISS: a maintainer reading this controller sees the inconsistency at a glance (line 44 returns ok() vs line 86 + 94 return CREATED). The class-level evidence corroborates and STRENGTHENS the existing `concepts/detail/invariants/openapi-200-vs-201-status-code-drift.yaml` invariant by providing the file:line anchor where the drift visibly lives."
    - "Retrospective LSN-001 (attachment-ephemeral-default — class-of-failure: silent insecure default in shipped config) — **STRENGTHENS** the LSN's class-of-failure surface coverage. The IngestionController class-level evidence: `application.yml:48` ships `auth.ingestion.filter.enabled: false` with no warning, no operator-visible signal that 4 of 5 endpoints are reachable unauthenticated. This is THE SAME CLASS-OF-FAILURE LSN-001 documents: an insecure default shipped in the bundled YAML, operators following the install guide without realizing they have an unprotected ingestion surface. The retrospective applies here directly; the controller-class is a 2026-04 retrospective's recurrent shape."
  supersedes: []
  conflicts_surfaced:
    - "OBSERVATION (NOT a conflict, refinement): The class-level enumeration of method count (5) DIFFERS from the @Override count one would expect by counting IngestionApi methods. The controller implements 5 of the IngestionApi methods; if the upstream OpenAPI ingestion contract adds new operations (e.g. `POST /ingestion/lineage` per hypothetical Lineage-as-first-class promotion), the abstract Spring contract would supply a default `not-implemented` method, but THIS controller would silently fail to handle new operations. There is no `// remaining methods inherit IngestionApi defaults` comment; a reviewer cannot tell from THIS file what the full ingestion API surface is. Severity: LOW (the gradle dep pins `io.github.opendatadiscovery:opendatadiscovery-specification` to a known version; new operations would surface at upgrade time)."
    - "NEW finding (NOT surfaced in the 5 method-level sidecars individually but VISIBLE at the class level): the `validateDataSources` helper at lines 97-102 is DEFENSIVE on `name` and `oddrn` but IGNORES the other DataSource fields (description, connection_url, type, namespace_name). A payload with valid name+oddrn but a malformed connection_url (e.g. `connection_url: 'rm -rf /'` — not a URL) flows through; the field is preserved verbatim into `data_source.connection_url` and rendered in the UI's Datasources tab. The two-field-only validation is silent. Severity: LOW (operator-visible only when the field is rendered as a hyperlink — but if it IS rendered, the field can carry attacker-controlled text into the UI). Also: missing description, type, namespace — all silently accepted as null/empty."
    - "MINOR refinement: per existing `IngestionDataEntitiesFilter` (filter-class sidecar) coupling[0]: 'Path coverage is incomplete by design — only /ingestion/entities POST is matched'. The class-level view here CONFIRMS and EXTENDS: the path coverage gap is not just one entry-point asymmetry but a 5-endpoint × 2-filter × 4-auth-mode matrix that operators must reason about to know whether their deployment is hardened. The matrix is not documented anywhere in the repo (verified: Grep `auth.ingestion.filter.enabled` + `WHITELIST_PATHS` reveals 6 source files and 3 docs pages, none of which present the full 5×2×4 = 40-cell matrix). The live docs do enumerate the gap at `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security` (WebFetched 2026-05-25 status 200, verbatim: 'All other /ingestion/* paths...remain Unauthenticated under auth.type = DISABLED, OAUTH2, or LDAP') — the docs are AHEAD of the code's self-documentation."
  back_links_emitted_to:
    - F-008
    - P-10:F-001
    - REFACTOR-185
    - REFACTOR-073
    - ADR-CANDIDATE-142
    - ADR-CANDIDATE-143
    - LSN-001
---

# IngestionController — semantic understanding

## understanding

`IngestionController` is the 103-line thin REST controller (`IngestionController.java:31-103`) that implements the 5-method S2S ingestion surface of the ODD Platform, exposing the `/ingestion/*` path family that collectors, push adapters, and ingestion clients use to register data sources, push entity definitions, push column-level statistics, push per-entity metrics, and read Data Entity Group membership. It implements the OpenAPI-generated `IngestionApi` interface (line 31 — imported from `org.opendatadiscovery.oddplatform.ingestion.contract.api.IngestionApi` per line 10, which is generated at build time from the external `io.github.opendatadiscovery:opendatadiscovery-specification` Gradle dep — NOT from in-tree `odd-platform-specification/openapi.yaml`). Every method is a 4-line `@Override` proxy with NO `@RequestMapping`/`@PostMapping`/`@GetMapping` annotations (path mapping is contract-driven); each handler extracts inputs from the OpenAPI-generated method signatures, delegates to one of FOUR distinct services (`ingestionService`, `dataEntityGroupService`, `dataSourceIngestionService`, `ingestionMetricsService` — all four constructor-injected at lines 32-35), and returns a reactive response. The class-level architecture decisions visible from THIS file are: (1) the 5 handlers use **two entirely different identity-resolution mechanisms** — `createDataSource` reads the WebSession's `COLLECTOR_ID_SESSION_KEY` (line 50-58, fail-loud `IllegalStateException` if null), the other 4 methods identify the target via PAYLOAD ODDRNs or PATH variables; (2) the 5 handlers exhibit **three different response-code shapes** — `postDataEntityList` returns 200 OK (line 44), `postDataSetStatsList` returns 201 Created (line 86), `ingestMetrics` returns 201 Created (line 94), `createDataSource` returns 200 OK (line 72), `getDataEntitiesByDEGOddrn` returns the body Map'd via `ResponseEntity::ok` (line 78); (3) the **transaction boundaries DISAGREE** across the 3 mutating service paths (per downstream_side_effects[1]); (4) the auth posture is **MULTI-MODE DISJOINT**: `createDataSource` is the only unconditionally-authenticated handler (IngestionDataSourceFilter is `@Component` with no `@ConditionalOnProperty` — IngestionDataSourceFilter.java:15), `postDataEntityList` is conditionally authenticated when `auth.ingestion.filter.enabled=true` (default `false` per application.yml:48), the other 3 handlers have **NO filter coverage** because IngestionDataEntitiesFilter.java:28 hard-codes `/ingestion/entities` POST as an exact-literal matcher. Combined with `SecurityConstants.WHITELIST_PATHS = {..., "/ingestion/**", ...}` (SecurityConstants.java:95-96) — which exempts the entire ingestion namespace from UI auth (LOGIN_FORM/OAUTH2/LDAP via the `AuthorizationCustomizer.customize` path-permit at AuthorizationCustomizer.java:22-23) — the controller's class-level security posture is: under default deployment, 4 of 5 endpoints accept unauthenticated POSTs from ANY caller able to reach the platform's port; under the most-hardened deployment (auth.type=OAUTH2 + auth.s2s.enabled=true + auth.ingestion.filter.enabled=true), 3 of 5 endpoints REMAIN unauthenticated because the filter path-matcher does not cover the nested paths (`/ingestion/entities/datasets/stats`, `/ingestion/metrics`, `/ingestion/dataentitygroups/{deg_oddrn}/entities`). The live docs at `docs.opendatadiscovery.org/configuration-and-deployment/enable-security` (WebFetched 2026-05-25 status 200) flag the gap explicitly; the code's bundled defaults do not. This class is the canonical evidence anchor for F-008 (Batch Ingestion) and a primary contributor to REFACTOR-185 (DISABLED-mode bypass) and REFACTOR-073 (ingestion-filter path coverage incomplete).

## concepts

- entities:
  - "`IngestionApi` (OpenAPI-generated interface, `org.opendatadiscovery.oddplatform.ingestion.contract.api.IngestionApi`, imported at line 10 — sourced from the published `io.github.opendatadiscovery:opendatadiscovery-specification` Gradle dep, NOT in-repo). Declares the 5 method signatures the controller `@Override`s. No `@PostMapping`/`@GetMapping` annotations on this controller; path mapping is contract-driven."
  - "`IngestionService` (interface — IngestionService.java, imported at line 18). Two methods: `ingest(DataEntityList)` and `ingestStats(DatasetStatisticsList)`. Single impl: IngestionServiceImpl."
  - "`DataEntityGroupService` (imported at line 16) — used ONLY by getDataEntitiesByDEGOddrn (line 76-79); same service that owns DEG create/update operations in DataEntityGroupController."
  - "`DataSourceIngestionService` (imported at line 17) — used ONLY by createDataSource (line 47-73). DISJOINT from DataSourceService (which backs the UI Management → Datasources tab via DataSourceController per the cross-batch sidecar). Same persistence table (`data_source`), separate service class."
  - "`IngestionMetricsService` (imported at line 19) — used ONLY by ingestMetrics (line 89-95). Two mirrored implementations switched at boot by `@ConditionalOnProperty(\"metrics.storage\")` ∈ {INTERNAL_POSTGRES default-on, PROMETHEUS}."
  - "`DataEntityList`, `DataSourceList`, `DatasetStatisticsList`, `MetricSetList`, `CompactDataEntityList` (request/response bodies — all OpenAPI-generated from the external ingestion spec, imported at lines 11-15)."
  - "`SessionConstants.COLLECTOR_ID_SESSION_KEY` (literal `\"collectorId\"`, SessionConstants.java:4, imported at line 8) — the WebSession attribute key written by IngestionDataSourceFilter, read by createDataSource."
  - "`BadUserRequestException` (imported at line 9) — thrown twice in this file: line 42 (`\"Ingestion payload is empty\"`) and line 63 (`\"Ingestion Data Sources' payload is invalid\"`). Maps to HTTP 400 via ControllerAdvice."
  - "`ServerWebExchange` (every handler signature — line 39, 49, 77, 83, 91). USED only by `createDataSource` (line 50-58 — reads the session via `exchange.getSession()`); UNUSED by the other 4 handlers (despite being on every signature — the OpenAPI generator stamps it uniformly)."
  - "`Mono<ResponseEntity<Void>>` / `Mono<ResponseEntity<CompactDataEntityList>>` (the 2 reactive response shapes)."
- operations:
  - "postDataEntityList (lines 37-45): POST /ingestion/entities — accept DataEntityList, reject empty items via BadUserRequestException, delegate to IngestionService.ingest, return 200 OK"
  - "createDataSource (lines 47-73): POST /ingestion/datasources — read collectorId from WebSession (fail-loud on null), validate every DataSource has non-empty name + oddrn, delegate to DataSourceIngestionService.createDataSources(collectorId, dataSources), return 200 OK. The method is named `createDataSource` in the Java code but the substrate node-id label is `createDataSourceEntity` (alias)"
  - "getDataEntitiesByDEGOddrn (lines 75-79): GET /ingestion/dataentitygroups/{deg_oddrn}/entities (path declared in upstream OpenAPI spec; not locally verifiable) — accept degOddrn path variable, delegate to DataEntityGroupService.listEntitiesWithinDEG, return 200 with CompactDataEntityList"
  - "postDataSetStatsList (lines 81-87): POST /ingestion/entities/datasets/stats — accept DatasetStatisticsList, delegate to IngestionService.ingestStats, return 201 Created. NO empty-payload guard (silent inconsistency vs postDataEntityList)"
  - "ingestMetrics (lines 89-95): POST /ingestion/metrics — accept MetricSetList, delegate to IngestionMetricsService.ingestMetrics, return 201 Created. NO empty-payload guard. Service dispatch via `@ConditionalOnProperty(\"metrics.storage\")` at boot — INTERNAL_POSTGRES default OR PROMETHEUS"
  - "validateDataSources (lines 97-102, private helper for createDataSource): assert every DataSource has non-empty name AND non-empty oddrn; other fields ignored"
- invariants:
  - "Every method `@Override`s a method on `IngestionApi` (line 31 `implements IngestionApi`) — the path mapping (POST/GET on `/ingestion/*` paths) lives in the OpenAPI-generated interface generated from the external `opendatadiscovery-specification` repo (not present in this filesystem; verified by Grep `getDataEntitiesByDEGOddrn` in `<odd-platform-specification>/openapi.yaml` returning zero matches). There are NO `@PostMapping`/`@GetMapping`/`@RequestMapping` annotations on this controller class or its methods. Consistent with the rest of the `org.opendatadiscovery.oddplatform.controller` package; contrasts with the hand-rolled `AlertManagerController` (which uses `@PostMapping(\"/ingestion/alert/alertmanager\")` directly per the IngestionDataEntitiesFilter sidecar coupling note)."
  - "`@RequiredArgsConstructor` (Lombok, line 29) generates the constructor injecting four service fields (lines 32-35). No other dependencies — no security service, no audit emitter, no rate-limiter, no metrics, no validation framework."
  - "The controller body is REACTIVE THROUGHOUT — every method returns `Mono<ResponseEntity<...>>` (lines 38, 48, 76, 82, 90). The reactive chain is inline (each handler is a 3-7 line lambda expression: `body.flatMap(...).thenReturn(...)` shape). No blocking calls, no `.block()`, no `subscribeOn` — all WebFlux-native composition."
  - "Method bodies range from 1 line (`getDataEntitiesByDEGOddrn` line 78) to 14 lines (`createDataSource` lines 47-73 — the longest, owing to its session-read + payload-validation + zipWhen composition). Average is 5 lines including signature."
  - "NO programmatic authorization checks anywhere in this controller body (no `@PreAuthorize`, no `permissionService.hasPermission(...)`, no `ReactiveSecurityContextHolder` lookup). Authorization is path-based via the upstream Spring SecurityWebFilterChain. The 5-endpoint class-level posture is documented in upstream_callers + downstream_side_effects per the orientation summary at the top of `## understanding`."
  - "Identity-resolution bifurcation: `createDataSource` is the ONLY method that reads the WebSession (line 50-58). The other 4 methods identify the target via PAYLOAD fields (postDataEntityList: `dataSourceOddrn` in the payload, consumed downstream in IngestionServiceImpl.java:68; postDataSetStatsList: per-`DataSetStatistics.datasetOddrn` in the payload; ingestMetrics: per-`MetricSet.oddrn` in the payload; getDataEntitiesByDEGOddrn: `degOddrn` in the URL path). The session-vs-payload split has no comment explaining the asymmetry."
  - "Response-code drift across the 3 mutating service-path handlers: `postDataEntityList` → 200 OK (line 44), `postDataSetStatsList` → 201 Created (line 86), `ingestMetrics` → 201 Created (line 94). Per existing batch-F postDataEntityList sidecar (concepts.invariants[2]), the OpenAPI spec declares 201 for postDataEntityList; the implementation returns 200. The drift is locked in by `BaseIngestionTest.java:79` asserting `expectStatus().isOk()` (200) for postDataEntityList vs `isCreated()` (201) for the other two (BaseIngestionTest.java:87, 95). Spec-vs-impl drift has shipped."
  - "Empty-payload-guard asymmetry: `postDataEntityList` short-circuits on `CollectionUtils.isNotEmpty(del.getItems())` (line 41) — 400 BadUserRequestException. `postDataSetStatsList` and `ingestMetrics` have NO empty-payload guard (lines 84-86, 92-94 are plain `body.flatMap(service::method).thenReturn(...)`). The asymmetry has no comment defending it."
  - "Transaction-boundary disagreement across the 3 mutating service paths: `postDataEntityList` → IngestionServiceImpl.ingest is `@ReactiveTransactional` (line 66 per the postDataEntityList sidecar). `createDataSource` → DataSourceIngestionServiceImpl.createDataSources is `@ReactiveTransactional` (line 40 per the createDataSourceEntity sidecar). `postDataSetStatsList` → IngestionServiceImpl.ingestStats is NOT `@ReactiveTransactional` (verified: IngestionServiceImpl.java:76-79 has no annotation; the boundary lives downstream at DatasetFieldServiceImpl.updateStatistics line 159 per the postDataSetStatsList sidecar). `ingestMetrics` → similarly defers to the per-implementation `@ReactiveTransactional` on InternalIngestionMetricsServiceImpl.ingestMetrics. The split has no comment explaining the choice."
- audiences:
  - "odd-collector and odd-collector-sdk HTTP clients (the canonical S2S clients)"
  - "Push adapters: odd-airflow-2, odd-dbt, odd-spark-adapter, odd-great-expectations, odd-tracing-gateway"
  - "odd-collector-profiler (statistical-profiling collector — primary consumer of postDataSetStatsList)"
  - "Third-party integrations writing custom collectors against the published IngestionApi contract"
  - "odd-platform operators standing up ingestion pipelines — primary consumers of the live docs at `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security`"
  - "Security reviewers auditing the S2S surface — primary consumers of THIS sidecar's 5-endpoint × 2-filter × 4-auth-mode matrix"

## dependencies_semantic

- requires-feature:
  - "`IngestionApi` (OpenAPI-generated interface, imported at line 10). Sourced from the external `io.github.opendatadiscovery:opendatadiscovery-specification` Gradle dep (per `gradle/libs.versions.toml:6,65,142` cited in batch-Z sidecars — the version pin is `0.1.40`). The interface declares 5 method signatures + their path/method/contentType bindings. NOT IN-REPO; the spec lives at `https://github.com/opendatadiscovery/opendatadiscovery-specification` (separate filesystem location not present here)."
  - "`IngestionService` (IngestionService.java) + `IngestionServiceImpl` (sibling sidecar). Two service methods: `ingest(DataEntityList)` (the heavy lifter — full processor chain), `ingestStats(DatasetStatisticsList)` (one-line passthrough to DatasetFieldService)."
  - "`DataEntityGroupService` — used only by getDataEntitiesByDEGOddrn. Read-only delegate, no `@ReactiveTransactional`."
  - "`DataSourceIngestionService` + `DataSourceIngestionServiceImpl` (separate from the UI-side `DataSourceService` / `DataSourceServiceImpl` per the cross-batch DataSourceController sidecar). Upsert-by-ODDRN-merging-only-name+description (per ADR-CANDIDATE-142)."
  - "`IngestionMetricsService` (interface) + InternalIngestionMetricsServiceImpl / ExternalIngestionMetricsServiceImpl (boot-time mirrored impls switched by `@ConditionalOnProperty(\"metrics.storage\")`)."
  - "`IngestionDataSourceFilter` (auth-filter sibling) — `@Component` UNCONDITIONAL (IngestionDataSourceFilter.java:15 — no `@ConditionalOnProperty`). Intercepts `POST /ingestion/datasources` (path-matcher line 20). Writes `SessionConstants.COLLECTOR_ID_SESSION_KEY` into the WebSession (line 37-38) before THIS controller's `createDataSource` runs."
  - "`IngestionDataEntitiesFilter` (auth-filter sibling) — `@Component` CONDITIONAL on `auth.ingestion.filter.enabled=true` (IngestionDataEntitiesFilter.java:20). Intercepts `POST /ingestion/entities` EXACT-LITERAL (line 28). Does NOT cover the other 3 ingestion paths on THIS controller."
  - "`SecurityConstants.WHITELIST_PATHS` (SecurityConstants.java:95-96) — contains `/ingestion/**` wildcard. Exempts the entire ingestion namespace from UI-mode authorization (LOGIN_FORM/OAUTH2/LDAP) via `AuthorizationCustomizer.customize` lines 22-23 (`.pathMatchers(SecurityConstants.WHITELIST_PATHS).permitAll()`). Similarly the `LoginFormSecurityConfiguration` explicitly whitelists `/ingestion/entities` + `/ingestion/datasources` (LoginFormSecurityConfiguration.java:50)."
  - "`ControllerAdvice` (ControllerAdvice.java per the cross-batch DataSourceController sidecar) — maps `BadUserRequestException` → 400 (the two checks in this controller surface as 400 via this advice)."
- requires-config:
  - "`auth.ingestion.filter.enabled` (default `false` per application.yml:46-48) — gates IngestionDataEntitiesFilter ONLY (NOT IngestionDataSourceFilter, NOT the other 3 ingestion endpoints on this controller). The property's name reads as 'protect ingestion globally'; its actual scope is one endpoint (`POST /ingestion/entities`)."
  - "`auth.type` (default `DISABLED` per application.yml:32-34) — under DISABLED, the platform's `DisabledAuthSecurityConfiguration` (DisabledAuthSecurityConfiguration.java:10-19) configures `.anyExchange().permitAll()` — meaning NO UI-side authorization runs. The ingestion filters STILL run if registered (their conditions depend on `auth.ingestion.filter.enabled`, NOT on `auth.type`). Under DISABLED + default `auth.ingestion.filter.enabled=false`: 4 of 5 endpoints are open; `createDataSource` requires a collector token (the IngestionDataSourceFilter is unconditional)."
  - "`auth.s2s.enabled` (default `false` per application.yml:40-41) — the S2sAuthenticationFilter (S2sAuthenticationFilter.java:19-49) is registered ONLY when `s2sEnabled=true` (LoginFormSecurityConfiguration.java:61-63, OAuthSecurityConfiguration.java:108-110, LDAPSecurityConfiguration.java:149-151 — three identical `if (s2sEnabled) sec.addFilterAt(s2sAuthenticationFilter, ...)` blocks across the 3 NON-DISABLED auth-mode configs). The S2S filter grants ADMIN authority when the `X-API-Key` header matches the configured token; under any of the 4 ingestion endpoints WHITELIST-bypassed by `/ingestion/**`, the S2S filter's authority-grant does NOT gate ingestion (the WHITELIST `.permitAll()` precedes the authentication check)."
  - "`spring.codec.max-in-memory-size: 20MB` (application.yml:14-15) — the WebFlux body-buffer cap that applies to ALL 4 POST handlers on this controller. Payloads over 20MB throw `DataBufferLimitException` → HTTP 500 (NOT 413). No `@ExceptionHandler` for `DataBufferLimitException` in this codebase (per batch-F sidecar's verified Grep)."
  - "`spring.session.timeout: -1` (application.yml:2-3) — session never expires. The `createDataSource` handler's session attribute persists indefinitely once set by IngestionDataSourceFilter. Combined with `session.provider: IN_MEMORY` (application.yml:30), each platform instance has its own session store — a cluster deployment without sticky-session affinity would lose the COLLECTOR_ID on the second hop (per batch-P sidecar)."
  - "`metrics.storage: INTERNAL_POSTGRES` (application.yml:158-159, default) — gates the boot-time `@ConditionalOnProperty` decision between IngestionMetricsService implementations. Affects ingestMetrics dispatch."
- requires-runtime:
  - "Spring WebFlux + Reactor Core — every handler returns `Mono<ResponseEntity<...>>`; reactive composition via `flatMap`, `filter`, `switchIfEmpty`, `handle`, `zipWhen`, `flatMapMany`, `then`, `thenReturn` (lines 40-72, 84-86, 92-94)."
  - "Spring WebFlux `WebSession` — bridge between IngestionDataSourceFilter (writer) and `createDataSource` (reader). Default in-memory implementation; per SessionConfiguration.java the alternative providers (INTERNAL_POSTGRESQL, REDIS) are conditionally available."
  - "Jackson `ObjectMapper` — WebFlux's reactive codec deserialises the JSON bodies to OpenAPI-generated DTOs."
  - "`@ReactiveTransactional` — used by 2 of 4 mutating service paths (postDataEntityList, createDataSource at the IMMEDIATE service tier; postDataSetStatsList, ingestMetrics defer the boundary downstream)."
  - "jOOQ + R2DBC reactive Postgres driver — the persistence runtime for getDataEntitiesByDEGOddrn (SELECT) and all 4 mutating paths."
  - "Lombok (`@RequiredArgsConstructor`, `@Slf4j`) — annotation processors at compile time."
- coupling:
  - "Path mapping is OpenAPI-contract-driven for ALL 5 methods (NO `@PostMapping`/`@GetMapping` annotations). Consistent with the rest of `org.opendatadiscovery.oddplatform.controller` package; the EXCEPTION (hand-rolled `@PostMapping`) is AlertManagerController, per IngestionDataEntitiesFilter sidecar coupling note."
  - "Class-level WebSession state coupling: the filter and `createDataSource` communicate via a stringly-typed key (`SessionConstants.COLLECTOR_ID_SESSION_KEY` is `public static String COLLECTOR_ID_SESSION_KEY = \"collectorId\";` per SessionConstants.java:4 — not `final`). A rename in either place silently desyncs the contract; a misspelling would throw `IllegalStateException(\"Collector id is null\")` at runtime, NOT at compile-time. There is no shared interface enforcement."
  - "Asymmetric request-shape composition across the 5 handlers: `postDataEntityList`, `postDataSetStatsList`, `ingestMetrics` are 4-7 line one-liners; `getDataEntitiesByDEGOddrn` is a 1-line proxy; `createDataSource` is a 14-line composition (session-read + payload-validation + zipWhen composition) — the longest and most complex on the class. The complexity is concentrated in the one auth-coupled method."
  - "FOUR distinct services injected (lines 32-35) — by far the most service-fan-out of any controller on the platform (per cross-batch sidecars, most controllers inject 1-2 services). The class is a service-orchestration entry-point rather than a domain-specific handler family."
  - "NO @Slf4j usage despite the `@Slf4j` annotation at line 30 — there are no `log.info`/`log.warn`/`log.error` calls in the controller body. The annotation is dead code OR a placeholder for future logging. Auditability of ingestion events at the controller layer is ZERO."

## tests_coverage_semantic

- covered_behaviours:
  - behaviour: "Happy-path 200 OK on POST /ingestion/entities with non-empty DataEntityList"
    test_class: integration
    test_files: ["odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/BaseIngestionTest.java:74-80"]
  - behaviour: "Happy-path 201 Created on POST /ingestion/entities/datasets/stats with valid DatasetStatisticsList"
    test_class: integration
    test_files: ["odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/BaseIngestionTest.java:82-88"]
  - behaviour: "Happy-path 201 Created on POST /ingestion/metrics with valid MetricSetList"
    test_class: integration
    test_files: ["odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/BaseIngestionTest.java:90-96"]
  - behaviour: "End-to-end datasource registration via POST /api/datasources (UI path, NOT this controller — but the test harness validates the broader ingestion lifecycle)"
    test_class: integration
    test_files: ["odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/BaseIngestionTest.java:63-72"]
  - behaviour: "POST /ingestion/entities propagates to the full IngestionService.ingest processor chain — verified through downstream catalog assertions in LineageIngestionTest / MetadataIngestionTest / LoadIngestionTest / DatasetVersionDiffTest / DatasetFieldIngestionTest"
    test_class: integration
    test_files: [
      "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/api/ingestion/LineageIngestionTest.java",
      "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/api/ingestion/MetadataIngestionTest.java",
      "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/api/ingestion/LoadIngestionTest.java",
      "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/api/ingestion/DatasetVersionDiffTest.java",
      "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/api/ingestion/DatasetFieldIngestionTest.java",
      "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/api/ingestion/MetricsIngestionTest.java"
    ]
- uncovered_behaviours:
  - behaviour: "401 / 403 auth-failure paths across the 5 endpoints — NO test asserts that any of the 5 endpoints rejects an unauthenticated caller under any of the 4 auth modes. The test profile defaults to `auth.type=DISABLED` + `auth.ingestion.filter.enabled=false`, so ALL tests run against the most-open auth posture; the production-recommended postures (OAUTH2/LDAP/LOGIN_FORM × filter-enabled true) are completely untested at this controller's surface"
    test_class: security
    criticality: CRITICAL
    note: "This is the load-bearing untested surface — operators may believe enabling `auth.ingestion.filter.enabled=true` protects ingestion globally; the test suite does not verify that any of the 3 uncovered endpoints (`/ingestion/entities/datasets/stats`, `/ingestion/metrics`, `/ingestion/dataentitygroups/{deg_oddrn}/entities`) are unauthenticated EVEN with the toggle enabled. Test absence preserves operator-misleading default behaviour."
  - behaviour: "Class-level 4-mode auth disjointness — NO test exercises the same controller under multiple `auth.type` modes to demonstrate that ingestion behaviour is mode-independent (which is the CURRENT BUG — the 4 of 5 endpoints SHOULD be mode-dependent but are uniformly open)"
    test_class: security
    criticality: HIGH
  - behaviour: "createDataSource without a prior `IngestionDataSourceFilter` session (session attribute missing) — NO test asserts the IllegalStateException pathway returns 500, NOT 401. The error-shape is operator-confusing (looks like a server crash) and untested"
    test_class: security
    criticality: HIGH
  - behaviour: "Cross-collector authentication (collector A's token attempting to register a datasource that collector B already owns) — NO test asserts the cross-tenant authentication boundary"
    test_class: security
    criticality: HIGH
  - behaviour: "Payload-vs-token cross-validation on POST /ingestion/entities — when IngestionDataEntitiesFilter IS enabled, NO test exercises a valid collector-A token POSTing entities under data_source_oddrn belonging to collector B"
    test_class: security
    criticality: HIGH
  - behaviour: "Empty / null payload paths: postDataSetStatsList and ingestMetrics have no empty-payload guard at the controller — NO test asserts the behaviour with `items: []` (no-op 201) or `items: null` (NPE in service per batch-Z postDataSetStatsList sidecar uncovered[1])"
    test_class: unit
    criticality: MEDIUM
  - behaviour: "Body-buffer-cap behaviour: a 21MB ingestion payload throws DataBufferLimitException → 500. NO test asserts this; NO @ExceptionHandler converts to 413. Behaviour discoverable only by operators sending real overflows"
    test_class: performance
    criticality: MEDIUM
  - behaviour: "Concurrent ingestion to the same data source: NO test asserts behaviour when 2 collectors with valid tokens POST to /ingestion/entities for the same data_source_oddrn concurrently. The downstream @ReactiveTransactional + per-row UPSERT serialization is implicit; race conditions on dataset_field.stats updates are not asserted"
    test_class: integration
    criticality: MEDIUM
  - behaviour: "Tag-namespace side-channel via postDataSetStatsList: NO test asserts that an unauthenticated POST with crafted `tags` populates the catalog's tag taxonomy bypassing TAG_CREATE permission"
    test_class: security
    criticality: HIGH
    note: "Filed in batch-Z postDataSetStatsList sidecar; controller-class level reinforces"
  - behaviour: "Response code drift assertion: NO test explicitly captures that `postDataEntityList` returns 200 vs the OpenAPI spec's 201. Tests assert isOk() / isCreated() per the IMPLEMENTATION, not per the spec — the drift is locked in"
    test_class: integration
    criticality: LOW
- test_files: [
    "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/BaseIngestionTest.java",
    "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/api/ingestion/LineageIngestionTest.java",
    "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/api/ingestion/MetadataIngestionTest.java",
    "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/api/ingestion/LoadIngestionTest.java",
    "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/api/ingestion/DatasetVersionDiffTest.java",
    "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/api/ingestion/DatasetFieldIngestionTest.java",
    "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/api/ingestion/MetricsIngestionTest.java"
  ]
- gaps: |
    The dominant uncovered surface at the controller-class level is the AUTH-MODE × FILTER-COVERAGE matrix. The current test profile fixes `auth.type=DISABLED` and `auth.ingestion.filter.enabled=false`, meaning EVERY test runs against the most-open posture — the production-recommended postures (auth.type=OAUTH2/LDAP/LOGIN_FORM × auth.ingestion.filter.enabled=true × auth.s2s.enabled=true) are completely untested at this controller's surface.

    The test_class with the worst coverage is **security**: 8 of the 10 uncovered behaviours (above) are security-class. The highest-leverage gap is the multi-mode disjointness test — a single parameterized integration test that exercises each of the 5 endpoints under each of the 4 auth.type modes × 2 filter toggle values × 2 s2s toggle values, asserting the 40-cell matrix matches the documented expectations. Such a test would lock in the current behaviour (preserving the gap until refactor) AND immediately surface a regression if anyone widens the filter path-matcher.

    The integration test_class has decent coverage of happy paths but ZERO coverage of partial-failure paths (one invalid DataEntity in a 100-entity payload), concurrent-ingestion paths, or cross-collector-tenant paths. The performance test_class is unmeasured for body-buffer-cap behaviour and ingestion-batch throughput.

## docs_link_semantic

- declared_docs: []   # No `@docs` annotation in the source file (verified via Grep `@docs` in IngestionController.java)
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security"
    anchor: ""
    rationale: "The live docs page documents the ingestion auth gap explicitly — 'Ingestion | Collectors and push adapters calling `/ingestion/**` | `auth.ingestion.filter.enabled` (default `false`)' and 'All other /ingestion/* paths...remain Unauthenticated under auth.type = DISABLED, OAUTH2, or LDAP'. This is the canonical operator-facing reference for the controller-class auth posture."
    last_verified_at: "2026-05-25T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Quoted via WebFetch (2026-05-25 status 200):
      - "Ingestion | Collectors and push adapters calling `/ingestion/**` | `auth.ingestion.filter.enabled` (default `false`)"
      - "POST /ingestion/datasources: Protected unconditionally by IngestionDataSourceFilter — requires Authorization: Bearer <token> regardless of settings"
      - "POST /ingestion/entities: Protected only when auth.ingestion.filter.enabled: true — validates bearer tokens against datasource credentials"
      - "All other /ingestion/* paths...remain Unauthenticated under auth.type = DISABLED, OAUTH2, or LDAP"
      - "The filter uses exact path matcher (/ingestion/entities, POST) and does not cover sibling endpoints like /ingestion/alert/alertmanager or /ingestion/entities/datasets/stats"
      - "With the default in place and the platform reachable on the network, any caller who can speak the ingress API can POST /ingestion/entities"
      - "Recommendation: Enable auth.ingestion.filter.enabled: true for any non-local deployment, as collectors already send bearer tokens automatically"
  - url: "https://docs.opendatadiscovery.org/developer-guides/build-and-run/custom-collectors"
    anchor: ""
    rationale: "The live docs page documenting the collector lifecycle that uses 4 of the 5 methods on this controller. Cited by batch-P createDataSourceEntity sidecar (upstream_callers[0]) as the canonical 'POST /ingestion/datasources once at startup' reference."
    last_verified_at: "2026-05-20T00:00:00Z"   # inherited from createDataSourceEntity sidecar verification
    last_verified_status: 200
    confidence: HIGH
- doc_drift_findings:
  - "Live-docs ahead of code's self-documentation: the docs at `configuration-and-deployment/enable-security` ENUMERATE the path-coverage gap explicitly (above excerpts) but the BUNDLED `application.yml` defaults (`auth.ingestion.filter.enabled: false`) carry no inline comment, no warning, no `# WARNING: insecure default for production` annotation. An operator using the bundled docker-compose without reading the docs page lands on the open-ingestion posture without ANY signal."
  - "Code-level filter-property NAMING is misleading at the docs-cross-reference: the property `auth.ingestion.filter.enabled` reads as 'protect all of ingestion'; the live docs accurately disambiguate it as 'protect /ingestion/entities only'. The code uses no `auth.ingestion.entities-filter.enabled` or similar disambiguating name. Operators relying on grep-the-property without reading the docs will believe they've protected the ingestion namespace globally."
  - "Test profile defaults (auth.type=DISABLED, filter=false) are tested-as-shipped; the test suite has zero coverage on the docs-documented OAUTH2+filter=true posture. Code is ahead of tests; docs are ahead of code."

## implicit_adrs

- "ALL 5 handlers are `@Override`s of OpenAPI-generated interface methods with NO `@PostMapping`/`@GetMapping` on the controller class or its methods — the package-wide convention is contract-driven path mapping" — evidence: IngestionController.java:31 (`implements IngestionApi`) + lines 37, 47, 75, 81, 89 (all `@Override`, no path annotations) — intent_anchor: "Implicit convention applied consistently across the entire `org.opendatadiscovery.oddplatform.controller` package — every controller `@Override`s a generated `*Api` interface method. The single exception is hand-rolled `AlertManagerController` per IngestionDataEntitiesFilter sidecar coupling[3] — and that exception is itself the implicit ADR by negation." — confidence: HIGH

- "Two distinct ingestion-filter classes (IngestionDataSourceFilter unconditional + IngestionDataEntitiesFilter conditional) with EXACT-LITERAL path matchers — the architectural intent is that datasource registration is ALWAYS authenticated (the trust-bootstrap step) but data-entity ingestion can be left open in dev/single-tenant deployments by default" — evidence: IngestionDataSourceFilter.java:15 (`@Component`, no `@ConditionalOnProperty`) + IngestionDataEntitiesFilter.java:20 (`@ConditionalOnProperty(value = \"auth.ingestion.filter.enabled\", havingValue = \"true\")`) + application.yml:48 (default `false`) — intent_anchor: "The `@Component` unconditional registration on IngestionDataSourceFilter combined with the conditional `havingValue=\"true\"` and `application.yml:48 ingestion.filter.enabled: false` default IS the architectural decision: bootstrap-authentication-always, per-tick-authentication-opt-in. The split is deliberate." — confidence: HIGH

- "Identity-resolution bifurcation: createDataSource uses WebSession state; the other 4 handlers use payload-ODDRN or path-variable identification. The architectural intent is that COLLECTOR identity is session-bound (one collector per session) while DATASOURCE / DATAENTITY identity is payload-bound (one collector can ingest into many datasources)" — evidence: IngestionController.java:50-58 (createDataSource reads session) + IngestionController.java:43 (postDataEntityList delegates to ingestionService which reads dataSourceOddrn from the payload at IngestionServiceImpl.java:68 per batch-F sidecar) + IngestionDataSourceFilter.java:37-38 (filter writes COLLECTOR_ID_SESSION_KEY) — intent_anchor: "The session-write in IngestionDataSourceFilter + session-read in createDataSource form a 2-step protocol. The protocol is the implicit ADR: collector identity is bootstrapped per-session via the filter; per-tick datasource identity is conveyed via payload because a session can outlive many ingestion batches and span many datasources." — confidence: HIGH

- "Mirrored boot-time service implementations gated by `@ConditionalOnProperty(\"metrics.storage\")` — INTERNAL_POSTGRES (matchIfMissing=true) vs PROMETHEUS — the architectural intent is single-platform-process supports either storage backend without rebuild" — evidence: per batch-Z ingestMetrics sidecar (concepts.invariants[1]) citing `InternalIngestionMetricsServiceImpl.java:66` (`havingValue=\"INTERNAL_POSTGRES\", matchIfMissing=true`) and `ExternalIngestionMetricsServiceImpl.java:56` (`havingValue=\"PROMETHEUS\"`) — intent_anchor: "The `matchIfMissing=true` on INTERNAL_POSTGRES and the absence of a default fallback for PROMETHEUS encodes the deployment posture: out-of-the-box, all-in-Postgres; opt-in to Prometheus when the operator has a remote metrics backbone. Decision: storage-mode is operator-controlled at boot, not request-time" — confidence: HIGH

## bugs_limitations_corner_cases

- "4 of 5 endpoints unauthenticated under default deployment (`auth.type=DISABLED` + `auth.ingestion.filter.enabled=false` + `auth.s2s.enabled=false`, all per application.yml:34/41/48). The only authenticated endpoint is `createDataSource` via IngestionDataSourceFilter (unconditional). The bundled docker-compose ships this posture without any warning in application.yml or the `Sources:` footer of the install guide. Severity: HIGH — same class-of-failure as LSN-001 (silent insecure default in shipped config)" — evidence: IngestionController.java + IngestionDataEntitiesFilter.java:20 + application.yml:46-48 + DisabledAuthSecurityConfiguration.java:16 — severity: HIGH

- "3 of 5 endpoints REMAIN unauthenticated EVEN WHEN the operator enables `auth.ingestion.filter.enabled=true` because the IngestionDataEntitiesFilter path-matcher is hard-coded exact-literal `/ingestion/entities` POST. Specifically: `POST /ingestion/entities/datasets/stats`, `POST /ingestion/metrics`, `GET /ingestion/dataentitygroups/{deg_oddrn}/entities` — all reachable unauthenticated regardless of toggle. Severity: HIGH — operator believes they have opted-in to ingestion protection; the property name reads as 'global ingestion auth' but its scope is one endpoint" — evidence: IngestionDataEntitiesFilter.java:28 (`PathPatternParserServerWebExchangeMatcher(\"/ingestion/entities\", HttpMethod.POST)`) + SecurityConstants.java:96 (`/ingestion/**` in WHITELIST_PATHS) — severity: HIGH

- "Response-code drift between code and OpenAPI spec on `postDataEntityList`: code returns 200 OK (line 44), spec declares 201 Created. Drift has shipped; locked in by BaseIngestionTest.java:79 asserting isOk(). Sibling `postDataSetStatsList` (201, line 86) and `ingestMetrics` (201, line 94) ALIGN with spec — only postDataEntityList drifts. A consumer following the spec expecting 201 sees an unexpected 200" — evidence: IngestionController.java:44 vs IngestionController.java:86 vs IngestionController.java:94 — severity: LOW (HTTP semantics allow both as success)

- "Empty-payload-guard asymmetry: postDataEntityList has a guard (line 41-42 — short-circuits to 400 BadUserRequestException) but postDataSetStatsList and ingestMetrics do NOT. An empty `items: []` for stats or metrics flows through the service and commits a no-op 201; an `items: null` for stats throws NullPointerException at DatasetFieldServiceImpl.java:161 surfacing as 500. The asymmetry is silent — no comment explains why entity ingestion 400s on empty but stats/metrics ingestion does not" — evidence: IngestionController.java:41-42 + IngestionController.java:84-86 + IngestionController.java:92-94 — severity: LOW

- "Transaction-boundary disagreement across the 3 mutating service paths: postDataEntityList and createDataSource are `@ReactiveTransactional` at the IMMEDIATE service tier; postDataSetStatsList defers two frames to DatasetFieldServiceImpl.updateStatistics; ingestMetrics defers to InternalIngestionMetricsServiceImpl. A reader of IngestionServiceImpl sees `ingest()` annotated (line 66 per batch-F sidecar) and `ingestStats()` UN-annotated (line 76-79) — no comment explains the asymmetry. Severity: LOW (correctness not affected; consistency/maintainability impacted)" — evidence: IngestionServiceImpl.java:66 vs IngestionServiceImpl.java:76-79 per batch-F + batch-Z sidecars — severity: LOW

- "Identity-resolution shape inconsistency creates fail-loud-vs-fail-silent split: createDataSource throws IllegalStateException(\"Collector id is null\") → 500 when session attribute is missing (line 54). The other 4 handlers silently accept anonymous requests under default deployment. An operator probing `/ingestion/datasources` without going through the filter cannot distinguish 'session missing' from 'server crashed' (both surface as 500). Severity: MEDIUM — error shape leaks deployment-stance information OR misleads operators on auth failure" — evidence: IngestionController.java:50-58 — severity: MEDIUM

- "validateDataSources helper (lines 97-102) checks only `name` and `oddrn` non-empty — other DataSource fields (description, connection_url, type, namespace_name) are silently accepted as null/empty. A malformed `connection_url` propagates verbatim into `data_source.connection_url` and is rendered in the UI Datasources tab. Severity: LOW (depends on UI's escaping behaviour for the rendered field)" — evidence: IngestionController.java:97-102 — severity: LOW

- "WebSession state coupling via stringly-typed key (`SessionConstants.COLLECTOR_ID_SESSION_KEY = \"collectorId\"`, NOT `final`). A rename in either the filter (writer) or the controller (reader) silently desyncs. A misspelling surfaces as IllegalStateException at runtime, not compile-time. Severity: LOW (caught immediately in tests if both sides updated)" — evidence: SessionConstants.java:4 + IngestionController.java:52 + IngestionDataSourceFilter.java:37-38 — severity: LOW

- "No `log.*` calls in the controller body despite `@Slf4j` annotation at line 30 — zero auditability of ingestion events at the controller layer. Operators cannot trace which collector/IP attempted which ingestion call from the controller's logs; the only signal is downstream service logs (which are at `info` for `org.opendatadiscovery.oddplatform.service.ingestion` per application.yml:257) and any access-log layer the operator configures externally. Severity: LOW-MEDIUM (operators investigating ingestion failures have a thinner trace than they expect)" — evidence: IngestionController.java:30 (`@Slf4j`) + grep for `log\\.` in IngestionController.java returning 0 matches — severity: LOW

- "No rate-limit, no per-source quota, no idempotency-key on any of the 4 mutating handlers. A single collector with a valid token CAN: (1) POST `/ingestion/entities` with a 19MB payload at full network speed indefinitely; (2) POST `/ingestion/datasources` registering thousands of datasources; (3) POST `/ingestion/metrics` with arbitrary cardinality labels. Under default deployment (4 of 5 endpoints unauthenticated), ANY caller can do the same. Severity: HIGH for resource-exhaustion scenarios in multi-tenant deployments" — evidence: IngestionController.java end-to-end (no rate-limit annotations, no quota imports, no idempotency) — severity: HIGH

- "NO `@RequestPart`/`@RequestParam`/`@RequestHeader` validation across all 5 handlers. The only payload validation is `validateDataSources` (lines 97-102) on `name`/`oddrn` non-empty. The OpenAPI schema may declare constraints (per the external `opendatadiscovery-specification` dep) — but Jakarta Bean Validation is NOT applied (verified: no `@Valid` annotations on the method parameters at lines 38, 48, 76, 82, 90). Severity: MEDIUM — payload validation gaps documented in batch-Z postDataSetStatsList sidecar uncovered_behaviours[3,4] (numeric overflow, cross-dataset-field, NaN/Infinity) propagate from this absence" — evidence: IngestionController.java:38, 48, 76, 82, 90 (no `@Valid`) — severity: MEDIUM

## stress_findings

```yaml
stress_findings:
  tunables: []   # No numeric literals > 1 inside expressions in this 103-line file. The only literal is "bearer " (filter-side constant). Default values like `auth.ingestion.filter.enabled: false` live in application.yml, NOT in this controller file. Sibling files carry tunables (IngestionDataEntitiesFilter, etc.); they are enriched in their own sidecars.
  name_behavior_pairs:
    - name: "IngestionController (class name)"
      promise: "A class named `IngestionController` promises to handle ingestion HTTP traffic — the operator's mental model is 'this is the file that handles /ingestion/* traffic, and it carries the auth + validation logic for that surface'"
      implementation: "The class handles 5 of N ingestion paths (N = ingestion paths defined in the upstream OpenAPI spec). Crucially, it does NOT handle `/ingestion/alert/alertmanager` (which is in AlertManagerController per IngestionDataEntitiesFilter sidecar coupling note). The auth + validation logic is OUTSIDE this class (in IngestionDataSourceFilter, IngestionDataEntitiesFilter, ControllerAdvice). The operator opening this file expecting to find auth logic finds 4 method-level proxies + 1 14-line composition — none of which carry auth checks. The class name's promise is partially met."
      drift: MINOR
      operator_visible_consequence: "An operator triaging an ingestion auth issue grep'ing for `IngestionController` lands on a file with NO auth code; the actual gates live in two filter classes elsewhere in `auth/filter/`. Documentation-of-control-flow gap."
      confidence: STATIC-INFERRED
      evidence: "IngestionController.java:1-103 (no @PreAuthorize, no permissionService call); AlertManagerController.java (per IngestionDataEntitiesFilter sidecar coupling note — hand-rolled @PostMapping for /ingestion/alert/alertmanager)"
    - name: "ingestionService.ingest vs ingestionService.ingestStats"
      promise: "Both methods on the same service interface promise comparable handling (the verb 'ingest' implies the same processor chain, the same authorization model, the same transaction boundary)"
      implementation: "`ingest` is the heavy lifter (full processor chain, @ReactiveTransactional on IngestionServiceImpl.ingest line 66 per batch-F sidecar); `ingestStats` is a ONE-LINE passthrough to DatasetFieldService.updateStatistics (IngestionServiceImpl.java:76-79 per batch-Z sidecar). The two methods are not comparable in scope — `ingest` does 7 things (resolve datasource, dedup, processors, alerts, lineage, metrics, FTS); `ingestStats` does 1 thing (write JSONB blob + tags + FTS)"
      drift: MINOR
      operator_visible_consequence: "An operator reading the IngestionService interface expects parallel behaviour; the actual layering puts the heavy logic on ingest() and delegates ingestStats() to an entirely different service. Failure modes differ — a postDataEntityList timeout looks like an ingestion-pipeline issue; a postDataSetStatsList timeout points to dataset-field service issues."
      confidence: STATIC-INFERRED
      evidence: "IngestionController.java:43 + IngestionController.java:85 + per batch-F + batch-Z sidecars referencing IngestionServiceImpl.java:66 (annotated), IngestionServiceImpl.java:76-79 (unannotated)"
  orderings: []   # The controller does not paginate, order, or aggregate. Read endpoint getDataEntitiesByDEGOddrn returns the raw flat list from the repository; ordering is database-natural per the underlying SELECT (no ORDER BY in ReactiveDataEntityRepositoryImpl.getDEGEntities per batch-Z getDataEntitiesByDEGOddrn sidecar coupling). The class-level ordering question is handled in the method-level sidecar.
  auth_gates:
    - location: "IngestionController.java:31 (class-level — `implements IngestionApi`, no @PreAuthorize at class)"
      endpoint: "ALL 5 — postDataEntityList, createDataSource, getDataEntitiesByDEGOddrn, postDataSetStatsList, ingestMetrics"
      questions:
        - q: "What does this controller return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "**DISABLED**: 4 of 5 endpoints reachable unauthenticated (postDataEntityList, postDataSetStatsList, ingestMetrics, getDataEntitiesByDEGOddrn). createDataSource still requires a valid collector token via the unconditional IngestionDataSourceFilter. **LOGIN_FORM**: same as DISABLED — `/ingestion/entities` + `/ingestion/datasources` explicitly whitelisted (LoginFormSecurityConfiguration.java:50); the other 3 paths fall under `/ingestion/**` whitelist via WHITELIST_PATHS (line 96) for OAUTH2/LDAP only? Re-check: LOGIN_FORM uses its own permittedPaths array (line 50) which contains `/ingestion/entities, /ingestion/datasources` — NOT `/ingestion/entities/datasets/stats`, `/ingestion/metrics`, `/ingestion/dataentitygroups/...`. Under LOGIN_FORM, the 3 uncovered paths fall through to `pathMatchers(\"/**\").authenticated()` (LoginFormSecurityConfiguration.java:57) — meaning they DO require LOGIN_FORM authentication. **OAUTH2**: OAuthSecurityConfiguration installs AuthorizationCustomizer (line 98) which uses WHITELIST_PATHS (`/ingestion/**` line 96) — ALL ingestion paths are permitAll, INCLUDING the 3 nested ones. So OAUTH2 mode: 4 of 5 endpoints reachable unauthenticated (same as DISABLED). **LDAP**: same as OAUTH2 (LDAPSecurityConfiguration.java:145 installs same AuthorizationCustomizer). The 4-mode disjointness is therefore: LOGIN_FORM is STRICTER than OAUTH2/LDAP for 3 of the 5 ingestion endpoints (the nested paths). PROBE-NEEDED to verify the LoginForm vs OAuth/LDAP asymmetry at runtime."
          confidence: PROBE-NEEDED
          evidence: "P-146"
        - q: "What does an unauthenticated caller see (no cookie / no token)?"
          a: "Under default deployment (auth.type=DISABLED, ingestion.filter.enabled=false): 4 of 5 endpoints return 200/201 (no auth challenge). createDataSource returns 401 from IngestionDataSourceFilter.java:48 (`AccessDeniedException(\"Token is missed\")` → 401 via AbstractIngestionFilter.java:40). Under OAUTH2/LDAP/LOGIN_FORM with filter=false: identical to DISABLED for 4 of 5 endpoints (due to /ingestion/** in WHITELIST_PATHS). createDataSource still 401."
          confidence: STATIC-INFERRED
          evidence: "IngestionDataSourceFilter.java:31-38, AbstractIngestionFilter.java:40, SecurityConstants.java:95-96, AuthorizationCustomizer.java:22-23"
        - q: "What does a wrong-role caller see (e.g. READ_ONLY hitting a write endpoint)?"
          a: "N/A — there are NO role checks at the controller, NO @PreAuthorize anywhere. The SecurityConstants.SECURITY_RULES table (lines 98-355) has ZERO entries for `/ingestion/*` paths (verified by reading the table end-to-end — only `/api/*` rules). Role-based authorization is irrelevant to this controller; either the caller's request is bypassed by the whitelist (4 of 5 endpoints) or it's validated by the filter against the collector-token (createDataSource) — neither uses Roles or Permissions."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:98-355 (no /ingestion/* rules); IngestionController.java end-to-end (no @PreAuthorize); IngestionDataSourceFilter.java end-to-end (token-equality check, not role check)"
        - q: "Where exactly does the gate live — controller annotation, downstream service check, repository filter, or nowhere?"
          a: "The auth gate lives in **two filter classes** (IngestionDataSourceFilter for /ingestion/datasources POST, IngestionDataEntitiesFilter for /ingestion/entities POST when toggle enabled), which are entirely SEPARATE from the controller class. The controller carries ZERO auth — no annotation, no programmatic check, no service-layer enforcement, no repository-layer scoping. The downstream services (IngestionServiceImpl, DataSourceIngestionServiceImpl, DatasetFieldServiceImpl, IngestionMetricsService impls) do NOT verify the caller's identity beyond what the filter writes to the WebSession for createDataSource. For the other 4 endpoints: nowhere."
          confidence: STATIC-INFERRED
          evidence: "IngestionController.java:1-103 (no auth code); IngestionDataSourceFilter.java + IngestionDataEntitiesFilter.java (the only auth gates); IngestionServiceImpl + DataSourceIngestionServiceImpl + DatasetFieldServiceImpl (no `currentUser` or `authIdentityProvider` calls — verified by Grep `authIdentityProvider` across the 4 service classes returning zero hits in their bodies, only in unrelated services)"
  resource_boundaries:
    - location: "IngestionController.java:43 (postDataEntityList → ingestionService.ingest)"
      kind: transactional
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "Per batch-F postDataEntityList sidecar (`@ReactiveTransactional` on IngestionServiceImpl.ingest line 66, datasource row lock via getIdByOddrnForUpdate at IngestionServiceImpl.java:68): concurrent calls to the same data_source_oddrn SERIALIZE on the SELECT-FOR-UPDATE; concurrent calls to different data_source_oddrns parallelise. Within a SINGLE transaction, partial-failure rolls back the entire batch — no per-item isolation. Class-level invariant: an attacker with valid filter creds can hold a transaction open indefinitely by sending a 19MB payload at slow network speeds (no transaction timeout configured in application.yml)"
          confidence: STATIC-INFERRED
          evidence: "Per batch-F sidecar referencing IngestionServiceImpl.java:66 + IngestionServiceImpl.java:68 + application.yml end-to-end (no transaction timeout)"
        - q: "Is the call replay-safe?"
          a: "postDataEntityList: NOT replay-safe — re-POSTing the same payload triggers the full processor chain again, emitting duplicate alerts, duplicate lineage events, duplicate FTS updates. No idempotency key on this controller. postDataSetStatsList: REPLAY = OVERWRITE (per batch-Z sidecar, JSONB blob is fully replaced on each POST). createDataSource: REPLAY = UPSERT (re-register with same ODDRN updates name+description only; idempotent for unchanged payloads). ingestMetrics: per batch-Z sidecar, INTERNAL_POSTGRES appends new metric_points (NOT idempotent — observable as duplicate time-series points), PROMETHEUS may dedup at the Prometheus side"
          confidence: STATIC-INFERRED
          evidence: "Per batch-F postDataEntityList sidecar + batch-Z postDataSetStatsList sidecar + batch-P createDataSourceEntity sidecar + batch-Z ingestMetrics sidecar"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No cache fronts the controller's 5 handlers (verified: IngestionController.java has no @Cacheable; the downstream services use ReactiveTransactional, not Caffeine; the only caches in the platform are in PermissionService / IdentityService per cross-batch sidecars — neither path is reached from ingestion). N/A — no caching layer."
          confidence: STATIC-INFERRED
          evidence: "IngestionController.java end-to-end (no @Cacheable); IngestionServiceImpl + DataSourceIngestionServiceImpl + DatasetFieldServiceImpl end-to-end (no caching annotations)"
    - location: "IngestionController.java:50-58 (createDataSource — WebSession state read)"
      kind: concurrency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "Two concurrent POSTs to /ingestion/datasources from the SAME collector (same token, same session) will both read the SAME COLLECTOR_ID_SESSION_KEY (the value is set once by the filter on the FIRST request and persists). Both calls flow into DataSourceIngestionServiceImpl.createDataSources(collectorId, ...) which is @ReactiveTransactional — concurrent calls serialize on Postgres row locks for the affected DataSourcePojo rows. Per batch-P sidecar, the upsert by ODDRN serializes correctly. No corruption."
          confidence: STATIC-INFERRED
          evidence: "Per batch-P createDataSourceEntity sidecar referencing DataSourceIngestionServiceImpl.createDataSources line 40 + IngestionDataSourceFilter.java:37-38 (session attribute write semantics)"
        - q: "Is the call replay-safe?"
          a: "Replay: same payload + same session → idempotent (upsert with name+description-only merge; if those fields are unchanged, NO-op). Replay with different payload → applies the new fields. Per batch-P, NOT idempotent for tag-side-effects (the EXTERNAL_STATISTICS path on postDataSetStatsList — not this method)."
          confidence: STATIC-INFERRED
          evidence: "Per batch-P sidecar referencing DataSourceIngestionServiceImpl.prepareForUpdate lines 74-92"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "WebSession is in-memory (default `session.provider: IN_MEMORY` per application.yml:30); `spring.session.timeout: -1` (application.yml:2-3) means it NEVER EXPIRES. The COLLECTOR_ID stays set for the lifetime of the platform process. On a clustered deployment without sticky-session affinity, the second hop loses the session — the controller throws IllegalStateException → 500. No TTL, no eviction, no staleness — the only invalidation is platform restart."
          confidence: STATIC-INFERRED
          evidence: "application.yml:2-3 + application.yml:30; SessionConfiguration.java:46-48 (ReactiveMapSessionRepository)"
  request_inputs:
    - location: "IngestionController.java:38-39 (postDataEntityList)"
      input_kind: body-field
      input_name: "dataEntityList (Mono<DataEntityList>)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The parameter name `dataEntityList` promises: 'a list of data entities to ingest into the platform'. The DataEntityList type carries a `data_source_oddrn` field + a `List<DataEntity>` items field — so the input promises 'these entities belong to THIS datasource (named by ODDRN), ingest them'"
          confidence: STATIC-INFERRED
          evidence: "IngestionController.java:38"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Per batch-F postDataEntityList sidecar: the controller short-circuits on empty items (line 41-42, 400), then delegates to IngestionServiceImpl.ingest(dataEntityList) which uses the body's `dataSourceOddrn` to resolve the datasource ID via `dataSourceRepository.getIdByOddrnForUpdate(...)` (IngestionServiceImpl.java:68 per batch-F sidecar). The implementation USES the input EXACTLY as the name promises."
          confidence: STATIC-INFERRED
          evidence: "Per batch-F postDataEntityList sidecar"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — the input name says 'list of data entities for a named datasource'; the SQL resolves by the same data_source_oddrn from the same payload."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "Per batch-F postDataEntityList sidecar"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — no drift"
          confidence: STATIC-INFERRED
          evidence: "N/A"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "No — all DataEntityList fields are consumed downstream (per batch-F sidecar: dataSourceOddrn → datasource lookup; items → processor chain)."
          confidence: STATIC-INFERRED
          evidence: "Per batch-F sidecar"
      routes_to_finding: "N/A — no drift"
    - location: "IngestionController.java:48-49 (createDataSource — input dataSourceList Mono<DataSourceList>)"
      input_kind: body-field
      input_name: "dataSourceList (Mono<DataSourceList>)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The name promises: 'a list of data sources to register (or update) under the current authenticated context'. The DataSourceList payload contains DataSource items each with name/oddrn/description/connection_url etc., and (per the upstream OpenAPI spec) potentially a namespace_name field"
          confidence: STATIC-INFERRED
          evidence: "IngestionController.java:48 + per batch-P sidecar"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Per batch-P createDataSourceEntity sidecar: the controller validates name+oddrn non-empty (lines 97-102), reads collectorId FROM THE SESSION (NOT the payload), and delegates to DataSourceIngestionServiceImpl.createDataSources(collectorId, dataSources). The service: (1) ignores any namespace_name in the payload (per batch-P sidecar — namespace is INHERITED from the Collector); (2) on UPDATE, narrows to name+description only (per batch-P sidecar)."
          confidence: STATIC-INFERRED
          evidence: "Per batch-P createDataSourceEntity sidecar"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY (per batch-P sidecar). The input name says 'list of data sources to register'; the implementation: (a) SILENTLY DROPS the namespace_name from the payload (namespace comes from the Collector); (b) on UPDATE, SILENTLY IGNORES all fields except name+description. The translation has architectural intent (per ADR-CANDIDATE-142, ADR-CANDIDATE-143) but is undocumented at the OpenAPI contract layer."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "Per batch-P sidecar"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "An operator setting `namespace_name='my-namespace'` in the payload sees their datasource registered in the COLLECTOR's namespace, not 'my-namespace'. An operator pre-renaming a datasource via the UI sees the next collector startup overwrite name+description back to the collector's values. Per batch-P sidecar coherence_check[1] referencing ADR-CANDIDATE-143 + REFACTOR-423."
          confidence: STATIC-INFERRED
          evidence: "Per batch-P sidecar coherence_check[1] + ADR-CANDIDATE-142 + ADR-CANDIDATE-143 + REFACTOR-423"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "The DataSource.namespace_name field is RECEIVED by the controller but IGNORED at DataSourceIngestionServiceImpl.mapDataSources (line 106 — uses Collector's namespace_id, not payload's namespace_name). Per batch-P sidecar."
          confidence: STATIC-INFERRED
          evidence: "Per batch-P sidecar referencing DataSourceIngestionServiceImpl.java:106"
      routes_to_finding: "bugs_limitations_corner_cases.[1] (3 of 5 endpoints unauthenticated even with toggle enabled) — RELATED but distinct. Primary route: docs_link_semantic.doc_drift_findings.[1] (filter naming is misleading); secondary route: ADR-CANDIDATE-142 (S2S partial-merge — implicit_adrs already present)"
    - location: "IngestionController.java:76-77 (getDataEntitiesByDEGOddrn — path param `degOddrn`)"
      input_kind: path-param
      input_name: "degOddrn (String)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The name promises: 'the ODDRN of a Data Entity Group whose members are being requested'. The expectation: a caller supplies a DEG's ODDRN and receives the list of entities that belong to that group"
          confidence: STATIC-INFERRED
          evidence: "IngestionController.java:76-77 + per batch-Z getDataEntitiesByDEGOddrn sidecar"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Per batch-Z getDataEntitiesByDEGOddrn sidecar: the controller passes the string verbatim to DataEntityGroupServiceImpl.listEntitiesWithinDEG → ReactiveDataEntityRepositoryImpl SQL: `WHERE GROUP_ENTITY_RELATIONS.GROUP_ODDRN.eq(:degOddrn).and(IS_DELETED.isFalse())`. NO ODDRN format validation, NO existence check, NO recursive traversal (returns DIRECT members only)."
          confidence: STATIC-INFERRED
          evidence: "Per batch-Z getDataEntitiesByDEGOddrn sidecar"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY for the recursion question — the name `degOddrn` doesn't explicitly promise flat-vs-recursive, but a reasonable caller (e.g. odd-collector-sdk author) might assume recursive (DEGs can contain DEGs). The implementation is FLAT — nested DEGs surface as DATA_ENTITY_GROUP-typed members of the outer DEG without their grandchild contents. Per batch-Z sidecar invariants[3]."
          drift: MINOR
          confidence: STATIC-INFERRED
          evidence: "Per batch-Z sidecar invariants[3]"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "A caller assuming recursive expansion would miss the leaf entities of nested DEGs. The response carries no marker indicating any member is itself a DEG worth re-querying. Per batch-Z sidecar."
          confidence: STATIC-INFERRED
          evidence: "Per batch-Z sidecar"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE — the degOddrn maps to GROUP_ODDRN column exactly. The MISSING column is `is_recursive` (or similar query parameter) that would let a caller opt into recursive expansion."
          confidence: STATIC-INFERRED
          evidence: "Per batch-Z sidecar"
      routes_to_finding: "N/A — minor drift (recursion semantics ambiguity); enriched at the method-level sidecar"
    - location: "IngestionController.java:82 (postDataSetStatsList — body field datasetStatisticsList)"
      input_kind: body-field
      input_name: "datasetStatisticsList (Mono<DatasetStatisticsList>)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The name promises: 'a list of dataset-level statistical profiles to ingest'. Each DataSetStatistics item is keyed by a dataset_oddrn + carries per-column stats keyed by dataset-field ODDRN"
          confidence: STATIC-INFERRED
          evidence: "IngestionController.java:82 + per batch-Z postDataSetStatsList sidecar"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Per batch-Z postDataSetStatsList sidecar: the controller delegates verbatim. DatasetFieldServiceImpl.updateStatistics keys fields by per-field ODDRN; the dataset_oddrn from each DataSetStatistics is consumed ONLY for FTS-vector recalc (line 168-170), NOT for cross-validation against the field's parent dataset."
          confidence: STATIC-INFERRED
          evidence: "Per batch-Z sidecar invariants[4]"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY — the input name says 'dataset statistics' (with implicit parent-child relationship between dataset_oddrn and field_oddrn), but the implementation honors only the field_oddrn key for the actual write. A caller supplying dataset_oddrn=A with field_oddrns belonging to dataset B writes stats to dataset-B's fields — the dataset_oddrn parent is functionally cosmetic."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "Per batch-Z postDataSetStatsList sidecar invariants[4]"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "An attacker with knowledge of dataset-field ODDRNs (from any source — they're exposed in many UI/API responses) can write `stats` to ANY field's row by knowing the field's ODDRN, even if the payload's `dataset_oddrn` parent is mismatched. The dataset_oddrn provides false security — a reviewer expects it to scope the writes."
          confidence: STATIC-INFERRED
          evidence: "Per batch-Z sidecar invariants[4]"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "The `dataset_oddrn` IS read but not used as a cross-validation key. The MISSING use: `dataset_field.dataset_oddrn` JOIN in the lookup would scope the write to fields whose parent matches the payload's dataset_oddrn."
          confidence: STATIC-INFERRED
          evidence: "Per batch-Z sidecar"
      routes_to_finding: "bugs_limitations_corner_cases (the unauth post + cross-dataset write composition). Primary route via batch-Z postDataSetStatsList sidecar."
    - location: "IngestionController.java:90 (ingestMetrics — body field metricSetList)"
      input_kind: body-field
      input_name: "metricSetList (Mono<MetricSetList>)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The name promises: 'a list of MetricSets to ingest'. Each MetricSet is keyed by an entity ODDRN + carries metric_families with Prometheus-shaped types"
          confidence: STATIC-INFERRED
          evidence: "IngestionController.java:90 + per batch-Z ingestMetrics sidecar"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Per batch-Z ingestMetrics sidecar: the controller delegates verbatim. The service dispatches per-MetricType to extractors; the entity ODDRN is used to key the metric_series row. The tenant_id is appended as a Prometheus label (PROMETHEUS path) by-convention OR ignored (INTERNAL_POSTGRES — no tenant_id column)."
          confidence: STATIC-INFERRED
          evidence: "Per batch-Z ingestMetrics sidecar"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES at the controller level (the controller passes through; the input name and downstream usage line up). However the tenant_id label asymmetry (per batch-Z sidecar) is a downstream-of-controller drift; not surfaced here at the class level."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "Per batch-Z ingestMetrics sidecar"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — no controller-level drift. Tenant-id-related concerns are surfaced in CounterTimeSeriesExtractor / batch-Z extractor sidecars."
          confidence: STATIC-INFERRED
          evidence: "N/A"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE at the controller level."
          confidence: STATIC-INFERRED
          evidence: "N/A"
      routes_to_finding: "N/A at controller level"
  probes_emitted:
    - probe_id: P-146
      question: "Verify the 4-mode auth disjointness across the 5 endpoints: under LOGIN_FORM (which uses its own permittedPaths array — IngestionController.java's 3 nested ingestion paths are NOT in the LOGIN_FORM permittedPaths) vs OAUTH2/LDAP (which use WHITELIST_PATHS `/ingestion/**` and permit ALL ingestion). Does the controller behave differently under LOGIN_FORM vs OAUTH2 for the 3 nested ingestion endpoints (/ingestion/entities/datasets/stats, /ingestion/metrics, /ingestion/dataentitygroups/{deg_oddrn}/entities)?"
      probe_path: "lineage/odd-platform/probes/P-146.yaml"
  stress_summary:
    triggers_total: 7
    questions_total: 28
    answers_static_inferred: 27
    answers_probe_needed: 1
    answers_reference: 0
    drift_flags: 3   # name_behavior_pairs[0] MINOR, name_behavior_pairs[1] MINOR; request_inputs createDataSource DRIFT_INPUT_NAME_VS_IMPLEMENTATION; request_inputs postDataSetStatsList DRIFT_INPUT_NAME_VS_IMPLEMENTATION; request_inputs getDataEntitiesByDEGOddrn MINOR (counted as 3 main drift entries: name pair miss, two TRANSLATES_SILENTLY)
```

## security

- **auth_mode_relevance**: LOGIN_FORM | OAUTH2 | LDAP | S2S — the controller's 5 endpoints interact differently with each mode (LOGIN_FORM is STRICTER on 3 of 5; OAUTH2/LDAP are uniformly permissive on all 5 via the WHITELIST_PATHS exemption). DISABLED is the most-open posture; the controller is reachable for all 5 endpoints without auth. The S2S filter (when `auth.s2s.enabled=true`) registers but DOES NOT GATE the ingestion endpoints because the `/ingestion/**` whitelist precedes the S2S authentication check. INTERNAL_ONLY does not apply (this IS an HTTP surface).

- **ingestion_filter_relevance**: YES — gated by `auth.ingestion.filter.enabled` for `POST /ingestion/entities` only (1 of 5 endpoints). The other 4 endpoints on this controller are NOT gated by `auth.ingestion.filter.enabled`. `POST /ingestion/datasources` (1 of 5) IS gated by the SEPARATE unconditional IngestionDataSourceFilter. The remaining 3 endpoints have NO filter coverage.

- **authorization_assertions**: [] — no `@PreAuthorize`, no `permissionService.hasPermission(...)` calls, no programmatic role checks anywhere in IngestionController.java:1-103.

- **owner_scoping**: BYPASSES — none of the 5 handlers filter by current user's owners. createDataSource scopes by COLLECTOR (not owner — the collector identity is bootstrapped via session, not the user-owner mapping). The other 4 handlers do NO scoping at all. Evidence: IngestionController.java end-to-end + the 5 method-level sidecars all confirming the "payload-driven not principal-driven" pattern.

- **data_exposure**:
  - "DataEntity catalog payload (postDataEntityList POST request body) → any authenticated UI user under LOGIN_FORM with filter=false; any caller under DISABLED+filter=false; any valid collector-token holder under filter=true"
  - "DataSource registration payload (createDataSource POST request body) → any valid collector-token holder (IngestionDataSourceFilter is unconditional)"
  - "DEG membership list (getDataEntitiesByDEGOddrn GET response body — CompactDataEntityList with member ODDRNs + types) → any caller under DISABLED/OAUTH2/LDAP; LOGIN_FORM-authenticated users only under LOGIN_FORM. NO owner filter, NO permission check; the blast radius is the entire DEG catalog × all member entities"
  - "Dataset-field statistics (postDataSetStatsList POST request body) → any caller under DISABLED/OAUTH2/LDAP+anyfilter; LOGIN_FORM-authenticated users under LOGIN_FORM"
  - "MetricSet payload (ingestMetrics POST request body) → same as postDataSetStatsList"
  - "Tag-namespace mutation (side-channel via postDataSetStatsList) → any caller can populate the tag taxonomy with arbitrary tag names; bypasses the UI-side TAG_CREATE permission"

- **known_security_gaps**:
  - "4 of 5 endpoints unauthenticated under default deployment per upstream_callers + bugs_limitations_corner_cases[0]. Same class-of-failure as LSN-001" — evidence: IngestionController.java end-to-end + IngestionDataEntitiesFilter.java:20 + application.yml:46-48 — severity: HIGH
  - "3 of 5 endpoints REMAIN unauthenticated even with toggle enabled (path-matcher exact-literal mismatch) per bugs_limitations_corner_cases[1]" — evidence: IngestionDataEntitiesFilter.java:28 + SecurityConstants.java:96 — severity: HIGH
  - "Tag-namespace side-channel via postDataSetStatsList enables unauthenticated catalog tag creation per downstream_side_effects[5]" — evidence: per batch-Z postDataSetStatsList sidecar referencing DatasetFieldServiceImpl.java:202 — severity: HIGH
  - "Cross-dataset write via postDataSetStatsList — dataset_oddrn is functionally cosmetic; writes are keyed by field_oddrn only (per stress_findings.request_inputs[3])" — evidence: per batch-Z sidecar invariants[4] — severity: HIGH
  - "No rate-limit / quota / idempotency-key on any of the 4 mutating handlers per bugs_limitations_corner_cases[9] — resource-exhaustion vulnerability under multi-tenant deployment" — evidence: IngestionController.java end-to-end — severity: HIGH
  - "Identity-resolution error-shape leaks deployment-stance: createDataSource throws IllegalStateException → 500 vs the other 4 returning 200/201 anonymously per bugs_limitations_corner_cases[5]" — evidence: IngestionController.java:54 + sibling no-fail-loud method bodies — severity: MEDIUM
  - "No @Valid on any request body / no Jakarta Bean Validation per bugs_limitations_corner_cases[10] — payload validation gaps inherited by all downstream services" — evidence: IngestionController.java:38, 48, 76, 82, 90 — severity: MEDIUM
  - "Token comparison plaintext, not constant-time (per existing IngestionDataEntitiesFilter sidecar invariants[3]) — timing attack possibility against collector tokens" — evidence: per existing filter sidecar — severity: LOW (the tokens are 40-char random alphanumeric — sufficient entropy, but the practice is non-best-practice)

## performance

- **hot_paths**:
  - "postDataEntityList — synchronous-per-collector hot path: each odd-collector ingestion tick fires ONE POST to this endpoint; under heavy multi-source deployments (>50 collectors × 1-minute ticks), this endpoint sees sustained load. The downstream @ReactiveTransactional pipeline (full processor chain) holds the transaction open for the duration of the batch processing" — evidence: IngestionController.java:43 + IngestionServiceImpl per batch-F sidecar
  - "createDataSource — boot-time-of-collector hot path: each collector calls ONCE at startup. Low sustained QPS but spikes on platform-restart-with-N-collectors. The downstream @ReactiveTransactional bulk-upsert serialises on data_source row locks" — evidence: IngestionController.java:47-73 + per batch-P sidecar
  - "ingestMetrics — per-metric-tick hot path under PROMETHEUS mode where the platform's INTERNAL_POSTGRES path is bypassed; under INTERNAL_POSTGRES, hot path on Postgres metric_point inserts" — evidence: per batch-Z ingestMetrics sidecar
  - "postDataSetStatsList — periodic-per-profiler hot path; less frequent than postDataEntityList but with larger payloads (whole-dataset profiles)" — evidence: per batch-Z postDataSetStatsList sidecar

- **throughput_characteristics**:
  - "All 4 POST handlers accept SINGLE-payload posts (no streaming, no chunked). Reactive deserialization buffers the full body in memory before processing — bounded by `spring.codec.max-in-memory-size: 20MB`"
  - "No bulk-multi-batch endpoint — a collector pushing 1000 entities sends ONE 20MB payload OR multiple smaller payloads (no platform-side coordination, no idempotent-batch tracking)"
  - "GET getDataEntitiesByDEGOddrn returns the FULL DEG member list in one response — no pagination. A DEG with 10K+ members produces a 10K-item CompactDataEntityList JSON response"

- **resource_allocation**:
  - "Body buffering: 20MB cap × concurrent-requests = 20MB × N memory headroom. Under heavy concurrent ingestion (50 collectors × 20MB), >1GB body-buffer memory pressure"
  - "Postgres connection: each @ReactiveTransactional path holds an R2DBC connection for the duration of the transaction; slow downstream pipelines (datasource resolution + processor chain + FTS update) hold the connection long"
  - "Session memory: WebSession default IN_MEMORY + spring.session.timeout=-1 → session attributes accumulate forever; on a long-running deployment with many transient collector identities, the session map grows unbounded (per batch-X SessionConfiguration sidecar)"

- **scaling_characteristics**:
  - "Stateful via WebSession (createDataSource only): instances cannot scale horizontally without sticky-session affinity OR shared session store (INTERNAL_POSTGRESQL or REDIS per SessionConfiguration). Bundled default is IN_MEMORY → effective single-instance for /ingestion/datasources path"
  - "Stateless on the other 4 handlers (no session reads): scale freely BUT all 4 share a single Postgres backend, so the bottleneck shifts to DB connection pool sizing + row-lock contention"
  - "No request queuing, no admission control, no backpressure beyond Reactor's natural backpressure: a fleet of misbehaving collectors can saturate the platform's R2DBC pool"

- **known_performance_gaps**:
  - "No DataBufferLimitException → 413 handler — over-cap payloads (>20MB) surface as 500, not 413. Operators investigating 500s have to grep server logs to diagnose payload-size issues" — evidence: IngestionController.java end-to-end (no @ExceptionHandler for DataBufferLimitException) — severity: LOW
  - "getDataEntitiesByDEGOddrn returns full DEG member list (no pagination): O(N) over `group_entity_relations` × `data_entity` — 10K+ member DEGs degrade response latency and consume client-side memory" — evidence: per batch-Z getDataEntitiesByDEGOddrn sidecar — severity: MEDIUM
  - "@ReactiveTransactional on ingest() holds an R2DBC connection for the duration of the full processor chain — under heavy multi-tenant deployment with slow downstream services (FTS recalc, metric export), connection pool exhaustion possible" — evidence: per batch-F postDataEntityList sidecar + IngestionServiceImpl.java:66 — severity: MEDIUM
  - "Body parsed TWICE on filter-enabled path: IngestionDataEntitiesFilter parses to extract dataSourceOddrn; the controller re-parses via Mono<DataEntityList>. Double-parse on every POST" — evidence: per IngestionDataEntitiesFilter sidecar invariants[5] — severity: LOW-MEDIUM
  - "Session memory accumulation: spring.session.timeout=-1 + IN_MEMORY → unbounded growth over long deployments per scaling_characteristics" — evidence: application.yml:2-3, 30 + SessionConfiguration.java — severity: LOW

## upstream_callers

- entry_point: "rest:POST /ingestion/datasources"
  caller_node: "odd-collector / odd-collector-sdk / push adapters — external to this codebase"
  multiplicity_per_trigger: 1
  evidence: "IngestionController.java:47-73 (createDataSource @Override); IngestionDataSourceFilter.java:20 + 28 (path-matcher); per batch-P createDataSourceEntity sidecar upstream_callers[0-3]"
  observation_class: rest-call

- entry_point: "rest:POST /ingestion/entities"
  caller_node: "odd-collector / odd-collector-sdk / push adapters"
  multiplicity_per_trigger: 1
  evidence: "IngestionController.java:37-45 (postDataEntityList @Override); IngestionDataEntitiesFilter.java:28; per batch-F postDataEntityList sidecar"
  observation_class: rest-call

- entry_point: "rest:GET /ingestion/dataentitygroups/{deg_oddrn}/entities"
  caller_node: "odd-collector / third-party integrations needing DEG membership"
  multiplicity_per_trigger: 1
  evidence: "IngestionController.java:75-79 (getDataEntitiesByDEGOddrn @Override); per batch-Z getDataEntitiesByDEGOddrn sidecar"
  observation_class: rest-call

- entry_point: "rest:POST /ingestion/entities/datasets/stats"
  caller_node: "odd-collector-profiler / custom DQ frameworks"
  multiplicity_per_trigger: 1
  evidence: "IngestionController.java:81-87 (postDataSetStatsList @Override); per batch-Z postDataSetStatsList sidecar; BaseIngestionTest.java:82-88"
  observation_class: rest-call

- entry_point: "rest:POST /ingestion/metrics"
  caller_node: "odd-collector (metrics-enabled) / external Prometheus push integrations"
  multiplicity_per_trigger: 1
  evidence: "IngestionController.java:89-95 (ingestMetrics @Override); per batch-Z ingestMetrics sidecar; BaseIngestionTest.java:90-96"
  observation_class: rest-call

- entry_point: "rest:* (any /ingestion/* path under DISABLED auth)"
  caller_node: "unauthenticated network probe — any TCP-reachable caller under default deployment"
  multiplicity_per_trigger: 0..N
  unresolved: true
  evidence: "IngestionController.java end-to-end (no auth at controller layer); SecurityConstants.java:95-96 (/ingestion/** in WHITELIST_PATHS); DisabledAuthSecurityConfiguration.java:14-18 (anyExchange().permitAll())"
  observation_class: rest-call

## downstream_side_effects

- side_effect_class: db-write
  description: "postDataEntityList → full IngestionService.ingest processor chain: hollow-entity fill, dataset-version structure, metadata, runs, alerts, lineage, view-popularity ranks, FTS vectors. Single @ReactiveTransactional bounded write batch"
  evidence: "IngestionController.java:43 → IngestionServiceImpl.java:66 (per batch-F sidecar)"
  cardinality_per_call: "1 multi-table transaction; per-entity row mutations × items_count"
  reachable_from_entry_points: ["rest:POST /ingestion/entities", "rest:* (any /ingestion/* under DISABLED)"]

- side_effect_class: db-write
  description: "createDataSource → DataSourceIngestionService.createDataSources: upsert-by-ODDRN narrow merge (name+description) on data_source table; token rows referenced via FK; namespace inherited from Collector"
  evidence: "IngestionController.java:70-71 → DataSourceIngestionServiceImpl.createDataSources (per batch-P sidecar)"
  cardinality_per_call: "1 @ReactiveTransactional with bulkUpdate + bulkCreate; row mutations × datasources_count"
  reachable_from_entry_points: ["rest:POST /ingestion/datasources"]

- side_effect_class: db-write
  description: "postDataSetStatsList → DatasetFieldService.updateStatistics: JSONB blob replace on dataset_field.stats; EXTERNAL_STATISTICS tag-relations reconcile (additive + remove); FTS vector recalc"
  evidence: "IngestionController.java:85 → IngestionServiceImpl.ingestStats line 78 → DatasetFieldServiceImpl.updateStatistics line 159 (per batch-Z sidecar)"
  cardinality_per_call: "1 @ReactiveTransactional; row updates × fields_count + tag-relation deltas + FTS-row updates × datasets_count"
  reachable_from_entry_points: ["rest:POST /ingestion/entities/datasets/stats", "rest:* (any /ingestion/* under DISABLED+OAUTH2+LDAP)"]

- side_effect_class: db-write
  description: "ingestMetrics under INTERNAL_POSTGRES → metric_series + metric_point inserts (default)"
  evidence: "IngestionController.java:93 → IngestionMetricsService → InternalIngestionMetricsServiceImpl (per batch-Z sidecar)"
  cardinality_per_call: "1 @ReactiveTransactional; metric_point inserts × labeled-metric-points-count"
  reachable_from_entry_points: ["rest:POST /ingestion/metrics", "rest:* (any /ingestion/* under DISABLED+OAUTH2+LDAP)"]

- side_effect_class: external-call
  description: "ingestMetrics under PROMETHEUS → Snappy-compressed remote-write POST to metrics.prometheus-host"
  evidence: "IngestionController.java:93 → ExternalIngestionMetricsServiceImpl (per batch-Z sidecar)"
  cardinality_per_call: "1 outbound HTTP POST per request"
  reachable_from_entry_points: ["rest:POST /ingestion/metrics"]

- side_effect_class: cache-mutate
  description: "WebSession state write: IngestionDataSourceFilter writes COLLECTOR_ID_SESSION_KEY before createDataSource runs (the controller READS this); not a write by the controller itself, but a class-level integration point"
  evidence: "IngestionDataSourceFilter.java:37-38 (writer); IngestionController.java:52 (reader)"
  cardinality_per_call: "1 session-attribute write per createDataSource call"
  reachable_from_entry_points: ["rest:POST /ingestion/datasources"]

- side_effect_class: db-write
  description: "tag-namespace side-channel via postDataSetStatsList — tagService.getOrCreateTagsByName creates new tag rows if absent (bypasses TAG_CREATE permission)"
  evidence: "Per batch-Z postDataSetStatsList sidecar referencing DatasetFieldServiceImpl.java:202"
  cardinality_per_call: "0..N new tag rows per call (depends on novel tag names in payload)"
  reachable_from_entry_points: ["rest:POST /ingestion/entities/datasets/stats", "rest:* (any /ingestion/* under default deployment)"]

- side_effect_class: log-emit
  description: "ZERO log emission by the controller body (no log.* calls despite @Slf4j annotation at line 30). Downstream services emit at INFO level (org.opendatadiscovery.oddplatform.service.ingestion: info per application.yml:257)"
  evidence: "IngestionController.java:30 + Grep `log\\.` returning 0 hits"
  cardinality_per_call: 0
  reachable_from_entry_points: ["all 5"]

- side_effect_class: page-render
  description: "getDataEntitiesByDEGOddrn returns CompactDataEntityList JSON to the caller"
  evidence: "IngestionController.java:78"
  cardinality_per_call: "1 JSON response per call"
  reachable_from_entry_points: ["rest:GET /ingestion/dataentitygroups/{deg_oddrn}/entities"]

## sources

- understanding ← IngestionController.java:1-103 + IngestionDataSourceFilter.java:15-43 + IngestionDataEntitiesFilter.java:20 + application.yml:46-48 + SecurityConstants.java:95-96 + LoginFormSecurityConfiguration.java:50 + OAuthSecurityConfiguration.java:98 + LDAPSecurityConfiguration.java:145 + DisabledAuthSecurityConfiguration.java:16 + WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security` 2026-05-25 status 200
- concepts.entities.IngestionApi ← IngestionController.java:10, 31
- concepts.entities.SessionConstants ← IngestionController.java:8 + SessionConstants.java:4
- concepts.entities.IngestionService ← IngestionController.java:18 + per batch-F + batch-Z sidecars referencing IngestionServiceImpl.java
- concepts.operations.postDataEntityList ← IngestionController.java:37-45
- concepts.operations.createDataSource ← IngestionController.java:47-73 + IngestionController.java:97-102 (validateDataSources helper)
- concepts.operations.getDataEntitiesByDEGOddrn ← IngestionController.java:75-79
- concepts.operations.postDataSetStatsList ← IngestionController.java:81-87
- concepts.operations.ingestMetrics ← IngestionController.java:89-95
- concepts.invariants.openapi-contract-driven ← IngestionController.java:31, 37, 47, 75, 81, 89 (no path annotations anywhere)
- concepts.invariants.response-code-drift ← IngestionController.java:44 vs 86 vs 94 + BaseIngestionTest.java:79, 87, 95
- concepts.invariants.identity-resolution-bifurcation ← IngestionController.java:50-58 + IngestionDataSourceFilter.java:37-38 + per batch-F sidecar (postDataEntityList payload-driven)
- concepts.invariants.transaction-boundary-disagreement ← per batch-F + batch-Z + batch-P sidecars consolidated
- dependencies_semantic.requires-feature.IngestionApi ← IngestionController.java:10 + gradle/libs.versions.toml:6,65,142 (per batch-Z sidecars)
- dependencies_semantic.requires-feature.IngestionService ← IngestionController.java:18, 32
- dependencies_semantic.requires-feature.IngestionDataSourceFilter ← IngestionDataSourceFilter.java:15-22 (unconditional @Component)
- dependencies_semantic.requires-feature.IngestionDataEntitiesFilter ← IngestionDataEntitiesFilter.java:20 (@ConditionalOnProperty)
- dependencies_semantic.requires-config.auth.ingestion.filter.enabled ← application.yml:46-48 + IngestionDataEntitiesFilter.java:20
- dependencies_semantic.requires-config.auth.type ← application.yml:32-34 + DisabledAuthSecurityConfiguration.java:10 + LoginFormSecurityConfiguration.java:31 + OAuthSecurityConfiguration.java:71 + LDAPSecurityConfiguration.java:51
- dependencies_semantic.requires-config.auth.s2s.enabled ← application.yml:40-41 + S2sAuthenticationFilter.java:19-49 + LoginFormSecurityConfiguration.java:42,61-63 + OAuthSecurityConfiguration.java:90,108-110 + LDAPSecurityConfiguration.java:140,149-151
- dependencies_semantic.requires-config.spring.codec.max-in-memory-size ← application.yml:14-15
- dependencies_semantic.requires-config.spring.session.timeout ← application.yml:2-3
- dependencies_semantic.requires-config.metrics.storage ← application.yml:158-159 + per batch-Z ingestMetrics sidecar
- dependencies_semantic.coupling.path-mapping-contract-driven ← IngestionController.java:31, 37, 47, 75, 81, 89
- dependencies_semantic.coupling.websession-stringly-typed ← SessionConstants.java:4 + IngestionController.java:52 + IngestionDataSourceFilter.java:37-38
- dependencies_semantic.coupling.service-fan-out ← IngestionController.java:32-35
- dependencies_semantic.coupling.no-slf4j-usage ← IngestionController.java:30 + Grep `log\\.` returning 0
- tests_coverage_semantic.covered_behaviours.[0-4] ← BaseIngestionTest.java:63-72, 74-80, 82-88, 90-96 + DatasetFieldIngestionTest.java + LoadIngestionTest.java + LineageIngestionTest.java + etc.
- tests_coverage_semantic.uncovered_behaviours ← inferred from absence (Grep for negative-test patterns across the 9 test files in odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/api/ingestion/ + BaseIngestionTest.java)
- docs_link_semantic.inferred_docs.enable-security ← WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security` 2026-05-25 status 200
- docs_link_semantic.inferred_docs.custom-collectors ← per batch-P createDataSourceEntity sidecar (inherited)
- docs_link_semantic.doc_drift_findings ← live docs excerpts compared to application.yml:46-48 (no inline warnings)
- implicit_adrs.[0] openapi-contract-driven ← IngestionController.java:31, 37, 47, 75, 81, 89 + AlertManagerController.java (counterexample per IngestionDataEntitiesFilter sidecar)
- implicit_adrs.[1] two-filter-classes-asymmetric ← IngestionDataSourceFilter.java:15 + IngestionDataEntitiesFilter.java:20 + application.yml:48
- implicit_adrs.[2] identity-bifurcation ← IngestionController.java:50-58 + IngestionController.java:43 + IngestionDataSourceFilter.java:37-38
- implicit_adrs.[3] mirrored-boot-time-service ← per batch-Z ingestMetrics sidecar
- bugs_limitations_corner_cases.[0] default-off-ingestion-auth ← per existing evidence sources
- bugs_limitations_corner_cases.[1] toggle-enabled-3-still-unauth ← IngestionDataEntitiesFilter.java:28 + SecurityConstants.java:96
- bugs_limitations_corner_cases.[2] response-code-drift ← IngestionController.java:44 vs 86 vs 94
- bugs_limitations_corner_cases.[3-9] all from IngestionController.java end-to-end + per cross-batch sidecars
- security.* ← consolidated across method-level sidecars + IngestionController.java + filter classes + SecurityConstants.java + 4 SecurityConfiguration classes
- performance.* ← consolidated across method-level sidecars + IngestionController.java + application.yml
- upstream_callers.[*] ← per batch-F + batch-P + batch-Z + batch-O sidecars + IngestionController.java end-to-end
- downstream_side_effects.[*] ← per batch-F + batch-P + batch-Z sidecars + IngestionController.java end-to-end
- stress_findings.* ← Stress Protocol applied to IngestionController.java:1-103 with neighbour reads of IngestionDataSourceFilter / IngestionDataEntitiesFilter / SecurityConstants / 4 SecurityConfiguration classes

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH
- upstream_callers: HIGH
- downstream_side_effects: HIGH
- stress_findings: HIGH (27 of 28 questions STATIC-INFERRED; only the 4-mode auth disjointness LOGIN_FORM-vs-OAUTH2 difference is PROBE-NEEDED via P-146)

## Maintainer notes

(Reserved — preserved across refreshes. Empty in this initial class-level rev.)

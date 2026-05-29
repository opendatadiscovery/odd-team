---
doc_page: "docs/integrations/README.md"
page_title: "Integrations"
live_url: "https://docs.opendatadiscovery.org/integrations"
live_url_verified_status: "200"
live_url_resolved_slug: "integrations"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "S2S Ingestion Pipeline"
    - "Ingest Data Entity List (S2S)"
    - "Collector"
    - "ODD Collector (runtime)"
    - "Collector Token"
    - "Ingestion Filter"
  features:
    - "F-033"
    - "F-162"
  code_nodes:
    - "odd-platform java IntegrationController controller-method:getIntegrationPreviews"
    - "odd-platform java IngestionController controller-method:postDataEntityList"
    - "odd-platform openapi tags openapi-tag:integration"
audience: [operator, developer]
doc_claim_vs_code:
  - "VERIFIED-ACCURATE (no drift): page's 'Integration Wizard' section claims manifests live on the classpath at `META-INF/wizard/*.yaml` and are exposed via `GET /api/integrations` / `GET /api/integrations/{integration_id}` — code confirms exactly: IntegrationRegistryFactory.java:26 (`classpath*:META-INF/wizard/*.yaml`); the OpenAPI `integration` tag declares exactly two operations getIntegration + getIntegrationPreviews (node `odd-platform openapi tags openapi-tag:integration`); IntegrationController.java:15-27 implements both."
  - "VERIFIED-ACCURATE (no drift): page claims the wizard's only static-parameter substitution context is `platform_url`, resolved from `odd.platform-base-url` — code confirms: StaticArgumentMappingContext.java:11 (`PLATFORM_URL_PARAM_NAME = \"platform_url\"`) + :16 (`@Value(\"${odd.platform-base-url:http://your.odd.platform}\")`), a single-entry Map.of(platform_url, platformUrl)."
  - "VERIFIED-ACCURATE (no drift): page's Ingestion-error-contract claim 'Duplicate ODDRN inside one batch → IllegalStateException: Duplicate key (Collectors.toMap default merger) → 5xx' — code confirms: IngestionServiceImpl.java:86 `collect(Collectors.toMap(DataEntityIngestionDto::getOddrn, identity()))` has NO merge function, so a second non-JOB_RUN DataEntity with the same ODDRN throws IllegalStateException: Duplicate key inside @ReactiveTransactional; no @ExceptionHandler converts it → HTTP 500."
  - "VERIFIED-ACCURATE (no drift): page claim 'Unknown data_source_oddrn → NotFoundException → 5xx' — code confirms: IngestionServiceImpl.java:69 `switchIfEmpty(Mono.error(NotFoundException(\"dataSource\", oddrn)))`; no @ExceptionHandler(NotFoundException) on the reactive ingestion path → default WebFlux handler returns 500, not 404."
  - "VERIFIED-ACCURATE (no drift): page claim 'Payload exceeds the configured codec limit → DataBufferLimitException → 5xx; raise spring.codec.max-in-memory-size' — code confirms: Mono<DataEntityList> reactive body bind (IngestionController.java:38) buffers up to spring.codec.max-in-memory-size (application.yml, 20MB); over-cap throws DataBufferLimitException with no handler → HTTP 500 (not 413). (postDataEntityList sidecar bugs_limitations_corner_cases[3].)"
  - "VERIFIED-ACCURATE (no drift): page claim 'POST /ingestion/entities holds a PostgreSQL SELECT … FOR UPDATE row-lock on the resolved data_source row for the entire pipeline duration (data-source resolve + 14-step ingestion processor chain + OTLP metric export)' — code confirms ALL THREE parts: (a) IngestionServiceImpl.java:68 `getIdByOddrnForUpdate(...)` (FOR UPDATE) is the first op inside @ReactiveTransactional (line 66); (b) the processor chain has EXACTLY 14 IngestionRequestProcessor implementations (Activity, Alert, DataQualityTestRelation, DatasetStructure, ExternalTag, FTSVectors, GroupEntityRelation, GroupParentGroup, HollowDataEntity, Lineage, Metadata, Relationship, TaskRun, UsageReport) all constructor-autowired into IngestionProcessorChain.java:20-27; (c) `otlpMetricService::exportMetrics` runs inside the same transaction at IngestionServiceImpl.java:72. No Retry-After / 429 exists on this path."
  - "VERIFIED-ACCURATE (no drift): page claim 'destructive-path observability — the ingestion service rollback paths have no structured logging; collector identity / target datasource ODDRN / entity count / batch identifier are not present in platform logs on rollback' — code confirms: IngestionServiceImpl.java has ZERO log.* calls (the @Slf4j is unused), no doOnError / onErrorResume; the only logging in the whole pipeline is one log.debug in IngestionProcessorChain.java:50 for per-processor scheduling decisions — nothing on the error/rollback paths."
  - "CAVEAT-GAP (soft): the 'Token and datasource registration' section says `POST /ingestion/datasources` 'is unauthenticated by default — see Enable security → Ingestion authentication for the production posture'. It correctly cross-links the security posture, but does NOT state the LSN-001/LSN-002-class severity surfaced by the code: under the bundled `auth.ingestion.filter.enabled: false` default, /ingestion/** is in SecurityConstants.WHITELIST_PATHS (exempt from EVERY UI auth mode), so ANY caller reaching the HTTP port can register/ingest into ANY datasource by writing its ODDRN in the payload (postDataEntityList sidecar security.known_security_gaps[0]/[2], severity HIGH; node `odd-platform java IngestionController controller-method:postDataEntityList`). Candidate DOC-NNN: add an admonition on the default-unauthenticated WRITE posture, not only a forward link."
maintainer_curated: false
---

# Integrations — doc understanding

This is the integration hub: the operator's single landing page for "how does metadata get into the ODD Platform." It establishes the pull-vs-push taxonomy and the three push deployment shapes (in-process plugin, standalone gateway, direct SDK/CLI), routes the reader to the right adapter page via a "Which integration do I need?" decision list, and then documents the platform-side contract that every integration shares: the collector config schema, the in-app **Integration Wizard**, the collector-token + datasource-registration flow, and — uniquely — the **ingestion error contract** and per-datasource serialisation behaviour that collector authors writing retry logic must respect.

The page binds tightly to confirmed odd-platform code. The Integration Wizard claims map verbatim onto `IntegrationController` (node `odd-platform java IntegrationController controller-method:getIntegrationPreviews`), the OpenAPI `integration` tag's two operations (node `odd-platform openapi tags openapi-tag:integration`), the classpath manifest loader `IntegrationRegistryFactory.java:26`, and the `platform_url`/`odd.platform-base-url` substitution at `StaticArgumentMappingContext.java:11,16` — the substrate captures this as features F-033 (classpath-loaded YAML manifests + platform_url substitution) and F-162 (the argument-form authoring UX). The entire "Ingestion error contract" + serialisation + observability narrative maps onto `IngestionController.postDataEntityList` (node `odd-platform java IngestionController controller-method:postDataEntityList`) and its service `IngestionServiceImpl.ingest` (IngestionServiceImpl.java:67-74): the `Collectors.toMap` duplicate-key 5xx (:86/:94), the `NotFoundException` 5xx (:69), the `DataBufferLimitException` 5xx (20 MB codec cap), the `SELECT … FOR UPDATE` lock held across the 14-processor chain + in-line OTLP export, and the total absence of rollback-path logging — every one verified, none drifting.

Notably, this page **resolves** a doc gap the code-side analysis previously flagged: the `postDataEntityList` sidecar recorded "NO live ODD doc documents the `POST /ingestion/entities` mechanics" (data-ingestion → 404). This Integrations page now documents that endpoint's error contract and contention behaviour for collector authors — closing that gap from the operator/developer side. The one remaining soft gap is that the datasource-registration paragraph forward-links the security posture without naming the default-unauthenticated-WRITE severity inline (see `doc_claim_vs_code`).

## Maintainer notes

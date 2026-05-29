---
doc_page: "docs/data-quality/test-results-import.md"
page_title: "Test Results Import"
live_url: "https://docs.opendatadiscovery.org/features/data-quality/test-results-import"
live_url_verified_status: "200"
live_url_resolved_slug: "features/data-quality/test-results-import"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Data Quality Test"
    - "Data Quality Test Category"
    - "Dataset Test Report"
    - "Ingest Data Entity List (S2S)"
    - "Data Quality Dashboard"
  features:
    - "F-032"
  code_nodes:
    - "odd-platform java IngestionController controller-method:postDataEntityList"
    - "odd-platform java IngestionController controller-method:postDataSetStatsList"
audience: [operator, developer]
doc_claim_vs_code:
  - "Page (Custom frameworks section) says: push results 'through the POST /ingestion/entities/datasets/stats endpoint ... you author a small client that maps your framework's outcomes onto ODD's DataEntityList schema with DataQualityTest and DataQualityTestRun entity types.' CODE: POST /ingestion/entities/datasets/stats (postDataSetStatsList, IngestionController.java:81) accepts a DatasetStatisticsList payload (DataSetStatistics = dataset_oddrn + fields: Map<fieldOddrn, DataSetFieldStat>) and writes per-COLUMN statistical profiles into dataset_field.stats JSONB via DatasetFieldServiceImpl.updateStatistics — it does NOT accept a DataEntityList and never handles DataQualityTest/DataQualityTestRun entities. The endpoint that accepts DataEntityList (and therefore the DATA_QUALITY_TEST / DATA_QUALITY_TEST_RUN data-entity types) is POST /ingestion/entities (postDataEntityList, IngestionController.java:37 — IngestionServiceImpl.ingest). The page names the wrong endpoint AND the wrong payload binding for custom test-result push. Evidence: postDataSetStatsList (IngestionController.java:81; understanding section — 'collectors / DQ tooling push a DatasetStatisticsList payload ... WRITES per-field statistics as a JSONB blob into dataset_field.stats') vs postDataEntityList / operation:ingest-data-entity-list-s2s ('POST /ingestion/entities — canonical S2S ingestion entry point ... deserialise Mono<DataEntityList> carrying data_source_oddrn + items: List<DataEntity>'). HIGH — an operator following this will POST a DataEntityList to a stats endpoint that ignores it (no items field → NullPointerException at DatasetFieldServiceImpl.java:161 on null, or a silent no-op transaction commit on an empty/mismatched body); their test results never land."
  - "Page conflates two distinct ingestion contracts under one endpoint. The profiler path (odd-collector-profiler, 'Statistical profiles' section) genuinely uses POST /ingestion/entities/datasets/stats with DatasetStatisticsList (per-column DataSetFieldStat profiles) — postDataSetStatsList. The framework-test-result paths (Great Expectations, dbt) push DataEntityList with DataQualityTest/DataQualityTestRun entities to POST /ingestion/entities — postDataEntityList. These are different endpoints with different payload schemas; the page presents /ingestion/entities/datasets/stats as the single ingestion route for both classes. Evidence: postDataSetStatsList (IngestionController.java:81, DatasetFieldServiceImpl.updateStatistics) vs operation:ingest-data-entity-list-s2s (POST /ingestion/entities). MEDIUM-HIGH."
  - "Page omits the security caveat on the endpoint it tells operators to call. POST /ingestion/entities/datasets/stats is unauthenticated under EVERY auth.type ∈ {DISABLED, OAUTH2, LDAP} and regardless of auth.ingestion.filter.enabled, because the path sits in SecurityConstants.WHITELIST_PATHS via /ingestion/** (SecurityConstants.java:95-96) and IngestionDataEntitiesFilter binds exact-literal /ingestion/entities only (IngestionDataEntitiesFilter.java:28), not the sub-path. The page presents the endpoint as a normal integration surface with no auth note. (The Security page surfaces the gap; the DQ page where an operator first meets the endpoint does not cross-link it.) Evidence: postDataSetStatsList invariants (IngestionController.java:81 sidecar). LSN-002-class missing-caveat. MEDIUM."
maintainer_curated: false
---

# Test Results Import — doc understanding

This page tells a DQ operator/developer how external test-suite results land in ODD: three packaged integrations (Great Expectations via `odd-great-expectations`, dbt via `odd-dbt`, statistical profiles via `odd-collector-profiler`), plus a custom-framework escape hatch. The results surface on the dataset's **Test reports** tab (`operation:aggregate-test-status-counts-for-dataset` / `entitie:dataset-test-report`) and aggregate into the catalog-wide **Quality Dashboard** (`F-032` / `entitie:data-quality-dashboard`, with per-category breakdown via `entitie:data-quality-test-category`). The ingested unit is the `Data Quality Test` concept (`entitie:data-quality-test`).

The page's high-value defect is in **Custom frameworks**: it directs operators to `POST /ingestion/entities/datasets/stats` and to map their outcomes onto the `DataEntityList` schema with `DataQualityTest`/`DataQualityTestRun` entity types. The code splits these two things across two different endpoints. `/ingestion/entities/datasets/stats` (`postDataSetStatsList`, IngestionController.java:81) consumes a `DatasetStatisticsList` of per-column field statistics and writes them to `dataset_field.stats` — it is the *profiler* path, not the test-result path. The endpoint that consumes a `DataEntityList` (and therefore `DataQualityTest`/`DataQualityTestRun`) is `POST /ingestion/entities` (`postDataEntityList`, IngestionController.java:37; `operation:ingest-data-entity-list-s2s`) — the same canonical S2S route Great Expectations and dbt use. An operator following the page sends the wrong payload to the wrong endpoint. Both endpoints are also unauthenticated in every default deployment (`/ingestion/**` whitelist), which the page does not caveat.

## Maintainer notes

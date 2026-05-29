---
doc_page: "docs/integrations/push-adapters/odd-spark-adapter.md"
page_title: "odd-spark-adapter"
live_url: "https://docs.opendatadiscovery.org/integrations/integrations/odd-spark-adapter"
live_url_verified_status: "200"
live_url_resolved_slug: "integrations/integrations/odd-spark-adapter"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "ODDRN"
    - "Ingest Data Entity List (S2S)"
    - "Replace lineage paths (establisher-keyed atomic rewrite)"
  features:
    - "F-008"
  code_nodes: []
audience: [operator, developer]
doc_claim_vs_code:
  - "Page ('What gets sent' — 'Lineage edges ... derived from the Spark plan as the listener observes it'; 'Known limitations' lists no lineage-overwrite caveat) presents Spark-emitted lineage as additive. The platform endpoint this adapter pushes to (POST /ingestion/entities) is REPLACE-not-merge for lineage: each Spark job re-emits the lineage for its own read/write set, and LineageServiceImpl.replaceLineagePaths groups the payload by establisher_oddrn, batchDeleteByEstablisherOddrn then batchInsertLineages — an establisher present in the new payload with an INCOMPLETE edge list has its omitted edges SILENTLY DELETED, no warning log, Mono<Void> 200 response. A re-run of the same Spark application whose plan changed (a source dropped, a join removed, a job that read fewer tables this run) erases the previously-recorded edges for that establisher with no operator-visible signal. Operator-critical caveat (LSN-001/LSN-002 silent-data-loss class) the page omits; especially acute for Spark because per-job re-emission is the normal operating mode. Evidence: F-008 + concept operation:replace-lineage-paths-establisher-keyed-atomic-rewrite + invariant:silent-data-loss-replace-not-merge-ingestion-semantics + LineageServiceImpl.java:124-133, caller LineageIngestionRequestProcessor.java:17. (HIGH — silent lineage loss on partial/changed re-emit.)"
  - "Page ('Known limitations' → 'No static collector token. The adapter identifies itself via spark.odd.oddrn.key; the platform must be configured to accept ingestion from that ODDRN under your authentication posture (see Enable security → Ingestion authentication)') correctly tells the operator the adapter carries NO token and links the security page — softer than the sibling odd-dbt / odd-airflow-2 pages, which stated nothing. The residual drift: the page does not surface that the filter guarding the endpoint this adapter targets (POST /ingestion/entities, via IngestionDataEntitiesFilter) is gated by auth.ingestion.filter.enabled which DEFAULTS FALSE — so on a default/bundled platform deployment the Spark lineage push is accepted UNAUTHENTICATED regardless of spark.odd.oddrn.key, and an operator reading 'configure the platform to accept ingestion from that ODDRN' may believe a per-ODDRN allow-step is required when on the default posture none is enforced. Evidence: concept operation:ingest-data-entity-list-s2s ('IngestionDataEntitiesFilter ... gated by auth.ingestion.filter.enabled, defaults FALSE; Bundled deployment ships UNAUTHENTICATED') + invariant:two-ingestion-filters-asymmetric-auth (application.yml:48 default false; IngestionDataEntitiesFilter exact-literal POST /ingestion/entities matcher). (MEDIUM — cross-page; default-off ingestion auth on the entities endpoint not surfaced on the push-adapter page.)"
maintainer_curated: false
---

# odd-spark-adapter — doc understanding

This page is the operator/developer manual for `odd-spark-adapter` — a push adapter distributed as a **JVM JAR** (not a PyPI package, unlike the other push adapters) that runs as an Apache Spark `SparkListener` attached to the driver, captures lineage from each job's read/write operations (RDD, JDBC, Kafka batch, Snowflake, S3 Delta sources at v0.0.1), and pushes the metadata to ODD Platform. The adapter's own code lives in the separate `opendatadiscovery/odd-spark-adapter` repo, so it is **cross-repo relative to the odd-platform substrate**: `graph-search --label CodeNode` for the Spark listener / mappers returns honest-empty (`[]`), and no platform CodeNode is *described by* this page. The bindings below are the platform-side concepts the adapter's behaviour terminates in (the ingestion endpoint it pushes to and the cross-system identifier it constructs), each confirmed via graph-node.

What the page genuinely documents on the platform side:
- **ODDRN** (`entitie:oddrn`) — `spark.odd.oddrn.key` is the per-cluster seed the adapter uses to *construct ODDRNs* for the entities it emits, and the page's stitching claim ("JDBC reads of a table already catalogued by `odd-collector` … connect to the existing dataset entity automatically") IS the cross-system-identifier role of ODDRN — the platform recognises the same dataset across producers by matching ODDRN. Canonical home `main-concepts.md ## ODDRN`. A correct, load-bearing platform-side binding.
- **Ingest Data Entity List (S2S)** (`operation:ingest-data-entity-list-s2s`) — `POST /ingestion/entities`, the canonical S2S entry point that receives the Spark applications + lineage edges this adapter sends; datasource scoping is payload-driven by `data_source_oddrn`, dedup-by-ODDRN at the data layer.
- **Replace lineage paths (establisher-keyed atomic rewrite)** (`operation:replace-lineage-paths-establisher-keyed-atomic-rewrite`) — the ingestion-side primitive (`LineageServiceImpl.replaceLineagePaths`, `LineageServiceImpl.java:124-133`, the service's only `@ReactiveTransactional` method) that actually persists the lineage edges this adapter's "What gets sent" describes; its delete-then-insert-by-establisher contract is the mechanism behind the high-value drift below.
- **F-008** (`Ingestion-replace destruction surface`) — the composed feature flow whose entry point is `POST /ingestion/entities`; the Spark lineage push lands directly on this destruction surface.

The high-value output is the **doc-claim-vs-code drift** on the platform endpoint the adapter targets (both findings fully cited in frontmatter):
1. **Lineage is REPLACE-not-merge** (HIGH). The page treats Spark-emitted lineage as additive and lists no overwrite caveat, but a re-run whose Spark plan changed silently deletes the prior edges for that establisher (`replaceLineagePaths`, `LineageServiceImpl.java:124-133`; the same silent-data-loss class already recorded for odd-dbt and odd-airflow-2). This is *more* acute for Spark than for the other adapters because per-job re-emission of the current plan is the adapter's normal operating mode, not an edge case.
2. **Default-off ingestion auth on the entities endpoint** (MEDIUM, softened). Unlike the sibling adapter pages, this page already states the adapter carries no token and links the security page — a more careful posture. The residual gap is that `POST /ingestion/entities` is guarded by `IngestionDataEntitiesFilter`, gated by `auth.ingestion.filter.enabled` (default false — `application.yml:48`); on the bundled/default platform the Spark push is unauthenticated regardless of `spark.odd.oddrn.key`, which the page's "configure the platform to accept ingestion from that ODDRN" phrasing does not make explicit.

Both are logged above as DOC-GAP candidates for the maintainer; neither is fixable on the platform side alone (the adapter docs, and/or the platform ingestion docs, need the caveat).

Live verification: the mechanical `live_url` guess (`/integrations/push-adapters/odd-spark-adapter`) 404s — GitBook collapses the `push-adapters` directory and serves the page at `/integrations/integrations/odd-spark-adapter` (200; H1 `odd-spark-adapter`; all section anchors — `requirements`, `supported-lineage-sources`, `installation`, `configuration`, `what-gets-sent`, `known-limitations`, `where-to-next` — present; sampled `configuration` + `known-limitations` confirmed). The resolved slug is recorded in `live_url_resolved_slug`.

## Maintainer notes
<!-- preserved across re-analysis; the only block a human hand-edits -->

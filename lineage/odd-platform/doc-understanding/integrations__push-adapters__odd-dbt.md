---
doc_page: "docs/integrations/push-adapters/odd-dbt.md"
page_title: "odd-dbt"
live_url: "https://docs.opendatadiscovery.org/integrations/integrations/odd-dbt"
live_url_verified_status: "200"
live_url_resolved_slug: "integrations/integrations/odd-dbt"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Data Quality Test"
    - "ODDRN"
    - "Register Data Source from Collector (S2S, upsert by ODDRN)"
    - "Ingest Data Entity List (S2S)"
    - "Data Quality Dashboard (catalog-wide aggregate quality view)"
  features: []
  code_nodes: []
audience: [operator, developer]
doc_claim_vs_code:
  - "Page ('What gets sent' — 'Model-to-model lineage edges derived from manifest.json'; 'Known limitations' lists no lineage caveat) presents dbt lineage as additive. The platform endpoint `odd_dbt_test ingest-lineage` targets (POST /ingestion/entities) is REPLACE-not-merge for lineage: re-ingesting after a manifest.json change in which a model's upstream refs were removed SILENTLY DELETES the previously-recorded edges for that establisher. LineageServiceImpl.replaceLineagePaths groups by establisher_oddrn, batchDeleteByEstablisherOddrn then batchInsertLineages — an establisher present in the new payload with an INCOMPLETE edge list has its omitted edges deleted, no warning, Mono<Void> 200 response. Operator-critical caveat (LSN-001/LSN-002 silent-data-loss class) the page omits. Evidence: concept `operation:replace-lineage-paths-establisher-keyed-atomic-rewrite` + invariant `silent-data-loss-replace-not-merge-ingestion-semantics` + LineageServiceImpl.java:124-133, caller LineageIngestionRequestProcessor.java:15-18. (HIGH.)"
  - "Page (Configuration table: ODD_PLATFORM_TOKEN 'Collector token issued by the platform'; no platform-side prerequisite stated) implies the collector token authenticates every push. Platform-side the two push paths have ASYMMETRIC auth: `create-datasource` rides POST /ingestion/datasources whose filter (IngestionDataSourceFilter) is ALWAYS-ON and validates the Bearer token; but `ingest-test` / `ingest-lineage` ride POST /ingestion/entities whose filter (IngestionDataEntitiesFilter) is gated by `auth.ingestion.filter.enabled` which DEFAULTS FALSE (application.yml:46-48; @ConditionalOnProperty havingValue=\"true\" at IngestionDataEntitiesFilter.java:20). On a default/bundled platform the actual test+lineage data pushes are UNAUTHENTICATED regardless of the token, so any caller can push to that data source's ODDRN namespace; an operator who never sets the flag may believe the token is gating those pushes when it is not. Evidence: concept `operation:register-data-source-from-collector-s2s` (always-on filter) vs `operation:ingest-data-entity-list-s2s` (filter default-off) + application.yml:46-48 + IngestionDataEntitiesFilter.java:20. (MEDIUM — cross-page; platform default-off ingestion auth not surfaced on the push-adapter page.)"
maintainer_curated: false
---

# odd-dbt — doc understanding

This page is the operator/developer manual for the `odd-dbt` PyPI package — a CLI push
adapter (`odd_dbt_test`, also bundled as `odd dbt` in `odd-cli`) that reads dbt's
`target/` artefacts after a run, maps generic test results + model lineage into the ODD
specification, and pushes them to ODD Platform. The adapter's own code lives in the
separate `opendatadiscovery/odd-dbt` repo, so it is **cross-repo relative to the
odd-platform substrate**: `graph-search --label CodeNode` for the dbt mappers
(`DbtTestMapper`, `DbtLineageMapper`) and `--label Feature` for the adapter both return
honest-empty, and no platform CodeNode or Feature is *described by* this page. The
bindings below are the platform-side concepts the page's behaviour terminates in (the
endpoints the adapter targets and the surfaces the ingested data lands on), each
confirmed via graph-node.

What the page genuinely documents on the platform side:
- **ODDRN** (`entitie:oddrn`) — the Configuration section's `DBT_DATA_SOURCE_ODDRN` IS an
  ODDRN, the cross-system identifier; the page links `../../main-concepts.md#oddrn`.
- **Register Data Source from Collector (S2S, upsert by ODDRN)**
  (`operation:register-data-source-from-collector-s2s`) — what `odd_dbt_test
  create-datasource` invokes (POST /ingestion/datasources, upsert keyed by ODDRN). The
  page's limitation "Changing DBT_DATA_SOURCE_ODDRN after first ingest registers the same
  project as a NEW data source" is **correct** against this concept's upsert-by-ODDRN
  semantics — not drift, a sound caveat.
- **Ingest Data Entity List (S2S)** (`operation:ingest-data-entity-list-s2s`) — POST
  /ingestion/entities, the canonical entry point that receives "dbt models as Data Entity
  entities" and the "model-to-model lineage edges"; datasource scoping is payload-driven
  by `data_source_oddrn`, dedup-by-ODDRN at the data layer.
- **Data Quality Test** (`entitie:data-quality-test`) — the concept whose own definition
  names dbt as one of the external test frameworks ODD aggregates; the page's "Generic
  test results with status (pass/fail/error/warn)" land here and surface on the dataset's
  "Test reports" tab.
- **Data Quality Dashboard (catalog-wide aggregate quality view)**
  (`entitie:data-quality-dashboard`) — the `/data-quality` aggregate the page's "What gets
  sent" / "Where to next" point dbt test results into via the Quality Dashboard link.

The high-value output is the **doc-claim-vs-code drift** on the two platform endpoints the
adapter targets (both in-graph, fully cited in frontmatter):
1. **Lineage is REPLACE-not-merge.** `ingest-lineage` re-emitted after a manifest change
   that drops a model's upstream ref silently deletes the prior edge
   (`replaceLineagePaths`, LineageServiceImpl.java:124-133; the same silent-data-loss class
   already recorded for odd-airflow-2). The page treats lineage as additive and lists no
   caveat.
2. **Asymmetric ingestion auth.** `create-datasource` is always token-authenticated, but
   the `ingest-test` / `ingest-lineage` data pushes ride the `/ingestion/entities` filter
   which is OFF by default (`auth.ingestion.filter.enabled: false`, application.yml:46-48;
   IngestionDataEntitiesFilter.java:20). On a default platform those pushes are
   unauthenticated; the page states the token as if it gates every push.
Both are logged above as DOC-GAP candidates for the maintainer; neither is fixable on the
platform side alone (the adapter docs need the caveat).

Live verification: the mechanical `live_url` guess (`/integrations/push-adapters/odd-dbt`)
404s — GitBook collapses the `push-adapters` directory and serves the page at
`/integrations/integrations/odd-dbt` (200; all section anchors present, sampled
`supported-targets` + `known-limitations` confirmed). The resolved slug is recorded in
`live_url_resolved_slug`.

## Maintainer notes
<!-- preserved across re-analysis; the only block a human hand-edits -->

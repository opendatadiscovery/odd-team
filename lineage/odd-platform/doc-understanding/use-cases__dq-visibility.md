---
doc_page: "docs/use-cases/dq-visibility.md"
page_title: "Visibility for Data Quality Engineer"
live_url: "https://docs.opendatadiscovery.org/use-cases/use-cases/dq-visibility"
live_url_verified_status: "200"
live_url_resolved_slug: "use-cases/use-cases/dq-visibility"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts: ["Data Quality Engineer", "Data Quality Test"]
  features: ["F-095"]
  code_nodes: []
audience: [operator, data-consumer]
doc_claim_vs_code:
  - "Scenario step 4 instructs operators to push custom DQ KPIs through `POST /ingestion/entities/datasets/stats` with no security or scoping caveat; code (F-095) shows the endpoint is unauthenticated under every supported auth.type (in WHITELIST_PATHS via /ingestion/** and NOT matched by IngestionDataEntitiesFilter) — evidence: F-095 / odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/utils/SecurityConstants.java:95-96 + odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/filter/IngestionDataEntitiesFilter.java:28"
  - "The same endpoint resolves writes by FIELD ODDRN from statistics.keySet() and never validates the resolved field's parent against the payload's datasetOddrn — a cross-dataset write surface the page presents as a benign self-service push channel — evidence: F-095 / odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DatasetFieldServiceImpl.java:158-181 + DatasetFieldServiceImpl.java:172-181"
maintainer_curated: false
---

# Visibility for Data Quality Engineer — doc understanding

A use-case (storytelling) page for the Data Quality Engineer operator role: ODD is positioned as an **aggregator** of external DQ signal (Great Expectations and dbt push-clients, `odd-collector-profiler` statistical profiles) plus a custom write surface, surfacing all results next to every dataset's metadata for cross-team visibility. It maps directly to the `Data Quality Engineer` audience concept (`audience:data-quality-engineer`, confirmed via graph-node — names this exact live page as the role's primary use case) and the `Data Quality Test` entity (`entitie:data-quality-test`, whose sidecar states ODD performs no checks itself and integrates GE / dbt / custom push adapters — exactly the page's Solution). The custom-push channel the Scenario advertises (`POST /ingestion/entities/datasets/stats`) is the entry point of feature F-095 (confirmed via graph-node).

The page's value-add and its drift are the same sentence: it tells operators to push custom KPIs through the stats endpoint without disclosing that F-095's sidecar documents that endpoint as unauthenticated under every supported `auth.type` and as a cross-dataset write surface (writes are scoped by field-ODDRN, never validated against the payload's parent dataset). Both `doc_claim_vs_code` entries carry F-095 `file:line` evidence and are DOC-GAP candidates of the LSN-001/LSN-002 class. No CodeNode was bound — `graph-search --label CodeNode` returned empty for the stats-ingestion path; the implementing code is reachable only via F-095's chain (sidecar nodes `unresolved`), so the binding is held at the feature layer rather than padded with an unconfirmed `node_id`.

## Maintainer notes

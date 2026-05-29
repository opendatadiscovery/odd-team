---
doc_page: "docs/integrations/push-adapters/odd-airflow-2.md"
page_title: "odd-airflow-2"
live_url: "https://docs.opendatadiscovery.org/integrations/integrations/odd-airflow-2"
live_url_verified_status: "200"
live_url_resolved_slug: "integrations/integrations/odd-airflow-2"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "ODDRN"
  features: []
  code_nodes: []
audience: [operator, developer]
doc_claim_vs_code:
  - "Page presents lineage as additive ('lineage edges derived from each task's inlets/outlets'; troubleshooting only covers edges MISSING) but the platform ingestion endpoint this adapter targets is REPLACE-not-merge: a collector tick that omits a lineage edge a prior tick emitted SILENTLY DELETES it. LineageIngestionRequestProcessor calls lineageService.replaceLineagePaths(...) which deletes ALL edges by the payload's establisher ODDRNs then re-inserts only the supplied ones. A DAG run that drops/changes an inlets/outlets value erases the previously-recorded edge with no warning and a Mono<Void> 200 response. Operator-critical caveat (LSN-001/LSN-002 class) the page omits entirely. Evidence: F-008 / LineageIngestionRequestProcessor.java:17 + LineageServiceImpl.replaceLineagePaths LineageServiceImpl.java:124-133. (HIGH — silent lineage loss on partial re-emit.)"
  - "Page directs the collector token to the Airflow Connection `Password` field, i.e. the per-datasource collector-token path (Authorization: Bearer <token>) enforced platform-side by IngestionDataEntitiesFilter — which is gated by `auth.ingestion.filter.enabled` (default false). The page states no platform-side prerequisite: on a default/bundled platform deployment the ingestion filter is OFF, so `/ingestion/entities` accepts pushes from any caller and the token is not validated; conversely an operator who never enables that flag may believe the token is authenticating the push when it is not. Evidence: F-008 (`auth.ingestion.filter.enabled: false` default — application.yml:48) + the S2S/IngestionDataEntitiesFilter Bearer-vs-X-API-Key split recorded in doc-understanding/configuration-and-deployment__enable-security__authentication__s2s.md. (MEDIUM — cross-page; platform default-off ingestion auth not surfaced on the push-adapter page.)"
maintainer_curated: false
---

# odd-airflow-2 — doc understanding

This page is the operator/developer manual for the `odd-airflow2-integration` PyPI package — a push adapter that runs inside the Airflow 2.5.1+ scheduler as an Airflow Listener, captures DAG/task/task-run metadata from Airflow's own lifecycle events, derives lineage from each task's `inlets`/`outlets`, and pushes it to ODD Platform via an Airflow Connection named `odd` (collector token in the `Password` field). The adapter's own code lives in the separate `opendatadiscovery/odd-airflow-2` repo (default branch `master`), so it is **cross-repo relative to the odd-platform substrate**: `graph-search --label CodeNode` for the adapter returns honest-empty, and no platform CodeNode or Feature is *described by* this page.

The one platform-side concept the page genuinely documents is **ODDRN** (`entitie:oddrn`, confirmed via graph-node) — the page links `../../main-concepts.md#oddrn` and the `inlets`/`outlets` strings ARE ODDRNs, the cross-system identifier the platform uses to recognise the same entity across ingests. Canonical home `main-concepts.md ## ODDRN`.

The high-value output here is the **doc-claim-vs-code drift** on the platform endpoint the adapter targets. The page treats lineage as additive, but `POST /ingestion/entities` is REPLACE-not-merge for lineage (feature flow F-008, primary-source: `LineageIngestionRequestProcessor.java:17` → `LineageServiceImpl.replaceLineagePaths` `LineageServiceImpl.java:124-133`): a re-publish that omits an edge silently deletes it. For an Airflow DAG whose `inlets`/`outlets` change between runs, prior edges vanish with no warning — exactly the silent-data-loss class (LSN-001/LSN-002) the page should caveat and does not. Secondarily, the `Password`-field token rides the collector Bearer path gated by `auth.ingestion.filter.enabled` (default false — `application.yml:48`); the page states no platform-side prerequisite, so on a default deployment the push is unauthenticated. Both are logged above as DOC-GAP candidates for the maintainer; neither is fixable on the platform side alone.

Live verification: the mechanical `live_url` guess (`/integrations/push-adapters/odd-airflow-2`) 404s — GitBook collapses the `push-adapters` directory and serves the page at `/integrations/integrations/odd-airflow-2` (200; all section anchors — `requirements`, `installation`, `configuration`, `what-gets-sent`, `known-limitations`, `troubleshooting` — present). The resolved slug is recorded in `live_url_resolved_slug`.

## Maintainer notes

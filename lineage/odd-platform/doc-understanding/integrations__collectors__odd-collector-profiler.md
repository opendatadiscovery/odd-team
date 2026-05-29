---
doc_page: "docs/integrations/collectors/odd-collector-profiler.md"
page_title: "odd-collector-profiler"
live_url: "https://docs.opendatadiscovery.org/integrations/integrations/odd-collector-profiler"
live_url_verified_status: "200"
live_url_resolved_slug: "integrations/integrations/odd-collector-profiler"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts: ["Collector", "Collector Token"]
  features: ["F-095"]
  code_nodes: ["odd-platform java IngestionController controller-method:postDataSetStatsList"]
audience: [operator]
doc_claim_vs_code:
  - "Page omits an operator-critical security caveat: it tells operators the profiler 'pushes the resulting statistics into the catalog' but never warns that the receiving platform endpoint POST /ingestion/entities/datasets/stats has NO auth gate and NO parent-child validation. Code: IngestionController.postDataSetStatsList is a 4-line proxy with no @PreAuthorize and no programmatic auth, and the path is NOT covered by IngestionDataEntitiesFilter (the filter matches exact-literal /ingestion/entities, not the stats path). Writes are scoped purely by field-ODDRN with no parent-child consistency check, so any caller who knows a field ODDRN can overwrite that field's dataset_field.stats JSONB. Evidence: node `odd-platform java IngestionController controller-method:postDataSetStatsList` / odd-platform-api/.../controller/ingestion/IngestionController.java:81-87; DatasetFieldServiceImpl.java:158-181 + 233-251; invariant:cross-dataset-stats-write-no-parent-child-consistency-check. (LSN-002 class — operator follows the guidance with no idea the surface is unauthenticated.)"
  - "UI-name terminology drift: the page calls the rendered statistics 'the Statistics view shown on a dataset's detail page'. The platform stores profiler output in dataset_field.stats and renders it on the dataset Structure tab (nulls_count / low_value / mean_value etc.); there is no separate 'Statistics view' surface as a distinct node in the ontology. Evidence: F-095 terminal_side_effect — 'Dataset Structure tab renders attacker-controlled values for nulls_count, low_value, mean_value' (feature-flows/detail/F-095.yaml)."
maintainer_curated: false
---

# odd-collector-profiler — doc understanding

This operator page documents a separate single-purpose collector (`odd-collector-profiler`, shipped as its own Docker image from the `odd-collector-profiler` repo) that runs Capital One's DataProfiler against `postgres` / `azure_sql` sources and pushes per-column statistics into the catalog. The collector itself is **cross-repo** — the DataProfiler runtime, the `profilers:` config block, the `postgres`/`azure_sql` profiler-type literals, and the per-profiler `tables:` cost guard live in `github.com/opendatadiscovery/odd-collector-profiler`, NOT in odd-platform; a `graph-search --label Feature` for the profiler image returns honest-empty, which is the correct signal for a collector-side capability the platform substrate does not own.

What the page *does* bind into the odd-platform ontology is the receiving end of the push and the collector-identity it authenticates with. The config keys `token` and `platform_host_url` map to the confirmed concepts **Collector** (`entitie:collector`) and **Collector Token** (`entitie:collector-token`) — the 40-char shared-secret bearer the collector presents to the platform. The statistics the profiler "pushes into the catalog" land on the platform via feature **F-095 Dataset-Field Statistics Ingestion**, whose entry point is `POST /ingestion/entities/datasets/stats` handled by code node `IngestionController.postDataSetStatsList` (`IngestionController.java:81`, confirmed via graph-node) → `DatasetFieldServiceImpl.updateStatistics`, which writes per-field stats as a JSONB blob into `dataset_field.stats` and is what surfaces on the dataset's Structure tab.

The page is clean on its own claims (the two-source-types limit, the explicit-`tables:` cost guard, the TensorFlow/M1 dependency caveats, and the "run a catalog collector first" ordering are all stated). The high-value drift is an **omission**: the page sends operators down the stats-push path with no mention that the receiving endpoint is unauthenticated and field-ODDRN-scoped with no parent-child check (`invariant:cross-dataset-stats-write-no-parent-child-consistency-check`; F-095 chain hops 1-3). That is a platform-side caveat the profiler page is the natural place to surface, since it is the page that tells operators the push happens. Both drift entries are DOC-GAP candidates for `doc-gaps.md`; the live page also resolves at a corrected slug (GitBook serves it at `/integrations/integrations/odd-collector-profiler`, doubling the `integrations` segment and dropping `collectors/` — the mechanical `live_url` guess 404s).

## Maintainer notes

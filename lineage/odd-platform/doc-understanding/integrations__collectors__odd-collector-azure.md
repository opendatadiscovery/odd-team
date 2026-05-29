---
doc_page: "docs/integrations/collectors/odd-collector-azure.md"
page_title: "odd-collector-azure"
live_url: "https://docs.opendatadiscovery.org/integrations/integrations/odd-collector-azure"
live_url_verified_status: "200"
live_url_resolved_slug: "integrations/integrations/odd-collector-azure"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts: []
  features: []
  code_nodes: []
audience: [operator]
doc_claim_vs_code: []
cross_repo: true
cross_repo_target: "odd-collectors"
maintainer_curated: false
---

# odd-collector-azure — doc understanding

This page is an operator-facing reference for the `odd-collector-azure` pull collector: a daemon container hosting one or more of four Azure adapters (`powerbi`, `azure_sql`, `blob_storage`, `azure_data_factory`), each with its config-field table, a minimal-config YAML, a multi-plugin example, a per-adapter feature matrix, and a known-limitations list. The implementing code is the Pydantic `PLUGIN_FACTORY` and the `*Plugin` models in `odd_collector_azure/domain/plugin.py` — all of which live in the **odd-collectors** repository, not in **odd-platform**.

No `DESCRIBES` bindings are emitted. The ontology under analysis is `odd-platform`; this page documents an `odd-collectors` adapter. `graph-search` against `odd-platform` returned honest-empty for all three target labels (Concept / Feature / CodeNode) for the page's discriminating terms (Azure collector, PowerBI, Blob Storage, Azure SQL, Data Factory, plugin, adapter). A sanity probe in the same session confirmed `graph-search` is functional for this repo (e.g. `odd-platform java IngestionController controller-method:ingestMetrics` at score 0.80, and Concept `entitie:data-entity-relationship` at 0.76), so the empty result is a true cross-repo absence, not a tool failure. The page's substrate home is the future `odd-collectors` ontology; binding it here would be a hallucinated edge (Rule 2).

No `doc_claim_vs_code` drift is recorded. Every runtime claim on the page (the four type literals, the `BlobPlugin.datasets`→`dataset_config` validator rejection, `AzureSQLPlugin` not inheriting `AzurePlugin`, `DataFactoryPlugin` reading credentials only via `DefaultAzureCredential` env vars) is a claim about `odd-collectors` code. Drift findings require citable code evidence (`node_id` + `file:line`) from the graph under analysis (Rule 3); the `odd-platform` graph holds no node for any of this code, so no contradiction is mechanically surfaceable here. These page-vs-code claims should be verified by the doc-analyser pass that runs against the `odd-collectors` ontology once that substrate exists.

Live-URL note (Rule 1): the mechanical guess `https://docs.opendatadiscovery.org/integrations/collectors/odd-collector-azure` 404s on the live GitBook site (the GitBook "page not found" template renders). GitBook serves the page from the `integrations` section root, repeating the section slug: the page resolves at `…/integrations/integrations/odd-collector-azure` (200). All 11 H2 sections render live, and the sampled `#known-limitations` anchor resolves with its first bullet ("Service-principal-only PowerBI auth.") matching the local markdown verbatim. The repo navigation (`docs/SUMMARY.md:68`) lists the page under the source path `integrations/collectors/odd-collector-azure.md`; the `collectors/` source subdirectory does not appear in the rendered slug. The same `/integrations/collectors/` prefix 404s for the sibling `odd-collector-aws` page, so the rewrite is section-wide, not page-specific.

## Maintainer notes

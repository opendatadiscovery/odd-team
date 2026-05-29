---
doc_page: "docs/integrations/collectors/odd-collector-gcp.md"
page_title: "odd-collector-gcp"
live_url: "https://docs.opendatadiscovery.org/integrations/integrations/odd-collector-gcp"
live_url_verified_status: "200"
live_url_resolved_slug: "integrations/integrations/odd-collector-gcp"
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
maintainer_curated: false
---

# odd-collector-gcp — doc understanding

This page is an **operator install/config reference for the `odd-collector-gcp` pull
collector** — the four GCP adapters (`bigquery_storage`, `bigtable`, `gcs`, `gcs_delta`),
their Pydantic config fields, Application-Default-Credentials auth, and the per-adapter
feature matrix. Its implementing code is `odd_collector_gcp/domain/plugin.py`
(`PLUGIN_FACTORY` and the per-adapter plugin models) in the **odd-collectors** repo, and
its reference YAML/`parameters` catalogue lives in the GCP collector README — both outside
the **odd-platform** graph this ontology is built over.

**Binding result: honest-empty (cross-repo).** No `DESCRIBES` edges were created.
`graph-search` against odd-platform returned **0 CodeNode** and **0 Feature** hits for the
GCP adapter terms (`bigquery_storage` / `gcs_delta` / GCP plugin factory) — the adapter
code is not enriched in this graph. The only Concept hits (`entitie:collector`,
`operation:register-data-source-from-collector-s2s`, `operation:ingest-data-entity-list-s2s`,
`entitie:s2s-ingestion-pipeline`) are vector-adjacent platform-side concepts about the
collector→platform **S2S protocol** (bearer-token auth, `/ingestion/*` registration);
reading them via `graph-node` confirmed the page does **not document** them — it only
*consumes* the `platform_host_url` + `token` fields in its minimal-config example. Per the
no-padding rule, none were bound.

**Drift: none citable from this repo.** Doc-claim-vs-code drift requires odd-platform
`node_id` + `file:line` evidence; the claims on this page are about odd-collectors code, so
no contradiction is mechanically surfaceable from the odd-platform graph. (The page's own
self-flagged caveats — e.g. the README `#googlecloudstoragedeltatables` anchor typo, the
`schema`→`scheme` alias — are doc-internal notes already on the page, not code drift.) The
correct home for verifying this page's runtime claims (the Gate-4 consumer-read of each
plugin field and the Gate-5 unset-parameter audit of the `GCSAdapterParams` knobs) is an
**odd-collectors** ontology, which does not yet exist → a `pillar-undocumented`-class signal
for `doc-gaps.md`: this published page has no code-side ground-truth coverage in any
current graph.

**Live verification note.** `LIVE_URL_GUESS`
(`.../integrations/collectors/odd-collector-gcp`) returns **HTTP 200** but redirects to the
authoritative GitBook slug `.../integrations/integrations/odd-collector-gcp` — GitBook
collapses the `collectors/` directory segment into its parent group slug, doubling
`integrations`. The same redirect holds for the sibling `odd-collector-aws` /
`odd-collector` pages. (A `WebFetch` of the guess reported 404 because it does not follow
that redirect; `curl -L` + a raw-HTML head check confirmed the resolved page renders the
real content — `<title> odd-collector-gcp | ODD Platform`, the GCP frontmatter description,
`bigquery_storage`×24, `gcs_delta`×20, ADC auth markers present.)

## Maintainer notes

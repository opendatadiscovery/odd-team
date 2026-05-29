---
doc_page: "docs/integrations/ingestion-filters.md"
page_title: "Ingestion filters"
live_url: "https://docs.opendatadiscovery.org/integrations/integrations/ingestion-filters"
live_url_verified_status: "200"
live_url_resolved_slug: "integrations/integrations/ingestion-filters"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts: []
  features: []
  code_nodes: []
audience: [operator]
doc_claim_vs_code:
  - "Page documents COLLECTOR-side functionality, not odd-platform. The regex include/exclude ingestion filters (schemas_filter / filename_filter / datasets_filter / pipeline_filter, configured in collector_config.yaml) are implemented in the odd-collectors repo. odd-platform has NO implementing code: graph-search --label CodeNode for the filter mechanism returns [] and a direct repo grep for `schemas_filter|filename_filter|datasets_filter|pipeline_filter` across odd-platform java/ts/yaml returns zero matches. No DESCRIBES edge into the odd-platform substrate is justified — evidence: (odd-platform repo) grep zero-match; graph CodeNode search empty."
  - "HOMONYM / naming-collision risk (high-value DOC-GAP candidate). odd-platform owns a Concept literally titled \"Ingestion Filter\" (entitie:ingestion-filter), but it is an unrelated mechanism: a token-based AUTHENTICATION WebFilter (`IngestionDataEntitiesFilter`, `@ConditionalOnProperty(\"auth.ingestion.filter.enabled\")`) gating `POST /ingestion/entities`. This page's \"ingestion filters\" are collector-side REGEX content filters. The two share the surface phrase and nothing else. Binding the page to entitie:ingestion-filter would be a false DESCRIBES edge — evidence: entitie:ingestion-filter / concepts/detail/entities/ingestion-filter.yaml:1 (\"Token-based authentication filter for /ingestion/** endpoints\")."
  - "Operator-conflation hazard the platform substrate already flags. The platform concept node records that main-concepts.md `Terms & Aliases` lists 'Ingestion authentication filter' as the canonical alias for the auth filter, and that \"operators conflate them\". This page claims the bare term \"Ingestion filters\" for the collector regex mechanism with no disambiguation pointer to the auth filter. A reader who lands here while debugging unauthenticated `/ingestion/entities` is on the wrong page — a cross-repo disambiguation note is warranted — evidence: entitie:ingestion-filter / concepts/detail/entities/ingestion-filter.yaml:1; entitie:s2s-ingestion-pipeline / concepts/detail/entities/s2s-ingestion-pipeline.yaml:1."
  - "Mechanical live_url guess is wrong (broken-if-used). doc-nodes.jsonl guesses live_url=https://docs.opendatadiscovery.org/integrations/ingestion-filters, which returns HTTP 404. GitBook serves the page under a doubled path segment: https://docs.opendatadiscovery.org/integrations/integrations/ingestion-filters (HTTP 200, H1 \"Ingestion filters\", sections \"Worked example\" and \"When filters apply\" present). The correct slug is recorded in live_url_resolved_slug. SUMMARY.md:77 references it as integrations/ingestion-filters.md — evidence: WebFetch 2026-05-29; documentation docs/SUMMARY.md:77."
maintainer_curated: false
---

# Ingestion filters — doc understanding

This page is a CROSS-REPO page that lives in the `documentation` repo but documents **odd-collectors** behaviour: per-plugin regex `include`/`exclude` rules in `collector_config.yaml` (`schemas_filter`, `filename_filter`, `datasets_filter`, `pipeline_filter`, …) that scope what a pull adapter ingests, with a worked PostgreSQL `schemas_filter` example and the "included AND not excluded" precedence rule. From the **odd-platform** ontology's point of view it binds to **nothing**: there is no platform code path for collector-side content filtering (CodeNode graph-search empty; direct odd-platform grep for the four filter keys zero-match), so `describes.code_nodes` is honestly empty rather than padded.

The trap this analysis exists to flag is the homonym: odd-platform DOES carry a Concept titled "Ingestion Filter" (`entitie:ingestion-filter`, confirmed via graph-node), but it is the token-based **authentication** `IngestionDataEntitiesFilter` for `/ingestion/**` (`auth.ingestion.filter.enabled`, default-off → bundled deployment ships `/ingestion/entities` unauthenticated). Same words, unrelated mechanism. The page must NOT be wired to that concept; doing so would assert that the collector regex filter and the S2S auth gate are the same feature. The platform concept node itself records that operators conflate the two — making a cross-repo disambiguation note on this page the high-value DOC-GAP follow-up, alongside the mechanical-live_url correction (guess 404s; real slug is the doubled `integrations/integrations/ingestion-filters`).

## Maintainer notes

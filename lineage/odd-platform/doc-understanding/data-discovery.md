---
doc_page: "docs/data-discovery.md"
page_title: "Data Discovery"
live_url: "https://docs.opendatadiscovery.org/features/data-discovery"
live_url_verified_status: "200"
live_url_resolved_slug: "features/data-discovery"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Directory"
    - "Search Catalog (faceted, session-as-server-state)"
    - "Bootstrap and orchestrate data-entity search session (Catalog page UI orchestrator role)"
    - "Search Session"
  features: []
  code_nodes: []
audience: [operator, data-consumer]
doc_claim_vs_code:
  - "Page leads its subsection list with the Catalog Overview page (the catalog's home page composing Search + Directory level-1 cards + Top tags + Domains + Entities report + Recommended quick-jumps + Owner-association request), but no enriched substrate concept models that home-page composition surface — closest graph hits are autocomplete/suggestion operations (operation:get-search-suggestions-top-five, entitie:data-entity-ref-autocomplete-suggestion), not the page assembly. Substrate-coverage gap (pillar-undocumented class), not a false page claim — evidence: graph-search 'catalog overview home page' returns no home-page-composition Concept node."
maintainer_curated: false
---

# Data Discovery — doc understanding

This is the **pillar landing / hub page** for the Data Discovery section: it frames the section as the catalog's "front door" for *locating* existing entities and enumerates the per-feature subsection pages (two discovery entry paths, the entity detail surface, the annotation features, specialty cataloguing, and freshness signals). It documents the *section taxonomy*, not a single runtime feature, so its bindings are the top-level concepts of the entry paths it surfaces rather than one `F-NNN`.

The two entry paths the page elevates map to confirmed substrate concepts: the **Directory** subsection ("four-level drill-down … backed by `/api/directory`") binds to `entitie:directory` (concepts/detail/entities/directory.yaml — four-level data-source-type → data-source → entity-type → entity navigation, read-only GET under `/api/directory`, ODDRN-prefix grouping). The **Search and Filtering** + **Catalog Overview** subsections bind to the search session machinery: `operation:search-catalog-faceted-session-as-server-state` (the `POST /api/search` faceted backend), `entitie:search-session` (the server-side `search_facets` UUID state), and `operation:bootstrap-and-orchestrate-data-entity-search-session` (the Catalog-page UI orchestrator, explicitly tagged "the Discovery pillar's Catalog page UI orchestrator role" / "P-01:F-002 Search and Filtering feature" in its sidecar). All four were confirmed via `graph-node`.

No `Feature` node maps to this hub page — the Discovery-pillar Feature nodes are owned per-subsection (Search, Directory, etc.), which is the correct homing for a landing page. The single drift finding is a **substrate-coverage gap**, not a false claim: the page's lead subsection (Catalog Overview / the home page) has no enriched concept modelling its composition surface; that page-assembly behaviour is not yet in the graph.

## Maintainer notes
<!-- preserved across re-analysis; the only block a human hand-edits -->

---
doc_page: "docs/data-glossary.md"
page_title: "Data Glossary"
live_url: "https://docs.opendatadiscovery.org/features/data-glossary"
live_url_verified_status: "200"
live_url_resolved_slug: "features/data-glossary"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Dictionary tab — Term catalog browse surface (UI shell for P-06 Data Glossary)"
    - "Term Linkage"
  features:
    - "F-024"
  code_nodes: []
audience: [operator, developer]
doc_claim_vs_code:
  - "Page claims 'the seven TERM_* RBAC permissions' — VERIFIED accurate: PolicyPermissionDto carries exactly seven TERM_*-prefixed constants (TERM_CREATE, TERM_UPDATE, TERM_DELETE, TERM_OWNERSHIP_CREATE, TERM_OWNERSHIP_UPDATE, TERM_OWNERSHIP_DELETE, TERM_TAGS_UPDATE). Evidence: odd-platform-api/.../dto/policy/PolicyPermissionDto.java:42-48. Note: two further term-relationship permissions (QUERY_EXAMPLE_TERM_CREATE/DELETE, lines 49-50) exist but are QUERY_EXAMPLE_*-prefixed, not TERM_*, so the literal 'seven TERM_*' count is correct. Not drift — recorded as a verified provenance anchor."
  - "Page says the Dictionary tab is 'the in-app surface for browsing and curating terms' (accurate at this altitude). The deeper drift — live business-glossary.md calling the Dictionary tab a 'catalog-wide list of all terms' while the code (TermSearch.tsx) lands the user on a search UI with an empty result set until a query is typed — belongs to the subpage docs/data-glossary/business-glossary.md, NOT this page. Evidence: entitie:dictionary-tab-term-catalog-browse-surface (name-vs-behaviour drift (b)). Flagged here only to route the finding to the correct page."
maintainer_curated: false
---

# Data Glossary — doc understanding

This is the top-level navigation/orientation page for the Data Glossary pillar (P-06). It delivers an operator a one-screen model of the in-app **Business Glossary** — operator-curated term entities, namespace-scoped, with ownership, RBAC, term-to-term linking, and term-to-data-entity descriptive associations — and then delegates every mechanic to the subpage `docs/data-glossary/business-glossary.md`. Its primary job is disambiguation (Business Glossary ≠ Main Concepts) and pillar placement (why Glossary is its own governance pillar), not API/behaviour reference.

The page's subject maps to the `Dictionary tab — Term catalog browse surface` concept (confirmed via graph-node: the operator entry point at `/termsearch/*`, wired in `ToolbarTabs.tsx`, backed by `TermController.termSearch`/`getTermSearchResults`), and the page's mention of "term-to-data-entity descriptive associations" maps to the `Term Linkage` concept (the `data_entity_to_term` edge, created via `POST /api/dataentities/{id}/terms` or the description-mention pipeline). The umbrella feature it orients the reader to is `F-024` (Term Search & Browse). The detailed term lifecycle/CRUD code (TermController create/update/delete, the `TERM_*` permission gates, the `[[ns:term]]` mention syntax F-056, the term detail tabs F-151..F-155) is documented on the subpage, not here — so `code_nodes` is intentionally empty rather than padded with controller methods this orientation page does not itself document.

Live verification: the guessed slug `features/data-glossary` resolves 200; the sampled anchor `why-this-is-a-separate-pillar`, the Business Glossary subsection link, and the Dictionary-tab mention are all present in the rendered page. The live render also carries a GitBook site-wide "Agent Instructions: Querying This Documentation" footer absent from the source markdown — this is an injected global footer, not page-content drift.

## Maintainer notes

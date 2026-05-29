---
doc_page: "docs/use-cases.md"
page_title: "Use cases"
live_url: "https://docs.opendatadiscovery.org/use-cases"
live_url_verified_status: "200"
live_url_resolved_slug: "use-cases"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts: ["Data Quality Engineer"]
  features: ["F-044"]
  code_nodes: []
audience: [operator, data-consumer]
doc_claim_vs_code:
  - "Page is a five-role narrative index; only the Data Quality Engineer role has a corresponding ontology audience concept (audience:data-quality-engineer). The other four roles named in the page (Data Scientist, Data Engineer/Analyst, Visualization Engineer, Service Provider/Pre-Sales) have NO audience concept in the substrate — graph-search Concept for each returns only weak cross-matches (top hit audience:data-quality-engineer at 0.69-0.73, then low-scoring invariants). Substrate-coverage signal, not code drift — evidence: concepts/detail/audiences/ contains data-quality-engineer.yaml but no data-scientist / data-engineer / visualization-engineer / service-provider audience node."
  - "GitBook slug-rewrite: this index page resolves at the single slug /use-cases (verified 200), but its five in-repo links (use-cases/dc-data-compliance.md, de-deprecation.md, dq-visibility.md, viz-preparation.md, service-presales.md) are served under the parent's slug as the DOUBLED path /use-cases/use-cases/{name} — verified live: https://docs.opendatadiscovery.org/use-cases/use-cases/dq-visibility returns 200 (H1 'Visibility for Data Quality Engineer'). Doc-internal navigation note (the in-repo relative links resolve correctly; the live canonical URL doubles the segment), not LSN-001/002-class code drift. Cross-confirmed by audience:data-quality-engineer.yaml which cites the same doubled slug for the dq-visibility page."
maintainer_curated: false
---

# Use cases — doc understanding

This page is a thin cross-role index: five level-3 sections (Data compliance for Data Scientists, Deprecation for Data Engineer/Analyst, Visibility for Data Quality Engineer, Data preparation for Visualization Engineer, Service Provider and Pre-Sales), each a one-to-two-sentence teaser linking out to a dedicated walkthrough sub-page under `use-cases/`. The page itself documents no feature in depth; it routes a reader by job role to the right walkthrough.

Two bindings are confirmable in the graph. The "Deprecation for Data Engineer/Analyst" section ("transparent deprecation process... manage risks of downstream failure") maps to **F-044** — the Data Entity Status Lifecycle (scheduled DRAFT/DEPRECATED → DELETED auto-flip + the 30-day soft-delete retention window), confirmed via graph-node (`feature-flows/detail/F-044.yaml`). The "Visibility for Data Quality Engineer" section is the teaser for the **Data Quality Engineer** audience concept, whose sidecar (`concepts/detail/audiences/data-quality-engineer.yaml`) records that role as "Named verbatim in the live .../use-cases/dq-visibility page" — the page this index links to. Both confirmed via graph-node.

`describes.code_nodes` is intentionally empty: a narrative index page binds concepts/features, not specific controller or config-key nodes. The DQ "import test suite results from libraries or custom frameworks" phrasing has no dedicated feature node (graph-search Feature for the import path returns `[]`); binding F-040/F-022 here would be padding the per-test-history and per-dataset-report read surfaces onto an index that only mentions importing-and-sharing in passing — that capability is the audience concept's domain, surfaced as a drift note rather than a forced feature edge.

## Maintainer notes

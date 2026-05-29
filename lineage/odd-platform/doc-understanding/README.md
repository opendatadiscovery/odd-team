---
doc_page: "docs/README.md"
page_title: "Overview"
live_url: "https://docs.opendatadiscovery.org/introduction"
live_url_verified_status: "200"
live_url_resolved_slug: "/introduction (307 -> / ; rel=canonical https://docs.opendatadiscovery.org ; <title> 'Overview | ODD Platform')"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Search Session"
    - "Traverse Lineage Graph (recursive-CTE)"
    - "Data Quality Test"
    - "Data Quality Dashboard (catalog-wide aggregate quality view)"
    - "Notifications"
  features: []
  code_nodes: []
audience: [operator, developer, data-consumer]
doc_claim_vs_code:
  - "Page claims ODD 'Auto-generated ML experiment lineage and metadata' as a top-line value prop, but odd-platform is the catalog/aggregator that only RENDERS ML entity types — it does not itself generate ML metadata (auto-generation is a collector-side capability, out of this repo). The platform-level claim IS grounded: DataEntityTypeDto declares ML_EXPERIMENT(6)/ML_MODEL_TRAINING(7)/ML_MODEL_INSTANCE(8)/ML_MODEL_ARTIFACT(10)/FEATURE_GROUP(3) and DataEntityClassDto maps them into DATA_ENTITY_GROUP/DATA_TRANSFORMER/DATA_CONSUMER — evidence: odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/dto/DataEntityTypeDto.java:20-24,17; odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/dto/DataEntityClassDto.java:43-50. Precision-only (low severity); the ML types are real, the 'auto-generated' verb belongs to the collector layer."
  - "The ML entity-class type system (ML_EXPERIMENT / ML_MODEL_* / FEATURE_GROUP / VECTOR_STORE) is a load-bearing platform capability with NO concept in concepts.yaml — ontology coverage gap, not a doc contradiction. No ML concept was bound here because none is confirmable in the graph; recording so doc-gap-finder can surface the missing concept. Evidence: graph-search Concept 'ML machine learning experiment metadata' returns only data-quality/lineage hits (top score 0.649); DataEntityTypeDto.java:20-24 is the unmodelled source of truth."
maintainer_curated: false
---

# Overview — doc understanding

This is the documentation manual's landing page (live root: `/introduction`, which 307-redirects to `/` with `rel=canonical https://docs.opendatadiscovery.org`). It is a non-code marketing/positioning page: it states ODD's five value props (free/OSS/community, ML-first, end-to-end microservices lineage, flexible data-quality integration, auto-generated ML experiment metadata), names three operator pain points (onboarding-to-data, data discovery, data observability), and hands off to the feature catalog and use-cases pages. A `graph-search --label CodeNode` for the page's themes returns nothing, confirming there is no single implementing class — correctly zero `code_nodes`.

The page's pain-point framing maps to confirmed ontology concepts (each read via `graph-node`): "Data discovery … search tool with AI-powered suggestion and flexible filters" → **Search Session** (`entitie:search-session` — POST /api/search creates a server-side faceted session UUID); "Data observability … lineage diagram" → **Traverse Lineage Graph (recursive-CTE)** (`operation:traverse-lineage-graph-recursive-cte`) and "flexible alert system" → **Notifications** (`entitie:notifications`); "Flexible data quality integration" → **Data Quality Test** (`entitie:data-quality-test`, ODD as aggregator) + **Data Quality Dashboard (catalog-wide aggregate quality view)** (`entitie:data-quality-dashboard`). No `F-NNN` is bound: the page links OUT to `Features.md` rather than documenting any single feature, so a feature binding would be padding (Rule 3).

Live navigation is clean: the page's two outbound cross-links resolve live — `Features.md` (`/features`, H1 "Features", 200) and `use-cases.md` (`/use-cases`, H1 "Use cases", 200) — and the three referenced GitBook images (`audience.png`, `alltogether.png`, `sdlc.png`) exist in `docs/.gitbook/img/`. The only drift is the precision note on "auto-generated ML experiment metadata" (platform renders ML entity types but does not auto-generate them — collector-side) and the related ontology coverage gap that the ML entity-class type system has no concept yet; both are recorded above with code evidence, neither is a hard contradiction.

## Maintainer notes
<!-- preserved across re-analysis; the only block a human hand-edits -->

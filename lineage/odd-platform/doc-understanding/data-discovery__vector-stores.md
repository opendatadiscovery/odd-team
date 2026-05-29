---
doc_page: "docs/data-discovery/vector-stores.md"
page_title: "Vector Store metadata"
live_url: "https://docs.opendatadiscovery.org/features/data-discovery/vector-stores"
live_url_verified_status: "200"
live_url_resolved_slug: "features/data-discovery/vector-stores"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: MEDIUM
describes:
  concepts: []
  features: []
  code_nodes: []
audience: [operator, developer]
doc_claim_vs_code:
  - "Page claims Vector Stores show 'a Vector-Store icon distinct from regular Datasets'. Code: the entity badge is class-driven, not type-driven — EntityClassItem renders DataEntityClassLabelMap.get(entityClassName) keyed by DataEntityClassNameEnum (odd-platform-ui/src/components/shared/elements/EntityClassItem/EntityClassItem.tsx:13-28). VECTOR_STORE is a TYPE under the DATA_SET class (DataEntityClassDto.java:43), so it carries the same DATA_SET badge as a relational table. No per-TYPE icon dictionary exists; constants.ts only maps the type to a TEXT label 'Vector store' (odd-platform-ui/src/lib/constants.ts:126). The distinction surfaces as the type label + the Type facet value, NOT a distinct icon. Evidence: EntityClassItem.tsx:13-28, constants.ts:126, DataEntityClassDto.java:43."
  - "Page (Adapter coverage) claims the PostgreSQL odd-collector adapter classifies a pgvector table as Vector Store during ingestion. This is a COLLECTOR-side behaviour (odd-collectors repo); that repo is not present in this workspace, so the claim is NOT VERIFIED here. Platform-side the ingress accepts whatever type the adapter declares — VECTOR_STORE is an accepted DataEntityTypeDto literal (DataEntityTypeDto.java:35) and an accepted spec enum value (odd-platform-specification/components.yaml:794). The pgvector-recognition logic itself lives upstream and is out of scope for odd-platform graph confirmation."
maintainer_curated: false
---

# Vector Store metadata — doc understanding

This page tells an operator that ODD treats vector data as a first-class catalog citizen via two spec-level additions: a `Vector Store` **dataset type** and a `Vector` **column data type**. Both are confirmed in odd-platform: the dataset type is `DataEntityTypeDto.VECTOR_STORE(23)` enrolled in the `DATA_SET` class (`DataEntityClassDto.java:43`) and declared in the platform's bundled spec (`odd-platform-specification/components.yaml:794`), with the UI label "Vector store" (`constants.ts:126`); the column type is `TYPE_VECTOR` in the `DataSetFieldType` enum (`components.yaml:1812`), rendered on the Structure tab as the short label "Vec" (`datasetStructure.ts:42`) with a dedicated palette colour (`palette.ts:238`). The "surfaces on the Type facet" claim is backed by `FacetType.TYPES` (`FacetType.java:5`) plus the `MultipleFacetType.types` schema (`components.yaml:1417`).

`describes` is intentionally empty: the substrate has no enriched Concept / Feature / CodeNode for the dataset-type enum (`DataEntityTypeDto`) or the column-data-type enum (`DataSetFieldType`). Every `graph-search` hit for "vector" resolves to unrelated near-misses (FTS `tsvector` search-vector concepts, lineage/DoS "enumeration vector" prose), and the CodeNode searches for the type/field-type enums returned empty — the platform CodeNode layer is currently controller/OpenAPI-tag-centric and does not carry these DTO enums as nodes. Binding to any of those hits would be a fabricated edge, so they are omitted (empty-but-honest per Rule 3). This absence is itself a doc-gap signal: the feature is fully documented and fully present in code, but unrepresented in the ontology — a candidate for substrate enrichment (`DataEntityTypeDto`, `DataEntityClassDto`, `DataSetFieldType`) so future doc↔code traversal can resolve.

The one operator-facing drift worth triaging is the **icon claim**: the page implies a visually distinct Vector-Store icon, but the badge system is keyed by entity *class*, so a Vector Store is visually identical to a relational dataset (both DATA_SET). The real differentiators are the type label and the Type-facet filter. A maintainer should either soften the page ("a distinct **type label** and Type-facet value") or, if a per-type icon is desired, file it as a UI feature request.

## Maintainer notes

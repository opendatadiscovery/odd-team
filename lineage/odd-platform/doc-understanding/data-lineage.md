---
doc_page: "docs/data-lineage.md"
page_title: "Data Lineage"
live_url: "https://docs.opendatadiscovery.org/features/data-lineage"
live_url_verified_status: "200"
live_url_resolved_slug: "features/data-lineage"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Lineage Graph Traversal"
    - "Expand lineage from owner anchor (non-owned-but-reachable subgraph)"
    - "List My Owned Data Entities"
    - "Get data entity group lineage (flat graph per DEG member, inner DEGs suppressed)"
  features:
    - "F-015"
  code_nodes:
    - "odd-platform java DataEntityController controller-method:getMyObjects"
    - "odd-platform java DataEntityController controller-method:getMyObjectsWithUpstream"
    - "odd-platform java DataEntityController controller-method:getMyObjectsWithDownstream"
    - "odd-platform java DataEntityController controller-method:getDataEntityUpstreamLineage"
    - "odd-platform java DataEntityController controller-method:getDataEntityDownstreamLineage"
audience: [operator, developer]
doc_claim_vs_code:
  - "Page is CORRECT and ahead of the spec on the my-objects triplet. The danger-hint claims the OpenAPI summary for getMyObjectsWithUpstream / getMyObjectsWithDownstream describes the wrong shape (response is the NON-owned lineage-adjacent set, not 'owned with upstream'). Code confirms the page, not the spec: the anchor set is excluded via `filter(Predicate.not(oddrns::contains))` at DataEntityRelationsServiceImpl.java:37, making the response semantically non-owned; the OpenAPI summary at openapi.yaml:843-844 reads 'data entities owned by current user with upstream dependencies' — literally inverse. This is a live SPEC bug the doc has already documented (already tracked as DOC-GAP-099, 4-angle triangulated); the page text is the mitigation. Evidence: F-015; operation:expand-lineage-from-owner-anchor; node `getMyObjectsWithUpstream` (DataEntityController.java:299)."
  - "Page's owner-scoping caveat matches code exactly. The warning-hint states owner-scoping is enforced at exactly one site (the anchor fetch) with no defence-in-depth in the lineage projection. Code: the triplet resolves the owner once via authIdentityProvider.fetchAssociatedOwner() (DataEntityRelationsServiceImpl.java:26) then the final projection listByOddrns is a pure `WHERE DATA_ENTITY.ODDRN.in(...)` scan with NO ownership JOIN (DataEntityServiceImpl.java:223 → ReactiveDataEntityRepositoryImpl.java:228-253); the base /my path DOES JOIN OWNERSHIP WHERE OWNER_ID=? (ReactiveDataEntityRepositoryImpl.java:515-534). Single-point-of-failure confirmed (REFACTOR-225 PRIMARY-SOURCE). No drift — alignment."
  - "Page's UI-vs-API depth contract matches code. The page (via the data-objects sub-page link) states the 1-20 depth dropdown is a UI choice and the API accepts any positive integer with no upper bound. Code: DataEntityApi.java:918 enforces `@Min(1)` only, no `@Max`; the depth flows straight into the recursive-CTE termination `tDepth.lessThan(lineageDepth.getDepth())` at ReactiveLineageRepositoryImpl.java:174. No drift — alignment."
  - "Page's read-collaborative posture matches code. 'Read posture across the catalog' states any authenticated user can read any catalogued entity's upstream/downstream graph; the lineage repository applies no ownership-side filter on the read path; the group-lineage endpoint exposes the full child-set. Code: getDataEntityDownstreamLineage / getDataEntityUpstreamLineage carry no @PreAuthorize and owner_scoping=BYPASSES — the lineage table has no owner column and LineageServiceImpl performs no per-row owner check (LineageServiceImpl.java:87-122 + ReactiveLineageRepositoryImpl.java:122-176, filter is IS_DELETED.isFalse() only). DEG group lineage is the widest sink (DOC-GAP-159; LineageServiceImpl has no AuthIdentityProvider field at all). The page now documents this posture explicitly — it closes the gap DOC-GAP-159/DOC-GAP-115 flagged as 'live page silent on owner-scoping'. No drift — alignment."
  - "Residual page-vs-code omission (LOW; out-of-page scope). This overview page does not surface two operator-critical hazards of the per-entity lineage API it routes to: the null-`lineage_depth` NPE (spec marks it optional + service requires primitive int → 500 on omission; the API-reference's 'unset returns the default depth' is UNIMPLEMENTED) and the no-depth-cap DoS-amplification vector. Both are confirmed at DataEntityController.java:256-262 + LineageService.java:11-14 + LineageServiceImpl.java:89 (NPE) and DataEntityApi.java:918 + ReactiveLineageRepositoryImpl.java:122-176 (no @Max). These belong on data-lineage/data-objects.md and developer-guides/api-reference/lineage.md, not this hub overview; recorded here only as a routing note, not as a finding against this page."
maintainer_curated: false
---

# Data Lineage — doc understanding

This is the pillar-landing page for ODD Platform's lineage surfaces. It frames
Data Lineage as a first-class governance pillar (the cross-pillar connection
graph), routes to two sub-pages (data-objects lineage and microservices
lineage), and — unusually for a landing page — itself documents three
operator-critical architectural caveats on the **my-objects triplet**
(`/api/dataentities/my`, `/my/upstream`, `/my/downstream`). Those caveats bind
directly to feature **F-015** ("My-Objects Anchor-Set Reads") and to concept
`Expand lineage from owner anchor (non-owned-but-reachable subgraph)`, both
confirmed via graph-node: the response is the NON-owned lineage-adjacent set
(anchor excluded at `DataEntityRelationsServiceImpl.java:37`), owner-scoping is a
single-point-of-failure at the anchor fetch (`...java:26`), and the owned-set
fan-out drives an unbounded `IN (...)` clause with no pagination on the anchor.

The base `/my` endpoint the page contrasts against is concept
`List My Owned Data Entities` (JOIN OWNERSHIP defended). The per-entity Lineage
tab and `/api/dataentity/{id}/lineage` the page opens with bind to concept
`Lineage Graph Traversal` (`getDataEntityUpstreamLineage` /
`getDataEntityDownstreamLineage`, `DataEntityController.java:255-273`); the Group
lineage entry point binds to concept
`Get data entity group lineage (flat graph per DEG member)`. Microservices
lineage is only a pointer here (one sentence routing to the child page); its code
bindings live on `data-lineage/microservices.md`, so this page is not padded with
microservice code nodes.

This page is notably accurate and ahead of its own spec: the danger-hint
correctly documents the OpenAPI inverse-semantic bug (DOC-GAP-099) as a live
mitigation, and the "Read posture across the catalog" section now states the
read-collaborative / no-owner-filter posture that DOC-GAP-159 / DOC-GAP-115
flagged as missing from the live page. Every binding claim above cites a node
confirmed via graph-node. No drift is charged against the page; the only residual
is two per-entity-lineage hazards (null-depth NPE, no depth cap) that belong on
the sub-page and api-reference, not this hub.

## Maintainer notes
- `code_nodes` lists the five DataEntityController methods this page makes
  operator-facing claims about. The microservices-lineage code surface
  (odd-tracing-gateway ingest + the microservices canvas) is intentionally
  omitted — this page only routes to it; it is the child page's binding.
- All four `concepts` are confirmed graph nodes but `canonical_in_docs: false`
  for "Lineage Graph Traversal" (concepts.yaml line 2367) — the main-concepts
  vocabulary names "Data Lineage" as a pillar but not the API-surface concepts.
  Bound here by their confirmed concept-catalog `name:` fields.
- The three `{% hint %}` blocks on this page (danger + 2× warning + info on the
  triplet) are the doc-side realisation of F-015's drift cluster and DOC-GAP-099.
  If F-015 / DOC-GAP-099 are ever re-scoped, re-verify these hints still match.

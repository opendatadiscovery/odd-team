---
doc_page: "docs/developer-guides/api-reference/relationships.md"
page_title: "Relationships"
live_url: "https://docs.opendatadiscovery.org/developer-guides/api-reference/relationships"
live_url_verified_status: "200"
live_url_resolved_slug: "developer-guides/api-reference/relationships"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Get Data Entity Relationships List (paged ERD + GRAPH)"
    - "Get ERD or Graph Relationship By Id (detail endpoints)"
    - "Data Entity Relationship (ERD + Graph variants)"
  features:
    - "F-037"
  code_nodes:
    - "odd-platform java org.opendatadiscovery.oddplatform.controller controller:RelationshipController"
    - "odd-platform java RelationshipController controller-method:getRelationships"
    - "odd-platform java RelationshipController controller-method:getERDRelationshipById"
    - "odd-platform java RelationshipController controller-method:getGraphRelationshipById"
audience: [developer]
doc_claim_vs_code:
  - "Page's detail-endpoint rows present GET /api/relationships/erd/{relationship_id} and /graph/{relationship_id} with the path parameter named relationship_id and the operation IDs getERDRelationshipById / getGraphRelationshipById, with NO caveat that the parameter is NOT the relationships-table PK. Code translates it silently to data_entity.id: the SQL filters relationshipsDataEntity.field(DATA_ENTITY.ID).eq(relationshipId) (ReactiveRelationshipsRepositoryImpl.java:194), and the list mapper surfaces id = data_entity.id (RelationshipMapper.java:53), so a third-party API consumer reading this reference literally and supplying an actual relationships.id gets HTTP 404 (NotFoundException at RelationshipsServiceImpl.java:40-47). Category-F TRANSLATES_SILENTLY drift; LSN-002-class missing caveat for a developer-facing API page. Evidence: invariant:relationship-id-name-vs-data-entity-id-translates-silently; operation:get-erd-or-graph-relationship-by-id; RelationshipController.java:29-43; pinned by P-128."
  - "Page presents GET /api/relationships (getRelationships) as a plain paginated list with type filter + free-text query, with NO caveat that it applies NONE of the catalog-visibility predicates the sibling /api/dataentities applies. ReactiveDataEntityRelationshipRepositoryImpl.java:66-72 (list) selects only by entity_class_ids=[9] and an optional external_name match — no EXCLUDE_FROM_SEARCH, no HOLLOW=false, no STATUS!=DELETED, no OWNERSHIP join, no data_source/cross-tenant filter. Consequence: relationships whose data_entity is exclude_from_search=true, HOLLOW, soft-DELETED, or owned by another tenant ARE returned — states operators believe are hidden. Asymmetric to /api/dataentities (EXCLUDE_FROM_SEARCH per REFACTOR-425). The page does not flag the asymmetry. Evidence: invariant:relationships-no-exclude-from-search-asymmetry-vs-dataentities; operation:get-data-entity-relationships-list."
  - "Page's free-text query=... is documented only as a 'free-text query' with no scope note; code matches case-insensitive containment on the RELATIONSHIP-row external_name ONLY, not on source/target entity names (operation:get-data-entity-relationships-list, SEARCH SEMANTIC). Minor caveat — the in-product UI placeholder 'Search relationships' is aligned with this, but an API consumer expecting entity-name search is not warned. Evidence: operation:get-data-entity-relationships-list."
maintainer_curated: false
---

# Relationships — doc understanding

This developer-guide page is the HTTP API reference for the ERD/Graph relationships surface — three endpoints on `RelationshipController`: a paginated list (`getRelationships`, `GET /api/relationships`) and two per-type detail endpoints (`getERDRelationshipById` / `getGraphRelationshipById`, `GET /api/relationships/erd|graph/{relationship_id}`). All three bindings are confirmed via graph-node: the controller resolves to `RelationshipController.java:19` (`getRelationships`, operation_id `getRelationships`) and its two sibling detail methods. The page is the API-reference face of feature **F-037** (ERD/Graph Relationships Listing, the first feature anchored on pillar P-02 Data Modelling), and it documents the operation concepts *Get Data Entity Relationships List* and *Get ERD or Graph Relationship By Id* plus the entity concept *Data Entity Relationship (ERD + Graph variants)*. The page correctly defers the cardinality model, ERD-vs-graph distinction, and per-adapter ingestion coverage to `data-modelling/relationships.md` via a clean cross-link — content-homing is sound.

The page is accurate on what it states (paths, operation IDs, return types, the type filter values, the cross-link target). Its gaps are by omission, and both feed `doc-gaps.md` as DOC-GAP candidates. The highest-value finding is the Category-F silent ID translation on the two detail endpoints: the `{relationship_id}` path parameter is the relationships-class `data_entity.id`, not the `relationships` PK, so a third-party consumer who reads this reference literally and supplies a real `relationships.id` gets a 404 (UI round-trip stays self-consistent because the list mapper also surfaces `data_entity.id`, masking the drift from in-product clients). The second is the visibility asymmetry: unlike `/api/dataentities`, the list endpoint applies no `EXCLUDE_FROM_SEARCH` / `HOLLOW` / soft-delete / ownership / cross-tenant predicate, so it returns relationships operators believe are hidden — an enumeration surface this developer page does not flag. The three relationship concepts are confirmed graph nodes (`concepts/detail/...`) but are batch-ZE and not yet folded into `concepts.yaml` (catalog v8); the concept-merger should pick them up on its next refresh.

## Maintainer notes

---
doc_page: "docs/data-modelling/relationships.md"
page_title: "Relationships"
live_url: "https://docs.opendatadiscovery.org/features/data-modelling/relationships"
live_url_verified_status: "200"
live_url_resolved_slug: "features/data-modelling/relationships"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "entitie:data-entity-relationship"
    - "operation:get-data-entity-relationships-list"
    - "operation:get-erd-or-graph-relationship-by-id"
    - "invariant:relationship-id-name-vs-data-entity-id-translates-silently"
    - "invariant:relationships-no-exclude-from-search-asymmetry-vs-dataentities"
    - "invariant:data-modelling-erd-is-sub-tab-not-peer-of-relationships"
  features: []
  code_nodes:
    - "odd-platform java RelationshipController controller-method:getRelationships"
    - "odd-platform java RelationshipController controller-method:getERDRelationshipById"
    - "odd-platform java RelationshipController controller-method:getGraphRelationshipById"
    - "odd-platform ts components/DataModelling react-component:Relationships"
    - "odd-platform ts components/DataModelling/Relationships react-component:RelationshipsListItem"
    - "odd-platform ts routes route:relationships"
audience: [operator, developer]
doc_claim_vs_code:
  - "ACCURATE (doc correct, code buggy): the page's caveat #1 — 'the Target column shows the SOURCE entity on every row' — matches the code. The Target cell at RelationshipsListItem.tsx:73-81 binds item.sourceDataEntity.id / .internalName / .oddrn, identical to the Source cell at lines 64-72; item.targetDataEntity is never read in the list row (it IS read correctly by sibling detail components EntityRelationship.tsx:33-35 and GraphRelationship.tsx:32-34). Evidence: odd-platform ts components/DataModelling/Relationships react-component:RelationshipsListItem / RelationshipsListItem.tsx:64-81. Severity HIGH; pinned by P-167 Block D. The doc page is correct and ahead of the code; the open item is the UI fix, not a doc fix."
  - "ACCURATE (doc correct): the page's caveat #2 — 'no RBAC gate; any authenticated caller lists every relationship' — matches the code. UI route DataModellingRoutes.tsx:40 mounts <Relationships /> bare with no WithPermissionsProvider (contrast Query Examples siblings at lines 19-25, 31-37); RelationshipController has no @PreAuthorize / SECURITY_RULES match; the list SQL applies no ownership / namespace / data_source / exclude_from_search / hollow / deleted predicate (ReactiveDataEntityRelationshipRepositoryImpl.java:66-72 list, :152-208 detail). Evidence: odd-platform ts routes route:relationships + invariant:relationships-no-exclude-from-search-asymmetry-vs-dataentities. The asymmetry vs /api/dataentities (which DOES apply EXCLUDE_FROM_SEARCH per REFACTOR-425) was flagged 'undocumented in relationships.md' on the operation:get-data-entity-relationships-list node — the live page now documents it (danger hint), so that prior gap is closed."
  - "ACCURATE (doc correct): the page's caveat #3 — 'clicking a row opens the entity-detail page, not a relationship-type-specific URL' — matches the code. The row Name link wraps item.name in <Link to={dataEntityDetailsPath(item.id)}> (RelationshipsListItem.tsx:52); there is no list-row link to /api/relationships/erd|graph/{id}. Evidence: odd-platform ts components/DataModelling/Relationships react-component:RelationshipsListItem / RelationshipsListItem.tsx:52."
  - "ACCURATE (doc correct): the page's caveat #4 — 'search filters by relationship name only, not source/target entity name' — matches the code. RelationshipsSearchInput.tsx:8-12 writes only the ?q param; Relationships.tsx:18 reads ?q and passes it as `query`; the backend matches case-insensitive containment on the relationship row's external_name only (operation:get-data-entity-relationships-list, 'NOT on source/target entity names'). Evidence: odd-platform ts routes route:relationships + RelationshipsSearchInput.tsx:8-12 + Relationships.tsx:18."
  - "ACCURATE (doc correct, UI half): the page's caveat #5 — '?type= accepts arbitrary strings; UI reads it verbatim with no validation, renders a blank tab' — matches the UI code. Relationships.tsx:19 reads `searchParams.get('type') ?? RelationshipsType.ALL` and casts to RelationshipsType with no runtime guard; omitting ?type defaults to ALL. Evidence: odd-platform ts components/DataModelling react-component:Relationships / Relationships.tsx:19. (The page's backend-400-from-enum-binding half is the standard Spring enum-deserialization behaviour for the ERD|GRAPH|ALL filter — confirmed as the only accepted token set on operation:get-data-entity-relationships-list — and was not independently re-fetched; UI-side claim is verified.)"
  - "ACCURATE (doc correct): the page's caveat #6 — 'relationship_id path param is the relationship's data-entity id, not the relationships-table PK' — matches the code. The detail SQL at ReactiveRelationshipsRepositoryImpl.java:194 filters by DATA_ENTITY.ID.eq(relationshipId); the list mapper surfaces id = data_entity id (RelationshipMapper.java:53), so the UI round-trip is self-consistent and a literal-spec consumer supplying relationships.id gets a 404. Evidence: invariant:relationship-id-name-vs-data-entity-id-translates-silently + operation:get-erd-or-graph-relationship-by-id (pinned by P-128)."
  - "NO DRIFT (scope note, not a finding): the ERD cardinality classifiers (ONE_TO_EXACTLY_ONE / ONE_TO_ZERO_OR_ONE / ONE_TO_ONE_OR_MORE / ONE_TO_ZERO_ONE_OR_MORE) and the adapter-coverage matrix (postgresql + snowflake only) are an upstream odd-collectors vocabulary; the page correctly attributes both to the odd-collectors repo. They are not enforced in odd-platform code, so there is no odd-platform claim to verify here — out of scope for this repo's drift check, not a gap."
maintainer_curated: false
---

# Relationships — doc understanding

This page documents ODD Platform's relationship catalog surface — the Data Modelling -> Relationships list page (`/data-modelling/relationships`), the per-entity Relationships tab, and the three `/api/relationships` endpoints — covering the two relationship classes (ERD = `ENTITY_RELATIONSHIP(25)`, GRAPH = `GRAPH_RELATIONSHIP(26)`), the ERD cardinality model, the UI walkthrough, and six operator caveats. The canonical concept is `entitie:data-entity-relationship` (the relationship is a data-entity row carrying `entity_class_ids` 9 = `DATA_RELATIONSHIP`, backed by the `relationships` / `erd_relationship_details` / `graph_relationship` tables). The list + detail behaviour maps to `operation:get-data-entity-relationships-list` and `operation:get-erd-or-graph-relationship-by-id`; the UI maps to `route:relationships`, the `Relationships` component, and the `RelationshipsListItem` row renderer (all confirmed via graph-node).

The page is unusually high-fidelity: every one of its six "Known operator caveats" is confirmed against code, including the three it flags as code-side defects. The Target-column-shows-Source defect (caveat #1) is statically visible at `RelationshipsListItem.tsx:73-81` (both Source and Target cells bind `item.sourceDataEntity`) — the doc is correct and ahead of the code; the open work is the UI fix (P-167 Block D), not a doc change. The zero-RBAC posture (caveat #2) is confirmed at the route layer (bare mount, no `WithPermissionsProvider`, `DataModellingRoutes.tsx:40`), the controller layer (no `@PreAuthorize` / SECURITY_RULES match), and the SQL layer (`invariant:relationships-no-exclude-from-search-asymmetry-vs-dataentities` — no ownership/namespace/data_source/exclude_from_search/hollow/deleted predicate), and is the LSN-002-class security caveat this layer exists to surface. The `relationship_id`-is-the-data-entity-id drift (caveat #6) is the canonical `invariant:relationship-id-name-vs-data-entity-id-translates-silently` (pinned by P-128). No material doc-claim-vs-code drift was found in the odd-platform direction; the cardinality vocabulary and adapter matrix are correctly attributed upstream to odd-collectors and are out of scope for this repo.

The relationship concepts and operations were added to the graph in a later enrichment batch (ZE) than the last `concepts.yaml` refresh (catalog v8, generated 2026-05-18 from 50 sidecars), so `describes.concepts` binds by the confirmed verbatim graph `node_id`s rather than a `concepts.yaml` canonical name; each was read via graph-node before binding. No `F-NNN` feature flow has been composed for the Relationships surface yet (`feature-flows/detail/` is empty), so `describes.features` is honestly empty rather than padded.

## Maintainer notes

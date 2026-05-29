---
doc_page: "docs/developer-guides/api-reference/lineage.md"
page_title: "Lineage"
live_url: "https://docs.opendatadiscovery.org/developer-guides/api-reference/lineage"
live_url_verified_status: "200"
live_url_resolved_slug: "developer-guides/api-reference/lineage"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Traverse Lineage Graph (recursive-CTE)"
    - "Get lineage (recursive-CTE walk with depth-1 expansion fan-out)"
    - "Get data entity group lineage (flat graph per DEG member, inner DEGs suppressed)"
  features:
    - "F-005"
    - "F-016"
    - "F-054"
  code_nodes:
    - "odd-platform java DataEntityController controller-method:getDataEntityUpstreamLineage"
    - "odd-platform java DataEntityController controller-method:getDataEntityDownstreamLineage"
    - "odd-platform java DataEntityController controller-method:getDataEntityGroupsLineage"
  audience: [developer, operator]
doc_claim_vs_code:
  - "HIGH (LSN-002 missing-caveat). Page says of lineage_depth: \"The 'Unset returns the platform's default depth' behaviour is undefined today — pass an explicit value when calling the API directly.\" Code makes unset OPERATOR-CRITICAL, not merely undefined: the controller passes a boxed Integer (DataEntityController.java:257) while LineageServiceImpl.getLineage takes a primitive int — autoboxing of a null lineage_depth throws NullPointerException BEFORE the service body runs, surfacing as HTTP 500. OpenAPI declares the param required:false, so a spec-compliant caller that omits it gets a 500, not a default-depth graph. The page should state unset → NPE → 500 explicitly. Evidence: F-005 (primary_drift_class spec_says_X_impl_does_Y) / operation:get-lineage-recursive-cte-with-depth-1-expansion (bug (a)) / DataEntityController.java:257 + LineageServiceImpl.java:87-122."
  - "CONFIRMED-ACCURATE (not drift): the page's lineage_depth claim 'integer (minimum 1, no maximum); controller validates @Min(1) but has no @Max, the service tier hands the value through unchanged, and the repository tier consumes it directly as the recursive-CTE termination predicate' matches code. operation:traverse-lineage-graph-recursive-cte confirms @Min(1) no @Max, three-line service delegation, and tDepth < lineageDepth as the SOLE termination predicate in ReactiveLineageRepositoryImpl.lineageCte lines 150-176. No defensive clamp exists (operation:get-lineage-recursive-cte-with-depth-1-expansion bug (b)), so the page's 'very large values trigger correspondingly expensive recursive walks' is also accurate. Recorded so a future audit does not re-flag a correct claim."
  - "CONFIRMED-ACCURATE (not drift): the page's warning hint 'Empty Data Entity Group → HTTP 404 ... Two distinct conditions produce identical 404s' is correct AND code surfaces a THIRD conflated condition the hint does not name. LineageServiceImpl.java:62 raises NotFoundException(\"Data entity group\", id) via .switchIfEmpty(...) on an empty member-resolution Flux; per F-016 (drift (3)) and operation:get-data-entity-group-lineage-flat-graph (gap (d)) the same 404 fires for (a) DEG-not-found, (b) DEG-exists-but-zero-members, AND (c) the path id is a non-DEG data entity (the group_entity_relations CTE returns empty). The page documents (a)+(b); (c) is an additional uncovered conflation a doc-gap follow-up could add."
  - "Omission (read-collaborative posture). The page documents all three endpoints' routes/params but OMITS that none carry an RBAC gate and all are anonymously reachable under auth.type=DISABLED. The two per-entity endpoints have NO SecurityConstants.SECURITY_RULES entry and fall through to .authenticated() (operation:traverse-lineage-graph-recursive-cte). The group endpoint is STRICTLY WIDER blast radius: per F-016 (drift (1)) enumerating DEG IDs walks the cross-owner co-membership graph of the whole catalogue, with no fetchAssociatedOwner() call (LineageServiceImpl.java:54-57 has no AuthIdentityProvider field). LSN-001/002-class operator-impact gap, same as the DISABLED-bypass META in doc-gaps.md."
  - "Omission (inner-DEG suppression carve-out). The page's group-lineage description ('lineage relationships among the entities that belong to the given group') does not disclose that edges touching a nested DEG are silently dropped: LineageServiceImpl.java:71-75 filters out edges where either endpoint is a DEG and removes DEG-typed metadata, behind the source comment '// Remove this when we will support inner DEGs for DEG lineage' (F-016 drift (2) / operation:get-data-entity-group-lineage-flat-graph step (3)). A caller against a DEG containing nested DEGs sees the nested DEGs missing with no signal. The page should add this caveat to the group-lineage section."
  - "Coverage gap (adjacent, not on-page). The page documents only the three non-/my lineage endpoints; it does NOT document the owner-scoped variants GET /api/dataentities/my/upstream and /my/downstream where DOC-GAP-099 lives — the OpenAPI summary on getMyObjectsWithUpstream/Downstream describes the INVERSE semantic (claims 'owned with lineage'; actual response is NON-owned entities reachable one hop from the owned set, Predicate.not(oddrns::contains) at DataEntityRelationsServiceImpl.java:37). Not a drift in THIS page, but the lineage API-reference is the natural home to document the /my variants; cross-reference doc-gaps.md:754-763."
maintainer_curated: false
---

# Lineage — doc understanding

This developer-guide page is the HTTP API reference for the platform's three lineage read endpoints, all confirmed via graph-node to live on `DataEntityController`: `getDataEntityUpstreamLineage` and `getDataEntityDownstreamLineage` (the per-entity graph reads, mapping to concepts *Traverse Lineage Graph (recursive-CTE)* and *Get lineage (recursive-CTE walk with depth-1 expansion fan-out)* and to feature **F-005** — "Downstream lineage traversal — default depth handling", whose entry point is exactly `GET /api/dataentities/{id}/lineage/downstream`), and `getDataEntityGroupsLineage` (the group read, mapping to concept *Get data entity group lineage (flat graph per DEG member, inner DEGs suppressed)* and to feature **F-016** — "DEG-Anchored Lineage", whose entry point is exactly `GET /api/dataentitygroups/{id}/lineage`). The page's framing that data-object and microservices lineage are "backed by the same three endpoints ... entity-class participation is determined by what the data sources have ingested, not by a separate API" aligns with feature **F-054** (microservices lineage rendered by the class-agnostic dataset-lineage path). The page is unusually rigorous on the surface it covers — its `lineage_depth` `@Min(1)`/no-`@Max` walk-through and its empty-DEG-404 hint are both confirmed accurate against primary-source code.

The one true drift is by understatement, not error: the page softens the unset-`lineage_depth` behaviour to "undefined today — pass an explicit value," but the realised behaviour is operator-critical — an unset (null) `lineage_depth` against the per-entity endpoints autoboxes a null `Integer` into the service's primitive `int` and throws `NullPointerException` → HTTP 500 (F-005 / `DataEntityController.java:257` / `LineageServiceImpl.java:87-122`). The page should state that explicitly (unset → NPE → 500), since the OpenAPI spec advertises the parameter as optional. The remaining findings are omissions the code makes operator-relevant: the cross-owner/co-membership read posture (no RBAC gate, anonymous under `auth.type=DISABLED`, group endpoint blast-radius strictly wider than per-entity), the undocumented inner-DEG suppression carve-out on group lineage, and the third 404-conflation case (non-DEG id) the warning hint does not name. The owner-scoped `/my/upstream` + `/my/downstream` variants (home of DOC-GAP-099's inverse-semantic drift) are not documented on this page at all — an adjacent coverage gap.

## Maintainer notes

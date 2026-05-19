## ADR-CANDIDATE-119 — DEG-lineage view is INNER-DEG-FREE by deliberate carve-out, comment-marked as a deferred feature (`// Remove this when we will support inner DEGs for DEG lineage`) — the response shape is a flat graph of non-DEG members, NOT a recursive graph of nested DEGs

**Classification**: promote
**Severity**: MEDIUM
**Pillars affected**: [P-05-data-lineage, P-01-data-discovery]
**Support**: 1 sidecar (batch M `getDataEntityGroupsLineage`) — explicit deferred-feature comment in source code at `LineageServiceImpl.java:71` is the strongest intent anchor in this batch; composes with ADR-CANDIDATE-072 (recursive CTE lineage architecture) and ADR-CANDIDATE-120 (DEG-lineage edge-fetch shape).
**Batch**: M (2026-05-19)

**Surfaced by**:
- `odd-platform__java__DataEntityController__controller-method__getDataEntityGroupsLineage.md:implicit_adrs.[0]` (HIGH) — "DEG-lineage is INNER-DEG-FREE by deliberate carve-out, marked as deferred-feature in the source — the comment at `LineageServiceImpl.java:71` (`// Remove this when we will support inner DEGs for DEG lineage`) is the explicit intent anchor: this is a known limitation, scoped to be lifted in a future change. The filter at lines 72-75 strips both DEG-typed edge endpoints AND DEG-typed metadata entries. The decision shapes the API contract: clients see a DEG's lineage as a flat graph of non-DEG members, not a recursive graph of nested DEGs."

**Decision statement**: ODD's DEG-lineage endpoint (`GET /api/dataentitygroups/{data_entity_group_id}/lineage`, surfaced at `DataEntityController.getDataEntityGroupsLineage`) deliberately filters out DEG-typed entries from the response in TWO layers:

1. **Edge filter at `LineageServiceImpl.java:72-74`**: `relations.stream().filter(r -> !isDegODDRN(r.getChildOddrn(), dict) && !isDegODDRN(r.getParentOddrn(), dict)).toList()` — drops every LINEAGE edge where either endpoint is a DEG-typed entity.
2. **Metadata filter at `LineageServiceImpl.java:75`**: `dict.entrySet().removeIf(e -> isDEG(e.getValue().getDataEntity()))` — drops DEG-typed entries from the response's per-member metadata dictionary.

The architectural choice is positively marked in the source: the comment at `LineageServiceImpl.java:71` reads `// Remove this when we will support inner DEGs for DEG lineage`. The comment is the explicit intent anchor — this is a KNOWN limitation, deliberately scoped, with a stated future-lift trajectory.

The decision composes:
- **(a) The SQL layer DOES walk nested DEGs**: `ReactiveGroupEntityRelationRepositoryImpl.getDEGEntitiesOddrns(long)` (lines 177-204) runs a Postgres `WITH RECURSIVE` CTE that seeds from the DEG's oddrn and unions all entities reachable via `(GROUP_ENTITY_RELATIONS.GROUP_ODDRN.eq(tDataEntityOddrn))` — the recursion at lines 191-196 walks every nested DEG. Member enumeration supports nesting.
- **(b) The SERVICE layer strips DEGs from the result**: the two filters at LineageServiceImpl.java:72-75 remove DEG-typed entries from the FLATTENED view. The two layers are compatible — the SQL gives the service the full transitive member set; the service decides what to do with DEG-typed entries (currently: filter them out).
- **(c) The response shape is therefore a flat graph of non-DEG members**: A DEG containing 18 datasets + 2 nested sub-DEGs (each with their own members) returns a flat lineage graph of the 18 + (nested members) datasets, with no DEG-typed nodes or edges to those DEGs. The UI's `DEGLineage` React component (DEGLineage.tsx) renders a flat node-and-edge graph rather than a hierarchical view.
- **(d) The deferred-feature trajectory**: The comment scopes the limitation as removable in a future change. The SQL layer is READY (recursive enumeration of nested DEGs is implemented); the service-layer filter is the ONE piece of code to lift. The implication: a future "recursive DEG lineage" feature will be a one-line deletion + a response-shape contract change, NOT a wholesale rewrite.

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — the comment `// Remove this when we will support inner DEGs for DEG lineage` is the most explicit intent anchor possible: the maintainer (a) acknowledged the limitation, (b) named it as a known scope, (c) marked the future-lift trajectory. This is intentional-by-comment.
2. **Structural impact?** YES — affects the API contract for every consumer of `GET /api/dataentitygroups/{id}/lineage` (the UI's DEGLineage tab, the developer-guides API-reference doc, every third-party API consumer). The response-shape commitment is "flat graph of non-DEG members"; lifting the carve-out is a contract change.
3. **Adding/removing the filter would be STRUCTURAL?** YES — removing lines 72-75 silently flips the response shape from "flat" to "recursive with DEG nodes"; every UI consumer would need to render DEG-typed nodes specially; the OpenAPI spec would need a new component schema (or the existing schema's `nodes` field's semantics would silently change).

**Evidence**:
- getDataEntityGroupsLineage.md says: "LineageServiceImpl.java:71-75 — intent_anchor: `// Remove this when we will support inner DEGs for DEG lineage \n final List<LineagePojo> filteredRelations = relations.stream() \n .filter(r -> !isDegODDRN(r.getChildOddrn(), dict) && !isDegODDRN(r.getParentOddrn(), dict)) \n .toList(); \n dict.entrySet().removeIf(e -> isDEG(e.getValue().getDataEntity()));` (lines 71-75)"

**Existing ADR**: none. **Composes with ADR-CANDIDATE-072** (recursive-CTE lineage architecture — DEG-lineage uses a DIFFERENT, non-recursive edge-fetch shape per ADR-CANDIDATE-120; the recursion lives at the member-resolution layer, not the edge layer). **Composes with ADR-CANDIDATE-120** (DEG-lineage uses non-recursive edge-fetch with bidirectional bound-set filter — the two ADRs together describe the full DEG-lineage architecture).

**Cross-link gaps** (refactoring-scopes anchored on consequences this ADR DOES NOT defend):
- **REFACTOR-349 NEW** — DEG-lineage inner-DEG suppression has NO regression test pinning the contract. The comment at LineageServiceImpl.java:71 is a deferred-feature marker without a test anchor; a future lift accidentally inverts behaviour with no test signal.
- **REFACTOR-348 NEW** — DEG-lineage 404 conflates three semantically distinct conditions (DEG-not-found, non-DEG-typed entity, DEG-has-no-members) — identical error message; operators cannot debug.
- The decision does NOT defend against the doc-side gap: the live API-reference page documents the endpoint as "Returns the lineage graph for the group's children" but does NOT disclose the inner-DEG suppression. A third-party consumer against a DEG containing nested DEGs silently observes the nested DEGs missing from the response.

**Proposed action**: Promote to `adrs/drafts/deg-lineage-inner-deg-free.md` (new ADR). Document: (a) the deliberate carve-out (flat graph of non-DEG members); (b) the SQL-vs-service-layer split (SQL walks nested DEGs at member-resolution; service filters DEGs at response-assembly); (c) the deferred-feature trajectory (single-line lift when the inner-DEG feature ships); (d) the contract commitment (third-party consumers of `/api/dataentitygroups/{id}/lineage` get a flat node-and-edge graph). Doc-side: the live `/features/data-lineage` page + the `/developer-guides/api-reference/lineage` page should explicitly state the carve-out so consumers expecting recursive nesting are not surprised. Cross-link REFACTOR-349 (no regression test) and REFACTOR-348 (404 conflation) as the maintainability + UX costs this ADR does not address.

**Severity rationale**: MEDIUM — codebase-architectural decision with explicit comment-anchored intent; affects the API contract for every DEG-lineage consumer; the deferred-feature framing is itself a contract that future maintainers honour. Not HIGH because the consequence is bounded to the DEG-lineage endpoint family; not LOW because the response-shape commitment is load-bearing for UI + API consumers.

---

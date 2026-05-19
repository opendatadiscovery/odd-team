## ADR-CANDIDATE-083 — DEG-lineage is a per-MEMBER stream model with deferred INNER-DEG support — the response is `List<DataEntityLineageStreamDto>` (one per DEG member), inner-DEG-typed entries are filtered out with an explicit `// Remove this when we will support inner DEGs for DEG lineage` comment-marked deferred-feature

**Severity**: MEDIUM
**Classification**: promote
**Support count**: 1 sidecar (LineageService — primary source); ADR-CANDIDATE-057 (recursive-CTE lineage traversal) is the related single-rooted-lineage architecture
**Axes present**: services, schema

**Surfaced by**:
- `LineageServiceImpl.md:implicit_adrs[3]` ("DEG-lineage is INNER-DEG-FREE by deliberate carve-out, marked as deferred-feature in the source — getDataEntityGroupLineage filters out edges whose endpoint is itself a DEG (LineageServiceImpl.java:73) AND removes DEG-typed entries from the metadata dictionary (line 75). The comment at line 71 — `// Remove this when we will support inner DEGs for DEG lineage` — is the explicit intent anchor: this is a known limitation, scoped to be lifted in a future change, NOT an accidental absence. The decision shapes the API contract: clients see a DEG's lineage as a flat graph of non-DEG members, not a recursive graph of nested DEGs.")
- `LineageServiceImpl.md:implicit_adrs[4]` ("DEG-lineage is per-MEMBER, not per-DEG — the 3-arg getLineageStream overload (lines 181-198) produces one DataEntityLineageStreamDto PER DEG-member oddrn, and `establishDEGRelations` (lines 200-216) partitions the DEG's edge graph into per-member connected components. The result is `List<DataEntityLineageStreamDto>` in the response, not a single stream — the API contract is 'one lineage stream per DEG-member starting point'. This is the contract that `DataEntityGroupLineageList` (OpenAPI: `items: array of DataEntityLineageStream`) encodes.")

**Decision statement**: ODD's Data Entity Group (DEG) lineage view follows a **per-MEMBER stream model** that is deliberately distinct from the per-entity single-rooted lineage view (per ADR-CANDIDATE-057). The shape:

- **API contract**: `DataEntityGroupLineageDto` carries `List<DataEntityLineageStreamDto> items` — ONE stream PER DEG MEMBER, not one combined graph rooted at the DEG.
- **Computation pattern**: `getDataEntityGroupLineage` (LineageServiceImpl.java:59-85):
  1. Resolve the DEG's member oddrns via `reactiveGroupEntityRelationRepository.getDEGEntitiesOddrns(dataEntityGroupId)` (line 61).
  2. Fetch all edges connected to those member oddrns via the recursive CTE (line 62-65).
  3. Filter OUT edges whose either endpoint is itself a DEG (line 73): `r -> !isDegODDRN(r.getChildOddrn(), dict) && !isDegODDRN(r.getParentOddrn(), dict)` — **inner-DEG-FREE carve-out**.
  4. Partition the filtered edges into per-member connected components via `establishDEGRelations(memberOddrns, filteredRelations)` (lines 79-82, with the recursive helper `getRelationsForEntities` walking BFS frontier per member).
  5. Build ONE `DataEntityLineageStreamDto` per member oddrn → return as a list.

- **Inner-DEG-FREE comment** (line 71): `// Remove this when we will support inner DEGs for DEG lineage` — the explicit deferred-feature marker. The architectural commit is: **today the DEG lineage view is a FLAT graph of non-DEG members; future work may expand it to a recursive graph of nested DEGs**.

The decision codifies:

- **(a) Per-member stream model, not per-DEG aggregate**. A DEG with N members produces N separate lineage streams in the response. Each stream is its own connected component within the DEG-member set. The API contract surfaces this as `List<DataEntityLineageStreamDto>`.
- **(b) DEG-as-container, not DEG-as-node-in-lineage**. The current model treats DEGs as collections; the lineage graph operates on the MEMBERS, not on the container. A future "inner DEGs" model would make the DEG itself a lineage node.
- **(c) Explicit deferred-feature scope**. The inner-DEG suppression is comment-marked as a known limitation. The contract is the CURRENT shape; future work will change it. A maintainer encountering this comment understands "this is a constraint, not a bug."
- **(d) Partitioning via BFS frontier walk** (`establishDEGRelations` + `getRelationsForEntities`). The maintainer chose recursive BFS over alternatives like (alt1) UnionFind on the edges or (alt2) Postgres recursive-CTE-per-member or (alt3) building the full reachability matrix and slicing. The BFS choice is explicit at line 218-233.

The rejected alternatives:

- **(alt1)** One graph rooted at the DEG: would require the DEG itself to be a lineage node; would need inner-DEG support; conflicts with the deferred-feature stance.
- **(alt2)** One stream per (entity, DEG) pair with no member-partitioning: would produce O(N×M) streams for N members in M DEGs; not useful for UI rendering.
- **(alt3)** Allow inner-DEG nodes in the response: matches the future state but the current UI rendering doesn't handle DEG-as-node; lifting requires UI work alongside service work.

**Wisdom test (3-question)**:
1. *Intentional?* YES — the explicit comment at line 71 ("Remove this when we will support inner DEGs for DEG lineage") is the textbook intent anchor: the maintainer explicitly stated the current state IS a deliberate constraint scoped to be lifted in a future change. The two-stage processing (filter inner DEGs out, partition by member) is structurally distinct from the single-rooted lineage path; the API shape (`List<...>`) confirms the contract.
2. *Structural impact?* YES — affects the OpenAPI contract (`DataEntityGroupLineageList` with `items` array), the UI rendering (per-member stream visualisation), the future "inner DEGs" feature scope, the recursive helper that partitions edges (`establishDEGRelations` is unique to this path).
3. *Refactoring or structural?* STRUCTURAL — lifting the inner-DEG suppression requires API contract change, UI work, and a redesign of `establishDEGRelations`. Not a refactor.
→ ADR-CANDIDATE.

**Evidence**:
- `LineageServiceImpl.md` says: "`// Remove this when we will support inner DEGs for DEG lineage \n final List<LineagePojo> filteredRelations = relations.stream() \n .filter(r -> !isDegODDRN(r.getChildOddrn(), dict) && !isDegODDRN(r.getParentOddrn(), dict)) \n .toList(); \n dict.entrySet().removeIf(e -> isDEG(e.getValue().getDataEntity()));` (lines 71-75)"
- `LineageServiceImpl.md` says: "`final List<DataEntityLineageStreamDto> items = establishedRelations.entrySet().stream().map(oddrnRelations -> getLineageStream(oddrnRelations.getKey(), oddrnRelations.getValue(), dict)).toList(); return new DataEntityGroupLineageDto(items);` (lines 79-82)"
- intent_anchor: the explicit `// Remove this when we will support inner DEGs for DEG lineage` comment is the deferred-feature marker

**Existing ADR**: composes with:
- **ADR-CANDIDATE-057** (single-query recursive-CTE lineage + progressive expansion) — the per-entity-lineage architecture; this ADR is the per-DEG-lineage counterpart. The two together describe the lineage subsystem's read-side architecture.
- **ADR-CANDIDATE-072** (Establisher-keyed lineage edge provenance) — the schema-side counterpart for both lineage views.
- **ADR-CANDIDATE-082** (replace-not-merge collector contract) — collectors publishing lineage edges may declare edges between DEG members; the replace contract operates per-establisher independent of DEG-vs-non-DEG.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-274 (NEW — inner-DEG suppression has no test anchor: the deferred-feature comment acknowledges the limitation but no regression test pins the CURRENT contract; a maintainer attempting the lift will have no test feedback).
- REFACTOR-273 (NEW — `getRelationsForEntities` JVM-stack recursion: the BFS-frontier walk is not TCO-able in Java; stack-overflow on path-graph components of length 1000+).

**Proposed action**: Promote to `adrs/drafts/deg-lineage-per-member-stream-model.md`. Document:
- The per-member stream model (one DataEntityLineageStreamDto per DEG member, NOT one combined graph).
- The inner-DEG-FREE carve-out and its deferred-feature framing.
- The DEG-as-container conceptual model (DEGs are collections; lineage operates on members).
- The BFS-frontier partitioning algorithm.
- The current contract shape: `List<DataEntityLineageStreamDto>` in `DataEntityGroupLineageDto`.
- The future-work signal: the inner-DEG support is a known scope; lifting it requires API contract change + UI work.
- The maintenance-test obligation: pin the CURRENT contract with regression tests so the future lift surfaces as a deliberate API change, not a silent shape shift.
- Cross-link with ADR-CANDIDATE-057, ADR-CANDIDATE-072, ADR-CANDIDATE-082.

**Severity rationale**: MEDIUM — pattern-shaping decision for the DEG lineage feature. Lower than the lineage-canvas architecture (ADR-CANDIDATE-057) because DEG-lineage is one feature surface among many, but the deferred-feature framing is significant for future-work planning. Operator-visible: any UI work or API consumer needs to understand the per-member contract.

---

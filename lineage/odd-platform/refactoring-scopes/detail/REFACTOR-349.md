## REFACTOR-349 — DEG-lineage inner-DEG suppression has NO regression test pinning the contract — the `// Remove this when we will support inner DEGs for DEG lineage` comment is a deferred-feature marker without a test anchor; a future lift accidentally inverts behaviour with no test signal

**Severity**: MEDIUM
**Category**: missing-test (deferred-feature regression-vector)
**Pillars affected**: [P-05-data-lineage]
**Batch**: M (2026-05-19)

**Surfaced by**:
- `odd-platform__java__DataEntityController__controller-method__getDataEntityGroupsLineage.md:bugs_limitations_corner_cases.[3]` (MEDIUM) — "**Inner-DEG suppression is comment-marked as deferred-feature but lacks a backlog citation, ADR reference, or regression test** — the comment at LineageServiceImpl.java:71 (`// Remove this when we will support inner DEGs for DEG lineage`) acknowledges a known limitation. There is NO corresponding backlog item (Grep `inner DEG|nested DEG` in `<odd-team>/backlog/` returns no matches), NO ADR draft, and NO regression test pinning the current behaviour. A future maintainer attempting the lift will have no test feedback when they accidentally break the existing API contract; the lift will silently change the response shape from 'flat graph of non-DEG members' to 'recursive graph including DEG nodes'."
- `odd-platform__java__DataEntityController__controller-method__getDataEntityGroupsLineage.md:tests_coverage_semantic.uncovered_behaviours.[5]` (Inner-DEG suppression regression — no test pins the current contract that nested-DEG entries are filtered OUT of the response)

**Description**: `LineageServiceImpl.java:71-75` contains the explicit deferred-feature carve-out:

```java
// Remove this when we will support inner DEGs for DEG lineage
final List<LineagePojo> filteredRelations = relations.stream()
    .filter(r -> !isDegODDRN(r.getChildOddrn(), dict) && !isDegODDRN(r.getParentOddrn(), dict))
    .toList();
dict.entrySet().removeIf(e -> isDEG(e.getValue().getDataEntity()));
```

The comment is a positive intent anchor (codified as ADR-CANDIDATE-119 NEW) — the maintainer knows about the limitation and has scoped the future-lift trajectory. The gap is the absence of **test infrastructure** pinning the current behaviour:

1. **No regression test asserting the carve-out**: A test that constructs a DEG containing both leaf entities AND a nested DEG (with its own leaves), then calls `getDataEntityGroupLineage(degId)` and asserts that the response contains ONLY non-DEG entries — would catch a future accidental removal of lines 72-75. No such test exists (verified via Grep `getDataEntityGroupLineage|getDataEntityGroupsLineage` on `odd-platform-api/src/test/java` returning zero matches).

2. **No backlog item naming the future lift**: A Grep `inner DEG|nested DEG` on `lineage/odd-platform/backlog/` returns no matches. The deferred feature is comment-only; there is no DOC-NNN / FEAT-NNN / REFACTOR-NNN tracking the eventual lift work.

3. **No ADR draft codifying the carve-out**: Until batch M (ADR-CANDIDATE-119 NEW), the deferred-feature was code-comment-only. The ADR now codifies the architectural decision; the maintainer's future-lift work would update both the code AND the ADR.

**Concrete future-regression vectors**:

- **Vector 1 — accidental removal during refactor**: A maintainer cleaning up "unused predicates" in `LineageServiceImpl` removes lines 71-75 thinking they're decorative. The response shape silently flips from "flat non-DEG graph" to "recursive graph with DEG nodes". UI: DEGLineage component is currently coded for `(node | edge)` shape; rendering DEG-typed nodes in the same graph would produce visual hierarchy bugs (DEG node rendered same size as leaf node; double-edge between DEG and member; etc.). Third-party API consumers: parsers that don't expect DEG-typed nodes silently produce wrong analytics.
- **Vector 2 — "feature lift" without contract negotiation**: A maintainer implementing the lifted-feature ("show nested DEGs in DEG-lineage view") removes lines 71-75 + adds new UI rendering for DEG-typed nodes, but does NOT bump the OpenAPI response schema OR the live API-reference doc. Third-party consumers receive the new response shape silently, breaking their integrations.

**Primary source citations**:
- `LineageServiceImpl.java:71-75` (the deferred-feature comment + the two filter operations)
- Grep `getDataEntityGroupLineage|getDataEntityGroupsLineage` on `odd-platform-api/src/test/java` → ZERO matches (verified 2026-05-19)
- Grep `inner DEG|nested DEG` on `lineage/odd-platform/backlog/` → ZERO matches (verified 2026-05-19)
- (cross-link) `LineageServiceImpl.md:bugs_limitations_corner_cases.[7]` from batch I (the same finding from the service-layer perspective)
- (cross-link ADR-CANDIDATE-119 NEW batch M) — codifies the architectural decision; this REFACTOR is the test-infrastructure cost

**Existing-ADR-or-implied-prescription**: **ADR-CANDIDATE-119 NEW** (batch M — DEG-lineage inner-DEG-free deferred-feature carve-out) codifies the architectural decision and names the future-lift trajectory. The ADR endorses the design; this REFACTOR captures the test-infrastructure gap that the design's reversibility-as-feature-flag requires.

**Proposed remedy**: Two paths, ideally both:

1. **Add the regression test** (HIGH-leverage, low-cost):
   ```java
   @Test
   void getDataEntityGroupLineage_filtersOutInnerDEGs() {
       // Given: a DEG containing 3 leaf entities + 1 nested DEG (which itself has 2 leaves)
       // When: getDataEntityGroupLineage(parentDegId) is called
       // Then: the response.items contains nodes for ONLY the 3 + 2 = 5 leaf entities;
       //       NO node has entity_classes containing DATA_ENTITY_GROUP
   }
   ```
   The test must run against the live SQL CTE (the recursive member resolution + the in-memory filter); a `@SpringBootTest` integration test against `LineageServiceImpl` with seeded `data_entity` + `group_entity_relations` rows is the appropriate scope. The test serves dual purposes: (a) regression-vector for accidental removal of lines 72-75; (b) contract-pin for the future-lift work (the test must be UPDATED when the feature ships, providing a code-review signal for the contract change).

2. **Add a backlog item for the future lift** (REFACTOR-NNN or FEAT-NNN):
   ```markdown
   ## FEAT-NNN — Lift DEG-lineage inner-DEG suppression: support recursive DEG nesting in DEG-lineage view
   - Code: remove the filter at LineageServiceImpl.java:71-75
   - Tests: update the regression test from REFACTOR-349 to assert nested-DEG nodes ARE present
   - UI: update DEGLineage component to render DEG-typed nodes with hierarchy affordance
   - OpenAPI: bump the response schema (or version the endpoint) to reflect the new shape
   - Docs: update the live API-reference + feature-lineage page
   - Cross-link: ADR-CANDIDATE-119 NEW (the architectural decision to retire)
   ```

The minimum-viable fix is option (1) — adding the regression test makes the contract-pin explicit and gives the future-lift work a clear code-review signal.

**Severity rationale**: MEDIUM — test-infrastructure gap on a deferred-feature carve-out; the response-shape commitment is positively anchored in ADR-CANDIDATE-119 NEW but the test layer does not enforce the commitment. A future regression could silently change the API contract for every UI client and third-party consumer with no test signal.

**Suggested backlog grouping**: `Test bootstrap` — couple with REFACTOR-348 NEW (cross-boundary edges silently filtered — same DEG-lineage endpoint, related contract-pinning gap).

---

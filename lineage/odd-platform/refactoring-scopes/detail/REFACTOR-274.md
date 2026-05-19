## REFACTOR-274 — Inner-DEG suppression is comment-marked deferred-feature with NO test anchor pinning the current contract; a future lift will silently change response shape

**Severity**: MEDIUM
**Category**: missing-test (deferred-feature regression risk)
**Surfaced by**:
- `LineageServiceImpl.md:bugs_limitations_corner_cases[7]`

**Description**: Per ADR-CANDIDATE-083, `LineageServiceImpl.getDataEntityGroupLineage` (lines 71-75) filters out edges whose endpoint is itself a DEG (inner-DEG-FREE carve-out) with the explicit comment:
```java
// Remove this when we will support inner DEGs for DEG lineage
final List<LineagePojo> filteredRelations = relations.stream()
    .filter(r -> !isDegODDRN(r.getChildOddrn(), dict) && !isDegODDRN(r.getParentOddrn(), dict))
    .toList();
dict.entrySet().removeIf(e -> isDEG(e.getValue().getDataEntity()));
```

The comment is the deferred-feature marker — the maintainer's explicit acknowledgement that inner-DEG support is future work. The CURRENT contract is "DEG lineage response contains only non-DEG members."

The GAP: no regression test pins the current contract. The sidecar's `tests_coverage_semantic.test_files` notes:
- `LineageServiceTest.java:123-174` — the single @Test method exists but does NOT exercise inner-DEG suppression.
- No test asserts "given a DEG containing a member that links to an inner DEG, the response excludes the inner DEG from the items list."

A future maintainer attempting the lift (removing lines 71-75 to enable inner-DEG support) will have:
- No test failure signal — the existing test suite passes.
- Silent response-shape change: clients that depend on "flat graph of non-DEG members" suddenly receive recursive nested-DEG payloads.
- UI side: the canvas-rendering code that assumed non-DEG-only nodes silently breaks (or renders DEGs as regular entity nodes — visually confusing).
- API consumers: any consumer that filtered the response for entity-type silently includes DEG entries.

The deferred-feature is well-marked in code but not in tests. The result: the lift is ENABLED by the code architecture (one line removal) but is a STRUCTURAL API change that needs versioning, not a silent feature toggle.

**Primary source citations**:
- `LineageServiceImpl.java:71-75` — the deferred-feature comment + the filter
- `LineageServiceTest.java:123-174` — the single test method, no inner-DEG coverage
- composes with ADR-CANDIDATE-083 (the architectural intent — the test anchor obligation it implies)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-083 (DEG-lineage per-MEMBER stream) codifies the architectural intent. The ADR's MAINTENANCE-TEST OBLIGATION (per the ADR's proposed action: "pin the CURRENT contract with regression tests so the future lift surfaces as a deliberate API change") is the prescription. The fix is adding the test.

**Proposed remedy**: Two composable fixes:
1. **Add regression test** exercising inner-DEG suppression:
   ```java
   @Test
   void getDataEntityGroupLineage_inner_DEGs_filtered() {
     // setup: create a DEG with members where one member's lineage edge points to ANOTHER DEG
     // (the inner DEG is intentionally NOT a member of the outer DEG)
     // expectation: response items contain only the non-DEG members; the inner DEG is absent
     final var response = lineageService.getDataEntityGroupLineage(outerDEGId).block();
     assertThat(response.getItems()).hasSize(2);  // two non-DEG members
     assertThat(response.getItems().flatMap(s -> s.getNodes()))
         .noneMatch(node -> node.getEntityClasses().contains(EntityClass.DATA_ENTITY_GROUP));
   }
   ```
2. **Update the deferred-feature comment** to reference the test:
   ```java
   // Remove this when we will support inner DEGs for DEG lineage
   // CONTRACT TEST: LineageServiceTest.getDataEntityGroupLineage_inner_DEGs_filtered
   // Lifting this filter will FAIL the test and SHOULD be a deliberate API-versioning change.
   ```

The test + comment together close the regression-risk gap.

**Severity rationale**: MEDIUM — deferred-feature with no test anchor is a future-refactor trap. The lift will happen at some point; without the test, it silently breaks consumers.

**Suggested backlog grouping**: `Test bootstrap hardening` — pair with REFACTOR-250 (AOP test-coverage trap), REFACTOR-261 (MICROSERVICE exclusion no test). The deferred-feature / silent-pattern gaps are a cluster.

---

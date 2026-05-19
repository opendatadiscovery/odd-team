## REFACTOR-263 — Within-phase processor execution order is non-deterministic (Spring bean injection order); a processor with an undeclared write-then-read dependency on another MAIN-phase processor has no ordering guarantee

**Severity**: LOW
**Category**: refactor-risk (no observed bug)
**Surfaced by**:
- `IngestionService.md:bugs_limitations_corner_cases[10]`

**Description**: Per ADR-CANDIDATE-079, the ingestion processor chain groups processors by phase, executes phases SEQUENTIALLY (concatMap), but executes processors WITHIN a phase in PARALLEL via `Mono.zip`. The within-phase iteration order is determined by:
- Spring's bean-injection order for the `List<IngestionRequestProcessor>` constructor parameter.
- This order is NOT guaranteed by the Spring spec; it depends on classpath scan order, bean-name alphabetisation in some configurations, or explicit `@Order` annotations.

Today, none of the 9 MAIN-phase processors carries `@Order`. The bean-injection order is implicitly determined by Spring's classpath resolution. The MAIN-phase processors are (alphabetically):
- DataEntityFilledIngestionRequestProcessor
- DataEntityGroupIngestionRequestProcessor
- DataEntityRelationsIngestionRequestProcessor
- DataQualityTestIngestionRequestProcessor
- DatasetStructureIngestionRequestProcessor
- LineageIngestionRequestProcessor
- MetadataIngestionRequestProcessor
- TaskRunIngestionRequestProcessor
- UsageReportIngestionRequestProcessor

For these to execute in PARALLEL safely, they MUST have no write-then-read dependency on each other within the same phase. Today, no such dependency exists (verified by inspection — each processor's writes are to its own table-scoped target). But the safety property is structural — it holds only because the maintainer ENFORCED IT through processor design.

The RISK: a future maintainer adds a 10th MAIN-phase processor that reads from `data_entity_filled` (which `DataEntityFilledIngestionRequestProcessor` writes within the same phase). Under SOME Spring resolution orders, the new processor runs BEFORE the filled processor and reads stale data. Under OTHER orders, it runs after and reads fresh data. The result is non-deterministically wrong, AND green tests pass under whatever order the test environment happens to use.

The fix shape is structural: either (a) declare the dependency by moving the new processor to a separate phase (FINALIZING or a new POST_MAIN phase), or (b) introduce explicit `@Order` annotations to pin the within-phase order. Option (a) is preferred (per ADR-CANDIDATE-079, the phase-grouping IS the dependency declaration).

**Primary source citations**:
- `IngestionProcessorChain.java:21-27` — TreeMap groups by phase only
- `IngestionProcessorChain.java:30-41` — parallel execution via `Mono.zip` within phase
- The 9 MAIN-phase processor classes — none carries `@Order`
- composes with ADR-CANDIDATE-079 (the architectural design that this scope identifies as fragile)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-079 codifies the phase-grouping model. The ADR's stance is "phases ARE the dependency declaration; within-phase order is non-deterministic and that's intentional." The gap is the absence of a defending comment or a regression test pinning the current safety property. The fix is documentation, not refactoring.

**Proposed remedy**: Three composable fixes:
1. **Defending comment at IngestionProcessorChain.java**: document the within-phase non-determinism with the architectural invariant ("processors in the same phase MUST not depend on each other's writes; if a write-then-read dependency emerges, declare it via phase separation").
2. **Regression test** that exercises every MAIN-phase processor combination and asserts independence (e.g. a test that shuffles the injection order N times and asserts the same ingestion result).
3. **Per-processor doc comment** on each processor: list which TABLE(s) it writes to, which it reads from. Makes dependency analysis tractable.

**Severity rationale**: LOW — no observed bug today; the gap is the future-refactor fragility. The pattern is correct; the absence of defending mechanisms makes it fragile to future maintainers.

**Suggested backlog grouping**: `Ingestion architecture documentation sprint` — pair with REFACTOR-249, REFACTOR-251, REFACTOR-261. Code-comment hygiene + architectural-doc clarity for the ingestion subsystem.

---

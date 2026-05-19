## ADR-CANDIDATE-079 — Three-phase ingestion processor chain (`INITIAL → MAIN → FINALIZING`) with parallel within-phase + sequential between-phase execution; phases dispatched by named enum carrying explicit `order` ints + TreeMap comparator on `getOrder`

**Severity**: HIGH
**Classification**: promote
**Support count**: 1 sidecar (IngestionService — primary source); composes with the 14 processor implementations as cross-validation
**Axes present**: services, ingestion pipeline

**Surfaced by**:
- `IngestionService.md:implicit_adrs[1]` ("Three-phase processor chain (INITIAL → MAIN → FINALIZING) with parallel execution WITHIN a phase, sequential BETWEEN phases — chosen for ordering correctness while preserving intra-phase concurrency. The enum is named (not ordinal) and carries an explicit `order` field with a separate `int`; the TreeMap-comparator is `Comparator.comparingInt(IngestionProcessingPhase::getOrder)` (not `naturalOrder()`). The maintainer deliberately decoupled the phase identity from the ordering — adding a phase between MAIN and FINALIZING requires only an enum addition with the right order int, no comparator change.")

**Decision statement**: ODD's ingestion pipeline is organised as a **3-phase processor chain** dispatched by the `IngestionProcessingPhase` enum at the heart of `IngestionProcessorChain`. The phases are:

```java
// IngestionProcessingPhase.java:7-14
INITIAL(1),
MAIN(2),
FINALIZING(3)
```

The processor chain execution:
```java
// IngestionProcessorChain.java:21-41
// 1. Group all injected IngestionRequestProcessor beans by their declared phase, into a TreeMap sorted by phase.order
TreeMap<IngestionProcessingPhase, List<IngestionRequestProcessor>> byPhase =
  processors.stream().collect(groupingBy(IngestionRequestProcessor::phase,
    () -> new TreeMap<>(Comparator.comparingInt(IngestionProcessingPhase::getOrder)),
    toList()));

// 2. For each phase in order, run all processors in that phase in parallel via Mono.zip,
//    then concatMap to the next phase (sequential between phases)
return Flux.fromIterable(byPhase.values())
  .concatMap(phaseProcessors -> Mono.zip(
    phaseProcessors.stream().filter(p -> p.shouldProcess(request))
      .map(p -> p.process(request)).toList(),
    results -> request));
```

The architectural commit:

- **(a) PARALLEL within phase** — `Mono.zip` subscribes to each input simultaneously; processors in the same phase run concurrently on the reactor scheduler. The reactive parallelism preserves throughput when independent processors can overlap their I/O.
- **(b) SEQUENTIAL between phases** — `concatMap` ensures phase N+1 starts only after phase N completes. The barrier exists because phase N's writes are PREREQUISITES for phase N+1's reads.
- **(c) Named enum + explicit `order` int — NOT ordinal** — the comparator is `Comparator.comparingInt(IngestionProcessingPhase::getOrder)`, NOT `Comparator.naturalOrder()`. The maintainer deliberately decoupled the phase IDENTITY from the ORDERING — adding `PRE_MAIN` between INITIAL and MAIN requires only an enum addition with `order=1.5` (or renumbering); no comparator change, no breaking dispatch contract.
- **(d) `shouldProcess(request)` per-processor gate** — each processor declares whether it has work to do for THIS request (e.g. `FTSVectorsIngestionRequestProcessor.shouldProcess` returns true only if there are non-JOB_RUN entities). The chain skips no-op processors.

The phase assignment encodes the dependency graph:

- **INITIAL** (`order=1`) — runs BEFORE the persistence chain in `IngestionServiceImpl.persistDataEntities`. Currently ONE processor: `HollowDataEntityIngestionRequestProcessor` (creates the empty `data_entity` rows that downstream processors reference).
- **MAIN** (`order=2`) — runs AFTER `persistDataEntities` completes its `bulkUpdate` + `bulkCreate` + `restoreDeletedDataEntityRelations`. NINE processors: `DatasetStructureIngestionRequestProcessor`, `TaskRunIngestionRequestProcessor`, `MetadataIngestionRequestProcessor`, `LineageIngestionRequestProcessor`, `UsageReportIngestionRequestProcessor`, `DataEntityFilledIngestionRequestProcessor`, `DataEntityRelationsIngestionRequestProcessor`, `DataQualityTestIngestionRequestProcessor`, `DataEntityGroupIngestionRequestProcessor`. They all need the entity rows to exist.
- **FINALIZING** (`order=3`) — runs AFTER MAIN. THREE processors: `FTSVectorsIngestionRequestProcessor` (the FTS-vector rebuild needs all field-level writes complete), `ActivityIngestionRequestProcessor` (the activity-event emission needs the new-entity IDs from INITIAL+MAIN to compute deltas), `AlertIngestionRequestProcessor` (BIS alert resolution needs the changedDatasetIds set computed during MAIN).

The phase-grouping is the EXPLICIT DEPENDENCY DECLARATION. Adding a new processor requires choosing the phase that contains its prerequisites. A processor that reads MAIN-phase writes MUST go in FINALIZING; a processor with no upstream dependencies can go in INITIAL.

The decision codifies:
- **(a) Ordering correctness via explicit phases**, not via `@DependsOn` or ad-hoc Spring bean ordering — the dispatch is visible in one file (`IngestionProcessorChain.java`) instead of scattered across @Order annotations.
- **(b) Parallelism preserved within phases** — independent processors don't serialise; the reactor scheduler maximises throughput.
- **(c) Extensibility by enum addition** — the `order` int is the extension point; the comparator semantics survive new phases.

**Wisdom test (3-question)**:
1. *Intentional?* YES — the enum is named (3 phases), the explicit `int order` field is paired with the TreeMap `Comparator.comparingInt(...)`, the parallel-within / sequential-between `Mono.zip + concatMap` is structurally distinct from a flat parallel-everything or sequential-everything approach. The phase-assignment of each processor is in the source verbatim (`IngestionRequestProcessor.phase()` method on each impl).
2. *Structural impact?* YES — affects the ingestion subsystem's entire shape (14 processors, their phase assignments, the dispatch chain), affects throughput (parallelism vs serialisation), affects extensibility (new processor = choose phase = declare dependency).
3. *Refactoring or structural?* STRUCTURAL — moving to `@DependsOn` or flat parallelism or sequential-everything would require redesigning the orchestration and likely the processor interface contract. Not a refactor.
→ ADR-CANDIDATE.

**Evidence**:
- `IngestionService.md` says: "IngestionProcessingPhase.java:7-14 (named enum with explicit order ints) + IngestionProcessorChain.java:21-27 (TreeMap by `phase.order`) + IngestionProcessorChain.java:30-41 (parallel `Mono.zip` within a phase, sequential `concatMap` between phases)"
- intent_anchor: "the TreeMap-comparator is `Comparator.comparingInt(IngestionProcessingPhase::getOrder)` (not `naturalOrder()`). The maintainer deliberately decoupled the phase identity from the ordering"

**Existing ADR**: composes with:
- **ADR-CANDIDATE-061** (OpenAPI-contract-driven ingestion path) — the controller-side counterpart; this ADR is the service-side architecture.
- **ADR-CANDIDATE-067** (`@ReactiveTransactional` boundary asymmetry) — the entire 3-phase chain runs inside ONE `@ReactiveTransactional` on `IngestionServiceImpl.ingest` (line 66); all 14 processors share one transaction.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-263 (NEW — within-phase processor execution order non-deterministic; a future processor with an undeclared write-then-read dependency on another MAIN-phase processor has no ordering guarantee).
- REFACTOR-262 (NEW — transactional all-or-nothing 5xx, no partial-success response — the entire 3-phase chain rolls back on any failure).

**Proposed action**: Promote to `adrs/drafts/three-phase-ingestion-processor-chain.md`. Document:
- The three-phase model (INITIAL → MAIN → FINALIZING) and the rationale.
- The parallel-within / sequential-between semantics and how `Mono.zip + concatMap` enforce them.
- The named-enum + explicit-order convention (not ordinal-based dispatch).
- The processor-phase assignment as dependency declaration.
- The current phase contents (1 INITIAL, 9 MAIN, 3 FINALIZING) and the dependency arrows between phases.
- The extensibility contract: adding a phase = add enum constant with `order`; adding a processor = choose phase via `phase()` method.
- The transactional-scope constraint: the entire chain shares one `@ReactiveTransactional`, so any processor failure aborts ALL of them.
- Cross-link with ADR-CANDIDATE-061 (OpenAPI-driven controller side), ADR-CANDIDATE-067 (service-tier transaction).

**Severity rationale**: HIGH — load-bearing architectural decision for the entire ingestion subsystem. Every collector that writes to ODD relies on the dispatch order. Every future ingestion-side feature (alert resolvers, BIS extraction, new FTS strategies, lineage producers) plugs into this chain by choosing a phase. Compatibility-change calculus depends on understanding the dependency model.

---

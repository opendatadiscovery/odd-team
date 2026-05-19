## REFACTOR-259 — Silent lineage-edge-deletion-on-absence: re-ingesting an entity with a partial source/target list silently DELETES the omitted lineage edges

**Severity**: HIGH
**Category**: silent-destructive-operation
**Surfaced by**:
- `IngestionService.md:bugs_limitations_corner_cases[1]`
- `IngestionService.md:security.known_security_gaps[1]`
- co-surfaced ADR: ADR-CANDIDATE-082 (replace-not-merge collector contract) + ADR-CANDIDATE-072 (establisher-keyed lineage)

**Description**: `LineageIngestionRequestProcessor.process` (line 17) invokes `lineageService.replaceLineagePaths(request.getLineageRelations())`. The verb is `replace`, not `merge` (per ADR-CANDIDATE-082). The service-tier implementation (`LineageServiceImpl.java:124-133`) extracts the SET of establishers from the new payload, calls `batchDeleteByEstablisherOddrn(establishers)` (deleting ALL existing edges declared by those establishers), then inserts the supplied pojos.

The build of `request.getLineageRelations()` upstream (`IngestionServiceImpl.java:233-274`) extracts lineage from the payload's `dataTransformer.sourceList` / `targetList` / `dataConsumer.inputList`. Only the edges PRESENT in the payload are extracted; edges previously declared by these establishers but NOT in the new payload are DELETED by the replace.

A collector bug that emits an incomplete `sourceList` (e.g. a Python set iteration order changed, a YAML file lost a section, a network call truncated the list) silently destroys the rest of the entity's upstream lineage. Operators discover the loss only when:
- A downstream consumer reports "I can't see my data source's lineage anymore."
- A compliance review notices the lineage graph has holes.
- A user navigating the canvas sees a previously-connected entity now isolated.

No `log.warn` is emitted on the delete-by-establisher branch (verified at `LineageServiceImpl.java:124-133` — no log.* in the body). No activity event is emitted (no @ActivityLog at the service or processor). The DB transaction succeeds, the platform returns 200 OK.

**Primary source citations**:
- `LineageIngestionRequestProcessor.java:17` — `lineageService.replaceLineagePaths(request.getLineageRelations()).then()` (the verb is `replace`)
- `LineageServiceImpl.java:124-133` — the replace-by-establisher implementation
- `IngestionServiceImpl.java:233-274` — the upstream payload-extraction that determines which edges are "in" vs "out"
- composes with ADR-CANDIDATE-082 (replace-not-merge contract)
- composes with ADR-CANDIDATE-072 (establisher-keyed provenance — the establisher determines the delete scope)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-082 is the architectural intent. ADR-CANDIDATE-072 codifies the establisher-keyed model that makes the per-establisher delete scope correct. The gap is operator-visibility — the ADR's design does NOT defend against silent collector bugs. The fix is refactoring within the existing architecture (add observability + audit) without changing the contract.

**Proposed remedy**: Same shape as REFACTOR-258, applied to lineage:
1. **`log.warn` on the delete-by-establisher branch**: at `LineageServiceImpl.java:130` (between batchDeleteByEstablisherOddrn and batchInsertLineages), emit `log.warn("Deleted {} lineage edges declared by establisher {} on ingestion replace", deletedCount, establisher)` per establisher. The current code is `.thenMany(...)` so deletedCount is not exposed; refactor to capture it via `.collectList()` or `.count()`.
2. **Activity-feed emission for net-deletions**: when the new payload's edge count is LESS than the deleted count for a given establisher, emit `LINEAGE_EDGES_DELETED` activity event with (establisher_oddrn, delta) tuple.
3. **Operator threshold**: emit a `WARN` log when the delete-to-insert ratio for an establisher exceeds 0.5 — "more than half of this establisher's lineage was deleted in one ingestion."
4. **Doc-side enforcement**: update the live `/features/data-lineage` page and the collector docs to document the replace-by-establisher contract with operator-visible severity.

**Severity rationale**: HIGH — silent data destruction on the platform's flagship feature surface (lineage). Same shape as REFACTOR-258 (metadata) but more visible to end users (lineage canvas is a primary discovery surface). The compound risk under filter-OFF default deployment is severe.

**Suggested backlog grouping**: `Ingestion observability sprint` — pair with REFACTOR-258 (metadata), REFACTOR-260 (restore), REFACTOR-261 (MICROSERVICE), REFACTOR-264 (ingestion-update audit).

---

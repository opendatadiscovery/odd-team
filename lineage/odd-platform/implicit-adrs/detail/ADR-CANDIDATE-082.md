## ADR-CANDIDATE-082 — Replace-not-merge collector contract: lineage edges and metadata fields are REWRITTEN per ingestion call; collectors must re-emit their complete state every call; omission = deletion

**Severity**: HIGH
**Classification**: promote
**Support count**: 2 sidecars (IngestionService — primary source + Lineage replaceLineagePaths in LineageService); composes with ADR-CANDIDATE-072 (establisher-keyed lineage provenance)
**Axes present**: services, ingestion pipeline

**Surfaced by**:
- `IngestionService.md:implicit_adrs[4]` ("Replace-not-merge for lineage edges and metadata fields is the per-ingestion contract — collectors must re-emit their full state every call. The verb `replace` in LineageService.replaceLineagePaths and the explicit `SetUtils.difference(...).toSet()` followed by `delete(bindingsToDelete)` are both intentional. The alternative (merge semantics — only add new, never remove) would require zero code changes to the read path but the maintainer chose REPLACE — meaning the contract with collectors is 'the payload represents the complete state of this entity's relations from this datasource'.")
- `LineageServiceImpl.md:implicit_adrs[1]` ("Establisher-keyed atomic-rewrite contract for ingestion — replaceLineagePaths takes a `List<LineagePojo>`, extracts the SET of establishers, deletes ALL edges by those establishers, then inserts the supplied pojos, ALL inside a single @ReactiveTransactional. The contract is 'when an entity re-publishes its lineage, the rewrite is atomic and per-establisher: edges declared by OTHER entities are untouched'.")

**Decision statement**: ODD's ingestion contract is **REPLACE-NOT-MERGE** for collector-managed relational state. Two surfaces are affected:

- **Lineage edges** (`LineageIngestionRequestProcessor.process` → `LineageService.replaceLineagePaths` → `LineageRepository.batchDeleteByEstablisherOddrn` + `LineageRepository.batchInsertLineages`): the verb is `replace`, NOT `merge`. The processor extracts the SET of establishers (the entities whose ingestion run is publishing the edges), deletes ALL existing edges keyed by those establishers, then inserts the new pojos. Edges that were previously in the DB but are NOT in the new payload are **HARD-DELETED**. Edges declared by OTHER establishers are untouched (per ADR-CANDIDATE-072's establisher-keyed provenance).

- **Metadata fields** (`MetadataIngestionRequestProcessor.process` at lines 36-82): the processor loads the entity's CURRENT metadata bindings, computes `bindingsToDelete = existingMetadataBindings.difference(currentBindings)`, and DELETES the difference inside the same transaction. Fields that were previously bound but are NOT in the new payload are HARD-DELETED.

The contract codifies:

- **(a) Collectors own their declared state**. The payload represents the COMPLETE state of the entity's relations FROM THIS DATASOURCE. A collector that emits a partial state accepts the loss.
- **(b) Atomic rewrite per-establisher (lineage)**. The rewrite is scoped: only edges this establisher declared get deleted. Cross-producer concurrency is safe (Airflow declaring A→B and dbt declaring A→B both survive their respective re-ingestions). See ADR-CANDIDATE-072 for the establisher-keyed model.
- **(c) Atomic rewrite per-entity-metadata (metadata)**. The rewrite is scoped: only the entity's existing metadata-field bindings get computed for diff; bindings for OTHER entities are untouched.
- **(d) Omission = deletion**. The maintainer chose this semantic deliberately — the alternative (merge: only add new, never remove) would prevent the platform from ever cleaning up stale relations. The cost: a collector bug that emits incomplete payload silently erases state.

The rejected alternatives:

- **(alt1)** Merge (only add new): would accumulate stale lineage edges and metadata fields forever; no producer-driven cleanup. Operator must manually clean.
- **(alt2)** Mark-then-sweep (mark edges as "tentative" on new ingestion, sweep tentative edges after N minutes if not re-confirmed): complex state machine; introduces eventual-consistency anomalies in the UI.
- **(alt3)** Explicit DELETE actions in payload (collectors send explicit `{add: [...], delete: [...]}` lists): pushes the diff computation to the collector side; couples collector implementation to platform's storage model.

**Wisdom test (3-question)**:
1. *Intentional?* YES — the verb `replace` in the service method name, the explicit `SetUtils.difference(...).toSet()` followed by `delete(...)` in the processor, the dedicated `batchDeleteByEstablisherOddrn` repository primitive — all encode the intent. The maintainer COULD have called it `mergeLineagePaths` or `appendLineagePaths` and used INSERT-ON-CONFLICT-DO-NOTHING semantics; the chosen verb and primitive shape are the architectural commit.
2. *Structural impact?* YES — affects the collector contract (operators MUST understand the replace semantics or risk silent data loss), the ingestion processor architecture (the metadata processor's diff-compute logic is structurally distinct from the lineage processor's per-establisher rewrite, but both encode the same contract), the data integrity model (no orphan edges, no stale metadata — at the cost of collector-side incomplete-payload risk).
3. *Refactoring or structural?* STRUCTURAL — switching to merge semantics or mark-then-sweep would require redesigning the processor chain, the collector documentation, and the operator's mental model of "what does re-ingestion do?" Multi-layer change.
→ ADR-CANDIDATE.

**Evidence**:
- `IngestionService.md` says: "LineageIngestionRequestProcessor.java:17 (`lineageService.replaceLineagePaths(request.getLineageRelations()).then()` — verb is `replace`, not `merge`) + MetadataIngestionRequestProcessor.java:72-74 (`bindingsToDelete = existingMetadataBindings.difference(currentBindings)`) + MetadataIngestionRequestProcessor.java:76-80 (the difference is passed to `delete(bindingsToDelete)` in the same transaction)"
- `LineageServiceImpl.md` says: "`@ReactiveTransactional public Flux<LineagePojo> replaceLineagePaths(final List<LineagePojo> pojos) { final Set<String> establishers = pojos.stream().map(LineagePojo::getEstablisherOddrn).collect(Collectors.toSet()); return lineageRepository.batchDeleteByEstablisherOddrn(establishers).thenMany(lineageRepository.batchInsertLineages(pojos)); }`"
- intent_anchor: "The alternative (merge semantics — only add new, never remove) would require zero code changes to the read path but the maintainer chose REPLACE"

**Existing ADR**: composes with:
- **ADR-CANDIDATE-072** (Establisher-keyed lineage edge provenance) — the schema-side counterpart; this ADR is the contract-side statement. Together they describe the cross-producer non-destructive rewrite model.
- **ADR-CANDIDATE-067** (`@ReactiveTransactional` boundary asymmetry) — replaceLineagePaths runs INSIDE one transactional boundary; the atomic-rewrite contract requires the delete + insert to be atomic.
- **ADR-CANDIDATE-079** (Three-phase ingestion processor chain) — both `LineageIngestionRequestProcessor` and `MetadataIngestionRequestProcessor` are MAIN-phase processors; both run inside the outer `IngestionServiceImpl.ingest` transaction.
- **ADR-CANDIDATE-080** (Principal-naive ingestion service) — the collector-asserts-payload-truth stance composes with the replace semantics: the collector OWNS the declared state.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-258 (NEW — silent metadata-delete-on-absence: re-ingesting an entity with a partial metadata set silently DELETES the omitted fields with no log.warn on the delete path).
- REFACTOR-259 (NEW — silent lineage-edge-deletion-on-absence: re-ingesting an entity with a partial source/target list silently DELETES the omitted lineage edges via `replaceLineagePaths`).
- REFACTOR-275 (NEW — `replaceLineagePaths` empty-input no-op without early return — two wasted DB round-trips for empty payload).

**Proposed action**: Promote to `adrs/drafts/replace-not-merge-collector-contract.md`. Document:
- The REPLACE-NOT-MERGE contract for lineage edges and metadata fields.
- The per-establisher scoping for lineage (cross-producer-safe).
- The per-entity scoping for metadata (other entities' metadata untouched).
- The "omission = deletion" semantic and its consequence (collector bugs silently erase state).
- The rejected alternatives (merge, mark-then-sweep, explicit-DELETE-actions).
- The CRITICAL operator-facing UX: collectors MUST emit complete state every call. The live docs (`/configuration-and-deployment/collectors`) MUST surface this contract explicitly — a single sentence ("ODD treats every ingestion as the AUTHORITATIVE complete state for the entity's lineage and metadata from this datasource; omitting a previously-emitted edge or metadata field will DELETE it") prevents an entire class of incident reports.
- The activity-feed consequence: deletions via this contract are NOT audit-logged (per `IngestionService.md:bugs_limitations_corner_cases[0..1]`); operators investigating "where did this metadata go?" cannot reconstruct from running-platform logs.
- Cross-link with ADR-CANDIDATE-072, ADR-CANDIDATE-067, ADR-CANDIDATE-079, ADR-CANDIDATE-080.

**Severity rationale**: HIGH — load-bearing collector contract. Every collector relies on understanding this contract. Operator deployments that don't surface the contract in collector docs accept the silent-data-loss risk on collector-bug paths. The consequence chain shapes the platform's data-integrity model on EVERY ingestion call.

---

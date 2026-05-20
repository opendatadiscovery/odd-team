## ADR-CANDIDATE-081 — JOB_RUN entities are events, not state — separated at the top of the persistence flow into a parallel `IngestionTaskRun` path, persisted to `data_entity_task_run` (separate table from `data_entity`), bypassing ODDRN-dedup

**Severity**: HIGH
**Classification**: promote (unique-load-bearing)
**Support count**: 1 sidecar (IngestionService — primary source); the split exists across `data_entity_task_run` schema + dedicated TaskRunIngestionRequestProcessor
**Axes present**: services, repositories, schema

**Surfaced by**:
- `IngestionService.md:implicit_adrs[3]` ("JOB_RUN entities are separated from the entity-upsert path and routed through a parallel `IngestionTaskRun` flow. The SEPARATION of JOB_RUN from other entity types at the very top of the persistence flow (before `dataEntityRepository.listByOddrns` even fires) means task-runs are NOT subject to ODDRN-dedup at the `data_entity` table — instead they're persisted to `data_entity_task_run` (a separate table, separate processor). This is a deliberate 'task runs are events, entities are state' separation.")

**Decision statement**: ODD's data model treats **JOB_RUN entities as events, not state**, and the persistence pipeline reflects this distinction at the top of the ingestion flow. Inside `IngestionServiceImpl.persistDataEntities` (lines 81-152), the inbound entity list is **split** before any `data_entity` write happens:

```java
// IngestionServiceImpl.java:84 — filter out JOB_RUN from the entity-upsert path
.filter(d -> !d.getType().equals(JOB_RUN))

// IngestionServiceImpl.java:88-91 — separate filter() pulls JOB_RUN to its own list
.filter(d -> d.getType().equals(JOB_RUN))
.collectList()
.map(taskRuns -> taskRuns.stream().map(IngestionMapper::mapTaskRun).toList())
```

The two paths diverge:

- **`data_entity` path** (everything except JOB_RUN): the entity list goes through `listByOddrns` → partition new-vs-existing → `bulkUpdate` + `bulkCreate` + `restoreDeletedDataEntityRelations`. ODDRN is the dedup key; the same (datasource, name) tuple writes ONE row. Status mutations are soft-delete-tracked.
- **`data_entity_task_run` path** (JOB_RUN only): the list flows directly through `TaskRunIngestionRequestProcessor` (the only MAIN-phase processor that touches this table). Each task-run is INSERTED as a new row; ODDRN is NOT a dedup key; the same job re-running creates multiple rows. There is no soft-delete; task-runs accumulate.

The decision codifies:

- **(a) Entities vs events — different storage shapes**. Entities have lifecycle (CREATED → STABLE → ARCHIVED → DELETED), are unique-by-ODDRN, are soft-delete-tracked, are searchable, are subject to lineage. Events have NO lifecycle (a job run either succeeded or failed and is immutable post-creation), accumulate over time (history matters), are NOT subject to ODDRN-dedup, and have their own retention policy via `DataEntityHousekeepingJob`.
- **(b) Schema-level separation**. `data_entity` and `data_entity_task_run` are SEPARATE tables, NOT a discriminator-column union. The DB-level boundary mirrors the conceptual boundary.
- **(c) Top-of-flow split**. The separation happens at line 84 (filter OUT JOB_RUN from the upsert path) + line 89 (filter IN to the task-run path), BEFORE any `data_entity` write. The split is the FIRST thing the persistence flow does on the inbound entity list. A maintainer adding entity-type-specific behaviour to the upsert path has the JOB_RUN exclusion as a hard precondition.
- **(d) Processor-chain consequence**. JOB_RUN entities have ONE dedicated processor (`TaskRunIngestionRequestProcessor` at MAIN-phase). The other 13 processors operate on non-JOB_RUN entities. The processor chain (per ADR-CANDIDATE-079) implicitly preserves this split via the per-processor `shouldProcess` predicates.

The rejected alternatives:

- **(alt1)** ODDRN-dedup on JOB_RUN: would collapse all runs of the same job into ONE row, losing run history. Incompatible with the "events" model.
- **(alt2)** Discriminator column on `data_entity` with type-specific behaviour: would require nullable columns for run-specific fields (start_time, end_time, status_code, log_link) on every entity row; would complicate every read query with type-aware filtering; would conflate two different lifecycle models.
- **(alt3)** Single-table-inheritance via Postgres inheritance: feasible but adds index-management complexity; the maintainer chose schema-level table separation as simpler.

**Wisdom test (3-question)**:
1. *Intentional?* YES — the explicit JOB_RUN check appears TWICE at adjacent positions (lines 84, 89), the separation happens BEFORE any `data_entity` read or write, the dedicated `data_entity_task_run` table is a deliberate schema choice, the dedicated `TaskRunIngestionRequestProcessor` is the only processor that touches the task-run table. The pattern is structurally and verbally explicit.
2. *Structural impact?* YES — affects the data model (two tables), the ingestion flow (two paths), the read paths (task-runs have their own listing endpoints), the housekeeping policy (different retention), and the lineage model (task-runs are not nodes in the lineage graph — they're causal-EVIDENCE of lineage edges established by their JOB entity).
3. *Refactoring or structural?* STRUCTURAL — collapsing the two tables, removing the JOB_RUN check, or changing the dedup semantics would require schema rewrites, processor-chain redesign, and a fundamental rethink of the entity-vs-event distinction. Not a refactor.
→ ADR-CANDIDATE.

**Evidence**:
- `IngestionService.md` says: "IngestionServiceImpl.java:49 (`import ... DataEntityType.JOB_RUN`) + IngestionServiceImpl.java:84 (`filter(d -> !d.getType().equals(JOB_RUN))`) + IngestionServiceImpl.java:88-91 (separate `filter(d -> d.getType().equals(JOB_RUN))` path → `mapTaskRun`) + TaskRunIngestionRequestProcessor.java (the consumer of the IngestionTaskRun list)"
- intent_anchor: "the SEPARATION of JOB_RUN from other entity types at the very top of the persistence flow (before `dataEntityRepository.listByOddrns` even fires)"

**Existing ADR**: composes with:
- **ADR-CANDIDATE-058** (data-entity status state machine + soft-delete-as-state) — JOB_RUN is the EXCEPTION to this ADR's lifecycle model; the two ADRs together describe the full entity-vs-event split.
- **ADR-CANDIDATE-068** (two-tier soft-delete inheritance taxonomy) — JOB_RUN bypasses soft-delete entirely; reinforces that the soft-delete architecture is for ENTITY tables, not EVENT tables.
- **ADR-CANDIDATE-069** (edge tables hard-delete by design) — `data_entity_task_run` is ALSO hard-delete-by-design (via TTL housekeeping); the two together describe the project's "events and edges are hard-delete; entities and named-things are soft-delete" model.
- **ADR-CANDIDATE-079** (three-phase ingestion processor chain) — TaskRunIngestionRequestProcessor is one of the 9 MAIN-phase processors; the chain orchestration handles JOB_RUN via the dedicated processor.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- Housekeeping retention concerns for `data_entity_task_run` would compose with existing REFACTOR-085 (no activity retention) family if not already covered.
- No new gap mints from this ADR — it's primarily a positive architectural decision; the consequence chain is well-managed.

**Proposed action**: Promote to `adrs/drafts/job-run-entities-as-events.md`. Document:
- The entity-vs-event distinction at the data model level.
- The top-of-flow split (filter at lines 84 + 89, before any data_entity write).
- The schema-level separation (`data_entity` vs `data_entity_task_run`).
- The dedicated TaskRunIngestionRequestProcessor as the only entity-type-specific processor.
- The housekeeping policy (TTL-based hard-delete via `DataEntityHousekeepingJob`).
- The lineage consequence: task-runs are not lineage nodes; the underlying JOB entity is.
- The rejected alternatives and their costs.
- Cross-link with ADR-CANDIDATE-058, ADR-CANDIDATE-068, ADR-CANDIDATE-069, ADR-CANDIDATE-079.

**Severity rationale**: HIGH — load-bearing architectural decision for the entire data model. Every collector that emits job-run history relies on this; every UI that displays job-run timelines relies on the separate table; every housekeeping job that prunes task-runs relies on the dedicated table model. Compatibility-change calculus for future maintainers depends on understanding the entity-vs-event split.

---

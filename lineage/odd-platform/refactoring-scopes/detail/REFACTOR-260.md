## REFACTOR-260 — Soft-delete-restore-on-re-ingestion happens SILENTLY: no log, no activity event; operators who soft-deleted entities have them silently resurface

**Severity**: MEDIUM
**Category**: silent-feature-ignored + missing-audit
**Surfaced by**:
- `IngestionService.md:bugs_limitations_corner_cases[3]`
- `IngestionService.md:security.known_security_gaps[3]`

**Description**: `IngestionServiceImpl.persistDataEntities` (lines 127-136) checks if any inbound entity has a previous version with `getStatus() == DELETED.getId()`. If yes, the entity is UN-ARCHIVED and its relations are RESTORED inside the ingestion transaction (`dataEntityInternalStateService.restoreDeletedDataEntityRelations(entitiesToRestore)`). The restore proceeds without:
- A `log.info` record of "entity X was restored from soft-delete state".
- An activity-feed event (`ActivityIngestionRequestProcessor.java:24-32` only emits `DATA_ENTITY_CREATED` for `request.getNewIds()`, NOT for restored entities — restored entities live in `existingEntities`).
- An operator-visible signal of any kind.

The consequence:
- An operator who soft-deleted an entity (via UI admin → DELETE) to make it disappear from search expects it to STAY deleted.
- The collector continues to scan its source (which hasn't been updated to skip the deleted entity) and re-ingests the entity on the next tick.
- The entity silently UN-DELETES. The operator is unaware.
- The entity reappears in search, lineage, the catalog discovery surface — possibly leaking sensitive data the operator thought was retired.

The COUPLING is not signposted anywhere: the operator who soft-deletes via UI is not told "you must also remove the entity from the upstream collector's source, or it will return on the next ingestion." This is a documentation gap layered on a code-visibility gap.

Compounding factors:
- A malicious actor with collector-write access (in filter-OFF default, ANY caller; in filter-ON, anyone with a valid token) can repeatedly resurrect entities the admin tried to remove.
- The audit trail doesn't record the resurrection (REFACTOR-264 family confirms ingestion-driven CHANGES go unaudited).

**Primary source citations**:
- `IngestionServiceImpl.java:127-131` — the restore-on-DELETED-status branch
- `IngestionServiceImpl.java:135-136` — the call to `restoreDeletedDataEntityRelations`
- `ActivityIngestionRequestProcessor.java:24-37` — confirms only NEW entities emit activity events; restored entities are excluded (`request.getNewIds()` only)
- composes with ADR-CANDIDATE-058 (soft-delete-as-state — restore IS legitimate within the state machine), REFACTOR-185 (DISABLED-mode bypass), REFACTOR-264 (ingestion audit gap)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-058 codifies "DELETED is a state, not a row removal; status transitions are settable via PUT". The restore via ingestion-re-discovery IS within the state machine's allowed transitions. The ADR does NOT defend against silent restore — it's a legitimate state transition that lacks audit emission. The fix is refactoring within the existing structure (add observability) without changing the state machine.

**Proposed remedy**: Three composable fixes:
1. **`log.info` on the restore branch** at line 130-135: `log.info("Restoring {} soft-deleted entities from re-ingestion (datasource {})", entitiesToRestore.size(), dataSourceOddrn)`. Surfaces the restore in the application log.
2. **Activity-feed emission**: extend `ActivityIngestionRequestProcessor` to emit `DATA_ENTITY_RESTORED` (a new event type) for each entity in `entitiesToRestore`. Surfaces in the audit trail.
3. **Doc-side enforcement**: update the live `/features/data-discovery/statuses` page (which documents the DELETED state per ADR-CANDIDATE-058) to explicitly warn: "Soft-deleted entities will be RESTORED by the next ingestion that re-discovers them. To permanently remove an entity, both (a) remove it from the upstream collector's source AND (b) wait for the housekeeping TTL (default 30 days) to purge it." The coupling is real; the doc must surface it.

**Severity rationale**: MEDIUM — silent state-machine transition that contradicts operator intent. Less severe than REFACTOR-258/259 (no data loss — the restore is reversible by re-deleting + fixing the collector) but operator-visible-surprise compounds with the no-audit gap.

**Suggested backlog grouping**: `Ingestion observability sprint` — pair with REFACTOR-258, REFACTOR-259, REFACTOR-261, REFACTOR-264. Also pair with `Soft-delete UX sprint` for the doc-side fix.

---

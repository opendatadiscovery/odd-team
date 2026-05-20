## REFACTOR-264 — Activity log on ingestion only records CREATEs, not UPDATEs; ingestion-driven changes to existing entities (description, type, classes, specific attributes) are invisible in the audit trail

**Severity**: MEDIUM
**Category**: missing-audit
**Surfaced by**:
- `IngestionService.md:bugs_limitations_corner_cases[11]`
- `IngestionService.md:security.known_security_gaps[5]`

**Description**: `ActivityIngestionRequestProcessor.process` (lines 24-37) emits `DATA_ENTITY_CREATED` activity events only for `request.getNewIds()` (line 27). The `request.getNewIds()` set is populated by `IngestionServiceImpl.persistDataEntities` to contain ONLY entities that hit the `bulkCreate(pojosToCreate)` branch — i.e. truly new entities, not those that hit `bulkUpdate(entitiesToUpdate)` or `restoreDeletedDataEntityRelations(entitiesToRestore)`.

The processor's `shouldProcess` (line 36-37) is `isNotEmpty(request.getNewEntities())` — only fires when at least one new entity exists. If a collector tick re-ingests N existing entities with CHANGED descriptions / types / classes / specific-attributes, the processor sees `getNewEntities().isEmpty() → true` and shouldProcess returns false. ZERO activity events are emitted for the update.

The consequence: the activity feed is an INCOMPLETE audit trail for ingestion-driven changes. It answers "when was this entity first ingested?" but NOT:
- "When did the collector change this entity's description?"
- "When did the collector change this entity's type from TABLE to VIEW?"
- "When did the collector add/remove entity classes?"
- "When did the specific-attributes JSON change?"

User-driven changes (via the UI's description-edit / status-change endpoints) DO emit activity events. Ingestion-driven changes to the SAME entity DO NOT. The audit-trail completeness depends on the source of the mutation — which is exactly the wrong contract: operators investigating "who changed this entity's description?" cannot get a complete answer because half the changes are invisible.

A compromised collector that subtly alters entity descriptions or specific attributes goes undetected — there's no activity row for the modification, no log entry (per IngestionServiceImpl @Slf4j-zero-log-calls), no operator-visible signal.

**Primary source citations**:
- `ActivityIngestionRequestProcessor.java:24-37` — only `request.getNewIds()` consumed; only `DATA_ENTITY_CREATED` emitted
- `ActivityIngestionRequestProcessor.java:36-37` — `shouldProcess` returns `isNotEmpty(request.getNewEntities())` → ingestion-only-updates skip this processor entirely
- `IngestionServiceImpl.java:127-136` — restored entities are NOT in `getNewIds()`
- contrast with the @ActivityLog-annotated user-driven paths (`OwnershipServiceImpl.create`, `DataEntityServiceImpl.upsertBusinessName`, etc.) — they DO emit on every call
- composes with REFACTOR-258 (silent metadata-delete on absence), REFACTOR-259 (silent lineage-deletion on absence), REFACTOR-260 (silent restore)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-021 (activity-feed cursor pagination + global readability) is the architectural intent — activity events are platform-wide audit data. The maintainer's choice to only audit CREATEs (not UPDATEs) at the ingestion path is part of the per-mutation curation (per ADR-CANDIDATE-060 + DataEntityServiceImpl.md:implicit_adrs[3]'s "per-mutation curation" finding). The gap is whether UPDATEs SHOULD be audited; for compliance / forensic-reconstruction the answer is yes.

**Proposed remedy**: Two composable fixes:
1. **Detect updates and emit per-entity events**:
   - Extend the processor's logic to compute `updatedEntities = entitiesToUpdate.minus(noOpUpdates)` — only emit for entities where SOMETHING changed.
   - Define a new activity event type `DATA_ENTITY_INGESTION_UPDATED` with a payload field listing the changed fields.
   - The handler captures (entity_id, changed_fields_list) for the audit row.
2. **Doc-side enforcement**: update the live `/configuration-and-deployment/collectors` page to surface the audit-completeness story — operators investigating ingestion-driven changes need to know which events ARE auditable.

Option (1) increases activity-table write volume; per ADR-CANDIDATE-021 the table is partitioned (per ADR-CANDIDATE-028); the additional load is bounded by the ingestion rate. Compound with REFACTOR-085 (no activity retention) — the activity table's TTL gap may need addressing first.

**Severity rationale**: MEDIUM — operator-visible audit gap. Compounds with REFACTOR-258 / -259 / -260 (silent destructive operations) — the activity-feed-incompleteness layered on the silent-destruction is the LSN-001-shape failure mode.

**Suggested backlog grouping**: `Ingestion observability sprint` — pair with REFACTOR-258, REFACTOR-259, REFACTOR-260, REFACTOR-261, REFACTOR-262. All five together close the operator-visibility gap on ingestion.

---

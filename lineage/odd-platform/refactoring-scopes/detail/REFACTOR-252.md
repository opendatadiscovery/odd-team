## REFACTOR-252 — DEG-membership mutations (`addDataEntityToDEG`, `deleteDataEntityFromDEG`) emit NO activity event at any layer — audit-trail gap for lineage-grouping changes

**Severity**: MEDIUM
**Category**: missing-audit
**Surfaced by**:
- `DataEntityServiceImpl.md:bugs_limitations_corner_cases[3]`
- `DataEntityServiceImpl.md:implicit_adrs[3]` ("activity-event sparseness — only 2 of 8 mutating methods carry @ActivityLog directly")
- `DataEntityServiceImpl.md:security.known_security_gaps[2]` ("`addDataEntityToDEG` / `deleteDataEntityFromDEG` are NOT audit-logged")

**Description**: `DataEntityServiceImpl.addDataEntityToDEG` (lines 388-408) and `DataEntityServiceImpl.deleteDataEntityFromDEG` (lines 410-438) are the platform's per-data-entity DEG-membership mutation paths. Both methods carry the SECURITY_RULES permissions (`DATA_ENTITY_GROUP_UPDATE` / `DATA_ENTITY_GROUP_DELETE` per ADR-CANDIDATE-002) but emit ZERO activity-feed events:
- No `@ActivityLog` annotation at the controller layer.
- No `@ActivityLog` annotation at this service layer.
- No `@ActivityLog` annotation at any downstream service.
- No programmatic activity emission via `activityService.createActivityEvent(...)`.

The activity-feed `/api/activity` (per ADR-CANDIDATE-021 + REFACTOR-053) records every other auditable mutation on the platform: description updates, business-name updates, tag assignments, status changes, ownership creates, etc. The DEG-membership mutations are conspicuously absent — the activity table has NO trail for "data entity X was added to DEG Y on date Z by user W" or "data entity X was removed from DEG Y on date Z by user W."

The operator-visible consequence:
- A user with `DATA_ENTITY_GROUP_UPDATE` permission can re-organise lineage groupings (move entities between DEGs to hide ownership trails, move sensitive entities into less-protected DEGs, or simply shuffle the lineage view) with NO RECORD in the activity feed.
- A security-incident reviewer investigating "who moved entity X into the publicly-visible DEG?" cannot answer from running-platform logs.
- A user investigating "why did this entity disappear from the DEG view?" cannot find the audit row.

Compounding with the @Slf4j-but-zero-log-calls pattern (per DataEntityServiceImpl.md:bugs_limitations_corner_cases[7] + REFACTOR-244 family), the entire DEG-membership-mutation surface is FORENSICALLY DARK.

**Primary source citations**:
- `DataEntityServiceImpl.java:388-408` — `addDataEntityToDEG` (no @ActivityLog)
- `DataEntityServiceImpl.java:410-438` — `deleteDataEntityFromDEG` (no @ActivityLog)
- grep `@ActivityLog` on `DataEntityServiceImpl.java` → 2 hits at lines 336 + 358 (`upsertBusinessName`, `upsertTags`); ZERO on DEG methods
- contrast with `DataEntityInternalStateServiceImpl.java:54-71` — description has @ActivityLog downstream; DEG does not
- contrast with `OwnershipServiceImpl.java:48` — `@ActivityLog(OWNERSHIP_CREATED)`; DEG-membership has no equivalent

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-021 (activity-feed cursor pagination + global readability) is the architectural intent. The ADR does NOT say "every mutation is audited" — the activity-feed is per-mutation opt-in (per ADR-CANDIDATE-060 + DataEntityServiceImpl.md:implicit_adrs[3]'s "per-mutation curation" finding). The gap is whether DEG-membership SHOULD be audited; the maintainer's curation choice today is "no." The fix is per-mutation: add `@ActivityLog(DATA_ENTITY_GROUP_MEMBER_ADDED)` and `@ActivityLog(DATA_ENTITY_GROUP_MEMBER_REMOVED)` annotations + corresponding handlers.

**Proposed remedy**: Three composable fixes:
1. **Define the activity-event constants**: add `DATA_ENTITY_GROUP_MEMBER_ADDED` and `DATA_ENTITY_GROUP_MEMBER_REMOVED` to the `ActivityEventTypeDto` enum.
2. **Implement the activity handlers**: write `DataEntityGroupMemberAddedActivityHandler` and `DataEntityGroupMemberRemovedActivityHandler` (per the pattern of `OwnershipCreatedActivityHandler` / `AlertStatusUpdatedHandler`). The handler captures the (DEG-id, member-id) tuple in the `state` field.
3. **Add `@ActivityLog` annotations**: annotate `addDataEntityToDEG` and `deleteDataEntityFromDEG` at lines 388 and 411 with the new event types. The `@ActivityParameter` on the `dataEntityId` arg + a new parameter on the DEG-id arg lets the handler capture both.

Doc companion: the live `/features/data-discovery/data-entity-groups` page should mention that DEG-membership changes are auditable (after the fix) and surface in the activity feed.

**Severity rationale**: MEDIUM — operator-visible audit gap. Less severe than REFACTOR-188 (RBAC mutations no audit) because DEG-membership is a less-sensitive surface, but the audit-trail completeness gap is real. Compounds with REFACTOR-188 + REFACTOR-244 (cross-tier observability silence) — the platform's audit story has multiple holes that together degrade incident-response capability.

**Suggested backlog grouping**: `Audit completeness sprint` — pair with REFACTOR-188 (RBAC audit), REFACTOR-253 (metadata audit), REFACTOR-264 (ingestion-driven update audit). The set together closes the audit-trail holes.

---

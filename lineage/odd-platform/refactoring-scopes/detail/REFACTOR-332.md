## REFACTOR-332 — DEG membership flips (add/delete) emit NO activity event despite `DATA_ENTITY_RELATION_UPDATED` enum existing in `ActivityEventTypeDto` — dead-enum gap; forensic silence on per-entity organisational mutations

**Severity**: MEDIUM
**Category**: missing-audit (cross-cutting; cross-batch with batch-I @ActivityLog AOP traps + batch-K OwnershipServiceImpl.propagateOwnership cascade gap)
**Pillars affected**: [P-07-active-platform-features, P-09-security-access-control, P-01-data-discovery]
**Batch**: L (2026-05-19)

**Surfaced by**:
- `odd-platform__java__DataEntityController__controller-method__addDataEntityDataEntityGroup.md:bugs_limitations_corner_cases.[0]` (MEDIUM) — "Forensic silence on DEG membership changes — `addDataEntityToDEG` (`DataEntityServiceImpl.java:387-408`) carries NO `@ActivityLog` annotation despite (a) the matching enum value `ActivityEventTypeDto.DATA_ENTITY_RELATION_UPDATED` existing at `ActivityEventTypeDto.java:12`, (b) every other write surface on this controller emitting activity (`upsertTags` line 358, `upsertBusinessName` line 239, `updateStatus` line 198, `addDataEntityTerm` line 153 via TermService), (c) the matching DELETE path (`deleteDataEntityFromDEG` lines 411-438) ALSO carrying no `@ActivityLog`"
- `odd-platform__java__DataEntityController__controller-method__addDataEntityDataEntityGroup.md:bugs_limitations_corner_cases.[7]` (LOW) — "`DATA_ENTITY_RELATION_UPDATED` enum value is dead code (or reserved-but-unwired) — `ActivityEventTypeDto.java:12` declares the value, but no `@ActivityLog(event = DATA_ENTITY_RELATION_UPDATED)` references it anywhere in the codebase. `grep -rln 'DATA_ENTITY_RELATION_UPDATED' <odd-platform-repo>/odd-platform-api/src/main/java` returns ONLY the enum-declaration line itself. The semantically-natural consumer is THIS endpoint (and its delete counterpart)"
- `odd-platform__java__DataEntityController__controller-method__deleteDataEntityFromDataEntityGroup.md:bugs_limitations_corner_cases.[0]` (MEDIUM) — "Activity-feed absence for DEG membership flips — neither `addDataEntityToDEG` nor `deleteDataEntityFromDEG` is annotated with `@ActivityLog`. The `ActivityEventTypeDto` enum has `CUSTOM_GROUP_CREATED`, `CUSTOM_GROUP_UPDATED`, `OWNERSHIP_CREATED`, ..., `DATA_ENTITY_RELATION_UPDATED` (lineage edges) — but NO event for per-entity-DEG membership change. An operator querying `GET /api/dataentities/{id}/activity` to answer 'who added this entity to the Finance domain?' or 'when was this entity removed from Revenue?' gets no answer"

**Description**: Neither `addDataEntityToDEG` (`DataEntityServiceImpl.java:387-408`) nor `deleteDataEntityFromDEG` (`:411-438`) carries an `@ActivityLog` annotation. Every OTHER per-data-entity write surface on the same controller — `upsertTags` (line 358, `TAG_ASSIGNMENT_UPDATED`), `upsertBusinessName` (line 239, `BUSINESS_NAME_UPDATED`), `updateStatus` (line 198, `DATA_ENTITY_STATUS_UPDATED`), `addDataEntityTerm` (line 153 via TermService, `TERM_ASSIGNMENT_UPDATED`), `createOwnership` (`OWNERSHIP_CREATED`) — DOES emit activity. The `ActivityEventTypeDto.DATA_ENTITY_RELATION_UPDATED` enum value exists at line 12 of `ActivityEventTypeDto.java` and is the semantically-natural consumer for membership flips. A grep across `odd-platform-api/src/main/java` for `DATA_ENTITY_RELATION_UPDATED` returns ONLY the enum declaration line — the value is dead code (or reserved-but-unwired).

The architectural consequence: an operator auditing 'who placed entity X into the Finance Domain on date Z' through `ActivityController.getActivity` (cross-ref batch-B) sees NOTHING. The activity feed is the documented audit surface for entity changes; DEG membership is a meaningful organisational change that the audit surface silently omits. The cross-pillar implication: P-07's activity-feed substrate covers entity-side metadata changes (description, ownership, tags, terms, status) but DOES NOT cover the per-entity ↔ DEG binding. Combined with **REFACTOR-331** (write-collaborative DEG — any holder can pollute any DEG), the failure mode is: drive-by DEG pollution that the DEG owner cannot reconstruct, cannot defend against, and cannot forensically detect.

The forensic silence is part of a broader pattern across batches:
- **F-006** (batch E + F): RBAC mutations (Role/Policy/Owner create) emit no activity events.
- **OwnershipServiceImpl.propagateOwnership cascade** (batch K, REFACTOR-NNN): DEG-children ownership propagation is unaudited below the parent.
- **CUSTOM_METADATA_* events** (batch L `upsertDataEntityMetadataFieldValue`): three enum values reserved (`CUSTOM_METADATA_CREATED`, `CUSTOM_METADATA_UPDATED`, `CUSTOM_METADATA_DELETED`) — none fired by the corresponding service methods (cross-link REFACTOR-337).
- **THIS scope** (DEG membership ADD/DELETE).

Five reserved-but-never-fired enum slots; the audit story has multiple consistent gaps where the enum infrastructure was scaffolded but the handler-wiring was never completed.

**Primary source citations**:
- `DataEntityServiceImpl.java:387-408` (no `@ActivityLog` on `addDataEntityToDEG`)
- `DataEntityServiceImpl.java:411-438` (no `@ActivityLog` on `deleteDataEntityFromDEG`)
- `ActivityEventTypeDto.java:12` (`DATA_ENTITY_RELATION_UPDATED` enum value)
- grep `DATA_ENTITY_RELATION_UPDATED` across `odd-platform-api/src/main/java` returns only the declaration line
- `DataEntityServiceImpl.java:358, 198, 239, 153` (sibling methods WITH `@ActivityLog`)
- `documentation/docs/data-discovery/groups-domains.md` (silent on activity-feed coverage)

**Existing-ADR-or-implied-prescription**: **ADR-CANDIDATE-088** (Activity feed cursor pagination — established the activity feed as the audit surface). **ADR-CANDIDATE-113 NEW batch L** (DEG no-auto-create-on-miss — endorses DEG as first-class entity); the manually-created discipline does not extend to audit-trail. The implied prescription is that every per-data-entity mutation surface emits a corresponding activity event; the gap is the missing `@ActivityLog` annotations on the two membership methods.

**Proposed remedy**: Add `@ActivityLog(event = DATA_ENTITY_RELATION_UPDATED)` to both `addDataEntityToDEG` and `deleteDataEntityFromDEG` in `DataEntityServiceImpl.java`. Implement a corresponding `DataEntityRelationActivityHandler` that captures BEFORE/AFTER membership-list state per data-entity (parallel shape to `TermAssignmentActivityHandler`). Pair with REFACTOR-337 (CUSTOM_METADATA_* enum + missing-annotations) for a cohesive "reserved-but-never-fired enum cleanup" sprint. The cost is one handler-class plus 2 annotations + the per-call BEFORE/AFTER read overhead (parallel to TermAssignmentActivityHandler's 2× `getDataEntityTerms` reads — REFACTOR-228); acceptable for write paths. Watch for the `@Profile("!integration-test")` AOP trap (batch I AlertServiceImpl finding) — the activity-handler-AOP must run under test profiles or the assertion would not detect regressions.

**Severity rationale**: MEDIUM — operationally significant audit gap; compliance-minded operators noticing the gap on first investigation of "who added this entity to my domain?" The DEG-membership-without-audit pairs with REFACTOR-331 (DEG-membership-without-DEG-side-auth) for the compound impact. Not HIGH because the absence does not enable a new attack — it just silences forensic reconstruction; with the auth gap fixed (REFACTOR-331) and audit fixed (this scope), the surface is clean.

**Suggested backlog grouping**: `Activity-feed enum-cleanup sprint` (group with REFACTOR-337 for CUSTOM_METADATA_* + cross-batch with OwnershipServiceImpl.propagateOwnership cascade audit + F-006 RBAC mutations audit). Pair with REFACTOR-331 (the auth half of the DEG cluster).

---

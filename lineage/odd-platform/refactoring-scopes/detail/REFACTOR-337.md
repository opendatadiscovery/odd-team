## REFACTOR-337 — `upsertDataEntityMetadataFieldValue` / `createMetadata` / `deleteMetadata` carry NO `@ActivityLog` despite three matching enum slots (`CUSTOM_METADATA_CREATED` / `CUSTOM_METADATA_UPDATED` / `CUSTOM_METADATA_DELETED`) existing in `ActivityEventTypeDto` — reserved-but-never-fired enum trio; activity-feed shows zero record of metadata mutations

**Severity**: MEDIUM
**Category**: missing-audit
**Pillars affected**: [P-07-active-platform-features, P-01-data-discovery]
**Batch**: L (2026-05-19)

**Surfaced by**:
- `odd-platform__java__DataEntityController__controller-method__upsertDataEntityMetadataFieldValue.md:bugs_limitations_corner_cases.[5]` (MEDIUM) — "No `@ActivityLog` annotation — `upsertMetadataFieldValue` lacks the `@ActivityLog(event = CUSTOM_METADATA_UPDATED)` annotation despite the `CUSTOM_METADATA_UPDATED` enum value existing in `ActivityEventTypeDto.java:18`. Contrast with `upsertBusinessName` (`DataEntityServiceImpl.java:336` has `@ActivityLog(event = BUSINESS_NAME_UPDATED)`) and `upsertTags` (line 358 has `@ActivityLog(event = TAG_ASSIGNMENT_UPDATED)`). The activity feed therefore shows zero record of metadata updates; the `CUSTOM_METADATA_CREATED` (`ActivityEventTypeDto.java:17`), `CUSTOM_METADATA_UPDATED` (line 18), and `CUSTOM_METADATA_DELETED` (line 19) enum values are reserved-but-never-fired by these methods (`createMetadata` at line 245 and `deleteMetadata` at line 307 are also un-annotated)"
- `odd-platform__java__DataEntityController__controller-method__upsertDataEntityMetadataFieldValue.md:security.known_security_gaps.[1]` (MEDIUM)

**Description**: Three `ActivityEventTypeDto` enum values exist for the custom-metadata lifecycle:
- `CUSTOM_METADATA_CREATED` (`ActivityEventTypeDto.java:17`)
- `CUSTOM_METADATA_UPDATED` (`ActivityEventTypeDto.java:18`)
- `CUSTOM_METADATA_DELETED` (`ActivityEventTypeDto.java:19`)

The corresponding service methods at `DataEntityServiceImpl.java`:
- `createMetadata` (line 245) — no `@ActivityLog`
- `upsertMetadataFieldValue` (line 287) — no `@ActivityLog`
- `deleteMetadata` (line 307) — no `@ActivityLog`

Contrast: every OTHER per-data-entity write surface on this service DOES emit activity:
- `upsertBusinessName` (line 336) → `@ActivityLog(event = BUSINESS_NAME_UPDATED)`
- `upsertTags` (line 358) → `@ActivityLog(event = TAG_ASSIGNMENT_UPDATED)`
- `updateStatus` (line 198) → programmatic `logStatusChangeEvents`
- `createOwnership` → `@ActivityLog(event = OWNERSHIP_CREATED)` via OwnershipServiceImpl

A grep across `odd-platform-api/src/main/java` for `CUSTOM_METADATA_CREATED|CUSTOM_METADATA_UPDATED|CUSTOM_METADATA_DELETED` returns ONLY the three enum-declaration lines — none of the values is referenced by any annotation, programmatic emission, or handler. Three reserved-but-never-fired enum slots.

The consequence: the activity feed (`GET /api/dataentities/{id}/activity`) shows ZERO record of metadata mutations on any data entity. An operator auditing "who changed the cost_centre field on the Customers table on 2026-05-19" through the activity feed gets no answer. Custom metadata is the most-frequently-edited per-data-entity write surface (per the description-feature's usage data), and the activity feed silently omits it.

This is part of the cross-batch "reserved-but-never-fired enum cleanup" pattern:
- **REFACTOR-332** (NEW batch L): `DATA_ENTITY_RELATION_UPDATED` reserved; DEG ADD/DELETE unaudited.
- **THIS scope**: 3 CUSTOM_METADATA_* values reserved; metadata CRUD unaudited.
- **Cross-batch F-006**: RBAC mutations (Role/Policy/Owner) unaudited.
- **Cross-batch K REFACTOR-NNN**: OwnershipServiceImpl.propagateOwnership cascade unaudited.

The audit-story has multiple consistent gaps where the enum infrastructure was scaffolded but the handler-wiring was never completed. **Cross-cutting risk**: combined with the AOP @Profile("!integration-test") trap (batch I AlertServiceImpl finding) — activity-handler regressions would not be caught by tests that omit the integration profile.

**Primary source citations**:
- `DataEntityServiceImpl.java:287-305` (no `@ActivityLog` on `upsertMetadataFieldValue`)
- `DataEntityServiceImpl.java:245-280` (no `@ActivityLog` on `createMetadata`)
- `DataEntityServiceImpl.java:307-321` (no `@ActivityLog` on `deleteMetadata`)
- `ActivityEventTypeDto.java:17-19` (three reserved enum values)
- `DataEntityServiceImpl.java:336, 358, 198` (sibling methods WITH `@ActivityLog`)

**Existing-ADR-or-implied-prescription**: **ADR-CANDIDATE-088** (activity-feed cursor pagination) — the activity feed is the documented audit surface. The IMPLIED prescription is that every per-data-entity mutation surface emits a corresponding activity event; the gap is the missing annotations on 3 methods.

**Proposed remedy**: Add `@ActivityLog(event = CUSTOM_METADATA_UPDATED)` to `upsertMetadataFieldValue`, `@ActivityLog(event = CUSTOM_METADATA_CREATED)` to `createMetadata`, and `@ActivityLog(event = CUSTOM_METADATA_DELETED)` to `deleteMetadata`. Implement a corresponding `CustomMetadataActivityHandler` that captures BEFORE/AFTER state per data-entity (parallel shape to `TermAssignmentActivityHandler`). Pair with REFACTOR-332 (DEG-membership audit) for a cohesive "reserved-but-never-fired enum cleanup" sprint.

**Severity rationale**: MEDIUM — operationally significant audit gap; custom metadata is high-volume edited content. Combined with REFACTOR-336 (EXTERNAL-origin overwrite — operators cannot reconstruct fabricated source-system values without an audit trail) for compound impact. Not HIGH because the absence does not enable a new attack — it silences forensic reconstruction.

**Suggested backlog grouping**: `Activity-feed enum-cleanup sprint` (group with REFACTOR-332). Companion `TEST-NNN — pin activity-event emission across all data-entity write surfaces`.

---

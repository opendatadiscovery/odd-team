## REFACTOR-253 — Metadata mutations (`createMetadata`, `upsertMetadataFieldValue`, `deleteMetadata`) emit NO activity event at any layer — audit-trail gap for custom-metadata changes

**Severity**: MEDIUM
**Category**: missing-audit
**Surfaced by**:
- `DataEntityServiceImpl.md:bugs_limitations_corner_cases[3]`
- `DataEntityServiceImpl.md:security.known_security_gaps[3]` ("Metadata-field mutations are NOT audit-logged")

**Description**: `DataEntityServiceImpl.createMetadata` (lines 247-285), `DataEntityServiceImpl.upsertMetadataFieldValue` (lines 287-305), and `DataEntityServiceImpl.deleteMetadata` (lines 307-321) are the platform's per-data-entity custom-metadata mutation paths. All three carry `DATA_ENTITY_CUSTOM_METADATA_CREATE` / `DATA_ENTITY_CUSTOM_METADATA_UPDATE` / `DATA_ENTITY_CUSTOM_METADATA_DELETE` SECURITY_RULES permissions but emit ZERO activity-feed events:
- No `@ActivityLog` at the controller layer.
- No `@ActivityLog` at this service layer.
- No `@ActivityLog` at any downstream service.
- No programmatic activity emission.

Custom metadata is the platform's flexible-schema feature — operators attach arbitrary key/value pairs to data entities (`data_classification: PII`, `retention_days: 90`, `compliance_tag: GDPR`, `internal_codename: Project-X`). Many of these are sensitive lifecycle attributes that operators use for compliance tracking. The mutations have NO audit trail — a user with the appropriate permission can add, modify, or delete custom metadata with no record.

Operator-visible consequences:
- Compliance officers cannot reconstruct "when was the GDPR tag removed from this entity?" or "who set data_classification=PUBLIC on this entity that should be PRIVATE?"
- An incident response cannot answer "what custom metadata was on this entity before the breach?"
- A user investigating "why did this entity's retention metadata change?" cannot find the audit row.

Same shape as REFACTOR-252 (DEG-membership audit gap) — the maintainer's per-mutation curation excluded these surfaces. The gap is whether they SHOULD be audited; the answer for compliance-tracked metadata is yes.

**Primary source citations**:
- `DataEntityServiceImpl.java:247-285` — `createMetadata` (no @ActivityLog)
- `DataEntityServiceImpl.java:287-305` — `upsertMetadataFieldValue` (no @ActivityLog)
- `DataEntityServiceImpl.java:307-321` — `deleteMetadata` (no @ActivityLog)
- composes with REFACTOR-252 (DEG-membership audit gap) — same pattern, different surface

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-021 (activity-feed) is the architectural intent; per-mutation opt-in. The gap is the maintainer's curation choice. The fix is per-mutation:
1. Define `CUSTOM_METADATA_FIELD_CREATED`, `CUSTOM_METADATA_FIELD_UPDATED`, `CUSTOM_METADATA_FIELD_DELETED` events.
2. Implement handlers capturing (data-entity-id, metadata-field-name, value, optional old-value).
3. Annotate the three methods with `@ActivityLog`.

**Proposed remedy**: Three composable fixes:
1. Define event constants + handlers (same shape as the description / tag / business-name pattern).
2. Annotate the three methods.
3. Doc companion: the live `/features/custom-metadata` page (or its closest equivalent) should mention that metadata changes are auditable.

Severity higher than REFACTOR-252 because:
- Custom metadata IS the platform's compliance-tracking surface (REFACTOR-252's DEG-membership is more of a UX/organisational surface).
- The cross-owner activity-feed exposure (per REFACTOR-053) means metadata audit rows would BE READABLE by any authenticated user — which is fine for transparency but may surface concerns if metadata contains sensitive content (per `DataEntityServiceImpl.md:security.known_security_gaps[4]`).

The two effects compound: adding the audit emission improves compliance reconstruction BUT widens the cross-owner exposure of metadata-change events. The doc-side must surface this trade-off.

**Severity rationale**: MEDIUM — operator-visible compliance gap. Higher operator-pain than DEG-membership (compliance metadata is more sensitive than lineage grouping).

**Suggested backlog grouping**: `Audit completeness sprint` — pair with REFACTOR-252 (DEG audit), REFACTOR-188 (RBAC audit), REFACTOR-264 (ingestion audit). Audit-completeness is the cross-cutting theme.

---

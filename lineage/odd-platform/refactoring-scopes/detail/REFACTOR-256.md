## REFACTOR-256 — `DataEntityServiceImpl.createMetadata` duplicate-detection error message is confusingly worded (`"Metadata with this name already exists"`)

**Severity**: LOW
**Category**: ux-bug (error-message clarity)
**Surfaced by**:
- `DataEntityServiceImpl.md:bugs_limitations_corner_cases[9]`

**Description**: `DataEntityServiceImpl.createMetadata` (lines 247-285) raises `BadUserRequestException("Metadata with this name already exists")` at line 277-278 when the duplicate-detection check fires. The check itself is structurally correct (per ADR-CANDIDATE-076 — application-level invariant) but the error message text is misleading.

The actual failure: "one or more of the requested metadata field names already have a VALUE for this data entity" — the metadata field itself was successfully resolved or created (`getOrCreateMetadataFields` succeeded earlier in the chain). The exception fires because the (data-entity-id, metadata-field-id) tuple already has a row in `metadata_field_value`.

The English text "Metadata with this name already exists" reads as if a NEW metadata field couldn't be created — which is NOT the failure (the field is fine, the value already exists for this entity). A caller debugging the 400 response cannot tell from the message:
- Is the metadata FIELD a duplicate of an existing field globally? (NO — `getOrCreateMetadataFields` handles that case as upsert)
- Is the VALUE for this entity already set? (YES — this is the actual case)
- Is this a field-name reservation issue? (NO — no field-name reservation in the platform)

**Primary source citations**:
- `DataEntityServiceImpl.java:277-278` — the BadUserRequestException raise with the confusing message
- `DataEntityServiceImpl.java:247-285` — the createMetadata orchestration showing the field-create-then-check-value flow
- contrast with `PolicyServiceImpl.java:88` — the cascade-delete error message "Policy is attached to a role" — clearer and more specific

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-076 (application-level invariants with hand-written English messages) is the architectural intent. The maintainer's choice of message wording is part of the operator-UX contract; the gap is the wording is unclear.

**Proposed remedy**: Change the error message to be specific about the actual failure:
```java
throw new BadUserRequestException(
  "Custom metadata field '%s' is already set on this data entity. Use PUT /api/dataentities/{id}/metadata/{metadata_field_id} to update the existing value."
    .formatted(fieldName));
```

Or more concisely:
```java
throw new BadUserRequestException(
  "Metadata field already has a value on this data entity. Use the update endpoint instead.");
```

The message should distinguish (a) field-name collision (which doesn't happen — `getOrCreateMetadataFields` handles it), (b) value-already-exists for this entity (the actual case), (c) reservation collision (which doesn't apply). The fix is a one-line wording change.

**Severity rationale**: LOW — UX, not correctness. Annoying but doesn't break functionality.

**Suggested backlog grouping**: `Error-message hygiene sweep` — bundle with similar UX-error-wording gaps (REFACTOR-219 misleading "upsert" semantic, REFACTOR-226 operationId drift, REFACTOR-208 / -268 IllegalArgumentException-as-500). Cheap, additive.

---

## ADR-CANDIDATE-062 — Two-permission split on data-entity write surface (DESCRIPTION_UPDATE distinct from INTERNAL_NAME_UPDATE distinct from ADD_TERM distinct from TAGS_UPDATE)

**Severity**: MEDIUM
**Classification**: promote
**Support count**: 3 sidecars (this batch) + cross-ref to batch-F sidecar
**Axes present**: controllers
**Surfaced by**:
- `upsertDataEntityInternalDescription.md:implicit_adrs[5]` ("Description-write is gated by a DEDICATED permission `DATA_ENTITY_DESCRIPTION_UPDATE`, distinct from `DATA_ENTITY_INTERNAL_NAME_UPDATE` — administrators can grant edit rights to descriptions independently of name edits.")
- `addDataEntityTerm.md:implicit_adrs[4]` (the intended `DATA_ENTITY_ADD_TERM` registration as a SEPARATE per-data-entity permission)
- `createDataEntityTagsRelations.md:implicit_adrs[0]` (the per-data-entity `DATA_ENTITY_TAGS_UPDATE` rule)

**Decision statement**: The platform's per-data-entity write surface is intentionally decomposed into FOUR (or more) DISTINCT permission constants — `DATA_ENTITY_DESCRIPTION_UPDATE`, `DATA_ENTITY_INTERNAL_NAME_UPDATE`, `DATA_ENTITY_ADD_TERM` (+ `DATA_ENTITY_DELETE_TERM`), `DATA_ENTITY_TAGS_UPDATE` — rather than a single coarse-grained `DATA_ENTITY_WRITE`. Each maps to a distinct `SecurityRule` entry in `SecurityConstants.SECURITY_RULES`. This enables operators to author Policies that grant edit rights at a fine grain (e.g., "data stewards can update descriptions but not names; tag editors can update tags but not terms"). The split is uniform across DataEntityController's write surface — every write operation has a dedicated permission, not a shared one.

**Evidence**:
- `upsertDataEntityInternalDescription.md` says: "two separate SECURITY_RULES entries for the two adjacent endpoints, registered in immediate succession but with distinct permission constants — the maintainers deliberately split the privilege model" (cites `PolicyPermissionDto.java:18` and `SecurityConstants.java:194-200`)
- `addDataEntityTerm.md` says: "SecurityConstants.SECURITY_RULES[237-239] declares the INTENT to gate this endpoint with DATA_ENTITY resource type + DATA_ENTITY_ADD_TERM permission" (separate from DESCRIPTION_UPDATE at 194-197 and TAGS_UPDATE at 212-214)
- `createDataEntityTagsRelations.md` says: "Per-data-entity authorization on tag-relation management — SecurityConstants.SECURITY_RULES[212-214] registers PUT /api/dataentities/{data_entity_id}/tags with AuthorizationManagerType.DATA_ENTITY and DATA_ENTITY_TAGS_UPDATE"

**Rationale (wisdom test 3-question)**:
1. *Is the split intentional?* YES — three separate `SecurityRule` entries in `SecurityConstants.SECURITY_RULES` registered for sibling endpoints with distinct permission constants. The same maintainer wrote them in sequence and chose distinct names; `PolicyPermissionDto` enumerates DATA_ENTITY_DESCRIPTION_UPDATE, DATA_ENTITY_INTERNAL_NAME_UPDATE, DATA_ENTITY_ADD_TERM, DATA_ENTITY_DELETE_TERM, DATA_ENTITY_TAGS_UPDATE separately. INTENTIONAL.
2. *Structural impact?* YES — affects the Policy framework's authoring surface, the per-resource extractor wiring, and the runtime authorization decision per endpoint.
3. *Refactoring or structural?* STRUCTURAL — combining these into a single `DATA_ENTITY_WRITE` would change the security model.
→ ADR-CANDIDATE.

**Existing ADR**: none directly; partial overlap with ADR-CANDIDATE-002 (SECURITY_RULES wiring) and ADR-CANDIDATE-051 (resource-type↔context coupling). This candidate adds the FINE-GRAINED-PERMISSIONS layer on top.

**Proposed action**: Promote to `adrs/drafts/data-entity-fine-grained-permissions.md`. The ADR should enumerate the current split (description / internal_name / add_term / delete_term / tags / metadata / status / ownership / attachment / custom_metadata) and articulate the operator authoring affordance the split provides.

**Severity rationale**: MEDIUM — pattern-shaping decision (fine-grained policy authoring) confirmed across 3+ sidecars with consistent rule shape; not load-bearing for security in itself (each permission is enforced) but architecturally significant for the operator's Policy authoring experience.

---

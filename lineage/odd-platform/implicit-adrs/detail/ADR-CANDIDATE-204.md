## ADR-CANDIDATE-204 — Dedicated per-aspect entity-tag permissions — tag-editing on each taggable entity is a distinct grant from editing the entity itself (extends ADR-CANDIDATE-062)

**Severity**: MEDIUM
**Classification**: extend-existing (extends ADR-CANDIDATE-062)
**Support count**: 1 sidecar this batch (load-bearing — the dedicated enum member + separate SecurityRule is documentation-as-code); ADR-CANDIDATE-062 is the 2-sidecar batch-K origin
**Axes present**: controllers, security wiring
**Batch**: X-TAGGING
**Related pillar features**: P-06 (Data Glossary — term tags), P-01:F-006 (Manual Object Tagging — dataset-field + data-entity tags), P-09 (Security & Access Control)
**related_features**: [F-018]

**Surfaced by**:
- `odd-platform__java__TermController__controller-method__createTermTagsRelations.md:implicit_adrs.[0]` ("Term-tag management has a DEDICATED permission (`TERM_TAGS_UPDATE`), distinct from the general term-edit permission (`TERM_UPDATE`) — `SecurityConstants.java:185-186` registers `PUT /api/terms/{term_id}/tags` with `TERM_TAGS_UPDATE`, while `PUT /api/terms/{term_id}` (the name/definition edit) uses `TERM_UPDATE` (`SecurityConstants.java:174`).")

**Decision statement**: ODD models **tag-editing on a taggable entity as a permission distinct from editing the entity's own attributes**. Each taggable-entity type carries a dedicated `*_TAGS_UPDATE` permission, registered as its own `SecurityRule` and its own `PolicyPermissionDto` enum member:
- `TERM_TAGS_UPDATE` gates `PUT /api/terms/{term_id}/tags` (`SecurityConstants.java:185-186`) — distinct from `TERM_UPDATE` which gates `PUT /api/terms/{term_id}` (`:174`); both are `TERM`-scoped.
- `DATASET_FIELD_TAGS_UPDATE` gates `PUT /api/datasetfields/{dataset_field_id}/tags` (`:288-290`) — a `DATA_ENTITY`-scoped permission evaluated against the field's parent data entity, distinct from the general dataset-field edit permissions.
- (`DATA_ENTITY_TAGS_UPDATE` is the data-entity member — already documented by ADR-CANDIDATE-062's "two-permission split".)

The intent — visible in the deliberate separate enum members and separate `SecurityRule` entries — is that an operator can author a Policy that lets a role TAG entities without letting it RENAME or REDEFINE them. The live Permissions doc confirms the split with distinct one-sentence definitions ("Allows editing tags for a term" vs "Allows editing the name, namespace, and definition of a term"). This **EXTENDS ADR-CANDIDATE-062** (batch K, "two-permission split on the data-entity write surface — `DATA_ENTITY_TAGS_UPDATE` distinct from `DESCRIPTION_UPDATE` / `INTERNAL_NAME_UPDATE` / `ADD_TERM`") from a single-entity observation to a codebase-wide convention spanning every tag-assignable entity (data-entity + term + dataset-field).

**Evidence**:
- `createTermTagsRelations.md` says: "the deliberate separate enum member and separate `SecurityRule` ... is that editing a term's TAGS is a distinct grant from editing its name/definition: an operator can author a Policy that lets a role tag terms without letting it rename them. The live Permissions doc confirms the split with two distinct one-sentence definitions."
- `createTermTagsRelations.md` intent_anchor: "`new SecurityRule(TERM, new PathPatternParserServerWebExchangeMatcher(\"/api/terms/{term_id}/tags\", PUT), TERM_TAGS_UPDATE)`" (`SecurityConstants.java:185-186`).
- `updateDatasetFieldTags.md:implicit_adrs[0]` confirms the dataset-field member: "`DATASET_FIELD_TAGS_UPDATE` (a `DATA_ENTITY`-typed permission) evaluated against the dataset field's owning data entity."

**Rationale (wisdom test 3-question)**:
1. *Intentional?* YES — a dedicated enum member + a dedicated `SecurityRule` per taggable entity is documentation-as-code; the live Permissions doc independently describes the split. This is the same intent-shape ADR-CANDIDATE-062 already passed the wisdom test on.
2. *Structural impact?* YES — security-architecture choice; affects the Policy-authoring model (operators can grant tag-edit narrowly), the permission catalog, and every taggable-entity write endpoint's `SecurityRule`.
3. *Refactoring or structural?* STRUCTURAL — collapsing tag-edit into the general entity-edit permission would change every operator's Policy and the permission catalog.
→ ADR-CANDIDATE (extend-existing).

**Existing ADR**: ADR-CANDIDATE-062 ("Two-permission split on the data-entity write surface") is the direct parent. This entry is its extension, not a duplicate — ADR-CANDIDATE-062 names the data-entity member only; this entry generalises the convention to term + dataset-field and elevates "the platform splits tag-edit from entity-edit on EVERY taggable entity" to a stated convention.

**Proposed action**: Do NOT promote as a standalone ADR. **Extend `adrs/drafts/two-permission-split.md`** (the ADR-CANDIDATE-062 draft) with a section: "The split is codebase-wide — every taggable entity (data-entity, term, dataset-field) carries its own `*_TAGS_UPDATE` permission distinct from the entity-edit permission. Future taggable entities follow the same pattern." Cross-link the per-aspect permission table. NOTE the scope-asymmetry consequence (these `*_TAGS_UPDATE` permissions side-door past the management-level `TAG_CREATE` — REFACTOR-223) belongs in `refactoring-scopes.md`, not in this ADR.

**Severity rationale**: MEDIUM — pattern-shaping security-architecture convention. Worth recording as an extension because a future maintainer adding a new taggable entity needs to know the per-aspect-permission convention is deliberate and codebase-wide.

---

## REFACTOR-488 — The `!external` guard on tag delete/update reads ONLY the `tag_to_data_entity` aggregate — a tag whose only Collector-set origin is an `EXTERNAL` `tag_to_dataset_field` row can be deleted/renamed by a UI user

**Severity**: MEDIUM
**Category**: missing-defence-in-depth
**Batch**: X-TAGGING
**Related pillar features**: P-01:F-006 (Manual Object Tagging), P-09 (Security & Access Control), P-10 (Integrations & Ingestion — the EXTERNAL channel)
**related_features**: [F-018]

**Surfaced by**:
- `odd-platform__java__TagController__controller-method__deleteTag.md:bugs_limitations_corner_cases[3]` ("The `external` guard checks only the DATA-ENTITY side.")
- `odd-platform__java__TagController__controller-method__deleteTag.md:security.known_security_gaps[1]`
- `odd-platform__java__TagController__controller-method__updateTag.md:bugs_limitations_corner_cases[2]` (the same guard hole on the rename path)

**Statement**: `TagServiceImpl.delete` and `.update` both gate Collector-owned tags via a `.filter(tagDto -> !tagDto.external())` guard (`TagServiceImpl.java:62` / `:49`). But `getDto`'s `external` field is `coalesce(boolOr(tag_to_data_entity.external), false)` — the aggregate boolean OR across DATA-ENTITY relations ONLY (`ReactiveTagRepositoryImpl.java:54-66` joins `TAG_TO_DATA_ENTITY`, never `TAG_TO_DATASET_FIELD`). A tag whose only Collector-set origin is an `EXTERNAL` (or `EXTERNAL_STATISTICS`) `tag_to_dataset_field` row — with no `external` data-entity relation — PASSES the `!external` guard and CAN be deleted or renamed by a UI user holding only `TAG_DELETE` / `TAG_UPDATE`. The delete silently orphans a Collector-set dataset-field tag link; the rename silently mutates a Collector-owned tag. The dataset-field side uses a `TagOrigin` enum (`INTERNAL` / `EXTERNAL` / `EXTERNAL_STATISTICS`), a separate concept the guard never consults.

**Evidence**: `ReactiveTagRepositoryImpl.java:54-66` (`getDto` joins only `TAG_TO_DATA_ENTITY`, not `TAG_TO_DATASET_FIELD`) + `TagServiceImpl.java:62` (delete guard) + `TagServiceImpl.java:49` (update guard) + `ReactiveTagRepositoryImpl.java:84-93` (`listDatasetFieldDtos` confirms `tag_to_dataset_field` uses `ORIGIN`, the enum the guard ignores).

**Why this is a gap, not an ADR (wisdom test)**:
1. *Intentional?* NO. The `!external` guard EXISTS and is mirrored across delete + update + `updateRelationsWithDataEntity` — the maintainer clearly intended Collector-owned tags to be immutable to the UI. The guard simply does not reach the dataset-field channel — an incompleteness in the implementation of an intended invariant, not a decision to exempt dataset-field-only Collector tags. No comment defends "the guard deliberately ignores dataset-field origins".
2. *Structural impact?* NO — the fix is to make `getDto`'s `external` aggregate ALSO consult `tag_to_dataset_field.origin` (or add a second aggregate), within the existing query.
3. *Refactoring or structural?* REFACTORING — extend the `getDto` aggregate; the guard call-sites stay as-is.
→ refactoring scope.

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-205 (multi-channel tag-relation ownership model) PRESCRIBES the intended invariant — Collector-pushed tags are immutable to the UI. REFACTOR-488 is the precise spot where the implementation does not fully enforce ADR-CANDIDATE-205: the `!external` guard covers the `tag_to_data_entity.external` channel but not the `tag_to_dataset_field.origin` channel. The ADR is the prescription; this scope is the enforcement hole.

**Proposed remedy**: Extend `ReactiveTagRepositoryImpl.getDto` so the `external` (or a new `hasExternalRelations`) field also reflects `tag_to_dataset_field` rows with `origin IN ('EXTERNAL', 'EXTERNAL_STATISTICS')` — e.g. a second `LEFT JOIN TAG_TO_DATASET_FIELD` + an OR into the aggregate, or a `UNION`-style existence check. The `.filter(!external)` guards at `TagServiceImpl.java:49,62` then correctly block delete/rename of any tag with ANY Collector-set relation across BOTH channels. Add a security test: create a tag with only an `EXTERNAL` `tag_to_dataset_field` relation, assert `TAG_DELETE` / `TAG_UPDATE` are rejected with `BadUserRequestException`.

**Severity rationale**: MEDIUM — a permission-adjacent defence-in-depth hole. A UI user can destroy/mutate Collector-owned state, but the window is narrow (the tag must have a dataset-field EXTERNAL relation and NO data-entity external relation) and the impact is bounded by REFACTOR-487 (the dataset-field relation is orphaned by tag delete anyway). Severity is MEDIUM rather than HIGH because the exposure requires a specific relation topology and the blast radius is one tag.

**Suggested backlog grouping**: "Tag delete-path correctness" sprint — pair with REFACTOR-487 (orphaned `tag_to_dataset_field`) and REFACTOR-489 (FTS refresh); also belongs in the SEC-NNN authorization-audit sprint as the dataset-field-channel completeness item for ADR-CANDIDATE-205.

---

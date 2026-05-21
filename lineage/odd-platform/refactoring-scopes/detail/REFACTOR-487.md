## REFACTOR-487 — `deleteTag` asymmetric cascade — `tag_to_dataset_field` rows are orphaned, pointing at a soft-deleted `tag.id`, with no reaper; the cleanup method exists but is never called

**Severity**: HIGH
**Category**: asymmetric-cascade
**Batch**: X-TAGGING
**Related pillar features**: P-01:F-006 (Manual Object Tagging), P-08 (Management & Administration — Tags tab delete)
**related_features**: [F-018]

**Surfaced by**:
- `odd-platform__java__TagController__controller-method__deleteTag.md:bugs_limitations_corner_cases[0]` ("ASYMMETRIC CASCADE — `TagServiceImpl.delete` cleans up only TWO of the three tag-relation tables.")
- `odd-platform__java__TagController__controller-method__deleteTag.md:downstream_side_effects` (the NEGATIVE side effect — `tag_to_dataset_field` rows NOT deleted)
- cross-confirm: `feature-flows/index.yaml` F-018 drift facet `delete_tag_cascade_asymmetric_tag_to_dataset_field_rows_orphaned_after_soft_delete`

**Statement**: `DELETE /api/tags/{tag_id}` → `TagServiceImpl.delete` (`TagServiceImpl.java:57-70`, `@ReactiveTransactional`) cleans up only 2 of the 3 tag-relation tables. The `Flux.zip(deleteTermRelations(tagId), deleteDataEntityRelations(tagId))` at `TagServiceImpl.java:64-65` hard-deletes `tag_to_term` and `tag_to_data_entity`; the third relation table — `tag_to_dataset_field` — is never touched. The fix anchor already exists and is unused: `ReactiveTagRepositoryImpl.deleteDatasetFieldRelations(long tagId)` at `:299-306` is exactly `DELETE FROM tag_to_dataset_field WHERE tag_id = ?` but `TagServiceImpl.delete` does not invoke it. Operator-visible consequence: deleting a tag attached to dataset columns leaves `tag_to_dataset_field` rows referencing a soft-deleted `tag.id` indefinitely. The orphans are invisible to UI reads (`listDatasetFieldDtos` joins `tag` and the soft-deleted row is filtered out) but persist in the DB forever — there is no reaper job. Repeated create/delete cycles grow `tag_to_dataset_field` monotonically. Probe P-032 pins the runtime behaviour.

**Evidence**: `TagController.java:30-34` + `TagServiceImpl.java:64-66` (the two-table `Flux.zip`, no dataset-field delete) + `ReactiveTagRepositoryImpl.java:299-306` (the unused `deleteDatasetFieldRelations(long)`) + `lineage/odd-platform/probes/P-032.yaml`.

**Why this is a gap, not an ADR (wisdom test)**:
1. *Intentional?* NO. There is no comment, no exception, no doc, no ADR defending "we deliberately do not delete `tag_to_dataset_field` on tag delete". The matching repository method (`deleteDatasetFieldRelations(long)`) EXISTS — the maintainer wrote the cleanup primitive and simply did not wire it into the delete chain. The available-but-unused method is the smoking gun: the intent was clearly to delete all three, and the third was missed.
2. *Structural impact?* NO — the cascade runs WITHIN the existing `TagServiceImpl.delete` chain; completing it is adding one term to the existing `Flux.zip`.
3. *Refactoring or structural?* REFACTORING — add `deleteDatasetFieldRelations(tagId)` as a third arm of the `Flux.zip` at `TagServiceImpl.java:64-65`.
→ refactoring scope.

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-069 (edge tables are hard-delete) PRESCRIBES the desired behaviour — an edge row to a deleted entity must itself be hard-deleted. The `tag_to_dataset_field` orphans VIOLATE that prescription. ADR-CANDIDATE-205 (multi-channel tag-relation ownership) is the model the cleanup should respect — note that `deleteDatasetFieldRelations(long tagId)` (the unused method) deletes ALL origins for the tag, which is correct on a tag DELETE (the whole tag is going away, so all its relations across all channels go too — unlike the per-field replace-all which scopes to `INTERNAL`).

**Proposed remedy**: Add `tagService.deleteDatasetFieldRelations(tagId)` (wrapping `ReactiveTagRepositoryImpl.deleteDatasetFieldRelations(long)`) as a third arm of the `Flux.zip` at `TagServiceImpl.java:64-65`, so the delete cascade hard-deletes all three relation tables atomically inside the existing `@ReactiveTransactional`. Add an integration test (promote probe P-032) asserting that after a tag delete, zero `tag_to_dataset_field` rows reference the deleted `tag.id`.

**Severity rationale**: HIGH — a data-integrity defect with monotonic unbounded growth. Orphaned FK-shaped rows pointing at soft-deleted parents accumulate forever with no reaper; the defect is silent (invisible to UI) and cross-pillar (P-01 tagging feeds the P-08 Tags tab). It is exactly the LSN-001-shape class — a quiet correctness defect that an operator only discovers via a DB audit.

**Suggested backlog grouping**: "Tag delete-path correctness" sprint — pair with REFACTOR-488 (the `!external` guard's dataset-field hole) and REFACTOR-489 (the delete-path FTS refresh) — all three are one coherent fix on `TagServiceImpl.delete`, pinned by probes P-032 + P-033.

---

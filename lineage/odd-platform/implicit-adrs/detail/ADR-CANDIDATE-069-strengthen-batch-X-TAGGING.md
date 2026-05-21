## STRENGTHENS — Batch X-TAGGING (ADR-CANDIDATE-069 — `deleteTag` controller-method confirms `tag_to_term` + `tag_to_data_entity` hard-delete from the operation-flow angle)

**One new controller-method sidecar confirms the edge-tables-are-hard-delete pattern at the tag-relation tables — re-confirming the batch-N `ReactiveTagRepositoryImpl` primary-source finding from the controller-method angle.**

- `deleteTag.md:invariants` — "Relation deletion is HARD and asymmetric — `tag_to_term` and `tag_to_data_entity` rows are physically `DELETE`d (`ReactiveTagRepositoryImpl.java:280-286`, `:235-241`); `tag_to_dataset_field` rows are NOT deleted by this path." The `tag` directory row is soft-deleted; its relation rows are hard-deleted — the exact soft-on-directory / hard-on-edge split this ADR describes.
- `deleteTag.md:downstream_side_effects` — two `db-write` side effects: "HARD-deletes every `tag_to_term` row for the tag — `DELETE FROM tag_to_term WHERE tag_id = ?`" and "HARD-deletes every `tag_to_data_entity` row for the tag — `DELETE FROM tag_to_data_entity WHERE tag_id = ?`".
- `createTermTagsRelations.md:implicit_adrs[1]` independently corroborates the term-tag relation's hard-delete with migration evidence: "Term-tag relations are HARD-deleted, not soft-deleted — `V0_0_76__term_relations_hard_delete.sql:8-13` deletes all soft-deleted `tag_to_term` rows and DROPS the `deleted_at` column. The migration filename `term_relations_hard_delete` plus the column drop is the evidence of intent." (This is the V0_0_76 migration the ADR already cites as the canonical intent anchor.)

**Architectural refinement**: `deleteTag` is the OPERATION-FLOW confirmation of what the batch-N `ReactiveTagRepositoryImpl` sidecar surfaced at the repository tier — the three `tag_to_*` relation tables are hard-delete. `createTermTagsRelations` adds the migration-history confirmation for `tag_to_term` specifically (`V0_0_76`). The pattern holds: `tag` (directory) is soft-delete; `tag_to_term` / `tag_to_data_entity` / `tag_to_dataset_field` (edges) are hard-delete.

**Co-surfaced gap**: `deleteTag` ALSO surfaces that the cascade is INCOMPLETE — `tag_to_dataset_field` is the third relation table and `deleteTag` never deletes it, leaving orphan rows. That is GAP-shaped (the cascade SHOULD complete; the edge-table-hard-delete ADR PRESCRIBES that an edge to a deleted entity is hard-deleted) — tracked as **REFACTOR-487** (HIGH). The ADR's hard-delete rule is correct; the `deleteTag` chain's failure to apply it to the third table is the gap.

**Support count**: extended by 1 controller-method sidecar (`deleteTag`) + the `createTermTagsRelations` migration-history corroboration. Re-confirms the batch-N `ReactiveTagRepositoryImpl` finding from the operation-flow angle.

**Severity unchanged**: MEDIUM.

---

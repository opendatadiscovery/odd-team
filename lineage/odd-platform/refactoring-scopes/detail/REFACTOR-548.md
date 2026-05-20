## REFACTOR-548 — `TagServiceImpl.delete` cascade asymmetry — `tag_to_dataset_field` rows ORPHANED on tag-delete; `deleteDatasetFieldRelations(long)` defined but never invoked

**Severity**: MEDIUM
**Category**: missing-cascade (data-integrity)
**Surfaced by**:
- `TagServiceImpl.md:bugs_limitations_corner_cases[delete cascade does NOT touch tag_to_dataset_field]` (MEDIUM)
- `TagServiceImpl.md:invariants[asymmetric delete cascade]`
- `TagServiceImpl.md:stress_findings.S-B-6` (delete name-vs-behaviour drift; categorised as MINOR but logged here as MEDIUM data-integrity)
- `TagController.md:invariants[8]` ("`deleteTag` cascade is asymmetric across the three relation tables")
- `TagController.md:bugs_limitations_corner_cases[3]` ("`deleteTag` cascade asymmetry — `tag_to_dataset_field` rows NOT cleaned up")
- `TagController.md:downstream_side_effects.db-write` (`cardinality_per_call: "1 + N (tag_to_term rows) + M (tag_to_data_entity rows); tag_to_dataset_field rows NOT deleted"`)
- `ReactiveTagRepositoryImpl.md:bugs_limitations_corner_cases[resurrection]` (the related "soft-delete resurrection loses relations" pattern)

**Description**: `TagServiceImpl.delete(tagId)` (`:57-70`, `@ReactiveTransactional`) performs the following sequence:
1. `getDto(tagId)` (line 60) — fetch + 404 on absent
2. `!external` guard (line 62) — reject Collector-owned tags
3. `Flux.zip(deleteTermRelations(tagId), deleteDataEntityRelations(tagId))` (lines 64-65) — concurrent HARD-deletes of `tag_to_term` + `tag_to_data_entity` rows
4. `reactiveTagRepository.delete(tagId)` (line 66) — SOFT-delete the `tag` row
5. `reactiveTermSearchEntrypointRepository.updateChangedTagVectors(tagId)` (line 68-69) — term-side search vector refresh

**The third relation table — `tag_to_dataset_field` — is NEVER touched.** The repository defines `deleteDatasetFieldRelations(long tagId)` at `ReactiveTagRepositoryImpl.java:299-306` (analogous to `deleteDataEntityRelations(long tagId)`) but it is NOT invoked from `TagServiceImpl.delete`. Verified via line-by-line read of the delete method and grep of `deleteDatasetFieldRelations` call sites within `TagServiceImpl`.

**Operator-visible consequence**: A tag attached to dataset fields, then deleted via `DELETE /api/tags/{tag_id}` (under `TAG_DELETE` permission), produces:
- `tag` row: `deleted_at = NOW()` (soft-deleted, invisible to UI reads via `addSoftDeleteFilter`)
- `tag_to_term` rows: HARD-deleted (gone)
- `tag_to_data_entity` rows: HARD-deleted (gone)
- **`tag_to_dataset_field` rows: PERSIST in the DB** with `tag_id` referencing a soft-deleted tag

The orphaned `tag_to_dataset_field` rows are invisible to UI reads because `listDatasetFieldDtos` (`:84-98`) joins through `addSoftDeleteFilter`. But they accumulate in the DB indefinitely over delete cycles. There is no `tag_to_dataset_field` reaper job — verified by grep of `tag_to_dataset_field` in the housekeeping subsystem (no scheduled job touches this table).

**Second-order consequence — resurrection asymmetry**: The partial unique index `tag_name_unique ON tag (name) WHERE tag.deleted_at IS NULL` (V0_0_64:105) permits re-creating a Tag with the same name AFTER soft-delete. The recreated tag has a NEW id; the orphaned `tag_to_dataset_field` rows still reference the OLD id. The recreated tag has ZERO dataset-field relations from its predecessor, even though those rows still exist in the DB.

**Primary source citations**:
- `TagServiceImpl.java:57-70` (the delete method body — only 2 of 3 relation-tables touched)
- `TagServiceImpl.java:64-65` (the `Flux.zip` with two relation-deletes)
- `ReactiveTagRepositoryImpl.java:299-306` (the unused `deleteDatasetFieldRelations(long tagId)` method)
- `ReactiveTagRepositoryImpl.java:84-98` (`listDatasetFieldDtos` — joins through `addSoftDeleteFilter`, hides orphans from UI reads)
- `V0_0_64__remove_is_deleted_field.sql:105` (the partial unique index permitting same-name recreation post-soft-delete)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-069 (Edge tables are HARD-DELETE by design) prescribes that relation rows are hard-deleted alongside the parent soft-delete — this is the cross-cutting commitment. The TagServiceImpl.delete sequence CONFORMS to this for 2 of 3 relation tables; the dataset-field table is the OUTLIER. The prescription says "every relation table should be hard-deleted on parent soft-delete"; the implementation misses one of the three.

**Proposed remedy**: Two options:

1. **Fix the cascade**: Add `reactiveTagRepository.deleteDatasetFieldRelations(tagId)` to the `Flux.zip` at `TagServiceImpl.java:64-65`. New shape: `Flux.zip(deleteTermRelations(tagId), deleteDataEntityRelations(tagId), deleteDatasetFieldRelations(tagId))`. Add a `Flux.from(...)` glue if needed. Integration test: a tag attached to a dataset field, when deleted, leaves zero `tag_to_dataset_field` rows referencing it.

2. **Document the divergence**: If the asymmetry is intentional (e.g., dataset-field tags are governed differently — origin-tracked via `TagOrigin` enum where regular `tag_to_data_entity` has just a `external` boolean), add a code comment defending it. Audit the production DB for accumulated orphans; if material, add a housekeeping job that periodically prunes `tag_to_dataset_field` rows referencing soft-deleted tags. Update the live tagging doc page to clarify the semantic.

**Recommended**: Option 1 — the asymmetry has no stated rationale; the absent call is functionally equivalent to the present calls (same hard-delete-on-soft-parent shape); fixing it is a one-line addition. If a reaper-job is also added (Option 2 retroactively), the production DB benefits.

**Severity rationale**: MEDIUM — DB-only persistence; UI not affected; no security implication. The data-integrity concern is "rows referencing soft-deleted parents persist forever" — a slow leak, not an acute defect. Severity bounded by:
- The orphans are invisible to UI (filtered by `addSoftDeleteFilter` on reads).
- The orphans are NOT a security exposure (the `tag_to_dataset_field` row's `external` aggregate doesn't unmask anything).
- The leak rate is bounded by tag-delete frequency × per-tag-dataset-field-count — for the typical deployment this is low.

**Suggested backlog grouping**: Data-integrity housekeeping sprint. Pair with REFACTOR-085 (no activity retention), REFACTOR-141 (housekeeping primitive-default-leak), REFACTOR-142 (jOOQ precedence bug in AlertHousekeepingJob) — the four are the "housekeeping subsystem doesn't fully clean up after itself" cluster.

---

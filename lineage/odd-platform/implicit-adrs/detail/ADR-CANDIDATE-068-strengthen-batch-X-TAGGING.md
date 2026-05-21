## STRENGTHENS — Batch X-TAGGING (ADR-CANDIDATE-068 — `deleteTag` controller-method confirms the tag-directory soft-delete from the controller-method angle)

**One new controller-method sidecar confirms the two-tier soft-delete taxonomy at the `tag` directory entry — re-confirming the batch-N `ReactiveTagRepositoryImpl` primary-source finding from the controller-method angle.**

- `deleteTag.md:implicit_adrs[0]` — "Tag rows are SOFT-deleted while their relation rows are HARD-deleted — a deliberate, schema-level split: `ReactiveTagRepositoryImpl` extends `ReactiveAbstractSoftDeleteCRUDRepository` (so `delete` is an `UPDATE ... SET deleted_at`), whereas the relation deletes are explicit `DSL.delete(...)` calls." (intent_anchor: "the class declaration `public class ReactiveTagRepositoryImpl extends ReactiveAbstractSoftDeleteCRUDRepository<...>` is the decision")
- `deleteTag.md:invariants` — "Tag deletion is SOFT — the `tag` row's `deleted_at` is stamped, the row is not physically removed (`ReactiveAbstractSoftDeleteCRUDRepository.java:50-59`). Every subsequent `tag`-table read in the codebase applies `addSoftDeleteFilter` (`deleted_at IS NULL`)."
- `deleteTag.md:concepts.operations` — "`ReactiveAbstractSoftDeleteCRUDRepository.delete(long id)` — `UPDATE tag SET deleted_at = now() WHERE id = ? AND deleted_at IS NULL RETURNING *`. The `idCondition` override (`:77-79`) adds `addSoftDeleteFilter` so an already-deleted id matches nothing."

**Architectural refinement**: `deleteTag` confirms the BASE-tier shape — the `tag` directory entry uses the unmodified `deleted_at`-timestamp base-class soft-delete (no Tier-2 override; the Tier-2 overrides remain limited to `data_entity` status-machine + `data_entity_lineage_edges` `is_deleted` boolean per the ADR's existing batch-N STRENGTHENS block). The controller-method sidecar adds the operator-visible consequence the repository sidecar could not see: a soft-deleted tag becomes invisible to the UI but persists in the DB, and there is no reaper job (`deleteTag.md:bugs_limitations_corner_cases` — soft-deleted `tag` rows accumulate with no housekeeping purge — tracked separately as a gap).

**Support count**: extended by 1 controller-method sidecar (`deleteTag`) — re-confirms the batch-N `ReactiveTagRepositoryImpl` finding from the operation-flow angle.

**Severity unchanged**: HIGH.

---

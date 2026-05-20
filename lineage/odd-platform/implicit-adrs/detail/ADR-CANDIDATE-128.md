## ADR-CANDIDATE-128 — `onDuplicateKeyIgnore` on relation-table INSERTs (`createDataEntityRelations`, `createDatasetFieldRelations`, `createTermRelations`) — relation creation is "attach if not already attached", NOT "add a new attachment row" — idempotent by design across the replace-all-diff flow

**Severity**: MEDIUM
**Classification**: promote
**Pillars affected**: [P-01-data-discovery, P-06-data-glossary]
**Support count**: 1 sidecar (batch N ReactiveTagRepositoryImpl) — primary-source for the three-relation pattern; mirrors potential extensions in any other edge-table create surface
**Axes present**: repositories
**Batch**: N (2026-05-19)

**Surfaced by**:
- `ReactiveTagRepositoryImpl.md:implicit_adrs.[4]` (HIGH) — "`onDuplicateKeyIgnore` for relation creates — `createDataEntityRelations` / `createDatasetFieldRelations` / `createTermRelations` all use `onDuplicateKeyIgnore()` (`:261, 344, 367`). This makes relation-create idempotent: a second call with the same `(tag_id, data_entity_id)` pair is a no-op rather than a unique-constraint error. The semantic is 'attach tag if not already attached' rather than 'add a new attachment'. Consistent with replace-all diff in `TagServiceImpl.updateRelationsWithDataEntity`." — intent_anchor: "`.onDuplicateKeyIgnore()` repeated three times across the relation-create methods — the consistency is the diagnostic"

**Decision statement**: ODD's edge-table (relation-table) INSERT paths use jOOQ's `.onDuplicateKeyIgnore()` clause to make relation creation IDEMPOTENT. The canonical example is the Tag relations:

```java
public Flux<TagToDataEntityPojo> createDataEntityRelations(
    long dataEntityId, List<TagToDataEntityPojo> relations) {
  if (relations.isEmpty()) return Flux.empty();
  InsertSetMoreStep<TagToDataEntityRecord> insert = ...; // build values
  return jooqReactiveOperations.flux(insert.onDuplicateKeyIgnore().returning());
}
```

(`ReactiveTagRepositoryImpl.java:244-264, 326-347, 350-371` — three relation-create methods, all using `.onDuplicateKeyIgnore()`).

The architectural choices encoded:
- **(a) Semantic: "attach if not already attached"** — the relation row is the EDGE, not a per-attachment record. A second call with the same `(tag_id, data_entity_id)` pair is a no-op rather than a unique-constraint violation. The caller never has to pre-filter the already-attached relations.
- **(b) Consistent with replace-all-diff** — `TagServiceImpl.updateRelationsWithDataEntity` (lines 97+) computes the diff between the user's desired tag set and the entity's current tags; the diff produces `toCreate` (new attachments) and `toDelete` (removed attachments). The `toCreate` list MAY accidentally include an already-attached pair if the diff misclassifies; `.onDuplicateKeyIgnore()` makes the misclassification a no-op rather than a 500.
- **(c) Cross-method consistency** — the pattern repeats for `createDataEntityRelations` (Tag ↔ DataEntity), `createDatasetFieldRelations` (Tag ↔ DatasetField), `createTermRelations` (Tag ↔ Term). The three are the maintenance-extension anchor — any new relation-table CREATE method should use the same idiom.
- **(d) Composes with hard-delete relations** — ADR-CANDIDATE-069 (edge tables are hard-delete by design) means deletion is a physical row removal. The create-side `onDuplicateKeyIgnore` matches the delete-side hard-delete: the attachment EITHER exists OR doesn't; there's no soft-state-in-between.

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — three relation-create methods all use `.onDuplicateKeyIgnore()` verbatim. The maintainer-extension contract is implicit in the consistency. A standalone INSERT (e.g., on the tag-directory table itself, see `bulkCreate` per ADR-CANDIDATE-127) does NOT use `.onDuplicateKeyIgnore()` — the maintainer deliberately distinguished relation INSERTs from directory INSERTs.
2. **Structural impact?** YES — affects every relation-table CREATE path; affects the replace-all-diff orchestration shape (callers can compute approximate diffs without exact-state knowledge); affects the maintainer-extension contract for new edge tables.
3. **Switching to fail-on-duplicate is REFACTORING or STRUCTURAL?** STRUCTURAL — failing on duplicate would force callers to pre-filter the create list, which requires a fresh read of the current state before computing the diff — racy under concurrent edits AND adds N reads to every write. The `onDuplicateKeyIgnore` IS the architecture for this audience.

**Evidence**:
- ReactiveTagRepositoryImpl.md says: "`onDuplicateKeyIgnore` for relation creates — `createDataEntityRelations` / `createDatasetFieldRelations` / `createTermRelations` all use `onDuplicateKeyIgnore()` (`:261, 344, 367`). This makes relation-create idempotent: a second call with the same `(tag_id, data_entity_id)` pair is a no-op rather than a unique-constraint error. The semantic is 'attach tag if not already attached' rather than 'add a new attachment'."
- ReactiveTagRepositoryImpl.java:261, 344, 367 — the three relation-create methods with the consistent idiom

**Existing ADR**: none. **Composes with ADR-CANDIDATE-069** (edge tables are hard-delete — the create-side idempotency matches the delete-side physical removal). **Composes with ADR-CANDIDATE-125 NEW** (partial-unique-index + ON CONFLICT — different idiom for different audience; relation tables use `onDuplicateKeyIgnore`, directory tables use `onConflict + doUpdate`).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- None directly. The pattern is sound. Adjacent gap surface: REFACTOR-380 NEW — Tag resurrection of soft-deleted tag does NOT restore relations (the hard-delete-relations approach loses attachment history; mirrored at edge-table hard-delete semantic).

**Proposed action**: Promote to `adrs/drafts/relation-table-on-duplicate-key-ignore.md` (new ADR). Document:
- The idiom (`.onDuplicateKeyIgnore()` on every relation-table create).
- The semantic ("attach if not already attached" vs "add new attachment").
- The consistency with replace-all-diff orchestration.
- The composition with ADR-CANDIDATE-069 (hard-delete-on-relation-removal).
- The maintainer-extension contract: future relation-table CREATE methods use this idiom.

Cross-link with ADR-CANDIDATE-069, -125, -127, -070.

**Severity rationale**: MEDIUM — pattern-shaping decision for edge-table writes. Affects every relation-create method on every repository (Tag relations confirmed; Ownership / TermRelations / etc. likely follow the same pattern — cross-batch verification needed). Less codebase-defining than ADR-CANDIDATE-069 (which legislates the deletion model) but the supporting idiom that makes -069's hard-delete edge-table model usable via the replace-all-diff orchestration.

---

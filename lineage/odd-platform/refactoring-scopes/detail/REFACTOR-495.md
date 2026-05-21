## REFACTOR-495 — `updateDatasetFieldTags` relation INSERT relies on an UNSET `origin` pojo field plus a DB column default — if jOOQ emits an explicit NULL the endpoint is dead for every non-empty `tags` payload

**Severity**: HIGH
**Category**: fragile-wiring
**Batch**: X-TAGGING
**Related pillar features**: P-01:F-006 (Manual Object Tagging — dataset-field tags)
**related_features**: [F-018]

**Surfaced by**:
- `odd-platform__java__DatasetFieldController__controller-method__updateDatasetFieldTags.md:bugs_limitations_corner_cases[0]` ("Relation INSERT relies on an UNSET pojo field plus a DB column default.")
- `odd-platform__java__DatasetFieldController__controller-method__updateDatasetFieldTags.md:tests_coverage_semantic.uncovered_behaviours` (CRITICAL — the relation-INSERT-with-unset-origin path is the load-bearing untested path)
- `odd-platform__java__DatasetFieldController__controller-method__updateDatasetFieldTags.md:security.known_security_gaps[3]`

**Statement**: `updateDatasetFieldTags` → `DatasetFieldServiceImpl.getUpdatedRelations` (`:264-271`) builds `TagToDatasetFieldPojo` instances with `tagId` + `datasetFieldId` set but NEVER calls `.setOrigin(...)`. `createDatasetFieldRelations` (`ReactiveTagRepositoryImpl.java:355-368`) maps each pojo via `jooqReactiveOperations.newRecord(TAG_TO_DATASET_FIELD, p)` then INSERTs. The column is `origin varchar NOT NULL DEFAULT 'INTERNAL'` (`V0_0_82__add_tag_to_dataset_field.sql:12`). The endpoint's correctness depends entirely on jOOQ's null-field-handling: if `newRecord(table, pojo)` marks the unset `origin` field as changed-with-value-NULL, the INSERT emits an explicit `NULL`, violates the `NOT NULL` constraint, and **the endpoint fails for ANY non-empty `tags` payload**. If jOOQ omits the unset column, the `DEFAULT 'INTERNAL'` applies and behaviour is correct. This is NOT statically determinable (jOOQ null-field-handling + `onDuplicateKeyIgnore` interaction) and is NOT covered by any test — the data-entity sibling path side-steps the question entirely by explicitly calling `.setExternal(false)` on its `TagToDataEntityPojo` (`TagServiceImpl.java:109`). Probe P-030 pins it.

**Evidence**: `DatasetFieldServiceImpl.java:264-271` (`getUpdatedRelations` — no `.setOrigin`) + `ReactiveTagRepositoryImpl.java:355-368` (`createDatasetFieldRelations` newRecord-from-pojo INSERT) + `V0_0_82__add_tag_to_dataset_field.sql:12` (`NOT NULL DEFAULT 'INTERNAL'`) + `TagServiceImpl.java:106-109` (the data-entity path's explicit `.setExternal(false)` — the safe pattern this path did NOT follow) + `lineage/odd-platform/probes/P-030.yaml`.

**Why this is a gap, not an ADR (wisdom test)**:
1. *Intentional?* PARTIALLY — the column DEFAULT `'INTERNAL'` is unambiguously intentional (ADR-CANDIDATE-205 — the multi-channel model). But relying on the DB default rather than setting the discriminator in code is a fragility, not a decision: the data-entity sibling sets its discriminator explicitly (`.setExternal(false)`), so the dataset-field path's reliance on the default is an inconsistency, not a considered choice. No comment articulates "we deliberately let the DB default apply here".
2. *Structural impact?* NO — the fix is one line (`.setOrigin(TagOrigin.INTERNAL)` in `getUpdatedRelations`); the structure is unchanged.
3. *Refactoring or structural?* REFACTORING — set the field explicitly, matching the data-entity sibling.
→ refactoring scope. (NOTE: the `origin`-DEFAULT-`'INTERNAL'` design itself IS an ADR — ADR-CANDIDATE-205 — but THIS finding is the gap that the design's IMPLEMENTATION leaves the discriminator unset in code.)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-205 (multi-channel tag-relation ownership) is the design — the `origin` discriminator distinguishes UI-owned (`INTERNAL`) from ingestion-owned (`EXTERNAL` / `EXTERNAL_STATISTICS`) relations. The design REQUIRES every UI-created relation to be `INTERNAL`; the implementation gap is that it sets `INTERNAL` via a DB default rather than explicitly, leaving the endpoint's correctness contingent on a jOOQ behaviour. The data-entity path's `.setExternal(false)` is the implied prescription — set the discriminator in code.

**Proposed remedy**: In `DatasetFieldServiceImpl.getUpdatedRelations` (`:264-271`), call `.setOrigin(TagOrigin.INTERNAL.toString())` (or the enum, per the column type) explicitly on each `TagToDatasetFieldPojo`, mirroring `TagServiceImpl.java:109`'s `.setExternal(false)`. Promote probe P-030 to a Testcontainers integration test asserting that `createDatasetFieldRelations` with a non-empty payload persists rows whose `origin` is exactly `'INTERNAL'`. The worse failure mode P-030 should also check: if the persisted `origin` ever ends up something OTHER than `'INTERNAL'`, the NEXT call's `deleteDatasetFieldInternalRelations` (`origin='INTERNAL'`-scoped DELETE) MISSES those rows and the field accumulates undeletable internal relations.

**Severity rationale**: HIGH — a possible total-availability failure of a user-facing endpoint (dead for all non-empty payloads) that is statically undetermined and completely untested. Even the benign-default outcome is a fragility: a jOOQ version bump or a stray `.setOrigin(null)` flips it.

**Suggested backlog grouping**: TEST-NNN companion (promote P-030 to a CI integration test) + "Tag delete-path / write-path correctness" sprint.

---

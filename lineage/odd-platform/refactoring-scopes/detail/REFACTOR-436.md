## REFACTOR-436 — `metadata_field` partial-unique-indexes NOT migrated for soft-delete (V0_0_64 left this table behind)

**Severity**: HIGH
**Category**: missing-migration-alignment / latent-UX-defect
**Batch**: R (2026-05-20)
**Pillars affected**: [P-01-data-discovery (custom-metadata feature), P-08-management-administration]

**Surfaced by**:
- `ReactiveMetadataFieldRepositoryImpl.md:bugs_limitations_corner_cases.[0]` (MEDIUM in sidecar, classified HIGH here because the latent UX defect blocks the operator's recovery path with no UI tools): "Soft-delete + partial-unique-index mismatch — soft-deleted INTERNAL fields cannot be re-created by name."
- `ReactiveMetadataFieldRepositoryImpl.md:concepts.invariants.[2]` (HIGH): "Partial unique indexes do NOT include `deleted_at IS NULL`. Both `ix_unique_external_name_type` (`V0_0_1__init.sql:238-240`) and `ix_unique_internal_name` (`V0_0_1__init.sql:242-244`) filter only by origin; neither was updated by `V0_0_64__remove_is_deleted_field.sql` to also exclude soft-deleted rows. By contrast, `tag_name_unique` WAS updated to `… WHERE tag.deleted_at IS NULL` in the same migration (`V0_0_64:103-105`)."
- `ReactiveMetadataFieldRepositoryImpl.md:coherence_with_prior.new_findings.[0]` (HIGH): "Soft-delete + partial-unique-index mismatch on metadata_field — the `IX_UNIQUE_INTERNAL_NAME` and `IX_UNIQUE_EXTERNAL_NAME_TYPE` indexes were NOT migrated to `WHERE deleted_at IS NULL` in V0_0_64, unlike the sibling tag/role/policy/owner/title indexes. Soft-deleted metadata fields are permanent name-blockers. Candidate for new concept entry `metadata-field-soft-delete-partial-index-mismatch`."
- `ReactiveCollectorRepositoryImpl.md:bugs_limitations_corner_cases.[4]` (LOW — same-class finding at a DIFFERENT table): "`collector.name UNIQUE` is a FULL unique constraint, NOT partial (V0_0_29__add_collector.sql:4 — `name varchar(255) UNIQUE`). A soft-deleted collector's name CANNOT be reused without first hard-deleting the row… This is inconsistent with the recreate-after-delete pattern used for `role.name` (where the partial unique index `role_name_unique ON role(name) WHERE deleted_at IS NULL` per V0_0_55:42 + V0_0_64:88-90 allows re-creation) and `policy.name` (same pattern per batch-H). An operator deleting a collector named 'snowflake-prod' and trying to re-create with the same name hits a `UniqueConstraintException`."

**Statement**: The migration `V0_0_64__remove_is_deleted_field.sql` (which renamed soft-delete from `is_deleted boolean` to `deleted_at TIMESTAMP` across 8 tables AND updated their partial unique indexes to include `WHERE deleted_at IS NULL`) FORGOT to update metadata_field's two partial unique indexes:

- `IX_UNIQUE_INTERNAL_NAME ON metadata_field (name) WHERE origin = 'INTERNAL'` (`V0_0_1__init.sql:242-244`)
- `IX_UNIQUE_EXTERNAL_NAME_TYPE ON metadata_field (type, name) WHERE origin <> 'INTERNAL'` (`V0_0_1__init.sql:238-240`)

The sibling `tag_name_unique` index WAS updated (V0_0_64:103-105 explicitly adds `WHERE tag.deleted_at IS NULL`); the metadata_field side was missed.

**Sibling finding (collector.name full-vs-partial constraint asymmetry)** — same class of alignment-gap at a different table: V0_0_29 declared `collector.name UNIQUE` as a FULL unique constraint (not partial), unlike `role.name` and `policy.name` which use partial-unique-with-deleted-at-IS-NULL. Recreating a soft-deleted collector with the same name is BLOCKED today; the cross-table audit should include collector.name.

**Consequence** (metadata_field primary case): An operator soft-deletes an INTERNAL custom metadata field with name `cost_centre`, then attempts to re-create it via the UI:
1. The UI dropdown (`listInternalMetadata`) reports "doesn't exist" — because `listInternalMetadata` filters via `addSoftDeleteFilter` (line 46 of ReactiveMetadataFieldRepositoryImpl.java)
2. The INSERT via `getOrCreateMetadataFields` → `bulkCreate` raises `UniqueConstraintException("Internal metadata with this name already exists")` — because the partial unique index `IX_UNIQUE_INTERNAL_NAME` does NOT exclude the soft-deleted row, so the index still has the dead row's `name` entry blocking new live-row inserts
3. The user-facing error message comes from `ExceptionUtils.java:63-65` and is presented as a 500 (or 422) error

The operator is BLOCKED with no UI recovery path; manual DBA SQL (`DELETE FROM metadata_field WHERE name='cost_centre' AND deleted_at IS NOT NULL`) is the only fix. There is no platform-side recover-soft-deleted-metadata-field endpoint.

**Evidence**:
- `V0_0_1__init.sql:238-244` — partial unique indexes WITHOUT `deleted_at IS NULL` predicate (metadata_field)
- `V0_0_64__remove_is_deleted_field.sql:41-50` — metadata_field's V0_0_64 block ADDS the `deleted_at` column but DOES NOT touch the partial indexes
- `V0_0_64__remove_is_deleted_field.sql:103-105` — Tag side's MATCHING migration (recreates `tag_name_unique` WITH `WHERE tag.deleted_at IS NULL`) — proves the intent was full alignment
- `V0_0_29__add_collector.sql:4` — collector.name FULL UNIQUE (asymmetric with role.name)
- `V0_0_55__add_policies_and_roles.sql:42` + `V0_0_64__remove_is_deleted_field.sql:88-90` — role.name PARTIAL UNIQUE with deleted_at-IS-NULL (the prescriptive model)
- `ReactiveMetadataFieldRepositoryImpl.java:43-56` — `listInternalMetadata` filters soft-deleted via `addSoftDeleteFilter` (the read side reports "doesn't exist")
- `ReactiveAbstractCRUDRepository.java:113-126` — inherited `bulkCreate` has NO `ON CONFLICT` clause; UNIQUE collision throws `DataAccessException`
- `ExceptionUtils.java:63-65` — the user-facing collision error message: `"Internal metadata with this name already exists"`

**Existing-ADR-or-implied-prescription**: Cross-references ADR-CANDIDATE-125 (the platform's partial-unique-index + `ON CONFLICT WHERE deleted_at IS NULL DO UPDATE` ingestion-side race-protection idiom — confirmed at Tag in batch N). The implicit prescription was full V0_0_64 alignment across all soft-delete-enabled tables; metadata_field + collector are the alignment-incomplete tables.

**Proposed remedy**:
1. A new migration `V0_NEW__align_metadata_field_partial_indexes_with_deleted_at.sql` that:
   - DROPs `ix_unique_internal_name` and `ix_unique_external_name_type`
   - RECREATEs both with the additional `AND deleted_at IS NULL` predicate:
     - `CREATE UNIQUE INDEX ix_unique_internal_name ON metadata_field (name) WHERE origin = 'INTERNAL' AND deleted_at IS NULL;`
     - `CREATE UNIQUE INDEX ix_unique_external_name_type ON metadata_field (type, name) WHERE origin <> 'INTERNAL' AND deleted_at IS NULL;`
2. Pre-migration check: validate that no existing soft-deleted-row collision blocks the migration. If so, hard-delete the colliding soft-deleted rows first (operator-side data review required) OR rename them via `UPDATE metadata_field SET name = name || '_deleted_' || id WHERE deleted_at IS NOT NULL` (preserves audit trail).
3. Update `ReactiveMetadataFieldRepositoryImpl.ingestData` lines 93-104: the hardcoded `.where(ORIGIN.ne(INTERNAL))` MUST also become `.where(ORIGIN.ne(INTERNAL).and(DELETED_AT.isNull()))` to match the new partial-index predicate (otherwise `ON CONFLICT` fails to match the predicate). This is the brittle-hardcoded-where finding from the sidecar bugs_limitations.[5].
4. **Sibling action for collector.name**: a separate migration `V0_NEW__align_collector_name_partial_unique.sql` that drops the FULL unique constraint and recreates as partial `WHERE deleted_at IS NULL`. Pre-migration: same name-collision check.

**Severity rationale**: HIGH — actively blocks operator recovery from a benign UI action (delete + re-create) at the metadata_field surface. The fix is a small migration; the impact is potentially many operator-visible incidents until shipped. The collector.name sibling is LOW-severity (operators rarely delete + recreate collectors; metadata fields are more frequently churned). The fix is also a prerequisite for any future "recover-soft-deleted-metadata-field" UI endpoint.

**Suggested backlog grouping**: "Soft-delete partial-index alignment audit" — single cross-table audit batch covering metadata_field (HIGH priority — this scope) + collector.name (LOW priority — sibling finding) + any other soft-delete-enabled table where V0_0_64 alignment is incomplete (sweep prerequisite). Surface as a single cross-table audit + migration batch.

---

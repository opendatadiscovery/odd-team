## REFACTOR-239 — `policy.is_deleted` column is dead schema — soft-delete base writes only `deleted_at`; schema reader misled into expecting boolean tracking

**Severity**: MEDIUM
**Category**: dead-code (schema-level)
**Surfaced by**:
- `ReactivePolicyRepositoryImpl.md:bugs_limitations_corner_cases[3]`
- `ReactivePolicyRepositoryImpl.md:concepts.invariants[3]`
- `ReactivePolicyRepositoryImpl.md:implicit_adrs[4]`

**Description**: The DDL `V0_0_55__add_policies_and_roles.sql:26` declares `is_deleted boolean NOT NULL DEFAULT FALSE` on the `policy` table. The soft-delete base `ReactiveAbstractSoftDeleteCRUDRepository.java:106-110` (`getDeleteChangedFields`) only writes `deletedAtField` (i.e., `deleted_at`); the application never writes `is_deleted`. Reads (`addSoftDeleteFilter` at lines 96-104) use only `deletedAtField.isNull()`. A `Grep` for `IS_DELETED|is_deleted` returns no application-code reads or writes.

**The column is therefore always `FALSE`** even for soft-deleted rows. A schema reader (DBA, future maintainer, operator running ad-hoc SQL for forensics) who expects `is_deleted` to track delete state will reach the wrong conclusion: every row reports `is_deleted = FALSE`, including rows where `deleted_at IS NOT NULL`. The two columns disagree on delete state.

Cross-cutting concern: the same DDL pattern is visible across other tables (`data_entity`, etc. — verified at the schema level). The `is_deleted` boolean is consistently dead schema across the platform.

The wisdom-test verdict is GAP (not ADR): there is no comment in any migration, no documentation, no architectural rationale for keeping the dead column. The sidecar's `implicit_adrs[4]` explicitly marks this with `confidence: MEDIUM` — the absence of comment makes the intent unclear. If the column WAS intentionally kept (as a future trigger-mirror target, as defensive belt-and-braces design), no maintainer-visible signal documents that intent. The maintainer's choice is documented as ambiguous; the schema-cleanup interpretation has more evidence.

**Primary source citations**:
- `V0_0_55__add_policies_and_roles.sql:26` — the DDL declaration
- `ReactiveAbstractSoftDeleteCRUDRepository.java:106-110` — `getDeleteChangedFields` only writes deletedAtField
- `ReactiveAbstractSoftDeleteCRUDRepository.java:96-104` — `addSoftDeleteFilter` reads only `deletedAtField.isNull()`
- Grep for `IS_DELETED|is_deleted` across `odd-platform-api/src/main/java` returns no application reads or writes for the policy table
- contrast with the `data_entity.status = DELETED` pattern in `ReactiveDataEntityRepositoryImpl` — that subsystem overrides the base to use a status-machine for soft-delete, intentionally bypassing the deleted_at column

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-068 (NEW — two-tier soft-delete inheritance taxonomy) describes the soft-delete architecture. The dead column is NOT part of the architecture; it is leftover from an earlier design iteration.

**Proposed remedy**: Two paths, maintainer chooses:
1. **Schema cleanup** (preferred): drop the `is_deleted` column via a new migration:
   ```sql
   ALTER TABLE policy DROP COLUMN IF EXISTS is_deleted;
   ALTER TABLE role DROP COLUMN IF EXISTS is_deleted;
   -- repeat for every table where is_deleted is dead schema
   ```
   Re-run jOOQ codegen to remove the corresponding POJO field. Test impact: bulk-create/update tests may fail if they assert `is_deleted=false` on returned records — those assertions need removal too.
2. **Trigger-mirror** (defensive belt-and-braces): keep the column but add a trigger that mirrors `deleted_at IS NOT NULL` to `is_deleted`:
   ```sql
   CREATE OR REPLACE FUNCTION policy_is_deleted_mirror() RETURNS TRIGGER AS $$
   BEGIN
     NEW.is_deleted := (NEW.deleted_at IS NOT NULL);
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;
   CREATE TRIGGER policy_is_deleted_trigger BEFORE INSERT OR UPDATE ON policy
     FOR EACH ROW EXECUTE FUNCTION policy_is_deleted_mirror();
   ```
   The column becomes informational but consistent.

Option (1) is the lower-debt path; option (2) is the lower-risk path if external tooling reads `is_deleted` directly. The maintainer's choice depends on whether any out-of-process consumer (analytics tools, BI dashboards, custom DB scripts) reads the column.

**Severity rationale**: MEDIUM — schema clarity gap. The dead column misleads schema readers and adds confusion to forensics queries. Not a security or data-integrity issue, but a code-quality / documentation-quality regression that compounds over time.

**Suggested backlog grouping**: `Schema cleanup sprint` — bundle with the broader dead-schema audit (visible across multiple tables per the sidecar evidence). Pair with the migration discipline that produces ADR-CANDIDATE-068.

---

## REFACTOR-570 — STRENGTHEN of REFACTOR-085: Activity table monotonic growth, READ-side primary source confirmed at `ReactiveActivityRepositoryImpl` — verified NO `deleteFrom(ACTIVITY)` anywhere in the repository file; the FK to data_entity may cascade-delete activity rows on data-entity hard-delete (forensic-history-erasure class)

**Severity**: HIGH (silent data growth + potential forensic-history erasure)
**Category**: missing-retention
**Surfaced by** (BATCH-VAL-LSN-019-B):
- `ReactiveActivityRepositoryImpl.md:bugs_limitations_corner_cases[0]` (CANARY HEADLINE — "**The activity table grows monotonically — no DELETE path, no non-empty-partition DROP path, the docs' 'retention and partitioning are controlled' framing is misleading**. ... A high-volume deployment (1M events/day) accumulates ~365GB+/year of audit data with no recovery path short of manual `DROP TABLE activity_YYYYMMDD_YYYYMMDD`" — HIGH; mirrors ActivityTablePartitionManager bugs_limitations_corner_cases[0])
- `ReactiveActivityRepositoryImpl.md:bugs_limitations_corner_cases[6]` ("**INNER JOIN to DATA_ENTITY (line 219) means orphan activity rows after data_entity hard-delete disappear from reads**. If a data_entity row is hard-DELETEd (vs soft-deleted via STATUS=DELETED), the FK constraint at V0_0_48__add_activity.sql:12 (`REFERENCES data_entity (id)`) is `ON DELETE`-unspecified — Postgres defaults to NO ACTION, which would BLOCK the delete. BUT DataEntityHousekeepingJob (per F-010 sidecar) DOES cascade-delete data_entity rows past TTL — which would cascade-delete the activity rows too (if the FK has CASCADE) OR block the housekeeping job's delete (if no CASCADE)" — MEDIUM)
- `ActivityEmptyPartitionsHousekeepingJob.md:bugs_limitations_corner_cases[0]` ("Functionally a near-no-op on steadily-used platforms... On a platform with daily activity, NO partition ever empties out... silent monotonic growth of the activity table on any non-dormant platform" — HIGH; the partition-side primary source)
- Existing REFACTOR-085 (the original entry — write-side / partition-side primary source from batch 2026-05-10B)

**Description**: This is a STRENGTHEN of REFACTOR-085 with two new primary sources from VAL-LSN-019-B batch:

1. **READ-side confirmation (NEW)**: `ReactiveActivityRepositoryImpl.java:1-310` end-to-end — verified file:line — contains ZERO `deleteFrom(ACTIVITY)` calls. The repository implements INSERT + SELECT + COUNT only; no DELETE machinery. The repository's class declaration on line 45 (`class ReactiveActivityRepositoryImpl implements ReactiveActivityRepository`) does NOT extend `ReactiveAbstractSoftDeleteCRUDRepository` or `ReactiveAbstractCRUDRepository` — the type-level signal that activity is APPEND-ONLY (codified as ADR-CANDIDATE-198 NEW from this batch).

2. **Partition-side confirmation (RE-VALIDATED)**: `ActivityEmptyPartitionsHousekeepingJob` is the ONLY housekeeping job touching activity partitions, and it ONLY drops EMPTY past partitions (per `PartitionServiceImpl.java:108-115` + the `isPartitionInPast(partitionName, baseline) && isPartitionEmpty(connection, partitionName)` AND condition). On any non-dormant platform, partitions never empty out → the job is effectively a no-op → no retention enforcement.

3. **NEW forensic-history-erasure concern (added by this STRENGTHEN)**: The FK constraint `activity_data_entity_id_fk` (`V0_0_48__add_activity.sql:12`) references `data_entity(id)`. Per F-010's enumeration of `DataEntityHousekeepingJob`, the platform DOES cascade-delete soft-deleted data-entity rows past TTL (30 days per `housekeeping.ttl.data_entity_delete_days`). The FK's `ON DELETE` clause is unspecified in the migration — Postgres defaults to `NO ACTION` which would BLOCK the housekeeping delete IF activity rows reference the data_entity. The actual production behaviour depends on:
   - Did a later migration add `ON DELETE CASCADE` to the FK?
   - If yes: housekeeping's data-entity-delete CASCADE-deletes the activity rows → forensic-history erasure (the audit trail of who created a now-deleted data-entity is gone).
   - If no: housekeeping fails to delete data-entity rows that have activity history → the data-entity housekeeping job blocks indefinitely → REFACTOR-085 + REFACTOR-198 (the V0_0_48 `applyStatus` ordering bug from batch F) compound.

   **Probe needed** to verify the actual ON DELETE clause via `pg_catalog.pg_constraint` (P-024 — emit).

**Operator-visible consequence (composed)**:
1. Activity table grows forever — disk usage accumulates linearly with deployment age × events/day.
2. The docs' "retention and partitioning are controlled by `odd.activity.partition-period`" framing (per `activity-feed.md` WebFetch) IS misleading — that property controls partition WIDTH, not retention.
3. The data-entity housekeeping cascade may erase the audit trail for forensic queries — a compliance auditor reviewing "who created data-entity X" may find X soft-deleted past TTL and ALL its activity rows ALSO gone (cascaded by FK).

**Cross-cutting context**: This is the most LSN-001-shape finding in the catalog — silent default + destructive action + docs-misleading framing. Combines with REFACTOR-557 (race silent-data-loss), REFACTOR-085 (this STRENGTHEN's parent), F-010's housekeeping subsystem, and the data-entity cascade.

**Primary source citations**:
- `ReactiveActivityRepositoryImpl.java:1-310` end-to-end (verified no `deleteFrom(ACTIVITY)` — comprehensive grep)
- `ReactiveActivityRepositoryImpl.java:45` (class declaration — verified no soft-delete CRUD inheritance)
- `V0_0_48__add_activity.sql:1-13` (verified no `updated_at` / `deleted_at` columns — append-only at schema level)
- `V0_0_48__add_activity.sql:12` (the FK constraint — ON DELETE unspecified)
- `ActivityEmptyPartitionsHousekeepingJob.java:1-17` (verified — only EMPTY partition drops)
- `PartitionServiceImpl.java:108-115` (verified — `isPartitionInPast && isPartitionEmpty` AND)
- Existing REFACTOR-085 (the parent entry — strengthened with these NEW evidence points)
- WebFetch `/features/active-platform-features/activity-feed#configuration` (verified — "retention and partitioning are controlled" framing — misleading)
- Probe `P-024` (NEW emit) — verify the actual ON DELETE clause on the FK

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-198 (NEW from this batch — "Activity table is APPEND-ONLY") codifies the type-level intent. The maintainer's design IS append-only. The GAP: the docs frame retention as a controllable property (per the misleading `activity-feed.md` framing) which it ISN'T at the row level — operators are misled into believing they can configure retention.

**Proposed remedy**: This STRENGTHEN proposes the same Triple-axis fix as REFACTOR-085 originally, with the additional NEW item:

1. **DOC-LEVEL fix**: Update `activity-feed.md#configuration` to add an explicit caveat: "The activity table grows monotonically — non-empty partitions are NEVER dropped. The `odd.activity.partition-period` property controls partition WIDTH, not retention. Operators on multi-year deployments must implement manual cleanup via `DROP TABLE activity_YYYYMMDD_YYYYMMDD` for past partitions." 

2. **CODE-LEVEL fix — add a configurable retention TTL**: Introduce `housekeeping.ttl.activity_days` (or similar) on `HousekeepingTTLProperties`. Implement an `ActivityHousekeepingJob` (alongside the existing 3-row + 2-partition jobs) that:
   - Time-based DELETE of `activity` rows older than `ttl.activity_days`.
   - Triggers `ActivityEmptyPartitionsHousekeepingJob` to drop the now-emptied past partitions.
   Trade-off: forensic completeness vs disk economy. Operators choose the TTL.

3. **NEW FROM THIS STRENGTHEN — verify and document FK ON DELETE behaviour**: Run P-024. If the FK is `ON DELETE CASCADE` → document that data-entity housekeeping erases the audit trail (operators must back up before purge). If the FK is `ON DELETE NO ACTION` → document that data-entity housekeeping fails on entities with activity history (operators must manually clean activity rows first).

4. **NEW FROM THIS STRENGTHEN — re-examine `ON DELETE` semantics**: If the FK was historically `ON DELETE CASCADE` (silent forensic erasure), consider a migration to `ON DELETE NO ACTION` + an explicit housekeeping job that handles activity cleanup before the data-entity cascade. Preserves audit trail integrity.

**Severity rationale**: HIGH — silent data growth + forensic-history erasure compound. Same severity as REFACTOR-085's original. This STRENGTHEN adds the FK-cascade concern as an additional dimension.

**Suggested backlog grouping**: `SEC-NNN activity-feed retention + forensic-integrity sprint`. Pair with the original REFACTOR-085, REFACTOR-557 (silent race), REFACTOR-578 (DROP TABLE privilege docs).

---

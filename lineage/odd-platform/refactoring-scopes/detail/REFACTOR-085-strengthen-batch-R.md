## REFACTOR-085 — STRENGTHENED BATCH R — Activity-table monotonic growth now has SQL-substrate primary source (ReactiveActivityRepositoryImpl)

**Severity unchanged**: HIGH
**Updated support count**: now **3 sidecars triangulated** (batch B ActivityTablePartitionManager → batch D HousekeepingTTLProperties → batch R ReactiveActivityRepositoryImpl)
**Batch**: R (2026-05-20)

**New surfaced_by**:
- `ReactiveActivityRepositoryImpl.md:bugs_limitations_corner_cases.[0]` (HIGH) — SQL-substrate primary source: "The activity table grows monotonically — no DELETE path, no non-empty-partition DROP path, the docs' 'retention and partitioning are controlled' framing is misleading. … A high-volume deployment (1M events/day) accumulates ~365GB+/year of audit data with no recovery path short of manual `DROP TABLE activity_YYYYMMDD_YYYYMMDD`." ZERO `deleteFrom(ACTIVITY)` calls in the repository file (grep-verified across all 310 lines).
- `ReactiveActivityRepositoryImpl.md:known_performance_gaps.[0]` (HIGH) — performance-lens primary source
- `ReactiveActivityRepositoryImpl.md:scaling_characteristics.[3]` — scaling-lens primary source: "Postgres planner overhead grows with partition count even when partition pruning is effective."

**Cross-batch insight**: The retention gap is now anchored at THREE independent layers:
1. **Housekeeping-job tier (batch B)**: `ActivityTablePartitionManager` + `ActivityEmptyPartitionsHousekeepingJob` only drops EMPTY partitions
2. **Config-properties tier (batch D)**: `HousekeepingTTLProperties` confirms the activity table has NO time-based retention field
3. **Repository / SQL-substrate tier (batch R, NEW)**: `ReactiveActivityRepositoryImpl` has ZERO `deleteFrom(ACTIVITY)` paths — the data structure has no retention at the persistence layer

The fix prescription is now anchored at all three layers. REFACTOR-441 (NEW batch R) is the standalone primary-source scope; this strengthen consolidates the cross-batch triangulation.

**Companion findings (batch R adds)**:
- The doc-site framing of `odd.activity.partition-period` as controlling "retention and partitioning" is now confirmed MISLEADING from FOUR perspectives (partition-manager docs, housekeeping config docs, the actual housekeeping job, the actual repository).
- The audit-table-schema-rooted ADR (ADR-CANDIDATE-146 batch R) compounds this: the activity table IS the only audit surface (RBAC mutations cannot be audited elsewhere due to schema NOT NULL FK). An operator cleaning up old activity rows loses their entire audit trail with no replacement table.

**Severity unchanged at HIGH**. The cross-tier consolidation strengthens the case for the retention-engineering work item; the underlying severity is unchanged.

---

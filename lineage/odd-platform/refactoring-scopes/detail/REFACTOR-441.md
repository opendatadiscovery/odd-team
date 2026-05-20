## REFACTOR-441 — Activity-table monotonic growth at the SQL-substrate — primary-source from ReactiveActivityRepositoryImpl (cross-batch family with REFACTOR-085)

**Severity**: HIGH
**Category**: silent-data-growth / no-retention
**Batch**: R (2026-05-20)
**Pillars affected**: [P-07-active-platform-features (Activity Feed), P-08-management-administration (operator-facing operational hygiene)]

**Surfaced by**:
- `ReactiveActivityRepositoryImpl.md:bugs_limitations_corner_cases.[0]` (HIGH): "The activity table grows monotonically — no DELETE path, no non-empty-partition DROP path, the docs' 'retention and partitioning are controlled' framing is misleading. `ActivityEmptyPartitionsHousekeepingJob` only DROPs partitions that contain zero rows (ActivityEmptyPartitionsHousekeepingJob.java:1-18; extends EmptyPartitionsHousekeepingJob which only handles empty partitions). Once a partition has any activity row, it persists forever. A high-volume deployment (1M events/day) accumulates ~365GB+/year of audit data with no recovery path short of manual `DROP TABLE activity_YYYYMMDD_YYYYMMDD`."
- `ReactiveActivityRepositoryImpl.md:known_performance_gaps.[0]` (HIGH): "Unbounded growth of activity table (mirrors ActivityTablePartitionManager bugs_limitations_corner_cases[0] from the upstream sidecar). The repository writes; nothing deletes. Multi-year deployments accumulate 100s of GB of audit data with no recovery path."
- `ReactiveActivityRepositoryImpl.md:scaling_characteristics.[3]`: "Activity table size growth is unbounded — no DELETE path, no DROP of non-empty partitions. After 5+ years on a 1M-events/day deployment, the partition count grows to 60+ (at 30-day cadence) or 250+ (at 7-day cadence — operators who tuned per the docs' 'narrower partitions for performance' guidance). Postgres planner overhead grows with partition count even when partition pruning is effective."
- cross-batch — already-tracked REFACTOR-085 (batch-B finding from ActivityTablePartitionManager) — STRENGTHENS with SQL-substrate primary source
- cross-batch — already-tracked REFACTOR-085 strengthen at batch D from HousekeepingTTLProperties — confirms the activity table has NO time-based retention field in the config-properties tier

**Statement**: The `activity` table has NO DELETE path anywhere in the codebase. `grep -r "deleteFrom(ACTIVITY)" odd-platform-api/` returns ZERO matches in `ReactiveActivityRepositoryImpl.java:1-310` (the persistence layer) AND in the entire codebase. The only housekeeping for `activity` is `ActivityEmptyPartitionsHousekeepingJob` (`ActivityEmptyPartitionsHousekeepingJob.java:9-17`) which extends `EmptyPartitionsHousekeepingJob` and only DROPS partitions that contain zero rows. Once a partition has ANY row, it persists forever.

Multi-year deployments accumulate 100s of GB of audit data:
- 1M events/day × 365 days × ~1KB/row (with JSONB old_state/new_state payloads) = ~365GB/year
- Per the docs' guidance to "use narrower partitions for performance," operators set `odd.activity.partition-period` to 7 days, which produces 250+ partitions over 5 years
- Postgres planner overhead grows with partition count even when partition pruning is effective (each query plan considers all partitions before pruning)

The doc-site framing of `odd.activity.partition-period` as controlling "retention and partitioning" (per ActivityTablePartitionManager batch K doc_drift_findings) is MISLEADING — there is NO retention. Partitioning improves query performance via partition pruning, but does NOT delete data.

**Operator-side consequences**:
- Database storage cost grows linearly forever
- Backup size grows linearly forever
- Postgres planner overhead grows with partition count
- There is no admin endpoint, no operator script, no documented recovery path
- Combined with REFACTOR-441 (cross-tier silence — partition manager + housekeeping + repository all NULL the retention conversation): operators cannot self-discover the gap
- ADR-CANDIDATE-146 (audit table is schema-rooted to data-entity events) means the activity table IS the only audit surface; an operator who cleans up old activity rows loses their entire audit trail with no replacement

**Evidence** (SQL-tier substrate primary source NEW batch R):
- `ReactiveActivityRepositoryImpl.java:1-310` — grep-verified ZERO `deleteFrom(ACTIVITY)` matches
- `ActivityEmptyPartitionsHousekeepingJob.java:9-17` — only EMPTY partition drops
- cross-reference: `ActivityTablePartitionManager` batch K bugs_limitations_corner_cases.[0]
- `V0_0_48__add_activity.sql:13` — PARTITION BY RANGE; no DROP-non-empty mechanism, no TTL mechanism
- cross-reference: `HousekeepingTTLProperties` batch D — confirms the activity table has NO time-based retention field in the config-properties tier
- doc-side framing: `features/active-platform-features/activity-feed#configuration` (per ActivityTablePartitionManager batch K WebFetch finding) — "retention and partitioning are controlled by" is the misleading framing

**Existing-ADR-or-implied-prescription**: No ADR. The implicit prescription (per docs) was "partition-period controls retention"; this is INCORRECT. STRENGTHENS REFACTOR-085 (which surfaced from the upstream side at ActivityTablePartitionManager). Cross-references ADR-CANDIDATE-146 (audit-log structural scope — codifies what the audit covers; this scope is the orthogonal "how long does it stay" question).

**Proposed remedy**:
1. Add a `housekeeping.activity.retention-days` configuration property (mirror of `housekeeping.data-entity.ttl` from HousekeepingTTLProperties)
2. Implement `ActivityRetentionHousekeepingJob` that DROPs partitions older than the retention window (partitions are the right granularity — non-empty partitions can be dropped cleanly via `DROP TABLE activity_YYYYMMDD_YYYYMMDD` once they're entirely past the retention horizon)
3. Default retention: documentable choice — recommend 365 days as a starting point; operator-tunable
4. Document the retention policy on `features/active-platform-features/activity-feed#configuration` — CORRECT the misleading "retention and partitioning are controlled by" framing
5. Surface a one-time migration path for existing deployments with > 1 year of data (`DROP TABLE activity_*` for partitions past the retention horizon)
6. Optionally: export the dropped partitions to S3 (cold-storage audit archive) before the DROP — separate operator opt-in for compliance-bound deployments

**Severity rationale**: HIGH — silent-data-growth class (same as LSN-001 attachment-storage default that caused production data loss; this is the inverse — silent growth rather than silent erasure, but operationally lethal at multi-year scale). The doc-side misleading framing is the secondary failure (operators are actively misled to believe partition-period == retention).

**Suggested backlog grouping**: "Audit retention" — paired with REFACTOR-085 (the upstream-tier finding); together they form a single retention-engineering work item. The fix prescription is now anchored at THREE tiers (partition-manager + config-properties + repository), so the fix is cross-tier coordinated. Companion DOC-NNN to CORRECT the misleading partition-period framing.

---

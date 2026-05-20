## REFACTOR-564 — `ActivityEmptyPartitionsHousekeepingJob` empty-check uses unindexed `SELECT count(*) = 0` instead of `EXISTS(SELECT 1 ... LIMIT 1)` — per-cycle sequential scan of every past partition (potentially gigabytes on populated multi-year deployments)

**Severity**: LOW (performance regression; only material on populated past partitions, which by definition this job never drops)
**Category**: performance
**Surfaced by**:
- `ActivityEmptyPartitionsHousekeepingJob.md:performance.known_performance_gaps[0]` (CANARY HEADLINE — "**SELECT count(*) = 0 is an unindexed sequential scan on every past partition** — measure this on a populated activity partition with 10M+ rows; if the cost is multi-second per partition × 60+ partitions × 96 cycles/day, this is a significant hidden DB load on multi-year deployments. The fix would be `WHERE NOT EXISTS (SELECT 1 FROM <partition> LIMIT 1)` which short-circuits on first row" — P-013 emitted)
- `ActivityEmptyPartitionsHousekeepingJob.md:stress_findings.Q-A.4` (PROBE-NEEDED P-013 — measure I/O cost on populated multi-partition activity table)
- `PartitionServiceImpl.java:134` (`SELECT count(*) = 0 FROM %s` — verified file:line, no LIMIT, no EXISTS rewrite)
- `application.yml:254` (`org.opendatadiscovery.oddplatform.housekeeping: info` — debug log suppressed by default → operator has no visibility into per-cycle cost)
- Probe `P-013` (`lineage/odd-platform/probes/P-013.yaml`) — pending measurement

**Description**: The empty-partition check in `PartitionServiceImpl.isPartitionEmpty(connection, partitionName)` (`:133-142`) executes:

```sql
SELECT count(*) = 0 FROM <partition_name>
```

In PostgreSQL semantics: this evaluates `count(*)` over EVERY visible tuple in the partition, then compares to zero. There is no short-circuit on the first row found.

For populated partitions:
- A 60-day-wide partition with 10M events/day = 600M rows.
- `SELECT count(*)` from 600M rows = sequential scan of every page; cost scales with the partition's data size on disk.
- Postgres has NO fast-count optimization for partitioned tables in this case — the count is computed by reading every tuple's visibility bit.
- For a 10M-row populated partition with average row size of 200 bytes = 2 GB of data per partition; the count(*) reads ~2GB of pages per call.

**Per-cycle overhead** (96 cycles/day × N populated partitions × seq-scan cost): assuming 60 populated past partitions (5 years deployment × 12 partitions/year at 30-day cadence) × 2 GB/partition = 120 GB read PER 15-minute housekeeping cycle. Even with OS page cache hit, the I/O cost is non-trivial.

**The cost is hidden** because:
- `EmptyPartitionsHousekeepingJob.doHousekeeping` logs only at DEBUG level (suppressed by default per `application.yml:254`).
- No Micrometer Timer wraps the operation (per REFACTOR-577 — observability gap).
- The job never DROPs anything on populated platforms (per REFACTOR-085 — non-empty partitions are never dropped, so the empty-check is effectively a "verify-this-is-non-empty-just-to-confirm" loop on every cycle).

The fix is straightforward: rewrite to use `EXISTS`:

```sql
-- BEFORE (current):
SELECT count(*) = 0 FROM <partition_name>;

-- AFTER (proposed):
SELECT NOT EXISTS (SELECT 1 FROM <partition_name> LIMIT 1);
```

`EXISTS` short-circuits on the first row found. For NON-empty partitions (the common case), the query reads ONE row's index entry — sub-millisecond. For EMPTY partitions (the rare case where this job actually drops), the cost is identical to the current count(*) since the scan must verify zero-rows.

**Operator-visible consequence**: hidden DB load on multi-year deployments. The activity-feed-feature's housekeeping subsystem is silently consuming I/O bandwidth on every 15-minute cycle that could be reclaimed for actual workload. The defect compounds with REFACTOR-085 (activity table grows monotonically) — the more populated the activity table, the worse this gets.

**Cross-cutting context**: This is a standard SQL anti-pattern (`COUNT(*) = 0` instead of `NOT EXISTS`). The defect is COMMON across the codebase (probe-out-of-scope to enumerate, but worth a `grep` sweep). The mechanical fix in `PartitionServiceImpl` is one-line.

**Primary source citations**:
- `PartitionServiceImpl.java:134` (verified: `SELECT count(*) = 0 FROM %s` — no LIMIT, no EXISTS)
- `PartitionServiceImpl.java:133-142` (the `isPartitionEmpty` method)
- `EmptyPartitionsHousekeepingJob.java:16-33` (the caller — per-cycle invocation per past partition)
- `application.yml:254` (DEBUG logging suppressed; operator has no signal)
- Probe `P-013` for measuring the actual production I/O cost
- Postgres documentation on EXISTS vs COUNT(*) short-circuit semantics

**Existing-ADR-or-implied-prescription**: NONE. The defect is incidental — a maintainer wrote `count(*) = 0` (idiomatic but performance-suboptimal) without considering the partitioned-table cost.

**Proposed remedy**: One option, no decision tree needed:

```java
// PartitionServiceImpl.isPartitionEmpty — BEFORE:
private boolean isPartitionEmpty(Connection connection, String partitionName) {
    final String query = "SELECT count(*) = 0 FROM %s".formatted(partitionName);
    // ...
}

// AFTER:
private boolean isPartitionEmpty(Connection connection, String partitionName) {
    final String query = "SELECT NOT EXISTS (SELECT 1 FROM %s LIMIT 1)".formatted(partitionName);
    // ...
}
```

Mechanical replacement. Same return type (boolean), same SQL-injection posture (still uses `String.format` on a system-generated partition name — see REFACTOR-576 for the related concern about pattern matching), drastically improved performance characteristic.

For a complete sprint:
- Add a Micrometer Timer wrap on `isPartitionEmpty` to surface the cost in production observability.
- Add a code comment at the method explaining "`NOT EXISTS` short-circuits on first row; preferred over `count(*) = 0` for partitioned tables".
- Optional: grep the codebase for other `count(*) = 0` patterns and apply the same fix consistently.

**Severity rationale**: LOW — performance regression bounded by:
- Only material on populated past partitions (which by REFACTOR-085 are exactly the partitions this job never drops).
- The defect compounds linearly with partition count (worse on multi-year deployments).
- The fix is mechanical and ZERO-risk.
- No operator-visible defect today (no UI/correctness impact); the hidden DB load is a quiet cost.

**Suggested backlog grouping**: `PERF-NNN housekeeping efficiency sprint`. Pair with REFACTOR-577 (no metrics on housekeeping observability — once metrics are in place, this defect becomes visible), REFACTOR-085 (the unbounded growth that exposes this), REFACTOR-147 (per-job parallelism — also housekeeping efficiency), REFACTOR-148 (no backlog metric — also housekeeping observability).

---

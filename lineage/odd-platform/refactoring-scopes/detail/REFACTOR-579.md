## REFACTOR-579 — Housekeeping `DROP TABLE <activity_partition>` takes `ACCESS EXCLUSIVE` lock on the parent activity table — blocks ALL concurrent SELECT/INSERT routing to that partition during the lock window; empirically observable under high-write-rate × partition-drop combinations

**Severity**: LOW (lock-contention class; harmless for steady-state low-write deployments)
**Category**: lock-window-race
**Surfaced by**:
- `ReactiveActivityRepositoryImpl.md:bugs_limitations_corner_cases[8]` (CANARY HEADLINE — "**Housekeeping `DROP TABLE <activity_partition>` takes ACCESS EXCLUSIVE — blocks concurrent SELECT/INSERT on the parent activity table while the DROP holds the lock**. PartitionServiceImpl.java:120-127 runs as bare JDBC DDL via the housekeeping connection... the DDL takes an ACCESS EXCLUSIVE lock on the target partition. PostgreSQL's partition-routing logic for the parent `activity` table — used by every R2DBC INSERT and every R2DBC SELECT against the parent — needs ACCESS SHARE on the targeted child partition. While the DROP is in flight, all concurrent INSERTs and SELECTs that touch THAT partition's date range BLOCK. The DROP is per-empty-past-partition, so the blocking window is short for any given partition; BUT under a 15-min housekeeping rate with N empty partitions, the blocking can accumulate to N × DROP-duration" — MEDIUM per sidecar, classified as LOW here because (a) DROP is metadata-only in PG 12+, so the lock window is milliseconds, (b) the partitions being dropped are EMPTY past partitions — no concurrent INSERTs touch them in practice, (c) Probe P-022 emitted for empirical confirmation)
- `ActivityEmptyPartitionsHousekeepingJob.md:performance.resource_allocation` ("`DROP TABLE` acquires `ACCESS EXCLUSIVE` lock on the parent `activity` table briefly (Postgres 12+ optimisation for partition drop is mostly metadata-only, BUT the lock is still required) — blocks concurrent INSERTs to OTHER partitions of the same parent for the lock duration")
- `PartitionServiceImpl.java:120-127` (the DROP TABLE DDL)
- `HousekeepingJobManager.java:25-26` (15-min fixedRate)
- Probe `P-022` (`lineage/odd-platform/probes/P-022.yaml`) — pending experimental confirmation

**Description**: `PartitionServiceImpl.dropPartition` (`:120-127`):

```sql
DROP TABLE <partition_name>
```

Postgres semantics:
- DROP TABLE on a partition acquires `ACCESS EXCLUSIVE` on the partition (the child table).
- For partition routing on the parent `activity` table to work for concurrent operations, Postgres needs `ACCESS SHARE` on the child partition (via the parent's lock).
- The `ACCESS EXCLUSIVE` lock CONFLICTS with `ACCESS SHARE` — concurrent INSERTs/SELECTs that route to the dropping partition BLOCK behind the DROP.

In PostgreSQL 12+, DROP TABLE on an empty partition is mostly a metadata-only operation completing in milliseconds. The lock window is short. But:
- A heavily-loaded system with N concurrent reads/writes against the activity table may queue behind the DROP.
- A multi-cycle housekeeping run with N partitions to drop accumulates N × DROP-duration of brief blocking.
- The blocking is observable under load testing; harmless under steady-state low-write deployments.

**Operator-visible consequence**: 
- Under normal load: imperceptible (millisecond pauses).
- Under heavy load (10K+ activity inserts/sec from ingestion or alerts): brief query stalls every 15 minutes (the housekeeping cycle).
- Under PATHOLOGICAL load (slow DROP due to lock contention, partition with metadata overhead) + the REFACTOR-557 race: a long DROP window + a concurrent INSERT lands in the window → REFACTOR-557 silent data loss.

**Cross-cutting context**: This is the **DDL lock-contention class** on a partitioned high-write table. Standard mitigations: schedule DDL during low-traffic windows, use `LOCK TABLE ... NOWAIT`, batch DROPs. The 15-minute housekeeping cadence is the AGGREGATING factor — if cadence were daily (off-hours), the contention disappears.

**Primary source citations**:
- `PartitionServiceImpl.java:120-127` (verified `DROP TABLE` DDL)
- `HousekeepingJobManager.java:25-26` (the 15-min `fixedRate`)
- Postgres documentation on partition-DDL lock-modes
- Probe `P-022` for measuring the actual lock-contention impact

**Existing-ADR-or-implied-prescription**: NONE. The 15-min housekeeping cadence is the cross-cutting choice (HousekeepingJobManager.java:25-26); no ADR explicitly defends it. The lock-contention consequence is implicit.

**Proposed remedy**: Three options:

1. **LOWEST cost — Accept and document**: Document the lock-contention behaviour at `activity-feed.md#configuration`. Operators running high-write deployments are aware of the implication.

2. **MEDIUM cost — Switch DDL to low-traffic-window scheduling**: Change the housekeeping cadence from 15-min `fixedRate` to a configurable cron (e.g. nightly 02:00) for the partition-drop jobs specifically. Trade-off: less-frequent cleanup, slightly more retention overhead.

3. **HIGHER cost — Use `LOCK TABLE ... NOWAIT` + retry**: Wrap the DROP in a `LOCK TABLE ... NOWAIT`; if blocked, defer to the next cycle. Spread the contention; no manual scheduling.

**Recommended**: Option 1 (accept and document) — the lock window is brief in practice. Investigate Option 2 for very-high-write deployments via Probe P-022.

**Severity rationale**: LOW — lock-contention class. Severity is bounded by:
- Postgres 12+ partition DROP is mostly metadata-only.
- Empty partitions (the target) have no concurrent INSERTs routing to them.
- The 15-min cadence is brief enough that contention windows are small in absolute terms.

**Suggested backlog grouping**: `PERF-NNN housekeeping efficiency sprint`. Pair with REFACTOR-557 (silent race), REFACTOR-564 (count efficiency), REFACTOR-577 (no metrics — visibility into lock contention).

---

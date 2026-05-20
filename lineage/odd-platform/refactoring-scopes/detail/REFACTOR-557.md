## REFACTOR-557 — `ActivityEmptyPartitionsHousekeepingJob` check-then-drop race window — `SELECT count(*) = 0` and `DROP TABLE` are non-transactional, non-locking; a concurrent `INSERT INTO activity` landing in the millisecond window after the count returns 0 but before DROP fires causes SILENT row loss

**Severity**: HIGH (silent data loss; LSN-001-shape)
**Category**: race-condition
**Surfaced by**:
- `ActivityEmptyPartitionsHousekeepingJob.md:stress_findings.Q-E.3` (CRITICAL FINDING — "THIS IS THE CRITICAL FINDING FOR THE 'EMPTY PARTITIONS' NAME PROMISE" — emitted P-012)
- `ActivityEmptyPartitionsHousekeepingJob.md:stress_findings.Q-B.2` ("the partition was empty when checked, NOT empty when dropped" — silent violation of the name's promise)
- `ActivityEmptyPartitionsHousekeepingJob.md:stress_findings.Q-E.5` ("the AND is not atomic" — empty-check + drop separable)
- `ActivityEmptyPartitionsHousekeepingJob.md:bugs_limitations_corner_cases[1]` ("Race window between empty-check and DROP TABLE — Postgres will queue one behind the other on the partition's lock, but ONE will win: if INSERT wins, it succeeds, then DROP TABLE proceeds to drop a now-non-empty table SILENTLY (no recheck), deleting the just-inserted row")
- `ReactiveActivityRepositoryImpl.md:bugs_limitations_corner_cases[8]` (the READ-side primary source: "Housekeeping DROP TABLE <activity_partition> takes ACCESS EXCLUSIVE — blocks concurrent SELECT/INSERT on the parent activity table while the DROP holds the lock"; the WRITE-INSERT during DROP is the race)
- `PartitionServiceImpl.java:108-117` (the two-statement non-transactional pattern: `count(*) = 0` SELECT followed by `DROP TABLE`, both on the same Connection, but NOT in a JOOQ `transaction(...)` block — UNLIKE `AlertHousekeepingJob.java:25` and `DataEntityHousekeepingJob.java:71` which DO wrap)

**Description**: `ActivityEmptyPartitionsHousekeepingJob` extends `EmptyPartitionsHousekeepingJob.doHousekeeping` (`EmptyPartitionsHousekeepingJob.java:16-33`), which calls `partitionService.getEmptyPastPartitions(connection, "activity", emptyList())` (line 21) to compute the drop-candidate list, then iterates and calls `partitionService.dropPartition(connection, partitionName)` (line 27) per candidate. The implementation in `PartitionServiceImpl`:

```
getEmptyPastPartitions(connection, "activity", emptyList()):           // PartitionServiceImpl.java:82-118
  for each partition_name in (SELECT FROM information_schema.tables WHERE LIKE 'activity_%'):
    if isPartitionInPast(partition_name, baseline)                     // line 110, name-parse check (no DB hit)
        && isPartitionEmpty(connection, partition_name):               // line 110, SQL: SELECT count(*) = 0 FROM <partition>
      add to result

dropPartition(connection, partition_name):                              // PartitionServiceImpl.java:121-127
  DROP TABLE <partition_name>                                          // RAW DDL, no IF EXISTS, no lock acquisition
```

The empty-check (`SELECT count(*) = 0`) and the DROP TABLE are **TWO separate PreparedStatements**, on the same `Connection`, BUT:
- NOT in a JOOQ `transaction(...)` block — the parent class does NOT wrap (contrast with `AlertHousekeepingJob.java:25` which DOES wrap, and `DataEntityHousekeepingJob.java:71` which DOES wrap).
- NOT under any advisory lock on the partition (the partition manager's advisory lock 90 covers CREATE, not DROP).
- NOT holding the partition's `ACCESS EXCLUSIVE` lock during the gap (Postgres only takes the lock at DROP TABLE statement execution, NOT during the prior SELECT).

**The race window**: between the `count(*) = 0` returning `true` and the `DROP TABLE` statement reaching Postgres, a concurrent path (`ActivityServiceImpl.createActivityEvent` → `saveReturning` → INSERT via R2DBC connection on a different pool slot) can:

1. Insert a new row into the activity table — Postgres's partition-routing logic auto-routes to the partition by `created_at` range.
2. The partition is the one the housekeeping job is about to drop (the partition is "past-window" per `isPartitionInPast` but a row WITH a `created_at` in the past range can still land here if the INSERT's `created_at` value falls in this partition's range — e.g. a clock-skewed write, or a back-dated activity event from `DateTimeUtil.generateNow()` at the request edge of the window).
3. The INSERT commits (R2DBC autocommit) — returns SUCCESS to the calling business mutation.
4. The housekeeping `DROP TABLE` arrives at Postgres; takes `ACCESS EXCLUSIVE`; succeeds; the partition is gone; the just-inserted row is GONE.
5. The original INSERT caller (a user mutation, an alert emit, an ingestion batch) saw `200 OK` from the platform — the audit row was committed-then-vanished. NO error surfaces back.

**Severity bounding**: the race is mechanistically real but rare in practice:
- The empty partition can only host new rows from `created_at` values that fall in its date range — for `partition-period=30`, a partition `activity_20240101_20240301` can only receive INSERTs whose `created_at` is in `[2024-01-01, 2024-03-01)`.
- The activity table is range-partitioned by `created_at` (V0_0_48). Steady-state writes use `DateTimeUtil.generateNow()` (UTC NOW) — modern wall-clock values land in the CURRENT partition, not in past partitions.
- The race triggers when (a) clock skew produces a backdated INSERT, OR (b) a system-event emit (alert, ingestion) explicitly uses a past `created_at` value (rare but not impossible), OR (c) test/dev environments where the operator manually re-runs jobs.

**Operator-visible consequence**: silent data loss on the audit trail. A row that was committed (the business mutation succeeded) is gone post-housekeeping. The original mutation caller has no way to detect this. Compliance auditors (SOX, GDPR records-of-processing) reviewing the audit trail see HOLES — but no audit log records the housekeeping DROP either (see REFACTOR-578 — DDL audit silence).

**The structural fix**: serialise the empty-check and the drop under a partition-level lock OR within a transaction.

**Primary source citations**:
- `PartitionServiceImpl.java:108-117` (the non-transactional two-statement pattern — verified file:line)
- `PartitionServiceImpl.java:121-127` (the `DROP TABLE` DDL — no `IF EXISTS`, no compensating retry)
- `PartitionServiceImpl.java:133-142` (the `SELECT count(*) = 0` predicate)
- `EmptyPartitionsHousekeepingJob.java:16-33` (the parent class's `doHousekeeping` — no `transaction(...)` wrapper)
- `AlertHousekeepingJob.java:25` (CONTRAST — DOES wrap in `transaction(...)`)
- `DataEntityHousekeepingJob.java:71` (CONTRAST — DOES wrap in `transaction(...)`)
- `HousekeepingJobManager.java:32-35` (the shared Connection from `pgConnectionFactory.getConnection()`)
- Probe P-012 emitted (in `lineage/odd-platform/probes/P-012.yaml`) to verify experimentally with a tight concurrent insert

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-199 (NEW from this batch — "EmptyPartitions structural enforcement of empty-only DROP via template method") codifies the intent that ONLY empty partitions are dropped — the empty-check is structurally enforced. The GAP is that the structural enforcement is **point-in-time at the SELECT** but the operator's mental model is **point-in-time at the DROP**. The "empty when dropped" promise is NOT enforced.

ADR-CANDIDATE-044 (Notifications lazy-create-no-drop) is the contrasting pattern — replication slots are lazy-create + manual-cleanup, never auto-drop, by intent. The Activity partition policy DIFFERS — auto-drop is enabled, but the empty-check race window is undefended.

**Proposed remedy**: Three options the maintainer can choose between (in increasing structural impact):

1. **LOWEST cost — re-check empty under the DROP's `ACCESS EXCLUSIVE` lock**: Modify `PartitionServiceImpl.dropPartition` to wrap in a transaction with a re-check:
   ```java
   DSL.using(connection).transaction(ctx -> {
       LOCK TABLE <partition> IN ACCESS EXCLUSIVE MODE;
       if (count(*) > 0 FROM <partition>) {
           log.warn("Partition {} became non-empty between empty-check and drop; SKIPPING", partitionName);
           return;
       }
       DROP TABLE <partition>;
   });
   ```
   The `LOCK TABLE ... IN ACCESS EXCLUSIVE` blocks new INSERTs from acquiring; the re-check inside the lock proves the partition is empty AT the moment of drop. If a concurrent INSERT landed, the re-check finds N > 0 and skips. The cost: the partition is retained for the next 15-minute cycle (next check probably succeeds; eventual consistency).

2. **MEDIUM cost — serialize via partition manager advisory lock 90**: The CREATE side already uses advisory lock 90 (`ActivityTablePartitionManager`). Extend the DROP side to acquire the same lock — the lock serializes ALL partition lifecycle ops (create + drop) for the activity table. INSERTs are NOT serialized (they take row-level locks, not advisory locks) — so the race window is preserved BUT bounded by the create-side lock holding, which is shorter than the drop-side window.

3. **HIGHEST cost — partition metadata table with `FOR UPDATE`**: Add a `partition_lifecycle` metadata table tracking partition state (`active`, `marked_for_drop`, `dropped`). The housekeeping job transitions partition to `marked_for_drop` (UPDATE WITH FOR UPDATE lock); subsequent INSERTs check the metadata before committing (refuses INSERTs to `marked_for_drop` partitions); housekeeping then DROPs. Heavy machinery; preserves audit-trail integrity at the cost of write-path complexity.

**Recommended**: Option 1 (re-check empty under ACCESS EXCLUSIVE lock). Mechanical change to `PartitionServiceImpl.dropPartition`. The transaction wrapper + LOCK TABLE adds milliseconds to drops; the safety improvement (silent data loss eliminated) is substantial.

**Severity rationale**: HIGH — this is the silent-data-loss class that LSN-001 (attachment ephemeral default) is the canonical example of. The mechanism is mechanistically real, the operator-visible consequence is severe (audit-trail holes are forensic-integrity violations), and the fix is local (one function in `PartitionServiceImpl`). Severity is bounded by:
- The race is rare in production (clock-aligned steady-state writes hit current partitions, not past partitions).
- The audit trail is the only artifact at risk; business data (data entities, alerts, etc.) is unaffected.
- The fix is mechanical and high-leverage.

**Suggested backlog grouping**: `SEC-NNN activity-partition lifecycle hardening sprint`. Pair with REFACTOR-085 (activity table monotonic growth — also partition lifecycle), REFACTOR-086 (silent-fail swallow on CREATE failure — partition lifecycle observability), REFACTOR-578 (DROP TABLE privilege documentation), REFACTOR-577 (no metrics on the housekeeping job).

This REFACTOR's headline status: this is the **most severe finding from VAL-LSN-019-B canary B (Activity)**. The Stress Protocol's Category E (Resource boundaries) surfaced exactly the silent-data-loss class the methodology was designed to catch.

---

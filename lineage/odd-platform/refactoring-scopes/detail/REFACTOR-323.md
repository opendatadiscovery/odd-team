## REFACTOR-323 — `HousekeepingJobManager` ShedLock window `lockAtMostFor=14m` against `fixedRate=15m` — 60-second slack is the smallest plausible coordination window; a cycle running ≥14 minutes can release the lock before commit and allow a second instance to acquire on the next 15-minute slot

**Severity**: LOW (theoretical until backlog grows)
**Category**: race-condition (lock-window-race)
**Pillars affected**: [P-08-management-administration]
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__HousekeepingJobManager.md:bugs_limitations_corner_cases.[3]` (LOW) — "`lockAtMostFor = \"14m\"` is dangerously close to `fixedRate = 15 minutes` — the 60-second slack is the smallest plausible coordination window for a 15-minute job. Under heavy load (a DataEntityHousekeepingJob cascade over thousands of soft-deleted entities, especially with `.block()` on S3 file deletions adding network latency), a cycle running ≥14 minutes releases the lock before commit and a second instance can acquire at the next 15-minute slot while the first is still finalising the transaction."

**Description**: `HousekeepingJobManager.java:25-26` declares `@Scheduled(fixedRate = 15, timeUnit = TimeUnit.MINUTES)` paired with `@SchedulerLock(name = "housekeepingJob", lockAtLeastFor = "14m", lockAtMostFor = "14m")`. The ShedLock window equals the lower-bound (14m == 14m), meaning the lock is held for EXACTLY 14 minutes regardless of cycle completion time. Combined with the 15-minute fixed rate, there is only a 60-second window between max-lock-duration and next-scheduled-invocation. A cycle that runs ≥14 minutes (plausible under DataEntityHousekeepingJob cascade over thousands of soft-deleted entities × `.block()` on S3 deletes per REFACTOR-145 × the ~25-table cascade per batch-D) releases the lock BEFORE commit; a second instance arriving at minute 15 acquires the lock and starts its own cycle while the first is still finalising.

**Failure mode**: Two platform replicas (a 2-node deployment for HA). Replica A acquires the housekeeping lock at minute 0 and starts a slow cycle (15-second alert purge + 14-minute data-entity cascade). At minute 14, the lock releases. At minute 15, Replica B's `@Scheduled` fires; B acquires the lock and starts its own cycle. From minute 15-the-end-of-A's-cycle, BOTH A AND B are running housekeeping concurrently. The DataEntityHousekeepingJob's ~25-table cascade involves SELECTs followed by DELETEs (per batch-D); two concurrent instances could read different snapshots and produce divergent cascade behaviour. The AlertHousekeepingJob's `WHERE id IN (...)` DELETE is idempotent (delete-a-nonexistent-row is a no-op), but the full cascade has no such guarantee.

**Primary source citations**:
- `HousekeepingJobManager.java:25` (`fixedRate = 15, timeUnit = TimeUnit.MINUTES`)
- `HousekeepingJobManager.java:26` (`lockAtLeastFor = "14m", lockAtMostFor = "14m"`)
- batch-D REFACTOR-145 (`.block()` inside transaction — the latency amplifier)

**Existing-ADR-or-implied-prescription**: None. ADR-CANDIDATE-046 (housekeeping opt-out) frames the shipping stance; ADR-CANDIDATE-101 (per-job failure isolation) frames the failure-handling stance. The lock-window pairing is below the ADR-framing layer — a tuning decision, not an architectural decision. The IMPLIED prescription is that the lock window should be larger than the longest plausible cycle; the current tuning is performance-aware (release sooner so same-instance can re-acquire) but operationally fragile under sustained heavy load.

**Proposed remedy**: One-line config change — raise `lockAtMostFor = "14m"` to `"30m"` (or `"60m"`) so the lock outlives any plausible cycle duration. The trade-off is that a JVM crash mid-cycle leaves the lock held longer (up to 30/60 minutes) before another instance can acquire — but the alternative (concurrent execution) is worse. Pair with an explicit boot-time validator that asserts `lockAtMostFor > 2 × fixedRate` (REFACTOR-073 family).

**Severity rationale**: LOW (theoretical until backlog grows) — the race is only triggered under sustained heavy load on multi-instance deployments; today's typical deployments run single-instance or have small data-entity backlogs. The cost of the fix is small.

**Suggested backlog grouping**: `Housekeeping safety sprint` (with REFACTOR-142, REFACTOR-145)

---

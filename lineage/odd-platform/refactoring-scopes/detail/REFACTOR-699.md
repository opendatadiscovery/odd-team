## REFACTOR-699 — No graceful shutdown of in-flight `@Scheduled` jobs — Spring's default `ThreadPoolTaskScheduler` interrupts running threads and discards queued tasks on JVM shutdown; rolling deployments on a busy housekeeping cycle introduce up to 14 minutes of housekeeping pause per restart

**Severity**: MEDIUM
**Category**: missing-graceful-shutdown
**Pillars affected**: [P-08 Management & Administration, P-06 Configuration & Deployment]
**Batch**: ZK (2026-05-26)

**Surfaced by**:
- `odd-platform__java__config__config-class__SchedulingConfiguration.md:bugs_limitations_corner_cases.[3]` (MEDIUM severity) — "**No graceful shutdown of in-flight scheduled jobs**. Spring's default `ThreadPoolTaskScheduler` behaviour on JVM shutdown is to interrupt running threads and discard queued tasks unless `spring.task.scheduling.shutdown.await-termination` is set. No such configuration is present in `application.yml`. If `kubectl delete pod` issues SIGTERM during a housekeeping cycle, the in-flight jOOQ transaction is interrupted mid-cascade — the transaction rolls back (this part is safe via try-with-resources on the connection), but the partial work is lost and the next replica picks up the same backlog from scratch."

**Description**: Spring's `ThreadPoolTaskScheduler` (the default `TaskScheduler` Spring autoconfigures under `@EnableScheduling`, per REFACTOR-698) implements `ExecutorService` with default shutdown semantics: on JVM SIGTERM, running threads are interrupted and queued tasks are discarded. The platform does NOT configure `spring.task.scheduling.shutdown.await-termination: true` nor `spring.task.scheduling.shutdown.await-termination-period: <N>s` in `application.yml`. Grep against `<odd-platform-repo>/odd-platform-api/src/main/resources` for `shutdown.*await` returns zero matches.

**Operational consequences during rolling deployments**:

1. **Mid-cycle interrupt during housekeeping**: `kubectl rollout restart deploy/odd-platform` issues SIGTERM to each pod sequentially. If a pod is mid-cycle in `HousekeepingJobManager.runHousekeepingJobs` (e.g. minute 7 of a 14-minute DataEntityHousekeepingJob cascade), the thread is interrupted. The surrounding `try-with-resources` on the jOOQ `Connection` (HousekeepingJobManager.java:32 + DataEntityHousekeepingJob.java:71 `DSL.using(connection).transaction(ctx -> {...})`) handles the interrupt safely — the connection closes, the transaction rolls back. **The data integrity is preserved**.

2. **But: housekeeping pause for the ShedLock window**: when the interrupted thread rolls back the transaction, it does NOT explicitly release the `shedlock` row. ShedLock's `lockAtMostFor` ensures the lock row is eventually freed (PG sees `lock_until <= now()`), but during the lock-hold window AFTER the graceful-shutdown attempt, no replica can run housekeeping. For HousekeepingJobManager with `lockAtMostFor = "14m"`, the worst case is a 14-minute housekeeping pause per restart. A rolling deployment across N replicas during a busy housekeeping window could introduce ~N × 14m total housekeeping downtime (if restarts catch each replica mid-cycle).

3. **Queued task loss**: if Spring's `ThreadPoolTaskScheduler` has queued tasks (the 1-thread default per REFACTOR-698 means tasks queue up under load), those queued tasks are discarded on shutdown — they do NOT survive across a restart. After restart, the next-scheduled-fire is the next `fixedRate` interval; tasks that were "behind in the queue" are skipped.

4. **The interaction with cron jobs**: if `PostgreSQLPartitionCreationJob`'s daily 00:01 cron is queued behind a housekeeping cycle at restart-time, the queued cron is discarded. Whether the next 00:01 cron fires depends on whether restart completes before 00:01 the next day — operationally a low-probability concern but a real one.

**Operator-visible symptoms**:
- After a deployment, the `shedlock` PG table shows a `lock_until` timestamp 14 minutes in the future for `housekeepingJob` — operators investigating "why isn't housekeeping running?" SQL the shedlock table and see the still-held lock; the cause is the previous replica was killed mid-cycle.
- Housekeeping cycles per hour drop from 4 (15-min cadence) to ~2-3 during/after rolling deployments.
- Partition-creation cron may be silently skipped on restart days; the next morning's INSERTs against newly-needed partitions can fail.

**Operator mitigation**:
- Set `spring.task.scheduling.shutdown.await-termination: true` (Spring waits for running tasks before shutdown).
- Set `spring.task.scheduling.shutdown.await-termination-period: 60s` (bound the wait — 60s is reasonable for a status-switch or session-housekeeping cycle).
- **The 14-minute DataEntityHousekeepingJob cascade still exceeds any reasonable termination period** — for that job, the only true mitigation is splitting it into smaller chunks (a separate REFACTOR — out of scope here).

**Primary source citations**:
- SchedulingConfiguration.java (no `TaskScheduler` bean declared with custom shutdown semantics — Spring's default applies)
- `grep 'shutdown.*await' <odd-platform-repo>/odd-platform-api/src/main/resources` returns zero matches
- ShedLock `lockAtMostFor` semantics — the lock row's `lock_until` is `PG.now() + lockAtMostFor` set at acquisition; an interrupted thread that does NOT explicitly release the lock leaves it held until that timestamp

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-240 (`.usingDbTime()`) — the DB-time semantics ensure the lock IS eventually released (the held-lock-after-crash scenario is bounded by `lockAtMostFor`). This is the platform's safety net; without `.usingDbTime()`, a clock-skewed surviving replica could mis-detect the dead replica's lock state. The gap surfaced here is the absence of graceful-shutdown configuration, not a correctness defect of the lock arbitration.

**Proposed remedy**:
- (a) Add `spring.task.scheduling.shutdown.await-termination: true` + `spring.task.scheduling.shutdown.await-termination-period: 60s` to the shipped `application.yml`. This is a one-line config change with no downstream risk for the three non-cascade jobs (status-switch 9m lock-window is well above 60s — but for short-window jobs, 60s is graceful enough that the most common case completes).
- (b) Split DataEntityHousekeepingJob into batched cycles (e.g. 100 entities per batch with explicit commit checkpoints) so a single batch fits within 60s — separate refactor; the orchestrator's `try-finally` would also need to release the shedlock row explicitly on graceful interrupt.
- (c) Add a Micrometer counter on lock-release-on-shutdown vs lock-release-on-completion (closes part of REFACTOR-703).

**Severity rationale**: MEDIUM — operationally fragile under rolling deployments; the 14-minute housekeeping pause per restart is a real operational cost but is bounded by the `lockAtMostFor` safety mechanism. No correctness defect — the platform's data integrity is preserved through transaction rollback. The gap is operational availability, not data safety.

**Suggested backlog grouping**: `Scheduling foundation hardening sprint` (with REFACTOR-698 / 700 / 701 / 702 / 703 / 704).

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-240 (the `.usingDbTime()` lock-release safety net is what makes this REFACTOR a MEDIUM not HIGH).
- SUPERSEDES: none.
- CONFLICTS: none.

---

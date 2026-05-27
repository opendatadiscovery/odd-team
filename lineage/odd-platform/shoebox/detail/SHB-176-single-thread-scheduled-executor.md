# SHB-176 — Single-thread `@Scheduled` executor — four background jobs share ONE thread, undocumented

**Category**: merged
**Severity**: HIGH

## Hypothesis

Operators running ODD assume their four `@Scheduled` background jobs (housekeeping every 15min, status-switch every 10min, partition-creation daily at 00:01, session-housekeeping every 1h) run independently in parallel. They do not. The platform ships NO `spring.task.scheduling.pool.size` in `application.yml`, NO `@Bean TaskScheduler` declaration anywhere in the codebase, so Spring Boot's `TaskSchedulerBuilder` default of `poolSize=1` governs. A 14-minute housekeeping cycle blocks the 10-minute status-switch job from running on schedule; if housekeeping runs past midnight (sustained backlog), the daily 00:01 partition-creation cron is queued behind it — Spring's default cron-misfire behaviour is queue-and-delay, not skip. The mitigation is a one-line operator config change (`spring.task.scheduling.pool.size: 4`) that is documented nowhere.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/config/SchedulingConfiguration.java:12-26` — the `@Configuration` declares `@EnableScheduling` + `@EnableSchedulerLock(defaultLockAtMostFor="1h")` + a `lockProvider(DataSource)` bean — but NO `@Bean TaskScheduler`, NO Micrometer instrumentation.
- `bash grep 'spring.task' <odd-platform-repo>/odd-platform-api/src/main/resources` returns ZERO matches; `bash grep -rln 'TaskScheduler' <odd-platform-repo>/odd-platform-api/src/main` returns zero hits beyond Spring's autoconfigure imports.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/HousekeepingJobManager.java:25` — `@Scheduled(fixedRate = 15, timeUnit = MINUTES)` + `@SchedulerLock(name = "housekeepingJob", lockAtLeastFor = "14m", lockAtMostFor = "14m")`.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataEntityStatusSwitchJob.java:21` — `@Scheduled(fixedRate = 10, timeUnit = MINUTES)` + `@SchedulerLock(name = "statusSwitchJob", lockAtLeastFor = "9m", lockAtMostFor = "9m")`.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/leader_election/PostgreSQLPartitionCreationJob.java:40` — `@Scheduled(cron = "0 1 0 * * *")` daily at 00:01 + `@SchedulerLock(name = "partitionCreationJob", lockAtLeastFor = "10m", lockAtMostFor = "10m")`.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/session/PostgreSQLSessionHousekeepingJobHandler.java:13-18` — `@Scheduled(fixedRate = 1, timeUnit = HOURS)` with **NO** `@SchedulerLock` annotation (architectural inconsistency; see notes).
- WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform#housekeeping` (verified 2026-05-26 status 200) — page mentions the 15-minute housekeeping cadence and the ShedLock multi-instance coordination but does NOT mention the single-thread executor default OR the `spring.task.scheduling.pool.size` operator knob.

## Notes

- **The cron-misfire risk is the worst-case failure.** PostgreSQLPartitionCreationJob's daily 00:01 cron creates the next day's ACTIVITY / MESSAGE partitions. If a long-running housekeeping cycle blocks the executor past 00:01, the partition CREATE-TABLE-IF-NOT-EXISTS calls are deferred until housekeeping completes. Spring's default `MissedTaskBehavior` is queue-and-execute-ASAP (PROBE-NEEDED — empirically uncertain; SchedulingConfiguration sidecar emits P-183). If the queue exceeds 23:59:59 of the partition's first-use day, INSERTs against ACTIVITY / MESSAGE may fail with `no partition exists for the given key`. Operators see "no recent activity events" with no obvious cause.
- **Session-housekeeping is the asymmetric counter-example.** PostgreSQLSessionHousekeepingJobHandler is `@Scheduled` without `@SchedulerLock` — runs on EVERY replica simultaneously every hour. Today the DELETE-by-expired-timestamp is idempotent so this is operationally harmless, but the convention violation is real: maintainer adding a new `@Scheduled` method may copy the session-housekeeping pattern and inherit the gap. The `@EnableSchedulerLock(defaultLockAtMostFor="1h")` annotation NAME promises "enable scheduler lock" but mechanically only enables the AOP advisor — bare `@Scheduled` is not locked.
- **`defaultLockAtMostFor = "1h"` is DEAD CODE today.** All three `@SchedulerLock`-annotated methods set their own `lockAtMostFor` (housekeeping 14m, status-switch 9m, partition-creation 10m). The 1h default applies to ZERO methods in the current codebase. Latent safety floor for future jobs only.
- **Graceful-shutdown gap.** Spring's default `ThreadPoolTaskScheduler` interrupts running threads on JVM shutdown unless `spring.task.scheduling.shutdown.await-termination` is set (it isn't). A `kubectl delete pod` mid-housekeeping rolls back the in-flight jOOQ transaction (safe) but leaves the shedlock row held until lockAtMostFor expires (~14min). No replica can run housekeeping during the lock-hold window.
- **The fix is one line of YAML.** `spring.task.scheduling.pool.size: 4` gives each scheduled job its own thread; pool-exhaustion DB-connection contention is negligible at sub-1-QPS shedlock writes. The mitigation IS the operator-facing fix; documenting it is the substantive work.
- This thread is `open` — the FEATURE is "platform-level scheduled-job concurrency contract"; the OPERATOR FAILURE MODE is "background jobs delay each other invisibly". No F-NNN anchors this (F-010 Housekeepoing TTL Enforcement covers WHAT runs, not how it's executed; this thread is the HOW-IT-RUNS facet).
- Related: SHB-175 (same shape — wired-but-undocumented operator knob); F-010 (housekeeping); F-009 (WAL notification — also scheduled).

## Next

1. **Promote to feature flow OR fold as drift facet** — decide between (a) standalone `F-NNN — Scheduled-Job Executor Architecture` covering the four `@Scheduled` jobs + the executor + the asymmetric session-housekeeping; (b) facet of F-010 (housekeeping) with drift class `single_thread_executor_default_undocumented`. Recommend (a) — the executor is cross-cutting infrastructure, not housekeeping-specific.
2. **Probe P-183** (already emitted by SchedulingConfiguration sidecar) — empirically verify Spring's default cron-misfire behaviour when a long-running task blocks the executor across the cron trigger time.
3. **Open follow-ups**:
   - DOC-NNN — operator page should publish `spring.task.scheduling.pool.size` as a tunable, with the framework-default value (1) stated and the four-job-on-one-thread implication explained.
   - REFACTOR-NNN — add `@SchedulerLock` to `PostgreSQLSessionHousekeepingJobHandler` to match the codebase's convention (low priority — operationally harmless today; convention defence).
   - PERF-NNN — add Micrometer instrumentation on the LockProvider (lock-acquisition outcomes, lock-hold duration) + on `ThreadPoolTaskExecutor` (queued tasks, active threads) so operators can answer "is replica B failing to acquire the lock because replica A is holding it?".
4. **DOC-NNN** — the `Housekeeping` section of the operator page needs an admonition: "By default all background jobs share a single thread; tune `spring.task.scheduling.pool.size` for any deployment with parallel-job needs."

## Links

- cluster_with: [F-010]
- merged_into: F-121
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: graduate — evidence rich (SchedulingConfiguration + 4 @Scheduled job files + application.yml absence + WebFetch docs silence). Minted F-121 (P-08:F-015 Scheduled-Job Executor Concurrency Contract). Cluster_with F-010 preserved as related cross-reference; not folded because the executor architecture is cross-cutting infrastructure (covers ALL four scheduled jobs), not housekeeping-specific.

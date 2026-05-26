## REFACTOR-704 — No Spring `TaskScheduler` queue / missed-fire / active-thread metrics; an operator cannot answer "has the partition-creation cron been queued behind housekeeping for the last 24 hours?" without manually inspecting partition tables for missing partitions

**Severity**: MEDIUM
**Category**: missing-observability (scheduler backlog)
**Pillars affected**: [P-08 Management & Administration, P-06 Configuration & Deployment]
**Batch**: ZK (2026-05-26)

**Surfaced by**:
- `odd-platform__java__config__config-class__SchedulingConfiguration.md:performance.known_performance_gaps.[1]` (MEDIUM severity) — "**No backlog / no missed-fire metric**. Spring's `ThreadPoolTaskScheduler` has internal state (queued tasks, missed cron evaluations) but no Micrometer integration is configured. An operator answering 'is my partition-creation cron firing on time, or has it been queued behind housekeeping for the last 24 hours?' has no observable surface — must query the actual partition tables to detect missing partitions. Suggested mitigation: a `@Bean public TaskScheduler` declaration with explicit Micrometer-instrumented `ThreadPoolTaskExecutor` that exports `spring_executor_queued_tasks`, `spring_executor_active_threads`."

**Description**: Spring's default `TaskScheduler` (a `ThreadPoolTaskScheduler` autoconfigured under `@EnableScheduling` per REFACTOR-698) has internal state visible to instrumentation: `getActiveCount()` (threads currently running), `getQueueSize()` (tasks queued for the single thread), and the `getScheduledExecutor()` underlying `ScheduledThreadPoolExecutor` exposes `getCompletedTaskCount()`, `getTaskCount()`. Spring Boot's `TaskExecutorMetrics` auto-binds these to Micrometer IF a `TaskScheduler` bean exists with a name AND `MeterRegistry` is on the classpath — but the platform's autoconfigure path (no explicit `@Bean public TaskScheduler`) does NOT trigger the auto-metric-binding by default.

Operator-symptoms the absence enables:

1. **Silent partition-creation lag**: the daily 00:01 partition-creation cron is supposed to CREATE the next day's ACTIVITY / MESSAGE partitions. If the partition-creation cron has been queued behind housekeeping for the last 24 hours (per REFACTOR-698's single-thread bottleneck), the operator's only detection mechanism is: try to INSERT into ACTIVITY tomorrow morning, get "no partition found for the given key" error from PG. By that point, ingestion is broken; partitions have to be created out-of-band; the issue is loud but reactive.

2. **Silent housekeeping queue buildup**: the housekeeping job has `fixedRate = 15min`. If a cycle takes 20 minutes (longer than the rate), Spring queues the NEXT invocation immediately on cycle completion (`fixedRate` semantics — the next invocation is scheduled 15 min AFTER the previous invocation STARTED). On a single-thread executor, this means the housekeeping queue grows by 1 every 5 minutes the cycle exceeds 15. Operators don't see queue growth until cumulative drift becomes catastrophic.

3. **Missed-fire under combined cron + fixedRate contention**: housekeeping (fixedRate=15) overlapping with the daily 00:01 partition-creation cron (single-shot per day) is the worst-case interaction. Spring's default missed-cron behaviour is queue-and-execute-ASAP (probe P-183 PROBE-NEEDED). The operator has no way to verify the actual behaviour without instrumentation.

**Operator-visible-only-via-side-effect surfaces today**:

- Missing partitions for the next day → INSERT failures (loud but reactive; the damage is already done)
- `shedlock` PG table inspection (REFACTOR-703 separately calls this out)
- Application-level logs at DEBUG (typically not captured in production logging config)

**Operator-visible-via-Prometheus surfaces after the fix**:
- `spring_executor_queued_tasks{name="taskScheduler"}` — should remain ~0 in steady state; growth = backlog signal
- `spring_executor_active_threads{name="taskScheduler"}` — should be 0 (idle) or 1 (one job running); >1 means a future poolSize change kicked in (intentional or not)
- `spring_executor_completed_tasks{name="taskScheduler"}` — monotonic counter; rate diff between expected and observed = missed-fire signal
- (Optional) custom counter `shedlock_partition_creation_late_fire_total` incremented if the daily cron starts more than 5 minutes after 00:01

**Primary source citations**:
- SchedulingConfiguration.java (no `@Bean public TaskScheduler` — Spring's autoconfigure default applies)
- `grep 'TaskScheduler' <odd-platform-repo>/odd-platform-api/src/main/java` returns zero matches (no explicit bean declaration anywhere in the codebase)
- `grep 'MeterRegistry\|Micrometer' <odd-platform-repo>/odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/config/SchedulingConfiguration.java` returns zero matches
- Spring Boot 3 `TaskExecutorMetricsAutoConfiguration` — auto-binds metrics only IF a `TaskExecutor` / `TaskScheduler` bean is registered with a name (not the default-autoconfigure path)

**Existing-ADR-or-implied-prescription**: composes with REFACTOR-698 (single-thread default) — the single-thread bottleneck is the CAUSE of the observability need. Fixing both together (declare `@Bean public TaskScheduler` with `poolSize=4` + Micrometer-instrumented + Spring's auto-metric-binding triggers) is the natural single-PR scope.

**Proposed remedy**: Declare an explicit `@Bean public TaskScheduler taskScheduler()` in `SchedulingConfiguration.java`:
```java
@Bean
public ThreadPoolTaskScheduler taskScheduler(MeterRegistry registry) {
    ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
    scheduler.setPoolSize(4);
    scheduler.setThreadNamePrefix("odd-scheduled-");
    scheduler.setRemoveOnCancelPolicy(true);
    scheduler.setWaitForTasksToCompleteOnShutdown(true);  // closes REFACTOR-699 too
    scheduler.setAwaitTerminationSeconds(60);             // closes REFACTOR-699 too
    return scheduler;
}
```

Spring Boot's `TaskExecutorMetricsAutoConfiguration` automatically binds Micrometer metrics on any `TaskExecutor` / `TaskScheduler` bean. Adding this one method closes REFACTOR-698 (poolSize), REFACTOR-699 (graceful shutdown), AND REFACTOR-704 (observability) in a single PR. Boot fails LOUDLY if the bean name `taskScheduler` collides with Spring's autoconfigure default (the auto config backs off when a `TaskScheduler` bean is already present — so the user-declared bean wins).

**Severity rationale**: MEDIUM — operationally significant for capacity-planning, missed-fire detection, and the load-bearing partition-creation cron. The lack of observability means operators detect issues only after they cause user-visible symptoms (INSERT failures, accumulated housekeeping backlog). The fix is a 10-line `@Bean` method.

**Suggested backlog grouping**: `Scheduling foundation hardening sprint` — natural pairing with REFACTOR-698, 699, 700, 701, 702, 703. The single-PR scope: declare the `@Bean public TaskScheduler` + add `@SchedulerLock` to session-housekeeping + add comment to defaultLockAtMostFor + rename lockProvider bean + wrap LockProvider with Micrometer decorator. Together these upgrade the scheduling foundation from "ships-with-Spring-defaults" to "deliberately-configured-and-observable".

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-698 (same Spring-autoconfigure-fallthrough cause; combined fix), REFACTOR-699 (graceful shutdown — `setWaitForTasksToCompleteOnShutdown(true)` in the same bean closes that gap), ADR-CANDIDATE-242 (the colocation includes future TaskScheduler bean once declared).
- SUPERSEDES: none.
- CONFLICTS: none.

---

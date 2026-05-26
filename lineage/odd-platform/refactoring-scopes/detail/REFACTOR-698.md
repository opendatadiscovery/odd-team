## REFACTOR-698 — Single-thread `ThreadPoolTaskScheduler` default — all four `@Scheduled` jobs share ONE thread; a long-running job (e.g. 14m housekeeping cycle) blocks every other job from firing on schedule; the operational consequence is undocumented

**Severity**: HIGH
**Category**: buggy-default (operational fragility under load)
**Pillars affected**: [P-08 Management & Administration, P-06 Configuration & Deployment]
**Batch**: ZK (2026-05-26)

**Surfaced by**:
- `odd-platform__java__config__config-class__SchedulingConfiguration.md:bugs_limitations_corner_cases.[0]` (HIGH severity) — "**Single-thread `ThreadPoolTaskScheduler` default — undocumented and operationally fragile**. No `spring.task.scheduling.pool.size` is declared in `application.yml` (grep returns zero matches), no `TaskScheduler` `@Bean` is declared anywhere in the codebase (`grep TaskScheduler <odd-platform-repo>/odd-platform-api/src/main` returns zero matches). Spring Boot's default `TaskSchedulerBuilder` builds a `ThreadPoolTaskScheduler` with `poolSize = 1`. All four `@Scheduled` methods share this single thread: housekeepingJob (15min cycle), statusSwitchJob (10min), partitionCreationJob (daily 00:01), session-housekeeping (1h)."
- `odd-platform__java__config__config-class__SchedulingConfiguration.md:performance.known_performance_gaps.[0]` (HIGH severity) — same shape framed from the performance angle.

**Description**: The platform ships ZERO `spring.task.scheduling.pool.size` configuration in `application.yml` and ZERO `@Bean public TaskScheduler` declarations anywhere in the codebase. Spring Boot's `TaskSchedulerBuilder` autoconfiguration default kicks in: a `ThreadPoolTaskScheduler` with `poolSize = 1`. All four `@Scheduled` methods declared across the application share this single thread:

| Job | Cadence | Lock Window | Source |
|---|---|---|---|
| `HousekeepingJobManager.runHousekeepingJobs` | `fixedRate = 15min` | `@SchedulerLock` 14m/14m | HousekeepingJobManager.java:25-26 |
| `DataEntityStatusSwitchJob.run` | `fixedRate = 10min` | `@SchedulerLock` 9m/9m | DataEntityStatusSwitchJob.java:21-23 |
| `PostgreSQLPartitionCreationJob.run` | `cron = "0 1 0 * * *"` daily | `@SchedulerLock` 10m/10m | PostgreSQLPartitionCreationJob.java:40-42 |
| `PostgreSQLSessionHousekeepingJobHandler.deleteExpiredSessions` | `fixedRate = 1h` | NONE (REFACTOR-700) | PostgreSQLSessionHousekeepingJobHandler.java:13-18 |

The operational consequence: when two of these jobs are due to fire at the same wall-clock moment, the second job WAITS for the first to finish — Spring queues the missed-fire and the cron-misfire default behaviour is "queue-and-delay-execution", NOT "skip". Concrete scenarios:

- **14-minute housekeeping cycle blocks 10-minute status-switch**: HousekeepingJobManager fires at minute 0 and runs for 14 minutes (DataEntityHousekeepingJob cascading ~25 DELETEs against a large soft-deleted backlog can take this long). Status-switch is due at minute 10 — it cannot fire until minute 14. The next status-switch is due at minute 20 — its cadence drifts from 10min to 14min on this cycle alone. Under sustained heavy backlog, status-switch cadence drifts to 24min or worse.

- **Housekeeping overruns past midnight blocks partition-creation**: PostgreSQLPartitionCreationJob is scheduled for 00:01 daily. If a housekeeping cycle starts at 23:50 and runs 14 minutes (until 00:04), the partition-creation cron is queued behind it. Spring's default missed-cron behaviour is queue-and-execute-ASAP (P-183 PROBE-NEEDED for empirical verification). The cron fires after housekeeping completes — minutes-to-hours late depending on housekeeping duration.

- **Critical edge case**: if housekeeping overruns until ~24 hours after a partition's first-use day, the partition-creation for the NEXT day's ACTIVITY / MESSAGE partitions is deferred. INSERTs against ACTIVITY / MESSAGE may then fail with "no partition exists for the given key" — a load-bearing data-loss-shape on the audit trail.

**The operator's mental model is wrong by default**. An operator reading the live docs at `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` learns about the four scheduled jobs and their cadences but learns nothing about thread-pool sizing. The reasonable assumption is "four scheduled jobs, four threads, parallel execution". The actual contract is "four scheduled jobs, one thread, serialised execution".

**Operator mitigation**: set `spring.task.scheduling.pool.size: 4` in `application.yml`. This is a one-line change that produces concurrent execution of the four jobs (each in its own thread). Trade-off: ShedLock UPSERTs against the shared HikariCP pool (per ADR-CANDIDATE-243) increase from sequential to concurrent — at sub-1-QPS rate this is operationally negligible.

**Primary source citations**:
- SchedulingConfiguration.java (no `TaskScheduler` bean declared)
- application.yml (no `spring.task.scheduling.pool.size` — `grep 'spring\\.task' <odd-platform-repo>/odd-platform-api/src/main/resources` returns zero matches)
- `grep TaskScheduler <odd-platform-repo>/odd-platform-api/src/main/java` returns zero matches
- HousekeepingJobManager.java:25 + DataEntityStatusSwitchJob.java:21 + PostgreSQLPartitionCreationJob.java:40 + PostgreSQLSessionHousekeepingJobHandler.java:13 (the four `@Scheduled` consumers)
- live docs WebFetch 2026-05-26 (no mention of thread-pool sizing, no warning about the single-thread default)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-242 NEW (scheduling-and-locking colocation) — codifies the scheduling-foundation as a single configuration class. The shipped pool-size default is an UNINTENTIONAL CONSEQUENCE of Spring Boot's autoconfigure fallthrough, not a deliberate choice — a maintainer reading the source cannot tell whether `poolSize=1` is intentional (favouring sequential execution for jOOQ-connection-economy reasons) or accidental (the maintainer never configured it). No ADR defends `poolSize=1`; the gap is operationally significant.

**Proposed remedy**:
- (a) **One-line config fix**: set `spring.task.scheduling.pool.size: 4` in `application.yml` (defaults updated in the shipped config so operators inherit the safer behaviour). Trade-off: increases concurrent connection-pool consumption by ShedLock UPSERTs (sub-1-QPS — negligible).
- (b) **Doc-disclose**: update the live config-and-deployment page to document the thread-pool-sizing default + the operator-tunable + the consequence on cadence drift.
- (c) **Belt-and-braces**: declare an explicit `@Bean public TaskScheduler taskScheduler()` in `SchedulingConfiguration` that constructs a `ThreadPoolTaskScheduler` with `poolSize = 4` + `setThreadNamePrefix("odd-scheduled-")` + Micrometer instrumentation (closes REFACTOR-704 in the same change).

**Severity rationale**: HIGH — silent-default operational fragility under load. Under sustained heavy housekeeping, the status-switch cadence drifts, partition-creation can be queued behind housekeeping past midnight, and the operator has no observable surface to detect the drift (REFACTOR-704). The LSN-001 / LSN-002 shape applies: a default the operator never sees that produces operationally-significant behaviour under predictable load.

**Suggested backlog grouping**: `Scheduling foundation hardening sprint` — close REFACTOR-698 (this one) + REFACTOR-699 (graceful shutdown) + REFACTOR-704 (backlog metrics) + REFACTOR-703 (lock observability) as a unit; together they upgrade the platform's scheduled-task subsystem from "ships-with-Spring-defaults" to "deliberately-configured-and-observable".

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-242 (the colocation enforces scheduling-and-locking go together; this REFACTOR shows the colocation does NOT also enforce thread-pool-sizing — a separate concern).
- SUPERSEDES: none.
- CONFLICTS: none.

---

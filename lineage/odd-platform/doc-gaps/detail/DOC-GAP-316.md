---
doc_gap_id: DOC-GAP-316
severity: HIGH
category: drift (Spring Boot autoconfig default + silent operational risk on production)
batch: ZK
generated_at: "2026-05-26T00:00:00Z"
generated_at_commit: 4ec2b20
prompt_version: "doc-gap-finder/0.1.0"
maintainer_curated: false
related_pillar_features:
  - "P-13"           # Platform Internals / Scheduling subsystem
related_features:
  - F-010            # Housekeeping subsystem
related_doc_gaps:
  - DOC-GAP-062      # AlertHousekeepingJob jOOQ-precedence (compounded by single-thread blocking)
  - DOC-GAP-148      # HousekeepingJob bean transaction-handling inconsistency
  - DOC-GAP-059      # Housekeeping Java-vs-YAML default mismatch
  - DOC-GAP-061      # Message TTL absent (silent unbounded growth class)
  - DOC-GAP-041      # Activity-feed retention claim drift (no retention exists)
  - DOC-GAP-227      # PostgreSQL session housekeeping no @SchedulerLock
related_retrospectives:
  - LSN-001          # silent default operator-trap canonical
  - LSN-002          # silent SDK-default operator-trap canonical
---

## DOC-GAP-316 — Spring Boot's default `ThreadPoolTaskScheduler` ships with `poolSize=1` (no `spring.task.scheduling.pool.size` set in `application.yml`; no `TaskScheduler` `@Bean` declared anywhere); all FOUR `@Scheduled` jobs in the platform — `HousekeepingJobManager` (fixedRate=15min), `DataEntityStatusSwitchJob` (10min), `PostgreSQLPartitionCreationJob` (daily 00:01 cron), `PostgreSQLSessionHousekeepingJobHandler` (1h) — share ONE thread and execute sequentially; a 14-minute housekeeping cycle BLOCKS the 10-minute status-switch job; if housekeeping overruns midnight, the daily 00:01 partition-creation cron is QUEUED (Spring's default cron-misfire is queue-and-delay, not skip); under sustained load the partition-creation can be delayed past the next ACTIVITY/MESSAGE partition's first-use day producing INSERT-failures; this is operationally fragile and the live doc page does not name it, the SchedulingConfiguration class does not document it, the application.yml does not preset a safe poolSize — operator's mental model "I have four scheduled jobs, they run in parallel" is wrong by default

**Severity**: HIGH
**Category**: drift (Spring Boot autoconfig default is operationally fragile; live docs silent)

### Surfaced by

- `odd-platform__java__config__config-class__SchedulingConfiguration.md:bugs_limitations_corner_cases.[Single-thread]` (HIGH per sidecar — "Single-thread `ThreadPoolTaskScheduler` default — undocumented and operationally fragile. No `spring.task.scheduling.pool.size` is declared in `application.yml` (grep returns zero matches), no `TaskScheduler` `@Bean` is declared anywhere in the codebase ... Spring Boot's default `TaskSchedulerBuilder` builds a `ThreadPoolTaskScheduler` with `poolSize = 1`. All four `@Scheduled` methods share this single thread ... A 14-minute housekeepingJob cycle blocks statusSwitchJob from running on schedule; if housekeeping runs past midnight (e.g. a heavy DataEntityHousekeepingJob cascade), the daily partition-creation cron at 00:01 is queued — Spring's default cron-misfire behaviour is queue-and-delay, not skip. The partition CREATE-TABLE-IF-NOT-EXISTS calls for the next day's ACTIVITY / MESSAGE partitions are deferred until housekeeping completes; if this slides past 23:59:59 of the partition's first-use day, INSERTs against ACTIVITY / MESSAGE may fail with 'no partition exists for the given key'. **Operator mitigation**: set `spring.task.scheduling.pool.size: 4` in `application.yml` to give each scheduled job its own thread. **Documentation gap**: this is not anywhere in the live docs.")
- `odd-platform__java__config__config-class__SchedulingConfiguration.md:docs_link_semantic.doc_drift_findings.[Single-thread]` ("**Single-thread TaskScheduler default is undocumented**. Live docs (WebFetch 2026-05-26) describe the housekeeping job firing every 15 minutes and the session-housekeeping job firing every hour but do NOT state that all four `@Scheduled` jobs in the codebase share ONE thread by Spring Boot's default.")
- `odd-platform__java__config__config-class__SchedulingConfiguration.md:concepts.invariants.[Single-thread scheduled executor by default]` ("Spring Boot's `TaskSchedulerBuilder` (selected because no `TaskScheduler` bean is declared anywhere in the codebase ... constructs a `ThreadPoolTaskScheduler` with `poolSize = 1` unless `spring.task.scheduling.pool.size` is set.")
- `odd-platform__java__config__config-class__SchedulingConfiguration.md:performance.known_performance_gaps.[Single-thread]` (HIGH per sidecar — "Single-thread default executor — silent operational risk under load. ... The operator's mental model 'I have four scheduled jobs, they run in parallel' is wrong by default.")
- `odd-platform__java__config__config-class__SchedulingConfiguration.md:stress_findings.tunables.[ThreadPoolTaskScheduler.poolSize]` (STATIC-INFERRED — At N=1 (current state): all four `@Scheduled` methods execute on ONE thread sequentially. PROBE-NEEDED P-183 for cron-misfire confirmation.

### Evidence

- **Code primary source — the absence**: `odd-platform-api/src/main/java/.../config/SchedulingConfiguration.java:13-25` (per sidecar primary source) — the class declares `@EnableScheduling` + `@EnableSchedulerLock(defaultLockAtMostFor = "1h")` + a `LockProvider` `@Bean`, BUT does NOT declare a `TaskScheduler` `@Bean`. Per the sidecar's grep evidence: `grep TaskScheduler <odd-platform-repo>/odd-platform-api/src/main/java` returns ZERO results across the entire codebase. The Spring Boot autoconfig default applies.
- **Code primary source — the YAML absence**: `application.yml` does NOT set `spring.task.scheduling.pool.size` anywhere. Per sidecar: `grep 'spring\.task' <odd-platform-repo>/odd-platform-api/src/main/resources` returns ZERO matches. Spring Boot's default is `poolSize=1` per `TaskSchedulingProperties.Pool.size` documented default.
- **The four `@Scheduled` consumers (all sharing one thread)**:
  1. `HousekeepingJobManager.java:25` — `@Scheduled(fixedRate = 15, timeUnit = MINUTES)` (housekeeping cycle, 15min) + `@SchedulerLock("housekeepingJob", lockAtMostFor="14m", lockAtLeastFor="14m")`
  2. `DataEntityStatusSwitchJob.java:21` — `@Scheduled(fixedRate = 10, timeUnit = MINUTES)` (status-switch, 10min) + `@SchedulerLock("statusSwitchJob", lockAtMostFor="9m", lockAtLeastFor="9m")`
  3. `PostgreSQLPartitionCreationJob.java:40` — `@Scheduled(cron = "0 1 0 * * *")` (daily at 00:01) + `@SchedulerLock("partitionCreationJob", lockAtMostFor="10m", lockAtLeastFor="10m")`
  4. `PostgreSQLSessionHousekeepingJobHandler.java:13` — `@Scheduled(fixedRate = 1, timeUnit = HOURS)` (session-housekeeping, 1h) — NO `@SchedulerLock` (per DOC-GAP-227 cross-link)
- **The thread is named `scheduling-1` by Spring's default `thread-name-prefix`** — operators inspecting `jstack` output see a single thread named `scheduling-1` handling all four jobs, which matches the implicit-ADR class.
- **Spring's default cron-misfire behaviour (queue-and-delay)**: per the Spring documentation, the default `MissedTaskBehavior` for a `ThreadPoolTaskScheduler` is to queue the missed cron task and execute it as soon as the thread is free. NOT skip. NOT discard. This is the LSN-001 family of operator-trap: a critical daily-cron job (partition creation) can be silently delayed by minutes-to-hours under sustained load on the single thread.
- **The compounding factor — housekeeping's 14-minute lock-window**: the housekeeping job acquires the `housekeepingJob` ShedLock with `lockAtMostFor="14m"`. If a heavy `DataEntityHousekeepingJob` cascade runs ~10 minutes, the status-switch job (due at minutes 0, 10, 20, 30...) waits behind it on the single thread. The status-switch job's `lockAtMostFor="9m"` means a delayed-but-eventually-started status-switch job holds its lock for up to 9 minutes more — pushing further jobs further back. Under sustained load, the cadences DRIFT.
- **The partition-creation operational consequence**: PostgreSQL `ACTIVITY` and `MESSAGE` tables are PARTITIONED by date (per the partition manager). `PostgreSQLPartitionCreationJob` runs daily at 00:01 to create the NEXT day's partition. If housekeeping runs past midnight (e.g. on a high-volume tenant where the housekeeping cycle takes ~14 minutes and lands at 23:55-00:09), the cron at 00:01 is queued; the partition is created at 00:09 or later. If the queue is deeper (multiple jobs ahead), the partition could be created HOURS late. Any `INSERT INTO activity` arriving before the partition is created fails with PostgreSQL error `no partition of relation "activity" found for row`. The `ActivityServiceImpl.save` path logs the error but the activity event is LOST (no retry, no dead-letter). LSN-001 family of silent-data-loss-on-operational-edge.
- **Live doc primary source (verbatim — WebFetched 2026-05-26 status 200 via SchedulingConfiguration sidecar inferred_docs[0])**: `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` — verbatim quoted: "ODD Platform runs a background housekeeping job that permanently deletes stale data on a schedule. The job fires every 15 minutes, is guarded by a ShedLock so only one platform instance runs it at a time in a multi-instance deployment" + "Expired-session cleanup runs hourly and is not configurable." The page does NOT mention:
  - the single-thread default executor (silent operational risk)
  - the cron-misfire behaviour
  - the inter-job blocking (housekeeping blocks status-switch + partition-creation)
  - the activity/message INSERT failure mode (partition-creation delayed past midnight)
  - the operator mitigation (`spring.task.scheduling.pool.size: 4`)
- **The cross-component pattern — every other scheduled job is `@SchedulerLock`-guarded but the platform never decoupled them onto separate threads**: the platform's ShedLock + advisory-lock convention is THOROUGH at the leader-election layer but BLIND at the local-executor layer. Two replicas correctly coordinate via ShedLock; within ONE replica, the four jobs serialise.
- **The operator-impact narrative**: a tenant with high data-entity churn (frequent soft-deletes → DataEntityHousekeepingJob cascades through ~25 child tables) sees housekeeping cycles taking 10-12 minutes regularly. Status-switch (10-minute cadence) consistently runs late by 10-12 minutes. The status-switch's job is to move DELETED entities to the next state — its delay extends the soft-deleted-but-not-hard-purged window. Eventually housekeeping runs past midnight on a heavy-volume day; the 00:01 partition-creation cron is queued; ACTIVITY INSERTs fail for ~10 minutes; audit events are lost. Operator discovers the missing activity rows ~24 hours later in a forensic review.

### Proposed doc action

**TWO-PART action — doc-side primary + code-side recommended (small bounded fix).**

1. **Doc-side PRIMARY — extend `documentation/docs/configuration-and-deployment/odd-platform.md` housekeeping section with a new "Scheduling subsystem" subsection**:

   > **Scheduling thread pool**: ODD Platform runs FOUR `@Scheduled` jobs (housekeeping 15-min, status-switch 10-min, partition-creation daily 00:01, session-housekeeping 1-hour). By default, Spring Boot configures the `ThreadPoolTaskScheduler` with a single thread (`spring.task.scheduling.pool.size: 1`) — meaning all four jobs SERIALIZE through ONE thread.
   >
   > **Operational consequences**:
   > - A long housekeeping cycle (typical: 5-12 minutes; worst-case on high-churn tenants: 13-14 minutes) DELAYS the next status-switch job. Status-switch cadence drifts under sustained load.
   > - If housekeeping completes past midnight, the daily partition-creation cron at 00:01 is QUEUED behind any other pending jobs. Spring's default cron-misfire behaviour is queue-and-delay, NOT skip.
   > - If partition-creation runs past the first activity row of the new day, INSERTs against ACTIVITY (and MESSAGE under DataCollaboration) FAIL with "no partition exists for the given key". The platform logs the error but does NOT retry — events are lost.
   >
   > **Recommended mitigation**:
   > ```yaml
   > spring:
   >   task:
   >     scheduling:
   >       pool:
   >         size: 4
   > ```
   > Setting `spring.task.scheduling.pool.size: 4` gives each `@Scheduled` job its own thread. Housekeeping no longer blocks status-switch; the daily partition-creation cron fires on time regardless of housekeeping cycle duration. The cost is ~3 additional JVM threads at idle (negligible).
   >
   > **Why this is not the default**: historical — the platform shipped with the Spring autoconfig default. The fix is bounded and recommended for any production deployment with > 10K data entities or > 1M activity events/day.

2. **Code-side RECOMMENDED (file `/log-issue odd-platform`)** — single small edit:
   - Add `spring.task.scheduling.pool.size: 4` to the bundled `odd-platform-api/src/main/resources/application.yml` as the new default.
   - Backward-compatible (existing deployments overriding the YAML will see no change; new deployments get the safer default).
   - Optional: add a `// NOTE: explicit pool-size; see odd-platform issue #NNNN for rationale` comment + Javadoc on the `SchedulingConfiguration` class.

3. **Doc-side COMPANION — add a "Scheduling internals" reference page** at `documentation/docs/configuration-and-deployment/scheduling.md` (new page) enumerating:
   - The four `@Scheduled` jobs (cadences + ShedLock names + lock windows)
   - The single-thread default behaviour + the recommended fix
   - The cross-component lock convention (`housekeeping.enabled`, `datacollaboration.*advisory-lock-id`, `notifications.wal.advisory-lock-id`, `odd.activity.partition.advisory-lock-id`)
   - The cron-misfire behaviour + the partition-creation operational consequence
   - The Java vs YAML default pattern (cross-link DOC-GAP-059)

### Cross-references

- **DOC-GAP-062** (AlertHousekeepingJob jOOQ-precedence) — compounded by single-thread blocking: a buggy housekeeping job not only deletes wrong rows but ALSO blocks the other scheduled jobs.
- **DOC-GAP-148** (HousekeepingJob transaction-handling inconsistency) — sibling housekeeping operational gap.
- **DOC-GAP-059** (Housekeeping Java-vs-YAML default mismatch) — adjacent operational fragility on the same subsystem.
- **DOC-GAP-061** (Message TTL absent — silent unbounded growth) — sibling housekeeping coverage gap.
- **DOC-GAP-041** (Activity-feed retention claim drift) — same family: docs claim retention but code never deletes activity rows.
- **DOC-GAP-227** (PostgreSQL session housekeeping no @SchedulerLock) — sibling SchedulingConfiguration finding; both findings demonstrate that the scheduling subsystem has multiple silent operational gaps.
- **F-010** (Housekeeping subsystem) — THIS finding extends F-010's operational documentation coverage at the thread-pool layer.
- **LSN-001 / LSN-002** (silent default operator-trap canonical) — direct family match: silent Spring Boot autoconfig default produces production data loss (lost ACTIVITY events) on operational edge.

### Severity rationale

HIGH. The silent default is operationally fragile on a load-bearing production subsystem (scheduling), and the live docs are silent on the consequence. Severity classification:

1. **Reachable at production scale**: any tenant with sufficient data churn to make housekeeping take > 9 minutes hits the status-switch-delay; the 14-minute lock-window is reachable; the past-midnight overrun is reachable on high-volume days. The threshold is not exotic.
2. **The consequence is silent data loss**: lost ACTIVITY events compound over time; an audit gap of ~10 minutes per midnight overrun is undetectable without explicit Postgres logging review.
3. **The fix is one line of YAML**: cost-benefit is the maximum asymmetry — bounded fix, deterministic operational reduction.
4. **The doc-product gap compounds the operational gap**: operators read the live page, see housekeeping described as a single isolated job, and never realise four jobs share one thread.
5. **Probe P-183 is the operational confirmation gate** for the cron-misfire behaviour, but the STATIC-INFERRED case for HIGH severity is sufficient: Spring documentation confirms the queue-and-delay default; the four jobs are confirmed sharing one thread; the partition-INSERT failure mode is a well-known PostgreSQL-partitioning operational class.
6. **Cross-references compound the cluster**: DOC-GAP-062 (housekeeping bug) + DOC-GAP-148 (transaction inconsistency) + DOC-GAP-059 (Java vs YAML) + DOC-GAP-227 (session housekeeping no lock) + THIS finding form a 5-dimensional scheduling-subsystem operational gap cluster. The combined doc-side fix is one new "Scheduling internals" reference page.

Severity is NOT CRITICAL because the platform is operationally functional under typical (sub-9-minute housekeeping cycle) tenant patterns; the harm surfaces under high-volume edge cases. Severity is NOT MEDIUM because the failure mode (lost audit events) is silent + structural + reachable at production scale, and the fix is one line of YAML.

### Last verified

- 2026-05-26 — SchedulingConfiguration config-class sidecar PRIMARY SOURCE at substrate commit `4ec2b20`; live WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` status **200** (verbatim "fires every 15 minutes" copy confirmed in the SchedulingConfiguration sidecar `inferred_docs[0]` fetched 2026-05-26).
- Probe **P-183** is the operational confirmation gate for the cron-misfire queue-and-delay behaviour; until it runs, the SEVERITY is HIGH STATIC-INFERRED.

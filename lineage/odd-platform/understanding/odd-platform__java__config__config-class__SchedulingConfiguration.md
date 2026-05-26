---
node_id: "odd-platform java org.opendatadiscovery.oddplatform.config config-class:SchedulingConfiguration"
node_kind: config-class
axis: config_prefixes
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-26-batch-ZK-scheduling-configuration
---

# SchedulingConfiguration (`@EnableScheduling` + `@EnableSchedulerLock` + `LockProvider` bean) — semantic understanding

## understanding

`SchedulingConfiguration` is a 26-line Spring `@Configuration` that turns on the platform's entire scheduled-task subsystem with three load-bearing annotations + one Bean factory: `@EnableScheduling` (Spring imports `ScheduledAnnotationBeanPostProcessor` and constructs a default `TaskScheduler`), `@EnableSchedulerLock(defaultLockAtMostFor = "1h")` (ShedLock's Spring integration imports `MethodProxyScheduledLockAdvisor` and wires the locking-AOP around every `@SchedulerLock`-annotated method), and the `lockProvider(DataSource)` `@Bean` that returns a `JdbcTemplateLockProvider` configured with `.usingDbTime()` — i.e. the `shedlock` table's `lock_until` / `locked_at` timestamps come from PostgreSQL's clock, not the JVM clock, removing clock-skew between platform replicas. The class has NO explicit `TaskScheduler` bean, NO `spring.task.scheduling.pool.size` in `application.yml`, NO cron-misfire policy declaration, and NO observability instrumentation. **Spring Boot's default `ThreadPoolTaskScheduler` is a single-thread executor unless overridden** — meaning all four `@Scheduled` jobs in the codebase (housekeeping fixedRate=15m, status-switch fixedRate=10m, partition-creation cron=00:01-daily, session-housekeeping fixedRate=1h) share ONE thread. A cycle that overruns blocks every other job for the duration; Spring's default cron-misfire behaviour is "queue-and-delay-execution" not "skip".

## concepts

- entities:
  - SchedulingConfiguration (this class)
  - LockProvider (ShedLock interface — `net.javacrumbs.shedlock.core.LockProvider`)
  - JdbcTemplateLockProvider (the PG-backed implementation)
  - DataSource (Spring's auto-wired primary datasource — the same one HikariCP exposes for jOOQ)
  - shedlock table (PG table created by V0_0_52 migration — `name VARCHAR(64) PK`, `lock_until TIMESTAMP`, `locked_at TIMESTAMP`, `locked_by VARCHAR(255)`)
  - Spring `@Scheduled` infrastructure (ScheduledAnnotationBeanPostProcessor + default ThreadPoolTaskScheduler)
  - ShedLock `@SchedulerLock` AOP (MethodProxyScheduledLockAdvisor)
  - The four `@Scheduled` consumers across the codebase:
    - HousekeepingJobManager (`fixedRate = 15min` + `@SchedulerLock("housekeepingJob", 14m, 14m)`)
    - DataEntityStatusSwitchJob (`fixedRate = 10min` + `@SchedulerLock("statusSwitchJob", 9m, 9m)`)
    - PostgreSQLPartitionCreationJob (`cron = "0 1 0 * * *"` daily at 00:01 + `@SchedulerLock("partitionCreationJob", 10m, 10m)`)
    - PostgreSQLSessionHousekeepingJobHandler (`fixedRate = 1h` — **NO `@SchedulerLock`**; ShedLock's `defaultLockAtMostFor` does NOT apply because the annotation is absent)
- operations:
  - boot-time: import Spring's scheduled-task infrastructure via `@EnableScheduling`
  - boot-time: import ShedLock's Spring AOP via `@EnableSchedulerLock` and register `1h` as the default `lockAtMostFor` for any `@SchedulerLock` that omits its own
  - boot-time: build a `JdbcTemplateLockProvider` Bean over the auto-wired `DataSource`
  - runtime (per `@SchedulerLock` method invocation): acquire/release a row in `shedlock` table via the LockProvider, using DB-native time
- invariants:
  - "**Single-thread scheduled executor by default**. Spring Boot's `TaskSchedulerBuilder` (selected because no `TaskScheduler` bean is declared anywhere in the codebase — `grep TaskScheduler <odd-platform-repo>/odd-platform-api/src/main` returns zero matches) constructs a `ThreadPoolTaskScheduler` with `poolSize = 1` unless `spring.task.scheduling.pool.size` is set. The codebase ships NO `spring.task.scheduling.*` configuration in `application.yml` (grep returns zero matches). Therefore all four `@Scheduled` methods execute on a single thread sequentially — when two are due simultaneously, one waits for the other to finish."
  - "**`defaultLockAtMostFor = \"1h\"` applies ONLY to `@SchedulerLock`-annotated methods that omit their own `lockAtMostFor`**. It does NOT provide automatic locking to bare `@Scheduled` methods. The session-housekeeping job (`PostgreSQLSessionHousekeepingJobHandler.deleteExpiredSessions`, fixedRate=1h) has `@Scheduled` but NO `@SchedulerLock` — it runs UNLOCKED on every platform replica simultaneously, NOT under the `1h` default."
  - "All three of the codebase's `@SchedulerLock` methods set BOTH `lockAtLeastFor` and `lockAtMostFor` explicitly (housekeepingJob = 14m/14m, statusSwitchJob = 9m/9m, partitionCreationJob = 10m/10m) — so the `1h` default at SchedulingConfiguration.java:14 is currently DEAD CODE. A future `@SchedulerLock(name = \"X\")` that omits the timing attributes would inherit 1h. The default exists as a safety floor for future jobs."
  - "`.usingDbTime()` at SchedulingConfiguration.java:22 — the lock_until / locked_at timestamps in the `shedlock` PG table come from PG's `current_timestamp` (server-side `now()`), NOT from each JVM's `System.currentTimeMillis()`. This neutralises clock-skew between replicas: two instances with drifted clocks still agree on lock validity via the DB's authoritative time."
  - "**Shared DataSource with main jOOQ traffic**. The `JdbcTemplateLockProvider` uses the auto-wired primary `DataSource` (parameter `dataSource` injected at SchedulingConfiguration.java:18) — the same HikariCP pool that serves controller / repository jOOQ queries. ShedLock's UPSERTs on the `shedlock` table consume one connection from the shared pool per lock acquisition (~15-second pattern under normal cadence: every 10/15min for status-switch + housekeeping, ~daily for partition-creation)."
- audiences:
  - "Spring container (boots all `@Scheduled` jobs)"
  - "ShedLock AOP (wires the locking advisor around every `@SchedulerLock` method)"
  - "PostgreSQL (lock state + DB time source)"
  - "odd-platform operators sizing multi-replica deployments"
  - "DBAs sizing the `shedlock` table + the shared HikariCP pool"

## dependencies_semantic

- requires-feature:
  - "Spring Boot scheduling subsystem — `@EnableScheduling` at SchedulingConfiguration.java:13 imports `org.springframework.scheduling.annotation.SchedulingConfiguration` (the Spring class, not this one — name collision) which registers `ScheduledAnnotationBeanPostProcessor`. Without `@EnableScheduling`, every `@Scheduled` in the codebase becomes inert (Spring does not auto-enable scheduling by default)."
  - "ShedLock-Spring integration — `@EnableSchedulerLock` at SchedulingConfiguration.java:14 imports `MethodProxyScheduledLockAdvisor` which AOP-wraps every `@SchedulerLock` method. Without it, the `@SchedulerLock` annotations on HousekeepingJobManager / DataEntityStatusSwitchJob / PostgreSQLPartitionCreationJob become inert and all three jobs would run on EVERY replica simultaneously without coordination."
  - "ShedLock JDBC-Template provider — `JdbcTemplateLockProvider` from `net.javacrumbs.shedlock.provider.jdbctemplate` is the concrete LockProvider returned by the Bean at line 17-25. Other providers exist (Redis, ZooKeeper, JDBC-direct) but the platform binds the JDBC-template variant; coupled to a Spring `JdbcTemplate` wrapping the primary DataSource."
- requires-config:
  - "Spring auto-wired primary `DataSource` — the only constructor parameter at line 18. Sourced from `spring.datasource.url / username / password` in `application.yml:1-7` via Spring Boot autoconfiguration; the same pool serves jOOQ. NOT the `spring.custom-datasource.*` (commented out in application.yml:8-11)."
  - "(Implicit, by absence:) `spring.task.scheduling.pool.size` — NOT set in `application.yml`; Spring Boot default `1` applies. `spring.task.scheduling.shutdown.await-termination` — NOT set; default Spring behaviour applies (interrupt-on-shutdown, no graceful drain)."
  - "(Implicit, by absence:) `spring.task.scheduling.thread-name-prefix` — NOT set; threads named `scheduling-1`, `scheduling-2`, ... by Spring's `ThreadPoolTaskScheduler` default."
- requires-runtime:
  - "PostgreSQL with the `shedlock` table present (created by `V0_0_52__introduce_housekeeping.sql:10-18` — `CREATE TABLE IF NOT EXISTS shedlock (name VARCHAR(64) PK, lock_until TIMESTAMP, locked_at TIMESTAMP, locked_by VARCHAR(255))`). The `JdbcTemplateLockProvider` issues INSERT-or-UPDATE against this table on every `@SchedulerLock` acquisition / release; missing table → boot still succeeds (no startup probe) but the first lock-acquisition attempt at runtime fails with SQL error."
  - "Java 17 + Spring Boot 3 — `@EnableScheduling`, `@EnableSchedulerLock`, `@Configuration`, `@Bean` runtime support."
  - "ShedLock-spring 5.x — the `LockAssert.assertLocked()` calls inside the three `@SchedulerLock` methods (HousekeepingJobManager.java:28, DataEntityStatusSwitchJob.java:24, PostgreSQLPartitionCreationJob.java:43) require ShedLock's runtime to enforce the lock invariant."
- coupling:
  - "**Foundation for the entire housekeeping subsystem**. `HousekeepingJobManager` (`@Scheduled(fixedRate = 15, timeUnit = MINUTES)` + `@SchedulerLock(name = \"housekeepingJob\", lockAtLeastFor = \"14m\", lockAtMostFor = \"14m\")` at HousekeepingJobManager.java:25-26) depends on BOTH `@EnableScheduling` (otherwise the fixedRate has no effect) AND `@EnableSchedulerLock` (otherwise the multi-replica coordination claim collapses)."
  - "**Foundation for the partition-creation subsystem**. `PostgreSQLPartitionCreationJob.run()` at PostgreSQLPartitionCreationJob.java:40-51 — daily cron at 00:01 + `@SchedulerLock(\"partitionCreationJob\", 10m, 10m)`. Without this configuration, partitions would attempt to be created on every replica simultaneously, leading to PG advisory-lock contention or duplicate CREATE TABLE attempts."
  - "**Foundation for the data-entity-status-switch subsystem**. `DataEntityStatusSwitchJob.run()` at DataEntityStatusSwitchJob.java:21-31 — 10-minute fixedRate + `@SchedulerLock(\"statusSwitchJob\", 9m, 9m)`. This job moves data-entities into DELETED status (soft-delete), which the housekeeping job later hard-deletes. The two jobs' cadences (10m vs 15m) interleave on the same single thread."
  - "**Asymmetric coupling with session-housekeeping**. `PostgreSQLSessionHousekeepingJobHandler.deleteExpiredSessions()` at PostgreSQLSessionHousekeepingJobHandler.java:13-18 — `@Scheduled(fixedRate = 1, timeUnit = HOURS)` with NO `@SchedulerLock`. This job DEPENDS on `@EnableScheduling` (otherwise it would not fire), but DOES NOT use `@EnableSchedulerLock`. Result: in a multi-replica deployment, EVERY replica runs the expired-session purge every hour — but since the job issues idempotent DELETE-by-expired-timestamp (PostgreSQLSessionHousekeepingJob.java internals — `block()` at line 16 on a Reactive Mono returning deleted-row count), the races are operationally harmless (delete-a-nonexistent-row is no-op). The architectural inconsistency is real but not currently load-bearing."
  - "Sibling sidecar: `HousekeepingTTLProperties` (`@ConfigurationProperties(\"housekeeping.ttl\")`) — consumed by the housekeeping subsystem THIS class enables. See `lineage/odd-platform/understanding/odd-platform__java__org_opendatadiscovery_oddplatform_housekeeping_config__config-properties-class__HousekeepingTTLProperties.md`."
  - "Sibling sidecar: `HousekeepingJobManager` — the orchestrator gated by `@EnableScheduling` from this class. See `lineage/odd-platform/understanding/odd-platform__java__service__service__HousekeepingJobManager.md` (the manager sidecar's `dependencies_semantic.requires-feature` cites SchedulingConfiguration.java:13-14)."

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "LockProvider bean is registered and is an instance of JdbcTemplateLockProvider; its configuration uses `usingDbTime()` (i.e. lock timestamps are read from DB, not JVM clock)."
    test_class: unit
    criticality: MEDIUM
    note: "A Spring-context test asserting the bean type + provider configuration would lock in the DB-time invariant; a refactor that accidentally switched to client-time (the JdbcTemplateLockProvider default IF .usingDbTime() is omitted) would silently regress to clock-skew-vulnerable behaviour."
  - behaviour: "All four `@Scheduled` methods in the codebase execute on a single-thread executor by default (no `spring.task.scheduling.pool.size` set)."
    test_class: integration
    criticality: HIGH
    note: "No test asserts the thread-pool size. An operator's expectation 'my four jobs run in parallel' is wrong by default. An integration test with two `@Scheduled` jobs deliberately sleeping for 20 seconds, both due at the same time, and asserting the second's start is delayed by ~20 seconds (not concurrent) would document the contract."
  - behaviour: "`defaultLockAtMostFor = \"1h\"` is inherited by a `@SchedulerLock` annotation that omits its `lockAtMostFor` attribute."
    test_class: integration
    criticality: LOW
    note: "Currently dead code (all three `@SchedulerLock`s in the codebase set their own lockAtMostFor). A test with a custom `@Component` declaring `@Scheduled` + `@SchedulerLock(name = \"testLock\")` (no timing attrs) and asserting the shedlock row's lock_until is set to ~1h would verify the inheritance contract."
  - behaviour: "The `shedlock` table's lock_until / locked_at timestamps come from PG's `now()` (the `.usingDbTime()` semantic)."
    test_class: integration
    criticality: MEDIUM
    note: "An integration test that artificially skews the JVM clock (e.g. via `Clock.fixed` injection if Spring used `java.time.Clock`, which it does not here) is not feasible without infra changes. Easier verification: query `SELECT lock_until FROM shedlock WHERE name = 'housekeepingJob'` mid-cycle and assert it is close to PG's `now() + 14 minutes`, NOT close to the JVM's `Instant.now() + 14 minutes`. Currently no test exercises this."
  - behaviour: "Cron-misfire behaviour under thread starvation: a long-running `@Scheduled` task blocks subsequent `@Scheduled` tasks from firing on schedule (because the executor has only one thread). The blocked task is queued and runs once the thread is free, NOT skipped, NOT discarded."
    test_class: integration
    criticality: HIGH
    note: "Spring's default Task-Scheduler behaviour for missed cron times is to queue and execute as soon as possible (the default `MissedTaskBehavior` semantics). No test asserts this. Under a sustained backlog, the cron-based PostgreSQLPartitionCreationJob (00:01 daily) could be delayed by minutes-to-hours if housekeeping or status-switch is running long."
  - behaviour: "ShedLock acquisition is INSERT-or-UPDATE under PG's `usingDbTime`. Two instances racing to acquire the same lock name — only one succeeds; the other receives `Optional.empty()`."
    test_class: integration
    criticality: HIGH
    note: "No multi-instance test exists. The contract is the single most important load-bearing property of the entire scheduled-task subsystem in a multi-replica deployment. A Testcontainers + 2-JVM test would catch a regression where the lock provider silently lost atomicity (e.g. a future swap to a non-DB-time provider, or a configuration mistake)."
- test_files: []
- gaps: |
    Grep against `<odd-platform-repo>/odd-platform-api/src/test` for `SchedulingConfiguration`,
    `EnableScheduling`, `EnableSchedulerLock`, `LockProvider`, or `JdbcTemplateLockProvider`
    returns ZERO matches. The 26-line foundation of the platform's entire scheduled-task
    subsystem has NO direct test coverage. Indirect coverage exists only in that
    integration tests that boot the full Spring context implicitly exercise the
    Bean wiring (a missing Bean would fail context startup) — but no test asserts:

    - the LockProvider's `usingDbTime` invariant
    - the single-thread executor default (and its consequence: serialised job execution)
    - the `defaultLockAtMostFor = 1h` inheritance (dead code today, latent for future jobs)
    - the multi-instance lock-race correctness

    Likeliest regression sites:

    1. **Switching to a different LockProvider** — a refactor that swapped JDBC for Redis
       (e.g. for a multi-database deployment) would lose `.usingDbTime()` without anyone
       noticing. The shedlock semantics would shift from DB-authoritative-time to
       Redis-server-time; multi-replica clock-skew assumptions would change.

    2. **Adding a TaskScheduler bean elsewhere** — a future Spring auto-configuration
       or a new `@Bean public TaskScheduler` declaration would override the default
       single-thread executor without any test catching the implicit contract change.
       A jump from 1 thread to N=10 threads would suddenly parallelise all four
       `@Scheduled` jobs — possibly desirable, but a silent change with major
       operational implications (more shared-pool DB-connection contention, more
       concurrent shedlock acquisition attempts).

    3. **A new `@Scheduled` method declared without `@SchedulerLock`** — would inherit
       the asymmetric coupling pattern that PostgreSQLSessionHousekeepingJobHandler
       already exhibits: runs on every replica without coordination. No test enforces
       the convention that `@Scheduled` MUST be paired with `@SchedulerLock` for
       multi-instance correctness.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform"
    anchor: "#housekeeping"
    rationale: |
      The canonical Configure ODD Platform reference page is the only ODD doc that mentions
      ShedLock — and only in the context of housekeeping, not as a platform-level
      scheduling foundation. WebFetched in this session.
    last_verified_at: "2026-05-26T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      WebFetched 2026-05-26 (https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform), HTTP 200:

      - "ODD Platform runs a background **housekeeping job** that permanently
        deletes stale data on a schedule. The job fires every **15 minutes**, is
        guarded by a ShedLock so only one platform instance runs it at a time
        in a multi-instance deployment"
      - "Expired-session cleanup runs hourly and is **not configurable**.
        A `@Scheduled(fixedRate = 1, timeUnit = HOURS)` housekeeping job ...
        deletes rows."

      The page does NOT mention:
      - the SchedulingConfiguration class itself (`@EnableScheduling` +
        `@EnableSchedulerLock` + the LockProvider bean).
      - the `defaultLockAtMostFor = "1h"` setting at SchedulingConfiguration.java:14.
      - the `usingDbTime()` invariant at SchedulingConfiguration.java:22 — operators
        cannot learn from the docs that multi-replica deployments are safe under
        clock-skew because DB-time is used.
      - the **single-thread default executor** (no `spring.task.scheduling.pool.size`
        anywhere; Spring's default poolSize=1 applies). Operators reading the docs
        cannot learn that the four `@Scheduled` jobs in the platform run on ONE
        thread, sequentially, and a long-running job blocks the others.
      - the **asymmetric session-housekeeping coupling**: session-purge runs WITHOUT
        `@SchedulerLock` and therefore on every replica simultaneously every hour.
        The docs frame the session-purge as "not configurable" but do not surface
        the multi-replica behaviour.
- doc_drift_findings:
  - "**Single-thread TaskScheduler default is undocumented**. Live docs (WebFetch 2026-05-26) describe the housekeeping job firing every 15 minutes and the session-housekeeping job firing every hour but do NOT state that all four `@Scheduled` jobs in the codebase share ONE thread by Spring Boot's default. An operator reading the docs expects parallel execution; the actual contract is sequential execution serialised through a single-thread `ThreadPoolTaskScheduler`. Under sustained heavy load, a 14-minute housekeeping cycle blocks the 10-minute status-switch job and (if it overruns past midnight) the daily 00:01 partition-creation cron."
  - "**`defaultLockAtMostFor = \"1h\"` not documented**. The live page mentions ShedLock for housekeeping coordination but does not state the `1h` default applied at SchedulingConfiguration.java:14, nor does it mention that this default is currently DEAD CODE (all three `@SchedulerLock` methods in the codebase set their own values explicitly). The default is latent for future jobs but the operator-visible behaviour for the current codebase is governed entirely by the three explicit values (housekeeping 14m, status-switch 9m, partition-creation 10m)."
  - "**`.usingDbTime()` not documented**. The live page does not explain how clock-skew between replicas is handled. The `.usingDbTime()` invariant at SchedulingConfiguration.java:22 is the operational safety mechanism for multi-replica deployments under clock drift; the docs are silent on this. An operator considering 'do I need to install chrony on my K8s nodes?' has no way to learn from the docs that the platform tolerates clock skew because lock timestamps come from PG."
  - "**Asymmetric session-housekeeping unlock not documented**. The live page says session-housekeeping runs hourly but does not state that it runs on EVERY replica simultaneously (no `@SchedulerLock`). A naive operator running 5 platform replicas would see five times as many session-purge attempts per hour. The job's DELETE-by-expired-timestamp is idempotent so this is operationally harmless, but the docs surface this as a configurable invariant ('not configurable') without explaining the lock-coordination asymmetry."

## implicit_adrs

- "**DB-time for lock arbitration via `.usingDbTime()`** — SchedulingConfiguration.java:22 explicitly invokes `.usingDbTime()` on the JdbcTemplateLockProvider's builder. The JdbcTemplateLockProvider default WITHOUT this call uses JVM-side timestamps (`Instant.now()`), which means two replicas with skewed clocks would write different `lock_until` values and the lock semantics would be vulnerable to clock drift. The choice to explicitly call `.usingDbTime()` is a documented intent: 'arbitrate via PostgreSQL's `current_timestamp`, not the JVM's clock' — eliminating clock-skew as a multi-replica concern. The DB-round-trip cost (one extra `SELECT now()` per lock operation) is the trade-off." — evidence: SchedulingConfiguration.java:22 (`.usingDbTime()`). — intent_anchor: "The explicit `.usingDbTime()` call IS the decision. ShedLock's JdbcTemplateLockProvider has the option available and the default is OFF; the deliberate invocation of `.usingDbTime()` encodes the intent." — confidence: HIGH

- "**`defaultLockAtMostFor = \"1h\"` as a latent safety floor** — SchedulingConfiguration.java:14 sets a 1-hour default for any `@SchedulerLock` method that omits its own `lockAtMostFor`. Currently dead code (all three `@SchedulerLock` methods in the codebase set explicit values), but the choice of 1h vs Long.MAX_VALUE vs 5min is a load-bearing decision for future jobs. The intent: 'if a developer adds a `@SchedulerLock(name = \"newJob\")` without thinking about lock-timing, the lock cannot deadlock for longer than 1 hour'. 1h is operationally reasonable — long enough to cover most legitimate scheduled work, short enough that a JVM crash mid-cycle does not block the lock for a full day." — evidence: SchedulingConfiguration.java:14 (`@EnableSchedulerLock(defaultLockAtMostFor = \"1h\")`). — intent_anchor: "The presence of a non-default value on the `@EnableSchedulerLock` annotation IS the decision. The annotation's own default is `Long.MAX_VALUE` (effectively 'lock until manually released'); choosing `1h` instead is an explicit choice to set a safety ceiling." — confidence: HIGH

- "**Co-locating scheduling enablement with the LockProvider bean** — both `@EnableScheduling` and `@EnableSchedulerLock` are placed on the same `@Configuration` class that also declares the `lockProvider` Bean. The structural intent: scheduling-AND-locking are conceptually inseparable in this codebase. Splitting (e.g. one config for `@EnableScheduling`, another for `@EnableSchedulerLock` + LockProvider) would allow a future deployment to accidentally enable scheduling without locking — leading to multi-replica races. The single-class colocation enforces 'you cannot have scheduling without ShedLock-aware locking'." — evidence: SchedulingConfiguration.java:12-15 (the three annotations stacked on one `@Configuration`). — intent_anchor: "The three annotations on lines 12-14 form an atomic unit; the absence of a sibling configuration class with just `@EnableScheduling` confirms the all-or-nothing intent." — confidence: MEDIUM (the colocation IS the evidence but no comment articulates the intent — could equally be 'small enough to fit in one file' without architectural intent)

- "**Sharing the primary `DataSource` with main jOOQ traffic for ShedLock** — the `lockProvider` Bean's parameter at SchedulingConfiguration.java:18 is `final DataSource dataSource` — Spring auto-wires the primary DataSource (the same HikariCP pool used by jOOQ for application traffic). An alternative would be a dedicated DataSource for ShedLock (separate pool, separate connection limits), keeping lock contention isolated. The choice to share the primary pool is a resource-economy decision: one HikariCP pool, one connection-limit budget. The trade-off: ShedLock's UPSERTs on the `shedlock` table consume one connection per lock acquisition — at four `@Scheduled` jobs across cadences ranging from 10min to daily, this is sub-1-QPS. Acceptable cost; explicit choice." — evidence: SchedulingConfiguration.java:18 (the constructor parameter is `DataSource`, not `@Qualifier(\"shedlockDataSource\") DataSource`) + application.yml:1-7 (the only declared datasource). — intent_anchor: "The absence of `@Qualifier` and the absence of a second `DataSource` Bean in the codebase together encode 'use the primary pool'." — confidence: HIGH

## bugs_limitations_corner_cases

- "**Single-thread `ThreadPoolTaskScheduler` default — undocumented and operationally fragile**. No `spring.task.scheduling.pool.size` is declared in `application.yml` (grep returns zero matches), no `TaskScheduler` `@Bean` is declared anywhere in the codebase (`grep TaskScheduler <odd-platform-repo>/odd-platform-api/src/main` returns zero matches). Spring Boot's default `TaskSchedulerBuilder` builds a `ThreadPoolTaskScheduler` with `poolSize = 1`. All four `@Scheduled` methods share this single thread: housekeepingJob (15min cycle), statusSwitchJob (10min), partitionCreationJob (daily 00:01), session-housekeeping (1h). A 14-minute housekeepingJob cycle blocks statusSwitchJob from running on schedule; if housekeeping runs past midnight (e.g. a heavy DataEntityHousekeepingJob cascade), the daily partition-creation cron at 00:01 is queued — Spring's default cron-misfire behaviour is queue-and-delay, not skip. The partition CREATE-TABLE-IF-NOT-EXISTS calls for the next day's ACTIVITY / MESSAGE partitions are deferred until housekeeping completes; if this slides past 23:59:59 of the partition's first-use day, INSERTs against ACTIVITY / MESSAGE may fail with 'no partition exists for the given key'. **Operator mitigation**: set `spring.task.scheduling.pool.size: 4` in `application.yml` to give each scheduled job its own thread. **Documentation gap**: this is not anywhere in the live docs." — evidence: SchedulingConfiguration.java (no `TaskScheduler` bean declared) + `grep TaskScheduler <odd-platform-repo>/odd-platform-api/src/main/java` returns zero results + `grep 'spring\\.task' <odd-platform-repo>/odd-platform-api/src/main/resources` returns zero results + HousekeepingJobManager.java:25 (15min cycle) + DataEntityStatusSwitchJob.java:21 (10min) + PostgreSQLPartitionCreationJob.java:40 (cron 00:01) + PostgreSQLSessionHousekeepingJobHandler.java:13 (1h). — severity: HIGH

- "**`PostgreSQLSessionHousekeepingJobHandler` has `@Scheduled` but NO `@SchedulerLock` — runs on every replica simultaneously**. PostgreSQLSessionHousekeepingJobHandler.java:13-18 declares `@Scheduled(fixedRate = 1, timeUnit = TimeUnit.HOURS)` and `deleteExpiredSessions()` — but the class is missing the `@SchedulerLock` annotation that the other three `@Scheduled` methods (HousekeepingJobManager, DataEntityStatusSwitchJob, PostgreSQLPartitionCreationJob) all have. The `defaultLockAtMostFor = \"1h\"` at SchedulingConfiguration.java:14 does NOT apply because `defaultLockAtMostFor` is the default for `@SchedulerLock` that OMITS its own `lockAtMostFor` — it is NOT an implicit lock for bare `@Scheduled`. Result: a 5-replica deployment runs the expired-session purge 5 times per hour, not once. The DELETE-by-expired-timestamp is idempotent (delete-a-nonexistent-row is no-op) so this is operationally HARMLESS today — but the architectural inconsistency violates the implicit convention that `@Scheduled` is always paired with `@SchedulerLock` in this codebase. A future developer copying the pattern would inherit the inconsistency. Suggested fix: add `@SchedulerLock(name = \"sessionHousekeepingJob\", lockAtLeastFor = \"30m\", lockAtMostFor = \"55m\")` to match the convention." — evidence: PostgreSQLSessionHousekeepingJobHandler.java:13-18 (the `@Scheduled` without `@SchedulerLock`) + HousekeepingJobManager.java:26 + DataEntityStatusSwitchJob.java:22 + PostgreSQLPartitionCreationJob.java:41 (the three that DO have `@SchedulerLock`). — severity: LOW (operationally harmless today; convention violation; latent risk if the session-purge implementation ever became non-idempotent)

- "**`defaultLockAtMostFor = \"1h\"` is currently DEAD CODE**. All three `@SchedulerLock`-annotated methods in the codebase set their own `lockAtMostFor` explicitly (housekeepingJob = 14m, statusSwitchJob = 9m, partitionCreationJob = 10m). The `1h` default at SchedulingConfiguration.java:14 applies to ZERO methods in the current codebase. It exists as a latent safety floor for future `@SchedulerLock` annotations that omit their timing attributes — but no current code path exercises it. A reader of SchedulingConfiguration.java cannot tell from the file alone whether the default is meaningful; the `1h` value is only understood by reading the three downstream `@SchedulerLock` consumers and confirming each sets its own. Suggested mitigation: add a `// @SchedulerLock without lockAtMostFor falls back to 1h — currently no consumer relies on this` Javadoc to make the intent explicit." — evidence: SchedulingConfiguration.java:14 + grep `@SchedulerLock` across `<odd-platform-repo>/odd-platform-api/src/main` returns three matches, all of which set `lockAtMostFor` explicitly (HousekeepingJobManager.java:26, DataEntityStatusSwitchJob.java:22, PostgreSQLPartitionCreationJob.java:41). — severity: LOW

- "**No graceful shutdown of in-flight scheduled jobs**. Spring's default `ThreadPoolTaskScheduler` behaviour on JVM shutdown is to interrupt running threads and discard queued tasks unless `spring.task.scheduling.shutdown.await-termination` is set. No such configuration is present in `application.yml`. If `kubectl delete pod` issues SIGTERM during a housekeeping cycle, the in-flight jOOQ transaction is interrupted mid-cascade — the transaction rolls back (this part is safe via try-with-resources on the connection), but the partial work is lost and the next replica picks up the same backlog from scratch. The lockAtMostFor (14m for housekeeping) ensures the shedlock row is eventually released, so this does not deadlock the system — but during the lock-hold window after a graceful-shutdown attempt, no replica can run housekeeping. Operator impact: rolling deployments on a busy housekeeping cycle introduce up to 14 minutes of housekeeping pause per restart. Suggested mitigation: set `spring.task.scheduling.shutdown.await-termination: true` + `spring.task.scheduling.shutdown.await-termination-period: 60s` for graceful drain (though a 14-minute job will still exceed any reasonable termination period — the only true mitigation is splitting housekeeping into smaller chunks)." — evidence: SchedulingConfiguration.java (no TaskScheduler bean declared with custom shutdown semantics) + `grep 'shutdown.*await' <odd-platform-repo>/odd-platform-api/src/main/resources` returns zero results. — severity: MEDIUM

- "**LockProvider bean name shadowing risk** — `lockProvider` is a single-word, generic Bean name. If a future module declares another `LockProvider` Bean (e.g. for a Redis-based lock in a feature branch), Spring's container fails to start with `ConflictingBeanDefinitionException` unless one uses `@Primary` or `@Qualifier`. The current single LockProvider is safe, but the bean name lacks a namespace prefix (`schedulerLockProvider` would be safer). Minor convention issue." — evidence: SchedulingConfiguration.java:17-25 (the `@Bean` method named `lockProvider`). — severity: LOW

- "**No observability on lock acquisition / contention**. SchedulingConfiguration provides no Micrometer counter for `shedlock_acquisition_success_total` / `shedlock_acquisition_failure_total`, no histogram for lock-hold duration, no log emission on lock-contention events. An operator answering 'is replica B failing to acquire the housekeeping lock because replica A is holding it for the full 14 minutes?' has no observable surface — must inspect the `shedlock` PG table via SQL. Suggested mitigation: wrap the LockProvider with a Micrometer-instrumented decorator." — evidence: SchedulingConfiguration.java:17-25 (no Micrometer instrumentation on the LockProvider Bean) + grep `Counter|Meter|Gauge` against `<odd-platform-repo>/odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/config` returns no scheduling-related matches. — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "SchedulingConfiguration.java:14"
      name: "defaultLockAtMostFor"
      value: "1h"
      questions:
        - q: "What at N = 0? At N = 1?"
          a: "N/A — `defaultLockAtMostFor` is a Duration string; 0 / 1 are not the relevant boundaries. Relevant boundaries are 'omitted' (defaults to ShedLock's library default — typically Long.MAX_VALUE meaning lock until manual release) and 'set to a value' (1h here). The codebase's choice of 1h sits between 0 (no safety floor — lock could deadlock indefinitely on JVM crash) and Long.MAX_VALUE (lock effectively permanent until manual release)."
          confidence: STATIC-INFERRED
          evidence: "SchedulingConfiguration.java:14 + ShedLock library default behaviour"
        - q: "What at N = tunable + 1? At N = tunable × 100?"
          a: "If `defaultLockAtMostFor` were set to 100h (=4 days), a `@SchedulerLock` method without explicit `lockAtMostFor` would hold the shedlock row's lock_until for 4 days after JVM crash before another replica could acquire. Currently dead code (all three `@SchedulerLock`s set their own values) so the value of the default does not affect operator-visible behaviour today."
          confidence: STATIC-INFERRED
          evidence: "SchedulingConfiguration.java:14 + grep `@SchedulerLock` returning three matches all of which override `lockAtMostFor`"
        - q: "What does the operator see at each boundary?"
          a: "Today, NOTHING — the default is dead code. If a future `@SchedulerLock(name = \"X\")` omits its own `lockAtMostFor`, an X-job that crashes mid-execution holds the X lock for up to 1h after crash before another replica can re-acquire."
          confidence: STATIC-INFERRED
          evidence: "SchedulingConfiguration.java:14 + the three downstream `@SchedulerLock` consumers"
    - location: "SchedulingConfiguration.java:22"
      name: ".usingDbTime()"
      value: "(magic-string toggle — categorical)"
      questions:
        - q: "What at N = 0? At N = 1?"
          a: "N/A — categorical toggle. Without `.usingDbTime()` the JdbcTemplateLockProvider uses JVM-side `Instant.now()` for lock_until / locked_at timestamps. With it, PG's `current_timestamp` is used."
          confidence: STATIC-INFERRED
          evidence: "SchedulingConfiguration.java:22 + ShedLock JdbcTemplateLockProvider source semantics"
        - q: "What at N = tunable + 1? At N = tunable × 100?"
          a: "N/A — boolean-shaped choice."
          confidence: STATIC-INFERRED
          evidence: "SchedulingConfiguration.java:22"
        - q: "What does the operator see at each boundary?"
          a: "WITH `.usingDbTime()` (current state): multi-replica deployments tolerate JVM clock drift — both replicas read PG's authoritative time, so a lock-held-by-replica-A is correctly seen by replica-B regardless of their relative clock state. WITHOUT (hypothetical refactor that removed the call): clock skew between replicas would cause incorrect lock-validity decisions. A replica with a fast clock could prematurely consider an expired-lock-row as still-held, OR consider a still-held lock as expired and grab it (split-brain)."
          confidence: STATIC-INFERRED
          evidence: "SchedulingConfiguration.java:22 (the `.usingDbTime()` call)"
    - location: "(absence — `spring.task.scheduling.pool.size`)"
      name: "ThreadPoolTaskScheduler.poolSize"
      value: "1 (Spring Boot default — not overridden)"
      questions:
        - q: "What at N = 0? At N = 1?"
          a: "At N=1 (current state): all four `@Scheduled` methods (housekeeping 15m, status-switch 10m, partition-creation daily, session-housekeeping 1h) execute on ONE thread sequentially. When two are due simultaneously, the second waits for the first to finish."
          confidence: STATIC-INFERRED
          evidence: "Absence of `spring.task.scheduling.pool.size` in application.yml + absence of `TaskScheduler` `@Bean` in codebase + Spring Boot 3.x autoconfigure default"
        - q: "What at N = tunable + 1? At N = tunable × 100?"
          a: "At N=2 (a single increment): housekeeping and status-switch can run concurrently; partition-creation and session-housekeeping can run concurrently with either. At N=100: practically equivalent to N=4 for the current codebase (only 4 `@Scheduled` jobs). The increment cost is one extra thread + the DB-connection-pool contention from concurrent shedlock UPSERTs."
          confidence: STATIC-INFERRED
          evidence: "Spring Boot's `TaskSchedulerBuilder` source semantics + the four `@Scheduled` consumers"
        - q: "What does the operator see at each boundary?"
          a: "At N=1 (today): a 14-minute housekeeping cycle delays statusSwitch by up to 14 minutes. A housekeeping cycle that runs past midnight delays partitionCreation (00:01 cron) by minutes-to-hours. **PROBE-NEEDED P-183** — Spring's default cron-misfire behaviour under thread starvation is theoretically queue-and-execute-ASAP but not verified empirically for this codebase. At N=4: each job has its own thread; the only contention is the shared HikariCP pool (negligible for sub-1-QPS shedlock writes)."
          confidence: PROBE-NEEDED
          evidence: "P-183"
  name_behavior_pairs:
    - name: "@EnableScheduling"
      promise: "Spring's scheduled-task infrastructure is enabled; every `@Scheduled` annotation in the application becomes active."
      implementation: "Spring imports `ScheduledAnnotationBeanPostProcessor` which scans the ApplicationContext for `@Scheduled` annotations and registers tasks on the default `TaskScheduler` (a `ThreadPoolTaskScheduler` with poolSize=1 unless overridden by `spring.task.scheduling.pool.size` or a custom `TaskScheduler` `@Bean`)."
      drift: NONE
      operator_visible_consequence: "(none — name and implementation match — but see Tunables and the bugs_limitations_corner_cases for the single-thread-default observability gap)"
      confidence: STATIC-INFERRED
      evidence: "SchedulingConfiguration.java:13 + Spring Framework `@EnableScheduling` Javadoc"
    - name: "@EnableSchedulerLock(defaultLockAtMostFor = \"1h\")"
      promise: "Schedules are wrapped in distributed locks; methods that don't specify a per-method `lockAtMostFor` inherit 1h."
      implementation: "ShedLock-spring imports `MethodProxyScheduledLockAdvisor`, an AOP advisor that intercepts every `@SchedulerLock`-annotated method. `defaultLockAtMostFor` is the fallback ONLY for `@SchedulerLock` methods whose `lockAtMostFor` attribute is unset. It is NOT an implicit lock for bare `@Scheduled` methods."
      drift: MINOR
      operator_visible_consequence: "A reader might assume that adding `@EnableSchedulerLock` somehow protects ALL `@Scheduled` methods. It does not — `PostgreSQLSessionHousekeepingJobHandler.deleteExpiredSessions` has `@Scheduled` but no `@SchedulerLock`, and therefore runs unlocked on every replica every hour, in contradiction to the apparent scope of the platform-level `@EnableSchedulerLock`. The name promises 'enable scheduler lock'; the actual mechanism is 'enable scheduler-lock AOP — opt in per method via `@SchedulerLock`'."
      confidence: STATIC-INFERRED
      evidence: "SchedulingConfiguration.java:14 + PostgreSQLSessionHousekeepingJobHandler.java:13-18 (`@Scheduled` without `@SchedulerLock`)"
    - name: "lockProvider(DataSource) — `@Bean`"
      promise: "Returns a ShedLock LockProvider configured for distributed lock arbitration."
      implementation: "Returns a `JdbcTemplateLockProvider` constructed from a `JdbcTemplate` over the auto-wired primary DataSource, with `.usingDbTime()` enabled. The `.usingDbTime()` call is the load-bearing choice — without it, the provider uses JVM-side timestamps and is vulnerable to clock-skew across replicas."
      drift: NONE
      operator_visible_consequence: "Name and implementation match. Operationally correct."
      confidence: STATIC-INFERRED
      evidence: "SchedulingConfiguration.java:17-25"
  orderings: []
  auth_gates: []
  resource_boundaries:
    - location: "SchedulingConfiguration.java:14"
      kind: lock
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "The LockProvider Bean itself is stateless (PG-backed). Two replicas booting simultaneously and both attempting to acquire the same `@SchedulerLock` name receive atomic INSERT-OR-UPDATE semantics from PG's `usingDbTime` — only one wins. For the four `@Scheduled` jobs: three are protected by `@SchedulerLock` with explicit lockAtLeastFor/AtMostFor pairs (housekeeping 14m/14m, status-switch 9m/9m, partition-creation 10m/10m); session-housekeeping is NOT locked and runs concurrently on every replica every hour. The session-purge's DELETE-by-expired-timestamp is idempotent so the race is harmless today."
          confidence: STATIC-INFERRED
          evidence: "SchedulingConfiguration.java:14 + the four `@Scheduled` consumers (three locked + one unlocked) + PostgreSQLSessionHousekeepingJobHandler.java:13-18 (no `@SchedulerLock`)"
        - q: "Is the call replay-safe?"
          a: "Lock acquisition is replay-safe (PG's INSERT-OR-UPDATE on `shedlock(name)` PK guarantees atomicity). The locked methods themselves vary in replay-safety (DataEntityHousekeepingJob's ~25-table cascade is NOT replay-safe — see HousekeepingJobManager sidecar)."
          confidence: STATIC-INFERRED
          evidence: "V0_0_52__introduce_housekeeping.sql:10-18 (shedlock table with name PK) + SchedulingConfiguration.java:18-25 (the provider config)"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No cache. The LockProvider issues fresh PG queries on every lock acquisition/release. The `shedlock` row's `lock_until` IS the staleness window — once it expires (per `usingDbTime` PG `current_timestamp`), another replica can acquire."
          confidence: STATIC-INFERRED
          evidence: "SchedulingConfiguration.java:17-25 (no cache layer in the LockProvider construction)"
    - location: "SchedulingConfiguration.java:13"
      kind: concurrency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "`@EnableScheduling` enables ONE `TaskScheduler` bean (single-thread default). The four `@Scheduled` methods serialise through this single thread; two cannot run concurrently within a single JVM. Across JVMs (multi-replica), only ShedLock prevents concurrent execution of the locked three; the unlocked session-housekeeping runs concurrently across replicas as noted above."
          confidence: STATIC-INFERRED
          evidence: "SchedulingConfiguration.java:13 + absence of `TaskScheduler` bean elsewhere + absence of `spring.task.scheduling.pool.size` in application.yml"
        - q: "Is the call replay-safe?"
          a: "`@EnableScheduling` is a boot-time idempotent annotation. It does not perform mutations; it imports Spring's ScheduledAnnotationBeanPostProcessor."
          confidence: STATIC-INFERRED
          evidence: "Spring Framework `@EnableScheduling` semantics"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "N/A — boot-time annotation, no cache."
          confidence: STATIC-INFERRED
          evidence: "SchedulingConfiguration.java:13"
  request_inputs: []
  probes_emitted:
    - probe_id: P-183
      question: "Under Spring Boot's default single-thread TaskScheduler, when a `@Scheduled(fixedRate = 15min)` job (housekeeping) runs for ~14 minutes and a `@Scheduled(cron = \"0 1 0 * * *\")` job (partition-creation) is scheduled to fire at 00:01 during that window — does the partition-creation cron RUN late (queued behind the running housekeeping) or SKIP (discarded as misfired)?"
      probe_path: "lineage/odd-platform/probes/P-183.yaml"
    - probe_id: P-182
      question: "Multi-instance correctness: two JVMs boot simultaneously, both `@SchedulerLock(\"housekeepingJob\", 14m, 14m)` methods fire at the same wall-clock moment. With `.usingDbTime()` enabled, only one wins lock acquisition. Verify the second receives `Optional.empty()` from the LockProvider and no-ops; verify the first's `shedlock` row `lock_until` is approximately PG's `now() + 14m`, NOT JVM's `Instant.now() + 14m`."
      probe_path: "lineage/odd-platform/probes/P-182.yaml"
  stress_summary:
    triggers_total: 6
    questions_total: 18
    answers_static_inferred: 17
    answers_probe_needed: 1
    answers_reference: 0
    drift_flags: 1
```

## security

- auth_mode_relevance: INTERNAL_ONLY
  - "`SchedulingConfiguration` is a Spring `@Configuration` evaluated at boot. It declares no HTTP endpoint, no `@PreAuthorize`, no security filter. Auth modes (DISABLED / LOGIN_FORM / OAUTH2 / LDAP / S2S) do not apply. The LockProvider Bean's PG connections run under the platform's `spring.datasource.username` permissions, not any user's session. The `@EnableScheduling` annotation is unconditional — scheduling is enabled regardless of `auth.type`." — evidence: SchedulingConfiguration.java (no security annotations, no `@ConditionalOnProperty` on auth.type) + application.yml:1-7 (the datasource credentials used).
- ingestion_filter_relevance: "N/A — not HTTP. SchedulingConfiguration evaluates at boot and produces a LockProvider Bean; no ingestion path involvement."
- authorization_assertions: []
- owner_scoping: "N/A — not data-scoped. SchedulingConfiguration declares no per-entity data access; it provides infrastructure consumed by `@Scheduled` methods that themselves operate at system scope (housekeeping, partition-creation, status-switch, session-housekeeping). See the four downstream sidecars for owner-scoping observations on the consumers."
- data_exposure:
  - "Credentials used internally only: `JdbcTemplateLockProvider` connects to the primary DataSource via the auto-wired `spring.datasource.url / username / password`. A connection-acquisition failure inside ShedLock would log a stack trace; the standard PG JDBC driver redacts the password but may surface the host/user."
- known_security_gaps:
  - "**No `@SchedulerLock` on the session-housekeeping job means every replica purges sessions concurrently every hour without coordination.** This is operationally harmless today (the DELETE-by-expired-timestamp is idempotent), but if the session-purge implementation ever evolved to non-idempotent work (e.g. issuing audit events on purge), every replica would emit duplicate events. This is also an inconsistent posture relative to the other three `@Scheduled` methods, which all coordinate via ShedLock. A future security review of session-purge behaviour (e.g. SOC 2 expectation that 'session-cleanup is logged once per cleanup') would need this distinction surfaced." — evidence: PostgreSQLSessionHousekeepingJobHandler.java:13-18 (no `@SchedulerLock`) + SchedulingConfiguration.java:14 (the platform-level `@EnableSchedulerLock` that suggests lock-everywhere but only applies to `@SchedulerLock`-annotated methods). — severity: LOW

  - "**No audit log of LockProvider activity**. SchedulingConfiguration provides no Micrometer counter, no structured audit event, no log emission on lock-acquisition success / failure / contention. A malicious actor with PG write access could manipulate the `shedlock` table directly (insert a forever-held lock_until far in the future) to prevent housekeeping from running on any replica — silently disabling data-retention. There is no detection mechanism. Suggested mitigation: a Micrometer counter on lock-acquisition outcomes + a boot-time read of the `shedlock` table values into a tamper-evident log." — evidence: SchedulingConfiguration.java:17-25 (no instrumentation on the LockProvider Bean). — severity: LOW (requires DB write access — same threat surface as direct data deletion via SQL)

## performance

- hot_paths:
  - "**Boot-time LockProvider construction** (SchedulingConfiguration.java:17-25). One-time on application startup; ~one PG round-trip to validate the `JdbcTemplate` (actually `JdbcTemplate` is lazy — no validation until first lock acquisition)."
  - "**Per-lock-acquisition PG round-trip** (the JdbcTemplateLockProvider mechanic). Every `@SchedulerLock` method invocation issues an INSERT-OR-UPDATE against the `shedlock` table — 4 `@Scheduled` jobs × their cadences = baseline ~10-15 lock UPSERTs per hour platform-wide (3 locked jobs at cadences of 10min, 15min, daily — partition-creation is one UPSERT/day; the session-purge issues no shedlock UPSERT since it's not `@SchedulerLock`-annotated). Sub-1-QPS; negligible PG load."
- throughput_characteristics:
  - "**Single-thread executor** = serial throughput. All `@Scheduled` jobs share one thread; max-1 job runs at a time. Total throughput = 1 ÷ (sum of all jobs' durations) per cadence-window."
  - "**Single shared HikariCP pool for ShedLock UPSERTs**. One connection per lock acquisition; sub-1-QPS rate; consumes ~1 connection-slot for the duration of each acquisition (~ms)."
- resource_allocation:
  - "Heap footprint: one `JdbcTemplate` (a thin wrapper over the auto-wired DataSource) + one `JdbcTemplateLockProvider` instance. Negligible — both are singleton beans."
  - "PG-side: one row per active lock in the `shedlock` table — at most three rows simultaneously (housekeeping, status-switch, partition-creation). PG storage footprint < 1KB."
  - "Thread footprint: ONE thread for the entire `@Scheduled` subsystem (Spring's default `ThreadPoolTaskScheduler` poolSize=1). The thread is named `scheduling-1` (Spring's default `thread-name-prefix`)."
- scaling_characteristics:
  - "**Horizontal scaling — partial**: adding replicas does NOT parallelise the three `@SchedulerLock`-protected jobs (housekeeping / status-switch / partition-creation); ShedLock guarantees one-at-a-time across replicas via PG arbitration. Adding replicas DOES multiply the session-housekeeping job (it runs on every replica without lock coordination)."
  - "**Vertical scaling — bottleneck at thread count**: at single-replica scale, adding CPU does not help — the single-thread executor is the bottleneck. Setting `spring.task.scheduling.pool.size: 4` would allow concurrent execution of the four jobs but no current load profile demands this."
  - "**Lock-arbitration scaling**: ShedLock's `usingDbTime` semantics scale with PG's transaction throughput. At platform scales reaching tens-of-thousands of QPS, the few lock UPSERTs per hour are negligible. At single-replica + light-load deployments, the additional PG round-trip per lock is also negligible."
- known_performance_gaps:
  - "**Single-thread default executor — silent operational risk under load**. See bugs_limitations_corner_cases for the full description. The operator's mental model 'I have four scheduled jobs, they run in parallel' is wrong by default. A 14-minute housekeeping cycle delays the 10-minute status-switch job — over a sustained heavy backlog, the status-switch cadence drifts from 10min to 24min or worse. The mitigation (`spring.task.scheduling.pool.size: 4`) is a one-line config change that is not documented anywhere." — evidence: SchedulingConfiguration.java (no `TaskScheduler` bean) + absence of `spring.task.scheduling.pool.size` + HousekeepingJobManager.java:25 / DataEntityStatusSwitchJob.java:21 / PostgreSQLPartitionCreationJob.java:40 / PostgreSQLSessionHousekeepingJobHandler.java:13 (the four consumers). — severity: HIGH

  - "**No backlog / no missed-fire metric**. Spring's `ThreadPoolTaskScheduler` has internal state (queued tasks, missed cron evaluations) but no Micrometer integration is configured. An operator answering 'is my partition-creation cron firing on time, or has it been queued behind housekeeping for the last 24 hours?' has no observable surface — must query the actual partition tables to detect missing partitions. Suggested mitigation: a `@Bean public TaskScheduler` declaration with explicit Micrometer-instrumented `ThreadPoolTaskExecutor` that exports `spring_executor_queued_tasks`, `spring_executor_active_threads`." — evidence: SchedulingConfiguration.java (no TaskScheduler bean, no Micrometer config) + grep `MeterRegistry|Micrometer` against SchedulingConfiguration.java returning zero matches. — severity: MEDIUM

  - "**Shared DataSource between scheduling-locks and main jOOQ traffic**. The same HikariCP pool serves both the platform's user-facing controller jOOQ queries and the ShedLock UPSERTs. Under HikariCP-pool exhaustion (e.g. a slow query holding many connections), a `@SchedulerLock` method cannot acquire its lock — silently skipping the cycle. The contention is real but low-probability today; suggested mitigation would be a separate `@Bean(\"shedlockDataSource\")` with its own connection limit." — evidence: SchedulingConfiguration.java:18 (the constructor parameter is the primary DataSource — no @Qualifier). — severity: LOW

## upstream_callers

- entry_point: "boot:@EnableScheduling + @EnableSchedulerLock(defaultLockAtMostFor=1h) — Spring container ApplicationContext startup"
  caller_node: "spring-container-boot"
  multiplicity_per_trigger: 1
  evidence: "SchedulingConfiguration.java:12-15 — `@Configuration` evaluated once on application startup; produces three side-effects (Spring scheduled-task infrastructure + ShedLock-spring AOP + LockProvider Bean)"
  observation_class: boot-eval

- entry_point: "boot:@Bean LockProvider — autowired into ShedLock AOP advisor"
  caller_node: "MethodProxyScheduledLockAdvisor (ShedLock-spring internal — not an enriched node)"
  multiplicity_per_trigger: 1
  evidence: "SchedulingConfiguration.java:17-25 — Bean declaration consumed by ShedLock's internal advisor; advisor instantiation happens once on context refresh"
  observation_class: boot-eval

- entry_point: "scheduled:HousekeepingJobManager.runHousekeepingJobs (fixedRate=15min + @SchedulerLock)"
  caller_node: "odd-platform java service service:HousekeepingJobManager"
  multiplicity_per_trigger: 1
  evidence: "HousekeepingJobManager.java:25-27 — every 15 minutes the AOP advisor calls into `LockProvider.lock(LockConfiguration)` to acquire a row in the `shedlock` table"
  observation_class: scheduled-trigger

- entry_point: "scheduled:DataEntityStatusSwitchJob.run (fixedRate=10min + @SchedulerLock)"
  caller_node: "odd-platform java service service.job:DataEntityStatusSwitchJob"
  multiplicity_per_trigger: 1
  evidence: "DataEntityStatusSwitchJob.java:21-23 — every 10 minutes the AOP advisor calls into the LockProvider"
  observation_class: scheduled-trigger

- entry_point: "scheduled:PostgreSQLPartitionCreationJob.run (cron=00:01 daily + @SchedulerLock)"
  caller_node: "odd-platform java partition partition:PostgreSQLPartitionCreationJob"
  multiplicity_per_trigger: 1
  evidence: "PostgreSQLPartitionCreationJob.java:40-42 — once per day at 00:01 the AOP advisor calls into the LockProvider"
  observation_class: scheduled-trigger

- entry_point: "scheduled:PostgreSQLSessionHousekeepingJobHandler.deleteExpiredSessions (fixedRate=1h, NO @SchedulerLock)"
  caller_node: "odd-platform java auth.session session-handler:PostgreSQLSessionHousekeepingJobHandler"
  multiplicity_per_trigger: 0
  evidence: "PostgreSQLSessionHousekeepingJobHandler.java:13-18 — every hour Spring's TaskScheduler invokes the method, but ShedLock's AOP does NOT intercept (no `@SchedulerLock`); the LockProvider Bean is not consulted. Multiplicity = 0 lock-provider invocations per session-housekeeping trigger."
  observation_class: scheduled-trigger
  unresolved: false

## downstream_side_effects

- side_effect_class: db-write
  description: "On lock acquisition: INSERT-OR-UPDATE row in `shedlock` table (sets `lock_until = PG.now() + lockAtMostFor`, `locked_at = PG.now()`, `locked_by = <replica-id>`). On lock release: UPDATE row to set `lock_until = PG.now() + lockAtLeastFor` (so concurrent replicas wait at least this long before retry)."
  evidence: "SchedulingConfiguration.java:18-25 (the JdbcTemplateLockProvider configuration with `.usingDbTime()`) + V0_0_52__introduce_housekeeping.sql:10-18 (the shedlock table schema)"
  cardinality_per_call: 2  # one UPSERT on acquire + one UPDATE on release
  reachable_from_entry_points:
    - "scheduled:HousekeepingJobManager.runHousekeepingJobs"
    - "scheduled:DataEntityStatusSwitchJob.run"
    - "scheduled:PostgreSQLPartitionCreationJob.run"
    # NOT reachable from session-housekeeping — no @SchedulerLock

- side_effect_class: cache-mutate
  description: "On boot: registers the LockProvider singleton in Spring's ApplicationContext as bean `lockProvider`. This is a one-time mutation of the BeanFactory state."
  evidence: "SchedulingConfiguration.java:17-25 (the `@Bean` method)"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "boot:@EnableScheduling + @EnableSchedulerLock"

- side_effect_class: cache-mutate
  description: "On boot: registers a `ThreadPoolTaskScheduler` singleton bean (Spring's default, poolSize=1) via `@EnableScheduling`'s autoconfiguration. Also registers `ScheduledAnnotationBeanPostProcessor` which scans for `@Scheduled` annotations and registers them as recurring tasks on the TaskScheduler."
  evidence: "SchedulingConfiguration.java:13 (`@EnableScheduling`) + Spring Framework autoconfiguration semantics"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "boot:@EnableScheduling + @EnableSchedulerLock"

## sources

- understanding ← SchedulingConfiguration.java:1-26 + HousekeepingJobManager.java:25-26 + DataEntityStatusSwitchJob.java:21-23 + PostgreSQLPartitionCreationJob.java:40-42 + PostgreSQLSessionHousekeepingJobHandler.java:13-18 + application.yml:1-40 (no `spring.task.*`) + V0_0_52__introduce_housekeeping.sql:10-18 (shedlock table schema)
- concepts.entities ← SchedulingConfiguration.java:3-14 (imports + annotations) + grep `@Scheduled` against `<odd-platform-repo>/odd-platform-api/src/main/java` returning four files
- concepts.operations ← SchedulingConfiguration.java:13 (`@EnableScheduling`) + SchedulingConfiguration.java:14 (`@EnableSchedulerLock`) + SchedulingConfiguration.java:17-25 (the Bean factory)
- concepts.invariants ← SchedulingConfiguration.java:18 (DataSource parameter — no @Qualifier) + SchedulingConfiguration.java:22 (`.usingDbTime()`) + SchedulingConfiguration.java:14 (`defaultLockAtMostFor = "1h"`) + grep `@SchedulerLock` returning three explicit-value matches + PostgreSQLSessionHousekeepingJobHandler.java:13-18 (the asymmetric `@Scheduled` without `@SchedulerLock`) + absence of `spring.task.*` in application.yml + absence of `TaskScheduler` Bean in the codebase
- dependencies_semantic.requires-feature ← SchedulingConfiguration.java:13-14 (the two `@Enable*` imports) + ShedLock JdbcTemplateLockProvider import at line 5
- dependencies_semantic.requires-config ← SchedulingConfiguration.java:18 (DataSource constructor param) + application.yml:1-7 (the primary datasource) + grep `spring.task.scheduling` against `<odd-platform-repo>/odd-platform-api/src/main/resources` returning zero matches
- dependencies_semantic.requires-runtime ← V0_0_52__introduce_housekeeping.sql:10-18 (the shedlock table) + ShedLock-spring 5.x runtime via the package import at SchedulingConfiguration.java:6
- dependencies_semantic.coupling ← HousekeepingJobManager.java:25-26 + DataEntityStatusSwitchJob.java:21-22 + PostgreSQLPartitionCreationJob.java:40-41 + PostgreSQLSessionHousekeepingJobHandler.java:13 (no `@SchedulerLock`) + SessionConfiguration.java:37-43 (the session-handler Bean wiring conditional on `session.provider=INTERNAL_POSTGRESQL`)
- tests_coverage_semantic.test_files ← grep `SchedulingConfiguration|EnableScheduling|EnableSchedulerLock|LockProvider|JdbcTemplateLockProvider` against `<odd-platform-repo>/odd-platform-api/src/test` returning zero matches
- tests_coverage_semantic.gaps ← SchedulingConfiguration.java (the entire 26-line file, untested) + absence of any test asserting thread-pool size / lock semantics / DB-time invariant
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform 2026-05-26 (HTTP 200; quoted verbatim re. ShedLock for housekeeping; no mention of SchedulingConfiguration / defaultLockAtMostFor / usingDbTime / single-thread-executor / session-housekeeping unlock asymmetry)
- docs_link_semantic.doc_drift_findings.[0] ← SchedulingConfiguration.java (no TaskScheduler bean) + application.yml (no spring.task.scheduling.pool.size) + WebFetch /configuration-and-deployment/odd-platform 2026-05-26 (no thread-pool documentation)
- docs_link_semantic.doc_drift_findings.[1] ← SchedulingConfiguration.java:14 (the 1h default) + WebFetch 2026-05-26 (no mention of the default)
- docs_link_semantic.doc_drift_findings.[2] ← SchedulingConfiguration.java:22 (`.usingDbTime()`) + WebFetch 2026-05-26 (no clock-skew narrative)
- docs_link_semantic.doc_drift_findings.[3] ← PostgreSQLSessionHousekeepingJobHandler.java:13 (no `@SchedulerLock`) + WebFetch 2026-05-26 (the docs call session-housekeeping "not configurable" without explaining the asymmetry)
- implicit_adrs.[0] ← SchedulingConfiguration.java:22 (`.usingDbTime()`) + ShedLock JdbcTemplateLockProvider source semantics
- implicit_adrs.[1] ← SchedulingConfiguration.java:14 (`defaultLockAtMostFor = "1h"`) + grep `@SchedulerLock` returning three matches all with explicit `lockAtMostFor`
- implicit_adrs.[2] ← SchedulingConfiguration.java:12-15 (the three annotations stacked)
- implicit_adrs.[3] ← SchedulingConfiguration.java:18 (DataSource parameter without @Qualifier)
- bugs_limitations_corner_cases.[0] ← SchedulingConfiguration.java (no TaskScheduler bean) + application.yml (no spring.task.scheduling.pool.size) + HousekeepingJobManager.java:25 + DataEntityStatusSwitchJob.java:21 + PostgreSQLPartitionCreationJob.java:40 + PostgreSQLSessionHousekeepingJobHandler.java:13
- bugs_limitations_corner_cases.[1] ← PostgreSQLSessionHousekeepingJobHandler.java:13-18 (the missing `@SchedulerLock`)
- bugs_limitations_corner_cases.[2] ← SchedulingConfiguration.java:14 + the three `@SchedulerLock` consumers (all setting explicit `lockAtMostFor`)
- bugs_limitations_corner_cases.[3] ← SchedulingConfiguration.java (no TaskScheduler bean with shutdown semantics) + application.yml (no shutdown.await-termination)
- bugs_limitations_corner_cases.[4] ← SchedulingConfiguration.java:17-25 (the generic `lockProvider` Bean name)
- bugs_limitations_corner_cases.[5] ← SchedulingConfiguration.java:17-25 (no Micrometer instrumentation)
- security.auth_mode_relevance ← SchedulingConfiguration.java (no security annotations)
- security.ingestion_filter_relevance ← SchedulingConfiguration.java (not HTTP)
- security.owner_scoping ← SchedulingConfiguration.java (provides infrastructure, not data access)
- security.data_exposure ← SchedulingConfiguration.java:18 (datasource consumption)
- security.known_security_gaps.[0] ← PostgreSQLSessionHousekeepingJobHandler.java:13-18 + SchedulingConfiguration.java:14
- security.known_security_gaps.[1] ← SchedulingConfiguration.java:17-25 (no instrumentation)
- performance.hot_paths ← SchedulingConfiguration.java:17-25 + the four `@Scheduled` consumers
- performance.throughput_characteristics ← SchedulingConfiguration.java (single-thread default executor) + the four `@Scheduled` consumers
- performance.resource_allocation ← SchedulingConfiguration.java:17-25
- performance.scaling_characteristics ← SchedulingConfiguration.java:14 + the four `@Scheduled` consumers
- performance.known_performance_gaps.[0] ← SchedulingConfiguration.java (no TaskScheduler bean) + the four `@Scheduled` consumers
- performance.known_performance_gaps.[1] ← SchedulingConfiguration.java (no Micrometer)
- performance.known_performance_gaps.[2] ← SchedulingConfiguration.java:18 (shared DataSource)
- upstream_callers.[0] ← SchedulingConfiguration.java:12-15 (the `@Configuration` annotations)
- upstream_callers.[1] ← SchedulingConfiguration.java:17-25 (the `@Bean` method)
- upstream_callers.[2-5] ← HousekeepingJobManager.java:25-26 + DataEntityStatusSwitchJob.java:21-22 + PostgreSQLPartitionCreationJob.java:40-41 + PostgreSQLSessionHousekeepingJobHandler.java:13
- downstream_side_effects.[0] ← SchedulingConfiguration.java:18-25 (the LockProvider config) + V0_0_52__introduce_housekeeping.sql:10-18 (the shedlock schema)
- downstream_side_effects.[1] ← SchedulingConfiguration.java:17-25 (the `@Bean` method)
- downstream_side_effects.[2] ← SchedulingConfiguration.java:13 (`@EnableScheduling`)
- stress_findings ← SchedulingConfiguration.java:14 (defaultLockAtMostFor) + SchedulingConfiguration.java:22 (usingDbTime) + absence of `spring.task.scheduling.pool.size` + the four `@Scheduled` consumers + emitted probes P-183 (cron-misfire) + P-182 (multi-instance lock race)

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (test absence verified via grep — zero matches for any of `SchedulingConfiguration|EnableScheduling|EnableSchedulerLock|LockProvider|JdbcTemplateLockProvider` against the test directory)
- docs_link_semantic: HIGH (live WebFetch 2026-05-26 confirmed status 200; verbatim quotes preserved; absence of SchedulingConfiguration-specific documentation explicitly stated)
- implicit_adrs: HIGH (four decisions each anchored on explicit code + intent — except the colocation ADR which is MEDIUM because the intent is structural-only with no comment)
- bugs_limitations_corner_cases: HIGH (every finding cited at file:line, including absence-of-config evidence via grep)
- security: HIGH (auth-mode irrelevance + the session-housekeeping unlock asymmetry are both code-anchored)
- performance: HIGH (single-thread default + the four-consumer fan-out are mechanically derived from absence-of-config)
- upstream_callers: HIGH (the four `@Scheduled` consumers + boot-eval each cited at file:line)
- downstream_side_effects: HIGH (DB-write to shedlock + the two boot-time Bean-registration cache-mutations all cited)
- stress_findings: HIGH (17 of 18 questions are STATIC-INFERRED with strong evidence; 1 PROBE-NEEDED (the cron-misfire empirical question) with concrete probe P-183 emitted; the multi-instance race PROBE P-182 was emitted to lock in the contract for future regression detection)

## Maintainer notes

(none — net-new sidecar)

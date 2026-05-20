---
node_id: "odd-platform java service service:HousekeepingJobManager"
node_kind: service
axis: services
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-19-batch-K-housekeeping-job-manager
pillar_mapping:
  primary: P-08
  secondary: [P-04, P-07]
  rationale: |
    Primary P-08 Management and Administration — Housekeeping is operator-facing
    operational infrastructure (the `housekeeping.enabled` master gate, the
    `housekeeping.ttl.*` retention knobs that an operator tunes); the
    system-mission's "Platform-Internal Operational Infrastructure" pending
    canonicalisation candidate explicitly names housekeeping. Secondary
    P-04 Data Quality (`AlertHousekeepingJob` purges resolved DQ-failure /
    schema-break alerts) and P-07 Active Platform Features (the alerting and
    activity-feed subsystems whose retention is co-owned by this job and the
    partition manager).
---

# HousekeepingJobManager (`@Scheduled(fixedRate=15min) + @SchedulerLock`) — semantic understanding

## understanding

`HousekeepingJobManager` is the Spring `@Component` orchestrator for the ODD Platform's housekeeping subsystem: a 48-line class that fires every 15 minutes via `@Scheduled(fixedRate = 15, timeUnit = TimeUnit.MINUTES)`, holds a 14-minute ShedLock named `housekeepingJob`, acquires ONE JDBC `Connection` from `PGConnectionFactory`, and iterates a constructor-injected `List<HousekeepingJob>` of FIVE discovered beans, invoking each sequentially on the shared connection. The class is gated by `@ConditionalOnProperty("housekeeping.enabled", havingValue = "true")` with no `matchIfMissing` — strict opt-in if the key is absent from the resolved configuration; `application.yml:166` ships `housekeeping.enabled: true` and the integration-test profile (`src/test/resources/application-integration-test.yml:7-8`) flips it to `false`. The five discovered jobs are three time-based purge jobs (`AlertHousekeepingJob`, `SearchFacetsHousekeepingJob`, `DataEntityHousekeepingJob`) that consume `HousekeepingTTLProperties` and hard-DELETE rows past the configured cutoff, plus two `EmptyPartitionsHousekeepingJob` subclasses (`ActivityEmptyPartitionsHousekeepingJob`, `MessageEmptyPartitionsHousekeepingJob`) that drop EMPTY past partitions only. Job failures are isolated per-job by an inner try/catch (`runHousekeepingJob` lines 41-47) that logs at ERROR and continues to the next job — one failing job does NOT stall the others within the same cycle, but does NOT produce a structured audit / metric and is invisible at the UI/API surface.

## concepts

- entities:
  - HousekeepingJobManager (this class)
  - HousekeepingJob (the interface — `housekeeping/job/HousekeepingJob.java:5-7`)
  - AlertHousekeepingJob (TTL-driven, consumes `housekeeping.ttl.resolved_alerts_days`)
  - SearchFacetsHousekeepingJob (TTL-driven, consumes `housekeeping.ttl.search_facets_days`)
  - DataEntityHousekeepingJob (TTL-driven, consumes `housekeeping.ttl.data_entity_delete_days`, cascades through ~25 tables)
  - EmptyPartitionsHousekeepingJob (abstract base — drops EMPTY past partitions only)
  - ActivityEmptyPartitionsHousekeepingJob (extends abstract base, targets `ACTIVITY` table)
  - MessageEmptyPartitionsHousekeepingJob (extends abstract base, targets `MESSAGE` table, excludes `MESSAGE_PROVIDER_EVENT`)
  - HousekeepingTTLProperties (`@ConfigurationProperties("housekeeping.ttl")`)
  - PGConnectionFactory (the shared JDBC connection source)
  - ShedLock `housekeepingJob` lock name
  - PostgreSQLSessionHousekeepingJob (UNRELATED — separate Spring-session expiration job in `auth/session/`, fires at fixedRate=1h, has its own handler, NOT part of this manager's iteration)
- operations:
  - schedule fixedRate=15min cycle
  - acquire ShedLock named `housekeepingJob` (lockAtLeastFor=14m, lockAtMostFor=14m)
  - assert lock held (LockAssert.assertLocked())
  - acquire one JDBC Connection from PGConnectionFactory
  - iterate List of HousekeepingJob beans synchronously
  - invoke doHousekeeping(connection) on each
  - catch + log per-job exceptions at ERROR (failure isolation)
  - close connection at end of cycle via try-with-resources
- invariants:
  - "Strict opt-in: `@ConditionalOnProperty(value = \"housekeeping.enabled\", havingValue = \"true\")` with NO `matchIfMissing` (HousekeepingJobManager.java:18). If the key is absent from the resolved config, the bean is not instantiated and housekeeping silently does not run. application.yml:166 ships `enabled: true`; the test profile flips it to `false`."
  - "Single connection per cycle: one `pgConnectionFactory.getConnection()` call at line 32 wraps all five jobs in try-with-resources. A slow DataEntityHousekeepingJob holds the connection for the duration of its ~25-table cascade; AlertHousekeepingJob / SearchFacetsHousekeepingJob run sequentially after it on the same connection."
  - "ShedLock window: `lockAtLeastFor = \"14m\"` and `lockAtMostFor = \"14m\"` (line 26). Combined with `fixedRate=15` minutes, only 60 seconds of slack between maximum lock and next scheduled invocation — a cycle that runs ≥14 minutes can release the lock prematurely and allow a second instance to acquire at the 15-minute mark while the first is still committing."
  - "Per-job failure isolation: `runHousekeepingJob` catches `Exception` and logs at ERROR (lines 41-47), then the outer loop continues to the next job. One job failing does NOT abort the cycle; ONE failed Connection acquisition (`SQLException` at line 36) DOES abort the cycle for all jobs that did not yet run."
  - "Order of execution = bean discovery order. The `List<HousekeepingJob>` injection (line 23) receives beans in Spring's order — not explicitly declared. The five jobs' interaction safety is not order-dependent today (each operates on a disjoint table set), but a future reordering or a new job with cross-job dependencies would inherit this implicit ordering risk."
  - "Verbatim from live docs (WebFetch /configuration-and-deployment/odd-platform 2026-05-19, status 200): 'The platform identifies three cleanup tasks executed by the housekeeping job' — the docs page enumerates THREE, the code defines FIVE HousekeepingJob beans. The two empty-partition-drop jobs are not surfaced in the docs."
- audiences:
  - "odd-platform operators tuning database growth"
  - "DBAs sizing the ALERT / SEARCH_FACETS / DATA_ENTITY tables (and partition tables for ACTIVITY / MESSAGE)"
  - "compliance / data-retention reviewers — but the audit trail of WHAT was deleted is debug-level only (REFACTOR-NNN observability absence)"
  - "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform (Configure ODD Platform reference)"

## dependencies_semantic

- requires-feature:
  - "Five concrete `HousekeepingJob` bean implementations (the housekeeping/job/ package) — discovered via constructor injection of `List<HousekeepingJob>` (HousekeepingJobManager.java:23). Spring's component-scan finds every `@Component` implementing the interface."
  - "ShedLock-Spring (`net.javacrumbs.shedlock.spring.annotation.SchedulerLock`) — required for distributed-deployment correctness. Without it, every replica would independently DELETE every 15 minutes and the DataEntityHousekeepingJob cascade is non-idempotent (races would be observable as transaction conflicts or duplicate work)."
  - "Spring Boot scheduling subsystem (`@Scheduled`) enabled via `SchedulingConfiguration` (`@EnableScheduling` + `@EnableSchedulerLock(defaultLockAtMostFor = \"1h\")` at SchedulingConfiguration.java:13-14)."
  - "`HousekeepingTTLProperties` — consumed by the three TTL-driven jobs (not directly by this manager). Bound via `@EnableConfigurationProperties` at `ODDPlatformConfiguration.java:13-16`."
  - "`PartitionService` (`PartitionServiceImpl`) — consumed by the two empty-partition-drop jobs via the abstract base `EmptyPartitionsHousekeepingJob`."
- requires-config:
  - "`housekeeping.enabled` — boolean; no Java-side default (no `matchIfMissing`); defaults to `true` in `application.yml:166`. Read at boot only; the `HousekeepingJobManager` bean is conditionally registered (HousekeepingJobManager.java:18). A runtime change requires a JVM restart."
  - "Indirect consumers via housekeepingJobs[]: `housekeeping.ttl.resolved_alerts_days` (default 30 in application.yml:168), `housekeeping.ttl.search_facets_days` (default 30, line 169), `housekeeping.ttl.data_entity_delete_days` (default 30, line 170)."
  - "`spring.datasource.*` — the DataSourceProperties consumed by `PGConnectionFactory.getConnection()` at PGConnectionFactory.java:23-32. The same datasource backs the ShedLock JdbcTemplateLockProvider (SchedulingConfiguration.java:18-25)."
- requires-runtime:
  - "PostgreSQL — the JDBC connection target; all jobs issue jOOQ DML (DELETE / SELECT). ShedLock is also Postgres-backed (`JdbcTemplateLockProvider` + `usingDbTime()` at SchedulingConfiguration.java:22-23)."
  - "Java 17 + Spring Boot 3 scheduling — `@Scheduled` and `@SchedulerLock` runtime support."
  - "PGConnectionFactory uses `DriverManager.getConnection(url, props)` (PGConnectionFactory.java:36) — a raw JDBC `Connection` outside the Spring transaction manager. The individual housekeeping jobs wrap their work in `DSL.using(connection).transaction(ctx -> ...)` to manage transactions explicitly."
- coupling:
  - "Conceptual sibling with `PostgreSQLPartitionCreationJob` (the partition-CREATION cron orchestrator at partition/PostgreSQLPartitionCreationJob.java:21). Both inject `PGConnectionFactory` and both fan out to discovered beans (`List<PartitionManager>` vs `List<HousekeepingJob>`); the partition CREATION job runs nightly at `00:01` with a 10-minute ShedLock named `partitionCreationJob`. Housekeeping (this class) and partition-creation share NO advisory lock id — they coordinate via independent ShedLock names. The activity/message tables sit at the intersection: `ActivityTablePartitionManager` creates new partitions nightly, and `ActivityEmptyPartitionsHousekeepingJob` drops empty past partitions every 15 minutes."
  - "Conceptual sibling with `DataEntityStatusSwitchJob` (service/job/DataEntityStatusSwitchJob.java:21) — fires every 10 minutes with a 9-minute ShedLock named `statusSwitchJob`. That job moves data-entities INTO `DELETED` status (the soft-delete step); `DataEntityHousekeepingJob` then hard-deletes them after `data_entity_delete_days`. Two distinct schedulers, two distinct ShedLock names, two distinct rate budgets — soft-delete cadence (10min) is faster than housekeeping cadence (15min)."
  - "Conceptual sibling with `PostgreSQLSessionHousekeepingJobHandler` (auth/session/PostgreSQLSessionHousekeepingJobHandler.java:13) — the `PostgreSQL`-backed Spring-session expiration purge runs at `fixedRate=1h` and uses the default ShedLock window (`defaultLockAtMostFor = \"1h\"` at SchedulingConfiguration.java:14) since it declares no explicit `@SchedulerLock`. This job is NOT part of `HousekeepingJobManager`'s iteration — it lives in a separate Spring-session subsystem gated by `session.provider=INTERNAL_POSTGRESQL` (SessionConfiguration.java:37-43). The shared 'housekeeping' name is naming overlap, not architectural relation."
  - "Operator-trap coupling with attachment-storage default (LSN-001-shape): `DataEntityHousekeepingJob.deleteFiles` calls `fileUploadService.deleteFiles(filePojos).block()` at DataEntityHousekeepingJob.java:142 — REACTIVE call `.block()`ed INSIDE the surrounding jOOQ transaction (DataEntityHousekeepingJob.java:71 wraps everything in `DSL.using(connection).transaction(ctx -> ...)`). If MinIO / S3 storage is unreachable, the `block()` either hangs (no explicit timeout) or throws — taking the entire ~25-table cascade with it via transaction rollback. The outer `runHousekeepingJob` catch logs at ERROR and the next cycle retries the entire batch (REFACTOR-145 batch D — `.block()` inside transaction anti-pattern)."

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - "Master gate: `housekeeping.enabled=false` does NOT register `HousekeepingJobManager`. Integration-test profile relies on this at application-integration-test.yml:7-8 (`housekeeping: enabled: false`), but the assertion is INDIRECT — no positive test verifies the bean is absent. A regression that flipped the default to `false` or removed `@ConditionalOnProperty` would alter integration-test scheduling without breaking any test."
  - "Master gate corner: `housekeeping.enabled` ABSENT (key removed entirely from custom application.yml) produces identical behaviour to `enabled=false` because `@ConditionalOnProperty` has no `matchIfMissing` (HousekeepingJobManager.java:18). The docs page calls housekeeping 'on by default', which is true only because application.yml ships `enabled: true`. A customised application.yml that omits the key produces silent no-op — no test asserts this distinction."
  - "Schedule semantics: `@Scheduled(fixedRate=15, timeUnit=MINUTES)` — Spring's `fixedRate` schedules NEXT invocation 15 minutes after PREVIOUS invocation STARTED. A cycle that runs 20 minutes triggers next cycle immediately on completion. No test verifies cadence under slow-cycle conditions."
  - "ShedLock window: `lockAtLeastFor=14m / lockAtMostFor=14m`. A cycle running exactly 14 minutes releases the lock as the 15-minute slot arrives. A second instance can acquire the lock at minute 15 while the first is still in the final jOOQ transaction commit. No multi-instance integration test exercises this."
  - "Connection exhaustion: `pgConnectionFactory.getConnection()` (line 32) acquires from `DriverManager.getConnection` directly (PGConnectionFactory.java:36) — bypasses HikariCP and the Spring DataSource pool. Connection leaks would be invisible to JMX metrics watching the pool; no test verifies the connection is closed under exception paths."
  - "Per-job exception isolation: `runHousekeepingJob` (lines 41-47) catches `Exception` and logs at ERROR; the loop continues. No test verifies that a `RuntimeException` in `AlertHousekeepingJob.doHousekeeping` does NOT prevent `DataEntityHousekeepingJob.doHousekeeping` from running in the same cycle."
  - "Cycle-level exception: `SQLException` at line 36 (connection acquisition failure) ABORTS the cycle for all jobs that did not yet run. The next cycle starts fresh 15 minutes later. No test verifies graceful recovery from transient connection failures (e.g. PG restart mid-cycle)."
  - "Bean discovery order: `List<HousekeepingJob>` injection (line 23) — Spring's discovered order is NOT explicitly asserted. A future job with a cross-job dependency (e.g. 'run AlertHousekeepingJob before DataEntityHousekeepingJob') would silently regress if the order changed."
  - "LockAssert.assertLocked() guard at line 28: if invoked outside a held lock, ShedLock throws. No test verifies the lock-held assertion (i.e. a test that artificially calls `runHousekeepingJobs()` without acquiring the lock should fail loudly)."
- test_files: []
- gaps: |
    Grep against `<odd-platform-repo>/odd-platform-api/src/test` for `Housekeeping` returns
    zero matches. The entire 48-line orchestrator + the five job implementations
    have NO direct test coverage. The integration-test profile exists to OPT OUT
    of housekeeping (`housekeeping.enabled: false` at
    application-integration-test.yml:8), not to test it.

    Likeliest regression sites:

    1. **The 14m-vs-15m ShedLock window** — a 14-minute lock against a 15-minute
       schedule is razor-thin. A DataEntityHousekeepingJob cascade against a
       backlog of thousands of soft-deleted entities can plausibly exceed 14
       minutes (the ~25-table cascade with `.block()` on S3 deletions). Lock
       release before commit + next-cycle acquisition by a second instance
       produces undefined cross-instance state. A multi-instance integration
       test artificially injecting a 15-minute sleep into one job and verifying
       the second instance does NOT acquire would catch the regression class.

    2. **Per-job exception isolation regression** — the inner try/catch at
       lines 41-47 is the ONLY mechanism preventing one failed job from
       cascading. A future refactor that moved the loop body inline (or that
       changed the catch type from `Exception` to a narrower exception) would
       silently regress isolation. A unit test that injects a throwing
       HousekeepingJob and asserts the remaining jobs still run would lock
       the contract.

    3. **`@ConditionalOnProperty` matchIfMissing semantics** — the docs claim
       housekeeping is on-by-default. The Java declares strict opt-in (no
       `matchIfMissing`). An operator-customised application.yml that omits
       the key silently disables the subsystem. A Spring-context test
       asserting that with the key absent the `HousekeepingJobManager` bean
       is NOT in the ApplicationContext would document the actual semantic.

    4. **Bean-discovery ordering** — five jobs today, but a future sixth job
       added to the package would extend the `List<HousekeepingJob>` and
       run in an undefined position. No test enforces an ordering contract.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform"
    anchor: "#housekeeping"
    rationale: |
      Canonical Configure ODD Platform reference page; documents
      housekeeping.enabled, the three TTL keys, the 15-minute cycle, and
      the ShedLock coordination claim. Live-WebFetched in this session.
    last_verified_at: "2026-05-19T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Live page verbatim quotes (WebFetched 2026-05-19, HTTP 200):
      - "The platform identifies **three cleanup tasks** executed by the
        housekeeping job"
      - "`housekeeping.enabled`: Activates the background job. Defaults to
        true. The job fires every 15 minutes and uses ShedLock for
        multi-instance coordination."
      - "`housekeeping.ttl.resolved_alerts_days`: how many days an alert in
        RESOLVED_AUTOMATICALLY status is kept after its status-update
        timestamp before the housekeeping job permanently deletes it.
        Defaults to 30 days."
      - "`housekeeping.ttl.search_facets_days`: Retention window for
        search-facet entries past their last_accessed_at timestamp.
        Defaults to 30 days."
      - "`housekeeping.ttl.data_entity_delete_days`: how many days a data
        entity with status DELETED is kept after its status-update
        timestamp. Cascading deletions include metadata values, ownerships,
        lineage, tags, terms, alerts, messages, metrics, attachments, task
        runs, group relations. Defaults to 30 days."
      - "a known platform bug currently exempts manual resolutions from the
        retention check — manual RESOLVED alerts are hard-deleted on the
        next housekeeping run regardless of this value"
      - "Disabling housekeeping stops all three cleanup jobs. Resolved
        alerts, search-facet history, and soft-deleted entities ...
        accumulate indefinitely and the PostgreSQL database will grow
        without bound."

      The page does NOT mention:
      - the TWO empty-partition-drop jobs (ActivityEmptyPartitionsHousekeepingJob,
        MessageEmptyPartitionsHousekeepingJob) that also run on the same
        15-min cycle. The doc enumerates THREE; the code defines FIVE.
      - the `lockAtLeastFor` / `lockAtMostFor = 14m` window vs the 15m schedule —
        operators cannot infer the multi-instance race surface (a 14m+ cycle
        on one instance allows next-cycle acquisition by a second instance).
      - the per-job failure isolation behaviour — one failing job is caught
        and logged at ERROR; remaining jobs continue. The docs do not document
        the ERROR-level emission or its log-format, so an operator setting up
        log aggregation cannot pre-configure a housekeeping-failure alert.
      - the strict opt-in semantics: omitting `housekeeping.enabled` from a
        customised application.yml silently disables the subsystem (no
        `matchIfMissing` on the `@ConditionalOnProperty`).
      - the AlertHousekeepingJob jOOQ operator-precedence bug's actual file
        location or fix-roadmap; the acknowledgement is present but unanchored
        to a tracking issue or code line.
  - url: "https://docs.opendatadiscovery.org/features/active-platform-features/alerting"
    anchor: "#alert-retention"
    rationale: |
      Alerting feature page should be the user-facing surface that explains
      what `housekeeping.ttl.resolved_alerts_days` controls. Live-fetch
      attempt in this session — verify if a retention section exists.
    last_verified_at: "2026-05-19T00:00:00Z"
    last_verified_status: not-fetched-this-session
    confidence: LOW
    fetched_excerpts: |
      Not fetched in this session. The neighbour sidecar
      (HousekeepingTTLProperties) verifies the canonical retention page is
      the /configuration-and-deployment/odd-platform page above. The
      /features/active-platform-features/alerting page is hypothesised
      as a user-facing complement (an operator reading "what happens to
      resolved alerts" would search the feature docs, not the deployment
      docs), but no verbatim quote is held here.
- doc_drift_findings:
  - "**3-vs-5 job count framing** (cross-confirms batch D doc-drift): docs page enumerates 'three cleanup tasks' (Live-WebFetch 2026-05-19); code defines five `HousekeepingJob` beans via the housekeeping/job/ package (`AlertHousekeepingJob`, `SearchFacetsHousekeepingJob`, `DataEntityHousekeepingJob`, `ActivityEmptyPartitionsHousekeepingJob`, `MessageEmptyPartitionsHousekeepingJob`). An operator reading the docs cannot learn that the same 15-min schedule that purges alerts also drops empty activity/message partitions. **Cross-reference**: the parallel observation in the HousekeepingTTLProperties sidecar's `doc_drift_findings` records the same gap from the config angle; this sidecar adds the orchestrator-side angle (the `List<HousekeepingJob>` injection at HousekeepingJobManager.java:23 mechanically picks up all five Components — there is no separate registration step that the docs page might be referencing as 'three')."
  - "**ShedLock window not documented**: docs page says the housekeeping job uses ShedLock for multi-instance coordination but does not state the lockAtLeastFor / lockAtMostFor values. The code declares both as `14m` (HousekeepingJobManager.java:26) against a `fixedRate=15` minutes schedule (line 25). Operators choosing whether to deploy 1 / 2 / N platform replicas cannot infer from the docs that a 14m+ cycle is a multi-instance race surface."
  - "**Per-job failure isolation not documented**: the inner try/catch at HousekeepingJobManager.java:41-47 catches `Exception` and logs at ERROR (`log.error(\"Error while running a housekeeping job\", e)`), then continues to the next job. The docs page describes the cleanup tasks as if they all succeed; the failure-isolation behaviour (one job failing does not abort the cycle) is undocumented. An operator's log-aggregation alerting strategy is downstream of this contract; the docs omit it."
  - "**Strict opt-in vs 'on by default' framing**: docs say `housekeeping.enabled` 'defaults to true'. The Java declares `@ConditionalOnProperty(value = \"housekeeping.enabled\", havingValue = \"true\")` with NO `matchIfMissing` attribute (HousekeepingJobManager.java:18). The 'true default' is delivered exclusively by the shipped `application.yml:166` (`housekeeping: enabled: true`). An operator-customised application.yml that overrides this file without re-supplying the key silently disables housekeeping. The docs framing as 'default true' is technically correct but masks the strict-opt-in mechanism."

## implicit_adrs

- "Per-job failure isolation — one failed job does NOT abort the cycle. The inner try/catch at HousekeepingJobManager.java:41-47 catches `Exception` (the broadest checked-or-unchecked exception type) and logs at ERROR, then the outer loop (lines 33-35) continues to the next job. This is an intentional decision: a transient failure in one job (e.g. an FK violation introduced by a schema migration's race with housekeeping) does not prevent the other four jobs from running their cleanup. The decision is supported by the message text `\"Error while running a housekeeping job\"` (singular) — the WHY is to keep the cycle's other work uninterrupted. The decision pre-supposes that each job operates on a disjoint table set and that a failure in one is locally recoverable on the next cycle." — evidence: HousekeepingJobManager.java:41-47 (the inner try/catch around `housekeepingJob.doHousekeeping(connection)`). — intent_anchor: "the per-job catch deliberately narrower than the outer try/catch (line 36 catches only `SQLException` from connection acquisition) — explicit two-tier exception handling: connection-level failure aborts the cycle; per-job failure isolates and continues." — confidence: HIGH

- "Shared connection across all jobs in a cycle — the single `pgConnectionFactory.getConnection()` at line 32 is intentional. The architecturally-cheaper alternative (one connection per job, fresh acquire/close for each invocation) would issue five DriverManager.getConnection calls per cycle (the platform bypasses the HikariCP pool — see PGConnectionFactory.java:36). Sharing the connection is a resource-economy decision: one TCP socket, one PG backend, one auth handshake per cycle. The trade-off is that a slow first job blocks the second; the inner try/catch (per-job failure isolation) does NOT release-and-reacquire the connection on job failure — a corrupted connection from a partial transaction would propagate to the next job. The decision is visible in the for-loop on line 33 + the single try-with-resources scope on line 32." — evidence: HousekeepingJobManager.java:32-35 (single getConnection + for-loop iteration; no per-job acquire/release). — intent_anchor: "the try-with-resources scope on line 32 wraps the ENTIRE for-loop — the structural intent is one connection per cycle, not one connection per job." — confidence: HIGH

- "ShedLock window deliberately set to `14m` (lockAtLeastFor = lockAtMostFor) — both bounds equal means the lock is held for EXACTLY 14 minutes regardless of cycle completion time. `lockAtLeastFor` prevents the lock from being released early on quick cycles (a 30-second cycle still holds the lock until minute 14 — preventing churn). `lockAtMostFor` caps the lock duration so a JVM crash mid-cycle does not deadlock the lock for hours. The choice of equal values (14m == 14m) is the strictest possible coordination — no flexibility window. The choice of 14m specifically (vs 15m = fixedRate) is to ensure the lock releases BEFORE the next scheduled invocation so that the SAME instance can re-acquire on the next cycle without the lock provider rejecting due to held lock. The 60-second slack is the architectural decision." — evidence: HousekeepingJobManager.java:25-26 (`@Scheduled(fixedRate = 15, timeUnit = TimeUnit.MINUTES)` + `@SchedulerLock(name = \"housekeepingJob\", lockAtLeastFor = \"14m\", lockAtMostFor = \"14m\")`). — intent_anchor: "the equal `lockAtLeastFor` and `lockAtMostFor` values + the 60-second-below-fixedRate ceiling — explicit numerical pairing chosen to preserve same-instance re-acquisition on the immediate next cycle." — confidence: HIGH

- "Strict opt-in via `@ConditionalOnProperty` with no `matchIfMissing` — the Java declares `@ConditionalOnProperty(value = \"housekeeping.enabled\", havingValue = \"true\")` (line 18) with no default-on attribute. The shipped `application.yml:166` ships `housekeeping: enabled: true` so deployments using the bundled config get housekeeping by default; deployments overriding application.yml without the key are strict-opt-in. The decision is to fail-CLOSED on missing config (vs the alternative `matchIfMissing = true` which would default-on regardless of YAML). The mechanism keeps the integration-test profile clean (`housekeeping: enabled: false` at application-integration-test.yml:8 produces a no-op subsystem without any conditional plumbing in tests)." — evidence: HousekeepingJobManager.java:18 (`@ConditionalOnProperty(value = \"housekeeping.enabled\", havingValue = \"true\")` — no `matchIfMissing`) + application.yml:166 (shipped default) + application-integration-test.yml:8 (test override). — intent_anchor: "the absence of `matchIfMissing` is explicit — Spring's `@ConditionalOnProperty` has the attribute available, and the choice not to set it is a load-bearing decision. The pairing with the shipped application.yml's `true` default produces 'on for shipped deployments, strict-opt-in for customised deployments'." — confidence: HIGH

- "Housekeeping orchestrator separation from partition-creation orchestrator — the platform has TWO Spring-scheduled orchestrators for periodic platform-internal work: `HousekeepingJobManager` (this class, 15-min cleanup) and `PostgreSQLPartitionCreationJob` (partition/PostgreSQLPartitionCreationJob.java:21, daily partition CREATE at 00:01). The decision NOT to fold partition-creation into housekeeping (or vice versa) is visible in the package layout (`housekeeping/` vs `partition/`), the distinct ShedLock names (`housekeepingJob` vs `partitionCreationJob`), the distinct cadences (15min vs daily-cron), and the orthogonal injection patterns (`List<HousekeepingJob>` vs `List<PartitionManager>`). The architectural decision: schedule-driven cleanup and structural lifecycle creation are independent concerns with independent operational profiles." — evidence: HousekeepingJobManager.java (the orchestrator) + PostgreSQLPartitionCreationJob.java:21 (the partition-creation orchestrator) + SchedulingConfiguration.java:13-14 (the shared `@EnableScheduling` + `@EnableSchedulerLock`). — intent_anchor: "two parallel orchestrator classes with two distinct package homes, two distinct ShedLock names, and two distinct lifecycle anchors — the two-orchestrator pattern is the explicit decision." — confidence: HIGH

## bugs_limitations_corner_cases

- "**Doc-drift: docs claim 'three cleanup tasks', code defines five** (cross-confirms batch D framing finding from a second angle). The `housekeeping/job/` package contains five concrete `@Component` classes implementing `HousekeepingJob`: AlertHousekeepingJob, SearchFacetsHousekeepingJob, DataEntityHousekeepingJob, ActivityEmptyPartitionsHousekeepingJob, MessageEmptyPartitionsHousekeepingJob. Spring's `List<HousekeepingJob>` injection at HousekeepingJobManager.java:23 picks up all five mechanically. The live docs page (WebFetch /configuration-and-deployment/odd-platform 2026-05-19) describes the housekeeping job as 'three cleanup tasks' and does not enumerate the two empty-partition-drop jobs. An operator reading the docs cannot learn that the same 15-minute schedule drops empty activity/message partitions. Candidate DOC-NNN: extend the docs section to enumerate all five jobs, or qualify 'three cleanup tasks' as 'three retention-driven tasks plus two empty-partition-drop tasks'." — evidence: HousekeepingJobManager.java:23 (the `List<HousekeepingJob>` injection) + housekeeping/job/ directory listing (the five Components) + WebFetch /configuration-and-deployment/odd-platform 2026-05-19 (the 'three cleanup tasks' verbatim). — severity: MEDIUM

- "**`AlertHousekeepingJob` jOOQ operator-precedence bug — known and acknowledged on docs but unfixed, untested, and untracked at the source-line**. The bug lives at AlertHousekeepingJob.java:28-34: `.where(ALERT.STATUS.eq(RESOLVED)).or(ALERT.STATUS.eq(RESOLVED_AUTOMATICALLY)).and(ALERT.STATUS_UPDATED_AT.lessOrEqual(cutoff))`. jOOQ's fluent-builder precedence: `.and(...)` binds to the most recent `.or(...)`. The emitted SQL is therefore `WHERE (STATUS = 'RESOLVED') OR (STATUS = 'RESOLVED_AUTOMATICALLY' AND STATUS_UPDATED_AT <= cutoff)`. The TTL applies ONLY to `RESOLVED_AUTOMATICALLY` rows; manual `RESOLVED` rows are hard-deleted on the very next 15-minute cycle regardless of `resolvedAlertsDays`. The live docs (WebFetch 2026-05-19) acknowledges this verbatim: 'a known platform bug currently exempts manual resolutions from the retention check — manual RESOLVED alerts are hard-deleted on the next housekeeping run regardless of this value'. **There is no `// TODO`, no `// BUG`, no comment in the source pointing to the docs acknowledgement, no GitHub-issue link, no regression test asserting either current behaviour or intended behaviour.** A future maintainer reading the docs page learns the bug exists but cannot find the corresponding code line. The fix: parenthesise the predicate as `.where(STATUS.eq(RESOLVED).or(STATUS.eq(RESOLVED_AUTOMATICALLY))).and(STATUS_UPDATED_AT.lessOrEqual(cutoff))`. This is the PRIMARY-SOURCE confirmation of REFACTOR-142." — evidence: AlertHousekeepingJob.java:28-34 (the jOOQ predicate chain) + WebFetch /configuration-and-deployment/odd-platform 2026-05-19 (the docs acknowledgement). — severity: HIGH

- "**`.block()` inside transaction anti-pattern** (REFACTOR-145 batch D, cross-confirmed from the manager-side angle). `DataEntityHousekeepingJob.doHousekeeping` (lines 71-82) wraps the entire ~25-table cascade in `DSL.using(connection).transaction(ctx -> {...})`. Inside that transaction, `deleteFiles` (lines 131-143) calls the REACTIVE `fileUploadService.deleteFiles(filePojos).block()` at line 142. This is a reactive-Mono blocked inside a JDBC transaction: (a) the reactor thread is blocked synchronously, which may stall Netty's worker if invoked on the wrong scheduler (in this case the @Scheduled invocation runs on Spring's task scheduler thread pool, not Netty's event loop, so it does not deadlock the HTTP surface — but the architectural smell remains); (b) the `.block()` has no explicit timeout (no `.block(Duration)`), so a hung MinIO / S3 call hangs the entire housekeeping cycle until either the transport-level read-timeout fires or until the 14-minute ShedLock expires. If the S3 call eventually throws, the transaction rolls back ALL ~25 deletes — the next cycle retries the entire batch (REFACTOR-145 latent dragon: under persistent S3 misconfiguration, the data-entity housekeeping never makes progress, and the only signal is `log.error` at the outer manager-level catch at HousekeepingJobManager.java:45)." — evidence: DataEntityHousekeepingJob.java:71 (the transaction wrap) + DataEntityHousekeepingJob.java:142 (the .block() call) + HousekeepingJobManager.java:45 (the outer catch logging at ERROR). — severity: MEDIUM (silent backlog accumulation under persistent S3 failure)

- "**`lockAtMostFor = \"14m\"` is dangerously close to `fixedRate = 15 minutes`** — the 60-second slack is the smallest plausible coordination window for a 15-minute job. Under heavy load (a DataEntityHousekeepingJob cascade over thousands of soft-deleted entities, especially with `.block()` on S3 file deletions adding network latency), a cycle running ≥14 minutes releases the lock before commit and a second instance can acquire at the next 15-minute slot while the first is still finalising the transaction. The result is two instances running housekeeping concurrently — the AlertHousekeepingJob and SearchFacetsHousekeepingJob jOOQ DELETEs use `WHERE id IN (...)` which is idempotent (delete-a-nonexistent-row is a no-op), but the DataEntityHousekeepingJob's ~25-table cascade involves SELECTs followed by DELETEs (lines 75-78 then 82) — two concurrent instances could read different snapshots and produce divergent cascade behaviour. **No safety guarantee against this in code; the contract relies on operators sizing the soft-deleted-entity backlog to keep cycles below 14 minutes**. A safer setting would be `lockAtMostFor` ≥ `2 × fixedRate` (e.g. 30 minutes) so the lock outlives any plausible cycle duration; the current setting is performance-aware (release sooner so the same instance can re-acquire) but operationally fragile." — evidence: HousekeepingJobManager.java:25 (`fixedRate = 15, timeUnit = TimeUnit.MINUTES`) + HousekeepingJobManager.java:26 (`lockAtLeastFor = \"14m\", lockAtMostFor = \"14m\"`). — severity: LOW (theoretical until backlog grows; would manifest only under high data-entity-soft-delete throughput)

- "**Observability absence — no Micrometer metric, no Prometheus counter, no structured audit event, no @ActivityLog**. Per-job logging at the manager is `log.debug(\"Running housekeeping jobs\")` (line 30) and `log.error(\"Error while running a housekeeping job\", e)` (line 45). Per-job logging inside each `HousekeepingJob` is `log.debug(\"... deleted N\")` (AlertHousekeepingJob.java:45, SearchFacetsHousekeepingJob.java:29, DataEntityHousekeepingJob.java:128). Default production logging configuration does NOT include DEBUG, so a successful cycle is completely silent. An operator answering 'how much did housekeeping delete yesterday?' has no observable surface — must run `SELECT count(*) FROM alert WHERE status IN (...) AND status_updated_at <= now() - 30 days` manually. There is no `housekeeping_deleted_total{table=alert}` Prometheus counter, no `housekeeping_cycle_duration_seconds` histogram, no audit log of the deletion. Compliance frameworks requiring 'data deletions must be logged and reviewable' are not satisfied by this subsystem." — evidence: HousekeepingJobManager.java:30 (manager debug) + line 45 (manager error) + AlertHousekeepingJob.java:45 + SearchFacetsHousekeepingJob.java:29 + DataEntityHousekeepingJob.java:128 (all debug-level in jobs) + grep `Counter|Meter|Gauge|@ActivityLog` against housekeeping/ returning zero matches. — severity: MEDIUM

- "**No dry-run / no preview / no archival-before-delete mechanism**. The three TTL-driven jobs issue jOOQ DELETE directly (AlertHousekeepingJob.java:40-43, SearchFacetsHousekeepingJob.java:23-27, DataEntityHousekeepingJob.java:99-126). There is no `housekeeping.dry-run=true` config that logs what WOULD be deleted, no `housekeeping.ttl.archive-table` that copies rows before delete, no operator-overrideable gate. A misconfigured `housekeeping.ttl.data_entity_delete_days=1` would immediately cascade through ~25 tables on the next 15-minute cycle with no recovery path. The LSN-001 shape applies: silent default + immediate destructive action + no preview." — evidence: HousekeepingJobManager.java:25-39 (no dry-run check before invoking `housekeepingJob.doHousekeeping(connection)`) + AlertHousekeepingJob.java:40-43 + DataEntityHousekeepingJob.java:99-126. — severity: MEDIUM

- "**`@ConditionalOnProperty(\"housekeeping.enabled\", havingValue = \"true\")` with NO `matchIfMissing`** — silent no-op if the key is absent from a customised application.yml. An operator deploying with `--spring.config.location=/etc/odd/myconfig.yml` and forgetting the `housekeeping.enabled` key gets zero housekeeping with NO log message at boot (the bean is conditionally not registered; absence is the default conditional-on-property behaviour). The docs page describes housekeeping as on-by-default; the actual behaviour is on-by-default only when the shipped application.yml is the resolved config." — evidence: HousekeepingJobManager.java:18 (no `matchIfMissing` attribute). — severity: LOW (operator-error gated; shipped default works correctly)

- "**No housekeeping-job ordering contract** — the `List<HousekeepingJob>` injection at line 23 receives beans in Spring's discovered order, which is not explicitly declared anywhere. A future job with cross-job dependencies (e.g. 'a new TermHousekeepingJob must run BEFORE DataEntityHousekeepingJob to avoid stale FK references') would silently inherit whatever order Spring picks. No `@Order` annotations, no `@DependsOn`, no explicit list ordering in the manager. Today's five jobs operate on disjoint table sets so order is irrelevant, but the contract is fragile to extension." — evidence: HousekeepingJobManager.java:23 (`private final List<HousekeepingJob> housekeepingJobs;`) + housekeeping/job/AlertHousekeepingJob.java + .../SearchFacetsHousekeepingJob.java + .../DataEntityHousekeepingJob.java + .../ActivityEmptyPartitionsHousekeepingJob.java + .../MessageEmptyPartitionsHousekeepingJob.java (no @Order annotations on any of the five). — severity: LOW

- "**No connection-pool integration — `PGConnectionFactory.getConnection()` uses `DriverManager.getConnection`** (PGConnectionFactory.java:36). The housekeeping subsystem bypasses HikariCP entirely. This means connection-pool exhaustion metrics (HikariCP gauges in JMX) do NOT cover housekeeping connections, and a connection-leak in housekeeping is invisible to pool monitoring. The shared connection is closed by try-with-resources at HousekeepingJobManager.java:32 (and would be closed even on exception via the `finally` semantic of try-with-resources), so the leak risk is bounded — but the architectural smell is that housekeeping connections are off-the-record from the platform's primary connection-pool observability surface." — evidence: HousekeepingJobManager.java:32 (`pgConnectionFactory.getConnection()` in try-with-resources) + PGConnectionFactory.java:36 (`DriverManager.getConnection(url, props)`). — severity: LOW

## security

- auth_mode_relevance: INTERNAL_ONLY
  - "`HousekeepingJobManager` is a `@Component` registered conditionally on `housekeeping.enabled` (HousekeepingJobManager.java:18). It runs in Spring's scheduled-task context, NOT on the HTTP surface. Auth modes (DISABLED / LOGIN_FORM / OAUTH2 / LDAP / S2S) do not apply directly. The bean is instantiated regardless of `auth.type`; cleanup runs under the JVM's permissions on the DB connection (the application's `spring.datasource.username`), not under any user's session." — evidence: HousekeepingJobManager.java:18 (the `@ConditionalOnProperty` is on `housekeeping.enabled`, not on `auth.type`) + HousekeepingJobManager.java:25 (`@Scheduled`, not `@PostMapping`).
- ingestion_filter_relevance: "N/A — not HTTP. The housekeeping subsystem does not participate in `POST /ingestion/entities`; it runs on a Spring-scheduled fixed-rate cycle (HousekeepingJobManager.java:25)."
- authorization_assertions: []
- owner_scoping: "BYPASSES — the orchestrator and all five jobs operate at system scope, deleting rows across ALL OWNERS without regard to the ODD ownership model. This is intentional (housekeeping is a system-level admin operation), but means: a future regression that introduced per-owner scoping (e.g. 'this tenant's housekeeping uses tenant-id') would need to thread tenant identity through the manager — currently the manager has no notion of owner or tenant. Note also that `DataEntityHousekeepingJob.deleteOwnerships` (lines 268-273) is a CASCADE step within the data-entity purge — it removes ALL ownership rows for the soft-deleted entity regardless of who the Owners are." — evidence: HousekeepingJobManager.java (entire file — no owner / tenant fields, no ownership-context lookup) + AlertHousekeepingJob.java:28-34 (no OWNERSHIP join) + DataEntityHousekeepingJob.java:268-273 (the cascade step).
- data_exposure:
  - "Housekeeping does NOT expose data outbound — there is no HTTP response, no external sink containing the deleted content. The data-flow direction is INVERSE: deleted rows are gone; the only acknowledgement is `log.debug(\"deleted N\")` at debug level (per-job) and `log.error(\"Error while running a housekeeping job\", e)` at the manager level on failure. Production log aggregation that filters DEBUG would surface no successful-deletion record."
  - "Connection credentials: `PGConnectionFactory.getConnection()` (PGConnectionFactory.java:23-32) sets the JDBC URL + username + password from `spring.datasource.*` via `DataSourceProperties`. If the JDBC URL or credentials contain secrets (e.g. embedded passwords), a connection-acquisition failure (line 36 SQLException) is caught by HousekeepingJobManager line 36 and logged via `log.error(\"Couldn't obtain connection for housekeeping\", e)` — the stack trace MAY include the URL depending on the JDBC driver's exception message. Standard Postgres JDBC driver redacts the password but may surface the host/user."
- known_security_gaps:
  - "**No tamper-evident audit log of housekeeping configuration changes or deletions** — a malicious operator with `housekeeping.ttl.*` write access at deploy time (e.g. via Helm chart override, env var, or Spring Cloud Config) could set all three TTLs to `0` and the next housekeeping cycle would silently destroy all RESOLVED alert history, all search-facet history, and all soft-deleted entities (with the ~25-table cascade including OWNERSHIP relations). There is NO audit trail of the configuration change AND NO audit trail of the deletion. Compliance frameworks requiring 'changes to data retention policies must be logged and reviewable' (SOX / GDPR records-of-processing) are not satisfied. Suggested mitigation: structured audit event on the housekeeping cycle (`audit.housekeeping.cycle{table, deleted, cutoff}`) + boot-time emission of the resolved `HousekeepingTTLProperties` values into a tamper-evident log channel." — evidence: HousekeepingJobManager.java (no audit annotation, no Micrometer counter) + HousekeepingTTLProperties.java (no audit annotation) + AlertHousekeepingJob.java + SearchFacetsHousekeepingJob.java + DataEntityHousekeepingJob.java (none emit structured audit; all use log.debug only). — severity: MEDIUM

  - "**No rate-limit / no kill-switch / no preview mechanism on the destructive cycle** — once `housekeeping.enabled=true`, the cycle fires unconditionally every 15 minutes. There is no operator-overrideable gate to pause an in-progress cycle, no `kill -USR1` style runtime knob, no preview mode. An operator who notices in real-time that `housekeeping.ttl.data_entity_delete_days=1` was accidentally deployed (e.g. via a misconfigured Helm release) has approximately 15 minutes until the next cycle fires, after which the cascade runs to completion (or to S3 timeout) — there is no in-cycle abort. The closest mitigation is restarting the JVM during a cycle (which kills the connection and rolls back the in-progress transaction), but this is operator-aware and time-sensitive." — evidence: HousekeepingJobManager.java:25-39 (no rate-limit, no kill-switch field, no preview check before invoking `housekeepingJob.doHousekeeping(connection)`). — severity: MEDIUM

  - "**Manager-level catch logs at ERROR but does NOT surface to an alert / metric** — HousekeepingJobManager.java:36-38 catches `SQLException` from the connection acquisition and logs `\"Couldn't obtain connection for housekeeping\"` at ERROR. HousekeepingJobManager.java:44-46 catches per-job `Exception` and logs `\"Error while running a housekeeping job\"` at ERROR. Neither code path increments a Prometheus counter, neither emits a structured failure event. An operator's log-aggregation pipeline must pattern-match the literal error strings to detect housekeeping failure; the alert path is implicit. Suggested mitigation: a `housekeeping_failure_total{type=connection|job}` Prometheus counter on each catch." — evidence: HousekeepingJobManager.java:36-38 + HousekeepingJobManager.java:44-46 (both `log.error` only, no metric). — severity: LOW

## performance

- hot_paths:
  - "15-minute fixed-rate cycle on a single platform instance (HousekeepingJobManager.java:25 `@Scheduled(fixedRate = 15, timeUnit = TimeUnit.MINUTES)`). On a quiet system, total cycle time is sub-second (each job's DELETE matches zero rows); on a busy system with thousands of soft-deleted data entities, the DataEntityHousekeepingJob cascade can take minutes."
  - "Manager-level orchestration is bound by the SLOWEST job in the iteration — sequential execution on one connection (lines 33-35). The cycle's total duration is the SUM of all five jobs' durations, not the MAX."
- throughput_characteristics:
  - "Single connection, sequential job fan-out — `pgConnectionFactory.getConnection()` (line 32) acquires ONE JDBC connection and the for-loop on lines 33-35 invokes each `HousekeepingJob.doHousekeeping(connection)` synchronously. There is NO parallelism across the five jobs. A 30-second AlertHousekeepingJob delays SearchFacetsHousekeepingJob by 30 seconds."
  - "Each TTL-driven job wraps its work in `DSL.using(connection).transaction(ctx -> ...)` — the connection's transaction state changes per job (AlertHousekeepingJob commits, then SearchFacetsHousekeepingJob runs in auto-commit mode at SearchFacetsHousekeepingJob.java:21-30 — note that SearchFacetsHousekeepingJob does NOT wrap its single DELETE in an explicit transaction)."
  - "ShedLock acquisition adds a single DB round-trip at the start of each cycle (the JdbcTemplateLockProvider at SchedulingConfiguration.java:18-25 issues an INSERT-or-UPDATE against the `shedlock` table). The 14-minute window provides single-instance ownership for the duration."
- resource_allocation:
  - "Single JDBC connection per cycle — one PG backend connection consumed from `DriverManager.getConnection` (PGConnectionFactory.java:36), held for the full cycle duration, closed by try-with-resources at HousekeepingJobManager.java:32. NOT pooled — bypasses HikariCP."
  - "Manager-level heap footprint is minimal (the `List<HousekeepingJob>` is the only manager-held collection; five references). The bulk allocations live INSIDE DataEntityHousekeepingJob (the `List<DataEntityPojo>`, the message-UUID list, the metric-series-id list) — these are the cycle's actual memory hot-spots but are owned by the job, not the manager."
  - "ShedLock holds one row in the `shedlock` PG table for the duration of the 14-minute window — negligible DB footprint."
- scaling_characteristics:
  - "Multi-instance correctness — ShedLock-coordinated. Only ONE platform instance runs housekeeping per 15-minute slot. Adding replicas does NOT parallelise housekeeping (the cycle stays single-threaded on whichever instance acquired the lock). Adding replicas DOES provide failover: if the holding instance crashes, the lock expires (at the 14-minute upper bound) and a different instance can acquire on the next cycle."
  - "`fixedRate` semantics — Spring schedules NEXT invocation 15 minutes AFTER PREVIOUS invocation STARTED. A 10-minute cycle leads to a 5-minute idle gap; a 20-minute cycle leads to the next invocation firing IMMEDIATELY on completion. Combined with the 14-minute ShedLock, this means a 20-minute cycle on instance-A would release the lock at minute 14, allow instance-B to acquire at minute 15, and on completion of instance-A's cycle (minute 20), Spring would queue the next invocation immediately on instance-A — but the lock would already be held by instance-B. Spring's `@Scheduled` would attempt the invocation, ShedLock would reject, and instance-A would no-op until the next 15-minute slot (minute 30). The cadence drifts under sustained heavy load."
  - "Job-internal scaling: AlertHousekeepingJob and SearchFacetsHousekeepingJob are O(N) single-table DELETEs that scale linearly with row count past TTL — quick on small systems, minutes on systems with millions of resolved alerts. DataEntityHousekeepingJob is O(N × 25) cascaded DELETEs and scales WORSE — a backlog of 10K soft-deleted entities issues ~250K DELETE statements across one transaction (each `WHERE id IN (...)` is one statement, but the cascaded jOOQ DELETEs in DataEntityHousekeepingJob.java:99-126 are 25 distinct DELETE statements per cascade-step, all in one transaction). The activity/message empty-partition-drop jobs scale O(P) with the number of past partitions of those tables (each partition checked with `SELECT count(*) = 0 FROM <partition>` per cycle — no caching of 'non-empty last cycle, skip this cycle')."
- known_performance_gaps:
  - "**Sequential single-connection fan-out — slowest job blocks the cycle**. The five jobs run synchronously on one connection (HousekeepingJobManager.java:32-35); a DataEntityHousekeepingJob cascade that takes 10 minutes delays AlertHousekeepingJob and SearchFacetsHousekeepingJob (both single-table DELETEs, sub-second on quiet systems) by 10 minutes. Splitting jobs across separate connections (one connection per job) or moving the cascade to a paginated background job would decouple latency. The architectural decision to share a connection is a resource-economy trade-off (one TCP handshake vs five per cycle) but limits parallelism." — evidence: HousekeepingJobManager.java:32 (single getConnection) + lines 33-35 (sequential for-loop). — severity: LOW (only relevant under heavy backlogs)
  - "**No backlog metric — invisible bloat**. No `housekeeping_backlog{table=alert}` Prometheus gauge, no `housekeeping_eligible_rows_total` counter. An operator answering 'is housekeeping keeping up with the soft-delete rate?' has no observable surface. A backlog gauge (count of rows eligible-but-not-yet-deleted) at the start of each cycle would expose growth before it becomes a 14-minute-ShedLock problem." — evidence: HousekeepingJobManager.java (no Micrometer instrumentation) + AlertHousekeepingJob.java + SearchFacetsHousekeepingJob.java + DataEntityHousekeepingJob.java (none emit counters or gauges). — severity: LOW
  - "**`lockAtMostFor = \"14m\"` against `fixedRate = 15m` is the smallest safe coordination window** — 60-second slack between maximum lock duration and next scheduled invocation. Under contention or backlog, the lock can release before commit and allow a second instance to acquire on the next cycle. A safer setting would be `lockAtMostFor` ≥ `2 × fixedRate` (e.g. 30m) so the lock outlives any plausible cycle duration. The 14m setting is performance-aware (release sooner so same-instance can re-acquire) but operationally fragile under sustained heavy load." — evidence: HousekeepingJobManager.java:25-26 (the fixedRate / lockAtMostFor ratio). — severity: LOW (theoretical until backlog grows)
  - "**Per-cycle ShedLock DB round-trip** — every 15 minutes the cycle issues an INSERT-or-UPDATE against the `shedlock` table (the JdbcTemplateLockProvider mechanic). This is cheap per cycle but is one of the platform's quietly-recurring DB writes — observable in PG's `pg_stat_activity` as a low-frequency UPSERT on `shedlock`. Not a perf gap on its own; called out as 'invisible recurring DB write' so operators sizing PG IOPS understand the baseline." — evidence: SchedulingConfiguration.java:18-25 (the JdbcTemplateLockProvider configuration). — severity: LOW

## sources

- understanding ← HousekeepingJobManager.java:1-48 + housekeeping/job/HousekeepingJob.java:1-7 + housekeeping/job/AlertHousekeepingJob.java + housekeeping/job/SearchFacetsHousekeepingJob.java + housekeeping/job/DataEntityHousekeepingJob.java + housekeeping/job/EmptyPartitionsHousekeepingJob.java + housekeeping/job/ActivityEmptyPartitionsHousekeepingJob.java + housekeeping/job/MessageEmptyPartitionsHousekeepingJob.java + application.yml:165-170 + application-integration-test.yml:7-8
- concepts.entities ← housekeeping/job/ directory listing (5 jobs + 1 interface + 1 abstract base) + HousekeepingJobManager.java:21 + auth/session/PostgreSQLSessionHousekeepingJob.java:22 (the unrelated session-housekeeping job)
- concepts.operations ← HousekeepingJobManager.java:25-39 + SchedulingConfiguration.java:18-25 (ShedLock provider config)
- concepts.invariants ← HousekeepingJobManager.java:18 (no matchIfMissing) + HousekeepingJobManager.java:25-26 (fixedRate / lock window) + HousekeepingJobManager.java:32 (single connection) + HousekeepingJobManager.java:33-35 (sequential iteration) + HousekeepingJobManager.java:41-47 (per-job catch) + WebFetch /configuration-and-deployment/odd-platform 2026-05-19 (the 'three cleanup tasks' verbatim)
- dependencies_semantic.requires-feature ← HousekeepingJobManager.java:23 (List<HousekeepingJob> injection) + ODDPlatformConfiguration.java:13-16 (HousekeepingTTLProperties registration) + SchedulingConfiguration.java:13-14 (@EnableScheduling + @EnableSchedulerLock)
- dependencies_semantic.requires-config ← HousekeepingJobManager.java:18 + application.yml:165-170 + PGConnectionFactory.java:23-32 (datasource consumption)
- dependencies_semantic.requires-runtime ← HousekeepingJobManager.java:25 (@Scheduled) + HousekeepingJobManager.java:26 (@SchedulerLock) + SchedulingConfiguration.java:22-23 (PG-backed lock provider + usingDbTime) + PGConnectionFactory.java:36 (DriverManager.getConnection)
- dependencies_semantic.coupling ← partition/PostgreSQLPartitionCreationJob.java:21,41 (the partition-creation sibling orchestrator) + service/job/DataEntityStatusSwitchJob.java:21-30 (the soft-delete cadence sibling) + auth/session/PostgreSQLSessionHousekeepingJobHandler.java:13 (the unrelated session-housekeeping job) + DataEntityHousekeepingJob.java:142 (the .block() inside transaction)
- tests_coverage_semantic.test_files ← grep of <odd-platform-repo>/odd-platform-api/src/test for `Housekeeping` returning zero matches
- tests_coverage_semantic.gaps ← HousekeepingJobManager.java:18 (the conditional) + HousekeepingJobManager.java:25-26 (the schedule/lock pair) + HousekeepingJobManager.java:41-47 (the isolation catch) + HousekeepingJobManager.java:23 (the list injection order)
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform 2026-05-19 status 200 (verbatim 'three cleanup tasks' + the known-bug acknowledgement + the housekeeping.enabled / housekeeping.ttl.* defaults)
- docs_link_semantic.inferred_docs.[1] ← not fetched this session; cross-reference to neighbour sidecar (HousekeepingTTLProperties) for the alerting cross-feature linkage hypothesis
- docs_link_semantic.doc_drift_findings.[0] ← housekeeping/job/ directory listing (5 components) + HousekeepingJobManager.java:23 (the mechanical List injection) + WebFetch /configuration-and-deployment/odd-platform 2026-05-19 (the 'three cleanup tasks' verbatim)
- docs_link_semantic.doc_drift_findings.[1] ← HousekeepingJobManager.java:26 (the 14m / 14m pair) + WebFetch /configuration-and-deployment/odd-platform 2026-05-19 (the 'uses ShedLock for multi-instance coordination' framing — no values stated)
- docs_link_semantic.doc_drift_findings.[2] ← HousekeepingJobManager.java:41-47 (the per-job catch) + WebFetch /configuration-and-deployment/odd-platform 2026-05-19 (no failure-isolation framing)
- docs_link_semantic.doc_drift_findings.[3] ← HousekeepingJobManager.java:18 (no matchIfMissing) + application.yml:166 (shipped true) + WebFetch /configuration-and-deployment/odd-platform 2026-05-19 ('defaults to true' framing)
- implicit_adrs.[0] ← HousekeepingJobManager.java:41-47 (per-job try/catch) + HousekeepingJobManager.java:36-38 (cycle-level try/catch — narrower scope)
- implicit_adrs.[1] ← HousekeepingJobManager.java:32-35 (single connection + for-loop iteration)
- implicit_adrs.[2] ← HousekeepingJobManager.java:25-26 (the 15m / 14m pair)
- implicit_adrs.[3] ← HousekeepingJobManager.java:18 (no matchIfMissing) + application.yml:166 (shipped default)
- implicit_adrs.[4] ← HousekeepingJobManager.java (this orchestrator) + partition/PostgreSQLPartitionCreationJob.java:21 (the parallel orchestrator) + SchedulingConfiguration.java:13-14 (the shared scheduling enabling)
- bugs_limitations_corner_cases.[0] ← HousekeepingJobManager.java:23 + housekeeping/job/ directory + WebFetch /configuration-and-deployment/odd-platform 2026-05-19
- bugs_limitations_corner_cases.[1] ← AlertHousekeepingJob.java:28-34 (the jOOQ predicate chain) + WebFetch /configuration-and-deployment/odd-platform 2026-05-19 (the docs acknowledgement)
- bugs_limitations_corner_cases.[2] ← DataEntityHousekeepingJob.java:71 (transaction wrap) + DataEntityHousekeepingJob.java:142 (.block() call) + HousekeepingJobManager.java:45 (outer catch)
- bugs_limitations_corner_cases.[3] ← HousekeepingJobManager.java:25-26 (the fixedRate / lockAtMostFor pair)
- bugs_limitations_corner_cases.[4] ← HousekeepingJobManager.java:30 (debug) + HousekeepingJobManager.java:45 (error) + AlertHousekeepingJob.java:45 + SearchFacetsHousekeepingJob.java:29 + DataEntityHousekeepingJob.java:128 (all debug-level)
- bugs_limitations_corner_cases.[5] ← HousekeepingJobManager.java:25-39 (no dry-run path) + AlertHousekeepingJob.java:40-43 + DataEntityHousekeepingJob.java:99-126
- bugs_limitations_corner_cases.[6] ← HousekeepingJobManager.java:18 (no matchIfMissing)
- bugs_limitations_corner_cases.[7] ← HousekeepingJobManager.java:23 (List injection) + all five HousekeepingJob beans (no @Order)
- bugs_limitations_corner_cases.[8] ← HousekeepingJobManager.java:32 + PGConnectionFactory.java:36
- security.auth_mode_relevance ← HousekeepingJobManager.java:18 (gated on housekeeping.enabled, not auth.type) + HousekeepingJobManager.java:25 (@Scheduled, not @PostMapping)
- security.ingestion_filter_relevance ← HousekeepingJobManager.java:25 (@Scheduled — non-HTTP path)
- security.owner_scoping ← HousekeepingJobManager.java (no owner / tenant field) + AlertHousekeepingJob.java:28-34 (no OWNERSHIP join) + DataEntityHousekeepingJob.java:268-273 (the cascade)
- security.data_exposure ← HousekeepingJobManager.java:30,45 (the log statements) + PGConnectionFactory.java:23-36 (the credential consumption)
- security.known_security_gaps.[0] ← HousekeepingJobManager.java (no audit annotation) + HousekeepingTTLProperties.java (no audit annotation)
- security.known_security_gaps.[1] ← HousekeepingJobManager.java:25-39 (no kill-switch, no rate-limit, no preview)
- security.known_security_gaps.[2] ← HousekeepingJobManager.java:36-38 + HousekeepingJobManager.java:44-46 (both log.error only)
- performance.hot_paths ← HousekeepingJobManager.java:25 (fixedRate=15min)
- performance.throughput_characteristics ← HousekeepingJobManager.java:32-35 (single connection + sequential iteration) + SearchFacetsHousekeepingJob.java:21-30 (no explicit transaction wrap)
- performance.resource_allocation ← HousekeepingJobManager.java:32 (single getConnection) + PGConnectionFactory.java:36 (DriverManager bypass of HikariCP)
- performance.scaling_characteristics ← HousekeepingJobManager.java:25-26 (fixedRate vs lockAtMostFor)
- performance.known_performance_gaps.[0] ← HousekeepingJobManager.java:32-35 (single connection sequential fan-out)
- performance.known_performance_gaps.[1] ← AlertHousekeepingJob.java + SearchFacetsHousekeepingJob.java + DataEntityHousekeepingJob.java (no Micrometer)
- performance.known_performance_gaps.[2] ← HousekeepingJobManager.java:25-26 (the 14m / 15m ratio)
- performance.known_performance_gaps.[3] ← SchedulingConfiguration.java:18-25 (the JdbcTemplateLockProvider configuration)

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (test absence verified via grep — zero matches against `Housekeeping` in `<odd-platform-repo>/odd-platform-api/src/test`)
- docs_link_semantic: HIGH (live WebFetch /configuration-and-deployment/odd-platform 2026-05-19, status 200, quoted verbatim; the alerting cross-link is hypothesised at LOW confidence)
- implicit_adrs: HIGH (five decisions each with explicit code evidence and an intent anchor — per-job catch granularity, single connection scope, ShedLock window pairing, no-matchIfMissing strictness, two-orchestrator package split)
- bugs_limitations_corner_cases: HIGH (every finding cited at file:line; the 3-vs-5 framing, jOOQ-precedence bug, and `.block()`-inside-transaction observations cross-confirmed against the neighbour sidecar and the live docs)
- security: HIGH (auth-mode irrelevance + owner-scoping bypass anchored on code; the audit-log gap and rate-limit gap are absence-shaped but well-evidenced via grep + file scan)
- performance: HIGH (all observations anchored on the single-connection + lock-window + transaction-wrap evidence chain)

## Maintainer notes

(none — net-new sidecar)

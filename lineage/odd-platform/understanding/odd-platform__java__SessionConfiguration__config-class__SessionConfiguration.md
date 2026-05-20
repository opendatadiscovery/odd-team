---
node_id: "odd-platform java SessionConfiguration config-class:SessionConfiguration"
node_kind: config-class
axis: configurations
extracted_at_commit: 9ac6436e9bd36ba132d765076c6bbd5916fde729
enriched_at_commit: 9ac6436e9bd36ba132d765076c6bbd5916fde729
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-batch-X-01
---

# SessionConfiguration — semantic understanding

## understanding

`SessionConfiguration` is the Spring `@Configuration` that wires ODD Platform's HTTP-session backing store. Reading `session.provider` from the environment, it activates exactly ONE of three Spring-Session implementations: `IN_MEMORY` (a `ConcurrentHashMap`-backed `ReactiveMapSessionRepository`, the shipped default), `INTERNAL_POSTGRESQL` (a custom `JooqSessionRepository` writing to `SPRING_SESSION` + `SPRING_SESSION_ATTRIBUTES` tables plus an hourly `PostgreSQLSessionHousekeepingJobHandler` cleaner), and `REDIS` (Spring Session's `@EnableRedisWebSession` against an external Redis 6+ instance). The wiring is the SINGLE binding point for ODD's reactive web-session lifecycle: every `exchange.getSession()` read across the platform — UI auth (`LOGIN_FORM` / `OAUTH2` / `LDAP` flows) AND the collector-identity bridge on `POST /ingestion/datasources` — funnels through whichever `ReactiveSessionRepository<MapSession>` this class instantiated at boot.

## concepts

- entities: [Spring `ReactiveSessionRepository<MapSession>`, `ReactiveMapSessionRepository`, `JooqSessionRepository`, `PostgreSQLSessionHousekeepingJob`, `PostgreSQLSessionHousekeepingJobHandler`, `SPRING_SESSION` table, `SPRING_SESSION_ATTRIBUTES` table, `@EnableSpringWebSession`, `@EnableRedisWebSession`, the `session.provider` config key]
- operations: [select session provider at boot via `session.provider`, instantiate the matching `ReactiveSessionRepository` bean, register the housekeeping job handler (`INTERNAL_POSTGRESQL` only), delegate to Spring Session Redis auto-configuration (`REDIS` only)]
- invariants:
  - "exactly ONE provider activates per boot — the conditional gating is mutually exclusive (`IN_MEMORY` | `INTERNAL_POSTGRESQL` | `REDIS`); no compile-time enum, runtime string match only"
  - "`IN_MEMORY` is the SHIPPED DEFAULT (`application.yml:30` `provider: IN_MEMORY`); operators upgrading from single-instance to multi-instance must EXPLICITLY change the provider — the platform does not fail-fast or warn"
  - "the outer `SpringWebSessionCondition` gates BOTH `IN_MEMORY` and `INTERNAL_POSTGRESQL` by environment property read (`session.provider`); the inner `@Bean`s further narrow by `@ConditionalOnProperty` — a missing or misspelled `session.provider` value matches NEITHER inner branch, so NO `ReactiveSessionRepository<MapSession>` bean is registered and Spring's auto-configuration may fail to satisfy session-aware filters (silent boot failure surface)"
  - "the `REDIS` branch is a `@Configuration` with NO bean definitions — it only stamps `@EnableRedisWebSession` so Spring Session Redis auto-config takes over via `spring.data.redis.*`"
  - "the `INTERNAL_POSTGRESQL` housekeeping cadence is hardcoded to `@Scheduled(fixedRate = 1, timeUnit = HOURS)` at `PostgreSQLSessionHousekeepingJobHandler.java:13` — no config knob; expired-session rows live up to one hour past TTL"
- audiences: [platform-operator (selects + tunes `session.provider`), odd-collector-runtime (transitively — its `POST /ingestion/datasources` round-trip relies on whichever provider this class wired), odd-platform-ui-end-user (transitively — UI session continuity depends on this wiring), spring-container]

## dependencies_semantic

- requires-feature:
  - "`/ingestion/datasources` collector-identity bridge (F-008, P-10) — `IngestionDataSourceFilter` writes `SessionConstants.COLLECTOR_ID_SESSION_KEY` into the WebSession backed by the provider this class wires; `IngestionController.createDataSource` reads it back. Cluster-deployment correctness of that bridge is determined by the value picked here."
  - "UI authentication flows (P-09) — every authenticated UI request reads its session from the repository this class registered (`LOGIN_FORM` form-login, `OAUTH2` redirect callbacks, `LDAP` bind result all materialise into WebSession state)."
- requires-config:
  - "`session.provider` (string; values `IN_MEMORY` | `INTERNAL_POSTGRESQL` | `REDIS`; default `IN_MEMORY` per `application.yml:30`)"
  - "`spring.session.timeout` (duration; default `-1` per `application.yml:2-3` — meaning **sessions never expire**); applies to all three providers"
  - "`spring.datasource.*` — implicitly required when `session.provider=INTERNAL_POSTGRESQL` (the `JooqSessionRepository` reuses the platform's primary datasource via `JooqReactiveOperations`)"
  - "`spring.data.redis.*` — required when `session.provider=REDIS` (Spring Boot 3.x prefix; the legacy `spring.redis.*` Spring-Boot-2.x prefix is silently ignored per the live doc)"
- requires-runtime:
  - "Spring Session core (`spring-session-core`) on the classpath — declared in `gradle/libs.versions.toml:57`"
  - "Spring Session Data Redis (`spring-data-session-redis`) — declared in `gradle/libs.versions.toml:61`; classpath presence is unconditional but the bean wiring is gated by `session.provider=REDIS`"
  - "jOOQ + `JooqReactiveOperations` + `JooqQueryHelper` — needed by `JooqSessionRepository` constructor when `INTERNAL_POSTGRESQL` is selected"
  - "the V0_0_41 migration (`SPRING_SESSION` + `SPRING_SESSION_ATTRIBUTES` tables) — applied to ALL deployments regardless of provider; the tables exist even on `IN_MEMORY` / `REDIS` deployments but are read/written only under `INTERNAL_POSTGRESQL`"
- coupling-with-other-config-classes:
  - "`SecurityConstants.WHITELIST_PATHS` — the `/ingestion/**` path is permitted without SecurityContext, so the WebSession state this class wires is the SOLE identity carrier for collector requests (per ADR-CANDIDATE-141)"

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - "no `SessionConfigurationTest` / `JooqSessionRepositoryTest` / `PostgreSQLSessionHousekeepingJobTest` exists — confirmed by `Glob **/SessionConfiguration*Test*.java`, `**/JooqSessionRepository*Test*.java`, `**/PostgreSQLSessionHousekeeping*Test*.java` (all returned no matches)"
  - "no integration test exercises the conditional bean wiring (boot with `session.provider=IN_MEMORY` vs `INTERNAL_POSTGRESQL` vs `REDIS` vs invalid value)"
  - "no test asserts the `JooqSessionRepository.save`/`findById`/`deleteById` against the `SPRING_SESSION` schema"
  - "no test asserts the housekeeping job actually deletes rows where `EXPIRY_TIME < now()`"
  - "no test asserts that an invalid / unrecognised `session.provider` value boots cleanly (or fails fast) — the `SpringWebSessionCondition` simply returns `false` for any unrecognised string, suppressing the IN_MEMORY + INTERNAL_POSTGRESQL beans without an error"
- test_files: []
- gaps: |
    Three behavioural gaps the current suite would miss:

    (1) **Boot-mode regression**: a refactor that breaks the `SpringWebSessionCondition` string comparison (e.g., typo, case-sensitivity, accidental enum migration) would silently disable `IN_MEMORY` + `INTERNAL_POSTGRESQL` wiring with NO test failure.

    (2) **Housekeeping correctness**: the `PostgreSQLSessionHousekeepingJob.runHousekeeping` SQL (`expiry_time < now()` predicate on `SPRING_SESSION`, two-step delete from `SPRING_SESSION_ATTRIBUTES` first then `SPRING_SESSION`) has no test — a future regression that, e.g., used `>` instead of `<`, or reversed delete order causing FK violations, would only surface in production logs as growing tables.

    (3) **Multi-provider integration**: no test boots the platform in REDIS mode and verifies that the same session cookie issued by one instance is readable by another — exactly the cluster-correctness behaviour that REFACTOR-419 cares about. A migration that broke Spring Session Redis auto-config wiring (e.g., a transitive dependency exclusion) would not be caught here.

## docs_link_semantic

- declared_docs: []  # no @docs annotation in the source file
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform"
    anchor: "#select-session-provider"
    rationale: "live doc explicitly documents `session.provider` (`SESSION_PROVIDER` env var) with all three values, the IN_MEMORY default, the cluster caveat, the JOOQ-implementation note, the hourly housekeeping cadence, and `spring.session.timeout: -1` — direct semantic mapping to this class"
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Section "Select session provider" — verbatim from WebFetch 2026-05-20:
      > "ODD Platform stores HTTP session state in one of three places: the platform JVM (in-memory), the platform's PostgreSQL database, or an external Redis data store. The provider is selected with `session.provider` (`SESSION_PROVIDER` env var) and accepts one of three values"
      > "IN_MEMORY (default): Sessions live in a `ConcurrentHashMap` inside the JVM."
      > "INTERNAL_POSTGRESQL: Sessions persist in the platform's own PostgreSQL database using custom JOOQ-based reactive repository. Key characteristics include 'Sessions survive platform restarts' and 'Multi-instance support.' However, 'Expired-session cleanup runs hourly and is not configurable,' meaning expired rows remain for 'up to one hour past their TTL' before deletion."
      > "REDIS: Sessions persist to external Redis via Spring Session's `@EnableRedisWebSession`. The platform requires 'Redis 6+ instance' with connection settings under `spring.data.redis.*` namespace (Spring Boot 3.x). A critical warning states: '`spring.redis.*` (the Spring Boot 2.x prefix) is silently ignored.'"
      > "`spring.session.timeout: -1` means sessions never expire."
- doc_drift_findings:
  - "**Doc coverage of `IN_MEMORY` mentions 'No multi-instance support' but does NOT name the specific failure mode for the `/ingestion/datasources` collector-identity bridge** — operators reading the session-provider section learn that UI sessions don't replicate, but the live doc does NOT cross-link to the `IngestionDataSourceFilter` → `IngestionController.createDataSource` WebSession bridge (`SessionConstants.COLLECTOR_ID_SESSION_KEY`). A clustered deployment with `IN_MEMORY` + non-sticky load-balancer would see HTTP 500 with `IllegalStateException(\"Collector id is null\")` on the second `/ingestion/datasources` hop (REFACTOR-419) — not surfaced in the live doc."
  - "**No cookie-security-attribute documentation** — the live doc covers session storage and timeout but does NOT document the session-cookie attributes (HttpOnly / Secure / SameSite / Path / Domain) that Spring's default `CookieWebSessionIdResolver` ships. The code likewise carries no override — `grep CookieWebSession|SameSite|HttpOnly|Secure.*cookie|sessionIdResolver|WebSessionIdResolver` against the repo returned ZERO matches. Operators relying on framework defaults have no guidance on whether `Secure` is set (it is NOT, by Spring default; the operator must front the platform with TLS + a reverse proxy that adds the `Secure` flag, OR configure a `WebSessionIdResolver` bean). This is a separately-tracked DOC gap."

## implicit_adrs

- "the platform supports THREE session-store backends behind one switch (`session.provider`), with no per-backend code branches in calling sites — every `exchange.getSession()` consumer is provider-agnostic" — evidence: SessionConfiguration.java:22-65 + JooqSessionRepository.java:33 (`implements ReactiveSessionRepository<MapSession>` — same interface as `ReactiveMapSessionRepository`) — intent_anchor: "the comment in `application.yml:29` (`# INTERNAL_POSTGRESQL, REDIS, IN_MEMORY`) enumerates the choices; the `@ConditionalOnProperty` discriminator at line 29/37/46/62 codifies the switch; the implementation of `ReactiveSessionRepository<MapSession>` for the JOOQ branch maintains the interface symmetry that lets `@EnableRedisWebSession` be a drop-in replacement without controller-side changes" — confidence: HIGH

- "the platform ships its OWN `JooqSessionRepository` rather than using Spring Session JDBC's `JdbcIndexedSessionRepository` — confirmed-deliberate departure from the standard Spring Session JDBC keys (`spring.session.jdbc.*`)" — evidence: JooqSessionRepository.java:33-194 (full custom implementation against `SPRING_SESSION` + `SPRING_SESSION_ATTRIBUTES` tables via jOOQ DSL) + V0_0_41__add_session_tables.sql:1-27 (own schema migration) — intent_anchor: "the platform is reactive (WebFlux + R2DBC); Spring Session JDBC's `JdbcIndexedSessionRepository` is BLOCKING (uses `JdbcOperations`). A reactive replacement is the architectural reason this custom class exists. The platform implements `ReactiveSessionRepository<MapSession>` (lines 33) and uses `JooqReactiveOperations.mono(...)` + `JooqReactiveOperations.flux(...)` (lines 67, 73, 88, 115) which return `Mono`/`Flux` — the standard JDBC repository can NOT compose with the reactive pipeline." — confidence: HIGH

- "the `INTERNAL_POSTGRESQL` housekeeping job runs on a HARDCODED `@Scheduled(fixedRate = 1, timeUnit = HOURS)` cadence with no operator override knob — accepted post-expiry stragglers up to one hour past TTL" — evidence: PostgreSQLSessionHousekeepingJobHandler.java:13 (`@Scheduled(fixedRate = 1, timeUnit = TimeUnit.HOURS)`) — intent_anchor: the class has NO `@Value`-bound interval, no `${...}` placeholder, no fall-through annotation; the cadence is in the source. The doc states this explicitly: "Expired-session cleanup runs hourly and is not configurable" (live doc, verified 2026-05-20). The pair-with-doc consistency (code-fixed cadence + doc-explicit notice) is the structural commitment to "session cleanup is best-effort hourly, not real-time". — confidence: HIGH

- "`session.provider: IN_MEMORY` is the SHIPPED DEFAULT, accepting cluster-fragility in exchange for zero external-dependency boot — operators MUST opt-in to cluster-safe providers" — evidence: application.yml:28-30 (`session:\n  # INTERNAL_POSTGRESQL, REDIS, IN_MEMORY\n  provider: IN_MEMORY`) + SessionConfiguration.java:46 (`@ConditionalOnProperty(... havingValue = "IN_MEMORY")` for the matching bean) — intent_anchor: the comment at application.yml:29 LISTS the three values in deliberate order with `IN_MEMORY` last but `provider: IN_MEMORY` at line 30 — the OOTB experience is zero-external-deps. This is the same posture as the rest of the application.yml defaults (auth.type=DISABLED, attachment.storage=LOCAL, metrics.storage=INTERNAL_POSTGRES) — single-instance-dev-friendly, production-requires-explicit-config. — confidence: HIGH

## bugs_limitations_corner_cases

- "invalid / misspelled `session.provider` value boots silently with NO `ReactiveSessionRepository<MapSession>` bean registered — the `SpringWebSessionCondition.matches` returns `false` for anything other than the literal strings `INTERNAL_POSTGRESQL` / `IN_MEMORY` (line 56), AND the REDIS branch's `@ConditionalOnProperty` returns `false` unless the value is exactly `REDIS` — no compile-time enum, no fail-fast at boot, no WARN log" — evidence: SessionConfiguration.java:51-57 (the literal `.equals(...)` checks) + 62 (Redis `@ConditionalOnProperty`) — severity: MEDIUM

- "cluster-deployment fragility on `IN_MEMORY` default — the `/ingestion/datasources` flow's collector-identity bridge (`SessionConstants.COLLECTOR_ID_SESSION_KEY` written by `IngestionDataSourceFilter`, read by `IngestionController.createDataSource`) DOES NOT REPLICATE across instances. The default `IN_MEMORY` provider is per-process; a load balancer without sticky sessions routes the second request to a different instance which sees a NULL session attribute and throws `IllegalStateException(\"Collector id is null\")` propagating as HTTP 500. Cross-reference: REFACTOR-419 (cluster-fragility, HIGH severity), ADR-CANDIDATE-141 (the WebSession-attribute identity choice that this provider backs), F-008 (datasource registration flow), F-020 (collector management flow)" — evidence: application.yml:28-30 (default) + SessionConfiguration.java:46-49 (IN_MEMORY wiring) + IngestionDataSourceFilter.java:36-38 (the session-write) + IngestionController.java:50-58 (the session-read) + 54 (`IllegalStateException`) — severity: HIGH

- "`spring.session.timeout: -1` (shipped default at application.yml:2-3) means sessions NEVER expire — on `IN_MEMORY` the heap grows monotonically until restart; on `INTERNAL_POSTGRESQL` the `SPRING_SESSION` table grows monotonically (the housekeeping job uses the per-session `EXPIRY_TIME` column, which under `-1` is set to `lastAccessedTime + Integer.MAX_VALUE`-equivalent — so the `expiry_time < now()` predicate never matches and the housekeeping job is a NO-OP for unexpiring sessions); on `REDIS` the keys never expire either" — evidence: application.yml:2-3 (`spring.session.timeout: -1`) + JooqSessionRepository.java:138-148 (`recordFromSession` sets `expiry_time = lastAccessedTime.plusSeconds(maxInactiveInterval.toSeconds()).getEpochSecond()` — when `maxInactiveInterval` is unset or negative the expiry is effectively never reached) + PostgreSQLSessionHousekeepingJob.java:30 (`expiry_time < now()` predicate) — severity: HIGH (operator-invisible monotonic growth on production deployments)

- "no cookie-security attributes are configured anywhere in the codebase — no `CookieWebSessionIdResolver` bean, no `SameSite` directive, no `HttpOnly` override, no `Secure` flag setter. The session cookie inherits Spring's framework defaults (HttpOnly=true, Secure=NOT set, SameSite=lax). On a plaintext-HTTP deployment the cookie is transmitted in clear; on a TLS-fronted deployment the operator must rely on the reverse proxy / Ingress to set `Secure` externally — there is no in-platform guarantee" — evidence: grep `CookieWebSession|SameSite|HttpOnly|Secure.*cookie|sessionIdResolver|WebSessionIdResolver` over the entire odd-platform repo returned ZERO matches; SessionConfiguration.java:22-65 (no override beans declared) — severity: MEDIUM (security-relevant absence; mitigated by deployment topology but not by the platform)

- "no `@PreDestroy` / shutdown hook drains the `IN_MEMORY` session map — the `ConcurrentHashMap` is GC'd with the JVM, so on a SIGTERM/restart all authenticated UI sessions are lost and all `/ingestion/datasources` collector-id session attributes vanish silently. This is consistent with the live-doc warning 'Sessions are lost on every platform restart' but the platform offers no graceful drain (e.g., persist-to-disk-on-shutdown, broadcast-invalidate-to-clients)" — evidence: SessionConfiguration.java:46-49 (the `ConcurrentHashMap<>()` instantiation has no lifecycle integration) — severity: LOW (intentional limitation; documented; surfaces as login-prompt on restart, not as data loss)

- "the `REDIS` configuration branch has no health-check integration with Spring Boot Actuator. The `management.health.redis.enabled: false` setting in application.yml:244-245 is the DEFAULT — operators switching to `session.provider=REDIS` are not nudged to enable the health check. A Redis outage on a session-Redis-only deployment causes 5xx on every authenticated request but the `/actuator/health` endpoint does not reflect it" — evidence: application.yml:244-245 (`redis: enabled: false`) + SessionConfiguration.java:61-65 (REDIS branch is just `@EnableRedisWebSession` with no health-check wiring) — severity: MEDIUM (operational-observability gap when REDIS is selected)

- "the `SpringWebSessionCondition` reads `session.provider` from the environment ONCE at boot via `context.getEnvironment().getProperty(...)` — Spring Boot's `@RefreshScope` or Spring Cloud Config dynamic refresh would NOT switch session backends at runtime. A `session.provider` change requires a process restart" — evidence: SessionConfiguration.java:51-57 (the `Condition.matches` is invoked during context build, not at runtime per-request) — severity: LOW (matches Spring's normal lifecycle expectations; documented for operators only implicitly)

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP | INTERNAL_ONLY`. This class does NOT itself read `auth.type`, but the WebSession it wires is the carrier for whichever UI auth flow is active. `DISABLED` typically does not populate a session (no auth pipeline runs), but a session may still be created lazily on any first-request `exchange.getSession()` call. The S2S filter and the `IngestionDataEntitiesFilter` do NOT use the WebSession (they validate per-request `X-API-Key`), so the session provider is auth-mode-orthogonal for those paths.
- **ingestion_filter_relevance**: `INDIRECT — gated through the SessionConstants.COLLECTOR_ID_SESSION_KEY bridge`. The `/ingestion/entities` filter (`IngestionDataEntitiesFilter`, gated by `auth.ingestion.filter.enabled`) does NOT touch the WebSession. The `/ingestion/datasources` filter (`IngestionDataSourceFilter`, UNCONDITIONAL) DOES write to the WebSession this class wires — and the controller (`IngestionController.createDataSource`) reads it back. So this config IS load-bearing for the datasource-registration flow's correctness, especially in clustered deployments.
- **authorization_assertions**: [] — N/A. This is a `@Configuration` class with no per-request authorization logic.
- **owner_scoping**: `N/A — code is not data-scoped`. Session storage is identity-bearing infrastructure, not data-access.
- **data_exposure**:
  - "WebSession attribute map → carries collector-id (a bigserial Long) for the `/ingestion/datasources` bridge; carries Spring Security `Authentication` payload (principal name, granted authorities) for UI flows. Serialised to the underlying store: `ConcurrentHashMap` (in-process, never persisted); PostgreSQL `SPRING_SESSION_ATTRIBUTES.attribute_bytes` (BYTEA, Java-serialized via `SerializationUtils.serialize(...)` at `JooqSessionRepository.java:156`); Redis (Spring Session Redis default serialiser — typically JDK serialisation)"
  - "`INTERNAL_POSTGRESQL` mode → reuses the platform `spring.datasource.*` connection, so a database compromise also exposes every authenticated session's attribute payload"
  - "session cookies → transmitted on every authenticated request; cookie attributes are framework-default (HttpOnly=true, Secure=NOT set by platform, SameSite=lax by Spring default) — see bugs_limitations_corner_cases entry on cookie security"
- **known_security_gaps**:
  - "cookie attributes inherit Spring framework defaults — no in-platform `WebSessionIdResolver` override sets `Secure` (cookie can be transmitted over plaintext HTTP if TLS is not enforced upstream), and no override sets `SameSite=Strict` (lax permits cross-site GET / top-level navigation cookie leakage). The platform offloads cookie security to the deployment topology — no doc warns operators." — evidence: SessionConfiguration.java:22-65 (no override) + grep across entire repo for `CookieWebSession|SameSite|HttpOnly|Secure.*cookie|sessionIdResolver|WebSessionIdResolver` returns 0 matches — severity: MEDIUM
  - "session-attribute payload is Java-serialised on the `INTERNAL_POSTGRESQL` path (`SerializationUtils.serialize(...)`/`deserialize(...)` at `JooqSessionRepository.java:156, 188`) — a database compromise yields deserialisation gadgets on read; the Spring `SerializationUtils` is deprecated in newer Spring versions for exactly this reason" — evidence: `JooqSessionRepository.java:156` (`SerializationUtils.serialize(session.getAttribute(attrName))`) + line 188 (`SerializationUtils.deserialize(record.get(SPRING_SESSION_ATTRIBUTES.ATTRIBUTE_BYTES))`) — severity: MEDIUM (gadget-availability dependent on classpath; deserialisation of operator-controlled bytes is a known footgun)
  - "session never expires under shipped defaults (`spring.session.timeout: -1`) — a stolen cookie remains valid until manual platform-side invalidation (log-out triggered, cache eviction, or — for IN_MEMORY only — restart). The live doc warns operators (verified 2026-05-20 quote: `\"spring.session.timeout: -1\" means sessions never expire.`) but the SHIPPED DEFAULT is unsafe for any internet-facing deployment" — evidence: application.yml:2-3 + JooqSessionRepository.java:138-148 (compounded with the housekeeping NO-OP) — severity: HIGH (default is unsafe for production)

## performance

- **hot_paths**:
  - "every `exchange.getSession()` across the platform — Spring resolves the session via `WebSessionStore` → `ReactiveSessionRepository.findById(id)`. For `IN_MEMORY` this is `ConcurrentHashMap.get(id)` (in-process, microsecond order). For `INTERNAL_POSTGRESQL` this is a `JooqSessionRepository.findById` SELECT with LEFT JOIN against `SPRING_SESSION` + `SPRING_SESSION_ATTRIBUTES` (`JooqSessionRepository.java:78-102`) — a per-session-touch DB round-trip on every authenticated request. For `REDIS` this is a per-request Redis GET via Spring Session Redis." — evidence: SessionConfiguration.java:30-49 (bean wiring) + JooqSessionRepository.java:78-102 (findById query) — severity-implication: throughput on `INTERNAL_POSTGRESQL` is bounded by R2DBC connection-pool size × session-fetch latency
  - "save path on `INTERNAL_POSTGRESQL` writes TWO statements per session update: an UPSERT into `SPRING_SESSION` plus a bulk UPSERT into `SPRING_SESSION_ATTRIBUTES`, both inside a `@ReactiveTransactional` boundary (`JooqSessionRepository.java:43-76`). A request that mutates a session attribute (e.g., the `COLLECTOR_ID_SESSION_KEY` write) costs 2 round-trips + a transaction commit; the IN_MEMORY equivalent costs a single `ConcurrentHashMap.put`." — evidence: JooqSessionRepository.java:43-76 — severity-implication: ingestion throughput on `INTERNAL_POSTGRESQL` is lower than on `IN_MEMORY` for the per-collector first-touch
- **throughput_characteristics**:
  - "`IN_MEMORY`: per-request session read/write is in-process, no I/O, no serialisation — highest throughput, lowest latency"
  - "`INTERNAL_POSTGRESQL`: per-request session read = 1 SQL SELECT (joined); per-request session write (when attributes change) = 2 SQL statements inside a transaction; reuses platform `spring.datasource.*` connection pool (contention with primary application queries)"
  - "`REDIS`: per-request session read = 1 Redis GET (sub-millisecond on local Redis, network-bound on remote); per-request session write = 1+ Redis MULTI/EXEC operations"
- **resource_allocation**:
  - "`IN_MEMORY`: session map is a `ConcurrentHashMap` on the JVM heap (`SessionConfiguration.java:48`); under `spring.session.timeout: -1` the map grows monotonically; under finite timeout the framework periodically removes expired entries (Spring Session's `ReactiveMapSessionRepository` lazy-evicts on access)"
  - "`INTERNAL_POSTGRESQL`: rows accumulate in `SPRING_SESSION` + `SPRING_SESSION_ATTRIBUTES`; the hourly housekeeping job (`PostgreSQLSessionHousekeepingJob.java:25-38`) deletes where `expiry_time < now()` — under `-1` timeout this job is a no-op; under finite timeout the table holds high-water-mark of authenticated users + up to one hour of post-expiry stragglers per the live doc"
  - "`REDIS`: key-space sized by Spring Session Redis's `RedisIndexedSessionRepository` convention (`spring:session:sessions:<id>`); operator-side responsibility (Redis memory tuning, `maxmemory-policy`, etc.)"
  - "no in-class caching beyond the underlying store; no LRU eviction; no soft-reference handling"
- **scaling_characteristics**:
  - "`IN_MEMORY` is STATEFUL per process and DOES NOT SUPPORT HORIZONTAL SCALING — multi-instance deployments behind a non-sticky load balancer route subsequent requests to instances that have NO session entry, breaking UI auth continuity AND the `/ingestion/datasources` collector-id bridge"
  - "`INTERNAL_POSTGRESQL` and `REDIS` are STATELESS at the JVM layer — instances can scale horizontally; both back ends are themselves single-point-of-truth (PostgreSQL primary or Redis primary) and inherit those scaling characteristics"
  - "the housekeeping `@Scheduled` annotation has NO `@SchedulerLock` / leader-election guard — on a multi-instance `INTERNAL_POSTGRESQL` deployment, EVERY instance runs the housekeeping job hourly (so the delete predicate fires N times per hour instead of once). The deletes are idempotent (the second delete sees no rows matching `expiry_time < now()` that the first didn't already delete in this same minute), so the correctness is OK — but the DB load is N× the intended rate, and the lack of leader-election is inconsistent with other ODD `@Scheduled` jobs that DO use `@SchedulerLock` (e.g., DataCollaborationConfiguration receive-event/sender jobs use the `datacollaboration.*advisory-lock-id` pattern; the alerting subsystem uses `notifications.wal.advisory-lock-id`). The session housekeeping is the SOLE `@Scheduled` job without leader-election visible in the codebase." — evidence: PostgreSQLSessionHousekeepingJobHandler.java:13 (`@Scheduled(fixedRate = 1, timeUnit = TimeUnit.HOURS)` — no `@SchedulerLock` annotation) + application.yml:177 (notifications advisory-lock pattern) + application.yml:198 (partition advisory-lock) + application.yml:201-202 (data-collaboration advisory-locks) — severity-implication: MEDIUM — operational inconsistency, not a correctness bug
- **known_performance_gaps**:
  - "no per-instance leader-election on the hourly housekeeping job — N instances → N× DB load per hour; inconsistent with the rest of the platform's `@Scheduled` jobs (which use Postgres advisory locks)" — evidence: PostgreSQLSessionHousekeepingJobHandler.java:13 + cross-reference to advisory-lock patterns in application.yml — severity: MEDIUM
  - "`INTERNAL_POSTGRESQL.findById` performs LEFT JOIN against `SPRING_SESSION_ATTRIBUTES` returning one row per attribute (`JooqSessionRepository.java:78-86`); a session with N attributes is N rows materialised then collapsed in Java (`mapJooqRecordToMapSession`, line 159-193). At platform scale (e.g., 1000 active sessions × 5 attributes average) the per-request fetch is 5-row over-the-wire — acceptable today, but no in-class metric / log surfaces it for operators" — evidence: JooqSessionRepository.java:78-102, 159-193 — severity: LOW

## sources

- understanding ← SessionConfiguration.java:1-66 (whole file) + JooqSessionRepository.java:33-194 + PostgreSQLSessionHousekeepingJob.java:1-47 + PostgreSQLSessionHousekeepingJobHandler.java:1-19 + application.yml:1-3, 28-30 + V0_0_41__add_session_tables.sql:1-27
- concepts.entities ← SessionConfiguration.java:16-20 (imports of MapSession / ReactiveMapSessionRepository / ReactiveSessionRepository / @EnableSpringWebSession / @EnableRedisWebSession) + JooqSessionRepository.java:33 (interface implementation) + V0_0_41:1-27 (table names)
- concepts.invariants ← SessionConfiguration.java:29, 37, 46, 51-57, 62 (the conditional gating logic) + application.yml:28-30 (default) + PostgreSQLSessionHousekeepingJobHandler.java:13 (hardcoded cadence)
- dependencies_semantic.requires-config.session.provider ← application.yml:28-30 + SessionConfiguration.java:29-62 + WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform#select-session-provider (2026-05-20 status 200)
- dependencies_semantic.requires-config.spring.session.timeout ← application.yml:2-3 + WebFetch same URL (`spring.session.timeout: -1` means sessions never expire — verbatim quote)
- dependencies_semantic.requires-runtime.spring-session ← gradle/libs.versions.toml:57, 61
- tests_coverage_semantic.uncovered_behaviours ← Glob results 2026-05-20: `**/SessionConfiguration*Test*.java`, `**/JooqSessionRepository*Test*.java`, `**/PostgreSQLSessionHousekeeping*Test*.java` — all returned no matches
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform (anchor `#select-session-provider`) — status 200, 2026-05-20
- docs_link_semantic.doc_drift_findings.[1] ← grep `CookieWebSession|SameSite|HttpOnly|Secure.*cookie|sessionIdResolver|WebSessionIdResolver` against <odd-platform-repo> — 0 matches
- implicit_adrs.[0] ← SessionConfiguration.java:22-65 + JooqSessionRepository.java:33
- implicit_adrs.[1] ← JooqSessionRepository.java:33-194 + V0_0_41__add_session_tables.sql:1-27
- implicit_adrs.[2] ← PostgreSQLSessionHousekeepingJobHandler.java:13
- implicit_adrs.[3] ← application.yml:28-30 + SessionConfiguration.java:46
- bugs_limitations_corner_cases.[0] ← SessionConfiguration.java:51-57, 62
- bugs_limitations_corner_cases.[1] ← application.yml:28-30 + SessionConfiguration.java:46-49 + IngestionDataSourceFilter.java:36-38 + IngestionController.java:50-58, 54 + AbstractIngestionFilter.java:40 (only catches AccessDeniedException) + REFACTOR-419.md + ADR-CANDIDATE-141.md
- bugs_limitations_corner_cases.[2] ← application.yml:2-3 + JooqSessionRepository.java:138-148 + PostgreSQLSessionHousekeepingJob.java:30
- bugs_limitations_corner_cases.[3] ← grep `CookieWebSession|SameSite|HttpOnly|Secure.*cookie|sessionIdResolver|WebSessionIdResolver` — 0 matches
- bugs_limitations_corner_cases.[5] ← application.yml:244-245 (`management.health.redis.enabled: false`) + SessionConfiguration.java:61-65
- bugs_limitations_corner_cases.[6] ← SessionConfiguration.java:51-57
- security.ingestion_filter_relevance ← IngestionDataSourceFilter.java:36-38 + IngestionController.java:50-58 + SessionConstants.java:4
- security.data_exposure ← JooqSessionRepository.java:156, 188 (serialize / deserialize attribute payload)
- security.known_security_gaps.[0] ← SessionConfiguration.java:22-65 + grep 0-matches across repo
- security.known_security_gaps.[1] ← JooqSessionRepository.java:156, 188
- security.known_security_gaps.[2] ← application.yml:2-3 + live-doc quote (WebFetch 2026-05-20)
- performance.hot_paths.[0] ← SessionConfiguration.java:30-49 + JooqSessionRepository.java:78-102
- performance.hot_paths.[1] ← JooqSessionRepository.java:43-76
- performance.scaling_characteristics.[3] ← PostgreSQLSessionHousekeepingJobHandler.java:13 + application.yml:177, 198, 201-202 (advisory-lock pattern elsewhere)
- performance.known_performance_gaps.[0] ← PostgreSQLSessionHousekeepingJobHandler.java:13 + advisory-lock cross-reference
- performance.known_performance_gaps.[1] ← JooqSessionRepository.java:78-102, 159-193

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (negative confirmation by Glob — no test files exist for this subsystem)
- docs_link_semantic: HIGH (live URL WebFetched 2026-05-20, status 200; verbatim excerpts captured)
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH (every entry has file:line + cross-batch corroboration where applicable)
- security: HIGH
- performance: HIGH

## related_features

- F-008 (P-10:Batch-Ingestion-S2S-API) — the `/ingestion/datasources` flow whose collector-identity bridge depends on the provider this class wires
- F-020 (P-08:Collectors-tab Management) — issuing / rotating collector tokens whose downstream registration-time validation depends on the same session bridge

## related_refactoring_scopes

- REFACTOR-419 (HIGH, batch P + strengthen-batch-R) — Cluster-fragility on the COLLECTOR_ID_SESSION_KEY bridge; this sidecar provides the CONFIG-CLASS primary source for the default that drives the fragility (application.yml:30 `provider: IN_MEMORY`). Strengthens the existing 2-sidecar triangulation to 3 (controller + repository + config-class).

## related_implicit_adrs

- ADR-CANDIDATE-141 (HIGH, batch P) — Collector identity via WebSession attribute, not Spring Security Principal. This config class wires the WebSession backing store that ADR-CANDIDATE-141 depends on. Adds the third structural facet to the ADR's "trade-off enumeration" (a) WebSession over SecurityContext, (b) stringly-typed key, (c) in-memory default — facet (c) is rooted HERE.

## related_concepts

- collector-identity-via-websession-attribute-not-principal (invariant; batch P) — this config class is the wiring substrate for the invariant's trade-off (4) "Sessions never expire" + trade-off (2) "Cluster deployments without sticky sessions are NOT supported"

## related_doc_gaps

- DOC-GAP-NNN (proposed; not yet filed) — cookie-security-attribute documentation absent. The live doc at `configuration-and-deployment/odd-platform.md#select-session-provider` does not name the cookie attributes (HttpOnly / Secure / SameSite); the code does not override Spring's defaults. The operator-facing gap is "what cookie attributes ship by default, and how do I configure them?" — neither answered.

## Maintainer notes

(empty — no prior sidecar for this node)

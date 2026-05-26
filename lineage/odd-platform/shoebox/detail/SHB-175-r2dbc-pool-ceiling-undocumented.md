# SHB-175 — R2DBC pool ceiling silently 20-per-replica; ten `spring.r2dbc.pool.*` knobs wired but undocumented

**Category**: merged
**Severity**: MEDIUM

## Hypothesis

Operators running ODD at high request rates hit a silent per-replica concurrency ceiling of ~20 in-flight DB queries because the platform ships TWO R2DBC `ConnectionPool` beans (primary + `customConnectionPool` for Lookup Tables) and applies Spring Boot's framework-default `maxSize=10` to each (the `application.yml` ships ZERO `spring.r2dbc.pool.*` keys). The platform's `R2DBCConfiguration` DOES wire `PropertyMapper.alwaysApplyingWhenNonNull()` for all ten `R2dbcProperties.Pool` parameters (maxSize, minIdle, maxIdleTime, maxLifeTime, maxAcquireTime, maxCreateConnectionTime, validationQuery, validationDepth, initialSize, maxValidationTime), so operators CAN tune them — but no live-doc page surfaces the keys, no monitoring metric exposes pool utilisation, and the only ceiling-saturation symptom is request latency spikes with no in-application visibility.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/config/R2DBCConfiguration.java:41-50,75-84` — TWO byte-identical PropertyMapper blocks applying ten R2dbcProperties.Pool defaults via `.alwaysApplyingWhenNonNull()` — pattern matches `customDataSource` 1:1.
- `odd-platform-api/src/main/resources/application.yml:1-15` — ZERO `spring.r2dbc.pool.*` keys shipped; every parameter at Spring Boot framework default. With `spring-boot:3.x` + `r2dbc-pool:1.0.0.RELEASE` (`gradle/libs.versions.toml:14,73`), `maxSize` defaults to 10 per pool.
- `R2DBCConfiguration.java:54` — `customConnectionPool` is instantiated UNCONDITIONALLY (no `@ConditionalOnProperty` gate) — every deployment runs the second pool whether or not Lookup Tables are used, doubling the pool footprint.
- WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` (verified 2026-05-20 status 200) — page documents `spring.datasource.*` and `spring.custom-datasource.*` (six keys) but publishes ZERO `spring.r2dbc.pool.*` keys.
- `lineage/odd-platform/concepts/detail/invariants/authorization-hot-path-getcurrentuserroles-per-request-no-cache.yaml:44-45` — concept catalog already names the implication: "R2DBC pool size (spring.r2dbc.pool.max-size) is the upper bound; under cost saturates the R2DBC pool".
- `bash grep 'spring.r2dbc.pool' <odd-platform-repo>` returns ZERO matches outside the bytecode-derived PropertyMapper call site — no test asserts the framework-default value, no Spring `@ConfigurationProperties` defaulter overrides it.
- `R2DBCConfiguration.java` provides no Micrometer instrumentation; `/actuator/prometheus` exposes no R2DBC pool gauges (no `r2dbc.pool.acquired`, no `r2dbc.pool.allocated`, no `r2dbc.pool.queued`).

## Notes

- **The 20-per-replica ceiling is invisible until saturation.** Two pools × maxSize=10 = 20 concurrent DB queries per replica before backpressure / R2DBC `Mono.subscribe()` queueing kicks in. A 5-replica deployment hits 100 PG connection slots — at the edge of PG's default `max_connections=100`. Adding collectors + operator tooling + Flyway + ShedLock pushes above. There's no observability surface to detect this; symptoms are latency spikes with no metric.
- **The pool is the bound on the authorization hot path.** Per the concept catalog: every authorized request resolves `getCurrentUserRoles → getByName(role)` → R2DBC query. At high RPS, `getCurrentUserRoles` saturates the pool first because the call is per-request and uncached. The 20-per-replica ceiling is the hard scaling limit.
- **Pool defaults are inherited from the framework, not platform-curated.** A future Spring Boot upgrade that altered the `R2dbcProperties.Pool.maxSize` default (Spring Boot 4? r2dbc-pool 2.0?) would silently change ODD's deployed ceiling with no PR / changelog / migration note. The platform makes no commitment.
- **The unconditional `customConnectionPool` doubles the footprint without operator awareness.** Deployments that never create a Lookup Table still hold ~`initialSize` connections perpetually open against `lookup_tables_schema`. For a small deployment with no Lookup-Tables traffic this is wasted DB-side slots.
- **The cross-cutting drift class is "operator knob wired but undocumented".** Same shape: `spring.task.scheduling.pool.size` (SHB-176), `attachment.remote.connect-timeout-millis` (SHB-174). All three are present in the code via Spring autoconfiguration or PropertyMapper but absent from the operator-facing docs. A scanner pass against `application.yml` + the docs site would surface every "wired but undocumented" config key.
- This thread is `open` — evidence is rich (file:line + WebFetch confirming docs silence + concept catalog cross-reference + framework-default reasoning) but the FEATURE shape ("operator-tunable persistence concurrency ceiling") needs a name. The graduation candidate could be `F-NNN — R2DBC Pool Sizing` or could be folded as a facet into a broader `F-NNN — Platform Connection-Management Architecture` (three R2DBC pools + HikariCP + PGConnectionFactory direct).

## Next

1. **Read the consumer** — verify empirically (probe) what happens at request 21 to a single replica: does Spring R2DBC backpressure via Mono queueing, or does it fail with `R2dbcTimeoutException` after `maxAcquireTime`? The `R2dbcProperties.Pool.maxAcquireTime` framework default is uncertain — the sidecar marks this `PROBE-NEEDED`.
2. **Promote or merge** — decide between standalone feature flow (R2DBC pool sizing) vs facet of a broader connection-management feature. The four connection-management strategies (primary R2DBC, custom R2DBC, HikariCP for Flyway/ShedLock, PGConnectionFactory direct for HousekeepingJobManager / PostgreSQLLeaderElectionManagerImpl) deserve one canonical home.
3. **Open follow-ups**:
   - DOC-NNN — operator page should publish at minimum `spring.r2dbc.pool.max-size` as a tunable, with the framework-default value stated.
   - PERF-NNN — add R2DBC Micrometer binder (`io.r2dbc.pool.metrics`) so `/actuator/prometheus` exposes pool utilisation; current observability is `org.jooq` log level only.
   - REFACTOR-NNN — gate `customConnectionPool` with `@ConditionalOnProperty(value="spring.custom-datasource.url")` so deployments without Lookup Tables don't pay the double-pool cost.
4. **DOC-NNN** — add an admonition on the operator page: "ODD ships two R2DBC connection pools per replica; the framework default per pool is 10 connections. Multi-replica deployments at scale must tune `spring.r2dbc.pool.max-size` AND raise PostgreSQL's `max_connections` accordingly."

## Links

- cluster_with: [F-026]
- merged_into: F-120
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: graduate — evidence rich across 5 substrate axes (config class file:line + application.yml absence + framework defaults + concept-catalog invariant + WebFetch confirming docs silence). Minted F-120 (P-08:F-014 R2DBC Pool Operator-Tunability). Cluster_with F-026 preserved as related cross-reference; not folded because the R2DBC pool ceiling is operator-infrastructure shape, not Lookup-Tables-specific.

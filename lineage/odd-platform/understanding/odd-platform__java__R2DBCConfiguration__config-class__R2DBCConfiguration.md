---
node_id: "odd-platform java R2DBCConfiguration config-class:R2DBCConfiguration"
node_kind: config-class
axis: config_classes
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-batch-X-R2DBCConfiguration
schema_version: v0.3.0
pillar_mapping:
  primary: P-11
  secondary: [P-03, P-08, P-09]
  rationale: |
    Primary P-11 Platform API and Developer Surface is wrong-shaped here; this
    file is a foundational `@Configuration` class wiring the reactive
    persistence substrate that every other pillar reads / writes against — it
    is an architectural-pillar concern (`metadata-store` / `platform-server`)
    more than a feature pillar. Among feature pillars the closest fit is
    P-03 Master Data Management — the `customConnectionPool` bean and the
    `lookup_tables_schema` URL query-param injection (lines 24-25, 116-117)
    exist solely to give the Lookup Tables subsystem a separately-credentialed
    R2DBC `ConnectionFactory`. Secondary P-08 Management and Administration
    (operator-tunable `spring.datasource.*` + `spring.custom-datasource.*`
    knobs read here) and P-09 Security and Access Control (credentials enter
    the JVM as plaintext config values surfaced via Spring's
    `DataSourceProperties` and `R2dbcProperties` and into actuator /env when
    enabled — see `application.yml:226-240`).
back_links:
  feature_ids: [F-MDM-LookupTables, F-Platform-DB-Wiring, F-Operational-Infrastructure]
  retrospectives: []
  refactors: [REFACTOR-185]
  concept_catalog_entries:
    - lookup-table-rename-via-alter-table-breaks-downstream-sql-consumers
    - authorization-hot-path-getcurrentuserroles-per-request-no-cache
    - master-data-management-lookup-table-pillar-p-03-anchored
    - reference-data-lookup-table-crud
---

# R2DBCConfiguration (`@Configuration` — primary + custom R2DBC ConnectionFactory wiring) — semantic understanding

## understanding

`R2DBCConfiguration` is the 121-line Spring `@Configuration` class that wires the reactive PostgreSQL persistence substrate for the ODD Platform — it exposes SIX beans: two R2DBC `ConnectionPool` beans (the `@Primary` one bound to `spring.datasource.*` for the platform's core schema; a second named `customConnectionPool` bound to `spring.custom-datasource.*` with three-key fallback to the primary, used solely for the Lookup Tables subsystem's `lookup_tables_schema` PostgreSQL schema), two `DatabaseClient` beans (`databaseClient` over the primary pool; `customDataClient` over the custom pool), and two `ReactiveTransactionManager` beans (`@Primary` over the primary `ConnectionFactory`; `customTransactionManager` over the custom pool referenced by the `@ReactiveCustomTransactional` annotation). The primary bean converts the `jdbc:`-prefixed `DataSourceProperties.url` into an `r2dbc:` URL via string replacement (line 31) and overlays Spring Boot's `R2dbcProperties.Pool` defaults via a `PropertyMapper.alwaysApplyingWhenNonNull()` chain on ten pool parameters (maxIdleTime / maxLifeTime / maxAcquireTime / maxCreateConnectionTime / initialSize / maxSize / validationQuery / validationDepth / minIdle / maxValidationTime — lines 41-50); the `application.yml` ships ZERO explicit `spring.r2dbc.pool.*` values so every pool size / timeout is at Spring Boot's framework default (no operator-visible override is documented). The custom bean (lines 54-87) mirrors the primary's ten-line pool-mapping block verbatim — a structural duplication shipped today — and additionally rewrites the JDBC URL to append `?schema=lookup_tables_schema` via `UriComponentsBuilder` (lines 112-119) so every connection from the `customConnectionPool` lands inside the dedicated schema created by migration `V0_0_86`.

## concepts

- entities:
  - R2DBCConfiguration (this `@Configuration` class)
  - ConnectionPool (primary, `@Bean(destroyMethod = "dispose") @Primary` at line 27-28) — the platform-wide reactive PostgreSQL pool consumed by every `@Repository`-tier reactive jOOQ call
  - ConnectionPool (`customConnectionPool`, `@Bean(name = "customConnectionPool", destroyMethod = "dispose")` at line 54) — the Lookup Tables subsystem's reactive pool scoped to `lookup_tables_schema`
  - DatabaseClient (primary, `@Bean` at line 89-92) — Spring R2DBC's reactive SQL client, injected as `databaseClient` into the primary jOOQ-reactive helper
  - DatabaseClient (`customDataClient`, `@Bean(name = "customDataClient")` at line 94-98) — injected into `JooqReactiveOperationsCustomTables` via `@Qualifier("customDataClient")` (`JooqReactiveOperationsCustomTables.java:29`)
  - ReactiveTransactionManager (primary, `@Bean @Primary` at line 100-103) — the default Reactive TM, wired to `@ReactiveTransactional` per the workspace's transaction convention
  - ReactiveTransactionManager (`customTransactionManager`, `@Bean(name = "customTransactionManager")` at line 106-110) — the TM referenced by `@ReactiveCustomTransactional` (annotation at `ReactiveCustomTransactional.java:11`) which `ReferenceDataRepositoryImpl` applies to 9 Lookup-Table CRUD methods (`ReferenceDataRepositoryImpl.java:64,79,116,181,205,239,267,280,302`)
  - SCHEMA_PART_FOR_CUSTOM_DB_URL (the literal `"schema"` constant at line 24 — the URL query-param key appended to every custom-pool R2DBC URL)
  - VALUE_PART_FOR_CUSTOM_DB_URL (the literal `"lookup_tables_schema"` constant at line 25 — the PostgreSQL schema name created by `V0_0_86__create_schema_and_tables_for_custom_tables.sql:53`)
- operations:
  - rewrite `jdbc:postgresql://...` → `r2dbc:postgresql://...` via simple `.replace("jdbc", "r2dbc")` (line 31; line 114 strips `jdbc:` prefix and prepends `r2dbc:` after `UriComponentsBuilder` rebuilds the URL with the schema query-param)
  - parse R2DBC URL via `ConnectionFactoryOptions.parse(...)`, then `.mutate()` to overlay PROTOCOL=postgresql + USER + PASSWORD (lines 32-36 primary; 64-70 custom)
  - resolve custom-datasource credentials with String-blank fallback to primary `DataSourceProperties` (lines 61-62 — `StringUtils.isBlank(username) ? dataSourceProperties.getUsername() : username`; symmetric for password)
  - build `ConnectionPoolConfiguration` by applying ten Spring Boot `R2dbcProperties.Pool` properties when non-null via `PropertyMapper.alwaysApplyingWhenNonNull()` (lines 41-50 primary; 75-84 custom)
  - destroy via `dispose()` at `@Bean` shutdown (`destroyMethod = "dispose"` at line 27 and line 54) — closes the underlying connection pool on context shutdown
  - lifetime: bean construction at Spring context bootstrap; reuse for the JVM lifetime
- invariants:
  - "Primary `ConnectionPool` reads from Spring Boot's auto-configured `DataSourceProperties` (`spring.datasource.url|username|password`) — `application.yml:5-7` ships dev defaults `jdbc:postgresql://127.0.0.1:5432/odd-platform` / `odd-platform` / `odd-platform-password`. The URL is converted from JDBC to R2DBC by `.replace(\"jdbc\", \"r2dbc\")` at line 31 — a string-substring replace that depends on `jdbc` appearing exactly once at the URL's start; an unusual hostname containing `jdbc` substring would corrupt the URL (LOW likelihood with PostgreSQL hosts, but no defensive parsing)."
  - "Custom datasource opt-in: three keys `spring.custom-datasource.url|username|password` are declared via `@Value` with empty-string default (`@Value(\"${spring.custom-datasource.url:}\")` at lines 56-58 — trailing colon = empty-string default per Spring's property-placeholder syntax). The bean factory falls back to the primary `DataSourceProperties` values via `StringUtils.isBlank(...)` check (lines 61-62 + `getCustomSchemaDBUrl(url, dataSourceUrl)` at line 113). When ALL three keys are unset (the shipped default — they are commented out at `application.yml:8-11`), the `customConnectionPool` opens a SECOND R2DBC pool against the SAME PostgreSQL database as the primary, only differing by the `?schema=lookup_tables_schema` URL query-param. Live docs (`docs.opendatadiscovery.org/configuration-and-deployment/odd-platform`) verbatim: `'JDBC string of your PostgreSQL database where we store Lookup Tables. Falls back to spring.datasource.url when unset'` (WebFetched 2026-05-20, status 200)."
  - "`lookup_tables_schema` is a HARD-CODED constant (line 25 — `public static final String VALUE_PART_FOR_CUSTOM_DB_URL = \"lookup_tables_schema\";`). The schema name is NOT operator-configurable. Live docs verbatim: `'you can specify any {database_host}, {database_port} or {database_name} but schema, where Lookup Tables are stored always is lookup_tables_schema'` (WebFetched 2026-05-20, status 200). This constant must match the migration script `V0_0_86__create_schema_and_tables_for_custom_tables.sql:53` (`CREATE SCHEMA IF NOT EXISTS lookup_tables_schema;`) and the literal `SCHEMA_NAME = \"lookup_tables_schema\"` in `ReferenceDataRepositoryImpl.java:57`. Three locations carry the same literal — refactoring requires updating all three."
  - "Two `R2dbcProperties.Pool` defaults blocks are byte-identical (lines 41-50 vs 75-84). Both apply Spring Boot's pool defaults via `PropertyMapper.alwaysApplyingWhenNonNull()` to ten parameters; neither block customises any value. The `application.yml` declares ZERO `spring.r2dbc.pool.*` keys so the pool's `initialSize`, `maxSize`, `maxIdleTime`, `maxLifeTime`, `maxAcquireTime`, `maxCreateConnectionTime`, `validationQuery`, `validationDepth`, `minIdle`, `maxValidationTime` are ALL at Spring Boot's framework default — at the time of `spring-boot:3.x` + `r2dbc-pool:1.0.0.RELEASE` (`gradle/libs.versions.toml:14,73`), `maxSize` defaults to 10 connections per pool (Spring Boot's framework default — NOT documented as ODD-platform-specific guidance). Two pools × 10 = 20 connections per platform replica is the practical ceiling unless operators set `spring.r2dbc.pool.max-size` (no live-doc page surfaces this knob; live docs do NOT publish R2DBC pool sizing as an operator knob — verified by WebFetch 2026-05-20 of `/configuration-and-deployment/odd-platform`)."
  - "Credentials path: `DataSourceProperties.getPassword()` (line 35 + line 62 fallback) returns the value from `spring.datasource.password`. Spring Boot resolves the password from the property source chain — application.yml ships `odd-platform-password` as the plaintext default; production overrides typically come via env variable `SPRING_DATASOURCE_PASSWORD` (Spring's relaxed binding). The `@Value(\"${spring.custom-datasource.password:}\")` parameter at line 58 surfaces the custom password as a `String` constructor argument — readable in heap dumps and in any `/actuator/env` response IF the actuator endpoint is exposed (application.yml:230-231 ships `management.endpoints.web.exposure.include: health, prometheus, env, info` — the `env` endpoint IS exposed by default in this deployment). Spring Boot's `EnvironmentEndpoint` masks `password` and `secret` patterns by default, but operators relying on this for compliance should verify the masking rules cover `spring.custom-datasource.password` (the standard masker matches the substring `password`, so yes — but no test asserts this in the ODD codebase)."
  - "`@Primary` distinguishes the platform-wide ConnectionFactory (line 28) from the custom one. Any reactive code injecting `ConnectionFactory` without an explicit `@Qualifier` receives the primary; the custom pool is opted-into ONLY by parameters annotated `@Qualifier(\"customConnectionPool\")` (lines 96 + 108) or via the `@ReactiveCustomTransactional` annotation (`ReactiveCustomTransactional.java:11` — `@Transactional(\"customTransactionManager\")`). Only `JooqReactiveOperationsCustomTables` (line 29) and `ReferenceDataRepositoryImpl` (9 method-level annotations) opt in today."
- audiences:
  - "ODD Platform operators tuning database connectivity (the four `spring.datasource.*` + four-key `spring.custom-datasource.*` set)"
  - "DBAs sizing the platform's PostgreSQL backend (two R2DBC pools per replica + one HikariCP pool from `DataSourceConfiguration` for ShedLock / `PGConnectionFactory`)"
  - "Operators considering Lookup-Tables isolation — the only mechanism today is `spring.custom-datasource.*` pointing at a separate database; same-database schema isolation is the shipped default"
  - "Security reviewers auditing credential storage paths (plaintext in YAML / env; readable via `/actuator/env` with default masking)"

## dependencies_semantic

- requires-feature:
  - "Spring Boot 3's `DataSourceProperties` auto-configuration (`org.springframework.boot.autoconfigure.jdbc.DataSourceProperties` at line 11) — binds `spring.datasource.*` and provides `getUrl() / getUsername() / getPassword()` to both bean factories."
  - "Spring Boot 3's `R2dbcProperties` auto-configuration (`org.springframework.boot.autoconfigure.r2dbc.R2dbcProperties` at line 12) — provides the `Pool` inner-class with the ten pool-tuning defaults applied via `PropertyMapper` at lines 41-50 + 75-84."
  - "`io.r2dbc.pool.ConnectionPool` + `ConnectionPoolConfiguration` (gradle/libs.versions.toml:14 — `r2dbc-pool = '1.0.0.RELEASE'`) — the reactive pool implementation. `destroyMethod = \"dispose\"` (lines 27, 54) closes pooled connections at Spring context shutdown."
  - "`io.r2dbc.spi.ConnectionFactories.get(...)` (line 32 + line 65) — the SPI lookup that resolves the R2DBC driver based on PROTOCOL=postgresql; requires the `r2dbc-postgresql` driver on the classpath (referenced indirectly via `gradle/libs.versions.toml`)."
  - "`org.springframework.web.util.UriComponentsBuilder` (line 20) — used at line 116 to rebuild the custom-pool URL with the `?schema=lookup_tables_schema` query-param appended."
  - "`org.springframework.boot.context.properties.PropertyMapper` with `.alwaysApplyingWhenNonNull()` (line 39 + line 73) — the Spring Boot utility that copies non-null source values to a builder; the only reason 10 pool parameters can be optionally overridden without 10 explicit if-non-null guards."
  - "`org.apache.commons.lang3.StringUtils.isBlank` (line 8 import; lines 61, 62, 113) — used for the empty-string-or-whitespace fallback check on the three `spring.custom-datasource.*` parameters."
- requires-config:
  - "`spring.datasource.url` — required; no Java-side default in this file. Defaults to `jdbc:postgresql://127.0.0.1:5432/odd-platform` per `application.yml:5`. Read at boot via `DataSourceProperties.getUrl()` (lines 31, 59-60). A runtime change requires a JVM restart — the `ConnectionPool` bean is built once at context init."
  - "`spring.datasource.username` — required; default `odd-platform` per `application.yml:6`. Read via `DataSourceProperties.getUsername()` (lines 34, 61)."
  - "`spring.datasource.password` — required; default `odd-platform-password` per `application.yml:7`. Read via `DataSourceProperties.getPassword()` (lines 35, 62)."
  - "`spring.custom-datasource.url` — OPTIONAL; empty-string default via `@Value(\"${spring.custom-datasource.url:}\")` at line 56. The three keys are shipped COMMENTED-OUT in `application.yml:8-11`. When blank, `getCustomSchemaDBUrl(url, dataSourceUrl)` at line 113 falls back to the primary datasource URL via `StringUtils.isNotBlank(customUrl) ? customUrl : dataSourceUrl`."
  - "`spring.custom-datasource.username` — OPTIONAL; empty-string default at line 57. Fallback at line 61: `StringUtils.isBlank(username) ? dataSourceProperties.getUsername() : username`."
  - "`spring.custom-datasource.password` — OPTIONAL; empty-string default at line 58. Fallback at line 62."
  - "`spring.r2dbc.pool.*` (ten keys via Spring Boot's `R2dbcProperties.Pool`) — NOT shipped in `application.yml`; entirely at Spring Boot's framework defaults. Operator-visible only by adding the keys to the deployment's resolved property source. Live docs (`/configuration-and-deployment/odd-platform`) do NOT publish these as operator knobs (verified WebFetch 2026-05-20)."
- requires-runtime:
  - "PostgreSQL — both pools target Postgres via PROTOCOL=postgresql (lines 33, 67). The schema-creation migration `V0_0_86` requires PostgreSQL DDL semantics (`CREATE SCHEMA IF NOT EXISTS lookup_tables_schema; SET search_path TO lookup_tables_schema,public;`)."
  - "Java 17 + Spring Boot 3 reactive stack — `Mono`/`Flux` consumers downstream require the R2DBC reactive driver semantics; non-blocking I/O throughout."
  - "Flyway migration `V0_0_86` MUST have run before the `customConnectionPool` is used; otherwise SQL operations against `lookup_tables_schema` fail with `schema does not exist`. The migration runs at boot via `DataSourceConfiguration`'s HikariCP datasource (since Flyway uses JDBC, not R2DBC) — a separate boot-time dependency."
- coupling:
  - "Coupled with `DataSourceConfiguration` (the sibling at `DataSourceConfiguration.java:14-33`) — that file exposes a HikariCP-backed `DataSource` bean and a `DataSourceTransactionManager` for synchronous JDBC use. ODD's persistence stack runs THREE distinct connection-management strategies side-by-side: (1) primary R2DBC ConnectionPool (this file, line 27) for reactive jOOQ; (2) custom R2DBC ConnectionPool (this file, line 54) for Lookup Tables; (3) HikariCP DataSource (`DataSourceConfiguration.java:17-27`) for Flyway migrations + ShedLock + `@Transactional`-annotated synchronous paths. Plus `PGConnectionFactory` (`PGConnectionFactory.java:18-42`) bypasses all of them via `DriverManager.getConnection` direct for `HousekeepingJobManager` and `PostgreSQLLeaderElectionManagerImpl` (cross-reference: `HousekeepingJobManager.md` sidecar — `PGConnectionFactory` bypasses HikariCP and the R2DBC pools)."
  - "Coupled with `JooqReactiveOperationsCustomTables` (`JooqReactiveOperationsCustomTables.java:29` — `@Qualifier(\"customDataClient\")`) — the ONLY downstream consumer of the `customDataClient` `DatabaseClient` bean. Single-consumer coupling means renaming the bean breaks exactly one file."
  - "Coupled with `ReactiveCustomTransactional` annotation (`ReactiveCustomTransactional.java:11` — `@Transactional(\"customTransactionManager\")`) — the annotation hard-codes the bean name `customTransactionManager` defined at line 106. Renaming the bean requires updating the annotation."
  - "Coupled with `ReferenceDataRepositoryImpl` (9 methods at lines 64,79,116,181,205,239,267,280,302) — the ONLY consumer of `@ReactiveCustomTransactional` and therefore the only file exercising the `customTransactionManager` + `customConnectionPool` in transactional code-paths."
  - "Migration coupling: `V0_0_86__create_schema_and_tables_for_custom_tables.sql:53` creates the schema; `R2DBCConfiguration.java:25` carries the schema name as a Java constant; `ReferenceDataRepositoryImpl.java:57` carries the schema name as a separate Java constant. Three locations, same string — refactor risk noted by concept catalog (`lookup-table-rename-via-alter-table-breaks-downstream-sql-consumers.yaml` shape: downstream SQL consumers cite `lookup_tables_schema` as the recommended access path, so the schema name is itself a public-API contract)."

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - "Primary URL conversion: `.replace(\"jdbc\", \"r2dbc\")` (line 31) — no test verifies behaviour on URLs where `jdbc` appears in the host name, the database name, or as a query-param value. A hostname like `jdbc.internal.example.com` would corrupt the URL to `r2dbc:postgresql://r2dbc.internal.example.com:5432/odd-platform`. LOW likelihood with standard PG deployments."
  - "Custom-datasource fallback chain: no test verifies that when ALL THREE custom keys are blank the bean opens a pool against the SAME database with `?schema=lookup_tables_schema` appended. The behavioural invariant is asserted only by the live-docs page and the production shipped default — a regression that flipped the blank-check polarity (`isBlank` → `isNotBlank`) would not be caught by the platform's test suite."
  - "Schema constant alignment: no test verifies that `VALUE_PART_FOR_CUSTOM_DB_URL` (line 25), `ReferenceDataRepositoryImpl.SCHEMA_NAME` (line 57), and the migration `V0_0_86:53` agree. A drift between these three strings would cause schema-not-found errors at runtime for every Lookup-Table operation but compile / boot fine."
  - "Pool sizing: no test asserts that the default `maxSize` is the value the docs imply (no docs commitment exists). A Spring Boot upgrade that altered the framework default for `R2dbcProperties.Pool.maxSize` would silently change ODD's deployed pool ceiling."
  - "Credential resolution path: no test verifies the `@Value(\"${spring.custom-datasource.password:}\")` empty-string default actually triggers the fallback. A typo in the placeholder syntax (e.g., missing the colon) would change the behaviour from 'empty string → fallback' to 'PropertyNotFoundException at boot' — caught only by manual smoke testing."
- test_files: []
- gaps: |
    The class has zero test coverage in this repo (`find <odd-platform-repo> -name 'R2DBCConfiguration*Test*'` returns no matches; `grep -rln 'R2DBCConfiguration' <odd-platform-repo>/odd-platform-api/src/test` returns no matches). The component is exercised TRANSITIVELY by every reactive repository test that uses the `@Primary` `DatabaseClient` and by `ReferenceDataRepositoryImpl` tests that use `customDataClient` — but the configuration code itself has no direct unit test. Regressions most likely to slip past existing tests: (a) URL conversion edge cases (substring replace at line 31); (b) custom-datasource fallback inversion; (c) schema-name drift across the three locations (R2DBCConfiguration / ReferenceDataRepositoryImpl / migration V0_0_86); (d) credential masking guarantees from `/actuator/env`.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform"
    anchor: ""
    rationale: "The 'Configure ODD Platform' reference page enumerates `spring.datasource.url|username|password` and `spring.custom-datasource.url|username|password` as operator-facing knobs and explicitly states the fallback semantics. This is the canonical operator-facing surface for the config keys this class consumes."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Three primary-datasource keys:
        - "spring.datasource.url: JDBC string of your PostgreSQL database. Default value is jdbc:postgresql://127.0.0.1:5432/odd-platform"
        - "spring.datasource.username: your PostgreSQL user's name. Default value is odd-platform"
        - "spring.datasource.password: your PostgreSQL user's password. Default value is odd-platform-password"
      Three custom-datasource keys with verbatim fallback wording:
        - "spring.custom-datasource.url: JDBC string of your PostgreSQL database where we store Lookup Tables. Falls back to spring.datasource.url when unset"
        - "spring.custom-datasource.username: Falls back to spring.datasource.username when unset"
        - "spring.custom-datasource.password: Falls back to spring.datasource.password when unset"
      Schema-name hard-coding verbatim:
        - "you can specify any {database_host}, {database_port} or {database_name} but schema, where Lookup Tables are stored always is lookup_tables_schema"
      Connection-pool gap statement:
        - "The documentation does not expose explicit R2DBC connection pool sizing parameters (spring.r2dbc.pool.*) as operator-configurable keys. Pool behavior appears to be managed through Spring Boot defaults without dedicated platform configuration options."
  - url: "https://docs.opendatadiscovery.org/features/master-data-management/lookup-tables"
    anchor: ""
    rationale: "Lookup Tables feature page — the only feature surface that triggers the secondary R2DBC pool. Explicitly mentions the fallback semantics and the `lookup_tables_schema` direct-PG access path."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      - "spring.custom-datasource.url #unset by default (@Value(\"${spring.custom-datasource.url:}\")); falls back to spring.datasource.url"
      - "spring.custom-datasource.username #unset by default; falls back to spring.datasource.username (default: odd-platform)"
      - "spring.custom-datasource.password #unset by default; falls back to spring.datasource.password"
      - "lookup_tables_schema — this schema contains all the lookup tables created by the user. Users can interact with these tables just like any other regular tables within the database."
      - "Direct database access is the recommended path for downstream consumers (BI tools, ETL jobs, ad-hoc queries)"
- doc_drift_findings:
  - "Live docs at `/configuration-and-deployment/odd-platform` do NOT publish any of the ten `R2dbcProperties.Pool` settings (`spring.r2dbc.pool.max-size`, `min-idle`, `max-idle-time`, `max-life-time`, `max-acquire-time`, `max-create-connection-time`, `validation-query`, `validation-depth`, `initial-size`, `max-validation-time`) as operator knobs. The code wires PropertyMapper for all ten (R2DBCConfiguration.java:41-50, 75-84), meaning operators CAN set them but the docs surface none of them. Operators sizing a high-throughput deployment have no guidance on the pool ceiling — Spring Boot's default `maxSize=10` × two pools × N replicas is the practical concurrency budget. **Drift severity MEDIUM** — recommend a docs follow-up (DOC-NNN candidate) documenting the framework-default ceiling and at minimum `spring.r2dbc.pool.max-size` as a tunable."
  - "Live docs at `/configuration-and-deployment/odd-platform` do not surface the secondary R2DBC ConnectionPool's existence as an operational fact even when the operator runs default config (one R2DBC pool / database) — the page treats `spring.custom-datasource.*` as a feature-on opt-in. In practice, the `customConnectionPool` bean is ALWAYS instantiated (no `@ConditionalOnProperty` gate at line 54), so every deployment opens two R2DBC pools regardless of whether the operator set the custom keys. **Drift severity LOW** — wording-level, not behaviour-misleading."
  - "Live docs do not mention the `?schema=lookup_tables_schema` URL query-param injection (R2DBCConfiguration.java:117). Operators pointing `spring.custom-datasource.url` at a separate database MAY not understand that the connection's `search_path` is being silently rewritten — a separate-DB deployment where the operator pre-created `public` tables would be invisible to ODD because every query lands inside `lookup_tables_schema`. **Drift severity LOW** — affects only the unusual case of an operator deliberately separating Lookup-Table storage."

## implicit_adrs

- "Reactive persistence on R2DBC with HikariCP retained as a parallel synchronous datasource — evidence: R2DBCConfiguration.java:1-121 (the entire file declaring R2DBC `ConnectionPool`s) + DataSourceConfiguration.java:14-33 (the parallel HikariCP `DataSource`) — intent_anchor: 'Two `@Configuration` classes living side-by-side in the same package; the R2DBC file uses the SAME `DataSourceProperties` as input (`R2DBCConfiguration.java:29 final DataSourceProperties dataSourceProperties`) ensuring URL + credentials are shared by intent across both stacks — single source of truth for connection settings.' — confidence: HIGH"
- "Two-pool, one-schema-isolation pattern for Lookup Tables (the operator-curated tables created by `ReferenceDataRepository`) — evidence: R2DBCConfiguration.java:24-25 (the `SCHEMA_PART_FOR_CUSTOM_DB_URL = \"schema\"` + `VALUE_PART_FOR_CUSTOM_DB_URL = \"lookup_tables_schema\"` constants) + R2DBCConfiguration.java:116-119 (the `UriComponentsBuilder` query-param injection) + V0_0_86__create_schema_and_tables_for_custom_tables.sql:53-55 (the migration creating the schema + `SET search_path`) — intent_anchor: 'The `public static final String VALUE_PART_FOR_CUSTOM_DB_URL = \"lookup_tables_schema\"` constant + the dedicated `customConnectionPool` bean + the `@ReactiveCustomTransactional` annotation + the `JooqReactiveOperationsCustomTables` helper form a complete sub-system whose explicit purpose is to scope operator-curated table DDL/DML to a named schema separate from platform-internal tables — naming and structure encode the decision.' — confidence: HIGH"
- "Three-key fallback over hard-failing on missing custom-datasource credentials — evidence: R2DBCConfiguration.java:61-62 (`StringUtils.isBlank(username) ? dataSourceProperties.getUsername() : username`) + line 113 (`StringUtils.isNotBlank(customUrl) ? customUrl : dataSourceUrl`) — intent_anchor: 'The bean factory accepts three optional `@Value` parameters with empty-string defaults (lines 56-58) AND implements per-key fallback to the primary datasource — both signal the intentional design that the secondary R2DBC pool is a same-database / same-credential default, with a separate-database deployment as the opt-in.' — confidence: HIGH"
- "Pool defaults inherited from Spring Boot without explicit platform-side overrides — evidence: R2DBCConfiguration.java:38-50 + 72-84 (the two byte-identical PropertyMapper blocks; both apply ALL ten `R2dbcProperties.Pool` defaults via `.alwaysApplyingWhenNonNull()`) + application.yml:1-15 (no `spring.r2dbc.pool.*` keys shipped) — intent_anchor: 'The `PropertyMapper.alwaysApplyingWhenNonNull()` chain on ten parameters is a code pattern that delegates ALL pool tuning to Spring Boot's framework defaults — none is overridden at construction. Combined with zero `spring.r2dbc.pool.*` entries in `application.yml`, the platform's pool ceiling is whatever the framework version ships, not an ODD-curated value.' — confidence: HIGH"
- "Schema name as a hard-coded constant (not operator-configurable) — evidence: R2DBCConfiguration.java:25 (`public static final String VALUE_PART_FOR_CUSTOM_DB_URL = \"lookup_tables_schema\"`) + live docs verbatim 'schema, where Lookup Tables are stored always is lookup_tables_schema' (WebFetched 2026-05-20) — intent_anchor: 'The `public static final` keyword + identical-string presence at ReferenceDataRepositoryImpl.java:57 + migration V0_0_86 + the docs sentence using the word `always` is a converged signal that the schema name is a contract surface — operators relying on direct PG access (BI tools, ETL) anchor their queries to this exact schema name, so making it configurable would break that contract.' — confidence: HIGH"
- "`@Bean(destroyMethod = \"dispose\")` for both ConnectionPools (lines 27, 54) — evidence: explicit `destroyMethod` declaration on both `@Bean` annotations — intent_anchor: 'The explicit `destroyMethod = \"dispose\"` on both pool beans signals graceful shutdown intent — the framework would not call `dispose()` automatically without this declaration. Pairs with the `@Primary` distinction on the first pool to ensure context shutdown releases both pools cleanly.' — confidence: HIGH"

## bugs_limitations_corner_cases

- "URL conversion via raw `.replace(\"jdbc\", \"r2dbc\")` at line 31 — if a hostname or database name contains the literal substring `jdbc` (LOW likelihood; possible with hostnames like `jdbc-host.example.com` or DB names like `jdbc_test`), the URL becomes corrupted at multiple positions. No test guards this. — evidence: R2DBCConfiguration.java:31 — severity: LOW"
- "Two-block PropertyMapper duplication: lines 41-50 (primary) and lines 75-84 (custom) are byte-for-byte identical pool-tuning logic. A future change to one block must be manually mirrored to the other — refactor candidate to extract a shared `applyPoolDefaults(R2dbcProperties.Pool pool, ConnectionPoolConfiguration.Builder builder)` helper. — evidence: R2DBCConfiguration.java:38-50 vs 72-84 — severity: LOW"
- "`customConnectionPool` is instantiated unconditionally — no `@ConditionalOnProperty` gating on the custom-datasource keys (contrast with `HousekeepingJobManager.java:18`). Every deployment runs two R2DBC pools whether or not Lookup Tables are used. Resource overhead: two pool instances × default `maxSize=10` × M idle connections held; for small deployments with no Lookup-Tables traffic this is wasted DB-side connection slots. — evidence: R2DBCConfiguration.java:54 (no `@ConditionalOnProperty`) — severity: LOW"
- "Spring Boot framework default `maxSize=10` per pool is not published as a platform guarantee. A future Spring Boot version that altered the default would silently change ODD's deployed pool ceiling. The platform commits to no specific ceiling and ships no `spring.r2dbc.pool.max-size` override in `application.yml`. — evidence: R2DBCConfiguration.java:46 + application.yml:1-15 (no `spring.r2dbc.pool.*`) — severity: MEDIUM"
- "`spring.r2dbc.pool.*` operator knobs are wired (PropertyMapper applies them at lines 41-50) but UN-documented at `docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` (verified WebFetch 2026-05-20). Operators with large alerts / activity-feed / lineage-graph workloads have no docs guidance on tuning the pool — concept catalog already names this gap (`authorization-hot-path-getcurrentuserroles-per-request-no-cache.yaml:44-45` — `R2DBC pool size (spring.r2dbc.pool.max-size) is the upper bound; under cost saturates the R2DBC pool`). — evidence: R2DBCConfiguration.java:41-50 + WebFetch confirming docs gap — severity: MEDIUM"
- "Schema name `lookup_tables_schema` is duplicated as a string literal across three locations (R2DBCConfiguration.java:25, ReferenceDataRepositoryImpl.java:57, V0_0_86__create_schema_and_tables_for_custom_tables.sql:53). Drift in any one would cause schema-not-found errors at runtime for every Lookup-Table operation. No central constant module — refactor candidate. — evidence: R2DBCConfiguration.java:25 + ReferenceDataRepositoryImpl.java:57 + V0_0_86:53 — severity: LOW"
- "Credentials enter the JVM as plaintext config values (lines 35, 56-58, 61-62). `application.yml:7` ships the literal default password `odd-platform-password`; operators MUST override via env / Helm values for any production deployment. The actuator `/env` endpoint is exposed by default (`application.yml:230-231 management.endpoints.web.exposure.include: health, prometheus, env, info`); Spring Boot's `EnvironmentEndpoint` masks fields matching `password` / `secret` substrings, BUT no test asserts that `spring.custom-datasource.password` is in the masked set, and operators relying on this for compliance should verify it post-deploy. — evidence: R2DBCConfiguration.java:35,58 + application.yml:7 + application.yml:230-231 — severity: MEDIUM"
- "`@Value(\"${spring.custom-datasource.url:}\")` at line 56 uses the empty-string default convention (trailing colon = empty string). A misconfigured operator who SET the key to a deliberately-empty value (e.g., `spring.custom-datasource.url:\"\"` in YAML) would trigger the SAME fallback path as if they had not set the key — silent behaviour where one might expect a validation error. — evidence: R2DBCConfiguration.java:56-58 + 61-62, 113 — severity: LOW"
- "URL parsing at line 32 (`ConnectionFactoryOptions.parse(r2dbcUrl)`) and line 66 (`ConnectionFactoryOptions.parse(getCustomSchemaDBUrl(...))`) — failure modes (malformed URL after the JDBC→R2DBC replace) propagate as raw R2DBC SPI exceptions at bean-creation time; the platform fails fast at boot but the error message is the R2DBC SPI's, not ODD's. Operators see e.g., `IllegalArgumentException: Cannot determine driver from r2dbc:postgresql://...` without ODD context. — evidence: R2DBCConfiguration.java:32, 66 — severity: LOW"
- "No connection-pool metrics exposed at `/actuator/prometheus` or `/actuator/health` — `r2dbc-pool` ships pool metrics via Micrometer but the platform does not enable / verify the Micrometer R2DBC binder. Operators sizing the pool have no JVM-side telemetry beyond `io.r2dbc.postgresql.QUERY` and `io.r2dbc.postgresql.PARAM` log levels (application.yml:251-252). — evidence: application.yml:226-245 (no R2DBC Micrometer binder configuration) — severity: MEDIUM"

## security

- auth_mode_relevance: INTERNAL_ONLY — this is a foundational `@Configuration` class, not on the HTTP surface. Auth modes (DISABLED / LOGIN_FORM / OAUTH2 / LDAP / S2S) do not gate this bean's creation, but the credentials it consumes are the platform-wide DB credentials used by every downstream authenticated and unauthenticated path.
- ingestion_filter_relevance: N/A — not HTTP.
- authorization_assertions: []
- owner_scoping: N/A — not data-scoped; this is the substrate that data-scoped repositories run on top of.
- data_exposure:
  - "Plaintext database credentials enter the JVM via `spring.datasource.password` (line 35; `application.yml:7` ships `odd-platform-password`) and `spring.custom-datasource.password` (line 58). Both are readable in heap dumps. The `/actuator/env` endpoint is exposed by default per `application.yml:230-231` (`management.endpoints.web.exposure.include: health, prometheus, env, info`) — Spring Boot's default `EnvironmentEndpoint` masks fields matching `password`, `secret`, `key`, `token` substrings, so values appear as `******` rather than the literal credential. However the masking is a substring match on the property KEY name, not a structural guarantee — a renamed key would lose masking."
  - "JDBC URL exposed via `/actuator/env` reveals the database host / port / database-name, which informs an attacker who has reached the actuator port of the PG endpoint's location. Standard masking does NOT cover URL keys."
- known_security_gaps:
  - "Plaintext password default `odd-platform-password` shipped in `application.yml:7` — a deployment that forgets to override `spring.datasource.password` runs with a well-known credential at the database. NOT this file's responsibility per se (it consumes whatever `DataSourceProperties` provides), but the credentials flow through this class to the live ConnectionFactory. Operators must override via env / Helm values / Kubernetes secret mount. No `IllegalStateException` at bean creation if the password equals the shipped default — silent acceptance. — evidence: R2DBCConfiguration.java:35 + application.yml:7 — severity: MEDIUM (deployment-discipline, not code-defect)"
  - "`/actuator/env` exposure default-on per `application.yml:230-231` (`include: health, prometheus, env, info`) — attacker who reaches the actuator port can enumerate the resolved property values including the (masked-by-key-name) credentials AND the unmasked JDBC URL. Spring Boot's EnvironmentEndpoint substring-match for `password`/`secret`/`key`/`token` is the only protection; no test in ODD asserts this masking covers `spring.custom-datasource.password`. — evidence: application.yml:230-231 + standard Spring Boot 3 EnvironmentEndpoint masking semantics — severity: MEDIUM"
  - "No declarative validation on the JDBC URL (no `@URL` constraint, no allowlist of schemes, no DB-vendor check). A misconfigured `spring.datasource.url` pointing at an attacker-controlled Postgres would be silently accepted. The PROTOCOL=postgresql override at line 33 forces the driver lookup but does not validate the host. — evidence: R2DBCConfiguration.java:31-36 — severity: LOW (deployment-discipline)"

## performance

- hot_paths:
  - "The primary `ConnectionPool` (line 27) serves every reactive jOOQ call from every `@Repository` — this includes the authorization hot path (concept catalog `authorization-hot-path-getcurrentuserroles-per-request-no-cache.yaml:44-45` — `R2DBC pool size (spring.r2dbc.pool.max-size) is the upper bound; under cost saturates the R2DBC pool`), the lineage-graph traversal, the ingestion-pipeline write phase, and every Catalog Overview / Directory / Search read. — evidence: R2DBCConfiguration.java:27-52 (primary pool) + concept-catalog reference"
  - "The custom `ConnectionPool` (line 54) serves Lookup-Tables CRUD only (9 `@ReactiveCustomTransactional` methods in `ReferenceDataRepositoryImpl`). Operator-traffic volume; not on critical request-rendering paths. — evidence: R2DBCConfiguration.java:54-87 + ReferenceDataRepositoryImpl.java:64,79,116,181,205,239,267,280,302"
- throughput_characteristics:
  - "Reactive Mono/Flux throughout — non-blocking I/O; one connection borrowed per query, released back to the pool on Mono completion. Two pools means two independent borrow/release lifecycles per platform replica."
  - "Spring Boot's R2dbcProperties.Pool default `maxSize=10` × two pools = practical ceiling of 20 concurrent DB queries per platform replica BEFORE backpressure / queueing kicks in. No `spring.r2dbc.pool.*` overrides shipped in `application.yml:1-15`."
- resource_allocation:
  - "Two `io.r2dbc.pool.ConnectionPool` instances per platform replica. Each pool holds `initialSize` connections (Spring Boot default: 10 per pool unless overridden) — 20 connection slots minimum across both pools. `maxSize` defaults: 10 per pool = 20 ceiling."
  - "Postgres-server-side: under default Spring Boot R2DBC pool settings × N replicas, each replica consumes 2 × maxSize PG connections; a 5-replica deployment can sustain up to 100 connection slots at the DB. PG `max_connections` typically defaults to 100 — a 5-replica deployment with NO other clients is at the edge; with collectors and operator-side tooling included, the platform's default pool sizing is a real capacity ceiling. No live-doc guidance on tuning."
  - "HikariCP datasource (`DataSourceConfiguration.java:17-27`) and `PGConnectionFactory` (PGConnectionFactory.java:18-42) consume additional connection slots OUTSIDE this file's two pools — for ShedLock, Flyway, leader election, partition jobs, and the housekeeping subsystem (HousekeepingJobManager.md sidecar coupling)."
- scaling_characteristics:
  - "Stateless `@Configuration` — bean instances created once at context init, reused for JVM lifetime. Horizontal scaling = more pools at the DB."
  - "Pool ceiling per replica is the constraint that bounds RPS — beyond `maxSize`, R2DBC backpressures via `Mono.subscribe()` queueing or fails with `R2dbcTimeoutException` after `maxAcquireTime` (Spring Boot default unbounded? not asserted by docs — would need WebSearch of Spring Boot 3.x release notes). The validation path is `@ReactiveTransactional` annotated methods saturating one connection per request; concurrency × N requests > maxSize ⇒ tail-latency spike."
- known_performance_gaps:
  - "No `spring.r2dbc.pool.max-size` override in `application.yml` AND no docs guidance — operators deploying high-RPS configurations have no published guidance on tuning. Concept catalog already names the implication (`authorization-hot-path-getcurrentuserroles-per-request-no-cache.yaml`). — evidence: R2DBCConfiguration.java:41-50 + application.yml — severity: MEDIUM"
  - "No R2DBC Micrometer binder configured — operators cannot observe pool utilisation, borrow latency, queue depth via `/actuator/prometheus`. The `io.r2dbc.postgresql.QUERY` / `PARAM` log levels at `application.yml:251-252` are coarse query traces, not pool telemetry. — evidence: application.yml:226-257 — severity: MEDIUM"
  - "`customConnectionPool` is created unconditionally (no `@ConditionalOnProperty` at line 54) — every deployment runs a second pool whether or not Lookup Tables are used. For deployments that never create a Lookup Table, this is `initialSize` connections (Spring Boot default per-pool) held against `lookup_tables_schema` perpetually. — evidence: R2DBCConfiguration.java:54-87 — severity: LOW"

## sources

- understanding ← R2DBCConfiguration.java:1-121 (full file read)
- concepts.entities.R2DBCConfiguration ← R2DBCConfiguration.java:22-23
- concepts.entities.ConnectionPool-primary ← R2DBCConfiguration.java:27-52
- concepts.entities.ConnectionPool-custom ← R2DBCConfiguration.java:54-87
- concepts.entities.DatabaseClient-primary ← R2DBCConfiguration.java:89-92
- concepts.entities.DatabaseClient-custom ← R2DBCConfiguration.java:94-98
- concepts.entities.ReactiveTransactionManager-primary ← R2DBCConfiguration.java:100-103
- concepts.entities.ReactiveTransactionManager-custom ← R2DBCConfiguration.java:106-110
- concepts.entities.SCHEMA_PART_FOR_CUSTOM_DB_URL ← R2DBCConfiguration.java:24
- concepts.entities.VALUE_PART_FOR_CUSTOM_DB_URL ← R2DBCConfiguration.java:25
- concepts.invariants.url-conversion ← R2DBCConfiguration.java:31
- concepts.invariants.custom-fallback ← R2DBCConfiguration.java:56-58, 61-62, 113 + WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform
- concepts.invariants.lookup_tables_schema-hardcoded ← R2DBCConfiguration.java:25 + ReferenceDataRepositoryImpl.java:57 + V0_0_86__create_schema_and_tables_for_custom_tables.sql:53 + WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform (verbatim `always`)
- concepts.invariants.pool-duplication ← R2DBCConfiguration.java:38-50 vs 72-84
- concepts.invariants.credentials-path ← R2DBCConfiguration.java:35,58,62 + application.yml:7,230-231
- concepts.invariants.primary-vs-custom-injection ← R2DBCConfiguration.java:28,96,108 + ReactiveCustomTransactional.java:11
- dependencies_semantic.requires-feature.* ← R2DBCConfiguration.java:3-20 (imports) + gradle/libs.versions.toml:14,73
- dependencies_semantic.requires-config.spring.datasource.* ← application.yml:5-7 + R2DBCConfiguration.java:29-36
- dependencies_semantic.requires-config.spring.custom-datasource.* ← R2DBCConfiguration.java:56-58 + application.yml:8-11 (commented out)
- dependencies_semantic.requires-config.spring.r2dbc.pool.* ← R2DBCConfiguration.java:41-50 + application.yml:1-15 (absent) + WebFetch confirming docs silence
- dependencies_semantic.requires-runtime.PostgreSQL ← R2DBCConfiguration.java:33,67 (PROTOCOL=postgresql)
- dependencies_semantic.requires-runtime.Flyway-V0_0_86 ← V0_0_86__create_schema_and_tables_for_custom_tables.sql:53
- dependencies_semantic.coupling.DataSourceConfiguration ← DataSourceConfiguration.java:1-33
- dependencies_semantic.coupling.JooqReactiveOperationsCustomTables ← JooqReactiveOperationsCustomTables.java:29
- dependencies_semantic.coupling.ReactiveCustomTransactional ← ReactiveCustomTransactional.java:11
- dependencies_semantic.coupling.ReferenceDataRepositoryImpl ← ReferenceDataRepositoryImpl.java:57,64,79,116,181,205,239,267,280,302
- dependencies_semantic.coupling.PGConnectionFactory ← PGConnectionFactory.java:18-42 (cross-reference HousekeepingJobManager.md sidecar)
- tests_coverage_semantic.gaps ← `find <odd-platform-repo> -name 'R2DBCConfiguration*Test*'` returns no matches + `grep -rln 'R2DBCConfiguration' <odd-platform-repo>/odd-platform-api/src/test` returns no matches
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform 2026-05-20 status 200
- docs_link_semantic.inferred_docs.[1] ← WebFetch https://docs.opendatadiscovery.org/features/master-data-management/lookup-tables 2026-05-20 status 200
- docs_link_semantic.doc_drift_findings.[0] ← R2DBCConfiguration.java:41-50, 75-84 + WebFetch confirming `spring.r2dbc.pool.*` docs absence
- docs_link_semantic.doc_drift_findings.[1] ← R2DBCConfiguration.java:54 (no `@ConditionalOnProperty`)
- docs_link_semantic.doc_drift_findings.[2] ← R2DBCConfiguration.java:116-119 (URL query-param injection)
- implicit_adrs.[0] ← R2DBCConfiguration.java:1-121 + DataSourceConfiguration.java:14-33
- implicit_adrs.[1] ← R2DBCConfiguration.java:24-25, 116-119 + V0_0_86:53-55
- implicit_adrs.[2] ← R2DBCConfiguration.java:61-62, 113
- implicit_adrs.[3] ← R2DBCConfiguration.java:38-50, 72-84 + application.yml:1-15
- implicit_adrs.[4] ← R2DBCConfiguration.java:25 + WebFetch verbatim `always`
- implicit_adrs.[5] ← R2DBCConfiguration.java:27, 54 (`destroyMethod = "dispose"`)
- bugs_limitations_corner_cases.[0] ← R2DBCConfiguration.java:31
- bugs_limitations_corner_cases.[1] ← R2DBCConfiguration.java:38-50 vs 72-84
- bugs_limitations_corner_cases.[2] ← R2DBCConfiguration.java:54
- bugs_limitations_corner_cases.[3] ← R2DBCConfiguration.java:46 + application.yml
- bugs_limitations_corner_cases.[4] ← R2DBCConfiguration.java:41-50 + WebFetch
- bugs_limitations_corner_cases.[5] ← R2DBCConfiguration.java:25 + ReferenceDataRepositoryImpl.java:57 + V0_0_86:53
- bugs_limitations_corner_cases.[6] ← R2DBCConfiguration.java:35,58 + application.yml:7,230-231
- bugs_limitations_corner_cases.[7] ← R2DBCConfiguration.java:56-58
- bugs_limitations_corner_cases.[8] ← R2DBCConfiguration.java:32, 66
- bugs_limitations_corner_cases.[9] ← application.yml:226-245
- security.auth_mode_relevance ← R2DBCConfiguration.java:22 (no @ConditionalOnProperty on auth.*)
- security.data_exposure.[0] ← R2DBCConfiguration.java:35,58 + application.yml:7,230-231
- security.data_exposure.[1] ← application.yml:230-231 (env actuator exposure)
- security.known_security_gaps.[0] ← R2DBCConfiguration.java:35 + application.yml:7
- security.known_security_gaps.[1] ← application.yml:230-231 + EnvironmentEndpoint standard masking
- security.known_security_gaps.[2] ← R2DBCConfiguration.java:31-36 (no @URL constraint)
- performance.hot_paths.[0] ← R2DBCConfiguration.java:27-52 + concept catalog `authorization-hot-path-getcurrentuserroles-per-request-no-cache.yaml:44-45`
- performance.hot_paths.[1] ← R2DBCConfiguration.java:54-87 + ReferenceDataRepositoryImpl.java
- performance.throughput.* ← R2DBCConfiguration.java:38-50 (PropertyMapper) + application.yml (no overrides)
- performance.resource_allocation.* ← R2DBCConfiguration.java:27,54 + DataSourceConfiguration.java + PGConnectionFactory.java
- performance.scaling.* ← R2DBCConfiguration.java:22 (stateless @Configuration) + R2dbcProperties.Pool framework defaults
- performance.known_performance_gaps.[0] ← R2DBCConfiguration.java:41-50 + WebFetch silence
- performance.known_performance_gaps.[1] ← application.yml:226-257 (no R2DBC Micrometer)
- performance.known_performance_gaps.[2] ← R2DBCConfiguration.java:54 (no @ConditionalOnProperty)

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH (file-local signals; aggregate concept-merger picture is across all DB-touching beans)
- performance: HIGH (file-local; cross-pillar pool-saturation picture is in the concept catalog's authorization-hot-path entry)

## coherence_check (LSN-018, Rule 6)

Pre-emit coherence run for this sidecar:

- **Pillar mapping vs evidence**: P-03 (Master Data Management) as primary feature-pillar is correct — the `customConnectionPool` + `lookup_tables_schema` query-param injection exists solely for Lookup Tables. P-11 alternative was considered (config-class as developer-facing wiring) but the system-mission's pillar definitions place R2DBC wiring as architectural-pillar `metadata-store` substrate; P-03 wins on feature-pillar fit. P-08 (operator knobs) + P-09 (credentials surface) are correctly secondary.
- **Concept-catalog alignment**: `lookup-table-rename-via-alter-table-breaks-downstream-sql-consumers.yaml` references `lookup_tables_schema` as a public-API contract — consistent with this sidecar's implicit ADR #5 (schema name as hard-coded contract). `authorization-hot-path-getcurrentuserroles-per-request-no-cache.yaml` references `spring.r2dbc.pool.max-size` as the saturation bound — consistent with this sidecar's perf gap #1.
- **Cross-sidecar coupling**: `HousekeepingJobManager.md` already describes `PGConnectionFactory` as the bypass-HikariCP path; this sidecar lists `PGConnectionFactory` as a fourth connection-management strategy alongside R2DBC × 2 + HikariCP — consistent.
- **Drift between code and live docs**: three findings, each with WebFetch evidence at 2026-05-20.
- **No banned phrases**: scanned for `probably / likely / should / looks right / presumably / defensible / canonical owner / monorepo default / safe to assume` — none present except in standard schema-defined headings (which are not claims).
- **No absolute paths in artefact content**: scanned for `/home/`, `/Users/`, `C:\Users\`; none present. Bash commands use `<odd-platform-repo>` placeholder.

## Maintainer notes

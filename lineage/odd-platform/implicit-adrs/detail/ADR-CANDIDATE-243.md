## ADR-CANDIDATE-243 — ShedLock's `JdbcTemplateLockProvider` shares the primary HikariCP `DataSource` with main jOOQ controller / repository traffic — no dedicated connection pool for lock arbitration

**Classification**: promote
**Severity**: MEDIUM
**Pillars affected**: [P-08 Management & Administration, P-06 Configuration & Deployment]
**Support**: surfaced by 1 sidecar (`SchedulingConfiguration` — primary-source)
**Batch**: ZK (2026-05-26)

**Surfaced by**:
- `odd-platform__java__config__config-class__SchedulingConfiguration.md:implicit_adrs.[3]` (HIGH confidence) — "Sharing the primary `DataSource` with main jOOQ traffic for ShedLock — the `lockProvider` Bean's parameter at SchedulingConfiguration.java:18 is `final DataSource dataSource` — Spring auto-wires the primary DataSource (the same HikariCP pool used by jOOQ for application traffic). An alternative would be a dedicated DataSource for ShedLock (separate pool, separate connection limits), keeping lock contention isolated. The choice to share the primary pool is a resource-economy decision: one HikariCP pool, one connection-limit budget. The trade-off: ShedLock's UPSERTs on the `shedlock` table consume one connection per lock acquisition — at four `@Scheduled` jobs across cadences ranging from 10min to daily, this is sub-1-QPS. Acceptable cost; explicit choice." — intent_anchor: "The absence of `@Qualifier` and the absence of a second `DataSource` Bean in the codebase together encode 'use the primary pool'."

**Decision statement**: `SchedulingConfiguration.java:18` declares the `lockProvider` `@Bean` method as `public LockProvider lockProvider(final DataSource dataSource)`. The parameter is unqualified — no `@Qualifier("shedlockDataSource")`, no `@Qualifier("management")`. Spring auto-wires the primary `DataSource` (the same HikariCP pool serving every controller / repository jOOQ query, sourced from `spring.datasource.url|username|password` in `application.yml:1-7`). The architecturally-alternative shape — declaring a second `@Bean(name = "shedlockDataSource") DataSource shedlockDs(...)` with its own connection-pool budget — is explicitly not chosen. The platform decision: **lock arbitration shares the primary connection pool**. Trade-offs accepted:
- (+) **Resource economy** — one HikariCP pool, one connection-limit budget. No second pool to size / monitor.
- (+) **Operational simplicity** — operators tune `spring.datasource.hikari.*` once; lock arbitration inherits.
- (-) **Pool exhaustion couples scheduling to traffic** — under HikariCP-pool exhaustion (e.g. a slow user-facing query holding many connections), a `@SchedulerLock` method cannot acquire its lock — the cycle silently skips. The ShedLock cadence (sub-1-QPS across four `@Scheduled` jobs) makes this LOW-probability but real.
- (-) **No connection-limit isolation** — a runaway housekeeping job (e.g. DataEntityHousekeepingJob cascading ~25 DELETEs in one transaction) holds connections that controller traffic could otherwise use.

**Wisdom test**: PASS. (1) **Deliberate** — the bare `DataSource` parameter without `@Qualifier` is the explicit choice; Spring's auto-wiring rules mean "no qualifier = primary pool", and the maintainer could have authored a qualified parameter against a sibling DataSource bean instead. (2) **Structural impact** — the choice defines the platform's connection-pool topology; moving to a dedicated pool is a STRUCTURAL change (introduces a second `@Bean`, a second `application.yml` block, a second HikariCP tuning surface). (3) **Refactoring vs structural change**: switching to a dedicated DataSource is NOT refactoring within the current shape — it would require a new bean, possibly a new datasource property prefix, and a per-pool tuning discipline. Structural.

**Evidence**:
- SchedulingConfiguration.md says: "SchedulingConfiguration.java:18 (the constructor parameter is `DataSource`, not `@Qualifier(\"shedlockDataSource\") DataSource`) + application.yml:1-7 (the only declared datasource). — intent_anchor: 'The absence of `@Qualifier` and the absence of a second `DataSource` Bean in the codebase together encode \"use the primary pool\".'"
- SchedulingConfiguration.md `performance.known_performance_gaps[2]`: "Shared DataSource between scheduling-locks and main jOOQ traffic. The same HikariCP pool serves both the platform's user-facing controller jOOQ queries and the ShedLock UPSERTs. Under HikariCP-pool exhaustion (e.g. a slow query holding many connections), a `@SchedulerLock` method cannot acquire its lock — silently skipping the cycle. The contention is real but low-probability today; suggested mitigation would be a separate `@Bean(\"shedlockDataSource\")` with its own connection limit."

**Existing ADR**: none. Composes with **ADR-CANDIDATE-240** (`.usingDbTime()`) — the shared DataSource is the resource backbone for the DB-time arbitration mechanic. Composes with **ADR-CANDIDATE-103** (housekeeping vs partition orchestrator split) — both orchestrators consume `PGConnectionFactory` (the same shared pool) for their fan-out work; the shared-pool decision in this ADR extends to both.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-147 (no per-job parallelism — single Connection bottleneck within a housekeeping cycle; the shared-pool decision at the lock-arbitration layer compounds with the per-cycle shared-connection decision at the orchestrator layer)
- The performance.known_performance_gaps[2] entry in SchedulingConfiguration is itself a LOW-severity refactoring scope; surfacing the pool-exhaustion silent-skip risk is the operational concern. Not minting a separate REFACTOR — the gap is documented within this ADR's trade-off section and the SchedulingConfiguration sidecar.

**Proposed action**: Promote to `adrs/drafts/shedlock-shared-datasource.md` (new ADR). Document the resource-economy trade-off explicitly + cite the pool-exhaustion silent-skip risk as the known operational cost. If the maintainer ever introduces a dedicated `shedlockDataSource`, that future ADR would SUPERSEDE this one.

**Severity rationale**: MEDIUM — resource-allocation decision; affects the platform's connection-pool sizing recommendations for operators. A future operator sizing HikariCP must account for BOTH controller traffic AND scheduling-lock UPSERTs against the same pool budget.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-240 (sibling decision in the same file).
- SUPERSEDES: none.
- CONFLICTS: none.

---

## ADR-CANDIDATE-240 — ShedLock's `JdbcTemplateLockProvider` is configured with `.usingDbTime()` so multi-replica deployments arbitrate locks against PostgreSQL's `current_timestamp`, neutralising JVM clock-skew between platform replicas

**Classification**: promote
**Severity**: HIGH
**Pillars affected**: [P-08 Management & Administration, P-06 Configuration & Deployment]
**Support**: surfaced by 1 sidecar (`SchedulingConfiguration` — primary-source, brand-new node)
**Batch**: ZK (2026-05-26)

**Surfaced by**:
- `odd-platform__java__config__config-class__SchedulingConfiguration.md:implicit_adrs.[0]` (HIGH confidence) — "DB-time for lock arbitration via `.usingDbTime()` — SchedulingConfiguration.java:22 explicitly invokes `.usingDbTime()` on the JdbcTemplateLockProvider's builder. The JdbcTemplateLockProvider default WITHOUT this call uses JVM-side timestamps (`Instant.now()`), which means two replicas with skewed clocks would write different `lock_until` values and the lock semantics would be vulnerable to clock drift. The choice to explicitly call `.usingDbTime()` is a documented intent: 'arbitrate via PostgreSQL's `current_timestamp`, not the JVM's clock' — eliminating clock-skew as a multi-replica concern. The DB-round-trip cost (one extra `SELECT now()` per lock operation) is the trade-off." — intent_anchor: "The explicit `.usingDbTime()` call IS the decision. ShedLock's JdbcTemplateLockProvider has the option available and the default is OFF; the deliberate invocation of `.usingDbTime()` encodes the intent."

**Decision statement**: `SchedulingConfiguration.java:22` configures the `JdbcTemplateLockProvider` bean by chaining `.usingDbTime()` on the builder. ShedLock's library default omits this — without the call, the provider writes `Instant.now()` (JVM-side wall clock) into `shedlock.lock_until` / `shedlock.locked_at`. With the call, ALL lock timestamps come from PostgreSQL's `current_timestamp` (server-side `now()`). The decision codifies the platform's posture for multi-replica deployments: **JVM clock drift between platform replicas is NOT a coordination concern because lock validity is decided against the database's authoritative time**. Two replicas with different system clocks (chrony missing, container clock unsync'd from host, K8s pod-scheduler delay) reach the SAME conclusion about whether the housekeeping / status-switch / partition-creation locks are held, because both read the same PG `now()`. The trade-off accepted: one extra `SELECT current_timestamp` per lock acquisition (negligible at the platform's sub-1-QPS lock cadence). The decision applies to all three `@SchedulerLock`-coordinated jobs across the codebase (`HousekeepingJobManager` 15min cycle, `DataEntityStatusSwitchJob` 10min, `PostgreSQLPartitionCreationJob` daily 00:01).

**Wisdom test**: PASS. (1) **Deliberate** — the explicit `.usingDbTime()` invocation is the intent anchor; the library has the option AVAILABLE and the default is OFF, so the maintainer made a positive choice. (2) **Structural impact** — the choice defines the platform's multi-replica coordination semantics; switching to a non-DB-time provider (Redis, ZooKeeper, JDBC-direct without `.usingDbTime()`) would change the clock-skew tolerance contract. (3) **Adding/removing the call is a STRUCTURAL change**, not refactoring within existing structure — removing it silently flips the platform from "clock-skew-immune" to "clock-skew-vulnerable" with no warning at boot.

**Evidence**:
- SchedulingConfiguration.md says: "SchedulingConfiguration.java:22 (`.usingDbTime()`). — intent_anchor: 'The explicit `.usingDbTime()` call IS the decision. ShedLock's JdbcTemplateLockProvider has the option available and the default is OFF; the deliberate invocation of `.usingDbTime()` encodes the intent.'"
- SchedulingConfiguration.md `stress_findings.resource_boundaries[0]` confirms multi-replica coordination correctness via the DB-time mechanic (lock UPSERT atomicity + `usingDbTime` validity window).
- SchedulingConfiguration.md says (probe P-182): "Multi-instance correctness: two JVMs boot simultaneously, both `@SchedulerLock(\"housekeepingJob\", 14m, 14m)` methods fire at the same wall-clock moment. With `.usingDbTime()` enabled, only one wins lock acquisition. Verify the second receives `Optional.empty()` from the LockProvider and no-ops; verify the first's `shedlock` row `lock_until` is approximately PG's `now() + 14m`, NOT JVM's `Instant.now() + 14m`."

**Existing ADR**: none. **Composes with ADR-CANDIDATE-179** (Postgres advisory-lock single-writer-per-cluster — a SIBLING coordination primitive for boot-time partition-creation). The two are complementary: ADR-179 uses `pg_try_advisory_lock(90)` for boot-time exclusion; ADR-240 uses `shedlock` table + `.usingDbTime()` for recurring `@Scheduled` exclusion. Both deliberately exclude external coordinators (Zookeeper / Redis / Consul) — Postgres IS the only coordination dependency. **Composes with ADR-CANDIDATE-103** (housekeeping-vs-partition orchestrator split) — both orchestrators inherit `@EnableScheduling` + `@EnableSchedulerLock` from this single SchedulingConfiguration file; ADR-240 is the load-bearing UNDER-the-orchestrators choice that makes 103's parallel orchestrators safe across replicas.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-703 NEW (no observability on lock acquisition / contention — the `.usingDbTime()` invariant is operationally invisible; an operator cannot tell from logs whether DB-time or JVM-time is being used)
- REFACTOR-700 NEW (session-housekeeping has `@Scheduled` but no `@SchedulerLock` — the platform-level `.usingDbTime()` posture does NOT apply because the job is unlocked; an architectural-inconsistency that violates the "if scheduled, lock it" convention)
- REFACTOR-149 / REFACTOR-323 (lockAtMostFor=14m vs fixedRate=15m race — the `.usingDbTime()` semantic does not save a job that runs past its lock window; the lock-window-vs-cycle-length issue is orthogonal)

**Proposed action**: Promote to `adrs/drafts/shedlock-db-time-multi-replica-coordination.md` (new ADR). Document the platform's complete multi-replica coordination posture: (a) `.usingDbTime()` for scheduled-task arbitration (this ADR), (b) Postgres advisory-lock for boot-time singleton work (ADR-179), (c) no external coordinator dependency. Cross-link with the `SchedulingConfiguration.md` probe P-182 (multi-instance lock-race verification — Testcontainers + 2-JVM test). Cite the operator-visible consequence: ODD tolerates clock drift between replicas (no chrony / NTP requirement on K8s nodes for correct scheduling-lock behaviour).

**Severity rationale**: HIGH — multi-replica deployment correctness depends on this exact configuration; a future maintainer refactoring SchedulingConfiguration (swapping providers, removing the chain call) would silently lose the clock-skew immunity. The decision is the single-most load-bearing line in the 26-line SchedulingConfiguration class.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-179 (Postgres advisory lock — sibling coordination primitive, same "Postgres-is-the-only-coordinator" stance), ADR-CANDIDATE-103 (housekeeping vs partition orchestrator split — both orchestrators are correct across replicas BECAUSE of this decision).
- SUPERSEDES: none.
- CONFLICTS: none.

---

## ADR-CANDIDATE-102 — Shared JDBC connection across all jobs in a housekeeping cycle — single `pgConnectionFactory.getConnection()` wraps the full for-loop; bypasses HikariCP pool; resource-economy trade-off

**Classification**: promote
**Severity**: LOW
**Pillars affected**: [P-08-management-administration]
**Support**: surfaced by 1 sidecar (`HousekeepingJobManager`) — primary-source; structural resource-allocation decision
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__HousekeepingJobManager.md:implicit_adrs.[1]` (HIGH confidence) — "Shared connection across all jobs in a cycle — the single `pgConnectionFactory.getConnection()` at line 32 is intentional. ... Sharing the connection is a resource-economy decision: one TCP socket, one PG backend, one auth handshake per cycle."

**Decision statement**: `HousekeepingJobManager.runHousekeepingJobs` (line 32) acquires ONE JDBC connection via `pgConnectionFactory.getConnection()` and the try-with-resources scope on line 32 wraps the ENTIRE for-loop iterating five `HousekeepingJob` beans (lines 33-35). The architecturally-cheaper alternative (one connection per job, fresh acquire/close per invocation) would issue five `DriverManager.getConnection` calls per cycle — note that `PGConnectionFactory.getConnection()` BYPASSES HikariCP entirely via `DriverManager.getConnection(url, props)` at `PGConnectionFactory.java:36` (see also ADR-CANDIDATE-101's cross-job failure-isolation contract). The architectural posture: ONE TCP socket, ONE PG backend process, ONE auth handshake per 15-minute housekeeping cycle. The trade-off: a slow first job blocks subsequent jobs on the same connection; the per-job try/catch (per ADR-CANDIDATE-101) does NOT release-and-reacquire the connection on job failure — a corrupted connection from a partial transaction would propagate to the next job.

**Wisdom test**: PASS. (1) Deliberate (the try-with-resources scope on line 32 wraps the ENTIRE for-loop — the maintainer could have nested per-job try-with-resources but chose the outer scope; the choice of `DriverManager.getConnection` over HikariCP-pooled acquisition is also deliberate); (2) Structural impact (every future job inherits the shared-connection semantics — concurrency, transaction-state, error-handling all flow through the single connection); (3) Changing the shape (per-job connection acquisition) would be a STRUCTURAL refactor with implications for the connection-pool sizing and the per-job transaction-state isolation.

**Evidence**:
- HousekeepingJobManager.md says: "`pgConnectionFactory.getConnection()` (line 32) acquires from `DriverManager.getConnection` directly (`PGConnectionFactory.java:36`) — bypasses HikariCP and the Spring DataSource pool."
- HousekeepingJobManager.md says (intent anchor): "the try-with-resources scope on line 32 wraps the ENTIRE for-loop — the structural intent is one connection per cycle, not one connection per job."

**Existing ADR**: none. Composes with **ADR-CANDIDATE-101** (per-job failure isolation) — together they encode the trade-off: shared resource × isolated failure. Composes with **ADR-CANDIDATE-046** (housekeeping opt-out by shipped default) as part of the same subsystem.

**Cross-link gaps**:
- REFACTOR-269 NEW — housekeeping connection bypasses HikariCP; connection-pool exhaustion metrics (HikariCP gauges in JMX) do NOT cover housekeeping connections; a connection-leak in housekeeping is invisible to pool monitoring.

**Proposed action**: Promote to `adrs/drafts/housekeeping-shared-connection-per-cycle.md` (new ADR). Document the connection-reuse trade-off (one TCP/auth handshake vs five) AND the observability gap (HikariCP-invisible connections, REFACTOR-269). Cross-link with ADR-CANDIDATE-101 (per-job failure isolation) and ADR-CANDIDATE-046 (housekeeping opt-out).

**Severity rationale**: LOW — resource-economy decision; affects per-cycle DB-side cost characteristics; correctness-defensible across all current job interactions (jobs operate on disjoint tables).

---

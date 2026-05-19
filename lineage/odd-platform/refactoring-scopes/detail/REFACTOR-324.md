## REFACTOR-324 — `HousekeepingJobManager` connection bypasses HikariCP — `PGConnectionFactory.getConnection()` uses `DriverManager.getConnection`; connection-pool exhaustion metrics in JMX do NOT cover housekeeping connections; a leak is invisible to pool monitoring

**Severity**: LOW
**Category**: observability (no-conn-pool-integration)
**Pillars affected**: [P-08-management-administration]
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__HousekeepingJobManager.md:bugs_limitations_corner_cases.[8]` (LOW) — "No connection-pool integration — `PGConnectionFactory.getConnection()` uses `DriverManager.getConnection` (PGConnectionFactory.java:36). The housekeeping subsystem bypasses HikariCP entirely. This means connection-pool exhaustion metrics (HikariCP gauges in JMX) do NOT cover housekeeping connections, and a connection-leak in housekeeping is invisible to pool monitoring."

**Description**: `HousekeepingJobManager.java:32` acquires its single per-cycle JDBC connection via `pgConnectionFactory.getConnection()`. The implementation at `PGConnectionFactory.java:36` calls `DriverManager.getConnection(url, props)` directly — NOT via the Spring DataSource pool (HikariCP). The shared connection is closed by try-with-resources at line 32 (which guarantees release even on exception via the `finally` semantic), so the leak risk is bounded — BUT a regression that breaks the try-with-resources (e.g. exception in the outer SQLException catch swallows the resource handle) would leak indefinitely, invisible to HikariCP's metrics.

**Failure mode**: A future refactor moves the connection-acquisition outside the try-with-resources (e.g. injects the Connection as a parameter). On exception, the connection is leaked. HikariCP's `pool.totalConnections`, `pool.activeConnections`, `pool.idleConnections` JMX gauges show no change because the leaked connection is OUTSIDE the pool. The platform's connection-pool monitoring dashboard shows healthy pool state while Postgres reports `max_connections` exhaustion.

**Primary source citations**:
- `HousekeepingJobManager.java:32` (`pgConnectionFactory.getConnection()` in try-with-resources)
- `PGConnectionFactory.java:36` (`DriverManager.getConnection(url, props)` — bypasses HikariCP)

**Existing-ADR-or-implied-prescription**: None. ADR-CANDIDATE-102 (NEW batch K — shared JDBC connection across all jobs in a cycle) frames the resource-economy decision (one TCP socket per cycle) and explicitly notes the HikariCP bypass as a trade-off; the ADR does NOT defend the absence of observability. The IMPLIED prescription is that the bypass should be visible to operators — at minimum a separate Micrometer gauge.

**Proposed remedy**: Two options. (a) **Switch to HikariCP**: `pgConnectionFactory.getConnection()` could acquire from the main `DataSource` instead of `DriverManager` — HikariCP can short-loan a connection for the cycle. The trade-off is that a 14-minute housekeeping cycle holds a connection from the main pool, potentially starving HTTP-request connections under high load. (b) **Add separate metrics**: maintain a small `housekeeping_active_connections` AtomicInteger; increment on getConnection, decrement on close (via try-with-resources hook); expose via Micrometer. Operators see the gauge; a leak (gauge stays at 1 across cycles) is detectable.

**Severity rationale**: LOW — observability gap; the leak risk is bounded by try-with-resources today; a future refactor could regress.

**Suggested backlog grouping**: `Housekeeping safety sprint` (small observability addition)

---

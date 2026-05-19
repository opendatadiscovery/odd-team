## REFACTOR-244 — No method-level observability across the 5 reactive-repository batch — no `@Timed`, no Micrometer counters, no log entries; latency regressions invisible at the repository boundary

**Severity**: LOW
**Category**: observability (cross-cutting)
**Surfaced by**:
- `ReactiveDataEntityRepositoryImpl.md:bugs_limitations_corner_cases` (implicit — no observability imports across 982-line file)
- `ReactiveLineageRepositoryImpl.md:performance.known_performance_gaps` (implicit — no @Timed across the file)
- `ReactiveOwnershipRepositoryImpl.md:bugs_limitations_corner_cases[1]` (explicit — "no method-level observability")
- `ReactivePolicyRepositoryImpl.md:concepts.invariants` (implicit — no log emission on RBAC mutations)
- `ReactiveAlertRepositoryImpl.md:performance.known_performance_gaps[4]` (explicit — "no @Timed, no Micrometer counters, no structured log entries")

**Description**: Across all 5 repository sidecars in batch H, the consistent finding: **no method-level observability emits from any repository method**. The cross-cutting evidence:

- **ReactiveDataEntityRepositoryImpl** (982 lines) — no `@Timed`, no `Counter`, no `log.info` / `log.warn`, no Micrometer imports.
- **ReactiveLineageRepositoryImpl** (177 lines) — no observability imports; recursive-CTE traversal has zero per-method latency tracking despite being the lineage-canvas hot path.
- **ReactiveOwnershipRepositoryImpl** (146 lines) — no `@Timed`, no Micrometer counter, no structured log entry on any of the 8 methods. The sidecar explicitly names this: "A regression in `createOrUpdate`'s partition concat (e.g. swapping `Flux::concat` for `Flux::merge`) would silently change the returned-record ordering; no metric or log would flag it."
- **ReactivePolicyRepositoryImpl** (40 lines) — RBAC mutations emit ZERO log lines (per `security.known_security_gaps[1]`: "ExceptionUtils.translateDatabaseException emits one `log.error` ONLY on non-uniqueness DB errors. A security incident reviewer reconstructing 'who created/modified/deleted the MANAGEMENT/ALL policy on date X' has zero in-application records").
- **ReactiveAlertRepositoryImpl** (526 lines) — the sidecar's own performance.known_performance_gaps[4]: "An operator investigating 'why is the alerts page slow today' has no per-method visibility."

The aggregate consequence: a latency regression in any of the 19+ methods on `ReactiveAlertRepositoryImpl` or the 30+ methods on `ReactiveDataEntityRepositoryImpl` would surface ONLY through:
- R2DBC connection-pool metrics (downstream signal — symptom, not cause).
- WebFlux request-latency histograms (downstream — aggregates many DB calls).
- Manual Postgres query log inspection (operator-driven).

There is no "this method's p99 latency" signal at the repository boundary. Capacity planning, regression detection, and incident response all depend on the operator manually correlating downstream metrics with upstream code paths.

The pattern is structural: the platform uses Spring Boot's auto-instrumentation for WebFlux and R2DBC but does NOT add per-method instrumentation at the repository layer. The trade-off is implicit ("less code, less complexity") but not explained anywhere — no comment, no ADR, no docs.

The wisdom test verdict is GAP (informational): the absence is acceptable for an early-stage project (the platform's current operator base is small; the metric surface area is bounded), but the absence has consequences as the project scales. The fix is straightforward (`@Timed` annotation per method or AOP-driven instrumentation across the repository package) and additive within the existing structure.

**Primary source citations**:
- `ReactiveDataEntityRepositoryImpl.java:1-982` — verified no observability imports
- `ReactiveLineageRepositoryImpl.java:1-177` — verified no `@Timed` or `Counter`
- `ReactiveOwnershipRepositoryImpl.java:1-146` — verified no `log.*` or metric imports
- `ReactivePolicyRepositoryImpl.java:1-40` — verified no log imports beyond inherited
- `ReactiveAlertRepositoryImpl.java:1-526` — verified no observability surface
- contrast with `ExceptionUtils.java:34` — the ONE inherited log line (`log.error("Database exception", e)`) that fires only on non-uniqueness errors

**Existing-ADR-or-implied-prescription**: implicit — the codebase uses Spring Boot's framework-level instrumentation for cross-cutting metrics; per-method instrumentation is deferred. No ADR documents the choice. Adding instrumentation is refactoring within the existing structure (no architectural change).

**Proposed remedy**: Three-tiered, additive:
1. **AOP-driven repository instrumentation** (cleanest): one `@Aspect` class that wraps every method in `org.opendatadiscovery.oddplatform.repository.reactive` with a `Timer` named `repository.{class}.{method}`. Zero per-class change; one configuration class.
2. **`@Counted` for mutation methods** (security/audit hot-spots): annotate every RBAC mutation method (`PolicyServiceImpl.create/update/delete`, `RoleServiceImpl.*`, `OwnerServiceImpl.delete`) with `@Counted("rbac.mutation")` and tag with the operation type. Pair with REFACTOR-188 (the audit-log gap).
3. **Structured log on slow methods** (forensic aid): emit `log.warn` when a method's duration exceeds a configurable threshold (e.g. `p99=500ms`). Caller can investigate the structured log for the slow-method's parameters.

The order matters: (1) is the broadest baseline; (2) addresses the RBAC observability gap explicitly (per REFACTOR-188); (3) addresses operator-driven incident response. All three are non-breaking additions.

**Severity rationale**: LOW — operational hygiene, not correctness. The platform works correctly today; the gap is in regression detection, capacity planning, and incident response. Compounds with REFACTOR-188 (no audit log on RBAC mutations — the security forensics gap); REFACTOR-073 (no boot-time security-posture validator — no startup signal of misconfiguration); REFACTOR-129 (no Notifications rate-limiting — silent fan-out without metrics). The pattern is "the platform's observability surface is gappy across multiple subsystems"; this finding adds the repository-layer evidence.

**Suggested backlog grouping**: `Observability sprint` — bundle with REFACTOR-188 (RBAC audit emission) and the upcoming Notifications + Housekeeping observability work. The aspect-driven baseline (1) is a single-sprint task; the per-mutation counters (2) couple with the audit-log sprint; the structured slow-method log (3) is a stretch goal.

---

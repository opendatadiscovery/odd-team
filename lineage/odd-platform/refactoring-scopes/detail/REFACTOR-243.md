## REFACTOR-243 — `AlertHousekeepingJob` uses JDBC `Connection` while `ReactiveAlertRepositoryImpl` uses R2DBC `DatabaseClient` — no shared transaction scope; read-then-purge race produces silent state transitions

**Severity**: LOW
**Category**: dual-driver-race (latent)
**Surfaced by**:
- `ReactiveAlertRepositoryImpl.md:bugs_limitations_corner_cases[6]`

**Description**: The platform's alert subsystem uses TWO database access drivers on the same tables:
1. **Read/write path** — `ReactiveAlertRepositoryImpl` uses reactive jOOQ-on-R2DBC via `JooqReactiveOperations` (`JooqReactiveOperations.java:30-49`) — the standard pattern for HTTP-request-driven reads and writes.
2. **Housekeeping path** — `AlertHousekeepingJob` uses synchronous jOOQ-on-JDBC `Connection` (`AlertHousekeepingJob.java:24-46`) — the standard pattern for scheduled background jobs.

The two share no transaction scope. A read in the repository can interleave with a housekeeping DELETE:
- `get(alertId)` issued at T=0 starts the R2DBC read.
- `AlertHousekeepingJob` runs at T=1 (every 15 minutes per the Spring `@Scheduled` cadence) and issues a DELETE for the same alert (the alert's `RESOLVED_AT` has aged past TTL).
- If the R2DBC read SELECT raced ahead: the read returns the row; the DELETE removes it; the UI renders an alert that no longer exists. The user clicks "view details" → 404.
- If the DELETE committed first: the R2DBC read returns `Mono.empty()`; the UI shows "alert not found"; the user is confused (they saw the alert in the list a moment ago).
- There is no `FOR SHARE` lock on the read paths to prevent this.

The race is **benign**: either state is consistent with eventual consistency; the user sees the alert disappear; the system recovers on next refresh. But the race surface is non-obvious to a reader of either file in isolation — neither code path comments the cross-driver coupling.

The pattern is structural: the platform consistently splits scheduled-job paths to JDBC (synchronous, Spring-scheduled, simpler) and request paths to R2DBC (reactive, WebFlux-aware, complex). The split is sound at the architecture level but produces the race-of-reads-and-purges on every table with both surfaces. This is the **third** instance of the pattern: `AlertHousekeepingJob` + `DataEntityHousekeepingJob` + `EmptyPartitionsHousekeepingJob` all run JDBC; their target tables also have R2DBC repositories.

The wisdom test verdict is GAP (informational) — the architectural split itself is sound (covered partly by ADR-CANDIDATE-045 housekeeping-vs-partition separation), but the race window is unanchored: no comment, no diagram, no doc-page explains "if you read an alert while housekeeping is running, the alert may disappear mid-render."

**Primary source citations**:
- `AlertHousekeepingJob.java:24` — synchronous `Connection`
- `JooqReactiveOperations.java:28` — reactive `DatabaseClient`
- `ReactiveAlertRepositoryImpl.java:72-91` — the `get(alertId)` read path
- contrast with `ReactiveLineageRepositoryImpl.java` — no analogous housekeeping job for lineage; the lineage table accumulates indefinitely (a separate finding implicit in the missing-retention scope family)
- ADR-CANDIDATE-045 (housekeeping-vs-partition separation) — architectural context

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-045 (housekeeping subsystem) IS the architectural intent. The race surface is the implementation-side consequence — not an architectural change. Refactoring within the existing structure.

**Proposed remedy**: Three options, in increasing investment:
1. **Doc-only** (cheapest): add a paragraph to the live `/configuration-and-deployment/odd-platform#housekeeping` page explaining the cadence (every 15 minutes) and the expected UI behaviour (occasional disappearance of alerts mid-render). Operator-facing transparency without code change.
2. **Soft-delete + delayed hard-delete** (medium): add a `RESOLVED_DELETED_AT` column; the housekeeping job sets it instead of DELETEing; a second job 24h later does the hard-delete. The R2DBC reads filter `RESOLVED_DELETED_AT IS NULL`. The race window narrows to the soft-delete moment (small) instead of the full hard-delete cascade (long).
3. **Migrate housekeeping to R2DBC** (heaviest): rewrite `AlertHousekeepingJob` to use the same `JooqReactiveOperations` as the repository. The race becomes transactionally fenced. Side effect: scheduled-job code becomes reactive, which is harder to debug and slower for batch operations.

Option (1) is the right starting point. Option (2) is the right next step IF operators report the UX issue. Option (3) is over-investment for the benefit.

**Severity rationale**: LOW — benign race; UX confusion, not data-loss or security. Compounds with REFACTOR-142 (the existing AlertHousekeepingJob jOOQ-precedence bug — manual RESOLVED alerts get hard-deleted on the next 15-minute cycle regardless of TTL); operators investigating "where did my alert go?" must consider both this race and that bug.

**Suggested backlog grouping**: `DOC-NNN housekeeping behaviour page` — pair with REFACTOR-142 (the jOOQ-precedence bug). Both are housekeeping-surface findings that operators experience as "alerts disappear unexpectedly."

---

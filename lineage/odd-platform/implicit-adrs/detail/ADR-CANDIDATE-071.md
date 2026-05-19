## ADR-CANDIDATE-071 — Centralised DB-error translation via `ExceptionUtils.translateDatabaseException` wired in `JooqReactiveOperations.onErrorMap` — every Reactive*Repository inherits HTTP-friendly errors built from per-constraint name-keyed messages

**Severity**: HIGH
**Classification**: promote
**Support count**: 2 sidecars (this batch — Policy + Ownership; cross-batch evidence in earlier RBAC sidecars naming the same `UniqueConstraintException` shape)
**Axes present**: repositories, error-handling

**Surfaced by**:
- `ReactivePolicyRepositoryImpl.md:implicit_adrs[2]` (the centralised translation pattern with explicit `JooqReactiveOperations.onErrorMap` wiring)
- `ReactiveOwnershipRepositoryImpl.md:implicit_adrs[1]` (the same pattern via the OWNERSHIP_DATA_ENTITY_ID_OWNER_ID_KEY branch)

**Decision statement**: ODD's persistence-layer errors are **uniformly translated** from raw Postgres `DataAccessException` to project-specific application exceptions (`UniqueConstraintException`, `NotFoundException`, `CascadeDeleteException`, etc.) carrying human-readable messages keyed by DB constraint name — propagated via a SINGLE chokepoint in `JooqReactiveOperations`:

```java
// JooqReactiveOperations.java:30-49
public <T> Mono<T> mono(Query query) {
  return Mono.from(databaseClient.inConnection(c -> ...))
    .onErrorMap(DataAccessException.class, ExceptionUtils::translateDatabaseException);
}
public <T> Flux<T> flux(Query query) {
  return Flux.from(databaseClient.inConnectionMany(c -> ...))
    .onErrorMap(DataAccessException.class, ExceptionUtils::translateDatabaseException);
}
```

`ExceptionUtils.translateDatabaseException` (lines 30-36) dispatches:
- SQLSTATE class C23 (integrity constraint violation) → `UniqueConstraintException` with a per-constraint friendly message via `formatMessage` (lines 38-83).
- Other errors → generic `DatabaseException` (with a single `log.error("Database exception", e)`).

The per-constraint dispatch is a CURATED ENUMERATION at `ExceptionUtils.java:38-83`. Each known constraint name maps to a tailored message. The relevant branches identified in this batch's sidecars:
- `POLICY_NAME_UNIQUE` → `"Policy with this name already exists"` (line 60-62)
- `OWNERSHIP_DATA_ENTITY_ID_OWNER_ID_KEY` → `"Ownership for this data entity and owner already exists"` (line 69-71)
- (additional branches in the file for other named entities)

The decision codifies:
- **(a)** Repository methods never leak raw `org.springframework.dao.DataAccessException` to the API layer. Every R2DBC call is wrapped at `JooqReactiveOperations.mono` / `.flux`; the `.onErrorMap` registration is at the wrapper level, not the repository level. The repository is unaware of the translation; the contract is at the framework boundary.
- **(b)** The translation is CURATED, not derived. Every known constraint name is explicitly mapped to a user-facing message. Adding a new constraint (a new partial unique index per ADR-CANDIDATE-070, a new FK, a new CHECK) requires a corresponding `if (message.contains(NEW_CONSTRAINT_NAME))` branch in `formatMessage`. The maintainer cost is acknowledged: every schema migration that adds a constraint must be paired with an `ExceptionUtils` update.
- **(c)** The translation produces typed exceptions with HTTP-mapping-friendly error codes. `UniqueConstraintException` carries `ErrorCode.UNIQUE_CONSTRAINT` (`ErrorCode.java:11` — code=`USR003`, resolvable=true). The `ControllerAdvice.handleUniqueConstraintException` (lines 36-40) maps this to HTTP 400. The chain is: SQLSTATE 23505 → `UniqueConstraintException` → HTTP 400 + USR003 + friendly message — no raw Postgres errors reach the client.
- **(d)** The pattern is uniformly applied. No `Reactive*Repository` in the codebase bypasses `JooqReactiveOperations`; every repository acquires connections via `.mono(...)` / `.flux(...)`. The architecture forecloses "leaky-Postgres-errors" as a possibility.

**Wisdom test**: PASS. All three questions resolve toward ADR:
1. *Intentional?* YES — the `ExceptionUtils` class is `@UtilityClass` and the method is explicitly named `translateDatabaseException`. Every known unique-index name is enumerated; the per-constraint friendly message dispatch IS the curation. The `JooqReactiveOperations` wrapper applies the translation uniformly via `.onErrorMap(DataAccessException.class, ...)` — a single architectural choke point.
2. *Structural impact?* YES — affects every repository (no repository can leak raw errors), every schema migration (must coordinate with ExceptionUtils for new constraints), every controller's error surface (uniform USR-coded errors), and the operator-facing error UX (resolvable=true means the UI knows to surface the message as user-correctable).
3. *Refactoring or structural?* STRUCTURAL — switching to per-repository error handling, or to a generic "all DB errors are 500", would require rewriting every repository, every controller, and the error-code contract. The chokepoint is architectural.
→ ADR-CANDIDATE.

**Evidence**:
- `ReactivePolicyRepositoryImpl.md` says: "Unique-constraint violations from the DB are translated to a project-specific `UniqueConstraintException` carrying a HUMAN-READABLE message keyed by index name — NOT propagated as the raw jOOQ DataAccessException — through a centralised translation layer (`ExceptionUtils.translateDatabaseException`) wired into every R2DBC query via `JooqReactiveOperations`'s `.onErrorMap(DataAccessException.class, ...)`. The decision is uniform: every Reactive*Repository inherits this translation; no repository can leak raw Postgres errors to the API layer."
- `ReactiveOwnershipRepositoryImpl.md` says: "**Duplicate-prevention is database-constraint-driven, with friendly-error translation at the repository utility layer.** ... This is a **deliberate two-layer pattern**: DB enforces the invariant; the repository wrapper translates DB-level errors to application-level errors with HTTP-mapping-friendly types."
- `JooqReactiveOperations.java:41, 48` — the `.onErrorMap` registration on both `.mono(...)` and `.flux(...)`
- `ExceptionUtils.java:30-36` — the dispatch shape
- `ExceptionUtils.java:38-83` — the curated per-constraint enumeration
- `ControllerAdvice.java:36-40` — the HTTP 400 mapping

**Existing ADR**: none. Composes with:
- **ADR-CANDIDATE-070** (NEW — partial unique index for soft-delete-aware name recreation) — the DB-layer enforcement that this ADR's translation surface relies on.
- **ADR-CANDIDATE-068** (NEW — two-tier soft-delete taxonomy) — the soft-delete model that produces the "duplicate after recreate" UX flow.
- **ADR-CANDIDATE-001** (existing — controllers-as-delegates) — the controller layer relies on the typed exceptions; ControllerAdvice does the HTTP mapping.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-232 (cross-batch correction: createOwnership duplicate-key is HTTP 400 + USR003, NOT 5xx as batch-F stated; the misclaim corrects via this ADR's translation pattern).
- The translation table is INCOMPLETE: future schema migrations adding new constraints without a matching `ExceptionUtils` branch will fall through to generic `DatabaseException` (HTTP 500). This is a maintenance-discipline gap; not a separate scope today but worth surfacing in the ADR doc.

**Proposed action**: Promote to `adrs/drafts/centralised-db-error-translation.md` (new ADR). Document:
- The wiring (`JooqReactiveOperations.mono/.flux` → `.onErrorMap` → `ExceptionUtils.translateDatabaseException`).
- The curated per-constraint enumeration (the canonical pattern; every new constraint gets a branch).
- The typed-exception → HTTP-mapping contract (UniqueConstraintException → 400 USR003; future error types follow the same shape).
- The maintenance discipline (schema migrations + ExceptionUtils updates are paired; reviewers check both).
- The operator UX consequence (errors are user-actionable; the platform never returns raw Postgres errors).

Cross-link with ADR-CANDIDATE-001 (controller-layer) — the typed exceptions are the contract handed off from the repository wrapper to the controller advice.

**Severity rationale**: HIGH — codebase-wide error-handling architecture. Affects every repository, every controller error surface, every schema migration, every operator-facing error message. Compatible-change calculus for any future maintainer requires understanding this translation pattern.

---

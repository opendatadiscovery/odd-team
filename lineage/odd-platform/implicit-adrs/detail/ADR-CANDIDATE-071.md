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
- `policy_name_unique` → `"Policy with this name already exists"` (lines ~58-60).
- `role_name_unique` → `"Role with this name already exists"` (lines 57-59).
- `OWNERSHIP_DATA_ENTITY_ID_OWNER_ID_KEY` → `"Owner is already attached to this data entity"` (paraphrased per Ownership sidecar).
- Plus the parallel branches for `owner_name`, `namespace_name`, `data_source_name`, `collector_name`, `tag_name`, `title_name`, `term_name_namespace` — every named-entity table's partial-unique-index gets a branch.

The architectural choices encoded:
- **(a)** Centralisation at the connection wrapper. The translation lives in ONE place; every repository's queries inherit the contract by construction. A repository CANNOT bypass the translation (it would have to instantiate its own `DatabaseClient`, which the platform's DI does not provide).
- **(b)** Per-constraint name-keyed dispatch. The constraint name is the only piece of structured data Postgres surfaces on a 23505 error; the translation table is a curated enumeration of every known constraint name. The pattern is a static-dispatch table, not a regex parser.
- **(c)** Typed exceptions → HTTP-status mapping at the controller advice layer. `UniqueConstraintException` → 400 BadRequest with USR003 error code (per the controller advice). The repository never decides the HTTP status; the typed exception is the contract handed off to the controller advice.
- **(d)** The platform never returns raw Postgres error text to the API consumer. Every error surface is operator-actionable or user-recoverable.

**Wisdom test**: PASS. All three questions resolve toward ADR:
1. *Intentional?* YES — the `@UtilityClass`-annotated `ExceptionUtils` is named for the purpose; the curated 50-line constraint-name enumeration is documented-as-code. The `onErrorMap` wiring at `JooqReactiveOperations.java:41, 48` is the structural anchor.
2. *Structural impact?* YES — affects every repository's error surface, every controller advice's exception-handling contract, every operator-facing error message, every schema migration's reviewer discipline (a new constraint without an `ExceptionUtils` branch silently falls through to 500).
3. *Refactoring or structural?* STRUCTURAL — switching to "let raw `DataAccessException` propagate" would force every controller method to handle Postgres-specific exception types, distributing the translation responsibility across 50+ controllers. The centralised pattern IS the architecture.

**Evidence**:
- `ReactivePolicyRepositoryImpl.md` says: "Unique-constraint violations from the DB are translated to a project-specific `UniqueConstraintException` carrying a HUMAN-READABLE message keyed by index name — NOT propagated as the raw jOOQ DataAccessException — through a centralised translation layer..."
- `ReactiveOwnershipRepositoryImpl.md` says: "Database errors are translated centrally via `ExceptionUtils.translateDatabaseException` to typed application exceptions (`UniqueConstraintException` with a per-index-keyed message); the `OWNERSHIP_DATA_ENTITY_ID_OWNER_ID_KEY` branch produces an operator-friendly message."
- `JooqReactiveOperations.java:41, 48` — the `.onErrorMap(DataAccessException.class, ExceptionUtils::translateDatabaseException)` chain
- `ExceptionUtils.java:30-83` — the curated translation table

**Existing ADR**: none. Composes with:
- **ADR-CANDIDATE-068** (NEW — two-tier soft-delete) — soft-delete-aware uniqueness violations all flow through this translation table.
- **ADR-CANDIDATE-070** (NEW — partial unique index) — the index names this translation table maps from.
- ADR-CANDIDATE-001 (existing — controllers as delegates) — the typed exceptions are the contract the controller delegate hands off to the controller advice.

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

## STRENGTHENS — Batch N (Role primary-source — `role_name_unique` curated branch verified at ExceptionUtils.java:57-59)

**One additional batch-N repository sidecar confirms the per-constraint name-keyed translation pattern at the Role mutation surface**:

**ReactiveRoleRepositoryImpl** — Role's duplicate-name handling traces explicitly through this ADR's chokepoint. The sidecar's implicit_adrs[2] says: "Unique-constraint violations from the DB are translated to a project-specific `UniqueConstraintException` carrying a HUMAN-READABLE message keyed by index name ... ExceptionUtils.java:57-59 (ROLE_NAME_UNIQUE → 'Role with this name already exists')". The Role-specific branch JOIN this ADR's curated enumeration; the maintainer reading `ExceptionUtils.java` can see Owner / Namespace / DataSource / Collector / Tag / Role / Policy / Title / Term variants all enumerated at lines 39-82 — a long curated table that is the per-table evidence of the centralised translation discipline.

**Cross-table consistency observation (batch N)**: The translation table is now triangulated against THREE primary-source repositories — Policy (batch H), Ownership (batch I), Role (batch N). Each repository's sidecar names a specific `ExceptionUtils` branch verbatim. The maintainer-extension contract is the curated enumeration: every new constraint needs a matching branch.

**New batch-N maintainer-discipline gap surfaced**:
- The Role duplicate-name flow goes UnconstraintException → HTTP status (400/409 per the GlobalExceptionHandler chain, NOT verified by tests). The Role-sidecar's bugs_limitations_corner_cases[5] notes the HTTP status mapping is unverified; this is the same maintenance-discipline gap noted in the existing co-surfaced gaps list (no test pins the contract). Not a new scope; documented as the existing gap.

**Severity unchanged**: HIGH — the Role evidence reinforces the codebase-wide claim. The translation table is now confirmed across 9+ tables (every named-entity); the pattern is uniform.

---

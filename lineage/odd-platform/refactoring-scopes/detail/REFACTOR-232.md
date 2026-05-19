## REFACTOR-232 — Cross-batch correction: `createOwnership` duplicate-key surfaces as HTTP 400 + USR003, NOT 5xx as batch-F stated; the ExceptionUtils translation path is the canonical fix-up

**Severity**: MEDIUM (cross-batch correction-priority)
**Category**: error-mapping (correction of prior sidecar misclaim)
**Surfaced by**:
- `ReactiveOwnershipRepositoryImpl.md:bugs_limitations_corner_cases[7]` (explicit cross-batch correction)
- `ReactiveOwnershipRepositoryImpl.md:docs_link_semantic.doc_drift_findings[2]`
- `ReactiveOwnershipRepositoryImpl.md:implicit_adrs[1]` (the deliberate DB-constraint + translation pattern)

**Description**: The batch-F sidecar `odd-platform__java__DataEntityController__controller-method__createOwnership.md:bugs_limitations_corner_cases[2]` (line 149 of that file) stated that the duplicate-key path surfaces as a 5xx response. This is **incorrect at the SQL-primary-source level**. The actual surface is HTTP 400 with `USR003` and the friendly message `'Ownership for this data entity and owner already exists'`.

The translation path (from primary source):
1. `ReactiveOwnershipRepositoryImpl.create` (line 52-58) issues a plain `INSERT INTO ownership ... RETURNING` — NO `ON CONFLICT` clause.
2. The DB enforces the constraint `UNIQUE (data_entity_id, owner_id)` via `OWNERSHIP_DATA_ENTITY_ID_OWNER_ID_KEY` (`V0_0_3__add_ownership.sql:17`); duplicate INSERT raises Postgres SQLSTATE 23505.
3. `JooqReactiveOperations.mono` wraps every query with `.onErrorMap(DataAccessException.class, ExceptionUtils::translateDatabaseException)` (`JooqReactiveOperations.java:41`).
4. `ExceptionUtils.translateDatabaseException` (lines 30-36) inspects the `SQLStateClass.C23` integrity violations and dispatches via `formatMessage` (lines 38-83).
5. The per-constraint branch at lines 69-71 explicitly matches `OWNERSHIP_DATA_ENTITY_ID_OWNER_ID_KEY.getName()` and returns the message `'Ownership for this data entity and owner already exists'`.
6. The wrapping `UniqueConstraintException` (`UniqueConstraintException.java:5`) carries `ErrorCode.UNIQUE_CONSTRAINT` (`ErrorCode.java:11` — `code=USR003`, `resolvable=true`).
7. `ControllerAdvice.handleUniqueConstraintException` (lines 36-40) maps `UniqueConstraintException` → HTTP 400 + the resolvable error code surface.

The misclaim in the batch-F sidecar — that the surface is 5xx — would have propagated to downstream artefacts (DOC-NNN drafts, API-reference docs, integration-test expectations). The correction now in the substrate is the canonical record.

**Primary source citations**:
- `ReactiveOwnershipRepositoryImpl.java:52-58` — plain INSERT (no ON CONFLICT)
- `V0_0_3__add_ownership.sql:17` — the UNIQUE constraint
- `JooqReactiveOperations.java:41, 48` — `.onErrorMap(DataAccessException.class, ExceptionUtils::translateDatabaseException)` wired on both `.mono(...)` and `.flux(...)`
- `ExceptionUtils.java:30-36` — `translateDatabaseException` dispatch
- `ExceptionUtils.java:69-71` — the OWNERSHIP-specific friendly message branch
- `UniqueConstraintException.java:5` + `ErrorCode.java:11` — the typed exception + USR003 code
- `ControllerAdvice.java:36-40` — the HTTP 400 mapping
- contrast: the batch-F sidecar `createOwnership.md:bugs_limitations_corner_cases[2]` line 149 (the original misclaim)

**Existing-ADR-or-implied-prescription**: This finding feeds ADR-CANDIDATE-071 (NEW — centralised DB-error translation via `ExceptionUtils.translateDatabaseException` wired in `JooqReactiveOperations.onErrorMap`). The translation pattern is the architectural intent; the scope here is the cross-batch correction propagation.

**Proposed remedy**: Two-part:
1. **Substrate correction**: the existing batch-F sidecar `createOwnership.md:bugs_limitations_corner_cases[2]` should be updated to state HTTP 400 + USR003 + friendly message, not 5xx. The maintainer can re-run `/enrich --node createOwnership` to pick up the correction, or manually update the sidecar's bugs_limitations_corner_cases entry. The downstream artefacts (`implicit-adrs.md` Refresh notes, `refactoring-scopes.md`, the alerts retrospective if any, DOC-NNN drafts) inherit the misclaim and should be re-derived after the substrate update.
2. **Documentation**: add a paragraph to the live API-reference page for `POST /api/dataentities/{id}/ownership` explicitly stating: "Returns HTTP 400 with error code `USR003` and message 'Ownership for this data entity and owner already exists' if (data_entity_id, owner_id) collides with an existing live ownership row." This shape applies to all UniqueConstraintException paths across the platform — there is a class-wide DOC-NNN candidate for an "Error codes reference" page that lists USR003 (UNIQUE_CONSTRAINT), USR001 (BAD_REQUEST), USR002 (NOT_FOUND), USR004 (cascade-delete), etc.

**Severity rationale**: MEDIUM (correction-priority) — the misclaim itself is not a security issue, but cross-batch errors propagate silently through the substrate. A maintainer reading downstream artefacts would believe duplicates are 5xx (operations-facing impact: "duplicates are server errors and need alerting") when they are actually 400 USR003 (user-resolvable). The cost is misallocated triage and incorrect doc-product content.

**Suggested backlog grouping**: `Substrate correction sprint` (slice 8+ cross-batch propagation) + `DOC-NNN error-codes reference page` (the broader doc-product gap).

---

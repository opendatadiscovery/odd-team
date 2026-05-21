## REFACTOR-589 — `PUT /api/datasources/{id}/token` on a data source whose `token` is null surfaces as an opaque HTTP 500 — a `data_source` row whose `token_id` points at a missing/deleted token NPEs or throws `RuntimeException("Token is null")` with no actionable message

**Severity**: LOW
**Category**: error-mapping (opaque 500 on a data-integrity edge)
**Pillars affected**: [P-08 (Data-Source Lifecycle Management)]
**related_features**: [F-008]
**Batch**: ZB (2026-05-21)

**Surfaced by**:
- `odd-platform__java__DataSourceController__controller-method__regenerateDataSourceToken.md:bugs_limitations_corner_cases.[7]` (LOW) — "If the resolved data source's `token` is null (a `data_source` row whose `token_id` points at a missing/deleted token), `tokenGenerator.regenerateToken(dto.token().tokenPojo())` first NPEs on `dto.token()` being null OR `TokenGeneratorImpl.regenerate` throws `RuntimeException(\"Token is null\")` (line 45-47). Either way the operator gets an opaque HTTP 500 'Internal Server Error' (`ControllerAdvice.java:61-66`) with no actionable message — the data source cannot have its token rotated and the error does not say why."
- `odd-platform__java__DataSourceController__controller-method__regenerateDataSourceToken.md:concepts.invariants.[4]` — "`RuntimeException(\"Token is null\")` if the resolved data source has no token row (`TokenGeneratorImpl.java:45-47`) — maps to HTTP 500 via the catch-all `ControllerAdvice` handler (`ControllerAdvice.java:61-66`)."
- `odd-platform__java__DataSourceController__controller-method__regenerateDataSourceToken.md:tests_coverage_semantic` (the uncovered behaviour — "500 when the resolved data source has a null token ... This is an unguarded data-integrity edge").

**Description**: `DataSourceServiceImpl.regenerateDataSourceToken` (lines 99-106) loads the `DataSourceDto` then calls `tokenGenerator.regenerateToken(dto.token().tokenPojo())` (line 102). If the resolved data source's `token` is null — a `data_source` row whose `token_id` FK points at a missing or deleted `token` row — line 102 either NPEs on `dto.token()` being null, OR `TokenGeneratorImpl.regenerate` (lines 45-47) throws `RuntimeException("Token is null")`. Either failure falls through to `ControllerAdvice`'s catch-all generic `Exception` handler (`ControllerAdvice.java:61-66`) → HTTP 500 "Internal Server Error" with no actionable message. The operator sees a generic 500 and has no indication that the data source's token row is missing or what to do about it. This is an unguarded data-integrity edge — it should not normally occur (every data source is born with a token per ADR-CANDIDATE-017's batch-ZB facet), but if a `token` row is somehow orphaned-out or a migration leaves a dangling `token_id`, the rotation endpoint fails opaquely.

NOTE this is RELATED to but distinct from REFACTOR-581 (orphan token on data-source DELETE): REFACTOR-581 is the `token` row LEFT BEHIND after the `data_source` is deleted; REFACTOR-589 is the inverse-ish edge — a LIVE `data_source` whose `token` is MISSING, hitting the rotation endpoint. Both are `token`↔`data_source` referential-integrity edges; this one is the error-mapping gap on the rotation path.

**Primary source citations**:
- `DataSourceServiceImpl.java:102` (`dto.token().tokenPojo()` — no null guard on `dto.token()`)
- `TokenGeneratorImpl.java:45-47` (`RuntimeException("Token is null")`)
- `ControllerAdvice.java:61-66` (the catch-all generic `Exception` → HTTP 500 handler)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-071 (centralised DB-error translation via `ExceptionUtils.translateDatabaseException` wired in `JooqReactiveOperations.onErrorMap` — every Reactive*Repository inherits HTTP-friendly errors) — the platform DOES have a centralised error-translation pattern that turns DB-layer exceptions into HTTP-friendly ones. But `RuntimeException("Token is null")` is thrown in the SERVICE/GENERATOR tier (`TokenGeneratorImpl`), not the repository tier, so it is NOT caught by the `JooqReactiveOperations.onErrorMap` translation — it falls through to the generic 500 handler. The gap is that a foreseeable data-integrity edge produces an opaque, un-translated 500; the absence of a specific handler / friendly message has no stated rationale.

**Proposed remedy**: Add a null-check on `dto.token()` in `DataSourceServiceImpl.regenerateDataSourceToken` (or in `TokenGeneratorImpl.regenerate`) that throws a typed exception mapped to a meaningful HTTP status with an actionable message — e.g. a `NotFoundException("Token", dataSourceId)` → HTTP 404 with "Data source has no token row; the data source may be corrupted — re-register it" or similar. At minimum, change the generic `RuntimeException("Token is null")` to a `ControllerAdvice`-mapped typed exception so the operator gets a 4xx with a clear message instead of an opaque 500.

**Severity rationale**: LOW — a data-integrity edge that should not normally occur (ADR-CANDIDATE-017's batch-ZB facet establishes every data source is born with exactly one token); the gap is purely the OPAQUE failure mode — an unhelpful 500 — when the edge IS hit. Not a functional bug in the happy path; an error-message-quality / operator-diagnosability gap.

**Suggested backlog grouping**: `DOC-NNN / error-mapping hygiene` — a small typed-exception + `ControllerAdvice` handler addition; pair with the broader error-mapping cluster (REFACTOR-232 and the other `ControllerAdvice`-translation gaps).

---

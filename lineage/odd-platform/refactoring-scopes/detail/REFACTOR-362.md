## REFACTOR-362 — `ReactiveTermRepositoryImpl.countByState` JOINs `TERM_SEARCH_ENTRYPOINT` unconditionally, while `findByState` JOINs it CONDITIONAL on `state.getQuery()` — count-vs-list desync when a Term is missing from `term_search_entrypoint`; the count under-reports

**Severity**: MEDIUM
**Category**: missing-defence-in-depth (count-vs-list pagination contract violation)
**Surfaced by**: `ReactiveTermRepositoryImpl.md:bugs_limitations_corner_cases[7]` + `ReactiveTermRepositoryImpl.md:performance.known_performance_gaps[2]`

**Description**: `findByState(state, page, size)` at lines 272-355 conditionally joins `TERM_SEARCH_ENTRYPOINT` based on `StringUtils.isNotEmpty(state.getQuery())` (lines 296-298). The corresponding count query `countByState(state)` at lines 358-375 joins `TERM_SEARCH_ENTRYPOINT` UNCONDITIONALLY at line 361 (`.join(TERM_SEARCH_ENTRYPOINT).on(TERM_SEARCH_ENTRYPOINT.TERM_ID.eq(TERM.ID))`); the FTS predicate is only ADDED inside `if (StringUtils.isNotEmpty(state.getQuery()))` at line 369.

**The asymmetry is subtle but consequential**:
- For state WITHOUT a query (no FTS predicate): `findByState` does NOT join `TERM_SEARCH_ENTRYPOINT` — every non-deleted Term is paginated. `countByState` DOES join — only Terms with a row in `term_search_entrypoint` are counted.
- For state WITH a query: both methods join + apply the FTS predicate — symmetric.

**In normal operation every Term has a corresponding `term_search_entrypoint` row** — `TermServiceImpl.updateSearchVectors` (lines 324-329) creates the row on every Term create/update. The asymmetry is therefore a no-op in healthy operation.

**The bug surface**: any Term created via a path that bypasses `updateSearchVectors`:
- Future ingestion-side Term creation (currently TermServiceImpl is not invoked from any IngestionRequestProcessor — but a future feature might).
- Direct DB INSERT (operator hot-fix; admin tool).
- A future refactor that splits `updateSearchVectors` into a separate write path.

Such a Term:
- Appears in `findByState`'s paginated list (no FTS join when query is empty).
- Does NOT appear in `countByState`'s total (FTS join filters it out).

**The user-visible consequence**: the UI's pagination ceiling is WRONG. A search with no query shows N Terms in the list but `total = N - {missing-FTS-row-count}`. Pagination's last page may show "page 3 of 2" or similar.

**Primary source citations**:
- `ReactiveTermRepositoryImpl.java:296-298` — findByState conditional join
- `ReactiveTermRepositoryImpl.java:361` — countByState unconditional join
- `TermServiceImpl.java:324-329` — the FTS-vector refresh that normally keeps the symmetric assumption true

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-123 NEW (CTE-first paginate-then-aggregate) implicitly requires count-vs-list symmetry as part of the maintainer-extension contract for `pageifyResult`. This scope is the contract failure at the count side.

**Proposed remedy**: Make the count query symmetric:

```java
// Before (line 361 — unconditional):
.join(TERM_SEARCH_ENTRYPOINT).on(TERM_SEARCH_ENTRYPOINT.TERM_ID.eq(TERM.ID))

// After (conditional on query, matching findByState lines 296-298):
if (StringUtils.isNotEmpty(state.getQuery())) {
  query = query.join(TERM_SEARCH_ENTRYPOINT).on(...);
}
```

Add an integration test that creates a Term WITHOUT calling `updateSearchVectors` and asserts `countByState(stateWithoutQuery) >= findByState(stateWithoutQuery).total`.

**Severity rationale**: MEDIUM — pagination-contract regression. Today the case is theoretical (every Term has an FTS row). A future feature that creates Terms via a non-service-tier path (or a partial-transaction-failure that commits the Term INSERT but rolls back the FTS-vector INSERT) would surface the count-vs-list desync. The fix is small and architecturally aligned (the symmetric pattern is already used in `findByState`).

**Suggested backlog grouping**: `Glossary-tier hardening sprint` — pair with REFACTOR-363 (listTermRefDtos count-vs-list filter mismatch). Both are count-vs-list contract failures on the same repository.

---

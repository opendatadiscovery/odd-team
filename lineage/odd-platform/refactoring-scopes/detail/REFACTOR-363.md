## REFACTOR-363 — `ReactiveTermRepositoryImpl.listTermRefDtos` uses inherited `fetchCount(nameQuery)` for `total`, which ignores the `updatedAt` date-range filter that the paginated list DOES respect — UI shows a `total` that is HIGHER than the actual filtered result count

**Severity**: MEDIUM
**Category**: missing-defence-in-depth (count-vs-list pagination contract violation; mirror of REFACTOR-362)
**Surfaced by**: `ReactiveTermRepositoryImpl.md:bugs_limitations_corner_cases[10]` + `ReactiveTermRepositoryImpl.md:performance.known_performance_gaps[3]`

**Description**: `ReactiveTermRepositoryImpl.listTermRefDtos(page, size, nameQuery, updatedAtStart, updatedAtEnd)` (lines 108-135) builds a paginated SELECT with THREE filter predicates: name substring (via `listCondition(nameQuery)`), `updated_at >= updatedAtStart`, and `updated_at <= updatedAtEnd` (lines 113-114). The count side (line 133) calls `fetchCount(nameQuery)` inherited from `ReactiveAbstractCRUDRepository` via the soft-delete base's override — issuing `SELECT COUNT(*) FROM term WHERE name ILIKE %?% AND deleted_at IS NULL`.

**The count query does NOT include the `updatedAt` predicates**. A caller paginating with date filters sees:
- List: `[term1, term2, term3]` (filtered to the date range).
- Total: `47` (the count of name-matching, non-deleted Terms — regardless of date).

Pagination's last-page math is wrong; the UI's "Page X of Y" display is wrong; an operator scrolling reaches an empty page before the displayed total is hit.

**Compared to REFACTOR-362**: REFACTOR-362 is the count-vs-list desync at the FTS-join layer for `findByState` / `countByState`; this scope is the count-vs-list filter-mismatch at the date-range layer for `listTermRefDtos`. Two different methods in the SAME repository BOTH violate the same architectural contract (CTE-first paginate-then-aggregate per ADR-CANDIDATE-123 NEW requires symmetric count) for two different reasons.

**Primary source citations**:
- `ReactiveTermRepositoryImpl.java:113-114` — the updatedAt predicates in the list
- `ReactiveTermRepositoryImpl.java:133` — the inherited fetchCount(nameQuery) at the count side
- `ReactiveAbstractCRUDRepository.fetchCount(query)` — the inherited signature that only takes the name predicate
- Cross-batch: ADR-CANDIDATE-123 NEW (the count-side symmetry contract)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-123 NEW (CTE-first paginate-then-aggregate) prescribes that the count query MUST share the homogeneousQuery predicates. This scope is the contract failure where the inherited `fetchCount` only accepts the name predicate, missing the updatedAt range.

**Proposed remedy**: Replace the inherited `fetchCount(nameQuery)` with a custom count query that mirrors the list predicates:

```java
// Before (line 133 paraphrased):
.pageifyResult(stream, () -> fetchCount(nameQuery))

// After:
.pageifyResult(stream, () -> jooqReactiveOperations.mono(
    DSL.selectCount().from(TERM)
        .where(listCondition(nameQuery)
            .and(updatedAtStart != null ? TERM.UPDATED_AT.greaterOrEqual(updatedAtStart) : noCondition())
            .and(updatedAtEnd != null ? TERM.UPDATED_AT.lessOrEqual(updatedAtEnd) : noCondition())
            .and(addSoftDeleteFilter()))
).map(...))
```

The alternative is to extend the base class's `fetchCount` signature to accept an additional `Condition` parameter — a more invasive refactor but applicable to other repositories with similar count-vs-list filter mismatches.

Add a regression test that:
1. Creates 10 Terms updated at T1 + 10 Terms updated at T2.
2. Calls `listTermRefDtos(page=1, size=5, nameQuery=null, updatedAtStart=T2-1s, updatedAtEnd=T2+1s)`.
3. Asserts `total == 10` (NOT 20).

**Severity rationale**: MEDIUM — UI-pagination-correctness regression. Today's UI's Glossary tab pagination + date filter combination exhibits this; operator-visible. The fix is small (one method override) and architecturally aligned.

**Suggested backlog grouping**: `Glossary-tier hardening sprint` — pair with REFACTOR-362 (the FTS-join count-vs-list desync). Both are count-vs-list contract failures on the same repository.

---

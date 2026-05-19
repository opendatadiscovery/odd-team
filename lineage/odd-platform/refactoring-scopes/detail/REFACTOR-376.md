## REFACTOR-376 — Three CTEs in ReactiveTermRepositoryImpl share the same `term_cte` alias — jOOQ accepts because each query is independently composed; refactor introducing recursive CTE shapes or shared substitution helpers would surface the name collision

**Severity**: LOW
**Category**: refactor-risk (cosmetic refactoring brittleness)
**Surfaced by**: `ReactiveTermRepositoryImpl.md:bugs_limitations_corner_cases[8]`

**Description**: Lines 119, 318, 472, 509 of `ReactiveTermRepositoryImpl` all build CTEs named `term_cte`. jOOQ accepts the reuse because each query is independently composed — the CTE name is local to its own query's compilation. But a future refactor introducing recursive CTE shapes (multiple CTEs per query) or shared substitution helpers (a method that builds a CTE for multiple callers) would surface the name collision.

**Primary source citations**:
- `ReactiveTermRepositoryImpl.java:119, 318, 472, 509`

**Proposed remedy**: Declare a constant `private static final String TERM_CTE = "term_cte";` and reuse — gives one symbol to grep for, no name collision risk.

**Severity rationale**: LOW — cosmetic refactoring brittleness; no impact today.

**Suggested backlog grouping**: `Code hygiene` — small refactor.

---

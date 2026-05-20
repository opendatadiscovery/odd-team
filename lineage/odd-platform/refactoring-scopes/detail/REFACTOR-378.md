## REFACTOR-378 — Tag `listMostPopular` CTE name `tag_cte` is hardcoded — no current caller composes them as subqueries of a parent, but a future caller might surface the collision

**Severity**: LOW
**Category**: refactor-risk (cosmetic refactoring brittleness; mirror of REFACTOR-376)
**Surfaced by**: `ReactiveTagRepositoryImpl.md:bugs_limitations_corner_cases[7]`

**Description**: `ReactiveTagRepositoryImpl.listMostPopular` (lines 150, 373-392) names its CTE `tag_cte` (hardcoded). If two `listMostPopular` queries were composed (e.g., as subqueries of a parent), the inner CTE would collide. No current caller composes them. Mirror of REFACTOR-376 (the Term-repository version of the same pattern).

**Primary source citations**:
- `ReactiveTagRepositoryImpl.java:150, 373-392`

**Proposed remedy**: Declare a constant `private static final String TAG_CTE = "tag_cte";` and reuse — single grep point + no name collision risk.

**Severity rationale**: LOW — cosmetic; pairs with REFACTOR-376.

**Suggested backlog grouping**: `Code hygiene` — small refactor.

---

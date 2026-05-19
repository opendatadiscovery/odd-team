## REFACTOR-374 — `SUGGESTION_LIMIT = 5` is hardcoded on Term query-suggestions API; UI consumers wanting 10 suggestions cannot get them without code change; asymmetric with `findByState` which paginates

**Severity**: LOW
**Category**: missing-configurability
**Surfaced by**: `ReactiveTermRepositoryImpl.md:bugs_limitations_corner_cases[5]`

**Description**: `ReactiveTermRepositoryImpl.getQuerySuggestions` (line 82 + 259) hardcodes `SUGGESTION_LIMIT = 5`. The query-suggestions API returns at most 5 Terms regardless of caller preference. Compare `findByState` which paginates.

The asymmetry vs `findByState` is unjustified by any inline comment or doc. A future UI requirement for "show 10 suggestions" or "make the limit operator-configurable" would require a code change.

**Primary source citations**:
- `ReactiveTermRepositoryImpl.java:82, 259`

**Existing-ADR-or-implied-prescription**: none. The 5-limit predates any documented ADR.

**Proposed remedy**: Either:
1. Make `SUGGESTION_LIMIT` configurable via `@Value("${odd.term.suggestion-limit:5}")`.
2. Accept the limit as a method parameter and let the caller decide (with a default of 5).
3. Document the hardcoded limit in the OpenAPI spec (`maxItems: 5` on the response array).

Option 3 is the smallest documentation fix; Option 1 is the operator-configurable fix.

**Severity rationale**: LOW — UX/feature limitation; no security or correctness impact.

**Suggested backlog grouping**: `Glossary-tier hardening sprint` or `Code hygiene`.

---

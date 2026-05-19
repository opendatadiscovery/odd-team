## REFACTOR-229 — SQL-format injection vector in `ReactiveDataEntityRepositoryImpl.getHighlightedResult` via `String.formatted(text, tsQuery)` on user-writable inputs

**Severity**: HIGH
**Category**: missing-sanitisation + injection
**Surfaced by**:
- `ReactiveDataEntityRepositoryImpl.md:bugs_limitations_corner_cases[0]`
- `ReactiveDataEntityRepositoryImpl.md:security.known_security_gaps[0]`
- `ReactiveDataEntityRepositoryImpl.md:concepts.invariants[6]`

**Description**: `getHighlightedResult` (`ReactiveDataEntityRepositoryImpl.java:799-806`) builds raw SQL by calling `String.formatted(text, tsQuery)` and feeds the resulting string into `DSL.field(sql, String.class)`. The two `%s` slots accept:

- **`text`** — the server-assembled `searchableString` produced by `DataEntityHighlightConverter.convert(...)` (`DataEntityHighlightServiceImpl.java:43-44`). This string CONCATENATES user-writable data-entity fields: `internal_name`, `internal_description`, tag names, term mentions. A caller with `DATA_ENTITY_DESCRIPTION_UPDATE` (or `auth.type=DISABLED`) can write content that lands verbatim into the SQL string literal slot of `ts_headline('english', '%s', ...)`. A description containing `\\'); DROP TABLE data_entity; --` would break out of the SQL string literal at format-time.
- **`query`** — the user search query routed through `JooqFTSHelper.tsQuery` (`JooqFTSHelper.java:164-168`) which only does `plainQuery.split(" ").map(w -> w + ":*").join("&")` — NO single-quote escaping, NO `to_tsquery` builder. A search of `\\'\\)\\)|x'='` lands into the second `%s` slot.

The exposure is dual: WRITE-side (description / name / tag write) seeds a malicious payload into the database; READ-side (any user who triggers a highlight render via `GET /api/dataentities/{id}/highlight` or the search-with-highlight flow) detonates the payload. The injection is gated by `DATA_ENTITY_VIEW` on the read and `DATA_ENTITY_DESCRIPTION_UPDATE` on the write — but under `auth.type=DISABLED` (the default deployment per REFACTOR-068), both gates are bypassed: anonymous network probes can write the payload AND trigger the read.

This is the only raw-SQL-format path identified across the 5-repository batch. All other repositories use parameterised jOOQ DSL or `DSL.inline(...)` for literals. The presence of `String.formatted` in repository code is a strong code-smell that the SQL-layer review missed.

**Primary source citations**:
- `ReactiveDataEntityRepositoryImpl.java:799-806` — the `.formatted(text, tsQuery)` + `DSL.field(sql, String.class)` chain
- `JooqFTSHelper.java:164-168` — `tsQuery` does NOT escape single quotes
- `DataEntityHighlightServiceImpl.java:43-44` — `text` is server-assembled from user-controllable fields
- `DataEntityHighlightConverter` — concatenates internal_name + internal_description + tag names
- contrast: `ReactiveDataEntityRepositoryImpl.java:419-427` (`setInternalName`) and `:430-438` (`setInternalDescription`) use parameterised `.set(...)` — the safe pattern

**Existing-ADR-or-implied-prescription**: none. The platform's convention (visible at all 5 repositories in this batch) is parameterised jOOQ DSL. `getHighlightedResult` is the lone violator. The fix is structural at the implementation level (replace `String.formatted` with parameterised `DSL.field(sql, String.class, val(text), val(tsQuery))` using bound parameters) but doesn't change the architecture.

**Proposed remedy**: Three-step fix:
1. Replace `String.formatted(text, tsQuery)` with a jOOQ parameterised expression: `DSL.field("ts_headline('english', {0}, to_tsquery({1}))", String.class, val(text), val(tsQuery))`. jOOQ's `{N}` placeholders are bind-parameter-safe.
2. Update `JooqFTSHelper.tsQuery` to use `DSL.value(...)` for the search query OR sanitise single quotes / Postgres FTS metacharacters (`&`, `|`, `!`, `(`, `)`, `:`, `*`) before concatenation.
3. Add an integration test in `ReactiveDataEntityRepositoryImpl` test class (currently zero coverage per the sidecar's tests_coverage_semantic) that asserts a description containing `'); DROP TABLE data_entity; --` produces no SQL error AND no data-loss when subsequently highlighted.

The remedy is refactoring within the existing call shape — not a structural change. The architecture (FTS-driven highlight, ts_headline in Postgres) stays the same.

**Severity rationale**: HIGH — confirmed SQL-injection vector on a path that combines write-side data persistence (verbatim store via the description-write ADR-CANDIDATE-063) and read-side detonation. Under DISABLED-mode the gate is fully bypassed. The injected payload could exfiltrate the entire `policy` table (which carries every authorization rule), the `user_owner_mapping` table (OIDC usernames), or drop tables. Compared with REFACTOR-218 (markdown XSS — sanitised at the rendering layer) this finding is a backend-data-tier escape, not a UI-rendering issue.

**Suggested backlog grouping**: `SEC-NNN SQL-injection hardening sprint` — pair with `Authorization audit batch` (DISABLED-mode pre-condition) and `Repository test bootstrap` (the ReactiveDataEntityRepositoryImpl test class needs to exist before this fix lands).

---

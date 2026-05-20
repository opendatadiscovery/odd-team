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

## STRENGTHENS — Batch M (search facets aggregator — SECOND invocation site for tsquery operator injection; compounds REFACTOR-344 session-poisoning)

**SECOND INVOCATION SITE confirmed** at every facet aggregator in `ReactiveSearchFacetRepositoryImpl`. Batch M's `SearchController.facets` sidecar surfaces a separate-but-related code path that uses the SAME `JooqFTSHelper.tsQuery` (`JooqFTSHelper.java:164-168`) without escaping — `JooqFTSHelper.ftsCondition` (`JooqFTSHelper.java:100-105`) is invoked from `ReactiveSearchFacetRepositoryImpl.java:182, 267, 469, 582` (the FTS site in every facet aggregator). Where REFACTOR-229 batch H described the `String.formatted` raw-SQL angle, batch M surfaces the `to_tsquery(?)` operator-injection angle on the PERSISTED `query_string` (the field stored in `search_facets.query_string`).

**New batch-M evidence**:

1. **`SearchController.facets.md:bugs_limitations_corner_cases.[4]`** (HIGH): "**Persisted `state.getQuery()` is passed directly to `to_tsquery(?)` without escaping tsquery operators.** `JooqFTSHelper.tsQuery` (`JooqFTSHelper.java:164-168`) does `Arrays.stream(plainQuery.split(\" \")).map(q -> q + \":*\").collect(Collectors.joining(\"&\"))` — every word becomes a `prefix-match` token AND-joined. But if the persisted `query_string` contains characters that to_tsquery treats as syntax (`!`, `(`, `)`, `:`, `<->`, `&`, `|`, `'`, `\\`), they are NOT escaped before reaching the parser. A caller who POSTs a search with `query = 'foo ) | (bar'` will persist that string in `search_facets.query_string`; every subsequent facet aggregator that joins to SEARCH_ENTRYPOINT will fail at SQL-parse time with a Postgres `syntax error in tsquery`, breaking the session permanently (the row is reachable but every facet read 500s). The injection is bounded by Postgres tsquery semantics (the parser does not eval SQL — it raises `42601`), but it IS a denial-of-service surface AND it is the SAME code path that batch H flagged on `getHighlightedResult`."

2. **`SearchController.facets.md:security.known_security_gaps.[2]`** (HIGH): "**tsquery-operator injection on persisted `query_string` → SQL parser DoS.** `JooqFTSHelper.tsQuery` (`JooqFTSHelper.java:164-168`) does not escape tsquery operators; persisted `query_string` reaches `to_tsquery(?)` directly (`JooqFTSHelper.java:100-105`). A caller who POSTs a search with `query='foo )('` persists the row, then every subsequent facet aggregator that runs on that row's state fails at `to_tsquery` parse time. The session becomes permanently broken (the row is reachable but every facet read 500s). The same code path is the source of batch H finding on `getHighlightedResult`; the facet endpoints are a SECOND invocation site for the same shape."

**Two-batch invocation-site catalogue**:

| Batch | Invocation site | Vector | Impact |
|---|---|---|---|
| Batch H | `ReactiveDataEntityRepositoryImpl.getHighlightedResult` (`:799-806`) | `String.formatted(text, tsQuery)` raw-SQL injection | SQL injection (table drop, policy exfiltration); the canonical finding |
| **Batch M** | **`ReactiveSearchFacetRepositoryImpl` facet aggregators** (`:182, :267, :469, :582`) via `JooqFTSHelper.ftsCondition` (`:100-105`) | **`to_tsquery(?)` parser DoS on persisted `query_string`** | **Permanent session breakage; every facet read 500s for the poisoned session UUID; combined with REFACTOR-344 (`search_facets` has no user binding) means an attacker who poisons a session UUID breaks facet reads for any user who knows that UUID** |

**Compounding factor — REFACTOR-344 cross-link**: The batch-M facet-aggregator invocation site COMPOUNDS with the bearer-token-shaped session vulnerability (REFACTOR-344 NEW). An attacker can:
1. `POST /api/search` with `query='foo )('` to create a poisoned session UUID.
2. The session UUID is reachable by any authenticated user who knows it (no user binding per REFACTOR-344).
3. Anyone who tries to read the session's facets (`GET /api/search/{poisoned_uuid}/facet/{any}`) hits the `to_tsquery` parse error → HTTP 500.
4. The session is **permanently broken**; there is no operator-side cleanup (the `last_accessed_at` timestamp is updated but no housekeeping deletes the row).

The poison-session attack vector is real and operator-actionable: a malicious caller poisons N session UUIDs, then either shares them (in a bug report, chat, screenshot URL bar) or somehow induces other users to receive them (e.g. via a malicious browser extension that intercepts URLs). The cure is the same as batch H's: escape tsquery operators in `JooqFTSHelper.tsQuery` OR use `DSL.value(...)` to parameterise.

**Architectural alignment**: The fix scope expands from "patch the one `String.formatted` call in getHighlightedResult" to "patch `JooqFTSHelper.tsQuery` at the single source of truth so EVERY consumer (getHighlightedResult AND every facet aggregator AND any future `to_tsquery` consumer) benefits". The two-batch triangulation confirms the helper is the right architectural fix point.

**New cross-link**:
- **REFACTOR-344 NEW** — `search_facets` has no user binding; the compounding factor for poison-session DoS.
- **ADR-CANDIDATE-121 NEW** — search-session bearer-token-shaped at the schema layer; the architectural decision that makes session-poisoning possible.

**Severity unchanged at HIGH** — but the two-batch invocation-site catalogue widens the patch scope. The architectural fix (escape at `JooqFTSHelper.tsQuery`) is now the single load-bearing change point.

---

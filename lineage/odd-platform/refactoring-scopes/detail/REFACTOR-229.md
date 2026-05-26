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


## STRENGTHENS — Batch ZL (2026-05-26 — Search.tsx UI page-root adds the FOURTH invocation layer; the UI performs ZERO sanitisation of typed search-query text before dispatching to `JooqFTSHelper.tsQuery` → `to_tsquery(?)` → SQL-format-interpolation site)

The Search.tsx UI page-root sidecar surfaces the FTS-injection / SQL-injection chain at the OUTERMOST layer — the UI that the operator types into. Search.tsx is the consumer that ROUTES typed text into the JooqFTSHelper.tsQuery code path; this confirms the UI does NO client-side sanitisation, NO max-length, NO metacharacter filter, NO `to_tsquery` validation. The injection sink is reachable from the operator's keyboard.

**New surfaced_by entry**:

- `odd-platform__ts__react-component__component__Search.md:bugs_limitations_corner_cases[8]` (HIGH) — "**FTS-injection: typed search-query text passes UNESCAPED through to `to_tsquery(?)` — REFACTOR-229 user-controlled query text — NO client-side sanitisation here.** MainSearchInput.tsx:43-44 builds `searchFormData = {query, pageSize:30, filters:{}}` and dispatches verbatim. Server-side `JooqFTSHelper.tsQuery` at `JooqFTSHelper.java:164-168` performs `plainQuery.split(' ').map(q -> q + ':*').join('&')` — NO escaping of tsquery metacharacters (`!`, `(`, `)`, `:`, `<->`, `&`, `|`, `'`, `\\`). A typed query of `foo ) | (bar` reaches `to_tsquery(?)` and Postgres raises `42601 syntax error in tsquery`. The session UUID is then **permanently poisoned**. ... **For the `highlightDataEntity` path the same untrusted text is INTERPOLATED into a raw SQL string via `.formatted(text, tsQuery)` — TRUE SQL injection per batch-ZE TRUE-SQL-injection finding at ReactiveDataEntityRepositoryImpl.java:798-806.** Probe P-188 emitted to confirm the session-poisoning end-to-end." — severity: HIGH

- `odd-platform__ts__react-component__component__Search.md:security.known_security_gaps[1]` (HIGH) — "**FTS-injection / session-poisoning at the typed search-query field (REFACTOR-229 batch-ZE strengthening) + TRUE SQL injection at the highlight path.** ... **The UI provides ZERO mitigation** — no max-length, no metacharacter filter, no client-side `to_tsquery` validation. Search.tsx is the UI HALF of the REFACTOR-229 security finding; the architectural fix point is `JooqFTSHelper.tsQuery` (single source of truth on the server). **CRITICAL: per batch-ZE SearchController class invariants[7], the same `query` field reaches ReactiveDataEntityRepositoryImpl.getHighlightedResult at line 798-806 via `String.formatted(text, tsQuery)` — a true raw-SQL-interpolation site. This is exploitable SQL injection, not just DoS-by-syntax.** Probe P-188 emitted to pin the chain end-to-end."

**What this strengthening adds**: the prior coverage spanned three invocation sites: (Batch H) `ReactiveDataEntityRepositoryImpl.getHighlightedResult` SQL-format injection; (Batch M) `ReactiveSearchFacetRepositoryImpl` facet aggregators `to_tsquery(?)` parser DoS; (Batch ZE) `SearchController.highlightDataEntity` HTTP entry point. Batch ZL adds the FOURTH layer — the UI:

1. **The UI is the operator-keyboard surface** — Search.tsx mounts `<MainSearch placeholder={t('Search')} disableSuggestions/>` (line 80); MainSearchInput.tsx:42-48 dispatches the typed text VERBATIM through `updateDataEntitiesSearch` → `PUT /api/search/{searchId}` → backend persists `state.setQuery(query)` → JooqFTSHelper.tsQuery code path → injection sink.

2. **ZERO client-side mitigation** — no max-length on `<MainSearchInput>`, no metacharacter filter, no `to_tsquery` validation. The typed text reaches the backend AS-IS.

3. **The UI propagates the injection-eligible text to TWO sinks**:
   - The `query` field of SearchFormData → JooqFTSHelper.tsQuery → to_tsquery(?) → parser DoS (Batch M's invocation site)
   - The same query, persisted into search_facets.query_string, is later loaded by getHighlightedResult → String.formatted(text, tsQuery) → TRUE SQL injection (Batch H's invocation site)

4. **The full attacker path is now traced end-to-end**:
   - Step 1 (UI — THIS LAYER): attacker types `'); DROP TABLE policy; --` into the Catalog search bar
   - Step 2 (UI dispatch): MainSearchInput.tsx:42-48 sends the typed text as SearchFormData.query
   - Step 3 (Backend POST): SearchController.search persists the query into search_facets.query_string
   - Step 4 (Sharing): the session UUID is returned + URL-bookmarkable (per REFACTOR-344 no user binding)
   - Step 5 (Detonation): anyone (the attacker, a colleague, an external viewer) calls `/api/search/{uuid}/data_entities/{de_id}/highlights` → getHighlightedResult triggers the SQL injection
   - Step 6 (Impact): POLICY table dropped; or `pg_sleep(10)` DoS; or `SELECT password FROM ...; --` exfiltration

5. **Architectural fix expansion**: the fix scope expands again. Prior recommendation: parameterise via `DSL.field(sql, {0}, {1})` at the repository AND escape in `JooqFTSHelper.tsQuery`. Batch ZL adds: ADD UI-side validation as DEFENSE-IN-DEPTH — max-length (e.g., 256 chars), client-side metacharacter blacklist, or a client-side `validateTsQuery(text)` helper. The UI is the FIRST line of defense; absent UI-side mitigation, the entire pipeline relies on the single backend fix point.

**Triangulation count after ZL**: 4 invocation sites (was 3 — batch H repository + batch M facet aggregators + batch ZE controller; ZL adds UI page-root). The architectural fix point (JooqFTSHelper.tsQuery + repository parameterisation) is unchanged — the helper is still the single source of truth for the backend.

**Severity unchanged at HIGH** — the UI confirmation tightens the attack-path understanding without changing the canonical fix. The attacker path is now fully traced from keyboard to SQL execution.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-344 (search_facets no user binding — the bearer-token-shape that combines with this injection to enable propagation); ADR-CANDIDATE-121 (search-session bearer-token at schema layer); ADR-CANDIDATE-052 (server-side search session — strengthened this batch with UI page-root surfaces).
- SUPERSEDES: none.
- CONFLICTS: none.

---

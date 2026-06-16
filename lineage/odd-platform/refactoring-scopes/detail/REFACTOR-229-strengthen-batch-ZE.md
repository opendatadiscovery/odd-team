## STRENGTHENS — Batch ZE (SearchController class-level — third invocation site / canonical HTTP entry point confirmed)

**SearchController class-level enrichment confirms REFACTOR-229's SQL injection vector and adds the CANONICAL HTTP ENTRY POINT — `GET /api/search/{search_id}/data_entities/{data_entity_id}/highlights`.** Where batch H surfaced the implementation site (`ReactiveDataEntityRepositoryImpl.getHighlightedResult`) and batch M added the second-invocation-site (facet aggregators via `JooqFTSHelper.tsQuery`), batch ZE now confirms the HTTP boundary: the SearchController.highlightDataEntity endpoint at lines 85-91 is the user-facing surface that triggers the SQL injection path.

**New surfaced_by entry**:
- `odd-platform__java__SearchController__controller-class__SearchController.md:bugs_limitations_corner_cases.[6]` (HIGH) — "**`getHighlightedResult` is a TRUE SQL-injection vector (NOT just a DoS).** `ReactiveDataEntityRepositoryImpl.java:798-806` does `final String sql = \"ts_headline('english', '%s', to_tsquery('%s'), 'HighlightAll=true')\".formatted(text, tsQuery);` — direct string-interpolation into raw SQL via `String.formatted`. Both `text` (the catalog-supplied entity searchable string) and `tsQuery` (the user-supplied search query after tokenisation) are interpolated WITHOUT escaping. A caller POSTs a crafted query [exploit payload withheld from this public workspace - private advisory GHSA-rjp9-9vgm-q94c] → the persisted `query_string` flows through `getHighlightedResult` → arbitrary SQL execution on the `read` connection. Severity HIGH; this is the canonical batch H finding, with `highlightDataEntity` as the controller entry point."
- `odd-platform__java__SearchController__controller-class__SearchController.md:stress_findings.name_behavior_pairs.[3]` — "highlightDataEntity: 'Highlight data entity fields' — drift DRIFT_NAME_VS_BEHAVIOR. ... HOWEVER the implementation has a TRUE SQL-injection surface — the user-controlled queryString reaches raw SQL via String.formatted. A persisted query containing `'; DROP TABLE ...; --` runs arbitrary SQL."
- `odd-platform__java__SearchController__controller-class__SearchController.md:stress_findings.request_inputs.[5]` (highlightDataEntity) — explicit walkthrough: "(a) DoS via persisted query containing unbalanced parens; (b) SQL injection — persisted query containing `'; DELETE FROM ...; --` runs arbitrary SQL on the read connection; (c) `text` (entity searchable string) is ALSO interpolated — a maliciously-named data entity could inject via the entity name"

**Cross-batch refinement** (batch ZE pins the canonical HTTP entry point):
- Batch H established the implementation: `ReactiveDataEntityRepositoryImpl.java:798-806` (the `.formatted(text, tsQuery)` site)
- Batch M established the second invocation site: `ReactiveSearchFacetRepositoryImpl` facet aggregators via `JooqFTSHelper.tsQuery`
- **Batch ZE now establishes the HTTP boundary**: `SearchController.highlightDataEntity` at lines 85-91 → `DataEntityHighlightServiceImpl.highlight` at lines 26-46 → `getHighlightedResult` at lines 798-806

**The full call chain (THREE batches triangulated)**:
1. **HTTP entry** (Batch ZE): `GET /api/search/{search_id}/data_entities/{data_entity_id}/highlights` — any authenticated caller (or anonymous under DISABLED) with a `search_id` (REFACTOR-344 bearer-token shape means ANY user-shareable URL) AND a `data_entity_id` (REFACTOR-024 cross-owner enumeration means ALL catalog entities are visible)
2. **Service layer** (Batch ZE pins): `DataEntityHighlightServiceImpl.java:26-46` orchestrates the 3-Mono zip (session + entity + dataset version) then calls the SQL site
3. **Repository SQL** (Batch H + Batch ZE): `ReactiveDataEntityRepositoryImpl.java:798-806` builds the raw SQL via `String.formatted(text, tsQuery)` and feeds to `DSL.field(sql, String.class)`
4. **FTS helper** (Batch H + Batch M): `JooqFTSHelper.tsQuery` (`:164-168`) does the unsafe split-on-space + `:*` + `&`-join — the same code surface for facet aggregators AND highlight

**The attacker's complete path is now triangulated end-to-end**:
1. Attacker POSTs `/api/search` with `query='); DROP TABLE policy; --` (any authenticated user under non-DISABLED, OR anonymous under DISABLED).
2. The persisted session UUID is returned (REFACTOR-344: bearer-token shape; no user binding).
3. Attacker uses the session UUID (or a shared/leaked one) on `/api/search/{search_id}/data_entities/{de_id}/highlights`.
4. `DataEntityHighlightServiceImpl` fetches the session → extracts the query → calls `getHighlightedResult(searchableString, queryString)`.
5. `String.formatted(text, tsQuery)` interpolates the malicious query into the raw SQL.
6. The SQL executes on the read connection. POLICY table dropped; or `pg_sleep(10)` DoS; or `SELECT password FROM ...; -- ` exfiltration.

**Triangulation count**: REFACTOR-229 now triangulates across **3 batches** (H + M + ZE) covering: implementation site (Batch H), second invocation site (Batch M facet aggregators), HTTP entry point (Batch ZE highlightDataEntity controller method). The fix scope was already platform-wide at batch M (escape at `JooqFTSHelper.tsQuery` AND replace `.formatted()` with parameterised bind at `getHighlightedResult`); batch ZE confirms NO additional invocation sites at the controller layer beyond the canonical one.

**Severity unchanged at HIGH** — the canonical SQL injection finding. The maintainer's prescription (parameterise via `DSL.field(sql, {0}, {1})` with bound params) remains the structural fix point.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-344 (search session bearer-token + REFACTOR-229 compound — attacker can poison any session, then INDUCE other users to detonate it); ADR-CANDIDATE-121 (the schema-level bearer-token decision that makes the multi-user attack possible).
- SUPERSEDES: none.
- CONFLICTS: none.

---

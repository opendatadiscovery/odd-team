## STRENGTHENS — SearchController class-tier names highlightDataEntity as the HTTP ENTRY POINT (batch ZE)

The SearchController class-tier sidecar (batch ZE) supplies the HTTP-CONTROLLER-TIER PRIMARY SOURCE for the SQL-injection vector DOC-GAP-104 captures at the repository tier (batch H) and the facets tier (batch M). The triangulation now spans repository (batch H) + facet-aggregator (batch M) + CONTROLLER ENTRY POINT (batch ZE) — 3-LAYER coverage on the same `JooqFTSHelper.tsQuery` + `String.formatted` vulnerability surface.

- **NEW surfaced_by (batch ZE)**:
  - `odd-platform__java__SearchController__controller-class__SearchController.md:bugs_limitations_corner_cases.[6]` (HIGH per sidecar — "`getHighlightedResult` is a TRUE SQL-injection vector (NOT just a DoS)")
  - `odd-platform__java__SearchController__controller-class__SearchController.md:stress_findings.name_behavior_pairs[highlightDataEntity]` (drift=DRIFT_NAME_VS_BEHAVIOR; "the implementation has a TRUE SQL-injection surface")
  - `odd-platform__java__SearchController__controller-class__SearchController.md:stress_findings.request_inputs[searchId, dataEntityId (highlightDataEntity)]` (Available-but-unused: "jOOQ's `DSL.field(..., bindParam, bindParam)` would parameterise both inputs safely")
  - `odd-platform__java__SearchController__controller-class__SearchController.md:stress_findings.resource_boundaries[DataEntityHighlightServiceImpl.java:36]` ("the SQL-injection surface (.formatted) means a malicious caller could MUTATE state on the read connection by injection")
  - `odd-platform__java__SearchController__controller-class__SearchController.md:tests_coverage_semantic.uncovered_behaviours.[6]` (HIGH — "`highlightDataEntity` returns deserialisable `DataEntitySearchHighlight` with correct `<b>...</b>` markup; assert the SQL-injection surface")

- **NEW evidence (batch ZE)**:
  - `SearchController.java:85-91` — the HTTP entry point: `highlightDataEntity(searchId, dataEntityId, exchange)` → `dataEntityHighlightService.getHighlight(searchId, dataEntityId).map(ResponseEntity::ok)`. The controller layer is a 3-line delegate; the SQL-injection vulnerability flows from this exact endpoint.
  - `DataEntityHighlightServiceImpl.java:26-46` — orchestration: (a) fetch search session by UUID → extract queryString; (b) fetch data entity searchable fields; (c) fetch latest dataset version; (d) zip + call `getHighlightedResult(searchableString, queryString)` → SQL `ts_headline('english', '%s', to_tsquery('%s'), 'HighlightAll=true').formatted(text, tsQuery)` — direct interpolation; (e) parse the highlighted string back to typed `DataEntitySearchHighlight`.
  - The persisted `searchId.query_string` (cross-link DOC-GAP-161 — UUIDs are bearer tokens) flows into `getHighlightedResult` via the session-state fetch; this is the EXPLICIT attack chain combining DOC-GAP-104 + DOC-GAP-161 + DOC-GAP-166:
    1. Attacker obtains a session UUID (via URL leak per DOC-GAP-161) or creates a new session (via POST /api/search if authenticated, or anonymously under DISABLED per DOC-GAP-082 META).
    2. Attacker PUTs `updateFacets` with a crafted query [exploit payload withheld from this public workspace - private advisory GHSA-rjp9-9vgm-q94c] — the query persists in `search_facets.query_string` (per DOC-GAP-166).
    3. Attacker (or victim) issues `GET /api/search/{id}/data_entities/{entity_id}/highlights` — the persisted query flows into `getHighlightedResult` → `String.formatted` interpolates the user-controlled value into raw SQL.
    4. Arbitrary SQL executes on the read connection (per DOC-GAP-104).
  - WebFetch inheritance per LSN-018 stale-probe cadence (11-day window): the live `/features/data-discovery/search` page (status 200 per the class sidecar's `inferred_docs.[0]`) is silent on the highlight endpoint's existence, parameters, or the SQL-injection caveat.

- **NEW dimension (batch ZE)**:
  The class-tier finding identifies `highlightDataEntity` as the CONTROLLER-LEVEL ENTRY POINT of the SQL-injection chain. Prior DOC-GAP-104 framing was repository + facet-aggregator (the BACKEND code surfaces); this batch ZE adds the HTTP-CONTROLLER tier — i.e. the operator-reachable URL pattern `GET /api/search/{search_id}/data_entities/{data_entity_id}/highlights`. The 3-layer triangulation closes the attack-chain narrative: operator-reachable URL → service → repository → injection.

- **Coherence (LSN-018 Rule 6 pre-emit)**: no cross-registry contradiction. The class-tier finding STRENGTHENS the existing finding by naming the HTTP entry point. No CONTRADICTS, no SUPERSEDES.

- **Severity stays HIGH**. The HTTP-entry-point identification makes the attack chain more explicit and operator-actionable. The proposed code-side fix at DOC-GAP-104 (refactor `getHighlightedResult` to use jOOQ's parameterised `DSL.function`) is unchanged; the doc-side admonition should also name `highlightDataEntity` as the operator-reachable endpoint to avoid under DISABLED (cross-link DOC-GAP-082 META).

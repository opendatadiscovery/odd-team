## STRENGTHENS — Class-tier 5-endpoint bearer-token UUID confirmation (batch ZE)

The SearchController class-tier sidecar (batch ZE) confirms the bearer-token-shaped session UUID semantic across ALL FIVE searchId-keyed endpoints (vs the batch M facets-method-only coverage).

- **NEW surfaced_by (batch ZE)**:
  - `odd-platform__java__SearchController__controller-class__SearchController.md:bugs_limitations_corner_cases.[2]` (HIGH — "Search-session UUIDs are bearer tokens by schema design. Any authenticated caller in possession of any other user's `searchId` UUID gets full READ + UPDATE + RESULT-FETCH + HIGHLIGHT access")
  - `odd-platform__java__SearchController__controller-class__SearchController.md:concepts.invariants.[2]` ("Five of seven endpoints (all except `search` and `getSearchSuggestions`) are keyed by a `searchId: UUID` — a bearer-token-shaped session handle with NO `owner_id`/`created_by` column in the `search_facets` table")
  - `odd-platform__java__SearchController__controller-class__SearchController.md:implicit_adrs.[0]` ("Search-session-as-server-state pattern — every search interaction binds to a UUID-keyed `search_facets` row")
  - `odd-platform__java__SearchController__controller-class__SearchController.md:implicit_adrs.[3]` ("Bearer-token-shaped search sessions — the schema went into V0_0_1 this way and has been retained across all subsequent migrations")
  - `odd-platform__java__SearchController__controller-class__SearchController.md:stress_findings.request_inputs[searchId]` (drift=DRIFT_INPUT_NAME_VS_IMPLEMENTATION; "Name implies 'my session'; implementation makes the UUID a bearer token shared across the platform")
  - `odd-platform__java__SearchController__controller-class__SearchController.md:tests_coverage_semantic.uncovered_behaviours.[7]` (HIGH — "Search-session UUID isolation — assert userA cannot READ/UPDATE userB's session (currently SUCCEEDS; test would document the gap)")

- **NEW evidence (batch ZE)**:
  - The class-tier sidecar enumerates the FIVE affected endpoints by name:
    1. `GET /api/search/{search_id}` (getSearchFacetList — UPDATE-RETURNING UUID lookup)
    2. `PUT /api/search/{search_id}` (updateSearchFacets — accepts any caller for any UUID)
    3. `GET /api/search/{search_id}/results` (getSearchResults — paginate any session's results)
    4. `GET /api/search/{search_id}/facet/{facet_type}` (getFiltersForFacet — enumerate any session's facet options)
    5. `GET /api/search/{search_id}/data_entities/{data_entity_id}/highlights` (highlightDataEntity — render any session's query against any entity, EXPOSING the SQL-injection vector per DOC-GAP-104)
  - The cross-link to DOC-GAP-104 strengthens the chain: bearer-token UUID + SQL-injection vector means an attacker holding a stolen UUID + control of the persisted query can drive arbitrary SQL execution. Cross-link DOC-GAP-166 (persistence dimension).
  - The cross-link to DOC-GAP-104 explicit at `request_inputs[searchId, dataEntityId (highlightDataEntity)]:routes_to_finding`: "bugs_limitations_corner_cases[7] (TRUE SQL injection via .formatted) — cross-link batch H".
  - The class-tier finding's `implicit_adrs.[0]` widens the cross-feature scope: the same session-UUID pattern is replicated in `TermController`, `QueryExampleController`, `ReferenceDataController` — FOUR feature surfaces apply the same shape. The bearer-token-shape is NOT isolated to Search; it's a cross-cutting platform convention.

- **NEW dimension (batch ZE) — cross-feature pattern**:
  The class-tier sidecar names FOUR feature surfaces sharing the same bearer-token-shaped session UUID design (Search, Term, QueryExample, ReferenceData). The META implication is that DOC-GAP-161's doc-side fix should not be a search-specific admonition but a cross-cutting "Session URL semantics" doc-product change on a META page (cross-link DOC-GAP-207 — the Term-search session URL eviction finding, which is the same UUID-shape applied to the Term surface). The DOC-GAP-161 + DOC-GAP-207 + the (currently un-filed) QueryExample + ReferenceData findings together form the platform-wide session-UUID-bearer-token cluster.

- **Coherence (LSN-018 Rule 6 pre-emit)**: no cross-registry contradiction. The class-tier finding STRENGTHENS the existing finding (5-endpoint enumeration + 4-feature cross-cutting design). No CONTRADICTS, no SUPERSEDES.

- **Severity stays HIGH**. The cross-feature widening of the META scope (4-feature surfaces) makes the doc-side fix MORE structural — recommend a META page rather than per-feature admonitions.

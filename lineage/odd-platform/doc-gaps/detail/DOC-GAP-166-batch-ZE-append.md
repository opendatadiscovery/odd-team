## STRENGTHENS — Class-tier confirms tsquery injection across all 7 endpoints (batch ZE)

The SearchController class-tier sidecar (batch ZE) confirms the tsquery operator-injection on persisted `search_facets.query_string` spans the FULL search surface — every facet aggregator + the highlight endpoint share the same `JooqFTSHelper.tsQuery` code path.

- **NEW surfaced_by (batch ZE)**:
  - `odd-platform__java__SearchController__controller-class__SearchController.md:bugs_limitations_corner_cases.[5]` (HIGH — "tsquery-operator injection on persisted `state.query_string` → DoS on every subsequent facet read")
  - `odd-platform__java__SearchController__controller-class__SearchController.md:concepts.invariants.[7]` (`JooqFTSHelper.tsQuery` is the common code surface — "split-on-space + `:*` per token + `&`-join; special tsquery operators (`!`, `(`, `)`, `:`, `<->`, `|`) are NOT escaped")
  - `odd-platform__java__SearchController__controller-class__SearchController.md:dependencies_semantic.requires-feature.[1]` ("Postgres FTS via `to_tsquery` — every search-side aggregator joins to `SEARCH_ENTRYPOINT.SEARCH_VECTOR` (`tsvector`) and applies `ftsCondition(...)`")
  - `odd-platform__java__SearchController__controller-class__SearchController.md:dependencies_semantic.couples-to.[6]` (`JooqFTSHelper.tsQuery` + `ftsCondition` + `ftsRankField` — the persisted-query → tsquery conversion path used by every FTS-using endpoint; SAME code surface as the cross-cutting FTS-injection batch H finding)
  - `odd-platform__java__SearchController__controller-class__SearchController.md:tests_coverage_semantic.uncovered_behaviours.[4]` (HIGH — "tsquery operator injection / DoS — `state.getQuery() = 'foo )('` produces 500-class on every subsequent facet read")

- **NEW evidence (batch ZE)**:
  - The class-tier sidecar enumerates the COMPLETE set of FTS invocation sites within the search controller's downstream chain:
    - **POST /api/search → SearchService.search → getFacetsData (entity-class aggregator)** — initial population
    - **GET /api/search/{id} → SearchService.getFacets → getFacetsData** — every read recomputes
    - **PUT /api/search/{id} → SearchService.updateFacets** — every update recomputes
    - **GET /api/search/{id}/results → SearchService.getResults → DataEntityService.findByState → repository.findByState** — every results read invokes FTS via `getOrderFields:945-968`
    - **GET /api/search/{id}/facet/{type} → SearchService.getFacetOptions → 5 facet aggregators** (entity-class, type, owner, tag, group, status) — every facet drill invokes FTS at `ReactiveSearchFacetRepositoryImpl.java:182, 267, 469, 582`
    - **GET /api/search/suggestions → repository.getQuerySuggestions:470-513** — autocomplete invokes FTS
    - **GET /api/search/{id}/data_entities/{id}/highlights → repository.getHighlightedResult:798-806** — highlight invokes FTS (cross-link DOC-GAP-104 — the `String.formatted` SQL-injection variant on this same code surface)
  - **The 6+1 surface count** (vs prior framing): batch ZE confirms the tsquery code path is invoked from 6 distinct controller method paths PLUS the cross-link to DOC-GAP-104 (the 7th — `String.formatted` SQL-injection at `getHighlightedResult`). The class-tier finding is the canonical FAN-OUT verification.

- **NEW dimension (batch ZE)**:
  Prior DOC-GAP-166 framing was "persistent-broken-session DoS" (the persistence dimension distinct from DOC-GAP-080's ephemeral). Batch ZE adds: the SAME code path is also invoked from the autocomplete + the highlight + the results — so a persisted malformed query breaks ALL session-state reads, not just the facet aggregators. The blast radius is wider than batch M's framing captured.

- **Coherence (LSN-018 Rule 6 pre-emit)**: no cross-registry contradiction. The class-tier finding STRENGTHENS the existing finding by enumerating the full FTS invocation site list. No CONTRADICTS, no SUPERSEDES.

- **Severity stays HIGH**. The wider invocation-site list strengthens the DoS dimension — a single malformed persisted query 500s on every search-feature interaction with that session, not just facet drills.

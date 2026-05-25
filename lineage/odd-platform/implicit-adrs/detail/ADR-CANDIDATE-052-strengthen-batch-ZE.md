## STRENGTHENS — Batch ZE (SearchController class-level — the full 7-endpoint surface confirms the server-side stateful session pattern)

**SearchController class-level enrichment adds the 7-endpoint surface confirmation for ADR-CANDIDATE-052.** Where prior coverage was ONE sidecar (`SearchController.controller-method:search.md` at batch E), the class-level enrichment now confirms the entire 7-endpoint surface follows the pattern: 5 of 7 endpoints take `search_id: UUID` as a path parameter, all operate on the same `search_facets` row.

**New surfaced_by entry**:
- `odd-platform__java__SearchController__controller-class__SearchController.md:implicit_adrs.[0]` (HIGH) — "**Search-session-as-server-state pattern (ADR-CANDIDATE-001 instance) — every search interaction binds to a UUID-keyed `search_facets` row.** Five of seven endpoints take `search_id: UUID` as a path parameter; `POST /api/search` creates the row + returns the UUID; `GET /api/search/{search_id}/results` is the result-fetch step (separate from session creation); `getSearchFacetList`, `updateSearchFacets`, `getFiltersForFacet`, `highlightDataEntity` all operate on the same UUID. The same session-UUID pattern is replicated in `TermController`, `QueryExampleController`, `ReferenceDataController` — four feature surfaces apply the same shape, signalling intentional design. Trade-off: server retains query state across multi-step UI flows at the cost of an unbounded table requiring TTL housekeeping (F-010, default 30 days)." — confidence: HIGH

**Cross-batch refinement** (class-level confirmation refines the prior method-level finding):
- The session-state lifecycle is now visible end-to-end: POST creates → GET re-reads + recomputes → PUT merges delta → GET /results paginates → GET /facet/{type} drills facets → GET /highlights renders per-entity highlight. SIX of the seven endpoints depend on the persisted session row; only `getSearchSuggestions` is session-less (a stateless prefix-match autocomplete).
- The 4-feature replication (Search + Term + QueryExample + ReferenceData) is now load-bearing for the ADR: the architectural pattern is reused, not bespoke.
- The TTL housekeeping (F-010, 30-day default per `application.yml:169`) is the platform's solution to the unbounded-table consequence. Per LSN-018: the prior batch-V correction (REFACTOR-353 SUPERSEDE) confirmed the TTL job IS active; the "unbounded growth" claim was wrong.

**Triangulation count**: ADR-CANDIDATE-052 now triangulates across **2 sidecars** (was 1 — batch E `search` method + NEW batch ZE class-level). The class-level confirmation is the architectural bookend.

**Severity unchanged**: HIGH — the canonical server-side session-state pattern for the platform's stateful-search surface.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-121 (search-session bearer-token-shaped at schema layer — THIS ADR's session pattern is the WHY; ADR-CANDIDATE-121 is the consequence at schema level); REFACTOR-344 (search_facets has no user binding — the operator-actionable consequence).
- SUPERSEDES: none.
- CONFLICTS: none.

---

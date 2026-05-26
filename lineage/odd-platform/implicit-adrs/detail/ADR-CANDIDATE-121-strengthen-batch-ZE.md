## STRENGTHENS — Batch ZE (SearchController class-level — bearer-token-shaped session UUID confirmed across all 5 searchId-keyed endpoints)

**SearchController class-level enrichment confirms ADR-CANDIDATE-121's schema-level bearer-token pattern across the full 5-searchId-keyed-endpoint surface.** Where prior coverage was the facets sidecar alone, the class-level enrichment now confirms the schema decision propagates to: GET /api/search/{search_id}, PUT /api/search/{search_id}, GET /api/search/{search_id}/results, GET /api/search/{search_id}/facet/{facet_type}, GET /api/search/{search_id}/data_entities/{data_entity_id}/highlights. Any authenticated caller in possession of any other user's `searchId` UUID gets full READ + UPDATE + RESULT-FETCH + HIGHLIGHT access on ALL five endpoints.

**New surfaced_by entry**:
- `odd-platform__java__SearchController__controller-class__SearchController.md:implicit_adrs.[3]` (MEDIUM confidence per the structural-convention framing) — "**Bearer-token-shaped search sessions (carried forward from the prior facets sidecar with intent annotation).** `search_facets` schema has NO `owner_id`/`created_by`/`user_id` column; the UUID is the sole identifier. `SearchServiceImpl.search` creates rows without capturing the principal; `updateFacets` accepts any caller for any UUID; `fetchFacetState` is a raw UUID lookup. The schema went into V0_0_1 this way and has been retained across all subsequent migrations. TODOs `find more clever way to generate uuid` + `find a way to define TTL` (V0_0_1__init.sql:206-207) — the TTL TODO was addressed by V0_0_52 + F-010; the unscoped posture has been retained without flag in any later migration."
- `odd-platform__java__SearchController__controller-class__SearchController.md:concepts.invariants.[2]` — "Five of seven endpoints (all except `search` and `getSearchSuggestions`) are keyed by a `searchId: UUID` — a bearer-token-shaped session handle with NO `owner_id`/`created_by` column in the `search_facets` table (`V0_0_1__init.sql:204-211`). Any authenticated caller holding any other user's UUID gets full READ + UPDATE + RESULT-FETCH + HIGHLIGHT access to that session"
- `odd-platform__java__SearchController__controller-class__SearchController.md:bugs_limitations_corner_cases.[2]` (HIGH) — "**Search-session UUIDs are bearer tokens by schema design.** Any authenticated caller in possession of any other user's `searchId` UUID gets full READ + UPDATE + RESULT-FETCH + HIGHLIGHT access."

**Cross-batch refinement**:
- The HIGHLIGHT endpoint surface (`/api/search/{search_id}/data_entities/{data_entity_id}/highlights`) is now confirmed as an additional bearer-token consumer. Combined with REFACTOR-229 (SQL injection via String.formatted on `getHighlightedResult`), the compounding attack becomes: (1) attacker POSTs `/api/search` with a SQL-injection payload as the query string; (2) any user who knows the resulting session UUID can be coerced to trigger the highlight render; (3) the SQL injection executes on the read connection. The bearer-token pattern is the load-bearing primitive that turns single-user injection into a multi-user attack vector.
- The 5-searchId-keyed-endpoint enumeration confirms the schema decision propagates uniformly — there is no per-endpoint scoping that would soften the bearer-token consequence.

**Triangulation count**: ADR-CANDIDATE-121 now triangulates across **3 sidecars** (was 1 — `SearchController.facets` at batch M + NEW batch ZE class-level cross-confirmation across 2 anchors on the same sidecar). The architectural decision is load-bearing across the full P-04 search lifecycle.

**Severity unchanged**: HIGH — the canonical schema-level bearer-token pattern.

**Borderline_flag** unchanged: the maintainer's triage question (deliberate read-collaborative-session-design vs schema-level oversight) remains the resolution gate. The batch-ZE class-level confirmation does NOT resolve the question; it merely confirms the pattern's scope.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-052 (server-side stateful session pattern — THIS ADR is the schema-level consequence); REFACTOR-344 (no user binding — operator-actionable consequence); REFACTOR-229 (SQL injection — compounded by the bearer-token shape).
- SUPERSEDES: none.
- CONFLICTS: none.

---

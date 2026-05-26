## STRENGTHENS — Batch ZE (SearchController class-level — full 5-endpoint surface confirms the bearer-token consequence)

**SearchController class-level enrichment confirms REFACTOR-344's `search_facets` no-user-binding pattern across the ENTIRE 5-searchId-keyed endpoint surface.** Where batch M's facets sidecar surfaced the consequence at the facet-aggregator path, batch ZE's class-level enrichment confirms the consequence applies to ALL 5 searchId-keyed endpoints: read (`GET /{id}`), update (`PUT /{id}`), results (`GET /{id}/results`), facets (`GET /{id}/facet/{type}`), highlights (`GET /{id}/data_entities/{de_id}/highlights`).

**New surfaced_by entry**:
- `odd-platform__java__SearchController__controller-class__SearchController.md:bugs_limitations_corner_cases.[2]` (HIGH) — "**Search-session UUIDs are bearer tokens by schema design.** Any authenticated caller in possession of any other user's `searchId` UUID gets full READ + UPDATE + RESULT-FETCH + HIGHLIGHT access. Concrete impact: (a) screenshot/URL leakage exposes the entire saved filter state including the `myObjects` toggle, FTS query text (potentially PII), and selected filters; (b) `PUT /api/search/{search_id}` allows arbitrary modification of another user's persisted state; (c) probing UUIDs returns `404 Search not found` on miss (server-generated v4 UUIDs are unguessable in O(2^60), so brute-force is infeasible — but leakage IS the attack). The schema went in this way at V0_0_1 and never changed."
- `odd-platform__java__SearchController__controller-class__SearchController.md:concepts.invariants.[2]` — confirms the structural absence across all 5 endpoints
- `odd-platform__java__SearchController__controller-class__SearchController.md:stress_findings.request_inputs.[0]` — searchId path-param walkthrough: "DRIFT_INPUT_NAME_VS_IMPLEMENTATION — Name implies 'my session'; implementation makes the UUID a bearer token shared across the platform"

**Cross-batch refinement** (batch ZE pins the consequence scope):
- Batch M established the schema-level decision + the facet-aggregator manifestation
- **Batch ZE confirms the consequence scope spans 5 endpoints**, not just the facets one. The highlightDataEntity endpoint adds a NEW dimension: combined with REFACTOR-229 (SQL injection), the bearer-token shape means an attacker poisoning their OWN session can INDUCE other users to detonate it via URL-sharing or referer-leakage.

**The 5-endpoint enumeration**:
1. `GET /api/search/{search_id}` — any user with the UUID reads the session's saved filter state, query text, `myObjects` toggle (item (a) in the impact list)
2. `PUT /api/search/{search_id}` — any user with the UUID writes-merges into the session state (item (b))
3. `GET /api/search/{search_id}/results` — paginated catalog-wide result list bound to the session's query + filters (compounding with REFACTOR-024 cross-owner enumeration)
4. `GET /api/search/{search_id}/facet/{facet_type}` — facet aggregator drill-down (batch M's original surface)
5. `GET /api/search/{search_id}/data_entities/{data_entity_id}/highlights` — the SQL-injection-detonation surface (compounding with REFACTOR-229)

**The compound attack chain triangulated across THREE refactors**:
1. **REFACTOR-344** (this finding): bearer-token shape; attacker can share a session UUID with another user
2. **REFACTOR-229**: SQL injection via `String.formatted` on highlight path
3. **REFACTOR-185**: under DISABLED, all of the above is reachable by anonymous network probes

The compound: attacker (or any caller under DISABLED) creates a session with a malicious query string; shares the UUID; victims who access the URL (or are coerced via referer / window.opener exploits — see REFACTOR-629 for the AppInfoMenu tabnabbing surface) trigger the SQL injection.

**Triangulation count**: REFACTOR-344 now triangulates across **2 batches** (M + ZE) with **3 sidecars** total (`SearchController.facets.md` from batch M + 2 anchors on `SearchController` class-level from batch ZE). The schema-level decision is load-bearing across the full 5-endpoint surface.

**Severity unchanged at HIGH** — the canonical schema-level bearer-token vulnerability.

**The maintainer's prescription** (per the existing detail file): two-path — DOC-ALIGN (if the unscoped posture is deliberate per ADR-CANDIDATE-121) OR STRUCTURAL (add owner_id column + service-tier ownership check). Option (2) is strictly preferable for multi-tenant deployments; option (1) is acceptable for the read-collaborative-posture stance the platform has consistently adopted.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-121 (the architectural decision); REFACTOR-229 (the SQL injection compound); REFACTOR-185 (DISABLED-mode bypass compound).
- SUPERSEDES: none.
- CONFLICTS: none.

---

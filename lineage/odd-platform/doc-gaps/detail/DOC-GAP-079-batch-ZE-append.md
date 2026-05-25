## STRENGTHENS — SearchController class-tier (batch ZE)

The SearchController class-tier sidecar (batch ZE) supplies the CLASS-LEVEL PRIMARY SOURCE for the 7-endpoint search surface that DOC-GAP-079 captures at the controller-method tier. Triangulation now: controller-method (batch E) + controller-class (batch ZE) — 2-LAYER coverage on the search-surface visibility model.

- **NEW surfaced_by (batch ZE)**:
  - `odd-platform__java__SearchController__controller-class__SearchController.md:bugs_limitations_corner_cases.[0]` (HIGH per sidecar — "Catalog-wide cross-owner enumeration via `getSearchResults` + `getFiltersForFacet`")
  - `odd-platform__java__SearchController__controller-class__SearchController.md:bugs_limitations_corner_cases.[3]` (MEDIUM — DISABLED mode anonymous-reach)
  - `odd-platform__java__SearchController__controller-class__SearchController.md:concepts.invariants.[1]` ("All seven endpoints fall through to `pathMatchers('/**').authenticated()` — `SecurityConstants.SECURITY_RULES` carries NO entry for any `/api/search*` path")
  - `odd-platform__java__SearchController__controller-class__SearchController.md:stress_findings.auth_gates[SearchController.java:30-91]` (verified `SecurityConstants.java` end-to-end shows NO `/api/search*` matcher)
  - `odd-platform__java__SearchController__controller-class__SearchController.md:docs_link_semantic.doc_drift_findings.[0]` ("Five absences on the live page are operator-relevant" — WHO can search, query syntax, autocomplete, pagination, catalog scope)
  - `odd-platform__java__SearchController__controller-class__SearchController.md:implicit_adrs.[2]` (centralised authorization via SECURITY_RULES — `/api/search*` is intentionally NOT rule-gated; ADR-CANDIDATE-003 strengthen)

- **NEW evidence (batch ZE)**:
  - `SecurityConstants.java` — full 357-line file read end-to-end this batch (per the class sidecar's verification): `grep -in 'search\|facet' <SecurityConstants.java>` returned ZERO matches; the absence of any `/api/search*` rule is confirmed across all 7 endpoints, not just the methods batch E enriched.
  - `AuthorizationCustomizer.java:29-30` — the catch-all `.pathMatchers("/**").authenticated()` is the ONLY gate; under DISABLED this is short-circuited.
  - The 7 endpoints (per class-tier enumeration): `POST /api/search`, `GET /api/search/{search_id}`, `PUT /api/search/{search_id}`, `GET /api/search/{search_id}/results`, `GET /api/search/{search_id}/facet/{facet_type}`, `GET /api/search/suggestions`, `GET /api/search/{search_id}/data_entities/{data_entity_id}/highlights` — all share the same `.authenticated()` posture.
  - WebFetch inheritance per LSN-018 stale-probe cadence (11-day window — network unreachable this session): the SearchController class sidecar's `inferred_docs.[0]` verified 2026-05-25 status 200; content unchanged from 2026-05-19. The verbatim "Topics absent" list per the sidecar's `fetched_excerpts`: "Search authorization/access — no information about WHO can search or access restrictions / Query syntax — no details on wildcard operators, tsquery handling, or advanced syntax / Search suggestions/autocomplete — no mention of these features / Pagination — no discussion of result pagination mechanisms / Catalog scope — no explanation of whether results are per-user, per-owner, or catalog-wide".

- **NEW dimension (batch ZE)**:
  The `highlightDataEntity` endpoint (the 7th endpoint, NEW class-tier coverage) inherits the same authorization posture — no @PreAuthorize, no SECURITY_RULES entry, falls through to `.authenticated()`. Under DISABLED it is anonymously reachable and carries the SQL-injection vector DOC-GAP-104 captures. The class-tier finding is the canonical SINGLE-CLASS PRIMARY SOURCE for the read-collaborative posture across the entire search surface (vs. the per-method batch E + batch M coverage).

- **Coherence (LSN-018 Rule 6 pre-emit)**: no cross-registry contradiction. The class-tier finding is additive (same polarity) to the controller-method-tier batch E finding. No CONTRADICTS, no SUPERSEDES.

- **Severity stays HIGH**. The class-tier confirmation strengthens the existing claim that the search surface is the WIDEST cross-owner read surface in the platform; the 7-endpoint enumeration confirms that EVERY search-feature path inherits the posture, not just the `search` method.

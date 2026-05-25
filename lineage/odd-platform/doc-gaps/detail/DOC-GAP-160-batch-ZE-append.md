## STRENGTHENS — Class-tier confirmation of facet count cross-owner enumeration (batch ZE)

The SearchController class-tier sidecar (batch ZE) confirms the facet count cross-owner enumeration finding at the controller-CLASS tier (vs the controller-method-only batch M coverage).

- **NEW surfaced_by (batch ZE)**:
  - `odd-platform__java__SearchController__controller-class__SearchController.md:bugs_limitations_corner_cases.[0]` (HIGH — explicitly names `GET /api/search/{search_id}/facet/OWNERS?page=1&size=1000` as the surface enumerating every owner name + per-owner entity count)
  - `odd-platform__java__SearchController__controller-class__SearchController.md:audiences.[3]` ("An authenticated attacker enumerating cross-owner catalog state via `getFiltersForFacet(OWNERS)` (enumerates every owner + per-owner count) and via `getSearchResults` (catalog-wide enumeration without owner predicate); under `DISABLED` auth, anonymous")
  - `odd-platform__java__SearchController__controller-class__SearchController.md:dependencies_semantic.requires-runtime.[5]` ("`AuthIdentityProvider` reactor-context principal resolution — `authIdentityProvider.fetchAssociatedOwner()` called by `getFacetsData` (line 128) for the unconditional `myObjectsCount`" — the unconditional principal lookup confirms the design intent: catalog-wide counts + opt-in my-objects scope)
  - `odd-platform__java__SearchController__controller-class__SearchController.md:tests_coverage_semantic.uncovered_behaviours.[2]` (HIGH — "Cross-owner facet-count enumeration regression — assert whether `GET /api/search/{userB_session_uuid}/facet/OWNERS` is reachable from userA and returns the full owner list")

- **NEW evidence (batch ZE)**:
  - The class-tier sidecar's `bugs_limitations_corner_cases.[0]` enumerates the ATTACK STEPS verbatim: "(a) `POST /api/search` with `myObjects=false` (the default); (b) `GET /api/search/{search_id}/results?page=1&size=N` to paginate every non-`EXCLUDE_FROM_SEARCH` data entity in the platform; (c) `GET /api/search/{search_id}/facet/OWNERS?page=1&size=1000` to enumerate every owner name + per-owner entity count; (d) `GET /api/search/{search_id}/facet/{TAGS,GROUPS,TYPES,STATUSES}` to enumerate the catalog cardinality across each facet." This is the operator-actionable attack-path narrative.
  - The class-tier finding cross-links to REFACTOR-024 + REFACTOR-053 (sibling read-collaborative cross-owner enumeration findings).
  - WebFetch inheritance per LSN-018 stale-probe cadence: the live `/features/data-discovery/search` page (status 200 per the class sidecar's `inferred_docs.[0]`) remains SILENT on the facet-count scoping (no change since 2026-05-19).

- **NEW dimension (batch ZE)**:
  The class-tier finding identifies the cross-owner facet-count enumeration as one of the FOUR enumeration steps an attacker chains. Prior DOC-GAP-160 framing was the facet-count surface in isolation; batch ZE adds the FULL ATTACK CHAIN context (paginate entities + enumerate owners + enumerate tags/groups/types/statuses). The doc-side fix should name the chain explicitly rather than the per-step concern.

- **Coherence (LSN-018 Rule 6 pre-emit)**: no cross-registry contradiction. The class-tier finding is additive. No CONTRADICTS, no SUPERSEDES.

- **Severity stays HIGH**. The 4-step attack chain is the most operationally consequential framing.

## REFACTOR-344 — `search_facets` table has NO user binding — UUID is a bearer token; any authenticated user in possession of any other user's `searchId` UUID has FULL READ + UPDATE access to that session; the schema-level PRIMARY-SOURCE pinned at V0_0_1__init.sql:204-211

**Severity**: HIGH
**Category**: missing-auth (schema-level)
**Pillars affected**: [P-01-data-discovery, P-09-security-access-control]
**Batch**: M (2026-05-19)

**Surfaced by**:
- `odd-platform__java__SearchController__controller-method__facets.md:bugs_limitations_corner_cases.[1]` (HIGH) — "**The `search_facets` table has no user binding — any authenticated user in possession of any other user's `searchId` UUID can READ, UPDATE, and DRIVE that session.** Concrete impact: (a) an operator who copies a search URL into a bug report exposes their entire saved-filter state including `My Objects` posture; (b) a CSRF-style cross-tab actor with read access to URL bars in the browser can hijack the session; (c) an authenticated attacker can probe `GET /api/search/{guess}` UUIDs and either get `Search not found` (404) or read another user's session (200). The UUID space is 122-bit gen_random_uuid so brute-force is infeasible, but URL leakage is not. The schema (`V0_0_1__init.sql:204-211`) has TODOs for `more clever way to generate uuid` and `define TTL` but no maintenance has addressed the unscoped posture in any subsequent migration."
- `odd-platform__java__SearchController__controller-method__facets.md:security.known_security_gaps.[1]` (HIGH)
- Cross-link batch E `SearchController.search` (the original surfacing of the search-session-as-server-state pattern)

**Description**: The `search_facets` table schema at `V0_0_1__init.sql:204-211` declares:

```sql
CREATE TABLE search_facets (
    -- TODO: find more clever way to generate uuid
    -- TODO: find a way to define TTL
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    query_string varchar(255),
    filters jsonb,
    last_accessed_at timestamp with time zone DEFAULT current_timestamp
);
```

The schema has NO `owner_id`, `created_by`, or `user_id` column. The UUID is the sole identifier. This is reinforced at four service-tier sites:
- `SearchServiceImpl.search` (lines 75-82) creates a new row WITHOUT capturing the caller's principal — the new session has no user binding.
- `SearchServiceImpl.updateFacets` (lines 84-96) reads the row by UUID + merges + writes WITHOUT checking ownership — any caller can modify any session.
- `SearchServiceImpl.fetchFacetState(searchId)` (lines 157-160) does a raw `repository.get(searchId)` with no owner predicate — any caller can read any session.
- `ReactiveSearchFacetRepositoryImpl.get(UUID)` (lines 99-106) is a raw UUID-keyed UPDATE-RETURNING with no user predicate.

**Concrete impact paths**:

1. **URL leakage in bug reports / chat / screenshots / referer headers**: An operator who copies their search URL (e.g. `https://platform.example.com/search/abc123-...`) into a bug report or chat message hands the recipient full read+update access to that session.
2. **Browser-tab / browser-extension session hijack**: A malicious browser extension with read access to URL bars can harvest search-session UUIDs and replay them.
3. **CSRF-style cross-tab actor**: A user with two browser tabs open — one authenticated to ODD, one to a third-party site — can have the third-party site harvest the ODD URL via Referer or window.opener.location and submit the UUID to a server.
4. **Compounding with REFACTOR-229 (tsquery injection — batch H + batch M strengthen)**: A malicious caller poisons their own session's `query_string` field with tsquery-syntax-breaking characters (`foo )('`); every facet aggregator then 500s on that session. The bearer-token-shaped UUID means the attacker can SHARE the poisoned UUID with any other user, breaking the facet UI for them too.
5. **Compounding with REFACTOR-024 (cross-owner enumeration)**: Combined with the catalog-wide facet count posture (ADR-CANDIDATE-122 NEW), an authenticated attacker with a stolen session UUID can use it as a stepping stone to enumerate the catalog cardinality (`/api/search/{stolen_id}/facet/OWNERS` etc) under another user's identity.

**Primary source citations**:
- `V0_0_1__init.sql:204-211` (the table schema with TODOs and no owner column)
- `V0_0_52__introduce_housekeeping.sql` (verified by Grep: no `search_facets` housekeeping policy)
- `SearchServiceImpl.java:75-82` (`search` creates row without capturing principal)
- `SearchServiceImpl.java:84-96` (`updateFacets` accepts any caller for any UUID)
- `SearchServiceImpl.java:157-160` (`fetchFacetState` is a raw UUID lookup)
- `ReactiveSearchFacetRepositoryImpl.java:99-106` (`get` is a raw UUID-keyed UPDATE-RETURNING)

**Existing-ADR-or-implied-prescription**: **ADR-CANDIDATE-121 NEW** (batch M) codifies the architectural decision (search-session bearer-token-shaped at schema layer) — the schema went into V0_0_1__init.sql this way and has been retained across 90+ subsequent migrations. The TODOs at `V0_0_1__init.sql:206-207` (`TODO: find more clever way to generate uuid` + `TODO: find a way to define TTL`) acknowledge maintenance gaps but do NOT flag the unscoped posture as a defect. ADR-CANDIDATE-121's `borderline_flag` is the maintainer's triage question: is the schema-level absence a deliberate read-collaborative-session design (aligned with ADR-CANDIDATE-003) OR an oversight? This REFACTOR is the operator-actionable consequence regardless of the triage outcome.

**Proposed remedy**: Two-path; the maintainer chooses based on the trust calculus and the ADR-CANDIDATE-121 borderline_flag resolution:

1. **DOC-ALIGN** (if the unscoped posture is deliberate per ADR-CANDIDATE-121 → intentional): Update the live `/features/data-discovery/search` page to disclose: "Search session URLs are bearer tokens — anyone with access to a search session URL has full read + update access to that session. Do NOT share search URLs in bug reports, chat messages, or screenshots; copy the query text instead. ODD will (TODO link to follow-up) add session-scoping in a future release." Also: warn in the operator-facing security doc.

2. **STRUCTURAL** (if the unscoped posture is an oversight, preferred for multi-tenant deployments):
   - Schema migration: `ALTER TABLE search_facets ADD COLUMN owner_id BIGINT REFERENCES owner(id) ON DELETE SET NULL`.
   - Service-tier: `SearchServiceImpl.search` captures the caller's owner via `authIdentityProvider.fetchAssociatedOwner()` and persists it; `updateFacets` and `fetchFacetState` check `WHERE id = ? AND owner_id = ?` (or `owner_id IS NULL` for anonymous-created sessions during DISABLED-mode).
   - Add TTL eviction: `SearchFacetsHousekeepingJob` (already exists per the `V0_0_52` housekeeping framework — currently does NOT include `search_facets`); add a policy that deletes rows where `last_accessed_at < now() - INTERVAL '<TTL>'`.
   - The schema change cascades to the three sibling session tables (per ADR-CANDIDATE-052 — terms / query-examples / reference-data search-sessions inherit the same schema shape).

Option (2) is strictly preferable for multi-tenant deployments; option (1) is acceptable for the read-collaborative-posture stance the platform has consistently adopted.

**Severity rationale**: HIGH — schema-level bearer-token vulnerability affecting four feature surfaces (catalog search, terms search, query-examples search, reference-data search). The UUID space is 122-bit (brute-force infeasible) but URL leakage is real and operator-actionable. The compounding factor with REFACTOR-229 (tsquery injection → permanent session breakage) makes this a real DoS surface.

**Suggested backlog grouping**: `Search session hardening sprint` — couple with REFACTOR-353 NEW (`search_facets` side-effect UPDATE on every read), REFACTOR-354 NEW (`search_facets` rows accumulate without bound), REFACTOR-229 STRENGTHENED (tsquery injection on persisted `query_string`), ADR-CANDIDATE-121 NEW (the architectural decision triage).

---

## ADR-CANDIDATE-121 — Search-session state is BEARER-TOKEN-SHAPED at the schema layer — the `search_facets` table is keyed by `gen_random_uuid()` PRIMARY KEY with NO `owner_id` / `created_by` / `user_id` column; sessions are session-discriminated, NOT user-scoped

**Classification**: promote (borderline_flag — V0_0_1__init.sql TODOs acknowledge UUID/TTL gaps but no comment explicitly defends the unscoped posture)
**Severity**: HIGH
**Pillars affected**: [P-01-data-discovery, P-09-security-access-control]
**Support**: 1 sidecar (batch M `SearchController.facets`) — PRIMARY-SOURCE at schema layer (V0_0_1__init.sql:204-211) + four service-tier corroborations (SearchServiceImpl.search, updateFacets, fetchFacetState, ReactiveSearchFacetRepositoryImpl.get); cross-link batch E `SearchController.search` sidecar (the original surfacing); composes with ADR-CANDIDATE-003 (read-collaborative GET) and ADR-CANDIDATE-052 (search-session as server-state pattern).
**Batch**: M (2026-05-19)

**Surfaced by**:
- `odd-platform__java__SearchController__controller-method__facets.md:implicit_adrs.[2]` (MEDIUM, borderline) — "Search session is bearer-token-shaped by design at the schema layer. The `search_facets` table is defined as `id uuid PRIMARY KEY DEFAULT gen_random_uuid(), query_string varchar(255), filters jsonb` (`V0_0_1__init.sql:204-211`). There is no `owner_id`, no `created_by`, no `user_id` column — the UUID is the sole identifier. The schema-level decision is reinforced at the service layer: `SearchServiceImpl.search` creates a new row WITHOUT capturing the caller's principal (`SearchServiceImpl.java:75-82`); `updateFacets` reads + merges + writes WITHOUT checking ownership (`SearchServiceImpl.java:84-96`); `fetchFacetState(searchId)` does a raw lookup with no owner predicate (`SearchServiceImpl.java:157-160`). The convention is consistent: search sessions are NOT user-scoped state, they are SESSION-DISCRIMINATED state. The TODOs at `V0_0_1__init.sql:206-207` (`TODO: find more clever way to generate uuid` + `TODO: find a way to define TTL`) acknowledge the design has known maintenance gaps but do NOT mark the unscoped posture as a defect."

**Decision statement**: ODD's search-session state (the `search_facets` table populated by `POST /api/search` and read by `GET /api/search/{search_id}` + `GET /api/search/{search_id}/facet/{facet_type}`) is **session-discriminated, NOT user-scoped**. The schema at `V0_0_1__init.sql:204-211` declares:

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

The schema has NO `owner_id`, `created_by`, or `user_id` column. The UUID is the sole identifier. The schema-level decision is reinforced at four service-tier sites:
- **`SearchServiceImpl.search`** (lines 75-82) creates a new row via `searchFacetRepository::create` WITHOUT capturing the caller's principal — the new session has no user binding.
- **`SearchServiceImpl.updateFacets`** (lines 84-96) reads the row by UUID + merges + writes WITHOUT checking ownership — any caller in possession of the UUID can modify the session.
- **`SearchServiceImpl.fetchFacetState(searchId)`** (lines 157-160) does a raw `repository.get(searchId)` with no owner predicate — any caller can read any session.
- **`ReactiveSearchFacetRepositoryImpl.get(UUID)`** (lines 99-106) is an `UPDATE-RETURNING` on `search_facets.last_accessed_at` keyed solely on the UUID with no user predicate.

The decision composes:
- **(a) UUIDs are bearer tokens**: Any user (authenticated under LOGIN_FORM/OAUTH2/LDAP; anonymous under DISABLED) in possession of a UUID has FULL read+update access to that session. Sharing the URL (in a bug report, chat message, screenshot URL bar) hands the recipient full session-driving access.
- **(b) Session lifetime is unbounded**: The `last_accessed_at` field exists in the schema but is NOT consulted by any housekeeping job (`V0_0_52__introduce_housekeeping.sql` has no `search_facets` policy — verified by grep). Sessions accumulate forever; the field is updated but the data is never used.
- **(c) The TODOs at `V0_0_1__init.sql:206-207` acknowledge maintenance gaps but NOT the unscoped posture**: The two TODOs are `TODO: find more clever way to generate uuid` (a maintainability question about UUID generation strategy) and `TODO: find a way to define TTL` (an explicit acknowledgement that session retention is unbounded). Neither marks the absent `owner_id` column as a defect.
- **(d) The pattern is reused across four feature surfaces**: Per ADR-CANDIDATE-052 (NEW 2026-05-12E — "Search-session-as-server-state"), the same UUID-keyed session-discriminated pattern is reused for `/api/terms/search`, `/api/queryexample/search`, `/api/referencedata/search`. All four feature surfaces inherit this schema-level decision (their respective session tables follow the same `id uuid PRIMARY KEY DEFAULT gen_random_uuid()` shape with no user binding — to be verified per session table).

**Wisdom test**: PASS with borderline_flag. The decision IS structural (the schema is the architectural artefact; the schema retains the unscoped shape across all 90+ migrations without an owner column being added); the INTENT is implicit (no comment explicitly defends the absence of an owner column as a positive choice).
1. **Intentional?** BORDERLINE — the schema went into the initial migration this way and HAS NEVER BEEN QUESTIONED IN A SUBSEQUENT MIGRATION (90+ migrations later), suggesting the maintainer's design IS deliberate. The TODOs acknowledge UUID + TTL but not ownership — the omission is consistent with "we don't need ownership here, sessions are short-lived UI state".
2. **Structural impact?** YES — affects four feature surfaces (catalog search, terms search, query-examples search, reference-data search), each with its own UUID-keyed session table; affects every search-driven UI client; affects the per-session state-sharing semantic across users.
3. **Adding `owner_id` would be STRUCTURAL?** YES — schema migration on four tables; service-tier rewrite of session-creation, session-update, and session-read methods (each must capture and check the principal); repository-tier rewrite of `get(UUID)` to `get(UUID, ownerId)`. The change cascades through 4+ session tables.

The borderline_flag carries because the architectural decision IS recognisable in the schema (sessions are session-discriminated by design) but the INTENT is asserted-by-absence (no comment defends it). The maintainer's triage decides whether (a) this IS a deliberate read-collaborative-session posture aligned with ADR-CANDIDATE-003, OR (b) this is a session-management oversight inherited from V0_0_1__init.sql and propagated unintentionally to the three sibling surfaces.

**Evidence**:
- SearchController.facets.md says: "`V0_0_1__init.sql:204-211` (table schema with TODOs) + `SearchServiceImpl.java:75-82` (`search` does not capture principal) + `SearchServiceImpl.java:84-96` (`updateFacets` does no ownership check) + `SearchServiceImpl.java:157-160` (`fetchFacetState` is a raw UUID lookup) + `ReactiveSearchFacetRepositoryImpl.java:99-106` (`get` is a raw UUID UPDATE-RETURNING with no user predicate) — intent_anchor: the schema column list itself + the TODOs that acknowledge UUID/TTL gaps without flagging ownership"

**Existing ADR**: none. **Composes with ADR-CANDIDATE-052** (search-session-as-server-state — the existing ADR documents the four-feature-surface reuse pattern; THIS ADR is the schema-level corollary — sessions are bearer-token-shaped at the schema layer). **Composes with ADR-CANDIDATE-003** (read-collaborative GET — the schema-level shape is the storage corollary of the read-collaborative posture; both decisions accept "any authenticated user reads any state" as the trust model). **Composes with ADR-CANDIDATE-122** (catalog-wide facet counts + myObjects as additional scope — both ADRs share the same trust calculus).

**Cross-link gaps** (refactoring-scopes anchored on consequences this ADR DOES NOT defend):
- **REFACTOR-344 NEW** — `search_facets` table has NO user binding → UUID is a bearer token; an authenticated user with possession of any other user's UUID can READ + UPDATE that session. Concrete impact paths (URL leakage in bug reports / chat / screenshots / referer headers).
- **REFACTOR-354 NEW** — `search_facets` rows accumulate without bound (no TTL eviction). Combined with REFACTOR-344, the table is an unbounded growing pool of bearer-token-shaped session state.
- **REFACTOR-353 NEW** — `search_facets` side-effect UPDATE on every read; `last_accessed_at` is updated but never consulted by housekeeping. Wasted I/O + row-lock contention on concurrent reads.
- (cross-link batch H) **REFACTOR-229 STRENGTHENED** — tsquery operator injection on persisted `query_string` reaches `to_tsquery(?)` via every facet aggregator. The schema's `query_string varchar(255)` field has no escaping at the persistence layer; the injection vector is amplified by the bearer-token-shaped session because an attacker who poisons a session UUID can permanently break facet reads for everyone with that UUID.

**Proposed action**: Promote to `adrs/drafts/search-session-bearer-token-schema.md` (new ADR). Document: (a) the schema-level decision (no `owner_id` column on `search_facets` and three sibling session tables); (b) the four-feature reuse pattern (cross-link ADR-CANDIDATE-052); (c) the trust calculus — sessions are bearer-token-shaped; URLs leak access; the platform's read-collaborative posture is the alignment; (d) the maintainability gaps the TODOs acknowledge (UUID generation, TTL) plus the absence the TODOs do NOT acknowledge (ownership). Cross-link REFACTOR-344 (bearer-token consequence), REFACTOR-354 (unbounded growth), REFACTOR-353 (side-effect UPDATE), REFACTOR-229 (tsquery injection compounded by session-poisoning). Doc-side: the live `/features/data-discovery/search` page should disclose the bearer-token-shaped session semantic so operators sharing URLs know they're sharing access.

The maintainer's borderline_flag triage resolves: (i) the schema-level decision IS deliberate (per the reuse across four surfaces) → ADR codifies and the live doc discloses; OR (ii) the schema-level absence IS oversight → schema migration to add `owner_id` + service-tier per-user gating. Option (i) aligns with the architectural posture of read-collaborative catalog; option (ii) tightens the trust model at the cost of session-sharing UX.

**Severity rationale**: HIGH — schema-level decision affecting four feature surfaces, every search-driven UI client, every third-party API consumer building search integrations. The bearer-token-shaped session is a load-bearing trust assumption that compounds with REFACTOR-229 (tsquery injection → permanent session breakage). Not codified anywhere; the schema TODOs name maintenance gaps but not the trust-model consequence.

---

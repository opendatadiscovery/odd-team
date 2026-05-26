# SHB-016 — Search session UUIDs: GET-is-a-write `last_accessed_at` UPDATE + persistent query-text trail + bearer-token semantics

**Category**: open
**Severity**: MEDIUM

## Hypothesis

Operators see "Search and Filtering" sessions persist beyond a single request because every `POST /api/search` writes a `search_facets` row keyed by a server-generated UUID, and every subsequent `GET /api/search/{id}` and `GET /api/search/{id}/facet/{type}` triggers an `UPDATE search_facets SET last_accessed_at = now() WHERE id = ?` UPDATE-RETURNING — making GETs non-idempotent at the DB layer. The row holds the raw user query text in `query_string varchar(255)` plus the full FacetStateDto as jsonb. The session is bearer-token-shaped at the schema level: NO `owner_id`/`created_by`/`user_id` column, NO TTL enforcement (housekeeping job lacks a `search_facets` policy), and the `last_accessed_at` column is updated but NEVER READ by any code path — the eviction job that the column implies has never landed. F-017 (Search Filter Facets) anchors the session shape and bearer-token observation; this thread anchors the **side-effect-read + persistent-query-trail + dead-column** drift F-017 doesn't fully enumerate.

## Evidence

- `odd-platform-api/src/main/resources/db/migration/V0_0_1__init.sql:204-211` — `search_facets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), query_string varchar(255), filters jsonb)`. TWO TODOs in the migration:
  - line 206: `TODO: find more clever way to generate uuid`
  - line 207: `TODO: find a way to define TTL`
  No owner column. The TODOs acknowledge known gaps.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveSearchFacetRepositoryImpl.java:99-106` — `get(UUID id)` is an `UPDATE search_facets SET last_accessed_at = currentOffsetDateTime() WHERE id = ?` RETURNING. **Every GET is a write.**
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/search/SearchServiceImpl.java:75-82` — `search` creates a row via `searchFacetRepository::create`; does NOT capture the principal.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/search/SearchServiceImpl.java:80` — the persisted row carries the full `FacetStateDto` containing `getQuery()`.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/search/SearchServiceImpl.java:157-160` — `fetchFacetState(searchId)` is a raw UUID lookup with no ownership check.
- `odd-platform-api/src/main/resources/db/migration/V0_0_52__introduce_housekeeping.sql` — grep `search_facets` returns ZERO matches. **The housekeeping job has NO `search_facets` policy** despite the `last_accessed_at` column being updated on every read. The column is dead-weight.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/SearchController.java:30-47` — neither `getSearchFacetList` nor `getFiltersForFacet` carry any `@PreAuthorize` or programmatic permission check.
- Cross-ref: `lineage/odd-platform/understanding/odd-platform__java__SearchController__controller-method__facets.md:bugs_limitations_corner_cases` (the four observations + the side-effect read + the unbounded table growth + the TODO mismatch).

## Notes

- **F-017 anchors the search-session bearer-token observation** (session UUIDs are unguessable but URL-shareable; no per-user binding; any user with another user's UUID reads/updates that session). This thread is the OPERATIONAL SIBLING covering the maintenance defects:
  - **GET is a write**: every read of a session row writes `last_accessed_at`. Concurrent UI tabs on the same session contend for the row lock. Read replicas cannot serve these reads.
  - **Dead column**: `last_accessed_at` is updated but never read by any policy. The implied eviction job has never landed (TODO at `V0_0_1__init.sql:207` acknowledges this).
  - **Unbounded table growth**: every `POST /api/search` adds a row; no TTL eviction; no row deletion on logout; no archive policy. Tables on long-running platforms reach millions of rows.
  - **Persistent query text trail**: `query_string varchar(255)` stores the raw user query verbatim. PII / employee names / customer IDs / GDPR-protected identifiers leave a DB trail readable by anyone with DB access. No redaction, no encryption, no documented PII statement.
- **Cross-link with F-024 (Term Search & Browse)**: TermController, QueryExampleController, and ReferenceDataController all replicate the same session-UUID pattern. The bug-class is platform-wide — fixing one session implementation should fix all four (`/api/search`, `/api/terms/search`, `/api/queryexample/search`, `/api/referencedata/search`).
- **Operator-visible scenarios this thread captures**:
  - User shares a search URL with a colleague via Slack; colleague clicks → reads the user's saved filter state (including raw query text). Bearer-token semantics; F-017 names this.
  - User searches for "Mary Johnson SSN" (PII probe); row persists in `search_facets.query_string` for the platform lifetime (no TTL). Anyone with DB access (DBA, backup, compromised account) reads the trail.
  - Operator scales the platform to N replicas behind a load balancer; concurrent reads on the same session row contend for row locks. Latency increases under load.
  - Operator restarts the platform; `search_facets` rows survive. The user's previous session is still active on the UUID they had. Combined with no logout-on-restart, sessions outlive intended lifetime.
- **The fix shape is bounded**:
  - Add `owner_id` to `search_facets` and predicate every read/update on caller-principal match (closes the bearer-token issue).
  - Drop the `last_accessed_at` write from the read path (make GET idempotent) — OR finally implement the TTL eviction job that the column implies.
  - Add column-level redaction for `query_string` (hash + truncate the persisted version, store the displayable text in jsonb only) — OR implement a `housekeeping.ttl.search_facets_days` (default 30 like the others) and add the search_facets policy to `V0_0_52`.

## Next

1. **REFACTOR-NNN — MEDIUM** — implement the TTL eviction job for `search_facets`. The `last_accessed_at` column already exists and is updated; add a policy to the housekeeping job that deletes rows where `last_accessed_at < now - housekeeping.ttl.search_facets_days` (default 30).
2. **REFACTOR-NNN — MEDIUM** — drop the side-effect UPDATE from `get(id)`. Only update `last_accessed_at` when the eviction job needs it (e.g. as part of a periodic touch from active UI tabs via a different endpoint, OR not at all if the eviction policy is "delete on age").
3. **SEC-NNN — MEDIUM** — add `owner_id` to `search_facets` and predicate `get`, `update`, `delete` on `owner_id = currentPrincipal.ownerId`. Closes the bearer-token semantics.
4. **SEC-NNN — LOW** — query-text redaction policy: hash + truncate persisted `query_string` to a short prefix for analytics, keep the full text only in jsonb if needed.
5. **DOC-NNN** — disclose to operators that search-session UUIDs are bearer-token-shaped and the platform has no per-user binding (until the fix lands). The `/features/data-discovery/search` page is currently silent.
6. **Cluster** with F-017 (the bearer-token observation) and F-024 (Term Search — same session pattern). May merge into F-017 as drift facets.

## Links

- cluster_with: [F-017, F-024]
- merged_into: (open)
- supersedes: []

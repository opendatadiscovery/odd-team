## REFACTOR-352 — `search_facets` rows accumulate WITHOUT BOUND — no TTL eviction, no row deletion on logout, no archive policy; combined with REFACTOR-344 (no user binding) the table is an unbounded growing pool of bearer-token-shaped session state

**Severity**: LOW
**Category**: missing-retention (storage growth)
**Pillars affected**: [P-01-data-discovery, P-08-management-administration]
**Batch**: M (2026-05-19)

**Surfaced by**:
- `odd-platform__java__SearchController__controller-method__facets.md:bugs_limitations_corner_cases.[6]` (LOW) — "**`search_facets` rows accumulate without bound.** Every `POST /api/search` creates a row via `searchFacetRepository::create` (`SearchServiceImpl.java:80`); no TTL eviction, no row deletion on user logout, no archive policy. Operators on long-running platforms see the table grow forever. Combined with item 2 (no user binding), the table is an indefinitely-growing pool of bearer-token-shaped session state with full filter history retained as jsonb."
- `odd-platform__java__SearchController__controller-method__facets.md:performance.scaling_characteristics` (the `Persistent session state in search_facets table` bullet — "On long-running platforms the table can reach millions of rows; the `last_accessed_at` UPDATE on every read keeps every session 'hot' in the table")

**Description**: Every `POST /api/search` creates a new row in `search_facets` (per `SearchServiceImpl.java:75-82` — calls `searchFacetRepository::create`). No mechanism deletes rows:

- **No TTL eviction job**: The `V0_0_52__introduce_housekeeping.sql` migration introduced the housekeeping framework with TTLs for `alert`, `data_entity` (DELETED-status entities), and partition tables. `search_facets` is NOT in any housekeeping policy (verified via Grep on the migration file).
- **No logout-time cleanup**: There is no "delete user's search sessions on logout" hook in the auth path. The bearer-token-shaped UUID has no user binding (REFACTOR-344) so even with a hook the platform can't identify which sessions belong to the logging-out user.
- **No archive policy**: There is no `search_facets_archive` table or `_archived` flag — sessions stay in the hot table forever.

The unbounded growth pattern combined with REFACTOR-344 (no user binding) creates a **bearer-token-shaped session state pool that grows forever**:
- An attacker who creates 1000 sessions per second can rapidly inflate the table (the `POST /api/search` endpoint has no rate limit — see REFACTOR-355 NEW for the search-specific instance).
- The `gen_random_uuid()` PK avoids ID-collision but does NOT prevent storage growth.
- The `jsonb filters` column has no size cap — operators authoring complex filter combinations can produce large payload rows.

**Concrete operator impact**:
- **Storage cost**: On a long-running platform with 100 active users averaging 50 search sessions per day each, the table grows by 1.825M rows / year. With ~1KB average row size (filters jsonb + query_string + UUID + timestamp), that's ~1.8GB / year in the hot table — manageable on modern hardware but unbounded.
- **Query plan degradation**: The `get(id)` query is PK-keyed so the lookup stays O(log N). But the `last_accessed_at` UPDATE on every read (REFACTOR-351) writes to a row in an unbounded table; Postgres VACUUM cost scales with table size.
- **Backup / restore cost**: The table grows in every nightly dump; over years the dump size grows linearly.
- **Privacy implication** (cross-link REFACTOR-344): unbounded bearer-token-shaped session storage means sessions from years ago are still readable to anyone who knows their UUID — including sessions from former employees, deleted accounts, deprecated workflows.

**Primary source citations**:
- `SearchServiceImpl.java:75-82` (the `create` row insertion — no expiry timestamp)
- `V0_0_1__init.sql:204-211` (the schema — no TTL column or trigger)
- `V0_0_52__introduce_housekeeping.sql` (verified by Grep: no `search_facets` policy)
- `V0_0_1__init.sql:206-207` (the `TODO: find a way to define TTL` comment)

**Existing-ADR-or-implied-prescription**: **ADR-CANDIDATE-121 NEW** (batch M — search-session bearer-token-shaped) endorses the schema-level decision; this REFACTOR captures the storage-growth consequence. ADR-CANDIDATE-046 (housekeeping ships opt-out) is the broader framework that this gap fits into — adding a `search_facets` policy would integrate cleanly.

**Proposed remedy**: Add a `SearchFacetsHousekeepingJob` (or extend the existing housekeeping job if it exists) to delete rows where `last_accessed_at < now() - INTERVAL '{ttl}'`:

1. Add to `HousekeepingTTLProperties`: `private int searchFacetsDays = 90;` (90-day default — sessions older than 3 months are evicted).
2. Implement the `HousekeepingJob` interface (per batch D sidecar `HousekeepingJobManager`):
   ```java
   @Component
   class SearchFacetsHousekeepingJob implements HousekeepingJob {
       public void doHousekeeping(Connection conn) {
           DSL.using(conn).deleteFrom(SEARCH_FACETS)
               .where(SEARCH_FACETS.LAST_ACCESSED_AT.lt(now().minusDays(props.getSearchFacetsDays())))
               .execute();
       }
   }
   ```
3. Add migration: optional — add an index on `SEARCH_FACETS.LAST_ACCESSED_AT` to speed up the TTL DELETE (the column is currently unindexed; for tables in the multi-million-row range the DELETE is a full-table scan).

Operator-facing: document the 90-day session TTL on the live `/features/data-discovery/search` page so users know their saved search URLs may expire.

The fix completes the design implied by the V0_0_1__init.sql TODO and reuses the existing housekeeping infrastructure (per ADR-CANDIDATE-046 — housekeeping is the canonical retention framework for ODD's Postgres tables).

**Severity rationale**: LOW — storage cost grows linearly on long-running platforms; the privacy implication is captured under REFACTOR-344. Not MEDIUM because typical operators on modern hardware tolerate the growth; not absent because the LSN-001-shape applies — silent default + unbounded growth is a known anti-pattern in this codebase (cross-link REFACTOR-085 — activity table no retention).

**Suggested backlog grouping**: `Search session hardening sprint` — couple with REFACTOR-344 (no user binding), REFACTOR-351 (side-effect UPDATE on every read), ADR-CANDIDATE-121 NEW.

---

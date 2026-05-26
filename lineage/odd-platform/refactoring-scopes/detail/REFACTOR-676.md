## REFACTOR-676 — `searchRoutes.ts:4`'s `:searchId` URL path-segment is named `searchId` but binds to a SERVER-SIDE SESSION UUID (not a saved-search id, not a query identifier); the name suggests a stable, bookmarkable, user-meaningful handle but the implementation is a transient row-key in `search_facets` that gets MUTATED on every facet change — DRIFT_INPUT_NAME_VS_IMPLEMENTATION Category F with three operator-visible failure modes

**Severity**: MEDIUM
**Category**: name-vs-implementation-drift / Category-F / bookmark-fragility / cross-user-sharing-semantic-leak
**Batch**: ZI (2026-05-26)
**Pillars affected**: [P-01 Data Discovery]

**Surfaced by**:
- `odd-platform__ts__routes__route__search.md:stress_findings.request_inputs[searchId]` DRIFT_INPUT_NAME_VS_IMPLEMENTATION (HIGH) — "**TRANSLATES_SILENTLY.** The name `searchId` promises 'a saved/persistent search identifier'. The implementation uses it as a SERVER-SIDE SESSION ROW UUID — a transient row in `search_facets` that was minted by the most recent `POST /api/search` and that has no user binding, no TTL guarantee at this layer, no 'saved search' semantics. The same row gets MUTATED on every facet change (PUT /api/search/{searchId}/facets). The UUID is not user-meaningful, not bookmarkable in the way 'saved search #42' would be, not durable in the way a saved-search id would be."
- `odd-platform__ts__routes__route__search.md:bugs_limitations_corner_cases[2,3,5]` — "Clicking the 'Catalog' top-nav tab DROPS the current search session" + "Deep-link sharing — `:searchId` UUID has NO user binding" + "No URL state for ANY filter / facet / query / page-position — only the session UUID"
- `odd-platform__ts__routes__route__search.md:stress_findings.name_behavior_pairs[useSearchRouteParams]` MINOR drift — "Type-safety lie: TypeScript callers of `useSearchRouteParams()` see `searchId: string` and may forget to handle undefined. Search.tsx:27 happens to handle it correctly via `if (!routerSearchId)` checks, but a new caller could write `useSearchRouteParams().searchId.toUpperCase()` and crash at runtime on the root `/search` URL."

**Description**: The Catalog route at `/search/{searchId}` exposes a URL parameter named `searchId`. Three claims are made by this naming + URL shape:

1. The name `searchId` reads as "identifier OF a search" — suggesting saved-search semantics, like "search #42" or "my-favourite-search".
2. The URL form `/search/{searchId}` reads as the canonical RESTful "view search id X" — suggesting a stable resource.
3. The TypeScript interface `SearchRouteParams { searchId: string }` (lines 14-16) reads as a non-optional string.

ALL THREE claims diverge from the implementation:

**Implementation reality**:
- `searchId` is a SERVER-GENERATED UUID minted by `POST /api/search` (`SearchController.search` per batch-M sidecar).
- The UUID is the primary key of a row in `search_facets` (per `SearchController` class-level sidecar; per the batch-M REFACTOR-344 invariant).
- The row stores a FacetStateDto (query string + selected facets + my-objects toggle + last-results cursor) — the CURRENT state of the user's search-in-progress.
- The row has NO `owner_id` / NO `created_by` / NO `user_id` (per REFACTOR-344 — schema-level bearer-token shape).
- The row gets MUTATED on every facet change via `PUT /api/search/{searchId}/facets`.
- The row has an unspecified TTL (per emitted probe P-168; per REFACTOR-352 — unbounded; per REFACTOR-351 — `last_accessed_at` exists but the housekeeping job doesn't consult it).

**Operator-visible failure modes**:

1. **Bookmark fragility**: a user bookmarks `/search/{uuid}` expecting "my saved search". If the row is reaped (TTL unknown), the bookmark 404s. The user sees an empty Catalog and doesn't understand why their "saved search" disappeared.

2. **Cross-user sharing exposes whatever state the session has at fetch time**: user A shares `/search/{uuid}` with user B. Between A's last `updateSearchFacets` and B's arrival, no one mutates anything — B sees A's intended state. But if A keeps clicking around their UI (each click mutates the SAME row via PUT /facets), the URL B opens 30 seconds later shows STATE B never expected. The URL doesn't behave like a saved-search id; it behaves like "pointer to whatever this row currently holds".

3. **Tab navigation drops the session**: clicking the Catalog top-nav tab (ToolbarTabs.tsx:38 → `searchPath()` no arg → `/search`) drops the UUID; the user expected their "saved search" would be there when they came back. It isn't — Search.tsx:37-42 creates a fresh empty session via `createDataEntitiesSearch`.

The implementation IS architecturally sound (ADR-CANDIDATE-052 codifies the server-side-stateful-session pattern; the pattern is reused across 4 feature surfaces). The DRIFT is purely in the NAMING: the URL-bearing label `searchId` invites the wrong mental model.

**Evidence**:
- `searchRoutes.ts:3` (BASE_PATH = '/search')
- `searchRoutes.ts:4` (SEARCH_ID_PARAM = ':searchId')
- `searchRoutes.ts:5` (SEARCH_ID = 'searchId')
- `searchRoutes.ts:7-12` (searchPath builder)
- `searchRoutes.ts:14-16` (SearchRouteParams interface)
- `searchRoutes.ts:18-19` (useSearchRouteParams hook)
- batch-M SearchController.search sidecar — `search_facets` row keyed by UUID; PUT mutates the same row; no user binding
- ADR-CANDIDATE-052 (server-side search session) — the architectural decision
- REFACTOR-344 (no user binding); REFACTOR-352 (unbounded growth); REFACTOR-351 (last_accessed_at unused)

**Existing-ADR-or-implied-prescription**: **ADR-CANDIDATE-052** documents the architectural decision but does NOT govern the URL-naming. The drift is the naming gap that the ADR's narrative does not cover.

**Proposed remedy**: Two viable paths (low-cost vs high-churn):

**Path A — Document the semantic at the type level** (low effort, captures the drift):
```tsx
/**
 * @docstring searchId is a server-side session UUID, not a saved-search id.
 * The UUID is the primary key of a `search_facets` row that was minted by
 * `POST /api/search` and that is mutated by every `PUT /api/search/{id}/facets`.
 * The row has no user binding; any authenticated user with the UUID has full
 * READ + UPDATE access to the session state. The row has an unspecified TTL
 * (see REFACTOR-352).
 *
 * Bookmark behaviour: the URL is valid only as long as the row exists.
 * Cross-user sharing: the recipient sees whatever state the session has at fetch time.
 * Tab navigation: clicking the Catalog top-nav tab drops the session.
 */
interface SearchRouteParams {
  searchId: string;
}
```

Also: fix the type-lie (the `as` cast at line 19) by either making the type `Partial` or adding an `isUndefined`-throwing guard at the hook.

**Path B — Rename to `searchSessionId` across the URL contract** (high churn; behaviour-preserving):
- Rename the path-segment, the constants, the hook, the URL form.
- Add a redirect from `/search/{uuid}` → `/search-session/{uuid}` (or keep `/search/:sessionId`) so existing bookmarks degrade gracefully for one release.
- Update the OpenAPI spec for `GET /api/search/{search_id}/*` endpoints — but this would also touch backend code, the four parallel controllers (per ADR-052), and many sibling routes. High blast radius.

**Path C — Document the URL form at the live doc** (zero code change; complements Path A):
- The live doc page `https://docs.opendatadiscovery.org/features/data-discovery/search` (2026-05-26 status 200) makes NO mention of the URL form at all. A one-paragraph addition explaining the session-UUID semantics, bookmark fragility, cross-user sharing implications, and tab-navigation behaviour closes the doc-side gap.

**Recommended**: Path A (low-cost JSDoc + type fix) + Path C (doc-side disclosure). Path B is over-investment for an architecturally-sound feature whose naming is the only gap.

**Severity rationale**: MEDIUM — operator-facing semantic gap with three concrete failure modes; severity bounded by the fact that the implementation IS architecturally sound (ADR-052) and the failure modes are usability issues, not data-loss or security. Severity reinforced by the doc-side absence (operators have no documented signal about the URL semantics).

**Suggested backlog grouping**: `UI architecture codification` + `DOC-NNN companion`.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-344 (no user binding — this scope is the URL-side manifestation of the same architectural absence); REFACTOR-352 (unbounded growth — bookmark fragility depends on the TTL question); ADR-CANDIDATE-052 (server-side session — this is the URL-naming gap the ADR does not cover).
- SUPERSEDES: none.
- CONFLICTS: none.

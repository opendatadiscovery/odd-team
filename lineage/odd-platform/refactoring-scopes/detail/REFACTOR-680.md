## REFACTOR-680 — `/search/:searchId` route has NO UUID-shape validation; any string is routed to `<Search/>`; `GET /api/search/{garbage}` returns 404; the UI surfaces an empty Catalog (zero results) indistinguishable from "no matches" — operator cannot distinguish "malformed deep-link" from "search session reaped" from "genuinely empty result set"

**Severity**: MEDIUM
**Category**: missing-validation / silent-failure-mode-overlap / opaque-error-presentation
**Batch**: ZI (2026-05-26)
**Pillars affected**: [P-01 Data Discovery]

**Surfaced by**:
- `odd-platform__ts__routes__route__search.md:bugs_limitations_corner_cases[1]` (MEDIUM) — "**No validation that `:searchId` is a real (or even well-formed) UUID before mounting `<Search/>`.** Any string in the segment routes to `<Search/>`; Search.tsx:44-48 then fires `GET /api/search/{garbage}` which returns 404; the redux thunk's `handleResponseAsyncThunk` (per redux/lib/handleResponseThunk pattern) typically surfaces the error as a toast OR silently — the user sees an empty Catalog (zero results) which is indistinguishable from 'no matches' for an authentic search."

**Description**: The Catalog route at `/search/:searchId` uses React Router's wildcard match without a UUID-shape constraint. The route declaration at `App.tsx:61` is `<Route path={\`${searchPath()}/*\`} element={<Search/>}/>` — the wildcard accepts any string in the URL segment, including:
- A valid UUID for an existing `search_facets` row (normal case).
- A valid UUID for a row that was reaped (TTL question per REFACTOR-352 / probe P-168).
- A malformed string the operator typed by mistake (`/search/asdfasdf`).
- A non-UUID-shape string from a stale bookmark.
- Any other input.

In all four cases the route renders the SAME `<Search/>` component. The component (`Search.tsx:44-48`) then fires `GET /api/search/{routerSearchId}`. The backend `SearchController.getFacetList(searchId)` (per batch-M sidecar) parses the path-segment via `UUID.fromString(...)` — for non-UUID inputs this either:
- Throws `IllegalArgumentException` (caught by Spring's exception handler → 400).
- For a valid UUID-shape that doesn't exist in `search_facets`, returns 404.

Either way the UI's `handleResponseAsyncThunk` surfaces the error. The visible result depends on the error-handling path:
- Toast notification (transient — operator may miss it).
- Empty results view (Catalog renders with no rows + no facets).

**The class of confusion**: an operator looking at an empty Catalog cannot tell whether:
1. Their genuine search returned zero matches (legitimate empty result).
2. The session was reaped (legitimate empty result for a stale bookmark).
3. The URL is malformed (the bookmark / link is wrong).

All three present identically in the UI. The operator's troubleshooting path requires DEV-TOOLS network-tab inspection to distinguish 404 from 200-with-empty-results.

**Why this is route-layer-relevant**: React Router 6 supports path-pattern constraints (`<Route path="/search/:searchId([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})" />` — UUID regex). With a constraint, malformed URLs would fall through to a 404 page rather than render `<Search/>`. The route declaration as written rejects no input.

**Evidence**:
- `odd-platform-ui/src/components/App.tsx:61` (route declaration with `/*` wildcard)
- `odd-platform-ui/src/routes/searchRoutes.ts:9` (the builder produces UUID-shaped URLs)
- `odd-platform-ui/src/components/Search/Search.tsx:44-48` (the unguarded fetch on URL change)
- batch-M SearchController.getFacetList (the backend that returns 400/404 for invalid input)
- `redux/thunks/.../handleResponseThunk` (the error-handler pattern)

**Existing-ADR-or-implied-prescription**:
- **ADR-CANDIDATE-052** (server-side search session) — the architectural decision; this scope is the operator-presentation gap that the ADR's narrative does not cover.
- **REFACTOR-676 NEW this batch** (`searchId` name vs implementation drift) — composes; both scopes are operator-presentation gaps on the search route.

**Proposed remedy**: Three layered options:

**Option 1 — Add UUID-shape constraint at the React Router route declaration**:
```tsx
<Route path="/search/:searchId([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/*" element={<Search />} />
```
(React Router 6 syntax — pattern constraint via regex.) Malformed URLs would fall through to a 404 page. Bookmarked-but-reaped UUIDs would still pass the regex (valid UUID shape) so this only catches typos / random strings.

**Option 2 — Distinguish 404 from empty-result in the UI**:
- The redux thunk's error handler should branch on response status:
  - 400 (malformed) → show "Invalid search URL" page with link to `/search`.
  - 404 (reaped or non-existent) → show "Search session not found — it may have expired" page with link to `/search`.
  - 200 with empty results → keep current empty-Catalog rendering.
- This requires `handleResponseAsyncThunk` (or the Search.tsx component) to surface the status, not just swallow the error.

**Option 3 — Both Options 1 + 2**:
Defense in depth. Option 1 cheaper (one line); Option 2 is the proper operator-presentation fix.

Recommended: Option 2 (the UX gap is the operator-actionable one). Option 1 is a nice-to-have.

**Severity rationale**: MEDIUM — operator-visible workflow gap (cannot distinguish three different failure modes); severity bounded by the fact that the malformed-URL case is rare for typical operator workflows (most URLs come from in-app navigation, not hand-typed). Severity reinforced for cross-time bookmark-fragility scenarios composed with REFACTOR-352 (unbounded growth = TTL ambiguity).

**Suggested backlog grouping**: `Search UX clarity sprint` (composes with REFACTOR-676 — name-vs-implementation drift; REFACTOR-352 — bookmark fragility).

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-676 (search route name drift); REFACTOR-352 (search_facets unbounded growth); ADR-CANDIDATE-052 (server-side search session).
- SUPERSEDES: none.
- CONFLICTS: none.

## REFACTOR-718 — Search.tsx race: in-flight facet `updateDataEntitiesSearch` PUT vs synchronous text-query `updateDataEntitiesSearch` PUT — both target same `/api/search/{uuid}` with DIFFERENT SearchFormData payloads; whichever resolves second wins; the facet selection may be DISCARDED if text-query resolves second (filters: {} payload from text-query path)

**Severity**: LOW
**Category**: race-condition / cross-channel-payload-conflict
**Batch**: ZL (2026-05-26)
**Pillars affected**: [P-01 Data Discovery (Catalog)]

**Surfaced by**:
- `odd-platform__ts__react-component__component__Search.md:bugs_limitations_corner_cases[5]` (LOW) — "**Race: in-flight `updateDataEntitiesSearch` for facets vs synchronous `updateDataEntitiesSearch` for text-query.** IDENTICAL race shape to TermSearch batch-U bugs[4]. When the user (a) clicks a facet (debounced — fires immediately due to leading-edge AND the per-click-recreate bug above), then (b) types a query and hits Enter within the PUT round-trip window. Both calls hit `PUT /api/search/{searchId}` with DIFFERENT `SearchFormData` payloads — facet payload includes `filters: mapValues(searchFacetParams, values)` + the prior query + myObjects flag; text-query payload includes `filters: {}` + the new query (MainSearchInput.tsx:44 sends empty filters). Whichever resolves SECOND wins via `updateSearchState`. **The facet click's filter selections may be DISCARDED if the text-query resolves second** — the user clicked a facet, hit Enter on the search, and the search overwrote the facet selection." — evidence: Search.tsx:53-58 (facet dispatch with prior filters) + MainSearchInput.tsx:42-48 (text dispatch with `filters: {}`) + slice.ts:40-103 (updateSearchState replaces or merges based on searchId equality) — severity: LOW
- `odd-platform__ts__react-component__component__Search.md:stress_findings.resource_boundaries.concurrency` (HIGH) — "Yes — see bugs section [5] (facet-vs-text-query race). Two concurrent PUTs to /api/search/{searchId} with different SearchFormData payloads result in whichever resolves second winning via updateSearchState. The slice's assignFacetStateWithNewFacets handles racing PUTs by preserving local `selected !== syncedFilterState.selected` divergences — but the text-query PUT carries empty filters {}, so the merge logic incorrectly accepts the empty filters as authoritative if text-query resolves second."

**Statement**: Search.tsx has TWO independent dispatch paths to the same `PUT /api/search/{searchId}` endpoint:

1. **Facet path** — Search.tsx:50-71 (debounced, leading-edge): `updateDataEntitiesSearch({ searchId, searchFormData: { query: searchQuery, myObjects: searchMyObjects, filters: mapValues(searchFacetParams, values) } })`. Payload includes the LATEST facet state + PRIOR query/myObjects.

2. **Text-query path** — MainSearchInput.tsx:42-48 (synchronous on Enter / search-click): `updateDataEntitiesSearch({ searchId: storedSearchId, searchFormData: { query, pageSize:30, filters: {} } })`. Payload includes the NEW query + EMPTY filters.

If a user clicks a facet (path 1 fires) then types in the search input and hits Enter within the PUT round-trip window (path 2 fires), TWO PUTs are in flight to the same UUID with different payloads:
- Path 1 carries `filters: { facet1: [...], facet2: [...] }` (the user's selection)
- Path 2 carries `filters: {}` (because MainSearchInput.tsx doesn't read current facet state — it constructs a fresh payload)

Whichever PUT resolves SECOND wins via `updateSearchState` (slice.ts:40-103). If path 2 wins:
- The user's facet selections are OVERWRITTEN with `filters: {}`
- The facet UI may briefly show the selections (from local state) before the next selector run reads the EMPTY filters from the slice
- The user sees facets snap back to "All" — their selections disappeared

The slice's `assignFacetStateWithNewFacets` (slice.ts:73-86) tries to preserve local `selected !== syncedFilterState.selected` divergences, but the merge logic operates on the synced state from the server — if the server's authoritative state is `filters: {}` (from path 2), the merge has nothing to preserve.

**Operator-visible impact**:
- Rare in practice (requires the specific sequence: facet click → text-query → Enter within 200-500ms)
- When triggered: user-perceptible as "I selected a facet, my filter disappeared after I searched"
- No persistent corruption (the state converges to whatever path 2 sent)
- Recovery: user re-clicks the facet (will be lost again if they retype)

**Evidence**:
- `Search.tsx:50-71` — facet-path dispatch with `mapValues(searchFacetParams, values)`
- `Search.tsx:53-58` — the specific payload construction
- `MainSearchInput.tsx:42-48` — text-query dispatch with `filters: {}`
- `MainSearchInput.tsx:44` — the literal `filters: {}` in the payload
- `dataentitiesSearch.thunks.ts:34-41` — `updateDataEntitiesSearch` thunk (single endpoint)
- `slice.ts:40-103` — `updateSearchState` reducer (single resolver for both paths)
- `slice.ts:73-86` — `assignFacetStateWithNewFacets` merge logic
- TermSearch.tsx (batch U) — IDENTICAL race shape on the sibling Dictionary surface

**Existing-ADR-or-implied-prescription**: The architecture has TWO independent paths to one endpoint (facet path + text-query path) without coordination. The cleanest fix is to FUNNEL both through a single dispatch path that reads the LATEST state:

- Option A: MainSearchInput.tsx reads the current facet state from Redux and includes it in the payload
- Option B: Centralise the dispatch in Search.tsx; MainSearchInput.tsx dispatches an action that triggers Search.tsx to update its `searchQuery` Redux slot; Search.tsx's debouncer picks up the change
- Option C: Use Redux Toolkit's built-in requestId for stale-response protection (cross-link REFACTOR-277)

**Proposed remedy**:

Option A is the minimal change:
```tsx
// MainSearchInput.tsx:42-48 — read current facet state
const searchFacetParams = useAppSelector(getSearchFacetsData);
// ...
dispatch(updateDataEntitiesSearch({
  searchId: storedSearchId,
  searchFormData: {
    query,
    pageSize: 30,
    filters: mapValues(searchFacetParams, values),  // <-- preserves current facets
  },
}));
```

Effort: small; one-file change. Closes the race for the most common scenario (facet click before text-query).

**Severity rationale**: LOW — the defect:
- Is RARE in practice (requires specific timing)
- Has NO persistent corruption (state converges)
- Is RECOVERABLE (user re-clicks)
- Has a small fix cost

Not zero because:
- The race is operator-perceptible as "filter disappeared" — a confusing UX
- Pattern is replicated in TermSearch.tsx (clone-bug)
- Fix is cheap and well-understood

**Suggested backlog grouping**: `LSN-017 dep-array hardening sprint` — pair with REFACTOR-715, REFACTOR-716, REFACTOR-717 (Search.tsx defect cluster) and TermSearch batch-U bugs[4] (the clone). Also pair with REFACTOR-277 (handleResponseAsyncThunk requestId-not-propagated — sibling stale-response class on a different surface).

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-715 + REFACTOR-716 + REFACTOR-717 NEW this batch (sibling Search.tsx defects); REFACTOR-277 (handleResponseAsyncThunk requestId protection — sibling pattern); ADR-CANDIDATE-052 (server-side search session — the unified endpoint that this race targets).
- SUPERSEDES: none.
- CONFLICTS: none.

---

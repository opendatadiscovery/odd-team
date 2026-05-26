## REFACTOR-714 — LookupTables search input fires `updateFacets({...facets, query})` per keystroke if `SearchInput` does not debounce internally — every keystroke is a PUT `/api/referencedata/search/{id}` to recompute server-side FacetStateDto + countByState

**Severity**: MEDIUM
**Category**: missing-debounce / per-keystroke-backend-write
**Batch**: ZL (2026-05-26)
**Pillars affected**: [P-03 Master Data Management]

**Surfaced by**:
- `odd-platform__ts__react-component__component__LookupTables.md:bugs_limitations_corner_cases[5]` (MEDIUM) — "`SearchInput.onSearch={handleSearch}` (line 70) fires `updateFacets({...facets, query})` per keystroke if `SearchInput` does not debounce. Each fire is a PUT `/api/referencedata/search/{id}` — server-side facet recomputation per keystroke. Worth probing (`SearchInput` is shared infra; its debounce policy is out of this file's scope)." — evidence: LookupTables.tsx:50-52, 70 — severity: MEDIUM
- `odd-platform__ts__react-component__component__LookupTables.md:performance.known_performance_gaps[0]` (MEDIUM) — "Per-keystroke PUT to /api/referencedata/search/{id} if SearchInput is not debounced — needs verification on the shared SearchInput component."

**Statement**: `LookupTables.tsx:50-52` defines `handleSearch`:
```tsx
const handleSearch = (query: string) => {
  updateFacets({ ...facets, query });
};
```

`LookupTables.tsx:70` passes `handleSearch` to `<SearchInput placeholder={t('Search lookup tables...')} onSearch={handleSearch} />`. The `SearchInput` component is shared infrastructure (`components/shared/elements/...`) — its internal debounce policy is not visible from this sidecar.

If `SearchInput` does NOT debounce internally:
- Every keystroke fires `handleSearch(currentText)` → `updateFacets(...)` → `useUpdateReferenceDataSearch(searchId).mutate({ ... })` → `PUT /api/referencedata/search/{id}` request
- Server-side `LookupDataSearchServiceImpl.updateFacets` merges with existing FacetStateDto and recomputes `countByState`
- For a 10-character search query, that's 10 PUTs in rapid succession
- Each PUT is a session-state write + facet recompute (cost ~10ms each at scale)

If `SearchInput` DOES debounce internally (typical pattern would be 250-500ms):
- Only the LAST keystroke after the debounce window fires
- 1 PUT per typing-pause; 10-character query becomes 1-3 PUTs depending on typing speed

**Operator-visible impact** (assuming no debounce):
- Slight latency on rapid typing (the search-input UI may feel snappy but the network tab shows many concurrent requests)
- Server-side load amplified Nx per user search (where N = #characters typed)
- Race condition: concurrent PUTs with different `query` values; whichever resolves second wins per `assignFacetStateWithNewFacets` semantics
- For high-traffic deployments, server-side facet recomputation becomes a perceptible cost

The fix scope depends on the debounce-vs-no-debounce verdict, which requires verifying `SearchInput`'s implementation.

**Evidence**:
- `LookupTables.tsx:50-52` — `handleSearch` body
- `LookupTables.tsx:70` — `<SearchInput onSearch={handleSearch}>` callsite
- `referenceDataSearch.ts:28-40` — `useUpdateReferenceDataSearch` mutation wrapper
- `LookupDataSearchServiceImpl.java:42-50` — `updateFacets` body (server-side merge + countByState)
- contrast: Search.tsx (Catalog) uses an explicit 1500ms debouncer (broken per REFACTOR-716, but the INTENT is debounce); the LookupTables surface has no debouncer at the call-site level
- shared infra: `SearchInput` debounce policy needs verification (PROBE-NEEDED — out of this file's scope)

**Existing-ADR-or-implied-prescription**: Comparable surfaces in the codebase use debouncers:
- Search.tsx Catalog uses `useDebouncedCallback(..., 1500ms, {leading: true})` for facet updates (per Search.tsx batch ZL sidecar)
- TermSearch.tsx Dictionary uses the same pattern
- Activity Filters do NOT debounce (per Activity.tsx batch ZL bugs[3])
- Dashboard filter autocompletes have NO debounce (REFACTOR-597)

The platform's posture is inconsistent — debouncers are added per-surface, not architecturally. The fix scope is to ADD debounce at the LookupTables surface (matching Search/TermSearch pattern).

**Proposed remedy**: Two options:

1. **LOWEST cost — verify and (if needed) add debounce at LookupTables surface**:
   - Verify `SearchInput`'s internal debounce policy (read `SearchInput.tsx` — out of this scope)
   - If absent: wrap `handleSearch` in `useDebouncedCallback(..., 500ms, {leading: false})`
   - Effort: small once the shared-infra question is answered

2. **MEDIUM cost — add debounce to `SearchInput` itself (shared infra)**:
   - Add a `debounceMs` prop to `SearchInput` with a default (e.g., 500ms)
   - Every consumer benefits without per-call-site changes
   - Trade-off: changes existing consumers' behaviour (may break tests, may surprise developers expecting immediate-fire)
   - Effort: medium; requires touching shared infra + verifying every consumer

**Recommended**: Option 1 for short-term (one-surface fix). Option 2 if the inconsistency across the codebase is being addressed system-wide.

**Severity rationale**: MEDIUM — the defect:
- Affects backend load proportionally to typing rate
- Is invisible to operators on fast networks (UI feels snappy)
- Becomes visible at scale (high-throughput deployments see DB load spikes per search interaction)
- Has a low fix cost

Not HIGH because:
- No correctness bug (the eventual state converges; last-write-wins is acceptable for a search query)
- Most operators don't generate enough load to trigger backend pressure
- The shared `SearchInput` may already debounce (PROBE-NEEDED)

Not LOW because:
- The per-keystroke PUT is a clear architectural smell
- Server-side facet recomputation has measurable cost
- Pattern across the codebase is inconsistent (some surfaces debounce, others don't)

**Suggested backlog grouping**: `DOC-NNN Master Data Management pillar fix sprint` — pair with REFACTOR-711, REFACTOR-712, REFACTOR-713. Also pair with REFACTOR-597 (Dashboard filter autocomplete no-debounce) and REFACTOR-716 NEW this batch (Search facet debouncer broken) — sibling debounce-related defects across the codebase.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-597 (Dashboard autocomplete no-debounce); REFACTOR-716 NEW this batch (Search facet debouncer recreation bug — different surface, same class of "debounce-intent unfulfilled").
- SUPERSEDES: none.
- CONFLICTS: none.

---

## REFACTOR-716 — Search.tsx debouncer is RECREATED on every facet-state change — `useCallback(useDebouncedCallback(..., 1500, {leading: true}), [searchId, searchFacetParams])` includes `searchFacetParams` in deps which changes per click; each click constructs a NEW debouncer instance; the 1500ms rate-limit intent is unfulfilled. Every facet click immediately dispatches a PUT. IDENTICAL shape to TermSearch.tsx batch-U bugs[2]

**Severity**: MEDIUM
**Category**: hook-pattern-error / debounce-intent-unfulfilled
**Batch**: ZL (2026-05-26)
**Pillars affected**: [P-01 Data Discovery (Catalog), P-06 Data Glossary (Dictionary — TermSearch.tsx clone)]

**Surfaced by**:
- `odd-platform__ts__react-component__component__Search.md:bugs_limitations_corner_cases[3]` (MEDIUM) — "**Debouncer is RECREATED on every facet-state change — losing the rate-limit semantics. IDENTICAL bug to TermSearch batch-U bugs[2].** Lines 50-65: `useCallback(useDebouncedCallback(..., 1500, {leading: true}), [searchId, searchFacetParams])`. The `useCallback` deps include `searchFacetParams` — which changes on every facet click. Each click constructs a NEW `useDebouncedCallback(...)` instance — the prior debouncer's pending timer is unreachable. With `{leading: true}`, the new debouncer fires on its FIRST call (immediately) AND would defer a trailing call until 1500ms — but the trailing call NEVER fires because the next click constructs yet another debouncer. **Effective behaviour: every facet click dispatches `updateDataEntitiesSearch` immediately; the 1500ms 'debounce' is not actually rate-limiting anything.** A user rapidly clicking 5 facets in 2 seconds dispatches 5 PUT calls instead of the intended 1. **The pattern is structurally identical to TermSearch batch-U finding** — both files were written by the same author/period and the bug propagated through clone." — severity: MEDIUM
- `odd-platform__ts__react-component__component__Search.md:stress_findings.name_behavior_pairs[1]` (PROBE-NEEDED) — "updateSearchFacets: Debounce facet-state mutations and push them to the server in batches every 1500ms. Implementation: useCallback wraps useDebouncedCallback with deps [searchId, searchFacetParams]. Because searchFacetParams changes on every facet click, the useCallback recreates the debouncer on every click, defeating the debounce. Effective behaviour: every click dispatches immediately. ... User clicking 5 facets in 2 seconds triggers 5 PUT calls instead of the intended 1. Server-side load amplifies 5x for rapid filter sessions. Pattern parity with TermSearch batch-U bugs[2]."
- `odd-platform__ts__react-component__component__Search.md:performance.known_performance_gaps[0]` (MEDIUM) — "**Broken debouncer — 1500ms intent not realised; every facet click dispatches.** ... **Architectural fix point: this is the SAME bug shape as TermSearch batch-U — fix BOTH files in one refactor.** Probe P-189 will pin dispatch cardinality under rapid clicking."

**Statement**: `Search.tsx:50-65` declares:
```tsx
const updateSearchFacets = useCallback(
  useDebouncedCallback(
    () => {
      dispatch(updateDataEntitiesSearch({
        searchId,
        searchFormData: {
          query: searchQuery,
          myObjects: searchMyObjects,
          filters: mapValues(searchFacetParams, values),
        },
      }));
    },
    1500,
    { leading: true }
  ),
  [searchId, searchFacetParams]   // <-- searchFacetParams changes on every facet click
);
```

The `useCallback` has `searchFacetParams` in its deps. Every facet click changes `searchFacetParams` (the facet-state Redux selector). React detects the dep change and RECREATES the wrapped value — i.e. `useDebouncedCallback(...)` is called AGAIN, producing a NEW debouncer instance with a fresh internal timer.

With `{leading: true}`:
- New debouncer's FIRST call fires IMMEDIATELY (no wait)
- Trailing call would be deferred 1500ms
- But the NEXT facet click recreates the debouncer; the PRIOR debouncer's timer is unreachable (garbage-collected with its closure)

Effective behaviour:
- User clicks facet 1 → debouncer A created → leading-edge fires immediately → PUT #1 dispatched
- User clicks facet 2 (within 1500ms) → debouncer A recreated as debouncer B → leading-edge fires immediately → PUT #2 dispatched
- ...
- 5 clicks in 2 seconds → 5 PUTs

The 1500ms rate-limit is NEVER realised. The intent (coalesce rapid clicks into ONE PUT) is unfulfilled.

**Cross-file architectural concern**: TermSearch.tsx (batch U) has the IDENTICAL pattern with the IDENTICAL bug. Both files were apparently authored from the same template; the bug propagated through clone. Fixing Search.tsx alone leaves TermSearch.tsx still broken.

**Operator-visible impact**:
- Server-side load amplified Nx per rapid-facet-clicking interaction
- For 5-facet-quick-fire scenarios (common during faceted browsing): 5 PUTs instead of 1
- Backend-side cost per PUT: session-state write + 4-Mono `Mono.zip` count recompute → ~50-200ms per PUT
- 5 PUTs in 2 seconds = 250-1000ms of unnecessary backend work
- For high-traffic deployments, this is a measurable load amplifier

The UI is RESPONSIVE (the leading-edge fire gives immediate feedback) so operators don't notice the bug — the cost is borne entirely by the backend.

**Evidence**:
- `Search.tsx:50-65` — the broken `useCallback` + `useDebouncedCallback` chain
- `Search.tsx:64` — the deps array `[searchId, searchFacetParams]`
- `TermSearch.tsx` (batch U) — IDENTICAL pattern in the sibling file
- contrast: a CORRECT pattern would be `useMemo(() => useDebouncedCallback(...), [searchId])` — only re-create when `searchId` changes; the closure captures latest `searchFacetParams` via `useRef` or via reading at dispatch time
- P-189 probe — emitted to measure dispatch cardinality under rapid clicking

**Existing-ADR-or-implied-prescription**: There's no ADR governing debouncer construction; the pattern is a per-callsite implementation. The fix is the canonical React idiom: hoist the debouncer outside `useCallback`, or use `useRef` to keep the same debouncer instance across re-renders.

**Proposed remedy**:

```tsx
// Search.tsx — corrected version
const dispatchRef = useRef<() => void>();
dispatchRef.current = () => {
  dispatch(updateDataEntitiesSearch({
    searchId,
    searchFormData: {
      query: searchQuery,
      myObjects: searchMyObjects,
      filters: mapValues(searchFacetParams, values),
    },
  }));
};

const updateSearchFacets = useDebouncedCallback(
  () => dispatchRef.current?.(),
  1500,
  { leading: true }
);

useEffect(() => {
  if (!searchFacetsSynced) updateSearchFacets();
}, [searchFacetParams, searchFacetsSynced]);   // dep fix from REFACTOR-715
```

Pattern: keep a single debouncer instance via no-deps `useDebouncedCallback`; capture the latest dispatch shape via `useRef`. The debouncer's internal timer survives re-renders.

Effort: small. Touches one file (Search.tsx) plus the sibling TermSearch.tsx for parity. Verify with P-189.

**Severity rationale**: MEDIUM — the defect:
- Amplifies backend load proportionally to facet-click rate
- Is INVISIBLE to operators (the UI feels snappy due to leading-edge fire)
- Is a CLONE bug (Search.tsx + TermSearch.tsx) — fixing one without the other leaves half the surface broken
- Has a low fix cost

Not HIGH because:
- No correctness bug (the eventual state converges; last-write-wins is fine for facet state)
- Most operators don't generate enough load to trigger backend pressure
- The `assignFacetStateWithNewFacets` reducer at slice.ts:73-86 handles racing PUTs correctly

Not LOW because:
- The defect is class-LSN-017-adjacent (deps and behaviour out of sync)
- The cost amplifies during high-traffic deployments
- The clone-bug shape (Search + TermSearch) is a signal that the React-hook discipline needs strengthening codebase-wide

**Suggested backlog grouping**: `LSN-017 dep-array hardening sprint` — pair with REFACTOR-715 NEW this batch (Search dep-array smells), TermSearch batch-U bugs[2] (the clone). Also pair with REFACTOR-602 (MultipleFilterItemAutocomplete dep-array bug) and REFACTOR-714 NEW this batch (LookupTables per-keystroke PUT — sibling debounce-shape concern).

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-715 NEW this batch (sibling dep-array bug on the same Search.tsx); LSN-017 (case-law anchor); REFACTOR-602 (MultipleFilterItemAutocomplete dep-array bug — same hook-discipline failure class on a different surface).
- SUPERSEDES: none.
- CONFLICTS: none.

---

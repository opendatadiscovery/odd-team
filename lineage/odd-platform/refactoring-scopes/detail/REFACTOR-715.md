## REFACTOR-715 — Search.tsx LSN-017 dep-array smell pair — Smell #1: the createSearch useEffect at lines 37-42 reads THREE state values (`routerSearchId`, `isSearchCreating`, `searchId`) but the deps array contains only TWO (`searchId` missing); composition is correct by ACCIDENT via React batch ordering. Smell #3: the facet-update useEffect at lines 67-71 reads `searchFacetsSynced` in the condition but ONLY `searchFacetParams` is in deps — active re-fire vector

**Severity**: HIGH (Smell #3 — active LSN-017 class) / MEDIUM (Smell #1 — latent regression vector)
**Category**: dep-array-incomplete / LSN-017-class
**Batch**: ZL (2026-05-26)
**Pillars affected**: [P-01 Data Discovery (Catalog)]

**Surfaced by**:
- `odd-platform__ts__react-component__component__Search.md:bugs_limitations_corner_cases[0]` (MEDIUM) — Smell #1 "**LSN-017-adjacent dep-array smell #1 — incomplete deps on createSearch effect.** Lines 37-42: `useEffect(() => { if (!routerSearchId && !isSearchCreating && !searchId) createSearch({query:'',pageSize:30,filters:{}}); }, [routerSearchId, isSearchCreating]);`. The guard reads THREE state values (`routerSearchId`, `isSearchCreating`, `searchId`) but the deps array contains only TWO of them — `searchId` is MISSING. ... **The composition is correct *by accident*:** on session-create-success, the thunk fulfilment writes `searchId` to Redux AND `useCreateSearch.ts:18` calls `navigate(searchPath(searchId))` which updates `routerSearchId` — both transitions happen in the same render-batch, so the re-fire's guard correctly evaluates as `(false && ... && false) === false` and skips. **But the dep-array does not document this invariant** — a refactor changing the navigate-vs-redux ordering would surface a real double-create. **This is the IDENTICAL shape to TermSearch batch-U bugs[0] LSN-017-adjacent smell** — the defect is latent in both files, masked by React batch ordering. Same class as LSN-017 view_count case (deps and conditions out of sync); different code instance." — severity: MEDIUM
- `odd-platform__ts__react-component__component__Search.md:bugs_limitations_corner_cases[2]` (HIGH) — Smell #3 "**LSN-017-adjacent dep-array smell #3 — `searchFacetsSynced` read in condition but MISSING from deps (ACTIVE re-fire vector — IDENTICAL to TermSearch batch-U bugs[1]).** Lines 67-71: `useEffect(() => { if (!searchFacetsSynced) updateSearchFacets(); }, [searchFacetParams]);`. The guard reads `searchFacetsSynced` but the deps array contains ONLY `searchFacetParams`. ... The selector `getSearchFacetsData` (per redux/selectors/dataentitySearch.selectors.ts:129-133) may also produce fresh object references on every selector run (via `mapValues(searchFacetParams, values)` in the dispatch payload at line 56), driving the effect to re-fire on every render during the in-flight PUT window. **Possible doubling shape per LSN-017 — class-match.**" — severity: HIGH

**Statement**: Two dep-array smells in Search.tsx, both same class as LSN-017 view_count case (the deps-array does NOT match the read-set of the effect body's guard):

**Smell #1 — createSearch effect (Search.tsx:37-42)**:
```tsx
useEffect(() => {
  if (!routerSearchId && !isSearchCreating && !searchId) {
    createSearch({ query: '', pageSize: 30, filters: {} });
  }
}, [routerSearchId, isSearchCreating]);  // <-- searchId is MISSING
```
The guard reads three values; deps include only two. The current behaviour is correct ONLY because:
- On session-create-success, `useCreateSearch.ts:18` dispatches `navigate(searchPath(searchId))` which updates `routerSearchId`
- The thunk fulfilment writes `searchId` to Redux in the SAME render-batch
- The effect re-fires when `routerSearchId` changes (which is now truthy)
- The guard `(false && ... && false) === false` skips

The composition is CORRECT BY ACCIDENT. A refactor that changes the navigate-vs-redux dispatch ordering (or that introduces an async boundary between them) would break the invariant and cause double-create.

**Smell #3 — facet-update effect (Search.tsx:67-71)**:
```tsx
useEffect(() => {
  if (!searchFacetsSynced) updateSearchFacets();
}, [searchFacetParams]);  // <-- searchFacetsSynced is MISSING
```
The guard reads `searchFacetsSynced`; deps include only `searchFacetParams`. When a facet click changes `searchFacetParams`, the effect re-fires; the guard `(!searchFacetsSynced)` is true → dispatch updateSearchFacets.

After the thunk fulfils, `slice.ts:97` sets `isFacetsStateSynced: true`. The effect does NOT re-fire when this transitions (because `searchFacetsSynced` isn't in deps). But the `getSearchFacetsData` selector (per redux/selectors/dataentitySearch.selectors.ts:129-133) may produce FRESH OBJECT REFERENCES on every selector run (via `mapValues(searchFacetParams, values)`) — driving the effect to re-fire on every render during the in-flight PUT window. This is the LSN-017 doubling class.

**Operator-visible impact**:
- Smell #1: latent — no observable defect today but a refactor-time bomb. A future maintainer changing useCreateSearch.ts to a different navigation-vs-dispatch ordering will see double-creates.
- Smell #3: active — every facet click may dispatch the PUT multiple times during the in-flight window (depending on selector ref-stability). Combined with REFACTOR-716 (debouncer recreation), the actual PUT count per click is unclear without measurement.

**Evidence**:
- `Search.tsx:37-42` — Smell #1 useEffect
- `Search.tsx:67-71` — Smell #3 useEffect
- `useCreateSearch.ts:13-19` — the createDataEntitiesSearch dispatch + navigate chain
- `slice.ts:97` — `isFacetsStateSynced: true` set on every fulfilment
- `slice.ts:215` — updateSearchState writes searchId in the fulfilled reducer (same React-batch as navigate)
- `redux/selectors/dataentitySearch.selectors.ts:129-133` — `getSearchFacetsData` selector composition (potential reference instability)
- `dataEntitySearch.slice.ts:22-36` — initialState shape
- contrast: Search.tsx:44-48 (restore-from-URL effect) has dep-array matching its read-set — that effect is CORRECT; the contrast is instructive.

**Existing-ADR-or-implied-prescription**: LSN-017 (the view_count doubling case) is the case-law anchor. The architectural prescription: dep-arrays MUST match the effect body's read-set. Tools like `eslint-plugin-react-hooks/exhaustive-deps` enforce this rule; the team has it configured (typical React project setup) but evidently with exemptions or `// eslint-disable-next-line` directives.

The fix scope is:
- Add `searchId` to Smell #1's dep-array (Search.tsx:42)
- Add `searchFacetsSynced` to Smell #3's dep-array (Search.tsx:71)
- Verify the resulting behaviour with a probe (P-189 cross-link)

**Proposed remedy**:

```tsx
// Search.tsx:37-42 — Smell #1 fix
useEffect(() => {
  if (!routerSearchId && !isSearchCreating && !searchId) {
    createSearch({ query: '', pageSize: 30, filters: {} });
  }
}, [routerSearchId, isSearchCreating, searchId]);  // searchId added

// Search.tsx:67-71 — Smell #3 fix
useEffect(() => {
  if (!searchFacetsSynced) updateSearchFacets();
}, [searchFacetParams, searchFacetsSynced]);  // searchFacetsSynced added
```

Effort: trivial. Two single-line changes. Verify with P-189 (existing probe — measures dispatch cardinality under rapid facet clicking).

**Severity rationale**:
- Smell #3 is HIGH because it's an ACTIVE re-fire vector — every facet click may dispatch the PUT multiple times
- Smell #1 is MEDIUM because it's LATENT — works today by accident; a future refactor would surface a real double-create

The TermSearch.tsx (batch U) has the IDENTICAL pair of smells. Fixing both Search.tsx and TermSearch.tsx in parallel is one architectural fix that closes the LSN-017 class across two files.

**Suggested backlog grouping**: `LSN-017 dep-array hardening sprint` — pair with REFACTOR-716 NEW this batch (Search facet debouncer recreation — sibling defect on the same surface). Also pair with TermSearch batch-U LSN-017 dep-array smells (the canonical sibling instance) and the canonical LSN-017 view_count case.

**Coherence check** (LSN-018):
- STRENGTHENS: LSN-017 (the case-law anchor); REFACTOR-716 NEW this batch (debouncer recreation — sibling defect); the broader Search.tsx + TermSearch.tsx clone-bug family.
- SUPERSEDES: none.
- CONFLICTS: none.

---

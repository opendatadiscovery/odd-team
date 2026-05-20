## ADR-CANDIDATE-097 — One-shot mount fetch with no refresh cadence — Redux is the SPA-session cache for slowly-changing list endpoints (Popular, My Objects, Upstream, Downstream, etc.); empty `[]` deps array + wholesale-replace slice reducer is the project's caching idiom

**Severity**: MEDIUM
**Classification**: promote
**Support count**: 1 sidecar primary-source (PopularStrip) — pattern likely repeats in other home-page list components
**Axes present**: ui_components, ui_redux_slices
**Pillars affected**: [P-01] — Data Discovery

**Surfaced by**:
- `PopularStrip.md:implicit_adrs[0]` (|-
    "**One-shot mount fetch with no refresh cadence — Redux is the SPA-session cache.** `useEffect(() => { dispatch(fetchPopularDataEntitiesList(...)) }, [])` with empty deps array is a deliberate caching strategy: fetch once per OwnerEntitiesList mount, then the slice acts as the cache for the lifetime of that mount (and across other components subscribed to `getPopularEntities`). No staleTime, no polling, no manual revalidate.")

**Decision statement**: For home-page list endpoints (Popular, My Objects, Upstream dependents, Downstream dependents), the odd-platform-ui SPA uses a one-shot mount-fire pattern:
- `useEffect(() => { dispatch(fetchPopularDataEntitiesList({page: 1, size: 5})); }, [])` — empty deps array, fetch once on component mount.
- Slice reducer `(state, { payload: popular }) => ({ ...state, popular })` — wholesale-replace, no merge, no append, no de-dup.
- No staleTime, no polling, no auto-refresh, no manual revalidate button, no React Query / SWR.

The implicit caching decision: "the popular list changes slowly enough that one fetch per home-page visit suffices, and the cost of a stale list is lower than the cost of background polling traffic to a non-indexed `ORDER BY view_count DESC` query."

The Redux slice acts as the SPA-session cache: subsequent reads of `getPopularEntities` within the session return the cached value; the only triggers for re-fetch are:
- Component unmount + remount (e.g. navigation away + back triggers react-router-dom v6 unmount/remount).
- Hard browser reload (loses entire Redux store).
- Another action that resets the slice (none observed).

The team rejected:
- **(a) React Query / SWR with staleTime** — would add a new dependency; the team chose Redux Toolkit + manual fetch instead.
- **(b) Polling interval (e.g. every 30s)** — would amplify backend load; the team prioritised UX over freshness.
- **(c) ETag / If-None-Match HTTP caching** — would require backend support; not present.

Consequences encoded:
- **(a) Back-button navigation re-fires the fetch** — react-router-dom v6 default unmounts+remounts; `useEffect([])` runs again. A click-tile → back → click-tile pattern observes refreshed Popular state from the second back-navigation.
- **(b) React Strict Mode dev-environment double-fire** — React 18 strict mode invokes effects with `[]` deps twice on first mount; dev environment fires the popular fetch twice (harmless but inflates dev-DB view_count).
- **(c) No cross-tab cache** — opening two browser tabs fetches twice; the SPA-session cache is per-tab.
- **(d) No request deduplication** — overlapping mounts (e.g. rapid navigation) issue parallel fetches.

**Wisdom test (3-question)**:
1. *Intentional?* YES — the explicit `[]` deps array paired with the slice-replace fulfilled reducer; the absence of React Query / SWR; the absence of any staleTime; the consistent pattern across the four columns confirm the deliberate caching choice.
2. *Structural impact?* YES — defines the freshness contract for home-page list endpoints; affects backend traffic patterns (one fetch per home-page visit per tab); affects how operators perceive Popular "freshness."
3. *Refactoring or structural?* STRUCTURAL — adopting React Query or SWR would change the freshness contract, the dependency tree, the slice shapes.
→ ADR.

**Evidence**:
- PopularStrip.md says: "OwnerEntitiesList.tsx:58-64 (the `[]` deps array) + dataentities.slice.ts:205-208 (the wholesale-replace reducer pattern that makes Redux the cache)"
- intent_anchor: "the explicit `[]` deps array paired with the slice-replace fulfilled reducer — the pair embodies 'fetch once, cache in Redux, no background refresh'"

**Existing ADR**: composes with:
- **ADR-CANDIDATE-084** (handleResponseAsyncThunk wrapper) — the dispatch mechanism.
- **ADR-CANDIDATE-085** (fan-out across three slices) — the data-shape side; this ADR is the freshness side.
- **ADR-CANDIDATE-087** (page-component owns data-fetch lifecycle) — the mount-fire pattern is the page-component-owns-fetch idiom applied to home-page lists.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-297 (NEW — No client-side staleTime / cache-control / ETag awareness: every UI fetch hits the unindexed sort on the server; a 5-second client cache would absorb the dominant traffic pattern at negligible UX cost)
- REFACTOR-298 (NEW — React 18 strict-mode double-fire on dev environments inflates dev-DB view_count; gate the dispatch on `prevState.popular.length === 0` to short-circuit)

**Proposed action**: Promote to `adrs/drafts/one-shot-mount-fetch-redux-as-cache.md`. Document:
- The `[]` deps + wholesale-replace reducer pattern.
- The freshness contract (fetch once per mount; back-button re-fires).
- The three rejected alternatives (React Query, polling, HTTP cache).
- The dev-environment caveat (strict mode double-fire).
- The migration path if the team ever needs freshness guarantees: which thunks to migrate first, what staleTime values to use, how to coordinate with backend cache headers.

**Severity rationale**: MEDIUM — pattern-shaping decision for the home-page architecture; observable in multiple home-page surfaces; affects freshness expectations.

**Suggested backlog grouping**: `UI architecture codification` + `Performance / cache sprint`.

---

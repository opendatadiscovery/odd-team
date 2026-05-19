## ADR-CANDIDATE-087 — Per-entity detail-page lifecycle is co-located at the React page-component (DataEntityDetails.tsx), NOT at a route loader / outer provider / child tab — the `useEffect → dispatch(thunk)` pattern at the page-component layer is the project's standard

**Severity**: MEDIUM
**Classification**: promote
**Support count**: 1 sidecar primary-source; pattern likely repeated across other detail pages (uninspected — would surface from sibling sidecars)
**Axes present**: ui_components
**Pillars affected**: [P-01, P-02, P-04, P-05, P-06, P-07] — the pattern recurs across every per-entity detail page

**Surfaced by**:
- `DataEntityDetails.md:implicit_adrs[0]` (|-
    "**The component owns the data-fetch lifecycle, not the route shell or a feature provider.** The decision is to colocate fetching at the page-component layer rather than (a) at a route loader (`react-router-dom@6` supports `loader` functions but the project does not use them), (b) at an outer `<DataEntityProvider>` context, or (c) at the child Overview tab. The pattern is consistent across the platform's other detail pages.")

**Decision statement**: The odd-platform-ui SPA places data-fetch lifecycle (mount-time dispatches, dep-array-tracked re-fetches, error/loading state subscriptions) at the **page-component level** — the React component that the SPA router mounts for a given route. The team rejected three alternative locations:
- **(a) react-router-dom v6 route loaders** — the project does not use `loader` functions; the router only carries `path → element` registrations.
- **(b) Outer feature-provider context** — e.g. a `<DataEntityProvider>` wrapping the detail page. The team chose against this; the page component directly orchestrates its own fetches.
- **(c) Child tab components** — e.g. each of the 13 sub-tabs of the entity detail page fetches its own entity data. The team chose against this; the parent page fetches `DataEntityDetails` once and the children subscribe to the shared Redux slice.

The pattern is visible at `DataEntityDetails.tsx:56-76`: two `useEffect` blocks at the top of the page component, the first dispatching the primary entity-detail fetch (5 deps including the entity id + 3 group-status flags + 1 buggy response-derived field — see LSN-017 / REFACTOR-220), the second dispatching the 4 ancillary fetches (alerts counts, DQ test report, SLA report, resource permissions). The 13 child tabs (`DataEntityDetailsRoutes.tsx`) consume the resulting Redux state via independent selectors; they do NOT re-dispatch the primary fetch.

Consequences encoded:
- **(a) The page component is non-pure** — its render path is gated by the fetch lifecycle; the skeleton/content/error split is driven by selectors against the slice's loading state.
- **(b) Child tabs are mount-state-aware** — `DataEntityDetailsRoutes` renders unconditionally (line 115) regardless of fetching state, leaving each child route component to handle its own loading state via the shared selectors.
- **(c) Refactor to route loaders or feature providers is a structural change** — moving the dispatches out of the component requires changing the SPA router setup, decoupling the loader from the render path, and re-doing the dep-array protocol for re-fetches.

**Wisdom test (3-question)**:
1. *Intentional?* YES — the alternatives (router loaders, outer providers, child fetches) are well-known React patterns the team would have considered; the consistent placement across detail pages is structural commitment.
2. *Structural impact?* YES — affects render-path purity, child-component subscription model, refactor cost for switching to a loader/provider model.
3. *Refactoring or structural?* STRUCTURAL — moving fetches out is not a refactor; it's a different architecture.
→ ADR.

**Evidence**:
- DataEntityDetails.md says: "DataEntityDetails.tsx:56-76 (two useEffects co-located in the top page component)"
- intent_anchor: "the structural pattern of `useEffect → dispatch(...)` at the page-component layer applied consistently across `/dataentities/:id/*`"
- DataEntityDetails.md says: "`DataEntityDetailsRoutes` is a sibling, not a child, of the header+tabs render — so child route components share the same `details` Redux state as this parent component via their own `useAppSelector(getDataEntityDetails(dataEntityId))` calls"

**Existing ADR**: none. Composes with:
- ADR-CANDIDATE-084 (handleResponseAsyncThunk wrapper) — the wrapper is what the page component dispatches.
- ADR-CANDIDATE-085 (fan-out across three slices) — the Redux store shape that the child tabs subscribe to.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-220 (existing — LSN-017 root cause: the dep-array-tracked re-fetch pattern is the locus of the +2 view_count bug; this ADR is the architectural FRAME for the bug — placing fetches at the page-component layer makes dep-array correctness load-bearing)
- REFACTOR-281 (NEW — Skeleton flicker on legitimate re-fetch: predicate at `DataEntityDetails.tsx:80` hides chrome on ANY refetch including DEG-mutation refreshes; the page-component-fetch pattern bakes the UX trade-off in)

**Proposed action**: Promote to `adrs/drafts/page-component-owns-data-fetch-lifecycle.md`. Document:
- The pattern: useEffect → dispatch at the page-component layer.
- The three rejected alternatives (router loaders, outer providers, child fetches).
- The Redux-as-shared-state contract: children subscribe via independent selectors, never re-dispatch.
- The dep-array protocol: list ONLY externally-driven re-fetch triggers (entity id, DEG-membership flags); response-derived values MUST NOT appear in the dep-array (the LSN-017 lesson).
- The migration path if the team ever moves to route loaders: which thunks become loader functions, how Redux loading state migrates, how the AppErrorPage banner integrates with the loader-error model.

**Severity rationale**: MEDIUM — pattern-shaping decision for the detail-page architecture. Below HIGH because it's a well-known React-side pattern; the specifically-significant detail is the project's rejection of loaders + outer providers.

**Suggested backlog grouping**: `UI architecture codification`.

---

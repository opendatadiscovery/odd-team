## ADR-CANDIDATE-091 — URL is the source of truth for view state in feature surfaces with shareable canvases (LineageGraph + GenAI: depth, view-mode, full-names, expand-all-groups, transform matrix, expansion-id arrays ALL live in the query string)

**Severity**: MEDIUM
**Classification**: promote
**Support count**: 1 sidecar primary-source (LineageGraph) — the pattern is observable across 7 sibling components within the lineage subtree all using `setQueryParams`
**Axes present**: ui_components, ui_routing
**Pillars affected**: [P-05] — Data Lineage primarily; pattern is reusable across other shareable-canvas surfaces

**Surfaced by**:
- `LineageGraph.md:implicit_adrs[1]` (|-
    "**URL is the source of truth for view state** — depth `d`, full-names `fn`, view-mode `full`, expand-all-groups `eag`, transform matrix `t`, and the four expansion-id arrays (`exd`, `exu`, `exdg`, `exug`) ALL live in the URL query string (interfaces.ts:75-85), not in React state, not in localStorage, not in Redux UI-slice. The pattern is consistent: every control writes via `setQueryParams` (LineageControls.tsx:33, 40, 47, 51; LoadMoreButton.tsx:59, 64; ZoomableLineage.tsx:30).")

**Decision statement**: The Lineage canvas — and the project's shareable-canvas surfaces generally — places EVERY user-controllable view-state knob in the URL query string. For LineageGraph specifically:
- **`d`** (depth) — integer 1-20, controls the recursive-CTE walk depth on the backend.
- **`fn`** (full names) — boolean toggle for short-name-vs-full-name node labels.
- **`full`** (view mode) — `full` vs `compact` height layouts.
- **`eag`** (expand all groups) — boolean toggle to expand all DEG members inline.
- **`t`** (transform matrix) — JSON-encoded `{scaleX, scaleY, translateX, translateY}` from `@visx/zoom`.
- **`exd[]` / `exu[]`** — downstream/upstream entity-id arrays for ad-hoc one-hop expansions.
- **`exdg[]` / `exug[]`** — downstream/upstream group-id arrays for ad-hoc DEG inlines.

The implementation uses the `useQueryParams` hook (`useQueryParams.ts:38-44`) seeded with `defaultLineageQuery` (`constants.ts:74-84`); writes go through `setQueryParams(prev => ({...prev, key: value}))` which `router.push`es the new query string. State-derived components (LineageControls, LoadMoreButton, ZoomableLineage, LineageGraph, LineageProvider, HierarchyLineage, Node) all consume the same `useQueryParams` output.

The team rejected three alternatives:
- **(a) React state** in LineageProvider — would lose deep-linking + share-via-URL.
- **(b) Redux UI slice** — would lose deep-linking; would require manual hydration on refresh.
- **(c) localStorage / sessionStorage** — would lose per-tab independence and shareability.

The consequences encoded:
- **Deep-linking works** — a user shares a screenshot URL; the recipient opens the same view, including all 4 expansion arrays and the transform matrix.
- **Refresh preserves view state** — browser refresh re-mounts with identical state.
- **Back-button navigation re-fires fetches** (per `useEffect` deps on URL-derived values).
- **URL length grows with `exd[]` array size** — Chrome's ~2K effective limit caps at ~200 expanded leaves (REFACTOR-285).

**Wisdom test (3-question)**:
1. *Intentional?* YES — the `defaultLineageQuery` constant exporting all view-state defaults as URL params (`constants.ts:74-84`); the absence of any React state for view config in LineageProvider; the consistent `setQueryParams` usage across 4 components.
2. *Structural impact?* YES — affects deep-linking shape, browser-history integration, the dispatching `useEffect`'s dep-array protocol, and the URL-length ceiling.
3. *Refactoring or structural?* STRUCTURAL — moving to Redux UI slice or React state changes the deep-linking contract.
→ ADR.

**Evidence**:
- LineageGraph.md says: "interfaces.ts:75-85 + setQueryParams calls across 4 components"
- intent_anchor: "the `defaultLineageQuery` constant exporting all view-state defaults as URL params (constants.ts:74-84); the absence of any React state for view config in LineageProvider (LineageProvider.tsx:33-41 — only renderedNodes/links/highLightedLinks are React state, all of which are derived from URL+data)"
- LineageGraph.md says: "every control writes via `setQueryParams`" — 7-component coordinated default

**Existing ADR**: none. Composes with:
- **ADR-CANDIDATE-087** (page-component owns data-fetch lifecycle) — the URL-state-as-source-of-truth feeds the page-component's useEffect dep-array.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-285 (NEW — URL length grows with `exd[]` array size; Chrome's ~2K effective limit caps deep-linking at ~200 expanded leaves; no UI warning)
- REFACTOR-286 (NEW — `?t=` URL accepts `JSON.parse(t)` without try/catch; a malformed user-edit crashes the React tree)
- REFACTOR-287 (existing-shape — `?d=` unvalidated upper bound; URL editor can pass `?d=10000` straight through to the backend recursive-CTE — strengthens REFACTOR-202)

**Proposed action**: Promote to `adrs/drafts/url-as-source-of-truth-for-view-state.md`. Document:
- The seven view-state knobs and their URL keys.
- The `defaultLineageQuery` + `useQueryParams` pattern.
- The three rejected alternatives (React state, Redux slice, localStorage).
- The deep-linking contract.
- The URL-length ceiling caveat (REFACTOR-285).
- The validation obligation: every URL-bound input MUST clamp / try-catch before forwarding to backend or to JSON.parse.

**Severity rationale**: MEDIUM — pattern-shaping decision; observable across the lineage subtree; reusable for any future shareable canvas (e.g. Quality Dashboard, Catalog Overview with filters).

**Suggested backlog grouping**: `UI architecture codification`.

---

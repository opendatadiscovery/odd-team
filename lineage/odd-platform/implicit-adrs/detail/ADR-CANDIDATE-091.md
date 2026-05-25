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

## STRENGTHENS — Batch ZC (the Quality Dashboard filter panel — the second shareable-canvas surface the ADR anticipated)

**Two new batch-ZC sidecars confirm the URL-as-source-of-truth pattern on the standalone Data Quality Dashboard's filter panel** (Pillar P-04:F-002, Feature F-032), extending the support from the LineageGraph subtree to a second feature pillar. This is the literal realisation of the ADR's own severity rationale: *"reusable for any future shareable canvas (e.g. Quality Dashboard, Catalog Overview with filters)."* The Quality Dashboard's filter panel adopts the same architectural commitment with a feature-local variation: the URL holds the FILTER selection (not view-config like depth/zoom), but the bidirectional sync, the `replace: true` history hygiene, and the deep-link contract are byte-identical in spirit to the LineageGraph pattern.

**Batch ZC new surfaced_by**:
- `odd-platform__ts__react-component__component__DataQualityFilters.md:implicit_adrs.[2]` (HIGH) — |-
    "**Filter selections are mirrored into the URL query string so the dashboard view is deep-linkable and shareable.** Two `useEffect` hooks form a bidirectional bridge: one hydrates `formFiltersAtom` from `searchParams` on mount (`DataQualityFilters.tsx:28-43`), the other writes `formFiltersAtom` back to the query string with `{ replace: true }` on every change (`DataQualityFilters.tsx:46-54`). The intent is that an operator can bookmark or paste a `/data-quality?...` URL and land on the same filtered view; `replace: true` avoids polluting browser history with every keystroke-driven filter change. The decision is the explicit URL round-trip — a filter panel that only used jotai would lose state on reload." — intent_anchor: the two paired `// sync formFilters with searchParams on mount` + `// sync searchParams with formFilters on formFilters change` comments at `DataQualityFilters.tsx:27, 45` are the in-file statement of the bidirectional contract.
- `odd-platform__ts__jotai-store__store__DataQualityStore.md:bugs_limitations_corner_cases.[1]` — confirms the same observation from the store side: the per-mount jotai Provider intentionally resets on route-unmount, and the URL search params are the ONLY persistence channel surviving navigation. The decision-shape is the SAME inversion: the URL is treated as authoritative source-of-truth for the filter slice; in-memory jotai is the transient working copy.

**Architectural refinement (the variation)**: the LineageGraph URL pattern (ADR-091's primary source) holds VIEW-CONFIG state (depth/zoom/expansion arrays/full-names toggle). The Quality Dashboard variation holds FILTER state — 10 keys, each a JSON-stringified `FilterOption[]` (id + name) — through the same `useSearchParams` / `setSearchParams` API. The two together suggest the pattern generalises as: **any state whose loss-on-reload would defeat operator workflow (lineage view, filtered dashboard) goes in the URL; transient sub-state (a half-typed search prefix, a partially-built filter chip) stays in the feature-local primitive (jotai or react state)**. The ADR-091 framing already names this generalisation; the batch-ZC sidecar is the second confirming primary source.

**The pairing with ADR-CANDIDATE-207 (the two-store-system ADR)**: ADR-207 records that the dashboard's filter state lives in jotai per-feature; ADR-091-STRENGTHENS records that the URL is its persistence channel. The two are complementary: jotai gives the per-mount-reset property (deliberately wanted); the URL round-trip gives the deep-link property (also wanted); the combination is the dashboard's actual persistence design. A maintainer reading either ADR alone gets half the story; the pair captures the full pattern.

**New cross-link gaps**:
- **REFACTOR-605 NEW**: the URL-sync mount effect calls `JSON.parse(value)` with no `try/catch` (`DataQualityFilters.tsx:35`). A hand-edited or malformed query string crashes the React tree — exact same shape as REFACTOR-286 (the LineageGraph `?t=` `JSON.parse` crash that the original ADR-091 surfaced). The pattern repeats across both URL-as-source-of-truth surfaces: the validation obligation the ADR's "Proposed action" already names is unmet on BOTH surfaces. The fact that the same gap occurs on the second instance of the pattern (without test coverage in either case) is itself a signal: the ADR's validation obligation needs a codified primitive (a `parseUrlValue<T>(value, schema)` helper) rather than per-call-site discipline. A future maintainer extending the pattern to a third surface would repeat the gap without one.

**Severity unchanged**: MEDIUM. Support now spans **two pillars** (P-05 Data Lineage canvas + P-04 Quality Dashboard) — the cross-pillar reach increases ADR-091's promotion priority. The ADR's "Proposed action" should now consolidate the codified-validation-primitive recommendation as a hard requirement, not a "nice-to-have," because the same JSON-parse crash class has now surfaced on TWO independent instances of the pattern.

---

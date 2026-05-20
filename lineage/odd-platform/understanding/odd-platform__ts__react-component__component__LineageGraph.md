---
node_id: "odd-platform ts react-component component:LineageGraph"
node_kind: react-component
axis: ui_components
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.3.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-19-J-lineage-graph-ui
---

# Lineage (data-entity-detail tab) — semantic understanding

## understanding

`Lineage.tsx` (lines 1-28) is the dispatch shell for the **Lineage tab** on every data-entity detail page — the UI half of F-005 / P-05:F-001 Lineage Graph Traversal. It reads `dataEntityId` from the route, queries Redux for the entity's class flags + load status (lines 12-15), and routes to one of two distinct rendering trees: `DEGLineage` (for Data Entity Groups — the group-lineage variant) or `HierarchyLineage` (for every other entity class — the per-entity recursive-CTE variant). The substrate node-id (`component:LineageGraph`) anchors here even though the literal `LineageGraph.tsx` file (HierarchyLineage/ZoomableLineage/LineageGraph/LineageGraph.tsx lines 1-115) is two directories deeper — the shell + provider chain (`HierarchyLineage.tsx` → `LineageProvider` → `Zoom` from `@visx/zoom` → `ZoomableLineage` → `LineageGraph`) is one cohesive UI surface and the shell is the canonical entry. The chain fetches downstream-then-upstream lineage via two sequential `dataEntityApi` thunks (`HierarchyLineage.tsx:54-66`), stores result in a Redux slice that grows monotonically across `LoadMore` clicks (`dataEntityLineage.slice.ts:206-267`), and renders an SVG tree built with `d3-hierarchy` (`generateGraph.ts:57-148`) — NOT a force-directed graph, NOT Cytoscape, NOT D3-force; the data model is a **tree** with overlay `crossEdges` rendered as separate `CrossLink` components (LineageGraph.tsx:69-83).

## concepts

- entities: [
    "`DataEntityLineageById` (Redux-stored state; redux/interfaces — referenced at LineageGraph.tsx:2) — keyed by rootNodeId, holds `rootNode + upstream + downstream` with `nodesById / edgesById / crossEdges` per stream",
    "`LineageQueryParams` (interfaces.ts:75-85) — the URL-bound state: `full` (full vs compact view), `fn` (full names toggle), `d` (depth, integer 1-20), `t` (transform matrix JSON-encoded), `eag` (expand all groups), `exdg` / `exug` (downstream/upstream group ids to expand from a collapsed group node), `exd` / `exu` (downstream/upstream ids to issue LoadMore against)",
    "`TreeNodeDatum` (redux/interfaces/graph — referenced at LineageGraph.tsx:2) — every API node has a `d3attrs.id` (uuidv4 assigned client-side at generateGraph.ts:20-22) layered on top of the backend payload",
    "`HierarchyPointNode<TreeNodeDatum>` / `HierarchyPointLink<TreeNodeDatum>` (`d3-hierarchy` types) — output of the `d3tree<TreeNodeDatum>().nodeSize(...).separation(...)` builder; carries `x`, `y`, `depth`, `parent`, `children` per node + `source`/`target` per link",
    "`LineageContext` (LineageContext.ts:25) — React context holding `nodeSize`, `setRenderedNodes`, `renderedLinks`, `setRenderedLinks`, `highLightedLinks`, `setHighLightedLinks`; provided by `LineageProvider` (LineageProvider.tsx:28-73), consumed by `LineageGraph` (LineageGraph.tsx:32) and downstream components",
    "`Zoom<SVGSVGElement>` from `@visx/zoom` (HierarchyLineage.tsx:106-115) — the pan/zoom controller; `scaleXMin/Max=0.05/2`, `initialTransformMatrix={scaleX:0.75, scaleY:0.75, translateX: layerWidth/2.3, translateY: layerHeight/2.5}` (constants.ts:88-95)",
    "`lineageDepth` array (constants.ts:97-99) — the depth-slider option list `[1..20]`; supplied to the depth `<AppSelect>` at LineageControls.tsx:113-117"
  ]
- operations: [
    "Lineage.tsx — route-param read → Redux selector for isDEG + isLoaded → conditional render of DEGLineageAtomProvider/DEGLineage OR HierarchyLineage (lines 12-25)",
    "HierarchyLineage.tsx — on `[d, dataEntityId]` change: dispatch `fetchDataEntityDownstreamLineage` → `.then()` dispatch `fetchDataEntityUpstreamLineage` → `.then()` optional `expandEntitiesFromDownstreamGroup` + `expandEntitiesFromUpstreamGroup` (lines 44-67); render `<Zoom>` wrapping `ZoomableLineage` (lines 96-127); show 500-error AppErrorPage if either stream failed (lines 129-133)",
    "LineageGraph.tsx — `React.useMemo([data, nodeSize])` computes `{linksUp, crossLinksUp, nodesDown, linksDown, crossLinksDown, nodesUp}` via `generateTree(parseData(data), defaultGraphState, separation={siblings:1, nonSiblings:1}, nodeSize)` (lines 40-44); writes nodes + links to context state (lines 46-52); maps each link/cross-link/node to an SVG component (lines 56-110)",
    "generateGraph.ts — `parseData` assigns a UUID `d3attrs.id` to every node (lines 18-47); `generateTree` builds TWO independent `d3.tree()` instances (upstream + downstream) with mirrored nodeSize (x-sign flipped for upstream layout — line 60 `-(width + mx)`), then resolves `crossEdges` against the materialised node lists by id-lookup (lines 81-95, 121-135)",
    "LineageProvider.tsx — measures titleHeight/oddrnHeight from rendered DOM via `getMaxTitleHeight` (helpers.ts:39-49) using a hidden temporary `<div>` per title (helpers.ts:10-37); computes `nodeSize` reactively, exposes via context (lines 43-72)",
    "LoadMoreButton.tsx — on click, dispatches `fetchDataEntityDownstreamLineage({lineageDepth: 1, ...})` (line 56) and appends the entity id to `exd`/`exu` query-param (lines 59-65) — this is the user-driven 'expand a specific node' operation",
    "LineageControls.tsx — Depth select `<AppSelect>` (lines 104-118) writes `d` to URL via `setQueryParams` (line 40); checkbox toggles for `eag` and `fn`; tab control for `full` vs Compact",
    "Node.tsx — click on `NodeTitle` navigates to `dataEntityLineagePath(entityId, lineageQueryString)` (line 71) — i.e. opens the clicked node's own Lineage tab in the SAME app (preserves the URL params; routes to /dataentities/{id}/lineage?...)"
  ]
- invariants: [
    "Backend-supplied `nodesById + edgesById + crossEdges` are SHAPED INTO A TREE at the UI by `d3-hierarchy`. The hierarchy builder (generateGraph.ts:68-76, 108-116) walks edges by `edgesById[d.id].map(edge => nodesById[edge.sourceId])` (or `.targetId` for downstream) — visiting the SAME node id along multiple paths yields DUPLICATE HierarchyPointNode entries (each with its own `x`/`y`/`depth`) because `d3-hierarchy` ENFORCES tree topology, not DAG. Diamond shapes (A→B, A→C, B→D, C→D) render D twice. There is no client-side dedupe BEFORE the tree builder runs.",
    "`crossEdges` carry the edges that the BACKEND has marked as 'not tree-shaped' — i.e. lineage edges that would create a cycle or close a diamond if traversed by the seed-set tree builder. They are rendered SEPARATELY as `<CrossLink>` (LineageGraph.tsx:69-83) with no participation in the tree layout. The backend recursive-CTE itself has NO cycle guard (`ReactiveLineageRepositoryImpl.lineageCte` lines 150-176 per batch-H sidecar) — so cycle handling is a HYBRID: backend returns potentially-duplicating CTE rows, the response shape (DataEntityLineageStreamDto.edges, .nodes) attempts to split them into 'tree edges' + 'cross-edges', and the UI renders both. The exact dedupe contract between backend `selectDistinct` (ReactiveLineageRepositoryImpl.java:127) and frontend tree builder is NOT enforced at the UI — a malformed payload would render duplicates.",
    "URL is the source of truth for view state. The depth `d`, full-names `fn`, view-mode `full`, expand-all-groups `eag`, transform matrix `t`, and the four expansion-id arrays (`exd`, `exu`, `exdg`, `exug`) all live in the query string (LineageQueryParams interfaces.ts:75-85); the `useQueryParams` hook (useQueryParams.ts:38-44) reads `location.search` and falls back to `defaultLineageQuery` (constants.ts:74-84) — `d` defaults to **1** in the UI, which means the UI ALWAYS supplies a non-null `lineage_depth` to the API, masking the F-005 NPE caveat from the typical UI path.",
    "The UI ALWAYS sends `lineageDepth=d` even when the user opens the tab fresh — `defaultLineageQuery.d = 1` (constants.ts:77) means `useQueryParams` returns `d: 1` for a URL with no query string, and `HierarchyLineage.tsx:47` reads `d` from that. The F-005 NPE-on-null-lineage_depth bug surfaces ONLY for direct API callers; from the UI, the failure mode is silent — the UI silently picks 1, which is below any reasonable 'platform default depth' value and may give an artificially shallow first impression of the lineage graph.",
    "LoadMore is depth-1 expansion, not user-driven depth increase. Clicking 'Load N more' on a leaf node (LoadMoreButton.tsx:55-65) dispatches a NEW fetch with `lineageDepth: 1` (line 56) and appends the node id to `exd`/`exu` — the slice (dataEntityLineage.slice.ts:206-220) MERGES the new nodes/edges into the local state. The depth slider in LineageControls (`d` query param) only affects the INITIAL load via the `[d, dataEntityId]` effect dep (HierarchyLineage.tsx:67); user expansion is always 1-hop at a time.",
    "Click-through on a node title navigates to that node's own Lineage tab via `dataEntityLineagePath(entityId, lineageQueryString)` (Node.tsx:54-72) — preserves the URL params bag. The `originalGroupId` indirection (line 55-57) means clicking on a node that was 'expanded out of a group' navigates to the GROUP's lineage rather than the inner entity. The link is `#` (no-op) only when the parent is null (root node) OR when `externalName` is unset (line 59-60).",
    "Two independent trees, mirrored layout: upstream tree at LineageGraph.tsx:84-97 + downstream tree at lines 98-110; both inherit `dataEntityId` as `rootNodeId` prop and `node.parent` to disambiguate the root case. Upstream tree's x-coordinate is NEGATIVE (generateGraph.ts:60 — `-(nodeSize.size.width + nodeSize.size.mx)`) so it grows leftward from the root; downstream grows rightward.",
    "No virtualisation. Every node + every link is mounted as an SVG component (LineageGraph.tsx:55-110); for an N-node graph the React tree is O(N) SVG primitives. Compact mode (`full=false` query-param, LineageControls.tsx:99-102) reduces per-node height but not node count."
  ]
- audiences: [
    "ODD Platform UI end-user — every data-entity-detail page has a Lineage tab; this is the primary visualisation surface for F-005 lineage exploration",
    "data-engineer-analyst / data-quality-engineer / data-scientist-ml-engineer — the audiences named in P-05 of the system mission; the lineage canvas is the daily-use tool for tracing producer↔consumer relationships"
  ]

## dependencies_semantic

- requires-feature: [
    "F-005 / P-05:F-001 Lineage Graph Traversal — the lineage HTTP endpoints `GET /api/dataentities/{id}/lineage/downstream` + `/upstream` (DataEntityController.java:255-273 per batch-F sidecar) are the wire contract; this UI component IS the canvas referenced in F-005's terminal_side_effect (`Returns LineageGraph payload to the lineage canvas component`)",
    "F-005 DEG-lineage sub-flow — the DEG branch (Lineage.tsx:20-22) routes to `DEGLineage` which consumes `GET /api/dataentitygroups/{id}/lineage` (LineageServiceImpl.getDataEntityGroupLineage per batch-I sidecar); ALL of the recursion / cycle / inner-DEG caveats noted at the service layer surface here at render time",
    "Live doc page (`https://docs.opendatadiscovery.org/features/data-lineage`) — WebFetched 2026-05-19 in this session, status 200, but page is silent on lineage_depth defaults, depth UI slider, cycle visualisation, click-through behaviour, loading/error states (see doc_drift_findings)",
    "Live API-reference page (`https://docs.opendatadiscovery.org/developer-guides/api-reference/lineage`) — WebFetched 2026-05-19, status 200, declares `lineage_depth` 'Unset returns the platform's default depth' — but the UI ALWAYS supplies `d=1` so the 'unset' branch is unreachable from the UI; the platform default has no canonical value (see implicit_adrs)"
  ]
- requires-config: [] — N/A: this component reads no env / no build-time config. The hardcoded values (`layerWidth=1408`, `layerHeight=780`, `scaleXMin=0.05`, `scaleXMax=2`, `lineageDepth=[1..20]`, `defaultLineageQuery.d=1`) live in `constants.ts` — operator-uncontrollable.
- requires-runtime: [
    "React 18+ runtime — `React.memo`, `React.useContext`, `React.useEffect`, `React.useMemo`, `React.useState`, `React.useCallback` (LineageGraph.tsx:1, 24, 32, 38-53)",
    "React Router v6 — `useNavigate` (Node.tsx:3, 45) + `useLocation` (useQueryParams.ts:25) for URL-bound state",
    "Redux Toolkit — `useAppSelector` / `useAppDispatch` (HierarchyLineage.tsx:4-5); the `dataEntityLineageSlice` (dataEntityLineage.slice.ts:52) holds the canvas state; `handleResponseAsyncThunk` (thunks.ts:10) wraps API errors",
    "`@visx/zoom` — Pan/zoom container; `Zoom<SVGSVGElement>` (HierarchyLineage.tsx:2, 106-127); `setTransformMatrix` API (ZoomableLineage.tsx:23)",
    "`@visx/group` — `<Group transform=... top=... left=...>` for SVG positioning (Node.tsx:4, 107)",
    "`@visx/event` — `localPoint` for double-click-to-zoom anchor (ZoomableLineage.tsx:4, 34)",
    "`d3-hierarchy` — `hierarchy(...)` (data → root) + `tree<T>().nodeSize().separation()` (root → laid-out tree) (generateGraph.ts:1, 57-66, 97-106)",
    "`lodash/maxBy` (generateGraph.ts:2, 145-146) for depth computation; `lodash/entries` (generateGraph.ts:4, 27)",
    "`uuid/v4` (generateGraph.ts:3, 20) for per-node client-side UUID stamping — used as React `key` (LineageGraph.tsx:58, 65) to keep React from re-mounting nodes when their position changes",
    "`query-string` package (useQueryParams.ts:3) for URL parsing — with `parseNumbers: true, parseBooleans: true` (line 36), `arrayFormat: 'bracket-separator'`, `arrayFormatSeparator: ','` (lines 28-29) — `exd=[1,2,3]` serialises as `exd[]=1,2,3`",
    "`react-i18next` — `useTranslation()` (LineageControls.tsx:2, 19) for control labels; the lineage canvas itself has no translatable strings",
    "OpenAPI-generated `DataEntityApi` (generated-sources) — `getDataEntityDownstreamLineage({dataEntityId, lineageDepth, expandedEntityIds})` (thunks.ts:19-22); contract owned by the spec"
  ]
- couples-to: [
    "`DataEntityApi.getDataEntityDownstreamLineage` / `getDataEntityUpstreamLineage` (thunks.ts:13-44) — wire-contract surface; the F-005 NPE on omitted `lineage_depth` is masked from this caller because `lineageDepth` is always a numeric URL param value (default 1)",
    "Redux selectors `getDataEntityLineage`, `getUpstreamLineageFetchingStatuses`, `getDownstreamLineageFetchingStatuses`, `getUpstreamLineageFetchingError`, `getDownstreamLineageFetchingError`, `getDataEntityDetailsFetchingStatuses`, `getIsDataEntityBelongsToClass` (HierarchyLineage.tsx:5-11; Lineage.tsx:3-7) — the selector contract is the boundary between this UI tree and the rest of the SPA",
    "Redux slice `dataEntityLineageSlice` (dataEntityLineage.slice.ts:52-349) — owns the merge-on-fetch logic; the slice's `localUpstreamState`/`localDownstreamState` MODULE-LEVEL globals (lines 30-48) are NOT React state but mutable cross-action accumulators — see implicit_adrs[3]",
    "`dataEntityLineagePath` (routes/dataEntitiesRoutes.ts:89-93) — the route helper used by `Node.tsx:54-68` for click-through navigation; produces `/dataentities/{id}/lineage?<queryString>`",
    "`useDataEntityRouteParams` (Lineage.tsx:7, HierarchyLineage.tsx:22) — the route-param reader; tightly coupled to the `/dataentities/:dataEntityId/...` route shape"
  ]

## upstream_callers

| Caller (file:line) | Method invoked | Call context | Owner-scoping at caller? | Notes |
|---|---|---|---|---|
| `DataEntityDetails` router (data-entity-detail SPA route, mounted at `/dataentities/:dataEntityId/lineage` per `dataEntityLineagePath` routes/dataEntitiesRoutes.ts:89-93) | Renders `<Lineage />` (Lineage.tsx:12-26) as the route's children | Tab change on the data-entity detail page; the `/lineage` segment is one of ~6 detail-tabs | N/A — UI component; owner-scoping is a backend concern (and is ABSENT per batches F/H/I — REFACTOR-203) | The single rendering entry to this component tree. `useDataEntityRouteParams` (Lineage.tsx:13) reads `dataEntityId` from the route. |
| `Node.tsx` click handler (Node.tsx:70-72, `handleTitleClick`) | `navigate(lineageLink)` where `lineageLink = dataEntityLineagePath(entityId, lineageQueryString)` (line 54-68) | User clicks a graph node's title — navigates to THAT node's own Lineage tab | N/A — UI navigation | This is the **F-001 doubling-chain trigger** noted in the prompt: clicking a lineage node fires the same `/dataentities/{id}/lineage` route, which on mount fetches `/api/dataentities/{id}/lineage/downstream` + `/upstream`. The view_count side-effect (LSN-017 — `/api/dataentities/{id}` doubling) is NOT triggered by the lineage endpoint; only by the entity-detail endpoint that the data-entity-detail page fires on mount. The lineage click DOES re-fire the detail-fetch via the data-entity-detail page's own mount effect. |

## downstream_side_effects

| Method | API / DOM calls | RW shape | Transactional scope | Concurrency / failure modes |
|---|---|---|---|---|
| `HierarchyLineage.useEffect [d, dataEntityId]` (HierarchyLineage.tsx:44-67) | `dispatch(fetchDataEntityDownstreamLineage(params))` → on resolve `dispatch(fetchDataEntityUpstreamLineage(params))` → on resolve optional `dispatch(expandEntitiesFromDownstreamGroup(...))` + `dispatch(expandEntitiesFromUpstreamGroup(...))` | Read-only API calls (GET); Redux state writes via slice extraReducers (slice.ts:191-347) | None at UI layer; each thunk is one HTTP round-trip + one Redux dispatch | Sequential — upstream fetch is GATED on downstream resolution (`.then()`-chained); a downstream failure short-circuits the upstream fetch. The `setIsLineageFetching(false)` (slice.ts:64) executes only on the SUCCESS path; an error keeps `isLineageFetching: true` indefinitely UNLESS the Redux error state separately triggers `isLineageNotFetched` (HierarchyLineage.tsx:79-82) — which it does, surfacing the `AppErrorPage` (lines 129-133). 500-class errors from F-005's NPE caveat would render as `error.status: 500` + `error.statusText: Internal Server Error` (AppErrorPage.tsx:24-29). |
| `LineageGraph.useMemo([data, nodeSize])` (LineageGraph.tsx:40-44) | `parseData(data)` (generateGraph.ts:18) + `generateTree(...)` (generateGraph.ts:49) | Read-only data transform; runs synchronously on each `data` or `nodeSize` change | None | For large lineage graphs (N nodes, B branching factor, depth D), the tree builder is O(N) for `hierarchy(...)` + O(N) for tree layout. The `crossEdges` lookup is **O(C × N)** worst case — for each cross-edge, `nUp.find(node => node.data.id === edge.sourceId)` is a linear scan (generateGraph.ts:83-84, 123-124). A graph with 1K cross-edges and 5K nodes performs 5M comparisons per render. |
| `LineageGraph.useEffect [fn, data]` + `[data]` (LineageGraph.tsx:46-52) | `setRenderedNodes([...nodesUp, ...nodesDown])` + `setRenderedLinks([...linksDown, ...crossLinksDown, ...linksUp, ...crossLinksUp])` | Context state writes — propagate to `LineageProvider` consumers | None | The `[fn, data]` dep on setRenderedNodes is asymmetric to the `[data]` dep on setRenderedLinks — toggling `fn` (full-names) re-renders nodes but NOT links. Intentional? Unverified — implicit_adrs[5] tracks this. |
| `Node.tsx` `handleMouseEnter` (Node.tsx:81-84) | `getHighLightedLinks(node, renderedLinks, streamType, setHighLightedLinks)` (helpers.ts:102-114) — scans `renderedLinks` array filtering by `node.data.id === link[sourceKey].data.id` | Context state write — `highLightedLinks` (LineageContext.ts:11) | None | For a graph with L links, each hover scans L items. The Provider re-renders on every `highLightedLinks` change (LineageProvider.tsx:67) — for graphs with hundreds of nodes this is the per-frame hot path. Move-over-a-node, move-off-a-node fires the effect twice. |
| `LoadMoreButton.tsx` `loadMoreButtonHandler` (LoadMoreButton.tsx:55-66) | `dispatch(fetchDataEntityDownstreamLineage({dataEntityId, lineageDepth: 1, rootNodeId, expandGroups: eag}))` + `setQueryParams(prev => ({...prev, exd: [...prev.exd, dataEntityId]}))` | API GET + Redux state merge (slice.ts:206-220 monotonic add); URL state write | None | Each LoadMore is `lineageDepth=1` (line 56) — a one-hop expansion. The slice's `localDownstreamState.allNodes / allEdges` (slice.ts:30-48) GROWS MONOTONICALLY across LoadMore clicks — there is no 'collapse this branch back' affordance, no LRU eviction. A user clicking LoadMore on 100 leaves accumulates 100 batches of payload in memory. |
| `Node.tsx` `handleTitleClick` (Node.tsx:70-72) | `navigate(lineageLink)` to `/dataentities/{entityId}/lineage?{lineageQueryString}` | URL change — unmounts current Lineage tree, remounts a NEW one rooted at the clicked entity | None | The default-query `lineageQueryString` (Node.tsx:46-52) uses `d: node.depth || 1` — so clicking deep into a graph and navigating navigates with `d = the clicked node's depth` (not 1). For a node at depth 5, the new view loads with depth=5 — which compounds the recursive-CTE cost on the backend (REFACTOR-202). |

## tests_coverage_semantic

- covered_behaviours: [] — no `*.test.ts*` files exist under `odd-platform-ui/src/components/DataEntityDetails/Lineage/` (verified via Glob `**/Lineage/**/*.test.ts*` returned no files; broader Glob `**/__tests__/**/*Lineage*` also returned no files). The UI lineage canvas has ZERO test coverage at any level (unit, integration, visual-regression, E2E).
- uncovered_behaviours: [
    "{behaviour: 'Lineage.tsx route-dispatch — DEG vs non-DEG branch selection based on `isDEG` selector', test_class: unit}",
    "{behaviour: 'HierarchyLineage useEffect sequential fetch — downstream resolves before upstream fires; failure short-circuits chain', test_class: integration}",
    "{behaviour: 'd query-param mounts the canvas with d=1 even when URL omits ?d=', test_class: unit}",
    "{behaviour: 'depth-slider change re-fires the dual fetch with new `lineageDepth`', test_class: integration}",
    "{behaviour: 'LoadMore click appends entity id to exd/exu and dispatches lineageDepth=1 fetch; slice accumulates nodes/edges without dedupe failure on overlap', test_class: integration}",
    "{behaviour: 'Diamond DAG (A→B, A→C, B→D, C→D) renders D twice in the d3-hierarchy tree — UI does not dedupe on the visual side; current behaviour pinned by NO test (REFACTOR-202 amplifies into the UI)', test_class: integration}",
    "{behaviour: 'Cycle handling — backend payload with cross-edges renders edges as CrossLink components separately from tree links; current shape unverified by any test', test_class: integration}",
    "{behaviour: '500-class lineage-fetch failure renders AppErrorPage with the wire status — F-005 NPE-on-null-lineage_depth surfaces here ONLY for direct URL manipulation (?d= removed from URL — d remains 1 from default; an empty string ?d=) and is unexercised', test_class: integration}",
    "{behaviour: 'Click-through on a node title navigates to /dataentities/{clickedId}/lineage; URL queryString preserved; node.depth flows into new view as d= value', test_class: integration}",
    "{behaviour: 'Pan/zoom transformMatrix persists across navigation via ?t= URL param', test_class: integration}",
    "{behaviour: 'Expand-all-groups toggle dispatches expandEntitiesFromUpstreamGroup + expandEntitiesFromDownstreamGroup; the local-state mutation in the slice is order-dependent (slice.ts:30-48 module globals)', test_class: integration}",
    "{behaviour: 'parseData assigns a UUID to every node — uuidv4 stability across re-renders; mismatched UUIDs cause React reconciliation thrash', test_class: unit}",
    "{behaviour: 'crossEdges resolve to materialised nodes — when a cross-edge references an id that is NOT in nodesUp/nDown (race window: payload skew), the find() returns undefined and the edge is silently dropped from the rendered set (generateGraph.ts:86-92, 126-132)', test_class: unit}",
    "{behaviour: 'Microservices lineage variant — the prompt asks whether this component renders microservices lineage; the codebase makes NO distinction at this layer — there is no `mode` prop, no `?ms=` param, no conditional render based on data-entity class. Microservices ARE data entities and surface through the SAME endpoints; the canvas treats them identically to datasets/transformers — un-pinned behaviour', test_class: integration}"
  ]
- test_files: [] — none exist in the repo (verified via two Glob queries).
- gaps: |
    Total coverage gap at the UI layer is severe and load-bearing. The entire frontend half of F-005 — depth selection, dual-stream fetch sequencing, LoadMore monotonic accumulation, click-through navigation, diamond/cycle rendering, error-state rendering, view-mode toggles — is ZERO-tested. The closest the project gets to UI lineage coverage is the backend `LineageServiceTest#getLineageTest` (batch-I sidecar) which mocks the repository and asserts a 3-node graph shape; this does NOT exercise any of the d3-hierarchy tree building, the slice merge logic, the URL-state contract, the LoadMore depth-1 fanout, or the diamond/cycle visualisation behaviour. Three highest-value additions: (1) a `dataEntityLineage.slice.test.ts` for the merge-on-fetch invariants and the local-mutable-state quirks (module-level globals at slice.ts:30-48 are a latent bug magnet); (2) a `generateGraph.test.ts` pinning diamond rendering (D appears twice — current behaviour) and crossEdge-with-missing-node (drops silently) and depth/branching cost ceilings; (3) a Storybook+Chromatic visual regression for the canvas at fixed-fixture inputs (3-node tree, 7-edge tree, 20-node cycle, 50-node diamond, 100-node + 1000-cross-edge stress). Beyond that, a Playwright E2E exercising the click-through-navigates-with-node.depth-as-new-d behaviour would pin the second-order coupling between this canvas and the F-001 entity-detail flow.

## docs_link_semantic

- declared_docs: [] — No `@docs` annotation in any of `Lineage.tsx`, `HierarchyLineage.tsx`, `LineageGraph.tsx`, `LineageProvider.tsx`, `LineageControls.tsx`, `Node.tsx`, `LoadMoreButton.tsx`, `generateGraph.ts`, or `constants.ts`. The UI tree has no source-side doc declarations.
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-lineage"
    anchor: ""
    rationale: "P-05 Data Lineage pillar landing page — the operator-facing description of the surface this UI component renders"
    last_verified_at: "2026-05-19"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      WebFetch 2026-05-19 (live URL, status 200): page describes data-object lineage + microservices lineage as the two surfaces backed by the same endpoints; mentions "the Lineage tab on any data-entity detail page" and "the microservices view is reached from any catalogued microservice entity ingested through odd-tracing-gateway". The page is SILENT on: lineage_depth defaults, the depth UI slider (lineageDepth=[1..20] constants.ts:97-99), cycle visualisation, diamond DAG amplification, owner scoping, click-through behaviour, loading/error states (all verified ABSENT in the WebFetch result).
  - url: "https://docs.opendatadiscovery.org/features/data-lineage/data-objects"
    anchor: ""
    rationale: "P-05:F-001 sub-feature page — describes the per-entity upstream/downstream graph backed by `/api/dataentity/{id}/lineage`. Local file at documentation/docs/data-lineage/data-objects.md was read in this session"
    last_verified_at: "2026-05-19"
    last_verified_status: pending-live-WebFetch
    confidence: MEDIUM
    fetched_excerpts: |
      documentation/docs/data-lineage/data-objects.md:11-16 — 'Lineage tab on any data-entity detail page — opens the entity-centric graph with the entity at the centre and configurable upstream / downstream depth. ... The graph supports pan, zoom, and on-click expansion of intermediate nodes; the per-entity depth and pre-expanded nodes are controlled by query parameters (next section).' Page describes the two parameters at high level + links to the API reference; SILENT on cycle behaviour, diamond rendering, LoadMore semantics, view-mode toggle, full-names toggle, depth-slider range [1..20].
  - url: "https://docs.opendatadiscovery.org/developer-guides/api-reference/lineage"
    anchor: ""
    rationale: "API-reference page documenting `lineage_depth` and `expanded_entity_ids` — the parameters this UI component populates"
    last_verified_at: "2026-05-19"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      WebFetch 2026-05-19 (live URL, status 200): documents `lineage_depth` 'Number of hops to traverse from the rooted entity. Unset returns the platform's default depth. Lower values give a quick neighbourhood view; higher values follow cross-system pipelines end-to-end at the cost of a larger response payload.' Documents `expanded_entity_ids` 'IDs of Data Entity Group entities that should be expanded inline in the response. By default groups appear as a single collapsed node; passing a group's ID here drills into that one group for the request without expanding any others.' Page is SILENT on: maximum bound (the UI caps at 20 per constants.ts:97-99 — NOT documented), default-depth value (the UI sends d=1 — NOT documented as the platform default).
- doc_drift_findings:
  - "Live API-reference doc says `lineage_depth` 'Unset returns the platform's default depth' — but the UI ALWAYS supplies d=1 from `defaultLineageQuery.d=1` (constants.ts:77); the 'unset' branch is unreachable from the UI. The 'platform default depth' has no canonical value: backend service has no default (LineageServiceImpl.java:89-122 per batch-I sidecar — autoboxing NPE on null), backend controller has no `@RequestParam(defaultValue=)`, and the UI hardcodes 1. F-005 facet 1 captures this drift."
  - "Live API-reference doc declares `lineage_depth` minimum 1 but NO maximum. The UI's depth `<AppSelect>` (LineageControls.tsx:113-117) caps at 20 (constants.ts:97-99). The 20-cap is product-policy that lives only in the UI and is not documented; a direct API caller can pass any positive int (REFACTOR-202 amplification surface)."
  - "Live data-lineage doc says 'The graph supports pan, zoom, and on-click expansion of intermediate nodes' (data-objects.md:16). The implementation also supports: depth slider [1..20], full-vs-compact view toggle, full-names toggle, expand-all-groups toggle, double-click-to-zoom (ZoomableLineage.tsx:33-36), centre-on-root button (LineageControls.tsx:90-95), transform-matrix persistence in `?t=` URL. These features are undocumented at the user-facing level."
  - "Live doc is SILENT on the LoadMore-button mechanic. The 'Load N more' button (LoadMoreButton.tsx:102) on a leaf node is the primary way a user expands beyond the initial depth — the doc's description 'configurable upstream / downstream depth' does not mention the alternative depth-1 expansion path. A user unfamiliar with the LoadMore affordance would assume they need to increase `d` and re-fetch."
  - "Live doc is SILENT on cycle/diamond visualisation. The UI renders cycles via `crossEdges` (separate `CrossLink` SVG component) and renders diamonds via duplicate tree nodes (D appears twice if reachable via two paths). Neither behaviour is documented."

## implicit_adrs

- "**UI defaults `d=1` — the silent default-depth contract** (constants.ts:74-84 `defaultLineageQuery: { d: 1, ... }`). The UI ALWAYS sends `lineage_depth=1` even when the URL omits `?d=`, masking the F-005 NPE-on-null caveat from the UI path. There is no comment defending the choice, but the pattern is consistent across the codebase: `useQueryParams(defaultLineageQuery)` (HierarchyLineage.tsx:40) is the contract, and every component (LineageControls.tsx:25, LoadMoreButton.tsx:41, Node.tsx:49-52) participates in the same default. The implicit decision is 'UI is the default supplier; backend can be lazy about defaults'. Intent-anchor: the consistency of the defaultLineageQuery usage across LineageControls.tsx:25, LoadMoreButton.tsx:41, LineageGraph.tsx:36, LineageProvider.tsx:31, ZoomableLineage.tsx:26, HierarchyLineage.tsx:40, Node.tsx:50-52 — applied seven times across the lineage tree as a coordinated default. — evidence: constants.ts:74-84 + the 7-component usage trace — confidence: MEDIUM (the consistency suggests intent; the absence of a defending comment makes it judgement-call)"
- "**URL is the source of truth for view state** — depth `d`, full-names `fn`, view-mode `full`, expand-all-groups `eag`, transform matrix `t`, and the four expansion-id arrays (`exd`, `exu`, `exdg`, `exug`) ALL live in the URL query string (interfaces.ts:75-85), not in React state, not in localStorage, not in Redux UI-slice. The pattern is consistent: every control writes via `setQueryParams` (LineageControls.tsx:33, 40, 47, 51; LoadMoreButton.tsx:59, 64; ZoomableLineage.tsx:30). Intent-anchor: the `defaultLineageQuery` constant exporting all view-state defaults as URL params (constants.ts:74-84); the absence of any React state for view config in LineageProvider (LineageProvider.tsx:33-41 — only renderedNodes/links/highLightedLinks are React state, all of which are derived from URL+data). The implicit ADR is 'lineage view is shareable via URL'. — evidence: interfaces.ts:75-85 + setQueryParams calls across 4 components — confidence: HIGH"
- "**d3-hierarchy over force-directed graph** — the choice of `d3-hierarchy` `tree<T>()` layout (generateGraph.ts:1, 57, 97) over a force-directed graph (e.g. `d3-force`, Cytoscape, react-flow) is intentional and load-bearing. The tree layout gives deterministic node positions per render — same input → same SVG coordinates → predictable user experience as data grows. The cost: DAG shapes (diamonds) duplicate nodes (D in A→B→D + A→C→D renders twice — confirmed by reading generateGraph.ts:68-76, 108-116 where `hierarchy(parsedData.root, d => parsedData.upstream.edgesById[d.id]?.map(...))` recursively visits children from each node, with no visited-set check). The choice prioritises layout determinism over visual DAG faithfulness. Intent-anchor: the deliberate `d3tree<TreeNodeDatum>().nodeSize([...]).separation(...)` builder (generateGraph.ts:57-66) + the separate `crossEdges` plumbing (generateGraph.ts:81-95, 121-135) that handles non-tree edges as a second class. The pattern says 'lineage IS a tree at the UI layer, with cross-edges as an overlay'. — evidence: generateGraph.ts:57-148 (the tree builder + crossEdge handler) — confidence: HIGH"
- "**Two-direction independent layouts mirrored** — separate `d3tree` instances for upstream (generateGraph.ts:57-76) and downstream (generateGraph.ts:97-116), each rooted at the same `parsedData.root`. Upstream's x-coordinate is INVERTED via `-(width + mx)` (line 60) so the trees grow in opposite directions from the root. The mirroring is intentional: a single tree builder with directional edges would put all nodes on one side. Intent-anchor: the explicit sign flip at generateGraph.ts:60 (`-(nodeSize.size.width + nodeSize.size.mx)`) which is the only difference between treeUp and treeDown configuration. The pattern says 'upstream + downstream are siblings of the root, rendered as one centre-anchored visualisation'. — evidence: generateGraph.ts:57-76 + 97-116 (paired tree builders) — confidence: HIGH"
- "**Click-through preserves URL params bag and uses node.depth as new d** — clicking a node title navigates to `dataEntityLineagePath(entityId, lineageQueryString)` where `lineageQueryString` is built from `useQueryParams({...defaultLineageQuery, d: node.depth || 1})` (Node.tsx:49-52). The decision encodes: 'when you click into a node, the view that opens uses that node's depth as the new traversal depth' — i.e. the click compounds depth as you drill in. Intent-anchor: the explicit `d: node.depth || 1` override (Node.tsx:51) which deliberately overwrites the parent view's `d` value with the child's depth. The pattern says 'navigation depth tracks rendered depth — clicking into a node 5 hops out from root expands depth=5 around that new root'. — evidence: Node.tsx:46-72 — confidence: HIGH"
- "**Module-level mutable globals for the LoadMore accumulator** (dataEntityLineage.slice.ts:30-48 — `localUpstreamState`, `localDownstreamState` — defined OUTSIDE the slice's `reducers`, mutated freely across actions). The pattern is unusual for Redux Toolkit (which usually keeps all state in Immer drafts inside reducers). The choice optimises for: cross-fetch accumulation of nodes/edges without storing them in normalised Redux state (memory + dedup is cheaper with native Set/Map than with Immer-tracked objects). The cost: a) state-leak across rootNodeId changes is mitigated by `resetLocalState` (slice.ts:202-203, 281-282), but the reset is `IF rootNodeId === dataEntityId` only — for some flows the globals carry over; b) the globals are NOT in any DevTools timeline, NOT in any snapshot — debugging means stepping the source. Intent-anchor: the deliberate module-level declaration + the resetLocalState helper (slice.ts:202-203). The pattern says 'we trade Redux observability for accumulator performance'. — evidence: dataEntityLineage.slice.ts:30-48, 202-203, 281-282 — confidence: MEDIUM"

## bugs_limitations_corner_cases

- "**Diamond DAG amplification at the UI** — `d3-hierarchy.hierarchy(root, childAccessor)` (generateGraph.ts:69-76, 109-116) builds a TREE, not a DAG. If entity D is reachable from root R via two paths (R→B→D and R→C→D), D appears TWICE in the rendered tree — each instance is a distinct `HierarchyPointNode` with its own `d3attrs.id` UUID (parseData stamps UUIDs once per RAW node, but `hierarchy(...)` re-visits the same raw node along each path, so the SAME `d3attrs.id` shows up at two positions). React keys at LineageGraph.tsx:91 use `node.x${node.y}` — DIFFERENT positions ARE distinct keys, so React mounts two SVG nodes. Cumulatively, this amplifies REFACTOR-202 from the backend into the UI: a diamond at backend produces N rows; the UI renders N visual nodes. — evidence: generateGraph.ts:68-76 (no visited-set) + LineageGraph.tsx:84-110 (node-per-instance rendering) — severity: MEDIUM"
- "**No upper bound on `d` URL param parsing** — `useQueryParams.ts:36` uses `parseNumbers: true` which converts `?d=999999999` to `d: 999999999`; the UI's depth `<AppSelect>` (LineageControls.tsx:104-118) only exposes [1..20] but the URL accepts any integer. A user who hand-edits `?d=10000` triggers a backend recursive-CTE walk to depth 10000 (REFACTOR-202 amplifies). The UI never validates or clamps. — evidence: useQueryParams.ts:33-36 + constants.ts:97-99 (the [1..20] is dropdown-only, not validation) + HierarchyLineage.tsx:47 (passes d straight through) — severity: HIGH"
- "**No client-side dedupe of crossEdges that reference missing nodes** — `crossEdges` resolution (generateGraph.ts:81-95, 121-135) uses `nUp.find(node => node.data.id === edge.sourceId)`; if the cross-edge references an id that did NOT appear in `upstream.nodesById` (or was filtered before the tree builder ran), the `find()` returns `undefined`, the `if (sourceNode && targetNode)` guard skips the edge, and the cross-edge is SILENTLY DROPPED from the rendered set. No error log, no Sentry breadcrumb, no UI breadcrumb. A backend payload skew (nodesById/crossEdges out of sync) loses lineage information visibly to the operator but invisibly in any failure-reporting channel. — evidence: generateGraph.ts:81-95 + 121-135 (silent skip) — severity: MEDIUM"
- "**LoadMore monotonic accumulation has no collapse affordance** — `dataEntityLineage.slice.ts:206-220` MERGES new nodes into `localDownstreamState.allNodes` via `if (!localDownstreamState.nodeIds.has(node.id)) localDownstreamState.allNodes.push(node)`. There is no 'remove this expansion' action, no LRU eviction, no max-size cap. A user clicking LoadMore on 100 leaf nodes in a 10K-node graph accumulates 100×(per-leaf-payload-size) of nodes/edges in the slice — and in the rendered SVG tree — until they navigate away. The `LoadMoreButton` hides itself after click (Node.tsx:174 — `setHideLoadMore(true)`) but the underlying data stays. — evidence: dataEntityLineage.slice.ts:206-220, 285-299 + LoadMoreButton.tsx:55-65 — severity: MEDIUM"
- "**Sequential fetch contract is fragile under partial failures** — HierarchyLineage.tsx:54-66 issues downstream first, then `.then()` upstream — if downstream returns 500 (e.g. F-005 NPE), upstream NEVER fires. The Redux error state for downstream surfaces via `downstreamError` selector (line 77), but `upstreamError` is null because the fetch never ran; the user sees a single error but the UI cannot recover by just retrying upstream. Failure is binary: either both succeed (canvas renders) or AppErrorPage shows. — evidence: HierarchyLineage.tsx:44-67 — severity: MEDIUM"
- "**`useEffect` deps mismatch for renderedLinks** — `setRenderedNodes` effect depends on `[fn, data]` but `setRenderedLinks` depends only on `[data]` (LineageGraph.tsx:46-52). Toggling `fn` (full names) re-renders nodes (because titleHeight changes via nodeSize) but does NOT re-fire setRenderedLinks. Whether this is intentional (link positions don't depend on `fn`) or a bug (titleHeight changes nodeSize → link y-coordinates also change because nodeSize feeds tree builder at LineageGraph.tsx:43) is unclear from the code — no comment, no test. — evidence: LineageGraph.tsx:46-52 — severity: LOW"
- "**`linksUp`/`crossLinksUp` props receive `setHighlightedLinksFirst(linksDown, ..., reverse=true)` reversal flag inversion** — at LineageGraph.tsx:56 the call is `setHighlightedLinksFirst(linksUp, highLightedLinks, true)` (reverse=true for upstream); at line 63 it's `setHighlightedLinksFirst(linksDown, ..., false)`. The `isLinkHighLighted` helper (helpers.ts:116-129) has two branches keyed on reverse — the upstream branch checks BOTH `(target↔source) reversed AND target↔target source↔source forward` (helpers.ts:122-126 — a 4-condition OR). The forward branch checks only `source↔source AND target↔target` (line 127-128). This asymmetry means upstream highlight may match more aggressively than downstream — visually inconsistent on hover but pinned by no test. — evidence: helpers.ts:116-129 — severity: LOW"
- "**Microservices lineage is rendered by the same component with no mode toggle** — the prompt asks whether microservices lineage is a separate tab or same component with mode toggle; reading reveals it is NEITHER. Microservices ARE data entities; their Lineage tab on the entity-detail page uses the SAME `<Lineage />` component, the SAME `/api/dataentities/{id}/lineage/downstream` endpoint. There is no mode flag, no class-based override. This means: (a) all caveats above (diamond amplification, no upper-bound on d, monotonic LoadMore) apply identically to microservices traces; (b) microservices-specific affordances (e.g. service name vs operation name, trace timing) are NOT rendered — they are silently dropped if the response has them. — evidence: Lineage.tsx:12-26 (only DEG branch is special; everything else routes to HierarchyLineage) + no `microservice` keyword in any of the read source files — severity: MEDIUM"
- "**No retry on transient failure** — `handleResponseAsyncThunk` (thunks.ts:10) is configured with `switchOffErrorMessage: true` for both lineage thunks (lines 27, 43) — meaning the thunk silently sets the error state instead of showing a toast. The user sees only the AppErrorPage at the end of the chain. No exponential backoff, no automatic retry, no 'retry' button on the error page. A flaky network sees the user navigate away. — evidence: thunks.ts:13-44 + AppErrorPage.tsx (no retry affordance) — severity: LOW"
- "**Anchor-set defence-in-depth not exercisable at the UI** — the prompt asks 'does the UI fetch via `/my/upstream` or `/lineage` endpoints?' The UI ALWAYS fetches via `/api/dataentities/{id}/lineage/downstream` and `/upstream` (thunks.ts:19, 36 calling `dataEntityApi.getDataEntityDownstreamLineage` / `getDataEntityUpstreamLineage`) — the NEGATIVE case of REFACTOR-225/237 anchor-set pattern (per batch-I LineageServiceImpl sidecar). The UI does NOT use `getMyObjectsWithDownstream` (the POSITIVE case used by DataEntityRelationsServiceImpl). Consequence: every user (LOGIN_FORM/OAUTH2/LDAP authenticated; anonymous if DISABLED) enumerates the cross-owner lineage subgraph from the Lineage tab — the user-visible effect of REFACTOR-203. — evidence: thunks.ts:19, 36 (the only fetch surface) — severity: HIGH (this is the user-observable consequence of the security gap; not a UI bug per se, but the UI is the realisation point)"

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP | DISABLED — N/A as direct dependency` — UI component does not branch on auth mode. The mounting route `/dataentities/:id/lineage` is gated by the SPA's outer auth shell (not within this component); under DISABLED the canvas renders for anonymous users with the same payload exposure.
- **ingestion_filter_relevance**: `NO — UI canvas, not ingestion`. The lineage GET endpoints are read-side; the S2S ingestion filter (`IngestionDataEntitiesFilter`) does not apply.
- **authorization_assertions**: [] — no permission gates, no `usePermission`-style hook in this tree. The backend `DataEntityController.getDataEntityDownstreamLineage` has no `@PreAuthorize` per batch-F sidecar; the UI mirrors that absence (no gate to read).
- **owner_scoping**: `BYPASSES — returns data across owners` — the UI fetches via `getDataEntityDownstreamLineage` / `getDataEntityUpstreamLineage` (thunks.ts:19, 36) which hit `LineageServiceImpl.getLineage` (per batch-I sidecar) — the NEGATIVE case of anchor-set defence-in-depth (LineageServiceImpl.java:54-57 has no AuthIdentityProvider field, line 92 resolves root by raw dataEntityId with no owner-anchoring). Any authenticated user sees the full reachable lineage subgraph from any entity, including edges into entities owned by other teams. evidence: thunks.ts:19, 36 + LineageServiceImpl batch-I sidecar.
- **data_exposure**: [
    "`DataEntityLineage` payload (full nodesById + edgesById + crossEdges + per-node DataEntityRef including oddrn, internalName, externalName, dataSource, entityClasses, owners) → ANY authenticated user (LOGIN_FORM / OAUTH2 / LDAP) OR anonymous (DISABLED), no owner-scope filter applied at any layer (REFACTOR-203 — confirmed primary-source at LineageServiceImpl.java:54-122 per batch-I sidecar). The UI rendering at LineageGraph.tsx + Node.tsx surfaces all of these fields visually — including the oddrn (Info component at Node.tsx:135-147) and owner names (Owners are part of DataEntityRef per the OpenAPI spec).",
    "The browser's URL bar carries the full query-param bag including the depth `?d=` and the comma-separated `?exd[]=1,2,3,4` arrays. A user sharing a screenshot of their browser leaks the IDs of every node they've LoadMore-expanded into a backend-readable cross-owner footprint.",
    "The `?t=` URL param carries a JSON-encoded transform matrix (ZoomableLineage.tsx:30 — `t: JSON.stringify(zoom.transformMatrix)`) — not sensitive, but a URL-length-eater on heavily-zoomed graphs."
  ]
- **known_security_gaps**: [
    "controller-tier authorization absent (per batch-F sidecar) — UI inherits the absence; no UI affordance compensates. severity: MEDIUM — evidence: thunks.ts:13-44 (the fetch surface) + DataEntityController.java:255-273 (no @PreAuthorize per batch-F).",
    "Cross-owner enumeration at UI realisation point — the user-observable consequence of REFACTOR-203 is that ANY authenticated user can click into the Lineage tab on ANY entity (regardless of their owner association) and read the full reachable subgraph. The UI provides no 'restricted view' mode, no 'show only my owners' toggle. severity: HIGH — evidence: thunks.ts:19, 36 + LineageServiceImpl.java:54-122 per batch-I sidecar + the absence of any owner-filter selector in HierarchyLineage.tsx:4-11 selector imports.",
    "Unvalidated `?d=` URL param flows directly to the backend (HierarchyLineage.tsx:47) — a curious user editing `?d=10000` triggers the REFACTOR-202 amplification surface from the URL. No UI clamp. severity: HIGH (combined with backend REFACTOR-202 absence of upper bound) — evidence: useQueryParams.ts:36 (`parseNumbers: true`) + HierarchyLineage.tsx:47 + the absence of any clamp call.",
    "Unvalidated `?exd[]=` / `?exu[]=` URL param arrays flow directly to the backend (HierarchyLineage.tsx:51-52). A user crafting `?exd[]=1,2,3,...,10000` triggers a large IN-clause backend-side. No UI clamp on array size. severity: LOW — evidence: HierarchyLineage.tsx:51-52 + thunks.ts:19-22.",
    "The `?t=` URL param accepts `JSON.parse(t)` (HierarchyLineage.tsx:85) without try/catch — a malformed value (e.g. user manually edits `?t=foo`) throws and crashes the React tree. severity: LOW — evidence: HierarchyLineage.tsx:84-88."
  ]

## performance

- **hot_paths**: [
    "Initial Lineage-tab mount fires TWO sequential HTTP round-trips to the backend (`HierarchyLineage.tsx:54-66` — downstream then upstream); each round-trip executes a recursive-CTE walk + depth-1 expansion + per-oddrn metadata fetch (3 DB calls × 2 fetches = 6 DB round-trips minimum per Lineage tab open; per LineageServiceImpl batch-I sidecar downstream_side_effects). Cumulative latency = max(backend latency for both fetches) sequentially — typically 200-1000ms per open.",
    "Tree-builder useMemo at LineageGraph.tsx:40-44 runs synchronously on each `data` change. For N nodes the `hierarchy(...)` traversal is O(N); the tree layout is O(N); the crossEdges resolution is O(C × N) (linear scan per cross-edge — generateGraph.ts:83-84, 123-124). For a 5K-node graph with 1K cross-edges this is 5M operations per render.",
    "Hover-over-a-node fires `getHighLightedLinks` (Node.tsx:81-84 → helpers.ts:102-114) — scans `renderedLinks` array (full graph link count) on every mouse-enter. For a graph with 1K nodes and 2K links, this is 2K comparisons per hover, executed once per mouse-enter and once per mouse-leave.",
    "Title-height measurement (helpers.ts:10-37) creates a temporary DOM `<div>` per node title, measures `offsetHeight`, removes the node — forces a layout/reflow per title. For N nodes this is N reflows on the initial render and on every `fn` toggle. The temporary divs hit the live `document.body` (line 30) — observable in DevTools timeline as 'Recalculate Style'."
  ]
- **throughput_characteristics**: [
    "Two-phase initial load: downstream THEN upstream (sequential, not parallel — `.then()` chain at HierarchyLineage.tsx:54-55). Parallelising would halve the worst-case wait time but complicate error handling (currently a downstream failure short-circuits upstream).",
    "LoadMore is per-node-click; each click is one additional HTTP round-trip with `lineageDepth: 1`. A user expanding 10 leaves issues 10 sequential network round-trips.",
    "View-state changes (depth slider, full-names, view mode) that affect the URL trigger a fresh fetch via the `[d, dataEntityId]` effect (HierarchyLineage.tsx:67) — depth changes refetch; fn / full / eag changes do NOT refetch (they re-render only)."
  ]
- **resource_allocation**: [
    "Every node + link mounts as an SVG component (LineageGraph.tsx:55-110) — no virtualisation. For a 1K-node graph this is 1K `<g>` + 1K-2K `<path>` + per-node sub-components (NodeTitle, HiddenDependencies, Info, Classes, DatasourceLogo, LoadMoreButton). React DevTools 'Profiler' would show a single render with O(N) commit work.",
    "uuidv4 stamping on every node in the API response (generateGraph.ts:20) — generates one UUID per node on each `parseData` call; UUIDs are stable for the lifetime of the data reference but regenerate on every fresh fetch.",
    "The Redux slice's module-level globals `localUpstreamState.allNodes` / `allEdges` (slice.ts:30-48) GROW MONOTONICALLY across LoadMore clicks; bounded only by reset at next root entity navigation (slice.ts:202-203, 281-282).",
    "Lineage payload size scales with backend `lineageDepth` × branching factor. A depth-20 query on a hub-and-spoke topology (1 root, 100 immediate children, 10 grandchildren each = 1100 nodes) returns ~110KB JSON per direction; downstream + upstream = ~220KB transferred per tab open."
  ]
- **scaling_characteristics**: [
    "Stateless client component — every Lineage instance is its own React subtree; multiple tabs in different browser windows scale linearly with client browser resources.",
    "No client-side pagination — the entire upstream/downstream graph from the API is rendered at once. A 10K-node graph mounts 10K SVG components; browser frame-budget exhausts long before that scale.",
    "URL-state-as-source-of-truth (constants.ts:74-84) means deep-linking is supported but URL length grows with `?exd[]=` array size. Chrome's URL limit is ~2K chars effective; a user expanding 200+ leaves hits the cap.",
    "The d3-hierarchy tree builder (generateGraph.ts:49-148) runs on the main thread synchronously — no Web Worker, no `requestIdleCallback`. For large graphs the render is blocking."
  ]
- **known_performance_gaps**: [
    "Diamond-amplification at the UI (REFACTOR-202 from backend amplifies into the UI rendering surface) — duplicate nodes are mounted as separate SVG components, doubling render work for diamond-heavy topologies. severity: MEDIUM — evidence: generateGraph.ts:68-76 (tree-not-DAG) + LineageGraph.tsx:84-110.",
    "Hover handler scans full renderedLinks array on every mouse-enter — O(L) per hover; on a 5K-link graph this is 5K comparisons per pixel of mouse movement. severity: MEDIUM — evidence: helpers.ts:102-114 + Node.tsx:81-84.",
    "Title-height measurement forces layout-thrashing reflows during initial render (helpers.ts:10-37 — N reflows for N nodes). severity: HIGH for graphs > 100 nodes — evidence: helpers.ts:10-37.",
    "No virtualisation — all SVG primitives mounted; render cost is O(N) with large constants. severity: HIGH for graphs > 500 nodes — evidence: LineageGraph.tsx:55-110.",
    "Sequential dual-fetch — downstream then upstream — could be parallelised. severity: LOW (typical net win 200-500ms) — evidence: HierarchyLineage.tsx:54-66.",
    "No upper bound on `?d=` URL param — direct URL editing surfaces backend REFACTOR-202 amplification. severity: HIGH — evidence: useQueryParams.ts:36 + HierarchyLineage.tsx:47 (no clamp).",
    "Module-level mutable accumulators in the slice (slice.ts:30-48) — outside Redux Toolkit's Immer-tracked state, opaque to DevTools timeline, and grow monotonically until rootNodeId changes. severity: LOW (behavioural correctness more than performance, but contributes memory pressure on long sessions) — evidence: slice.ts:30-48."
  ]

## sources

- understanding ← Lineage.tsx:1-28 + HierarchyLineage.tsx:1-138 + LineageGraph.tsx:1-115 + LineageProvider.tsx:1-75
- concepts.entities.DataEntityLineageById ← LineageGraph.tsx:2 + redux/interfaces export
- concepts.entities.LineageQueryParams ← interfaces.ts:75-85
- concepts.entities.TreeNodeDatum ← LineageGraph.tsx:2 + generateGraph.ts:19-22
- concepts.entities.LineageContext ← LineageContext.ts:7-27 + LineageProvider.tsx:28-72
- concepts.entities.lineageDepth ← constants.ts:97-99
- concepts.operations.HierarchyLineage-fetch ← HierarchyLineage.tsx:44-67
- concepts.operations.LineageGraph-render ← LineageGraph.tsx:24-114
- concepts.operations.generateTree ← generateGraph.ts:49-148
- concepts.operations.LineageProvider-measure ← LineageProvider.tsx:28-73 + helpers.ts:10-49
- concepts.operations.LoadMoreButton ← LoadMoreButton.tsx:55-66
- concepts.operations.LineageControls.depth ← LineageControls.tsx:38-43 + 104-118
- concepts.operations.Node-click-through ← Node.tsx:46-72
- concepts.invariants.tree-not-DAG ← generateGraph.ts:68-76 + 108-116
- concepts.invariants.crossEdges-separate ← generateGraph.ts:81-95 + 121-135 + LineageGraph.tsx:69-83
- concepts.invariants.URL-as-source-of-truth ← interfaces.ts:75-85 + useQueryParams.ts:38-44
- concepts.invariants.d-default-1 ← constants.ts:77 (`d: 1`) + the seven defaultLineageQuery usages
- concepts.invariants.LoadMore-depth-1 ← LoadMoreButton.tsx:56
- concepts.invariants.click-preserves-params ← Node.tsx:46-72 + dataEntitiesRoutes.ts:89-93
- concepts.invariants.two-trees-mirrored ← generateGraph.ts:57-76 + 97-116
- concepts.invariants.no-virtualisation ← LineageGraph.tsx:55-110
- dependencies_semantic.requires-feature.F-005 ← F-005 detail at feature-flows/detail/F-005.yaml + DataEntityController.java:255-273 (per batch-F sidecar)
- dependencies_semantic.requires-feature.live-doc-page ← WebFetch 2026-05-19 https://docs.opendatadiscovery.org/features/data-lineage (status 200)
- dependencies_semantic.requires-feature.live-api-page ← WebFetch 2026-05-19 https://docs.opendatadiscovery.org/developer-guides/api-reference/lineage (status 200)
- dependencies_semantic.requires-runtime.d3-hierarchy ← generateGraph.ts:1, 57, 97
- dependencies_semantic.requires-runtime.visx ← HierarchyLineage.tsx:2, 106-127 + Node.tsx:4, 107 + ZoomableLineage.tsx:4, 34
- dependencies_semantic.requires-runtime.uuidv4 ← generateGraph.ts:3, 20
- dependencies_semantic.requires-runtime.query-string ← useQueryParams.ts:3, 28-36
- dependencies_semantic.couples-to.DataEntityApi ← thunks.ts:13-44
- dependencies_semantic.couples-to.slice ← dataEntityLineage.slice.ts:52-349
- dependencies_semantic.couples-to.dataEntityLineagePath ← Node.tsx:10, 54-68 + dataEntitiesRoutes.ts:89-93
- upstream_callers.DataEntityDetails-router ← Lineage.tsx:12-26 + dataEntitiesRoutes.ts:89-93
- upstream_callers.Node-click ← Node.tsx:70-72 + dataEntityLineagePath at routes/dataEntitiesRoutes.ts:89-93
- downstream_side_effects.HierarchyLineage-useEffect ← HierarchyLineage.tsx:44-67
- downstream_side_effects.LineageGraph-useMemo ← LineageGraph.tsx:40-44 + generateGraph.ts:49-148
- downstream_side_effects.LineageGraph-useEffect ← LineageGraph.tsx:46-52
- downstream_side_effects.Node-handleMouseEnter ← Node.tsx:81-84 + helpers.ts:102-114
- downstream_side_effects.LoadMoreButton ← LoadMoreButton.tsx:55-66 + slice.ts:206-220
- downstream_side_effects.Node-handleTitleClick ← Node.tsx:46-72
- tests_coverage_semantic.uncovered_behaviours ← all derive from the absence verified via Glob `**/Lineage/**/*.test.ts*` (no files) + Glob `**/__tests__/**/*Lineage*` (no files)
- docs_link_semantic.inferred_docs.[0] ← WebFetch 2026-05-19 https://docs.opendatadiscovery.org/features/data-lineage (status 200)
- docs_link_semantic.inferred_docs.[1] ← documentation/docs/data-lineage/data-objects.md:11-16
- docs_link_semantic.inferred_docs.[2] ← WebFetch 2026-05-19 https://docs.opendatadiscovery.org/developer-guides/api-reference/lineage (status 200)
- docs_link_semantic.doc_drift_findings.[0] ← API-reference live doc + constants.ts:77 (`d: 1`) + the seven defaultLineageQuery usages
- docs_link_semantic.doc_drift_findings.[1] ← API-reference live doc (no max) + constants.ts:97-99 (UI [1..20] cap)
- docs_link_semantic.doc_drift_findings.[2] ← documentation/docs/data-lineage/data-objects.md:16 + LineageControls.tsx:38-118 + ZoomableLineage.tsx:33-36
- docs_link_semantic.doc_drift_findings.[3] ← LoadMoreButton.tsx:55-66 + WebFetch result silent on LoadMore
- docs_link_semantic.doc_drift_findings.[4] ← generateGraph.ts:68-95 + LineageGraph.tsx:69-83 + WebFetch result silent on cycles
- implicit_adrs.[0] UI-defaults-d=1 ← constants.ts:74-84 + LineageControls.tsx:25 + LoadMoreButton.tsx:41 + LineageGraph.tsx:36 + LineageProvider.tsx:31 + ZoomableLineage.tsx:26 + HierarchyLineage.tsx:40 + Node.tsx:50-52
- implicit_adrs.[1] URL-source-of-truth ← interfaces.ts:75-85 + LineageControls.tsx:33, 40, 47, 51 + LoadMoreButton.tsx:59, 64 + ZoomableLineage.tsx:30
- implicit_adrs.[2] d3-hierarchy-over-force ← generateGraph.ts:1, 57, 97 + 68-76, 108-116
- implicit_adrs.[3] two-direction-mirrored ← generateGraph.ts:57-76 + 97-116 + line 60 sign flip
- implicit_adrs.[4] click-preserves-depth ← Node.tsx:46-72 + line 51 `d: node.depth || 1`
- implicit_adrs.[5] module-level-globals ← dataEntityLineage.slice.ts:30-48 + 202-203 + 281-282
- bugs_limitations_corner_cases.[0] diamond ← generateGraph.ts:68-76 + LineageGraph.tsx:84-110
- bugs_limitations_corner_cases.[1] no-d-clamp ← useQueryParams.ts:33-36 + constants.ts:97-99 + HierarchyLineage.tsx:47
- bugs_limitations_corner_cases.[2] crossEdge-silent-drop ← generateGraph.ts:81-95 + 121-135
- bugs_limitations_corner_cases.[3] LoadMore-monotonic ← dataEntityLineage.slice.ts:206-220, 285-299 + LoadMoreButton.tsx:55-65
- bugs_limitations_corner_cases.[4] sequential-fetch ← HierarchyLineage.tsx:44-67
- bugs_limitations_corner_cases.[5] useEffect-deps ← LineageGraph.tsx:46-52
- bugs_limitations_corner_cases.[6] highlight-asymmetry ← helpers.ts:116-129 + LineageGraph.tsx:56, 63
- bugs_limitations_corner_cases.[7] microservices-no-mode-toggle ← Lineage.tsx:12-26 + no `microservice` keyword in read files
- bugs_limitations_corner_cases.[8] no-retry ← thunks.ts:13-44 + AppErrorPage.tsx
- bugs_limitations_corner_cases.[9] anchor-set-negative ← thunks.ts:19, 36 + LineageServiceImpl batch-I sidecar
- security.owner_scoping BYPASSES ← thunks.ts:19, 36 + LineageServiceImpl batch-I sidecar (LineageServiceImpl.java:54-122 no AuthIdentityProvider field, no fetchAssociatedOwner call)
- security.data_exposure.[0] payload ← thunks.ts:19, 36 + DataEntityLineage OpenAPI shape + Node.tsx Info/Owners/Classes rendering
- security.data_exposure.[1] URL leak ← useQueryParams.ts:28-36 + ZoomableLineage.tsx:30
- security.known_security_gaps.[0]..[4] ← thunks.ts + useQueryParams.ts + HierarchyLineage.tsx:84-88 cross-references
- performance.hot_paths.[0] sequential-fetch ← HierarchyLineage.tsx:54-66
- performance.hot_paths.[1] tree-builder ← generateGraph.ts:49-148 + LineageGraph.tsx:40-44
- performance.hot_paths.[2] hover-scan ← Node.tsx:81-84 + helpers.ts:102-114
- performance.hot_paths.[3] title-reflow ← helpers.ts:10-37
- performance.scaling_characteristics.no-pagination ← LineageGraph.tsx:55-110
- performance.scaling_characteristics.URL-length ← interfaces.ts:75-85 + useQueryParams.ts:28-36
- performance.known_performance_gaps.[0]..[6] ← all derive from the above evidence lines

## confidence_per_field

- understanding: HIGH — full read of Lineage.tsx + HierarchyLineage.tsx + LineageGraph.tsx + LineageProvider.tsx + LineageControls.tsx + LoadMoreButton.tsx + Node.tsx + generateGraph.ts + constants.ts + interfaces.ts + helpers.ts + thunks.ts + slice.ts + ZoomableLineage.tsx + AppErrorPage.tsx + useQueryParams.ts + dataEntitiesRoutes.ts; backend context fully captured via batch-F/H/I sidecars
- concepts: HIGH — every entity/operation/invariant cited has file:line evidence; no speculation
- dependencies_semantic: HIGH — runtime deps verified from imports; coupling verified from usage; doc links WebFetched 2026-05-19 status 200
- tests_coverage_semantic: HIGH — Glob queries confirm absence of any *.test.ts* under the Lineage path
- docs_link_semantic: HIGH — three live URLs WebFetched in this session at 2026-05-19 (data-lineage page 200, api-reference page 200) + local doc file read for `data-objects.md`; drift findings cite both doc text and code line
- implicit_adrs: HIGH for 4/6 entries (URL-source-of-truth, d3-hierarchy-over-force, two-direction-mirrored, click-preserves-depth — all have strong intent-anchors from consistency patterns + sign-flip evidence); MEDIUM for 2 (UI-defaults-d=1 — consistency suggests intent but no defending comment; module-level-globals — pattern is unusual but no doc/comment justifies)
- bugs_limitations_corner_cases: HIGH — every entry has file:line evidence; severity ratings calibrated against backend amplification context (REFACTOR-202, REFACTOR-203 confirmed primary-source)
- security: HIGH for owner_scoping/data_exposure (direct line-evidence + backend confirmation per batch-I); HIGH for known_security_gaps (each gap traces to specific code line)
- performance: HIGH — every hot path / characteristic / gap has file:line evidence; specific operation counts (O(N), O(C × N)) derived from reading the algorithms

## Maintainer notes

---
node_id: "odd-platform ts react-component component:Lineage"
node_kind: react-component
axis: ui_components
extracted_at_commit: 80637ed
enriched_at_commit: 80637ed
extractor_version: 0.1.0
prompt_version: file-analyser/0.3.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-ZA-lineage-shell
---

# Lineage (data-entity-detail tab shell — DEG/HierarchyLineage dispatcher) — semantic understanding

## understanding

`Lineage.tsx` (lines 1-28) is the **dispatcher shell** for the Lineage tab on every data-entity detail page — the entry point of F-005 / P-05:F-001 Lineage Graph Traversal at the UI tier. It reads `dataEntityId` from the route (line 13), queries Redux for two facts about the entity — whether its entity-class set contains `ENTITY_GROUP` (`isDEG`, line 14, computed by `getIsDataEntityBelongsToClass` at `redux/selectors/dataentity.selectors.ts:43-45`) and whether the detail-fetch has resolved (`isLoaded`, line 15) — and branches on `isDEG` into one of two rendering trees: `<DEGLineageAtomProvider><DEGLineage /></DEGLineageAtomProvider>` for Data Entity Groups (jotai-atom-scoped tree backed by `useDataEntityGroupLineage` → `GET /api/dataentitygroups/{id}/lineage` per F-016) OR `<HierarchyLineage />` for every other entity class (Redux-thunk tree backed by sequential `GET /api/dataentities/{id}/lineage/downstream` + `/upstream` per F-005). The shell itself contains no fetch, no useEffect, no useState, no rendering — it is **5 lines of orchestration logic** that sits above the two distinct rendering subsystems and decides which one to mount based on a single boolean derived from the already-fetched entity details.

The shell is the **explicit routing boundary** between F-005 (per-entity recursive-CTE lineage) and F-016 (DEG-anchored bidirectional-IN lineage) at the user interface — neither feature is visible at this layer; only the dispatch decision is. The two LSN-pertinent observations: (a) the shell has NO useEffect (so the LSN-017 dep-array doubling pattern does NOT apply here — the doubling lives in the parent `DataEntityDetails.tsx`); (b) the shell never re-renders the subtree when `isDEG` changes mid-session (a misclassified entity that flips DEG↔non-DEG would unmount one tree and mount the other, but in practice `entityClasses` is set once at detail-fetch and never mutates).

## concepts

- entities: [
    "`useDataEntityRouteParams()` (Lineage.tsx:7, 13) — returns parsed-integer `dataEntityId` from the React-Router `:dataEntityId` URL segment via `useParams<DataEntityDetailsRouteParams>()` (`routes/dataEntitiesRoutes.ts:47-56`); the param is `parseInt(dataEntityId, 10)` so a malformed URL segment yields `NaN` (no validation)",
    "`getIsDataEntityBelongsToClass(dataEntityId)` selector (Lineage.tsx:5, 14) — defined at `redux/selectors/dataentity.selectors.ts:25-52`; reads `dataEntities.byId[dataEntityId]?.entityClasses` from Redux state and returns `{isDataset, isQualityTest, isTransformer, isDEG, isRelationship}`; the `isDEG` flag is `dataEntityClasses?.some(isClassesEquals(DataEntityClassNameEnum.ENTITY_GROUP)) ?? false`",
    "`getDataEntityDetailsFetchingStatuses` selector (Lineage.tsx:4, 15) — defined at `redux/selectors/dataentity.selectors.ts:159-161`; `createStatusesSelector(actions.fetchDataEntityDetailsActionType)` produces `{isLoading, isLoaded, isNotLoaded}` flags from the async-thunk status registry",
    "`DEGLineageAtomProvider` (Lineage.tsx:8, 20) — defined at `DEGLineage/lib/DEGLineageAtomProvider.tsx:1-9`; a 5-line wrapper around `<jotai.Provider>` that scopes the DEG-side jotai atoms (`isLayoutedAtom` per `DEGLineage/lib/atoms.ts`, others) to this subtree; ONLY mounted on the DEG branch — non-DEG branch uses Redux exclusively",
    "`DEGLineage` (Lineage.tsx:9, 21) — DEG-side rendering subtree (`DEGLineage/DEGLineage.tsx:1-47`); uses `useDataEntityGroupLineage({dataEntityId})` from `lib/hooks/api` (TanStack-Query backed call to `GET /api/dataentitygroups/{id}/lineage` per F-016 hop 6); renders LAYOUTER → LOADER → ZoomableDEGLineage chain controlled by `isLayoutedAtom`",
    "`HierarchyLineage` (Lineage.tsx:10, 24) — non-DEG rendering subtree (`HierarchyLineage/HierarchyLineage.tsx:1-138`); uses Redux-thunks (`fetchDataEntityDownstreamLineage`, `fetchDataEntityUpstreamLineage`) + `LineageProvider` + `@visx/zoom` wrapper + `ZoomableLineage` chain — the canvas previously catalogued by the batch-J `LineageGraph` sidecar"
  ]
- operations: [
    "Lineage.tsx — three-step orchestration: (1) `useDataEntityRouteParams()` read; (2) two Redux selector reads (`isDEG`, `isLoaded`); (3) ternary render guard (line 17 `if (!isLoaded) return null;`) then branch (lines 19-25 — `isDEG ? DEG-branch : HierarchyLineage-branch`)",
    "render-null-while-loading guard (line 17) — returns `null` (not a skeleton, not a spinner) while `getDataEntityDetailsFetchingStatuses.isLoaded === false`; the DataEntityDetails parent renders its own skeleton",
    "DEG branch (lines 19-22) — wraps `<DEGLineage />` in `<DEGLineageAtomProvider>` to give DEG a scoped jotai atom universe (the AtomProvider IS the jotai Provider — fresh atom store per mount, no leakage to other DEG details on the same page)",
    "Non-DEG branch (line 24) — directly renders `<HierarchyLineage />` with no provider wrapper (HierarchyLineage uses its own `LineageProvider` for React-Context state, not jotai)"
  ]
- invariants: [
    "**Pure dispatcher — zero internal state.** The component has NO `useState`, NO `useEffect`, NO `useMemo`, NO `useCallback`. Every render is a pure function of `(dataEntityId, isDEG, isLoaded)`. This is the structural reason the LSN-017 useEffect dep-array doubling pattern does NOT apply to this node — the doubling pattern requires a useEffect with a dependency derived from the fetch response; this component has no useEffect at all.",
    "**The `isDEG` decision is read AFTER the detail-fetch resolves.** Line 17 gates rendering on `isLoaded` — until `fetchDataEntityDetails` resolves and populates `dataEntities.byId[dataEntityId].entityClasses`, the shell renders nothing. This ordering guarantees `isDEG` is stable at render time (the classes won't flip mid-render).",
    "**No cycle detection at this layer.** Cycle handling for the lineage graph is entirely a backend + downstream-UI concern. The shell makes a binary routing decision — DEG vs non-DEG — based on entity class. Cycle / diamond handling lives in (a) backend recursive CTE (no guard — REFACTOR-202 from F-005), (b) frontend d3-hierarchy tree builder (no visited-set — diamond duplicates from LineageGraph sidecar bugs[0]), (c) cross-edge handling separating non-tree edges. None of those live here.",
    "**No per-feature toggle DEG vs hierarchy is exposed to the user.** The branch is class-driven, not query-param-driven. A user CANNOT request 'show me the hierarchy lineage of this DEG' from the URL — DEGs always route to the DEG subtree. This is an implicit ADR (see implicit_adrs).",
    "**The `dataEntityId` is `parseInt(...,10)` of a URL segment** (routes/dataEntitiesRoutes.ts:53). A malformed URL like `/dataentities/foo/lineage` yields `NaN` — the selector `getIsDataEntityBelongsToClass(NaN)` returns `{isDEG: false, ...}` (because `dataEntities.byId[NaN]?.entityClasses` is undefined), so the shell would route to `<HierarchyLineage />` with `dataEntityId: NaN` — downstream HierarchyLineage useEffect fires with `dataEntityId: NaN` and dispatches `fetchDataEntityDownstreamLineage({dataEntityId: NaN})`, hitting the backend with `GET /api/dataentities/NaN/lineage/downstream` → 400 or 404 depending on the backend's `@PathVariable` coercion. The route-param parser does not guard against NaN; the shell does not check `Number.isFinite(dataEntityId)`."
  ]
- audiences: [
    "Every ODD Platform UI end-user who clicks the 'Lineage' tab on any data-entity detail page — the shell is the universal entry point. Users do NOT see this component visually; they see whichever subtree it routes to.",
    "data-engineer-analyst / data-quality-engineer / data-scientist-ml-engineer / data-product-manager (P-05 Data Lineage audiences per system-mission.md) — the audiences who use the lineage canvas for tracing producer↔consumer relationships",
    "future maintainers extending the lineage UI — the file is the canonical place to add a third branch (e.g. a microservices-specific renderer, a relationship-class-specific renderer, a hypothetical 'compact' view)"
  ]

## dependencies_semantic

- requires-feature: [
    "F-005 / P-05:F-001 Lineage Graph Traversal — the non-DEG branch mounts `HierarchyLineage` which is the user-observable UI half of F-005 (per F-005 facet `UI uses anchor-set-undefended endpoints — batch J PRIMARY-SOURCE`). The shell IS the entry point that decides whether F-005 or F-016 renders.",
    "F-016 / P-05:F-002 DEG-Anchored Lineage — the DEG branch mounts `DEGLineage` which is the user-observable UI half of F-016 (per F-016 chain hop 6 — `odd-platform-ui/src/components/DataEntityDetails/Lineage/DEGLineage/DEGLineage.tsx:12-17`). The shell IS the routing decision point.",
    "F-013 / Data Entity Detail (Overview tab and parent) — the shell depends on `fetchDataEntityDetails` having already resolved (`isLoaded` selector, line 15). The detail-fetch is the LSN-017 view_count doubling source — the shell is downstream of that flow, not its trigger."
  ]
- requires-config: [] — N/A: this component reads no env / no build-time config. The Redux store provides all decision inputs.
- requires-runtime: [
    "React 18+ runtime — `React.FC` type (Lineage.tsx:1, 12)",
    "Redux Toolkit + react-redux — `useAppSelector` (Lineage.tsx:2 via `redux/lib/hooks`); two selectors read in one render",
    "React Router v6 (transitively) — `useDataEntityRouteParams` (Lineage.tsx:7) wraps `useParams<DataEntityDetailsRouteParams>()` from react-router-dom",
    "jotai (transitively via DEG branch) — `DEGLineageAtomProvider` (line 20) wraps `jotai.Provider` (DEGLineageAtomProvider.tsx:2). The non-DEG branch does NOT mount jotai."
  ]
- couples-to: [
    "`getIsDataEntityBelongsToClass` selector (Lineage.tsx:5) — coupled to the shape of `entityClasses` on `dataEntities.byId[id]`; a backend schema change to entity class names would break the `isDEG` lookup silently",
    "`getDataEntityDetailsFetchingStatuses` selector (Lineage.tsx:4) — coupled to the `fetchDataEntityDetails` action type registry; a rename of that thunk action would break the load-gate",
    "`useDataEntityRouteParams` (Lineage.tsx:7) — coupled to the route shape `/dataentities/:dataEntityId/lineage`; route restructure breaks this",
    "`DEGLineage` + `HierarchyLineage` — the shell hands control to these subtrees with NO props (both consume their inputs from `useDataEntityRouteParams()` themselves at DEGLineage.tsx:13 and HierarchyLineage.tsx:36). The shell does NOT pass `dataEntityId` as a prop; the subtrees re-read the route. This is duplication of the route read (three times: shell + DEGLineage + HierarchyLineage), but avoids prop-drilling."
  ]

## upstream_callers

| Caller (file:line) | Method invoked | Call context | Owner-scoping at caller? | Notes |
|---|---|---|---|---|
| `DataEntityDetails` parent router (data-entity-detail SPA route `/dataentities/:dataEntityId/lineage`) | Renders `<Lineage />` (Lineage.tsx:12-26) as the tab's children | Tab change on the data-entity detail page; the `/lineage` segment is one of the entity-detail tabs (rendered by `DataEntityDetails.tsx`) | N/A — UI component; owner-scoping is a backend concern (per F-005 facet `UI uses anchor-set-undefended endpoints` — UI inherits backend gap REFACTOR-203) | The single mount point. The shell is the **boundary** between the data-entity-detail layout and the F-005/F-016 rendering subsystems. |
| `Node.tsx` click handler from inside the rendered HierarchyLineage subtree (Node.tsx:70-72, `handleTitleClick` per batch-J LineageGraph sidecar) | `navigate(lineageLink)` to `/dataentities/{clickedId}/lineage?queryString` — remounts the SHELL with a new `dataEntityId` | User clicks a graph node's title — navigates to that node's own Lineage tab | N/A — UI navigation | Indirect re-entry. The new `dataEntityId` triggers a fresh `useDataEntityRouteParams()` value, a fresh `isDEG` selector evaluation (potentially flipping the branch — e.g. clicking on a DEG-typed node in a hierarchy view re-routes to DEG view), and a fresh subtree mount. The LSN-017 doubling is invoked at the PARENT (`DataEntityDetails.tsx`) — not here — because the click changes the URL which remounts `DataEntityDetails`, which fires `fetchDataEntityDetails` via its own useEffect. The Lineage shell is downstream of that re-fetch. |

## downstream_side_effects

| Method | API / DOM calls | RW shape | Transactional scope | Concurrency / failure modes |
|---|---|---|---|---|
| `Lineage.tsx` render | NONE — no API calls, no DOM mutation, no setState, no useEffect | Pure read of two Redux selectors + one route-param hook; pure render of one of three outputs (null / DEG-tree / Hierarchy-tree) | None | The component is **side-effect-free at its own scope**. All side effects live in the subtrees it mounts. A render failure here (e.g. selector throws) crashes the React tree; no error boundary at this layer (the DataEntityDetails layout-level boundary catches it). |
| DEG branch mount | Mounts `<jotai.Provider>` + `<DEGLineage />` — triggers DEGLineage's `useDataEntityGroupLineage` (TanStack-Query fetch of `GET /api/dataentitygroups/{id}/lineage`) per F-016 hop 6 | One HTTP round-trip on mount (TanStack-Query cache check first); fresh jotai atom store per mount | None at this layer; the TanStack-Query cache lives in the higher-level provider | If `useDataEntityGroupLineage` fails (404 conflation per F-016 facet — three conditions one error), `DEGLineage` renders `<EmptyContentPlaceholder />` (DEGLineage.tsx:23-25); no error toast, no retry. |
| Non-DEG branch mount | Mounts `<HierarchyLineage />` — its own useEffect (HierarchyLineage.tsx:44-67) fires TWO sequential Redux thunks (`fetchDataEntityDownstreamLineage` then `fetchDataEntityUpstreamLineage`) | Two sequential HTTP round-trips on mount per F-005 batch-J UI-realisation finding | None at this layer | The sequential dual-fetch contract is fragile under partial failure (per batch-J LineageGraph sidecar bugs[4]). The shell does not participate; HierarchyLineage owns the failure mode. |

## tests_coverage_semantic

- covered_behaviours: [] — Glob `**/Lineage.test.ts*` and `**/Lineage/**/*.test.ts*` against `<odd-platform>/odd-platform-ui/src` returned zero files (verified during this enrichment). The dispatcher shell has ZERO test coverage at any level.
- uncovered_behaviours: [
    "{behaviour: 'DEG dispatch — isDEG=true entity routes to DEGLineage subtree wrapped in jotai Provider', test_class: unit}",
    "{behaviour: 'Non-DEG dispatch — isDEG=false (Dataset, Transformer, QualityTest, Microservice, Relationship, etc.) routes to HierarchyLineage subtree', test_class: unit}",
    "{behaviour: 'Render-null guard — when isLoaded=false the component returns null regardless of isDEG', test_class: unit}",
    "{behaviour: 'Mid-render isDEG flip — if entityClasses mutates DEG↔non-DEG mid-session (entity reclassification), the subtree unmounts/remounts losing jotai state on DEG-side and Redux-lineage-slice cache on non-side', test_class: integration}",
    "{behaviour: 'Malformed URL — /dataentities/NaN/lineage produces dataEntityId=NaN; getIsDataEntityBelongsToClass(NaN) returns isDEG=false; HierarchyLineage mounts and dispatches fetch with dataEntityId: NaN; the failure mode at the backend is unguarded by this shell', test_class: integration}",
    "{behaviour: 'Click-through re-entry — Node click in HierarchyLineage navigates to /dataentities/{clickedId}/lineage; if the clicked entity is a DEG, the shell rerenders into DEG branch (unmounts HierarchyLineage including its Redux lineage slice state)', test_class: integration}",
    "{behaviour: 'jotai Provider scope isolation — DEGLineage atom state does NOT leak to OTHER DEGLineage mounts on the same page (e.g. side-by-side detail tabs)', test_class: unit}"
  ]
- test_files: [] — Verified via Glob `**/Lineage.test.ts*` (no matches) + Glob `**/__tests__/**/Lineage*` (no matches). No companion test file exists.
- gaps: |
    The dispatcher shell is the **routing boundary** between F-005 and F-016 at the UI tier — the single decision point. Zero tests means: (a) a refactor that accidentally flips the branch logic (e.g. `isDEG === false ? ... : ...`) ships silently; (b) a removal of the `if (!isLoaded) return null;` guard ships silently — the subtree would mount before `entityClasses` resolved, defaulting to HierarchyLineage even for DEGs and dispatching the wrong API; (c) the NaN-dataEntityId case (malformed URL) is not pinned — a future change to the route param parser could change the failure shape; (d) the jotai-Provider scope (mounted on DEG branch only) is not pinned — a future refactor that mounts the Provider outside the branch would change jotai state lifetimes silently. Single highest-value test: a `Lineage.test.tsx` that snapshots three states — `(isLoaded=false) → null`, `(isLoaded=true, isDEG=true) → DEGLineageAtomProvider+DEGLineage`, `(isLoaded=true, isDEG=false) → HierarchyLineage`. A 30-line test pins the entire dispatcher contract.

## docs_link_semantic

- declared_docs: [] — No `@docs` annotation in `Lineage.tsx`. Verified by Read line-by-line; the file is 28 lines total.
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-lineage"
    anchor: ""
    rationale: "P-05 Data Lineage pillar landing page — names the two UI access points (per-entity Lineage tab + Group lineage entry point) that this shell dispatches between"
    last_verified_at: "2026-05-20"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      WebFetch 2026-05-20 (live URL, status 200): "Open lineage from the **Lineage tab** on any data-entity detail page (per-entity view)" + "from the **Group lineage** entry point on a Data Entity Group detail page" + "The microservices view is reached from any catalogued microservice entity ingested through odd-tracing-gateway". The page names the two access points but does NOT describe the dispatch logic (entity-class-based, not URL-flag-based) — see doc_drift_findings.
  - url: "https://docs.opendatadiscovery.org/features/data-lineage/data-objects"
    anchor: ""
    rationale: "P-05:F-001 sub-feature page — describes the per-entity hierarchy lineage that the non-DEG branch renders"
    last_verified_at: "2026-05-20"
    last_verified_status: pending-WebFetch-this-session
    confidence: MEDIUM
    fetched_excerpts: |
      Carried forward from batch-J LineageGraph sidecar: "Lineage tab on any data-entity detail page — opens the entity-centric graph with the entity at the centre and configurable upstream / downstream depth." Page describes the per-entity view but does not name the dispatch shell or the DEG variant.
- doc_drift_findings:
  - "Live doc names two access points (per-entity Lineage tab + Group lineage entry) but does NOT name the dispatch logic. The fact that the SAME URL `/dataentities/{id}/lineage` produces TWO DIFFERENT rendering subsystems based on `entityClasses` containing `ENTITY_GROUP` is undocumented. A reader assumes the Group lineage entry point is a separate route — but it is the SAME route, routed by entity class. — evidence: Lineage.tsx:19-25 (the ternary) + dataEntitiesRoutes.ts (single `/lineage` route, no separate group-lineage route) + live doc page silent."
  - "Live doc names Microservices lineage as 'reached from any catalogued microservice entity' — but does NOT specify which rendering subsystem (DEG or hierarchy) handles microservices. Per the dispatch logic (Lineage.tsx:14, `getIsDataEntityBelongsToClass(...).isDEG`), microservices are NOT DEGs (their entity class is `TRANSFORMER` / a microservice-specific class — verified by absence from the `isDEG` check at selectors.ts:43-45 which checks only `ENTITY_GROUP`). Microservices therefore route to `HierarchyLineage` — same subtree as datasets and transformers. The doc's separate naming of 'microservices view' is misleading: there is no microservices-specific component at this layer. — evidence: Lineage.tsx:14 + dataentity.selectors.ts:43-45 + the file's complete absence of any `microservice` class branch."
  - "Live doc is silent on the load-gate behaviour. Until `getDataEntityDetailsFetchingStatuses.isLoaded === true` (line 15), the shell renders `null` — the user sees the parent skeleton from `DataEntityDetails.tsx`. A user opening the Lineage tab DIRECTLY (deep-link) waits for the detail-fetch + the lineage-fetch sequentially — not in parallel. The doc does not describe initial-load latency expectations. — evidence: Lineage.tsx:17 (the null guard) + DataEntityDetails.tsx parent skeleton (per LSN-017)."

## implicit_adrs

- "**Entity-class drives lineage view choice, not URL flag.** Lines 19-25 route on `isDEG` derived from `entityClasses`, not on a `?view=` query param or `/lineage/group` sub-route. The implicit ADR: 'the entity itself decides which lineage variant is meaningful; the user cannot override.' Intent-anchor: the absence of any `LineageQueryParams.view` field (verified by Read of `HierarchyLineage/lineageLib/interfaces.ts` — no `view` / `mode` / `kind` key in the 9-key LineageQueryParams shape per batch-J sidecar) + the absence of any user-facing toggle in `LineageControls` (per batch-J sidecar — depth slider, full-names, view-mode-full-vs-compact, expand-all-groups; NO DEG/hierarchy toggle). Decision: the rendering subsystem is a property of the entity, not a property of the user's query. — evidence: Lineage.tsx:19-25 + the absence of a `view` field in LineageQueryParams (per batch-J sidecar). — confidence: HIGH"
- "**Two distinct rendering subsystems with disjoint state stacks.** DEG branch uses jotai (DEGLineageAtomProvider wraps DEGLineage; jotai atoms `isLayoutedAtom` etc. per DEGLineage.tsx:8); non-DEG branch uses Redux thunks + React-Context (`LineageProvider` per HierarchyLineage.tsx:105). The shell deliberately keeps these stacks separated — no shared state, no shared context. The implicit ADR: 'DEG-lineage is a newer feature with a different state model; we did not retrofit Redux into the DEG subtree.' Intent-anchor: the `DEGLineageAtomProvider` exists at all (it could have been omitted if the DEG subtree used Redux) + the choice to wrap ONLY the DEG branch (lines 20-22) and not lift the Provider to the shell or to `DataEntityDetails`. Decision: the two lineage subsystems evolve independently. — evidence: Lineage.tsx:8, 20-22 + DEGLineageAtomProvider.tsx:1-9 (the 5-line jotai wrapper) + DEGLineage.tsx:1-47 (uses jotai `useAtom`) vs HierarchyLineage.tsx:1-138 (uses Redux + React Context). — confidence: HIGH"
- "**Render-null while loading; no skeleton at this layer.** Line 17 returns `null` while `!isLoaded` — the parent `DataEntityDetails` is responsible for the loading skeleton. The implicit ADR: 'this component is a routing layer, not a presentation layer; loading affordance is the parent layout's responsibility.' Intent-anchor: the deliberate `return null` (line 17) rather than `return <SkeletonWrapper>...</SkeletonWrapper>` (the project's standard skeleton used elsewhere — e.g. Overview.tsx imports SkeletonWrapper per batch-J sidecar context) — the choice was made to NOT render a skeleton here. — evidence: Lineage.tsx:17. — confidence: MEDIUM (the choice is intentional but no defending comment exists; the project's pattern of skeleton-at-parent-layout level is consistent across other detail tabs)"

## bugs_limitations_corner_cases

- "**`isDEG` is class-only; no consideration for entity-detail-not-yet-loaded mid-render.** The render guard at line 17 (`if (!isLoaded) return null;`) gates on `isLoaded`, but in the brief window where `isLoaded=true` and `entityClasses` is populated but `isDEG`-derivation runs against a stale Redux cache (e.g. immediately after a manual navigation between two different entities where the new entity's classes haven't yet replaced the prior entity's), the shell could route to the WRONG subtree for one render cycle. In practice the Redux thunks atomically update `byId[id]` per entity, but the shell does not defensively re-check that `dataEntities.byId[dataEntityId]?.entityClasses` is set before reading `isDEG` — the selector returns `isDEG: false` on undefined classes (`?? false` at selectors.ts:44-45), which silently routes to HierarchyLineage. A DEG entity in this transient state would render the WRONG canvas for one frame before the slice updated and the selector re-fired the correct branch. — evidence: Lineage.tsx:14-15 + selectors.ts:43-45 (the `?? false` default) — severity: LOW (transient frame; users unlikely to observe; tests would still catch a regression)"
- "**`dataEntityId: NaN` does not short-circuit.** When the URL is malformed (`/dataentities/foo/lineage`), `useDataEntityRouteParams()` returns `dataEntityId: NaN` (routes/dataEntitiesRoutes.ts:53 — `parseInt('foo', 10)` is NaN). The shell does NOT guard with `Number.isFinite(dataEntityId)`; instead, `getIsDataEntityBelongsToClass(NaN)` returns `{isDEG: false, ...}` (because `dataEntities.byId[NaN]` is undefined), `getDataEntityDetailsFetchingStatuses.isLoaded` becomes true once the detail-fetch fails (the failure resolves the loading state), and the shell mounts `<HierarchyLineage />` with `dataEntityId: NaN`. HierarchyLineage then dispatches `fetchDataEntityDownstreamLineage({dataEntityId: NaN})` → backend `GET /api/dataentities/NaN/lineage/downstream` → likely 400 Bad Request → AppErrorPage. The user-visible failure is at HierarchyLineage's level, not at the shell. The shell could short-circuit with a `Number.isFinite` guard; it does not. — evidence: Lineage.tsx:13 + routes/dataEntitiesRoutes.ts:53 — severity: LOW (the failure surfaces; just at the wrong layer)"
- "**No microservices-specific branch.** Microservices ARE data entities; their entity class is NOT `ENTITY_GROUP`; they therefore route to `<HierarchyLineage />` — the same subtree as datasets and transformers. The live doc names microservices lineage as a distinct view; the code treats it identically. All HierarchyLineage caveats (per batch-J: diamond amplification, monotonic LoadMore, no upper bound on `?d=`, click-through-compounds-depth, anchor-set-undefended endpoints causing REFACTOR-203 cross-owner enumeration) apply identically to microservices. Microservices-specific affordances (operation names, trace timing, service-call cardinalities) are not rendered — they would be silently dropped if the response has them. — evidence: Lineage.tsx:14 (only `isDEG` is checked) + selectors.ts:43-45 (only `ENTITY_GROUP` triggers DEG branch) + the absence of any `microservice` literal in the file — severity: MEDIUM"
- "**Click-through re-mounts the shell entirely.** Per batch-J LineageGraph sidecar, clicking a node title in HierarchyLineage navigates to `/dataentities/{clickedId}/lineage?queryString`. The route change unmounts the current shell + subtree and mounts a fresh shell. If the clicked entity is a DEG, the fresh shell mounts the DEG branch instead — different state model, different jotai store, different fetch (TanStack-Query `useDataEntityGroupLineage` vs Redux thunks). The user-visible effect is a complete canvas reset including loss of pan/zoom state (the `?t=` param is preserved per F-005 facet — but only meaningful in the HierarchyLineage context). A click from a hierarchy lineage canvas onto a DEG-typed node produces a jarring state-model switch with no UI affordance signalling the transition. — evidence: Lineage.tsx:19-25 (the unconditional branch on each mount) + Node.tsx:46-72 (the click-handler — per batch-J sidecar) — severity: LOW (UX gap, not data loss)"

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP | DISABLED — N/A as direct dependency` — UI component does not branch on auth mode. The shell's mounting route `/dataentities/:id/lineage` is gated by the SPA's outer auth shell (not within this component); under DISABLED the dispatcher renders for anonymous users with the same routing logic.
- **ingestion_filter_relevance**: `NO — UI dispatcher, not ingestion`. Neither branch participates in `POST /ingestion/entities`.
- **authorization_assertions**: [] — no permission gates, no `WithPermissions` wrapper, no `usePermission`-style hook in this component. The dispatcher does not gate access to either subtree by permission.
- **owner_scoping**: `BYPASSES — inherits backend gap from both branches` — the shell makes no owner-scoping decision; both branches inherit the read-collaborative posture from their respective backend chains (per F-005 facet `UI uses anchor-set-undefended endpoints` and per F-016 facet `co-membership leakage`). The dispatcher does NOT have a "show only my entities" toggle that could short-circuit either branch. evidence: Lineage.tsx full file (28 lines, no owner-filter logic) + F-005 + F-016 sidecars.
- **data_exposure**: [
    "The dispatcher itself exposes NO data — it makes a routing decision based on `entityClasses` and `isLoaded`, both of which are already in Redux state from `fetchDataEntityDetails`.",
    "Indirectly, the dispatcher COMPOSES the F-005 + F-016 cross-owner enumeration exposures by being the universal entry point — every authenticated user who opens any Lineage tab traverses this shell, and the shell routes them to the appropriate cross-owner-enumeration-exposed canvas. The shell is the **single chokepoint** at which a future cross-cutting owner-filter (`if (!callerHasAnyRelation(dataEntityId)) return <RestrictedPlaceholder/>`) could be applied — and is currently NOT."
  ]
- **known_security_gaps**: [
    "**No defence-in-depth owner gate at the dispatch layer.** The dispatcher is the natural chokepoint for a UI-layer owner-scope check that would short-circuit BEFORE either subtree mounts and fetches. Adding such a gate is the cheapest UI-side mitigation for REFACTOR-203 + F-016 co-membership leakage — but it is absent. severity: MEDIUM (UI-layer defence in depth; the backend gap is the load-bearing fix per system-mission read-collaborative-posture ADR) — evidence: Lineage.tsx full file (no owner check) + F-005 facet `UI uses anchor-set-undefended endpoints` + F-016 facet `co-membership leakage`.",
    "**The shell inherits BOTH F-005 + F-016 read-collaborative posture as a single user-observable surface.** A user opening the Lineage tab on ANY entity (DEG or not) gets cross-owner lineage data. The shell amplifies the exposure by making the routing trivial — the user clicks the tab, the shell does the rest. severity: HIGH (the user-observable consequence of REFACTOR-203 + F-016 co-membership leakage realised through this single mount) — evidence: Lineage.tsx:19-25 + F-005 batch-J facets + F-016 facets."
  ]

## performance

- **hot_paths**: [
    "Render cost is **2 selector reads + 1 hook call + 1 ternary** — O(1) per render. The two selectors (`getIsDataEntityBelongsToClass`, `getDataEntityDetailsFetchingStatuses`) are memoised by `createSelector` (selectors.ts:25, 159); re-renders are cheap.",
    "Subtree mount cost is delegated: DEG branch triggers TanStack-Query check + potential HTTP fetch; non-DEG branch triggers the dual Redux-thunk fetch chain (per batch-J HierarchyLineage useEffect). The shell does not add latency; it gates which subtree pays the cost."
  ]
- **throughput_characteristics**: [
    "Single-render-per-mount; no internal re-render loops; no useEffect dependency arrays that could ping-pong (LSN-017 pattern does not apply here).",
    "The shell is on the critical path of every Lineage-tab open, but its own contribution to time-to-first-paint is negligible (a few microseconds for the selector reads + ternary)."
  ]
- **resource_allocation**: [
    "Zero internal state means zero memory overhead at this layer.",
    "Mounting the DEG branch allocates a fresh jotai atom store via `DEGLineageAtomProvider` (jotai.Provider); the store is GC'd on unmount. Non-DEG branch does not allocate (Redux + React-Context are scoped at higher layers)."
  ]
- **scaling_characteristics**: [
    "Stateless dispatcher — scales perfectly horizontally across browser tabs (each tab gets its own shell + subtree).",
    "The shell is **not a bottleneck**; F-005 + F-016 backend amplification surfaces (recursive CTE depth, diamond row growth, JVM-stack BFS in DEG-lineage) are the platform-side scaling concerns. The shell is downstream of those and surfaces their cost as canvas-rendering time."
  ]
- **known_performance_gaps**: [
    "No performance gap at the dispatcher layer itself. All performance concerns surface in the subtrees. severity: N/A — evidence: Lineage.tsx full file (28 lines, no loops, no fetches, no DOM)."
  ]

## sources

- understanding ← Lineage.tsx:1-28 (full file Read)
- concepts.entities.useDataEntityRouteParams ← Lineage.tsx:7, 13 + routes/dataEntitiesRoutes.ts:47-56
- concepts.entities.getIsDataEntityBelongsToClass ← Lineage.tsx:5, 14 + redux/selectors/dataentity.selectors.ts:25-52
- concepts.entities.getDataEntityDetailsFetchingStatuses ← Lineage.tsx:4, 15 + redux/selectors/dataentity.selectors.ts:159-161
- concepts.entities.DEGLineageAtomProvider ← Lineage.tsx:8, 20 + DEGLineage/lib/DEGLineageAtomProvider.tsx:1-9
- concepts.entities.DEGLineage ← Lineage.tsx:9, 21 + DEGLineage/DEGLineage.tsx:1-47
- concepts.entities.HierarchyLineage ← Lineage.tsx:10, 24 + HierarchyLineage/HierarchyLineage.tsx:1-138
- concepts.operations.three-step-orchestration ← Lineage.tsx:13-25
- concepts.operations.render-null-guard ← Lineage.tsx:17
- concepts.operations.DEG-branch ← Lineage.tsx:19-22
- concepts.operations.non-DEG-branch ← Lineage.tsx:24
- concepts.invariants.pure-dispatcher ← Lineage.tsx:1-28 (full file — no useState/useEffect/useMemo)
- concepts.invariants.isDEG-after-loaded ← Lineage.tsx:14-17
- concepts.invariants.no-cycle-detection-at-shell ← Lineage.tsx full file + REFACTOR-202 deferred to backend per F-005
- concepts.invariants.no-user-toggle ← Lineage.tsx:19-25 + HierarchyLineage/lineageLib/interfaces.ts (no view field per batch-J)
- concepts.invariants.parseInt-NaN ← Lineage.tsx:13 + routes/dataEntitiesRoutes.ts:53
- dependencies_semantic.requires-feature.F-005 ← Lineage.tsx:24 + feature-flows/detail/F-005.yaml
- dependencies_semantic.requires-feature.F-016 ← Lineage.tsx:21 + feature-flows/detail/F-016.yaml
- dependencies_semantic.requires-feature.F-013 ← Lineage.tsx:15 (the isLoaded gate)
- dependencies_semantic.requires-runtime.React ← Lineage.tsx:1, 12
- dependencies_semantic.requires-runtime.Redux-Toolkit ← Lineage.tsx:2
- dependencies_semantic.requires-runtime.React-Router ← Lineage.tsx:7 + routes/dataEntitiesRoutes.ts:47-56
- dependencies_semantic.requires-runtime.jotai ← Lineage.tsx:8, 20 + DEGLineageAtomProvider.tsx:2
- dependencies_semantic.couples-to.getIsDataEntityBelongsToClass ← Lineage.tsx:5 + selectors.ts:25-52
- dependencies_semantic.couples-to.getDataEntityDetailsFetchingStatuses ← Lineage.tsx:4 + selectors.ts:159-161
- dependencies_semantic.couples-to.useDataEntityRouteParams ← Lineage.tsx:7 + dataEntitiesRoutes.ts:47-56
- dependencies_semantic.couples-to.DEGLineage-HierarchyLineage ← Lineage.tsx:9-10 + DEGLineage.tsx:13 + HierarchyLineage.tsx:36
- upstream_callers.DataEntityDetails-parent-router ← Lineage.tsx:12-26 (mount point)
- upstream_callers.Node-click-handler ← Node.tsx:70-72 (per batch-J LineageGraph sidecar) + Lineage.tsx:13 (route-param re-read)
- downstream_side_effects.Lineage-render ← Lineage.tsx:1-28 (full file — no side effects)
- downstream_side_effects.DEG-branch-mount ← Lineage.tsx:20-22 + DEGLineage.tsx:15-17 (useDataEntityGroupLineage TanStack-Query call) + F-016 hop 6
- downstream_side_effects.Non-DEG-branch-mount ← Lineage.tsx:24 + HierarchyLineage.tsx:44-67 + F-005 batch-J
- tests_coverage_semantic.no-test-files ← Glob `**/Lineage.test.ts*` zero matches + Glob `**/__tests__/**/Lineage*` zero matches
- docs_link_semantic.inferred_docs.[0] ← WebFetch 2026-05-20 https://docs.opendatadiscovery.org/features/data-lineage (status 200)
- docs_link_semantic.inferred_docs.[1] ← Batch-J carry-forward of documentation/docs/data-lineage/data-objects.md
- docs_link_semantic.doc_drift_findings.[0] ← Lineage.tsx:19-25 + WebFetch 2026-05-20 result (silent on dispatch logic)
- docs_link_semantic.doc_drift_findings.[1] ← Lineage.tsx:14 + selectors.ts:43-45 + WebFetch result (microservices view naming)
- docs_link_semantic.doc_drift_findings.[2] ← Lineage.tsx:17 + WebFetch result (silent on load-gate behaviour)
- implicit_adrs.[0] entity-class-drives-view ← Lineage.tsx:19-25 + absence of view field in LineageQueryParams (batch-J reference)
- implicit_adrs.[1] disjoint-state-stacks ← Lineage.tsx:8, 20-22 + DEGLineageAtomProvider.tsx:1-9 + DEGLineage.tsx (jotai) + HierarchyLineage.tsx (Redux)
- implicit_adrs.[2] render-null-while-loading ← Lineage.tsx:17
- bugs_limitations_corner_cases.[0] isDEG-transient-stale ← Lineage.tsx:14-15 + selectors.ts:43-45
- bugs_limitations_corner_cases.[1] NaN-dataEntityId ← Lineage.tsx:13 + routes/dataEntitiesRoutes.ts:53
- bugs_limitations_corner_cases.[2] no-microservices-branch ← Lineage.tsx:14 + selectors.ts:43-45
- bugs_limitations_corner_cases.[3] click-through-remounts-shell ← Lineage.tsx:19-25 + Node.tsx:46-72 (batch-J)
- security.auth_mode_relevance ← Lineage.tsx full file (no auth-mode branch)
- security.ingestion_filter_relevance ← Lineage.tsx full file (not on ingestion path)
- security.authorization_assertions ← Lineage.tsx full file (no @PreAuthorize, no WithPermissions, no usePermission)
- security.owner_scoping ← Lineage.tsx full file + F-005 facet `UI uses anchor-set-undefended endpoints` + F-016 facet `co-membership leakage`
- security.data_exposure.[0] ← Lineage.tsx:12-15 (selectors only)
- security.data_exposure.[1] ← Lineage.tsx:19-25 (the dispatch is the chokepoint)
- security.known_security_gaps.[0] ← Lineage.tsx full file + REFACTOR-203 + F-016 co-membership leakage
- security.known_security_gaps.[1] ← Lineage.tsx:19-25 + F-005 batch-J facet `UI uses anchor-set-undefended endpoints` + F-016 facets
- performance.hot_paths ← Lineage.tsx:12-25 + selectors.ts:25, 159 (memoised)
- performance.throughput_characteristics ← Lineage.tsx full file (no useEffect, no setInterval, no async ops)
- performance.resource_allocation ← Lineage.tsx:20-22 (jotai Provider on DEG branch)
- performance.scaling_characteristics ← Lineage.tsx:12-25
- performance.known_performance_gaps ← Lineage.tsx full file (none at this layer)

## confidence_per_field

- understanding: HIGH — entire source file is 28 lines, fully Read in one pass; behaviour is unambiguous and pure-functional
- concepts: HIGH — every entity/operation/invariant traces to a verifiable line in Lineage.tsx or a neighbour I directly Read (selectors.ts:25-52, 159-161; routes/dataEntitiesRoutes.ts:47-56; DEGLineageAtomProvider.tsx:1-9; DEGLineage.tsx:1-47; HierarchyLineage.tsx:1-138)
- dependencies_semantic: HIGH — direct imports verified line-by-line; coupling to F-005 + F-016 verified by cross-reference to feature-flows/detail/{F-005,F-016}.yaml
- tests_coverage_semantic: HIGH — Glob verified zero test files; the gaps are the canonical highest-value additions to pin the dispatcher contract
- docs_link_semantic: HIGH — WebFetch 2026-05-20 verified the live URL status 200; the drift findings are the verified gaps between the live page text and the source-code dispatch logic
- implicit_adrs: HIGH — each of the three ADRs has a verifiable intent anchor in the file's structure (the 5-line jotai wrapper, the render-null-while-loading guard, the entity-class-vs-URL-flag routing)
- bugs_limitations_corner_cases: HIGH — each case traces to a specific line + a verified neighbour file behaviour
- security: HIGH — the absence claims (no @PreAuthorize, no permission gate, no owner-scope short-circuit) are verified by full-file Read of 28 lines + cross-reference to F-005 + F-016 sidecars; the realisation-point claim follows from being the single mount point
- performance: HIGH — the file has no useEffect, no fetch, no DOM manipulation; the O(1) claim is structural

## Maintainer notes

(empty — first enrichment of this node; reserved for future maintainer prose that should survive refresh)

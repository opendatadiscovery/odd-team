---
node_id: "odd-platform ts routes route:terms"
node_kind: route
axis: ui_routes
extracted_at_commit: 80637ed
enriched_at_commit: 80637ed
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-26-ZH-terms-route
pillar_anchored_features:
  - P-06 Data Glossary
  - P-06:F-001 Term-to-Entity Linkage
related_sidecars:
  - odd-platform__java__TermController__controller-class__TermController
  - odd-platform__java__service__service__TermServiceImpl
  - odd-platform__java__repository__reactive__repository__ReactiveTermSearchEntrypointRepositoryImpl
  - odd-platform__ts__react-component__component__TermDetails
  - odd-platform__ts__react-component__component__TermSearch
  - odd-platform__ts__routes__route__alerts
---

# termsRoutes — semantic understanding

## understanding

`termsRoutes.ts` (63 lines) is the URL-shape contract for the **entire Data Glossary feature (pillar P-06)** in the platform UI. It declares two module-private base paths — `BASE_PATH = '/terms'` (line 4) and `TERMS_SEARCH_PATH = '/termsearch'` (line 5) — and exposes three URL builders (`termsPath`, `termsSearchPath`, `termDetailsPath`), one frozen sub-route literal map (`TermDetailsRoutes` with 5 members at lines 25-31), one route-params interface, and one hook (`useTermsRouteParams`). **Category B finding — the module name suggests a single "/terms" surface, but the operator never sees `/terms` as a renderable page.** The Dictionary tab in `ToolbarTabs.tsx:67` is wired to `termsSearchPath()` (i.e. `/termsearch`, the search page — `TermSearch.tsx`); search results link to `termDetailsPath(id)` (i.e. `/terms/:termId/overview` via the React-Router child route at `App.tsx:67`). The bare `/terms` URL has NO `element` on its mount declaration (`App.tsx:66`: `<Route path={termsPath()}>` is a parent with one child `:termId/*` and NO default child / index route) — typing `/terms` in the browser renders a BLANK page (no element matches, no redirect, no error fallback at this layer). The live Business Glossary doc (WebFetched 2026-05-26, status 200) states "The Dictionary tab is the catalog-wide list of all terms in the platform" — the docs imply a LIST surface; the code surfaces a SEARCH+FACETS UI at `/termsearch`. The route module also exposes `useTermsRouteParams` which coerces the URL string `termId` to `number` via `parseInt(termId, 10)` — non-numeric `termId` segments propagate as `NaN` through the rest of the UI without any guard at this layer (downstream is `TermDetails.tsx:38` `fetchTermDetails({termId: NaN})` → 400/404 from the backend). **Category D finding — the `/terms` mount has NO route-level permission gate** (no `WithPermissionsProvider`), unlike the sibling `/lookup-tables` mount four lines later (App.tsx:75-88 wraps `LookupTables` with `LOOKUP_TABLE_CREATE/UPDATE/DELETE`); all term-mutation gating is delegated to the inner `TermDetails.tsx` (permissions check at lines 59-70: `[TERM_UPDATE, TERM_DELETE]` wrap the header) plus `TermDetailsRoutes.tsx:33-44` (`[QUERY_EXAMPLE_TERM_CREATE, QUERY_EXAMPLE_TERM_DELETE]` wrap the query-examples sub-route only). This is **architecturally consistent** with the backend's `TermController` posture — controller-tier-only RBAC, no service-tier permissions per the TermController + TermServiceImpl sidecars — but the UI shell is even shallower: any authenticated user who navigates to `/terms/:id/overview` is allowed past the route boundary; the permission framework decides only what UI buttons render.

## concepts

- entities: [
    "`Term` (OpenAPI-generated DTO from `generated-sources`, line 2) — referenced only via `Term['id']` (= `number`) at lines 36, 50 for type-narrowing the `termId` argument.",
    "`TERMS_SEARCH_ID` (the literal `'termSearchId'`, line 7) + `TERM_ID` (the literal `'termId'`, line 9) — string keys used both as URL-path-param names (lines 8, 10 with `:` prefix) and as object-property names in `TermsRouteParams` / `AppTermsRouteParams` (lines 45-46, 50-51). The double-use keeps URL pattern names and route-params interface keys in lock-step at compile time.",
    "`TermDetailsRoutes` (lines 25-31) — a frozen object literal with FIVE sub-route fragments: `OVERVIEW: 'overview'`, `LINKED_ENTITIES: 'linked-entities'`, `LINKED_COLUMNS: 'linked-columns'`, `LINKED_TERMS: 'linked-terms'`, `QUERY_EXAMPLES: 'query-examples'`. The `as const` widens the values to literal-string types so `TermDetailsRoutesType` (line 33) is the constrained union the `termDetailsPath` signature accepts.",
    "`TermsRouteParams` (lines 44-47) — the URL-layer (`react-router-dom`) shape; `termId` and `termSearchId` are BOTH `string` here because that is what `useParams<T>()` returns.",
    "`AppTermsRouteParams` (lines 49-52) — the application-layer shape; `termId` is **typed as `Term['id']` = `number`** but `termSearchId` remains `string`. The hook converts between the two."
  ]
- operations: [
    "`termsSearchPath(searchId?)` (lines 12-19) — builds `/termsearch` (no arg) or `/termsearch/:termSearchId` (with arg). Used by ToolbarTabs.tsx:67 (Dictionary tab → bare path), ToolbarTabs.tsx:115 (post-create redirect), TermDetails.tsx:50 (post-delete redirect), App.tsx:63 (route mount with /* wildcard).",
    "`termsPath()` (lines 21-23) — returns the bare `'/terms'` string. **ONLY ONE consumer in the entire codebase**: App.tsx:66 (`<Route path={termsPath()}>` mount). No component, hook, thunk, or route call NAVIGATES to bare `/terms`. The function exists purely to keep the mount-point string identical to the path-prefix `termDetailsPath` builds — preserving the BASE_PATH single-source-of-truth invariant.",
    "`termDetailsPath(termId, path = 'overview')` (lines 35-42) — builds `/terms/:termId/:path` with the path defaulting to `'overview'`. Used by 11 sites including TermSearchResultItem.tsx:19 (search-result click), TermsForm.tsx:110 (post-create redirect), QueryExampleDetailsLinkedTermsItem.tsx:16 (navigate from query-example detail), useTermWiki.ts:193 (term-wiki @-mention link rewrite), and all 5 tab links in TermDetailsTabs.tsx:18-40.",
    "`useTermsRouteParams()` (lines 54-63) — React Router-bound hook; calls `useParams<keyof TermsRouteParams>()` (line 55), casts to `TermsRouteParams` (line 57), then **coerces `termId` from string to `number` via `parseInt(termId, 10)` (line 60)**. `termSearchId` is passed through as-is.",
    "Compile-time type-narrowing — `TermDetailsRoutesType = (typeof TermDetailsRoutes)[keyof typeof TermDetailsRoutes]` (line 33) restricts the second arg of `termDetailsPath` to one of the five literal strings. The default arg value `'overview'` (line 37) is **a plain string literal**, not `TermDetailsRoutes.OVERVIEW` — a minor inconsistency that survives because both are the same literal type."
  ]
- invariants: [
    "**`/terms` and `/termsearch` are TWO separate base paths**, both private to this module — there is no shared `glossary` parent and no UI-level redirect from one to the other. The Dictionary navigation lands on `/termsearch` (via `termsSearchPath()` at ToolbarTabs.tsx:67). The deep-link to a specific term is `/terms/:termId/{tab}` (via `termDetailsPath`). The two surfaces are connected only via the post-delete redirect at TermDetails.tsx:50 (`/terms/:id` → `/termsearch/:searchId`).",
    "**No element on the `/terms` route mount.** App.tsx:66 declares `<Route path={termsPath()}>` as a layout/wrapper route with one child `<Route path=':termId/*' element={<TermDetails />} />` (line 67). Without `index` route or `element` prop on the parent, visiting bare `/terms` matches the parent route but has no element to render → React Router renders nothing (the parent's Outlet has no matched child). Compare `App.tsx:63` (`<Route path={\`${termsSearchPath()}/*\`} element={<TermSearch />} />` — a single self-rendering route).",
    "**The `termId` coercion in `useTermsRouteParams` swallows `NaN`.** Line 60: `parseInt(termId, 10)`. If the URL path is `/terms/abc/overview`, `termId` from `useParams()` is `'abc'`, `parseInt('abc', 10)` returns `NaN`. Downstream consumers (`TermDetails.tsx:25` then `dispatch(fetchTermDetails({termId: NaN}))` at line 38) get `NaN` and emit a backend request with `termId=NaN`. The hook itself has no guard, no `isNaN` check, no fallback. The backend (`TermController.getTermDetails` per the TermController sidecar) responds 404; the UI surfaces the AppErrorPage at TermDetails.tsx:80-83.",
    "**`TermDetailsRoutes` object IS the single source of truth for the 5 sub-routes** — but `TermDetailsRoutes.tsx` (the renderer) re-hardcodes each string literally: `'overview'`, `'linked-entities'`, `'linked-columns'`, `'linked-terms'`, `'query-examples'` at lines 29, 30, 31, 32, 34. Renaming any literal in `TermDetailsRoutes` here would break the link generation but leave the renderer matching the OLD literal — the same shape as the LSN-noted `AlertsRoutes` inconsistency (alerts sidecar `bugs_limitations_corner_cases.[1]`).",
    "**`generatePath` is imported from `react-router-dom`** (line 1) and used at lines 14 and 39 to substitute the `:termSearchId` and `:termId` params. Unlike `alertsRoutes.ts` (which imports nothing from react-router-dom because it never substitutes params), this module DOES couple to react-router-dom at the routes-layer.",
    "**`useTermsRouteParams` is a typed wrapper around `useParams`** — the `<keyof TermsRouteParams>` generic at line 56 ensures the destructure on line 55 type-checks, and the `as TermsRouteParams` assertion on line 57 erases the `Partial<...> | undefined` shape that React Router's `useParams` natively returns. **No undefined-guard**: if a consumer calls this hook OUTSIDE a `/terms/:termId/*` route, `useParams()` returns `{}`, the destructure produces `{ termId: undefined, termSearchId: undefined }`, `parseInt(undefined, 10)` returns `NaN`, and `termSearchId` is `undefined`. Currently all consumers (`TermDetails.tsx:25`, `TermSearch.tsx:26`, `TermDetailsRoutes.tsx:20`, `TermDetailsTabs.tsx:11`) ARE inside the right route subtree."
  ]
- audiences: [
    "odd-platform-ui-end-user — anyone who navigates from the global Dictionary tab (→ /termsearch), clicks a search result (→ /terms/:id/overview), or follows a term @-mention from a description (TermDefinition.tsx via useTermWiki.ts:193).",
    "data-engineer-analyst — the primary P-06 Glossary audience: reads + (with TERM_UPDATE) edits terms.",
    "data-steward-owner — Owner entities attached to Terms; deep-links from notification/email refs to a specific term's detail page.",
    "data-scientist-ml-engineer — read-only consumer of glossary descriptions and linked-entities."
  ]

## dependencies_semantic

- requires-feature: [
    "P-06 Data Glossary — this URL contract is the **entire UI's** addressing system for the glossary feature; without it the feature has no in-app navigation. The `TermDetailsRoutes` 5-tab taxonomy IS the P-06 feature surface (Overview / Linked entities / Linked columns / Linked terms / Query examples).",
    "P-06:F-001 Term-to-Entity Linkage — `termDetailsPath(termId, 'linked-entities')` is the URL contract for the operator landing on the linked-entities tab; the navigation flow that drives F-001's read surface is anchored on this builder.",
    "Cross-feature dependency on Query Examples (P-08:F-001 if anchored that way) — `termDetailsPath(termId, 'query-examples')` exposes the term-to-query-example linkage UI."
  ]
- requires-config: [] — N/A. The route module reads no `@Value` / no env var / no feature flag; the URL shape is static at build time.
- requires-runtime: [
    "react-router-dom — `generatePath` (line 1, used at lines 14 and 39 to substitute path params); `useParams` (line 1, used at line 55). The TypeScript types `keyof TermsRouteParams` (line 56) lean on react-router-dom's generic.",
    "OpenAPI-generated `Term` DTO from `generated-sources` (line 2) — type-only import, used as `Term['id']` at lines 36 and 50."
  ]
- additional_coupling:
  - "exposed via `routes/index.ts:8` (`export * from './termsRoutes'`) — consumers import from `'routes'`. Refactoring the file path is safe; renaming exports breaks 17 consumers (per Grep: `termsRoutes|termsPath|termDetailsPath|termsSearchPath|useTermsRouteParams|TermDetailsRoutes` → 25 files)."
  - "**Tightly coupled to `App.tsx:66` mount structure.** The single consumer of `termsPath()` is the route mount itself; changing `termsPath()` to return a different string requires updating App.tsx:66 in lock-step (they reference the same function so this IS lock-step, but the relationship is invisible — neither party explicitly documents it)."
  - "**Tightly coupled to `TermDetails.tsx`** for the actual rendering at `/terms/:termId/*` — the `:termId` segment is parsed by `useTermsRouteParams` and consumed by `TermDetails.tsx:25`, which then drives the whole TermDetails subtree."

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "`termsSearchPath()` returns `/termsearch` with no arg; `termsSearchPath('id-123')` returns `/termsearch/id-123`"
    test_class: unit
    criticality: LOW
  - behaviour: "`termDetailsPath(42)` returns `/terms/42/overview` (default path); `termDetailsPath(42, 'linked-entities')` returns `/terms/42/linked-entities`"
    test_class: unit
    criticality: LOW
  - behaviour: "`useTermsRouteParams` returns `{ termId: NaN, termSearchId: undefined }` when invoked outside a matching route (regression guard for the undefined-params shape)"
    test_class: unit
    criticality: MEDIUM
    note: "The current consumers are all inside the right route subtree, but a future refactor could relocate one of them; an `isNaN` regression in `termId` would surface only when an operator hits an unmounted page."
  - behaviour: "Visiting bare `/terms` in the browser renders a deterministic page (currently: blank). A test that asserts the bare path either redirects or renders an explicit empty-state would catch a regression."
    test_class: integration
    criticality: MEDIUM
    note: "End-to-end via Playwright — render the SPA, navigate to `/terms`, assert visible content. Currently it's blank with no indication to the operator. Pinned by P-164."
- test_files: []
- gaps: |
    No unit OR integration tests target `termsRoutes.ts` or `App.tsx`'s route
    mount. Three regression shapes are uncovered:
    (1) Renaming `BASE_PATH` (e.g. `/term` for `/terms`) would silently break
        every `termDetailsPath()` and the App.tsx:66 mount in lock-step — same
        class as alerts sidecar test gap, directory-wide.
    (2) The `parseInt(termId, 10) → NaN` coercion on a non-numeric URL path
        segment goes unguarded; a test that asserts `useTermsRouteParams`
        returns a usable value for `/terms/abc/overview` would catch the
        regression where `NaN` propagates into the redux thunk.
    (3) The bare `/terms` rendering hole — App.tsx:66's parent route has no
        `element` and no `index` route, so the page is blank. No test exists
        to assert what SHOULD render here (404? redirect to /termsearch?
        empty list?). The integration class is the right home for this assertion.
    Lowest-cost-highest-leverage gap: the `NaN` propagation test (unit class) —
    it pins the contract the rest of the codebase silently relies on.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-glossary"
    anchor: ""
    rationale: "The Data Glossary pillar page is the canonical user-facing doc for the P-06 feature this route module surfaces. The page explicitly names the 'Dictionary tab' as the entry surface and references the seven `TERM_*` permissions."
    last_verified_at: "2026-05-26T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      H1: "Data Glossary"
      Subsections H2 → "Business Glossary — full reference for terms as
        catalog entities: the Dictionary tab UI, namespace-scoped terms,
        ownership and the seven `TERM_*` RBAC permissions, term-to-term
        linking (description-text mentions vs direct links), term-to-data-entity
        descriptive associations (the Wikipedia-About-style walkthrough),
        and the API surface."
      Navigation note: "Open it from the top-level navigation **Dictionary**
        tab (the in-app surface for browsing and curating terms)."
  - url: "https://docs.opendatadiscovery.org/features/data-glossary/business-glossary"
    anchor: "#the-dictionary-tab"
    rationale: "The Business Glossary deep-dive describes the Dictionary tab behaviour — the section the user lands on when they click the Dictionary tab is exactly what `termsSearchPath()` resolves to."
    last_verified_at: "2026-05-26T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      H2 list: "What terms are", "The Dictionary tab", "Namespace-scoped terms",
        "Ownership and privileges", "Term-to-term linking",
        "Term-to-entity associations", "API surface", "Where to next".
      "The Dictionary tab" first sentence: "The Dictionary tab is the
        catalog-wide list of all terms in the platform."
      Browse note: "From here you can: Browse terms across every namespace.
        Create a new term (gated by TERM_CREATE)."
      Permissions named: TERM_CREATE, TERM_UPDATE, TERM_DELETE,
        TERM_OWNERSHIP_CREATE, TERM_OWNERSHIP_UPDATE, TERM_OWNERSHIP_DELETE,
        TERM_TAGS_UPDATE.
      No URL pattern (/terms, /termsearch) cited.
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions"
    anchor: ""
    rationale: "Live source of truth for what each TERM_* permission grants — used to verify the UI's permission-gating semantics (TERM_UPDATE, TERM_DELETE on TermDetails.tsx:60)."
    last_verified_at: "2026-05-26T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      TERM_CREATE: "Allows creating a new term in the business glossary."
      TERM_UPDATE: "Allows editing the name, namespace, and definition of a term."
      TERM_DELETE: "Allows deleting a term from the business glossary."
      No explicit statement that TERM_* permissions guard term-to-term linkage.
- doc_drift_findings:
  - "**Live doc says 'list', code shows 'search'.** The Business Glossary page (https://docs.opendatadiscovery.org/features/data-glossary/business-glossary, WebFetched 2026-05-26, status 200) describes 'The Dictionary tab is the catalog-wide list of all terms in the platform' and 'Browse terms across every namespace'. The Dictionary tab in code is wired to `termsSearchPath()` (ToolbarTabs.tsx:67) which lands the user on `/termsearch` — `TermSearch.tsx`, a search-with-facets UI (TermSearchFilters left sidebar + TermSearchResults right), NOT a flat browseable list. The user clicking 'Dictionary' sees an empty search-results table until they type a query or apply a facet. **The doc's mental model (list) and the code's behaviour (search) diverge** — surface as a doc-coherence finding for the doc-gap-finder pass."
  - "**Live doc does not name URL paths.** The doc page intentionally does not cite the `/terms` or `/termsearch` URL patterns — URL paths are an internal UI concern that operators navigate via clicks, not by typing URLs. This is NOT a drift; it is consistent with the alerts sidecar's analogous note."
  - "**Live doc does not cover term-to-term linkage RBAC.** The Permissions doc (https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions, WebFetched 2026-05-26, status 200) lists 7 TERM_* permissions but does NOT state which permission guards `/api/terms/{term_id}/term` POST/DELETE. The TermController sidecar's batch-U finding documents the actual backend posture (no SecurityRule on term-to-term linkage endpoints — any authenticated user can link/unlink). The route module here exposes the URL `linked-terms` sub-route with NO permission gate at this layer either; the UI consistency with the backend is read-collaborative without explicit doc acknowledgement."

## implicit_adrs

- "**Two-base-path topology for the Glossary feature** — `/terms` for deep-link to a specific term, `/termsearch` for the browse/search surface, with no shared `/glossary` parent." — evidence: termsRoutes.ts:4-5 (`BASE_PATH = '/terms'` AND `TERMS_SEARCH_PATH = '/termsearch'`) — intent_anchor: "Two declared constants at lines 4-5, named distinctly (`BASE_PATH` vs `TERMS_SEARCH_PATH`), used by two distinct route builders (`termsPath`, `termsSearchPath`) and two separate App.tsx routes (line 63 standalone `/termsearch/*` self-rendering, line 66 `/terms` parent with child `:termId/*`). The decision was made deliberately — a flat shared parent like `/glossary/{search,list,:id}` would be the obvious alternative but is NOT what the code does." — confidence: HIGH

- "**`termsPath()` exists ONLY to keep the App.tsx route mount and the `termDetailsPath` prefix in lock-step.** It is not a navigation target." — evidence: termsRoutes.ts:21-23 + grep `termsPath\(` returns only 2 hits (the declaration + the App.tsx:66 mount) — intent_anchor: "The function body is `return BASE_PATH;` with no parameters. The function exists only to expose the constant. The only consumer is the route mount. The choice to expose a parameterless function (vs `export const BASE_PATH = '/terms'`) is to keep the function-call signature consistent with `termsSearchPath()` and `termDetailsPath(...)` — the routes module's convention is 'every URL is a function call'." — confidence: HIGH

- "**Sub-tabs taxonomy is fixed at 5 members** — Overview, Linked entities, Linked columns, Linked terms, Query examples. Adding a new tab is a deliberate, three-file change (this module + `TermDetailsRoutes.tsx` + `TermDetailsTabs.tsx`)." — evidence: termsRoutes.ts:25-31 (`as const` object literal) + components/Terms/TermDetails/TermDetailsRoutes/TermDetailsRoutes.tsx:29-46 (5 `<Route>` declarations + a fallback Navigate) + components/Terms/TermDetails/TermDetailsTabs/TermDetailsTabs.tsx:14-44 (5 `AppTabItem` entries) — intent_anchor: "`TermDetailsRoutes as const` (line 31) widens to literal-string types, and `TermDetailsRoutesType = (typeof TermDetailsRoutes)[keyof typeof TermDetailsRoutes]` (line 33) is the union the `termDetailsPath` signature accepts. The compile-time gate is intentional — a caller passing a sixth string would not type-check." — confidence: HIGH

- "**Route module owns no auth gating; all gating is consumer-side.** The bare `/terms/:termId/*` mount has no `WithPermissionsProvider` wrapper, unlike `/lookup-tables` four lines below in the same App.tsx." — evidence: App.tsx:66-68 (no permissions wrap) vs App.tsx:75-88 (`WithPermissionsProvider allowedPermissions={[LOOKUP_TABLE_CREATE, LOOKUP_TABLE_UPDATE, LOOKUP_TABLE_DELETE]}`) — intent_anchor: "The pattern is consistently applied across the routes module — alerts sidecar `implicit_adrs.[2]` records the same observation for the alerts feature. The intent is read-collaborative posture: any authenticated user can navigate into a term's detail page; mutation buttons are gated piecemeal by the inner components (`TermDetails.tsx:59-70` for header Edit/Delete; `TermDetailsRoutes.tsx:33-44` for query-examples). The intent is consistent across the codebase, not specific to terms." — confidence: HIGH

- "**`useTermsRouteParams` is a typed wrapper that erases React Router's `Partial<>` semantics.** The hook asserts `as TermsRouteParams` (line 57) and then `parseInt(termId, 10)` (line 60) without any `isNaN` guard, signalling that consumers are EXPECTED to call this only inside the matching route subtree." — evidence: termsRoutes.ts:54-63 — intent_anchor: "The `as TermsRouteParams` assertion at line 57 + the lack of undefined-handling in the return shape is a deliberate decision that the hook will only be invoked where React Router has matched a path containing both `:termId` and (transitively) the term-search-id context. The mistake-trade-off is accepted: a future consumer placing this hook outside the matching subtree gets `NaN` for `termId` and `undefined` for `termSearchId` — diagnosable at runtime, not at type-check time." — confidence: MEDIUM

## bugs_limitations_corner_cases

- "**Visiting bare `/terms` renders a blank page.** App.tsx:66 declares `<Route path={termsPath()}>` as a parent with one child route (`:termId/*`) and NO `index` route, NO `element` prop on the parent itself, NO `Navigate` fallback. React Router matches the parent but has nothing to render — the operator sees an empty page beneath the toolbar with no error message and no redirect. Compare App.tsx:63 (`/termsearch/*` self-renders TermSearch). The Dictionary tab in ToolbarTabs.tsx:67 navigates to `/termsearch`, NOT `/terms`, so the user never reaches `/terms` via normal navigation — but typing it in the address bar, sharing a stale link, or any code path that calls `termsPath()` and navigates produces the dead-end. Live doc (Business Glossary, WebFetched 2026-05-26) implies a list view exists at the Dictionary tab; if a maintainer/operator deduces 'maybe it's at /terms' from `termsPath` they get a blank page. **Pinned by P-164**." — evidence: App.tsx:66-68 (no element, no index) + termsRoutes.ts:21-23 (`termsPath` returns bare `/terms`) — severity: MEDIUM

- "**`useTermsRouteParams` returns `termId: NaN` when the URL has a non-numeric segment.** Line 60: `parseInt(termId, 10)`. URL `/terms/foo/overview` → `termId = 'foo'` → `parseInt('foo', 10) = NaN`. The hook does NOT check `isNaN` and returns `NaN` typed as `Term['id']` (= `number`) — a type-system lie. Downstream `TermDetails.tsx:38` dispatches `fetchTermDetails({termId: NaN})` which serialises to `termId=NaN` in the URL; backend (`TermController.getTermDetails`, per the controller sidecar) returns 404 because path-bind from `NaN` to a `Long` parameter fails (or matches no row). The UI then shows the AppErrorPage (TermDetails.tsx:80-83) — a slightly less helpful failure than 'invalid term id'." — evidence: termsRoutes.ts:60 (`parseInt(termId, 10)` with no guard) + TermDetails.tsx:25 (consumer) + TermDetails.tsx:38 (`fetchTermDetails({termId})`) — severity: LOW

- "**Sub-route literal `'overview'` is hard-coded as the default arg in `termDetailsPath` rather than referenced via `TermDetailsRoutes.OVERVIEW`.** Line 37: `path: TermDetailsRoutesType = 'overview'`. The literal `'overview'` appears 3 times in this file (line 26, line 37, and implicitly in TermDetailsRoutes.tsx:29 + line 46's Navigate target). Renaming the OVERVIEW tab key in `TermDetailsRoutes` would NOT propagate to the default-arg value; the maintainer must remember to update both. Same shape as the alerts sidecar's `bugs_limitations_corner_cases.[1]`." — evidence: termsRoutes.ts:26 (`OVERVIEW: 'overview'`) + termsRoutes.ts:37 (default arg `'overview'`) + components/Terms/TermDetails/TermDetailsRoutes/TermDetailsRoutes.tsx:29 (Route path='overview') + TermDetailsRoutes.tsx:46 (Navigate to='overview') — severity: LOW

- "**Candidate substrate-extractor gap — the `TermDetailsRoutes` `as const` object literal at lines 25-31 declares 5 sub-routes that NODE_METADATA may not enumerate.** This is the same shape as the alerts sidecar's `bugs_limitations_corner_cases.[0]` observation (the alerts NODE_METADATA reported `sub_routes: {}` and `inline_paths: []` despite the source declaring three sub-paths). I do not have direct access to this node's NODE_METADATA, so this is a candidate-for-verification rather than a confirmed gap — the verifier compares this sidecar's enumerated sub-routes (overview, linked-entities, linked-columns, linked-terms, query-examples) against `lineage/odd-platform/substrate/extracted/...` and either confirms the gap (substrate-extractor follow-up) or removes this entry." — evidence: termsRoutes.ts:25-31 + alerts sidecar `bugs_limitations_corner_cases.[0]` cross-reference — severity: MEDIUM (becomes HIGH if confirmed across many route files)

- "**No unit OR integration tests target this module or its consumers.** Same directory-wide gap as alerts. A typo in `BASE_PATH` (e.g. `/term`) or `TERMS_SEARCH_PATH` (e.g. `/term-search`) silently breaks every glossary link without a failing test. The build emits a passing artifact; the failure surfaces only when an operator clicks the Dictionary tab or a search-result row." — evidence: `find <odd-platform-repo>/odd-platform-ui/src -name '*.test.*' -o -name '*.spec.*' | xargs grep termsPath` returned no matches at commit 80637ed — severity: LOW

- "**`useTermsRouteParams` is reused outside the `/terms/:termId/*` subtree** — TermSearch.tsx:26 calls it from the `/termsearch/*` subtree. In that subtree React Router does NOT bind `:termId` (the route is `/termsearch/:termSearchId`), so `useParams()` returns `{ termSearchId: ... }` without `termId`. The destructure at termsRoutes.ts:55 produces `termId = undefined`, `parseInt(undefined, 10) = NaN`, and TermSearch.tsx ignores the `termId` field anyway (uses only `termSearchId`). The hook 'works' by accident — its return shape is dishonest in this caller's context. A future consumer of TermSearch.tsx that mistakenly reads `termId` would silently get `NaN`." — evidence: termsRoutes.ts:54-63 (no per-route shape variant) + TermSearch.tsx:26 (calls hook from `/termsearch` subtree) — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables: []   # No numeric literals beyond `10` (the parseInt radix at line 60, which is not a tunable) and the default `'overview'` path arg.
  name_behavior_pairs:
    - name: "termsPath()"
      promise: "Returns the URL for the Terms feature — implied to be a navigable surface (e.g. a terms list or terms landing page)."
      implementation: "Returns the bare string `/terms`. The ONLY consumer is App.tsx:66, which mounts it as a parent route with NO element and NO index route — the URL renders a blank page. The Dictionary tab in ToolbarTabs.tsx:67 navigates to `termsSearchPath()` (i.e. `/termsearch`), NOT `termsPath()`. No code path navigates to `/terms` directly."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "An operator who types `/terms` in the address bar, or who clicks a stale shared link of `/terms`, sees a blank page beneath the toolbar with no message and no redirect. The live doc says 'the Dictionary tab is the catalog-wide list of all terms' implying a list surface exists; the operator cannot find that surface at `/terms`."
      confidence: STATIC-INFERRED
      evidence: "termsRoutes.ts:21-23 (function body) + App.tsx:66-68 (mount has no element / no index route) + ToolbarTabs.tsx:67 (Dictionary tab uses termsSearchPath, not termsPath)"
    - name: "termsSearchPath()"
      promise: "Returns the URL for searching terms (implied: a search surface)."
      implementation: "Returns `/termsearch` (no arg) or `/termsearch/:termSearchId` (with arg). Mounted at App.tsx:63 as `<Route path={termsSearchPath()/*} element={<TermSearch />} />` — self-rendering. The TermSearch component IS the canonical landing for the Dictionary tab (ToolbarTabs.tsx:67) — so the operator's first impression of the glossary feature is a search UI with facets + an empty result set."
      drift: MINOR
      operator_visible_consequence: "Doc says 'list' (catalog-wide list of all terms) — code shows 'search with facets, empty until you type a query'. The operator who clicks Dictionary expecting a list sees an empty results pane until they apply a query/facet."
      confidence: STATIC-INFERRED
      evidence: "termsRoutes.ts:12-19 + App.tsx:63 + ToolbarTabs.tsx:67 + components/Terms/TermSearch/TermSearch.tsx:70-86 (the search UI structure)"
    - name: "termDetailsPath(termId, path = 'overview')"
      promise: "Builds the URL for a specific term's detail page, with an optional sub-tab."
      implementation: "Returns `/terms/:termId/:path` with path default `'overview'`. Matches App.tsx:67 `<Route path=':termId/*' element={<TermDetails />} />` nested inside the `/terms` parent. The 5 valid sub-tabs are compile-time-narrowed via `TermDetailsRoutesType`."
      drift: NONE
      operator_visible_consequence: "N/A — promise matches implementation."
      confidence: STATIC-INFERRED
      evidence: "termsRoutes.ts:35-42 + App.tsx:66-68 + TermDetailsRoutes.tsx:29-46"
    - name: "useTermsRouteParams()"
      promise: "Returns the matched route params for the Terms feature, typed appropriately."
      implementation: "Coerces `termId` from string to `number` via `parseInt(termId, 10)`. Returns `{ termId: NaN, termSearchId: undefined }` when called outside a matching route. No `isNaN` guard. Used by both `/terms/:termId/*` consumers AND `/termsearch/:termSearchId` consumers — the latter case returns `termId: NaN` but the consumer ignores it."
      drift: MINOR
      operator_visible_consequence: "If a future consumer reads `termId` from outside the `/terms/:termId/*` subtree (e.g. inside `/termsearch/*` or another route), they get `NaN`. Currently no observable bug; future-fragile."
      confidence: STATIC-INFERRED
      evidence: "termsRoutes.ts:54-63 + TermSearch.tsx:26 (calls from /termsearch subtree, ignores termId)"
  orderings: []   # No SQL, no .sort(), no LIMIT — pure URL-shape module.
  auth_gates:
    - location: "App.tsx:66-68"
      endpoint: "Route mount: /terms parent + /terms/:termId/* child (the only ones)"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "N/A at this layer — the route module is client-side TypeScript. The four `auth.type` modes determine whether the SPA bundle is reachable (DISABLED: unauthenticated reach; LOGIN_FORM/OAUTH2/LDAP: redirect to identity provider before the SPA boots). Once the SPA is loaded, all four modes treat the `/terms/:termId/*` mount identically: any authenticated user can navigate to it. Backend `TermController` endpoints called by the inner `TermDetails` component apply per-endpoint SecurityRules (per TermController sidecar)."
          confidence: STATIC-INFERRED
          evidence: "App.tsx:66-68 (no auth predicates) + TermController.java per sibling sidecar (controller-tier RBAC)"
        - q: "What does an unauthenticated caller see?"
          a: "Under `auth.type=DISABLED`, the unauthenticated caller reaches the SPA and navigates to `/terms/:termId/overview` freely; the TermController is also unauthenticated in DISABLED mode (no gate). Under LOGIN_FORM/OAUTH2/LDAP, the SPA bundle is gated behind the identity provider; the operator is redirected before the route module is evaluated."
          confidence: STATIC-INFERRED
          evidence: "App.tsx:66-68 + system-mission.md P-09 auth-mode summary (DISABLED is dev-only per docs)"
        - q: "What does a wrong-role caller see?"
          a: "Authenticated user without `TERM_UPDATE` / `TERM_DELETE` lands on `/terms/:termId/overview` successfully (read-collaborative); the `TermDetailsHeader` Edit/Delete buttons are HIDDEN by `WithPermissionsProvider` at TermDetails.tsx:59-70. Authenticated user without `QUERY_EXAMPLE_TERM_CREATE/DELETE` lands on `/terms/:termId/query-examples` and sees the page render unconditionally — but mutation affordances are hidden by `WithPermissionsProvider` at TermDetailsRoutes.tsx:33-44. The 4 other sub-tabs (overview, linked-entities, linked-columns, linked-terms) are completely ungated at the UI layer; backend read-collaborative permits."
          confidence: STATIC-INFERRED
          evidence: "App.tsx:66-68 (no route-level gate) + TermDetails.tsx:59-70 (header gate) + TermDetailsRoutes.tsx:33-44 (query-examples sub-route gate) + TermController sidecar (backend read-collaborative posture)"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "At the UI level: the route module itself has NO gate (termsRoutes.ts has zero auth predicates). The mount at App.tsx:66-68 has NO `WithPermissionsProvider`. The gate is delegated to the inner `TermDetails` component (TermDetails.tsx:59-70 for header Edit/Delete buttons) and `TermDetailsRoutes` (TermDetailsRoutes.tsx:33-44 for the query-examples sub-route). At the backend: TermController has SecurityRules in `SecurityConstants.java` lines 174-193 for 9 of the 14 mutating endpoints (TermController sidecar). **The term-to-term linkage endpoints have NO SecurityRule** (TermController sidecar finding: any authenticated user can link/unlink terms) — this means the `linked-terms` sub-route exposes a UI surface for a mutation operation that backend-wise has no RBAC gate."
          confidence: STATIC-INFERRED
          evidence: "termsRoutes.ts:1-63 (no auth predicates) + App.tsx:66-68 (no route-level gate) + TermDetails.tsx:59-70 + TermDetailsRoutes.tsx:33-44 + TermController.java sibling sidecar"
  resource_boundaries: []   # No @Transactional, no synchronized, no cache, no idempotency concerns — pure URL-shape module evaluated at render time.
  request_inputs:
    - location: "termsRoutes.ts:36"
      input_kind: path-param
      input_name: "termId"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The id of a specific term in the business glossary; what the operator/URL is operating on."
          confidence: STATIC-INFERRED
          evidence: "termsRoutes.ts:36 (parameter signature `termId: Term['id']`)"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Substituted into the URL pattern via `generatePath` (line 39) — `/terms/:termId/:path` becomes e.g. `/terms/42/overview`. Downstream: `useTermsRouteParams` (line 54-63) re-extracts the URL segment and parses it to a number; `TermDetails.tsx:25` consumes the number; the thunk `fetchTermDetails({termId})` calls `termApi.getTermDetails({termId})` which hits `GET /api/terms/{term_id}` — per TermController sidecar, this resolves to a SELECT on `TERM.ID` with `DELETED_AT IS NULL` filter."
          confidence: STATIC-INFERRED
          evidence: "termsRoutes.ts:36, 39-41 (builds URL) + termsRoutes.ts:54-63 (re-extracts) + TermDetails.tsx:25, 38 + TermController.java per sibling sidecar"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — `termId` builds a URL containing that id, and downstream the same id is used to fetch THE term with that id. No translation, no entity shift."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "termsRoutes.ts:36, 39-41 + TermController sidecar (`getTermDetails` reads by `term_id` path-param)"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — no silent translation."
          confidence: STATIC-INFERRED
          evidence: "N/A"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "termsRoutes.ts:36-42"
      routes_to_finding: "N/A — no drift."
    - location: "termsRoutes.ts:12"
      input_kind: path-param
      input_name: "searchId"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The id of a term-search session (a server-side session-state handle issued by `termSearch` controller endpoint)."
          confidence: STATIC-INFERRED
          evidence: "termsRoutes.ts:12 (parameter signature) + TermController sidecar (`termSearch` returns `TermSearchFacetsData` with `searchId` UUID)"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Substituted into the URL pattern via `generatePath` (line 14) — `/termsearch/:termSearchId` becomes e.g. `/termsearch/uuid-abc-123`. Downstream: `useTermsRouteParams` re-extracts as `termSearchId: string` (line 61), `TermSearch.tsx:26` consumes it, `getTermsSearch({searchId})` thunk at line 47 calls `termApi.getTermsSearch({searchId})` → `GET /api/terms/search/{search_id}` per TermController sidecar."
          confidence: STATIC-INFERRED
          evidence: "termsRoutes.ts:12-19 + termsRoutes.ts:54-63 + TermSearch.tsx:26, 47"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — `searchId` (parameter name) is the search-session UUID, and the URL segment becomes the path-param consumed by backend `searchId` binding."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "termsRoutes.ts:12-15 + TermController sidecar"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — no silent translation."
          confidence: STATIC-INFERRED
          evidence: "N/A"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "termsRoutes.ts:12-19"
      routes_to_finding: "N/A — no drift."
    - location: "termsRoutes.ts:37"
      input_kind: query-param
      input_name: "path"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "<generic — no specific entity promised>. The name 'path' refers to a sub-tab fragment, but is too generic to imply a specific domain entity; the TermDetailsRoutesType union (line 33) constrains it to 5 literal values."
          confidence: STATIC-INFERRED
          evidence: "termsRoutes.ts:37 (default arg `'overview'`)"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Substituted into the URL pattern via `generatePath` (line 39) as a path-literal segment, NOT a substituted param (no `:path` substitution). Downstream React Router matches the resulting URL `/terms/:termId/overview` against `<Route path='overview' element={<Overview />} />` (TermDetailsRoutes.tsx:29) and the matching sub-page mounts."
          confidence: STATIC-INFERRED
          evidence: "termsRoutes.ts:37, 39 + TermDetailsRoutes.tsx:29-46"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — `path` is a sub-tab fragment that selects one of 5 sub-pages; the type system constrains the legal values."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "termsRoutes.ts:33, 37 + TermDetailsRoutes.tsx:29-46"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — no silent translation."
          confidence: STATIC-INFERRED
          evidence: "N/A"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "termsRoutes.ts:37"
      routes_to_finding: "N/A — no drift."
  probes_emitted:
    - probe_id: P-164
      question: "Visiting bare `/terms` in the running SPA — what does the user see? Blank, redirect, error, or empty-list page?"
      probe_path: "lineage/odd-platform/probes/P-164.yaml"
  stress_summary:
    triggers_total: 8
    questions_total: 24
    answers_static_inferred: 23
    answers_probe_needed: 1
    answers_reference: 0
    drift_flags: 2
```

## security

- **auth_mode_relevance**: `INTERNAL_ONLY` — UI declarative URL-shape module. This file exports plain TypeScript string literals and three URL-builder functions consumed by React Router on the client side; it carries no auth predicates, no fetch calls, and no role/permission checks. The four `auth.type` modes (DISABLED / LOGIN_FORM / OAUTH2 / LDAP) determine whether the SPA bundle is reachable; once loaded, all modes treat the route module identically. Auth mode does not branch the behaviour of this module under any of the four `auth.type` values. — evidence: termsRoutes.ts:1-63 (no auth-related imports or branches).
- **ingestion_filter_relevance**: `N/A — UI route declaration, not on the ingestion HTTP surface`. The `auth.ingestion.filter.enabled` flag (default `false` per the live security doc, last verified via the alerts sidecar at 2026-05-08) only gates `POST /ingestion/entities` server-side; it has no relationship to UI routes.
- **authorization_assertions**: []
- **owner_scoping**: `N/A — code is not data-scoped`. The route module exposes all URL shapes unconditionally — no Owner-based hide/show gates. Owner-scoping at the term level is the BACKEND's job (read-collaborative posture per TermController sidecar: every authenticated user can see every term in every namespace).
- **data_exposure**:
  - "The literal strings `/terms` and `/termsearch` plus the 5 sub-route literals (`overview`, `linked-entities`, `linked-columns`, `linked-terms`, `query-examples`) are emitted into the rendered JS bundle for every authenticated session and discoverable to anyone who can fetch the SPA bundle. These are non-secret URL shapes — disclosure is not a confidentiality concern; the GitHub repo is public. Recorded for completeness."
- **known_security_gaps**:
  - "Inherits the backend's term-to-term linkage RBAC gap (TermController sidecar `bugs_limitations_corner_cases`). The `linked-terms` sub-route at `/terms/:termId/linked-terms` exposes a UI surface for the term-to-term link/unlink operation; backend `addLinkedTermToTerm` and `deleteLinkedTermFromTerm` (TermController.java:237-249) have NO SecurityRule. Any authenticated user can click 'link a term' in the UI and the operation succeeds regardless of which TERM_* permissions they hold. The route module is not the locus of the bug — the backend is — but the UI surface is the visible delivery vector." — evidence: termsRoutes.ts:30 (`LINKED_TERMS: 'linked-terms'`) + TermController.java:237-249 (no SecurityRule) per TermController sidecar `bugs_limitations_corner_cases.[3]` — severity: HIGH (carries the upstream severity; mitigation lives at the backend)

## performance

- **hot_paths**:
  - "`termDetailsPath()` is invoked at component render time by 11 call sites (per Grep). Specifically: ToolbarTabs.tsx is on the global toolbar (every navigation), TermSearchResultItem.tsx is rendered per search result (page-size: 30 from TermSearch.tsx:36 termSearchFormData = `pageSize: 30`), TermDetailsTabs.tsx renders 5 tab links on every detail-page render. The function body is one `generatePath` call (one regex substitution + one String construction); cost is O(1) per call, negligible in aggregate." — evidence: termsRoutes.ts:35-42 + TermSearchResultItem.tsx:19 + TermDetailsTabs.tsx:18,22,28,34,40
  - "`termsSearchPath()` is invoked at the toolbar (per nav), post-create redirect, and post-delete redirect — sub-millisecond." — evidence: termsRoutes.ts:12-19
- **throughput_characteristics**: `N/A — declarative URL-shape module, not on a request/response or streaming path. No batching, no async, no I/O.`
- **resource_allocation**: `Trivial — five `as const` string literal slots in TermDetailsRoutes, plus 2 module-private BASE_PATH constants, plus 2 module-private TERM_ID/TERMS_SEARCH_ID constants. Bundle-size cost a few dozen bytes after minification. No memory pooling, no DB connection, no outbound HTTP.` — evidence: termsRoutes.ts:1-63
- **scaling_characteristics**: `Stateless and pure — all three URL-builders (`termsPath`, `termsSearchPath`, `termDetailsPath`) are referentially transparent. `useTermsRouteParams` is a thin wrapper over `useParams` (`react-router-dom`); the only non-trivial computation is `parseInt(termId, 10)` (O(1) on the URL segment length). No closure over mutable state, no module-level mutation, no side effects, scales horizontally with the React render tree at zero cost.` — evidence: termsRoutes.ts:1-63
- **known_performance_gaps**: []

## upstream_callers

- entry_point: "ui_route:/terms (App.tsx:66-68 mount)"
  caller_node: "odd-platform__ts__react-component__component__App"
  multiplicity_per_trigger: 1
  evidence: "App.tsx:23 imports `termsPath` from 'routes'; App.tsx:66 calls `termsPath()` exactly once at route-mount evaluation time (rendered once per React app instance)."
  observation_class: ui-call

- entry_point: "ui_route:/termsearch (App.tsx:63 mount)"
  caller_node: "odd-platform__ts__react-component__component__App"
  multiplicity_per_trigger: 1
  evidence: "App.tsx:24 imports `termsSearchPath` from 'routes'; App.tsx:63 calls `termsSearchPath()` once at mount."
  observation_class: ui-call

- entry_point: "ui_button:Dictionary (ToolbarTabs.tsx:67 nav target)"
  caller_node: "odd-platform__ts__react-component__component__ToolbarTabs"
  multiplicity_per_trigger: 1
  evidence: "ToolbarTabs.tsx:22 imports `termsSearchPath`; ToolbarTabs.tsx:67 builds the Dictionary nav entry with `link: termsSearchPath()`. Operator click → React Router navigates to `/termsearch`. Multiplicity 1 per click."
  observation_class: ui-call

- entry_point: "ui_action:CreateTermSearch (ToolbarTabs.tsx:115 redirect)"
  caller_node: "odd-platform__ts__react-component__component__ToolbarTabs"
  multiplicity_per_trigger: 1
  evidence: "ToolbarTabs.tsx:115 — after `createTermSearch` resolves, calls `termsSearchPath(searchId)` and navigates. Per global-search side-effect when the operator hits the search input."
  observation_class: ui-call

- entry_point: "ui_action:DeleteTerm (TermDetails.tsx:50 redirect)"
  caller_node: "odd-platform__ts__react-component__component__TermDetails"
  multiplicity_per_trigger: 1
  evidence: "TermDetails.tsx:50 — `deleteTerm.then(() => navigate(termsSearchPath(termSearchId)))`. After successful backend delete (per TermController.deleteTerm), redirect to search page."
  observation_class: ui-call

- entry_point: "ui_action:TermSearchResultClick (TermSearchResultItem.tsx:19 link)"
  caller_node: "odd-platform__ts__react-component__component__TermSearchResultItem"
  multiplicity_per_trigger: 1
  evidence: "TermSearchResultItem.tsx:19 — builds `termDetailsOverviewLink = termDetailsPath(termSearchResult.id)` for every search-result row. With page-size 30 (TermSearch.tsx:36), 30 invocations per search-results render."
  observation_class: ui-call

- entry_point: "ui_action:CreateTerm (TermsForm.tsx:110 redirect)"
  caller_node: "odd-platform__ts__react-component__component__TermsForm"
  multiplicity_per_trigger: 1
  evidence: "TermsForm.tsx:110 — `navigate(termDetailsPath(response.id))` after `createTerm` thunk resolves."
  observation_class: ui-call

- entry_point: "ui_action:NavigateFromLinkedTerm (TermItem.tsx — Overview tab; LinkedTerm.tsx — Linked Terms tab; QueryExampleDetailsLinkedTermsItem.tsx)"
  caller_node: "various (Terms/TermDetails/Overview/TermLinkedTerms/TermItem/TermItem.tsx:35 + Terms/TermDetails/TermLinkedTermsList/LinkedTerm/LinkedTerm.tsx:13 + DataModelling/QueryExampleDetails/QueryExampleDetailsLinkedTermsItem.tsx:16)"
  multiplicity_per_trigger: 1
  evidence: "Three navigation surfaces for term-to-term traversal; each call site constructs `termDetailsPath(id, ...)` once per rendered linked term."
  observation_class: ui-call

- entry_point: "ui_action:NavigateFromDataEntityTermTag (OverviewTerms/TermItem.tsx; DatasetFieldTerms/TermItem.tsx)"
  caller_node: "DataEntityDetails/Overview/OverviewTerms/TermItem/TermItem.tsx:25 + DataEntityDetails/DatasetStructure/...DatasetFieldTerms/TermItem/TermItem.tsx:35"
  multiplicity_per_trigger: 1
  evidence: "Term tags attached to data entities link back to the term's detail page via `termDetailsPath(linkedTerm.term.id)` / `termDetailsPath(termId, 'overview')`."
  observation_class: ui-call

- entry_point: "ui_action:MarkdownTermMention (useTermWiki.ts:193)"
  caller_node: "odd-platform__ts__hook__useTermWiki"
  multiplicity_per_trigger: "N (per @-mention in description text)"
  evidence: "useTermWiki.ts:193 — `makeTermLink(name, termDetailsPath(id), definition)`. For every term @-mention parsed out of a markdown description, one termDetailsPath call to build the hover-link target. Multiplicity scales with mention count in the rendered description (read-side per page load)."
  observation_class: ui-call

- entry_point: "ui_action:QueryExamplesListItem (QueryExamplesListItem.tsx:29)"
  caller_node: "QueryExamples/QueryExamplesListItem.tsx:29"
  multiplicity_per_trigger: 1
  evidence: "Builds `termDetailsPath(term.term.id)` per term referenced from a query-example listing."
  observation_class: ui-call

- entry_point: "hook_invocation:useTermsRouteParams (4 consumers — TermDetails.tsx:25, TermSearch.tsx:26, TermDetailsRoutes.tsx:20, TermDetailsTabs.tsx:11)"
  caller_node: "various"
  multiplicity_per_trigger: 1
  evidence: "Hook called once per consumer mount. TermDetails.tsx:25 inside `/terms/:termId/*`; TermSearch.tsx:26 inside `/termsearch/:termSearchId` (note: `termId` here is `NaN` and ignored); TermDetailsRoutes.tsx:20 inside `/terms/:termId/*`; TermDetailsTabs.tsx:11 inside `/terms/:termId/*`."
  observation_class: ui-call

## downstream_side_effects

- side_effect_class: page-render
  description: "Indirectly: routes a navigation event to the matching React component. The URL-builder functions DO NOT themselves cause a side effect; they return strings. The side effect happens when a consumer passes the returned string to `navigate(...)` (react-router-dom) or `<Link to={...}>` — React Router observes the URL change and matches against the route tree."
  evidence: "termsRoutes.ts:14-19, 22-23, 39-42 (return statements only; no side-effect calls) + consumers' `navigate(termDetailsPath(...))` / `<Link to={termDetailsPath(...)}>` patterns at TermSearchResultItem.tsx:26 (using `S.TermSearchResultsItemLink`), TermDetails.tsx:50 (`navigate(...)`), etc."
  cardinality_per_call: 0   # The route module itself causes 0 side effects per call; the caller-side `navigate` produces 1 page-transition.
  reachable_from_entry_points:
    - "ui_button:Dictionary"
    - "ui_action:CreateTermSearch"
    - "ui_action:DeleteTerm"
    - "ui_action:TermSearchResultClick"
    - "ui_action:CreateTerm"
    - "ui_action:NavigateFromLinkedTerm"
    - "ui_action:NavigateFromDataEntityTermTag"
    - "ui_action:MarkdownTermMention"
    - "ui_action:QueryExamplesListItem"

- side_effect_class: page-render
  description: "REFERENCE — At mount of `/terms/:termId/*` (the page rendered by `TermDetails.tsx`), the TermDetails component fires a `fetchTermDetails({termId})` thunk + a `fetchResourcePermissions({resourceId: termId, permissionResourceType: TERM})` thunk. Downstream side effects (DB read against `TERM` table via `getTermDetailsDto`'s 11-LEFT-JOIN per the TermController + TermServiceImpl + ReactiveTermRepositoryImpl sidecars) cardinality 2 per mount (one for each thunk)."
  evidence: "TermDetails.tsx:37-45 (useEffect dispatching the two thunks) — but the route module ITSELF does not cause this; it's the consumer."
  cardinality_per_call: 0   # Route module emits no DB call; the consumer's TermDetails component does (2 thunks per mount).
  reachable_from_entry_points:
    - "ui_route:/terms (App.tsx:66-68 — when matched with :termId)"
  unresolved: false   # Resolved via TermDetails sidecar; cardinality recorded there.

- side_effect_class: page-render
  description: "Visiting bare `/terms` URL (no :termId): React Router matches the parent route declared at App.tsx:66 but has no element to render and no `index` route, so the rendered output beneath the AppToolbar is empty. **No content, no error message, no redirect.** Operator-visible blank page. Pinned by P-164."
  evidence: "App.tsx:66-68 (parent route with single child `:termId/*`, NO index, NO element prop) + termsRoutes.ts:21-23 (`termsPath()` returns `/terms`)"
  cardinality_per_call: 1   # 1 blank-page render per bare-/terms visit
  reachable_from_entry_points:
    - "ui_address_bar:/terms (operator-typed URL)"

## sources

- understanding ← odd-platform-ui/src/routes/termsRoutes.ts:1-63 + odd-platform-ui/src/components/App.tsx:23-24, 63, 66-68, 75-88 + odd-platform-ui/src/components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:67, 115 + odd-platform-ui/src/components/Terms/TermSearch/TermSearch.tsx:1-91 + odd-platform-ui/src/components/Terms/TermDetails/TermDetails.tsx:50, 59-70 + odd-platform-ui/src/components/Terms/TermDetails/TermDetailsRoutes/TermDetailsRoutes.tsx:29-46 + WebFetch https://docs.opendatadiscovery.org/features/data-glossary/business-glossary (2026-05-26, 200)
- concepts.entities.[Term] ← odd-platform-ui/src/routes/termsRoutes.ts:2, 36, 50
- concepts.entities.[TermDetailsRoutes] ← odd-platform-ui/src/routes/termsRoutes.ts:25-31
- concepts.entities.[TermsRouteParams + AppTermsRouteParams] ← odd-platform-ui/src/routes/termsRoutes.ts:44-52
- concepts.operations.[termsSearchPath] ← odd-platform-ui/src/routes/termsRoutes.ts:12-19 + 5 consumer sites
- concepts.operations.[termsPath] ← odd-platform-ui/src/routes/termsRoutes.ts:21-23 + odd-platform-ui/src/components/App.tsx:66 (sole consumer)
- concepts.operations.[termDetailsPath] ← odd-platform-ui/src/routes/termsRoutes.ts:35-42 + 11 consumer sites
- concepts.operations.[useTermsRouteParams] ← odd-platform-ui/src/routes/termsRoutes.ts:54-63 + 4 consumer sites
- concepts.operations.[type narrowing] ← odd-platform-ui/src/routes/termsRoutes.ts:33, 37
- concepts.invariants.[two base paths] ← odd-platform-ui/src/routes/termsRoutes.ts:4-5 + odd-platform-ui/src/components/App.tsx:63, 66
- concepts.invariants.[no element on /terms mount] ← odd-platform-ui/src/components/App.tsx:66-68
- concepts.invariants.[NaN coercion] ← odd-platform-ui/src/routes/termsRoutes.ts:60
- concepts.invariants.[TermDetailsRoutes single source of truth caveat] ← odd-platform-ui/src/routes/termsRoutes.ts:25-31 + odd-platform-ui/src/components/Terms/TermDetails/TermDetailsRoutes/TermDetailsRoutes.tsx:29-34, 46
- concepts.invariants.[generatePath import] ← odd-platform-ui/src/routes/termsRoutes.ts:1
- concepts.invariants.[useTermsRouteParams typed wrapper] ← odd-platform-ui/src/routes/termsRoutes.ts:54-57
- dependencies_semantic.requires-feature ← odd-platform-ui/src/components/App.tsx:66-68 + sibling TermController / TermDetails / TermSearch sidecars
- dependencies_semantic.requires-runtime ← odd-platform-ui/src/routes/termsRoutes.ts:1-2
- dependencies_semantic.additional_coupling ← odd-platform-ui/src/routes/index.ts:8 + grep `termsRoutes|termsPath|termDetailsPath|termsSearchPath|useTermsRouteParams|TermDetailsRoutes` across odd-platform-ui/src returned 25 file matches
- tests_coverage_semantic.test_files ← `find <odd-platform-repo>/odd-platform-ui/src -name '*.test.*' -o -name '*.spec.*' | xargs grep termsPath` returns no matches at commit 80637ed
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/features/data-glossary (2026-05-26, 200)
- docs_link_semantic.inferred_docs.[1] ← WebFetch https://docs.opendatadiscovery.org/features/data-glossary/business-glossary (2026-05-26, 200)
- docs_link_semantic.inferred_docs.[2] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions (2026-05-26, 200)
- docs_link_semantic.doc_drift_findings.[list-vs-search] ← WebFetch https://docs.opendatadiscovery.org/features/data-glossary/business-glossary (2026-05-26, 200; "The Dictionary tab is the catalog-wide list...") vs odd-platform-ui/src/components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:67 (Dictionary → termsSearchPath, i.e. /termsearch) + odd-platform-ui/src/components/Terms/TermSearch/TermSearch.tsx:70-86 (search UI with facets)
- docs_link_semantic.doc_drift_findings.[term-to-term linkage RBAC absent in docs] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions (2026-05-26, 200) + TermController sidecar `bugs_limitations_corner_cases.[3]`
- implicit_adrs.[two-base-path topology] ← odd-platform-ui/src/routes/termsRoutes.ts:4-5
- implicit_adrs.[termsPath lock-step] ← odd-platform-ui/src/routes/termsRoutes.ts:21-23 + grep `termsPath\(` (2 hits)
- implicit_adrs.[5-member taxonomy] ← odd-platform-ui/src/routes/termsRoutes.ts:25-31 + odd-platform-ui/src/components/Terms/TermDetails/TermDetailsRoutes/TermDetailsRoutes.tsx:29-46
- implicit_adrs.[route-module auth-free] ← odd-platform-ui/src/components/App.tsx:66-68 vs App.tsx:75-88 (lookupTables pattern)
- implicit_adrs.[useTermsRouteParams typed wrapper] ← odd-platform-ui/src/routes/termsRoutes.ts:54-63
- bugs_limitations_corner_cases.[blank /terms] ← odd-platform-ui/src/components/App.tsx:66-68 + odd-platform-ui/src/routes/termsRoutes.ts:21-23 + lineage/odd-platform/probes/P-164.yaml
- bugs_limitations_corner_cases.[NaN coercion] ← odd-platform-ui/src/routes/termsRoutes.ts:60 + TermDetails.tsx:25, 38
- bugs_limitations_corner_cases.[default-arg literal not via TermDetailsRoutes.OVERVIEW] ← odd-platform-ui/src/routes/termsRoutes.ts:26, 37
- bugs_limitations_corner_cases.[candidate substrate-extractor gap] ← termsRoutes.ts:25-31 + alerts sidecar `bugs_limitations_corner_cases.[0]` cross-reference (verifier compares this sidecar's enumerated sub-routes against substrate output to confirm or refute)
- bugs_limitations_corner_cases.[no test coverage] ← `find <odd-platform-repo>/odd-platform-ui/src -name '*.test.*' -o -name '*.spec.*' | xargs grep termsPath` no matches at 80637ed
- bugs_limitations_corner_cases.[useTermsRouteParams cross-route reuse] ← odd-platform-ui/src/routes/termsRoutes.ts:54-63 + odd-platform-ui/src/components/Terms/TermSearch/TermSearch.tsx:26
- stress_findings.name_behavior_pairs.[termsPath] ← termsRoutes.ts:21-23 + App.tsx:66-68 + ToolbarTabs.tsx:67
- stress_findings.name_behavior_pairs.[termsSearchPath] ← termsRoutes.ts:12-19 + ToolbarTabs.tsx:67 + business-glossary doc page
- stress_findings.name_behavior_pairs.[termDetailsPath] ← termsRoutes.ts:35-42 + TermDetailsRoutes.tsx:29-46
- stress_findings.name_behavior_pairs.[useTermsRouteParams] ← termsRoutes.ts:54-63 + TermSearch.tsx:26
- stress_findings.auth_gates ← App.tsx:66-68 + TermDetails.tsx:59-70 + TermDetailsRoutes.tsx:33-44 + TermController sidecar
- stress_findings.request_inputs.[termId] ← termsRoutes.ts:36 + TermDetails.tsx:25, 38 + TermController sidecar
- stress_findings.request_inputs.[searchId] ← termsRoutes.ts:12 + TermSearch.tsx:26, 47 + TermController sidecar
- stress_findings.request_inputs.[path] ← termsRoutes.ts:37 + TermDetailsRoutes.tsx:29-46
- stress_findings.probes_emitted.[P-164] ← lineage/odd-platform/probes/P-164.yaml (emitted by this enrichment)
- security.auth_mode_relevance ← odd-platform-ui/src/routes/termsRoutes.ts:1-63 (no auth branches) + alerts sidecar's analogous note
- security.known_security_gaps.[term-to-term UI surface] ← termsRoutes.ts:30 + TermController sidecar `bugs_limitations_corner_cases.[3]`
- performance.hot_paths ← termsRoutes.ts:35-42 + 11 consumer call sites
- performance.resource_allocation ← termsRoutes.ts:1-63
- performance.scaling_characteristics ← termsRoutes.ts:1-63
- upstream_callers.* ← 13 caller sites enumerated above; each cited inline
- downstream_side_effects.[page-render via navigate] ← termsRoutes.ts:14, 22, 39 (return-only) + consumer `navigate(...)` patterns
- downstream_side_effects.[reference: TermDetails mount fetches] ← TermDetails.tsx:37-45 + TermDetails sidecar
- downstream_side_effects.[blank /terms render] ← App.tsx:66-68 + lineage/odd-platform/probes/P-164.yaml

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH
- upstream_callers: HIGH
- downstream_side_effects: HIGH
- stress_findings: HIGH

## Maintainer notes

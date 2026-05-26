---
node_id: "odd-platform ts routes route:queryExamples"
node_kind: route
axis: ui_routes
extracted_at_commit: 4ec2b20
enriched_at_commit: 4ec2b20
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-26-ZI-queryExamples-route
feature_hint: "P-02 Query Examples sub-route — URL-shape module for the /data-modelling/query-examples and /data-modelling/query-examples/{id} surfaces. Pairs with F-025 (Query Examples feature) and the batch V QueryExampleController backend. The module owns three exports: URLSearchParams (search-param key constant), useQueryExamplesRouteParams (path-param parser hook), queryExamplesPath (URL builder)."
related_features: ["F-025"]
related_pillar_features: ["P-02"]
---

# queryExamples route — semantic understanding

## understanding

This module is the URL-shape contract for the **Query Examples sub-feature of Data Modelling**. It exports three artefacts: (a) `URLSearchParams.QUERY_SEARCH_ID = 'querySearchId'` (line 5-7) — the query-string key used by the Query Examples list page to persist the in-progress search-id across navigation; (b) `useQueryExamplesRouteParams` (line 19-27) — a hook that reads the React Router `:queryExampleId` path segment and `parseInt`s it from string-to-number for downstream component use; (c) `queryExamplesPath(queryExampleId?)` (line 29-38) — the URL builder that returns `/data-modelling/query-examples` when called with no argument and `/data-modelling/query-examples/{id}` when called with an id. The file imports `BASE_PATH` from the sibling `dataModelling.ts` (line 3) — so changing the parent prefix cascades silently. The file owns NO rendering, NO auth gate, NO data fetch — it is a pure URL-shape module; the route MOUNT lives at `components/DataModelling/DataModellingRoutes.tsx:17-39` (two `<Route>` declarations wrapped in non-blocking `WithPermissionsProvider`). Per the live doc page `https://docs.opendatadiscovery.org/features/data-modelling/query-examples` (WebFetched 2026-05-26, status 200), this URL is reachable by every authenticated user; the create/update/delete action buttons inside the page are gated by `WithPermissions` against `QUERY_EXAMPLE_CREATE | QUERY_EXAMPLE_UPDATE | QUERY_EXAMPLE_DELETE`. **The route guard from the parent does NOT block** — see the ZH dataModelling parent sidecar `stress_findings.name_behavior_pairs.[WithPermissionsProvider]` for the Category B drift on `WithPermissionsProvider`; this sidecar inherits that finding via REFERENCE rather than re-stating it.

## concepts

- entities: [
    "`URLSearchParams.QUERY_SEARCH_ID` (string literal `'querySearchId'`) — the query-string key for the search-id parameter that the Query Examples list page persists across the search/list flow. Exported as an `as const` object so TypeScript callers get the literal type. Consumed by `lib/hooks/useCreateQueryExampleSearch.ts` (per the live grep for `QUERY_SEARCH_ID`).",
    "`useQueryExamplesRouteParams` — React Router hook that reads `:queryExampleId` from the URL via `useParams` and returns `{ queryExampleId: <parsed number> }`. The string→number conversion uses `parseInt(..., 10)` with NO validation; an invalid segment (`'abc'`, empty string, non-numeric) returns `NaN`.",
    "`queryExamplesPath(queryExampleId?: QueryExample['id'])` — URL builder. With no argument: returns `/data-modelling/query-examples`. With a truthy numeric argument: returns `/data-modelling/query-examples/{id}` via `generatePath`. Uses a FALSY check at line 31 (`if (queryExampleId)`) — so `queryExamplesPath(0)` returns the LIST path, not the details path for id=0.",
    "**Two interfaces** that don't appear in the public API but document the type-system shape: `QueryExamplesRouteParams { queryExampleId: string }` (line 11-13, the React Router raw shape) and `AppQueryExamplesRouteParams { queryExampleId: number }` (line 15-17, the parsed shape). The latter is exposed via `useQueryExamplesRouteParams`'s return type; the former is internal."
  ]
- operations: [
    "build list URL — `queryExamplesPath()` returns `/data-modelling/query-examples`",
    "build details URL — `queryExamplesPath(id)` returns `/data-modelling/query-examples/{id}` (when id is truthy)",
    "parse path param — `useQueryExamplesRouteParams()` reads the URL and returns the parsed numeric id (or NaN if the segment isn't numeric)",
    "expose the search-id query-param key — `URLSearchParams.QUERY_SEARCH_ID` is the constant the list page reads/writes when persisting the in-progress search across URL changes"
  ]
- invariants: [
    "The Query Examples URL is `${BASE_PATH}/query-examples` where `BASE_PATH = '/data-modelling'` from the sibling `dataModelling.ts:3`. Renaming `BASE_PATH` cascades here silently.",
    "The `:queryExampleId` path segment is a numeric id (per `QueryExample['id']` which resolves to `number` in generated-sources). The route module does NOT enforce numeric-validity; it trusts the React Router pattern + `parseInt` to coerce.",
    "The truthy-id guard at line 31 means `queryExampleId === 0` is indistinguishable from `queryExampleId === undefined` — both return the LIST path. Postgres bigserial starts at 1, so id=0 is not currently produced by the backend, but the asymmetry is silent.",
    "`useQueryExamplesRouteParams` MUST be called from a component rendered under a `<Route path='...:queryExampleId'>` declaration. Calling it from a component mounted under the LIST route (`/data-modelling/query-examples` without `:queryExampleId`) returns `{ queryExampleId: NaN }` (the type cast `as QueryExamplesRouteParams` is unsound — it claims the param is a string when it's actually undefined; `parseInt(undefined, 10)` returns `NaN`).",
    "The file exports three top-level symbols (`URLSearchParams`, `useQueryExamplesRouteParams`, `queryExamplesPath`) — all consumed via `routes/` (the bare-module re-export at `routes/dataModelling/index.ts:1` → `routes/index.ts:10`). Renaming any of these breaks every consumer site."
  ]
- audiences: [
    "Every authenticated user — the Query Examples URL is reachable by anyone who can sign in (per the parent-route discussion in the ZH dataModelling sidecar `concepts.audiences`). The route mount at `App.tsx:74` carries no permission wrapper around `<DataModeling />`; the inner `DataModellingRoutes.tsx:19-25, 31-37` wrap with `WithPermissionsProvider` which DOES NOT block (per the ZH sidecar Category B finding).",
    "**Action-level permission gating happens INSIDE the rendered components, not at the route level**: per the live doc page `https://docs.opendatadiscovery.org/features/data-modelling/query-examples` (WebFetched 2026-05-26, status 200) — `QUERY_EXAMPLE_CREATE` controls the Add button (`components/DataModelling/QueryExamples.tsx:36-46`); `QUERY_EXAMPLE_UPDATE` controls the Edit button (`components/DataModelling/QueryExampleDetails/QueryExampleDetailsContainerActions.tsx:40-52`); `QUERY_EXAMPLE_DELETE` controls the Delete button (lines 53-79). Users without these still see the read surface (list, details, linked entities/terms).",
    "The route module itself emits to every reader of the SPA bundle — the URL literals are statically inlined into the build."
  ]

## dependencies_semantic

- requires-feature: [
    "Query Examples feature (`F-025` per the batch V QueryExampleController backend at `odd-platform-api/.../controller/QueryExampleController.java` + UI at `components/DataModelling/QueryExamples.tsx` + `components/DataModelling/QueryExampleDetails/QueryExampleDetailsContainer.tsx`) — the route ONLY makes sense when both the backend controller and the UI components are mounted",
    "Data Modelling pillar parent (per the ZH dataModelling parent sidecar) — `BASE_PATH = '/data-modelling'` is imported from the sibling `dataModelling.ts:3`. The leaf route file is structurally subordinate to the parent's URL prefix."
  ]
- requires-config: []
- requires-runtime: [
    "`react-router-dom.generatePath` — imported on line 1 for parameter substitution in the details URL builder (`queryExamplesPath(id)`)",
    "`react-router-dom.useParams` — imported on line 1 for the path-param hook (`useQueryExamplesRouteParams`)",
    "`generated-sources.QueryExample` — imported on line 2 as a TYPE-ONLY import (`import type`); supplies the `QueryExample['id']` type for the `queryExamplesPath` argument (resolves to `number` per the OpenAPI-generated TypeScript type). Renaming `QueryExample` in the OpenAPI spec or removing the `id` field cascades a build break here."
  ]
- additional_coupling:
  - "**Exposed via `routes/dataModelling/index.ts:1` (`export * from './queryExamplesRoutes'`) which is re-exported via `routes/index.ts:10` (`export * from './dataModelling'`).** Consumers import from `'routes'` (the bare module path), not the file directly. Refactoring this file's path is safe; renaming any of the three top-level exports breaks every consumer."
  - "**Consumer sites for `queryExamplesPath`** (Grep across `odd-platform-ui/src/` for `queryExamplesPath`): `components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:52` (toolbar tab default landing — bare call returns list URL); `components/DataModelling/DataModellingTabs.tsx:15` (in-page tab in Data Modelling sidebar); `components/DataModelling/QueryExampleForm/QueryExampleForm.tsx:65` (post-submit redirect: `navigate(queryExamplesPath(qe.id))`); `components/DataModelling/QueryExampleDetails/QueryExampleDetailsContainerActions.tsx:33` (post-delete redirect: `navigate(queryExamplesPath())`). Four sites total."
  - "**Consumer sites for `useQueryExamplesRouteParams`**: `components/DataModelling/QueryExampleDetails/QueryExampleDetailsContainer.tsx:19` (the details container reads the parsed id and uses it as `exampleId` for `useGetQueryExampleDetails` + `useResourcePermissions`). One site."
  - "**Consumer sites for `URLSearchParams`**: `lib/hooks/useCreateQueryExampleSearch.ts` (per Grep — the hook that creates and persists the Query Examples search across URL navigation). One site."
  - "`generatePath(BASE_PATH)` at line 30 is a no-op (no `:param` placeholders); `generatePath(\`${path}/:queryExampleId\`, ...)` at line 32 IS the real use of the helper."

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "`queryExamplesPath()` returns `/data-modelling/query-examples` (the list URL)"
    test_class: unit
    criticality: LOW
    note: "Pure function, trivial — a regression (e.g. typo in BASE_PATH cascade) would be caught at first navigation."
  - behaviour: "`queryExamplesPath(42)` returns `/data-modelling/query-examples/42`"
    test_class: unit
    criticality: LOW
    note: "Pure function. The `generatePath` substitution is React Router-internal."
  - behaviour: "`queryExamplesPath(0)` returns `/data-modelling/query-examples` (the LIST URL, NOT the details URL) due to the falsy guard at line 31"
    test_class: unit
    criticality: LOW
    note: "Inadvertent behaviour shape that future maintainers will trip on if Postgres ever produces id=0 (e.g. a migration that resets bigserial, or a renumbering script). A pinning test would document the current asymmetric semantics."
  - behaviour: "`useQueryExamplesRouteParams()` from inside a `<Route path='query-examples/:queryExampleId'>` returns `{ queryExampleId: <parsed-int> }` for a numeric segment"
    test_class: unit
    criticality: MEDIUM
    note: "The hook is exposed to the test environment via `@testing-library/react-router`; a unit test could exercise the parsing in isolation. The hook is the dominant entry point for the details page — a regression in the type contract would silently break the QueryExampleDetailsContainer."
  - behaviour: "`useQueryExamplesRouteParams()` from a URL with a non-numeric segment (e.g. `/query-examples/abc`) returns `{ queryExampleId: NaN }` and the downstream `useGetQueryExampleDetails({ exampleId: NaN })` fires a doomed API call"
    test_class: integration
    criticality: MEDIUM
    note: "No validation at the route layer; the backend `QueryExampleController.getQueryExampleDetails(NaN)` (with NaN serialised as `NaN` in the URL — see consumer for actual serialisation behaviour) returns 400/404. UX impact: a typo'd URL or a stale bookmark renders an indefinitely-loading page (`AppLoadingPage` at QueryExampleDetailsContainer.tsx:97) before the error surfaces."
  - behaviour: "Adding a third sub-tab to Data Modelling (e.g. a new ERD route) requires a 3-file edit: new route module file under `routes/dataModelling/` (or a new builder export here), new `<Route>` declaration in `DataModellingRoutes.tsx`, new tab entry in `DataModellingTabs.tsx`"
    test_class: integration
    criticality: LOW
    note: "Same structural fragility as in the ZH parent sidecar `tests_coverage_semantic` and the alerts route sidecar — the cross-module coupling between route literal and builder is not type-enforced."
- test_files: []
- gaps: |
    No unit or integration tests target this module. Confirmed by Grep across
    `odd-platform-ui/src/` for `queryExamplesPath` / `useQueryExamplesRouteParams` /
    `URLSearchParams.QUERY_SEARCH_ID` in `*.test.*` / `*.spec.*` files — zero matches.
    The most-likely class of regression that the current zero-test posture misses:
    (a) the `id=0` falsy-guard asymmetry at line 31 (silent if it ever fires);
    (b) the NaN propagation from `useQueryExamplesRouteParams` when the URL is
    malformed; (c) a typo in the path literal at line 30 (`query-examples`) that
    would break the toolbar deep-link, the in-page tab, and every redirect that
    calls `queryExamplesPath(id)` after a create/update — all caught only by a
    human clicking. The unit-class coverage gap is the highest-leverage one
    because the functions are pure and trivially testable.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-modelling/query-examples"
    anchor: ""
    rationale: "The Query Examples page is the canonical user-facing doc for this route's purpose. WebFetched 2026-05-26 — status 200. The page explicitly enumerates the URL surface this route declares: `/data-modelling/query-examples` (list page) and `/data-modelling/query-examples/{id}` (details/edit), and the doc states the create button is `gated by the QUERY_EXAMPLE_CREATE permission` (i.e. action-level gating, consistent with `components/DataModelling/QueryExamples.tsx:36-46` using `WithPermissions` to hide the Add button — NOT a route-level block)."
    last_verified_at: "2026-05-26T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      UI surface (verbatim):
        - "Data Modelling → Query Examples at `/data-modelling/query-examples`"
        - "Details/edit page at `/data-modelling/query-examples/{id}`"
        - "Integration points on dataset and glossary term detail pages"
      RBAC posture (verbatim):
        - "`QUERY_EXAMPLE_CREATE` — controls snippet creation"
        - "`QUERY_EXAMPLE_UPDATE` and `QUERY_EXAMPLE_DELETE` — edit/delete actions"
        - "Users without [the create permission] see the list but no create
          entry-point, meaning read access is broadly available while
          modification requires specific role permissions configured through
          the authorization model."
      Concept summary (verbatim):
        - "operator-curated SQL / KQL / Spark snippets attached to data
          entities and terms. Surfaces 'how the team uses this dataset'"
  - url: "https://docs.opendatadiscovery.org/active-platform-features/query-examples"
    anchor: ""
    rationale: "Earlier URL convention; verified 404 (WebFetched 2026-05-26). The Query Examples page lives under `/features/data-modelling/query-examples`, not under `/active-platform-features/query-examples`. Recorded so the orchestrator's prompt template doesn't reference the stale path."
    last_verified_at: "2026-05-26T00:00:00Z"
    last_verified_status: 404
    confidence: LOW
    fetched_excerpts: |
      "Page Not Found" — the URL returns 404 with a suggested-alternative redirect.
- doc_drift_findings:
  - "The doc page lists `/data-modelling/query-examples/{id}` as the details/edit URL — this matches the route module (line 32 generates exactly that pattern). No drift on the URL shape."
  - "The doc page states the create button is `gated by the QUERY_EXAMPLE_CREATE permission` — this is ACCURATE: the gating lives in `components/DataModelling/QueryExamples.tsx:36-46` via `<WithPermissions permissionTo={Permission.QUERY_EXAMPLE_CREATE}>` around the Add-button-bearing `QueryExampleForm`. The doc's phrasing correctly identifies the gate at action level. **However**, the doc does NOT clarify that the LIST PAGE itself is open to read for any authenticated user — a reader skimming the page might infer that `QUERY_EXAMPLE_CREATE` controls page-level access. This is the same drift-class flagged in the ZH parent sidecar `doc_drift_findings.[1]`: the route's `WithPermissionsProvider` name suggests gating, but only the action-level `WithPermissions` actually gates. Inherited by REFERENCE — not duplicating the writeup here."
  - "The doc page does NOT describe the `:queryExampleId` segment's numeric-only contract or what happens if a user navigates to `/data-modelling/query-examples/abc` (the URL would render an `AppLoadingPage` while the backend returns 400/404 for the NaN id). Surface as a doc-clarity finding to doc-gap-finder. Severity: LOW (operators rarely type bookmark URLs by hand; the SPA navigates via the builder)."
  - "The doc page does NOT mention `URLSearchParams.QUERY_SEARCH_ID = 'querySearchId'` — the query-string key that persists the search-id across navigation on the list page. This is internal SPA state and likely not user-relevant, but a power-user copying the URL with a search active would carry the search-id silently. Severity: LOW (the docs do not promise the URL is sharable across users; the search-id is a per-session token)."

## implicit_adrs

- "**The truthy-id guard at line 31 (`if (queryExampleId)`)** — when `queryExamplesPath(0)` is called, the function returns the LIST URL, not the details URL for id=0. This is consistent with the JavaScript idiom for optional numeric arguments (`if (x)` is true for any non-zero number) BUT silently treats id=0 as 'no argument supplied'. The decision: rely on the convention that the backend never produces id=0 (Postgres bigserial starts at 1); accept that an id=0 caller gets routed to the list. This is the same pattern used throughout the route layer where ids are positive integers (e.g. all `:id` segments in the React Router declarations)." — evidence: queryExamplesRoutes.ts:31-37 — intent_anchor: "(no explicit comment; the falsy-check convention is observable but undocumented)" — confidence: LOW
- "**The `URLSearchParams` constant uses `as const` to expose literal-type safety** (line 7: `} as const`) — TypeScript callers reading `URLSearchParams.QUERY_SEARCH_ID` get the type `'querySearchId'` (literal), not the wider `string`. The decision: query-string keys are referenced by literal string in `URLSearchParams.get('querySearchId')` calls, so literal-type safety prevents typos at the call site. The `as const` is the standard idiom for this." — evidence: queryExamplesRoutes.ts:5-7 — intent_anchor: "(no explicit comment; the `as const` is the convention)" — confidence: MEDIUM
- "**The dual-interface pattern** — `QueryExamplesRouteParams { queryExampleId: string }` (lines 11-13) and `AppQueryExamplesRouteParams { queryExampleId: number }` (lines 15-17). The first is the React Router raw shape (URL segments are always strings); the second is the parsed application-domain shape. The decision: keep the router boundary explicit by maintaining two interfaces — the consumer of the hook always reads the parsed numeric shape, never the raw string. This isolates the parseInt at the route boundary so downstream components never need to coerce. The pattern is unique to this file within the routes directory — `dataEntitiesRoutes.ts` and `termsRoutes.ts` use similar but not-identical idioms (worth checking for unification opportunities)." — evidence: queryExamplesRoutes.ts:11-27 + Grep for `RouteParams` across `odd-platform-ui/src/routes/` shows the pattern is repeated but with slight variation in each file — intent_anchor: "(no comment; the convention is observable in the type system)" — confidence: MEDIUM
- "**The route file owns BOTH the path builder (`queryExamplesPath`) AND the param parser (`useQueryExamplesRouteParams`)** — a single file is the SoT for the URL shape from BOTH the producer side (builder) and consumer side (parser). The decision: route shapes are bidirectional contracts; co-locating the two halves means a refactor that adds a new path param (e.g. `:queryExampleId/:tab`) updates both ends in one edit. Compare `dataEntitiesRoutes.ts` (same pattern). This is structurally orthogonal to the ZH parent's choice to externalise `BASE_PATH` to a third file." — evidence: queryExamplesRoutes.ts:9-38 + Grep for the same builder+parser+constants triple shape in sibling route modules (`dataEntitiesRoutes.ts`, `termsRoutes.ts`) — intent_anchor: "(no comment; the convention is observable across multiple route files)" — confidence: HIGH

## bugs_limitations_corner_cases

- "**The truthy-id guard at line 31 silently routes id=0 to the LIST URL**: `queryExamplesPath(0)` returns `/data-modelling/query-examples`, NOT `/data-modelling/query-examples/0`. This is consistent with JavaScript's `if (numericVar)` idiom but indistinguishable from `queryExamplesPath()` (no-arg) and `queryExamplesPath(undefined)`. Postgres bigserial currently never produces id=0 so the case is theoretical, but: (a) a backend renumbering script that resets the sequence could produce id=0 silently; (b) a future migration that uses signed ints could produce id=0 from a counter underflow; (c) a unit test that uses `0` as a sentinel-id would be silently miscompiled to the list URL. Better idiom: `if (queryExampleId !== undefined)` or `if (queryExampleId != null)`. Cosmetic at current data shape; latent if the data shape changes." — evidence: queryExamplesRoutes.ts:31-37 — severity: LOW
- "**`useQueryExamplesRouteParams` propagates `NaN` silently when the URL segment is non-numeric**: line 22's `as QueryExamplesRouteParams` is a type-system LIE — it claims `queryExampleId` is a non-undefined string when the React Router segment may be missing OR may not be numeric. Then line 25's `parseInt(queryExampleId, 10)` returns `NaN` for any non-numeric input (including the case where the hook is called from a route WITHOUT the `:queryExampleId` segment, where `queryExampleId` is actually undefined). The downstream `useGetQueryExampleDetails({ exampleId: NaN })` then fires `GET /api/queryexample/NaN` (or however `NaN` serialises in axios) — the backend returns 400/404, the UI hangs on `AppLoadingPage` (per `QueryExampleDetailsContainer.tsx:97`) until the error response arrives. No graceful fallback. **Recommended fix**: validate `Number.isInteger(parsed) && parsed > 0` after parseInt; on failure either throw or return a sentinel that the consumer can branch on. Same shape would help the `id=0` case above." — evidence: queryExamplesRoutes.ts:19-27 + components/DataModelling/QueryExampleDetails/QueryExampleDetailsContainer.tsx:18-29 (no fallback when exampleId is NaN) — severity: MEDIUM
- "**`useQueryExamplesRouteParams` is unsafe to call from the LIST route**: if a component mounted under `/data-modelling/query-examples` (no `:queryExampleId` segment) calls this hook, `useParams()` returns `{ queryExampleId: undefined }`. The type cast claims `string`, so TypeScript hides the issue; `parseInt(undefined, 10)` returns `NaN`. The hook does NOT throw, does NOT warn, does NOT return null — it returns `{ queryExampleId: NaN }`. A reader of the code who calls the hook from the wrong scope gets a silent NaN downstream. The only current caller is `QueryExampleDetailsContainer.tsx:19` (correctly mounted under the details route), so this is latent." — evidence: queryExamplesRoutes.ts:19-27 + react-router-dom `useParams` docs (returns undefined for unmatched segments) — severity: LOW
- "**`URLSearchParams` shadows the global Web Platform `URLSearchParams` class**: the file declares `export const URLSearchParams = { QUERY_SEARCH_ID: 'querySearchId' } as const` (lines 5-7). The global `window.URLSearchParams` is the constructor for the URL-search-params API used throughout the SPA. A module that imports BOTH this constant and the global by name would shadow one — but TypeScript module scoping means the import wins. A reader scanning the file may briefly believe `URLSearchParams` refers to the platform API; only the type definition resolves the ambiguity. Cosmetic naming clash, but unconventional." — evidence: queryExamplesRoutes.ts:5-7 + ECMAScript / WHATWG URL spec (global `URLSearchParams`) — severity: LOW
- "**No unit tests on this module**: Grep across `odd-platform-ui/src/` for `queryExamplesPath` / `useQueryExamplesRouteParams` / `QUERY_SEARCH_ID` in `*.test.*` / `*.spec.*` files returned zero matches at commit 4ec2b20. A typo in the path literal at line 30 (e.g. `queryexamples` instead of `query-examples`) would break the toolbar deep-link, the in-page tab, every post-submit redirect, and every post-delete redirect — all caught only by a human navigating. The `id=0` and `NaN` cases above would never trip a regression alarm." — evidence: Grep across odd-platform-ui/src/ for the three exported symbols in test/spec files — severity: LOW
- "**The sub-route inherits the non-blocking-guard semantics from the parent** (per the ZH dataModelling parent sidecar `bugs_limitations_corner_cases.[WithPermissionsProvider does not block]`): the `WithPermissionsProvider` at `DataModellingRoutes.tsx:19-25` (LIST) and `:31-37` (DETAILS) wraps the rendered component in a permission CONTEXT (NOT a gate). A user without `QUERY_EXAMPLE_CREATE` who navigates to `/data-modelling/query-examples` sees the page; the Add button is hidden by `WithPermissions` inside `QueryExamples.tsx:36-46`. A user without BOTH `QUERY_EXAMPLE_UPDATE` AND `QUERY_EXAMPLE_DELETE` navigating to `/data-modelling/query-examples/{id}` ALSO sees the page; the Edit/Delete buttons are hidden by `WithPermissions` inside `QueryExampleDetailsContainerActions.tsx:40,53`. This is the read-collaborative posture documented in the doc page; the route module itself is open by design. Surface here as a leaf-level reference, not a re-derivation." — evidence: components/DataModelling/DataModellingRoutes.tsx:17-39 + components/DataModelling/QueryExamples.tsx:36-46 + components/DataModelling/QueryExampleDetails/QueryExampleDetailsContainerActions.tsx:40-79 + ZH dataModelling parent sidecar bugs_limitations_corner_cases — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables: []
  name_behavior_pairs:
    - name: "queryExamplesPath(queryExampleId?)"
      promise: "Build the URL for either the Query Examples list or a specific query-example details page. Caller passes id to get the details URL; caller passes nothing to get the list URL."
      implementation: "Lines 29-38: returns `/data-modelling/query-examples` if argument is FALSY (undefined OR 0 OR NaN OR empty-string OR null); returns `/data-modelling/query-examples/{id}` (via generatePath) if argument is TRUTHY. The falsy-check at line 31 means id=0 returns the LIST URL, not the details URL. For all currently-observable ids (Postgres bigserial >= 1), the function behaves as the name promises."
      drift: MINOR
      operator_visible_consequence: "Under current data shapes (id >= 1), the function behaves correctly. The id=0 corner case routes to the list URL silently — a developer using id=0 as a sentinel in tests or a backend migration that resets bigserial to 0 would trip this silently. No operator-visible failure today."
      confidence: STATIC-INFERRED
      evidence: "queryExamplesRoutes.ts:29-38"
    - name: "useQueryExamplesRouteParams()"
      promise: "Returns the typed `queryExampleId` from the current URL — a number ready to be passed to API calls."
      implementation: "Lines 19-27: reads `useParams<keyof QueryExamplesRouteParams>()` (which returns `Partial<Record<'queryExampleId', string>>`) and CASTS it as `QueryExamplesRouteParams` (which claims the field is non-undefined). Then runs `parseInt(queryExampleId, 10)`. If the segment is missing or non-numeric, returns `{ queryExampleId: NaN }`. The type-system lies: the cast at line 22 hides the actual `string | undefined`."
      drift: MINOR
      operator_visible_consequence: "When called correctly (from a component under `<Route path='query-examples/:queryExampleId'>`), returns the parsed numeric id — promise met. When called incorrectly (wrong scope, malformed URL, bookmark with non-numeric id), returns NaN silently — promise unmet. The downstream `useGetQueryExampleDetails` then fires a doomed API call and the UI hangs on `AppLoadingPage`. The only current caller (`QueryExampleDetailsContainer.tsx:19`) is correctly mounted, so the drift is latent."
      confidence: STATIC-INFERRED
      evidence: "queryExamplesRoutes.ts:19-27 + components/DataModelling/QueryExampleDetails/QueryExampleDetailsContainer.tsx:19 + react-router-dom useParams type definitions"
    - name: "URLSearchParams (the exported constant, not the platform API)"
      promise: "The name suggests a wrapper around or extension of the Web Platform `URLSearchParams` class — a typed factory or accessor for URL query strings."
      implementation: "Lines 5-7: a plain object literal with one field `QUERY_SEARCH_ID: 'querySearchId'`, frozen via `as const`. It is NOT a wrapper, factory, or accessor — it is a typed string-constants holder. The name suggests behaviour; the implementation is data."
      drift: MINOR
      operator_visible_consequence: "Reader confusion only. A future contributor scanning the file may briefly assume the export wraps the platform `URLSearchParams` class. Type definitions resolve the ambiguity immediately, but the naming is unconventional. No operator visibility."
      confidence: STATIC-INFERRED
      evidence: "queryExamplesRoutes.ts:5-7 + ECMAScript URL spec"
  orderings: []
  auth_gates:
    - location: "components/DataModelling/DataModellingRoutes.tsx:17-26 (LIST sub-route mount)"
      endpoint: "<Route path='query-examples' element={<WithPermissionsProvider allowedPermissions={[QUERY_EXAMPLE_CREATE]} render={() => <QueryExamples />} />} />"
      questions:
        - q: "What does this sub-route return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "**Sub-route inherits the parent's auth-mode-agnostic posture** — the route module is client-side and the auth-mode enforcement happens at the Spring Security resource layer (per the ZH parent sidecar `stress_findings.auth_gates`). Under all four auth modes the SPA bundle is served and the React Router declaration is parsed identically. Under `DISABLED` an unauthenticated session can reach `/data-modelling/query-examples` and the inner React queries against `/api/queryexample/**` succeed unauthenticated (per the batch V QueryExampleController sidecar — 10 of 13 endpoints fall through to `authenticated()`). Under `LOGIN_FORM | OAUTH2 | LDAP` an unauthenticated user is redirected to the auth provider by Spring Security before reaching the SPA; an authenticated user reaches the route with their global-permission set populated."
          confidence: STATIC-INFERRED
          evidence: "components/App.tsx:74 + components/DataModelling/DataModellingRoutes.tsx:17-26 + ZH parent sidecar stress_findings.auth_gates + QueryExampleController sidecar understanding"
        - q: "What does an unauthenticated caller see?"
          a: "Same as the parent — under non-DISABLED auth modes, Spring Security redirects to the auth provider before the SPA renders. Under DISABLED, lands on the Query Examples list directly and the inner data calls succeed. The sub-route module does NOT trigger an auth challenge; it is a pure URL-string."
          confidence: STATIC-INFERRED
          evidence: "queryExamplesRoutes.ts:1-38 (no auth predicates) + ZH parent sidecar stress_findings.auth_gates"
        - q: "What does a wrong-role caller see?"
          a: "**A caller authenticated but lacking `QUERY_EXAMPLE_CREATE` still sees the Query Examples list page.** The `WithPermissionsProvider` at `DataModellingRoutes.tsx:19-25` only seeds a permission context; it does not block. The Add button at `QueryExamples.tsx:36-46` is hidden by `WithPermissions` (which DOES block) — but the list, search, and individual entries remain visible. This is the read-collaborative posture documented at `https://docs.opendatadiscovery.org/features/data-modelling/query-examples`. Inherited from the ZH parent sidecar's Category B finding on `WithPermissionsProvider` — see that sidecar for the full writeup."
          confidence: STATIC-INFERRED
          evidence: "components/DataModelling/DataModellingRoutes.tsx:19-25 + components/shared/contexts/Permission/WithPermissionsProvider.tsx:11-49 + components/shared/contexts/Permission/PermissionProvider.tsx:12-46 + components/DataModelling/QueryExamples.tsx:36-46 + ZH parent sidecar stress_findings.name_behavior_pairs.[WithPermissionsProvider]"
        - q: "Where does the gate live — route, controller, downstream service, or nowhere?"
          a: "**The gate at the route level does NOT exist** (the `WithPermissionsProvider` does not block — Category B finding inherited from the ZH parent). The real gates are: (a) Action-level UI — `WithPermissions` around the Add button (`QueryExamples.tsx:36-46`), Edit button (`QueryExampleDetailsContainerActions.tsx:40`), Delete button (`QueryExampleDetailsContainerActions.tsx:53`). (b) Backend — `QueryExampleController` has `@PreAuthorize` on 3 of 13 endpoints via SECURITY_RULES (per the batch V QueryExampleController sidecar). The route module itself is open to read by design, consistent with the read-collaborative pillar posture."
          confidence: STATIC-INFERRED
          evidence: "components/DataModelling/DataModellingRoutes.tsx:17-39 + components/DataModelling/QueryExamples.tsx:36-46 + components/DataModelling/QueryExampleDetails/QueryExampleDetailsContainerActions.tsx:40-79 + QueryExampleController sidecar"
    - location: "components/DataModelling/DataModellingRoutes.tsx:27-39 (DETAILS sub-route mount)"
      endpoint: "<Route path='query-examples/:queryExampleId' element={<WithPermissionsProvider allowedPermissions={[QUERY_EXAMPLE_UPDATE, QUERY_EXAMPLE_DELETE]} render={() => <QueryExampleDetails />} />} />"
      questions:
        - q: "What does the DETAILS sub-route return for each auth mode?"
          a: "Same auth-mode-agnostic posture as LIST sub-route above — handled by Spring Security at the resource layer."
          confidence: STATIC-INFERRED
          evidence: "components/DataModelling/DataModellingRoutes.tsx:27-39 + ZH parent sidecar stress_findings.auth_gates"
        - q: "What does a wrong-role caller see on the DETAILS route?"
          a: "**A caller authenticated but lacking either `QUERY_EXAMPLE_UPDATE` OR `QUERY_EXAMPLE_DELETE` still sees the details page.** The `WithPermissionsProvider` at `DataModellingRoutes.tsx:31-37` only seeds context. **Subtlety inherited from ZH parent sidecar `doc_drift_findings.[every() AND-of-permissions]`**: the `PermissionProvider` uses `allowedPermissions.every(...)` AND logic — so within the details-route context, `isAllowedTo` evaluates true only if the user has BOTH UPDATE AND DELETE; a user with only one gets `isAllowedTo: false` even though they could exercise their granted action. BUT the actual buttons are gated by separate `WithPermissions` calls (`QueryExampleDetailsContainerActions.tsx:40` checks only UPDATE; `:53` checks only DELETE) which use `getHasAccessTo(specificPermission)` — line 27-31 of PermissionProvider: `[...globalPermissions, ...resourcePermissions].includes(to) && allowedPermissions.includes(to)`. So a UPDATE-only user gets the Edit button (UPDATE is in `allowedPermissions` AND in their globals) but not the Delete button. A DELETE-only user gets the inverse. A user with NEITHER sees neither button BUT still sees the read surface (definition, query, linked entities, linked terms). **The route does NOT 403; the page renders for any authenticated user.**"
          confidence: STATIC-INFERRED
          evidence: "components/DataModelling/DataModellingRoutes.tsx:31-37 + components/shared/contexts/Permission/PermissionProvider.tsx:19-31 + components/DataModelling/QueryExampleDetails/QueryExampleDetailsContainerActions.tsx:40,53 + components/shared/contexts/Permission/WithPermissions.tsx:11-32"
        - q: "Where does the DETAILS gate live?"
          a: "Layered like the LIST route: (a) Route: NOT a gate (WithPermissionsProvider seeds context only). (b) Action: UI `WithPermissions` around Edit (line 40 of Actions) and Delete (line 53) — these DO gate. (c) Backend: `QueryExampleController.updateQueryExample` and `.deleteQueryExample` have @PreAuthorize via SECURITY_RULES (per QueryExampleController sidecar). Note that `QueryExampleDetailsContainer.tsx:53-64` ADDS ANOTHER `WithPermissionsProvider` around the actions block — this one CARRIES the resource-permissions from `useResourcePermissions({ resourceId: exampleId, ... })` — i.e. the resource-scoped permission check is applied at the actions wrapper, not at the route. The route's WithPermissionsProvider scope is wider; the actions wrapper's scope is resource-specific (granting permissions the resource-owner has been delegated)."
          confidence: STATIC-INFERRED
          evidence: "components/DataModelling/QueryExampleDetails/QueryExampleDetailsContainer.tsx:21-25, 53-64 + components/shared/contexts/Permission/WithPermissions.tsx:11-32 + QueryExampleController sidecar"
  resource_boundaries: []
  request_inputs:
    - location: "queryExamplesRoutes.ts:9, 11-13, 15-17, 19-27"
      input_kind: path-param
      input_name: "queryExampleId"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The numeric ID of the specific query example the user is viewing or editing — i.e. the primary key of one row in the `query_example` table that the URL is operating on."
          confidence: STATIC-INFERRED
          evidence: "queryExamplesRoutes.ts:9 (const declaration) + queryExamplesRoutes.ts:11-13 (raw-shape interface) + generated-sources.QueryExample['id'] = number"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Trace: the React Router `<Route path='query-examples/:queryExampleId'>` declaration at `DataModellingRoutes.tsx:28` captures the segment. The leaf hook `useQueryExamplesRouteParams` at `queryExamplesRoutes.ts:19-27` reads it via `useParams` + `parseInt`. The only consumer site is `QueryExampleDetailsContainer.tsx:19` which destructures `queryExampleId` (renamed to `exampleId` for the API call). `exampleId` flows into `useGetQueryExampleDetails({ exampleId })` (`queryExamples.ts:14-21` → `queryExampleApi.getQueryExampleDetails({ exampleId })`) which calls the backend `GET /api/queryexample/{exampleId}` (per the batch V QueryExampleController sidecar). The same `exampleId` ALSO flows into `useResourcePermissions({ resourceId: exampleId, permissionResourceType: PermissionResourceType.QUERY_EXAMPLE })` (`QueryExampleDetailsContainer.tsx:21-24`) which calls `GET /api/permissions?...resourceId=...&resourceType=QUERY_EXAMPLE` to fetch the per-resource permission set for the actions block."
          confidence: STATIC-INFERRED
          evidence: "queryExamplesRoutes.ts:9-27 + components/DataModelling/DataModellingRoutes.tsx:28 + components/DataModelling/QueryExampleDetails/QueryExampleDetailsContainer.tsx:18-29 + lib/hooks/api/dataModelling/queryExamples.ts:14-21 + QueryExampleController sidecar"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES. The name `queryExampleId` promises 'numeric id of one query example'; the implementation USES it as exactly that — both for `getQueryExampleDetails({ exampleId })` (which fetches the row whose `id` column matches) and for `useResourcePermissions({ resourceId, permissionResourceType: QUERY_EXAMPLE })` (which fetches permissions scoped to that exact query-example resource). No translation; no scope drift; no available-but-unused column."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "queryExamplesRoutes.ts:9-27 + lib/hooks/api/dataModelling/queryExamples.ts:14-21 + QueryExampleController sidecar"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "n/a — the name and implementation match. The closest concern is the corner case where the URL segment is NON-NUMERIC ('abc'): the hook returns `{ queryExampleId: NaN }` and the downstream API call is `GET /api/queryexample/NaN` — backend returns 400/404; UI hangs on `AppLoadingPage`. This is a graceful-degradation gap (no client-side validation), NOT a name-vs-implementation drift."
          confidence: STATIC-INFERRED
          evidence: "queryExamplesRoutes.ts:19-27 + components/DataModelling/QueryExampleDetails/QueryExampleDetailsContainer.tsx:18-29, 44 (`queryExampleDetails && !isLoading` guard means NaN-id pages render the AppLoadingPage indefinitely)"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE. The `queryExampleId` propagates all the way to the SQL `WHERE id = ?` in the backend repository (per the QueryExampleController sidecar). There is no semantically-closer column being unused."
          confidence: STATIC-INFERRED
          evidence: "queryExamplesRoutes.ts:9-27 + QueryExampleController sidecar + lib/hooks/api/dataModelling/queryExamples.ts:14-21"
      routes_to_finding: "NONE — name and implementation match; no finding required."
    - location: "queryExamplesRoutes.ts:5-7"
      input_kind: query-param
      input_name: "querySearchId (the value of URLSearchParams.QUERY_SEARCH_ID)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The numeric ID of an in-progress query-examples search — i.e. the primary key of a row in `search_facets` (or equivalent) representing the persistent state of the current search/filter session on the Query Examples list page."
          confidence: STATIC-INFERRED
          evidence: "queryExamplesRoutes.ts:5-7 + lib/hooks/useCreateQueryExampleSearch.ts (consumer)"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "The constant is consumed by `lib/hooks/useCreateQueryExampleSearch.ts` (per Grep for `QUERY_SEARCH_ID`) — the hook reads/writes the `?querySearchId=...` query string to persist the search session across navigation on the Query Examples list page. The search-id is the primary key of a created Query Example Search session on the backend (`POST /api/queryexample/search` per the QueryExampleController sidecar). The URL is the persistence mechanism for the in-progress search — a browser refresh on the list page preserves the search state via this id."
          confidence: STATIC-INFERRED
          evidence: "queryExamplesRoutes.ts:5-7 + lib/hooks/useCreateQueryExampleSearch.ts (Grep hit) + components/DataModelling/QueryExamples.tsx:14 (useCreateQueryExampleSearch) + QueryExampleController sidecar"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES (per static read; consumer-side trace stops at `useCreateQueryExampleSearch` which is outside this sidecar's 1-hop budget). The name `querySearchId` promises 'id of a search'; the consumer hook uses it as 'id of a search session'. No drift evident from the static read. If the consumer hook turned out to bind `querySearchId` to a different column at the SQL layer (e.g. `facets_id` instead of `search_id`), that would be a Category F finding for the consumer hook's sidecar, not this one."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "queryExamplesRoutes.ts:5-7 + Grep for QUERY_SEARCH_ID + name read of useCreateQueryExampleSearch.ts (verified consumer exists)"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "n/a — name and implementation match per static read."
          confidence: REFERENCE
          evidence: "useCreateQueryExampleSearch hook (not enriched in this sidecar)"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE per the route module's static surface. (Backend column shape is owned by the QueryExampleController sidecar.)"
          confidence: STATIC-INFERRED
          evidence: "queryExamplesRoutes.ts:5-7"
      routes_to_finding: "NONE — name and implementation match per static read; full trace lives in the useCreateQueryExampleSearch consumer (not enriched here)."
  probes_emitted: []
  stress_summary:
    triggers_total: 5
    questions_total: 14
    answers_static_inferred: 13
    answers_probe_needed: 0
    answers_reference: 1
    drift_flags: 3
```

## security

- **auth_mode_relevance**: `INTERNAL_ONLY` — UI declarative module. This file exports plain TypeScript constants + a hook + a builder consumed by React Router on the client side. It carries no auth predicates, no fetch calls, and no role/permission checks. The `auth.type` enforcement happens server-side at the Spring Security configuration (per the ZH parent sidecar `security.auth_mode_relevance` and the QueryExampleController sidecar); auth mode does not branch this module's behaviour. — evidence: queryExamplesRoutes.ts:1-38 (no auth-related imports or branches).
- **ingestion_filter_relevance**: `N/A — UI route declaration, not on the ingestion HTTP surface`. — evidence: queryExamplesRoutes.ts:1-38.
- **authorization_assertions**: []
- **owner_scoping**: `N/A — code is not data-scoped`. The route module emits URL strings only; the data-scoping question lives in the QueryExampleController + service layer (per the batch V QueryExampleController sidecar — read-collaborative posture, no per-owner filtering on the read endpoints).
- **data_exposure**: `"The path literal '/data-modelling/query-examples' (and the parameterised '/data-modelling/query-examples/{id}') is statically inlined into the SPA bundle. Discoverable by anyone who can fetch the SPA. Not a confidentiality concern — the public GitHub source carries the same."` — evidence: queryExamplesRoutes.ts:30, 32.
- **known_security_gaps**:
  - "**The sub-route's `WithPermissionsProvider` wrapper at `DataModellingRoutes.tsx:19-25, 31-37` does NOT block rendering** — inherited from the ZH parent sidecar `security.known_security_gaps.[WithPermissionsProvider does not block]`. A user without `QUERY_EXAMPLE_CREATE` viewing `/data-modelling/query-examples` sees the list; a user without `QUERY_EXAMPLE_UPDATE|DELETE` viewing the details page sees the details. The actual access control is at the action button (`WithPermissions`) and the backend (3 of 13 endpoints @PreAuthorize). This is the read-collaborative posture, but the wrapper-naming drift remains. Recorded here for completeness — the leaf URL-shape module does not introduce a new gap, it inherits the parent's." — evidence: components/DataModelling/DataModellingRoutes.tsx:17-39 + components/shared/contexts/Permission/WithPermissionsProvider.tsx:11-49 + ZH parent sidecar security.known_security_gaps — severity: MEDIUM
  - "**`useQueryExamplesRouteParams` propagates NaN on malformed URLs**: a caller bookmarking `/data-modelling/query-examples/abc` (or a misformed deeplink in an email / chat) triggers an indefinite `AppLoadingPage` while the backend returns 400/404 for the NaN id. Not a security gap per se; a graceful-degradation gap. Could become a low-severity DOS vector if a bot fetches many `/abc`/`/def`/... segments since each fires a backend API call before the error returns — but the cost is bounded by the backend's 400 response time." — evidence: queryExamplesRoutes.ts:19-27 + components/DataModelling/QueryExampleDetails/QueryExampleDetailsContainer.tsx:18-29, 44, 97 — severity: LOW

## performance

- **hot_paths**:
  - "`queryExamplesPath()` is invoked at multiple sites — once at App mount (the route declaration at `DataModellingRoutes.tsx:18,28` uses literal paths, NOT a builder call), and at every navigation site (`ToolbarTabs.tsx:52`, `DataModellingTabs.tsx:15`, post-submit `QueryExampleForm.tsx:65`, post-delete `QueryExampleDetailsContainerActions.tsx:33`). Each call is O(1) — either a literal string return (no-arg case) or a `generatePath` with one substitution. The `generatePath` cost is negligible (one regex substitution)." — evidence: queryExamplesRoutes.ts:29-38 + four consumer sites cited above.
  - "`useQueryExamplesRouteParams()` is invoked on every render of `QueryExampleDetailsContainer.tsx` (line 19). The hook is React-Router-internal `useParams()` + a `parseInt` per render. The parseInt cost is constant; the hook does NOT memoize but since both `useParams` and `parseInt` are cheap, this is acceptable. No allocation pressure." — evidence: queryExamplesRoutes.ts:19-27 + components/DataModelling/QueryExampleDetails/QueryExampleDetailsContainer.tsx:19.
- **throughput_characteristics**: `N/A — declarative URL-shape module, not on a request/response or streaming path.`
- **resource_allocation**: `Trivial — one URLSearchParams constant + two interfaces (erased at runtime) + one hook + one builder function. Bundle-size cost is a few dozen bytes after minification.` — evidence: queryExamplesRoutes.ts:1-38.
- **scaling_characteristics**: `Stateless and pure — both the builder and the hook (modulo React Router's own state) are referentially transparent with no closure over mutable state. The hook re-fires on every render of its caller but the parseInt cost is constant; React's render-loop dominates any cost here.` — evidence: queryExamplesRoutes.ts:19-38.
- **known_performance_gaps**: []

## upstream_callers

- entry_point: "ui_route:/data-modelling/query-examples (LIST mount)"
  caller_node: "ts react-component:components/DataModelling/DataModellingRoutes.tsx:18"
  multiplicity_per_trigger: 1
  evidence: "components/DataModelling/DataModellingRoutes.tsx:17-26 — `<Route path='query-examples' element={<WithPermissionsProvider ... render={() => <QueryExamples />} />} />`. The path literal `'query-examples'` is HARD-CODED here, NOT a call to `queryExamplesPath()`; the route module's builder is invoked by NAVIGATION sites, not the route DECLARATION. So the LIST sub-route mount does NOT consume any export of this file — but the path shape is the same."
  observation_class: ui-call
- entry_point: "ui_route:/data-modelling/query-examples/:queryExampleId (DETAILS mount)"
  caller_node: "ts react-component:components/DataModelling/DataModellingRoutes.tsx:28"
  multiplicity_per_trigger: 1
  evidence: "components/DataModelling/DataModellingRoutes.tsx:27-39 — `<Route path='query-examples/:queryExampleId' element={<WithPermissionsProvider ... render={() => <QueryExampleDetails />} />} />`. Same as above — the path literal is hard-coded; the route module's `useQueryExamplesRouteParams` hook is consumed BY the rendered component (`QueryExampleDetailsContainer.tsx:19`), not by the route declaration."
  observation_class: ui-call
- entry_point: "ui_call:components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:52 (Data Modelling toolbar tab default landing)"
  caller_node: "ts react-component:components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:52"
  multiplicity_per_trigger: 1
  evidence: "components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:50-54 — `{ name: t('Data Modelling'), link: queryExamplesPath(), value: 'data-modelling' }`. The toolbar tab uses `queryExamplesPath()` (no-arg) to produce the default landing URL for the Data Modelling pillar — clicking the tab navigates to `/data-modelling/query-examples` directly (bypassing the bare-base redirect)."
  observation_class: ui-call
- entry_point: "ui_call:components/DataModelling/DataModellingTabs.tsx:15 (Data Modelling in-page sidebar tab)"
  caller_node: "ts react-component:components/DataModelling/DataModellingTabs.tsx:15"
  multiplicity_per_trigger: 1
  evidence: "components/DataModelling/DataModellingTabs.tsx:13-16 — `{ name: t('Query Examples'), link: queryExamplesPath() }`. The in-page tab on the Data Modelling sidebar; clicking switches to the Query Examples sub-route from Relationships (or stays on it)."
  observation_class: ui-call
- entry_point: "ui_call:components/DataModelling/QueryExampleForm/QueryExampleForm.tsx:65 (post-submit redirect)"
  caller_node: "ts react-component:components/DataModelling/QueryExampleForm/QueryExampleForm.tsx:65"
  multiplicity_per_trigger: 1
  evidence: "components/DataModelling/QueryExampleForm/QueryExampleForm.tsx:54-66 — `mutation$.then(qe => { reset(); navigate(queryExamplesPath(qe.id)); })`. After creating OR updating a query example, the form navigates to the details URL for the new/updated id."
  observation_class: ui-call
- entry_point: "ui_call:components/DataModelling/QueryExampleDetails/QueryExampleDetailsContainerActions.tsx:33 (post-delete redirect)"
  caller_node: "ts react-component:components/DataModelling/QueryExampleDetails/QueryExampleDetailsContainerActions.tsx:33"
  multiplicity_per_trigger: 1
  evidence: "components/DataModelling/QueryExampleDetails/QueryExampleDetailsContainerActions.tsx:30-36 — `await deleteQueryExample({ exampleId: id }); navigate(queryExamplesPath());`. After deleting a query example, the page navigates back to the list (no-arg `queryExamplesPath()` returns the LIST URL)."
  observation_class: ui-call
- entry_point: "ui_call:components/DataModelling/QueryExampleDetails/QueryExampleDetailsContainer.tsx:19 (consumer of the param hook)"
  caller_node: "ts react-component:components/DataModelling/QueryExampleDetails/QueryExampleDetailsContainer.tsx:19"
  multiplicity_per_trigger: 1
  evidence: "components/DataModelling/QueryExampleDetails/QueryExampleDetailsContainer.tsx:18-19 — `const { queryExampleId: exampleId } = useQueryExamplesRouteParams();`. The only consumer of `useQueryExamplesRouteParams` in the codebase per Grep. The parsed `exampleId` feeds `useGetQueryExampleDetails` AND `useResourcePermissions`."
  observation_class: ui-call
- entry_point: "ui_call:lib/hooks/useCreateQueryExampleSearch.ts (consumer of URLSearchParams constant)"
  caller_node: "ts hook:lib/hooks/useCreateQueryExampleSearch.ts"
  multiplicity_per_trigger: unresolved
  unresolved: true
  evidence: "Grep for `QUERY_SEARCH_ID` in odd-platform-ui/src/ — the hook reads the constant to wire the search-id query-string key. Full trace not enriched in this sidecar's 1-hop budget; recorded as a REFERENCE so the hook's sidecar (when enriched) completes the chain."
  observation_class: ui-call

## downstream_side_effects

- side_effect_class: page-render
  description: "Calling `queryExamplesPath()` (no-arg) returns the literal `/data-modelling/query-examples` — when used as a `<Link to>` or `navigate(...)` target, mounts the `<QueryExamples>` component (per `DataModellingRoutes.tsx:17-26`) which renders the search bar + count + list of query examples + (conditionally) the Add button."
  evidence: "queryExamplesRoutes.ts:29-38 + components/DataModelling/DataModellingRoutes.tsx:17-26 + components/DataModelling/QueryExamples.tsx:18-54"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/data-modelling/query-examples (any of the four navigation sites above)"
    - "ui_route:/data-modelling (parent redirect)"
- side_effect_class: page-render
  description: "Calling `queryExamplesPath(id)` (with a truthy numeric id) returns `/data-modelling/query-examples/{id}` — when used as a navigation target, mounts the `<QueryExampleDetailsContainer>` component which fetches the details, the resource permissions, and renders the details + tabs (overview / linked-entities / linked-terms) + (conditionally) the Edit / Delete action buttons."
  evidence: "queryExamplesRoutes.ts:29-38 + components/DataModelling/DataModellingRoutes.tsx:27-39 + components/DataModelling/QueryExampleDetails/QueryExampleDetailsContainer.tsx:18-99"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/data-modelling/query-examples/:queryExampleId (after post-submit / direct URL / bookmark)"
- side_effect_class: page-render
  description: "Calling `useQueryExamplesRouteParams()` from inside `<QueryExampleDetailsContainer>` triggers two downstream fetches: `useGetQueryExampleDetails({ exampleId })` fires `GET /api/queryexample/{exampleId}` (1 call per render of the container); `useResourcePermissions({ resourceId: exampleId, ... })` fires `GET /api/permissions?...` (1 call per render). The container memoizes via React Query's queryKey, so subsequent renders with the same id hit the cache and do NOT re-fetch."
  evidence: "queryExamplesRoutes.ts:19-27 + components/DataModelling/QueryExampleDetails/QueryExampleDetailsContainer.tsx:18-29 + lib/hooks/api/dataModelling/queryExamples.ts:14-21 + lib/hooks/api/permissions (not enriched)"
  cardinality_per_call: "2 per first render of the details page for a given id; 0 per subsequent render (React Query cache hit). NaN id case: still fires 2 calls; both return errors after the network roundtrip."
  reachable_from_entry_points:
    - "ui_route:/data-modelling/query-examples/:queryExampleId"

## sources

- understanding ← odd-platform-ui/src/routes/dataModelling/queryExamplesRoutes.ts:1-38 + odd-platform-ui/src/routes/dataModelling/dataModelling.ts:3 + odd-platform-ui/src/components/DataModelling/DataModellingRoutes.tsx:1-45 + odd-platform-ui/src/components/DataModelling/QueryExamples.tsx:36-46 + odd-platform-ui/src/components/DataModelling/QueryExampleDetails/QueryExampleDetailsContainer.tsx:18-29, 53-64 + odd-platform-ui/src/components/DataModelling/QueryExampleDetails/QueryExampleDetailsContainerActions.tsx:38-80 + odd-platform-ui/src/components/shared/contexts/Permission/WithPermissionsProvider.tsx:11-49 + odd-platform-ui/src/components/shared/contexts/Permission/PermissionProvider.tsx:12-46 + odd-platform-ui/src/components/shared/contexts/Permission/WithPermissions.tsx:11-32 + ZH dataModelling parent sidecar + WebFetch https://docs.opendatadiscovery.org/features/data-modelling/query-examples (2026-05-26, status 200)
- concepts.entities.[URLSearchParams.QUERY_SEARCH_ID] ← queryExamplesRoutes.ts:5-7
- concepts.entities.[useQueryExamplesRouteParams] ← queryExamplesRoutes.ts:19-27
- concepts.entities.[queryExamplesPath] ← queryExamplesRoutes.ts:29-38
- concepts.entities.[two interfaces] ← queryExamplesRoutes.ts:11-17
- concepts.operations.[build list URL] ← queryExamplesRoutes.ts:29-37
- concepts.operations.[build details URL] ← queryExamplesRoutes.ts:31-35
- concepts.operations.[parse path param] ← queryExamplesRoutes.ts:19-27
- concepts.operations.[expose search-id key] ← queryExamplesRoutes.ts:5-7
- concepts.invariants.[BASE_PATH prefix] ← queryExamplesRoutes.ts:3 + dataModelling.ts:3
- concepts.invariants.[numeric id segment] ← queryExamplesRoutes.ts:25 + generated-sources QueryExample type
- concepts.invariants.[truthy-id guard asymmetry] ← queryExamplesRoutes.ts:31-37
- concepts.invariants.[hook scope assumption] ← queryExamplesRoutes.ts:19-27 + react-router-dom useParams behaviour
- concepts.invariants.[three top-level exports] ← queryExamplesRoutes.ts:5, 19, 29
- concepts.audiences.[every authenticated user] ← components/App.tsx:74 + components/DataModelling/DataModellingRoutes.tsx:17-39 + ZH parent sidecar concepts.audiences
- concepts.audiences.[action-level permission gating inside components] ← components/DataModelling/QueryExamples.tsx:36-46 + components/DataModelling/QueryExampleDetails/QueryExampleDetailsContainerActions.tsx:40,53 + WebFetch https://docs.opendatadiscovery.org/features/data-modelling/query-examples (2026-05-26, status 200)
- dependencies_semantic.requires-feature ← queryExamplesRoutes.ts:1-38 + odd-platform-api/.../controller/QueryExampleController.java (verified to exist) + QueryExampleController sidecar (referenced)
- dependencies_semantic.requires-runtime ← queryExamplesRoutes.ts:1-2
- dependencies_semantic.additional_coupling.[exposed via routes/index] ← routes/dataModelling/index.ts:1 + routes/index.ts:10
- dependencies_semantic.additional_coupling.[consumer sites for queryExamplesPath] ← Grep across odd-platform-ui/src/ for `queryExamplesPath`: ToolbarTabs.tsx:52 + DataModellingTabs.tsx:15 + QueryExampleForm.tsx:65 + QueryExampleDetailsContainerActions.tsx:33
- dependencies_semantic.additional_coupling.[consumer site for useQueryExamplesRouteParams] ← Grep for `useQueryExamplesRouteParams` returned one site: QueryExampleDetailsContainer.tsx:19
- dependencies_semantic.additional_coupling.[consumer site for URLSearchParams] ← Grep for `QUERY_SEARCH_ID` returned `lib/hooks/useCreateQueryExampleSearch.ts`
- dependencies_semantic.additional_coupling.[generatePath behaviour] ← queryExamplesRoutes.ts:30, 32 + react-router-dom generatePath docs
- tests_coverage_semantic.test_files ← Grep across odd-platform-ui/src/ for `queryExamplesPath` / `useQueryExamplesRouteParams` / `QUERY_SEARCH_ID` in test/spec files returned no matches at commit 4ec2b20
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/features/data-modelling/query-examples (2026-05-26, status 200)
- docs_link_semantic.inferred_docs.[1] (stale URL) ← WebFetch https://docs.opendatadiscovery.org/active-platform-features/query-examples (2026-05-26, status 404)
- docs_link_semantic.doc_drift_findings.[URL shape matches] ← WebFetch https://docs.opendatadiscovery.org/features/data-modelling/query-examples (2026-05-26, status 200) + queryExamplesRoutes.ts:30, 32
- docs_link_semantic.doc_drift_findings.[create button gating accurate] ← WebFetch + components/DataModelling/QueryExamples.tsx:36-46
- docs_link_semantic.doc_drift_findings.[no NaN/invalid URL contract documented] ← WebFetch + queryExamplesRoutes.ts:19-27
- docs_link_semantic.doc_drift_findings.[no URLSearchParams documentation] ← WebFetch + queryExamplesRoutes.ts:5-7
- implicit_adrs.[truthy-id guard] ← queryExamplesRoutes.ts:31-37
- implicit_adrs.[URLSearchParams as const] ← queryExamplesRoutes.ts:5-7
- implicit_adrs.[dual-interface pattern] ← queryExamplesRoutes.ts:11-27 + Grep across routes/ for `RouteParams`
- implicit_adrs.[builder+parser co-location] ← queryExamplesRoutes.ts:9-38 + Grep for similar shape in sibling route modules
- bugs_limitations_corner_cases.[truthy-id guard id=0] ← queryExamplesRoutes.ts:31-37
- bugs_limitations_corner_cases.[NaN propagation] ← queryExamplesRoutes.ts:19-27 + components/DataModelling/QueryExampleDetails/QueryExampleDetailsContainer.tsx:18-29
- bugs_limitations_corner_cases.[hook called from wrong scope] ← queryExamplesRoutes.ts:19-27 + react-router-dom useParams behaviour
- bugs_limitations_corner_cases.[URLSearchParams shadows global] ← queryExamplesRoutes.ts:5-7
- bugs_limitations_corner_cases.[no unit tests] ← Grep across odd-platform-ui/src/ for the three exports in *.test.* / *.spec.*
- bugs_limitations_corner_cases.[inherits non-blocking guard from parent] ← components/DataModelling/DataModellingRoutes.tsx:17-39 + ZH parent sidecar bugs_limitations_corner_cases
- stress_findings.name_behavior_pairs.[queryExamplesPath] ← queryExamplesRoutes.ts:29-38
- stress_findings.name_behavior_pairs.[useQueryExamplesRouteParams] ← queryExamplesRoutes.ts:19-27 + components/DataModelling/QueryExampleDetails/QueryExampleDetailsContainer.tsx:18-29
- stress_findings.name_behavior_pairs.[URLSearchParams naming] ← queryExamplesRoutes.ts:5-7
- stress_findings.auth_gates.[LIST] ← components/DataModelling/DataModellingRoutes.tsx:17-26 + components/DataModelling/QueryExamples.tsx:36-46 + ZH parent sidecar stress_findings
- stress_findings.auth_gates.[DETAILS] ← components/DataModelling/DataModellingRoutes.tsx:27-39 + components/DataModelling/QueryExampleDetails/QueryExampleDetailsContainer.tsx:21-25, 53-64 + components/DataModelling/QueryExampleDetails/QueryExampleDetailsContainerActions.tsx:40,53 + ZH parent sidecar doc_drift_findings.[every() AND-of-permissions]
- stress_findings.request_inputs.[queryExampleId] ← queryExamplesRoutes.ts:9-27 + components/DataModelling/QueryExampleDetails/QueryExampleDetailsContainer.tsx:18-29 + lib/hooks/api/dataModelling/queryExamples.ts:14-21 + QueryExampleController sidecar
- stress_findings.request_inputs.[querySearchId] ← queryExamplesRoutes.ts:5-7 + Grep for QUERY_SEARCH_ID
- security.auth_mode_relevance ← queryExamplesRoutes.ts:1-38 (no auth-related branches)
- security.known_security_gaps.[inherits non-blocking guard] ← components/DataModelling/DataModellingRoutes.tsx:17-39 + ZH parent sidecar security.known_security_gaps
- security.known_security_gaps.[NaN propagation] ← queryExamplesRoutes.ts:19-27 + components/DataModelling/QueryExampleDetails/QueryExampleDetailsContainer.tsx:18-29, 44, 97
- performance.hot_paths ← queryExamplesRoutes.ts:19-38 + four consumer sites
- performance.scaling_characteristics ← queryExamplesRoutes.ts:19-38
- upstream_callers.[LIST mount] ← components/DataModelling/DataModellingRoutes.tsx:17-26
- upstream_callers.[DETAILS mount] ← components/DataModelling/DataModellingRoutes.tsx:27-39
- upstream_callers.[ToolbarTabs] ← components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:50-54
- upstream_callers.[DataModellingTabs] ← components/DataModelling/DataModellingTabs.tsx:13-16
- upstream_callers.[QueryExampleForm post-submit] ← components/DataModelling/QueryExampleForm/QueryExampleForm.tsx:54-66
- upstream_callers.[QueryExampleDetailsContainerActions post-delete] ← components/DataModelling/QueryExampleDetails/QueryExampleDetailsContainerActions.tsx:30-36
- upstream_callers.[QueryExampleDetailsContainer param consumer] ← components/DataModelling/QueryExampleDetails/QueryExampleDetailsContainer.tsx:18-19
- upstream_callers.[useCreateQueryExampleSearch constant consumer (unresolved ref)] ← Grep for QUERY_SEARCH_ID in odd-platform-ui/src/
- downstream_side_effects.[list page render] ← queryExamplesRoutes.ts:29-38 + components/DataModelling/DataModellingRoutes.tsx:17-26 + components/DataModelling/QueryExamples.tsx:18-54
- downstream_side_effects.[details page render] ← queryExamplesRoutes.ts:29-38 + components/DataModelling/DataModellingRoutes.tsx:27-39 + components/DataModelling/QueryExampleDetails/QueryExampleDetailsContainer.tsx:18-99
- downstream_side_effects.[hook-triggered fetches] ← queryExamplesRoutes.ts:19-27 + components/DataModelling/QueryExampleDetails/QueryExampleDetailsContainer.tsx:18-29 + lib/hooks/api/dataModelling/queryExamples.ts:14-21

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

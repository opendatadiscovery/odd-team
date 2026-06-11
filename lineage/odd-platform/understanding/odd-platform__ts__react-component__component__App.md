---
node_id: "odd-platform ts components react-component:App"
node_kind: react-component
axis: ui_components
extracted_at_commit: 074c9927
enriched_at_commit: 074c9927
extractor_version: 0.1.0
prompt_version: file-analyser/0.5.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-06-11-01
---

# App (SPA shell + top-level route table) — semantic understanding

## understanding

`App` is the single-page application's shell: it mounts once per page load (under `BrowserRouter`/Redux `Provider` in `index.tsx:53-72`, no `React.StrictMode`), fires four fire-and-forget boot dispatches that prime global reference state (entity-class dictionary, identity+permissions, active feature flags, a 10-item tags page), and declares the top-level route table mapping eleven URL spaces to lazy-loaded page chunks behind one Suspense fallback. As of this commit (#1760 / CTRIB-005) the `/search` and `/termsearch` mounts are nested `index` + `:searchId`/`:termSearchId` param routes — replacing the `/*` splats from the Dec-2023 #1551 refactor that never populated `useParams()`, so every cold search deep-link silently created a fresh session for ~2.5 years. Splat mounts remain only where the hosted component defines its own nested `<Routes>` (Management, Alerts, Directory, DataModelling — verified in each host), which is the legitimate descendant-router pattern, not the #1760 defect class.

## concepts

- entities: [route table, search session (`searchId`), term-search session (`termSearchId`), data entity, term, lookup tables, active feature flags, identity + global permissions, tags, entity-class dictionary, toast notifications]
- operations: [mount top-level routes, code-split page chunks via React.lazy, dispatch boot reference-data fetches, provide permission context for lookup-tables, render global toolbar + toaster]
- invariants: [param routes are declared at the route table wherever the hosted page reads `useParams()` (post-#1760); `/*` splats are used only for hosts with their own nested `<Routes>`; boot dispatches fire exactly once per page load (empty dep array, no StrictMode double-mount); page viewing is never gated client-side — permissions only feed action controls]
- audiences: [every UI user of any role (the shell serves all routes); UI developers adding top-level routes]

## dependencies_semantic

- requires-feature: [backend REST API up at SPA boot — 4 GET endpoints (`/api/dataentities/classes`, `/api/identity/whoami`, `/api/features/active`, `/api/tags`); server-side authentication gate (the SPA shell itself contains no auth logic — the server decides whether the bundle is served)]
- requires-config: [] — App.tsx reads no env/config keys; feature gating arrives via the `/api/features/active` payload consumed by `WithFeature`
- requires-runtime: [react-router v6 ranked route matching (declaration order is not precedence); Redux store (`redux/store`); react-hot-toast `<Toaster>`; browser dynamic `import()` for the 12 lazy chunks]
- coupling: [`PermissionProvider` reads `getGlobalPermissions` ← `profile.owner?.identity.permissions` (profile.selectors.ts:17-20), populated solely by App's boot `fetchIdentity` (plus re-dispatch in OwnerAssociationForm.tsx:128) — the route-level permission context is downstream of App's own boot dispatch]

## tests_coverage_semantic

- covered_behaviours:
  - behaviour: "Cold deep-link `/search/{valid-id}` restores the shared server-side session (the #1551 splat regression: route table must declare `:searchId` as a param route)"
    test_class: integration
    test_files: ["<odd-team>/integration-tests/e2e/specs/search-session-not-found.spec.ts:80 (UI: /search/{valid} deep-link actually loads the shared session)"]
  - behaviour: "`/search/{missing-id}` renders the graceful expired state with a working 'Start new search' recovery"
    test_class: integration
    test_files: ["<odd-team>/integration-tests/e2e/specs/search-session-not-found.spec.ts:62"]
  - behaviour: "`/termsearch/{valid}` restores and `/termsearch/{missing}` shows the expired state (same route-shape class)"
    test_class: integration
    test_files: ["<odd-team>/integration-tests/e2e/specs/search-session-not-found.spec.ts:108"]
- uncovered_behaviours:
  - behaviour: "Unknown URL (no route match) renders toolbar + blank main with no 404 affordance and no redirect — current behaviour unpinned"
    test_class: integration
    criticality: MEDIUM
    note: "Probe P-245 emitted as a characterization probe (green on current gap, red the day a 404 page is added)"
  - behaviour: "Boot-fetch failure modes: backend unreachable at SPA load → silent empty shell (no toast, no retry); HTTP-error response → one error toast, still no retry"
    test_class: integration
    criticality: MEDIUM
    note: "Statically traced (see stress_findings + bugs); no automated test drives the degraded boot"
  - behaviour: "Route-table shape regression guard for the remaining param routes (`:termId`, `:dataEntityId`) — IT-125 pins only the search/termsearch pair"
    test_class: unit
    criticality: LOW
    note: "No component test imports App (grep `components/App` across <odd-platform-repo>/odd-platform-ui/src — sole hit is index.tsx:22); a render test asserting param population per route would catch splat reintroduction cheaply"
- test_files: ["<odd-team>/integration-tests/e2e/specs/search-session-not-found.spec.ts (IT-125; protocol at <odd-team>/integration-tests/protocols/IT-125-search-session-not-found.md)"]
- gaps: |
    The highest-leverage gap class is exactly the one that shipped in #1551: a route-shape
    change that silently breaks `useParams()` population is invisible to unit suites (none
    render App) and was invisible to operators for ~2.5 years because a fresh-session
    fallback masks it. IT-125 now pins search + termsearch end-to-end; the equivalent
    promise for `:termId`/`:dataEntityId` deep-links lives implicitly in those features'
    flows, not asserted at the route table. Integration is the right class for the boot
    degradation paths (the silent network-failure boot is unobservable from unit scope).

## docs_link_semantic

- declared_docs: [] — no `@docs` annotation anywhere in the source (read end-to-end, App.tsx:1-102)
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/search"
    anchor: null
    rationale: "Documents the user-facing contract of the `/search/{uuid}` URL space that App's route shape feeds (session sharing, expiry); note the live URL carries the `/features/` group prefix — `…/data-discovery/search` without it 404s (verified this session)"
    last_verified_at: "2026-06-11"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      Page title: "Search and Filtering". Verbatim quotes from the live page:
      - "Sharing a `/search/{uuid}` URL with a teammate hands them an interactive cursor, not a snapshot."
      - "When they open the link they reach the same server-side row; if you keep clicking facets, their view drifts with yours."
      - "A session row lives until 30 days after its last access"
      - "After eviction the URL returns no results (the Catalog reverts to an empty state)"
      - "Clicking the `Catalog` top-nav tab drops the UUID and starts a fresh session."
  - pending_release: "0.28.0"
    train_ref: "release/0.28.0 (documentation repo) docs/data-discovery/search.md — session bullets 1 and 4 updated per DOC-444; train commit recorded in <odd-team>/contributor/CTRIB-005.md"
    rationale: "The post-#1760 behaviour (deep-link restore actually working; graceful 'This search has expired' state) publishes at the 0.28.0 release gate; live site keeps the 0.27.x wording until then"
    confidence: LOW
- doc_drift_findings:
  - "Live page claims a shared `/search/{uuid}` link 'reach[es] the same server-side row' — in the latest PUBLISHED release the route table mounted `/search/*` as a splat, so `searchId` never populated and a cold open silently created a fresh empty session (#1760). The claim describes the intent and becomes true at 0.28.0 (this commit). KNOWN + tracked: DOC-444 rides release/0.28.0."
  - "Live eviction bullet says 'After eviction the URL returns no results (the Catalog reverts to an empty state)' — post-fix (0.28.0) the UI shows the 'This search has expired' notice + Start-new-search action instead. KNOWN + tracked: DOC-444 (pending-release)."
  - "No live docs page documents the SPA URL scheme / deep-linkable route inventory itself (live TOC walked 2026-06-11; closest surface is the per-feature pages). Not flagged as a gap item — per-feature pages own their URL contracts."

## implicit_adrs

- "Top-level routes are code-split: every page component is `React.lazy` behind one shared Suspense fallback (`AppLoadingPage`)" — evidence: App.tsx:29-41 + App.tsx:58 + AppSuspenseWrapper.tsx:14-20 — intent_anchor: "`// lazy elements` (App.tsx:29) + the convention applied to all 12 page imports without exception" — confidence: HIGH
- "Route-table convention post-#1760: declare `:param` child routes wherever the hosted page reads `useParams()`; reserve `/*` splats for hosts that define their own nested `<Routes>`" — evidence: App.tsx:61-64,66-69 (param routes) vs App.tsx:65,70,78,80 (splats whose hosts each own a nested router: ManagementRoutes.tsx:28, AlertsRoutes.tsx:11, DirectoryRoutes.tsx:10-13, DataModellingRoutes.tsx:15) — intent_anchor: "the #1760 fix itself plus the pre-existing working pattern at termsPath/dataEntitiesPath (App.tsx:72-77) it converges on; pinned by IT-125" — confidence: MEDIUM
- "Boot reference-data fetches are fire-and-forget; error surfacing is centralized in the thunk wrapper, not at call sites" — evidence: App.tsx:47-50 (`.catch(() => {})` on all four dispatches) + handleResponseThunk.ts:37-39 (wrapper toasts unless `switchOffErrorMessage`) — intent_anchor: "the uniform `.catch(() => {})` ×4 (unhandled-rejection suppression only) paired with the wrapper's structured `showServerErrorToast` path" — confidence: MEDIUM
- "Page viewing is never permission-gated client-side; route-level providers supply permission CONTEXT for action controls only — the UI realises the read-collaborative authorization model (published ADR-0003: 'The catalog is read-collaborative — only mutations are permission-gated', title per documentation SUMMARY.md:130, local repo read)" — evidence: App.tsx:81-94 (lookup-tables wraps `Component` in WithPermissionsProvider) + WithPermissionsProvider.tsx:30-39 (always renders, no gate branch) + PermissionProvider.tsx:39-43 (pure context provider) — intent_anchor: "WithPermissionsProvider renders unconditionally in all three branches (render/Component/children) — there is no deny path by design" — confidence: MEDIUM

## bugs_limitations_corner_cases

- "Backend unreachable at SPA boot fails SILENTLY: a network-level failure produces no Response, and `showServerErrorToast` only toasts `if (response?.status)` (errorHandling.tsx:77) — so all four boot fetches reject quietly (`.catch(() => {})` App.tsx:47-50), with no retry path. Operator-visible result for the whole tab lifetime: every `WithFeature`-gated section absent (WithFeature.tsx:32,35 render null; App is the sole dispatcher — grep `dispatch(fetchActiveFeatures` across <odd-platform-repo>/odd-platform-ui/src hits only App.tsx:49), all permission-gated controls hidden (globalPermissions falls back to `[]`, profile.selectors.ts:19), entity-class dictionary empty SPA-wide (sole dispatcher App.tsx:47, same grep scope). An HTTP-level error (response present) DOES toast once — 6s — but equally leaves the empty state with no retry." — evidence: App.tsx:46-51 + errorHandling.tsx:58-79 + handleResponseThunk.ts:34-42 — severity: MEDIUM
- "No catch-all route: `<Routes>` (App.tsx:59-95) declares no `path='*'` fallback, so an unmatched URL renders the toolbar plus an empty main area — no 404 message, no redirect. Reachable by any typo'd/stale URL. Probe P-245 pins the composite UX." — evidence: App.tsx:59-95 (absence verified across the full route block) — severity: MEDIUM
- "Bare `/terms` and `/dataentities` render a blank content area: their route groups declare param children but no `index` element (App.tsx:72-77). Mitigation: no in-app surface links there — `termsPath()` has exactly one consumer, the route table itself (grep `termsPath()` across <odd-platform-repo>/odd-platform-ui/src → App.tsx:72), and `dataEntitiesPath()`'s only non-route consumer uses it for tab-highlight matching, not links (ToolbarTabs.tsx:94). Hand-typed URLs only." — evidence: App.tsx:72-77 + ToolbarTabs.tsx:86-105 — severity: LOW
- "Boot tags fetch is near-vestigial: `fetchTagsList({page:1,size:10})` (App.tsx:50) costs one `GET /api/tags?page=1&size=10` per SPA load, but the tags slice's only reading surface (Management → Tags, TagsList.tsx:37-38) re-dispatches its own fetch on mount (TagsList.tsx:45) and overwrites it (`setAll`, tags.slice.ts:30); every other `fetchTagsList` consumer (autocompletes, activity filters) dispatches per-interaction. Net effect: one extra boot request whose data can only ever serve as a transient initial paint. Scope of the absence claim: grep `fetchTagsList`, `getTagsList`, `state.tags|tagsAdapter` each across the whole <odd-platform-repo>/odd-platform-ui/src tree (components + redux + lib)." — evidence: App.tsx:50 + TagsList.tsx:37-58 + tags.slice.ts:21-32 + tags.selectors.ts:16-20 — severity: LOW
- "No refresh story for boot reference state: feature flags and the entity-class dictionary are fetched once per page load and never again (sole-dispatcher greps above); identity re-fetches only via the owner-association flow (OwnerAssociationForm.tsx:128). Server-side changes to feature flags, a user's permissions, or entity classes are invisible until a manual full reload." — evidence: App.tsx:46-51 + OwnerAssociationForm.tsx:128 — severity: LOW
- "401-handling asymmetry between the two data layers App sits above: react-query's cache reloads the page on a '401' error (index.tsx:33-35), but App's four redux-thunk boot calls route 401s through the toast path with no reload/redirect (handleResponseThunk.ts:34-42). Mid-session auth expiry therefore behaves differently depending on which layer a page fetches with." — evidence: index.tsx:30-48 + App.tsx:47-50 + handleResponseThunk.ts:34-42 — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "App.tsx:50"
      name: "boot tags fetch page/size"
      value: "page: 1, size: 10"
      questions:
        - q: "What at 0 tags in the catalog / exactly 1?"
          a: "Slice setAll([]) / setAll([tag]) — empty or single entry; nothing renders it at boot, so no visible difference"
          confidence: STATIC-INFERRED
          evidence: "tags.slice.ts:21-32"
        - q: "What at N > 10 tags (truncation boundary)?"
          a: "Boot primes only the first 10 of the backend's order; the sole slice reader (Management→Tags) re-fetches with its own page size on mount and overwrites, so truncation is operator-invisible — the cost is the request itself"
          confidence: STATIC-INFERRED
          evidence: "TagsList.tsx:37-58 + tags.slice.ts:30"
        - q: "What does the operator see at each boundary?"
          a: "Nothing attributable: no UI surface renders the boot-fetched page before overwrite; the only observable is one extra GET per SPA load (see bugs entry)"
          confidence: STATIC-INFERRED
          evidence: "grep getTagsList across <odd-platform-repo>/odd-platform-ui/src/components → TagsList.tsx only"
    - location: "App.tsx:55"
      name: "Toaster toastOptions.custom.duration"
      value: "6000"
      questions:
        - q: "Which toasts does the 6000ms actually govern?"
          a: "All of them: every app toast goes through toast.custom (single call site errorHandling.tsx:44; src-wide grep for toast.custom|toast.error|toast( finds no other caller), so the custom-type duration is effectively global — 6s visible lifetime per toast"
          confidence: STATIC-INFERRED
          evidence: "errorHandling.tsx:43-48 + grep across <odd-platform-repo>/odd-platform-ui/src"
        - q: "What if a future toast uses toast.error/toast() directly?"
          a: "It would silently NOT inherit the 6000ms (the option targets only the 'custom' type) — latent inconsistency, no current instance"
          confidence: STATIC-INFERRED
          evidence: "App.tsx:55 (option key is `custom`)"
    - location: "App.tsx:57 + lib/constants.ts:131"
      name: "toolbarHeight"
      value: "48"
      questions:
        - q: "What does the operator see at mismatch (toolbar actual height != 48)?"
          a: "Content offset is a hardcoded paddingTop in px; a toolbar taller than 48px would overlap page content. Layout-only constant, shared from lib/constants"
          confidence: STATIC-INFERRED
          evidence: "App.tsx:57"
  name_behavior_pairs:
    - name: "fetchTagsList (boot dispatch)"
      promise: "fetches 'the tags list' — and the generated client method it wraps is named getPopularTagList, docstring 'Gets the list of existing tags sorted by popularity'"
      implementation: "App.tsx:50 → tags.thunks.ts:19 tagApi.getPopularTagList → GET /api/tags (TagApi.ts:156) — the 'popular' naming lives in the operationId/docstring (TagApi.ts:165-168); whether the backend actually orders by popularity is the LSN-019 finding (listMostPopular chain lacks ORDER BY count — natural/creation order)"
      drift: MINOR
      operator_visible_consequence: "the 10 boot-primed tags are first-10-by-backend-natural-order, not most-popular-10; at this node the impact is nil (data is overwritten before render — see tunables), but any future reader of the boot slice inherits the LSN-019 mislabel"
      confidence: REFERENCE
      evidence: "backend ordering → tag controller/repository sidecar (LSN-019); UI chain fully traced at tags.thunks.ts:13-29 + TagApi.ts:126-170"
    - name: "AppSuspenseWrapper"
      promise: "wraps children in a Suspense boundary"
      implementation: "exactly that — React.Suspense with AppLoadingPage fallback for all lazy route chunks"
      drift: NONE
      operator_visible_consequence: ""
      confidence: STATIC-INFERRED
      evidence: "AppSuspenseWrapper.tsx:8-21"
    - name: "App route table (<Routes>)"
      promise: "every URL a user lands on renders a meaningful page"
      implementation: "eleven mounted URL spaces; NO path='*' fallback — react-router v6 renders a null outlet for unmatched URLs, leaving toolbar + blank main"
      drift: MINOR
      operator_visible_consequence: "typo'd or stale URLs show a blank page with no 404 affordance and no redirect; composite UX pinned by probe P-245"
      confidence: PROBE-NEEDED
      evidence: "P-245"
  orderings:
    - location: "App.tsx:50 (page: 1, size: 10 pagination)"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer?"
          a: "Backend-owned: GET /api/tags maps to the listMostPopular chain whose ordering is the LSN-019 subject (natural order, count never ordered) — out of this node's scope"
          confidence: REFERENCE
          evidence: "backend tag repository sidecar / LSN-019"
        - q: "What is the tie-breaker when sort-key values are equal?"
          a: "Backend-owned, same reference"
          confidence: REFERENCE
          evidence: "backend tag repository sidecar"
        - q: "Which subset is returned when result-set > page size?"
          a: "First page (page=1) of the backend's order — first 10 rows as the database emits them"
          confidence: REFERENCE
          evidence: "TagApi.ts:135-160 (page/size pass through as query params)"
        - q: "Does any upstream layer re-sort or filter the result?"
          a: "No: tagsAdapter is created without a sortComparer (tags.slice.ts:7-9), so entity order = payload order; no UI consumer re-sorts the boot page (none renders it)"
          confidence: STATIC-INFERRED
          evidence: "tags.slice.ts:7-9"
  auth_gates:
    - location: "App.tsx:59-95"
      endpoint: "the entire top-level route table"
      questions:
        - q: "What does this surface return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "App.tsx contains zero auth-mode branching; whether the SPA bundle is served at all is the server's decision per auth mode. Under DISABLED everything is reachable; under the other modes the server gates before the shell runs"
          confidence: REFERENCE
          evidence: "backend security-configuration sidecars (auth.type wiring)"
        - q: "What does an unauthenticated caller see?"
          a: "Not App's code: the server responds (login redirect or the bundle) before any App logic executes — there is no client-side login route in the table"
          confidence: STATIC-INFERRED
          evidence: "App.tsx:59-95 (no login/auth route present)"
        - q: "What does a wrong-role caller see?"
          a: "Every page renders (viewing is never client-gated); action controls hide/disable via PermissionContext fed by whoami's permissions"
          confidence: STATIC-INFERRED
          evidence: "PermissionProvider.tsx:17-32 + profile.selectors.ts:17-20"
        - q: "Where does the gate live — route table, page, context, or nowhere?"
          a: "For viewing: nowhere client-side (deliberate — see implicit_adrs read-collaborative entry). For actions: in consumers of PermissionContext"
          confidence: STATIC-INFERRED
          evidence: "WithPermissionsProvider.tsx:30-39"
    - location: "App.tsx:81-94"
      endpoint: "lookup-tables route (WithPermissionsProvider wrapper)"
      questions:
        - q: "Does the provider block rendering for users lacking the three permissions?"
          a: "No — all three branches of WithPermissionsProvider render unconditionally; it only computes context values"
          confidence: STATIC-INFERRED
          evidence: "WithPermissionsProvider.tsx:19-48"
        - q: "What is the semantics of the 3-permission list?"
          a: "isAllowedTo = allowedPermissions.EVERY(p ∈ global ∪ resource) — true only when the user holds ALL of LOOKUP_TABLE_CREATE+UPDATE+DELETE globally; getHasAccessTo(p) checks one permission at a time. Which of the two LookupTables' children consume (i.e., whether a CREATE-only user sees the create button) is that node's question"
          confidence: REFERENCE
          evidence: "PermissionProvider.tsx:19-32; consumer behaviour → LookupTables sidecar"
        - q: "What does an unauthenticated/permissionless user see on this route?"
          a: "The page renders; globalPermissions=[] makes both context predicates false, so permission-consuming controls render disabled/hidden"
          confidence: STATIC-INFERRED
          evidence: "PermissionProvider.tsx:17-25 + profile.selectors.ts:19"
        - q: "Where does the real enforcement live?"
          a: "Server-side, per-endpoint, at mutation time (client context is UX-only) — consistent with read-collaborative ADR-0003"
          confidence: REFERENCE
          evidence: "backend authorization sidecars"
  resource_boundaries:
    - location: "App.tsx:46-51"
      kind: cache
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "No concurrent mount path exists: App mounts once per page load (index.tsx:53-72, no StrictMode), the effect's dep array is the empty literal (no LSN-017-class response-derived deps), and the four GETs write disjoint slices via replace-style reducers"
          confidence: STATIC-INFERRED
          evidence: "App.tsx:46-51 + index.tsx:53-72"
        - q: "Is the call replay-safe?"
          a: "Yes — all four are idempotent GETs; a remount (full reload) simply re-fetches and replaces"
          confidence: STATIC-INFERRED
          evidence: "appInfo.thunks.ts:6-13, profile.thunks.ts:6-10, dataentities.thunks.ts:28-33, tags.thunks.ts:13-29"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "The redux store IS the cache and has NO TTL: features/classes live for the tab lifetime with no refresh dispatch anywhere (sole-dispatcher greps in bugs entry); identity refreshes only on owner-association. Staleness window = until the user reloads"
          confidence: STATIC-INFERRED
          evidence: "grep dispatch(fetchActiveFeatures|fetchDataEntitiesClassesAndTypes across <odd-platform-repo>/odd-platform-ui/src → App.tsx only; OwnerAssociationForm.tsx:128"
  request_inputs:
    - location: "App.tsx:61-64"
      input_kind: path-param
      input_name: "searchId"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "Identifies an existing server-side search session (a search_facets row) to restore — the shareable-URL contract the live docs describe"
          confidence: STATIC-INFERRED
          evidence: "App.tsx:63 + live doc quote in docs_link_semantic"
        - q: "When supplied, what does the implementation USE it for?"
          a: "Route declares it as a named param; Search reads it via useSearchRouteParams (useParams cast, searchRoutes.ts:18-19) and drives the session-restore calls; the backend hop is the Search node's chain"
          confidence: REFERENCE
          evidence: "searchRoutes.ts:14-19; full chain → Search component sidecar"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES (post-#1760). Historical TRANSLATES_SILENTLY: from #1551 (Dec 2023) to this commit the mount was `/search/*`, a splat that NEVER populates named params — searchId was silently undefined and every cold deep-link created a fresh session; fixed here, pinned by IT-125"
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "App.tsx:61-64 (current); <odd-team>/contributor/CTRIB-005.md (history)"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A at HEAD (historical consequence: shared link opened an empty fresh session — exactly the live-doc drift recorded above)"
          confidence: STATIC-INFERRED
          evidence: "<odd-team>/contributor/CTRIB-005.md"
        - q: "Available-but-unused column/field matching the name?"
          a: "NONE — the param is consumed by exactly the hook that promises it"
          confidence: STATIC-INFERRED
          evidence: "searchRoutes.ts:18-19"
      routes_to_finding: "docs_link_semantic.doc_drift_findings.[0]"
    - location: "App.tsx:66-69"
      input_kind: path-param
      input_name: "termSearchId"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "Identifies an existing term-search session to restore"
          confidence: STATIC-INFERRED
          evidence: "App.tsx:68"
        - q: "When supplied, what does the implementation USE it for?"
          a: "Named param read by useTermsRouteParams (termsRoutes.ts:54-62) in the TermSearch flow"
          confidence: REFERENCE
          evidence: "termsRoutes.ts:54-62; chain → TermSearch sidecar"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES (post-#1760; same historical splat class as searchId, fixed in the same commit, pinned by IT-125)"
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "App.tsx:66-69"
        - q: "For TRANSLATES_SILENTLY: consequences?"
          a: "N/A at HEAD (historical: fresh empty term-search session per cold link)"
          confidence: STATIC-INFERRED
          evidence: "<odd-team>/contributor/CTRIB-005.md"
        - q: "Available-but-unused?"
          a: "NONE"
          confidence: STATIC-INFERRED
          evidence: "termsRoutes.ts:54-62"
      routes_to_finding: "docs_link_semantic.doc_drift_findings.[0]"
    - location: "App.tsx:72-74"
      input_kind: path-param
      input_name: "termId"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "Numeric id of a term whose details page to show"
          confidence: STATIC-INFERRED
          evidence: "App.tsx:73"
        - q: "When supplied, what does the implementation USE it for?"
          a: "useTermsRouteParams parseInt(termId, 10) (termsRoutes.ts:60) feeds the term-details fetches"
          confidence: REFERENCE
          evidence: "termsRoutes.ts:54-62; downstream handling → TermDetails sidecar"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES, with weak validation: a non-numeric segment parses to NaN and flows into API paths as 'NaN' — error shape is the consuming page's concern"
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "termsRoutes.ts:60"
        - q: "TRANSLATES_SILENTLY consequences?"
          a: "N/A"
          confidence: STATIC-INFERRED
          evidence: "termsRoutes.ts:54-62"
        - q: "Available-but-unused?"
          a: "NONE"
          confidence: STATIC-INFERRED
          evidence: "termsRoutes.ts:44-52"
      routes_to_finding: ""
    - location: "App.tsx:75-77"
      input_kind: path-param
      input_name: "dataEntityId"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "Numeric id of a data entity whose details page to show"
          confidence: STATIC-INFERRED
          evidence: "App.tsx:76"
        - q: "When supplied, what does the implementation USE it for?"
          a: "useDataEntityRouteParams parseInt(dataEntityId, 10) (dataEntitiesRoutes.ts:53) feeds all detail-page fetches"
          confidence: REFERENCE
          evidence: "dataEntitiesRoutes.ts:47-58; downstream → DataEntityDetails sidecar"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES, same NaN-on-non-numeric caveat as termId"
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "dataEntitiesRoutes.ts:53"
        - q: "TRANSLATES_SILENTLY consequences?"
          a: "N/A"
          confidence: STATIC-INFERRED
          evidence: "dataEntitiesRoutes.ts:47-58"
        - q: "Available-but-unused?"
          a: "NONE"
          confidence: STATIC-INFERRED
          evidence: "dataEntitiesRoutes.ts:31-45"
      routes_to_finding: ""
  probes_emitted:
    - probe_id: P-245
      question: "With no path='*' catch-all, what exactly does a user see at an unmatched URL — toolbar + blank main, no redirect, no 404 affordance?"
      probe_path: "lineage/odd-platform/probes/P-245.yaml"
  stress_summary:
    triggers_total: 14
    questions_total: 44
    answers_static_inferred: 32
    answers_probe_needed: 1
    answers_reference: 11
    drift_flags: 2
```

## security

- auth_mode_relevance: `LOGIN_FORM | OAUTH2 | LDAP | DISABLED` — App is the post-gate UI surface under all four modes; it contains no mode branching of its own (App.tsx:1-102 — no auth imports, no login route). Whether the shell is served at all is decided server-side; specifics are REFERENCE to the backend security-configuration sidecars.
- ingestion_filter_relevance: `NO — UI/API surface, not ingestion`.
- authorization_assertions: none ENFORCED at this node. One permission CONTEXT provision: `WithPermissionsProvider(allowedPermissions=[LOOKUP_TABLE_CREATE, LOOKUP_TABLE_UPDATE, LOOKUP_TABLE_DELETE], resourcePermissions=[])` — evidence: App.tsx:84-92; the provider never blocks rendering (WithPermissionsProvider.tsx:30-39).
- owner_scoping: `N/A — code is not data-scoped` (the shell routes; per-page data scoping is each page's + the backend's concern).
- data_exposure:
  - "Identity payload (username, owner association, global permissions) → fetched into the redux store for any session that can load the SPA, all auth modes" — evidence: App.tsx:48 + profile.thunks.ts:6-10 (`GET /api/identity/whoami`, IdentityApi.ts:40)
  - "Active feature flags + entity-class dictionary + first 10 tags → same audience" — evidence: App.tsx:47-50 + FeatureApi.ts:40 + DataEntityApi.ts:1054 + TagApi.ts:156
- known_security_gaps: [] — the only candidate (all pages, including lookup-tables, render without client-side permission checks) is the deliberate read-collaborative posture, routed to `implicit_adrs` with its intent anchor; enforcement is server-side per endpoint.

## performance

- hot_paths:
  - "Boot effect fires 4 parallel GETs on EVERY SPA cold load, regardless of which route the user opens (deep links included)" — evidence: App.tsx:46-51
- throughput_characteristics:
  - "All 12 page components are lazy chunks: first navigation into each section downloads its JS chunk with AppLoadingPage as the visible fallback; subsequent visits are cache-served" — evidence: App.tsx:30-41 + AppSuspenseWrapper.tsx:14-20
- resource_allocation:
  - "Boot reference data (classes dictionary, identity, features, 10 tags) held in the redux store for the tab lifetime — small payloads, no growth path at this node" — evidence: App.tsx:46-51
- scaling_characteristics:
  - "Stateless shell — all state is per-tab; no locks, no shared mutable resources" — evidence: App.tsx:43-100
- known_performance_gaps:
  - "One avoidable request per SPA load: the boot `GET /api/tags?page=1&size=10` whose payload no surface renders before overwrite (full trace in bugs entry)" — evidence: App.tsx:50 + TagsList.tsx:45 — severity: LOW

## upstream_callers

- entry_point: "boot:SPA root render (index.tsx)"
  caller_node: "ts react-entry:index.tsx (root.render under QueryClientProvider/Provider/BrowserRouter)"
  multiplicity_per_trigger: 1
  evidence: "index.tsx:53-72 — single createRoot render mounts <App /> once per page load; NO React.StrictMode wrapper, so the App.tsx:46-51 effect (empty dep array) fires exactly once even in dev — no LSN-017-class doubling"
  observation_class: boot-eval

(Every `ui_route:*` entry point in the system transits App — it owns the route mount — but the route-specific callers belong to the page components' sidecars; App's own trigger is exactly the page load.)

## downstream_side_effects

- side_effect_class: external-call
  description: "Four boot GETs per page load: /api/dataentities/classes, /api/identity/whoami, /api/features/active, /api/tags?page=1&size=10 (the last via the misleadingly-named getPopularTagList client method)"
  evidence: "App.tsx:47-50 + DataEntityApi.ts:1054 + IdentityApi.ts:40 + FeatureApi.ts:40 + TagApi.ts:156"
  cardinality_per_call: 4
  reachable_from_entry_points:
    - "boot:SPA load (any URL — deep links included)"
  (backend-side effects of these four endpoints — e.g. whether whoami writes anything — are `unresolved: true` references to the corresponding backend controller sidecars)

- side_effect_class: cache-mutate
  description: "Four redux slices written on fulfilment: dataEntities (classes/types dictionary), profile (identity + owner + global permissions — feeds ALL PermissionContext gating), appInfo (active features — feeds ALL WithFeature gating), tags (10 entries, replaced)"
  evidence: "App.tsx:47-50 + profile.selectors.ts:17-20 + WithFeature.tsx:20-25 + tags.slice.ts:21-32"
  cardinality_per_call: "4 (1 per slice; 0 for any slice whose fetch failed — failure leaves initial state)"
  reachable_from_entry_points:
    - "boot:SPA load (any URL)"

- side_effect_class: page-render
  description: "Renders the persistent chrome (Toaster bottom-right, AppToolbar, 48px content offset) plus exactly one route-matched lazy page inside the Suspense boundary; unmatched URLs render chrome with a null outlet"
  evidence: "App.tsx:54-98"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "boot:SPA load (any URL)"

## sources

- understanding ← App.tsx:1-102 + index.tsx:53-72 + ManagementRoutes.tsx:28 + AlertsRoutes.tsx:11-18 + DirectoryRoutes.tsx:10-13 + DataModellingRoutes.tsx:15-16
- concepts.entities ← App.tsx:13-27,30-41,59-95
- concepts.invariants ← App.tsx:46-51,61-77 + index.tsx:53-72 + WithPermissionsProvider.tsx:30-39
- dependencies_semantic.requires-feature ← App.tsx:47-50 + FeatureApi.ts:40 + IdentityApi.ts:40 + DataEntityApi.ts:1054 + TagApi.ts:156
- dependencies_semantic.coupling ← profile.selectors.ts:17-20 + PermissionProvider.tsx:17 + OwnerAssociationForm.tsx:128
- tests_coverage_semantic.covered_behaviours ← <odd-team>/integration-tests/e2e/specs/search-session-not-found.spec.ts:35-108
- tests_coverage_semantic.uncovered_behaviours.[2] ← grep `components/App` across <odd-platform-repo>/odd-platform-ui/src → index.tsx:22 (sole importer; no test file)
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/features/data-discovery/search (200, 2026-06-11; note `…/data-discovery/search` without the `/features/` prefix is 404)
- docs_link_semantic.inferred_docs.[1] (pending_release) ← <odd-team>/backlog/docs/DOC-444.md + <odd-team>/contributor/CTRIB-005.md:335-343
- docs_link_semantic.doc_drift_findings ← live fetched_excerpts (above) + <odd-team>/contributor/CTRIB-005.md + App.tsx:61-69
- implicit_adrs.[0] ← App.tsx:29-41,58 + AppSuspenseWrapper.tsx:14-20
- implicit_adrs.[1] ← App.tsx:61-80 + ManagementRoutes.tsx:28 + AlertsRoutes.tsx:11 + DirectoryRoutes.tsx:10-13 + DataModellingRoutes.tsx:15
- implicit_adrs.[2] ← App.tsx:47-50 + handleResponseThunk.ts:24-43
- implicit_adrs.[3] ← App.tsx:81-94 + WithPermissionsProvider.tsx:12-49 + PermissionProvider.tsx:39-43 + documentation SUMMARY.md:130 (ADR-0003 title, local repo)
- bugs_limitations_corner_cases.[0] ← App.tsx:46-51 + errorHandling.tsx:58-79 (line 77 `if (response?.status)`) + handleResponseThunk.ts:34-42 + WithFeature.tsx:20-35 + profile.selectors.ts:17-20
- bugs_limitations_corner_cases.[1] ← App.tsx:59-95
- bugs_limitations_corner_cases.[2] ← App.tsx:72-77 + ToolbarTabs.tsx:34-105
- bugs_limitations_corner_cases.[3] ← App.tsx:50 + tags.thunks.ts:13-29 + tags.slice.ts:21-32 + tags.selectors.ts:16-20 + TagsList.tsx:37-58
- bugs_limitations_corner_cases.[4] ← App.tsx:46-51 + OwnerAssociationForm.tsx:128
- bugs_limitations_corner_cases.[5] ← index.tsx:30-48 + handleResponseThunk.ts:34-42
- security.auth_mode_relevance ← App.tsx:1-102 (absence of auth branching, file read end-to-end)
- security.authorization_assertions.[0] ← App.tsx:84-92 + WithPermissionsProvider.tsx:30-39
- security.data_exposure ← App.tsx:47-50 + generated client paths (FeatureApi.ts:40, IdentityApi.ts:40, DataEntityApi.ts:1054, TagApi.ts:156)
- performance.hot_paths.[0] ← App.tsx:46-51
- performance.known_performance_gaps.[0] ← App.tsx:50 + TagsList.tsx:45
- upstream_callers.[0] ← index.tsx:53-72 + App.tsx:46-51
- downstream_side_effects.[0] ← App.tsx:47-50 + the four generated-client path anchors above
- downstream_side_effects.[1] ← App.tsx:47-50 + tags.slice.ts:21-32 + WithFeature.tsx:20-25 + profile.selectors.ts:17-20
- downstream_side_effects.[2] ← App.tsx:54-98
- stress_findings (all entries) ← anchors inline per question

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH — live page fetched this session (200) with verbatim excerpts; drift entries cross-tracked to DOC-444
- implicit_adrs: MEDIUM — entries [1] and [3] rest on convention-as-intent; no in-file WHY comments beyond `// lazy elements`
- bugs_limitations_corner_cases: HIGH — every chain traced hop-by-hop with named grep scopes for the absence claims
- security: HIGH for what the node does NOT do (no client gate — file read end-to-end); REFERENCE for server-side specifics
- performance: HIGH
- upstream_callers: HIGH — single mount site, multiplicity statically pinned (no StrictMode, empty dep array)
- downstream_side_effects: MEDIUM — UI-side cardinalities are HIGH-confidence; backend-side effects of the four GETs are unresolved references to backend sidecars
- stress_findings: HIGH — 32/44 STATIC-INFERRED with anchors; the single PROBE-NEEDED (P-245) is a composite-UX pin, not a load-bearing unknown; 11 REFERENCE answers are genuinely other nodes' questions

## Maintainer notes


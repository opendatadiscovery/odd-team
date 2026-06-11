---
node_id: "odd-platform ts components/Terms/TermSearch react-component:TermSearch"
node_kind: react-component
axis: ui_components
extracted_at_commit: 074c9927
enriched_at_commit: 074c9927   # branch contrib/CTRIB-005-search-session-not-found — the #1760 fix is NOT yet on odd-platform main
extractor_version: 0.1.0
prompt_version: file-analyser/0.5.0
schema_version: v0.5.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-06-11-TermSearch-refresh
feature_hint: "P-06:F-001 (Data Glossary pillar Dictionary tab) — UI orchestrator for the term-search session at /termsearch. REFRESHED for the #1760 fix (CTRIB-005): nested routes (deep-link restore is now real) + graceful expired-session state (SearchSessionExpired on 404, AppErrorPage otherwise). Mirrors Search.tsx (catalog search) — the mirror comment is in-source at TermSearch.tsx:46-47."
related_features:
  - F-002
  - F-017   # search-session class (IT-125 grounds both /search and /termsearch on the #1760 contract)
related_pillar_features:
  - "P-06:F-001"
related_retrospectives:
  - LSN-017   # dep-array class — two latent smells re-verified at the new line numbers; cardinality probe emitted (P-246)
  - LSN-018   # coherence sweep against F-002 / F-010 / sibling sidecars
related_issues:
  - "#1760 (PLT-150) — dead search deep-links; fixed by CTRIB-005 (this commit)"
---

# TermSearch (Dictionary tab — Terms browse/search surface) — semantic understanding

## understanding

`TermSearch.tsx` (127 lines at 074c9927) is the Data Glossary **Dictionary tab** root component, mounted by nested routes `/termsearch` (index) + `/termsearch/:termSearchId` (App.tsx:66-69 — changed by the #1760 fix from the old `'/termsearch/*'` splat, which had silently dropped the `:termSearchId` param since #1551 so every deep-link used to create a replacement session). It orchestrates a **server-side search session** (wire API `POST/GET/PUT /api/terms/search[/{search_id}]` → `TermController` → `TermSearchService`; note the UI route says `/termsearch` but the API path is `/api/terms/search` — the previous sidecar revision mis-recorded the wire path as `/api/termsearch`): create-on-cold-mount + navigate-to-UUID (lines 62-71), restore-from-URL (lines 73-76), debounced facet-delta PUTs (lines 78-96), and the three-child layout (filters sidebar / header gated-create / results list, lines 106-123). NEW in this commit: a deep-linked session whose restore GET fails renders `SearchSessionExpired` with a working "Start new search" recovery when the failure is 404, and `AppErrorPage` with the real status otherwise (lines 46-60, 98-104) — the failure state is read from the global loader slice (`getTermSearchFetchStatuses` + `getTermSearchError`, the latter added in this commit), not from the termSearch slice, which still has no `.rejected` reducers.

## concepts

- entities:
  - "TermSearchFacetsData (OpenAPI DTO `{search_id, query, facet_state, total}` — returned by all three session endpoints; built server-side at TermSearchServiceImpl.java:113-119)"
  - "TermSearchFormData (OpenAPI DTO — schema declares ONLY `query` + `filters` (required), odd-platform-specification/components.yaml:2659-2680; the UI's `pageSize` field is NOT in the schema — see bugs[5])"
  - "Server-side search-session row (`search_facets` table — INSERT per create at ReactiveSearchFacetRepositoryImpl.java:76-82; plain last-write-wins UPDATE per facet PUT at :85-96, which also bumps LAST_ACCESSED_AT — the housekeeping TTL clock)"
  - "ErrorState `{status, statusText, url, message}` (lib/errorHandling.tsx:30-35 — built by `getErrorResponse` after unwrapping the generated client's ResponseError via `toResponse`, errorHandling.tsx:14-18) — stored per act-type in `state.loader.errors` (loader.slice.ts:42-49), read here via `getTermSearchError` (termSearch.selectors.ts:34)"
  - "SearchSessionExpired (shared element, components/shared/elements/SearchSessionExpired/SearchSessionExpired.tsx — copy: 'This search has expired' + 'The search link you followed has expired or does not exist…' + 'Start new search' CTA; in-source intent comment at lines 12-13: 'the link is dead data, not a platform fault')"
  - "AppErrorPage (shared element — renders `error.status` + `statusText || 'Unknown Error'` + Home link, AppErrorPage.tsx:20-38)"
  - "Permission.TERM_CREATE (injected via WithPermissionsProvider at TermSearch.tsx:113-118; consumed by WithPermissions at TermSearchHeader.tsx:17-23 — hide-not-disable)"
  - "useTermsRouteParams / termsSearchPath (routes/termsRoutes.ts:54-63, 12-19)"
- operations:
  - "Cold mount, no URL param, no redux session → `createTermSearch({query:'', pageSize:30, filters:{}})` → `.unwrap().then(navigate(searchId))` (relative navigate — only ever executed from the index route) (TermSearch.tsx:62-71)"
  - "URL param present, redux empty → `getTermsSearch({searchId: routerTermSearchId})` → GET /api/terms/search/{search_id} (TermSearch.tsx:73-76); 404 path → expired state (below)"
  - "Deep-link restore failure branch: `isDeepLinkNotLoaded = !termSearchId && !!routerTermSearchId && isTermSearchNotLoaded` (lines 48-49); `status === 404` → `<SearchSessionExpired onStartNewSearch={handleStartNewTermSearch}/>` (98-100); any other captured status → `<AppErrorPage showError error={termSearchError}/>` (102-104)"
  - "Recovery: `handleStartNewTermSearch` (53-60) = `resetLoaderByAction(getTermsSearchActType)` (clears the rejected status + error so the branches drop, loader.slice.ts:18-24) + `createTermSearch({query:'', filters:{}})` + ABSOLUTE `navigate(termsSearchPath(newId))` (line 58 — absolute because the handler executes from the `:termSearchId` route, unlike effect 1's relative navigate which executes only from the index route)"
  - "Facet change → `!termSearchFacetsSynced` guard → `updateSearchFacets()` debounced 1500 ms leading-edge (78-96) → PUT with `filters` = ONLY the unsynced facet options (the selector pickBy at termSearch.selectors.ts:98-102) — a DELTA, merged server-side (see invariants)"
  - "Layout: filters xs=3 (110) / WithPermissionsProvider[TERM_CREATE] → TermSearchHeader (113-118) / TermSearchResults xs=9 (119)"
- invariants:
  - "**Deep-link restore is real as of this commit.** Nested `<Route path='/termsearch'>` + index + `:termSearchId` children both rendering `<TermSearch/>` (App.tsx:66-69). Pre-fix, the `'/termsearch/*'` splat meant `useParams().termSearchId` was ALWAYS undefined → effect 1 silently created a replacement session for every deep-link. e2e-pinned by IT-125 (integration-tests/e2e/specs/search-session-not-found.spec.ts:108-122 — asserts GET /api/terms/search/{id} fires and returns 200 on cold navigation, and the missing-UUID path shows the expired state)."
  - "**PUT `filters` is a MERGE-PATCH, not a replacement.** The UI sends only unsynced options (selectors.ts:98-102); the backend maps them to a `FacetStateDto delta` and runs `FacetStateDto.merge(currentState, delta)` (TermSearchServiceImpl.java:82-90): selected=true adds/keeps, selected=false removes (FacetStateDto.java:51-66). Consequence the previous sidecar revision got WRONG: `TermSearchInput`'s synchronous PUT with `filters:{}` (TermSearchInput.tsx:26-27) does NOT clear facet selections — an empty delta is a facet no-op. The QUERY, by contrast, is replaced wholesale on every PUT (`delta.getQuery()`, FacetStateDto.java:48)."
  - "**The expired-state gate keys on status 404 only.** `NotFoundException(\"Search not found\")` (TermSearchServiceImpl.java:108-111) → 404 USR002 → SearchSessionExpired. 401/403/5xx → AppErrorPage with the real status; a network error with no Response → `status` undefined → AppErrorPage renders empty code + 'Unknown Error' fallback (AppErrorPage.tsx:25-30)."
  - "**Create CTA permission-gated UI-only; list/search/filters ungated.** WithPermissions returns null without TERM_CREATE (WithPermissions.tsx:27-31); the results list renders unconditionally for every authenticated user (TermSearchResults.tsx:98-103). Read-collaborative posture inherited from the repository tier (F-002 batch-N: no per-namespace / per-owner read filter) — now ALSO documented on the live doc page (fetched this session): 'namespace is not a read-time isolation boundary'."
  - "**The effective page size is the child's literal, not the form field.** `size = 30` at TermSearchResults.tsx:38 drives the results GET. The `pageSize: 30` in the create payloads (TermSearch.tsx:64, TermSearchInput.tsx:26, ToolbarTabs.tsx:109) is a dead field — see bugs[5]."
  - "**Default Dictionary view lists the whole catalog paginated, not an empty table.** Empty query → no FTS condition → `findByState` returns all non-deleted terms ordered `TERM.ID ASC` (ReactiveTermRepositoryImpl.java:277-292); the child auto-fetches page 1 on session sync (TermSearchResults.tsx:52-61). The live doc page claims the opposite — see doc_drift_findings[0]."
- audiences:
  - "platform-operator / data-steward — term curation surface; any authenticated user under LOGIN_FORM/OAUTH2/LDAP (or anyone under DISABLED)"
  - "data-engineer-analyst — business-glossary authors and read-only consumers"
  - "odd-platform-ui-end-user — top-nav Dictionary tab (ToolbarTabs.tsx:65-69)"

## dependencies_semantic

- requires-feature:
  - "F-002 / P-06:F-001 Term-to-Entity Linkage — this UI is the operator entry point for the term-catalog half; auth/scoping decisions live in the controller/service/repository tiers F-002 tracks"
  - "F-017 search-session contract (#1760) — the expired-session UX + nested-route fix are the SAME class as catalog search; the in-source comment declares the mirror (TermSearch.tsx:46-47); Search.tsx:48-100 carries the identical structure"
  - "F-010 / P-08:F-002 Housekeeping — `SearchFacetsHousekeepingJob` evicts stale `search_facets` rows; eviction is keyed on LAST_ACCESSED_AT (bumped by every facet PUT, ReactiveSearchFacetRepositoryImpl.java:89); an evicted UUID is the main producer of the 404 → expired state"
  - "P-09 Authorization framework — Permission.TERM_CREATE is one of 7 TERM_* permissions (live doc table re-verified this session)"
- requires-config:
  - "(none operator-controllable) — 1500 ms debounce (TermSearch.tsx:88), xs 3/9 split (109/112), child size=30 (TermSearchResults.tsx:38) are build-time literals; the form-data `pageSize` literal is inert (bugs[5])"
- requires-runtime:
  - "React 18 (useEffect/useCallback), Redux Toolkit (termsSearchSlice + global loader slice), react-router-dom v6 nested routes (App.tsx:66-69), use-debounce (1500 ms leading), lodash mapValues/values, generated-sources API client (TermSearchFormDataToJSON serializer — load-bearing for bugs[5]), @tanstack react-query is NOT used by this component (TermsForm uses it for invalidation)"
- couples-to:
  - "TermSearchFilters (child — reads/writes facetState via Redux; no props)"
  - "TermSearchHeader → TermSearchInput (synchronous query PUT on Enter/click, TermSearchInput.tsx:25-28, 33-35) + TermsForm (create dialog; ALSO fires a `size: 1000` results fetch into the SHARED results slice — bugs[4])"
  - "TermSearchResults (infinite scroll, page-1 auto-fetch on sync, empty-state copy 'No matches found' at :105-107)"
  - "ToolbarTabs (top-nav Dictionary click creates a FRESH session every click — ToolbarTabs.tsx:107-119; this component's create effect is NOT the only session creator)"
  - "Server: POST /api/terms/search → TermController.termSearch (TermController.java:200-206); GET /api/terms/search/{search_id} → getTermSearchFacetList (:178-182); PUT → updateTermSearchFacets (:208-216); GET .../results → getTermSearchResults (:184-191) (paths verified against odd-platform-specification/openapi.yaml:2982-3107)"

## tests_coverage_semantic

- covered_behaviours:
  - behaviour: "Deep-link to a VALID /termsearch/{uuid} actually loads the session (GET /api/terms/search/{id} fires and returns 200 — the #1551 splat-regression pin)"
    test_class: integration
    test_files: ["integration-tests/e2e/specs/search-session-not-found.spec.ts:108-115 (odd-team workspace; IT-125)"]
  - behaviour: "Deep-link to a MISSING /termsearch/{uuid} renders the graceful 'This search has expired' state"
    test_class: integration
    test_files: ["integration-tests/e2e/specs/search-session-not-found.spec.ts:117-121 (IT-125)"]
  - behaviour: "Missing-session backend reads are uniformly 404 USR002; 'Start new search' recovery navigates to a fresh session URL — asserted for the /search surface; the /termsearch recovery button is NOT separately asserted (same handler shape, different component)"
    test_class: integration
    test_files: ["integration-tests/e2e/specs/search-session-not-found.spec.ts:36-47, 62-78"]
- uncovered_behaviours:
  - behaviour: "Facet-click PUT cardinality: 5 rapid facet clicks within 1500 ms produce N PUTs (intended ≤2 with leading+trailing; static analysis says ~5 because the debouncer is recreated per facet change)"
    test_class: integration
    criticality: HIGH
    note: "Probe P-246 emitted this session (LSN-017 measurement-truth class)"
  - behaviour: "TermSearch recovery button on /termsearch/{missing}: click → resetLoaderByAction + create + absolute navigate → expired state clears and URL carries the new UUID"
    test_class: integration
    criticality: MEDIUM
    note: "IT-125 asserts this flow for /search only (spec lines 70-77); the termsearch test stops at expired-state visibility"
  - behaviour: "createTermSearch failure on cold mount (network/5xx): user sees the error toast but the page stays blank; no retry affordance"
    test_class: integration
    criticality: MEDIUM
  - behaviour: "TermsForm size-1000 fetch vs child size-30 fetch race on mount for a TERM_CREATE user — visible list cardinality + duplicate rows at >1000-term catalogs"
    test_class: integration
    criticality: MEDIUM
    note: "Probe P-247 emitted this session"
  - behaviour: "Expired/error branch selection logic (404 → SearchSessionExpired; 500 → AppErrorPage; no-status → AppErrorPage 'Unknown Error') as a pure-render unit test over mocked selector states"
    test_class: unit
    criticality: MEDIUM
  - behaviour: "Toolbar Dictionary-tab click always creates a NEW session (server-row churn) even when a live session exists in Redux"
    test_class: integration
    criticality: LOW
- test_files:
  - "integration-tests/e2e/specs/search-session-not-found.spec.ts (odd-team; IT-125 — re-grounded 2026-06-11 per its header, lines 3-25)"
  - "Zero co-located unit tests: no *.test.* under odd-platform-ui/src/components/Terms/TermSearch/ (Glob over that subtree this session returned 12 .tsx sources, no test files)"
- gaps: |
    The headline #1760 contract is now integration-pinned (IT-125), which is the right
    bucket — the regression was a route-wiring + error-translation chain no unit test
    could see. The worst remaining hole is integration-class: dispatch cardinality
    (debouncer recreation, P-246) and the shared-slice race (P-247) are exactly the
    LSN-017 shape where only counting real network calls tells the truth. Unit-class
    coverage of the new branch logic (lines 46-60, 98-104) would pin the 404-vs-other
    discrimination cheaply.

## docs_link_semantic

- declared_docs: []   # no @docs annotation in the source (grep '@docs' over the file returned nothing this session)
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-glossary/business-glossary"
    anchor: ""
    rationale: "The Dictionary-tab reference. Live page (re-fetched this session) now describes the server-side faceted-search session, the session-shared /termsearch/{uuid} URL, the TERM_* permission table, the namespace non-isolation posture, AND the 1500 ms facet rate-limit caveat — i.e. it has absorbed most of the gaps the 2026-05-20 enrichment flagged (old UI-DOC-GAP D/E/G/H: facet sidebar, search affordance, read-collaborative posture, URL share-ability — all now present)."
    last_verified_at: "2026-06-11"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      "the catalog-wide entry point for browsing and curating terms" … "implemented as a
      server-side faceted-search session rather than a flat list" … "Create a new term
      (gated by TERM_CREATE)" … "[namespace is] not a read-time isolation boundary —
      Every authenticated user sees every term from every namespace in Dictionary search
      results" … "[the URL is] session-shared — sharing the URL with a colleague gives
      them the same session view, including any filters and pagination state. … Treat the
      URL as a working-view share, not as a deep-link to fixed results." … "lands you on a
      results page with an empty results table until you either type a query, apply a
      facet filter, or use the platform's term-listing API directly" … "The Dictionary
      tab's facet rate-limit (1500 ms) does not function as intended."
  - url: "https://docs.opendatadiscovery.org/features/data-glossary"
    anchor: ""
    rationale: "P-06 pillar landing — names the top-nav Dictionary tab and routes readers to business-glossary for the full reference. No search-session / expired-link content (verified ABSENT this session)."
    last_verified_at: "2026-06-11"
    last_verified_status: 200
    confidence: MEDIUM
- doc_drift_findings:
  - "**Empty-results-table claim is code-contradicted (MEDIUM).** Live business-glossary says opening the Dictionary 'lands you on a results page with an empty results table until you either type a query, apply a facet filter…'. The code auto-fetches page 1 as soon as the fresh session syncs (TermSearchResults.tsx:52-61) and an empty-query/empty-filter state matches ALL non-deleted terms ordered TERM.ID ASC (ReactiveTermRepositoryImpl.java:277-292; countByState drives total the same way) — the default view is the first 30 terms of the whole catalog, oldest-id first."
  - "**'…including any filters and pagination state' overstates URL sharing (LOW).** The restored session carries query + facetState + total only (getFacetsData, TermSearchServiceImpl.java:113-119); the slice resets results to page 0 on restore (termSearch.slice.ts:85-88) and the recipient re-paginates from page 1. Filters: yes; pagination position: no."
  - "**The #1760 expired-session UX and the deep-link restore fix are not yet documented — correctly so.** The behaviour exists only on the contrib branch (commit 074c9927, PR for #1760); per the release-train rule the doc update rides the milestone train when the fix merges and releases. Flagging so doc-gap-finder schedules it rather than treating live-doc silence as a miss today."
  - "**Coherence note (no drift):** the live page's caveat 'The Dictionary tab's facet rate-limit (1500 ms) does not function as intended' AGREES with the code defect (bugs[2]) — docs and code are aligned on the bug's existence."

## implicit_adrs

- "**Dead deep-links are a graceful product state, not an error.** A 404 on session restore renders an explanation + recovery CTA instead of an error page; every other status stays an error. The discrimination is deliberate and commented in BOTH this component and the shared element." — evidence: TermSearch.tsx:46-51 + SearchSessionExpired.tsx:12-13 — intent_anchor: "Mirror of the catalog search dead-link handling (#1760): a deep-linked term-search session that 404s is an expired link, not a platform fault." (TermSearch.tsx:46-47) — confidence: HIGH
- "**Error state is owned by the global loader slice, not the feature slice.** The termSearch slice has no `.rejected` reducers (termSearch.slice.ts:193-228 — fulfilled-only, re-verified); failure status + ErrorState are captured generically by act-type matchers (loader.slice.ts:42-49) and read back via createStatusesSelector/createErrorSelector (loader-selectors.ts:7-22). Recovery = `resetLoaderByAction` deleting both keys (loader.slice.ts:18-24). The #1760 fix EXTENDED this pattern (added `getTermSearchError`) rather than adding rejected reducers to the feature slice." — evidence: termSearch.selectors.ts:26-34 + loader.slice.ts:18-49 + TermSearch.tsx:54 — intent_anchor: the generic `/pending|/fulfilled|/rejected` suffix matchers ARE the convention; the new selector composes them instead of bypassing them — confidence: HIGH
- "**Server-side URL-backed session with merge-patch updates.** Session persisted in `search_facets`, UUID in the URL, facet PUTs are deltas merged server-side (`FacetStateDto.merge`, variable literally named `delta` at TermSearchServiceImpl.java:83). The delta contract is why the UI can send only unsynced options and why concurrent facet PUTs are additive rather than destructive (modulo the read-merge-write window, stress E2)." — evidence: TermSearch.tsx:62-76 + termSearch.selectors.ts:98-102 + TermSearchServiceImpl.java:82-90 + FacetStateDto.java:41-66 — intent_anchor: "final FacetStateDto delta = facetStateMapper.mapForm(formData);" — confidence: HIGH
- "**Permission-gated Create CTA via render-null (UI hide, not enforcement).** WithPermissionsProvider injects context and always renders (WithPermissionsProvider.tsx:12-49, verified passthrough); the inner WithPermissions returns null without TERM_CREATE (WithPermissions.tsx:27-31). Backend enforcement is a separate layer." — evidence: TermSearch.tsx:113-118 + TermSearchHeader.tsx:17-23 — intent_anchor: the Provider/consumer split API shape (Component | render | children, always-render) — confidence: HIGH
- "**1500 ms leading-edge debouncer for facet mutations; text query fires synchronously.** Explicit `{leading: true}` (TermSearch.tsx:89); Enter/search-click dispatch immediately (TermSearchInput.tsx:25-35) — explicit intent does not wait." — evidence: TermSearch.tsx:78-92 + TermSearchInput.tsx:25-35 — intent_anchor: the `{ leading: true }` option — confidence: HIGH

## bugs_limitations_corner_cases

- "[0] **LSN-017-class dep smell #1 (latent): `termSearchId` read in effect-1's guard but missing from its deps.** Lines 62-71: deps `[routerTermSearchId, createTermSearch, isTermSearchCreating]`; the guard also reads `termSearchId` (line 63). Correct today because the create's fulfilment writes `termSearchId` (slice updateTermsSearchState) in the same React batch as the navigate-driven `routerTermSearchId` change; a refactor reordering those would surface a double-create. `createTermSearch` in deps is a stable import (no-op dep)." — evidence: TermSearch.tsx:62-71 + termSearch.slice.ts:76-90 — severity: MEDIUM
- "[1] **LSN-017-class dep smell #2 (active re-fire surface): facet-sync effect deps `[termSearchFacetParams]` while the guard reads `termSearchFacetsSynced`.** Lines 94-96. `getTermSearchFacetsParams` is a createSelector over `state.termSearch` whose body (mapValues+pickBy) builds a NEW object whenever the slice identity changes (termSearch.selectors.ts:98-102) — i.e. after EVERY termSearch slice action, not only facet edits. The effect therefore re-fires after every fulfilled response; the `isFacetsStateSynced: true` write on fulfilment (slice:84) makes the guard skip, bounding the damage. Dispatch cardinality per facet click is the runtime question → P-246." — evidence: TermSearch.tsx:94-96 + termSearch.selectors.ts:98-102 + termSearch.slice.ts:84 — severity: MEDIUM
- "[2] **Debouncer recreated on every facet change — the 1500 ms rate-limit does not rate-limit.** `useCallback(useDebouncedCallback(...), [termSearchId, termSearchFacetParams])` (lines 78-92): every facet click changes `termSearchFacetParams` → new debounced instance → `{leading: true}` fires immediately on each instance; the trailing window dies with the replaced instance. Net: ~1 PUT per click instead of coalescing. The live doc page now documents this caveat verbatim. NOTE: the merge-patch server contract (invariants) means the extra PUTs are additive deltas, not lost updates — the cost is load + the E2 race window, not facet loss." — evidence: TermSearch.tsx:78-92 — severity: MEDIUM
- "[3] **No `.catch` on either create chain — create failure leaves a blank page (toast only).** Effect 1 (lines 65-69) and the recovery handler (55-59) both `.unwrap().then(navigate)` with no catch. On rejection: `showServerErrorToast` fires from the thunk wrapper when a Response status exists (handleResponseThunk.ts:37-39 + errorHandling.tsx:77-79), the create-status rejection is recorded in the loader slice, but the render reads only `isTermSearchCreating` — the page stays blank with no retry affordance, and the unhandled rejection hits the console. The #1760 fix covered the RESTORE failure path, not the CREATE one." — evidence: TermSearch.tsx:53-71 + handleResponseThunk.ts:24-42 — severity: MEDIUM
- "[4] **TermsForm (mounted for every TERM_CREATE user) fetches `size: 1000` into the SHARED results slice on every mount and every facet-sync.** TermsForm.tsx:71-75: `fetchTermsSearchResults({searchId, page: 1, size: 1000})` whenever `searchId && isTermSearchFacetsSynced` — it races the child's page-1 size-30 fetch (TermSearchResults.tsx:52-61) on the same slice (last write wins; both replace items at page 1). Purpose: the client-side duplicate-name check (TermsForm.tsx:84-95) reads `getTermSearchResults`. Visible consequences: (a) double results GET per mount/facet-change for TERM_CREATE users; (b) the duplicate check sees at most 1000 terms AND only terms matching the CURRENT session's facet state — a duplicate outside the active filter or beyond row 1000 passes the check; (c) for >1000-term catalogs, a subsequent infinite-scroll fetch (page 2, size 30) appends rows 31-60 onto the 1000-item list — duplicate React keys. Owning node: TermsForm (this sidecar records the mount-tree cardinality; full enrichment belongs to the TermsForm node — REFERENCE, unresolved: true). Race outcome at runtime → P-247." — evidence: TermsForm.tsx:71-75, 84-95 + TermSearchResults.tsx:38-43, 52-61 + termSearch.slice.ts:197-206 — severity: MEDIUM
- "[5] **`pageSize: 30` in the form-data payloads is a dead field — it never reaches the wire.** The OpenAPI schema for TermSearchFormData declares only `query` + `filters` (components.yaml:2659-2680); the generated serializer emits only those two (generated-sources/models/TermSearchFormData.ts:68-79); the backend mapper reads only query+filters (FacetStateMapperImpl.java:106-130); `getPageSize()` has ZERO matches under odd-platform-api/src/main/java and `pageSize|page_size` ZERO under odd-platform-api/src/main/resources (both greps this session, scopes as named). The previous sidecar revision's invariant 'the session-server respects whatever the client sends, so the two 30-literals must stay aligned' is retracted: only TermSearchResults.tsx:38 is load-bearing. TS excess-property checking is bypassed because the literal flows through an intermediate const." — evidence: TermSearch.tsx:64 + TermSearchInput.tsx:26 + ToolbarTabs.tsx:109 + the four scoped citations above — severity: LOW
- "[6] **Top-nav Dictionary click ALWAYS creates a fresh session — server-row churn + lost working view.** ToolbarTabs.tsx:107-119: every click on the Dictionary tab dispatches `createTermSearch` and navigates to the new UUID, even when Redux already holds a live session. Each click INSERTs a `search_facets` row; the prior session is orphaned until housekeeping eviction, and a user who tabs away and clicks back loses their filters." — evidence: ToolbarTabs.tsx:107-119 + ReactiveSearchFacetRepositoryImpl.java:76-82 — severity: LOW
- "[7] **In-SPA navigation to the INDEX route with a hot Redux session shows an id-less URL.** Mount at `/termsearch` with `termSearchId` cached → effect 1 guard skips create, effect 2 guard skips restore → 0 network calls, previous session renders, but the URL stays `/termsearch` — not shareable until something navigates with the UUID (row-click back-nav does: TermDetails.tsx:50)." — evidence: TermSearch.tsx:62-76 — severity: LOW
- "[8] **Graceful expired page + red error toast render together.** The restore thunk passes `{}` options, so `showServerErrorToast` fires for the 404 (handleResponseThunk.ts:37-39; toast shown because `response.status` is truthy, errorHandling.tsx:77-79) at the same time as SearchSessionExpired's 'not a platform fault' framing. Cosmetic contradiction; `switchOffErrorMessage` exists for exactly this." — evidence: termSearch.thunks.ts:35-42 + errorHandling.tsx:58-80 + SearchSessionExpired.tsx:12-13 — severity: LOW
- "[9] **Cross-namespace term visibility at the row level (inherited, unchanged).** Every row renders `namespace.name` for all teams (TermSearchResultItem.tsx:36-37); no 'my namespace' affordance in the filters. Now openly documented on the live page (read-time non-isolation), so the residual concern is product posture, not doc drift." — evidence: TermSearchResultItem.tsx:36-37 + live business-glossary fetch this session — severity: LOW
- "[10] **`usingCount` flattens 3 server counts with no breakdown** (entities+columns+linkedTerms, TermSearchResultItem.tsx:20-23, 51-55); **empty-state copy 'No matches found' doubles as the fresh-deployment zero-terms state** (TermSearchResults.tsx:105-107). Both carried forward unchanged from the previous revision." — evidence: as cited — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "TermSearch.tsx:64 (also TermSearchInput.tsx:26, ToolbarTabs.tsx:109)"
      name: "termSearchFormData.pageSize"
      value: "30"
      questions:
        - q: "What at N=0 / N=1 / N=3000?"
          a: "No observable change at ANY value — the field is dropped by the generated serializer before the wire (TermSearchFormDataToJSON emits only query+filters) and the schema does not declare it. Dead input; see request_inputs[1]."
          confidence: STATIC-INFERRED
          evidence: "generated-sources/models/TermSearchFormData.ts:68-79 + components.yaml:2659-2680"
        - q: "What does the operator see at each boundary?"
          a: "Nothing — the effective page size is the results GET's size param (TermSearchResults.tsx:38 size=30; TermsForm.tsx:73 size=1000). Boundary behaviour of THOSE belongs to the child nodes."
          confidence: REFERENCE
          evidence: "node: TermSearchResults / TermsForm sidecars (unresolved)"
    - location: "TermSearch.tsx:88-89"
      name: "debounce interval, leading edge"
      value: "1500 ms, {leading: true}"
      questions:
        - q: "What at 5 facet clicks inside one 1500 ms window?"
          a: "Static trace: each click replaces the debounced instance (useCallback deps include termSearchFacetParams, line 91) → each new instance leading-fires → ~5 PUTs, no trailing coalesce. Runtime count not yet measured."
          confidence: PROBE-NEEDED
          evidence: "probe_id: P-246"
        - q: "What at exactly 1 click (the intended case)?"
          a: "1 immediate PUT (leading edge) — correct UX; the recreation bug is invisible at N=1."
          confidence: STATIC-INFERRED
          evidence: "TermSearch.tsx:78-92"
        - q: "What does the operator see at the overflow boundary?"
          a: "No error — N concurrent merge-patch PUTs; server state converges to the union unless the read-merge-write race drops a delta (resource_boundaries[1]); UI reconciles via assignFacetStateWithNewFacets keeping unsynced divergences."
          confidence: STATIC-INFERRED
          evidence: "TermSearchServiceImpl.java:82-90 + termSearch.slice.ts:61-84"
    - location: "TermSearch.tsx:51"
      name: "expired-state status gate"
      value: "404"
      questions:
        - q: "What at status 401/403/500?"
          a: "AppErrorPage with the real status + statusText (TermSearch.tsx:102-104; AppErrorPage.tsx:24-30). Not the expired page."
          confidence: STATIC-INFERRED
          evidence: "TermSearch.tsx:48-51, 102-104"
        - q: "What at a network error with NO Response object?"
          a: "getErrorResponse returns status undefined (errorHandling.tsx:30-35) → isTermSearchSessionExpired false → AppErrorPage renders an empty error code + 'Unknown Error' (the || fallback is commented in-source for empty HTTP/2 reason phrases, AppErrorPage.tsx:29-30). No toast (toast requires response.status, errorHandling.tsx:77-79)."
          confidence: STATIC-INFERRED
          evidence: "errorHandling.tsx:14-35, 77-79 + AppErrorPage.tsx:25-30"
  name_behavior_pairs:
    - name: "isTermSearchSessionExpired / SearchSessionExpired"
      promise: "the followed search link's session has expired"
      implementation: "ANY 404 on the deep-link restore — including UUIDs that never existed (foreign/typo). The UI copy explicitly covers both: 'has expired or does not exist'. Backend 404 source: NotFoundException('Search not found'), TermSearchServiceImpl.java:108-111."
      drift: NONE
      operator_visible_consequence: ""
      confidence: STATIC-INFERRED
      evidence: "TermSearch.tsx:50-51 + SearchSessionExpired.tsx:29-33"
    - name: "handleStartNewTermSearch"
      promise: "start a brand-new term search and land the user on it"
      implementation: "reset loader keys for the GET act-type → POST create → absolute navigate to /termsearch/{newId}. Matches; replay nuance in resource_boundaries[2]."
      drift: NONE
      operator_visible_consequence: ""
      confidence: STATIC-INFERRED
      evidence: "TermSearch.tsx:53-60"
    - name: "UI route '/termsearch' vs wire path '/api/terms/search'"
      promise: "(naming surface) a reader of the UI route or the thunk names would guess the API path is /api/termsearch"
      implementation: "the API is /api/terms/search[/{search_id}] (openapi.yaml:2982-3107). The PREVIOUS revision of this sidecar shipped the wrong wire path — corrected throughout this revision."
      drift: MINOR
      operator_visible_consequence: "None at runtime; documentation/debugging confusion only (curl against /api/termsearch returns the SPA fallback, not the API)."
      confidence: STATIC-INFERRED
      evidence: "openapi.yaml:2982-3107 + integration-tests/e2e/specs/search-session-not-found.spec.ts:109-115"
  orderings:
    - location: "ReactiveTermRepositoryImpl.java:277-292 (reached via this page's default fetch)"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer for the default (empty-query) Dictionary view?"
          a: "TERM.ID ASC only (line 292 — the unconditional order field). No FTS rank without a query. Default view = oldest-created terms first."
          confidence: STATIC-INFERRED
          evidence: "ReactiveTermRepositoryImpl.java:281-292"
        - q: "Tie-breaker when sort keys are equal?"
          a: "TERM.ID is unique — deterministic. With a query: rank DESC then TERM.ID ASC — also deterministic."
          confidence: STATIC-INFERRED
          evidence: "ReactiveTermRepositoryImpl.java:282-292"
        - q: "Which subset at result-set > page size?"
          a: "First 30 by the above order (child size=30); deeper windows via infinite scroll. The TermsForm size-1000 fetch can reset the window to 1000 rows for TERM_CREATE users — interplay in bugs[4]."
          confidence: STATIC-INFERRED
          evidence: "TermSearchResults.tsx:38-43 + TermsForm.tsx:73"
        - q: "Does any upstream layer re-sort or filter?"
          a: "No — the map renders server order unmodified (TermSearchResults.tsx:98-103)."
          confidence: STATIC-INFERRED
          evidence: "TermSearchResults.tsx:98-103"
  auth_gates:
    - location: "TermSearch.tsx:113-118 (+ App.tsx:66-69 route mount)"
      endpoint: "/termsearch UI surface; Permission.TERM_CREATE provider"
      questions:
        - q: "What does this surface show under DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "The component has no auth logic; reachability is the app shell's concern. Under DISABLED everything renders for anyone reaching the port; under the other modes, post-login. Per-mode permission resolution feeding usePermissions is owned by the auth wiring nodes."
          confidence: REFERENCE
          evidence: "node: P-09 auth wiring sidecars (App shell / PermissionProvider)"
        - q: "What does an unauthenticated caller see?"
          a: "Platform-level redirect-to-login under non-DISABLED modes; not enforced in this file (no auth check present in the source — verified by reading all 127 lines)."
          confidence: STATIC-INFERRED
          evidence: "TermSearch.tsx:1-127 (absence)"
        - q: "What does a wrong-role caller (no TERM_CREATE) see?"
          a: "Full list + search + filters; NO 'Add term' button (WithPermissions renders null, WithPermissions.tsx:27-31); and — side effect of the gate — NO TermsForm mount, so no size-1000 fetch (bugs[4] applies only to permitted users)."
          confidence: STATIC-INFERRED
          evidence: "WithPermissions.tsx:27-31 + TermSearchHeader.tsx:17-23"
        - q: "Where does the mutation gate actually live?"
          a: "UI hide here; backend enforcement for POST /api/terms is the authorization framework's registration — not re-verified this session."
          confidence: REFERENCE
          evidence: "node: SecurityConstants / TermController create-path sidecars"
  resource_boundaries:
    - location: "TermSearch.tsx:78-92"
      kind: concurrency
      questions:
        - q: "Can two simultaneous calls corrupt state?"
          a: "Client side: no shared mutable state beyond Redux (reducers serialise). The recreated debouncers leak at most ~one pending timer per replaced instance for ≤1500 ms."
          confidence: STATIC-INFERRED
          evidence: "TermSearch.tsx:78-92"
        - q: "Is the facet PUT replay-safe?"
          a: "Yes for identical deltas — merge is idempotent (re-adding a selected id keeps it; re-removing an absent id is filtered). Lost-update risk is cross-delta, below."
          confidence: STATIC-INFERRED
          evidence: "FacetStateDto.java:51-66"
    - location: "TermSearchServiceImpl.java:82-90 + ReactiveSearchFacetRepositoryImpl.java:85-96"
      kind: transactional
      questions:
        - q: "Can two CONCURRENT facet PUTs lose a delta?"
          a: "The service does fetch → merge → UPDATE with no lock/version (plain UPDATE by id); two in-flight PUTs that both read the same stored state will each write their own merge — last write drops the other's delta. The broken debouncer (≈1 PUT per click) widens this window. UI partially self-heals: the dropped option re-appears locally as unsynced (slice resolver flags selected divergence, termSearch.slice.ts:68-71) and re-PUTs on the next facetParams change — but only when a later response exposes the divergence. Runtime outcome folded into P-246's final-state assert."
          confidence: PROBE-NEEDED
          evidence: "probe_id: P-246"
    - location: "TermSearch.tsx:53-60 + 62-71"
      kind: idempotency
      questions:
        - q: "Double-click 'Start new search' / StrictMode double-mount — duplicate side effects?"
          a: "Each invocation POSTs a new session row; the later navigate wins; earlier rows are orphaned until housekeeping eviction (LAST_ACCESSED_AT-based). Same class as the toolbar's create-per-click (bugs[6]) and dev-only StrictMode double-create. No user-visible corruption; server-row churn only."
          confidence: STATIC-INFERRED
          evidence: "TermSearch.tsx:53-60 + ReactiveSearchFacetRepositoryImpl.java:76-82 + ToolbarTabs.tsx:107-119"
  request_inputs:
    - location: "TermSearch.tsx:34, 74-75"
      input_kind: path-param
      input_name: "termSearchId (:termSearchId)"
      questions:
        - q: "Name promise?"
          a: "the term-search session to restore"
          confidence: STATIC-INFERRED
          evidence: "routes/termsRoutes.ts:7-8, 54-63"
        - q: "Actual use?"
          a: "Bound verbatim as searchId → GET /api/terms/search/{search_id} → search_facets PK lookup (fetchFacetState). As of THIS COMMIT the binding is real; pre-fix the splat route never populated it (the #1760 regression)."
          confidence: STATIC-INFERRED
          evidence: "TermSearch.tsx:73-76 + App.tsx:66-69 + TermSearchServiceImpl.java:108-111"
        - q: "Scope match?"
          a: "MATCHES"
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "as above"
        - q: "Wrong-assumption visibility?"
          a: "Dead/foreign UUID → graceful expired state (404); that is now the designed surface."
          confidence: STATIC-INFERRED
          evidence: "TermSearch.tsx:98-100"
        - q: "Available-but-unused closer match?"
          a: "NONE"
          confidence: STATIC-INFERRED
          evidence: "n/a"
    - location: "TermSearch.tsx:64 (+ TermSearchInput.tsx:26, ToolbarTabs.tsx:109)"
      input_kind: body-field
      input_name: "termSearchFormData.pageSize"
      questions:
        - q: "Name promise?"
          a: "sets the session's results page size to 30"
          confidence: STATIC-INFERRED
          evidence: "TermSearch.tsx:64"
        - q: "Actual use?"
          a: "NONE — dropped at the generated-client serialization boundary; absent from the wire schema; never read server-side (scoped greps: getPageSize() zero matches under odd-platform-api/src/main/java; pageSize|page_size zero under odd-platform-api/src/main/resources)."
          confidence: STATIC-INFERRED
          evidence: "generated-sources/models/TermSearchFormData.ts:68-79 + components.yaml:2659-2680 + FacetStateMapperImpl.java:106-130"
        - q: "Scope match?"
          a: "TRANSLATES_SILENTLY — a source-level field that silently becomes nothing; a maintainer tuning it would observe no effect."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "as above"
        - q: "Wrong-assumption visibility?"
          a: "Page size stays 30 regardless (the child's literal). No error, no warning — TS excess-property check bypassed via intermediate const."
          confidence: STATIC-INFERRED
          evidence: "TermSearchResults.tsx:38"
        - q: "Available-but-unused closer match?"
          a: "The `size` query param on GET /api/terms/search/{id}/results — the input that actually does what pageSize promises."
          confidence: STATIC-INFERRED
          evidence: "TermController.java:184-191 + TermSearchResults.tsx:42"
      routes_to_finding: "bugs_limitations_corner_cases[5]"
    - location: "TermSearch.tsx:81-86 (PUT) vs :64 (POST)"
      input_kind: body-field
      input_name: "termSearchFormData.filters"
      questions:
        - q: "Name promise?"
          a: "the filter state of the search"
          confidence: STATIC-INFERRED
          evidence: "TermSearch.tsx:81-86"
        - q: "Actual use?"
          a: "Endpoint-dependent: POST treats it as the full initial state (removeUnselected, TermSearchServiceImpl.java:73); PUT treats it as a MERGE-PATCH delta (merge at :86; add on selected=true, remove on selected=false, FacetStateDto.java:51-66). The UI honours the delta contract by sending only unsynced options (selectors.ts:98-102)."
          confidence: STATIC-INFERRED
          evidence: "TermSearchServiceImpl.java:72-90 + FacetStateDto.java:30-66"
        - q: "Scope match?"
          a: "TRANSLATES_LEGITIMATELY — the delta semantics are explicit in the implementation (variable named `delta`; merge helpers) and the UI selector is built for it. Caveat-grade: the SAME field name carries replacement semantics on POST and patch semantics on PUT; third-party API callers sending 'the full state' to PUT cannot DESELECT by omission — they must send selected:false explicitly."
          drift: MINOR
          confidence: STATIC-INFERRED
          evidence: "as above"
        - q: "Wrong-assumption visibility?"
          a: "An API caller PUTting `filters:{}` expecting a reset observes... no reset (facets persist). The UI's own TermSearchInput does exactly this — and the persistence is the CORRECT behaviour for it (typing a query keeps your facets), which the previous sidecar revision mis-read as 'filters are reset + facet race discards selections'; both retracted this revision."
          confidence: STATIC-INFERRED
          evidence: "TermSearchInput.tsx:26-27 + FacetStateDto.java:41-49"
        - q: "Available-but-unused closer match?"
          a: "NONE (clearTermSearchFacets exists client-side and expresses clearing as explicit selected:false deltas — consistent with the contract)"
          confidence: STATIC-INFERRED
          evidence: "termSearch.slice.ts:96-120"
    - location: "TermSearch.tsx:82 (PUT payload `query`)"
      input_kind: body-field
      input_name: "termSearchFormData.query"
      questions:
        - q: "Name promise?"
          a: "the free-text search query"
          confidence: STATIC-INFERRED
          evidence: "TermSearch.tsx:81-82"
        - q: "Actual use?"
          a: "Replaced wholesale on every PUT (merge takes delta.getQuery(), FacetStateDto.java:48); empty query → no FTS condition → full catalog; non-empty → FTS + rank ordering (ReactiveTermRepositoryImpl.java:282-291). The facet-debounce PUT re-sends the CURRENT redux query so facet edits don't clobber it."
          confidence: STATIC-INFERRED
          evidence: "FacetStateDto.java:48 + ReactiveTermRepositoryImpl.java:282-292"
        - q: "Scope match?"
          a: "MATCHES"
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "as above"
        - q: "Wrong-assumption visibility?"
          a: "n/a (no drift)"
          confidence: STATIC-INFERRED
          evidence: "n/a"
        - q: "Available-but-unused closer match?"
          a: "NONE"
          confidence: STATIC-INFERRED
          evidence: "n/a"
  probes_emitted:
    - probe_id: P-246
      question: "Facet-click PUT cardinality per 5 rapid clicks (debouncer-recreation hypothesis) + lost-update detection across concurrent merge-patch PUTs"
      probe_path: "lineage/odd-platform/probes/P-246.yaml"
    - probe_id: P-247
      question: "TermsForm size-1000 fetch vs child size-30 fetch: which wins the shared results slice on Dictionary mount for a TERM_CREATE user, and does >1000-term scroll produce duplicate rows?"
      probe_path: "lineage/odd-platform/probes/P-247.yaml"
  stress_summary:
    triggers_total: 13
    questions_total: 32
    answers_static_inferred: 26
    answers_probe_needed: 3
    answers_reference: 3
    drift_flags: 3   # wire-path naming (MINOR), pageSize (DRIFT_INPUT_NAME_VS_IMPLEMENTATION), filters PUT-vs-POST semantics (MINOR, legitimate)
```

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` (UI surface behind the authenticated shell; reachable by anyone under `DISABLED`). No auth logic in this file; the route mount (App.tsx:66-69) is unconditional within the shell.
- **ingestion_filter_relevance**: `NO — UI/API surface (/api/terms/search), not ingestion`.
- **authorization_assertions**:
  - "`WithPermissionsProvider allowedPermissions=[Permission.TERM_CREATE] resourcePermissions=[]` (TermSearch.tsx:113-118) — context injection only; always renders (WithPermissionsProvider.tsx:12-49)."
  - "`WithPermissions permissionTo={Permission.TERM_CREATE}` hides the Add-term CTA (TermSearchHeader.tsx:17-23; render-null at WithPermissions.tsx:27-31). Side effect worth knowing: the gate ALSO prevents TermsForm's size-1000 fetch for unpermitted users (bugs[4])."
  - "NO row-level or read authorization anywhere in this tree — list, search input, filters and row links render for every authenticated user (TermSearchResults.tsx:98-103; TermSearchResultItem.tsx:26)."
- **owner_scoping**: `BYPASSES — read-collaborative posture` (repository tier applies no owner/namespace read filter per F-002 batch-N; now openly stated on the live doc page — fetched this session).
- **data_exposure**:
  - "Term rows `{name, namespace.name, owners[], usingCount, createdAt, updatedAt}` → every authenticated user (TermSearchResultItem.tsx:25-69). Term/namespace taxonomies can reveal org structure or compliance vocabulary."
  - "Session UUID in the URL is an unguessable working-view handle; missing-session reads return uniform 404 USR002 (IT-125 spec lines 36-47) — no existence oracle beyond validity of the UUID itself."
  - "Create-CTA visibility leaks the caller's TERM_CREATE bit to the DOM (pattern-wide, not per-component)."
- **known_security_gaps**:
  - "Read surface ungated by design (read-collaborative); mutation enforcement for POST /api/terms is backend-owned and not re-verified this session — carried as REFERENCE in stress auth_gates." — evidence: TermSearch.tsx:106-123 — severity: LOW

## performance

- **hot_paths**:
  - "Cold mount: 1 POST (create) + 1 results GET (child, page 1 size 30); for TERM_CREATE users ALSO the TermsForm size-1000 GET (bugs[4]) — i.e. the most-privileged users get the heaviest Dictionary mount." — evidence: TermSearch.tsx:62-71 + TermSearchResults.tsx:52-61 + TermsForm.tsx:71-75
  - "Facet click: ~1 PUT per click (debouncer recreation, bugs[2]) + per-sync results refetch (child) + per-sync size-1000 refetch (TermsForm, permitted users)." — evidence: TermSearch.tsx:78-96 + TermsForm.tsx:71-75
  - "Deep-link restore: 1 GET; 404 short-circuits to the expired page with zero further traffic." — evidence: TermSearch.tsx:73-76, 98-100
- **throughput_characteristics**:
  - "Merge-patch PUTs are small (delta-only filters) — payload size does not grow with selected-facet count, only with per-gesture change size." — evidence: termSearch.selectors.ts:98-102
  - "No bulk-facet API; one PUT per gesture (debounce intent unfulfilled)."
- **resource_allocation**:
  - "Replaced debounced instances can hold ≤1500 ms pending timers (bounded by click rate); `mapValues(termSearchFacetParams, values)` allocates per dispatch — negligible." — evidence: TermSearch.tsx:78-92
  - "Redux results slice can hold up to 1000 items when TermsForm's fetch wins the race — ~10-30x the intended 30-row window, plus the corresponding DOM rows." — evidence: TermsForm.tsx:73 + termSearch.slice.ts:197-206
- **scaling_characteristics**:
  - "Stateless component; horizontal UI scale-out trivial. Server-side: session-row churn from toolbar-click-creates (bugs[6]) and recovery/double-click creates is bounded by housekeeping eviction." — evidence: ToolbarTabs.tsx:107-119
- **known_performance_gaps**:
  - "Broken debouncer — N PUTs for N rapid clicks (intended 1-2). Measured cardinality → P-246." — evidence: TermSearch.tsx:78-92 — severity: MEDIUM
  - "TermsForm size-1000 fetch on every mount/facet-sync for permitted users — the single heaviest avoidable query this page triggers; a server-side uniqueness check (or a suggestions endpoint) would delete it." — evidence: TermsForm.tsx:71-75 — severity: MEDIUM

## upstream_callers

- entry_point: "ui_route:/termsearch (index)"
  caller_node: "App.tsx routes (lazy mount at App.tsx:35; nested route at App.tsx:66-67)"
  multiplicity_per_trigger: 1
  evidence: "App.tsx:66-67 — index element <TermSearch/>; cold mount with empty redux fires exactly one create POST (effect-1 guard), then navigates to the param route WITHOUT remount (same element type at the same route position; only useParams output changes)"
  observation_class: ui-call
- entry_point: "ui_route:/termsearch/:termSearchId (deep-link / reload / share)"
  caller_node: "App.tsx:68"
  multiplicity_per_trigger: 1
  evidence: "TermSearch.tsx:73-76 — exactly one GET per mount while redux is empty; e2e-pinned by IT-125 (spec lines 113-115). Pre-#1760 this entry point was DEAD (splat dropped the param) — restored by this commit"
  observation_class: ui-call
- entry_point: "ui_click:top-nav Dictionary tab"
  caller_node: "ToolbarTabs.tsx:65-69, 107-119"
  multiplicity_per_trigger: 1
  evidence: "ToolbarTabs.tsx:111-118 — the CLICK HANDLER itself creates the session (1 POST) and navigates to /termsearch/{newId}; TermSearch then mounts with redux already holding the new id → 0 additional session calls. Every click = a fresh session (bugs[6])"
  observation_class: ui-call
- entry_point: "ui_click:back-navigation from TermDetails"
  caller_node: "TermDetails.tsx:50"
  multiplicity_per_trigger: 1
  evidence: "navigate(termsSearchPath(termSearchId)) — returns to the existing session URL; restore GET fires only if redux was cleared (e.g. full reload)"
  observation_class: ui-call
  unresolved: true   # TermDetails node not yet enriched against this revision

## downstream_side_effects

- side_effect_class: db-write
  description: "INSERT one search_facets session row per create (cold index mount, recovery click, toolbar click, StrictMode dev double-mount)"
  evidence: "TermSearch.tsx:62-71, 53-60 → termSearch.thunks.ts:21-24 → TermSearchServiceImpl.java:72-79 → ReactiveSearchFacetRepositoryImpl.java:76-82"
  cardinality_per_call: 1
  reachable_from_entry_points: ["ui_route:/termsearch (index)", "ui_click:top-nav Dictionary tab", "ui_click:Start-new-search (expired page)"]
- side_effect_class: db-write
  description: "UPDATE the session row (filters merge + query replace + LAST_ACCESSED_AT bump — the TTL clock) per facet gesture / per text-query submit"
  evidence: "TermSearch.tsx:78-96 + TermSearchInput.tsx:25-28 → TermSearchServiceImpl.java:82-90 → ReactiveSearchFacetRepositoryImpl.java:85-96"
  cardinality_per_call: "~1 per facet click while the debouncer-recreation bug stands (intended: coalesced); 1 per Enter/search-click"
  reachable_from_entry_points: ["ui_route:/termsearch (index)", "ui_route:/termsearch/:termSearchId (deep-link / reload / share)", "ui_click:top-nav Dictionary tab"]
- side_effect_class: page-render
  description: "Expired page (404) / error page (other captured statuses) / three-pane Dictionary layout (otherwise)"
  evidence: "TermSearch.tsx:98-123"
  cardinality_per_call: 1
  reachable_from_entry_points: ["ui_route:/termsearch/:termSearchId (deep-link / reload / share)"]
- side_effect_class: log-emit
  description: "Red error toast on every rejected session call carrying a Response status — INCLUDING the 404 the expired page handles gracefully (bugs[8])"
  evidence: "handleResponseThunk.ts:37-39 + errorHandling.tsx:77-79"
  cardinality_per_call: "1 per rejected thunk with a status"
  reachable_from_entry_points: ["ui_route:/termsearch/:termSearchId (deep-link / reload / share)", "ui_route:/termsearch (index)"]
- side_effect_class: cache-mutate
  description: "Redux: termSearch slice session-state writes per fulfilled call; loader slice status+error keys per lifecycle action; recovery click DELETES the GET act-type's loader keys (resetLoaderByAction)"
  evidence: "termSearch.slice.ts:193-228 + loader.slice.ts:18-49 + TermSearch.tsx:54"
  cardinality_per_call: 1
  reachable_from_entry_points: ["all of the above"]
- side_effect_class: redirect-issue
  description: "navigate() to /termsearch/{newId} after every successful create (relative from index, absolute from the recovery handler)"
  evidence: "TermSearch.tsx:67-69 (relative; index route only) + :57-59 (absolute via termsSearchPath — executes from the :termSearchId route)"
  cardinality_per_call: 1
  reachable_from_entry_points: ["ui_route:/termsearch (index)", "ui_click:Start-new-search (expired page)"]
- side_effect_class: external-call
  description: "Child-tree fetches this mount unleashes: results GET page-1 size-30 (always), TermsForm results GET page-1 size-1000 (TERM_CREATE users only — REFERENCE, owning node TermsForm, unresolved: true)"
  evidence: "TermSearchResults.tsx:52-61 + TermsForm.tsx:71-75"
  cardinality_per_call: "1-2 per mount + per facet-sync"
  reachable_from_entry_points: ["all UI entry points above"]

## coherence_check (LSN-018 Rule 6)

- **Refresh deltas vs the 2026-05-20 revision (divergence-detection log):** (1) wire path corrected `/api/termsearch` → `/api/terms/search` (spec-verified); (2) the "text-search resets filters / facet race discards selections" claim RETRACTED — merge-patch semantics make `filters:{}` a facet no-op (FacetStateDto.merge traced end-to-end); the real race is the narrower read-merge-write lost-update (stress E2); (3) "session-server respects client pageSize" RETRACTED — dead field (bugs[5]); (4) old bug 'session-expiry: no recovery path' RESOLVED by this commit (SearchSessionExpired + recovery handler); (5) old bug 'unhandled-rejection silent failure' NARROWED to the create path only (restore failures now render); (6) old doc-gaps D/E/G/H now satisfied by the live page; two NEW doc drifts logged (empty-table claim; pagination-state share claim).
- **Strengthens** F-002 (UI half of the read-collaborative posture, unchanged) and F-017/#1760 (the termsearch mirror of the search-session contract; IT-125 pins both surfaces).
- **Strengthens** F-010 housekeeping: LAST_ACCESSED_AT bump on every facet PUT means actively-used sessions self-renew their TTL; only idle links die — sharpening the expired-state story (an expired link is an IDLE link).
- **No conflicts** with sibling sidecars surfaced; TermsForm findings recorded here as references, not absorbed (Rule 3). Sibling probes emitted this session for Search.tsx/App.tsx took P-244/P-245; this sidecar's probes are P-246/P-247.

## sources

- understanding ← odd-platform-ui/src/components/Terms/TermSearch/TermSearch.tsx:1-127 + odd-platform-ui/src/components/App.tsx:35, 66-69 + odd-platform-specification/openapi.yaml:2982-3107
- concepts.entities ← components.yaml:2659-2688 + lib/errorHandling.tsx:14-35 + loader.slice.ts:9-49 + SearchSessionExpired.tsx:7-44 + AppErrorPage.tsx:8-39 + termSearch.selectors.ts:22-34 + ReactiveSearchFacetRepositoryImpl.java:76-96
- concepts.operations ← TermSearch.tsx:46-123 + termSearch.thunks.ts:21-42 + loader.slice.ts:18-24
- concepts.invariants ← App.tsx:66-69 + integration-tests/e2e/specs/search-session-not-found.spec.ts:108-122 + termSearch.selectors.ts:98-102 + TermSearchServiceImpl.java:72-90, 108-119 + FacetStateDto.java:41-66 + WithPermissions.tsx:27-31 + TermSearchResults.tsx:38, 52-61 + ReactiveTermRepositoryImpl.java:277-292
- dependencies_semantic ← TermSearch.tsx:1-29 (import block) + TermsForm.tsx:71-75 + ToolbarTabs.tsx:65-69, 107-119 + TermController.java:178-216
- tests_coverage_semantic ← integration-tests/e2e/specs/search-session-not-found.spec.ts:3-122 + Glob over odd-platform-ui/src/components/Terms/TermSearch (this session: 12 sources, zero test files)
- docs_link_semantic ← WebFetch 2026-06-11 of both URLs (status 200 each) + TermSearchResults.tsx:52-61 + ReactiveTermRepositoryImpl.java:277-292 + TermSearchServiceImpl.java:113-119 + termSearch.slice.ts:85-88
- implicit_adrs ← TermSearch.tsx:46-60 + SearchSessionExpired.tsx:12-13 + loader.slice.ts:18-49 + termSearch.selectors.ts:26-34 + TermSearchServiceImpl.java:82-90 + WithPermissionsProvider.tsx:12-49 + TermSearchInput.tsx:25-35
- bugs_limitations_corner_cases[0] ← TermSearch.tsx:62-71 + termSearch.slice.ts:76-90
- bugs_limitations_corner_cases[1] ← TermSearch.tsx:94-96 + termSearch.selectors.ts:98-102 + termSearch.slice.ts:84
- bugs_limitations_corner_cases[2] ← TermSearch.tsx:78-92
- bugs_limitations_corner_cases[3] ← TermSearch.tsx:53-71 + handleResponseThunk.ts:24-42 + errorHandling.tsx:77-79
- bugs_limitations_corner_cases[4] ← TermsForm.tsx:71-95 + TermSearchResults.tsx:38-61 + termSearch.slice.ts:197-206
- bugs_limitations_corner_cases[5] ← TermSearch.tsx:64 + TermSearchInput.tsx:26 + ToolbarTabs.tsx:109 + generated-sources/models/TermSearchFormData.ts:68-79 + components.yaml:2659-2680 + FacetStateMapperImpl.java:106-130 + scoped absence greps (named in the entry: odd-platform-api/src/main/java and odd-platform-api/src/main/resources)
- bugs_limitations_corner_cases[6] ← ToolbarTabs.tsx:107-119 + ReactiveSearchFacetRepositoryImpl.java:76-82
- bugs_limitations_corner_cases[7] ← TermSearch.tsx:62-76 + TermDetails.tsx:50
- bugs_limitations_corner_cases[8] ← termSearch.thunks.ts:35-42 + errorHandling.tsx:58-80 + SearchSessionExpired.tsx:12-13
- bugs_limitations_corner_cases[9] ← TermSearchResultItem.tsx:36-37
- bugs_limitations_corner_cases[10] ← TermSearchResultItem.tsx:20-23, 51-55 + TermSearchResults.tsx:105-107
- stress_findings ← all citations inline in the block (each `evidence:` field)
- security ← TermSearch.tsx:106-123 + WithPermissions.tsx:27-31 + WithPermissionsProvider.tsx:12-49 + TermSearchResultItem.tsx:25-69 + integration-tests/e2e/specs/search-session-not-found.spec.ts:36-47
- performance ← TermSearch.tsx:62-96 + TermsForm.tsx:71-75 + TermSearchResults.tsx:52-61 + termSearch.selectors.ts:98-102 + ToolbarTabs.tsx:107-119
- upstream_callers ← App.tsx:35, 66-69 + ToolbarTabs.tsx:65-69, 107-119 + TermDetails.tsx:50 + integration-tests/e2e/specs/search-session-not-found.spec.ts:113-115
- downstream_side_effects ← TermSearch.tsx:53-123 + termSearch.thunks.ts:21-42 + TermSearchServiceImpl.java:72-90 + ReactiveSearchFacetRepositoryImpl.java:76-96 + handleResponseThunk.ts:37-39 + TermsForm.tsx:71-75

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (IT-125 spec read end-to-end this session; unit-test absence verified by Glob over the component subtree)
- docs_link_semantic: HIGH (both URLs WebFetched 2026-06-11, status 200; drift claims code-anchored)
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH (every entry traced to current line numbers; two prior-revision claims explicitly retracted with the disproving trace cited)
- security: HIGH
- performance: MEDIUM (cardinality claims for the debouncer and the TermsForm race are static-traced; runtime counts pending P-246/P-247)
- upstream_callers: HIGH (one unresolved reference: TermDetails back-nav, flagged)
- downstream_side_effects: HIGH (TermsForm-owned effects recorded as references, unresolved)
- stress_findings: MEDIUM (3 of 32 questions PROBE-NEEDED — all cardinality/race refinements; every load-bearing behavioural claim is STATIC-INFERRED with end-to-end trace or pinned by IT-125)

## Maintainer notes


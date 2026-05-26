---
node_id: "odd-platform ts react-component component:LookupTables"
node_kind: react-component
axis: react-components
extracted_at_commit: 9ac6436e9bd36ba132d765076c6bbd5916fde729
enriched_at_commit: 9ac6436e9bd36ba132d765076c6bbd5916fde729
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-26-ZL-LookupTables
---

# LookupTables — semantic understanding

## understanding

Top-level React functional component (93 lines) that renders the Lookup Tables list page at `/master-data/lookup-tables` — the SINGLE user-observable surface of the Master Data Management pillar (P-03). It orchestrates a five-piece UI assembly: an H1 title with a live count badge ("X lookup tables overall"), a global text-search input, a permission-gated "+ Add new" button (mounting `LookupTableForm` as a modal dialog), and a virtualised infinite-scroll list (`LookupTablesList` sibling). On mount it bootstraps a faceted-search session — POSTing `/api/referencedata/search` with an empty query when no `searchId` URL param is present, persisting the returned session id back into `?searchId=<uuid>` via `setSearchParams`, and then reading per-keystroke search updates through `useUpdateReferenceDataSearch`. Substituted for the phantom `MasterData.tsx` (LSN-018 — the substrate had inferred a wrapper from the toolbar tab name; no wrapper exists, `LookupTables` is the de-facto root).

## concepts

- entities: [LookupTable (the listed entity), ReferenceDataSearchSession (the session-id pattern that persists facets across reloads), Namespace (form-required for create, absent from update DTO), Permission.LOOKUP_TABLE_CREATE (the only permission referenced in this file)]
- operations: [bootstrap-search-session, persist-search-id-to-url, debounced-search-update, render-list-page, mount-add-new-dialog-conditionally]
- invariants:
  - "If the URL has no `?searchId=<uuid>`, the component POSTs a new search session and back-fills the URL via `setSearchParams` — making subsequent reloads reuse the same session"
  - "The Add-new button is hidden when the user lacks `LOOKUP_TABLE_CREATE`; the rest of the page (counter, search, table list) renders regardless of permissions"
  - "The `facets` local state and the `data` query state are kept in sync via a defensive `useEffect` that copies `data` into `facets` only when `facets` is still undefined — a one-shot hydration pattern, NOT a continuous reconciliation"
- audiences: [ui-end-user (steward / data-engineer browsing reference data), product-author (canonical landing for the Master Data Management pillar surface)]

## dependencies_semantic

- requires-feature:
  - "Reference-Data Search session backend (`POST /api/referencedata/search`, `GET /api/referencedata/search/{id}`, `PUT /api/referencedata/search/{id}`) — wired through `useCreateReferenceDataSearch` / `useGetReferenceDataSearch` / `useUpdateReferenceDataSearch` hooks (`referenceDataSearch.ts:20-40`)"
  - "Reference-Data Search results pagination (`GET /api/referencedata/search/{id}/results`) — consumed by the sibling `LookupTablesList` component, not by this file directly (`lookupTables.ts:21-40` + `LookupTablesList.tsx:21-25`)"
  - "Lookup-table create endpoint (`POST /api/referencedata/table`) — consumed by `LookupTableForm` (mounted as a child here at line 72-82) via `useCreateLookupTable`"
  - "Permission framework — `Permission.LOOKUP_TABLE_CREATE` enum from `generated-sources` gates the Add-new button"
  - "Master Data Management pillar (P-03) — this component IS the pillar's user-visible surface"
- requires-config: []
- requires-runtime:
  - "react-router-dom — `useSearchParams` for URL-state binding (`LookupTables.tsx:5, 20`)"
  - "@tanstack/react-query — `useMutation` / `useQuery` wrappers via `useCreate/Get/UpdateReferenceDataSearch` (`referenceDataSearch.ts:1, 11-40`)"
  - "react-i18next — `t('Lookup Tables')`, `t('lookup tables overall')`, `t('Add new')` (`LookupTables.tsx:3, 19`)"
  - "@mui/material — `Grid`, `Typography` (`LookupTables.tsx:1`)"
  - "Redux profile state — the inner `<WithPermissions>` reads `getGlobalPermissions` via `usePermissions` (`WithPermissions.tsx:17` + `PermissionProvider.tsx:17`)"

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "When `searchId` URL param is empty on mount, `createFacets('')` is called exactly once (not twice — useEffect dep-array is `[searchId]`)"
    test_class: unit
    criticality: LOW
    note: "Trivially testable with Jest + react-hooks; reduces accidental dual-fire regression from a future dep-array edit"
  - behaviour: "When `data` arrives from `useGetReferenceDataSearch` and `facets` is still undefined, `facets` gets hydrated exactly once (not reset on subsequent `data` refreshes)"
    test_class: unit
    criticality: MEDIUM
    note: "The `if (!data || facets) return;` early-return at line 40 is the one-shot guard — if removed, every refetch would clobber the user's in-progress edits"
  - behaviour: "Visiting `/master-data/lookup-tables` with zero of LOOKUP_TABLE_CREATE/_UPDATE/_DELETE renders the page (counter, search, list) but hides the Add-new button"
    test_class: security
    criticality: HIGH
    note: "WithPermissionsProvider at the route layer is NOT a gate (LSN-018 substitution-class finding from the masterDataRoutes sidecar). PROBE-NEEDED — see P-193."
  - behaviour: "InfiniteScroll fires `fetchNextPage` correctly when scrolling within the ScrollableContainer (the `scrollableTarget='directory-entities-list'` references the wrong DOM id)"
    test_class: integration
    criticality: HIGH
    note: "Copy-paste bug in `LookupTablesList.tsx:51-53` — the container id is `lookup-tables-list` but InfiniteScroll points to `directory-entities-list`. PROBE-NEEDED — see P-192."
  - behaviour: "Editing an existing lookup table sends `namespace_name` in the request body even though `LookupTableUpdateFormData` schema rejects it"
    test_class: integration
    criticality: HIGH
    note: "The form types submissions as `LookupTableFormData` (CREATE shape) and routes them to the UPDATE endpoint. PROBE-NEEDED — see P-191."
  - behaviour: "Search-as-you-type debouncing — `SearchInput.onSearch` fires `updateFacets({...facets, query})` per keystroke (no debounce visible in this file)"
    test_class: performance
    criticality: MEDIUM
    note: "If `SearchInput` does NOT debounce internally, every keystroke fires a PUT to `/api/referencedata/search/{id}` — measurable cost at scale"
- test_files: []
- gaps: |
    Zero direct test files. The most operator-visible regression class is the InfiniteScroll
    scrollableTarget mismatch (P-192) — any tenant with >30 lookup tables would see only
    the first 30 in the list. Second-most-operator-visible is the edit-form DTO drift
    (P-191) — namespace_name is silently discarded on edit, and the operator inspecting
    the network tab would see it on the wire. Both gaps are in the integration class;
    neither is reachable from any pure-unit test.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/master-data-management/lookup-tables"
    anchor: ""
    rationale: "Canonical Master Data Management pillar (P-03) doc page. This component IS the UI surface that the page documents (the +Add new button, the search box, the table list, the LOOKUP_TABLE_CREATE permission gate are all described verbatim)."
    last_verified_at: "2026-05-26T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      Quoted from the live doc page (WebFetch 2026-05-26, status 200):
      - "In the platform UI, lookup tables live under the top-level **Master Data** tab → **Lookup Tables**"
      - "The creation of Lookup Tables involves adding a new table through the `+Add new` button"
      - "the `+Add new` button in the right upper corner of the Master Data section"
      - "every lookup table the user can read, with name, description, and namespace columns plus search"
      - "`LOOKUP_TABLE_CREATE` — Creating a new lookup table (the `+Add new` flow)"
      - "`LOOKUP_TABLE_UPDATE` — Renaming a lookup table or editing its description"
      - "`LOOKUP_TABLE_DELETE` — Deleting a lookup table"
- doc_drift_findings:
  - "Doc page says 'Renaming a lookup table or editing its description' under LOOKUP_TABLE_UPDATE, implying the namespace is NOT updateable — and the OpenAPI schema confirms this (`LookupTableUpdateFormData` defines only `name` + `description`, components.yaml:3853-3862). The UI form (`LookupTableForm.tsx:117-123`) disables the namespace field on edit (`disabled={!!lookupTable}`) AND sends it anyway in the request body via `lookupTableUpdateFormData: data` (LookupTableForm.tsx:63) — drift between UX intent (field disabled = field not editable) and wire reality (field sent and silently discarded). Operator inspecting the network tab on edit sees `namespace_name` on the wire, but reading the docs would assume the field is not transmitted. — severity: MEDIUM."
  - "Doc page is silent on the page-render-without-permissions behaviour. A user with zero of CREATE/UPDATE/DELETE still sees the table list, search input, title, and counter — only the +Add new button is hidden. The docs imply (by describing 'the +Add new button' as the create entry point) that the page is permission-gated, but the route mount's `WithPermissionsProvider` is NOT a gate — it only passes permission context to children. — severity: MEDIUM."
  - "Doc page mentions 'name, description, and namespace columns plus search'. The actual list table-header has THREE non-action columns — Name, Description, Namespace (per `LookupTablesList.tsx:39-50`) — plus an unlabeled Edit/Delete actions column. Doc claim matches column LABELS. — severity: NONE (no drift)."
  - "Doc page says the table-name 'becomes the Business Name; an Original Name is provided, prefixed with the ID of Namespace'. The UI form has ONE name field (`LookupTableForm.tsx:84-93`); the 'original name' / 'business name' distinction is opaque to the user — the backend's `buildTableName` lowercase + space-replace transformation (`ReferenceDataServiceImpl.java:191-194`) is undocumented at this UI layer. An operator hand-typing 'My Reference Tables' has no way to anticipate that the physical PostgreSQL table will be named `n_{nsId}__my_reference_tables`. — severity: LOW."

## implicit_adrs

- "Lookup-table search uses a server-side persisted session (`?searchId=<uuid>` URL param), not client-side query state — implies the search session can be deep-linked, reloaded, or shared by URL and the server-side facet state is the source of truth. — evidence: LookupTables.tsx:20-37 (the `useSearchParams` + `createFacets('').then(({searchId: sid}) => setSearchParams({searchId: sid}))` bootstrap) — intent_anchor: `"setSearchParams({ searchId: sid });"` (line 34 — the act of writing the server-issued id back into the URL is the design decision) — confidence: HIGH"
- "The Add-new button is gated by `LOOKUP_TABLE_CREATE` alone, not by `LOOKUP_TABLE_CREATE` AND a parent resource — implies lookup-table creation has no per-parent ownership gate (any user with global CREATE permission can create in any namespace). — evidence: LookupTables.tsx:72-82 (single-permission WithPermissions wrap) + ReferenceDataServiceImpl.java:73-86 (the create path resolves namespace by name without an ownership check) — intent_anchor: `"<WithPermissions permissionTo={Permission.LOOKUP_TABLE_CREATE}>"` (line 72 — only one permission cited; ownership-scoped variants would have been listed if intended) — confidence: HIGH"
- "Form-mount pattern: `LookupTableForm` is mounted DIRECTLY in the list page (line 73) — not in a separate route. Implies the Add / Edit flows are dialog-based (modal), not URL-route-based; the user does not get a shareable URL for an in-progress create / edit. — evidence: LookupTables.tsx:72-82 + LookupTableForm.tsx:138-150 (the form is wrapped in `<DialogWrapper>` with `renderOpenBtn`) — intent_anchor: `"<DialogWrapper ... renderOpenBtn={({ handleOpen }) => cloneElement(btnEl, { onClick: handleOpen })} ...>"` (LookupTableForm.tsx:140-141 — the cloneElement-injects-onClick pattern is a deliberate modal-dialog idiom) — confidence: HIGH"

## bugs_limitations_corner_cases

- "`useGetReferenceDataSearch` is called with `enabled: !!searchId` so when `searchId === ''` (first render), the query is INERT — but the `useEffect` at line 30-37 then POSTs `createFacets('')` to mint a session id. There is a small window between the POST returning and the URL update where `data` would be undefined; the component renders `<NumberFormatted value={facets?.total} />` (line 61) — which gracefully handles `undefined` (renders nothing) — but a quick eye could mistake the empty counter for 'zero tables'. — evidence: LookupTables.tsx:25-37, 60-62 — severity: LOW"
- "InfiniteScroll mis-targeting: `LookupTablesList.tsx:51-53` mounts `<ScrollableContainer id='lookup-tables-list'>` around `<InfiniteScroll scrollableTarget='directory-entities-list'>`. The `scrollableTarget` is a copy-paste from the Directory feature — it references a DOM id that does NOT exist on this page. Per react-infinite-scroll-component docs, an unresolvable `scrollableTarget` falls back to window scroll; but `ScrollableContainer` declares `$offsetY={165}` and likely sets `overflow:auto`, so window scroll never fires for content inside the container. Likely effect: `fetchNextPage` never gets triggered by scrolling within the table; any tenant with >30 lookup tables sees only 30 rows in the UI. PROBE-NEEDED — see P-192. — evidence: LookupTablesList.tsx:51-53 — severity: HIGH"
- "Edit-form DTO drift: `LookupTableForm.tsx:49` types form data as `LookupTableFormData` (the CREATE shape with required `namespaceName`). On edit (line 60-66), it submits the SAME shape to `editLookupTable({ lookupTableUpdateFormData: data, ... })`, but the OpenAPI contract for UPDATE (`LookupTableUpdateFormData`, components.yaml:3853-3862) defines ONLY `name` + `description`. The `namespace_name` field is sent on the wire on every edit but silently discarded by the server (assuming Spring's default lenient binding). The form-visual `disabled={!!lookupTable}` (line 120) hides this from the user. — evidence: LookupTableForm.tsx:49, 60-66, 117-123 + components.yaml:3853-3862 + ReferenceDataServiceImpl.java (no `updateNamespace` path) — severity: HIGH"
- "Stale-data on facet-data refresh: the `useEffect` at line 39-43 hydrates `facets` from `data` only when `facets` is still undefined. If the user has typed into the search box (mutating `facets.query` via `updateFacets`), and then the underlying query refetches (e.g. on window-focus refetch), `data` may come back with a different `query` value than what the user just typed — but the guard `if (!data || facets) return;` prevents the clobber. Correct, but fragile: a future refactor that removes the guard would race. — evidence: LookupTables.tsx:39-43 — severity: LOW"
- "Counter leaks population size: the H1 row renders `<NumberFormatted value={facets?.total} /> {t('lookup tables overall')}` (line 60-62). `facets.total` comes from `LookupDataSearchServiceImpl.countByState` which counts ALL tables matching the (empty) query — there is no owner-filter, no namespace-scope, no per-permission filter applied. Any authenticated user (per the read-collaborative posture confirmed in the ReferenceDataController sidecar known_security_gaps[0]) sees the global lookup-table population size, even if backend RBAC would limit which individual rows they can act on. — evidence: LookupTables.tsx:60-62 + LookupDataSearchServiceImpl.java:62-68 + cross-ref ReferenceDataController sidecar — severity: MEDIUM"
- "`SearchInput.onSearch={handleSearch}` (line 70) fires `updateFacets({...facets, query})` per keystroke if `SearchInput` does not debounce. Each fire is a PUT `/api/referencedata/search/{id}` — server-side facet recomputation per keystroke. Worth probing (`SearchInput` is shared infra; its debounce policy is out of this file's scope). — evidence: LookupTables.tsx:50-52, 70 — severity: MEDIUM"
- "Add-new and Edit buttons live in TWO separate components — Add-new at `LookupTables.tsx:72-82` (gated by LOOKUP_TABLE_CREATE) and Edit at `LookupTablesListItem.tsx:47-58` (gated by LOOKUP_TABLE_UPDATE). The two `LookupTableForm` mounts share form code, but the props differ (`lookupTable` undefined for create, set for edit). A future split (e.g. CRUD as separate dialogs) would have to coordinate across both sites — refactor scope, not a bug. — evidence: LookupTables.tsx:73 + LookupTablesListItem.tsx:48-58 — severity: LOW"
- "No empty-state CTA: when `data.items` is empty, `LookupTablesList` renders `<EmptyContentPlaceholder offsetTop={215} />` (LookupTablesList.tsx:64) — but the placeholder is generic (renders just an icon and message). No 'Create your first lookup table' CTA pointing to the +Add new button. Doc page describes the +Add new flow as the entry point, but a fresh tenant landing on the empty list with the button at top-right may not connect the two. — evidence: LookupTablesList.tsx:64 + shared/elements/EmptyContentPlaceholder — severity: LOW"

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "LookupTablesList.tsx:23"
      name: "size"
      value: "30"
      questions:
        - q: "What at N > 30?"
          a: "Pagination requests via InfiniteScroll's fetchNextPage — BUT the scrollableTarget references a wrong DOM id (`directory-entities-list` vs the actual `lookup-tables-list`). The pagination request may never fire from within the container; falls back to window-scroll only if the container is not actually scrollable."
          confidence: PROBE-NEEDED
          evidence: "P-192"
        - q: "What at N = 0?"
          a: "data.pages is `[{items: []}]`, lookupTables array is empty, isEmpty is true, EmptyContentPlaceholder renders. Static-derivable."
          confidence: STATIC-INFERRED
          evidence: "LookupTablesList.tsx:27-35, 64"
        - q: "What does the operator see at each boundary?"
          a: "N=0: empty placeholder. N=30: first page renders, scroll exposes pagination boundary. N=31+: hypothesis is only the first 30 render (InfiniteScroll mis-target). Operator-visible: any tenant with >30 lookup tables sees an incomplete list and has no signal that more exist."
          confidence: PROBE-NEEDED
          evidence: "P-192"
    - location: "LookupTablesList.tsx:51"
      name: "$offsetY"
      value: "165"
      questions:
        - q: "What is this magic number?"
          a: "Pixel offset for ScrollableContainer's vertical layout — likely accounts for the toolbar height (toolbarHeight constant from lib/constants) plus the title row plus the search/Add-new row. If the title row or filter row grows (e.g. new tab added to the toolbar), the offset becomes wrong and the list either has a blank gap at top or gets clipped at the bottom."
          confidence: STATIC-INFERRED
          evidence: "LookupTablesList.tsx:51 + lib/constants.ts (toolbarHeight) — not derivable to a closed-form check, but the smell is the hardcoded literal"
  name_behavior_pairs:
    - name: "useSearchLookupTables (hook called from LookupTablesList)"
      promise: "Returns paginated lookup-table search results bound to the current searchId/size"
      implementation: "useInfiniteQuery on queryKey ['searchLookupTables', searchId, size] that calls referenceDataApi.getReferenceDataSearchResults(searchId, page, size) and chains pages via addNextPage. Backend returns rows matching the persisted facet state; no client-side filtering."
      drift: NONE
      operator_visible_consequence: ""
      confidence: STATIC-INFERRED
      evidence: "lookupTables.ts:21-41 + LookupDataSearchServiceImpl.java:52-60 (search via FacetStateDto)"
    - name: "LookupTables (this component as the Master Data root)"
      promise: "Renders the Master Data Management section's UI (per the toolbar tab 'Master Data' linking here)"
      implementation: "Renders ONLY the Lookup Tables list — no master-data section landing page, no other sub-features visible. Per masterDataRoutes sidecar, no /master-data root route exists either."
      drift: MINOR
      operator_visible_consequence: "Operator clicking the 'Master Data' toolbar tab lands directly on the lookup-tables list (correct per current implementation, but the URL path `/master-data/lookup-tables` and the doc-page taxonomy `Master Data Management → Lookup Tables` imply a multi-feature pillar that today has exactly one feature). Not a bug, but a scaffolding asymmetry."
      confidence: STATIC-INFERRED
      evidence: "LookupTables.tsx:18-91 + masterDataRoutes.ts:1-5 + ToolbarTabs.tsx:55-59 + cross-ref masterDataRoutes sidecar"
    - name: "InfiniteScroll (in LookupTablesList)"
      promise: "Loads additional rows when the user scrolls near the bottom of the list"
      implementation: "Uses react-infinite-scroll-component with scrollableTarget='directory-entities-list' — a DOM id that does NOT exist on this page. The actual container id is `lookup-tables-list`. Mismatch → fetchNextPage may never fire from container scroll."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "Any tenant with >30 lookup tables sees only the first 30 in the UI. The list APPEARS to be the full set; no skeleton appears at the bottom to indicate more pages exist."
      confidence: PROBE-NEEDED
      evidence: "P-192"
  orderings:
    - location: "lookupTables.ts:29-33 (referenceDataApi.getReferenceDataSearchResults wiring)"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer?"
          a: "REFERENCE — see ReactiveLookupTableRepository.findByState. The SQL ORDER BY clause is NOT visible from this UI file. Cross-reference to backend repository sidecar (when enriched)."
          confidence: REFERENCE
          evidence: "node_id: odd-platform java ReactiveLookupTableRepository (not yet in registry)"
        - q: "What is the tie-breaker when sort-key values are equal?"
          a: "REFERENCE — backend SQL determines this. UI sees the order the backend ships."
          confidence: REFERENCE
          evidence: "node_id: odd-platform java ReactiveLookupTableRepository"
        - q: "Which subset is returned when result-set > page size?"
          a: "First `size=30` items per page; subsequent pages via `pageInfo.nextPage` (lookupTables.ts:38). Backend pagination is offset-based — page 1 → 1..30, page 2 → 31..60, etc."
          confidence: STATIC-INFERRED
          evidence: "lookupTables.ts:21-40 + ReferenceDataController.java:72-78 (getReferenceDataSearchResults takes page + size params)"
        - q: "Does any upstream layer re-sort or filter the result?"
          a: "No client-side re-sort: `data?.pages.flatMap(page => page.items) ?? []` (LookupTablesList.tsx:27-30) preserves the backend order verbatim. No `.sort` / `Comparator` anywhere in this component or its sibling."
          confidence: STATIC-INFERRED
          evidence: "LookupTablesList.tsx:27-30 + LookupTables.tsx (no sort logic)"
  auth_gates:
    - location: "LookupTables.tsx:72-82"
      endpoint: "Add-new button (mounts LookupTableForm in create mode)"
      questions:
        - q: "What does this gate return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "Identical across modes. WithPermissions reads `usePermissions().hasAccessTo(LOOKUP_TABLE_CREATE)` — a pure check against the user's resolved permission set. Auth-mode determines HOW permissions are loaded (DISABLED → no user → empty permissions → button hidden; LOGIN_FORM/OAUTH2/LDAP → user permissions per identity provider mapping). Same logic, different data sources."
          confidence: STATIC-INFERRED
          evidence: "LookupTables.tsx:72-82 + WithPermissions.tsx:11-32"
        - q: "What does an unauthenticated caller see?"
          a: "On DISABLED auth, no user is logged in → globalPermissions is empty → hasAccessTo(LOOKUP_TABLE_CREATE) returns false → button is HIDDEN. The rest of the page (title, search, list, counter) still renders. Other auth modes: HTTP-layer redirect to login before React mounts."
          confidence: PROBE-NEEDED
          evidence: "P-193"
        - q: "What does a wrong-role caller see (authenticated with no LOOKUP_TABLE permissions)?"
          a: "Add-new button hidden; rest of page renders fully including the counter ('X lookup tables overall'). Per the route mount, the WithPermissionsProvider's allowedPermissions list (CREATE/UPDATE/DELETE) is functionally ignored — the Provider passes context but does not block render."
          confidence: PROBE-NEEDED
          evidence: "P-193"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "Three layers: (a) the in-page WithPermissions wrapper around the +Add new button (LookupTables.tsx:72-82) — UI-visible gate; (b) backend RBAC at SecurityConstants.SECURITY_RULES for POST /api/referencedata/table → LOOKUP_TABLE_CREATE (cross-ref ReferenceDataController sidecar) — wire-level gate; (c) NOT at the route mount level (the Provider is not a render gate, confirmed in masterDataRoutes sidecar)."
          confidence: STATIC-INFERRED
          evidence: "LookupTables.tsx:72-82 + WithPermissions.tsx + cross-ref: ReferenceDataController sidecar implicit_adrs.[1] + cross-ref: masterDataRoutes sidecar stress_findings.auth_gates[0]"
  resource_boundaries:
    - location: "LookupTables.tsx:30-37 (useEffect to bootstrap searchId)"
      kind: "concurrency"
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "The useEffect has `[searchId]` as its dep-array. On first mount, searchId is `''`, the early-return at line 31 is skipped, createFacets is called. If React strict-mode causes a double-mount (development only), createFacets fires twice — minting two search sessions. The URL update setSearchParams happens only after .then(), so the second mount's check at line 31 sees searchId still empty and fires AGAIN. In production (non-strict), this is a non-issue; in development, two search-session rows in search_facets are created per mount."
          confidence: STATIC-INFERRED
          evidence: "LookupTables.tsx:30-37"
        - q: "Is the call replay-safe?"
          a: "createFacets('') is a POST that creates a new search session each call. Not idempotent; each call mints a new UUID. The URL update via setSearchParams persists only the FIRST returned id; the second session row becomes orphaned (will be cleaned by SearchFacetsHousekeepingJob after housekeeping.ttl.search_facets_days, per F-010)."
          confidence: STATIC-INFERRED
          evidence: "LookupTables.tsx:33-36 + cross-ref F-010 (search_facets TTL housekeeping)"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "React-query stale-time defaults apply (typically 0ms by tanstack default, but the project may configure differently — out of scope for this file). On query invalidation, the search-results query is invalidated only on lookup-table mutations (useCreateLookupTable / useUpdateLookupTable / useDeleteLookupTable all invalidate ['searchLookupTables'] — lookupTables.ts:78-79, 92). Search session itself is not invalidated when facets update via updateFacets — only the results pagination is."
          confidence: STATIC-INFERRED
          evidence: "lookupTables.ts:77-94 + referenceDataSearch.ts:35-40"
  request_inputs:
    - location: "LookupTables.tsx:20-21"
      input_kind: "query-param"
      input_name: "searchId"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The URL parameter promises a stable, shareable identifier for the user's current search session — a deep-link to a specific filtered view of lookup tables."
          confidence: STATIC-INFERRED
          evidence: "LookupTables.tsx:20-21"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Read from searchParams (line 20-21), passed to useGetReferenceDataSearch ({ searchId, enabled: !!searchId }) at line 25-28 → fetches the persisted facet state. Also passed to useUpdateReferenceDataSearch(searchId) at line 23 — binds the mutation to this session. Also passed to useSearchLookupTables via the sibling LookupTablesList (LookupTablesList.tsx:19-25)."
          confidence: STATIC-INFERRED
          evidence: "LookupTables.tsx:20-28 + referenceDataSearch.ts:11-40"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — the searchId is a UUID; it identifies a row in `search_facets`; the persisted state contains the query + selected filters; reload preserves the state. The promise (stable share-able session) matches the implementation. The only nuance: empty searchId on first visit triggers a fresh session — operator-visible only as a URL-update after mount."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "LookupTables.tsx:30-37 + LookupDataSearchServiceImpl.java:27-50"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — no silent translation."
          confidence: STATIC-INFERRED
          evidence: ""
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE — search_facets.id is the matching column and it IS used (per LookupDataSearchServiceImpl.fetchFacetState)."
          confidence: STATIC-INFERRED
          evidence: "LookupDataSearchServiceImpl.java:70-73"
      routes_to_finding: ""
    - location: "LookupTableForm.tsx:60-66 (edit-submit branch)"
      input_kind: "body-field"
      input_name: "lookupTableUpdateFormData (with namespaceName field)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The mutation parameter name (`lookupTableUpdateFormData`) promises the body shape matches the OpenAPI `LookupTableUpdateFormData` schema."
          confidence: STATIC-INFERRED
          evidence: "lookupTables.ts:66-76"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Form types data as `LookupTableFormData` (CREATE shape with namespaceName) at line 49. On edit submit (line 62-66), submits the same shape to `editLookupTable({ lookupTableUpdateFormData: data, lookupTableId })`. The mutation calls `referenceDataApi.updateLookupTable({ lookupTableId, lookupTableUpdateFormData })` — the generated client serializes the body as JSON. namespace_name ends up on the wire."
          confidence: STATIC-INFERRED
          evidence: "LookupTableForm.tsx:49, 60-66 + lookupTables.ts:69-76"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY — the parameter NAME says 'lookupTableUpdateFormData' implying the UPDATE schema, but the SHAPE on the wire is the CREATE schema (namespace_name included). Spring's default JSON binding (Jackson FAIL_ON_UNKNOWN_PROPERTIES = false) silently discards the extra field. Operator inspecting the network tab sees namespace_name on every edit. PROBE-NEEDED to confirm the discard-vs-reject behaviour."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: PROBE-NEEDED
          evidence: "P-191"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "Two operator-visible failure modes (probe-pending): (a) silent-discard — namespace_name is dropped server-side, the namespace stays the same, no error; operator inspecting the network tab sees the field on the wire but the DB unchanged. (b) strict-rejection — server returns 400 for the unknown field, edit always fails. Either way, the UX-disabled namespaceName field is a UI hint, not a data-integrity guarantee."
          confidence: PROBE-NEEDED
          evidence: "P-191"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "Yes — the form's `defaultValues.namespaceName` is computed from `lookupTable.namespace.name` on edit (LookupTableForm.tsx:44). This IS in the form state, IS submitted on the wire, but is NOT a valid UpdateFormData field. The available-but-unused-correctly smell: there is no separate `LookupTableUpdateFormData`-typed useForm; one form type is shared across create and update."
          confidence: STATIC-INFERRED
          evidence: "LookupTableForm.tsx:40-49 + components.yaml:3840-3862"
      routes_to_finding: "bugs_limitations_corner_cases.[2] (edit-form DTO drift) + docs_link_semantic.doc_drift_findings.[0]"
    - location: "LookupTables.tsx:50-52 (search-input handler)"
      input_kind: "body-field"
      input_name: "query"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "Full-text search over lookup tables — the search box says 'Search lookup tables...' (line 67)."
          confidence: STATIC-INFERRED
          evidence: "LookupTables.tsx:50-71"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "handleSearch (line 50) calls updateFacets({...facets, query}) which sends PUT /api/referencedata/search/{searchId} with the new query. Server-side LookupDataSearchServiceImpl.updateFacets merges with existing FacetStateDto and recomputes the count. Subsequent paginated /results call uses the persisted state."
          confidence: STATIC-INFERRED
          evidence: "LookupTables.tsx:50-52 + referenceDataSearch.ts:28-40 + LookupDataSearchServiceImpl.java:42-50"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — the query string flows verbatim from input box to FacetStateDto.query to the SQL search predicate. No translation."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "LookupDataSearchServiceImpl.java:27-34 + referenceDataSearch.ts:28-40"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — no silent translation. (Per-keystroke fire is a performance concern, not a name-vs-behaviour drift.)"
          confidence: STATIC-INFERRED
          evidence: ""
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE — query is the canonical search field and it IS used."
          confidence: STATIC-INFERRED
          evidence: "LookupDataSearchServiceImpl.java:27-34"
      routes_to_finding: ""
  probes_emitted:
    - probe_id: P-193
      question: "Does the LookupTables page render fully when the user has zero of LOOKUP_TABLE_* permissions, and does the counter leak the global lookup-table count?"
      probe_path: "lineage/odd-platform/probes/P-193.yaml"
    - probe_id: P-191
      question: "Does editing a lookup table send namespace_name on the wire even though LookupTableUpdateFormData rejects it — and does the server silently discard it?"
      probe_path: "lineage/odd-platform/probes/P-191.yaml"
    - probe_id: P-192
      question: "Does the InfiniteScroll scrollableTarget mismatch ('directory-entities-list' vs container id 'lookup-tables-list') prevent fetchNextPage from firing when scrolling within the container, capping the UI at 30 rows?"
      probe_path: "lineage/odd-platform/probes/P-192.yaml"
  stress_summary:
    triggers_total: 8
    questions_total: 25
    answers_static_inferred: 17
    answers_probe_needed: 6
    answers_reference: 2
    drift_flags: 2
```

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP | DISABLED` — component lives behind the platform-wide auth filter. Under DISABLED, anyone reaching `/master-data/lookup-tables` sees the page (no Add/Edit/Delete buttons unless the empty-user has CREATE/UPDATE/DELETE in the DISABLED-default-admin profile per platform-wide DISABLED stance). Under LOGIN_FORM/OAUTH2/LDAP, the HTTP filter redirects to login first.
- **ingestion_filter_relevance**: `NO — UI/API surface, not ingestion`. This component calls `/api/referencedata/*` only.
- **authorization_assertions**:
  - "`<WithPermissions permissionTo={Permission.LOOKUP_TABLE_CREATE}>` around the +Add new button" — evidence: LookupTables.tsx:72-82
- **owner_scoping**: `BYPASSES — the counter and list show all tables regardless of caller`. The `total` rendered at line 60-62 is the global count of lookup tables matching the search query — not owner-scoped. Per ReferenceDataController sidecar known_security_gaps[0], read endpoints have no RBAC at all in `SecurityConstants.SECURITY_RULES`. evidence: LookupTables.tsx:60-62 + cross-ref ReferenceDataController sidecar
- **data_exposure**:
  - "Global lookup-table count → any authenticated user (via the 'X lookup tables overall' counter at LookupTables.tsx:60-62) — even users with no LOOKUP_TABLE permissions see the count of all tables in the platform"
  - "Per-row name + description + namespace.name → any authenticated user via the table list (LookupTablesListItem.tsx:31-44) — read endpoints are not RBAC-gated"
  - "Per-row tableId → Link to dataEntityDetailsPath(item.datasetId) (LookupTablesListItem.tsx:30) exposes the parent DataEntity id, which then becomes a deep-link to the catalog detail page"
- **known_security_gaps**:
  - "Page renders for any authenticated user regardless of LOOKUP_TABLE permissions — the route-level WithPermissionsProvider lists CREATE/UPDATE/DELETE but PermissionProvider.tsx:12-44 does not short-circuit rendering. Only the in-page +Add new button is gated. — evidence: LookupTables.tsx:72-82 + cross-ref PermissionProvider.tsx (no render-gate) + cross-ref masterDataRoutes sidecar bugs_limitations_corner_cases.[1] — severity: MEDIUM"
  - "Global count leak via the 'X lookup tables overall' counter — every authenticated user sees the platform-wide population size. No owner-filter applied at LookupDataSearchServiceImpl.countByState. — evidence: LookupTables.tsx:60-62 + LookupDataSearchServiceImpl.java:62-68 — severity: MEDIUM"
  - "Row content (name + description + namespace) visible to any authenticated user; description-field XSS risk inherited from F-004 description-editing surface (per ReferenceDataController sidecar bugs_limitations_corner_cases.[1] — values pass through `LookupCharValidator.getValue` which returns input unchanged). — evidence: LookupTablesListItem.tsx:30-44 + cross-ref ReferenceDataController sidecar — severity: MEDIUM"

## performance

- **hot_paths**:
  - "Mount → POST /api/referencedata/search → setSearchParams → re-render → GET /api/referencedata/search/{id} → setFacets → render. Four-step round-trip on every first visit (without ?searchId URL param). — evidence: LookupTables.tsx:30-43"
  - "Per-keystroke search: handleSearch (line 50) fires updateFacets per keystroke if SearchInput does not debounce internally. Each keystroke → PUT /api/referencedata/search/{id} → server-side FacetStateDto.merge + countByState recompute. — evidence: LookupTables.tsx:50-71"
- **throughput_characteristics**:
  - "Single-PUT per search update; no batching of consecutive keystrokes at this layer."
  - "Paginated list via useInfiniteQuery with size=30 per page; fetchNextPage triggered by InfiniteScroll (broken — see P-192)."
- **resource_allocation**:
  - "Holds `facets` state in component memory (one ReferenceDataSearchFacetsData object — searchId + query + total)."
  - "List rendering: `data?.pages.flatMap(page => page.items)` builds a flat array of ALL loaded rows on every render (LookupTablesList.tsx:27-30). At N rows loaded, every render copies N references. Acceptable for <1000 rows (the only visible cap is the 30-per-page * however-many-pages-the-user-scrolls); concerning if the user scrolls through 10k+ tables."
- **scaling_characteristics**:
  - "Stateless React component — instances trivially horizontal-scaleable (browser-side)."
  - "Server-side search session in `search_facets` table; one row per user search start. Cleaned by SearchFacetsHousekeepingJob (per F-010 / cross-ref ReferenceDataController sidecar)."
  - "No pagination cap visible on this file — the backend's pagination is the only ceiling. The InfiniteScroll bug effectively caps the visible list at 30 — see P-192."
- **known_performance_gaps**:
  - "Per-keystroke PUT to /api/referencedata/search/{id} if SearchInput is not debounced — needs verification on the shared SearchInput component. — evidence: LookupTables.tsx:50-71 — severity: MEDIUM"
  - "First-mount double-round-trip: createFacets (POST) + getReferenceDataSearchFacetList (GET) when the user already has a session id but visits without the URL param. Could be a single POST that returns the full state. — evidence: LookupTables.tsx:30-43 + referenceDataSearch.ts:11-26 — severity: LOW"
  - "InfiniteScroll mis-target (P-192) — has performance implications (server-side count works, but client never requests pages 2+, so the visible list undercounts). — evidence: LookupTablesList.tsx:51-53 — severity: HIGH"

## upstream_callers

- entry_point: "ui_route:/master-data/lookup-tables"
  caller_node: "ts react-route:App.tsx:75-88"
  multiplicity_per_trigger: 1
  evidence: "App.tsx:75-88 — <Route path={lookupTablesPath()} element={<WithPermissionsProvider .../>}>; the LookupTables component is mounted exactly once per route visit"
  observation_class: "ui-call"

- entry_point: "ui_route:/master-data/lookup-tables (navigated from Master Data toolbar tab)"
  caller_node: "ts react-component:ToolbarTabs.tsx:55-59"
  multiplicity_per_trigger: 1
  evidence: "ToolbarTabs.tsx:55-59 — the 'Master Data' tab links to lookupTablesPath(); navigation triggers the App.tsx route mount of LookupTables"
  observation_class: "ui-call"

- entry_point: "ui_route:/master-data/lookup-tables (navigated post-create / post-edit)"
  caller_node: "ts react-component:LookupTableForm.tsx:67-70 (navigate(lookupTablesPath()))"
  multiplicity_per_trigger: 1
  evidence: "LookupTableForm.tsx:67-70 — onSubmit then-chain calls navigate(lookupTablesPath()); LookupTables is the redirect target after a successful create or edit"
  observation_class: "ui-call"

## downstream_side_effects

- side_effect_class: "external-call"
  description: "Mints a new search session by POST /api/referencedata/search (with empty query) on first mount when no ?searchId URL param is present"
  evidence: "LookupTables.tsx:33-36 + referenceDataSearch.ts:20-26 + ReferenceDataController.java:103-109 (referenceDataSearch endpoint)"
  cardinality_per_call: "1 per first mount (zero if ?searchId already in URL)"
  reachable_from_entry_points:
    - "ui_route:/master-data/lookup-tables"

- side_effect_class: "external-call"
  description: "Loads existing search session state by GET /api/referencedata/search/{searchId} when searchId is set"
  evidence: "LookupTables.tsx:25-28 + referenceDataSearch.ts:11-18 + ReferenceDataController.java:64-69"
  cardinality_per_call: "1 per render with non-empty searchId"
  reachable_from_entry_points:
    - "ui_route:/master-data/lookup-tables"

- side_effect_class: "external-call"
  description: "Updates search session facets by PUT /api/referencedata/search/{searchId} per keystroke in the search box (unless SearchInput debounces)"
  evidence: "LookupTables.tsx:50-52 + referenceDataSearch.ts:28-40 + ReferenceDataController.java:111-119"
  cardinality_per_call: "1 per onSearch fire (debounce unknown — see performance.hot_paths)"
  reachable_from_entry_points:
    - "ui_route:/master-data/lookup-tables"

- side_effect_class: "external-call"
  description: "Fetches paginated lookup tables for the current search via GET /api/referencedata/search/{searchId}/results (via sibling LookupTablesList)"
  evidence: "LookupTablesList.tsx:21-25 + lookupTables.ts:21-41 + ReferenceDataController.java:71-78"
  cardinality_per_call: "1 per page on initial render; further 0..N as InfiniteScroll fetches next pages (currently broken — see P-192)"
  reachable_from_entry_points:
    - "ui_route:/master-data/lookup-tables"

- side_effect_class: "page-render"
  description: "Renders the Lookup Tables list page chrome: H1 + global counter + search input + Add-new button (gated) + table list"
  evidence: "LookupTables.tsx:54-90"
  cardinality_per_call: "1 per route mount; re-renders on facets / data state changes"
  reachable_from_entry_points:
    - "ui_route:/master-data/lookup-tables"

- side_effect_class: "external-call"
  description: "Reachable through child <LookupTableForm>: POST /api/referencedata/table (create) or PUT /api/referencedata/table/{id} (edit) on form submit"
  evidence: "LookupTableForm.tsx:60-66 + lookupTables.ts:54-82 + ReferenceDataController.java:33-39, 121-129"
  cardinality_per_call: "1 per form submit (user-initiated, not auto-firing)"
  reachable_from_entry_points:
    - "ui_route:/master-data/lookup-tables (Add new button)"
    - "ui_route:/master-data/lookup-tables (Edit per-row button via LookupTablesListItem)"

- side_effect_class: "external-call"
  description: "Reachable through child <LookupTablesListItem>: DELETE /api/referencedata/table/{id} via the per-row Delete button + confirmation dialog"
  evidence: "LookupTablesListItem.tsx:22-25, 60-78 + lookupTables.ts:84-95 + ReferenceDataController.java:153-157"
  cardinality_per_call: "1 per confirmed delete (user-initiated)"
  reachable_from_entry_points:
    - "ui_route:/master-data/lookup-tables (Delete per-row button)"

## sources

- understanding ← LookupTables.tsx:18-93 + masterDataRoutes.ts:1-5 + App.tsx:41, 75-88
- concepts.entities.LookupTable ← LookupTables.tsx:11 (Permission.LOOKUP_TABLE_CREATE import)
- concepts.entities.ReferenceDataSearchSession ← LookupTables.tsx:11, 20-37 + referenceDataSearch.ts:11-40
- concepts.operations.bootstrap-search-session ← LookupTables.tsx:30-37
- concepts.operations.persist-search-id-to-url ← LookupTables.tsx:34
- dependencies_semantic.requires-feature.Reference-Data-Search-session ← LookupTables.tsx:6-10 + referenceDataSearch.ts:11-40 + ReferenceDataController.java:64-78, 103-119
- dependencies_semantic.requires-runtime.react-router ← LookupTables.tsx:5
- tests_coverage_semantic.uncovered_behaviours.InfiniteScroll-fetchNextPage ← LookupTablesList.tsx:51-53 + P-192
- tests_coverage_semantic.uncovered_behaviours.Edit-form-namespace_name ← LookupTableForm.tsx:49, 60-66 + components.yaml:3853-3862 + P-191
- docs_link_semantic.inferred_docs[0] ← LookupTables.tsx:18-93 + WebFetch https://docs.opendatadiscovery.org/features/master-data-management/lookup-tables (2026-05-26, status 200)
- docs_link_semantic.doc_drift_findings[0] ← LookupTableForm.tsx:49, 63, 117-123 + components.yaml:3853-3862 + WebFetched live doc page
- implicit_adrs[0] ← LookupTables.tsx:20-37
- implicit_adrs[1] ← LookupTables.tsx:72-82 + ReferenceDataServiceImpl.java:73-86
- implicit_adrs[2] ← LookupTables.tsx:72-82 + LookupTableForm.tsx:138-150
- bugs_limitations_corner_cases[0] ← LookupTables.tsx:25-37, 60-62
- bugs_limitations_corner_cases[1] ← LookupTablesList.tsx:51-53 + P-192
- bugs_limitations_corner_cases[2] ← LookupTableForm.tsx:49, 60-66, 117-123 + components.yaml:3853-3862 + P-191
- bugs_limitations_corner_cases[3] ← LookupTables.tsx:39-43
- bugs_limitations_corner_cases[4] ← LookupTables.tsx:60-62 + LookupDataSearchServiceImpl.java:62-68
- bugs_limitations_corner_cases[5] ← LookupTables.tsx:50-52, 70
- security.authorization_assertions[0] ← LookupTables.tsx:72-82
- security.owner_scoping ← LookupTables.tsx:60-62 + cross-ref ReferenceDataController sidecar
- security.known_security_gaps[0] ← LookupTables.tsx:72-82 + cross-ref PermissionProvider.tsx + cross-ref masterDataRoutes sidecar
- security.known_security_gaps[1] ← LookupTables.tsx:60-62 + LookupDataSearchServiceImpl.java:62-68
- performance.hot_paths[0] ← LookupTables.tsx:30-43
- performance.hot_paths[1] ← LookupTables.tsx:50-71
- performance.known_performance_gaps[2] ← LookupTablesList.tsx:51-53 + P-192
- upstream_callers[0] ← App.tsx:75-88
- upstream_callers[1] ← ToolbarTabs.tsx:55-59
- upstream_callers[2] ← LookupTableForm.tsx:67-70
- downstream_side_effects[0] ← LookupTables.tsx:33-36 + referenceDataSearch.ts:20-26
- downstream_side_effects[1] ← LookupTables.tsx:25-28 + referenceDataSearch.ts:11-18
- downstream_side_effects[2] ← LookupTables.tsx:50-52 + referenceDataSearch.ts:28-40
- downstream_side_effects[3] ← LookupTablesList.tsx:21-25 + lookupTables.ts:21-41
- downstream_side_effects[4] ← LookupTables.tsx:54-90
- downstream_side_effects[5] ← LookupTableForm.tsx:60-66 + lookupTables.ts:54-82
- downstream_side_effects[6] ← LookupTablesListItem.tsx:22-25, 60-78 + lookupTables.ts:84-95

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: MEDIUM      # uncovered behaviours derived from PROBE-NEEDED hypotheses; the test_files list is empty
- docs_link_semantic: HIGH               # live WebFetch 2026-05-26 status 200; quoted excerpts cited verbatim
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: MEDIUM  # three load-bearing claims (InfiniteScroll bug, namespace_name drift, counter leak) are PROBE-NEEDED
- security: MEDIUM                       # cross-references back the masterDataRoutes + ReferenceDataController sidecars; the rendering-without-permissions claim is PROBE-NEEDED
- performance: MEDIUM                    # per-keystroke debounce policy is in shared infra and not verified here; InfiniteScroll perf implication PROBE-NEEDED
- upstream_callers: HIGH
- downstream_side_effects: HIGH
- stress_findings: MEDIUM                # 6 of 25 questions are PROBE-NEEDED — the three operator-load-bearing claims (P-191, P-192, P-193) determine whether the bugs are real

## Maintainer notes

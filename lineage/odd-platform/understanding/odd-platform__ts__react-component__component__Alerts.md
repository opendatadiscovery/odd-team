---
node_id: "odd-platform ts react-component component:Alerts"
node_kind: react-component
axis: components
extracted_at_commit: substrate-manifest-inherited
enriched_at_commit: substrate-manifest-inherited
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-26-01
---

# Alerts (component:Alerts) — semantic understanding

## understanding

The `Alerts` component is the page-root for ODD's global Alerts surface mounted
at `/alerts/*` (App.tsx:64). It is a thin shell: it dispatches one bootstrap
thunk (`fetchAlertsTotals`) on mount to populate the All / My Objects /
Dependents tab badges, then composes a fixed-page layout containing
`AlertsTabs` (the three-tab primary navigation) and `AlertsRoutes` (the
nested `Routes` that route `/alerts/all`, `/alerts/my`, `/alerts/dependents`
to a single `AlertsList` instance pre-bound to the corresponding `fetch*`
thunk). The tab-switch path dispatches `changeAlertsFilterAction` which
CLEARS `state.alerts.items` in the slice — the three tabs share ONE Redux
state slot, so a tab switch resets the infinite-scroll cursor and visually
restarts the list.

## concepts

- entities: [Alert, AlertTotals, OwnerAssociation, DataEntity]
- operations: [render-alerts-page-shell, fetch-totals-on-mount, route-to-tab, derive-owner-tab-visibility]
- invariants:
  - Tabs `My Objects` and `Dependents` are hidden when the signed-in user has
    no owner association (`getOwnership` returns falsy → `showMyAndDepends=false`).
  - All three tabs share `state.alerts.items` — tab switch always clears items
    via `changeAlertsFilterAction`.
  - Default route `/alerts` redirects to `/alerts/all` (`AlertsRoutes.tsx:18`).
- audiences: [stewards / admins for triage on All; data owners on My Objects / Dependents]

## dependencies_semantic

- requires-feature:
  - **F-007 Alerting Integration** — this is the page-root UI for the alerting
    feature; aggregates totals across All / Owner / Dependents scopes.
  - **F-008 Authorization / User-Owner Association** — `getOwnership` selector
    derives tab visibility from the current user's `profile.owner` association
    (populated by `fetchIdentity`, dispatched at `App.tsx:48`).
  - **F-018 Internationalisation** — `useTranslation()` wraps the page heading
    and the three tab labels (`Alerts`, `All`, `My Objects`, `Dependents`).
- requires-config: []  # no UI-side config keys touched
- requires-runtime:
  - Redux store (`alertsSlice` registered; `profileSlice` for owner association).
  - React Router `Routes` ancestor (mounted on `/alerts/*` by `App.tsx:64`).
  - i18n `react-i18next` provider for `useTranslation`.
  - Backend `GET /api/alerts/totals` reachable at app boot for the badge counts.

## tests_coverage_semantic

- covered_behaviours: []  # no `*.test.tsx` files exist for Alerts.tsx, AlertsTabs.tsx, AlertsRoutes.tsx, AlertsList.tsx, or AlertItem.tsx — verified via Glob `**/Alerts/**/*.test.*` returned zero matches and Grep for "Alerts.*test" returned no test files referencing these modules.
- uncovered_behaviours:
  - behaviour: "Tabs `My Objects` and `Dependents` are hidden when getOwnership selector returns falsy."
    test_class: unit
    criticality: MEDIUM
    note: "regression magnet — UI-side visibility check; owner-association edge fires here"
  - behaviour: "Tab-switch clears state.alerts.items before fetching the next tab's first page."
    test_class: integration
    criticality: HIGH
    note: "without this clear, the previous tab's items would render briefly during the new tab's fetch (flicker / wrong-content-while-loading)"
  - behaviour: "Default `/alerts` redirects to `/alerts/all`."
    test_class: unit
    criticality: LOW
  - behaviour: "InfiniteScroll fetches next page when pageInfo.hasNext is true; halts when false."
    test_class: integration
    criticality: HIGH
  - behaviour: "Resolve button on an Alert dispatches updateAlertStatus only after DATA_ENTITY_ALERT_RESOLVE permission resolves; shows `No access!` caveat when it does not."
    test_class: security
    criticality: HIGH
    note: "Authorization is enforced AFTER click — caller observes the button, clicks it, and only then sees access denied. Operator-visible UX leak: existence of the resolve action is visible to a viewer who cannot perform it."
- test_files: []  # none found in the UI repo
- gaps: |
    The entire UI surface of the global Alerts page is uncovered. The
    highest-leverage gap is the tab-clear + infinite-scroll integration
    behaviour — a regression there silently corrupts the displayed list
    on tab switch. The second-highest gap is the late-binding
    DATA_ENTITY_ALERT_RESOLVE permission check (security test class).

## docs_link_semantic

- declared_docs: []  # no @docs / // @docs: annotation in Alerts.tsx
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/active-platform-features/alerting"
    anchor: "(no in-page anchor for the list UI)"
    rationale: "Surfaced via docs-root `?ask=alerts` query (WebFetch 2026-05-26); page describes the All / My Objects / Dependents tab semantics this component mounts."
    last_verified_at: "2026-05-26T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      "Every open and resolved alert across the whole platform." (All tab)
      "Alerts raised on data entities where the signed-in user is a registered owner."  (My Objects tab)
      "Alerts raised on data entities that are downstream of entities the signed-in user owns (via lineage)." (Dependents tab)
      "The `My Objects` and `Dependents` tabs are hidden unless the signed-in user is linked to an Owner — without the association, the platform cannot evaluate 'mine' or 'downstream of mine'."
- doc_drift_findings:
  - "DRIFT: docs says All tab shows 'Every open and resolved alert across the whole platform' but ReactiveAlertRepositoryImpl.java:142-145 hard-filters `ALERT.STATUS.eq(OPEN.getCode())`. The list NEVER shows RESOLVED or RESOLVED_AUTOMATICALLY alerts in the global tabs — only on a single data entity's Alerts tab via getAlertsByDataEntityId (no status filter, line 182-199). Operator who follows the docs expects to see resolved alerts and cannot find them; mistakes them for purged."
  - "GAP: live doc page does NOT document (a) the sort order (LAST_CREATED_AT DESC, ID DESC tiebreak), (b) the permission needed to Resolve / Reopen (DATA_ENTITY_ALERT_RESOLVE), or (c) the page size (30). All three are operator-visible behaviours."
  - "GAP: doc states the Dependents tab uses 'lineage' but does not explain that it uses a recursive CTE walking LINEAGE.IS_DELETED=false from owned-entity oddrns (ReactiveAlertRepositoryImpl.java:429-454). Operators with broken/missing lineage edges see empty Dependents — no signal that lineage is the join."

## implicit_adrs

- "Tab visibility is derived from owner association at the UI layer, not at the API endpoint." — evidence: AlertsTabs.tsx:30-37 (hidden flag bound to `showMyAndDepends`) — intent_anchor: "`hidden: !showMyAndDepends`" (the conditional UI signal is the decision) — confidence: HIGH
- "All three list-fetch thunks (fetchAllAlertList, fetchMyAlertList, fetchMyDependentsAlertList) write into the same Redux slot via a shared `updateAlerts` reducer." — evidence: alerts.slice.ts:42-49 (`builder.addCase(...updateAlerts)` ×3) — intent_anchor: "shared reducer function `updateAlerts` reused for three thunk types" — confidence: HIGH
- "Tab-switch performs an explicit clear of items before the new fetch — the navigation event drives state reset, not the thunk." — evidence: AlertsTabs.tsx:44-46 (`changeAlertsFilterAction` dispatched on handleTabChange) + alerts.slice.ts:38-40 (`changeAlertsFilterAction: state => { state.alerts.items = []; }`) — intent_anchor: "explicit named action `changeAlertsFilterAction` whose only effect is to reset items" — confidence: HIGH

## bugs_limitations_corner_cases

- "All-tab name vs behaviour mismatch: docs say 'open and resolved'; backend SQL filters STATUS=OPEN only (ReactiveAlertRepositoryImpl.java:145, 166, 230). RESOLVED and RESOLVED_AUTOMATICALLY alerts are invisible in every global tab." — evidence: ReactiveAlertRepositoryImpl.java:142-145 (listAllWithStatusOpen), 160-179 (listByOwner), 217-243 (listDependentObjectsAlerts) — severity: HIGH
- "Resolve / Reopen button is rendered for every alert without first checking permission — the permission probe (fetchResourcePermissions) only fires AFTER click (AlertItem.tsx:48-70). UX leak: the action is visible to users who cannot perform it; users only learn they have no access by trying." — evidence: AlertItem.tsx:159-166 (Button text='Resolve'/'Reopen' rendered unconditionally) + AlertItem.tsx:55-67 (permission check on click) — severity: MEDIUM
- "Tab badge totals (totals, myTotal, dependentTotal) are fetched ONCE on mount (Alerts.tsx:15-17, `useEffect([])` no deps) — they do not refresh after a Resolve action, after navigating tabs, or after the backend creates new alerts. An operator who resolves alerts watches the badge stay stale until full reload." — evidence: Alerts.tsx:15-17 — severity: MEDIUM
- "Frontend route /alerts/* has NO WithPermissionsProvider wrapper (unlike LookupTables route at App.tsx:75-87). Any authenticated user can reach /alerts/all and trigger getAllAlerts; access enforcement lives entirely in Spring Security backend config (none visible on the controller — see batch H AlertController sidecar) plus the per-action DATA_ENTITY_ALERT_RESOLVE check at click time. There is no UI route guard." — evidence: App.tsx:64 (no wrapper) vs App.tsx:75-87 (wrapper used for LookupTables) — severity: LOW
- "InfiniteScroll auto-fetches based on `scrollThreshold='200px'` (AlertsList.tsx:91) — fast-scroll on a large list will issue page=N+1 requests faster than the backend can return, but the slice's pageInfo.page mirrors the response page (alerts.thunks.ts:41), so a stale-response could overwrite a fresher-response slot. No request cancellation on tab-switch — switching tabs while a fetch is in-flight may cause the late response to land into the (just-cleared) new-tab state." — evidence: AlertsList.tsx:73-91 + alerts.slice.ts:25-32 — severity: MEDIUM
- "Page size hard-coded to 30 (AlertsList.tsx:72: `const size = 30;`); no operator override, no user preference. With 30K open alerts the list requires 1000 manual scroll pages to traverse." — evidence: AlertsList.tsx:72 — severity: LOW
- "Tab list rendering when API totals are absent: AlertsTabs.tsx:23,28,34 fall back to `?? 0` — when fetchAlertsTotals fails (network error / 403) all three tabs show '0' with no visible failure indicator. Operator may interpret as 'no alerts' rather than 'backend unreachable'." — evidence: AlertsTabs.tsx:23,28,34 + Alerts.tsx:15-17 (no error path) — severity: MEDIUM

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "AlertsList.tsx:72"
      name: "size"
      value: "30 (hard-coded page size)"
      questions:
        - q: "What at N = 0?"
          a: "size cannot be 0 — literal `30`; not configurable from the UI. Backend AlertController.getAllAlerts (line 36-41) trusts the value and passes to listAll(page, size); ReactiveAlertRepositoryImpl computes offset = (page-1) * size (line 147), so size=0 would yield a LIMIT 0 query (zero rows) and an empty page response."
          confidence: STATIC-INFERRED
          evidence: "AlertsList.tsx:72 (literal) + ReactiveAlertRepositoryImpl.java:147"
        - q: "What at N = 30 + 1 = 31 items present?"
          a: "First fetch returns 30; pageInfo.hasNext = true (from JooqQueryHelper.pageifyResult); InfiniteScroll's scrollThreshold='200px' triggers fetchNextPage which dispatches fetchAlerts({page:2, size:30}); the slice's pageInfo.page > 1 branch (alerts.slice.ts:30) APPENDS the 1 remaining item to state.alerts.items."
          confidence: STATIC-INFERRED
          evidence: "AlertsList.tsx:74-77 + alerts.slice.ts:30 + alerts.thunks.ts:38-44"
        - q: "What at tunable × 100 = 3000 items?"
          a: "Backend lists in fixed pages of 30 indefinitely (no max-page guard in repository); UI's InfiniteScroll appends to a single JS array on the heap. With 3000 alerts the items array holds 3000 React-rendered AlertItem rows (DOM virtualisation is NOT used — AlertsList.tsx:84-99 wraps a Grid container directly, not a react-window list). Memory and scroll-render cost grow O(N)."
          confidence: PROBE-NEEDED
          evidence: "P-194 — memory + DOM-render probe at N=3000 unresolved alerts"
        - q: "What does the operator see at the boundary (size = 30, 30 of 31 visible until scroll)?"
          a: "Operator sees 30 items + infinite-scroll spinner triggers on scroll-past-200px-from-bottom. There is no visible 'showing 30 of N' indicator — the slice tracks total in pageInfo.total but AlertsList.tsx does not render it."
          confidence: STATIC-INFERRED
          evidence: "AlertsList.tsx:84-106 (no total displayed)"
  name_behavior_pairs:
    - name: "Alerts (page-root)"
      promise: "Page that surfaces ODD's alert inbox — the three views (All / My / Dependents) the docs describe."
      implementation: "Page mounts shell, dispatches fetchAlertsTotals once on mount, composes AlertsTabs + AlertsRoutes. The list filtering / sort / OPEN-only behaviour lives in the backend repository — UI is a thin pass-through."
      drift: MINOR
      operator_visible_consequence: "The component itself is shell-only — the surprising behaviour (only-OPEN filtering) lives downstream and is invisible to a reader of this component."
      confidence: STATIC-INFERRED
      evidence: "Alerts.tsx:1-33"
    - name: "AlertsTabs labels — 'All', 'My Objects', 'Dependents'"
      promise: "'All' tab shows the full alert population across the platform (per live docs: 'Every open and resolved alert')."
      implementation: "Backend getAllAlerts → listAll → listAllWithStatusOpen filters STATUS=OPEN only. Resolved alerts are absent. UI label promises 'All'; UI shows OPEN-only subset."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "An operator searching for a resolved alert on the global page cannot find it. They may assume the alert was purged. This is the same Category B failure class as LSN-019 (TagController.listMostPopular)."
      confidence: STATIC-INFERRED
      evidence: "AlertsTabs.tsx:22 (label 'All') + ReactiveAlertRepositoryImpl.java:142-145 (status filter)"
    - name: "changeAlertsFilterAction (slice reducer name)"
      promise: "Name implies a filter-change action (apply a filter, change criteria). The slice has no filter UI."
      implementation: "Reducer only clears `state.alerts.items = []`. There is no filter state — the name describes a semantic that does not exist."
      drift: MINOR
      operator_visible_consequence: "Developer-facing only: the reducer name misleads the next maintainer about what filtering capability the page has. Operator-visible effect: zero."
      confidence: STATIC-INFERRED
      evidence: "alerts.slice.ts:37-41"
  orderings:
    - location: "ReactiveAlertRepositoryImpl.java:474-483"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer?"
          a: "Pinned at the SQL layer (not in the UI) — `createAlertJoinQuery` declares `List.of(new OrderByField(ALERT.LAST_CREATED_AT, DESC), new OrderByField(ALERT.ID, DESC))` and passes it both to JooqQueryHelper.paginate (inner CTE) AND to the outer select (line 505). So all three global tabs sort by alert.last_created_at DESC, tiebreak by alert.id DESC."
          confidence: STATIC-INFERRED
          evidence: "ReactiveAlertRepositoryImpl.java:475-476"
        - q: "What is the tie-breaker when sort-key values are equal?"
          a: "ALERT.ID DESC (highest id first). Since id is monotonic per insert, alerts with identical last_created_at are returned newest-id-first (most recently inserted breaks tie)."
          confidence: STATIC-INFERRED
          evidence: "ReactiveAlertRepositoryImpl.java:476"
        - q: "Which subset is returned when result-set > page size?"
          a: "First page returns rows 1..30 by the (LAST_CREATED_AT DESC, ID DESC) ordering. pageInfo.hasNext signal lets InfiniteScroll page forward; each subsequent fetch advances offset by (page-1)*size."
          confidence: STATIC-INFERRED
          evidence: "ReactiveAlertRepositoryImpl.java:147 + AlertsList.tsx:74-77"
        - q: "Does any upstream layer re-sort or filter the result?"
          a: "No — UI receives the items array as-is from `castDatesToTimestamp(items)` (alerts.thunks.ts:41) and stores it directly into `state.alerts.items`. AlertItem rendering preserves Redux insertion order. No client-side sort or filter."
          confidence: STATIC-INFERRED
          evidence: "alerts.thunks.ts:38-44 + alerts.slice.ts:25-32"
  auth_gates:
    - location: "App.tsx:64"
      endpoint: "frontend route /alerts/*"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "UI route has no permission wrapper (compare LookupTables at App.tsx:75-87 which uses WithPermissionsProvider). All authenticated modes can navigate to /alerts/*. DISABLED mode (auth off) also reaches it. Backend gating decides whether the underlying GET /api/alerts/* call succeeds; UI does NOT pre-check."
          confidence: STATIC-INFERRED
          evidence: "App.tsx:64 (no wrapper) vs App.tsx:75-87 (with wrapper)"
        - q: "What does an unauthenticated caller see?"
          a: "Static SPA assets render; the App-level `fetchIdentity` (App.tsx:48) fails and `profile.owner` stays absent; getOwnership returns falsy; My/Dependents tabs hide; All tab attempts fetchAllAlertList which the backend either allows (DISABLED) or rejects (modes other than DISABLED — see ApiSecurityConfiguration). Without successful identity, the UI displays an empty All tab with totals.total=0."
          confidence: PROBE-NEEDED
          evidence: "P-194 (cross-mode reach probe needed — REFERENCE to batch H AlertController sidecar)"
        - q: "What does a wrong-role caller see?"
          a: "No role concept at this layer. The DATA_ENTITY_ALERT_RESOLVE permission gate (AlertItem.tsx:55-67) is per-action, post-click. A viewer with READ-only access sees the list, sees Resolve buttons, clicks one, then receives the 'No access!' caption."
          confidence: STATIC-INFERRED
          evidence: "AlertItem.tsx:55-67,159-166"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "(1) Frontend route — nowhere. (2) Per-action — UI-side runtime check via `fetchResourcePermissions` + globalPermissions inclusion test (AlertItem.tsx:55-67). (3) Backend list endpoints — see batch H AlertController sidecar; controller has no @PreAuthorize on getAllAlerts/getAssociatedUserAlerts/getDependentEntitiesAlerts. (4) Backend updateStatus — also no @PreAuthorize on changeAlertStatus; the access decision is duplicated to the UI."
          confidence: STATIC-INFERRED
          evidence: "AlertController.java (no @PreAuthorize, lines 17-58) + AlertItem.tsx:55-67"
  resource_boundaries:
    - location: "alerts.slice.ts:25-32"
      kind: concurrency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "Yes — limited corruption is reachable. Slice reducer `updateAlerts` always reads pageInfo.page from the action payload. If page-1 and page-2 fetches race AND page-2 returns first, the page-2 branch (pageInfo.page > 1) APPENDS items 31-60. Then page-1 returns, sees pageInfo.page == 1, REPLACES items with rows 1-30, dropping page-2's already-received rows. State is now coherent (rows 1-30) but the user briefly saw a longer list. No persistent corruption."
          confidence: STATIC-INFERRED
          evidence: "alerts.slice.ts:30 (`pageInfo.page > 1 ? [...prev, ...items] : items`)"
        - q: "Is the call replay-safe?"
          a: "Yes for the list-fetch thunks — each is a pure GET. Tab-switch + clear is idempotent. updateAlertStatus is NOT replay-safe at the API level (server-side reopen-guard at AlertServiceImpl.java:125-131 rejects a second OPEN if another OPEN of same type exists), but the UI does not surface that error."
          confidence: STATIC-INFERRED
          evidence: "alerts.thunks.ts:38,52,64 + AlertServiceImpl.java:125-131"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No cache. Each tab visit re-fetches; totals fetched once on mount (Alerts.tsx:15-17) and never invalidated — that IS the staleness gap. After Resolve, totals.total still reflects pre-Resolve count until full page reload."
          confidence: STATIC-INFERRED
          evidence: "Alerts.tsx:15-17 (empty dependency array on useEffect)"
  request_inputs:
    - location: "AlertsList.tsx:74-80"
      input_kind: query-param
      input_name: "page, size"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "page=N + size=M promises 'return items M*(N-1)+1 .. M*N of the current scope'. Standard paginate convention."
          confidence: STATIC-INFERRED
          evidence: "AlertsList.tsx:76,80"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "alerts.thunks.ts:39 → alertApi.getAllAlerts({page,size}) → backend AlertController.getAllAlerts (line 36-41) → alertService.listAll(page,size) → ReactiveAlertRepositoryImpl.listAllWithStatusOpen → createAlertJoinQuery computes offset=(page-1)*size + LIMIT size. Honours the name."
          confidence: STATIC-INFERRED
          evidence: "alerts.thunks.ts:39 + AlertController.java:39 + ReactiveAlertRepositoryImpl.java:147"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES for page/size pagination semantics. The scope of WHICH items are paginated is OPEN-only (drift documented in name_behavior_pairs above)."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ReactiveAlertRepositoryImpl.java:142-148"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — page/size faithfully bind."
          confidence: STATIC-INFERRED
          evidence: "ReactiveAlertRepositoryImpl.java:147"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE — page/size are the only pagination inputs; no orphaned columns at this layer."
          confidence: STATIC-INFERRED
          evidence: "ReactiveAlertRepositoryImpl.java:147"
      routes_to_finding: "—"
    - location: "AlertsRoutes.tsx:12-17"
      input_kind: path-param
      input_name: "tab route segment ('all' / 'my' / 'dependents')"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "'all' promises the full alert population; 'my' promises alerts where I am owner; 'dependents' promises alerts on entities downstream of mine."
          confidence: STATIC-INFERRED
          evidence: "AlertsRoutes.tsx:12-17 + AlertsTabs.tsx:22,28,34 (label text)"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Route segment selects a fixed thunk binding (fetchAllAlertList vs fetchMyAlertList vs fetchMyDependentsAlertList). No URL parameter is decoded — the segment IS the parameter. Each thunk calls a different alertApi method."
          confidence: STATIC-INFERRED
          evidence: "AlertsRoutes.tsx:12-17 + alerts.thunks.ts:33-70"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY for 'all'. Live docs (WebFetch 2026-05-26) state the All tab shows 'every open AND resolved alert'. Backend listAllWithStatusOpen filters STATUS=OPEN. So 'all' = 'all OPEN'. MATCHES for 'my' (listByOwner filters OWNERSHIP.OWNER_ID + STATUS=OPEN) and 'dependents' (listDependentObjectsAlerts walks LINEAGE CTE + STATUS=OPEN) — both implicitly OPEN-only too, but the docs do not promise resolved alerts there."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "ReactiveAlertRepositoryImpl.java:142-145,160-166,217-230"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "Operator searches the global Alerts page for a recently-resolved alert; cannot find it; assumes it was purged. May open a support ticket / re-investigate the underlying issue thinking the alert was lost. Resolved alerts CAN still be viewed via a single DataEntity's Alerts tab (DataEntityController.getDataEntityAlerts uses getAlertsByDataEntityId which has NO status filter — ReactiveAlertRepositoryImpl.java:182-199). So the data exists; the UI just won't surface it on /alerts/*."
          confidence: STATIC-INFERRED
          evidence: "ReactiveAlertRepositoryImpl.java:182-199 (no status filter) vs 142-145 (status=OPEN)"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "YES — ALERT.STATUS is a column with three values (OPEN, RESOLVED, RESOLVED_AUTOMATICALLY); the list-API ignores all values except OPEN. There is NO `status` query parameter on getAllAlerts / getAssociatedUserAlerts / getDependentEntitiesAlerts (AlertController.java:36-57). If the UI offered a status filter, the implementation would have to be added. The available-but-unused column IS ALERT.STATUS."
          confidence: STATIC-INFERRED
          evidence: "AlertController.java:36-57 (no status param) + ReactiveAlertRepositoryImpl.java:145 (hard-coded eq OPEN)"
      routes_to_finding: "bugs_limitations_corner_cases.[0] (all-tab name vs behaviour) + docs_link_semantic.doc_drift_findings.[0]"
  probes_emitted:
    - probe_id: P-194
      question: "What does an operator see on the All tab when both OPEN and RESOLVED alerts exist for the same data entity? Does the resolved alert appear anywhere reachable from the /alerts page tree, or only from /dataentities/{id}/alerts?"
      probe_path: "lineage/odd-platform/probes/P-194.yaml"
  stress_summary:
    triggers_total: 11
    questions_total: 27
    answers_static_inferred: 25
    answers_probe_needed: 2
    answers_reference: 0
    drift_flags: 2          # All-tab name (Cat B) + tab route segment (Cat F)
```

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP | DISABLED` — frontend
  route has no per-mode gating; the page renders for all authenticated modes
  and (because no WithPermissionsProvider wraps it) also for DISABLED. The
  backend list endpoints (batch H AlertController) carry no @PreAuthorize
  either — see that sidecar for the cross-mode reach.
- **ingestion_filter_relevance**: `N/A — UI surface, not ingestion path`.
- **authorization_assertions**:
  - `globalPermissions ∋ Permission.DATA_ENTITY_ALERT_RESOLVE OR
     resource-level permissions (for the alert's data entity) ∋ DATA_ENTITY_ALERT_RESOLVE`
    — evidence: AlertItem.tsx:55-67 — confidence HIGH
- **owner_scoping**:
  - All tab: `BYPASSES — returns OPEN alerts across all owners`.
  - My Objects tab: `RESPECTS — filters via OWNERSHIP.OWNER_ID = current user's owner`.
  - Dependents tab: `RESPECTS — filters by lineage from current user's owned oddrns`.
  - evidence: ReactiveAlertRepositoryImpl.java:142-148 (All), 160-179 (My),
    217-243 (Dependents).
- **data_exposure**:
  - "Alert payload {id, lastCreatedAt, type, status, statusUpdatedAt, statusUpdatedBy{owner.name | identity.username}, alertChunkList, dataEntity{id, externalName, internalName, entityClasses}} → any authenticated user via the All tab. No owner-scoping at the UI; backend All endpoint also has no owner filter (batch H sidecar)."
  - "statusUpdatedBy.identity.username is rendered verbatim (AlertItem.tsx:86) — OIDC/LDAP username PII leaks to any user who can reach the global Alerts page. Doc-product editorial: this is the same anonymous-fingerprint class identified in DOC-GAP-082 (35-sidecar) — usernames pegged to alert actions on the public list."
- **known_security_gaps**:
  - "Resolve / Reopen button is shown to users WITHOUT DATA_ENTITY_ALERT_RESOLVE; the permission check fires only on click. A privacy-conscious operator might infer from the visible button that resolution is available to them, attempt it, and only then learn they have no access. Lower-bound: UX leak. Upper-bound: signal-leak (the button's existence confirms the alert is OPEN and resolvable, distinct from RESOLVED state where the button text changes to 'Reopen')." — evidence: AlertItem.tsx:159-166 (Button rendered unconditionally) — severity: MEDIUM
  - "All tab on DISABLED auth mode reaches the alert list without any frontend or backend (per batch H controller) gate. In an internet-facing accidental DISABLED deployment, an anonymous caller can enumerate all OPEN alerts across the platform — including data-entity names, owner-association usernames, and full alertChunkList descriptions which may contain free-text diagnostic info." — evidence: App.tsx:64 (no wrapper) + AlertController.java:1-58 (no @PreAuthorize) — severity: HIGH (in DISABLED mode), LOW (in LOGIN/OAUTH/LDAP since session-required there)
  - "Frontend has no route guard on /alerts/* — compare LookupTables which wraps with WithPermissionsProvider(LOOKUP_TABLE_CREATE/UPDATE/DELETE). The Alerts page implicitly trusts the backend to gate; with DATA_ENTITY_ALERT_RESOLVE the gating is per-resource not per-list-read." — evidence: App.tsx:64 vs App.tsx:75-87 — severity: LOW

## performance

- **hot_paths**:
  - "On every tab switch the slice clears items and the list refetches page=1 — there is no per-tab cache. Switch round-trip = clear + render-empty + fetch + render-30. Cost per switch ≈ one backend round-trip + 30 React rows mount." — evidence: AlertsTabs.tsx:44-46 + alerts.slice.ts:38-40 + AlertsList.tsx:79-81
  - "Tab badge totals (fetchAlertsTotals) runs `Mono.zipDelayError(allCount, countByOwner, countDependent)` — three COUNT queries on first page mount. countDependent walks a recursive lineage CTE (ReactiveAlertRepositoryImpl.java:282-294) — proportional to lineage-graph depth for the current user's owned oddrns." — evidence: AlertServiceImpl.java:90-109 + ReactiveAlertRepositoryImpl.java:282-294
- **throughput_characteristics**:
  - "Single-fetch-per-page InfiniteScroll. No batch endpoint, no bulk-resolve. Each Resolve dispatches one updateAlertStatus call against a single alert id."
- **resource_allocation**:
  - "No DOM virtualisation — every alert in the loaded items array mounts as an AlertItem with Collapse-wrapped history. Memory grows O(N) in DOM nodes. For an operator with 10K+ unresolved alerts paging through, the page becomes the bottleneck before the backend does."
  - "Each AlertItem mounts useMemo for resolvedInfo (AlertItem.tsx:72-111) and useState ×3 (showHistory, disableResolve, isUpdating). At 10K items: ≈30K useState slots + 10K useMemo computations."
- **scaling_characteristics**:
  - "Stateless UI component. Horizontally scaling backend has no impact on the UI behaviour."
  - "InfiniteScroll has no cancellation on unmount/tab-switch (AlertsList.tsx:86-93). A stale fetch from a previous tab can resolve into the (just-cleared) new-tab state, briefly displaying wrong-tab items."
- **known_performance_gaps**:
  - "No DOM virtualisation on a list that is intentionally page-by-page-infinite. Pages 1..10 (300 alerts) are OK; pages 1..100 (3000 alerts) degrade visibly; pages 1..1000 (30000 alerts) likely freeze the tab." — evidence: AlertsList.tsx:84-99 (Grid container + map, no react-window) — severity: MEDIUM
  - "No request cancellation on tab-switch — `useEffect([fetchAlerts])` (AlertsList.tsx:79-81) does not return a cleanup function. A slow page-2 fetch initiated before tab-switch resolves into the new tab's now-cleared state." — evidence: AlertsList.tsx:79-81 — severity: LOW
  - "Totals are fetched once on Alerts mount and never refreshed — operator who resolves an alert sees the badge stay stale (off-by-one) until they leave and re-enter /alerts. Not a correctness bug, but an obvious UX gap." — evidence: Alerts.tsx:15-17 — severity: LOW

## upstream_callers

- entry_point: "ui_route:/alerts/*"
  caller_node: "ts react-component:App.tsx (lazy import)"
  multiplicity_per_trigger: 1
  evidence: "App.tsx:36 (lazy import) + App.tsx:64 (Route mount)"
  observation_class: ui-call
- entry_point: "ui_route:/alerts (sidebar/link)"
  caller_node: "unresolved — sidebar/header link emitting Link to /alerts"
  multiplicity_per_trigger: 1
  evidence: "alertsPath() invoked at App.tsx:64 (RouteSidebar / header consumers not enriched in this sidecar's scope)"
  observation_class: ui-call

## downstream_side_effects

- side_effect_class: external-call
  description: "On mount, dispatches fetchAlertsTotals which calls GET /api/alerts/totals once."
  evidence: "Alerts.tsx:15-17 + alerts.thunks.ts:27-31"
  cardinality_per_call: 1
  reachable_from_entry_points: ["ui_route:/alerts/*", "ui_route:/alerts/all", "ui_route:/alerts/my", "ui_route:/alerts/dependents"]
- side_effect_class: external-call
  description: "Each tab visit issues GET /api/alerts (or /my or /dependents) with page=1&size=30 — child AlertsList.tsx useEffect (AlertsList.tsx:79-81) fires on fetchAlerts identity change."
  evidence: "AlertsList.tsx:79-81 + alerts.thunks.ts:33-70"
  cardinality_per_call: 1
  reachable_from_entry_points: ["ui_route:/alerts/all", "ui_route:/alerts/my", "ui_route:/alerts/dependents"]
- side_effect_class: external-call
  description: "InfiniteScroll dispatches additional GET /api/alerts?page=N&size=30 per scroll-threshold-cross while pageInfo.hasNext is true. Cardinality scales with operator scrolling."
  evidence: "AlertsList.tsx:74-93"
  cardinality_per_call: "0..N depending on how far the operator scrolls"
  reachable_from_entry_points: ["ui_route:/alerts/all", "ui_route:/alerts/my", "ui_route:/alerts/dependents"]
- side_effect_class: external-call
  description: "Resolve/Reopen click dispatches GET fetchResourcePermissions (permission probe) + (conditional) PUT /api/alerts/{id}/status (changeAlertStatus). Two API calls per click."
  evidence: "AlertItem.tsx:48-70 + alerts.thunks.ts:72-88"
  cardinality_per_call: 2
  reachable_from_entry_points: ["ui_route:/alerts/all", "ui_route:/alerts/my", "ui_route:/alerts/dependents"]
- side_effect_class: page-render
  description: "Renders three-tab nav (All / My Objects / Dependents — with last two hidden if no owner association) + Alerts H1 + nested AlertsList per route."
  evidence: "Alerts.tsx:22-30"
  cardinality_per_call: 1
  reachable_from_entry_points: ["ui_route:/alerts/*"]
- side_effect_class: redirect-issue
  description: "Default /alerts redirects to /alerts/all via React Router Navigate (replace=true)."
  evidence: "AlertsRoutes.tsx:18"
  cardinality_per_call: "1 if pathname is /alerts; else 0"
  reachable_from_entry_points: ["ui_route:/alerts"]

## sources

- understanding ← Alerts.tsx:1-33 + AlertsTabs.tsx:1-58 + AlertsRoutes.tsx:1-22 + AlertsList.tsx:1-110 + AlertItem.tsx:1-195
- concepts.entities ← Alerts.tsx:5-9 + alerts.thunks.ts:1-12 + redux/interfaces/state.ts:159
- concepts.invariants.tabs-hidden ← AlertsTabs.tsx:30-37
- concepts.invariants.shared-state-slot ← alerts.slice.ts:42-49 + alerts.slice.ts:38-40
- concepts.invariants.default-redirect ← AlertsRoutes.tsx:18
- dependencies_semantic.requires-feature.F-007 ← Alerts.tsx:5,8,9 + alerts.thunks.ts (entire)
- dependencies_semantic.requires-feature.F-008 ← Alerts.tsx:6 (getOwnership selector) + AlertsTabs.tsx:30,36
- dependencies_semantic.requires-feature.F-018 ← Alerts.tsx:3,12,25 + AlertsTabs.tsx:2,22,28,34
- dependencies_semantic.requires-runtime.redux ← Alerts.tsx:4-6
- dependencies_semantic.requires-runtime.router ← App.tsx:64 + AlertsRoutes.tsx:2
- dependencies_semantic.requires-runtime.totals-endpoint ← Alerts.tsx:5,16 + alerts.thunks.ts:27-31
- tests_coverage_semantic ← Glob `**/Alerts/**/*.test.*` returned zero matches; Grep across odd-platform-ui for Alerts test files returned only non-test references.
- docs_link_semantic.inferred_docs ← WebFetch https://docs.opendatadiscovery.org/?ask=alerts (2026-05-26, status 200) + https://docs.opendatadiscovery.org/features/active-platform-features/alerting (2026-05-26, status 200 via implicit query interface)
- docs_link_semantic.doc_drift_findings ← live docs vs ReactiveAlertRepositoryImpl.java:142-148
- implicit_adrs.tab-visibility ← AlertsTabs.tsx:30-37
- implicit_adrs.shared-slot ← alerts.slice.ts:42-49
- implicit_adrs.tab-clear ← AlertsTabs.tsx:44-46 + alerts.slice.ts:38-40
- bugs_limitations_corner_cases.all-tab-mismatch ← ReactiveAlertRepositoryImpl.java:142-148,160-179,217-243 + AlertsTabs.tsx:22
- bugs_limitations_corner_cases.resolve-uxleak ← AlertItem.tsx:159-166,55-67
- bugs_limitations_corner_cases.stale-totals ← Alerts.tsx:15-17
- bugs_limitations_corner_cases.no-route-guard ← App.tsx:64 vs App.tsx:75-87
- bugs_limitations_corner_cases.scroll-race ← AlertsList.tsx:74-91 + alerts.slice.ts:25-32
- bugs_limitations_corner_cases.hardcoded-size ← AlertsList.tsx:72
- bugs_limitations_corner_cases.totals-error-mask ← AlertsTabs.tsx:23,28,34 + Alerts.tsx:15-17
- stress_findings.tunables ← AlertsList.tsx:72 + ReactiveAlertRepositoryImpl.java:147
- stress_findings.name_behavior_pairs.all-tab ← AlertsTabs.tsx:22 + ReactiveAlertRepositoryImpl.java:142-145 + WebFetch alerting page (2026-05-26)
- stress_findings.name_behavior_pairs.changeAlertsFilterAction ← alerts.slice.ts:37-41
- stress_findings.orderings ← ReactiveAlertRepositoryImpl.java:474-507
- stress_findings.auth_gates ← App.tsx:64,75-87 + AlertItem.tsx:55-67 + AlertController.java:1-58 (batch H sidecar reference)
- stress_findings.resource_boundaries ← alerts.slice.ts:25-32 + AlertServiceImpl.java:125-131
- stress_findings.request_inputs.page-size ← AlertsList.tsx:74-80 + ReactiveAlertRepositoryImpl.java:147
- stress_findings.request_inputs.tab-route ← AlertsRoutes.tsx:12-17 + ReactiveAlertRepositoryImpl.java:142-145,160-166,217-230,182-199
- security.data_exposure.username-leak ← AlertItem.tsx:86 (statusUpdatedBy?.identity?.username rendered verbatim)
- security.known_security_gaps.resolve-leak ← AlertItem.tsx:159-166
- security.known_security_gaps.disabled-anonymous-reach ← App.tsx:64 + AlertController.java:17-58
- performance.hot_paths.totals ← AlertServiceImpl.java:90-109 + ReactiveAlertRepositoryImpl.java:282-294
- performance.resource_allocation.no-virtualisation ← AlertsList.tsx:84-99
- performance.scaling_characteristics.no-cancel ← AlertsList.tsx:79-81
- upstream_callers ← App.tsx:36,64
- downstream_side_effects ← Alerts.tsx:15-17 + AlertsList.tsx:79-81 + AlertsList.tsx:74-91 + AlertItem.tsx:48-70 + AlertsRoutes.tsx:18

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH                  # confirmed absence via Glob + Grep
- docs_link_semantic: HIGH                       # live WebFetch on 2026-05-26
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: MEDIUM                             # static-inferred; no DOM/memory probe run on 10K-row case yet
- upstream_callers: MEDIUM                        # sidebar/header link sources unresolved
- downstream_side_effects: HIGH
- stress_findings: HIGH                           # all load-bearing questions STATIC-INFERRED; only 2 of 27 PROBE-NEEDED

## Maintainer notes

(empty — fresh sidecar; no prior version provided)

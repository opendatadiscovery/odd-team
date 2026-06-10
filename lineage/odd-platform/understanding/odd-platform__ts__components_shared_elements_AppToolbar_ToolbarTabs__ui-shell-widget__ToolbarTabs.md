---
node_id: "odd-platform ts components/shared/elements/AppToolbar/ToolbarTabs ui-shell-widget:ToolbarTabs"
node_kind: ui-shell-widget
axis: ui_shell
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
schema_version: 0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-26-ZJ
related_pillar_features:
  - "P-01:F-001"   # Catalog / Search tab
  - "P-01:F-022"   # Directory tab (Directory feature surface)
  - "P-04:F-002"   # Data Quality dashboard tab
  - "P-05:F-031"   # Data Modelling tab — Query Examples landing
  - "P-03:F-029"   # Master Data tab — Lookup Tables landing
  - "P-06:F-005"   # Management tab — owners/policies/roles/tags admin
  - "P-02:F-024"   # Dictionary tab — Term Search landing
  - "P-08:F-016"   # Alerts tab — global alerts
  - "P-09:F-017"   # Activity tab — global activity feed
  - "F-034"        # cross-cut: feature flags (referenced as NOT-applied here)
related_concepts:
  - ui-shell-navigation
  - primary-navigation-tabs
  - top-bar-tab-row
  - route-to-tab-mapping
  - tab-visibility-model
  - i18n-fallback-chain
references:
  - kind: parent-mount
    node: "odd-platform ts react-component component:AppToolbar"
    unresolved: false
    note: "AppToolbar.tsx:64 mounts <ToolbarTabs /> unconditionally inside the fixed-position bar"
  - kind: child-callee
    node: "odd-platform ts components/shared/elements/AppTabs ui-element:AppTabs"
    unresolved: true
    note: "the AppTabs primitive that renders the tabs (type='menu'); wraps each clickable tab with react-router-dom <Link to=...>"
  - kind: route-target
    node: "odd-platform ts routes route:search"
    unresolved: false
    note: "Catalog tab → searchPath() → '/search' (NOT '/catalog' — label-route mismatch documented in stress_findings.request_inputs)"
  - kind: route-target
    node: "odd-platform ts routes route:directory"
    unresolved: false
    note: "Directory tab → directoryPath() → '/directory'"
  - kind: route-target
    node: "odd-platform ts routes route:dataQuality"
    unresolved: false
    note: "Data Quality tab → dataQualityPath() → '/data-quality'"
  - kind: route-target
    node: "odd-platform ts routes route:queryExamples"
    unresolved: false
    note: "Data Modelling tab → queryExamplesPath() → '/data-modelling/query-examples' (the DM landing IS the query-examples list, not a DM index page)"
  - kind: route-target
    node: "odd-platform ts routes route:masterData"
    unresolved: false
    note: "Master Data tab → lookupTablesPath() → '/master-data/lookup-tables' (bypasses /master-data; no index page exists at that path)"
  - kind: route-target
    node: "odd-platform ts routes route:management"
    unresolved: false
    note: "Management tab → managementPath() → '/management'"
  - kind: route-target
    node: "odd-platform ts routes route:terms"
    unresolved: false
    note: "Dictionary tab → termsSearchPath() → '/termsearch' (NOT '/terms' or '/dictionary' — see stress_findings)"
  - kind: route-target
    node: "odd-platform ts routes route:alerts"
    unresolved: false
    note: "Alerts tab → alertsPath('all') → '/alerts/all'"
  - kind: route-target
    node: "odd-platform ts routes route:activity"
    unresolved: false
    note: "Activity tab → activityPath(activityQueryString) → '/activity?<5-day-window>&size=N&type=ALL'"
  - kind: redux-thunk
    node: "odd-platform ts redux-thunk thunk:createTermSearch"
    unresolved: true
    note: "Dictionary tab onClick dispatches createTermSearch BEFORE navigation; the term-search ID is generated server-side then folded into termsSearchPath(id)"
  - kind: redux-thunk
    node: "odd-platform ts lib/hooks:useCreateSearch"
    unresolved: false
    note: "Catalog tab onClick dispatches createDataEntitiesSearch to get a searchId, then navigates — useCreateSearch.ts:14-19"
  - kind: i18n-corpus
    node: "odd-platform ts locales:translations"
    unresolved: false
    note: "9 tabs use t('...'); ALL NINE keys present in every catalog since odd-platform#1748 (2026-06-10) added Data Quality / Data Modelling / Master Data to all six locales (previously those 3 were missing everywhere and i18next fell back to the English key literal for all languages; IT-102 case 4 pins the regression)"
---

# ToolbarTabs — semantic understanding

## understanding

`ToolbarTabs` is the primary navigation row rendered inside `AppToolbar` — a
single component that owns the entire top-bar tab list of the SPA. It builds
a static, hard-coded array of nine `AppTabItem`s (Catalog / Directory / Data
Quality / Data Modelling / Master Data / Management / Dictionary / Alerts /
Activity) in the order they appear, wires each tab to a route-helper
function from `routes/`, computes the currently selected tab from the
location pathname via a substring scan against `tab.value`, and delegates
rendering to the generic `AppTabs` primitive in `type='menu'` mode. Two of
the nine tabs have non-trivial onClick handlers — `Catalog` and `Dictionary`
dispatch a search/term-search create thunk BEFORE navigation so the search
state is initialised server-side and the user lands on a fresh search-id;
the other seven tabs are pure `<Link to=...>` navigations rendered by
`AppLinkTab` (no JS handler intercept). The component reads no permission
state, no feature flags, no role information — every authenticated user
sees the same nine tabs regardless of which Permissions / Policies / Roles
they hold, and regardless of which Active Features the admin has enabled
or disabled. This is the operator-observable scope: ToolbarTabs is the
single source of truth for "what tabs exist", and it answers the question
unconditionally.

## concepts

- entities:
  - "PrimaryNavigationTab (logical entity — a label + link + selectedness; 9 instances hard-coded in `tabs` useMemo, ToolbarTabs.tsx:34-82)"
  - "AppTabItem (the typed shape consumed by AppTabs — `name`, `link`, `value`, optional `hidden`/`disabled`/`hint` — `AppTabs.tsx:11-19`)"
  - "Selected-tab index (numeric state `selectedTab`; -1 means 'no tab is selected', which is the literal value at the `/` Overview landing — ToolbarTabs.tsx:84, 87-89)"
- operations:
  - "Build static tab list (useMemo over `[t('Catalog'), ...] × 9`; recomputed only when `activityQueryString` or `t` changes — ToolbarTabs.tsx:34-82)"
  - "Resolve selected tab from URL (useEffect on `pathname`; three branches: '/' → -1, search/dataentities → 0, otherwise scan tab.value as substring of pathname — ToolbarTabs.tsx:86-105)"
  - "Handle Catalog click (dispatch createDataEntitiesSearch → navigate to new searchId — ToolbarTabs.tsx:121-123 via useCreateSearch)"
  - "Handle Dictionary click (dispatch createTermSearch → navigate to /termsearch/<searchId> — ToolbarTabs.tsx:111-119)"
  - "Render link-style tabs (delegated to AppTabs type='menu' via AppLinkTab → react-router-dom <Link>)"
- invariants:
  - "Tab order is hard-coded in source — the array literal at ToolbarTabs.tsx:35-79 defines the canonical order; there is no per-user, per-role, per-tenant reordering mechanism"
  - "The first tab ('Catalog') has NO `value` field — it relies on the dedicated `searchPath/dataEntitiesPath` substring branch in the useEffect to drive selectedness (ToolbarTabs.tsx:92-98)"
  - "Every tab is always-visible to every authenticated user — there is no `hidden`/`disabled`/permission-gated entry in the `tabs` array; AppTabs' own `hidden`/`disabled` props on AppTabItem are NEVER set by this caller"
  - "Selected-tab detection is substring-based, not exact-prefix — `pathname.includes(tab.value)` at ToolbarTabs.tsx:101; a URL containing 'management' as a substring of any segment would falsely select the Management tab (verified: no false-positive in the actual route corpus, but the rule is structurally fragile — see bugs_limitations_corner_cases)"
  - "The Activity tab's link is dynamic — it carries `activityQueryString` (the 5-day window + page size + ALL type filter) re-computed on every render via `useQueryParams<ActivityQuery>(defaultActivityQuery)`; the useMemo dep `activityQueryString` causes re-build of the tab list on every page render where the query changes"
  - "The 'tab.value' string used for selection is NOT the URL path — it is a hand-picked discriminator string (`'directory'`, `'data-quality'`, `'data-modelling'`, etc.) that happens to match a substring of each route; if a route's literal segment is ever renamed in `routes/*` without updating the matching `value`, the tab silently stops highlighting"
- audiences:
  - "ui-end-user (sees the tab row on every authenticated page; clicks to navigate)"
  - "ui-developer (the canonical source for 'what top-level surfaces exist'; reordering or feature-flag-gating tabs requires editing this file)"
  - "product-owner (the tab labels are the public taxonomy of the platform's pillars — Catalog / Directory / Data Quality / Data Modelling / Master Data / Management / Dictionary / Alerts / Activity)"

## dependencies_semantic

- requires-feature:
  - "react-router-dom — `useLocation`, `useNavigate`, `useResolvedPath`, `matchPath` (ToolbarTabs.tsx:2)"
  - "react-i18next — translation key lookup via `useTranslation().t(...)` (ToolbarTabs.tsx:3, 27)"
  - "ALL 10 route helpers from `routes/` — searchPath, directoryPath, dataQualityPath, queryExamplesPath, lookupTablesPath, managementPath, termsSearchPath, alertsPath, activityPath, dataEntitiesPath (ToolbarTabs.tsx:13-23)"
  - "Redux: `useAppDispatch` + `createTermSearch` thunk for the Dictionary tab; `useCreateSearch` hook (wraps `createDataEntitiesSearch` thunk) for the Catalog tab"
  - "AppTabs primitive — the generic tab-row component that renders the 9 items (`AppTabs.tsx`; type='menu')"
- requires-config:
  - "ActivityQuery default — `defaultActivityQuery` from `components/shared/elements/Activity/common.ts:36-41`; bakes a SEVEN-FIELD URL into the Activity tab link including a 5-day window relative to now (recomputed each module load, NOT each render)"
- requires-runtime:
  - "An authenticated SPA session (the toolbar mounts inside the post-auth shell; pre-auth users are redirected by Spring Security before App.tsx renders)"
  - "i18next initialised with the loaded language; missing keys fall back through `['en', 'es', 'ch', 'fr', 'ua', 'hy']` (locales/i18n.ts:30) — the 3 tab keys formerly missing in EVERY locale are FIXED-1748 (2026-06-10, all six catalogs); the fall-through still applies to the ~70 other missing keys tracked PLT-215 (see bugs_limitations_corner_cases)"

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "All 9 tab labels render in the documented order on initial mount"
    test_class: integration
    criticality: MEDIUM
    note: "Snapshot or render assertion against the tab text; no test exists."
  - behaviour: "Clicking 'Catalog' dispatches createDataEntitiesSearch and navigates to /search/<newId>"
    test_class: integration
    criticality: HIGH
    note: "The thunk-then-navigate pattern is fragile; if the thunk rejects, the navigation never fires and the user sees a no-op click (no error toast, no state). Untested."
  - behaviour: "Clicking 'Dictionary' dispatches createTermSearch and navigates to /termsearch/<newId>"
    test_class: integration
    criticality: HIGH
    note: "Same fragility as Catalog — the .unwrap().then() chain at lines 112-117 has no .catch(); a rejected promise leaves the user on the previous page with no feedback."
  - behaviour: "Selected-tab highlight matches the current URL across all 9 tabs"
    test_class: integration
    criticality: MEDIUM
    note: "The substring-match heuristic (pathname.includes(tab.value)) has no test coverage; LSN-019-class regression risk."
  - behaviour: "Selected-tab highlight at '/' (Overview) is 'no tab selected' (selectedTab=-1)"
    test_class: integration
    criticality: LOW
    note: "Operator-visible: the Overview landing has NO highlighted tab in the toolbar, which makes the tab row look 'unselected' on the home page; this is the intended behaviour but undocumented."
  - behaviour: "Every authenticated user (regardless of Role / Permission / feature-flag state) sees ALL 9 tabs"
    test_class: security
    criticality: HIGH
    note: "There is no test asserting that a READ_ONLY user sees the same tabs as an ADMIN, nor that disabling a backend feature (e.g. a data-modelling backend disabled) does NOT hide the Data Modelling tab. The tab visibility model is structurally unconditional."
  - behaviour: "Tab labels are localised when the user language is non-English"
    test_class: integration
    criticality: MEDIUM
    note: "For 6 of 9 keys, the locale strings exist; for 3 keys (Data Quality / Data Modelling / Master Data) NO locale has a translation and the English literal is shown regardless of language — operator-visible inconsistency. Untested."
  - behaviour: "Tab list re-render does not happen on every route navigation"
    test_class: performance
    criticality: LOW
    note: "useMemo dep array contains `activityQueryString` which may change when query params on the current page change; investigate whether navigating to Activity-with-different-query causes a tab-list rebuild loop. Not measured."
- test_files: []
- gaps: |
    There are ZERO tests against this component or against `AppTabs` in the
    odd-platform-ui test corpus. The highest-leverage gap is **security**:
    no test asserts that visibility is unconditional by intent (vs by
    accident). A second high-leverage gap is **integration** on the two
    create-thunk-then-navigate handlers (Catalog, Dictionary) where a
    rejected promise produces silent failure — exactly the failure-mode
    class that LSN-019 / LSN-020 documented for backend ordering /
    user-filter respectively. A third gap is **integration** on the
    substring-based selectedness heuristic; a single route rename in
    `routes/*` can silently break tab highlighting without anyone noticing
    until a user complains.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/search"
    anchor: ""
    rationale: "Live page (WebFetched 2026-05-26, status 200) explicitly references the 'Catalog tab' as the navigation entry to search functionality: 'navigate to the main page of ODD Platform and select the Catalog tab. There you will find the Search bar and Filter options.' This is the closest doc reference to ANY of the 9 tabs ToolbarTabs renders."
    last_verified_at: "2026-05-26"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      'To get started, navigate to the main page of ODD Platform and select the Catalog tab. There you will find the Search bar and Filter options.'
  - url: "https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed"
    anchor: ""
    rationale: "Live page (WebFetched 2026-05-26, status 200) explicitly references the 'Activity' top-level entry in the platform's navigation under 'Where to find it': 'Global Activity page — top-level Activity entry in the platform's navigation. Shows every event across the catalog with a seven-facet filter panel.'"
    last_verified_at: "2026-05-26"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      'Global Activity page — top-level Activity entry in the platform's navigation.'
- doc_drift_findings:
  - "DRIFT_LABEL_VS_ROUTE: The live docs (search page) instruct users to 'select the Catalog tab' — yet the tab labelled 'Catalog' navigates to `/search`, not `/catalog`. The URL the user sees in the address bar after clicking 'Catalog' is `/search/<searchId>` — no 'catalog' string appears in the URL. This is operator-confusion-shaped, NOT functionally broken, but the LABEL/URL semantic divergence is documented nowhere. Code anchor: ToolbarTabs.tsx:37-39 (label) + searchRoutes.ts:3 (BASE_PATH=/search)."
  - "DRIFT_LABEL_VS_ROUTE: The 'Dictionary' tab navigates to `/termsearch/<id>` — the URL contains 'term' not 'dictionary' anywhere. No live doc page documents this label↔URL mapping. Code anchor: ToolbarTabs.tsx:66-69 (label) + termsRoutes.ts:6 (TERMS_SEARCH_PATH='/termsearch')."
  - "DRIFT_LABEL_VS_ROUTE: The 'Data Modelling' tab navigates to `/data-modelling/query-examples`, NOT to a Data Modelling overview page (no such page exists; `dataModellingPath()` returns `/data-modelling` but is unused as a tab target). The user clicks 'Data Modelling' and lands on Query Examples specifically. Code anchor: ToolbarTabs.tsx:50-54."
  - "DRIFT_LABEL_VS_ROUTE: The 'Master Data' tab navigates to `/master-data/lookup-tables` — same shape as Data Modelling, no `/master-data` index page is mounted. Code anchor: ToolbarTabs.tsx:55-59 + masterDataRoutes.ts:1-4. (Cross-ref: ZH masterData sidecar already pins this as the 'one-feature pillar' invariant.)"
  - "DRIFT_DOC_NAVIGATION_MODEL: docs.opendatadiscovery.org references 'six governance pillars' in the features overview, but ToolbarTabs renders NINE tabs. The pillar-to-tab mapping is not 1:1 — Catalog + Directory are both Data Discovery; Activity + Alerts are both 'active platform features'; Management is admin-not-pillar. No doc page maps the 9-tab UI to the 6-pillar conceptual model."

## implicit_adrs

- "Tab list is hard-coded in source, not config-driven or registry-driven" — evidence: ToolbarTabs.tsx:34-82 — intent_anchor: "no comment defends the design, but the tab list is constructed inside a `useMemo` literal array that takes no parameter except `activityQueryString` and `t` — the pattern signals 'this is a static product taxonomy, not a runtime composition'" — confidence: MEDIUM
- "Selected-tab resolution uses a substring-match heuristic with two special-case branches (root / and search/dataentities)" — evidence: ToolbarTabs.tsx:86-105 — intent_anchor: "the explicit `if (matchPath('/'))` early-return at lines 87-90 plus the explicit `if (matchPath(searchPath()/*) || matchPath(dataEntitiesPath()/*))` at lines 92-98 — the developer-author treated these two URL families specially (Overview is intentionally 'no tab selected'; Catalog is selected for BOTH /search AND /dataentities/* because data-entity-details is downstream of search)" — confidence: HIGH
- "Catalog and Dictionary tabs create fresh search state on every click (search-id minting before navigation)" — evidence: ToolbarTabs.tsx:107-126 — intent_anchor: "the explicit `dispatch(createTermSearch(...)).unwrap().then(({searchId}) => navigate(...))` pattern at lines 112-117 and the parallel `createSearch(initialParams)` call at line 122 — the design intent is that clicking 'Dictionary' or 'Catalog' from the toolbar restarts the search flow (versus restoring a previous search), giving the user a deterministic starting point" — confidence: HIGH

## bugs_limitations_corner_cases

- "Tab visibility is structurally unconditional — there is no Permission / Role / feature-flag gate on any tab. A READ_ONLY user sees the 'Management' tab the same as an ADMIN user; users from any backend that lacks one of the supporting features (e.g. an instance with no Lookup Tables data) still see 'Master Data' as a top-level affordance. The operator-visible impact: tabs lead to pages that may render empty or 403-redirect, with no upstream signal that the affordance was inapplicable to this user. Note: the downstream `Management/*` routes are individually permission-gated by WithPermissionsProvider, but only the page bodies — not the tab visibility. Cross-ref ZH WithPermissionsProvider non-blocking finding." — evidence: ToolbarTabs.tsx:34-82 (no permission read) + App.tsx (parent mounts the bar unconditionally at line 56) — severity: HIGH
- "FIXED-1748 (2026-06-10, the 18 entries on contrib/CTRIB-003-toolbar-tab-i18n-keys): three of nine tab labels HAD no i18n key in any locale — 'Data Quality', 'Data Modelling', 'Master Data' were absent from en.json, es.json, ch.json, fr.json, ua.json, hy.json, so `t('Data Quality')` returned the lookup-key literal string for every language. Operator-visible impact: a Ukrainian user sees 'Активність / Сповіщення / Каталог / Data Quality / Data Modelling / Master Data / Менеджмент / Словник / Директорія' — six tabs translated, three untranslated. This is consistent across all 5 non-English locales (the missing-key set is identical), strongly suggesting the three pillar-rename tabs were added after the locale corpus was last synced." — evidence: ToolbarTabs.tsx:46, 51, 56 (t-calls) + the 18 entries added across locales/translations/{en,es,ch,fr,ua,hy}.json (odd-platform#1748); regression pinned by IT-102 case 4 (every toolbar tab translates under a non-English locale) — severity: MEDIUM (RESOLVED)
- "Selected-tab heuristic uses `pathname.includes(tab.value)` — a substring match, not an exact-prefix match. With the current `tab.value` corpus the heuristic happens to be unambiguous, but this is fragile-by-design: a future route like `/management-history` or `/data-quality-old` could silently match the wrong tab. Also fragile: if a `routes/*.ts` helper is renamed (e.g. `/master-data` → `/reference-data`) without updating the `value: 'master-data'` literal at ToolbarTabs.tsx:58, the tab silently stops highlighting and no test catches it." — evidence: ToolbarTabs.tsx:100-104 — severity: MEDIUM
- "Catalog tab onClick (`handleTabClick` at lines 107-126) only fires `createSearch(initialParams)` if `tabs[idx].link?.includes('search')` — but `searchPath()` literally returns `/search`, so the guard is always true at this code path. The guard appears to be a leftover defensive check from when the link could be `/catalog` (per the doc-drift finding above). Operator-visible impact: none today, but if `searchPath()` is ever renamed to drop the literal 'search' substring (e.g. to `/catalog`), the guard would silently disable the search-state-reset on click and a stale search would be loaded." — evidence: ToolbarTabs.tsx:121-123 — severity: LOW
- "Activity tab link is rebuilt on every render where `activityQueryString` changes — useMemo dep at ToolbarTabs.tsx:81. `activityQueryString` itself derives from `useQueryParams<ActivityQuery>(defaultActivityQuery)` which inspects the current URL query string. While viewing the Activity page with custom filters applied, the toolbar's Activity-tab link mirrors those filters — so clicking 'Activity' while already on Activity is a no-op navigation (same URL). This appears intentional (preserve filter context) but is undocumented; the inverse — clicking 'Activity' from any OTHER page rebuilds the link with the DEFAULT 5-day window from common.ts:36-41, NOT the user's last-used filter set, because `useQueryParams` falls through to `defaultActivityQuery` when no URL query string is present." — evidence: ToolbarTabs.tsx:31-32, 77, 81 + Activity/common.ts:36-41 — severity: LOW
- "Both create-thunk-then-navigate handlers (Catalog at line 122 via useCreateSearch.ts:14-19, and Dictionary at lines 112-117) call `.unwrap().then(...)` WITHOUT a `.catch(...)` — if the thunk rejects (e.g. backend unavailable, 5xx on the search-create POST), the user clicks the tab and NOTHING happens. No error toast, no navigation, no state change. Silent failure on a primary nav action." — evidence: ToolbarTabs.tsx:112-117 + useCreateSearch.ts:14-19 — severity: MEDIUM
- "Tab order is hard-coded as: Catalog / Directory / Data Quality / Data Modelling / Master Data / Management / Dictionary / Alerts / Activity. The order has NO comment defending the choice, NO ADR, NO localised tooltip explaining the pillar grouping. The order does not match the docs' 'six governance pillars' list (Data Discovery, Data Modelling, Master Data, Data Quality, Data Lineage, Data Glossary), nor any obvious functional grouping. If pillar leadership re-prioritises (e.g. Data Modelling is renamed or hidden), the change requires editing this file — there is no admin UI for reordering." — evidence: ToolbarTabs.tsx:35-79 — severity: LOW
- "Master Data tab points to `/master-data/lookup-tables` directly — visiting bare `/master-data` (the URL implied by the tab LABEL) produces a no-route-match in react-router because App.tsx mounts only `/master-data/lookup-tables` under that namespace, not the index. Cross-ref the ZH masterData sidecar — this is a documented one-feature-pillar pattern, but the impact at the ToolbarTabs layer is that the Master Data tab's `value: 'master-data'` selectedness-substring will match any URL containing `master-data` (which today is only `/master-data/lookup-tables`)." — evidence: ToolbarTabs.tsx:55-59 + masterDataRoutes.ts:1-4 + App.tsx:75-88 — severity: LOW
- "AppTabs (the downstream primitive) supports `hidden` and `disabled` per-AppTabItem (AppTabs.tsx:17-18, 84-85, 105-106), but ToolbarTabs NEVER sets either — every tab is rendered enabled and visible. The capability exists in the type but is dead code at this caller." — evidence: ToolbarTabs.tsx:34-82 (no `hidden:` or `disabled:` key in any tab object) — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables: []
  name_behavior_pairs:
    - name: "ToolbarTabs (component name and tabs array order)"
      promise: "Renders the primary navigation tab row with all top-level platform surfaces in a meaningful, role-appropriate order"
      implementation: "Renders a hard-coded 9-element array in fixed order with NO role / permission / feature-flag awareness; every authenticated user sees the same 9 tabs unconditionally"
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "A user with no Management permissions still sees a 'Management' tab in the nav bar; clicking takes them to a page where most actions 403 or do nothing — the tab visibility is unconditional by design (or by accident); see Category D below"
      confidence: STATIC-INFERRED
      evidence: "ToolbarTabs.tsx:34-82 (no role/permission read) + App.tsx:56 (mounts AppToolbar unconditionally)"
    - name: "tabs[0].name = t('Catalog'), tabs[0].link = searchPath()"
      promise: "The 'Catalog' tab navigates the user to the Catalog"
      implementation: "Navigates to `/search` (or `/search/<newSearchId>` after the dispatch — see Category F); the URL never contains the literal 'catalog'; the user's address bar reads 'search' while they are conceptually 'in the catalog'"
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "Live docs say 'select the Catalog tab' to reach the search bar (verified WebFetch 2026-05-26 on /features/data-discovery/search); the URL the user lands on is `/search/<id>`, not `/catalog/...` — minor confusion for users learning the URL taxonomy"
      confidence: STATIC-INFERRED
      evidence: "ToolbarTabs.tsx:37-39 (label='Catalog', link=searchPath()) + searchRoutes.ts:3 (BASE_PATH='/search')"
    - name: "tabs[6].name = t('Dictionary'), tabs[6].link = termsSearchPath()"
      promise: "The 'Dictionary' tab navigates the user to the Dictionary feature"
      implementation: "Navigates to `/termsearch/<newId>` after dispatching createTermSearch — the URL contains 'term', not 'dictionary'"
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "URL/label mismatch; the docs use 'Dictionary terms' (per features index) but the URL family is `/terms` and `/termsearch`"
      confidence: STATIC-INFERRED
      evidence: "ToolbarTabs.tsx:66-69 + termsRoutes.ts:6"
    - name: "tabs[3].name = t('Data Modelling'), tabs[3].link = queryExamplesPath()"
      promise: "The 'Data Modelling' tab opens the Data Modelling area"
      implementation: "Navigates DIRECTLY to `/data-modelling/query-examples` — the Query Examples list IS the landing page for the Data Modelling tab; there is no `/data-modelling` index/overview page"
      drift: MINOR
      operator_visible_consequence: "User clicks 'Data Modelling' expecting an overview; lands on a specific sub-feature (Query Examples). If Data Modelling later gains a second sub-feature (Relationships exists in code per `dataModelling/relationshipsRoutes.ts`), the tab will continue to land on Query Examples specifically and the user has no signal that another sub-feature exists at the URL level."
      confidence: STATIC-INFERRED
      evidence: "ToolbarTabs.tsx:50-54 + queryExamplesRoutes.ts:30-37 (returns /data-modelling/query-examples) + dataModelling/dataModelling.ts:3-7 (BASE_PATH '/data-modelling' export exists but unused by ToolbarTabs)"
    - name: "tabs[4].name = t('Master Data'), tabs[4].link = lookupTablesPath()"
      promise: "The 'Master Data' tab opens the Master Data area"
      implementation: "Navigates DIRECTLY to `/master-data/lookup-tables` — Lookup Tables IS the only sub-feature of the Master Data pillar today; no `/master-data` index"
      drift: MINOR
      operator_visible_consequence: "User clicks 'Master Data' expecting an overview; lands on Lookup Tables specifically. Cross-ref ZH masterData sidecar — one-feature-pillar pattern."
      confidence: STATIC-INFERRED
      evidence: "ToolbarTabs.tsx:55-59 + masterDataRoutes.ts:2-4"
  orderings:
    - location: "ToolbarTabs.tsx:35-79"
      questions:
        - q: "What is the actual order of tabs as rendered?"
          a: "Hard-coded literal-array order: [0] Catalog, [1] Directory, [2] Data Quality, [3] Data Modelling, [4] Master Data, [5] Management, [6] Dictionary, [7] Alerts, [8] Activity. The array index IS the tab position. No `.sort()`, no Comparator, no dynamic ordering."
          confidence: STATIC-INFERRED
          evidence: "ToolbarTabs.tsx:35-79"
        - q: "Is the order documented anywhere — comment, ADR, doc page?"
          a: "No. No comment in the file defends the order; no ADR exists in `adrs/`; the docs' 'six governance pillars' list at https://docs.opendatadiscovery.org/features/features uses a DIFFERENT order (Data Discovery / Data Modelling / Master Data / Data Quality / Data Lineage / Data Glossary) and a different cardinality."
          confidence: STATIC-INFERRED
          evidence: "Grep for 'order' / '// ' inside ToolbarTabs.tsx returns no comment; live WebFetch of https://docs.opendatadiscovery.org/features/features (2026-05-26, 200) reveals the 6-pillar list mismatch"
        - q: "Does the order match the navigation order documented in the ZH+ZI route sidecars?"
          a: "The ZH/ZI route sidecars do not declare an order — they document each route's URL shape in isolation. The order question lives ONLY in ToolbarTabs."
          confidence: REFERENCE
          evidence: "lineage/odd-platform/understanding/odd-platform__ts__routes__route__*.md (none declare a tab-order invariant)"
        - q: "Is the order canonical across releases?"
          a: "Static inspection of HEAD only — cannot verify cross-release stability from this code-walk. Resolving this requires git-log archaeology rather than a docker-runnable probe — deferred to a concept-merger / feature-flow-builder pass when release-notes cross-linking is in scope. Not emitted as a P-NNN probe because it does not require runtime."
          confidence: REFERENCE
          evidence: "git log archaeology — out of file-analyser scope; flagged as analyser-deferral"
  auth_gates:
    - location: "ToolbarTabs.tsx:1-138"
      endpoint: "N/A — UI component, not an HTTP endpoint"
      questions:
        - q: "What does this component render for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP auth modes?"
          a: "The same 9 tabs for ALL FOUR modes. ToolbarTabs is mounted by AppToolbar which is mounted by App.tsx without conditional logic; the SPA shell only renders when the user has cleared the upstream auth filter (Spring Security at the backend), so by the time ToolbarTabs runs, the user is authenticated by definition. The component reads NO auth-mode-aware state."
          confidence: STATIC-INFERRED
          evidence: "ToolbarTabs.tsx:25-30 (no auth-mode reads) + App.tsx:53-94 (mounts AppToolbar unconditionally) + AppToolbar.tsx:18-22 (reads identity/owner from store but does not branch on auth mode)"
        - q: "What does an unauthenticated caller see?"
          a: "Unauthenticated callers never reach this component — the upstream Spring Security filter redirects them to the configured auth provider before App.tsx finishes its initial render. (For DISABLED mode there is no upstream redirect, but DISABLED is documented as dev-only per pillars/documentation case-law.)"
          confidence: STATIC-INFERRED
          evidence: "App.tsx:56 mounts AppToolbar inside the post-auth SPA shell; cross-ref existing AppToolbar sidecar (line 41 'persistent top-of-viewport fixed-position bar rendered by the SPA shell on every authenticated route')"
        - q: "What does a wrong-role caller see (e.g. READ_ONLY hitting the toolbar)?"
          a: "READ_ONLY users see ALL 9 tabs — IDENTICAL to an ADMIN. The 'Management' tab is visible to every authenticated user regardless of whether they have any Management permissions. The downstream `/management/*` route mounts a Management page that may render with reduced functionality based on permissions (out of this sidecar's scope), but the TAB ENTRY POINT is unconditional. PROBE-NEEDED to confirm runtime; see P-175."
          confidence: PROBE-NEEDED
          evidence: "ToolbarTabs.tsx:34-82 (no permission read; cross-ref the absence of `usePermissions` / `getGlobalPermissions` import — Grep returns 0 matches in the AppToolbar subtree) — runtime confirmation in P-175"
        - q: "Where does the gate live — component, parent, route, or nowhere?"
          a: "**Nowhere at the tab-visibility layer.** Each downstream route may have its own gate (e.g. `App.tsx:75-88` wraps LookupTables in WithPermissionsProvider; per ZH the wrapper is NON-blocking — it renders the page anyway with reduced UI). Permission-based tab hiding is NOT implemented; this is intentional-or-accidental and undocumented."
          confidence: STATIC-INFERRED
          evidence: "ToolbarTabs.tsx (no @PreAuthorize-equivalent; no useAppSelector(getPermissions); no WithFeature wrapping) + App.tsx:56 (no permission/feature gate on AppToolbar mount)"
  resource_boundaries:
    - location: "ToolbarTabs.tsx:107-126"
      kind: idempotency
      questions:
        - q: "Can two simultaneous Catalog or Dictionary clicks produce corrupted state?"
          a: "Two clicks fire two `createTermSearch` / `createDataEntitiesSearch` thunks in parallel; each gets its own `searchId` from the backend. The second-to-resolve navigates LAST, so the user ends up on the second searchId. The first searchId is orphaned (created server-side, never visited). No data corruption; only orphaned search records in the search-id table."
          confidence: STATIC-INFERRED
          evidence: "ToolbarTabs.tsx:112-117 (no de-bounce, no in-flight guard) + useCreateSearch.ts:14-19 (same pattern)"
        - q: "Is the click replay-safe?"
          a: "No — every click mints a NEW search-id. Clicking 'Catalog' 5 times in 2 seconds creates 5 orphaned search-id rows server-side (cross-ref the backend SearchController / search-id minting flow — out of this sidecar's scope)."
          confidence: REFERENCE
          evidence: "node:odd-platform java SearchController controller-class:SearchController — owns the orphan-record semantics for the search-id table"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No cache — every click goes through Redux dispatch → backend HTTP."
          confidence: STATIC-INFERRED
          evidence: "ToolbarTabs.tsx:107-126 (no useMemo / no in-component cache; useMemo on the tabs array only caches the list shape, not handler results)"
  request_inputs:
    - location: "ToolbarTabs.tsx:37-39"
      input_kind: local-variable
      input_name: "Catalog (the user-visible label)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The label 'Catalog' promises that the tab opens the platform's catalog — the indexed registry of data entities."
          confidence: STATIC-INFERRED
          evidence: "ToolbarTabs.tsx:37"
        - q: "When the user clicks, what does the implementation actually USE the label for?"
          a: "Label is purely display; the link target is `searchPath()` which returns `/search`. On click, `handleTabClick` triggers `createSearch(initialParams)` (via useCreateSearch.ts:14-19), which dispatches createDataEntitiesSearch, awaits a new searchId, and navigates to `/search/<searchId>`. The label 'Catalog' never reaches the URL."
          confidence: STATIC-INFERRED
          evidence: "ToolbarTabs.tsx:38, 121-123 + useCreateSearch.ts:14-19 + searchRoutes.ts:7-12"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY — label says 'Catalog'; URL family is `/search`; the docs at https://docs.opendatadiscovery.org/features/data-discovery/search explicitly say 'select the Catalog tab' to reach search. The label is a UI-level abstraction over the search-id minting flow."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "ToolbarTabs.tsx:37-39 + searchRoutes.ts:3"
        - q: "For TRANSLATES_SILENTLY: what does the user see when their assumption is wrong?"
          a: "User clicks 'Catalog' expecting to land on a /catalog URL — instead lands on /search/<long-uuid>. Browser history shows a /search URL. Bookmarking the page bookmarks a one-time search-id (which is server-side persistent and may be evictable — out of this sidecar's scope). Sharing the URL with a colleague shares THEIR search, not a catalog landing."
          confidence: STATIC-INFERRED
          evidence: "Same as Q2"
        - q: "Is there a closer-aligned variant that DOES match the input's name?"
          a: "No `/catalog` route exists. The Overview page at `/` (App.tsx:60) is the closest 'catalog landing' but is unrelated to the Catalog tab. No `catalogPath()` helper exists in `routes/*`."
          confidence: STATIC-INFERRED
          evidence: "Grep `catalogPath|\\/catalog` in <odd-platform-repo>/odd-platform-ui/src/routes returns no matches"
      routes_to_finding: "bugs_limitations_corner_cases.[3] AND docs_link_semantic.doc_drift_findings.[0]"
    - location: "ToolbarTabs.tsx:66-69"
      input_kind: local-variable
      input_name: "Dictionary"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The label 'Dictionary' promises that the tab opens the dictionary — the glossary of business terms used across the catalog."
          confidence: STATIC-INFERRED
          evidence: "ToolbarTabs.tsx:67"
        - q: "When the user clicks, what does the implementation actually USE the label for?"
          a: "Label is purely display; link is `termsSearchPath()` → `/termsearch`; on click, dispatches createTermSearch then navigates to `/termsearch/<id>`."
          confidence: STATIC-INFERRED
          evidence: "ToolbarTabs.tsx:67-68 + termsRoutes.ts:12-18 + ToolbarTabs.tsx:112-117"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY — label says 'Dictionary'; URL says 'termsearch'. Live docs at /features/features call this feature 'Dictionary terms' (combined noun), aligning with the LABEL but not the URL."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "ToolbarTabs.tsx:66-69 + termsRoutes.ts:6"
        - q: "What does the user see when their assumption is wrong?"
          a: "User clicks 'Dictionary' expecting `/dictionary`; URL shows `/termsearch/<uuid>`. Same UX impact as Catalog → /search."
          confidence: STATIC-INFERRED
          evidence: "Same as Q2"
        - q: "Is there a closer-aligned variant that DOES match the input's name?"
          a: "No `/dictionary` route exists. The `termsPath()` returns `/terms` (the term-details base) — closer to 'dictionary' semantically but not the actual tab target either."
          confidence: STATIC-INFERRED
          evidence: "termsRoutes.ts:21-23"
      routes_to_finding: "bugs_limitations_corner_cases.[3] AND docs_link_semantic.doc_drift_findings.[1]"
    - location: "ToolbarTabs.tsx:50-54"
      input_kind: local-variable
      input_name: "Data Modelling (label) + value: 'data-modelling'"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The label 'Data Modelling' promises that the tab opens the Data Modelling area, where users design data models or view ERD-style relationships."
          confidence: STATIC-INFERRED
          evidence: "ToolbarTabs.tsx:51"
        - q: "When the user clicks, what does the implementation actually USE the label for?"
          a: "Link is `queryExamplesPath()` returning `/data-modelling/query-examples` — the user lands on Query Examples specifically. NOT an overview / landing page for Data Modelling."
          confidence: STATIC-INFERRED
          evidence: "ToolbarTabs.tsx:52 + queryExamplesRoutes.ts:30-37"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY — partial scope. The Data Modelling pillar HAS sub-features (Relationships per `dataModelling/relationshipsRoutes.ts`), but the tab hardcodes Query Examples as the landing. The selectedness substring `'data-modelling'` correctly matches all DM sub-routes, but the link is fixed."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "ToolbarTabs.tsx:50-54 + dataModelling/dataModelling.ts:3-7 (BASE_PATH exists but unused as tab target)"
        - q: "What does the user see when their assumption is wrong?"
          a: "User expects an overview of Data Modelling features; lands on Query Examples specifically. To reach Relationships, the user must navigate from within Query Examples or from a Data Entity Details page. No top-level entry to Relationships from the toolbar."
          confidence: STATIC-INFERRED
          evidence: "ToolbarTabs.tsx:35-79 (no Relationships tab)"
        - q: "Is there a closer-aligned variant that DOES match the input's name?"
          a: "Yes — `dataModellingPath()` returns `/data-modelling` (exported from `dataModelling/dataModelling.ts`). This unused helper is the natural-fit landing target if a DM index page existed. Today the helper is consumed only by `App.tsx:74` to mount the DataModeling routes prefix, NOT by ToolbarTabs."
          confidence: STATIC-INFERRED
          evidence: "dataModelling/dataModelling.ts:5-7 + App.tsx:74"
      routes_to_finding: "bugs_limitations_corner_cases.[3] AND docs_link_semantic.doc_drift_findings.[2]"
    - location: "ToolbarTabs.tsx:55-59"
      input_kind: local-variable
      input_name: "Master Data (label) + value: 'master-data'"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The label 'Master Data' promises that the tab opens the Master Data Management pillar."
          confidence: STATIC-INFERRED
          evidence: "ToolbarTabs.tsx:56"
        - q: "When the user clicks, what does the implementation actually USE the label for?"
          a: "Link is `lookupTablesPath()` → `/master-data/lookup-tables`. Lands on Lookup Tables specifically, not on a Master Data overview."
          confidence: STATIC-INFERRED
          evidence: "ToolbarTabs.tsx:57 + masterDataRoutes.ts:2-4"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_LEGITIMATELY — currently. Cross-ref ZH masterData sidecar: the pillar has exactly one feature today (Lookup Tables); the choice to land directly on the only feature is reasonable. WHEN a second Master Data feature is added, this becomes TRANSLATES_SILENTLY and needs revisiting."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ToolbarTabs.tsx:55-59 + cross-ref lineage/odd-platform/understanding/odd-platform__ts__routes__route__masterData.md (ZH)"
        - q: "What does the user see when their assumption is wrong?"
          a: "Today: nothing — only feature in pillar."
          confidence: STATIC-INFERRED
          evidence: "Same as Q3"
        - q: "Is there a closer-aligned variant?"
          a: "No `/master-data` index route mounted. The BASE_PATH constant exists in `masterDataRoutes.ts:1` but is not exported and no overview page is mounted."
          confidence: STATIC-INFERRED
          evidence: "masterDataRoutes.ts:1 + App.tsx (no `<Route path='/master-data' />`)"
      routes_to_finding: "implicit_adrs.[0] (one-feature-pillar pattern; legitimate today)"
    - location: "ToolbarTabs.tsx:70-74"
      input_kind: local-variable
      input_name: "Alerts (label) + value: 'alerts'"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "The label 'Alerts' promises that the tab opens the alerts surface."
          confidence: STATIC-INFERRED
          evidence: "ToolbarTabs.tsx:71"
        - q: "When the user clicks, what does the implementation actually USE the label for?"
          a: "Link is `alertsPath('all')` → `/alerts/all`. Lands on the 'all alerts' tab specifically (not 'my alerts' or 'dependents'). The user is taken to the broadest scope, regardless of whether they have any alerts assigned to them."
          confidence: STATIC-INFERRED
          evidence: "ToolbarTabs.tsx:72 + alertsRoutes.ts:2-13"
        - q: "Does the scope match the promise?"
          a: "MATCHES — label says Alerts, URL contains 'alerts'. The choice of /all (vs /my) is an intentional default — broadest view first — but it is not surfaced to the user."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "Same as Q2"
        - q: "Wrong-assumption impact?"
          a: "A user who never has alerts assigned to them sees an empty /alerts/all page on click — they may infer 'no alerts exist' when in fact they have none assigned. Documented in the Alerts pillar sidecars (cross-ref)."
          confidence: REFERENCE
          evidence: "lineage/odd-platform/understanding/odd-platform__java__AlertController* sidecars"
        - q: "Closer-aligned variant?"
          a: "N/A"
          confidence: STATIC-INFERRED
          evidence: "N/A"
      routes_to_finding: "N/A"
    - location: "ToolbarTabs.tsx:75-79"
      input_kind: local-variable
      input_name: "Activity (label) + value: 'activity'"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "The label 'Activity' promises that the tab opens the global activity feed."
          confidence: STATIC-INFERRED
          evidence: "ToolbarTabs.tsx:76"
        - q: "When the user clicks, what does the implementation actually USE the label for?"
          a: "Link is `activityPath(activityQueryString)` → `/activity?<query>`. The query is built from `useQueryParams(defaultActivityQuery)` on the CURRENT page — a 5-day window from `defaultActivityQuery.beginDate/endDate`."
          confidence: STATIC-INFERRED
          evidence: "ToolbarTabs.tsx:77 + activityRoutes.ts:3-6 + Activity/common.ts:33-41"
        - q: "Does the scope match the promise?"
          a: "MATCHES — label says Activity, URL family is /activity. The pre-baked 5-day-window query is an intentional default (no user-selected window means a recent slice) but is not surfaced to the user; cross-ref LSN-020 for the Activity userIds filter issue documented in the Activity-feed pillar."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "Same as Q2"
        - q: "Wrong-assumption impact?"
          a: "User clicking Activity from Day 8 of inactivity expects to see today's events — instead lands on a window pre-baked at module-import time (the moment the SPA bundle was loaded), which may be days stale. The window updates only on full reload."
          confidence: STATIC-INFERRED
          evidence: "Activity/common.ts:33-34 (beginDate/endDate computed AT MODULE-LOAD time, not at click-time — `addDays(new Date(), -5)` runs once per bundle load)"
        - q: "Closer-aligned variant?"
          a: "A click-time-recomputed window would be more accurate but the current design caches at module-load."
          confidence: STATIC-INFERRED
          evidence: "Activity/common.ts:33-41 (module-scoped const, not function)"
      routes_to_finding: "tests_coverage_semantic.uncovered_behaviours (the module-load-time window staleness is untested)"
  probes_emitted:
    - probe_id: P-175
      question: "Verify that all 9 tabs render unconditionally for every authentication mode (DISABLED / LOGIN_FORM / OAUTH2 / LDAP) and every role (READ_ONLY / ADMIN / unprivileged). Confirms the Category D claim that tab visibility has no permission gate."
      probe_path: "lineage/odd-platform/probes/P-175.yaml"
  stress_summary:
    triggers_total: 13
    questions_total: 38
    answers_static_inferred: 34
    answers_probe_needed: 1
    answers_reference: 3
    drift_flags: 6
```

## security

- auth_mode_relevance: INTERNAL_ONLY
  - "ToolbarTabs is a UI component rendered inside the post-auth SPA shell; auth mode (DISABLED / LOGIN_FORM / OAUTH2 / LDAP) is determined upstream by Spring Security. The component reads no auth-mode state. (Cross-ref AppToolbar sidecar.)"
- ingestion_filter_relevance: "N/A — not on ingestion path"
- authorization_assertions: []
  - "No @PreAuthorize-equivalent; no programmatic permission check; no Role / Permission read. Cross-ref: Grep for `usePermissions|getGlobalPermissions|hasGlobalPermission|Permission\\.` inside the AppToolbar subtree returns 0 matches."
- owner_scoping: "N/A — code is not data-scoped"
- data_exposure: []
  - "Component renders tab LABELS only (translated strings from the locale corpus). No user data, no sensitive identifiers, no PII exposure."
- known_security_gaps:
  - "Tab visibility is structurally unconditional — READ_ONLY users see the 'Management' tab the same as ADMIN. The downstream Management page is permission-gated per route (cross-ref ZH WithPermissionsProvider non-blocking finding), but the discovery affordance — 'this feature exists' — is leaked to every authenticated user. For instances with strict separation-of-duties requirements, this leaks the EXISTENCE of management capabilities to non-management users. Whether intentional (consistent UI for all users) or accidental, undocumented." — evidence: ToolbarTabs.tsx:34-82 (no permission read) — severity: MEDIUM
  - "Tab visibility does NOT participate in Active Features (the platform's feature-flag system via `WithFeature`). If an admin disables a backend feature (e.g. the GenAI assistant), the corresponding UI surfaces become 5xx-able but the tab — for Activity, Alerts, Catalog, etc., none of which are feature-flagged today but might be in future — would not auto-hide. Cross-ref the F-034 feature-flag pattern: WithFeature exists (`WithFeature.tsx:15-36`) but is NEVER used to wrap any tab." — evidence: ToolbarTabs.tsx + Grep `WithFeature` in the AppToolbar subtree returns no matches — severity: LOW

## performance

- hot_paths:
  - "useEffect at lines 86-105 runs on EVERY pathname change — fires the substring scan over all 9 tabs to find selectedness. With 9 tabs the cost is trivial (9 string includes), but the pattern would scale poorly if tabs grew to dozens."
  - "useMemo at lines 34-82 rebuilds the tabs array whenever `activityQueryString` or `t` changes — `activityQueryString` is recomputed on every render via `useQueryParams(defaultActivityQuery)`, which depends on the URL search string. On pages where the user changes query parameters (e.g. Activity page filter changes), the tabs array gets rebuilt repeatedly. Each rebuild creates 9 new object literals — minor GC pressure, not measured."
- throughput_characteristics:
  - "Stateless per-render — no batching, no streaming."
- resource_allocation: []
  - "Negligible. 9 object literals + 1 numeric state + 1 effect."
- scaling_characteristics:
  - "Stateless component — instances scale per-tab not per-user. Selected-tab state lives in the component, not in Redux, so reload resets selectedness (then re-derives from URL via the useEffect)."
- known_performance_gaps:
  - "useMemo dep array includes the entire `t` translation function (which can be referentially unstable across i18next re-inits) AND `activityQueryString` — the tabs array can be rebuilt more often than strictly necessary. Operator-visible impact: nil; engineering smell. Not measured." — evidence: ToolbarTabs.tsx:81 — severity: LOW

## upstream_callers

- entry_point: "ui_shell:AppToolbar"
  caller_node: "odd-platform ts react-component component:AppToolbar"
  multiplicity_per_trigger: 1
  evidence: "AppToolbar.tsx:64 — `<Grid item sx={{ pl: 1 }}><ToolbarTabs /></Grid>` rendered once per AppToolbar mount; AppToolbar is mounted once per App.tsx render (App.tsx:56)"
  observation_class: ui-call

## downstream_side_effects

- side_effect_class: page-render
  description: "Renders 9 tab labels in a fixed row at the top of the viewport. Always-visible to every authenticated user, regardless of role / permissions / feature flags."
  evidence: "ToolbarTabs.tsx:128-135 (returns <AppTabs items={tabs} ... />)"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:* (every authenticated route — AppToolbar mounts unconditionally at App.tsx:56 ahead of <Routes>)"

- side_effect_class: external-call
  description: "On 'Catalog' click: dispatches createDataEntitiesSearch thunk (POST /api/search) → mints a new server-side searchId → navigates to /search/<searchId>. Repeated clicks mint repeated searchIds; no de-duplication. Silent-failure on thunk rejection (no .catch)."
  evidence: "ToolbarTabs.tsx:121-123 + useCreateSearch.ts:14-19"
  cardinality_per_call: "1 per Catalog click (one POST per click)"
  reachable_from_entry_points:
    - "ui_route:* (any page; Catalog is in the toolbar everywhere)"

- side_effect_class: external-call
  description: "On 'Dictionary' click: dispatches createTermSearch thunk (POST /api/termsearch) → mints a new server-side termSearchId → navigates to /termsearch/<id>. Same orphan-record + silent-failure semantics as Catalog."
  evidence: "ToolbarTabs.tsx:112-117"
  cardinality_per_call: "1 per Dictionary click"
  reachable_from_entry_points:
    - "ui_route:* (any page)"

- side_effect_class: redirect-issue
  description: "On any non-Catalog, non-Dictionary tab click: react-router-dom <Link to=...> triggers a client-side navigation. No backend call. Effect is purely URL-bar + history-stack change + SPA re-render of the matched <Route> at App.tsx."
  evidence: "ToolbarTabs.tsx:128-135 → AppTabs.tsx:81-100 → AppLinkTab (component=Link)"
  cardinality_per_call: "1 history push per non-Catalog/Dictionary click"
  reachable_from_entry_points:
    - "ui_route:* (any page)"

## sources

- understanding ← ToolbarTabs.tsx:1-138
- concepts.entities.PrimaryNavigationTab ← ToolbarTabs.tsx:34-82
- concepts.entities.AppTabItem ← AppTabs.tsx:11-19
- concepts.entities.Selected-tab index ← ToolbarTabs.tsx:84, 87-89
- concepts.operations.Build static tab list ← ToolbarTabs.tsx:34-82
- concepts.operations.Resolve selected tab from URL ← ToolbarTabs.tsx:86-105
- concepts.operations.Handle Catalog click ← ToolbarTabs.tsx:121-123 + useCreateSearch.ts:14-19
- concepts.operations.Handle Dictionary click ← ToolbarTabs.tsx:111-119
- concepts.invariants.Tab order is hard-coded ← ToolbarTabs.tsx:35-79
- concepts.invariants.First tab has no value field ← ToolbarTabs.tsx:36-39
- concepts.invariants.Every tab is always-visible ← ToolbarTabs.tsx:34-82 + Grep no permission/feature read
- concepts.invariants.Selected-tab detection substring ← ToolbarTabs.tsx:100-104
- concepts.invariants.Activity tab dynamic link ← ToolbarTabs.tsx:31-32, 77, 81
- concepts.invariants.tab.value is discriminator not URL ← ToolbarTabs.tsx:42-79
- dependencies_semantic.requires-feature ← ToolbarTabs.tsx:1-12 (imports)
- dependencies_semantic.requires-config.ActivityQuery default ← Activity/common.ts:36-41
- docs_link_semantic.inferred_docs[0] ← WebFetch https://docs.opendatadiscovery.org/features/data-discovery/search (200, 2026-05-26)
- docs_link_semantic.inferred_docs[1] ← WebFetch https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed (200, 2026-05-26)
- docs_link_semantic.doc_drift_findings.[0] ← ToolbarTabs.tsx:37-39 + searchRoutes.ts:3 + live WebFetch above
- docs_link_semantic.doc_drift_findings.[1] ← ToolbarTabs.tsx:66-69 + termsRoutes.ts:6
- docs_link_semantic.doc_drift_findings.[2] ← ToolbarTabs.tsx:50-54 + queryExamplesRoutes.ts:30
- docs_link_semantic.doc_drift_findings.[3] ← ToolbarTabs.tsx:55-59 + masterDataRoutes.ts:1-4 + cross-ref ZH sidecar
- docs_link_semantic.doc_drift_findings.[4] ← WebFetch https://docs.opendatadiscovery.org/features/features (200, 2026-05-26) + ToolbarTabs.tsx:34-82
- implicit_adrs.[0] ← ToolbarTabs.tsx:34-82
- implicit_adrs.[1] ← ToolbarTabs.tsx:86-105
- implicit_adrs.[2] ← ToolbarTabs.tsx:107-126
- bugs_limitations_corner_cases.[0] ← ToolbarTabs.tsx:34-82 + App.tsx
- bugs_limitations_corner_cases.[1] ← locales/translations/en.json (missing 3 keys) + locales/translations/ua.json (same 3 missing) + ToolbarTabs.tsx:46, 51, 56
- bugs_limitations_corner_cases.[2] ← ToolbarTabs.tsx:100-104
- bugs_limitations_corner_cases.[3] ← ToolbarTabs.tsx:121-123
- bugs_limitations_corner_cases.[4] ← ToolbarTabs.tsx:31-32, 77, 81 + Activity/common.ts:36-41
- bugs_limitations_corner_cases.[5] ← ToolbarTabs.tsx:112-117 + useCreateSearch.ts:14-19
- bugs_limitations_corner_cases.[6] ← ToolbarTabs.tsx:35-79
- bugs_limitations_corner_cases.[7] ← ToolbarTabs.tsx:55-59 + App.tsx:75-88
- bugs_limitations_corner_cases.[8] ← AppTabs.tsx:17-18 + ToolbarTabs.tsx:34-82
- security.auth_mode_relevance ← ToolbarTabs.tsx:25-30 + AppToolbar.tsx:18-22 + App.tsx:53-94
- security.authorization_assertions ← Grep `usePermissions|getGlobalPermissions|hasGlobalPermission` in AppToolbar subtree (0 results)
- security.known_security_gaps.[0] ← ToolbarTabs.tsx:34-82
- security.known_security_gaps.[1] ← ToolbarTabs.tsx + WithFeature.tsx:15-36 (capability exists, never used here)
- performance.hot_paths.[0] ← ToolbarTabs.tsx:86-105
- performance.hot_paths.[1] ← ToolbarTabs.tsx:34-82
- performance.known_performance_gaps.[0] ← ToolbarTabs.tsx:81
- upstream_callers.[0] ← AppToolbar.tsx:64 + App.tsx:56
- downstream_side_effects.[0] ← ToolbarTabs.tsx:128-135
- downstream_side_effects.[1] ← ToolbarTabs.tsx:121-123 + useCreateSearch.ts:14-19
- downstream_side_effects.[2] ← ToolbarTabs.tsx:112-117
- downstream_side_effects.[3] ← ToolbarTabs.tsx:128-135 + AppTabs.tsx:81-100

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: MEDIUM
- upstream_callers: HIGH
- downstream_side_effects: HIGH
- stress_findings: HIGH

## Maintainer notes

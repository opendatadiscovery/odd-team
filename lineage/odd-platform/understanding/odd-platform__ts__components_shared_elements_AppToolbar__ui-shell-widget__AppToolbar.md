---
node_id: "odd-platform ts components/shared/elements/AppToolbar ui-shell-widget:AppToolbar"
node_kind: ui-shell-widget
axis: ui-shell-widgets
extracted_at_commit: 4ec2b20
enriched_at_commit: 4ec2b20
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-26-ZJ-AppToolbar
schema_version: v0.3.0
pillar: P-09
back_links:
  feature_ids: []  # no F-NNN yet enumerates the AppToolbar surface; sidecar surfaces the chrome
  pillar_anchored_ids:
    - "P-09:F-001 UI authentication (logout link, user-name display)"
    - "P-09:F-002 Principal-to-Owner Resolution (owner.name ?? identity.username precedence)"
    - "P-04:F-NN UI navigation chrome (the 9 hardcoded primary tabs)"
  refactor_ids: [REFACTOR-185]
  retrospective_ids: []  # ZH systemic finding referenced via cross-reference, not own retrospective
  adr_candidate_ids: []
  sibling_sidecars:
    - "odd-platform__java__IdentityController__controller-class__IdentityController.md (the /api/identity/whoami backend that feeds owner + identity selectors — dummyOwner with username='admin' under DISABLED)"
    - "odd-platform__java__FeatureController__controller-class__FeatureController.md (boot-immutable feature-flag surface; ToolbarTabs ignores its output)"
    - "odd-platform__java__LoginFormSecurityConfiguration__config-class__LoginFormSecurityConfiguration.md (LOGIN_FORM mode — the .logout(Customizer.withDefaults()) handler that `/logout` GET binds to)"
    - "odd-platform__ts__routes__route__directory.md (Directory tab destination — sibling unconditionally-rendered tab; P-169 covers cross-owner exposure)"
---

# AppToolbar (ui-shell-widget) — semantic understanding

## understanding

`AppToolbar` is the **single application-wide chrome** rendered above every route in `App.tsx:56` (sole instance, mounted unconditionally for every authenticated state including DISABLED-mode anonymous traffic). It is a **123-line stateless functional component** that composes four sub-surfaces: (a) the **brand block** (logo + "Platform" h4, links to `/`, lines 54-61); (b) the **primary tab navigation** (`<ToolbarTabs />`, line 64, which renders 9 hardcoded tabs — Catalog / Directory / Data Quality / Data Modelling / Master Data / Management / Dictionary / Alerts / Activity — `ToolbarTabs.tsx:34-82`); (c) the **app-info menu** (`<AppInfoMenu />`, line 67, the information-icon popup with Documentation/Slack/Version/Feedback links + admin-curated app-links from `useAppLinks()`); and (d) the **user-menu cluster** (lines 68-82 — clickable `owner?.name ?? identity?.username` text + dropdown chevron, opens an `AppMenu` containing language switcher + Logout). The toolbar pulls identity via two redux selectors (`getIdentity` / `getOwnership`, lines 20-21) that read `profile.owner.identity` and `profile.owner.owner` respectively — both populated by the single `fetchIdentity()` dispatch in `App.tsx:48` that calls `identityApi.whoami()` (the backend's `IdentityController.whoami` endpoint). Under `auth.type=DISABLED` (the bundled default per `application.yml:34`), the backend returns `dummyOwner` with `username="admin"` and `owner=null` (`IdentityController.java:30-33`), so the toolbar renders **"admin"** in the top-right corner with no owner association — exactly the visible UX symptom of REFACTOR-185 (any anonymous network caller who can reach the SPA sees themselves rendered as the "admin" user). The Logout link is a **plain navigation to `/logout`** (line 36, `window.location.href = '/logout'`) — under DISABLED this route is permitted by `.anyExchange().permitAll()` (`DisabledAuthSecurityConfiguration.java:16`) but no backend handler exists for the path (`/logout` is provided by Spring Security's `.logout(Customizer.withDefaults())` only under LOGIN_FORM/LDAP/OAUTH2 configurations); clicking Logout under DISABLED yields a 404 page that the user must back out of. Critically, the toolbar has **NO permission or feature-flag gating** on any of its 9 tabs — no `<WithFeature>` wrapper (which IS used to gate Data Collaboration elements elsewhere — `Message.tsx:59`, `MainThreadMessage.tsx:36`, `DataEntityDetailsHeader.tsx:132`), no `<WithPermissionsProvider>` wrapper (which ZH established is non-blocking anyway), and no role check — every authenticated user sees every tab, including Data Modelling (Query Examples, which is a `Feature.DATA_COLLABORATION`-gated sub-feature on its destination pages but ungated on the tab entrypoint) and Management (which routes into Owner / Role / Policy / Tag / Lookup-table / Identity-Provider administration). The scroll-elevation effect (lines 39-46) elevates the toolbar from 0 → 3 paper-shadow when window-scroll exceeds 10px; `useScrollTrigger` is bound to `window` (line 43, `target: window`) — fragile under SSR but the SPA is client-only so harmless in practice.

## concepts

- entities:
  - `AppToolbar` (FC, lines 18-121)
  - `identity` (`Identity | undefined` — username + permissions[]; selector `getIdentity` reads `profile.owner?.identity`, `profile.selectors.ts:10-13`)
  - `owner` (`Owner | undefined` — name + id; selector `getOwnership` reads `profile.owner?.owner`, `profile.selectors.ts:15`)
  - `ToolbarTabs` (sibling component, the 9-tab strip — `ToolbarTabs/ToolbarTabs.tsx:25-138`)
  - `AppInfoMenu` (sibling component, info-icon popup — `AppInfoMenu/AppInfoMenu.tsx:16-127`)
  - `SelectLanguage` (language-switch dialog inside the user menu — `SelectLanguage/SelectLanguage.tsx:18-79`)
  - `AppMenu` (MUI Menu wrapper, lines 87-118 — keepMounted, anchored to user-cluster `Box`)
  - `S.Bar` / `S.Container` / `S.ContentContainer` / `S.LogoContainer` / `S.Title` / `S.Logo` / `S.ActionsContainer` / `S.SectionDesktop` / `S.UserName` / `S.LanguageContainer` (styled-components in `AppToolbarStyles.ts:6-88`)
- operations:
  - read-identity-from-redux: `useAppSelector(getIdentity)` (line 20)
  - read-ownership-from-redux: `useAppSelector(getOwnership)` (line 21)
  - render-userName-with-owner-precedence: `owner?.name ?? identity?.username` (line 74) — owner name preferred; falls back to identity username (which is the literal "admin" under DISABLED per IdentityController.java:32)
  - open-user-menu: `handleProfileMenuOpen(event)` → `setAnchorEl(event.currentTarget)` (lines 27-29)
  - close-user-menu: `handleMenuClose()` → `setAnchorEl(null)` (lines 31-33)
  - logout-via-window-redirect: `handleLogout()` → `window.location.href = '/logout'` (lines 35-37) — full-page navigation, no SPA-router involvement, bypasses any in-memory state save
  - bind-scroll-elevation: `useScrollTrigger({ disableHysteresis: true, threshold: 10, target: window })` (lines 40-44) — fires at 10px scroll
  - sync-elevation-state: `useEffect(() => setElevation(trigger ? 3 : 0), [trigger])` (line 46) — paper-shadow 0 → 3 on scroll past 10px
  - resolve-current-language-label: `LANGUAGES_MAP[i18n.language as Lang]` (line 48) — typed lookup against the 6-entry map at `constants.ts:158-165`
- invariants:
  - "the toolbar is rendered EXACTLY ONCE in `App.tsx:56`, above the Routes block — there is no per-route variant, no auth-state-gated variant, no role-gated variant"
  - "identity / owner selectors are read on every render — the toolbar re-renders whenever profile.slice state changes (i.e. when fetchIdentity resolves, when setProfileOwnerName fires, or when fetchResourcePermissions resolves)"
  - "the 9 primary tabs are HARDCODED in `ToolbarTabs.tsx:34-82` — no feature-flag lookup, no permission check, no role check; every authenticated user sees every tab"
  - "the userName render uses `??` (nullish coalescing) — empty string in identity.username would NOT fall through to owner (which is desired — empty-string username at boot before fetchIdentity resolves shows blank); but `null`/`undefined` does fall through"
  - "initial state of profile.slice (`profile.slice.ts:7-12`) is `owner: { identity: { username: '' } }` — so during the brief window before fetchIdentity resolves, the toolbar shows an EMPTY user-name and a non-functional dropdown (no menu actions visible until anchorEl is set, but the menu itself is keepMounted)"
  - "the Logout link is a HARDCODED string `/logout` — not a generated route, not env-configurable, not auth-mode-aware"
  - "the scroll-elevation `target: window` is read at component-construct time (line 43) — if the component is unmounted and remounted across a non-SPA navigation, the reference is fine; under SSR it would throw (window undefined) but the SPA has no SSR path"
  - "the language switcher persists via `localStorage.setItem('i18nextLng', lang)` (`SelectLanguage.tsx:30`) — the i18n init reads back from `localStorage.getItem('i18nextLng')` at `i18n.ts:22-26` with fallback to 'en'"
- audiences:
  - "every authenticated SPA user (and every anonymous network caller under DISABLED) — the toolbar is THE primary navigation surface; users click tabs to reach all data-discovery features; click the user-name to logout or switch language; click the info-icon for documentation/version/feedback"

## dependencies_semantic

- requires-feature:
  - "IdentityController @ /api/identity/whoami (the userName + permissions feed) — without this the toolbar shows '' until the request resolves (or indefinitely if it 401s — `App.tsx:48` swallows errors via `.catch(() => {})`)"
  - "FeatureController @ /api/features/active (BUT NOT ACTUALLY USED by the toolbar's tab rendering — see Category B finding) — the data is fetched and stored at `App.tsx:49` but ToolbarTabs.tsx does NOT consume `getActiveFeatures`; only sub-pages (e.g. DataCollaboration messages) honour the flag"
  - "AppInfoController @ /api/info (via AppInfoMenu's `useAppInfo()` — surfaces projectVersion in the info popup)"
  - "LinksController @ /api/info/links (via AppInfoMenu's `useAppLinks()` — surfaces operator-curated app-links)"
  - "Spring Security `/logout` handler (only under LOGIN_FORM/LDAP/OAUTH2 — NOT under DISABLED)"
- requires-config:
  - "auth.type — implicitly shapes the userName render: DISABLED → 'admin' (from IdentityController.dummyOwner), LOGIN_FORM/OAUTH2/LDAP → real principal's username (resolved by AuthIdentityProviderImpl)"
  - "datacollaboration.enabled / notifications.enabled — backing flags for `Feature.DATA_COLLABORATION` / `Feature.ALERT_NOTIFICATIONS`, but toolbar IGNORES these (tabs render regardless)"
- requires-runtime:
  - "Redux store with `profile` slice (`profile.slice.ts:14-32`) — the toolbar is unrenderable without it; if the slice is unmounted, useAppSelector throws"
  - "react-i18next initialised at `locales/i18n.ts:27-31` with 6 languages (en/es/ch/fr/ua/hy) and 'en' default — toolbar pulls `t('Logout')` and `t('Select language')` strings from these resources"
  - "MUI ThemeProvider — `S.Bar` and `S.Logo` styled-components read `theme.palette.common.white`, `theme.palette.divider`, etc. (`AppToolbarStyles.ts:7, 17, 37`)"
  - "react-router-dom — `S.Title to='/'` (line 55) uses the `Link` import (`AppToolbarStyles.ts:3`) to make the logo navigable"
  - "window object — `useScrollTrigger({ target: window })` (line 43) requires DOM context; SSR-incompatible but moot since the SPA is client-only"
  - "localStorage — `i18n.ts:22` reads `i18nextLng`; `SelectLanguage.tsx:30` writes it. Without localStorage the language preference is lost on every reload"

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "userName falls back from owner.name to identity.username when owner is null"
    test_class: unit
    criticality: MEDIUM
    note: "the nullish-coalescing operator is straightforward, but the integration of selector → render is exactly the class of bug a UI unit test catches; no AppToolbar.test.tsx exists"
  - behaviour: "userName renders 'admin' literal under DISABLED mode (DISABLED → dummyOwner → owner=null → identity.username='admin')"
    test_class: integration
    criticality: HIGH
    note: "the cross-layer DISABLED-mode UX symptom — requires backend (IdentityController dummyOwner) + frontend (profile.slice + selectors + AppToolbar) + DISABLED auth config; this is the integration class that ZD/ZH-style integration probes target"
  - behaviour: "Logout link under DISABLED produces a 404 (no /logout handler registered)"
    test_class: integration
    criticality: MEDIUM
    note: "operator-visible UX defect — the Logout button is shown but non-functional under the default deployment mode; needs an integration probe"
  - behaviour: "9 tabs render unconditionally regardless of feature-flag state (Data Modelling visible even when datacollaboration.enabled=false; etc.)"
    test_class: integration
    criticality: MEDIUM
    note: "the cross-layer feature-flag-vs-toolbar drift; tab destinations may be feature-gated but the tab entrypoint is not"
  - behaviour: "language switcher persists choice across reloads"
    test_class: integration
    criticality: LOW
    note: "localStorage round-trip; the i18n.ts init logic is testable in isolation but the AppToolbar → SelectLanguage → localStorage → reload flow is integration"
  - behaviour: "scroll-elevation kicks in at exactly 10px"
    test_class: unit
    criticality: LOW
    note: "useScrollTrigger threshold; trivial but observable visual behaviour"
- test_files: []  # no AppToolbar.test.tsx or ToolbarTabs.test.tsx found
- gaps: |
    No tests exist for AppToolbar, ToolbarTabs, AppInfoMenu, or SelectLanguage at any class. The integration-class gaps are the highest-leverage: a single integration test asserting the DISABLED-mode "admin" render would catch the UX symptom of REFACTOR-185; a tab-vs-feature-flag integration test would catch the Category B drift below. The unit-class gaps are nice-to-have. The toolbar is on the critical path for every user interaction (every tab click, every logout, every language switch) yet has zero coverage — exactly the class of widget where a refactor regression goes unnoticed until it hits production.

## docs_link_semantic

- declared_docs: []  # no @docs annotation in AppToolbar.tsx
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/active-platform-features/ui-overview"
    anchor: ""
    rationale: "expected canonical home for the application-shell / navigation-chrome documentation"
    last_verified_at: "2026-05-26"
    last_verified_status: 404
    confidence: LOW
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform"
    anchor: ""
    rationale: "live config-reference page; passing reference exists to 'the App Info menu (the popup behind the information icon in the top-right toolbar)' in the odd.links section — the only documented mention of the toolbar"
    last_verified_at: "2026-05-26"
    last_verified_status: 200
    fetched_excerpts: |
      "The platform UI surfaces them inside the App Info menu (the popup behind the information icon in the top-right toolbar)."
      (No other reference to navigation tabs, language selection, or user menu found in the page.)
    confidence: LOW
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication"
    anchor: ""
    rationale: "expected to document the userName under DISABLED mode and the logout flow; verified to contain no such mention"
    last_verified_at: "2026-05-26"
    last_verified_status: 200
    fetched_excerpts: |
      "(No mention of: app shell, toolbar, navigation bar, logout flow, 'admin' dummy user, DISABLED mode user identity, language selection.)"
    confidence: LOW
- doc_drift_findings:
  - "the LIVE 'ui-overview' page does not exist (404 — fetched 2026-05-26); the 9 hardcoded primary tabs are completely undocumented; an operator cannot discover from the docs that Catalog / Directory / Data Quality / Data Modelling / Master Data / Management / Dictionary / Alerts / Activity are the navigation primitives"
  - "the live authentication docs do NOT mention that under auth.type=DISABLED the toolbar renders 'admin' as the username and the logout button is non-functional (REFACTOR-185-relevant doc gap — UX symptom of the broader REFACTOR-185 finding)"
  - "the language switcher and its 6 supported locales (English, Spanish, Chinese, French, Ukrainian, Armenian) are completely undocumented; an operator deploying for a Spanish-speaking team has no way to know the locale exists short of finding the gear-menu in the user dropdown"

## implicit_adrs

- "user-name display prefers owner.name over identity.username — chosen so that operator-curated 'display names' (set via OwnerAssociation) override the raw principal username (which under LDAP/OAUTH2 may be a UPN or email)" — evidence: AppToolbar.tsx:74 (`{owner?.name ?? identity?.username}`) — intent_anchor: "owner?.name ?? identity?.username" (the precedence chosen via nullish-coalescing, repeated nowhere else; the convention is enforced by reading both selectors and choosing one) — confidence: MEDIUM
- "logout is a full-page redirect, not a SPA-router navigation — chosen so that the backend's Spring-Security logout handler can clear server-side session state AND redirect (e.g. OAuthLogoutSuccessHandler chains to the IDP's logout endpoint per `OAuthSecurityConfiguration.java:100`); a client-side router navigation would skip the session-clear step" — evidence: AppToolbar.tsx:35-37 (`handleLogout = () => { window.location.href = '/logout'; }`) — intent_anchor: "window.location.href = '/logout'" (the choice of full-page redirect over react-router's `navigate('/logout')` is a deliberate departure from the rest of the SPA's navigation pattern) — confidence: MEDIUM
- "scroll-elevation effect uses MUI's useScrollTrigger with threshold=10 and disableHysteresis=true — chosen so the elevation kicks in immediately and reversibly at a precise scroll position, avoiding the default hysteresis that would make the elevation 'stick' once triggered" — evidence: AppToolbar.tsx:40-44 — intent_anchor: "disableHysteresis: true, threshold: 10" (the explicit disableHysteresis is the choice; default would be false) — confidence: HIGH

## bugs_limitations_corner_cases

- "9 tabs render unconditionally regardless of feature-flag state — Data Modelling (Query Examples) is a Data Collaboration feature gated by `Feature.DATA_COLLABORATION` (datacollaboration.enabled, default false) on its destination pages (`Message.tsx:59`, `MainThreadMessage.tsx:36`, `DataEntityDetailsHeader.tsx:132` all wrap children in <WithFeature featureName={Feature.DATA_COLLABORATION}>), but the tab entrypoint at `ToolbarTabs.tsx:50-54` is NOT wrapped. Under default deployment (datacollaboration.enabled=false), clicking the Data Modelling tab navigates to /data-modelling/query-examples but the user sees an empty / non-functional surface. Same pattern applies to ANY tab whose destination is feature-gated downstream." — evidence: ToolbarTabs.tsx:34-82 (no WithFeature wrapper); App.tsx:49 (fetchActiveFeatures dispatched but result unused by ToolbarTabs); Message.tsx:59 (the pattern that SHOULD be applied) — severity: MEDIUM
- "no <WithPermissionsProvider> wrapper around the Management tab (which routes into /management/* — Owner, Role, Policy, Tag, Lookup-Table, Identity-Provider administration). Per ZH systemic finding, WithPermissionsProvider is non-blocking anyway — but its ABSENCE means there is no policy-driven hiding of the Management tab from non-admin users. Every authenticated user (and every anonymous caller under DISABLED) sees the Management tab and can click into it; backend authorization gates whatever they try to do, but the tab presence leaks the existence of an admin surface" — evidence: ToolbarTabs.tsx:60-64 (no permission wrapping); cross-ref ZH systemic finding (WithPermissionsProvider.tsx is non-blocking) — severity: LOW
- "userName under auth.type=DISABLED renders the literal string 'admin' (from IdentityController.dummyOwner — identity.username='admin', owner=null, so owner?.name ?? identity?.username → 'admin'). This is the user-visible symptom of REFACTOR-185: any anonymous network caller who can reach the SPA sees themselves rendered as 'admin' in the top-right corner and has every action available. The toolbar surfaces no warning, no banner, no indicator that the user is unauthenticated" — evidence: AppToolbar.tsx:74; IdentityController.java:30-33; DisabledAuthSecurityConfiguration.java:11-19; application.yml:34 — severity: HIGH
- "clicking Logout under auth.type=DISABLED yields a 404 (no Spring-Security /logout handler registered — `.logout(Customizer.withDefaults())` is only configured in `LoginFormSecurityConfiguration.java:59` and `LDAPSecurityConfiguration.java:146`; OAUTH2 uses a custom handler; DisabledAuthSecurityConfiguration.java has NO .logout(...) call). The Logout link is shown to every user including DISABLED-mode users; clicking it produces a confusing UX error" — evidence: AppToolbar.tsx:35-37; DisabledAuthSecurityConfiguration.java:11-19 (no logout chain); LoginFormSecurityConfiguration.java:59 / LDAPSecurityConfiguration.java:146 (the ONLY places .logout is configured) — severity: MEDIUM
- "user-name initial render is empty string (during the brief window between component mount and fetchIdentity completion). The user sees a dropdown with no name next to it; not a bug per se but a flash-of-empty-content (FOEC) typical of unsuspended fetches. App.tsx:46-51 dispatches fetchIdentity in useEffect (post-mount, not pre-mount), so the first paint is always identity.username='' (the profile.slice.ts:8 initial state)" — evidence: AppToolbar.tsx:74; App.tsx:46-51; profile.slice.ts:7-12 — severity: LOW
- "no error handling on fetchIdentity failure — `App.tsx:48` catches and swallows (`fetchIdentity().catch(() => {})`); if /api/identity/whoami returns 401/500, the toolbar shows '' forever and the user has no indication of the failure. The selectors `getIdentityFetchingStatuses` exist (`profile.selectors.ts:40`) but AppToolbar does NOT consume them — no spinner, no error banner, no retry button" — evidence: AppToolbar.tsx:20-21 (no statuses selector read); App.tsx:48 (silent swallow); profile.selectors.ts:40 (exists but unused) — severity: LOW
- "language switcher list is bound to `i18n.languages` (`SelectLanguage.tsx:48`) which i18next derives from the `fallbackLng` array; the fallbackLng is `['en', 'es', 'ch', 'fr', 'ua', 'hy']` (`i18n.ts:30`) — but this means SELECTING any language from the dropdown TRIGGERS fallbackLng iteration. The first language in fallbackLng is 'en'; so unrecognised entries silently fall back to English. There is no UI indication when a translation key is missing in the selected language and the en fallback is used" — evidence: i18n.ts:30 (fallbackLng array); SelectLanguage.tsx:48-66 (iteration over i18n.languages, no missing-key indicator) — severity: LOW
- "browser language preference (navigator.language) is NEVER consulted — i18n.ts:22 reads localStorage('i18nextLng') with fallback to 'en' (hardcoded). A user with a Spanish-language browser sees English on first visit; they have to manually switch via the gear menu (which is itself in English). Cross-cultural UX defect" — evidence: i18n.ts:20-25; SelectLanguage.tsx:28-33 — severity: LOW
- "useScrollTrigger reads `target: window` at component-construct time (`AppToolbar.tsx:43`). If the component is mounted under a JSDOM testing harness where `window.addEventListener` is shimmed differently, the scroll-elevation will not fire — testing the elevation behaviour requires a real browser environment (or a Playwright/Cypress E2E harness)" — evidence: AppToolbar.tsx:40-44 — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "AppToolbar.tsx:42"
      name: "threshold (useScrollTrigger)"
      value: "10"
      questions:
        - q: "What at N = 0?"
          a: "useScrollTrigger fires elevation transition at the first pixel of scroll; the toolbar elevates immediately on any scroll-start. Behaviour is observable but trivial."
          confidence: STATIC-INFERRED
          evidence: "AppToolbar.tsx:42 (threshold: 10) + MUI useScrollTrigger semantics"
        - q: "What at N = 10? At N = 11?"
          a: "Exactly at scroll-position 10px the trigger fires; the elevation transitions from 0 to 3 paper-shadow. disableHysteresis: true means it reversibly tracks scroll position (scrolling back below 10px reverts the elevation to 0). At 11px the elevation is solid 3."
          confidence: STATIC-INFERRED
          evidence: "AppToolbar.tsx:40-44 (disableHysteresis: true, threshold: 10) + useEffect line 46"
        - q: "What does the operator see at the boundary?"
          a: "A subtle paper-shadow appears beneath the toolbar at scroll>10px. Visual cue, not a functional one. No truncation, no error."
          confidence: STATIC-INFERRED
          evidence: "AppToolbar.tsx:46, 51 (S.Bar elevation={elevation})"
    - location: "ToolbarTabs.tsx:80"
      name: "tabs (the hardcoded 9-tab array)"
      value: "9 tabs (Catalog / Directory / Data Quality / Data Modelling / Master Data / Management / Dictionary / Alerts / Activity)"
      questions:
        - q: "What at N = 0 tabs (e.g. if the array were dynamically computed and empty)?"
          a: "Not applicable to current code — the array is hardcoded with exactly 9 entries; there is no path by which it could be empty. If a future refactor made it dynamic and empty, AppTabs would render an empty strip."
          confidence: STATIC-INFERRED
          evidence: "ToolbarTabs.tsx:34-82 (literal array)"
        - q: "What at N > 9 (e.g. a feature added a 10th tab)?"
          a: "AppTabs would render 10 tabs; layout consequences depend on the AppTabs component's overflow handling. Beyond ~10 tabs at typical viewport widths, horizontal overflow becomes a concern, but the current code does not contemplate >9 tabs and this question is hypothetical/not load-bearing for current behaviour."
          confidence: STATIC-INFERRED
          evidence: "ToolbarTabs.tsx:34-82 (the hardcoded array IS the contract — adding a 10th tab is a future-refactor concern handled at refactor time)"
  name_behavior_pairs:
    - name: "AppToolbar (the component name)"
      promise: "renders the application toolbar — primary chrome with navigation, identity display, app info, language switcher, logout"
      implementation: "renders all of the above unconditionally (no role / feature / permission gating); userName resolves to owner.name OR identity.username (the second of which is the literal 'admin' under DISABLED); Logout link is a hardcoded /logout redirect that 404s under DISABLED"
      drift: MINOR
      operator_visible_consequence: "the toolbar shows 'admin' as the username and a non-functional Logout button under the default (DISABLED) deployment — a UX symptom of REFACTOR-185; the name promises a 'toolbar' (implying a personalised, working surface) but the implementation under DISABLED is depersonalised and partially broken"
      confidence: STATIC-INFERRED
      evidence: "AppToolbar.tsx:35-37, 74 + IdentityController.java:30-33 + DisabledAuthSecurityConfiguration.java:11-19"
    - name: "ToolbarTabs (the 9-tab array)"
      promise: "renders the tabs that the current user has access to / can use"
      implementation: "renders ALL 9 tabs unconditionally for every user including anonymous DISABLED-mode callers; no feature-flag check (`fetchActiveFeatures` is dispatched at App.tsx:49 but the result is NOT consumed by ToolbarTabs); no permission check; tab destinations may be feature-gated downstream but tab entrypoints are not"
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "users see tabs (e.g. Data Modelling) that lead to non-functional pages when the backing feature is disabled (datacollaboration.enabled=false, the default). The Management tab is visible to non-admin users even though most of its destination pages require admin privileges — leaking the existence of an admin surface to every authenticated user"
      confidence: PROBE-NEEDED
      evidence: "P-174 — verify Data Modelling tab visibility under datacollaboration.enabled=false (and corollary that backend FeatureController.getActiveFeatures returns empty)"
    - name: "handleLogout"
      promise: "logs the user out"
      implementation: "redirects the browser to /logout via window.location.href; under LOGIN_FORM/LDAP/OAUTH2 this hits Spring-Security's logout handler which clears the session and redirects; under DISABLED there is no /logout handler so the browser receives a 404"
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "under auth.type=DISABLED (the default), clicking Logout produces a 404 page. The user must back out of it; their 'session' (there isn't one) is unchanged. UX-confusing but security-neutral (there was nothing to log out from)"
      confidence: PROBE-NEEDED
      evidence: "P-174 — verify /logout returns 404 under auth.type=DISABLED (static analysis suggests it but Spring-Security default-chain may auto-register a handler)"
  orderings: []
  auth_gates:
    - location: "AppToolbar.tsx:1-123 (the entire file)"
      endpoint: "AppToolbar component (UI surface, not REST endpoint)"
      questions:
        - q: "What does this component render for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "DISABLED: renders 'admin' as the username (from IdentityController.dummyOwner), all 9 tabs visible, Logout link present but produces 404 on click. LOGIN_FORM: renders the authenticated principal's username (e.g. the LOGIN_FORM-configured admin user), all 9 tabs visible, Logout link clears Spring session and redirects to login form. OAUTH2: renders the OAuth principal's username/displayName, all 9 tabs visible, Logout chains to the OAuth provider's logout endpoint (e.g. Cognito/Google/Azure/ODDIAM via the respective LogoutSuccessHandler). LDAP: renders the LDAP principal's username, all 9 tabs visible, Logout clears Spring session."
          confidence: PROBE-NEEDED
          evidence: "P-174 — confirms the DISABLED-mode render of 'admin' at the UI layer (the static analysis derives it; the probe verifies it end-to-end)"
        - q: "What does an unauthenticated caller see?"
          a: "DISABLED: identical rendering to authenticated callers — there is no auth concept; the toolbar shows 'admin'. LOGIN_FORM/LDAP/OAUTH2: the SPA itself is gated by the global `.pathMatchers('/**').authenticated()` rule + the WHITELIST_PATHS — `/` (index.html) IS in WHITELIST so the SPA loads; fetchIdentity returns 401 (caught by App.tsx:48 silent catch); the toolbar shows '' (empty username) and the user is shortly redirected to the login form (LOGIN_FORM/LDAP) or to the IDP (OAUTH2)."
          confidence: STATIC-INFERRED
          evidence: "App.tsx:48 (silent catch); SecurityConstants WHITELIST_PATHS; LoginFormSecurityConfiguration.permittedPaths; profile.slice.ts:7-12 (initial empty state)"
        - q: "What does a wrong-role caller see?"
          a: "All 9 tabs visible regardless of role. No <WithPermissionsProvider> wrapping the toolbar or the tabs. A user with no Policy granting any Permission still sees the Management tab and can click into it; backend authorization gates whatever they try to do once inside."
          confidence: STATIC-INFERRED
          evidence: "AppToolbar.tsx (no PermissionsProvider import); ToolbarTabs.tsx (no permission check)"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "NOWHERE in the toolbar. The toolbar itself is not auth-gated. Identity / owner is FETCHED via /api/identity/whoami (gated by IdentityController's empty-context fallback to dummyOwner under DISABLED). Tab destinations are auth-gated at the backend controller / repository layer. The toolbar surfaces auth state (the username) but enforces nothing."
          confidence: STATIC-INFERRED
          evidence: "AppToolbar.tsx:1-123 (no auth annotation, no permission check); IdentityController.java:24-28"
  resource_boundaries:
    - location: "AppToolbar.tsx:46"
      kind: concurrency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "Not applicable — the toolbar is a single mounted instance; redux selectors are read-only; useState calls are local to the component. No multi-call concurrency to worry about."
          confidence: STATIC-INFERRED
          evidence: "AppToolbar.tsx:1-123 (single mounted instance per App.tsx:56)"
        - q: "Is the call replay-safe?"
          a: "The toolbar render is idempotent — same redux state + same scroll state → same render. The handleLogout call is full-page navigation (no replay relevant). The language switch is idempotent (selecting the same language twice has no observable effect)."
          confidence: STATIC-INFERRED
          evidence: "AppToolbar.tsx (no side-effectful re-render logic)"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No HTTP cache for the toolbar itself (it's a React component, not a fetched resource). The identity / owner data IS effectively a session-lived cache (fetched once at App.tsx:48 on mount, no re-fetch policy, no invalidation). If the user's owner association changes server-side mid-session, the toolbar continues showing the stale name until full page reload (the silent staleness window)."
          confidence: STATIC-INFERRED
          evidence: "App.tsx:46-51 (fetchIdentity dispatched once-on-mount, no polling or re-fetch); profile.slice.ts (no invalidation triggers)"
    - location: "SelectLanguage.tsx:28-33"
      kind: idempotency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "The language change is `await i18n.changeLanguage(lang); localStorage.setItem(...); handleClose(); handleMenuClose();` — sequential, awaited. Two rapid clicks of different languages would race on localStorage write (last-write-wins is fine); i18n.changeLanguage is debounced internally; no corruption observed."
          confidence: STATIC-INFERRED
          evidence: "SelectLanguage.tsx:28-33"
        - q: "Is the call replay-safe?"
          a: "Selecting the same language twice is idempotent (localStorage value unchanged; i18n.language unchanged). Selecting a different language is observable (UI re-renders in new language)."
          confidence: STATIC-INFERRED
          evidence: "SelectLanguage.tsx:28-33"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "localStorage is the cache; key 'i18nextLng'; TTL is browser-persistent (never expires until user clears localStorage or browser data). Staleness: if a translation file ships a new locale code (e.g. 'pt' for Portuguese added), users who selected an older one continue to see the older one until they manually re-select."
          confidence: STATIC-INFERRED
          evidence: "i18n.ts:22-26; SelectLanguage.tsx:30"
  request_inputs: []  # AppToolbar is a UI component, not a request handler — no named request inputs (path/query/body/header). Category F not applicable.
  probes_emitted:
    - probe_id: P-174
      question: "Under auth.type=DISABLED, does the toolbar visibly render the username 'admin' to an anonymous browser session, does clicking Logout produce a 404 (vs a graceful redirect), and does the Data Modelling tab navigate to /data-modelling/query-examples even when datacollaboration.enabled=false?"
      probe_path: "lineage/odd-platform/probes/P-174.yaml"
  stress_summary:
    triggers_total: 6  # 2 tunables + 3 name-behavior pairs + 1 auth-gate location + 2 resource_boundaries locations (deduplicated for summary)
    questions_total: 17
    answers_static_inferred: 14
    answers_probe_needed: 3   # ToolbarTabs drift (Cat B), handleLogout drift (Cat B), auth-mode rendering Q1 (Cat D) — all routed to P-174
    answers_reference: 0
    drift_flags: 3  # ToolbarTabs (DRIFT_NAME_VS_BEHAVIOR), handleLogout (DRIFT_NAME_VS_BEHAVIOR), AppToolbar component itself (MINOR)
```

## security

- auth_mode_relevance: ["DISABLED", "LOGIN_FORM", "OAUTH2", "LDAP"]
  notes: |
    The toolbar renders under ALL four auth modes. Under DISABLED it surfaces the dummyOwner ('admin') and a non-functional Logout. Under LOGIN_FORM / LDAP it surfaces the authenticated principal's username and a functional Spring-Security `.logout()` handler. Under OAUTH2 it surfaces the OAuth principal's username and a logout flow that chains to the configured IDP (Cognito/Google/Azure/ODDIAM). The toolbar itself enforces no gate; it surfaces what IdentityController + the SecurityFilterChain decided.
- ingestion_filter_relevance: "N/A — UI component, not on the ingestion path"
- authorization_assertions: []  # no @PreAuthorize equivalent in TypeScript; no permission check
- owner_scoping: "N/A — UI shell; not data-scoped (renders user-identity and links, not data entities)"
- data_exposure:
  - "the resolved username (owner.name ?? identity.username, line 74) → every user who can reach the SPA; under DISABLED this is the literal 'admin' string visible to anonymous callers"
  - "the 9 tab labels → every user; reveals the existence of 9 named navigation surfaces including Management (admin surface)"
  - "the App-Info popup (via AppInfoMenu) → exposes the platform's GitHub URL, the ODD Platform version (from /api/info → AppInfoController), the operator-curated app-links (from /api/info/links → LinksController), and the Slack / Documentation / Feedback external URLs"
  - "the language switcher options → exposes the 6 supported locales (en/es/ch/fr/ua/hy) and the user's currently-selected locale (informational; not sensitive)"
- known_security_gaps:
  - "under auth.type=DISABLED, the toolbar renders 'admin' as the username to every anonymous network caller — the UI symptom of REFACTOR-185; an anonymous attacker reaching the SPA sees themselves rendered as 'admin' with every permission unlocked by WithPermissionsProvider. The toolbar surfaces no warning or banner indicating the unauthenticated mode" — evidence: AppToolbar.tsx:74 + IdentityController.java:30-33 + DisabledAuthSecurityConfiguration.java:11-19 — severity: HIGH
  - "the Management tab is visible to every authenticated user (including unauthenticated DISABLED-mode users) regardless of role/permission — reveals the existence of an admin surface. Backend controllers gate actual administrative actions, but the tab presence is reconnaissance information" — evidence: ToolbarTabs.tsx:60-64 — severity: LOW
  - "clicking Logout under DISABLED yields a 404 (no /logout handler) — UX-confusing; not a security issue per se but undermines the user's mental model of the auth state" — evidence: AppToolbar.tsx:35-37; DisabledAuthSecurityConfiguration.java:11-19 — severity: LOW

## performance

- hot_paths:
  - "every page render passes through AppToolbar (single mounted instance above all Routes) — the toolbar's re-render cost is paid on every redux state change that touches profile.slice or any selector dependency"
- throughput_characteristics:
  - "single-instance; no batch operations; pure-render component"
- resource_allocation:
  - "memoization absent — `tabs` array in ToolbarTabs IS useMemo'd (line 34) but the AppToolbar component itself does not React.memo; every parent re-render re-renders the toolbar"
  - "useScrollTrigger registers a scroll event listener on window (line 43) — single listener, removed on unmount; negligible CPU cost"
- scaling_characteristics:
  - "stateless component; scales horizontally with the SPA (one toolbar per browser tab)"
- known_performance_gaps:
  - "no React.memo on AppToolbar — every App re-render (e.g. on every route change) re-renders the toolbar; given the toolbar's subtree includes ToolbarTabs (which itself runs a 9-tab useMemo + a useEffect on every pathname change), this is non-trivial work per nav. Negligible at human-scale interaction rates but observable in profiler" — evidence: AppToolbar.tsx:18 (no memo) — severity: LOW

## upstream_callers

- entry_point: "ui_route:* (all routes — toolbar is rendered above the Routes block)"
  caller_node: "ts react-component:App.tsx (line 56 — `<AppToolbar />`)"
  multiplicity_per_trigger: 1  # single instance, single render per route mount
  evidence: "App.tsx:53-93 — AppToolbar is unconditionally rendered above the Routes block; mounted once per SPA lifecycle"
  observation_class: ui-call

## downstream_side_effects

- side_effect_class: page-render
  description: "Renders the application toolbar (brand + 9 tabs + info-icon + user-cluster) above every route"
  evidence: "AppToolbar.tsx:50-120"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:* (all routes)"
- side_effect_class: redirect-issue
  description: "On Logout click, full-page browser navigation to /logout (handleLogout)"
  evidence: "AppToolbar.tsx:35-37"
  cardinality_per_call: "0..1 per user-click (conditional on user clicking the Logout menu item)"
  reachable_from_entry_points:
    - "ui_route:* (any user route — the logout button is in the toolbar which is on every page)"
- side_effect_class: external-call
  description: "(via AppInfoMenu sub-component) GET /api/info (useAppInfo), GET /api/info/links (useAppLinks) — fetched on AppInfoMenu mount"
  evidence: "AppInfoMenu.tsx:17-18 (useAppInfo + useAppLinks hooks)"
  cardinality_per_call: "1 each per toolbar mount (caching depends on the hook implementation — react-query / SWR conventions assumed)"
  reachable_from_entry_points:
    - "ui_route:* (toolbar mounts on every route)"
- side_effect_class: cache-mutate
  description: "(via SelectLanguage sub-component) localStorage.setItem('i18nextLng', lang) on language change"
  evidence: "SelectLanguage.tsx:30"
  cardinality_per_call: "0..1 per user-click on a language option in the language dialog"
  reachable_from_entry_points:
    - "ui_route:* (language switcher is in the toolbar)"
- side_effect_class: page-render
  description: "i18n.changeLanguage(lang) triggers re-render of the entire SPA with new translation strings"
  evidence: "SelectLanguage.tsx:29"
  cardinality_per_call: "0..1 per user-click on a language option"
  reachable_from_entry_points:
    - "ui_route:* (language switcher is in the toolbar)"

## sources

- understanding ← AppToolbar.tsx:1-123 + App.tsx:56 + ToolbarTabs.tsx:34-82 + IdentityController.java:30-33 + DisabledAuthSecurityConfiguration.java:11-19
- concepts.entities.* ← AppToolbar.tsx:1-123, ToolbarTabs.tsx:25-138, AppInfoMenu.tsx:16-127, SelectLanguage.tsx:18-79, AppToolbarStyles.ts:6-88, profile.selectors.ts:10-15
- concepts.operations.* ← AppToolbar.tsx:27-48
- concepts.invariants.* ← AppToolbar.tsx:18, 35-37, 40-46, 74; profile.slice.ts:7-12; ToolbarTabs.tsx:34-82
- dependencies_semantic.requires-feature.* ← IdentityController.java:30-33; FeatureController code (cross-ref sidecar); AppInfoMenu.tsx:17-18; LoginFormSecurityConfiguration.java:59
- dependencies_semantic.requires-config.* ← application.yml:34; IdentityController.java:27 (DISABLED-mode dummyOwner branch)
- dependencies_semantic.requires-runtime.* ← profile.slice.ts:7-12, 14-32; locales/i18n.ts:27-31; AppToolbarStyles.ts:7, 17, 37; AppToolbar.tsx:43, 55; i18n.ts:22; SelectLanguage.tsx:30
- tests_coverage_semantic.* ← (no test files exist; grep'd `*AppToolbar*.test.*`, `*ToolbarTabs*.test.*` — no matches)
- docs_link_semantic.inferred_docs[0] ← WebFetch https://docs.opendatadiscovery.org/active-platform-features/ui-overview (2026-05-26, status 404)
- docs_link_semantic.inferred_docs[1] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform (2026-05-26, status 200; passing reference to App Info menu)
- docs_link_semantic.inferred_docs[2] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication (2026-05-26, status 200; no toolbar/logout/user mention)
- implicit_adrs.[0] ← AppToolbar.tsx:74 (owner?.name ?? identity?.username)
- implicit_adrs.[1] ← AppToolbar.tsx:35-37 (window.location.href = '/logout')
- implicit_adrs.[2] ← AppToolbar.tsx:40-44 (useScrollTrigger config)
- bugs_limitations_corner_cases.[0] ← ToolbarTabs.tsx:34-82 + App.tsx:49 + Message.tsx:59
- bugs_limitations_corner_cases.[1] ← ToolbarTabs.tsx:60-64
- bugs_limitations_corner_cases.[2] ← AppToolbar.tsx:74 + IdentityController.java:30-33 + DisabledAuthSecurityConfiguration.java:11-19 + application.yml:34
- bugs_limitations_corner_cases.[3] ← AppToolbar.tsx:35-37 + DisabledAuthSecurityConfiguration.java:11-19 + LoginFormSecurityConfiguration.java:59 + LDAPSecurityConfiguration.java:146
- bugs_limitations_corner_cases.[4] ← AppToolbar.tsx:74 + App.tsx:46-51 + profile.slice.ts:7-12
- bugs_limitations_corner_cases.[5] ← AppToolbar.tsx:20-21 + App.tsx:48 + profile.selectors.ts:40
- bugs_limitations_corner_cases.[6] ← i18n.ts:30 + SelectLanguage.tsx:48-66
- bugs_limitations_corner_cases.[7] ← i18n.ts:20-25 + SelectLanguage.tsx:28-33
- bugs_limitations_corner_cases.[8] ← AppToolbar.tsx:40-44
- security.auth_mode_relevance ← AppToolbar.tsx:74 + IdentityController.java:30-33 + DisabledAuthSecurityConfiguration.java + LoginFormSecurityConfiguration.java + OAuthSecurityConfiguration.java + LDAPSecurityConfiguration.java
- security.data_exposure.* ← AppToolbar.tsx:74; ToolbarTabs.tsx:34-82; AppInfoMenu.tsx:71-122; SelectLanguage.tsx:48-66
- security.known_security_gaps.[0] ← AppToolbar.tsx:74 + IdentityController.java:30-33 + DisabledAuthSecurityConfiguration.java:11-19
- security.known_security_gaps.[1] ← ToolbarTabs.tsx:60-64
- security.known_security_gaps.[2] ← AppToolbar.tsx:35-37 + DisabledAuthSecurityConfiguration.java:11-19
- performance.hot_paths.[0] ← AppToolbar.tsx:18 + App.tsx:56
- performance.known_performance_gaps.[0] ← AppToolbar.tsx:18 (no React.memo)
- upstream_callers.[0] ← App.tsx:56
- downstream_side_effects.[0] ← AppToolbar.tsx:50-120
- downstream_side_effects.[1] ← AppToolbar.tsx:35-37
- downstream_side_effects.[2] ← AppInfoMenu.tsx:17-18
- downstream_side_effects.[3] ← SelectLanguage.tsx:30
- downstream_side_effects.[4] ← SelectLanguage.tsx:29
- stress_findings.* ← AppToolbar.tsx + ToolbarTabs.tsx + SelectLanguage.tsx + IdentityController.java + DisabledAuthSecurityConfiguration.java as cited per finding

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH  # absence of tests is verifiable
- docs_link_semantic: HIGH  # WebFetch results recorded with timestamps
- implicit_adrs: MEDIUM  # the three captured decisions have intent-anchors but the intent is inferred from code shape, not explicit comments
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: MEDIUM  # gaps are observable but not load-tested
- upstream_callers: HIGH
- downstream_side_effects: HIGH
- stress_findings: HIGH  # 14 of 17 questions are STATIC-INFERRED with strong evidence; 3 PROBE-NEEDED but the answers are derivable from static analysis and merely END-TO-END-CONFIRMED by P-174

## Maintainer notes

(Reserved for hand-curated notes that survive future enrichment passes.)

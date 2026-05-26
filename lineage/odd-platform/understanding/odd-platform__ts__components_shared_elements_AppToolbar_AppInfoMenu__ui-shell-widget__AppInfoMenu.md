---
node_id: "odd-platform ts components/shared/elements/AppToolbar/AppInfoMenu ui-shell-widget:AppInfoMenu"
node_kind: ui-shell-widget
axis: ui_components
extracted_at_commit: feature/ontology-finalize-2026-05-25
enriched_at_commit: feature/ontology-finalize-2026-05-25
extractor_version: 0.1.0
prompt_version: file-analyser/0.5.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-26-ZJ-AppInfoMenu
---

# AppInfoMenu — semantic understanding

## understanding

`AppInfoMenu` is the 127-line React widget rendered inside `AppToolbar` (the top
bar present on every authenticated page of the ODD Platform SPA) that shows the
"information icon" popup combining FIVE surfaces in one MUI Menu: (1) a hardcoded
Documentation link to `docs.opendatadiscovery.org`, (2) a hardcoded Slack
community invite, (3) the deployment's project version with a GitHub repo link
sourced from `GET /api/appInfo`, (4) a hardcoded "Leave a feedback" Product Hunt
review link, and (5) the operator-configured "additional links" catalogue
fetched from `GET /api/links`. It is the UI's terminal page-render site for two
distinct backend surfaces — `AppInfoController` (F-009 deployment introspection)
and `LinksController` (F-035 operator-configured additional links) — both of
which are pulled here via the React-Query hooks `useAppInfo()` and `useAppLinks()`
(`AppInfoMenu.tsx:17-18`). The menu opens on `onMouseEnter` of the icon button
(line 81) — pure-hover activation, no click handler and no keyboard handler.
Every external link rendered by the widget uses `<Link target='_blank'>` from
react-router-dom WITHOUT `rel='noopener noreferrer'`, including the four
hardcoded links AND the N operator-configured entries; this is the reverse-
tabnabbing surface flagged in F-035's `observed_vs_expected.facets[0]`.

## concepts

- entities: [
    "`AppInfo` (DTO consumed from useAppInfo — only `projectVersion: string` is read at line 38, 47)",
    "`Link` (DTO consumed from useAppLinks — each entry's `title: string` and `url: string` are rendered as a menu item at lines 60-66)",
    "`AppMenu` (the wrapper component — MUI Menu under the hood — that hosts the link list as a popover)"
  ]
- operations: [
    "render-doc-link (hardcoded gitbookLink at line 20 → menu item line 95-102)",
    "render-slack-link (hardcoded slackLink at line 21 → menu item line 103-110)",
    "render-project-version (memoised at line 37-53; renders only when appInfo.projectVersion is truthy)",
    "render-feedback-link (hardcoded reviewLink at line 23 → menu item line 112-119)",
    "render-operator-links (memoised at line 55-69; map over useAppLinks data → one menu item per entry)",
    "open-menu-on-hover (handleAppMenuOpen at line 29-31 — onMouseEnter trigger)",
    "close-menu-on-mouse-leave (handleAppMenuClose at line 33-35 — invoked via PaperProps.onMouseLeave at line 85)"
  ]
- invariants: [
    "menu activates on mouse hover only — `onMouseEnter` at line 81, no `onClick`, no `onKeyDown`",
    "menu uses MUI's `keepMounted` (line 90) — the DOM tree stays mounted forever after first hover",
    "every external link uses `target='_blank'` (lines 41, 61, 95, 103, 112) AND none set `rel='noopener noreferrer'`",
    "projectVersion is rendered ONLY when appInfo?.projectVersion is truthy (line 38) — empty string / missing key suppresses the entire GitHub link row",
    "operator-configured links use `link.url` as React key (line 61) — duplicate URLs trigger a React duplicate-key warning",
    "the AppInfoMenu has NO loading state, NO error state, NO retry handler — useAppInfo / useAppLinks errors surface as silent absence"
  ]
- audiences: [
    "end-user — sees the version label, the docs/slack/github/feedback shortcuts, and any operator-configured links",
    "operator — indirectly: their `odd.links` config items appear here; their `auth.type=DISABLED` choice makes the entire menu reachable anonymously (paired with AppInfoController's DISABLED behaviour)"
  ]

## dependencies_semantic

- requires-feature: [
    "`useAppInfo()` hook (`lib/hooks/api/appInfo.ts:4-9`) — calls `appInfoApi.getAppInfo()` via TanStack Query under key `['appInfo']`",
    "`useAppLinks()` hook (`lib/hooks/api/appInfo.ts:11-17`) — calls `linksApi.getLinks()` via TanStack Query under key `['appLinks']`, with `select: data => data.items`",
    "`react-router-dom` Link component — used with absolute URLs and target='_blank' (react-router-dom v6 renders these as plain <a> elements; the `to` prop accepts string URLs)",
    "`AppMenu` wrapper (`components/shared/elements/AppMenu/AppMenu.tsx`) — MUI Menu under the hood, supports `keepMounted`, `anchorEl`, `transformOrigin`"
  ]
- requires-config: [
    "no client-side env vars consumed directly",
    "indirectly: `auth.type` (controls whether `/api/appInfo` and `/api/links` are reachable pre-auth)",
    "indirectly: `odd.links[].title` / `odd.links[].url` (operator config that determines what additional links appear)"
  ]
- requires-runtime: [
    "browser DOM — hover events, the MUI portal infrastructure",
    "TanStack Query client wrapped at the SPA root (provides cache for useAppInfo / useAppLinks)",
    "react-router-dom Router context (Link will error outside a Router)"
  ]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "AppInfoMenu hover opens the menu and shows the Documentation / Slack / Feedback hardcoded links"
    test_class: integration
    criticality: LOW
    note: "Smoke test — would catch import-breakage or styling regressions on the static menu items."
  - behaviour: "appInfo.projectVersion is rendered between two Typography elements; the GitHub anchor links to opendatadiscovery/odd-platform"
    test_class: integration
    criticality: LOW
    note: "Pairs with the AppInfoController contract test that doesn't exist yet."
  - behaviour: "operator-configured links from useAppLinks are rendered as menu items in the order returned by the API"
    test_class: integration
    criticality: MEDIUM
    note: "Pairs with P-128 backend ordering assertion."
  - behaviour: "every <a> rendered by AppInfoMenu (hardcoded + operator) has rel='noopener noreferrer' on target='_blank'"
    test_class: security
    criticality: MEDIUM
    note: "Captured in P-173; would catch the tabnabbing surface from regressing further OR — once fixed — would catch a regression that removes the rel attribute."
  - behaviour: "operator-configured link.url that is a `javascript:` URL renders an <a> with sanitised href (React 17+ strips javascript: from href)"
    test_class: security
    criticality: MEDIUM
    note: "Captured in P-173; defensive belt-and-braces — the URL sanitiser is React's, but a future react-dom upgrade or replacement could regress this."
  - behaviour: "operator-configured link.url that is `data:text/html,...` renders an <a> that is NOT executable in modern Chromium"
    test_class: security
    criticality: LOW
    note: "Modern Chrome refuses top-level data: navigation since 2018; the browser is the defence, not the app. Still worth a defensive assertion."
  - behaviour: "AppInfoMenu icon is keyboard-reachable AND opens the menu on Enter/Space"
    test_class: integration
    criticality: MEDIUM
    note: "ARIA attributes (aria-haspopup, aria-controls) suggest keyboard accessibility was INTENDED, but only onMouseEnter is wired — keyboard users cannot open the menu."
  - behaviour: "When auth.type=DISABLED, an anonymous viewer of the SPA root URL sees the projectVersion in the toolbar's About menu"
    test_class: security
    criticality: MEDIUM
    note: "Paired with AppInfoController's REFACTOR-185 19th-sidecar finding; the UI surface CONFIRMS the version leak by displaying it inline. Captured in P-173."
- test_files: []
- gaps: |
    No tests exist for AppInfoMenu — grep across `<odd-platform-ui-repo>/src/**/*.test.{ts,tsx}` and `<odd-platform-ui-repo>/cypress/**` returns no hits for "AppInfoMenu" or "useAppLinks" or "useAppInfo" (commit feature/ontology-finalize-2026-05-25). The widest-leverage gap is security: a Playwright probe (P-173) asserting (a) rel='noopener noreferrer' is present on all four hardcoded links AND on all operator-configured links, (b) `javascript:` URLs are sanitised by React's url filter, (c) keyboard activation works, (d) anonymous-DISABLED renders the version. These four together pin every facet of F-035 + the AppInfoController/AppInfoMenu coupling that has been the subject of the F-009 / F-035 invariant work.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform"
    anchor: null
    rationale: "The live page documents the operator-configured `odd.links` surface AND explicitly names the App Info menu — 'The platform UI surfaces them inside the App Info menu (the popup behind the information icon in the top-right toolbar)'. This is the canonical operator-facing doc for the LinksController side of the surface. There is NO doc page for the AppInfoController side (project-version display) — paired AppInfoController sidecar already records that gap."
    last_verified_at: "2026-05-26T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      "Operators can attach a list of arbitrary navigation links — pointers to internal wikis, runbooks, dashboards, or any other page teams should reach from inside ODD Platform."
      "The platform UI surfaces them inside the App Info menu (the popup behind the information icon in the top-right toolbar)."
      "Each link renders as a menu item showing its title and opens the configured URL in a new tab when clicked."
      "The links are exposed to the UI through the authenticated `GET /api/links` endpoint and are visible to every user signed in to the platform. Use them for navigation hints only — do not embed credentials, session tokens, or one-time secrets in link URLs, since any logged-in user can read them."
- doc_drift_findings:
  - "Doc says links 'open in a new tab' (matches `target='_blank'` at AppInfoMenu.tsx:61) but does NOT warn that the absence of `rel='noopener noreferrer'` (lines 41, 61, 95, 103, 112) creates a reverse-tabnabbing vector — any operator-configured URL can use `window.opener` to navigate the parent ODD Platform tab to a phishing page. Doc treats target='_blank' as a feature; the rel-missing gap is silent."
  - "Doc warns operators 'do not embed credentials...in link URLs' but does NOT warn about URL scheme validation. An operator (or compromised config source) supplying `javascript:` or `data:text/html` URLs is unaddressed by the doc. React 17+ strips `javascript:` from `<a href>` at runtime; `data:` URIs pass through; the doc places no responsibility on the operator to use http(s)-only URLs."
  - "Doc does NOT mention that the menu is HOVER-ONLY — users on touch devices (tablets, phones) cannot open the menu. The doc treats the menu's reachability as obvious; ARIA attributes are present (aria-haspopup, aria-controls) but no keyboard handler is wired."
  - "Doc does NOT cover the project-version display — the operator viewing the doc page for `odd.links` would have no idea that the SAME menu also discloses the deployment's project version. No anchor or paragraph at the live page mentions versioning, fingerprinting, or anonymous-mode behaviour."
  - "Doc does NOT mention that the menu's `keepMounted` (MUI prop at AppInfoMenu.tsx:90) keeps the menu DOM mounted after first hover — combined with TanStack Query's default staleTime=0 + React Query's cache, the FIRST mount populates the link list and subsequent operator edits remain invisible to that session until full reload (paired with the boot-time @ConfigurationProperties immutability already documented in LinksController.md)."

## implicit_adrs

- "The App Info menu is the SINGLE chrome surface for deployment-meta + operator-configured + community shortcuts — Documentation, Slack, GitHub-by-version, Feedback, and `odd.links` all live in the SAME widget rather than being split across the toolbar." — evidence: AppInfoMenu.tsx:71-122 (the single AppMenu containing all five surfaces in fixed vertical order) + AppToolbar.tsx:67 (the only mount site) — intent_anchor: "The widget composes all secondary navigation in ONE popover; the AppToolbar separately handles language + logout in the user-account popover. The split is deliberate: app-info popover for OUTBOUND links, account popover for INBOUND identity actions." — confidence: MEDIUM
- "External links use react-router-dom's `Link` (not raw `<a>`) — relying on react-router's behaviour to render the absolute URL as a plain `<a>` when `to` is a string AND `target` is set. This is the platform's universal pattern for any in-component anchor, hardcoded or dynamic." — evidence: AppInfoMenu.tsx:41,61,95,103,112 (every link uses `<Link to={...} target='_blank'>`) + a codebase-wide grep shows only ONE file (`LinkAttachment.tsx:25`) uses raw `<a>` and that's the only one that also sets `rel='noreferrer'` — intent_anchor: "the project's anchor primitive IS react-router-dom's Link; this is consistent across the SPA and visible across many components." — confidence: MEDIUM
- "The project version is rendered conditionally on `appInfo?.projectVersion` truthiness (line 38) — if BuildProperties is missing at boot or auth.type is empty / unauthenticated paths return no data, the entire GitHub-link row is suppressed rather than rendering an empty / 'Unknown' label. The widget chooses 'don't render' over 'render a placeholder'." — evidence: AppInfoMenu.tsx:37-53 (the `if (!appInfo?.projectVersion) return null;` early-return + the useMemo dependency on `[appInfo?.projectVersion]`) — intent_anchor: "the early-return + null memoisation is an explicit decision; an empty string would have been the default if the author had not guarded against it." — confidence: HIGH

## bugs_limitations_corner_cases

- "ALL FIVE link sites in this widget use `<Link target='_blank'>` WITHOUT `rel='noopener noreferrer'` — including the hardcoded gitbook (line 95), slack (line 103), github (line 41), feedback (line 112) AND every operator-configured link (line 61). This is broader than the F-035 facet records (which only enumerates the operator-configured surface): the four hardcoded targets are first-party but the JavaScript context still leaks `window.opener` to docs.opendatadiscovery.org, go.opendatadiscovery.org, github.com, and producthunt.com. The third-party targets (github, producthunt) are TRUSTED today but a future XSS on those domains would have lateral movement into the ODD Platform tab via window.opener.navigate." — evidence: AppInfoMenu.tsx:41 (github link), :61 (operator link), :95 (gitbook), :103 (slack), :112 (feedback) — severity: MEDIUM
- "Menu opens on `onMouseEnter` only (line 81) — touch-device users (iOS Safari, Android Chrome on phone/tablet) generate NO mouseenter on the icon button; the menu is unreachable. The ARIA attributes (`aria-haspopup='true'` at line 80, `aria-controls={menuId}` at line 79) indicate the AUTHOR expected the menu to be activatable by AT users / keyboard users, but no `onClick`, `onKeyDown`, or `onFocus` handler is wired. This is a WCAG 2.1 SC 2.1.1 (Keyboard) violation in addition to a mobile-UX gap." — evidence: AppInfoMenu.tsx:78-82 (button declaration with only onMouseEnter) — severity: MEDIUM
- "Menu uses MUI's `keepMounted` (line 90) — the menu's DOM tree (including the operator-link list) stays mounted for the lifetime of the SPA after the FIRST hover. Combined with the absence of useAppInfo / useAppLinks refetch triggers, an operator who edits `odd.links` in YAML and restarts the backend will STILL see the OLD list in any SPA tab opened before the restart, until the user does a full page reload. The widget makes the LinksController's @ConfigurationProperties boot-time-only immutability harder to spot operator-side." — evidence: AppInfoMenu.tsx:90 (`keepMounted`) + lib/hooks/api/appInfo.ts:11-17 (no staleTime / refetchInterval) — severity: LOW
- "The widget renders projectVersion to anonymous viewers when `auth.type=DISABLED`. Under DISABLED, the SPA loads without authentication; AppInfoMenu fires `useAppInfo` against `/api/appInfo` which is permitAll-reachable; the response includes `projectVersion`; the menu renders `<Typography variant='h4'>{appInfo.projectVersion}</Typography>` at line 47. A network attacker hitting the SPA root URL anonymously gets the precise version disclosed in the rendered HTML via the App Info menu. (The version is ALSO disclosed by `/api/appInfo` directly — the UI is the convenient amplifier, not the only exposure.)" — evidence: AppInfoMenu.tsx:37-53 + AppInfoController.java:24-28 (paired sidecar) + DisabledAuthSecurityConfiguration.java:13-18 (anyExchange permitAll) — severity: MEDIUM
- "`link.url` is used as React key (line 61). If the operator configures two `odd.links` entries with the same URL but different titles (e.g. one labelled 'Runbook' and one labelled 'Runbook (old)', both pointing to the same wiki page), React emits a duplicate-key warning and may de-duplicate the render in some reconciliation paths. A better key would be the index (`{(link, idx) => ...key={idx}...}`) or a synthetic id stamped at the backend." — evidence: AppInfoMenu.tsx:55-69 — severity: LOW
- "Hardcoded `gitbookLink`, `slackLink`, `githubLink`, `reviewLink` (lines 20-23) are NOT translatable; the menu labels 'Documentation', 'Slack', 'ODD Platform version', 'Leave a feedback' (lines 48, 100, 108, 117) hardcode English and bypass the `useTranslation()` infrastructure already present in `AppToolbar.tsx:19`. This is a localisation gap for the four hardcoded surfaces; operator-configured `link.title` values DO render verbatim, allowing operators to localise their own additions." — evidence: AppInfoMenu.tsx:20-23, :48, :100, :108, :117 (no `t(...)` call) — severity: LOW
- "The widget has NO loading or error UI for the two queries it fires. If `/api/appInfo` returns 401 or 5xx, `appInfo` is `undefined`, the `projectVersion` row silently suppresses; if `/api/links` errors the same. The user sees a menu with no version + no additional links and no indication WHY — the menu just appears reduced. Useful for a clean UI; bad for diagnosis (operator opens the menu, sees no version, suspects a build issue when the cause was network)." — evidence: AppInfoMenu.tsx:17-18 (no error / loading destructure from useQuery) — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables: []
  name_behavior_pairs:
    - name: "AppInfoMenu (the widget itself; React component name)"
      promise: "Display app-level information — version, deployment metadata, support links, operator-configured shortcuts."
      implementation: "Renders five distinct surfaces composed in fixed order: Documentation (hardcoded), Slack (hardcoded), Project Version + GitHub link (from /api/appInfo), Leave Feedback (hardcoded), Operator-Configured Links (from /api/links). The name accurately covers four of the five — the operator-configured link list is more of a 'navigation extension point' than 'app info', but the live doc page calls this surface 'the App Info menu' so the labelling is consistent with operator-facing vocabulary."
      drift: NONE
      operator_visible_consequence: "N/A"
      confidence: STATIC-INFERRED
      evidence: "AppInfoMenu.tsx:71-122 + live doc https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform (2026-05-26)"
    - name: "useAppLinks (the hook the widget calls)"
      promise: "Return the list of operator-configured additional links."
      implementation: "Hook calls linksApi.getLinks() and selects `data => data.items`; the backend (LinksController.java:31-33) maps record-Link list to API Link list. Promise and implementation match."
      drift: NONE
      operator_visible_consequence: "N/A"
      confidence: STATIC-INFERRED
      evidence: "lib/hooks/api/appInfo.ts:11-17 + LinksController.java:25-36"
  orderings:
    - location: "AppInfoMenu.tsx:60-66 (the operator-link map)"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer?"
          a: "No re-sort at the UI layer. The widget renders `links.map(...)` in the order returned by useAppLinks → linksApi.getLinks() → LinksController which streams `linkProperties.links()` without sort. Effective order: YAML / env declaration order (per Spring's @ConfigurationProperties binder). Captured in P-128 + P-173."
          confidence: STATIC-INFERRED
          evidence: "AppInfoMenu.tsx:60-66 + LinksController.java:31-33 + lineage/odd-platform/probes/P-128.yaml"
        - q: "What is the tie-breaker when sort-key values are equal?"
          a: "N/A — no sort key; insertion order is the only order. React's reconciliation key is `link.url` (line 61), which causes a duplicate-key warning when two entries share a URL but no implicit re-ordering."
          confidence: STATIC-INFERRED
          evidence: "AppInfoMenu.tsx:61"
        - q: "Which subset is returned when result-set > page size?"
          a: "N/A — no pagination at the widget or in the API; the full list is rendered. The hardcoded surfaces (Doc, Slack, Version, Feedback) plus N operator-configured links all render in a single menu. Pathological config (1000+ entries) would degrade the menu's vertical scroll."
          confidence: STATIC-INFERRED
          evidence: "AppInfoMenu.tsx:55-69 + LinksController.java:31-33"
        - q: "Does any upstream layer re-sort or filter the result?"
          a: "No. The widget consumes `useAppLinks` directly without further filtering."
          confidence: STATIC-INFERRED
          evidence: "AppInfoMenu.tsx:18, 55-69"
  auth_gates:
    - location: "AppInfoMenu.tsx:17-18 (the hook calls)"
      endpoint: "render-time consumer of GET /api/appInfo + GET /api/links"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "DISABLED → both /api/appInfo (permitAll) and /api/links (permitAll under DISABLED's anyExchange.permitAll) return 200; the widget renders the version AND any configured links to anonymous viewers. LOGIN_FORM / OAUTH2 / LDAP → both endpoints require authentication (default authenticated() rule); pre-auth the widget shows a menu without version + without operator links. Verified by tracing to LinksController (REFERENCE) and AppInfoController (REFERENCE)."
          confidence: REFERENCE
          evidence: "odd-platform java LinksController controller-class:LinksController + odd-platform java AppInfoController controller-class:AppInfoController"
        - q: "What does an unauthenticated caller see?"
          a: "Under DISABLED: full menu including version + operator links. Under LOGIN_FORM/OAUTH2/LDAP: typically the SPA itself requires auth before mounting AppToolbar (LOGIN_FORM redirects to /login; OAUTH2/LDAP same). HOWEVER, if AppToolbar renders before the auth wall (e.g. on the login form itself), the menu would show with the doc/slack/feedback links but no version + no operator links."
          confidence: STATIC-INFERRED
          evidence: "DisabledAuthSecurityConfiguration.java:13-18 + LoginFormSecurityConfiguration.java:49-57 + AppToolbar.tsx (paired sidecar) + AppInfoMenu.tsx:37-53 (early-return on no projectVersion)"
        - q: "What does a wrong-role caller see?"
          a: "Same as a correctly-roled caller. AppInfoMenu has NO per-role rendering — every authenticated user sees the same menu. The LinksController endpoint does no role filtering (confirmed in paired sidecar); the AppInfoController endpoint discloses only deployment-level metadata."
          confidence: STATIC-INFERRED
          evidence: "AppInfoMenu.tsx:71-122 (no role check) + LinksController sidecar"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "The UI gate is none — the widget renders whatever the API returns. The backend gates live at LinksController + AppInfoController (REFERENCE both)."
          confidence: REFERENCE
          evidence: "odd-platform java LinksController controller-class:LinksController + odd-platform java AppInfoController controller-class:AppInfoController"
  resource_boundaries:
    - location: "AppInfoMenu.tsx:90 (keepMounted) + 37-53 (useMemo) + 55-69 (useMemo)"
      kind: cache
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "No — the widget is mounted in a single React tree per SPA tab; no shared mutable state outside React's render tree. The two useMemo blocks are pure functions of their dependencies."
          confidence: STATIC-INFERRED
          evidence: "AppInfoMenu.tsx:37-69 (pure useMemo) + AppInfoMenu.tsx:26 (per-component anchorEl state)"
        - q: "Is the call replay-safe?"
          a: "Yes — opening and closing the menu is idempotent. Hovering twice in a row dispatches the same anchorEl state. No side effects fire on open/close beyond setting React state."
          confidence: STATIC-INFERRED
          evidence: "AppInfoMenu.tsx:29-35 (handleAppMenuOpen / handleAppMenuClose are pure setState)"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "TanStack Query default config: staleTime=0 (refetch on every mount), gcTime=5min (cache lives in memory 5 minutes after last subscriber unmounts). Combined with the widget's `keepMounted` (line 90), AppInfoMenu STAYS subscribed for the SPA's lifetime — so the cache is effectively kept hot. The widget never re-fires after first mount unless the React-Query cache invalidates (which it does NOT do here — no invalidateQueries call references 'appInfo' or 'appLinks' anywhere in the codebase per a grep against odd-platform-ui). Operator-visible: link edits in YAML are invisible until the user does a full page reload."
          confidence: STATIC-INFERRED
          evidence: "lib/hooks/api/appInfo.ts:4-17 (no staleTime / no refetchInterval) + AppInfoMenu.tsx:90 (keepMounted)"
  request_inputs:
    - location: "AppInfoMenu.tsx:60-66 (the operator-link rendering loop)"
      input_kind: body-field
      input_name: "link.url (from useAppLinks data)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "An ABSOLUTE URL the operator wants surfaced as a clickable menu item. The live doc says 'opening in a new tab' and 'absolute URL' — the operator's expectation is http(s)://hostname/path."
          confidence: STATIC-INFERRED
          evidence: "AppInfoMenu.tsx:61 + WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform 2026-05-26"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "The widget uses `link.url` as (a) the React reconciliation key, (b) the `to` prop of react-router-dom's Link, which renders as the `href` attribute of an `<a>` element on an absolute URL. The chain end-to-end: AdditionalLinkProperties.Link.url (config-record string) → LinksController stream-map (passthrough) → JSON wire (LinkList.items[].url) → useAppLinks data (TanStack Query cache) → Link.to (react-router-dom) → DOM <a href>."
          confidence: STATIC-INFERRED
          evidence: "AdditionalLinkProperties.java:8 + LinksController.java:31-33 + lib/hooks/api/appInfo.ts:11-17 + AppInfoMenu.tsx:61"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY — the name promises 'absolute URL' but the chain accepts ANY string. React 17+'s sanitiser will strip `javascript:` from <a href> at render time, but `data:text/html` URIs pass through; arbitrary strings pass through. The defence relies on the operator's discipline AND a runtime sanitiser they cannot see in the code. Severity: bounded by operator-trust model — captured in F-035's facet `url_scheme_not_validated_javascript_data_uris_passthrough`."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "AdditionalLinkProperties.java:8 (no @URL, no @Pattern) + AppInfoMenu.tsx:61 (Link.to accepts the string verbatim)"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "(a) `javascript:alert(1)` → React strips, the link becomes a no-op; the operator sees a clickable title that does nothing. No visible warning at any layer. (b) `data:text/html,<script>...</script>` → href stays; modern Chrome/Firefox refuse top-level data: nav since 2018 but tab-blank may still leak. (c) `vbscript:msgbox(1)` → href stays; modern non-IE browsers refuse. (d) Garbage strings (e.g. `wiki-link`) → href stays; clicking the link relative-navigates within the SPA, producing a route-not-found page."
          confidence: STATIC-INFERRED
          evidence: "AppInfoMenu.tsx:61 + AdditionalLinkProperties.java:8 (no schema gate)"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE in the immediate scope — the API contract only exposes title + url. There is no underlying field like 'sanitised_url' or 'href' that would have honoured the 'absolute URL' promise. The fix anchor is to ADD an `@URL` / `@Pattern` constraint at AdditionalLinkProperties OR a renderUrl(url) helper at AppInfoMenu that allowlists http/https schemes."
          confidence: STATIC-INFERRED
          evidence: "AdditionalLinkProperties.java:6-9 + LinksController.java:31-33"
      routes_to_finding: "bugs_limitations_corner_cases.[0] (rel-noopener gap), docs_link_semantic.doc_drift_findings.[1] (URL-scheme silence), F-035.observed_vs_expected.facets[1] (already documented in feature flow)"
    - location: "AppInfoMenu.tsx:60-66 (the operator-link map)"
      input_kind: body-field
      input_name: "link.title (from useAppLinks data)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "A human-readable label for the link, displayed verbatim as the menu item's text."
          confidence: STATIC-INFERRED
          evidence: "AppInfoMenu.tsx:63 + WebFetch 2026-05-26 ('Each link renders as a menu item showing its title')"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Rendered inside a `<Typography variant='h4'>` (line 63). React's default JSX text rendering escapes HTML special characters — operator-supplied HTML in the title is shown as literal text, not interpreted."
          confidence: STATIC-INFERRED
          evidence: "AppInfoMenu.tsx:63 (`<Typography variant='h4'>{link.title}</Typography>`)"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — title renders as text; React's default escaping handles XSS in the title field. No drift."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "AppInfoMenu.tsx:63"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — no drift."
          confidence: STATIC-INFERRED
          evidence: "AppInfoMenu.tsx:63"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "N/A."
          confidence: STATIC-INFERRED
          evidence: "AppInfoMenu.tsx:63"
      routes_to_finding: "no drift — kept for audit trail completeness"
    - location: "AppInfoMenu.tsx:37-53 (the projectVersion rendering)"
      input_kind: body-field
      input_name: "appInfo.projectVersion (from useAppInfo data)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The deployed ODD Platform's version string (something like '1.7.3' or '0.1.0-SNAPSHOT'). Allows the user to verify which version they are looking at; useful for bug reports."
          confidence: STATIC-INFERRED
          evidence: "AppInfoMenu.tsx:47-48 (rendered alongside the literal label 'ODD Platform version')"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Rendered as `<Typography variant='h4'>{appInfo.projectVersion}</Typography>` (line 47) directly inside the menu, hyperlinked via the wrapping `<Link to={githubLink}>` to the github.com/opendatadiscovery/odd-platform repo. The backend chain (AppInfoController.java:24-28) sources the value from Spring Boot's BuildProperties bean (`buildProperties.getVersion()`)."
          confidence: STATIC-INFERRED
          evidence: "AppInfoMenu.tsx:47 + AppInfoController.java:26"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — the value is the project's build version. The drift class for this surface is the AUTH GATE / DISCLOSURE side (anyone under DISABLED reads it), NOT the input-name-vs-implementation alignment."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "AppInfoController.java:24-28 (build-info source) + AppInfoMenu.tsx:47 (rendering)"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — no drift."
          confidence: STATIC-INFERRED
          evidence: "N/A"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "N/A."
          confidence: STATIC-INFERRED
          evidence: "N/A"
      routes_to_finding: "bugs_limitations_corner_cases.[3] (DISABLED-mode anonymous version disclosure — the UI surface)"
  probes_emitted:
    - probe_id: P-173
      question: "UI-side probe: verify (a) tabnabbing-rel absence on all five link sites; (b) URL-scheme sanitisation behaviour for javascript: / data: / vbscript: under React's runtime sanitiser; (c) anonymous-DISABLED version disclosure in rendered DOM; (d) keyboard-activation inaccessibility (onMouseEnter only)."
      probe_path: "lineage/odd-platform/probes/P-173.yaml"
  stress_summary:
    triggers_total: 7
    questions_total: 25
    answers_static_inferred: 22
    answers_probe_needed: 0
    answers_reference: 3
    drift_flags: 1
```

## security

- auth_mode_relevance: [LOGIN_FORM, OAUTH2, LDAP, DISABLED (relevant — DISABLED enables anonymous version disclosure + anonymous operator-link disclosure via this widget)]
- ingestion_filter_relevance: "N/A — UI rendering surface, not an HTTP endpoint"
- authorization_assertions: []
- owner_scoping: "N/A — code is not data-scoped; the widget renders deployment-level + global operator-configured information identically for every viewer"
- data_exposure:
  - "Deployment project version → rendered inline in the menu to every viewer the widget renders for. Under LOGIN_FORM/OAUTH2/LDAP: any authenticated user. Under DISABLED: any anonymous viewer of the SPA root URL who hovers the information icon. This is the UI mirror of the AppInfoController DISABLED-mode disclosure finding (REFACTOR-185 19th sidecar)."
  - "Operator-configured `odd.links` list (title + url for each entry) → rendered as menu items to every viewer. Under LOGIN_FORM/OAUTH2/LDAP: any authenticated user. Under DISABLED: anyone hitting the SPA root URL. The operator may have configured internal-network URLs (wiki, runbook, Grafana); under DISABLED these URLs become discoverable through the rendered menu's <a href> attributes."
  - "window.opener handle (via `target='_blank'` without `rel='noopener noreferrer'`) → exposed to every external URL the widget links to: docs.opendatadiscovery.org, go.opendatadiscovery.org, github.com/opendatadiscovery/odd-platform, producthunt.com, AND each operator-configured URL. The opened page can use `window.opener.location = 'https://attacker'` to navigate the ODD Platform tab."
- known_security_gaps:
  - "ALL five external links use `target='_blank'` without `rel='noopener noreferrer'` — reverse tabnabbing vector from any rendered destination. Operator-configured URLs are the broadest attack surface (a less-trusted role with config-edit could weaponise); the four hardcoded targets (docs/slack/github/producthunt) are first-party-trusted but inherit the same window.opener leak as a defence-in-depth gap" — evidence: AppInfoMenu.tsx:41, 61, 95, 103, 112 — severity: MEDIUM
  - "Operator-configured link URLs are NOT scheme-validated; `javascript:`, `data:`, `vbscript:` schemes pass through the chain (AdditionalLinkProperties → LinksController → useAppLinks → AppInfoMenu Link.to). React 17+'s built-in sanitiser strips `javascript:` from <a href> at render time but does NOT block `data:`. The defence depends on the React runtime (an opaque defence to the operator) and the browser (modern Chromium blocks top-level data: nav). A future React major-version upgrade or migration off react-router-dom could remove the defence silently." — evidence: AdditionalLinkProperties.java:8 (no @URL/@Pattern) + AppInfoMenu.tsx:61 — severity: MEDIUM
  - "Under `auth.type=DISABLED`, an anonymous viewer hovering the SPA's information icon reads the deployment's project version inline (AppInfoMenu.tsx:47) AND every operator-configured URL (AppInfoMenu.tsx:60-66). The UI MULTIPLIES the disclosure surface that AppInfoController + LinksController already provide at the API layer — the version is no longer just visible via curl /api/appInfo, it is visible to any browser user." — evidence: AppInfoMenu.tsx:37-69 + DisabledAuthSecurityConfiguration.java:13-18 + REFACTOR-185 (19-sidecar cluster) — severity: MEDIUM
  - "Menu is keyboard-inaccessible (only `onMouseEnter`, no `onClick` / `onKeyDown`) — WCAG 2.1 SC 2.1.1 violation. The `aria-haspopup='true'` + `aria-controls` ARIA attributes claim keyboard support that does not exist. AT users (screen-readers + keyboard navigation) cannot reach the version display or operator-configured links." — evidence: AppInfoMenu.tsx:74-82 — severity: MEDIUM (accessibility class, not exploit class)

## performance

- hot_paths:
  - "Mounted in AppToolbar, which mounts on EVERY page of the SPA (AppToolbar.tsx:67). Hover-on-icon triggers anchorEl state change which re-renders the menu — cheap (one MUI portal update). useAppInfo + useAppLinks fire once per SPA mount with TanStack Query defaults" — evidence: AppInfoMenu.tsx:17-18 + AppToolbar.tsx:67
- throughput_characteristics:
  - "Two parallel HTTP requests (/api/appInfo + /api/links) on first mount; both are tiny (single-string + small-list payloads); both cheap server-side (no DB); both client-side cached for the SPA's lifetime" — evidence: AppInfoMenu.tsx:17-18 + lib/hooks/api/appInfo.ts:4-17
  - "MUI Menu uses a React portal — render cost is proportional to the number of children. With 4 hardcoded + N operator-configured links, the menu has 5+N DOM subtrees" — evidence: AppInfoMenu.tsx:84-122
- resource_allocation:
  - "Two useMemo blocks (projectVersion, projectLinks) — recompute only when their deps change. With React-Query's stable cache references, the deps rarely change after first fetch" — evidence: AppInfoMenu.tsx:37-69
  - "`keepMounted` (line 90) keeps the menu DOM in the tree for the SPA lifetime — minor memory cost; trade-off for instant subsequent open" — evidence: AppInfoMenu.tsx:90
- scaling_characteristics:
  - "Stateless React component — no client-side persistence beyond TanStack Query's per-tab cache. Horizontal scaling N/A (UI-only)" — evidence: AppInfoMenu.tsx:16-126
  - "No pagination — N operator-configured links all render in one menu. Pathological N (1000+) degrades the menu's vertical scroll AND the MUI Menu's positioning algorithm" — evidence: AppInfoMenu.tsx:55-69
- known_performance_gaps:
  - "TanStack Query staleTime not set on useAppInfo / useAppLinks — every component remount would trigger a refetch. AppInfoMenu's keepMounted (line 90) MITIGATES this (the widget doesn't unmount), but other components consuming useAppInfo (Overview.tsx) may pay the refetch cost. A staleTime: Infinity (or staleTime: 24h) would be correct given both endpoints are bound at backend boot." — evidence: lib/hooks/api/appInfo.ts:4-17 — severity: LOW

## upstream_callers

- entry_point: "ui_route:* (every authenticated page that mounts AppToolbar)"
  caller_node: "ts react-component:AppToolbar.tsx"
  multiplicity_per_trigger: 1
  evidence: "AppToolbar.tsx:67 (`<AppInfoMenu />`) — AppInfoMenu is unconditionally mounted in the toolbar's SectionDesktop. The toolbar itself mounts on every route except the login form (LoginFormSecurityConfiguration redirects unauthenticated traffic; AppToolbar is inside the post-auth shell)."
  observation_class: ui-call

## downstream_side_effects

- side_effect_class: external-call
  description: "Fires GET /api/appInfo on first widget mount (via useAppInfo → TanStack Query)"
  evidence: "AppInfoMenu.tsx:17 + lib/hooks/api/appInfo.ts:4-9"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:* (every page that mounts AppToolbar)"
- side_effect_class: external-call
  description: "Fires GET /api/links on first widget mount (via useAppLinks → TanStack Query)"
  evidence: "AppInfoMenu.tsx:18 + lib/hooks/api/appInfo.ts:11-17"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:* (every page that mounts AppToolbar)"
- side_effect_class: page-render
  description: "Renders the App Info menu DOM tree — 4 hardcoded items + 1 conditional version row + N operator-configured items. The DOM is `keepMounted` for the SPA's lifetime after first hover."
  evidence: "AppInfoMenu.tsx:71-122 + line 90 (keepMounted)"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:* (every page that mounts AppToolbar)"

## sources

- understanding ← AppInfoMenu.tsx:1-127 + AppToolbar.tsx:67 + lib/hooks/api/appInfo.ts:1-17 + LinksController sidecar + AppInfoController sidecar
- concepts.entities.AppInfo ← AppInfoMenu.tsx:17 + lib/hooks/api/appInfo.ts:4-9
- concepts.entities.Link ← AppInfoMenu.tsx:18, 60-66 + lib/hooks/api/appInfo.ts:11-17
- concepts.entities.AppMenu ← AppInfoMenu.tsx:11 + components/shared/elements/AppMenu/AppMenu.tsx:1-29
- concepts.operations ← AppInfoMenu.tsx:29-35 (handlers), 37-53 (projectVersion useMemo), 55-69 (projectLinks useMemo), 71-122 (render)
- concepts.invariants ← AppInfoMenu.tsx:81 (onMouseEnter only), :90 (keepMounted), :41-112 (no rel), :37-38 (truthiness gate), :61 (link.url as key)
- concepts.audiences ← AppInfoMenu.tsx:47-48 (version label to end-user) + LinksController sidecar (operator-config audience)
- dependencies_semantic.requires-feature ← AppInfoMenu.tsx:12 (hook import) + lib/hooks/api/appInfo.ts:1-17
- dependencies_semantic.requires-config ← AppInfoController sidecar (auth.type indirect) + AdditionalLinkProperties.java:6-9 (odd.links indirect)
- dependencies_semantic.requires-runtime ← AppInfoMenu.tsx:1-3 (React + MUI + react-router-dom imports)
- tests_coverage_semantic.test_files ← grep `AppInfoMenu|useAppLinks|useAppInfo` in `<odd-platform-ui-repo>/src/**/*.test.*` and `<odd-platform-ui-repo>/cypress/**` returns 0 hits (2026-05-26)
- docs_link_semantic.inferred_docs ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform 2026-05-26 (status 200)
- docs_link_semantic.doc_drift_findings.[0] ← AppInfoMenu.tsx:41,61,95,103,112 (no rel) + WebFetch (silent on rel)
- docs_link_semantic.doc_drift_findings.[1] ← AdditionalLinkProperties.java:8 + AppInfoMenu.tsx:61 + WebFetch (silent on URL scheme)
- docs_link_semantic.doc_drift_findings.[2] ← AppInfoMenu.tsx:78-82 (no keyboard handler) + WebFetch (silent on activation modality)
- docs_link_semantic.doc_drift_findings.[3] ← AppInfoMenu.tsx:37-53 (version render) + WebFetch (silent on version display)
- docs_link_semantic.doc_drift_findings.[4] ← AppInfoMenu.tsx:90 (keepMounted) + lib/hooks/api/appInfo.ts:11-17 (no staleTime) + WebFetch (silent on cache)
- implicit_adrs.[0] ← AppInfoMenu.tsx:71-122 + AppToolbar.tsx:67
- implicit_adrs.[1] ← AppInfoMenu.tsx:41,61,95,103,112 + grep result (only LinkAttachment.tsx uses raw <a> + sets rel)
- implicit_adrs.[2] ← AppInfoMenu.tsx:37-38, 38, 47, 53 (early-return + useMemo dep)
- bugs_limitations_corner_cases.[0] ← AppInfoMenu.tsx:41,61,95,103,112
- bugs_limitations_corner_cases.[1] ← AppInfoMenu.tsx:78-82
- bugs_limitations_corner_cases.[2] ← AppInfoMenu.tsx:90 + lib/hooks/api/appInfo.ts:11-17
- bugs_limitations_corner_cases.[3] ← AppInfoMenu.tsx:37-53 + AppInfoController sidecar + DisabledAuthSecurityConfiguration.java:13-18
- bugs_limitations_corner_cases.[4] ← AppInfoMenu.tsx:55-69 (`key={link.url}`)
- bugs_limitations_corner_cases.[5] ← AppInfoMenu.tsx:20-23, 48, 100, 108, 117 (no useTranslation)
- bugs_limitations_corner_cases.[6] ← AppInfoMenu.tsx:17-18 (no loading/error destructure)
- security.auth_mode_relevance ← AppInfoMenu.tsx:17-18 + AppInfoController + LinksController + DisabledAuthSecurityConfiguration
- security.data_exposure.[0] ← AppInfoMenu.tsx:47 + AppInfoController sidecar
- security.data_exposure.[1] ← AppInfoMenu.tsx:60-66 + LinksController sidecar
- security.data_exposure.[2] ← AppInfoMenu.tsx:41,61,95,103,112 (window.opener leak)
- security.known_security_gaps.[0] ← AppInfoMenu.tsx:41,61,95,103,112
- security.known_security_gaps.[1] ← AdditionalLinkProperties.java:8 + AppInfoMenu.tsx:61
- security.known_security_gaps.[2] ← AppInfoMenu.tsx:37-69 + REFACTOR-185 cluster
- security.known_security_gaps.[3] ← AppInfoMenu.tsx:74-82
- performance.hot_paths ← AppInfoMenu.tsx:17-18 + AppToolbar.tsx:67
- performance.throughput_characteristics ← AppInfoMenu.tsx:17-18 + AppInfoMenu.tsx:84-122
- performance.resource_allocation ← AppInfoMenu.tsx:37-69 + AppInfoMenu.tsx:90
- performance.scaling_characteristics ← AppInfoMenu.tsx (UI-only) + AppInfoMenu.tsx:55-69 (no pagination)
- performance.known_performance_gaps ← lib/hooks/api/appInfo.ts:4-17 + AppInfoMenu.tsx:90
- upstream_callers.[0] ← AppToolbar.tsx:67
- downstream_side_effects.[0] ← AppInfoMenu.tsx:17 + lib/hooks/api/appInfo.ts:4-9
- downstream_side_effects.[1] ← AppInfoMenu.tsx:18 + lib/hooks/api/appInfo.ts:11-17
- downstream_side_effects.[2] ← AppInfoMenu.tsx:71-122
- stress_findings.request_inputs.[0] ← AppInfoMenu.tsx:60-66 + AdditionalLinkProperties.java:8 + LinksController.java:31-33 + lib/hooks/api/appInfo.ts:11-17
- stress_findings.request_inputs.[1] ← AppInfoMenu.tsx:63
- stress_findings.request_inputs.[2] ← AppInfoMenu.tsx:47 + AppInfoController.java:26
- stress_findings.probes_emitted.[0] ← lineage/odd-platform/probes/P-173.yaml

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (grep result is definitive — no tests exist)
- docs_link_semantic: HIGH
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH
- upstream_callers: HIGH
- downstream_side_effects: HIGH
- stress_findings: HIGH (one drift flag on link.url input; one probe emitted for the security-class questions that need runtime DOM observation)

## Maintainer notes


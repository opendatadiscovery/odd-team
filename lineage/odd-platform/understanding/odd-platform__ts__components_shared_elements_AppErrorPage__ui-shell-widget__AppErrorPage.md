---
node_id: "odd-platform ts components/shared/elements/AppErrorPage ui-shell-widget:AppErrorPage"
node_kind: ui-shell-widget
axis: ui_shell
extracted_at_commit: ede5d277
enriched_at_commit: 074c9927
extractor_version: 0.1.0
prompt_version: file-analyser/0.5.0
schema_version: 0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-06-11-01
refresh_of: session-2026-05-26-ZJ (enriched_at ede5d277; refreshed for #1760 / CTRIB-005 — the `??`→`||` statusText
  fallback, the upstream ResponseError unwrap in lib/errorHandling.tsx, and the new SearchSessionExpired 404-divert)
related_concepts:
  - error-display-widget
  - error-state-redux-loader
  - http-status-code-display
  - http2-empty-reason-phrase
  - search-session-expired-divert
  - react-router-no-fallback
  - react-router-fall-through-blank-page
references:
  - kind: caller
    node: "odd-platform ts react-component component:DataEntityDetails"
    unresolved: true
    note: "renders AppErrorPage at DataEntityDetails.tsx:120-123 keyed on fetchDataEntityDetails rejection — the canonical sibling-overlay usage pattern"
  - kind: caller
    node: "odd-platform ts react-component component:Search"
    unresolved: true
    note: "NEW at 074c9927 (#1760): Search.tsx:98-100 early-returns AppErrorPage for a deep-linked session that failed to load with a NON-404 status; the 404 case is diverted to SearchSessionExpired first (Search.tsx:94-96)"
  - kind: caller
    node: "odd-platform ts react-component component:TermSearch"
    unresolved: true
    note: "NEW at 074c9927 (#1760): TermSearch.tsx:102-104 — mirror of the Search.tsx divert-then-fallback pattern"
  - kind: sibling
    node: "odd-platform ts components/shared/elements ui-shell-widget:SearchSessionExpired"
    unresolved: true
    note: "the bespoke 404-deep-link state (#1760) that REPLACES AppErrorPage on the search surfaces; copies AppErrorPage's height-calc layout (SearchSessionExpired.tsx:21) and adds a 'Start new search' recovery CTA the generic pane lacks"
  - kind: source
    node: "odd-platform ts redux/slices loader.slice:loaderSlice"
    unresolved: true
    note: "populates errors[type] from rejectWithValue(ErrorState) via the '/rejected' matcher at loader.slice.ts:42-48 — every redux-thunk rejection routes through here"
  - kind: source
    node: "odd-platform ts redux/lib handleResponseThunk:handleResponseAsyncThunk"
    unresolved: true
    note: "wraps every thunk; on catch awaits getErrorResponse(err) -> {status, statusText, url, message} and rejectWithValue's it (handleResponseThunk.ts:34-42); toast suppressed when switchOffErrorMessage (handleResponseThunk.ts:37-39)"
  - kind: source
    node: "odd-platform ts lib errorHandling:getErrorResponse"
    unresolved: true
    note: "CHANGED at 074c9927 (#1760): toResponse (errorHandling.tsx:14-18) now unwraps the generated client's ResponseError wrapper (real Response at err.response — generated-sources/runtime.ts:260-265); before this, every ErrorState carried status/statusText/url = undefined and this widget could only ever render 'Unknown Error' with an empty code"
  - kind: sibling-route-host
    node: "odd-platform ts react-component component:App"
    unresolved: true
    note: "the route registry (App.tsx:59-95, now 12 top-level routes) that still mounts NO path='*' catch-all and no error boundary; the structural reason bare /terms and /master-data produce a blank page"
---

# AppErrorPage — page-level error display widget — semantic understanding

## understanding

`AppErrorPage` is the platform UI's generic page-level error pane: a 42-line
controlled component that, when the parent passes `showError=true`, renders a
viewport-height grid with the HTTP status code as a large left-side number and a
right-side heading showing `error?.statusText || t('Unknown Error')` plus a
"Return to the Home Page" link — the `||` (changed from `??` in #1760, with an
in-code comment) deliberately treats HTTP/2's always-empty reason phrases as
missing, so under HTTP/2 the heading reads "Unknown Error" beside a real status
code. It subscribes to nothing: 24 page-level caller components wire it to their
own redux loader-slice selectors (or react-query error casts), and since the
#1760 `ResponseError` unwrap in `lib/errorHandling.tsx` those `ErrorState`
objects carry REAL statuses for the first time — before that fix every
rejection rendered as code-less "Unknown Error". It is the fallback of last
resort, not the only error UX: the search surfaces now divert 404 deep-links to
the bespoke `SearchSessionExpired` element before falling back to this widget
(Search.tsx:94-100, TermSearch.tsx:98-104). It remains neither a React error
boundary nor a route catch-all — uncaught render errors and unmatched URLs
(bare `/terms`, `/master-data`) never reach it and produce a blank page.

## concepts

- entities: [
    "ErrorState — redux loader-slice entry shape `{status, statusText, url, message}` (`odd-platform-ui/src/redux/interfaces/loader.ts:3-8`); structurally identical to the `AppError` interface produced by `getErrorResponse` (`odd-platform-ui/src/lib/errorHandling.tsx:5-10, 20-36`)",
    "HTTP status code — `error?.status` numeric — rendered as the large left-side `Typography variant='errorCode'` (72px / 84px line-height / weight 500 — `theme/typography.ts:105-109`) at `AppErrorPage.tsx:24-26`",
    "Status text — `error?.statusText` string — rendered as the right-side `Typography variant='h1'` at `AppErrorPage.tsx:30`; REAL reason phrases only under HTTP/1.1 — HTTP/2 abolished reason phrases, so fetch yields '' there (the line-29 in-code comment names exactly this)",
    "'Unknown Error' fallback — i18n key at `locales/translations/en.json:346`; shown when `error` is undefined OR `error.statusText` is undefined OR EMPTY ('' is falsy — the `||` operator is the #1760 fix; `??` previously let '' through and rendered a blank heading once real statusTexts started arriving)",
    "Home-Page CTA — `<Button text={t('Home Page')} to='/' buttonType='tertiary-m'>` at `AppErrorPage.tsx:33`; `to` makes Button render a react-router `StyledLink` (`Button.tsx:60-75`, `Button.styles.ts:141` — `styled(Link)`) to the root route (Overview, `App.tsx:60`)",
    "offsetTop — `props.offsetTop` (default 32, `AppErrorPage.tsx:16`) — px subtracted from `100vh - toolbarHeight` to size the pane below a parent's sticky header (`AppErrorPage.tsx:21`); observed caller overrides: 65 / 120 / 132 / 154 / 155 / 182 / 194 / 210"
  ]
- operations: [
    "render-error-pane — if `showError`, render the height-calc'd grid with status code + heading + Home-Page link (`AppErrorPage.tsx:20-38`)",
    "render-nothing — if `!showError`, return `null` (`AppErrorPage.tsx:20, 38`); zero DOM contribution on a healthy page",
    "localise — `useTranslation()` provides `t('Unknown Error')` / `t('Return to the')` / `t('Home Page')` (`AppErrorPage.tsx:18, 30, 32, 33`); keys verified in `en.json:346/267/169`; six locale bundles exist (en/es/fr/ua/hy/ch — Glob `**/translations/*.json`), per-key presence re-verified for en only this pass",
    "compute-pane-height — `calc(100vh - ${toolbarHeight}px - ${offsetTop}px)` (`AppErrorPage.tsx:21`); `toolbarHeight=48` (`lib/constants.ts:131`), so the default pane is `100vh - 80px`"
  ]
- invariants: [
    "**Controlled component, not subscriber.** No redux read, no react-query, no context except i18n. Every caller wires `showError` + `error` explicitly (`AppErrorPage.tsx:8-12`).",
    "**`null` when `showError=false`.** Single ternary; no skeleton/spinner branch (`AppErrorPage.tsx:20, 38`).",
    "**Only `status` and `statusText` are displayed; `url` and `message` are NEVER read by this widget.** JSX accesses `error?.status` (line 25) and `error?.statusText` (line 30) only — verified by reading the full 42-line file. The boundary is TRUST-BASED, not enforced: statusText renders VERBATIM, and one caller (LinkedTermsList.tsx:88-93, FIXME'd) already stuffs a client error `.message` into the statusText slot.",
    "**Empty-string statusText falls back to 'Unknown Error'.** `error?.statusText || t('Unknown Error')` (`AppErrorPage.tsx:30`); the line-29 comment documents WHY (HTTP/2 reason phrases are empty strings). When `error` is entirely undefined the left column also collapses to an empty span (line 25).",
    "**NOT a React error boundary.** Functional component, no `componentDidCatch`/`getDerivedStateFromError`; Grep `ErrorBoundary|componentDidCatch|getDerivedStateFromError` over the WHOLE `odd-platform-ui/src` tree returns ZERO files (re-run 2026-06-11 at 074c9927).",
    "**The 'Home Page' link is hard-coded `to='/'`** (`AppErrorPage.tsx:33`); root resolves to `<Overview />` (`App.tsx:60`). No prop redirects elsewhere.",
    "**Assumes the `<AppToolbar>` shell (subtracts `toolbarHeight=48`).** All 24 callers mount under `App.tsx`'s shell (`App.tsx:56-57`), so the calc holds (`AppErrorPage.tsx:21` + `lib/constants.ts:131`)."
  ]
- audiences: [
    "odd-platform-ui-end-user — any user whose page-level data fetch failed; since #1760 they see the REAL status code (e.g. 404 / 500 / 403); the heading is the reason phrase under HTTP/1.1 and 'Unknown Error' under HTTP/2",
    "platform-operator-debugging — sees the status code but NOT the failing URL or backend message; the backend `message` appears only in the transient bottom-right toast (`showServerErrorToast`, `errorHandling.tsx:58-80`; 6000ms — `App.tsx:55`), and not at all for toast-suppressed thunks or network-level failures"
  ]

## dependencies_semantic

- requires-feature: [
    "i18next runtime + the `Unknown Error` / `Return to the` / `Home Page` keys (`locales/translations/en.json:346, 267, 169`; bundles en/es/fr/ua/hy/ch exist)"
  ]
- requires-config: [] — N/A. No `process.env`, no feature flag, no runtime config; identical across `auth.type=DISABLED|LOGIN_FORM|OAUTH2|LDAP`.
- requires-runtime: [
    "React 18 — `React.FC`, JSX (`AppErrorPage.tsx:2, 13`)",
    "MUI `Grid` + `Typography` (`AppErrorPage.tsx:1, 21-35`) + the theme's `errorCode` typography variant (`theme/typography.ts:105-109`)",
    "react-i18next `useTranslation` (`AppErrorPage.tsx:3, 18`)",
    "react-router-dom `Link` via the in-house Button's `to` path (`AppErrorPage.tsx:33` + `Button.tsx:60-75` + `Button.styles.ts:141` — `StyledLink = styled(Link)`)",
    "`toolbarHeight` constant (`AppErrorPage.tsx:5, 21` + `lib/constants.ts:131`)"
  ]
- couples-to: [
    "`redux/interfaces/loader.ts:3-8` — imports the `ErrorState` type (`AppErrorPage.tsx:4`); consumes the redux-defined error shape without subscribing to the slice",
    "`components/shared/elements/Button/Button.tsx` — the Home-Page CTA (`AppErrorPage.tsx:6, 33`)",
    "24 page-level caller components (fresh Grep `AppErrorPage` over `odd-platform-ui/src` at 074c9927: 26 matching files = the widget + the `shared/elements/index.ts:57` re-export + 24 callers) — enumerated in `upstream_callers`",
    "BEHAVIOURALLY (not imported): `lib/errorHandling.tsx:14-36` — the quality of what this widget displays is entirely determined by `getErrorResponse`'s ResponseError unwrap; pre-#1760 the unwrap was missing and the widget could never show a real code"
  ]

## tests_coverage_semantic

- covered_behaviours:
  - behaviour: "404 search/term-search deep-links are diverted AWAY from AppErrorPage: `/search/{missing}` and `/termsearch/{missing}` render the 'This search has expired' state (SearchSessionExpired), not the generic pane"
    test_class: integration
    test_files: ["<odd-team>/integration-tests/e2e/specs/search-session-not-found.spec.ts:62-78 (search) + 108-122 (termsearch) — IT-125, re-grounded 2026-06-11 to the #1760 fixed contract"]
- uncovered_behaviours:
  - behaviour: "Renders `null` when `showError=false` (the dominant healthy-page case)"
    test_class: unit
    criticality: LOW
    note: "Trivial conditional; would catch only an always-render regression."
  - behaviour: "Renders `error.status` as the code and `error.statusText` as the heading"
    test_class: unit
    criticality: MEDIUM
    note: "Pins the displayed-field contract. No unit test exists despite a Vitest-style suite now existing in the repo (7 `.test.tsx` files at 074c9927 — none for error surfaces)."
  - behaviour: "EMPTY-STRING statusText falls back to 'Unknown Error' (`||`, not `??`)"
    test_class: unit
    criticality: MEDIUM
    note: "REGRESSES the UI half of #1760: HTTP/2 reason phrases are ''; a future `??` 'cleanup' would re-blank the heading on every HTTP/2 deployment. The in-code comment (AppErrorPage.tsx:29) is the only current guard."
  - behaviour: "Falls back to 'Unknown Error' + empty code column when `error` is undefined (the OwnerAssociations* no-error-prop callers)"
    test_class: unit
    criticality: MEDIUM
    note: "Three callers pass `showError` with no `error` (OwnerAssociationsActive.tsx:99 / New.tsx:95 / Resolved.tsx:103)."
  - behaviour: "Does NOT render `error.url` or `error.message` to the DOM"
    test_class: security
    criticality: HIGH
    note: "Pins the no-leak contract; a future 'improvement' adding the backend message/URL to the pane would land silently. See P-176 (pending) + security.known_security_gaps[0]."
  - behaviour: "The 'Home Page' button navigates client-side to `/` via react-router"
    test_class: integration
    criticality: LOW
    note: "Would catch a regression to full-reload `<a href>`."
  - behaviour: "offsetTop clears the parent's sticky header (8 distinct override values in callers: 65-210)"
    test_class: integration
    criticality: LOW
    note: "No layout-overlap regression net."
  - behaviour: "Bare `/terms`, `/master-data`, and unknown URLs produce a blank page (NOT AppErrorPage)"
    test_class: integration
    criticality: MEDIUM
    note: "Pins this widget's SCOPE (thunk-rejection only; no route catch-all). Documents the missing `path='*'` decision — see bugs[0]."
- test_files: ["odd-platform-ui now contains 7 component unit tests (Glob `**/*test*` over `odd-platform-ui/src`, 2026-06-11: 3× DataEntitiesUsageInfo + BooleanFormatted + EntityClassItem + NumberFormatted + TextFormatted + lib/tests/testHelpers.tsx) — NONE references AppErrorPage", "<odd-team>/integration-tests/e2e/specs/search-session-not-found.spec.ts — adjacent coverage (asserts this widget's NON-appearance on the 404 deep-link path)"]
- gaps: |
    The 2026-05-26 claim "no test file exists anywhere in odd-platform-ui/src" is
    now FALSE — a unit-test suite has appeared (7 `.test.tsx` files) — but none of
    it touches the error-display surface, so this node's direct coverage is still
    zero. Highest-leverage addition remains the **security** pin on the
    displayed-field contract (status + statusText only), now sharpened by the
    LinkedTermsList counter-example: the widget renders statusText verbatim, so
    the pin needs to assert both halves (widget never reads url/message AND
    callers don't smuggle message into statusText). Second: a **unit** pin on the
    `||` empty-string fallback, which is the regression class #1760 just fixed.
    IT-125 covers only the search-surface divert (where AppErrorPage must NOT
    appear); no test anywhere asserts what the pane shows when it DOES appear.

## docs_link_semantic

- declared_docs: [] — N/A. `AppErrorPage.tsx` (42 lines, read end-to-end at 074c9927) carries no `@docs` annotation; consistent with the repo-wide UI convention.
- inferred_docs: [] — N/A. Re-WebFetched `https://docs.opendatadiscovery.org/` (2026-06-11, status 200) and `https://docs.opendatadiscovery.org/features` (2026-06-11, status 200); both confirm NO mention of error pages, error display, HTTP error codes in the UI, "Unknown Error", 404/blank pages, expired search sessions, or UI troubleshooting. No candidate page exists to infer.
- doc_drift_findings:
  - "**DOC GAP (re-verified 2026-06-11) — the platform's error-display UI is undocumented end-to-end.** 24 page-level components render this pane on fetch failure; the live docs (root + /features, both status 200, 2026-06-11) describe none of it — no screenshot, no troubleshooting paragraph, no 'if you see a 404 here, do X'. Severity: LOW (operator-experience drift, no data-loss/security content). A 'Troubleshooting / Common error pages' section under operator guides remains the recommendation. NOTE: the #1760 behaviour change (real status codes; 'This search has expired' divert) lives on the unmerged `contrib/CTRIB-005-search-session-not-found` branch — any future doc for it rides the release train, not docs main."
  - "**DOC GAP — bare-URL fall-through (`/terms`, `/master-data`, any unmatched path) produces a BLANK PAGE, not this widget.** Re-confirmed at 074c9927: `App.tsx:59-95` declares 12 top-level routes (now including dataQuality:79, dataModelling:80, lookupTables:81-94) and STILL no `<Route path='*'>`; the `/terms` parent has only a `:termId/*` child (App.tsx:72-74; `termsRoutes.ts:21-23`), and `/master-data` itself is unrouted (`masterDataRoutes.ts:1-4` exports only the `/master-data/lookup-tables` child, mounted at App.tsx:81-94). React-Router v6 no-match renders nothing below the toolbar. Undocumented in docs AND unsurfaced in the UI. Severity: MEDIUM. The 5-line `path='*'` fix proposed in the 2026-05-26 pass remains open."

## implicit_adrs

- "**Error display is per-page-component-owned, not global; AppErrorPage is the generic fallback that specific statuses may divert around.** All 24 callers wire their OWN instance to their OWN fetching-status selector; the show/hide decision always lives in the consumer (`AppErrorPage.tsx:8-12` — props-only interface). The #1760 commit strengthens the stance: rather than special-casing 404 INSIDE the widget, the search surfaces branch BEFORE it (`Search.tsx:94-100`, `TermSearch.tsx:98-104`) to a bespoke `SearchSessionExpired` state, keeping this widget status-agnostic. The Search.tsx comment states the philosophy: a 404'd deep-link session is 'a graceful dead-link state, not an error (#1760)'." — evidence: AppErrorPage.tsx:8-12 + 24 caller files (Grep `AppErrorPage` over `odd-platform-ui/src`, 2026-06-11) + Search.tsx:48-51, 94-100 — intent_anchor: "// A deep-linked session that failed to load: 404 = the ephemeral session is gone (expired TTL / foreign link) — a graceful dead-link state, not an error (#1760)." (Search.tsx:48-49) — confidence: HIGH

- "**Only `status` and `statusText` are displayed; `url` and `message` are deliberately omitted (two-channel design: page shows the code, toast shows the message).** The `ErrorState` shape carries four fields (`redux/interfaces/loader.ts:3-8`), all four now genuinely populated by `getErrorResponse` (`errorHandling.tsx:20-36`); the widget reads only `error?.status` (line 25) and `error?.statusText` (line 30). The backend `body.message` is surfaced via `showServerErrorToast` (`errorHandling.tsx:58-80`) — transient, dismissible, 6000ms (`App.tsx:55`) — never persistently on the page. The boundary keeps backend internals (stack fragments, SQL text, internal URL paths) out of the persistent DOM." — evidence: AppErrorPage.tsx:25, 30 (the only two reads in the 42-line file) + redux/interfaces/loader.ts:3-8 + errorHandling.tsx:58-80 — intent_anchor: "`{error?.status}` ... `{error?.statusText || t('Unknown Error')}`" (AppErrorPage.tsx:25, 30) — confidence: HIGH

- "**Blank statusText is treated as missing because HTTP/2 has no reason phrases (`||`, not `??`).** New at 074c9927 (#1760, CTRIB-005). Once `getErrorResponse` started delivering real Responses, HTTP/2 deployments delivered `statusText: ''` — nullish-coalescing let '' through and rendered an EMPTY heading. The fix switches to `||` and documents the reasoning in-line, accepting the trade-off that an empty reason phrase can never be displayed (an empty phrase carries no information to lose)." — evidence: AppErrorPage.tsx:29-30 — intent_anchor: "// HTTP/2 reason phrases are empty strings — || so a blank statusText still falls back." (AppErrorPage.tsx:29) — confidence: HIGH

## bugs_limitations_corner_cases

- "**Bare `/terms`, `/master-data`, and any unmatched URL still produce a BLANK PAGE — no `path='*'` catch-all mounts this widget.** Re-verified at 074c9927: `App.tsx:59-95` (12 top-level routes — three NEW since the last pass: dataQuality:79, dataModelling:80, lookupTables:81-94 — none a catch-all); `/terms` parent has only `:termId/*` (App.tsx:72-74); `/master-data` itself unrouted (`masterDataRoutes.ts:1-4`). Grep `path=['\"]\\*['\"]|NotFound|Page404|404Page|NoMatch` over the whole `odd-platform-ui/src` tree: ZERO matches (2026-06-11). The toolbar renders; the route body is empty. Fix remains a 5-line `<Route path='*' element={<AppErrorPage showError error={{status:404, statusText:'Page Not Found', url:'', message:''}}/>}/>`." — evidence: App.tsx:59-95 + routes/termsRoutes.ts:21-23 + routes/masterDataRoutes.ts:1-4 + the named grep over `odd-platform-ui/src` — severity: MEDIUM

- "**There is still NO React error boundary anywhere in the platform UI.** Grep `ErrorBoundary|componentDidCatch|getDerivedStateFromError` over `odd-platform-ui/src`: ZERO files (re-run 2026-06-11 at 074c9927). `AppSuspenseWrapper` is Suspense-only (`AppSuspenseWrapper.tsx:12-20` — `AppLoadingPage` fallback, no error path). A synchronous render throw in any route subtree unmounts to no boundary (React 18 unmounts the whole tree); a lazy-chunk load failure (`App.tsx:30-41`) has no error surface either. AppErrorPage cannot catch any of this — it is a sibling inside page subtrees, not an ancestor." — evidence: the named grep over `odd-platform-ui/src` + AppSuspenseWrapper.tsx:12-20 + App.tsx:30-41, 58-96 — severity: HIGH

- "**The `error` prop's type contract is widely bypassed via casts: six callers feed react-query errors through `as ErrorState` / `as unknown as ErrorState`.** At 074c9927: `IntegrationPreviewList.tsx:70` (`error as ErrorState`), `Entities.tsx:63` (`(typesError ?? entitiesError) as ErrorState`), `Directory.tsx:33`, `DataSourceList.tsx:113`, `DatasetStructureCompare.tsx:50` (all `error as unknown as ErrorState` — the double-cast means the compiler REJECTED the direct cast), plus `Integration.tsx:33` (passes its react-query `error` uncast). A react-query `Error` has `message` but no `status`/`statusText`, so these panes render an empty code + 'Unknown Error' regardless of the actual HTTP failure — exactly the pre-#1760 degraded display, surviving on these six surfaces. Generalising the prop to a discriminated union (or mapping react-query errors to ErrorState at the hook layer) would fix the class." — evidence: the six caller lines above + AppErrorPage.tsx:10 — severity: MEDIUM (raised from LOW: the #1760 fix made redux-path errors real, so the cast-path surfaces are now visibly WORSE than the rest of the app)

- "**LinkedTermsList fabricates its ErrorState — hardcoded `status: 500` with the react-query error `.message` smuggled into `statusText` — under an in-code `// FIXME`.** `LinkedTermsList.tsx:85-95`: `showError={!isLinkedListFetched}` + `error={{ status: 500, statusText: error?.message ?? 'Unknown Error', url: query, message: error?.message ?? 'Unknown Error' }}` (the `error` here is `useGetTermLinkedTerms`'s react-query error, LinkedTermsList.tsx:20-32; `query` is the user's live search-box string). Operator-visible: any failure on /terms/:termId/linked-terms shows '500' regardless of the real status, with a client-library error string as the H1 heading. Widget-relevant: this proves the displayed-field boundary is caller-subvertible — AppErrorPage renders `statusText` VERBATIM (AppErrorPage.tsx:30) with no sanitisation, so the 'no message on the page' property holds only by caller convention. The author knew (the FIXME); the fix is honest wiring to the real response status." — evidence: LinkedTermsList.tsx:85-95 (FIXME at :87) + LinkedTermsList.tsx:20-32 + AppErrorPage.tsx:30 — severity: MEDIUM

- "**No retry / re-fetch affordance on the generic pane.** Only CTA is 'Return to the Home Page' (`AppErrorPage.tsx:31-33`); no `onRetry` prop exists (`AppErrorPage.tsx:8-12`). The contrast is now in-repo: the #1760 `SearchSessionExpired` sibling DOES ship a recovery CTA ('Start new search', SearchSessionExpired.tsx:35-40), so the platform has a recovery pattern — the generic pane just predates it. Transient-failure users must browser-refresh or navigate back manually." — evidence: AppErrorPage.tsx:8-12, 31-33 + SearchSessionExpired.tsx:35-40 — severity: LOW

- "**When `error` is undefined but `showError=true`, the left column collapses and the heading reads 'Unknown Error' with no code.** Three callers pass no `error` prop (`OwnerAssociationsActive.tsx:99`, `OwnerAssociationsNew.tsx:95`, `OwnerAssociationsResolved.tsx:103` — all `<AppErrorPage showError={isError} offsetTop={182} />`). The same degraded display also occurs for NETWORK-level failures on redux paths: a fetch TypeError has no Response, so `toResponse` yields undefined and `getErrorResponse` returns `{status: undefined, statusText: undefined, url: undefined, message: 'An error occurred'}` (`errorHandling.tsx:14-18, 30-35`) — and the error toast is ALSO suppressed in that case (`showServerErrorToast` only fires `if (response?.status)`, `errorHandling.tsx:77-79`), making backend-down a silent, toastless 'Unknown Error' pane." — evidence: AppErrorPage.tsx:25, 30 + the three OwnerAssociations lines + errorHandling.tsx:14-18, 30-35, 77-79 — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "AppErrorPage.tsx:16"
      name: "offsetTop"
      value: "32 (default); caller overrides at 074c9927: 65 / 120 / 132 / 154 / 155 / 182 / 194 / 210"
      questions:
        - q: "What at N = 0?"
          a: "`100vh - 48px - 0px` — pane fills the entire below-toolbar viewport. No layout break."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:21 + lib/constants.ts:131"
        - q: "What at N very large (e.g. 800)?"
          a: "On short viewports the calc resolves negative; CSS clamps a negative calc height to 0, collapsing the container box. Children overflow the 0-height box (default overflow: visible), producing a degraded/overlapping layout rather than a clean centered pane. No clamp or guard exists in the widget; max observed caller value is 210 (five callers)."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:21 (string-interpolated calc, no clamp) + caller survey 2026-06-11"
        - q: "What at null / negative / non-numeric?"
          a: "undefined -> default 32 (destructure default applies to undefined only, line 16). null/NaN/string interpolate into the template literal ('nullpx'/'NaNpx') making the calc invalid — the height declaration is dropped per CSS invalid-value handling and the Grid falls back to content-driven auto height (pane renders, but not viewport-filling/centered). A negative number extends the pane past the viewport (scrollbar)."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:16, 21"
        - q: "What does the operator see at each boundary?"
          a: "Default: pane fills viewport minus 80px. Overridden (65-210): pane clears the parent's sticky header. Pathological values: silently collapsed or auto-sized pane. No log, no error."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:21 + the 8 distinct override values across 24 callers"
    - location: "lib/constants.ts:131"
      name: "toolbarHeight"
      value: "48"
      questions:
        - q: "What at N = 0?"
          a: "Pane gains 48px; but the constant also sizes the real toolbar and App.tsx's paddingTop (App.tsx:57), so 0 would collapse the shell itself — not a value this widget controls."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:21 + lib/constants.ts:131 + App.tsx:57"
        - q: "What at tunable x 100?"
          a: "Same as a huge offsetTop — the calc clamps to 0 and the box collapses (content overflows visibly). Hard-coded constant; no env/config override path exists."
          confidence: STATIC-INFERRED
          evidence: "lib/constants.ts:131"
        - q: "What does the operator see at each boundary?"
          a: "Operators cannot reach this boundary — compile-time constant, no override surface."
          confidence: STATIC-INFERRED
          evidence: "lib/constants.ts:131"
  name_behavior_pairs:
    - name: "AppErrorPage (component name)"
      promise: "An 'App-level error page' — implies the app-wide / route-level error display."
      implementation: "A per-page render-helper: 24 page components mount their own instance keyed on their own fetch state. NOT mounted at any path='*'; NOT an error boundary; and since #1760 not even the only fetch-error UX — search surfaces divert 404 deep-links to SearchSessionExpired before falling back here (Search.tsx:94-100, TermSearch.tsx:98-104)."
      drift: MINOR
      operator_visible_consequence: "Operators expecting 'the' app error page for ANY failure get a blank page for unmatched URLs and uncaught render errors, and a bespoke expired-search state for 404 search deep-links; this widget appears only for page-level data-fetch rejections."
      confidence: STATIC-INFERRED
      evidence: "AppErrorPage.tsx:1-42 + App.tsx:59-95 + Search.tsx:94-100 + 24 caller files"
    - name: "showError (prop)"
      promise: "Boolean — show the error pane if true."
      implementation: "Exactly that: `return showError ? (<Grid...>) : null` (AppErrorPage.tsx:20, 38)."
      drift: NONE
      operator_visible_consequence: ""
      confidence: STATIC-INFERRED
      evidence: "AppErrorPage.tsx:20, 38"
    - name: "error (prop)"
      promise: "An ErrorState — 'the error to display'; the 4-field type implies the whole error context surfaces."
      implementation: "Only `error?.status` (line 25) and `error?.statusText` (line 30) are read; `url` and `message` are accepted by the type and dropped. statusText renders verbatim — the widget performs no validation of what callers place there."
      drift: MINOR
      operator_visible_consequence: "Favourable drift (information-disclosure boundary), but trust-based: LinkedTermsList.tsx:88-93 already routes a client error message through the statusText slot onto the page."
      confidence: STATIC-INFERRED
      evidence: "AppErrorPage.tsx:10, 25, 30 + redux/interfaces/loader.ts:3-8 + LinkedTermsList.tsx:88-93"
    - name: "statusText || t('Unknown Error') (the heading fallback expression)"
      promise: "Show the HTTP reason phrase; fall back when there isn't one."
      implementation: "`||` treats undefined AND '' as missing (changed from `??` in #1760). Under HTTP/2 — where fetch always yields statusText '' — the heading is ALWAYS 'Unknown Error' beside the real numeric code; under HTTP/1.1 real phrases ('Not Found') display. The in-code comment documents the choice."
      drift: NONE
      operator_visible_consequence: "Not drift, but a deployment-dependent display: the same 404 reads '404 / Not Found' over HTTP/1.1 and '404 / Unknown Error' over HTTP/2 (typical TLS reverse-proxy setups). Pre-#1760 (`??`) the HTTP/2 heading was EMPTY."
      confidence: STATIC-INFERRED
      evidence: "AppErrorPage.tsx:29-30 (comment + expression)"
  orderings: []
    # No ORDER BY / LIMIT / paginate / sort in this 42-line presentation
    # component; it renders exactly one error. Explicit [] per Rule 9.
  auth_gates:
    - location: "AppErrorPage.tsx:1-42"
      endpoint: "N/A — render-only UI component; no HTTP endpoint, no permission check"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "Identical render in all four modes — no auth-mode branching, no permission/feature-flag read anywhere in the file."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:1-42"
        - q: "What does an unauthenticated caller see?"
          a: "Unauthenticated users don't reach the parent routes under LOGIN_FORM/OAUTH2/LDAP (backend redirects pre-shell). Under DISABLED, anyone reaching a page whose fetch rejects sees the pane with the backend's status."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:1-42 (no own gate; upstream *SecurityConfiguration enforcement)"
        - q: "What does a wrong-role caller see?"
          a: "Whatever status the backend rejected with — e.g. a 403 renders '403' + reason-phrase-or-'Unknown Error'. The widget mirrors; it does not gate."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:25, 30"
        - q: "Where does the gate live?"
          a: "Nowhere at this layer; backend controllers own authorization. The widget is the visualisation of their refusals."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:8-38"
  resource_boundaries:
    - location: "AppErrorPage.tsx:13-39"
      kind: concurrency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "No shared state to corrupt — no useState/useEffect/fetch/mutation; pure render from props (only hook is useTranslation)."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:13-39"
        - q: "Is the call replay-safe?"
          a: "Yes — idempotent render; same (showError, error, offsetTop) props produce the same DOM."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:13-39"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No cache at this node; staleness is owned by caller-side state (redux loader slice / react-query)."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:13-39 (no useMemo, no cache import)"
  request_inputs:
    - location: "AppErrorPage.tsx:8-12"
      input_kind: body-field
      input_name: "showError"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "Boolean controlling error-pane visibility."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:9"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Sole ternary discriminant at line 20 selecting the whole JSX tree or null."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:20, 38"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:20, 38"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — MATCHES."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:20"
        - q: "Available-but-unused matching field?"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:8-12"
      routes_to_finding: ""
    - location: "AppErrorPage.tsx:8-12"
      input_kind: body-field
      input_name: "error"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The error to display; its ErrorState type carries four fields (status, statusText, url, message), implying full error context will surface."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:10 + redux/interfaces/loader.ts:3-8"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "ONLY `error?.status` (line 25, the code column) and `error?.statusText` (line 30, the heading). `url` and `message` are never read — verified by reading the complete 42-line file; no other `error` access exists. The `message` field's user-visible channel is the upstream toast (handleResponseThunk.ts:37-39 -> showServerErrorToast, errorHandling.tsx:58-80), not this widget."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:25, 30 (the only two reads)"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_LEGITIMATELY — displays the least-sensitive 2 of 4 fields. Half the design is NOW documented in-code (the line-29 HTTP/2 fallback comment); the url/message omission remains comment-less, its intent inferred from the toast channel-split and 24-caller symmetry."
          drift: MINOR
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:25, 29-30 + errorHandling.tsx:58-80"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "Failure modes: (1) a caller assuming `message` shows on the page leaves the user with only the 6s toast (or NOTHING for switchOffErrorMessage thunks — 12 sites incl. fetchTermDetails terms.thunks.ts:83 — and for network failures, errorHandling.tsx:77-79); (2) a caller WANTING a message on the page must abuse the statusText slot — LinkedTermsList.tsx:88-93 does exactly this today under a FIXME; (3) a future 'improvement' rendering error.message/url would leak backend internals — the omission is the guard, see P-176."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:25, 30 + LinkedTermsList.tsx:85-95 + errorHandling.tsx:34, 77-79 + terms.thunks.ts:77-84"
        - q: "Available-but-unused matching field?"
          a: "YES — `error.url` (the failing API URL, errorHandling.tsx:33) and `error.message` (backend body.message or 'An error occurred', errorHandling.tsx:34): both populated since the #1760 unwrap, both unrendered here. Deliberate non-use IS the design; only the fallback half is documented in-code."
          confidence: STATIC-INFERRED
          evidence: "redux/interfaces/loader.ts:5-7 + errorHandling.tsx:30-35 + AppErrorPage.tsx:25, 30"
      routes_to_finding: "implicit_adrs[1] (two-channel boundary) + tests_coverage_semantic.uncovered_behaviours (security pin) + security.known_security_gaps[0] (half-documented) + bugs_limitations_corner_cases[3] (the LinkedTermsList subversion)"
    - location: "AppErrorPage.tsx:8-12"
      input_kind: body-field
      input_name: "offsetTop"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "Pixel clearance from the top for a parent's sticky header/breadcrumb."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:11, 16"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Subtracted in the height calc `calc(100vh - ${toolbarHeight}px - ${offsetTop}px)` (line 21); no clamp/validation."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:21"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:11, 21"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — MATCHES."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:21"
        - q: "Available-but-unused matching field?"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:8-12"
      routes_to_finding: ""
  probes_emitted:
    - probe_id: P-176
      question: "Confirm the information-disclosure boundary at runtime (DOM contains status+statusText only, never message/url — incl. after the 6s toast vanishes) AND the bare-URL blank-page fall-through (/terms, /master-data)."
      probe_path: "lineage/odd-platform/probes/P-176.yaml"
      note: "Emitted by the 2026-05-26 pass; still `status: pending-stress-protocol` (probe file re-read 2026-06-11). Hypotheses remain valid at 074c9927 — with the bonus that post-#1760 the arrange step will now produce REAL statuses, making the assert sharper than when it was written (verified_against_commit in the probe still says ede5d277; probe-runner re-stamps on execution)."
  stress_summary:
    triggers_total: 11
    questions_total: 33
    answers_static_inferred: 33
    answers_probe_needed: 0
    answers_reference: 0
    drift_flags: 2
```

## security

- **auth_mode_relevance**: `INTERNAL_ONLY` — presentation component; no HTTP surface, no auth-mode reference; renders identically under `DISABLED | LOGIN_FORM | OAUTH2 | LDAP`. It visualises whatever status the backend's enforcement produced (a 403 from a permission denial renders as '403').
- **ingestion_filter_relevance**: `NO — UI presentation component`; no relationship to `POST /ingestion/entities` or `IngestionDataEntitiesFilter`.
- **authorization_assertions**: [] — enforces no permission; pure render helper (`AppErrorPage.tsx:1-42`).
- **owner_scoping**: `N/A — not data-scoped`; renders one status code, no entity data.
- **data_exposure**:
  - "**Bounded leak surface at the widget: only the numeric HTTP status and the statusText string enter the DOM** (`AppErrorPage.tsx:25, 30`). `error.url` (internal endpoint path) and `error.message` (backend body.message — possibly stack/SQL fragments) are populated upstream (`errorHandling.tsx:30-35`) but never read here. CAVEAT (new finding this pass): statusText renders VERBATIM with no validation, so the boundary is only as strong as caller discipline — `LinkedTermsList.tsx:88-93` already passes a react-query error `.message` as statusText, putting a client-library error string into the page H1 on that surface." — evidence: AppErrorPage.tsx:25, 30 (full-file read, no other `error` access) + errorHandling.tsx:30-35 + LinkedTermsList.tsx:88-93
  - "**The backend `message` channel is the transient toast, and it is narrower than it looks**: `showServerErrorToast` fires only when `response?.status` is truthy (`errorHandling.tsx:77-79`) — so network-level failures (no Response object) show NO toast; 12 thunk call-sites additionally suppress it via `switchOffErrorMessage` (incl. `fetchTermDetails`, terms.thunks.ts:83). In those cases this pane is the ONLY error surface, and it carries no message by design." — evidence: errorHandling.tsx:58-80 + Grep `switchOffErrorMessage` over `odd-platform-ui/src/redux/thunks` (12 sites) + App.tsx:55 (6000ms)
  - "**No JS stack-trace surface.** Not an error boundary; never receives a thrown exception object — displays HTTP-layer fields only." — evidence: AppErrorPage.tsx:1-42
- **known_security_gaps**:
  - "**The 2-of-4-field display boundary is only HALF-documented in code.** The #1760 comment (`AppErrorPage.tsx:29`) now documents the statusText FALLBACK reasoning, but the omission of `url`/`message` still has no JSDoc/comment/test defending it. A future PR adding `<Typography>{error.message}</Typography>` to 'help operators' would land silently — no test references this component. The LinkedTermsList FIXME (bugs[3]) shows the pressure to surface messages already exists in the codebase." — evidence: AppErrorPage.tsx:1-42 (line 29 is the only comment) + Glob `**/*test*` over `odd-platform-ui/src` (7 test files, none touching this node) — severity: MEDIUM
  - "**Message-recovery asymmetry persists: the page shows the code indefinitely; the backend's hint lives 6 seconds in a dismissible toast (or never appears at all).** After the toast vanishes, a user on the pane has no way to recover the backend's message ('Term 9999 does not exist'); for switchOffErrorMessage thunks and network failures there was never a toast. Undocumented (live-doc re-check 2026-06-11)." — evidence: errorHandling.tsx:58-80 + App.tsx:55 + AppErrorPage.tsx:25, 30 — severity: LOW

## performance

- **hot_paths**: [] — N/A. 42-line stateless render of 4 MUI primitives, mounted only in a page's terminal fetch-failure state; not on the steady-state critical path.
- **throughput_characteristics**: [] — N/A. No request, batch, or stream; renders on prop change only.
- **resource_allocation**: [] — N/A. No data load, no I/O, no memory growth.
- **scaling_characteristics**: [] — N/A. Pure render; trivially concurrent.
- **known_performance_gaps**: [] — N/A.

## upstream_callers

All 24 call-sites re-enumerated at 074c9927 (Grep `AppErrorPage` over `odd-platform-ui/src`, 2026-06-11). Multiplicity per trigger is `0 | 1` everywhere — the pane renders once when the page's fetch state is rejected and not before; no caller re-mounts it per event.

- entry_point: "ui_route:/search/:searchId (deep-link, NON-404 failure)"
  caller_node: "odd-platform ts react-component component:Search"
  multiplicity_per_trigger: "0 | 1 (full-page early-return)"
  evidence: "Search.tsx:98-100 — `if (isDeepLinkNotLoaded) { return <AppErrorPage showError error={searchError} />; }`; NEW at 074c9927. The 404 case never reaches it: Search.tsx:51 + 94-96 divert `searchError?.status === 404` to SearchSessionExpired. So this mount renders only for 5xx/403/network-class deep-link failures."
  observation_class: ui-call

- entry_point: "ui_route:/termsearch/:termSearchId (deep-link, NON-404 failure)"
  caller_node: "odd-platform ts react-component component:TermSearch"
  multiplicity_per_trigger: "0 | 1 (full-page early-return)"
  evidence: "TermSearch.tsx:102-104, mirror of Search.tsx (divert at TermSearch.tsx:50-51, 98-100); intent comment TermSearch.tsx:46-47 ('Mirror of the catalog search dead-link handling (#1760)')."
  observation_class: ui-call

- entry_point: "ui_route:/search/:searchId"
  caller_node: "odd-platform ts react-component component:Search/Results"
  multiplicity_per_trigger: "0 | 1"
  evidence: "Search/Results/Results.tsx:168-172 — `showError={isSearchResultsNotLoaded} error={searchResultsError} offsetTop={210}` (results-fetch rejection inside an otherwise-loaded search page)."
  observation_class: ui-call

- entry_point: "ui_route:/dataentities/:dataEntityId/* (App.tsx:75-77)"
  caller_node: "odd-platform ts react-component component:DataEntityDetails"
  multiplicity_per_trigger: "0 | 1"
  evidence: "DataEntityDetails.tsx:120-123 — `showError={isDataEntityDetailsNotFetched} error={dataEntityDetailsFetchingError}`."
  observation_class: ui-call

- entry_point: "ui_route:/terms/:termId/* (App.tsx:72-74)"
  caller_node: "odd-platform ts react-component component:TermDetails"
  multiplicity_per_trigger: "0 | 1"
  evidence: "TermDetails.tsx:80-83 — `showError={isTermDetailsNotFetched} error={termDetailsFetchingErrors}`. `fetchTermDetails` sets `switchOffErrorMessage: true` (terms.thunks.ts:77-84), so the toast is suppressed and this pane is the ONLY error surface for /terms/:termId failures."
  observation_class: ui-call

- entry_point: "ui_route:/alerts/* (App.tsx:70)"
  caller_node: "odd-platform ts react-component component:Alerts/AlertsList"
  multiplicity_per_trigger: "0 | 1"
  evidence: "AlertsList.tsx:101 — `<AppErrorPage showError={isAlertsNotLoaded} error={alertsError} />`."
  observation_class: ui-call

- entry_point: "ui_route:/activity (App.tsx:71)"
  caller_node: "odd-platform ts react-component component:Activity/ActivityResults"
  multiplicity_per_trigger: "0 | 1"
  evidence: "Activity/ActivityResults/ActivityResults.tsx:76-80 — `showError={isActivitiesNotFetched} offsetTop={65} error={activitiesError}`."
  observation_class: ui-call

- entry_point: "ui_route:/directory/* (App.tsx:78)"
  caller_node: "odd-platform ts react-component component:Directory/Directory"
  multiplicity_per_trigger: "0 | 1"
  evidence: "Directory/Directory/Directory.tsx:30-34 — `showError={isError} offsetTop={210} error={error as unknown as ErrorState}` (react-query double-cast — see bugs[2])."
  observation_class: ui-call

- entry_point: "ui_route:/directory/* (entities list)"
  caller_node: "odd-platform ts react-component component:Directory/Entities"
  multiplicity_per_trigger: "0 | 1"
  evidence: "Directory/Entities/Entities.tsx:60-64 — `showError={isTypesError || isEntitiesError} offsetTop={210} error={(typesError ?? entitiesError) as ErrorState}`."
  observation_class: ui-call

- entry_point: "ui_route:/directory/* (datasource list)"
  caller_node: "odd-platform ts react-component component:Directory/DataSourceList"
  multiplicity_per_trigger: "0 | 1"
  evidence: "Directory/DataSourceList/DataSourceList.tsx:110-114 — `showError={isError} offsetTop={210} error={error as unknown as ErrorState}`."
  observation_class: ui-call

- entry_point: "ui_route:/dataentities/:id/test-report"
  caller_node: "odd-platform ts react-component component:DataEntityDetails/TestReport"
  multiplicity_per_trigger: "0 | 1"
  evidence: "TestReport.tsx:111-115 — `showError={isDatasetTestListNotLoaded} error={datasetTestListError} offsetTop={154}`."
  observation_class: ui-call

- entry_point: "ui_route:/dataentities/:id/alerts"
  caller_node: "odd-platform ts react-component component:DataEntityDetails/DataEntityAlerts"
  multiplicity_per_trigger: "0 | 1"
  evidence: "DataEntityAlerts.tsx:88 — `<AppErrorPage showError={isAlertsNotFetched} error={alertsListError} />`."
  observation_class: ui-call

- entry_point: "ui_route:/dataentities/:id/activity"
  caller_node: "odd-platform ts react-component component:DataEntityDetails/DataEntityActivity/ActivityResults"
  multiplicity_per_trigger: "0 | 1"
  evidence: "DataEntityDetails/DataEntityActivity/ActivityResults/ActivityResults.tsx:72-76 — `showError={isActivitiesNotFetched} offsetTop={155} error={activitiesError}`."
  observation_class: ui-call

- entry_point: "ui_route:/dataentities/:id/lineage"
  caller_node: "odd-platform ts react-component component:DataEntityDetails/Lineage/HierarchyLineage"
  multiplicity_per_trigger: "0 | 1"
  evidence: "HierarchyLineage.tsx:129-133 — `showError={isLineageNotFetched} error={upstreamError || downstreamError} offsetTop={132}`."
  observation_class: ui-call

- entry_point: "ui_route:/dataentities/:id/structure"
  caller_node: "odd-platform ts react-component component:DataEntityDetails/DatasetStructure/DatasetStructureOverview"
  multiplicity_per_trigger: "0 | 1"
  evidence: "DatasetStructureOverview.tsx:97-101 — `showError={isDatasetStructureNotFetched || isDatasetStructureLatestNotFetched} error={datasetStructureFetchingError ?? datasetStructureLatestFetchingError} offsetTop={132}`."
  observation_class: ui-call

- entry_point: "ui_route:/dataentities/:id/structure/compare"
  caller_node: "odd-platform ts react-component component:DataEntityDetails/DatasetStructure/DatasetStructureCompare"
  multiplicity_per_trigger: "0 | 1"
  evidence: "DatasetStructureCompare.tsx:47-51 — `showError={isError} offsetTop={210} error={error as unknown as ErrorState}`."
  observation_class: ui-call

- entry_point: "ui_route:/terms/:id/linked-entities"
  caller_node: "odd-platform ts react-component component:Terms/TermDetails/TermLinkedEntitiesList/LinkedEntitiesList"
  multiplicity_per_trigger: "0 | 1"
  evidence: "LinkedEntitiesList.tsx:148-152 — `showError={isLinkedListNotFetched} error={linkedListFetchingError} offsetTop={194}`."
  observation_class: ui-call

- entry_point: "ui_route:/terms/:id/linked-terms"
  caller_node: "odd-platform ts react-component component:Terms/TermDetails/TermLinkedTermsList/LinkedTermsList"
  multiplicity_per_trigger: "0 | 1"
  evidence: "LinkedTermsList.tsx:85-95 — `showError={!isLinkedListFetched}` + FABRICATED error (`// FIXME` at :87): `{status: 500, statusText: error?.message ?? 'Unknown Error', url: query, message: error?.message ?? 'Unknown Error'}` from the react-query hook at :20-32. See bugs[3]."
  observation_class: ui-call

- entry_point: "ui_route:/management/* (policies detail; App.tsx:65)"
  caller_node: "odd-platform ts react-component component:Management/PolicyList/PolicyDetails"
  multiplicity_per_trigger: "0 | 1"
  evidence: "PolicyDetails.tsx:68-71 — `showError={isDetailsNotFetched || isSchemaNotFetched} error={policyDetailsFetchingError || policySchemaFetchingError}`."
  observation_class: ui-call

- entry_point: "ui_route:/management/* (integrations list)"
  caller_node: "odd-platform ts react-component component:Management/Integrations/IntegrationPreviewList"
  multiplicity_per_trigger: "0 | 1"
  evidence: "IntegrationPreviewList.tsx:70 — `<AppErrorPage showError={isError} error={error as ErrorState} offsetTop={120} />` (react-query cast)."
  observation_class: ui-call

- entry_point: "ui_route:/management/* (integration detail)"
  caller_node: "odd-platform ts react-component component:Management/Integrations/Integration"
  multiplicity_per_trigger: "0 | 1 (full-page early-return)"
  evidence: "Integration.tsx:33 — `return <AppErrorPage showError={isError} error={error} />;` — react-query error passed uncast; pre-#1760-style degraded display on this surface (bugs[2])."
  observation_class: ui-call

- entry_point: "ui_route:/management/* (associations: active)"
  caller_node: "odd-platform ts react-component component:Management/OwnerAssociations/OwnerAssociationsList/OwnerAssociationsActive"
  multiplicity_per_trigger: "0 | 1"
  evidence: "OwnerAssociationsActive.tsx:99 — `<AppErrorPage showError={isError} offsetTop={182} />` — NO error prop; 'Unknown Error' + empty code (bugs[5])."
  observation_class: ui-call

- entry_point: "ui_route:/management/* (associations: new)"
  caller_node: "odd-platform ts react-component component:Management/OwnerAssociations/OwnerAssociationsList/OwnerAssociationsNew"
  multiplicity_per_trigger: "0 | 1"
  evidence: "OwnerAssociationsNew.tsx:95 — `<AppErrorPage showError={isError} offsetTop={182} />` — NO error prop."
  observation_class: ui-call

- entry_point: "ui_route:/management/* (associations: resolved)"
  caller_node: "odd-platform ts react-component component:Management/OwnerAssociations/OwnerAssociationsList/OwnerAssociationsResolved"
  multiplicity_per_trigger: "0 | 1"
  evidence: "OwnerAssociationsResolved.tsx:103 — `<AppErrorPage showError={isError} offsetTop={182} />` — NO error prop."
  observation_class: ui-call

## downstream_side_effects

- side_effect_class: page-render
  description: "Renders the viewport-height grid: large numeric status code (errorCode variant), h1 heading (statusText or 'Unknown Error'), 'Return to the' text + 'Home Page' link. No portal, no overlay, no scroll-lock. Renders nothing when showError=false."
  evidence: "AppErrorPage.tsx:20-38"
  cardinality_per_call: "1 on showError=true, 0 on showError=false"
  reachable_from_entry_points: [
    "ui_route:/search/:searchId (page + results + deep-link fallback)",
    "ui_route:/termsearch/:termSearchId (deep-link fallback)",
    "ui_route:/dataentities/:id/* (details + 5 sub-routes)",
    "ui_route:/terms/:termId/* (details + linked-entities + linked-terms)",
    "ui_route:/alerts/*",
    "ui_route:/activity",
    "ui_route:/directory/*",
    "ui_route:/management/* (policies, integrations, associations)"
  ]

- side_effect_class: redirect-issue
  description: "On 'Home Page' click: client-side react-router push navigation to `/` (Overview). New history entry, no replace."
  evidence: "AppErrorPage.tsx:33 + Button.tsx:60-75 + Button.styles.ts:141 (`StyledLink = styled(Link)`)"
  cardinality_per_call: "0..1 — only on user click"
  reachable_from_entry_points: ["all ui_route:* entries above"]

- side_effect_class: log-emit
  description: "NONE — no console output, no analytics event, no metric; an error-page impression leaves no telemetry at this layer. (The upstream rejection MAY emit the toast — errorHandling.tsx:58-80 — and that is the thunk wrapper's side effect, not this widget's.)"
  evidence: "AppErrorPage.tsx:1-42 (no console.*, no analytics, no Sentry)"
  cardinality_per_call: 0
  reachable_from_entry_points: []

## sources

All paths repo-relative under `odd-platform/odd-platform-ui/src/` unless prefixed; line numbers verified by Read/Grep this session at commit 074c9927.

- understanding ← components/shared/elements/AppErrorPage/AppErrorPage.tsx:1-42 + lib/errorHandling.tsx:12-36 + components/Search/Search.tsx:48-100 + components/Terms/TermSearch/TermSearch.tsx:46-104 + components/App.tsx:59-95
- concepts.entities.ErrorState ← redux/interfaces/loader.ts:3-8 + lib/errorHandling.tsx:5-10
- concepts.entities.HTTP-status-code ← AppErrorPage.tsx:24-26 + theme/typography.ts:105-109
- concepts.entities.Status-text + the HTTP/2 nuance ← AppErrorPage.tsx:29-30
- concepts.entities.Unknown-Error-fallback ← AppErrorPage.tsx:30 + locales/translations/en.json:346
- concepts.entities.Home-Page-CTA ← AppErrorPage.tsx:33 + components/shared/elements/Button/Button.tsx:60-75 + Button.styles.ts:141
- concepts.entities.offsetTop ← AppErrorPage.tsx:11, 16, 21 + the 24-caller survey (values 65/120/132/154/155/182/194/210)
- concepts.operations.localise ← AppErrorPage.tsx:18, 30, 32, 33 + en.json:169, 267, 346 + Glob `**/translations/*.json` (6 bundles)
- concepts.invariants.controlled-component ← AppErrorPage.tsx:8-12
- concepts.invariants.null-on-false ← AppErrorPage.tsx:20, 38
- concepts.invariants.only-status-and-statusText ← AppErrorPage.tsx:25, 30 (full 42-line file read; no other `error` access)
- concepts.invariants.empty-string-fallback ← AppErrorPage.tsx:29-30
- concepts.invariants.not-an-error-boundary ← AppErrorPage.tsx:1-42 + Grep `ErrorBoundary|componentDidCatch|getDerivedStateFromError` over `odd-platform-ui/src` (ZERO files, 2026-06-11)
- concepts.invariants.home-link-root ← AppErrorPage.tsx:33 + App.tsx:60
- concepts.invariants.assumes-toolbar ← AppErrorPage.tsx:21 + lib/constants.ts:131 + App.tsx:56-57
- dependencies_semantic.* ← AppErrorPage.tsx:1-6 (imports) + the per-entry cites above
- dependencies_semantic.couples-to.24-callers ← Grep `AppErrorPage` over `odd-platform-ui/src` (26 files: widget + index.ts:57 re-export + 24 callers)
- tests_coverage_semantic.covered_behaviours[0] ← <odd-team>/integration-tests/e2e/specs/search-session-not-found.spec.ts:62-78, 108-122
- tests_coverage_semantic.test_files ← Glob `**/*test*` over `odd-platform-ui/src` (8 files incl. testHelpers; none reference AppErrorPage)
- docs_link_semantic.declared_docs ← AppErrorPage.tsx:1-42 (no `@docs`)
- docs_link_semantic.doc_drift_findings[0] ← WebFetch https://docs.opendatadiscovery.org/ (2026-06-11, status 200, no error-UI content) + WebFetch https://docs.opendatadiscovery.org/features (2026-06-11, status 200, no error-UI content)
- docs_link_semantic.doc_drift_findings[1] ← App.tsx:59-95 + routes/termsRoutes.ts:21-23 + routes/masterDataRoutes.ts:1-4 + Grep `path=['"]\*['"]|NotFound|Page404|404Page|NoMatch` over `odd-platform-ui/src` (ZERO matches, 2026-06-11)
- implicit_adrs[0] ← AppErrorPage.tsx:8-12 + Search.tsx:48-51, 94-100 + TermSearch.tsx:46-51, 98-104 + 24 caller files
- implicit_adrs[1] ← AppErrorPage.tsx:25, 30 + redux/interfaces/loader.ts:3-8 + lib/errorHandling.tsx:58-80 + App.tsx:55
- implicit_adrs[2] ← AppErrorPage.tsx:29-30
- bugs_limitations_corner_cases[0] ← App.tsx:59-95 + routes/termsRoutes.ts:21-23 + routes/masterDataRoutes.ts:1-4 + the catch-all grep above
- bugs_limitations_corner_cases[1] ← the error-boundary grep above + components/shared/elements/AppSuspenseWrapper/AppSuspenseWrapper.tsx:12-20 + App.tsx:30-41
- bugs_limitations_corner_cases[2] ← Directory.tsx:30-34 + Entities.tsx:60-64 + DataSourceList.tsx:110-114 + DatasetStructureCompare.tsx:47-51 + IntegrationPreviewList.tsx:70 + Integration.tsx:33 + AppErrorPage.tsx:10
- bugs_limitations_corner_cases[3] ← components/Terms/TermDetails/TermLinkedTermsList/LinkedTermsList.tsx:20-32, 85-95 + AppErrorPage.tsx:30
- bugs_limitations_corner_cases[4] ← AppErrorPage.tsx:8-12, 31-33 + components/shared/elements/SearchSessionExpired/SearchSessionExpired.tsx:35-40
- bugs_limitations_corner_cases[5] ← AppErrorPage.tsx:25, 30 + OwnerAssociationsActive.tsx:99 + OwnerAssociationsNew.tsx:95 + OwnerAssociationsResolved.tsx:103 + lib/errorHandling.tsx:14-18, 30-35, 77-79
- security.data_exposure.* ← AppErrorPage.tsx:25, 30 + lib/errorHandling.tsx:30-35, 58-80 + LinkedTermsList.tsx:88-93 + Grep `switchOffErrorMessage` over `odd-platform-ui/src/redux/thunks` (12 sites) + App.tsx:55
- security.known_security_gaps[0] ← AppErrorPage.tsx:29 (the only comment in the file) + the test-file Glob above
- security.known_security_gaps[1] ← lib/errorHandling.tsx:58-80 + App.tsx:55
- upstream_callers.* ← Grep `<AppErrorPage` with context over `odd-platform-ui/src/components` (all 24 call-sites with props captured, 2026-06-11) + Read of Search.tsx / TermSearch.tsx / LinkedTermsList.tsx + terms.thunks.ts:77-84
- downstream_side_effects.* ← AppErrorPage.tsx:20-38, 33 + Button.tsx:60-75 + Button.styles.ts:141
- stress_findings.* ← per-question evidence inline; ResponseError shape ← generated-sources/runtime.ts:260-265; loader wiring ← redux/slices/loader.slice.ts:42-48 + redux/lib/handleResponseThunk.ts:24-43
- stress_findings.probes_emitted.P-176 ← <odd-team>/lineage/odd-platform/probes/P-176.yaml:1-30 (re-read 2026-06-11; status pending-stress-protocol)
- refresh context cross-refs ← <odd-team>/issues/odd-platform/PLT-150.md:1-16 (GitHub #1760) + <odd-team>/integration-tests/protocols/IT-125-search-session-not-found.md (exists; spec read in full)

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (test-file inventory re-globbed this session; IT-125 spec read end-to-end)
- docs_link_semantic: HIGH (both doc pages re-WebFetched 2026-06-11, status 200; structural route claims re-read at 074c9927)
- implicit_adrs: HIGH (ADR[2] is anchored by a literal in-code comment; ADR[0]/[1] by 24-caller symmetry + the #1760 divert comments)
- bugs_limitations_corner_cases: HIGH (every entry anchored, incl. re-run negative greps with named search roots)
- security: HIGH (displayed-field contract verified by full-file read; the caller-subvertibility finding is anchored to LinkedTermsList.tsx:88-93)
- performance: N/A — empty arrays with reasons
- upstream_callers: HIGH (all 24 call-sites captured with props this session)
- downstream_side_effects: HIGH
- stress_findings: HIGH (33/33 questions STATIC-INFERRED; 2 minor drift flags; P-176 remains a confirmatory runtime probe, not a discovery gap)

## Maintainer notes

(empty — no prior sidecar; this is the first enrichment of this node)

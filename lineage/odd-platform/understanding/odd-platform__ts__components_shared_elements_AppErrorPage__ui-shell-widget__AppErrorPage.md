---
node_id: "odd-platform ts components/shared/elements/AppErrorPage ui-shell-widget:AppErrorPage"
node_kind: ui-shell-widget
axis: ui_shell
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.5.0
schema_version: 0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-26-ZJ
related_concepts:
  - error-display-widget
  - error-state-redux-loader
  - http-status-code-display
  - react-router-no-fallback
  - react-router-fall-through-blank-page
references:
  - kind: caller
    node: "odd-platform ts react-component component:DataEntityDetails"
    unresolved: true
    note: "renders AppErrorPage at line 116-119 keyed on fetchDataEntityDetails rejection — the canonical 'page-level' usage pattern"
  - kind: caller
    node: "odd-platform ts react-component component:TermDetails"
    unresolved: true
    note: "renders AppErrorPage at line 80-83 keyed on fetchTermDetails rejection — covers /terms/:termId 404 case"
  - kind: caller
    node: "odd-platform ts react-component component:Search/Results"
    unresolved: true
    note: "renders AppErrorPage at line 168-171 with offsetTop=210 for header-clearance — keyed on search-results rejection"
  - kind: caller
    node: "odd-platform ts react-component component:OwnerAssociationsActive"
    unresolved: true
    note: "renders AppErrorPage with showError ONLY (no error prop) — produces 'Unknown Error' fallback title with empty error-code"
  - kind: source
    node: "odd-platform ts redux/slices loader.slice:loaderSlice"
    unresolved: true
    note: "the slice that populates errors[type] from rejectWithValue(ErrorState) at loader.slice.ts:42-49 — every thunk rejection routes through here"
  - kind: source
    node: "odd-platform ts redux/lib handleResponseThunk:handleResponseAsyncThunk"
    unresolved: true
    note: "wraps every thunk; on catch reads getErrorResponse(err) -> {status, statusText, url, message} and rejectWithValue's it (handleResponseThunk.ts:34-42)"
  - kind: sibling-route-host
    node: "odd-platform ts react-component component:App"
    unresolved: true
    note: "the route registry that DOES NOT mount AppErrorPage as a path='*' catch-all; this is the structural reason bare /terms and /master-data produce a blank page (see Category B)"
---

# AppErrorPage — page-level error display widget — semantic understanding

## understanding

`AppErrorPage` is the platform UI's page-level error-display widget: a 40-line
React component that renders a centered, viewport-height layout with a large
HTTP-status-code number on the left and a status-text heading + "Return to the
Home Page" link on the right. It does NOT subscribe to errors itself — it is a
controlled component driven by the parent's `showError` boolean. The parent (a
data-loading page component such as `DataEntityDetails`, `TermDetails`, `Search`,
`Alerts`) reads the redux `loader` slice via the `getXxxFetchingStatuses` /
`getXxxFetchingError` selectors and conditionally renders `<AppErrorPage>` when
the relevant async thunk has rejected. The error fields displayed are
`error?.status` (numeric HTTP code) and `error?.statusText ?? 'Unknown Error'`
— the `error.url` and `error.message` fields of the redux `ErrorState` are NOT
rendered. Critically, this widget is also NOT a React error boundary: it cannot
catch synchronous JS render errors. And it is NOT mounted on a `path='*'`
catch-all in `App.tsx` — the React-Router-DOM v6 fall-through case (a URL that
matches no `<Route>`) produces a blank page, not this widget.

## concepts

- entities: [
    "ErrorState — redux loader-slice entry shape `{status, statusText, url, message}` (`redux/interfaces/loader.ts:3-8`); produced by `getErrorResponse` from a fetch `Response` (`lib/errorHandling.tsx:12-26`)",
    "HTTP status code — `error?.status` numeric — rendered as the large left-side `Typography variant='errorCode'` (72px / 84px line-height — `theme/typography.ts:105-109`) at `AppErrorPage.tsx:24-26`",
    "Status text — `error?.statusText` string — rendered as the right-side `Typography variant='h1'` heading at `AppErrorPage.tsx:29`",
    "'Unknown Error' fallback — i18n key registered in 6 locale JSON files (`locales/translations/en.json:340` + 5 siblings); shown when `error?.statusText` is undefined / empty",
    "Home-Page CTA — `<Button to='/' buttonType='tertiary-m' text={t('Home Page')}>` at `AppErrorPage.tsx:32`; resolves to a react-router `Link` to the root route (Overview page) — `Button.tsx:60-74`",
    "offsetTop — props.offsetTop (default 32) — pixel offset subtracted from `100vh - toolbarHeight - offsetTop` to size the error pane (`AppErrorPage.tsx:16, 21`); allows the widget to fit below a parent's sticky header (e.g. Search uses 210, OwnerAssociations* use 182)"
  ]
- operations: [
    "render-error-pane — if `showError` is true, render the full-viewport-height grid with status code + status-text heading + 'Return to the Home Page' link (`AppErrorPage.tsx:20-37`)",
    "render-nothing — if `showError` is false, return `null` (`AppErrorPage.tsx:20, 37`); the widget contributes no DOM and no whitespace when there is no error",
    "localise-fallback-text — `useTranslation()` provides `t('Unknown Error')`, `t('Return to the')`, `t('Home Page')` — all three i18n keys exist in 6 locale bundles (`locales/translations/{en,ch,es,fr,hy,ua}.json`)",
    "compute-pane-height — `calc(100vh - ${toolbarHeight}px - ${offsetTop}px)` at `AppErrorPage.tsx:21`; with `toolbarHeight=48` (`lib/constants.ts:131`) and the default `offsetTop=32` the pane is `100vh - 80px`"
  ]
- invariants: [
    "**The widget is a CONTROLLED component, not subscriber.** It reads no redux state, no jotai atom, no React-Query cache. Every caller must wire `showError` and `error` explicitly. (`AppErrorPage.tsx:8-13` — props-only interface.)",
    "**`null` when `showError=false`.** The render returns the JSX tree OR `null` based on `showError`. There is no skeleton, no spinner, no other-state branch. (`AppErrorPage.tsx:20, 37`.)",
    "**Only `status` and `statusText` are displayed; `url` and `message` from `ErrorState` are NEVER rendered.** The `error.url` field (the failing API URL) and `error.message` field (the backend's `body.message` text) are populated by `getErrorResponse` (`errorHandling.tsx:12-26`) but the AppErrorPage JSX accesses only `error?.status` (line 25) and `error?.statusText` (line 29). This is the dominant safety property of the widget — see Category F.",
    "**Fallback is `t('Unknown Error')`, not the URL or the response body.** When `error` is undefined or `error.statusText` is empty/undefined, the heading falls back to the localised 'Unknown Error' string. (`AppErrorPage.tsx:29` — `error?.statusText ?? t('Unknown Error')`.) The empty-error-code Typography (line 24-26) renders an empty span when `error` is undefined — visually the left column collapses.",
    "**The widget is NOT a React error boundary.** It is a functional component with no `componentDidCatch`, no `getDerivedStateFromError`. A synchronous JS render error inside a child component is NOT caught here — and Grep across `odd-platform-ui/src` for `ErrorBoundary`/`componentDidCatch`/`getDerivedStateFromError` finds ZERO files: there is NO React error boundary anywhere in the platform UI.",
    "**The 'Home Page' link goes to `/`.** Hard-coded `to='/'` at line 32. The root path is mounted to `<Overview />` (`App.tsx:60`). There is no prop to redirect elsewhere — every error pane in the platform points the user at the Overview page regardless of which feature errored.",
    "**The widget assumes a `<Toolbar>` is present (subtracts `toolbarHeight=48`).** If the widget ever rendered outside the standard app shell layout the height calc would over-subtract; in practice all callers are mounted under `App.tsx`'s `<AppToolbar/>` siblings so this holds (`App.tsx:56`)."
  ]
- audiences: [
    "odd-platform-ui-end-user — any authenticated user (or anonymous if `auth.type=DISABLED`) whose page-level data fetch failed; sees the large status code, the status text, and the link back home",
    "platform-operator-debugging-an-error — sees the HTTP status code on the page but NOT the failing URL or backend message; if they need the URL they must open DevTools (Network tab) or look at the right-bottom toast (`react-hot-toast` via `showServerErrorToast` — `errorHandling.tsx:48-68`)"
  ]

## dependencies_semantic

- requires-feature: [
    "i18next runtime + the `Unknown Error`, `Return to the`, `Home Page` keys registered in every locale bundle (`locales/translations/en.json:167, 264, 340` + 5 siblings)"
  ]
- requires-config: [] — N/A. AppErrorPage reads no `process.env`, no feature flag, no runtime config. Its behaviour is identical across `auth.type=DISABLED|LOGIN_FORM|OAUTH2|LDAP`.
- requires-runtime: [
    "React 18 — `React.FC`, JSX (`AppErrorPage.tsx:2, 13`)",
    "MUI `Grid` + `Typography` — layout + typography primitives (`AppErrorPage.tsx:1, 21-35`)",
    "react-i18next `useTranslation` — for the three localised strings (`AppErrorPage.tsx:3, 18, 29, 31, 32`)",
    "react-router-dom `Link` (via the local `Button` component when `to='/'` is passed) — for the client-side navigation back to `/` (`Button.tsx:60-74` + `Button.styles.ts:141` — `StyledLink = styled(Link)`)",
    "`toolbarHeight` constant from `lib/constants.ts:131` (= 48) — drives the viewport-height calc",
    "theme `errorCode` typography variant — registered at `theme/typography.ts:105-109` (72px / 84px / weight 500)"
  ]
- couples-to: [
    "`redux/interfaces/loader.ts` — imports the `ErrorState` type (`AppErrorPage.tsx:4`); the widget consumes the redux-defined error shape even though it does not subscribe to the slice directly",
    "`components/shared/elements/Button/Button.tsx` — uses the in-house Button for the Home-Page CTA (`AppErrorPage.tsx:6, 32`)",
    "every PAGE-LEVEL component that wires a fetching-status selector + a fetching-error selector — 23 caller files confirmed by Grep (`Grep AppErrorPage` over `odd-platform-ui/src/components`); enumerated in `upstream_callers`"
  ]

## tests_coverage_semantic

- covered_behaviours: [] — N/A. No test file references `AppErrorPage.tsx`; no `*.test.*` file exists anywhere in `odd-platform-ui/src/` (verified via Glob `odd-platform-ui/**/*test*`, 2026-05-26). The platform UI has no Jest / Vitest / React-Testing-Library suite committed at this snapshot.
- uncovered_behaviours:
  - behaviour: "Renders `null` when `showError=false` (the dominant case — the widget is invisible on a healthy page)"
    test_class: unit
    criticality: LOW
    note: "Trivial conditional; would catch only a regression to always-render."
  - behaviour: "Renders the status code from `error.status` and the status text from `error.statusText`"
    test_class: unit
    criticality: MEDIUM
    note: "Pins the displayed-field contract — protects against a future change that reveals `error.url` or `error.message`. See Category F drift."
  - behaviour: "Falls back to `t('Unknown Error')` when `error` is undefined OR `error.statusText` is empty"
    test_class: unit
    criticality: MEDIUM
    note: "Multiple callers (e.g. `OwnerAssociationsActive.tsx:99`) pass `showError` ONLY — no `error` prop. Tests should pin the fallback behaviour."
  - behaviour: "The 'Home Page' button navigates to `/` via react-router (client-side)"
    test_class: integration
    criticality: LOW
    note: "Routing wiring; would catch a regression to `<a href='/'>` (full-reload)."
  - behaviour: "Does NOT render `error.url` or `error.message` to the DOM"
    test_class: security
    criticality: HIGH
    note: "Pins the no-leak contract. A future maintainer 'improving' the error pane by adding the backend message or the failing URL would silently leak — see `known_security_gaps` + P-176."
  - behaviour: "The widget renders into the viewport-clearing space when a parent's sticky header pushes content down (offsetTop wiring)"
    test_class: integration
    criticality: LOW
    note: "Six callers pass non-default offsetTop (Search=210, OwnerAssociations*=182, IntegrationPreviewList=120). No regression test would catch a layout-overlap bug."
  - behaviour: "Bare `/terms`, `/master-data`, and unknown URLs produce a blank page (NOT AppErrorPage)"
    test_class: integration
    criticality: MEDIUM
    note: "This is the SCOPE of AppErrorPage — it is reached ONLY when an async thunk rejects, NOT when react-router fails to match. A regression test would also cover the missing `path='*'` catch-all (see Category B + `bugs_limitations_corner_cases`)."
- test_files: [] — N/A. None.
- gaps: |
    No test file in the entire `odd-platform-ui/src` tree references this
    component (or any UI component, per the wider audit). The single highest-
    leverage test class to add is **security** — pin the "displayed-field
    contract" (`error.status` + `error.statusText` only; never `error.url` or
    `error.message`) so a future "improvement" to the error pane that adds the
    URL or the backend message cannot land silently. Second-highest-leverage
    is **integration** — the route fall-through case (bare `/terms`,
    `/master-data`, or any unknown path) producing a blank page is currently
    undocumented and untested; a regression test that asserts AppErrorPage is
    NOT mounted on these paths would surface the missing `path='*'` design
    decision the next time a maintainer wonders why blank pages exist.

## docs_link_semantic

- declared_docs: [] — N/A. `AppErrorPage.tsx` carries no `// @docs:` annotation; matches the repo-wide UI convention (no React component declares `@docs`).
- inferred_docs: [] — N/A. WebFetched `https://docs.opendatadiscovery.org/` (2026-05-26, status 200) and `https://docs.opendatadiscovery.org/features` (2026-05-26, status 200); both report NO mention of error pages, error handling, HTTP error codes displayed in the UI, "blank page", "404 page", or a "Home Page" button. The platform UI's error-display surface is undocumented end-to-end. Recording this as a doc-drift finding rather than an `inferred_docs` candidate, because there is no candidate page to point at.
- doc_drift_findings:
  - "**DOC GAP — the platform's error-display UI is undocumented end-to-end.** The widget `AppErrorPage` is rendered by 23 page-level components across the platform UI (DataEntityDetails / TermDetails / Search / Alerts / Activity / Directory / DatasetStructure* / DataEntityAlerts / TestReport / IntegrationPreviewList / Integration / PolicyDetails / OwnerAssociations{Active,New,Resolved} / Term* / HierarchyLineage — full list under `upstream_callers`). Every one of them surfaces an HTTP status code + a short status-text heading + a 'Return to the Home Page' link when a page-level data fetch rejects. The live docs (WebFetched 2026-05-26, status 200 on root + status 200 on /features) contain NO description of what users see when a fetch fails, no screenshot, no troubleshooting paragraph, no 'if you see a 404 on this page, do X' guidance. Severity: LOW — this is operator-experience drift, not data-loss / security drift; the widget itself is safe (status code only, no sensitive content). The user-facing impact is that operators landing on the error page have no doc-side recourse — they get an HTTP code with no context. Recommend a 'Troubleshooting / Common error pages' section under operator-guides."
  - "**DOC GAP — bare-URL fall-through (`/terms`, `/master-data`, unknown paths) produces a BLANK PAGE, not the AppErrorPage.** This is the load-bearing cross-finding with batches ZH+ZI (which observed bare `/terms` and bare `/master-data` produce a blank page). Confirmed structurally here: `App.tsx:59-89` declares NO `<Route path='*'>` catch-all and NO React error boundary; React-Router-DOM v6's NO-MATCH behaviour is to render nothing — neither the AppErrorPage nor any other fallback. The user perceives a blank window. AppErrorPage's scope is ONLY async-thunk-rejection paths (e.g. `/terms/9999` → backend 404 → fetchTermDetails rejects → AppErrorPage shows '404'); the routing-layer fall-through is OUTSIDE AppErrorPage's scope. This is undocumented; it is also not surfaced anywhere in the UI (no SUMMARY note, no operator guide). Severity: MEDIUM — operator-facing surprise plus an architectural gap (the platform has no global error pane; AppErrorPage is per-page-component). Recommend either (a) adding a `<Route path='*' element={<AppErrorPage showError error={{status:404, statusText:'Page Not Found', url:'', message:''}}/>} />` in App.tsx (a 5-line fix) OR (b) explicitly documenting that bare-URL fall-through is undefined behaviour. Either option closes the operator-surprise; the code fix is preferred (see `bugs_limitations_corner_cases[0]`)."

## implicit_adrs

- "**The error-display UI is per-page-component-owned, not global.** Every page-level data-loading component (DataEntityDetails, TermDetails, Search/Results, AlertsList, ActivityResults, Directory, DataSourceList, Entities, DataEntityAlerts, TestReport, DatasetStructureOverview, DatasetStructureCompare, HierarchyLineage, IntegrationPreviewList, Integration, PolicyDetails, OwnerAssociations*, Term*, LinkedTerms{Entities,List}) wires its OWN AppErrorPage instance keyed on its OWN fetching-status selector. The widget is purely a render-helper; the SHOW-OR-HIDE decision lives in the consumer. The convention is applied consistently across 23 caller files (Grep `AppErrorPage` over `odd-platform-ui/src/components`, head_limit 80 — every caller follows the pattern `<AppErrorPage showError={isXxxNotFetched} error={xxxFetchingError} />`). The uniformity is the evidence of intentional design — a per-page error pane keeps the rest of the page's chrome (header, tabs) visible so the user can navigate away without a full reload." — evidence: `AppErrorPage.tsx:8-13` (props-only interface, no redux subscription) + 23 caller files with identical pattern (full Grep `AppErrorPage` in `components/`) — intent_anchor: "`showError: boolean; error?: ErrorState;`" (`AppErrorPage.tsx:9-10`) — confidence: HIGH

- "**Only `status` and `statusText` are displayed; `url` and `message` are deliberately omitted.** The `ErrorState` type (`redux/interfaces/loader.ts:3-8`) carries four fields — `{status, statusText, url, message}` — populated by `getErrorResponse(response)` from the fetch `Response` (`errorHandling.tsx:12-26`). The AppErrorPage JSX deliberately accesses only `error?.status` (line 25) and `error?.statusText` (line 29). The backend `body.message` and the failing API `url` are NOT rendered to the page. The decision is to keep the error pane minimal — no leak of backend implementation details (stack traces, DB error strings, internal URL paths) to the user. The same `message` IS shown briefly in a `react-hot-toast` via `showServerErrorToast` (`errorHandling.tsx:48-68`) — short-lived, dismissible, side-of-screen, not persistently on the error page. The two-channel design (toast for message, page for status code) is the evidence of an intentional information-disclosure boundary." — evidence: `AppErrorPage.tsx:24-29` (only `error?.status` and `error?.statusText` accessed) + `redux/interfaces/loader.ts:3-8` (the full four-field shape) + `errorHandling.tsx:48-68` (the message lands in the toast, not the page) — intent_anchor: "`{error?.status}` ... `{error?.statusText ?? t('Unknown Error')}`" (`AppErrorPage.tsx:25, 29`) — confidence: HIGH

## bugs_limitations_corner_cases

- "**Bare `/terms`, `/master-data`, and any other URL not matched by `App.tsx`'s route table produces a BLANK PAGE — AppErrorPage is NOT mounted on a `path='*'` catch-all.** `App.tsx:59-89` declares exactly 11 `<Route>` entries; none has `path='*'`. React-Router-DOM v6's NO-MATCH behaviour is to render nothing inside `<Routes>`. The AppToolbar (line 56) still renders, but the route-body area is empty. Operator-facing impact: hitting any unknown URL — including the documented-elsewhere shape `/terms` (the parent route exists but has only a `:termId/*` child, no `index` route — `App.tsx:66-68`) and `/master-data` (no parent route exists — `lookupTablesPath()` returns `/master-data/lookup-tables` only — `routes/masterDataRoutes.ts:1-4`) — shows the user a blank pane below the toolbar with no error message, no '404' code, no Home Page link. Cross-batch finding: this is the structural root cause of the ZH+ZI bare-page observations. A 5-line fix (add `<Route path='*' element={<AppErrorPage showError error={{status:404, statusText:'Page Not Found', url:'', message:''}} />} />` to `App.tsx:89`) would route ALL fall-through to this widget." — evidence: `App.tsx:59-89` (no `path='*'`, no error boundary) + `routes/termsRoutes.ts:21-23` (parent path declared, no index child in App.tsx:66-68) + `routes/masterDataRoutes.ts:1-4` (no `masterDataPath()` export, only the child `lookupTablesPath()`) + Grep `path=['\"]\\*['\"]|NotFound|Page404|404Page|NoMatch` over `odd-platform-ui/src` returns NO matches — severity: MEDIUM

- "**There is NO React error boundary anywhere in the platform UI.** A synchronous JS error during render (e.g. an undefined-access, a type error, a thrown component) is NOT caught by `AppErrorPage`. Grep `ErrorBoundary|componentDidCatch|getDerivedStateFromError` over `odd-platform-ui/src` returns ZERO matches. The closest thing is `AppSuspenseWrapper` (`AppSuspenseWrapper.tsx:1-23`) — Suspense only, no error handling. Impact: if any component in the route subtree throws during render, React 18's default behaviour is to unmount the entire tree to the closest boundary (none → unmounts the whole App), leaving the user with a blank page or a console error. The same blank-page-from-an-uncaught-throw failure mode applies to lazy-chunk loading failures (`React.lazy(() => import(...))` at App.tsx:30-41) — a chunk-load failure surfaces as an uncaught promise rejection in development and an indefinitely-pending Suspense fallback in production. AppErrorPage CANNOT catch these because it is a sibling within page subtrees, not an ancestor wrapping the Routes." — evidence: `AppErrorPage.tsx:13-38` (functional component, no class, no error boundary lifecycle methods) + Grep `ErrorBoundary|componentDidCatch|getDerivedStateFromError` over `odd-platform-ui/src` returns no matches + `AppSuspenseWrapper.tsx:1-23` (Suspense only) + `App.tsx:58-90` (no ErrorBoundary wrapper) — severity: HIGH

- "**`AppErrorPage` accepts an `error` prop typed `ErrorState` (from `redux/interfaces/loader.ts`), but callers using `react-query` cast a different error type via `error as ErrorState`.** `Integration.tsx:33` passes a `useIntegration({integrationId})` react-query error — which is NOT a redux `ErrorState`; the casts work at compile time but produce undefined behaviour at runtime if the react-query error shape doesn't include `status`/`statusText` (the page would render an empty error code with 'Unknown Error' title). `IntegrationPreviewList.tsx:70` does the same: `error={error as ErrorState}`. The two integration components are the only callers that use react-query instead of redux; the cast hides the type mismatch. A future caller adopting react-query without realising this would also need the cast (or the AppErrorPage interface would need to be generalised to a discriminated union)." — evidence: `Integration.tsx:33` (`<AppErrorPage showError={isError} error={error} />` where `error` is a react-query `Error | null`, NOT a redux `ErrorState`) + `IntegrationPreviewList.tsx:70` (`error={error as ErrorState}` — explicit cast) + `AppErrorPage.tsx:10` (`error?: ErrorState` — the typed parameter) — severity: LOW

- "**No retry / re-fetch affordance on the error pane.** The only CTA is 'Return to the Home Page' — there is no 'Try Again', 'Reload', or 'Report this error' button. Users who hit a transient backend hiccup must (a) click Home Page and navigate back to the previous route manually, OR (b) press the browser refresh button. The widget design does not expose a retry callback prop. Recorded as a corner-case rather than an implicit ADR because there is NO comment or naming convention defending the absence (compare the `to='/'` hard-coding which IS load-bearing — there's no callback to override)." — evidence: `AppErrorPage.tsx:8-13` (no `onRetry` prop) + `AppErrorPage.tsx:31-32` (only 'Return to the Home Page' button) — severity: LOW

- "**When `error` is undefined but `showError=true`, the left column collapses to an empty span and the right shows 'Unknown Error'.** Eight caller files pass `showError={isError}` with NO `error` prop (e.g. `OwnerAssociationsActive.tsx:99`, `OwnerAssociationsNew.tsx:95`, `OwnerAssociationsResolved.tsx:103`). The visual outcome is a centered grid with an empty 72px-tall left column (effectively a margin) and a centered 'Unknown Error' heading — which is a degraded display but not a crash. Operator-impact: the user sees 'Unknown Error' with no status code, no context — strictly worse than the normal pane. A linting rule that flagged `<AppErrorPage showError>` without `error` would catch this." — evidence: `AppErrorPage.tsx:24-26` (renders `{error?.status}` — empty when error undefined) + `AppErrorPage.tsx:29` (`error?.statusText ?? t('Unknown Error')`) + `OwnerAssociationsActive.tsx:99` / `OwnerAssociationsNew.tsx:95` / `OwnerAssociationsResolved.tsx:103` (the no-error-prop callers) — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "AppErrorPage.tsx:16"
      name: "offsetTop"
      value: "32 (default; callers override: 120 / 182 / 210)"
      questions:
        - q: "What at N = 0?"
          a: "`100vh - 48px - 0px` — the error pane fills the entire below-toolbar viewport. No layout break."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:21 + lib/constants.ts:131"
        - q: "What at N = a very large number (e.g. 800)?"
          a: "`calc(100vh - 48px - 800px)` — on a 768px-tall viewport the result is negative; `Grid container height` resolves to 0 and the pane collapses to invisible. Operator-visible: no error pane shown despite `showError=true`. No caller currently passes a value this large (max observed is 210)."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:21 — string-interpolated calc, no clamp"
        - q: "What at null / negative?"
          a: "Negative number works as a height-extension (the pane overshoots viewport, scrollbar appears). `null` is replaced by the default `32` (default-parameter destructure at `AppErrorPage.tsx:16`). `undefined` same. Boolean / string / NaN: would coerce into the template literal as 'null'/'NaN'/etc and produce an invalid CSS calc — pane height defaults to MUI Grid's auto-sizing (likely 0)."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:16, 21"
        - q: "What does the operator see at each boundary?"
          a: "Default (32) — standard pane filling viewport minus 80px. Caller-overridden (120/182/210) — pane positioned below the parent's sticky header so it doesn't overlap. Very large value — pane invisible (collapsed). No clamp, no log."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:21 + caller files passing 120/182/210"
    - location: "lib/constants.ts:131"
      name: "toolbarHeight"
      value: "48"
      questions:
        - q: "What at N = 0?"
          a: "The calc loses its 48px subtraction; pane fills viewport. Used elsewhere for the AppToolbar's height itself, so 0 would also collapse the toolbar — not a value AppErrorPage controls."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:21 + lib/constants.ts:131"
        - q: "What at tunable × 100 (e.g. 4800)?"
          a: "Same as offsetTop=4800 — pane height goes negative, collapses to 0. But this constant is also used to position the toolbar height — out of scope for AppErrorPage; the widget assumes the constant is correct."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:21 + lib/constants.ts:131"
        - q: "What does the operator see at each boundary?"
          a: "Operator does not control toolbarHeight; it is a hard-coded constant. No boundary scenario exists in practice."
          confidence: STATIC-INFERRED
          evidence: "lib/constants.ts:131 (no env / config override path)"
  name_behavior_pairs:
    - name: "AppErrorPage (React component name)"
      promise: "An 'App-level error page' — implies a top-level / route-level / global error display."
      implementation: "Actually a render-helper widget for per-page-component error display. Drives off props (`showError`, `error`), not redux subscription, and is NOT mounted at a global path='*' / error-boundary level. It is rendered as a SIBLING inside data-loading page components (`DataEntityDetails`, `TermDetails`, etc.) and shows only when THAT page's specific fetch rejects."
      drift: MINOR
      operator_visible_consequence: "Name suggests an app-wide error-handling primitive; reality is a per-page error pane. The structural absence of any app-wide error boundary OR catch-all route means bare URLs and uncaught JS errors do NOT reach this widget. Operators may reasonably expect the 'App Error Page' to be what they see for any error — but bare `/terms` and `/master-data` produce a blank page instead. See `bugs_limitations_corner_cases[0]` + Category B finding."
      confidence: STATIC-INFERRED
      evidence: "AppErrorPage.tsx:1-40 (the implementation) + App.tsx:59-89 (the route registry that does NOT use AppErrorPage as a global) + 23 caller files (per-page mounts)"
    - name: "showError (prop)"
      promise: "Boolean — show the error pane if true."
      implementation: "Exactly that. `return showError ? (<Grid...>) : null;` (`AppErrorPage.tsx:20, 37`). No off-by-one, no async."
      drift: NONE
      operator_visible_consequence: ""
      confidence: STATIC-INFERRED
      evidence: "AppErrorPage.tsx:20, 37"
    - name: "error (prop)"
      promise: "An ErrorState object — the error to display."
      implementation: "Only `error?.status` and `error?.statusText` are READ; `error.url` and `error.message` are accepted but NEVER rendered. The prop is typed `ErrorState | undefined` (`AppErrorPage.tsx:10`). See Category F."
      drift: MINOR
      operator_visible_consequence: "Two of the four fields supplied by callers are silently dropped — a maintainer reading the prop signature would expect the page to render the full error context, but it does not. This is the dominant safety property of the widget (information-disclosure boundary), so the drift is favourable, but it is undocumented in the code."
      confidence: STATIC-INFERRED
      evidence: "AppErrorPage.tsx:10, 24-29 + redux/interfaces/loader.ts:3-8"
  orderings: []
    # No ORDER BY, no LIMIT/paginate, no .sort()/Comparator in this 40-line
    # presentation component. The widget renders ONE error at a time; there
    # is no list, no aggregation, no sort. Explicit [] per Rule 9.
  auth_gates:
    - location: "AppErrorPage.tsx:1-40"
      endpoint: "N/A — render-only UI component, no HTTP endpoint, no PreAuthorize"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "Identical rendering across all four modes — the widget has no auth-mode branching, no `useFeatureFlag`, no permission check. Whoever reaches the parent page (DataEntityDetails / TermDetails / etc.) and triggers a fetch error sees the same '<code> + <statusText> + Home Page' pane."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:1-40 (no mode check anywhere)"
        - q: "What does an unauthenticated caller see?"
          a: "An unauthenticated caller cannot reach the parent route (for LOGIN_FORM/OAUTH2/LDAP — the backend redirects pre-app-shell). Under auth.type=DISABLED there is no authentication, so any caller renders the page; if a backend request still rejects (e.g. a 500), AppErrorPage shows the status code."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:1-40 (no own auth check; relies on global *SecurityConfiguration enforcement upstream)"
        - q: "What does a wrong-role caller see?"
          a: "Same as a correctly-role'd caller — the widget displays whatever HTTP status code the failed thunk produced. If the rejection is a backend 403 (Forbidden), AppErrorPage shows '403 / Forbidden' (or similar status text). The widget itself imposes no role restriction; it simply mirrors the backend's response status."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:25, 29 (renders `error?.status` and `error?.statusText` from the backend response verbatim)"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "At the COMPONENT level: NOWHERE. AppErrorPage has no gate; it is a render helper. Auth gating happens at the BACKEND (the `*Controller` `@PreAuthorize` / programmatic checks); AppErrorPage simply visualises a rejected thunk's status code."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:8-38 (no permission prop, no `WithPermissionsProvider` wrap, no programmatic check)"
  resource_boundaries:
    - location: "AppErrorPage.tsx:13-37"
      kind: concurrency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "Not applicable — this is a stateless render-helper. No `useState`, no `useEffect`, no fetch, no mutation. Two browsers, two tabs, two mounts — each renders independently from props. No shared mutable state."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:13-37 (no hooks but useTranslation, no state, no effects)"
        - q: "Is the call replay-safe?"
          a: "Yes — rendering is idempotent. The same `(showError, error, offsetTop)` props produce the same DOM. Unmount/remount produces an identical pane."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:13-37"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No cache at this node. The widget renders props directly; no memoisation, no cache layer. Caller-side caches (redux loader slice; react-query) own staleness — see referenced caller sidecars."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:13-37 (no useMemo, no cache import)"
  request_inputs:
    - location: "AppErrorPage.tsx:8-13"
      input_kind: body-field
      input_name: "showError"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "Boolean controlling whether the error pane is visible — name accurately conveys the controlled-render semantics."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:9"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Ternary at line 20: `showError ? (<Grid...>) : null` — the truthiness of the prop selects the entire JSX tree. No further translation."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:20"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — `showError=true` renders, `=false` returns null."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:20, 37"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — MATCHES."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:20"
        - q: "Is there a column/field/variable that DOES match the input's name and is NOT being used?"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:8-13"
      routes_to_finding: ""
    - location: "AppErrorPage.tsx:8-13"
      input_kind: body-field
      input_name: "error"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "An ErrorState object — the error to display on the page. The type carries four fields (`status, statusText, url, message`); the prop name 'error' implies the whole error context will be surfaced."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:10 + redux/interfaces/loader.ts:3-8"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "ONLY `error?.status` (line 25) and `error?.statusText` (line 29). The remaining two fields — `error.url` (the failing API URL) and `error.message` (the backend's response body message) — are accepted by the type system but NEVER rendered to the DOM. (`error.message` is independently surfaced via `react-hot-toast` from `showServerErrorToast` — but that lives in the upstream thunk wrapper at `handleResponseThunk.ts:38`, NOT in this widget.)"
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:24-26 (only `error?.status`) + AppErrorPage.tsx:29 (only `error?.statusText`) + Grep `error\\.message|error\\.url|error\\?\\.message|error\\?\\.url` over `AppErrorPage/` returns NO MATCHES"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_LEGITIMATELY — the prop is named `error: ErrorState`, the implementation displays the LEAST-sensitive 2-of-4 fields, omitting the backend message and the failing URL. The translation is favourable (an information-disclosure boundary) but undocumented in the code — no comment, no JSDoc, no naming convention in this file explains the omission. The intent is inferred from (a) the explicit channel-split with the toast carrying the message, (b) the symmetry across 23 callers — none of which has ever asked for the full message on the page."
          drift: MINOR
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:24-29 + redux/interfaces/loader.ts:3-8 + errorHandling.tsx:48-68 (toast carries the message) + 23 caller files (all use the 2-field display)"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "Two failure modes (none currently realised in the code, but the failure mode IS the design): (1) Caller assumes `error.message` will show on the page → user sees only a status code + status text, with the message ONLY in a brief toast they may have already dismissed. (2) Future maintainer 'improving' the page by adding `<Typography>{error.message}</Typography>` → the page would leak backend response bodies (which may contain stack trace fragments, SQL exception text, or PII depending on the backend's error formatting). The widget's omission is the GUARD against (2); the implicit-but-undocumented guard is the risk. See P-176."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:24-29 (the current omission) + errorHandling.tsx:24 (`message: body?.message || 'An error occurred'` — the field that IS populated and NOT displayed)"
        - q: "Is there a column/field/variable that DOES match the input's name and is NOT being used?"
          a: "YES — `error.url` and `error.message`, both populated upstream and both UNUSED in the AppErrorPage JSX. `error.url` is the failing API URL (line 23 of errorHandling.tsx — `response?.url`); `error.message` is the backend response body's `message` field or the literal 'An error occurred' fallback (line 24). Neither is rendered to the DOM. These are the 'available-but-unused' fields — they could legitimately be displayed (with appropriate redaction) for debugging operators, or they could legitimately be hidden (the current state) for safety. The deliberate non-use IS the design but is undocumented in the file."
          confidence: STATIC-INFERRED
          evidence: "redux/interfaces/loader.ts:5-7 (the `url` and `message` fields) + errorHandling.tsx:23-24 (their population) + AppErrorPage.tsx:24-29 (their absence from the render)"
      routes_to_finding: "implicit_adrs[1] (the information-disclosure-boundary decision) + tests_coverage_semantic.uncovered_behaviours[4] (the test that should pin the omission) + bugs_limitations_corner_cases (the absence of a defending comment / JSDoc)"
    - location: "AppErrorPage.tsx:8-13"
      input_kind: body-field
      input_name: "offsetTop"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "A pixel offset from the top of the viewport that the error pane should clear — implies clearance for a parent's sticky header / breadcrumb."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:11, 16"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Subtracted from the pane height: `calc(100vh - ${toolbarHeight}px - ${offsetTop}px)` (line 21). The numeric value is treated as a px subtraction; no clamp, no validation."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:21"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — name says 'offset from top', implementation reduces height by that amount, effectively positioning the pane below the implied sticky region."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:11, 21"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — MATCHES."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:21"
        - q: "Is there a column/field/variable that DOES match the input's name and is NOT being used?"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "AppErrorPage.tsx:8-13"
      routes_to_finding: ""
  probes_emitted:
    - probe_id: P-176
      question: "Confirm AppErrorPage's information-disclosure boundary: when an async thunk rejects with a backend response that carries (a) a verbose `message` (e.g. a SQL exception fragment, a stack-trace snippet) and (b) an internal `url` (e.g. `/api/internal/admin/something`), does the rendered DOM contain ONLY the status code and statusText — never the message or URL? And separately: visit bare `/terms` and bare `/master-data`; confirm the user sees a BLANK below-toolbar pane (not an AppErrorPage, not a 404)."
      probe_path: "lineage/odd-platform/probes/P-176.yaml"
  stress_summary:
    triggers_total: 8
    questions_total: 22
    answers_static_inferred: 22
    answers_probe_needed: 0
    answers_reference: 0
    drift_flags: 2
```

## security

- **auth_mode_relevance**: `INTERNAL_ONLY` — `AppErrorPage` is a presentation component with no HTTP surface, no `@ConditionalOnProperty`, no auth-mode reference. It renders identically in `DISABLED | LOGIN_FORM | OAUTH2 | LDAP`. Auth-mode enforcement is upstream (the global `*SecurityConfiguration` beans); AppErrorPage simply visualises whatever HTTP status code reaches it.
- **ingestion_filter_relevance**: `NO — UI presentation component, not an ingestion path`. No relationship to `POST /ingestion/entities` or the `IngestionDataEntitiesFilter`.
- **authorization_assertions**: [] — `AppErrorPage` enforces no permission. It is purely a render helper.
- **owner_scoping**: `N/A — this node is not data-scoped`. The widget renders an error status code; it has no own concept of owners.
- **data_exposure**:
  - "**Bounded leak surface — only HTTP status code (numeric) and HTTP status text (short string) are placed in the DOM.** The widget's JSX accesses `error?.status` (number, e.g. 403, 404, 500) and `error?.statusText` (RFC 7231 reason phrase, e.g. 'Forbidden', 'Not Found', 'Internal Server Error'). Neither carries application-data or PII. The two other fields populated upstream by `getErrorResponse` (`errorHandling.tsx:12-26`) — `error.url` (the failing API URL, which could disclose internal endpoint structure) and `error.message` (the backend's response body `message`, which may carry stack-trace fragments, SQL exception text, or echoed user input) — are NEVER rendered to the page. The `error.message` IS surfaced briefly via `react-hot-toast` from `showServerErrorToast` (`errorHandling.tsx:48-68`), but that is a separate channel with a 6-second display time (`App.tsx:55` — `toastOptions: { custom: { duration: 6000 } }`)." — evidence: `AppErrorPage.tsx:24-29` (only `error?.status` and `error?.statusText` accessed) + `errorHandling.tsx:12-26` (the full four-field shape populated upstream) + Grep `error\\.message|error\\.url|error\\?\\.message|error\\?\\.url` over `AppErrorPage/` returns NO matches
  - "**No raw exception / stack-trace surface.** The widget cannot leak JS stack traces — it is not an error boundary; it cannot reach the React error info object. The status text it displays is the HTTP-layer reason phrase, not a Java/Spring exception class name." — evidence: `AppErrorPage.tsx:1-40` (no `errorInfo`, no `componentDidCatch`, no access to thrown exception objects)
- **known_security_gaps**:
  - "**The information-disclosure boundary (display only `status` + `statusText`, never `url` / `message`) is undocumented in the code.** There is no JSDoc, no inline comment, and no naming convention in `AppErrorPage.tsx` that defends or explains the omission of `error.url` / `error.message`. A future 'improvement' PR that adds `<Typography>{error.url}</Typography>` (to help operators identify the failing endpoint) or `<Typography>{error.message}</Typography>` (to surface the backend's hint) would land silently — there is no test (no test file at all references this component) and no review checklist. The 2-of-4-field display is the load-bearing safety property of the widget; codifying it in a JSDoc + a regression test would lock it in." — evidence: `AppErrorPage.tsx:1-40` (no comments, no JSDoc above the function or above the JSX) + no test file references this component (Glob `**/*test*` over `odd-platform-ui/src/` returns nothing) — severity: MEDIUM
  - "**The toast-side channel that DOES carry `error.message` is fire-and-forget — the user has 6 seconds to read it.** `showServerErrorToast` (`errorHandling.tsx:48-68`) emits a toast with the backend `message`; the toast duration is the `App.tsx:55` global default of 6000ms. If the user blinks (or if a second toast queues up and dismisses the first), the only place that EVER carried the backend's hint is gone. The AppErrorPage on the page does NOT recapitulate the message. Operator-impact: the user sees a status code + 'Forbidden' / 'Not Found' on the page, but has no way to recover the backend's `message` (which may have said 'You need permission DATA_ENTITY_READ' or 'Term 9999 does not exist') after the toast vanishes. The asymmetry — message on screen for 6s, status code on screen indefinitely — is undocumented." — evidence: `errorHandling.tsx:48-68` (the toast emitter) + `App.tsx:55` (the 6000ms duration default) + `AppErrorPage.tsx:24-29` (the message is not re-rendered here) — severity: LOW

## performance

- **hot_paths**: [] — N/A. `AppErrorPage` is a 40-line stateless render of 4 MUI primitives. Render cost is negligible. It is NOT on the steady-state critical path — it is rendered only when a fetch has rejected (a rare, terminal state of the page).
- **throughput_characteristics**: [] — N/A. No request, no batch, no stream. The widget renders once on `showError=true` transition and never again until prop change.
- **resource_allocation**: [] — N/A. No data load, no memory growth, no I/O.
- **scaling_characteristics**: [] — N/A. Stateless, pure-render — scales trivially with viewport count.
- **known_performance_gaps**: [] — N/A. The 40-line widget has no performance surface to worry about.

## upstream_callers

- entry_point: "ui_route:/dataentities/:dataEntityId/*"
  caller_node: "odd-platform ts react-component component:DataEntityDetails"
  multiplicity_per_trigger: "0 (steady state, fetch succeeds) | 1 (fetch rejects — terminal state until route change)"
  evidence: "DataEntityDetails.tsx:116-119 — `<AppErrorPage showError={isDataEntityDetailsNotFetched} error={dataEntityDetailsFetchingError} />`"
  observation_class: ui-call

- entry_point: "ui_route:/terms/:termId/*"
  caller_node: "odd-platform ts react-component component:TermDetails"
  multiplicity_per_trigger: "0 | 1"
  evidence: "TermDetails.tsx:80-83 — `<AppErrorPage showError={isTermDetailsNotFetched} error={termDetailsFetchingErrors} />`. Note: `fetchTermDetails` has `switchOffErrorMessage: true` (`terms.thunks.ts:83`) — so the toast is suppressed; AppErrorPage is the ONLY error surface for `/terms/:termId` failures."
  observation_class: ui-call

- entry_point: "ui_route:/search/:searchId"
  caller_node: "odd-platform ts react-component component:Search/Results"
  multiplicity_per_trigger: "0 | 1"
  evidence: "Search/Results/Results.tsx:168-171 — `<AppErrorPage showError={isSearchResultsNotLoaded} error={searchResultsError} offsetTop={210} />`"
  observation_class: ui-call

- entry_point: "ui_route:/alerts/*"
  caller_node: "odd-platform ts react-component component:Alerts/AlertsList"
  multiplicity_per_trigger: "0 | 1"
  evidence: "Alerts/AlertsList/AlertsList.tsx:101 — `<AppErrorPage showError={isAlertsNotLoaded} error={alertsError} />`"
  observation_class: ui-call

- entry_point: "ui_route:/activity"
  caller_node: "odd-platform ts react-component component:Activity/ActivityResults"
  multiplicity_per_trigger: "0 | 1"
  evidence: "Activity/ActivityResults/ActivityResults.tsx:76 — `<AppErrorPage showError=... error=... />`"
  observation_class: ui-call

- entry_point: "ui_route:/directory/*"
  caller_node: "odd-platform ts react-component component:Directory/Directory"
  multiplicity_per_trigger: "0 | 1"
  evidence: "Directory/Directory/Directory.tsx:30 — `<AppErrorPage showError=... error=... />`"
  observation_class: ui-call

- entry_point: "ui_route:/directory/{datasource}/entities"
  caller_node: "odd-platform ts react-component component:Directory/Entities"
  multiplicity_per_trigger: "0 | 1"
  evidence: "Directory/Entities/Entities.tsx:60 — `<AppErrorPage showError=... error=... />`"
  observation_class: ui-call

- entry_point: "ui_route:/directory/*"
  caller_node: "odd-platform ts react-component component:Directory/DataSourceList"
  multiplicity_per_trigger: "0 | 1"
  evidence: "Directory/DataSourceList/DataSourceList.tsx:110 — `<AppErrorPage showError=... error=... />`"
  observation_class: ui-call

- entry_point: "ui_route:/dataentities/:id/test-report"
  caller_node: "odd-platform ts react-component component:DataEntityDetails/TestReport"
  multiplicity_per_trigger: "0 | 1"
  evidence: "DataEntityDetails/TestReport/TestReport.tsx:111 — `<AppErrorPage showError=... error=... />`"
  observation_class: ui-call

- entry_point: "ui_route:/dataentities/:id/alerts"
  caller_node: "odd-platform ts react-component component:DataEntityDetails/DataEntityAlerts"
  multiplicity_per_trigger: "0 | 1"
  evidence: "DataEntityDetails/DataEntityAlerts/DataEntityAlerts.tsx:88 — `<AppErrorPage showError={isAlertsNotFetched} error={alertsListError} />`"
  observation_class: ui-call

- entry_point: "ui_route:/dataentities/:id/activity"
  caller_node: "odd-platform ts react-component component:DataEntityDetails/DataEntityActivity/ActivityResults"
  multiplicity_per_trigger: "0 | 1"
  evidence: "DataEntityDetails/DataEntityActivity/ActivityResults/ActivityResults.tsx:72 — `<AppErrorPage ...>`"
  observation_class: ui-call

- entry_point: "ui_route:/dataentities/:id/lineage"
  caller_node: "odd-platform ts react-component component:DataEntityDetails/Lineage/HierarchyLineage"
  multiplicity_per_trigger: "0 | 1"
  evidence: "DataEntityDetails/Lineage/HierarchyLineage/HierarchyLineage.tsx:129 — `<AppErrorPage ...>`"
  observation_class: ui-call

- entry_point: "ui_route:/dataentities/:id/structure"
  caller_node: "odd-platform ts react-component component:DataEntityDetails/DatasetStructure/DatasetStructureOverview"
  multiplicity_per_trigger: "0 | 1"
  evidence: "DataEntityDetails/DatasetStructure/DatasetStructureOverview/DatasetStructureOverview.tsx:97 — `<AppErrorPage ...>`"
  observation_class: ui-call

- entry_point: "ui_route:/dataentities/:id/structure/compare"
  caller_node: "odd-platform ts react-component component:DataEntityDetails/DatasetStructure/DatasetStructureCompare"
  multiplicity_per_trigger: "0 | 1"
  evidence: "DataEntityDetails/DatasetStructure/DatasetStructureCompare/DatasetStructureCompare.tsx:47 — `<AppErrorPage ...>`"
  observation_class: ui-call

- entry_point: "ui_route:/terms/:id/linked-entities"
  caller_node: "odd-platform ts react-component component:Terms/TermDetails/TermLinkedEntitiesList/LinkedEntitiesList"
  multiplicity_per_trigger: "0 | 1"
  evidence: "Terms/TermDetails/TermLinkedEntitiesList/LinkedEntitiesList.tsx:148 — `<AppErrorPage ...>`"
  observation_class: ui-call

- entry_point: "ui_route:/terms/:id/linked-terms"
  caller_node: "odd-platform ts react-component component:Terms/TermDetails/TermLinkedTermsList/LinkedTermsList"
  multiplicity_per_trigger: "0 | 1"
  evidence: "Terms/TermDetails/TermLinkedTermsList/LinkedTermsList.tsx:85 — `<AppErrorPage ...>`"
  observation_class: ui-call

- entry_point: "ui_route:/management/policies/:id"
  caller_node: "odd-platform ts react-component component:Management/PolicyList/PolicyDetails"
  multiplicity_per_trigger: "0 | 1"
  evidence: "Management/PolicyList/PolicyDetails/PolicyDetails.tsx:68 — `<AppErrorPage ...>`"
  observation_class: ui-call

- entry_point: "ui_route:/management/integrations"
  caller_node: "odd-platform ts react-component component:Management/Integrations/IntegrationPreviewList"
  multiplicity_per_trigger: "0 | 1"
  evidence: "Management/Integrations/IntegrationPreviewList/IntegrationPreviewList.tsx:70 — `<AppErrorPage showError={isError} error={error as ErrorState} offsetTop={120} />` — react-query error cast; see `bugs_limitations_corner_cases[2]`"
  observation_class: ui-call

- entry_point: "ui_route:/management/integrations/:id"
  caller_node: "odd-platform ts react-component component:Management/Integrations/Integration"
  multiplicity_per_trigger: "0 | 1 (terminal — early-return pattern)"
  evidence: "Management/Integrations/Integration/Integration.tsx:33 — `if (isError) { return <AppErrorPage showError={isError} error={error} />; }` — the ONLY caller that uses AppErrorPage as a full-page replacement rather than a sibling overlay; react-query error type"
  observation_class: ui-call

- entry_point: "ui_route:/management/associations/active"
  caller_node: "odd-platform ts react-component component:Management/OwnerAssociations/OwnerAssociationsList/OwnerAssociationsActive"
  multiplicity_per_trigger: "0 | 1"
  evidence: "Management/OwnerAssociations/OwnerAssociationsList/OwnerAssociationsActive/OwnerAssociationsActive.tsx:99 — `<AppErrorPage showError={isError} offsetTop={182} />` — NO error prop; falls back to 'Unknown Error' display"
  observation_class: ui-call

- entry_point: "ui_route:/management/associations/new"
  caller_node: "odd-platform ts react-component component:Management/OwnerAssociations/OwnerAssociationsList/OwnerAssociationsNew"
  multiplicity_per_trigger: "0 | 1"
  evidence: "Management/OwnerAssociations/OwnerAssociationsList/OwnerAssociationsNew/OwnerAssociationsNew.tsx:95 — `<AppErrorPage showError={isError} offsetTop={182} />` — NO error prop"
  observation_class: ui-call

- entry_point: "ui_route:/management/associations/resolved"
  caller_node: "odd-platform ts react-component component:Management/OwnerAssociations/OwnerAssociationsList/OwnerAssociationsResolved"
  multiplicity_per_trigger: "0 | 1"
  evidence: "Management/OwnerAssociations/OwnerAssociationsList/OwnerAssociationsResolved/OwnerAssociationsResolved.tsx:103 — `<AppErrorPage showError={isError} offsetTop={182} />` — NO error prop"
  observation_class: ui-call

## downstream_side_effects

- side_effect_class: page-render
  description: "Renders a viewport-height-clearing grid containing the HTTP status code (large numeric, errorCode typography variant) and the status text heading (h1) plus a 'Return to the Home Page' link (anchored to react-router `/`). DOM nodes added: ~1 outer Grid + 2 inner Grids + 1 Typography (status code) + 1 Typography (status text) + 1 inner Grid + 1 Typography ('Return to the') + 1 Button (Home Page CTA). No portal, no overlay, no body-scroll-lock. Visible only when `showError=true`."
  evidence: "AppErrorPage.tsx:20-37"
  cardinality_per_call: "1 on showError=true, 0 on showError=false"
  reachable_from_entry_points: [
    "ui_route:/dataentities/:id (and all 8 sub-routes)",
    "ui_route:/terms/:id (and all sub-routes)",
    "ui_route:/search/:id",
    "ui_route:/alerts/*",
    "ui_route:/activity",
    "ui_route:/directory/*",
    "ui_route:/management/policies/:id",
    "ui_route:/management/integrations (and /:id)",
    "ui_route:/management/associations/*"
  ]

- side_effect_class: redirect-issue
  description: "If the user clicks the 'Home Page' button, a client-side react-router navigation to `/` is issued (resolves to `<Overview />`). No history-replace — pushes a new entry."
  evidence: "AppErrorPage.tsx:32 (`<Button text={t('Home Page')} to='/' ...>`) + Button.tsx:60-74 (StyledLink wraps the react-router `Link`)"
  cardinality_per_call: "0..1 — only if the user clicks the CTA"
  reachable_from_entry_points: ["all ui_route:* entries listed above"]

- side_effect_class: log-emit
  description: "NONE — the widget emits no console.log, no analytics event, no metric. A user encountering an error page leaves no telemetry trail at this layer. (Upstream thunk rejection MAY emit a toast via `showServerErrorToast` — that lives in `errorHandling.tsx:48-68`, NOT here.)"
  evidence: "AppErrorPage.tsx:1-40 (no `console.*`, no analytics call, no Sentry/etc.)"
  cardinality_per_call: 0
  reachable_from_entry_points: []

## sources

- understanding ← AppErrorPage.tsx:1-40 + redux/interfaces/loader.ts:3-8 + App.tsx:43-94 + handleResponseThunk.ts:19-43 + errorHandling.tsx:12-26
- concepts.entities.ErrorState ← redux/interfaces/loader.ts:3-8
- concepts.entities.HTTP-status-code ← AppErrorPage.tsx:24-26 + theme/typography.ts:105-109
- concepts.entities.Status-text ← AppErrorPage.tsx:29
- concepts.entities.Unknown-Error-fallback ← locales/translations/en.json:340 + AppErrorPage.tsx:29
- concepts.entities.Home-Page-CTA ← AppErrorPage.tsx:32 + Button.tsx:60-74
- concepts.entities.offsetTop ← AppErrorPage.tsx:11, 16, 21 + caller files passing override values
- concepts.invariants.controlled-component ← AppErrorPage.tsx:8-13
- concepts.invariants.null-on-false ← AppErrorPage.tsx:20, 37
- concepts.invariants.only-status-and-statusText-displayed ← AppErrorPage.tsx:24-29 + Grep `error\\.message|error\\.url` in AppErrorPage/ returns NONE
- concepts.invariants.fallback-Unknown-Error ← AppErrorPage.tsx:29 + locales/translations/en.json:340
- concepts.invariants.not-an-error-boundary ← AppErrorPage.tsx:1-40 (functional component) + Grep `ErrorBoundary|componentDidCatch|getDerivedStateFromError` in odd-platform-ui/src returns NONE
- concepts.invariants.Home-Page-goes-to-root ← AppErrorPage.tsx:32 + App.tsx:60
- concepts.invariants.assumes-Toolbar ← AppErrorPage.tsx:21 + App.tsx:56
- dependencies_semantic.requires-feature.i18next ← AppErrorPage.tsx:3, 18 + locales/translations/en.json:167, 264, 340
- dependencies_semantic.requires-config ← AppErrorPage.tsx:1-40 (no env / config)
- dependencies_semantic.requires-runtime.react ← AppErrorPage.tsx:2, 13
- dependencies_semantic.requires-runtime.MUI ← AppErrorPage.tsx:1, 21-35
- dependencies_semantic.requires-runtime.react-i18next ← AppErrorPage.tsx:3, 18, 29, 31, 32
- dependencies_semantic.requires-runtime.react-router-Link ← AppErrorPage.tsx:32 + Button.tsx:60-74 + Button.styles.ts:141
- dependencies_semantic.requires-runtime.toolbarHeight ← AppErrorPage.tsx:5, 21 + lib/constants.ts:131
- dependencies_semantic.requires-runtime.errorCode-typography ← AppErrorPage.tsx:24 + theme/typography.ts:105-109
- dependencies_semantic.couples-to.ErrorState-type ← AppErrorPage.tsx:4 + redux/interfaces/loader.ts:3-8
- dependencies_semantic.couples-to.Button ← AppErrorPage.tsx:6 + Button.tsx:1-92
- dependencies_semantic.couples-to.23-callers ← Grep `AppErrorPage` over `odd-platform-ui/src/components` (24 files; one is the index re-export, 23 are caller files)
- tests_coverage_semantic.test_files ← Glob `**/*test*` over `odd-platform-ui/src/` returns ZERO files
- docs_link_semantic.declared_docs ← AppErrorPage.tsx:1-40 (no `@docs` annotation)
- docs_link_semantic.doc_drift_findings[0] ← WebFetch https://docs.opendatadiscovery.org/ 2026-05-26 status 200 + WebFetch https://docs.opendatadiscovery.org/features 2026-05-26 status 200 (both report no mention of error UI)
- docs_link_semantic.doc_drift_findings[1] ← App.tsx:59-89 (no `path='*'` catch-all) + routes/termsRoutes.ts:21-23 + routes/masterDataRoutes.ts:1-4
- implicit_adrs[0] (per-page-component-owned error display) ← AppErrorPage.tsx:8-13 + 23 caller files
- implicit_adrs[1] (only status + statusText displayed) ← AppErrorPage.tsx:24-29 + redux/interfaces/loader.ts:3-8 + errorHandling.tsx:48-68
- bugs_limitations_corner_cases[0] (bare URL fall-through) ← App.tsx:59-89 + routes/termsRoutes.ts:21-23 + routes/masterDataRoutes.ts:1-4 + Grep `path=['\"]\\*['\"]|NotFound|Page404|404Page|NoMatch` returns NONE
- bugs_limitations_corner_cases[1] (no React error boundary) ← Grep `ErrorBoundary|componentDidCatch|getDerivedStateFromError` returns NONE + AppSuspenseWrapper.tsx:1-23 + App.tsx:58-90
- bugs_limitations_corner_cases[2] (react-query error cast) ← Integration.tsx:33 + IntegrationPreviewList.tsx:70 + AppErrorPage.tsx:10
- bugs_limitations_corner_cases[3] (no retry CTA) ← AppErrorPage.tsx:8-13 (no onRetry prop) + AppErrorPage.tsx:31-32
- bugs_limitations_corner_cases[4] (undefined-error degraded display) ← AppErrorPage.tsx:24-29 + OwnerAssociationsActive.tsx:99 + OwnerAssociationsNew.tsx:95 + OwnerAssociationsResolved.tsx:103
- security.auth_mode_relevance ← AppErrorPage.tsx:1-40 (no mode check)
- security.data_exposure ← AppErrorPage.tsx:24-29 + redux/interfaces/loader.ts:3-8 + errorHandling.tsx:12-26, 48-68 + App.tsx:55
- security.known_security_gaps[0] ← AppErrorPage.tsx:1-40 (no JSDoc / comment defending the omission)
- security.known_security_gaps[1] ← errorHandling.tsx:48-68 + App.tsx:55 + AppErrorPage.tsx:24-29
- upstream_callers.* ← Grep `AppErrorPage` over `odd-platform-ui/src/components` (full 80-result enumeration) + the 22 caller files individually inspected for evidence
- downstream_side_effects.page-render ← AppErrorPage.tsx:20-37
- downstream_side_effects.redirect-issue ← AppErrorPage.tsx:32 + Button.tsx:60-74
- downstream_side_effects.log-emit ← AppErrorPage.tsx:1-40 (no console / no analytics)
- stress_findings.tunables.offsetTop ← AppErrorPage.tsx:11, 16, 21
- stress_findings.tunables.toolbarHeight ← AppErrorPage.tsx:5, 21 + lib/constants.ts:131
- stress_findings.name_behavior_pairs.AppErrorPage ← AppErrorPage.tsx:1-40 + App.tsx:59-89 + 23 caller files
- stress_findings.name_behavior_pairs.showError ← AppErrorPage.tsx:20, 37
- stress_findings.name_behavior_pairs.error ← AppErrorPage.tsx:10, 24-29 + redux/interfaces/loader.ts:3-8
- stress_findings.auth_gates ← AppErrorPage.tsx:1-40
- stress_findings.resource_boundaries ← AppErrorPage.tsx:13-37
- stress_findings.request_inputs.showError ← AppErrorPage.tsx:9, 20
- stress_findings.request_inputs.error ← AppErrorPage.tsx:10, 24-29 + redux/interfaces/loader.ts:3-8 + errorHandling.tsx:12-26
- stress_findings.request_inputs.offsetTop ← AppErrorPage.tsx:11, 16, 21
- stress_findings.probes_emitted.P-176 ← (this sidecar emits P-176)

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (the absence of test files is verified; the gap analysis is high-confidence)
- docs_link_semantic: HIGH (the two doc-drift findings are verified by WebFetch + by reading App.tsx)
- implicit_adrs: HIGH (both ADRs are supported by widespread, consistent code evidence — 23 callers for ADR[0], the deliberate field-omission and the toast-side channel for ADR[1])
- bugs_limitations_corner_cases: HIGH (every entry is anchored to specific file:line evidence, including the negative-result Greps)
- security: HIGH (no PROBE-NEEDED — the displayed-field contract is determinable statically; P-176 is a confirmatory probe, not a discovery probe)
- performance: N/A — empty arrays with reasons
- upstream_callers: HIGH (all 22 callers enumerated with file:line evidence)
- downstream_side_effects: HIGH
- stress_findings: HIGH (22/22 questions STATIC-INFERRED; 2 drift flags surfaced — one minor name drift on `AppErrorPage`, one minor field-translation drift on `error`)

## Maintainer notes

(empty — no prior sidecar; this is the first enrichment of this node)

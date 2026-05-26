---
doc_gap_id: DOC-GAP-311
severity: MEDIUM
category: drift
batch: ZJ
generated_at: "2026-05-26T00:00:00Z"
generated_at_commit: 4ec2b20
prompt_version: "doc-gap-finder/0.1.0"
maintainer_curated: false
related_pillar_features:
  - "P-09"           # SPA shell — AppErrorPage is the SPA's error UI
related_features: []
related_doc_gaps:
  - DOC-GAP-300      # /terms blank-page dead-end (sibling URL-surface finding)
  - DOC-GAP-301      # /master-data blank-page dead-end (sibling URL-surface finding)
  - DOC-GAP-307      # UI-shell canonical doc page absent (the home for the AppErrorPage section)
  - DOC-GAP-136      # AppError banner reflects full URL + status text — defence-in-depth (sibling AppError surface)
related_retrospectives:
  - LSN-001          # operator-trap canonical (silent UX defect)
  - LSN-011          # doc-product coherence not self-detecting
---

## DOC-GAP-311 — `AppErrorPage` (the SPA's page-level error widget — 23 callers across DataEntityDetails / TermDetails / Search / Alerts / Activity / Directory / DataSourceList / etc.) is SCOPED ONLY to async-thunk-rejection paths; React-Router-DOM v6's no-match fall-through (any URL not matched by `App.tsx:59-89`'s 11 `<Route>` entries, including the documented bare `/terms` + bare `/master-data`) renders a BLANK PAGE — `App.tsx:59-89` declares NO `<Route path='*'>` catch-all; AND Grep `ErrorBoundary|componentDidCatch|getDerivedStateFromError` across `odd-platform-ui/src` returns ZERO matches — there is NO React error boundary ANYWHERE in the platform UI, so a synchronous JS render error in any component crashes the entire route subtree to a blank page (React 18's default-unmount-to-closest-boundary); AND lazy-chunk-load failures (`React.lazy(() => import(...))` at `App.tsx:30-41`) surface as either an uncaught promise rejection (development) or an indefinitely-pending Suspense fallback (production); the live docs are silent on all three classes of blank-page UX; an operator landing on a blank page has no in-UI signal AND no doc-side recourse; the gap is the STRUCTURAL ROOT CAUSE of the batches ZH + ZI bare-page observations (DOC-GAP-300 / DOC-GAP-301) and the 23 page-level AppErrorPage callers' false sense of error-coverage

**Severity**: MEDIUM
**Category**: drift (UX defect + architectural gap; the SPA has page-level error coverage by convention but no global error boundary; the docs treat the SPA's error UI as if it's globally scoped when it's per-component-scoped)

### Surfaced by

- `odd-platform__ts__components_shared_elements_AppErrorPage__ui-shell-widget__AppErrorPage.md:docs_link_semantic.doc_drift_findings[0]` ("**DOC GAP — the platform's error-display UI is undocumented end-to-end.** The widget `AppErrorPage` is rendered by 23 page-level components across the platform UI ... Every one of them surfaces an HTTP status code + a short status-text heading + a 'Return to the Home Page' link when a page-level data fetch rejects. The live docs (WebFetched 2026-05-26, status 200 on root + status 200 on /features) contain NO description of what users see when a fetch fails, no screenshot, no troubleshooting paragraph, no 'if you see a 404 on this page, do X' guidance.") **(NEW batch ZJ — AppErrorPage sidecar PRIMARY SOURCE)**
- `odd-platform__ts__components_shared_elements_AppErrorPage__ui-shell-widget__AppErrorPage.md:docs_link_semantic.doc_drift_findings[1]` ("**DOC GAP — bare-URL fall-through (`/terms`, `/master-data`, unknown paths) produces a BLANK PAGE, not the AppErrorPage.** ... `App.tsx:59-89` declares NO `<Route path='*'>` catch-all and NO React error boundary; React-Router-DOM v6's NO-MATCH behaviour is to render nothing — neither the AppErrorPage nor any other fallback. The user perceives a blank window.") **(NEW batch ZJ)**
- `odd-platform__ts__components_shared_elements_AppErrorPage__ui-shell-widget__AppErrorPage.md:bugs_limitations_corner_cases[0]` ("**Bare `/terms`, `/master-data`, and any other URL not matched by `App.tsx`'s route table produces a BLANK PAGE — AppErrorPage is NOT mounted on a `path='*'` catch-all.**") **(NEW batch ZJ)**
- `odd-platform__ts__components_shared_elements_AppErrorPage__ui-shell-widget__AppErrorPage.md:bugs_limitations_corner_cases[1]` ("**There is NO React error boundary anywhere in the platform UI.** A synchronous JS error during render (e.g. an undefined-access, a type error, a thrown component) is NOT caught by `AppErrorPage`. Grep `ErrorBoundary|componentDidCatch|getDerivedStateFromError` over `odd-platform-ui/src` returns ZERO matches.") **(NEW batch ZJ)**

### Evidence

- `odd-platform-ui/src/components/shared/elements/AppErrorPage/AppErrorPage.tsx:1-40` — primary source: 40-line functional component, props-only interface (`showError: boolean; error?: ErrorState; offsetTop?: number;`), renders a viewport-height grid with `error?.status` + `error?.statusText ?? t('Unknown Error')` + a `<Link to='/'>` "Return to the Home Page" button.
- `odd-platform-ui/src/components/App.tsx:59-89` — primary evidence: 11 `<Route>` entries declared (`/`, `/search/*`, `/dataentities/*`, `/directory`, `/termsearch/*`, `/alerts/*`, `/activity`, `/terms/...`, `/data-modelling/*`, `/master-data/lookup-tables/*`, `/management/*`); NO `<Route path='*'>` catch-all.
- Grep `path=['\"]\\*['\"]|NotFound|Page404|404Page|NoMatch` over `odd-platform-ui/src` (per AppErrorPage sidecar bugs[0]) — ZERO matches.
- Grep `ErrorBoundary|componentDidCatch|getDerivedStateFromError` over `odd-platform-ui/src` (per AppErrorPage sidecar bugs[1]) — ZERO matches.
- `odd-platform-ui/src/components/AppSuspenseWrapper/AppSuspenseWrapper.tsx:1-23` (per sidecar) — Suspense wrapper exists; no error handling.
- `odd-platform-ui/src/components/App.tsx:30-41` — `React.lazy(() => import(...))` calls for each page-level component; lazy-chunk-load failures bubble up to the closest Suspense boundary (which has no error UI).
- AppErrorPage callers per Grep `AppErrorPage` over `odd-platform-ui/src/components` (per AppErrorPage sidecar `couples-to`): 23 caller files — DataEntityDetails, TermDetails, Search/Results, Alerts, ActivityResults, Directory, DataSourceList, Entities, DataEntityAlerts, TestReport, DatasetStructureOverview, DatasetStructureCompare, HierarchyLineage, IntegrationPreviewList, Integration, PolicyDetails, OwnerAssociationsActive, OwnerAssociationsNew, OwnerAssociationsResolved, Term*, LinkedTermsEntities, LinkedTermsList — uniformly pattern-matched `<AppErrorPage showError={isXxxNotFetched} error={xxxFetchingError} />`.
- WebFetch `https://docs.opendatadiscovery.org/` 2026-05-26 status **200** (per AppErrorPage sidecar inferred_docs) — zero mention of error pages, error handling, HTTP error codes displayed in the UI, "blank page", "404 page", or "Home Page button".
- WebFetch `https://docs.opendatadiscovery.org/features` 2026-05-26 status **200** (per AppErrorPage sidecar) — same.
- Cross-link to existing DOC-GAP-300 (`/terms` blank-page dead-end) + DOC-GAP-301 (`/master-data` blank-page dead-end) — both are SYMPTOMS of THIS finding's structural cause (no `path='*'` catch-all).

### Drift narrative

The Open Data Discovery SPA has a load-bearing convention for error UI: each of 23 page-level data-loading components wires its own `<AppErrorPage>` instance keyed on its own `getXxxFetchingStatuses` / `getXxxFetchingError` selectors. The convention is applied consistently; the pattern catches the common case where a backend data fetch rejects (e.g. `/api/dataentities/9999` returns 404, `fetchDataEntityDetails` rejects, AppErrorPage shows "404"). The convention is the platform's primary error-UX surface.

The convention has THREE structural blind spots, none documented:

1. **Bare-URL fall-through**: any URL not matched by the 11 `<Route>` entries in `App.tsx:59-89` produces a BLANK PAGE. React-Router-DOM v6's no-match behaviour is to render nothing inside `<Routes>`. The AppToolbar still renders (it's outside the `<Routes>`); the route-body area is empty. Operators see a blank pane beneath the toolbar with no error message, no "404" code, no Home Page link. This is the STRUCTURAL ROOT CAUSE of DOC-GAP-300 (bare `/terms` blank-page) and DOC-GAP-301 (bare `/master-data` blank-page) — both are instances of the same gap.

2. **Synchronous React render errors**: a thrown component, an undefined-access, a type error inside any of the 23 page-level subtrees crashes the ENTIRE Routes subtree to a blank page (React 18's default-unmount-to-closest-boundary; the closest boundary is the root App component). No error message, no recovery affordance, no "report this" button. The AppSuspenseWrapper handles loading-state Suspense fallbacks but has NO error handling. The platform UI has ZERO React error boundaries.

3. **Lazy-chunk-load failures**: `App.tsx:30-41` uses `React.lazy(() => import('...'))` to code-split the page-level components. A chunk-load failure (CDN unreachable, deploy mid-flight, browser-cache mismatch) surfaces as either an uncaught promise rejection (development; user sees a console error) OR an indefinitely-pending Suspense fallback (production; user sees a spinner that never resolves). Neither path reaches AppErrorPage.

The operator-visible impacts:

- **Operator hits an unknown URL** (typed in addressbar, bookmark to a renamed route, shared link to a stale path): blank page; no recourse short of clicking the browser's back button or addressbar-typing `/`.
- **Operator hits a freshly-introduced React render bug** (e.g. a regression in a component-tree): blank page; the operator may infer the platform is down when only one route subtree is broken.
- **Operator hits a deploy mid-flight chunk-mismatch**: spinning forever; the operator may reload the page (which fetches fresh chunks but the URL handler may still be broken).

The live docs do not describe any of three failure modes. There is no "Troubleshooting" section, no "Common error pages" section, no screenshot of AppErrorPage, no operator guidance for any blank-page case. The 23 page-level AppErrorPage callers project a false sense of error-coverage — operators reasonably assume the SPA has global error UI, but the coverage is per-component-keyed-on-redux-rejection only.

The fix has two parts: a 5-line code change closes the largest gap (bare-URL fall-through), and a single-component-class change closes the second (React error boundary at the App root). Both are well-bounded.

### Proposed doc action

**Three-part action — code-side primary; doc-side companion; the code-side fix should ship first.**

1. **Code-side PRIMARY** — file `/log-issue odd-platform` for two small fixes (both well-scoped to App.tsx + a new file):
   - **(a)** Add a `<Route path='*' element={<AppErrorPage showError error={{status:404, statusText:'Page Not Found', url:'', message:''}} />} />` to `App.tsx:89` — 1-line change closes the bare-URL fall-through gap. Closes DOC-GAP-300 + DOC-GAP-301 + the structural bare-URL fall-through of THIS finding.
   - **(b)** Wrap the root `<App />` (or the `<Routes>` block at `App.tsx:58`) in a React error boundary — a small new class component implementing `getDerivedStateFromError(error)` + `componentDidCatch(error, info)` + a render fallback that mounts AppErrorPage with `status=500, statusText='Application Error'`. Closes the synchronous React render error gap. (Optional enrichment: in development the boundary reveals the stack trace below the AppErrorPage; in production it hides the stack and shows only the friendly status.)
   - **(c) OPTIONAL** — handle the lazy-chunk-load case by wrapping each `React.lazy()` call in a retry-then-fallback helper (`lazyWithRetry`); on chunk-load failure show AppErrorPage with `status=503, statusText='Loading failed'`. This is the most invasive of the three and is the LOW priority; close (a) + (b) first.

2. **Doc-side COMPANION** — in DOC-GAP-307 NEW's proposed `features/ui-overview.md` page, the "When things go wrong — the error page" section needs three sub-bullets:
   - "AppErrorPage shows up when a page-level data fetch fails (HTTP 4xx / 5xx response from the platform API). The page displays the status code and short status text; the "Return to the Home Page" link is the recovery affordance."
   - "Bare URLs (e.g. `/dictionary` typed in the address bar; `/master-data` typed before the redirect ships) render a blank page. The platform's current release has no catch-all error UI for unknown URLs; use the browser's back button or navigate via the toolbar tabs. **A redirect / catch-all fix is tracked at DOC-GAP-300 + DOC-GAP-301 + THIS finding.**"
   - "If you encounter a blank page on a route that previously worked, refresh the browser (the SPA may be mid-deploy and the lazy-chunk-load may need a retry); if the blank persists, the page may have a regression that crashed the route subtree. Capture the URL + the browser console output and file an issue."

3. **Doc-side OPTIONAL** — author a standalone `developer-guides/troubleshooting.md` page that homes the operator-troubleshooting detail; `features/ui-overview.md` then cross-links to it. Either home works; the maintainer's call.

### Cross-references

- **DOC-GAP-300** (`/terms` blank-page dead-end) — INSTANCE of THIS finding's structural cause; the proposed code-side fix (a) closes both
- **DOC-GAP-301** (`/master-data` blank-page dead-end + Lookup Tables permissions gap) — INSTANCE of THIS finding's structural cause; the proposed code-side fix (a) closes both
- **DOC-GAP-136** (AppError banner reflects `error.url` / `error.message` verbatim — defence-in-depth) — sibling AppError surface. This finding documents the SCOPE of AppErrorPage (per-component-controlled), DOC-GAP-136 documents the LEAK of internal-path information when AppErrorPage IS reached. Combined, they're a 2-vector finding on the same surface.
- **DOC-GAP-307 NEW** (UI-shell canonical doc page absent) — this finding's "When things go wrong" section belongs there
- **LSN-001** (operator-trap canonical) — blank-page on bare URL is a silent UX defect; the docs don't acknowledge it
- **LSN-011** (doc-product coherence not self-detecting) — the platform has page-level error coverage by convention but no global error boundary; the docs treat the SPA's error UI as if it's globally scoped when it's per-component-scoped — exactly the coherence gap LSN-011 documents

### Severity rationale

MEDIUM — operator-experience gap with multiple specific failure modes (bare URL → blank; synchronous render error → blank; lazy-chunk-load failure → blank-or-spinner); each mode is reachable in normal use without operator intent. Severity is NOT HIGH because: (a) no security boundary is crossed; (b) no data is lost or corrupted; (c) the per-component-keyed AppErrorPage covers the COMMON case (backend data fetch rejection); (d) the fix is bounded — 1-line catch-all route + 1 React error boundary class + 1 optional retry helper for lazy chunks. Severity is NOT LOW because: (a) the bare-URL fall-through is the STRUCTURAL ROOT CAUSE of TWO previously-filed DOC-GAPs (300 + 301); (b) the synchronous-render-error gap means a single buggy component in the 23-caller tree crashes the route subtree to nothing — high blast radius; (c) the docs project a false sense of error-coverage to operators reading the live `/features` pages; (d) the 23 page-level AppErrorPage callers' pattern uniformity itself REINFORCES the false sense (a maintainer who's surveyed the AppErrorPage callers reasonably assumes error-coverage is global, not per-component-keyed).

### Last verified

- 2026-05-26 — AppErrorPage sidecar (PRIMARY SOURCE — full Read, including 23-caller Grep enumeration and ZERO-match Grep on `ErrorBoundary|componentDidCatch|getDerivedStateFromError`) at substrate commit 4ec2b20; live WebFetch confirmations on docs.opendatadiscovery.org root (200) and `/features` (200) — both silent on error UI per the sidecar's inferred_docs fetch this session.

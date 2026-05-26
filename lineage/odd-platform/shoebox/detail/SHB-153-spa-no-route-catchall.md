# SHB-153 — Bare-URL fall-through produces a blank page; SPA has no path='*' catch-all and no React error boundary

**Category**: clustering
**Severity**: HIGH

## Hypothesis

When operators visit ANY URL that doesn't match the SPA's 11 declared `<Route>` entries — including the documented-elsewhere shape `/terms` (the parent route exists but has only a `:termId/*` child, no `index` route) and `/master-data` (no parent route mounted; only `/master-data/lookup-tables` is mounted) — they see a BLANK PANE below the AppToolbar with no error message, no '404' code, no Home Page link. AppErrorPage exists but is mounted per-page-component, NOT on a `path='*'` catch-all. Worse: the entire SPA has ZERO React error boundaries — any synchronous JS error during render unmounts the entire app tree, leaving the user with a blank page or a console error. Lazy-chunk load failures via `React.lazy(() => import(...))` surface as indefinitely-pending Suspense fallbacks in production.

## Evidence

- `odd-platform-ui/src/components/App.tsx:59-89` — exactly 11 `<Route>` entries; NONE has `path='*'`; no fallback element.
- `odd-platform-ui/src/components/shared/elements/AppErrorPage/AppErrorPage.tsx:1-40` — functional component, no `componentDidCatch`, no `getDerivedStateFromError`; CANNOT catch render errors.
- Grep `ErrorBoundary|componentDidCatch|getDerivedStateFromError` over `odd-platform-ui/src` returns ZERO matches per AppErrorPage sidecar finding.
- `odd-platform-ui/src/components/shared/elements/AppSuspenseWrapper/AppSuspenseWrapper.tsx:1-23` — Suspense only; no error handler.
- `odd-platform-ui/src/routes/termsRoutes.ts:21-23` — `termsPath()` returns `/terms` but no `<Route path='/terms'>` is mounted (only `/terms/:termId/*` in App.tsx:66-68).
- `odd-platform-ui/src/routes/masterDataRoutes.ts:1-4` — no `masterDataPath()` export; only the child `lookupTablesPath()`.

## Notes

- This thread ENRICHES F-042 (Page-level UI Error Display — blank page on bare-URL fall-through). F-042 captures the SYMPTOM but THIS thread captures the STRUCTURAL ROOT CAUSE — and the absent-error-boundary class (a separate, additional issue).
- The fix is small (5 lines): add `<Route path='*' element={<AppErrorPage showError error={{status:404, statusText:'Page Not Found', url:'', message:''}}/>} />` at App.tsx:89.
- Adding an ErrorBoundary at the App root is also small (~30 lines for a class component) and would catch the entire class of render-time crashes.
- The chunk-load-failure case is severe: under flaky network or after a redeploy, `React.lazy(...)` rejects with `ChunkLoadError`; without an error boundary, the screen goes blank with no diagnostic.
- The DataEntityDetails sidecar's LSN-017 doubling is mitigated if the page errors out; today there's no recovery surface.

## Next

1. Promote as enricher to F-042 — explicit primary subject: `<Route path='*'>` MISSING + zero error boundary.
2. Decide: ship the 5-line route fix AND a ~30-line root ErrorBoundary in the same PR (both are small and reinforce each other).
3. Probe P-176 (already emitted per AppErrorPage sidecar): visit bare `/terms` and `/master-data`; confirm blank-pane reproduction.

## Links

- cluster_with: [F-042]
- merged_into: (set when merged into F-042)
- supersedes: []

## REFACTOR-685 — NO React error boundary anywhere in `odd-platform-ui/src` — synchronous JS render errors are NOT caught; lazy-chunk loading failures surface as uncaught promise rejections / indefinitely-pending Suspense fallbacks; the entire SPA tree unmounts to the (absent) closest boundary on any throw → blank page

**Severity**: HIGH
**Category**: missing-error-handling / structural-absence
**Batch**: ZJ (2026-05-26)
**Pillars affected**: [ALL — every pillar's UI subtree is exposed]

**Surfaced by**:
- `odd-platform__ts__components_shared_elements_AppErrorPage__ui-shell-widget__AppErrorPage.md:bugs_limitations_corner_cases[1]` (HIGH) — "**There is NO React error boundary anywhere in the platform UI.** A synchronous JS error during render (e.g. an undefined-access, a type error, a thrown component) is NOT caught by `AppErrorPage`. Grep `ErrorBoundary|componentDidCatch|getDerivedStateFromError` over `odd-platform-ui/src` returns ZERO matches. The closest thing is `AppSuspenseWrapper` (`AppSuspenseWrapper.tsx:1-23`) — Suspense only, no error handling. Impact: if any component in the route subtree throws during render, React 18's default behaviour is to unmount the entire tree to the closest boundary (none → unmounts the whole App), leaving the user with a blank page or a console error. The same blank-page-from-an-uncaught-throw failure mode applies to lazy-chunk loading failures (`React.lazy(() => import(...))` at App.tsx:30-41) — a chunk-load failure surfaces as an uncaught promise rejection in development and an indefinitely-pending Suspense fallback in production. AppErrorPage CANNOT catch these because it is a sibling within page subtrees, not an ancestor wrapping the Routes."

**Statement**: `odd-platform-ui/src` contains ZERO React error boundaries. The grep `ErrorBoundary|componentDidCatch|getDerivedStateFromError` over the full UI tree returns no matches. `AppErrorPage.tsx` is a functional component with no `componentDidCatch` lifecycle method — it cannot serve as a React error boundary. `AppSuspenseWrapper.tsx:1-23` provides Suspense fallback only (no error catch). The result: any synchronous JS error during render unmounts the entire tree to the closest boundary (which doesn't exist → the whole App unmounts), leaving the user with a blank page in production and a console error in development.

Concrete failure modes this absence enables:
1. **Undefined-access in any page component** — e.g. `data.items.map(...)` when `data` is undefined → React 18 unmounts the whole tree → blank page. Cross-ref REFACTOR-592 (`DataQualityContent.tsx:48` blanks the dashboard on unknown DataEntityRunStatus); REFACTOR-286 (`JSON.parse` crashes Lineage); REFACTOR-603 (URL-sync JSON.parse crashes DQ); REFACTOR-680 (search-id /search/garbage); REFACTOR-595 - any of these individual instance defects compound because there is NO boundary to contain them.
2. **React.lazy chunk-load failures** — `App.tsx:30-41` declares many lazy-loaded routes (`const Search = React.lazy(() => import('./pages/Search'))` etc.). A chunk-load failure (network hiccup, CDN stale cache, deployment-mid-window asset rotation) surfaces as an uncaught promise rejection in development and an indefinitely-pending Suspense fallback (or blank) in production.
3. **Unforeseen render exceptions in 3rd-party libraries** — MUI, react-router-dom, recharts, jotai, react-i18next all have internal invariants that can throw on edge-case inputs. Without a boundary, any internal throw kills the whole UI.

The standard React fix is a class component implementing `componentDidCatch` + `getDerivedStateFromError` placed as a HIGH ancestor of the route tree (e.g. inside `App.tsx` between `<AppToolbar />` and `<Routes>`). Standard pattern:

```tsx
class GlobalErrorBoundary extends React.Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // log to monitoring service
  }
  render() {
    if (this.state.hasError) {
      return <AppErrorPage showError error={{ status: 500, statusText: this.state.error?.message ?? 'Application error', url: '', message: '' }} />;
    }
    return this.props.children;
  }
}
```

— wrapping `<Routes>` with `<GlobalErrorBoundary>` catches every synchronous render throw + the suspense-side error case (via React 18's Suspense + ErrorBoundary integration).

**Evidence**:
- AppErrorPage.tsx:1-40 (functional component; no `componentDidCatch`, no `getDerivedStateFromError`)
- Grep `ErrorBoundary|componentDidCatch|getDerivedStateFromError` over `odd-platform-ui/src` returns NO matches.
- App.tsx:58-90 (the routes block; no ErrorBoundary wrapping)
- AppSuspenseWrapper.tsx:1-23 (Suspense only; no error handling)
- React 18 documentation on Error Boundaries ([reactjs.org/docs/error-boundaries.html](https://reactjs.org/docs/error-boundaries.html)) — the canonical pattern this codebase does not implement.

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-086 (selective error-toast suppression for primary-page-load thunks) covers ASYNC-THUNK-REJECTION error surface; ADR-CANDIDATE-233 NEW this batch covers AppErrorPage's display-field contract. Neither addresses synchronous JS render errors — those are uncovered by any existing decision. This refactor is the structural absence the existing ADRs don't fill.

**Proposed remedy**: Add a GlobalErrorBoundary class component in `odd-platform-ui/src/components/shared/elements/GlobalErrorBoundary/` (or similar location); wrap `<Routes>` in `App.tsx` with it; reuse AppErrorPage as the fallback render. Optionally: configure the boundary to log to a monitoring service (or at minimum to `console.error`) so production errors surface in browser-side telemetry. Composes naturally with REFACTOR-685's existing AppErrorPage design — the boundary uses the same widget for the fallback render. Effort: small (1-2 hour task), reversible.

**Severity rationale**: HIGH — structural safety absence affecting the entire UI tree; current production behaviour is "any unforeseen throw blanks the whole UI". Several existing refactor scopes (REFACTOR-592, REFACTOR-286, REFACTOR-603, REFACTOR-680) document INSTANCES of this class-level absence; adding the boundary CONTAINS them as a class. The risk of NOT adding a boundary compounds with every new feature: each new component is a new potential throw site.

**Suggested backlog grouping**: `UI architecture hardening sprint` — composes with REFACTOR-686 NEW this batch (no path='*' catch-all) as the matching structural absence at the routing layer.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-686 NEW (no path='*' catch-all — same structural-absence class at the routing layer); REFACTOR-592, REFACTOR-286, REFACTOR-603, REFACTOR-680 (specific instance defects that the boundary would contain); ADR-CANDIDATE-233 NEW (AppErrorPage display-field contract — the widget the boundary would render).
- SUPERSEDES: none.
- CONFLICTS: none.

---

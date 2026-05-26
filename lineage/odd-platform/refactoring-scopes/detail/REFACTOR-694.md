## REFACTOR-694 — `ToolbarTabs.tsx:112-117` (Dictionary tab) and `useCreateSearch.ts:14-19` (Catalog tab) call `.unwrap().then(...)` WITHOUT a `.catch(...)` — if the createTermSearch / createDataEntitiesSearch thunk rejects (backend unavailable, 5xx, network drop), the user clicks the tab and NOTHING HAPPENS: no toast, no navigation, no state change; silent failure on a primary navigation action

**Severity**: MEDIUM
**Category**: missing-error-handling / silent-failure-on-primary-nav
**Batch**: ZJ (2026-05-26)
**Pillars affected**: [P-01 Data Discovery (Catalog), P-02 Data Glossary (Dictionary)]

**Surfaced by**:
- `odd-platform__ts__components_shared_elements_AppToolbar_ToolbarTabs__ui-shell-widget__ToolbarTabs.md:bugs_limitations_corner_cases[5]` (MEDIUM) — "Both create-thunk-then-navigate handlers (Catalog at line 122 via useCreateSearch.ts:14-19, and Dictionary at lines 112-117) call `.unwrap().then(...)` WITHOUT a `.catch(...)` — if the thunk rejects (e.g. backend unavailable, 5xx on the search-create POST), the user clicks the tab and NOTHING happens. No error toast, no navigation, no state change. Silent failure on a primary nav action."

**Statement**: The Catalog tab and Dictionary tab onClick handlers dispatch a create-search thunk and use the `.unwrap().then(({searchId}) => navigate(termsSearchPath(searchId)))` pattern (ToolbarTabs.tsx:112-117 for Dictionary; useCreateSearch.ts:14-19 for Catalog). The `.unwrap()` re-throws on rejected thunks. The `.then(...)` chain has no `.catch(...)`, so a rejected thunk produces an UNHANDLED promise rejection — which:
- Logs to the browser console (visible in DevTools, invisible to users).
- Does NOT trigger the `showServerErrorToast` toast (that's wired at the redux thunk wrapper layer for thunks that don't have `switchOffErrorMessage: true` set; createTermSearch / createDataEntitiesSearch may or may not have it set — but even if the toast fires, the user clicked Dictionary and they're still on the previous page).
- Does NOT navigate the user anywhere.
- Does NOT clear any in-flight state.

The user-visible UX: click "Dictionary" → see nothing happen → click again → nothing → conclude the platform is broken.

**Operator-visible impact**:
- Backend hiccup during a busy period → 5xx on createTermSearch → user clicks Dictionary repeatedly, each click mints another orphaned search-id row server-side (cross-ref the stress_findings.resource_boundaries discussion in the ToolbarTabs sidecar) AND user sees no progress.
- Slow network → the promise is pending → user clicks again before resolution → second thunk fires → first thunk's promise resolves first, navigates to first searchId; second thunk's promise resolves second, navigates to second searchId — the user ends up on the second search, the first is orphaned.
- The Catalog tab has the SAME shape via useCreateSearch.

**Evidence**:
- ToolbarTabs.tsx:112-117 (Dictionary handler: `dispatch(createTermSearch(...)).unwrap().then(({searchId}) => navigate(termsSearchPath(searchId)))` — no `.catch`)
- useCreateSearch.ts:14-19 (Catalog handler: same pattern)
- handleResponseThunk.ts:34-42 (the redux thunk wrapper; surfaces error to the toast at line 37 IF `switchOffErrorMessage` is NOT set; not the same channel as the missing `.catch`)
- ADR-CANDIDATE-086 (switchOffErrorMessage / AppErrorPage thunk-wrapper split — the architectural context for error-surface decisions)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-236 NEW this batch (Catalog/Dictionary mint fresh search-id on click) is the architectural anchor — the choice to mint-then-navigate creates this failure mode by design. The remedy is NOT to abandon the architecture (the fresh-id-on-click UX is correct); it is to add the missing error-handling shape to the two onClick handlers.

**Proposed remedy**: Add a `.catch(...)` to each handler:

```tsx
// ToolbarTabs.tsx:111-118 (Dictionary)
if (tabs[idx].name === t('Dictionary')) {
  dispatch(createTermSearch(...))
    .unwrap()
    .then(({searchId}) => navigate(termsSearchPath(searchId)))
    .catch((error) => {
      // surface to user
      showServerErrorToast({ error, defaultMessage: t('Could not start a dictionary search') });
      // or trigger a redux state update that the toolbar renders as a toast
    });
}
```

```tsx
// useCreateSearch.ts:14-19 (Catalog)
return dispatch(createDataEntitiesSearch(initialParams))
  .unwrap()
  .then(({searchId}) => navigate(searchPath(searchId)))
  .catch((error) => {
    showServerErrorToast({ error, defaultMessage: t('Could not start a catalog search') });
  });
```

Effort: 30 minutes for both handlers + verifying the toast pattern (cross-ref `showServerErrorToast` from `errorHandling.tsx:48-68`). Composes with the existing toast machinery; no new infrastructure.

**Severity rationale**: MEDIUM — silent failure on a PRIMARY navigation surface; affects every user who clicks Catalog or Dictionary while the backend is degraded. Not HIGH because the user can recover (refresh, retry, click again later). Not LOW because the two tabs are the most-clicked nav items in the platform; a silent-failure UX on these specifically erodes confidence quickly.

**Suggested backlog grouping**: `UI architecture hardening sprint` — couple with REFACTOR-685 NEW (no error boundary), REFACTOR-686 NEW (no path='*' catch-all). The three together close a class of "the SPA silently breaks" UX defects.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-236 NEW (the fresh-id-on-click architecture this defect is the failure-mode of), ADR-CANDIDATE-086 (the toast-vs-AppErrorPage split that the remedy fits into).
- SUPERSEDES: none.
- CONFLICTS: none.

---

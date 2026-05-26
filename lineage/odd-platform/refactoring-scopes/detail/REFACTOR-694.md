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


## STRENGTHENS — Batch ZL (2026-05-26 — Search.tsx page-root sidecar confirms the unhandled-rejection chain end-to-end at the COMPOSITION layer)

The Search.tsx page-root sidecar explicitly traces the unhandled-rejection failure mode at the SPA's main entry-point — the Catalog page. The sidecar confirms the same `.unwrap().then(...)` pattern without `.catch(...)` already documented at useCreateSearch.ts:14-19, and adds the missing app-level error-boundary observation (App.tsx:60-65 wraps NO ErrorBoundary around the Route element).

**New surfaced_by entries**:

- `odd-platform__ts__react-component__component__Search.md:bugs_limitations_corner_cases[4]` (MEDIUM) — "**No `.catch` on the create-session promise chain — unhandled rejection on session-create failure. IDENTICAL pattern to TermSearch batch-U bugs[3].** useCreateSearch.ts:14-19: `dispatch(createDataEntitiesSearch({searchFormData})).unwrap().then(({searchId}) => { ... navigate(searchLink); })`. No `.catch(...)` follows the `.then`. `.unwrap()` re-throws on rejection. If `createDataEntitiesSearch` rejects (server-side 500, network failure, auth expiry mid-flight), the rejection lands in the React error boundary (if any wraps the Route — verified by reading App.tsx around line 61: no `<ErrorBoundary>` wraps the Route element) or the browser console. **Net: the user sees a frozen empty page with no error message; the URL stays at `/search`; refreshing repeats the same path.** The slice's missing `.rejected` reducer (slice.ts:214-260 verified — only `.fulfilled` cases) compounds this — neither the slice nor the UI surfaces the failure. Pattern parity with TermSearch batch-U."

- `odd-platform__ts__react-component__component__Search.md:security.known_security_gaps[4]` (MEDIUM) — "**Unhandled-rejection silent-failure on session-create / restore.** useCreateSearch.ts:14-19 (createDataEntitiesSearch promise chain — no .catch); slice missing .rejected reducers. Auth-token-expired mid-session reproduces: the GET `/api/search/{searchId}` returns 401 → thunk rejects → slice silent → URL retains `:searchId` → user sees frozen empty page → refresh repeats. Pattern parity with batch-U TermSearch known_security_gaps[4]."

**What this strengthening adds**: prior coverage (batch ZJ) anchored the unhandled-rejection at ToolbarTabs.tsx:112-117 (Dictionary handler) + useCreateSearch.ts:14-19 (Catalog handler). Batch ZL adds the FULL COMPOSITION-LEVEL CONTEXT:

1. **Two compounding silences** — the missing `.catch` on the promise chain AT useCreateSearch.ts:14-19 AND the missing `.rejected` cases in the slice AT slice.ts:214-260. The rejection has TWO opportunities to be surfaced; both are absent.

2. **App.tsx has NO ErrorBoundary wrap on the Route** — Search.tsx's sidecar explicitly verified this (App.tsx:60-65 reading). The rejection lands in the browser console; the user sees a frozen empty page with no UI feedback.

3. **The auth-token-expired mid-session reproduction is operator-actionable** — a user who leaves a tab open beyond the OAuth/OIDC session lifetime returns to find:
   - GET /api/search/{cached_uuid} returns 401
   - Thunk rejects; slice silent
   - URL retains the UUID; user sees empty Catalog page
   - Refresh re-fires the same GET → same 401 → same empty page
   - Recovery: manual logout + login (the OAuth flow re-establishes the session); OR strip the UUID from the URL (per REFACTOR-719 — recovery for stale UUIDs)

4. **Compounds with REFACTOR-719 (stale UUID broken page)** — the two scopes share the same failure mode (silent rejection + no recovery UX). Fix scope is unified: add `.catch` to useCreateSearch.ts AND useEffect-side error handlers in Search.tsx (lines 37-48) AND `.rejected` cases in slice.ts.

**Triangulation count after ZL**: 4 sidecars (was 1 — ToolbarTabs batch ZJ; ZL adds Search.tsx page-root + the App.tsx no-ErrorBoundary observation + the slice.ts no-.rejected observation + cross-reference to TermSearch batch-U).

**Severity unchanged**: MEDIUM. The composition-level confirmation tightens the failure-mode understanding but doesn't change the canonical fix (add `.catch` to both useCreateSearch + ToolbarTabs).

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-719 NEW this batch (stale UUID broken page — sibling silent-failure); REFACTOR-685 (no React error boundary anywhere — the canonical absence this defect exposes); ADR-CANDIDATE-236 (Catalog/Dictionary mint fresh search-id on click — the architecture that creates this failure-mode by design); ADR-CANDIDATE-052 (server-side search session — strengthened this batch).
- SUPERSEDES: none.
- CONFLICTS: none.

---

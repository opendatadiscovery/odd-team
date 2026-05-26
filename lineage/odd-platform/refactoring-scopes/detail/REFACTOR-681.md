## REFACTOR-681 — Clicking the AppToolbar's "Catalog" top-nav tab DROPS the user's current search session (`/search/{uuid}` → `/search`); the UX assumption "tab click = return to my search" is silently violated; Search.tsx creates a fresh empty session on the next mount

**Severity**: LOW
**Category**: UX-assumption-violated / silent-state-loss
**Batch**: ZI (2026-05-26)
**Pillars affected**: [P-01 Data Discovery]

**Surfaced by**:
- `odd-platform__ts__routes__route__search.md:bugs_limitations_corner_cases[2]` (LOW) — "**Clicking the 'Catalog' top-nav tab DROPS the current search session.** ToolbarTabs.tsx:38 links to `searchPath()` (no UUID). When a user has an active session at `/search/{uuid}` and clicks the 'Catalog' tab, the URL becomes `/search` (no param); Search.tsx:37-42 sees `!routerSearchId && !searchId` (Redux is reset on remount? or persists? — see Search.tsx:37-42 logic) and creates a NEW empty session via `useCreateSearch({query:'', pageSize:30, filters:{}})`. The user's previous filter state is lost (the URL no longer points at the prior UUID)."

**Description**: The AppToolbar (`components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:38`) declares the Catalog tab with `link: searchPath()` — calling the search builder with no argument, which returns the bare `/search` URL.

The operator workflow:
1. User opens Catalog at `/search`. The page renders, dispatches `createDataEntitiesSearch`, navigates to `/search/{uuid-1}`.
2. User filters: applies `Type=Dataset`, `Owner=Alice`. The URL stays `/search/{uuid-1}`; the backend mutates that row's facets.
3. User navigates away (clicks a data entity, goes to Activity, etc.).
4. User clicks the Catalog tab from anywhere.
5. URL becomes `/search` (no UUID).
6. Search.tsx remounts; `routerSearchId` is undefined.
7. Search.tsx dispatches `createDataEntitiesSearch` with empty filters → new session `{uuid-2}`.
8. URL becomes `/search/{uuid-2}` — empty filters, no Type, no Owner.
9. The previous session `{uuid-1}` (with Alice's datasets filter) is still on the server but is unreachable via the toolbar tab.

**The UX assumption that's violated**: most tab-based navigations preserve the user's previous state within the tab. ODD's other tabs (Activity, Lineage views on data entities, etc.) ARE either stateless (Activity loads with default 6-day window — see REFACTOR-679) or scoped to a specific entity context (Lineage tab scopes to the current data entity). The Catalog tab is unique in that it has SESSION-PERSISTENT state (the server-side `search_facets` row) BUT the toolbar tab link does not preserve the session.

**Why this is by design** (according to the implementation):
- A "fresh search" affordance is reasonable — operators returning to the Catalog tab may want a new search context.
- The previous session's row stays on the server (until TTL reaped — see REFACTOR-352).
- Browser back-button still works — pressing Back from `/search/{uuid-2}` returns to wherever the user came from, including potentially `/search/{uuid-1}` if that's in the history.

**Why the by-design choice is the wrong default**:
- An operator running a multi-step investigation ("filter to Alice's datasets, find a specific row, click into details, return to refine the filter further") loses the filter state at step 4 when they click the tab to return.
- The operator may have spent minutes building up the filter; the silent loss is frustrating.
- The alternative (toolbar tab links to the LAST `/search/{uuid}` the user was at) would preserve the workflow.

**Evidence**:
- `components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:38` (link: searchPath() — no UUID)
- `components/Search/Search.tsx:37-42` (the create-on-no-routerSearchId branch)
- `lib/hooks/useCreateSearch.ts` (the orchestrating hook)
- batch-M SearchController.search (the row-create endpoint)

**Existing-ADR-or-implied-prescription**:
- **ADR-CANDIDATE-052** (server-side search session) — the architectural decision; this scope is the UX-side gap where the architecture allows the session to persist but the navigation drops it.
- No prior ADR governs cross-tab session-preservation.

**Proposed remedy**: Two viable paths:

**Path A — Tab link preserves the last session UUID** (operator-friendly default):
- The AppToolbar tracks the last visited `/search/{uuid}` URL (in localStorage, or in Redux state).
- The Catalog tab link becomes `searchPath(lastVisitedSearchId)` if the user has visited a search session in the current browser tab; otherwise `searchPath()`.
- Tab click returns to the last session by default; a separate "New search" button (e.g. a "+" icon next to the tab, or an explicit option in the URL `?fresh=1`) creates a fresh session.

**Path B — Make the silent drop visible**:
- On tab click, if there's an unsaved filter, show a confirmation: "Discard current search filters?"
- More disruptive UX; less operator-friendly.

**Path C — Document the behaviour**:
- Update the live doc to explain the tab-click behaviour.
- Doesn't FIX the gap but warns operators.

Recommended: Path A — implements operator-friendly session continuity; uses the existing server-side session as the persistent state-carrier (the architecture already supports it; the UI just needs to remember the URL).

**Severity rationale**: LOW — operator-visible UX gap with concrete workflow consequences; severity bounded by the fact that the SERVER-SIDE row persists (no data loss; just navigation loss); the loss is recoverable IF the operator remembers the prior UUID (browser history or direct re-typing).

**Suggested backlog grouping**: `Search UX clarity sprint` (composes with REFACTOR-676, REFACTOR-680 — the search-route UX-clarity family).

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-676 (searchId drift), REFACTOR-680 (no UUID validation), ADR-CANDIDATE-052 (server-side session).
- SUPERSEDES: none.
- CONFLICTS: none.

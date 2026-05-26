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


## STRENGTHENS — Batch ZL (2026-05-26 — Search.tsx page-root sidecar confirms the Catalog-tab-drops-session UX at the COMPOSITION layer)

The Search.tsx page-root sidecar surfaces the same "Catalog tab drops current session" defect at the COMPOSITION layer — the page-root mounted at App.tsx:61 IS what unconditionally fires `createSearch` whenever `routerSearchId` is undefined, which IS the case when the user clicks the AppToolbar Catalog tab (which links to bare `searchPath()` without UUID).

**New surfaced_by entries**:

- `odd-platform__ts__react-component__component__Search.md:stress_findings.name_behavior_pairs[3]` (MINOR drift) — "Catalog tab / top-nav 'Catalog' link: Tab labelled 'Catalog' takes the user to the catalog of all data entities. Per batch-ZH ToolbarTabs sidecar, the top-nav 'Catalog' tab links to searchPath() (no UUID) → /search. Clicking it from any context (including from within an in-progress session at /search/{uuid}) DROPS the current session and creates a new one (Search.tsx:37-42 fires because routerSearchId is undefined). The prior session UUID is orphaned server-side until housekeeping reaps it. ... Operator inside a filtered Catalog view who clicks the 'Catalog' tab loses their filter selections — the new session has empty filters. Pattern: the navigation back to the top is non-idempotent (the tab click does not preserve session state). Operators expecting 'tab clicks are no-ops if I'm already there' are surprised."

- `odd-platform__ts__react-component__component__Search.md:upstream_callers[1]` (HIGH) — "ui_button:top-nav-Catalog-tab — ToolbarTabs.tsx:38 + 93 (per batch-ZH sidecar) — top-nav 'Catalog' tab Link points to `searchPath()` (no UUID), so clicking it from any page lands on `/search` with NO `:searchId` param; Search.tsx:37-42 then fires createSearch (because `routerSearchId` is undefined). Net behaviour: clicking the 'Catalog' top-nav tab DROPS the user's prior session and creates a fresh one — the prior session UUID is orphaned server-side until housekeeping reaps it."

**What this strengthening adds**: prior coverage anchored the defect at the ToolbarTabs Link layer. Batch ZL adds the page-root SIDE — Search.tsx is the consumer that EXECUTES the session-drop logic on the receiving end:

1. **Search.tsx:37-42 is the EXECUTOR of the session-drop** — the `useEffect` checks `if (!routerSearchId && !isSearchCreating && !searchId) createSearch(...)`. When the ToolbarTabs Catalog link lands the user at `/search` (no UUID), `routerSearchId` is undefined; the guard short-circuits to TRUE; createSearch fires; a new UUID is minted.

2. **The architecture is the CAUSE; the implementation is the CONSEQUENCE** — ADR-CANDIDATE-236 (Catalog/Dictionary tabs mint fresh search-id on click) codifies the deliberate choice. The Search.tsx page-root is the consumer that materializes that choice. The defect is in the LINK CHOICE (ToolbarTabs.tsx:38 uses `searchPath()` not `searchPath(currentSearchId)`), NOT in Search.tsx.

3. **Compounds with REFACTOR-694 (unhandled rejection on createSearch)** — the tab-click drops the session AND if the new createSearch rejects, the user lands on a frozen empty page (per REFACTOR-694 strengthening this batch).

4. **The fix scope is at the LINK layer, not the page-root layer** — Search.tsx is doing the right thing given the URL it receives; the fix is to either:
   - Update ToolbarTabs.tsx:38 to link to `searchPath(currentSearchId)` if a session exists (preserve the session)
   - OR document the deliberate "tab click = new session" choice (acknowledge the trade-off)
   - The ADR-CANDIDATE-236 dispatcher (Catalog tab mints fresh search-id on click) anchors the architectural choice; this scope is the OPERATOR-FACING consequence.

**Triangulation count after ZL**: 3 sidecars (was 2 — ToolbarTabs sidecar + ADR-CANDIDATE-236; ZL adds the Search.tsx page-root EXECUTION side).

**Severity unchanged**: MEDIUM. The composition-level confirmation tightens the architectural understanding without changing the canonical fix (fix at the LINK CHOICE).

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-236 (Catalog/Dictionary mint fresh search-id on click — the architecture this defect is the failure-mode of); REFACTOR-694 (unhandled rejection — compounds with this on the failure path); ADR-CANDIDATE-052 (server-side search session — strengthened this batch).
- SUPERSEDES: none.
- CONFLICTS: none.

---

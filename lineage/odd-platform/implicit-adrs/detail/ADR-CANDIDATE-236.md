## ADR-CANDIDATE-236 — Clicking the Catalog or Dictionary tab MINTS A FRESH server-side search-id BEFORE navigation (deliberate UX "restart the search flow" stance); the other 7 tabs are pure react-router-dom `<Link>` navigations

**Severity**: MEDIUM
**Classification**: promote
**Batch**: ZJ (2026-05-26)
**Pillars affected**: [P-01 Data Discovery (Catalog/Search), P-02 Data Glossary (Dictionary/Term Search)]

**Surfaced by**:
- `odd-platform__ts__components_shared_elements_AppToolbar_ToolbarTabs__ui-shell-widget__ToolbarTabs.md:implicit_adrs[2]` (HIGH) — "Catalog and Dictionary tabs create fresh search state on every click (search-id minting before navigation) — evidence: ToolbarTabs.tsx:107-126 — intent_anchor: 'the explicit `dispatch(createTermSearch(...)).unwrap().then(({searchId}) => navigate(...))` pattern at lines 112-117 and the parallel `createSearch(initialParams)` call at line 122 — the design intent is that clicking \"Dictionary\" or \"Catalog\" from the toolbar restarts the search flow (versus restoring a previous search), giving the user a deterministic starting point' — confidence: HIGH"

**Decision statement**: The platform's primary navigation tabs operate in TWO modes. The Catalog (`tabs[0]`) and Dictionary (`tabs[6]`) tabs override the default `<Link to=...>` navigation with a thunk-then-navigate `onClick` handler (`ToolbarTabs.tsx:107-126`). The handler dispatches `createDataEntitiesSearch` (Catalog) or `createTermSearch` (Dictionary), awaits a server-side `searchId`, and only then navigates the user to `/search/<newId>` or `/termsearch/<newId>`. The other 7 tabs (Directory / Data Quality / Data Modelling / Master Data / Management / Alerts / Activity) are pure `<Link>` navigations rendered by `AppLinkTab` — no JS handler intercept, no backend dispatch, no side effects beyond the URL change.

The intent: clicking "Catalog" or "Dictionary" from the toolbar RESTARTS the search flow with a fresh search-id. The user lands on a clean search surface; the previous search-id (if any) is left behind. This is the deliberate UX stance for the two SEARCH-ROOTED features — they have search-id-bound URL schemas (`searchRoutes.ts:4` `/search/:searchId`, `termsRoutes.ts:5` `/termsearch/:searchId`), so simply navigating to the bare path is impossible. The author chose "mint a fresh id and navigate" over "remember the last search-id and navigate".

**Wisdom test (3-question)**:
1. *Intentional?* YES — the explicit `dispatch(...).unwrap().then(({searchId}) => navigate(...))` pattern at lines 112-117 + the parallel `createSearch(initialParams)` at line 122 are deliberate — the author wrote the override on purpose. The other 7 tabs do NOT have this handler, showing the maintainer chose to apply the pattern ONLY where the URL schema requires an id.
2. *Structural impact?* YES — the choice shapes the UX semantics of two of nine primary tabs. Operators clicking "Catalog" expect to LAND on a usable search surface (not a list of saved searches; not the last search they ran); the deliberate fresh-id minting is what makes that consistent. The decision also has SERVER-SIDE consequences: every click mints a search-id row server-side (cross-ref REFACTOR-694 NEW this batch for the silent-failure case, where a rejected thunk leaves the user on the previous page with no feedback).
3. *Refactoring or structural?* STRUCTURAL — switching to "restore the last search-id from session storage" or "use a sentinel `/search/new` URL the backend assigns server-side" would change the UX contract. The fresh-id-on-click stance is architectural.
→ ADR.

**Evidence**:
- ToolbarTabs.md says: "Catalog and Dictionary tabs create fresh search state on every click (search-id minting before navigation)"
- ToolbarTabs.tsx:107-126 (the handleTabClick branch + the createTermSearch dispatch)
- useCreateSearch.ts:14-19 (the Catalog-side wrapper)
- searchRoutes.ts:4 (`/search/:searchId` URL schema)
- termsRoutes.ts:5 (`TERMS_SEARCH_PATH = '/termsearch'`)

**Existing ADR**: none for the fresh-id-on-click choice. Composes with ADR-CANDIDATE-235 NEW this batch (the 9 hard-coded tabs); this ADR carves out the two-of-nine override.

**Proposed action**: Promote to `adrs/drafts/toolbar-tabs-fresh-search-on-click.md` (new ADR). Document:
- The two-tab override and its scope (Catalog + Dictionary only; explicitly NOT applied to other tabs).
- The UX intent (restart the search flow, deterministic starting point).
- The server-side consequence (orphaned search-id rows; cross-ref REFACTOR-694 for silent-failure).
- The implied URL schema constraint (a future tab pointing at a search-id-bound URL would need to follow this convention).

**Severity rationale**: MEDIUM — pattern-shaping UX architecture; uniformly applied across the two search-rooted tabs; observable to operators (clicking Catalog always lands on a fresh search surface). Not HIGH because the decision is bounded to two of nine tabs. Not LOW because it codifies a load-bearing UX semantic the user relies on every time they click the navigation.

**Suggested backlog grouping**: `UI architecture codification`.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-694 NEW this batch (Catalog/Dictionary silent thunk rejection — the absent `.catch()` on the `.unwrap().then()` chain leaves the user on the previous page with no feedback if the create-thunk rejects).
- REFACTOR-681 (Catalog tab DROPS current search session — semantically composes with this ADR's "fresh search" stance; the operator-visible cost of the design choice).
- REFACTOR-676 (`:searchId` URL path-segment binds to server-side session UUID; not a saved-search id) — the URL semantics this ADR depends on.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-235 NEW this batch (the 9-tab taxonomy that this ADR overrides for two tabs).
- SUPERSEDES: none.
- CONFLICTS: none.

---

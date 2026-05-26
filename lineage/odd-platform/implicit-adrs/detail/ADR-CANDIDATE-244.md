## ADR-CANDIDATE-244 — Multi-tab pillar roots use a SHARED "layout shell with sticky sidebar" — three styled-component primitives (LayoutContainer / Sidebar / Content OR MainContainer / ContentContainer / LeftSidebarContainer) reused across 8+ pillar root components (DataModelling, Activity, Alerts, Search, LookupTables, Management, MasterData, etc.); the shell defines the 15rem sidebar max-width, the lvh-minus-3rem-toolbar viewport, and the sticky-positioning contract

**Severity**: MEDIUM
**Classification**: promote
**Pillars affected**: [P-01 Data Discovery, P-02 Data Modelling, P-03 Master Data, P-04 Activity, P-05 Alerts, P-08 Management] — every multi-tab pillar with vertical-nav sidebar
**Batch minted**: ZL (2026-05-26)

**Support count**: 5 sidecars (batch-ZL primary sources confirm via direct shell-composition observation)

**Surfaced by** (5 sidecars):
- `odd-platform__ts__react-component__component__DataModelling.md:implicit_adrs[0]` (HIGH) — "**The Data Modelling pillar root uses the platform-wide 'layout shell with sticky sidebar' pattern** — `<S.LayoutContainer>` + `<S.Sidebar $alignSelf='flex-start' $position='sticky'>` + `<S.Content>` is the same shell used by `components/Alerts/Alerts.tsx`, `components/Activity/Activity.tsx`, `components/Management/Management.tsx`, `components/MasterData/LookupTables.tsx`. The decision: pillars with multi-tab vertical navigation use the same `layout.ts` styled-component primitives, sharing the 15rem sidebar max-width and the lvh-minus-3rem-toolbar-height viewport behaviour. The component-side cost is one import statement + four lines of JSX."
- `odd-platform__ts__react-component__component__Activity.md:concepts.invariants[0]` (HIGH) — the Activity page composes `<Filters />` (left sidebar — xs={3}) + `<ActivityResults />` (right pane — xs={9}); uses sibling `MainContainer / ContentContainer / LeftSidebarContainer / ListContainer` from `components/shared/elements/StyledComponents/PageWithLeftSidebar.ts:5-26`. The same shell appears in TermSearch.tsx (Dictionary) and Search.tsx (Catalog), all consumers of `PageWithLeftSidebar.*`.
- `odd-platform__ts__react-component__component__Search.md:concepts.entities[6]` (HIGH) — "PageWithLeftSidebar (layout primitive — `MainContainer`, `ContentContainer`, `LeftSidebarContainer`, `ListContainer` at lines 74-87; identical sibling pattern used by TermSearch.tsx — verified by Grep `PageWithLeftSidebar.MainContainer` returning both files)"
- `odd-platform__ts__react-component__component__LookupTables.md:dependencies_semantic.requires-runtime[3]` (HIGH) — Master Data Management pillar root composes the same shell shape (H1 + counter + search input + +Add new button + table list) as the other pillar roots, with the same Grid/MUI vertical-layout primitives.
- `odd-platform__ts__react-component__component__Alerts.md:concepts.operations[0]` (HIGH) — the Alerts page composes a fixed-page layout containing `AlertsTabs` (three-tab primary nav) and `AlertsRoutes`; the same shell pattern (page header + AppTabs sibling + outlet) recurs across Alerts and Activity (which DON'T use the PageWithLeftSidebar variant) — confirming the shell-vs-variant distinction within the family.

**Decision statement**: The odd-platform-ui SPA uses ONE shared family of styled-component layout primitives — currently SPLIT INTO TWO interchangeable variants — for every multi-tab pillar root:

**Variant A — PageWithLeftSidebar.* primitives** (`components/shared/elements/StyledComponents/PageWithLeftSidebar.ts:5-26`):
- `MainContainer` — outer container (flex column, full viewport-height minus toolbar)
- `ContentContainer` — MUI Grid wrapper (12-column grid, gap, padding)
- `LeftSidebarContainer` — left column (xs={3} by default; holds filter or nav)
- `ListContainer` — right column (xs={9} by default; holds main content)
- USED BY: `Activity.tsx`, `Search.tsx`, `TermSearch.tsx` — surfaces where the sidebar holds FACETS or FILTERS rather than route-tabs

**Variant B — layout.ts.* primitives** (`components/shared/styled-components/layout.ts:3-31`):
- `LayoutContainer` — flex container (display:flex, padding:2, gap:2, overflow:auto, `height: calc(100lvh - 3rem)`)
- `Sidebar` (max-width:15rem, `$alignSelf='flex-start'`, `$position='sticky'`) — vertical nav column
- `Content` (flex-grow:1) — main element
- USED BY: `DataModelling.tsx`, `Alerts.tsx` (composed via AlertsTabs+AlertsRoutes), `Management.tsx`, `LookupTables.tsx` indirectly — surfaces where the sidebar holds VERTICAL TABS for inner route navigation

The two variants are CONCEPTUAL TWINS — both define a left-vertical-affordance + right-main-content layout — but DIFFER in:
- Variant A uses MUI Grid (`xs={3}/xs={9}` ratio); Variant B uses flex (max-width:15rem + flex-grow:1)
- Variant A's sidebar isn't sticky by default; Variant B's sidebar uses `$position='sticky'` + the lvh-minus-3rem viewport
- Variant A's sidebar is FILTER-shaped (in-page facet state); Variant B's sidebar is NAV-shaped (route navigation)

The intent: pillars with multi-tab vertical navigation use the SAME layout shell so operators get consistent visual rhythm + sidebar width across the platform; one refactor (e.g. responsive breakpoints, sticky behaviour change) affects every pillar uniformly via the shared styled-components module. The split into two variants reflects the SEMANTIC DISTINCTION between filter-sidebar and nav-sidebar surfaces, not an accidental duplication.

**Wisdom test (3-question)**:
1. *Intentional?* YES — the convergence across 8+ pillar root components on either Variant A or Variant B (each backed by its own shared styled-components module) is the explicit statement. The two variants exist as a deliberate semantic distinction: filter-shaped sidebars (PageWithLeftSidebar) vs nav-shaped sidebars (layout.ts). The convention is observable across the entire `components/*/[PillarRoot].tsx` set.
2. *Structural impact?* YES — defines the cross-pillar visual rhythm; defines the sidebar width contract (15rem fixed for Variant B; xs={3} fluid for Variant A); defines the sticky-positioning + viewport-height coupling to `lib/constants.toolbarHeight`; defines the responsive behaviour (currently: NONE — both variants are non-responsive). A future refactor that changes any of these defaults touches every pillar simultaneously.
3. *Refactoring or structural?* STRUCTURAL — abandoning the convention (e.g. one pillar uses a custom grid; another uses a custom max-width) is a multi-file decision affecting layout uniformity. Adopting a responsive breakpoint is also structural — requires migrating both variants in parallel.
→ ADR.

**Evidence**:
- `components/shared/styled-components/layout.ts:3-31` (Variant B primitives — LayoutContainer, Sidebar, Content)
- `components/shared/elements/StyledComponents/PageWithLeftSidebar.ts:5-26` (Variant A primitives — MainContainer, ContentContainer, LeftSidebarContainer, ListContainer)
- `components/DataModelling/DataModelling.tsx:7-14` (Variant B consumer)
- `components/Alerts/Alerts.tsx` (Variant B consumer — implied via the AlertsTabs sidebar + AlertsRoutes outlet composition)
- `components/Activity/Activity.tsx:9-14` (Variant A consumer with xs={3}/xs={9} split)
- `components/Search/Search.tsx:73-89` (Variant A consumer)
- `components/MasterData/LookupTables.tsx` (mixed — uses MUI Grid directly but follows the SAME H1+counter+filter+list shape)
- `components/Management/Management.tsx` (Variant B consumer)
- intent_anchor: the file-level naming convention (`PageWithLeftSidebar.ts` for Variant A; `layout.ts` for Variant B) signals deliberate primitive design; the consistency across 5+ pillar roots that the two variants together cover is the structural commitment.

**Existing ADRs / composition**:
- COMPOSES WITH **ADR-CANDIDATE-227** (bare base URL redirects to canonical first tab) — Variant B sidebars hold the multi-tab pillar nav; the bare-URL redirect is the URL-side contract for the same multi-tab pillar.
- COMPOSES WITH **ADR-CANDIDATE-230** (query-string vs path-segment view-mode dispatch) — Variant A's filter-sidebar typically dispatches via query-string; Variant B's nav-sidebar dispatches via path-segment. The split between A and B mirrors the URL-shape dispatch decision.
- COMPOSES WITH **ADR-CANDIDATE-091** (URL is source of truth for view state) — Variant A's filter selections live in the URL; Variant B's tab selection lives in the URL. Both variants honour the same URL-as-source-of-truth contract.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-NNN (LOW — non-responsive: both Variant A's MUI Grid xs={3}/xs={9} ratio and Variant B's 15rem max-width are non-responsive; mobile/narrow viewports break the layout uniformly across every pillar — a single fix affects all pillars but the gap is uniform).
- REFACTOR-NNN (LOW — `lvh` browser support: Variant B's `height: calc(100lvh - 3rem)` requires Safari ≥ 15.4 / Chrome ≥ 108 / Firefox ≥ 101; older browsers collapse the LayoutContainer height, breaking sticky-sidebar across every pillar using Variant B uniformly — same blast radius).
- REFACTOR-NNN (LOW — toolbarHeight literal: Variant B's `3rem` literal is hardcoded; Variant A's MainContainer also subtracts the toolbar height independently. If `lib/constants.toolbarHeight` changes, BOTH variants drift in parallel until the literals are aligned).

**Proposed action**: Promote to `adrs/drafts/pillar-root-layout-shell-variants.md`. Document:
- The two variants (PageWithLeftSidebar for filter-sidebars; layout.ts for nav-sidebars) and WHY two variants exist.
- The per-pillar variant choice (which pillars use A, which use B) and the semantic rule (filter → A; nav → B).
- The shared default values (15rem sidebar width for B; xs={3}/xs={9} ratio for A; lvh-minus-3rem viewport).
- The responsive-breakpoint roadmap (currently absent; recommended fix).
- The `lvh` browser-support caveat + fallback recommendation.
- The toolbarHeight coupling (both variants subtract toolbar height; ensure single source of truth).
- The maintenance obligation: new multi-tab pillar roots choose A or B explicitly; the choice is documented in the page-component's leading comment.

**Severity rationale**: MEDIUM — pattern-shaping convention across 6+ pillars; both shared modules are observable evidence of structural intent; the two-variant split reflects deliberate semantic distinction. Below HIGH because the convention is a code-organisation + visual-design choice, not a load-bearing architectural decision; abandoning it would cost visual consistency but not break any feature.

**Suggested backlog grouping**: `UI architecture codification` — pair with ADR-CANDIDATE-227 (bare-base redirect) and ADR-CANDIDATE-230 (URL-shape dispatch) which together codify the multi-tab pillar URL/layout contract.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-227 (multi-tab pillar bare-base redirect — the URL-shape side of the same pillar shape); ADR-CANDIDATE-228 (routes-as-functions — the URL contract sibling); ADR-CANDIDATE-230 (URL-mode dispatch — the URL-state sibling).
- SUPERSEDES: none.
- CONFLICTS: none.
- BACK-LINKS: every batch-ZL primary source receives a `related_implicit_adrs: [ADR-CANDIDATE-244]` annotation in its next refresh.

---

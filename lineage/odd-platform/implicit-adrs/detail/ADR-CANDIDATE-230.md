## ADR-CANDIDATE-230 — Per-feature view-mode dispatch lives in QUERY-STRING parameters (`?type=`, `?q=`), NOT in URL path segments — divergence from the path-segment pattern used by alerts (`/alerts/all|my|dependents`) is deliberate; query-string form is preferred when the view modes are filter-shaped (semantically narrow the result set) and the path-segment form is preferred when the view modes are resource-class-shaped (distinct entities, distinct policies)

**Severity**: MEDIUM
**Classification**: promote
**Pillars affected**: [P-01 Data Discovery, P-02 Data Modelling, P-04 Activity, P-05 Alerts] — every pillar with a multi-view list surface

**Support count**: 3 sidecars (activity + search + relationships explicitly surface the query-string pattern; relationships uses both `?q` + `?type`; alerts contrast confirmed)

**Surfaced by**:
- `odd-platform__ts__routes__route__activity.md:implicit_adrs[1]` (HIGH) — "The Activity feature encodes its sub-views (`ALL` / `MY_OBJECTS` / `DOWNSTREAM` / `UPSTREAM`) as a `type` query parameter rather than as URL path segments, deliberately diverging from the alerts pattern (which uses `/alerts/all`, `/alerts/my`, `/alerts/dependents` path segments declared in `AlertsRoutes`). This means deep-linking a colleague to 'my activity feed' yields `/activity?type=MY_OBJECTS` (a query) rather than `/activity/my` (a path)."
- `odd-platform__ts__routes__route__relationships.md:concepts.invariants[3]` + `bugs[?]` — "`q` and `type` query parameters are URL-state, not component-state — every change writes to `setSearchParams` (`RelationshipsSearchInput.tsx:10-11`, `RelationshipsTabs.tsx:38-41`) which updates the browser URL; a refresh restores the filter state from URL; a deep-link with `?q=foo&type=ERD` lands directly on the filtered view."
- `odd-platform__ts__routes__route__search.md:invariants[3,4]` — "No URL state beyond the session UUID — no query-string params, no hash fragments." (the search route is the COUNTER-EXAMPLE — it uses neither query-string nor path-segment for view modes; the session UUID IS the view-state container — see ADR-CANDIDATE-052 for the server-side-session pattern that supersedes URL-state for search specifically)
- alerts route sidecar (batch ZH) `implicit_adrs` — "view modes via path segments `/alerts/all|my|dependents`" (the contrasting convention)

**Decision statement**: The odd-platform-ui SPA uses TWO distinct conventions for encoding multi-view list surfaces, and the choice between them is intentional based on the semantic shape of the view modes:

**Convention A — Query-string parameters** (used by Activity, Relationships, Data Quality, others):
- View modes are FILTER-SHAPED — they semantically narrow the result set of an underlying query (e.g. activity-by-type, relationships-by-class).
- Deep-links: `/activity?type=MY_OBJECTS&size=30`; `/data-modelling/relationships?type=ERD&q=orders`.
- The URL accumulates state as the user interacts; `useSearchParams` is the React Router hook reading/writing the params.
- Tab switching = `setSearchParams(prev => ({ ...prev, type: newType }))` (not a route navigation).
- The component tree is STATIC across view modes; only the data-fetch params change.

**Convention B — URL path segments** (used by Alerts):
- View modes are RESOURCE-CLASS-SHAPED — they identify distinct entities, distinct backend endpoints, distinct policies.
- Deep-links: `/alerts/all`, `/alerts/my`, `/alerts/dependents` (three separate routes).
- Each path segment is a separate `<Route>` declaration in `AlertsRoutes.tsx`.
- Tab switching = React Router navigation (`<Link to=...>`); the component re-mounts.
- The component tree can differ across view modes (one route can use a different element).

**Convention C — Server-side session UUID** (used by Search; ADR-CANDIDATE-052 codifies the backend pattern):
- View modes are STATE-CONTAINER-SHAPED — the URL is just a handle to a persistent server-side state object.
- Deep-links: `/search/{uuid}` — the state is on the server.
- This is a parallel pattern, not a competitor to A or B; it exists for surfaces where view state must persist server-side (cross-call session continuity, multi-step refinement, drill-down history).

**The maintainer's choice between A and B**: ZI's three sidecars converge on the same heuristic — "filter the same list → query-string; navigate to a different resource → path segment." Alerts split into three separate path segments because each is a distinct query (my alerts vs. all alerts vs. dependent-entity alerts) with potentially different backend authorization gates and different result-types. Activity's four type modes (ALL / MY_OBJECTS / DOWNSTREAM / UPSTREAM) all hit the SAME `/api/activity` endpoint with a different `type` parameter — so the URL form mirrors the backend reality.

**Wisdom test (3-question)**:
1. *Intentional?* YES — the alerts/activity divergence is explicit and the sidecars EXPLICITLY contrast the two patterns. The activity sidecar says "deliberately diverging from the alerts pattern". A future maintainer can see both shapes in `routes/` and apply the right one.
2. *Structural impact?* YES — defines URL-shape contract per pillar, defines deep-link semantics, defines how view modes interact with backend routes + authorization.
3. *Refactoring or structural?* STRUCTURAL — switching activity from `?type=` to `/activity/{type}` would require new `<Route>` declarations, deletion of `setSearchParams` code, a redirect from the old URL form, and a different component-mount strategy. Multi-file, contract-changing.
→ ADR.

**Evidence**:
- `activityRoutes.ts:1-7` (no sub-paths) + `ActivityTabs.tsx:58-61` (tab clicks call `setQueryParams(prev => ({ ...prev, type: newActivityType }))`)
- `Relationships.tsx:17-19` (reads `?q` and `?type` via `useSearchParams`) + `RelationshipsTabs.tsx:34-43` (writes `?type` via `setSearchParams`) + `RelationshipsSearchInput.tsx:9-12` (writes `?q`)
- `alertsRoutes.ts:1-13` (path-segment declarations for `all`, `my`, `dependents`) + alerts batch-ZH sidecar `implicit_adrs[1]`
- `searchRoutes.ts:1-19` (path-segment for session UUID — the third convention, codified at ADR-CANDIDATE-052)
- intent_anchor: the activity sidecar's explicit phrase "deliberately diverging from the alerts pattern"

**Existing ADRs / composition**:
- COMPOSES WITH **ADR-CANDIDATE-228** (routes-as-functions) — both URL-state conventions are exposed through the path-builder convention; `activityPath(query?)` accepts a query string, `alertsPath(path?)` accepts a sub-path.
- COMPOSES WITH **ADR-CANDIDATE-227** (bare base URL redirects to canonical first tab) — applies to path-segment-style multi-tab pillars (Alerts redirects `/alerts` → `/alerts/all`); does NOT apply to query-string-style pillars (Activity's `/activity` IS the canonical URL; `?type=ALL` is the implicit default).
- COMPOSES WITH **ADR-CANDIDATE-052** (server-side search session) — search uses Convention C (server-side session UUID); the convention is orthogonal to A/B.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-{new this batch} — activity's default-window URL not stamped (the 6-day window is recomputed at module-eval time, so deep-links drift across share-time)
- REFACTOR-{new this batch} — searchRoutes' `searchId` Category F drift (path-segment promises saved-search id but binds to server-side session UUID — ADR-052 codifies the semantic)

**Proposed action**: Promote to `adrs/drafts/ui-view-mode-dispatch-conventions.md`. Document:
- The three conventions (query-string, path-segment, server-side session).
- The heuristic for choosing between A and B.
- The current per-pillar choices + their rationale.
- The maintenance obligation: every new multi-view list surface picks A, B, or C deliberately; the choice is recorded in the route module's docstring or in a code comment.
- The migration consequence: switching a pillar between A and B is a multi-file refactor + a URL-deprecation period + a documentation update.

**Severity rationale**: MEDIUM — pattern-shaping convention across 4 pillars; the alerts/activity contrast is the canonical evidence; the convention informs every future multi-view-surface decision.

**Suggested backlog grouping**: `UI architecture codification`.


## STRENGTHENS — Batch ZL (2026-05-26 — Alerts page-root + Activity page-root + Search page-root sidecars triangulate the three conventions on the COMPONENT side)

Batch ZL's three page-root sidecars (Alerts + Activity + Search) ALL surface the three conventions explicitly at the React-component layer, completing the URL-mode-dispatch story end-to-end (route module → page-root → child siblings).

**New surfaced_by entries**:

- `odd-platform__ts__react-component__component__Alerts.md:concepts.invariants[2]` (HIGH) — "Default route `/alerts` redirects to `/alerts/all` (`AlertsRoutes.tsx:18`)." — confirms Convention B (URL path-segment) at the component-tree layer.

- `odd-platform__ts__react-component__component__Activity.md:implicit_adrs[1]` (HIGH) — "Sub-views (`ALL` / `MY_OBJECTS` / `DOWNSTREAM` / `UPSTREAM`) are encoded as a `type` query parameter rather than as URL path segments, deliberately diverging from the alerts pattern (`/alerts/all`, `/alerts/my`, `/alerts/dependents`). Tab clicks call `setQueryParams(prev => ({...prev, type: newActivityType}))` (`ActivityTabs.tsx:58-61`) rather than triggering React Router navigation." — confirms Convention A (query-string) at the component-tree layer; the EXPLICIT CONTRAST with Alerts is re-asserted.

- `odd-platform__ts__react-component__component__Search.md:implicit_adrs[0]` (HIGH) — "**Server-side search session model with URL-backed UUID — the canonical/older pattern (TermSearch.tsx batch U clones it).**" — confirms Convention C (server-side session UUID) at the component-tree layer.

**What this strengthening adds**: prior support was at the ROUTE-MODULE layer (batch ZI surfaced the 3 conventions in `routes/`). Batch ZL adds the COMPONENT-TREE layer — how the page-root React components actually dispatch view modes:

1. **Alerts (Convention B — path-segment)** — page-root composes `<AlertsTabs/>` + `<AlertsRoutes/>`; AlertsTabs handles tab-click → React Router navigation; AlertsRoutes declares 3 `<Route>` for `/all`, `/my`, `/dependents`; the bare-`/alerts` redirects via `<Navigate to='all'>`. Component-tree shape: NESTED Routes, each tab is a sibling Route.

2. **Activity (Convention A — query-string)** — page-root composes `<Filters/>` + `<ActivityResults/>`; `<ActivityResults>` composes `<ActivityTabs/>` + `<ActivityResultsList/>`; ActivityTabs dispatches `setQueryParams({type: newType})` instead of navigation; the URL becomes `/activity?type=MY_OBJECTS` not `/activity/my`. Component-tree shape: FLAT children, view-mode is a queryParams field, no Routes nesting.

3. **Search (Convention C — server-side session)** — page-root composes `<Filters/>` + `<MainSearch/>` + `<Results/>`; first-mount dispatches `createDataEntitiesSearch` → `navigate(searchPath(searchId))`. The URL becomes `/search/{uuid}`; the UUID is just a state-handle to the server-side session row. Component-tree shape: FLAT children, view-state is in Redux + server-persisted; URL is a session pointer not a view-mode dispatcher.

**The three component-tree shapes are now triangulated**: nested-Routes-per-tab (B) vs flat-children-with-queryParam (A) vs flat-children-with-session-UUID (C). A future maintainer can read THIS ADR and immediately know which component-tree shape to produce for a given view-mode dispatch choice.

**Triangulation count after ZL**: 6 sidecars (was 3 — batch ZI route-modules: activity + relationships + search; ZL adds 3 page-root components: Alerts + Activity + Search).

**Severity unchanged**: MEDIUM — pattern-shaping convention; component-tree confirmation tightens the ADR's reach across the codebase.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-227 (bare-base redirect — Alerts pattern confirmed); ADR-CANDIDATE-228 (routes-as-functions — all 3 page-roots consume path builders from `routes/`); ADR-CANDIDATE-245 NEW this batch (multi-tab Redux single-slot — applies to Alerts Convention B); ADR-CANDIDATE-052 (server-side search session — Convention C is its component-tree manifestation); ADR-CANDIDATE-091 (URL-as-source-of-truth — Convention A's queryParam IS the URL state).
- SUPERSEDES: none.
- CONFLICTS: none.

---

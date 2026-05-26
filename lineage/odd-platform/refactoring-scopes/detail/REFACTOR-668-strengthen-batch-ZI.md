## STRENGTHENS — Batch ZI (2026-05-26 — UI Routes 2: 3 more route mounts confirm the misleading-Provider pattern + 1 sub-route inheritance instance)

Batch ZI adds three further route mount sites and one sub-route inheritance instance to REFACTOR-668's evidence base.

**New surfaced_by entries**:

- `odd-platform__ts__routes__route__activity.md:bugs_limitations_corner_cases[0]` (HIGH) — "The route `<Route path={activityPath()} element={<Activity />} />` at `App.tsx:65` has NO `WithPermissionsProvider` wrapper. Unlike `lookupTablesPath()` at `App.tsx:75-87` — which gates render on `LOOKUP_TABLE_CREATE | UPDATE | DELETE` permissions — the Activity route is rendered for every authenticated user regardless of role / owner / permission. The platform-wide audit trail is therefore globally visible. Note also (ZH systemic finding): even where `WithPermissionsProvider` IS used, it ONLY provides a permission CONTEXT for descendants to consult; it does NOT block render or redirect on its own."

- `odd-platform__ts__routes__route__search.md:bugs_limitations_corner_cases[1]` (MEDIUM) — "No UI route guard — Catalog page reachable by every authenticated user (and unauthenticated when `auth.type=DISABLED`). Contrast with App.tsx:75-88 where `lookupTablesPath()` IS wrapped... ZH batch's `WithPermissionsProvider` non-blocking finding (WithPermissionsProvider.tsx:18-48 — it's a CONTEXT provider, not a gate; always renders children regardless of permission) reinforces that even where it IS used in Search.tsx:81-85, it only context-provides for the `<WithPermissions>` consumer inside Results — the route-mount level is wholly unguarded."

- `odd-platform__ts__routes__route__queryExamples.md:bugs_limitations_corner_cases[5]` (LOW) — "The sub-route inherits the non-blocking-guard semantics from the parent (per the ZH dataModelling parent sidecar). The `WithPermissionsProvider` at `DataModellingRoutes.tsx:19-25` (LIST) and `:31-37` (DETAILS) wraps the rendered component in a permission CONTEXT (NOT a gate). A user without `QUERY_EXAMPLE_CREATE` who navigates to `/data-modelling/query-examples` sees the page; the Add button is hidden by `WithPermissions` inside `QueryExamples.tsx:36-46`."

- `odd-platform__ts__routes__route__directory.md:bugs_limitations_corner_cases[0]` (MEDIUM) — "No client-side permission gate at the URL declaration's only mount site (`App.tsx:72`). The consumer mounts a BARE `<Route path={\`${directoryPath()}/*\`} element={<DirectoryRoutes />} />` without a `WithPermissionsProvider` wrapper, contrasting the sibling `/lookup-tables` route... Whether the Directory data is gated at the BACKEND endpoint is pinned by the backend `DirectoryController` sidecar: NO `@PreAuthorize`, NO entry in `SecurityConstants.SECURITY_RULES`."

**What this strengthening adds**: ZI extends the count of misleading-Provider OR absent-when-it-should-be-Provider mounts. The four routes split as:

| Route mount | Provider state at route mount | Auditor's expected gate vs reality |
|---|---|---|
| `/activity` (App.tsx:65) | NONE | NONE expected (silent on docs) — read-collaborative posture confirmed but undocumented (composes with REFACTOR-053) |
| `/search` (App.tsx:61) | NONE | NONE — read-collaborative posture; same shape as relationships per ADR-229's negative-control |
| `/directory` (App.tsx:72) | NONE | NONE — read-collaborative posture confirmed by backend DirectoryController sidecar |
| `/data-modelling/query-examples` + `:queryExampleId` | Provider with `[QUERY_EXAMPLE_CREATE]` / `[UPDATE, DELETE]` | Auditor would read this as GATED; reality is open — the audit-misleading case |

The QUERYEXAMPLES instance is the load-bearing addition: it confirms the misleading-Provider pattern is NOT a one-pillar accident (lookup-tables) but a recurring design instinct that pollutes the Data Modelling pillar too. The activity + search + directory instances are the negative-control class — when the route is read-only AND open by design, the convention correctly OMITS the Provider, leaving the absence silent (which is itself a doc gap, but not an audit-misleading drift).

**Triangulation count after ZI**: 8 route mounts (was 4 after batch ZH — lookupTables + query-examples list + query-examples details + management subtree; ZI adds activity + search + directory + the queryExamples sub-route inheritance confirmation, plus relationships as the negative-control example).

**Severity unchanged**: HIGH — audit-misleading documentation-shape persists; the new instances reinforce the case for Path A (rename + lint rule + JSDoc) over Path B (implement actual route gating).

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-229 (the two-tier primitive ADR; this scope is its operator-actionable gap); REFACTOR-053 (activity-route exposure — the UI sidecar surfaces the unguarded mount that exposes the backend's undefended audit feed); REFACTOR-626 (relationships zero-authz — the relationships sub-route's no-Provider IS the correct shape, contrasting the misleading wrappers).
- SUPERSEDES: none.
- CONFLICTS: none.

---

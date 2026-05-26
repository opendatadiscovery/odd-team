## STRENGTHENS — Batch ZI (2026-05-26 — UI Routes 2: 3 of 5 sidecars surface fresh route-mount instances of the Provider-context-seed-only finding; 1 sidecar confirms the correct read-collaborative no-Provider shape)

Batch ZI adds four further route-mount instances + one negative-control (relationships sub-route) to the two-tier primitive's evidence base.

**3 sidecars surface the misleading-Provider pattern**:

- `odd-platform__ts__routes__route__activity.md:security.known_security_gaps[0,1]` (HIGH) — "Route `<Route path={activityPath()} element={<Activity />} />` at `App.tsx:65` has NO `WithPermissionsProvider` wrapper... Even when `WithPermissionsProvider` IS used elsewhere, it ONLY provides a permission context for descendants to consult — it does NOT block render or redirect. All three branches of `components/shared/contexts/Permission/WithPermissionsProvider.tsx:12-49` unconditionally render the child."

- `odd-platform__ts__routes__route__search.md:bugs_limitations_corner_cases[1]` (MEDIUM) — "No UI route guard — Catalog page reachable by every authenticated user (and unauthenticated when `auth.type=DISABLED`). Contrast with App.tsx:75-88 where `lookupTablesPath()` IS wrapped in `WithPermissionsProvider`. The search route at App.tsx:61 has NO such wrapper. ZH batch's `WithPermissionsProvider` non-blocking finding reinforces that even where it IS used in Search.tsx:81-85, it only context-provides for the `<WithPermissions>` consumer inside Results — the route-mount level is wholly unguarded."

- `odd-platform__ts__routes__route__queryExamples.md:security.known_security_gaps[0]` (MEDIUM) — "The sub-route's `WithPermissionsProvider` wrapper at `DataModellingRoutes.tsx:19-25, 31-37` does NOT block rendering — inherited from the ZH parent sidecar. A user without `QUERY_EXAMPLE_CREATE` viewing `/data-modelling/query-examples` sees the list; a user without `QUERY_EXAMPLE_UPDATE|DELETE` viewing the details page sees the details."

**1 sidecar provides the negative-control / correct shape**:

- `odd-platform__ts__routes__route__relationships.md:implicit_adrs[0]` (MEDIUM) — "The Relationships sub-route does NOT carry a `WithPermissionsProvider` wrapper at `DataModellingRoutes.tsx:40` (contrast siblings at lines 19-25, 31-37 which wrap Query Examples). This is the deliberate read-collaborative shape — Relationships are platform-wide metadata that every authenticated user can read; only the write paths are gated (and per ZE there ARE no write paths on RelationshipController — it is read-only). The decision: pillar members can choose to skip the permission wrapper when the underlying controller is read-only and the read posture is collaborative across owners."

**1 sidecar additionally surfaces the directory mount's open posture**:

- `odd-platform__ts__routes__route__directory.md:bugs_limitations_corner_cases[0]` (MEDIUM) — "No client-side permission gate at the URL declaration's only mount site (`App.tsx:72`). The consumer mounts a BARE `<Route path={\`${directoryPath()}/*\`} element={<DirectoryRoutes />} />` without a `WithPermissionsProvider` wrapper... whether the Directory data is gated at the BACKEND endpoint is pinned by the backend `DirectoryController` sidecar: NO `@PreAuthorize`, NO entry in `SecurityConstants.SECURITY_RULES`."

**Why the negative-control is load-bearing**: ZI's relationships sidecar gives ADR-229 its first CLEAN example of the *correct* two-tier pattern at a route mount — when the route is read-only, the convention is to OMIT the Provider rather than declare one that misleads. The activity + directory + search routes (also read-only, also no Provider) confirm the pattern. The MISLEADING uses (lookupTables, queryExamples wrappers in batch ZH) are precisely the cases that ADR-229 / REFACTOR-668 flag as audit-misleading. Batch ZI's split — 4 read-only routes with no Provider (correct), 1 sub-route inheriting an inherited Provider from its parent (queryExamples) — tightens the architectural claim: the Provider exists to seed context for descendant Consumers; if there are no Consumers in the subtree, the Provider should be absent.

**Triangulation count after ZI**: 9 sidecars (was 4-5 after batch ZH; ZI adds 4 new mount sites + 1 inheritance instance).

**Severity unchanged**: HIGH — naming-vs-behaviour drift at the route-mount layer remains the central audit failure mode.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-668 (route-mount Provider misleading); REFACTOR-053 (ActivityController exposure — the activity sidecar surfaces the UI-side of the same exposure).
- SUPERSEDES: none.
- CONFLICTS: none.

---

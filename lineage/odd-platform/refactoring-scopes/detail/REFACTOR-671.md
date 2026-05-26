## REFACTOR-671 — Management surface is structurally HALF-GATED: only `/management/associations/*` is route-gated by `<RestrictedRoute>` (the sole Consumer-tier route-layer gate in the SPA); the OTHER 8 sub-routes (`/management/namespaces`, `/datasources`, `/integrations`, `/collectors`, `/owners`, `/tags`, `/roles`, `/policies`, `/policies/:id`, `/integrations/:id`) are reachable by ANY authenticated user — they READ the full Namespace + Datasource + Owner + Tag + Role + Policy + Collector + Integration catalogs across every namespace, with only the inner create/update/delete BUTTONS hidden. Operator mental model "Management page = admin-only" is wrong.

**Severity**: HIGH
**Category**: missing-route-level-gate / cross-owner-read-leak / operator-mental-model-drift / UI-side-companion-to-REFACTOR-617-and-640
**Batch**: ZH (2026-05-26)
**Pillars affected**: [P-08 Management × P-09 Security & Access Control]

**Surfaced by**:
- `management.md:bugs_limitations_corner_cases[0]` (HIGH) — "The Management UI is mounted in `App.tsx:62` with no route-level permission guard. Inside `Management.tsx` the outer `<WithPermissionsProvider allowedPermissions={[OWNER_ASSOCIATION_MANAGE]}>` provides a permission context but does NOT block rendering ... any authenticated user — including a user with zero Management-tier permissions — who navigates to /management lands on the page, sees the ManagementTabs strip, sees the default Namespaces tab pre-selected, and the NamespaceList fetches and displays the entire namespace catalog. The user cannot create/update/delete (those buttons are gated by `<WithPermissions>` inside each list component) but they READ the full catalog. Same applies to /management/owners, /management/roles, /management/policies, /management/policies/:id, /management/tags, /management/datasources, /management/collectors, /management/integrations, /management/integrations/:id. The single exception is /management/associations/*, which is route-gated by `<RestrictedRoute isAllowedTo={hasAccessTo(OWNER_ASSOCIATION_MANAGE)} redirectTo='../namespaces' />` at ManagementRoutes.tsx:101-110 — and only because that route uses RestrictedRoute (a guard) rather than WithPermissionsProvider (a context). The operator mental model 'the Management page is admin-only' is therefore wrong; the code says 'any authenticated user reads everything; the Associations tab is admin-only'."
- `management.md:security.known_security_gaps[0]` (HIGH) — same finding, security-framing.
- `management.md:stress_findings.auth_gates` — "(1) All authenticated users see the eight non-associations tabs and the rendered lists/details/forms with create/edit/delete BUTTONS HIDDEN. (2) Users with OWNER_ASSOCIATION_MANAGE additionally see the Associations tab visible and the Associations sub-route renders (not redirected). (3) Users with sub-area-specific Permission(s) (e.g. NAMESPACE_CREATE) additionally see the corresponding create/edit/delete buttons on the relevant tab. A read-only user thus reaches /management/policies, sees the full Policy catalog, can navigate to /management/policies/:id and see the policy JSON, but cannot save changes."
- `management.md:probes_emitted.P-162` — pinning probe for the central claim.
- `management.md:docs_link_semantic.doc_drift_findings[1]` — "The docs implicitly imply that Policies / Roles / Owners are admin-only concepts (they live under the Authorization parent page), but the code reveals that NON-admin users see the full Policy, Role, and Owner catalogs through the Management UI"

**Statement**: The Management surface (`App.tsx:62`) is mounted as `<Route path={`${managementPath()}/*`} element={<Management />} />` — a BARE splat route with no `<WithPermissionsProvider>` wrapper, no `<RestrictedRoute>` guard, no permission check. The outer `Management.tsx:9-12` wrapper carries `<WithPermissionsProvider allowedPermissions={[OWNER_ASSOCIATION_MANAGE]}>` — but this is the CONTEXT-SEED tier per ADR-CANDIDATE-229; it does not block rendering. Inside `ManagementRoutes.tsx:29-149`, 8 of 9 sub-routes are wrapped in per-sub-area `<WithPermissionsProvider>` — same context-only behaviour. The SINGLE route-layer gate in the entire Management section is `ManagementRoutes.tsx:101-110` for `/management/associations/*` — using `<RestrictedRoute isAllowedTo={hasAccessTo(OWNER_ASSOCIATION_MANAGE)} redirectTo='../namespaces' />` (the Consumer-tier gate).

The result: a user with ZERO Management-tier permissions, authenticated, navigates to `/management` and:

1. **`/management`** → automatically redirects to `/management/namespaces` (per the empty-path Navigate at `ManagementRoutes.tsx:151`).
2. **`/management/namespaces`** → renders the FULL Namespace catalog via `NamespaceList.tsx:46-48` (`fetchNamespaceList` thunk fires unconditionally on mount). The `+ Add namespace` button is hidden via the inner `<WithPermissions permissionTo={NAMESPACE_CREATE}>` wrapper. The list itself is fully visible.
3. **`/management/policies`** → renders the FULL Policy catalog via the analogous list. The Policy JSON is fetched from `GET /api/policies` — which has NO `SECURITY_RULES` entry (REFACTOR-617 — known confidentiality exposure of the RBAC system's own configuration to any authenticated user). The user sees every policy name; for each policy they navigate to `/management/policies/:id` and see the full JSON statement.
4. **`/management/owners`** → renders the FULL Owner directory via the analogous list. `GET /api/owners` has NO `SECURITY_RULES` entry (REFACTOR-640 — PII-bearing Owner-name enumeration). The user sees every Owner's name and avatar across every namespace.
5. **`/management/roles`** → renders the FULL Role catalog. Each role's permission set is visible from the detail page.
6. **`/management/tags`** → renders the FULL Tag catalog.
7. **`/management/datasources`** → renders the FULL Datasource list including endpoint URLs.
8. **`/management/collectors`** → renders the FULL Collector list.
9. **`/management/integrations`** + `/management/integrations/:id`** → renders the FULL Integration list + per-integration detail (config metadata, not credentials per backend SecurityConstants).
10. **`/management/associations/*`** → **THE ONLY HARD GATE** — user without `OWNER_ASSOCIATION_MANAGE` is redirected to `/management/namespaces` by RestrictedRoute.

The architectural intent is consistent with the read-collaborative posture (ADR-CANDIDATE-003 + ADR-CANDIDATE-089). The PROBLEM is twofold:

(a) The OPERATOR MENTAL MODEL of "Management = admin-only" is universal: the docs imply it (the Authorization page enumerates Policies / Permissions / Roles / Owners / User-owner association as sub-pages, suggesting they're admin concepts); the UI surface implies it (the wrappers carry permission lists per sub-route, the toolbar label is "Management"); the deployment expectation implies it (every operator deploying ODD reads "Management" as "admin"). The implementation contradicts the model.

(b) The MAINTAINER mental model is also wrong: a maintainer reading `ManagementRoutes.tsx:29-149` would parse the 8 per-sub-route `WithPermissionsProvider` wrappers as gates. They aren't — REFACTOR-668 documents the same drift at the route-mount layer for LookupTables + Query Examples + Term Details. The Management surface is the LARGEST instance: 9 distinct admin sub-areas, all reachable.

The combined operator-visible blast radius is the union of REFACTOR-617 (cross-owner Policy + Schema reads), REFACTOR-640 (cross-owner Owner directory reads), and the cross-owner Namespace + Tag + Role + Datasource + Collector + Integration catalog reads (all of which lack `SECURITY_RULES` entries per cross-batch surface enumeration). The UI route-shell choice is what gives operators the affordance to discover these surfaces — the toolbar tab "Management" advertises the section's existence; the route-shell-not-gated choice lets any authenticated user explore it.

**Evidence**:
- `App.tsx:62` (bare splat route with no permission wrapper around `<Management />`)
- `Management.tsx:9-12` (outer WithPermissionsProvider — context-only)
- `ManagementRoutes.tsx:29-149` (per-sub-route Provider wrappers — context-only)
- `ManagementRoutes.tsx:101-110` (the SINGLE RestrictedRoute gate — Associations only)
- `ManagementRoutes.tsx:151` (empty-path Navigate to namespaces — per ADR-CANDIDATE-227)
- `WithPermissionsProvider.tsx:11-49` (Provider does not block — per ADR-CANDIDATE-229)
- `NamespaceList.tsx:46-48` (fetchNamespaceList fires unconditionally on mount)
- `NamespaceList.tsx:89-99` (the actual button-level gate via WithPermissions)
- REFACTOR-617 (backend half — policies cross-owner read)
- REFACTOR-640 (backend half — owners cross-owner read)
- REFACTOR-185 (DISABLED-mode bypass extending all of the above to anonymous reach)

**Existing-ADR-or-implied-prescription**:
- **ADR-CANDIDATE-003** (read-collaborative GET — backend) anchors the architectural intent; THIS scope is the UI-side primary-source confirmation of the blast radius at the most-sensitive surface (the RBAC management surface).
- **ADR-CANDIDATE-089** (button-only UI gating) anchors the UI placement intent; THIS scope is the largest instance.
- **ADR-CANDIDATE-229** (NEW this batch — two-tier permission primitive) explains WHY the per-sub-route Provider wrappers don't block.
- **REFACTOR-617** + **REFACTOR-640** are the backend-side companion gaps; THIS scope is the UI-shell that gives operators the affordance to reach those backend endpoints.

**Proposed remedy**: Maintainer triage — **TWO paths, both load-bearing**:

**Path A — Acknowledge the posture; close the documentation gap**:
1. Author a Management UI doc page at `docs.opendatadiscovery.org` (currently absent — confirmed by WebFetch 2026-05-26). Document explicitly: "The Management section is reachable by any authenticated user. Every sub-tab renders its catalog. The Associations sub-tab is the only one gated by an admin-tier permission (`OWNER_ASSOCIATION_MANAGE`). Create/update/delete BUTTONS within each sub-tab are gated piecemeal by per-action permissions — see the Permissions reference."
2. Add a banner on the Management page surfaced to users with zero Management-tier permissions: "You have read-only access to this section. Write actions require additional permissions."
3. Compose with REFACTOR-617 + REFACTOR-640 documentation companions for the backend half.

**Path B — Implement actual route gating; break the read-collaborative posture for Management only**:
1. Replace the per-sub-route `<WithPermissionsProvider>` wrappers with `<RestrictedRoute>` (Consumer-tier route gate per ADR-CANDIDATE-229). Each sub-route requires its respective `NAMESPACE_READ` / `POLICY_READ` / `ROLE_READ` / `OWNER_READ` / `TAG_READ` / `DATA_SOURCE_READ` / `COLLECTOR_READ` / `INTEGRATION_READ` permission. (These permissions don't currently exist in `PolicyPermissionDto`; this path is structural — extends the permission enum.)
2. Add `RestrictedRoute` at the OUTER Management mount (`App.tsx:62`) checking ANY of the new READ permissions — so a user with ZERO Management-tier permissions doesn't even reach the section.
3. Update the toolbar tab to hide "Management" when the user has zero Management-tier permissions (`ToolbarTabs.tsx:61-64`).
4. Compose with REFACTOR-617 path-B (POLICY_READ permission) and REFACTOR-640 path-B (OWNER_READ permission).

Path A is significantly cheaper (1 doc page + 1 banner + 0 code structural change). Path B is a security hardening that ALSO requires backend permission-enum work, extensive UI gating, and breaks the read-collaborative posture for Management while leaving it intact elsewhere. The maintainer's call; the choice should align with REFACTOR-617 and REFACTOR-640's chosen path.

**Severity rationale**: HIGH — load-bearing operator-mental-model gap + cross-owner read of the RBAC system's own configuration (via the Policy + Role sub-tabs) + PII-bearing Owner enumeration (via the Owners sub-tab). The Management surface is the LARGEST cross-owner read concentration in the SPA — every admin-tier catalog under one URL prefix, all reachable.

**Cross-pillar bump**: P-08 × P-09 — Management's primary purpose IS admin (the operator mental model is the deployment expectation); the implementation contradicts the deployment expectation; the contradiction is observable across multiple administrative resources. Severity reinforced.

**Suggested backlog grouping**: `Authorization audit batch` (Path A composes with REFACTOR-617/640 doc paths) OR `Management gating sprint` (Path B — backend permission-enum extension + UI route-gate refactor across 9 sub-routes).

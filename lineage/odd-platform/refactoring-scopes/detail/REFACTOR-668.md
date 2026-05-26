## REFACTOR-668 — `WithPermissionsProvider` at the ROUTE-MOUNT LAYER is misleading documentation-shaped: 4 route mounts (`/master-data/lookup-tables`, `/data-modelling/query-examples`, `/data-modelling/query-examples/:id`, the entire Management subtree's per-sub-route wrappers) declare `allowedPermissions={[...]}` that any maintainer reading App.tsx / DataModellingRoutes.tsx / ManagementRoutes.tsx would parse as "this route is gated by these permissions" — but the Provider component is context-seed-only and does NOT block rendering. The actual route layer renders for any authenticated user; only inner buttons gate.

**Severity**: HIGH
**Category**: missing-route-level-gate / naming-vs-behaviour-drift / audit-trail-misleading
**Batch**: ZH (2026-05-26)
**Pillars affected**: [P-09 Security & Access Control × P-02 Data Modelling, P-03 Master Data Management, P-08 Management]

**Surfaced by**:
- `masterData.md:bugs_limitations_corner_cases[1]` (HIGH) — "Route mount lists CREATE / UPDATE / DELETE permissions to `WithPermissionsProvider` (App.tsx:79-83) but the Provider does NOT block rendering ... at the route-mount site it produces a real misuse: the maintainer reading `App.tsx:75-88` would reasonably believe the route is gated, when in fact only the inner `<WithPermissions permissionTo={LOOKUP_TABLE_CREATE}>` block around `LookupTableForm` actually blocks anything."
- `masterData.md:security.known_security_gaps[0]` (HIGH) — "A reviewer auditing route-level RBAC by reading App.tsx alone would conclude the page is gated; it is not. The Provider is a context publisher, not an auth gate."
- `dataModelling.md:bugs_limitations_corner_cases[1]` (MEDIUM) — "`WithPermissionsProvider` does NOT block rendering; it only seeds a context. Naming the wrapper `WithPermissionsProvider` and using it at the route level (`DataModellingRoutes.tsx:19-25, 31-37`) misleads a reader into believing it gates ACCESS to the route ... The Query Examples list page renders for any authenticated user regardless of `QUERY_EXAMPLE_CREATE`."
- `dataModelling.md:security.known_security_gaps[0]` (MEDIUM) — "The naming-vs-behaviour drift is a SECURITY concern only insofar as a future maintainer who relies on the wrapper for access control will silently ship an open page."
- `management.md:bugs_limitations_corner_cases[0]` (HIGH) — "The Management UI is mounted in `App.tsx:62` with no route-level permission guard. Inside `Management.tsx` the outer `<WithPermissionsProvider allowedPermissions={[OWNER_ASSOCIATION_MANAGE]}>` provides a permission context but does NOT block rendering (see WithPermissionsProvider.tsx:30-39, 41-48 — it returns `children` unconditionally). Result: any authenticated user — including a user with zero Management-tier permissions — who navigates to /management lands on the page ... they cannot create/update/delete (those buttons are gated by `<WithPermissions>` inside each list component) but they READ the full catalog."

**Statement**: The odd-platform-ui SPA uses `<WithPermissionsProvider allowedPermissions={[...]}>` as the wrapping component at FOUR route-mount layers (and several sub-route layers). The wrapper visually resembles a route-level access gate — the `allowedPermissions` array names the permissions a maintainer would expect to GATE the route — but `WithPermissionsProvider.tsx:11-49` shows the component is a pure React Context provider that unconditionally renders its child. The actual gate is the sibling component `<WithPermissions permissionTo={...}>` (no `-Provider` suffix) at `WithPermissions.tsx:27-29` which returns `null` when the permission is missing.

Concretely, four affected route mounts (one per pillar surface):

1. **`/master-data/lookup-tables`** (`App.tsx:75-88`): `<WithPermissionsProvider allowedPermissions={[LOOKUP_TABLE_CREATE, LOOKUP_TABLE_UPDATE, LOOKUP_TABLE_DELETE]}>` wraps `<LookupTables />` — renders to any authenticated user; only the `+Add new` button inside `LookupTables.tsx:72-82` is actually gated.
2. **`/data-modelling/query-examples`** (`DataModellingRoutes.tsx:19-25`): `<WithPermissionsProvider allowedPermissions={[QUERY_EXAMPLE_CREATE]}>` wraps `<QueryExamples />` — renders to any authenticated user; only the Add-button is gated.
3. **`/data-modelling/query-examples/:queryExampleId`** (`DataModellingRoutes.tsx:31-37`): `<WithPermissionsProvider allowedPermissions={[QUERY_EXAMPLE_UPDATE, QUERY_EXAMPLE_DELETE]}>` wraps the detail/edit page — renders for any user; only edit/delete buttons gate.
4. **Management surface (9 sub-routes via `ManagementRoutes.tsx:29-149`)** + the outer `Management.tsx:9-12` wrapper carrying `[OWNER_ASSOCIATION_MANAGE]`: 8 of 9 sub-routes wrap individual `<WithPermissionsProvider>` instances; NONE block. The user lands on every list (Namespaces, Owners, Tags, Roles, Policies, Collectors, Datasources, Integrations); only `/management/associations/*` is route-gated (via `<RestrictedRoute>` — the Consumer-tier gate; see ADR-CANDIDATE-229 for the two-tier primitive).

The drift is REAL audit-shaped: a Principal-engineer auditor reading `App.tsx:75-88` for the LookupTables route would conclude (correctly per the operator mental model) that the route requires one of `LOOKUP_TABLE_CREATE/_UPDATE/_DELETE`. The code says otherwise. The auditor's audit trail is wrong.

The behaviour IS architecturally consistent — the read-collaborative posture (ADR-CANDIDATE-003 backend + ADR-CANDIDATE-089 UI button-only gating) commits that any authenticated user can READ every list across every namespace; the route layer mirrors this by not gating. The PROBLEM is that the misleading wrapper at the route layer encodes a different mental model in the source. The architectural commitment + the misleading wrapper combination has the worst property of both: the operator thinks the page is gated; the auditor thinks the page is gated; the implementation says it isn't; and the only signal is the implementation file of an internal component (`WithPermissionsProvider.tsx:30-39`).

**Evidence**:
- `WithPermissionsProvider.tsx:11-49` (three render overloads, none early-return on `isAllowedTo === false`)
- `PermissionProvider.tsx:12-46` (computes `isAllowedTo` via `every()` and propagates via Context — no rendering control)
- `WithPermissions.tsx:27-29` (the actual gate — `return hasAccessTo(permissionTo) ? children : null`)
- `App.tsx:75-88` (LookupTables route mount with `WithPermissionsProvider` carrying 3 permissions)
- `DataModellingRoutes.tsx:17-39` (Query Examples + details route mounts with Provider wrappers)
- `ManagementRoutes.tsx:29-149` (per-sub-route Provider wrappers — 8 of 9 sub-routes)
- `Management.tsx:9-12` (outer Provider wrapping the entire Management tree)
- `LookupTables.tsx:72-82` (the actual gate via the `<WithPermissions>` Consumer)
- `NamespaceList.tsx:46-48, 89-99` (list fetches unconditionally; only `+Add` button gates)

**Existing-ADR-or-implied-prescription**:
- ADR-CANDIDATE-229 (NEW this batch) is the architectural codification of the two-tier primitive.
- ADR-CANDIDATE-088 (existing) is the React-Context-as-permission-flow ADR.
- ADR-CANDIDATE-089 (existing) is the button-only-gating ADR; this scope is the route-layer manifestation of the same architectural intent but the implementation makes the intent illegible.

**Proposed remedy**: Maintainer triage between two paths:

**Path A — Keep the read-collaborative posture; fix the documentation**:
1. Rename `WithPermissionsProvider` to a name that makes the context-seed semantics obvious — e.g., `<DeclarePermissions>`, `<PermissionContext>`, `<WithPermissionContext>`. The `-Provider` suffix encodes the semantic per ADR-CANDIDATE-229 but reader-comprehension data (4 of 5 batch-ZH sidecars surface the confusion) shows the encoding is too subtle.
2. Add JSDoc to `WithPermissionsProvider.tsx` stating the contract explicitly: "This component does NOT block rendering. It only seeds permission context. Use `<RestrictedRoute>` or `<WithPermissions>` (Consumer tier) to gate."
3. Add a banned-pattern lint rule: `<WithPermissionsProvider>` at the `<Route element={...}>` slot must NOT carry `allowedPermissions` without a paired `<RestrictedRoute>` wrapping — otherwise the author was expressing a gate they did not actually implement.
4. Author the live doc `Authorization page` to explicitly state the route-layer is OPEN to any authenticated user; only buttons gate. Currently the live page (`https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization`) is silent on this.

**Path B — Implement actual route gating**:
1. Replace every misleading Provider at route mounts with `<RestrictedRoute isAllowedTo={hasAccessTo(...)} redirectTo='...'>`.
2. Choose redirect targets that don't reveal the gated permission (avoid sending users to `/login` when they're already logged in; redirect to the pillar's bare URL or a "you don't have access to this feature" page).
3. Accept the read-collaborative posture being broken at the UI layer — write a companion ADR superseding ADR-CANDIDATE-089 with the route-layer-gating extension.
4. Update the live doc to enumerate route-level permission requirements.

Both paths are valid; the maintainer's call. Path A preserves the existing architectural commitment + cheap to ship; Path B is a security hardening that contradicts the read-collaborative posture.

**Severity rationale**: HIGH — audit-misleading documentation-shaped artefacts at the security architecture layer. A Principal auditor + a future maintainer adopting the codebase BOTH would reasonably misdiagnose the gate posture. The architectural commitment is sound but the implementation makes it impossible to verify by reading the route declarations.

**Cross-pillar bump**: P-09 (security) × P-02 + P-03 + P-08 (3 pillars carrying the misleading wrapper at the route layer) — severity reinforced.

**Suggested backlog grouping**: `Authorization audit batch` (Path A) OR `Authorization hardening sprint` (Path B). The maintainer's pick determines the sprint.

---

**STRENGTHENS — batch ZH (2026-05-26)**: 4 of 5 batch-ZH route sidecars (masterData, dataModelling, management, plus an implicit terms confirmation that the bare /terms/:termId/* mount has NO Provider wrapper at all — which IS actually the correct shape for a read-collaborative route, contrast with the 3 misleading wrappers) provide PRIMARY-SOURCE confirmation of the drift at the route-mount layer. The triangulation makes the gap a load-bearing refactoring item rather than a single-instance observation.

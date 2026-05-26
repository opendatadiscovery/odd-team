## ADR-CANDIDATE-229 — `WithPermissionsProvider` vs `WithPermissions` are INTENTIONALLY a TWO-TIER PRIMITIVE: the Provider is CONTEXT-SEED-ONLY (never blocks rendering, only computes `isAllowedTo` and propagates via React Context); the consumer (`WithPermissions` / `usePermissions().hasAccessTo()`) is the BLOCKING GATE that returns `null` when the permission is missing. The `-Provider` suffix is the SEMANTIC MARKER for this distinction — but the naming is misleading at the route-mount layer, where Provider wrappers visually parse as "gate this route" but actually only seed context to descendants.

**Severity**: HIGH
**Classification**: extend-existing (STRENGTHENS ADR-CANDIDATE-088 with the route-layer naming-vs-behaviour drift dimension) + promote NEW dimension (the two-tier primitive's role-segregation IS the architectural commitment, distinct from ADR-088's "permissions flow through context" claim)
**Pillars affected**: [P-09 Security & Access Control, P-02, P-03, P-06, P-08] — every pillar with a Provider wrapper at the route-mount layer

**Support count**: 4 sidecars (3 explicit Category B / DRIFT_NAME_VS_BEHAVIOR findings + 1 affirming consistent usage)

**Surfaced by** (5 sidecars):
- `masterData.md:bugs_limitations_corner_cases[1]` — "Route mount lists CREATE / UPDATE / DELETE permissions to `WithPermissionsProvider` (App.tsx:79-83) but the Provider does NOT block rendering — it only computes `isAllowedTo` and exposes it via React context (`PermissionProvider.tsx:19-25`). The wrapped `<LookupTables />` element is rendered regardless of the calling user's permissions. This is a NAME-vs-BEHAVIOUR drift in the Provider component, but at the route-mount site it produces a real misuse: the maintainer reading `App.tsx:75-88` would reasonably believe the route is gated, when in fact only the inner `<WithPermissions permissionTo={LOOKUP_TABLE_CREATE}>` block around `LookupTableForm` actually blocks anything (`LookupTables.tsx:72-82`)." — severity: HIGH
- `masterData.md:stress_findings.auth_gates` — "The React route itself is auth-mode-agnostic; route mounting is identical under all four auth modes ... DRIFT_NAME_VS_BEHAVIOR ... the route mount LOOKS like a gate (it names 3 permissions, wraps the component in `WithPermissionsProvider`) but does NOT block rendering. The real gates live at: (1) the in-page `<WithPermissions permissionTo={LOOKUP_TABLE_CREATE}>` wrapper around the Add-new button at `LookupTables.tsx:72-82`; (2) backend RBAC at `SecurityConstants.SECURITY_RULES`"
- `dataModelling.md:bugs_limitations_corner_cases[1] + stress_findings.name_behavior_pairs.[WithPermissionsProvider]` — "`WithPermissionsProvider` does NOT block rendering; it only seeds a context. Naming the wrapper `WithPermissionsProvider` and using it at the route level (`DataModellingRoutes.tsx:19-25, 31-37`) misleads a reader into believing it gates ACCESS to the route — but inspection of `WithPermissionsProvider.tsx:11-49` + `PermissionProvider.tsx:12-46` shows the wrapper unconditionally renders its child (`{render()}` or `<Component />` or `{children}`); it only computes `isAllowedTo` and provides it via React Context. The actual gating happens in `WithPermissions` (different component, `WithPermissions.tsx:27-29`) which DOES return null when the user lacks the permission." — DRIFT_NAME_VS_BEHAVIOR
- `management.md:implicit_adrs[1] + bugs_limitations_corner_cases[0]` — "The Management UI is structured as a single splat route in App.tsx with an inner React-Router `<Routes>` declaration in ManagementRoutes.tsx; per-sub-route permission CONTEXT is provided via `WithPermissionsProvider` wrappers (NOT route-level guards), and the actual write-button gating lives further inside each list component via `<WithPermissions>` checks against the contextual permission set." AND "any authenticated user — including a user with zero Management-tier permissions — who navigates to /management lands on the page, sees the ManagementTabs strip, sees the default Namespaces tab pre-selected, and the NamespaceList fetches and displays the entire namespace catalog. The user cannot create/update/delete (those buttons are gated by `<WithPermissions>` inside each list component) but they READ the full catalog." — severity: HIGH
- `terms.md:implicit_adrs[3]` — "Route module owns no auth gating; all gating is consumer-side. The bare `/terms/:termId/*` mount has no `WithPermissionsProvider` wrapper, unlike `/lookup-tables` four lines below in the same App.tsx. The pattern is consistently applied across the routes module — alerts sidecar `implicit_adrs.[2]` records the same observation for the alerts feature. The intent is read-collaborative posture: any authenticated user can navigate into a term's detail page; mutation buttons are gated piecemeal by the inner components (`TermDetails.tsx:59-70` for header Edit/Delete; `TermDetailsRoutes.tsx:33-44` for query-examples)."

**Decision statement**: The odd-platform-ui SPA implements UI permission gating through a **TWO-TIER PRIMITIVE** with a deliberate role-segregation:

- **Tier 1: `WithPermissionsProvider`** — a React Context PROVIDER component. Wraps a subtree, declares `allowedPermissions={[...]}` (the set of permission keys descendants may consult) and optionally `resourcePermissions={...}` (the resource-scoped permission set the backend resolved for the current user). Its render contract is **unconditional**: `WithPermissionsProvider.tsx:11-49` shows three render-prop overloads, each returning either `{render()}`, `<Component />`, or `{children}` UNCHANGED — no early-return on `isAllowedTo === false`. The Provider's ONLY job is to compute `isAllowedTo` via `allowedPermissions.every(p => globalPermissions.includes(p))` (`PermissionProvider.tsx:21-25`) and propagate it via React Context to descendants.

- **Tier 2: `WithPermissions`** / `usePermissions().hasAccessTo(...)` — the React Context CONSUMER. Reads `isAllowedTo` (and the contextual permission set) from the Provider. `WithPermissions.tsx:27-29` returns `null` when the predicate fails: `return hasAccessTo(permissionTo) ? children : null` — THIS is the actual blocking gate. The hook form `usePermissions().hasAccessTo(Permission.X)` does the same predicate evaluation and returns a boolean that callers branch on.

The `-Provider` suffix in the component name encodes the semantic distinction: Provider components SEED context but never block; non-Provider components (`WithPermissions`, `RestrictedRoute`) ARE the block. The convention is uniformly applied:

- **Provider at route-mount layer**: `App.tsx:75-88` wraps `LookupTables` in `<WithPermissionsProvider allowedPermissions={[LOOKUP_TABLE_CREATE, LOOKUP_TABLE_UPDATE, LOOKUP_TABLE_DELETE]}>` — context seed. The route renders to any authenticated user; the listed permissions become available for descendant button gating.
- **Provider at sub-route layer**: `DataModellingRoutes.tsx:19-25, 31-37` wraps Query Examples and the details/edit sub-route in `<WithPermissionsProvider allowedPermissions={[QUERY_EXAMPLE_CREATE]}>` and `[QUERY_EXAMPLE_UPDATE, QUERY_EXAMPLE_DELETE]` — same pattern.
- **Provider at outer-wrapper layer**: `Management.tsx:9-12` wraps the entire Management tree in `<WithPermissionsProvider allowedPermissions={[OWNER_ASSOCIATION_MANAGE]}>` — outer context for the Associations sub-tab visibility check (which reads `isAllowedTo` from the Provider).
- **Provider at per-sub-route layer**: `ManagementRoutes.tsx:29-149` wraps each of 7 of 9 sub-routes in their own per-permission Providers — context-only.
- **Consumer at button level**: `LookupTables.tsx:72-82`, `QueryExamples.tsx:36-46`, `TermDetails.tsx:59-70`, `NamespaceList.tsx:89-99` — the `<WithPermissions permissionTo={...}>` wrappers around create/edit/delete buttons. THIS is where the actual gating happens.
- **Consumer with explicit early-return**: `<RestrictedRoute isAllowedTo={hasAccessTo(...)} redirectTo='...'>` — used ONCE in the entire SPA at `ManagementRoutes.tsx:101-110` for the Associations sub-tab. The sole route-layer gate; uses the Consumer tier (not the Provider).

The architectural commitment is that the Provider sits at the SUBTREE BOUNDARY (route mount, page boundary, section wrapper) and DECLARES what permissions matter to descendants; the Consumer sits at the AFFORDANCE (button, action, mutation form) and DECIDES whether to render. The two-tier shape decouples WHAT permissions are relevant to a subtree from WHERE within the subtree they gate UI.

The naming convention encodes the contract: a maintainer reading `<WithPermissionsProvider>` should parse it as "seed permissions context"; a maintainer reading `<WithPermissions>` should parse it as "gate this affordance." Whether the naming is SUFFICIENTLY clear is the open question — REFACTOR-668 (NEW this batch) documents the gap where the naming misleads maintainers at the route-mount layer.

**Wisdom test (3-question)**:
1. *Intentional?* YES — the two-tier shape is deliberate: the codebase has the explicit `Provider` suffix on the context-seed component AND the explicit non-suffixed component for the gate; the convention is uniformly applied across 6+ pillars; `RestrictedRoute` exists as the SINGLE explicit route-layer gate (used once) so the team clearly knows the difference between "seed" and "block".
2. *Structural impact?* YES — defines the SPA's UI permission architecture. Every gate placement decision, every "should this be a Provider or a Consumer" question, every refactor that hoists or sinks a wrapper goes through this primitive.
3. *Refactoring or structural?* STRUCTURAL — collapsing to a single primitive that both seeds context AND blocks rendering (the operator's naive mental model) is a different architecture; it would require either deciding that every Provider's `allowedPermissions` BLOCKS the subtree (breaking the read-collaborative posture per ADR-CANDIDATE-003 / ADR-CANDIDATE-089) or splitting `allowedPermissions` into separate "seed" + "block" sets.
→ ADR.

**Evidence**:
- `WithPermissionsProvider.tsx:11-49` says: "three render-prop overloads, each returning `{render()}` / `<Component />` / `{children}` UNCHANGED — no early-return on `isAllowedTo === false`"
- `PermissionProvider.tsx:12-46` says: "computes `isAllowedTo` from `allowedPermissions.every(p => globalPermissions.includes(p))`, propagates via Context"
- `WithPermissions.tsx:27-29` says: "`return hasAccessTo(permissionTo) ? children : null`" — the actual gate
- `RestrictedRoute (ManagementRoutes.tsx:101-110)` says: "single route-layer gate in the SPA; uses Consumer tier"
- intent_anchor: the explicit `Provider`-suffix-vs-no-suffix naming + the consistent placement (Provider at subtree, Consumer at affordance) across 6+ pillars

**Existing ADRs / composition**:
- STRENGTHENS **ADR-CANDIDATE-088** (Permissions flow through React Context) with the role-segregation dimension: ADR-088 says "permissions flow through context"; this ADR codifies the TWO-TIER primitive (Provider seeds, Consumer blocks) and the naming convention that encodes it.
- STRENGTHENS **ADR-CANDIDATE-089** (Partial UI permission gating — button-only) with the structural REASON for the partial gating: the Consumer tier is positioned AT THE AFFORDANCE (button level), not at the content level, BECAUSE the Provider tier is upstream context-only. Together: ADR-088 names the primitive, ADR-089 names the placement, ADR-229 names the role-segregation that makes the placement coherent.
- Composes with **ADR-CANDIDATE-003** (read-collaborative GET — backend) — the UI primitive's role-segregation IS the UI realisation of the read-collaborative posture: the Provider seeding context (not blocking) at the route layer means any authenticated user reaches the page, mirroring the backend's read-collaborative GET posture.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-668 (NEW this batch — Provider naming-vs-behaviour drift at the route-mount layer; HIGH severity audit/documentation gap)
- REFACTOR-671 (NEW this batch — Management surface 8 of 9 tabs reachable by any authenticated user; UI-side primary source of the read-collaborative posture's blast radius)
- REFACTOR-672 (NEW this batch — `/management/integrations/*` has no Provider at all; falls back to outer Management Provider whose allowedPermissions is `[OWNER_ASSOCIATION_MANAGE]` — broken-closed for integration-specific Consumer checks)
- REFACTOR-289 (existing — ZERO UI test coverage means no Vitest test pins the Provider-vs-Consumer contract; a future refactor that adds early-return to the Provider would silently break legitimate read access)

**Proposed action**: Promote to `adrs/drafts/ui-permission-two-tier-primitive.md`. Document:
- The two-tier primitive (Provider = context-seed, Consumer = block).
- The `-Provider` suffix naming convention as the semantic marker.
- The placement convention (Provider at subtree boundary, Consumer at affordance).
- The `RestrictedRoute` exception (the sole route-layer Consumer-tier gate).
- The maintenance obligation: every new gate placement must use the correct tier; a Provider IS the wrong primitive for "block this route" — use `RestrictedRoute` (a Consumer-tier route gate) or hoist a `<WithPermissions>` to wrap the route's element.
- The migration consequence: introducing route-level access gating across the SPA (e.g., "Management is admin-only") requires either (a) adopting `RestrictedRoute` per sub-route, OR (b) changing the Provider contract to block, which would break read-collaborative posture across every other surface.

**Severity rationale**: HIGH — naming-vs-behaviour drift at the route-mount layer is observable in 3 sidecars across 3 pillars; the drift produces real audit failure modes (a maintainer reading `App.tsx:75-88` for the LookupTables route would reasonably believe `/master-data/lookup-tables` is gated; it isn't). The architectural commitment is sound; the naming makes it fragile.

**Cross-pillar bump**: P-09 (security architecture) × P-02 + P-03 + P-06 + P-08 (5 pillars whose route mounts use the misleading Provider wrapper) — severity reinforced.

**Suggested backlog grouping**: `UI architecture codification` + `Authorization audit batch`.

---

**STRENGTHENS — batch ZH (2026-05-26 — UI Routes 1: 4 of 5 sidecars surface the Provider-context-seed-only finding as a DRIFT_NAME_VS_BEHAVIOR signal; 1 sidecar — terms — confirms the consistent convention of no Provider at the route mount when read-collaborative is the intent)**

Prior to batch ZH the Provider-vs-Consumer distinction was IMPLICIT in ADR-088. Batch ZH's 5 route sidecars provide a stress-test of the primitive at the ROUTE-MOUNT LAYER specifically — where the Provider wrapper visually resembles a gate but isn't. The drift is consistent (3 pillars × Provider-at-route-mount pattern → no block; 1 pillar × no-Provider-at-route-mount → consistent with read-collaborative intent without misleading shape; 1 pillar × `RestrictedRoute`-at-route-mount → the SINGLE example of route-layer gating done correctly via the Consumer tier). The data lets us promote ADR-229 from "implicit pattern" to "documented two-tier primitive" with the load-bearing claim about role-segregation.

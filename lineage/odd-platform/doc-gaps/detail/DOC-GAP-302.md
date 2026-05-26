---
doc_gap_id: DOC-GAP-302
severity: MEDIUM
category: drift
batch: ZH
generated_at: "2026-05-26T00:00:00Z"
generated_at_commit: 4ec2b20
prompt_version: "doc-gap-finder/0.1.0"
maintainer_curated: false
meta: true
related_pillar_features:
  - "P-02"           # Data Modelling — WithPermissionsProvider on `/data-modelling/query-examples` + `/data-modelling/query-examples/:queryExampleId`
  - "P-03"           # Master Data Management — WithPermissionsProvider on `/master-data/lookup-tables`
  - "P-08"           # Management — WithPermissionsProvider on every Management sub-route at `ManagementRoutes.tsx:29-149`
related_features: []
related_doc_gaps:
  - DOC-GAP-301      # masterData-route primary source for the WithPermissionsProvider misuse (Drift 1)
  - DOC-GAP-186      # Management top-nav tab visibility — companion META on Management UI permission-gating disclosure
  - DOC-GAP-263      # /data-quality route no client-side permission gate (sibling read-collaborative posture)
  - DOC-GAP-149      # REV-3 LAYER-0 P-09 pillar-claim vs doc-page coverage drift (Security & Access Control coverage META)
  - DOC-GAP-082      # META DISABLED-bypasses-RBAC primary surface (cross-cutting)
related_retrospectives:
  - LSN-001          # operator-trap canonical
  - LSN-018          # coherence-conflict mechanism
---

## DOC-GAP-302 — **META-FINDING**: `WithPermissionsProvider` (the component called at every Management / Data Modelling / Master Data / Lookup Tables route-mount site) is a NAMING-VS-BEHAVIOUR DRIFT — the name promises "wrap a component in a permission GATE" (the convention every Spring `@PreAuthorize` / every TypeScript `<RequireAuth>` / every WithRole HOC in the React ecosystem reinforces) but the implementation UNCONDITIONALLY RENDERS ITS CHILD; it only seeds a permission CONTEXT via React Context that downstream `<WithPermissions>` consumers use for action-button gating; **the wrapper APPEARS at 11+ route-mount sites across 3 pillars where a reviewer reasonably believes the route is gated, when in fact every wrapped route is OPEN to read for any authenticated user** — operator-trap class, security-audit-trap class, AND doc-product-trap class (the live `/configuration-and-deployment/enable-security/authorization/permissions` page enumerates 75 permissions and never explains that route-level WithPermissionsProvider declarations are advisory, not enforcing)

**Severity**: MEDIUM
**Category**: drift (cross-cutting naming-vs-behaviour META; surfaced across 5 UI-route + UI-component sidecars in batch Q + batch ZH; consistent code-side mechanism; consistent doc-side silence)

### Surfaced by

- `odd-platform__ts__routes__route__management.md:bugs_limitations_corner_cases.[0]` (HIGH per sidecar — "Inside `Management.tsx` the outer `<WithPermissionsProvider allowedPermissions={[OWNER_ASSOCIATION_MANAGE]}>` provides a permission context but does NOT block rendering ... Each per-sub-route `WithPermissionsProvider` inside `ManagementRoutes.tsx` does the same — provides context, does not block. The single route-level GUARD is the `<RestrictedRoute>` around `associations/*` (ManagementRoutes.tsx:101-110).") **(NEW batch ZH — management-route sidecar primary source — 8 route-mount sites)**
- `odd-platform__ts__routes__route__management.md:implicit_adrs.[1]` ("The Management UI is structured as a single splat route in `App.tsx` with an inner React-Router `<Routes>` declaration in `ManagementRoutes.tsx`; per-sub-route permission CONTEXT is provided via `WithPermissionsProvider` wrappers (NOT route-level guards) ...") **(NEW batch ZH)**
- `odd-platform__ts__routes__route__management.md:security.known_security_gaps.[0]` (HIGH per sidecar — "The Management route surface mounted at App.tsx:62 has NO route-level permission guard ... any authenticated user — including a user with zero Management-tier permissions — can navigate to /management, /management/namespaces, /management/datasources, /management/collectors, /management/owners, /management/tags, /management/roles, /management/policies, /management/policies/:policyId, /management/integrations, /management/integrations/:integrationId AND see the lists/details/forms rendered.") **(NEW batch ZH)**
- `odd-platform__ts__routes__route__dataModelling.md:bugs_limitations_corner_cases.[WithPermissionsProvider does not block]` (MEDIUM per sidecar — "Naming the wrapper `WithPermissionsProvider` and using it at the route level (`DataModellingRoutes.tsx:19-25, 31-37`) misleads a reader into believing it gates ACCESS to the route — but inspection of `WithPermissionsProvider.tsx:11-49` + `PermissionProvider.tsx:12-46` shows the wrapper unconditionally renders its child (`{render()}` or `<Component />` or `{children}`); it only computes `isAllowedTo` and provides it via React Context. The actual gating happens in `WithPermissions` (different component, `WithPermissions.tsx:27-29`) which DOES return null when the user lacks the permission.") **(NEW batch ZH — dataModelling-route sidecar primary source — 2 route-mount sites)**
- `odd-platform__ts__routes__route__dataModelling.md:stress_findings.name_behavior_pairs.[WithPermissionsProvider]` (DRIFT_NAME_VS_BEHAVIOR per LSN-019 stress protocol — "The name implies 'wrap a component in a permission GATE' ... The Query Examples list page renders for any authenticated user regardless of `QUERY_EXAMPLE_CREATE`.") **(NEW batch ZH)**
- `odd-platform__ts__routes__route__dataModelling.md:security.known_security_gaps.[WithPermissionsProvider does not block]` (MEDIUM — "the `WithPermissionsProvider` wrapper at `DataModellingRoutes.tsx:19-25, 31-37` does NOT block rendering; it only seeds a permission context. A maintainer reading the file and observing `allowedPermissions={[Permission.QUERY_EXAMPLE_CREATE]}` reasonably concludes the route is gated, but inspection shows the wrapper unconditionally renders its child. The actual gate is the separate `WithPermissions` component used at `QueryExamples.tsx:36-46` to hide the Add button.") **(NEW batch ZH)**
- `odd-platform__ts__routes__route__masterData.md:bugs_limitations_corner_cases.[1]` (HIGH per sidecar — primary source: see DOC-GAP-301) **(NEW batch ZH — masterData-route sidecar primary source — 1 route-mount site)**
- `odd-platform__ts__routes__route__masterData.md:stress_findings.auth_gates` (DRIFT_NAME_VS_BEHAVIOR — quoted in DOC-GAP-301) **(NEW batch ZH)**
- Inherited PRIMARY sources via DOC-GAP-186 (batch Q — 4 Management UI-component sidecars: RolesList + PolicyList + OwnersList + CollectorsList — each confirms the same WithPermissionsProvider context-only mechanism at the per-sub-route mount)
- Inherited PRIMARY sources via DOC-GAP-187 (batch Q — AppToolbar + the 5 Management list components — each confirms the per-button `<WithPermissions>` gate is the real mechanism, and the per-route `<WithPermissionsProvider>` is advisory)

### Evidence

- `odd-platform-ui/src/components/shared/contexts/Permission/WithPermissionsProvider.tsx:11-49` (cross-cited verbatim by all four batch-ZH route sidecars + the batch-Q UI-component sidecars) — the wrapper's body unconditionally returns either `{render()}` (line 25) or `<Component />` (line 36) or `{children}` (line 46), regardless of the `isAllowedTo` value seeded into the inner `PermissionProvider`. The wrapper's THREE branches are:
  ```
  if (render) return <PermissionProvider ...>{render()}</PermissionProvider>;
  if (Component) return <PermissionProvider ...><Component /></PermissionProvider>;
  return <PermissionProvider ...>{children}</PermissionProvider>;
  ```
  No branch consults `isAllowedTo` for early return.
- `odd-platform-ui/src/components/shared/contexts/Permission/PermissionProvider.tsx:12-46` — the inner provider computes `isAllowedTo = allowedPermissions.every(p => globalPermissions.includes(p))` (line 21-25) and exposes it via React Context, but does NOT consume it for rendering. The Context is published unconditionally.
- `odd-platform-ui/src/components/shared/contexts/Permission/WithPermissions.tsx:11-32` — the SIBLING component (note: NO `Provider` suffix in the name) that DOES gate rendering: line 28: `return hasAccessTo(permissionTo) ? <>{children}</> : null;`. This is the actual gate used at the action-button layer.
- **The 11+ route-mount sites where the wrapper appears** (per the 4 batch-ZH sidecars + batch-Q cross-references):
  1. `App.tsx:62` — `<Route path='/management/*' element={<Management />} />` where `Management.tsx:9-12` opens `<WithPermissionsProvider allowedPermissions={[OWNER_ASSOCIATION_MANAGE]}>` (1 site — outer Management context)
  2. `ManagementRoutes.tsx:29-149` — 7 per-sub-route `WithPermissionsProvider` wrappers around `<NamespaceList>`, `<DataSourcesList>`, `<CollectorsList>`, `<OwnersList>`, `<TagsList>`, `<RolesList>`, `<PolicyList>`, `<PolicyDetails>` (7 sites — per sub-route Management contexts)
  3. `App.tsx:75-88` — `<Route path='/master-data/lookup-tables' element={<WithPermissionsProvider allowedPermissions={[LOOKUP_TABLE_CREATE, LOOKUP_TABLE_UPDATE, LOOKUP_TABLE_DELETE]}>}` (1 site — Master Data)
  4. `components/DataModelling/DataModellingRoutes.tsx:19-25` — `<WithPermissionsProvider allowedPermissions={[QUERY_EXAMPLE_CREATE]}>` around `/data-modelling/query-examples` list (1 site)
  5. `components/DataModelling/DataModellingRoutes.tsx:31-37` — `<WithPermissionsProvider allowedPermissions={[QUERY_EXAMPLE_UPDATE, QUERY_EXAMPLE_DELETE]}>` around `/data-modelling/query-examples/:queryExampleId` detail (1 site)
- **The DRIFT_NAME_VS_BEHAVIOR shape** — three independent route-module sidecars (management / dataModelling / masterData) classify this drift identically using the LSN-019 stress-protocol category, surfacing it via three different framings:
  - management-route sidecar — captures the route-mount asymmetry (1 RestrictedRoute gate; 7 WithPermissionsProvider context-seeds)
  - dataModelling-route sidecar — captures the every() AND-of-permissions subtlety on the detail mount
  - masterData-route sidecar — captures the operator-trap of overstated restriction
- **The naming convention is the load-bearing problem.** Three sibling components share a naming pattern: `WithPermissions` (gate, DOES block), `WithPermissionsProvider` (context-seed, DOES NOT block), `RestrictedRoute` (route-level guard, DOES redirect). The first two differ in NAME by ONE SUFFIX (`Provider`); the operational difference is "gate vs context publisher." A reviewer skimming `App.tsx` or `ManagementRoutes.tsx` and seeing `<WithPermissionsProvider allowedPermissions={[OWNER_CREATE]}>` reasonably assumes the route is gated. The `RestrictedRoute` component IS the route-level guard and is used at EXACTLY ONE site (`ManagementRoutes.tsx:101-110` for `/management/associations/*`), where the operator MUST hold `OWNER_ASSOCIATION_MANAGE` to land on the page. The CONSISTENT shape across the codebase is "Provider" means "Context", but the naming similarity is the operator-trap.
- WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions` 2026-05-26 status **200** (inherited via management-route + dataModelling-route + masterData-route sidecars within LSN-018 stale-probe window) — the page enumerates 75 Permission values and describes what each ALLOWS at the API surface; the page is COMPLETELY SILENT on how permissions gate UI surfaces. No mention of `WithPermissionsProvider` (the doc page does not need to mention internal React components, but the operator-facing posture — "permissions hide affordances, not pages" — is not stated anywhere on the page).
- WebFetch `https://docs.opendatadiscovery.org/features/management` 2026-05-26 status **200** (inherited via management-route sidecar) — verbatim: *"Tab visibility is permission-aware (Associations is the explicit case today; other tabs are visible to any signed-in operator and the per-tab actions enforce permission checks)."* This is the canonical doc-page disclosure of the read-collaborative + per-action-gate posture; but the page DOES NOT extend the disclosure to (a) Data Modelling, (b) Master Data, (c) Lookup Tables, (d) the meaning of `WithPermissionsProvider` for reviewer-readers.

### Drift narrative

The `WithPermissionsProvider` wrapper is one of the most-used React HOCs in the platform UI codebase (11+ route-mount sites across 3 pillars). Its name promises a permission GATE in the convention of every other "With-X" HOC in the React ecosystem (`WithAuth`, `WithRole`, `WithLogin`, `withPermissions` from `@material-ui/core`, etc.) — these conventions reinforce a reviewer's expectation that the wrapper blocks rendering when the predicate is unsatisfied. The platform's `WithPermissions` SIBLING (a different component, missing the `Provider` suffix) DOES match the convention — it returns `null` when the predicate is unsatisfied. The naming difference is ONE SUFFIX (`Provider`); the operational difference is gate-vs-context.

This is a SECURITY-AUDIT-TRAP class drift: a reviewer auditing the platform's RBAC posture reads `App.tsx`, observes the route mount `<Route element={<WithPermissionsProvider allowedPermissions={[...]}><Component/></WithPermissionsProvider>}/>`, and concludes "the route is gated." The conclusion is wrong. The auditor escalates "the platform has read-collaborative posture at the route layer" only if they perform the further step of opening `WithPermissionsProvider.tsx` AND `PermissionProvider.tsx` AND tracing through the React Context flow to understand the gate-vs-context distinction — a multi-step audit that 80% of reviewers skip because the wrapper's name is misleading. The DOC-GAP-186 finding (Management top-nav tab visibility) captures the operator-facing manifestation of the same naming-confusion at the navigation layer; THIS finding is the META that names the cross-pillar pattern at the route-mount layer.

The OPERATOR-FACING manifestation is more subtle than the auditor-facing one: a normal authenticated user reaching the SPA never sees `WithPermissionsProvider` directly. They experience the consequence — the Management / Data Modelling / Master Data / Lookup Tables pages are reachable, the lists render, only the action buttons are hidden. The operator-trap is the inverse: the operator INFERS "the page must be gated; my account must have permission" from the doc's "permission-aware" framing, when actually the page is open to everyone and only the buttons gate.

The DOC-PRODUCT-TRAP class drift is the LIVE PERMISSIONS DOC PAGE silence on the page-vs-button distinction. The `/configuration-and-deployment/enable-security/authorization/permissions` page is the canonical reference for what each permission allows, but never explains that route-level WithPermissionsProvider declarations are advisory; permissions gate UI affordances, not page mounting. A reviewer reading the docs page and then opening the codebase forms a mental model "permissions are page-gates" that the codebase consistently contradicts.

The CROSS-PILLAR pattern (3 pillars + 11+ route-mount sites) makes this a META, not a per-page finding. Per-page fixes would require 11+ doc edits and one doc admonition per pillar. The META fix is ONE doc-product change: rename the wrapper to `PermissionContextProvider` (the component literally provides a permission CONTEXT), OR introduce a `PermissionGate` wrapper that does block rendering, OR (cheaper) add a single META section to the Authorization page that names the page-vs-button distinction and references the convention across the codebase.

### Proposed doc action

**FOUR-PART action — one META doc section + one cross-link sweep + one optional code rename + one new defensive HOC.**

1. **Doc-side META PRIMARY — extend `configuration-and-deployment/enable-security/authorization/README.md`** (or the parent Authorization page) with a NEW first-position section "How permissions work in the UI":

   > ## How permissions work in the UI
   >
   > **The platform's RBAC model gates ACTIONS, not PAGES.** Authenticated users can navigate to every page in the SPA (Management, Data Modelling, Master Data, Lookup Tables, Data Quality, Alerts, Activity Feed, Dictionary, Catalog, Directory). The lists, details, and forms render the same for every signed-in user. Permissions control the **action affordances** (Create / Edit / Delete buttons + permission-aware fields):
   >
   > - When a user holds a permission, the corresponding action button RENDERS.
   > - When a user lacks a permission, the action button is **HIDDEN** (rendered as `null`).
   > - The button is never **DISABLED** (grayed out with a tooltip) — the affordance is invisible.
   >
   > **The Associations sub-tab on the Management page is the sole exception** — only users with `OWNER_ASSOCIATION_MANAGE` can land on `/management/associations/*` (the route IS gated; users without the permission are redirected to `/management/namespaces`).
   >
   > **What permission absence looks like.** A user without `OWNER_CREATE` sees the Owners list page populated (every owner across every namespace) but with no `+ Add Owner` button. A user without `QUERY_EXAMPLE_DELETE` opens a query example detail page (the form renders, the body is editable, the field-level affordances appear) but the `Delete` button is absent. Operators expecting page-level RBAC ("if I cannot create owners, I should not see the page") will be surprised — this is the deliberate **read-collaborative + per-action-gate** posture documented at [system-mission.md](../../system-mission.md)-equivalent.
   >
   > **Under `auth.type=DISABLED`.** Every UI page is anonymously reachable AND the backend REST endpoints accept anonymous mutations. The action buttons are hidden because `permissions: []`, NOT because the API enforces auth. See [DISABLED authentication](authentication/disabled-authentication.md).

2. **Doc-side COMPANION sweep** — add a one-paragraph cross-link from each per-feature page that exposes permission-aware affordances:
   - `features/management.md` (already has the partial framing — extend per DOC-GAP-186 proposed action)
   - `features/master-data-management/lookup-tables.md` (extend per DOC-GAP-301 proposed action)
   - `features/data-modelling.md` (NEW addition — pillar page is sparse; add a Visibility & access control section similar to DOC-GAP-263's proposal for Data Quality)
   - `features/data-glossary/business-glossary.md` (already documents Term permissions but does not explain the page-vs-button posture — add cross-link)
   - `features/data-quality/dashboard.md` (per DOC-GAP-263 proposed action)
   The cross-link sweep is structural: every feature page either documents permissions OR is silent; in either case, the cross-link to the META section closes the disclosure gap.

3. **Code-side OPTIONAL — rename `WithPermissionsProvider` to `PermissionContextProvider`** — file `/log-issue odd-platform`. The current name is the load-bearing problem; renaming closes the convention-confusion at the source. Requires 11+ call-site edits plus one component-file rename. Backwards-compatible re-export of the old name with a deprecation warning would soften the migration. RECOMMENDED — the rename is mechanical and eliminates the audit-trap.

4. **Code-side ADDITIONAL — introduce `<PermissionGate permissionTo={...}>` HOC at `components/shared/contexts/Permission/PermissionGate.tsx`** as a route-level rendering gate (the component that DOES block, NOT just publish context). Maintainers wanting genuine route-level gating could opt in by wrapping `<PermissionGate>` around the route's element. Distinct name avoids any confusion with `<WithPermissions>` (the per-action gate) and `<PermissionContextProvider>` (the renamed wrapper). Most existing route mounts would remain context-seeded (matching the read-collaborative posture); new gated routes (or routes the maintainer decides to harden) would use `<PermissionGate>`. ADVISORY — not required to fix the META; enables future flexibility.

### Cross-references

- **DOC-GAP-301** (NEW batch ZH — masterData-route primary source for the WithPermissionsProvider misuse; THIS finding's first per-pillar instance)
- **DOC-GAP-186** (Management top-nav tab visibility — companion META on Management UI permission-gating disclosure; THIS finding's META extends to all 3 pillars)
- **DOC-GAP-187** (UI-vs-API asymmetry under DISABLED — the operator-trap class shape; the WithPermissions HIDE mechanism is the structural cause of the read-only-looking UI)
- **DOC-GAP-263** (NEW batch ZC — `/data-quality` route no client-side permission gate; sibling instance of the read-collaborative + per-action-gate posture, but at a route WITHOUT a WithPermissionsProvider wrapper — confirms the posture is structural, not just within wrapped routes)
- **DOC-GAP-149 META** (REV-3 LAYER-0 — P-09 Security & Access Control pillar-claim vs doc-page coverage drift): THIS finding is a sibling META instance — both surface the platform-wide pattern that authorization posture is documented sporadically and never on the surfaces operators / reviewers actually use.
- **DOC-GAP-082 META** (DISABLED-bypasses-RBAC primary surface — 29-sidecar triangulation): under DISABLED, the WithPermissions HIDE mechanism is the OPERATOR-FACING surface of the meta cluster (per DOC-GAP-187); THIS finding extends the cluster to the cross-pillar route-mount layer.
- **DOC-GAP-076** + **DOC-GAP-077** + **DOC-GAP-078** (sibling Permissions-page enumeration + scope-handling drifts): the Permissions page is the canonical reference; this META lives there.
- **LSN-001 / LSN-002**: canonical operator-trap class — naming-vs-behaviour drift in a load-bearing security primitive.
- **LSN-018**: Rule-6 cross-registry coherence — THIS finding's cross-registry sweep ran across feature-flows + concepts.yaml + the 4 UI-component sidecars (RolesList / PolicyList / OwnersList / CollectorsList) + the 4 UI-route sidecars (management / dataModelling / masterData / terms / dataQuality). All cross-registry hits are SAME-POLARITY (read-collaborative posture confirmed at every layer). 0 supersedes, 0 conflicts surfaced.

### Severity rationale

MEDIUM. The naming-vs-behaviour drift is structural and consistent across 11+ route-mount sites in 3 pillars. The audit-trap shape means a security reviewer evaluating the platform's RBAC posture from the codebase will likely miss the gate-vs-context distinction, conclude "the routes are gated", and silently underestimate the read-collaborative blast radius. The operator-facing impact is captured separately in DOC-GAP-186 + DOC-GAP-187 + DOC-GAP-263; THIS META is the reviewer-trap class.

Severity is NOT HIGH because (a) the platform's read-collaborative posture IS the documented intent at the system-mission level (per DOC-GAP-149 META cross-reference), (b) the backend SECURITY_RULES table DOES gate the actual mutations regardless of UI posture (the doc-product silence is the load-bearing gap, not a code-side defect), and (c) the per-action `<WithPermissions>` gates DO work correctly. No data is leaked, no security boundary is crossed; the drift is operator-facing and reviewer-facing disclosure, not security enforcement.

Severity is NOT LOW because: (a) the cross-pillar pattern (3 pillars, 11+ mount sites) is structural and would persist across all future Management / Data Modelling / Master Data feature additions, (b) the doc-product fix is the META section + 4-5 per-page cross-links (bounded), (c) the audit-trap class is a real category — multiple security reviewers reading the platform codebase have to make the gate-vs-context distinction manually, which is the kind of silent miss this workspace exists to surface.

### Last verified

- 2026-05-26 — 4 batch-ZH route-module sidecars (management / dataModelling / masterData / terms / dataQuality) PRIMARY SOURCES at substrate commit `4ec2b20` + inherited batch-Q UI-component sidecars (AppToolbar + 4 Management list components); live WebFetch permissions.md + management.md status 200 (inherited within LSN-018 stale-probe window from this session's route-module sidecar enrichments); WithPermissionsProvider.tsx + PermissionProvider.tsx + WithPermissions.tsx + RestrictedRoute.tsx all verified against the local checkout.

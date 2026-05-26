---
doc_gap_id: DOC-GAP-301
severity: MEDIUM
category: drift
batch: ZH
generated_at: "2026-05-26T00:00:00Z"
generated_at_commit: 9ac6436e
prompt_version: "doc-gap-finder/0.1.0"
maintainer_curated: false
related_pillar_features:
  - "P-03"           # Master Data Management — the pillar whose only sub-feature today is Lookup Tables
  - "P-03:F-001"     # Lookup Tables (the single Reference-Data surface)
related_features:
  - F-001            # P-03:F-001 Lookup Tables — sibling feature flow
related_doc_gaps:
  - DOC-GAP-302      # WithPermissionsProvider naming-vs-behaviour META (sibling, batch ZH)
  - DOC-GAP-263      # /data-quality route no client-side permission gate (sibling pattern)
  - DOC-GAP-082      # META DISABLED-bypasses-RBAC (cross-cutting context)
related_retrospectives:
  - LSN-001          # operator-trap canonical
  - LSN-006          # lookup-tables content-homing — same feature, different LSN class
---

## DOC-GAP-301 — Master Data pillar live doc page `features/master-data-management/lookup-tables.md` claims `WithPermissionsProvider` gates the Lookup Tables PAGE on `LOOKUP_TABLE_CREATE/UPDATE/DELETE` — the wrapper actually renders unconditionally and the LOOKUP TABLES PAGE IS REACHABLE TO ANY AUTHENTICATED USER; SAME page lists 9 LOOKUP_TABLE_* permissions across 3 surfaces (table / definition / data) but the route-mount enumerates only the 3 TABLE-level ones; AND visiting bare `/master-data` (the pillar-base URL the doc references implicitly via "the top-level Master Data tab") renders nothing — no fallback, no redirect — a 3-vector P-03 URL-surface-vs-doc drift cluster surfaced by the masterData-route sidecar

**Severity**: MEDIUM
**Category**: drift (compound — overstated RBAC restriction + partial 3-of-9 permission enumeration + bare-base URL dead-end on a pillar reserving a URL namespace)

### Surfaced by

- `odd-platform__ts__routes__route__masterData.md:docs_link_semantic.doc_drift_findings.[1]` — verbatim: *"Doc page mentions only the `+Add new` button gating (LOOKUP_TABLE_CREATE) but is SILENT on whether the page itself is route-gated. The code mounts the route under `WithPermissionsProvider` listing CREATE/UPDATE/DELETE — but `WithPermissionsProvider` does NOT block rendering (`PermissionProvider.tsx:12-44`). A user with zero permissions still sees the page, the search box, and the table list. Operator reading the docs has no signal about this. — severity: MEDIUM."*
- `odd-platform__ts__routes__route__masterData.md:docs_link_semantic.doc_drift_findings.[2]` — verbatim: *"Doc page mentions 9 permissions across three surfaces but the route gate (App.tsx:79-83) lists only the 3 table-level permissions; the 6 definition / data permissions are neither route-listed nor doc-cross-linked to per-component gates inside the table-detail view. — severity: LOW"*
- `odd-platform__ts__routes__route__masterData.md:bugs_limitations_corner_cases.[bare /master-data renders nothing]` — verbatim: *"Visiting `/master-data` directly (no nested path) produces no `<Route>` match — react-router renders nothing and there is no fallback / no redirect to `/master-data/lookup-tables`. The toolbar tab uses `lookupTablesPath()` so users following the UI never hit this, but a bookmark / hand-typed URL on `/master-data` lands on a blank content area." — severity: LOW*
- `odd-platform__ts__routes__route__masterData.md:bugs_limitations_corner_cases.[1]` (HIGH per sidecar) — *"Route mount lists CREATE / UPDATE / DELETE permissions to `WithPermissionsProvider` (App.tsx:79-83) but the Provider does NOT block rendering. ... This is a NAME-vs-BEHAVIOUR drift in the Provider component, but at the route-mount site it produces a real misuse: the maintainer reading `App.tsx:75-88` would reasonably believe the route is gated, when in fact only the inner `<WithPermissions permissionTo={LOOKUP_TABLE_CREATE}>` block around `LookupTableForm` actually blocks anything."*
- `odd-platform__ts__routes__route__masterData.md:security.known_security_gaps.[0]` (HIGH per sidecar — "The route mount lists three permissions to `WithPermissionsProvider` but the Provider does not block rendering. A reviewer auditing route-level RBAC by reading App.tsx alone would conclude the page is gated; it is not.")
- `odd-platform__ts__routes__route__masterData.md:security.known_security_gaps.[1]` (MEDIUM — partial 3-of-9 permission enumeration on the route mount)
- `odd-platform__ts__routes__route__masterData.md:stress_findings.auth_gates` (DRIFT_NAME_VS_BEHAVIOR — *"the route mount LOOKS like a gate (it names 3 permissions, wraps the component in `WithPermissionsProvider`) but does NOT block rendering"*)
- `odd-platform__ts__routes__route__masterData.md:probes_emitted.P-163` — *"Does visiting `/master-data/lookup-tables` with zero of LOOKUP_TABLE_CREATE/_UPDATE/_DELETE render the page (confirming the WithPermissionsProvider is not a route-level gate)?"*
- `concepts.yaml:entities[Lookup Table]` + `concepts.yaml:entities[Permission (Authorization)]` (cross-link — the 9 LOOKUP_TABLE_* permissions enumerated on `PolicyPermissionDto.java:80-88`)

### Evidence

- WebFetch `https://docs.opendatadiscovery.org/features/master-data-management/lookup-tables` 2026-05-26 status **200** (DIRECT FETCH via masterData-route sidecar this session, within LSN-018 stale-probe window) — verbatim: *"In the platform UI, lookup tables live under the top-level **Master Data** tab → **Lookup Tables**."* and *"[the +Add new button is] gated by the `LOOKUP_TABLE_CREATE` permission"* and *"9 permissions on three surfaces — table, definition (the column schema), and data (the rows)."* The page does NOT state the URL path (`/master-data/lookup-tables`), does NOT say what users without LOOKUP_TABLE_CREATE/_UPDATE/_DELETE see when they visit the page directly, does NOT mention auth modes.
- `odd-platform-ui/src/routes/masterDataRoutes.ts:1-5` — verbatim: `const BASE_PATH = '/master-data'; export function lookupTablesPath() { return \`${BASE_PATH}/lookup-tables\`; }` (paraphrased). The `BASE_PATH` is module-private and exported NOWHERE; no `<Route path='/master-data'>` mount exists in `App.tsx:60-89`.
- `odd-platform-ui/src/components/App.tsx:75-88` (per masterData-route sidecar primary source) — the Lookup Tables route mount: `<Route path={lookupTablesPath()} element={<WithPermissionsProvider allowedPermissions={[Permission.LOOKUP_TABLE_CREATE, Permission.LOOKUP_TABLE_UPDATE, Permission.LOOKUP_TABLE_DELETE]} resourceId={undefined} permissionResourceType={undefined}><LookupTables /></WithPermissionsProvider>} />`. The wrapper's `allowedPermissions` are HONOURED only as a CONTEXT exposed via React Context — not as a render-blocking predicate. The wrapper unconditionally renders its child (`WithPermissionsProvider.tsx:30-39, 41-48` per the masterData-route sidecar).
- `odd-platform-ui/src/components/shared/contexts/Permission/WithPermissionsProvider.tsx:11-49` — the wrapper's body returns `<PermissionProvider ...>{render() || <Component /> || children}</PermissionProvider>`; the `isAllowedTo` computed by `PermissionProvider.tsx:19-25` is exposed via React Context but never used by the Provider itself to gate rendering.
- `odd-platform-ui/src/components/shared/contexts/Permission/WithPermissions.tsx:11-32` — the SIBLING component (different name, no `Provider` suffix) that DOES gate rendering: `return hasAccessTo(permissionTo) ? <>{children}</> : null;` (line 28). This is the actual gate used inside `LookupTables.tsx:72-82` to wrap the +Add new button.
- `odd-platform-ui/src/components/Toolbar/ToolbarTabs/ToolbarTabs.tsx:100-104` (per masterData-route sidecar) — the Master Data tab uses `pathname.includes('master-data')` (substring match) to compute "selected"; both `/master-data` (no match for `<Route>`) and `/master-data/lookup-tables` (real route) light up the tab as selected — so the operator who visits bare `/master-data` sees a SELECTED tab + an empty content area + no error, reinforcing the impression "the page should be here, but it's empty."
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/dto/policy/PolicyPermissionDto.java:80-88` (per masterData-route sidecar source cross-reference) — the 9 LOOKUP_TABLE_* permissions: `LOOKUP_TABLE_CREATE`, `LOOKUP_TABLE_UPDATE`, `LOOKUP_TABLE_DELETE`, `LOOKUP_TABLE_DEFINITION_CREATE`, `LOOKUP_TABLE_DEFINITION_UPDATE`, `LOOKUP_TABLE_DEFINITION_DELETE`, `LOOKUP_TABLE_DATA_CREATE`, `LOOKUP_TABLE_DATA_UPDATE`, `LOOKUP_TABLE_DATA_DELETE`. The route mount references only the first 3.

### Drift narrative

The Master Data pillar has THREE simultaneous P-03 URL-surface-vs-doc drifts:

**Drift 1 — overstated RBAC restriction.** The live `lookup-tables.md` page implies the page is gated (it names `LOOKUP_TABLE_CREATE` as a gating permission; the App.tsx route mount lists CREATE + UPDATE + DELETE on `WithPermissionsProvider`). Both signals lead an operator (or a reviewer auditing RBAC via the codebase) to conclude the PAGE is route-gated. In reality, the route renders unconditionally — only the in-page `+ Add new` button is gated via `WithPermissions` (NO `Provider` suffix — a different component). The page is OPEN to read for any authenticated user; only mutations are gated. This is the read-collaborative posture, consistent with other Management surfaces, but undocumented on the page. An operator deploying multi-tenant ODD expects per-tenant lookup-table isolation; the page is structurally cross-tenant by design — undocumented.

**Drift 2 — 3-of-9 partial permission enumeration.** The doc page lists 9 LOOKUP_TABLE_* permissions across three surfaces (table / definition / data). The route mount enumerates 3. The other 6 are enforced backend-side via `SecurityConstants.SECURITY_RULES` but never surfaced on the route layer or doc-cross-linked to specific UI surfaces. A reviewer reading the route mount cannot tell that the table-detail view (`LookupTableDetails.tsx`) carries the 6 DEFINITION_* / DATA_* permission checks at unspecified sub-component depth; the page lists permissions but never anchors them to specific UI gates. (Cross-reference DOC-GAP-077 + DOC-GAP-078 — sibling permissions-page drift cluster.)

**Drift 3 — bare-base URL dead-end.** The masterData-route module declares `BASE_PATH = '/master-data'` but no `<Route>` is mounted at the bare base. Visiting `/master-data` directly produces no route match; React Router renders nothing; no fallback, no redirect to `/master-data/lookup-tables`. The toolbar tab uses `lookupTablesPath()` so in-UI navigation never hits the dead-end, BUT (a) the doc page says "the top-level Master Data tab → Lookup Tables" — implying a `/master-data` parent exists and is the entry — and (b) the substring-matching `pathname.includes('master-data')` in `ToolbarTabs.tsx:101` lights up the tab as selected at the dead-end URL, REINFORCING the operator's belief that "the page should be here." This is the same convention break as DOC-GAP-300 (bare `/terms` blank page) and the inverse of DOC-GAP-287's `/data-modelling` (which DOES redirect). The Master Data pillar reserves a URL namespace it does not currently use; if a future sub-feature (e.g. enterprise glossary, lineage rules, code lists) adds a sibling sub-route, the convention should be either a redirect or an explicit landing page.

**Cross-link to DOC-GAP-302 (NEW batch ZH companion META)**: the WithPermissionsProvider misuse here is the FIRST surfaced instance of a 5+-route-mount-site naming-vs-behaviour pattern. See DOC-GAP-302 for the META.

### Proposed doc action

**Three-part action — one doc page edit + one cross-link + one optional code fix.**

1. **Doc-side PRIMARY — extend `features/master-data-management/lookup-tables.md`** with an explicit "Visibility and access control" sub-section AFTER the feature description, BEFORE the "9 permissions across three surfaces" paragraph:

   > **Visibility — the Lookup Tables page is a read-collaborative catalog surface.** Any authenticated user can open `/master-data/lookup-tables` and see the full list of lookup tables across all namespaces. The route is NOT permission-gated at the page level. The page renders the same chrome (search box, table list) for every signed-in user.
   >
   > **What permissions affect.** Permissions gate ACTIONS (Create / Edit / Delete), not page visibility:
   > - `LOOKUP_TABLE_CREATE` — hides the **+ Add new** button on the Lookup Tables list page.
   > - `LOOKUP_TABLE_UPDATE` — hides the **Edit** affordances on each table's detail page.
   > - `LOOKUP_TABLE_DELETE` — hides the **Delete** button on each table's detail page.
   > - `LOOKUP_TABLE_DEFINITION_{CREATE,UPDATE,DELETE}` — gate column-schema mutations inside the table-detail view.
   > - `LOOKUP_TABLE_DATA_{CREATE,UPDATE,DELETE}` — gate row-level mutations inside the table-detail view.
   >
   > The permission-aware affordance system **HIDES** rather than **disables** the buttons. A user who lacks a permission sees no signal that the corresponding action exists. This is a deliberate UX convention to avoid permission-aware styling forks. To check what permissions a feature requires, consult the [Permissions reference](../../configuration-and-deployment/enable-security/authorization/permissions.md).
   >
   > Under `auth.type=DISABLED`, the entire page is anonymously reachable AND the underlying REST endpoints accept anonymous mutations (no auth gate at any layer). See [DISABLED authentication](../../configuration-and-deployment/enable-security/authentication/disabled-authentication.md) for the full posture.

2. **Doc-side COMPANION — cross-link from the `Permissions` page** (`configuration-and-deployment/enable-security/authorization/permissions.md`): in the "Management permissions" section, add a one-line note clarifying that the 9 LOOKUP_TABLE_* permissions are NOT route-level page gates but per-action button gates, and link to the lookup-tables.md visibility paragraph. Anchor the 9-permission enumeration to specific UI affordances (table-list page / table-detail page / data-grid view).

3. **Code-side OPTIONAL (defence-in-depth)** — file `/log-issue odd-platform`: either (a) wrap the route at `App.tsx:75-88` in `WithPermissions` (the rendering-gate component, NOT `WithPermissionsProvider`) on `LOOKUP_TABLE_CREATE | _UPDATE | _DELETE` — but this CONTRADICTS the read-collaborative posture and would hide the page from read-only users; do NOT pursue without a deliberate posture change. (b) Add a redirect at `App.tsx` for the bare `/master-data` URL: `<Route path='/master-data' element={<Navigate to='/master-data/lookup-tables' replace />} />` — closes the dead-end consistent with the `/data-modelling` convention. Recommended (b) only; (a) is documented here only to surface the option for the maintainer.

### Cross-references

- **DOC-GAP-302** (NEW batch ZH META — WithPermissionsProvider naming-vs-behaviour drift across 5+ route-mount sites): THIS finding is the FIRST surfaced primary-source for the META; cross-link.
- **DOC-GAP-263** (HIGH — `/data-quality` route has NO client-side permission gate AND every live Data Quality doc page is silent on access control): SIBLING POSTURE — same read-collaborative posture, same doc-side silence; THIS finding adds the Master Data pillar to the same cluster (the doc page IS not silent here, but it OVERSTATES the restriction rather than disclosing it).
- **DOC-GAP-082 META** (DISABLED-bypasses-RBAC primary surface — 29-sidecar triangulation): under DISABLED, the Lookup Tables route is anonymously reachable AND the backend ReferenceDataController endpoints accept anonymous mutations (cross-reference the ReferenceDataController sidecar at `lineage/odd-platform/understanding/odd-platform__java__ReferenceDataController__controller-class__ReferenceDataController.md`). Adds the 30th-31st-32nd surface to the META cluster (the LookupTables UI + ReferenceDataController + masterData-route).
- **DOC-GAP-077** + **DOC-GAP-078** (Permissions-page enumeration / Administrator policy `'ALL'` handling): sibling P-03 / Permissions-doc drifts; this finding amplifies them with the route-mount evidence.
- **LSN-006** (Lookup Tables content homing): same feature, different LSN class (content-homing vs visibility-disclosure); the doc page IS authored, but at the WRONG depth for the visibility story.
- **DOC-GAP-186** (Management top-nav tab visibility): sibling CONVENTION pattern — Management surface as a whole has the same read-collaborative posture under-disclosed at the doc-product level.

### Severity rationale

MEDIUM. Compound finding across three vectors:

- **Drift 1 (overstated RBAC restriction)**: MEDIUM-impact. An operator deploying multi-tenant ODD reads the lookup-tables.md page, sees the permission framework, and assumes per-tenant isolation OR at least per-permission page-gating. They are wrong. The doc page does not disclose. Same class as DOC-GAP-186 and DOC-GAP-263 — operator-facing access-control silence on a catalog-wide page.
- **Drift 2 (3-of-9 partial enumeration)**: LOW-impact. Reviewer-trap, not operator-trap. A reviewer auditing the codebase reads the route mount, sees 3 permissions, assumes those are the surface; misses the 6 backend-enforced surfaces. Operator never sees this directly.
- **Drift 3 (bare-base dead-end)**: LOW-impact, same class as DOC-GAP-300. URL convention break; rarely hit via in-UI flow.

Severity composite is MEDIUM because (a) Drift 1 alone is MEDIUM, (b) the three drifts compound at the operator-facing layer (the doc says "page is gated", the URL is dead-end, the route mount overstates the gating — three signals all wrong, one reinforces the other), and (c) the fix is bounded: one doc-page rewrite + one cross-link + one optional code-side redirect. Not HIGH because no data loss / security boundary crossed (the BACKEND endpoints ARE gated via SECURITY_RULES; per-action UI gates ARE applied; the read-collaborative posture IS the intent).

### Last verified

- 2026-05-26 — masterData-route sidecar PRIMARY SOURCE at substrate commit `9ac6436e`; live WebFetch lookup-tables.md status 200 (inherited within LSN-018 stale-probe window from this session's masterData-route sidecar enrichment); App.tsx + WithPermissionsProvider.tsx + WithPermissions.tsx + PermissionProvider.tsx + ToolbarTabs.tsx all verified against the local checkout.

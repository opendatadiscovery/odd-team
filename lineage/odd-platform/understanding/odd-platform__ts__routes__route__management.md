---
node_id: "odd-platform ts routes route:management"
node_kind: route
axis: ui_routes
extracted_at_commit: 4ec2b20
enriched_at_commit: 4ec2b20
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-26-ZH-managementRoutes
feature_hint: "P-08 Management catch-all UI surface — Owners + Roles + Policies + Namespaces + Collectors + DataSources + Tags + Integrations + Owner-Associations. Pairs with batch-Q (PolicyList / RolesList / OwnersList / CollectorsList components), batch-ZF (OwnerController), batch-ZD (RoleController / PolicyController / PermissionController), batch-W (NamespaceController / TagController)."
related_features: []
related_pillar_features: ["P-08:F-*"]
---

# managementRoutes — semantic understanding

## understanding

This module is the URL-shape contract for the platform-UI Management section,
the catch-all admin surface that hosts nine distinct sub-areas (Namespaces,
Datasources, Integrations, Collectors, Owners, Tags, Owner-Associations,
Roles, Policies) on a vertical-tab layout. It declares a private
`BASE_PATH = '/management'` plus a frozen `ManagementRoutes` literal mapping
nine sub-route names; it exposes `managementPath(path?)` to build either the
bare `/management` URL or a `/management/<sub>` URL, `AssociationsRoutes` +
`associationsPath()` for the three associations sub-tabs (`new` / `history` /
`active`), and `integrationsPath(integrationId, path?)` + a
`useIntegrationRouteParams()` hook for the integration-detail URLs.

The module owns NO rendering, NO authorization, NO data fetching — those
live in three downstream consumers: `App.tsx:62` mounts the parent splat
route `<Route path={`${managementPath()}/*`} element={<Management />} />`,
`ManagementTabs.tsx:19-50` builds the vertical-tab strip from each sub-route
literal, and `ManagementRoutes.tsx:23-157` mounts the per-sub-route `<Route>`
declarations and their permission wrappers. The route module is therefore the
single point at which the nine sub-area URL slugs are declared as a
compile-time enum — adding a tenth area is a deliberate edit to this file
plus three consumer edits.

## concepts

- entities:
  - ManagementSubRoute (one of `namespaces` / `datasources` / `integrations` /
    `collectors` / `owners` / `tags` / `associations` / `roles` / `policies` —
    the nine domain areas that share the Management chrome)
  - AssociationsSubRoute (one of `new` / `history` / `active` — the
    user-owner-association approval inbox sub-tabs)
  - IntegrationRouteParams (the URL-path-parameter shape for an Integration
    detail page: a single `integrationId` string)
- operations:
  - build base management URL (`managementPath()` → `/management`)
  - build sub-area URL (`managementPath('owners')` → `/management/owners`)
  - build associations sub-tab URL (`associationsPath('new')` →
    `/management/associations/new`)
  - build integration list/detail URL (`integrationsPath('abc')` →
    `/management/integrations/abc`)
  - type-narrow the `path` argument via `ManagementRoutesType` and
    `AssociationsRoutesType` (compile-time exclusion of unknown sub-routes)
  - extract the integration id from the URL via
    `useIntegrationRouteParams()` (a typed wrapper around
    `react-router-dom`'s `useParams`)
- invariants:
  - `BASE_PATH = '/management'` is the single canonical prefix for every
    management URL in the UI; consumers that hard-code `/management` instead
    of calling `managementPath()` drift silently.
  - the nine sub-area slugs are compile-time-restricted to the literals in
    `ManagementRoutes`; the type signature of `managementPath` accepts only
    those values (no `string` fallback).
  - `associationsPath()` requires an argument (no zero-arg overload — typed
    as `AssociationsRoutesType[keyof AssociationsRoutesType]`), so consumers
    cannot accidentally link to `/management/associations` without picking
    a sub-tab.
  - `integrationsPath()` requires a `integrationId` string and optionally a
    sub-path; the `integrationId` is interpolated via `generatePath()` so
    React Router's route-param-encoding rules apply (URL-safe encoding).
  - `useIntegrationRouteParams()` performs a `as` cast — the hook PROMISES
    a non-undefined `integrationId` to the caller. If the hook is called
    outside the integration detail route, `integrationId` is undefined at
    runtime despite the type assertion (see Category F + corner-case below).
- audiences:
  - signed-in platform users with Management-tier permissions (per the
    `Permission.OWNER_ASSOCIATION_MANAGE` outer wrapper at Management.tsx:9-12
    and the per-sub-route `WithPermissionsProvider` wrappers at
    ManagementRoutes.tsx:29-149)
  - in practice, ANY authenticated user — see security.known_security_gaps:
    only the `associations/*` sub-route is hard-gated; every other sub-route
    renders the list to any authenticated session, and only the
    create/update/delete BUTTONS hide

## dependencies_semantic

- requires-feature:
  - the parent `<Management>` component tree mounted in `App.tsx:62`
    (the route only resolves to a rendered view when this mount exists)
  - per-sub-route components (NamespaceList, DataSourcesList, Integrations,
    CollectorsList, OwnersList, TagsList, OwnerAssociations, RolesList,
    PolicyList, PolicyDetails) lazy-loaded from
    `components/Management/*` — ManagementRoutes.tsx:8-21
- requires-config: []
- requires-runtime:
  - `react-router-dom` — both `generatePath` and `useParams` are imported
    at managementRoutes.ts:1; this module is one of two route modules that
    imports from react-router-dom directly (the other is `searchRoutes.ts:1`)
- additional_coupling:
  - exposed via `routes/index.ts:4` (`export * from './managementRoutes'`),
    so consumers import from `'routes'` rather than the file directly;
    refactoring the file path is safe but renaming the exports breaks every
    consumer
  - `ManagementRoutes` (the object literal on managementRoutes.ts:4-14) is
    NOT used as a source of truth for the inner `<Routes>` declarations in
    `components/Management/ManagementRoutes/ManagementRoutes.tsx:29-150`,
    which re-hard-code the same nine slugs as string literals — see
    bugs_limitations_corner_cases for the consequence

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "`managementPath()` with no argument returns `/management`"
    test_class: unit
    criticality: LOW
    note: "trivial — but a typo in BASE_PATH (e.g. `/manage`) would silently break every link"
  - behaviour: "`managementPath('owners')` returns `/management/owners`"
    test_class: unit
    criticality: LOW
  - behaviour: "the type system rejects `managementPath('admin')` (a slug not in the literal map)"
    test_class: unit
    criticality: LOW
    note: "compile-time check, not runtime — would surface in a tsd / tsc test"
  - behaviour: "`associationsPath('new')` returns `/management/associations/new`"
    test_class: unit
    criticality: LOW
  - behaviour: "`integrationsPath('abc')` returns `/management/integrations/abc`"
    test_class: unit
    criticality: LOW
  - behaviour: "`integrationsPath('abc/def')` URL-encodes the slash (or doesn't — see Category F)"
    test_class: unit
    criticality: MEDIUM
    note: "generatePath behaviour with embedded special chars is non-trivial — see Category F finding"
  - behaviour: "any authenticated user — regardless of Management-tier permissions — can navigate to `/management/<every sub-route except associations>` and see the rendered list"
    test_class: integration
    criticality: HIGH
    note: "this is the central Category D finding; the probe P-162 pins it"
  - behaviour: "`/management/associations/*` redirects to `../namespaces` when the user lacks OWNER_ASSOCIATION_MANAGE"
    test_class: integration
    criticality: MEDIUM
    note: "the single working route-level gate in the section"
  - behaviour: "an unauthenticated visitor (auth.type=DISABLED or anonymous session) reaches `/management/*` and sees all data"
    test_class: security
    criticality: MEDIUM
    note: "secondary hypothesis under P-162"
- test_files: []
- gaps: |
    No unit tests target this module or any other module under
    `odd-platform-ui/src/routes/`. The directory-wide gap noted in
    `odd-platform__ts__routes__route__alerts.md` applies here verbatim.

    The high-leverage gap on THIS node is integration coverage of the
    route-level authorization story. The Management surface mounts NINE
    distinct admin-tier sub-areas under a single splat route in App.tsx:62
    with no route-level guard. Inside `Management.tsx`, the outer
    `<WithPermissionsProvider allowedPermissions={[OWNER_ASSOCIATION_MANAGE]}>`
    only provides a permission CONTEXT to descendants — it does NOT block
    rendering. Each per-sub-route `WithPermissionsProvider` inside
    `ManagementRoutes.tsx` does the same — provides context, does not block.
    The single route-level GUARD is the `<RestrictedRoute>` around
    `associations/*` (ManagementRoutes.tsx:101-110). Every other tab — the
    full Namespace catalog, the full Owner catalog, the full Role catalog,
    the full Policy catalog with detail pages, the Datasource catalog, the
    Collector catalog, the Tag catalog, the Integration catalog — is reachable
    by deep-link from any authenticated session and the list data is fetched
    (see NamespaceList.tsx:46-48 — the `fetchNamespaceList` thunk fires
    unconditionally on mount).

    No integration test currently exercises "user with empty permission set
    deep-links to `/management/policies` — what is shown?". That probe is
    P-162.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization"
    anchor: ""
    rationale: "The Authorization page enumerates the five sub-areas (Policies, Permissions, Roles, Owners, User-owner association) that the Management UI exposes; it is the closest semantic match for what /management is FOR. The page does not, however, name a `/management` URL or describe the UI shape."
    last_verified_at: "2026-05-26T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      Subsections listed on the Authorization page (verified 2026-05-26, status 200):
      "Policies", "Permissions", "Roles", "Owners", "User-owner association".
      The page does NOT mention a /management URL, does NOT describe what the
      Management UI looks like, and does NOT discuss per-tab vs. per-section
      permission gating. The actual content of each linked sub-page (Policies,
      Permissions, Roles, Owners, User-owner association) defines what each
      role/permission does, but never references the UI surface that exposes
      them.
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions"
    anchor: ""
    rationale: "The Permissions page enumerates all 68 Permission enum values used by the per-sub-route WithPermissionsProvider wrappers in ManagementRoutes.tsx. It is the canonical doc for what each permission ALLOWS, but does not relate them to the UI route surface."
    last_verified_at: "2026-05-26T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      "Management permissions (11 permissions): COLLECTOR_*, DATA_SOURCE_*,
      NAMESPACE_*, OWNER_*, POLICY_*, ROLE_*, TAG_*, DIRECT_OWNER_SYNC,
      OWNER_RELATION_MANAGE, OWNER_ASSOCIATION_MANAGE"
      "OWNER_ASSOCIATION_MANAGE: approving or denying user-owner association
      requests"
      The page does NOT describe how these permissions gate UI access; it
      describes only what each permission allows at the API surface.
- doc_drift_findings:
  - "The user-facing documentation has no Management page — no /management URL is described, no screenshot of the vertical-tab layout, no statement of which tabs are admin-only and which are visible to any authenticated user. The Management UI is one of the largest navigable surfaces in the SPA (9 sub-areas, ~9-10 list+form+detail components) and is entirely undocumented. This is a HIGH-severity bidirectional doc-coverage gap (Cornerstone-6 candidate for the documentation pillar)."
  - "The docs implicitly imply that Policies / Roles / Owners are admin-only concepts (they live under the Authorization parent page), but the code reveals that NON-admin users see the full Policy, Role, and Owner catalogs through the Management UI — only WRITE actions are permission-gated, and only Associations is route-gated. An operator reading the docs would form the mental model 'Management is admin-only' that the code contradicts. This is a Cornerstone-3 (caveat capture) finding for both the Permissions doc page and a missing Management UI doc."
  - "The OWNER_ASSOCIATION_MANAGE permission is described in the docs (verified 2026-05-26) as 'approving or denying user-owner association requests', which IS the only management sub-tab guarded by RestrictedRoute at the UI route level (ManagementRoutes.tsx:101-110). This is a single point of alignment between code and docs — but it is incidental, not documented as the design intent."

## implicit_adrs

- "Route modules under `odd-platform-ui/src/routes/` declare `BASE_PATH` as a file-private inline `const` rather than importing from a shared routes module." — evidence: managementRoutes.ts:3 + alertsRoutes.ts:1 + activityRoutes.ts:1 + dataEntitiesRoutes.ts:4 + directoryRoutes.ts:4 + searchRoutes.ts:3 + termsRoutes.ts:4 + masterDataRoutes.ts:1 (8 of 9 non-index modules; the `dataModelling/` sub-directory at dataModelling.ts:3 is the one outlier, exporting `BASE_PATH` so sibling `queryExamplesRoutes.ts` and `relationshipsRoutes.ts` can share it) — intent_anchor: "the consistency of the pattern across 8 sibling modules is the convention" — confidence: HIGH

- "The Management UI is structured as a single splat route in `App.tsx` with an inner React-Router `<Routes>` declaration in `ManagementRoutes.tsx`; per-sub-route permission CONTEXT is provided via `WithPermissionsProvider` wrappers (NOT route-level guards), and the actual write-button gating lives further inside each list component via `<WithPermissions>` checks against the contextual permission set." — evidence: App.tsx:62 (single splat route) + Management.tsx:9-12 (outer provider with [OWNER_ASSOCIATION_MANAGE]) + ManagementRoutes.tsx:29-149 (per-sub-route providers) + NamespaceList.tsx:89-99 (the actual write gate using WithPermissions, not WithPermissionsProvider) — intent_anchor: "`<WithPermissionsProvider Component={NamespaceList} />` pattern repeated for 7 of 9 sub-areas at ManagementRoutes.tsx — the consistency of the pattern is the convention" — confidence: HIGH

- "The `OwnerAssociations` route is the ONLY sub-route to use `RestrictedRoute` (a guard that redirects) rather than `WithPermissionsProvider` (a context provider). The redirect target `../namespaces` is hard-coded relative to `/management/associations/*`, so the user is bounced to `/management/namespaces` — the same default destination the `<Route path='' element={<Navigate to='namespaces' replace />} />` rule (ManagementRoutes.tsx:151) uses for an empty `/management` path." — evidence: ManagementRoutes.tsx:101-110 (RestrictedRoute for associations) + ManagementRoutes.tsx:151 (Navigate fallback for empty path) — intent_anchor: "`redirectTo='../namespaces'` matches `<Navigate to='namespaces' replace />` — both treat `namespaces` as the safe-default management landing" — confidence: HIGH

- "The Management UI assumes the user is signed-in — there is no anonymous fallback. The `Permission` context (PermissionContext.ts:9-13) defaults to fail-closed (`isAllowedTo: false`, `getHasAccessTo: () => false`), so an unauthenticated visitor under `auth.type=LOGIN_FORM` is redirected to login by the platform's Spring Security layer BEFORE reaching this UI. Under `auth.type=DISABLED`, the default permission set is whatever the back-end injects (per the profile.thunks fetchIdentity call from App.tsx:48)." — evidence: PermissionContext.ts:9-13 (fail-closed default) + App.tsx:48 (fetchIdentity at boot) + retrospectives/LSN-002-minio-region-unset.md (similar 'silent-default behaviour' class) — intent_anchor: "the `defaultBehaviour` constant explicitly sets `isAllowedTo: false` — that is an authoring choice, not an oversight" — confidence: HIGH

## bugs_limitations_corner_cases

- "The Management UI is mounted in `App.tsx:62` (`<Route path={`${managementPath()}/*`} element={<Management />} />`) with no route-level permission guard. Inside `Management.tsx` the outer `<WithPermissionsProvider allowedPermissions={[OWNER_ASSOCIATION_MANAGE]}>` provides a permission context but does NOT block rendering (see WithPermissionsProvider.tsx:30-39, 41-48 — it returns `children` unconditionally). Result: any authenticated user — including a user with zero Management-tier permissions — who navigates to `/management` lands on the page, sees the ManagementTabs strip, sees the default `Namespaces` tab pre-selected, and the NamespaceList fetches and displays the entire namespace catalog. The user cannot create/update/delete (those buttons are gated by `<WithPermissions>` inside each list component) but they READ the full catalog. Same applies to /management/owners, /management/roles, /management/policies, /management/policies/:id, /management/tags, /management/datasources, /management/collectors, /management/integrations, /management/integrations/:id. The single exception is /management/associations/*, which is route-gated by `<RestrictedRoute isAllowedTo={hasAccessTo(OWNER_ASSOCIATION_MANAGE)} redirectTo='../namespaces' />` at ManagementRoutes.tsx:101-110 — and only because that route uses RestrictedRoute (a guard) rather than WithPermissionsProvider (a context). The operator mental model 'the Management page is admin-only' is therefore wrong; the code says 'any authenticated user reads everything; the Associations tab is admin-only'." — evidence: App.tsx:62 + Management.tsx:9-21 + ManagementRoutes.tsx:29-150 + WithPermissionsProvider.tsx:12-48 + NamespaceList.tsx:46-48 — severity: HIGH

- "The `/management/integrations` and `/management/integrations/:id` routes have NO `<WithPermissionsProvider>` wrapping at all (ManagementRoutes.tsx:150 — `<Route path='integrations/*' element={<Integrations />} />`). Every other sub-route at least wraps in a context provider. There is no operator-visible difference — the wrappers don't block rendering anyway — but the inconsistency suggests the Integrations sub-area was retro-fitted without the permission-context discipline applied to the eight other sub-areas. If the Integration list/detail components rely on `usePermissions()` for any internal gating, those calls fall back to the OUTER Management.tsx context (which carries `[OWNER_ASSOCIATION_MANAGE]` only), producing surprising deny-by-default for any integration-specific permission check." — evidence: ManagementRoutes.tsx:150 (no permission wrapping) + Management.tsx:9 (outer context = OWNER_ASSOCIATION_MANAGE only) + Integrations.tsx:10-19 (no permission gating in the integrations subtree either) — severity: MEDIUM

- "`useIntegrationRouteParams()` (managementRoutes.ts:43-44) performs a type assertion (`as IntegrationRouteParams`) that PROMISES a non-undefined `integrationId` to every caller. If a caller invokes the hook outside a route that has `:integrationId` in its path, `useParams` returns `{}` at runtime and `integrationId` is `undefined`, but the type system reports it as `string`. A consumer that does `const { integrationId } = useIntegrationRouteParams(); fetchIntegration(integrationId);` (no null-check) crashes at runtime with the URL parameter undefined. The single in-repo caller (IntegrationHeader.tsx) is grep-confirmed to be inside an `:integrationId` route, so the assertion holds today — but the assertion is a type-system lie waiting for the next caller." — evidence: managementRoutes.ts:43-44 (`useParams<keyof IntegrationRouteParams>() as IntegrationRouteParams`) + react-router-dom v6 useParams docs (returns Partial<Record<K, string>>; the cast strips the Partial) — severity: LOW

- "Renaming any of the nine string literals in `ManagementRoutes` (managementRoutes.ts:4-14) silently breaks the inner `ManagementRoutes` React component (components/Management/ManagementRoutes/ManagementRoutes.tsx:29-150) because the inner component re-hard-codes the same nine slugs as `path='namespaces'`, `path='datasources'`, etc. instead of importing them from this module. The `ManagementRoutes` object literal is therefore a single source of truth for *callers* of `managementPath()` but NOT for the route DEFINITIONS. Likewise the inner `redirectTo='../namespaces'` (line 106) and `<Navigate to='namespaces' />` (line 151) re-hard-code the slug. The same caveat applies to AlertsRoutes (per the alerts sidecar's analogous corner-case)." — evidence: managementRoutes.ts:4-14 (declares the literals) + components/Management/ManagementRoutes/ManagementRoutes.tsx:29-151 (re-hard-codes the same literals) — severity: LOW

- "The `AssociationsRoutes` literal (managementRoutes.ts:22-26) declares three sub-tabs (`new` / `history` / `active`), but the inner `<OwnerAssociations>` component is splat-mounted (`path='associations/*'` at ManagementRoutes.tsx:102) without any visible association between the three slugs and the route definitions. Like the corner-case above, renaming `new` to `pending` silently breaks every link without a failing test." — evidence: managementRoutes.ts:22-26 + components/Management/OwnerAssociations/* — severity: LOW

- "No unit tests target this module. A typo in `BASE_PATH` (e.g., `/manage`) would not be caught by the build or by tests; it would surface only when a human user clicks a Management link in the AppToolbar." — evidence: grep `managementPath|associationsPath|integrationsPath` across `*.test.*` / `*.spec.*` in `odd-platform-ui` returned no matches at commit 4ec2b20 — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables: []  # no numeric literals, no @Value-style defaults, no magic strings
                # gating behaviour inside this file; the only literals are the
                # URL slugs themselves, which are interrogated in name_behavior_pairs

  name_behavior_pairs:
    - name: "managementPath(path?)"
      promise: "Build a management URL — either /management (no arg) or /management/<sub> (with arg). The arg is type-restricted to the nine declared sub-route slugs."
      implementation: "Two-line builder at managementRoutes.ts:17-20. If `path` is undefined → returns `BASE_PATH = '/management'`. Otherwise returns `generatePath(`${BASE_PATH}/${path}`)`. No URL-encoding concerns because `path` is type-restricted to one of nine literal strings, none of which contain slashes or special characters."
      drift: NONE
      operator_visible_consequence: ""
      confidence: STATIC-INFERRED
      evidence: "managementRoutes.ts:17-20"

    - name: "associationsPath(path)"
      promise: "Build an associations sub-tab URL — /management/associations/<new|history|active>. The arg is type-restricted to the three declared sub-tab slugs."
      implementation: "Single-line builder at managementRoutes.ts:30-34. Returns `${managementPath('associations')}/${path}` — i.e. `/management/associations/<path>`. Note that the function REQUIRES an argument (no default, no overload for path-less): the caller cannot link to bare `/management/associations`."
      drift: NONE
      operator_visible_consequence: ""
      confidence: STATIC-INFERRED
      evidence: "managementRoutes.ts:30-34"

    - name: "integrationsPath(integrationId, path?)"
      promise: "Build an integration list/detail URL — /management/integrations/<id> or /management/integrations/<id>/<path>. The integrationId is interpolated as a URL parameter."
      implementation: "Builder at managementRoutes.ts:46-56. Uses `generatePath()` from react-router-dom with `:integrationId` as the parameter placeholder; the integrationId is URL-encoded per react-router-dom's encoding rules. The optional `path` is appended verbatim — no further encoding, no type narrowing — so a caller passing `path='foo/bar?x=1'` produces `/management/integrations/<id>/foo/bar?x=1` (the slash becomes part of the route, the `?` becomes a query string)."
      drift: MINOR
      operator_visible_consequence: "The `path` parameter is typed as `string` (not a literal union), so any caller can pass any string including slashes and query-string fragments. This is permissive by design (integration sub-routes are dynamic), but the type signature provides no narrowing — a typo like `integrationsPath('abc', 'config/security ')` (trailing space) silently produces a broken URL with no compile-time warning."
      confidence: STATIC-INFERRED
      evidence: "managementRoutes.ts:46-56"

    - name: "useIntegrationRouteParams()"
      promise: "Read the integrationId from the current URL, typed as a non-undefined string."
      implementation: "Hook at managementRoutes.ts:43-44 wraps `useParams<keyof IntegrationRouteParams>()` with `as IntegrationRouteParams`. The cast strips the `Partial<>` wrapper that react-router-dom v6's `useParams` returns by default, asserting that `integrationId` is always a defined string. At runtime, if the hook is called outside an `:integrationId` route, `integrationId` is `undefined` despite the type — see bugs_limitations_corner_cases."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "If a future caller invokes this hook from a route without `:integrationId` in its path, the destructured `integrationId` will be `undefined` at runtime, but the type system reports it as `string`. A subsequent `fetchIntegration(integrationId)` call passes `undefined` to the backend, which 400s or 404s. The single current caller (IntegrationHeader.tsx) is inside an `:integrationId` route so the assertion holds today."
      confidence: STATIC-INFERRED
      evidence: "managementRoutes.ts:43-44"

  orderings: []  # no ORDER BY, no LIMIT, no pagination, no Comparator — pure URL builder

  auth_gates:  # central concern per the prompt — Category D
    - location: "App.tsx:62"
      endpoint: "ROUTE /management/* (the entire Management splat surface)"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: |
            The route module itself emits the same URL strings regardless of auth.type — it is a client-side declarative artefact. The DOWNSTREAM rendering branches as follows:
            - DISABLED: the SPA mounts under an anonymous session. Identity is fetched at App.tsx:48 (fetchIdentity); if the server returns an identity with the empty permission set, the Management page renders with all eight non-associations sub-tabs visible and the Associations tab HIDDEN (per the hideAssociations memo at ManagementTabs.tsx:14-17). Lists are fetched (e.g. NamespaceList.tsx:46-48) and rendered. Write buttons are hidden via the inner WithPermissions checks.
            - LOGIN_FORM / OAUTH2 / LDAP: the Spring Security layer at the back-end redirects unauthenticated visitors to the login flow BEFORE the SPA bundle is served. Authenticated users with empty Management-tier permissions see the same view as DISABLED (lists rendered, write buttons hidden, Associations tab hidden).
            The auth.type value does not branch this module's behaviour; it branches whether the visitor reaches the SPA at all.
          confidence: STATIC-INFERRED
          evidence: "App.tsx:48 (fetchIdentity at boot) + ManagementTabs.tsx:14-17 (hideAssociations) + ManagementRoutes.tsx:101-110 (RestrictedRoute for associations only) + WithPermissionsProvider.tsx:12-48 (the wrapper provides context, does not block rendering)"
        - q: "What does an unauthenticated caller see (no cookie / no token)?"
          a: |
            Under auth.type=DISABLED: the user reaches the SPA, fetchIdentity returns whatever the back-end gives anonymous sessions (typically a default identity with empty global permissions; verify with P-162). The Management page renders with the lists populated; only Associations is hidden.
            Under auth.type=LOGIN_FORM / OAUTH2 / LDAP: the back-end's Spring Security layer redirects to /login (LOGIN_FORM) or the OAUTH2/LDAP flow BEFORE the SPA bundle is served. The user does not reach this UI without authentication.
            This is server-side enforcement, not UI-side — the UI assumes authentication and fail-closes for permission checks (PermissionContext.ts:9-13).
          confidence: STATIC-INFERRED
          evidence: "App.tsx:48 + PermissionContext.ts:9-13 + the live docs at docs.opendatadiscovery.org/configuration-and-deployment/enable-security (WebFetched 2026-05-26, status 200, describes auth.type=LOGIN_FORM as redirecting unauthenticated requests to /login)"
        - q: "What does a wrong-role caller see (e.g. READ_ONLY user hitting a WRITE-only UI)?"
          a: |
            The DOM is the same for every authenticated user, with three layers of conditional rendering peeled away as permissions are added:
            (1) All authenticated users see the eight non-associations tabs and the rendered lists/details/forms with create/edit/delete BUTTONS HIDDEN.
            (2) Users with OWNER_ASSOCIATION_MANAGE additionally see the Associations tab visible and the Associations sub-route renders (not redirected).
            (3) Users with sub-area-specific Permission(s) (e.g. NAMESPACE_CREATE) additionally see the corresponding create/edit/delete buttons on the relevant tab.
            A read-only user thus reaches /management/policies, sees the full Policy catalog, can navigate to /management/policies/:id and see the policy JSON, but cannot save changes (the form's Save button is gated by `<WithPermissions permissionTo={POLICY_UPDATE}>`). The same applies on every tab except Associations.
          confidence: STATIC-INFERRED
          evidence: "ManagementRoutes.tsx:29-149 (per-sub-route WithPermissionsProvider sets allowedPermissions) + NamespaceList.tsx:89-99 (the inner WithPermissions guard for the create button) + WithPermissions.tsx:23-29 (the actual guard logic — `hasAccessTo(permissionTo) ? children : null`)"
        - q: "Where exactly does the gate live — controller annotation, downstream service check, repository filter, or nowhere?"
          a: |
            UI-side: route-level gates live in TWO places: (a) at the Associations sub-route via RestrictedRoute (ManagementRoutes.tsx:101-110), the ONLY hard route gate in the Management section; (b) at the write-button level via the in-list <WithPermissions> wrappers (e.g. NamespaceList.tsx:89-99). There is NO route-level gate on the Management surface as a whole, and NO route-level gate on the other eight sub-areas individually.
            Back-end side: each Management API surface (POST /api/namespaces, POST /api/owners, POST /api/roles, POST /api/policy, etc.) is independently gated at the controller (see batch-ZD RoleController, batch-ZF OwnerController, batch-W NamespaceController/TagController, batch-E PolicyController sidecars). The READ endpoints may or may not be permission-gated — most are not (e.g. GET /api/tags/popular is anonymously readable per the TagController sidecar). The UI's permissive route-level posture mirrors the back-end's permissive read posture.
            Net: the gate-the-write, not the route posture is consistent across UI and back-end. The 'admin-only Management page' mental model is operator-side, not coded.
          confidence: STATIC-INFERRED
          evidence: "ManagementRoutes.tsx:101-110 (sole route gate) + Management.tsx:9-21 (outer provider provides context only) + cross-reference to lineage/odd-platform/understanding/odd-platform__java__RoleController__controller-class__RoleController.md + odd-platform__java__PolicyController__controller-class__PolicyController.md + odd-platform__java__NamespaceController__controller-class__NamespaceController.md + odd-platform__java__TagController__controller-class__TagController.md"

  resource_boundaries: []  # no @Transactional, no synchronized, no caches, no async — pure declarative module

  request_inputs:
    - location: "managementRoutes.ts:17"
      input_kind: local-variable  # function parameter on managementPath
      input_name: "path"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "A management sub-area slug — one of the nine declared in ManagementRoutes. The type signature `ManagementRoutesType[keyof ManagementRoutesType]` excludes arbitrary strings."
          confidence: STATIC-INFERRED
          evidence: "managementRoutes.ts:17"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Interpolated as the URL fragment after `/management/`. No other use — no logging, no validation beyond the type system, no transformation."
          confidence: STATIC-INFERRED
          evidence: "managementRoutes.ts:19"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES. The type signature pins the input to the nine declared slugs; the implementation interpolates verbatim. No drift."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "managementRoutes.ts:17-20"
        - q: "TRANSLATES_SILENTLY consequences?"
          a: "N/A — no translation."
          confidence: STATIC-INFERRED
          evidence: "managementRoutes.ts:17-20"
        - q: "Available-but-unused field with closer name match?"
          a: "NONE — the type system constrains the input; no available alternative."
          confidence: STATIC-INFERRED
          evidence: "managementRoutes.ts:17-20"
      routes_to_finding: ""

    - location: "managementRoutes.ts:30"
      input_kind: local-variable
      input_name: "path"  # the associationsPath argument
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "An associations sub-tab slug — one of `new` / `history` / `active`. The type signature `AssociationsRoutesType[keyof AssociationsRoutesType]` excludes other strings."
          confidence: STATIC-INFERRED
          evidence: "managementRoutes.ts:30-32"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Concatenated as the URL fragment after `/management/associations/`."
          confidence: STATIC-INFERRED
          evidence: "managementRoutes.ts:33"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "managementRoutes.ts:30-34"
        - q: "TRANSLATES_SILENTLY consequences?"
          a: "N/A."
          confidence: STATIC-INFERRED
          evidence: "managementRoutes.ts:30-34"
        - q: "Available-but-unused field?"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "managementRoutes.ts:30-34"
      routes_to_finding: ""

    - location: "managementRoutes.ts:46"
      input_kind: local-variable
      input_name: "integrationId"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "An integration identifier — a string that uniquely identifies one integration record. The name says 'id', no qualifier."
          confidence: STATIC-INFERRED
          evidence: "managementRoutes.ts:46"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Interpolated into `:integrationId` placeholder via `generatePath()` (react-router-dom). The placeholder is the substring substituted in the URL path; react-router-dom URL-encodes the value per its encoding rules. No validation, no normalisation, no length check."
          confidence: STATIC-INFERRED
          evidence: "managementRoutes.ts:48-55"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — the value is used exactly as an integration identifier in the URL path."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "managementRoutes.ts:46-56"
        - q: "TRANSLATES_SILENTLY consequences?"
          a: "N/A."
          confidence: STATIC-INFERRED
          evidence: "managementRoutes.ts:46-56"
        - q: "Available-but-unused field?"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "managementRoutes.ts:46-56"
      routes_to_finding: ""

    - location: "managementRoutes.ts:46"
      input_kind: local-variable
      input_name: "path"  # the integrationsPath optional second arg
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "A sub-path under the integration detail page — generic. No qualifier on what shape the path takes."
          confidence: STATIC-INFERRED
          evidence: "managementRoutes.ts:46"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Appended verbatim to the URL after `${integrationId}/`. The type is `string` — no narrowing, no URL-encoding, no validation."
          confidence: STATIC-INFERRED
          evidence: "managementRoutes.ts:52-55"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES technically (generic name, generic implementation), but TRANSLATES_LEGITIMATELY worth noting: the name is intentionally untyped because integration sub-routes are dynamic (each integration type may have its own sub-routes). The cost is no compile-time guard against typos."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "managementRoutes.ts:46-56"
        - q: "TRANSLATES_SILENTLY consequences?"
          a: "N/A — no translation, but the lack of a literal-union type means typos produce silently broken URLs (recorded in bugs_limitations_corner_cases as a MEDIUM-severity name-vs-behavior corner-case under integrationsPath)."
          confidence: STATIC-INFERRED
          evidence: "managementRoutes.ts:46-56"
        - q: "Available-but-unused field?"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "managementRoutes.ts:46-56"
      routes_to_finding: ""

  probes_emitted:
    - probe_id: P-162
      question: "Auth-gate audit of the entire Management surface — does a user with no Management-tier permissions reach /management/<every tab except associations>, see the lists populated, but with write buttons hidden?"
      probe_path: "lineage/odd-platform/probes/P-162.yaml"

  stress_summary:
    triggers_total: 9       # 4 name_behavior_pairs + 4 request_inputs + 1 auth_gate
    questions_total: 24     # 4 NBP + 5+5+5+5 inputs (20) + 4 auth_gate questions = 24
    answers_static_inferred: 23
    answers_probe_needed: 1   # the auth_gates audit emitted P-162
    answers_reference: 0
    drift_flags: 1           # useIntegrationRouteParams (DRIFT_NAME_VS_BEHAVIOR — type lie)
```

## security

- **auth_mode_relevance**: `INTERNAL_ONLY` — this is a UI declarative module. It exports plain TypeScript URL-builder functions consumed by React Router on the client side; it carries no auth predicates, no fetch calls, no role/permission checks. The `auth.type` (`DISABLED | LOGIN_FORM | OAUTH2 | LDAP`) enforcement happens server-side at the Spring Security layer of `odd-platform-api`, which gates the back-end endpoints the rendered Management views actually call. The route module itself does not branch on `auth.type`. — evidence: managementRoutes.ts:1-57 (no auth-related imports or branches).

- **ingestion_filter_relevance**: `N/A — UI route declaration, not on the ingestion HTTP surface`. The `auth.ingestion.filter.enabled` flag gates `POST /ingestion/entities` only; no relationship to UI routes.

- **authorization_assertions**: []  # the route module itself enforces no permissions. The downstream rendering consumer (ManagementRoutes.tsx) enforces seven permissions via the per-sub-route WithPermissionsProvider wrappers and OWNER_ASSOCIATION_MANAGE via the RestrictedRoute around Associations.

- **owner_scoping**: `N/A — code is not data-scoped`. The route module emits URL strings; data fetching happens in the per-tab list components downstream.

- **data_exposure**: `"The literal strings '/management', '/management/namespaces', '/management/datasources', '/management/integrations', '/management/collectors', '/management/owners', '/management/tags', '/management/associations/new|history|active', '/management/roles', '/management/policies', '/management/policies/:policyId', '/management/integrations/:integrationId' are emitted into the rendered HTML/JS bundle for every authenticated session and discoverable to anyone who can fetch the SPA bundle → no audience restriction at this layer; under auth.type=DISABLED the bundle is reachable unauthenticated. The URL shapes are non-secret (they parallel the public source on GitHub) so disclosure is not a confidentiality concern, but the URL discoverability is part of why the Category D 'any authenticated user can deep-link to /management/policies/:id and read the policy JSON' finding matters — the URL is right there in the bundle."`

- **known_security_gaps**:
  - "The Management route surface mounted at App.tsx:62 has NO route-level permission guard. Inside Management.tsx, the outer WithPermissionsProvider with allowedPermissions=[OWNER_ASSOCIATION_MANAGE] only provides a permission CONTEXT to descendants (per WithPermissionsProvider.tsx:30-39, 41-48 — it returns children unconditionally). The per-sub-route WithPermissionsProvider wrappers in ManagementRoutes.tsx behave identically. Result: any authenticated user — including a user with empty Management-tier permissions — can navigate to /management, /management/namespaces, /management/datasources, /management/collectors, /management/owners, /management/tags, /management/roles, /management/policies, /management/policies/:policyId, /management/integrations, /management/integrations/:integrationId AND see the lists/details/forms rendered. The lists are fetched via the per-component thunks (e.g. NamespaceList.tsx:46-48 fires fetchNamespaceList unconditionally). The only hidden affordances are the create/update/delete BUTTONS, gated by WithPermissions wrappers inside each list (e.g. NamespaceList.tsx:89-99). The only ROUTE-level gate in the section is around /management/associations/* (ManagementRoutes.tsx:101-110), where RestrictedRoute redirects to ../namespaces if the user lacks OWNER_ASSOCIATION_MANAGE. The 'Management page is admin-only' operator mental model is therefore wrong; the code says 'any authenticated user reads the full Owner/Role/Policy/Namespace/Tag/Collector/DataSource/Integration catalogs; only Associations is admin-only'." — evidence: App.tsx:62 + Management.tsx:9-21 + ManagementRoutes.tsx:29-150 + WithPermissionsProvider.tsx:12-48 + NamespaceList.tsx:46-48 + PolicyList sidecar (lineage/odd-platform/understanding/odd-platform__ts__react-component__component__PolicyList.md) — severity: HIGH
  - "The /management/integrations/* sub-route has NO permission-context wrapping at all (ManagementRoutes.tsx:150). Other sub-areas at least wrap in a context provider (which doesn't block rendering but DOES set the contextual permission set used by inner WithPermissions guards). Without a wrapping provider, any inner `usePermissions().hasAccessTo(...)` call inside the Integrations subtree falls back to the OUTER Management.tsx context whose allowedPermissions = [OWNER_ASSOCIATION_MANAGE]. This means an inner check like `hasAccessTo(Permission.DATA_SOURCE_UPDATE)` on an Integration form deny-by-defaults regardless of the user's global permissions, because OWNER_ASSOCIATION_MANAGE != DATA_SOURCE_UPDATE so the allowedPermissions.includes() check fails (per PermissionProvider.tsx:27-32). Whether any Integration component relies on usePermissions is a follow-up grep; if any does, the gate is BROKEN-OPEN-ish (writes might be silently hidden even for users who should be allowed) or BROKEN-CLOSED depending on which side the bug lands." — evidence: ManagementRoutes.tsx:150 + Management.tsx:9-12 + PermissionProvider.tsx:27-32 + grep `usePermissions|hasAccessTo` across components/Management/Integrations to be added as a P-162 follow-up — severity: MEDIUM
  - "useIntegrationRouteParams (managementRoutes.ts:43-44) performs a type assertion that promises `integrationId: string` to every caller. If the hook is called outside an `:integrationId`-bearing route, `integrationId` is `undefined` at runtime despite the type. The single current caller is in-route and safe, but the assertion is a future-foot-gun." — evidence: managementRoutes.ts:43-44 — severity: LOW

## performance

- **hot_paths**:
  - "`managementPath()` is invoked at component render time by `ToolbarTabs.tsx:62` (global toolbar, rendered on every navigation) and by `ManagementTabs.tsx:22-48` (called 9 times per Management page render). The function body is one truthy check plus one `generatePath()` call — generatePath() is a react-router-dom helper that compiles a template + params object; for parameter-less paths like ours it is essentially a string-template eval. Cost is O(1) per call, no async, no I/O." — evidence: managementRoutes.ts:17-20 + ToolbarTabs.tsx:62 + ManagementTabs.tsx:22-48

- **throughput_characteristics**: `N/A — declarative URL-shape module, not on a request/response or streaming path. No batching, no async, no I/O.`

- **resource_allocation**: `Trivial — nine `as const` literal slots plus three `BASE_PATH` constants and three utility functions; bundle-size cost is ~200 bytes after minification. No memory pooling, no DB connection, no outbound HTTP.` — evidence: managementRoutes.ts:1-57

- **scaling_characteristics**: `Stateless and pure — managementPath, associationsPath, integrationsPath are referentially transparent functions with no closure over mutable state, no module-level mutation, and no side effects. useIntegrationRouteParams reads from the React Router context, which is per-render and per-route — also pure within the React render lifecycle.` — evidence: managementRoutes.ts:17-56

- **known_performance_gaps**: []

## upstream_callers

- entry_point: "ui_route:/management (the AppToolbar 'Management' menu tab)"
  caller_node: "ts react-component:ToolbarTabs.tsx"
  multiplicity_per_trigger: "1 per AppToolbar render (the toolbar is rendered once per session on App mount; the `managementPath()` call at ToolbarTabs.tsx:62 is invoked inside the `tabs` useMemo which re-fires only when its dep `[activityQueryString, t]` changes)"
  evidence: "components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:61-64 (the Management tab item) + 81 (useMemo dep array)"
  observation_class: ui-call

- entry_point: "ui_route:/management (the in-page vertical-tab strip)"
  caller_node: "ts react-component:ManagementTabs.tsx"
  multiplicity_per_trigger: "9 per ManagementTabs render — one managementPath() invocation per sub-area tab, all inside one useMemo at lines 19-50"
  evidence: "components/Management/ManagementTabs/ManagementTabs.tsx:22-48"
  observation_class: ui-call

- entry_point: "ui_route:/management (App.tsx route mount)"
  caller_node: "ts react-component:App.tsx"
  multiplicity_per_trigger: "1 per App render — managementPath() is called inside the JSX expression at App.tsx:62 (`${managementPath()}/*`) and the result is interned as the React-Router path prop. React-Router does not re-evaluate this on every render, but the parent App component does."
  evidence: "components/App.tsx:62"
  observation_class: ui-call

- entry_point: "ui_route:/management/associations/* (the OwnerAssociations sub-tabs)"
  caller_node: "ts react-component:OwnerAssociationsTabs.tsx"
  multiplicity_per_trigger: "unresolved"
  evidence: "grep `associationsPath` confirms the OwnerAssociationsTabs caller; depth of the useMemo not inspected for this sidecar"
  observation_class: ui-call
  unresolved: true

- entry_point: "ui_route:/management/integrations/:integrationId"
  caller_node: "ts react-component:IntegrationHeader.tsx + IntegrationTabs.tsx + IntegrationPreviewItem.tsx + PolicyForm.tsx (cross-section)"
  multiplicity_per_trigger: "unresolved"
  evidence: "grep `integrationsPath` confirms four callers; depth not inspected for this sidecar"
  observation_class: ui-call
  unresolved: true

## downstream_side_effects

(The route module emits no side effects directly — it returns URL strings. The
side effects this module CONTRIBUTES TO are the side effects of the rendered
view trees behind each URL it builds. Each is enumerated in the sub-route
sidecars — see "Cross-references" below. This section records only the
direct effect: the URL string itself, used by React Router or by an `<a href>` tag.)

- side_effect_class: page-render
  description: "Each `<a>` element whose `href` is the output of `managementPath()` / `associationsPath()` / `integrationsPath()` is a navigation affordance in the rendered DOM — clicking it pushes a new history entry and triggers the Management route mount."
  evidence: "managementRoutes.ts:18-20 (managementPath return) + 33 (associationsPath return) + 48-54 (integrationsPath return) + App.tsx:62 (the route mount that the URL navigates to)"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/ (AppToolbar 'Management' tab — visible on every authenticated page)"
    - "ui_route:/management (in-page vertical tabs — 9 of them)"
    - "ui_route:/management/associations (in-page associations sub-tabs — 3 of them)"
    - "ui_route:/management/integrations (in-page integration detail tabs)"

## sources

- understanding ← odd-platform-ui/src/routes/managementRoutes.ts:1-57 + odd-platform-ui/src/components/App.tsx:62 + odd-platform-ui/src/components/Management/Management.tsx:1-25 + odd-platform-ui/src/components/Management/ManagementRoutes/ManagementRoutes.tsx:1-157 + odd-platform-ui/src/components/Management/ManagementTabs/ManagementTabs.tsx:1-68
- concepts.entities.ManagementSubRoute ← managementRoutes.ts:4-14
- concepts.entities.AssociationsSubRoute ← managementRoutes.ts:22-26
- concepts.entities.IntegrationRouteParams ← managementRoutes.ts:39-41
- concepts.operations.[build base/sub URLs] ← managementRoutes.ts:17-56
- concepts.invariants.[BASE_PATH canonical] ← managementRoutes.ts:3,18,19
- concepts.invariants.[type-restricted sub-routes] ← managementRoutes.ts:15,17,28,30-32
- concepts.invariants.[associationsPath requires arg] ← managementRoutes.ts:30-32
- concepts.invariants.[integrationId is interpolated via generatePath] ← managementRoutes.ts:46-56
- concepts.invariants.[useIntegrationRouteParams type-asserts] ← managementRoutes.ts:43-44
- concepts.audiences.[admin-tier per outer provider] ← Management.tsx:9-12
- concepts.audiences.[in-practice any-auth-user — see security] ← App.tsx:62 + Management.tsx:9-12 + ManagementRoutes.tsx:29-150 + WithPermissionsProvider.tsx:12-48
- dependencies_semantic.requires-feature.[parent Management mount] ← App.tsx:62
- dependencies_semantic.requires-feature.[per-sub-route components] ← ManagementRoutes.tsx:8-21
- dependencies_semantic.requires-runtime.[react-router-dom] ← managementRoutes.ts:1
- dependencies_semantic.additional_coupling.[exposed via routes/index] ← routes/index.ts:4
- dependencies_semantic.additional_coupling.[slugs re-hard-coded inside ManagementRoutes.tsx] ← managementRoutes.ts:4-14 + components/Management/ManagementRoutes/ManagementRoutes.tsx:29-151
- tests_coverage_semantic.test_files ← grep `managementPath|associationsPath|integrationsPath` across `*.test.*` / `*.spec.*` in odd-platform-ui returned no matches at commit 4ec2b20
- docs_link_semantic.inferred_docs.[Authorization page] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization (2026-05-26, status 200)
- docs_link_semantic.inferred_docs.[Permissions page] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions (2026-05-26, status 200; lists 68 Permission values and confirms no UI-gating discussion)
- docs_link_semantic.doc_drift_findings.[Management UI undocumented] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform (2026-05-26, status 200; "no mention of a /management URL, Management page, admin page")
- docs_link_semantic.doc_drift_findings.[Mental-model drift on admin-only Management] ← combined evidence: docs imply admin-only (Authorization parent page) + code reveals any-auth read access (ManagementRoutes.tsx + NamespaceList.tsx:46-48)
- implicit_adrs.[BASE_PATH inline] ← grep BASE_PATH across odd-platform-ui/src/routes/*.ts (managementRoutes.ts:3 + 8 sibling modules)
- implicit_adrs.[splat + context-provider pattern] ← App.tsx:62 + Management.tsx:9-21 + ManagementRoutes.tsx:29-150 + WithPermissionsProvider.tsx:12-48 + NamespaceList.tsx:89-99 (the canonical sub-route + write-button gating example)
- implicit_adrs.[Associations is the only route-gated sub-area] ← ManagementRoutes.tsx:101-110 + 151
- implicit_adrs.[PermissionContext fail-closed default] ← components/shared/contexts/Permission/PermissionContext.ts:9-13
- bugs_limitations_corner_cases.[Management is half-gated] ← App.tsx:62 + Management.tsx:9-21 + ManagementRoutes.tsx:29-150 + WithPermissionsProvider.tsx:12-48 + NamespaceList.tsx:46-48
- bugs_limitations_corner_cases.[Integrations has no permission wrap] ← ManagementRoutes.tsx:150 + Management.tsx:9-12 + Integrations.tsx:10-19
- bugs_limitations_corner_cases.[useIntegrationRouteParams type-asserts] ← managementRoutes.ts:43-44
- bugs_limitations_corner_cases.[slugs re-hard-coded] ← managementRoutes.ts:4-14 + components/Management/ManagementRoutes/ManagementRoutes.tsx:29-151
- bugs_limitations_corner_cases.[no tests for routes/] ← grep `managementPath|associationsPath|integrationsPath` across `*.test.*` / `*.spec.*` in odd-platform-ui (no matches)
- stress_findings.name_behavior_pairs.[useIntegrationRouteParams drift] ← managementRoutes.ts:43-44 + react-router-dom v6 useParams docs
- stress_findings.auth_gates.[Management is half-gated] ← App.tsx:62 + Management.tsx:9-21 + ManagementRoutes.tsx:29-150 + WithPermissionsProvider.tsx:12-48 + NamespaceList.tsx:46-48,89-99 + WithPermissions.tsx:23-29 + PermissionProvider.tsx:27-32 + WebFetch docs.opendatadiscovery.org/configuration-and-deployment/enable-security (2026-05-26, status 200)
- stress_findings.probes_emitted.P-162 ← lineage/odd-platform/probes/P-162.yaml
- security.auth_mode_relevance ← managementRoutes.ts:1-57 (no auth branches) + WebFetch docs.opendatadiscovery.org/configuration-and-deployment/enable-security (2026-05-26, status 200)
- security.known_security_gaps.[Management is half-gated] ← App.tsx:62 + Management.tsx:9-21 + ManagementRoutes.tsx:29-150 + WithPermissionsProvider.tsx:12-48
- security.known_security_gaps.[Integrations no permission wrap] ← ManagementRoutes.tsx:150 + Management.tsx:9-12 + PermissionProvider.tsx:27-32
- performance.hot_paths ← managementRoutes.ts:17-20 + ToolbarTabs.tsx:62 + ManagementTabs.tsx:22-48
- upstream_callers.[ToolbarTabs] ← components/shared/elements/AppToolbar/ToolbarTabs/ToolbarTabs.tsx:61-64
- upstream_callers.[ManagementTabs] ← components/Management/ManagementTabs/ManagementTabs.tsx:22-48
- upstream_callers.[App.tsx mount] ← components/App.tsx:62
- upstream_callers.[OwnerAssociationsTabs] ← grep `associationsPath` (file confirmed but depth unresolved)
- upstream_callers.[Integration callers] ← grep `integrationsPath` (4 files confirmed; depth unresolved)

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH
- upstream_callers: MEDIUM  # two upstream-caller groups (associations, integrations) recorded as unresolved-depth references
- downstream_side_effects: HIGH  # the module emits no direct side effects; the downstream rendering trees own their own
- stress_findings: HIGH  # all load-bearing questions resolved STATIC-INFERRED with strong evidence; P-162 is a single PROBE-NEEDED for the central Category D claim

## Maintainer notes

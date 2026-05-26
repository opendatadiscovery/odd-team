# SHB-163 — Every Management sub-area except Associations is reachable by deep-link to any authenticated user

**Category**: clustering
**Severity**: HIGH

## Hypothesis

Operators with zero Management-tier permissions — including a fresh user under DISABLED-mode anonymous access — who navigate to `/management/owners` / `/management/roles` / `/management/policies` / `/management/policies/{id}` / `/management/namespaces` / `/management/datasources` / `/management/collectors` / `/management/tags` / `/management/integrations` see the FULL CATALOG for each surface. The lists fetch and render unconditionally (e.g. `NamespaceList.tsx:46-48` fires `fetchNamespaceList` on mount without permission check). Only the create/edit/delete BUTTONS hide. The SINGLE route-level GUARD in the entire Management section is around `/management/associations/*` (RestrictedRoute with redirect). The operator mental model "Management is admin-only" is incorrect — the code says "any authenticated user reads the full Owner/Role/Policy/Namespace/Tag/Collector/DataSource/Integration catalogs; only Associations is admin-only".

## Evidence

- `odd-platform-ui/src/components/App.tsx:62` — `<Route path={`${managementPath()}/*`} element={<Management />} />` with no route-level guard.
- `odd-platform-ui/src/components/Management/Management.tsx:9-12` — outer `<WithPermissionsProvider allowedPermissions={[OWNER_ASSOCIATION_MANAGE]}>` PROVIDES context but does NOT block rendering.
- `odd-platform-ui/src/components/Management/ManagementRoutes/ManagementRoutes.tsx:29-149` — per-sub-route providers, same context-only behaviour.
- `odd-platform-ui/src/components/Management/ManagementRoutes/ManagementRoutes.tsx:101-110` — RestrictedRoute on `/associations/*` is the ONE working route-gate.
- `odd-platform-ui/src/components/shared/contexts/Permission/WithPermissionsProvider.tsx:12-48` — returns `children` unconditionally in every branch; verified non-blocking by ZH/ZH+ZI systemic finding.

## Notes

- The lists also leak the EXISTENCE of an admin surface (recon information): a non-admin viewing `/management/policies` sees Policy NAMES, can navigate to `/management/policies/{id}` and read the Policy JSON. The user can't CHANGE it (write buttons hidden), but the disclosure is real.
- F-006 (RBAC policy lifecycle) does NOT capture the route-level reachability of policy detail pages by non-admin users.
- `/management/integrations` has NO permission-context wrapping at all — different shape than the other 8 sub-areas; an inner `usePermissions().hasAccessTo` would fall back to the OUTER Management.tsx context (OWNER_ASSOCIATION_MANAGE only), producing surprising deny-by-default for any integration-specific permission check (per managementRoutes sidecar bug #2).
- DOCS DRIFT — `docs.opendatadiscovery.org` does not document the Management UI at all (no /management URL, no screenshot, no per-tab visibility statement). This is a Cornerstone-3 (caveat) gap.
- The pattern is also a fertile ground for new feature work: making the lists per-owner-scoped would be a real feature (P-08 Management hardening).

## Next

1. Probe P-162 (already emitted in managementRoutes sidecar): confirm a user with empty permission set deep-links to `/management/policies` and sees the full list.
2. Decide: change `WithPermissionsProvider` to be a RENDERING gate (not context-only) for the Management sub-routes (would close the leak).
3. DOC-NNN: file "Management UI permission model — what's visible vs admin-only" — major Cornerstone-3 caveat.
4. Promote: this is a foundational governance gap on top of which to graduate F-NNN ("Management section access control" or merge into F-006).

## Links

- cluster_with: [F-006, F-019, F-020, F-026, F-028, F-031, F-034]
- merged_into: (open)
- supersedes: []

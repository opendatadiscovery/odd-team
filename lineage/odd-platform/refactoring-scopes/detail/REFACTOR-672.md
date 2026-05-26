## REFACTOR-672 — `/management/integrations/*` is the LONE sub-route in the Management surface with NO permission-context wrapper at all (`ManagementRoutes.tsx:150`); 8 sibling sub-routes wrap in `<WithPermissionsProvider>` (context-only but seeds the per-sub-area permission set) — Integrations falls back to the OUTER `Management.tsx:9-12` context whose `allowedPermissions=[OWNER_ASSOCIATION_MANAGE]` — any inner `usePermissions().hasAccessTo(INTEGRATION_X)` evaluates against the wrong allowed-set → broken-closed for integration-specific Consumer checks

**Severity**: MEDIUM
**Category**: missing-permission-context / broken-closed-deny-default / inconsistent-with-siblings
**Batch**: ZH (2026-05-26)
**Pillars affected**: [P-08 Management × P-09 Security & Access Control]

**Surfaced by**:
- `management.md:bugs_limitations_corner_cases[1]` (MEDIUM) — "The `/management/integrations` and `/management/integrations/:id` routes have NO `<WithPermissionsProvider>` wrapping at all (ManagementRoutes.tsx:150 — `<Route path='integrations/*' element={<Integrations />} />`). Every other sub-route at least wraps in a context provider. There is no operator-visible difference — the wrappers don't block rendering anyway — but the inconsistency suggests the Integrations sub-area was retro-fitted without the permission-context discipline applied to the eight other sub-areas. If the Integration list/detail components rely on `usePermissions()` for any internal gating, those calls fall back to the OUTER Management.tsx context (which carries `[OWNER_ASSOCIATION_MANAGE]` only), producing surprising deny-by-default for any integration-specific permission check."
- `management.md:security.known_security_gaps[1]` (MEDIUM) — "The /management/integrations/* sub-route has NO permission-context wrapping at all (ManagementRoutes.tsx:150). Other sub-areas at least wrap in a context provider (which doesn't block rendering but DOES set the contextual permission set used by inner WithPermissions guards). Without a wrapping provider, any inner `usePermissions().hasAccessTo(...)` call inside the Integrations subtree falls back to the OUTER Management.tsx context whose allowedPermissions = [OWNER_ASSOCIATION_MANAGE]. This means an inner check like `hasAccessTo(Permission.DATA_SOURCE_UPDATE)` on an Integration form deny-by-defaults regardless of the user's global permissions, because OWNER_ASSOCIATION_MANAGE != DATA_SOURCE_UPDATE so the allowedPermissions.includes() check fails (per PermissionProvider.tsx:27-32). Whether any Integration component relies on usePermissions is a follow-up grep; if any does, the gate is BROKEN-OPEN-ish (writes might be silently hidden even for users who should be allowed) or BROKEN-CLOSED depending on which side the bug lands."

**Statement**: `ManagementRoutes.tsx:29-149` declares 8 sub-routes with the consistent shape:

```tsx
<Route
  path='namespaces/*'
  element={
    <WithPermissionsProvider allowedPermissions={[NAMESPACE_CREATE, NAMESPACE_UPDATE, NAMESPACE_DELETE]}>
      <NamespaceList />
    </WithPermissionsProvider>
  }
/>
```

Same shape for `datasources`, `collectors`, `owners`, `tags`, `roles`, `policies`, `policies/:policyId` — each wraps in a `<WithPermissionsProvider>` carrying the sub-area's relevant permission set.

The lone outlier is at `ManagementRoutes.tsx:150`:

```tsx
<Route path='integrations/*' element={<Integrations />} />
```

Bare. No `<WithPermissionsProvider>` wrapper. The `<Integrations>` element is rendered directly inside the Management subtree where the OUTER `Management.tsx:9-12` Provider has been declared with `allowedPermissions={[OWNER_ASSOCIATION_MANAGE]}`.

**Per ADR-CANDIDATE-229 (NEW this batch)**, the two-tier primitive's semantics:
- `WithPermissionsProvider` SEEDS a context with the listed permissions; the Consumer tier (`WithPermissions` / `usePermissions().hasAccessTo(perm)`) checks whether `perm` is in the seeded allowedPermissions set (per `PermissionProvider.tsx:27-32`: `allowedPermissions.includes(perm)` AND the user has that permission globally).
- A `usePermissions().hasAccessTo(perm)` call where `perm` is NOT in the seeded allowedPermissions returns FALSE regardless of the user's global permissions — because the Provider declared which permissions matter to this subtree, and the consumer is asking about a permission the subtree didn't seed.

So if any component inside `<Integrations>` calls `usePermissions().hasAccessTo(DATA_SOURCE_UPDATE)` (or `INTEGRATION_*` or any non-`OWNER_ASSOCIATION_MANAGE` permission), the call deny-by-defaults — because the only Provider above it is `Management.tsx:9`'s seed of `[OWNER_ASSOCIATION_MANAGE]`. The inner Consumer check never sees `DATA_SOURCE_UPDATE` in the allowedPermissions; the predicate returns FALSE; the affordance is hidden EVEN FOR USERS WHO HOLD DATA_SOURCE_UPDATE GLOBALLY.

This is the BROKEN-CLOSED hazard. The opposite hazard (BROKEN-OPEN — silently allowing what should be denied) does NOT manifest here because the predicate is conservatively false. But the silently-hidden affordance is still a defect: a legitimate user with the right permission cannot see the button.

The sidecar notes this is a follow-up grep — whether any Integration component CURRENTLY relies on `usePermissions()` is unverified at this batch. Two outcomes:
- If NO Integration component uses `usePermissions()` → the inconsistency is COSMETIC (no operator-visible effect today; future-fragile because adding a Consumer-tier check would silently break-closed).
- If ANY Integration component uses `usePermissions()` with a non-OWNER_ASSOCIATION_MANAGE permission → the affordance is silently hidden for legitimate users; observable defect.

The fix is one of three patterns:

**Pattern A (cheapest)**: Add the missing Provider wrapper at `ManagementRoutes.tsx:150` with the integration-specific permission set:
```tsx
<Route
  path='integrations/*'
  element={
    <WithPermissionsProvider allowedPermissions={[DATA_SOURCE_CREATE, DATA_SOURCE_UPDATE, DATA_SOURCE_DELETE]}>
      <Integrations />
    </WithPermissionsProvider>
  }
/>
```
Matches the sibling pattern. Adds the permission seed; broken-closed risk dissolves.

**Pattern B (DRY)**: Add a "Integration-specific permission" composite — `INTEGRATION_MANAGE` — that captures the relevant set; seed once at the Integrations route.

**Pattern C (architectural)**: Address the underlying naming issue per REFACTOR-668 — rename `WithPermissionsProvider` to a name that makes the context-seed semantics obvious, so the absence of a wrapper is unambiguous (vs the current state where the absence either means "deliberately bare" or "retrofit oversight" — the sidecar's framing suggests the latter).

**Evidence**:
- `ManagementRoutes.tsx:29-149` (the 8 wrapped sub-routes)
- `ManagementRoutes.tsx:150` (the lone bare Integration route)
- `Management.tsx:9-12` (outer Provider with `[OWNER_ASSOCIATION_MANAGE]`)
- `PermissionProvider.tsx:27-32` (the predicate: `allowedPermissions.includes(perm)` AND `globalPermissions.includes(perm)`)
- WithPermissionsProvider.tsx:11-49 (the Provider's non-blocking render contract per ADR-CANDIDATE-229)

**Existing-ADR-or-implied-prescription**:
- **ADR-CANDIDATE-229** (NEW this batch) is the architectural commitment THIS scope deviates from for one sub-route.
- **ADR-CANDIDATE-088** (Permissions flow through React Context) is the primitive THIS scope's bare Integration route silently breaks (the seeded permission set is wrong for the subtree).
- The implied prescription: every Consumer-tier `usePermissions()` call must have a matching Provider seed in scope; the convention applies uniformly across the SPA; the Integration sub-route is the documented outlier.

**Proposed remedy**: Apply Pattern A — add the missing `<WithPermissionsProvider>` wrapper with the integration-relevant permission set at `ManagementRoutes.tsx:150`. One-line fix. Add a Vitest test (composes with REFACTOR-289 test-bootstrap sprint) asserting "every Management sub-route has a Provider seed matching the sub-area's permission domain."

The fix also serves as documentation: the Provider's `allowedPermissions` array enumerates which permissions the sub-area's affordances may consult — reading the route declaration tells you which permissions matter to the sub-area.

**Severity rationale**: MEDIUM — broken-closed risk is conditional on whether ANY Integration component uses `usePermissions()` (unverified at this batch). The cosmetic inconsistency itself is LOW; the latent broken-closed risk takes it to MEDIUM. Not HIGH because the symptom (hidden button) is recoverable (operator surfaces the bug; the gate fails closed, not open).

**Suggested backlog grouping**: `UI architecture codification` (composes with ADR-CANDIDATE-229 promotion + REFACTOR-668 Provider naming fix + REFACTOR-289 test-bootstrap).

## ADR-CANDIDATE-088 — Permissions flow through React Context (`WithPermissionsProvider` + `WithPermissions`) seeded with resource-scoped `getResourcePermissions`, NOT via prop-drilling — the project's gating primitive

**Severity**: MEDIUM
**Classification**: promote
**Support count**: 2 sidecars (DataEntityDetails + DataEntityDescription)
**Axes present**: ui_components, ui_permissions
**Pillars affected**: [P-01, P-02, P-04, P-05, P-06, P-07, P-08, P-09] — gating recurs across every feature with mutation affordances

**Surfaced by**:
- `DataEntityDetails.md:implicit_adrs[2]` (|-
    "**Permissions are passed via context, not via props.** The header is wrapped in `WithPermissionsProvider` carrying 3 allowedPermissions + the `resourcePermissions` selector result (lines 82-87). The decision is to use React Context (provider/consumer) rather than prop-drilling permission checks through the header → action buttons chain.")
- `DataEntityDescription.md:concepts.entities + dependencies_semantic.requires-feature` (|-
    "`WithPermissions` context component (`components/shared/contexts/Permission/WithPermissions.tsx:11-32`) — consumes the resource-permission set populated by the parent `WithPermissionsProvider` at `Overview.tsx:67-71`; `usePermissions().hasAccessTo(permissionTo)` gates children rendering")

**Decision statement**: The odd-platform-ui SPA gates per-resource mutation affordances via a two-tier React Context primitive:
- **`WithPermissionsProvider`** — wraps a subtree, declares `allowedPermissions={[...]}` (the permission keys the subtree's children may consult) and `resourcePermissions={...}` (the permission set the backend resolved for the current user against this specific resource id). Seeded at the page-component layer using selectors like `getResourcePermissions(resourceType, resourceId)`.
- **`WithPermissions`** (or `usePermissions().hasAccessTo(...)`) — children declare `permissionTo={Permission.DATA_ENTITY_DESCRIPTION_UPDATE}` (the single permission they're gated by); the gate consults the parent Provider's resolved set.

The pattern explicitly rejects two alternatives:
- **(a) Prop-drilling permission booleans** through the component tree — would require every intermediate node to forward the prop and would couple the gating decision to the tree shape.
- **(b) Selector-per-component pattern** — each leaf calling its own `getResourcePermissions` selector — would re-evaluate the resource-scoped lookup N times per render and decouple gates from the structural tree.

The context pattern centralises the resource-permission resolution at the page-component layer (where the resource id is known) and lets the tree's mutation affordances (edit buttons, delete actions, status changes) declare WHICH permission they need without knowing HOW it's resolved.

**Wisdom test (3-question)**:
1. *Intentional?* YES — the existence of the explicit Provider + consumer primitives, the consistent usage across descriptions and headers, and the rejection of prop-drilling are deliberate.
2. *Structural impact?* YES — the gating pattern is the project's standard primitive for permission-aware UI; refactoring away from it requires touching every gate.
3. *Refactoring or structural?* STRUCTURAL — switching to prop-drilling or per-component selectors is a different architecture.
→ ADR.

**Evidence**:
- DataEntityDetails.md says: "WithPermissionsProvider wrap" (intent_anchor: the wrapper IS the consistent permission-gating primitive across pages)
- DataEntityDescription.md says: "`InternalDescriptionHeader.tsx:40-50` wraps the Edit/Add button in `<WithPermissions permissionTo={Permission.DATA_ENTITY_DESCRIPTION_UPDATE}>`; `InternalDescriptionPreview.tsx:32-40` wraps the empty-state 'Add Description' button identically."
- intent_anchor: the WithPermissionsProvider wrappers are positioned at page-component boundaries (Overview.tsx:67-71), seeded with `getResourcePermissions` selector results

**Existing ADR**: composes with:
- **ADR-CANDIDATE-002** (centralised SECURITY_RULES) — the backend half of authorization; this ADR is the UI half. Together: backend SECURITY_RULES is the enforcement boundary, UI WithPermissions is the discoverability/affordance boundary.
- **ADR-CANDIDATE-003** (read-collaborative GET) — the UI's "Edit gated, content not gated" placement pattern (next ADR — strengthens ADR-CANDIDATE-003 with UI-side primary-source)

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-282 (NEW — Permission-gating placement is fragile: a refactor "simplifying" Description by hoisting `<WithPermissions>` to wrap the entire cluster would silently break legitimate read access for non-editors AND would be undetectable by any test — ZERO UI tests exist)

**Proposed action**: Promote to `adrs/drafts/withpermissions-context-gating-primitive.md`. Document:
- The two-tier primitive (Provider + Consumer/hook).
- The page-component-seeded resourcePermissions pattern.
- The rejection of prop-drilling.
- The explicit Edit-gate-only convention (gate the BUTTON / AFFORDANCE, NOT the content render) — see ADR-CANDIDATE-089 for the partial-gating ADR codification.
- The migration consequence: a future "hide content from non-viewers" feature requires a new permission key + a new gate placement, NOT a Provider hoist.

**Severity rationale**: MEDIUM — pattern-shaping decision; 2-sidecar support, observable to every UI maintainer. Below HIGH because it's a React-side primitive rather than a load-bearing architectural choice.

**Suggested backlog grouping**: `UI architecture codification`.

---

## REFACTOR-687 — ToolbarTabs renders ALL 9 primary navigation tabs unconditionally for every authenticated user (and every anonymous DISABLED-mode user) — no permission gate, no role gate, no feature-flag gate; the Management tab is visible to READ_ONLY users; reveals existence of admin surface to every authenticated user

**Severity**: MEDIUM
**Category**: missing-permission-gate / reconnaissance-information-leak / unconditional-visibility
**Batch**: ZJ (2026-05-26)
**Pillars affected**: [P-09 Security & Access Control, P-08 Management & Administration]

**Surfaced by**:
- `odd-platform__ts__components_shared_elements_AppToolbar_ToolbarTabs__ui-shell-widget__ToolbarTabs.md:bugs_limitations_corner_cases[0]` (HIGH) — "Tab visibility is structurally unconditional — there is no Permission / Role / feature-flag gate on any tab. A READ_ONLY user sees the 'Management' tab the same as an ADMIN user; users from any backend that lacks one of the supporting features (e.g. an instance with no Lookup Tables data) still see 'Master Data' as a top-level affordance. The operator-visible impact: tabs lead to pages that may render empty or 403-redirect, with no upstream signal that the affordance was inapplicable to this user. Note: the downstream `Management/*` routes are individually permission-gated by WithPermissionsProvider, but only the page bodies — not the tab visibility. Cross-ref ZH WithPermissionsProvider non-blocking finding."

- `odd-platform__ts__components_shared_elements_AppToolbar_ToolbarTabs__ui-shell-widget__ToolbarTabs.md:security.known_security_gaps[0]` (MEDIUM) — "Tab visibility is structurally unconditional — READ_ONLY users see the 'Management' tab the same as ADMIN. The downstream Management page is permission-gated per route (cross-ref ZH WithPermissionsProvider non-blocking finding), but the discovery affordance — 'this feature exists' — is leaked to every authenticated user."

- `odd-platform__ts__components_shared_elements_AppToolbar__ui-shell-widget__AppToolbar.md:bugs_limitations_corner_cases[1]` (LOW; correlated finding) — "no <WithPermissionsProvider> wrapper around the Management tab (which routes into /management/* — Owner, Role, Policy, Tag, Lookup-Table, Identity-Provider administration). Per ZH systemic finding, WithPermissionsProvider is non-blocking anyway — but its ABSENCE means there is no policy-driven hiding of the Management tab from non-admin users."

**Statement**: `ToolbarTabs.tsx:34-82` constructs the 9-tab array as a literal — no permission read, no role read, no feature-flag lookup. The 9 tabs are: Catalog / Directory / Data Quality / Data Modelling / Master Data / Management / Dictionary / Alerts / Activity. Every authenticated user sees all 9 regardless of:
- Role / Permission state — a READ_ONLY user sees the 'Management' tab (which routes into admin surfaces) the same as an ADMIN user. The downstream `/management/*` pages may permission-gate individual actions, but the TAB ENTRY POINT is unconditional. For instances with strict separation-of-duties requirements, this leaks the EXISTENCE of management capabilities to non-management users.
- Feature-flag state — Data Modelling (Query Examples) is a `Feature.DATA_COLLABORATION`-gated sub-feature on its destination pages (`Message.tsx:59`, `MainThreadMessage.tsx:36`, `DataEntityDetailsHeader.tsx:132` all use `<WithFeature>`), but the tab entrypoint at `ToolbarTabs.tsx:50-54` is NOT wrapped. Under default deployment (`datacollaboration.enabled=false`, the bundled default), clicking Data Modelling navigates to `/data-modelling/query-examples` but the user sees an empty / non-functional surface.

The Active Features endpoint (`/api/features/active`) IS fetched at boot (`App.tsx:49`), but ToolbarTabs does NOT consume `getActiveFeatures` — the data is dispatched and forgotten by this widget. Same for permission selectors (`usePermissions`, `getGlobalPermissions`) — Grep returns 0 matches inside the AppToolbar subtree.

**Operator-visible impact**:
1. A READ_ONLY auditor opens the platform and sees the Management tab. Clicks → /management — backend gates the admin actions but the user can browse the chrome (Owner / Role / Policy / Tag / Lookup-Table / Identity-Provider areas all appear). Information leak: the existence + naming of the admin surface is revealed.
2. A user on an instance with `datacollaboration.enabled=false` clicks Data Modelling → lands on a Query Examples page that renders empty (no error, no "feature disabled" indicator). UX dead-end.
3. Under `auth.type=DISABLED` (the bundled default), an anonymous network caller hitting the SPA root sees all 9 tabs. Compose with REFACTOR-688 NEW this batch (the 'admin' literal display).

**Evidence**:
- ToolbarTabs.tsx:34-82 (literal 9-element array; no permission/role/feature read)
- ToolbarTabs.tsx:60-64 (Management tab entry; no WithPermissionsProvider wrap)
- ToolbarTabs.tsx:50-54 (Data Modelling tab entry; no WithFeature wrap)
- App.tsx:49 (`fetchActiveFeatures` dispatched but ToolbarTabs doesn't consume the result)
- App.tsx:56 (AppToolbar mounted unconditionally)
- Grep `usePermissions|getGlobalPermissions|hasGlobalPermission|WithFeature|WithPermissionsProvider` inside the AppToolbar subtree returns 0 matches.

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-235 NEW this batch codifies the hard-coded 9-tab taxonomy as a deliberate decision; this scope is the SECURITY/PERMISSION CONSEQUENCE of that decision. The ADR establishes that the tab list is structurally unconditional; the refactor scope is the resulting reconnaissance-information surface. Either remedy direction is valid: (a) ADD gating (in which case ADR-235 needs supersedence — the 9-tab list becomes conditional), or (b) ACCEPT the unconditional-visibility as the architectural choice and ensure all destination pages handle the no-permission case gracefully (consistent empty-state, no UX dead-ends).

**Proposed remedy**: Maintainer triage between two options:

**Option A — Permission-gate the Management tab specifically**:
```tsx
const tabs = useMemo<AppTabItem[]>(() => [
  { name: t('Catalog'), link: searchPath() },
  // ... other tabs ...
  ...(hasManagementPermission ? [{ name: t('Management'), link: managementPath(), value: 'management' }] : []),
  // ... rest ...
], [...]);
```
The Management tab is the highest-leverage candidate for gating (it's the only tab that has a credible "should be hidden from non-admin users" argument). The other 8 tabs lead to read-mostly surfaces where hiding adds little value.

**Option B — Accept unconditional visibility; harden the destination pages**:
- Ensure `/management/*` pages render a polite "You don't have access" surface for non-admin users (currently they render the same UI but actions 403; harden the empty-state).
- Ensure `/data-modelling/query-examples` renders a "Data Modelling is not enabled for this instance" surface when `datacollaboration.enabled=false`.
- Treat the existence of the surface as public information (it is — the docs enumerate all 9 pillars publicly).

Option A is cheaper (one tab change); Option B is broader but matches the documented public-pillar-list reality. For an OSS project where the pillar list IS the public surface, Option B is arguably the correct stance — but the Management tab specifically is the one tab where the discovery-affordance leaks something non-public (Owner / Role / Policy admin URLs).

**Severity rationale**: MEDIUM — reconnaissance-information leak bounded by the fact that the docs already enumerate the pillars publicly. The Management tab is the only tab where the leak is non-trivial (admin sub-surfaces become discoverable). Not HIGH because there is no data exposure / no permission bypass at the API layer (backend gates the actions). Not LOW because operators reading the docs on separation-of-duties may reasonably expect tab visibility to follow permission scope.

**Suggested backlog grouping**: `Authorization audit batch` — couple with REFACTOR-671 (Management surface half-gated at route layer), REFACTOR-089 (Partial UI permission gating ADR conformance check).

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-671 (Management half-gated at route layer; this REFACTOR-687 is the tab-row layer of the same issue); ADR-CANDIDATE-089 (Partial UI permission gating: mutation affordances gated, content not — the operator-facing reasoning is similar); ADR-CANDIDATE-235 NEW (the architectural anchor that this refactor's remedy may or may not supersede).
- SUPERSEDES: none.
- CONFLICTS: none.

---

## ADR-CANDIDATE-247 — Tab visibility on My-and-Dependents-shaped surfaces is DERIVED FROM OWNER ASSOCIATION at the UI layer (`getOwnership` selector); tabs are HIDDEN (not disabled, not greyed) when the signed-in user has no owner mapping. The decision is "no owner = no 'My' surface" — a UI-visible affordance hides itself rather than render-empty

**Severity**: MEDIUM
**Classification**: promote
**Pillars affected**: [P-05 Alerts, P-04 Activity (analogous My-Objects-tab behaviour), P-01 Data Discovery (Catalog My-Objects tab)] — every multi-tab feature with "My" / "Dependents" semantics
**Batch minted**: ZL (2026-05-26)

**Support count**: 1 sidecar primary-source (Alerts.tsx batch ZL); the pattern's logical reach extends to Activity's "My Objects" / Catalog's "My Objects" — both rely on owner-association to scope results, but only Alerts surfaces the explicit TAB-HIDING affordance via `showMyAndDepends`.

**Surfaced by**:
- `odd-platform__ts__react-component__component__Alerts.md:implicit_adrs[0]` (HIGH) — "Tab visibility is derived from owner association at the UI layer, not at the API endpoint." — evidence: AlertsTabs.tsx:30-37 (hidden flag bound to `showMyAndDepends`) — intent_anchor: "`hidden: !showMyAndDepends`" (the conditional UI signal is the decision) — confidence: HIGH
- `odd-platform__ts__react-component__component__Alerts.md:concepts.invariants[0]` (HIGH) — "Tabs `My Objects` and `Dependents` are hidden when the signed-in user has no owner association (`getOwnership` returns falsy → `showMyAndDepends=false`)."
- `odd-platform__ts__react-component__component__Alerts.md:dependencies_semantic.requires-feature[1]` (HIGH) — "F-008 Authorization / User-Owner Association — `getOwnership` selector derives tab visibility from the current user's `profile.owner` association (populated by `fetchIdentity`, dispatched at `App.tsx:48`)."

**Decision statement**: Multi-tab features whose tabs include "My" / "Dependents" / "My-Objects" semantics use the **UI-layer owner-association check** to HIDE those tabs when the signed-in user has no owner mapping. The architecture has three observable structural commitments:

1. **Selector-derived visibility** — `getOwnership` selector (Redux) reads `state.profile.owner` (populated by `fetchIdentity` at App.tsx:48 — the early-app-mount identity load). When this returns falsy, the page-root component computes `showMyAndDepends = false` and propagates the flag down to `AlertsTabs.tsx:30-37`.

2. **Tabs are HIDDEN, not disabled** — the AppTabs primitive accepts a `hidden: boolean` prop per tab entry; when true, the tab is REMOVED from the rendered nav, not greyed-out. The operator sees a 1-tab nav (All only) rather than a 3-tab nav with two greyed-out entries. This is a UI affordance choice: hiding signals "this surface doesn't apply to you", whereas greying would signal "this surface exists but you can't reach it".

3. **No backend gating** — the API endpoints behind "My Objects" / "Dependents" (`GET /api/alerts/my`, `GET /api/alerts/dependents`) have NO @PreAuthorize check; an unmapped user CAN call them — they just return empty (since the WHERE clause filters by current-owner-id which is null/empty). The UI's tab-hiding is the ONLY enforcement of the "no owner = no 'My' surface" contract; a sophisticated caller with API access bypasses the hide.

The intent: keep the "My" affordances OUT OF SIGHT for users who can't meaningfully use them. Showing 'My Objects' to a user without an owner mapping would surface an empty tab — a confusing "is this broken?" UX. Hiding gives a clean affordance — the user sees only the surfaces relevant to them. The trade-off: an admin or unmapped user CAN reach the "My" data via direct API call; the UI is the only enforcement.

The decision is operator-facing — the "hide" choice (vs "disable" or "show-empty") is a deliberate UX framing. The decision is also security-adjacent: the backend's lack of @PreAuthorize means this is enforcement-by-UI-hide, not enforcement-by-security-rule. The architecture explicitly accepts this trade-off; the "My" tabs are an operator-convenience affordance, NOT a security boundary.

**Wisdom test (3-question)**:
1. *Intentional?* YES — the `showMyAndDepends` flag is EXPLICITLY computed at the page-root (Alerts.tsx) and propagated down to the tabs component. The `hidden: !showMyAndDepends` prop on each tab is the literal statement. The pattern relies on the `getOwnership` selector, which exists specifically to support this surfaced-vs-hidden decision. The convention is structural, not local.
2. *Structural impact?* YES — defines the operator-visible navigation shape ("My" / "Dependents" tabs appear or disappear based on identity); defines the UX contract (hide-when-irrelevant rather than show-empty); defines the relationship between backend authz (none) and frontend authz (UI hide).
3. *Refactoring or structural?* STRUCTURAL — switching from hide-on-no-owner to show-empty-tab or disabled-tab is a UX change that affects every user without an owner mapping; switching to backend-enforcement (adding @PreAuthorize) is a security architecture change. Both alternatives are structural commitments different from the current.
→ ADR.

**Evidence**:
- `Alerts.tsx:6` (`getOwnership` selector import) + Alerts.tsx scope (`showMyAndDepends` computed at page-root)
- `AlertsTabs.tsx:30-37` — `hidden: !showMyAndDepends` propagated per tab entry
- `App.tsx:48` — `fetchIdentity` dispatched at app mount; populates `profile.owner` for the selector
- contrast: backend `AlertController.java:17-58` has NO @PreAuthorize on getAssociatedUserAlerts / getDependentEntitiesAlerts — the backend serves the data to anyone authenticated; the UI hide is the only gate.
- intent_anchor: the explicit selector `getOwnership` + the explicit prop `hidden: !showMyAndDepends` — both naming the owner-association-derived visibility. The decision is observable at the component-prop level.

**Existing ADRs / composition**:
- COMPOSES WITH **ADR-CANDIDATE-096** (Owner-association as UI rendering gate for home-page Recommended panel — NOT a security boundary; the backend endpoint has NO `identity && ownership` precondition) — the Alerts tabs apply the SAME pattern to a different feature; the cross-feature consistency makes the "UI-hide, not security gate" stance an architectural commitment.
- COMPOSES WITH **ADR-CANDIDATE-003** (Read-collaborative posture — GETs are uniformly authenticated-only with no role/owner gate) — the Alerts My/Dependents endpoints follow the read-collaborative posture (anyone can call them) and rely on UI-level affordance choices to scope user experience.
- CONTRASTS WITH **ADR-CANDIDATE-088** (Permission framework — `WithPermissions` wraps mutation buttons) — owner-association-hiding is a DIFFERENT axis from permission-gating; the former hides read-shaped tabs based on identity, the latter hides write-shaped buttons based on RBAC.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-NNN (LOW — backend bypass): an unmapped user can still call `/api/alerts/my` directly; the UI hide is not a security boundary. If the architecture wanted enforcement, the backend would need owner-required gating. Currently it's a UX convention.
- REFACTOR-224 (existing) — `getMyObjects` returns silent empty Flux for unlinked users — the analogous "no owner = empty result" trap on the Activity / Catalog "My Objects" tab. The Alerts pillar avoids this trap via the UI hide; the trap remains on Activity / Catalog where the tab is NOT conditionally hidden.

**Proposed action**: Promote to `adrs/drafts/owner-association-derived-tab-visibility.md`. Document:
- The `getOwnership` selector + `showMyAndDepends` flag pattern.
- The hide-vs-disable-vs-show-empty UX choice and the rationale.
- The backend-vs-frontend authz asymmetry (no @PreAuthorize on /my; UI hide as only enforcement).
- The convention's reach (currently Alerts; could/should extend to Activity My-Objects, Catalog My-Objects).
- The maintenance obligation: every new "My" / "Dependents" tab follows the owner-association-hide pattern OR documents the deviation (e.g., a generic-action tab that should remain visible regardless).
- The security note: this is a UX convention, NOT a security gate; backend endpoints serving these tabs MUST be backend-authorized if data-sensitivity warrants it.

**Severity rationale**: MEDIUM — pattern-shaping decision for multi-tab features with identity-derived sub-views; primary source is Alerts but the design decision is observable across Catalog and Activity My-Objects surfaces; cross-pillar reach. Below HIGH because the convention is a UX choice, not a load-bearing security/architecture decision; the backend has no enforcement of this stance.

**Suggested backlog grouping**: `UI architecture codification` — pair with ADR-CANDIDATE-096 (owner-association as UI-rendering-gate) and ADR-CANDIDATE-088 (permission framework) which together define the identity-vs-permission UI gating model.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-096 (Owner-association as UI rendering gate, NOT security boundary); ADR-CANDIDATE-003 (read-collaborative posture); ADR-CANDIDATE-088 (permission framework — distinct axis but same UI-gate-vs-backend-gate philosophy).
- SUPERSEDES: none.
- CONFLICTS: none.
- BACK-LINKS: Alerts.tsx sidecar receives `related_implicit_adrs: [ADR-CANDIDATE-247]` in next refresh.

---

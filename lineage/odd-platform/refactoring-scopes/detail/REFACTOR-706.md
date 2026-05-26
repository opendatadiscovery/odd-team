## REFACTOR-706 — Alerts Resolve/Reopen button is RENDERED UNCONDITIONALLY for every alert; the `DATA_ENTITY_ALERT_RESOLVE` permission check fires AFTER the user clicks. UX leak: the action's existence is visible to users who cannot perform it; they only learn they have no access by trying

**Severity**: MEDIUM
**Category**: late-permission-check / UX-leak / action-existence-disclosure
**Batch**: ZL (2026-05-26)
**Pillars affected**: [P-05 Alerts]

**Surfaced by**:
- `odd-platform__ts__react-component__component__Alerts.md:bugs_limitations_corner_cases[1]` (MEDIUM) — "Resolve / Reopen button is rendered for every alert without first checking permission — the permission probe (fetchResourcePermissions) only fires AFTER click (AlertItem.tsx:48-70). UX leak: the action is visible to users who cannot perform it; users only learn they have no access by trying." — evidence: AlertItem.tsx:159-166 (Button text='Resolve'/'Reopen' rendered unconditionally) + AlertItem.tsx:55-67 (permission check on click) — severity: MEDIUM
- `odd-platform__ts__react-component__component__Alerts.md:security.known_security_gaps[0]` (MEDIUM) — "Resolve / Reopen button is shown to users WITHOUT DATA_ENTITY_ALERT_RESOLVE; the permission check fires only on click. A privacy-conscious operator might infer from the visible button that resolution is available to them, attempt it, and only then learn they have no access. Lower-bound: UX leak. Upper-bound: signal-leak (the button's existence confirms the alert is OPEN and resolvable, distinct from RESOLVED state where the button text changes to 'Reopen')."
- `odd-platform__ts__react-component__component__Alerts.md:tests_coverage_semantic.uncovered_behaviours[4]` (HIGH) — "Resolve button on an Alert dispatches updateAlertStatus only after DATA_ENTITY_ALERT_RESOLVE permission resolves; shows `No access!` caveat when it does not. ... Authorization is enforced AFTER click — caller observes the button, clicks it, and only then sees access denied. Operator-visible UX leak: existence of the resolve action is visible to a viewer who cannot perform it."

**Statement**: The Alerts page (`/alerts/*`) renders a "Resolve" or "Reopen" button on EVERY alert row, regardless of whether the current user has the `DATA_ENTITY_ALERT_RESOLVE` permission for that alert's data entity. The button text is unconditionally rendered at `AlertItem.tsx:159-166`. The permission check fires on CLICK — `AlertItem.tsx:48-70` dispatches `fetchResourcePermissions` after the user clicks the button, then checks `globalPermissions || resourcePermissions ∋ DATA_ENTITY_ALERT_RESOLVE`. If absent, the user sees a "No access!" caption.

This deviates from the partial UI permission gating pattern (ADR-CANDIDATE-089) used elsewhere on the platform, which wraps mutation buttons in `<WithPermissions permissionTo={...}>` so the button is HIDDEN (not rendered) when the user lacks the permission. The Alerts surface uniquely chose late-binding for two reasons:

1. **Per-resource permission**: `DATA_ENTITY_ALERT_RESOLVE` is a RESOURCE permission, not a global one — it can be granted per data-entity via role bindings. Determining whether the current user has the permission requires a per-row fetch (`fetchResourcePermissions` keyed by the alert's data-entity oddrn).

2. **Cost of pre-checking**: pre-fetching permissions for every row in the infinite-scroll list would be N round-trips per page (30 per page) — expensive on initial mount. The chosen design defers the cost to the click.

**Operator-visible impact**:
- A viewer-only user (READ_ONLY role on the data entity) sees the Resolve button next to every OPEN alert; they click → see "No access!" caption. They learn there's an action they cannot perform.
- A privacy-conscious operator can INFER from the button's PRESENCE that the alert is OPEN (not RESOLVED) — distinct from RESOLVED state where the button text changes to "Reopen". The button's existence + text is a signal-leak about alert state.
- The "No access!" caption only confirms what was previously inferred; it doesn't add information.

**Evidence**:
- `AlertItem.tsx:159-166` — `Button text='Resolve' | 'Reopen'` rendered unconditionally based on alert status, not permission
- `AlertItem.tsx:48-70` — `handleClickResolve` dispatches `fetchResourcePermissions` then checks the permission set
- `AlertItem.tsx:55-67` — the `globalPermissions ∋ DATA_ENTITY_ALERT_RESOLVE OR resourcePermissions ∋ DATA_ENTITY_ALERT_RESOLVE` predicate
- contrast: `LookupTables.tsx:72-82` — `<WithPermissions permissionTo={Permission.LOOKUP_TABLE_CREATE}>` wraps the +Add new button (the canonical pattern that hides instead of late-checks)
- intent_anchor: the absence of `<WithPermissions>` wrap on `AlertItem.tsx:159-166` is the structural deviation

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-089 (Partial UI permission gating — `<WithPermissions>` wraps mutation affordances). The Alerts Resolve button is a deviation from this convention; the deviation is presumably for cost reasons (per-row permission pre-check). The architectural fix decisions are:

- Bulk-fetch resource permissions for all loaded alert rows at list-load time (one fetch per page) and use the result to gate buttons via `<WithPermissions>`.
- OR fetch ON HOVER (pre-check before the user clicks; show button only if permitted).
- OR keep the late-binding but pre-disable the button (greyed) with a tooltip explaining the permission required.

**Proposed remedy**: Two options, in increasing scope:

1. **LOWEST cost — pre-disable + tooltip**:
   - Render the button always but with `disabled` state if the user lacks `DATA_ENTITY_ALERT_RESOLVE` (computed at row-render time)
   - Add a tooltip: "Requires DATA_ENTITY_ALERT_RESOLVE permission"
   - Avoids the "click → see No access" surprise; preserves the action-discoverability for users who have the permission
   - Effort: small; reuses existing permission machinery

2. **MEDIUM cost — bulk-fetch + WithPermissions wrap**:
   - On list load, bulk-fetch resource permissions for all 30 alert rows' data-entities (one POST `/api/permissions/bulk` request)
   - Build a per-row `Map<dataEntityId, Permission[]>` in Redux
   - Wrap the Resolve button in `<WithPermissions permissionTo={DATA_ENTITY_ALERT_RESOLVE} resourceId={alert.dataEntity.id}>`
   - The button is HIDDEN for users without permission
   - Effort: medium; requires backend bulk endpoint OR multi-fetch + caching at the UI

**Recommended**: Option 1 for short-term. Option 2 if a bulk-permission endpoint is feasible (would benefit other parts of the platform that have similar late-binding patterns).

**Severity rationale**: MEDIUM — the leak is observability of action existence + late-binding surprise, not a true privilege boundary breach (the user genuinely cannot resolve; the backend changeAlertStatus has no @PreAuthorize per REFACTOR-025 but the resource-permission check at the UI is the only enforcement). Severity is bounded by:
- The visible "Resolve" / "Reopen" text only conveys alert status (OPEN vs RESOLVED), which is ALSO visible from the alert row layout.
- A viewer-only user already sees the entire alert payload (cross-owner read-collaborative posture per ADR-CANDIDATE-003); the button's presence adds no additional sensitive information.

**Suggested backlog grouping**: `UX-NNN Alerts clarity sprint` — pair with REFACTOR-705 (All-tab status drift), REFACTOR-707 (tab badge stale-totals), REFACTOR-709 (no request cancellation on tab-switch). Also pair with REFACTOR-025 (the backend changeAlertStatus has no @PreAuthorize — the UI gate is the only enforcement; closing both UI and backend is one full-fix).

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-089 (Partial UI permission gating — this scope documents a DEVIATION from the convention); REFACTOR-025 (changeAlertStatus backend no @PreAuthorize — the UI's late-check is the only gate; both should be fixed in parallel).
- SUPERSEDES: none.
- CONFLICTS: none.

---

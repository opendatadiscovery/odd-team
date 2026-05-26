## REFACTOR-710 — Frontend route `/alerts/*` has NO WithPermissionsProvider wrapper (unlike LookupTables); any authenticated user (or anonymous user under DISABLED) can reach `/alerts/all` and trigger getAllAlerts to enumerate the platform's full alert population including actor identity, data-entity names, and free-text alertChunkList descriptions

**Severity**: HIGH (under DISABLED auth mode) / LOW (under LOGIN_FORM | OAUTH2 | LDAP)
**Category**: missing-route-guard / DISABLED-anonymous-reach
**Batch**: ZL (2026-05-26)
**Pillars affected**: [P-05 Alerts, P-09 Authorization]

**Surfaced by**:
- `odd-platform__ts__react-component__component__Alerts.md:bugs_limitations_corner_cases[3]` (LOW) — "Frontend route /alerts/* has NO WithPermissionsProvider wrapper (unlike LookupTables route at App.tsx:75-87). Any authenticated user can reach /alerts/all and trigger getAllAlerts; access enforcement lives entirely in Spring Security backend config (none visible on the controller — see batch H AlertController sidecar) plus the per-action DATA_ENTITY_ALERT_RESOLVE check at click time. There is no UI route guard." — evidence: App.tsx:64 (no wrapper) vs App.tsx:75-87 (wrapper used for LookupTables) — severity: LOW
- `odd-platform__ts__react-component__component__Alerts.md:security.known_security_gaps[1]` (HIGH) — "All tab on DISABLED auth mode reaches the alert list without any frontend or backend (per batch H controller) gate. In an internet-facing accidental DISABLED deployment, an anonymous caller can enumerate all OPEN alerts across the platform — including data-entity names, owner-association usernames, and full alertChunkList descriptions which may contain free-text diagnostic info." — evidence: App.tsx:64 (no wrapper) + AlertController.java:1-58 (no @PreAuthorize) — severity: HIGH (in DISABLED mode), LOW (in LOGIN/OAUTH/LDAP since session-required there)
- `odd-platform__ts__react-component__component__Alerts.md:security.data_exposure` (HIGH) — "Alert payload {id, lastCreatedAt, type, status, statusUpdatedAt, statusUpdatedBy{owner.name | identity.username}, alertChunkList, dataEntity{id, externalName, internalName, entityClasses}} → any authenticated user via the All tab. No owner-scoping at the UI; backend All endpoint also has no owner filter (batch H sidecar). statusUpdatedBy.identity.username is rendered verbatim (AlertItem.tsx:86) — OIDC/LDAP username PII leaks to any user who can reach the global Alerts page."

**Statement**: The `/alerts/*` route mount at `App.tsx:64` is BARE — there is no `<WithPermissionsProvider>` wrapper, no permission-gated `<RestrictedRoute>`, no per-mode `<Outlet>` guard. Contrast `App.tsx:75-87` where `/master-data/lookup-tables` is wrapped in `<WithPermissionsProvider allowedPermissions={[CREATE, UPDATE, DELETE]}>`. The Alerts route mount is the SIMPLEST possible bare mount.

The asymmetry doesn't directly grant access (per ADR-CANDIDATE-229, `WithPermissionsProvider` is CONTEXT-SEED ONLY and doesn't block rendering anyway) — but it means there is no SIGNAL at the route layer of which permissions are relevant for this surface. Combined with the backend's absence of `@PreAuthorize` on the controller (per `AlertController.java:17-58` — verified by batch H sidecar), the operator-facing posture is:

- **LOGIN_FORM | OAUTH2 | LDAP**: any authenticated user reaches `/alerts/*`; the platform-wide alert population is enumerable (read-collaborative posture per ADR-CANDIDATE-003).
- **DISABLED**: no authentication required; ANY network caller reaches `/alerts/*`; the alert population is anonymously enumerable.

The exposed payload includes (per security.data_exposure):
- Alert metadata: `id`, `lastCreatedAt`, `type`, `status`
- Actor identity: `statusUpdatedBy.identity.username` (OIDC username) and `statusUpdatedBy.owner.name`
- Affected entity: `dataEntity.{id, externalName, internalName, entityClasses}` — full entity identification + naming
- Free-text alert description: `alertChunkList` — diagnostic content that may include query text, error messages, stack traces

In a DISABLED deployment accidentally exposed to the internet:
- Anyone reaching the HTTP port can browse `/alerts/all`
- They see actor usernames (PII)
- They see entity names (potentially organizational structure: `finance/customers_pii`, `marketing/user_clickstream`, `compliance/audit_logs`)
- They see free-text alert content (diagnostic info that may reveal infrastructure topology, SQL fragments, error messages with stack traces)

**Operator-visible impact**:
- LOGIN_FORM / OAUTH2 / LDAP: read-collaborative posture per ADR-CANDIDATE-003 — any authenticated user sees the platform-wide alert inbox. This is the deliberate design.
- DISABLED + internet-exposed: full anonymous enumeration of the alert population. Multiple PII / org-structure / infrastructure-topology leaks compounded.

**Evidence**:
- `App.tsx:64` — `<Route path={alertsPath('*')} element={<Alerts />}>` (bare mount, no wrapper)
- `App.tsx:75-87` — contrast: LookupTables mounted with `<WithPermissionsProvider allowedPermissions={...}>` wrapper
- `AlertController.java:17-58` — no @PreAuthorize on getAllAlerts / getAssociatedUserAlerts / getDependentEntitiesAlerts / changeAlertStatus
- `SecurityConstants.java` — no SECURITY_RULES entries for `/api/alerts/*` (per batch H sidecar)
- `AuthorizationCustomizer.java:29-30` — DISABLED mode bypasses authentication entirely (per REFACTOR-068)
- `AlertItem.tsx:86` — `statusUpdatedBy?.identity?.username` rendered verbatim

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-003 (read-collaborative posture — GETs are authenticated-only with no role/owner gate) is the architectural anchor. The Alerts /alerts/* read endpoints follow this posture. The DISABLED-mode bypass is the same class as REFACTOR-068 (DISABLED-mode allows /api/appInfo anonymous reach) and REFACTOR-096 (DISABLED-mode allows /actuator/* anonymous reach).

The architectural choice (read-collaborative posture under LOGIN_FORM/OAUTH2/LDAP) is deliberate. The fix scope is:
- Document the read-collaborative posture's reach to alerts (live docs currently silent — REFACTOR-NNN doc-gap)
- Add backend SECURITY_RULES entries to gate `/api/alerts/*` if the deployment wants per-feature access control
- Add DISABLED-mode warnings at startup (compound with REFACTOR-068, REFACTOR-096)

**Proposed remedy**: Three options, in increasing scope:

1. **LOWEST cost — documentation**:
   - Update the live docs to explicitly state "The /alerts global view is visible to every authenticated user; in DISABLED auth mode, it's visible to all network callers"
   - Add a runtime warning at app startup when `auth.type=DISABLED` is detected
   - Effort: small; doc + 1-line console.warn

2. **MEDIUM cost — backend gating**:
   - Add SECURITY_RULES entries for `/api/alerts/*` keyed on a `ALERT_VIEW` permission
   - Add the permission to default roles
   - UI: optional `<WithPermissionsProvider allowedPermissions={[ALERT_VIEW]}>` wrap at App.tsx:64
   - Trade-off: changes the read-collaborative posture for alerts; breaks compat for clients
   - Effort: medium; requires permission addition + role-binding migration

3. **HIGHEST cost — owner-scoped alerts**:
   - Change global /alerts/all to filter by current user's owner-association
   - Effectively merge "All" and "My Objects" tabs into one
   - Trade-off: removes a feature (cross-team alert visibility for admins); contradicts read-collaborative posture
   - Effort: high; UI + API + service-layer changes

**Recommended**: Option 1 for short-term (documentation + startup warning). Option 2 if deployment isolation matters. Option 3 only if the read-collaborative posture is being abandoned platform-wide.

**Severity rationale**:
- HIGH for DISABLED-mode internet-exposed deployments (anonymous enumeration of alert population with PII + org-structure leaks)
- LOW for LOGIN_FORM/OAUTH2/LDAP deployments (deliberate read-collaborative posture)

The HIGH severity is operator-actionable: avoid DISABLED in internet-facing deployments. The LOW severity for protected modes is a documented architectural choice, not a defect.

**Suggested backlog grouping**: `Authorization audit batch` — pair with REFACTOR-068, REFACTOR-096 (DISABLED-mode reach surfaces), REFACTOR-025 (changeAlertStatus no-auth), REFACTOR-024 family (cross-owner data exposure). Together they form the comprehensive DISABLED-mode + read-collaborative review.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-003 (read-collaborative posture — Alerts follows this convention); REFACTOR-068 (DISABLED-mode appInfo reach); REFACTOR-096 (DISABLED-mode actuator reach); REFACTOR-024 family (cross-owner data exposure); REFACTOR-025 (changeAlertStatus no @PreAuthorize — the mutation companion to this read scope); ADR-CANDIDATE-229 (WithPermissionsProvider context-seed — explains WHY adding a Provider wrap wouldn't actually gate the route anyway).
- SUPERSEDES: none.
- CONFLICTS: none.

---

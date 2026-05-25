## REFACTOR-607 — `GET /api/identity/whoami` is the canonical auth-mode probe surface — anonymous response shape discriminates DISABLED/LOGIN_FORM/OAUTH2/LDAP; not documented as such

**Severity**: MEDIUM
**Category**: enumeration-vector / undocumented-probe-surface
**Batch**: ZD (2026-05-25)
**Pillars affected**: [P-09 Security & Access Control (the auth-mode-introspection surface — operator-facing as well as attacker-facing)]

**Surfaced by**:
- `odd-platform__java__IdentityController__controller-class__IdentityController.md:docs_link_semantic.doc_drift_findings.[3]` (MEDIUM) — "The whoami endpoint is the auth-mode probe surface — undocumented as such. The endpoint's documented purpose ('Get authed user identity', openapi.yaml:118) does not surface that an anonymous probe of this URL is the canonical way to identify which auth mode the platform is running in: 200 with username='admin'+all-permissions → DISABLED; 302 to /login → LOGIN_FORM; 302 to /oauth2/authorization/... → OAUTH2; 401 → LDAP. An attacker can determine the platform's auth posture with a single anonymous request to a documented endpoint."
- `odd-platform__java__IdentityController__controller-class__IdentityController.md:security.data_exposure.[1]` ("Implicit auth-mode signal: an anonymous GET to /api/identity/whoami returns DIFFERENT response shapes per auth mode")

**Statement**: An anonymous GET to `/api/identity/whoami` returns a different response shape per `auth.type`:
- DISABLED → 200 OK with `identity.username='admin'` + all 70+ permissions (the dummyOwner fallback)
- LOGIN_FORM → 302 redirect to `/login`
- OAUTH2 → 302 redirect to `/oauth2/authorization/{provider}`
- LDAP → 401 Unauthorized

An attacker (or curious external reviewer) can determine the platform's exact auth posture with a single anonymous request to a documented endpoint. Combined with REFACTOR-068 (AppInfoController under DISABLED also discloses the auth mode + project version anonymously), the platform exposes two parallel auth-mode probe surfaces. Neither is documented as such; operators auditing their deployment cannot find this in the live docs.

**Evidence**:
- `IdentityController.java:23-28` (the whoami body)
- `DisabledAuthSecurityConfiguration.java:11-19` (the empty-SecurityContext condition for DISABLED → 200)
- `LoginFormSecurityConfiguration.java:50-57` (302 redirect)
- `OAuthSecurityConfiguration.java:71+` (OAuth2 redirect)
- `LDAPSecurityConfiguration.java:118-130` (LDAP basic-auth challenge)
- WebFetch live `/configuration-and-deployment/enable-security/authentication` 2026-05-25 status 200 — silent on the probe surface.

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-024 (AppInfoController auth-mode introspection contract — reporter-not-reactor pattern) anchors the deliberate "auth mode is part of the operator-visible state" stance for the documented `/api/appInfo` surface; the whoami endpoint's auth-mode discriminator is an UNINTENTIONAL parallel. The fix is doc-side primarily (live `/disabled-authentication` page should enumerate the response-shape consequences).

**Proposed remedy**: Doc-side: the live `/disabled-authentication` page must enumerate that under DISABLED, `GET /api/identity/whoami` returns 200 OK with `admin` + all permissions to any anonymous network caller (compound with REFACTOR-185). Code-side: optional — add a rate-limit on `/api/identity/whoami` (per IP, per session) to slow enumeration attempts, but the more leveraged fix is operator-network-segmentation guidance in the docs.

**Severity rationale**: MEDIUM — undocumented attacker-recon surface; combined with REFACTOR-185 + REFACTOR-606 + REFACTOR-068 it's the THIRD anonymous-discoverable auth-mode signal under DISABLED. The cumulative effect compounds; the doc-side fix is cheap.

**Suggested backlog grouping**: "Authorization audit batch" (same family as REFACTOR-068 — undocumented auth-mode disclosure surface; doc-side fix).

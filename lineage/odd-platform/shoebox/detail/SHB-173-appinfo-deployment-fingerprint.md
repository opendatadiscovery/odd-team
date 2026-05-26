# SHB-173 — `/api/appInfo` deployment fingerprint surface (auth-mode + projectVersion exposure)

**Category**: open
**Severity**: MEDIUM

## Hypothesis

Operators running the shipped-default `auth.type=DISABLED` deployment expose a network-reachable single-GET fingerprint endpoint — `GET /api/appInfo` — that returns `{projectVersion, authType}` to any caller able to reach the HTTP port. An attacker scanning a network range receives in ONE call: (a) confirmation this is an ODD instance (the field shape is ODD-specific), (b) the precise platform version (CVE-scoping), and (c) which authentication mode is active (telling them whether to attempt credential stuffing vs OIDC tampering vs walking in unauthenticated). The surface exists by design — the React SPA needs the auth mode to render its login flow — but the disclosure is undocumented in the operator-facing security pages.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/AppInfoController.java:18-29` — the `@Value("${auth.type}") String authType` field is round-tripped verbatim into the response DTO alongside `buildProperties.getVersion()`; no auth-mode normalisation, no enum constraint.
- `odd-platform-api/src/main/resources/application.yml:34` — the shipped default `auth.type=DISABLED`.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/config/DisabledAuthSecurityConfiguration.java:13-18` — under DISABLED mode the SecurityWebFilterChain is `.anyExchange().permitAll()`; every path including `/api/appInfo` is reachable unauthenticated.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/utils/SecurityConstants.java:95-96` — `WHITELIST_PATHS` lists `/actuator/**, /favicon.ico, /ingestion/**, /img/**, /api/slack/events` but NOT `/api/appInfo`; under LOGIN_FORM/OAUTH2/LDAP the path falls through to `.authenticated()` but under DISABLED `.permitAll()` exposes it.
- `odd-platform-specification/openapi.yaml:2704-2717` — operationId `getAppInfo` with NO `security:` element on the operation, NO `@PreAuthorize` on the generated `AppInfoApi`.
- WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security` (verified 2026-05-20 status 200) — page enumerates `auth.type` and the four-value vocabulary but does NOT mention `/api/appInfo`, does NOT warn about the fingerprint risk under DISABLED.

## Notes

- **The fingerprint surface is denser than `/actuator/info`.** `/api/appInfo` returns exactly two strings, both deployment-distinguishing: the field name `authType` is ODD-specific (no other product ships that JSON shape); the value `DISABLED|LOGIN_FORM|OAUTH2|LDAP` tells an attacker which auth surface to target; the `projectVersion` value scopes CVE matching to a specific Spring Boot / WebFlux / Reactor / R2DBC / OAuth-client chain.
- **Non-disclosed fields are evidence of intent.** AppInfo does NOT include OAuth provider name, LDAP server URI, OIDC issuer URL, build SHA, hostname, deployment-id. Identity's `whoami` likewise omits `provider` (only `username + permissions`). The two endpoints together encode "expose MODE, hide PROVIDER" — F-011 drift class `ui_identity_render_has_no_provider_field_positive_negative_no_leak` confirms it. The expose-mode side is intentional; the disclosure-under-DISABLED gap is the operator-trust surface to document.
- **Silent-default chain (LSN-001 class).** `@Value("${auth.type}")` at AppInfoController.java:18 has NO `@Value` default; an operator who unsets the key via `AUTH_TYPE=` env override silently produces a deployment with NO `SecurityWebFilterChain` bean (every `@ConditionalOnProperty(havingValue=...)` fails to match). `application.yml:34`'s `DISABLED` is the only safety net.
- **UI consumer downstream gating depends on the literal string.** `Overview.tsx:26` gates the OwnerAssociation card on `appInfo.authType !== 'DISABLED'`. A typo'd auth.type value (`OUATH2`, `LOGINFORM`) silently passes the gate AND silently disables every `@ConditionalOnProperty(havingValue=...)` match — the UI renders OwnerAssociation in a deployment that has no working authentication.
- This thread is **drift-shaped**: the FEATURE is "deployment-info introspection endpoint for UI runtime config discovery"; the GAP is "unauthenticated under shipped default + version disclosure". No existing F-NNN anchors this.
- Related: AppInfoController.java:18 sidecar already cites REFACTOR-185 (DISABLED-mode bypass — 19-sidecar pattern); this thread is the **per-endpoint UX manifestation** of that broader-substrate finding.

## Next

1. **Promote to feature flow** — `F-NNN — Deployment-Info Introspection Surface (`/api/appInfo`)`. Pillar P-09 (Security and Access Control) or P-08 (Management/Administration). Primary subjects: AppInfoController + `auth.type` config-key consumer + Overview.tsx gating + components.yaml AppInfo schema + IdentityController parallel surface.
2. **Open follow-ups**:
   - SEC-NNN — `/api/appInfo` reachable unauthenticated under DISABLED mode; document the fingerprint risk on the live security page.
   - SEC-NNN — `auth.type` has no enum validation at AppInfoController.java:18; typo/empty produces silent-no-SecurityWebFilterChain deployment.
   - DOC-NNN — `/api/appInfo` endpoint missing from `docs.opendatadiscovery.org/developer-guides/api-reference`.
3. **Probe** — replay a typo'd auth.type (`OUATH2`) and observe (a) AppInfo response (echoes typo), (b) downstream `@ConditionalOnProperty` resolution (no chain match), (c) actual HTTP behaviour (does Spring Security autoconfiguration kick in with a default chain, or is there NO chain at all?). The static-trace cannot answer this without running the platform.
4. **DOC-NNN** — `docs.opendatadiscovery.org` enable-security page should add an admonition: "Under `auth.type=DISABLED`, `/api/appInfo` is publicly reachable and discloses the deployment's auth mode and platform version. Either set `auth.type` to a real value before exposing the platform on a network, or whitelist the platform's HTTP port to trusted callers."

## Links

- cluster_with: [F-011, F-034]
- merged_into: (open)
- supersedes: []

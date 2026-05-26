# SHB-105 — `/api/identity/whoami` is an anonymous auth-mode fingerprint probe

**Category**: open
**Severity**: MEDIUM

## Hypothesis

An anonymous network caller can determine the platform's active authentication mode with a single unauthenticated `GET /api/identity/whoami` request, and — when `auth.type=DISABLED` — receives a 200 OK body claiming they are user `"admin"` with every Permission. The endpoint is the canonical auth-mode probe surface (response code + body shape varies per mode), the endpoint has no `@PreAuthorize` annotation, the response carries no `Cache-Control: no-store` header, and the controller emits no audit log on invocation. Operators auditing security posture, and attackers reconnoitering it, both rely on the same endpoint behaviour — the behaviour is not documented as such.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/IdentityController.java:23-33` — 12-line method body. Line 27 `.switchIfEmpty(Mono.just(new ResponseEntity<>(dummyOwner(), HttpStatus.OK)))` fires when the principal Mono is empty (DISABLED-mode condition). Lines 30-33 construct `new Identity().username("admin").permissions(Arrays.asList(Permission.values()))` — the `Permission.values()` call dynamically expands to whatever enum values exist (currently 70+ per `components.yaml:158-235`). Adding a new Permission to the spec AUTOMATICALLY enters the DISABLED-mode admin grant — no code change in this file.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/config/DisabledAuthSecurityConfiguration.java:11-19` — DISABLED-mode wires NO `ServerSecurityContextRepository`; `ReactiveSecurityContextHolder.getContext()` therefore emits empty; the `switchIfEmpty` fallback at IdentityController is the sole defining surface for the DISABLED-mode operator experience.
- `odd-platform-ui/src/components/shared/contexts/Permission/PermissionProvider.tsx:17-32` + `redux/selectors/profile.selectors.ts:17-20` — the SPA's `WithPermissionsProvider` reads the whoami response's permissions list directly. Under DISABLED, `isAllowedTo(<any Permission>)` is TRUE; every Permission-gated UI control is unlocked (Lookup Tables CRUD, Policy/Role/Owner mutation, attachment upload, lookup-row delete, etc.).
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/AuthorizationCustomizer.java:29-30` + `SecurityConstants.java:95-96 (WHITELIST_PATHS)` — `/api/identity/whoami` is NOT in the whitelist; under LOGIN_FORM/OAUTH2/LDAP the SecurityWebFilterChain blocks anonymous callers at the WebFilter layer with a 302 to `/login` (LOGIN_FORM) or 401 (OAUTH2/LDAP). The anonymous response codes are themselves the fingerprint: 200 + admin body → DISABLED; 302 → LOGIN_FORM; 401 → OAUTH2/LDAP.
- Live docs WebFetched 2026-05-25 (`/configuration-and-deployment/enable-security/authentication`, `/disabled-authentication`, `/authorization` — all status 200) — none mention the `/api/identity/whoami` endpoint, the `dummyOwner()` admin fallback, the UI permission-gate model under DISABLED, or that an anonymous probe of this URL identifies the deployment's auth mode.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/IdentityController.java:19` carries `@Slf4j` but the controller body uses NO log call. Combined with the absence of any audit-log infrastructure across the codebase (grep `AuditLog | @Auditable` returns 0 matches), an attacker probing whoami repeatedly leaves NO trace in application logs.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/IdentityController.java:25-28` — bare `ResponseEntity::ok` / `new ResponseEntity<>(...)` — no `Cache-Control` / `Pragma` / `Expires` header configuration. Spring Security's WebFluxSecurityHeadersConfiguration injects `no-cache, no-store` for authenticated responses ONLY when the security chain runs — under DISABLED the chain is `.anyExchange().permitAll()`, so no headers are stamped.

## Notes

- **This is the IDENTITY-LAYER FACET of REFACTOR-185** (the existing 16-sidecar default-insecure cluster) — the 17th sidecar elevates the cluster to "anonymous attacker confirms DISABLED + receives admin identity + walks the catalog as admin AND walks the UI as admin (all UI controls unlocked because the SPA believes them to be admin-with-all-permissions)".
- Caveat: the literal dummy username is lowercase `"admin"` (line 32). The S2sAuthenticationFilter uses uppercase `"ADMIN"` (S2sAuthenticationFilter.java:31-34). The two surfaces are DIFFERENT identity surfaces — an operator-named `admin` (lowercase) LOGIN_FORM/LDAP user collides with the DISABLED-fallback identifier; a user named `ADMIN` (uppercase) collides with the S2S filter's hardcoded literal. Two distinct collision footguns from two distinct hardcoded literals — both undocumented.
- Caveat: under DISABLED, an admin user manually inserting USER_OWNER_MAPPING `('admin', NULL, <owner_id>)` does NOT affect the dummyOwner response — the controller's `switchIfEmpty` short-circuits BEFORE the AuthIdentityProvider-fetched-owner step. So the dummyOwner identity always has `owner=null` regardless of any operator binding. Latent regression — a future refactor that "fixed" the dummy path to also resolve an Owner would activate the collision.
- The `Identity` response DTO carries `username + permissions` only — NO `provider` field. The UI cannot distinguish a LOGIN_FORM `alice` from an OAUTH2 `alice` from an LDAP `alice` from the response alone. Cross-link with F-011 facet `compound_key_silent_in_docs`.
- The endpoint shape — "answer the caller's identity to themselves" — is the canonical case for `Cache-Control: no-store`. Spring's default security-headers chain does stamp it for authenticated responses, but the DISABLED-mode chain bypasses headers. A shared HTTP intermediate (corporate proxy, browser back-cache) could serve a prior caller's body to a later caller — low-probability under realistic browser caches, real for misconfigured proxies.
- The `Permission.values()` blast-radius dynamicity is a property of the DTO build, not a bug — but worth surfacing: a future Permission `WEBHOOK_CREATE` automatically lands in the DISABLED-mode admin grant. The decision is "DISABLED-admin should always be maximally permissive" (per the dummyOwner construction's intent anchor); the consequence is "every new sensitive capability lands inside the default-insecure blast radius unattended".

## Next

1. Probe — anonymous `curl https://<deployment>/api/identity/whoami` against each of the four auth modes. Confirm the four-way response fingerprint (200+admin / 302 / 401 / 401).
2. ENRICHER for the existing REFACTOR-185 cluster — extend the cluster with the IDENTITY-LAYER axis. The cluster currently aggregates per-endpoint findings; this thread adds the orthogonal "the SPA itself is unlocked because the API claims admin" axis.
3. DOC-NNN — file a doc gap on `/disabled-authentication` to enumerate the blast radius: every API endpoint reachable, every actuator endpoint reachable, `/api/identity/whoami` returns admin-with-all-permissions, every UI control is unlocked.
4. SEC-NNN — emit a startup-time WARN log when `auth.type=DISABLED` AND the platform binds to a non-loopback interface. The platform currently boots silent — combine the warn-log gap with the IdentityController dummyOwner finding into a single SEC-NNN.

## Links

- cluster_with: [F-011, F-034]
- merged_into: (open — should be promoted into a REFACTOR-185 IDENTITY-FACET enricher OR a new F-NNN "UI Permission-Gate Bypass Under DISABLED")
- supersedes: []

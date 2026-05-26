# SHB-109 — S2S `X-API-Key` grants ADMIN globally across ALL `/**` paths

**Category**: open
**Severity**: HIGH

## Hypothesis

Operators enabling `auth.s2s.enabled=true` for "server-to-server" integration get a holder of `X-API-Key: <auth.s2s.token>` who is **injected as a synthetic ADMIN user across every HTTP path** — every controller, every endpoint, every method — with ADMIN authority, distinct from any per-IdP user identity. The S2S filter is composed at `SecurityWebFiltersOrder.HTTP_BASIC` order (before the OAuth2/LDAP/LoginForm chain) under all three non-DISABLED auth modes; it is NOT scoped to `/ingestion/*`, NOT limited to S2S CRUD; it is a global admin-equivalent authentication surface. The hardcoded username literal `"ADMIN"` (uppercase) collides with operator-named LOGIN_FORM/LDAP users named "ADMIN", silently inheriting their `USER_OWNER_MAPPING` row when one exists. The feature is **"S2S filter — global admin grant scope, naming collision with operator-named ADMIN user"** — F-008 anchored the ingestion-side; this thread names the cross-cutting global surface.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/filter/S2sAuthenticationFilter.java:31-39` — `User.withUsername("ADMIN").password("").roles("ADMIN").build()` + `getAuthorities(true)`. The synthetic principal carries username = literal `"ADMIN"` (uppercase) AND ADMIN role; on `X-API-Key` match the SecurityContext is forced with this identity for the entire request.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/config/OAuthSecurityConfiguration.java:90, 108-110` — `if (s2sEnabled) sec.addFilterAt(s2sAuthenticationFilter, SecurityWebFiltersOrder.HTTP_BASIC)` inside the OAUTH2 SecurityWebFilterChain. `HTTP_BASIC` is the highest-priority pre-authentication slot — S2S RUNS BEFORE OAuth2 login challenge.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/config/LDAPSecurityConfiguration.java:149-151` — identical pattern under LDAP mode. `addFilterAt(s2sAuthenticationFilter, SecurityWebFiltersOrder.HTTP_BASIC)`.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/config/LoginFormSecurityConfiguration.java:61-63` — identical pattern under LOGIN_FORM mode. The composition is symmetric across the three non-DISABLED modes. Under DISABLED, S2S is silently IGNORED — `DisabledAuthSecurityConfiguration.java:13-18` does not read the `s2sEnabled` property (a separate gap: operator setting `auth.s2s.enabled=true` under DISABLED gets the property accepted but no filter wired).
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/AuthIdentityProviderImpl.java:29-33` — the S2S synthetic principal is a `UsernamePasswordAuthenticationToken` (not `OAuth2AuthenticationToken`), so the else-branch fires at line 32 → `UserDto("ADMIN", null)` — provider=null. Downstream `fetchAssociatedOwner` queries `WHERE oidc_username='ADMIN' AND provider IS NULL`. If an operator has named a real LOGIN_FORM or LDAP user `ADMIN` (uppercase, case-sensitive match), the S2S caller INHERITS that user's Owner-link.
- Live OAuth2/OIDC docs WebFetched 2026-05-12 — do NOT mention `auth.s2s.enabled` or its composition with OAUTH2. Live S2S sub-page (`/configuration-and-deployment/enable-security/authentication/s2s`) WebFetched 2026-05-10 status 200 verbatim: "Requests carrying a valid token run with the built-in `ADMIN` user and ADMIN role, so they can call any endpoint that admins can call". The docs state the broad-surface ADMIN claim but do NOT name the collision-with-operator-`ADMIN`-user risk.
- The S2S filter validates the token via `s2sTokenProvider.isValidToken(...)` with no MessageDigest.isEqual constant-time comparison (sibling pattern to IngestionDataEntitiesFilter); timing-based discovery on a low-latency network is theoretically feasible.

## Notes

- **Operator surprise pattern**: an operator enables `auth.s2s.enabled=true` for an automated ingestion script. The script's `X-API-Key` works for `/ingestion/entities` — as expected. The script ALSO works for `/api/policies` CREATE, `/api/owners` CREATE, `/api/users` MUTATIONS, `/api/data-entities/{id}/internal-name` PUT — NOT as expected. The name "S2S" implies "server-to-server ingestion-shaped", the actual scope is "ADMIN across `/**`". Operators writing thin-client ingestion scripts inadvertently expose admin-equivalent capability.
- Caveat: a request bearing BOTH `X-API-Key` AND a session cookie — under LOGIN_FORM the session-cookie auth runs AFTER the S2S filter at `HTTP_BASIC` order; the S2S identity wins (synthetic ADMIN), the session-cookie identity is discarded. Reverse of operator intuition ("my session should win, the API key is fallback").
- Caveat: a request bearing `X-API-Key` AND no Authorization header — the OAuth2 login chain is skipped (S2S filter handles auth at HTTP_BASIC); the SecurityContext is the synthetic ADMIN; the controller body runs as ADMIN. The X-API-Key is the credential; no IDP roundtrip; no provider claim resolution.
- Caveat: the cross-mode bleed via `"ADMIN"` username (uppercase, case-sensitive equals at `ReactiveUserOwnerMappingRepositoryImpl.java:116-127` — the SQL clause uses `eq`, not `equalsIgnoreCase`) — an operator running a LOGIN_FORM user literally named `ADMIN` (in the bundled `admin:admin,root:root` default, the user is `admin` lowercase — not collision-triggering; an operator override using uppercase IS). Surfacing this is the F-011 facet's HIGH severity finding.
- Cross-link with F-008 (Batch Ingestion S2S API) — F-008 anchors `/ingestion/entities` specifically; this thread anchors the cross-cutting global surface. The two are NOT the same feature: F-008 is about ingestion path coverage; SHB-109 is about scope of the ADMIN grant when S2S is on.
- Cross-link with SHB-106 (Ingestion Filter Coverage) — both threads surface the operator-mental-model gap between "S2S" terminology and "per-DS bearer token". Distinct features, related surface.
- Cross-link with SHB-105 (whoami probe) — under `auth.s2s.enabled=true`, an anonymous probe `GET /api/identity/whoami` with `X-API-Key: <token>` returns `username='ADMIN'` (the synthetic principal name), NOT the dummyOwner fallback. The two surfaces interact: a holder of the S2S token sees themselves as ADMIN in the whoami response; an anonymous (no key) caller under DISABLED sees themselves as 'admin' (lowercase) in the whoami response.
- Drift class — `auth.s2s.token` is a YAML/env single-string shared secret. No rotation, no per-caller token, no scoped tokens, no audit trail on which automation script used the token. If the token is exfiltrated, the operator must coordinate a token rotation across every automation consumer AND restart the platform — the token is `@Value`-read once at startup.

## Next

1. Probe — set `auth.s2s.enabled=true`, set `auth.type=OAUTH2`, hit `GET /api/policies` with `X-API-Key: <token>` and no session/Authorization header. Confirm 2xx + the response contains the full policy catalog (admin scope).
2. Probe — same setup, hit `POST /api/policies` with a payload and `X-API-Key`. Confirm policy creation succeeds (admin-equivalent on a mutation endpoint).
3. Probe — `GET /api/identity/whoami` with `X-API-Key`. Confirm response: `username='ADMIN'`, `permissions=[ADMIN's resolved permissions or all values]`.
4. Promote to NEW `F-NNN — S2S Filter Global Admin Grant` with `seeded_from: SHB-109` and `primary_subject: [S2sAuthenticationFilter, OAuthSecurityConfiguration, LoginFormSecurityConfiguration, LDAPSecurityConfiguration, DisabledAuthSecurityConfiguration, AuthIdentityProviderImpl]`. Test matrix: S2S × auth-mode × endpoint-class × identity-collision-with-operator-`ADMIN`-user.
5. DOC-NNN — add to the S2S docs page: (a) the global `/**` scope (not just ingestion), (b) the cross-mode-bleed-via-`ADMIN`-username warning, (c) the no-rotation token model, (d) the bypass-of-CSRF-token-flow on session-cookie modes (X-API-Key requests don't carry CSRF tokens, but CSRF is also disabled platform-wide — so non-issue).
6. SEC-NNN — consider scoping the S2S filter to ingestion paths only (mirror REFACTOR-108 — `S2sAuthenticationFilter` should be path-scoped to `/ingestion/**` if the operator intent is "ingestion-only API key").

## Links

- cluster_with: [F-008, F-011]
- merged_into: (open)
- supersedes: []

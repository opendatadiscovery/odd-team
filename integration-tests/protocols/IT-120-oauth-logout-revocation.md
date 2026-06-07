---
id: IT-120
title: "Pin the observable logout-endpoint behaviour under DISABLED; document the per-provider IdP-revocation semantics from source"
gates:
  validates: [F-086]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:oauth-logout-revocation.spec.ts"
plan_ref: I1
status: ready
---

# IT-120 — OAuth Logout Token-Revocation Semantics (observable contract)

> A protocol is the **source of truth** — a human can execute every step below WITHOUT any
> tooling. The `automation:` spec runs the same steps and writes the same result.

## 1. What this checks

F-086's claim: logout's IdP-side effect diverges per provider — Google + GitHub actively REVOKE
the IdP-issued token; Azure + Cognito + ODD_IAM only invalidate the local session, leaving the
token valid for the rest of its TTL. That divergence happens inside the per-provider
`*LogoutSuccessHandler.handle()` chain, which is wired ONLY when `auth.type=OAUTH2`
(`OAuthLogoutSuccessHandler` is `@ConditionalOnProperty(value="auth.type", havingValue="OAUTH2")`).
On odd-minimal (auth.type=DISABLED, no IdP) that chain is **not present** — so the revocation
behaviour is **IdP-blocked**.

What IS observable here is the logout-ENDPOINT contract under DISABLED, and it is a real,
pinnable, operator-facing fact:

- `GET /logout` → **200** (the SPA index fallback — there is no GET-logout route under DISABLED).
- `POST /logout` → **302 `Location: /login?logout`** — this is Spring Security's DEFAULT logout
  (session-invalidate + redirect to `/login?logout`). The per-provider OAuth revocation handlers
  are NOT in the chain; no outbound revocation call is made.

Operator consequence if it fails: the logout button is wired to a real session-termination
endpoint even on the minimal stack; a RED here means logout stopped invalidating / redirecting
(a dead logout button) — exactly the silent-breakage class the test suite exists to catch.

Source: OAuthLogoutSuccessHandler.java:16,30-42; GoogleLogoutSuccessHandler.java:43-56 (POST /revoke);
GithubLogoutSuccessHandler.java:51-65 (DELETE grant); AzureLogoutSuccessHandler.java:30-47 (no revoke);
CognitoLogoutSuccessHandler.java:33-50 (no revoke; empty logout-uri returns Mono.empty BEFORE invalidate);
ODDIAMLogoutSuccessHandler.java:30-46 (no revoke); DisabledAuthSecurityConfiguration.java:13-18.

## 2. Preparation — build the test stand

- **Stack**: shared odd-minimal (:18080 + :15432), already up. `ODD_STACK_EXTERNAL=1`. NEVER
  bring up/tear down.
- **Auth/config**: auth.type=DISABLED. The OAuth logout chain is not instantiated (its bean is
  `@ConditionalOnProperty=OAUTH2`) — this is why per-provider revocation is IdP-blocked.
- **Seed data**: none. There is no authenticated session to capture (DISABLED has no login).

## 3. Readiness check — is the stand ready?

- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- Auth mode: `curl -s http://localhost:18080/api/appInfo` → `authType":"DISABLED"`

## 4. Run protocol — what to run

1. `GET /logout` (maxRedirects:0) → expect 200 `text/html` (SPA fallback; no GET-logout route).
2. `POST /logout` (maxRedirects:0) → expect 302 with `Location: /login?logout` (Spring default logout).
3. Confirm the redirect target is the FIXED `/login?logout`, not an external IdP end-session URL
   (no per-provider handler runs under DISABLED).

**Automated rail**: from `integration-tests/e2e`,
`PATH="$HOME/.local/node/bin:$PATH" ODD_STACK_EXTERNAL=1 npx playwright test specs/oauth-logout-revocation.spec.ts --reporter=line`

## 5. What it checks — assertions

- **PASS** when: GET /logout is the SPA fallback; POST /logout is a 302 to `/login?logout`
  (session-invalidating default logout, no external revocation).
- **FAIL** when: POST /logout stops redirecting / stops being a logout (dead button), OR begins
  redirecting to an external host on the minimal stack (config drift).

### IdP-blocked sub-promises (deferred-with-reason — require an OIDC provider + a captured token)

Each is source-grounded here and routes to a missing-functional TEST-GAP for a future
Keycloak-realm + Wiremock probe:

- **F-086-UC-01** Google + GitHub logout actively REVOKE the IdP token (CONFIRMED in source).
  Source: GoogleLogoutSuccessHandler.java:43-56 (POST oauth2.googleapis.com/revoke),
  GithubLogoutSuccessHandler.java:51-65 (DELETE /applications/{client_id}/grant). *Blocked: needs a live token + Wiremock IdP.*
- **F-086-UC-02** Cognito logout does NOT call /oauth2/revoke (CONTRADICTED). Source:
  CognitoLogoutSuccessHandler.java:33-50. Tracked PLT-073.
- **F-086-UC-03** Azure ends the IdP session via end-session redirect; RFC-7009 revoke not possible in v2.0 (PARTIAL).
  Source: AzureLogoutSuccessHandler.java:30-47.
- **F-086-UC-04** Cognito with an EMPTY logout-uri returns `Mono.empty()` BEFORE `WebSession::invalidate`
  → the LOCAL session is NOT cleared (CONTRADICTED). Source: CognitoLogoutSuccessHandler.java:33-35 vs :49.
- **F-086-UC-05** Azure with a null logout-uri → `URI.create(null)` NPE / HTTP 500 on first logout (CONTRADICTED).
  Source: AzureLogoutSuccessHandler.java:39 + ODDOAuth2Properties.java:21-28 (logoutUri unvalidated). Tracked PLT-130.
- **F-086-UC-06** Okta/Keycloak/Custom-OIDC fall through to the default OIDC end-session handler (PARTIAL).
  Source: OAuthSecurityConfiguration.java:180-183 (`defaultOidcLogoutHandler`).
- **F-086-UC-09** no handler emits a CSRF-binding `state`/`nonce` on the end-session redirect (CONTRADICTED).
  Source: all 5 *LogoutSuccessHandler (no state/nonce). LOW — fold into PLT-075.

## 6. Result log

Captured in the spec docstring + batch report (live-curl + Playwright APIRequestContext).

## Cross-references
- Source: F-086 UC-01..UC-11 (`lineage/odd-platform/feature-flows/detail/F-086.yaml`)
- Related bugs: PLT-073 (Cognito revoke), PLT-130 (Azure NPE), PLT-075 (logout hardening)
- Sibling protocols: IT-121 (post-logout redirect provenance — the other half of "what does logout do?")

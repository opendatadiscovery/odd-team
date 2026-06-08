---
id: IT-121
title: "Pin that the DISABLED logout redirect ignores attacker-controlled redirect/Host inputs; document the OAUTH2 Host-derived provenance from source"
gates:
  validates: [F-089]
  enforces: []
  regresses: []
test_class: integration
stack: odd-minimal
automation: "e2e:oauth-post-logout-redirect.spec.ts"
plan_ref: I1
status: ready
---

# IT-121 — Post-Logout Redirect Provenance (observable contract) · SECURITY-class

> A protocol is the **source of truth** — a human can execute every step below WITHOUT any
> tooling. The `automation:` spec runs the same steps and writes the same result.

## 1. What this checks

F-089's claim: under OAUTH2, all five `*LogoutSuccessHandler`s build the IdP `post_logout_redirect_uri`
(or `logout_uri`) from `UriUtils.getBaseUri(exchange.getRequest().getURI())` — i.e. from the inbound
request's Host — with **no `platform.base-url` allowlist** and no Host validation. Behind a reverse
proxy that trusts `X-Forwarded-Host`, that lets a user-controlled host propagate into the IdP logout
redirect chain (an open-redirect when the IdP's own allowlist is permissive). That open-redirect lives
in the OAuth logout handler chain, which is wired ONLY under `auth.type=OAUTH2` — so on odd-minimal
(DISABLED, no IdP) the **open-redirect is structurally unreachable**. That OAUTH2-specific exposure is
**IdP-blocked** here (responsible disclosure: the mechanism is documented from source below; no
exploit recipe and no live exploitation is performed).

What IS observable on the DISABLED stack — and is the SAFE-DEFAULT half of F-089 (UC-3) — is that the
logout redirect that DOES run (Spring Security's default logout) **ignores** attacker-controlled
inputs:

- `POST /logout` → 302 `Location: /login?logout` (a fixed, server-relative path).
- adding `?post_logout_redirect_uri=https://evil.example.com/` → **still** `/login?logout` (param ignored).
- adding header `X-Forwarded-Host: evil.example.com` (with/without `X-Forwarded-Proto: https`) →
  **still** `/login?logout` (Host header NOT reflected into the redirect; Spring's default
  `server.forward-headers-strategy` is `none`, and the default-logout target is a fixed relative path).

Operator consequence if it fails: a RED here means the DISABLED logout started reflecting a
user-controlled host/param into its redirect — a regression that would introduce an open-redirect on
the *default* deployment posture (the most severe possible drift for this surface).

Source: UriUtils.java:11-23 (Host-derived, strips path/query); all 5 *LogoutSuccessHandler
(`post_logout_redirect_uri`/`logout_uri` = `UriUtils.getBaseUri(requestUri)`):
AzureLogoutSuccessHandler.java:40, CognitoLogoutSuccessHandler.java:43, GoogleLogoutSuccessHandler.java:40,
GithubLogoutSuccessHandler.java:45, ODDIAMLogoutSuccessHandler.java:39; application.yml:209
(`platform-base-url` shipped commented-out → no active allowlist); OAuthLogoutSuccessHandler.java:16
(`@ConditionalOnProperty=OAUTH2`).

## 2. Preparation — build the test stand

- **Stack**: shared odd-minimal (:18080 + :15432), already up. `ODD_STACK_EXTERNAL=1`. NEVER
  bring up/tear down.
- **Auth/config**: auth.type=DISABLED; `server.forward-headers-strategy` unset (default `none`);
  no `platform.base-url` configured. The OAuth logout chain (where the open-redirect lives) is not
  instantiated — IdP-blocked.
- **Seed data**: none.

## 3. Readiness check — is the stand ready?

- Platform health: `curl -fsS http://localhost:18080/actuator/health` → `{"status":"UP"}`
- Auth mode: `curl -s http://localhost:18080/api/appInfo` → `authType":"DISABLED"`

## 4. Run protocol — what to run

1. `POST /logout` → 302, `Location: /login?logout` (baseline).
2. `POST /logout?post_logout_redirect_uri=https://evil.example.com/` → 302, `Location: /login?logout`
   (the attacker param is ignored).
3. `POST /logout` with header `X-Forwarded-Host: evil.example.com` (and a second run also adding
   `X-Forwarded-Proto: https`) → 302, `Location: /login?logout` (the forwarded Host is NOT reflected).

**Automated rail**: from `integration-tests/e2e`,
`PATH="$HOME/.local/node/bin:$PATH" ODD_STACK_EXTERNAL=1 npx playwright test specs/oauth-post-logout-redirect.spec.ts --reporter=line`

## 5. What it checks — assertions

- **PASS** when: every variant redirects to the fixed `/login?logout`; no `evil.example.com` (or any
  external host) ever appears in the `Location` header.
- **FAIL** when: the redirect target reflects the `post_logout_redirect_uri` param OR the
  `X-Forwarded-Host` header (an open-redirect regression on the default posture).

### IdP-blocked sub-promises (deferred-with-reason — require an OIDC provider + a Host-trusting proxy)

Each is source-grounded; routes to a missing-functional TEST-GAP for a future nginx + Keycloak probe:

- **F-089-UC-1** multi-hostname deployments redirect back to the SAME external hostname without
  ODD-side enumeration (the intended capability; CONFIRMED in source). Source: UriUtils.java:11-23.
- **F-089-UC-2** the post-logout host is NOT a user-controllable Host value (CONTRADICTED under a
  Host-trusting proxy in OAUTH2). Source: all 5 handlers + UriUtils.java:11-23 (no validation) +
  application.yml (no platform.base-url). Tracked PLT-075. *Blocked: needs OAUTH2 + proxy.*
- **F-089-UC-4** an attacker cannot inject a crafted PATH/QUERY — getBaseUri strips to host root
  (CONFIRMED). Source: UriUtils.java:16-21 (`replacePath('/')`, `replaceQuery(null)`).
- **F-089-UC-5/UC-6** Azure null logout-uri → 500 NPE (PLT-130); Cognito empty logout-uri does NOT
  clear the local session (net-new). Source: AzureLogoutSuccessHandler.java:39 / CognitoLogoutSuccessHandler.java:33-35.
- **F-089-UC-7** no `state`/`nonce` CSRF binding on the end-session redirect. Source: all 5 handlers.

## 6. Result log

Captured in the spec docstring + batch report (live-curl + Playwright APIRequestContext).

## Cross-references
- Source: F-089 UC-1..UC-11 (`lineage/odd-platform/feature-flows/detail/F-089.yaml`)
- Related bugs: PLT-075 (open-redirect / logout hardening), PLT-130 (Azure NPE); DOC-236 (docs disclosure, done)
- Sibling protocols: IT-120 (logout revocation — the other half of "what does logout do?")

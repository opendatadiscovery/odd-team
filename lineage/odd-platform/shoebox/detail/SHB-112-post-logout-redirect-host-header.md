# SHB-112 — Post-logout redirect URI derived from inbound Host header (open-redirect surface)

**Category**: merged
**Severity**: MEDIUM

## Hypothesis

Operators using OAuth2 logout flows (Cognito, Azure, Google, GitHub, ODD_IAM) see the `post_logout_redirect_uri` parameter sent to the IdP's end-session endpoint **derived from the inbound HTTP request's Host header via `UriUtils.getBaseUri(requestUri)`** — NOT from a configured `platform.base-url` allowlist. A reverse proxy that trusts and forwards user-controlled `Host` or `X-Forwarded-Host` headers without sanitisation propagates that value into the IdP's logout redirect chain. The ONLY mitigation is the IdP's own allowlist (Azure App Registration Logout URLs, Cognito Allowed sign-out URLs, etc.) — if an operator has registered wildcard / multiple URLs at the IdP for multi-environment sharing, the platform's contribution is the unsanitised inbound Host header → open-redirect after IdP logout. The feature is **"post-logout redirect provenance — Host header trust, no platform allowlist"**.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/logout/AzureLogoutSuccessHandler.java:38-44` — `.queryParam("post_logout_redirect_uri", UriUtils.getBaseUri(requestUri))`. The `requestUri` is `exchange.getExchange().getRequest().getURI()` — the platform-side derived URI from the inbound HTTP request, including any forwarded Host header.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/logout/CognitoLogoutSuccessHandler.java:43` — same pattern, `.queryParam("logout_uri", UriUtils.getBaseUri(requestUri))`. Per AWS docs the value must be in the App Client's "Allowed sign-out URLs".
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/logout/GoogleLogoutSuccessHandler.java:40` + `GithubLogoutSuccessHandler.java:45` + `ODDIAMLogoutSuccessHandler.java:38` — consistent across all five handlers using `UriUtils.getBaseUri(requestUri)`. The pattern is platform-wide.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/utils/UriUtils.java:11-23` — `getBaseUri(URI)` strips path/query/fragment and replaces path with `/`. The returned URI is scheme + host[+port] + `/`. Whatever Host header arrived in the request (`example.com` from the browser, `evil.com` from a misconfigured proxy) is the host that gets sent to the IdP.
- Grep across the repository for `platform.base-url` / `odd.platform-url` / `allowed.redirect` — ZERO matches (per AzureLogoutSuccessHandler sidecar's verified result). The platform has NO configured base-URL property to cross-check the inbound Host against.
- LSN-001 / LSN-002 shape: silent insecure default + warning-only doc. Live docs for each IdP do not document the Host-header-derived semantics; live docs do not name the operator-side IdP-allowlist as the load-bearing protection; live docs do not name X-Forwarded-Host as a concern.

## Notes

- **Operator threat model**: a reverse proxy in front of the platform (nginx, AWS ALB, K8s Ingress) is configured to trust `X-Forwarded-Host` and propagate it into the request URI (Spring Boot's `server.forward-headers-strategy: native` or `framework` honours this). An attacker crafts a link `https://victim-domain/logout` with a `Host: attacker.com` header (or `X-Forwarded-Host: attacker.com` if the proxy strategy allows it from the public side). The user (already logged in) clicks logout. The platform issues a 302 to the IdP's end-session endpoint with `post_logout_redirect_uri=https://attacker.com/`. The IdP validates against its own allowlist — IF the operator registered wildcard URLs at the IdP for multi-env Azure App Registration sharing, the IdP redirects the user's browser to `https://attacker.com/`. The user lands on attacker-controlled domain after a successful authenticated logout flow — classic open-redirect with a side-helping of "I just logged out of the legitimate platform; my session cookie is gone; I'm trusting the redirect destination".
- **Realistic deployment shapes**: a multi-env Azure tenant where one App Registration serves dev, staging, prod with Logout URLs `https://*.example.com/`. A reverse proxy with `X-Forwarded-Host` honoured. The platform's `UriUtils.getBaseUri` returns whatever `Host` the proxy passes. The IdP allowlist permits any `*.example.com` host — including `attacker.example.com` if the attacker subdomain matches.
- Caveat — `UriUtils.getBaseUri` always strips the path AND query, so the attack target is restricted to the scheme+host+port. The attacker cannot inject specific path-shaped phishing pages via the platform — only redirect to a root URL. Reduces but does not eliminate phishing-via-trusted-redirect.
- Caveat — Spring WebFlux default `server.forward-headers-strategy: none` does NOT honour `X-Forwarded-Host` unless the operator configures otherwise. Many K8s-native deployments configure `native` or `framework`. The vulnerability surface depends on the deployment-side header trust configuration. The platform does NOT enforce a stance — it operates as if every inbound URI is trustworthy.
- Caveat — Azure does NOT honour RFC 7009 token revocation in v2.0 (per SHB-107). So even if the open-redirect is successfully exploited and the attacker captures the user's browser context post-logout, the IdP-issued OAuth2 token has been revoked (well, NOT actually revoked — see SHB-107) — actually, the token has been session-invalidated on the platform but NOT revoked at the IdP. The user's IdP-issued tokens (if previously captured) remain valid against IdP-protected resources. Compounds with SHB-107.
- This is part of the broader Logout Hardening surface — combines naturally with SHB-107 (asymmetric token revocation) and SHB-108 (cookie security attributes). Three threads describe distinct facets of the same "what does logout actually do?" question.
- The platform's choice to derive `post_logout_redirect_uri` dynamically from the request (rather than from operator config) is an explicit design decision (per AzureLogoutSuccessHandler sidecar's implicit_adrs[2]) — chosen because it works correctly for multi-hostname deployments (load balancer + internal hostname) WITHOUT requiring operators to enumerate every external hostname in ODD config. The trade-off was accepted; the consequence (operator-side IdP allowlist as the load-bearing protection) was not surfaced in docs.

## Next

1. Probe — set up the platform behind nginx with `X-Forwarded-Host: attacker.com` honoured. Configure Azure with a permissive logout URL allowlist (`https://*.example.com/`). Click logout from `victim.example.com` with a crafted `X-Forwarded-Host: attacker.example.com`. Confirm the IdP-issued 302 redirects to `https://attacker.example.com/`.
2. Read the Spring WebFlux header-trust configuration defaults for `server.forward-headers-strategy` and triangulate which deployment shapes are vulnerable.
3. Promote to a NEW `F-NNN — OAuth Logout Redirect Provenance` with `seeded_from: SHB-112` and `primary_subject: [UriUtils, all 5 *LogoutSuccessHandler.java, application.yml absence of platform.base-url]`. Test matrix: forward-header trust × IdP allowlist permissiveness × attack vector (Host vs X-Forwarded-Host).
4. DOC-NNN — add to each IdP-specific docs page: (a) the dynamic-host-derived redirect mechanism, (b) the operator's responsibility to lock down the IdP allowlist tightly, (c) the operator's responsibility to configure `server.forward-headers-strategy` correctly, (d) the warning that a permissive proxy + a permissive IdP allowlist = open-redirect.
5. SEC-NNN — propose a `platform.base-url` configuration property + a guard at the LogoutSuccessHandler that asserts `UriUtils.getBaseUri(requestUri).getHost() == platform.base-url.host` before issuing the redirect, falling back to the configured base URL when the inbound Host doesn't match.

## Links

- cluster_with: []
- merged_into: F-089
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: graduated — genuinely new feature shape. Evidence spans 5 logout handlers (consistent platform-wide pattern) + UriUtils + application.yml absence of platform.base-url; substrate evidence verified by AzureLogoutSuccessHandler sidecar (F-011 batch O). F-011 batch O carries the Azure NPE finding (different facet of same handler); F-086 covers the token-revocation matrix (different facet of same logout flow); F-089 is the redirect-provenance surface — together the three features describe the full "what does logout actually do?" question. Minted F-089 at lineage/odd-platform/feature-flows/detail/F-089.yaml (P-09:F-010 Post-Logout Redirect Provenance). Cross-link with F-086 (revocation), F-011 (chokepoint), F-087 (session cookie posture).

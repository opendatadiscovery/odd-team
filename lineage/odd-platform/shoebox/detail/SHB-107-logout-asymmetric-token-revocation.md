# SHB-107 — OAuth logout token-revocation is asymmetric across providers

**Category**: merged
**Severity**: MEDIUM

## Hypothesis

Operators expecting "logout invalidates the user's session and revokes their tokens" see materially different behaviours per OAuth2 provider. Google + GitHub logout handlers ACTIVELY call provider revocation endpoints (`oauth2.googleapis.com/revoke`, `DELETE /applications/{client_id}/grant`) — the OAuth2 access token is server-side invalidated. Azure + Cognito + ODD_IAM logout handlers ONLY invalidate the local `WebSession` and redirect through the provider's end-session URL — the OAuth2 access/refresh/id tokens **remain valid at the IdP until their natural TTL expires** (Azure access token typically 60-90 minutes; Cognito 1 hour; refresh tokens up to 90 days). An attacker who exfiltrated the OAuth2 access token before the user clicked logout can continue using it against IdP-protected downstream APIs (and against the platform if a token-issuing window is open) — for the rest of the token's natural lifetime. The feature is **"per-provider logout token-revocation semantics"** — an operator-observable correctness gap that no F-NNN currently anchors.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/logout/AzureLogoutSuccessHandler.java:31-48` — handle() sets 302 + Location header (Azure end-session URL) + `WebSession::invalidate`. NO outbound HTTP to a token-revocation endpoint. Azure AD v2.0 does not expose RFC 7009 revocation in the v2 protocol, so even attempting one would 404 — but the platform does not surface the caveat anywhere.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/logout/CognitoLogoutSuccessHandler.java:33-50` — same shape: 302 to Cognito `/logout` + `WebSession::invalidate`. NO call to Cognito's `/oauth2/revoke` endpoint (which DOES exist per AWS docs). Tokens remain valid until natural TTL.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/logout/GoogleLogoutSuccessHandler.java:43-54` — POSTs to `https://oauth2.googleapis.com/revoke` to ACTIVELY revoke the access token. Server-side token invalidation IS performed.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/logout/GithubLogoutSuccessHandler.java:51-63` — issues `DELETE /applications/{client_id}/grant` to revoke the OAuth2 grant (revokes ALL tokens for the user+app pair). Server-side revocation IS performed.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/logout/ODDIAMLogoutSuccessHandler.java:30-46` — same shape as Azure / Cognito: session-only invalidation, no outbound revocation.
- Live OAuth2/OIDC docs WebFetched 2026-05-19 status 200 — describes `logout-uri` per-provider but is SILENT on the token-revocation asymmetry. An operator with stringent compliance requirements (e.g. immediate revocation on logout for incident response) cannot tell from docs which providers actually honour it.

## Notes

- The asymmetry is part-protocol-driven (Azure does not expose RFC 7009 revocation in v2.0; Cognito does, but ODD's handler does not call it) and part-design choice (ODD_IAM is internal and presumably could expose revocation but the handler does not). The mixed cause is the load-bearing signal — Azure's asymmetry is "no IdP support"; Cognito's is "platform does not call the available endpoint".
- **Token exfiltration threat model**: a non-HttpOnly localStorage copy of the access token (e.g. a browser-extension compromise); a network-MITM-captured token; a logged-out OS keychain export. Logout invalidates the platform-side session cookie but does NOT invalidate the OAuth2 token at the IdP. The token continues working against the IdP's other resources for the rest of its TTL — Azure 60-90min; Cognito 1hr; refresh tokens 90 days.
- Caveat: `oauth2Login(withDefaults())` at `OAuthSecurityConfiguration.java:99` uses Spring Security's default `OidcClientInitiatedServerLogoutSuccessHandler` ONLY as a fallback at `OAuthSecurityConfiguration.java:180-183`. For Okta + Keycloak (documented but not in `Provider` enum), the fallback handler runs — which issues an OIDC `end_session_endpoint` request IF the IdP supports it. For OAuth2-only (non-OIDC) providers, no server-side revocation happens.
- Caveat: NO logout handler emits a state parameter or nonce on the end-session redirect (`AzureLogoutSuccessHandler.java:38-44`, `CognitoLogoutSuccessHandler.java:40-46`). OIDC RP-Initiated Logout 1.0 §5 recommends `state` to bind the logout request to the user session and prevent CSRF. Low-severity attack (worst is forcing a victim to log out), but the omission is shared across all 5 handlers.
- Caveat — `post_logout_redirect_uri` is derived from the inbound request's Host header via `UriUtils.getBaseUri(requestUri)` (consistent across all 4 OIDC handlers). NO platform-side allowlist. See SHB-114 for the open-redirect via X-Forwarded-Host facet.
- Drift class — same operator surface ("I clicked logout") produces different observable behaviour per provider. Operators with multi-IDP deployments (e.g. Google + Cognito both configured) see federated users from one provider getting full revocation, federated users from another getting session-only invalidation. Compliance/SOC2/SOX implications depending on jurisdiction.
- The end-session-only design is consistent with Cognito/Azure/ODDIAM's contract (the IdP's session cookie is dropped on the user's redirect to the end-session URL — invalidating the IdP-issued SSO session at the IdP). The token-revocation gap is orthogonal: tokens previously issued and exfiltrated remain valid.
- Zero test coverage across `auth/logout/` — `find <odd-platform-api>/src/test -name '*Logout*.java'` returns 0 matches. Six production classes (5 provider handlers + 1 dispatcher), 0 tests.

## Next

1. Verify Cognito's token-revocation endpoint URL (`https://<pool>.auth.<region>.amazoncognito.com/oauth2/revoke`) is reachable from a deployment and confirm `CognitoLogoutSuccessHandler` could call it (a one-line addition).
2. Probe — capture an OAuth2 access token, click logout, verify the token is still accepted by the IdP for the rest of its TTL (4 separate probes per Azure / Cognito / Google / GitHub).
3. Promote to a NEW `F-NNN — Logout Token-Revocation Semantics` with `seeded_from: SHB-107` and `primary_subject: [Azure / Cognito / Google / GitHub / ODDIAM LogoutSuccessHandler, OAuthLogoutSuccessHandler]`. Test matrix: per-provider logout token-revocation behaviour.
4. DOC-NNN — add a "Logout token revocation by provider" table to the OAuth2/OIDC docs page enumerating which providers do (Google, GitHub), which do not (Azure — protocol limitation; Cognito, ODD_IAM — platform choice), and the residual token validity window per provider.
5. SEC-NNN — consider adding `CognitoLogoutSuccessHandler` outbound `/oauth2/revoke` call (one line + retry/timeout); ODDIAMLogoutSuccessHandler may benefit from a similar addition if the platform's IdM exposes a revocation endpoint.

## Links

- cluster_with: []
- merged_into: F-086
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: graduated — genuinely new feature shape. F-011 already carries Azure NPE + Cognito empty-uri facets at the principal-resolution chokepoint (the upstream-of-handler tier), but the operator-observable cross-provider TOKEN-REVOCATION matrix is the FEATURE — not a chokepoint sub-finding. The matrix as a documentation + integration-test target has no existing F-NNN. Minted F-086 at lineage/odd-platform/feature-flows/detail/F-086.yaml (P-09:F-007 OAuth Logout Token-Revocation Semantics). Cross-link with F-011 (chokepoint), F-089 (post-logout redirect provenance — sibling logout-hardening surface).

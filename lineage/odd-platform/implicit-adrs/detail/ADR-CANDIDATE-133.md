## ADR-CANDIDATE-133 — Post-logout redirect URI is INBOUND-REQUEST-DERIVED via `UriUtils.getBaseUri(requestUri)`; the platform commits operators to trust their reverse proxy for Host-header authority — there is no `platform.base-url` / `odd.platform-url` config knob

**Severity**: MEDIUM
**Classification**: promote
**Pillars affected**: [P-09-security-access-control]
**Support count**: 5 sidecars (batch O Azure + Cognito directly; cross-batch reference to Google + GitHub + ODDIAM logout handlers all using the same UriUtils.getBaseUri helper) + Grep returning ZERO matches for any `platform.base-url` / `odd.platform-url` config key
**Axes present**: auth_logout_handlers
**Batch**: O (2026-05-19)

**Surfaced by**:
- `AzureLogoutSuccessHandler.md:implicit_adrs.[2]` (MEDIUM) — "The post-logout redirect target is the inbound request's base URI, NOT a configured `platform.base-url` property. The decision encodes: (a) the platform's deployment URL is inferred from the request the user just made (which the reverse proxy authoritatively constructs); (b) there is no separate `odd.platform-url` / `platform.base-url` configuration property to cross-check against; (c) operators must trust their reverse proxy to set Host/X-Forwarded-Host correctly. The intent anchor is the consistent use of `UriUtils.getBaseUri(requestUri)` across all 4 OIDC-flow handlers (Cognito, Azure, ODDIAM, Google, Github) — same helper, same pattern, no per-handler override."
- `CognitoLogoutSuccessHandler.md:implicit_adrs.[2]` (HIGH) — "The post-logout redirect URI (the `logout_uri` query parameter) is derived from the INCOMING HTTP request's base URI via `UriUtils.getBaseUri(requestUri)` rather than from operator config. The decision encodes: (a) ODD does not require operators to declare the post-logout target in ODD config — they declare it once in Cognito's 'Allowed sign-out URLs' app-client setting; (b) the platform hostname is taken from however the user reached the platform, which correctly handles multi-hostname deployments (load balancer + internal hostname) as long as Cognito's allowlist matches every external hostname; (c) the platform's path is always stripped to `/` (per `UriUtils.replacePath('/')`) — operators never need to whitelist per-page URIs in Cognito."

**Decision statement**: ODD's OAuth2 logout flow derives the post-logout redirect target (the `post_logout_redirect_uri` / `logout_uri` query parameter sent to the IdP's end-session endpoint) from the INBOUND request URI via the shared `UriUtils.getBaseUri(requestUri)` helper (UriUtils.java:11-23) — a single utility that strips path/query/fragment from the request URI and returns scheme+host+port+`/`. The decision is consistent across all 5 sibling logout handlers (Azure + Cognito + Google + GitHub + ODD_IAM) — no per-handler override; no config-derived alternative. The platform commits the operator to **trusting their reverse proxy** for Host-header authority. The architectural choices encoded:

- **(a) Operator declares the platform's external URL exactly ONCE, in the IdP's allowlist** — not duplicated in ODD config. Cognito's "Allowed sign-out URLs"; Azure App Registration's Logout URLs; Google's Authorized redirect URIs; GitHub's Authorization callback URL. The platform-side knob is the inbound Host header.
- **(b) Multi-hostname deployments work without per-hostname ODD config** — a load-balancer alias + internal hostname both reach the platform; whichever the user came in on becomes the post-logout target. This is operator-ergonomic IF the IdP allowlist matches every external hostname; it FAILS silently (or produces an IdP error page) when the hostname isn't allowlisted.
- **(c) The path is always stripped to `/`** — `UriUtils.replacePath('/')` ensures operators don't have to allowlist per-page URIs (`/dashboard`, `/lineage`, `/glossary`). Only the root URL needs to be in the IdP allowlist.
- **(d) The risk delegated to operators** — a misconfigured reverse proxy that forwards a user-controlled Host header or `X-Forwarded-Host` without sanitization propagates that into the post-logout redirect. The platform has no `WebFilter` asserting `Host == configured-hostname`, no `odd.platform-url` config to cross-check against, no per-deployment allowlist. The IdP-side allowlist is the only mitigation (Azure, Cognito, Google, GitHub all validate `post_logout_redirect_uri` against their registered URLs; an operator who registers wildcard or many URLs removes that bound).
- **(e) The deliberate-absence-of-config evidence** — Grep of `application.yml` for `platform.base-url|odd.platform-url|allowed.redirect` returns ZERO matches. The maintainer made the choice EXPLICITLY by NOT adding the config key when adding `UriUtils.getBaseUri` to 5 handlers. The intent is preserved in the shared utility's design (it accepts the request URI as input, NOT a config property).

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — 5 separate handlers (independently coded across the project's history) all consume the same `UriUtils.getBaseUri` helper, AND the helper itself was authored as a request-URI-based utility, AND no config-derived alternative exists. The convention is encoded in the helper's signature.
2. **Structural impact?** YES — affects every OAuth2 logout flow; affects the operator's IdP-side allowlist configuration; affects deployment topology (reverse-proxy Host-header policy IS part of the security architecture); affects the trust boundary between ODD and the reverse proxy.
3. **Switching to operator-configured `platform.base-url` is REFACTORING or STRUCTURAL?** STRUCTURAL — adding `odd.platform-url` would change: (i) the deployment-config surface (every operator now declares the URL in ODD AND in the IdP); (ii) the multi-hostname semantic (do operators declare a list, or one canonical URL with all-others rejected?); (iii) the validation discipline (now we cross-check Host vs config; today we trust Host). A multi-week schema change with operator migration impact, not a refactor.

**Evidence**:
- AzureLogoutSuccessHandler.java:40 (`.queryParam("post_logout_redirect_uri", UriUtils.getBaseUri(requestUri))`)
- CognitoLogoutSuccessHandler.java:43 (`.queryParam("logout_uri", UriUtils.getBaseUri(requestUri))`)
- GoogleLogoutSuccessHandler.java:40 (same idiom)
- GithubLogoutSuccessHandler.java:45 (same idiom)
- ODDIAMLogoutSuccessHandler.java (same idiom — Spring's OidcClientInitiatedServerLogoutSuccessHandler also derives the base URI from the request)
- UriUtils.java:11-23 (the shared helper — accepts request URI; strips path/query/fragment; replaces path with `/`)
- Grep `application.yml` for `platform.base-url|odd.platform-url|allowed.redirect` → ZERO matches (verified in both AzureLogoutSuccessHandler and CognitoLogoutSuccessHandler sidecars)

**Existing ADR**: none. **Composes with ADR-CANDIDATE-006** (operator-delegated network-layer auth — same shape: the platform commits the operator to the network layer for a security responsibility ODD does NOT enforce in-process). **Composes with ADR-CANDIDATE-132** (per-provider revocation strategy — the redirect URI is one half of the logout flow; revocation is the other).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-407 NEW — Azure logout no `post_logout_redirect_uri` allowlist (MEDIUM)
- REFACTOR-403 NEW — Cognito dynamic `logout_uri` allowlist coupling — multi-hostname deployments may fail (MEDIUM)

**Proposed action**: Promote to `adrs/drafts/post-logout-redirect-request-derived.md` (new ADR). Document:
- The shared `UriUtils.getBaseUri` helper as the canonical post-logout redirect source.
- The deliberate-absence of a `platform.base-url` / `odd.platform-url` config knob.
- The trust delegation: reverse proxy Host header authority + IdP-side allowlist = the security boundary.
- The multi-hostname implication: every external hostname must be in every IdP's allowlist.
- The maintainer-extension contract: any new logout handler MUST use `UriUtils.getBaseUri(requestUri)` for the post-logout redirect; the configuration-derived alternative is rejected.
- The doc-side gap: operators are not told the reverse-proxy Host-header policy is part of the security architecture; the `oauth2-oidc` live page mentions per-provider `Allowed sign-out URLs` setup but not the request-derived semantic that drives it.

**Severity rationale**: MEDIUM — operator-deployment-shaping decision. Affects every OAuth2 deployment's reverse-proxy configuration; affects the IdP allowlist semantic; not security-bypass-shaping, but reverse-proxy-trust-shaping (a misconfigured proxy converts this into REFACTOR-407 — open-redirect risk).

---

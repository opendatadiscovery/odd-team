## ADR-CANDIDATE-135 — GitHub auth handler is OAuth2 (non-OIDC) — implements `OAuthUserHandler<OAuth2User, OAuth2UserRequest>`, makes TWO outbound HTTPS calls to api.github.com (`/user/orgs` + `/user/teams`) to enrich the user with org-membership + admin-team membership; the platform's auth dispatcher has two PARALLEL handler lists (OAuth2 vs OIDC) reflecting the protocol distinction

**Severity**: HIGH
**Classification**: promote
**Pillars affected**: [P-09-security-access-control]
**Support count**: 1 sidecar (batch O GithubUserHandler) + cross-batch (OAuthSecurityConfiguration.java:79-80 declares two distinct injected `List<>` — `oauthUserHandlers` and `oidcUserHandlers` — at the architectural-split site)
**Axes present**: auth_handlers
**Batch**: O (2026-05-19)

**Surfaced by**:
- `GithubUserHandler.md:implicit_adrs.[0]` (HIGH) — "**OAuth2 (non-OIDC) for GitHub because GitHub does not federate via OIDC id_tokens.** The class implements `OAuthUserHandler<OAuth2User, OAuth2UserRequest>` (line 32) — the non-OIDC sibling interface; Google/Cognito/Azure/CustomOIDC/ODDIAM all implement `OAuthUserHandler<OidcUser, OidcUserRequest>`. The maintainer's intent: GitHub is OAuth2-only — there is no id_token, so the OAuth2User attributes are sourced from `/user` JSON, not from a JWT. The split into two interface variants at `OAuthSecurityConfiguration.java:79-80` IS the decision."
- `GithubUserHandler.md:implicit_adrs.[3]` (MEDIUM) — "**Two-pass HTTP architecture (org-then-team) instead of `GET /user` enrichment.** GitHub's `/user` endpoint does NOT return org/team membership in its default payload; the handler must make TWO subsequent calls to `/user/orgs` and `/user/teams`. The maintainer's intent: faithfully reflect GitHub's API surface — there is no shortcut. The cost (2 extra round-trips per login) is accepted; the alternative (caching membership) would introduce a cache-invalidation surface across membership changes the platform cannot observe."

**Decision statement**: ODD's GitHub OAuth2 authentication is structurally distinct from its OIDC providers (Google + Cognito + Azure + ODD_IAM + Custom-OIDC) for two reasons, codified at the architectural level:

- **(a) Protocol-level split — OAuth2 vs. OIDC** — GitHub's OAuth2 implementation does NOT issue an `id_token` (no JWT with cryptographically-verified claims); user identity is sourced from a JSON payload at `/user` via `DefaultReactiveOAuth2UserService.loadUser(request)`. ODD's auth dispatcher exposes this distinction via **TWO PARALLEL injected handler lists** at `OAuthSecurityConfiguration.java:79-80`:
  - `List<OAuthUserHandler<OAuth2User, OAuth2UserRequest>> oauthUserHandlers` — for non-OIDC providers (GitHub only today)
  - `List<OAuthUserHandler<OidcUser, OidcUserRequest>> oidcUserHandlers` — for OIDC providers (Google + Cognito + Azure + ODD_IAM + CustomOIDC)
  Each handler implements one of the two parameterised interface variants; the dispatcher routes to the matching list per-provider. The split reflects Spring Security's own type hierarchy (`OAuth2User` vs `OidcUser`) — ODD inherits the distinction rather than collapsing it.
- **(b) Two-pass HTTP architecture for org/team enrichment** — because GitHub's `/user` payload does NOT include org/team membership (in contrast to Google's id_token which carries `hd` + `email` claims, Cognito's `cognito:groups`, Azure's `groups`), the GitHub handler issues TWO ADDITIONAL outbound HTTPS calls per login: `GET https://api.github.com/user/orgs` (line 78) to verify the user belongs to `provider.getOrganizationName()`, and (conditionally, if `adminGroups` is non-empty) `GET https://api.github.com/user/teams` (line 106) to determine ADMIN role via team-name membership. The handler holds a singleton `WebClient` field-initialised at GithubUserHandler.java:39 (`WebClient.create("https://api.github.com")`) — NO `@Value` injection, NO operator-configurable endpoint (REFACTOR-390 captures the GHES incompatibility).

The architectural choices encoded:

- **(c) Per-login latency budget includes 3 sequential GitHub round-trips** — Spring's `/user` call (DefaultReactiveOAuth2UserService) + this handler's `/user/orgs` + (conditionally) `/user/teams`. Total per-login latency is bounded by the sum (~300-600ms typical; >2s during GitHub API incidents). No caching, no retry, no timeout customization — the maintainer accepts the per-login cost.
- **(d) Membership data is FRESH on every login, not cached** — consistent with the "no-cache stance across auth surface" pattern (per AuthIdentityProviderImpl batch K implicit_adrs[3]). A user whose org-membership was revoked AT GitHub sees the revocation reflected on next login; the trade-off is the per-login HTTP cost and the GitHub-API rate-limit consumption (5000 req/hr per token).
- **(e) GitHub.com only — GHES incompatible** — the hard-coded `https://api.github.com` is the design's explicit commitment. The platform supports GitHub.com OAuth2, not GitHub Enterprise Server (which uses `https://github.example.com/api/v3`). This is documented as REFACTOR-390 (gap) rather than as part of THIS ADR's intent — the maintainer didn't write a "GHES support is intentionally out of scope" comment, but neither did they parameterise the endpoint.

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — the two parallel handler lists at OAuthSecurityConfiguration.java:79-80 are the explicit architectural statement; the maintainer COULD have collapsed them into one List<OAuthUserHandler<? extends OAuth2User, ? extends OAuth2UserRequest>> with type-erasure trickery but instead expressed the distinction at the type level. The two-pass HTTP architecture is forced by GitHub's protocol — there is no shortcut.
2. **Structural impact?** YES — affects every OAuth2 deployment's choice of providers (GitHub-vs-OIDC affects latency + reliability + cache discipline); affects the architectural commitment for any future non-OIDC provider (e.g., a hypothetical `BitbucketUserHandler` would follow this pattern); affects the dispatcher contract (`oauthUserHandlers` vs `oidcUserHandlers` is two distinct lookup chains).
3. **Switching to a unified OAuth2/OIDC handler interface is REFACTORING or STRUCTURAL?** STRUCTURAL — collapsing the two lists would require either (i) generic-parameterising both protocol families' user types (lossy), or (ii) introducing an adapter layer that re-marshals OAuth2User as OidcUser (with fake id_token claims) — a structural change that adds complexity without simplifying the protocol distinction.

**Evidence**:
- GithubUserHandler.java:32 (`implements OAuthUserHandler<OAuth2User, OAuth2UserRequest>` — NOT the OIDC variant)
- OAuthSecurityConfiguration.java:79-80 (two parallel List<> injections — `oauthUserHandlers` for OAuth2 + `oidcUserHandlers` for OIDC)
- OAuthSecurityConfiguration.java:128-139 (`customOauth2UserService` — the OAuth2 dispatcher) vs. lines 115-126 (`customOidcUserService` — the OIDC dispatcher)
- GithubUserHandler.java:39 (the singleton WebClient — `WebClient.create("https://api.github.com")`)
- GithubUserHandler.java:76-85 (outbound `GET /user/orgs`)
- GithubUserHandler.java:104-113 (outbound `GET /user/teams`)
- GoogleUserHandler.java:30 (OIDC variant — `implements OAuthUserHandler<OidcUser, OidcUserRequest>` — contrast)

**Existing ADR**: none. **Composes with ADR-CANDIDATE-034** (OAuth provider-quirks strategy pattern — the chain-of-responsibility is the parent pattern; this ADR specifies how GitHub deviates structurally at the type-parameter layer). **Composes with ADR-CANDIDATE-136** (admin-principals bypass organization-name — both ADRs share the GithubUserHandler enrichment surface).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-390 NEW — GHES hard-coded api.github.com — entire class of GitHub operator silently locked out (HIGH)
- REFACTOR-391 NEW — GitHub username-rename orphans USER_OWNER_MAPPING row (HIGH; security-adjacent)
- REFACTOR-392 NEW — GitHub `/user/teams` pagination silent truncation at 30 teams (LOW)
- REFACTOR-393 NEW — GitHub no retry/timeout/rate-limit on outbound calls (LOW)
- REFACTOR-394 NEW — GitHub WebClient not Spring-managed (no proxy/pool customization) (LOW)

**Proposed action**: Promote to `adrs/drafts/github-oauth2-non-oidc.md` (new ADR). Document:
- The two parallel handler lists (OAuth2 vs OIDC) as the architectural split.
- The two-pass HTTP architecture forced by GitHub's protocol.
- The latency budget (3 sequential GitHub calls per login).
- The no-cache stance and its consequence (per-login API rate-limit consumption).
- The GHES out-of-scope (REFACTOR-390 — should be documented OR remediated).
- The maintainer-extension contract: any future non-OIDC OAuth2 provider (Bitbucket, Atlassian) follows this pattern.

**Severity rationale**: HIGH — protocol-distinction-architecture decision. Affects every GitHub deployment's per-login latency profile, reliability surface, and rate-limit budget. The 3-call-per-login pattern is the architectural commitment; future maintainers must understand it to add Okta-via-GitHub-as-OAuth2 or similar non-OIDC providers.

---

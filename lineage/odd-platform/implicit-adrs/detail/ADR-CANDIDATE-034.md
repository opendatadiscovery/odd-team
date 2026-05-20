- **ADR-CANDIDATE-034** (NEW 2026-05-12C): OAuth2 provider-specific quirks are handled via two intentional patterns: (a) URL-mutation of the Spring `ClientRegistration` for Google `allowedDomain` (append `?hd={domain}` to `authorizationUri`); (b) a chain-of-responsibility strategy for per-provider user-enrichment + logout via `oauthUserHandlers : List<OAuthUserHandler>` + `oidcUserHandlers : List<OidcUserHandler>` + `*LogoutSuccessHandler` chain — each implementation declares `shouldHandle(provider)` for its provider key. The pattern allows new providers to plug in via Spring `@Component` registration without modifying the central config class
  - **Category**: promote
  - **Support**: surfaced by 2 implicit-ADRs in 1 sidecar (`OAuthSecurityConfiguration.auth.type@L71`); cross-validated by the existence of `auth/handler/impl/GoogleUserHandler.java`, `auth/handler/impl/GithubUserHandler.java`, `auth/logout/*LogoutSuccessHandler.java` files (Cognito + Google + GitHub + Azure + ODD_IAM + default OIDC) — the chain has 5+ active implementations, demonstrating the pattern at scale
  - **Surfaced by**:
    - `odd-platform__java__OAuthSecurityConfiguration__config-key-consumer__auth_type@L71.md:implicit_adrs.[2]` ("Google-specific `allowedDomain` augmentation is implemented by URL-mutating the authorization URI to append `?hd={domain}` (line 168-175). The decision is to handle provider-specific OAuth2 quirks via in-code branches inside the client registration loop rather than via per-provider beans.")
    - `odd-platform__java__OAuthSecurityConfiguration__config-key-consumer__auth_type@L71.md:implicit_adrs.[4]` ("User identity is enriched per provider via a strategy pattern: `oauthUserHandlers` and `oidcUserHandlers` are injected as `List<...>` (lines 79-80); each handler's `shouldHandle(provider)` returns true for its provider key.")
  - **Decision statement**: OAuth provider-specific quirks compose via two intentional patterns: (a) **inline URL mutation** for ClientRegistration-level customisations (the `Provider.GOOGLE.name()` branch at OAuthSecurityConfiguration.java:168-175 appends `?hd={domain}` to the authorization URI for Google Workspace domain restriction); (b) **chain-of-responsibility strategy** for per-provider user-enrichment and logout (`oauthUserHandlers : List<OAuthUserHandler>` + `oidcUserHandlers : List<OidcUserHandler>` + `auth/logout/*LogoutSuccessHandler.java` collection). Each strategy implementation declares `shouldHandle(String provider) : boolean` (`OAuthUserHandler.java:7-11`); the central `OAuthLogoutSuccessHandler` and the OAuth2/OIDC user services iterate the lists and dispatch to the first match. The trade-off: inline-mutation works for one-line customisations (Google's `?hd=` query parameter) and avoids a strategy-class explosion; the chain-of-responsibility works for richer per-provider logic (custom logout endpoints, user-info enrichment). The result is a hybrid pattern — the inline branch in `mapToClientRegistration` (line 168) is the canonical exception, all other per-provider logic flows through the chain. New providers (Okta, Keycloak per docs) get the OIDC-generic path automatically through Spring; provider-specific behaviour requires adding a handler class.
  - **Wisdom test**: PASS. The strategy chain has 5+ active implementations across user-handler + logout-handler axes — well above the "single sidecar surfaces an idea" threshold. The inline URL mutation IS the canonical exception (one Google-specific line), and the maintainer's choice to inline rather than factor a `GoogleClientRegistrationCustomizer` strategy is consistent with the "one-line customisations stay inline" rule. Structural for every future provider addition (Okta + Keycloak per docs are mentioned but not given strategy-class implementations — REFACTOR-113 captures this drift).
  - **Evidence**:
    - OAuthSecurityConfiguration.md says: "OAuthSecurityConfiguration.java:168-175 (if (provider.getProvider().equalsIgnoreCase(Provider.GOOGLE.name()) && StringUtils.isNotEmpty(provider.getAllowedDomain()))) — the inline URL mutation"
    - OAuthSecurityConfiguration.md says: "OAuthSecurityConfiguration.java:79-80 + OAuthSecurityConfiguration.java:118-138 + OAuthUserHandler.java:7-11 — the strategy chain"
    - OAuthSecurityConfiguration.md says: "Bash find <odd-platform-repo> -path '*auth/handler/impl*' -name '*.java' returning GoogleUserHandler.java + GithubUserHandler.java + find -path '*auth/logout*' -name '*LogoutSuccessHandler.java' returning Azure/Cognito/Google/GitHub/ODDIAM/default"
  - **Existing ADR**: none.
  - **Co-surfaced gaps** (link from `refactoring-scopes.md`): REFACTOR-113 (Okta + Keycloak per live docs have no user-handler / logout-handler implementations — operators following the docs get OIDC-generic fallback only; HIGH doc-vs-code drift).
  - **Proposed action**: Promote to `adrs/drafts/oauth-provider-quirks-pattern.md` (new ADR). Document the hybrid pattern: inline-for-trivial-customisations + chain-of-responsibility-for-rich-per-provider-logic. Cross-link with REFACTOR-113 — the gap is that Okta + Keycloak operators following the docs receive the OIDC-generic path with no provider-specific enrichment, which is a documentable consequence of the strategy pattern (and arguably needs handler implementations or doc clarification).
  - **Severity rationale**: MEDIUM — pattern-shaping decision; affects how every future OAuth provider is integrated.

---

## STRENGTHENED — Batch O (2026-05-19) — 5 new sidecars across the OAuth provider-quirks surface confirm the chain-of-responsibility pattern at deep scale

**Batch O adds 5 sidecars that surface ADR-CANDIDATE-034's chain-of-responsibility pattern from previously-unobserved provider angles**: AzureLogoutSuccessHandler + CognitoLogoutSuccessHandler (logout-handler axis); GoogleUserHandler + GithubUserHandler (user-handler axis); IngestionDataEntitiesFilter (orthogonal — not directly OAuth but consumes the same provider-vocabulary). Each new sidecar reaffirms the chain-of-responsibility's central pattern AND adds a unique facet:

- **AzureLogoutSuccessHandler.md:implicit_adrs.[1]** ("Provider routing uses chain-of-responsibility with `shouldHandle(provider)` returning boolean from each implementation") — confirms the dispatcher pattern at the LOGOUT axis; the `OAuthLogoutSuccessHandler.java:44-48` filters `List<LogoutSuccessHandler>` by `shouldHandle(provider)` and picks the matching sibling. Same idiom as OAuthSecurityConfiguration.java:185-201 (user-handler dispatch).
- **CognitoLogoutSuccessHandler.md:implicit_adrs.[0]** ("The ODD logout chain uses an internal `LogoutSuccessHandler` interface with provider-routing semantics (`shouldHandle(String provider)`) rather than relying on Spring Security's `OidcClientInitiatedServerLogoutSuccessHandler` for every provider") — surfaces a NEW facet: the chain is a **superset** of Spring's default OIDC-initiated logout, not a replacement. Cognito's `/logout` is NOT OIDC-compliant (accepts `logout_uri` + `client_id`, not the OIDC-standard `id_token_hint` + `post_logout_redirect_uri`) — so the maintainer had to invent the per-provider chain. Spring's default handler remains the fallback for OIDC-compliant providers (`defaultOidcLogoutHandler` at OAuthSecurityConfiguration.java:180-183).
- **GoogleUserHandler.md** (multiple ADRs) — Google diverges from `AbstractOIDCUserHandler` (no inheritance); the per-provider chain hosts BOTH abstract-base-inheriting handlers (Cognito + Azure + Custom-OIDC) AND fully-bespoke handlers (Google + ODD_IAM). The chain-of-responsibility pattern is the upper layer; the EXTEND-or-bespoke rule (ADR-CANDIDATE-137 NEW) is the inner detail.
- **GithubUserHandler.md** (multiple ADRs) — GitHub is the ONLY non-OIDC handler in the chain; the dispatcher exposes TWO PARALLEL lists (`oauthUserHandlers` vs `oidcUserHandlers`) at OAuthSecurityConfiguration.java:79-80 to express the protocol distinction. This is the PROTOCOL-LEVEL split within the broader chain-of-responsibility pattern. ADR-CANDIDATE-135 NEW codifies the protocol-distinction architecture; this ADR is the parent.
- **IngestionDataEntitiesFilter.md** — orthogonal context: while not an OAuth handler, the IngestionDataEntitiesFilter consumes the same WebFlux WebFilter pattern with a per-path matcher constructor — same architectural shape as the per-provider chain-of-responsibility. The maintainer's broader pattern is "dedicated WebFilter / dispatcher per concern, with per-provider/per-path strategy implementations."

**Updated support count**: now **6+ sidecars triangulated** (1 original OAuthSecurityConfiguration + 5 batch O — the 5 batch O sidecars each independently reaffirm the chain-of-responsibility pattern from distinct surface angles).

**Cross-handler matrix (updated)** — the chain hosts BOTH OAuth2 + OIDC handlers across user-enrichment + logout axes:

| Provider | User-handler interface | User-handler class | Extends abstract base? | Logout-handler class | Active revocation? |
|---|---|---|---|---|---|
| Cognito | OIDC | CognitoUserHandler | YES | CognitoLogoutSuccessHandler | NO (end-session only) |
| Azure | OIDC | AzureUserHandler | YES | AzureLogoutSuccessHandler | NO (Azure AD v2.0 lacks RFC 7009) |
| Google | OIDC | GoogleUserHandler | NO (bespoke per ADR-CANDIDATE-137) | GoogleLogoutSuccessHandler | YES (POST `/revoke`) |
| GitHub | OAuth2 (non-OIDC) | GithubUserHandler | N/A (protocol-distinct) | GithubLogoutSuccessHandler | YES (DELETE `/applications/{client_id}/grant`) |
| ODD_IAM | OIDC | ODDIAMUserHandler | NO (bespoke; flag-based admin) | ODDIAMLogoutSuccessHandler | NO (issuer-end-session) |
| Custom OIDC | OIDC | CustomOIDCUserHandler | YES (catch-all) | (default OIDC fallback) | NO (OIDC end-session) |

**New child ADRs surfaced in batch O** (the chain-of-responsibility is the parent; each child ADR specifies a refinement):
- ADR-CANDIDATE-132 NEW (per-provider revocation strategy — Google/GitHub explicit vs. Cognito/Azure/ODDIAM end-session-only)
- ADR-CANDIDATE-133 NEW (post-logout redirect URI inbound-request-derived — cross-handler convention)
- ADR-CANDIDATE-134 NEW (Google two-layer hd-claim defence-in-depth — the canonical inline-URL-mutation + handler-side-check example)
- ADR-CANDIDATE-135 NEW (GitHub OAuth2-non-OIDC + two-pass HTTP — the protocol distinction within the chain)
- ADR-CANDIDATE-136 NEW (admin-principals BYPASS organization-name — precedence rule for GitHub handler)
- ADR-CANDIDATE-137 NEW (extend-or-bespoke rule for OIDC handlers — the inheritance decision tree)

**Co-surfaced gaps newly confirmed by batch O**:
- REFACTOR-113 (existing — Okta + Keycloak no provider-specific enrichment) — STRENGTHENED: the chain-of-responsibility pattern has 5+ active provider implementations; missing Okta/Keycloak handlers means those operators inherit the OIDC-generic fallback only.
- REFACTOR-155 (existing — Azure logoutUri NPE) — STRENGTHENED with batch O file:line evidence from the AzureLogoutSuccessHandler consumer site.

**Severity unchanged at MEDIUM**: the pattern is pattern-shaping (every future OAuth provider is integrated through this chain), not security-architecture-defining. The HIGH-severity children (ADR-CANDIDATE-132, -134, -135, -138, -139) cover the security-impact-load-bearing aspects within the broader pattern.

---

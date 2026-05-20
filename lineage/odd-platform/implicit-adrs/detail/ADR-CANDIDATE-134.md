## ADR-CANDIDATE-134 — Google `hd`-claim domain enforcement is two-layer defence-in-depth — (1) URL hint via `?hd={domain}` mutation on the authorize endpoint to steer Google's account-picker, (2) ID-token `hd` claim re-verification on callback to actually enforce the restriction. The first is UX; the second is security; the maintainer deliberately did not trust the URL-mutation alone

**Severity**: HIGH
**Classification**: promote
**Pillars affected**: [P-09-security-access-control]
**Support count**: 1 sidecar (batch O GoogleUserHandler — single-sidecar but the pattern is reusable for any future provider; load-bearing security-architecture decision per the unique-load-bearing classification rationale)
**Axes present**: auth_handlers
**Batch**: O (2026-05-19)

**Surfaced by**:
- `GoogleUserHandler.md:implicit_adrs.[0]` (HIGH) — "**Google `allowed-domain` enforces via two-layer defence-in-depth: (1) URL hint `?hd={domain}` at the authorize endpoint, (2) hd-claim re-verification on the ID-token.** The first layer steers Google's account picker (UX); the second layer is the actual enforcement that survives URL editing. The maintainer's intent is to NOT trust the URL-mutation alone — the explicit hd-claim check at lines 49-55 is the defence-in-depth instance. Per ADR-CANDIDATE-034 (the inline-URL-mutation-for-trivial-customisations pattern), the URL mutation is a one-line customisation; per THIS sidecar, the handler-side verification is the load-bearing security check."

**Decision statement**: ODD's Google Workspace `allowed-domain` enforcement is a **two-layer defence-in-depth**:

- **Layer 1 — URL mutation** at `OAuthSecurityConfiguration.java:168-175`: when `provider.getProvider() == "GOOGLE"` AND `provider.getAllowedDomain()` is non-empty, the `authorizationUri` on the Spring `ClientRegistration` is mutated to append `?hd={allowedDomain}`. Google's authorize endpoint reads `hd` as a hint and STEERS the account-picker — users see only accounts in the configured domain. This is a UX hint to Google's IdP; it does NOT enforce the restriction (a user with a personal `@gmail.com` account can edit the URL to remove `?hd=` and still attempt authentication).
- **Layer 2 — Token-claim re-verification** at `GoogleUserHandler.java:49-55`: AFTER Google's IdP issues the ID-token, the handler reads `token.getClaim("hd")` and rejects via `OAuth2AuthenticationException("invalid_token", "Domain X doesn't match with allowed domain Y")` when the claim does not case-insensitively match `provider.getAllowedDomain()`. The `hd` claim is Google's documented OIDC custom claim, emitted ONLY for Workspace (G Suite) accounts. Personal `@gmail.com` accounts have NO `hd` claim → the check fails (intentionally rejecting personal accounts under an allowedDomain'd configuration).

The architectural choices encoded:

- **(a) URL-hint vs. token-verification serve DIFFERENT roles** — Layer 1 is UX (improves the operator's user-experience by hiding non-domain accounts in the picker); Layer 2 is SECURITY (the actual enforcement that survives URL editing). The maintainer deliberately wrote BOTH; trusting only Layer 1 would be a security failure (URL editing bypasses it); trusting only Layer 2 would be a UX failure (users see every Google account in the picker before being rejected).
- **(b) The pattern is REUSABLE for any future provider** that emits a verifiable token claim corresponding to a URL-side hint. Composes with ADR-CANDIDATE-034 (provider-quirks strategy) — the URL-mutation site is the canonical "trivial inline customisation"; the handler-side check is the "rich per-provider strategy."
- **(c) The hd-claim is OPTIONAL on Google ID-tokens** — only present for Workspace accounts. The handler's case-insensitive comparison evaluates `!StringUtils.equalsIgnoreCase(allowedDomain, null) = true` when the claim is missing → REJECT. The behaviour is INTENTIONALLY restrictive: only Workspace users from the configured domain authenticate.
- **(d) The rejection vector is a structured `OAuth2AuthenticationException`** — `OAuth2Error("invalid_token", ...)` flows through Spring's reactive error chain and surfaces as a 401-style redirect to the OAuth2 error page. The error message literally interpolates the user's `hd` value (or `null` for personal accounts) and the operator's `allowedDomain` — this is REFACTOR-397 (UX gap) but the rejection itself is correct.

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — the two-layer pattern is explicit: layer 1 is a one-line URL-mutation that the maintainer wrote ALONGSIDE the layer 2 handler-side check. The maintainer COULD have written only one; they wrote both. The intent is to combine UX + security. The Google handler is the ONLY OIDC handler that bypasses `AbstractOIDCUserHandler` (see ADR-CANDIDATE-134's sibling reference) PRECISELY because the abstract base does not support this two-layer pattern.
2. **Structural impact?** YES — affects how operators audit the security posture (the two layers must BOTH be in place for the domain restriction to hold); affects the maintainer-extension contract (any future provider with a similar domain-restriction claim — e.g., Okta's `email_domain`, Microsoft's `tid` for tenant — should follow this two-layer pattern); affects the operator-debug story (a deployment where the URL-mutation is removed but the handler-check remains is SAFE; the reverse is NOT).
3. **Switching to single-layer enforcement is REFACTORING or STRUCTURAL?** STRUCTURAL — dropping Layer 1 would degrade UX (users see non-domain accounts); dropping Layer 2 would degrade security (URL-editing bypass). Either single-layer choice changes the security guarantee in operator-visible ways. The two-layer pattern IS the architecture; collapsing it is a structural change.

**Evidence**:
- GoogleUserHandler.java:49-55 (the layer-2 `hd`-claim re-verification — `if (StringUtils.isNotEmpty(provider.getAllowedDomain()) && !StringUtils.equalsIgnoreCase(provider.getAllowedDomain(), domain)) { return Mono.error(() -> new OAuth2AuthenticationException(new OAuth2Error("invalid_token", ...))); }`)
- OAuthSecurityConfiguration.java:168-175 (the layer-1 URL-mutation — `if (provider.getProvider().equalsIgnoreCase(Provider.GOOGLE.name()) && StringUtils.isNotEmpty(provider.getAllowedDomain())) { client.providerDetails().authorizationUri(authUri + "?hd=" + provider.getAllowedDomain()); }`)
- GoogleUserHandler.java:32 (the literal `GOOGLE_DOMAIN = "hd"` — the claim name as a constant)
- WebFetch `/configuration-and-deployment/enable-security/authentication/oauth2-oidc` 2026-05-19 status 200: "allowed-domain — You can restrict users to login under your organization domain" (operator-facing description silent on the underlying `hd` claim mechanism — REFACTOR — operator-docs gap, not a code gap)

**Existing ADR**: none. **Composes with ADR-CANDIDATE-034** (OAuth provider-quirks strategy pattern — Layer 1 is the canonical inline-URL-mutation site; Layer 2 is the chain-of-responsibility handler-side enrichment). **Composes with ADR-CANDIDATE-035** (fail-closed `GrantedAuthoritiesMapper` — the rejection in this ADR is the fail-CLOSED security stance applied to domain-restricted Google).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-397 NEW — Google personal-account rejection emits literal `null` in error message (LOW UX)
- (Doc-side) — Live docs do not explain the two-layer mechanism; operators auditing the security posture have no doc surface explaining where the enforcement actually happens

**Proposed action**: Promote to `adrs/drafts/google-hd-claim-two-layer-defence-in-depth.md` (new ADR). Document:
- Layer 1: URL mutation as UX hint at `OAuthSecurityConfiguration.java:168-175`.
- Layer 2: ID-token claim re-verification at `GoogleUserHandler.java:49-55`.
- The trade-off explicit: trusting only Layer 1 → URL-editing bypass; trusting only Layer 2 → bad UX. Both must be present.
- The personal-account rejection-by-design (Workspace-only authentication).
- The maintainer-extension contract: any future provider with a domain-restriction-like claim follows this pattern.
- The doc-side gap: operators should know the `hd` claim IS the underlying mechanism; the live page should name it.

**Severity rationale**: HIGH — security-architecture-defining decision. The single-sidecar status is offset by the LOAD-BEARING nature of the pattern: a future Okta/Keycloak handler with `email_domain` semantics SHOULD follow this pattern; a future Microsoft-Entra-tenant restriction handler SHOULD follow this pattern. The ADR codifies the canonical example for the pattern's reuse. Per the system-prompt unique-load-bearing classification: single-sidecar deliberate-architecture decisions are HIGH-severity when they define a reusable pattern.

---

## ADR-CANDIDATE-137 — Google handler DIVERGES from `AbstractOIDCUserHandler` base class (no inheritance) — when 2+ provider-quirks accumulate beyond the abstract base's template-method extension points, the handler is fully bespoke. The maintainer accepted code duplication (admin-attribute fallback + userNameAttribute resolution + admin-group ABSENCE) to express Google-specific behaviour without forcing the abstract base to support hd-claim verification

**Severity**: MEDIUM
**Classification**: promote
**Pillars affected**: [P-09-security-access-control]
**Support count**: 1 sidecar (batch O GoogleUserHandler) + cross-batch (Cognito + Azure + Custom-OIDC + ODD_IAM all extend `AbstractOIDCUserHandler` per their respective sidecars or class-files; GoogleUserHandler is the ONLY OIDC handler that bypasses the abstract base)
**Axes present**: auth_handlers
**Batch**: O (2026-05-19)

**Surfaced by**:
- `GoogleUserHandler.md:implicit_adrs.[2]` (HIGH) — "**Google handler diverges from the AbstractOIDCUserHandler base class (no inheritance) — provider-specific quirks override generic-OIDC patterns.** Cognito, Azure, Custom all extend `AbstractOIDCUserHandler` (cognito/azure: just override two `getDefault*` template methods; custom: catches the not-in-Provider-enum case). Google does NOT extend the abstract base. The reasons (inferred from the divergence): (a) Google's hd-claim verification has no analogue in the abstract base; (b) Google's userNameAttribute is read from Spring's ClientRegistration not the ODD POJO (lines 66-68); (c) Google's admin-attribute defaults to `email`, not userNameAttributeName; (d) Google's logout path POSTs to `oauth2.googleapis.com/revoke` (GoogleLogoutSuccessHandler.java) which is a Google-API-specific call. The maintainer's intent: Google's provider-specific quirks accumulated beyond the abstract base's template-method extension points, so the handler is fully bespoke."
- `GoogleUserHandler.md:implicit_adrs.[1]` (HIGH) — "**Google `admin-attribute` defaults to `email` (provider-specific), NOT to the username attribute (the abstract base's default).** Per line 58... Per AbstractOIDCUserHandler.java:34-35: `final String adminPrincipalAttribute = StringUtils.isNotEmpty(provider.getAdminAttribute()) ? provider.getAdminAttribute() : userNameAttributeName;`. The maintainer's intent: for Google, the stable admin-matching identifier is `email` (verified Workspace email), not the OIDC `sub` (which is opaque). The provider-specific default IS the decision — emails are the operator's natural admin list (consistent with `admin-principals: john@odd.com,david@odd.com` in the live doc example). This is the per-provider-knowledge codified."

**Decision statement**: ODD's per-provider OAuth2/OIDC handler pattern has a **WHEN-to-extend rule**: when a provider has 0-1 quirks beyond the OIDC-generic pattern, the handler EXTENDS `AbstractOIDCUserHandler` and OVERRIDES the two template methods (`getDefaultAdminAttribute()` + `getDefaultUserNameAttribute()`); when a provider has 2+ quirks beyond the abstract base's extension points, the handler is FULLY BESPOKE (implements the interface directly).

The decision matrix as evidenced by the codebase:

| Provider | Handler class | Inherits? | Quirks count | Rationale |
|---|---|---|---|---|
| Cognito | `CognitoUserHandler` | `extends AbstractOIDCUserHandler` | 1 (cognito:username userNameAttribute) | Standard OIDC; abstract base sufficient |
| Azure | `AzureUserHandler` | `extends AbstractOIDCUserHandler` | 1 (oid-claim adminAttribute) | Standard OIDC; abstract base sufficient |
| ODD_IAM | `ODDIAMUserHandler` | does NOT extend (verified bespoke) | 2+ (flag-based admin) | Sufficient quirks; bespoke |
| Custom OIDC | `CustomOIDCUserHandler` | `extends AbstractOIDCUserHandler` | 0 (catch-all) | Catch-all for not-in-Provider-enum providers; abstract base provides the OIDC-generic path |
| Google | `GoogleUserHandler` | does NOT extend (bespoke) | 4 (hd-claim, admin-attribute=email default, userNameAttribute via ClientRegistration not POJO, admin-groups absence) | Too many quirks for the abstract base's extension points |
| GitHub | `GithubUserHandler` | OAuth2 (non-OIDC; separate interface) | N/A (different protocol; see ADR-CANDIDATE-135) | Protocol-level distinction; no shared abstract base |

The architectural choices encoded:

- **(a) The abstract-base extension contract is INTENTIONALLY NARROW** — `AbstractOIDCUserHandler.java:33-43` exposes only two template methods (`getDefaultAdminAttribute()` returning the per-provider admin-attribute default + a userNameAttribute reader). Providers with quirks beyond these two slots must go bespoke. The maintainer DID NOT widen the abstract base to support Google's hd-claim verification — that would have made the abstract base's API responsibility creep across providers.
- **(b) Code duplication is ACCEPTED as the price of provider-specificity** — GoogleUserHandler.java:56-65 (the admin-principals containment check) mirrors AbstractOIDCUserHandler.java:33-43; the maintainer copied the small logic block rather than forcing the abstract base to absorb Google-specific branches.
- **(c) The per-provider default values are encoded as CONSTANTS in the bespoke handler** — `GOOGLE_EMAIL = "email"` (line 31), `GOOGLE_DOMAIN = "hd"` (line 32). The constants make the provider-specific defaults greppable and reviewable.
- **(d) The maintainer-extension contract for future providers**: 0-1 quirks → extend `AbstractOIDCUserHandler` + override the two template methods; 2+ quirks → bespoke. The decision tree is implicit but consistently followed across 4 OIDC providers + Google + GitHub.

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — Google has 4 distinct quirks (hd-claim verification + admin-attribute=email-default + userNameAttribute-via-ClientRegistration + admin-groups absence), each beyond the abstract base's two-template-method extension points. The maintainer COULD have widened the abstract base; they chose bespoke. The intent is to keep the abstract base narrow.
2. **Structural impact?** YES — affects every future OAuth/OIDC provider's class shape (extend-or-bespoke decision); affects the maintainer-extension contract; affects the test-surface (bespoke handlers need their own test class; extension-based handlers can share a base test).
3. **Switching to a unified abstract base (force Google to extend) is REFACTORING or STRUCTURAL?** STRUCTURAL — widening `AbstractOIDCUserHandler` to support Google's quirks (hd-claim verification + ClientRegistration-derived userNameAttribute + admin-groups-absent variant) would require 4+ new template methods + cross-provider conditional logic + a flag indicating which quirks each provider needs. The abstract base would become a Swiss-army-knife of OIDC-quirk handling — exactly what the bespoke-Google decision avoids.

**Evidence**:
- GoogleUserHandler.java:30 (`implements OAuthUserHandler<OidcUser, OidcUserRequest>` — direct interface, NO `extends AbstractOIDCUserHandler`)
- CognitoUserHandler.java:16 (`extends AbstractOIDCUserHandler`) — contrast
- AzureUserHandler.java:16 (`extends AbstractOIDCUserHandler`) — contrast
- CustomOIDCUserHandler.java:19 (`extends AbstractOIDCUserHandler`) — contrast
- AbstractOIDCUserHandler.java:21-64 (the abstract-base contract — two template methods + a shared enrichment skeleton)
- GoogleUserHandler.java:31, 32 (the named constants `GOOGLE_EMAIL` + `GOOGLE_DOMAIN` — provider-specific defaults greppable in code)
- GoogleUserHandler.java:56-65 (the admin-principals check — mirrors AbstractOIDCUserHandler.java:33-43 by copy, not inheritance)
- GoogleUserHandler.java:66-68 (the userNameAttribute resolution via Spring's ClientRegistration, NOT the abstract base's POJO-field convention)

**Existing ADR**: none. **Composes with ADR-CANDIDATE-034** (OAuth provider-quirks strategy pattern — this ADR specifies the WHEN-to-go-bespoke rule within the strategy chain). **Composes with ADR-CANDIDATE-137 sibling ADR-CANDIDATE-134** (Google two-layer hd-claim defence — the SPECIFIC quirk that drove Google to bespoke).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-395 NEW — Google admin-groups silently no-op (silent feature ignored) (MEDIUM) — operator-mental-model violation; the POJO field binds but the handler doesn't read it
- REFACTOR-399 NEW — Google userNameAttribute resolution path inconsistent vs. siblings (LOW) — architectural irregularity surfaced by this ADR

**Proposed action**: Promote to `adrs/drafts/oauth-handler-extend-or-bespoke-rule.md` (new ADR). Document:
- The decision tree: 0-1 quirks → extend abstract base; 2+ quirks → bespoke.
- The abstract base's INTENTIONALLY narrow contract (two template methods).
- The maintainer-extension contract for future providers (Okta/Keycloak): decide extend-or-bespoke based on quirk count.
- The trade-off: code duplication accepted in exchange for narrow abstract base.
- The provider-by-provider matrix (Cognito/Azure/Custom-OIDC extend; Google/ODD_IAM bespoke).

**Severity rationale**: MEDIUM — pattern-shaping decision. Affects every future OAuth2/OIDC provider's class shape and inheritance choice; affects the test-surface contract; affects the maintainer-extension contract. Composes tightly with ADR-CANDIDATE-034 (the parent provider-quirks pattern) by specifying the inheritance-or-bespoke rule.

---

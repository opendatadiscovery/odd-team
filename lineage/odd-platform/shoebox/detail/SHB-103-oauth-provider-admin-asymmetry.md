# SHB-103 — Per-provider admin-grant inconsistency across OAuth2 handlers

**Category**: merged
**Severity**: MEDIUM

## Hypothesis

Operators configuring multiple OAuth2 IDPs (Google, GitHub, Cognito, Azure, ODD_IAM, plus generic OIDC for Okta/Keycloak) see materially different admin-detection behaviours per provider — different fallback claims, different group-vs-principal support, different bypass semantics, and silent no-ops where an operator copying configuration from one provider expects the same behaviour on another. The feature is not "OAuth login" (the spec-only surface) but the **operator-observable provider-quirks matrix** that determines which configured `admin-groups` / `admin-principals` / `admin-attribute` / `allowed-domain` lines actually take effect.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/handler/impl/GoogleUserHandler.java:1-74` — Google handler does NOT extend `AbstractOIDCUserHandler` (every other OIDC handler does); silently IGNORES `admin-groups` config; defaults `admin-attribute` to literal `'email'` (line 31 `GOOGLE_EMAIL`), NOT to userNameAttribute. ODDOAuth2Properties.OAuth2Provider exposes `adminGroups: Set<String>` (`ODDOAuth2Properties.java:49`) so the field BINDS successfully from `auth.oauth2.client.google.admin-groups: [...]` — operator-hostile silent no-op.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/handler/impl/GithubUserHandler.java:54-67` — GitHub admin-principals fast-path BYPASSES the `organization-name` org-gate: `adminPrincipals: [external-consultant]` grants ADMIN to a user NOT in the org. Lines 78-81 + 106-113 — two outbound HTTPS calls per login (`/user/orgs` + `/user/teams`) against a hard-coded `https://api.github.com` (line 39); GitHub Enterprise Server CANNOT use the handler.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/config/OAuthSecurityConfiguration.java:168-175` — Google `allowedDomain` URL-mutates the authorize endpoint to append `?hd={domain}`; behaviour fired only when `Provider.GOOGLE.name()` equalsIgnoreCase. Setting `allowed-domain` on ANY non-Google provider silently has no effect.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/Provider.java:3-5` — Five values: `COGNITO, GITHUB, GOOGLE, ODD_IAM, AZURE`. Live OAuth2/OIDC docs (WebFetched 2026-05-12) document SEVEN providers including Okta + Keycloak + Custom OIDC — those three providers authenticate via generic OIDC discovery but get NO provider-specific enrichment (no admin-group mapping, no per-provider claim handling).
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/handler/impl/AbstractOIDCUserHandler.java:33-55` — abstract base used by Cognito/Azure/CustomOIDC/ODDIAM. `admin-attribute` defaults to `userNameAttribute` (NOT email); `admin-groups` IS consulted via `provider.getAdminGroups()`. Two distinct admin-detection vocabularies across the handler set.
- WebFetched 2026-05-19 live OAuth2/OIDC docs verbatim: "Default admin-attribute: Not specified ... admin-groups Support: Not mentioned for Google. Admin group functionality (admin-groups) is documented for AWS Cognito and GitHub only, not for Google." Docs partially codify the provider-quirks matrix but never name it as such.

## Notes

- This is a candidate for **a NEW F-NNN feature**: "OAuth Provider Admin-Detection Matrix" — a cross-cutting feature that names the five-by-five operator surface (5 providers × 5 admin-detection knobs: `allowed-domain` / `admin-attribute` / `admin-principals` / `admin-groups` / `organization-name`) where the actual behaviour diverges silently.
- Cross-link with F-034 (platform feature-flag exposure) — the divergence is undocumented even though `/api/appInfo` exposes which auth mode is active. The provider-quirks matrix is currently knowable only by reading every handler's source.
- The Google handler's `userNameAttribute` resolution path is ALSO divergent: it reads `request.getClientRegistration().getProviderDetails().getUserInfoEndpoint().getUserNameAttributeName()` (Spring auto-discovery from `issuer-uri`) — every OTHER handler reads `provider.getUserNameAttribute()` from the POJO directly. Sibling divergence, same root cause.
- Caveat: an operator running `auth.oauth2.client.google.admin-groups: [workspace-admins]` after seeing this configured for Cognito/GitHub gets ZERO behaviour change AND ZERO boot warning AND ZERO log line. The user expected to be admin remains USER; admin-gated UI controls are blocked; the operator's mental model breaks silently.
- Caveat (`CustomOIDCUserHandler.shouldHandle` at lines 28-34 returns true for ANY provider NOT in the Provider enum) — the chain dispatcher's `shouldHandle` first-match-wins (`OAuthSecurityConfiguration.java:185-197`) depends on Spring's `List<>` ordering with no `@Order`. A future maintainer adding an `OktaUserHandler` requires understanding the dispatch fragility.
- Drift facet: docs CLAIM Okta + Keycloak are first-class providers. Code shows ONLY Google + GitHub have provider-specific user-enrichment handlers; ONLY Cognito + Google + GitHub + Azure + ODD_IAM have logout handlers. Okta + Keycloak fall back to generic OIDC user service + `defaultOidcLogoutHandler` only.

## Next

1. Verify the silent `admin-groups` no-op for Google end-to-end via a probe (`auth.oauth2.client.google.admin-groups: [admins]` configured; user IS in the IdP's `admins` Google group; resulting authority is `USER`, not `ADMIN`).
2. Read `CognitoUserHandler.java` + `AzureUserHandler.java` + `ODDIAMUserHandler.java` to triangulate the full admin-detection matrix and confirm which providers honour which knobs.
3. Promote to `F-NNN — OAuth Provider Admin-Detection Matrix` with `seeded_from: SHB-103` and `primary_subject: [GoogleUserHandler, GithubUserHandler, AbstractOIDCUserHandler, CognitoUserHandler, AzureUserHandler, ODDIAMUserHandler, CustomOIDCUserHandler, ODDOAuth2Properties, OAuthSecurityConfiguration]`. Test matrix: per-provider behaviour matrix integration tests under `auth.type=OAUTH2`.
4. File DOC-NNN for the missing provider-quirks matrix table in the live OAuth2/OIDC docs page.

## Links

- cluster_with: [F-011, F-034]
- merged_into: F-084
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: graduated — operator-observable matrix is genuinely new feature shape (5 providers × 5 admin-detection knobs); F-011 carries per-quirk facets but no F-NNN names the matrix as a coherent surface. Minted F-084 at lineage/odd-platform/feature-flows/detail/F-084.yaml (P-09:F-004 OAuth Provider Admin-Detection Matrix), cross-link with F-011 in both directions.

---
doc_page: "docs/configuration-and-deployment/enable-security/authentication/oauth2-oidc.md"
page_title: "OAUTH2/OIDC"
live_url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/oauth2-oidc"
live_url_verified_status: "200"
live_url_resolved_slug: "configuration-and-deployment/enable-security/authentication/oauth2-oidc"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "Auth Mode"
    - "OAuth Provider-Quirks Strategy Pattern"
    - "admin-groups silent no-op (asymmetric provider support)"
    - "admin-principals bypass organization-name gate"
    - "Logout-side token revocation (asymmetric defence-in-depth)"
  features:
    - "F-084"
    - "F-086"
    - "F-124"
  code_nodes:
    - "odd-platform java org.opendatadiscovery.oddplatform.auth config-properties-class:ODDOAuth2Properties"
    - "odd-platform java OAuthSecurityConfiguration config-key-consumer:auth.type@L71"
audience: [operator]
doc_claim_vs_code:
  - "Page (Github section) claims the GitHub handler hard-codes `https://api.github.com` for `/user/orgs` + `/user/teams` and GHES is unsupported. NOT CONFIRMABLE in substrate: no GithubUserHandler CodeNode is scaffolded and no confirmed invariant carries the api.github.com hard-coding evidence; the admin-principals-bypass invariant cites GithubUserHandler.java:54-67 (principals match) + line 68 (organization-name check) but not the org/team base-URL constant. Substrate-coverage gap, not a verified contradiction — evidence: invariant:admin-principals-bypass-organization-name-gate / GithubUserHandler.java:54-68; no CodeNode for GithubUserHandler."
  - "Page (Azure `logout-uri` warning + Troubleshooting) claims an unset `logout-uri` raises NPE → 500 on logout. CONFIRMED by code: ODDOAuth2Properties `@PostConstruct` validator (ODDOAuth2Properties.java:16-28) checks ONLY clientId + provider, so logout-uri is never required at boot; AzureLogoutSuccessHandler.java:39 calls `URI.create(provider.getLogoutUri())` with no null guard while CognitoLogoutSuccessHandler has the matching isEmpty guard. Page is accurate; flagged because it is the LSN-002-class fail-deferred-to-runtime caveat — evidence: ODDOAuth2Properties config-properties-class node / ODDOAuth2Properties.java:16-28 + AzureLogoutSuccessHandler.java:39."
  - "Page lists Okta + Keycloak as first-class bullet providers at the top, but in code `OAuth2Provider.provider` is a free String with NO enum constraint (Provider enum = COGNITO/GITHUB/GOOGLE/ODD_IAM/AZURE only); okta/keycloak strings fall through to the generic Custom-OIDC handler. The page's 'Other OIDC providers' section + the admin-detection matrix DO state this no-admin-path behaviour, so the page is internally consistent — recorded as a confirmed nuance, not drift — evidence: ODDOAuth2Properties config-properties-class node (validator-narrow + provider-is-free-string, ODDOAuth2Properties.java:32 + Provider.java:3-5)."
  - "Page (Post-logout redirect derivation) describes a host-header-trust open-redirect in the OAuth logout flow (return-URL built from inbound request scheme/host/port, no allowlist). NOT bound to a confirmed node: the only open-redirect invariant in the substrate (invariant:open-redirect-class-server-side-302-trusts-third-party-url-verbatim) concerns DataCollaborationController.java:41-49 (Slack permalink redirect), a DIFFERENT surface. The logout-handler redirect-derivation is covered descriptively by the logout-revocation + strategy-pattern invariants but has no dedicated confirmed code node — substrate-coverage gap for the logout open-redirect claim."
maintainer_curated: false
---

# OAUTH2/OIDC — doc understanding

This page is the operator's configuration manual for ODD Platform's `auth.type=OAUTH2`
mode: the common `auth.oauth2.client.{id}.*` property set, per-provider YAML/env examples
(Cognito, GitHub, Google, Azure AD single- & multi-tenant, Okta, Keycloak, Custom OIDC),
a PKCE section, and three operator-observable comparison matrices (admin-detection,
logout token-revocation, post-logout redirect). The property schema maps verbatim onto
`config-properties-class:ODDOAuth2Properties` (the `@ConfigurationProperties("auth.oauth2")`
POJO whose nested `OAuth2Provider` declares the 21 fields the page documents — incl.
`pkce`, `logoutUri`, `adminGroups`, `adminPrincipals`, `allowedDomain`, `organizationName`),
and the whole mode is gated by `config-key-consumer:auth.type@L71`
(`@ConditionalOnProperty(value="auth.type", havingValue="OAUTH2")` on `OAuthSecurityConfiguration`).
The `auth.type` knob itself is the **Auth Mode** concept (DISABLED | LOGIN_FORM | OAUTH2 | LDAP).

The page's three matrices are the operator-facing projections of three features and the
per-provider divergence invariants the substrate already carries:

- **Admin-detection per-provider matrix** → `F-084` / `F-124`, grounded by
  `admin-groups silent no-op (asymmetric provider support)` (Google never reads
  `getAdminGroups()` because `GoogleUserHandler` does not extend `AbstractOIDCUserHandler`;
  Okta/Keycloak/Custom-OIDC fall through `CustomOIDCUserHandler` with no admin path) and
  `admin-principals bypass organization-name gate` (GitHub matches `admin-principals` at
  `GithubUserHandler.java:54-67` BEFORE the `organization-name` check at line 68). The page's
  Google "silent no-op" danger block and GitHub "admin-principals bypasses organization-name"
  danger block reproduce these invariants verbatim.
- **Logout token-revocation matrix** → `F-086`, grounded by
  `Logout-side token revocation (asymmetric defence-in-depth)`: only Google
  (`GoogleLogoutSuccessHandler.java:43-54`) and GitHub (`GithubLogoutSuccessHandler.java:51-63`)
  revoke at the IdP; Azure / Cognito / ODD_IAM invalidate the local WebSession only, and
  Azure's gap is the Microsoft RFC 7009 v2.0 limitation the page calls "protocol-level".
- **Per-provider handler/logout dispatch** → `OAuth Provider-Quirks Strategy Pattern`
  (the `List<OAuthUserHandler>` + `List<LogoutSuccessHandler>` chains injected at
  `OAuthSecurityConfiguration.java:79-80`, `@Conditional`-gated per provider).

Drift is in the frontmatter. The high-value confirmed caveat is the Azure `logout-uri` NPE
(validator at `ODDOAuth2Properties.java:16-28` requires only `clientId`+`provider`, so the
required-for-Azure `logout-uri` is deferred to a runtime `URI.create(null)` NPE in
`AzureLogoutSuccessHandler.java:39`). Two page claims are **not confirmable** against the
current substrate (the GitHub `api.github.com`/GHES hard-coding and the logout-path
host-header open-redirect) because the relevant handler classes are not scaffolded as
CodeNodes — substrate-coverage gaps for `doc-gap-finder`, not verified contradictions.

## Maintainer notes
<!-- preserved across re-analysis; the only block a human hand-edits -->

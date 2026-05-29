---
doc_page: "docs/configuration-and-deployment/enable-security/admin-promotion.md"
page_title: "Admin promotion across providers"
live_url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/admin-promotion"
live_url_verified_status: "200"
live_url_resolved_slug: "configuration-and-deployment/enable-security/admin-promotion"
live_verified_at: "2026-05-29"
analysed_at_commit: "30795b4"
prompt_version: "doc-analyser/0.1.0"
confidence_overall: HIGH
describes:
  concepts:
    - "invariant:admin-principals-bypass-organization-name-gate"
    - "invariant:admin-groups-silent-no-op-asymmetric-provider-support"
    - "invariant:login-form-admin-for-every-user-rbac-inert"
    - "invariant:s2s-admin-username-literal-collision"
    - "invariant:refactor-185-identity-layer-facet-batch-zd-whoami-admin-grant"
  features:
    - "F-084"   # OAuth Provider Admin-Detection Matrix (per-provider knob divergence)
    - "F-124"   # Cross-Provider ADMIN Promotion Semantics (six distinct mechanisms)
    - "F-085"   # Identity Probe & DISABLED-Mode synthetic-admin fallback (whoami)
    - "F-088"   # S2S API Key global ADMIN grant surface
  code_nodes:
    - "odd-platform java OAuthSecurityConfiguration config-key-consumer:auth.type@L71"
    - "odd-platform java auth handler:GithubUserHandler"
    - "odd-platform java auth handler:GoogleUserHandler"
    - "odd-platform java auth handler:AbstractOIDCUserHandler"
    - "odd-platform java IdentityController controller-class:IdentityController"
    - "odd-platform java LoginFormSecurityConfiguration config-class:LoginFormSecurityConfiguration"
audience: [operator]
doc_claim_vs_code:
  - "Page claims LDAP `admin-groups` matching is 'case-insensitive SUBSTRING' (matrix row 1: 'case-insensitive substring'; gotcha: '`admin-groups: [ops]` matches every group containing the substring `ops`'). Code does case-insensitive FULL-STRING EQUALITY, not substring — `LDAPSecurityConfiguration.java:96` calls `containsIgnoreCase(adminGroups, authority)` and `OperationUtils.containsIgnoreCase` (utils/OperationUtils.java:7-10) is `collection.stream().anyMatch(element::equalsIgnoreCase)` = full-string `equalsIgnoreCase`. Under the actual code `[ops]` matches ONLY a group literally named `ops`/`Ops`/`OPS`, NOT `devops`/`team-ops`. The page (and the substring overpromotion warning it links to) overstates the collision risk and misdescribes the match. evidence: odd-platform java config-class:LDAPSecurityConfiguration / LDAPSecurityConfiguration.java:91-97 + utils/OperationUtils.java:7-10. (Same substring belief is entrenched in the ontology — ADR-CANDIDATE-038 / REFACTOR-119 / SHB-181 — so the maintainer should reconcile doc + those artefacts together against OperationUtils.java:9.)"
  - "Page claims GitHub `admin-groups` (team-slug) matching is 'case-insensitive SUBSTRING' (matrix row 3; gotcha: '`admin-groups: [admins]` matches `team-admins`, `admins-readonly`, `data-admins`'). Code does case-insensitive FULL-STRING EQUALITY — `GithubUserHandler.java:119` `anyMatch(userTeam -> containsIgnoreCase(provider.getAdminGroups(), userTeam))` with the same `OperationUtils.containsIgnoreCase` (full-string `equalsIgnoreCase`). `[admins]` matches a team literally named `admins`, NOT `team-admins`/`data-admins`. evidence: odd-platform java auth handler:GithubUserHandler / GithubUserHandler.java:114-119 + utils/OperationUtils.java:7-10."
  - "Page's matrix labels Cognito / Google / Azure AD `admin-groups` / `admin-principals` match semantic as 'exact match' (rows 2,4,5) without flagging case-insensitivity. Code matches case-INSENSITIVELY — all three route through `OperationUtils.containsIgnoreCase` (= `equalsIgnoreCase`): Google `admin-principals` at GoogleUserHandler.java:60; Cognito/Azure (extend AbstractOIDCUserHandler) `admin-principals` at AbstractOIDCUserHandler.java:38 and `admin-groups` at AbstractOIDCUserHandler.java:49-50. 'Exact match' reads as case-SENSITIVE to an operator; the true semantic is full-string case-INSENSITIVE equality (e.g. `Admins` and `admins` both match). evidence: odd-platform java auth handler:GoogleUserHandler / GoogleUserHandler.java:56-64 + odd-platform java auth handler:AbstractOIDCUserHandler / AbstractOIDCUserHandler.java:33-55 + utils/OperationUtils.java:7-10."
  - "Page claims Okta / Keycloak / 'any other OIDC provider' route to a Custom OIDC handler 'which has NO admin-detection logic' and that 'every authenticated user is `USER` at login; ADMIN promotion requires manual Owner-Role binding' (matrix Custom-OIDC row + gotcha). Code DOES run admin-detection for Custom OIDC: `CustomOIDCUserHandler extends AbstractOIDCUserHandler`, so the inherited `enrichUserWithProviderInformation` evaluates `admin-principals` (AbstractOIDCUserHandler.java:33-43) for every Custom-OIDC login — and `admin-groups` IF the operator sets `groups-claim` (AbstractOIDCUserHandler.java:44-55; CustomOIDC's `getDefaultGroupsClaim()` returns null, so groups need an explicit `groups-claim`). A Custom-OIDC deployment with `admin-principals` set promotes to ADMIN at login WITHOUT a manual Owner-Role binding — the 'no admin-detection' claim is too absolute. evidence: odd-platform java auth handler:AbstractOIDCUserHandler / CustomOIDCUserHandler.java:18-43 + AbstractOIDCUserHandler.java:33-55."
maintainer_curated: false
---

# Admin promotion across providers — doc understanding

This page is the single comparison surface for how ODD Platform grants the `ADMIN`
authority on login across its four auth modes (`DISABLED`, `LOGIN_FORM`, `OAUTH2`,
`LDAP`) and the six OAUTH2 provider sub-shapes. It maps directly onto the
per-provider admin-detection divergence captured in features **F-084** (the
operator-observable knob matrix) and **F-124** (six distinct `*UserHandler`
admin-detection mechanisms), dispatched from the OAUTH2 entry point
`OAuthSecurityConfiguration config-key-consumer:auth.type@L71` and the per-provider
handlers (`GithubUserHandler`, `GoogleUserHandler`, and the
`AbstractOIDCUserHandler` base behind Cognito / Azure / Custom-OIDC). The
`DISABLED` synthetic-admin row binds to **F-085** /
`IdentityController.dummyOwner` (`IdentityController.java:31-32` returns
`username "admin"` + `Permission.values()`); the `LOGIN_FORM` "every user is ADMIN,
SECURITY_RULES inert" row binds to `LoginFormSecurityConfiguration` and the
`login-form-admin-for-every-user-rbac-inert` invariant; the S2S migration note
binds to **F-088** + the `s2s-admin-username-literal-collision` invariant.

The page's content is overwhelmingly accurate and security-grade — the GitHub
`admin-principals`-bypasses-`organization-name` warning (matches
`GithubUserHandler.java:54-67` firing before the org check at line 68), the Google
`admin-groups` silent no-op (Google's handler never extends the OIDC base and never
reads `getAdminGroups()`, `GoogleUserHandler.java:1-74`), the Cognito `cognito:groups`
and Azure `roles`-claim defaults, and the ODD_IAM flag scheme
(`ODDIAMUserHandler.java:36-40`) all confirm against source. The one systematic
defect (recorded above) is the **"substring" vs "full-string `equalsIgnoreCase`"**
mischaracterisation of `admin-groups` matching for LDAP and GitHub: the shared
`OperationUtils.containsIgnoreCase` (`utils/OperationUtils.java:7-10`) is
collection-membership-with-case-folding (`anyMatch(element::equalsIgnoreCase)`),
not String-substring containment. This is a high-value finding because the same
substring belief is entrenched across the ontology (ADR-CANDIDATE-038,
REFACTOR-119, SHB-181) and the linked LDAP/OAuth2 doc pages — the maintainer needs
to reconcile doc + code-model together against `OperationUtils.java:9`.

## Maintainer notes

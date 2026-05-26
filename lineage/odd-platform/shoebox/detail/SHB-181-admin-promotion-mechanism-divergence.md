# SHB-181 — ADMIN-role promotion mechanism diverges per auth provider (LDAP substring vs OAuth2 claim vs ODD_IAM flag)

**Category**: open
**Severity**: HIGH

## Hypothesis

Operators promoting users to platform ADMIN role discover that the mechanism varies dramatically across the four auth modes — and within OAuth2 it varies further per provider — with each mechanism carrying its own surprising operator-trust surface: (1) LDAP uses `containsIgnoreCase` SUBSTRING matching against `auth.ldap.groups.admin-groups` (a short token like `"ops"` matches every LDAP group whose name contains it — `devops`, `noops`, `appops` all silently confer admin); (2) OAuth2 with Cognito reads `cognito:groups` claim and exact-matches against `auth.oauth2.client.cognito.admin-groups`; (3) OAuth2 with GitHub does team-based admin within an organisation gated by `auth.oauth2.client.github.organization-name` (requires `read:org` scope or the lookup silently returns no groups); (4) OAuth2 with Google uses `auth.oauth2.client.google.allowed-domain` plus a custom `admin-attribute` claim; (5) OAuth2 with Azure reads `roles` claim by default (or `groups` if `groups-claim: groups` is set) and exact-matches against `admin-groups`; (6) OAuth2 with ODD_IAM uses the `admin-user-info-flag` claim (a boolean flag in the userinfo response) — undocumented in the live operator page. An operator misconfiguring (or copy-pasting between modes) any one of these gets either over-privileged users or no-admin-path users.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/properties/ODDLDAPProperties.java:31` — `Group.adminGroups` is `Set<String>`; consumer at `LDAPSecurityConfiguration.java:48,94-98` uses `OperationUtils.containsIgnoreCase(properties.getGroups().getAdminGroups(), a.getAuthority())` — case-insensitive SUBSTRING containment, not equality.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/properties/ODDOAuth2Properties.java:32,45-49` — `OAuth2Provider.provider` is a free String (not enum); `adminPrincipals`, `adminGroups`, `adminAttribute`, `adminUserInfoFlag` are four DIFFERENT admin-detection fields with NO cross-validation. Different providers consume different fields.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/handler/impl/CognitoUserHandler.java:26` + `GithubUserHandler.java:39,54-67,78-86` + `GoogleUserHandler.java:39,56-64` + `AzureUserHandler.java:26` + `ODDIAMUserHandler.java:28,36-38` — each handler implements its OWN `shouldHandle()` + `extractAdminAuthorities()` logic with divergent semantics.
- WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/oauth2-oidc` (verified 2026-05-12 status 200) — documents Cognito + GitHub + Google + Azure admin semantics but does NOT mention ODD_IAM at all; the live page enumerates 7 supported providers but `Provider` enum has 5 values (`COGNITO, GITHUB, GOOGLE, ODD_IAM, AZURE`) — Okta + Keycloak get generic OIDC routing with NO admin-detection at all.
- WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/ldap` (verified 2026-05-12 status 200) — documents `auth.ldap.groups.admin-groups` as "List of groups" without warning the matching is substring-based; the operator example `admin-groups: admin` would match ANY LDAP group containing the substring `admin` (`admin`, `domain admins`, `non-admin`).
- `ODDLDAPProperties.java:18,28-32` + `LDAPSecurityConfiguration.java:91-93` — when `auth.ldap.groups` is null (default — the bundled `application.yml:50-65` ships the ldap block commented out), the consumer returns a `USER`-only authority for every authenticated LDAP user. **An operator who uncomments LDAP but forgets `groups.admin-groups` has NO path to ADMIN via LDAP** — and no error message tells them.
- `auth.type=LOGIN_FORM` mode — the platform has predefined-user mechanism (per concept-catalog references) where the seeded `Administrator` Role is bound to a specific username. **No admin-detection mechanism on form-login itself** — admin is granted at User-creation time via the UI, not via configuration.

## Notes

- **Six different admin-detection patterns in one platform.** Operators reading the documentation cannot apply learning from one provider to another. The mental model "configure admins" has six concrete shapes: (a) LDAP substring containment, (b) Cognito `cognito:groups` exact match, (c) GitHub org+team membership API call, (d) Google domain + custom attribute, (e) Azure roles-claim or groups-claim exact match, (f) ODD_IAM userinfo-flag boolean. Each has its own failure mode and surprising-behaviour surface.
- **LDAP substring matching is the highest-severity gap.** `admin-groups: ['ops']` against an LDAP server containing groups `devops`, `noops`, `appops`, `engops`, `dataops` silently promotes every member of every one of those groups to ADMIN. The mitigation is operator-side: use long admin-group names like `ODD_PLATFORM_ADMINS`. The docs don't warn.
- **GitHub admin requires `read:org` scope; missing scope silently returns no admin.** The GitHub handler's admin-detection makes an API call to enumerate the user's teams (`GithubUserHandler.java:78-86`); if the OAuth2 scope is missing `read:org`, the call returns 403 / empty result, the handler returns no admin authorities, the user is `USER` regardless of their team membership. The operator configuring GitHub auth doesn't see a fail-fast; they see "admin promotion isn't working" with no log clue.
- **Azure `logout-uri` is mandatory but unvalidated.** Per the ODDOAuth2Properties sidecar bugs section: Azure operators who omit `logout-uri` get a `NullPointerException` on first logout. The `@PostConstruct validate()` only checks `clientId` + `provider` non-empty; provider-required fields aren't validated. Same shape applies to Google's `allowed-domain` (no validation) and GitHub's `organization-name` (no validation).
- **Okta and Keycloak get NO admin path.** The live docs claim support for both, but the `Provider` enum doesn't include them; every `*UserHandler.shouldHandle` check is `equalsIgnoreCase(Provider.X.name())`; so Okta/Keycloak operators authenticate successfully (generic OIDC discovery works) but get `USER` role with no admin path. Documented as supported; mechanically not supported.
- This is a `feature candidate that names an operator-failure-mode-class`. The feature is "Cross-Provider ADMIN Promotion Semantics" — a documented contract describing how to promote a user to ADMIN under each of the six paths. No F-NNN anchors this.
- Related: F-006 (RBAC policy lifecycle), F-011 (Principal-to-Owner Resolution); SHB-180 (cross-mode bleed); concept-catalog `provider-null-cross-mode-bleed`.

## Next

1. **Promote** — `F-NNN — Cross-Provider ADMIN Promotion Semantics`. Pillar P-09 (security). Subjects: ODDLDAPProperties.adminGroups + ODDOAuth2Properties.OAuth2Provider (4 admin fields) + the six `*UserHandler` implementations + LDAPSecurityConfiguration.java:48,91-98 + the bundled application.yml comments.
2. **Open follow-ups**:
   - SEC-NNN (HIGH) — change LDAP admin-group matching from `containsIgnoreCase` SUBSTRING to `equalsIgnoreCase` EXACT match (one-line `LDAPSecurityConfiguration.java:96` change); add a migration note for operators who used substring tokens.
   - SEC-NNN — add cross-field validation to `ODDOAuth2Properties.@PostConstruct validate()`: when `provider=azure`, require `logoutUri`; when `provider=github`, require `scope` to include `read:org` if `adminGroups` is non-empty; when `provider=google`, require `allowedDomain`.
   - REFACTOR-NNN — make `OAuth2Provider.provider` field type-safe via the `Provider` enum (currently a free String) so a typo like `provder: google` fails fast at boot instead of silently routing through generic OIDC.
   - DOC-NNN — create a unified "ADMIN Promotion Across Auth Providers" page enumerating each of the six mechanisms with the surprising-behaviour caveats spelled out.
   - DOC-NNN — Provider enum + handlers should be brought up to parity with the live docs' 7-provider claim (Okta + Keycloak need handler implementations).
3. **Probe** — manual test: configure LDAP with `admin-groups: ['ops']` against a fake LDAP server with groups `devops` + `noops` + `appops`; confirm the platform promotes every user in any of those groups to ADMIN.
4. **Concept-catalog** — promote this finding into a concept entry: `cross-provider-admin-promotion-mechanism-divergence-with-six-distinct-shapes`.

## Links

- cluster_with: [F-006, F-011]
- merged_into: (open)
- supersedes: []

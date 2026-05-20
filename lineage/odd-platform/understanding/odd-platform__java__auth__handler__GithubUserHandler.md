---
node_id: "odd-platform java auth handler:GithubUserHandler"
node_kind: handler
axis: auth-handlers
extracted_at_commit: 9ac6436e
enriched_at_commit: 9ac6436e
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-19-O-GithubUserHandler
pillar: P-09
---

# GithubUserHandler — semantic understanding

## understanding

`GithubUserHandler` is the GitHub-specific implementation of `OAuthUserHandler<OAuth2User, OAuth2UserRequest>` — invoked by `OAuthSecurityConfiguration.customOauth2UserService` (`OAuthSecurityConfiguration.java:128-139`) AFTER Spring's `DefaultReactiveOAuth2UserService` resolves the GitHub user, to enrich the OAuth2User with admin/user role authorities and to ENFORCE org-membership gating. The class is bean-conditional on `GithubCondition` (`GithubUserHandler.java:30` → `GithubCondition.java:10-15` → `AbstractProviderCondition.java:15-22` — binds `auth.oauth2.client.*.provider` and matches case-insensitively against the literal `GITHUB`). The enrichment pipeline (`enrichUserWithProviderInformation`, lines 48-97) is **NOT pure OIDC**: GitHub has no unified userinfo claim for org/team membership, so the class makes **two outbound HTTP calls** to `https://api.github.com` (hard-coded singleton WebClient instantiated at field-init line 39) — `GET /user/orgs` (line 78) to verify the user belongs to `provider.getOrganizationName()`, and (only if `adminGroups` is non-empty) `GET /user/teams` (line 106) to determine ADMIN role by team-name membership. Three branches govern the outcome: (a) lines 54-67 — if `adminPrincipals` is non-empty AND the user's `admin-attribute` claim (default `login`) full-string-case-insensitive-matches any entry, the user is ADMIN with NO org check; (b) lines 68-74 — if `organizationName` is empty, all authenticated users get USER role with no further checks; (c) lines 76-96 — the full org-and-team flow: fetch orgs, fail with `OAuth2AuthenticationException` if the user does not belong to the named org, then determine ADMIN by team membership within that org. The output is always a `DefaultOAuth2User` with authorities from `GrantedAuthorityExtractor.getAuthorities(isAdmin)` (`USER` or `ADMIN` `SimpleGrantedAuthority`) and the user's original GitHub attributes preserved. The GitHub identifier consumed downstream is the username string (the OAuth2User `name` attribute resolved by `userNameAttributeName` per provider config, default `login`) — NOT the stable numeric GitHub user `id`.

## concepts

- entities:
  - "`OAuth2User` (the Spring Security OAuth2 user — non-OIDC variant; produced by `DefaultReactiveOAuth2UserService` from a GitHub `/user` response; consumed at lines 49, 57, 63, 71, 94)"
  - "`OAuth2UserRequest` (carries the access token + ClientRegistration; the access token is forwarded as Bearer to GitHub via `headers.setBearerAuth(request.getAccessToken().getTokenValue())` at line 81, line 109)"
  - "`ODDOAuth2Properties.OAuth2Provider` (the per-client config; consumed via `oAuth2Properties.getClient().get(registrationId)` at line 52 — keys read are `provider`, `userNameAttribute`, `adminAttribute`, `adminPrincipals`, `adminGroups`, `organizationName`; see `ODDOAuth2Properties.java:31-53`)"
  - "`DefaultOAuth2User` (the enriched return value built at lines 62-65, 70-73, 93-96 with USER/ADMIN authority + original attribute map + `userNameAttributeName`)"
  - "`GrantedAuthorityExtractor` (the single-method bean returning `Set.of(SimpleGrantedAuthority(USER|ADMIN))` based on the `isAdmin` boolean; constructor-injected via `@RequiredArgsConstructor` line 31 → field line 40; behaviour at `GrantedAuthorityExtractor.java:12-17`)"
  - "GitHub organization (JSON object at `GET /user/orgs[]` — the JSON key `login` IS the organization's globally-unique slug, NOT the human display name; consumed at line 35 `ORGANIZATION_NAME = \"login\"`)"
  - "GitHub team (JSON object at `GET /user/teams[]` — has nested `organization.login` and team `name`; consumed at lines 33-36 + `teamBelongsToOrganization` lines 123-131)"
  - "GitHub WebClient (singleton instance bound to `https://api.github.com` at field-init line 39 — created via `WebClient.create(url)` per-bean-instance, NOT per-call)"
  - "GitHub Accept header literal `application/vnd.github+json` (line 37; the recommended media type for GitHub API v2022-11-28 onwards)"
- operations:
  - "filter handler invocation: `shouldHandle(\"GITHUB\")` returns true iff `provider.equalsIgnoreCase(\"GITHUB\")` (lines 43-46; called by `OAuthSecurityConfiguration.getOAuthUserHandler` at lines 192-197 across the injected `List<OAuthUserHandler<OAuth2User, OAuth2UserRequest>>`)"
  - "fast-path admin-principals match: read `admin-attribute` (default `login`) from the user attributes, full-string-case-insensitive-match against `adminPrincipals` set; returns ADMIN with NO org check (lines 54-67)"
  - "no-org skip: if `organizationName` is empty, return USER with no HTTP call to GitHub (lines 68-74)"
  - "org-membership gate: `GET https://api.github.com/user/orgs` with Bearer token, retrieve `List<Map<String,Object>>`, check `org.login` case-insensitively matches `organizationName`; on no-match → `Mono.error(OAuth2AuthenticationException(\"invalid_token\", \"User doesn't belong to organization {orgName}\"))` (lines 76-91)"
  - "admin-team gate: `GET https://api.github.com/user/teams` with Bearer token, filter to teams whose `team.organization.login` matches `organizationName` case-insensitively, extract team `name`, full-string-case-insensitive-match against `adminGroups` set (lines 99-120, 122-131)"
  - "build enriched user: `new DefaultOAuth2User(authorities, attributes, userNameAttributeName)` (lines 62-65, 70-73, 93-96)"
- invariants:
  - "**Username is the GitHub `login` string, NOT the stable numeric `id`.** Line 36 `USER_LOGIN = \"login\"` and line 56 default `adminAttribute = USER_LOGIN`. GitHub allows users to RENAME their login string at any time (free; the old name is held in escrow for 90 days and then released). A user `alice` who renames to `alice2` will, on next login, present `(alice2, github)` to `AuthIdentityProviderImpl.java:29-30` (`OAuth2AuthenticationToken.getAuthorizedClientRegistrationId()` returns `github` per the `auth.oauth2.client.{id}` registration key). The `(alice, github)` `USER_OWNER_MAPPING` row from the prior identity is orphaned. NO `id`-based fallback exists. evidence: lines 36, 56 + AuthIdentityProviderImpl.java:29-30 + ReactiveUserOwnerMappingRepositoryImpl.java:116-127."
  - "**Org-membership match is full-string equality on `org.login`, case-insensitive.** Line 136 `org.get(\"login\").toString().equalsIgnoreCase(organizationName)`. The user's full set of org memberships is fetched and the JSON `login` field of each is compared. An operator configuring `organization-name: MyCoolOrg` will match the literal slug `mycoolorg` / `MyCoolOrg` / `MYCOOLORG` — but NOT a partial match like `MyCool` (whereas the LDAP sister code `LDAPSecurityConfiguration.java:94-97` is also full-string-equality via the same `OperationUtils.containsIgnoreCase` helper; see CONFLICTS below)."
  - "**Admin-team match is full-string equality on the team's `name`, case-insensitive, scoped to the configured organization.** Lines 114-119 filter teams to those whose `organization.login` matches `organizationName`, then extract `team.name`, then `containsIgnoreCase(adminGroups, teamName)` (full-string equality, NOT substring — `OperationUtils.containsIgnoreCase` calls `element::equalsIgnoreCase`). A team named `Admins` matches `admin-groups: [Admins]` but NOT `admin-groups: [Admin]`."
  - "**Admin-principals match BYPASSES the org-membership gate.** Lines 54-67 fire BEFORE the org check at lines 68-96. If the user's `admin-attribute` claim matches any `adminPrincipals` entry, the handler returns ADMIN without verifying the user belongs to `organizationName`. An operator's `adminPrincipals: [alice]` makes `alice` ADMIN even if `alice` is not in `organizationName` — by design. evidence: lines 54-67 + 68 (the org-empty check happens AFTER the admin-principals return)."
  - "**WebClient is a singleton bound to `https://api.github.com` — no operator-configurable endpoint.** Line 39 `private final WebClient webClient = WebClient.create(\"https://api.github.com\");`. This is GitHub.com only; **GitHub Enterprise Server users CANNOT use this handler** (GHES exposes APIs at `https://github.example.com/api/v3` per GHES docs). No `@Value` injection, no config override, no provider-property knob."
  - "**No retry, no timeout, no rate-limit handling on the two outbound GitHub calls.** GitHub's REST API enforces rate limits (5000 req/hr authenticated default; lower for unauthenticated; secondary rate limits for abuse). A 403 with `X-RateLimit-Remaining: 0` will surface to the user as a 5xx-equivalent login failure — `.bodyToMono` will fail-out the Mono via `WebClientResponseException` propagated to the OAuth2 login flow. No fallback to cached membership; no graceful degradation. evidence: lines 76-85, 104-113 (no `.retryWhen`, no `.timeout`, no `.onErrorResume`)."
- audiences:
  - "operators configuring GitHub OAuth via `auth.oauth2.client.{id}` (provider=`github`, organization-name, admin-groups, admin-principals, admin-attribute, user-name-attribute, scope=`user:read,read:org`)"
  - "operators using ODD Platform with auth.type=OAUTH2 and GitHub as the IDP (the runtime consumer at login)"
  - "downstream: AuthIdentityProviderImpl.fetchAssociatedOwner (line 51 onwards) — the (username, `github`) tuple flows from this handler to USER_OWNER_MAPPING lookup"
  - "downstream: every owner-scoped read on the platform (15 callsites per AuthIdentityProviderImpl audiences) — the ADMIN/USER GrantedAuthority produced here is what `getCurrentUserProviderRole` reads at AuthIdentityProviderImpl.java:43-44"
  - "GitHub.com REST API v3 (api.github.com) — outbound HTTP audience; NOT GitHub Enterprise Server"

## dependencies_semantic

- requires-feature:
  - "**Spring Security OAuth2 client (non-OIDC variant)** — `customOauth2UserService` at `OAuthSecurityConfiguration.java:128-139` is the registration point; the bean is auto-discovered via `List<OAuthUserHandler<OAuth2User, OAuth2UserRequest>>` injection at `OAuthSecurityConfiguration.java:79`. The `@Conditional(GithubCondition.class)` gates bean creation."
  - "**`auth.type=OAUTH2`** — `OAuthSecurityConfiguration.java:71` carries `@ConditionalOnProperty(value=\"auth.type\", havingValue=\"OAUTH2\")`; this handler is unreachable under LOGIN_FORM/LDAP/DISABLED."
  - "**`auth.oauth2.client.{id}.provider=github`** — `GithubCondition` reads `auth.oauth2.client` map via `Binder.get(env).bind(...)` (AbstractProviderCondition.java:15-22) and matches the literal `GITHUB` via `containsIgnoreCase` (`GithubCondition.java:13`). Without at least one client whose `provider` is `github`, the bean is not registered."
  - "**GitHub.com REST API v3** — outbound HTTP to `https://api.github.com/user/orgs` and `/user/teams` (lines 78, 106). The handler depends on (a) GitHub's API being reachable, (b) the OAuth2 access token carrying `read:org` scope to retrieve org/team data (per the live docs page WebFetched 2026-05-19 status 200: 'user:read and read:org scopes must be included'). Without `read:org` scope, GitHub returns 403 on `/user/orgs` and `/user/teams`."
  - "**`GrantedAuthorityExtractor`** — single bean, single method (GrantedAuthorityExtractor.java:12-17) returns USER or ADMIN authority. No customisation surface."
  - "**`ODDOAuth2Properties`** — the per-client config map (ODDOAuth2Properties.java:11-54). Reads keys: provider, userNameAttribute, adminAttribute, adminPrincipals, adminGroups, organizationName."
- requires-config:
  - "**`auth.oauth2.client.{id}.provider`** — MUST be `github` for this handler to activate. case-insensitive comparison via `containsIgnoreCase` (`shouldHandle` line 45 + `GithubCondition.java:13`)."
  - "**`auth.oauth2.client.{id}.user-name-attribute`** — default `login` (assumed via downstream `DefaultOAuth2User` construction; the handler passes it through verbatim from `provider.getUserNameAttribute()` at line 53). Per live docs WebFetched 2026-05-19 status 200: 'Defines the username token claim (default: login)'."
  - "**`auth.oauth2.client.{id}.admin-attribute`** — default `login` (line 56 fallback). Drives the admin-principals attribute lookup (line 57)."
  - "**`auth.oauth2.client.{id}.admin-principals`** — Set<String>. If non-empty AND the user's `admin-attribute` claim matches any entry, the user is ADMIN with NO org check (lines 54-67)."
  - "**`auth.oauth2.client.{id}.organization-name`** — String. If empty, all authenticated users get USER role (lines 68-74). If non-empty, the user MUST belong to this org via `/user/orgs` membership; otherwise login fails with `OAuth2AuthenticationException` at line 90."
  - "**`auth.oauth2.client.{id}.admin-groups`** — Set<String>. If non-empty (and the user has not been admin-principals fast-tracked) and the user is in `organizationName`, ADMIN is granted iff the user is a member of a team WHOSE NAME case-insensitively-equals any `adminGroups` entry AND whose team belongs to `organizationName` (lines 99-120, 122-131)."
  - "**OAuth2 scopes** — operator must configure `scope: user:read,read:org` (per live docs). NOT enforced by this code; if the scope is missing, GitHub returns 403 on `/user/orgs` and the login surfaces as failed."
- requires-runtime:
  - "Spring WebFlux + Reactor 3 — `Mono<T>` return shape (lines 49, 87, 99), `bodyToMono(new ParameterizedTypeReference<>() {})` for List<Map<String, Object>> coercion (lines 84, 112)"
  - "Spring Security OAuth2 (6.x) — `DefaultOAuth2User`, `OAuth2User`, `OAuth2UserRequest`, `OAuth2AuthenticationException`, `OAuth2Error` (lines 18-22)"
  - "Spring WebFlux WebClient bound to `api.github.com` (line 39)"
  - "Apache Commons Collections (`CollectionUtils.isNotEmpty`) + Lang3 (`StringUtils.isNotEmpty` / `isEmpty`)"
  - "Lombok `@RequiredArgsConstructor` (line 31) — injects `GrantedAuthorityExtractor` + `ODDOAuth2Properties`; the WebClient is NOT injected (field-initialised at line 39)"
- coupling:
  - "**`OAuthUserHandler<OAuth2User, OAuth2UserRequest>` interface** — sibling handlers for OIDC providers (Google/Cognito/Azure/CustomOIDC/ODDIAM) implement the OIDC variant `OAuthUserHandler<OidcUser, OidcUserRequest>` and are discovered via a SEPARATE `List<OAuthUserHandler<OidcUser, OidcUserRequest>>` injection at `OAuthSecurityConfiguration.java:80`. GitHub uses the non-OIDC variant because GitHub is OAuth2 only — it does NOT emit a JWT id_token with cryptographically-verified claims. The handler list is therefore distinct from the OIDC list at OAuthSecurityConfiguration.java:128-139 vs lines 115-126."
  - "**`AuthIdentityProviderImpl.java:29-30`** — the (username, `github`) tuple constructed at AuthIdentityProviderImpl.java:29-30 in OAuth2AuthenticationToken's case is the COMPOUND KEY used to look up `USER_OWNER_MAPPING` (`ReactiveUserOwnerMappingRepositoryImpl.java:116-127`). The `provider` string in the tuple IS the registration ID — typically `github`. A change to the registration ID (e.g. operator renames `github` → `github-prod`) silently orphans all prior `USER_OWNER_MAPPING` rows."
  - "**`GoogleUserHandler.java:42-73`** — sibling handler for OIDC (Google). Comparison: Google reads `id_token` claims (`token.getClaim(GOOGLE_DOMAIN)`, `token.getClaim(adminPrincipalAttribute)`) — no outbound HTTP call; GitHub MUST issue outbound HTTP because membership data is not in the OAuth2 user response. Architectural divergence is GitHub-protocol-driven, not policy."
  - "**`LDAPSecurityConfiguration.java:94-97`** — sister auth mode using the same `OperationUtils.containsIgnoreCase` (`utils/OperationUtils.java:7-10` — `element::equalsIgnoreCase`). LDAP admin-group resolution uses the same full-string-equality semantic. The canonicalisation candidate `substring-match-admin-escalation-ldap-containsignorecase.yaml` claims LDAP uses substring matching — this is FACTUALLY WRONG per `OperationUtils.java` (see CONFLICTS below)."

## upstream_callers

- **OAuthSecurityConfiguration.customOauth2UserService** — `OAuthSecurityConfiguration.java:128-139` invokes `handler.get().enrichUserWithProviderInformation(user, request)` where `handler` is filtered from `oauthUserHandlers` (the `List<OAuthUserHandler<OAuth2User, OAuth2UserRequest>>` of which this class is the sole GitHub-conditional member). The invocation is preceded by `DefaultReactiveOAuth2UserService.loadUser(request)` (line 131) which makes the initial `GET /user` call to api.github.com. Confidence: HIGH.
- **OAuthSecurityConfiguration.getOAuthUserHandler** — `OAuthSecurityConfiguration.java:192-197` filters `oauthUserHandlers` by `h.shouldHandle(provider)` where `provider` is read from `auth.oauth2.client.{registrationId}.provider`. THIS class's `shouldHandle` (lines 43-46) returns true for `provider.equalsIgnoreCase(\"GITHUB\")`. Confidence: HIGH.
- **(Indirect upstream) Spring Security OAuth2 login flow** — when a user hits `/oauth2/authorization/{registrationId}` for a GitHub-configured registration, Spring redirects to GitHub's authorize endpoint, exchanges the code at the token endpoint, then invokes the registered `ReactiveOAuth2UserService` (the `customOauth2UserService` bean at OAuthSecurityConfiguration.java:128-139), which dispatches to THIS class. Confidence: HIGH.

## downstream_side_effects

- **Outbound HTTPS GET to `https://api.github.com/user/orgs`** (lines 76-85): Bearer-token authenticated; Accept header `application/vnd.github+json` (line 37). Side-effects: (a) consumes 1 GitHub API rate-limit token (5000/hr default); (b) carries the user's OAuth2 access token across to api.github.com (the access token is GitHub's own — not a relay credential, so no third-party data flow); (c) GitHub may log the call in its audit log if enabled on the operator's GitHub org. The response payload is List<Map<String,Object>> with `login` keys read at line 136.
- **Outbound HTTPS GET to `https://api.github.com/user/teams`** (lines 104-113): same auth semantics. Side-effects: (a) ONE MORE rate-limit token consumed (so login under non-trivial GitHub config is **2 outbound calls + DefaultReactiveOAuth2UserService's /user call = 3 calls per login**); (b) `/user/teams` returns ALL teams across ALL orgs the user belongs to — not just teams in `organizationName` — so the response payload can be large (no pagination is requested; GitHub's default page size is 30 with `Link` header for `next`; the code only consumes the first page).
- **`Mono.error(OAuth2AuthenticationException)`** when user does not belong to the configured organization (lines 90-91): the error message `"User doesn't belong to organization {orgName}"` is the verbatim text the user sees on the login error redirect; `error="invalid_token"` (line 90). This is NOT logged at INFO/WARN/ERROR in THIS file; logging is whatever Spring Security configures upstream.
- **Build `DefaultOAuth2User` with `Set<GrantedAuthority>`** (lines 62-65, 70-73, 93-96): the resulting OAuth2User is propagated up to the OAuth2 login flow which serialises it into the Spring SecurityContext (session-based). The single GrantedAuthority (`USER` or `ADMIN`) is what `AuthIdentityProviderImpl.getCurrentUserProviderRole` reads (`AuthIdentityProviderImpl.java:41-46`).
- **NO write to USER_OWNER_MAPPING** — the handler does NOT auto-create an Owner row on first login. A first-time GitHub user authenticated successfully (org-member-check passes) lands in the platform with `(username, github)` SecurityContext but NO `USER_OWNER_MAPPING` row; their `fetchAssociatedOwner` returns empty (`AuthIdentityProviderImpl.java:50-53`); their `/my` views silently render empty (per F-011 facet `no_auto_create_on_first_login`).

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "`shouldHandle(\"GITHUB\")` returns true; `shouldHandle(\"github\")` returns true; `shouldHandle(null)` returns false; `shouldHandle(\"GIT\")` returns false (no partial matches)"
    test_class: "GithubUserHandlerTest"
  - behaviour: "When `adminPrincipals` is non-empty AND `admin-attribute` claim value case-insensitively equals an entry, the handler returns ADMIN WITHOUT making any HTTP call to GitHub (the org check is skipped)"
    test_class: "GithubUserHandlerTest"
  - behaviour: "When `adminPrincipals` is non-empty BUT no entry matches, the handler proceeds to the org check; if `organizationName` is empty, returns USER without HTTP call"
    test_class: "GithubUserHandlerTest"
  - behaviour: "When `organizationName` is empty and `adminPrincipals` is empty, the handler returns USER with no outbound HTTP — fast-path for ungated GitHub deployments"
    test_class: "GithubUserHandlerTest"
  - behaviour: "When `organizationName` is non-empty AND the user does not belong to that org per `/user/orgs`, the handler emits `Mono.error(OAuth2AuthenticationException(\"invalid_token\", ...))`"
    test_class: "GithubUserHandlerTest"
  - behaviour: "When the user belongs to `organizationName` AND `adminGroups` is empty, the handler returns USER (no `/user/teams` call)"
    test_class: "GithubUserHandlerTest"
  - behaviour: "When the user belongs to `organizationName` AND `adminGroups` is non-empty AND the user is in a team whose `organization.login` matches `organizationName` and whose `team.name` case-insensitively equals any `adminGroups` entry, the handler returns ADMIN"
    test_class: "GithubUserHandlerTest"
  - behaviour: "When the user is in a team named the same as an `adminGroups` entry BUT in a DIFFERENT organization (i.e., `team.organization.login != organizationName`), the team does NOT contribute to ADMIN — verifying the org-scoping of team filtering"
    test_class: "GithubUserHandlerTest"
  - behaviour: "**Username-rename regression**: a user logged in once as `alice@github` (USER_OWNER_MAPPING row created); user renames their GitHub login to `alice2`; on next login the handler produces OAuth2User with name=`alice2`; `AuthIdentityProviderImpl.fetchAssociatedOwner` looks up `(alice2, github)` → empty Mono; `My Objects` silently empty. NO ID-based fallback exists."
    test_class: "GithubUserHandlerIntegrationTest"
  - behaviour: "**GitHub API rate-limit failure** (`429` or `403 X-RateLimit-Remaining=0`) on `/user/orgs` — the handler propagates `WebClientResponseException`; login fails. NO retry, NO fallback to a cached membership signal."
    test_class: "GithubUserHandlerTest"
  - behaviour: "**GitHub.com unreachable** (network error, DNS, certificate issue) — same propagation; login fails. The handler hard-codes `api.github.com` so GHES (GitHub Enterprise Server) deployments cannot work."
    test_class: "GithubUserHandlerTest"
  - behaviour: "**Multi-page `/user/teams` response** — GitHub paginates at 30 teams per page by default with `Link: ...rel=\"next\"` header. The handler reads only the first page; a user in 31+ teams may have their ADMIN team be on page 2+ and be silently demoted to USER."
    test_class: "GithubUserHandlerIntegrationTest"
- test_files: []
- gaps: |
    Zero direct unit tests for this class. Verified via Glob for `*Github*` and `**/auth/handler/**` and `*OAuth*` under `odd-platform-api/src/test/java` — all three returned no matches. The handler is on the critical authentication path for a documented operator-facing auth mode (live docs WebFetched 2026-05-19 status 200: 'The GitHub provider allows ODD Platform to authenticate users and manage permissions based on GitHub organization and team membership'); the test gap is structural — every other auth handler (Google/Azure/Cognito/CustomOIDC/ODDIAM) similarly has zero tests under `auth/handler/`. The two HIGHEST-LEVERAGE probe candidates are: (a) the username-rename regression (a real, free-to-execute, undocumented behaviour — a GitHub-rename produces an orphaned `USER_OWNER_MAPPING` row); (b) the multi-page `/user/teams` silent-demotion regression (any organization with > 30 teams per user is at risk).

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/oauth2-oidc"
    anchor: ""
    rationale: "The canonical user-facing doc for GitHub OAuth provider configuration; the live page WebFetched 2026-05-19 status 200 returns the GitHub-specific configuration content (organization-name, admin-groups, admin-attribute, admin-principals, user-name-attribute, scope=user:read,read:org)."
    last_verified_at: "2026-05-19T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      "The GitHub provider allows ODD Platform to authenticate users and manage permissions based on GitHub organization and team membership."
      "auth.oauth2.client.{client-id}.organization-name - 'Restricts login only for users from this particular organization'"
      "auth.oauth2.client.{client-id}.admin-groups - 'Grants admin privilegies for users who are members of these teams, which are inside above organization'"
      "auth.oauth2.client.{client-id}.admin-attribute - Specifies which token claim determines admin status"
      "auth.oauth2.client.{client-id}.admin-principals - Direct list of users granted ADMIN role"
      "auth.oauth2.client.{client-id}.user-name-attribute - Defines the username token claim (default: login)"
      "To retrieve organization and team information: 'user:read and read:org scopes must be included'"
      Example YAML: "provider: github / organization-name: my-cool-org / admin-groups: admin / admin-attribute: login / admin-principals: john,david / user-name-attribute: login / scope: user:read,read:org"
      (Live WebFetched 2026-05-19 status 200.)
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication"
    anchor: ""
    rationale: "The parent authentication-modes landing page. Enumerates OAUTH2/OIDC as one of five auth mechanisms; does NOT include GitHub-specific content per the WebFetched 2026-05-19 response."
    last_verified_at: "2026-05-19T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      "Authentication mechanisms: Disable authentication; Login form; OAUTH2/OIDC; LDAP; Server-to-server (S2S)"
      "No GitHub OAuth information is present in the provided page content. The documentation references 'OAUTH2/OIDC' as a general category but does not include details about GitHub-specific implementation, configuration parameters (admin_groups, admin_principals, organization_name), or membership requirements."
      (Live WebFetched 2026-05-19 status 200.)
- doc_drift_findings:
  - "**Doc says ADMIN is determined by 'token claim'; code says `/user` attributes — fine for `admin-attribute`, but the doc's 'token claim' framing is OIDC-vocabulary inappropriate for GitHub OAuth2 (no id_token).** Per the live docs WebFetched 2026-05-19 status 200: 'admin-attribute - Specifies which token claim determines admin status'. The code reads `user.getAttribute(adminAttribute)` (GithubUserHandler.java:57) — these are the OAuth2User's `getAttributes()` map, populated by `DefaultReactiveOAuth2UserService.loadUser(request)` from GitHub's `/user` JSON response — NOT id_token claims (GitHub OAuth2 does NOT issue an id_token). The framing 'token claim' is OIDC-inherited from Google/OIDC handler docs and is technically wrong here. Severity: LOW doc-drift (operationally a non-issue; the documented config keys work as intended). evidence: GithubUserHandler.java:57 + the GitHub OAuth2 spec (no id_token surface)."
  - "**Doc silent on GitHub Enterprise Server (GHES) incompatibility.** The handler hard-codes `https://api.github.com` (line 39); a GHES deployment with api at `https://github.example.com/api/v3` cannot use this handler. The live docs do not warn GHES operators. Severity: MEDIUM doc-drift (an entire class of GitHub operator is silently incompatible). evidence: GithubUserHandler.java:39 + live docs WebFetched 2026-05-19 status 200 silent on GHES."
  - "**Doc silent on username-rename regression.** The handler uses `login` as the username (default `user-name-attribute: login`) which is GitHub-mutable. A user rename produces an orphan `USER_OWNER_MAPPING` row. The compound-key-silent-in-docs finding from F-011 (the AuthIdentityProviderImpl batch K primary source) generalises here: NO doc warns GitHub operators that rename = lost-owner-link. Severity: MEDIUM doc-drift (latent operator-naming-related data-loss). evidence: GithubUserHandler.java:36, 56 + AuthIdentityProviderImpl.java:29-30 + ReactiveUserOwnerMappingRepositoryImpl.java:116-127 + live docs silent."
  - "**Doc silent on rate-limit / pagination / network-failure behaviour.** Per GitHub's REST API rate-limit spec (5000 req/hr authenticated; secondary rate limits for abuse), a busy login surface CAN trip rate-limits. The handler has no `.retryWhen` / `.timeout` / `.onErrorResume` (lines 76-85, 104-113); a 403/429 surfaces as a login failure. Pagination on `/user/teams` is similarly unhandled. Live docs silent. Severity: LOW doc-drift (operational; not common but real for very large GitHub orgs)."
  - "**Doc silent on the `adminPrincipals` org-bypass behaviour.** Per the code at lines 54-67, when `adminPrincipals` matches, the user is granted ADMIN with NO `organizationName` membership check — `adminPrincipals: [external-consultant]` makes `external-consultant` ADMIN even if not a member of `my-cool-org`. The live docs describe `admin-principals` as 'Direct list of users granted ADMIN role' without flagging the org-bypass semantic. Severity: MEDIUM doc-drift (an operator expecting `organization-name` to be a global gate is surprised; an explicit allowlist via `adminPrincipals` bypasses it). evidence: GithubUserHandler.java:54-67 (the early return BEFORE the org-empty check at line 68) + live docs silent."

## implicit_adrs

- "**OAuth2 (non-OIDC) for GitHub because GitHub does not federate via OIDC id_tokens.** The class implements `OAuthUserHandler<OAuth2User, OAuth2UserRequest>` (line 32) — the non-OIDC sibling interface; Google/Cognito/Azure/CustomOIDC/ODDIAM all implement `OAuthUserHandler<OidcUser, OidcUserRequest>`. The maintainer's intent: GitHub is OAuth2-only — there is no id_token, so the OAuth2User attributes are sourced from `/user` JSON, not from a JWT. The split into two interface variants at `OAuthSecurityConfiguration.java:79-80` IS the decision." — evidence: GithubUserHandler.java:32 + OAuthSecurityConfiguration.java:79-80 + GoogleUserHandler.java:30 (OIDC variant for Google) — intent_anchor: "the file declares `OAuthUserHandler<OAuth2User, OAuth2UserRequest>` not `OidcUser/OidcUserRequest`; the deliberate split at OAuthSecurityConfiguration.java mirrors the protocol distinction" — confidence: HIGH
- "**Admin-principals override organization-name (explicit allowlist beats org-gate).** Lines 54-67 fire BEFORE the `organizationName` empty-check at line 68. The maintainer's intent: an operator wanting to grant ADMIN to a specific user outside the org (a consultant, an external admin) can do so by listing them in `adminPrincipals` — the explicit allowlist is more specific than the org gate. NOT documented." — evidence: GithubUserHandler.java:54-67 (the early return) + GithubUserHandler.java:68 (the second-priority org-empty check) — intent_anchor: "the if-block at lines 54-67 has its own `return Mono.just(...)` at lines 62-65 BEFORE any org-check; the ordering IS the precedence" — confidence: HIGH
- "**Hard-coded `api.github.com` — no GitHub-Enterprise-Server support by design (intentional or oversight; route to bugs).** Line 39 `WebClient.create(\"https://api.github.com\")` with no `@Value` injection, no operator-property knob. The maintainer's intent on this is ambiguous — the GoogleUserHandler reads everything from the id_token (no outbound HTTP, so the question doesn't arise); the GitHub handler's WebClient could have been operator-configurable but is not. The lack of a comment or exception message defending the hard-code shifts this finding to `bugs_limitations_corner_cases` per LSN-018 routing — see below."
- "**Two-pass HTTP architecture (org-then-team) instead of `GET /user` enrichment.** GitHub's `/user` endpoint does NOT return org/team membership in its default payload; the handler must make TWO subsequent calls to `/user/orgs` and `/user/teams`. The maintainer's intent: faithfully reflect GitHub's API surface — there is no shortcut. The cost (2 extra round-trips per login) is accepted; the alternative (caching membership) would introduce a cache-invalidation surface across membership changes the platform cannot observe. evidence: lines 76-85, 104-113 (two distinct WebClient calls)." — intent_anchor: "two explicit `webClient.get().uri(\"/user/orgs|/user/teams\")` blocks — the design choice is to re-fetch on every login rather than cache; consistent with the no-cache stance of the broader auth surface (AuthIdentityProviderImpl batch K implicit_adrs[3])" — confidence: MEDIUM (the absence-as-intent inference; not explicitly commented)

## bugs_limitations_corner_cases

- "**Username = GitHub `login` string — GitHub users can RENAME, orphaning the USER_OWNER_MAPPING row.** GitHub allows free login renames (the old name enters a 90-day escrow then becomes available to others). The handler uses `login` as the username (line 36 + line 56 default). A renamed user presents `(alice2, github)` to `AuthIdentityProviderImpl.fetchAssociatedOwner`; the prior `(alice, github)` USER_OWNER_MAPPING row is orphaned. NO `id`-based fallback. NO migration tool. NO doc warning. severity: HIGH (silent loss of owner-linkage on any GitHub rename; latent until rename happens; not detectable from server logs). evidence: GithubUserHandler.java:36, 56 + AuthIdentityProviderImpl.java:29-30 + ReactiveUserOwnerMappingRepositoryImpl.java:116-127. CROSS-LINK: this is the GitHub-specific facet of F-011's `compound_key_silent_in_docs` finding; the live doc compound-key gap is general."
- "**`api.github.com` is hard-coded; GitHub Enterprise Server (GHES) cannot use this handler.** Line 39 `WebClient.create(\"https://api.github.com\")`. No `@Value`, no operator-property, no comment defending the hard-code. A GHES deployment with API at `https://github.example.com/api/v3` is structurally incompatible. The handler will be selected if `provider=github` (the GithubCondition only checks the literal string `GITHUB`), and the outbound calls to api.github.com will fail with DNS/cert errors that surface as login failures. severity: MEDIUM (one entire class of GitHub operator silently locked out; could be a one-line addition to ODDOAuth2Properties + line 39). evidence: GithubUserHandler.java:39 + ODDOAuth2Properties.java:31-53 (no `apiBaseUrl` field) + live docs WebFetched 2026-05-19 status 200 silent on GHES."
- "**Admin-principals bypass the organization-name gate without doc warning.** Lines 54-67 fire BEFORE the org check at line 68. An `adminPrincipals: [external-consultant]` entry grants ADMIN to `external-consultant` even if they are NOT a member of `organizationName`. The live docs describe `admin-principals` as 'Direct list of users granted ADMIN role' without flagging this. Operator threat model: a misuse can elevate an out-of-org user. severity: MEDIUM (security boundary mis-modelling; the bypass is by design but undocumented). evidence: GithubUserHandler.java:54-67 + live docs WebFetched 2026-05-19 status 200 silent."
- "**`/user/teams` pagination is silently truncated to the first page (default 30 items).** Lines 104-113 fetch `/user/teams` with no `?page=N`, no `Link` header handling, no recursion over pages. GitHub's `/user/teams` returns ALL teams across ALL orgs the user belongs to (not scoped by ?org). A user in 31+ teams may have their ADMIN team beyond the first page, silently demoting them to USER. severity: LOW (rare; mostly affects users in many GitHub orgs; reproducible only with carefully-constructed seed data). evidence: GithubUserHandler.java:104-113 (no pagination handling)."
- "**`/user/teams` returns teams across ALL orgs the user belongs to — the handler filters by `team.organization.login = organizationName` (lines 114-119, 122-131), so cross-org team-name collisions are correctly disambiguated. But: a user with `admin-teams: [maintainers]` who is in a `maintainers` team in ANOTHER org will be filtered out — correct behaviour, but the doc framing 'members of these teams, which are inside above organization' assumes the operator understands this filter. Severity: LOW (correct behaviour; doc framing is adequate, just subtle). evidence: lines 114-119, 122-131 + live docs WebFetched 2026-05-19 status 200."
- "**No retry, no timeout, no rate-limit handling on outbound GitHub calls.** GitHub's 5000-req-per-hr rate limit can be exhausted by a high-traffic login surface (e.g. a SAML-like flow with thousands of automated re-logins, or a shared NAT-IP egress). The two outbound calls (`/user/orgs` + `/user/teams`) consume 2 tokens per login. A 403 or 429 response surfaces as a login failure with no fallback. severity: LOW (operationally unusual; relevant for very large platform deployments with NAT-IP egress sharing). evidence: GithubUserHandler.java:76-85, 104-113 (no `.retryWhen` / `.timeout` / `.onErrorResume`)."
- "**Singleton WebClient is field-initialised, not Spring-managed.** Line 39 `private final WebClient webClient = WebClient.create(...)`. The WebClient bypasses Spring's WebClient.Builder bean and any operator-configured connection-pool / ssl-context / proxy settings. A platform deployment behind a corporate proxy needs proxy-aware HTTP — this WebClient has no such hook. severity: LOW (operationally unusual but real for some enterprise deployments). evidence: GithubUserHandler.java:39."
- "**Pre-OAuth2 `DefaultReactiveOAuth2UserService.loadUser(request)` ALSO calls api.github.com** — `OAuthSecurityConfiguration.java:130-131`. The total outbound calls per GitHub login are THREE: (1) Spring's `/user` call to populate the OAuth2User, (2) this handler's `/user/orgs` call, (3) this handler's `/user/teams` call (if `adminGroups` non-empty). All three are sequential; total login latency is bounded by the sum. NOT a bug per se, but operationally relevant. severity: LOW (informational). evidence: OAuthSecurityConfiguration.java:128-139 + GithubUserHandler.java:76-85, 104-113."

## security

- **auth_mode_relevance**: `OAUTH2`. This handler is bean-conditional on `GithubCondition` which requires `auth.oauth2.client.{id}.provider=github`; `GithubCondition` is unreachable unless `auth.type=OAUTH2` (OAuthSecurityConfiguration.java:71 `@ConditionalOnProperty(value=\"auth.type\", havingValue=\"OAUTH2\")`). NOT relevant to LOGIN_FORM / LDAP / DISABLED / S2S (the S2S filter bypasses OAuth entirely at S2sAuthenticationFilter.java:31-39). evidence: GithubUserHandler.java:30 + GithubCondition.java:10-15 + OAuthSecurityConfiguration.java:71.
- **ingestion_filter_relevance**: `NO — UI/API surface, not ingestion`. This handler is part of the OAuth2 login flow on `/oauth2/authorization/{registrationId}` and `/login/oauth2/code/{registrationId}`; it does NOT participate in the `POST /ingestion/entities` path which has its own `IngestionDataEntitiesFilter` (per F-009 / `IngestionDataEntitiesFilter`). evidence: GithubUserHandler.java is not on the ingestion pipeline.
- **authorization_assertions**: [] — this handler PRODUCES authorities (USER/ADMIN GrantedAuthority via `GrantedAuthorityExtractor.getAuthorities(isAdmin)` at lines 62, 70, 93) but does NOT enforce any. Downstream consumers (the RBAC permission framework + `AuthIdentityProviderImpl.getCurrentUserProviderRole`) evaluate the produced authority. evidence: GithubUserHandler.java:48-97 — no `@PreAuthorize`, no permission check.
- **owner_scoping**: `N/A — this code does not scope by owner; it produces the principal-identity tuple that downstream owner-scoping consumes`. The (username, `github`) tuple flows to AuthIdentityProviderImpl which feeds USER_OWNER_MAPPING lookup. The handler ITSELF is not data-scoped.
- **data_exposure**:
  - "GitHub user's full OAuth2User attribute map (the `/user` JSON response from api.github.com) → SecurityContext → every authenticated user can read their own attributes via downstream `/api/identity/whoami` (IdentityServiceImpl). NOT exposed across users. evidence: GithubUserHandler.java:63, 71, 94 (the `user.getAttributes()` passed verbatim into DefaultOAuth2User)."
  - "GitHub org-membership list (`/user/orgs` response) → consumed at line 87 + line 136 — only the `org.login` field is read; the full payload is NOT persisted or logged here. evidence: GithubUserHandler.java:76-91."
  - "GitHub team-membership list (`/user/teams` response) → consumed at lines 114-119 — only `team.name` and `team.organization.login` are read; the full payload (which may include team descriptions, member counts, IDs) is NOT persisted or logged. evidence: GithubUserHandler.java:99-120."
  - "User's OAuth2 access token forwarded as Bearer on outbound calls to api.github.com (lines 81, 109). The token is GitHub's own; it does not leak to any third-party domain. evidence: GithubUserHandler.java:81, 109."
- **known_security_gaps**:
  - "**GitHub login-rename produces an orphan USER_OWNER_MAPPING row — silent loss of owner-link.** Tracked above in `bugs_limitations_corner_cases`. Severity: HIGH (security-adjacent: a renamed user re-acquiring the prior name owns NO catalog rights but their data is effectively orphan-owned by the old USER_OWNER_MAPPING row; the next operator-named user of the old name does NOT inherit the prior owner — fail-safe in this direction — but the prior user's owner-scoped data is orphaned). evidence: GithubUserHandler.java:36, 56 + AuthIdentityProviderImpl.java:29-30 + ReactiveUserOwnerMappingRepositoryImpl.java:116-127."
  - "**Admin-principals bypass `organization-name` membership — operators may misunderstand the gate's scope.** An `adminPrincipals: [outsider]` entry grants ADMIN to `outsider` without verifying org membership. Severity: MEDIUM (deliberate design per implicit_adrs[1]; undocumented per doc_drift_findings; operator threat-model risk). evidence: GithubUserHandler.java:54-67 + live docs WebFetched 2026-05-19 silent."
  - "**No anti-CSRF check on the OAuth2 callback** — handled by Spring Security upstream of this handler; not a concern of this file. evidence: N/A; flagged for awareness in the security narrative."
  - "**Outbound access token in clear** — `headers.setBearerAuth(request.getAccessToken().getTokenValue())` (lines 81, 109) — the access token is sent in HTTPS Authorization header to api.github.com. HTTPS is enforced by the URL scheme; the token is not logged here. Severity: LOW (standard Bearer-token usage). evidence: GithubUserHandler.java:81, 109."
  - "**No mode-check between LOGIN_FORM/LDAP/GitHub-OAuth — the (username, null) bleed from F-011 does NOT apply here** because GitHub IS OAuth2 → provider=`github` (the registrationId), not null. So GitHub login rows are partitioned away from LOGIN_FORM/LDAP/S2S rows. NOT a GitHub-specific gap, but cross-link relevant: F-011 facet `compound_key_silent_in_docs` applies — a migration from LOGIN_FORM to GitHub OAUTH2 silently invalidates `(alice, null)` USER_OWNER_MAPPING rows since `(alice, github)` does not match. evidence: AuthIdentityProviderImpl.java:29-30 + ReactiveUserOwnerMappingRepositoryImpl.java:116-127."

## performance

- **hot_paths**:
  - "**OAuth2 login critical path: 3 sequential outbound HTTPS calls to api.github.com per login** — (1) Spring's `DefaultReactiveOAuth2UserService.loadUser` `/user` call (OAuthSecurityConfiguration.java:130-131), (2) this handler's `/user/orgs` (line 78), (3) this handler's `/user/teams` (line 106, only if `adminGroups` non-empty). Total latency = sum of three RTT to api.github.com + JSON parse. Typical: 300-600ms; tail latencies > 2s observed in some GitHub-API incidents. evidence: GithubUserHandler.java:76-85, 104-113 + OAuthSecurityConfiguration.java:128-139."
  - "**No caching of org/team membership** — every login re-fetches both lists. For a user logging in 10 times per day, 20 GitHub API tokens are consumed per user per day. Bounded but multiplicative; consistent with the broader no-cache stance (AuthIdentityProviderImpl batch K implicit_adrs[3])."
- **throughput_characteristics**:
  - "stateless handler — instances scale horizontally with no coordination"
  - "single-login-at-a-time per session — no batching; one Authentication event per HTTP request"
  - "reactive Mono signatures — non-blocking but per-login HTTP round-trips dominate latency"
- **resource_allocation**:
  - "singleton WebClient (line 39) — created once per bean instance via `WebClient.create(\"https://api.github.com\")`; no operator-configurable pool size, timeout, proxy. evidence: GithubUserHandler.java:39."
  - "`/user/orgs` response: typically < 1KB for users in < 10 orgs; bounded by GitHub's pagination default (30 entries per page)"
  - "`/user/teams` response: typically < 5KB for users in < 30 teams across all orgs; bounded by GitHub's pagination default (30 entries per page) — but the handler does NOT request more pages"
  - "no in-memory cache of membership lists — every login allocates new List<Map<String,Object>> via `bodyToMono(new ParameterizedTypeReference<>() {})`"
- **scaling_characteristics**:
  - "stateless — instances scale horizontally"
  - "outbound calls to api.github.com share the GitHub 5000-req/hr-per-token rate limit. Token is per-user, so per-user rate-limit is the binding constraint; aggregate platform GitHub-API usage is bounded by sum of per-user limits."
  - "no advisory locks, no in-memory state, no leader-election"
  - "no rate-limiting on the inbound login endpoint — a tight-loop login attempt against THIS handler issues 3 GitHub calls per attempt"
- **known_performance_gaps**:
  - "**No retry on transient failures of api.github.com.** A flake on `/user/orgs` propagates as a hard login failure; the user retries by initiating the OAuth flow over again (consuming 3 more tokens). severity: LOW (uncommon; mitigatable by `.retryWhen(Retry.backoff(2, Duration.ofSeconds(1)))` or similar). evidence: GithubUserHandler.java:76-85 (no retry)."
  - "**No client-side timeout — relies on Reactor Netty default (no `responseTimeout` configured on the WebClient).** A GitHub-side hang propagates to the entire login flow. severity: LOW (Reactor Netty has reasonable defaults; the gap is the explicit-timeout discipline). evidence: GithubUserHandler.java:39 (`WebClient.create(...)` with no `.responseTimeout(...)`)."
  - "**No connection-pool customisation** — the default Reactor Netty connection provider is used; not tunable per-deployment. severity: LOW (operationally unusual). evidence: GithubUserHandler.java:39."
  - "**No pagination on `/user/teams`** — see `bugs_limitations_corner_cases` for the silent truncation. severity: LOW (correctness gap with a performance dimension — fixing requires multi-page recursion which adds RTT). evidence: GithubUserHandler.java:104-113."

## sources

- understanding ← GithubUserHandler.java:1-138 + OAuthSecurityConfiguration.java:79-80, 128-139, 192-197 + GithubCondition.java:10-15 + AbstractProviderCondition.java:15-22 + ODDOAuth2Properties.java:31-53 + GrantedAuthorityExtractor.java:12-17 + utils/OperationUtils.java:7-10
- concepts.entities.OAuth2User ← GithubUserHandler.java:18, 21-22, 32, 49, 57, 63, 71, 94
- concepts.entities.OAuth2UserRequest ← GithubUserHandler.java:18, 32, 50 + access token at lines 81, 109
- concepts.entities.ODDOAuth2Properties.OAuth2Provider ← GithubUserHandler.java:52-53 + ODDOAuth2Properties.java:31-53
- concepts.entities.DefaultOAuth2User ← GithubUserHandler.java:21, 62-65, 70-73, 93-96
- concepts.entities.GrantedAuthorityExtractor ← GithubUserHandler.java:14, 40, 62, 70, 93 + GrantedAuthorityExtractor.java:12-17
- concepts.entities.GitHub-organization ← GithubUserHandler.java:33-36, 87, 133-137 (the `login` field of `/user/orgs[]`)
- concepts.entities.GitHub-team ← GithubUserHandler.java:33-36, 114-119, 122-131 (the `name` + nested `organization.login`)
- concepts.entities.GitHub-WebClient ← GithubUserHandler.java:39 (`WebClient.create(\"https://api.github.com\")`)
- concepts.entities.GitHub-Accept-header ← GithubUserHandler.java:37, 80, 108
- concepts.operations.shouldHandle ← GithubUserHandler.java:43-46
- concepts.operations.admin-principals-fast-path ← GithubUserHandler.java:54-67
- concepts.operations.no-org-skip ← GithubUserHandler.java:68-74
- concepts.operations.org-membership-gate ← GithubUserHandler.java:76-91
- concepts.operations.admin-team-gate ← GithubUserHandler.java:99-120, 122-131
- concepts.operations.build-enriched-user ← GithubUserHandler.java:62-65, 70-73, 93-96
- concepts.invariants.username-is-login ← GithubUserHandler.java:36, 56 + AuthIdentityProviderImpl.java:29-30 + ReactiveUserOwnerMappingRepositoryImpl.java:116-127
- concepts.invariants.org-match-full-string-eq ← GithubUserHandler.java:135-137 + OperationUtils.java:7-10
- concepts.invariants.admin-team-match-full-string-eq ← GithubUserHandler.java:114-120 + OperationUtils.java:7-10
- concepts.invariants.admin-principals-bypass-org ← GithubUserHandler.java:54-67 (early return) + line 68 (subsequent org-empty check)
- concepts.invariants.WebClient-singleton-no-config ← GithubUserHandler.java:39
- concepts.invariants.no-retry-timeout-rate-limit ← GithubUserHandler.java:76-85, 104-113
- concepts.audiences.[*] ← live docs WebFetched 2026-05-19 status 200 (operator audience) + OAuthSecurityConfiguration.java:128-139 (runtime invocation) + AuthIdentityProviderImpl.java:29-30 (downstream)
- dependencies_semantic.requires-feature.* ← OAuthSecurityConfiguration.java:71, 79, 128-139 + GithubCondition.java:10-15 + AbstractProviderCondition.java:15-22 + live docs WebFetched 2026-05-19 status 200 (scope=`user:read,read:org`) + GrantedAuthorityExtractor.java:12-17 + ODDOAuth2Properties.java:11-54
- dependencies_semantic.requires-config.* ← live docs WebFetched 2026-05-19 status 200 (config-key catalog) + ODDOAuth2Properties.java:31-53 (the fields read at GithubUserHandler.java:52-56, 60, 68, 76, 90, 101, 115)
- dependencies_semantic.requires-runtime.* ← GithubUserHandler.java:1-26 (imports + field declarations)
- dependencies_semantic.coupling.OAuthUserHandler-OAuth2-vs-OIDC ← OAuthSecurityConfiguration.java:79-80 (the two distinct injected Lists)
- dependencies_semantic.coupling.AuthIdentityProviderImpl ← AuthIdentityProviderImpl.java:29-30 + ReactiveUserOwnerMappingRepositoryImpl.java:116-127
- dependencies_semantic.coupling.GoogleUserHandler-comparison ← GoogleUserHandler.java:42-73 (no outbound HTTP; reads id_token claims)
- dependencies_semantic.coupling.LDAPSecurityConfiguration-shared-helper ← LDAPSecurityConfiguration.java:94-97 + OperationUtils.java:7-10
- upstream_callers.* ← OAuthSecurityConfiguration.java:128-139, 192-197 (the dispatch point) + downstream Spring Security OAuth2 redirect flow
- downstream_side_effects.outbound-orgs-call ← GithubUserHandler.java:76-85 + line 81 (Bearer auth) + GitHub REST API docs (rate-limit context — not WebFetched, general SDK knowledge)
- downstream_side_effects.outbound-teams-call ← GithubUserHandler.java:104-113 + line 109 (Bearer auth)
- downstream_side_effects.OAuth2AuthenticationException ← GithubUserHandler.java:89-91
- downstream_side_effects.DefaultOAuth2User-build ← GithubUserHandler.java:62-65, 70-73, 93-96
- downstream_side_effects.no-USER_OWNER_MAPPING-write ← GithubUserHandler.java:48-97 (no write) + AuthIdentityProviderImpl.java:50-53 (the downstream lookup that emits empty) + F-011 facet `no_auto_create_on_first_login`
- tests_coverage_semantic.uncovered_behaviours.* ← Glob for `*Github*`, `**/auth/handler/**`, `*OAuth*` under odd-platform-api/src/test/java returned 0 matches; behaviours derived from GithubUserHandler.java:43-138 method bodies
- docs_link_semantic.inferred_docs.[0] ← live WebFetched 2026-05-19 status 200 (configuration-and-deployment/enable-security/authentication/oauth2-oidc; verbatim excerpts captured)
- docs_link_semantic.inferred_docs.[1] ← live WebFetched 2026-05-19 status 200 (configuration-and-deployment/enable-security/authentication; verbatim excerpts captured)
- docs_link_semantic.doc_drift_findings.[0] (token-claim framing) ← GithubUserHandler.java:57 + live docs + GitHub OAuth2 spec (no id_token)
- docs_link_semantic.doc_drift_findings.[1] (GHES silence) ← GithubUserHandler.java:39 + live docs WebFetched 2026-05-19 status 200 silent on GHES
- docs_link_semantic.doc_drift_findings.[2] (rename silence) ← GithubUserHandler.java:36, 56 + AuthIdentityProviderImpl.java:29-30 + ReactiveUserOwnerMappingRepositoryImpl.java:116-127 + live docs silent
- docs_link_semantic.doc_drift_findings.[3] (rate-limit silence) ← GithubUserHandler.java:76-85, 104-113 (no retry/timeout/onErrorResume)
- docs_link_semantic.doc_drift_findings.[4] (admin-principals-bypass silence) ← GithubUserHandler.java:54-67 + live docs WebFetched 2026-05-19 status 200 silent
- implicit_adrs.[0] (OAuth2-non-OIDC for GitHub) ← GithubUserHandler.java:32 + OAuthSecurityConfiguration.java:79-80 + GoogleUserHandler.java:30
- implicit_adrs.[1] (admin-principals override org) ← GithubUserHandler.java:54-67 (early return) + line 68
- implicit_adrs.[2] (hard-coded api.github.com — routed to bugs per LSN-018) ← GithubUserHandler.java:39 (no comment defending the hard-code)
- implicit_adrs.[3] (two-pass HTTP architecture) ← GithubUserHandler.java:76-85, 104-113
- bugs_limitations_corner_cases.[0] (username-rename) ← GithubUserHandler.java:36, 56 + AuthIdentityProviderImpl.java:29-30 + ReactiveUserOwnerMappingRepositoryImpl.java:116-127
- bugs_limitations_corner_cases.[1] (GHES incompatible) ← GithubUserHandler.java:39 + ODDOAuth2Properties.java:31-53 (no apiBaseUrl)
- bugs_limitations_corner_cases.[2] (admin-principals bypass org) ← GithubUserHandler.java:54-67 + live docs silent
- bugs_limitations_corner_cases.[3] (teams pagination silent truncation) ← GithubUserHandler.java:104-113
- bugs_limitations_corner_cases.[4] (cross-org team-name filter) ← GithubUserHandler.java:114-119, 122-131
- bugs_limitations_corner_cases.[5] (no retry/timeout/rate-limit) ← GithubUserHandler.java:76-85, 104-113
- bugs_limitations_corner_cases.[6] (singleton WebClient not Spring-managed) ← GithubUserHandler.java:39
- bugs_limitations_corner_cases.[7] (three calls per login) ← OAuthSecurityConfiguration.java:128-139 + GithubUserHandler.java:76-85, 104-113
- security.auth_mode_relevance ← GithubUserHandler.java:30 + GithubCondition.java:10-15 + OAuthSecurityConfiguration.java:71
- security.ingestion_filter_relevance ← N/A (no ingestion path)
- security.authorization_assertions ← GithubUserHandler.java:48-97 (no @PreAuthorize, no permission check)
- security.owner_scoping ← N/A — this code produces identity, not data
- security.data_exposure.* ← GithubUserHandler.java:63, 71, 76-91, 99-120, 81, 109, 94
- security.known_security_gaps.* ← cited file:line ranges within each entry
- performance.hot_paths.* ← GithubUserHandler.java:76-85, 104-113 + OAuthSecurityConfiguration.java:128-139
- performance.throughput_characteristics.* ← GithubUserHandler.java:17 (stateless component) + lines 49, 87, 99 (Mono return signatures)
- performance.resource_allocation.* ← GithubUserHandler.java:39 + lines 76-85, 104-113
- performance.scaling_characteristics.* ← GithubUserHandler.java:30 (no state, no locks, no leader-election)
- performance.known_performance_gaps.* ← GithubUserHandler.java:39, 76-85, 104-113

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (zero direct unit tests verified via Glob; behaviours derived from method bodies and live docs WebFetched 2026-05-19 status 200)
- docs_link_semantic: HIGH (2 live WebFetches against the canonical authentication / oauth2-oidc doc pages, both status 200; verbatim GitHub config excerpts captured at oauth2-oidc page)
- implicit_adrs: HIGH (3 decisions with concrete intent evidence + 1 ambiguity routed to bugs per LSN-018)
- bugs_limitations_corner_cases: HIGH (8 entries; each anchored to file:line; the rename / GHES / admin-principals-bypass / pagination gaps are derived from concrete code semantics)
- security: HIGH
- performance: HIGH

## coherence

**Pre-emit grep against feature-flows + concepts + refactoring-scopes for each named entity** per LSN-018 Rule 6.

- **STRENGTHENS** `provider-null-cross-mode-bleed.yaml` — this sidecar contributes the GitHub-specific facet `compound_key_silent_in_docs` to F-011's existing finding: a LOGIN_FORM-to-GitHub migration silently orphans `(alice, null)` USER_OWNER_MAPPING rows since `(alice, github)` does NOT match. The GitHub side is doc-silent on the compound key just as the LOGIN_FORM / LDAP side is. Adds new orthogonal facet: GitHub-username-RENAME (not migration, just a user changing their login) silently orphans rows. CROSS-LINK: F-011 facet `compound_key_silent_in_docs`.
- **STRENGTHENS** F-011 (Principal-to-Owner Resolution) — adds GitHub-specific evidence to the chain: hop-1 includes the GitHub OAuth2 handler producing `(username, github)` UserDto; the architectural triangle (principal layer / SQL layer / schema layer) is anchored by this sidecar at the principal-handler layer for GitHub. Adds new contributing_node: `odd-platform java auth handler:GithubUserHandler`.
- **CONTRADICTS** `concepts/detail/canonicalisation_candidates/substring-match-admin-escalation-ldap-containsignorecase.yaml` — the candidate claims LDAPSecurityConfiguration.java:96 uses `containsIgnoreCase` as a SUBSTRING matcher. THIS sidecar reads `utils/OperationUtils.java:7-10` directly and finds `element::equalsIgnoreCase` — FULL-STRING case-insensitive equality, NOT substring. The candidate's claim is factually wrong. The same helper is used by THIS handler at lines 119, 136 and by LDAPSecurityConfiguration at line 96 — all three sites are full-string equality. The canonicalisation_candidate should be RETRACTED or RE-FRAMED as "case-insensitive equality, NOT substring — the doc framing 'A list granting admin permissions' is correct; the candidate's analysis was wrong". MUST be surfaced to reducer.
- **NEW DRIFT FACET** — GitHub-username-rename produces orphan USER_OWNER_MAPPING rows. NOT mentioned in any existing facet. NEW concept candidate: `github-username-rename-orphans-user-owner-mapping`.
- **NEW DRIFT FACET** — `api.github.com` hard-coded; GHES incompatible. NOT mentioned in any existing facet. NEW concept candidate: `github-enterprise-server-unsupported-hardcoded-api-url`.
- **NEW DRIFT FACET** — admin-principals BYPASS organization-name gate (intentional but undocumented). NOT mentioned. NEW concept candidate: `admin-principals-bypass-organization-name-gate`.
- **NEW DRIFT FACET** — `/user/teams` pagination silent truncation at 30 teams. NOT mentioned. NEW concept candidate: `github-user-teams-pagination-silent-truncation`.
- **STRENGTHENS** the broader implicit-ADR "no-cache stance across auth surface" (AuthIdentityProviderImpl batch K implicit_adrs[3]) — this handler is consistent with the absence-as-intent: no membership cache, no rate-limit handling, no retry. The pattern is project-wide.
- **CROSS-LINKS to** F-005 / F-011 / `auth-identity-provider-chokepoint.yaml` — this handler is the GitHub-specific UPSTREAM of the chokepoint described there.

Coherence tally: STRENGTHENS=4, SUPERSEDES=0, CONFLICTS=1 (the LDAP substring-match candidate is factually wrong; route to reducer for retraction / re-framing).

## Maintainer notes

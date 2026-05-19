---
node_id: "odd-platform java auth handler:GoogleUserHandler"
node_kind: auth-handler
axis: auth_handlers
extracted_at_commit: 9ac6436e
enriched_at_commit: 9ac6436e
extractor_version: 0.1.0
prompt_version: file-analyser/0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-19-O-GoogleUserHandler
schema_version: v0.3.0
pillar: P-09
feature_hint: F-011
---

# GoogleUserHandler — semantic understanding

## understanding

`GoogleUserHandler` is the per-provider `OAuthUserHandler<OidcUser, OidcUserRequest>` strategy that enriches an authenticated Google OIDC user with (a) a Workspace-domain check against the `hd` ID-token claim and (b) an ADMIN-or-USER role decision before Spring constructs the final `OAuth2AuthenticationToken` that AuthIdentityProviderImpl will later collapse into `UserDto(name, "google")` at the principal layer (F-011's hop 2). The bean is `@Conditional(GoogleCondition.class)`-gated (only loaded when any `auth.oauth2.client.*.provider` matches "google", per `GoogleCondition.java:12-13`); `shouldHandle(String provider)` is the chain-of-responsibility dispatcher key (`OAuthSecurityConfiguration.java:185-197` iterates the `oidcUserHandlers : List<...>` and picks the FIRST `shouldHandle == true`). Two enrichment branches run sequentially: the **hd-claim domain check** (lines 49-55) reads the token claim `hd` and rejects via `OAuth2AuthenticationException("invalid_token", ...)` when `provider.allowedDomain` is set and the claim doesn't match (case-insensitive); the **admin-principal check** (lines 56-64) reads the configurable `provider.adminAttribute` claim (default `"email"` per `GOOGLE_EMAIL`) and grants ADMIN if the resolved value is contained in `provider.adminPrincipals`. The handler is **deliberately divergent from `AbstractOIDCUserHandler`**: (a) does not extend the abstract base (Cognito/Azure/Custom do); (b) does NOT support `admin-groups` (the abstract base does); (c) reads `userNameAttribute` from Spring's `ClientRegistration.ProviderDetails.UserInfoEndpoint` (lines 66-69) NOT from the ODD Properties POJO (the abstract base reads `provider.getUserNameAttribute()`). The pattern is the load-bearing instance of the **OAuth provider-quirks strategy** ADR (ADR-CANDIDATE-034).

## concepts

- entities: [
    "`OidcUser` (Spring Security OIDC subject — the input to enrichUserWithProviderInformation; carries IdToken + UserInfo + GrantedAuthority set, line 20)",
    "`OidcUserRequest` (the Spring per-login request carrier with ClientRegistration metadata, line 15)",
    "`OAuth2Provider` (the per-client ODD Properties POJO at ODDOAuth2Properties.java:30-53 — provides `allowedDomain`, `adminPrincipals`, `adminAttribute`)",
    "`OidcIdToken` (the parsed JWT — read via `oidcUser.getIdToken()` line 48; the source of the `hd` claim)",
    "`OAuth2AuthenticationException` + `OAuth2Error('invalid_token', ...)` (the rejection vector when domain mismatch, lines 52-54)",
    "`DefaultOidcUser` (the constructor target — the enriched OidcUser the Spring chain consumes, lines 70-71)",
    "`Provider.GOOGLE` enum (the routing key; `shouldHandle` compares case-insensitively against `Provider.GOOGLE.name()` = 'GOOGLE', line 39)",
    "`GrantedAuthorityExtractor` (the role-set producer; called with isAdmin boolean to produce a Set<GrantedAuthority> of either {SimpleGrantedAuthority('ADMIN')} or {SimpleGrantedAuthority('USER')}, line 65 + GrantedAuthorityExtractor.java:12-17)",
    "`hd` claim (Google ID-token claim — Google's Workspace hosted-domain identifier; the literal `'hd'` is hardcoded as `GOOGLE_DOMAIN` at line 32)",
    "`email` claim (the default admin-principal lookup attribute when `provider.adminAttribute` is not set; literal `'email'` hardcoded as `GOOGLE_EMAIL` at line 31)"
  ]
- operations: [
    "lookup OAuth2Provider POJO by registrationId — line 45-46 (`oAuth2Properties.getClient().get(registrationId)`)",
    "read hd claim from ID-token — line 49 (`token.getClaim(GOOGLE_DOMAIN)`)",
    "verify domain (case-insensitive) — lines 50-55 (`StringUtils.equalsIgnoreCase(provider.getAllowedDomain(), domain)`)",
    "reject via OAuth2AuthenticationException on mismatch — lines 52-54",
    "lookup admin-principal claim (configurable, default `email`) — lines 57-59",
    "check admin-principal containment (case-insensitive) — line 60 (`containsIgnoreCase`)",
    "construct DefaultOidcUser with USER or ADMIN authority — lines 65, 70-71",
    "resolve userNameAttribute via Spring ClientRegistration → ProviderDetails → UserInfoEndpoint — lines 66-69 (note: NOT via provider.getUserNameAttribute())"
  ]
- invariants: [
    "(1) `shouldHandle` returns true only for `provider` equal-ignore-case to `'GOOGLE'` (line 39); any other string OR null/empty returns false. The dispatcher (`OAuthSecurityConfiguration.java:185-197`) picks the FIRST `shouldHandle==true` — so registration order in the Spring bean list determines which handler wins if multiple match (the conditional gating + `Provider` enum uniqueness makes this safe in practice).",
    "(2) Domain-check is **second** defence layer for Google Workspace restriction. The FIRST layer is at `OAuthSecurityConfiguration.java:168-175` where the authorize URL is mutated to append `?hd={allowedDomain}` (steering Google's account-picker to that domain). The SECOND layer is THIS handler verifying the ID-token's `hd` claim matches at lines 49-55. The two layers compose: the first is a UX hint to Google's IDP; the second is the actual security enforcement. A user could bypass the first (by editing the URL) but still be rejected by the second.",
    "(3) `hd` claim is OPTIONAL on Google ID-tokens — only present for Workspace (G Suite) accounts. Personal `@gmail.com` accounts emit no `hd` claim, so `token.getClaim('hd')` returns null. When `provider.allowedDomain` is non-empty AND `hd` is null, the condition `!StringUtils.equalsIgnoreCase('odd.com', null)` is true → REJECT (line 50-51). Personal accounts cannot pass an allowedDomain'd config (intentional).",
    "(4) `adminAttribute` falls back to the literal `'email'` (line 31, GOOGLE_EMAIL) when `provider.adminAttribute` is unset. This DIFFERS from `AbstractOIDCUserHandler.java:33-35` which falls back to `userNameAttributeName` (the username attribute itself). Google's fallback is provider-specific because Google's stable identifier for admin matching is the email claim, not the `sub`.",
    "(5) `userNameAttribute` is read from Spring's `request.getClientRegistration().getProviderDetails().getUserInfoEndpoint().getUserNameAttributeName()` (lines 66-68), NOT from `provider.getUserNameAttribute()` (the POJO field). This DIVERGES from the abstract base — Cognito/Azure/Custom/ODDIAM all read `provider.getUserNameAttribute()` directly. Google handler defers to Spring's auto-discovery of the username attribute (which Spring reads from issuer-uri / .well-known/openid-configuration). The `Objects.requireNonNullElse(..., IdTokenClaimNames.SUB)` fallback at line 69 means missing-or-not-discovered username defaults to `sub` (subject — the OIDC standard primary identifier).",
    "(6) Admin-group support is ABSENT. Google handler reads `adminPrincipals` ONLY — `adminGroups` is not consulted (the `AbstractOIDCUserHandler.java:44-55` code path doesn't exist here). Operators who set `auth.oauth2.client.google.admin-groups` see ZERO effect — the field binds successfully on the POJO but is silently ignored by this handler. The live doc page also doesn't document admin-groups for Google (confirmed by WebFetch — see docs_link_semantic), so the omission is internally consistent BUT undocumented and silent. (Google IDPs do emit a `groups` claim for Workspace deployments via custom claims, so the absence is a feature gap, not a Google IDP limitation.)",
    "(7) The handler is `@Conditional(GoogleCondition.class)` — only registered as a Spring bean when ANY `auth.oauth2.client.*.provider` equals 'google' (via `AbstractProviderCondition.getRegisteredProviders(env)` reading the Environment, GoogleCondition.java:12-13). In a deployment without a Google client, this bean does not exist and the dispatcher list never includes it. Conversely, a deployment with TWO Google clients (e.g. `auth.oauth2.client.google_corp.provider=google` + `auth.oauth2.client.google_personal.provider=google`) instantiates ONE handler bean that serves both (provider==Provider.GOOGLE matches both via shouldHandle — but the per-request provider lookup at `OAuthSecurityConfiguration.java:199-201` resolves which registrationId is in play and the handler reads the corresponding `OAuth2Provider` POJO from the map at lines 45-46)."
  ]
- audiences: [
    "Spring container during bean wiring under `auth.type=OAUTH2` AND `auth.oauth2.client.*.provider=google` configurations — registered as `@Component` and injected into `OAuthSecurityConfiguration.oidcUserHandlers : List<OAuthUserHandler<OidcUser, OidcUserRequest>>` at OAuthSecurityConfiguration.java:80",
    "`OAuthSecurityConfiguration.customOidcUserService()` (line 116-126) — the bean that invokes `enrichUserWithProviderInformation` per login via the dispatcher",
    "Indirectly: every Google-OAuth2 authenticated user — their ADMIN-or-USER role + hd-claim verification gate runs through this bean ONCE per login",
    "Downstream: AuthIdentityProviderImpl (F-011 hop 2) consumes the resulting `OAuth2AuthenticationToken.authorizedClientRegistrationId` (the map-key, NOT the 'google' string) to construct `UserDto(username, registrationId)` — so a deployment with `client.google_corp` produces `UserDto(name, 'google_corp')`, NOT `UserDto(name, 'google')`"
  ]

## dependencies_semantic

- requires-feature: [
    "Spring Security OAuth2 OIDC reactive client (`OidcReactiveOAuth2UserService` delegates to this handler via `customOidcUserService` — OAuthSecurityConfiguration.java:116-126)",
    "ODDOAuth2Properties POJO (ODDOAuth2Properties.java:11-53) — provides `allowedDomain`, `adminPrincipals`, `adminAttribute` per-client",
    "GrantedAuthorityExtractor (auth/mapper/GrantedAuthorityExtractor.java:10-18) — produces the USER/ADMIN SimpleGrantedAuthority set",
    "GoogleCondition gating (GoogleCondition.java:10-15) — bean is conditional on presence of any client with `provider: google` in the bound Environment",
    "Google IDP emitting `hd` claim for Workspace accounts (RFC-style — `hd` is Google's documented OIDC custom claim; not part of the OIDC spec; personal `@gmail.com` accounts omit it)"
  ]
- requires-config: [
    "`auth.oauth2.client.{id}.provider` — must equal 'google' case-insensitive for `shouldHandle` to fire (line 39)",
    "`auth.oauth2.client.{id}.allowed-domain` (OPTIONAL) — Google Workspace hosted domain; when set, the hd-claim mismatch causes login rejection (line 50-55) + the authorize URL gets `?hd={domain}` appended at OAuthSecurityConfiguration.java:171",
    "`auth.oauth2.client.{id}.admin-principals` (OPTIONAL) — list of principal identifiers; when contained-ignore-case in the resolved admin-attribute claim, grants ADMIN (lines 56-64)",
    "`auth.oauth2.client.{id}.admin-attribute` (OPTIONAL) — name of the claim to look up admin principals against; defaults to literal `'email'` for Google when unset (line 58, GOOGLE_EMAIL)",
    "`auth.oauth2.client.{id}.user-name-attribute` (NOTE: read INDIRECTLY) — NOT read from the POJO directly; Spring's `ClientRegistration.ProviderDetails.UserInfoEndpoint.getUserNameAttributeName()` is consulted instead (lines 66-68); this comes from `auth.oauth2.client.{id}.user-name-attribute` in YAML via Spring's binding to `ClientRegistrationProperties`, not via ODD's POJO field. Falls back to `IdTokenClaimNames.SUB = 'sub'` (line 69)",
    "`auth.oauth2.client.{id}.admin-groups` — SILENTLY IGNORED by this handler (the field binds on the POJO but no read site exists here; bugs_limitations_corner_cases[0] for the doc-vs-code semantic gap)"
  ]
- requires-runtime: [
    "Spring WebFlux + Reactor 3 — `Mono<OidcUser>` return signature, line 23 import",
    "Spring Security 6 OIDC types — `OidcUser`, `OidcUserRequest`, `OidcIdToken`, `DefaultOidcUser`, `IdTokenClaimNames.SUB`, `OAuth2AuthenticationException`, `OAuth2Error` (lines 14-22)",
    "Apache Commons Collections (`CollectionUtils.isNotEmpty` line 6) + Apache Commons Lang (`StringUtils.isNotEmpty`, `StringUtils.equalsIgnoreCase` line 7)",
    "Lombok `@RequiredArgsConstructor` — auto-injects the two final fields (line 5, 29)",
    "Custom utility `OperationUtils.containsIgnoreCase` (line 25 static import) — case-insensitive list contains for the admin-principal check"
  ]
- couples-to: [
    "`OAuthUserHandler<OidcUser, OidcUserRequest>` interface (auth/handler/OAuthUserHandler.java:7-11) — the chain-of-responsibility contract",
    "`OAuthSecurityConfiguration.oidcUserHandlers : List<...>` (OAuthSecurityConfiguration.java:80) — the dispatcher's source list; this bean is one element",
    "`ODDOAuth2Properties.OAuth2Provider` POJO (ODDOAuth2Properties.java:30-53) — read via `oAuth2Properties.getClient().get(registrationId)` at line 46",
    "`AuthIdentityProviderImpl` (F-011 hop 2) — consumes the resulting OAuth2AuthenticationToken downstream; the registrationId from the request becomes the `provider` field in UserDto at AuthIdentityProviderImpl.java:29-30",
    "`GrantedAuthorityExtractor` (auth/mapper/GrantedAuthorityExtractor.java:10-18) — produces the SimpleGrantedAuthority set passed to DefaultOidcUser",
    "Sibling handlers: `AbstractOIDCUserHandler` (the abstract base Google does NOT extend — divergent pattern), `GithubUserHandler`, `CognitoUserHandler` (extends AbstractOIDC), `AzureUserHandler` (extends AbstractOIDC), `ODDIAMUserHandler` (does NOT extend; flag-based admin), `CustomOIDCUserHandler` (extends AbstractOIDC; the catch-all 'not in Provider enum' handler at CustomOIDCUserHandler.java:28-34)",
    "Sibling logout: `GoogleLogoutSuccessHandler` (auth/logout/GoogleLogoutSuccessHandler.java:24-58) — POSTs to `https://oauth2.googleapis.com/revoke` on logout; pairs with this handler's enrichment but operates on a distinct lifecycle event"
  ]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "shouldHandle returns true for 'google', 'GOOGLE', 'Google'; returns false for 'GOOGL', 'google ', null, empty"
    test_class: GoogleUserHandlerTest
  - behaviour: "shouldHandle returns false for any non-Google provider string (e.g. 'github', 'azure', 'okta')"
    test_class: GoogleUserHandlerTest
  - behaviour: "enrichUserWithProviderInformation rejects with OAuth2AuthenticationException('invalid_token') when provider.allowedDomain='odd.com' and IdToken.hd='other.com'"
    test_class: GoogleUserHandlerTest
  - behaviour: "enrichUserWithProviderInformation rejects when provider.allowedDomain='odd.com' and IdToken has no hd claim (personal @gmail.com account scenario)"
    test_class: GoogleUserHandlerTest
  - behaviour: "enrichUserWithProviderInformation accepts when provider.allowedDomain='odd.com' and IdToken.hd='ODD.COM' (case-insensitive match via StringUtils.equalsIgnoreCase)"
    test_class: GoogleUserHandlerTest
  - behaviour: "enrichUserWithProviderInformation skips domain check when provider.allowedDomain is empty/null (no rejection even with mismatched hd)"
    test_class: GoogleUserHandlerTest
  - behaviour: "Admin detection: provider.adminPrincipals=['john@odd.com'] + IdToken.email='john@odd.com' → ADMIN role"
    test_class: GoogleUserHandlerTest
  - behaviour: "Admin detection case-insensitive: provider.adminPrincipals=['john@odd.com'] + IdToken.email='JOHN@ODD.COM' → ADMIN (containsIgnoreCase)"
    test_class: GoogleUserHandlerTest
  - behaviour: "Admin detection with explicit adminAttribute: provider.adminAttribute='sub' + provider.adminPrincipals=['sub-12345'] + IdToken.sub='sub-12345' → ADMIN"
    test_class: GoogleUserHandlerTest
  - behaviour: "Admin detection fallback: provider.adminAttribute unset → reads 'email' claim (the literal GOOGLE_EMAIL at line 31), NOT userNameAttribute (which diverges from AbstractOIDCUserHandler)"
    test_class: GoogleUserHandlerTest
  - behaviour: "Non-admin user: provider.adminPrincipals=['john@odd.com'] + IdToken.email='alice@odd.com' → USER role"
    test_class: GoogleUserHandlerTest
  - behaviour: "Admin-groups silently ignored: provider.adminGroups=['workspace-admins'] + IdToken.groups=['workspace-admins'] → STILL USER role (Google handler does not read adminGroups)"
    test_class: GoogleUserHandlerTest
  - behaviour: "userNameAttribute resolution from ClientRegistration.ProviderDetails.UserInfoEndpoint (NOT from provider.getUserNameAttribute) — assert the DefaultOidcUser is constructed with userNameAttribute equal to the Spring-discovered attribute, not the ODD POJO field"
    test_class: GoogleUserHandlerTest
  - behaviour: "userNameAttribute fallback to IdTokenClaimNames.SUB ('sub') when ClientRegistration's UserInfoEndpoint.getUserNameAttributeName() returns null"
    test_class: GoogleUserHandlerTest
  - behaviour: "Defence-in-depth: hd-mismatch user who bypassed the OAuthSecurityConfiguration `?hd={domain}` URL hint by editing the URL is STILL rejected by the handler's hd-claim re-verification (line 49-55)"
    test_class: GoogleUserHandlerIntegrationTest
- test_files: []
- gaps: |
    Zero direct unit tests. Grep for `GoogleUserHandlerTest` / `GoogleUserHandler` / `OAuthUserHandler.*Test` under `<odd-platform-repo>/odd-platform-api/src/test` returned no matches. The handler runs ONCE per Google login and decides (a) reject vs accept + (b) ADMIN vs USER — both terminal authorization decisions with no downstream re-check. A regression in any branch silently changes the authorization posture: removing the hd-null check (line 50, the `!StringUtils.equalsIgnoreCase(allowed, null)`) would let personal @gmail.com accounts authenticate when an allowedDomain is configured (defence-in-depth failure); removing the admin-attribute default-to-email fallback would silently demote every admin to USER when adminAttribute is unset (a common config — operators only set adminAttribute when they need to override the default). The case-insensitive matching at lines 51 and 60 is the third regression vector — if `equalsIgnoreCase` were replaced with `equals` in either branch, valid configurations would fail. Test surface should cover at minimum: shouldHandle's three positive + multiple negative cases; the four branches of enrichUserWithProviderInformation (no allowedDomain + no adminPrincipals → USER; allowedDomain match + no adminPrincipals → USER; allowedDomain mismatch → reject; allowedDomain match + adminPrincipals match → ADMIN); the userNameAttribute resolution path via Spring's ClientRegistration; and the silent admin-groups ignore (regression-pin against any future maintainer who adds adminGroups support partially).

## docs_link_semantic

- declared_docs: [] — N/A (source file carries no `@docs` annotation)
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/oauth2-oidc"
    anchor: "#google"
    rationale: "The canonical OAuth2/OIDC docs page enumerating the per-provider configuration; the Google section names the fields this handler reads (provider, client-id, client-secret, scope, redirect-uri, client-name, issuer-uri, user-name-attribute, admin-attribute, admin-principals, allowed-domain). The handler IS the runtime consumer of those fields."
    last_verified_at: "2026-05-19T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Verbatim YAML example from the live page (WebFetched 2026-05-19, status 200):
      > "auth:
      >     type: OAUTH2
      >     oauth2:
      >         client:
      >             google:
      >                 provider: google
      >                 client-id: {client_id}
      >                 client-secret: {client_secret}
      >                 scope: openid,profile,email
      >                 redirect-uri: {host}/login/oauth2/code/google
      >                 client-name: Google
      >                 issuer-uri: https://accounts.google.com
      >                 user-name-attribute: name
      >                 admin-attribute: email
      >                 admin-principals: john@odd.com,david@odd.com
      >                 allowed-domain: odd.com"
      > "You can restrict users to login under your organization domain. This is controlled by `auth.oauth2.client.{client-id}.allowed-domain` property."
      Doc-side silences (verbatim from WebFetch):
      > "Hosted-domain (hd) claim: Not mentioned. The documentation does not reference the `hd` claim."
      > "Default admin-attribute: Not specified. The documentation provides no default value; the example shows `admin-attribute: email` but does not state this as a default."
      > "Default username-attribute: Not specified. The example shows `user-name-attribute: name` but does not declare this as a default."
      > "Admin Groups Support: Not mentioned for Google. Admin group functionality (`admin-groups`) is documented for AWS Cognito and GitHub only, not for Google."
      > "Rejection Behavior: Not documented. The page does not explain what happens when domain validation fails."
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/user-owner-association"
    anchor: ""
    rationale: "Downstream of this handler — once enrichment produces the OAuth2AuthenticationToken, AuthIdentityProviderImpl resolves the (username, 'google_corp') tuple via USER_OWNER_MAPPING. The owner-association doc anchors the downstream consumer's contract."
    last_verified_at: "2026-05-19T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      Verbatim (WebFetched 2026-05-19, status 200):
      > "User-owner relation is one-to-one relation, which means, that one user can be associated only with one owner and vice versa."
      The page contains NO mention of:
      > "Google OAuth users linked to Owners: Not addressed on this page."
      > "Provider field stored alongside username: Not addressed on this page."
      > "Hosted-domain (hd) claim for Google or domain-based restriction: Not addressed on this page."
- doc_drift_findings:
  - "**`hd` claim is undocumented as the enforcement mechanism.** The live OAuth2/OIDC docs (WebFetched 2026-05-19, status 200) state `allowed-domain` restricts users to the organization domain but never name the underlying mechanism — the Google ID-token `hd` claim. Operators with a non-Workspace (personal `@gmail.com`) account testing the deployment receive a generic `OAuth2AuthenticationException` with the message `\"Domain null doesn't match with allowed domain odd.com\"` (the literal hd=null surfaces in the error message), with no doc-side guidance that personal accounts can NEVER pass an allowedDomain check by design. evidence: GoogleUserHandler.java:32, 49-55 + live OAuth2/OIDC docs verbatim 'allowed-domain' description silent on hd. severity: MEDIUM (operator-debug-time confusion; the rejection-by-design behaviour is correct but invisible)."
  - "**Defence-in-depth structure is undocumented.** Google domain restriction enforces at TWO points: (a) `OAuthSecurityConfiguration.java:168-175` mutates the authorize URL to append `?hd={allowedDomain}` (steers Google's account picker), (b) THIS handler re-verifies the `hd` ID-token claim at lines 49-55 (the actual security enforcement). The live docs describe only the configuration field, not the two-layer enforcement. Operators auditing the security posture have no doc surface explaining where the check actually happens. evidence: GoogleUserHandler.java:49-55 + OAuthSecurityConfiguration.java:168-175 + live OAuth2/OIDC docs verbatim. severity: LOW (correct behaviour; doc-completeness gap)."
  - "**`admin-attribute` default-to-`email` for Google is undocumented.** The live OAuth2/OIDC docs explicitly state per WebFetch (2026-05-19): 'Default admin-attribute: Not specified. The documentation provides no default value; the example shows `admin-attribute: email` but does not state this as a default.' The handler hardcodes `GOOGLE_EMAIL = 'email'` as the fallback at line 31 and line 58. The example in the docs happens to set `admin-attribute: email` explicitly, masking the default behaviour. An operator who omits the field expecting it to be required (consistent with REFACTOR-152's per-provider-required-fields theme) will silently get the email-based admin lookup. severity: LOW (default behaviour is sensible; doc-completeness gap)."
  - "**`admin-groups` for Google is silently unsupported.** The live OAuth2/OIDC docs document `admin-groups` for AWS Cognito and GitHub, NOT for Google (WebFetched 2026-05-19, status 200). The `ODDOAuth2Properties.OAuth2Provider` POJO declares `adminGroups : Set<String>` (line 49 of ODDOAuth2Properties.java) — the field BINDS on every provider including Google. An operator who sets `auth.oauth2.client.google.admin-groups: [workspace-admins]` (perhaps following the GitHub/Cognito pattern) sees the field bind successfully at boot, but THIS handler never reads `provider.getAdminGroups()` — the configuration is silently ignored. The handler does not extend `AbstractOIDCUserHandler` which DOES read `provider.getAdminGroups()` at lines 44-55. The doc-vs-code drift: docs silent (consistent with NO support) AND handler silent (consistent with NO support) — but the POJO accepts the field. severity: MEDIUM (silent-no-op config = operator hostility — boot succeeds, admin role never assigned, no warning log)."
  - "**Rejection-on-domain-mismatch is undocumented.** Per the live docs verbatim (WebFetched 2026-05-19): 'Rejection Behavior: Not documented. The page does not explain what happens when domain validation fails.' The handler throws `OAuth2AuthenticationException(OAuth2Error('invalid_token', 'Domain X doesn't match with allowed domain Y', ''))` at lines 52-54 — this surfaces to the user as a 401-ish OAuth2 error page rather than a friendly 'Sorry, your account is not part of the allowed organization' message. severity: LOW (correct behaviour; user-facing error message quality gap)."

## upstream_callers

- caller: "OAuthSecurityConfiguration.customOidcUserService() — the bean factory wired at OAuthSecurityConfiguration.java:116-126"
  evidence: "OAuthSecurityConfiguration.java:118-125 — `delegate.loadUser(request).flatMap(oidcUser -> { final var handler = getOidcUserHandler(request.getClientRegistration().getRegistrationId()); if (handler.isEmpty()) return Mono.just(oidcUser); return handler.get().enrichUserWithProviderInformation(oidcUser, request); })`. The dispatcher (`getOidcUserHandler` at lines 185-190) iterates `oidcUserHandlers : List<OAuthUserHandler<OidcUser, OidcUserRequest>>` and selects the first `shouldHandle == true`. GoogleUserHandler IS one element of that list when `@Conditional(GoogleCondition.class)` matches."
  cardinality_per_call: "ONCE per Google OAuth2 login (per OidcUserRequest); the Mono is consumed by Spring's `ReactiveOAuth2UserService` chain"
- caller: "Spring Security OAuth2 OIDC login filter chain (oauth2Login() configured at OAuthSecurityConfiguration.java:99)"
  evidence: "OAuthSecurityConfiguration.java:99 — `.oauth2Login(withDefaults())` registers the standard Spring `OAuth2LoginAuthenticationWebFilter` which delegates to the `customOidcUserService` bean at line 116. The filter activates ONLY on the OAuth2 callback path `/login/oauth2/code/{registrationId}` (Spring default). This bean is INDIRECTLY upstream — the framework filter calls it via Spring's bean wiring."
  cardinality_per_call: "ONCE per OAuth2 callback; the resulting authenticated principal is stored in the WebSession for subsequent requests"

## downstream_side_effects

- effect: "Constructs DefaultOidcUser with ADMIN or USER GrantedAuthority + the original IdToken + UserInfo + a userNameAttribute string"
  evidence: "GoogleUserHandler.java:70-71 — `new DefaultOidcUser(authorities, oidcUser.getIdToken(), oidcUser.getUserInfo(), userNameAttribute)`. This object is the terminal output of the Mono and flows into Spring's OAuth2AuthenticationToken construction at the framework layer."
  side_effect_class: "principal-enrichment (in-memory; no I/O at the side-effect site; effect propagates through Spring's reactive context)"
- effect: "Rejects login via OAuth2AuthenticationException when hd-claim mismatch — Spring Security translates this to a 401-style redirect to the OAuth2 error page"
  evidence: "GoogleUserHandler.java:52-54 — `Mono.error(() -> new OAuth2AuthenticationException(new OAuth2Error('invalid_token', String.format('Domain %s doesn't match with allowed domain %s', domain, provider.getAllowedDomain()), '')))`. Spring's filter chain catches this and emits the 401 OAuth2 failure response (default behaviour); no audit log is emitted by THIS class."
  side_effect_class: "auth-decision (security boundary; rejection is the terminal effect for this user's session)"
- effect: "Downstream consumer: AuthIdentityProviderImpl (F-011 hop 2) reads the OAuth2AuthenticationToken's `authorizedClientRegistrationId` to construct `UserDto(username, registrationId)` — the registrationId is the MAP KEY (e.g. 'google_corp'), NOT the literal 'google' string"
  evidence: "AuthIdentityProviderImpl.java:29-30 — `oauthToken.getAuthorizedClientRegistrationId()`. The registrationId becomes the `provider` field on UserDto, which is the partition key for USER_OWNER_MAPPING lookups at ReactiveUserOwnerMappingRepositoryImpl.java:116-127. NOTE: the registrationId is the user-chosen map key (e.g. `auth.oauth2.client.google_corp` → 'google_corp'), NOT the Provider enum string ('GOOGLE')."
  side_effect_class: "downstream-coupling (this handler's enrichment determines whether AuthIdentityProviderImpl sees a token at all; the registrationId-as-partition-key is the downstream contract)"
- effect: "Implicit registration in Spring bean list `oidcUserHandlers : List<...>`"
  evidence: "OAuthSecurityConfiguration.java:80 — `private final List<OAuthUserHandler<OidcUser, OidcUserRequest>> oidcUserHandlers;`. Spring auto-collects every `OAuthUserHandler<OidcUser, OidcUserRequest>` bean (Google + Cognito + Azure + ODD_IAM via @Component + @Conditional). The list order is Spring's @Order/@DependsOn or insertion-order (no explicit @Order on this class), so dispatcher behaviour depends on Spring's collection ordering (an under-documented dependency)."
  side_effect_class: "bean-wiring (compile-time + runtime; the @Conditional gating means absent in non-Google deployments)"

## implicit_adrs

- "**Google `allowed-domain` enforces via two-layer defence-in-depth: (1) URL hint `?hd={domain}` at the authorize endpoint, (2) hd-claim re-verification on the ID-token.** The first layer steers Google's account picker (UX); the second layer is the actual enforcement that survives URL editing. The maintainer's intent is to NOT trust the URL-mutation alone — the explicit hd-claim check at lines 49-55 is the defence-in-depth instance. Per ADR-CANDIDATE-034 (the inline-URL-mutation-for-trivial-customisations pattern), the URL mutation is a one-line customisation; per THIS sidecar, the handler-side verification is the load-bearing security check. The pattern is reusable for any future provider that emits a verifiable claim corresponding to a URL-side hint." — evidence: GoogleUserHandler.java:49-55 + OAuthSecurityConfiguration.java:168-175 — intent_anchor: "the hd-claim verification + the URL mutation are TWO SEPARATE sites of enforcement that must BOTH succeed for an out-of-domain user to authenticate — the maintainer wrote the second-layer check explicitly rather than relying on Google IDP's URL-side restriction alone" — confidence: HIGH
- "**Google `admin-attribute` defaults to `email` (provider-specific), NOT to the username attribute (the abstract base's default).** Per line 58: `final String adminPrincipalAttribute = StringUtils.isNotEmpty(provider.getAdminAttribute()) ? provider.getAdminAttribute() : GOOGLE_EMAIL;` where `GOOGLE_EMAIL = 'email'` (line 31). Per AbstractOIDCUserHandler.java:34-35: `final String adminPrincipalAttribute = StringUtils.isNotEmpty(provider.getAdminAttribute()) ? provider.getAdminAttribute() : userNameAttributeName;`. The maintainer's intent: for Google, the stable admin-matching identifier is `email` (verified Workspace email), not the OIDC `sub` (which is opaque). The provider-specific default IS the decision — emails are the operator's natural admin list (consistent with `admin-principals: john@odd.com,david@odd.com` in the live doc example). This is the per-provider-knowledge codified." — evidence: GoogleUserHandler.java:31, 56-59 + AbstractOIDCUserHandler.java:33-35 (contrast) — intent_anchor: "the named constant `GOOGLE_EMAIL = 'email'` + the explicit per-handler ternary at line 57-58 — the maintainer wrote a Google-specific default that diverges from the abstract base's username-based default" — confidence: HIGH
- "**Google handler diverges from the AbstractOIDCUserHandler base class (no inheritance) — provider-specific quirks override generic-OIDC patterns.** Cognito, Azure, Custom all extend `AbstractOIDCUserHandler` (cognito/azure: just override two `getDefault*` template methods; custom: catches the not-in-Provider-enum case). Google does NOT extend the abstract base. The reasons (inferred from the divergence): (a) Google's hd-claim verification has no analogue in the abstract base; (b) Google's userNameAttribute is read from Spring's ClientRegistration not the ODD POJO (lines 66-68); (c) Google's admin-attribute defaults to `email`, not userNameAttributeName; (d) Google's logout path POSTs to `oauth2.googleapis.com/revoke` (GoogleLogoutSuccessHandler.java) which is a Google-API-specific call. The maintainer's intent: Google's provider-specific quirks accumulated beyond the abstract base's template-method extension points, so the handler is fully bespoke. The pattern: when 2+ provider-quirks accumulate, drop the abstract base. This composes with ADR-CANDIDATE-034 (the hybrid pattern is exactly this — quirky providers diverge; cookie-cutter providers extend the base)." — evidence: GoogleUserHandler.java:30 (`implements OAuthUserHandler<OidcUser, OidcUserRequest>` — direct interface, NO `extends AbstractOIDCUserHandler`) + CognitoUserHandler.java:16 (`extends AbstractOIDCUserHandler`) + AzureUserHandler.java:16 (`extends AbstractOIDCUserHandler`) + CustomOIDCUserHandler.java:19 (`extends AbstractOIDCUserHandler`) — intent_anchor: "GoogleUserHandler is the ONLY OIDC handler that bypasses the abstract base — the absence of `extends AbstractOIDCUserHandler` IS the decision; the maintainer accepted code duplication (lines 56-65 mirror AbstractOIDCUserHandler.java:33-43) to express Google-specific behaviour without forcing the abstract base to support hd-claim verification" — confidence: HIGH
- "**Reactive Mono.error for the rejection path — symmetric to GithubUserHandler.java:90 — establishes the failure-via-Mono.error convention for OAuth user handlers.** The handler builds the exception lazily via `Mono.error(() -> new OAuth2AuthenticationException(...))` rather than throwing synchronously. The pattern is consistent across handlers that reject: GithubUserHandler.java:90 uses the same `Mono.error(() -> new OAuth2AuthenticationException(...))` for the org-membership-failure path. The maintainer's intent: reject inside the reactor chain so Spring's reactive error handling catches it at the framework layer (and emits the 401 redirect to the OAuth2 error page) — synchronous throw inside a reactive lambda would be a Reactor anti-pattern that causes context loss. The convention is now visible at TWO Mono.error rejection sites (Google + GitHub) — pattern-level intent." — evidence: GoogleUserHandler.java:52-54 + GithubUserHandler.java:90 — intent_anchor: "`Mono.error(() -> new OAuth2AuthenticationException(...))` — the lazy supplier form + the OAuth2AuthenticationException + OAuth2Error('invalid_token', ...) trio is the established pattern; both handlers use it identically" — confidence: HIGH

## bugs_limitations_corner_cases

- "**`admin-groups` config silently no-op for Google.** `ODDOAuth2Properties.OAuth2Provider.adminGroups : Set<String>` (line 49 of the POJO) binds successfully from `auth.oauth2.client.google.admin-groups: [...]` YAML. The handler NEVER reads `provider.getAdminGroups()` — the value is silently ignored at every login. An operator copying the Cognito/GitHub admin-groups configuration pattern to Google gets zero behaviour change and zero warning. The bug class: silent no-op config IS operator hostility — no boot warning, no log, no rejection. Mitigations: (a) validate at boot (reject if `adminGroups` is set for a `provider=google` client), (b) implement admin-groups via Google's `groups` custom claim (Workspace supports this), (c) document explicitly. severity: MEDIUM (security-policy gap: operator's intended ADMIN-by-group never takes effect, the user is silently USER)." — evidence: GoogleUserHandler.java:1-74 (no `getAdminGroups()` call anywhere) + ODDOAuth2Properties.java:49 (field binds) + AbstractOIDCUserHandler.java:44-55 (the supported analogue in the abstract base)
- "**`shouldHandle` is FIRST-MATCH-WINS in an unordered Spring bean list.** `OAuthSecurityConfiguration.oidcUserHandlers : List<...>` (line 80) collects every OIDC handler bean — Google, Cognito, Azure, Custom, plus any future @Component. The dispatcher at OAuthSecurityConfiguration.java:185-189 picks the FIRST `shouldHandle == true`. Spring's collection ordering for `List<T>` injection is bean-declaration / class-file scan order (no explicit @Order on Google/Cognito/Azure/Custom). The current bean set is uniquely-disjoint (each handler matches a distinct provider string), so first-match-wins is safe. BUT `CustomOIDCUserHandler.shouldHandle` at line 28-34 returns `true` for ANY provider NOT in the `Provider` enum — and Spring's list ordering would matter if a future handler added overlapping coverage. The fragility: a future maintainer adding a `OktaUserHandler` (with `shouldHandle` returning true for 'okta') depends on Spring picking it BEFORE CustomOIDCUserHandler in the list — but CustomOIDCUserHandler doesn't claim 'okta' until the list is iterated. Today this works by luck; the dispatcher should pin order with @Order or filter Custom last. severity: LOW (latent — only triggers if overlap is introduced)." — evidence: GoogleUserHandler.java:38-40 + OAuthSecurityConfiguration.java:185-189 + CustomOIDCUserHandler.java:28-34
- "**Rejection emits `'Domain null doesn't match with allowed domain odd.com'` for personal `@gmail.com` accounts.** When a non-Workspace user tries to log in to an allowedDomain'd deployment, the hd-claim is null → the error message literally interpolates `null` into the string at line 53: `String.format(\"Domain %s doesn't match with allowed domain %s\", domain, provider.getAllowedDomain())`. The end-user sees `'Domain null doesn't match with allowed domain odd.com'` in the Spring OAuth2 error page. severity: LOW (UX quality; correct rejection but unhelpful message). The fix is one-line: branch on `domain == null` → friendlier 'Your account is not part of an allowed organization' message. evidence: GoogleUserHandler.java:52-54"
- "**Personal `@gmail.com` accounts cannot pass `allowed-domain` (by design, but undocumented).** Google's `hd` claim is emitted ONLY for Workspace (G Suite) accounts. Personal accounts have no `hd` in their ID-token. When `provider.allowedDomain = 'odd.com'` and the user is `alice@gmail.com`, line 49 reads `hd=null`, line 50-51 evaluates `!StringUtils.equalsIgnoreCase('odd.com', null) = true` → REJECT. This is correct security behaviour (an operator who set allowed-domain wants ONLY Workspace users from that domain), but it's NOT documented anywhere as 'personal Google accounts cannot authenticate under an allowed-domain configuration'. An operator testing the deployment with their personal account during dev is mystified by the rejection. severity: LOW (correct behaviour; doc-completeness gap; also tracked in docs_link_semantic.doc_drift_findings[0])." — evidence: GoogleUserHandler.java:49-55 + (RFC-style: hd claim is Google's documented OIDC custom claim for Workspace only)
- "**No null-guard on `provider` — NullPointerException if `oAuth2Properties.getClient().get(registrationId)` returns null.** Line 46: `final ODDOAuth2Properties.OAuth2Provider provider = oAuth2Properties.getClient().get(registrationId);`. If `registrationId` isn't present in the map (a Spring framework guarantee violation, but possible during reconfigure-without-restart scenarios with dynamic Spring contexts), `provider` is null and line 50 `provider.getAllowedDomain()` throws NPE. The other handlers (AbstractOIDCUserHandler.java:28, GithubUserHandler.java:52, ODDIAMUserHandler.java:35) have the same pattern — uniformly no null-guard. The fragility is shared across all handlers, not specific to Google. severity: LOW (Spring guarantees registrationId is bound at registration; only triggers in pathological reconfigure scenarios). evidence: GoogleUserHandler.java:46-50"
- "**Configurable `adminAttribute` accepts ANY claim string — no whitelist, no schema check.** Line 57-58: `provider.getAdminAttribute()` is used verbatim as the claim name to look up at line 59 (`token.getClaim(adminPrincipalAttribute)`). An operator with `admin-attribute: arbitrary_claim_name` reads `token.getClaim('arbitrary_claim_name')` — if the claim doesn't exist, the result is null, `containsIgnoreCase(adminPrincipals, null)` returns false, isAdmin stays false. Silent-no-op for typos: `admin-attribute: emale` → no admin is ever assigned. severity: LOW (the silent-no-op-on-typo is consistent with the broader OAuth2Properties pattern — REFACTOR-152 + REFACTOR-154 capture this class of unvalidated-string-config). evidence: GoogleUserHandler.java:56-64"
- "**`userNameAttribute` resolution path is DIFFERENT from sibling handlers — divergent from AbstractOIDCUserHandler / GithubUserHandler / ODDIAMUserHandler convention.** GoogleUserHandler reads `request.getClientRegistration().getProviderDetails().getUserInfoEndpoint().getUserNameAttributeName()` at lines 66-68 (Spring auto-discovery from issuer-uri `.well-known/openid-configuration` OR explicit `auth.oauth2.client.google.user-name-attribute` YAML field via Spring's `ClientRegistrationProperties` binding). All other handlers read `provider.getUserNameAttribute()` (the ODD POJO field directly). The divergence means: a Google client without `user-name-attribute` in YAML gets Spring's auto-discovery (typically defaults to `name` or `sub`); a Cognito/Azure client without `user-name-attribute` gets the abstract base's default (`cognito:username` / `name`). The inconsistency is an architectural irregularity — same config field, different read paths. severity: LOW (latent — both paths converge to similar behaviour; future maintenance hazard if Spring's ClientRegistration metadata format changes). evidence: GoogleUserHandler.java:66-68 + AbstractOIDCUserHandler.java:29-30 (contrast) + GithubUserHandler.java:53 (contrast)"

## security

- **auth_mode_relevance**: `OAUTH2`. This handler is wired ONLY under `auth.type=OAUTH2` (via `OAuthSecurityConfiguration` which is `@ConditionalOnProperty(value="auth.type", havingValue="OAUTH2")` at line 71). Within OAUTH2 mode, the handler is FURTHER gated by `@Conditional(GoogleCondition.class)` — bean exists only if at least one `auth.oauth2.client.*.provider` is 'google' (GoogleCondition.java:12-13). Under DISABLED / LOGIN_FORM / LDAP, this bean does not exist (Spring's @Conditional skips bean registration); under OAUTH2-without-Google, the bean also does not exist. evidence: GoogleUserHandler.java:27-28 + GoogleCondition.java:10-15 + OAuthSecurityConfiguration.java:71.
- **ingestion_filter_relevance**: `N/A — not HTTP`. This is a Spring bean invoked by the OAuth2 login filter chain on the `/login/oauth2/code/{registrationId}` callback path; it is NOT part of the `/ingestion/entities` flow. The ingestion filter is wired separately (S2sAuthenticationFilter at OAuthSecurityConfiguration.java:108-110).
- **authorization_assertions**: `[]` — this handler enforces NO authorization gates at the HTTP-endpoint level. It enriches the principal with role information (ADMIN | USER) BEFORE the request reaches any controller; the enriched authorities are then evaluated by `@PreAuthorize` annotations / `ReactiveResourcePermissionAuthorizationManager` downstream. evidence: GoogleUserHandler.java:30-73 (no @PreAuthorize, no PermissionService call, no programmatic authorization check).
- **owner_scoping**: `N/A — code is not data-scoped`. The handler manipulates Spring Security authorities + the OAuth2 token; it does NOT query catalog data and does NOT call `fetchAssociatedOwner` (that happens later, at AuthIdentityProviderImpl, when downstream services need the owner-id). evidence: GoogleUserHandler.java:1-74 (no AuthIdentityProvider injection, no repository injection).
- **data_exposure**:
  - "**hd-claim value surfaces in the error message.** Line 53: `String.format(\"Domain %s doesn't match with allowed domain %s\", domain, provider.getAllowedDomain())` — both the user's Google Workspace domain (or 'null' for personal accounts) AND the operator's `allowedDomain` are interpolated. The message is visible to the user via Spring's OAuth2 error page. The user's email domain is low-sensitivity (the user knows their own email); the OPERATOR's `allowedDomain` is exposed to any failed-login attempt — including unauthenticated attackers who can trigger the rejection. evidence: GoogleUserHandler.java:52-54"
  - "**Admin-principal list (operator-controlled) leaks indirectly via successful-admin login.** Once an ADMIN is assigned at line 65 + 70-71, the resulting OAuth2AuthenticationToken carries the ADMIN authority; the UI exposes admin-only surfaces (RBAC management, etc.) which is by design. The admin-principal list itself is not echoed back to the user, but successful admin login confirms membership in the list. evidence: GoogleUserHandler.java:56-65"
- **known_security_gaps**:
  - "**`admin-groups` silently no-op (security policy gap):** An operator setting `auth.oauth2.client.google.admin-groups: [workspace-admins]` expects group-based admin assignment (matching the Cognito/GitHub pattern). The handler never reads `provider.getAdminGroups()` — the user is silently USER. The intended ADMIN-by-group never activates; depending on the operator's policy, admin endpoints may be entirely unprotected for the intended admins (they cannot access admin surfaces because they're never granted ADMIN). severity: MEDIUM (silent policy failure; operator's mental model violated). evidence: GoogleUserHandler.java:1-74 (no admin-groups read) + ODDOAuth2Properties.java:49 (field exists, binds, ignored)"
  - "**Defence-in-depth is correct but undocumented (operator-audit gap):** The two-layer enforcement (URL `?hd=` hint + handler-side hd-claim verification) is correct security — but an operator auditing the security posture by reading the docs ONLY sees the `allowed-domain` field description, no mention of the enforcement mechanism. The audit-trail is invisible. The risk: a maintainer refactor that drops layer (a) silently (e.g. an Okta-like provider adding similar config that doesn't get the URL mutation) would degrade the protection to single-layer only — diagnosable only by reading the source. severity: LOW (correct behaviour; doc-completeness gap; mitigation: documented in ADR-CANDIDATE-034). evidence: GoogleUserHandler.java:49-55 + OAuthSecurityConfiguration.java:168-175"
  - "**Personal-account rejection emits unhelpful error message:** `Domain null doesn't match with allowed domain odd.com` is the literal error text shown to a personal `@gmail.com` user attempting to log into an allowedDomain'd deployment. The message leaks 'null' (an implementation detail) to the user and offers no path forward. Beyond UX gap, this is a low-severity information disclosure (the attacker learns the deployment's allowedDomain is set, which they could already infer from the `?hd=odd.com` query parameter on the authorize URL). severity: LOW (UX + minor info-disclosure). evidence: GoogleUserHandler.java:52-54"
  - "**No audit log emitted on rejection or admin-grant:** The handler does not log either the hd-mismatch rejection (line 52) or the ADMIN role assignment (line 62). An operator investigating a security incident has no in-app trail showing 'user X attempted to log in, was rejected due to hd-mismatch' or 'user Y was granted ADMIN due to admin-principal match'. severity: MEDIUM (observability gap; ALL OAuth handlers share this characteristic — symmetric finding across the chain). evidence: GoogleUserHandler.java:1-74 (no log statements; no @Slf4j on the class)"
  - "**Downstream feeds F-011 (P-09:F-002 Principal-to-Owner Resolution) — the registrationId becomes the partition key for owner-scoping:** This handler's output (the OAuth2AuthenticationToken) flows into AuthIdentityProviderImpl which uses `authorizedClientRegistrationId` (the map key like 'google_corp', NOT the literal 'google') as the `provider` field in UserDto. F-011's facets `s2s_admin_username_collision_security_boundary` + `login_form_ldap_provider_null_cross_mode_bleed` apply DOWNSTREAM of this handler — Google users do NOT exhibit cross-mode bleed because they get a non-null provider string. severity: N/A (this handler is on the SAFE side of F-011's bleed; backlink for cross-feature consistency). evidence: GoogleUserHandler.java:70-71 (no provider manipulation; the registrationId is preserved by Spring) + AuthIdentityProviderImpl.java:29-30 (the downstream reader)"

## performance

- **hot_paths**:
  - "Per-login enrichment: ONE invocation per Google OAuth2 login. Reads ID-token claims (`getClaim('hd')`, `getClaim(adminAttribute)`) which are in-memory parsed-JWT lookups (no I/O). Calls `containsIgnoreCase` on the adminPrincipals list (O(N) where N = list size, typically small). No DB, no HTTP, no external dependencies. The handler is NOT on a request-rendering hot path — only on login. evidence: GoogleUserHandler.java:42-73 (no Mono.flatMap to external resources)"
- **throughput_characteristics**:
  - "single-Mono signature; non-blocking but invoked synchronously (no I/O so no real reactor benefit; the Mono is a Reactor convention to fit the dispatcher's signature)",
  - "stateless — the handler holds two immutable injected fields (GrantedAuthorityExtractor + ODDOAuth2Properties); instances scale horizontally with no coordination",
  - "ONE login = ONE invocation of this handler; throughput bounded by Google's OAuth2 IDP response latency (handler itself is sub-millisecond)"
- **resource_allocation**:
  - "memory: per-invocation, constructs a DefaultOidcUser holding the IdToken + UserInfo + a Set<GrantedAuthority> (size 1) — small (< 10KB)",
  - "no client-side caching; not needed (per-login only)",
  - "no DB connection, no HTTP client, no thread-pool consumption beyond the Reactor scheduler the dispatcher invokes on"
- **scaling_characteristics**:
  - "stateless — pure function of (oidcUser, request, oAuth2Properties); horizontally scalable",
  - "no advisory locks, no in-memory state, no rate-limiting",
  - "no pagination (terminal handler, returns single Mono<DefaultOidcUser>)"
- **known_performance_gaps**: []
  
## sources

- understanding ← GoogleUserHandler.java:1-74 (entire file) + OAuthUserHandler.java:7-11 + GoogleCondition.java:10-15 + AbstractOIDCUserHandler.java:21-64 (contrast for divergence claim)
- concepts.entities.OidcUser ← GoogleUserHandler.java:20 (import)
- concepts.entities.OidcUserRequest ← GoogleUserHandler.java:15 (import)
- concepts.entities.OAuth2Provider ← GoogleUserHandler.java:8 (import) + GoogleUserHandler.java:46 (usage) + ODDOAuth2Properties.java:30-53 (the type)
- concepts.entities.OidcIdToken ← GoogleUserHandler.java:18 (import) + line 48 (usage)
- concepts.entities.OAuth2AuthenticationException ← GoogleUserHandler.java:16-17 (imports) + lines 52-54
- concepts.entities.DefaultOidcUser ← GoogleUserHandler.java:20 (import) + lines 70-71
- concepts.entities.Provider.GOOGLE ← GoogleUserHandler.java:9 (import) + Provider.java:3-5
- concepts.entities.GrantedAuthorityExtractor ← GoogleUserHandler.java:12 (import) + GrantedAuthorityExtractor.java:10-18
- concepts.entities.hd-claim ← GoogleUserHandler.java:32 (GOOGLE_DOMAIN constant) + line 49 (usage)
- concepts.entities.email-claim ← GoogleUserHandler.java:31 (GOOGLE_EMAIL constant) + line 58 (fallback)
- concepts.operations.lookup-provider-pojo ← GoogleUserHandler.java:45-46
- concepts.operations.read-hd-claim ← GoogleUserHandler.java:49
- concepts.operations.verify-domain ← GoogleUserHandler.java:50-55
- concepts.operations.reject-mono-error ← GoogleUserHandler.java:52-54
- concepts.operations.lookup-admin-claim ← GoogleUserHandler.java:57-59
- concepts.operations.containsIgnoreCase-admin ← GoogleUserHandler.java:60 + OperationUtils import line 25
- concepts.operations.construct-defaultoidcuser ← GoogleUserHandler.java:65, 70-71
- concepts.operations.resolve-username-attribute ← GoogleUserHandler.java:66-69
- concepts.invariants.[1] (shouldHandle first-match-wins) ← GoogleUserHandler.java:38-40 + OAuthSecurityConfiguration.java:185-189
- concepts.invariants.[2] (two-layer hd defence) ← GoogleUserHandler.java:49-55 + OAuthSecurityConfiguration.java:168-175
- concepts.invariants.[3] (hd optional for personal accounts) ← GoogleUserHandler.java:49-55 (the `equalsIgnoreCase(allowed, null) = false` evaluation)
- concepts.invariants.[4] (admin-attribute defaults to email) ← GoogleUserHandler.java:31, 56-59 + AbstractOIDCUserHandler.java:33-35 (contrast)
- concepts.invariants.[5] (userNameAttribute via ClientRegistration) ← GoogleUserHandler.java:66-69 + AbstractOIDCUserHandler.java:29-30 (contrast)
- concepts.invariants.[6] (admin-groups ABSENT) ← GoogleUserHandler.java:1-74 (no getAdminGroups call) + AbstractOIDCUserHandler.java:44-55 (the supported pattern) + live OAuth2/OIDC docs WebFetched 2026-05-19 status 200 (silent on admin-groups for Google)
- concepts.invariants.[7] (@Conditional gating) ← GoogleUserHandler.java:28 + GoogleCondition.java:10-15
- concepts.audiences.[*] ← OAuthSecurityConfiguration.java:80 (oidcUserHandlers list) + OAuthSecurityConfiguration.java:116-126 (customOidcUserService dispatcher) + AuthIdentityProviderImpl.java:29-30 (downstream consumer in F-011)
- dependencies_semantic.requires-feature.[*] ← GoogleUserHandler.java:1-74 (imports + class body) + GoogleCondition.java:1-15 + Google IDP RFC-style behaviour (well-documented public knowledge)
- dependencies_semantic.requires-config.[*] ← GoogleUserHandler.java:45-69 + ODDOAuth2Properties.java:33-53 (the bound fields)
- dependencies_semantic.requires-runtime.[*] ← GoogleUserHandler.java:1-25 (imports)
- dependencies_semantic.couples-to.* ← cited file:line ranges
- tests_coverage_semantic.uncovered_behaviours.[*] ← Grep for GoogleUserHandlerTest under <odd-platform-repo>/odd-platform-api/src/test returned no matches; behaviours derived from method bodies at GoogleUserHandler.java:38-73
- docs_link_semantic.inferred_docs.[0] ← live WebFetched 2026-05-19 status 200 (OAuth2/OIDC page; verbatim YAML example + verbatim doc-side silences captured)
- docs_link_semantic.inferred_docs.[1] ← live WebFetched 2026-05-19 status 200 (user-owner-association page; downstream consumer doc)
- docs_link_semantic.doc_drift_findings.[0] (hd undocumented) ← GoogleUserHandler.java:32, 49-55 + live OAuth2/OIDC docs WebFetched 2026-05-19 status 200 verbatim 'hd not mentioned'
- docs_link_semantic.doc_drift_findings.[1] (defence-in-depth undocumented) ← GoogleUserHandler.java:49-55 + OAuthSecurityConfiguration.java:168-175 + live OAuth2/OIDC docs
- docs_link_semantic.doc_drift_findings.[2] (admin-attribute default undocumented) ← GoogleUserHandler.java:31, 58 + live OAuth2/OIDC docs WebFetched 2026-05-19 status 200 verbatim 'default not stated'
- docs_link_semantic.doc_drift_findings.[3] (admin-groups silent) ← GoogleUserHandler.java:1-74 (no read) + ODDOAuth2Properties.java:49 (field exists) + live docs verbatim 'admin-groups for Cognito + GitHub only'
- docs_link_semantic.doc_drift_findings.[4] (rejection undocumented) ← GoogleUserHandler.java:52-54 + live docs verbatim 'rejection behavior not documented'
- upstream_callers.[*] ← OAuthSecurityConfiguration.java:99, 116-126, 185-189
- downstream_side_effects.[*] ← GoogleUserHandler.java:70-71 (DefaultOidcUser construction) + GoogleUserHandler.java:52-54 (rejection vector) + AuthIdentityProviderImpl.java:29-30 (downstream consumer) + OAuthSecurityConfiguration.java:80 (bean wiring)
- implicit_adrs.[0] (two-layer hd defence-in-depth) ← GoogleUserHandler.java:49-55 + OAuthSecurityConfiguration.java:168-175 + composes with ADR-CANDIDATE-034
- implicit_adrs.[1] (admin-attribute default email) ← GoogleUserHandler.java:31, 56-59 + AbstractOIDCUserHandler.java:33-35
- implicit_adrs.[2] (diverges from AbstractOIDCUserHandler) ← GoogleUserHandler.java:30 + CognitoUserHandler.java:16 + AzureUserHandler.java:16 + CustomOIDCUserHandler.java:19
- implicit_adrs.[3] (Mono.error rejection pattern) ← GoogleUserHandler.java:52-54 + GithubUserHandler.java:90
- bugs_limitations_corner_cases.[0] (admin-groups silent no-op) ← GoogleUserHandler.java:1-74 + ODDOAuth2Properties.java:49 + AbstractOIDCUserHandler.java:44-55
- bugs_limitations_corner_cases.[1] (first-match-wins dispatcher) ← GoogleUserHandler.java:38-40 + OAuthSecurityConfiguration.java:185-189 + CustomOIDCUserHandler.java:28-34
- bugs_limitations_corner_cases.[2] (null in error message) ← GoogleUserHandler.java:52-54
- bugs_limitations_corner_cases.[3] (personal account rejection) ← GoogleUserHandler.java:49-55
- bugs_limitations_corner_cases.[4] (no null-guard on provider) ← GoogleUserHandler.java:46-50 + AbstractOIDCUserHandler.java:28 + GithubUserHandler.java:52 + ODDIAMUserHandler.java:35
- bugs_limitations_corner_cases.[5] (admin-attribute typo silent) ← GoogleUserHandler.java:56-64
- bugs_limitations_corner_cases.[6] (userNameAttribute path divergence) ← GoogleUserHandler.java:66-68 + AbstractOIDCUserHandler.java:29-30 + GithubUserHandler.java:53
- security.auth_mode_relevance ← GoogleUserHandler.java:27-28 + GoogleCondition.java:10-15 + OAuthSecurityConfiguration.java:71
- security.ingestion_filter_relevance ← OAuthSecurityConfiguration.java:99 + S2sAuthenticationFilter (no involvement)
- security.authorization_assertions ← GoogleUserHandler.java:30-73 (no auth checks)
- security.owner_scoping ← GoogleUserHandler.java:1-74 (no data access)
- security.data_exposure.[0] (hd in error) ← GoogleUserHandler.java:52-54
- security.data_exposure.[1] (admin-principal indirect) ← GoogleUserHandler.java:56-65
- security.known_security_gaps.[0] (admin-groups no-op) ← GoogleUserHandler.java:1-74 + ODDOAuth2Properties.java:49
- security.known_security_gaps.[1] (defence-in-depth undocumented) ← GoogleUserHandler.java:49-55 + OAuthSecurityConfiguration.java:168-175
- security.known_security_gaps.[2] (personal-account error) ← GoogleUserHandler.java:52-54
- security.known_security_gaps.[3] (no audit log) ← GoogleUserHandler.java:1-74 (no @Slf4j, no log)
- security.known_security_gaps.[4] (downstream F-011 backlink) ← GoogleUserHandler.java:70-71 + AuthIdentityProviderImpl.java:29-30
- performance.hot_paths.[*] ← GoogleUserHandler.java:42-73
- performance.throughput_characteristics.[*] ← GoogleUserHandler.java:29 (@RequiredArgsConstructor; stateless)
- performance.resource_allocation.[*] ← GoogleUserHandler.java:70-71
- performance.scaling_characteristics.[*] ← GoogleUserHandler.java:29 (no state, no locks)

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (zero tests verified via Grep; 15 uncovered behaviours derived from the 38-line method body)
- docs_link_semantic: HIGH (live WebFetch of OAuth2/OIDC docs + user-owner-association docs; 5 verbatim doc-side silences captured)
- implicit_adrs: HIGH (4 decisions, each anchored to explicit code patterns + contrast against sibling handlers)
- bugs_limitations_corner_cases: HIGH (every claim traces to specific lines; admin-groups silent no-op + first-match-wins dispatcher are NEW findings; personal-account rejection + null-in-error are corner cases)
- security: HIGH
- performance: HIGH

## Maintainer notes

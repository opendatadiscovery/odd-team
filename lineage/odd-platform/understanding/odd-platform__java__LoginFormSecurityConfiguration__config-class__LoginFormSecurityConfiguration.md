---
node_id: "odd-platform java LoginFormSecurityConfiguration config-class:LoginFormSecurityConfiguration"
node_kind: config-class
axis: config_prefixes
extracted_at_commit: 9ac6436e9bd36ba132d765076c6bbd5916fde729
enriched_at_commit: 9ac6436e9bd36ba132d765076c6bbd5916fde729
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-X
back_links:
  feature_ids: [F-011, F-008]
  pillar_anchored_ids: ["P-09:F-001 UI authentication", "P-09:F-002 Principal-to-Owner Resolution"]
  refactor_ids: [REFACTOR-185]
  retrospective_ids: [LSN-001, LSN-010, LSN-018]
  adr_candidate_ids: [ADR-CANDIDATE-029]
  sibling_sidecars:
    - "odd-platform__java__DisabledAuthSecurityConfiguration__config-key-consumer__auth_type@L10.md (DISABLED quartet sibling)"
    - "odd-platform__java__LoginFormSecurityConfiguration__config-key-consumer__auth_type@L31.md (same file, gate-level view)"
    - "odd-platform__java__OAuthSecurityConfiguration__config-key-consumer__auth_type@L71.md (OAUTH2 quartet sibling)"
    - "odd-platform__java__LDAPSecurityConfiguration__config-key-consumer__auth_type@L51.md (LDAP quartet sibling)"
    - "odd-platform__java__service__service__AuthIdentityProviderImpl.md (downstream principal resolution — LOGIN_FORM produces provider=null UserDto)"
    - "odd-platform__java__repository__reactive__repository__ReactiveUserOwnerMappingRepositoryImpl.md (downstream — provider=null cross-mode bleed mechanism)"
    - "odd-platform__ts__react-component__component__AppToolbar.md (UI shell — confirms no LoginForm React component exists; framework-rendered)"
---

# LoginFormSecurityConfiguration (config-class) — semantic understanding

## understanding

`LoginFormSecurityConfiguration` is the entire LOGIN_FORM-mode authentication wiring — a 104-line `@Configuration` class gated by `@ConditionalOnProperty(value="auth.type", havingValue="LOGIN_FORM")` (line 31) that produces exactly two beans: a `SecurityWebFilterChain` (`securityWebFilterChainLoginForm`, lines 38-66) protecting all HTTP paths under `/**` via Spring Security WebFlux's stock `formLogin(...)` filter, and a `MapReactiveUserDetailsService` (lines 68-86) populated at boot from the comma-separated `auth.login-form-credentials` string. The configuration is the lightweight built-in auth path documented as dev/demo-only: every authenticated user is hard-coded ADMIN (`getAuthorities(true)` at line 81), credentials live in plain text in YAML/env, CSRF is unconditionally disabled (line 54), and the login UI is **Spring Security's framework-default form** — there is no React/TSX LoginForm component in the SPA (per the AppToolbar sidecar's substitution-note evidence). Crucially, LOGIN_FORM does NOT wire `AuthorizationCustomizer` (contrast OAuthSecurityConfiguration.java:98 and LDAPSecurityConfiguration.java:145) — the only access gate is `pathMatchers("/**").authenticated()` at line 57, so the Policies/Permissions/Roles/Owners framework is INERT under this auth mode; every authenticated user can call every endpoint.

## concepts

- entities:
  - `LoginFormSecurityConfiguration` (the @Configuration class; lines 30-34)
  - `securityWebFilterChainLoginForm` (the @Bean SecurityWebFilterChain; lines 38-66)
  - `mapReactiveUserDetailsService` (the @Bean in-memory user store; lines 68-86)
  - `LoginFormCredentials` (nested @Getter @RequiredArgsConstructor static class parsing `user:pass`; lines 92-103)
  - `GrantedAuthorityExtractor` (injected via @RequiredArgsConstructor; line 35; used at line 81 with `isAdmin=true`)
  - `S2sAuthenticationFilter` (injected via @RequiredArgsConstructor; line 36; conditionally chained at lines 61-63)
  - `PasswordEncoder` from `PasswordEncoderFactories.createDelegatingPasswordEncoder()` (line 72 — bcrypt-by-prefix delegating encoder used to in-memory-encode plain-text passwords)
  - `MapReactiveUserDetailsService` (Spring stock in-memory `ReactiveUserDetailsService` impl; line 85)
- operations:
  - gate-class-on-auth.type=LOGIN_FORM (line 31)
  - read-redirect-uri-and-s2s-flag-via-@Value (lines 41-42)
  - parse-comma-separated-credential-string (line 75)
  - parse-colon-separated-user-pass-pair (line 99 inside `LoginFormCredentials.parseCredentialString`)
  - bcrypt-encode-passwords-in-memory-on-userdetails-build (lines 72,79)
  - build-form-login-chain-with-csrf-disabled (lines 53-58)
  - resolve-success-handler-redirect-uri-or-default-to-slash (lines 43-47)
  - conditionally-chain-s2s-filter-at-http-basic-order (lines 61-63)
  - emit-`MapReactiveUserDetailsService` (line 85)
  - hard-code-every-user-as-ADMIN-authority (line 81)
- invariants:
  - bean graph materialises only when `auth.type=LOGIN_FORM` exactly — no `matchIfMissing` clause (line 31; case-sensitive match)
  - chain matches all exchanges under `/**` with five exempt paths (`/actuator/health`, `/favicon.ico`, `/ingestion/entities`, `/ingestion/datasources`, `/api/slack/events`) permitAll-ed at lines 49-56
  - every authenticated user receives `UserProviderRole.ADMIN` authority (line 81 hard-codes `getAuthorities(true)`; `GrantedAuthorityExtractor.java:13-14` returns `ADMIN`)
  - CSRF is unconditionally disabled (line 54)
  - the chain does NOT wire `AuthorizationCustomizer` — the only post-permitAll gate is `pathMatchers("/**").authenticated()` (lines 55-57); no `SECURITY_RULES` enforcement, no `WHITELIST_PATHS` lookup, no per-Policy/Permission/Role manager wiring
  - S2sAuthenticationFilter is registered AT `SecurityWebFiltersOrder.HTTP_BASIC` when `auth.s2s.enabled=true` (line 62) — same insertion point as OAuth/LDAP siblings
  - credential parsing is split-on-comma then split-on-colon with NO escape mechanism (lines 75, 99); `username` and `password` containing those characters cannot be expressed verbatim
  - `auth.login-form-credentials` has NO default (line 70 `@Value("${auth.login-form-credentials}")` — no `:default` fallback) — Spring fails to start with `BeanCreationException` if unset
  - `auth.login-form-redirect` defaults to empty string (line 41); when empty, the success handler is `RedirectServerAuthenticationSuccessHandler("/")` (line 47); when set, `DefaultServerRedirectStrategy().sendRedirect(...)` is invoked with the URI VERBATIM, no allowlist (line 46)
  - the `LOGIN_FORM` user identity ends up in `AuthIdentityProviderImpl.getCurrentUser()` as `UserDto(username, null)` (AuthIdentityProviderImpl.java:32) — the OAuth2 branch (line 29) does not match, so `provider=null` is set; this feeds the provider-null cross-mode bleed mechanism in `ReactiveUserOwnerMappingRepositoryImpl.getConditions`
- audiences:
  - Spring container at bean-definition phase (the `@ConditionalOnProperty` consumer)
  - operators deploying ODD Platform with `auth.type=LOGIN_FORM` (per docs, dev/demo only)
  - end users authenticating via the framework-default form-login HTML page (Spring Security WebFlux's stock `/login` page renderer — no custom Thymeleaf template like OAuth's `oauth2_login.html`)
  - CI/CD callers presenting `X-API-Key` when `auth.s2s.enabled=true` is also configured (the parallel S2S filter path)

## dependencies_semantic

- requires-feature:
  - Spring `@ConditionalOnProperty` infrastructure (selects this class only when `auth.type=LOGIN_FORM`; line 31)
  - reactive-stack Spring Security with `@EnableWebFluxSecurity` (line 32)
  - `S2sAuthenticationFilter` bean (line 36 — constructor-injected by `@RequiredArgsConstructor` REGARDLESS of `auth.s2s.enabled` value, so the filter bean must always exist in the Spring context; verified at `S2sAuthenticationFilter.java:17-19` which is `@Component`)
  - `GrantedAuthorityExtractor` bean (line 35; `GrantedAuthorityExtractor.java:9-10` is `@Component`)
  - `PasswordEncoderFactories.createDelegatingPasswordEncoder()` — Spring Security's stock bcrypt-by-prefix encoder (line 72)
  - Spring Security WebFlux's stock framework-default `/login` form-rendering filter (no custom Thymeleaf template authored; verified by the AppToolbar sidecar's substitution_note that no React LoginForm component exists in `odd-platform-ui`)
- requires-config:
  - `auth.type` MUST equal the literal `LOGIN_FORM` (line 31; no `matchIfMissing`; case-sensitive)
  - `auth.login-form-credentials` MUST be set (line 70; `@Value("${auth.login-form-credentials}")` with NO default; bundled `application.yml:37` ships `admin:admin,root:root` as the implicit default for unmodified deployments — but a deployment overriding `application.yml` and setting `auth.type=LOGIN_FORM` without supplying this key crashes context refresh)
  - `auth.login-form-redirect` is OPTIONAL (line 41; defaults to empty string — falls back to `RedirectServerAuthenticationSuccessHandler("/")` at line 47)
  - `auth.s2s.enabled` is OPTIONAL (line 42; default `false` per `@Value("${auth.s2s.enabled:false}")`; when `true`, S2sAuthenticationFilter is composed at HTTP_BASIC order at lines 61-63)
  - the four sibling SecurityConfiguration classes (`DisabledAuthSecurityConfiguration` / `OAuthSecurityConfiguration` / `LDAPSecurityConfiguration` / this) must NOT have their conditions match simultaneously — guaranteed by `havingValue` exclusivity on a single `auth.type` key
- requires-runtime:
  - Spring property-source resolution at bean-definition phase (no runtime config re-read; credentials are static-per-JVM)
  - in-memory `MapReactiveUserDetailsService` storage (no Postgres / Redis dependency — credentials are recomputed from configuration on every restart; verified at line 85)
  - BCrypt-compatible password encoder at line 72 — invoked once per credential at bean construction (line 79 `passwordEncoder(pe::encode)`), NOT per request, so encoding cost amortises over JVM lifetime
  - reactive-stack Spring Security WebFlux filter ordering — uses `SecurityWebFiltersOrder.HTTP_BASIC` slot for the optional S2S filter at line 62

## upstream_callers

LoginFormSecurityConfiguration is a Spring `@Configuration` class — it is NEVER called by application code. Its beans are wired by Spring's context-refresh machinery and consumed by the Spring Security WebFlux framework's reactive filter chain.

- **Spring Boot autoconfiguration** ← discovers via classpath scanning (`@SpringBootApplication` in the main `OddPlatformApplication.java` triggers component scan over the `org.opendatadiscovery.oddplatform.config` package; verified via the package convention used by all four sibling SecurityConfiguration classes).
- **Spring Security WebFlux** consumes the `securityWebFilterChainLoginForm` `SecurityWebFilterChain` bean at line 39 — registered into `WebFilterChainProxy` and applied to every incoming HTTP request when `auth.type=LOGIN_FORM` is the active mode.
- **Spring Security UserDetails machinery** consumes the `mapReactiveUserDetailsService` `MapReactiveUserDetailsService` bean at line 69 — automatically wired into the `ReactiveUserDetailsService` slot used by the form-login authentication manager.
- **No other application-layer caller**. Verified by Grep for `LoginFormSecurityConfiguration` across `<odd-platform-repo>/odd-platform-api/src/main/java` (this enrichment) — only matches are the file itself + the sibling sidecars' cross-file diff references in `DisabledAuthSecurityConfiguration` / `OAuthSecurityConfiguration` / `LDAPSecurityConfiguration` (and those are documentation references, not code callers).

## downstream_side_effects

When active (auth.type=LOGIN_FORM), the bean-graph this class produces causes the following observable platform behaviours:

- **EVERY authenticated request runs WITHOUT the Policies/Permissions/Roles/Owners framework.** The `SecurityWebFilterChain` at lines 53-65 does NOT call `.authorizeExchange(new AuthorizationCustomizer(permissionService, extractors))` — the only authorization gate is `.pathMatchers("/**").authenticated()` (line 57). Side-effect: every form-authenticated user can hit every endpoint defined in `SecurityConstants.SECURITY_RULES:98-355` regardless of any Policy / Role / Owner configuration. This is **F-008 P-09:F-001 read-collaborative-posture wide-open variant**.
- **Every form-authenticated user becomes UserProviderRole.ADMIN.** Line 81 hard-codes `grantedAuthorityExtractor.getAuthorities(true)` (the `true` is the `isAdmin` flag; verified `GrantedAuthorityExtractor.java:13-14` returns the literal `ADMIN`). Side-effect: under LOGIN_FORM there is NO per-user role distinction — `admin:admin` and `root:root` are functionally identical, as is any operator-defined entry in the credentials string.
- **Downstream principal layer receives `UserDto(username, null)`.** `AuthIdentityProviderImpl.getCurrentUser()` at line 24-35 matches the non-OAuth2 branch (line 31 `else { return new UserDto(username, null); }`) for LOGIN_FORM-authenticated requests. Side-effect: feeds the **provider-null cross-mode bleed** at `ReactiveUserOwnerMappingRepositoryImpl.getConditions:121-125` — LOGIN_FORM users 'alice' and LDAP users 'alice' resolve to the SAME `OwnerPojo` because both produce `provider=null` and the repository's WHERE clause matches both via `PROVIDER.isNull()`. The bleed is INVISIBLE at the LOGIN_FORM layer; only the repository node surfaces it. (Cross-reference: `lineage/odd-platform/understanding/odd-platform__java__repository__reactive__repository__ReactiveUserOwnerMappingRepositoryImpl.md:bugs_limitations_corner_cases.[3,4]`.)
- **Spring's framework-default `/login` HTML page is rendered.** Line 58 calls `.formLogin(formLoginSpec -> formLoginSpec.authenticationSuccessHandler(authHandler))` — there is NO `formLoginSpec.loginPage(...)` override, so Spring Security WebFlux's stock `LoginPageGeneratingWebFilter` (or equivalent for WebFlux — the framework default) renders the form. Side-effect: the SPA `odd-platform-ui` ships NO LoginForm React/TSX component (verified by AppToolbar sidecar substitution_note + Grep for `login|Login` returning zero UI matches). The login surface is entirely framework-rendered HTML; the React SPA only takes over post-login.
- **Successful form-login redirects to `auth.login-form-redirect` VERBATIM, with no validation.** Lines 43-47 + 88-90: if `auth.login-form-redirect` is non-empty, `URI.create(redirectURIString)` parses it and `DefaultServerRedirectStrategy().sendRedirect(exchange, redirectURI)` issues the redirect. Side-effect: an open-redirect surface when the config value is templated from untrusted input. `URI.create()` throws `IllegalArgumentException` on malformed input — a malformed value crashes context refresh (fail-loud; documented in bugs_limitations_corner_cases below).
- **In-memory `MapReactiveUserDetailsService` is the user store.** Line 85 returns `new MapReactiveUserDetailsService(users)`. Side-effect: credentials are static per JVM — adding/removing/rotating users requires restart. No `/api/users` admin surface manages this store.
- **Permitted paths bypass authentication entirely under LOGIN_FORM.** Lines 49-51: `/actuator/health`, `/favicon.ico`, `/ingestion/entities`, `/ingestion/datasources`, `/api/slack/events` are permitAll-ed. Side-effect: combined with `auth.ingestion.filter.enabled=false` (the bundled default per `application.yml:46-48`), the `/ingestion/entities` destructive-write surface is anonymously reachable under LOGIN_FORM mode (sibling finding to REFACTOR-185 facet under DISABLED).
- **S2S API-key authentication composes ADDITIVELY when enabled.** Lines 61-63: `if (s2sEnabled) sec.addFilterAt(s2sAuthenticationFilter, SecurityWebFiltersOrder.HTTP_BASIC)`. Side-effect: a request with a valid `X-API-Key` header bypasses form-login entirely and runs as the synthetic `ADMIN` user injected by `S2sAuthenticationFilter.java:31-34`. Under LOGIN_FORM, this means BOTH the X-API-Key bearer AND form-authenticated users are ADMIN — the two authentication surfaces are operationally indistinguishable in terms of access rights (both bypass the absent `AuthorizationCustomizer`).
- **No coordination with sibling auth-mode classes.** When LOGIN_FORM is active, the three sibling SecurityConfigurations (`DisabledAuthSecurityConfiguration`, `OAuthSecurityConfiguration`, `LDAPSecurityConfiguration`) do NOT register their beans (verified by parallel `@ConditionalOnProperty` matches on the same `auth.type` key across all four). Side-effect: there is exactly ONE `SecurityWebFilterChain` registered for the reactive stack per running platform; mode switches require restart.

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - "behaviour: bean graph materialises ONLY when `auth.type=LOGIN_FORM` and skips for DISABLED / OAUTH2 / LDAP / unset"
    test_class: "LoginFormSecurityConfigurationTest (would need to be created)"
  - "behaviour: under `auth.type=LOGIN_FORM`, all `/**` paths return 302→/login for an unauthenticated request and 200 for a successfully form-authenticated session"
    test_class: "LoginFormSecurityConfigurationIntegrationTest (WebTestClient with @SpringBootTest + auth.type=LOGIN_FORM)"
  - "behaviour: form-authenticated users get `UserProviderRole.ADMIN` (every user, no role distinction). Verify the SecurityContext authority set is exactly `[ADMIN]`."
    test_class: "LoginFormSecurityConfigurationIntegrationTest"
  - "behaviour: `auth.login-form-credentials` parsing accepts `user1:pass1,user2:pass2` and rejects malformed input (trailing comma, missing colon, empty pair, leading/trailing whitespace, `:` in password, `,` in username — see bugs_limitations_corner_cases for which of these silently mis-parse vs. throw)"
    test_class: "LoginFormCredentialsTest (could be a focused unit test against the nested LoginFormCredentials class)"
  - "behaviour: empty-password form (`user:`) — confirm whether `credentials[1].trim()` throws `ArrayIndexOutOfBoundsException` (current code at line 101) or produces empty-password user; fix the test once the behaviour is decided"
    test_class: "LoginFormCredentialsTest"
  - "behaviour: missing `auth.login-form-credentials` under `auth.type=LOGIN_FORM` produces a `BeanCreationException` with a `IllegalArgumentException: Could not resolve placeholder` chain at context refresh"
    test_class: "LoginFormSecurityConfigurationFailFastTest"
  - "behaviour: `auth.login-form-redirect` empty defaults to `/`; set to a valid URI redirects there post-login; set to a malformed URI crashes context refresh with `IllegalArgumentException` from `URI.create`"
    test_class: "LoginFormSecurityConfigurationIntegrationTest"
  - "behaviour: under `auth.type=LOGIN_FORM` + `auth.s2s.enabled=true`, a request with a valid `X-API-Key` bypasses form-login and runs as ADMIN (verifies S2S composition + admin-elevation)"
    test_class: "LoginFormSecurityConfigurationS2SCompositionTest"
  - "behaviour: under `auth.type=LOGIN_FORM`, the five permit-all paths (`/actuator/health`, `/favicon.ico`, `/ingestion/entities`, `/ingestion/datasources`, `/api/slack/events`) succeed WITHOUT authentication"
    test_class: "LoginFormSecurityConfigurationIntegrationTest"
  - "behaviour: under `auth.type=LOGIN_FORM`, CSRF tokens are NOT required for POST/PUT/DELETE requests (confirms .csrf(...disable) intent)"
    test_class: "LoginFormSecurityConfigurationIntegrationTest"
  - "behaviour: under `auth.type=LOGIN_FORM`, `AuthorizationCustomizer` is NOT wired — verify that endpoints in `SecurityConstants.SECURITY_RULES` (e.g. `POST /api/namespaces` gated by NAMESPACE_CREATE) are reachable by any form-authenticated user regardless of any Policy/Role configuration. THIS IS THE LOAD-BEARING REGRESSION PIN for the F-008 read-collaborative-posture wide-open variant."
    test_class: "LoginFormSecurityConfigurationAuthorizationBypassTest"
  - "behaviour: under `auth.type=LOGIN_FORM`, the framework-default `/login` HTML page is served (verifies no custom React/Thymeleaf template is rendered; confirms the AppToolbar sidecar's substitution_note empirically)"
    test_class: "LoginFormSecurityConfigurationLoginPageTest"
  - "behaviour: provider-null cross-mode bleed pin — a LOGIN_FORM-authenticated user `alice` and a hypothetical LDAP-authenticated user `alice` (both producing `provider=null` per AuthIdentityProviderImpl.java:32) resolve to the SAME `OwnerPojo` via `ReactiveUserOwnerMappingRepositoryImpl.getConditions` (lines 121-125). This is the cross-batch confirmation that REFACTOR-185-class issues bleed across auth-mode boundaries."
    test_class: "AuthIdentityCrossModeIntegrationTest (parametrized over auth.type modes — verifies provider field across LOGIN_FORM/OAUTH2/LDAP)"
  - "behaviour: session cookie attributes — verify `Secure`, `HttpOnly`, `SameSite` defaults under WebFlux + the never-expiring `spring.session.timeout: -1` (application.yml:3). On a non-HTTPS deployment, no `Secure` flag means the cookie travels in plaintext."
    test_class: "LoginFormSecurityConfigurationSessionCookieTest"
  - "behaviour: brute-force resistance — submit N invalid login attempts and verify no lockout / no rate-limit is applied (currently absent; the only cost is BCrypt's ~100ms encode-compare per attempt)"
    test_class: "LoginFormSecurityConfigurationBruteForceTest"
- test_files: []
- gaps: |
    ZERO test coverage. Verified by:
    (a) `find <odd-platform-repo>/odd-platform-api/src/test -name "*LoginForm*"` — no matches;
    (b) Glob over `<odd-platform-repo>/odd-platform-api/src/test/**/*ogin*.java` and `<odd-platform-repo>/odd-platform-api/src/test/**/*ecurity*.java` — no matches;
    (c) Full enumeration of `<odd-platform-repo>/odd-platform-api/src/test/**/*.java` (this enrichment, 2026-05-20) — only `HealthAPITest.java`, ingestion API tests, mapper tests, repository tests, and service tests exist; ZERO files reference `LoginFormSecurityConfiguration`, `LOGIN_FORM`, `securityWebFilterChainLoginForm`, `MapReactiveUserDetailsService`, `mapReactiveUserDetailsService`, or the credential-string parser.

    The class is responsible for the platform's lightweight built-in auth path AND it sits inside the auth-mode quartet that defines the security posture of EVERY ODD Platform deployment. The most damaging regression vectors:

    1. **A future maintainer adding `.authorizeExchange(new AuthorizationCustomizer(...))` to this chain "to match OAuth/LDAP"** — would silently move LOGIN_FORM from "wide-open authorization (read-collaborative wide-open variant)" to "Policies/Permissions/Roles/Owners gates enforced". No regression test exists to assert the INTENTIONAL absence; the gap surfaces only as operator-facing breakage of their existing role / policy expectations.

    2. **A future maintainer changing `getAuthorities(true)` to `getAuthorities(false)`** — would silently demote every form-authenticated user from ADMIN to USER, blocking every admin-gated endpoint. No test asserts the hard-coded `true`.

    3. **A future maintainer adding `formLoginSpec.loginPage("/login.html")` to enable a custom React LoginForm component** — would break the framework-default rendering and would not be caught by any test. The AppToolbar sidecar's substitution_note declared "no LoginForm React component exists" as a UI-side invariant; this code-side test is the symmetric assertion.

    4. **A future maintainer changing `auth.s2s.enabled` insertion order from `HTTP_BASIC` to `FORM_LOGIN`** — would change which filter wins for a request bearing both X-API-Key AND a session cookie. No test pins the relative-ordering.

    5. **Refactoring `LoginFormCredentials.parseCredentialString` to URL-decode or unicode-escape input** — would silently change how passwords with reserved characters are handled, potentially breaking deployments whose credential string contains `%3A` (URL-encoded colon).

    6. **Switching the password encoder to a non-delegating BCrypt encoder** — would silently break upgrade paths from deployments whose users were encoded with a different prefix-marked algorithm via the delegating encoder.

    REFACTOR-186 (zero unit-test coverage on auth-mode quartet) is implicit from this gap profile.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/login-form"
    anchor: ""
    rationale: "The Login form sub-page of Authentication is the canonical home for `auth.type=LOGIN_FORM`, `auth.login-form-credentials`, and the LOGIN_FORM-mode documentation. WebFetched 2026-05-20 status 200; cited verbatim in fetched_excerpts."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/s2s"
    anchor: ""
    rationale: "The S2S sub-page documents the additive composition relationship (S2S runs alongside LOGIN_FORM); cited at lines 61-63 where this class wires the filter. WebFetched 2026-05-20 status 200."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization"
    anchor: ""
    rationale: "The Authorization page documents Policies/Permissions/Roles/Owners — the framework that LOGIN_FORM does NOT wire (per the load-bearing finding at line 55-57). WebFetched 2026-05-20 status 200."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
- fetched_excerpts: |
    From WebFetch of `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/login-form` on 2026-05-20 (status 200):
    > Heading: "Login form"
    > YAML example: `auth: type: LOGIN_FORM, login-form-credentials: susan:susan_password,dave:dave_password`
    > "The shipped configuration contains the default credentials `admin:admin,root:root`."
    > "Change these defaults before any non-local deployment."
    > "Prefer OAUTH2 or LDAP for production. LOGIN_FORM stores credentials in plain text in the platform configuration and does not support rotation, session revocation, or MFA."
    > "All users authenticated through this method receive ADMIN privileges in the platform."
    > NOT mentioned on this page: `login-form-redirect`, S2S composition, provider field, authentication framework details, Policies / Permissions / Roles / Owners structure.

    From WebFetch of `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/s2s` on 2026-05-20 (status 200):
    > "S2S is available when `auth.type` is `LOGIN_FORM`, `OAUTH2`, or `LDAP`."
    > "S2S runs alongside the configured interactive auth mechanism, not instead of it. If a request has no `X-API-Key` header (or the value doesn't match), the filter falls through and the normal auth chain (Login form / OAuth2 / LDAP) handles the request."
    > "Clients present the token in the `X-API-Key` HTTP header on every request."
    > NOT mentioned on this page: the consequence that S2S-bearer requests AND form-login session-cookie requests are both ADMIN under LOGIN_FORM (because LOGIN_FORM also hard-codes ADMIN).

    From WebFetch of `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization` on 2026-05-20 (status 200):
    > Heading: "Authorization"
    > Intro: "It is very important to have fine-grained access control in your data catalog."
    > NOT mentioned on this page: which `auth.type` modes wire the Policies/Permissions/Roles/Owners framework (the load-bearing precondition: it's wired only in OAUTH2 and LDAP, not LOGIN_FORM, not DISABLED).

- doc_drift_findings:
  - "**The live login-form docs page does NOT document `auth.login-form-redirect`** (WebFetched 2026-05-20, status 200). The source consumes the key at line 41 with empty default; if a value is provided, `URI.create(redirectURIString)` at line 89 is invoked WITHOUT any allowlist or origin check, then the value drives `DefaultServerRedirectStrategy().sendRedirect(...)` at line 46. An operator who sets the value to a templated attacker-controlled URL (e.g. helm-chart-substituted env-var derived from untrusted input) introduces an open-redirect; the doc surface gives no guidance." — evidence: LoginFormSecurityConfiguration.java:41,46,89 + WebFetch login-form docs 2026-05-20"
  - "**The live login-form docs page does NOT document S2S co-existence under LOGIN_FORM with the consequence that the authorization framework is ABSENT.** The S2S doc page (WebFetched 2026-05-20) states 'S2S is available when auth.type is LOGIN_FORM' and 'S2S runs alongside the configured interactive auth mechanism' — both correct. What is silent: under LOGIN_FORM, neither the form-authenticated user NOR the S2S-bearer caller is subject to `AuthorizationCustomizer` enforcement; both receive ADMIN authority; the two surfaces are operationally indistinguishable. The compound failure under LOGIN_FORM is more severe than either page communicates in isolation." — evidence: LoginFormSecurityConfiguration.java:55-57,81 + S2sAuthenticationFilter.java:31-34 + WebFetch s2s docs 2026-05-20 + WebFetch login-form docs 2026-05-20"
  - "**The live authorization docs page does NOT name which `auth.type` modes wire the Policies/Permissions/Roles/Owners framework** (WebFetched 2026-05-20 — `'It is very important to have fine-grained access control in your data catalog.'` then enumerates the framework components but never states the precondition). The framework is wired in `OAuthSecurityConfiguration.java:98` and `LDAPSecurityConfiguration.java:145` via `new AuthorizationCustomizer(permissionService, extractors)` — and explicitly NOT wired in this file (lines 55-57). An operator who reads `/enable-security/authorization` after configuring `auth.type=LOGIN_FORM` and authoring Policies + Roles via the platform UI gets a fully-built RBAC configuration that the live auth chain SILENTLY IGNORES — every form-authenticated user can call every endpoint regardless of their Policy assignment. THIS IS THE LARGEST LOGIN_FORM-SPECIFIC DOC DRIFT and confirms the LSN-001-class pattern (insecure default with cryptic doc coverage)." — evidence: LoginFormSecurityConfiguration.java:55-57 + OAuthSecurityConfiguration.java:98 + LDAPSecurityConfiguration.java:145 + AuthorizationCustomizer.java:14-32 + WebFetch authorization docs 2026-05-20"
  - "**The live login-form docs page does NOT warn that the framework-default form-login HTML page is what renders** (WebFetched 2026-05-20). The AppToolbar sidecar's substitution_note confirms 'There is no LoginForm React component anywhere in `odd-platform-ui/src`'. Operators expecting to customize the login UI via the SPA build pipeline will find no entry point. The customization path is via Spring Security's `formLoginSpec.loginPage(...)` override which this file does NOT call (line 58). An operator wanting to brand their LOGIN_FORM screen needs to know to override at the Spring Security configuration layer, not the React component layer — and the docs page does not bridge that gap." — evidence: LoginFormSecurityConfiguration.java:58 + AppToolbar sidecar substitution_note + WebFetch login-form docs 2026-05-20"
  - "**The live login-form docs page does NOT document the credential-string parsing edge cases.** Line 75 splits on `,` (no escape), line 99 splits on `:` (takes only the first two segments). A password containing `:` is silently truncated; a username containing `,` is silently split into two entries; an empty-password format `user:` throws `ArrayIndexOutOfBoundsException` (`credentials[1]` at line 101 has no bounds check). Operators are not warned which characters are forbidden in credentials." — evidence: LoginFormSecurityConfiguration.java:73-83,98-102 + WebFetch login-form docs 2026-05-20"
  - "**The live login-form docs page does NOT document that `auth.login-form-credentials` is a REQUIRED key under `auth.type=LOGIN_FORM`.** Line 70 uses `@Value(\"${auth.login-form-credentials}\")` with NO `:default` fallback. An operator who switches `auth.type` from DISABLED → LOGIN_FORM in their override config WITHOUT supplying `auth.login-form-credentials` gets `BeanCreationException` with `IllegalArgumentException: Could not resolve placeholder 'auth.login-form-credentials'`. Fail-loud is the correct posture, but the doc surface should name the required pair." — evidence: LoginFormSecurityConfiguration.java:70 + WebFetch login-form docs 2026-05-20"
  - "**The shipped credentials `admin:admin,root:root` (application.yml:37) are warning-only on the live docs.** WebFetched 2026-05-20: 'Change these defaults before any non-local deployment.' This relies on the operator reading and acting; no programmatic guardrail (e.g. boot-time fail-fast when default credentials are detected on a non-loopback bind) exists in code. LSN-001-class pattern (silent insecure default + warning-only doc)." — evidence: application.yml:37 + LoginFormSecurityConfiguration.java:70-86 + WebFetch login-form docs 2026-05-20"

## implicit_adrs

- "LOGIN_FORM is intentionally a lightweight dev/demo path: in-memory user store, plain-text-credentials-from-config, comma-separated parsing, no persistence layer, no rotation, no MFA. The intent is encoded by (a) the comment in `application.yml:36` (`# For dev/demo purposes only -- username1:password1,username2:password2,etc`), (b) the absence of any `@ConditionalOnMissingBean` or persistence-layer integration, (c) the shipped default credentials `admin:admin,root:root` at application.yml:37, and (d) the live documentation's repeated 'dev-only' framing (WebFetched 2026-05-20: 'Prefer OAUTH2 or LDAP for production. LOGIN_FORM stores credentials in plain text in the platform configuration and does not support rotation, session revocation, or MFA.')." — evidence: application.yml:36-37 + LoginFormSecurityConfiguration.java:68-86 + WebFetch login-form docs 2026-05-20 — intent_anchor: "# For dev/demo purposes only -- username1:password1,username2:password2,etc" — confidence: HIGH

- "Every LOGIN_FORM user is granted ADMIN authorities — there is no role distinction in this mode. The intent anchor is the explicit `true` literal passed to `grantedAuthorityExtractor.getAuthorities(true)` at line 81, which `GrantedAuthorityExtractor.java:12-17` interprets as `isAdmin` and returns `UserProviderRole.ADMIN`. The live doc page corroborates: 'All users authenticated through this method receive ADMIN privileges in the platform.' (WebFetched 2026-05-20)" — evidence: LoginFormSecurityConfiguration.java:81 + GrantedAuthorityExtractor.java:12-17 + WebFetch login-form docs 2026-05-20 — intent_anchor: ".authorities(grantedAuthorityExtractor.getAuthorities(true))" — confidence: HIGH

- "S2S is intentionally an ADDITIVE filter that composes with the primary auth mode, not an alternative `auth.type` value. The intent is encoded by the conditional mount at lines 61-63 (`if (s2sEnabled) sec.addFilterAt(s2sAuthenticationFilter, SecurityWebFiltersOrder.HTTP_BASIC);`) — the filter is *added*, not *substituted*. The same pattern appears IDENTICALLY at `OAuthSecurityConfiguration.java:108-110` and `LDAPSecurityConfiguration.java:149-151`, confirming the cross-mode convention. The live S2S doc page (WebFetched 2026-05-20) corroborates: 'S2S runs alongside the configured interactive auth mechanism, not instead of it.'" — evidence: LoginFormSecurityConfiguration.java:61-63 + OAuthSecurityConfiguration.java:108-110 + LDAPSecurityConfiguration.java:149-151 + WebFetch s2s docs 2026-05-20 — intent_anchor: "if (s2sEnabled) { sec.addFilterAt(s2sAuthenticationFilter, SecurityWebFiltersOrder.HTTP_BASIC); }" — confidence: HIGH

- "The framework-default `/login` HTML page is the LOGIN_FORM login UI — the SPA `odd-platform-ui` deliberately does NOT ship a custom LoginForm React component. Intent anchor: line 58 calls `.formLogin(formLoginSpec -> formLoginSpec.authenticationSuccessHandler(authHandler))` with NO `formLoginSpec.loginPage(...)` override; the AppToolbar sidecar's substitution_note (`session-2026-05-20-Q`) confirms a UI-side Grep for `login|Login` returned ZERO React component matches. The decision is enforced symmetrically across two layers: backend doesn't override the framework default; frontend doesn't author a custom screen. This is a deliberate scope-reduction — LOGIN_FORM as a dev/demo path doesn't warrant the UI maintenance cost of a custom screen." — evidence: LoginFormSecurityConfiguration.java:58 (no loginPage override) + AppToolbar sidecar substitution_note (no UI component) + LDAPSecurityConfiguration.java:147 (`formLogin(Customizer.withDefaults())` — same framework-default pattern in LDAP mode) — intent_anchor: ".formLogin(formLoginSpec -> formLoginSpec.authenticationSuccessHandler(authHandler))" — confidence: HIGH

- "CSRF is unconditionally disabled across all four reactive `auth.type` modes by deliberate convention. Line 54 mirrors `OAuthSecurityConfiguration.java:96`, `LDAPSecurityConfiguration.java:143`, and `DisabledAuthSecurityConfiguration.java:15` — all four call `.csrf(ServerHttpSecurity.CsrfSpec::disable)`. The consistency across four independent `@Configuration` classes encodes intent rather than oversight; the consumer-facing API is treated as a stateless REST surface, and the project has decided CSRF is not a defense layer here. (Caveat: LOGIN_FORM IS session-cookie-based, which means a logged-in user visiting a malicious page can have state-changing requests issued via their session cookie. The convention may be over-applied to LOGIN_FORM; see bugs_limitations_corner_cases for the session-CSRF gap.)" — evidence: LoginFormSecurityConfiguration.java:54 + OAuthSecurityConfiguration.java:96 + LDAPSecurityConfiguration.java:143 + DisabledAuthSecurityConfiguration.java:15 — intent_anchor: ".csrf(ServerHttpSecurity.CsrfSpec::disable)" appears identically across four sibling files — confidence: MEDIUM (the cross-file consistency encodes intent; the LOGIN_FORM session-cookie consequence may not be deliberate, so confidence is bounded)

- "The five permit-all paths (`/actuator/health`, `/favicon.ico`, `/ingestion/entities`, `/ingestion/datasources`, `/api/slack/events`) are LOGIN_FORM-local rather than centralised. The path list at lines 49-51 is hand-rolled INSIDE this configuration file rather than referenced from `SecurityConstants.WHITELIST_PATHS` (which `AuthorizationCustomizer` uses for the OAuth/LDAP modes per AuthorizationCustomizer.java:22 — a different list including `/img/**`). The decision creates a per-mode whitelist drift surface: paths added to `WHITELIST_PATHS` for OAuth/LDAP would NOT be added to LOGIN_FORM's permittedPaths automatically. The fact that the list IS hand-rolled rather than referenced is itself the choice. (Sibling note: `SecurityConstants.WHITELIST_PATHS` is `[\"/actuator/**\", \"/favicon.ico\", \"/ingestion/**\", \"/img/**\", \"/api/slack/events\"]` per SecurityConstants.java:95-96 — wider than LOGIN_FORM's hand-rolled set, e.g. `/img/**` is missing here and `/actuator/**` is narrowed to only `/actuator/health`.)" — evidence: LoginFormSecurityConfiguration.java:49-51 + SecurityConstants.java:95-96 + AuthorizationCustomizer.java:22 — intent_anchor: the array literal `{ \"/actuator/health\", \"/favicon.ico\", \"/ingestion/entities\", \"/ingestion/datasources\", \"/api/slack/events\" }` authored inline at lines 49-51 instead of referencing the central `WHITELIST_PATHS` constant — confidence: MEDIUM (the absence of the cross-reference is the evidence; the deliberate-ness vs. drift-from-LDAP/OAuth is not commented)

- "Boot-time fail-fast on missing credentials: `@Value(\"${auth.login-form-credentials}\")` at line 70 has NO `:default` fallback (compare line 41 `${auth.login-form-redirect:}` and line 42 `${auth.s2s.enabled:false}` which DO have defaults). The decision is: a deployment that activates LOGIN_FORM but omits the credentials key MUST fail at boot rather than silently produce an empty user store. Spring throws `BeanCreationException` chained on `IllegalArgumentException: Could not resolve placeholder`. This is the correct fail-loud posture for a security-relevant configuration." — evidence: LoginFormSecurityConfiguration.java:70 (no default) vs LoginFormSecurityConfiguration.java:41-42 (defaults present) — intent_anchor: the asymmetric default-vs-no-default pattern across three `@Value` reads in the same method — confidence: HIGH

## bugs_limitations_corner_cases

- "**LOGIN_FORM mode runs WITHOUT the Policies/Permissions/Roles/Owners authorization framework.** `LoginFormSecurityConfiguration.java:55-57` configures only `.authorizeExchange(authorizeExchangeSpec -> authorizeExchangeSpec.pathMatchers(permittedPaths).permitAll().pathMatchers(\"/**\").authenticated())` — it does NOT call `new AuthorizationCustomizer(permissionService, extractors)` the way `OAuthSecurityConfiguration.java:98` and `LDAPSecurityConfiguration.java:145` do. The `AuthorizationCustomizer` (defined at `<odd-platform-repo>/odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/authorization/AuthorizationCustomizer.java:14-32`) walks `SecurityConstants.SECURITY_RULES:98-355` and applies per-Policy/Permission/Role/Owner access managers via `ReactiveAuthorizationManagerFactory.manager(...)`. By skipping it in LOGIN_FORM mode, every form-authenticated user can call every endpoint — including admin-only endpoints — regardless of any Policy/Permission/Role configured via the platform UI. Combined with the hard-coded ADMIN authority for every user (line 81), the LOGIN_FORM authorization story is: every authenticated request is ADMIN AND every authenticated request bypasses RBAC. The live Authorization documentation (WebFetched 2026-05-20) does not warn about this; it describes Policies/Permissions/Roles as if they apply universally. THIS IS THE LOAD-BEARING LOGIN_FORM-SPECIFIC FINDING and confirms F-008 read-collaborative-posture wide-open variant." — evidence: LoginFormSecurityConfiguration.java:53-66 + OAuthSecurityConfiguration.java:98 + LDAPSecurityConfiguration.java:145 + AuthorizationCustomizer.java:14-32 + WebFetch authorization docs 2026-05-20 — severity: HIGH

- "**`auth.login-form-redirect` is an open-redirect surface — no validation, no allowlist.** Line 41 reads the raw string with `@Value(\"${auth.login-form-redirect:}\")`, line 89 invokes `URI.create(redirectUri)` without validating scheme/host/path, and line 46 invokes `new DefaultServerRedirectStrategy().sendRedirect(wfe.getExchange(), redirectURI)`. The redirect target is whatever the operator placed in configuration. In deployments where this value is templated from environment substitution (helm chart, K8s ConfigMap, Docker env-vars driven by upstream pipelines), there is no boundary that rejects an attacker-controlled value. The fetched login-form docs page does not mention `login-form-redirect` at all (WebFetched 2026-05-20). Additionally, `URI.create()` throws `IllegalArgumentException` on syntactically invalid input — a malformed value crashes context refresh, which is fail-loud rather than fail-silent (correct posture), but the doc surface gives the operator no guidance." — evidence: LoginFormSecurityConfiguration.java:41 + LoginFormSecurityConfiguration.java:46-47 + LoginFormSecurityConfiguration.java:88-90 + WebFetch login-form docs 2026-05-20 — severity: MEDIUM

- "**Provider-null cross-mode bleed: a LOGIN_FORM user 'alice' resolves to the SAME `OwnerPojo` as an LDAP user 'alice'.** `AuthIdentityProviderImpl.getCurrentUser()` returns `UserDto(username, null)` for any non-OAuth2 authentication (LoginForm-authenticated users fall through to the else branch at AuthIdentityProviderImpl.java:31-32). Downstream `userOwnerMappingRepository.getAssociatedOwner(user.username(), null)` queries the table where `getConditions(provider, username)` evaluates `if (StringUtils.isNotEmpty(provider)) PROVIDER.eq(provider) else PROVIDER.isNull()` (`ReactiveUserOwnerMappingRepositoryImpl.java:121-125` — verified via that sidecar). Both LOGIN_FORM and LDAP authentications produce `provider=null` and resolve to the same `IS NULL` query result. The bleed is INVISIBLE at the LOGIN_FORM layer (this file does not set a `provider` tag on the SecurityContext), and the live docs do not warn that switching between LOGIN_FORM and LDAP (or operating both concurrently) creates a shared `provider=null` keyspace in `user_owner_mapping`." — evidence: LoginFormSecurityConfiguration.java:1-104 (no provider tag set on SecurityContext) + AuthIdentityProviderImpl.java:29-33 (LOGIN_FORM → else branch → provider=null) + ReactiveUserOwnerMappingRepositoryImpl.java:121-125 + the sidecar `lineage/odd-platform/understanding/odd-platform__java__repository__reactive__repository__ReactiveUserOwnerMappingRepositoryImpl.md` finding [3,4] — severity: HIGH

- "**`auth.login-form-credentials` has no default and crashes Spring boot if unset under `auth.type=LOGIN_FORM`.** Line 70 uses `@Value(\"${auth.login-form-credentials}\")` with no fallback (compare line 41 `${...:default}` form). An operator switching `auth.type` from DISABLED → LOGIN_FORM in their override config without supplying `auth.login-form-credentials` triggers `IllegalArgumentException: Could not resolve placeholder 'auth.login-form-credentials'`, which surfaces as a `BeanCreationException` at boot. The shipped `application.yml:37` carries the default `admin:admin,root:root` so an UNMODIFIED-config deployment uses those credentials — but a custom override supplying `auth.type=LOGIN_FORM` and omitting `auth.login-form-credentials` fails hard. Fail-loud is correct, but the doc surface does not flag the required-pair nature of these two keys." — evidence: LoginFormSecurityConfiguration.java:70 + application.yml:37 + WebFetch login-form docs 2026-05-20 — severity: LOW

- "**Credential string parsing is fragile and silently mishandles edge cases.** Line 75 splits on `,` (no quoting/escaping), line 99 splits on `:` (then `credentials[0]` and `credentials[1]` are taken — no length validation). Consequences: (a) a username containing `,` cannot be expressed (the credential is silently split); (b) a password containing `:` is silently truncated at the first `:` (only the first segment after the first `:` is taken as the password); (c) a password containing `,` is silently split into a username:password pair plus a partial entry; (d) leading/trailing whitespace is trimmed at line 101 (`.trim()`) — but if the credential format is `user:` with empty password, `credentials[1]` STILL succeeds (it's an empty string after the split); however `user` (no colon at all) throws `ArrayIndexOutOfBoundsException` at line 101. The behaviour is fail-loud only for the no-colon case; the other forms succeed but produce credentials the operator did NOT intend to ship. Plain-text storage amplifies the typo risk." — evidence: LoginFormSecurityConfiguration.java:73-83 + LoginFormSecurityConfiguration.java:98-102 — severity: MEDIUM

- "**Every LOGIN_FORM user is granted ADMIN authorities** — `getAuthorities(true)` at line 81 hard-codes the admin flag. There is no per-user role distinction (no admin vs. regular user separation in LOGIN_FORM mode). Combined with the absence of `AuthorizationCustomizer`, this means even if a future maintainer wired authorization checks into LOGIN_FORM mode, the role-based portion of any Policy would not differentiate users — they would all be ADMIN. The docs DO describe this (WebFetched 2026-05-20: 'All users authenticated through this method receive ADMIN privileges'), so this is documented behaviour rather than drift — but it interacts with the unrelated absence of `AuthorizationCustomizer` to produce the same effective end-state regardless of authorization wiring." — evidence: LoginFormSecurityConfiguration.java:81 + GrantedAuthorityExtractor.java:12-17 + WebFetch login-form docs 2026-05-20 — severity: LOW

- "**CSRF is unconditionally disabled on a session-cookie-based auth mode.** Line 54 calls `.csrf(ServerHttpSecurity.CsrfSpec::disable)` — even though LOGIN_FORM is the ONLY of the four auth modes that issues a session cookie as the principal credential bearer. CSRF is the canonical defense vector for state-changing requests (POST/PUT/DELETE/PATCH) where the principal credential rides automatically with browser-issued requests. A logged-in user visiting a malicious site can have their browser issue authenticated state-changing requests to the platform via the session cookie. The doc surface does not mention CSRF posture. The project may have decided REST clients (which set Authorization headers per request) are the dominant traffic pattern — but LOGIN_FORM's session cookie does NOT add such a header automatically, leaving form-authenticated browser sessions exposed. The convention is shared with the three other modes; the consequence under LOGIN_FORM is uniquely meaningful." — evidence: LoginFormSecurityConfiguration.java:54 + (live login-form docs 2026-05-20 silent on CSRF) — severity: MEDIUM

- "**No session cookie security flags are configured at the chain layer.** Spring WebFlux's session manager produces a `SESSION` cookie via reactive WebSession, but `LoginFormSecurityConfiguration` does NOT configure `HttpOnly`, `Secure`, `SameSite`, or session timeout via the chain. The cookie attributes come from Spring's WebFlux defaults plus the global `spring.session.timeout: -1` in `application.yml:1-3` (no expiry — sessions live forever). For a session-based authentication mode shipping plain-text credentials, this is meaningful: (a) a session cookie obtained on an HTTP (non-HTTPS) deployment is observable in transit (no `Secure` flag enforced); (b) a never-expiring session combined with no revocation mechanism (per the doc-page 'does not support … session revocation') means a compromised cookie is valid until the user clears it or the JVM restarts — the only revocation event in scope." — evidence: LoginFormSecurityConfiguration.java:53-66 (no session config) + application.yml:1-3 (`spring.session.timeout: -1`) + WebFetch login-form docs 2026-05-20 ('does not support rotation, session revocation, or MFA') — severity: MEDIUM

- "**Plain-text credentials in `auth.login-form-credentials` are recoverable via the actuator env endpoint by ANY caller in any auth mode.** The shipped `application.yml:226-240` exposes `health, prometheus, env, info` on the management endpoints with `endpoint.env.enabled: true`. Under LOGIN_FORM specifically: (a) `/actuator/health` is in this file's permittedPaths list (line 50) — unauthenticated; (b) `/actuator/env` is NOT in line 49-51's hand-rolled permittedPaths (so under LOGIN_FORM it requires authentication via `.pathMatchers(\"/**\").authenticated()` at line 57) — but ANY form-authenticated user can reach it and read the resolved value of `auth.login-form-credentials` verbatim. Spring Boot's `EnvironmentEndpoint` does NOT sanitise property values by name unless explicitly configured to do so (which the application.yml does not). Combined with the hard-coded ADMIN authority (line 81), any form-authenticated user with knowledge of the actuator path can extract the credentials of every other user." — evidence: LoginFormSecurityConfiguration.java:49-51 + LoginFormSecurityConfiguration.java:70 + LoginFormSecurityConfiguration.java:81 + application.yml:226-240 — severity: MEDIUM (HIGH if the management port is exposed to the network with no path-restriction)

- "**The five permit-all paths are hand-coded as a local constant, diverging from `SecurityConstants.WHITELIST_PATHS`.** Line 49-51 declares `{ \"/actuator/health\", \"/favicon.ico\", \"/ingestion/entities\", \"/ingestion/datasources\", \"/api/slack/events\" }`. The central whitelist at `SecurityConstants.java:95-96` is `{ \"/actuator/**\", \"/favicon.ico\", \"/ingestion/**\", \"/img/**\", \"/api/slack/events\" }` — a SUPERSET in some dimensions (`/actuator/**` vs `/actuator/health`; `/ingestion/**` vs `/ingestion/entities` + `/ingestion/datasources`; `/img/**` present in central, absent here) and SUBSET in others. A maintainer adding a new always-public path to `SecurityConstants.WHITELIST_PATHS` would silently leave LOGIN_FORM mode out of sync — paths public in OAUTH2/LDAP modes (because `AuthorizationCustomizer.java:22` uses `WHITELIST_PATHS`) would require authentication in LOGIN_FORM and vice-versa. This is a centralisation gap. Notably, LOGIN_FORM is NARROWER on `/actuator/**` (only `/actuator/health` is whitelisted, not `/actuator/prometheus|env|info`), so under LOGIN_FORM the prometheus/env/info endpoints require authentication — whereas under OAuth/LDAP they are open via `WHITELIST_PATHS`." — evidence: LoginFormSecurityConfiguration.java:49-51 + SecurityConstants.java:95-96 + AuthorizationCustomizer.java:22 — severity: LOW

- "**Multi-credential is technically supported but framed as 'multi-tenant' is misleading.** The credential-string parser accepts multiple `user:password` pairs separated by `,` — so an operator CAN configure multiple credentials (which IS the intent of the shipped default `admin:admin,root:root`). However: (a) all credentials grant identical ADMIN authorities; (b) none can be revoked individually without re-deploying with a new value; (c) no per-user metadata (email, last-login, owner association) is captured at this layer; (d) no audit trail distinguishes 'admin' from 'root' in the access log; (e) there is no migration path from `admin:admin,root:root` to a Postgres-backed identity. The 'multi-credential' configuration is more accurately framed as multi-shared-secret than multi-tenant — there is no tenant boundary, just multiple known passwords for the same effective principal." — evidence: LoginFormSecurityConfiguration.java:74-83 + LoginFormSecurityConfiguration.java:81 (ADMIN-for-all) — severity: LOW

- "**Empty `auth.login-form-redirect` defaults to `/`, masking misconfiguration.** Line 41 `@Value(\"${auth.login-form-redirect:}\")` with empty default + line 88-89 `StringUtils.hasLength(redirectUri) ? URI.create(...) : null` + line 45 `redirectURI != null ? <custom-handler> : new RedirectServerAuthenticationSuccessHandler(\"/\")`. An operator who sets `auth.login-form-redirect=` (empty string — common in env-var substitution where an unset env var resolves to empty) gets the silent fallback to `/`. An operator who sets `auth.login-form-redirect=` thinking it disables post-login redirect entirely (and expects a 200 with no redirect on success) gets a 302 to `/` instead. The behaviour-vs-intent gap is real and the doc page does not mention this key." — evidence: LoginFormSecurityConfiguration.java:41,45-47,88-90 + WebFetch login-form docs 2026-05-20 — severity: LOW

- "**No brute-force protection.** Line 53-66 has no rate-limiting filter, no account-lockout policy, no `MaxFailedLoginAttempts` configuration. The only natural rate-limit is BCrypt's ~100ms encode-compare per attempt (Spring's `MapReactiveUserDetailsService.findByUsername` is O(1) hash lookup, but the password comparison goes through the delegating encoder per attempt). A network attacker who can reach the platform's HTTP port can submit unlimited login attempts. LOGIN_FORM is dev-only per docs, but if an operator ignores the warning and exposes a LOGIN_FORM deployment to the network, no platform-side guardrail prevents brute-force." — evidence: LoginFormSecurityConfiguration.java:53-66 (no rate-limit filter) + LoginFormSecurityConfiguration.java:72,79 (BCrypt encode-compare is the only friction) — severity: LOW

- "**No log statement on credential parse or user-store population.** The class is not `@Slf4j`, has no `log.info(\"LOGIN_FORM: registered N users\")` at line 85, no log on missing/malformed credential entries (lines 73-83). An operator who mistypes the credentials string and ends up with a different user set than intended gets no boot-time signal. Contrast with `LDAPSecurityConfiguration.java:56` which IS `@Slf4j`. The silent-boot pattern matches the LSN-001 / LSN-010 class of failures." — evidence: LoginFormSecurityConfiguration.java:1-104 (no Slf4j imports, no logger field) + LDAPSecurityConfiguration.java:56 (`@Slf4j`) — severity: LOW

## security

- **auth_mode_relevance**: `LOGIN_FORM` (this configuration class IS the LOGIN_FORM-mode `SecurityWebFilterChain` factory; the entire class is gated by `@ConditionalOnProperty(value=\"auth.type\", havingValue=\"LOGIN_FORM\")` at line 31; no `matchIfMissing`; case-sensitive). The class is NOT relevant to `DISABLED`, `OAUTH2`, or `LDAP` modes — those are sibling SecurityConfigurations with parallel `@ConditionalOnProperty` gates. `S2S` is orthogonal: when `auth.s2s.enabled=true` AND `auth.type=LOGIN_FORM`, the `S2sAuthenticationFilter` is additively chained at lines 61-63 at the `HTTP_BASIC` filter order (same insertion point as the OAuth/LDAP siblings).

- **ingestion_filter_relevance**: `NO — UI/API surface plus permit-all ingestion paths`. The class permits `/ingestion/entities` and `/ingestion/datasources` unconditionally at line 50, deferring ingestion auth to the separate `IngestionDataEntitiesFilter` (gated by `auth.ingestion.filter.enabled`, default `false` per `application.yml:46-48`; verified via the IngestionDataEntitiesFilter sidecar at `lineage/odd-platform/understanding/odd-platform__java__IngestionDataEntitiesFilter__config-key-consumer__auth_ingestion_filter_enabled@L20.md`). This class does NOT directly participate in `POST /ingestion/entities` authentication. The compound finding: under LOGIN_FORM + `auth.ingestion.filter.enabled=false` (bundled default), `/ingestion/entities` is anonymously reachable — sibling facet of REFACTOR-185 normally surfaced under DISABLED, manifesting also under LOGIN_FORM.

- **authorization_assertions**: `[]` — **THE ABSENCE IS THE FINDING**. The chain has `.authorizeExchange(authorizeExchangeSpec -> authorizeExchangeSpec.pathMatchers(permittedPaths).permitAll().pathMatchers(\"/**\").authenticated())` at lines 55-57 — NO `@PreAuthorize`, NO programmatic `permissionService.hasPermission(...)`, NO `new AuthorizationCustomizer(permissionService, extractors)`. Unlike OAuth (`OAuthSecurityConfiguration.java:98`) and LDAP (`LDAPSecurityConfiguration.java:145`), this configuration deliberately wires NO permission framework integration. The only access gate post-permitAll is `authenticated()`. This means `SecurityConstants.SECURITY_RULES:98-355` (the per-Policy/Permission/Role/Owner rule table) is INERT under LOGIN_FORM — every authenticated user can call every rule-gated endpoint regardless of any Policy/Role assignment the operator may have configured via the platform UI.

- **owner_scoping**: `N/A — SecurityConfiguration class, not data-scoped`. The class authenticates users but does not query data entities; downstream controllers are responsible for owner-scoping. Under LOGIN_FORM, however, the absence of `AuthorizationCustomizer` means that even controllers RELYING on `permissionService.hasPermission(...)` calls (rather than annotation-based gates from `SECURITY_RULES`) would not be reached via the rule table — the request reaches the controller unfiltered by the per-Owner permission framework. Combined with the provider-null cross-mode bleed (downstream_side_effects above), a LOGIN_FORM user's `fetchAssociatedOwner()` result is whatever owner row matched `(username, provider=null)` in `user_owner_mapping` — potentially a row created under a different auth-mode session.

- **data_exposure**:
  - "Session cookie (default Spring WebFlux `SESSION` cookie, never-expiring per `spring.session.timeout: -1` in `application.yml:3`, no `Secure`/`HttpOnly`/`SameSite` configured at this layer) → any authenticated browser; cookie disclosure on a non-HTTPS deployment grants persistent authenticated ADMIN session" — evidence: LoginFormSecurityConfiguration.java:53-66 + application.yml:1-3
  - "Plain-text credentials in `auth.login-form-credentials` → recoverable via `/actuator/env` (`management.endpoint.env.enabled: true` per application.yml:237-238) by any authenticated user (under LOGIN_FORM, the env endpoint requires auth but auth = ADMIN; under DISABLED auth.type, env is unauthenticated and ALSO permitAll-ed in DisabledAuth's anyExchange.permitAll(); under OAUTH2/LDAP, env is whitelisted via SecurityConstants.WHITELIST_PATHS:95-96)" — evidence: LoginFormSecurityConfiguration.java:50,70,81 + application.yml:226-240 + SecurityConstants.java:95-96
  - "Active auth mode (`LOGIN_FORM`) → fingerprinted via `/api/appInfo` response per the AppInfoController sidecar (`lineage/odd-platform/understanding/odd-platform__java__AppInfoController__config-key-consumer__auth_type@L18.md`) — operators learning the platform's auth mode without authentication"
  - "ADMIN authority hard-coded for every form-authenticated user → every endpoint reachable; no per-user least-privilege boundary" — evidence: LoginFormSecurityConfiguration.java:81 + GrantedAuthorityExtractor.java:12-17

- **known_security_gaps**:
  - "LOGIN_FORM has NO authorization framework wiring (no AuthorizationCustomizer, no per-Policy/Permission/Role/Owner enforcement). Every form-authenticated user can call every endpoint regardless of any Policy/Role configuration. Confirms F-008 read-collaborative-posture wide-open variant and REFACTOR-073 batch B finding." — evidence: LoginFormSecurityConfiguration.java:55-57 + OAuthSecurityConfiguration.java:98 + LDAPSecurityConfiguration.java:145 + AuthorizationCustomizer.java:14-32 — severity: HIGH
  - "Provider-null cross-mode bleed — LOGIN_FORM and LDAP both produce `provider=null` at `AuthIdentityProviderImpl.getCurrentUser()` (LoginForm via the else branch at line 31-32; LDAP for the same reason — no OAuth2AuthenticationToken instance). Downstream `ReactiveUserOwnerMappingRepositoryImpl.getConditions:121-125` resolves both to the same `WHERE PROVIDER IS NULL` query. A LOGIN_FORM `alice` and an LDAP `alice` resolve to the SAME `OwnerPojo`. The live docs do not warn about this cross-mode owner-row collision." — evidence: LoginFormSecurityConfiguration.java:1-104 (no provider tag) + AuthIdentityProviderImpl.java:29-33 + ReactiveUserOwnerMappingRepositoryImpl.java:121-125 — severity: HIGH
  - "Open-redirect surface — `auth.login-form-redirect` reaches `DefaultServerRedirectStrategy.sendRedirect(...)` with no scheme/host/path validation. Templated config values from untrusted upstream pipelines become attacker-controlled redirect targets." — evidence: LoginFormSecurityConfiguration.java:41 + LoginFormSecurityConfiguration.java:46-47 + LoginFormSecurityConfiguration.java:88-90 — severity: MEDIUM
  - "Plain-text credentials stored in `auth.login-form-credentials` are recoverable via the env actuator (`management.endpoint.env.enabled: true` per `application.yml:237-238`). Under LOGIN_FORM, any form-authenticated user can extract the credentials of every other user via `/actuator/env`." — evidence: LoginFormSecurityConfiguration.java:50,70,81 + application.yml:227-244 — severity: MEDIUM
  - "Session cookie has no `Secure`/`HttpOnly`/`SameSite` configured at this layer, and `spring.session.timeout: -1` makes sessions never expire. A cookie compromised on HTTP (or via XSS — note CSRF disabled adds no defense here either) is valid until JVM restart with no revocation mechanism (per docs: 'does not support … session revocation'). This is the ONLY auth mode that issues a session cookie as the primary credential bearer." — evidence: LoginFormSecurityConfiguration.java:53-66 + application.yml:3 + WebFetch login-form docs 2026-05-20 — severity: MEDIUM
  - "CSRF disabled (line 54) on a session-cookie-based auth mode — a logged-in user visiting a malicious page can have state-changing requests issued via their session cookie. Mitigated only if downstream endpoints all reject cookie-bearing POSTs without an additional header (which they do not — controllers accept session auth)." — evidence: LoginFormSecurityConfiguration.java:54 — severity: MEDIUM
  - "Shipped default credentials `admin:admin,root:root` (application.yml:37) are insecure-by-default; doc warning is the only guardrail. No boot-time fail-fast on detected default credentials + non-loopback bind." — evidence: application.yml:37 + LoginFormSecurityConfiguration.java:70-86 + WebFetch login-form docs 2026-05-20 — severity: MEDIUM
  - "Credential parsing accepts edge cases that silently mis-create users (passwords containing `:` truncated, usernames containing `,` split, no-colon entry throws AIOOBE). Plain-text storage amplifies the typo risk." — evidence: LoginFormSecurityConfiguration.java:73-83 + LoginFormSecurityConfiguration.java:98-102 — severity: LOW
  - "S2S+LOGIN_FORM composition produces an authentication state where session-cookie ADMIN and X-API-Key ADMIN are operationally indistinguishable — both bypass the absent AuthorizationCustomizer. Operators thinking S2S is a more-privileged surface (per LDAP / OAUTH2 mental model where the interactive auth has its own authority mapping) are mistaken under LOGIN_FORM." — evidence: LoginFormSecurityConfiguration.java:61-63,81 + S2sAuthenticationFilter.java:31-34 — severity: MEDIUM

## performance

- **hot_paths**:
  - "Form-login filter on every authenticated request: `MapReactiveUserDetailsService.findByUsername(username)` is O(N) over the configured credential count (N = number of `user:password` pairs in the config string). For dev-scale N (1-10), this is negligible. The bottleneck is BCrypt's ~100ms password comparison via the delegating encoder (line 72 + 79)." — evidence: LoginFormSecurityConfiguration.java:68-86 (Spring stock MapReactiveUserDetailsService.findByUsername iterates its internal map by username)
  - "S2sAuthenticationFilter (when enabled) on every request: invokes `s2sTokenProvider.isValidToken(...)` once per request; behaviour depends on the token-provider implementation (out of scope for this node — see S2sTokenProvider sidecar)." — evidence: LoginFormSecurityConfiguration.java:61-63 + S2sAuthenticationFilter.java:26-28
- **throughput_characteristics**:
  - "Stateless per-request auth check with session-bound state for form-login (session cookie); reactive-stack non-blocking via WebFlux."
  - "BCrypt password encoding via `PasswordEncoderFactories.createDelegatingPasswordEncoder()` (line 72) is invoked ONCE per credential at bean construction (line 79 `passwordEncoder(pe::encode)`), NOT per request — encoding cost amortises over JVM lifetime."
  - "Per-request password VERIFICATION via the delegating encoder's compare path is BCrypt-cost (~100ms) regardless of attempt outcome; this is the natural rate-limit on brute-force attacks."
- **resource_allocation**:
  - "In-memory `MapReactiveUserDetailsService` (line 85) — bounded by credential count, negligible at dev scale. No external store, no connection pool, no DB round-trip."
  - "Constructor injects `S2sAuthenticationFilter` (line 36) regardless of `auth.s2s.enabled`, so the filter bean exists in the Spring context even when `auth.s2s.enabled=false` — small memory cost, no runtime cost when disabled (the filter is only mounted to the chain inside `if (s2sEnabled)` at line 61)."
  - "PasswordEncoder is constructed once at bean-method invocation (line 72), then reused via `pe::encode` for every credential entry; method-local lifecycle."
- **scaling_characteristics**:
  - "Stateless across replicas only if a shared session store is used. With the shipped `session.provider: IN_MEMORY` (application.yml:30), session state lives in JVM heap — replicas do NOT share session state, so a load-balanced deployment may force users to re-authenticate on each replica switch (unless sticky sessions are configured at the LB layer). LOGIN_FORM is dev-only per docs, so this is acceptable for the documented intent — but operators promoting LOGIN_FORM to a multi-replica deployment hit this without warning." — evidence: LoginFormSecurityConfiguration.java:53-66 + application.yml:28-30 (`session.provider: IN_MEMORY`)
  - "Credential set is static per JVM — adding/removing/rotating a user requires a restart to re-parse `auth.login-form-credentials` at bean construction. No runtime credential management API; no warm-config reload." — evidence: LoginFormSecurityConfiguration.java:70-86
  - "SecurityWebFilterChain is built once at boot (no `@Order(...)` annotation present, but Spring Boot's reactive security autoconfiguration assigns a default order); the chain itself is immutable for the JVM lifetime — config changes require restart." — evidence: LoginFormSecurityConfiguration.java:38-66
- **known_performance_gaps**:
  - "No connection-throttling/brute-force protection on form-login: an attacker can submit unlimited login attempts against the in-memory store. BCrypt encoding adds a ~100ms cost per attempt, which is the only natural rate-limit. For a public network-reachable deployment (which docs warn against), this is insufficient." — evidence: LoginFormSecurityConfiguration.java:53-66 (no rate-limit filter, no lockout) — severity: LOW (LOGIN_FORM is dev-only per docs; severity capped accordingly)
  - "No shared session store wired — multi-replica deployments break LOGIN_FORM session continuity without sticky sessions at the LB layer. No doc surface flags this prerequisite." — evidence: LoginFormSecurityConfiguration.java:53-66 + application.yml:28-30 — severity: LOW (LOGIN_FORM is dev-only)

## sources

- understanding ← LoginFormSecurityConfiguration.java:1-104 (full file) + sibling diffs at DisabledAuthSecurityConfiguration.java:9-19 + OAuthSecurityConfiguration.java:70-178 + LDAPSecurityConfiguration.java:50-154 + AppToolbar sidecar substitution_note
- concepts.entities.LoginFormSecurityConfiguration ← LoginFormSecurityConfiguration.java:30-34
- concepts.entities.securityWebFilterChainLoginForm ← LoginFormSecurityConfiguration.java:38-66
- concepts.entities.mapReactiveUserDetailsService ← LoginFormSecurityConfiguration.java:68-86
- concepts.entities.LoginFormCredentials ← LoginFormSecurityConfiguration.java:92-103
- concepts.entities.GrantedAuthorityExtractor ← LoginFormSecurityConfiguration.java:35 + GrantedAuthorityExtractor.java:9-18
- concepts.entities.S2sAuthenticationFilter ← LoginFormSecurityConfiguration.java:36,62 + S2sAuthenticationFilter.java:17-49
- concepts.entities.PasswordEncoder ← LoginFormSecurityConfiguration.java:72 (PasswordEncoderFactories.createDelegatingPasswordEncoder)
- concepts.invariants.[no-matchIfMissing] ← LoginFormSecurityConfiguration.java:31
- concepts.invariants.[ADMIN-for-every-user] ← LoginFormSecurityConfiguration.java:81 + GrantedAuthorityExtractor.java:12-17
- concepts.invariants.[CSRF-disabled] ← LoginFormSecurityConfiguration.java:54
- concepts.invariants.[no-AuthorizationCustomizer] ← LoginFormSecurityConfiguration.java:55-57 (the absence) + OAuthSecurityConfiguration.java:98 + LDAPSecurityConfiguration.java:145 (the presence in siblings)
- concepts.invariants.[S2S at HTTP_BASIC] ← LoginFormSecurityConfiguration.java:61-63 + identical pattern at OAuthSecurityConfiguration.java:108-110 + LDAPSecurityConfiguration.java:149-151
- concepts.invariants.[permit-all-paths] ← LoginFormSecurityConfiguration.java:49-56
- concepts.invariants.[credential-parsing] ← LoginFormSecurityConfiguration.java:73-83 + LoginFormSecurityConfiguration.java:98-102
- concepts.invariants.[no-default-on-credentials] ← LoginFormSecurityConfiguration.java:70 vs LoginFormSecurityConfiguration.java:41-42 (asymmetric `@Value` defaults)
- concepts.invariants.[provider=null downstream] ← LoginFormSecurityConfiguration.java:1-104 (no provider tag) + AuthIdentityProviderImpl.java:29-33 (else branch returns provider=null for non-OAuth2 authentication)
- dependencies_semantic.requires-config.auth.type ← LoginFormSecurityConfiguration.java:31 + application.yml:32-34
- dependencies_semantic.requires-config.auth.login-form-credentials ← LoginFormSecurityConfiguration.java:70 + application.yml:37
- dependencies_semantic.requires-config.auth.login-form-redirect ← LoginFormSecurityConfiguration.java:41 + application.yml:44-45
- dependencies_semantic.requires-config.auth.s2s.enabled ← LoginFormSecurityConfiguration.java:42 + application.yml:40-41
- dependencies_semantic.requires-feature ← LoginFormSecurityConfiguration.java:32 (@EnableWebFluxSecurity) + LoginFormSecurityConfiguration.java:35-36 (constructor injection of extractor + s2s filter) + S2sAuthenticationFilter.java:17-19 (@Component)
- upstream_callers.[spring-boot-autoconfiguration] ← LoginFormSecurityConfiguration.java:30 (`@Configuration` consumed by component scan) — verified by grep across `<odd-platform-repo>/odd-platform-api/src/main/java` for `LoginFormSecurityConfiguration` returning only the file itself
- upstream_callers.[spring-security-webflux] ← LoginFormSecurityConfiguration.java:38-66 (`@Bean SecurityWebFilterChain`) — Spring Security WebFlux registers this bean into `WebFilterChainProxy`
- upstream_callers.[spring-security-userdetails] ← LoginFormSecurityConfiguration.java:68-86 (`@Bean MapReactiveUserDetailsService`) — auto-wired into the `ReactiveUserDetailsService` slot used by form-login
- downstream_side_effects.[no-AuthorizationCustomizer] ← LoginFormSecurityConfiguration.java:55-57 + OAuthSecurityConfiguration.java:98 + LDAPSecurityConfiguration.java:145 + AuthorizationCustomizer.java:14-32 + SecurityConstants.java:98-355 (the rule table that goes inert)
- downstream_side_effects.[ADMIN-for-every-user] ← LoginFormSecurityConfiguration.java:81 + GrantedAuthorityExtractor.java:12-17
- downstream_side_effects.[provider-null-bleed] ← LoginFormSecurityConfiguration.java:1-104 + AuthIdentityProviderImpl.java:29-33 + ReactiveUserOwnerMappingRepositoryImpl.java:121-125 (cross-sidecar evidence)
- downstream_side_effects.[framework-default-login-page] ← LoginFormSecurityConfiguration.java:58 (no loginPage override) + AppToolbar sidecar substitution_note + LDAPSecurityConfiguration.java:147 (`formLogin(Customizer.withDefaults())` parallel)
- downstream_side_effects.[open-redirect-on-success] ← LoginFormSecurityConfiguration.java:41,46-47,88-90
- downstream_side_effects.[in-memory-user-store] ← LoginFormSecurityConfiguration.java:85
- downstream_side_effects.[permitted-paths-anonymous-ingestion] ← LoginFormSecurityConfiguration.java:49-51 + sidecar `lineage/odd-platform/understanding/odd-platform__java__IngestionDataEntitiesFilter__config-key-consumer__auth_ingestion_filter_enabled@L20.md`
- downstream_side_effects.[s2s-composes-additively] ← LoginFormSecurityConfiguration.java:61-63 + S2sAuthenticationFilter.java:31-34
- downstream_side_effects.[mutex-with-siblings] ← LoginFormSecurityConfiguration.java:31 + DisabledAuthSecurityConfiguration.java:10 + OAuthSecurityConfiguration.java:71 + LDAPSecurityConfiguration.java:51
- tests_coverage_semantic.gaps ← Glob `<odd-platform-repo>/odd-platform-api/src/test/**/*ogin*.java` (no matches) + Glob `<odd-platform-repo>/odd-platform-api/src/test/**/*ecurity*.java` (no matches) + full enumeration of `<odd-platform-repo>/odd-platform-api/src/test/**/*.java` on 2026-05-20 (no security/auth/login tests)
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/login-form on 2026-05-20, status 200
- docs_link_semantic.inferred_docs.[1] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/s2s on 2026-05-20, status 200
- docs_link_semantic.inferred_docs.[2] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization on 2026-05-20, status 200
- docs_link_semantic.doc_drift_findings.[login-form-redirect-undocumented] ← LoginFormSecurityConfiguration.java:41,46-47,88-90 + WebFetch login-form docs 2026-05-20
- docs_link_semantic.doc_drift_findings.[s2s-login-form-composition-undocumented-consequence] ← LoginFormSecurityConfiguration.java:55-57,81 + S2sAuthenticationFilter.java:31-34 + WebFetch s2s docs 2026-05-20 + WebFetch login-form docs 2026-05-20
- docs_link_semantic.doc_drift_findings.[authorization-framework-absent-undocumented] ← LoginFormSecurityConfiguration.java:55-57 + OAuthSecurityConfiguration.java:98 + LDAPSecurityConfiguration.java:145 + AuthorizationCustomizer.java:14-32 + WebFetch authorization docs 2026-05-20
- docs_link_semantic.doc_drift_findings.[framework-default-rendering-undocumented] ← LoginFormSecurityConfiguration.java:58 + AppToolbar sidecar substitution_note + WebFetch login-form docs 2026-05-20
- docs_link_semantic.doc_drift_findings.[credential-parsing-edge-cases] ← LoginFormSecurityConfiguration.java:73-83,98-102 + WebFetch login-form docs 2026-05-20
- docs_link_semantic.doc_drift_findings.[required-pair-undocumented] ← LoginFormSecurityConfiguration.java:70 + WebFetch login-form docs 2026-05-20
- docs_link_semantic.doc_drift_findings.[shipped-defaults-warning-only] ← application.yml:37 + LoginFormSecurityConfiguration.java:70-86 + WebFetch login-form docs 2026-05-20
- implicit_adrs.[lightweight-dev-demo-path] ← application.yml:36-37 + LoginFormSecurityConfiguration.java:68-86 + WebFetch login-form docs 2026-05-20
- implicit_adrs.[ADMIN-for-every-user] ← LoginFormSecurityConfiguration.java:81 + GrantedAuthorityExtractor.java:12-17 + WebFetch login-form docs 2026-05-20
- implicit_adrs.[s2s-additive-composition] ← LoginFormSecurityConfiguration.java:61-63 + OAuthSecurityConfiguration.java:108-110 + LDAPSecurityConfiguration.java:149-151 + WebFetch s2s docs 2026-05-20
- implicit_adrs.[framework-default-login-page] ← LoginFormSecurityConfiguration.java:58 + AppToolbar sidecar substitution_note + LDAPSecurityConfiguration.java:147
- implicit_adrs.[CSRF-disabled-convention] ← LoginFormSecurityConfiguration.java:54 + OAuthSecurityConfiguration.java:96 + LDAPSecurityConfiguration.java:143 + DisabledAuthSecurityConfiguration.java:15
- implicit_adrs.[hand-rolled-whitelist-divergence] ← LoginFormSecurityConfiguration.java:49-51 + SecurityConstants.java:95-96 + AuthorizationCustomizer.java:22
- implicit_adrs.[no-default-fail-loud-credentials] ← LoginFormSecurityConfiguration.java:70 vs LoginFormSecurityConfiguration.java:41-42 (asymmetric defaults across three `@Value` reads)
- bugs_limitations_corner_cases.[no-AuthorizationCustomizer] ← LoginFormSecurityConfiguration.java:53-66 + OAuthSecurityConfiguration.java:98 + LDAPSecurityConfiguration.java:145 + AuthorizationCustomizer.java:14-32 + WebFetch authorization docs 2026-05-20
- bugs_limitations_corner_cases.[open-redirect] ← LoginFormSecurityConfiguration.java:41,46-47,88-90 + WebFetch login-form docs 2026-05-20
- bugs_limitations_corner_cases.[provider-null-bleed] ← LoginFormSecurityConfiguration.java:1-104 + AuthIdentityProviderImpl.java:29-33 + ReactiveUserOwnerMappingRepositoryImpl.java:121-125 + sidecar `lineage/odd-platform/understanding/odd-platform__java__repository__reactive__repository__ReactiveUserOwnerMappingRepositoryImpl.md`
- bugs_limitations_corner_cases.[no-default-bean-creation-exception] ← LoginFormSecurityConfiguration.java:70 + application.yml:37
- bugs_limitations_corner_cases.[credential-parsing-edge-cases] ← LoginFormSecurityConfiguration.java:73-83,98-102
- bugs_limitations_corner_cases.[ADMIN-for-every-user] ← LoginFormSecurityConfiguration.java:81 + GrantedAuthorityExtractor.java:12-17
- bugs_limitations_corner_cases.[csrf-on-session-cookie-mode] ← LoginFormSecurityConfiguration.java:54
- bugs_limitations_corner_cases.[session-cookie-flags-unset] ← LoginFormSecurityConfiguration.java:53-66 + application.yml:1-3 + WebFetch login-form docs 2026-05-20
- bugs_limitations_corner_cases.[actuator-env-credential-leak] ← LoginFormSecurityConfiguration.java:50,70,81 + application.yml:226-240
- bugs_limitations_corner_cases.[whitelist-divergence] ← LoginFormSecurityConfiguration.java:49-51 + SecurityConstants.java:95-96
- bugs_limitations_corner_cases.[multi-credential-vs-multi-tenant] ← LoginFormSecurityConfiguration.java:74-83,81
- bugs_limitations_corner_cases.[empty-redirect-silent-default] ← LoginFormSecurityConfiguration.java:41,45-47,88-90
- bugs_limitations_corner_cases.[no-brute-force-protection] ← LoginFormSecurityConfiguration.java:53-66,72,79
- bugs_limitations_corner_cases.[no-slf4j-no-log] ← LoginFormSecurityConfiguration.java:1-104 + LDAPSecurityConfiguration.java:56
- security.auth_mode_relevance ← LoginFormSecurityConfiguration.java:31
- security.ingestion_filter_relevance ← LoginFormSecurityConfiguration.java:50 + sibling sidecar `lineage/odd-platform/understanding/odd-platform__java__IngestionDataEntitiesFilter__config-key-consumer__auth_ingestion_filter_enabled@L20.md`
- security.authorization_assertions ← LoginFormSecurityConfiguration.java:55-57 (the absence is the finding) + OAuthSecurityConfiguration.java:98 + LDAPSecurityConfiguration.java:145
- security.owner_scoping ← LoginFormSecurityConfiguration.java:1-104 (no data scoping in this class) + AuthIdentityProviderImpl.java:50-53 (downstream owner resolution) + ReactiveUserOwnerMappingRepositoryImpl.java:121-125 (provider-null bleed)
- security.data_exposure.[session-cookie] ← LoginFormSecurityConfiguration.java:53-66 + application.yml:1-3
- security.data_exposure.[actuator-env-credentials] ← LoginFormSecurityConfiguration.java:50,70,81 + application.yml:226-240 + SecurityConstants.java:95-96
- security.data_exposure.[auth-mode-fingerprint] ← AppInfoController sidecar (cross-axis reference)
- security.data_exposure.[ADMIN-everywhere] ← LoginFormSecurityConfiguration.java:81 + GrantedAuthorityExtractor.java:12-17
- security.known_security_gaps.[no-authorization-framework] ← LoginFormSecurityConfiguration.java:55-57 + OAuthSecurityConfiguration.java:98 + LDAPSecurityConfiguration.java:145
- security.known_security_gaps.[provider-null-bleed] ← LoginFormSecurityConfiguration.java:1-104 + AuthIdentityProviderImpl.java:29-33 + ReactiveUserOwnerMappingRepositoryImpl.java:121-125
- security.known_security_gaps.[open-redirect] ← LoginFormSecurityConfiguration.java:41,46-47,88-90
- security.known_security_gaps.[actuator-env-credential-leak] ← LoginFormSecurityConfiguration.java:50,70,81 + application.yml:227-244
- security.known_security_gaps.[session-cookie-flags] ← LoginFormSecurityConfiguration.java:53-66 + application.yml:3
- security.known_security_gaps.[csrf-disabled-session-mode] ← LoginFormSecurityConfiguration.java:54
- security.known_security_gaps.[shipped-default-credentials] ← application.yml:37 + LoginFormSecurityConfiguration.java:70-86
- security.known_security_gaps.[credential-parsing-edge-cases] ← LoginFormSecurityConfiguration.java:73-83,98-102
- security.known_security_gaps.[s2s-login-form-indistinguishable] ← LoginFormSecurityConfiguration.java:61-63,81 + S2sAuthenticationFilter.java:31-34
- performance.hot_paths.[form-login-userdetails] ← LoginFormSecurityConfiguration.java:68-86 + LoginFormSecurityConfiguration.java:72,79 (BCrypt encode-compare)
- performance.hot_paths.[s2s-filter-when-enabled] ← LoginFormSecurityConfiguration.java:61-63 + S2sAuthenticationFilter.java:26-28
- performance.throughput_characteristics ← LoginFormSecurityConfiguration.java:53-66 + LoginFormSecurityConfiguration.java:72,79
- performance.resource_allocation ← LoginFormSecurityConfiguration.java:36,61-63,72,85
- performance.scaling_characteristics.[in-memory-session] ← LoginFormSecurityConfiguration.java:53-66 + application.yml:28-30
- performance.scaling_characteristics.[static-credentials] ← LoginFormSecurityConfiguration.java:70-86
- performance.scaling_characteristics.[immutable-chain] ← LoginFormSecurityConfiguration.java:38-66
- performance.known_performance_gaps.[no-brute-force-rate-limit] ← LoginFormSecurityConfiguration.java:53-66,72,79
- performance.known_performance_gaps.[no-shared-session-store] ← LoginFormSecurityConfiguration.java:53-66 + application.yml:28-30

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- upstream_callers: HIGH
- downstream_side_effects: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH (three live doc pages WebFetched 2026-05-20 status 200; verbatim excerpts cited; six doc-drift findings each anchored on code:line + fetched-excerpt cross-check)
- implicit_adrs: HIGH (seven ADRs, each cross-anchored across the four sibling SecurityConfiguration files or on cross-layer evidence)
- bugs_limitations_corner_cases: HIGH (each finding cited to file:line + cross-referenced sibling lines or live-doc excerpt)
- security: HIGH
- performance: HIGH

## coherence_check

- performed: true
- date: 2026-05-20
- contradictions_found: none
- strengthens:
  - "REFACTOR-185 (DISABLED-mode bypass 23-SIDECAR) — this sidecar adds the LOGIN_FORM facet: under LOGIN_FORM + `auth.ingestion.filter.enabled=false` (bundled default), `/ingestion/entities` is anonymously reachable via the hand-rolled permittedPaths list at lines 49-51. The compound failure shape parallels DISABLED's `anyExchange.permitAll()` for the ingestion path. The 'authorization framework absent' finding (lines 55-57) ALSO strengthens REFACTOR-185 — under LOGIN_FORM, SECURITY_RULES is inert exactly as it is under DISABLED."
  - "F-011 P-09:F-002 Principal-to-Owner Resolution drift class `login_form_ldap_provider_null_cross_mode_bleed` — this sidecar provides the LOGIN_FORM-side anchor for the cross-mode bleed mechanism documented at `ReactiveUserOwnerMappingRepositoryImpl.md:bugs_limitations_corner_cases.[3,4]`. The bleed was previously documented at the repository layer (where the SQL `IS NULL` predicate lives) and at the principal-resolution layer (`AuthIdentityProviderImpl.md`); this sidecar closes the loop at the auth-configuration layer (showing why LOGIN_FORM produces provider=null at all)."
  - "F-008 P-09:F-001 UI authentication read-collaborative-posture — this sidecar confirms the LOGIN_FORM variant of the wide-open posture: every authenticated user can read/write every endpoint because `AuthorizationCustomizer` is not wired. The OAuth/LDAP siblings DO wire AuthorizationCustomizer, so under those modes the read-collaborative posture is constrained by `SECURITY_RULES`; under LOGIN_FORM and DISABLED, it isn't."
  - "AppToolbar sidecar substitution_note (`session-2026-05-20-Q`) — this sidecar provides the BACKEND-side anchor (no `formLoginSpec.loginPage(...)` override at line 58) for the UI-side observation (no LoginForm React component in `odd-platform-ui`). The two artefacts together confirm 'framework-default form-login rendering' as a deliberate, symmetric-across-layers design choice."
- supersedes: none
- coherence-conflict batch entries surfaced for maintainer: none
- entity-to-artefact reverse index entries to update:
  - "LoginFormSecurityConfiguration → understanding (this file)"
  - "auth.type=LOGIN_FORM → this sidecar (axis: config_prefixes)"
  - "auth.login-form-credentials → this sidecar + sibling sidecar @L31"
  - "auth.login-form-redirect → this sidecar + sibling sidecar @L31"
  - "auth.s2s.enabled compositional path (LOGIN_FORM branch) → this sidecar"
  - "MapReactiveUserDetailsService → this sidecar (sole consumer in codebase)"
  - "LoginFormCredentials → this sidecar (nested class)"
  - "PasswordEncoderFactories.createDelegatingPasswordEncoder → this sidecar + (cross-link to LDAPSecurityConfiguration if applicable)"

## Maintainer notes

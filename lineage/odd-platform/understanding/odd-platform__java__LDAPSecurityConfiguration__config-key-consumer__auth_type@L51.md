---
node_id: "odd-platform java LDAPSecurityConfiguration config-key-consumer:auth.type@L51"
node_kind: config-key-consumer
axis: config_prefixes
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-12-C-LDAP
---

# LDAPSecurityConfiguration.auth.type@L51 — semantic understanding

## understanding

This `@ConditionalOnProperty(value = "auth.type", havingValue = "LDAP")` activates the entire LDAP authentication stack when the operator picks LDAP as the deployment's UI/API auth mode. The class then wires four collaborating beans — a Spring LDAP `LdapContextSource` (the connection to the directory server), a `BindAuthenticator` configured with either a DN pattern or a user-search filter (the credential-check strategy), a `DefaultLdapAuthoritiesPopulator` mapping LDAP groups to ODD's USER/ADMIN role pair, and a top-level `SecurityWebFilterChain` (`configureLdap`, line 137) that protects every `/**` path through `AuthorizationCustomizer` — and optionally chains the S2S API-key filter when `auth.s2s.enabled=true` (line 149). Active Directory is supported as a sibling branch (line 77) that swaps `LdapAuthenticationProvider` for `ActiveDirectoryLdapAuthenticationProvider`.

## concepts

- entities: ["auth.type configuration key", "LDAP server (URL, base, bind credentials)", "LdapContextSource", "BindAuthenticator", "LdapAuthenticationProvider / ActiveDirectoryLdapAuthenticationProvider", "DefaultLdapAuthoritiesPopulator", "ODDLDAPProperties (@ConfigurationProperties POJO)", "SecurityWebFilterChain", "AuthorizationCustomizer", "S2sAuthenticationFilter", "GrantedAuthorityExtractor", "UserProviderRole (USER / ADMIN)"]
- operations: ["activate the LDAP security stack when `auth.type=LDAP`", "open the LDAP connection using URL + admin DN + admin password from ODDLDAPProperties", "authenticate end-user credentials via bind (DN pattern OR search filter)", "populate group authorities from the directory and map them to USER vs ADMIN via the `admin-groups` allowlist", "wire a single SecurityWebFilterChain at Ordered.HIGHEST_PRECEDENCE that protects all `/**` paths via `AuthorizationCustomizer`", "conditionally chain S2sAuthenticationFilter when `auth.s2s.enabled=true`"]
- invariants: ["the bean graph is wired only when `auth.type=LDAP` (line 51)", "either `dnPattern` or `userFilter.filter` MUST be non-empty — enforced at `ODDLDAPProperties.validate()` lines 45-48 with `IllegalStateException`", "`auth.ldap.url` MUST be non-empty — enforced at `ODDLDAPProperties.validate()` lines 42-44", "when `properties.getGroups()` is null OR `adminGroups` is empty, every authenticated LDAP user is assigned only the `USER` role (lines 91-93) — NO admin can ever be promoted", "the SecurityWebFilterChain runs at `Ordered.HIGHEST_PRECEDENCE` (line 136), guaranteeing it wins over any other chain Spring would register", "Active Directory mode bypasses BindAuthenticator entirely (line 77-80) and constructs `ActiveDirectoryLdapAuthenticationProvider(domain, url)` directly", "S2sAuthenticationFilter is registered AT `SecurityWebFiltersOrder.HTTP_BASIC` (line 150), running BEFORE the LDAP form-login challenge"]
- audiences: ["enterprise / on-prem operators deploying ODD against an existing corporate directory (OpenLDAP / Active Directory)", "ingestion-side server-to-server callers if `auth.s2s.enabled=true` is also configured", "Spring Boot's autoconfiguration (consumes `@ConditionalOnProperty` to decide whether this chain is the active one)"]

## dependencies_semantic

- requires-feature: ["the auth-mode switch wired across all four `*SecurityConfiguration` classes — DisabledAuthSecurityConfiguration / LoginFormSecurityConfiguration / OAuthSecurityConfiguration / LDAPSecurityConfiguration — using mutually-exclusive `@ConditionalOnProperty(value=\"auth.type\", havingValue=...)`", "the ODD authorization framework: `AuthorizationCustomizer` (line 145) + `SecurityConstants.WHITELIST_PATHS` and `SECURITY_RULES` + `PermissionService` + `ResourceExtractor` chain", "the optional S2S ingestion layer: `S2sAuthenticationFilter` + `S2sTokenProvider` (only wired when `auth.s2s.enabled=true` at line 149)", "the ODD role model: `UserProviderRole.USER` / `UserProviderRole.ADMIN` (imported line 47, returned at line 92 and via `GrantedAuthorityExtractor.getAuthorities(isAdmin)` line 97)"]
- requires-config: ["auth.type — MUST equal `LDAP` for this class to load (line 51)", "auth.ldap.url — MUST be non-empty (ODDLDAPProperties.validate, line 42-44, throws IllegalStateException)", "auth.ldap.dn-pattern OR auth.ldap.user-filter.filter — at least ONE MUST be non-empty (ODDLDAPProperties.validate, line 45-48)", "auth.ldap.username + auth.ldap.password — OPTIONAL; if absent, anonymous bind is used for directory operations (per live docs WebFetched 2026-05-12)", "auth.ldap.base — OPTIONAL; the directory's base DN", "auth.ldap.groups.search-base / .filter / .admin-groups — OPTIONAL; without `admin-groups`, NO user is ever promoted to ADMIN", "auth.ldap.active-directory.enabled / .domain — OPTIONAL; if enabled, branches to `ActiveDirectoryLdapAuthenticationProvider`", "auth.s2s.enabled — OPTIONAL (`@Value` default `false` at line 140); when `true`, S2sAuthenticationFilter is chained at HTTP_BASIC order"]
- requires-runtime: ["a reachable LDAP / Active Directory server at `properties.getUrl()` — boot does NOT verify reachability; failures surface only on the first login attempt", "Spring LDAP autoconfiguration on the classpath (`spring-security-ldap`, `spring-ldap-core`)", "`ResourceExtractor` beans and `PermissionService` from the ODD authorization framework", "`S2sAuthenticationFilter` and `S2sTokenProvider` beans (always wired, but only used when `auth.s2s.enabled=true`)"]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - "behaviour: `@ConditionalOnProperty(auth.type=LDAP)` correctly skips this bean wiring when `auth.type` is DISABLED / LOGIN_FORM / OAUTH2"
  - "behaviour: ODDLDAPProperties.validate() fails fast on empty URL or empty {dn-pattern, user-filter} pair"
  - "behaviour: BindAuthenticator falls back from DN pattern to user-filter search when only the filter is configured (lines 66-74)"
  - "behaviour: ActiveDirectory branch (line 77) overrides the standard provider chain"
  - "behaviour: AdminGroups null / empty produces a USER-only role (lines 91-93) — every authenticated user is non-admin"
  - "behaviour: AdminGroups containing a group the user IS in produces ADMIN role (lines 94-98)"
  - "behaviour: AdminGroups containing a group the user is NOT in produces USER role (line 97 with isAdmin=false)"
  - "behaviour: `containsIgnoreCase` (line 96) is the matching predicate — admin group `Admins` matches LDAP group `admins` and vice versa"
  - "behaviour: SecurityWebFilterChain at HIGHEST_PRECEDENCE wins over any conflicting chain registration"
  - "behaviour: S2sAuthenticationFilter is added at HTTP_BASIC order only when `auth.s2s.enabled=true`"
  - "behaviour (security): an LDAPS URL (`ldaps://...`) actually negotiates TLS (no test verifies the URL scheme is honoured)"
  - "behaviour (security): `LdapTemplate` ignores partial-results=false and name-not-found=false but ignores size-limit-exceeded=true (lines 129-131) — verify error semantics"
  - "behaviour (security): `auth.ldap.password` is not echoed to logs at INFO/DEBUG"
  - "behaviour: when the LDAP server is unreachable, authentication fails closed (no cached-credential fallback)"
- test_files: []
- gaps: |
    Zero test coverage of the LDAP auth stack. Greps under `odd-platform-api/src/test` for `LDAPSecurityConfiguration`, `ODDLDAPProperties`, `LdapTemplate`, and `Ldap` (case-sensitive) return zero hits. Hits for "ldap" (case-insensitive) all land on unrelated service tests that mention `lookup` or similar substrings. No WebFluxTest, no slice test, no Testcontainers-backed LDAP harness, no unit test of `authoritiesMapper` (lines 89-99) — the single most security-critical block in this file (the admin-vs-user decision) is untested. A regression that (1) inverted the `isEmpty(adminGroups)` check so all users became admin, (2) swapped USER and ADMIN role names, (3) broke `containsIgnoreCase` to a case-sensitive match (silent admin-demotion for any group whose configured case differed from the directory's case), or (4) added an off-by-one to `ActiveDirectory` branch detection (NPE on `properties.getActiveDirectory().isEnabled()` when the block is absent — line 77 reads `properties.getActiveDirectory() != null` which DOES guard this) would not be caught by the current suite.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/ldap"
    anchor: ""
    rationale: "The canonical user-facing setup page for LDAP authentication in ODD; covers every property this bean reads from ODDLDAPProperties."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication"
    anchor: ""
    rationale: "Parent page enumerating the four auth.type modes; the LDAP entry is one of four sub-pages."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security"
    anchor: ""
    rationale: "Security overview page; documents the auth.type switch and the independent S2S surface that this class also wires (line 149)."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
- fetched_excerpts: |
    From `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/ldap` (WebFetched 2026-05-12, status 200):
    - "URL: `auth.ldap.url` specifies the LDAP server endpoint (e.g., `ldap://localhost:389`)"
    - "Credentials: Optional `auth.ldap.username` and `auth.ldap.password` for authenticated connections. The guidance notes: 'If they are not set, operations will be performed by using an anonymous (unauthenticated) context'"
    - "Two approaches are supported: DN Pattern ... Search Filter ... It is required to set up one of those search methods, otherwise application start will fail"
    - "Three properties configure group-based admin privileges: `auth.ldap.groups.search-base` ... `auth.ldap.groups.filter` (default `(member={0})`) ... `auth.ldap.groups.admin-groups`"
    - "Active Directory requires: `auth.ldap.active-directory.enabled: true` ... `auth.ldap.active-directory.domain`"
    - WebFetched gap note: "No guidance on server-down behavior or failover; No explicit link to Spring Security LDAP documentation; Limited attribute mapping configuration details"
    - The page does NOT explicitly differentiate LDAP vs LDAPS protocols or provide secure-connection guidance.

    From `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication` (WebFetched 2026-05-12, status 200):
    - "ODD Platform supports four authentication mechanisms: Disable authentication, Login form, OAUTH2/OIDC, LDAP, with Server-to-server (S2S) ... complements any of the above."

    From `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/s2s` (WebFetched 2026-05-12, status 200):
    - "S2S runs alongside the configured interactive auth mechanism, not instead of it ... S2S is available when `auth.type` is set to `LOGIN_FORM`, `OAUTH2`, or `LDAP`."
    - "Requests carrying a valid token run with the built-in `ADMIN` user and ADMIN role, so they can call any endpoint that admins can call"
    - "Clients present the token in the `X-API-Key` HTTP header on every request."
    - "Treat this as a high-privilege secret and store it in a secrets manager, not in plaintext config."
- doc_drift_findings:
  - "Live LDAP docs do not mention that `auth.ldap.password` is consumed via a `@Data`-generated getter on `ODDLDAPProperties` (`ODDLDAPProperties.java:14`) bound by `@ConfigurationProperties(\"auth.ldap\")` (line 9) and that the resolved value is exposed by Spring Boot's `/actuator/env` endpoint, which is enabled by default in the bundled `application.yml` (`application.yml:230-231` includes `env` in `management.endpoints.web.exposure.include`). Operators reading the LDAP setup page get no warning that an exposed actuator port + a directly-injected `password` field is a credential-disclosure surface."
  - "Live LDAP docs do not distinguish `ldap://` (plaintext bind, credentials and group lookups travel in the clear) from `ldaps://` (TLS). The bean factory at LDAPSecurityConfiguration.java:117-124 passes `properties.getUrl()` verbatim into `LdapContextSource.setUrl(...)` with no scheme enforcement, no minimum-TLS-version configuration, no cipher pinning, and no warning when the resolved URL begins with `ldap://`. The application.yml comment block (lines 50-56) shows `url:` as a placeholder with no scheme guidance."
  - "Live LDAP docs do not document that when `auth.ldap.groups` is null OR `auth.ldap.groups.admin-groups` is empty, EVERY authenticated LDAP user is assigned only the `USER` role (LDAPSecurityConfiguration.java:91-93). An operator who configures LDAP without `groups.admin-groups` produces a deployment where NO LDAP user can ever be granted admin — the only path to admin in that deployment is via S2S API key. This is consistent with LSN-010 (Azure admin-groups doc claimed default key was `groups` but consumer read `roles`) — admin-role assignment defaults are a recurring documentation drift surface across auth modes."
  - "Live LDAP docs do not document that the LDAP login path adds the S2S filter when `auth.s2s.enabled=true` (LDAPSecurityConfiguration.java:140,149-151). The S2S doc page documents the interaction at the S2S end, but the LDAP page is silent on the fact that picking `auth.type=LDAP` does NOT exclude server-to-server admin-equivalence callers."
  - "Live LDAP docs do not document the `LdapTemplate` flag combination at LDAPSecurityConfiguration.java:128-132: partial-results and name-not-found are NOT ignored (fail-fast on directory anomalies), but size-limit-exceeded IS ignored (silent truncation on large group searches). An operator with a group containing more members than the directory's size limit will see partial group memberships with no log line — a silent admin-demotion failure mode."
  - "Live LDAP docs do not document the `management.health.ldap.enabled: false` default in the bundled application.yml (line 242-243) — when LDAP IS the auth mode, the LDAP health check is OFF by default, so a directory outage does NOT show up on `/actuator/health`. Operators expecting `/actuator/health` to reflect their auth substrate are silently misinformed."
  - "Live LDAP docs do not document the `AuthIdentityProviderImpl.getCurrentUser()` behaviour for LDAP users: the returned `UserDto` has `provider=null` (AuthIdentityProviderImpl.java:32) because the `OAuth2AuthenticationToken` branch (line 29) does not match. Any code that filters by `provider` therefore sees LDAP users distinctly from OAuth2 users — and the user-owner mapping at `userOwnerMappingRepository.getAssociatedOwner(user.username(), user.provider())` (line 52) joins on `(username, null)` for every LDAP login."

## implicit_adrs

- "LDAP auth is wired through the same `AuthorizationCustomizer` + `SecurityConstants.WHITELIST_PATHS` + `SECURITY_RULES` chain that OAuth2 and LoginForm use — the authorization layer is mode-agnostic, only the authentication mechanism varies." — evidence: LDAPSecurityConfiguration.java:144-145 (`.authorizeExchange(new AuthorizationCustomizer(permissionService, extractors))`) compared against OAuthSecurityConfiguration.java and LoginFormSecurityConfiguration.java (same `AuthorizationCustomizer` wire-in across all three) — intent_anchor: parallel structure across three SecurityWebFilterChain factories all calling the same `new AuthorizationCustomizer(...)` plus the explicit dependency on shared `SecurityConstants` constants — confidence: HIGH

- "LDAP authentication is treated as an enterprise / on-prem alternative to OAuth2 — both are protected by the same `@Order(Ordered.HIGHEST_PRECEDENCE)` chain (line 136) and both route through `AuthorizationCustomizer`. The choice between LDAP and OAUTH2 is the operator's identity-source choice; the rest of the platform behaves identically." — evidence: LDAPSecurityConfiguration.java:135-154 (`@Order(Ordered.HIGHEST_PRECEDENCE)` SecurityWebFilterChain bean) — intent_anchor: live docs WebFetched 2026-05-12 enumerate the four modes as parallel choices ("ODD Platform supports four authentication mechanisms ...") — confidence: HIGH

- "Active Directory is supported as a dedicated provider branch rather than a generic LDAP+AD-flavoured config — operators who pick AD get a Spring `ActiveDirectoryLdapAuthenticationProvider` constructed against `(domain, url)`, which uses Microsoft-specific bind semantics (UPN `user@domain`) rather than DN-pattern or filter search." — evidence: LDAPSecurityConfiguration.java:76-83 (the `if (properties.getActiveDirectory() != null && properties.getActiveDirectory().isEnabled())` branch constructs `ActiveDirectoryLdapAuthenticationProvider(domain, url)` and bypasses `BindAuthenticator`) — intent_anchor: the dedicated `ActiveDirectory` nested class on `ODDLDAPProperties.java:35-38` and the explicit `setUseAuthenticationRequestCredentials(true)` (line 80) — confidence: HIGH

- "Admin-group membership is decided by a case-insensitive substring containment match against the configured `admin-groups` allowlist (`containsIgnoreCase`, line 96 + imported from `OperationUtils` line 48), not by exact DN equality. This is a deliberate ergonomic trade-off so operators can write `auth.ldap.groups.admin-groups: ['Admins']` and have it match an LDAP `cn=Admins,ou=Groups,dc=example,dc=com` group entry without having to specify the full DN." — evidence: LDAPSecurityConfiguration.java:94-98 + import line 48 (`containsIgnoreCase`) — intent_anchor: the deliberate use of `containsIgnoreCase` (a case-insensitive substring matcher) rather than `Set::contains` or `List::contains` over equality — confidence: HIGH

- "S2S is composable with EVERY interactive auth mode (LOGIN_FORM, OAUTH2, LDAP) via the same in-chain `addFilterAt(s2sAuthenticationFilter, SecurityWebFiltersOrder.HTTP_BASIC)` insertion point." — evidence: LDAPSecurityConfiguration.java:140 (`@Value(\"${auth.s2s.enabled:false}\")`) + line 149-151 (`if (s2sEnabled) sec.addFilterAt(s2sAuthenticationFilter, SecurityWebFiltersOrder.HTTP_BASIC)`); same insertion pattern in OAuthSecurityConfiguration.java and LoginFormSecurityConfiguration.java — intent_anchor: identical `s2sEnabled` guard + identical `addFilterAt(..., HTTP_BASIC)` call appears verbatim across three sibling SecurityWebFilterChain factories, plus the live S2S doc page WebFetched 2026-05-12 stating "S2S runs alongside the configured interactive auth mechanism" — confidence: HIGH

- "`LdapTemplate` is configured to fail loudly on directory inconsistencies (`setIgnorePartialResultException(false)`, `setIgnoreNameNotFoundException(false)` — lines 129-130) but to silently tolerate size-limit overruns (`setIgnoreSizeLimitExceededException(true)` — line 131). This is a deliberate availability trade-off: directories with millions of users would otherwise crash group-membership queries on every login." — evidence: LDAPSecurityConfiguration.java:127-133 — intent_anchor: the three explicit `set*` calls in sequence (the operator is asserting `false / false / true` deliberately) — confidence: MEDIUM (the intent is clear from the code shape; no source-level comment explains it explicitly)

## bugs_limitations_corner_cases

- "When `auth.ldap.groups` is null OR `auth.ldap.groups.admin-groups` is empty (the application.yml default — lines 59-62 show the entire `groups` block commented out), every authenticated LDAP user is assigned only the `USER` role (LDAPSecurityConfiguration.java:91-93). The ONLY path to ADMIN in such a deployment is via S2S API key (S2sAuthenticationFilter.java:31-39 hard-codes `ADMIN` user + `ADMIN` role for any valid token). An operator who configures LDAP without `admin-groups` and without S2S has a deployment with NO admins — every ADMIN-gated endpoint in `SecurityConstants.SECURITY_RULES` is unreachable." — evidence: LDAPSecurityConfiguration.java:91-93 + ODDLDAPProperties.java:28-32 (Group class, nullable) + application.yml:50-65 (commented-out ldap block) + S2sAuthenticationFilter.java:31-39 — severity: HIGH

- "`ODDLDAPProperties.password` is bound from `auth.ldap.password` via `@ConfigurationProperties` + Lombok `@Data` getter (ODDLDAPProperties.java:9,11,14) and the bundled `application.yml` exposes `/actuator/env` by default (lines 226-231 — `exposure.include: health, prometheus, env, info` + `endpoint.env.enabled: true`). The `env` endpoint reveals all resolved property values — including `auth.ldap.password` — to any caller able to reach the actuator port (default: the same port as the app). On a deployment with `auth.type=LDAP`, this means the LDAP bind password is discoverable by every authenticated user (under LDAP, the actuator path is whitelisted via `SecurityConstants.WHITELIST_PATHS = {\"/actuator/**\", ...}`, line 95-96), and by every network caller if the actuator port is reachable without auth (which is the case here because `WHITELIST_PATHS` is `permitAll`-ed BEFORE the authenticated fall-through in `AuthorizationCustomizer.java:22-30`)." — evidence: ODDLDAPProperties.java:14 (`private String password`) + application.yml:226-240 + SecurityConstants.java:95-96 (`WHITELIST_PATHS = {\"/actuator/**\", ...}`) + AuthorizationCustomizer.java:22-24 (`pathMatchers(WHITELIST_PATHS).permitAll()`) — severity: HIGH

- "`LdapContextSource.setUrl(properties.getUrl())` (LDAPSecurityConfiguration.java:119) accepts the URL verbatim with NO scheme enforcement. An operator who configures `auth.ldap.url: ldap://corp-ad.example.com:389` (the example given on the live docs page, WebFetched 2026-05-12) gets a plaintext-bind connection where the LDAP bind password (`properties.getPassword()`, line 121) and every end-user login credential travel in cleartext across the wire. No boot-time warning is emitted, no configuration validation rejects plaintext URLs, and the live LDAP docs page does not surface the LDAPS-vs-LDAP distinction." — evidence: LDAPSecurityConfiguration.java:117-124 + ODDLDAPProperties.java:42-49 (validate() checks empty-url but NOT scheme) + WebFetch live LDAP docs 2026-05-12 (no LDAPS guidance) — severity: HIGH

- "`auth.ldap.url` is not validated for reachability at boot — `ODDLDAPProperties.validate()` (lines 42-44) only checks that the URL string is non-empty. The first failure surfaces when an end user tries to log in (a `BindAuthenticator` failure surfaces as a generic 401), not at startup. An operator who mistypes the URL, or whose LDAP server is down at platform-start time, gets a successful boot with `auth.type=LDAP` and a deployment that 401s every login attempt. There is no `management.health.ldap.enabled` to surface the outage either — that flag defaults to `false` in the bundled application.yml (line 242-243)." — evidence: ODDLDAPProperties.java:42-49 + LDAPSecurityConfiguration.java:117-124 (no try/catch around the connection open) + application.yml:241-243 — severity: MEDIUM

- "`auth.ldap.username` / `auth.ldap.password` are OPTIONAL per the live docs (WebFetched 2026-05-12: 'If they are not set, operations will be performed by using an anonymous (unauthenticated) context'). The code path at LDAPSecurityConfiguration.java:120-121 calls `ctx.setUserDn(properties.getUsername())` and `ctx.setPassword(properties.getPassword())` with whatever the properties supply — including `null`. Spring LDAP's `LdapContextSource` treats null userDn as anonymous bind. This is a deliberate Spring LDAP behaviour, but the platform does NOT log which bind mode is active at boot, so an operator who forgot to set the credentials cannot tell from the platform's logs whether the deployment is binding as anonymous or as the configured admin." — evidence: LDAPSecurityConfiguration.java:117-124 + ODDLDAPProperties.java:12-14 (username/password are plain `String`, no `@NotNull`) + WebFetch live LDAP docs 2026-05-12 — severity: LOW

- "`containsIgnoreCase` (LDAPSecurityConfiguration.java:96, imported from `OperationUtils` line 48) is a SUBSTRING match, not an EQUALITY match. An admin-groups config of `['Admin']` will match LDAP group `cn=Administrators` AND `cn=NonAdminContractors` (because both contain 'Admin' as a substring). An operator who configures `admin-groups: ['ops']` may inadvertently promote anyone in a group named `devops` or `apps`. The docs do not warn about this — they only say `admin-groups: A list granting admin permissions` (WebFetched 2026-05-12)." — evidence: LDAPSecurityConfiguration.java:94-98 + import statement at line 48 (`containsIgnoreCase`) — severity: HIGH

- "The S2S filter is inserted at `SecurityWebFiltersOrder.HTTP_BASIC` (LDAPSecurityConfiguration.java:150) when `auth.s2s.enabled=true`. The S2sAuthenticationFilter (S2sAuthenticationFilter.java:25-40) checks the `X-API-Key` header on every request; on a match, it injects a hard-coded `ADMIN` user + `ADMIN` role into the security context. There is no path-based restriction — an S2S token grants ADMIN to the ENTIRE `/api/**` and `/ingestion/**` surface, not just ingestion. The live S2S docs (WebFetched 2026-05-12) state this explicitly ('they can call any endpoint that admins can call'), but the LDAP setup page does not cross-link to the S2S page or warn that picking `auth.type=LDAP` is composable with an admin-equivalent server-to-server token." — evidence: LDAPSecurityConfiguration.java:149-151 + S2sAuthenticationFilter.java:31-39 + WebFetch S2S docs 2026-05-12 — severity: MEDIUM

- "`LdapTemplate.setIgnoreSizeLimitExceededException(true)` (LDAPSecurityConfiguration.java:131) silently truncates group searches that exceed the directory's size limit. An admin user whose admin-group membership lives beyond the cutoff is silently demoted to USER on login — no log line, no alert, no `/actuator/health` signal. This combines badly with `containsIgnoreCase`: if the admin-groups allowlist matches multiple groups by substring and the cumulative member set exceeds the size limit, the resulting authority set is non-deterministic." — evidence: LDAPSecurityConfiguration.java:131 + LDAPSecurityConfiguration.java:94-98 — severity: MEDIUM

- "`AuthIdentityProviderImpl.getCurrentUser()` (AuthIdentityProviderImpl.java:24-35) returns `UserDto(username, null)` for LDAP-authenticated users — the OAuth2 branch on line 29 does not match. The user-owner mapping then queries `userOwnerMappingRepository.getAssociatedOwner(user.username(), null)` (line 52). Any owner-mapping row created under OAuth2 (`provider='okta'` etc.) will NOT match an LDAP login of the same username; conversely, LDAP-issued owner mappings (`provider=null`) won't match an OAuth2 login. The docs do not warn that switching `auth.type` from OAUTH2 to LDAP (or vice versa) requires re-running owner mapping, and there is no migration tool." — evidence: AuthIdentityProviderImpl.java:24-35,49-53 + LDAPSecurityConfiguration.java (no provider tagging of the SecurityContext) — severity: MEDIUM

- "Active Directory mode (LDAPSecurityConfiguration.java:76-83) constructs `ActiveDirectoryLdapAuthenticationProvider(domain, url)` and does NOT use `BindAuthenticator`, so the `userFilter` and `dnPattern` configuration are SILENTLY IGNORED. An operator who configures both `active-directory.enabled=true` AND `user-filter.filter=(uid={0})` reads the LDAP docs (WebFetched 2026-05-12: 'It is required to set up one of those search methods, otherwise application start will fail') and concludes the filter governs lookups — but in AD mode it does not. The `ODDLDAPProperties.validate()` method (lines 45-48) STILL enforces the dnPattern-OR-filter requirement even in AD mode, so the operator is forced to configure a search method that's then ignored — confusing." — evidence: LDAPSecurityConfiguration.java:76-83 + ODDLDAPProperties.java:45-48 (validate() unconditional) — severity: MEDIUM

## security

- **auth_mode_relevance**: `LDAP | S2S` (this configuration is loaded only when `auth.type=LDAP` per `@ConditionalOnProperty` at line 51; the S2S filter is also wired inside this chain when `auth.s2s.enabled=true` at line 149, so S2S applies when this configuration is active).
- **ingestion_filter_relevance**: `N/A — code is a configuration / bean factory, not an HTTP endpoint`. NOTE: this bean's `SecurityWebFilterChain` (line 137-154) governs `/**` paths including `/ingestion/**` (which is permitAll-ed via `SecurityConstants.WHITELIST_PATHS` at SecurityConstants.java:95-96), but ingestion access control is delegated to the separate `IngestionDataEntitiesFilter` (a different node).
- **authorization_assertions**:
  - "All `/**` paths route through `AuthorizationCustomizer(permissionService, extractors)` (line 145), which permitAll-s `SecurityConstants.WHITELIST_PATHS` ({`/actuator/**`, `/favicon.ico`, `/ingestion/**`, `/img/**`, `/api/slack/events`}), applies `SecurityConstants.SECURITY_RULES` permission gates per matcher, and falls through to `.pathMatchers(\"/**\").authenticated()` for everything else." — evidence: LDAPSecurityConfiguration.java:145 + AuthorizationCustomizer.java:22-30 + SecurityConstants.java:95-96
  - "Admin assignment occurs at authentication time via `authoritiesMapper` (lines 89-99): if `containsIgnoreCase(adminGroups, authority)` matches at least one of the user's LDAP-granted authorities, `GrantedAuthorityExtractor.getAuthorities(true)` is called and the user gets `UserProviderRole.ADMIN`; otherwise `UserProviderRole.USER`." — evidence: LDAPSecurityConfiguration.java:89-99 + GrantedAuthorityExtractor.java:12-17
  - "S2S filter (when enabled) hard-codes a built-in ADMIN principal at `S2sAuthenticationFilter.java:31-39` — it bypasses the LDAP-derived authority chain entirely on `X-API-Key` match." — evidence: LDAPSecurityConfiguration.java:149-150 + S2sAuthenticationFilter.java:31-39
- **owner_scoping**: `N/A — code is not data-scoped`. This is a security configuration / bean factory; data scoping happens downstream at the controller and `ResourceExtractor` layers.
- **data_exposure**:
  - "LDAP bind credentials (`auth.ldap.username`, `auth.ldap.password`) → any caller able to reach `/actuator/env` (which is whitelisted by `SecurityConstants.WHITELIST_PATHS` and `endpoint.env.enabled: true` by default in `application.yml`)" — evidence: ODDLDAPProperties.java:13-14 + application.yml:226-240 + SecurityConstants.java:95-96 + AuthorizationCustomizer.java:22-24
  - "End-user LDAP login credentials → cleartext on the wire when `auth.ldap.url` begins with `ldap://` (no scheme enforcement at LDAPSecurityConfiguration.java:119)" — evidence: LDAPSecurityConfiguration.java:117-124 + ODDLDAPProperties.java:42-49
  - "Active auth mode (`LDAP`) → fingerprinted via `/api/appInfo` response (cross-node finding from AppInfoController sidecar — see `lineage/odd-platform/understanding/odd-platform__java__AppInfoController__config-key-consumer__auth_type@L18.md`)" — evidence: cross-axis reference; not from this file
  - "Successful LDAP login produces an LDAP-flavoured authority set (USER or ADMIN); the SecurityContext does NOT carry the LDAP source identity beyond `Authentication.getName()`, so downstream owner mapping (`AuthIdentityProviderImpl.java:32,52`) cannot distinguish an LDAP `jdoe` from an OAUTH2 `jdoe` after the auth-mode switch" — evidence: AuthIdentityProviderImpl.java:24-35,49-53 + LDAPSecurityConfiguration.java (no provider tag set on the SecurityContext)
- **known_security_gaps**:
  - "Bundled `application.yml` exposes `/actuator/env` by default (lines 226-231); `auth.ldap.password` is bound via `@ConfigurationProperties + @Data` (ODDLDAPProperties.java:9,14) and therefore appears in the `env` response. `SecurityConstants.WHITELIST_PATHS` permitAll-s `/actuator/**` (line 95-96), so this is reachable BY ANY CALLER who can hit the platform's HTTP port — there is no separate actuator port. Live LDAP docs (WebFetched 2026-05-12) name `auth.ldap.password` without any warning that it is exposed via actuator." — evidence: ODDLDAPProperties.java:9,14 + application.yml:226-240 + SecurityConstants.java:95-96 + AuthorizationCustomizer.java:22-24 — severity: HIGH
  - "No scheme enforcement on `auth.ldap.url`. An `ldap://` URL means bind credentials AND end-user credentials travel in the clear. No log warning, no validation rejection, no doc warning. This is a Critical-tier defect (operator-visible-only-via-pcap) and aligns with LSN-002 (MinIO region unset) and LSN-001 (attachment ephemeral default) — silent insecure defaults that the docs do not surface as caveats." — evidence: LDAPSecurityConfiguration.java:117-124 + ODDLDAPProperties.java:42-49 + WebFetch LDAP docs 2026-05-12 — severity: HIGH
  - "`containsIgnoreCase` substring match on admin-groups (line 96) admits substring-collision admin escalation. An operator who configures `admin-groups: ['ops']` may inadvertently grant ADMIN to every LDAP group whose name contains 'ops' (substring `devops`, `noops`, `oopsgroup`)." — evidence: LDAPSecurityConfiguration.java:94-98 + import line 48 — severity: HIGH
  - "Empty/null `admin-groups` produces a deployment with no LDAP path to ADMIN (lines 91-93). Combined with S2S-disabled (`auth.s2s.enabled=false` default), no caller can ever reach ADMIN-gated endpoints. The live docs do not name this as a known consequence of leaving `admin-groups` unset." — evidence: LDAPSecurityConfiguration.java:91-93 + application.yml:40-43 (s2s default false) + WebFetch LDAP docs 2026-05-12 — severity: MEDIUM (operability defect, not exploit; documenting it would prevent operator confusion)
  - "`LdapTemplate.setIgnoreSizeLimitExceededException(true)` (line 131) means group-membership queries that hit directory size limits silently truncate, producing non-deterministic authority sets across logins. A user in admin-groups whose membership row is past the truncation cutoff is silently demoted. No log, no alert." — evidence: LDAPSecurityConfiguration.java:131 — severity: MEDIUM
  - "Active Directory mode (lines 76-83) silently ignores `dn-pattern` and `user-filter` config even though `ODDLDAPProperties.validate()` (ODDLDAPProperties.java:45-48) still requires at least one of them. Operator-confusing." — evidence: LDAPSecurityConfiguration.java:76-83 + ODDLDAPProperties.java:45-48 — severity: LOW (misconfiguration risk, not a direct exploit)
  - "`management.health.ldap.enabled: false` is the bundled default in application.yml (line 242-243). When `auth.type=LDAP`, `/actuator/health` does NOT include LDAP-server reachability — a directory outage is invisible to standard health probes." — evidence: application.yml:241-243 — severity: LOW (operational visibility, not a direct exploit)
  - "Bind credentials, LDAP search filters, and active-directory.domain are all simple `String` fields in `ODDLDAPProperties` (lines 12-19, 36-37) with NO validation other than the empty-string check on `url` and the {dnPattern, filter} XOR at lines 42-48. Injection of LDAP filter metacharacters (`)`, `\\`, `*`) into `dn-pattern` or `user-filter.filter` is the operator's responsibility — no sanitisation. Combined with the live docs' DN-pattern example `uid={0},ou=people,dc=mycompany,dc=com` (WebFetched 2026-05-12, the `{0}` placeholder is unescaped substitution), an operator who uses a filter pattern with unfiltered user input is vulnerable to LDAP injection. Spring Security's BindAuthenticator escapes by default in modern versions, but the platform code does not warn about the responsibility." — evidence: ODDLDAPProperties.java:12-19,36-37 + LDAPSecurityConfiguration.java:66-74 + WebFetch LDAP docs 2026-05-12 — severity: LOW (relies on Spring LDAP's own escaping; surfaced for completeness)

## performance

- **hot_paths**:
  - "Every LDAP login performs at least one BindAuthenticator round-trip to the directory server; if `user-filter` is used (line 70-73), an additional LDAP search round-trip occurs to resolve the user DN before the bind. Group-membership lookup (`DefaultLdapAuthoritiesPopulator`, lines 106-113) is a third round-trip. So a single LDAP login is up to 3 directory RPCs in the auth path." — evidence: LDAPSecurityConfiguration.java:65-74 + 101-114
  - "Every authenticated request runs through `AuthorizationCustomizer.customize` (AuthorizationCustomizer.java:20-30), which iterates `SecurityConstants.SECURITY_RULES` (~100+ rules per SecurityConstants.java:98-355) to find a path match — O(N rules) per request, evaluated at chain construction by Spring Security (not per-request) but the matcher dispatch is per-request." — evidence: LDAPSecurityConfiguration.java:145 + AuthorizationCustomizer.java:22-30 + SecurityConstants.java:98-355
- **throughput_characteristics**:
  - "Single-login synchronous LDAP round-trips on the auth path — no connection pooling configured at the `LdapContextSource` level (lines 117-124 set only URL/userDn/password/base; no pooling, no timeouts)" — evidence: LDAPSecurityConfiguration.java:117-124
- **resource_allocation**:
  - "`LdapContextSource` opens new connections per bind unless Spring LDAP's default pooling kicks in — no explicit `setPooled(true)` call (lines 117-124). Under high login concurrency, the directory may see N concurrent TCP connections from N concurrent logins." — evidence: LDAPSecurityConfiguration.java:117-124
  - "No connection timeout configured. A slow / unreachable LDAP server blocks login attempts at the underlying JNDI default (typically TCP-connect timeout — minutes-scale, not the seconds-scale a UI login should expect)." — evidence: LDAPSecurityConfiguration.java:117-124 (no `setBaseEnvironmentProperties(com.sun.jndi.ldap.connect.timeout=...)`)
- **scaling_characteristics**:
  - "Stateless from the platform's perspective: each LDAP login is independent; horizontal scaling is unaffected as long as the directory tier scales with the platform tier." — evidence: LDAPSecurityConfiguration.java (no shared mutable state)
  - "SecurityWebFilterChain bean is built once at boot at `Ordered.HIGHEST_PRECEDENCE` (line 136); the chain itself is immutable for the JVM lifetime — config changes require a restart." — evidence: LDAPSecurityConfiguration.java:135-154
- **known_performance_gaps**:
  - "No `LdapContextSource.setPooled(true)` and no explicit JNDI connect/read timeouts (LDAPSecurityConfiguration.java:117-124). Slow directory → slow login chain; unreachable directory → minutes-scale TCP-connect timeout per login attempt. The live LDAP docs do not name any timeout tuning property." — evidence: LDAPSecurityConfiguration.java:117-124 + WebFetch LDAP docs 2026-05-12 — severity: MEDIUM
  - "`LdapTemplate.setIgnoreSizeLimitExceededException(true)` (line 131) is presumably set to AVOID a performance cliff on large directories — but the trade-off (silent truncation) lands in `known_security_gaps` rather than `known_performance_gaps`. Listed here for cross-reference: the perf-vs-correctness trade-off is undocumented." — evidence: LDAPSecurityConfiguration.java:131 — severity: LOW

## sources

- understanding ← LDAPSecurityConfiguration.java:50-154
- concepts.entities ← LDAPSecurityConfiguration.java:50-154 + ODDLDAPProperties.java:9-50
- concepts.operations ← LDAPSecurityConfiguration.java:61-154
- concepts.invariants[empty-adminGroups → USER only] ← LDAPSecurityConfiguration.java:91-93
- concepts.invariants[validate-throws] ← ODDLDAPProperties.java:42-48
- concepts.invariants[HIGHEST_PRECEDENCE] ← LDAPSecurityConfiguration.java:136
- concepts.invariants[AD bypasses BindAuthenticator] ← LDAPSecurityConfiguration.java:77-83
- concepts.invariants[S2S at HTTP_BASIC] ← LDAPSecurityConfiguration.java:149-151
- dependencies_semantic.requires-feature.[parallel-auth-config classes] ← LDAPSecurityConfiguration.java:51 + comparable @ConditionalOnProperty in OAuthSecurityConfiguration.java:71, LoginFormSecurityConfiguration.java:31, DisabledAuthSecurityConfiguration.java:10 (cross-referenced from AppInfoController sidecar's source map)
- dependencies_semantic.requires-feature.[AuthorizationCustomizer] ← LDAPSecurityConfiguration.java:145 + AuthorizationCustomizer.java:1-32 + SecurityConstants.java:93-120
- dependencies_semantic.requires-feature.[S2S layer] ← LDAPSecurityConfiguration.java:149-151 + S2sAuthenticationFilter.java:17-49 + S2sTokenProvider.java:8-29
- dependencies_semantic.requires-config.[every key] ← ODDLDAPProperties.java:9-50 + LDAPSecurityConfiguration.java:51,140 + application.yml:32-65
- dependencies_semantic.requires-runtime.[Spring LDAP autoconfig] ← LDAPSecurityConfiguration.java:22-43 (import statements)
- tests_coverage_semantic.test_files ← grep `odd-platform-api/src/test` for `LDAPSecurityConfiguration` / `ODDLDAPProperties` / `LdapTemplate` returns zero matches; case-insensitive `ldap` hits only unrelated `lookup*`/`Lineage*` tests (Grep 2026-05-12)
- docs_link_semantic.inferred_docs.[LDAP page] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/ldap (2026-05-12, 200)
- docs_link_semantic.inferred_docs.[authentication index] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication (2026-05-12, 200)
- docs_link_semantic.inferred_docs.[enable-security overview] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security (2026-05-12, 200)
- docs_link_semantic.doc_drift_findings.[actuator-env password leak] ← ODDLDAPProperties.java:9,14 + application.yml:226-240 + SecurityConstants.java:95-96 + WebFetch LDAP docs 2026-05-12
- docs_link_semantic.doc_drift_findings.[ldap vs ldaps] ← LDAPSecurityConfiguration.java:117-124 + application.yml:50-56 + WebFetch LDAP docs 2026-05-12 (no LDAPS guidance)
- docs_link_semantic.doc_drift_findings.[empty admin-groups → no admins] ← LDAPSecurityConfiguration.java:91-93 + LSN-010 (sibling auth-mode admin-default drift)
- docs_link_semantic.doc_drift_findings.[S2S composes with LDAP] ← LDAPSecurityConfiguration.java:140,149-151 + WebFetch S2S docs 2026-05-12 + WebFetch LDAP docs 2026-05-12 (LDAP page silent on this)
- docs_link_semantic.doc_drift_findings.[LdapTemplate flag combination] ← LDAPSecurityConfiguration.java:128-132
- docs_link_semantic.doc_drift_findings.[health.ldap.enabled default false] ← application.yml:241-243
- docs_link_semantic.doc_drift_findings.[provider=null for LDAP UserDto] ← AuthIdentityProviderImpl.java:24-35,49-53 + LDAPSecurityConfiguration.java (no provider tag)
- implicit_adrs.[AuthorizationCustomizer mode-agnostic] ← LDAPSecurityConfiguration.java:144-145 + AuthorizationCustomizer.java:14-31
- implicit_adrs.[LDAP = enterprise OAuth2 sibling] ← LDAPSecurityConfiguration.java:135-154 + WebFetch authentication index 2026-05-12
- implicit_adrs.[AD dedicated branch] ← LDAPSecurityConfiguration.java:76-83 + ODDLDAPProperties.java:35-38
- implicit_adrs.[containsIgnoreCase admin match] ← LDAPSecurityConfiguration.java:48,94-98
- implicit_adrs.[S2S composable across modes] ← LDAPSecurityConfiguration.java:140,149-151
- implicit_adrs.[LdapTemplate fail-loud + tolerate-size-limit] ← LDAPSecurityConfiguration.java:127-133
- bugs_limitations_corner_cases.[no admins when adminGroups empty] ← LDAPSecurityConfiguration.java:91-93 + ODDLDAPProperties.java:28-32 + application.yml:50-65 + S2sAuthenticationFilter.java:31-39
- bugs_limitations_corner_cases.[actuator-env password leak] ← ODDLDAPProperties.java:9,14 + application.yml:226-240 + SecurityConstants.java:95-96 + AuthorizationCustomizer.java:22-24
- bugs_limitations_corner_cases.[no LDAPS enforcement] ← LDAPSecurityConfiguration.java:117-124 + ODDLDAPProperties.java:42-49 + WebFetch LDAP docs 2026-05-12
- bugs_limitations_corner_cases.[no reachability check at boot] ← ODDLDAPProperties.java:42-49 + LDAPSecurityConfiguration.java:117-124 + application.yml:241-243
- bugs_limitations_corner_cases.[anonymous bind not logged] ← LDAPSecurityConfiguration.java:117-124 + ODDLDAPProperties.java:12-14 + WebFetch LDAP docs 2026-05-12
- bugs_limitations_corner_cases.[containsIgnoreCase substring collision] ← LDAPSecurityConfiguration.java:48,94-98
- bugs_limitations_corner_cases.[S2S admin everywhere] ← LDAPSecurityConfiguration.java:149-151 + S2sAuthenticationFilter.java:31-39 + WebFetch S2S docs 2026-05-12
- bugs_limitations_corner_cases.[size-limit silent truncation] ← LDAPSecurityConfiguration.java:131 + 94-98
- bugs_limitations_corner_cases.[provider=null + owner mapping] ← AuthIdentityProviderImpl.java:24-35,49-53 + LDAPSecurityConfiguration.java
- bugs_limitations_corner_cases.[AD ignores filter/dn-pattern config] ← LDAPSecurityConfiguration.java:76-83 + ODDLDAPProperties.java:45-48
- security.auth_mode_relevance ← LDAPSecurityConfiguration.java:51,149
- security.ingestion_filter_relevance ← LDAPSecurityConfiguration.java:144 + SecurityConstants.java:95-96 (whitelist)
- security.authorization_assertions.[1] ← LDAPSecurityConfiguration.java:145 + AuthorizationCustomizer.java:22-30 + SecurityConstants.java:95-96
- security.authorization_assertions.[2] ← LDAPSecurityConfiguration.java:89-99 + GrantedAuthorityExtractor.java:12-17
- security.authorization_assertions.[3] ← LDAPSecurityConfiguration.java:149-150 + S2sAuthenticationFilter.java:31-39
- security.owner_scoping ← LDAPSecurityConfiguration.java (no data calls)
- security.data_exposure.[1] ← ODDLDAPProperties.java:13-14 + application.yml:226-240 + SecurityConstants.java:95-96
- security.data_exposure.[2] ← LDAPSecurityConfiguration.java:117-124 + ODDLDAPProperties.java:42-49
- security.data_exposure.[3] ← cross-axis from AppInfoController sidecar
- security.data_exposure.[4] ← AuthIdentityProviderImpl.java:24-35,49-53
- security.known_security_gaps.[actuator env password] ← ODDLDAPProperties.java:9,14 + application.yml:226-240 + SecurityConstants.java:95-96 + AuthorizationCustomizer.java:22-24
- security.known_security_gaps.[no LDAPS enforcement] ← LDAPSecurityConfiguration.java:117-124 + ODDLDAPProperties.java:42-49 + WebFetch LDAP docs 2026-05-12
- security.known_security_gaps.[substring admin match] ← LDAPSecurityConfiguration.java:48,94-98
- security.known_security_gaps.[no admins when empty] ← LDAPSecurityConfiguration.java:91-93 + application.yml:40-43 + WebFetch LDAP docs 2026-05-12
- security.known_security_gaps.[size-limit silent truncation] ← LDAPSecurityConfiguration.java:131
- security.known_security_gaps.[AD ignores filter] ← LDAPSecurityConfiguration.java:76-83 + ODDLDAPProperties.java:45-48
- security.known_security_gaps.[health.ldap.enabled false] ← application.yml:241-243
- security.known_security_gaps.[no LDAP injection sanitisation warning] ← ODDLDAPProperties.java:12-19,36-37 + LDAPSecurityConfiguration.java:66-74 + WebFetch LDAP docs 2026-05-12
- performance.hot_paths.[3 RPCs per login] ← LDAPSecurityConfiguration.java:65-74,101-114
- performance.hot_paths.[O(N rules) per request] ← LDAPSecurityConfiguration.java:145 + AuthorizationCustomizer.java:22-30 + SecurityConstants.java:98-355
- performance.throughput_characteristics ← LDAPSecurityConfiguration.java:117-124
- performance.resource_allocation.[no pooling] ← LDAPSecurityConfiguration.java:117-124
- performance.resource_allocation.[no timeouts] ← LDAPSecurityConfiguration.java:117-124
- performance.scaling_characteristics.[stateless] ← LDAPSecurityConfiguration.java (no shared mutable state)
- performance.scaling_characteristics.[chain immutable] ← LDAPSecurityConfiguration.java:135-154
- performance.known_performance_gaps.[no pooling / no timeouts] ← LDAPSecurityConfiguration.java:117-124 + WebFetch LDAP docs 2026-05-12

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (zero-coverage statement is grep-verified)
- docs_link_semantic: MEDIUM (inferred docs only — no `@docs` annotation in source; the three inferred URLs WebFetched live and confirmed 200; doc-drift findings are HIGH-confidence because the live page's content was directly compared against the consumer code in this file)
- implicit_adrs: HIGH (each backed by explicit code structure + parallel-sibling pattern across the four `*SecurityConfiguration` classes; the LdapTemplate-flag ADR is MEDIUM because the intent is structural rather than commented)
- bugs_limitations_corner_cases: HIGH (each finding cited to file:line; the AD-ignores-filter finding is MEDIUM because runtime Spring behaviour is the proximate cause)
- security: HIGH
- performance: MEDIUM (timeout / pooling absences are HIGH-confidence; the "minutes-scale TCP-connect timeout" claim is the JNDI default behaviour and depends on the underlying JNDI provider — runtime-determined)

## Maintainer notes


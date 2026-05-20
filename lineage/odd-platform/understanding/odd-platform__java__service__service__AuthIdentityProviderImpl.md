---
node_id: "odd-platform java service service:AuthIdentityProviderImpl"
node_kind: service
axis: services
extracted_at_commit: 9ac6436e
enriched_at_commit: 9ac6436e
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-19-K-AuthIdentityProviderImpl
schema_version: v0.3.0
pillar: P-09
---

# AuthIdentityProviderImpl — semantic understanding

## understanding

`AuthIdentityProviderImpl` is the **canonical per-request identity resolver** for ODD Platform's RBAC + owner-scoping model. It exposes three Monos — `getCurrentUser()`, `getCurrentUserProviderRole()`, and `fetchAssociatedOwner()` — each of which reaches up into `ReactiveSecurityContextHolder.getContext()` to extract the active Spring `Authentication`, then either (a) constructs a `UserDto(username, provider)` where `provider` is the OAuth2 client registration id ONLY for `OAuth2AuthenticationToken` (LOGIN_FORM, LDAP and S2S all produce `provider=null`), (b) reads the first GrantedAuthority as a `UserProviderRole` enum (`ADMIN | USER`), or (c) chains `getCurrentUser()` into `ReactiveUserOwnerMappingRepository.getAssociatedOwner(username, provider)` to resolve a single `OwnerPojo` via a `USER_OWNER_MAPPING JOIN OWNER` lookup (`AuthIdentityProviderImpl.java:23-53`). `fetchAssociatedOwner()` is the **POSITIVE side** of the defence-in-depth anchor-set pattern: every owner-scoped read path that calls it (Search `my_objects=true`, AlertService `listByOwner`, DataEntity `getMyObjects` / `getMyObjectsWithUpstream`-`Downstream`, Activity `MY_OBJECTS`, DataCollaboration, three Permission extractors) feeds the resolved owner-id into a downstream SQL `WHERE OWNERSHIP.OWNER_ID = ?` JOIN; paths that DO NOT call `fetchAssociatedOwner` (LineageServiceImpl per batch I, ReactiveLineageRepositoryImpl per batch H) are the NEGATIVE case and produce unmitigated cross-owner reads. The service is a **thin reactor-chain wrapper** — no caching, no error handling, no fallback — meaning every invocation is a fresh DB round-trip and every empty SecurityContext silently propagates an empty Mono downstream rather than raising 401/403.

## concepts

- entities: [
    "`UserDto` (record(username, provider); the principal-as-tuple — dto/security/UserDto.java:3)",
    "`UserProviderRole` (enum ADMIN | USER with display string; the only two roles distinguished at the Spring-Security-GrantedAuthority level — dto/security/UserProviderRole.java:8-13)",
    "`OwnerPojo` (the catalog-side Owner entity resolved per-caller via USER_OWNER_MAPPING JOIN — model/tables/pojos/OwnerPojo.java)",
    "`Authentication` (Spring Security's principal carrier — read via `SecurityContext::getAuthentication`; subtypes observed: `OAuth2AuthenticationToken` (OAUTH2), `UsernamePasswordAuthenticationToken` (LOGIN_FORM, LDAP, S2S))",
    "`OAuth2AuthenticationToken` (the OAUTH2 subtype carrying `authorizedClientRegistrationId` — the ONLY auth flow that produces a non-null `provider` string; AuthIdentityProviderImpl.java:29-30)",
    "`USER_OWNER_MAPPING` row (the persistent gate: (owner_id, oidc_username, provider, deleted_at); lookup at ReactiveUserOwnerMappingRepositoryImpl.java:116-127)",
    "`SecurityContext` (Spring's per-request context carrier; entry point at ReactiveSecurityContextHolder.getContext() on lines 25, 39)"
  ]
- operations: [
    "resolve principal: ReactiveSecurityContextHolder.getContext().map(SecurityContext::getAuthentication) — AuthIdentityProviderImpl.java:25-26, 39-40",
    "branch on authentication type: if OAuth2AuthenticationToken → UserDto(name, registrationId); else → UserDto(name, null) — AuthIdentityProviderImpl.java:29-33",
    "extract role: first GrantedAuthority → UserProviderRole.valueOf(authority) — AuthIdentityProviderImpl.java:41-46",
    "compose owner lookup: getCurrentUser().flatMap(user -> userOwnerMappingRepository.getAssociatedOwner(user.username(), user.provider())) — AuthIdentityProviderImpl.java:51-52"
  ]
- invariants: [
    "OAuth2 is the ONLY auth flow that produces a non-null `provider` — all four `*SecurityConfiguration` classes other than OAuth produce `UsernamePasswordAuthenticationToken` (LDAPSecurityConfiguration.java:82 ProviderManager wraps LdapAuthenticationProvider; LoginFormSecurityConfiguration.java:39-66 MapReactiveUserDetailsService; S2sAuthenticationFilter.java:38 explicit `new UsernamePasswordAuthenticationToken`); the `else` branch at line 31-32 collapses all three into provider=null (AuthIdentityProviderImpl.java:29-33)",
    "`getCurrentUser()` returns Mono — emits `empty` (not error) if no SecurityContext is present in the reactor Context; downstream `.flatMap` therefore short-circuits to empty without raising (AuthIdentityProviderImpl.java:25-34)",
    "`fetchAssociatedOwner()` is single-Mono, not Flux — assumes one user maps to AT MOST one active Owner; this is consistent with the live doc anchor 'one user can be associated only with one owner and vice versa' (WebFetched 2026-05-19 status 200) but is NOT enforced by the SQL clause itself; the schema relies on application-side cleanup at `deleteActiveRelationByOwner` (ReactiveUserOwnerMappingRepositoryImpl.java:65-74) to keep at most one active row per (oidc_username, provider)",
    "`getCurrentUserProviderRole()` reads ONLY the first authority via `authorities.iterator().next()` (line 44); if multiple GrantedAuthority entries are present (Spring Security supports composite authorities), the second-and-beyond are silently dropped — the `GrantedAuthorityExtractor` consistently emits exactly one authority (`USER` or `ADMIN`), so today this is correct, but the assumption is implicit",
    "the call chain is purely reactive and stateless — no caching layer, no per-session memoisation, no in-memory map; every invocation issues `ReactiveSecurityContextHolder.getContext()` AND (for fetchAssociatedOwner) a DB SELECT against `user_owner_mapping JOIN owner`"
  ]
- audiences: [
    "every internal callsite resolving the current user — 15 files: 9 service classes (SearchServiceImpl, AlertServiceImpl, DataEntityServiceImpl, DataEntityRelationsServiceImpl, ActivityServiceImpl, DataCollaborationServiceImpl, OwnerAssociationRequestServiceImpl, IdentityServiceImpl, RoleServiceImpl) + TokenGeneratorImpl + 4 permission/extractor classes (DataEntityPermissionExtractor, TermPermissionExtractor, QueryExamplePermissionExtractor, ManagementPermissionExtractor) + PolicyService + ActivityServiceImpl. ALL owner-scoped business logic flows through these three Monos",
    "indirectly: every user reading the `My Objects`, `My Alerts`, `MY_OBJECTS` activity view, or invoking any RBAC-permission-gated mutation"
  ]

## dependencies_semantic

- requires-feature: [
    "**Spring Security WebFlux reactive principal propagation** — the ReactiveSecurityContextHolder.getContext() call assumes the WebFilter chain populated the reactor Context from the session cookie (LOGIN_FORM/OAUTH2), bearer/basic auth (LDAP/OAuth2), or the explicit `contextWrite` in S2sAuthenticationFilter.java:37-39. A misordered WebFilter dropping the SecurityContext silently degrades every call site to empty Mono",
    "**user_owner_mapping persistence** — every fetchAssociatedOwner call requires a live row in USER_OWNER_MAPPING with `deleted_at IS NULL` matching (oidc_username, provider). Per the live doc 'If a user doesn't have an association with any owner, it's impossible for them to manage data entities or have an owner-based security role' (WebFetched 2026-05-19 status 200) — but this code emits empty Mono, not error, so the consequence is silent empty results, not a fail-fast 403",
    "**User-owner association flow** — `OwnerAssociationRequestServiceImpl.createOwnerAssociationRequest` is the documented insertion path; admin-resolved approval inserts the USER_OWNER_MAPPING row via `userOwnerMappingService.createRelation(user.username(), user.provider(), owner.ownerPojo().getId())` (OwnerAssociationRequestServiceImpl.java:65-67). NO auth-mode flow auto-creates this row on first login — the request-and-approval round-trip is mandatory"
  ]
- requires-config: [] — N/A (this file reads no config keys; auth-mode-dependent behaviour is governed by the active `*SecurityConfiguration` bean via `@ConditionalOnProperty(value = "auth.type", ...)` at the configuration layer)
- requires-runtime: [
    "Spring WebFlux + Reactor 3 — `Mono<T>` return shapes, `flatMap` chain composition (AuthIdentityProviderImpl.java:15, 24, 38, 50)",
    "Spring Security 6 (`ReactiveSecurityContextHolder`, `SecurityContext`, `Authentication`, `OAuth2AuthenticationToken`) — imports at AuthIdentityProviderImpl.java:10-13",
    "Apache Commons Collections (CollectionUtils.isNotEmpty filter) — line 5",
    "ReactiveUserOwnerMappingRepository (Spring-injected via constructor; @RequiredArgsConstructor on line 18) — the persistence layer for the (oidc_username, provider) → OwnerPojo lookup"
  ]
- couples-to: [
    "`AuthIdentityProvider` interface (auth/AuthIdentityProvider.java:8-14) — the three-method contract; this class is the SOLE implementation in the codebase",
    "`ReactiveUserOwnerMappingRepository#getAssociatedOwner(String, String)` (repository/reactive/ReactiveUserOwnerMappingRepositoryImpl.java:77-85) — the JOIN-side SQL builder; the WHERE clause is built at lines 116-127 with the (`PROVIDER.eq(provider)` if non-empty else `PROVIDER.isNull()`) branch — the source of the cross-mode bleed",
    "`UserDto` record (dto/security/UserDto.java:3) — the (username, provider) tuple shape",
    "`UserProviderRole` enum (dto/security/UserProviderRole.java:8-13) — the ADMIN/USER role mapping",
    "`OwnerPojo` (model/tables/pojos/OwnerPojo.java) — the resolved per-caller owner; jOOQ-generated from the OWNER table schema",
    "`ReactiveSecurityContextHolder` (Spring Security 6) — sole principal-context source",
    "**All 15 callsites of fetchAssociatedOwner / getCurrentUser / getCurrentUserProviderRole** — see audiences above; this service is the single chokepoint for principal resolution"
  ]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours: [
    "OAuth2AuthenticationToken case: `getCurrentUser()` returns UserDto(name, registrationId) — no test asserts the registrationId is the `client.{id}` string, not the principal name or some other field",
    "Non-OAuth2 case: `getCurrentUser()` returns UserDto(name, null) for both UsernamePasswordAuthenticationToken paths (LOGIN_FORM, LDAP, S2S) — no test asserts the provider=null collapse across these three auth flows",
    "Empty SecurityContext: `getCurrentUser()` emits empty Mono (not error) when ReactiveSecurityContextHolder.getContext() is empty — no test asserts the empty-propagation contract; a regression that switched this to Mono.error would break every downstream owner-scoped endpoint silently (HTTP 500 instead of HTTP 200 + [])",
    "`getCurrentUserProviderRole()` first-authority extraction: if multiple authorities are present (Spring Security composite), only the first is read — no test asserts this; a regression that changed the GrantedAuthorityExtractor to emit (USER, READ) instead of (USER) would still pass but a future ADR mandating role hierarchies would break",
    "`getCurrentUserProviderRole()` filter on empty authorities: when authorities collection is empty, `CollectionUtils.isNotEmpty` filter drops the value → empty Mono. No test asserts this; a regression that removed the filter would cause `iterator().next()` to NoSuchElementException-500",
    "`fetchAssociatedOwner()` chain when USER_OWNER_MAPPING has no row matching (username, provider): the inner Mono is empty, `flatMap` short-circuits to empty Mono. No test asserts the empty-propagation contract end-to-end",
    "Cross-mode bleed: a LOGIN_FORM user `alice` and an LDAP user `alice` both produce UserDto(alice, null) → identical USER_OWNER_MAPPING lookup → identical OwnerPojo. No test exists to PROVE or DENY this is intended; per concepts.yaml `provider=null cross-mode bleed` is a tracked invariant (batch G surfaced; this sidecar primary-source confirms)",
    "S2S caller as `UserDetails(username=ADMIN)`: under S2sAuthenticationFilter.java:31-39 the SecurityContext carries UsernamePasswordAuthenticationToken with username='ADMIN' and the OAuth2-cast fails, so `fetchAssociatedOwner` will search for USER_OWNER_MAPPING WHERE oidc_username='ADMIN' AND provider IS NULL. If an operator has named a real LOGIN_FORM/LDAP user 'ADMIN' (uppercase, the hardcoded S2S username), the S2S caller's owner lookup leaks that user's owner. NO test asserts the isolation"
  ]
- test_files: []
- gaps: |
    Zero direct unit tests for this class. Given that it is the sole chokepoint for owner-scoping across 15 callsites, a regression in any of the three method bodies silently degrades the entire owner-scoped read surface to either empty results (false negative — user sees nothing they own) or wrong-owner results (false positive — user sees another owner's data). The test surface should at minimum cover: (a) OAuth2 vs non-OAuth2 provider distinction at getCurrentUser, (b) empty SecurityContext → empty Mono contract (not error), (c) authorities-iterator-next first-authority semantics at getCurrentUserProviderRole, (d) the (oidc_username, provider) tuple shape passed to the repository at fetchAssociatedOwner. The S2S username="ADMIN" cross-mode bleed (item 8 above) is a NEAR-MISS security vector that operator naming collisions could expose without test cover.

## docs_link_semantic

- declared_docs: [] — N/A (source file carries no `@docs` annotation)
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication"
    anchor: ""
    rationale: "The authentication-mode landing page; enumerates the auth modes whose Authentication subtypes branch in this code (DISABLED / LOGIN_FORM / OAUTH2/OIDC / LDAP / S2S)"
    last_verified_at: "2026-05-19T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      "Authentication mechanisms: Disable authentication; Login form; OAUTH2/OIDC; LDAP; Server-to-server (S2S) — described as 'API-key authentication for server-to-server clients'"
      "The page does not discuss how users are linked to Owners in ODD Platform."
      "There is no documentation on this page about automatic Owner creation upon first login for any authentication method."
      (Live WebFetched 2026-05-19 status 200; doc-side silence is a tracked drift finding.)
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/user-owner-association"
    anchor: ""
    rationale: "The canonical user-owner association doc page; describes the OwnerAssociationRequest flow that creates the USER_OWNER_MAPPING row this code reads. THIS code's `fetchAssociatedOwner` is the runtime consumer of the rows created by that flow"
    last_verified_at: "2026-05-19T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      "For administrators: 'Select owner which you want to associate yourself with and press Associate button.'"
      "For regular users: they 'Select owner which you want to associate yourself with and press Send request button', then await admin approval."
      "If a user doesn't have an association with any owner, it's impossible for them to manage data entities or have an owner-based security role."
      "One user can be associated only with one owner and vice versa." (single-Mono invariant doc-side confirmation)
      "Auto-creation on first login: Not documented in this page." (live WebFetched 2026-05-19 status 200)
      "Provider strings (LOGIN_FORM, LDAP, OAUTH2): Not mentioned in this page." (live WebFetched 2026-05-19 status 200)
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization"
    anchor: ""
    rationale: "The authorization landing page; the parent surface for the user-owner-association sub-page. Doc-side silence on the runtime semantics this code enforces is a drift finding"
    last_verified_at: "2026-05-19T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      "No detailed explanation [of how Spring authenticated users get linked to Owner entities]."
      "None of these specific terms or concepts [OwnerAssociationRequest, user_owner_mapping, auto-creation] appear in the content shown."
      "The only mention of user-owner linking is this table of contents entry: 'User-owner association'."
      (Live WebFetched 2026-05-19 status 200.)
- doc_drift_findings:
  - "**The (username, provider) compound key is silent in the docs.** The user-owner-association doc says 'one user can be associated only with one owner' — but is silent on how 'one user' is identified. The code identifies users by the COMPOUND key (username, provider) where provider is the OAuth2 registrationId or NULL. An operator migrating from LOGIN_FORM to OAUTH2 (or vice versa) discovers their existing user-owner mappings no longer match because the OAuth2 user has (alice, github) whereas the LOGIN_FORM user had (alice, null). Severity: HIGH doc-drift. evidence: AuthIdentityProviderImpl.java:29-33 + ReactiveUserOwnerMappingRepositoryImpl.java:116-127."
  - "**Auto-creation gap is undocumented.** The live authentication and user-owner-association pages are SILENT on whether OAuth2/LDAP auto-creates an Owner on first login. The code does NOT auto-create — every authenticated user must go through OwnerAssociationRequest before fetchAssociatedOwner returns non-empty. A new OAUTH2/LDAP user landing on `/my` or any owner-scoped tab sees empty results with no on-screen 'request your association' prompt. Severity: HIGH doc-drift (an entire user-onboarding step is invisible in the docs). evidence: AuthIdentityProviderImpl.java:50-53 (empty-Mono propagation) + OwnerAssociationRequestServiceImpl.java:54-76 (the explicit request flow; not auto-created) + live docs WebFetched 2026-05-19 status 200 showing no auto-create guidance."
  - "**S2S filter username='ADMIN' is undocumented.** The S2sAuthenticationFilter hardcodes username='ADMIN' (uppercase) into the UsernamePasswordAuthenticationToken (S2sAuthenticationFilter.java:31-34). When such a call invokes any service using `fetchAssociatedOwner`, the lookup is `WHERE oidc_username='ADMIN' AND provider IS NULL`. The docs do not warn operators that an operator-named LOGIN_FORM/LDAP user 'ADMIN' would collide. Severity: MEDIUM doc-drift (latent operator-naming collision). evidence: S2sAuthenticationFilter.java:31-34 + AuthIdentityProviderImpl.java:29-33 + ReactiveUserOwnerMappingRepositoryImpl.java:116-127."
  - "**Read-collaborative posture for empty SecurityContext is undocumented.** Under `auth.type=DISABLED`, no SecurityContext is populated (DisabledAuthSecurityConfiguration.java:11-19 — no ServerSecurityContextRepository wiring). `getCurrentUser` emits empty Mono, propagating to every consumer. The cross-pillar consequence (read-only paths still work, owner-scoped paths return empty body) is a load-bearing dev-vs-prod difference not captured in the auth docs. Severity: LOW (DISABLED is documented as dev-only). evidence: DisabledAuthSecurityConfiguration.java:11-19 + AuthIdentityProviderImpl.java:24-35."

## implicit_adrs

- "**Per-request principal resolution flows through reactor Context, not method parameters.** Every callsite of `getCurrentUser` / `fetchAssociatedOwner` / `getCurrentUserProviderRole` invokes a Mono with NO Authentication / Principal parameter; the principal is read inside this service via `ReactiveSecurityContextHolder.getContext()`. This is the ARCHITECTURAL ANCHOR for ADR-CANDIDATE-015 (owner-scoped routes via reactor Context) — promoted in batch G (DataEntityController.getMyObjects sidecar). The contrast with the alternative (controller method signature accepting Authentication, passed through every service hop) is deliberate: the maintainer chose the reactive-Context path so controllers and services need not thread the principal explicitly." — evidence: AuthIdentityProviderImpl.java:25, 39 (ReactiveSecurityContextHolder.getContext()) + all 15 callsites taking no Authentication parameter — intent_anchor: "the public contract on `AuthIdentityProvider.java:8-14` is three parameter-less Mono returns — no API accepts an Authentication argument; the maintainer's design choice is that the principal is ALWAYS read from the reactor Context, never threaded through method signatures" — confidence: HIGH
- "**OAuth2 is the ONLY auth flow distinguished by a non-null `provider` string; LOGIN_FORM and LDAP collapse to provider=null.** Lines 29-33 explicitly cast on `OAuth2AuthenticationToken` and read `getAuthorizedClientRegistrationId()`. The else-branch on line 32 hard-codes `null` for every other Authentication subtype. This is the source of the cross-mode bleed: an operator with both LOGIN_FORM and LDAP active (a common migration scenario) sees both auth flows producing the same (username, null) tuple. The maintainer's intent: OAuth2 federates per-IDP, so the registrationId is the natural namespace differentiator; LOGIN_FORM and LDAP are each 'local' to the deployment and the maintainer chose not to distinguish them — accepting the migration-time bleed. NOT documented." — evidence: AuthIdentityProviderImpl.java:29-33 (explicit instanceof check; else branch produces null) — intent_anchor: "`if (authentication instanceof OAuth2AuthenticationToken oauthToken) { ... } else { return new UserDto(username, null); }` — the pattern-match-and-else IS the decision: only the OAuth2 subtype carries provider info; all others are pooled into the null bucket" — confidence: HIGH
- "**Single-Mono owner resolution (not Flux) — one user, at most one active Owner.** `fetchAssociatedOwner` returns `Mono<OwnerPojo>` (line 50) chained via `flatMap` to a `Mono` return from the repository (ReactiveUserOwnerMappingRepositoryImpl.java:83 uses `jooqReactiveOperations.mono`, not `.flux`). The doc-side confirmation is verbatim: 'one user can be associated only with one owner and vice versa' (WebFetched 2026-05-19 status 200, user-owner-association page). The schema-level enforcement is application-side (the clear-active-then-insert pattern in `createRelation`/`deleteActiveRelationByOwner`) rather than a partial unique index — verifiable design intent: ONE active row per (oidc_username, provider) is the assumed invariant." — evidence: AuthIdentityProviderImpl.java:50-53 (Mono return) + ReactiveUserOwnerMappingRepositoryImpl.java:83 (.mono) + ReactiveUserOwnerMappingRepositoryImpl.java:65-74 (clear-active pattern) — intent_anchor: "`Mono<OwnerPojo> fetchAssociatedOwner();` — the return type is the contract; if multi-owner were intended, this would be `Flux<OwnerPojo>` and downstream owner-scoped reads would consume `IN (...)` predicates" — confidence: HIGH
- "**Stateless / no-caching by deliberate omission.** Every invocation goes through `ReactiveSecurityContextHolder.getContext()` AND (for fetchAssociatedOwner) the DB lookup. There is no in-memory map keyed by username, no per-session memoization, no `@Cacheable`. This is a deliberate choice — the maintainer accepts the per-request DB round-trip rather than maintain a cache-invalidation surface for an operation that runs on every owner-scoped endpoint. For a UI rendering `Recommended → My Objects` on every page load, the cumulative cost is N×(SELECT FROM user_owner_mapping JOIN owner) per session — bounded but multiplicative. The trade-off is reasoned by absence: no JIRA-shaped cache invalidation question, no stale-Owner-after-rebind bug class." — evidence: AuthIdentityProviderImpl.java:24-53 (no @Cacheable, no map field, no `volatile`/atomic state; lombok `@RequiredArgsConstructor` only injects the repository) — intent_anchor: "the class is a 31-line lombok'd reactive chain with one private final field (the repository) — the absence of any state or cache annotation IS the architectural posture; the maintainer didn't add caching because the contract is 'resolve per-request, trust the DB'" — confidence: MEDIUM (the absence-as-intent inference is consistent with the codebase's broader reactive-stateless posture but not directly commented; routing to implicit_adrs rather than bugs because the absence is consistent across the entire service layer)

## bugs_limitations_corner_cases

- "**LOGIN_FORM ↔ LDAP cross-mode bleed via provider=null.** A LOGIN_FORM user `alice` and an LDAP user `alice` both produce `UserDto(\"alice\", null)` at AuthIdentityProviderImpl.java:32. The downstream lookup at `getConditions(\"alice\", null)` builds `WHERE OIDC_USERNAME = 'alice' AND DELETED_AT IS NULL AND PROVIDER IS NULL` (ReactiveUserOwnerMappingRepositoryImpl.java:116-127). If both auth modes are configured to point at users that overlap (operator naming convention or a migration scenario), the second-mode user inherits the first-mode user's Owner-link. The codepath has NO mode-check, NO warning log, NO fail-fast — the migration step is silent. severity: HIGH (security crossover during migration; undocumented). evidence: AuthIdentityProviderImpl.java:29-33 + ReactiveUserOwnerMappingRepositoryImpl.java:116-127 + LoginFormSecurityConfiguration.java:30-34 + LDAPSecurityConfiguration.java:50-57."
- "**S2S filter hardcodes username='ADMIN' which collides with operator-named users.** S2sAuthenticationFilter.java:31-34 builds `User.withUsername(\"ADMIN\").roles(\"ADMIN\")` and wraps in UsernamePasswordAuthenticationToken (provider will be null at AuthIdentityProviderImpl.java:32). Any S2S call that invokes a service using `fetchAssociatedOwner` looks up `WHERE OIDC_USERNAME = 'ADMIN' AND PROVIDER IS NULL`. If an operator has named a LOGIN_FORM or LDAP user 'ADMIN' (uppercase, exact case-sensitive match — the SQL uses `eq`, not `equalIgnoreCase`), the S2S caller will resolve to THAT user's Owner. S2S API key holders thereby inherit one specific operator user's owner-scoped reads/mutations. The uppercase / case-sensitivity reduces but does not eliminate the collision. severity: HIGH (security boundary failure on operator-naming collision). evidence: S2sAuthenticationFilter.java:31-34 + AuthIdentityProviderImpl.java:29-33 + ReactiveUserOwnerMappingRepositoryImpl.java:116-127."
- "**No auto-create of Owner on OAUTH2/LDAP first login — silent empty results for unmapped users.** A new OAUTH2 or LDAP user authenticated for the first time has NO USER_OWNER_MAPPING row. `fetchAssociatedOwner` chain emits empty Mono (line 51 → flatMap on a Mono that emits empty). Downstream consumers (AlertService.listByOwner at line 84, DataEntityService.listAssociated, SearchServiceImpl.search with my_objects=true, ActivityServiceImpl.listMyEvents) all degrade to empty results with HTTP 200, not 401/403/404. The new user sees `My Objects` empty, `My Alerts` empty, `MY_OBJECTS` activity empty, and has no on-screen signal directing them to the OwnerAssociationRequest flow. severity: HIGH (user-onboarding UX failure + undocumented gap; both batch E and live docs confirmed silent). evidence: AuthIdentityProviderImpl.java:50-53 (no switchIfEmpty) + OwnerAssociationRequestServiceImpl.java:54-76 (request flow is explicit, NOT auto-triggered) + live user-owner-association doc (WebFetched 2026-05-19 status 200) silent on first-login behaviour."
- "**Empty SecurityContext silently propagates rather than fail-fast.** When `ReactiveSecurityContextHolder.getContext()` emits empty (which happens under `auth.type=DISABLED` — no ServerSecurityContextRepository — or in a future regression where a WebFilter is misordered), `getCurrentUser` emits empty (no `.switchIfEmpty(Mono.error(...))`); every owner-scoped consumer therefore degrades to empty results. There is no logging, no metric, no warning. A regression that broke principal propagation across the entire reactor pipeline would manifest as 'every user sees empty My Objects' — diagnosable only by examining each affected endpoint. severity: MEDIUM (observability gap; today DISABLED-mode is dev-only per docs, but the same code path is the regression-detection surface). evidence: AuthIdentityProviderImpl.java:24-35 (no switchIfEmpty on context) + AuthIdentityProviderImpl.java:50-53 (no switchIfEmpty on getCurrentUser) + DisabledAuthSecurityConfiguration.java:11-19 (the dev-mode empty-context case)."
- "**No caching layer — per-call DB round-trip on the principal-lookup query.** Every fetchAssociatedOwner invocation issues `SELECT owner.* FROM user_owner_mapping JOIN owner ... WHERE oidc_username = ? AND deleted_at IS NULL AND (provider = ? OR provider IS NULL)`. For a UI rendering catalog home (mounting `Recommended → My Objects` + `My Alerts` count + Activity feed simultaneously), a single user page-load triggers 3-5 sequential identical queries to user_owner_mapping. The query is indexed (per the schema migrations) and small, but the absence of even a per-request memoization (e.g., a reactor Context attribute) is a measurable per-page cost. severity: LOW (performance gap; correctness is preserved). evidence: AuthIdentityProviderImpl.java:50-53 (raw flatMap, no cache) + ReactiveUserOwnerMappingRepositoryImpl.java:77-85 (raw DB call, no @Cacheable)."
- "**`getCurrentUserProviderRole` silently drops authorities beyond the first.** Line 44 invokes `authorities.iterator().next().getAuthority()`. If the GrantedAuthorityExtractor ever emits more than one authority (a future RBAC hierarchy refactor), the second-and-beyond are silently ignored. Today this is fine — the extractor emits exactly USER or ADMIN — but a future change that added (USER, READ_QUERY_EXAMPLE) etc. would silently lose information without test cover. severity: LOW (latent — only triggers on a future ADR change). evidence: AuthIdentityProviderImpl.java:41-46 (iterator().next() with no aggregation)."

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP | DISABLED | INTERNAL_ONLY (S2S)`. This service is invoked under all four UI auth modes AND under S2S; it is the SOLE chokepoint for resolving the principal-to-Owner mapping. Under DISABLED, the SecurityContext is empty (DisabledAuthSecurityConfiguration.java:11-19 wires no ServerSecurityContextRepository) → all three Monos emit empty. Under LOGIN_FORM and LDAP, the Authentication is UsernamePasswordAuthenticationToken → provider=null. Under OAUTH2, it is OAuth2AuthenticationToken → provider=registrationId. Under S2S, the S2sAuthenticationFilter explicitly seeds a UsernamePasswordAuthenticationToken with username='ADMIN' → provider=null. evidence: AuthIdentityProviderImpl.java:24-35 + S2sAuthenticationFilter.java:31-39 + DisabledAuthSecurityConfiguration.java:11-19 + LoginFormSecurityConfiguration.java:30-34 + LDAPSecurityConfiguration.java:50-57.
- **ingestion_filter_relevance**: `N/A — not HTTP`. This is an internal service, not a controller endpoint. The ingestion filter (`IngestionDataEntitiesFilter`) gates `/ingestion/entities` before any service-layer code runs.
- **authorization_assertions**: [] — this service performs NO authorization; it provides the principal-identity primitives that authorization decisions consume. Callsites (e.g. permission extractors at TermPermissionExtractor.java:46, DataEntityPermissionExtractor.java:51, QueryExamplePermissionExtractor.java:41) consume `fetchAssociatedOwner()` to construct policy-evaluation context, but the actual permission check is built downstream at `PermissionService`/`ReactiveResourcePermissionAuthorizationManager`. evidence: AuthIdentityProviderImpl.java:24-53 (no @PreAuthorize, no permission check, no role gate; pure identity resolution).
- **owner_scoping**: `RESPECTS — this service IS the per-caller owner resolution`. `fetchAssociatedOwner` is the load-bearing primitive that owner-scoped reads consume. Architectural anchor: every SQL JOIN `WHERE OWNERSHIP.OWNER_ID = ?` downstream is parameterised by the Mono this service produces. evidence: AuthIdentityProviderImpl.java:50-53 + ReactiveUserOwnerMappingRepositoryImpl.java:77-85.
- **data_exposure**:
  - "UserDto(username, provider) → consumers (15 internal callsites). The provider string is the OAuth2 registration id ONLY for OAUTH2 flows; never returned to UI consumers verbatim. evidence: AuthIdentityProviderImpl.java:28-33"
  - "Owner-link state inference: a caller whose `fetchAssociatedOwner` emits empty knows their USER_OWNER_MAPPING row is missing or soft-deleted; this is innocuous (they know their own state) but the LACK of a fail-fast error makes the state-inference subtle (empty result body, not a thrown exception). evidence: AuthIdentityProviderImpl.java:50-53"
  - "S2S 'ADMIN' username surface: any operator with grep access to S2sAuthenticationFilter.java:31 can see the hardcoded literal. The username is not secret — but its existence as a real lookup key in user_owner_mapping is a less-obvious knock-on. evidence: S2sAuthenticationFilter.java:31-34"
- **known_security_gaps**:
  - "**LOGIN_FORM/LDAP provider=null cross-mode bleed.** A LOGIN_FORM user `alice` and an LDAP user `alice` resolve to the SAME Owner via the (alice, null) USER_OWNER_MAPPING row. Migration scenarios with overlapping usernames silently grant the second-mode user the first-mode user's owner-scoped reads/mutations. severity: HIGH (security crossover during migration; undocumented). evidence: AuthIdentityProviderImpl.java:29-33 + ReactiveUserOwnerMappingRepositoryImpl.java:116-127."
  - "**S2S username='ADMIN' / operator-named user 'ADMIN' collision.** S2S API-key holders inherit any LOGIN_FORM/LDAP user named 'ADMIN' (uppercase) by virtue of the hardcoded literal in S2sAuthenticationFilter.java:31-34 colliding with the user_owner_mapping lookup at fetchAssociatedOwner. The case-sensitive 'ADMIN' (vs 'admin' / 'Admin') reduces but does not eliminate the collision. severity: HIGH (security boundary failure on naming collision; defendable by operator hygiene but not by code). evidence: S2sAuthenticationFilter.java:31-34 + AuthIdentityProviderImpl.java:29-33 + ReactiveUserOwnerMappingRepositoryImpl.java:116-127."
  - "**Empty SecurityContext propagates silently — degradation is indistinguishable from 'user owns nothing'.** Any operator-or-regression event that drops the SecurityContext (misordered WebFilter, dev-mode DISABLED, future bug) collapses every owner-scoped consumer to empty results without observable error. severity: MEDIUM (observability gap; combined with the lineage-variant single-point-of-failure surfaced in batch G, this is the single most fragile assumption in the owner-scoping defence). evidence: AuthIdentityProviderImpl.java:24-35 (no switchIfEmpty)."
  - "**No auto-create of Owner on first login under OAUTH2/LDAP** — a new federated user can browse `/my` indefinitely and see empty results; there is no UI banner, no on-screen instruction directing them to the OwnerAssociationRequest flow. severity: MEDIUM (user-onboarding security UX gap — users may believe they have NO catalog access when they have read-collaborative access but no owner-link). evidence: AuthIdentityProviderImpl.java:50-53 + OwnerAssociationRequestServiceImpl.java:54-76 (explicit-only) + live user-owner-association doc silent on auto-create."

## performance

- **hot_paths**:
  - "**Principal-lookup DB round-trip on every owner-scoped read.** Each `fetchAssociatedOwner` invocation issues `SELECT owner.* FROM user_owner_mapping JOIN owner ON user_owner_mapping.owner_id = owner.id WHERE oidc_username = ? AND deleted_at IS NULL AND (provider = ? OR provider IS NULL)` (ReactiveUserOwnerMappingRepositoryImpl.java:77-85). This service is invoked by 15 distinct callsites — multiplicative under heavy UI activity. evidence: AuthIdentityProviderImpl.java:50-53 + ReactiveUserOwnerMappingRepositoryImpl.java:77-85."
  - "**Reactor SecurityContext context-switch on every getCurrentUser call.** `ReactiveSecurityContextHolder.getContext()` is invoked twice (lines 25, 39) per `getCurrentUser` and `getCurrentUserProviderRole` call. The context-resolution itself is in-memory but the reactor switching incurs per-call overhead. evidence: AuthIdentityProviderImpl.java:25, 39."
- **throughput_characteristics**:
  - "stateless service — instances scale horizontally with no coordination",
  - "single-Mono / non-batching — each principal resolution is independent; no batched lookup for multiple principals",
  - "reactive Mono signatures — non-blocking but per-call DB round-trip"
- **resource_allocation**:
  - "no client-side caching — every call hits Postgres via jooqReactiveOperations.mono",
  - "the `user_owner_mapping JOIN owner` query is small (single-row) and indexed (per migration history; the OIDC_USERNAME column is the primary lookup key per ReactiveUserOwnerMappingRepositoryImpl.java:119)",
  - "no connection-pool contention surfacing here directly, but accumulated across 3-5 sequential identical queries per page-load it is a measurable cost"
- **scaling_characteristics**:
  - "stateless — instances scale horizontally",
  - "no advisory locks, no in-memory state, no leader-election",
  - "no pagination concern (single-row return)",
  - "no rate-limiting at this service — repeated principal-lookups from a single client hit the DB at request rate"
- **known_performance_gaps**:
  - "**No per-request memoization.** A single HTTP request can invoke `getCurrentUser` or `fetchAssociatedOwner` multiple times (e.g., once at the controller for owner-scoping + once in a permission extractor + once in an activity-logging path). A reactor-Context attribute carrying the resolved UserDto / OwnerPojo would eliminate the duplicate work. severity: LOW (per-request cost is small; cumulative cost is bounded but multiplicative). evidence: AuthIdentityProviderImpl.java:50-53 (raw flatMap chain; no Context.put / Context.get)."
  - "**No per-session caching.** Inside a single user's session (page-load → click → render), `fetchAssociatedOwner` returns the same Owner. A short-lived per-session in-memory cache (or even a Spring `@Cacheable` with a session-scoped key) would eliminate the per-call DB round-trip. The maintainer's deliberate absence (see implicit_adrs[3]) is the trade-off: cache-invalidation surface vs. per-request DB round-trip. severity: LOW (correctness preserved; performance gap measurable but bounded). evidence: AuthIdentityProviderImpl.java (no @Cacheable, no session-scoped state)."

## sources

- understanding ← AuthIdentityProviderImpl.java:1-54 + AuthIdentityProvider.java:8-14 + dto/security/UserDto.java:3 + dto/security/UserProviderRole.java:8-13 + ReactiveUserOwnerMappingRepositoryImpl.java:77-85, 116-127
- concepts.entities.UserDto ← dto/security/UserDto.java:3
- concepts.entities.UserProviderRole ← dto/security/UserProviderRole.java:8-13
- concepts.entities.OwnerPojo ← AuthIdentityProviderImpl.java:8 (import) + ReactiveUserOwnerMappingRepositoryImpl.java:79-85
- concepts.entities.Authentication ← AuthIdentityProviderImpl.java:10 (import) + lines 26, 40
- concepts.entities.OAuth2AuthenticationToken ← AuthIdentityProviderImpl.java:13 (import) + line 29
- concepts.entities.USER_OWNER_MAPPING ← ReactiveUserOwnerMappingRepositoryImpl.java:30, 79-82, 116-127
- concepts.entities.SecurityContext ← AuthIdentityProviderImpl.java:11-12 (imports) + lines 25, 39
- concepts.operations.resolve-principal ← AuthIdentityProviderImpl.java:25-26, 39-40
- concepts.operations.branch-on-type ← AuthIdentityProviderImpl.java:29-33
- concepts.operations.extract-role ← AuthIdentityProviderImpl.java:41-46
- concepts.operations.compose-owner-lookup ← AuthIdentityProviderImpl.java:51-52
- concepts.invariants.[1] (OAuth2 only path with non-null provider) ← AuthIdentityProviderImpl.java:29-33 + LoginFormSecurityConfiguration.java:39-66 + LDAPSecurityConfiguration.java:82 + S2sAuthenticationFilter.java:37-39
- concepts.invariants.[2] (empty-Mono propagation) ← AuthIdentityProviderImpl.java:25-34 (no switchIfEmpty)
- concepts.invariants.[3] (single-Mono at-most-one Owner) ← AuthIdentityProviderImpl.java:50 (Mono return) + ReactiveUserOwnerMappingRepositoryImpl.java:83 (.mono call) + live doc WebFetched 2026-05-19 status 200 'one user can be associated only with one owner'
- concepts.invariants.[4] (first-authority semantics) ← AuthIdentityProviderImpl.java:43-44
- concepts.invariants.[5] (stateless / no-cache) ← AuthIdentityProviderImpl.java:17-21 (only one private final field, no state)
- concepts.audiences.[*] ← Grep for fetchAssociatedOwner | authIdentityProvider | getCurrentUser across odd-platform-api/src/main/java returned 15 files (cited above)
- dependencies_semantic.requires-feature.[1] (user_owner_mapping persistence) ← live user-owner-association doc WebFetched 2026-05-19 status 200 + ReactiveUserOwnerMappingRepositoryImpl.java:79-85
- dependencies_semantic.requires-feature.[2] (User-owner association flow) ← OwnerAssociationRequestServiceImpl.java:54-76
- dependencies_semantic.requires-runtime.[*] ← AuthIdentityProviderImpl.java:1-21 (imports + class declaration)
- dependencies_semantic.couples-to.* ← cited file:line ranges
- tests_coverage_semantic.uncovered_behaviours.[*] ← Grep for AuthIdentityProviderImplTest | AuthIdentityProviderTest under odd-platform-api/src/test returned no matches; the 8 behaviours are derived from the 3 method bodies at AuthIdentityProviderImpl.java:23-53
- docs_link_semantic.inferred_docs.[0] ← live WebFetched 2026-05-19 status 200 (verbatim excerpts in fetched_excerpts block)
- docs_link_semantic.inferred_docs.[1] ← live WebFetched 2026-05-19 status 200 (user-owner-association page; verbatim excerpts)
- docs_link_semantic.inferred_docs.[2] ← live WebFetched 2026-05-19 status 200 (authorization landing page; verbatim excerpts)
- docs_link_semantic.doc_drift_findings.[0] ← live user-owner-association doc + AuthIdentityProviderImpl.java:29-33 + ReactiveUserOwnerMappingRepositoryImpl.java:116-127
- docs_link_semantic.doc_drift_findings.[1] ← live authentication + user-owner-association docs (both WebFetched 2026-05-19 status 200, both silent on auto-create) + AuthIdentityProviderImpl.java:50-53 + OwnerAssociationRequestServiceImpl.java:54-76
- docs_link_semantic.doc_drift_findings.[2] ← S2sAuthenticationFilter.java:31-34 + AuthIdentityProviderImpl.java:29-33 + ReactiveUserOwnerMappingRepositoryImpl.java:116-127 + live doc silence
- docs_link_semantic.doc_drift_findings.[3] ← DisabledAuthSecurityConfiguration.java:11-19 + AuthIdentityProviderImpl.java:24-35 + live authentication doc silence
- implicit_adrs.[0] (reactor-Context principal flow) ← AuthIdentityProviderImpl.java:25, 39 + AuthIdentityProvider.java:8-14 + all 15 callsites
- implicit_adrs.[1] (OAuth2-only non-null provider) ← AuthIdentityProviderImpl.java:29-33
- implicit_adrs.[2] (single-Mono Owner) ← AuthIdentityProviderImpl.java:50-53 + ReactiveUserOwnerMappingRepositoryImpl.java:83, 65-74 + live doc fetched_excerpt
- implicit_adrs.[3] (stateless / no-cache by omission) ← AuthIdentityProviderImpl.java:17-21 (single private final field; no @Cacheable, no state)
- bugs_limitations_corner_cases.[0] (cross-mode bleed) ← AuthIdentityProviderImpl.java:29-33 + ReactiveUserOwnerMappingRepositoryImpl.java:116-127 + LoginFormSecurityConfiguration.java:30-34 + LDAPSecurityConfiguration.java:50-57
- bugs_limitations_corner_cases.[1] (S2S username='ADMIN' collision) ← S2sAuthenticationFilter.java:31-34 + AuthIdentityProviderImpl.java:29-33 + ReactiveUserOwnerMappingRepositoryImpl.java:116-127
- bugs_limitations_corner_cases.[2] (no auto-create on first login) ← AuthIdentityProviderImpl.java:50-53 + OwnerAssociationRequestServiceImpl.java:54-76 + live doc WebFetched 2026-05-19 status 200
- bugs_limitations_corner_cases.[3] (empty SecurityContext silent propagation) ← AuthIdentityProviderImpl.java:24-35, 50-53 + DisabledAuthSecurityConfiguration.java:11-19
- bugs_limitations_corner_cases.[4] (no caching) ← AuthIdentityProviderImpl.java:17-21, 50-53 + ReactiveUserOwnerMappingRepositoryImpl.java:77-85
- bugs_limitations_corner_cases.[5] (silent authority drop) ← AuthIdentityProviderImpl.java:41-46
- security.auth_mode_relevance ← AuthIdentityProviderImpl.java:24-35 + S2sAuthenticationFilter.java:31-39 + DisabledAuthSecurityConfiguration.java:11-19 + LoginFormSecurityConfiguration.java:30-34 + LDAPSecurityConfiguration.java:50-57
- security.ingestion_filter_relevance ← N/A (this is an internal service, no HTTP surface)
- security.authorization_assertions ← AuthIdentityProviderImpl.java:24-53 (no auth annotations or checks)
- security.owner_scoping ← AuthIdentityProviderImpl.java:50-53 + ReactiveUserOwnerMappingRepositoryImpl.java:77-85
- security.data_exposure.[*] ← AuthIdentityProviderImpl.java:28-33, 50-53 + S2sAuthenticationFilter.java:31
- security.known_security_gaps.[*] ← cited file:line ranges within each entry
- performance.hot_paths.[*] ← AuthIdentityProviderImpl.java:24-53 + ReactiveUserOwnerMappingRepositoryImpl.java:77-85
- performance.throughput_characteristics.[*] ← AuthIdentityProviderImpl.java:17 (stateless component) + line 50 (Mono return signatures)
- performance.resource_allocation.[*] ← AuthIdentityProviderImpl.java:17-21 + ReactiveUserOwnerMappingRepositoryImpl.java:77-85, 116-127
- performance.scaling_characteristics.[*] ← AuthIdentityProviderImpl.java:17-21 (no state, no locks, no leader-election)
- performance.known_performance_gaps.[*] ← cited file:line ranges within each entry

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (zero direct unit tests verified via Grep for AuthIdentityProviderImplTest / AuthIdentityProviderTest under odd-platform-api/src/test; the 8 uncovered_behaviours are derived from method bodies)
- docs_link_semantic: HIGH (3 live WebFetches against the canonical authentication / authorization / user-owner-association doc pages, all 200, verbatim excerpts captured)
- implicit_adrs: HIGH (4 decisions, each anchored to concrete intent evidence — pattern-match-and-else, Mono-not-Flux return type, no-state class declaration, parameter-less interface contract)
- bugs_limitations_corner_cases: HIGH (every claim traces to specific lines; the S2S `ADMIN`-collision and provider=null cross-mode bleed are derived from explicit literal text and explicit SQL clauses)
- security: HIGH
- performance: HIGH

## Maintainer notes

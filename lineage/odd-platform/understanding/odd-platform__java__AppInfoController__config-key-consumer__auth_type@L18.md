---
node_id: "odd-platform java AppInfoController config-key-consumer:auth.type@L18"
node_kind: config-key-consumer
axis: config_prefixes
extracted_at_commit: ede5d277be6251b0826026035707c1fb6dbb24b6
enriched_at_commit: ede5d277be6251b0826026035707c1fb6dbb24b6
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-10-01
---

# AppInfoController.auth.type@L18 — semantic understanding

## understanding

This `@Value("${auth.type}")` consumer injects the configured authentication mode as a plain `String` into `AppInfoController`, where it is round-tripped verbatim into the response of `GET /api/appInfo` via `AppInfo.authType(authType)` (line 27). The consumer does not constrain the value, does not declare a `@Value` default, and does not map the string onto the `DISABLED | LOGIN_FORM | OAUTH2 | LDAP` vocabulary that the other six consumers of `auth.type` use via `@ConditionalOnProperty(... havingValue=...)`. The semantic purpose of this read is **introspection**: the UI calls `/api/appInfo` to discover which auth mode the backend is running so it can render the appropriate login flow. The side effect is that the deployment's auth mode becomes a piece of state exposed on the wire, governed by whatever path-level rule applies to `/api/appInfo` at runtime (which differs per active auth mode — see `security` below).

## concepts

- entities: ["AppInfo (DTO)", "auth.type configuration key", "BuildProperties"]
- operations: ["inject auth.type as String at construction", "echo authType into AppInfo response body"]
- invariants: ["authType field is initialised once at controller construction and is effectively immutable thereafter (final field, line 15)", "the string passed to AppInfo.authType is whatever Spring resolved for `${auth.type}` — no normalisation, no enum mapping"]
- audiences: ["frontend SPA (renders login UI based on returned authType)", "any HTTP caller able to reach /api/appInfo under the active auth mode"]

## dependencies_semantic

- requires-feature: ["the auth-mode wiring downstream (DisabledAuthSecurityConfiguration / LoginFormSecurityConfiguration / OAuthSecurityConfiguration / LDAPSecurityConfiguration) — those decide whether `/api/appInfo` is reachable unauthenticated"]
- requires-config: ["auth.type — must be set; no fallback default at this consumer; application.yml supplies the default value `DISABLED` (application.yml:34)"]
- requires-runtime: ["BuildProperties bean (Spring Boot actuator/build-info; only present when `spring-boot-maven-plugin build-info` or equivalent ran at build time — if missing, controller construction fails)"]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - "behaviour: returns the configured authType verbatim for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP"
  - "behaviour: behaviour when `auth.type` is unset (Spring `@Value` with no default → BeanCreationException at startup)"
  - "behaviour: behaviour when `auth.type` is set to a value outside the documented enum (e.g. `foo`) — controller still constructs and echoes `foo` because no validation"
  - "behaviour (security): unauthenticated GET /api/appInfo returns 200 + authType under auth.type=DISABLED; returns 302/401 under LOGIN_FORM/OAUTH2/LDAP"
- test_files: []
- gaps: |
    Zero test coverage. Greps under `odd-platform-api/src/test` for `AppInfoController`, `getAppInfo`, and the literal `auth.type` produce no hits. No WebFluxTest, no slice test, no integration test asserts the path security of `/api/appInfo` or the shape of the returned `AppInfo` payload. A regression that (1) silently drops `authType` from the DTO, (2) changes path security so an unauthenticated caller can no longer reach `/api/appInfo` (breaking the SPA's login render), or (3) adds new fields to `AppInfo` containing operator-sensitive metadata (build SHA, hostname, etc.) would not be caught by the current test suite.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication"
    anchor: ""
    rationale: "auth.type is the central authentication-mode switch — its consumer in a controller belongs on the authentication doc page if the page documented the response surface."
    last_verified_at: "2026-05-10T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security"
    anchor: ""
    rationale: "The security overview page lists `auth.type (DISABLED / LOGIN_FORM / OAUTH2 / LDAP)` and explains UI/API vs ingestion protection — the natural home for any documentation of which API endpoints are open vs protected."
    last_verified_at: "2026-05-10T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
- fetched_excerpts: |
    From `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security` (WebFetched 2026-05-10, status 200):
    "auth.type (DISABLED / LOGIN_FORM / OAUTH2 / LDAP)"
    "The /api/** namespace is governed by auth.type"
    "auth.ingestion.filter.enabled defaults to false. With the default in place and the platform reachable on the network, any caller who can speak the ingress API can POST /ingestion/entities"
    The page does NOT name `/api/appInfo` specifically, does NOT document the fact that `/api/appInfo` echoes the active `auth.type` value in its response body, and does NOT mention that under `auth.type=DISABLED` (the application.yml default) `/api/appInfo` is unauthenticated and therefore allows any network caller to fingerprint the deployment's auth mode.

    From `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication` (WebFetched 2026-05-10, status 200): the page is a navigation contents page; no per-endpoint security documentation.
- doc_drift_findings:
  - "Live docs do not document the `/api/appInfo` endpoint's existence, its response shape (`{projectVersion, authType}`), or the fact that the response echoes the active auth mode."
  - "Live docs do not warn that under the application.yml default `auth.type=DISABLED` (application.yml:34) `/api/appInfo` is reachable by unauthenticated network callers and discloses the active auth mode + project version — a passive fingerprinting surface."
  - "Live docs do not state whether `auth.type` must be set explicitly. The consumer at AppInfoController.java:18 declares no `@Value` default, so behaviour relies entirely on application.yml's bundled default of `DISABLED` — overriding the property to empty string at deployment time (`-Dauth.type=` or `AUTH_TYPE=`) silently injects empty string, breaks downstream `@ConditionalOnProperty` matches, and produces a deployment with NO `SecurityWebFilterChain` bean wired."

## implicit_adrs

- "AppInfo response intentionally exposes the active auth mode to clients so the frontend SPA can render the appropriate login flow without a prior authentication round-trip." — evidence: AppInfoController.java:24-28 (`getAppInfo` returns `AppInfo.authType(authType)`) — intent_anchor: the OpenAPI contract `AppInfoApi.java:43` documents the endpoint as `GET /api/appInfo : Get application info` and the model `AppInfo.java:48-66` exposes `authType` as a first-class field with `@JsonProperty("authType")` — the field is part of the published contract, not an accidental leak. — confidence: HIGH

- "The auth-mode switch is a global runtime switch consumed by mutually-exclusive `@ConditionalOnProperty(value=\"auth.type\", havingValue=...)` configurations; `AppInfoController` deliberately bypasses that pattern and reads the raw string so it can report the mode rather than react to it." — evidence: AppInfoController.java:18 (`@Value("${auth.type}") final String authType`) vs DisabledAuthSecurityConfiguration.java:10 / LoginFormSecurityConfiguration.java:31 / OAuthSecurityConfiguration.java:71 / LDAPSecurityConfiguration.java:51 (all `@ConditionalOnProperty(value="auth.type", havingValue=...)` constructions). — intent_anchor: the parallel structure across four `*SecurityConfiguration` classes consistently uses `@ConditionalOnProperty`; this controller's single deviation to `@Value` is the reporter-not-reactor pattern. — confidence: HIGH

## bugs_limitations_corner_cases

- "`@Value(\"${auth.type}\")` declares NO default at AppInfoController.java:18. If a deployment overrides `auth.type` to an empty string (e.g. `AUTH_TYPE=` env var, or removing the key from application.yml), Spring injects empty string, this controller constructs and echoes empty string in the AppInfo response, AND every downstream `@ConditionalOnProperty(value=\"auth.type\", havingValue=\"...\")` fails to match — producing a deployment with no `SecurityWebFilterChain` bean. The application.yml default `DISABLED` at line 34 is the only thing preventing this; an operator who unsets the key on purpose hits an undocumented failure mode." — evidence: AppInfoController.java:18 + application.yml:32-34 — severity: MEDIUM

- "No validation that `authType` matches the documented enum `DISABLED | LOGIN_FORM | OAUTH2 | LDAP`. A typo (`OUATH2`) in the property value silently disables auth — every `@ConditionalOnProperty(havingValue=...)` fails to match, no `SecurityWebFilterChain` bean is created, AND `/api/appInfo` echoes the typo back to clients (which the SPA then has no rendering rule for)." — evidence: AppInfoController.java:15-21 (no validation), AuthorizationManagerCondition.java:11,15 (havingValue="OAUTH2" and "LDAP"), DisabledAuthSecurityConfiguration.java:10 (havingValue="DISABLED"), LoginFormSecurityConfiguration.java:31 (havingValue="LOGIN_FORM") — severity: MEDIUM

- "`/api/appInfo` is NOT listed in `SecurityConstants.WHITELIST_PATHS` (only `/actuator/**`, `/favicon.ico`, `/ingestion/**`, `/img/**`, `/api/slack/events` are) and is NOT listed in `SECURITY_RULES`. Under OAUTH2/LDAP modes (which use `AuthorizationCustomizer`), the fall-through is `.pathMatchers(\"/**\").authenticated()`. Under LOGIN_FORM, the fall-through is `.pathMatchers(\"/**\").authenticated()` via `LoginFormSecurityConfiguration.java:57`. Under DISABLED (the application.yml default), `DisabledAuthSecurityConfiguration.java:16` applies `.anyExchange().permitAll()` — so on a default-config deployment, `/api/appInfo` is reachable by any network caller and discloses the deployment's auth mode + project version." — evidence: SecurityConstants.java:95-96 (WHITELIST_PATHS), SecurityConstants.java:98-355 (SECURITY_RULES, /api/appInfo absent), AuthorizationCustomizer.java:22-30 (whitelist + rules + fall-through-authenticated), LoginFormSecurityConfiguration.java:49-57, DisabledAuthSecurityConfiguration.java:13-17 — severity: MEDIUM

- "Response body exposes `projectVersion` from `BuildProperties` alongside `authType` (AppInfoController.java:26-27). Combined with the unauthenticated reachability under `auth.type=DISABLED`, a network attacker can fingerprint (a) the deployment's auth mode (telling them whether to attempt credential stuffing vs. OIDC tampering vs. just walking in) and (b) the precise platform version (telling them which CVEs apply). Neither piece of metadata is documented as a public-disclosure surface in the live docs." — evidence: AppInfoController.java:24-29 + AppInfo.java:22-66 (model fields) — severity: MEDIUM

- "Under `auth.type=DISABLED`, the SPA itself does not need `/api/appInfo` to gate a login UI (there is no login). The endpoint's reason-to-exist is the LOGIN_FORM/OAUTH2/LDAP cases where the SPA needs to know which login flow to render. Whitelisting `/api/appInfo` (so it's reachable BEFORE authentication completes) would be a coherent design choice; today the endpoint just happens to be reachable pre-auth ONLY under DISABLED, and post-auth under the other three modes — but under LOGIN_FORM, the SPA needs the response BEFORE the user has authenticated (to render the form). Verify: does the SPA currently call `/api/appInfo` from a public route, or does it call it after the user has authenticated? If the former, the current configuration must be relying on the request being permitted by some path I have not traced." — evidence: AppInfoController.java:24-29 (endpoint emits authType, used by SPA per AppInfoApi.java:43 description "Gets application info") + LoginFormSecurityConfiguration.java:49-57 (permittedPaths does NOT include /api/appInfo, fall-through is .authenticated()) — severity: MEDIUM (potential broken-UI bug under LOGIN_FORM, OR a missing whitelist entry — either way, undocumented behaviour)

## security

- **auth_mode_relevance**: `DISABLED | LOGIN_FORM | OAUTH2 | LDAP` (this consumer is **relevant to all four modes** — its job is to REPORT which mode is active, so every mode's behaviour is part of this consumer's surface area).
- **ingestion_filter_relevance**: `NO — UI/API surface, not ingestion`. The path `/api/appInfo` is under `/api/**`, not `/ingestion/**`; the S2S ingestion filter is a separate filter that only registers when `auth.s2s.enabled=true` and operates on a different path matcher.
- **authorization_assertions**: []. The controller has no `@PreAuthorize`, no programmatic permission check, and the path `/api/appInfo` is not in `SecurityConstants.SECURITY_RULES`. The generated `AppInfoApi` interface (`AppInfoApi.java:38-80`) also has no `@PreAuthorize` and no `SecurityRequirement` annotation. Authorization-wise the path falls through to whatever the active `SecurityWebFilterChain` decides for "any path not in WHITELIST_PATHS / SECURITY_RULES" — which is `authenticated()` for LOGIN_FORM/OAUTH2/LDAP and `permitAll()` for DISABLED.
- **owner_scoping**: `N/A — code is not data-scoped`. The endpoint returns deployment metadata, not data entities.
- **data_exposure**:
  - "Deployment-level metadata `{projectVersion: String, authType: String}` → any authenticated user under LOGIN_FORM/OAUTH2/LDAP; any caller able to reach the HTTP port under DISABLED (the application.yml default)" — evidence: AppInfoController.java:24-28 + AppInfo.java:22-66 + application.yml:34
  - "Active auth mode (`DISABLED` / `LOGIN_FORM` / `OAUTH2` / `LDAP`) → reveals to network callers WHICH authentication path is the attack surface; under `auth.type=DISABLED` this is unauthenticated and therefore a passive enumeration tool for attackers scanning a network for ODD instances" — evidence: AppInfoController.java:18,27 + DisabledAuthSecurityConfiguration.java:13-18
- **known_security_gaps**:
  - "Under the application.yml default `auth.type=DISABLED` (application.yml:34) the entire HTTP surface — including `/api/appInfo`, which echoes the deployment's auth mode and project version — is `.anyExchange().permitAll()`. Any caller able to reach the platform's HTTP port can read the response, enumerate the deployment, and use the project version to scope CVE matching. The live docs (https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security) name the `auth.type` switch but do not document the introspection surface that `/api/appInfo` provides, nor the implications of leaving `auth.type=DISABLED` on a network-reachable deployment." — evidence: AppInfoController.java:18-29 + application.yml:34 + DisabledAuthSecurityConfiguration.java:13-18 + SecurityConstants.java:95-96 — severity: MEDIUM (LOW per-CVE because the metadata is small; MEDIUM because of LSN-001/LSN-010 case-law: an insecure default in `application.yml` that operators inherit without realising. Aligns with the `enable-security` page's existing warning about `auth.ingestion.filter.enabled` defaulting to `false`)
  - "Empty-string `auth.type` injection (operator unsetting the key) silently produces a deployment with no `SecurityWebFilterChain` bean wired — every `@ConditionalOnProperty(havingValue=...)` fails to match. Whether the resulting deployment fails to start, starts with a default Spring Security chain, or starts with no security at all is not statically determinable from this consumer alone (depends on Spring Boot's autoconfiguration fall-through behaviour). The consumer at AppInfoController.java:18 has no default and no validation, so this failure mode is reachable." — evidence: AppInfoController.java:18 + AuthorizationManagerCondition.java:11,15 + DisabledAuthSecurityConfiguration.java:10 + LoginFormSecurityConfiguration.java:31 — severity: LOW (operator action required to trigger; default application.yml prevents it)
  - "Typo in `auth.type` value (e.g. `OUATH2`, `LOGINFORM`) silently disables ALL `@ConditionalOnProperty(havingValue=...)` matches and produces the same no-`SecurityWebFilterChain` deployment as the empty-string case, with `/api/appInfo` echoing the typo back to clients. No validation, no boot-time fail-fast." — evidence: AppInfoController.java:15-21 + AuthorizationManagerCondition.java:11,15 — severity: LOW (operator action required, but no fail-fast guardrail)

## performance

- **hot_paths**: []. `GET /api/appInfo` is not a hot path; it is called once on SPA load to render the login UI. No DB round-trip, no I/O — pure in-memory field access.
- **throughput_characteristics**:
  - "single-call, single-response — Mono.just(new AppInfo(...)).map(ResponseEntity::ok) — no streaming, no backpressure, no bulk" — evidence: AppInfoController.java:25-28
- **resource_allocation**:
  - "allocates a new AppInfo DTO per request (line 25); no caching" — evidence: AppInfoController.java:25-27 — NOTE: trivial allocation cost
- **scaling_characteristics**:
  - "stateless controller — `authType` is captured at construction (final field, line 15); horizontal scaling is unaffected by this consumer" — evidence: AppInfoController.java:13-21
- **known_performance_gaps**: []

## sources

- understanding ← AppInfoController.java:13-29
- concepts.entities.AppInfo ← AppInfo.java:22-66
- concepts.entities.auth.type ← AppInfoController.java:18 + application.yml:32-34
- concepts.invariants[0] ← AppInfoController.java:15 (`private final String authType`)
- dependencies_semantic.requires-feature.[0] ← DisabledAuthSecurityConfiguration.java:10 + LoginFormSecurityConfiguration.java:31 + OAuthSecurityConfiguration.java:71 + LDAPSecurityConfiguration.java:51
- dependencies_semantic.requires-config.auth.type ← AppInfoController.java:18 + application.yml:34
- dependencies_semantic.requires-runtime.BuildProperties ← AppInfoController.java:6,14,26
- tests_coverage_semantic.test_files ← grep `odd-platform-api/src/test` for `AppInfoController` / `getAppInfo` / `auth.type` returns zero matches (Grep results 2026-05-10)
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication (2026-05-10, 200, navigation page only)
- docs_link_semantic.inferred_docs.[1] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security (2026-05-10, 200, mentions `auth.type (DISABLED / LOGIN_FORM / OAUTH2 / LDAP)` but no `/api/appInfo` coverage)
- docs_link_semantic.doc_drift_findings.[0] ← WebFetch results (2026-05-10) + AppInfoController.java:24-29 + AppInfo.java:22-66
- docs_link_semantic.doc_drift_findings.[1] ← WebFetch enable-security (2026-05-10) + application.yml:34 + DisabledAuthSecurityConfiguration.java:13-18
- docs_link_semantic.doc_drift_findings.[2] ← AppInfoController.java:18 (no @Value default)
- implicit_adrs.[0] ← AppInfoController.java:24-28 + AppInfoApi.java:43 + AppInfo.java:48-66
- implicit_adrs.[1] ← AppInfoController.java:18 vs DisabledAuthSecurityConfiguration.java:10 + LoginFormSecurityConfiguration.java:31 + OAuthSecurityConfiguration.java:71 + LDAPSecurityConfiguration.java:51 + AuthorizationManagerCondition.java:11,15
- bugs_limitations_corner_cases.[0] ← AppInfoController.java:18 + application.yml:32-34
- bugs_limitations_corner_cases.[1] ← AppInfoController.java:15-21 + AuthorizationManagerCondition.java:11,15 + DisabledAuthSecurityConfiguration.java:10 + LoginFormSecurityConfiguration.java:31
- bugs_limitations_corner_cases.[2] ← SecurityConstants.java:95-96 + SecurityConstants.java:98-355 + AuthorizationCustomizer.java:22-30 + LoginFormSecurityConfiguration.java:49-57 + DisabledAuthSecurityConfiguration.java:13-17
- bugs_limitations_corner_cases.[3] ← AppInfoController.java:24-29 + AppInfo.java:22-66
- bugs_limitations_corner_cases.[4] ← AppInfoController.java:24-29 + AppInfoApi.java:43 + LoginFormSecurityConfiguration.java:49-57
- security.auth_mode_relevance ← AppInfoController.java:18,27 (consumer echoes the active mode for all four)
- security.ingestion_filter_relevance ← SecurityConstants.java:95-96 + AppInfoApi.java:61 (`value = "/api/appInfo"`)
- security.authorization_assertions ← AppInfoController.java:13-29 (no @PreAuthorize) + AppInfoApi.java:38-80 (no @PreAuthorize / SecurityRequirement) + SecurityConstants.java:98-355 (no rule for /api/appInfo)
- security.owner_scoping ← AppInfoController.java:24-29 (returns deployment-level metadata, not data)
- security.data_exposure.[0] ← AppInfoController.java:24-28 + AppInfo.java:22-66 + application.yml:34
- security.data_exposure.[1] ← AppInfoController.java:18,27 + DisabledAuthSecurityConfiguration.java:13-18
- security.known_security_gaps.[0] ← AppInfoController.java:18-29 + application.yml:34 + DisabledAuthSecurityConfiguration.java:13-18 + SecurityConstants.java:95-96 + WebFetch enable-security 2026-05-10
- security.known_security_gaps.[1] ← AppInfoController.java:18 + AuthorizationManagerCondition.java:11,15 + DisabledAuthSecurityConfiguration.java:10 + LoginFormSecurityConfiguration.java:31
- security.known_security_gaps.[2] ← AppInfoController.java:15-21 + AuthorizationManagerCondition.java:11,15
- performance.throughput_characteristics.[0] ← AppInfoController.java:25-28
- performance.resource_allocation.[0] ← AppInfoController.java:25-27
- performance.scaling_characteristics.[0] ← AppInfoController.java:13-21

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: MEDIUM (declared docs empty by intent — node has no `@docs` annotation; inferred candidates verified live and confirmed not to cover this surface, so doc-drift findings are HIGH but the inferred-doc mapping itself is best-guess)
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH (each finding cited to file:line; the LOGIN_FORM whitelist question in [4] is flagged MEDIUM because runtime SPA behaviour is not statically determinable)
- security: HIGH
- performance: HIGH

## Maintainer notes


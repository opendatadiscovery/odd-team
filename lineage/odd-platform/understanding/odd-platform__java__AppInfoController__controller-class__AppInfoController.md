---
node_id: "odd-platform java AppInfoController controller-class:AppInfoController"
node_kind: controller-class
axis: controllers
extracted_at_commit: b046994
enriched_at_commit: b046994
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-T
---

# AppInfoController (controller-class) — semantic understanding

## understanding

`AppInfoController` is a 30-line Spring WebFlux `@RestController` implementing the OpenAPI-generated `AppInfoApi` and exposing exactly one endpoint — `GET /api/appInfo` — that returns the deployment's `{projectVersion, authType}` as a JSON object. The controller is a thin REPORTER (not a reactor): it injects `BuildProperties` (Spring Boot's build-info bean) and the `auth.type` configuration value at construction (AppInfoController.java:14-21), then on every request constructs an `AppInfo` DTO from the captured-at-construction values and emits it via `Mono.just(...).map(ResponseEntity::ok)` (lines 24-28). The endpoint exists because the React SPA needs to know the deployment's auth mode at runtime in order to (a) render the project version in the AppToolbar's About-menu (`AppInfoMenu.tsx:37-53`) and (b) conditionally render the OwnerAssociation card on the Overview page only when `authType !== 'DISABLED'` (`Overview.tsx:25-27`). The controller carries no `@PreAuthorize`, no programmatic auth check, and `/api/appInfo` is not in `SecurityConstants.WHITELIST_PATHS` (SecurityConstants.java:95-96) nor in `SecurityConstants.SECURITY_RULES` — it inherits whatever the active `SecurityWebFilterChain` decides for unlisted paths.

## concepts

- entities: ["AppInfo (response DTO — `{projectVersion: String, authType: String}`)", "BuildProperties (Spring Boot build-info bean)", "auth.type configuration key"]
- operations: ["GET /api/appInfo — return deployment meta-info", "inject auth.type as raw String at controller construction (no enum mapping)", "round-trip authType verbatim into response body"]
- invariants: ["controller is stateless — both `buildProperties` and `authType` are `final` fields captured at construction (AppInfoController.java:14-15)", "authType is whatever Spring resolved for `${auth.type}` — NO normalisation, NO enum constraint, NO `@Value` default at the injection site", "the endpoint exposes the active auth mode to clients BY DESIGN — the SPA depends on it to gate rendering (Overview.tsx:26)"]
- audiences: ["odd-platform-ui-end-user (React SPA — AppInfoMenu shows projectVersion; Overview gates OwnerAssociation card on authType !== 'DISABLED')", "any HTTP caller able to reach /api/appInfo under the active SecurityWebFilterChain"]

## dependencies_semantic

- requires-feature: ["the four `@ConditionalOnProperty(value=\"auth.type\", havingValue=...)` security configurations (DisabledAuthSecurityConfiguration.java:10 / LoginFormSecurityConfiguration.java:31 / OAuthSecurityConfiguration.java + LDAPSecurityConfiguration — each decides whether `/api/appInfo` is reachable unauthenticated under that mode"]
- requires-config: ["auth.type — must resolve to a non-empty value at boot; application.yml:32-34 supplies the default `DISABLED`; AppInfoController.java:18 declares NO `@Value` default at the injection site"]
- requires-runtime: ["`BuildProperties` bean (Spring Boot Actuator build-info; only present when `spring-boot-maven-plugin build-info` ran at build time — if missing at boot, controller construction fails with `NoSuchBeanDefinitionException`)", "an active `SecurityWebFilterChain` bean — provided by one of the four `*SecurityConfiguration` classes per the active `auth.type` mode"]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - "behaviour: GET /api/appInfo returns 200 with `{projectVersion, authType}` under each of the four `auth.type` modes"
  - "behaviour: authType field is round-tripped verbatim (no normalisation, no validation against the four-value enum)"
  - "behaviour (security): unauthenticated GET /api/appInfo returns 200 under `auth.type=DISABLED` (application.yml default); returns 302/401 under LOGIN_FORM / OAUTH2 / LDAP"
  - "behaviour (DTO contract): AppInfo response shape stable across releases — a regression that adds a host/SHA/deployment-id field would silently change the surface"
- test_files: []
- gaps: |
    Zero direct test coverage. `grep -rln "AppInfoController\|getAppInfo\|api/appInfo" <odd-platform-repo>/odd-platform-api/src/test` returns no hits. No WebFluxTest, no slice test, no integration test asserts (a) the path security of `/api/appInfo` under each of the four `auth.type` modes, (b) the response shape, or (c) the round-trip behaviour of `authType`. The likeliest regression vectors that today's suite would miss:
    1. A future contributor adds a new field to `AppInfo` containing operator-sensitive metadata (build SHA, hostname, deployment-id, OAuth issuer URI) — no test would catch the expanded disclosure surface.
    2. A future refactor whitelists or removes `/api/appInfo` from the unprotected-paths list, silently changing the LOGIN_FORM/OAUTH2/LDAP behaviour from "must be authenticated to see authType" to "anyone can fingerprint the deployment" (or vice-versa breaking the SPA login flow).
    3. A future change to `Overview.tsx:26` switches the gating logic from `authType !== 'DISABLED'` to something else — no integration test pairs the backend AppInfo contract with the UI's consumption.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security"
    anchor: ""
    rationale: "the security overview page lists the `auth.type` switch + the four-value vocabulary; the natural home for documenting which API endpoints are open vs protected, and the only page where the AppInfo introspection surface would fit"
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
  - url: "https://docs.opendatadiscovery.org/developer-guides/api-reference"
    anchor: ""
    rationale: "the developer-facing API reference hub — the obvious home for a `/api/appInfo` endpoint description if one existed"
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
- fetched_excerpts: |
    From `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security` (WebFetched 2026-05-20, status 200): the page describes the `auth.type` configuration flag and its four values (DISABLED / LOGIN_FORM / OAUTH2 / LDAP) but does NOT mention `/api/appInfo`, the AppInfo endpoint, `authType` in a response surface, or any HTTP-level mechanism by which the UI discovers the active auth mode at runtime.
    From `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication` (WebFetched 2026-05-20, status 200): no mention of `/api/appInfo`, `AppInfo`, `appInfo`, or `authType` in a runtime-discovery context.
    From `https://docs.opendatadiscovery.org/developer-guides/api-reference` (WebFetched 2026-05-20, status 200): the page enumerates per-feature API endpoints (Alerts / Data Collaboration / Directory / Glossary / Integrations / Lineage / Query Examples / Reference Data / Relationships) but does NOT list `/api/appInfo` or an `appInfo` tag.
- doc_drift_findings:
  - "Live docs (enable-security, authentication, developer-guides/api-reference) do not document the `/api/appInfo` endpoint's existence, its response shape `{projectVersion, authType}`, or the fact that the response echoes the active auth mode. The endpoint is part of the published OpenAPI contract (openapi.yaml:2704-2717, `operationId: getAppInfo`, tag `appInfo`) but absent from the operator-facing docs."
  - "Live docs do not warn that under the `application.yml:34` default `auth.type=DISABLED`, `/api/appInfo` is reachable by unauthenticated network callers and discloses both the active auth mode AND the precise project version — a passive fingerprinting surface for any attacker scanning for ODD instances."
  - "Live docs do not state that the UI's runtime auth-mode discovery relies on this endpoint, nor that the Overview page's OwnerAssociation card visibility (`Overview.tsx:26` — `appInfo?.authType && appInfo.authType !== 'DISABLED'`) is gated on the round-tripped value — meaning that a deployment with a malformed `auth.type` value silently hides the OwnerAssociation card."

## implicit_adrs

- "AppInfo response intentionally exposes the active auth mode to clients so the React SPA can render auth-mode-dependent UI without a prior authentication round-trip." — evidence: AppInfoController.java:24-28 (`getAppInfo` returns `new AppInfo().projectVersion(...).authType(authType)`) + Overview.tsx:25-27 (`appInfo?.authType && appInfo.authType !== 'DISABLED'` gates `OwnerAssociation` rendering) — intent_anchor: the OpenAPI contract at `openapi.yaml:2704-2717` declares `operationId: getAppInfo` returning the `AppInfo` schema where `authType: string` is a first-class property (`components.yaml:2493-2499`); the field is part of the published wire contract, not an accidental leak. The UI's `Overview.tsx:26` confirms the SPA depends on this surface for rendering decisions. — confidence: HIGH

- "The controller is a REPORTER not a REACTOR — it reads `auth.type` as a raw `String` via `@Value` while every other consumer of the same key uses `@ConditionalOnProperty(value=\"auth.type\", havingValue=...)` for runtime branching. This is deliberate: the controller's job is to REPORT which mode is active, not to behave differently under different modes." — evidence: AppInfoController.java:18 (`@Value("${auth.type}") final String authType`) contrasted with DisabledAuthSecurityConfiguration.java:10 (`@ConditionalOnProperty(value=\"auth.type\", havingValue=\"DISABLED\")`) + LoginFormSecurityConfiguration.java:31 (`havingValue=\"LOGIN_FORM\"`) + AuthorizationManagerCondition.java:11,15 (`havingValue=\"OAUTH2\"` / `havingValue=\"LDAP\"`) — intent_anchor: the parallel structure across four `*SecurityConfiguration` classes ALL use `@ConditionalOnProperty`; this controller's single deviation to `@Value` is consistent with reading-not-reacting. — confidence: HIGH

- "AppInfo deliberately surfaces ONLY the auth-mode string and the project version — NO OAuth provider name, NO LDAP server URI, NO issuer URL, NO build SHA, NO hostname. The Identity surface (`IdentityController` whoami) also surfaces NO `provider` field (only `username` and `permissions`). Together these are the two endpoints the SPA hits for runtime configuration discovery, and the contract is consistent across them: mode is exposed, provider-level detail is NOT." — evidence: AppInfoController.java:24-28 (only `projectVersion` + `authType`) + components.yaml:2493-2499 (AppInfo schema — only the two fields) + IdentityController.java:24-33 (whoami returns `AssociatedOwner.identity` — `Identity` has `username` + `permissions`, no `provider`) — intent_anchor: the two endpoints together encode a deliberate "expose mode, hide provider" contract; F-011's drift-class enumeration includes `ui_identity_render_has_no_provider_field_positive_negative_no_leak` confirming the IdentityController side is intentional. — confidence: HIGH

## bugs_limitations_corner_cases

- "`@Value(\"${auth.type}\")` declares NO default at AppInfoController.java:18. If an operator overrides `auth.type` to an empty string (e.g. `AUTH_TYPE=` env var override or removing the key from application.yml), Spring injects empty string. The controller still constructs and echoes empty string in the AppInfo response, AND every downstream `@ConditionalOnProperty(value=\"auth.type\", havingValue=\"...\")` fails to match — producing a deployment with NO `SecurityWebFilterChain` bean wired. The `application.yml:34` default `DISABLED` is the only thing preventing this; an operator who unsets the key hits an undocumented silent failure mode. Compounded by `Overview.tsx:26` — `appInfo?.authType && appInfo.authType !== 'DISABLED'` evaluates to `false` for empty string, silently hiding the OwnerAssociation card." — evidence: AppInfoController.java:18 + application.yml:32-34 + Overview.tsx:25-27 — severity: MEDIUM

- "No validation that `authType` matches the documented enum `DISABLED | LOGIN_FORM | OAUTH2 | LDAP`. A typo (`OUATH2`, `LOGINFORM`) silently disables ALL `@ConditionalOnProperty(havingValue=...)` matches and produces the same no-`SecurityWebFilterChain` deployment as the empty-string case. Meanwhile `/api/appInfo` continues to echo the typo back to clients. Combined with `Overview.tsx:26`'s `!== 'DISABLED'` check, a typo passes the gate and renders OwnerAssociation in a deployment that has no working authentication." — evidence: AppInfoController.java:15-21 (no validation), AuthorizationManagerCondition.java:11,15 (havingValue=\"OAUTH2\" / \"LDAP\"), DisabledAuthSecurityConfiguration.java:10 (havingValue=\"DISABLED\"), LoginFormSecurityConfiguration.java:31 (havingValue=\"LOGIN_FORM\"), Overview.tsx:25-27 — severity: MEDIUM

- "`/api/appInfo` is absent from `SecurityConstants.WHITELIST_PATHS` (only `/actuator/**`, `/favicon.ico`, `/ingestion/**`, `/img/**`, `/api/slack/events` — SecurityConstants.java:95-96) AND from `SECURITY_RULES`. Under LOGIN_FORM / OAUTH2 / LDAP the path falls through to `.pathMatchers(\"/**\").authenticated()` (LoginFormSecurityConfiguration.java:57). Under DISABLED, `DisabledAuthSecurityConfiguration.java:13-18` applies `.anyExchange().permitAll()` — so on a default-config deployment, `/api/appInfo` IS reachable by any network caller, disclosing both the auth mode and the project version. Under LOGIN_FORM the SPA fetch happens AFTER auth-cookie acquisition, so the SPA flow works, but at the cost of revealing auth-mode + version to every authenticated user (which is benign), AND to anyone who can reach the platform's HTTP port unauthenticated under DISABLED (which is the actual exposure)." — evidence: SecurityConstants.java:95-96 + SecurityConstants.java:98-355 (no rule for /api/appInfo) + LoginFormSecurityConfiguration.java:49-57 + DisabledAuthSecurityConfiguration.java:13-18 — severity: MEDIUM

- "Response body exposes `projectVersion` from `BuildProperties` alongside `authType` (AppInfoController.java:26-27). Combined with unauthenticated reachability under `auth.type=DISABLED`, a network attacker can fingerprint (a) the deployment's auth mode (telling them whether to attempt credential stuffing vs OIDC tampering vs walking in unauthenticated) AND (b) the precise platform version (scoping CVE matching to known-vulnerable releases). Neither piece of metadata is documented as a public-disclosure surface in the live docs (https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security WebFetched 2026-05-20)." — evidence: AppInfoController.java:24-29 + components.yaml:2493-2499 — severity: MEDIUM

- "Endpoint has no caching directives, no `@Cacheable`, no ETag, no HTTP cache headers. On a deployment with N clients (browser tabs), the SPA's `useAppInfo` query is React-Query-cached at the client (appInfo.ts:4-9), but each fresh page load fires a new request that constructs a new `AppInfo` DTO server-side. The cost is trivial per call (in-memory field access, no DB round-trip), but the absence of a cache header means CDNs / reverse proxies cannot cache the response either." — evidence: AppInfoController.java:24-29 (no cache annotations) + appInfo.ts:4-9 (React-Query client cache only) — severity: LOW

## security

- **auth_mode_relevance**: `DISABLED | LOGIN_FORM | OAUTH2 | LDAP` — this controller is **relevant to all four modes**. Its job is to REPORT which mode is active to the SPA, so every mode's behaviour is part of its surface area. Under DISABLED the endpoint is anonymously reachable (`DisabledAuthSecurityConfiguration.java:13-18` applies `.anyExchange().permitAll()`); under the other three modes the endpoint requires authentication (LoginFormSecurityConfiguration.java:49-57 fall-through to `.authenticated()`).
- **ingestion_filter_relevance**: `NO — UI/API surface, not ingestion`. The path `/api/appInfo` is under `/api/**`, not `/ingestion/**`. The S2S ingestion filter (`IngestionDataEntitiesFilter`) registers only when `auth.ingestion.filter.enabled=true` and operates on a `/ingestion/entities` path matcher.
- **authorization_assertions**: []. The controller has no `@PreAuthorize`, no programmatic `permissionService.hasPermission(...)` call, and the path `/api/appInfo` is not listed in `SecurityConstants.SECURITY_RULES`. The generated `AppInfoApi` interface (imported at AppInfoController.java:3) has no `@PreAuthorize` and no `SecurityRequirement` annotation per the OpenAPI tag definition (`openapi.yaml:2704-2717` lists no `security` element). Authorization is delegated entirely to the active `SecurityWebFilterChain`'s fall-through rule.
- **owner_scoping**: `N/A — code is not data-scoped`. The endpoint returns deployment-level metadata, not data entities. There is no owner concept for "the deployment's project version" or "the deployment's auth mode".
- **data_exposure**:
  - "Deployment metadata `{projectVersion: String, authType: String}` → any authenticated user under LOGIN_FORM / OAUTH2 / LDAP; ANY caller able to reach the HTTP port under DISABLED (the application.yml default)" — evidence: AppInfoController.java:24-28 + components.yaml:2493-2499 + application.yml:34 + DisabledAuthSecurityConfiguration.java:13-18
  - "Active auth mode (`DISABLED` / `LOGIN_FORM` / `OAUTH2` / `LDAP`) → reveals to network callers WHICH authentication path is the attack surface; under `auth.type=DISABLED` this is unauthenticated and therefore a passive enumeration tool for attackers scanning networks for ODD deployments" — evidence: AppInfoController.java:18,27 + DisabledAuthSecurityConfiguration.java:13-18
  - "Project version → enables CVE-scoping for attackers: knowing the precise version tells them which CVEs in the Spring Boot / WebFlux / Reactor / R2DBC / Postgres-driver / OAuth-client chains apply to THIS deployment" — evidence: AppInfoController.java:14,19,26 (`BuildProperties::getVersion`)
  - "Notable NON-disclosure: AppInfo does NOT expose the OAuth provider name, the LDAP server URI, the issuer URL, the build SHA, or the hostname. Paired with `IdentityController.whoami` (which also has no `provider` field per `IdentityController.java:24-33` + `Identity` model) the SPA's runtime config surface deliberately exposes mode-but-not-provider." — evidence: AppInfoController.java:24-28 + components.yaml:2493-2499 + IdentityController.java:24-33
- **known_security_gaps**:
  - "Under the application.yml default `auth.type=DISABLED` (`application.yml:34`) the entire HTTP surface — including `/api/appInfo`, which echoes the deployment's auth mode AND project version — is `.anyExchange().permitAll()` (`DisabledAuthSecurityConfiguration.java:13-18`). Any caller able to reach the platform's HTTP port can read the response, enumerate the deployment, and use the project version to scope CVE matching. The live docs (`https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security` WebFetched 2026-05-20) name the `auth.type` switch but do NOT document the introspection surface that `/api/appInfo` provides, nor warn about the fingerprinting risk under DISABLED. **This is the 19th supporting sidecar for REFACTOR-185 (DISABLED-mode bypass)** — the controller-class layer view of a surface batch B already cited at the config-key-consumer-axis layer." — evidence: AppInfoController.java:18-29 + application.yml:34 + DisabledAuthSecurityConfiguration.java:13-18 + SecurityConstants.java:95-96 + WebFetch results 2026-05-20 — severity: MEDIUM
  - "`/api/appInfo` is the simplest network-reachable fingerprint endpoint in the platform — no body, no auth, returns two strings. An attacker scanning a port range for ODD instances under DISABLED gets BOTH (a) confirmation it's ODD (`projectVersion` is the give-away — the field name + the version string format are ODD-specific) AND (b) the precise version + auth mode in a single GET. Compared with hitting `/actuator/info` (whitelisted) or `/` (returns SPA HTML), `/api/appInfo` is the highest-signal-density fingerprint." — evidence: AppInfoController.java:24-28 + SecurityConstants.java:95-96 (actuator+favicon+ingestion+img+slack-events are whitelisted; /api/appInfo is NOT but is still reachable under DISABLED) — severity: MEDIUM
  - "Empty-string or typo'd `auth.type` injection (operator action) silently produces a deployment with NO `SecurityWebFilterChain` bean wired — every `@ConditionalOnProperty(havingValue=...)` fails to match. Behaviour of the no-chain deployment is not statically determinable (depends on Spring Boot's autoconfiguration fall-through). AppInfoController.java:18 has no `@Value` default, no validation, and no boot-time fail-fast." — evidence: AppInfoController.java:18 + AuthorizationManagerCondition.java:11,15 + DisabledAuthSecurityConfiguration.java:10 + LoginFormSecurityConfiguration.java:31 — severity: LOW (operator action required to trigger)

## performance

- **hot_paths**: []. `GET /api/appInfo` is not a hot path. The SPA fires it once per page load and React-Query caches it client-side (appInfo.ts:4-9). The two server-side consumers (`AppInfoMenu.tsx`, `Overview.tsx`) share the React-Query cache key `['appInfo']` so the call is deduplicated. No DB round-trip, no I/O.
- **throughput_characteristics**:
  - "single-call, single-response — `Mono.just(new AppInfo(...)).map(ResponseEntity::ok)` — no streaming, no backpressure, no bulk" — evidence: AppInfoController.java:25-28
- **resource_allocation**:
  - "allocates a new `AppInfo` DTO per request (line 25); no server-side caching of the DTO instance" — evidence: AppInfoController.java:25-27 — NOTE: trivial allocation cost; the `authType` and `projectVersion` strings are captured at construction so the DTO fields are references to pre-allocated strings
  - "no HTTP cache headers, no ETag — CDN / reverse-proxy cannot cache the response; only the client-side React-Query cache deduplicates" — evidence: AppInfoController.java:24-29 (no `@CacheControl`, no manual header setting)
- **scaling_characteristics**:
  - "stateless controller — both `buildProperties` and `authType` are `final` fields captured at construction (AppInfoController.java:14-15); horizontal scaling is unaffected by this controller. The shipped `projectVersion` and `authType` will be identical across replicas of the same deployment." — evidence: AppInfoController.java:13-21
- **known_performance_gaps**: []

## sources

- understanding ← AppInfoController.java:1-30
- concepts.entities.AppInfo ← AppInfoController.java:4,25-27 + components.yaml:2493-2499
- concepts.entities.BuildProperties ← AppInfoController.java:6,14,26
- concepts.invariants[0] ← AppInfoController.java:14-15 (`final BuildProperties buildProperties; final String authType`)
- concepts.invariants[1] ← AppInfoController.java:18 + AuthorizationManagerCondition.java:11,15 (no normalisation between consumer points)
- concepts.invariants[2] ← AppInfoController.java:24-28 + Overview.tsx:25-27
- concepts.audiences ← AppInfoMenu.tsx:17,37-53 + Overview.tsx:8,24-27 + lib/hooks/api/appInfo.ts:4-9
- dependencies_semantic.requires-feature.[0] ← DisabledAuthSecurityConfiguration.java:10 + LoginFormSecurityConfiguration.java:31 + AuthorizationManagerCondition.java:11,15
- dependencies_semantic.requires-config.[0] ← AppInfoController.java:18 + application.yml:32-34
- dependencies_semantic.requires-runtime.[0] ← AppInfoController.java:6,14,26 (BuildProperties from `org.springframework.boot.info`)
- dependencies_semantic.requires-runtime.[1] ← DisabledAuthSecurityConfiguration.java:13-18 + LoginFormSecurityConfiguration.java:39-59
- tests_coverage_semantic.test_files ← grep `AppInfoController|getAppInfo|api/appInfo` in `<odd-platform-repo>/odd-platform-api/src/test` returns 0 hits (2026-05-20)
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security (2026-05-20, 200, no /api/appInfo coverage)
- docs_link_semantic.inferred_docs.[1] ← WebFetch https://docs.opendatadiscovery.org/developer-guides/api-reference (2026-05-20, 200, no /api/appInfo listed)
- docs_link_semantic.doc_drift_findings.[0] ← WebFetch results (2026-05-20) + openapi.yaml:2704-2717 + components.yaml:2493-2499
- docs_link_semantic.doc_drift_findings.[1] ← WebFetch enable-security (2026-05-20) + application.yml:34 + DisabledAuthSecurityConfiguration.java:13-18
- docs_link_semantic.doc_drift_findings.[2] ← Overview.tsx:25-27 + AppInfoController.java:18 (no enum validation)
- implicit_adrs.[0] ← AppInfoController.java:24-28 + Overview.tsx:25-27 + openapi.yaml:2704-2717 + components.yaml:2493-2499
- implicit_adrs.[1] ← AppInfoController.java:18 + DisabledAuthSecurityConfiguration.java:10 + LoginFormSecurityConfiguration.java:31 + AuthorizationManagerCondition.java:11,15
- implicit_adrs.[2] ← AppInfoController.java:24-28 + components.yaml:2493-2499 + IdentityController.java:24-33 + F-011.yaml:29 (`ui_identity_render_has_no_provider_field_positive_negative_no_leak`)
- bugs_limitations_corner_cases.[0] ← AppInfoController.java:18 + application.yml:32-34 + Overview.tsx:25-27
- bugs_limitations_corner_cases.[1] ← AppInfoController.java:15-21 + AuthorizationManagerCondition.java:11,15 + DisabledAuthSecurityConfiguration.java:10 + LoginFormSecurityConfiguration.java:31 + Overview.tsx:25-27
- bugs_limitations_corner_cases.[2] ← SecurityConstants.java:95-96 + SecurityConstants.java:98-355 + LoginFormSecurityConfiguration.java:49-57 + DisabledAuthSecurityConfiguration.java:13-18
- bugs_limitations_corner_cases.[3] ← AppInfoController.java:24-29 + components.yaml:2493-2499 + WebFetch 2026-05-20 enable-security (no public-disclosure documentation)
- bugs_limitations_corner_cases.[4] ← AppInfoController.java:24-29 (no cache annotations) + lib/hooks/api/appInfo.ts:4-9 (client-side React-Query cache only)
- security.auth_mode_relevance ← AppInfoController.java:18,27 + DisabledAuthSecurityConfiguration.java:13-18 + LoginFormSecurityConfiguration.java:49-57
- security.ingestion_filter_relevance ← openapi.yaml:2704 (path `/api/appInfo`) + SecurityConstants.java:95-96 (WHITELIST_PATHS — `/ingestion/**` is separate)
- security.authorization_assertions ← AppInfoController.java:13-29 (no @PreAuthorize) + openapi.yaml:2704-2717 (no `security` element) + SecurityConstants.java:98-355 (no rule for /api/appInfo)
- security.owner_scoping ← AppInfoController.java:24-29 (returns deployment-level metadata, not data)
- security.data_exposure.[0] ← AppInfoController.java:24-28 + components.yaml:2493-2499 + application.yml:34 + DisabledAuthSecurityConfiguration.java:13-18
- security.data_exposure.[1] ← AppInfoController.java:18,27 + DisabledAuthSecurityConfiguration.java:13-18
- security.data_exposure.[2] ← AppInfoController.java:14,19,26 (BuildProperties::getVersion)
- security.data_exposure.[3] ← AppInfoController.java:24-28 + components.yaml:2493-2499 + IdentityController.java:24-33
- security.known_security_gaps.[0] ← AppInfoController.java:18-29 + application.yml:34 + DisabledAuthSecurityConfiguration.java:13-18 + SecurityConstants.java:95-96 + WebFetch 2026-05-20 + REFACTOR-185 (18-sidecar at batch P, this is the 19th — controller-class layer)
- security.known_security_gaps.[1] ← AppInfoController.java:24-28 + SecurityConstants.java:95-96 + DisabledAuthSecurityConfiguration.java:13-18
- security.known_security_gaps.[2] ← AppInfoController.java:18 + AuthorizationManagerCondition.java:11,15 + DisabledAuthSecurityConfiguration.java:10 + LoginFormSecurityConfiguration.java:31
- performance.throughput_characteristics.[0] ← AppInfoController.java:25-28
- performance.resource_allocation.[0] ← AppInfoController.java:25-27
- performance.resource_allocation.[1] ← AppInfoController.java:24-29 + lib/hooks/api/appInfo.ts:4-9
- performance.scaling_characteristics.[0] ← AppInfoController.java:13-21

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (grep result is definitive — no tests exist)
- docs_link_semantic: MEDIUM (declared docs empty by design — no `@docs` annotation; inferred candidates verified live and confirmed not to cover this surface; doc-drift findings are HIGH-confidence)
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH

## Maintainer notes

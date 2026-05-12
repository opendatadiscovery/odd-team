---
node_id: "odd-platform java DisabledAuthSecurityConfiguration config-key-consumer:auth.type@L10"
node_kind: config-key-consumer
axis: config_prefixes
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-12-C
---

# DisabledAuthSecurityConfiguration.auth.type@L10 — semantic understanding

## understanding

This `@ConditionalOnProperty(value="auth.type", havingValue="DISABLED")` annotation gates the entire `DisabledAuthSecurityConfiguration` `@Configuration` class — when `auth.type=DISABLED` is set, Spring registers exactly ONE bean (`securityWebFilterChainDisabled`) which builds a reactive `SecurityWebFilterChain` with `.csrf(...disable)` and `.authorizeExchange(... .anyExchange().permitAll())`. There is no `.cors(...)`, no `.oauth2Login(...)`, no `.formLogin(...)`, no `.logout(...)`, no `.securityMatcher(...)`, no `S2sAuthenticationFilter` wiring, no `AuthorizationCustomizer`, no `@EnableWebFluxSecurity` annotation, no `@Slf4j` boot warning — it is the shortest of the four `*SecurityConfiguration` siblings (19 lines vs LoginForm ~105 / OAuth ~140 / LDAP ~155). Behaviourally this means: when `auth.type=DISABLED` (the application.yml-shipped default — see `application.yml:34`), the platform serves every HTTP path under `/**` to every network caller with no authentication, no authorization, no CSRF protection, and no CORS configuration. The annotation has no `matchIfMissing`, so an operator who unsets `auth.type` produces no `SecurityWebFilterChain` from THIS bean (a different failure mode — see `bugs_limitations_corner_cases`).

## concepts

- entities: ["DisabledAuthSecurityConfiguration (the @Configuration class)", "securityWebFilterChainDisabled (the single bean it produces)", "ServerHttpSecurity (Spring's reactive security DSL builder)", "auth.type configuration key"]
- operations: ["gate-class-instantiation-on-auth.type=DISABLED", "build-permit-all-SecurityWebFilterChain", "disable-CSRF-protection"]
- invariants: ["bean is conditional — only created when auth.type=DISABLED exactly (no matchIfMissing; no case-insensitive match)", "the produced chain matches all exchanges (no .securityMatcher() narrowing), so every HTTP path through the reactive stack is permitAll()", "no S2S filter is ever added in this configuration — unlike LoginForm/OAuth/LDAP which conditionally addFilterAt(s2sAuthenticationFilter, HTTP_BASIC) when auth.s2s.enabled=true; under DISABLED, an operator who sets auth.s2s.enabled=true gets the property accepted but NO filter wired"]
- audiences: ["Spring container at bean-registration time", "any HTTP caller able to reach the platform's network port when auth.type=DISABLED — i.e. every caller, with no further gate"]

## dependencies_semantic

- requires-feature: ["the application.yml-shipped default auth.type=DISABLED (`application.yml:34`) — without this default OR an explicit operator override, the bean is not registered and no `SecurityWebFilterChain` for the reactive stack is created from this class"]
- requires-config: ["auth.type — must equal the literal string `DISABLED` for this configuration to activate; no `matchIfMissing=true` clause, so an unset/empty/typo'd value silently fails to register the bean (`DisabledAuthSecurityConfiguration.java:10`)"]
- requires-runtime: ["Spring Boot autoconfiguration's `@ConditionalOnProperty` infrastructure", "reactive-stack Spring Security (spring-security-config + spring-webflux on the classpath) so the `SecurityWebFilterChain` bean type is recognised — note this class does NOT declare `@EnableWebFluxSecurity` itself; it relies on Spring Boot autoconfiguration to enable reactive security when WebFlux + Spring Security are on the classpath"]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - "behaviour: bean materialises only when auth.type=DISABLED (verified via @ConditionalOnProperty — but no test asserts this)"
  - "behaviour: under auth.type=DISABLED, an unauthenticated HTTP request to ANY path returns 2xx/4xx based on application logic alone — no 302/401 redirect to login"
  - "behaviour: under auth.type=DISABLED with auth.s2s.enabled=true, the S2sAuthenticationFilter is NOT wired (this configuration ignores the s2s flag) — so an operator who explicitly enables S2S thinking they get an additional filter, but runs DISABLED mode simultaneously, gets no filter"
  - "behaviour: CSRF protection is disabled — POST/PUT/DELETE requests without CSRF tokens succeed"
  - "behaviour: no CORS configuration is applied at the filter chain level — so cross-origin requests from any browser-rendered origin reach the application and either succeed (preflight OPTIONS treated as a regular permitAll exchange) or are governed by Spring Boot's default WebFlux CORS handling (if any)"
  - "behaviour: missing `auth.type` (empty string, unset, typo) silently fails to register this bean AND every sibling — producing a deployment with no user-defined `SecurityWebFilterChain` for the reactive stack"
- test_files: []
- gaps: |
    Zero test coverage for this configuration class. Greps under `<odd-platform>/odd-platform-api/src/test` for `DisabledAuthSecurityConfiguration` and `auth.type=DISABLED` and `"DISABLED"` (as a test argument) returned no matches on 2026-05-12. The four `*SecurityConfiguration` classes between them implement the entire platform-level security posture, and the test suite asserts no end-to-end behaviour for any mode — a future change that (a) accidentally restricts the `securityWebFilterChainDisabled` bean (e.g. adds a `.securityMatcher("/api/**")` thinking actuator must be excluded), (b) accidentally swaps `.permitAll()` for `.authenticated()` thinking the DSL changed semantics, or (c) removes the bean entirely thinking DISABLED can be a no-op (relying on Spring Boot's default reactive-security autoconfiguration) would not be caught by the unit test suite.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/disabled-authentication"
    anchor: ""
    rationale: "This is the dedicated sub-page for DISABLED mode on the live docs (verified via WebFetch 2026-05-12). It is the canonical maintainer-facing home for documenting what this configuration class does at runtime."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security"
    anchor: ""
    rationale: "The enable-security overview page lists `auth.type` and its values (DISABLED / LOGIN_FORM / OAUTH2 / LDAP) and frames the UI/API vs ingestion surfaces — the parent of the dedicated DISABLED sub-page."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication"
    anchor: ""
    rationale: "The Authentication navigation page listing the four auth.type modes; the immediate parent of the disabled-authentication sub-page."
    last_verified_at: "2026-05-12T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
- fetched_excerpts: |
    From WebFetch of `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/disabled-authentication` on 2026-05-12 (status 200), FULL page body:

    Heading: "Disabled authentication"

    Body paragraph (verbatim): "ODD Platform allows to disable authentication at all. This is useful when you want to deploy platform locally and don't need any security configured. This is the default configuration and no additional settings are required."

    YAML example:
        auth:
            type: DISABLED

    Environment variable example: AUTH_TYPE=DISABLED

    Warning admonition (verbatim): "DO NOT use this method in your production environment!"

    The page does NOT mention: actuator endpoint behaviour, CORS handling, audit logging, the absence of CSRF protection, the absence of an S2S filter even when auth.s2s.enabled=true, the fact that `/api/appInfo` echoes the auth mode to any caller under DISABLED (per the batch-B `AppInfoController` sidecar), or any specific HTTP-path posture beyond the implicit "permit-all" framing.

    From WebFetch of `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security` on 2026-05-12 (status 200):
    > "auth.type (DISABLED / LOGIN_FORM / OAUTH2 / LDAP)" — main config table.
    > "Unauthenticated under auth.type = DISABLED" — appears in the row for ingestion paths.
    The page does NOT discuss actuator security, CORS, or audit logging.

    From WebFetch of `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication` on 2026-05-12 (status 200):
    The page is a navigation table-of-contents listing the four mode sub-pages plus S2S; it carries no per-mode body content. Does NOT state the default auth.type value.

- doc_drift_findings:
  - "Live `disabled-authentication` page declares DISABLED `is the default configuration` (verbatim) and warns `DO NOT use this method in your production environment!` — but does NOT enumerate the actual blast radius of DISABLED: no authentication, no authorization, no CSRF protection, no CORS configuration, the `/actuator/health|prometheus|env|info` endpoints reachable per `application.yml:226-240`, no audit logging (no audit-logging hooks exist anywhere in `<odd-platform-api>/src/main/java` — verified via grep on 2026-05-12)."
  - "Live `disabled-authentication` page does NOT mention that under DISABLED the `auth.s2s.enabled=true` flag is silently ignored — the S2sAuthenticationFilter is wired in LoginForm/OAuth/LDAP only (`LoginFormSecurityConfiguration.java:61-63`, `OAuthSecurityConfiguration.java:108-110`, `LDAPSecurityConfiguration.java:149-151`); `DisabledAuthSecurityConfiguration.java:14-17` does not even read the s2s flag. An operator who runs DISABLED + auth.s2s.enabled=true (e.g. for a local dev setup mimicking prod ingestion) gets the property accepted by Spring with no warning, no log, and no behaviour change."
  - "Live `enable-security` parent page and the `disabled-authentication` sub-page name DISABLED as 'the default configuration' but do NOT surface the precise consequence: that an out-of-the-box `docker run` / helm install / unmodified `application.yml` produces a deployment where every API endpoint (including `/api/appInfo`, `/api/dataentities/*`, `/api/datasources`, `/api/users/me`, etc.) is reachable by every network caller. The 'dev-only' framing relies on the operator inferring the consequence from the warning."
  - "The four `*SecurityConfiguration` classes use `@ConditionalOnProperty` without `matchIfMissing=true`. The live docs do not document the missing-key failure mode: setting `auth.type` to empty string (or omitting it after overriding the bundled application.yml) silently fails to register any of the four `SecurityWebFilterChain` beans, leaving the platform's reactive HTTP surface governed by Spring Boot's autoconfiguration fall-through (which is itself permit-all in a reactive context without a user-defined chain) — verified by reading all four config files: `DisabledAuthSecurityConfiguration.java:10`, `LoginFormSecurityConfiguration.java:31`, `OAuthSecurityConfiguration.java:71`, `LDAPSecurityConfiguration.java:51`."

## implicit_adrs

- "DISABLED is the application.yml-shipped default for auth.type and the operator opt-out, not opt-in, of platform security. Evidence of intent: `application.yml:32-34` declares `auth: # DISABLED, LOGIN_FORM, OAUTH2, LDAP\n  type: DISABLED` — the comment lists all four documented values and the default is explicitly DISABLED. The live `disabled-authentication` page corroborates the design intent verbatim: 'This is the default configuration and no additional settings are required.'" — evidence: application.yml:32-34 + WebFetch disabled-authentication 2026-05-12 — intent_anchor: "# DISABLED, LOGIN_FORM, OAUTH2, LDAP\n  type: DISABLED" + live-doc verbatim "This is the default configuration" — confidence: HIGH

- "The DISABLED mode is intentionally a stripped-down permit-all chain — no CSRF, no CORS, no S2S filter wiring, no authorization wiring, no security matcher narrowing — rather than 'no SecurityWebFilterChain bean at all'. Evidence of intent: the bean exists and explicitly calls `.csrf(...disable)` followed by `.anyExchange().permitAll()` (`DisabledAuthSecurityConfiguration.java:14-17`). A 'no bean' approach would have produced the same runtime behaviour (Spring Boot autoconfigures a permit-all reactive chain when none is user-defined), so the maintainer chose to author an explicit chain to make the DISABLED posture STATEMENT-of-intent rather than emergent behaviour. This is a deliberate signal-vs-default-fallthrough choice." — evidence: DisabledAuthSecurityConfiguration.java:13-18 — intent_anchor: ".csrf(ServerHttpSecurity.CsrfSpec::disable) .authorizeExchange(authorizeExchangeSpec -> authorizeExchangeSpec.anyExchange().permitAll())" — confidence: MEDIUM (the choice is observable in the explicit-chain construction; the explicit motivation is not stated in a comment, but the maintainer authoring a bean instead of relying on fallthrough is itself the evidence)

- "All four `*SecurityConfiguration` classes are mutually exclusive by `@ConditionalOnProperty(value=\"auth.type\", havingValue=\"...\")` without `matchIfMissing`. The design is 'pick exactly one of four modes, otherwise nothing wires' — a mode selection by enumeration, not by chain composition. Evidence: the parallel structure across `DisabledAuthSecurityConfiguration.java:10`, `LoginFormSecurityConfiguration.java:31`, `OAuthSecurityConfiguration.java:71`, `LDAPSecurityConfiguration.java:51`. This is the same pattern documented in the batch-B `AuthorizationManagerCondition` sidecar: the AuthorizationManagerCondition class itself was authored as the OAUTH2-OR-LDAP composite gate. The intent is enum-style mode selection at the bean-registration layer." — evidence: DisabledAuthSecurityConfiguration.java:10 + LoginFormSecurityConfiguration.java:31 + OAuthSecurityConfiguration.java:71 + LDAPSecurityConfiguration.java:51 — intent_anchor: four parallel `@ConditionalOnProperty(value = "auth.type", havingValue = "...")` annotations consistently authored across the four sibling files — confidence: HIGH

## bugs_limitations_corner_cases

- "Under DISABLED the bean has no `.cors(...)` call — unlike OAuth (`OAuthSecurityConfiguration.java:95` `.cors(withDefaults())`) and LDAP (`LDAPSecurityConfiguration.java:142` `.cors(Customizer.withDefaults())`). Because there is no global `CorsWebFilter` / `CorsConfigurationSource` bean anywhere in `<odd-platform-api>/src/main/java` (verified via grep on 2026-05-12), CORS handling under DISABLED falls back to Spring WebFlux's default — preflight OPTIONS requests are matched by `.anyExchange().permitAll()` and returned as a 200 with no `Access-Control-*` response headers from a security layer. Cross-origin browser callers either succeed (because no auth gate) or are silently denied at the browser layer (because no CORS approval) — inconsistent with what the other three modes ship. Severity is LOW because DISABLED is dev-only per docs; but the inconsistency-across-modes is a structural smell." — evidence: DisabledAuthSecurityConfiguration.java:13-18 + OAuthSecurityConfiguration.java:95 + LDAPSecurityConfiguration.java:142 + grep result on 2026-05-12 (no CORS bean) — severity: LOW

- "No `@Slf4j` log statement, no boot-time `log.warn(...)` indicating 'auth.type=DISABLED — running without authentication' is emitted by this class (`DisabledAuthSecurityConfiguration.java:1-19` contains no `lombok.extern.slf4j.Slf4j` import, no `org.slf4j.Logger` import, no log call). The class boots silently. Contrast with `LDAPSecurityConfiguration.java:56` which IS `@Slf4j`. An operator inheriting an unmodified container image gets DISABLED with no startup log telling them the deployment is unauthenticated — they have to know to check `auth.type`." — evidence: DisabledAuthSecurityConfiguration.java:1-19 (no Slf4j) + LDAPSecurityConfiguration.java:56 (`@Slf4j`) — severity: MEDIUM (LSN-001-class missing-warning failure mode: insecure default + no boot signal = operators inheriting without realising)

- "S2S filter is silently ignored under DISABLED. `auth.s2s.enabled=true` is read by `LoginFormSecurityConfiguration.java:42`, `OAuthSecurityConfiguration.java:90`, and `LDAPSecurityConfiguration.java:140` and conditionally adds `S2sAuthenticationFilter` at the `HTTP_BASIC` filter position. `DisabledAuthSecurityConfiguration.java:13-18` does not read the property and does not register the filter. An operator who explicitly sets `auth.s2s.enabled=true` under DISABLED gets the property accepted with no error, no warning, and no filter wired — and (because DISABLED is also `permitAll()`) the misconfiguration is undetectable until they switch modes. The live docs do not document this DISABLED+S2S interaction." — evidence: DisabledAuthSecurityConfiguration.java:13-18 (no s2s param/filter) + LoginFormSecurityConfiguration.java:42,61-63 + OAuthSecurityConfiguration.java:90,108-110 + LDAPSecurityConfiguration.java:140,149-151 + application.yml:40-41 — severity: MEDIUM

- "No CSRF protection under DISABLED — `.csrf(ServerHttpSecurity.CsrfSpec::disable)` at `DisabledAuthSecurityConfiguration.java:15`. This is consistent with the other three modes (Login/OAuth/LDAP also disable CSRF), so the LOCAL behaviour is not anomalous, but the live `disabled-authentication` doc does not mention CSRF at all. An operator transitioning from a CSRF-protecting framework would not learn from the docs that POST/PUT/DELETE requests succeed without CSRF tokens under any auth.type mode." — evidence: DisabledAuthSecurityConfiguration.java:15 + LoginFormSecurityConfiguration.java:54 + OAuthSecurityConfiguration.java:96 + LDAPSecurityConfiguration.java:143 — severity: LOW (consistent across modes; doc gap, not code defect)

- "Actuator endpoints (`/actuator/health`, `/actuator/prometheus`, `/actuator/env`, `/actuator/info` per `application.yml:226-240`) are reachable under DISABLED on the same HTTP port as the application — `.anyExchange().permitAll()` does not narrow by path and `SecurityConstants.WHITELIST_PATHS:95-96` lists `/actuator/**` regardless of mode. `/actuator/env` exposes resolved configuration (including masked-but-present credential property names), `/actuator/info` exposes build metadata, `/actuator/prometheus` exposes process-level metrics. Under DISABLED on a network-reachable deployment, every actuator endpoint is unauthenticated. The live `disabled-authentication` page does not document this." — evidence: DisabledAuthSecurityConfiguration.java:16 (`anyExchange.permitAll`) + application.yml:226-240 (management endpoints enabled-by-default=false but `env`, `prometheus`, `info`, `health` explicitly enabled) + SecurityConstants.java:95-96 — severity: MEDIUM

- "No audit logging anywhere in the codebase — grep for `AuditLog | @Auditable | AuthLogger | accessLog` across `<odd-platform-api>/src/main/java` returned zero matches on 2026-05-12. Under DISABLED specifically, this means: an attacker who reaches a DISABLED deployment can read every endpoint and leave no audit trail beyond whatever Spring WebFlux's access log (which is itself not configured at INFO level in `application.yml:247-250`) captures. The live `disabled-authentication` page does not warn about the absence of audit logging." — evidence: DisabledAuthSecurityConfiguration.java:13-18 (no logging hooks) + grep across `<odd-platform-api>/src/main/java` on 2026-05-12 (no audit infrastructure) + application.yml:247-250 (logging.level configures spring.transaction and jooq tools, not access logs) — severity: LOW (audit-log absence is a platform-wide property, not DISABLED-specific; surfaced here because DISABLED amplifies the consequence)

- "Missing-key behaviour: `@ConditionalOnProperty` at `DisabledAuthSecurityConfiguration.java:10` has no `matchIfMissing`. An operator who unsets `auth.type` (empty string via `AUTH_TYPE=` or removing the key from a customised application.yml) does NOT get this DISABLED bean — they get no bean from any of the four `*SecurityConfiguration` classes, since none of the four uses `matchIfMissing=true`. Spring Boot's reactive-security autoconfiguration (`ReactiveSecurityAutoConfiguration`) then either falls back to a default permit-all chain or to a default authenticated() chain depending on whether `spring-boot-starter-security` is on the classpath WITHOUT a user-defined chain — runtime behaviour, not statically determinable from this file. The application.yml-shipped default `DISABLED` at line 34 is the only thing preventing this fall-through; an override-customising operator who clears the key hits it." — evidence: DisabledAuthSecurityConfiguration.java:10 + LoginFormSecurityConfiguration.java:31 + OAuthSecurityConfiguration.java:71 + LDAPSecurityConfiguration.java:51 + application.yml:32-34 — severity: MEDIUM

- "Typo in `auth.type` (e.g. `disabled` lowercase, `DSIABLED`) silently fails `@ConditionalOnProperty(havingValue=\"DISABLED\")` — Spring's matcher is case-sensitive by default. The bean is not registered, and the same missing-bean fall-through described above applies. There is no boot-time fail-fast guardrail and no validation of the `auth.type` value space against the documented enum `DISABLED | LOGIN_FORM | OAUTH2 | LDAP` anywhere in the wiring." — evidence: DisabledAuthSecurityConfiguration.java:10 (case-sensitive havingValue) + AppInfoController.java:18 (the @Value consumer of auth.type has no validation — see batch-B sidecar) — severity: LOW (operator action required; consistent with the wider 'no auth.type validation' finding across batch-B sidecars)

## security

- **auth_mode_relevance**: `DISABLED` — this is the configuration class that DEFINES the DISABLED-mode behaviour. It is NOT relevant to `LOGIN_FORM | OAUTH2 | LDAP` (those are sibling beans gated by other `@ConditionalOnProperty` values). `S2S` is conceptually orthogonal — S2S applies as an additional filter under LoginForm/OAuth/LDAP but is silently ignored under DISABLED.
- **ingestion_filter_relevance**: `NO — UI/API surface gating, not ingestion`. The `IngestionDataEntitiesFilter` (governed by `auth.ingestion.filter.enabled`) is a separate filter that registers independently of `auth.type` mode. Under DISABLED, the ingestion filter still applies if `auth.ingestion.filter.enabled=true` is set — but the per-path posture for the rest of `/api/**` is permit-all, so ingestion data-entity scoping under DISABLED becomes the ONLY remaining authorization signal anywhere.
- **authorization_assertions**: `[]`. The chain has `.authorizeExchange(... .anyExchange().permitAll())` — the explicit absence of authorization. No `@PreAuthorize`, no `AuthorizationCustomizer`, no `SecurityRule` table reference. Unlike OAuth (`OAuthSecurityConfiguration.java:98 .authorizeExchange(new AuthorizationCustomizer(permissionService, extractors))`) and LDAP (`LDAPSecurityConfiguration.java:145` same), this configuration deliberately wires NO permission framework integration.
- **owner_scoping**: `N/A — code is not data-scoped`. This class defines the security chain, not data-fetching logic. Downstream effect: under DISABLED, the platform's data-fetching services run without an authenticated principal — any code that relies on `ReactiveSecurityContextHolder.getContext()` to scope by current-user-owner association will see an empty context. Owner-scoping at the data layer is therefore effectively disabled.
- **data_exposure**:
  - "Entire HTTP surface (`/**`) → any network caller, no authentication required. Includes all `/api/**` endpoints (e.g. `/api/appInfo` per batch-B sidecar, plus the full data-entity / namespace / data-source / users / lookup-table / lookup-row / collaboration / alert / activity / query-example / term / data-source-token / metadata-field / role / policy / permission / owner / data-entity-group / tag / label / message / search / dataset / structure / preview / linked-url surfaces declared in `SecurityConstants.SECURITY_RULES:98-355` — those rules are evaluated by `AuthorizationCustomizer` which is NOT wired under DISABLED, so the rules' permission-check semantics are inert)" — evidence: DisabledAuthSecurityConfiguration.java:16 + AuthorizationCustomizer.java (only wired in OAuth/LDAP per OAuthSecurityConfiguration.java:98 + LDAPSecurityConfiguration.java:145)
  - "All actuator endpoints exposed in `application.yml:226-240` (`health`, `prometheus`, `env`, `info`) → any network caller. `/actuator/env` discloses resolved configuration including the names of credential properties even when their values are masked" — evidence: application.yml:226-240 + SecurityConstants.java:95-96 (`/actuator/**` in WHITELIST_PATHS — applied by AuthorizationCustomizer-driven modes, but under DISABLED `.anyExchange().permitAll()` already permits them regardless)
- **known_security_gaps**:
  - "DISABLED is the application.yml-shipped default (`application.yml:34`), and the live `disabled-authentication` page declares it 'the default configuration' — but the page does not enumerate the blast radius: every authenticated-or-not endpoint reachable, every actuator endpoint reachable, no CSRF, no CORS configuration, no audit logging, no S2S filter even when `auth.s2s.enabled=true`. An operator deploying with no `auth.type` override runs a wide-open platform and learns this from a single 'DO NOT use in your production environment!' warning. This is the LSN-001 / LSN-010 class of insecure-default-with-cryptic-doc-coverage failure." — evidence: DisabledAuthSecurityConfiguration.java:13-18 + application.yml:34 + WebFetch disabled-authentication 2026-05-12 ("This is the default configuration" + "DO NOT use this method in your production environment!") — severity: HIGH (default + silent-boot + insufficient doc surface)
  - "No `@Slf4j` boot-time WARN logged when DISABLED activates. A startup log on the order of `log.warn(\"auth.type=DISABLED — all API endpoints permit-all, no authentication or authorization enforced. DO NOT use in production.\")` would mitigate the silent-deployment failure mode. Currently the class is silent." — evidence: DisabledAuthSecurityConfiguration.java:1-19 (no logger) — severity: MEDIUM
  - "Under DISABLED, `auth.s2s.enabled=true` is silently ignored. An operator who configures S2S thinking it overlays additional protection on top of DISABLED gets no warning that the filter is unwired. The S2S filter is wired in LoginForm/OAuth/LDAP only." — evidence: DisabledAuthSecurityConfiguration.java:13-18 (does not read auth.s2s.enabled) + LoginFormSecurityConfiguration.java:42,61-63 + OAuthSecurityConfiguration.java:90,108-110 + LDAPSecurityConfiguration.java:140,149-151 — severity: MEDIUM
  - "Actuator endpoints `/actuator/{health,prometheus,env,info}` (`application.yml:226-240`) are unauthenticated under DISABLED on the same HTTP port as the application — `.anyExchange().permitAll()` does not exclude them and the WHITELIST_PATHS includes `/actuator/**` anyway. `/actuator/env` discloses resolved configuration property NAMES (values masked). Live `disabled-authentication` page does not document this." — evidence: DisabledAuthSecurityConfiguration.java:16 + application.yml:226-240 + SecurityConstants.java:95-96 — severity: MEDIUM
  - "No audit logging infrastructure exists in `<odd-platform-api>/src/main/java` (verified via grep on 2026-05-12). Under DISABLED, a network-reachable deployment serves every endpoint with no audit trail — combined with no authentication, an attacker can read/modify data with no recorded principal." — evidence: DisabledAuthSecurityConfiguration.java:13-18 + grep across `<odd-platform-api>/src/main/java` for `AuditLog | @Auditable | AuthLogger | accessLog` on 2026-05-12 (no matches) — severity: MEDIUM (whole-codebase gap surfaced via DISABLED amplification)
  - "DISABLED has no `.cors(...)` call — OAuth (`OAuthSecurityConfiguration.java:95`) and LDAP (`LDAPSecurityConfiguration.java:142`) both call `.cors(withDefaults())`. No global CORS bean exists in the codebase (grep on 2026-05-12). Behaviourally: cross-origin browser callers under DISABLED reach the application via `.anyExchange().permitAll()` but receive no `Access-Control-*` headers from Spring Security — so a browser SPA hosted on a different origin from the platform port either succeeds (because no auth gate) or is blocked by browser-side CORS rules. Inconsistent posture across modes." — evidence: DisabledAuthSecurityConfiguration.java:13-18 (no .cors call) + OAuthSecurityConfiguration.java:95 + LDAPSecurityConfiguration.java:142 + grep on 2026-05-12 (no CorsConfigurationSource bean) — severity: LOW (dev-only; structural smell)

## performance

- **hot_paths**: `[]`. The `securityWebFilterChainDisabled` bean is constructed exactly once at application context refresh; the `SecurityWebFilterChain` itself participates in every request, but `.anyExchange().permitAll()` is among the cheapest possible chain evaluations (no DB call, no credential check, no token decode).
- **throughput_characteristics**: ["chain evaluation is non-blocking — single-pass permitAll match per request; suitable for reactive throughput under all loads" — evidence: DisabledAuthSecurityConfiguration.java:13-18]
- **resource_allocation**: ["no per-request allocation beyond Spring's standard reactive-chain framework state; no `S2sAuthenticationFilter` to instantiate, no `AuthorizationCustomizer` to construct, no `MapReactiveUserDetailsService` to populate" — evidence: DisabledAuthSecurityConfiguration.java:13-18 + contrast with LoginFormSecurityConfiguration.java:68-86 (user details populated from a CSV-style credential string) and OAuthSecurityConfiguration.java:91-106 (client-registration iteration)]
- **scaling_characteristics**: ["stateless chain — replicas scale horizontally with no coordination; no session affinity, no shared lock, no DB-resident state" — evidence: DisabledAuthSecurityConfiguration.java:13-18]
- **known_performance_gaps**: []

## sources

- understanding ← DisabledAuthSecurityConfiguration.java:1-19 + application.yml:32-34 + contrast with LoginFormSecurityConfiguration.java + OAuthSecurityConfiguration.java + LDAPSecurityConfiguration.java
- concepts.entities.DisabledAuthSecurityConfiguration ← DisabledAuthSecurityConfiguration.java:9-11
- concepts.entities.securityWebFilterChainDisabled ← DisabledAuthSecurityConfiguration.java:12-18
- concepts.entities.auth.type ← DisabledAuthSecurityConfiguration.java:10 + application.yml:32-34
- concepts.invariants[no-matchIfMissing] ← DisabledAuthSecurityConfiguration.java:10 (no `matchIfMissing` clause)
- concepts.invariants[no-securityMatcher] ← DisabledAuthSecurityConfiguration.java:13-17 (no `.securityMatcher(...)` call — contrasts with OAuthSecurityConfiguration.java:97 + LDAPSecurityConfiguration.java:144)
- concepts.invariants[no-S2S-wiring] ← DisabledAuthSecurityConfiguration.java:13-17 + LoginFormSecurityConfiguration.java:42,61-63 + OAuthSecurityConfiguration.java:90,108-110 + LDAPSecurityConfiguration.java:140,149-151
- dependencies_semantic.requires-feature.[application.yml-default] ← application.yml:32-34
- dependencies_semantic.requires-config.auth.type ← DisabledAuthSecurityConfiguration.java:10
- dependencies_semantic.requires-runtime ← DisabledAuthSecurityConfiguration.java:1-8 (imports show Spring Boot autoconfigure + Spring Security WebFlux); class lacks `@EnableWebFluxSecurity` (relies on Spring Boot autoconfiguration — verified via Read of the file)
- tests_coverage_semantic.gaps ← Bash `find <odd-platform-api>/src/test -name '*Disabled*' -o -name '*SecurityConfiguration*' -o -name '*AuthIntegration*'` returned no matches + grep `auth.type=DISABLED | "DISABLED"` across `<odd-platform-api>/src/test` returned no matches on 2026-05-12
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication/disabled-authentication on 2026-05-12, status 200
- docs_link_semantic.inferred_docs.[1] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security on 2026-05-12, status 200
- docs_link_semantic.inferred_docs.[2] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication on 2026-05-12, status 200
- docs_link_semantic.doc_drift_findings.[0] ← WebFetch disabled-authentication 2026-05-12 (verbatim "This is the default configuration" + "DO NOT use this method in your production environment!") + DisabledAuthSecurityConfiguration.java:13-18 (actual blast radius) + application.yml:226-240 (actuator) + grep on 2026-05-12 (no audit-logging infrastructure)
- docs_link_semantic.doc_drift_findings.[1] ← WebFetch disabled-authentication 2026-05-12 (no S2S mention) + DisabledAuthSecurityConfiguration.java:13-18 (no s2s read) + LoginFormSecurityConfiguration.java:42,61-63 + OAuthSecurityConfiguration.java:90,108-110 + LDAPSecurityConfiguration.java:140,149-151
- docs_link_semantic.doc_drift_findings.[2] ← WebFetch enable-security 2026-05-12 + WebFetch disabled-authentication 2026-05-12 + DisabledAuthSecurityConfiguration.java:16 (`.anyExchange().permitAll()`)
- docs_link_semantic.doc_drift_findings.[3] ← DisabledAuthSecurityConfiguration.java:10 + LoginFormSecurityConfiguration.java:31 + OAuthSecurityConfiguration.java:71 + LDAPSecurityConfiguration.java:51 (all four lack `matchIfMissing=true`)
- implicit_adrs.[0] ← application.yml:32-34 + WebFetch disabled-authentication 2026-05-12
- implicit_adrs.[1] ← DisabledAuthSecurityConfiguration.java:13-18 (the explicit-chain construction itself as intent anchor — chose to author rather than rely on autoconfiguration fallthrough)
- implicit_adrs.[2] ← DisabledAuthSecurityConfiguration.java:10 + LoginFormSecurityConfiguration.java:31 + OAuthSecurityConfiguration.java:71 + LDAPSecurityConfiguration.java:51 (four-way parallel `@ConditionalOnProperty` structure)
- bugs_limitations_corner_cases.[0] ← DisabledAuthSecurityConfiguration.java:13-18 + OAuthSecurityConfiguration.java:95 + LDAPSecurityConfiguration.java:142 + grep across `<odd-platform-api>/src/main/java` for `CorsConfigurationSource | CorsWebFilter | CorsRegistry` on 2026-05-12 (no matches)
- bugs_limitations_corner_cases.[1] ← DisabledAuthSecurityConfiguration.java:1-19 (no Slf4j imports, no logger field) + LDAPSecurityConfiguration.java:56 (`@Slf4j` annotation present)
- bugs_limitations_corner_cases.[2] ← DisabledAuthSecurityConfiguration.java:13-18 (no s2sEnabled parameter, no S2sAuthenticationFilter bean injection) + LoginFormSecurityConfiguration.java:42,61-63 + OAuthSecurityConfiguration.java:90,108-110 + LDAPSecurityConfiguration.java:140,149-151 + application.yml:40-41
- bugs_limitations_corner_cases.[3] ← DisabledAuthSecurityConfiguration.java:15 + LoginFormSecurityConfiguration.java:54 + OAuthSecurityConfiguration.java:96 + LDAPSecurityConfiguration.java:143
- bugs_limitations_corner_cases.[4] ← DisabledAuthSecurityConfiguration.java:16 + application.yml:226-240 + SecurityConstants.java:95-96
- bugs_limitations_corner_cases.[5] ← DisabledAuthSecurityConfiguration.java:13-18 + grep across `<odd-platform-api>/src/main/java` for `AuditLog | @Auditable | AuthLogger | accessLog` on 2026-05-12 + application.yml:247-250
- bugs_limitations_corner_cases.[6] ← DisabledAuthSecurityConfiguration.java:10 + LoginFormSecurityConfiguration.java:31 + OAuthSecurityConfiguration.java:71 + LDAPSecurityConfiguration.java:51 + application.yml:32-34
- bugs_limitations_corner_cases.[7] ← DisabledAuthSecurityConfiguration.java:10 + AppInfoController.java:18 (per batch-B sidecar's @Value consumer with no validation)
- security.auth_mode_relevance ← DisabledAuthSecurityConfiguration.java:10 (havingValue="DISABLED")
- security.ingestion_filter_relevance ← Cross-file: this bean does not register the ingestion filter; `IngestionDataEntitiesFilter` registers via its own `@ConditionalOnProperty(value="auth.ingestion.filter.enabled", havingValue="true")` per batch-B sidecar
- security.authorization_assertions ← DisabledAuthSecurityConfiguration.java:16 (`.anyExchange().permitAll()` — explicit absence of authorization) + OAuthSecurityConfiguration.java:98 (contrast: `new AuthorizationCustomizer(...)`) + LDAPSecurityConfiguration.java:145 (same contrast)
- security.owner_scoping ← DisabledAuthSecurityConfiguration.java:13-18 (security chain, not data layer; downstream effect inferred from absence of authenticated principal under DISABLED)
- security.data_exposure.[0] ← DisabledAuthSecurityConfiguration.java:16 + SecurityConstants.java:98-355 (the rule table that becomes inert under DISABLED) + AuthorizationCustomizer wiring at OAuthSecurityConfiguration.java:98 + LDAPSecurityConfiguration.java:145
- security.data_exposure.[1] ← application.yml:226-240 + SecurityConstants.java:95-96
- security.known_security_gaps.[0] ← DisabledAuthSecurityConfiguration.java:13-18 + application.yml:34 + WebFetch disabled-authentication 2026-05-12
- security.known_security_gaps.[1] ← DisabledAuthSecurityConfiguration.java:1-19 (no Slf4j)
- security.known_security_gaps.[2] ← DisabledAuthSecurityConfiguration.java:13-18 + LoginFormSecurityConfiguration.java:42,61-63 + OAuthSecurityConfiguration.java:90,108-110 + LDAPSecurityConfiguration.java:140,149-151
- security.known_security_gaps.[3] ← DisabledAuthSecurityConfiguration.java:16 + application.yml:226-240 + SecurityConstants.java:95-96
- security.known_security_gaps.[4] ← DisabledAuthSecurityConfiguration.java:13-18 + grep on 2026-05-12 (no audit infrastructure)
- security.known_security_gaps.[5] ← DisabledAuthSecurityConfiguration.java:13-18 + OAuthSecurityConfiguration.java:95 + LDAPSecurityConfiguration.java:142 + grep on 2026-05-12 (no CORS bean)
- performance.throughput_characteristics.[0] ← DisabledAuthSecurityConfiguration.java:13-18
- performance.resource_allocation.[0] ← DisabledAuthSecurityConfiguration.java:13-18 + LoginFormSecurityConfiguration.java:68-86 + OAuthSecurityConfiguration.java:91-106
- performance.scaling_characteristics.[0] ← DisabledAuthSecurityConfiguration.java:13-18

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH (dedicated disabled-authentication sub-page verified live 2026-05-12; doc-drift findings cite specific code:line + verbatim doc excerpts)
- implicit_adrs: HIGH (three ADRs, each anchored on either an explicit application.yml comment + live doc statement, or a four-way parallel structure across sibling files)
- bugs_limitations_corner_cases: HIGH (each finding cited to file:line + cross-referenced sibling file lines or verified grep result)
- security: HIGH
- performance: HIGH

## Maintainer notes


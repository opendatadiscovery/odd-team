---
node_id: "odd-platform java AuthorizationManagerCondition config-key-consumer:auth.type@L11"
node_kind: config-key-consumer
axis: config_prefixes
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-10-01
---

# auth.type=OAUTH2 branch of AuthorizationManagerCondition.java:11 — semantic understanding

## understanding

This `@ConditionalOnProperty(name="auth.type", havingValue="OAUTH2")` annotation marks the inner `OAuthCondition` static class at line 11-13 of `AuthorizationManagerCondition`, which is a Spring `AnyNestedCondition` declared at `ConfigurationPhase.PARSE_CONFIGURATION`. The composite condition's contract is "return TRUE when ANY nested `@Conditional*` returns TRUE" — so this OAUTH2 nested class plus its sibling LDAP nested class at line 15 together make `AuthorizationManagerCondition` evaluate TRUE when `auth.type` is OAUTH2 OR LDAP, and FALSE otherwise (including the default `auth.type=DISABLED`, `auth.type=LOGIN_FORM`, and any unset value). **CRITICAL FINDING**: as of commit `ede5d277`, no code in the repository references `AuthorizationManagerCondition` via `@Conditional(AuthorizationManagerCondition.class)` or any other consumer mechanism — this Condition class is unwired dead code. The authorization wiring it appears designed to gate is in practice carried out by direct `@ConditionalOnProperty(value="auth.type", havingValue="OAUTH2")` and `havingValue="LDAP"` annotations on `OAuthSecurityConfiguration.java:71` and `LDAPSecurityConfiguration.java:51` respectively, each of which independently instantiates `new AuthorizationCustomizer(permissionService, extractors)` inside its `SecurityWebFilterChain` bean.

## concepts

- entities: [`AuthorizationManagerCondition` (the composite `AnyNestedCondition`), `OAuthCondition` (this L11 nested class), Spring `Condition` SPI, `auth.type` config key]
- operations: [evaluate-truthy-when-auth.type-matches-OAUTH2, contribute-OAUTH2-disjunct-to-composite-AnyNestedCondition]
- invariants: [composite returns TRUE iff `auth.type ∈ {OAUTH2, LDAP}`; the Condition resolves at `PARSE_CONFIGURATION` phase (earliest), meaning it runs before bean-definition scanning and is suitable for gating `@Configuration` classes; `@ConditionalOnProperty` without `matchIfMissing` returns FALSE for an unset key — so this branch fails closed]
- audiences: [Spring container during bean-definition phase — no human / HTTP audience; design-time intent was for the authorization-manager wiring path, but no consumer is actually wired]

## dependencies_semantic

- requires-feature: [`auth.type` configuration mode selector (declared in `odd-platform-api/src/main/resources/application.yml:32-34` with default `DISABLED`); Spring Boot autoconfiguration's `AnyNestedCondition` / `@ConditionalOnProperty` infrastructure]
- requires-config: [`auth.type` (defined in `application.yml:32-34`; documented values `DISABLED | LOGIN_FORM | OAUTH2 | LDAP` per the in-file YAML comment at line 33)]
- requires-runtime: [Spring property-source resolution at the `PARSE_CONFIGURATION` phase — earlier than `REGISTER_BEAN` — so the resolved value must be present in any `PropertySource` discovered before bean-definition registration; reactive-stack Spring Security (`spring-security-config` for `@EnableWebFluxSecurity`)]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours: [(1) verifying that `AuthorizationManagerCondition` returns TRUE for `auth.type=OAUTH2`; (2) verifying TRUE for `auth.type=LDAP`; (3) verifying FALSE for `auth.type=DISABLED`, `auth.type=LOGIN_FORM`, and unset `auth.type`; (4) — and more fundamentally — verifying that the Condition class is consumed by ANY `@Conditional(...)` in the codebase, which it currently is not (dead-code verification)]
- test_files: []
- gaps: |
    There is no test file under `odd-platform-api/src/test` matching `*AuthorizationManager*` or `*AuthorizationCondition*` (verified via Bash `find` returning no output on 2026-05-10). More importantly, the dead-code status of this entire Condition class would be caught by a single integration test asserting "spring-context starts with `auth.type=OAUTH2` and the bean named `securityWebFilterChainOauth2Client` is present, ditto LDAP" — such a test would naturally fail if the wiring path ever shifted to require `AuthorizationManagerCondition` and someone removed the per-config-class `@ConditionalOnProperty` annotations. Currently the only regression-blocker for `auth.type` mode wiring is whether the Spring container boots at all under each mode, which is not exercised by the unit-test suite.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication"
    anchor: ""
    rationale: "The Authentication section of the enable-security area is the canonical home for `auth.type` values, including OAUTH2 and LDAP. There is no `@docs` annotation in the source file, so the link is inferred."
    last_verified_at: "2026-05-10T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization"
    anchor: ""
    rationale: "The Authorization section is the canonical home for the Policies/Permissions/Roles/Owners framework that this Condition's name suggests it gates. Inferred because the Condition class name is `AuthorizationManagerCondition` and the wired customizer (`AuthorizationCustomizer` at OAuthSecurityConfiguration.java:98 and LDAPSecurityConfiguration.java:145) constructs the authorization manager."
    last_verified_at: "2026-05-10T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security"
    anchor: ""
    rationale: "The parent enable-security page indexes the auth.type vocabulary used in this Condition."
    last_verified_at: "2026-05-10T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
- fetched_excerpts: |
    From WebFetch of https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security on 2026-05-10 (status 200):
    > "auth.type (DISABLED / LOGIN_FORM / OAUTH2 / LDAP)" — main configuration table.
    > "Unauthenticated under auth.type = DISABLED, OAUTH2, or LDAP" — ingestion endpoints row.
    > "Under auth.type=LOGIN_FORM, sibling paths are instead session-gated." — ingestion endpoints row.
    > "LOGIN_FORM is documented as dev-only." — narrative.
    From WebFetch of https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication on 2026-05-10 (status 200):
    > Lists DISABLED / LOGIN_FORM / OAUTH2/OIDC / LDAP / S2S as the documented modes. The page is a table-of-contents; specific behaviour per mode is on sub-pages.
    > Does NOT state the default auth.type value, nor does it state which modes wire authorization (Policies/Permissions/Roles/Owners).
    From WebFetch of https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization on 2026-05-10 (status 200):
    > "It is very important to have fine-grained access control in your data catalog."
    > Lists Policies / Permissions / Roles / Owners / User-owner association as the framework components.
    > Does NOT state which auth modes (DISABLED, LOGIN_FORM, OAUTH2, LDAP) have authorization wired in.
- doc_drift_findings:
  - "The live Authorization page does NOT state that the Policies / Permissions / Roles / Owners framework is wired ONLY when `auth.type ∈ {OAUTH2, LDAP}`. An operator deploying with `auth.type=LOGIN_FORM` (the dev-mode credentials flow) gets ZERO authorization checks — no `AuthorizationCustomizer`, no per-Policy permission evaluation, no Owner scoping — yet the docs describe Policies/Permissions as the platform's authorization model without naming the precondition. An operator running LOGIN_FORM in production (against the docs' guidance, but plausible) inherits authenticated-but-unauthorized: every authenticated user can hit every endpoint."
  - "The live Authentication page does NOT surface the default `auth.type=DISABLED` (declared in `application.yml:34`). An operator who deploys without setting `auth.type` runs unauthenticated by default — i.e. ALL endpoints permit-all (DisabledAuthSecurityConfiguration.java:16). The docs frame DISABLED as an option, not as the default, which is a documentation-vs-reality mismatch with security implications for first-time operators."

## implicit_adrs

- "Authorization-manager wiring (the `AuthorizationCustomizer` + `ReactiveAuthorizationManagerFactory` chain) was designed to be gated by a single composite condition (`AuthorizationManagerCondition`) covering OAUTH2 OR LDAP — evidenced by the existence of this `AnyNestedCondition` subclass authored specifically for the OAUTH2-or-LDAP disjunction. The intent anchor is the class itself: it has no other plausible purpose." — evidence: AuthorizationManagerCondition.java:6-18 — intent_anchor: "public class AuthorizationManagerCondition extends AnyNestedCondition { ... @ConditionalOnProperty(name = \"auth.type\", havingValue = \"OAUTH2\") static class OAuthCondition {} @ConditionalOnProperty(name = \"auth.type\", havingValue = \"LDAP\") static class LDAPCondition {} }" — confidence: MEDIUM
- "Spring `AnyNestedCondition` at `ConfigurationPhase.PARSE_CONFIGURATION` is the project's chosen idiom for OR-ing two `@ConditionalOnProperty` predicates at the earliest phase (before bean-definition registration). This is a consistent pattern in the codebase — the sibling `SlackMessageGeneratorCondition.java:8-19` uses the same `AnyNestedCondition` idiom (at `REGISTER_BEAN` phase) and IS consumed via `@Conditional` in `SlackMessageGeneratorConfiguration.java`." — evidence: AuthorizationManagerCondition.java:6 + SlackMessageGeneratorCondition.java:8-10 — intent_anchor: "extends AnyNestedCondition { ... super(ConfigurationPhase.PARSE_CONFIGURATION); }" — confidence: HIGH

## bugs_limitations_corner_cases

- "`AuthorizationManagerCondition` is dead code: no class in `<odd-platform>` references it via `@Conditional(AuthorizationManagerCondition.class)`, by class-literal import, or by any other consumer mechanism (verified via Bash `grep -rln \"AuthorizationManagerCondition\" <odd-platform> --include=\"*.java\"` returning ONLY the file's own path on 2026-05-10). The authorization-manager wiring it appears designed to gate is in practice carried out by direct per-config `@ConditionalOnProperty(value=\"auth.type\", havingValue=\"OAUTH2\")` and `havingValue=\"LDAP\"` annotations on `OAuthSecurityConfiguration.java:71` and `LDAPSecurityConfiguration.java:51`. The Condition class is therefore vestigial — either the original consumer was refactored out (commit history not accessible in this session) or it was added in anticipation of a consumer that never landed. Risk: a future maintainer reading the Condition class would reasonably assume it gates the authorization-manager wiring path and rely on it; the wiring would silently fail because nothing actually consults the Condition." — evidence: AuthorizationManagerCondition.java:1-18 (file body) + OAuthSecurityConfiguration.java:71 (direct `@ConditionalOnProperty`) + LDAPSecurityConfiguration.java:51 (direct `@ConditionalOnProperty`) + grep on 2026-05-10 — severity: MEDIUM
- "`auth.type=LOGIN_FORM` runs WITHOUT the `AuthorizationCustomizer`. `LoginFormSecurityConfiguration.java:55-58` configures its `SecurityWebFilterChain` with `authorizeExchange(...).pathMatchers(\"/**\").authenticated()` — that gates by authentication, not by the Policy/Permission/Role/Owner framework. The composite `AuthorizationManagerCondition` would correctly return FALSE for LOGIN_FORM (intentional — neither nested class lists LOGIN_FORM as `havingValue`), but the consequence is undocumented: the entire authorization framework is silently absent in LOGIN_FORM deployments, so any authenticated user can call any endpoint that depends on `AuthorizationCustomizer` for fine-grained access control." — evidence: LoginFormSecurityConfiguration.java:55-58 + OAuthSecurityConfiguration.java:98 (`.authorizeExchange(new AuthorizationCustomizer(...))`) + LDAPSecurityConfiguration.java:145 (same) + AuthorizationManagerCondition.java:11-17 (only OAUTH2 + LDAP) — severity: HIGH
- "`auth.type=DISABLED` (the default per `application.yml:34`) bypasses authentication AND authorization. `DisabledAuthSecurityConfiguration.java:13-18` configures `authorizeExchange(authorizeExchangeSpec -> authorizeExchangeSpec.anyExchange().permitAll())` — every endpoint, every request method, every payload is permitted with no authentication and no authorization. An operator who deploys the platform without setting `auth.type` (or who sets it explicitly to `DISABLED` for staging and forgets to flip it for production) runs a fully open platform; this is the literal default. The composite `AuthorizationManagerCondition` correctly returns FALSE for DISABLED (intentional — neither nested class matches), but the doc surface does not surface that DISABLED is the default nor that 'no authorization' is the literal behaviour." — evidence: application.yml:32-34 + DisabledAuthSecurityConfiguration.java:9-18 — severity: HIGH
- "Missing-key behaviour: if `auth.type` is unset (no YAML entry, no env override, no system property), Spring's `@ConditionalOnProperty` without `matchIfMissing=true` returns FALSE for every nested class. The composite `AuthorizationManagerCondition` therefore returns FALSE, no authorization-manager wiring would be activated by this Condition — but since the Condition has no consumer anyway, the downstream effect is moot. However, the same missing-key behaviour affects the per-config `@ConditionalOnProperty` on each of the four `SecurityConfiguration` classes: with `auth.type` unset, NONE of the four `SecurityWebFilterChain` beans materialize, and the Spring container boots without a `SecurityWebFilterChain` for the reactive stack — leading to undefined HTTP-surface behaviour (Spring Boot autoconfigures a permit-all default `SecurityWebFilterChain` via `ReactiveSecurityAutoConfiguration` if no user-defined chain exists, meaning the platform may silently boot unauthenticated). The `application.yml:34` default of `DISABLED` is what saves an operator who pulls the chart without customization; an operator who overrides `auth.type=` to an empty string via env var would land in this missing-key trap." — evidence: AuthorizationManagerCondition.java:11 (no `matchIfMissing`) + AuthorizationManagerCondition.java:15 (no `matchIfMissing`) + OAuthSecurityConfiguration.java:71 + LDAPSecurityConfiguration.java:51 + LoginFormSecurityConfiguration.java:31 + DisabledAuthSecurityConfiguration.java:10 (none of the four use `matchIfMissing`) + application.yml:34 (default `DISABLED`) — severity: MEDIUM

## security

- **auth_mode_relevance**: `OAUTH2` (this specific @L11 nested class). The composite class `AuthorizationManagerCondition` as a whole is relevant to `OAUTH2 | LDAP` (returns TRUE for those two modes). It is NOT relevant to `DISABLED`, `LOGIN_FORM`, or unset `auth.type`. S2S is orthogonal (S2S is an *additional* filter activated by `auth.s2s.enabled`, not a primary `auth.type` mode — verified via WebFetch of `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security` on 2026-05-10).
- **ingestion_filter_relevance**: `NO — UI/API auth-mode gating, not ingestion`. This Condition gates authorization-manager bean wiring (designed-intent), not the ingestion filter. The ingestion filter is gated by a separate config key `auth.ingestion.filter.enabled` (default `false` per `application.yml:46-48`).
- **authorization_assertions**: `[]` — this is a Spring `Condition` class, not a controller / service / endpoint. It does not enforce permissions; it gates the *wiring* of the code that would enforce them. The wiring path (which this Condition does not actually trigger — see bugs_limitations_corner_cases.[0]) leads to `AuthorizationCustomizer.customize()` (`auth/authorization/AuthorizationCustomizer.java:20-31`), which applies `SecurityRule`-driven `manager(...)` calls per the `SecurityConstants.SECURITY_RULES` table.
- **owner_scoping**: `N/A — Condition class, not data-scoped`. The class evaluates a config-key string; it never touches data entities, owners, or scopes.
- **data_exposure**: `[]` — no data flows through this class. The only output is a boolean Condition match.
- **known_security_gaps**:
  - `"AuthorizationManagerCondition is dead code — no @Conditional consumer references it. A future maintainer relying on this Condition to gate the authorization-manager wiring would ship code that silently never activates the gate."` — evidence: AuthorizationManagerCondition.java:1-18 + grep result on 2026-05-10 (only the file itself matches) — severity: MEDIUM
  - `"LOGIN_FORM deployments run WITHOUT the authorization framework (Policies / Permissions / Roles / Owners). LoginFormSecurityConfiguration only checks .authenticated(); it never instantiates AuthorizationCustomizer. The composite AuthorizationManagerCondition would correctly return FALSE for LOGIN_FORM, but no documentation surface tells the operator that switching to LOGIN_FORM disables authorization entirely. The 'LOGIN_FORM is dev-only' note on the live docs (WebFetch 2026-05-10) is the closest mitigating signal but does not state the consequence."` — evidence: LoginFormSecurityConfiguration.java:53-66 + OAuthSecurityConfiguration.java:98 + LDAPSecurityConfiguration.java:145 + AuthorizationManagerCondition.java:11-17 — severity: HIGH
  - `"DISABLED is the default (application.yml:34) and bypasses both authentication AND authorization (DisabledAuthSecurityConfiguration permits all exchanges). The live Authentication docs page does not surface this default, so an operator who omits auth.type in their override config (helm values, env, etc.) runs a fully open platform without an explicit opt-in to that posture."` — evidence: application.yml:32-34 + DisabledAuthSecurityConfiguration.java:9-18 + WebFetch of `enable-security/authentication` on 2026-05-10 (default not stated on live page) — severity: HIGH

## performance

- **hot_paths**: `[]` — Spring `Condition` evaluation is performed exactly ONCE at application context refresh time (`PARSE_CONFIGURATION` phase per the constructor at line 8), not per request. The Condition has no runtime hot path.
- **throughput_characteristics**: `N/A — one-shot at context refresh`. Not on any throughput axis.
- **resource_allocation**: `N/A — class is a Condition matcher, allocates only the implicit `AnyNestedCondition` framework state Spring needs at parse time`.
- **scaling_characteristics**: `N/A — process-local, evaluated once per JVM at startup`. Identical across replicas if `auth.type` is uniform.
- **known_performance_gaps**: `[]` — no performance characteristics worth surfacing for a parse-time Condition.

## sources

- understanding ← AuthorizationManagerCondition.java:1-18 + OAuthSecurityConfiguration.java:71 + LDAPSecurityConfiguration.java:51 + OAuthSecurityConfiguration.java:98 + LDAPSecurityConfiguration.java:145 + Bash grep `AuthorizationManagerCondition` across `<odd-platform>/**/*.java` on 2026-05-10 (returned only the file's own path)
- concepts.entities.AuthorizationManagerCondition ← AuthorizationManagerCondition.java:6
- concepts.entities.OAuthCondition ← AuthorizationManagerCondition.java:11-13
- concepts.invariants.[composite-truth-table] ← AuthorizationManagerCondition.java:6-18 + Spring `AnyNestedCondition` Javadoc semantics (matches if ANY nested @Conditional matches)
- concepts.invariants.[PARSE_CONFIGURATION-phase] ← AuthorizationManagerCondition.java:8
- concepts.invariants.[no-matchIfMissing] ← AuthorizationManagerCondition.java:11 + AuthorizationManagerCondition.java:15
- dependencies_semantic.requires-config.auth.type ← application.yml:32-34
- dependencies_semantic.requires-feature ← AuthorizationManagerCondition.java:3-4 (imports `AnyNestedCondition`, `ConditionalOnProperty` from `org.springframework.boot.autoconfigure.condition`)
- tests_coverage_semantic.gaps ← Bash `find <odd-platform>/odd-platform-api/src/test -name "*AuthorizationManager*" -o -name "*AuthorizationCondition*"` returned no matches on 2026-05-10
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authentication on 2026-05-10, status 200
- docs_link_semantic.inferred_docs.[1] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization on 2026-05-10, status 200
- docs_link_semantic.inferred_docs.[2] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security on 2026-05-10, status 200
- docs_link_semantic.doc_drift_findings.[0] ← Cross-check between WebFetch of `/enable-security/authorization` (2026-05-10) + LoginFormSecurityConfiguration.java:55-58 (no `AuthorizationCustomizer`) + DisabledAuthSecurityConfiguration.java:13-18 (no authorization at all) + AuthorizationManagerCondition.java:11-17 (gates OAUTH2 + LDAP only)
- docs_link_semantic.doc_drift_findings.[1] ← Cross-check between WebFetch of `/enable-security/authentication` (2026-05-10) + application.yml:32-34 (default DISABLED)
- implicit_adrs.[0] ← AuthorizationManagerCondition.java:6-18 (class-as-intent-anchor)
- implicit_adrs.[1] ← AuthorizationManagerCondition.java:6 + SlackMessageGeneratorCondition.java:8-19 (consistent project pattern)
- bugs_limitations_corner_cases.[0] ← AuthorizationManagerCondition.java:1-18 + grep result on 2026-05-10 + OAuthSecurityConfiguration.java:71 + LDAPSecurityConfiguration.java:51
- bugs_limitations_corner_cases.[1] ← LoginFormSecurityConfiguration.java:55-58 + OAuthSecurityConfiguration.java:98 + LDAPSecurityConfiguration.java:145 + AuthorizationManagerCondition.java:11-17
- bugs_limitations_corner_cases.[2] ← application.yml:32-34 + DisabledAuthSecurityConfiguration.java:9-18
- bugs_limitations_corner_cases.[3] ← AuthorizationManagerCondition.java:11 + AuthorizationManagerCondition.java:15 + OAuthSecurityConfiguration.java:71 + LDAPSecurityConfiguration.java:51 + LoginFormSecurityConfiguration.java:31 + DisabledAuthSecurityConfiguration.java:10 + application.yml:34
- security.auth_mode_relevance ← AuthorizationManagerCondition.java:11 (`havingValue = "OAUTH2"`) + AuthorizationManagerCondition.java:15 (`havingValue = "LDAP"`) + WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security on 2026-05-10
- security.ingestion_filter_relevance ← application.yml:46-48 (`auth.ingestion.filter.enabled: false` default; separate from `auth.type`)
- security.authorization_assertions ← AuthorizationManagerCondition.java:1-18 (Condition class, not an enforcer) + AuthorizationCustomizer.java:20-31 (the enforcement path that would have been gated)
- security.owner_scoping ← AuthorizationManagerCondition.java:1-18 (no data scope)
- security.data_exposure ← AuthorizationManagerCondition.java:1-18 (no data flow)
- security.known_security_gaps.[0] ← AuthorizationManagerCondition.java:1-18 + grep result on 2026-05-10
- security.known_security_gaps.[1] ← LoginFormSecurityConfiguration.java:53-66 + OAuthSecurityConfiguration.java:98 + LDAPSecurityConfiguration.java:145 + AuthorizationManagerCondition.java:11-17 + WebFetch of `enable-security` parent on 2026-05-10 ("LOGIN_FORM is documented as dev-only")
- security.known_security_gaps.[2] ← application.yml:32-34 + DisabledAuthSecurityConfiguration.java:9-18 + WebFetch of `enable-security/authentication` on 2026-05-10
- performance.hot_paths ← AuthorizationManagerCondition.java:8 (`PARSE_CONFIGURATION` is one-shot at context refresh)
- performance.scaling_characteristics ← AuthorizationManagerCondition.java:1-18 (process-local Condition)

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH
- implicit_adrs: MEDIUM
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH

## Maintainer notes


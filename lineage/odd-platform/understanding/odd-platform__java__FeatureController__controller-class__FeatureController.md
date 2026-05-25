---
node_id: "odd-platform java FeatureController controller-class:FeatureController"
node_kind: controller-class
axis: controllers
extracted_at_commit: 4ec2b20
enriched_at_commit: 4ec2b20
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-25-ZE-FeatureController
schema_version: v0.3.0
pillar: P-09
back_links:
  feature_ids: []  # no F-NNN yet enumerates GET /api/features/active; sidecar surfaces the feature
  pillar_anchored_ids: ["P-04:F-006 Data Collaboration toggle", "P-09:F-001 UI authentication", "P-09:F-002 Principal-to-Owner Resolution"]
  refactor_ids: [REFACTOR-185]
  retrospective_ids: []
  adr_candidate_ids: []
  sibling_sidecars:
    - "odd-platform__java__IdentityController__controller-class__IdentityController.md (the IDENTITY-LAYER FACET of REFACTOR-185 — analogous SPA-bootstrap controller; both are post-login dispatched from App.tsx useEffect at lines 48/49)"
    - "odd-platform__java__AppInfoController__controller-class__AppInfoController.md (batch T — sibling app-info surface)"
    - "odd-platform__java__IntegrationController__controller-class__IntegrationController.md (batch ZD — INFORMATION-DISCLOSURE FACET sibling)"
    - "odd-platform__java__DisabledAuthSecurityConfiguration__config-key-consumer__auth_type@L10.md (DISABLED-mode wiring — the `.anyExchange().permitAll()` that exposes this controller anonymously)"
    - "odd-platform__java__LoginFormSecurityConfiguration__config-class__LoginFormSecurityConfiguration.md (LOGIN_FORM-mode wiring — `/api/features/active` is NOT in permittedPaths so authenticated() applies)"
---

# FeatureController (controller-class) — semantic understanding

## understanding

`FeatureController` is a **21-line single-endpoint controller** exposing `GET /api/features/active` — the feature-flag exposure surface every UI client hits on application mount (`App.tsx:49` dispatches `fetchActiveFeatures()` once-on-mount with empty dep-array, populating `appInfo.slice.ts:14` which feeds the shared `WithFeature` wrapper component at `WithFeature.tsx:15-36`). The controller delegates to `featureResolver.resolveActiveFeatures()` (line 19) which is a **boot-time-computed immutable view**: `FeatureResolverImpl`'s constructor (`FeatureResolverImpl.java:16-31`) reads `${datacollaboration.enabled}` and `${notifications.enabled}` via `@Value`, builds an in-memory `HashSet<Feature>` once at @Component instantiation, and `resolveActiveFeatures()` simply wraps that set in a fresh `FeatureList` payload per call (line 35). Two `Feature` enum values are exposed: `DATA_COLLABORATION` (gated by `datacollaboration.enabled`) and `ALERT_NOTIFICATIONS` (gated by `notifications.enabled`) — both default to **false** per `application.yml:173, 205`, so a stock install returns an empty `items[]`. The controller carries no `@PreAuthorize` annotation, but `/api/features/active` is NOT in `SecurityConstants.WHITELIST_PATHS` (`SecurityConstants.java:95-96`) and NOT in `LoginFormSecurityConfiguration.permittedPaths` (`LoginFormSecurityConfiguration.java:49-51`), so under LOGIN_FORM / OAUTH2 / LDAP modes the `pathMatchers("/**").authenticated()` rule (`AuthorizationCustomizer.java:29-30`, `LoginFormSecurityConfiguration.java:57`) gates anonymous callers with 401. Under `auth.type=DISABLED` (the bundled default per `application.yml:34`), `DisabledAuthSecurityConfiguration.java:13-18` short-circuits with `.anyExchange().permitAll()` and the endpoint is anonymously reachable — but the payload it returns is the same enumerated set of boot-time-resolved flags; there is no per-user gating, no secret information in the response. This is the **PROVIDER-NULL-BLEED-LIMITED-RISK FACET of REFACTOR-185**: the controller IS exposed under DISABLED but unlike `IdentityController` (which fabricates an admin principal) and `IntegrationController` (which leaks internal hostnames), the information exposed is operator-policy-configurable boolean state. The real bug-class is elsewhere: the response is computed ONCE at boot, so a runtime toggle of `datacollaboration.enabled` (e.g. via `/actuator/refresh` if exposed) is NOT reflected — the immutable `activeFeatures` field (line 14) is captured in the constructor and never recomputed.

## concepts

- entities:
  - `FeatureController` (the @RestController; lines 12-21)
  - `FeatureApi` (the OpenAPI-generated interface from `openapi.yaml:100-113` — operationId `getActiveFeatures`, GET `/api/features/active`, returns `FeatureList`)
  - `FeatureList` (DTO from `components.yaml:121-127` — `items: array<Feature>`, required)
  - `Feature` (enum at `components.yaml:115-119` — exactly TWO values: `DATA_COLLABORATION`, `ALERT_NOTIFICATIONS`)
  - `FeatureResolver` (the SPI; one method `FeatureList resolveActiveFeatures()`; also declares the SpEL constants `DATA_COLLABORATION_ENABLED_PROPERTY_SPEL = "${datacollaboration.enabled}"` and `NOTIFICATIONS_ENABLED_PROPERTY_SPEL = "${notifications.enabled}"` at lines 6-10)
  - `FeatureResolverImpl` (the concrete service; `FeatureResolverImpl.java:12-37`)
  - `ServerWebExchange` (Spring WebFlux per-exchange handle; received as a parameter at line 18 but UNUSED in the controller body)
- operations:
  - delegate-to-feature-resolver: `featureResolver.resolveActiveFeatures()` (line 19)
  - wrap-in-mono: `Mono.just(...)` (line 19)
  - wrap-in-ResponseEntity.ok: `.map(ResponseEntity::ok)` (line 19)
  - (in the resolver) construct-fresh-FeatureList-from-immutable-set: `new FeatureList().items(new ArrayList<>(activeFeatures))` (FeatureResolverImpl.java:35)
- invariants:
  - "controller is stateless reactive — single private final FeatureResolver dependency, no per-request state, no in-memory cache distinct from the resolver's (line 15)"
  - "the `ServerWebExchange exchange` parameter is RECEIVED but never read in the controller body (line 18); it is forwarded by OpenAPI-generated FeatureApi signatures but the controller does not introspect headers, cookies, or any per-exchange attribute — including no audit logging"
  - "the set of returned features is computed ONCE at boot, in the FeatureResolverImpl constructor (FeatureResolverImpl.java:16-31). Subsequent runtime mutation of `datacollaboration.enabled` or `notifications.enabled` (via `/actuator/refresh` if exposed, or via JVM system properties at runtime) is NOT reflected — the `activeFeatures` field is a `private final Set<Feature>` captured in the constructor (line 14)"
  - "no @PreAuthorize, no programmatic authorization check, no rate-limit, no audit logging, no Cache-Control header on the response"
  - "the response payload exposes ONLY boot-time-resolved boolean flags — NOT the underlying values of `datacollaboration.slack-oauth-token` / `notifications.receivers.*` / any sensitive sub-key. The information disclosure surface is intentionally narrow (FeatureResolverImpl.java:22-28 only emits enum values, not their backing config)"
  - "the BooleanUtils.isTrue (FeatureResolverImpl.java:22, 26) treats null as false — a missing config key produces an empty FeatureList without throwing, which is the desired behavior since both keys are declared with no explicit default in any @Value annotation (lines 7, 10 use the bare SpEL form `${datacollaboration.enabled}` / `${notifications.enabled}` — but application.yml:173 and :205 supply the false defaults so the missing-key path is dead in stock deployments)"
- audiences:
  - "the SPA's `App.tsx:43-51` useEffect — single call per app-mount, no retry, no polling; the response populates `appInfo.slice.ts:13-15` and feeds the `getActiveFeatures` selector (`appInfo.selectors.ts:7-10`)"
  - "every `WithFeature featureName={Feature.X}` wrapper across the SPA: `MessagesList/Message/Message.tsx:59` (Open in Slack button on collaboration messages), `MainThreadMessage.tsx`, `DataEntityDetailsHeader.tsx:132` (CreateMessageForm visibility) — these collapse to render-nothing when the corresponding feature flag is absent from the response"
  - "indirectly: every authenticated UI user across all four auth modes, plus every anonymous network caller under DISABLED"

## dependencies_semantic

- requires-feature:
  - "**Spring Boot @Value SpEL resolution** — the resolver reads two SpEL expressions at component instantiation (FeatureResolverImpl.java:17-18); if the SpEL evaluator fails (typo in the property name in a downstream deployment override, or a missing required key with no application.yml default), Spring fails the @Component constructor at boot, which aborts application startup. There is no fail-soft path that would let the app boot with an unknown feature-flag state"
  - "**OpenAPI-generated controller scaffolding** — `FeatureController implements FeatureApi` (line 14); the OpenAPI spec at `openapi.yaml:100-113` defines `getActiveFeatures` with operationId `getActiveFeatures`, GET `/api/features/active`, returns `FeatureList`. Any spec change (e.g. adding a third Feature enum value `GENAI_QUERY_ASSIST` for `genai.enabled`) regenerates the API interface and requires updating the FeatureResolverImpl constructor (16-31) to inject the additional @Value and contribute to the activeFeatures set"
  - "**Feature enum constancy across UI and backend** — the response items are `Feature` enum values; the UI's generated-sources Permission enum is shipped as a separate package. The set is currently small (2 values) but any divergence (a Feature added backend-side without UI regeneration) renders the new flag as an unknown value at WithFeature, which evaluates to `activeFeatures.includes(featureName)` = false — i.e. the UI silently treats the new feature as disabled even when the backend says it is on"
- requires-config:
  - "**`datacollaboration.enabled`** (FeatureResolver.java:6-7, application.yml:200-205) — boolean; default `false`; the @Value binding is `${datacollaboration.enabled}` with NO default in the SpEL itself, so absence of the key in BOTH application.yml AND environment WOULD cause bootstrap failure (BeanCreationException citing IllegalArgumentException 'Could not resolve placeholder'). The bundled application.yml supplies false, so stock deployments are safe; operators overriding application.yml without including the key would break boot"
  - "**`notifications.enabled`** (FeatureResolver.java:9-10, application.yml:172-173) — boolean; default `false`; same SpEL pattern and same bootstrap-failure-on-missing concern"
  - "**`auth.type` indirectly** — the controller itself reads no auth-related config, but its accessibility shifts dramatically across the four auth modes. Under DISABLED (application.yml:34, the bundled default), `DisabledAuthSecurityConfiguration.java:13-18` exposes ALL endpoints to anonymous callers; under LOGIN_FORM / OAUTH2 / LDAP the endpoint is `.authenticated()` per `LoginFormSecurityConfiguration.java:57` / `AuthorizationCustomizer.java:29-30` (no entry in WHITELIST_PATHS at SecurityConstants.java:95-96 and no entry in LoginForm's permittedPaths at lines 49-51)"
- requires-runtime:
  - "Spring WebFlux + Reactor 3 (`Mono<ResponseEntity<...>>` return shape; `Mono.just`, `.map`) — lines 10, 18-19"
  - "Spring Web MVC annotation set (`@RestController`) — line 12"
  - "Lombok `@RequiredArgsConstructor` for the single private final FeatureResolver dependency injection (line 13, 15)"
  - "Apache Commons Lang3 BooleanUtils.isTrue — FeatureResolverImpl.java:6, 22, 26 — handles the null-Boolean defensive case"
  - "the OpenAPI-generated `FeatureApi` interface, `FeatureList`, `Feature` (lines 4-5)"
- couples-to:
  - "`FeatureResolver` interface (service/feature/FeatureResolver.java:5-13) — sole service dependency; carries the SpEL property-name constants"
  - "`FeatureResolverImpl` (service/feature/FeatureResolverImpl.java:13-37) — boot-time @Value-injected concrete implementation"
  - "the SPA's appInfo slice: `App.tsx:49` (dispatch) + `appInfo.thunks.ts:6-13` (the fetchActiveFeatures thunk) + `appInfo.slice.ts:13-15` (the fulfilled reducer) + `appInfo.selectors.ts:7-10` (the consuming selector)"
  - "every `WithFeature` consumer (`WithFeature.tsx:15-36`): `Message.tsx:59` (Open in Slack on collaboration messages), `MainThreadMessage.tsx`, `DataEntityDetailsHeader.tsx:132` (the entire DataCollaboration thread surface on data-entity detail pages)"
  - "the @ConditionalOnDataCollaboration / @ConditionalOnNotifications backend conditions (DataCollaborationFeatureCondition, NotificationsFeatureCondition) — these gate the BACKEND bean wiring on the SAME config keys, so the resolver and the conditional beans are intentionally synchronized by config but completely uncoupled in code"

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "When `datacollaboration.enabled=true` and `notifications.enabled=true`, GET /api/features/active returns 200 with items containing exactly {DATA_COLLABORATION, ALERT_NOTIFICATIONS}"
    test_class: integration
    criticality: HIGH
    note: "the happy path; without a regression test, a refactor that changes the resolver's flag-to-enum mapping (e.g. swapping which @Value binds to which enum) silently breaks every WithFeature wrapper in the UI"
  - behaviour: "When BOTH flags are false (the bundled application.yml defaults), GET /api/features/active returns 200 with items=[] (empty list, NOT null, NOT 404)"
    test_class: integration
    criticality: HIGH
    note: "stock-deployment baseline — a regression to null would break the UI selector's `appInfo.activeFeatures || emptyArr` fallback (appInfo.selectors.ts:9) only if the response shape itself shifted; the items.length===0 path is the actual UI-correctness check"
  - behaviour: "Under auth.type=DISABLED, an anonymous caller hitting GET /api/features/active receives 200 OK"
    test_class: security
    criticality: MEDIUM
    note: "the PROVIDER-NULL-BLEED facet — anonymous reachability is real but the payload is operator-policy-configurable booleans, not principal-identity or credentials; severity is reduced vs IdentityController and IntegrationController but the asymmetric defaults across modes deserve an explicit assertion so a future shift to permitAll cannot be silently undone"
  - behaviour: "Under auth.type=LOGIN_FORM / OAUTH2 / LDAP, an anonymous caller hitting GET /api/features/active is blocked (401 OR 302 to /login) BEFORE reaching FeatureController"
    test_class: security
    criticality: HIGH
    note: "the defence-in-depth assertion against accidental whitelist additions — if /api/features/active is ever added to SecurityConstants.WHITELIST_PATHS or LoginFormSecurityConfiguration.permittedPaths (perhaps to support a pre-login feature-toggle exposing the SSO buttons), a regression test would catch the shift"
  - behaviour: "Runtime mutation of datacollaboration.enabled or notifications.enabled (via /actuator/refresh, JVM system properties, environment update + reload) is NOT reflected in the response — the resolver's activeFeatures set is captured at boot and immutable thereafter"
    test_class: integration
    criticality: LOW
    note: "the immutability invariant; the test would assert that a property-source refresh leaves the response unchanged. Useful to lock in the current behaviour before a future operator-feature-request to make flags hot-reloadable lands"
- test_files: []
- gaps: |
    Zero direct test coverage on FeatureController OR FeatureResolverImpl. The
    integration-class HAPPY-PATH gap is the highest-leverage miss — a regression
    that breaks the @Value-to-Feature mapping (e.g. renaming a SpEL property
    without updating the resolver) silently disables the entire DataCollaboration
    UI for everyone. The security-class CROSS-MODE gap (the second-highest)
    catches accidental whitelist drift, but the worst-case blast radius is
    modest given the payload is just enum names. Highest-leverage test_class:
    integration (the happy-path mapping + the empty-list baseline together
    cover the practical regression surface).

## docs_link_semantic

- declared_docs: []     # no @docs annotation in FeatureController.java or FeatureResolver*.java
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform"
    anchor: ""
    rationale: "the live page enumerates datacollaboration.enabled and notifications.enabled as feature-toggle config keys — the same two keys this controller resolves at boot"
    last_verified_at: "2026-05-25T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      "datacollaboration.enabled: must be set to `true`. Defaults to `false`"
      "notifications.enabled: must be set to `true`. Defaults to `false`"
      "The feature is 'API-only' with '7 routes across three groups...all gated by `@ConditionalOnDataCollaboration` and returning `404 Not Found` when `datacollaboration.enabled=false`'"
  - url: "https://docs.opendatadiscovery.org/active-platform-features/data-collaboration"
    anchor: ""
    rationale: "candidate canonical page for the DATA_COLLABORATION feature flag; would be the operator-facing answer to 'why is my Open-in-Slack button missing?'"
    last_verified_at: "2026-05-25T00:00:00Z"
    last_verified_status: 404
    confidence: LOW
    fetched_excerpts: |
      WebFetch returned a 404 error page; the URL does not resolve to a content page. The expected canonical page for the data-collaboration feature is missing or the URL pattern is different.
  - url: "https://docs.opendatadiscovery.org/active-platform-features/alerting"
    anchor: ""
    rationale: "candidate canonical page for the ALERT_NOTIFICATIONS feature flag; would be the operator-facing answer to the notifications.enabled flag's UI manifestation"
    last_verified_at: "2026-05-25T00:00:00Z"
    last_verified_status: 404
    confidence: LOW
    fetched_excerpts: |
      WebFetch returned a 404 error page; the URL does not resolve to a content page.
- doc_drift_findings:
  - "the configuration-and-deployment/odd-platform page lists datacollaboration.enabled and notifications.enabled as boolean toggles but does NOT mention that the values are RESOLVED ONCE AT BOOT and a runtime change has no effect — an operator who toggles the YAML and runs /actuator/refresh would reasonably expect the new value to appear in the SPA without restart, but it does not (the resolver's activeFeatures set is captured in the constructor at FeatureResolverImpl.java:16-31). DOC-GAP candidate."
  - "the live docs do not mention `/api/features/active` at all — neither the existence of the endpoint, nor its authentication semantics, nor the fact that under auth.type=DISABLED it is anonymously reachable. The feature-flag exposure surface is invisible to operators reading the published manual. DOC-GAP candidate."
  - "the candidate canonical pages for the two surfaced features (active-platform-features/data-collaboration and active-platform-features/alerting) BOTH return 404. Either the URL patterns have drifted, or these documentation pages don't exist — both are blockers for operators trying to understand what the flags toggle. DOC-GAP candidate."

## implicit_adrs

- "Feature-flag set is BOOT-RESOLVED and IMMUTABLE — the resolver captures the @Value-injected booleans into a `private final Set<Feature>` in the constructor (FeatureResolverImpl.java:14, 20, 30) rather than reading the config at every call. This is an explicit decision to trade hot-reloadability for memory + per-call latency simplicity." — evidence: FeatureResolverImpl.java:14, 16-31 — intent_anchor: "the constructor body builds activeFeatures into a HashSet then assigns to `this.activeFeatures = activeFeatures` (line 30); the `final` modifier on the field (line 14) makes the immutability a compile-time guarantee, not an oversight" — confidence: HIGH
- "Feature set is INTENTIONALLY NARROW — only TWO Feature enum values (`DATA_COLLABORATION`, `ALERT_NOTIFICATIONS` at components.yaml:115-119) are exposed even though application.yml carries other feature-shaped boolean toggles (`genai.enabled`, `metrics.export.enabled`, `housekeeping.enabled`, `auth.s2s.enabled`, `auth.ingestion.filter.enabled`). The other toggles are operator-facing-only — they gate backend wiring but do not surface UI controls; the Feature enum is the contract for 'flags the UI cares about'." — evidence: components.yaml:115-119 (only 2 enum values) + application.yml:18, 162, 166, 40, 47 (other toggles that exist but are NOT exposed) — intent_anchor: "the asymmetry between the available boolean toggles (8+ in application.yml) and the surfaced Feature enum (2 values) is consistent; every Feature value corresponds to a UI-visible affordance gated by a `WithFeature` wrapper (`Message.tsx:59`, `DataEntityDetailsHeader.tsx:132`)" — confidence: HIGH
- "Null-tolerant Boolean unwrap — `BooleanUtils.isTrue(...)` rather than the unboxed `boolean` extraction (FeatureResolverImpl.java:22, 26). This is a defensive choice: if the SpEL evaluator returns null (which it would NOT in practice because both keys have application.yml defaults, but COULD if the property source is removed entirely), the resolver gracefully treats it as `false` rather than throwing NullPointerException." — evidence: FeatureResolverImpl.java:6 (import), 17-18, 22, 26 — intent_anchor: "BooleanUtils.isTrue is imported specifically; the `final Boolean` parameter types at lines 17-18 (not `final boolean`) confirm the resolver expects null possibility" — confidence: HIGH

## bugs_limitations_corner_cases

- "Under `auth.type=DISABLED` (the bundled default per application.yml:34), `GET /api/features/active` is anonymously reachable via `DisabledAuthSecurityConfiguration.java:13-18` (`.anyExchange().permitAll()`). The payload exposes which optional features are enabled in the deployment — an external scanner can fingerprint whether the operator has activated DataCollaboration and/or Notifications without authenticating. The PROVIDER-NULL-BLEED facet of REFACTOR-185; severity is reduced vs IdentityController and IntegrationController because the information is operator-policy-configurable booleans (not principal-impersonation, not internal-hostname leak), but the inconsistency across auth modes is real." — evidence: FeatureController.java:12-21 (no @PreAuthorize) + SecurityConstants.java:95-96 (no entry) + LoginFormSecurityConfiguration.java:49-51 (no entry) + DisabledAuthSecurityConfiguration.java:13-18 (permitAll) — severity: LOW
- "Runtime config mutation of `datacollaboration.enabled` or `notifications.enabled` is silently ignored — the resolver captures the boolean values into an immutable `private final Set<Feature>` in the constructor (FeatureResolverImpl.java:14-31). An operator using `/actuator/refresh` (exposed by default per application.yml:228-231 with `env` and `info` actuator endpoints enabled but NOT `refresh`; the refresh endpoint would have to be added explicitly) or hot-swapping environment variables is NOT reflected in subsequent responses. This contradicts the operator's likely mental model — a flag named `enabled` in YAML conventionally suggests runtime toggling." — evidence: FeatureResolverImpl.java:14 (`final` field) + lines 16-31 (constructor captures values) — severity: MEDIUM
- "No Cache-Control header set on the response (FeatureController.java:19 uses bare `ResponseEntity::ok`). Browsers and intermediaries may cache the response; combined with the boot-time immutability, this means an operator restarting the platform with a new feature-flag configuration MAY see stale UI behaviour on long-lived browser sessions until the next page hard-reload." — evidence: FeatureController.java:19 — severity: LOW
- "No audit logging on whoami-equivalent invocation — the `ServerWebExchange exchange` parameter (line 18) is received but never inspected, no `@Slf4j` declaration on the controller. An anonymous scan under DISABLED is invisible in the operator's log output." — evidence: FeatureController.java:12-21 (no logger, no logging) — severity: LOW
- "The Feature enum is shared between backend and UI as a generated artifact (components.yaml:115-119 + UI generated-sources). If the backend adds a Feature value (e.g. `GENAI_QUERY_ASSIST`) without regenerating the UI generated-sources, the new flag is included in the response but the UI's `WithFeature` consumer at WithFeature.tsx:22-25 evaluates `activeFeatures.includes(featureName)` with a Feature enum value the UI doesn't know about — the value is silently dropped from the comparison set; the UI WithFeature wrapper renders nothing for the new flag. Coordinated backend+UI changes are required; absence of a backend test for the round-trip (mentioned in tests_coverage_semantic gaps) means this kind of drift goes undetected." — evidence: components.yaml:115-119 (the enum source) + WithFeature.tsx:22-25 (the consumer) — severity: LOW
- "The two SpEL bindings (FeatureResolverImpl.java:17-18) use `${datacollaboration.enabled}` and `${notifications.enabled}` WITHOUT a SpEL-level default (e.g. `${datacollaboration.enabled:false}`). If a downstream deployment override removes these keys without supplying a replacement, the @Component constructor fails at boot with `Could not resolve placeholder 'datacollaboration.enabled'`. The bundled application.yml supplies the defaults so stock installs are safe, but a minimal externalized config (e.g. an operator who wrote `auth.type=OAUTH2` to a new application.yml without copying the rest) would brick startup with an opaque error." — evidence: FeatureResolver.java:7, 10 (the SpEL strings) + FeatureResolverImpl.java:17-18 (the @Value sites) — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables: []   # no numeric literals, no @Value with default, no constant counts/limits/timeouts in FeatureController.java or FeatureResolverImpl.java
  name_behavior_pairs:
    - name: "FeatureController.getActiveFeatures (GET /api/features/active)"
      promise: "returns the set of platform features that are currently enabled — the wording suggests a runtime-current view"
      implementation: "returns the set computed ONCE at @Component instantiation (FeatureResolverImpl constructor, lines 16-31). Each call wraps the immutable boot-time set in a fresh FeatureList; the underlying set never changes after boot."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "an operator who runs `/actuator/refresh` (if exposed) after toggling `datacollaboration.enabled` would reasonably expect the next `/api/features/active` call to reflect the new value, but it returns the OLD boot-time set until process restart. The endpoint name 'getActiveFeatures' / 'active features' implies runtime-current; the implementation is boot-snapshot."
      confidence: STATIC-INFERRED
      evidence: "FeatureController.java:17-20 (the controller wrapper) + FeatureResolverImpl.java:14 (`final` field) + lines 16-31 (constructor captures values once) + line 35 (resolveActiveFeatures returns a wrapper around the SAME activeFeatures set every call)"
  orderings:
    - location: "FeatureResolverImpl.java:35"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer?"
          a: "There is no database query — the entire computation is in-memory. The Set<Feature> is a HashSet (FeatureResolverImpl.java:20), which has NO defined iteration order. The final ArrayList wrap at line 35 preserves HashSet iteration order, which is unspecified (HotSpot HashSet iteration is influenced by enum.hashCode() but is not contractually stable across JVM versions or set sizes)."
          confidence: STATIC-INFERRED
          evidence: "FeatureResolverImpl.java:20 (`new HashSet<>()`), line 35 (`new ArrayList<>(activeFeatures)`)"
        - q: "What is the tie-breaker when sort-key values are equal?"
          a: "N/A — no sort is performed at any layer of this controller's response generation. The UI's `WithFeature.tsx:22` uses `Array.includes(...)`, which is order-independent."
          confidence: STATIC-INFERRED
          evidence: "FeatureResolverImpl.java:35 + WithFeature.tsx:22-25"
        - q: "Which subset is returned when result-set > page size?"
          a: "N/A — there is no pagination. The response always contains the full active feature set; cardinality is bounded by the Feature enum size (currently 2 values per components.yaml:115-119), so paging is unnecessary."
          confidence: STATIC-INFERRED
          evidence: "FeatureController.java:18 (no Pageable parameter) + FeatureResolverImpl.java:35 (returns the full ArrayList)"
        - q: "Does any upstream layer re-sort or filter the result?"
          a: "No. The UI selector `appInfo.selectors.ts:7-10` returns the array as-is; `WithFeature.tsx:22-25` uses `.includes` (order-independent membership test). No layer cares about element order."
          confidence: STATIC-INFERRED
          evidence: "appInfo.selectors.ts:7-10 + WithFeature.tsx:22-25"
  auth_gates:
    - location: "FeatureController.java:17-20"
      endpoint: "GET /api/features/active"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "DISABLED: 200 OK with current boot-time-resolved FeatureList (anonymously reachable per DisabledAuthSecurityConfiguration.java:13-18 `.anyExchange().permitAll()`). LOGIN_FORM / OAUTH2 / LDAP: per LoginFormSecurityConfiguration.java:55-57 / AuthorizationCustomizer.java:29-30, falls through to `pathMatchers('/**').authenticated()` — anonymous callers receive 302 redirect to /login (LOGIN_FORM) or 401 (OAUTH2 / LDAP); authenticated users receive 200 OK with the same FeatureList."
          confidence: STATIC-INFERRED
          evidence: "DisabledAuthSecurityConfiguration.java:13-18 (permitAll) + LoginFormSecurityConfiguration.java:49-57 (permittedPaths does NOT include /api/features/active so .authenticated() applies) + SecurityConstants.java:95-96 (WHITELIST_PATHS does NOT include /api/features/active) + AuthorizationCustomizer.java:22-30 (whitelist then .authenticated)"
        - q: "What does an unauthenticated caller see?"
          a: "Under DISABLED: 200 OK with the FeatureList. Under LOGIN_FORM: 302 redirect to /login. Under OAUTH2: 302 redirect to OAuth provider OR 401 depending on client (curl typically receives 302; the SPA's API client returns the 302 as a fetch failure caught by `App.tsx:49`'s `.catch(() => {})`). Under LDAP: same as OAUTH2."
          confidence: PROBE-NEEDED
          evidence: "P-132 — the exact response status code (302 vs 401) and body shape under LOGIN_FORM/OAUTH2/LDAP for an unauthenticated curl call requires a running stack; static inference can only confirm that `.authenticated()` applies, not which specific authentication entry-point response is generated"
        - q: "What does a wrong-role caller see?"
          a: "All four auth modes: 200 OK. There is no role-gated access; the endpoint requires only AUTHENTICATION (not authorization). A READ_ONLY user, a USER, and an ADMIN all receive identical responses — the role distinction has no effect on this endpoint. This is by design; the FeatureList is intentionally not role-scoped (the same flags apply to all users)."
          confidence: STATIC-INFERRED
          evidence: "FeatureController.java:12-21 (no @PreAuthorize, no programmatic permission check) + SecurityConstants.java:98-355 (no SecurityRule binds /api/features/active to any PolicyPermissionDto) + LoginFormSecurityConfiguration.java:57 + AuthorizationCustomizer.java:29 (both: `pathMatchers('/**').authenticated()` — no role distinction in the fall-through)"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "The authentication gate lives in the per-mode SecurityWebFilterChain: LoginFormSecurityConfiguration.java:55-57 (LOGIN_FORM), AuthorizationCustomizer.java:29-30 (OAUTH2 + LDAP), DisabledAuthSecurityConfiguration.java:13-18 (DISABLED, which short-circuits to permitAll). There is NO controller-level @PreAuthorize, NO service-level check (FeatureResolverImpl.java:33-36 returns unconditionally), NO repository (there's no DB query). The gate is exclusively at the filter chain."
          confidence: STATIC-INFERRED
          evidence: "FeatureController.java:12-21 + FeatureResolverImpl.java:33-36 + LoginFormSecurityConfiguration.java:55-57 + AuthorizationCustomizer.java:22-30 + DisabledAuthSecurityConfiguration.java:13-18"
  resource_boundaries:
    - location: "FeatureResolverImpl.java:14, 16-31, 33-36"
      kind: concurrency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "No. The `activeFeatures` field is `private final Set<Feature>` (line 14) — assigned ONCE in the constructor (line 30) and never mutated. Concurrent reads in `resolveActiveFeatures` (line 33-36) wrap the SAME set in a fresh ArrayList per call (line 35). The HashSet is not used for writes after construction, so there is no race window. JMM publication is safe via the final field semantics: any thread that observes the `featureResolver` reference observes the fully-initialized set."
          confidence: STATIC-INFERRED
          evidence: "FeatureResolverImpl.java:14 (final field) + line 30 (constructor assignment) + line 35 (read-only iteration via ArrayList copy)"
        - q: "Is the call replay-safe?"
          a: "Yes, idempotent — every call returns the same content (modulo the FeatureList object identity, which is fresh per call but value-equal). No side effects: no DB writes, no metric emissions, no log lines, no cache mutations, no SSE pushes. The endpoint is pure-read."
          confidence: STATIC-INFERRED
          evidence: "FeatureController.java:18-19 (only `Mono.just`, `.map`) + FeatureResolverImpl.java:33-36 (no side effects)"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No backend cache (no @Cacheable, no manual cache mutation). However, the resolver IS effectively a 'cache' with TTL=application-lifetime: the activeFeatures set is captured at boot and never invalidated until the process restarts. There is no @Scheduled refresher, no @RefreshScope, no @EventListener for ContextRefreshedEvent. The 'staleness window' between an operator updating application.yml and the running process reflecting the new value is the time-to-restart, which is unbounded."
          confidence: STATIC-INFERRED
          evidence: "FeatureResolverImpl.java:12 (only @Component, no caching annotations) + line 14 (final field — never reassigned) + entire file (no @RefreshScope, no @Scheduled, no @EventListener)"
  request_inputs:
    - location: "FeatureController.java:18"
      input_kind: query-param
      input_name: "(none — the endpoint takes no query parameters)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "<generic — no request inputs of any kind beyond the ServerWebExchange exchange parameter, which is implicit Spring infrastructure and not user-supplied>"
          confidence: STATIC-INFERRED
          evidence: "FeatureController.java:18 (only `final ServerWebExchange exchange` parameter, no @PathVariable, no @RequestParam, no @RequestBody)"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "The ServerWebExchange parameter is received but NEVER read in the controller body (line 18 declares it; line 19 ignores it). It is forwarded by OpenAPI-generated FeatureApi signatures as part of the Spring WebFlux scaffold. The controller does not consult exchange.getRequest().getHeaders(), getQueryParams(), or any per-request attribute."
          confidence: STATIC-INFERRED
          evidence: "FeatureController.java:18 (parameter declared) + line 19 (parameter unused in the call to featureResolver.resolveActiveFeatures())"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — there are no caller-supplied inputs to align. The endpoint is parameterless by design, returning the global feature-flag state. The ServerWebExchange is generated-API boilerplate, not a behavior-carrying input. Note for completeness: an interesting OPPOSITE case applies here — the absence of a Permission/Authentication parameter means there is NO per-user scoping; the response is identical across all callers (admin, USER, READ_ONLY, anonymous-under-DISABLED) — which is the explicit design choice (feature flags are deployment-wide, not user-scoped)."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "FeatureController.java:17-20 — no caller-supplied request input"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — no translation, no silent drift, no caller-supplied input."
          confidence: STATIC-INFERRED
          evidence: "FeatureController.java:17-20"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE. The single received parameter (ServerWebExchange exchange) IS available-but-unused, but it carries no semantic 'name' that a caller would supply — it is Spring infrastructure plumbing, not a user-input slot."
          confidence: STATIC-INFERRED
          evidence: "FeatureController.java:18-19"
      routes_to_finding: ""   # no drift to route
  probes_emitted:
    - probe_id: P-132
      question: "Under LOGIN_FORM / OAUTH2 / LDAP, what is the exact HTTP status code (302 vs 401) and response shape an UNAUTHENTICATED curl caller sees when hitting GET /api/features/active? Static inference confirms .authenticated() applies but cannot determine the precise filter-chain response without runtime verification."
      probe_path: "lineage/odd-platform/probes/P-132.yaml"
    - probe_id: P-133
      question: "Under auth.type=DISABLED, does an anonymous curl caller actually receive 200 OK on GET /api/features/active with a FeatureList body? Static inference of DisabledAuthSecurityConfiguration.java:13-18 + the absence of any service-level gate indicates yes, but the PROVIDER-NULL-BLEED FACET deserves explicit verification given that REFACTOR-185's HIGH-severity claim across siblings is the operating premise. Plus the boot-immutability invariant (env-change without restart does not change response)."
      probe_path: "lineage/odd-platform/probes/P-133.yaml"
  stress_summary:
    triggers_total: 5    # 0 tunables + 1 name-behavior + 1 ordering site + 1 auth gate + 1 resource boundary + 1 request-input
    questions_total: 18   # 0 + 3 + 4 + 4 + 3 + 5 (note: ordering questions adapted to N/A where appropriate)
    answers_static_inferred: 16
    answers_probe_needed: 2
    answers_reference: 0
    drift_flags: 1        # the boot-time-immutable DRIFT_NAME_VS_BEHAVIOR finding
```

## security

- auth_mode_relevance: ["DISABLED", "LOGIN_FORM", "OAUTH2", "LDAP"]   # affects all four modes; only DISABLED grants anonymous access
- ingestion_filter_relevance: "NO — UI/API surface (`/api/features/active`), not ingestion (`/ingestion/**`). The S2sAuthenticationFilter at LoginFormSecurityConfiguration.java:62 / OAuthSecurityConfiguration triggers only on the `/api/**` post-filter chain when s2sEnabled=true and the X-API-Key header is present; this controller is reachable through that path but the filter does not specifically gate it"
- authorization_assertions: []   # no @PreAuthorize on FeatureController.java:12-21; no programmatic permissionService.hasPermission call in FeatureResolverImpl.java:13-37; no SecurityRule in SecurityConstants.java binds /api/features/active to a PolicyPermissionDto. The authorization model is intentionally absent — feature flags are deployment-scoped and uniform across all users.
- owner_scoping: "N/A — code is not data-scoped. The response is a global deployment-state view; no per-Owner / per-user filtering applies."
- data_exposure:
  - "Set of boot-time-resolved Feature enum values (currently DATA_COLLABORATION and/or ALERT_NOTIFICATIONS) → any authenticated user under LOGIN_FORM / OAUTH2 / LDAP"
  - "Set of boot-time-resolved Feature enum values → any anonymous caller under auth.type=DISABLED (the bundled default per application.yml:34)"
  - "The response carries ONLY enum names; it does NOT expose the underlying values of `datacollaboration.slack-oauth-token`, `notifications.receivers.*.url`, `notifications.receivers.*.host`, or any sensitive sub-key — the information-disclosure surface is intentionally minimized to the on/off boolean state"
- known_security_gaps:
  - "Under auth.type=DISABLED (the bundled default), GET /api/features/active is anonymously reachable per DisabledAuthSecurityConfiguration.java:13-18 (`.anyExchange().permitAll()`). An external scanner can fingerprint which optional platform features are activated without authenticating. This is the PROVIDER-NULL-BLEED-LIMITED-RISK FACET of REFACTOR-185 — the information leak is real but narrower than the IdentityController principal-impersonation facet or the IntegrationController internal-hostname facet because the payload is only enum names." — evidence: FeatureController.java:12-21 + DisabledAuthSecurityConfiguration.java:13-18 — severity: LOW
  - "No audit logging on access. The ServerWebExchange parameter (line 18) is received but never inspected; no `@Slf4j` declaration, no log statement on invocation. An anonymous scan under DISABLED is invisible in application logs; a misbehaving authenticated user enumerating feature-flag state cannot be retroactively detected." — evidence: FeatureController.java:12-21 — severity: LOW
  - "No Cache-Control / Pragma header set on the response. Browsers, CDNs, and intermediate caches may cache the response for an arbitrary duration; combined with the boot-immutability of the underlying set, this means stale state can persist across application restarts in long-lived browser sessions until hard-reload." — evidence: FeatureController.java:19 (`ResponseEntity::ok` without `.cacheControl(...)`) — severity: LOW

## performance

- hot_paths:
  - "GET /api/features/active is dispatched ONCE per app-mount from `App.tsx:46-51`'s useEffect (single empty dep-array, no retries). For an authenticated SPA user, this is a one-time per-tab call. The endpoint itself runs in nanoseconds — `featureResolver.resolveActiveFeatures()` (FeatureResolverImpl.java:33-36) wraps a 0-to-2-element ArrayList; no DB I/O, no cache lookup, no external HTTP." — evidence: FeatureController.java:18-19 + FeatureResolverImpl.java:33-36 + App.tsx:46-51
- throughput_characteristics:
  - "single-call per request — no batching needed; the response cardinality is bounded by the Feature enum size (currently 2 values per components.yaml:115-119)"
  - "reactive Mono signature (FeatureController.java:18 `Mono<ResponseEntity<FeatureList>>`); the controller does not block; `Mono.just(...)` is a non-blocking publication of the pre-computed result"
- resource_allocation:
  - "per-call allocation: one fresh FeatureList wrapper + one fresh ArrayList<Feature> (FeatureResolverImpl.java:35 — `new ArrayList<>(activeFeatures)`). For a 2-element set, this is two small heap allocations (< 100 bytes total); the allocation cost is dwarfed by the Spring WebFlux request scaffolding"
  - "the underlying activeFeatures set is allocated ONCE at boot (FeatureResolverImpl.java:20, 30) — never copied on read, just iterated"
- scaling_characteristics:
  - "stateless controller — horizontally scaleable; each instance computes the same activeFeatures at its own boot from the same application.yml / environment, so all replicas converge to the identical set when their config sources are identical (the convergence is contingent on operator config-source uniformity, not on any cross-replica coordination in code)"
  - "no pagination — the response is always the full small set (≤ Feature.values().length, currently 2)"
- known_performance_gaps:
  - "boot-immutability means a coordinated rollout (e.g. canary instance with `datacollaboration.enabled=true` while stable replicas have it false) will return INCONSISTENT FeatureLists across replicas during the rollout window — a UI session that load-balances across the canary and stable instances will see flicker between the `WithFeature` wrappers showing/hiding the Open-in-Slack button. The frontend caches the response in the appInfo slice (appInfo.slice.ts:14) so the flicker is only visible on App-component remount; nonetheless, the per-replica boot snapshot is not coordinated cluster-wide. This is acceptable for the current OSS-single-instance baseline but would matter for an HA deployment." — evidence: FeatureResolverImpl.java:14, 16-31 — severity: LOW

## upstream_callers

- entry_point: "ui_route:* (every routed page)"
  caller_node: "ts react-component:App.tsx"
  multiplicity_per_trigger: 1
  evidence: "App.tsx:46-51 — the `useEffect(() => { dispatch(fetchActiveFeatures()).catch(() => {}); }, [])` fires ONCE per App-component mount; the empty dep-array makes this once-per-session-tab unless App is remounted (which happens on logout/login round-trip and on full page reload, not on route changes). The thunk at appInfo.thunks.ts:6-13 calls `featureApi.getActiveFeatures()` exactly once."
  observation_class: ui-call
- entry_point: "rest:GET /api/features/active"
  caller_node: "unresolved — external HTTP callers (curl, integration smoke tests, monitoring probes)"
  multiplicity_per_trigger: 1
  evidence: "FeatureController.java:17-20 (the OpenAPI-declared endpoint at openapi.yaml:100-113). Under auth.type=DISABLED, anonymous external callers reach this endpoint directly."
  observation_class: rest-call

## downstream_side_effects

- side_effect_class: page-render
  description: "Returns a JSON FeatureList payload (typically {items:[]}, {items:[DATA_COLLABORATION]}, {items:[ALERT_NOTIFICATIONS]}, or {items:[DATA_COLLABORATION, ALERT_NOTIFICATIONS]} depending on the boot-time-resolved config) to the caller"
  evidence: "FeatureController.java:18-19 + FeatureResolverImpl.java:34-36"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:* (every routed page, transitively via App mount)"
    - "rest:GET /api/features/active"

## sources

- understanding ← FeatureController.java:1-21 + FeatureResolver.java:1-13 + FeatureResolverImpl.java:1-37 + SecurityConstants.java:95-96 + LoginFormSecurityConfiguration.java:49-57 + DisabledAuthSecurityConfiguration.java:13-18 + AuthorizationCustomizer.java:22-30 + application.yml:34, 173, 205 + WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform (200 OK)
- concepts.entities.FeatureController ← FeatureController.java:12-21
- concepts.entities.FeatureApi ← openapi.yaml:100-113
- concepts.entities.Feature ← components.yaml:115-119
- concepts.entities.FeatureList ← components.yaml:121-127
- concepts.entities.FeatureResolver ← FeatureResolver.java:1-13
- concepts.entities.FeatureResolverImpl ← FeatureResolverImpl.java:1-37
- concepts.operations.delegate-to-feature-resolver ← FeatureController.java:19
- concepts.invariants.boot-once-immutable ← FeatureResolverImpl.java:14, 16-31
- dependencies_semantic.requires-config.datacollaboration.enabled ← FeatureResolver.java:6-7 + FeatureResolverImpl.java:17 + application.yml:200-205
- dependencies_semantic.requires-config.notifications.enabled ← FeatureResolver.java:9-10 + FeatureResolverImpl.java:18 + application.yml:172-173
- dependencies_semantic.requires-config.auth.type-indirectly ← DisabledAuthSecurityConfiguration.java:13-18 + LoginFormSecurityConfiguration.java:55-57 + AuthorizationCustomizer.java:22-30 + SecurityConstants.java:95-96 + application.yml:32-34
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform 2026-05-25 status 200
- docs_link_semantic.inferred_docs.[1] ← WebFetch https://docs.opendatadiscovery.org/active-platform-features/data-collaboration 2026-05-25 status 404
- docs_link_semantic.inferred_docs.[2] ← WebFetch https://docs.opendatadiscovery.org/active-platform-features/alerting 2026-05-25 status 404
- implicit_adrs.[0] (boot-resolved-immutable) ← FeatureResolverImpl.java:14, 16-31
- implicit_adrs.[1] (intentionally-narrow-Feature-enum) ← components.yaml:115-119 + application.yml various toggles
- implicit_adrs.[2] (null-tolerant-Boolean-unwrap) ← FeatureResolverImpl.java:6, 17-18, 22, 26
- bugs_limitations_corner_cases.[0] (DISABLED-anonymous-reachability) ← FeatureController.java:12-21 + SecurityConstants.java:95-96 + LoginFormSecurityConfiguration.java:49-51 + DisabledAuthSecurityConfiguration.java:13-18
- bugs_limitations_corner_cases.[1] (runtime-mutation-ignored) ← FeatureResolverImpl.java:14, 16-31
- bugs_limitations_corner_cases.[2] (no-cache-control) ← FeatureController.java:19
- bugs_limitations_corner_cases.[3] (no-audit-logging) ← FeatureController.java:12-21
- bugs_limitations_corner_cases.[4] (Feature-enum-UI-backend-skew) ← components.yaml:115-119 + WithFeature.tsx:22-25
- bugs_limitations_corner_cases.[5] (SpEL-no-default-boot-failure-risk) ← FeatureResolver.java:7, 10 + FeatureResolverImpl.java:17-18
- security.auth_mode_relevance ← DisabledAuthSecurityConfiguration.java:13-18 + LoginFormSecurityConfiguration.java:49-57 + AuthorizationCustomizer.java:22-30 + SecurityConstants.java:95-96
- security.known_security_gaps.[0] ← FeatureController.java:12-21 + DisabledAuthSecurityConfiguration.java:13-18
- security.known_security_gaps.[1] ← FeatureController.java:12-21 (no @Slf4j, no logger)
- security.known_security_gaps.[2] ← FeatureController.java:19 (bare ResponseEntity.ok)
- performance.hot_paths.[0] ← FeatureController.java:18-19 + FeatureResolverImpl.java:33-36 + App.tsx:46-51
- performance.known_performance_gaps.[0] ← FeatureResolverImpl.java:14, 16-31
- upstream_callers.[0] (ui:App.tsx) ← App.tsx:46-51 + appInfo.thunks.ts:6-13 + appInfo.slice.ts:13-15
- upstream_callers.[1] (rest:external) ← FeatureController.java:17-20 + openapi.yaml:100-113
- downstream_side_effects.[0] (page-render) ← FeatureController.java:18-19 + FeatureResolverImpl.java:34-36
- stress_findings.name_behavior_pairs.[0] (boot-immutable drift) ← FeatureController.java:17-20 + FeatureResolverImpl.java:14, 16-31, 33-36
- stress_findings.auth_gates.[0] ← FeatureController.java:12-21 + DisabledAuthSecurityConfiguration.java:13-18 + LoginFormSecurityConfiguration.java:49-57 + AuthorizationCustomizer.java:22-30 + SecurityConstants.java:95-96
- stress_findings.resource_boundaries.[0] ← FeatureResolverImpl.java:14, 16-31, 33-36
- stress_findings.probes_emitted.[0] (P-132) ← lineage/odd-platform/probes/P-132.yaml
- stress_findings.probes_emitted.[1] (P-133) ← lineage/odd-platform/probes/P-133.yaml

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH
- upstream_callers: HIGH
- downstream_side_effects: HIGH
- stress_findings: HIGH    # 16 of 18 questions STATIC-INFERRED with strong evidence; 2 PROBE-NEEDED for runtime auth-mode response shapes; no REFERENCE answers

## Maintainer notes


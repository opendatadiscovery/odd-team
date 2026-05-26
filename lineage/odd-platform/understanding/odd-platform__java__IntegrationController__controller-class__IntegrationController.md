---
node_id: "odd-platform java IntegrationController controller-class:IntegrationController"
node_kind: controller-class
axis: controllers
extracted_at_commit: 4ec2b20
enriched_at_commit: 4ec2b20
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-25-ZD-IntegrationController
pillar_anchored_features:
  - P-08 Management & Administration (Integrations tab — Integration Wizard surface)
  - P-09 Security & Access Control (auth-mode-only gating; NO RBAC permission for /api/integrations)
  - P-10 Integrations & Ingestion (the wizard registry — `META-INF/wizard/*.yaml`)
---

# IntegrationController — semantic understanding

## understanding

`IntegrationController` is a 28-line Spring WebFlux `@RestController` implementing the OpenAPI-generated `IntegrationApi` and exposing exactly two endpoints — `GET /api/integrations` (`getIntegrationPreviews` line 25-27) and `GET /api/integrations/{integration_id}` (`getIntegration` line 19-22) — that serve the **Integration Wizard** surface (`https://docs.opendatadiscovery.org/integrations/integrations/integration-wizard` WebFetched 2026-05-25, status 200). The controller is a **thin two-line delegate per method**: both methods immediately call `integrationService.{get|listPreviews}()` and map the resulting `Mono` to `ResponseEntity::ok`. The wizard registry behind it is a **classpath-loaded read-only YAML manifest store**: `IntegrationRegistryFactory.createResourceFilesIntegrationRegistry` (lines 29-40) scans `classpath*:META-INF/wizard/*.yaml` on boot, deserialises each via `IntegrationDeserializer` (custom Jackson `StdDeserializer<IntegrationOverviewDto>`), and stores them in a `TreeMap<String, IntegrationOverviewDto>` keyed by integration id with case-insensitive ordering (line 36 `Comparator.comparing(String::toLowerCase)`). The mapper interpolates a single static parameter — `platform_url` — sourced from `@Value("${odd.platform-base-url:http://your.odd.platform}")` via `StaticArgumentMappingContext` (lines 11-25). **Five substantive findings drive operator-visible behaviour**: (1) **NO `META-INF/wizard/*.yaml` resources are shipped in this repo** — a default-checkout build has an empty registry; the resource glob `classpath*:META-INF/wizard/*.yaml` returns zero hits, the `TreeMap` is empty, `getIntegrationPreviews` returns `{items: []}`, `getIntegration({any-id})` returns `Mono.empty` → **204 No Content** (`Mono.justOrEmpty(registry.get(id))`); (2) **the `installed` field is hardcoded `false` for every integration** (`IntegrationMapper.java:27, 30` — `@Mapping(target = "installed", constant = "false")`) — the UI's "Integrated" badge on `IntegrationPreviewItem.tsx:44-51` will NEVER render despite the OpenAPI contract declaring `installed: boolean` REQUIRED (`components.yaml:64-70`); (3) **NO RBAC permission gates the controller** — neither `SecurityConstants.SECURITY_RULES` (`SecurityConstants.java:98+`) nor `PolicyPermissionDto` contains any `INTEGRATION_*` entry; under LOGIN_FORM/OAUTH2/LDAP both endpoints fall through to `AuthorizationCustomizer.customize`'s catch-all `pathMatchers("/**").authenticated()` (`AuthorizationCustomizer.java:29-30`); **any authenticated user can read every wizard manifest**, including their content blocks, code snippets, and the live `platform_url` value; (4) **under `auth.type=DISABLED` the wizard surface is anonymously reachable** — `DisabledAuthSecurityConfiguration.java:13-18` applies `.anyExchange().permitAll()`, so any network caller can read every wizard manifest and its embedded `platform_url` (which may leak an internal hostname); (5) **the wizard surface is a config-disclosure endpoint by design** — content blocks ship verbatim collector-configuration YAML templates (token-passing patterns, datasource registration snippets per the live wizard doc page); they do NOT ship live credentials, but they DO expose the platform's `odd.platform-base-url` value substituted into the snippets, which under default config (commented out in `application.yml:209`) renders the placeholder `http://your.odd.platform` but under operator-configured deployments may surface internal-network URLs.

## concepts

- entities: [
    "`IntegrationApi` — OpenAPI-generated controller interface (`api.contract.api.IntegrationApi`) the controller implements via `@Override` on each method; the contract is auto-derived from `openapi.yaml:51-84`.",
    "`Integration` — full-detail response shape (preview + ordered list of content_blocks); declared as an OpenAPI `allOf` extension of `IntegrationPreview` at `components.yaml:82-92`; `id, name, description, installed` (required, inherited from IntegrationPreview) + `content_blocks: array` (required).",
    "`IntegrationPreview` — list-shape preview; `{id: string, name: string, description: string, installed: boolean}` — all four REQUIRED per `components.yaml:55-70`.",
    "`IntegrationPreviewList` — wrapping shape for the list endpoint; `{items: array<IntegrationPreview>}` — REQUIRED per `components.yaml:72-80`.",
    "`IntegrationContentBlock` — section of the wizard content with `{title, content, code_snippets}` all REQUIRED per `components.yaml:39-53`.",
    "`IntegrationCodeSnippet` — `{template: string (required), arguments: array<IntegrationCodeSnippetArgument>}` per `components.yaml:27-37`.",
    "`IntegrationCodeSnippetArgument` — `{parameter, name, type: enum<INTEGER|STRING|BOOLEAN|FLOAT>, static_value}` per `components.yaml:11-25`; the optional `static_value` is the substitution point for `platform_url`.",
    "`IntegrationService` — single injected service bean (line 16); 2-method interface; pure delegation target.",
    "`IntegrationRegistry` — repository interface (`IntegrationRegistry.java:8-12`) with `get(id)` and `list()`; implemented by `ResourceFilesIntegrationRegistry` (a `Map<String, IntegrationOverviewDto>` wrapper).",
    "`StaticArgumentMappingContext` — singleton bean (`@Component`) carrying the `platform_url` substitution value, sourced from `@Value(\"${odd.platform-base-url:http://your.odd.platform}\")` at boot (`StaticArgumentMappingContext.java:15-20`).",
    "`IntegrationOverviewDto` — internal record `(IntegrationPreviewDto integration, List<IntegrationContentBlockDto> contentBlocks)` (`IntegrationOverviewDto.java:8-10`); custom-deserialised from wizard YAML via `IntegrationDeserializer`.",
    "`integrationId` — `String` path-parameter for `getIntegration` (line 19); free-form, no validation. Used as `TreeMap` key — case-insensitive lookup via the comparator.",
    "`ServerWebExchange` — Spring WebFlux reactive request context; injected on both methods but used by NEITHER — pure delegation."
  ]
- operations: [
    "`getIntegration(String integrationId, ServerWebExchange exchange)` (lines 19-22) — single-fetch; delegates to `integrationService.get(integrationId)` → `ResponseEntity::ok`. The service-tier `IntegrationServiceImpl.get` (`:20-23`) delegates to `integrationRegistry.get(id)` (`Mono.justOrEmpty(registry.get(id))` per `ResourceFilesIntegrationRegistry.java:15-17`) then `.map(integration -> integrationMapper.map(integration, staticArgumentMappingContext))`. **On a missing id the inner `Mono.justOrEmpty` returns `Mono.empty`, the `.map` is short-circuited, and the response is `200 OK` with NO body** — Spring WebFlux's reactive controller-return semantics translate `Mono.empty` to `204 No Content` (NOT 404). The path lacks any `switchIfEmpty(Mono.error(new NotFoundException(...)))`.",
    "`getIntegrationPreviews(ServerWebExchange exchange)` (lines 25-27) — list; delegates to `integrationService.listPreviews()` (`IntegrationServiceImpl.java:25-28` → `integrationRegistry.list().collectList().map(integrationMapper::map)`). The registry's `list()` is `Flux.fromIterable(registry.values()).map(IntegrationOverviewDto::integration)` (`ResourceFilesIntegrationRegistry.java:19-22`) — returns ALL integrations, NO pagination, NO filtering at the service layer. The mapper produces `IntegrationPreviewList{items: List<IntegrationPreview>}` with `installed: false` constant on every element."
  ]
- invariants: [
    "**Both endpoints are open-read across all four auth modes plus DISABLED's anonymous case** — neither `SecurityConstants.SECURITY_RULES` (`SecurityConstants.java:98+`) nor `PolicyPermissionDto` defines an `INTEGRATION_*` permission; both paths fall through to the catch-all `pathMatchers(\"/**\").authenticated()` under LOGIN_FORM/OAUTH2/LDAP, and to `.anyExchange().permitAll()` under DISABLED.",
    "**The registry is read-only** — there are no write endpoints; `IntegrationRegistry` exposes only `get` and `list`. The registry is constructed once at boot from classpath resources; there is no admin-API to add/remove integrations at runtime.",
    "**The registry is built lazily-but-once at boot via `IntegrationConfiguration.integrationRegistry()` (`IntegrationConfiguration.java:10-13`)** — Spring instantiates it via `IntegrationRegistryFactory.createResourceFilesIntegrationRegistry()` on bean construction; if the resource scan or YAML parse throws, `IllegalStateException` is propagated and the application context fails to start (`IntegrationRegistryFactory.java:48-50, 59`).",
    "**The registry is case-insensitive on id** — the `TreeMap` comparator is `Comparator.comparing(String::toLowerCase)` (line 36); two manifests with ids `Snowflake` and `snowflake` collide and the later-loaded one wins via the merge function `(o1, o2) -> o2` (line 35). A user lookup for `snowflake` will hit a manifest with id `Snowflake` and vice-versa.",
    "**`installed` is hardcoded `false` on every response** — `IntegrationMapper.java:27` (`@Mapping(target = \"installed\", constant = \"false\")`) and `:30` apply to both the full `Integration` and the preview shape. The OpenAPI declares `installed: boolean` as REQUIRED (`components.yaml:65-70`). There is no code path that detects whether an integration is actually installed/wired into the platform; the field is structurally dead.",
    "**The mapper substitutes `platform_url` from `StaticArgumentMappingContext`** — `IntegrationMapper.map(...).staticValue(ctx.get(dto.parameter()))` (`IntegrationMapper.java:38-45`); the only registered parameter is `platform_url` (`StaticArgumentMappingContext.java:11`). Any code-snippet argument with `parameter=\"platform_url\"` and `static: true` gets the platform's `odd.platform-base-url` substituted in.",
    "**`integrationId` path parameter is free-form `String`** — no `@Pattern`, no validation, no allowlist; passed directly into `TreeMap.get(id)`. Non-existent ids return `Mono.empty` → 204 (the silent-200/204-on-missing pattern).",
    "**No tests cover this controller** — `grep -rln IntegrationController <odd-platform-repo>/odd-platform-api/src/test` returns zero matches; `IntegrationService`, `IntegrationRegistry`, `IntegrationMapper`, `IntegrationDeserializer`, `StaticArgumentMappingContext`, `ResourceFilesIntegrationRegistry`, `IntegrationRegistryFactory` are similarly untested.",
    "**A default-checkout build has ZERO wizard manifests on classpath** — no `META-INF/wizard/*.yaml` resources are shipped in `<odd-platform-repo>` (Glob returned zero hits); the registry is empty by default. Operators add wizards via a docker-image overlay or by placing YAML files on the classpath via custom deployment overlays."
  ]
- audiences: [
    "odd-platform-ui-end-user — Management → Integrations tab (`/management/integrations` UI route per `managementRoutes.ts:7`); list-view via `IntegrationPreviewList.tsx:21` (`useIntegrationPreviews()` from `lib/hooks/api/integration.ts:11-20`); detail view via `Integration.tsx:21` (`useIntegration({ integrationId })` from `integration.ts:22-46`); UI dispatches one fetch per page-mount, no polling, React-Query keys `['integrationPreviews']` and `['integration', integrationId]`.",
    "platform-operator — reads wizard manifests to know what `collector_config.yaml` snippets are available + the `platform_url` substitution; per the live doc page (`https://docs.opendatadiscovery.org/integrations/integrations/integration-wizard` 2026-05-25 status 200): 'In-app UI under Management → Integrations that generates parameterized YAML snippets for plugins, leveraging manifests on the platform's classpath'.",
    "integration-author / custom-collector-developer — supplies the `META-INF/wizard/*.yaml` files that populate the registry (per the wizard's classpath-extension model); the controller serves their work to operators.",
    "any HTTP caller able to reach `/api/integrations*` under the active SecurityWebFilterChain — under DISABLED that's any network caller; under LOGIN_FORM/OAUTH2/LDAP that's any authenticated user regardless of role."
  ]

## dependencies_semantic

- requires-feature: [
    "`IntegrationApi` OpenAPI-generated interface (`odd-platform-api-contract`) — supplies the `@GetMapping`-annotated method signatures, the `String integrationId` path-variable binding, and the response-type erasure (`Mono<ResponseEntity<Integration>>`, `Mono<ResponseEntity<IntegrationPreviewList>>`).",
    "`IntegrationService` (`IntegrationService.java:7-11`) — 2-method service contract; pure delegation target.",
    "`IntegrationServiceImpl` (`IntegrationServiceImpl.java:12-29`) — injects `IntegrationRegistry`, `IntegrationMapper`, `StaticArgumentMappingContext`; orchestrates the per-call pipeline.",
    "`IntegrationRegistry` + `ResourceFilesIntegrationRegistry` — the classpath-backed map of integrations (read-only).",
    "`IntegrationConfiguration` bean factory (`IntegrationConfiguration.java:7-14`) — wires the registry at boot.",
    "`IntegrationRegistryFactory.createResourceFilesIntegrationRegistry()` — scans `classpath*:META-INF/wizard/*.yaml` via `PathMatchingResourcePatternResolver`, parses each via Jackson YAML factory, builds the case-insensitive `TreeMap`.",
    "`IntegrationDeserializer` (`IntegrationDeserializer.java:21-89`) — custom Jackson `StdDeserializer<IntegrationOverviewDto>` that walks the wizard JSON tree → `IntegrationOverviewDto(preview, contentBlocks)`.",
    "`IntegrationMapper` (`IntegrationMapper.java:23-50`) — MapStruct mapper; injects `StaticArgumentMappingContext` via `@Context` to substitute `platform_url`.",
    "`StaticArgumentMappingContext` (`StaticArgumentMappingContext.java:10-25`) — singleton; sources `platform_url` from `@Value(\"${odd.platform-base-url:http://your.odd.platform}\")`."
  ]
- requires-config: [
    "`odd.platform-base-url` — controls the `platform_url` substitution in code-snippet templates; default `http://your.odd.platform` (literal placeholder per `StaticArgumentMappingContext.java:16`). The default in `application.yml:209` is COMMENTED OUT, so the literal placeholder is what operators see if they don't set the override; operators setting the property expose their platform's external URL (or internal hostname) in every code-snippet rendered.",
    "`auth.type` (DISABLED / LOGIN_FORM / OAUTH2 / LDAP) — gates which `SecurityWebFilterChain` applies; the wizard surface is open-read across all modes (no `INTEGRATION_*` SECURITY_RULE entry). Under DISABLED both endpoints are anonymously reachable; under the other three modes any authenticated user can read."
  ]
- requires-runtime: [
    "Spring WebFlux reactive HTTP server — `@RestController` + reactive `Mono<ResponseEntity<...>>` returns.",
    "Reactor Core — `Mono.justOrEmpty`, `Flux.fromIterable`, `.collectList()`, `.map(...)` composition; empty-mono short-circuit semantics drive the 204-on-missing-id behaviour.",
    "Jackson + Jackson-YAML — `ObjectMapper(new YAMLFactory())` (`IntegrationRegistryFactory.java:27`); deserialisation happens once at boot.",
    "Spring `PathMatchingResourcePatternResolver` — scans `classpath*:META-INF/wizard/*.yaml` at registry construction.",
    "MapStruct + Lombok — mapper interface impl auto-generated at compile time.",
    "Active `SecurityWebFilterChain` bean — one of `DisabledAuthSecurityConfiguration` / `LoginFormSecurityConfiguration` / `OAuthSecurityConfiguration` / `LDAPSecurityConfiguration` per `@ConditionalOnProperty(value=\"auth.type\", havingValue=...)`."
  ]
- couples-to: [
    "`IntegrationApi` (line 4 `implements IntegrationApi`) — every method is `@Override`; the OpenAPI-generated interface IS the URL convention.",
    "`IntegrationService` (line 16, constructor-injected via Lombok `@RequiredArgsConstructor`) — 2-method service contract; pure delegation.",
    "`SecurityConstants.SECURITY_RULES` — coupled by ABSENCE (no `INTEGRATION_*` entry; the open-read posture is the architectural decision)."
  ]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
    - behaviour: "Happy-path read — `GET /api/integrations` returns 200 with a non-empty `items` list when one or more `META-INF/wizard/*.yaml` are on classpath."
      test_class: integration
      criticality: HIGH
      test_files: []
      note: "No WebTestClient, no `@SpringBootTest`, no `@WebFluxTest` exercises this controller; no fixture wizard YAML exists in the test resources."
    - behaviour: "Empty-registry path — `GET /api/integrations` returns 200 with `{items: []}` when no wizard YAML is on classpath."
      test_class: integration
      criticality: HIGH
      test_files: []
      note: "This IS the default-build behaviour; absence of a test pins the empty-state shape contractually."
    - behaviour: "Single-integration read — `GET /api/integrations/{id}` returns 200 with full `Integration` payload when the id matches (case-insensitively)."
      test_class: integration
      criticality: HIGH
      test_files: []
    - behaviour: "Missing-id path — `GET /api/integrations/{id}` returns 204 No Content (NOT 404) when the id is unknown."
      test_class: integration
      criticality: MEDIUM
      test_files: []
      note: "Spec contract implies the operator distinguishes 'integration exists but has no body' from 'integration does not exist' — current code returns 204 for both (Mono.empty)."
    - behaviour: "Case-insensitive id collision — two wizard YAMLs with ids `Snowflake` and `snowflake` collapse; the later-loaded wins; lookup of either id returns the survivor."
      test_class: integration
      criticality: MEDIUM
      test_files: []
    - behaviour: "`installed: false` constant — every response has `installed: false`; the UI 'Integrated' badge never renders."
      test_class: unit
      criticality: MEDIUM
      test_files: []
    - behaviour: "`platform_url` substitution — when `odd.platform-base-url=https://my.host:8080` is set, the code-snippet `static_value` field for arguments with `parameter=platform_url` and `static: true` renders the configured value."
      test_class: integration
      criticality: HIGH
      test_files: []
    - behaviour: "Default placeholder — when `odd.platform-base-url` is unset (`application.yml:209` commented), every `platform_url` static_value is `http://your.odd.platform` and operators copy-pasting the snippet point at a non-existent host."
      test_class: integration
      criticality: MEDIUM
      test_files: []
    - behaviour: "DISABLED-mode reachability — both endpoints accept unauthenticated requests under `auth.type=DISABLED`; the live wizard registry (including `platform_url`) is anonymously readable."
      test_class: security
      criticality: HIGH
      test_files: []
    - behaviour: "Open-read posture under LOGIN_FORM/OAUTH2/LDAP — any authenticated user (regardless of role / no `TAG_*`-style permission) gets 200 + full wizard registry."
      test_class: security
      criticality: MEDIUM
      test_files: []
    - behaviour: "Malformed YAML at boot — a corrupt wizard YAML raises `IllegalStateException(\"Couldn't read wizard manifest: ...\")` and the application context fails to start."
      test_class: integration
      criticality: MEDIUM
      test_files: []
    - behaviour: "OpenAPI `installed` contract — assert that `installed: boolean` is REQUIRED on the response; current impl satisfies this with `false` constant; a future change that removed `installed` from the OpenAPI but kept the constant would be silently inconsistent."
      test_class: integration
      criticality: LOW
      test_files: []
    - behaviour: "Unbounded list — `getIntegrationPreviews` has no pagination; with N integrations the response body grows O(N). A deployment with 100+ wizard YAMLs returns the full list in one response."
      test_class: performance
      criticality: LOW
      test_files: []
- test_files: []
- gaps: |
    The controller has zero direct test coverage and the wizard registry stack (`IntegrationRegistryFactory`, `IntegrationDeserializer`, `ResourceFilesIntegrationRegistry`, `IntegrationMapper`, `StaticArgumentMappingContext`) is similarly untested. The combination of:

    (a) **silent 204-on-missing-id** — operators cannot distinguish 'this integration exists but has empty content' from 'this integration does not exist';
    (b) **`installed: false` hardcoded constant** — the UI badge field is structurally dead; the OpenAPI contract promises a meaningful value that the code never delivers;
    (c) **case-insensitive id collision** — two wizards with same-lowercased ids silently merge (last-wins);
    (d) **DISABLED-mode anonymous reachability** — the wizard registry (including `platform_url`, which may surface an internal hostname) is readable to any network caller under the application.yml default;
    (e) **NO RBAC permission** — under LOGIN_FORM/OAUTH2/LDAP every authenticated user gets the full wizard surface regardless of role;
    (f) **boot-time fail-fast on malformed YAML** — a single corrupt wizard manifest takes the entire platform down at startup;

    makes regressions invisible until an operator notices the wizard panel mis-rendering. The highest-leverage gap is the **security test class** — DISABLED-mode reachability + open-read posture under authenticated modes are documented nowhere; a future change that removed the open-read posture (adding an `INTEGRATION_READ` permission) would break the UI silently because no security test pins the contract either way. The second-highest is the **`installed` constant test** — a fix to detect actually-installed integrations (matching wizard id to a registered datasource via `DataSourceRepository`) would be welcomed but no test exists to confirm the current dead-field state.

## docs_link_semantic

- declared_docs: [] — N/A. The source file carries no `@docs` Javadoc annotation; consistent with this repo's convention.
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/integrations/integrations/integration-wizard"
    anchor: ""
    rationale: "The canonical operator-facing doc for the Integration Wizard surface — describes the wizard registry mechanism ('manifests on the platform's classpath'), the content blocks shape, the code snippet template + arguments model, and the `platform_url` substitution. The single most-relevant page for this controller."
    last_verified_at: "2026-05-25T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Verbatim from live fetch 2026-05-25 (status 200):
      - "Lists every integration the platform's classpath registers (one card per integration; sorted case-insensitively by id)." — matches `IntegrationRegistryFactory.java:36` `Comparator.comparing(String::toLowerCase)`.
      - "Title and description — taken from the integration's manifest (`IntegrationPreview` model: `id`, `name`, `description`)." — matches `IntegrationPreviewDto.java:3` (3 fields).
      - "Content blocks — ordered sections, each with a title, prose content, and zero-or-more code snippets." — matches `IntegrationContentBlockDto.java:5` `(title, content, codeSnippets)`.
      - "Code snippets — parameterised templates with form fields. The operator fills in the inputs; the wizard interpolates them; the rendered output is shown ready to copy."
      - "It does not validate the snippet against a target source — credentials, hosts, and ports are typed at face value." — matches the no-validation posture in the code (Jackson deserialiser accepts any string for parameter values).
      - "`platform_url`, read from `odd.platform-base-url`." — matches `StaticArgumentMappingContext.java:11, 16`.
      - "fallback to `http://your.odd.platform` if unset." — matches `StaticArgumentMappingContext.java:16` `@Value(\"${odd.platform-base-url:http://your.odd.platform}\")`.
      - "The page does not address authentication or authorization controls for accessing the wizard itself" — DRIFT: the live doc page is silent on the auth posture; the code is open-read across all auth modes including DISABLED's anonymous case.
  - url: "https://docs.opendatadiscovery.org/integrations/integrations"
    anchor: ""
    rationale: "Integrations overview — names the wizard, the API endpoints, and the secrets-management pattern; the navigation parent of the wizard sub-page."
    last_verified_at: "2026-05-25T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Verbatim from live fetch 2026-05-25 (status 200):
      - "Integration Wizard — An in-app UI under Management → Integrations that generates parameterized YAML snippets for plugins, leveraging 'manifests on the platform's classpath'"
      - "API Endpoint — Mentions `GET /api/integrations` and `GET /api/integrations/{integration_id}` for querying available integrations" — matches `openapi.yaml:51-84`.
      - "Notable Omission: The page does not discuss RBAC (role-based access control)." — DRIFT: code confirms no RBAC permission exists for `/api/integrations`.
  - url: "https://docs.opendatadiscovery.org/developer-guides/api-reference/integrations"
    anchor: ""
    rationale: "Developer-facing API reference page for the two endpoints."
    last_verified_at: "2026-05-25T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Verbatim from live fetch 2026-05-25 (status 200):
      - "`/api/integrations` — `GET` operation that 'Lists every integration registered on this platform (`IntegrationPreviewList` of `{id, name, description, installed}`).'" — matches `openapi.yaml:51-63`.
      - "`/api/integrations/{integration_id}` — `GET` operation that 'Returns the full `Integration` overview: the preview plus the ordered list of content blocks.'" — matches `openapi.yaml:65-83`.
      - "The page does not specify: Response schemas (beyond brief descriptions), HTTP status codes, Authentication requirements." — DRIFT: live doc page does NOT mention the 204-on-missing-id behaviour, the open-read posture, the `installed: false` constant, or DISABLED-mode reachability.
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions"
    anchor: ""
    rationale: "Permissions catalog — confirms no `INTEGRATION_*` permission exists."
    last_verified_at: "2026-05-25T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Verbatim from live fetch 2026-05-25 (status 200): "The permissions documented cover five categories: Data entity permissions, Term permissions, Query Example permissions, Lookup table permissions, and Management permissions. None of these sections reference integration-related permissions." — matches `PolicyPermissionDto` having no `INTEGRATION_*` enum value + `SecurityConstants.SECURITY_RULES` having no `/api/integrations` entry.
- doc_drift_findings:
  - "**The live wizard doc page** (`https://docs.opendatadiscovery.org/integrations/integrations/integration-wizard` WebFetched 2026-05-25, status 200) **is silent on the auth posture** — does NOT state that `/api/integrations*` requires authentication under LOGIN_FORM/OAUTH2/LDAP, does NOT state that DISABLED mode allows anonymous access, does NOT mention that there is no RBAC permission specific to the wizard."
  - "**The live API-reference page** (`https://docs.opendatadiscovery.org/developer-guides/api-reference/integrations` WebFetched 2026-05-25, status 200) **does NOT document the 204-on-missing-id behaviour** — operators cannot read what the response is for an unknown integration id; in fact, the page omits response schemas, HTTP status codes, and authentication requirements entirely."
  - "**The `installed: boolean` field in the OpenAPI contract is structurally dead** — `IntegrationPreview.installed` is REQUIRED per `components.yaml:64-70`, but `IntegrationMapper.java:27, 30` hardcodes `installed: false` on every response. The live API-reference page lists `{id, name, description, installed}` as the IntegrationPreview shape without warning that `installed` is always false. The UI's `IntegrationPreviewItem.tsx:44-51` renders a conditional 'Integrated' badge that will NEVER show."
  - "**`platform_url` substitution under default config exposes a placeholder** — `application.yml:209` has `odd.platform-base-url` commented out; the `@Value(\"${odd.platform-base-url:http://your.odd.platform}\")` default at `StaticArgumentMappingContext.java:16` resolves to the literal `http://your.odd.platform`. Operators copy-pasting wizard snippets without setting the override would point their collector at a non-existent host. The live wizard doc page mentions the fallback exists but does NOT warn operators that this is the default deployment state."
  - "**Case-insensitive id collision is undocumented** — the TreeMap comparator `Comparator.comparing(String::toLowerCase)` at `IntegrationRegistryFactory.java:36` + merge function `(o1, o2) -> o2` at line 35 mean two wizard YAMLs with same-lowercased ids silently merge (last-load-wins). No live doc page mentions this constraint on wizard authors."

## implicit_adrs

- "**The wizard registry is classpath-loaded, read-only, and boot-time-constructed** — `IntegrationRegistryFactory.createResourceFilesIntegrationRegistry()` (lines 29-40) is the only construction path; `IntegrationConfiguration` (`:7-14`) is a `@Configuration` class with a single `@Bean` method that calls the factory at boot. There is no admin API to add/remove wizards at runtime. The decision is: integrations are SHIPPED ARTIFACTS authored by integration-authors and made available via classpath overlay; they are not USER-EDITED PLATFORM STATE." — evidence: `IntegrationConfiguration.java:7-14` + `IntegrationRegistryFactory.java:24-61` + `IntegrationRegistry.java:8-12` (interface has only `get` and `list`, no write methods) — intent_anchor: "The interface itself enforces read-only — `get` returns `Mono<IntegrationOverviewDto>`, `list` returns `Flux<IntegrationPreviewDto>`; no `add`, `remove`, `update`, or `replace` methods exist. The architectural commitment to immutable-at-runtime is encoded in the type system." — confidence: HIGH

- "**The wizard surface is open-read by design** — neither `SecurityConstants.SECURITY_RULES` (`:98+`) nor `PolicyPermissionDto` defines an `INTEGRATION_*` permission, despite the parallel pattern of explicit SecurityRule entries for the namespace, datasource, term, tag, query-example, reference-data, owner-association, role, and policy controllers. The choice is: wizard manifests are NOT operator-sensitive; any authenticated user (or anonymous user under DISABLED) may read them. This aligns with the live wizard doc's framing of the wizard as a copy-paste affordance for collector setup." — evidence: `SecurityConstants.java:98+` (no `/api/integrations` entries) + `PolicyPermissionDto` (no `INTEGRATION_*` enum value; grep returned no matches) + `AuthorizationCustomizer.java:29-30` (catch-all `authenticated()`) — intent_anchor: "Consistent absence of a SecurityRule entry across the two endpoints AND across the controller's full lifetime (the file is 28 lines with no programmatic auth check); the absence IS the convention. Compare: every WRITE-shaped controller (`TagController` POST/PUT/DELETE, `NamespaceController` POST/PUT/DELETE) has SECURITY_RULES entries; every PURE-READ controller (`AppInfoController`, `IntegrationController`) has none — the parallel structure across controllers IS the architectural statement." — confidence: HIGH

- "**The wizard is plugin-extensible — operators ship their own `META-INF/wizard/*.yaml`** — the classpath glob `classpath*:META-INF/wizard/*.yaml` (`IntegrationRegistryFactory.java:26`) is explicitly the multi-classpath variant (`classpath*:` vs `classpath:`), which scans across ALL jars and resource roots. The decision is: wizard manifests live OUTSIDE this repo and are contributed by overlays. A default-checkout build has zero wizards." — evidence: `IntegrationRegistryFactory.java:26` (`classpath*:` prefix) + no `META-INF/wizard/` directory in `<odd-platform-repo>` (Glob returned zero hits) + the live wizard doc page's framing ('manifests on the platform's classpath') — intent_anchor: "The `classpath*:` prefix is the load-bearing decision marker — `classpath:` would scan only the local jar; `classpath*:` is Spring's multi-jar scan. The author chose the multi-jar variant deliberately for the extensibility case." — confidence: HIGH

- "**The wizard interpolates ONE static parameter (`platform_url`) — and ONLY one** — `StaticArgumentMappingContext.java:11` defines `PLATFORM_URL_PARAM_NAME = \"platform_url\"`; the constructor builds `Map.of(PLATFORM_URL_PARAM_NAME, platformUrl)` — a single-entry map. The architectural choice is: the platform supplies its own URL as a substitution; everything else (credentials, hosts, ports, schema names) is operator-typed at face value. This aligns with the wizard's framing as an unvalidated copy-paste tool." — evidence: `StaticArgumentMappingContext.java:11-25` (single-entry map; the `get(parameter)` method returns null for any other parameter) + the live wizard doc page's 'It does not validate the snippet against a target source' statement — intent_anchor: "The class is named `Static` to emphasise the single-platform-supplied dimension; the map is built in the constructor and is therefore immutable for the bean's lifetime; the get returns null for unknown parameters (the wizard treats nulls as 'caller fills this in')." — confidence: HIGH

- "**Boot-time fail-fast on malformed wizard YAML** — `IntegrationRegistryFactory.readManifest` (`:53-61`) catches `IOException` and rethrows as `IllegalStateException(\"Couldn't read wizard manifest: %s\".formatted(resource.getFilename()))` (line 59); `readManifests` does the same at the resource-scan level (line 49). A single corrupt YAML takes the entire application context construction down at boot. The architectural choice is: fail loudly at boot rather than serve broken wizards." — evidence: `IntegrationRegistryFactory.java:48-50, 56-60` — intent_anchor: "Exception messages are specific ('Couldn't read wizard manifests' / 'Couldn't read wizard manifest: filename.yaml') — they are not generic platform-error text. The author chose explicit fail-fast messaging over silent-skip-on-error semantics, encoding the intent that the registry is loaded as a coherent set or not at all." — confidence: HIGH

## bugs_limitations_corner_cases

- "**`installed: false` hardcoded constant on every response — the field is structurally dead** — `IntegrationMapper.java:27` (`@Mapping(target = \"installed\", constant = \"false\")`) and `:30` apply to both the full Integration and the preview shape. The OpenAPI contract (`components.yaml:64-70`) declares `installed: boolean` REQUIRED, and the UI's `IntegrationPreviewItem.tsx:44-51` conditionally renders an 'Integrated' badge on `{installed && (...)}` — but the badge will NEVER show because the value is always false. This is either (a) a never-implemented feature (an integration is 'installed' when a datasource of matching id/family exists — but no detection code exists), or (b) a contract violation (the field is required-but-meaningless). Operators reading the API contract are misled into expecting a meaningful state value." — evidence: `IntegrationMapper.java:27, 30` + `components.yaml:64-70` (installed REQUIRED) + `IntegrationPreviewItem.tsx:44-51` (UI gates the badge on installed) + grep `installed` in `<odd-platform-repo>/odd-platform-api/src/main` returns only the two mapper lines — severity: MEDIUM

- "**`getIntegration({unknown-id})` returns 204 No Content (not 404)** — `ResourceFilesIntegrationRegistry.java:15-17` `Mono.justOrEmpty(registry.get(id))` returns `Mono.empty` on missing-id; the `.map(integration -> integrationMapper.map(integration, ...))` is short-circuited; the controller's `Mono.empty.map(ResponseEntity::ok)` produces `Mono.empty`; Spring WebFlux's reactive controller-return semantics translate that to `204 No Content`. The OpenAPI declares only the `200` response (`openapi.yaml:75-81`); no `404` is contracted. Operators cannot distinguish 'integration exists but has empty body' (currently impossible — non-existent state) from 'integration does not exist'. The path lacks any `switchIfEmpty(Mono.error(new NotFoundException(...)))`. Compare to most other GET-by-id endpoints in this codebase (`MetadataFieldServiceImpl.get` throws `NotFoundException` on missing field at `:30-34`)." — evidence: `ResourceFilesIntegrationRegistry.java:15-17` + `IntegrationServiceImpl.java:20-23` + `IntegrationController.java:19-22` + `openapi.yaml:75-81` (no 404 response declared) — severity: MEDIUM

- "**Default `odd.platform-base-url=http://your.odd.platform` placeholder is rendered into copy-pasted wizard snippets** — `application.yml:209` has the property commented out (`#  platform-base-url:`); `@Value(\"${odd.platform-base-url:http://your.odd.platform}\")` at `StaticArgumentMappingContext.java:16` resolves to the literal placeholder. The wizard mapper substitutes this into every code-snippet argument with `parameter=\"platform_url\"` and `static: true` (`IntegrationMapper.java:38-45`). An operator running a default-config deployment, reading the wizard, copy-pasting the snippet into their collector config, would point the collector at a non-existent host. The live wizard doc page (WebFetched 2026-05-25) names the fallback but does NOT warn that this is the default state — a copy-paste audit would surface this as a confusing operator-error vector." — evidence: `application.yml:209` (commented) + `StaticArgumentMappingContext.java:16` + `IntegrationMapper.java:38-45` + WebFetch 2026-05-25 (`https://docs.opendatadiscovery.org/integrations/integrations/integration-wizard` status 200) — severity: LOW (operator action required to misuse; placeholder is recognisable)

- "**Case-insensitive id collision silently merges wizard YAMLs (last-load-wins)** — `IntegrationRegistryFactory.java:32-37` constructs the TreeMap with `Comparator.comparing(String::toLowerCase)` (case-insensitive ordering AND duplicate-detection) and merge function `(o1, o2) -> o2` (last-wins). Two YAMLs with ids `Snowflake` and `snowflake` collapse into ONE registry entry — the later-loaded survives. With `classpath*:` scanning multiple jars, the load order is filesystem-dependent and non-deterministic across deployments. An operator overlaying their own `snowflake.yaml` to override a vendor's `Snowflake.yaml` MAY succeed or MAY not depending on jar order. No live doc page mentions this." — evidence: `IntegrationRegistryFactory.java:32-37` + `classpath*:` glob semantics — severity: LOW (requires authoring two wizards with case-divergent ids)

- "**Boot-time fail-fast on a single corrupt wizard YAML** — `IntegrationRegistryFactory.readManifest` (`:53-61`) catches `IOException` and rethrows as `IllegalStateException` (`Couldn't read wizard manifest: %s`); `readManifests` (`:42-51`) catches the same at the scan level. A single malformed YAML in any overlay jar takes the entire application context construction down. There is no skip-broken-and-continue, no warn-and-omit semantics. An operator who adds a buggy wizard YAML to their overlay finds the platform refuses to start. The error message includes the resource filename so root-causing is fast, but the failure surface is shared across the whole deployment." — evidence: `IntegrationRegistryFactory.java:48-50, 56-60` — severity: LOW (operator-induced; fail-fast is the documented intent)

- "**NO RBAC permission for `/api/integrations*` — any authenticated user reads the entire wizard registry** — neither `SecurityConstants.SECURITY_RULES` nor `PolicyPermissionDto` defines an `INTEGRATION_*` entry; both endpoints fall through to `AuthorizationCustomizer.customize`'s catch-all `.pathMatchers(\"/**\").authenticated()` (`AuthorizationCustomizer.java:29-30`). A READ_ONLY-role user, a user with only `DATA_ENTITY_TAGS_UPDATE`, or any other no-management-permission user gets the full wizard surface. This is intentional per implicit ADR #2 (wizard manifests are NOT operator-sensitive), but the documentation is silent on the posture — the live permissions page (WebFetched 2026-05-25) doesn't mention integrations." — evidence: `SecurityConstants.java:98+` (no `/api/integrations` entries) + grep `INTEGRATION` in `PolicyPermissionDto.java` returns zero matches + `AuthorizationCustomizer.java:29-30` + WebFetch 2026-05-25 permissions page — severity: LOW (intentional posture, documentation gap)

- "**Under `auth.type=DISABLED` the wizard surface is anonymously reachable** — `DisabledAuthSecurityConfiguration.java:13-18` applies `.anyExchange().permitAll()`; any network caller able to reach the HTTP port can `GET /api/integrations` and read every wizard manifest, including the substituted `platform_url`. If operators set `odd.platform-base-url` to an internal hostname (a typical deployment pattern for the `notification` and `slack` paths that share the property), the internal URL leaks via this anonymous-readable surface. DISABLED is documented as dev-only, but the application.yml DEFAULT is `DISABLED` (per the standard ODD platform application.yml; see batch-W AppInfoController sidecar's analysis) — operators who don't override are running in this posture. The live wizard doc page (WebFetched 2026-05-25) does NOT mention DISABLED's anonymous access posture." — evidence: `DisabledAuthSecurityConfiguration.java:13-18` + `StaticArgumentMappingContext.java:16` + WebFetch 2026-05-25 — severity: MEDIUM

- "**No pagination on `getIntegrationPreviews`** — the endpoint returns the full registry contents in one response; the registry is `Flux.fromIterable(registry.values()).map(IntegrationOverviewDto::integration).collectList()` (`ResourceFilesIntegrationRegistry.java:21` + `IntegrationServiceImpl.java:27`). A deployment with 100+ wizard YAMLs returns the full list every page-load. There is no `?page=&size=`, no `?query=` (the UI filter via `query` state is client-side only — `IntegrationPreviewList.tsx:26-29` filters in JS after receiving the full list). For the wizard-registry use case (typical N < 50) this is fine; the limitation is architectural rather than a bug." — evidence: `ResourceFilesIntegrationRegistry.java:19-22` + `IntegrationServiceImpl.java:25-28` + `IntegrationController.java:25-27` + `IntegrationPreviewList.tsx:26-29` — severity: LOW

- "**Free-form `String integrationId` path-variable — no validation, no allowlist** — `getIntegration(String integrationId, ...)` (`:19`) declares the path-variable as a plain `String`; no `@Pattern`, no `@Size`, no `@NotBlank`, no `@Valid`. Any caller can probe the registry with `GET /api/integrations/<arbitrary-string>`; unknown ids return 204; case-insensitive matches return the matching wizard. No request logging is configured on this controller, so an enumeration probe is invisible." — evidence: `IntegrationController.java:19` + grep `@Pattern\\|@Valid\\|@Size\\|@NotBlank` returns zero matches in the file — severity: LOW

- "**`ServerWebExchange` injected on both methods but never used** — both `getIntegration(String, ServerWebExchange)` (line 19-20) and `getIntegrationPreviews(ServerWebExchange)` (line 25) declare the exchange parameter for OpenAPI-interface conformance, but the controller never reads `exchange.getRequest()`, never sets response headers, never inspects authentication context. The parameter is structurally dead — same pattern as other thin OpenAPI-delegate controllers in this codebase (TagController, AlertController)." — evidence: `IntegrationController.java:20, 25` (parameter declarations) + grep `exchange` in the file returns only the parameter declarations — severity: LOW (consistent with the thin-delegate pattern; not a bug)

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "StaticArgumentMappingContext.java:16"
      name: "odd.platform-base-url"
      value: "@Value(\"${odd.platform-base-url:http://your.odd.platform}\") — default literal placeholder; application.yml:209 commented out"
      questions:
        - q: "What at N = 0 / N = 1 (empty / single-value)?"
          a: "There is no N-shaped semantics for this string. Boundary values: empty-string injection (`odd.platform-base-url=`) — Spring autoboxes into final String empty; the placeholder map at line 19 carries `\"platform_url\" -> \"\"`; the mapper substitutes empty string into every snippet's `platform_url` argument. The wizard renders snippets pointing at `http://` (empty-base-url) — operator-visible as a malformed copy-paste target."
          confidence: STATIC-INFERRED
          evidence: "StaticArgumentMappingContext.java:15-20 (no validation; Map.of permits empty string value)"
        - q: "What at N = tunable / tunable × 100 (boundary / overflow)?"
          a: "Long base-URL (1000+ chars): Spring autoboxes; the value is stored verbatim in the map; the mapper interpolates into every snippet. No length cap. A pathologically-long URL is rendered into snippet `static_value` and sent to every wizard consumer."
          confidence: STATIC-INFERRED
          evidence: "StaticArgumentMappingContext.java:15-20 + IntegrationMapper.java:38-45"
        - q: "What at null / negative / non-numeric (defensive boundary)?"
          a: "Null cannot be injected via @Value with a default; the default `http://your.odd.platform` activates when the property is absent. A property explicitly set to empty string is not null. SpEL injection via environment variable: `ODD_PLATFORM_BASE_URL=` would set empty string. No defensive guard against malformed URLs (no `@URL` validation, no scheme check). An operator typo (`htttp://...`) substitutes verbatim."
          confidence: STATIC-INFERRED
          evidence: "StaticArgumentMappingContext.java:16 (no @URL, no validator)"
        - q: "What does the operator see at each boundary?"
          a: "Default deployment (no override + application.yml:209 commented): wizard snippets carry literal `http://your.odd.platform` — operator MUST replace this placeholder. Override set to internal hostname (e.g. `http://odd-platform.internal:8080`): wizard snippets carry the internal URL, anonymously readable under DISABLED. Override set to public URL: wizard snippets are correct copy-paste targets. Empty-string override: snippets carry `http://` — broken copy-paste."
          confidence: STATIC-INFERRED
          evidence: "StaticArgumentMappingContext.java:15-20 + IntegrationMapper.java:38-45 + DisabledAuthSecurityConfiguration.java:13-18"
    - location: "IntegrationRegistryFactory.java:36"
      name: "TreeMap comparator + merge function"
      value: "Comparator.comparing(String::toLowerCase) + (o1, o2) -> o2 (last-wins on case-collision)"
      questions:
        - q: "What at N = 0 / N = 1?"
          a: "N=0 wizards on classpath (the default-checkout state): TreeMap is empty; `getIntegrationPreviews` returns `{items: []}`; `getIntegration({any-id})` returns 204. N=1: single wizard returned with installed=false."
          confidence: STATIC-INFERRED
          evidence: "IntegrationRegistryFactory.java:29-40 (Collectors.toMap accepts empty stream) + ResourceFilesIntegrationRegistry.java:15-22 + grep META-INF/wizard returns zero in the repo"
        - q: "What at N case-collision (e.g. `Snowflake` + `snowflake`)?"
          a: "Two YAMLs collapse into one entry; last-loaded wins per the merge function `(o1, o2) -> o2`. The TreeMap's comparator makes the keys case-insensitively-equal; the merge resolves the collision silently with no log, no warning, no exception."
          confidence: STATIC-INFERRED
          evidence: "IntegrationRegistryFactory.java:32-37 (collector with case-insensitive comparator + last-wins merge)"
        - q: "What at N malformed YAML (one of N is corrupt)?"
          a: "ANY corrupt YAML aborts boot — `readManifest` rethrows as `IllegalStateException(\"Couldn't read wizard manifest: %s\")` (line 59); the stream collector receives the exception, aborts; `IntegrationConfiguration.integrationRegistry()` propagates upward; Spring context construction fails. The platform refuses to start. The error message includes the resource filename for root-causing."
          confidence: STATIC-INFERRED
          evidence: "IntegrationRegistryFactory.java:42-61"
        - q: "What does the operator see?"
          a: "Empty-registry deployment: empty Integration panel in the UI (no error). Single-wizard: one card. Collision: one card with content from whichever YAML loaded last (jar order dependent). Malformed YAML in any wizard: platform fails to start at boot with a clear filename-anchored error in the logs."
          confidence: STATIC-INFERRED
          evidence: "ResourceFilesIntegrationRegistry.java + IntegrationRegistryFactory.java + IntegrationPreviewList.tsx:71-75 (renders EmptyContentPlaceholder when registry is empty)"
  name_behavior_pairs:
    - name: "IntegrationMapper.installed: false (constant mapping at lines 27, 30)"
      promise: "The `installed: boolean` field declared REQUIRED in OpenAPI (`components.yaml:64-70`) names a state — the operator and the UI both interpret it as 'is this integration actually wired into a running datasource on this platform?'. The UI surfaces it as an 'Integrated' badge with checkmark icon and translated label (`IntegrationPreviewItem.tsx:44-51`)."
      implementation: "MapStruct mapper hardcodes `installed: false` via `@Mapping(target = \"installed\", constant = \"false\")` at lines 27 (for `Integration map(IntegrationOverviewDto, StaticArgumentMappingContext)`) and 30 (for `IntegrationPreview map(IntegrationPreviewDto)`). No code path inspects whether an integration is actually wired into the platform (no DataSourceRepository lookup, no comparison against registered collectors). The field is therefore structurally dead — it is REQUIRED-and-meaningless."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "Every integration card in the UI's Management → Integrations panel renders WITHOUT the 'Integrated' badge — the badge code path `{installed && (...)}` (`IntegrationPreviewItem.tsx:44-51`) is dead. An operator who has connected, say, a Snowflake datasource and sees the Snowflake wizard card sees no 'Integrated' indicator; they cannot distinguish 'wizard exists, integration done' from 'wizard exists, integration pending'. The UI's translation key `'Integrated'` and the entire visual affordance are wasted."
      confidence: STATIC-INFERRED
      evidence: "IntegrationMapper.java:27, 30 + components.yaml:64-70 + IntegrationPreviewItem.tsx:44-51 + grep `installed` in <odd-platform-repo>/odd-platform-api/src/main returns only the two mapper lines (no detection code anywhere)"
    - name: "IntegrationController.getIntegration (line 19) — returns 204 on missing id"
      promise: "The HTTP method + path (`GET /api/integrations/{integration_id}`) + operationId (`getIntegration`) promise to return either a 200 with the integration overview (when the id matches a wizard manifest) or an error (when the id does not match). OpenAPI declares only `200` (`openapi.yaml:75-81`), implying a single successful response shape."
      implementation: "On missing id, the chain `Mono.justOrEmpty(registry.get(id)).map(...)` returns `Mono.empty`; the controller's `Mono.empty.map(ResponseEntity::ok)` produces `Mono.empty`; Spring WebFlux translates that to `204 No Content` rather than 404 (no `switchIfEmpty` on the path)."
      drift: MINOR
      operator_visible_consequence: "An operator probing the wizard registry with an unknown id (`GET /api/integrations/nonexistent`) gets `204 No Content` — a successful response with no body. Compare to `GET /api/dataentities/{nonexistent-id}` which would route through `MetadataFieldServiceImpl`-style 404-throwing handlers. The OpenAPI contract neither declares 404 nor 204, so the actual 204 behaviour is undocumented; SDK generators may auto-generate response handlers that don't expect 204 on a path expecting 200."
      confidence: STATIC-INFERRED
      evidence: "IntegrationController.java:19-22 + IntegrationServiceImpl.java:20-23 + ResourceFilesIntegrationRegistry.java:15-17 + openapi.yaml:75-81 (only 200 declared)"
    - name: "IntegrationController.getIntegrationPreviews (line 25) — registry can be empty on default checkout"
      promise: "The endpoint name + path + operationId (`getIntegrationPreviews`) imply a non-trivial list of integrations is returned. The live wizard doc page describes the wizard as 'Lists every integration the platform's classpath registers' — operators reading the doc expect to see some default integrations."
      implementation: "The registry is sourced ENTIRELY from `META-INF/wizard/*.yaml` files on classpath. A default `<odd-platform-repo>` checkout has ZERO such files (Glob returned no matches across the entire repo); the registry is empty; the response is `{items: []}`. Wizard manifests come from external overlays (vendor jars, docker-image overlays, or operator-supplied classpath additions)."
      drift: MINOR
      operator_visible_consequence: "A developer running `<odd-platform-repo>` locally from source sees an empty Integration panel with no error — the wizard surface is unusable until they overlay wizard YAMLs. The live wizard doc page does not warn that the default-build state is empty. New developers may believe the wizard feature is broken when it is actually a configuration step."
      confidence: STATIC-INFERRED
      evidence: "IntegrationRegistryFactory.java:26 (classpath*: glob) + Glob `<odd-platform-repo>/**/META-INF/wizard/*.yaml` returns zero hits + IntegrationPreviewList.tsx:71-75 (renders empty placeholder, no error message)"
  orderings:
    - location: "IntegrationRegistryFactory.java:36 (TreeMap ordering) + ResourceFilesIntegrationRegistry.java:21 (Flux.fromIterable iteration)"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer (the data structure / iteration order)?"
          a: "`TreeMap<String, IntegrationOverviewDto>` with `Comparator.comparing(String::toLowerCase)` provides case-insensitive sort by id. `Flux.fromIterable(registry.values())` iterates the TreeMap's values in key-order — so the list endpoint returns integrations sorted case-insensitively by id."
          confidence: STATIC-INFERRED
          evidence: "IntegrationRegistryFactory.java:32-37 + ResourceFilesIntegrationRegistry.java:19-22"
        - q: "What is the tie-breaker when sort-key values are equal?"
          a: "The comparator `String::toLowerCase` makes `Snowflake` and `snowflake` collide as equal keys; the merge function `(o1, o2) -> o2` (last-wins) resolves the COLLISION (drops one entry). For genuinely-different keys with the same lowercase prefix (e.g. `snowflake-prod` vs `snowflake-dev`), the natural String compareTo within `String::toLowerCase` provides a deterministic secondary order."
          confidence: STATIC-INFERRED
          evidence: "IntegrationRegistryFactory.java:32-37"
        - q: "Which subset is returned when result-set > page size?"
          a: "N/A — there is no pagination. The endpoint returns the FULL registry in one response body."
          confidence: STATIC-INFERRED
          evidence: "ResourceFilesIntegrationRegistry.java:19-22 + IntegrationServiceImpl.java:25-28"
        - q: "Does any upstream layer (UI, service) re-sort or filter the result?"
          a: "Service layer (IntegrationServiceImpl.listPreviews :25-28): no re-sort, only `.map(integrationMapper::map)`. Controller (line 25-27): no re-sort. UI: `IntegrationPreviewList.tsx:26-29` filters client-side by name-substring match against the user-typed query — no re-sort, preserves the backend's case-insensitive id ordering."
          confidence: STATIC-INFERRED
          evidence: "IntegrationController.java:25-27 + IntegrationServiceImpl.java:25-28 + IntegrationPreviewList.tsx:26-29"
  auth_gates:
    - location: "SecurityConstants.java:98+ (the gate-shaped absence) + AuthorizationCustomizer.java:29-30 (the catch-all) + IntegrationController.java:1-28 (no @PreAuthorize)"
      endpoint: "GET /api/integrations (getIntegrationPreviews) + GET /api/integrations/{integration_id} (getIntegration)"
      questions:
        - q: "What does each endpoint return for DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "DISABLED: both endpoints are anonymously reachable — `DisabledAuthSecurityConfiguration.java:13-18` applies `.anyExchange().permitAll()`; SECURITY_RULES is not consulted. LOGIN_FORM / OAUTH2 / LDAP: both endpoints require ONLY `authenticated()` — no INTEGRATION_* permission exists; the catch-all `pathMatchers(\"/**\").authenticated()` (AuthorizationCustomizer.java:29-30) applies. Any authenticated user (any role, any owner association) reads the full wizard registry including `platform_url`."
          confidence: STATIC-INFERRED
          evidence: "DisabledAuthSecurityConfiguration.java:13-18 + AuthorizationCustomizer.java:29-30 + SecurityConstants.java:98+ (no /api/integrations entry) + grep INTEGRATION in PolicyPermissionDto.java returns zero matches"
        - q: "What does an unauthenticated caller see?"
          a: "DISABLED: 200 with the full wizard registry. LOGIN_FORM: 302 redirect to the login form (per LoginFormSecurityConfiguration.java:46-47 if no redirect URI configured; otherwise to the configured redirect). OAUTH2/LDAP: 401 Unauthorized (modal challenge for OAUTH2 typically; basic-auth challenge for LDAP)."
          confidence: STATIC-INFERRED
          evidence: "DisabledAuthSecurityConfiguration.java:13-18 + AuthorizationCustomizer.java:29-30 + REFERENCE to OAuthSecurityConfiguration / LDAPSecurityConfiguration sidecars"
        - q: "What does a wrong-role caller see (READ_ONLY, no-management-permission)?"
          a: "Same as a high-role caller — 200 with the full wizard registry. There is NO `INTEGRATION_*` permission to deny; any authenticated user reads the full surface. This is intentional per the implicit ADR (wizard manifests are documented public-knowledge artefacts) but the documentation is silent on the posture."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:98+ + AuthorizationCustomizer.java:29-30"
        - q: "Where exactly does the gate live — controller, service, repository, or nowhere?"
          a: "Catch-all `authenticated()` only — at `AuthorizationCustomizer.customize`'s line 29-30. There is NO controller-tier `@PreAuthorize`, NO service-tier permission check, NO repository-tier filter. The wizard registry is treated as platform-public-by-design. A path-pattern drift (a REFACTOR-217 class incident) would NOT silently grant — the catch-all keeps unauthenticated traffic out (except DISABLED). The drift surface is the absence-vs-presence of a future SecurityRule that ADDS an INTEGRATION_READ permission and inadvertently breaks the UI."
          confidence: STATIC-INFERRED
          evidence: "IntegrationController.java:1-28 (no @PreAuthorize) + IntegrationService.java:1-11 (no @PreAuthorize) + IntegrationServiceImpl.java:1-29 (no permissionService dependency) + ResourceFilesIntegrationRegistry.java:1-23 (no filter) + AuthorizationCustomizer.java:29-30"
  resource_boundaries:
    - location: "IntegrationConfiguration.java:10-13 + IntegrationRegistryFactory.java:29-40 (boot-time construction)"
      kind: concurrency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "No. The registry is constructed ONCE at boot (Spring `@Bean` method `integrationRegistry()` is invoked exactly once per `@Configuration` class lifecycle). The resulting `Map<String, IntegrationOverviewDto>` is immutable in practice — `ResourceFilesIntegrationRegistry` exposes only `Mono.justOrEmpty(registry.get(id))` (read) and `Flux.fromIterable(registry.values())` (read). No write methods exist. Concurrent GET /api/integrations* calls hit a read-only data structure. The TreeMap itself is NOT thread-safe for writes, but writes never happen post-construction."
          confidence: STATIC-INFERRED
          evidence: "IntegrationConfiguration.java:10-13 (single @Bean method) + IntegrationRegistry.java:8-12 (interface declares only get + list) + ResourceFilesIntegrationRegistry.java:11-22"
        - q: "Is the call replay-safe?"
          a: "Yes. Both endpoints are pure reads. Same id → same response; identical bodies across concurrent calls."
          confidence: STATIC-INFERRED
          evidence: "IntegrationController.java:19-27 (no DB writes, no side effects)"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No explicit cache annotation (`@Cacheable`) on the controller, service, or repository. The registry IS effectively a process-local cache constructed at boot — calls hit the in-memory TreeMap directly. To rebuild the registry, the platform must restart. There is no admin invalidation API."
          confidence: STATIC-INFERRED
          evidence: "IntegrationController.java + IntegrationServiceImpl.java + ResourceFilesIntegrationRegistry.java + IntegrationConfiguration.java (no @Cacheable; no cache references)"
  request_inputs:
    - location: "IntegrationController.java:19 (getIntegration path-variable)"
      input_kind: path-param
      input_name: "integrationId"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The path-variable `integrationId` (rendered in the URL as `/api/integrations/{integration_id}`) promises that the caller supplies an integration's id — the unique identifier the integration registry uses to look up the wizard manifest."
          confidence: STATIC-INFERRED
          evidence: "IntegrationController.java:19 + openapi.yaml:65-83"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Pipeline: controller (`getIntegration(integrationId, ...)`) → `integrationService.get(integrationId)` (line 21) → `integrationRegistry.get(integrationId)` (`IntegrationServiceImpl.java:21`) → `Mono.justOrEmpty(registry.get(id))` (`ResourceFilesIntegrationRegistry.java:16`). The `registry` is a `TreeMap` with `Comparator.comparing(String::toLowerCase)` (IntegrationRegistryFactory.java:36) — so the lookup is CASE-INSENSITIVE. The caller-supplied id is matched against the registry key set with case-folding."
          confidence: STATIC-INFERRED
          evidence: "IntegrationController.java:19-22 + IntegrationServiceImpl.java:20-23 + ResourceFilesIntegrationRegistry.java:15-17 + IntegrationRegistryFactory.java:32-37"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_LEGITIMATELY — the implementation looks up the integration by id (matching the name's promise) but applies case-insensitive matching at the TreeMap layer. The translation is from 'exact-id-match' to 'case-insensitive-id-match'. This is NOT documented in the OpenAPI spec or the wizard doc page, but it IS consistent with the case-insensitive ordering established at registry construction; the operator can supply `snowflake` and reach a manifest registered as `Snowflake`. The translation is internally coherent."
          drift: MINOR
          confidence: STATIC-INFERRED
          evidence: "IntegrationRegistryFactory.java:32-37 (case-insensitive comparator + last-wins merge) + ResourceFilesIntegrationRegistry.java:15-17 (TreeMap.get respects the comparator)"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — drift is MINOR (legitimate translation). A caller passing `SNOWFLAKE` finds a wizard registered as `snowflake` — usable behavior. The only failure mode is the case-collision merge: `GET /api/integrations/Snowflake` and `GET /api/integrations/snowflake` BOTH return the same (last-loaded) manifest, which may not be the caller's intent if they authored both case-variants expecting them to be distinct."
          confidence: STATIC-INFERRED
          evidence: "IntegrationRegistryFactory.java:32-37 + the case-collision merge analysis"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE — the integration id is the only identifier in the wizard manifest; no field is shadowing the intent."
          confidence: STATIC-INFERRED
          evidence: "IntegrationPreviewDto.java:3 + IntegrationOverviewDto.java:8-10"
      routes_to_finding: "bugs_limitations_corner_cases[case-collision-merge] AND docs_link_semantic.doc_drift_findings[case-insensitive-not-documented]"
  probes_emitted:
    - probe_id: P-126
      question: "Stress question: getIntegration({unknown-id}) — does the implementation return 204 (current code path via Mono.empty), 404 (with switchIfEmpty + NotFoundException), or something else? AND: does the response carry an empty body OR a JSON-empty `{}` OR is it a content-type-less 204?"
      probe_path: "lineage/odd-platform/probes/P-126.yaml"
  stress_summary:
    triggers_total: 7
    questions_total: 22
    answers_static_inferred: 21
    answers_probe_needed: 1
    answers_reference: 0
    drift_flags: 3
```

## security

- **auth_mode_relevance**: `DISABLED | LOGIN_FORM | OAUTH2 | LDAP` — the controller is on the HTTP UI / API surface and is reachable under all four modes. DISABLED exposes the wizard registry to anonymous traffic; the other three modes require any authenticated user (no specific INTEGRATION_* permission).
- **ingestion_filter_relevance**: `NO — UI/API surface at /api/integrations*, not /ingestion/**`. The S2S `IngestionDataEntitiesFilter` matches `/ingestion/entities` only.
- **authorization_assertions**:
  - "NO SecurityRule entries for `/api/integrations*` — evidence: `SecurityConstants.java:98+` (no INTEGRATION-related entries) + grep `INTEGRATION` in `PolicyPermissionDto.java` returns zero matches"
  - "Catch-all `pathMatchers(\"/**\").authenticated()` applies — evidence: `AuthorizationCustomizer.java:29-30`"
  - "Controller has NO `@PreAuthorize` — evidence: `IntegrationController.java:1-28` (no annotation)"
  - "Service tier has NO `@PreAuthorize`, NO programmatic `permissionService.hasPermission(...)` calls — evidence: `IntegrationService.java:1-11` (interface declares no security) + `IntegrationServiceImpl.java:1-29` (no permissionService injection, no checks)"
- **owner_scoping**: `N/A — wizard registry has no owner concept`. Wizard manifests are global classpath resources; no per-owner / per-tenant filtering exists at any layer. The registry is a flat global namespace.
- **data_exposure**:
  - "`IntegrationPreviewList` `{items: [{id, name, description, installed: false}]}` → DISABLED: any network caller anonymously; LOGIN_FORM/OAUTH2/LDAP: any authenticated user — evidence: IntegrationController.java:25-27 + IntegrationServiceImpl.java:25-28 + IntegrationMapper.java:30 + DisabledAuthSecurityConfiguration.java:13-18 + AuthorizationCustomizer.java:29-30"
  - "`Integration` payload `{id, name, description, installed: false, content_blocks: [{title, content, code_snippets: [{template, arguments: [{parameter, name, type, static_value: <platform_url-resolved>}]}]}]}` — content_blocks may contain operator-typed code snippets with platform_url substituted in → DISABLED: any network caller anonymously; LOGIN_FORM/OAUTH2/LDAP: any authenticated user — evidence: IntegrationController.java:19-22 + IntegrationMapper.java:23-50 + StaticArgumentMappingContext.java:11-25"
  - "`platform_url` (operator-configured `odd.platform-base-url`) — substituted into every code-snippet `static_value` field where the snippet argument declares `parameter=\"platform_url\"` and `static: true`. Under DISABLED mode an internal-hostname configuration leaks to any network caller — evidence: StaticArgumentMappingContext.java:11-25 + IntegrationMapper.java:38-45 + DisabledAuthSecurityConfiguration.java:13-18"
  - "Notable NON-disclosure: the wizard registry stores ONLY the deserialised YAML manifests; NO credentials, tokens, secret keys, or runtime state is included. The wizard is a documentation surface, not a credential vault — per the live wizard doc page (WebFetched 2026-05-25): 'It does not validate the snippet against a target source — credentials, hosts, and ports are typed at face value.' Operators fill in their own credentials at copy-paste time."
- **known_security_gaps**:
  - "**DISABLED-mode anonymous reachability** — under `auth.type=DISABLED`, both endpoints accept anonymous traffic; the wizard registry (including the operator-configured `platform_url`, which may carry an internal hostname) is readable to any caller able to reach the HTTP port. The live wizard doc page (WebFetched 2026-05-25) does not document this posture. Combined with the typical-deployment fact that `auth.type=DISABLED` may be left in place during development, an internal `odd.platform-base-url` is leaked to passive network observers. — evidence: DisabledAuthSecurityConfiguration.java:13-18 + StaticArgumentMappingContext.java:16 + IntegrationMapper.java:38-45 + WebFetch 2026-05-25 (wizard page silent on auth) — severity: MEDIUM"
  - "**Open-read posture under LOGIN_FORM/OAUTH2/LDAP — no INTEGRATION_* permission** — any authenticated user reads the full wizard registry regardless of role. This is intentional per the implicit ADR (wizard manifests are documented public-knowledge artefacts), but is not documented anywhere — the live permissions page (WebFetched 2026-05-25) does not mention integration permissions, and the live wizard page does not state the open-read posture. An operator auditing the platform's security posture cannot find this from the docs. — evidence: SecurityConstants.java:98+ (no entries) + AuthorizationCustomizer.java:29-30 + WebFetch 2026-05-25 (silent) — severity: LOW (intentional posture, documentation gap)"
  - "**No request logging on the controller** — there is no `@Slf4j` log, no request-time logging in the service or controller. Enumeration of `GET /api/integrations/{id}` against arbitrary ids (probing the registry surface) is silent. While the registry only contains documented wizard manifests (not user-secret data), the absence of audit logging means an enumeration probe is invisible. — evidence: IntegrationController.java:1-28 (no @Slf4j) + IntegrationServiceImpl.java:1-29 (no logging) — severity: LOW"

## performance

- **hot_paths**:
  - "`GET /api/integrations` runs on Management → Integrations page-mount; the React-Query key `['integrationPreviews']` (`lib/hooks/api/integration.ts:17`) is client-cached for the SPA lifetime, so a typical user fires the call once per session. The endpoint walks the in-memory TreeMap; no DB round-trip. Per-call cost is O(N) in registry size for the `Flux.fromIterable` + `.collectList` + the mapper's per-element work. — evidence: IntegrationController.java:25-27 + ResourceFilesIntegrationRegistry.java:19-22 + IntegrationServiceImpl.java:25-28"
  - "`GET /api/integrations/{id}` runs on individual integration page-mount; React-Query key `['integration', integrationId]` (`integration.ts:24`) is per-id cached. Per-call cost is O(1) for the TreeMap lookup + per-content-block mapper work. — evidence: IntegrationController.java:19-22 + ResourceFilesIntegrationRegistry.java:15-17"
- **throughput_characteristics**:
  - "Both endpoints are pure-read against an in-memory data structure; no DB round-trip, no I/O after boot."
  - "Reactive `Mono` / `Flux` throughout; non-blocking but synchronous-in-effect (no awaits)."
- **resource_allocation**:
  - "Boot-time cost: one classpath scan (`PathMatchingResourcePatternResolver.getResources(\"classpath*:META-INF/wizard/*.yaml\")`) + one YAML parse per discovered resource + one TreeMap construction. Cost is O(N × YAML-size) at boot; amortised over the platform's lifetime."
  - "Per-call allocations: `getIntegrationPreviews` allocates a new `IntegrationPreviewList` + a new `List` of N `IntegrationPreview` DTOs per call. `getIntegration` allocates a new `Integration` DTO with its content blocks per call. Allocation cost is small for typical registry sizes (N < 50)."
  - "No connection pool involvement; no R2DBC; no external HTTP."
- **scaling_characteristics**:
  - "Stateless reactive controller — instances scale horizontally; each replica boots with its own classpath-scanned registry. If wizards are supplied by overlay, all replicas see the same overlay; registry contents are deterministic per build."
  - "Memory: the registry is fully in-memory; with N wizards averaging K KiB each, the heap cost is N × K. For typical N < 50 and K < 100 KiB, this is < 5 MiB."
- **known_performance_gaps**:
  - "**No pagination on `getIntegrationPreviews`** — the response body grows O(N) in registry size; for very large registries (operator overlays adding 100s of wizards) the per-page-load cost grows. Not currently observed in any deployment. — evidence: ResourceFilesIntegrationRegistry.java:19-22 + IntegrationServiceImpl.java:25-28 — severity: LOW"
  - "**No `?query=` server-side filter** — the UI's name-substring filter (`IntegrationPreviewList.tsx:26-29`) is client-side only; for very large registries the SPA receives every wizard on every fetch. — evidence: IntegrationPreviewList.tsx:26-29 + the controller's absence of @RequestParam query — severity: LOW"
  - "**Boot-time fail-fast on malformed wizard YAML is not graceful** — a single corrupt YAML in an overlay jar takes the entire platform down; operator deployment-time validation of wizard YAMLs is required to avoid this. — evidence: IntegrationRegistryFactory.java:48-50, 56-60 — severity: LOW (operator-induced)"

## upstream_callers

- entry_point: "rest:GET /api/integrations"
  caller_node: "rest_api:openapi-generated IntegrationApi.getIntegrationPreviews"
  multiplicity_per_trigger: 1
  evidence: "IntegrationController.java:25-27 + the OpenAPI-generated IntegrationApi interface (`api.contract.api.IntegrationApi`)"
  observation_class: rest-call
  unresolved: false

- entry_point: "rest:GET /api/integrations/{integration_id}"
  caller_node: "rest_api:openapi-generated IntegrationApi.getIntegration"
  multiplicity_per_trigger: 1
  evidence: "IntegrationController.java:19-22"
  observation_class: rest-call
  unresolved: false

- entry_point: "ui_route:/management/integrations (Management → Integrations list)"
  caller_node: "ts react-component:IntegrationPreviewList.tsx (line 21 useIntegrationPreviews hook)"
  multiplicity_per_trigger: 1
  evidence: "IntegrationPreviewList.tsx:21 (useIntegrationPreviews) + lib/hooks/api/integration.ts:11-20 (React-Query keyed ['integrationPreviews']) + managementRoutes.ts:7 (INTEGRATIONS: 'integrations')"
  observation_class: ui-call
  unresolved: false

- entry_point: "ui_route:/management/integrations/:integrationId/* (Management → Integration detail)"
  caller_node: "ts react-component:Integration.tsx (line 21 useIntegration hook)"
  multiplicity_per_trigger: 1
  evidence: "Integration.tsx:14-21 + lib/hooks/api/integration.ts:22-46 (React-Query keyed ['integration', integrationId]) + Integrations.tsx:14 (route ':integrationId/*')"
  observation_class: ui-call
  unresolved: false

## downstream_side_effects

- side_effect_class: page-render
  description: "Returns `IntegrationPreviewList` payload to the caller — list of all wizards in case-insensitive id order, every with `installed: false` constant."
  evidence: "IntegrationController.java:25-27 + IntegrationServiceImpl.java:25-28 + ResourceFilesIntegrationRegistry.java:19-22 + IntegrationMapper.java:30, 47-49"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "rest:GET /api/integrations"
    - "ui_route:/management/integrations"

- side_effect_class: page-render
  description: "Returns full `Integration` payload (preview + content_blocks with platform_url-substituted code snippets) for a single integration; OR 204 No Content if id not found in registry."
  evidence: "IntegrationController.java:19-22 + IntegrationServiceImpl.java:20-23 + ResourceFilesIntegrationRegistry.java:15-17 + IntegrationMapper.java:23-29, 33-45"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "rest:GET /api/integrations/{integration_id}"
    - "ui_route:/management/integrations/:integrationId/*"

## sources

- understanding ← IntegrationController.java:1-28 (full file) + IntegrationService.java:7-11 + IntegrationServiceImpl.java:12-29 + IntegrationRegistry.java:8-12 + ResourceFilesIntegrationRegistry.java:11-22 + IntegrationRegistryFactory.java:24-61 + IntegrationConfiguration.java:7-14 + IntegrationMapper.java:23-50 + IntegrationDeserializer.java:21-89 + StaticArgumentMappingContext.java:10-25 + IntegrationOverviewDto.java + IntegrationPreviewDto.java + IntegrationContentBlockDto.java + components.yaml:11-92 + openapi.yaml:51-84 + SecurityConstants.java:98+ + AuthorizationCustomizer.java:29-30 + DisabledAuthSecurityConfiguration.java:13-18 + LoginFormSecurityConfiguration.java:31-66 + application.yml:209 + WebFetch 2026-05-25 (integrations + wizard + api-reference + permissions doc pages)
- concepts.entities.IntegrationApi ← IntegrationController.java:4, 15 + openapi.yaml:51-84
- concepts.entities.Integration ← IntegrationController.java:5 + components.yaml:82-92
- concepts.entities.IntegrationPreview ← components.yaml:55-70
- concepts.entities.IntegrationPreviewList ← IntegrationController.java:6 + components.yaml:72-80
- concepts.entities.IntegrationContentBlock ← components.yaml:39-53 + IntegrationContentBlockDto.java:5
- concepts.entities.IntegrationCodeSnippet ← components.yaml:27-37 + IntegrationCodeSnippetDto.java:5
- concepts.entities.IntegrationCodeSnippetArgument ← components.yaml:11-25 + IntegrationCodeSnippetArgumentDto.java:3-7 + IntegrationCodeSnippetArgumentTypeEnum.java:3-8
- concepts.entities.IntegrationService ← IntegrationController.java:7, 16 + IntegrationService.java:7-11
- concepts.entities.IntegrationRegistry ← IntegrationRegistry.java:8-12 + ResourceFilesIntegrationRegistry.java:11-22
- concepts.entities.StaticArgumentMappingContext ← StaticArgumentMappingContext.java:10-25
- concepts.entities.IntegrationOverviewDto ← IntegrationOverviewDto.java:8-10 + IntegrationDeserializer.java:21-89
- concepts.operations.getIntegration ← IntegrationController.java:19-22 + IntegrationServiceImpl.java:20-23 + ResourceFilesIntegrationRegistry.java:15-17 + IntegrationMapper.java:23-29 + StaticArgumentMappingContext.java:22-24
- concepts.operations.getIntegrationPreviews ← IntegrationController.java:25-27 + IntegrationServiceImpl.java:25-28 + ResourceFilesIntegrationRegistry.java:19-22 + IntegrationMapper.java:30-31, 47-49
- concepts.invariants[open-read] ← SecurityConstants.java:98+ + AuthorizationCustomizer.java:29-30 + DisabledAuthSecurityConfiguration.java:13-18
- concepts.invariants[registry-read-only] ← IntegrationRegistry.java:8-12 (interface has only get + list)
- concepts.invariants[boot-construction] ← IntegrationConfiguration.java:10-13 + IntegrationRegistryFactory.java:29-40
- concepts.invariants[case-insensitive] ← IntegrationRegistryFactory.java:32-37
- concepts.invariants[installed-constant] ← IntegrationMapper.java:27, 30
- concepts.invariants[platform-url-substitution] ← IntegrationMapper.java:38-45 + StaticArgumentMappingContext.java:11-25
- concepts.invariants[free-form-id] ← IntegrationController.java:19 (no validation annotations)
- concepts.invariants[no-tests] ← grep IntegrationController in <odd-platform-repo>/odd-platform-api/src/test returns zero matches
- concepts.invariants[empty-default] ← Glob <odd-platform-repo>/**/META-INF/wizard/*.yaml returns zero hits
- concepts.audiences[ui-end-user] ← IntegrationPreviewList.tsx:21 + Integration.tsx:21 + managementRoutes.ts:7 + integration.ts:11-46
- concepts.audiences[platform-operator] ← WebFetch 2026-05-25 (wizard doc page; status 200)
- concepts.audiences[integration-author] ← IntegrationRegistryFactory.java:26 (classpath*: glob) + the live wizard doc framing
- dependencies_semantic.requires-feature.IntegrationApi ← IntegrationController.java:4, 15
- dependencies_semantic.requires-feature.IntegrationService ← IntegrationController.java:7, 16 + IntegrationService.java:7-11 + IntegrationServiceImpl.java:12-29
- dependencies_semantic.requires-feature.IntegrationRegistry ← IntegrationRegistry.java:8-12 + ResourceFilesIntegrationRegistry.java:11-22
- dependencies_semantic.requires-feature.IntegrationRegistryFactory ← IntegrationRegistryFactory.java:24-61
- dependencies_semantic.requires-feature.IntegrationDeserializer ← IntegrationDeserializer.java:21-89
- dependencies_semantic.requires-feature.IntegrationMapper ← IntegrationMapper.java:23-50
- dependencies_semantic.requires-feature.StaticArgumentMappingContext ← StaticArgumentMappingContext.java:10-25
- dependencies_semantic.requires-config.odd.platform-base-url ← StaticArgumentMappingContext.java:16 + application.yml:209
- dependencies_semantic.requires-config.auth.type ← DisabledAuthSecurityConfiguration.java:10 + LoginFormSecurityConfiguration.java:31 + AuthorizationCustomizer.java:29-30
- dependencies_semantic.requires-runtime ← IntegrationController.java:8-11 + IntegrationRegistryFactory.java:25-27
- dependencies_semantic.couples-to ← IntegrationController.java:15-16 + SecurityConstants.java:98+ (absence)
- tests_coverage_semantic.test_files ← grep IntegrationController in <odd-platform-repo>/odd-platform-api/src/test returns zero matches (2026-05-25)
- docs_link_semantic.inferred_docs[wizard] ← WebFetch https://docs.opendatadiscovery.org/integrations/integrations/integration-wizard (2026-05-25, 200)
- docs_link_semantic.inferred_docs[integrations] ← WebFetch https://docs.opendatadiscovery.org/integrations/integrations (2026-05-25, 200)
- docs_link_semantic.inferred_docs[api-reference] ← WebFetch https://docs.opendatadiscovery.org/developer-guides/api-reference/integrations (2026-05-25, 200)
- docs_link_semantic.inferred_docs[permissions] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions (2026-05-25, 200)
- docs_link_semantic.doc_drift_findings[auth-silent] ← WebFetch 2026-05-25 wizard page + SecurityConstants.java:98+ + AuthorizationCustomizer.java:29-30
- docs_link_semantic.doc_drift_findings[204-undocumented] ← WebFetch 2026-05-25 api-reference page + IntegrationController.java:19-22 + ResourceFilesIntegrationRegistry.java:15-17
- docs_link_semantic.doc_drift_findings[installed-dead] ← components.yaml:64-70 + IntegrationMapper.java:27, 30 + IntegrationPreviewItem.tsx:44-51
- docs_link_semantic.doc_drift_findings[platform-url-placeholder] ← application.yml:209 + StaticArgumentMappingContext.java:16 + WebFetch 2026-05-25
- docs_link_semantic.doc_drift_findings[case-collision] ← IntegrationRegistryFactory.java:32-37 + WebFetch 2026-05-25 (silent)
- implicit_adrs[read-only-classpath] ← IntegrationConfiguration.java:10-13 + IntegrationRegistry.java:8-12 + IntegrationRegistryFactory.java:24-61
- implicit_adrs[open-read-by-design] ← SecurityConstants.java:98+ + AuthorizationCustomizer.java:29-30 + PolicyPermissionDto.java (no INTEGRATION_*)
- implicit_adrs[plugin-extensible] ← IntegrationRegistryFactory.java:26 (`classpath*:` glob) + Glob result (zero hits in repo)
- implicit_adrs[single-static-param] ← StaticArgumentMappingContext.java:11-25 + the live wizard doc page's framing
- implicit_adrs[fail-fast-on-malformed] ← IntegrationRegistryFactory.java:48-50, 56-60
- bugs_limitations_corner_cases[installed-constant] ← IntegrationMapper.java:27, 30 + components.yaml:64-70 + IntegrationPreviewItem.tsx:44-51
- bugs_limitations_corner_cases[204-on-missing] ← ResourceFilesIntegrationRegistry.java:15-17 + IntegrationServiceImpl.java:20-23 + IntegrationController.java:19-22 + openapi.yaml:75-81
- bugs_limitations_corner_cases[platform-url-placeholder] ← application.yml:209 + StaticArgumentMappingContext.java:16 + IntegrationMapper.java:38-45
- bugs_limitations_corner_cases[case-collision] ← IntegrationRegistryFactory.java:32-37
- bugs_limitations_corner_cases[fail-fast-yaml] ← IntegrationRegistryFactory.java:48-50, 56-60
- bugs_limitations_corner_cases[no-rbac] ← SecurityConstants.java:98+ + AuthorizationCustomizer.java:29-30
- bugs_limitations_corner_cases[disabled-anonymous] ← DisabledAuthSecurityConfiguration.java:13-18 + StaticArgumentMappingContext.java:16
- bugs_limitations_corner_cases[no-pagination] ← ResourceFilesIntegrationRegistry.java:19-22 + IntegrationPreviewList.tsx:26-29
- bugs_limitations_corner_cases[free-form-id] ← IntegrationController.java:19
- bugs_limitations_corner_cases[unused-exchange] ← IntegrationController.java:20, 25
- stress_findings.tunables[platform-base-url] ← StaticArgumentMappingContext.java:16 + IntegrationMapper.java:38-45
- stress_findings.tunables[treemap-comparator] ← IntegrationRegistryFactory.java:32-37
- stress_findings.name_behavior_pairs[installed-constant] ← IntegrationMapper.java:27, 30 + components.yaml:64-70 + IntegrationPreviewItem.tsx:44-51
- stress_findings.name_behavior_pairs[getIntegration-204] ← IntegrationController.java:19-22 + ResourceFilesIntegrationRegistry.java:15-17 + openapi.yaml:75-81
- stress_findings.name_behavior_pairs[empty-default-registry] ← IntegrationRegistryFactory.java:26 + Glob META-INF/wizard returns zero in repo
- stress_findings.orderings ← IntegrationRegistryFactory.java:36 + ResourceFilesIntegrationRegistry.java:21
- stress_findings.auth_gates ← SecurityConstants.java:98+ + AuthorizationCustomizer.java:29-30 + IntegrationController.java:1-28 + IntegrationService.java:1-11 + IntegrationServiceImpl.java:1-29 + DisabledAuthSecurityConfiguration.java:13-18
- stress_findings.resource_boundaries ← IntegrationConfiguration.java:10-13 + IntegrationRegistry.java:8-12 + ResourceFilesIntegrationRegistry.java:11-22
- stress_findings.request_inputs[integrationId] ← IntegrationController.java:19 + IntegrationServiceImpl.java:20-23 + ResourceFilesIntegrationRegistry.java:15-17 + IntegrationRegistryFactory.java:32-37
- stress_findings.probes_emitted ← lineage/odd-platform/probes/P-126.yaml
- security.auth_mode_relevance ← IntegrationController.java:1-28 + SecurityConstants.java:98+ + DisabledAuthSecurityConfiguration.java:13-18 + AuthorizationCustomizer.java:29-30
- security.ingestion_filter_relevance ← (path is /api/integrations*, not /ingestion/**)
- security.authorization_assertions ← SecurityConstants.java:98+ + AuthorizationCustomizer.java:29-30 + IntegrationController.java:1-28 + IntegrationServiceImpl.java:1-29 + grep INTEGRATION in PolicyPermissionDto.java zero hits
- security.owner_scoping ← no owner column in any Integration DTO; classpath resources are global
- security.data_exposure ← IntegrationController.java:19-27 + IntegrationMapper.java:23-50 + StaticArgumentMappingContext.java:11-25
- security.known_security_gaps[disabled-anonymous] ← DisabledAuthSecurityConfiguration.java:13-18 + StaticArgumentMappingContext.java:16 + WebFetch 2026-05-25
- security.known_security_gaps[open-read-undocumented] ← SecurityConstants.java:98+ + AuthorizationCustomizer.java:29-30 + WebFetch 2026-05-25
- security.known_security_gaps[no-request-log] ← IntegrationController.java:1-28 + IntegrationServiceImpl.java:1-29 (no @Slf4j)
- performance.hot_paths[list] ← IntegrationController.java:25-27 + ResourceFilesIntegrationRegistry.java:19-22 + IntegrationServiceImpl.java:25-28
- performance.hot_paths[get] ← IntegrationController.java:19-22 + ResourceFilesIntegrationRegistry.java:15-17
- performance.resource_allocation ← IntegrationRegistryFactory.java:24-61 + IntegrationController.java:19-27
- performance.scaling_characteristics ← IntegrationConfiguration.java:10-13 + ResourceFilesIntegrationRegistry.java:11-22
- performance.known_performance_gaps[no-pagination] ← ResourceFilesIntegrationRegistry.java:19-22 + IntegrationServiceImpl.java:25-28
- performance.known_performance_gaps[client-side-filter] ← IntegrationPreviewList.tsx:26-29
- performance.known_performance_gaps[boot-fail-fast] ← IntegrationRegistryFactory.java:48-50, 56-60
- upstream_callers ← IntegrationController.java:19-27 + IntegrationPreviewList.tsx:21 + Integration.tsx:21 + integration.ts:11-46 + managementRoutes.ts:7 + Integrations.tsx:13-14
- downstream_side_effects ← IntegrationController.java:19-27 + IntegrationServiceImpl.java:20-28 + ResourceFilesIntegrationRegistry.java:15-22 + IntegrationMapper.java:23-50

## confidence_per_field

- understanding: HIGH (full 28-line file read; every method traced through IntegrationApi → IntegrationService → IntegrationServiceImpl → IntegrationRegistry → ResourceFilesIntegrationRegistry → IntegrationMapper + StaticArgumentMappingContext; security wiring verified via SecurityConstants.java + AuthorizationCustomizer.java; UI consumers traced via IntegrationPreviewList.tsx, Integration.tsx, integration.ts, managementRoutes.ts; the five substantive findings each anchored at file:line)
- concepts: HIGH (every entity / operation / invariant / audience traced to source file or 1-hop neighbour)
- dependencies_semantic: HIGH (every requires/couples-to anchor verified at file:line)
- tests_coverage_semantic: HIGH (zero tests confirmed by grep; 13 uncovered behaviours each named with test_class and criticality; the gaps analysis identifies the highest-leverage gaps)
- docs_link_semantic: HIGH (four URLs WebFetched live 2026-05-25 at status 200; verbatim excerpts quoted; five doc-drift findings each anchored at WebFetch result + code file:line)
- implicit_adrs: HIGH (five implicit ADRs each with intent_anchor evidence and HIGH confidence)
- bugs_limitations_corner_cases: HIGH (ten concerns each anchored at file:line with severity)
- security: HIGH (auth-mode relevance + ingestion-filter relevance + 4 authorisation assertions verified at file:line; owner-scoping N/A confirmed; data-exposure traced to response shapes including the platform_url leak under DISABLED; three known security gaps each anchored)
- performance: HIGH (hot-paths clear; in-memory registry traced; no DB I/O on the hot path; three known performance gaps each LOW severity)
- upstream_callers: HIGH (2 REST entry-points + 2 UI-route entry-points all anchored at file:line, no unresolved references)
- downstream_side_effects: HIGH (2 page-render side effects anchored at file:line; no DB writes, no external calls, no activity emissions, no metric emissions, no log emissions, no SSE pushes — pure read controller)
- stress_findings: HIGH (7 triggers; 22 questions; 21 STATIC-INFERRED with strong file:line evidence + WebFetch corroboration; 1 PROBE-NEEDED for the 204-vs-404 contract pinning, emitted as P-126; 3 drift_flags surfaced)

## Maintainer notes

(empty — no previous sidecar)

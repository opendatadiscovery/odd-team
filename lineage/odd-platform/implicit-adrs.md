---
artefact: implicit-adrs
generated_at: "2026-05-08T21:49:00+02:00"
generated_at_commit: ede5d277
sidecar_count: 15
existing_adrs_count: 18
prompt_version: "adr-archaeologist/0.1.0"
total_candidates: 23
candidates_by_category: { promote: 21, extend-existing: 0, drift: 0, unique-load-bearing: 2 }
candidates_by_severity: { HIGH: 7, MEDIUM: 11, LOW: 5 }
---

# Implicit ADRs surfaced — odd-platform — 2026-05-08

## Summary

- **Candidates**: 23 total (7 HIGH, 11 MEDIUM, 5 LOW).
- **By category**: 21 `promote` (no existing ADR covers the substance), 2 `unique-load-bearing` (single-sidecar, security/deployment-architecture-defining). Zero `extend-existing` and zero `drift` — the existing ADR drafts (`code-lineage-substrate`, `agentic-code-ontology`, `refactor-to-pillar-architecture`, accepted `summary-top-level-restructure`) are workspace-meta and IA-shaped; none of them legislate Spring/Java/TypeScript code-level patterns. The platform's architectural decisions live in code today, not in `adrs/`.
- **By feature** (top affected node clusters):
  - Spring controller / Spring Security pattern (8 sidecars) — biggest cluster; six implicit ADRs surfaced.
  - GenAI feature (2 sidecars) — five implicit ADRs surfaced; security and operability load-bearing.
  - i18n / locale (2 sidecars) — four implicit ADRs surfaced; UX-pattern decisions.
  - Attachment storage (2 sidecars) — four implicit ADRs surfaced; SDK-builder decisions per LSN-001/002 class.
  - OpenAPI tag / contract (2 sidecars) — three implicit ADRs surfaced; affects code-generation strategy.
  - AlertManager external alerts (1 sidecar) — three implicit ADRs surfaced; one is HIGH-severity unique.
  - TS routes (1 sidecar) — three implicit ADRs surfaced; UI-shell patterns.
- **Cross-references**: 0 candidates align with existing `adrs/drafts/*`; 0 conflict. The substrate ADRs' "i18n undocumented" framing is an enumeration-coverage miss, not a duplicate of the i18n implementation ADRs surfaced here.

## Candidates

### HIGH severity

- **ADR-CANDIDATE-001**: Controllers are pass-through delegates; HTTP wiring lives on OpenAPI-generator-emitted `*Api` interfaces, not on the controller class
  - **Category**: promote
  - **Support**: surfaced by 3 sidecars across `controller` + `controller-method` axes (the AlertManager hand-coded counter-example confirms by exception)
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__AlertController.md:implicit_adrs.[0]` ("Controllers in this repository are pass-through delegates; HTTP method/path/produces/consumes mappings live on OpenAPI-generator-produced `*Api` interfaces, NOT on the `*Controller` class itself.")
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityAttachmentController.md:implicit_adrs.[0]` ("Controllers in this repository are pass-through delegates; HTTP method/path/produces/consumes mappings live on OpenAPI-generator-produced `*Api` interfaces, not on the `*Controller` class itself.")
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__GenAIController.md:implicit_adrs.[0]` ("Controllers in this repository are pass-through delegates; HTTP method/path/produces/consumes mappings live on OpenAPI-generator-produced `*Api` interfaces, NOT on the `*Controller` class itself.")
  - **Decision statement**: REST controllers in `odd-platform-api` are thin delegates that `implements` an OpenAPI-generator-produced `*Api` interface; HTTP method/path/produces/consumes annotations live exclusively on the generated interface, never on the controller class. Controllers carry only `@RestController` + `@RequiredArgsConstructor`; methods carry only `@Override`. Adding or changing a route is therefore a `openapi.yaml` + regenerate flow, not a controller-edit flow.
  - **Evidence**:
    - AlertController.md says: "AlertController.java:15-17 (only `@RestController` and `@RequiredArgsConstructor` on the class; no `@RequestMapping`, `@GetMapping`, `@PutMapping`, etc. anywhere in the file) + AlertApi.java:64-69, 106-110, 147-151, 190-194 (each method on the interface carries the full `@RequestMapping(method = ..., value = \"/api/alerts/...\", produces = ..., consumes = ...)` block)"
    - DataEntityAttachmentController.md says: "openapi.yaml:1566-1774 (every endpoint's HTTP method/path lives on the spec, generated into `DataEntityAttachmentApi` at build time)"
    - GenAIController.md says: "GenaiApi.java:61-66 (the interface carries the full `@RequestMapping(method = POST, value = \"/api/genai/ask\", produces = ..., consumes = ...)` block)"
  - **Existing ADR**: none. The existing ADRs in `adrs/` are workspace-meta or IA-shaped and do not cover the controller pattern.
  - **Proposed action**: Promote to `adrs/drafts/openapi-generated-controller-interfaces.md` (new ADR). Document the regenerate flow, the canonical exception (AlertManagerController, see ADR-CANDIDATE-018), and the consequence for refactors that try to add a route by editing only the controller.
  - **Severity rationale**: HIGH — defines the entire HTTP surface's contract-source-of-truth; a future maintainer who adds a `@PostMapping` on a controller class will produce a working endpoint that bypasses the OpenAPI contract and silently drifts the spec. This is a single-line mistake that breaks a load-bearing convention.

- **ADR-CANDIDATE-002**: Authorization wiring lives at the `SecurityConstants.SECURITY_RULES` path-matcher layer (programmatic Spring Security), not at controllers via `@PreAuthorize`
  - **Category**: promote
  - **Support**: surfaced by 6 sidecars across `controller` + `controller-method` + `openapi-tag` axes
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__AlertController.md:implicit_adrs.[1]` ("Authorisation / visibility filtering for alerts is a service-layer concern, not a controller-layer concern. The controller carries no `@PreAuthorize`, no `@Secured`...")
    - `odd-platform__java__AlertController__controller-method__changeAlertStatus.md:implicit_adrs.[3]` ("Authorization for changeAlertStatus is not enforced at the controller-method layer — there is no @PreAuthorize or hasPermission annotation on AlertController or its method overrides.")
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityAttachmentController.md:implicit_adrs.[1]` ("Authorisation/RBAC for attachments is enforced **above** the controller, in a path-matcher-driven Spring Security filter chain — not via `@PreAuthorize` on the controller class. The mapping from URL+HTTP-method to `PolicyPermissionDto` lives in a single `SecurityConstants.SECURITY_RULES` declaration; the controller stays annotation-free.")
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityController.md:implicit_adrs.[0]` ("Authorization for `DataEntityController` is wired by external path-pattern matching in `SecurityConstants.SECURITY_RULES`, NOT by `@PreAuthorize` annotations on the controller methods or generated `*Api` interface.")
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DirectoryController.md:implicit_adrs.[4]` ("Directory endpoints carry no controller-level authorization annotations (no @PreAuthorize, no @Secured); access control, if any, is enforced at the framework / global-security-config level rather than per-route.")
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__GenAIController.md:implicit_adrs.[1]` ("Authorization for the GenAI endpoint is delegated entirely to the Spring Security filter chain via path-matcher fall-through, NOT enforced at the controller layer.")
  - **Decision statement**: Authorization across `odd-platform-api` is centralized in a single `SecurityConstants.SECURITY_RULES` table consumed by `AuthorizationCustomizer` — every gated endpoint is one `RequestMatcher → PolicyPermissionDto` row. Controllers and the generated `*Api` interfaces carry zero `@PreAuthorize`, `@Secured`, or programmatic permission checks. The trade-off accepted: a single auditable security matrix at the cost of controllers being opaque about their own auth posture, and at the cost of silent drift when a controller's URL pattern changes but its `SECURITY_RULES` row does not (path-string coupling — see ADR-CANDIDATE-003 for the read-side corollary).
  - **Evidence**:
    - DataEntityAttachmentController.md says: "SecurityConstants.java:247-276 (every write-path matcher mapped to `DATA_ENTITY_ATTACHMENT_MANAGE`)"
    - DataEntityController.md says: "DataEntityController.java:1-454 (no `@PreAuthorize`/`@Secured`/permission imports) + SecurityConstants.java:98-355 (path-pattern rules) + AuthorizationCustomizer.java:24-28 (the only consumer of SECURITY_RULES)"
    - GenAIController.md says: "AuthorizationCustomizer.java:29-30 (`.pathMatchers(\"/**\").authenticated()` fall-through)"
  - **Existing ADR**: none.
  - **Proposed action**: Promote to `adrs/drafts/centralized-security-rules.md` (new ADR). Capture the trade-off: single audit point vs. path-string coupling fragility (DataEntityController sidecar's `bugs_limitations_corner_cases` documents the live `/term` vs `/terms` drift case where the SECURITY_RULES path doesn't match the actual API path, silently disabling a `DATA_ENTITY_ADD_TERM` gate). Reference `AuthorizationCustomizer` as the canonical consumer.
  - **Severity rationale**: HIGH — security-architecture decision. A maintainer who adds `@PreAuthorize` to a controller does not violate functionality, but breaks the "single matrix" invariant; a maintainer who renames a URL without updating SECURITY_RULES silently disables a permission gate.

- **ADR-CANDIDATE-003**: GET endpoints are intentionally outside `SECURITY_RULES`; only mutating routes carry permission gates — reads are uniformly authenticated-only, no role/owner/permission gate
  - **Category**: promote
  - **Support**: surfaced by 3 sidecars
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityAttachmentController.md:implicit_adrs.[4]` ("Read-side endpoints on the attachments surface (`GET /attachments`, `GET /files/uploads` upload options, `GET /files/{file_id}` download) are NOT gated by `DATA_ENTITY_ATTACHMENT_MANAGE` — only authentication is required... This is an embodied decision (any authenticated user can list and download any data entity's attachments) but no ADR documents it; it may be intentional read-availability OR a missed gate.")
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityController.md:implicit_adrs.[1]` ("Read endpoints on `DataEntityController` are NOT in `SECURITY_RULES` — `getDataEntityDetails`, `getDataEntityAlerts`, `getDataEntityMessages`, `getMetrics`, lineage reads, etc. fall through to `pathMatchers(\"/**\").authenticated()` ... any authenticated user may read any data entity's full metadata, ownership, alerts, messages, descriptions, and lineage. Whether this is intentional 'collaborative catalog' policy or an oversight is not surfaced in code or docs.")
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DirectoryController.md:implicit_adrs.[5]` ("GET endpoints are intentionally outside SecurityConstants.SECURITY_RULES — only mutating routes (POST/PUT/DELETE/PATCH) carry per-route Permission gates; reads are uniformly authenticated-only across the platform.")
  - **Decision statement**: The `SECURITY_RULES` table contains only mutation matchers (POST/PUT/DELETE/PATCH); GET endpoints fall through to `AuthorizationCustomizer.java:29-30`'s `.pathMatchers("/**").authenticated()`. The platform therefore models its catalog as **read-collaborative** across all authenticated users — any logged-in user can read any data entity's metadata, alerts, messages, owners, lineage, and attachments. The decision is consistent across DataEntityController, DataEntityAttachmentController, and DirectoryController; the sidecars flag that it is **not surfaced in user-facing docs** (operators cannot determine it from `/configuration-and-deployment/enable-security/authorization`, which describes the framework abstractly).
  - **Evidence**:
    - DataEntityController.md says: "SecurityConstants.java:98-355 (zero GET rules for /api/dataentities/{id}* read paths)"
    - DataEntityAttachmentController.md says: "SecurityConstants.java:247-276 (only POST/PUT/DELETE matchers for `/files/**`, `/links/**`; no GET matchers)"
    - DirectoryController.md says: "SecurityConstants.java:98-355 (no `/api/directory*` rules; the SECURITY_RULES list contains only mutating-method matchers)"
  - **Existing ADR**: none.
  - **Proposed action**: Promote to `adrs/drafts/read-collaborative-catalog.md` (new ADR). The decision is load-bearing: it commits the platform to "any authenticated user is a catalog reader" and explicitly excludes per-data-entity read ACLs. The doc-gap is a separate DOC-NNN candidate — the `/enable-security/authorization` page should name read-collaboration as a posture the operator is opting into.
  - **Severity rationale**: HIGH — security posture decision affecting every read endpoint in the platform. An operator deploying ODD assuming row-level read ACLs would be surprised; the doc does not warn them. This is the architectural shape of "what the platform protects vs. shares."

- **ADR-CANDIDATE-004**: GenAI feature is shipped disabled-by-default; `enabled: false` is explicit in `application.yml`, and defaults are deliberately unsafe-when-enabled to force operator configuration
  - **Category**: promote
  - **Support**: surfaced by 2 sidecars (`config-properties-class` + `controller`)
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_config_properties__config-properties-class__GenAIProperties.md:implicit_adrs.[0]` ("GenAI is shipped disabled-by-default — the YAML explicitly writes `enabled: false` rather than relying on the Java primitive default of `false`.")
    - `odd-platform__java__org_opendatadiscovery_oddplatform_config_properties__config-properties-class__GenAIProperties.md:implicit_adrs.[1]` ("Defaults are deliberately unsafe-when-enabled to force operators to configure the feature deliberately. The Java field initializers for `url` and `requestTimeout` are absent, so unsetting either via env (e.g. `GENAI_URL=`) collapses to `null` / `0` and the request fails fast at the WebClient layer rather than silently calling some implicit endpoint.")
  - **Decision statement**: GenAI is opt-in: `genai.enabled: false` is the shipped default and is **written verbatim in `application.yml`** (not relying on the Java primitive default) so operators see the disabled state when they read config. When `enabled=true`, fields without YAML values force a fast failure (`url=null` → WebClient error; `requestTimeout=0` → immediate timeout) — the platform refuses to silently call an implicit endpoint or hang indefinitely.
  - **Evidence**:
    - GenAIProperties.md says: "GenAIProperties.java:9 (`private boolean enabled;`) + application.yml:17-18 (`genai:\n  enabled: false`)"
    - GenAIProperties.md says: "GenAIProperties.java:10-11 (no initializers) + application.yml:19-20 (commented-out examples, not defaults)"
  - **Existing ADR**: none.
  - **Proposed action**: Promote to `adrs/drafts/genai-opt-in-defaults.md` (new ADR). Document together with ADR-CANDIDATE-005 (GenAI WebClient at startup) and ADR-CANDIDATE-006 (no auth, no retry) as the GenAI feature's operability posture.
  - **Severity rationale**: HIGH — security/safety decision. Disabled-by-default + fail-fast-on-misconfig prevents the LSN-001/002 silent-default class for this specific feature; future work that introduces non-empty defaults would regress this posture.

- **ADR-CANDIDATE-005**: GenAI requests are not authenticated and not retried; the platform assumes the external AI service is on a trusted network
  - **Category**: promote
  - **Support**: surfaced by 1 sidecar (GenAIProperties), but the decision spans the WebClient construction, the request path, and the absence of any `apiKey` field — load-bearing across the feature
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_config_properties__config-properties-class__GenAIProperties.md:implicit_adrs.[4]` ("GenAI requests are not authenticated and not retried — there is no auth header on the WebClient, no `Authorization`-equivalent field on `GenAIProperties`, and no `Retry`/`onErrorRetry` on the Mono chain. Operators deploy this feature on the assumption that the external AI service is on a trusted network.")
  - **Decision statement**: The GenAI feature has no application-layer authentication of outbound requests (no API key field, no bearer token, no Authorization header on `genAiWebClient`) and no retry policy on the `WebClient` Mono chain. Operators are expected to either co-locate the GenAI service on a trusted network segment or front it with a reverse-proxy that injects its own auth. The decision composes with ADR-CANDIDATE-007 (THIN PROXY by design) — non-functional concerns are operator-delegated.
  - **Evidence**:
    - GenAIProperties.md says: "GenAIProperties.java:8-12 (no `apiKey` / `token` / `auth` fields) + WebClientConfiguration.java:26-29 (no `defaultHeader(HttpHeaders.AUTHORIZATION, ...)`) + GenAIServiceImpl.java:41-52 (no `.retry(...)` / `.retryWhen(...)`)"
  - **Existing ADR**: none.
  - **Proposed action**: Promote to `adrs/drafts/genai-no-app-auth.md` (or fold into ADR-CANDIDATE-004 as a section "Operator network responsibility"). Operationally significant: the `/genai/ask` endpoint forwards arbitrary user-supplied prompts outbound; absence of allowlist/auth means operators must understand they own the egress posture.
  - **Severity rationale**: HIGH — security-architecture decision. An operator who deploys GenAI assuming the platform handles outbound auth is exposed (egress from the platform pod, no authentication on the LLM call, no rate limit). Doc-gap candidate exists too (the live GenAI doc says "Injection concerns fall to your external service implementation" but does not enumerate auth/retry/allowlist).

- **ADR-CANDIDATE-006**: AlertManager Webhook Receiver authentication is operator-delegated to the network layer (reverse proxy / mTLS / NetworkPolicy); no application-layer auth
  - **Category**: unique-load-bearing
  - **Support**: surfaced by 1 sidecar (AlertManagerController) — single occurrence but deployment-architecture-defining
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__AlertManagerController.md:implicit_adrs.[2]` ("Authentication for the AlertManager webhook is delegated to operator-side network controls (reverse proxy / mTLS / NetworkPolicy) rather than handled in-platform. The endpoint is in the `/ingestion/**` whitelist (`SecurityConstants.java:96`), and unlike `/ingestion/entities` (covered by the ingestion-auth filter via `auth.ingestion.filter.enabled`), there is no shared-secret or token mechanism for the AlertManager endpoint.")
  - **Decision statement**: The `/ingestion/alertmanager` endpoint that receives Prometheus AlertManager webhooks is on the `/ingestion/**` whitelist and is **explicitly excluded from the ingestion-auth filter** that protects sibling `/ingestion/entities`. The platform commits the operator to deploying the endpoint behind a network-layer auth gate (reverse proxy / mTLS / NetworkPolicy). There is no shared-secret, no token verification, and no IP allowlist at the application layer.
  - **Evidence**:
    - AlertManagerController.md says: "SecurityConstants.java:96 (`/ingestion/**` whitelist) + absence of any `IngestionAlertManager*Filter` in `auth/filter/`"
  - **Existing ADR**: none.
  - **Proposed action**: Promote to `adrs/drafts/alertmanager-network-delegated-auth.md` (new ADR). The decision is single-sidecar but defines the operator's deployment topology — exactly the load-bearing class the system prompt names. Doc-side: `configuration-and-deployment/enable-security` should name the AlertManager endpoint as the canonical example of an operator-network-protected ingestion path.
  - **Severity rationale**: HIGH — deployment-architecture decision. A naive operator who exposes the AlertManager webhook on a public hostname accepts arbitrary external alerts without authentication, allowing log poisoning of the activity feed and arbitrary `DISTRIBUTION_ANOMALY` alert generation against any data entity ODDRN. The risk is purely deployment-topology; the application can never raise this issue itself.

- **ADR-CANDIDATE-007**: GenAI feature is a THIN PROXY by design — no prompt construction, no sanitization, no RAG, no caching, no rate-limiting, no per-user accounting
  - **Category**: promote
  - **Support**: surfaced by 1 sidecar (GenAIController) — load-bearing for the feature's operational scope
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__GenAIController.md:implicit_adrs.[2]` ("The GenAI feature is a THIN PROXY by design — the controller (and downstream service) does no prompt construction, no prompt sanitization, no retrieval-augmentation, no caching, no rate-limiting, no per-user accounting.")
  - **Decision statement**: The platform's GenAI surface is intentionally thin — it forwards user-supplied question text to an operator-supplied URL and returns the response text. Every adjacent concern (prompt engineering, abuse prevention, billing, retrieval-augmentation, response caching) is the operator's external service responsibility. The live doc captures this stance verbatim ("a thin proxy" / "Injection concerns fall to your external service implementation").
  - **Evidence**:
    - GenAIController.md says: "GenAIController.java:18-23 (single flatMap → service → ResponseEntity::ok) + GenAIServiceImpl.java:36-52 (single Mono pipeline: enabled-check → POST → unescape → 200)"
  - **Existing ADR**: none. (The live doc captures the framing but no `adrs/` entry codifies it as a binding decision against future "let's add caching" PRs.)
  - **Proposed action**: Promote to `adrs/drafts/genai-thin-proxy.md` (new ADR). Useful as a guard: a future contributor who proposes "let's add per-user rate limiting to GenAI" is making a scope-expansion that the ADR would force them to confront.
  - **Severity rationale**: HIGH — scope-defining decision. Determines what the feature is and is not; absent the ADR, future PRs may incrementally widen the feature into a stateful surface contradicting the operator-responsibility model.

### MEDIUM severity

- **ADR-CANDIDATE-008**: Reactive endpoints expose a uniform `Mono<ResponseEntity<T>>` return type; success path is `.map(ResponseEntity::ok)` (or `.thenReturn(ResponseEntity.noContent().build())` for deletes); no controller-level exception translation
  - **Category**: promote
  - **Support**: surfaced by 3 sidecars
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__AlertController.md:implicit_adrs.[2]` ("Reactive endpoints expose a uniform `Mono<ResponseEntity<T>>` return type and use a single `.map(ResponseEntity::ok)` to lift the result; no exception translation or status-code branching is done at the controller. Non-200 responses are produced exclusively by service-thrown exceptions hitting a global Spring exception handler, or by service-emitted `Mono.error(...)` signals.")
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityAttachmentController.md:implicit_adrs.[2]` ("Reactive endpoints expose a uniform `Mono<ResponseEntity<T>>` return type. Success responses are produced via `.map(ResponseEntity::ok)`; the only departure is delete endpoints, which use `.thenReturn(ResponseEntity.noContent().build())` for a 204. No exception translation or status-code branching happens at the controller — all error mapping is global.")
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityController.md:implicit_adrs.[4]` ("All 40 endpoints share a uniform `Mono<ResponseEntity<...>>.map(ResponseEntity::ok)` ... pipeline — no `.onErrorResume`, no `.switchIfEmpty(Mono.just(ResponseEntity.notFound()...))`, no try/catch.")
  - **Decision statement**: Every reactive controller endpoint terminates with `.map(ResponseEntity::ok)` (or `.thenReturn(ResponseEntity.noContent().build())` for deletes). Status-code branching, exception translation, and error response shaping are NOT done at the controller; non-200/204 outcomes are produced exclusively by service-emitted `Mono.error(...)` signals or by service-thrown exceptions intercepted by a global Spring exception handler.
  - **Evidence**: see Surfaced-by quotes — the pattern is identical across the three sidecars.
  - **Existing ADR**: none.
  - **Proposed action**: Promote to `adrs/drafts/uniform-mono-controller-pipeline.md` (new ADR). Document the global-exception-handler convention; cite it as the reason `.onErrorResume`/`.switchIfEmpty` at the controller level are anti-patterns in this codebase.
  - **Severity rationale**: MEDIUM — pattern-shaping decision. Failure mode is consistency drift, not security.

- **ADR-CANDIDATE-009**: OpenAPI tags follow URL-prefix scoping — a tag's operations all share a `/api/<plural-noun>` URL prefix, producing resource-shaped Java interfaces (`AlertApi`, `DataEntityApi`)
  - **Category**: promote
  - **Support**: surfaced by 2 sidecars (alert + dataEntity), with dataEntity surfacing a tension (the "mega-tag" concern)
  - **Surfaced by**:
    - `odd-platform__openapi__tags__openapi-tag__alert.md:implicit_adrs.[0]` ("OpenAPI tags in this spec follow URL-prefix scoping — a tag's operations all share a `/api/<plural-noun>` URL prefix. The `alert` tag scopes only `/api/alerts*` operations; alert-shaped operations under `/api/dataentities/{data_entity_id}/alerts*` are tagged with the parent resource's tag (`dataEntity`), not the alert tag. This produces resource-shaped Java interfaces (`AlertApi`, `DataEntityApi`) rather than feature-shaped ones.")
    - `odd-platform__openapi__tags__openapi-tag__dataEntity.md:implicit_adrs.[5]` ("Single tag carries 40 heterogeneous operations spanning CRUD, relationships, lineage, alerts, activity, and messaging — operationally a 'mega-tag'; UI-side cohesion does not match domain decomposition (alerts could live under `alert`, activity under `activity`, lineage under a dedicated `lineage` tag).")
  - **Decision statement**: Tag membership is determined by URL-prefix, not by feature shape. Operations under `/api/dataentities/{id}/alerts` are tagged `dataEntity`, not `alert` — even though they manipulate alert resources. The convention produces resource-shaped Java interfaces (one `*Api` per top-level resource), and as a side-effect creates "mega-tags" when a resource is the parent of many feature surfaces (the `dataEntity` tag carries 40 operations across CRUD/relationships/lineage/alerts/activity/messaging).
  - **Evidence**:
    - alert.md says: "openapi.yaml:30 (`name: alert`) + openapi.yaml:2627-2702 (5 operations all under `/api/alerts*`, all tagged `alert`) + openapi.yaml:1318-1361 (per-entity alert operations tagged `dataEntity`)"
    - dataEntity.md says: "openapi.yaml:13-48 (tag list shows separate `alert`, `activity` tags), openapi.yaml:805-2433 (dataEntity tag covers all of those for the Data Entity scope)"
  - **Existing ADR**: none.
  - **Proposed action**: Promote to `adrs/drafts/openapi-tag-by-url-prefix.md` (new ADR). Acknowledge the mega-tag tension explicitly; it is a known consequence of the convention, not a defect. A future "let's split DataEntityApi by feature" PR is the kind of refactor this ADR would gate.
  - **Severity rationale**: MEDIUM — code-generation-shaping decision. Determines the structure of every generated `*Api` interface and how UI clients import operations.

- **ADR-CANDIDATE-010**: OpenAPI spec contains no top-level `security:` block and no per-operation `security:` overrides; authorization is wired entirely in Spring Security on the consumer side, NOT declared in the contract
  - **Category**: promote
  - **Support**: surfaced by 2 sidecars (alert + dataEntity) — affects every tag in the spec uniformly
  - **Surfaced by**:
    - `odd-platform__openapi__tags__openapi-tag__alert.md:implicit_adrs.[3]` ("Authorization is wholly out-of-band of the OpenAPI contract. The spec declares no `security:` block, no `securitySchemes`, and no per-operation `security:` overrides. The contract therefore commits the platform to enforcing auth in Spring Security wiring downstream of the generated interface — the spec itself cannot be used by a tool (e.g. an API gateway, a contract-test generator) to derive who-can-call-what.")
    - `odd-platform__openapi__tags__openapi-tag__dataEntity.md:implicit_adrs.[0]` ("OpenAPI spec contains no top-level security: block and no per-operation security: override; authorization is wired entirely in Spring Security configuration on the consumer side, not declared in the contract")
  - **Decision statement**: The OpenAPI spec at `odd-platform-api-contract` declares no `security:` schemes at any level. The contract is therefore not a source of truth for who-can-call-what; downstream tooling (API gateways, contract-test generators, federated catalogs) cannot derive auth from the spec alone. The decision composes with ADR-CANDIDATE-002: SECURITY_RULES is the auth source-of-truth; the spec is silent.
  - **Evidence**:
    - alert.md says: "openapi.yaml:1-49 (no `security:` block) + openapi.yaml:2612-2702 (no per-op `security:`) + components.yaml grep (no `securitySchemes`)"
    - dataEntity.md says: "openapi.yaml:1-50 (no security:), openapi.yaml:805-2433 (no per-operation security: under any dataEntity-tag block)"
  - **Existing ADR**: none.
  - **Proposed action**: Promote to `adrs/drafts/openapi-no-security-block.md` (new ADR). Document the consequence: SDK consumers and contract-test tools must consult `SECURITY_RULES` directly to model auth.
  - **Severity rationale**: MEDIUM — contract-shape decision affecting every consumer of the OpenAPI spec.

- **ADR-CANDIDATE-011**: Each OpenAPI operation is tagged with EXACTLY ONE tag; the spec commits to a 1:1 operation-to-`*Api`-interface mapping
  - **Category**: promote
  - **Support**: surfaced by 1 sidecar but a structural decision affecting code generation
  - **Surfaced by**:
    - `odd-platform__openapi__tags__openapi-tag__alert.md:implicit_adrs.[2]` ("Each operation is tagged with EXACTLY ONE tag (single-element `tags: [<name>]` arrays in every alert operation). The OpenAPI spec permits an operation to carry multiple tags; this codebase does not exercise that capability — every operation belongs to one and only one tag-grouping.")
  - **Decision statement**: The OpenAPI spec uses single-element `tags:` arrays on every operation. Operations therefore appear in exactly one generated `*Api` interface — the OpenAPI generator's behaviour for multi-tagged operations (which would emit duplicate methods across interfaces) is intentionally not exercised.
  - **Evidence**:
    - alert.md says: "openapi.yaml:2627-2628, 2645-2646, 2663-2664, 2678-2679, 2701-2702 (every `tags:` array is a single-element list)"
  - **Existing ADR**: none.
  - **Proposed action**: Promote (or fold into ADR-CANDIDATE-009 as a section). The decision is small but commits the codebase against the multi-tag generator path.
  - **Severity rationale**: MEDIUM — code-generation invariant.

- **ADR-CANDIDATE-012**: i18n is loaded eagerly at app start as a side-effect import; every locale's JSON ships in the main bundle (no lazy per-locale loading)
  - **Category**: promote
  - **Support**: surfaced by 1 sidecar (i18n_ts) — UI-shell decision
  - **Surfaced by**:
    - `odd-platform__ts__locales__ui-shell-bootstrap__i18n_ts.md:implicit_adrs.[0]` ("i18n is loaded eagerly at app start as a side-effect import, not lazily per-locale; every locale's JSON ships in the main bundle.")
  - **Decision statement**: `odd-platform-ui/src/index.tsx:23` imports `'locales/i18n'` as a side-effect; `i18n.ts` statically imports six locale JSON files at module load. Bundle bandwidth is traded for startup determinism; locale-bundle-size optimisation is not pursued. Adding a locale increases the main bundle proportionally; switching language at runtime requires no network fetch.
  - **Evidence**:
    - i18n_ts.md says: "`odd-platform-ui/src/index.tsx:23` (`import 'locales/i18n';` with no module specifier guard) + `odd-platform-ui/src/locales/i18n.ts:3-8` (six static `import` declarations for each locale's JSON, not dynamic `import()`)"
  - **Existing ADR**: none. (The substrate ADR mentions i18n only as an enumeration-coverage trigger, not as the implementation pattern.)
  - **Proposed action**: Promote to `adrs/drafts/i18n-eager-bootstrap.md` (new ADR). Document together with ADR-CANDIDATE-013 (localStorage) and ADR-CANDIDATE-014 (natural-keys) as the i18n architectural posture.
  - **Severity rationale**: MEDIUM — pattern-shaping decision. A future "let's lazy-load locales" PR is the kind of refactor this ADR would gate; the trade-off (bundle-size vs. zero-network locale switch) needs to be deliberate.

- **ADR-CANDIDATE-013**: Language preference is persisted client-side only, in `localStorage('i18nextLng')`, with no server-side user-profile binding
  - **Category**: promote
  - **Support**: surfaced by 2 sidecars (i18n_ts + SelectLanguage)
  - **Surfaced by**:
    - `odd-platform__ts__locales__ui-shell-bootstrap__i18n_ts.md:implicit_adrs.[1]` ("Language preference is persisted client-side only, in `localStorage` under the key `i18nextLng`, with no server-side user-profile binding.")
    - `odd-platform__ts__components_shared_elements_AppToolbar__ui-shell-widget__SelectLanguage.md:implicit_adrs.[0]` ("Language preference is persisted **client-side only**, in `localStorage` under the key `i18nextLng`, with no server-side user-profile binding. Switching browsers / private mode / clearing site data resets the choice to default English.")
  - **Decision statement**: The user's selected UI language is stored only in browser `localStorage` under the key `i18nextLng`. There is no backend user-profile field, no API call on language change, and no cross-device sync. Clearing site data, private browsing, or switching browsers resets the choice to default English.
  - **Evidence**:
    - i18n_ts.md says: "`odd-platform-ui/src/locales/i18n.ts:22` (read) + `SelectLanguage.tsx:30` (write — `localStorage.setItem('i18nextLng', lang)`). No backend API call accompanies the language change; no user record stores it."
    - SelectLanguage.md says: "grep for `i18nextLng` across `odd-platform-api/src/main/java/` returns zero matches at commit ede5d277."
  - **Existing ADR**: none.
  - **Proposed action**: Promote (or fold into ADR-CANDIDATE-012 as a section "Persistence shape"). The decision is small but UX-defining for multi-device users.
  - **Severity rationale**: MEDIUM — UX decision affecting every user-visible localised string.

- **ADR-CANDIDATE-014**: Translation keys are the literal English source phrases (natural-keys i18next pattern); missing keys silently render the English phrase via fallback chain
  - **Category**: promote
  - **Support**: surfaced by 1 sidecar (i18n_ts)
  - **Surfaced by**:
    - `odd-platform__ts__locales__ui-shell-bootstrap__i18n_ts.md:implicit_adrs.[2]` ("Translation keys are the literal English source phrases (the natural-keys i18next pattern), so a missing key in a non-English locale silently renders the English phrase rather than a placeholder or error.")
  - **Decision statement**: The codebase uses i18next's natural-keys pattern: translation keys are the literal English source phrases (e.g., `"About": "About"`, `"Accept": "Accept"`). The fallback chain ends in `'en'`, so a missing key in a non-English locale silently renders the English phrase. The trade-off accepted: developer ergonomics (no synthetic key namespace) vs. silent QA gap (untranslated strings are user-invisible to non-English readers without a per-locale audit).
  - **Evidence**:
    - i18n_ts.md says: "`odd-platform-ui/src/locales/translations/en.json` (first entries: `\"About\": \"About\"`, `\"Accept\": \"Accept\"`) + `odd-platform-ui/src/locales/i18n.ts:30` (`fallbackLng` chain ending in `'en'`)"
  - **Existing ADR**: none.
  - **Proposed action**: Promote to `adrs/drafts/i18n-natural-keys.md` (new ADR or section in ADR-CANDIDATE-012). Document the QA implication: testing locale completeness requires an explicit key-coverage report, not a "do non-English locales render?" smoke check.
  - **Severity rationale**: MEDIUM — pattern-shaping; affects translation-completeness validation.

- **ADR-CANDIDATE-015**: Attachment storage backend is selected via `@ConditionalOnProperty` on `attachment.storage` (boot-time wiring); switching modes requires a Platform restart, with `LOCAL` as the implicit default via `matchIfMissing=true`
  - **Category**: promote
  - **Support**: surfaced by 1 sidecar (attachment.yml) — load-bearing config-prefix decision
  - **Surfaced by**:
    - `odd-platform__yaml__application_yml__config-prefix__attachment.md:implicit_adrs.[0]` ("Storage-mode selection is a Spring `@ConditionalOnProperty` switch on `attachment.storage`, not a runtime strategy lookup — beans are wired at boot per the active mode, and switching modes requires a restart.")
    - `odd-platform__yaml__application_yml__config-prefix__attachment.md:implicit_adrs.[1]` ("LOCAL is the implicit default when `attachment.storage` is unset (`matchIfMissing = true` on the LOCAL `@ConditionalOnProperty` annotations). The shipped `application.yml:216` value `LOCAL` is redundant defence-in-depth; an operator who deletes the line still gets LOCAL beans.")
  - **Decision statement**: Storage backend wiring uses Spring's `@ConditionalOnProperty` on `attachment.storage` with `matchIfMissing=true` on the LOCAL beans. The shipped `application.yml` value is redundant defence-in-depth; the absence of the property still produces LOCAL behaviour. Switching between LOCAL and REMOTE is a boot-time decision; runtime strategy lookup is not used.
  - **Evidence**:
    - attachment.md says: "MinioConfig.java:10 + LocalFileUploadServiceImpl.java:26 + LocalFilePathConstructor.java:13 + RemoteFileUploadServiceImpl.java:36 + RemoteFilePathConstructor.java:10"
    - attachment.md says: "application.yml:216" (shipped LOCAL value)
  - **Existing ADR**: none. (LSN-001 captured the operational consequence of the LOCAL default — ephemeral storage on container restart — but the underlying wiring decision has no ADR.)
  - **Proposed action**: Promote to `adrs/drafts/attachment-storage-conditional-wiring.md` (new ADR). Cross-reference LSN-001 (the LOCAL-default-leads-to-data-loss case) as the canonical retrospective justifying the doc-side caveat that goes with the decision.
  - **Severity rationale**: MEDIUM — operational decision class. The pattern propagates to other storage-shaped subsystems; codifying it prevents future "let's add a runtime switch" PRs that would silently break the boot-time-only invariant.

- **ADR-CANDIDATE-016**: REMOTE attachment storage is MinIO-SDK-only (not AWS SDK v2); AWS-specific code paths are absent
  - **Category**: promote
  - **Support**: surfaced by 1 sidecar (attachment.yml) — substantive integration decision
  - **Surfaced by**:
    - `odd-platform__yaml__application_yml__config-prefix__attachment.md:implicit_adrs.[2]` ("REMOTE storage is S3-compatible-only, and specifically targets the MinIO SDK rather than AWS SDK v2 — the `MinioAsyncClient` builder is the only client constructed, and there is no AWS-specific code path.")
  - **Decision statement**: REMOTE storage is implemented exclusively against the MinIO SDK (`MinioAsyncClient`); the codebase does not use AWS SDK v2 even when targeting AWS S3. Operators using AWS S3 are deploying through the MinIO SDK's S3-compatibility surface, not through Amazon's first-party SDK. The decision affects how operators configure region/endpoint (e.g., LSN-002 captures the missing `.region(...)` builder call that produced silent `us-east-1` lock-in).
  - **Evidence**:
    - attachment.md says: "MinioConfig.java:3 + MinioConfig.java:20-25 + RemoteFileUploadServiceImpl.java:3-8"
  - **Existing ADR**: none.
  - **Proposed action**: Promote to `adrs/drafts/remote-storage-minio-sdk.md` (new ADR). Cross-reference LSN-002 explicitly — the decision to use MinIO SDK over AWS SDK v2 is what makes the `.region(...)` configuration manual; an ADR documenting this avoids future "let's switch to AWS SDK v2" surprises.
  - **Severity rationale**: MEDIUM — integration-substrate decision; affects operator's regional-configuration UX (LSN-002 case-law).

- **ADR-CANDIDATE-017**: `attachment.remote.bucket` must pre-exist; the platform does NOT call `bucketExists` or `makeBucket` on startup
  - **Category**: promote
  - **Support**: surfaced by 1 sidecar (attachment.yml) — operability decision
  - **Surfaced by**:
    - `odd-platform__yaml__application_yml__config-prefix__attachment.md:implicit_adrs.[3]` ("The `attachment.remote.bucket` is operator-supplied and must pre-exist — neither `MinioConfig` nor `RemoteFileUploadServiceImpl` calls `bucketExists` or `makeBucket`. Boot succeeds against a non-existent bucket; the failure surfaces only on the first upload attempt.")
  - **Decision statement**: The platform delegates bucket lifecycle to the operator. `MinioConfig` constructs the client with operator-supplied bucket name and credentials; no `bucketExists` validation runs at startup. A misconfigured bucket name produces a silently-successful boot followed by a runtime failure on the first upload — operator's responsibility to ensure the bucket exists before traffic.
  - **Evidence**:
    - attachment.md says: "MinioConfig.java:1-26 (no bucket-creation call) + RemoteFileUploadServiceImpl.java:45-50 (only validates non-empty, not existence)"
  - **Existing ADR**: none.
  - **Proposed action**: Promote (or fold into ADR-CANDIDATE-016 as a section). Doc-gap candidate too: `configuration-and-deployment` should warn operators about the no-bootstrap-validation behaviour.
  - **Severity rationale**: MEDIUM — operability decision; deferred-failure pattern operators must understand.

- **ADR-CANDIDATE-018**: AlertManager Webhook Receiver is hand-coded (NOT OpenAPI-generated) — explicit `// TODO: define OpenAPI spec based on alert provider contract`; the request DTO is an inner static class
  - **Category**: promote
  - **Support**: surfaced by 1 sidecar (AlertManagerController) — explicit counter-example to ADR-CANDIDATE-001
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__AlertManagerController.md:implicit_adrs.[0]` ("External alert ingestion is not driven by `odd-platform-api-contract` (OpenAPI). The controller is hand-coded with an explicit `// TODO: define OpenAPI spec based on alert provider contract` (AlertManagerController.java:20), and the request DTO is an inner static class on the controller rather than a generated `*Api` model.")
  - **Decision statement**: `AlertManagerController` is the canonical exception to the OpenAPI-generated-controller convention (ADR-CANDIDATE-001). The endpoint is hand-coded with an explicit TODO acknowledging the gap; the request DTO is an inner static class. The implicit decision: when the inbound contract is owned by an external provider (Prometheus AlertManager) whose schema we don't author, we accept the hand-coded controller until the provider's contract stabilises into a spec we can incorporate.
  - **Evidence**:
    - AlertManagerController.md says: "AlertManagerController.java:15-32 (no `implements *Api`, inner `AlertManagerRequest` class, explicit TODO comment)"
  - **Existing ADR**: none. (Composes with ADR-CANDIDATE-001 — the rule and its acknowledged exception go together.)
  - **Proposed action**: Promote (or fold into ADR-CANDIDATE-001 as the "Known exception" section). The decision shapes how future external-receiver endpoints are introduced — hand-coded is acceptable only when we don't own the contract.
  - **Severity rationale**: MEDIUM — pattern-shaping; defines how the rule (#001) is applied at its boundary.

### LOW severity

- **ADR-CANDIDATE-019**: Owner-scoped reads are exposed as separate first-class endpoints (`/my`, `/my/upstream`, `/my/downstream`), not as a query-parameter overlay on the cross-tenant list
  - **Category**: promote
  - **Support**: surfaced by 2 sidecars (DataEntityController + dataEntity tag)
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityController.md:implicit_adrs.[2]` ("Owner-scoped reads (`/my`, `/my/downstream`, `/my/upstream`) take NO principal parameter — the controller delegates to `dataEntityService.listAssociated(page, size [, kind])` and trusts the service to resolve the current user via reactor `Context` propagation.")
    - `odd-platform__openapi__tags__openapi-tag__dataEntity.md:implicit_adrs.[3]` ("Data Entity controllers expose owner-scoped operations (`/my`, `/my/upstream`, `/my/downstream`) as separate endpoints rather than as a query-parameter overlay on the cross-tenant list — implies the platform models 'my objects' as a first-class navigation surface")
  - **Decision statement**: Owner-scoped data-entity reads are dedicated routes (`/my*`) rather than overlay query parameters (`?owner=me`). Principal resolution happens via reactor `Context` propagation inside the service layer; controllers do not accept `Authentication`/`Principal`/owner-id parameters. The shape commits the platform to "my objects" as a navigation surface, not a filter.
  - **Evidence**: see Surfaced-by quotes.
  - **Existing ADR**: none.
  - **Proposed action**: Promote to `adrs/drafts/owner-scoped-routes.md` (new ADR or section in a routing-conventions ADR). Document together with ADR-CANDIDATE-020 (reactor-Context principal resolution) as the principal-handling pattern.
  - **Severity rationale**: LOW — convention decision; affects URL-design and navigation IA but not security or data integrity directly.

- **ADR-CANDIDATE-020**: Principal resolution is a reactor `Context` concern, not a controller-method-signature concern; controllers never accept `Authentication`/`Principal`/owner-id parameters
  - **Category**: promote
  - **Support**: surfaced by 1 sidecar (DataEntityController)
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityController.md:implicit_adrs.[2]` ("the controller delegates to `dataEntityService.listAssociated(page, size [, kind])` and trusts the service to resolve the current user via reactor `Context` propagation. The implicit ADR: principal resolution is a reactor-context concern, not a controller-method-signature concern; the controller does not wire authentication into method calls explicitly.")
  - **Decision statement**: Authenticated principal flows through the reactor `Context` (e.g., `authIdentityProvider.getCurrentUser()` reads from context) rather than being lifted into method signatures. Controllers therefore never carry `Authentication`/`Principal`/owner-id parameters; services that need the current user resolve it from context themselves.
  - **Evidence**:
    - DataEntityController.md says: "DataEntityController.java:284-305 (three `getMyObjects*` methods, none accept `Authentication`/`Principal`/owner-id)"
  - **Existing ADR**: none.
  - **Proposed action**: Promote (or fold into ADR-CANDIDATE-019 as a section "Principal resolution"). The pattern is consistent with reactive Spring conventions but is not enforced by the framework — codifying it prevents future "let's pass Authentication into the controller" PRs.
  - **Severity rationale**: LOW — convention; affects code-review uniformity, not behaviour.

- **ADR-CANDIDATE-021**: Lineage navigation is client-driven by `lineageDepth` + `expandedEntityIds`; the controller does not impose a server-side max depth (no `@Max`/`@Size` constraint at the controller)
  - **Category**: promote
  - **Support**: surfaced by 2 sidecars (DataEntityController + dataEntity tag)
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityController.md:implicit_adrs.[3]` ("Lineage navigation is client-driven by `lineageDepth` + `expandedEntityIds` — the controller does not impose a server-side max depth. The implicit ADR: the back-end trusts the UI to issue bounded depths; a malicious or naive third-party consumer can request arbitrarily deep traversals (the actual bound, if any, lives in `LineageService`, not visible from this file).")
    - `odd-platform__openapi__tags__openapi-tag__dataEntity.md:implicit_adrs.[2]` ("Lineage depth is a non-required int32 with minimum=1 and no maximum — deep-graph response size is bounded by backend service code, not the contract")
  - **Decision statement**: Lineage depth is a client-supplied non-required int32 with `minimum=1` and no maximum, both at the OpenAPI contract level and at the controller (no `@Max` annotation). The backend defends against unbounded traversal in service code, not at the contract boundary; deep-graph response size is therefore not declarable to consumers.
  - **Evidence**: see Surfaced-by quotes.
  - **Existing ADR**: none.
  - **Proposed action**: Promote to `adrs/drafts/lineage-depth-no-contract-cap.md` or fold into a broader "pagination/bounding parameters defended at service layer" ADR with ADR-CANDIDATE-022.
  - **Severity rationale**: LOW — performance/operability decision; bound-by-service-code, not by contract, is a known performance pattern in this codebase.

- **ADR-CANDIDATE-022**: Pagination parameters (`PageParam`, `SizeParam`) are int32 with no min/max/default in the OpenAPI contract; backend defends
  - **Category**: promote
  - **Support**: surfaced by 1 sidecar (dataEntity tag) — pattern is uniform across the spec
  - **Surfaced by**:
    - `odd-platform__openapi__tags__openapi-tag__dataEntity.md:implicit_adrs.[1]` ("Pagination parameters (PageParam, SizeParam) are int32 with no min/max/default — page size is at the caller's discretion; backend defends")
  - **Decision statement**: The OpenAPI spec's shared `PageParam` and `SizeParam` declarations are int32 with no `minimum`/`maximum`/`default`. Page-size validation is therefore a service-layer concern, not a contract-layer concern. Composes with ADR-CANDIDATE-021: the platform's posture is "contract is permissive, service code defends."
  - **Evidence**:
    - dataEntity.md says: "components.yaml:4213-4229"
  - **Existing ADR**: none.
  - **Proposed action**: Promote (or fold with ADR-CANDIDATE-021 into "service-layer-bounded request parameters").
  - **Severity rationale**: LOW — convention; performance/operability.

- **ADR-CANDIDATE-023**: Per-file size cap (`attachment.max-file-size`) is a UX hint, not a security/integrity boundary; enforcement is delegated to the UI client
  - **Category**: unique-load-bearing
  - **Support**: surfaced by 3 sidecars (`AttachmentServiceImpl` config-key-consumer, `attachment.yml` config-prefix, plus `DataEntityAttachmentController` consumer chain) — consistent across all three
  - **Surfaced by**:
    - `odd-platform__java__AttachmentServiceImpl__config-key-consumer__attachment_max-file-size@L27.md:implicit_adrs.[1]` ("Per-file size is treated as a UX hint, not a security/integrity boundary — enforcement is delegated to the UI client. The server-side service layer accepts whatever the chunk upload pipeline streams.")
    - `odd-platform__yaml__application_yml__config-prefix__attachment.md:implicit_adrs.[4]` ("Per-file size enforcement is delegated downstream — the YAML `max-file-size` cap is consumed exclusively by `AttachmentServiceImpl.getUploadOptions()` to populate a UI hint, and no service-layer or controller-layer guard re-validates against it. The cap is a UX boundary, not a security boundary, at this prefix's level.")
    - `odd-platform__java__AttachmentServiceImpl__config-key-consumer__attachment_max-file-size@L27.md:implicit_adrs.[0]` ("The cap is exposed as `bytes` over the wire (MB × 1_000_000), so the contract type `DataEntityUploadOptions.maxSize` is implicitly bytes-with-decimal-MB-conversion rather than megabytes.")
  - **Decision statement**: The `attachment.max-file-size` config key (in MB) is read once by `AttachmentServiceImpl.getUploadOptions()` and exposed to the UI as a `DataEntityUploadOptions.maxSize` value (in bytes, after × 1_000_000 conversion). The UI's `FileInput.tsx:39` (`file.size <= maxFileSizeInBytes`) is the only enforcement point; the chunked upload pipeline (`uploadFileChunk`, `completeFileUpload`) accepts streams of any size. A non-UI client (curl, malicious script) can bypass the cap entirely. The cap is therefore a UX-only boundary, not a security/integrity boundary.
  - **Evidence**:
    - AttachmentServiceImpl.md says: "AttachmentServiceImpl.java:27-89 (no size guard in `uploadFileChunk` or `completeFileUpload`) + DataEntityAttachmentController.java:54-62 (controller passes the chunk through without size validation) + FileInput.tsx:39 (`file.size <= maxFileSizeInBytes` is the only filter before upload starts)"
    - AttachmentServiceImpl.md says: "AttachmentServiceImpl.java:61 (`maxFileSize * 1_000_000`)" (the wire-format decision)
  - **Existing ADR**: none.
  - **Proposed action**: Promote to `adrs/drafts/attachment-size-cap-ux-hint.md` (new ADR). Surface as a security finding too — the doc-gap candidate (`/data-discovery/attachments` should warn that the cap is UI-only) is downstream. The unit-conversion (`× 1_000_000`, not `× 1024 × 1024`) is a separate decision that bears noting.
  - **Severity rationale**: LOW — security implications are real but bounded by deployment topology (LOGIN_FORM/OAUTH2/LDAP authentication still gates who can upload). The implicit ADR is operationally important but not security-architecture-shaping at the deployment topology level.

  Notes: This is `unique-load-bearing` because while three sidecars surface it, the underlying decision is a single architectural choice (cap-as-hint), not a multi-feature pattern. The classification reflects "single decision, multi-witness" rather than "recurring pattern across distinct decisions."

## Patterns surfaced from concepts.yaml

(`concepts.yaml` is produced by the concept-merger reducer in a sibling skill invocation; if/when present, its `entities[].implicit_adrs` aggregation should be cross-referenced here. Not available at the time of this run — concept-merger ran in parallel.)

## Drift findings (existing ADR vs current code)

None. The existing ADR drafts (`code-lineage-substrate`, `agentic-code-ontology`, `refactor-to-pillar-architecture`) and accepted ADR (`summary-top-level-restructure`) are workspace-meta or doc-IA-shaped; they do not legislate Spring/Java/TypeScript code-level patterns. Therefore no candidate above contradicts an existing written record. The 21 `promote` candidates are net-new additions to `adrs/`.

The following adjacency-tensions exist within the candidate set itself (and are surfaced for triage, not as drifts):

- ADR-CANDIDATE-009 (URL-prefix-shaped tags → resource-shaped Java interfaces) creates the "mega-tag" tension that dataEntity.md surfaces — `dataEntity` carries 40 operations across CRUD/relationships/lineage/alerts/activity/messaging. The candidate captures both the rule and the tension; a future redesign that splits `DataEntityApi` into per-feature interfaces would amend this ADR.
- ADR-CANDIDATE-001 (controllers are OpenAPI-generated delegates) and ADR-CANDIDATE-018 (AlertManagerController is hand-coded) are paired — the rule and its acknowledged exception. Triaging them together preserves the relationship.
- ADR-CANDIDATE-002 (centralised SECURITY_RULES) and ADR-CANDIDATE-003 (read-collaborative GET-uniformly-authenticated) compose — the second is the read-side corollary of the first's mutation-only matrix.
- ADR-CANDIDATE-004, -005, -007 form the GenAI feature posture — opt-in defaults + no-app-auth + thin-proxy. Triaging together as one ADR ("GenAI operability posture") may be cleaner than three separate drafts.
- ADR-CANDIDATE-012, -013, -014 form the i18n implementation posture — eager bootstrap + client-only persistence + natural-keys. Same triaging consideration.
- ADR-CANDIDATE-015, -016, -017 form the attachment storage posture — boot-time wiring + MinIO-SDK-only + operator-owned bucket. Same consideration; LSN-001 and LSN-002 are the canonical retrospectives.

The maintainer at triage time decides whether to ship one ADR per candidate (most explicit, most cross-linkable) or one ADR per feature posture (3 clusters at lower granularity).

## Maintainer notes

(Free-form section preserved across refreshes. Empty on first run.)

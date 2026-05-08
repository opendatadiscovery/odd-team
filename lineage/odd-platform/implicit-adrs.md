---
artefact: implicit-adrs
generated_at: "2026-05-08T22:30:00+02:00"
generated_at_commit: ede5d277
sidecar_count: 15
existing_adrs_count: 5
prompt_version: "adr-archaeologist/0.2.0"
total_candidates: 16
candidates_by_category: { promote: 14, extend-existing: 0, drift: 0, unique-load-bearing: 2 }
candidates_by_severity: { HIGH: 6, MEDIUM: 8, LOW: 2 }
wisdom_test_reclassifications: 7
---

# Implicit ADRs surfaced — odd-platform — 2026-05-08

## Summary

- **Candidates**: 16 total (6 HIGH, 8 MEDIUM, 2 LOW). 14 `promote` + 2 `unique-load-bearing` (single-sidecar, deployment/security-architecture-defining).
- **Re-run note**: This artefact is the slice-8-corrected output of adr-archaeologist/0.2.0. The first run (prompt-version 0.1.0) emitted 23 candidates without applying the 3-question wisdom test (Nygard 2011 / adr.github.io / AWS Prescriptive Guidance). On re-classification, 7 candidates failed the wisdom test (no stated rationale, refactoring within existing structure, no structural impact) and were moved to `refactoring-scopes.md`. The canonical mis-classification was the previous ADR-CANDIDATE-005 ("GenAI requests not authenticated outbound and not retried"); the absence has no stated rationale, adding outbound auth is refactoring within the existing WebClient bean, and the maintainer didn't decide to skip auth — they didn't get to it. That candidate now lives in `refactoring-scopes.md` as REFACTOR-001 / REFACTOR-002. The previous ADR-CANDIDATE-007 ("GenAI THIN PROXY") was split: the stance is an ADR; the un-defended absences (rate-limit, sanitisation, audit log, per-user accounting) are scopes. See "Reclassification trace" at the bottom.
- **By category**: 14 `promote` (no existing ADR covers the substance), 2 `unique-load-bearing` (AlertManager network-delegated auth, hand-coded AlertManagerController as the rule-and-its-exception).
- **By feature** (top affected concepts from `concepts.yaml`):
  - Spring controller / Spring Security (8 sidecars): 6 ADRs.
  - GenAI Assistant (2 sidecars): 2 ADRs (disabled-by-default, thin-proxy stance).
  - i18n / Locale Bundle (2 sidecars): 3 ADRs.
  - Attachment + Storage Backend (3 sidecars): 3 ADRs.
  - OpenAPI tag / contract (2 sidecars): 3 ADRs.
- **Cross-references**: 0 candidates align with existing `adrs/drafts/*`; 0 conflict. The existing ADR drafts are workspace-meta or doc-IA-shaped; none legislate odd-platform code-level patterns. The 16 candidates are net-new additions to the eventual `adrs/drafts/`.
- **Borderline flags** (maintainer triage): 2 candidates carry `borderline_flag: true` — ADR-CANDIDATE-003 (GET-uniformly-authenticated could be intentional read-collaboration OR forgotten gates) and ADR-CANDIDATE-013 (no-contract-security-block could be deliberate division of responsibility OR a Spring-Security migration that left openapi.yaml unupdated).

## Candidates

### HIGH severity

- **ADR-CANDIDATE-001**: Controllers are pass-through delegates; HTTP wiring lives on OpenAPI-generator-emitted `*Api` interfaces, not on the controller class
  - **Category**: promote
  - **Support**: surfaced by 3 sidecars across `controller` + `controller-method` axes (the AlertManager hand-coded counter-example confirms by exception — see ADR-CANDIDATE-014)
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__AlertController.md:implicit_adrs.[0]` ("Controllers in this repository are pass-through delegates; HTTP method/path/produces/consumes mappings live on OpenAPI-generator-produced `*Api` interfaces, NOT on the `*Controller` class itself.")
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityAttachmentController.md:implicit_adrs.[0]` ("Controllers in this repository are pass-through delegates; HTTP method/path/produces/consumes mappings live on OpenAPI-generator-produced `*Api` interfaces, not on the `*Controller` class itself.")
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__GenAIController.md:implicit_adrs.[0]` ("Controllers in this repository are pass-through delegates; HTTP method/path/produces/consumes mappings live on OpenAPI-generator-produced `*Api` interfaces, NOT on the `*Controller` class itself.")
  - **Decision statement**: REST controllers in `odd-platform-api` are thin delegates that `implements` an OpenAPI-generator-produced `*Api` interface; HTTP method/path/produces/consumes annotations live exclusively on the generated interface, never on the controller class. Controllers carry only `@RestController` + `@RequiredArgsConstructor`; methods carry only `@Override`. Adding or changing a route is therefore a `openapi.yaml` + regenerate flow, not a controller-edit flow.
  - **Wisdom test**: PASS. Deliberate codegen choice (rationale: contract-first); structural impact (every controller class shape); a `@PostMapping` on a controller is a violation, not a missing feature.
  - **Evidence**:
    - AlertController.md says: "AlertController.java:15-17 (only `@RestController` and `@RequiredArgsConstructor` on the class; no `@RequestMapping`, `@GetMapping`, `@PutMapping`, etc. anywhere in the file) + AlertApi.java:64-69, 106-110, 147-151, 190-194 (each method on the interface carries the full `@RequestMapping(method = ..., value = \"/api/alerts/...\", produces = ..., consumes = ...)` block)"
    - DataEntityAttachmentController.md says: "openapi.yaml:1566-1774 (every endpoint's HTTP method/path lives on the spec, generated into `DataEntityAttachmentApi` at build time)"
    - GenAIController.md says: "GenaiApi.java:61-66 (the interface carries the full `@RequestMapping(method = POST, value = \"/api/genai/ask\", produces = ..., consumes = ...)` block)"
  - **Existing ADR**: none. The existing ADR drafts in `adrs/` are workspace-meta or IA-shaped and do not cover the controller pattern.
  - **Co-surfaced gaps** (link from `refactoring-scopes.md`): SECURITY_RULES path-string drift (REFACTOR-008), spec-missing error-response shapes (REFACTOR-014), per-controller test coverage (REFACTOR-021/022/023).
  - **Proposed action**: Promote to `adrs/drafts/openapi-generated-controller-interfaces.md` (new ADR). Document the regenerate flow, the canonical exception (AlertManagerController, see ADR-CANDIDATE-014), and the consequence for refactors that try to add a route by editing only the controller.
  - **Severity rationale**: HIGH — defines the entire HTTP surface's contract-source-of-truth; a future maintainer who adds a `@PostMapping` on a controller class will produce a working endpoint that bypasses the OpenAPI contract and silently drifts the spec.

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
  - **Decision statement**: Authorization across `odd-platform-api` is centralized in a single `SecurityConstants.SECURITY_RULES` table consumed by `AuthorizationCustomizer` — every gated endpoint is one `RequestMatcher → PolicyPermissionDto` row. Controllers and the generated `*Api` interfaces carry zero `@PreAuthorize`, `@Secured`, or programmatic permission checks. The trade-off accepted: a single auditable security matrix at the cost of controllers being opaque about their own auth posture, and at the cost of silent drift when a controller's URL pattern changes but its `SECURITY_RULES` row does not (path-string coupling).
  - **Wisdom test**: PASS. Deliberate (programmatic vs annotation-based Spring Security), security-architecture-shaping, structural; adding `@PreAuthorize` would be a violation rather than a feature.
  - **Evidence**:
    - DataEntityAttachmentController.md says: "SecurityConstants.java:247-276 (every write-path matcher mapped to `DATA_ENTITY_ATTACHMENT_MANAGE`)"
    - DataEntityController.md says: "DataEntityController.java:1-454 (no `@PreAuthorize`/`@Secured`/permission imports) + SecurityConstants.java:98-355 (path-pattern rules) + AuthorizationCustomizer.java:24-28 (the only consumer of SECURITY_RULES)"
    - GenAIController.md says: "AuthorizationCustomizer.java:29-30 (`.pathMatchers(\"/**\").authenticated()` fall-through)"
  - **Existing ADR**: none.
  - **Co-surfaced gaps** (link from `refactoring-scopes.md`): REFACTOR-008 (the live `/term` vs `/terms` drift case where the SECURITY_RULES path doesn't match the actual API path, silently disabling a `DATA_ENTITY_ADD_TERM` gate). REFACTOR-009 (no compile-time/test-time guard against this class of drift).
  - **Proposed action**: Promote to `adrs/drafts/centralized-security-rules.md` (new ADR). Capture the trade-off: single audit point vs. path-string coupling fragility (REFACTOR-008 is the canonical retrospective). Reference `AuthorizationCustomizer` as the canonical consumer.
  - **Severity rationale**: HIGH — security-architecture decision. A maintainer who adds `@PreAuthorize` to a controller does not violate functionality, but breaks the "single matrix" invariant; a maintainer who renames a URL without updating SECURITY_RULES silently disables a permission gate.

- **ADR-CANDIDATE-003**: GET endpoints are intentionally outside `SECURITY_RULES`; only mutating routes carry permission gates — reads are uniformly authenticated-only, no role/owner/permission gate
  - **Category**: promote
  - **Borderline flag**: TRUE (per system prompt's case-law table — could be intentional read-collaborative posture OR forgotten gates; maintainer decides). DirectoryController and DataEntityController sidecars surface explicit "intentional" claim, but the live security doc does not enumerate it. Surface to maintainer; do NOT auto-promote without confirmation.
  - **Support**: surfaced by 3 sidecars
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityAttachmentController.md:implicit_adrs.[4]` ("Read-side endpoints on the attachments surface (`GET /attachments`, `GET /files/uploads` upload options, `GET /files/{file_id}` download) are NOT gated by `DATA_ENTITY_ATTACHMENT_MANAGE` — only authentication is required... This is an embodied decision (any authenticated user can list and download any data entity's attachments) but no ADR documents it; it may be intentional read-availability OR a missed gate.")
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityController.md:implicit_adrs.[1]` ("Read endpoints on `DataEntityController` are NOT in `SECURITY_RULES` — `getDataEntityDetails`, `getDataEntityAlerts`, `getDataEntityMessages`, `getMetrics`, lineage reads, etc. fall through to `pathMatchers(\"/**\").authenticated()` ... any authenticated user may read any data entity's full metadata, ownership, alerts, messages, descriptions, and lineage.")
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DirectoryController.md:implicit_adrs.[5]` ("GET endpoints are intentionally outside SecurityConstants.SECURITY_RULES — only mutating routes (POST/PUT/DELETE/PATCH) carry per-route Permission gates; reads are uniformly authenticated-only across the platform.")
  - **Decision statement**: The `SECURITY_RULES` table contains only mutation matchers (POST/PUT/DELETE/PATCH); GET endpoints fall through to `AuthorizationCustomizer.java:29-30`'s `.pathMatchers("/**").authenticated()`. The platform therefore models its catalog as **read-collaborative** across all authenticated users — any logged-in user can read any data entity's metadata, alerts, messages, owners, lineage, and attachments. The decision is consistent across DataEntityController, DataEntityAttachmentController, and DirectoryController.
  - **Wisdom test**: BORDERLINE PASS with flag. DirectoryController sidecar surfaces explicit "intentionally" framing; DataEntityController and DataEntityAttachmentController surface the pattern but flag that intentional-vs-oversight is unresolved. The pattern is consistent across 3+ sidecars and structural (read-side security model). Promote with `borderline_flag: true` so the maintainer can confirm or split the decision (e.g., `getDataEntityActivity` exposing audit trail to any authenticated user may be a specific gap rather than a posture choice).
  - **Evidence**:
    - DataEntityController.md says: "SecurityConstants.java:98-355 (zero GET rules for /api/dataentities/{id}* read paths)"
    - DataEntityAttachmentController.md says: "SecurityConstants.java:247-276 (only POST/PUT/DELETE matchers for `/files/**`, `/links/**`; no GET matchers)"
    - DirectoryController.md says: "SecurityConstants.java:98-355 (no `/api/directory*` rules; the SECURITY_RULES list contains only mutating-method matchers)"
  - **Existing ADR**: none.
  - **Co-surfaced gaps** (link from `refactoring-scopes.md`): REFACTOR-010 (audit-trail exposure on `getDataEntityActivity`), REFACTOR-011 (cross-tenant Slack-thread exposure on `getDataEntityMessages`), REFACTOR-012 (Directory inventory enumeration), REFACTOR-013 (attachment read-asymmetry).
  - **Proposed action**: Promote to `adrs/drafts/read-collaborative-catalog.md` (new ADR) with `borderline_flag` until maintainer confirms intent. Doc-side: `/configuration-and-deployment/enable-security/authorization` should name read-collaboration as a posture the operator is opting into — that doc-gap is a separate DOC-NNN candidate.
  - **Severity rationale**: HIGH — security posture decision affecting every read endpoint in the platform.

- **ADR-CANDIDATE-004**: GenAI feature is shipped disabled-by-default; `enabled: false` is explicit in `application.yml`, and defaults are deliberately unsafe-when-enabled to force operator configuration
  - **Category**: promote
  - **Support**: surfaced by 2 sidecars (`config-properties-class` + `controller`)
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_config_properties__config-properties-class__GenAIProperties.md:implicit_adrs.[0]` ("GenAI is shipped disabled-by-default — the YAML explicitly writes `enabled: false` rather than relying on the Java primitive default of `false`.")
    - `odd-platform__java__org_opendatadiscovery_oddplatform_config_properties__config-properties-class__GenAIProperties.md:implicit_adrs.[1]` ("Defaults are deliberately unsafe-when-enabled to force operators to configure the feature deliberately. The Java field initializers for `url` and `requestTimeout` are absent, so unsetting either via env (e.g. `GENAI_URL=`) collapses to `null` / `0` and the request fails fast at the WebClient layer rather than silently calling some implicit endpoint.")
  - **Decision statement**: GenAI is opt-in: `genai.enabled: false` is the shipped default and is **written verbatim in `application.yml`** (not relying on the Java primitive default) so operators see the disabled state when they read config. When `enabled=true`, fields without YAML values force a fast failure (`url=null` → WebClient error; `requestTimeout=0` → immediate timeout) — the platform refuses to silently call an implicit endpoint or hang indefinitely.
  - **Wisdom test**: PASS. Deliberate (`enabled: false` is verbatim, not relying on Java primitive default — a positive design decision); the live config-doc admonition confirms the rationale ("operators must explicitly configure each request"); structural for the deployment-architecture posture.
  - **Evidence**:
    - GenAIProperties.md says: "GenAIProperties.java:9 (`private boolean enabled;`) + application.yml:17-18 (`genai:\n  enabled: false`)"
    - GenAIProperties.md says: "GenAIProperties.java:10-11 (no initializers) + application.yml:19-20 (commented-out examples, not defaults)"
  - **Existing ADR**: none.
  - **Co-surfaced gaps** (link from `refactoring-scopes.md`): REFACTOR-005 (no `@NotNull`/`@PostConstruct`/`@URL` validation — fail-fast happens at first request, not at boot, even though boot-time fail-fast would be more operator-friendly); REFACTOR-006 (`requestTimeout=0` accepted at startup — service-layer error message leaks the misconfigured value).
  - **Proposed action**: Promote to `adrs/drafts/genai-opt-in-defaults.md` (new ADR). Document together with ADR-CANDIDATE-005 (GenAI thin-proxy stance) as the GenAI feature's operability posture. Consider folding ADR-CANDIDATE-004 + 005 into a single "GenAI deployment architecture" ADR for cross-link compactness.
  - **Severity rationale**: HIGH — security/safety decision. Disabled-by-default + fail-fast-on-misconfig prevents the LSN-001/002 silent-default class for this specific feature; future work that introduces non-empty defaults would regress this posture.

- **ADR-CANDIDATE-005**: GenAI feature is a THIN PROXY by design — the platform's responsibility ends at "forward question text, return answer text"; prompt construction, RAG, retrieval-augmentation are operator's external service responsibility
  - **Category**: promote
  - **Note on split**: This ADR covers ONLY the proxy stance — i.e., the architectural commitment that the platform does not enrich, augment, or transform the prompt/response beyond serialisation. The previous run's ADR-CANDIDATE-007 mixed this stance with several un-defended absences (rate-limit, sanitisation, audit log, per-user accounting). Per Rule 0 wisdom test, those absences are gaps (no rationale defends them; adding them is refactoring). The thin-proxy stance is the deliberate scope-boundary; the absent features that the stance explicitly defends (no prompt engineering, no RAG, no caching of LLM output) stay here. The absent features that the stance does NOT defend (rate-limit, sanitisation, audit log, per-user accounting) move to `refactoring-scopes.md`.
  - **Support**: surfaced by 1 sidecar (GenAIController) but reinforced by the live doc page's "thin proxy" / "Injection concerns fall to your external service implementation" framing — load-bearing for the feature's operational scope
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__GenAIController.md:implicit_adrs.[2]` ("The GenAI feature is a THIN PROXY by design — the controller (and downstream service) does no prompt construction, no prompt sanitization, no retrieval-augmentation, no caching, no rate-limiting, no per-user accounting.")
  - **Decision statement**: The platform's GenAI surface is intentionally thin. It forwards user-supplied question text to an operator-supplied URL via a single `WebClient.post()` and returns the response body verbatim. The platform DOES NOT engineer the prompt, perform retrieval-augmented generation, or cache the LLM output — those concerns are the operator's external service responsibility. The live doc captures this stance verbatim ("a thin proxy" / "Injection concerns fall to your external service implementation").
  - **Wisdom test**: PASS for the stance (deliberate scope boundary; live doc captures rationale; structural for the feature). Co-surfaced absences fail the test individually and live in `refactoring-scopes.md`.
  - **Evidence**:
    - GenAIController.md says: "GenAIController.java:18-23 (single flatMap → service → ResponseEntity::ok) + GenAIServiceImpl.java:36-52 (single Mono pipeline: enabled-check → POST → unescape → 200)"
  - **Existing ADR**: none. (The live doc captures the framing but no `adrs/` entry codifies it as a binding decision against future "let's add caching" PRs.)
  - **Co-surfaced gaps** (link from `refactoring-scopes.md`): REFACTOR-001 (no outbound auth), REFACTOR-002 (no retry/backoff), REFACTOR-003 (no rate limit / quota), REFACTOR-004 (no prompt sanitisation), REFACTOR-007 (no audit logging), REFACTOR-016 (no SSRF guard / URL allowlist on `genai.url`), REFACTOR-019 (`auth.type=DISABLED` + `genai.enabled=true` is anonymously reachable).
  - **Proposed action**: Promote to `adrs/drafts/genai-thin-proxy.md` (new ADR). Useful as a guard: a future contributor who proposes "let's add per-user rate limiting to GenAI" is making a scope-expansion the ADR would force them to confront. The ADR should explicitly link to `refactoring-scopes.md` so the maintainer reading the ADR sees that "thin proxy" does NOT defend the absence of rate-limiting/sanitisation/audit — those are gaps the proxy stance does not address.
  - **Severity rationale**: HIGH — scope-defining decision. Determines what the feature is and is not.

- **ADR-CANDIDATE-006**: AlertManager Webhook Receiver authentication is operator-delegated to the network layer (reverse proxy / mTLS / NetworkPolicy); no application-layer auth
  - **Category**: unique-load-bearing
  - **Support**: surfaced by 1 sidecar (AlertManagerController) — single occurrence but deployment-architecture-defining; the live security doc explicitly warns operators
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__AlertManagerController.md:implicit_adrs.[2]` ("Authentication for the AlertManager webhook is delegated to operator-side network controls (reverse proxy / mTLS / NetworkPolicy) rather than handled in-platform. The endpoint is in the `/ingestion/**` whitelist (`SecurityConstants.java:96`), and unlike `/ingestion/entities` (covered by the ingestion-auth filter via `auth.ingestion.filter.enabled`), there is no shared-secret or token mechanism for the AlertManager endpoint.")
  - **Decision statement**: The `/ingestion/alertmanager` endpoint that receives Prometheus AlertManager webhooks is on the `/ingestion/**` whitelist and is **explicitly excluded from the ingestion-auth filter** that protects sibling `/ingestion/entities`. The platform commits the operator to deploying the endpoint behind a network-layer auth gate (reverse proxy / mTLS / NetworkPolicy). There is no shared-secret, no token verification, and no IP allowlist at the application layer.
  - **Wisdom test**: PASS. Deliberate (path is in WHITELIST_PATHS AND explicitly excluded from `IngestionDataEntitiesFilter` despite being a sibling `/ingestion/*` path); rationale is captured in the live security doc ("Apply perimeter controls (network segmentation, authenticating reverse proxy, mTLS) for any deployment where these endpoints are reachable from outside the trusted network"); structural (deployment-architecture decision).
  - **Evidence**:
    - AlertManagerController.md says: "SecurityConstants.java:96 (`/ingestion/**` whitelist) + absence of any `IngestionAlertManager*Filter` in `auth/filter/`"
  - **Existing ADR**: none.
  - **Co-surfaced gaps** (link from `refactoring-scopes.md`): REFACTOR-017 (no rate-limit / dedup / payload-size cap on the unauthenticated path), REFACTOR-018 (silent orphaning when `entity_oddrn` label is missing — caller has no signal of misconfiguration).
  - **Proposed action**: Promote to `adrs/drafts/alertmanager-network-delegated-auth.md` (new ADR). The decision is single-sidecar but defines the operator's deployment topology — exactly the load-bearing class the system prompt names. Doc-side: `configuration-and-deployment/enable-security` should name the AlertManager endpoint as the canonical example of an operator-network-protected ingestion path.
  - **Severity rationale**: HIGH — deployment-architecture decision. A naive operator who exposes the AlertManager webhook on a public hostname accepts arbitrary external alerts without authentication, allowing log poisoning of the activity feed and arbitrary `DISTRIBUTION_ANOMALY` alert generation against any data entity ODDRN.

### MEDIUM severity

- **ADR-CANDIDATE-007**: Reactive endpoints expose a uniform `Mono<ResponseEntity<T>>` return type; success path is `.map(ResponseEntity::ok)` (or `.thenReturn(ResponseEntity.noContent().build())` for deletes); no controller-level exception translation
  - **Category**: promote
  - **Support**: surfaced by 3 sidecars
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__AlertController.md:implicit_adrs.[2]` ("Reactive endpoints expose a uniform `Mono<ResponseEntity<T>>` return type and use a single `.map(ResponseEntity::ok)` to lift the result; no exception translation or status-code branching is done at the controller. Non-200 responses are produced exclusively by service-thrown exceptions hitting a global Spring exception handler, or by service-emitted `Mono.error(...)` signals.")
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityAttachmentController.md:implicit_adrs.[2]` ("Reactive endpoints expose a uniform `Mono<ResponseEntity<T>>` return type. Success responses are produced via `.map(ResponseEntity::ok)`; the only departure is delete endpoints, which use `.thenReturn(ResponseEntity.noContent().build())` for a 204. No exception translation or status-code branching happens at the controller — all error mapping is global.")
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityController.md:implicit_adrs.[4]` ("All 40 endpoints share a uniform `Mono<ResponseEntity<...>>.map(ResponseEntity::ok)` ... pipeline — no `.onErrorResume`, no `.switchIfEmpty(Mono.just(ResponseEntity.notFound()...))`, no try/catch.")
  - **Decision statement**: Every reactive controller endpoint terminates with `.map(ResponseEntity::ok)` (or `.thenReturn(ResponseEntity.noContent().build())` for deletes). Status-code branching, exception translation, and error response shaping are NOT done at the controller; non-200/204 outcomes are produced exclusively by service-emitted `Mono.error(...)` signals or by service-thrown exceptions intercepted by a global Spring exception handler.
  - **Wisdom test**: PASS. Deliberate (concurrency model + global-exception-handler convention); structural (every controller in the codebase).
  - **Evidence**: see Surfaced-by quotes — the pattern is identical across the three sidecars.
  - **Existing ADR**: none.
  - **Proposed action**: Promote to `adrs/drafts/uniform-mono-controller-pipeline.md` (new ADR). Document the global-exception-handler convention; cite it as the reason `.onErrorResume`/`.switchIfEmpty` at the controller level are anti-patterns in this codebase.
  - **Severity rationale**: MEDIUM — pattern-shaping decision. Failure mode is consistency drift, not security.

- **ADR-CANDIDATE-008**: OpenAPI tags follow URL-prefix scoping with single-tag-per-operation — a tag's operations all share a `/api/<plural-noun>` URL prefix, producing resource-shaped Java interfaces (`AlertApi`, `DataEntityApi`)
  - **Category**: promote
  - **Support**: surfaced by 2 sidecars (alert + dataEntity), with dataEntity surfacing the "mega-tag" tension as an acknowledged consequence
  - **Surfaced by**:
    - `odd-platform__openapi__tags__openapi-tag__alert.md:implicit_adrs.[0]` ("OpenAPI tags in this spec follow URL-prefix scoping — a tag's operations all share a `/api/<plural-noun>` URL prefix. The `alert` tag scopes only `/api/alerts*` operations; alert-shaped operations under `/api/dataentities/{data_entity_id}/alerts*` are tagged with the parent resource's tag (`dataEntity`), not the alert tag. This produces resource-shaped Java interfaces (`AlertApi`, `DataEntityApi`) rather than feature-shaped ones.")
    - `odd-platform__openapi__tags__openapi-tag__alert.md:implicit_adrs.[2]` ("Each operation is tagged with EXACTLY ONE tag (single-element `tags: [<name>]` arrays in every alert operation).")
    - `odd-platform__openapi__tags__openapi-tag__dataEntity.md:implicit_adrs.[5]` ("Single tag carries 40 heterogeneous operations spanning CRUD, relationships, lineage, alerts, activity, and messaging — operationally a 'mega-tag'.")
  - **Decision statement**: Tag membership is determined by URL-prefix, not by feature shape. Operations under `/api/dataentities/{id}/alerts` are tagged `dataEntity`, not `alert` — even though they manipulate alert resources. Each operation carries exactly one tag (single-element `tags:` arrays). The convention produces resource-shaped Java interfaces (one `*Api` per top-level resource), and as a side-effect creates "mega-tags" when a resource is the parent of many feature surfaces (the `dataEntity` tag carries 40 operations across CRUD/relationships/lineage/alerts/activity/messaging). The OpenAPI generator's multi-tag-emit-duplicate-method behaviour is intentionally not exercised.
  - **Wisdom test**: PASS. Deliberate (codegen-shape choice); structural (every generated `*Api` interface).
  - **Evidence**:
    - alert.md says: "openapi.yaml:30 (`name: alert`) + openapi.yaml:2627-2702 (5 operations all under `/api/alerts*`, all tagged `alert`) + openapi.yaml:1318-1361 (per-entity alert operations tagged `dataEntity`)"
    - alert.md says: "openapi.yaml:2627-2628, 2645-2646, 2663-2664, 2678-2679, 2701-2702 (every `tags:` array is a single-element list)"
    - dataEntity.md says: "openapi.yaml:13-48 (tag list shows separate `alert`, `activity` tags), openapi.yaml:805-2433 (dataEntity tag covers all of those for the Data Entity scope)"
  - **Existing ADR**: none.
  - **Proposed action**: Promote to `adrs/drafts/openapi-tag-by-url-prefix.md` (new ADR). Acknowledge the mega-tag tension explicitly; it is a known consequence of the convention, not a defect. A future "let's split DataEntityApi by feature" PR is the kind of refactor this ADR would gate.
  - **Severity rationale**: MEDIUM — code-generation-shaping decision. Determines the structure of every generated `*Api` interface and how UI clients import operations.

- **ADR-CANDIDATE-009**: i18n is loaded eagerly at app start as a side-effect import; every locale's JSON ships in the main bundle (no lazy per-locale loading)
  - **Category**: promote
  - **Support**: surfaced by 1 sidecar (i18n_ts) — UI-shell decision
  - **Surfaced by**:
    - `odd-platform__ts__locales__ui-shell-bootstrap__i18n_ts.md:implicit_adrs.[0]` ("i18n is loaded eagerly at app start as a side-effect import, not lazily per-locale; every locale's JSON ships in the main bundle.")
  - **Decision statement**: `odd-platform-ui/src/index.tsx:23` imports `'locales/i18n'` as a side-effect; `i18n.ts` statically imports six locale JSON files at module load. Bundle bandwidth is traded for startup determinism; locale-bundle-size optimisation is not pursued. Adding a locale increases the main bundle proportionally; switching language at runtime requires no network fetch.
  - **Wisdom test**: PASS. Deliberate trade-off (bundle-size vs zero-network locale switch); structural (UI bootstrap shape).
  - **Evidence**:
    - i18n_ts.md says: "`odd-platform-ui/src/index.tsx:23` (`import 'locales/i18n';` with no module specifier guard) + `odd-platform-ui/src/locales/i18n.ts:3-8` (six static `import` declarations for each locale's JSON, not dynamic `import()`)"
  - **Existing ADR**: none.
  - **Proposed action**: Promote to `adrs/drafts/i18n-eager-bootstrap.md` (new ADR). Document together with ADR-CANDIDATE-010 (localStorage) and ADR-CANDIDATE-011 (natural-keys) as the i18n architectural posture.
  - **Severity rationale**: MEDIUM — pattern-shaping decision. A future "let's lazy-load locales" PR is the kind of refactor this ADR would gate.

- **ADR-CANDIDATE-010**: Language preference is persisted client-side only, in `localStorage('i18nextLng')`, with no server-side user-profile binding
  - **Category**: promote
  - **Support**: surfaced by 2 sidecars (i18n_ts + SelectLanguage)
  - **Surfaced by**:
    - `odd-platform__ts__locales__ui-shell-bootstrap__i18n_ts.md:implicit_adrs.[1]` ("Language preference is persisted client-side only, in `localStorage` under the key `i18nextLng`, with no server-side user-profile binding.")
    - `odd-platform__ts__components_shared_elements_AppToolbar__ui-shell-widget__SelectLanguage.md:implicit_adrs.[0]` ("Language preference is persisted **client-side only**, in `localStorage` under the key `i18nextLng`, with no server-side user-profile binding. Switching browsers / private mode / clearing site data resets the choice to default English.")
  - **Decision statement**: The user's selected UI language is stored only in browser `localStorage` under the key `i18nextLng`. There is no backend user-profile field, no API call on language change, and no cross-device sync. Clearing site data, private browsing, or switching browsers resets the choice to default English.
  - **Wisdom test**: PASS. Deliberate (no API call on language change, no Redux dispatch — the absence is a positive design choice for "no backend round-trip"); structural for the UX shape.
  - **Evidence**:
    - i18n_ts.md says: "`odd-platform-ui/src/locales/i18n.ts:22` (read) + `SelectLanguage.tsx:30` (write — `localStorage.setItem('i18nextLng', lang)`). No backend API call accompanies the language change; no user record stores it."
    - SelectLanguage.md says: "grep for `i18nextLng` across `odd-platform-api/src/main/java/` returns zero matches at commit ede5d277."
  - **Existing ADR**: none.
  - **Proposed action**: Promote (or fold into ADR-CANDIDATE-009 as a section "Persistence shape"). The decision is small but UX-defining for multi-device users.
  - **Severity rationale**: MEDIUM — UX decision affecting every user-visible localised string.

- **ADR-CANDIDATE-011**: Translation keys are the literal English source phrases (natural-keys i18next pattern); missing keys silently render the English phrase via fallback chain
  - **Category**: promote
  - **Support**: surfaced by 1 sidecar (i18n_ts)
  - **Surfaced by**:
    - `odd-platform__ts__locales__ui-shell-bootstrap__i18n_ts.md:implicit_adrs.[2]` ("Translation keys are the literal English source phrases (the natural-keys i18next pattern), so a missing key in a non-English locale silently renders the English phrase rather than a placeholder or error.")
  - **Decision statement**: The codebase uses i18next's natural-keys pattern: translation keys are the literal English source phrases (e.g., `"About": "About"`, `"Accept": "Accept"`). The fallback chain ends in `'en'`, so a missing key in a non-English locale silently renders the English phrase. The trade-off accepted: developer ergonomics (no synthetic key namespace) vs. silent QA gap (untranslated strings are user-invisible to non-English readers without a per-locale audit).
  - **Wisdom test**: PASS. Deliberate (i18next pattern adoption); structural (every translation file).
  - **Evidence**:
    - i18n_ts.md says: "`odd-platform-ui/src/locales/translations/en.json` (first entries: `\"About\": \"About\"`, `\"Accept\": \"Accept\"`) + `odd-platform-ui/src/locales/i18n.ts:30` (`fallbackLng` chain ending in `'en'`)"
  - **Existing ADR**: none.
  - **Co-surfaced gaps** (link from `refactoring-scopes.md`): REFACTOR-024 (the `fallbackLng` is the full six-element array `['en','es','ch','fr','ua','hy']` rather than conventional `'en'` — bug, not a decision; a French user with a missing key may see Spanish or Chinese before English).
  - **Proposed action**: Promote to `adrs/drafts/i18n-natural-keys.md` (new ADR or section in ADR-CANDIDATE-009). Document the QA implication: testing locale completeness requires an explicit key-coverage report, not a "do non-English locales render?" smoke check.
  - **Severity rationale**: MEDIUM — pattern-shaping; affects translation-completeness validation.

- **ADR-CANDIDATE-012**: Attachment storage backend is selected via `@ConditionalOnProperty` on `attachment.storage` (boot-time wiring); switching modes requires a Platform restart, with `LOCAL` as the implicit default via `matchIfMissing=true`
  - **Category**: promote
  - **Support**: surfaced by 1 sidecar (attachment.yml) — load-bearing config-prefix decision
  - **Surfaced by**:
    - `odd-platform__yaml__application_yml__config-prefix__attachment.md:implicit_adrs.[0]` ("Storage-mode selection is a Spring `@ConditionalOnProperty` switch on `attachment.storage`, not a runtime strategy lookup — beans are wired at boot per the active mode, and switching modes requires a restart.")
    - `odd-platform__yaml__application_yml__config-prefix__attachment.md:implicit_adrs.[1]` ("LOCAL is the implicit default when `attachment.storage` is unset (`matchIfMissing = true` on the LOCAL `@ConditionalOnProperty` annotations). The shipped `application.yml:216` value `LOCAL` is redundant defence-in-depth; an operator who deletes the line still gets LOCAL beans.")
  - **Decision statement**: Storage backend wiring uses Spring's `@ConditionalOnProperty` on `attachment.storage` with `matchIfMissing=true` on the LOCAL beans. The shipped `application.yml` value is redundant defence-in-depth; the absence of the property still produces LOCAL behaviour. Switching between LOCAL and REMOTE is a boot-time decision; runtime strategy lookup is not used.
  - **Wisdom test**: PASS. Deliberate (Spring `@ConditionalOnProperty` choice over runtime strategy); structural (bean-wiring shape).
  - **Evidence**:
    - attachment.md says: "MinioConfig.java:10 + LocalFileUploadServiceImpl.java:26 + LocalFilePathConstructor.java:13 + RemoteFileUploadServiceImpl.java:36 + RemoteFilePathConstructor.java:10"
    - attachment.md says: "application.yml:216" (shipped LOCAL value)
  - **Existing ADR**: none. (LSN-001 captured the operational consequence of the LOCAL default — ephemeral storage on container restart — but the underlying wiring decision has no ADR.)
  - **Co-surfaced gaps** (link from `refactoring-scopes.md`): REFACTOR-025 (LSN-001-canonical: LOCAL default writes to ephemeral `/tmp/odd/attachments`), REFACTOR-026 (LSN-002-canonical: REMOTE on AWS S3 silently restricted to `us-east-1`), REFACTOR-027 (REMOTE bucket pre-existence not validated), REFACTOR-028 (chunk-staging directory operator-invisible).
  - **Proposed action**: Promote to `adrs/drafts/attachment-storage-conditional-wiring.md` (new ADR). Cross-reference LSN-001 (the LOCAL-default-leads-to-data-loss case) as the canonical retrospective justifying the doc-side caveat that goes with the decision.
  - **Severity rationale**: MEDIUM — operational decision class. The pattern propagates to other storage-shaped subsystems; codifying it prevents future "let's add a runtime switch" PRs that would silently break the boot-time-only invariant.

- **ADR-CANDIDATE-013**: REMOTE attachment storage is MinIO-SDK-only (not AWS SDK v2); AWS-specific code paths are absent
  - **Category**: promote
  - **Support**: surfaced by 1 sidecar (attachment.yml) — substantive integration decision
  - **Surfaced by**:
    - `odd-platform__yaml__application_yml__config-prefix__attachment.md:implicit_adrs.[2]` ("REMOTE storage is S3-compatible-only, and specifically targets the MinIO SDK rather than AWS SDK v2 — the `MinioAsyncClient` builder is the only client constructed, and there is no AWS-specific code path.")
  - **Decision statement**: REMOTE storage is implemented exclusively against the MinIO SDK (`MinioAsyncClient`); the codebase does not use AWS SDK v2 even when targeting AWS S3. Operators using AWS S3 are deploying through the MinIO SDK's S3-compatibility surface, not through Amazon's first-party SDK. The decision affects how operators configure region/endpoint (LSN-002 captures the missing `.region(...)` builder call that produced silent `us-east-1` lock-in).
  - **Wisdom test**: PASS. Deliberate (only MinIO SDK constructed, no AWS SDK code paths); structural (integration substrate); LSN-002 retrospective is the canonical case-law for the consequences.
  - **Evidence**:
    - attachment.md says: "MinioConfig.java:3 + MinioConfig.java:20-25 + RemoteFileUploadServiceImpl.java:3-8"
  - **Existing ADR**: none.
  - **Co-surfaced gaps** (link from `refactoring-scopes.md`): REFACTOR-026 (LSN-002-canonical), REFACTOR-029 (HTTP-client timeouts not exposed via YAML — MinioConfig builds with no custom OkHttpClient), REFACTOR-030 (S3 credentials cannot be supplied via IAM instance profile — only Spring `@Value`-injected static keys).
  - **Proposed action**: Promote to `adrs/drafts/remote-storage-minio-sdk.md` (new ADR). Cross-reference LSN-002 explicitly — the decision to use MinIO SDK over AWS SDK v2 is what makes the `.region(...)` configuration manual; an ADR documenting this avoids future "let's switch to AWS SDK v2" surprises.
  - **Severity rationale**: MEDIUM — integration-substrate decision; affects operator's regional-configuration UX.

- **ADR-CANDIDATE-014**: AlertManager Webhook Receiver is hand-coded (NOT OpenAPI-generated) — explicit `// TODO: define OpenAPI spec based on alert provider contract`; the request DTO is an inner static class
  - **Category**: unique-load-bearing
  - **Support**: surfaced by 1 sidecar (AlertManagerController) — explicit counter-example to ADR-CANDIDATE-001; the rule and its acknowledged exception
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__AlertManagerController.md:implicit_adrs.[0]` ("External alert ingestion is not driven by `odd-platform-api-contract` (OpenAPI). The controller is hand-coded with an explicit `// TODO: define OpenAPI spec based on alert provider contract` (AlertManagerController.java:20), and the request DTO is an inner static class on the controller rather than a generated `*Api` model.")
  - **Decision statement**: `AlertManagerController` is the canonical exception to the OpenAPI-generated-controller convention (ADR-CANDIDATE-001). The endpoint is hand-coded with an explicit TODO acknowledging the gap; the request DTO is an inner static class. The implicit decision: when the inbound contract is owned by an external provider (Prometheus AlertManager) whose schema we don't author, we accept the hand-coded controller until the provider's contract stabilises into a spec we can incorporate.
  - **Wisdom test**: PASS. Deliberate (TODO comment captures the rationale); structural (boundary-defining for "when is hand-coded acceptable?"); single-sidecar but pairs with ADR-CANDIDATE-001 as rule + exception.
  - **Evidence**:
    - AlertManagerController.md says: "AlertManagerController.java:15-32 (no `implements *Api`, inner `AlertManagerRequest` class, explicit TODO comment)"
  - **Existing ADR**: none. (Composes with ADR-CANDIDATE-001 — the rule and its acknowledged exception go together.)
  - **Co-surfaced gaps** (link from `refactoring-scopes.md`): REFACTOR-031 (hand-rolled DTO drops AlertManager fields that the platform may later want to honour, e.g. `status`, `endsAt`, `annotations`, `fingerprint`, `groupKey`), REFACTOR-032 (`ExternalAlert.startsAt` is timezone-naive `LocalDateTime`).
  - **Proposed action**: Promote (or fold into ADR-CANDIDATE-001 as the "Known exception" section). The decision shapes how future external-receiver endpoints are introduced — hand-coded is acceptable only when we don't own the contract.
  - **Severity rationale**: MEDIUM — pattern-shaping; defines how the rule (#001) is applied at its boundary.

### LOW severity

- **ADR-CANDIDATE-015**: Owner-scoped reads are exposed as separate first-class endpoints (`/my`, `/my/upstream`, `/my/downstream`); principal resolution flows through reactor `Context`, not through controller-method signatures
  - **Category**: promote
  - **Support**: surfaced by 2 sidecars (DataEntityController + dataEntity tag)
  - **Surfaced by**:
    - `odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__DataEntityController.md:implicit_adrs.[2]` ("Owner-scoped reads (`/my`, `/my/downstream`, `/my/upstream`) take NO principal parameter — the controller delegates to `dataEntityService.listAssociated(page, size [, kind])` and trusts the service to resolve the current user via reactor `Context` propagation. The implicit ADR: principal resolution is a reactor-context concern, not a controller-method-signature concern.")
    - `odd-platform__openapi__tags__openapi-tag__dataEntity.md:implicit_adrs.[3]` ("Data Entity controllers expose owner-scoped operations (`/my`, `/my/upstream`, `/my/downstream`) as separate endpoints rather than as a query-parameter overlay on the cross-tenant list.")
  - **Decision statement**: Owner-scoped data-entity reads are dedicated routes (`/my*`) rather than overlay query parameters (`?owner=me`). Principal resolution happens via reactor `Context` propagation inside the service layer; controllers do not accept `Authentication`/`Principal`/owner-id parameters. The shape commits the platform to "my objects" as a navigation surface, not a filter.
  - **Wisdom test**: PASS. Deliberate (URL design + reactor-Context Spring convention); structural (route shape + method signatures); affects every owner-scoped operation in the codebase.
  - **Evidence**:
    - DataEntityController.md says: "DataEntityController.java:284-305 (three `getMyObjects*` methods, none accept `Authentication`/`Principal`/owner-id)"
  - **Existing ADR**: none.
  - **Proposed action**: Promote to `adrs/drafts/owner-scoped-routes.md` (new ADR). Codifies BOTH the URL-shape choice (`/my*` as endpoints) AND the principal-handling convention (reactor `Context`, not method signatures).
  - **Severity rationale**: LOW — convention decision; affects URL-design and code-review uniformity, not security or data integrity.

- **ADR-CANDIDATE-016**: `attachment.max-file-size` cap is read once and exposed to the UI client via `getUploadOptions`; the chunked upload pipeline does not re-validate against it server-side
  - **Category**: promote (with split — see "Note on split")
  - **Note on split**: The previous run's ADR-CANDIDATE-023 mixed the deliberate "expose cap as UI hint" pattern with the un-defended absence of server-side enforcement. The wisdom test splits these: the read-once-and-expose pattern is the deliberate ADR (architecturally meaningful: the cap is a UX concern, not a contract concern); the absence of server-side enforcement is a gap (no rationale defends it; adding it is refactoring within `AttachmentServiceImpl.uploadFileChunk`/`completeFileUpload`). The gap moves to `refactoring-scopes.md` as REFACTOR-013 / REFACTOR-035.
  - **Support**: surfaced by 3 sidecars (`AttachmentServiceImpl` config-key-consumer, `attachment.yml` config-prefix, plus `DataEntityAttachmentController` consumer chain)
  - **Surfaced by**:
    - `odd-platform__java__AttachmentServiceImpl__config-key-consumer__attachment_max-file-size@L27.md:implicit_adrs.[0]` ("The cap is exposed as `bytes` over the wire (MB × 1_000_000), so the contract type `DataEntityUploadOptions.maxSize` is implicitly bytes-with-decimal-MB-conversion rather than megabytes.")
    - `odd-platform__yaml__application_yml__config-prefix__attachment.md:implicit_adrs.[4]` ("Per-file size enforcement is delegated downstream — the YAML `max-file-size` cap is consumed exclusively by `AttachmentServiceImpl.getUploadOptions()` to populate a UI hint.")
  - **Decision statement**: The `attachment.max-file-size` config key (in MB) is read once by `AttachmentServiceImpl.getUploadOptions()` and exposed to the UI as a `DataEntityUploadOptions.maxSize` value (in bytes, after × 1_000_000 conversion using decimal MB, not binary MiB). The UI uses the value to size-filter file inputs; the server does not re-validate (gap → REFACTOR-013).
  - **Wisdom test**: BORDERLINE PASS for the read-once-expose pattern (the conversion choice MB×1_000_000 vs MiB×1_048_576 is a deliberate wire-format pick; the read-once posture trades runtime hot-reload for boot-time cache); FAIL for the absence of server-side enforcement (no rationale defends it).
  - **Evidence**:
    - AttachmentServiceImpl.md says: "AttachmentServiceImpl.java:61 (`maxFileSize * 1_000_000`)"
    - attachment.md says: "AttachmentServiceImpl.java:27-89 (the only consumer is getUploadOptions; no service-layer or controller-layer guard re-validates against it)"
  - **Existing ADR**: none.
  - **Co-surfaced gaps** (link from `refactoring-scopes.md`): REFACTOR-013 (server-side enforcement bypass — non-browser client can submit chunks beyond the cap), REFACTOR-035 (no per-tenant / per-user / total-upload quota), REFACTOR-036 (boot-time crash if `attachment.max-file-size` is unset — primitive-default leak: `@Value(...)` has no `:default` fallback).
  - **Proposed action**: Promote (or fold into ADR-CANDIDATE-012 as a section "max-file-size as UX hint"). The pattern is small but the wire-format decimal-MB choice and the server-doesn't-re-validate posture together are architectural — codifying them prevents future PRs that "tighten the cap" without touching the bypass.
  - **Severity rationale**: LOW — the architectural value is bounded; the security implications are real but live in `refactoring-scopes.md` as REFACTOR-013.

## Patterns surfaced from concepts.yaml

The concept-merger reducer (slice 6) aggregated per-file security and performance signals at concept level. The aggregates do not surface NEW ADR candidates beyond the 16 above — they corroborate the candidates' evidence (e.g., `Data Entity` security_aggregate confirms the SECURITY_RULES `/term` vs `/terms` drift case as evidence for ADR-CANDIDATE-002's path-string-coupling trade-off; `GenAI Assistant` security_aggregate confirms the seven `weaknesses` that flow into REFACTOR-001..007).

The aggregates' `weaknesses` lists are predominantly gap-shaped findings; they cross-reference into `refactoring-scopes.md` rather than this artefact. See `refactoring-scopes.md` "Cross-references with concepts.yaml" for the explicit mapping.

## Drift findings (existing ADR vs current code)

None. The existing ADR drafts (`code-lineage-substrate`, `agentic-code-ontology`, `refactor-to-pillar-architecture`) and the accepted ADR (`summary-top-level-restructure`) are workspace-meta or doc-IA-shaped; they do not legislate odd-platform code-level patterns. Therefore no candidate above contradicts an existing written record. The 16 candidates are net-new additions.

The following adjacency-tensions exist within the candidate set itself (and are surfaced for triage, not as drifts):

- ADR-CANDIDATE-008 (URL-prefix-shaped tags → resource-shaped Java interfaces) creates the "mega-tag" tension that dataEntity.md surfaces — `dataEntity` carries 40 operations across CRUD/relationships/lineage/alerts/activity/messaging. The candidate captures both the rule and the tension; a future redesign that splits `DataEntityApi` into per-feature interfaces would amend this ADR.
- ADR-CANDIDATE-001 (controllers are OpenAPI-generated delegates) and ADR-CANDIDATE-014 (AlertManagerController is hand-coded) are paired — the rule and its acknowledged exception. Triaging them together preserves the relationship.
- ADR-CANDIDATE-002 (centralised SECURITY_RULES) and ADR-CANDIDATE-003 (read-collaborative GET-uniformly-authenticated, borderline) compose — the second is the read-side corollary of the first's mutation-only matrix.
- ADR-CANDIDATE-004 (GenAI disabled-by-default) and ADR-CANDIDATE-005 (GenAI thin-proxy stance) form the GenAI feature posture. Triaging together as one ADR ("GenAI deployment architecture") may be cleaner than two separate drafts. The GenAI co-surfaced gaps (REFACTOR-001..007) are NOT defended by either ADR; the maintainer should decide whether to address them in a separate "GenAI hardening sprint" backlog.
- ADR-CANDIDATE-009, -010, -011 form the i18n implementation posture — eager bootstrap + client-only persistence + natural-keys.
- ADR-CANDIDATE-012, -013 form the attachment storage posture — boot-time wiring + MinIO-SDK-only. LSN-001 and LSN-002 are the canonical retrospectives; the operator-owned-bucket constraint is in `refactoring-scopes.md` as REFACTOR-027 (no retroactive ADR rationale).

The maintainer at triage time decides whether to ship one ADR per candidate (most explicit, most cross-linkable) or one ADR per feature posture (3 clusters at lower granularity).

## Reclassification trace (slice-8 fix)

The first run (prompt-version 0.1.0) emitted 23 candidates without the wisdom test. On re-classification, the following candidates were **moved out** of `implicit-adrs.md` per Rule 0. The old IDs map to new homes:

| Old ID (0.1.0) | Old title | Wisdom-test outcome | New home |
|---|---|---|---|
| ADR-CANDIDATE-005 | "GenAI requests are not authenticated and not retried" | FAIL — absence has no stated rationale; adding outbound auth is refactoring within existing WebClient | REFACTOR-001 (auth) + REFACTOR-002 (retry) in `refactoring-scopes.md` |
| ADR-CANDIDATE-007 (split) | "GenAI feature is a THIN PROXY by design — no prompt construction, no sanitization, no RAG, no caching, no rate-limiting, no per-user accounting" | SPLIT — proxy stance PASSES (kept as ADR-CANDIDATE-005 in this run); the absent features that the stance does NOT defend (rate-limit, sanitisation, audit log, per-user accounting) FAIL | ADR-CANDIDATE-005 keeps the stance; REFACTOR-003 (rate-limit), REFACTOR-004 (sanitisation), REFACTOR-007 (audit log) capture the gaps |
| ADR-CANDIDATE-017 (0.1.0) | "`attachment.remote.bucket` must pre-exist" | FAIL — absence of `bucketExists`/`makeBucket` has no stated rationale; deferred-failure pattern is a gap, not a posture | REFACTOR-027 in `refactoring-scopes.md` |
| ADR-CANDIDATE-021 (0.1.0) | "Lineage navigation is client-driven by `lineageDepth` + `expandedEntityIds`; no contract-level cap" | FAIL — absence of cap has no stated rationale; "trust the UI" is not a defensible architectural stance for a public API | REFACTOR-044 in `refactoring-scopes.md` |
| ADR-CANDIDATE-022 (0.1.0) | "Pagination parameters (`PageParam`, `SizeParam`) are int32 with no min/max/default" | FAIL — same as above; "service-layer defends" is descriptive of a gap, not a deliberate posture | REFACTOR-020 in `refactoring-scopes.md` |
| ADR-CANDIDATE-023 (0.1.0) (split) | "Per-file size cap (`attachment.max-file-size`) is a UX hint, not a security/integrity boundary; enforcement is delegated to the UI client" | SPLIT — "read-once-and-expose" pattern PASSES (kept as ADR-CANDIDATE-016); "no server-side re-validation" FAILS | ADR-CANDIDATE-016 keeps the read-once-expose pattern; REFACTOR-013 captures the server-side enforcement bypass |

Net result: previous run 23 candidates → this run 16 ADR candidates + 7 reclassifications captured as 30+ refactoring scopes (some reclassifications produced multiple scope entries because the original "ADR" wrapped multiple distinct gaps).

## Maintainer notes

(Free-form section preserved across refreshes. Empty on first run.)

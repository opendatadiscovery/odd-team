---
node_id: "odd-platform java AlertManagerController controller-method:postAlerts"
node_kind: controller-method
axis: controllers
extracted_at_commit: 9ac6436e
enriched_at_commit: 9ac6436e
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-AlertManagerController-postAlerts
related_features: [F-007]
related_pillar_features: ["P-07:F-001"]
related_refactors: [REFACTOR-024, REFACTOR-073]
related_retrospectives: [LSN-017, LSN-018]
related_concepts: [Alert, Ingestion (External Webhook)]
neighbour_sidecars:
  - odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__AlertManagerController.md
  - odd-platform__java__service__service__AlertServiceImpl.md
  - odd-platform__java__repository_reactive__repository__ReactiveAlertRepositoryImpl.md
---

# AlertManagerController#alertManagerWebhook (alias `postAlerts`) — semantic understanding

## understanding

`alertManagerWebhook` is the single 4-line WebFlux handler for `POST /ingestion/alert/alertmanager` — the platform's Prometheus AlertManager receiver. It deserialises the request body as an inner `AlertManagerRequest` DTO (a static class on the controller, not OpenAPI-contract-generated), unwraps the embedded `List<ExternalAlert>`, delegates to `AlertService.handleExternalAlerts(req.getAlerts())`, and unconditionally returns `204 No Content` on success (AlertManagerController.java:21-26). The method itself performs zero validation: no authentication check (the path sits inside `SecurityConstants.WHITELIST_PATHS[2] = "/ingestion/**"` and the only ingestion filter `IngestionDataEntitiesFilter` is path-scoped to `/ingestion/entities` POST only), no allowlist of caller identity, no schema-level constraint on `entity_oddrn`, no idempotency key handling, no per-request audit log, no rate limit. The pillar-anchored feature this method opens (`P-07:F-001 AlertManager Integration`, F-007) carries three load-bearing drift facets — `unauthenticated_payload_trust`, `cross_tenant_alert_creation`, `no_idempotency_no_audit` — all three are confirmed PRIMARY-SOURCE at this method tier per the citations in `security.known_security_gaps` and `bugs_limitations_corner_cases` below.

> **Note on the node label.** The orchestrator-supplied node label is `controller-method:postAlerts`; the actual method symbol in source is `alertManagerWebhook` (AlertManagerController.java:22). The class declares no `*Api` interface, so there is no OpenAPI `operationId` such as `postAlerts` to anchor that name (see implicit_adrs[0] — `no_openapi_contract`). The node label is the only method on this controller; the alias is used for substrate-side ID stability. This sidecar describes that single method end-to-end.

## concepts

- entities: [`AlertManagerRequest` (inner static DTO, AlertManagerController.java:28-32), `ExternalAlert` (per-element payload, ExternalAlert.java:11-15), `Mono<ResponseEntity<Void>>` (reactive response shape)]
- operations: [
    "deserialise AlertManager-shaped JSON body to AlertManagerRequest (Jackson-driven, no `@Valid`)",
    "unwrap req.getAlerts() — List<ExternalAlert>",
    "delegate to AlertService.handleExternalAlerts(...)",
    "map any downstream signal to ResponseEntity.noContent() — 204 unconditionally on success"
  ]
- invariants:
  - "Endpoint is path-mounted at literal `ingestion/alert/alertmanager` (note: NO leading slash on `@PostMapping(path = ...)` — Spring still resolves to `/ingestion/alert/alertmanager` because the path is relative to the application context root which is `/`, and the path resolver normalises) — verified at AlertManagerController.java:21."
  - "Success response is always 204 No Content — the `.map(o -> ResponseEntity.noContent().build())` step (line 25) discards the inner signal entirely, so callers cannot distinguish how many alerts were accepted, how many were orphaned (no entity_oddrn), or how many duplicated an existing OPEN alert."
  - "There is no `@PreAuthorize`, no `@Secured`, no `@ConditionalOnProperty`, no `@RolesAllowed`, no programmatic auth check inside the method — auth is delegated entirely to the WHITELIST_PATHS configuration in SecurityConstants.java:96 (which exempts `/ingestion/**` from the UI auth chain) AND to the absence of any IngestionDataEntitiesFilter-equivalent path matcher on this sub-path (IngestionDataEntitiesFilter.java:28 binds only to `/ingestion/entities` POST)."
  - "The DTO contract is hand-rolled — `AlertManagerRequest` (lines 28-32) is an inner static class with one field (`List<ExternalAlert> alerts`), and the explicit comment `// TODO: define OpenAPI spec based on alert provider contract` (line 20) marks this as an unfinished spec-first migration."
  - "The method is the SOLE method on the controller — there is no `getAllAlerts`-equivalent peer in this class, no `bulkPostAlerts`, no `healthCheck`; AlertManagerController is single-purpose (AlertManagerController.java:15-32)."
- audiences:
  - "prometheus-alertmanager (the canonical caller — `route.receivers[].webhook_configs[].url` in AlertManager rule files targets this endpoint)"
  - "platform-operator (configures AlertManager-side `entity_oddrn` label, deploys network perimeter controls)"
  - "any-network-reachable-actor (under all auth modes — DISABLED/LOGIN_FORM/OAUTH2/LDAP — the path bypasses the UI auth chain; the receiver accepts any AlertManager-shaped payload from any caller with network reach)"

## dependencies_semantic

- requires-feature:
  - "AlertService (singleton field at line 18, injected via @RequiredArgsConstructor at line 16) — specifically the `handleExternalAlerts(List<ExternalAlert>)` method at AlertServiceImpl.java:151-191 (the @ReactiveTransactional boundary)."
  - "The internal alert lifecycle: AlertServiceImpl.createAlerts (line 261-300) → ReactiveAlertRepositoryImpl.createAlerts (the partitioned INSERT … RETURNING path)."
  - "DISTRIBUTION_ANOMALY alert type — the only type produced by this path (AlertTypeEnum.DISTRIBUTION_ANOMALY at AlertServiceImpl.java:177)."
- requires-config:
  - "[]" — N/A. The method reads zero config keys. There is no `@Value`, no `@ConfigurationProperties` field injected, no `@ConditionalOnProperty` gating the @PostMapping. The endpoint is hard-wired and active in every deployment that runs `odd-platform-api`. There is no `auth.ingestion.alertmanager.enabled` flag, no `notifications.alertmanager.*` namespace governing the receiver, no allowlist property.
- requires-runtime:
  - "Spring WebFlux reactive stack — `@RequestBody final Mono<AlertManagerRequest>` and `Mono<ResponseEntity<Void>>` return (AlertManagerController.java:22, 13)."
  - "Jackson default ObjectMapper configuration for deserialising `ExternalAlert.startsAt` (`LocalDateTime`, ExternalAlert.java:14) — Jackson's java-time module is on the classpath via spring-boot-starter-webflux; deserialising RFC3339 with timezone into LocalDateTime strips the offset silently (cross-ref bugs_limitations_corner_cases.[3])."
  - "AlertServiceImpl.handleExternalAlerts is annotated `@ReactiveTransactional` at line 152 — a successful webhook produces an atomic per-batch transaction; partial failures roll back the whole batch."
  - "WHITELIST_PATHS in SecurityConstants.java:96 — `\"/ingestion/**\"` is the second-to-last entry; the AuthorizationCustomizer reads this list and exempts these paths from the UI authentication chain."
- couples-to:
  - "AlertService interface (singleton dependency) — AlertServiceImpl.handleExternalAlerts is the actual binding."
  - "ExternalAlert DTO (dto/alert/ExternalAlert.java) — three fields: `labels: Map<String, String>`, `generatorURL: URI`, `startsAt: LocalDateTime`. The DTO is silently lossy w.r.t. the AlertManager wire format (no `status`, `endsAt`, `annotations`, `fingerprint`, `groupKey` fields)."
  - "AlertManagerRequest inner DTO — defined on this controller, NOT shared with any other code path; if the OpenAPI-contract migration ever happens (per the TODO), this inner class deletes."

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - "Smoke test — `WebTestClient.post().uri('/ingestion/alert/alertmanager').bodyValue({...}).exchange().expectStatus().isNoContent()`. No such test exists."
  - "Anonymous POST under `auth.type=DISABLED` — verifies the F-007 facet headline: unauthenticated, accepts payload, creates row in alert table, surfaces on `GET /api/alerts`."
  - "Authenticated POST under LOGIN_FORM/OAUTH2/LDAP — verifies the path bypasses any UI permission check (no ALERT_CREATE permission key exists in `PolicyPermissionDto`; no SecurityRule entry covers `/ingestion/alert/alertmanager`)."
  - "Cross-tenant attribution — POST with `labels.entity_oddrn` pointing at a data entity owned by a different tenant; assert the alert is created AND visible on the target entity's page to any authenticated user."
  - "Idempotency — POST the same body twice; assert two distinct alert rows result (the missing-idempotency surface, cross-ref bugs_limitations_corner_cases.[2]; the asymmetric handling vs AlertActionResolver path proven at AlertServiceImpl.java:222-227 vs 152-191)."
  - "Orphan alert — POST without `labels.entity_oddrn`; assert 204 returned AND alert row created with `data_entity_oddrn = NULL`."
  - "Schema drift — POST with `status: \"resolved\"`, `endsAt: ...`, `annotations: {...}` fields; assert the controller silently drops them (the AlertManagerRequest+ExternalAlert DTOs do not declare these fields)."
  - "Timezone drift — POST with `startsAt: \"2026-05-20T10:23:45.123Z\"` (RFC3339 with offset); assert the offset is silently stripped (LocalDateTime deserialiser default behaviour)."
  - "Generator URL XSS — POST with `generatorURL: \"javascript:alert(1)\"`; assert the URL is sanitised/escaped on the UI render path (cross-ref bugs_limitations_corner_cases.[4])."
  - "Large batch — POST a payload with N=1000+ alerts; assert the @ReactiveTransactional boundary handles it (createAlerts paginates internally via executeInPartitionReturning, but no test pins the boundary)."
- test_files: []
- gaps: |
    Zero Java tests cover this method, its inner DTO, or AlertServiceImpl.handleExternalAlerts.
    A regression most likely lands in (1) the `/ingestion/**` whitelist drift (someone moves
    the whitelist into a feature flag and the endpoint stops accepting any POST), (2) the
    `LocalDateTime` deserialisation default changing across a Java/Jackson upgrade (the
    entire webhook stops accepting RFC3339-timestamp payloads), (3) the hard-coded
    DISTRIBUTION_ANOMALY type — if the platform later honours AlertManager `alertname`
    to pick alert types, the absence of tests on the current behaviour means the
    migration has no safety net, (4) the inner DTO going to OpenAPI-contract (per the
    TODO) — any rename of `alerts` to a contract-generated `payload` field would not be
    caught at build time.

    A single `@WebFluxTest(AlertManagerController.class)` + `WebTestClient` test
    asserting 204 on a valid payload would be the smallest meaningful regression pin.

    Test resource present (not a behaviour test): `odd-platform-api/src/test/resources/prometheus/prometheus.yml` — a sample Prometheus configuration document, not a test class.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform"
    anchor: "#prometheus-alertmanager-integration"
    rationale: "Live page contains a 'Prometheus AlertManager Integration' section documenting this exact endpoint, the `entity_oddrn` label requirement, the DISTRIBUTION_ANOMALY routing, and the unauthenticated-by-design posture. No `@docs` annotation in source — link inferred from path-and-content alignment; refreshed live this session 2026-05-20."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Auth-posture (verbatim, refresh 2026-05-20): "The AlertManager webhook endpoint is not authenticated. ODD Platform whitelists the entire `/ingestion/**` namespace in Spring Security, and the ingestion auth filter controlled by `auth.ingestion.filter.enabled` only guards `/ingestion/entities` (POST) — it does not cover `/ingestion/alert/alertmanager`."

      Network-controls statement (verbatim): "Anyone with network reach to the platform can POST arbitrary AlertManager-shaped payloads and create alerts on any data entity."

      entity_oddrn requirement (verbatim): "The `entity_oddrn` label is required for the alert to route to a data entity. ODD Platform reads `alerts[].labels[\"entity_oddrn\"]` to determine which data entity the alert belongs to."

      Orphan behaviour (verbatim): "[An alert submitted without this label] will not appear on any entity's page, and is effectively orphaned."

      Routing claim (verbatim): "Each inbound alert becomes a Distribution Anomaly alert on the referenced data entity, visible in the Alerts section and on the entity's page."
  - url: "https://docs.opendatadiscovery.org/features/active-platform-features/alerting"
    anchor: ""
    rationale: "Active-platform-features Alerting page now exists (refreshed 2026-05-20 — was 404 in 2026-05-08 enrichment; the supersede is captured in coherence_correction_note below). Page cross-links to the AlertManager endpoint and documents the Distribution Anomaly halt-toggle limitation."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Webhook URL cross-link (verbatim): "optionally from an external Prometheus AlertManager via the `POST /ingestion/alert/alertmanager` inbound webhook"

      External-injection framing (verbatim): "an externally-injected distribution anomaly — the platform raises an alert"

      Halt-toggle limitation (verbatim, the doc-side acknowledgment of an asymmetry): "the Distribution Anomaly halt toggle doesn't enforce suppression on AlertManager-driven alerts, recommending operators use Prometheus Alertmanager configuration layers instead to manage alert noise"
- doc_drift_findings:
  - "The doc page documents the unauthenticated posture verbatim ('Anyone with network reach to the platform can POST arbitrary AlertManager-shaped payloads and create alerts on any data entity'). The doc does NOT explicitly document that the cross-tenant attribution surface (the `entity_oddrn` label is treated as untrusted-input-to-authoritative-state) compounds with the cross-owner read at `GET /api/alerts` (REFACTOR-024) to produce a full forge-and-display cycle. This compound surface is the F-007 + REFACTOR-024 interaction; the doc surfaces each half independently but not the compound. Severity: MEDIUM — operator-relevant; would be ideal to document. Not a contradiction with the code; a gap in cross-feature documentation, route to doc-gap-finder."
  - "The doc states the webhook 'is not authenticated' for the /ingestion/alert/alertmanager path. Code verification confirms this verbatim — but the doc does not name the asymmetry with the /api/* surface (under non-DISABLED auth modes, the rest of `/api/*` enforces `pathMatchers('/**').authenticated()` per AuthorizationCustomizer — but `/ingestion/**` exempts via WHITELIST_PATHS). An operator reading just the AlertManager section may not realise that the receiver behaves differently from the rest of the API surface. Severity: LOW — the broader configuration-and-deployment/enable-security page does document the WHITELIST_PATHS scope; route to doc-gap-finder if the maintainer wants a cross-link from the AlertManager section back to enable-security."

### Coherence sweep (LSN-018)

Pre-emit cross-registry sweep ran against existing artefacts for terms: `AlertManagerController`, `alertManagerWebhook`, `postAlerts`, `handleExternalAlerts`, `/ingestion/alert/alertmanager`, `entity_oddrn`, `AlertManagerRequest`, `ExternalAlert`.

**Strengthens (existing claims, now PRIMARY-SOURCE at method tier):**

- F-007 / `P-07:F-001 AlertManager Integration` (lineage/odd-platform/feature-flows/detail/F-007.yaml): All three drift facets named in `drift_class_summary` — `unauthenticated_payload_trust`, `cross_tenant_alert_creation`, `no_idempotency_no_audit` — are confirmed at this method-tier per security.known_security_gaps[0..3] and bugs_limitations_corner_cases[0..5]. F-007's `chain[1]` already cites AlertServiceImpl.java:152, 178; this sidecar adds the controller-method-tier evidence verifying the upstream lack-of-gate.
- F-007 facet `forge + display compound with REFACTOR-024` (the cross-feature compound surface): re-confirmed; the controller-method emits 204 unconditionally with no caller-identity check, no entity ownership check, no `data_entity_oddrn` existence check.
- F-007 facet `no idempotency on retry — Prometheus webhook retries duplicate alerts`: the controller method emits 204 unconditionally; no idempotency key in the request shape; no Idempotency-Key HTTP header inspection.
- F-007 facet `generator URL embedded in chunk description — UI-render-side surface`: the controller passes `getAlerts()` verbatim into AlertServiceImpl, where line 168 of AlertServiceImpl constructs the URL via `UriComponentsBuilder.fromUri(externalAlert.getGeneratorURL())` — no validation at the controller boundary.

**Supersedes (existing claims, with clearer evidence in this session's WebFetch):**

- The prior class-level sidecar (odd-platform__java__org_opendatadiscovery_oddplatform_controller__controller__AlertManagerController.md, batch from 2026-05-08) recorded `doc_drift_findings.[0]` as "The Alerting feature page at `https://docs.opendatadiscovery.org/active-platform-features/alerting` returns 404". As of 2026-05-20 the page **exists** (status 200, refreshed this session — see inferred_docs[1].fetched_excerpts). The prior 404 finding is superseded by this session's 200 verification. The page now provides a cross-link back to this endpoint, so the doc-side coverage has improved. The prior sidecar's finding should be flagged as `superseded_by: this-sidecar-2026-05-20`.

**Conflicts (no contradictions surfaced):**

- No registry artefact disagrees with any claim in this sidecar. F-007's facets, REFACTOR-024's cross-owner read posture, and the alerting feature page text are mutually consistent. Forcing-question per LSN-018 ran against the seven cross-registry terms above: every match (F-007.yaml, AlertController#getAllAlerts.md, AlertServiceImpl.md, ReactiveAlertRepositoryImpl.md) STRENGTHENS this sidecar's claims; none contradict.

## implicit_adrs

- "The AlertManager receiver is not implemented via the OpenAPI-contract path. The `// TODO: define OpenAPI spec based on alert provider contract` comment at AlertManagerController.java:20 is the explicit intent_anchor — every other inbound HTTP method in `org.opendatadiscovery.oddplatform.controller.*` implements an `*Api` interface generated from `odd-platform-api-contract` (e.g. AlertController implements AlertApi); this method does not, and the inner static `AlertManagerRequest` DTO is the deliberate alternative. The decision is not 'we don't have a contract for this' — the TODO names the contract as pending; the decision IS 'we ship the receiver without the contract for now, because the AlertManager wire format is operator-driven and the platform absorbs whatever shape arrives'." — evidence: AlertManagerController.java:15 (no `implements *Api` clause) + AlertManagerController.java:20 (the TODO comment) + AlertManagerController.java:28-32 (the inner static DTO) — intent_anchor: "// TODO: define OpenAPI spec based on alert provider contract" — confidence: HIGH
- "Authentication for the AlertManager receiver is delegated to operator-side network controls (reverse proxy / mTLS / NetworkPolicy) rather than handled in-platform. The endpoint is in the `/ingestion/**` whitelist (SecurityConstants.java:96), and unlike `/ingestion/entities` (which is covered by IngestionDataEntitiesFilter when `auth.ingestion.filter.enabled=true`), there is no shared-secret or token mechanism for this path. The decision is recorded in the live doc page verbatim ('Apply perimeter controls (network segmentation, authenticating reverse proxy, mTLS) for any deployment where these endpoints are reachable from outside the trusted network')." — evidence: SecurityConstants.java:96 (`/ingestion/**` whitelist) + IngestionDataEntitiesFilter.java:28 (the filter's matcher is `/ingestion/entities` POST only — confirms NO sibling filter covers /alert/alertmanager) + WebFetch live doc 2026-05-20 (the doc-side acknowledgment) — intent_anchor: "The AlertManager webhook endpoint is not authenticated. ODD Platform whitelists the entire `/ingestion/**` namespace in Spring Security…" (live doc, 2026-05-20) — confidence: HIGH
- "Success response is unconditionally 204 No Content — the controller does not signal which alerts were accepted (entity_oddrn resolved), which were orphaned (no entity_oddrn), or which duplicated an existing OPEN alert. The decision is implicit: it makes the receiver fully asynchronous-fire-and-forget from AlertManager's perspective (AlertManager only acts on HTTP 2xx vs 5xx for retry decisions), and so any per-alert outcome detail would create surface area for AlertManager-side logic the platform would need to support." — evidence: AlertManagerController.java:25 (`.map(o -> ResponseEntity.noContent().build())` — unconditional 204, discards the inner Mono's value) — intent_anchor: "ResponseEntity.noContent().build()" — confidence: MEDIUM (the decision is structural but no comment defends it; the rationale here is the canonical-Prometheus-AlertManager-receiver-contract inference)

## bugs_limitations_corner_cases

- "Unauthenticated payload trust (F-007 facet `unauthenticated_payload_trust`): the method accepts any AlertManager-shaped POST without an authenticity check. There is no `@PreAuthorize`, no header inspection, no token validation. Combined with the `/ingestion/**` whitelist (SecurityConstants.java:96), the endpoint is reachable anonymously under `auth.type=DISABLED` and reachable by any authenticated user (no permission gate) under LOGIN_FORM/OAUTH2/LDAP. Operators relying on the WHITELIST_PATHS to limit exposure may not realise that the IngestionDataEntitiesFilter does NOT cover this path (the filter binds only to `/ingestion/entities` POST, IngestionDataEntitiesFilter.java:28)." — evidence: AlertManagerController.java:21-26 + SecurityConstants.java:96 + IngestionDataEntitiesFilter.java:28 — severity: HIGH
- "Cross-tenant alert creation (F-007 facet `cross_tenant_alert_creation`): the method delegates `req.getAlerts()` verbatim to AlertService.handleExternalAlerts. Downstream at AlertServiceImpl.java:178 the `entity_oddrn` label is mapped directly to `AlertPojo.dataEntityOddrn` with no check that (a) the entity_oddrn refers to an existing DataEntity row, (b) the calling principal (if any) is authorised to alert on it. A POST with `labels.entity_oddrn=<any-data-entity-oddrn>` produces an OPEN alert attributed to that data entity, visible on the target entity's page to all authenticated users. Compounded with REFACTOR-024 (cross-owner GET /api/alerts) — every authenticated user sees forged alerts on the platform-wide All tab." — evidence: AlertManagerController.java:24 (`flatMap(req -> alertService.handleExternalAlerts(req.getAlerts()))` — no validation step between) + AlertServiceImpl.java:178 (`.setDataEntityOddrn(externalAlert.getLabels().get(\"entity_oddrn\"))` — no validation, no caller-identity binding) — severity: HIGH
- "No idempotency, no audit (F-007 facet `no_idempotency_no_audit`): the method does not inspect any `Idempotency-Key` header, the request DTO has no idempotency-key field, and the downstream AlertServiceImpl.handleExternalAlerts (lines 153-191) does NOT route through AlertActionResolver (which is used by the in-platform ingestion path at AlertServiceImpl.java:222-227 to deduplicate via AlertUniqueConstraint snapshots). createAlerts (line 261-300) issues INSERT … RETURNING via the partitioned executor; if Prometheus retries the same webhook (transient network error), the receiver will produce duplicate alert rows. There is no method-level audit log: no `log.info(...)` at entry, no `@Timed` Micrometer counter, no per-call correlation-id capture. From the operator's perspective the only post-hoc signal that a webhook arrived is the alert table rows themselves." — evidence: AlertManagerController.java:21-26 (no audit log, no idempotency inspection) + AlertServiceImpl.java:151-191 (handleExternalAlerts skips AlertActionResolver — cross-ref F-007 facet `AlertActionResolver asymmetry`) + AlertServiceImpl.java:222-227 (the parallel applyAlertActions path that DOES de-duplicate) — severity: HIGH
- "Silent loss of timestamp offset: ExternalAlert.startsAt is `LocalDateTime` (ExternalAlert.java:14), Jackson's default LocalDateTime deserialiser strips RFC3339 timezone offsets silently. AlertServiceImpl.java:67-68 declares the formatter as `yyyy-MM-dd HH:mm:ss` (no timezone). The URL embedded in the chunk description (AlertServiceImpl.java:168-172) uses this naive timestamp for Prometheus query params (`g0.moment_input`, `g0.end_input`). Operators clicking the linked URL land in a Prometheus query window keyed by the ODD server's local time, not the alert's actual timestamp." — evidence: ExternalAlert.java:14 + AlertServiceImpl.java:67-68, 168-172 — severity: MEDIUM
- "DTO silently drops AlertManager wire fields: `AlertManagerRequest` (AlertManagerController.java:28-32) carries one field (`List<ExternalAlert> alerts`), and `ExternalAlert` (ExternalAlert.java:9-15) carries three fields (`labels`, `generatorURL`, `startsAt`). The AlertManager v2 webhook wire format includes `status` (firing | resolved), `endsAt`, `annotations`, `fingerprint`, `groupKey`, `groupLabels`, `commonLabels`, `commonAnnotations`, `externalURL`, `version`, `receiver`. All are silently dropped by Jackson on deserialisation. The most operationally-impactful drop is `status: resolved` — the doc-side cross-link from active-platform-features/alerting documents that AlertManager-driven alerts cannot be auto-resolved on receipt of `status: resolved`, because the platform never sees the field." — evidence: AlertManagerController.java:28-32 + ExternalAlert.java:9-15 + WebFetch active-platform-features/alerting 2026-05-20 — severity: MEDIUM
- "Generator URL is passed through without scheme allowlist: ExternalAlert.generatorURL is `URI` (ExternalAlert.java:13) — the URI type validates wire-shape but does not constrain scheme. AlertServiceImpl.java:168-172 builds a query-augmented URL via UriComponentsBuilder, then AlertServiceImpl.java:185 embeds the result in the chunk description as `String.format(\"Distribution Anomaly. URL: %s\", queryUrl)`. The chunk description is then rendered back in the platform UI on the alerts feed. If the UI renders descriptions as clickable links (or innerHTML), a `generatorURL=javascript:...` payload becomes a stored-XSS / open-redirect surface. Combined with the unauthenticated receiver, any caller with network reach can plant the payload — and combined with the cross-owner read on /api/alerts (REFACTOR-024), every authenticated user sees it." — evidence: ExternalAlert.java:13 (URI type, no scheme constraint) + AlertServiceImpl.java:168-172, 185 + AlertManagerController.java:24 (no validation at controller boundary) — severity: MEDIUM
- "No rate limit, no payload-size limit, no batch-cardinality cap on the path. A misconfigured AlertManager (or a malicious caller, since the path is unauthenticated) can flood ODD with alerts, each one creating an AlertPojo row + AlertChunkPojo row inside @ReactiveTransactional handleExternalAlerts. The @ReactiveTransactional annotation (AlertServiceImpl.java:152) ensures per-batch atomicity but offers zero throughput cap. There is no `@RequestSizeLimit`, no path-level rate-limit WebFilter, no Bucket4j integration." — evidence: AlertManagerController.java:21-26 (no rate limit annotation, no body-size constraint) + AlertServiceImpl.java:152-191 (the loop materialises one alert+chunk per input array entry) — severity: MEDIUM

## security

- **auth_mode_relevance**: `NONE — operator-delegated network-layer auth (the F-007 `unauthenticated_payload_trust` facet, confirmed at method tier)`. The method itself carries no `@ConditionalOnProperty` and no `@PreAuthorize`. Auth wiring is:
  - WHITELIST_PATHS in SecurityConstants.java:96 exempts the entire `/ingestion/**` namespace from the UI auth chain — so all four UI modes (DISABLED / LOGIN_FORM / OAUTH2 / LDAP) skip authentication on this path.
  - The S2S ingestion-auth filter IngestionDataEntitiesFilter (IngestionDataEntitiesFilter.java:21) is annotated `@ConditionalOnProperty(value = "auth.ingestion.filter.enabled", havingValue = "true")` AND its matcher (line 28) binds to `/ingestion/entities` POST only — sibling paths under `/ingestion/**` (including `/ingestion/alert/alertmanager`) are explicitly NOT covered.

  Therefore: the endpoint accepts any AlertManager-shaped POST from any caller with network reach to the platform port, under all four `auth.type` modes and under all values of `auth.ingestion.filter.enabled`.
- **ingestion_filter_relevance**: `NO — different path under /ingestion/** but outside the IngestionDataEntitiesFilter matcher`. IngestionDataEntitiesFilter.java:28 binds to `/ingestion/entities` POST only via `PathPatternParserServerWebExchangeMatcher`. The receiver here at `/ingestion/alert/alertmanager` shares the WHITELIST_PATHS prefix but does NOT share the filter's path pattern, so the S2S token mechanism the filter implements (Bearer-token, validated against the per-datasource token in the Postgres `datasource.token` field via the AbstractIngestionFilter.resolveToken + readBody chain) does NOT protect this path.
- **authorization_assertions**: `[]` — none. There is no `@PreAuthorize`, no `@Secured`, no programmatic `permissionService.hasPermission(...)`, no SecurityRule entry in SecurityConstants.SECURITY_RULES covering this path (SecurityConstants.java:98-355 lists every per-path permission rule; `/ingestion/**` is whitelisted entirely so any SecurityRule entry would be moot — but there's no entry anyway). The only "gate" is the operator's network policy. This is an `[]` entry AND a high-severity known_security_gap below (an unauthenticated HTTP path on the public surface of the platform, accepting payloads that produce authoritative-state writes, is the canonical webhook-trust surface).
- **owner_scoping**: `N/A — operator-delivered alert; not owner-scoped`. The receiver accepts an inbound payload from the operator's Prometheus AlertManager and uses the `entity_oddrn` label to look up the target data entity (AlertServiceImpl.java:178). The data path is `payload → AlertPojo`, not `query → owner-filtered result`. There is no current-user concept on this code path; the request is anonymous by design. The READ side of this asymmetry (alerts visible to all authenticated users on `GET /api/alerts`) is captured in F-007's `forge + display compound with REFACTOR-024` facet.
- **data_exposure**:
  - "Write surface: any AlertManager-shaped JSON payload posted by anyone with network reach → AlertPojo + AlertChunkPojo rows in Postgres, materialised as DISTRIBUTION_ANOMALY alerts on whatever entity_oddrn the caller chose" — evidence: AlertManagerController.java:21-26 + AlertServiceImpl.java:174-188.
  - "Cross-tenant attribution: an unauthenticated caller can POST a payload with any entity_oddrn — including entities owned by a different tenant — and the alert surfaces on that entity's page to every authenticated user (compound with REFACTOR-024's unfiltered listAllWithStatusOpen)" — evidence: AlertManagerController.java:24 + AlertServiceImpl.java:178.
  - "Stored-XSS / open-redirect surface via `generatorURL`: caller-supplied URL is embedded in chunk description and rendered back in the UI; no scheme allowlist at this method's boundary" — evidence: AlertManagerController.java:24 (no validation) + AlertServiceImpl.java:185 (the format embeds the URL verbatim).
- **known_security_gaps**:
  - "Controller method has no @PreAuthorize / @Secured / programmatic auth check. The path is exempted from the UI auth chain by WHITELIST_PATHS (SecurityConstants.java:96 — `/ingestion/**`). There is no sibling filter analogous to IngestionDataEntitiesFilter that covers `/ingestion/alert/alertmanager`. The endpoint is fully unauthenticated under all `auth.type` modes — including LOGIN_FORM/OAUTH2/LDAP where the rest of the platform is protected. This is the F-007 `unauthenticated_payload_trust` facet, confirmed at the method tier." — evidence: AlertManagerController.java:15-32 + SecurityConstants.java:96 + IngestionDataEntitiesFilter.java:28 — severity: HIGH
  - "Untrusted `entity_oddrn` enables cross-tenant alert creation: the method delegates without validation, AlertServiceImpl.java:178 maps the label verbatim. Combined with the platform-wide read on `GET /api/alerts` (REFACTOR-024), a hostile caller can inject false-positive alerts attributed to other teams' data entities, and those alerts surface on the platform-wide All tab visible to every authenticated user. This is the F-007 `cross_tenant_alert_creation` facet, confirmed at the method tier." — evidence: AlertManagerController.java:24 + AlertServiceImpl.java:178 — severity: HIGH
  - "No idempotency on retry: there is no Idempotency-Key header inspection, no idempotency field in the request DTO, and the downstream createAlerts (AlertServiceImpl.java:261-300) issues INSERT … RETURNING with no ON CONFLICT clause. Prometheus's standard retry policy (transient network failures, configurable per-receiver) duplicates rows. The F-007 `no_idempotency_no_audit` facet, confirmed at the method tier." — evidence: AlertManagerController.java:21-26 (no header reading) + AlertServiceImpl.java:151-191 (handleExternalAlerts skips AlertActionResolver, the dedup path) — severity: HIGH
  - "No audit log on entry: no `log.info(...)` at controller entry, no Micrometer @Timed counter, no per-call correlation-id capture. Forensic reconstruction of `who POSTed what when` after a forge incident is not possible — only the resulting alert rows persist. (The Activity feed events emitted from createAlerts at AlertServiceImpl.java:302-325 are `OPEN_ALERT_RECEIVED` events on the data entity, NOT a request-level audit trail; they record the alert was received, not the source of the POST.)" — evidence: AlertManagerController.java:21-26 (no log statement, no @Timed, no `WebFilter` log on the path) — severity: HIGH
  - "No payload validation, no rate limit, no batch-cardinality cap: `@Valid` is not on `@RequestBody final Mono<AlertManagerRequest>` (line 22), so even if the DTO carried `@NotNull` / `@Size` annotations they would not fire. There is no path-level rate-limiter WebFilter; the only throughput constraint is the @ReactiveTransactional boundary on AlertServiceImpl.handleExternalAlerts (which serialises per-batch but doesn't cap cross-batch volume)." — evidence: AlertManagerController.java:21-26 (no @Valid, no @Min/@Max/@Size on the inner DTO) + AlertServiceImpl.java:152-191 — severity: MEDIUM
  - "generatorURL scheme is unconstrained at the controller boundary — `URI` validates shape but not scheme; downstream embedding in the chunk description (AlertServiceImpl.java:185) is a stored-XSS / open-redirect surface if the UI renders descriptions as clickable links. Combined with the unauthenticated receiver, any caller with network reach plants the payload; combined with REFACTOR-024's cross-owner read, every authenticated user sees it." — evidence: ExternalAlert.java:13 + AlertServiceImpl.java:168-172, 185 + AlertManagerController.java:24 — severity: MEDIUM

## performance

- **hot_paths**:
  - "Invoked by Prometheus AlertManager on alert events. AlertManager's default `group_interval: 5m` means per-alert-group the platform sees one POST every 5 minutes minimum (per the AlertManager configuration model). `repeat_interval: 4h` re-sends alerts that remain firing. On a noisy alert tree this can be multiple-times-per-minute aggregate. The endpoint accepts the payload synchronously and writes to Postgres inside @ReactiveTransactional." — evidence: AlertManagerController.java:21-26 + AlertServiceImpl.java:152 (the transactional boundary).
  - "Per-request DB write fan-out: the controller passes N alerts (the size of `payload.alerts`) to handleExternalAlerts, which inside @ReactiveTransactional materialises N AlertPojo rows + N AlertChunkPojo rows via the partitioned createAlerts (AlertServiceImpl.java:261-300; ReactiveAlertRepositoryImpl's partition size is 1000 rows per F-007 chain[3])." — evidence: AlertManagerController.java:24 + AlertServiceImpl.java:174-188, 190.
- **throughput_characteristics**:
  - "Single HTTP POST per AlertManagerRequest payload; the payload carries a List<ExternalAlert> so AlertManager's per-group batching does cluster alerts into a single POST. No platform-side batching across POSTs; back-to-back webhook calls each open their own @ReactiveTransactional boundary." — evidence: AlertManagerController.java:30-32 (the inner DTO list shape) + AlertServiceImpl.java:152, 174-188.
  - "Reactive Mono signature — `Mono<ResponseEntity<Void>>` (line 22); non-blocking up to the @ReactiveTransactional boundary; the transaction itself serialises the per-batch DB writes." — evidence: AlertManagerController.java:22 + AlertServiceImpl.java:152.
  - "No batching across requests, no queue between HTTP intake and DB write — the design is request-synchronous-write. Bursty AlertManager groups (post-incident storms) hit the DB synchronously with per-batch transactions; a slow Postgres or saturated R2DBC pool surfaces as 5xx on AlertManager's side, causing AlertManager to retry per its configured policy, amplifying load." — evidence: AlertManagerController.java:21-26 + AlertServiceImpl.java:152-191 (no `Mono.subscribeOn(Schedulers.boundedElastic())`, no @Async, no @Scheduled, no queue dependency injection).
- **resource_allocation**:
  - "Per-call DB write per element of `payload.alerts`: N alerts → N AlertPojo inserts + N AlertChunkPojo inserts inside createAlerts. A noisy AlertManager group with 50 alerts in one POST writes 100 rows in one transaction. The partitioned executor caps single-batch SQL statement size, not transaction size." — evidence: AlertServiceImpl.java:174-188, 190 + F-007.yaml chain[3] (createAlerts partition size 1000 from ReactiveAlertRepositoryImpl).
  - "Fan-out to activity events: createAlerts also emits `OPEN_ALERT_RECEIVED` activity events via registerNewAlertsActivityEvents (AlertServiceImpl.java:302-325) — each alert produces one ActivityCreateEvent inserted via ActivityService.createActivityEvents. This doubles the per-call write fan-out." — evidence: AlertServiceImpl.java:291 (`.flatMap(this::registerAlertCreatedEvents)`) + AlertServiceImpl.java:302-325.
  - "No connection-pool concerns at this controller layer — controller is stateless; DB pooling is the platform-wide R2DBC pool, not allocated per request." — evidence: AlertManagerController.java:17-18 (singleton field, no per-request resource construction).
- **scaling_characteristics**:
  - "Stateless controller — no instance fields beyond the injected `AlertService` (line 18) via @RequiredArgsConstructor (line 16); instances scale horizontally without coordination." — evidence: AlertManagerController.java:15-32.
  - "No locks / advisory locks / leader election on the alert-write path; multiple replicas behind a load balancer can each accept AlertManager POSTs concurrently. @ReactiveTransactional ensures per-batch atomicity but offers no cross-replica ordering guarantee — concurrent POSTs of the same group from a retry may both insert before either commits." — evidence: AlertManagerController.java:15-32 + AlertServiceImpl.java:152 (no `@SchedulerLock`, no ShedLock, no advisory-lock pattern visible in handleExternalAlerts).
- **known_performance_gaps**:
  - "No rate limit, no payload-size cap, no batch-cardinality cap — a misconfigured AlertManager (or unauthenticated attacker) can create unbounded AlertPojo + AlertChunkPojo + ActivityCreateEvent rows. The @ReactiveTransactional boundary protects per-batch atomicity but provides zero throughput cap." — evidence: AlertManagerController.java:21-26 + AlertServiceImpl.java:152-191 — severity: MEDIUM (cross-references the security HIGH-severity finding above; framed here under performance for the unbounded-row-growth risk).
  - "No deduplication of repeated alerts within a short window — AlertManager's group_interval (5m default) and repeat_interval (4h default) re-send the same group; each re-send creates a fresh AlertPojo row even if the underlying `(entity_oddrn, type=DISTRIBUTION_ANOMALY)` already has an OPEN alert. AlertUniqueConstraint.fromAlert (AlertServiceImpl.java:187) deduplicates within a single batch but not across batches. The applyAlertActions path (used by in-platform ingestion at AlertServiceImpl.java:222-227) DOES route through AlertActionResolver to deduplicate; handleExternalAlerts deliberately skips this path." — evidence: AlertServiceImpl.java:174-188 (no pre-insert lookup against existing OPEN alerts) + AlertServiceImpl.java:187 (AlertUniqueConstraint is per-batch only) + AlertServiceImpl.java:222-227 (the parallel applyAlertActions path that DOES dedup) — severity: MEDIUM.
  - "No backpressure / queue between HTTP intake and DB write — bursty AlertManager groups hit the DB synchronously; slow Postgres or saturated R2DBC pool surfaces as 5xx → AlertManager retries → load amplification." — evidence: AlertManagerController.java:21-26 + AlertServiceImpl.java:152-191 (no async / queue decoupling) — severity: LOW.

## sources

- understanding ← AlertManagerController.java:21-26 (the @PostMapping + method body) + AlertServiceImpl.java:151-191 (handleExternalAlerts) + SecurityConstants.java:96 (WHITELIST_PATHS) + IngestionDataEntitiesFilter.java:28 (the filter's matcher scope)
- concepts.entities.AlertManagerRequest ← AlertManagerController.java:28-32
- concepts.entities.ExternalAlert ← ExternalAlert.java:11-15
- concepts.entities.Mono ResponseEntity Void ← AlertManagerController.java:22
- concepts.operations.deserialise ← AlertManagerController.java:22 (`@RequestBody final Mono<AlertManagerRequest> request`)
- concepts.operations.unwrap ← AlertManagerController.java:24 (`req.getAlerts()`)
- concepts.operations.delegate ← AlertManagerController.java:24 (`alertService.handleExternalAlerts(req.getAlerts())`)
- concepts.operations.unconditional-204 ← AlertManagerController.java:25 (`.map(o -> ResponseEntity.noContent().build())`)
- concepts.invariants.path-mount ← AlertManagerController.java:21 (`@PostMapping(path = "ingestion/alert/alertmanager")`)
- concepts.invariants.unconditional-204 ← AlertManagerController.java:25
- concepts.invariants.no-method-auth ← AlertManagerController.java:21-26 (absence of `@PreAuthorize` / `@Secured` / `@ConditionalOnProperty`) + SecurityConstants.java:96 + IngestionDataEntitiesFilter.java:28
- concepts.invariants.hand-rolled-DTO ← AlertManagerController.java:20 (the TODO comment) + AlertManagerController.java:28-32 (the inner static class)
- concepts.invariants.single-method-class ← AlertManagerController.java:15-32 (one @PostMapping, no other handlers)
- concepts.audiences ← WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform#prometheus-alertmanager-integration` (status 200, 2026-05-20)
- dependencies_semantic.requires-feature.AlertService ← AlertManagerController.java:18 (the injected field) + AlertServiceImpl.java:151-191 (the bound implementation)
- dependencies_semantic.requires-config.none ← AlertManagerController.java:15-32 (no `@Value`, no `@ConfigurationProperties`, no `@ConditionalOnProperty`)
- dependencies_semantic.requires-runtime.WebFlux ← AlertManagerController.java:13, 22
- dependencies_semantic.requires-runtime.LocalDateTime-Jackson ← ExternalAlert.java:14 + AlertServiceImpl.java:67-68
- dependencies_semantic.requires-runtime.ReactiveTransactional ← AlertServiceImpl.java:152
- dependencies_semantic.requires-runtime.WHITELIST_PATHS ← SecurityConstants.java:96
- dependencies_semantic.couples-to.AlertService ← AlertManagerController.java:18
- dependencies_semantic.couples-to.ExternalAlert ← ExternalAlert.java:9-15
- dependencies_semantic.couples-to.AlertManagerRequest ← AlertManagerController.java:28-32
- tests_coverage_semantic.test_files ← verified empty: `grep -rln 'alertmanager|handleExternalAlerts|AlertManager' <odd-platform-repo>/odd-platform-api/src/test` returned only the test-resource `odd-platform-api/src/test/resources/prometheus/prometheus.yml`
- docs_link_semantic.inferred_docs.[0] ← WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform` 2026-05-20 status 200
- docs_link_semantic.inferred_docs.[1] ← WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/alerting` 2026-05-20 status 200 (was 404 in 2026-05-08; supersede recorded in coherence sweep)
- docs_link_semantic.doc_drift_findings.[0] ← WebFetch active-platform-features/alerting 2026-05-20 (absence of cross-feature compound coverage) + F-007.yaml (the compound surface description)
- docs_link_semantic.doc_drift_findings.[1] ← WebFetch configuration-and-deployment/odd-platform 2026-05-20 + SecurityConstants.java:96 (WHITELIST_PATHS shape)
- implicit_adrs.[0].no_openapi_contract ← AlertManagerController.java:15 (no `implements *Api`) + AlertManagerController.java:20 (the TODO comment) + AlertManagerController.java:28-32 (inner static DTO)
- implicit_adrs.[1].auth_delegated_to_operator ← SecurityConstants.java:96 + IngestionDataEntitiesFilter.java:28 + WebFetch configuration-and-deployment/odd-platform 2026-05-20 (the doc-side intent_anchor)
- implicit_adrs.[2].unconditional_204 ← AlertManagerController.java:25
- bugs_limitations_corner_cases.[0].unauthenticated_payload_trust ← AlertManagerController.java:21-26 + SecurityConstants.java:96 + IngestionDataEntitiesFilter.java:28
- bugs_limitations_corner_cases.[1].cross_tenant_alert_creation ← AlertManagerController.java:24 + AlertServiceImpl.java:178
- bugs_limitations_corner_cases.[2].no_idempotency_no_audit ← AlertManagerController.java:21-26 + AlertServiceImpl.java:151-191, 222-227, 261-300
- bugs_limitations_corner_cases.[3].timezone_naive_starts_at ← ExternalAlert.java:14 + AlertServiceImpl.java:67-68, 168-172
- bugs_limitations_corner_cases.[4].dropped_wire_fields ← AlertManagerController.java:28-32 + ExternalAlert.java:9-15 + WebFetch active-platform-features/alerting 2026-05-20
- bugs_limitations_corner_cases.[5].generator_url_no_scheme_allowlist ← ExternalAlert.java:13 + AlertServiceImpl.java:168-172, 185 + AlertManagerController.java:24
- bugs_limitations_corner_cases.[6].no_rate_limit ← AlertManagerController.java:21-26 + AlertServiceImpl.java:152-191
- security.auth_mode_relevance ← SecurityConstants.java:96 + IngestionDataEntitiesFilter.java:21, 28 + AlertManagerController.java:21-26 (no method-level annotations)
- security.ingestion_filter_relevance ← IngestionDataEntitiesFilter.java:28 (the matcher's path-pattern is `/ingestion/entities` POST only)
- security.authorization_assertions ← AlertManagerController.java:15-32 (absence of `@PreAuthorize` / `@Secured` / programmatic check) + SecurityConstants.java:98-355 (no SecurityRule covers this path)
- security.owner_scoping ← AlertManagerController.java:24 (no principal pass-through, no current-user reference) + AlertServiceImpl.java:174-188 (write-side path, no owner predicate)
- security.data_exposure.[0..2] ← AlertManagerController.java:21-26 + AlertServiceImpl.java:174-188, 185 + F-007.yaml (the compound surface)
- security.known_security_gaps.[0..5] ← AlertManagerController.java:15-32 + SecurityConstants.java:96 + IngestionDataEntitiesFilter.java:28 + AlertServiceImpl.java:178, 222-227, 261-300, 152-191, 168-172, 185 + ExternalAlert.java:13
- performance.hot_paths.[0..1] ← AlertManagerController.java:21-26 + AlertServiceImpl.java:152, 174-188
- performance.throughput_characteristics.[0..2] ← AlertManagerController.java:22, 24, 30-32 + AlertServiceImpl.java:152-191
- performance.resource_allocation.[0..2] ← AlertServiceImpl.java:174-188, 190, 291, 302-325 + AlertManagerController.java:17-18
- performance.scaling_characteristics.[0..1] ← AlertManagerController.java:15-32 + AlertServiceImpl.java:152 (no advisory-lock pattern)
- performance.known_performance_gaps.[0..2] ← AlertManagerController.java:21-26 + AlertServiceImpl.java:152-191, 174-188, 187, 222-227

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (absence-of-tests verified by repo-wide grep against the test root)
- docs_link_semantic: HIGH (both URLs WebFetched 2026-05-20 status 200; the active-platform-features/alerting page's prior 404 from 2026-05-08 is superseded by this session's 200 fetch)
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH

## Maintainer notes

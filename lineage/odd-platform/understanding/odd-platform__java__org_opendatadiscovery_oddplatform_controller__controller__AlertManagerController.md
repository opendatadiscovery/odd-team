---
node_id: "odd-platform java org.opendatadiscovery.oddplatform.controller controller:AlertManagerController"
node_kind: controller
axis: controllers
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.1.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-08-AlertManagerController
---

# AlertManagerController — semantic understanding

## understanding

`AlertManagerController` exposes a single unauthenticated `POST /ingestion/alert/alertmanager` endpoint that accepts Prometheus AlertManager webhook payloads and forwards each `ExternalAlert` to `AlertService.handleExternalAlerts`, where it is materialised as a `DISTRIBUTION_ANOMALY` alert keyed by the `entity_oddrn` label. Unlike the rest of the platform's REST surface, the controller is **not** generated from `odd-platform-api-contract` (no `*Api` interface is implemented; the source carries an explicit `// TODO: define OpenAPI spec based on alert provider contract`); the request shape is a hand-rolled inner static class `AlertManagerRequest` that mirrors the AlertManager webhook body. The endpoint sits inside the `/ingestion/**` whitelist in Spring Security, so authentication and authorisation are explicitly delegated to operator-side network controls (reverse proxy, mTLS, NetworkPolicy).

## concepts

- entities: [`ExternalAlert`, `AlertManagerRequest`, `AlertPojo`, `DISTRIBUTION_ANOMALY` alert, `entity_oddrn` label]
- operations: [`receive AlertManager webhook`, `unwrap external alert list`, `delegate to AlertService.handleExternalAlerts`, `return 204 No Content`]
- invariants:
  - The endpoint accepts any caller — there is no Spring Security check, no API token, no shared secret on the request body.
  - The response is always `204 No Content` on success; the controller does not signal which alerts were accepted vs orphaned.
  - Each `ExternalAlert` is treated as a `DISTRIBUTION_ANOMALY` regardless of its AlertManager-side `alertname` or `severity` labels (set in `AlertServiceImpl.handleExternalAlerts` line 177).
  - The `entity_oddrn` label is the only routing key — alerts without it are stored with a null `data_entity_oddrn` and become orphaned (see `AlertServiceImpl.handleExternalAlerts` line 178: `externalAlert.getLabels().get("entity_oddrn")`).
- audiences: [Prometheus AlertManager (HTTP webhook caller), platform operators configuring AlertManager to push into ODD]

## dependencies_semantic

- requires-feature:
  - The internal alerts subsystem (`AlertService`, `AlertRepository`, `AlertPojo`, `AlertChunkPojo`) — this controller is purely an inbound adapter on top of it.
  - `DISTRIBUTION_ANOMALY` alert type must exist in `AlertTypeEnum` for `AlertServiceImpl.handleExternalAlerts` to set it (line 177).
- requires-config:
  - **None at the controller level.** The endpoint is hard-wired and not feature-flagged. There is no `auth.ingestion.alertmanager.enabled` or equivalent property gating it.
  - Spring Security must include `/ingestion/**` in `WHITELIST_PATHS` (`SecurityConstants.java:96`) — without that, the endpoint would 401/403 since Prometheus AlertManager has no notion of platform credentials.
- requires-runtime:
  - Spring WebFlux reactive stack (returns `Mono<ResponseEntity<Void>>`).
  - `AlertServiceImpl.handleExternalAlerts` is annotated `@ReactiveTransactional` — alert+chunk materialisation is atomic per webhook batch, but cross-batch ordering is not guaranteed.
  - Each `ExternalAlert.startsAt` is parsed via `DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")` (`AlertServiceImpl.java:67-68`); it is timezone-naive and runs in the JVM's default zone. AlertManager's `startsAt` is RFC3339 — the controller's DTO uses `LocalDateTime`, so any timezone offset Jackson sees in the payload will be silently truncated.

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - Happy path: a well-formed AlertManager payload with `entity_oddrn` produces a `DISTRIBUTION_ANOMALY` alert on the right entity.
  - Orphan path: a payload **without** `entity_oddrn` is silently accepted and stored with a null entity reference — the controller returns 204 with no warning.
  - Empty `alerts: []` array: `AlertServiceImpl.handleExternalAlerts` short-circuits to `Mono.empty()` (line 154-156), but no test confirms the controller still returns 204.
  - Malformed `startsAt` (e.g. RFC3339 with timezone): the Jackson deserialisation of `LocalDateTime` will either throw or silently strip the timezone — behaviour is not test-pinned.
  - Auth surface: no test verifies that the endpoint accepts anonymous requests (i.e. that `/ingestion/**` whitelisting still applies). A future security tightening could break the integration silently.
- test_files: []
- gaps: |
    There are zero Java tests covering this controller, the inbound DTO, or `AlertServiceImpl.handleExternalAlerts`. A regression most likely lands in:
    (1) The `entity_oddrn` lookup — if AlertManager-side label-naming conventions drift (e.g. someone configures `oddrn` instead of `entity_oddrn`), every alert silently orphans and the only signal is "alerts not appearing on entity pages."
    (2) The `LocalDateTime` deserialisation — if Spring's Jackson default for `LocalDateTime` changes (or if a Java upgrade alters the parser's tolerance), the entire webhook stops accepting payloads.
    (3) The hard-coded `DISTRIBUTION_ANOMALY` type — if the platform later wants to honour AlertManager's `alertname` to choose alert type, the absence of tests on the current behaviour means the migration has no safety net.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform"
    anchor: "#prometheus-alertmanager-integration"
    rationale: "Live page contains a 'Prometheus AlertManager Integration' section that documents the exact `POST /ingestion/alert/alertmanager` endpoint, the `entity_oddrn` label requirement, the `DISTRIBUTION_ANOMALY` alert type, and the unauthenticated-by-design posture. No `@docs` annotation in source — link inferred from path-and-content alignment."
    last_verified_at: "2026-05-08T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      Section heading (verbatim): "Prometheus AlertManager Integration"
      Opening sentence (verbatim): "In addition to raising alerts internally (failed jobs, data-quality tests, schema changes, distribution anomalies — see the Alerting feature), ODD Platform exposes an inbound webhook that accepts Prometheus AlertManager notifications."
      Endpoint declaration (verbatim): "POST /ingestion/alert/alertmanager"
      Routing claim (verbatim): "Each inbound alert becomes a Distribution Anomaly alert on the referenced data entity, visible in the Alerts section and on the entity's page."
      entity_oddrn warning (verbatim): "An alert submitted without this label is stored with an empty owner, will not appear on any entity's page, and is effectively orphaned."
      Auth warning (verbatim): "The AlertManager webhook endpoint is not authenticated. ODD Platform whitelists the entire `/ingestion/**` namespace in Spring Security, and the ingestion auth filter controlled by `auth.ingestion.filter.enabled` only guards `/ingestion/entities` (POST) — it does not cover `/ingestion/alert/alertmanager`."
      Network-controls recommendation (verbatim, refresh 2026-05-08): "Anyone with network reach to the platform can POST arbitrary AlertManager-shaped payloads." + "Apply perimeter controls (network segmentation, authenticating reverse proxy, mTLS) for any deployment where these endpoints are reachable from outside the trusted network."
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security"
    anchor: ""
    rationale: "Canonical reference for ODD auth modes (DISABLED / LOGIN_FORM / OAUTH2 / LDAP) and the `auth.ingestion.filter.enabled` ingestion-auth property. Used here to confirm that the AlertManager webhook is NOT covered by any of the four UI auth modes (whitelisted via `/ingestion/**`) and NOT covered by the ingestion auth filter (which only guards `/ingestion/entities` POST)."
    last_verified_at: "2026-05-08T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      auth.type modes (verbatim): "four UI authentication modes controlled by `auth.type`: DISABLED, LOGIN_FORM, OAUTH2, LDAP."
      Ingestion filter property (verbatim): "`auth.ingestion.filter.enabled` (defaults to `false`)."
      Whitelist statement (verbatim): "The `/ingestion/**` namespace is whitelisted in Spring Security (`SecurityConstants.WHITELIST_PATHS`), so it never traverses the UI authentication chain."
      AlertManager-specific guidance (verbatim): "Apply perimeter controls (network segmentation, authenticating reverse proxy, mTLS) for any deployment where these endpoints are reachable from outside the trusted network."
- doc_drift_findings:
  - "The Alerting feature page at `https://docs.opendatadiscovery.org/active-platform-features/alerting` returns 404 (last_verified_status: 404 on 2026-05-08). Either the feature page does not exist (cross-link gap from configuration-and-deployment.md should resolve to a feature surface that explains what `DISTRIBUTION_ANOMALY` alerts are) or the URL slug is different. The configuration-and-deployment page references 'Alerting feature' in its opening sentence — that cross-reference cannot resolve until the feature page exists at a discoverable URL."
  - "The configuration page documents the `auth.ingestion.filter.enabled` ingestion-auth filter as covering `/ingestion/entities` POST only. The AlertManager endpoint sits in the same `/ingestion/**` whitelist (SecurityConstants.java:96) but is not covered by that filter. The fact that the doc explicitly carves out which ingestion endpoints the auth filter covers is correct; what's missing is that there is no equivalent shared-secret or token mechanism for the AlertManager endpoint, so the doc's recommendation list (network segmentation / reverse proxy / mTLS) is the only operator option. This is documented but worth flagging as an asymmetry vs the rest of `/ingestion/**`."

## implicit_adrs

- "External alert ingestion is not driven by `odd-platform-api-contract` (OpenAPI). The controller is hand-coded with an explicit `// TODO: define OpenAPI spec based on alert provider contract` (AlertManagerController.java:20), and the request DTO is an inner static class on the controller rather than a generated `*Api` model. The decision is implicit — every other inbound REST endpoint in this controller package implements an `*Api` interface generated from `openapi.yaml`." — evidence: AlertManagerController.java:15-32 (no `implements *Api`, inner `AlertManagerRequest` class, explicit TODO comment) — confidence: HIGH
- "Inbound external alerts are unconditionally treated as `DISTRIBUTION_ANOMALY`, regardless of AlertManager-side `alertname`, `severity`, or any other label. The choice ties the platform's external-alert vocabulary to a single internal alert type rather than mapping AlertManager labels onto the alert-type taxonomy." — evidence: AlertServiceImpl.java:177 (`.setType(AlertTypeEnum.DISTRIBUTION_ANOMALY.getCode())` inside the per-alert loop with no label inspection) — confidence: HIGH
- "Authentication for the AlertManager webhook is delegated to operator-side network controls (reverse proxy / mTLS / NetworkPolicy) rather than handled in-platform. The endpoint is in the `/ingestion/**` whitelist (`SecurityConstants.java:96`), and unlike `/ingestion/entities` (covered by the ingestion-auth filter via `auth.ingestion.filter.enabled`), there is no shared-secret or token mechanism for the AlertManager endpoint." — evidence: SecurityConstants.java:96 (`/ingestion/**` whitelist) + absence of any `IngestionAlertManager*Filter` in `auth/filter/` — confidence: HIGH
- "The `entity_oddrn` AlertManager label is the contract between the operator's AlertManager rules and ODD's routing logic. There is no fallback (`entity_id`, `dataset_oddrn`, label-prefix matching) — the contract is one specific label name, hard-coded, with no validation at the controller boundary." — evidence: AlertServiceImpl.java:178 (`externalAlert.getLabels().get("entity_oddrn")`) — confidence: HIGH

## bugs_limitations_corner_cases

- "An AlertManager payload missing the `entity_oddrn` label is silently accepted, persisted with a null `data_entity_oddrn`, and orphaned. The controller returns 204 No Content with no indication to AlertManager that the alert was un-routable. Operators relying on AlertManager's notification-success signal cannot detect this misconfiguration." — evidence: AlertServiceImpl.java:178 (`externalAlert.getLabels().get("entity_oddrn")` — `Map.get` returns null for missing key, no null-check before `.setDataEntityOddrn(...)`) + AlertManagerController.java:25 (`.map(o -> ResponseEntity.noContent().build())` — unconditional 204) — severity: HIGH
- "`ExternalAlert.startsAt` is `LocalDateTime` (`ExternalAlert.java:14`), which is timezone-naive. Prometheus AlertManager sends `startsAt` as RFC3339 with timezone (e.g. `2026-05-08T10:23:45.123Z`). Jackson's default `LocalDateTime` deserialiser strips the offset/zone silently, so the stored alert time is the AlertManager-side wall-clock time interpreted in whatever zone Jackson treats as default. If the platform JVM and the AlertManager are in different zones, alert timestamps drift by the offset." — evidence: ExternalAlert.java:14 (`private LocalDateTime startsAt;`) + AlertServiceImpl.java:67-68 (formatter pattern is also zone-naive: `yyyy-MM-dd HH:mm:ss`) — severity: MEDIUM
- "There is no rate limit, payload size limit, or duplicate-suppression on this endpoint. A misconfigured AlertManager (or a malicious caller — the endpoint is unauthenticated) can flood ODD with alerts, each one creating an `AlertPojo` row + an `AlertChunkPojo` row. The `@ReactiveTransactional` annotation on `handleExternalAlerts` (AlertServiceImpl.java:152) wraps a single batch in a transaction but does nothing about cross-batch volume." — evidence: AlertManagerController.java:21-26 (no `@RequestSizeLimit`, no rate-limit filter on the path) + AlertServiceImpl.java:152-191 (loop materialises one alert+chunk per request entry without dedup) — severity: MEDIUM
- "The `// TODO: define OpenAPI spec based on alert provider contract` comment (AlertManagerController.java:20) has been in the source long enough that a contract-first integration is not the current trajectory. The hand-rolled `AlertManagerRequest` DTO is missing fields AlertManager actually sends (`status`, `endsAt`, `annotations`, `fingerprint`, `groupKey`); only `labels`, `generatorURL`, `startsAt` are deserialised, the rest are silently dropped. If the platform later wants to act on `status: resolved` to close alerts (which is the documented AlertManager behaviour), it must add deserialisation for that field — the current DTO would lose it." — evidence: AlertManagerController.java:30-32 (`AlertManagerRequest` has only `alerts: List<ExternalAlert>`) + ExternalAlert.java:11-15 (only `labels`, `generatorURL`, `startsAt` fields) — severity: MEDIUM
- "The `generatorURL` from each external alert is rewritten via `UriComponentsBuilder.fromUri(...).queryParam('g0.moment_input', alertTime).queryParam('g0.end_input', alertTime)` (AlertServiceImpl.java:168-172). This embeds Prometheus-Web-UI–specific query parameters into the stored alert chunk's description string. If the operator's AlertManager fronts something other than Prometheus (e.g. Mimir, Thanos, VictoriaMetrics), the generated link may not produce a useful UI navigation." — evidence: AlertServiceImpl.java:168-172 (`g0.moment_input` and `g0.end_input` are Prometheus PromQL UI query params) + AlertServiceImpl.java:185 (`String.format("Distribution Anomaly. URL: %s", queryUrl)` — the rewritten URL is hard-baked into the description) — severity: LOW

## security

- **auth_mode_relevance**: `NONE — operator-delegated network-layer auth`. The AlertManager webhook is **not** protected by any of the four UI auth modes (`DISABLED | LOGIN_FORM | OAUTH2 | LDAP`); the path is in `SecurityConstants.WHITELIST_PATHS` (`/ingestion/**`, `SecurityConstants.java:96`), which `AuthorizationCustomizer.java:22` exempts from the entire UI authentication chain. It is **also** not protected by the S2S ingestion auth filter (`IngestionDataEntitiesFilter`), whose `PathPatternParserServerWebExchangeMatcher` only binds to `/ingestion/entities` POST (`IngestionDataEntitiesFilter.java:28`) — `/ingestion/alert/alertmanager` is outside that matcher and therefore traverses zero authentication code. Reachability without LOGIN_FORM/OAUTH2/LDAP gating is by design (implicit_adr[2] — "auth_delegated_to_operator"), and the platform assumes the operator has put a network policy / authenticating reverse proxy / mTLS in front (per the `enable-security` page's perimeter-controls recommendation, last_verified 2026-05-08).
- **ingestion_filter_relevance**: `NO — different path`. The `auth.ingestion.filter.enabled`-gated `IngestionDataEntitiesFilter` only matches `/ingestion/entities` (POST) (`IngestionDataEntitiesFilter.java:28`). The AlertManager webhook lives at `/ingestion/alert/alertmanager` (`AlertManagerController.java:21`), which is in the same `/ingestion/**` whitelist namespace but is **not** covered by the ingestion auth filter, so even with `auth.ingestion.filter.enabled=true` the webhook stays unauthenticated.
- **authorization_assertions**: `[]` — none. There is no `@PreAuthorize`, no programmatic `permissionService.hasPermission(...)` check, and no `*Api` interface (the controller is hand-coded; implicit_adr[0] — "no_openapi_contract") that could carry an annotation upstream. The only "gate" is the operator's network policy. (Surfaced as a known_security_gap below — for non-internal HTTP surfaces, an empty assertions list is itself a finding.)
- **owner_scoping**: `N/A — operator-delivered alert; not owner-scoped`. The webhook accepts an inbound payload from the operator's Prometheus AlertManager and uses the `entity_oddrn` label to look up the target data entity (`AlertServiceImpl.java:178`); the data path is `payload → AlertPojo`, not `query → owner-filtered result`. There is no current-user concept on this code path; the request is anonymous by design. (See data_exposure for the read-side of this asymmetry — once stored, alerts are visible to authenticated UI users.)
- **data_exposure**:
  - `"Inbound: any AlertManager-shaped JSON payload posted by anyone with network reach → AlertPojo + AlertChunkPojo rows in Postgres, materialised as DISTRIBUTION_ANOMALY alerts on whatever entity_oddrn the caller chose"` — evidence: AlertManagerController.java:21-26 + AlertServiceImpl.java:174-188.
  - `"Outbound: stored alerts (id, status, type=DISTRIBUTION_ANOMALY, dataEntityOddrn, lastCreatedAt, description with Prometheus-rewritten generatorURL) → any authenticated UI/API user via the AlertController read endpoints"` — evidence: AlertServiceImpl.java:140-148 (read path returns alerts without explicit owner-scope filter at this service layer).
  - `"Spoofing surface: an unauthenticated caller can POST a payload with any entity_oddrn — including entities the caller does not own — and create a fake DISTRIBUTION_ANOMALY alert on that entity's page, visible to all authenticated users"` — evidence: AlertManagerController.java:21-26 (no auth) + AlertServiceImpl.java:178 (`entity_oddrn` is the routing key, no validation that the caller is authorised to alert on it).
- **known_security_gaps**:
  - "controller has no `@PreAuthorize` or programmatic authorization check; relies entirely on operator-delegated network-layer auth (no `*Api` interface upstream that could carry annotations either — controller is hand-coded per implicit_adr[0])" — evidence: AlertManagerController.java:15-32 + absence of `@PreAuthorize` / `permissionService` calls — severity: HIGH (per the live `enable-security` doc's own warning: "Anyone with network reach to the platform can POST arbitrary AlertManager-shaped payloads").
  - "`/ingestion/alert/alertmanager` is in the `SecurityConstants.WHITELIST_PATHS` (`/ingestion/**`) and outside `IngestionDataEntitiesFilter`'s path matcher (`/ingestion/entities` POST only), so even with `auth.ingestion.filter.enabled=true` the webhook stays unauthenticated — there is no shared-secret or token mechanism for this path" — evidence: SecurityConstants.java:96 + IngestionDataEntitiesFilter.java:28 — severity: HIGH
  - "no rate limit / payload size limit / dedup on the endpoint — an unauthenticated caller can flood ODD with `AlertPojo` + `AlertChunkPojo` rows, both as a DoS vector and as a noise-injection attack on legitimate alert pages" — evidence: AlertManagerController.java:21-26 + AlertServiceImpl.java:152-191 (cross-references bugs_limitations_corner_cases.[2] above; surfaced here under security framing because the lack of auth turns a quality-of-service gap into a security gap) — severity: MEDIUM
  - "alert-spoofing: caller chooses arbitrary `entity_oddrn`; no check that the caller is authorised to raise a DISTRIBUTION_ANOMALY against that entity — fabricated alerts surface to all authenticated users on the target entity's page" — evidence: AlertServiceImpl.java:178 + AlertManagerController.java:21-26 — severity: HIGH

## performance

- **hot_paths**:
  - "webhook is invoked by Prometheus AlertManager on alert events; can fire multiple-times-per-minute on noisy systems (AlertManager's `repeat_interval` defaults to 4h but `group_interval` defaults to 5m, so per-group the platform sees one POST every 5m at minimum on a busy alert tree)" — evidence: AlertManagerController.java:21-26 (no per-request throttling) + the absence of any path-level rate limiter in `auth/filter/`.
  - "per-request DB write fan-out: each ExternalAlert in the payload produces one `AlertPojo` row + one `AlertChunkPojo` row inside `@ReactiveTransactional handleExternalAlerts`" — evidence: AlertServiceImpl.java:174-188 (loop body) + AlertServiceImpl.java:152 (`@ReactiveTransactional`).
- **throughput_characteristics**:
  - "single AlertManagerRequest per HTTP call; the request body can contain a list of `ExternalAlert` (`AlertManagerRequest.alerts: List<ExternalAlert>`, AlertManagerController.java:30-32), so AlertManager's per-group batching does cluster alerts into one POST — but there is no platform-side batching across HTTP calls; back-to-back POSTs each open their own transaction" — evidence: AlertManagerController.java:30-32 + AlertServiceImpl.java:152-191.
  - "reactive Mono signature on the controller (`Mono<ResponseEntity<Void>>`, AlertManagerController.java:22) — non-blocking up to the service boundary, but the `@ReactiveTransactional` boundary serialises the per-batch DB writes inside a single transaction" — evidence: AlertManagerController.java:22 + AlertServiceImpl.java:152.
  - "no batching across requests: there is no scheduler / queue that aggregates incoming AlertManager calls before persisting; the design is request-synchronous-write" — evidence: AlertManagerController.java:21-26 + AlertServiceImpl.java:152-191 (no `@Scheduled`, no queue dependency).
- **resource_allocation**:
  - "per-call DB write per alert in the payload — N alerts in payload → N AlertPojo inserts + N AlertChunkPojo inserts inside `createAlerts(...)` (AlertServiceImpl.java:190); a noisy AlertManager group with 50 alerts in one POST creates 100 rows in one transaction" — evidence: AlertServiceImpl.java:174-188, 190.
  - "fan-out to notification channels: `createAlerts(...)` (called at AlertServiceImpl.java:190) is the same path used by internal alert raising and feeds the alert-notifications subsystem (Slack / webhook); each external alert can trigger an outbound notification HTTP call" — evidence: AlertServiceImpl.java:190 (shared `createAlerts` path) — confidence MEDIUM (notifications fan-out is implementation-coupled to `createAlerts`, not directly visible in `handleExternalAlerts`).
  - "no client / connection pool concerns at this controller layer (controller is stateless; DB pooling is the platform-wide R2DBC pool — not allocated per request here)" — evidence: AlertManagerController.java:15-32 (no `WebClient`, no per-request resource construction).
- **scaling_characteristics**:
  - "stateless controller — no instance fields beyond the injected `AlertService`; instances scale horizontally without coordination" — evidence: AlertManagerController.java:17-18 (`@RequiredArgsConstructor` + single `final AlertService alertService` field).
  - "no locks / advisory locks / leader election in the alert-handling path; multiple replicas behind a load balancer can each accept AlertManager POSTs concurrently — `@ReactiveTransactional` ensures per-batch atomicity but offers no cross-replica ordering guarantee" — evidence: AlertServiceImpl.java:152 (`@ReactiveTransactional`, no `@Lock` / advisory-lock dependency) + AlertManagerController.java:15-32.
  - "no pagination concerns on the write path; concerns shift to the read side (`AlertController.getAlertsByDataEntityId`, AlertServiceImpl.java:140-148) which does paginate" — evidence: AlertServiceImpl.java:140-148.
- **known_performance_gaps**:
  - "no rate limit on the endpoint — a misconfigured AlertManager (or unauthenticated flood from an attacker per security.known_security_gaps) creates unbounded `AlertPojo` + `AlertChunkPojo` rows; the `@ReactiveTransactional` boundary protects per-batch atomicity but provides zero throughput cap" — evidence: AlertManagerController.java:21-26 + AlertServiceImpl.java:152-191 — severity: MEDIUM (cross-references bugs_limitations_corner_cases.[2]; noted here under performance framing for the unbounded-row-growth risk).
  - "no deduplication of repeated alerts within a short window — AlertManager's `group_interval` re-sends the same group every 5m by default; each re-send creates a fresh `AlertPojo` row even if the underlying `(entity_oddrn, type=DISTRIBUTION_ANOMALY)` already has an OPEN alert. `AlertUniqueConstraint.fromAlert(alert)` (AlertServiceImpl.java:187) deduplicates within a single batch but not across batches" — evidence: AlertServiceImpl.java:174-188 (no pre-insert lookup against existing OPEN alerts) + AlertServiceImpl.java:187 (`AlertUniqueConstraint` is per-batch only) — severity: MEDIUM.
  - "no backpressure / queue between HTTP intake and DB write — bursty AlertManager groups (post-incident storm) hit the DB synchronously with per-batch transactions; a slow Postgres or saturated R2DBC pool will surface as 5xx on AlertManager's side, causing AlertManager to retry per its `notify` schedule, amplifying load" — evidence: AlertManagerController.java:21-26 + AlertServiceImpl.java:152-191 (no queue / scheduler / `Mono.subscribeOn(Schedulers.boundedElastic())` decoupling) — severity: LOW (depends on operator load profile; surfaced for awareness).

## sources

- understanding ← AlertManagerController.java:15-32 + AlertServiceImpl.java:151-191 + SecurityConstants.java:95-96
- concepts.entities.AlertManagerRequest ← AlertManagerController.java:28-32
- concepts.entities.ExternalAlert ← ExternalAlert.java:11-15
- concepts.entities.DISTRIBUTION_ANOMALY ← AlertServiceImpl.java:177
- concepts.entities.entity_oddrn ← AlertServiceImpl.java:178
- concepts.operations.receive_AlertManager_webhook ← AlertManagerController.java:21-26
- concepts.invariants.unauthenticated ← SecurityConstants.java:95-96 (`/ingestion/**` in `WHITELIST_PATHS`)
- concepts.invariants.always_204 ← AlertManagerController.java:25
- concepts.invariants.unconditional_distribution_anomaly ← AlertServiceImpl.java:177
- concepts.invariants.entity_oddrn_only_routing ← AlertServiceImpl.java:178
- dependencies_semantic.requires-feature.AlertService ← AlertManagerController.java:18 + AlertService.java:30
- dependencies_semantic.requires-config.no_feature_flag ← AlertManagerController.java:15-32 (no `@ConditionalOnProperty`, no `@Value` injection)
- dependencies_semantic.requires-runtime.reactive ← AlertManagerController.java:13,22 (`Mono` + `Mono<ResponseEntity<Void>>`)
- dependencies_semantic.requires-runtime.reactive_transactional ← AlertServiceImpl.java:152
- dependencies_semantic.requires-runtime.timezone_naive ← ExternalAlert.java:14 + AlertServiceImpl.java:67-68
- tests_coverage_semantic.test_files ← (verified absent: `find odd-platform-api/src/test -path "*alert*" -name "*.java"` returned no results; `grep -rln "handleExternalAlerts|alertmanager" src/test` returned only `prometheus.yml` test resource at `odd-platform-api/src/test/resources/prometheus/prometheus.yml`)
- docs_link_semantic.inferred_docs.[0] ← WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/odd-platform#prometheus-alertmanager-integration` (status 200, anchor resolved, 2026-05-08)
- docs_link_semantic.inferred_docs.[1] ← WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security` (status 200, 2026-05-08)
- docs_link_semantic.doc_drift_findings.[0] ← WebFetch `https://docs.opendatadiscovery.org/active-platform-features/alerting` (status 404, 2026-05-08)
- implicit_adrs.[0].no_openapi_contract ← AlertManagerController.java:15 (no `implements *Api`) + AlertManagerController.java:20 (`// TODO: define OpenAPI spec based on alert provider contract`) + AlertManagerController.java:28-32 (inner `AlertManagerRequest` class)
- implicit_adrs.[1].unconditional_distribution_anomaly ← AlertServiceImpl.java:177
- implicit_adrs.[2].auth_delegated_to_operator ← SecurityConstants.java:95-96 + absence of `IngestionAlertManager*Filter` in `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/filter/`
- implicit_adrs.[3].entity_oddrn_hard_contract ← AlertServiceImpl.java:178
- bugs_limitations_corner_cases.[0].silent_orphan ← AlertServiceImpl.java:178 + AlertManagerController.java:25
- bugs_limitations_corner_cases.[1].timezone_naive_starts_at ← ExternalAlert.java:14 + AlertServiceImpl.java:67-68
- bugs_limitations_corner_cases.[2].no_rate_limit ← AlertManagerController.java:21-26 + AlertServiceImpl.java:152-191
- bugs_limitations_corner_cases.[3].dropped_fields ← AlertManagerController.java:30-32 + ExternalAlert.java:11-15
- bugs_limitations_corner_cases.[4].prometheus_specific_url_rewrite ← AlertServiceImpl.java:168-172, 185
- security.auth_mode_relevance ← SecurityConstants.java:96 (`/ingestion/**` in `WHITELIST_PATHS`) + AuthorizationCustomizer.java:22 (`.pathMatchers(SecurityConstants.WHITELIST_PATHS)`) + IngestionDataEntitiesFilter.java:28 (path matcher scoped to `/ingestion/entities` POST only)
- security.ingestion_filter_relevance ← IngestionDataEntitiesFilter.java:20 (`@ConditionalOnProperty(value = "auth.ingestion.filter.enabled", havingValue = "true")`) + IngestionDataEntitiesFilter.java:28 + AlertManagerController.java:21
- security.authorization_assertions ← AlertManagerController.java:15-32 (absence of `@PreAuthorize` / programmatic `permissionService` calls)
- security.owner_scoping ← AlertManagerController.java:15-32 + AlertServiceImpl.java:174-188 (write-side path, no current-user reference)
- security.data_exposure ← AlertManagerController.java:21-26 + AlertServiceImpl.java:174-188 (write path) + AlertServiceImpl.java:140-148 (read path)
- security.known_security_gaps.[0] ← AlertManagerController.java:15-32 + WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security` (verbatim warning quoted in inferred_docs.[1].fetched_excerpts)
- security.known_security_gaps.[1] ← SecurityConstants.java:96 + IngestionDataEntitiesFilter.java:28
- security.known_security_gaps.[2] ← AlertManagerController.java:21-26 + AlertServiceImpl.java:152-191 (cross-ref bugs_limitations_corner_cases.[2])
- security.known_security_gaps.[3] ← AlertServiceImpl.java:178 + AlertManagerController.java:21-26
- performance.hot_paths.[0] ← AlertManagerController.java:21-26 + absence of rate-limit filter in `auth/filter/`
- performance.hot_paths.[1] ← AlertServiceImpl.java:152, 174-188
- performance.throughput_characteristics ← AlertManagerController.java:22, 30-32 + AlertServiceImpl.java:152-191
- performance.resource_allocation ← AlertServiceImpl.java:174-188, 190 + AlertManagerController.java:15-32
- performance.scaling_characteristics ← AlertManagerController.java:17-18 + AlertServiceImpl.java:152, 140-148
- performance.known_performance_gaps.[0] ← AlertManagerController.java:21-26 + AlertServiceImpl.java:152-191
- performance.known_performance_gaps.[1] ← AlertServiceImpl.java:174-188, 187
- performance.known_performance_gaps.[2] ← AlertManagerController.java:21-26 + AlertServiceImpl.java:152-191

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

## Maintainer notes


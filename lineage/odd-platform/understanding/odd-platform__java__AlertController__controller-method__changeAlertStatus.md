---
node_id: "odd-platform java AlertController controller-method:changeAlertStatus"
node_kind: controller-method
axis: controllers
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-08-04
---

# AlertController.changeAlertStatus — semantic understanding

## understanding

Reactive HTTP handler for `PUT /api/alerts/{alert_id}/status`: deserialises an `AlertStatusFormData` body (carrying a single `AlertStatus` enum value — `OPEN`, `RESOLVED`, or `RESOLVED_AUTOMATICALLY`), delegates to `AlertService.updateStatus(alertId, status)`, and returns the refreshed `Alert` resource as `200 OK`. The controller method is pure plumbing — three reactive operators (`flatMap` to unwrap the form-data Mono, `flatMap` to invoke the service, `map` to wrap the result in `ResponseEntity.ok`); all status-change semantics (re-open guard, activity-log emission, current-user resolution) live in `AlertServiceImpl.updateStatus`. The endpoint treats alert status as a settable property of the resource (PUT-on-resource), not as a discrete state-machine transition exposed via dedicated POST endpoints (e.g. `/resolve`, `/reopen`).

## concepts

- entities: [Alert, AlertStatus, AlertStatusFormData]
- operations: [change-alert-status, resolve-alert, reopen-alert]
- invariants:
  - "Body is a Mono<AlertStatusFormData> — the request body deserialisation is deferred until the reactor pipeline subscribes."
  - "The handler always returns 200 with the refreshed Alert; non-2xx outcomes (400 reopen-conflict, 404 alert-missing) are propagated as errors from AlertServiceImpl, not constructed in the controller."
  - "The set of legal status values is closed — only the three enum members of AlertStatus."
- audiences: [odd-platform-ui (alerts.thunks.ts:78 calls changeAlertStatus), human operators triaging alerts via the UI]

## dependencies_semantic

- requires-feature:
  - "AlertService bean — the Spring service that owns the per-alert status mutation, current-user lookup, and reopen guard."
  - "OpenAPI-generated AlertApi interface — the controller is a default-method override; HTTP method, path, content-types, and parameter binding all come from AlertApi."
- requires-config: []
- requires-runtime:
  - "Spring WebFlux (RestController + reactive Mono pipeline)."
  - "Reactor Core (Mono.flatMap / map composition)."
- coupling:
  - "Authorization: AlertController carries no @PreAuthorize / hasPermission annotation (verified — grep over the controller package returned no matches). Any access control must be enforced at a different layer (SecurityWebFilterChain / WebFilter)."

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - "PUT happy-path: caller sends RESOLVED, controller returns 200 with refreshed Alert."
  - "Reopen-conflict path: caller sends OPEN while another OPEN alert of the same type exists for the same data entity → 400 BadUserRequestException (AlertServiceImpl.java:128-129)."
  - "Not-found path: alertId does not resolve → NotFoundException (AlertServiceImpl.java:120)."
  - "Activity-log emission: ALERT_STATUS_UPDATED is recorded with the alertId (AlertServiceImpl.java:112-113)."
- test_files: []
- gaps: |
    No controller, service, or repository test exercises updateStatus / changeAlertStatus.
    The two existing Alert-named tests cover unrelated surfaces:
    - AlertMapperTest.java (DTO mapping only)
    - AlertIngestionTest.java (ingestion-side alert generation, not user status changes)
    The reopen-guard at AlertServiceImpl.java:124-131 is the most likely regression
    site: a refactor that re-orders the openAlertWithTheSameTypeExistsForDataEntity
    check or moves the `if (AlertStatusEnum.OPEN == status)` branch could silently
    permit duplicate OPEN alerts on the same data entity.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/developer-guides/api-reference/alerts"
    anchor: ""
    rationale: "API-reference page for the alert tag — the natural canonical home for the PUT /api/alerts/{alert_id}/status endpoint."
    last_verified_at: "2026-05-08T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      "Resolve, auto-mark, or manually reopen an alert. Body: AlertStatusFormData carrying the target AlertStatus enum value."

      "Setting the status back to OPEN is rejected with 400 Bad Request and the
      message 'Cannot reopen alert since the system already has an open alert of
      the same type' if another alert of the same type is already open on the
      same data entity."

      "Resolve or work the newer alert first, or leave the older one closed.
      The guard is enforced in AlertServiceImpl.updateStatus(...) (see
      AlertServiceImpl.java:124-131)."
  - url: "https://docs.opendatadiscovery.org/active-platform-features/alerting"
    anchor: ""
    rationale: "Feature-overview candidate for alerting; would normally describe the UI flow that calls this endpoint."
    last_verified_at: "2026-05-08T00:00:00Z"
    last_verified_status: 404
    confidence: LOW
    fetched_excerpts: |
      Page returns 404 (H1: "Page Not Found"). The feature-overview page for
      alerting at this URL does not exist on the live site as of the verified
      timestamp.
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization"
    anchor: ""
    rationale: "Canonical authorization-vocabulary page — verified live to confirm Policies / Permissions / Roles / Owners / User-owner association are the correct ODD terms used in the security block of this sidecar."
    last_verified_at: "2026-05-08T00:00:00Z"
    last_verified_status: 200
    confidence: HIGH
    fetched_excerpts: |
      "Five core components: Policies (JSON-schema-defined fine-grained access
      control), Permissions (mechanisms for controlling what actions users can
      perform), Roles (groupings that assign permissions to users), Owners
      (entities with designated responsibility or access rights), User-owner
      association (the linking mechanism between users and owners)."

      Live page contains NO mention of alerts, alert-status changes, or any
      controller / endpoint / @PreAuthorize annotation — the authorization
      framework page documents the model in the abstract. Per-endpoint
      authorization wiring (or its absence) is not surfaced on the live docs.
- doc_drift_findings:
  - "The /developer-guides/api-reference/alerts page accurately documents the reopen-guard text and cites AlertServiceImpl.java:124-131 — code and doc are in sync at the verified commit."
  - "The /active-platform-features/alerting URL is a 404 on the live site; the alerting feature has API-reference coverage but the user-facing feature page is missing or lives at a different URL. Worth a separate doc-gap finding (out of scope for this sidecar)."
  - "The /configuration-and-deployment/enable-security/authorization page describes the Policies/Permissions/Roles/Owners model in the abstract but never says which endpoints (or which controllers) are gated by which Permission. An operator reading the docs cannot determine that changeAlertStatus has no controller-layer authorization — they would have to read the source. This is a doc-gap (out of scope for this sidecar) and the substrate for the security.known_security_gaps entry below."

## implicit_adrs

- "Alert status is modelled as a settable resource property (PUT on /api/alerts/{alert_id}/status with the target enum), not as discrete state-machine transitions exposed via dedicated endpoints (e.g. POST /api/alerts/{alert_id}/resolve, POST /api/alerts/{alert_id}/reopen)." — evidence: AlertController.java:21-27 (PUT verb, single endpoint, body is target status) + openapi.yaml:2681-2702 (single PUT operation under /api/alerts/{alert_id}/status with no peer transition endpoints). — confidence: HIGH
- "The reopen-conflict business rule is owned by the service layer, not the controller — `AlertServiceImpl.updateStatus` enforces it before re-running the update." — evidence: AlertController.java:24-26 (controller is pure flatMap delegation) + AlertServiceImpl.java:124-131 (the `if (AlertStatusEnum.OPEN == status)` branch with `openAlertWithTheSameTypeExistsForDataEntity` + BadUserRequestException). — confidence: HIGH
- "The set of legal alert statuses is a closed enum, not an open string — clients cannot introduce new states without an OpenAPI change." — evidence: AlertStatus.java:24-30 (enum with three members) + components.yaml:2340-2345 (string enum with three values). — confidence: HIGH
- "Authorization for changeAlertStatus is not enforced at the controller-method layer — there is no @PreAuthorize or hasPermission annotation on AlertController or its method overrides." — evidence: AlertController.java:1-58 (no security annotations) + grep over the controller directory returned no @PreAuthorize / hasPermission matches. — confidence: HIGH

## bugs_limitations_corner_cases

- "Reopen-guard error path returns the literal string 'Cannot reopen alert since the system already has an open alert of the same type' — operators reading the UI error message will see this verbatim. There is no localisation hook on this string." — evidence: AlertServiceImpl.java:128-129. — severity: LOW
- "If an alert exists but `authIdentityProvider.getCurrentUser()` resolves to empty (anonymous / system-context), the update still proceeds with `username=null` (the second `switchIfEmpty` branch). This is intentional for non-interactive callers but means status_updated_by may be null in the persisted row even when the request reached the controller through the user-facing API path." — evidence: AlertServiceImpl.java:117-119 (`switchIfEmpty(alertRepository.updateAlertStatus(alertId, status, null))`). — severity: MEDIUM
- "No controller-method-level authorization (no @PreAuthorize, no policy guard). If the SecurityWebFilterChain is mis-configured or a deployment exposes the API without auth, any caller who can reach the endpoint can mutate any alert's status. The reopen guard is a data-integrity check, not an access-control check." — evidence: AlertController.java:1-58 (no security annotations) + grep across controller directory (no @PreAuthorize matches). — severity: MEDIUM
- "The activity-log emission is bound to `updateStatus` via the @ActivityLog AOP annotation in the service (`AlertServiceImpl.java:112`). If a future refactor calls `alertRepository.updateAlertStatus` directly (bypassing the service method), the activity log will silently stop recording status changes for that path." — evidence: AlertServiceImpl.java:112-113 (`@ActivityLog(event = ALERT_STATUS_UPDATED)` is on the service method, not the repository). — severity: LOW

## security

- auth_mode_relevance: LOGIN_FORM | OAUTH2 | LDAP
  - "PUT-on-resource handler exposed under the /api/alerts UI/API surface — the same surface protected by SecurityWebFilterChain when auth.type ∈ {LOGIN_FORM, OAUTH2, LDAP}. DISABLED skips auth entirely (would also reach this code) but is dev-only per the live docs at /configuration-and-deployment/enable-security. S2S applies only to /ingestion/entities — not relevant here." — evidence: AlertController.java:11 (@RestController on /api path) + AlertController.java:1-58 (no auth annotations of any kind, so the chain decides admission).
- ingestion_filter_relevance: "NO — UI/API surface, not ingestion. The IngestionDataEntitiesFilter only registers on POST /ingestion/entities; PUT /api/alerts/{alert_id}/status is outside that path matcher."
- authorization_assertions: []
  - "AlertController.changeAlertStatus has @Override only (line 20) — no @PreAuthorize, no programmatic permissionService.hasPermission call. Grep over the controller package and over AlertServiceImpl returned zero @PreAuthorize / hasPermission / Policy / Permission-check call sites for this code path. The downstream service method (AlertServiceImpl.updateStatus, lines 111-136) carries @Override + @ActivityLog only — no authorization gate. Authorization for this endpoint, if any, lives entirely at SecurityWebFilterChain admission (i.e. is-the-caller-authenticated, not has-the-caller-permission-on-this-alert)." — evidence: AlertController.java:20-27 + AlertServiceImpl.java:111-136 + grep over odd-platform-api/src/main/java/.../controller and .../service for @PreAuthorize / hasPermission (zero matches on alert paths).
- owner_scoping: "BYPASSES — service does not check the caller owns the alert or its referenced data entity. AlertServiceImpl.updateStatus accepts the alertId verbatim from the request and writes through to alertRepository.updateAlertStatus(alertId, status, username). The username is recorded as an audit field (status_updated_by), not consulted as an authorization check. Compare to AlertServiceImpl.listByOwner (line 83-87) which explicitly filters by authIdentityProvider.fetchAssociatedOwner() — the read path implements owner-scoping; the mutation path does not." — evidence: AlertServiceImpl.java:111-136 (no owner check) + AlertServiceImpl.java:83-87 (the owner-scoped read pattern that the mutation path does NOT mirror).
- data_exposure:
  - "Alert payload (id, status, lastReason, severity, dataEntity ref, owners) → any authenticated user under LOGIN_FORM/OAUTH2/LDAP, no owner filter applied at controller or service layer; under DISABLED, any caller able to reach the port." — evidence: AlertController.java:21 (return type Mono<ResponseEntity<Alert>>) + AlertServiceImpl.java:121-122 (returns alertRepository.get(alertId) mapped via alertMapper, no field redaction).
  - "AOP-bound activity-log entry: ActivityEventTypeDto.ALERT_STATUS_UPDATED row is persisted with the alertId (via @ActivityParameter(AlertStatusUpdated.ALERT_ID)) and the resolved username (or null) — read-back of activity records exposes status-change history with the actor identity to whoever can read activity. Coupling is fragile: if a future refactor bypasses the service method (calls alertRepository.updateAlertStatus directly), audit silently disappears." — evidence: AlertServiceImpl.java:111-118 (@ActivityLog + @ActivityParameter on the service method only).
- known_security_gaps:
  - "changeAlertStatus has no @PreAuthorize and no programmatic permission check at controller or service layer; under LOGIN_FORM/OAUTH2/LDAP any authenticated user can mutate any alert's status (including across owners they have no association with) by submitting a request with a known alertId. The reopen guard is a data-integrity check, not access control. The Policies/Permissions/Roles/Owners framework documented at /configuration-and-deployment/enable-security/authorization is not applied to this endpoint." — evidence: AlertController.java:1-58 + AlertServiceImpl.java:111-136 + WebFetch /enable-security/authorization (live page describes the framework in the abstract; never names this endpoint as protected). — severity: HIGH
  - "Under auth.type=DISABLED the endpoint is reachable by any caller who can reach the application port — no fail-closed behaviour at the controller. Per the live docs, DISABLED is dev-only, but a production deployment that mis-sets auth.type would expose alert mutation to anonymous traffic." — evidence: AlertController.java:1-58 (no fail-closed annotation) + WebFetch /configuration-and-deployment/enable-security (auth.type modes documented, DISABLED noted as dev). — severity: LOW (gated on dev-only deployment guidance being followed).

## performance

- hot_paths:
  - "changeAlertStatus on its own is a single-item PUT — not a hot path on a typical UI. The downstream effect IS hot: a status change to OPEN can trigger a notification chain over the data-entity dependency graph (downstream-entities-depth notifications), which scans dependent entities at write time." — evidence: AlertController.java:21-27 (single Mono pipeline, no batching) + AlertServiceImpl.java:111-136 (the mutation path; notification fan-out is wired via separate listeners on ActivityEventTypeDto.ALERT_STATUS_UPDATED, not in this method).
  - "@ActivityLog AOP intercept fires synchronously on the reactive pipeline — adds an activity-row INSERT in the same transaction window as the alert status update for every call." — evidence: AlertServiceImpl.java:112 (@ActivityLog(event = ALERT_STATUS_UPDATED)).
- throughput_characteristics:
  - "Single-item PUT per status change — no bulk-update endpoint on the AlertApi surface (no POST /api/alerts/status/bulk or equivalent)."
  - "Reactive Mono signature — non-blocking on the request thread, but the work is still per-call: one DB read (existence + reopen-conflict check when status=OPEN), one DB write (updateAlertStatus), one DB read (refresh), one activity-row INSERT (AOP)."
  - "When status=OPEN, an additional DB round-trip runs first: alertRepository.openAlertWithTheSameTypeExistsForDataEntity(alertId) — adds latency proportional to the alert+data-entity index lookup before the write." — evidence: AlertServiceImpl.java:124-131.
- resource_allocation:
  - "Per-call cost: 1 DB read for current-user resolution (authIdentityProvider.getCurrentUser → user/owner repository), 1 conditional reopen-conflict DB read (only when status=OPEN), 1 DB write (alert status), 1 DB read (refresh + map), 1 DB write (activity row via @ActivityLog AOP). All on the same reactive transaction context (@ReactiveTransactional is class-level on AlertServiceImpl)." — evidence: AlertServiceImpl.java:111-136 + AlertServiceImpl.java:22 (ReactiveTransactional import) + AlertServiceImpl.java:117-122.
  - "No outbound HTTP, no in-memory accumulation of large structures, no streaming. Memory pressure is bounded by the single Alert payload size."
- scaling_characteristics:
  - "Stateless controller — instances scale horizontally."
  - "No row-level lock or advisory lock — updateAlertStatus is a regular UPDATE; concurrent status changes to the same alertId race on last-writer-wins. The reopen-conflict check (when status=OPEN) is not transactionally fenced against a concurrent OPEN of a sibling alert: two simultaneous OPEN requests for two different alert ids of the same type on the same data entity could both pass the existence check and both succeed, briefly violating the 'one OPEN of the same type per data entity' invariant." — evidence: AlertServiceImpl.java:124-132 (handle/then composition reads-then-writes without an explicit lock or constraint-backed UPSERT).
  - "No pagination concern on this endpoint (single-item PUT)."
- known_performance_gaps:
  - "No bulk-status-change endpoint — operators triaging many alerts (e.g. resolving an entire batch after a deploy) issue N PUT requests, paying N × (auth lookup + 2-3 DB reads + 2 DB writes + 1 activity-row INSERT). For 100+ alerts this is hundreds of round-trips where one bulk operation could resolve them in a single transaction." — evidence: AlertController.java:21-27 (no peer bulk endpoint) + AlertApi.java surface (single changeAlertStatus method, no batch sibling). — severity: LOW (UX nuisance, not a runtime hotspot).
  - "Reopen-conflict check is read-then-write without a serialisable fence — two concurrent OPEN requests for sibling alerts on the same data entity can both pass the guard. The data-integrity invariant ('one OPEN alert of the same type per data entity') is not transactionally enforced." — evidence: AlertServiceImpl.java:124-132 (handle()/then() composition; no advisory lock, no SELECT … FOR UPDATE, no DB unique constraint backing the invariant). — severity: MEDIUM.
  - "@ActivityLog AOP coupling: the activity-row INSERT runs on every call regardless of whether the status actually changed (e.g. RESOLVED → RESOLVED is still logged). Cheap per call, but contributes to activity-table growth proportional to call count, not state-change count." — evidence: AlertServiceImpl.java:112-113 (@ActivityLog with no idempotency / no-op short-circuit). — severity: LOW.

## sources

- understanding ← AlertController.java:20-27 + AlertServiceImpl.java:111-136 + components.yaml:2340-2351
- concepts.entities.Alert ← AlertController.java:5
- concepts.entities.AlertStatus ← AlertStatus.java:24-30
- concepts.entities.AlertStatusFormData ← AlertStatusFormData.java:24
- concepts.invariants.[0] ← AlertController.java:22 (`final Mono<AlertStatusFormData> alertStatusFormData`)
- concepts.invariants.[1] ← AlertController.java:24-26 (single `.map(ResponseEntity::ok)`)
- concepts.invariants.[2] ← AlertStatus.java:24-30 (closed enum)
- dependencies_semantic.requires-feature.[0] ← AlertController.java:9 + AlertController.java:18
- dependencies_semantic.requires-feature.[1] ← AlertController.java:4 + AlertController.java:17 (`implements AlertApi`) + AlertApi.java:53-74
- dependencies_semantic.requires-runtime.[0] ← AlertController.java:11 (@RestController) + AlertController.java:13 (Mono import)
- dependencies_semantic.coupling ← AlertController.java:1-58 (no security annotations) + grep over controller directory
- tests_coverage_semantic ← absence of any test file matching changeAlertStatus / updateStatus across odd-platform-api/src/test (verified via find + grep)
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/developer-guides/api-reference/alerts (status 200, 2026-05-08)
- docs_link_semantic.inferred_docs.[1] ← WebFetch https://docs.opendatadiscovery.org/active-platform-features/alerting (status 404, 2026-05-08)
- docs_link_semantic.inferred_docs.[2] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization (status 200, 2026-05-08)
- implicit_adrs.[0] ← AlertController.java:21-27 + openapi.yaml:2681-2702
- implicit_adrs.[1] ← AlertController.java:24-26 + AlertServiceImpl.java:124-131
- implicit_adrs.[2] ← AlertStatus.java:24-30 + components.yaml:2340-2345
- implicit_adrs.[3] ← AlertController.java:1-58 (file end-to-end, no @PreAuthorize)
- bugs_limitations_corner_cases.[0] ← AlertServiceImpl.java:128-129
- bugs_limitations_corner_cases.[1] ← AlertServiceImpl.java:117-119
- bugs_limitations_corner_cases.[2] ← AlertController.java:1-58 (no security annotations)
- bugs_limitations_corner_cases.[3] ← AlertServiceImpl.java:112-113
- security.auth_mode_relevance ← AlertController.java:11 (@RestController) + AlertController.java:1-58 (no auth annotations) + WebFetch /configuration-and-deployment/enable-security/authorization (200)
- security.ingestion_filter_relevance ← AlertController.java:21 (path is /api/alerts, not /ingestion/entities)
- security.authorization_assertions ← AlertController.java:20-27 + AlertServiceImpl.java:111-136 + grep over controller + service for @PreAuthorize/hasPermission (zero matches on alert paths)
- security.owner_scoping ← AlertServiceImpl.java:111-136 (no owner filter) + AlertServiceImpl.java:83-87 (the owner-scoped read pattern as comparator)
- security.data_exposure.[0] ← AlertController.java:21 + AlertServiceImpl.java:121-122
- security.data_exposure.[1] ← AlertServiceImpl.java:111-118 (@ActivityLog + @ActivityParameter)
- security.known_security_gaps.[0] ← AlertController.java:1-58 + AlertServiceImpl.java:111-136 + WebFetch /configuration-and-deployment/enable-security/authorization
- security.known_security_gaps.[1] ← AlertController.java:1-58 + WebFetch /configuration-and-deployment/enable-security
- performance.hot_paths.[0] ← AlertController.java:21-27 + AlertServiceImpl.java:111-136
- performance.hot_paths.[1] ← AlertServiceImpl.java:112
- performance.throughput_characteristics ← AlertController.java:21-27 + AlertServiceImpl.java:117-132 + AlertApi.java surface
- performance.resource_allocation ← AlertServiceImpl.java:22 + AlertServiceImpl.java:111-136
- performance.scaling_characteristics ← AlertServiceImpl.java:124-132
- performance.known_performance_gaps.[0] ← AlertController.java:21-27 + AlertApi.java surface
- performance.known_performance_gaps.[1] ← AlertServiceImpl.java:124-132
- performance.known_performance_gaps.[2] ← AlertServiceImpl.java:112-113

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: MEDIUM

## Maintainer notes

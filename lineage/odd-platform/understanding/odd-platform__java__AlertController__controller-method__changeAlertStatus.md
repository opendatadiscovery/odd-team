---
node_id: "odd-platform java AlertController controller-method:changeAlertStatus"
node_kind: controller-method
axis: controllers
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.1.0
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
- doc_drift_findings:
  - "The /developer-guides/api-reference/alerts page accurately documents the reopen-guard text and cites AlertServiceImpl.java:124-131 — code and doc are in sync at the verified commit."
  - "The /active-platform-features/alerting URL is a 404 on the live site; the alerting feature has API-reference coverage but the user-facing feature page is missing or lives at a different URL. Worth a separate doc-gap finding (out of scope for this sidecar)."

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
- implicit_adrs.[0] ← AlertController.java:21-27 + openapi.yaml:2681-2702
- implicit_adrs.[1] ← AlertController.java:24-26 + AlertServiceImpl.java:124-131
- implicit_adrs.[2] ← AlertStatus.java:24-30 + components.yaml:2340-2345
- implicit_adrs.[3] ← AlertController.java:1-58 (file end-to-end, no @PreAuthorize)
- bugs_limitations_corner_cases.[0] ← AlertServiceImpl.java:128-129
- bugs_limitations_corner_cases.[1] ← AlertServiceImpl.java:117-119
- bugs_limitations_corner_cases.[2] ← AlertController.java:1-58 (no security annotations)
- bugs_limitations_corner_cases.[3] ← AlertServiceImpl.java:112-113

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH

## Maintainer notes

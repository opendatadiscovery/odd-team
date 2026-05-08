---
node_id: "odd-platform java org.opendatadiscovery.oddplatform.controller controller:AlertController"
node_kind: controller
axis: controllers
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.1.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-08-01
---

# AlertController — semantic understanding

## understanding

`AlertController` is a thin Spring WebFlux REST controller that implements the OpenAPI-generated `AlertApi` interface and exposes five reactive endpoints under `/api/alerts*` for the platform's alerting feature. Each method delegates a single call to `AlertService` and lifts the result into a `200 OK` `ResponseEntity`; no request validation, authorisation, exception translation, or visibility filtering happens at the controller layer. Visibility scoping ("my alerts" vs "dependent-entity alerts" vs "all alerts") is therefore a service-and-database concern (`AlertService.listAll` / `listByOwner` / `listDependentObjectsAlerts`), not a controller concern. This pattern — a near-empty controller class whose HTTP method/path/produces/consumes annotations live on the generated `*Api` interface, not on the controller — is repository-wide convention.

## concepts

- entities: [`Alert`, `AlertList`, `AlertStatusFormData`, `AlertTotals`]
- operations: [
    `list-all-alerts` (paged),
    `list-current-user's-owned-alerts` (paged),
    `list-current-user's-dependent-entity-alerts` (paged),
    `get-alert-totals` (counts across the three tab scopes),
    `change-alert-status` (resolve/reopen via `AlertStatusFormData`)
  ]
- invariants: [
    "Every endpoint is reactive (`Mono<ResponseEntity<...>>`); response is always `200 OK` on a successful service emission — non-200 responses must be raised by the service layer or by global error handlers",
    "Pagination parameters are required `Integer page` + `Integer size`; the controller does not validate them — `@NotNull` constraint lives on the generated interface (AlertApi.java:153-154 et al.)",
    "Alert visibility is NOT enforced at the controller; `listByOwner` and `listDependentObjectsAlerts` rely on the authenticated principal being resolved inside the service/repository chain"
  ]
- audiences: [
    "ODD Platform UI — `Alerts` navigation pane and per-entity Alerts tabs (per live doc page, see `documents.declared_docs[]`)",
    "API consumers building integrations against `/api/alerts*`"
  ]

## dependencies_semantic

- requires-feature: [
    "alerting feature (live doc: `https://docs.opendatadiscovery.org/features/active-platform-features/alerting.md`)",
    "user→owner association (Owner-link) — without it, `listByOwner` and `listDependentObjectsAlerts` return empty per the live doc's claim 'The `My Objects` and `Dependents` tabs are hidden unless the signed-in user is linked to an Owner'"
  ]
- requires-config: [] (controller itself reads no config keys)
- requires-runtime: [
    "Spring WebFlux runtime — `Mono<ResponseEntity<...>>` return type and `ServerWebExchange` parameter (AlertController.java:13, 23, 30, 37-38, 45-46, 53-54)",
    "Reactive authentication context — `listByOwner` / `listDependentObjectsAlerts` need the current principal, which is propagated through the reactor `Context` chain rather than via a controller-method parameter"
  ]
- couples-to: [
    "`AlertApi` (auto-generated from `odd-platform-specification/openapi.yaml`) — supplies all `@RequestMapping` HTTP method/path/media-type metadata; method signatures here must match exactly or the `@Override` compiles fail",
    "`AlertService` (interface) — the only collaborator; constructor-injected via Lombok `@RequiredArgsConstructor` (AlertController.java:16, 18)"
  ]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours: [
    "HTTP-level smoke test that each of the five endpoints actually wires through Spring WebFlux to the service (no `WebTestClient` test currently exists for AlertController)",
    "Negative-path test: behaviour when an unauthenticated request hits `/api/alerts/my` — does the request reach `AlertService.listByOwner` or is it rejected by a security filter higher in the chain? Currently undetermined from this file alone",
    "Pagination boundary tests (page=0, size=0, very large size) at the controller boundary"
  ]
- test_files: [] — N/A (no AlertController-specific test files found via `find odd-platform -path '*test*' -name 'AlertController*'`; service-layer tests for AlertServiceImpl, if any, would not exercise the controller's request-mapping wiring)
- gaps: |
    The controller class is trivial enough (5 one-line delegations) that a unit test of its own logic would test nothing. The real coverage gap is at the integration-test boundary: there is no `@WebFluxTest(AlertController.class)` or `WebTestClient`-driven test asserting that the OpenAPI-generated request mappings are actually picked up by the runtime, that the JSON `AlertStatusFormData` payload deserialises, and that the path variable `alert_id` binds to `Long alertId`. A regression in the OpenAPI generator template, in the `application.yaml` web-mvc-vs-webflux config, or in a Jackson configuration change could silently break all five endpoints with no current test catching it.

## docs_link_semantic

- declared_docs: [] — N/A (the source file carries no `@docs` Javadoc annotation; per slice 6 plan in CLAUDE.md surrounding context, `@docs` annotations have not yet been bootstrapped in this repo)
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/active-platform-features/alerting.md"
    anchor: "" (whole page)
    rationale: "Single live page describing the alerting feature this controller serves; the page describes the three tab scopes (`All` / `My Objects` / `Dependents`) that map 1:1 onto the controller's `getAllAlerts` / `getAssociatedUserAlerts` / `getDependentEntitiesAlerts` methods, plus alert status transitions handled by `changeAlertStatus`"
    last_verified_at: "2026-05-08T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      Section "Alert views — All, My Objects, Dependents":
      - "All — Every open and resolved alert across the whole platform"
      - "My Objects — Alerts raised on data entities where the signed-in user is a registered owner"
      - "Dependents — Alerts raised on data entities that are downstream of entities the signed-in user owns (via lineage)"
      - "The `My Objects` and `Dependents` tabs are hidden unless the signed-in user is linked to an Owner — without the association, the platform cannot evaluate 'mine' or 'downstream of mine.'"
      Section "Alert lifecycle: statuses, resolution, cleanup":
      - Statuses table: `OPEN` (set by Platform at creation), `RESOLVED` (Operator via manual action), `RESOLVED_AUTOMATICALLY` (Platform when condition clears).
  - url: "https://docs.opendatadiscovery.org/developer-guides/api-reference/alerts"
    anchor: ""
    rationale: "API-reference page for the `/api/alerts*` endpoints this controller exposes; verified live and enumerates every endpoint method/path that AlertController implements"
    last_verified_at: "2026-05-08T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      Page sections include "Global alert listings", "Alert status mutation", and "Per-entity halt-notification configuration".
      Endpoint enumeration on the live page:
      - `GET /api/alerts` — retrieves all platform alerts
      - `GET /api/alerts/my` — user-owned entity alerts only
      - `GET /api/alerts/dependents` — downstream entity alerts
      - `GET /api/alerts/totals` — open alert counts by tab
      - `PUT /api/alerts/{alert_id}/status` — resolve/reopen alerts with guard
      Critical behaviour quoted on the page: "Manual reopen is rejected with `400 Bad Request`" if an open alert of the same type already exists on that entity.
- doc_drift_findings:
  - "Both candidate doc URLs supplied in the input prompt (`/active-platform-features/alerting` and `/developer-guides/api-reference/alerts`) need verification against the live URL prefix; the alerting page's actual live URL is `/features/active-platform-features/alerting.md` — the URL without the `/features/` prefix returns 404 with a 'Page Not Found' redirect notice. Any internal cross-link in the codebase or sibling docs that uses the un-prefixed `/active-platform-features/alerting` path is broken. Severity: needs a separate doc-drift backlog item; not in scope of this controller sidecar to fix."
  - "Live api-reference/alerts page describes 'Manual reopen is rejected with `400 Bad Request`' for `PUT /api/alerts/{alert_id}/status`, but the controller method `changeAlertStatus` (AlertController.java:21-27) does not enforce or surface this — the rejection logic must live in `AlertService.updateStatus` (AlertService.java:24). The doc claim is therefore a service-layer behaviour described as if it were API-surface behaviour; from this controller's source file alone, the claim is unverifiable. A reviewer enriching `AlertServiceImpl` is required to validate this claim against the service code before propagating it."

## implicit_adrs

- "Controllers in this repository are pass-through delegates; HTTP method/path/produces/consumes mappings live on OpenAPI-generator-produced `*Api` interfaces, NOT on the `*Controller` class itself. Controllers carry only `@RestController` + `@RequiredArgsConstructor` and `@Override` on each method." — evidence: AlertController.java:15-17 (only `@RestController` and `@RequiredArgsConstructor` on the class; no `@RequestMapping`, `@GetMapping`, `@PutMapping`, etc. anywhere in the file) + AlertApi.java:64-69, 106-110, 147-151, 190-194 (each method on the interface carries the full `@RequestMapping(method = ..., value = "/api/alerts/...", produces = ..., consumes = ...)` block) — confidence: HIGH
- "Authorisation / visibility filtering for alerts is a service-layer concern, not a controller-layer concern. The controller carries no `@PreAuthorize`, no `@Secured`, and does not reference any authentication context object — the burden of resolving 'who is the current user, and what scope of alerts can they see' is delegated entirely to `AlertService` and below." — evidence: AlertController.java:1-58 (entire file — no security annotations or imports of Spring Security types) + AlertService.java:18-32 (the interface advertises both `listAll` and `listByOwner` / `listDependentObjectsAlerts` without taking a principal argument, implying principal resolution happens inside via reactor Context) — confidence: HIGH
- "Reactive endpoints expose a uniform `Mono<ResponseEntity<T>>` return type and use a single `.map(ResponseEntity::ok)` to lift the result; no exception translation or status-code branching is done at the controller. Non-200 responses are produced exclusively by service-thrown exceptions hitting a global Spring exception handler, or by service-emitted `Mono.error(...)` signals." — evidence: AlertController.java:21-57 (every method ends with `.map(ResponseEntity::ok)`; no `.onErrorResume`, no `.switchIfEmpty(Mono.just(ResponseEntity.notFound()...))`, no try/catch) — confidence: HIGH

## bugs_limitations_corner_cases

- "No controller-level smoke / WebFluxTest exists for AlertController. A breaking change to the OpenAPI generator template, the WebFlux configuration, or the Jackson serialiser config could silently break all five `/api/alerts*` endpoints with the build still passing. The smallest reproducer that would catch this is a single `@WebFluxTest(AlertController.class)` test asserting one `WebTestClient.get().uri('/api/alerts?page=1&size=10').exchange().expectStatus().isOk()` per endpoint." — evidence: `find odd-platform -path '*test*' -name 'AlertController*'` returned no matches — severity: MEDIUM
- "`getAllAlerts` exposes EVERY alert across the whole platform (per the live doc's `All` tab description) without any role / permission gating in this controller. If the platform is multi-tenant or has a 'restricted operator' role concept (the policy / role surfaces under `/api/policies` and `/api/roles` in this repo suggest it does), then `GET /api/alerts` is a privilege boundary that depends entirely on enforcement happening below the controller. From this file alone, that enforcement is invisible. The next reviewer must validate access control by reading `AlertServiceImpl` and the Spring Security filter chain configuration before any sidecar claims the endpoint is access-controlled." — evidence: AlertController.java:35-41 (no security annotations, raw delegation to `alertService.listAll`) — severity: MEDIUM
- "The `changeAlertStatus` endpoint accepts `AlertStatusFormData` and emits an `Alert` on success, but the live api-reference/alerts page describes 'Manual reopen is rejected with `400 Bad Request`' as a behaviour of `PUT /api/alerts/{alert_id}/status`. The controller does no error mapping (AlertController.java:21-27) — a `400` here would have to be raised inside `AlertService.updateStatus` and propagated through the reactive chain. If a future refactor moves the rejection logic out of the service into a `@ControllerAdvice` or a validation annotation on the form-data type, any current integration test asserting `400` from the controller boundary will need updating." — evidence: AlertController.java:21-27 + live doc fetched_excerpt above — severity: LOW

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` — these are the three modes that protect the UI/API surface this controller is mounted on. `DISABLED` skips authentication entirely (no fail-closed behaviour: every endpoint becomes anonymously reachable). `S2S` is NOT relevant — S2S protects only the ingestion path (`POST /ingestion/entities`), not `/api/alerts*`. The controller class itself carries NO `@ConditionalOnProperty` (it is always wired regardless of `auth.type`); the auth wiring lives in `LoginFormSecurityConfiguration.java:31` (`@ConditionalOnProperty(value = "auth.type", havingValue = "LOGIN_FORM")`), `OAuthSecurityConfiguration.java:71` (`havingValue = "OAUTH2"`), `LDAPSecurityConfiguration.java:51` (`havingValue = "LDAP"`), and `DisabledAuthSecurityConfiguration.java:10` (`havingValue = "DISABLED"`).
- **ingestion_filter_relevance**: `NO — UI/API surface, not /ingestion/entities`. The `IngestionDataEntitiesFilter` is mounted via `new PathPatternParserServerWebExchangeMatcher("/ingestion/entities", HttpMethod.POST)` (IngestionDataEntitiesFilter.java:28) — `/api/alerts*` paths do not match. Per the live security doc (WebFetched 2026-05-08, status 200, `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security`): "ODD Platform has two independent authentication surfaces, each governed by its own configuration flag. Enabling one does not protect the other." This controller is on the UI/API surface; ingestion-filter posture is orthogonal.
- **authorization_assertions**: [] — `AlertController.java:1-58` carries no `@PreAuthorize`, no `@Secured`, no programmatic `permissionService.hasPermission(...)` call, and no `@PostFilter`. The generated `AlertApi` interface at `odd-platform-api-contract/build/generated/src/main/java/org/opendatadiscovery/oddplatform/api/contract/api/AlertApi.java` was grepped for `PreAuthorize | @Secured | @Authorize | hasPermission | hasRole` and returned no matches — the OpenAPI generator template emits no authorization annotations on the interface either. Authorization, if it exists, lives strictly in the service / repository layer (cf. `AlertService` interface signatures take no principal argument, so principal resolution must occur via reactor `Context` propagation inside the implementation).
- **owner_scoping**: `BYPASSES — returns data across owners (admin path)` for `getAllAlerts` (AlertController.java:35-41) — the method passes only `(page, size)` to `alertService.listAll`, no principal or owner filter, so under the live alerting doc's "All" tab description ("Every open and resolved alert across the whole platform") the endpoint emits ALL alerts regardless of caller's owner association. The `getAssociatedUserAlerts` (AlertController.java:43-49) and `getDependentEntitiesAlerts` (AlertController.java:51-57) endpoints DO conceptually respect owner scoping ("My Objects" / "Dependents" tabs per the live doc), but the controller itself does not wire a principal — it relies on `AlertService.listByOwner` / `listDependentObjectsAlerts` to resolve the current user via reactor `Context` and filter the repository query. Owner-scoping correctness is therefore a service-layer property; from the controller's source alone it is not enforceable, only delegable.
- **data_exposure**:
  - "Alert payload (id, status, lastReason, severity, dataEntity ref) → ANY authenticated user under LOGIN_FORM/OAUTH2/LDAP via `GET /api/alerts` — no role / permission gate at the controller; the endpoint emits all platform alerts regardless of caller's owners. Under DISABLED, this is reachable anonymously." — evidence: AlertController.java:35-41
  - "Alert payload (owner-scoped subset) → authenticated user under LOGIN_FORM/OAUTH2/LDAP via `GET /api/alerts/my` and `GET /api/alerts/dependents` — scope correctness depends on `AlertService.listByOwner` / `listDependentObjectsAlerts` correctly resolving the principal and applying the owner filter; not enforceable from the controller layer." — evidence: AlertController.java:43-57
  - "AlertTotals counts (open per tab) → ANY authenticated user via `GET /api/alerts/totals` — no role gating; same auth-mode-only protection as the listings." — evidence: AlertController.java:29-33
  - "Alert mutation (status change) → ANY authenticated user via `PUT /api/alerts/{alert_id}/status` — controller carries no permission check; any caller who can authenticate can transition any alert by id (validation logic, if any, lives inside `AlertService.updateStatus`)." — evidence: AlertController.java:20-27
- **known_security_gaps**:
  - "Controller has no `@PreAuthorize`; the generated `AlertApi` interface also has no authorization annotations (verified by grep on `AlertApi.java` for `PreAuthorize | @Secured | @Authorize | hasPermission | hasRole` — zero matches). All authorization for alerts must therefore be enforced in the service / repository layer via reactor `Context` principal resolution. From the controller boundary the access-control posture is INVISIBLE — a reviewer cannot confirm that `getAllAlerts` is admin-restricted (or even that it should be) without reading the service implementation and the security filter chain." — evidence: AlertController.java:1-58 + AlertApi.java grep result — severity: MEDIUM
  - "`getAllAlerts` returns the entire platform's alert stream to any authenticated user — there is no Permission / Role gate at the controller and no service-layer principal argument. If the platform's intent is that 'All' tab is admin-only (the live alerting doc does not state it is), the gap is a privilege-boundary leak under LOGIN_FORM/OAUTH2/LDAP. Under `auth.type=DISABLED` this becomes anonymous read of every alert in the system." — evidence: AlertController.java:35-41 + DisabledAuthSecurityConfiguration.java:10 (`auth.type=DISABLED` skips auth entirely) — severity: HIGH
  - "`changeAlertStatus` accepts a status mutation with no permission gate at the controller — any authenticated user can attempt to resolve / reopen any alert by id. Whether the service rejects unauthorized mutations is unverifiable from this file." — evidence: AlertController.java:20-27 — severity: MEDIUM
  - "Owner-scoped endpoints (`/my`, `/dependents`) take no principal parameter — they rely on the reactor `Context` carrying the authenticated principal through to `AlertService`. A regression in the WebFlux security filter chain (e.g. context propagation broken by a misordered `WebFilter`) would silently degrade `/my` and `/dependents` to either empty or unscoped output without any controller-layer alarm." — evidence: AlertController.java:43-57 + AlertService interface signatures take no principal — severity: MEDIUM

## performance

- **hot_paths**:
  - "`GET /api/alerts` (`getAllAlerts`) is a list endpoint that delegates to `alertService.listAll(page, size)` — the controller declares `Integer page, Integer size` parameters but does NOT validate them; the alerting feature's primary 'All' view fans out to this endpoint on every UI tab activation." — evidence: AlertController.java:35-41
  - "`GET /api/alerts/my` (`getAssociatedUserAlerts`) and `GET /api/alerts/dependents` (`getDependentEntitiesAlerts`) are list endpoints invoked on owner-scoped tab activations; each requires principal resolution via reactor `Context` PLUS an owner-filtered repository query — at minimum two DB round-trips (principal→owner association, then owners→alerts join)." — evidence: AlertController.java:43-57
  - "`GET /api/alerts/totals` runs on every alerts-page render to populate tab-count badges — typically three count queries (`All`, `My Objects`, `Dependents`) wrapped into a single `AlertTotals` payload; a hot path for the alerts UI but smaller fan-out than the list endpoints." — evidence: AlertController.java:29-33
- **throughput_characteristics**:
  - "All five endpoints are reactive `Mono<ResponseEntity<...>>` — non-blocking I/O; the uniform `.map(ResponseEntity::ok)` lifting pattern means no per-call thread is held during DB await." — evidence: AlertController.java:21, 30, 36, 44, 52 (all return `Mono<ResponseEntity<...>>`)
  - "Single-item operations only — no batch resolve / batch reopen / batch list endpoint. A consumer needing to resolve 100 alerts must issue 100 sequential `PUT /api/alerts/{alert_id}/status` calls; the controller offers no bulk API." — evidence: AlertController.java:20-27 (single `Long alertId` path variable; no bulk variant in the file)
  - "`getAllAlerts` / `getAssociatedUserAlerts` / `getDependentEntitiesAlerts` accept pagination parameters (`Integer page, Integer size`) — pagination IS plumbed through to the service, but the controller does not validate or constrain `size` (no `@Max` annotation visible in this file; the generated `AlertApi` interface carries `@NotNull @Valid` but no bound). A caller passing `size=1000000` is rate-limited only by what the service / repository accepts." — evidence: AlertController.java:36-38, 44-46, 52-54
- **resource_allocation**:
  - "Each Mono signature is non-blocking; per-call DB round-trip is delegated to `AlertService` — the controller itself allocates only the `ResponseEntity` wrapper and the reactive subscription. No per-request HTTP-client construction, no in-memory accumulation of alert lists, no caching at the controller layer." — evidence: AlertController.java:18 (single `AlertService` field, constructor-injected once) + AlertController.java:21-57 (no allocations beyond the service call and `ResponseEntity::ok`)
  - "Constructor-injected dependencies are singletons (`@RestController` + `@RequiredArgsConstructor` produces a Spring-managed singleton bean) — no per-request bean creation overhead." — evidence: AlertController.java:15-18
- **scaling_characteristics**:
  - "Stateless controller — no instance fields beyond the injected `AlertService`; horizontal scaling via instance count is unconstrained at the controller layer (any DB / reactor scheduler bottlenecks are downstream)." — evidence: AlertController.java:18 (only `final AlertService alertService` field)
  - "No locking, no advisory-lock acquisition, no in-memory queue — request handling is purely a reactive pipeline through to the service layer." — evidence: AlertController.java:1-58 (no `Lock`, `Semaphore`, `synchronized`, `AtomicReference`, or queue/buffer types)
  - "Pagination IS exposed on the three list endpoints, so per-request payload size is bounded by the caller-supplied `size` — but no upper bound enforced at the controller; an absent or malicious `size` value can produce arbitrarily large response bodies and arbitrary repository load." — evidence: AlertController.java:36-38, 44-46, 52-54 (no `@Max` / no clamping logic)
- **known_performance_gaps**:
  - "No upper bound on pagination `size` parameter at the controller — a caller passing `size=1000000` triggers a service-layer query bounded only by whatever (if any) limit `AlertServiceImpl` enforces; from this file alone the worst-case response body and DB cost are unbounded." — evidence: AlertController.java:36-38, 44-46, 52-54 — severity: MEDIUM
  - "No caching of `getAlertTotals` — every alerts-page render re-runs the three count queries; for high-traffic platforms with 10K+ alerts this becomes a per-page-load DB hit on three aggregations. The controller offers no `Cache-Control` header, no ETag, no in-memory cache." — evidence: AlertController.java:29-33 — severity: LOW
  - "No request-throughput observability at the controller layer — no `@Timed`, no Micrometer counter, no structured logging on entry/exit. Latency regressions on `/api/alerts*` would only be visible via downstream service / DB metrics, not the controller boundary." — evidence: AlertController.java:1-58 (no `@Timed`, no `MeterRegistry` field, no `Logger`) — severity: LOW
  - "Single-item-only `changeAlertStatus` — bulk operator workflows ('resolve all alerts on this entity', 'reopen all critical alerts') are forced into N round-trips. Not a bug, but a documented absence callers should know about before building integrations." — evidence: AlertController.java:20-27 (single `alertId` path variable; no bulk variant) — severity: LOW

## sources

- understanding ← AlertController.java:1-58 (full file; the four-sentence claim mirrors the file's actual shape — five one-line delegating methods, no annotations beyond `@RestController` + `@RequiredArgsConstructor` + `@Override`)
- concepts.entities ← AlertController.java:5-8 (imports of `Alert`, `AlertList`, `AlertStatusFormData`, `AlertTotals`)
- concepts.operations ← AlertController.java:21, 30, 36, 44, 52 (one operation per method)
- concepts.invariants[0] ← AlertController.java:21, 30, 36, 44, 52 (every method returns `Mono<ResponseEntity<...>>`) + AlertController.java:26, 32, 40, 48, 56 (every method's terminal operator is `.map(ResponseEntity::ok)`)
- concepts.invariants[1] ← AlertController.java:36-38, 44-46, 52-54 (page/size declared as plain `Integer`, no `@Min` or `@NotNull`) + AlertApi.java:153-154 (the generated interface carries `@NotNull @Parameter(... required = true) @Valid @RequestParam`)
- concepts.invariants[2] ← AlertController.java:1-58 (no `@PreAuthorize`/`@Secured`/imports of Spring Security) + AlertService.java:18-32 (no principal parameter)
- concepts.audiences ← WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/alerting.md` (status 200, 2026-05-08) — fetched excerpt under `documents.inferred_docs[0].fetched_excerpts`
- dependencies_semantic.requires-feature ← WebFetch alerting page (status 200, 2026-05-08, fetched excerpt)
- dependencies_semantic.requires-runtime ← AlertController.java:13 (`reactor.core.publisher.Mono`), 23, 38, 46, 54 (`ServerWebExchange exchange`)
- dependencies_semantic.couples-to ← AlertController.java:4 (`import ... AlertApi`), 9 (`import ... AlertService`), 16 (`@RequiredArgsConstructor`), 17 (`implements AlertApi`), 18 (`final AlertService alertService`)
- tests_coverage_semantic.test_files ← `find /home/rdamayeu/work/odd/odd-platform -path '*test*' -name 'AlertController*'` returned no matches (run during enrichment session 2026-05-08)
- docs_link_semantic.inferred_docs[0] ← WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/alerting.md` 2026-05-08, status 200
- docs_link_semantic.inferred_docs[1] ← WebFetch `https://docs.opendatadiscovery.org/developer-guides/api-reference/alerts` 2026-05-08, status 200
- docs_link_semantic.doc_drift_findings[0] ← WebFetch `https://docs.opendatadiscovery.org/active-platform-features/alerting` 2026-05-08, status 404 (page-not-found stub) — the live page actually lives at `/features/active-platform-features/alerting.md`
- docs_link_semantic.doc_drift_findings[1] ← AlertController.java:21-27 (no error-mapping logic) + AlertService.java:24 (signature only — actual rejection logic not visible from interface) + WebFetch api-reference/alerts page fetched excerpt
- implicit_adrs[0] ← AlertController.java:15-17 + AlertApi.java:64-69, 106-110, 147-151, 190-194 (HTTP mapping annotations on interface methods)
- implicit_adrs[1] ← AlertController.java:1-58 (no security annotations or imports) + AlertService.java:18-32 (interface signatures take no principal argument)
- implicit_adrs[2] ← AlertController.java:21-57 (uniform `.map(ResponseEntity::ok)` terminal pattern; no `onErrorResume` / `switchIfEmpty` / try-catch)
- bugs_limitations_corner_cases[0] ← `find /home/rdamayeu/work/odd/odd-platform -path '*test*' -name 'AlertController*'` empty result
- bugs_limitations_corner_cases[1] ← AlertController.java:35-41 (no security on `getAllAlerts`)
- bugs_limitations_corner_cases[2] ← AlertController.java:21-27 + WebFetch api-reference/alerts page fetched excerpt about `400 Bad Request` on manual reopen
- security.auth_mode_relevance ← AlertController.java:1-58 (no `@ConditionalOnProperty`, always wired) + LoginFormSecurityConfiguration.java:31 + OAuthSecurityConfiguration.java:71 + LDAPSecurityConfiguration.java:51 + DisabledAuthSecurityConfiguration.java:10 (`@ConditionalOnProperty(value = "auth.type", havingValue = "...")` wiring per mode) + WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security` 2026-05-08 status 200 (auth mode list verbatim: DISABLED / LOGIN_FORM / OAUTH2 / LDAP)
- security.ingestion_filter_relevance ← IngestionDataEntitiesFilter.java:20 (`@ConditionalOnProperty(value = "auth.ingestion.filter.enabled", havingValue = "true")`) + IngestionDataEntitiesFilter.java:28 (`new PathPatternParserServerWebExchangeMatcher("/ingestion/entities", HttpMethod.POST)`) + WebFetch enable-security page: "ODD Platform has two independent authentication surfaces, each governed by its own configuration flag. Enabling one does not protect the other."
- security.authorization_assertions ← AlertController.java:1-58 (zero security annotations or imports) + grep on `odd-platform-api-contract/build/generated/src/main/java/org/opendatadiscovery/oddplatform/api/contract/api/AlertApi.java` for `PreAuthorize | @Secured | @Authorize | hasPermission | hasRole` returned no matches (run during enrichment session 2026-05-08)
- security.owner_scoping ← AlertController.java:35-41 (`getAllAlerts` passes only page/size, no principal/owner filter) + AlertController.java:43-57 (`/my` and `/dependents` delegate to `listByOwner` / `listDependentObjectsAlerts` without principal parameter — service must resolve from reactor `Context`) + WebFetch alerting page for "All / My Objects / Dependents" tab semantics
- security.data_exposure ← AlertController.java:20-57 (each endpoint's response type and parameter signature)
- security.known_security_gaps[0] ← AlertController.java:1-58 + AlertApi.java grep result (zero authorization annotations)
- security.known_security_gaps[1] ← AlertController.java:35-41 + DisabledAuthSecurityConfiguration.java:10
- security.known_security_gaps[2] ← AlertController.java:20-27
- security.known_security_gaps[3] ← AlertController.java:43-57 + AlertService interface signatures
- performance.hot_paths[0] ← AlertController.java:35-41
- performance.hot_paths[1] ← AlertController.java:43-57
- performance.hot_paths[2] ← AlertController.java:29-33
- performance.throughput_characteristics[0] ← AlertController.java:21, 30, 36, 44, 52 (uniform `Mono<ResponseEntity<...>>` signature)
- performance.throughput_characteristics[1] ← AlertController.java:20-27 (single `Long alertId` path variable; no bulk endpoint in this file)
- performance.throughput_characteristics[2] ← AlertController.java:36-38, 44-46, 52-54 (page/size as plain `Integer`, no clamping)
- performance.resource_allocation[0] ← AlertController.java:18 + AlertController.java:21-57 (no allocations beyond service call + `ResponseEntity::ok`)
- performance.resource_allocation[1] ← AlertController.java:15-18 (`@RestController` + `@RequiredArgsConstructor`)
- performance.scaling_characteristics[0] ← AlertController.java:18 (only `final AlertService alertService` field)
- performance.scaling_characteristics[1] ← AlertController.java:1-58 (no Lock/Semaphore/synchronized/Atomic/queue types)
- performance.scaling_characteristics[2] ← AlertController.java:36-38, 44-46, 52-54 (no `@Max` / no clamping)
- performance.known_performance_gaps[0] ← AlertController.java:36-38, 44-46, 52-54
- performance.known_performance_gaps[1] ← AlertController.java:29-33
- performance.known_performance_gaps[2] ← AlertController.java:1-58 (no `@Timed`, no `MeterRegistry`, no `Logger`)
- performance.known_performance_gaps[3] ← AlertController.java:20-27

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (the absence-of-tests claim is verified by the file-system search, not inferred)
- docs_link_semantic: MEDIUM (no `@docs` annotation in source, so links are inferred; both URLs were WebFetched live and confirmed 200, but the binding controller→doc is the enricher's judgment, not a maintainer-declared link)
- implicit_adrs: HIGH (every claim is structural — visible in the source files at the cited lines)
- bugs_limitations_corner_cases: MEDIUM (corner-case[2] depends on a service-layer claim from the live doc page that this sidecar does NOT verify against AlertServiceImpl source — a reviewer enriching that node will cross-check)
- security: HIGH (every claim is structural and cited to file:line; auth-mode names verified verbatim against the live security doc; the AlertApi grep verifies absence of authorization annotations on the generated interface; the only MEDIUM-confidence sub-claim is that owner-scoping correctness for `/my` / `/dependents` is delegated to the service layer and not enforceable from the controller's source — that delegation IS itself a HIGH-confidence finding, but the *correctness* of the downstream enforcement is out of this file's scope)
- performance: HIGH (every claim is structural — pagination plumbing, reactive Mono signatures, absence of caching / bulk endpoints / observability annotations are all directly visible in AlertController.java; the HOT-PATH characterisation is anchored to the live alerting doc's tab semantics confirming these endpoints are per-render)

## Maintainer notes


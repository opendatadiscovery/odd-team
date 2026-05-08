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

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (the absence-of-tests claim is verified by the file-system search, not inferred)
- docs_link_semantic: MEDIUM (no `@docs` annotation in source, so links are inferred; both URLs were WebFetched live and confirmed 200, but the binding controller→doc is the enricher's judgment, not a maintainer-declared link)
- implicit_adrs: HIGH (every claim is structural — visible in the source files at the cited lines)
- bugs_limitations_corner_cases: MEDIUM (corner-case[2] depends on a service-layer claim from the live doc page that this sidecar does NOT verify against AlertServiceImpl source — a reviewer enriching that node will cross-check)

## Maintainer notes


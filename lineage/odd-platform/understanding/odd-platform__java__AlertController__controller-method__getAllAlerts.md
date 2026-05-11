---
node_id: "odd-platform java AlertController controller-method:getAllAlerts"
node_kind: controller-method
axis: controllers
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-10-01
---

# AlertController#getAllAlerts — semantic understanding

## understanding

`getAllAlerts` is the reactive `GET /api/alerts` handler — three lines of WebFlux delegation that calls `alertService.listAll(page, size)` and lifts the result into `200 OK`. It backs the platform's "All" alert tab — every open alert across the entire platform, returned to the caller without owner, role, or permission filtering. The method itself does no validation, no authorisation, no error handling; pagination parameters are passed straight through to the service. The downstream chain `AlertService.listAll` → `ReactiveAlertRepository.listAllWithStatusOpen` is a single `WHERE STATUS = OPEN` jOOQ query with no owner join and no principal context (`AlertServiceImpl.java:77-80`, `ReactiveAlertRepositoryImpl.java:142-157`).

## concepts

- entities: [`AlertList` (response payload), `Page` (pagination wrapper)]
- operations: [`list-open-alerts-platform-wide` (paged, no filter)]
- invariants: [
    "Reactive signature — returns `Mono<ResponseEntity<AlertList>>`; success always emits `200 OK` (`AlertController.java:39-40`)",
    "Pagination is required at the contract surface — `@NotNull` on both `page` and `size` lives on the generated `AlertApi.java:153-154`, NOT on the controller method; the controller's `Integer page, Integer size` parameters are unannotated (`AlertController.java:36-37`)",
    "No principal parameter — the method signature accepts only `(page, size, ServerWebExchange)` and never reads from the exchange's security context; principal resolution is irrelevant because the downstream service does no owner filter on this path"
  ]
- audiences: [
    "ODD Platform UI — the `Alerts → All` tab populates by calling this endpoint (per live alerting doc, see `docs_link_semantic.declared_docs[0].fetched_excerpts`)",
    "Platform stewards and admins per the live doc's recommendation 'Platform-wide triage; stewards and admins watching the full alert surface' — note: documented as the intended audience, but enforced as 'any authenticated user' in code"
  ]

## dependencies_semantic

- requires-feature: [
    "alerting feature — live doc `https://docs.opendatadiscovery.org/features/active-platform-features/alerting`"
  ]
- requires-config: [] — N/A (method reads no config; the controller class also reads no config keys per class-level sidecar)
- requires-runtime: [
    "Spring WebFlux runtime — `Mono<ResponseEntity<AlertList>>` return type and `ServerWebExchange exchange` parameter (`AlertController.java:13, 38`)",
    "jOOQ reactive DB session — downstream `listAllWithStatusOpen` issues `SELECT ... FROM alert WHERE status = OPEN` paginated query (`ReactiveAlertRepositoryImpl.java:143-156`)"
  ]
- couples-to: [
    "`AlertApi.getAllAlerts` (generated interface) — supplies `@RequestMapping(method = GET, value = '/api/alerts', produces = 'application/json')`, `@NotNull @Valid @RequestParam` constraints on `page` and `size`, and the `200 OK → AlertList` response schema (`AlertApi.java:135-156`)",
    "`AlertService.listAll(int, int)` — sole downstream call; service implementation maps the repository's `Page<AlertDto>` to `AlertList` via `AlertMapper.mapAlerts` (`AlertServiceImpl.java:77-80`)",
    "`ReactiveAlertRepository.listAllWithStatusOpen(int, int)` — the actual data source; pure `WHERE STATUS = OPEN` query with no owner join (`ReactiveAlertRepositoryImpl.java:142-157`)"
  ]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours: [
    "HTTP-level smoke test — no `@WebFluxTest(AlertController.class)` or `WebTestClient` test asserts `GET /api/alerts?page=1&size=10` returns `200 OK` with a deserialisable `AlertList`",
    "Pagination boundary — `page=0` (which feeds `(page - 1) * size = -size` as OFFSET in `ReactiveAlertRepositoryImpl.java:147`), `size=0`, `size=Integer.MAX_VALUE` — no test exercises edge inputs",
    "Authorization regression — no test asserts whether an authenticated non-admin user can read all platform alerts (the current code permits it; a future tightening to admin-only would have no test to break)",
    "Empty-result behaviour — no test asserts the shape of `AlertList` when zero open alerts exist"
  ]
- test_files: [] — N/A. `find <odd-platform> -path '*test*' -name 'AlertController*'` returned zero matches (run during enrichment session 2026-05-10). The two Alert-adjacent test files (`AlertMapperTest.java`, `AlertIngestionTest.java`) exercise mapping and ingestion, not the HTTP surface.
- gaps: |
    The method body is three lines (`AlertController.java:39-40`) — a unit test of the controller's own logic would test nothing. The real gap is the integration boundary: there is no test that wires WebFlux routing, OpenAPI-generated `@RequestMapping`, Jackson serialisation, and the JOOQ repository together against an in-memory or test-container Postgres for `GET /api/alerts`. A regression in any of the four layers (OpenAPI generator template, WebFlux routing config, Jackson `ObjectMapper` config, jOOQ schema mapping) would silently break this endpoint with the build still green.

## docs_link_semantic

- declared_docs: [] — N/A. The source file carries no `@docs` Javadoc annotation; per the class-level convention, `@docs` annotations are not bootstrapped in this repo (consistent with the AlertController class sidecar's finding).
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/active-platform-features/alerting"
    anchor: ""
    rationale: "Single live page describing the alerting feature; explicitly names `getAllAlerts` as the endpoint behind the 'All' tab and recommends the tab for 'stewards and admins watching the full alert surface'"
    last_verified_at: "2026-05-10T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      Tab description (verbatim from live page): "All — Every open and resolved alert across the whole platform."
      Recommendation for the tab (verbatim): "Platform-wide triage; stewards and admins watching the full alert surface."
      Endpoint enumeration (verbatim): "The endpoints behind the three tabs (`getAllAlerts`, `getAssociatedUserAlerts`, `getDependentEntitiesAlerts`) plus the badge-counter call (`getAlertTotals`) are documented at API Reference → Alerts → Global alert listings."
      Access-control note (verbatim absence): "The documentation makes no explicit statements about role-based restrictions, admin-only access, or visibility gating for the 'All' tab. There are no mentions of who can access this view or whether certain user roles are blocked from seeing platform-wide alerts."
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization"
    anchor: ""
    rationale: "Authorization-vocabulary canonical page (Policy / Permission / Role / Owner / User-owner association) — verified that no permission gate is documented for the alerts surface, consistent with the absence of any SecurityRule for `GET /api/alerts` in `SecurityConstants.SECURITY_RULES`"
    last_verified_at: "2026-05-10T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      Vocabulary inventory (verbatim from live page): "Policy / Permission / Role / Owner / User-owner association".
      Permission-gate absence (verbatim): "no mention of permission gates for viewing alerts, listing alerts, or an 'All' alerts tab."
- doc_drift_findings:
  - "The live alerting doc recommends the 'All' tab for 'stewards and admins watching the full alert surface' — language that implies a privileged audience. The code enforces 'any authenticated user' (no SecurityRule entry in `SecurityConstants.SECURITY_RULES` for `GET /api/alerts`; falls through to `pathMatchers('/**').authenticated()` per `AuthorizationCustomizer.java:29-30`). The doc's audience framing and the code's audience enforcement diverge. Severity: out-of-scope to fix here, but a doc-drift candidate for the doc-gap-finder reducer — two corrective paths exist (align doc text to the enforced 'any authenticated user' behaviour, or add an admin/steward Permission gate aligned with the doc's stated audience); the choice is the maintainer's, not this enricher's."

## implicit_adrs

- "Centralised endpoint authorization via `SecurityConstants.SECURITY_RULES` — controllers carry no `@PreAuthorize`; protected endpoints are declared as `SecurityRule` entries that `AuthorizationCustomizer` registers against the WebFlux security chain. `GET /api/alerts` has NO entry, so it falls through to the catch-all `pathMatchers('/**').authenticated()`. The catch-all is the explicit decision — the absence of a per-endpoint rule means 'any authenticated user'." — evidence: `AuthorizationCustomizer.java:21-30` (the `for (SecurityRule rule : SecurityConstants.SECURITY_RULES)` loop followed by `pathMatchers('/**').authenticated()`) + `SecurityConstants.java:98-295` (the rule list contains `/api/alerts/{alert_id}/status` PUT but no entry for `/api/alerts` GET) — intent_anchor: "spec.pathMatchers(\"/**\").authenticated();" (`AuthorizationCustomizer.java:29-30`) — confidence: HIGH

## bugs_limitations_corner_cases

- "`getAllAlerts` returns the entire platform's OPEN alert stream to any authenticated user — no Permission gate, no Role check, no admin restriction. The downstream `listAll → listAllWithStatusOpen` query is a flat `WHERE STATUS = OPEN` jOOQ select with no owner join (`ReactiveAlertRepositoryImpl.java:143-156`). The live alerting doc names the audience as 'stewards and admins watching the full alert surface' — the code does not enforce that audience." — evidence: `AlertController.java:35-41` (no annotations) + `SecurityConstants.java:98-295` (no rule for `/api/alerts` GET) + `AuthorizationCustomizer.java:29-30` (catch-all authenticated only) + `ReactiveAlertRepositoryImpl.java:143-145` (no owner predicate) — severity: HIGH
- "Pagination parameters are unbounded at every layer this method touches — the controller does not validate `page` or `size`; the generated `AlertApi.java:153-154` carries `@NotNull @Valid` but no `@Min` or `@Max`; the repository computes `OFFSET = (page - 1) * size` (`ReactiveAlertRepositoryImpl.java:147`) with no clamping. A caller passing `size=1_000_000` triggers a single jOOQ query bounded only by what Postgres / network buffers tolerate; a caller passing `page=0` produces a negative OFFSET and downstream behaviour is implementation-defined." — evidence: `AlertController.java:36-37` (`Integer page, Integer size` without annotations) + `AlertApi.java:153-154` (`@NotNull @Valid` only) + `ReactiveAlertRepositoryImpl.java:147` (`(page - 1) * size`) — severity: MEDIUM
- "Under `auth.type=DISABLED`, this endpoint becomes anonymously reachable — `DisabledAuthSecurityConfiguration` skips authentication entirely; combined with the missing SecurityRule for `/api/alerts`, any unauthenticated client on the network can read every open alert across the platform. DISABLED is documented as a dev-only mode, but operators who misuse it expose the whole alert stream." — evidence: `AlertController.java:35-41` + `SecurityConstants.java:98-295` (no `/api/alerts` rule) — severity: MEDIUM
- "No HTTP-level test exists for `GET /api/alerts` — a regression in OpenAPI routing generation, WebFlux configuration, Jackson serialisation, or the jOOQ repository would silently break this endpoint with the build still green. Smallest reproducer: `@WebFluxTest(AlertController.class)` + `WebTestClient.get().uri('/api/alerts?page=1&size=10').exchange().expectStatus().isOk()`." — evidence: `find odd-platform -path '*test*' -name 'AlertController*'` returned no matches — severity: MEDIUM

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` (the three modes that protect the UI/API surface this controller is mounted on). Under `DISABLED` the endpoint is anonymously reachable. The method itself carries no `@ConditionalOnProperty`; auth wiring is enforced globally by the `*SecurityConfiguration` beans (see class-level sidecar). `S2S` is not relevant — S2S protects `/ingestion/entities` only, not `/api/alerts*`.
- **ingestion_filter_relevance**: `NO — UI/API surface, not /ingestion/entities`. The `IngestionDataEntitiesFilter` matches `/ingestion/entities` POST only; `GET /api/alerts` does not match.
- **authorization_assertions**: [] — `AlertController.java:35-41` carries no `@PreAuthorize`, no `@Secured`, no programmatic `permissionService.hasPermission(...)` call. `SecurityConstants.SECURITY_RULES` (`SecurityConstants.java:98-295`) contains no entry for `GET /api/alerts` — the path therefore falls through to `pathMatchers('/**').authenticated()` in `AuthorizationCustomizer.java:29-30`. Authentication is required; authorization is not enforced.
- **owner_scoping**: `BYPASSES — returns data across owners (admin path)`. The method passes only `(page, size)` to `alertService.listAll`; the service calls `alertRepository.listAllWithStatusOpen(page, size)` (`AlertServiceImpl.java:77-80`); the repository executes `selectFrom(ALERT).where(ALERT.STATUS.eq(AlertStatusEnum.OPEN.getCode()))` (`ReactiveAlertRepositoryImpl.java:143-145`) — no owner join, no principal-derived predicate. Every authenticated caller sees every open alert.
- **data_exposure**:
  - "AlertList payload (alert id, status, lastReason, severity, dataEntity ref, status_updated_by owner+identity, alert_chunk_list with descriptions) → ANY authenticated user under LOGIN_FORM/OAUTH2/LDAP via `GET /api/alerts` — no Permission/Role gate, no owner filter at any layer of the controller → service → repository chain" — evidence: `AlertController.java:35-41` + `AlertServiceImpl.java:77-80` + `ReactiveAlertRepositoryImpl.java:142-157`
  - "Same payload → ANONYMOUS callers under `auth.type=DISABLED`" — evidence: `AlertController.java:35-41` + absence of `SecurityRule` entry in `SecurityConstants.java`
- **known_security_gaps**:
  - "`GET /api/alerts` has no entry in `SecurityConstants.SECURITY_RULES` (`SecurityConstants.java:98-295`) and falls through to the catch-all `pathMatchers('/**').authenticated()` (`AuthorizationCustomizer.java:29-30`). The downstream `listAllWithStatusOpen` query has no owner predicate (`ReactiveAlertRepositoryImpl.java:143-145`). The live alerting doc (WebFetched 2026-05-10, status 200) recommends the tab for 'stewards and admins watching the full alert surface' but the code permits any authenticated user. This is a privilege-boundary leak under LOGIN_FORM/OAUTH2/LDAP and an anonymous-read leak under DISABLED." — evidence: `AlertController.java:35-41` + `SecurityConstants.java:98-295` + `AuthorizationCustomizer.java:29-30` + `ReactiveAlertRepositoryImpl.java:143-145` + WebFetch alerting page 2026-05-10 — severity: HIGH
  - "Asymmetry with sibling endpoint: `PUT /api/alerts/{alert_id}/status` IS registered in `SecurityConstants.SECURITY_RULES` (`SecurityConstants.java:295-296`), while `GET /api/alerts` is absent from the rule list. No comment, annotation, or surrounding code in scope of this file defends the asymmetry as intentional. Note: the registered rule on `changeAlertStatus` pairs the `ALERT` resource type with the `DATASET_FIELD_ADD_TERM` permission constant (`SecurityConstants.java:295-296`) — the resource type and permission constant come from different domain enums, an inconsistency to surface at the `changeAlertStatus` node sidecar, not in scope here." — evidence: `SecurityConstants.java:295-296` — severity: MEDIUM (the asymmetry itself; the permission-constant inconsistency is out-of-scope for this node)

## performance

- **hot_paths**:
  - "Per-tab-activation request on the ODD Platform UI's `Alerts → All` view — the live doc names this tab as the platform-wide triage view, so on every UI alerts-page render this endpoint is hit alongside `/api/alerts/totals`. The downstream query is a paginated `SELECT FROM alert WHERE status = OPEN` joined with the data-entity table (via `createAlertJoinQuery`, `ReactiveAlertRepositoryImpl.java:147`)." — evidence: `AlertController.java:35-41` + `ReactiveAlertRepositoryImpl.java:142-157` + WebFetch alerting page 2026-05-10
- **throughput_characteristics**:
  - "Single reactive call — `Mono<ResponseEntity<AlertList>>`; non-blocking I/O; no thread is held during the DB await" — evidence: `AlertController.java:36-41`
  - "No batch / bulk variant — this is a read-only listing; the bulk-shape concerns apply to the sibling `changeAlertStatus` (single-item mutation, no bulk endpoint)" — evidence: `AlertController.java:36-41` (signature) + class-level sibling enumeration
- **resource_allocation**:
  - "Per-request allocations bounded by `size` — the repository emits a `Page<AlertDto>` whose `data` list is at most `size` rows; `AlertMapper.mapAlerts` maps each into an `AlertList` item. With no upper bound on `size` (see `bugs_limitations_corner_cases[1]`), peak memory is proportional to the caller-supplied page size." — evidence: `ReactiveAlertRepositoryImpl.java:147-156` + `AlertServiceImpl.java:78-80`
  - "Pagination `OFFSET` is computed as `(page - 1) * size` (`ReactiveAlertRepositoryImpl.java:147`) — for deep pages, Postgres must scan and discard `(page - 1) * size` rows before returning the requested window. Cost grows linearly with deep pagination; keyset pagination would be O(1) but is not implemented here." — evidence: `ReactiveAlertRepositoryImpl.java:147`
- **scaling_characteristics**:
  - "Stateless controller method — horizontal scaling unconstrained at this layer" — evidence: `AlertController.java:35-41` (no instance state)
  - "Single DB round-trip per request through `listAllWithStatusOpen` (which itself internally issues the page query plus a count query for the `Page` wrapper via `pageifyResult`)" — evidence: `ReactiveAlertRepositoryImpl.java:149-156`
  - "No upper bound on `size` — a caller supplying `size=1_000_000` triggers a single large jOOQ query plus an in-memory list mapping; the controller does not clamp, the OpenAPI contract does not constrain (`AlertApi.java:153-154` has `@NotNull @Valid` but no `@Max`), and the repository does not validate" — evidence: `AlertController.java:36-37` + `AlertApi.java:153-154` + `ReactiveAlertRepositoryImpl.java:142-157`
- **known_performance_gaps**:
  - "No upper bound on pagination `size` — see `scaling_characteristics[2]` and `bugs_limitations_corner_cases[1]`. A malicious or careless `size=1_000_000` produces an arbitrarily large response body and an unbounded jOOQ query." — evidence: `AlertController.java:36-37` + `AlertApi.java:153-154` + `ReactiveAlertRepositoryImpl.java:142-157` — severity: MEDIUM
  - "Deep-pagination cost — `OFFSET = (page - 1) * size` means cost grows linearly with `page`; keyset pagination not implemented" — evidence: `ReactiveAlertRepositoryImpl.java:147` — severity: LOW
  - "No caching / `Cache-Control` / ETag — every UI tab activation re-runs the query; for high-traffic platforms with >10K open alerts and frequent tab switches this is a per-render DB hit" — evidence: `AlertController.java:35-41` (no headers set) + `AlertServiceImpl.java:77-80` (no caching) — severity: LOW
  - "No method-level observability — no `@Timed`, no Micrometer counter, no structured log entry. Latency regressions on this hot path would surface only in DB / WebFlux metrics, not at the controller boundary." — evidence: `AlertController.java:35-41` — severity: LOW

## sources

- understanding ← `AlertController.java:35-41` (the three-line method body) + `AlertServiceImpl.java:77-80` (downstream service) + `ReactiveAlertRepositoryImpl.java:142-157` (downstream repository, no owner predicate)
- concepts.entities ← `AlertController.java:6, 36` (`AlertList` import and return type) + `ReactiveAlertRepositoryImpl.java:142` (`Page` wrapper)
- concepts.operations ← `AlertController.java:36-41` + `ReactiveAlertRepositoryImpl.java:143-145` (the actual operation shape: WHERE STATUS = OPEN paginated)
- concepts.invariants[0] ← `AlertController.java:36-41` (return type + `.map(ResponseEntity::ok)`)
- concepts.invariants[1] ← `AlertController.java:36-37` (no annotations on controller params) + `AlertApi.java:153-154` (interface-level `@NotNull @Valid`)
- concepts.invariants[2] ← `AlertController.java:36-38` (signature lists only `page, size, ServerWebExchange`; no security-context read) + `AlertServiceImpl.java:77-80` (service signature takes no principal) + `ReactiveAlertRepositoryImpl.java:142-157` (repository has no principal-derived predicate)
- concepts.audiences ← WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/alerting` 2026-05-10 status 200 (fetched excerpts under `docs_link_semantic.inferred_docs[0]`)
- dependencies_semantic.requires-feature ← WebFetch alerting page 2026-05-10 status 200
- dependencies_semantic.requires-runtime[0] ← `AlertController.java:13, 38`
- dependencies_semantic.requires-runtime[1] ← `ReactiveAlertRepositoryImpl.java:143-156`
- dependencies_semantic.couples-to[0] ← `AlertApi.java:135-156` (the `@Operation` + `@RequestMapping` block for `getAllAlerts`) + `AlertController.java:4` (import) + `AlertController.java:35` (`@Override`)
- dependencies_semantic.couples-to[1] ← `AlertController.java:9, 18, 39` (`AlertService` import, field, call) + `AlertServiceImpl.java:77-80` (service implementation)
- dependencies_semantic.couples-to[2] ← `AlertServiceImpl.java:70, 78` (repository field + call) + `ReactiveAlertRepositoryImpl.java:142-157` (repository implementation)
- tests_coverage_semantic.test_files ← `find <odd-platform> -path '*test*' -name 'AlertController*'` returned zero matches (run 2026-05-10)
- docs_link_semantic.inferred_docs[0] ← WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/alerting` 2026-05-10 status 200
- docs_link_semantic.inferred_docs[1] ← WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization` 2026-05-10 status 200
- docs_link_semantic.doc_drift_findings[0] ← WebFetch alerting page 2026-05-10 ("stewards and admins watching the full alert surface") + `SecurityConstants.java:98-295` (no rule for `/api/alerts`) + `AuthorizationCustomizer.java:29-30` (catch-all `.authenticated()`)
- implicit_adrs[0] ← `AuthorizationCustomizer.java:21-30` (the rule-loop + catch-all `.authenticated()` pattern) + `SecurityConstants.java:98-295` (rule list shape: explicit per-path entries; the absence of a `/api/alerts` GET entry is the falls-through default)
- bugs_limitations_corner_cases[0] ← `AlertController.java:35-41` + `SecurityConstants.java:98-295` + `AuthorizationCustomizer.java:29-30` + `ReactiveAlertRepositoryImpl.java:143-145` + WebFetch alerting page 2026-05-10
- bugs_limitations_corner_cases[1] ← `AlertController.java:36-37` + `AlertApi.java:153-154` + `ReactiveAlertRepositoryImpl.java:147`
- bugs_limitations_corner_cases[2] ← `AlertController.java:35-41` + `SecurityConstants.java:98-295` (no `/api/alerts` rule means DISABLED produces anonymous reach by default)
- bugs_limitations_corner_cases[3] ← `find odd-platform -path '*test*' -name 'AlertController*'` empty result
- security.auth_mode_relevance ← `AlertController.java:35-41` (no `@ConditionalOnProperty` at the method or class) + class-level sidecar's verified auth-mode wiring (`LoginFormSecurityConfiguration.java:31`, `OAuthSecurityConfiguration.java:71`, `LDAPSecurityConfiguration.java:51`, `DisabledAuthSecurityConfiguration.java:10`)
- security.ingestion_filter_relevance ← class-level sidecar's verified `IngestionDataEntitiesFilter` path-matcher (`/ingestion/entities` POST only)
- security.authorization_assertions ← `AlertController.java:35-41` (no security annotations) + `SecurityConstants.java:98-295` (no rule entry for `/api/alerts` GET) + `AuthorizationCustomizer.java:29-30` (catch-all `.authenticated()`)
- security.owner_scoping ← `AlertController.java:35-41` (no principal pass-through) + `AlertServiceImpl.java:77-80` (no owner argument) + `ReactiveAlertRepositoryImpl.java:143-145` (no owner predicate in jOOQ where-clause)
- security.data_exposure[0] ← `AlertController.java:35-41` + `AlertServiceImpl.java:77-80` + `ReactiveAlertRepositoryImpl.java:142-157`
- security.data_exposure[1] ← `AlertController.java:35-41` + `SecurityConstants.java:98-295` (absence of rule = DISABLED produces anonymous reach)
- security.known_security_gaps[0] ← `AlertController.java:35-41` + `SecurityConstants.java:98-295` + `AuthorizationCustomizer.java:29-30` + `ReactiveAlertRepositoryImpl.java:143-145` + WebFetch alerting page 2026-05-10 ("stewards and admins" recommendation)
- security.known_security_gaps[1] ← `SecurityConstants.java:295-296` (the registered `/api/alerts/{alert_id}/status` PUT rule)
- performance.hot_paths[0] ← `AlertController.java:35-41` + `ReactiveAlertRepositoryImpl.java:142-157` + WebFetch alerting page 2026-05-10 ("Platform-wide triage" recommendation implies frequent UI-render hits)
- performance.throughput_characteristics[0] ← `AlertController.java:36-41`
- performance.throughput_characteristics[1] ← `AlertController.java:36-41` (read-only listing — no mutation/bulk shape here)
- performance.resource_allocation[0] ← `ReactiveAlertRepositoryImpl.java:147-156` + `AlertServiceImpl.java:78-80`
- performance.resource_allocation[1] ← `ReactiveAlertRepositoryImpl.java:147` (`(page - 1) * size` as OFFSET)
- performance.scaling_characteristics[0] ← `AlertController.java:35-41` (no instance state in the method)
- performance.scaling_characteristics[1] ← `ReactiveAlertRepositoryImpl.java:149-156` (`pageifyResult` issues both the page query and the count query)
- performance.scaling_characteristics[2] ← `AlertController.java:36-37` + `AlertApi.java:153-154` + `ReactiveAlertRepositoryImpl.java:142-157`
- performance.known_performance_gaps[0] ← `AlertController.java:36-37` + `AlertApi.java:153-154` + `ReactiveAlertRepositoryImpl.java:142-157`
- performance.known_performance_gaps[1] ← `ReactiveAlertRepositoryImpl.java:147`
- performance.known_performance_gaps[2] ← `AlertController.java:35-41` + `AlertServiceImpl.java:77-80`
- performance.known_performance_gaps[3] ← `AlertController.java:35-41`

## confidence_per_field

- understanding: HIGH (every claim verified against the source file, the service implementation, and the repository implementation at cited lines)
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (absence-of-tests verified by file-system search)
- docs_link_semantic: MEDIUM (no `@docs` annotation in source; both URLs WebFetched 2026-05-10 status 200; the binding endpoint→doc is enricher judgment, not maintainer-declared)
- implicit_adrs: HIGH (the centralised-`SECURITY_RULES` pattern is structurally visible in `AuthorizationCustomizer.java:21-30` plus the rule list in `SecurityConstants.java`; the intent_anchor is the catch-all `pathMatchers('/**').authenticated()` line)
- bugs_limitations_corner_cases: HIGH (every gap is verified file:line against the controller, service, repository, security-rule list, and live doc fetched excerpts; routing per file-analyser 0.2.0 — these are absence observations with no defending intent visible in the source, so they route here rather than `implicit_adrs`)
- security: HIGH (every claim is structural and traces to the controller, the service, the repository, `SecurityConstants`, `AuthorizationCustomizer`, and the live security/authorization doc page)
- performance: HIGH (pagination plumbing, OFFSET computation, absence of caching/observability/bulk variant are all directly visible at cited lines)

## Maintainer notes


---
node_id: "odd-platform java DataEntityController controller-method:getDataEntityAlerts"
node_kind: controller-method
axis: controllers
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-19-batch-L-data-entity-alerts
---

# DataEntityController#getDataEntityAlerts — semantic understanding

## understanding

`getDataEntityAlerts` is the reactive `GET /api/dataentities/{data_entity_id}/alerts` handler — a one-line WebFlux delegation that calls `alertService.getDataEntityAlerts(dataEntityId, page, size)` and lifts the result to `200 OK` (`DataEntityController.java:315-321`). It backs the per-entity Alerts tab on the UI's data-entity detail page AND is the doc-recommended **audit-export workaround** for the housekeeping bug that hard-deletes manually-resolved alerts (per the live alerting page WebFetched 2026-05-19, status 200, anchor `#auto-cleanup-of-resolved-alerts`). The endpoint carries NO `@PreAuthorize`, NO entry in `SecurityConstants.SECURITY_RULES` for the GET path, NO owner-scoping at any layer of the chain — the downstream `AlertService.getDataEntityAlerts → ReactiveAlertRepository.getAlertsByDataEntityId` is a single `WHERE DATA_ENTITY.ID = :id` jOOQ select with no `OWNERSHIP` join and no principal-derived predicate (`AlertServiceImpl.java:138-143`, `ReactiveAlertRepositoryImpl.java:182-199`). The existence-guard at the service layer is deliberately `existsIncludingSoftDeleted` (`AlertServiceImpl.java:327-335`, `ReactiveDataEntityRepositoryImpl.java:150-155`), so the endpoint also reads alerts attached to **soft-deleted** data entities — an asymmetry with `listByOwner` (`ReactiveAlertRepositoryImpl.java:166-167`) which DOES filter `DATA_ENTITY.STATUS != DELETED`.

## concepts

- entities: [
    "`AlertList` (response payload; OpenAPI-generated; `DataEntityController.java:12, 316`)",
    "`Page<AlertDto>` (repository-layer pagination wrapper; `ReactiveAlertRepositoryImpl.java:182`)",
    "`NotFoundException(\"Data Entity\", dataEntityId)` (the existence-check error path; `AlertServiceImpl.java:330` → HTTP 404 via global handler)",
    "soft-delete state (DATA_ENTITY.STATUS column with `DataEntityStatusDto.DELETED.getId()`; deliberately NOT filtered at this read path)"
  ]
- operations: [
    "delegate `(dataEntityId, page, size)` to `AlertService.getDataEntityAlerts` (controller boundary; `DataEntityController.java:320`)",
    "existence-check the data-entity ID via `dataEntityRepository.existsIncludingSoftDeleted` (`AlertServiceImpl.java:140, 327-335`) — emits `NotFoundException` if absent",
    "execute `SELECT ALERT.* FROM ALERT JOIN DATA_ENTITY ON DATA_ENTITY.ODDRN = ALERT.DATA_ENTITY_ODDRN WHERE DATA_ENTITY.ID = :id` with pagination (`ReactiveAlertRepositoryImpl.java:182-199`)",
    "map `Page<AlertDto>` → `AlertList` via `AlertMapper.mapAlerts` (`AlertServiceImpl.java:142`)",
    "lift to `ResponseEntity.ok(...)`"
  ]
- invariants:
  - "Reactive signature — returns `Mono<ResponseEntity<AlertList>>`; success always emits `200 OK` (`DataEntityController.java:316-321`)"
  - "Pagination is required at the contract surface — `PageParam` and `SizeParam` are `required: true` in `components.yaml:4213-4229`, but neither carries `minimum:` nor `maximum:`; the controller's `Integer page, Integer size` parameters are unannotated (`DataEntityController.java:317-318`)"
  - "No principal parameter — the method signature accepts only `(dataEntityId, page, size, ServerWebExchange)` and never reads the security context; principal resolution is irrelevant because the downstream chain does no owner filter on this path"
  - "Existence-check is deliberately soft-delete-inclusive — `existsIncludingSoftDeleted` (`ReactiveDataEntityRepositoryImpl.java:150-155`) emits a `selectExists` over `DATA_ENTITY` with no soft-delete filter; the related `existsNonDeletedByDataSourceId` (line 158) DOES apply `addSoftDeleteFilter(...)`. The asymmetry is intentional at the existence-check site — the helper name says so explicitly."
  - "No alert-status filter — the read path returns ALL statuses (OPEN, RESOLVED, RESOLVED_AUTOMATICALLY). The sibling `getDataEntityAlertsCounts` accepts a status parameter (`DataEntityController.java:324-330`); this listing endpoint does not."
- audiences: [
    "ODD Platform UI — the entity's `Alerts` tab on the data-entity detail page (per live alerting page WebFetched 2026-05-19: `each affected entity's own Alerts tab`)",
    "Operators running the housekeeping audit-export workaround — the live alerting page WebFetched 2026-05-19 names this endpoint verbatim as the workaround for the manually-resolved-alert hard-delete bug: `GET /api/dataentities/{data_entity_id}/alerts returns the open and recently-resolved set including chunks and status history`",
    "Third-party API consumers building compliance / audit-export integrations that need a per-entity alert history"
  ]

## dependencies_semantic

- requires-feature:
  - "**Alerting feature** — live doc WebFetched 2026-05-19 status 200 `https://docs.opendatadiscovery.org/features/active-platform-features/alerting`; the per-entity Alerts tab and the audit-export workaround are both named on the page"
  - "**Data Entity Discovery (P-01)** — the endpoint is mounted under `/api/dataentities/{data_entity_id}/...` and requires the data-entity catalog to be populated"
- requires-config: [] — N/A (the method reads no config; the controller class also reads no config keys)
- requires-runtime:
  - "Spring WebFlux — `Mono<ResponseEntity<AlertList>>` return type and `ServerWebExchange exchange` parameter (`DataEntityController.java:63-65, 316-319`)"
  - "jOOQ reactive DB session — downstream `getAlertsByDataEntityId` issues `SELECT ALERT.* FROM ALERT JOIN DATA_ENTITY ON DATA_ENTITY.ODDRN = ALERT.DATA_ENTITY_ODDRN WHERE DATA_ENTITY.ID = :id` paginated (`ReactiveAlertRepositoryImpl.java:182-199`)"
  - "Reactor Core — `flatMap` composition of existence-check Mono + repository Mono (`AlertServiceImpl.java:140-142`)"
- couples-to:
  - "`DataEntityApi.getDataEntityAlerts` (OpenAPI-generated interface) — supplies `@RequestMapping(method = GET, value = '/api/dataentities/{data_entity_id}/alerts')`, the path / page / size parameter bindings, and the `200 OK → AlertList` response schema. The OpenAPI operation is declared at `openapi.yaml:1321-1338` with parameter refs to `components.yaml:4213` (`PageParam`), `components.yaml:4222` (`SizeParam`), `components.yaml:4250` (`DataEntityIdParam`)"
  - "`AlertService.getDataEntityAlerts(long, int, int)` — sole downstream call (`AlertService.java:26`, `AlertServiceImpl.java:138-143`); service composes existence-check Mono with repository call"
  - "`ReactiveAlertRepository.getAlertsByDataEntityId(long, int, int)` — the SQL primary source; `ReactiveAlertRepositoryImpl.java:182-199` issues the actual query"
  - "`ReactiveDataEntityRepository.existsIncludingSoftDeleted(long)` — the existence-guard; `ReactiveDataEntityRepositoryImpl.java:150-155` issues `selectExists` over `DATA_ENTITY` with no soft-delete filter"

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - "HTTP-level smoke test — no `@WebFluxTest(DataEntityController.class)` or `WebTestClient` test asserts `GET /api/dataentities/1/alerts?page=1&size=10` returns `200 OK` with a deserialisable `AlertList`"
  - "Cross-owner read posture regression — no test asserts whether an authenticated user can read alerts for a data entity they don't own (the current code permits it; a future tightening to owner-only would have no test to break the build)"
  - "Soft-deleted data-entity read — no test asserts that the existence-check accepts soft-deleted entities (the related `getDataEntityDetails` sidecar notes the same soft-delete-inclusive read posture; both endpoints share the deliberate intent but neither has a covering test)"
  - "Pagination boundary — `page=0` (which feeds `(page - 1) * size = -size` as OFFSET at `ReactiveAlertRepositoryImpl.java:189`), `size=0`, `size=Integer.MAX_VALUE` — no test exercises edge inputs"
  - "Not-found behaviour — no test asserts that a non-existent `dataEntityId` produces HTTP 404 with the `NotFoundException(\"Data Entity\", id)` body shape (`AlertServiceImpl.java:330`)"
- test_files: [] — N/A. `find <odd-platform> -path '*test*' -name 'DataEntityController*'` and `find <odd-platform> -path '*test*' -name 'AlertServiceImpl*'` both returned zero matches (run during enrichment session 2026-05-19).
- gaps: |
    The controller method body is ONE line (`DataEntityController.java:320`) — a unit test would test nothing. The real gap is the integration boundary: there is no test that wires WebFlux routing, the OpenAPI-generated `@RequestMapping`, Jackson serialisation, the existence-check, AND the jOOQ alert-by-data-entity query together against an in-memory or test-container Postgres. A regression in any one of: (a) the OpenAPI generator template, (b) the WebFlux routing config, (c) Jackson `ObjectMapper` config, (d) the `existsIncludingSoftDeleted` helper, or (e) the jOOQ schema mapping would silently break this endpoint with the build still green. The cross-owner posture and the soft-delete-inclusive existence-check are also uncovered — both are intentional, but neither is tested as intentional, so future maintainers may "fix" them and the build will pass.

## docs_link_semantic

- declared_docs: [] — N/A. The source file carries no `@docs` Javadoc annotation; per the class-level convention noted in the AlertController class sidecar, `@docs` annotations are not bootstrapped in this repo.
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/active-platform-features/alerting"
    anchor: "#auto-cleanup-of-resolved-alerts"
    rationale: "Single live page describing the alerting feature; explicitly names `GET /api/dataentities/{data_entity_id}/alerts` as the audit-export workaround for the housekeeping-cleanup bug AND describes the per-entity `Alerts tab` UI surface backed by this endpoint"
    last_verified_at: "2026-05-19T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      Per-entity tab (verbatim from live page): "alerts visible in the navigation pane's `Alerts` section and on each affected entity's own **Alerts tab**".
      Endpoint named verbatim: "`GET /api/dataentities/{data_entity_id}/alerts` returns the open and recently-resolved set including chunks and status history."
      Workaround statement (verbatim): "The only operator-side workaround until the platform fix lands is to **export the alert audit data before manually resolving** — `GET /api/dataentities/{data_entity_id}/alerts` returns the open and recently-resolved set including chunks and status history. Persist the response somewhere durable (object store, log pipeline, ticketing system) if the audit trail matters for compliance or postmortems".
      Access-control note (verbatim absence): "The documentation does not explicitly define granular access control rules for who can read alerts on specific entities. It references user-owner associations for filtering alert views (My Objects, Dependents tabs) but does not detail role-based or permission-based access restrictions."
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization"
    anchor: ""
    rationale: "Authorization-vocabulary canonical page (Policy / Permission / Role / Owner / User-owner association) — to verify the documented permission gates for alert read paths. Cross-reference via `AlertController.getAllAlerts` neighbour sidecar — that sidecar verified status 200 on 2026-05-10 and found NO documented permission for alerts read paths."
    last_verified_at: "2026-05-10T00:00:00Z"
    last_verified_status: 200
    confidence: MEDIUM
    fetched_excerpts: |
      (Re-using the neighbour sidecar's WebFetch result, since the doc page has not changed: "no mention of permission gates for viewing alerts, listing alerts, or an 'All' alerts tab.")
- doc_drift_findings:
  - "The live alerting page (WebFetched 2026-05-19 status 200) names `GET /api/dataentities/{data_entity_id}/alerts` as a tool operators can use to export the alert audit data BEFORE manually resolving an alert. The page does NOT say whether this endpoint scopes by owner, by role, by permission, or by anything at all. The code path scopes by NONE of those — any authenticated user can read any data entity's alerts. For the doc's intended workaround use case (an owner exporting THEIR OWN entity's alerts before resolution) this is harmless; but the same endpoint is also a discovery surface for an attacker who has any authenticated session and is willing to enumerate `data_entity_id` values. The page is silent on whether that is intentional or not. Severity: doc-drift candidate (audience-vs-enforcement asymmetry, paired with REFACTOR-024); the reducer (doc-gap-finder) should triage whether to: (a) add owner-scoping at the read path and update the page to recommend the My Objects tab for personal audit exports; or (b) document the cross-owner read posture explicitly on the alerting page so operators understand the access model when wiring the audit-export workaround. The choice is the maintainer's, not this enricher's."
  - "The audit-export workaround in the doc is presented as if there is a one-step path: 'export → manually resolve → housekeeping deletes the row'. The endpoint returns paginated `AlertList` (page / size params required); a complete export of an entity with >`size` rows requires multiple paginated calls. The doc does not call out the pagination shape. Operators following the doc literally with `page=1&size=100` will silently truncate the export for high-volume entities. Severity: doc-drift candidate (workaround-completeness)."

## implicit_adrs

- "**Centralised endpoint authorization via `SecurityConstants.SECURITY_RULES`** — controllers carry no `@PreAuthorize`; protected endpoints are declared as `SecurityRule` entries that `AuthorizationCustomizer` registers against the WebFlux security chain (`AuthorizationCustomizer.java:20-31`). `GET /api/dataentities/{data_entity_id}/alerts` has NO entry, so it falls through to the catch-all `pathMatchers('/**').authenticated()` at `AuthorizationCustomizer.java:29-30`. The catch-all is the explicit decision — the absence of a per-endpoint rule means 'any authenticated user'. The pattern is consistent across the platform: every entry in `SecurityConstants.SECURITY_RULES` (`SecurityConstants.java:98-355`) is a mutation (POST/PUT/DELETE); GET endpoints are not rule-gated as a matter of convention." — evidence: `AuthorizationCustomizer.java:20-31` (the `for (SecurityRule rule : SecurityConstants.SECURITY_RULES)` loop followed by `pathMatchers('/**').authenticated()`) + `SecurityConstants.java:98-355` (the rule list — `/api/dataentities/{data_entity_id}/alert_config` PUT IS at line 306 with `DATA_ENTITY_ALERT_CONFIG_UPDATE`, while `/api/dataentities/{data_entity_id}/alerts` GET has no entry) — intent_anchor: "spec.pathMatchers(\"/**\").authenticated();" (`AuthorizationCustomizer.java:29-30`) — confidence: HIGH

- "**Soft-delete-inclusive existence-check is the deliberate guard for per-entity alert reads** — `AlertServiceImpl.getDataEntityAlerts` (line 140) and `getDataEntityAlertsCounts` (line 147) both gate on `checkDataEntityExistence` (lines 327-335), which calls `dataEntityRepository.existsIncludingSoftDeleted(dataEntityId)`. The repository helper name (`existsIncludingSoftDeleted`) and its sibling (`existsNonDeletedByDataSourceId`, line 158 — which DOES apply `addSoftDeleteFilter(...)`) demonstrate that the codebase distinguishes the two soft-delete postures by helper name. The deliberate choice of `existsIncludingSoftDeleted` for the alert-read path is consistent with the `getDataEntityDetails` neighbour sidecar's observation that soft-deleted entities ARE returned by the detail page — the pattern is: 'soft-deleted entities remain readable for audit / housekeeping use cases'." — evidence: `AlertServiceImpl.java:327-335` (`checkDataEntityExistence` body explicitly calls `existsIncludingSoftDeleted`) + `ReactiveDataEntityRepositoryImpl.java:150-155` (the helper's body — no soft-delete predicate) + `ReactiveDataEntityRepositoryImpl.java:158-160` (sibling helper that DOES apply the filter; the naming pair is the convention) + `getDataEntityDetails` neighbour sidecar `invariants[1]` — intent_anchor: "existsIncludingSoftDeleted" (the method name itself encodes the intent) — confidence: HIGH

- "**Read-cardinality split between batch and per-entity reads** — the platform separates the alert read surface into TWO classes of endpoints: (a) batch reads (`getAllAlerts`, `getAssociatedUserAlerts`, `getDependentEntitiesAlerts`) which are owner-scoped via reactor `Context` at `AlertServiceImpl.listByOwner` (line 84-86) / `listDependentObjectsAlerts` (line 235-237) — except `listAll` which is unscoped (REFACTOR-024); and (b) per-entity reads (`getDataEntityAlerts`, `getDataEntityAlertsCounts`) which are unscoped by design — the caller already names the `dataEntityId` so there is no 'which entities should I see' question to answer. The implicit ADR is: 'per-entity alert reads are unscoped because the caller has already chosen the entity'. The decision-shape is visible structurally: the only filter applied at `ReactiveAlertRepositoryImpl.java:182-199` is `DATA_ENTITY.ID = :id`; there is no `OWNERSHIP` join (compare `ReactiveAlertRepositoryImpl.java:165` for `listByOwner` which DOES `.join(OWNERSHIP)`)." — evidence: `ReactiveAlertRepositoryImpl.java:182-199` (no OWNERSHIP join) + `ReactiveAlertRepositoryImpl.java:160-178` (`listByOwner` DOES OWNERSHIP join) + `AlertServiceImpl.java:138-143` (no principal pass-through) — intent_anchor: "the structural asymmetry between `getAlertsByDataEntityId` and `listByOwner` SQL shapes" — confidence: MEDIUM (structural convention with no inline comment; the pattern is visible across two methods but no `// per-entity reads are unscoped` comment defends it)

## bugs_limitations_corner_cases

- "**`GET /api/dataentities/{data_entity_id}/alerts` returns an entity's complete alert history to any authenticated user, regardless of ownership — the same cross-owner read posture as REFACTOR-024's `getAllAlerts`, applied to a per-entity surface.** The controller has no permission gate (`DataEntityController.java:315-321`), `SecurityConstants.SECURITY_RULES` has no entry for the path (`SecurityConstants.java:98-355`), and the SQL is `WHERE DATA_ENTITY.ID = :id` with no `OWNERSHIP` join (`ReactiveAlertRepositoryImpl.java:182-199`). An attacker who enumerates `data_entity_id` values via any other read endpoint (e.g. `getDataEntityDetails`, the search endpoint) can use this endpoint to read every alert ever raised on every catalogued entity, including alert chunks (raw description text propagated from ingestion / AlertManager webhooks). The live alerting doc names this endpoint as the audit-export workaround for the housekeeping bug but does NOT say whether cross-owner access is intentional. Pairs with REFACTOR-024 (catalog-wide cross-owner enumeration on `getAllAlerts`)." — evidence: `DataEntityController.java:315-321` + `AlertServiceImpl.java:138-143` + `ReactiveAlertRepositoryImpl.java:182-199` + `SecurityConstants.java:98-355` (no rule for the path) + WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/alerting` 2026-05-19 (audit-export workaround named; permission posture unspecified) — severity: HIGH

- "**Alerts on soft-deleted data entities are returned by this endpoint.** `AlertServiceImpl.getDataEntityAlerts` (line 140) gates on `existsIncludingSoftDeleted` (`AlertServiceImpl.java:327-335` → `ReactiveDataEntityRepositoryImpl.java:150-155`); the sibling `listByOwner` query DOES filter `DATA_ENTITY.STATUS != DELETED` (`ReactiveAlertRepositoryImpl.java:167`) but this per-entity path does not. The behaviour is deliberate (the helper name encodes the intent — see `implicit_adrs[1]`) and matches the audit-export workaround use case from the doc page. The side-effect: a caller who passes a soft-deleted `data_entity_id` receives a 200 OK with the entity's pre-deletion alert history; a caller passing a fully-purged ID receives 404. Operators doing audit exports should be aware that the endpoint returns audit data for entities that are no longer visible in the catalog UI. Severity: LOW (the behaviour is intentional and useful for the audit workaround; the gap is documentation, not code)." — evidence: `AlertServiceImpl.java:327-335` (the existence-check uses `existsIncludingSoftDeleted`) + `ReactiveDataEntityRepositoryImpl.java:150-155` (no soft-delete predicate) + `ReactiveAlertRepositoryImpl.java:166-167` (`listByOwner` DOES filter status != DELETED) + WebFetch alerting page 2026-05-19 (the doc does not mention the soft-delete-inclusive read posture) — severity: LOW

- "**Pagination parameters are unbounded at every layer this method touches** — the controller does not validate `page` or `size`; the OpenAPI `PageParam` / `SizeParam` at `components.yaml:4213-4229` carry no `minimum:` or `maximum:`; the repository computes `OFFSET = (page - 1) * size` (`ReactiveAlertRepositoryImpl.java:189`) with no clamping. A caller passing `size=1_000_000` triggers a single jOOQ query bounded only by what Postgres / network buffers tolerate; a caller passing `page=0` produces a negative OFFSET and downstream behaviour is implementation-defined. The doc page recommends this endpoint for audit-export use cases but never names a recommended `size` value — operators may default to small page sizes and silently truncate exports OR may default to large page sizes and degrade server response time on high-volume entities." — evidence: `DataEntityController.java:317-318` (`Integer page, Integer size` without validation annotations) + `openapi.yaml:1326-1329` (parameter refs) + `components.yaml:4213-4229` (no minimum/maximum) + `ReactiveAlertRepositoryImpl.java:189` (`(page - 1) * size`) — severity: MEDIUM

- "**No alert-status filter on the listing endpoint, while the sibling counts endpoint accepts one.** `getDataEntityAlertsCounts` (`DataEntityController.java:324-330`) accepts an `AlertStatus status` query param and filters the count by status (`ReactiveAlertRepositoryImpl.java:202-215`); `getDataEntityAlerts` does NOT — it always returns ALL statuses (OPEN, RESOLVED, RESOLVED_AUTOMATICALLY). The asymmetry means: (a) a caller wanting only OPEN alerts must paginate the full set and filter client-side, or hit `getDataEntityAlertsCounts(status=OPEN)` for the count and `getDataEntityAlerts` for an unfiltered page (mismatch on totals); (b) the audit-export workaround from the doc page returns RESOLVED rows that may be deleted on the next housekeeping cycle (intentional — that's the use case) but also returns OPEN rows the operator may not want in the export. No comment or annotation defends the asymmetry as intentional." — evidence: `DataEntityController.java:315-321` (no status param) + `DataEntityController.java:324-330` (sibling counts endpoint with status param) + `ReactiveAlertRepositoryImpl.java:182-199` (no status filter in the listing query) + `ReactiveAlertRepositoryImpl.java:202-215` (counts query DOES filter by status) — severity: LOW

- "**Under `auth.type=DISABLED`, this endpoint becomes anonymously reachable** — the missing `SecurityRule` entry combined with the DISABLED auth mode means any unauthenticated client on the network can read every alert ever raised on every catalogued entity by enumerating `data_entity_id`. DISABLED is documented as a dev-only mode, but operators who misuse it expose the full alert audit trail across the platform." — evidence: `DataEntityController.java:315-321` + `SecurityConstants.java:98-355` (no rule for the path) + AlertController.getAllAlerts neighbour sidecar `bugs_limitations_corner_cases[2]` (same pattern documented for the batch read endpoint) — severity: MEDIUM

- "**No HTTP-level test exists for `GET /api/dataentities/{data_entity_id}/alerts` — a regression in OpenAPI routing generation, WebFlux configuration, Jackson serialisation, the existence-check, or the jOOQ repository would silently break this endpoint with the build still green.** Smallest reproducer: `@WebFluxTest(DataEntityController.class)` + `WebTestClient.get().uri('/api/dataentities/1/alerts?page=1&size=10').exchange().expectStatus().isOk()`. The cross-owner read posture and the soft-delete-inclusive existence-check are also uncovered." — evidence: `find <odd-platform> -path '*test*' -name 'DataEntityController*'` and `find <odd-platform> -path '*test*' -name 'AlertServiceImpl*'` both returned no matches (run 2026-05-19) — severity: MEDIUM

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` (the three modes that protect the UI/API surface this controller is mounted on). Under `DISABLED` the endpoint is anonymously reachable. The method itself carries no `@ConditionalOnProperty`; auth wiring is enforced globally by the `*SecurityConfiguration` beans (cross-reference: AlertController class sidecar's verified auth-mode wiring). `S2S` is not relevant — S2S protects `/ingestion/entities` only, not `/api/dataentities/{id}/alerts`.

- **ingestion_filter_relevance**: `NO — UI/API surface, not /ingestion/entities`. The `IngestionDataEntitiesFilter` matches `/ingestion/entities` POST only; `GET /api/dataentities/{id}/alerts` does not match.

- **authorization_assertions**: [] — `DataEntityController.java:315-321` carries no `@PreAuthorize`, no `@Secured`, no programmatic `permissionService.hasPermission(...)` call. `SecurityConstants.SECURITY_RULES` (`SecurityConstants.java:98-355`) contains no entry for `GET /api/dataentities/{data_entity_id}/alerts` (the related `PUT /api/dataentities/{data_entity_id}/alert_config` IS gated at line 306 with `DATA_ENTITY_ALERT_CONFIG_UPDATE`; the read path is NOT). The path falls through to `pathMatchers('/**').authenticated()` (`AuthorizationCustomizer.java:29-30`). Authentication is required; authorization is not enforced.

- **owner_scoping**: `BYPASSES — returns data across owners (no admin path either — every authenticated caller is treated identically)`. The method passes only `(dataEntityId, page, size)` to `alertService.getDataEntityAlerts` (`DataEntityController.java:320`); the service calls `dataEntityRepository.existsIncludingSoftDeleted(dataEntityId)` + `alertRepository.getAlertsByDataEntityId(id, page, size)` (`AlertServiceImpl.java:138-143`); the repository executes `select(ALERT.fields()).from(ALERT).join(DATA_ENTITY).on(DATA_ENTITY.ODDRN.eq(ALERT.DATA_ENTITY_ODDRN)).where(DATA_ENTITY.ID.eq(dataEntityId))` (`ReactiveAlertRepositoryImpl.java:182-187`) — no `OWNERSHIP` join, no principal-derived predicate. Every authenticated caller sees every alert for every data entity ID they choose to pass.

- **data_exposure**:
  - "AlertList payload (alert id, status, lastReason, severity, dataEntity ref, status_updated_by owner identity, alert_chunk_list with descriptions including AlertManager-derived raw generator-URL text) for a caller-chosen data_entity_id → ANY authenticated user under LOGIN_FORM/OAUTH2/LDAP via `GET /api/dataentities/{data_entity_id}/alerts` — no Permission/Role gate, no owner filter at any layer of the controller → service → repository chain" — evidence: `DataEntityController.java:315-321` + `AlertServiceImpl.java:138-143` + `ReactiveAlertRepositoryImpl.java:182-199`
  - "Same payload → ANONYMOUS callers under `auth.type=DISABLED`" — evidence: `DataEntityController.java:315-321` + absence of `SecurityRule` entry in `SecurityConstants.java:98-355`
  - "Alert chunks for SOFT-DELETED data entities → any caller passing the soft-deleted entity's ID — the soft-delete-inclusive existence-check at `AlertServiceImpl.java:327-335` admits these reads. Operators are unlikely to know the soft-deleted ID via the UI (the UI filters deleted entities from the catalog list), but the IDs are stable and obtainable from prior audit data or from API enumeration." — evidence: `AlertServiceImpl.java:327-335` + `ReactiveDataEntityRepositoryImpl.java:150-155`

- **known_security_gaps**:
  - "`GET /api/dataentities/{data_entity_id}/alerts` has no entry in `SecurityConstants.SECURITY_RULES` (`SecurityConstants.java:98-355`) and falls through to the catch-all `pathMatchers('/**').authenticated()` (`AuthorizationCustomizer.java:29-30`). The downstream `getAlertsByDataEntityId` query has no `OWNERSHIP` join (`ReactiveAlertRepositoryImpl.java:182-199`). This is the cross-owner read pattern of REFACTOR-024 applied to a per-entity surface — combined with `getDataEntityDetails`'s lack of authorization, an authenticated caller can enumerate `data_entity_id` values via the search/list endpoints and then read every alert on every catalogued entity. The live alerting doc names this endpoint as an audit-export workaround but does not specify owner-scoping; the page is silent on whether the cross-owner posture is intentional. Pairs with REFACTOR-024." — evidence: `DataEntityController.java:315-321` + `SecurityConstants.java:98-355` + `AuthorizationCustomizer.java:29-30` + `ReactiveAlertRepositoryImpl.java:182-199` + WebFetch alerting page 2026-05-19 — severity: HIGH
  - "Asymmetry with sibling endpoint pair: the **mutation** endpoint on the same entity-scoped namespace — `PUT /api/dataentities/{data_entity_id}/alert_config` — IS registered in `SecurityConstants.SECURITY_RULES` (`SecurityConstants.java:304-307`) and pairs the `DATA_ENTITY` resource type with the `DATA_ENTITY_ALERT_CONFIG_UPDATE` permission. The **read** endpoint `GET /api/dataentities/{data_entity_id}/alerts` is absent from the rule list. No comment, annotation, or surrounding code defends the read/write asymmetry as intentional — the absence of permission gates on GET endpoints is a class-wide convention (see `implicit_adrs[0]`), but the convention itself has no inline justification." — evidence: `SecurityConstants.java:98-355` (only mutations in the rule list) + `SecurityConstants.java:304-307` (the sibling `alert_config` PUT is rule-gated) — severity: MEDIUM (the asymmetry; the broader convention is documented under `implicit_adrs[0]`)
  - "Soft-deleted data entities' alert history is reachable through this endpoint while being hidden from the catalog list endpoints. The cross-channel leak (visible via alerts API + invisible in catalog list API) is consistent with the platform's audit-export use case but creates a discovery surface: an attacker who has prior knowledge of a soft-deleted entity's ID (e.g. from a leaked audit log, from prior credentials, or from monotonically-increasing ID enumeration) can read the alert history that the operators thought was hidden by the soft-delete." — evidence: `AlertServiceImpl.java:327-335` + `ReactiveDataEntityRepositoryImpl.java:150-155` + WebFetch alerting page 2026-05-19 (no mention of soft-delete behaviour) — severity: LOW

## performance

- **hot_paths**:
  - "Per-tab-activation request on the ODD Platform UI's data-entity `Alerts` tab — every time a user navigates to a data-entity detail page and opens the Alerts tab, this endpoint fires alongside (potentially) `getDataEntityAlertsCounts`. On platforms with hundreds of catalogued entities and many active alerts, this is among the more frequently hit per-entity endpoints (less hot than `getDataEntityDetails` which fires on every entity navigation, but higher than the alert-config endpoints which fire only when an operator opens Notification Settings)." — evidence: `DataEntityController.java:315-321` + `ReactiveAlertRepositoryImpl.java:182-199` + WebFetch alerting page 2026-05-19 (`each affected entity's own Alerts tab`)
  - "Audit-export workaround request — operators following the doc page's housekeeping-bug workaround hit this endpoint immediately before manually resolving every alert. Volume scales with manual-resolution traffic; not hot on a per-second basis but burst-y around incident response windows." — evidence: WebFetch alerting page 2026-05-19 (workaround named verbatim)

- **throughput_characteristics**:
  - "Single reactive call — `Mono<ResponseEntity<AlertList>>`; non-blocking I/O; no thread is held during the DB await" — evidence: `DataEntityController.java:316-321`
  - "Two DB round-trips per request: (1) the existence-check `selectExists` (`ReactiveDataEntityRepositoryImpl.java:150-155`) and (2) the alert-listing select + count via `pageifyResult` (`ReactiveAlertRepositoryImpl.java:191-198`). The two round-trips are sequential (the alert-listing depends on the existence-check resolving to `id` first), not parallel." — evidence: `AlertServiceImpl.java:138-143` (flatMap chain)
  - "No batch / bulk variant — this is a read-only per-entity listing; bulk concerns apply to the batch `getAllAlerts` endpoint" — evidence: `DataEntityController.java:316-319`

- **resource_allocation**:
  - "Per-request allocations bounded by `size` — the repository emits a `Page<AlertDto>` whose `data` list is at most `size` rows; `AlertMapper.mapAlerts` maps each into an `AlertList` item. With no upper bound on `size` (see `bugs_limitations_corner_cases[2]`), peak memory is proportional to the caller-supplied page size — and the AlertManager-derived chunks carry raw generator-URL strings which can be arbitrarily long." — evidence: `ReactiveAlertRepositoryImpl.java:189-198` + `AlertServiceImpl.java:142`
  - "Pagination `OFFSET` is computed as `(page - 1) * size` (`ReactiveAlertRepositoryImpl.java:189`) — for deep pages, Postgres must scan and discard `(page - 1) * size` rows before returning the requested window. Cost grows linearly with deep pagination; keyset pagination would be O(1) but is not implemented here." — evidence: `ReactiveAlertRepositoryImpl.java:189`

- **scaling_characteristics**:
  - "Stateless controller method — horizontal scaling unconstrained at this layer" — evidence: `DataEntityController.java:315-321` (no instance state in the method)
  - "Two DB round-trips per request (existence-check + page+count) through `pageifyResult` — `ReactiveAlertRepositoryImpl.java:191-198`" — evidence: `ReactiveAlertRepositoryImpl.java:182-199`
  - "No upper bound on `size` — a caller supplying `size=1_000_000` triggers a single large jOOQ query plus an in-memory list mapping; the controller does not clamp, the OpenAPI contract does not constrain (`components.yaml:4213-4229` has no min/max), and the repository does not validate. Operators following the doc page's audit-export workaround may default to large pages to avoid pagination round-trips." — evidence: `DataEntityController.java:317-318` + `components.yaml:4213-4229` + `ReactiveAlertRepositoryImpl.java:182-199`

- **known_performance_gaps**:
  - "No upper bound on pagination `size` — see `scaling_characteristics[2]` and `bugs_limitations_corner_cases[2]`. A malicious or careless `size=1_000_000` produces an arbitrarily large response body and an unbounded jOOQ query. The audit-export workaround use case amplifies the risk: operators will naturally want large pages to complete an export with fewer round-trips." — evidence: `DataEntityController.java:317-318` + `components.yaml:4213-4229` + `ReactiveAlertRepositoryImpl.java:189-198` — severity: MEDIUM
  - "Deep-pagination cost — `OFFSET = (page - 1) * size` means cost grows linearly with `page`; keyset pagination not implemented" — evidence: `ReactiveAlertRepositoryImpl.java:189` — severity: LOW
  - "Two DB round-trips per request (existence-check + page) — could be collapsed to one query with an outer LEFT JOIN that returns either the entity existence flag and the alerts in a single pass, but the current implementation chains them via reactor `flatMap`. The cost is real on high-traffic platforms where each round-trip adds ~1-5ms of DB connection-pool latency." — evidence: `AlertServiceImpl.java:138-143` + `ReactiveDataEntityRepositoryImpl.java:150-155` + `ReactiveAlertRepositoryImpl.java:182-199` — severity: LOW
  - "No caching / `Cache-Control` / ETag — every UI tab activation re-runs both queries; for entities with high alert volume and frequent tab switches this is a per-render DB hit" — evidence: `DataEntityController.java:315-321` (no headers set) + `AlertServiceImpl.java:138-143` (no caching) — severity: LOW
  - "No method-level observability — no `@Timed`, no Micrometer counter, no structured log entry. Latency regressions on this hot path would surface only in DB / WebFlux metrics, not at the controller boundary." — evidence: `DataEntityController.java:315-321` — severity: LOW

## sources

- understanding ← `DataEntityController.java:315-321` (the one-line method body) + `AlertServiceImpl.java:138-143` (downstream service) + `ReactiveAlertRepositoryImpl.java:182-199` (downstream repository, no owner predicate) + `AlertServiceImpl.java:327-335` (existence-check uses `existsIncludingSoftDeleted`) + `ReactiveDataEntityRepositoryImpl.java:150-155` (the helper body)
- concepts.entities ← `DataEntityController.java:12, 316` (`AlertList` import and return type) + `ReactiveAlertRepositoryImpl.java:182` (`Page<AlertDto>`) + `AlertServiceImpl.java:330` (`NotFoundException` construction)
- concepts.operations ← `DataEntityController.java:315-321` + `AlertServiceImpl.java:138-143` + `ReactiveAlertRepositoryImpl.java:182-199`
- concepts.invariants[0] ← `DataEntityController.java:316-321` (return type + `.map(ResponseEntity::ok)`)
- concepts.invariants[1] ← `DataEntityController.java:317-318` (no annotations on controller params) + `components.yaml:4213-4229` (no minimum/maximum on PageParam/SizeParam)
- concepts.invariants[2] ← `DataEntityController.java:316-319` (signature lists only `dataEntityId, page, size, ServerWebExchange`; no security-context read) + `AlertServiceImpl.java:138-143` (service signature takes no principal) + `ReactiveAlertRepositoryImpl.java:182-199` (repository has no principal-derived predicate)
- concepts.invariants[3] ← `AlertServiceImpl.java:327-335` + `ReactiveDataEntityRepositoryImpl.java:150-155` + `ReactiveDataEntityRepositoryImpl.java:158-160` (the sibling that DOES filter; the naming pair encodes intent)
- concepts.invariants[4] ← `DataEntityController.java:315-321` (no status param) + `DataEntityController.java:324-330` (sibling counts endpoint with status param) + `ReactiveAlertRepositoryImpl.java:182-199` (no status filter in the listing query)
- concepts.audiences ← WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/alerting` 2026-05-19 status 200 (fetched excerpts under `docs_link_semantic.inferred_docs[0]`)
- dependencies_semantic.requires-feature[0] ← WebFetch alerting page 2026-05-19 status 200
- dependencies_semantic.requires-feature[1] ← `openapi.yaml:1321` (path mount under `/api/dataentities/{data_entity_id}/...`)
- dependencies_semantic.requires-runtime[0] ← `DataEntityController.java:63-65, 316-319`
- dependencies_semantic.requires-runtime[1] ← `ReactiveAlertRepositoryImpl.java:182-199`
- dependencies_semantic.requires-runtime[2] ← `AlertServiceImpl.java:140-142` (flatMap composition)
- dependencies_semantic.couples-to[0] ← `openapi.yaml:1321-1338` + `components.yaml:4213, 4222, 4250` (parameter definitions)
- dependencies_semantic.couples-to[1] ← `DataEntityController.java:51, 74, 320` (`AlertService` import, field, call) + `AlertService.java:26` (interface) + `AlertServiceImpl.java:138-143`
- dependencies_semantic.couples-to[2] ← `AlertServiceImpl.java:70, 141` (repository field + call) + `ReactiveAlertRepositoryImpl.java:182-199`
- dependencies_semantic.couples-to[3] ← `AlertServiceImpl.java:71, 140, 328` + `ReactiveDataEntityRepositoryImpl.java:150-155`
- tests_coverage_semantic.test_files ← `find <odd-platform> -path '*test*' -name 'DataEntityController*'` and `find <odd-platform> -path '*test*' -name 'AlertServiceImpl*'` returned zero matches (run 2026-05-19)
- docs_link_semantic.inferred_docs[0] ← WebFetch `https://docs.opendatadiscovery.org/features/active-platform-features/alerting` 2026-05-19 status 200
- docs_link_semantic.inferred_docs[1] ← AlertController.getAllAlerts neighbour sidecar's WebFetch result for the authorization page (no fresh fetch this session)
- docs_link_semantic.doc_drift_findings[0] ← WebFetch alerting page 2026-05-19 (audit-export workaround named; permission posture unspecified) + `DataEntityController.java:315-321` + `SecurityConstants.java:98-355` + `ReactiveAlertRepositoryImpl.java:182-199`
- docs_link_semantic.doc_drift_findings[1] ← WebFetch alerting page 2026-05-19 (workaround text does not mention pagination) + `ReactiveAlertRepositoryImpl.java:189-198` (pagination shape)
- implicit_adrs[0] ← `AuthorizationCustomizer.java:20-31` (the rule-loop + catch-all `.authenticated()` pattern) + `SecurityConstants.java:98-355` (rule list shape — all entries are mutations; GET endpoints are absent)
- implicit_adrs[1] ← `AlertServiceImpl.java:327-335` (the existence-check body) + `ReactiveDataEntityRepositoryImpl.java:150-155` (the helper body) + `ReactiveDataEntityRepositoryImpl.java:158-160` (the sibling that DOES filter; the naming pair is the convention) + `getDataEntityDetails` neighbour sidecar `invariants[1]` (same soft-delete-inclusive pattern documented for the detail page)
- implicit_adrs[2] ← `ReactiveAlertRepositoryImpl.java:182-199` (no OWNERSHIP join) + `ReactiveAlertRepositoryImpl.java:160-178` (`listByOwner` DOES OWNERSHIP join — structural asymmetry confirms the per-entity-reads-are-unscoped pattern)
- bugs_limitations_corner_cases[0] ← `DataEntityController.java:315-321` + `AlertServiceImpl.java:138-143` + `ReactiveAlertRepositoryImpl.java:182-199` + `SecurityConstants.java:98-355` + WebFetch alerting page 2026-05-19
- bugs_limitations_corner_cases[1] ← `AlertServiceImpl.java:327-335` + `ReactiveDataEntityRepositoryImpl.java:150-155` + `ReactiveAlertRepositoryImpl.java:166-167` (the sibling that DOES filter) + WebFetch alerting page 2026-05-19
- bugs_limitations_corner_cases[2] ← `DataEntityController.java:317-318` + `openapi.yaml:1326-1329` + `components.yaml:4213-4229` + `ReactiveAlertRepositoryImpl.java:189`
- bugs_limitations_corner_cases[3] ← `DataEntityController.java:315-321` + `DataEntityController.java:324-330` (the sibling counts endpoint with status param) + `ReactiveAlertRepositoryImpl.java:182-199` + `ReactiveAlertRepositoryImpl.java:202-215`
- bugs_limitations_corner_cases[4] ← `DataEntityController.java:315-321` + `SecurityConstants.java:98-355` + AlertController.getAllAlerts neighbour sidecar (same DISABLED-anonymous-reach pattern)
- bugs_limitations_corner_cases[5] ← `find <odd-platform> -path '*test*' -name 'DataEntityController*'` empty result + same for `AlertServiceImpl*`
- security.auth_mode_relevance ← `DataEntityController.java:315-321` (no `@ConditionalOnProperty`) + AlertController class-level sidecar's verified auth-mode wiring
- security.ingestion_filter_relevance ← AlertController class-level sidecar's verified `IngestionDataEntitiesFilter` path-matcher
- security.authorization_assertions ← `DataEntityController.java:315-321` (no security annotations) + `SecurityConstants.java:98-355` (no rule entry for `/api/dataentities/{id}/alerts` GET) + `SecurityConstants.java:304-307` (the related `alert_config` PUT IS gated — contrast) + `AuthorizationCustomizer.java:29-30` (catch-all `.authenticated()`)
- security.owner_scoping ← `DataEntityController.java:315-321` (no principal pass-through) + `AlertServiceImpl.java:138-143` (no owner argument) + `ReactiveAlertRepositoryImpl.java:182-199` (no OWNERSHIP join, no principal predicate)
- security.data_exposure[0] ← `DataEntityController.java:315-321` + `AlertServiceImpl.java:138-143` + `ReactiveAlertRepositoryImpl.java:182-199`
- security.data_exposure[1] ← `DataEntityController.java:315-321` + `SecurityConstants.java:98-355`
- security.data_exposure[2] ← `AlertServiceImpl.java:327-335` + `ReactiveDataEntityRepositoryImpl.java:150-155`
- security.known_security_gaps[0] ← `DataEntityController.java:315-321` + `SecurityConstants.java:98-355` + `AuthorizationCustomizer.java:29-30` + `ReactiveAlertRepositoryImpl.java:182-199` + WebFetch alerting page 2026-05-19
- security.known_security_gaps[1] ← `SecurityConstants.java:98-355` (all entries are mutations) + `SecurityConstants.java:304-307` (`alert_config` PUT IS gated)
- security.known_security_gaps[2] ← `AlertServiceImpl.java:327-335` + `ReactiveDataEntityRepositoryImpl.java:150-155` + WebFetch alerting page 2026-05-19 (silent on soft-delete behaviour)
- performance.hot_paths[0] ← `DataEntityController.java:315-321` + `ReactiveAlertRepositoryImpl.java:182-199` + WebFetch alerting page 2026-05-19 (`Alerts tab` per entity)
- performance.hot_paths[1] ← WebFetch alerting page 2026-05-19 (workaround named verbatim)
- performance.throughput_characteristics[0] ← `DataEntityController.java:316-321`
- performance.throughput_characteristics[1] ← `AlertServiceImpl.java:140-142` (flatMap chain — sequential, not parallel)
- performance.throughput_characteristics[2] ← `DataEntityController.java:316-319` (read-only listing — no mutation/bulk shape here)
- performance.resource_allocation[0] ← `ReactiveAlertRepositoryImpl.java:189-198` + `AlertServiceImpl.java:142`
- performance.resource_allocation[1] ← `ReactiveAlertRepositoryImpl.java:189` (`(page - 1) * size` as OFFSET)
- performance.scaling_characteristics[0] ← `DataEntityController.java:315-321` (no instance state in the method)
- performance.scaling_characteristics[1] ← `ReactiveAlertRepositoryImpl.java:191-198` (`pageifyResult` issues both the page query and the count query)
- performance.scaling_characteristics[2] ← `DataEntityController.java:317-318` + `components.yaml:4213-4229` + `ReactiveAlertRepositoryImpl.java:182-199`
- performance.known_performance_gaps[0] ← `DataEntityController.java:317-318` + `components.yaml:4213-4229` + `ReactiveAlertRepositoryImpl.java:189-198`
- performance.known_performance_gaps[1] ← `ReactiveAlertRepositoryImpl.java:189`
- performance.known_performance_gaps[2] ← `AlertServiceImpl.java:138-143` + `ReactiveDataEntityRepositoryImpl.java:150-155` + `ReactiveAlertRepositoryImpl.java:182-199`
- performance.known_performance_gaps[3] ← `DataEntityController.java:315-321` + `AlertServiceImpl.java:138-143`
- performance.known_performance_gaps[4] ← `DataEntityController.java:315-321`

## confidence_per_field

- understanding: HIGH (every claim verified against the source file, the service implementation, and the repository implementation at cited lines)
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (absence-of-tests verified by file-system search 2026-05-19)
- docs_link_semantic: MEDIUM (no `@docs` annotation in source; the alerting URL WebFetched 2026-05-19 status 200; the binding endpoint → doc is enricher judgment, not maintainer-declared)
- implicit_adrs: HIGH (centralised-rules pattern structurally visible at `AuthorizationCustomizer.java:20-31` + `SecurityConstants.java:98-355`; soft-delete-inclusive intent encoded in the helper name `existsIncludingSoftDeleted` + the sibling-helper naming pair; per-entity-unscoped read pattern structurally visible in the SQL asymmetry between `getAlertsByDataEntityId` and `listByOwner`)
- bugs_limitations_corner_cases: HIGH (every gap verified file:line against the controller, service, repository, security-rule list, OpenAPI parameter shape, and live doc fetched excerpts; routing per file-analyser 0.3.0 — these are absence observations without defending intent visible in the file, so they route here rather than `implicit_adrs`)
- security: HIGH (every claim is structural and traces to the controller, service, repository, `SecurityConstants`, `AuthorizationCustomizer`, the soft-delete-inclusive existence-check, and the live alerting page)
- performance: HIGH (pagination plumbing, OFFSET computation, the two-round-trip shape, absence of caching/observability are all directly visible at cited lines)

## Maintainer notes

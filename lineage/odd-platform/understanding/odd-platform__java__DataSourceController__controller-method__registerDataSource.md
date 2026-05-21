---
node_id: "odd-platform java DataSourceController controller-method:registerDataSource"
node_kind: controller-method
axis: controllers
extracted_at_commit: 80637ed
enriched_at_commit: 80637ed
extractor_version: 0.1.0
prompt_version: file-analyser/0.5.0
enrichment_status: complete
confidence_overall: MEDIUM
session_id: session-2026-05-21-batch-ZB-registerDataSource
---

# registerDataSource — POST /api/datasources — semantic understanding

## understanding

`registerDataSource` is the create endpoint of the Management → Datasources tab:
the 5-line controller handler (`DataSourceController.java:30-36`) for `POST
/api/datasources`, the operator-facing path to add a data source by hand (the
UI's "+ Add datasource" button). It receives a reactive `Mono<DataSourceFormData>`
request body, `flatMap`s it into `dataSourceService.create(form)`, and wraps the
result with `ResponseEntity::ok` (HTTP 200). All behaviour lives in
`DataSourceServiceImpl.create` (`DataSourceServiceImpl.java:51-66`, annotated
`@ReactiveTransactional`): it mints a fresh 40-char token, optionally creates the
named namespace, rejects an empty ODDRN with HTTP 400, inserts the `data_source`
row, and returns a `DataSource` model whose `token.value` is the plaintext
secret. This endpoint is DISJOINT from the S2S collector-driven creation path
`IngestionController.createDataSourceEntity` (`/ingestion/datasources`) — same
`data_source` table, separate auth model (RBAC `DATA_SOURCE_CREATE` + UI session
vs collector token), separate service class, separate mutation semantics
(operator picks the namespace here; a collector inherits its namespace there).

## concepts

- entities:
  - "DataSourceFormData (request body — exactly 4 fields per the OpenAPI schema components.yaml:1303-1315: `name` [required], `namespace_name`, `oddrn`, `description`; deserialized reactively from the JSON body)"
  - "DataSource (response model — components.yaml:1249-1269; required fields id/token/oddrn/name; the `token` sub-object carries a plaintext `value` string)"
  - "Token (response sub-object — components.yaml:1327-1334; `id`, `value`, `created_by`, `created_at`; minted fresh on every register call)"
  - "Namespace (optional sub-object — created or fetched by name when `namespace_name` is non-empty)"
  - "DataSourceService (interface; `create` method delegated to from this handler)"
  - "Mono<ResponseEntity<DataSource>> (the single reactive response shape, DataSourceController.java:31)"
- operations:
  - "register (POST /api/datasources) — create a new data source: mint a token, optionally get-or-create a namespace, validate ODDRN non-empty, INSERT the data_source row, return the persisted DataSource with plaintext token"
- invariants:
  - "ODDRN must be non-empty: `createDataSource` throws `BadUserRequestException(\"ODDRN must be filled for data source\")` (DataSourceServiceImpl.java:119-120) — note ODDRN is OPTIONAL in the OpenAPI schema (components.yaml:1314-1315 lists only `name` as required) but de-facto required at runtime"
  - "ODDRN is trimmed before persistence: `DataSourceMapper.mapForm` maps `oddrn` via `expression = \"java(form.getOddrn().trim())\"` (DataSourceMapper.java:38)"
  - "A new token is ALWAYS minted on register — `tokenGenerator.generateToken()` is unconditional (DataSourceServiceImpl.java:54); there is no caller-supplied-token path"
  - "Namespace creation is conditional on `namespace_name` being non-empty (`StringUtils.isNotEmpty`, DataSourceServiceImpl.java:56); an empty/absent namespace_name yields a data source with `namespace_id = NULL`"
  - "The handler has NO @PostMapping / @RequestMapping — path + verb come from the OpenAPI-generated `DataSourceApi` interface this controller @Overrides (DataSourceController.java:18)"
  - "The handler has NO @PreAuthorize and NO programmatic permission check — authorization is path-based via SecurityConstants.SECURITY_RULES"
- audiences:
  - "platform-operator (registers a data source via the Management → Datasources tab '+ Add datasource' button — per the live doc page WebFetched 2026-05-21 status 200)"
  - "odd-api-consumer (programmatic clients with an authenticated UI session or S2S X-API-Key hitting POST /api/datasources directly)"

## dependencies_semantic

- requires-feature:
  - "`DataSourceApi` OpenAPI-generated interface — declares the `registerDataSource` signature + the `POST /api/datasources` mapping (openapi.yaml:443-461). The handler @Overrides it (DataSourceController.java:30-31)."
  - "`DataSourceService.create` → `DataSourceServiceImpl.create` (DataSourceServiceImpl.java:51-66) — owns ALL register logic."
  - "`TokenGenerator` → `TokenGeneratorImpl` (TokenGeneratorImpl.java:18-24) — `generateToken()` mints `RandomStringUtils.randomAlphanumeric(40)` and stamps created_by from the current user (or null)."
  - "`ReactiveTokenRepository.create` → `ReactiveTokenRepositoryImpl.create` (ReactiveTokenRepositoryImpl.java:20-27) — `INSERT INTO token ... returning`; constructs `new TokenDto(pojo, true)` where `true` is the `showToken` flag."
  - "`NamespaceService.getOrCreate` → `NamespaceServiceImpl.getOrCreate` (NamespaceServiceImpl.java:37-40) — `namespaceRepository.getByName(name).switchIfEmpty(namespaceRepository.createByName(name))` — CREATES a namespace if absent."
  - "`DataSourceMapper` (DataSourceMapper.java:38-47) — `mapForm(form, namespace, token)`: trims ODDRN, stamps `namespace_id` + `token_id` onto the new `DataSourcePojo`."
  - "`ReactiveDataSourceRepository.create` — `INSERT INTO data_source`; the ODDRN partial-unique index raises `UniqueConstraintException` (SQLSTATE 23505) on a live-ODDRN collision (per ReactiveDataSourceRepositoryImpl batch-R sidecar)."
  - "`ControllerAdvice` (controller/exception/ControllerAdvice.java:24-26) — `@ExceptionHandler(BadUserRequestException.class)` + `@ResponseStatus(HttpStatus.BAD_REQUEST)`; maps the empty-ODDRN and unique-constraint errors to HTTP 400."
- requires-config:
  - "`auth.type` (DISABLED / LOGIN_FORM / OAUTH2 / LDAP) — gates whether the POST reaches the controller. Under LOGIN_FORM/OAUTH2/LDAP the path-based rule DATA_SOURCE_CREATE applies; under DISABLED the platform's RBAC has no principal and the endpoint is open (per the class sidecar's DISABLED-mode analysis + REFACTOR-185 cluster)."
  - "`auth.s2s.enabled` (default false) — when true, an X-API-Key holder is granted ADMIN, satisfying DATA_SOURCE_CREATE; an S2S caller can register a data source regardless of any per-user policy."
  - "`spring.codec.max-in-memory-size` (application.yml:14-15, 20MB) — bounds the `Mono<DataSourceFormData>` body deserialization; a >20MB body throws `DataBufferLimitException` → 500 (no 413 mapping)."
- requires-runtime:
  - "Spring WebFlux + Reactor — `registerDataSource` returns `Mono<ResponseEntity<DataSource>>`; the body is deserialized via the reactive codec."
  - "`@ReactiveTransactional` on `DataSourceServiceImpl.create` (line 52) — holds one R2DBC connection across the token-insert + namespace-getOrCreate + data_source-insert chain."
  - "`ReactiveSecurityContextHolder` — `TokenGeneratorImpl.generateToken` reads the current user via `authIdentityProvider.getCurrentUser()` to stamp `token.created_by` (TokenGeneratorImpl.java:20-23); falls back to null username when no principal exists."
- coupling:
  - "Path + verb are OpenAPI-contract-driven; a change to openapi.yaml:443-461 propagates to the generated `DataSourceApi` and this @Override must match or compilation fails."
  - "RBAC is declaratively coupled via `SecurityConstants.SECURITY_RULES` (SecurityConstants.java:116-117) — NOT @PreAuthorize. A future register-variant endpoint added without a matching SecurityRule silently falls through to authenticated-only (the fail-open shape)."
  - "Transactional coupling: the token row, the namespace row, and the data_source row are created within ONE @ReactiveTransactional boundary — a failure in any write should roll back the others (verified-by-probe — see stress_findings / P-041)."

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "Happy-path register: POST /api/datasources with a complete DataSourceFormData returns the persisted DataSource (id assigned, token minted)."
    test_class: integration
    criticality: HIGH
    note: "No DataSourceControllerTest or DataSourceServiceImplTest exists (verified by Glob in the batch-W class sidecar — both returned no files)."
  - behaviour: "Empty-ODDRN rejection: POST with `oddrn=''` (or absent) returns HTTP 400 BadUserRequestException; no token / namespace / data_source row is committed."
    test_class: integration
    criticality: HIGH
    note: "DataSourceServiceImpl.java:119-120 throws inside the @ReactiveTransactional boundary."
  - behaviour: "ODDRN unique-constraint collision: POST with an oddrn matching a LIVE data_source returns HTTP 400 UniqueConstraintException."
    test_class: integration
    criticality: HIGH
  - behaviour: "Implicit namespace creation under least-privilege: a principal with DATA_SOURCE_CREATE but NOT NAMESPACE_CREATE successfully creates a brand-new namespace via the `namespace_name` field."
    test_class: security
    criticality: HIGH
    note: "The escalation-by-side-effect finding; probe P-039."
  - behaviour: "Plaintext token in the registration response: the POST response body's `token.value` is the unredacted 40-char secret, whereas GET /api/datasources redacts it."
    test_class: security
    criticality: MEDIUM
    note: "Probe P-040."
  - behaviour: "201-vs-200 status: POST /api/datasources returns HTTP 200, contradicting the OpenAPI-declared 201."
    test_class: integration
    criticality: MEDIUM
    note: "Probe P-038."
  - behaviour: "Transaction rollback on collision: a failed register (ODDRN collision) leaves NO orphan token row and NO orphan namespace row."
    test_class: integration
    criticality: HIGH
    note: "Probe P-041."
  - behaviour: "No Activity Event is emitted on register — the create is invisible to the Activity Feed."
    test_class: integration
    criticality: MEDIUM
  - behaviour: "Body over spring.codec.max-in-memory-size (20MB) is rejected — confirm the failure mode (500, not 413)."
    test_class: integration
    criticality: LOW
- test_files:
  - "NO `DataSourceControllerTest.*` exists in the test tree (verified in the batch-W class sidecar via Glob)."
  - "NO `DataSourceServiceImplTest.*` exists (verified in the batch-W class sidecar)."
- gaps: |
    The register endpoint and its service have ZERO direct test coverage. The
    highest-leverage gap is a SECURITY integration test for the implicit
    namespace-creation escalation (probe P-039): without it, a refactor that
    keeps `namespaceService.getOrCreate` on the register path but tightens the
    direct namespace endpoint would leave the bypass undetected. The second
    priority is the transaction-rollback integration test (P-041) — it is the
    only test that protects the @ReactiveTransactional invariant that a failed
    register does not leak orphan token/namespace rows. The worst-covered class
    here is `security`: the DATA_SOURCE_CREATE gate, the namespace bypass, and
    the plaintext-token disclosure are all untested and all operator-relevant.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/management"
    anchor: ""
    rationale: "The canonical doc page for the Management → Datasources tab — the operator-facing surface this endpoint backs. WebFetched 2026-05-21 status 200; confirms the '+ Add datasource' button exists but documents none of the register-time semantics."
    last_verified_at: "2026-05-21T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      Verbatim, WebFetched 2026-05-21: "+ Add datasource button at the top-right is the entry-point for registering a source."
      Verbatim: "Inspect what was registered after a Collector first reported; add a description / tag a source; remove a source no longer ingested."
      Verbatim (re collectors, NOT datasources): "Issue a token before deploying a Collector."
      The page does NOT document: which permission registering a data source needs (DATA_SOURCE_CREATE), that registering can implicitly create a namespace, that a token is minted and returned at registration time, or the HTTP status code (200 vs 201). For data-source registration the page describes only the UI affordance, not the API behaviour.
  - url: "https://docs.opendatadiscovery.org/developer-guides/api-reference"
    anchor: ""
    rationale: "The API Reference hub — per the batch-W class sidecar (WebFetched 2026-05-20 status 200) it explicitly omits a Data Sources sub-page ('Data Sources endpoints are not included in this particular documentation page'). Inherited at status 200 within the 11-day stale-probe window; no separate fetch this session."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      Inherited from the batch-W class sidecar (docs_link_semantic.inferred_docs[1]), WebFetched 2026-05-20 status 200: "Data Sources endpoints are not included in this particular documentation page." The 5 DataSourceController endpoints — registerDataSource among them — have no per-feature API-reference documentation.
- doc_drift_findings:
  - "The Management page (WebFetched 2026-05-21) describes the '+ Add datasource' affordance but does not document that registering a data source MINTS a collector token and returns its PLAINTEXT value in the response body — an operator is not warned the create response carries a live secret."
  - "The Management page does not document that registering a data source can IMPLICITLY CREATE a namespace (via the `namespace_name` field) without the operator holding NAMESPACE_CREATE — the escalation-by-side-effect is undocumented."
  - "The OpenAPI spec declares `'201' The resource has been successfully created` for operationId registerDataSource (openapi.yaml:454) but the controller returns HTTP 200 (DataSourceController.java:35) — a spec-vs-implementation contract drift; clients generated from the spec assert the wrong status."
  - "The OpenAPI `DataSourceFormData` schema marks only `name` as required (components.yaml:1314-1315), but the code rejects an empty `oddrn` at runtime with HTTP 400 (DataSourceServiceImpl.java:119-120) — `oddrn` is de-facto required; the contract understates the requirement."

## implicit_adrs

- "A token is unconditionally minted at data-source registration time (one token per data source, generated server-side, never caller-supplied)" — evidence: DataSourceServiceImpl.java:54 (`tokenGenerator.generateToken()` is unconditional, outside the namespace branch) + TokenGeneratorImpl.java:34-42 (`generate` builds the TokenPojo with a server-generated 40-char value) — intent_anchor: the FormData schema (components.yaml:1303-1315) deliberately has NO token field — the caller CANNOT supply a token; the platform owns token issuance. The design is "every data source is born with exactly one platform-issued credential." — confidence: HIGH
- "Token-value visibility is controlled API-side by a per-response `showToken` flag, set true at creation and false on listing" — evidence: ReactiveTokenRepositoryImpl.java:26 (`new TokenDto(..., true)` on create) + TokenMapper.java:15-18 (`mapValue`: `showToken ? plaintext : "******" + last6`) — intent_anchor: the `TokenDto(pojo, boolean)` constructor and the `showToken()` branch in the mapper are a deliberate two-mode design — the operator sees the full secret ONCE at creation, redacted thereafter. The redaction is API-side, not UI-side. — confidence: HIGH
- "Token creator attribution falls back to a null username when no principal is present, rather than failing" — evidence: TokenGeneratorImpl.java:20-23 (`getCurrentUser()...switchIfEmpty(Mono.defer(() -> Mono.just(this.generate(null))))`) — intent_anchor: the explicit `switchIfEmpty` with a `generate(null)` fallback is a deliberate fail-open-on-attribution choice — a data source can be registered under `auth.type=DISABLED` (no principal) and the token's `created_by` is simply null. The code chooses "register succeeds, attribution is empty" over "register fails without a user." — confidence: HIGH

## bugs_limitations_corner_cases

- "Implicit namespace creation bypasses NAMESPACE_CREATE: a principal with DATA_SOURCE_CREATE but NOT NAMESPACE_CREATE creates a brand-new namespace as a side effect of POST /api/datasources" — evidence: DataSourceServiceImpl.java:56-57 (reads `form.getNamespaceName()`, calls `namespaceService.getOrCreate`) + NamespaceServiceImpl.java:37-40 (`getByName(name).switchIfEmpty(createByName(name))` — creates if absent) + SecurityConstants.java:116-117 (POST /api/datasources gated only by DATA_SOURCE_CREATE) — the direct POST /api/namespaces is gated by NAMESPACE_CREATE, but this side-effect path is not — severity: MEDIUM (least-privilege deviation; PRIMARY-SOURCE confirmation of the class sidecar's `conflicts_surfaced` finding; verified-by-probe P-039)
- "201-vs-200 status drift: the controller returns HTTP 200 where the OpenAPI spec declares 201 for operationId registerDataSource" — evidence: DataSourceController.java:35 (`.map(ResponseEntity::ok)` — HTTP 200) vs openapi.yaml:453-455 (`'201': The resource has been successfully created`) — severity: LOW-MEDIUM (PRIMARY-SOURCE confirmation of the class sidecar's finding; clients generated from the spec assert `status == 201` and will treat a correct registration as a failure; verified-by-probe P-038)
- "The registration response returns the collector token in FULL PLAINTEXT" — evidence: ReactiveTokenRepositoryImpl.java:26 (`new TokenDto(pojo, true)` — `showToken=true`) + TokenMapper.java:15-18 (`showToken` true → `dto.tokenPojo().getValue()` unredacted) + DataSource model has a required `token` object with a `value` string (components.yaml:1257-1267, 1333) + registerDataSource returns `DataSource` not `DataSourceSafe` (openapi.yaml:459) — severity: MEDIUM (a 40-char shared secret is in the JSON response body; downstream access logs, reverse proxies, browser history, or response-body captures may persist it; the docs do not warn operators — verified-by-probe P-040)
- "`oddrn` is required at runtime but optional in the OpenAPI contract" — evidence: DataSourceServiceImpl.java:119-120 (`if (StringUtils.isEmpty(form.getOddrn())) throw new BadUserRequestException`) vs components.yaml:1314-1315 (`required: [name]` — oddrn not listed) — severity: LOW (a spec-driven client may omit oddrn believing it optional and receive an HTTP 400; the contract should mark oddrn required)
- "No Activity Event is emitted on register — the create is invisible to the Activity Feed" — evidence: DataSourceServiceImpl.java:51-66 (the `create` method makes no `activityEventEmitter` call; the class imports no ActivityEvent — verified in the batch-W class sidecar) — severity: MEDIUM (no audit trail of who registered a data source or when; the only audit surface is the Datasources tab's current state)
- "No FTS vector refresh on register — `updateSearchVectors` is invoked only from `update`, not `create`" — evidence: DataSourceServiceImpl.java:63-65 (the create return path has no `updateSearchVectors` call; cf. line 77/80 in `update` which does) — severity: LOW (the new data source is invisible in search until its first data_entity is ingested and the join picks it up; transient gap)
- "An empty `namespace_name` produces a data source with `namespace_id = NULL` silently — there is no default namespace" — evidence: DataSourceServiceImpl.java:56 (`if (StringUtils.isNotEmpty(form.getNamespaceName()))` — the else branch passes `null` namespace at line 64) + DataSourceMapper.java:45 (`namespace != null ? namespace.getId() : null`) — severity: LOW (expected behaviour, but undocumented — an operator omitting the namespace gets an unnamespaced data source rather than an error or a default)

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "TokenGeneratorImpl.java:39"
      name: "RandomStringUtils.randomAlphanumeric(N)"
      value: "40"
      questions:
        - q: "What at N > tunable? (token length)"
          a: "The 40 is the fixed token length; it is not request-driven, so there is no N>40 case from a caller. A change to 40 would alter every newly minted token's length; existing tokens are unaffected (stored as-is in TOKEN.value)."
          confidence: STATIC-INFERRED
          evidence: "TokenGeneratorImpl.java:39 — literal 40 inside generate(); no caller input feeds it"
        - q: "What at tunable x 100?"
          a: "Not caller-reachable — token length is a server-side constant. N/A as an overflow boundary."
          confidence: STATIC-INFERRED
          evidence: "TokenGeneratorImpl.java:34-42"
        - q: "What does the operator see at each boundary?"
          a: "The operator sees a 40-char alphanumeric token in the registration response regardless of input; the constant has no operator-visible boundary."
          confidence: STATIC-INFERRED
          evidence: "TokenGeneratorImpl.java:39 + TokenMapper.java:16"
    - location: "application.yml:14-15"
      name: "spring.codec.max-in-memory-size"
      value: "20MB"
      questions:
        - q: "What at a body just under 20MB vs just over?"
          a: "A DataSourceFormData body under 20MB deserializes normally. Over 20MB, the reactive codec throws DataBufferLimitException before the handler runs."
          confidence: STATIC-INFERRED
          evidence: "application.yml:14-15 + DataSourceController.java:31 (Mono<DataSourceFormData> body)"
        - q: "What does the operator see at the overflow boundary?"
          a: "DataBufferLimitException is not mapped by ControllerAdvice (it handles BadUserRequest/NotFound/UniqueConstraint/CascadeDelete) — it falls to the generic Exception handler → HTTP 500, not 413. Practically unreachable: DataSourceFormData has 4 short string fields; a 20MB description is pathological."
          confidence: PROBE-NEEDED
          evidence: "P-NEEDED — ControllerAdvice handler set does not include DataBufferLimitException; the 500-vs-413 outcome is not statically certain without the running codec"
  name_behavior_pairs:
    - name: "registerDataSource / POST /api/datasources (operationId registerDataSource)"
      promise: "Register a data source and return 201 Created with the new resource (per the OpenAPI summary 'Register a data source' and the declared 201 response)."
      implementation: "DataSourceController.java:33-35 — `dataSourceFormData.flatMap(dataSourceService::create).map(ResponseEntity::ok)`. `ResponseEntity::ok` is HTTP 200. The resource IS created (data_source row inserted) but the status is 200, not the spec-declared 201."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "A client generated from openapi.yaml asserts status==201 and treats a successful registration as a failure; manual API consumers see 200 where REST convention and the published spec say 201."
      confidence: STATIC-INFERRED
      evidence: "DataSourceController.java:35 + openapi.yaml:453-455 — confirmed via P-038"
    - name: "namespaceService.getOrCreate (invoked from the register path)"
      promise: "Get-or-create — fetch the namespace by name; the 'create' half is a normal documented capability of the method."
      implementation: "NamespaceServiceImpl.java:37-40 — `getByName(name).switchIfEmpty(createByName(name))`. The method does exactly what its name says; the drift is NOT in this method but in the AUTHORIZATION around the register path that calls it (see request_inputs / namespace_name)."
      drift: NONE
      operator_visible_consequence: "n/a — the method matches its name; the finding lives in Category F."
      confidence: STATIC-INFERRED
      evidence: "NamespaceServiceImpl.java:37-40"
  orderings: []
  auth_gates:
    - location: "SecurityConstants.java:116-117"
      endpoint: "POST /api/datasources (registerDataSource)"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "LOGIN_FORM/OAUTH2/LDAP: the path-based rule `new SecurityRule(NO_CONTEXT, .../api/datasources POST, DATA_SOURCE_CREATE)` enforces the DATA_SOURCE_CREATE permission — a principal whose Policy grants it proceeds; one without it is refused by the ReactiveAuthorizationManager. DISABLED: per the class sidecar's analysis (DisabledSecurityConfiguration sets all paths permitAll; no principal exists to bind permissions to), the endpoint is fully open — any caller can register."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:116-117 + PolicyPermissionDto.java:51 (DATA_SOURCE_CREATE is MANAGEMENT-tier) + batch-W class sidecar DISABLED-mode analysis"
        - q: "What does an unauthenticated caller see?"
          a: "Under LOGIN_FORM/OAUTH2/LDAP, an unauthenticated POST is rejected by the Spring Security filter chain BEFORE the controller (no principal → the catch-all `.authenticated()` at AuthorizationCustomizer.java:29-30 fails first); the auth-mode-specific challenge/redirect is returned. Under DISABLED, there is no authentication step — the caller proceeds."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:95-96 (WHITELIST_PATHS does not include /api/datasources) + AuthorizationCustomizer.java:29-30"
        - q: "What does a wrong-role caller see?"
          a: "An authenticated user whose Policy lacks DATA_SOURCE_CREATE is refused at the ReactiveAuthorizationManager bound to the SecurityRule — the controller is never reached. The exact HTTP status (403) is the AuthorizationManager's, not ControllerAdvice's."
          confidence: PROBE-NEEDED
          evidence: "P-039 also exercises this — the probe's `direct_status == 403` assertion confirms the wrong-permission HTTP code on the sibling namespace path; the datasource-POST wrong-role code is the same manager"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "The gate lives in SecurityConstants.SECURITY_RULES (a declarative path-pattern + permission table), enforced by AuthorizationCustomizer before the controller. There is NO @PreAuthorize on the handler and NO programmatic check in DataSourceServiceImpl.create."
          confidence: STATIC-INFERRED
          evidence: "DataSourceController.java:30-36 (no annotation) + SecurityConstants.java:116-117 + AuthorizationCustomizer.java:24-30"
  resource_boundaries:
    - location: "DataSourceServiceImpl.java:52"
      kind: transactional
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "Two concurrent POSTs with the SAME oddrn: both mint a token + may create the namespace, then both attempt INSERT INTO data_source. The ODDRN partial-unique index serialises at the SQL layer — one INSERT wins, the other raises UniqueConstraintException (23505) → HTTP 400, and its @ReactiveTransactional rolls back. Two concurrent POSTs with the SAME namespace_name but different oddrns: both call getOrCreate; a race between two `createByName` inserts could create a duplicate namespace row OR raise a namespace unique-constraint error depending on the namespace table's constraints — not statically determinable here."
          confidence: PROBE-NEEDED
          evidence: "P-041 covers the single-caller collision rollback; the concurrent-namespace-race needs a dedicated probe — recorded as a residual gap, not separately probed in range P-038..P-041"
        - q: "Is the call replay-safe?"
          a: "NO. Replaying the same POST body is NOT idempotent: the first call creates the data source; a replay with the same oddrn raises UniqueConstraintException → 400. A replay with a DIFFERENT oddrn creates a second data source. There is no client-supplied idempotency key."
          confidence: STATIC-INFERRED
          evidence: "DataSourceServiceImpl.java:119-123 (ODDRN-keyed insert) + ReactiveDataSourceRepositoryImpl batch-R sidecar (partial-unique index on oddrn)"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No cache fronts the register path — `create` is a pure write chain (token INSERT, namespace INSERT/SELECT, data_source INSERT). N/A."
          confidence: STATIC-INFERRED
          evidence: "DataSourceServiceImpl.java:51-66 — no @Cacheable, no manual cache write"
  request_inputs:
    - location: "DataSourceController.java:31 (Mono<DataSourceFormData> body) + components.yaml:1306-1307"
      input_kind: body-field
      input_name: "name"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "The human-readable display name of the data source."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:1306-1307 (DataSourceFormData.name, the only required field)"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "DataSourceMapper.mapForm (DataSourceMapper.java:39) maps `name` field-for-field onto DataSourcePojo.name; persisted by dataSourceRepository.create into data_source.name."
          confidence: STATIC-INFERRED
          evidence: "DataSourceMapper.java:38-44 + DataSourceServiceImpl.java:122-123"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — `name` field maps to the `name` column."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "DataSourceMapper.java:39"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "n/a — MATCHES."
          confidence: STATIC-INFERRED
          evidence: "DataSourceMapper.java:39"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:1303-1315 + DataSourceMapper.java:38-47"
      routes_to_finding: "n/a — MATCHES"
    - location: "DataSourceController.java:31 (Mono<DataSourceFormData> body) + components.yaml:1310-1311"
      input_kind: body-field
      input_name: "oddrn"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "The Open Data Discovery Resource Name — the globally-unique identity string of the data source."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:1310-1311 (DataSourceFormData.oddrn)"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "DataSourceServiceImpl.createDataSource (line 119-120) rejects an empty value; DataSourceMapper.mapForm (DataSourceMapper.java:38) maps `oddrn` via `form.getOddrn().trim()` onto DataSourcePojo.oddrn; the partial-unique index on data_source.oddrn enforces uniqueness at INSERT."
          confidence: STATIC-INFERRED
          evidence: "DataSourceServiceImpl.java:119-123 + DataSourceMapper.java:38"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES on column mapping — but the OpenAPI schema marks oddrn OPTIONAL (components.yaml:1314-1315 lists only `name` as required) while the code rejects an empty oddrn with HTTP 400. The field-name is honoured; the requiredness contract is understated."
          drift: MINOR
          confidence: STATIC-INFERRED
          evidence: "components.yaml:1314-1315 (required: [name]) vs DataSourceServiceImpl.java:119-120"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "A spec-driven client that treats oddrn as optional and omits it receives HTTP 400 BadUserRequestException('ODDRN must be filled for data source') — a surprising rejection of an apparently-valid body. Routed to bugs_limitations_corner_cases as the contract-understatement finding."
          confidence: STATIC-INFERRED
          evidence: "DataSourceServiceImpl.java:119-120 + ControllerAdvice.java:24-26"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "DataSourceMapper.java:38"
      routes_to_finding: "bugs_limitations_corner_cases (oddrn required-at-runtime, optional-in-contract) + docs_link_semantic.doc_drift_findings"
    - location: "DataSourceController.java:31 (Mono<DataSourceFormData> body) + components.yaml:1308-1309"
      input_kind: body-field
      input_name: "namespace_name"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "The name of the namespace to place this data source in — an operator picking an existing namespace by name."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:1308-1309 (DataSourceFormData.namespace_name)"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "DataSourceServiceImpl.java:56-57 — if non-empty, `namespaceService.getOrCreate(form.getNamespaceName())` → NamespaceServiceImpl.java:37-40 `getByName(name).switchIfEmpty(createByName(name))`. The resolved/created NamespacePojo's id is stamped onto the data_source via DataSourceMapper.java:45. So the field both SELECTS an existing namespace AND CREATES a new one if the name is unknown."
          confidence: STATIC-INFERRED
          evidence: "DataSourceServiceImpl.java:56-57 + NamespaceServiceImpl.java:37-40 + DataSourceMapper.java:45"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY — the field name `namespace_name` reads as 'pick a namespace', but supplying an unknown name CREATES a namespace. The create-on-miss is not surfaced in the field name, the OpenAPI description (components.yaml:1308-1309 has no description), or the live doc page. Crucially the create is performed under the register endpoint's DATA_SOURCE_CREATE gate — NOT the NAMESPACE_CREATE gate that the explicit POST /api/namespaces requires (SecurityConstants.java:116-117 vs the namespace rule). A principal scoped to only DATA_SOURCE_CREATE creates namespaces through this field."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "DataSourceServiceImpl.java:56-57 + NamespaceServiceImpl.java:37-40 + SecurityConstants.java:116-117"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "(1) An operator who believes namespace_name only SELECTS — a typo in the namespace name silently creates a junk namespace rather than erroring. (2) A least-privilege principal with DATA_SOURCE_CREATE but not NAMESPACE_CREATE can proliferate namespaces (escalation by side effect) — confirmed by P-039. (3) No Activity Event records the namespace creation (DataSourceServiceImpl emits none) — the new namespace appears with no audit trail of who/why."
          confidence: STATIC-INFERRED
          evidence: "NamespaceServiceImpl.java:37-40 + SecurityConstants.java:116-117 + P-039"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "There is no `namespace_id` field on DataSourceFormData (components.yaml:1303-1315) — the contract offers only name-based namespace selection, never id-based. A namespace_id field would let a caller select WITHOUT the create-on-miss risk; its absence is structural."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:1303-1315 (no namespace_id field) + DataSourceMapper.java:45"
      routes_to_finding: "bugs_limitations_corner_cases (implicit namespace creation bypasses NAMESPACE_CREATE) + docs_link_semantic.doc_drift_findings + security.known_security_gaps"
    - location: "DataSourceController.java:31 (Mono<DataSourceFormData> body) + components.yaml:1312-1313"
      input_kind: body-field
      input_name: "description"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "A free-text human description of the data source."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:1312-1313 (DataSourceFormData.description)"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "DataSourceMapper.mapForm maps `description` field-for-field onto DataSourcePojo.description; persisted into data_source.description."
          confidence: STATIC-INFERRED
          evidence: "DataSourceMapper.java:38-44"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — `description` field maps to the `description` column."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "DataSourceMapper.java:39"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "n/a — MATCHES."
          confidence: STATIC-INFERRED
          evidence: "DataSourceMapper.java:39"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:1303-1315"
      routes_to_finding: "n/a — MATCHES"
  probes_emitted:
    - probe_id: P-038
      question: "Does POST /api/datasources return HTTP 200 (contradicting the OpenAPI-declared 201)?"
      probe_path: "lineage/odd-platform/probes/P-038.yaml"
    - probe_id: P-039
      question: "Can a principal with DATA_SOURCE_CREATE but not NAMESPACE_CREATE create a namespace via the namespace_name field?"
      probe_path: "lineage/odd-platform/probes/P-039.yaml"
    - probe_id: P-040
      question: "Does the registration response body carry the collector token in full plaintext, while the list path redacts it?"
      probe_path: "lineage/odd-platform/probes/P-040.yaml"
    - probe_id: P-041
      question: "Does a failed register (ODDRN collision) roll back the token row and the namespace row created earlier in the @ReactiveTransactional chain?"
      probe_path: "lineage/odd-platform/probes/P-041.yaml"
  stress_summary:
    triggers_total: 9
    questions_total: 30
    answers_static_inferred: 26
    answers_probe_needed: 4
    answers_reference: 0
    drift_flags: 1
```

## security

- auth_mode_relevance: LOGIN_FORM | OAUTH2 | LDAP | DISABLED | S2S — under LOGIN_FORM/OAUTH2/LDAP the path rule enforces DATA_SOURCE_CREATE; under DISABLED the endpoint is open (no principal, DisabledSecurityConfiguration permitAll); S2S (`auth.s2s.enabled=true`) grants ADMIN to an X-API-Key holder, satisfying DATA_SOURCE_CREATE regardless of any per-user policy.
- ingestion_filter_relevance: NO — `/api/datasources` is the UI admin surface; `WHITELIST_PATHS` (SecurityConstants.java:95-96) lists `/ingestion/**` but NOT `/api/datasources`, so the IngestionDataSourceFilter never sees this traffic. The collector-driven creation path is the disjoint `IngestionController.createDataSourceEntity`.
- authorization_assertions:
  - "POST /api/datasources requires DATA_SOURCE_CREATE — evidence: SecurityConstants.java:116-117 (`new SecurityRule(NO_CONTEXT, new PathPatternParserServerWebExchangeMatcher(\"/api/datasources\", POST), DATA_SOURCE_CREATE)`) + PolicyPermissionDto.java:51 (`DATA_SOURCE_CREATE` is MANAGEMENT-tier)"
- owner_scoping: N/A — registerDataSource is a create operation; there is no pre-existing row to owner-scope. The created data source has no owner attached at registration (ownership is attached separately via the Owners surface).
- data_exposure:
  - "Collector token in FULL PLAINTEXT in the registration response body — the `DataSource.token.value` field carries the unredacted 40-char secret because `create` sets `TokenDto.showToken=true` (ReactiveTokenRepositoryImpl.java:26 + TokenMapper.java:15-18). Any logger, proxy, or browser-history capture of the POST /api/datasources response persists a live credential."
  - "The minted token's `created_by` exposes the registering user's username (TokenGeneratorImpl.java:38) — or null under DISABLED."
- known_security_gaps:
  - "Implicit namespace creation bypasses NAMESPACE_CREATE — a principal with only DATA_SOURCE_CREATE creates namespaces via the `namespace_name` field; the explicit namespace endpoint is gated by NAMESPACE_CREATE but this side-effect path is not" — evidence: DataSourceServiceImpl.java:56-57 + NamespaceServiceImpl.java:37-40 + SecurityConstants.java:116-117 — severity: MEDIUM
  - "Plaintext token in the create response — the registration response leaks a live 40-char shared secret; the docs do not warn operators to treat the response body as sensitive" — evidence: ReactiveTokenRepositoryImpl.java:26 + TokenMapper.java:15-18 — severity: MEDIUM
  - "S2S X-API-Key grants ADMIN — any S2S caller can register a data source regardless of fine-grained policy configuration" — evidence: the global S2sAuthenticationFilter (cross-referenced from the batch-W class sidecar) — severity: MEDIUM
  - "DISABLED auth.type makes registerDataSource fully open — under DISABLED there is no principal and no DATA_SOURCE_CREATE enforcement" — evidence: batch-W class sidecar DISABLED-mode analysis + REFACTOR-185 cluster — severity: HIGH under DISABLED in a production deployment

## performance

- hot_paths:
  - "registerDataSource is NOT a hot path — it is an operator-initiated, low-frequency administrative action (a data source is registered once). The `create` chain runs 3 sequential DB writes inside @ReactiveTransactional: token INSERT, namespace SELECT-or-INSERT, data_source INSERT."
- throughput_characteristics:
  - "Single-item per request — there is no bulk-register endpoint on the UI side."
  - "Reactive Mono — non-blocking, but the @ReactiveTransactional `create` holds one R2DBC connection across all 3 writes."
- resource_allocation:
  - "Per-call memory: small — a 4-field DataSourceFormData plus the response DataSource; KB-sized."
  - "One R2DBC connection held for the @ReactiveTransactional `create` duration (DataSourceServiceImpl.java:52)."
  - "No outbound HTTP calls — token generation is local CPU (RandomStringUtils); all writes are in-DB."
  - "spring.codec.max-in-memory-size (20MB) bounds body deserialization."
- scaling_characteristics:
  - "Stateless handler — instances scale horizontally."
  - "Concurrency on the same ODDRN is serialised at the SQL layer by the data_source ODDRN partial-unique index — the loser of a race gets HTTP 400, not corruption."
- known_performance_gaps:
  - "No FTS vector refresh on register — `updateSearchVectors` runs only from `update` (DataSourceServiceImpl.java:77/80), so a newly registered data source is absent from full-text search until its first data_entity is ingested" — evidence: DataSourceServiceImpl.java:63-65 (create return path) vs 77-80 (update path) — severity: LOW

## upstream_callers

- entry_point: "ui_route:/management/datasources (Management → Datasources tab, '+ Add datasource' form)"
  caller_node: "odd-platform-ui — datasources.thunks.ts → lib/hooks/api/datasource.ts → generated DataSourceApi.registerDataSource"
  multiplicity_per_trigger: 1
  evidence: "DataSourceController.java:30-31 (the @Override of DataSourceApi.registerDataSource) — the UI invokes the generated DataSourceApi client; the '+ Add datasource' button is the documented entry-point (Management page, WebFetched 2026-05-21 status 200). One submit = one POST. The UI files are identified in the batch-W class sidecar's upstream_callers; not re-verified this session."
  observation_class: ui-call
  unresolved: true   # UI thunk node not yet enriched — REFERENCE per Rule 6
- entry_point: "rest:POST /api/datasources"
  caller_node: "any authenticated odd-api-consumer (UI session) OR S2S X-API-Key holder"
  multiplicity_per_trigger: 1
  evidence: "SecurityConstants.java:116-117 (the path rule) — a programmatic client POSTing directly reaches the same handler; S2S callers reach it with ADMIN scope."
  observation_class: rest-call

## downstream_side_effects

- side_effect_class: db-write
  description: "INSERT INTO token — a new 40-char-secret token row is created on EVERY register call (unconditional)."
  evidence: "DataSourceServiceImpl.java:54 (`tokenGenerator.generateToken().flatMap(tokenRepository::create)`) + ReactiveTokenRepositoryImpl.java:20-27 (`DSL.insertInto(TOKEN)`)"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/management/datasources"
    - "rest:POST /api/datasources"
- side_effect_class: db-write
  description: "INSERT INTO namespace — a new namespace row is created IF `namespace_name` is non-empty AND no namespace of that name exists."
  evidence: "DataSourceServiceImpl.java:56-57 (`namespaceService.getOrCreate`) + NamespaceServiceImpl.java:37-40 (`switchIfEmpty(namespaceRepository.createByName(name))`)"
  cardinality_per_call: "0 or 1 — 1 if namespace_name is non-empty and unknown; 0 if empty or already exists"
  reachable_from_entry_points:
    - "ui_route:/management/datasources"
    - "rest:POST /api/datasources"
- side_effect_class: db-write
  description: "INSERT INTO data_source — the data_source row itself, stamped with the new token_id and (optional) namespace_id."
  evidence: "DataSourceServiceImpl.java:122-123 (`dataSourceMapper.mapForm(...).flatMap(dataSourceRepository::create)`) + DataSourceMapper.java:38-47"
  cardinality_per_call: "1 on success; 0 on empty-ODDRN (HTTP 400) or ODDRN collision (HTTP 400)"
  reachable_from_entry_points:
    - "ui_route:/management/datasources"
    - "rest:POST /api/datasources"
- side_effect_class: page-render
  description: "Returns the persisted DataSource payload (id, oddrn, name, description, namespace, token-with-plaintext-value) as HTTP 200."
  evidence: "DataSourceController.java:33-35 + components.yaml:1249-1269 (DataSource model)"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/management/datasources"
    - "rest:POST /api/datasources"
- side_effect_class: db-write
  description: "NO Activity Event row is written — register emits no activity (recorded as an ABSENT side effect; the Activity Feed has no record of data-source registration)."
  evidence: "DataSourceServiceImpl.java:51-66 — no activityEventEmitter call (the class imports no ActivityEvent, verified in the batch-W class sidecar)"
  cardinality_per_call: 0
  reachable_from_entry_points:
    - "ui_route:/management/datasources"
    - "rest:POST /api/datasources"

## coherence_notes

- kind: refines
  target: "odd-platform java DataSourceController controller-class:DataSourceController"
  note: |
    The batch-W class sidecar's `downstream_side_effects` entry for
    registerDataSource summarised the create chain and the FormData fields as
    "oddrn, name, description, namespaceName, connectionUrl etc." This
    method-level pass REFINES that: the OpenAPI `DataSourceFormData` schema
    (components.yaml:1303-1315) has EXACTLY 4 fields — `name` (required),
    `namespace_name`, `oddrn`, `description`. There is NO `connectionUrl` and NO
    `pullingInterval` field on the create form; the class sidecar's "connection_url"
    references were inferential. The mutable surface of a data source in
    odd-platform is narrower than the class sidecar implied.
- kind: strengthens
  target: "odd-platform java DataSourceController controller-class:DataSourceController"
  note: |
    The class sidecar flagged TWO findings in its `conflicts_surfaced` /
    `bugs_limitations_corner_cases` without method-level primary source: (a) the
    implicit namespace-creation NAMESPACE_CREATE bypass and (b) the 201-vs-200
    status drift. This method sidecar STRENGTHENS both with the exact file:line
    trace: (a) DataSourceServiceImpl.java:56-57 → NamespaceServiceImpl.java:37-40
    (`switchIfEmpty(createByName(name))`) confirms the create-on-miss, and
    SecurityConstants.java:116-117 confirms the register endpoint is gated only
    by DATA_SOURCE_CREATE; (b) DataSourceController.java:35 (`ResponseEntity::ok`
    = HTTP 200) vs openapi.yaml:453-455 (declared `'201'`) confirms the drift.
    Both are now probe-backed (P-039, P-038).
- kind: strengthens
  target: "odd-platform java DataSourceController controller-class:DataSourceController"
  note: |
    The class sidecar's `security.data_exposure` hedged that the token redaction
    "may be UI-side, not API-side." This method sidecar RESOLVES the hedge: the
    redaction is API-side, controlled by the `TokenDto.showToken` boolean —
    `ReactiveTokenRepositoryImpl.create` constructs `new TokenDto(pojo, true)`
    (line 26), and `TokenMapper.mapValue` (lines 15-18) returns plaintext when
    `showToken` is true. The register response therefore returns the FULL
    plaintext token; the list path (showToken false) returns `"******" + last6`.

## sources

- understanding ← `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/DataSourceController.java:30-36` + `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataSourceServiceImpl.java:51-66`
- concepts.entities ← `odd-platform-specification/components.yaml:1249-1334` + DataSourceController.java:4-8
- concepts.operations ← DataSourceController.java:30-36 + DataSourceServiceImpl.java:51-66
- concepts.invariants ← DataSourceServiceImpl.java:54,56,119-120 + DataSourceMapper.java:38 + DataSourceController.java:18,30-36
- concepts.audiences ← WebFetch 2026-05-21 of `https://docs.opendatadiscovery.org/features/management` (status 200)
- dependencies_semantic.requires-feature.DataSourceApi ← DataSourceController.java:4 + `odd-platform-specification/openapi.yaml:443-461`
- dependencies_semantic.requires-feature.TokenGenerator ← `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/TokenGeneratorImpl.java:18-42`
- dependencies_semantic.requires-feature.ReactiveTokenRepository.create ← `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveTokenRepositoryImpl.java:20-27`
- dependencies_semantic.requires-feature.NamespaceService.getOrCreate ← `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/NamespaceServiceImpl.java:37-40`
- dependencies_semantic.requires-feature.DataSourceMapper ← `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/mapper/DataSourceMapper.java:38-47`
- dependencies_semantic.requires-feature.ControllerAdvice ← `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/exception/ControllerAdvice.java:24-26`
- dependencies_semantic.requires-config.auth.type ← SecurityConstants.java:95-96 + batch-W class sidecar DISABLED-mode analysis
- dependencies_semantic.requires-runtime ← DataSourceServiceImpl.java:52 + TokenGeneratorImpl.java:20-23
- tests_coverage_semantic ← batch-W class sidecar (`Glob **/DataSourceControllerTest*.java` / `**/DataSourceServiceImplTest*.java` both returned no files)
- docs_link_semantic.inferred_docs[0] (management) ← WebFetch 2026-05-21 of `https://docs.opendatadiscovery.org/features/management` (status 200)
- docs_link_semantic.inferred_docs[1] (api-reference) ← inherited from batch-W class sidecar, WebFetched 2026-05-20 status 200 (within the 11-day stale-probe window)
- implicit_adrs[0] (token always minted) ← DataSourceServiceImpl.java:54 + TokenGeneratorImpl.java:34-42 + components.yaml:1303-1315 (no token field on FormData)
- implicit_adrs[1] (showToken flag) ← ReactiveTokenRepositoryImpl.java:26 + TokenMapper.java:15-18
- implicit_adrs[2] (null-username fallback) ← TokenGeneratorImpl.java:20-23
- bugs_limitations_corner_cases[0] (namespace bypass) ← DataSourceServiceImpl.java:56-57 + NamespaceServiceImpl.java:37-40 + SecurityConstants.java:116-117
- bugs_limitations_corner_cases[1] (201-vs-200) ← DataSourceController.java:35 + openapi.yaml:453-455
- bugs_limitations_corner_cases[2] (plaintext token) ← ReactiveTokenRepositoryImpl.java:26 + TokenMapper.java:15-18 + components.yaml:1257-1267,1333 + openapi.yaml:459
- bugs_limitations_corner_cases[3] (oddrn required-vs-optional) ← DataSourceServiceImpl.java:119-120 + components.yaml:1314-1315
- bugs_limitations_corner_cases[4] (no Activity Event) ← DataSourceServiceImpl.java:51-66 + batch-W class sidecar
- bugs_limitations_corner_cases[5] (no FTS on create) ← DataSourceServiceImpl.java:63-65 vs 77-80
- bugs_limitations_corner_cases[6] (null namespace_id) ← DataSourceServiceImpl.java:56,64 + DataSourceMapper.java:45
- stress_findings ← DataSourceController.java:30-36 + DataSourceServiceImpl.java:51-66 + TokenGeneratorImpl.java:18-42 + NamespaceServiceImpl.java:37-40 + ReactiveTokenRepositoryImpl.java:20-27 + DataSourceMapper.java:38-47 + SecurityConstants.java:95-96,116-117 + components.yaml:1303-1334 + openapi.yaml:443-461
- security.authorization_assertions ← SecurityConstants.java:116-117 + PolicyPermissionDto.java:51
- security.data_exposure ← ReactiveTokenRepositoryImpl.java:26 + TokenMapper.java:15-18 + TokenGeneratorImpl.java:38
- security.known_security_gaps ← cited inline via evidence: tags
- performance ← DataSourceController.java:30-36 + DataSourceServiceImpl.java:51-66,77-80
- upstream_callers ← DataSourceController.java:30-31 + SecurityConstants.java:116-117 + batch-W class sidecar upstream_callers
- downstream_side_effects ← DataSourceServiceImpl.java:54,56-57,122-123 + ReactiveTokenRepositoryImpl.java:20-27 + NamespaceServiceImpl.java:37-40 + DataSourceMapper.java:38-47
- coherence_notes ← batch-W class sidecar `odd-platform__java__DataSourceController__controller-class__DataSourceController.md` (Read this session) + components.yaml:1303-1315 + ReactiveTokenRepositoryImpl.java:26 + TokenMapper.java:15-18

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (the absence of tests is verified in the batch-W class sidecar)
- docs_link_semantic: HIGH (management page fetched live this session status 200; api-reference inherited within the stale-probe window)
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH
- upstream_callers: MEDIUM (the UI thunk caller node is a REFERENCE — not yet enriched)
- downstream_side_effects: HIGH
- stress_findings: MEDIUM (4 of 30 questions are PROBE-NEEDED; the load-bearing operator-observable claims — namespace bypass, 201-vs-200, plaintext token, transaction rollback — are STATIC-INFERRED with strong file:line evidence AND probe-backed, so confidence is MEDIUM rather than LOW)

## Maintainer notes

(empty — no prior sidecar existed at this path; this is the first enrichment of this node)

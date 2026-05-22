---
node_id: "odd-platform java DataSourceController controller-method:getDataSourceList"
node_kind: controller-method
axis: controllers
extracted_at_commit: 80637ed
enriched_at_commit: 80637ed
extractor_version: 0.1.0
prompt_version: file-analyser/0.5.0
enrichment_status: complete
confidence_overall: MEDIUM
session_id: session-2026-05-21-batch-ZB-getDataSourceList
---

# DataSourceController.getDataSourceList — semantic understanding

## understanding

`getDataSourceList` (DataSourceController.java:21-28) is the single read/list
endpoint of the Data Sources management surface — `GET /api/datasources?page=&size=&query=`,
backing the Management → Datasources tab. It is a 3-line proxy: it forwards the
three OpenAPI-generated parameters (`page`, `size`, optional `query`) to
`dataSourceService.list(page, size, query)` and wraps the reactive result in
`ResponseEntity.ok` (HTTP 200). The chain is `DataSourceServiceImpl.list`
(DataSourceServiceImpl.java:38-43) → `ReactiveDataSourceRepositoryImpl.listDto`
(ReactiveDataSourceRepositoryImpl.java:58-82) → `DataSourceMapper.mapDtoPage`
(DataSourceMapper.java:32-36). Two facts dominate this node's meaning. First,
the list projection **does** include collector token material: `listDto` selects
`TOKEN.asterisk()` (line 70), but the LIST path constructs the token DTO via the
1-arg `new TokenDto(tokenPojo)` (line 167) → `showToken = false` (TokenDto.java:6-8),
so `TokenMapper.mapValue` (TokenMapper.java:15-18) returns a **masked** form —
`"******" + the last 6 plaintext characters` — NOT the full 40-char plaintext
that register/regenerate return. Second, `GET /api/datasources` has **no entry
in `SecurityConstants.SECURITY_RULES`** (Grep confirmed: only POST/PUT/DELETE on
`/api/datasources*` are at SecurityConstants.java:116-126) — any authenticated
user lists the entire catalog, no permission, no owner scope. This is the same
read-collaborative posture the class sidecar records; this method-level sidecar
adds the precise token-form trace and the SQL-ordering fact (the list is ordered
`data_source.id ASC` — creation order — via the default `paginate` overload).

## concepts

- entities:
  - "DataSourceList (paginated response — `items: List<DataSource>` + `page_info: PageInfo{total, has_next}`; components.yaml:1290-1301; produced by DataSourceMapper.mapDtoPage at DataSourceMapper.java:32-36)"
  - "DataSource (per-item response — id, namespace, token, oddrn, name, description; `token` is a REQUIRED field per components.yaml:1265-1269 — every list item carries a token object)"
  - "Token (response sub-object — id, value, created_by, created_at, updated_by, updated_at; `value` is REQUIRED per components.yaml:1345-1349; on the list path `value` is the masked `\"******\"+last6` form)"
  - "TokenDto (record `TokenDto(TokenPojo tokenPojo, boolean showToken)` — TokenDto.java:5; the `showToken` boolean is the discriminator between plaintext and masked rendering)"
  - "DataSourceDto (DataSourcePojo + NamespacePojo + TokenDto — the joined row the repository returns; mapped to DataSource by DataSourceMapper.mapDto)"
  - "Page<DataSourceDto> (utils.Page wrapper — data + total + hasNext; built by JooqQueryHelper.pageifyResult)"
  - "page / size / query (the 3 query parameters — OpenAPI PageParam/SizeParam/SearchParam; page+size REQUIRED, query OPTIONAL per components.yaml:4213-4237)"
- operations:
  - "list datasources (DataSourceController.java:21-28): GET /api/datasources — paginated catalog read, optionally name-filtered by `query`"
  - "delegate to service (line 25-26): `dataSourceService.list(page, size, query)` — no logic at the controller"
  - "wrap as 200 (line 27): `.map(ResponseEntity::ok)` — always HTTP 200 on success; OpenAPI declares only the `200` response (openapi.yaml:434-440)"
- invariants:
  - "The controller body adds NO logic — no validation, no auth check, no defaulting of page/size. It @Overrides DataSourceApi.getDataSourceList (DataSourceController.java:18 `implements DataSourceApi`); the path/verb mapping lives in the OpenAPI-generated interface (openapi.yaml:425-442), not on this method."
  - "`page` and `size` are `required: true` in the contract (components.yaml:4217, 4226) — a request omitting either is rejected by the OpenAPI binding layer (HTTP 400) before this method runs; the method body never sees a null page/size for a well-formed request."
  - "`query` is `required: false` (components.yaml:4235); when absent or empty the repository's `queryCondition` (ReactiveDataSourceRepositoryImpl.java:151-160) adds only the `deleted_at IS NULL` predicate — the full live catalog is listed."
  - "Soft-deleted datasources are universally excluded — `queryCondition` line 154 always adds `DATA_SOURCE.DELETED_AT.isNull()`."
  - "The list result is ordered `data_source.id ASC` — `listDto` calls the 3-arg `jooqQueryHelper.paginate(homogeneousQuery, offset, size)` (ReactiveDataSourceRepositoryImpl.java:62) which delegates to `paginate(baseSelect, baseSelect.field(\"id\"), SortOrder.ASC, ...)` (JooqQueryHelper.java:45). `id` is both the sole sort key and the (trivial) tie-breaker — fully deterministic."
  - "ServerWebExchange (line 24) is a declared parameter but UNUSED by the body — the reactive security principal propagates implicitly; this endpoint reads no header/cookie directly."
- audiences:
  - "platform-operator (the Management → Datasources tab — per live docs.opendatadiscovery.org/features/management WebFetched 2026-05-21 status 200)"
  - "odd-platform-ui-end-user (any authenticated user — the list is not permission-gated)"
  - "odd-api-consumer (programmatic clients with a UI session OR S2S X-API-Key — same endpoint)"

## dependencies_semantic

- requires-feature:
  - "`DataSourceApi` OpenAPI-generated interface — declares the `getDataSourceList(Integer page, Integer size, String query, ServerWebExchange)` signature this method @Overrides; generated from openapi.yaml:425-442 + components.yaml PageParam/SizeParam/SearchParam."
  - "`DataSourceService.list` (DataSourceService.java:11) + `DataSourceServiceImpl.list` (DataSourceServiceImpl.java:38-43) — the 1-hop delegate; itself a 2-line proxy to the repository + mapper."
  - "`ReactiveDataSourceRepositoryImpl.listDto` (ReactiveDataSourceRepositoryImpl.java:58-82) — the SQL: a CTE `data_source_cte` (the paginated `SELECT FROM data_source WHERE deleted_at IS NULL [+ startsWithIgnoreCase]`) then 2 LEFT JOINs against NAMESPACE and TOKEN."
  - "`DataSourceMapper.mapDtoPage` + `mapDtos` + `mapDto` (DataSourceMapper.java:28-36) — MapStruct mapping of `Page<DataSourceDto>` → `DataSourceList`; `uses = {NamespaceMapper.class, TokenMapper.class}` (DataSourceMapper.java:20-23)."
  - "`TokenMapper.mapValue` (TokenMapper.java:15-18) — the masking function; the load-bearing dependency for the token-exposure question."
  - "`JooqQueryHelper.paginate` / `pageifyResult` (JooqQueryHelper.java:42-127) — supplies the ORDER-BY-id-ASC pagination and the count assembly."
- requires-config:
  - "`auth.type` (DISABLED / LOGIN_FORM / OAUTH2 / LDAP) — gates whether the request reaches the controller. Under LOGIN_FORM/OAUTH2/LDAP the catch-all `pathMatchers(\"/**\").authenticated()` (AuthorizationCustomizer.java:29-30 per the class sidecar) requires an authenticated principal; the list endpoint itself adds no further permission gate. Under DISABLED every endpoint is open (per the class sidecar's documented DISABLED stance)."
  - "`auth.s2s.enabled` — when true, an X-API-Key holder reaches this endpoint with ADMIN identity; irrelevant for the list endpoint specifically since list needs no permission beyond authentication."
- requires-runtime:
  - "Spring WebFlux + Reactor — the method returns `Mono<ResponseEntity<DataSourceList>>`."
  - "PostgreSQL via jOOQ-on-R2DBC — the `data_source` / `namespace` / `token` tables and the `data_source` rows must exist; the read is NOT inside an explicit transaction (`DataSourceServiceImpl.list` is NOT `@ReactiveTransactional` — DataSourceServiceImpl.java:38)."
- coupling:
  - "Path/verb is OpenAPI-contract-driven — a change to openapi.yaml:425-442 propagates to the generated interface; this @Override must keep the signature in sync or compilation fails."
  - "Token-form coupling: the masked-vs-plaintext outcome is decided ENTIRELY by which `TokenDto` constructor the repository uses. `listDto`'s `mapRecordIntoDto` (line 167) uses the 1-arg (masked) form; register/regenerate use the 2-arg `true` (plaintext) form (ReactiveTokenRepositoryImpl.java:26,38). A future edit to `mapRecordIntoDto` swapping to `TokenDto.visibleToken(...)` would silently expose full plaintext tokens on the list endpoint with no other code change."
  - "Ordering coupling: the `id ASC` order is implicit in the DEFAULT `paginate` overload. A maintainer who switches `listDto` to a name-ordered or recency-ordered overload changes operator-visible behaviour with no contract change (the OpenAPI spec states no ordering)."

## tests_coverage_semantic

- covered_behaviours:
  - behaviour: "listDto pagination across multiple datasources with mixed namespace attachments (repository-tier, exercises the SQL this method depends on)"
    test_class: integration
    test_files: ["odd-platform-api/src/test/java/.../repository/DataSourceRepositoryImplTest.java:83-160 (approx — per the ReactiveDataSourceRepositoryImpl sidecar)"]
- uncovered_behaviours:
  - behaviour: "Happy-path list: GET /api/datasources?page=1&size=10 returns 200 with a DataSourceList; items carry id/name/oddrn/namespace/token"
    test_class: integration
    criticality: HIGH
    note: "No DataSourceControllerTest exists (Glob-verified in the class sidecar) — the entire HTTP surface of this endpoint is uncovered"
  - behaviour: "List ordering is data_source.id ASC (creation order), NOT name-alphabetical, NOT recency"
    test_class: integration
    criticality: MEDIUM
    note: "Pinned by probe P-034 — no test asserts the ordering today"
  - behaviour: "List token field is the masked form '******'+last6, NOT the 40-char plaintext"
    test_class: security
    criticality: HIGH
    note: "Pinned by probe P-035 — a regression swapping the TokenDto constructor would leak plaintext tokens to every authenticated user"
  - behaviour: "query parameter divergence: query matching by `contains` but not `startsWith` yields empty items[] with non-zero page_info.total"
    test_class: integration
    criticality: MEDIUM
    note: "Pinned by probe P-036 — REFACTOR-425 refinement"
  - behaviour: "size has no upper bound: size=Integer.MAX_VALUE is accepted and emits LIMIT 2147483647; size=0/negative and page=0 boundary behaviour"
    test_class: integration
    criticality: MEDIUM
    note: "Pinned by probe P-037"
  - behaviour: "RBAC: a user with NO MANAGEMENT permission CAN still list all datasources (GET is not in SECURITY_RULES)"
    test_class: security
    criticality: MEDIUM
    note: "The read-collaborative posture under test — no parametrized auth-mode controller security test exists in the repo"
  - behaviour: "GET /api/datasources without page or size returns 400 (OpenAPI binding rejects missing required params before the method)"
    test_class: integration
    criticality: LOW
- test_files:
  - "NO file named DataSourceControllerTest.* exists (Glob-verified in the class sidecar at this commit)"
  - "odd-platform-api/src/test/java/.../repository/DataSourceRepositoryImplTest.java — exercises listDto at the repository tier, not the HTTP endpoint"
- gaps: |
    The HTTP endpoint has ZERO direct coverage; the only protection for the SQL
    underneath is the repository-tier DataSourceRepositoryImplTest. The
    highest-leverage gap is the SECURITY class: there is no test asserting that
    the list endpoint returns the MASKED token form. Because the masked-vs-plaintext
    outcome hinges on a single constructor choice (TokenDto 1-arg vs 2-arg) at
    ReactiveDataSourceRepositoryImpl.java:167, a refactor could silently flip the
    list endpoint to leak full 40-char plaintext collector tokens to every
    authenticated user (the list needs no permission). Probe P-035 is the
    regression guard for exactly that. Second-worst: the integration class —
    no test pins the id-ASC ordering (P-034) or the contains/startsWith count
    divergence (P-036), so a paginate-overload swap or a queryCondition change
    would go unnoticed.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/management"
    anchor: ""
    rationale: "The canonical doc page for the Datasources management tab that this endpoint backs. WebFetched 2026-05-21 status 200. The page describes the operator workflow and confirms the token is shown partially-redacted in the card; it is SILENT on list ordering and on pagination/size limits."
    last_verified_at: "2026-05-21T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      WebFetched 2026-05-21 (status 200). On token visibility, the page's figure
      caption states verbatim: "each card showing the source's ODDRN, description,
      namespace, and a partially-redacted Collector token with a Regenerate action."
      On ordering: the fetch reports "The page does not describe any ordering
      mechanism for the data source list." On pagination/limits: "The page does
      not mention pagination, page size, or any limit on the number of data
      sources displayed."
  - url: "https://docs.opendatadiscovery.org/developer-guides/api-reference"
    anchor: ""
    rationale: "The API Reference hub. The class sidecar verified (WebFetch 2026-05-20 status 200) that it explicitly omits a Data Sources sub-page — verbatim 'Data Sources endpoints are not included in this particular documentation page.' Inherited from the class sidecar (status 200, 1 day old, within the 11-day stale-probe cadence); not re-fetched this session."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      Inherited from the DataSourceController class sidecar (docs_link_semantic.inferred_docs[1]):
      verbatim "Data Sources endpoints are not included in this particular documentation page."
      GET /api/datasources is therefore undocumented in the per-feature API reference.
- doc_drift_findings:
  - "The management doc page confirms the token is shown 'partially-redacted' — this MATCHES the API behaviour for the list endpoint (TokenMapper.mapValue returns '******'+last6). No drift on the masked-form claim. But the doc does not state that the masked form leaks the REAL last 6 characters of the token (P-035 pins this); a security-conscious operator reading 'partially-redacted' might assume a placeholder, not real token material."
  - "The management doc page is SILENT on the list ordering. The endpoint returns datasources in `data_source.id ASC` (creation order). An operator expecting newly-registered sources at the top of the list will instead find them at the BOTTOM (highest id). Documented-feature gap — the page should state the order, or the UI/endpoint should sort by recency."
  - "The management doc page is SILENT on pagination and on any `size` limit. The OpenAPI SizeParam has no `maximum` (components.yaml:4222-4229); the endpoint accepts arbitrarily large `size` with no clamp. Documented-feature gap."
  - "The query/search parameter divergence (page predicate `startsWithIgnoreCase` vs empty-page count `containsIgnoreCase`) is undocumented and produces a phantom `total` on an empty page — see bugs_limitations_corner_cases. The doc page mentions no search behaviour at all."

## implicit_adrs

- "List endpoint deliberately returns the MASKED token form while register/regenerate return plaintext — the `showToken` boolean on `TokenDto` is the explicit toggle" — evidence: TokenDto.java:5-12 (the record has a `showToken` field; a 1-arg constructor defaulting it to `false` AND a named factory `visibleToken(...)` defaulting it to `true`) + TokenMapper.java:15-18 (`mapValue` branches on `dto.showToken()`) + ReactiveDataSourceRepositoryImpl.java:167 (list path uses the 1-arg masked form) + ReactiveTokenRepositoryImpl.java:26,38 (create/updateToken use the 2-arg `true` form) — intent_anchor: "`public static TokenDto visibleToken(final TokenPojo token) { return new TokenDto(token, true); }`" — the existence of a NAMED `visibleToken` factory distinct from the default constructor is the deliberate signal that visibility is an opt-in decision per call-site; the list path opting OUT is intentional. — confidence: HIGH

- "The Data Sources list is intentionally NOT permission-gated — read-collaborative posture" — evidence: SecurityConstants.java:116-126 (Grep-confirmed: only POST/PUT/DELETE rules for `/api/datasources*`; the GET has no SecurityRule) + the parallel pattern across the controller package per the class sidecar — intent_anchor: the SECURITY_RULES table lists a rule for every MUTATING datasource verb and deliberately omits the read verb; the consistency of "mutations gated, reads open" across the platform is the visible decision. — confidence: HIGH (the absence is consistent and matches the platform-wide posture the class sidecar documents)

## bugs_limitations_corner_cases

- "GET /api/datasources is not in SecurityConstants.SECURITY_RULES — any authenticated user lists the entire catalog (incl. masked tokens, ODDRNs, namespaces) with no MANAGEMENT permission and no owner scope" — evidence: SecurityConstants.java:116-126 (Grep-confirmed only 4 mutating rules) — severity: MEDIUM
- "The list token field exposes the REAL last 6 characters of every collector token to every authenticated user — the mask `\"******\"+last6` is partial real-token material, not a placeholder" — evidence: TokenMapper.java:15-18 (`\"******\" + dto.tokenPojo().getValue().substring(len-6)`) + ReactiveDataSourceRepositoryImpl.java:167 — severity: LOW (6 of 40 chars is not brute-forceable; but it is genuine secret material handed to read-only users, and the masking is documented only as 'partially-redacted')
- "List ordering is data_source.id ASC (creation order) — newly-registered datasources appear LAST, not first; no recency or alphabetical sort" — evidence: ReactiveDataSourceRepositoryImpl.java:62 (3-arg `paginate`) + JooqQueryHelper.java:42-45 (default overload orders by `id` ASC) — severity: LOW (operator-UX: the order is deterministic but unintuitive and undocumented)
- "query parameter is name-prefix-only on the page but name-substring on the empty-page count — a `query` that matches by substring-not-prefix returns an empty items[] with a non-zero page_info.total ('0 of 1')" — evidence: ReactiveDataSourceRepositoryImpl.java:151-160 (page uses `startsWithIgnoreCase`) + ReactiveAbstractCRUDRepository.java:240-249 (`listCondition` uses `containsIgnoreCase`) + JooqQueryHelper.java:95-101 (empty-page branch falls back to `fetchCount`) — severity: MEDIUM (REFACTOR-425; this method-level sidecar REFINES the class/repo framing — the divergence surfaces only in the empty-page branch, not as a wrong count on a populated page)
- "`size` has no upper bound — the OpenAPI SizeParam declares no `maximum`; the value flows unclamped into SQL `LIMIT`. A caller can request the entire catalog (incl. 2 LEFT JOINs) in one query" — evidence: components.yaml:4222-4229 (no `maximum`) + DataSourceController.java:22-26 (no clamp) + ReactiveDataSourceRepositoryImpl.java:62 (size → `LIMIT`) — severity: LOW (typical catalogs are small; at a very large catalog this is an unbounded-response DoS surface)
- "`size=0`, negative `size`, and `page=0` are not validated — they reach the SQL as `LIMIT 0`, negative `LIMIT`, or negative `OFFSET`; the failure mode (empty list vs SQL error vs 500) is not statically determinable" — evidence: components.yaml:4213-4229 (no `minimum`) + ReactiveDataSourceRepositoryImpl.java:62 (`(page-1)*size` offset) — severity: LOW (pinned by probe P-037)
- "No Activity Event is emitted by the list path — consistent with the platform's data_source audit gap; a read endpoint emitting no audit is normal, noted only for completeness vs the class sidecar's audit-asymmetry concept" — evidence: DataSourceServiceImpl.java:38-43 (no emitter call) — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "components.yaml:4222-4229 (SizeParam, consumed by DataSourceController.java:22)"
      name: "size (query parameter)"
      value: "int32, required, NO minimum, NO maximum"
      questions:
        - q: "What at N > tunable?"
          a: "There is no declared upper bound. size flows unclamped through DataSourceServiceImpl.list -> ReactiveDataSourceRepositoryImpl.listDto -> jooqQueryHelper.paginate(homogeneousQuery, (page-1)*size, size) -> SQL `LIMIT <size>`. No Math.min at any layer. size=Integer.MAX_VALUE emits `LIMIT 2147483647` — the whole catalog plus 2 LEFT JOINs is materialised in one response."
          confidence: PROBE-NEEDED
          evidence: "P-037"
        - q: "What at tunable x 100?"
          a: "No tunable ceiling exists to multiply; size is bounded only by int32. A 100x-typical request (e.g. size=50000) is accepted; the cost is a 50000-row LIMIT scan with NAMESPACE+TOKEN joins."
          confidence: PROBE-NEEDED
          evidence: "P-037"
        - q: "What does the operator see at each boundary?"
          a: "size=1: a 1-item page (id-ASC first row). size=0: emits `LIMIT 0` — hypothesis: empty items[] with the real total. size=-1: negative LIMIT — failure mode (SQL error -> 500, or driver coercion) not statically determinable. page=0: `(0-1)*size` = negative OFFSET — failure mode not statically determinable."
          confidence: PROBE-NEEDED
          evidence: "P-037"
  name_behavior_pairs:
    - name: "getDataSourceList / GET /api/datasources"
      promise: "Returns a list of the available data sources (OpenAPI summary openapi.yaml:427-428: 'List of data sources' / 'Gets the list of available data sources'). The name implies no particular order and the live doc page states no order."
      implementation: "ReactiveDataSourceRepositoryImpl.listDto (lines 58-82) -> the 3-arg jooqQueryHelper.paginate (line 62) -> JooqQueryHelper.java:45 default overload -> ORDER BY data_source.id ASC. The list is creation-order (ascending primary key)."
      drift: MINOR
      operator_visible_consequence: "An operator expecting recently-registered datasources near the top of the Management tab finds them at the bottom; the order is deterministic id-ASC but undocumented. Not a wrong-result drift (LSN-019 class) — the order is real and stable — but the unstated ordering is an operator-surprise surface."
      confidence: STATIC-INFERRED
      evidence: "ReactiveDataSourceRepositoryImpl.java:62 + JooqQueryHelper.java:42-45 + WebFetch 2026-05-21 of features/management (no ordering documented)"
    - name: "registerDataSource vs getDataSourceList — token form"
      promise: "A method named to LIST data sources implies returning the same DataSource shape as register; the DataSource schema (components.yaml:1249-1269) has a REQUIRED `token` object, so a reader of the contract expects the list to carry tokens."
      implementation: "The list DOES carry a token object, but `TokenMapper.mapValue` (TokenMapper.java:15-18) renders it MASKED ('******'+last6) because listDto builds `new TokenDto(tokenPojo)` with showToken=false (ReactiveDataSourceRepositoryImpl.java:167). register/regenerate render PLAINTEXT (showToken=true). Same DataSource schema, different token rendering by call-site."
      drift: NONE
      operator_visible_consequence: "No drift — the differentiated rendering is intentional (the named `TokenDto.visibleToken` factory is the deliberate opt-in). Recorded so the contract-reader's assumption (list tokens == register tokens) is explicitly corrected."
      confidence: STATIC-INFERRED
      evidence: "TokenDto.java:5-12 + TokenMapper.java:15-18 + ReactiveDataSourceRepositoryImpl.java:167 + ReactiveTokenRepositoryImpl.java:26,38"
  orderings:
    - location: "ReactiveDataSourceRepositoryImpl.java:62 (jooqQueryHelper.paginate) + JooqQueryHelper.java:42-90"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer?"
          a: "`ORDER BY data_source.id ASC`. listDto calls the 3-arg paginate(baseSelect, offset, limit) which delegates to paginate(baseSelect, baseSelect.field(\"id\"), SortOrder.ASC, ...) (JooqQueryHelper.java:45). The paginate body applies the order field both to the inner windowed table and the outer select (JooqQueryHelper.java:74,80,89)."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataSourceRepositoryImpl.java:62 + JooqQueryHelper.java:42-45,74-89"
        - q: "What is the tie-breaker when sort-key values are equal?"
          a: "Not applicable — `id` is the primary key, unique by definition; there are never equal sort-key values. The ordering is fully deterministic with no secondary key needed."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataSourceRepositoryImpl.java:62 (id is the PK of data_source)"
        - q: "Which subset is returned when result-set > page size?"
          a: "Rows `[(page-1)*size, (page-1)*size+size)` of the id-ASC-ordered, query-filtered, soft-delete-filtered set. The window function rowNumber()/count() (JooqQueryHelper.java:73-74) computes total and hasNext over the same ordered set."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataSourceRepositoryImpl.java:58-82 + JooqQueryHelper.java:63-90"
        - q: "Does any upstream layer re-sort or filter the result?"
          a: "DataSourceServiceImpl.list (line 38-43) and DataSourceController.getDataSourceList (line 21-28) both pass the Page through unmodified — `.map(mapDtoPage)` and `.map(ResponseEntity::ok)` only. No re-sort, no re-filter at the service or controller tier. The UI MAY re-sort client-side (not in scope for this backend node — REFERENCE to the UI datasources component sidecar)."
          confidence: REFERENCE
          evidence: "odd-platform-ui datasources list component (not yet enriched)"
  auth_gates:
    - location: "SecurityConstants.java:116-126 (the /api/datasources rule block — GET absent)"
      endpoint: "GET /api/datasources (getDataSourceList)"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "DISABLED: open to any caller (DisabledSecurityConfiguration permitAll, per the class sidecar). LOGIN_FORM/OAUTH2/LDAP: returns the full datasource list to ANY authenticated user — the GET has no SecurityRule, so it falls through to the `pathMatchers(\"/**\").authenticated()` catch-all (AuthorizationCustomizer.java:29-30 per the class sidecar). No MANAGEMENT permission is checked. Identical 200 result across the 3 authenticated modes."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:116-126 (Grep-confirmed only POST/PUT/DELETE rules) + class sidecar AuthorizationCustomizer reference"
        - q: "What does an unauthenticated caller see?"
          a: "Under LOGIN_FORM/OAUTH2/LDAP: the catch-all `.authenticated()` rejects the request before the controller — the auth-mode-specific 401/redirect response (not a controller response). Under DISABLED: the request is permitted and the list is returned with no principal."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:116-126 + class sidecar requires-config block"
        - q: "What does a wrong-role caller see?"
          a: "A READ_ONLY user (or any user with NO DATA_SOURCE_* permission) gets the FULL list with HTTP 200 — there is no role gate on the read path. This is the read-collaborative posture: roles gate mutations, not reads."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:116-126 (no GET rule) — wrong-role on a write verb is a sibling-node concern"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "For this endpoint specifically: NOWHERE beyond the authentication catch-all. No @PreAuthorize on the method (DataSourceController.java:21-28), no programmatic check in DataSourceServiceImpl.list (line 38-43), no owner-scope predicate in ReactiveDataSourceRepositoryImpl.listDto (lines 58-82, 151-160). The only gate is `.authenticated()`."
          confidence: STATIC-INFERRED
          evidence: "DataSourceController.java:21-28 + DataSourceServiceImpl.java:38-43 + ReactiveDataSourceRepositoryImpl.java:58-82"
  resource_boundaries:
    - location: "DataSourceServiceImpl.java:38-43 (list method — NO @ReactiveTransactional)"
      kind: transactional
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "No — the list path is read-only (a SELECT with 2 LEFT JOINs). It issues no writes. Concurrent list calls are independent reads; no shared mutable state, no lock."
          confidence: STATIC-INFERRED
          evidence: "DataSourceServiceImpl.java:38-43 + ReactiveDataSourceRepositoryImpl.java:58-82 (SELECT only)"
        - q: "Is the call replay-safe?"
          a: "Yes — fully idempotent. Same page/size/query inputs against an unchanged catalog return an identical DataSourceList; no side-effect, no row touched, no counter incremented."
          confidence: STATIC-INFERRED
          evidence: "DataSourceController.java:21-28 + DataSourceServiceImpl.java:38-43"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No cache fronts this endpoint — no @Cacheable on the controller, service, or repository method; no manual cache read/write in the chain. Every call hits Postgres."
          confidence: STATIC-INFERRED
          evidence: "DataSourceController.java:21-28 + DataSourceServiceImpl.java:38-43 + ReactiveDataSourceRepositoryImpl.java:58-82 (no @Cacheable)"
  request_inputs:
    - location: "DataSourceController.java:22 (Integer page)"
      input_kind: query-param
      input_name: "page"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "'page' promises a 1-based page index into the paginated datasource list."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:4213-4221 (PageParam, description 'Page')"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "DataSourceController.getDataSourceList(page,...) (line 22-26) -> DataSourceServiceImpl.list(page,...) (line 39-41) -> ReactiveDataSourceRepositoryImpl.listDto(page,...) (line 58) -> jooqQueryHelper.paginate(homogeneousQuery, (page - 1) * size, size) (line 62) -> SQL OFFSET = (page-1)*size."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataSourceRepositoryImpl.java:62"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — `page` is used as a 1-based page index exactly as the name implies. (Edge: page=0 yields a negative OFFSET — a boundary bug, not a name-vs-behaviour mismatch; tracked under tunables / P-037.)"
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataSourceRepositoryImpl.java:62"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — not a silent translation."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataSourceRepositoryImpl.java:62"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE — `page` is a pure pagination index with no corresponding table column."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataSourceRepositoryImpl.java:58-82"
      routes_to_finding: "bugs_limitations_corner_cases (page=0 negative-offset boundary) AND stress_findings.tunables (P-037)"
    - location: "DataSourceController.java:22 (Integer size)"
      input_kind: query-param
      input_name: "size"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "'size' promises the number of datasource items returned per page."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:4222-4229 (SizeParam, description 'Size')"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Forwarded controller -> service -> ReactiveDataSourceRepositoryImpl.listDto -> jooqQueryHelper.paginate(homogeneousQuery, (page-1)*size, size) -> SQL `LIMIT <size>`."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataSourceRepositoryImpl.java:62"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — `size` becomes the SQL LIMIT, i.e. the page item count, as the name implies. The caveat is the ABSENCE of an upper bound (no `maximum` in the contract, no clamp in code), not a name-vs-behaviour mismatch."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataSourceRepositoryImpl.java:62 + components.yaml:4222-4229"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — not a silent translation. (The unbounded-size and size<=0 behaviour is pinned by P-037.)"
          confidence: STATIC-INFERRED
          evidence: "P-037"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE — `size` is a pure pagination limit with no corresponding table column."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataSourceRepositoryImpl.java:58-82"
      routes_to_finding: "bugs_limitations_corner_cases (unbounded size) AND stress_findings.tunables (P-037)"
    - location: "DataSourceController.java:23 (String query)"
      input_kind: query-param
      input_name: "query"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "'query' (OpenAPI description 'Search text') promises a free-text search filter over the datasource list — the caller expects datasources whose name matches the search text."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:4231-4237 (SearchParam, description 'Search text')"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Two divergent uses. PAGE branch: ReactiveDataSourceRepositoryImpl.queryCondition (line 151-160) adds `DATA_SOURCE.NAME.startsWithIgnoreCase(query)` — name-PREFIX match. COUNT branch (empty-page fallback only): fetchCount(query) (ReactiveDataSourceRepositoryImpl.java:80) -> ReactiveAbstractCRUDRepository.listCondition (line 240-249) adds `nameField.containsIgnoreCase(query)` — name-SUBSTRING match. The empty-page branch of JooqQueryHelper.pageifyResult (line 95-101) is where the count predicate is consulted."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataSourceRepositoryImpl.java:151-160,80 + ReactiveAbstractCRUDRepository.java:240-249 + JooqQueryHelper.java:95-101"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY — 'query'/'Search text' implies one consistent search; the implementation applies a name-PREFIX match to select page rows but a name-SUBSTRING match to compute the total when the page is empty. The two predicates disagree; nothing in the API surface tells the caller. (REFACTOR-425.)"
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataSourceRepositoryImpl.java:156 vs ReactiveAbstractCRUDRepository.java:243"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "When `query` matches a datasource by substring but not by prefix (e.g. query='snow' against 'my-snowflake-dev'), the page (startsWith) returns ZERO items, so pageifyResult takes the empty branch and `total` comes from the contains-count = 1. The caller sees an empty list labelled '0 of 1' — a phantom total with no rows to show. When the page is non-empty the window-function count uses the same startsWith predicate and the numbers agree, so the defect is invisible on populated pages."
          confidence: PROBE-NEEDED
          evidence: "P-036"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "The data_source full-text-search vector exists (the platform maintains an FTS vector for data sources, refreshed by searchEntrypointRepository.updateChangedDataSourceVector) but listDto's `query` does NOT use it — it uses a plain LIKE-prefix on `DATA_SOURCE.NAME`. A search that honoured the 'Search text' promise consistently would use either the FTS vector or one predicate for both page and count."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDataSourceRepositoryImpl.java:156 (NAME startsWithIgnoreCase, not the FTS vector)"
      routes_to_finding: "bugs_limitations_corner_cases (query divergence / REFACTOR-425) AND docs_link_semantic.doc_drift_findings (search behaviour undocumented)"
  probes_emitted:
    - probe_id: P-034
      question: "Is GET /api/datasources ordered by data_source.id ASC (creation order), not by name or recency?"
      probe_path: "lineage/odd-platform/probes/P-034.yaml"
    - probe_id: P-035
      question: "Does the list endpoint return the masked token form ('******'+real last 6 chars), not the 40-char plaintext?"
      probe_path: "lineage/odd-platform/probes/P-035.yaml"
    - probe_id: P-036
      question: "Does a `query` matching by substring-not-prefix yield empty items[] with a non-zero page_info.total?"
      probe_path: "lineage/odd-platform/probes/P-036.yaml"
    - probe_id: P-037
      question: "Is `size` unbounded (size=Integer.MAX_VALUE accepted), and what is the size=0 / negative-size / page=0 boundary behaviour?"
      probe_path: "lineage/odd-platform/probes/P-037.yaml"
  stress_summary:
    triggers_total: 9
    questions_total: 30
    answers_static_inferred: 22
    answers_probe_needed: 7
    answers_reference: 1
    drift_flags: 2
```

## security

- auth_mode_relevance: LOGIN_FORM | OAUTH2 | LDAP | DISABLED — under the 3 authenticated modes, the request must be authenticated (the catch-all `pathMatchers("/**").authenticated()`); the list endpoint adds no permission gate on top. Under DISABLED the endpoint is open with no principal. S2S (orthogonal) grants ADMIN to an X-API-Key holder — irrelevant for the list endpoint, which needs no permission anyway.
- ingestion_filter_relevance: NO — `/api/datasources` is the UI admin surface; the IngestionDataSourceFilter / IngestionDataEntitiesFilter apply only to `/ingestion/*` paths (per the class sidecar).
- authorization_assertions:
  - "GET /api/datasources has NO SecurityRule — Grep-confirmed: SecurityConstants.java:116-126 lists only `/api/datasources` POST (DATA_SOURCE_CREATE), `/api/datasources/{data_source_id}` PUT (DATA_SOURCE_UPDATE), `/api/datasources/{data_source_id}` DELETE (DATA_SOURCE_DELETE), `/api/datasources/{data_source_id}/token` PUT (DATA_SOURCE_TOKEN_REGENERATE). The read verb is intentionally absent — evidence: SecurityConstants.java:116-126"
  - "No @PreAuthorize on getDataSourceList, no programmatic permissionService check in DataSourceServiceImpl.list — evidence: DataSourceController.java:21-28 + DataSourceServiceImpl.java:38-43"
- owner_scoping: BYPASSES — `getDataSourceList` returns ALL live datasources; no owner-scope predicate at the controller, service, or repository (ReactiveDataSourceRepositoryImpl.listDto + queryCondition apply only `deleted_at IS NULL` and the optional name filter). Consistent with the platform's read-collaborative posture.
- data_exposure:
  - "Full live datasource catalog (per item: id, name, oddrn, description, namespace object, token object) → any authenticated user via GET /api/datasources, no permission, no owner filter"
  - "Collector token — MASKED form `\"******\" + last 6 plaintext chars` → any authenticated user. This is API-side masking (TokenMapper.mapValue, TokenMapper.java:15-18), NOT UI-side; the class sidecar left this ambiguous and this sidecar resolves it. The masked form leaks the real trailing 6 characters of every token (P-035 pins this)."
  - "ODDRN and namespace_name of every datasource → any authenticated user; a read-only user can enumerate the full topology of registered systems."
- known_security_gaps:
  - "GET endpoint not in SecurityConstants.SECURITY_RULES — every authenticated user lists the full catalog incl. masked tokens; intentional read-collaborative posture but not documented at the doc-site" — evidence: SecurityConstants.java:116-126 + DataSourceController.java:21-28 — severity: MEDIUM
  - "List token field leaks the real last 6 characters of every collector token to read-only users — the doc page calls this 'partially-redacted' but does not say the visible part is real token material" — evidence: TokenMapper.java:15-18 + ReactiveDataSourceRepositoryImpl.java:167 — severity: LOW
  - "A single-line change at ReactiveDataSourceRepositoryImpl.java:167 (1-arg TokenDto -> TokenDto.visibleToken) would flip the list endpoint to expose full 40-char plaintext tokens to every authenticated user, with no other code change and no test to catch it" — evidence: ReactiveDataSourceRepositoryImpl.java:167 + TokenDto.java:10-12 — severity: MEDIUM (regression-surface; P-035 is the guard)
  - "DISABLED auth.type makes the list (and all datasource endpoints) fully open — cross-link to the DISABLED-mode bypass cluster per the class sidecar" — evidence: class sidecar requires-config block — severity: HIGH under a misconfigured production DISABLED deployment

## performance

- hot_paths:
  - "getDataSourceList runs synchronously per request; the SQL is a CTE (`data_source_cte`: paginated `SELECT FROM data_source WHERE deleted_at IS NULL [+ startsWithIgnoreCase]`) + 2 LEFT JOINs against NAMESPACE and TOKEN (ReactiveDataSourceRepositoryImpl.java:58-82). For typical catalogs (<500 datasources) sub-100ms. The window-function count (JooqQueryHelper.java:73) runs in the same query." — evidence: ReactiveDataSourceRepositoryImpl.java:58-82 + JooqQueryHelper.java:63-90
- throughput_characteristics:
  - "single paginated read per request; clients iterate pages to enumerate the catalog"
  - "reactive Mono — non-blocking, one DB round-trip per call; no @ReactiveTransactional (read-only)"
- resource_allocation:
  - "per-request memory bounded by `size` — and `size` is UNCLAMPED (no `maximum` in components.yaml:4222-4229). A caller requesting size=Integer.MAX_VALUE makes the server materialise the entire data_source table + 2 LEFT JOINs into one in-memory list (`jooqReactiveOperations.flux(query).collectList()` at ReactiveDataSourceRepositoryImpl.java:75-76) before mapping — an unbounded-response surface" — evidence: ReactiveDataSourceRepositoryImpl.java:62,75-76 + components.yaml:4222-4229
  - "no outbound HTTP; no token generation; the read is pure DB"
- scaling_characteristics:
  - "stateless, read-only — instances scale horizontally; no lock, no FOR UPDATE on the list path (contrast getIdByOddrnForUpdate which the ingestion path uses)"
  - "the name filter uses `startsWithIgnoreCase` (a `LIKE 'query%'` — sargable, can use a B-tree index on `name`); it does NOT use the FTS vector. For very large catalogs a `name` index matters" — evidence: ReactiveDataSourceRepositoryImpl.java:156
- known_performance_gaps:
  - "`size` has no upper bound — at a very large catalog a single oversized request degrades response time and memory; no clamp, no default ceiling" — evidence: components.yaml:4222-4229 + ReactiveDataSourceRepositoryImpl.java:62 — severity: LOW (catalog-size-dependent; pinned by P-037)

## upstream_callers

- entry_point: "ui_route:/management/datasources"
  caller_node: "odd-platform-ui datasources-list React component (not yet enriched — REFERENCE)"
  multiplicity_per_trigger: unresolved
  evidence: "DataSourceController.java:21-28 is the GET /api/datasources handler; the Management → Datasources tab is the operator surface per WebFetch 2026-05-21 of features/management (status 200). The UI's datasources thunk invokes the generated DataSourceApi client — per the class sidecar's upstream_callers, the UI files are odd-platform-ui/src/redux/thunks/datasources.thunks.ts + lib/hooks/api/datasource.ts + lib/api.ts."
  observation_class: ui-call
  unresolved: true
- entry_point: "rest:GET /api/datasources"
  caller_node: "any odd-api-consumer authenticated as a UI user (LOGIN_FORM/OAUTH2/LDAP) OR via S2S X-API-Key"
  multiplicity_per_trigger: 1
  evidence: "DataSourceController.java:21-28 — direct REST entry point; one service call per request (DataSourceServiceImpl.java:39-41)."
  observation_class: rest-call

## downstream_side_effects

- side_effect_class: page-render
  description: "Returns a DataSourceList payload (items: List<DataSource> + page_info) — HTTP 200; each item carries id/name/oddrn/description/namespace/token-masked"
  evidence: "DataSourceController.java:25-27 + DataSourceMapper.java:32-36"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/management/datasources"
    - "rest:GET /api/datasources"

- side_effect_class: db-read
  description: "One SELECT: a CTE-paginated `data_source` scan (ordered by id ASC) with 2 LEFT JOINs against NAMESPACE and TOKEN; plus, only on the empty-page branch, a second `SELECT COUNT(*)` via fetchCount"
  evidence: "ReactiveDataSourceRepositoryImpl.java:58-82 (the CTE+joins) + ReactiveDataSourceRepositoryImpl.java:80 (fetchCount, consulted by JooqQueryHelper.java:95-101 only when the page is empty)"
  cardinality_per_call: "1 (populated page) or 2 (empty page — adds the fetchCount query)"
  reachable_from_entry_points:
    - "ui_route:/management/datasources"
    - "rest:GET /api/datasources"

- (no db-write, no activity-emit, no external-call, no sse-push, no cache-mutate — the list path is read-only; verified DataSourceServiceImpl.java:38-43 has no @ReactiveTransactional and no emitter, ReactiveDataSourceRepositoryImpl.listDto issues only SELECTs)

## coherence_notes

- kind: refines
  target: "odd-platform java DataSourceController controller-class:DataSourceController"
  note: |
    The class sidecar's `security.data_exposure` left the token-redaction layer
    ambiguous — verbatim: "the partially-redacted Collector token shown in the UI
    card per the live doc page suggests the API DOES emit the token value, possibly
    redacted at the UI layer rather than the API layer" and "the redaction may be
    UI-side, not API-side". This method-level trace RESOLVES it: the redaction is
    API-SIDE, in TokenMapper.mapValue (TokenMapper.java:15-18), gated by
    TokenDto.showToken. The LIST path (ReactiveDataSourceRepositoryImpl.java:167,
    `new TokenDto(tokenPojo)` -> showToken=false) returns `"******"+last6`; the
    register/regenerate paths (ReactiveTokenRepositoryImpl.java:26,38, showToken=true)
    return full plaintext. The UI card's "partially-redacted" appearance is the API
    masking surfacing unchanged, not a UI transformation.
- kind: refines
  target: "odd-platform java DataSourceController controller-class:DataSourceController"
  note: |
    The class sidecar frames REFACTOR-425 as "the page only shows startsWith-matches,
    total includes contains-matches" — implying a wrong count on a populated page
    ("page returns ONE item but a total count of TWO"). The re-trace through
    JooqQueryHelper.pageifyResult (lines 92-127) shows the divergence is gated by
    the EMPTY-PAGE branch only: when records is non-empty, `total` comes from the
    window-function `count().over()` (line 73,114) computed over the SAME startsWith
    `homogeneousQuery` — so populated pages have a CONSISTENT count. The
    `containsIgnoreCase` count (fetchCount, ReactiveAbstractCRUDRepository.java:243)
    is consulted only by the empty-records branch (JooqQueryHelper.java:95-101). The
    actual operator-visible defect is an EMPTY list with a non-zero total ("0 of 1")
    when `query` matches by substring but not by prefix — not a wrong count on a
    page that has rows. P-036 pins this refined shape.
- kind: strengthens
  target: "odd-platform java DataSourceController controller-class:DataSourceController"
  note: |
    Confirms the class sidecar's claim that GET /api/datasources is absent from
    SecurityConstants.SECURITY_RULES — independently Grep-verified this session:
    SecurityConstants.java:116-126 contains exactly 4 `/api/datasources*` rules,
    all for POST/PUT/DELETE. Strengthens the class sidecar's read-collaborative
    finding with a method-scoped re-verification at the same commit (80637ed).
- kind: strengthens
  target: "odd-platform java repository reactive repository:ReactiveDataSourceRepositoryImpl"
  note: |
    Adds the ORDERING fact the repository sidecar's listDto operation entry did not
    state explicitly. The repo sidecar describes listDto's CTE + paginate but does
    not record the resulting ORDER BY. This sidecar traces it: the 3-arg
    `jooqQueryHelper.paginate(homogeneousQuery, offset, size)` (ReactiveDataSourceRepositoryImpl.java:62)
    delegates to JooqQueryHelper.java:45 — `ORDER BY data_source.id ASC`. Strengthens
    the repo sidecar's listDto coverage with the operator-visible ordering.

## sources

- understanding ← DataSourceController.java:21-28 + DataSourceServiceImpl.java:38-43 + ReactiveDataSourceRepositoryImpl.java:58-82,151-160,167 + TokenMapper.java:15-18 + TokenDto.java:5-12 + SecurityConstants.java:116-126
- concepts.entities.DataSourceList ← components.yaml:1290-1301 + DataSourceMapper.java:32-36
- concepts.entities.DataSource ← components.yaml:1249-1269
- concepts.entities.Token ← components.yaml:1327-1349 + TokenMapper.java:15-18
- concepts.entities.TokenDto ← TokenDto.java:5-13
- concepts.entities.page-size-query ← components.yaml:4213-4237
- concepts.operations ← DataSourceController.java:21-28 + openapi.yaml:425-442
- concepts.invariants.ordering ← ReactiveDataSourceRepositoryImpl.java:62 + JooqQueryHelper.java:42-45
- concepts.invariants.soft-delete ← ReactiveDataSourceRepositoryImpl.java:151-160
- dependencies_semantic.requires-feature.DataSourceService ← DataSourceService.java:11 + DataSourceServiceImpl.java:38-43
- dependencies_semantic.requires-feature.listDto ← ReactiveDataSourceRepositoryImpl.java:58-82
- dependencies_semantic.requires-feature.TokenMapper ← TokenMapper.java:15-18
- dependencies_semantic.requires-feature.JooqQueryHelper ← JooqQueryHelper.java:42-127
- tests_coverage_semantic ← Glob (no DataSourceControllerTest, per the class sidecar at commit 80637ed) + DataSourceRepositoryImplTest.java (per the ReactiveDataSourceRepositoryImpl sidecar)
- docs_link_semantic.inferred_docs[0] (management) ← WebFetch 2026-05-21 of https://docs.opendatadiscovery.org/features/management (status 200)
- docs_link_semantic.inferred_docs[1] (api-reference) ← inherited from the DataSourceController class sidecar (WebFetch 2026-05-20 status 200; within 11-day stale cadence)
- implicit_adrs[0] (masked token list / plaintext register) ← TokenDto.java:5-12 + TokenMapper.java:15-18 + ReactiveDataSourceRepositoryImpl.java:167 + ReactiveTokenRepositoryImpl.java:26,38
- implicit_adrs[1] (list not permission-gated) ← SecurityConstants.java:116-126 (Grep-verified)
- bugs_limitations_corner_cases (each entry) ← cited inline via evidence: tags
- stress_findings ← DataSourceController.java:21-28 + DataSourceServiceImpl.java:38-43 + ReactiveDataSourceRepositoryImpl.java:58-82,151-160,167 + JooqQueryHelper.java:42-127 + ReactiveAbstractCRUDRepository.java:225-249 + TokenMapper.java:15-18 + TokenDto.java:5-13 + components.yaml:4213-4237 + SecurityConstants.java:116-126
- security.authorization_assertions ← SecurityConstants.java:116-126 (Grep-verified) + DataSourceController.java:21-28 + DataSourceServiceImpl.java:38-43
- security.data_exposure ← TokenMapper.java:15-18 + ReactiveDataSourceRepositoryImpl.java:167 + WebFetch 2026-05-21 features/management
- performance.hot_paths ← ReactiveDataSourceRepositoryImpl.java:58-82 + JooqQueryHelper.java:63-90
- performance.resource_allocation ← ReactiveDataSourceRepositoryImpl.java:62,75-76 + components.yaml:4222-4229
- upstream_callers ← DataSourceController.java:21-28 + class sidecar upstream_callers block
- downstream_side_effects ← DataSourceController.java:25-27 + DataSourceServiceImpl.java:38-43 + ReactiveDataSourceRepositoryImpl.java:58-82,80 + JooqQueryHelper.java:95-101
- coherence_notes ← the DataSourceController class sidecar + the ReactiveDataSourceRepositoryImpl sidecar (both read this session)

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (the absence of a controller test is verified; the repository-tier coverage is cited from the repo sidecar)
- docs_link_semantic: HIGH (management page fetched live this session status 200; api-reference inherited at 1-day age within cadence)
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: MEDIUM (the unbounded-size DoS surface is real but uncharacterised — latency/memory at a large catalog is PROBE-NEEDED, P-037)
- upstream_callers: MEDIUM (the UI caller node is a REFERENCE — not yet enriched; multiplicity unresolved)
- downstream_side_effects: HIGH (read-only path; the side effects are fully traced)
- stress_findings: MEDIUM (22 of 30 questions STATIC-INFERRED; 7 PROBE-NEEDED across P-034..P-037 — the load-bearing token-form question is STATIC-INFERRED with strong evidence and additionally probe-guarded; ordering, count-divergence shape and size-boundary remain PROBE-NEEDED)

## Maintainer notes

(empty — no prior sidecar existed at this path; this is the first enrichment of this node)

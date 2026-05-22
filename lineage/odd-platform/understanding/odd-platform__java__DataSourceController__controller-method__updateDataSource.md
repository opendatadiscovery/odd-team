---
node_id: "odd-platform java DataSourceController controller-method:updateDataSource"
node_kind: controller-method
axis: controllers
extracted_at_commit: 80637ed
enriched_at_commit: 80637ed
extractor_version: 0.1.0
prompt_version: file-analyser/0.5.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-21-batch-ZB-updateDataSource
---

# DataSourceController.updateDataSource — semantic understanding

## understanding

The single endpoint handler for `PUT /api/datasources/{data_source_id}` — the
operator-facing "edit data source" action on the Management → Datasources tab.
The handler body is a 4-line reactive proxy (`DataSourceController.java:38-45`):
unwrap the `Mono<DataSourceUpdateFormData>` request body, `flatMap` it into
`dataSourceService.update(dataSourceId, form)`, and `map` the result to
`ResponseEntity.ok` (HTTP 200). All behaviour lives in
`DataSourceServiceImpl.update` (`DataSourceServiceImpl.java:68-83`): the service
loads the existing row via `dataSourceRepository.getDto(id)`, raises a clean
`NotFoundException` (HTTP 404) via `switchIfEmpty` when the row is absent or
soft-deleted, optionally get-or-creates a namespace, applies the form to the
existing pojo through the MapStruct `applyToPojo` mapper, persists the UPDATE,
and refreshes the full-text-search vectors. The load-bearing characteristic of
this endpoint is that `update` is a full-form **REPLACE** of three mutable
fields (`name`, `description`, `namespace_name`), not a merge: a field omitted
from the JSON body deserialises to null and — under MapStruct's default
null-handling — is written as null onto the existing row. This sidecar is the
method-level deepening of the `DataSourceController` class node; see
`coherence_notes`.

## concepts

- entities:
  - "DataSourceUpdateFormData (request body — exactly 3 optional fields: `description`, `name`, `namespace_name`; NO `oddrn`, NO `connection_url`, NO token field; NO `required` block — components.yaml:1317-1325)"
  - "DataSource (response model — the persisted DataSourcePojo + NamespacePojo + TokenDto, produced by DataSourceMapper.mapDto)"
  - "DataSourceDto (the joined read view getDto returns: DataSourcePojo + NamespacePojo + TokenDto)"
  - "DataSourcePojo (the jOOQ row the UPDATE writes — name, oddrn, description, namespace_id, collector_id, token_id, created_at, updated_at, deleted_at)"
  - "data_source_id (Long path variable — the row to update)"
  - "Mono<ResponseEntity<DataSource>> (the reactive response shape — DataSourceController.java:39)"
- operations:
  - "update (DataSourceController.java:38-45): PUT /api/datasources/{data_source_id} — full-form REPLACE of name/description/namespace_name on an existing live data source; returns the updated DataSource"
  - "existence-check (DataSourceServiceImpl.java:71-72): getDto(id) + switchIfEmpty(NotFoundException) — 404 when id is absent OR soft-deleted"
  - "namespace get-or-create (DataSourceServiceImpl.java:74-76): if namespace_name is non-empty, namespaceService.getOrCreate creates the namespace if absent and stamps namespace_id"
  - "applyToPojo (DataSourceMapper.java:49-56): MapStruct @MappingTarget — overwrites the existing pojo's mapped fields from the form"
  - "FTS refresh (DataSourceServiceImpl.java:77, 80, 127-136): updateChangedDataSourceVector + (updateChangedNamespaceVector | clearNamespaceVector) inside the transaction"
- invariants:
  - "The endpoint never creates a row — getDto must resolve a live row first, else 404. It is strictly an UPDATE-of-existing operation."
  - "update is REPLACE-not-MERGE: an omitted form field nulls the corresponding column (MapStruct default null-handling — see stress_findings.name_behavior_pairs)."
  - "The UPDATE is single-row and the whole service method runs inside one @ReactiveTransactional boundary (DataSourceServiceImpl.java:69) — getDto, namespace get-or-create, the UPDATE, and the 2 FTS writes commit or roll back together."
  - "Path mapping (`PUT /api/datasources/{data_source_id}`) is OpenAPI-contract-driven via the @Override of DataSourceApi.updateDataSource; there is no @PutMapping on the controller method."
  - "The token is NOT in DataSourceUpdateFormData and is never touched by this endpoint — token rotation is a separate endpoint (regenerateDataSourceToken, sibling node)."
  - "Authorization is path-based: PUT /api/datasources/{data_source_id} requires DATA_SOURCE_UPDATE (SecurityConstants.java:118-120) — no @PreAuthorize, no programmatic check in the handler or service."
- audiences:
  - "platform-operator (the Management → Datasources tab 'edit' affordance — per WebFetch 2026-05-21 of docs.opendatadiscovery.org/features/management, verbatim: 'add, edit, or remove a piece of catalog configuration')"
  - "odd-api-consumer (programmatic clients with an authenticated UI session OR S2S X-API-Key — the same PUT endpoint is reachable)"

## dependencies_semantic

- requires-feature:
  - "DataSourceApi OpenAPI-generated interface — declares updateDataSource(Long, Mono<DataSourceUpdateFormData>, ServerWebExchange); the contract is openapi.yaml:463-489"
  - "DataSourceService.update(long, DataSourceUpdateFormData) — DataSourceServiceImpl.java:68-83 holds all logic"
  - "DataSourceMapper.applyToPojo — DataSourceMapper.java:49-56; the @MappingTarget mapper that writes the form onto the existing pojo"
  - "ReactiveDataSourceRepository.getDto(id) + .update(pojo) — the read-then-write pair (getDto filters deleted_at IS NULL per the ReactiveDataSourceRepositoryImpl sidecar)"
  - "NamespaceService.getOrCreate — invoked only when namespace_name is non-empty"
  - "ReactiveSearchEntrypointRepository — updateChangedDataSourceVector / updateChangedNamespaceVector / clearNamespaceVector for post-update FTS"
  - "ControllerAdvice — maps NotFoundException → 404 (the only service-tier exception this endpoint can raise on a well-formed request)"
- requires-config:
  - "auth.type (DISABLED / LOGIN_FORM / OAUTH2 / LDAP) — gates whether the request reaches the controller and whether the DATA_SOURCE_UPDATE rule is enforceable against a principal"
  - "auth.s2s.enabled (default false) — when true, an X-API-Key holder is granted ADMIN and satisfies DATA_SOURCE_UPDATE unconditionally"
  - "spring.codec.max-in-memory-size: 20MB (application.yml) — caps the Mono<DataSourceUpdateFormData> body deserialization; a >20MB body throws DataBufferLimitException → 500"
- requires-runtime:
  - "Spring WebFlux + Reactor — the handler returns Mono<ResponseEntity<DataSource>>; body deserialization is via the reactive codec"
  - "@ReactiveTransactional → Spring @Transactional('reactiveTransactionManager') (ReactiveTransactional.java:11) — one R2DBC connection held for the service-method chain"
  - "ReactiveSecurityContextHolder — the principal the path-based ReactiveAuthorizationManager evaluates"
- coupling:
  - "Coupled to the OpenAPI contract: a change to DataSourceUpdateFormData (e.g. adding a connection field) propagates to the generated interface and the MapStruct mapper without a code change here — but the new field would then become part of the REPLACE set silently."
  - "Coupled to DataSourceMapper's null-handling: the REPLACE-not-MERGE behaviour is a consequence of MapperConfig (MapperConfig.java:7-11) NOT setting nullValuePropertyMappingStrategy. A future global IGNORE setting would silently convert this endpoint from REPLACE to MERGE."
  - "Asymmetric with the S2S ingestion path (IngestionController.createDataSourceEntity, sibling-of-class): the same data_source row is also mutated by collector ingestion, which narrows the UPDATE to name+description — see coherence_notes and the class sidecar's REFACTOR-423."

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "PUT /api/datasources/{id} with a complete body replaces name + description + namespace_id and returns 200"
    test_class: integration
    criticality: HIGH
    note: "no DataSourceControllerTest exists (verified at the class sidecar — Glob returned no DataSourceControllerTest / DataSourceServiceImplTest)"
  - behaviour: "PUT to a never-existed id returns a clean 404 (NotFoundException), NOT a silent 200"
    test_class: integration
    criticality: HIGH
    note: "load-bearing — pinned by probe P-042; the contract diverges from DataEntityServiceImpl.upsertDescription's silent-200"
  - behaviour: "PUT to a soft-deleted id returns 404 (getDto filters deleted_at IS NULL)"
    test_class: integration
    criticality: HIGH
    note: "pinned by probe P-042"
  - behaviour: "PUT with `description` omitted nulls the existing description (REPLACE-not-MERGE)"
    test_class: integration
    criticality: HIGH
    note: "pinned by probe P-043 — the operator-visible data-loss-on-partial-edit class"
  - behaviour: "PUT with `namespace_name` omitted nulls namespace_id (applyToPojo namespace==null branch, DataSourceMapper.java:55)"
    test_class: integration
    criticality: MEDIUM
    note: "an operator editing only the name silently detaches the namespace"
  - behaviour: "PUT renaming to a `name` already held by another live data source returns 400 UniqueConstraintException (data_source_name_unique partial index)"
    test_class: integration
    criticality: MEDIUM
    note: "the partial unique index fires at the SQL layer; the @ReactiveTransactional rolls back"
  - behaviour: "a user without DATA_SOURCE_UPDATE permission is blocked (403); a user with it succeeds (200); unauthenticated is 401; DISABLED is fully open"
    test_class: security
    criticality: HIGH
    note: "pinned by probe P-044 — the DISABLED-open cell is the operator hazard"
  - behaviour: "PUT does NOT emit an Activity Event (the data_source-mutation audit gap)"
    test_class: integration
    criticality: MEDIUM
    note: "DataSourceServiceImpl imports no activity emitter — verified at the class sidecar"
  - behaviour: "the FTS vector reflects the new name immediately after a successful PUT (updateChangedDataSourceVector inside the transaction)"
    test_class: integration
    criticality: LOW
  - behaviour: "the UPDATE + 2 FTS writes roll back together if any downstream Mono fails"
    test_class: integration
    criticality: MEDIUM
    note: "the @ReactiveTransactional boundary atomicity is unverified"
- test_files:
  - "NO DataSourceControllerTest.* exists in the test tree (verified at the class sidecar via Glob)"
  - "NO DataSourceServiceImplTest.* exists (verified at the class sidecar)"
- gaps: |
    The endpoint has ZERO direct test coverage. The integration class has the
    worst coverage and carries the highest-leverage gaps: the 404-on-missing
    contract (P-042) and the REPLACE-not-MERGE field-nulling (P-043) are both
    operator-observable contracts that a routine refactor could silently flip.
    A regression that added a `switchIfEmpty(Mono.just(...))` fail-soft to
    `update` (mirroring DataEntityServiceImpl.incrementViewCount) would convert
    the clean 404 into a silent no-op; a regression that set a global MapStruct
    IGNORE-on-null would convert REPLACE into MERGE. Neither has a guard. The
    security class is the second-worst gap: the DISABLED-mode all-open behaviour
    on a destructive edit endpoint (P-044 cell S4) is the LSN-001/LSN-002
    failure shape and is untested.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/management"
    anchor: ""
    rationale: "The canonical doc page for the Management → Datasources tab; it confirms an operator-facing 'edit' affordance exists but is silent on every mechanic of the update endpoint this method serves."
    last_verified_at: "2026-05-21T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      WebFetched 2026-05-21 (status 200). The page confirms the Datasources tab
      lets operators "add, edit, or remove a piece of catalog configuration" and
      describes the workflow "Inspect what was registered after a Collector first
      reported; add a description / tag a source; remove a source no longer
      ingested." The WebFetch confirmed the page does NOT specify: which fields
      can be changed when editing; whether edits replace or merge existing data;
      what happens to the collector token during an edit; error handling for
      non-existent or deleted sources.
- doc_drift_findings:
  - "The Management page (WebFetched 2026-05-21, status 200) advertises an 'edit' affordance but documents NONE of the update endpoint's operator-relevant mechanics: (a) editing is REPLACE-not-MERGE — an operator who edits only the name via a partial API call nulls the description and detaches the namespace; (b) only 3 fields are editable (name, description, namespace_name) — the token and oddrn are not; (c) editing a non-existent or soft-deleted source returns 404; (d) renaming to a name already used by another live source fails with 400. The doc gap is identical in shape to the class sidecar's finding and to the ReactiveDataSourceRepositoryImpl sidecar's doc-drift finding."

## implicit_adrs

- "Update is a full-form REPLACE — an omitted field is nulled, the operator must resend every field they want to keep" — evidence: DataSourceMapper.java:49 (`applyToPojo(@MappingTarget DataSourcePojo, DataSourceUpdateFormData)`) + MapperConfig.java:7-11 (NO nullValuePropertyMappingStrategy) + DataSourceMapper.java:51-56 (the namespace overload sets namespace_id to null when namespace==null) — intent_anchor: "`DataSourcePojo applyToPojo(@MappingTarget final DataSourcePojo dataSource, final DataSourceUpdateFormData form);` — the @MappingTarget over the WHOLE form, with no per-field null guard, is the deliberate signal that the update endpoint replaces rather than patches." — confidence: MEDIUM (MapStruct's default SET_TO_NULL is the documented framework default for an unspecified strategy; pinned by probe P-043)
- "Update of a non-existent or soft-deleted data source fails fast with 404 — the endpoint never silently no-ops" — evidence: DataSourceServiceImpl.java:71-72 (`dataSourceRepository.getDto(id).switchIfEmpty(Mono.error(new NotFoundException("Data source", id)))`) — intent_anchor: "`.switchIfEmpty(Mono.error(new NotFoundException(\"Data source\", id)))` — the explicit error on an empty getDto is the deliberate anti-silent-write guard; it is the SAME guard DataEntityServiceImpl.createMetadata uses and the one DataEntityServiceImpl.upsertDescription deliberately omits." — confidence: HIGH

## bugs_limitations_corner_cases

- "Partial-edit data loss: a PUT body omitting `description` nulls the existing description; omitting `namespace_name` nulls namespace_id and detaches the namespace. An API consumer (or a UI bug) sending a partial body to 'rename' a source silently wipes the other two fields. There is no MERGE option on this endpoint." — evidence: DataSourceMapper.java:49-56 + MapperConfig.java:7-11 — severity: MEDIUM
- "Editing a non-existent or soft-deleted data source returns 404, but the doc site never states this — an operator scripting against a stale id sees a 404 with no documented meaning." — evidence: DataSourceServiceImpl.java:71-72 — severity: LOW
- "Renaming to a `name` already used by another LIVE data source raises SQLSTATE 23505 → 400 UniqueConstraintException; the 400 body does not distinguish 'name collision' from other bad-request causes." — evidence: V0_0_1__init.sql:41 (`name varchar(255) UNIQUE`) + the partial unique index data_source_name_unique noted in the ReactiveDataSourceRepositoryImpl sidecar — severity: LOW
- "No Activity Event on the data_source UPDATE — the edit is invisible to the Activity Feed; the Datasources tab shows only current state, not a change history." — evidence: DataSourceServiceImpl.java entire file (no activity emitter import — verified at the class sidecar) — severity: MEDIUM
- "The OpenAPI contract declares response 201 for this PUT (openapi.yaml:482 `'201': The resource has been successfully updated`) but the controller hard-codes `ResponseEntity.ok()` (200) at DataSourceController.java:44 — a client checking for 201 per the spec will mis-detect success." — evidence: openapi.yaml:481-487 + DataSourceController.java:44 — severity: LOW
- "An operator's edit can be silently overwritten by the next collector ingestion of the same ODDRN — the S2S path re-writes name+description. This endpoint provides no warning that a collector exists for the source being edited." — evidence: cross-path with IngestionController.createDataSourceEntity (sibling-of-class node) + REFACTOR-423 (filed at the class sidecar) — severity: MEDIUM

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "application.yml:14-15 (spring.codec.max-in-memory-size)"
      name: "spring.codec.max-in-memory-size"
      value: "20MB"
      questions:
        - q: "What at N > tunable? (request body over 20MB)"
          a: "The reactive codec deserializing Mono<DataSourceUpdateFormData> throws DataBufferLimitException; no @ExceptionHandler converts it to 413, so ControllerAdvice's generic Exception handler maps it to HTTP 500. A DataSourceUpdateFormData has only 3 short string fields — a 20MB body is only reachable via an absurdly large description; not a realistic operator case."
          confidence: STATIC-INFERRED
          evidence: "application.yml:14-15 + ControllerAdvice generic handler (ControllerAdvice.java:61-66 per the class sidecar)"
        - q: "What at tunable x 100?"
          a: "Same failure mode as N > tunable — DataBufferLimitException → 500. The codec rejects before the body is fully buffered; no partial parse."
          confidence: STATIC-INFERRED
          evidence: "application.yml:14-15"
        - q: "What does the operator see at each boundary?"
          a: "A 500 with no hint that body size was the cause. Not operator-load-bearing for this endpoint given the 3-field DTO."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:1317-1325 (3 short string fields)"
  name_behavior_pairs:
    - name: "update / updateDataSource"
      promise: "Modify an existing data source. The verb 'update' is ambiguous between REPLACE (overwrite the whole record) and MERGE (patch only the supplied fields)."
      implementation: "REPLACE. DataSourceServiceImpl.update (line 68-83) calls DataSourceMapper.applyToPojo (DataSourceMapper.java:49) — a MapStruct @MappingTarget method. MapperConfig (MapperConfig.java:7-11) sets componentModel/unmappedTargetPolicy/injectionStrategy but NO nullValuePropertyMappingStrategy; MapStruct's default for an unspecified strategy is SET_TO_NULL. DataSourceUpdateFormData has 3 optional fields with no `required` block (components.yaml:1317-1325); an omitted JSON field deserialises to a null Java field and is written as null onto the existing pojo. The namespace overload (DataSourceMapper.java:51-56) explicitly sets namespace_id to null when namespace==null (i.e. when namespace_name was empty)."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "An operator (or API consumer) sending a partial body to change one field silently nulls the other two — editing only `name` wipes `description` and detaches the `namespace`. The endpoint name 'update' does not signal that callers must resend every field."
      confidence: PROBE-NEEDED
      evidence: "P-043"
    - name: "applyToPojo"
      promise: "Apply the form to the pojo — name implies it layers the form's values onto the existing pojo."
      implementation: "It does layer the form onto the @MappingTarget pojo, but layers ALL mapped properties including nulls (see the update entry). The name 'apply' reads as additive; the behaviour is total-overwrite of the 3 mapped fields."
      drift: MINOR
      operator_visible_consequence: "Same as the update entry — the misleading half is the implicit 'only what is set' reading of 'apply'."
      confidence: PROBE-NEEDED
      evidence: "P-043"
  orderings: []
  auth_gates:
    - location: "SecurityConstants.java:118-120"
      endpoint: "PUT /api/datasources/{data_source_id}"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "LOGIN_FORM / OAUTH2 / LDAP: an authenticated principal is required, and the path-based ReactiveAuthorizationManager additionally requires the DATA_SOURCE_UPDATE permission (SecurityConstants.java:118-120 pairs the path with DATA_SOURCE_UPDATE). The three modes differ only in the authentication front-end; the RBAC evaluation for /api/datasources/** is identical. DISABLED: DisabledSecurityConfiguration sets all paths permitAll and binds no principal — the endpoint is fully open including this destructive edit."
          confidence: PROBE-NEEDED
          evidence: "P-044"
        - q: "What does an unauthenticated caller see?"
          a: "Under LOGIN_FORM/OAUTH2/LDAP: rejected at the SecurityWebFilterChain before the controller (401 / auth-mode-specific challenge). Under DISABLED: there is no authentication, so an unauthenticated caller reaches and succeeds the PUT."
          confidence: PROBE-NEEDED
          evidence: "P-044"
        - q: "What does a wrong-role caller see?"
          a: "A user authenticated but whose Policy does not grant DATA_SOURCE_UPDATE is rejected by the ReactiveAuthorizationManager with 403; the controller and service are never reached, the row is untouched."
          confidence: PROBE-NEEDED
          evidence: "P-044"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "Declaratively, in SecurityConstants.SECURITY_RULES (SecurityConstants.java:118-120), enforced by AuthorizationCustomizer's path-pattern ReactiveAuthorizationManager. NOT in the controller method (no @PreAuthorize), NOT in DataSourceServiceImpl.update, NOT in the repository. S2S X-API-Key (auth.s2s.enabled=true) grants ADMIN which satisfies the rule unconditionally."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:118-120 + DataSourceController.java:38-45 (no @PreAuthorize) + DataSourceServiceImpl.java:68-83 (no programmatic check)"
  resource_boundaries:
    - location: "DataSourceServiceImpl.java:69 (@ReactiveTransactional on update)"
      kind: transactional
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "Two concurrent PUTs to the same id each run getDto (no FOR UPDATE in the UI path — the ReactiveDataSourceRepositoryImpl sidecar confirms getIdByOddrnForUpdate's FOR UPDATE is ingestion-only), then UPDATE. The UI update is last-writer-wins: both transactions read the same baseline, both apply their full-form REPLACE, the later commit overwrites the earlier with no conflict detection (no optimistic-lock version column on data_source — V0_0_1__init.sql:38-50). No corruption, but a lost update: operator A's edit can vanish under operator B's concurrent edit."
          confidence: STATIC-INFERRED
          evidence: "DataSourceServiceImpl.java:71-82 + V0_0_1__init.sql:38-50 (no version column) + ReactiveDataSourceRepositoryImpl sidecar (no FOR UPDATE in the UI getDto path)"
        - q: "Is the call replay-safe?"
          a: "Yes for the row state — replaying the same PUT body produces the same final row (REPLACE is idempotent on identical input). NOT side-effect-free: updated_at advances on every replay, and the 2 FTS vector writes re-execute each time. No Activity Event is emitted, so replays leave no audit divergence."
          confidence: STATIC-INFERRED
          evidence: "DataSourceServiceImpl.java:79-80 + 127-136 (FTS writes) + ReactiveDataSourceRepositoryImpl sidecar (UPDATE ... SET ... updated_at = NOW())"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No cache fronts this endpoint — DataSourceServiceImpl has no @Cacheable, no manual cache write. The FTS vector is refreshed synchronously inside the transaction, so search-discoverability is consistent post-commit."
          confidence: STATIC-INFERRED
          evidence: "DataSourceServiceImpl.java entire file (no @Cacheable) + DataSourceServiceImpl.java:77,80,127-136"
  request_inputs:
    - location: "DataSourceController.java:39 (dataSourceId path variable)"
      input_kind: path-param
      input_name: "dataSourceId / {data_source_id}"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The numeric id of the data source to update."
          confidence: STATIC-INFERRED
          evidence: "DataSourceController.java:39 + openapi.yaml:469-474 (path param data_source_id, int64)"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Controller passes it to dataSourceService.update(dataSourceId, form) (DataSourceController.java:43) → DataSourceServiceImpl.update(long id, ...) (line 70) → dataSourceRepository.getDto(id) (line 71). getDto issues SELECT ... WHERE data_source.id = ? AND data_source.deleted_at IS NULL. The same id is the WHERE-clause id of the subsequent UPDATE."
          confidence: STATIC-INFERRED
          evidence: "DataSourceController.java:43 + DataSourceServiceImpl.java:70-71 + ReactiveDataSourceRepositoryImpl sidecar (getDto SELECT)"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — the id selects the data_source row by primary key, exactly as the name promises."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "DataSourceServiceImpl.java:70-71"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — no translation."
          confidence: STATIC-INFERRED
          evidence: "DataSourceServiceImpl.java:70-71"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE — data_source.id is the matching column and it IS used."
          confidence: STATIC-INFERRED
          evidence: "DataSourceServiceImpl.java:71"
      routes_to_finding: "N/A — no drift"
    - location: "components.yaml:1322-1323 (DataSourceUpdateFormData.name)"
      input_kind: body-field
      input_name: "name"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The display name of the data source."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:1322-1323"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "applyToPojo (DataSourceMapper.java:49) maps form.name onto DataSourcePojo.name; dataSourceRepository.update writes data_source.name. When OMITTED, name deserialises to null and is written as null (MapStruct default SET_TO_NULL)."
          confidence: PROBE-NEEDED
          evidence: "P-043"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES on the column mapping (form.name → data_source.name). The non-obvious behaviour is the OMITTED case (REPLACE) — captured under name_behavior_pairs, not as an input-name drift."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "DataSourceMapper.java:49"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — name maps to the name column. (The omitted-field data loss is the name_behavior_pairs DRIFT_NAME_VS_BEHAVIOR finding.)"
          confidence: STATIC-INFERRED
          evidence: "DataSourceMapper.java:49"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "DataSourceMapper.java:49"
      routes_to_finding: "name_behavior_pairs (omitted-field REPLACE) routes to bugs_limitations_corner_cases.[0]"
    - location: "components.yaml:1320-1321 (DataSourceUpdateFormData.description)"
      input_kind: body-field
      input_name: "description"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The free-text description of the data source."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:1320-1321"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "applyToPojo maps form.description → DataSourcePojo.description → data_source.description column. Omitted → null (REPLACE)."
          confidence: PROBE-NEEDED
          evidence: "P-043"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES the column mapping."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "DataSourceMapper.java:49"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — no translation. The omitted-field nulling is the name_behavior_pairs finding."
          confidence: STATIC-INFERRED
          evidence: "DataSourceMapper.java:49"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "DataSourceMapper.java:49"
      routes_to_finding: "N/A — no input-name drift"
    - location: "components.yaml:1324-1325 (DataSourceUpdateFormData.namespace_name)"
      input_kind: body-field
      input_name: "namespace_name"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The name of the namespace to associate the data source with."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:1324-1325"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "If StringUtils.isNotEmpty(form.getNamespaceName()) (DataSourceServiceImpl.java:74), namespaceService.getOrCreate(namespace_name) resolves OR CREATES a NamespacePojo (line 75); applyToPojo's namespace overload (DataSourceMapper.java:51-56) stamps namespace_id from that pojo. If EMPTY/omitted, the namespace==null branch sets namespace_id to null (DataSourceMapper.java:55) — detaching any existing namespace."
          confidence: STATIC-INFERRED
          evidence: "DataSourceServiceImpl.java:74-79 + DataSourceMapper.java:51-56"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_LEGITIMATELY — the input is namespace_NAME (a string), but the persisted column is namespace_ID (an FK). The translation (name → get-or-create → id) is the documented platform pattern for namespace association and is identical to the registerDataSource path. The get-or-create CREATE side-effect (an operator with DATA_SOURCE_UPDATE but not NAMESPACE_CREATE can create a namespace) is the same permission-escalation-by-side-effect the class sidecar flagged for registerDataSource."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "DataSourceServiceImpl.java:74-76 (the name→pojo translation) + DataSourceMapper.java:55 (pojo→id)"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — the translation is legitimate and consistent with the create path. The operator-surprising behaviour is the OMITTED case (namespace detached) — recorded in bugs_limitations_corner_cases."
          confidence: STATIC-INFERRED
          evidence: "DataSourceServiceImpl.java:74-79"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "data_source has no namespace_name column — namespace_id is the only landing column (confirmed at the ReactiveDataSourceRepositoryImpl sidecar). The translation is structurally necessary, not a missed-column smell."
          confidence: STATIC-INFERRED
          evidence: "V0_0_1__init.sql:38-50 + V0_0_11 namespace_id FK (per ReactiveDataSourceRepositoryImpl sidecar)"
      routes_to_finding: "the omitted-namespace detach routes to bugs_limitations_corner_cases.[0]"
  probes_emitted:
    - probe_id: P-042
      question: "Does PUT to a never-existed / soft-deleted id return a clean 404 or a silent 200?"
      probe_path: "lineage/odd-platform/probes/P-042.yaml"
    - probe_id: P-043
      question: "Does a PUT omitting `description` null it (REPLACE) or preserve it (MERGE)?"
      probe_path: "lineage/odd-platform/probes/P-043.yaml"
    - probe_id: P-044
      question: "What does PUT /api/datasources/{id} return across the 4 auth scenarios (no-permission / with-permission / unauthenticated / DISABLED)?"
      probe_path: "lineage/odd-platform/probes/P-044.yaml"
  stress_summary:
    triggers_total: 9
    questions_total: 25
    answers_static_inferred: 17
    answers_probe_needed: 8
    answers_reference: 0
    drift_flags: 2
```

## security

- auth_mode_relevance: LOGIN_FORM | OAUTH2 | LDAP | DISABLED
  notes: |
    LOGIN_FORM / OAUTH2 / LDAP authenticate the caller and the path-based RBAC
    then requires DATA_SOURCE_UPDATE. DISABLED makes the endpoint fully open
    (DisabledSecurityConfiguration permitAll; no principal). S2S (orthogonal,
    auth.s2s.enabled=true) grants ADMIN to any X-API-Key holder, satisfying
    DATA_SOURCE_UPDATE unconditionally.
- ingestion_filter_relevance: "NO — /api/datasources/{id} is the UI admin surface; the IngestionDataSourceFilter applies only to /ingestion/* paths."
- authorization_assertions:
  - "PUT /api/datasources/{data_source_id} requires DATA_SOURCE_UPDATE — evidence: SecurityConstants.java:118-120 (`new SecurityRule(NO_CONTEXT, new PathPatternParserServerWebExchangeMatcher(\"/api/datasources/{data_source_id}\", PUT), DATA_SOURCE_UPDATE)`)"
  - "No @PreAuthorize and no programmatic check on the handler or in DataSourceServiceImpl.update — the gate is 100% declarative — evidence: DataSourceController.java:38-45 + DataSourceServiceImpl.java:68-83"
- owner_scoping: "N/A — data_source rows are not owner-scoped; the endpoint updates by id with no current-user-owner predicate at any layer (consistent with the platform read-collaborative posture; DATA_SOURCE_UPDATE is a MANAGEMENT-tier permission, not entity-scoped)."
- data_exposure:
  - "Response body returns the updated DataSource (id, name, oddrn, description, namespace, token) to the caller — the token slot flows through DataSourceMapper.mapDto. Per the class sidecar, the token plaintext-vs-redaction question is UI-side; this endpoint does not rotate the token, it echoes whatever getDto's TokenDto carried."
- known_security_gaps:
  - "DISABLED auth.type makes this destructive edit endpoint fully open — a misconfigured production deployment left on DISABLED lets any caller rename/blank any data source" — evidence: cross-link REFACTOR-185 (DISABLED-mode bypass cluster) + SecurityConstants.java:118-120 — severity: HIGH under DISABLED in production
  - "namespace_name get-or-create side-effect: an operator with DATA_SOURCE_UPDATE but NOT NAMESPACE_CREATE can create a namespace by editing a data source with a previously-unknown namespace_name — same permission-escalation-by-side-effect the class sidecar flagged for registerDataSource" — evidence: DataSourceServiceImpl.java:74-76 — severity: LOW-MEDIUM
  - "No Activity Event on the UPDATE — a malicious or mistaken edit (e.g. renaming a source to impersonate another) leaves no audit trail in the Activity Feed" — evidence: DataSourceServiceImpl.java entire file (no activity emitter) — severity: MEDIUM

## performance

- hot_paths:
  - "updateDataSource (DataSourceController.java:38-45 → DataSourceServiceImpl.java:68-83): worst case 4 sequential DB calls inside the @ReactiveTransactional boundary — getDto (1 SELECT with 2 LEFT JOINs), namespaceService.getOrCreate (1 SELECT + conditional 1 INSERT), the UPDATE, then 2 FTS vector writes. With no namespace change: getDto + UPDATE + 2 FTS writes. Not a high-frequency endpoint (operator-initiated edits)."
- throughput_characteristics:
  - "single-row PER REQUEST — no bulk-update surface on the UI side"
  - "reactive Mono — non-blocking but per-call DB round-trip"
- resource_allocation:
  - "1 R2DBC connection held for the @ReactiveTransactional service-method duration"
  - "small per-handler memory — the 3-field DataSourceUpdateFormData and the DataSource response are KB-sized"
  - "spring.codec.max-in-memory-size: 20MB cap on body deserialization (not a realistic limit for a 3-string-field DTO)"
- scaling_characteristics:
  - "stateless handler — instances scale horizontally"
  - "no FOR UPDATE row lock in the UI update path (distinct from the ingestion path's getIdByOddrnForUpdate) — concurrent edits to the same id are last-writer-wins with no conflict detection (lost-update window — see stress_findings.resource_boundaries)"
- known_performance_gaps:
  - "no optimistic-lock version column on data_source — concurrent operator edits silently lose the earlier write; not a throughput gap, a correctness-under-concurrency gap" — evidence: V0_0_1__init.sql:38-50 (no version column) + DataSourceServiceImpl.java:71-82 — severity: LOW

## upstream_callers

- entry_point: "ui_route:/management/datasources (Datasources tab edit affordance)"
  caller_node: "odd-platform-ui — the React/TypeScript SPA edit form invokes the generated DataSourceApi.updateDataSource client against PUT /api/datasources/{id}"
  multiplicity_per_trigger: 1
  evidence: "DataSourceController.java:38-45 (the @Override of DataSourceApi.updateDataSource); the class sidecar's upstream_callers block records the UI client wiring (datasources.thunks.ts + lib/hooks/api/datasource.ts + lib/api.ts)"
  observation_class: ui-call
  unresolved: true   # the UI thunk node is not yet enriched; the class sidecar holds the verified client-file list

- entry_point: "rest:PUT /api/datasources/{data_source_id}"
  caller_node: "any odd-api-consumer authenticated as a UI user (LOGIN_FORM/OAUTH2/LDAP) OR via S2S X-API-Key"
  multiplicity_per_trigger: 1
  evidence: "openapi.yaml:463-489 (the operation is part of the public OpenAPI contract); SecurityConstants.java:118-120 (DATA_SOURCE_UPDATE gate)"
  observation_class: rest-call

## downstream_side_effects

- side_effect_class: db-write
  description: "UPDATE data_source SET name/description/namespace_id (+ updated_at = NOW()) WHERE id = ? — full-form REPLACE of the 3 mutable fields on one row"
  evidence: "DataSourceServiceImpl.java:79-82 (updateDataSource private → dataSourceRepository.update) + DataSourceMapper.java:49-56 (applyToPojo)"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/management/datasources"
    - "rest:PUT /api/datasources/{data_source_id}"

- side_effect_class: db-write
  description: "Conditional INSERT INTO namespace — namespaceService.getOrCreate creates a new namespace row when namespace_name is non-empty and no matching namespace exists"
  evidence: "DataSourceServiceImpl.java:74-75 (the StringUtils.isNotEmpty branch + namespaceService.getOrCreate)"
  cardinality_per_call: "0 or 1 — 1 only when namespace_name is supplied AND the namespace does not already exist"
  reachable_from_entry_points:
    - "ui_route:/management/datasources"
    - "rest:PUT /api/datasources/{data_source_id}"

- side_effect_class: db-write
  description: "UPDATE search_entrypoint — refreshes the data_source FTS vector, and either updates the namespace FTS vector or clears it"
  evidence: "DataSourceServiceImpl.java:77,80,127-136 (updateSearchVectors: updateChangedDataSourceVector + updateChangedNamespaceVector | clearNamespaceVector)"
  cardinality_per_call: 2
  reachable_from_entry_points:
    - "ui_route:/management/datasources"
    - "rest:PUT /api/datasources/{data_source_id}"

- side_effect_class: page-render
  description: "Returns the updated DataSource payload (id, name, oddrn, description, namespace, token) to the caller with HTTP 200"
  evidence: "DataSourceController.java:44 (ResponseEntity::ok) + DataSourceServiceImpl.java:82 (.map(dataSourceMapper::mapDto))"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/management/datasources"
    - "rest:PUT /api/datasources/{data_source_id}"

- side_effect_class: db-write
  description: "NO Activity Event emitted — recorded as a downstream NON-effect: the data_source UPDATE leaves no Activity Feed trail"
  evidence: "DataSourceServiceImpl.java entire file — no activity emitter import (verified at the class sidecar)"
  cardinality_per_call: 0
  reachable_from_entry_points:
    - "ui_route:/management/datasources"
    - "rest:PUT /api/datasources/{data_source_id}"

## coherence_notes

- kind: refines
  target: "odd-platform java DataSourceController controller-class:DataSourceController"
  note: |
    REFINES the class sidecar's updateDataSource bullet. The class sidecar states
    the UI update path "applies ALL fields from DataSourceUpdateFormData (the
    FormData fields, whatever the contract declares — typically name, description,
    connectionUrl, etc.)". This method-level read of the contract
    (components.yaml:1317-1325) corrects that: DataSourceUpdateFormData has
    EXACTLY 3 fields — `name`, `description`, `namespace_name`. There is NO
    `connection_url` field and NO `oddrn` field on the update DTO. The
    `connection_url` column was dropped from data_source by V0_0_71 (per the
    ReactiveDataSourceRepositoryImpl sidecar), so the class sidecar's "connectionUrl"
    example is stale. The "full-form REPLACE" framing is correct; the field LIST
    is narrower than the class sidecar implied — and the REPLACE is over 3 fields,
    not an open-ended set.
- kind: strengthens
  target: "odd-platform java DataSourceController controller-class:DataSourceController"
  note: |
    STRENGTHENS the class sidecar's "UI full-form-replace vs S2S partial-merge"
    implicit ADR with the method-level mechanism. The class sidecar asserts the
    REPLACE without naming WHY a partial body replaces rather than merges. This
    sidecar supplies the mechanism: MapperConfig (MapperConfig.java:7-11) sets no
    nullValuePropertyMappingStrategy, so MapStruct's default SET_TO_NULL governs
    applyToPojo (DataSourceMapper.java:49) — an omitted (null) form field is
    written as null. The asymmetry with the S2S path's name+description narrowing
    is therefore a consequence of two different mapper shapes, exactly as the
    class sidecar's ADR-CANDIDATE-142 triangulation states.
- kind: strengthens
  target: "odd-platform java service service:DataEntityServiceImpl"
  note: |
    STRENGTHENS the catalog-wide silent-UPDATE-on-missing audit by adding a
    COUNTER-CASE. DataEntityServiceImpl.upsertDescription deliberately omits an
    existence guard and returns a silent HTTP 200 on a missing id (the F-004
    finding). DataSourceServiceImpl.update (DataSourceServiceImpl.java:71-72)
    DOES have the guard — `getDto(id).switchIfEmpty(Mono.error(new
    NotFoundException("Data source", id)))` — and returns a clean 404. The two
    endpoints sit on opposite sides of the same design choice; the
    DataEntityServiceImpl sidecar already notes createMetadata uses the guard
    and upsertDescription does not. updateDataSource is another guarded instance.

## sources

- understanding ← `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/DataSourceController.java:38-45` + `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataSourceServiceImpl.java:68-83`
- concepts.entities.DataSourceUpdateFormData ← `odd-platform-specification/components.yaml:1317-1325`
- concepts.operations ← DataSourceController.java:38-45 + DataSourceServiceImpl.java:68-83,108-114,127-136
- concepts.invariants ← DataSourceServiceImpl.java:68-83 + DataSourceMapper.java:49-56 + MapperConfig.java:7-11 + SecurityConstants.java:118-120
- concepts.audiences ← WebFetch 2026-05-21 of `https://docs.opendatadiscovery.org/features/management` (status 200)
- dependencies_semantic.requires-feature.DataSourceApi ← DataSourceController.java:4 + openapi.yaml:463-489
- dependencies_semantic.requires-feature.DataSourceService ← DataSourceServiceImpl.java:68-83
- dependencies_semantic.requires-feature.DataSourceMapper ← DataSourceMapper.java:49-56
- dependencies_semantic.requires-runtime.ReactiveTransactional ← `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/annotation/ReactiveTransactional.java:9-12`
- tests_coverage_semantic ← Glob for DataSourceControllerTest / DataSourceServiceImplTest returned no files (verified at the class sidecar)
- docs_link_semantic.inferred_docs[0] ← WebFetch 2026-05-21 of `https://docs.opendatadiscovery.org/features/management` (status 200)
- implicit_adrs[0] (full-form REPLACE) ← DataSourceMapper.java:49-56 + MapperConfig.java:7-11
- implicit_adrs[1] (404 fail-fast) ← DataSourceServiceImpl.java:71-72
- bugs_limitations_corner_cases (each) ← cited inline via evidence: tags
- stress_findings.tunables ← application.yml:14-15 (spring.codec.max-in-memory-size — referenced from the class sidecar's requires-config)
- stress_findings.name_behavior_pairs ← DataSourceMapper.java:49-56 + MapperConfig.java:7-11 + components.yaml:1317-1325 + probe P-043
- stress_findings.auth_gates ← SecurityConstants.java:118-120 + DataSourceController.java:38-45 + DataSourceServiceImpl.java:68-83 + probe P-044
- stress_findings.resource_boundaries ← DataSourceServiceImpl.java:69-82,127-136 + V0_0_1__init.sql:38-50
- stress_findings.request_inputs ← DataSourceController.java:39,43 + DataSourceServiceImpl.java:70-79 + DataSourceMapper.java:49-56 + components.yaml:1317-1325 + openapi.yaml:469-474
- security.authorization_assertions ← SecurityConstants.java:116-126 + DataSourceController.java:38-45 + DataSourceServiceImpl.java:68-83
- security.known_security_gaps ← cited inline via evidence: tags
- performance ← DataSourceController.java:38-45 + DataSourceServiceImpl.java:68-83,127-136 + V0_0_1__init.sql:38-50 + application.yml:14-15
- upstream_callers ← DataSourceController.java:38-45 + openapi.yaml:463-489 + SecurityConstants.java:118-120
- downstream_side_effects ← DataSourceServiceImpl.java:74-82,127-136 + DataSourceController.java:44
- coherence_notes ← the DataSourceController class sidecar + the DataEntityServiceImpl sidecar + the ReactiveDataSourceRepositoryImpl sidecar (all under lineage/odd-platform/understanding/)

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (the absence of tests is verified at the class sidecar)
- docs_link_semantic: HIGH (the management page was WebFetched live this session, status 200)
- implicit_adrs: HIGH (the 404 ADR is HIGH; the REPLACE ADR rests on MapStruct's documented default and is pinned by P-043)
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH
- upstream_callers: MEDIUM (the UI caller node is recorded as an unresolved reference — the class sidecar holds the verified client-file list)
- downstream_side_effects: HIGH
- stress_findings: MEDIUM (8 of 25 questions resolve to PROBE-NEEDED across P-042/P-043/P-044; the load-bearing 404 and concurrency questions are STATIC-INFERRED with strong evidence, but the REPLACE-vs-MERGE and auth-matrix claims await probe verification)

## Maintainer notes

(empty — no prior sidecar existed at this path; this is the first enrichment of this node)

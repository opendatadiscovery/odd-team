---
node_id: "odd-platform java DataSourceController controller-method:deleteDataSource"
node_kind: controller-method
axis: controllers
extracted_at_commit: 80637ed
enriched_at_commit: 80637ed
extractor_version: 0.1.0
prompt_version: file-analyser/0.5.0
enrichment_status: complete
confidence_overall: MEDIUM
session_id: session-2026-05-21-batch-ZB-deleteDataSource
---

# DataSourceController.deleteDataSource — semantic understanding

## understanding

`deleteDataSource` is the `DELETE /api/datasources/{data_source_id}` endpoint
handler — a 4-line proxy (`DataSourceController.java:47-51`) that delegates to
`dataSourceService.delete(id)` and maps the result to `204 No Content`. Despite
the name "delete", the operation is a **soft-delete that BLOCKS on live child
data entities**: the service (`DataSourceServiceImpl.java:85-96`,
`@ReactiveTransactional`) first calls `dataEntityRepository
.existsNonDeletedByDataSourceId(id)` and, if any non-soft-deleted `data_entity`
references the data source, throws `CascadeDeleteException` → HTTP 400 — the
data source is NOT deleted. If no live children exist, `dataSourceRepository
.delete(id)` runs `UPDATE data_source SET deleted_at = NOW() WHERE id = ? AND
deleted_at IS NULL` (`ReactiveAbstractSoftDeleteCRUDRepository.java:50-58` +
`106-110`). The delete does NOT cascade and does NOT clean up adjacent rows:
the `token` row the data source pointed to is left orphaned (the `token` table
has no `deleted_at` column — `V0_0_28__add_token.sql:1-9` — and no code path
deletes it), the FTS `search_entrypoint` vector is not cleared (unlike the
`update` path), and any historical soft-deleted `data_entity` children remain
attached by FK to a now-soft-deleted parent. Authorization is the declarative
`DATA_SOURCE_DELETE` MANAGEMENT permission (`SecurityConstants.java:121-123`),
not a `@PreAuthorize` on the method.

## concepts

- entities:
  - "DataSourceApi (OpenAPI-generated interface — declares the `deleteDataSource(Long, ServerWebExchange)` signature this method @Overrides; the `DELETE /api/datasources/{data_source_id}` path mapping lives there, not on this method)"
  - "data_source (the table row soft-deleted by `deleted_at = NOW()`)"
  - "data_entity (child rows whose `data_source_id` FK references the data source — their existence GATES the delete)"
  - "token (the row `data_source.token_id` FK-references — left orphaned by the delete)"
  - "CascadeDeleteException (the service-thrown exception → HTTP 400 via ControllerAdvice)"
  - "Mono<ResponseEntity<Void>> (the reactive response shape — line 48; body is empty, status 204)"
- operations:
  - "delete (lines 47-51): DELETE /api/datasources/{data_source_id} — guarded soft-delete; 204 on success, 400 if live data_entity children exist"
  - "delegate-to-service: extract `dataSourceId` → `dataSourceService.delete(id)` → `.then(Mono.just(ResponseEntity.noContent().build()))`"
- invariants:
  - "The method @Overrides `DataSourceApi` (DataSourceController.java:18) — no `@DeleteMapping` on the method; path + verb are contract-driven from the OpenAPI spec."
  - "The delete is a SOFT-delete: it sets `data_source.deleted_at = NOW()`. There is NO `DELETE FROM data_source` anywhere in the source tree (confirmed by the ReactiveDataSourceRepositoryImpl sidecar's Grep)."
  - "The delete is GUARDED: it succeeds only when NO non-soft-deleted `data_entity` references the data source (`DataSourceServiceImpl.java:88-95`). A live child entity → HTTP 400, no mutation."
  - "The delete does NOT cascade to children: `data_entity_fk_data_source` (V0_0_1__init.sql:82) has NO `ON DELETE` clause — Postgres default is NO ACTION. Soft-deleting the parent leaves child `data_entity` rows' `data_source_id` pointing at the soft-deleted parent."
  - "The handler holds NO programmatic auth check — authorization is the declarative `DATA_SOURCE_DELETE` SecurityRule (`SecurityConstants.java:121-123`)."
- audiences:
  - "platform-operator (the Datasources tab's per-card delete affordance — per the live doc page WebFetched 2026-05-21 status 200, verbatim 'remove a source no longer ingested')"
  - "odd-api-consumer (programmatic clients with a UI session granting DATA_SOURCE_DELETE, or an S2S X-API-Key which grants ADMIN)"

## dependencies_semantic

- requires-feature:
  - "`DataSourceService.delete(long)` (interface DataSourceService.java; impl `DataSourceServiceImpl.java:85-96`) — owns the cascade-guard + soft-delete orchestration. The controller is a pure proxy."
  - "`ReactiveDataEntityRepository.existsNonDeletedByDataSourceId(long)` (`ReactiveDataEntityRepositoryImpl.java:158-163`) — `SELECT EXISTS(SELECT 1 FROM data_entity WHERE data_source_id = ? AND deleted_at IS NULL)`. The cascade-guard primitive."
  - "`ReactiveDataSourceRepository.delete(long)` — inherited soft-delete from `ReactiveAbstractSoftDeleteCRUDRepository.java:50-58`; `getDeleteChangedFields` (lines 106-110) sets only `deleted_at`."
  - "`SecurityConstants.SECURITY_RULES` entry for `DELETE /api/datasources/{data_source_id}` (`SecurityConstants.java:121-123`) bound to `DATA_SOURCE_DELETE` (`PolicyPermissionDto.DATA_SOURCE_DELETE`, a MANAGEMENT-tier permission)."
  - "`ControllerAdvice` — maps `CascadeDeleteException` → 400 (per the class sidecar, ControllerAdvice.java:42-46) and `NotFoundException`-class to 404."
- requires-config:
  - "`auth.type` (DISABLED / LOGIN_FORM / OAUTH2 / LDAP) — gates whether the request reaches the controller. Under DISABLED the platform's documented stance opens all paths (per the class sidecar's `auth.type` analysis); under the three real modes the user must be authenticated AND the bound policy must grant DATA_SOURCE_DELETE."
  - "`auth.s2s.enabled` (default false) — when true, an X-API-Key caller is granted ADMIN, which satisfies DATA_SOURCE_DELETE regardless of per-user policy."
- requires-runtime:
  - "Spring WebFlux + Reactor — the handler returns `Mono<ResponseEntity<Void>>`."
  - "`@ReactiveTransactional` on `DataSourceServiceImpl.delete` (line 86) — the existence-check and the soft-delete UPDATE run in one R2DBC transaction; a failure rolls both back."
  - "PostgreSQL — the `data_source`, `data_entity`, `token` tables and the `data_source_oddrn_unique`/`data_source_name_unique` partial indexes."
- coupling:
  - "The cascade-guard is a SERVICE-tier business rule, not a schema constraint. `data_entity_fk_data_source` has no `ON DELETE` clause, so the SQL layer would not block (or cascade) a hard delete — the application enforces the contract via `existsNonDeletedByDataSourceId`. A service-bypassing caller invoking `dataSourceRepository.delete(id)` directly skips the guard."
  - "The delete is the ONLY data-source mutation that touches NO FTS vector. `create` relies on entity-side FTS rebuild, `update` calls `updateSearchVectors` explicitly (DataSourceServiceImpl.java:127-136), `delete` calls neither — the soft-deleted data source's `search_entrypoint` row is not cleared by this path (see bugs / P-048)."

## tests_coverage_semantic

- covered_behaviours:
  - behaviour: "ZERO direct coverage. There is no `DataSourceControllerTest`, no `DataSourceServiceImplTest`, no `DataSourceServiceTest` (verified by the DataSourceController class sidecar's Glob sweep — all returned 'No files found'). The `delete` endpoint and `DataSourceServiceImpl.delete` are entirely uncovered."
    test_class: integration
    test_files: []
- uncovered_behaviours:
  - behaviour: "Happy-path delete: `DELETE /api/datasources/{id}` for a data source with NO data_entity children returns 204 and writes `data_source.deleted_at = NOW()`."
    test_class: integration
    criticality: HIGH
    note: "Priority-1 data-loss node; the soft-delete write must be pinned."
  - behaviour: "Cascade-block: `DELETE /api/datasources/{id}` for a data source with at least one non-soft-deleted data_entity returns 400 with `CascadeDeleteException` ('there are still data entities attached') and performs NO mutation (data_source.deleted_at stays null)."
    test_class: integration
    criticality: HIGH
    note: "The load-bearing guard. Pinned by P-047."
  - behaviour: "Cascade-allow after children soft-deleted: once all child data_entity rows have `deleted_at` set, the next delete returns 204."
    test_class: integration
    criticality: HIGH
    note: "Pinned by P-047."
  - behaviour: "Orphan-token: after a successful delete, the `token` row referenced by the (now soft-deleted) data_source still exists, unreferenced by any live data_source."
    test_class: integration
    criticality: MEDIUM
    note: "Pinned by P-046. Unbounded growth over register/delete cycles."
  - behaviour: "FTS not cleared: after a successful delete, the `search_entrypoint` vector row for the data source is not removed (delete calls no searchEntrypointRepository method)."
    test_class: integration
    criticality: MEDIUM
    note: "Pinned by P-048. Whether the soft-deleted source still appears in catalog search depends on the search query's deleted_at predicate."
  - behaviour: "Delete of a non-existent id: `DELETE /api/datasources/999999` — `existsNonDeletedByDataSourceId` returns false, `dataSourceRepository.delete(999999)` runs `UPDATE ... WHERE id=999999 AND deleted_at IS NULL` matching 0 rows; the response shape for a no-row-matched delete is not statically determinable (see stress_findings auth_gates / P-049)."
    test_class: integration
    criticality: MEDIUM
    note: "204 vs 404 vs 500 — runtime behaviour."
  - behaviour: "RBAC enforcement: a caller WITHOUT DATA_SOURCE_DELETE permission gets 403 (or the AuthorizationManager's configured response); the SecurityRule fires before the controller."
    test_class: security
    criticality: HIGH
    note: "32-cell RBAC × auth-mode matrix is uncovered (per the class sidecar)."
  - behaviour: "Concurrent delete vs collector re-ingest: an operator soft-deletes child entities then deletes the source while a collector concurrently re-ingests entities for the same ODDRN — the re-ingest re-creates live data_entity rows, making the next delete 400 again."
    test_class: integration
    criticality: MEDIUM
    note: "Dynamic race; P-047 establishes the static precondition only."
- test_files:
  - "NO `DataSourceControllerTest.*` exists (verified by the class sidecar's Glob)"
  - "NO `DataSourceServiceImplTest.*` exists (verified)"
- gaps: |
    The endpoint has ZERO direct coverage. The highest-leverage gap is an
    integration test of the cascade-guard: create a data source, attach a
    live data_entity, assert DELETE → 400; soft-delete the entity, assert
    DELETE → 204; then assert (a) the data_source row carries deleted_at,
    (b) the token row is orphaned (still present), (c) the search_entrypoint
    vector is uncleared. That single test pins the data-loss surface of the
    batch. The worst-covered test_class is `security` — the DATA_SOURCE_DELETE
    permission gate has no test, and there is no precedent in the repo for a
    parametrized auth-mode security test on a controller.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/management"
    anchor: ""
    rationale: "The canonical doc page for the Datasources management tab — the UI surface whose per-card delete affordance maps to this endpoint. WebFetched this session; it mentions delete only as a one-liner workflow with no operational detail."
    last_verified_at: "2026-05-21T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      WebFetched 2026-05-21 (status 200). The page's ONLY mention of deletion
      is the workflow phrase, verbatim: "remove a source no longer ingested".
      The WebFetch summary, probed specifically on delete consequences:
      "this documentation says nothing substantive about deleting or removing
      a data source" — it does NOT address (1) what happens to ingested data
      entities / lineage on delete, (2) any precondition or block on deletion,
      (3) Collector token cleanup or invalidation on delete.
- doc_drift_findings:
  - "The Management page (WebFetched 2026-05-21, status 200) describes deleting a data source only as 'remove a source no longer ingested' and documents NONE of the operationally load-bearing facts: (a) the delete is BLOCKED with HTTP 400 if the data source still has live data_entity children — an operator clicking Delete on an actively-ingested source gets an error, not a deletion, and the doc gives no hint of the precondition; (b) the delete is a SOFT-delete (`deleted_at`), not a hard delete — the row, its token, and its entities persist in the database; (c) the Collector token row is NOT cleaned up — it is orphaned; (d) historical data_entity rows remain FK-attached to the soft-deleted parent. All four are documented-feature gaps; (a) is the most operator-surprising and is the priority finding."
  - "Symmetric to the class sidecar's finding: the API Reference hub explicitly omits a Data Sources sub-page (per the class sidecar's WebFetch 2026-05-20), so an operator wanting to script datasource deletion has no doc describing the DELETE endpoint's 400-on-attached-entities behaviour."

## implicit_adrs

- "The delete is a GUARDED soft-delete enforced at the SERVICE tier, not the schema tier — the decision is to block deletion of a data source that still has live child entities rather than cascade-delete them. The intent is visible in the exception MESSAGE, which frames the constraint explicitly. — evidence: DataSourceServiceImpl.java:88-95 — intent_anchor: \"Mono.error(new CascadeDeleteException(\\\"Data source cannot be deleted: there are still data entities attached\\\"))\" — confidence: HIGH"
- "Soft-delete (not hard-delete) is the platform-wide convention for the data_source table — the delete inherits `ReactiveAbstractSoftDeleteCRUDRepository.delete`, which structurally rewrites `delete` into a `deleted_at = NOW()` UPDATE. The intent is the consistent inheritance of the soft-delete base across the repository layer (the ReactiveDataSourceRepositoryImpl sidecar catalogs `three-soft-delete-mechanisms-across-the-repository-layer`). — evidence: ReactiveAbstractSoftDeleteCRUDRepository.java:50-58 + getDeleteChangedFields:106-110 — intent_anchor: \"updatedFieldsMap.put(deletedAtField, DateTimeUtil.generateNow())\" — confidence: HIGH"

## bugs_limitations_corner_cases

- "**The `token` row is orphaned on every data source delete.** `data_source.token_id` is a FK to the `token` table (`V0_0_28__add_token.sql:13`). The soft-delete sets only `data_source.deleted_at` (`ReactiveAbstractSoftDeleteCRUDRepository.java:106-110`); it never deletes the `token` row, and the `token` table has NO `deleted_at` column (`V0_0_28__add_token.sql:1-9`) so it cannot even be soft-deleted. No code path GCs orphan tokens (no scheduled job, no Flyway migration found by Grep). Each register-then-delete cycle leaks one `token` row. This is the SAME orphan-token pattern batch W confirmed for Collector delete. Severity: MEDIUM (unbounded table growth; the orphan plaintext token is also a stale-secret-at-rest surface). Pinned by P-046." — evidence: DataSourceServiceImpl.java:85-96 + ReactiveAbstractSoftDeleteCRUDRepository.java:106-110 + V0_0_28__add_token.sql:1-13 — severity: MEDIUM
- "**An actively-ingested data source is effectively undeletable.** The delete is blocked (HTTP 400) by `existsNonDeletedByDataSourceId` whenever a live `data_entity` child exists (`DataSourceServiceImpl.java:88-95`). `data_entity` rows are created by the collector and re-created on its next ingest tick. An operator who soft-deletes all entities and then deletes the source races the collector: if the collector re-ingests between the two steps, the next delete 400s again. The only reliable delete path is to stop the collector first — and the doc page does not mention this. Severity: MEDIUM (operational dead-end with no documented workaround). Pinned by P-047." — evidence: DataSourceServiceImpl.java:88-95 + ReactiveDataEntityRepositoryImpl.java:158-163 — severity: MEDIUM
- "**The FTS `search_entrypoint` vector is not cleared on delete.** `DataSourceServiceImpl.delete` (lines 85-96) calls no `searchEntrypointRepository` method — unlike `update` (lines 127-136). Whether a soft-deleted data source still appears in catalog search depends entirely on whether the search query JOINs `data_source` with a `deleted_at IS NULL` predicate; if it does not, the soft-deleted source remains searchable. Severity: MEDIUM (potential stale search result). Pinned by P-048." — evidence: DataSourceServiceImpl.java:85-96 (no FTS call) vs DataSourceServiceImpl.java:127-136 (update DOES refresh FTS) — severity: MEDIUM
- "**Historical data_entity children remain FK-attached to a soft-deleted parent.** `data_entity_fk_data_source` (`V0_0_1__init.sql:82`) has NO `ON DELETE` clause. Once the operator soft-deletes the child entities (the prerequisite for the source delete to succeed) and then deletes the source, those soft-deleted `data_entity` rows still carry `data_source_id` pointing at the soft-deleted `data_source`. No row is cleaned; the catalog accumulates soft-deleted-parent / soft-deleted-child clusters. Severity: LOW (soft-deleted rows are invisible to reads; the structural orphaning is a long-term schema-hygiene concern, not an active bug)." — evidence: V0_0_1__init.sql:82 + ReactiveAbstractSoftDeleteCRUDRepository.java:106-110 — severity: LOW
- "**No Activity Event on data source delete.** `DataSourceServiceImpl` emits no Activity Event for any mutation (verified in the class sidecar — the class imports no ActivityEvent). An operator auditing 'who deleted which data source and when' has no audit trail; the only signal is the row's `deleted_at` timestamp, which carries no actor. Severity: MEDIUM (audit gap; consistent with the `audit-log-presence-asymmetry-2-tier-audit-story` concept the class sidecar references)." — evidence: DataSourceServiceImpl.java:85-96 (no activityEventEmitter) — severity: MEDIUM
- "**Delete of a non-existent / already-deleted id has statically-undetermined response semantics.** `existsNonDeletedByDataSourceId(999999)` returns false; `dataSourceRepository.delete(999999)` runs an `UPDATE ... WHERE id=? AND deleted_at IS NULL` matching 0 rows, then `.map(DataSourcePojo::getId)`. Whether the empty `Mono` yields 204, 404, or NPE/500 is runtime behaviour. Severity: LOW. Pinned by P-049." — evidence: DataSourceServiceImpl.java:87-95 + ReactiveAbstractSoftDeleteCRUDRepository.java:50-58 — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables: []   # no numeric literals, no @Value, no constants in the delete path; the 4-line handler and the service.delete method carry no tunables
  name_behavior_pairs:
    - name: "deleteDataSource / DataSourceService.delete"
      promise: "Delete the data source — remove it and its catalog footprint."
      implementation: "Soft-delete only: if NO non-soft-deleted data_entity child exists, runs `UPDATE data_source SET deleted_at = NOW()` (ReactiveAbstractSoftDeleteCRUDRepository.java:50-58). If a live child exists, throws CascadeDeleteException → HTTP 400, NO mutation. The row, its token, its FTS vector, and its soft-deleted children all persist in the database; nothing is hard-removed."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "An operator clicking 'Delete' on an actively-ingested data source gets HTTP 400 ('there are still data entities attached'), not a deletion — and even a successful delete leaves the token row, the FTS vector, and the historical entities in the database."
      confidence: STATIC-INFERRED
      evidence: "DataSourceController.java:47-51 + DataSourceServiceImpl.java:85-96 + ReactiveAbstractSoftDeleteCRUDRepository.java:50-58,106-110"
  orderings: []   # delete returns Mono<Void>; no ORDER BY, no LIMIT, no pagination, no sort
  auth_gates:
    - location: "SecurityConstants.java:121-123"
      endpoint: "DELETE /api/datasources/{data_source_id}"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "The SecurityRule binds the DELETE path to DATA_SOURCE_DELETE (a MANAGEMENT permission). Under LOGIN_FORM/OAUTH2/LDAP, a caller whose bound policy grants DATA_SOURCE_DELETE reaches the handler; one without it is rejected by the ReactiveAuthorizationManager before the controller. Under DISABLED, the class sidecar's auth.type analysis states the platform's documented stance opens all paths — the delete would execute without a permission check. The exact rejection status (401 vs 403) and the DISABLED-mode all-open behaviour are not statically pinnable from this method's scope."
          confidence: REFERENCE
          evidence: "odd-platform java DataSourceController controller-class:DataSourceController (requires-config auth.type block)"
        - q: "What does an unauthenticated caller see?"
          a: "Under LOGIN_FORM/OAUTH2/LDAP, `/api/datasources` is NOT in SecurityConstants.WHITELIST_PATHS (per the class sidecar) — the request falls under `pathMatchers(\"/**\").authenticated()` and is rejected before the controller. Under DISABLED, per the class sidecar, the path is open."
          confidence: REFERENCE
          evidence: "odd-platform java DataSourceController controller-class:DataSourceController (upstream_callers + requires-config)"
        - q: "What does a wrong-role caller see?"
          a: "A caller authenticated but lacking DATA_SOURCE_DELETE is rejected by the declarative SecurityRule's ReactiveAuthorizationManager. The exact status code returned by the AuthorizationManager is not determinable from this method; it is an integration concern."
          confidence: PROBE-NEEDED
          evidence: "P-049"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "The auth gate lives in the declarative SecurityConstants.SECURITY_RULES table (line 121-123), enforced by AuthorizationCustomizer's ReactiveAuthorizationManager BEFORE the controller method runs. There is NO @PreAuthorize on the method and NO programmatic permission check in DataSourceServiceImpl.delete. A service-bypassing caller would skip the gate entirely."
          confidence: STATIC-INFERRED
          evidence: "DataSourceController.java:47-51 (no annotation) + SecurityConstants.java:121-123 + DataSourceServiceImpl.java:85-96 (no programmatic check)"
  resource_boundaries:
    - location: "DataSourceServiceImpl.java:86 (@ReactiveTransactional on delete)"
      kind: transactional
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "Two concurrent deletes of the SAME id: each runs `existsNonDeletedByDataSourceId` then `UPDATE ... WHERE id=? AND deleted_at IS NULL`. The `deleted_at IS NULL` predicate makes the UPDATE idempotent — the second commit matches 0 rows. No corruption. The cascade-guard is the race-prone surface: a delete and a concurrent collector ingest of the same ODDRN can interleave so the exists-check passes (no live children at check time) but a child entity is inserted before the soft-delete UPDATE commits — the result is a soft-deleted data_source with a live child. The `delete` method does NOT acquire the `getIdByOddrnForUpdate` row lock that the ingestion path uses, so it does not serialise against concurrent ingestion."
          confidence: STATIC-INFERRED
          evidence: "DataSourceServiceImpl.java:87-95 + ReactiveAbstractSoftDeleteCRUDRepository.java:50-58 + ReactiveDataSourceRepositoryImpl getIdByOddrnForUpdate (per repo sidecar — NOT called by delete)"
        - q: "Is the call replay-safe?"
          a: "Yes for the data_source row — the `deleted_at IS NULL` guard makes a repeated delete a no-op (0 rows updated). NOT replay-safe for side-effect accounting: the orphan token row is created once at registration and never cleaned, so replaying delete does not multiply tokens — but it also never removes the one orphan. The operation has no idempotency key; identity is the path id."
          confidence: STATIC-INFERRED
          evidence: "ReactiveAbstractSoftDeleteCRUDRepository.java:50-58 (idCondition + deleted_at IS NULL)"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No cache fronts the delete path — `DataSourceServiceImpl.delete` reads and writes Postgres directly with no @Cacheable. The FTS `search_entrypoint` is the stale-surface, but it is a table not a cache; the delete leaves it uncleared (see bugs / P-048)."
          confidence: STATIC-INFERRED
          evidence: "DataSourceServiceImpl.java:85-96 (no @Cacheable, no cache write)"
    - location: "DataSourceServiceImpl.java:91 (dataSourceRepository.delete inside the transaction)"
      kind: cascade
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "See above — the cascade-guard / concurrent-ingest interleave can leave a soft-deleted data_source with a live data_entity child. Whether that materialises depends on transaction-isolation-level timing not determinable from the code."
          confidence: PROBE-NEEDED
          evidence: "P-047"
        - q: "Is the call replay-safe?"
          a: "The cascade dimension is replay-safe in the trivial sense (a second delete on an already-soft-deleted source is a no-op) but the cascade is INCOMPLETE: the token row, the FTS vector, and historical child entities are never cleaned, so the database state after delete is not 'the data source and its footprint removed'."
          confidence: STATIC-INFERRED
          evidence: "DataSourceServiceImpl.java:85-96 + V0_0_28__add_token.sql:1-13 + V0_0_1__init.sql:82"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "N/A — no cache; the cascade question is about table rows, covered by P-046 (token) and P-048 (FTS)."
          confidence: STATIC-INFERRED
          evidence: "DataSourceServiceImpl.java:85-96"
  request_inputs:
    - location: "DataSourceController.java:48"
      input_kind: path-param
      input_name: "dataSourceId"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The numeric primary-key id of the data_source row to delete — `data_source.id`. The name is specific and names the data_source entity."
          confidence: STATIC-INFERRED
          evidence: "DataSourceController.java:48"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Controller passes it as `id` to `dataSourceService.delete(id)` (DataSourceController.java:49) → `DataSourceServiceImpl.delete(long id)` (line 87) uses it twice: (1) `dataEntityRepository.existsNonDeletedByDataSourceId(id)` → `WHERE DATA_ENTITY.DATA_SOURCE_ID = id` (ReactiveDataEntityRepositoryImpl.java:158-160); (2) `dataSourceRepository.delete(id)` → `UPDATE data_source SET deleted_at=NOW() WHERE id=id AND deleted_at IS NULL` (ReactiveAbstractSoftDeleteCRUDRepository.java:50-58). Both bind the input to the `data_source` primary key / the `data_entity.data_source_id` FK — the entity the name promises."
          confidence: STATIC-INFERRED
          evidence: "DataSourceController.java:49 + DataSourceServiceImpl.java:87-95 + ReactiveDataEntityRepositoryImpl.java:158-160 + ReactiveAbstractSoftDeleteCRUDRepository.java:50-58"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — `dataSourceId` binds to `data_source.id` and the corresponding `data_entity.data_source_id` FK at every hop. No translation, no aliasing."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "DataSourceServiceImpl.java:87-95 + ReactiveAbstractSoftDeleteCRUDRepository.java:55 (idCondition)"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — the input MATCHES; no silent translation."
          confidence: STATIC-INFERRED
          evidence: "DataSourceServiceImpl.java:87-95"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE — the delete operates by id only; there is no unused name-aligned column."
          confidence: STATIC-INFERRED
          evidence: "DataSourceServiceImpl.java:85-96"
  probes_emitted:
    - probe_id: P-046
      question: "Does a successful data source delete orphan the token row (token table has no deleted_at; no code GCs it)?"
      probe_path: "lineage/odd-platform/probes/P-046.yaml"
    - probe_id: P-047
      question: "Does the delete BLOCK (HTTP 400) while a live data_entity child exists, and ALLOW (204) once all children are soft-deleted?"
      probe_path: "lineage/odd-platform/probes/P-047.yaml"
    - probe_id: P-048
      question: "Is the FTS search_entrypoint vector left uncleared after a successful delete (delete calls no searchEntrypointRepository method)?"
      probe_path: "lineage/odd-platform/probes/P-048.yaml"
  stress_summary:
    triggers_total: 5
    questions_total: 16
    answers_static_inferred: 11
    answers_probe_needed: 3
    answers_reference: 2
    drift_flags: 1
```

Note on P-049: the wrong-role auth status and the non-existent-id response shape
are both runtime-only. They are recorded as PROBE-NEEDED above; the probe id
P-049 is reserved for this node (range P-046..P-049) but a fourth probe skeleton
was not authored this pass because the two questions collapse into one small
integration probe (DELETE with no DATA_SOURCE_DELETE permission, and DELETE of a
non-existent id) that the probe-runner can compose from the P-047 scaffold. The
sidecar records P-049 as the allocated id so a refresh can write it without a
collision check.

## security

- auth_mode_relevance: LOGIN_FORM, OAUTH2, LDAP, S2S
  notes: |
    The endpoint is on the UI/API HTTP surface (`/api/datasources/{id}`),
    protected under the three real UI auth modes. Under DISABLED the class
    sidecar's analysis states the platform's documented stance opens all
    paths. S2S applies when `auth.s2s.enabled=true` — an X-API-Key caller is
    granted ADMIN, which satisfies DATA_SOURCE_DELETE regardless of any
    per-user policy.
- ingestion_filter_relevance: "NO — UI/API surface, not an `/ingestion/**` path; `IngestionDataSourceFilter` does not apply."
- authorization_assertions:
  - "`new SecurityRule(NO_CONTEXT, PathPatternParserServerWebExchangeMatcher(\"/api/datasources/{data_source_id}\", DELETE), DATA_SOURCE_DELETE)` — declarative, path-pattern-matched, enforced by AuthorizationCustomizer's ReactiveAuthorizationManager before the controller. — evidence: SecurityConstants.java:121-123"
  - "NO `@PreAuthorize` on the method and NO programmatic permission check in `DataSourceServiceImpl.delete` — the gate is 100% declarative. A service-tier caller bypassing the controller skips the gate. — evidence: DataSourceController.java:47-51 + DataSourceServiceImpl.java:85-96"
- owner_scoping: "N/A — code is not data-scoped. The delete operates by `data_source.id` with no owner filter; DATA_SOURCE_DELETE is a MANAGEMENT-tier (not entity-scoped) permission, so a holder can delete ANY data source, not only ones they own."
- data_exposure:
  - "Response body is empty (204 No Content) on success — leaks no data. On failure, the 400 CascadeDeleteException body carries the message 'Data source cannot be deleted: there are still data entities attached', which reveals that the named id exists and has children — a minor existence-disclosure to a caller already holding DATA_SOURCE_DELETE."
  - "The orphan `token` row left behind (P-046) is a stale plaintext secret at rest: a 40-char token value (`token.value varchar(40)`, V0_0_28__add_token.sql:4) persists in the `token` table unreferenced after the data source is deleted. A DB-level reader sees a credential that no longer maps to any live data source."
- known_security_gaps:
  - "Orphan plaintext token persists after delete — the deleted data source's token row is never removed (token table has no `deleted_at`, no GC path). Stale-secret-at-rest. — evidence: V0_0_28__add_token.sql:1-13 + ReactiveAbstractSoftDeleteCRUDRepository.java:106-110 — severity: MEDIUM"
  - "No audit trail of the delete — `DataSourceServiceImpl` emits no Activity Event; an operator cannot determine who deleted a data source. — evidence: DataSourceServiceImpl.java:85-96 (no activityEventEmitter) — severity: MEDIUM"
  - "MANAGEMENT-tier permission grants delete of ANY data source — DATA_SOURCE_DELETE is not entity-scoped; there is no per-owner restriction. A holder of the permission can delete every data source in the catalog. — evidence: SecurityConstants.java:121-123 + DataSourceServiceImpl.java:85-96 (no owner filter) — severity: LOW"

## performance

- hot_paths:
  - "Not a hot path — delete is an operator-initiated, low-frequency administrative action. Per call it issues two SQL statements: one `SELECT EXISTS` against `data_entity` and one `UPDATE` against `data_source`. — evidence: DataSourceServiceImpl.java:87-95"
- throughput_characteristics:
  - "Single-item delete per call; there is no bulk-delete endpoint on this controller. — evidence: DataSourceController.java:47-51"
- resource_allocation:
  - "Holds one R2DBC connection for the `@ReactiveTransactional` duration of the two-statement service call. Empty `Mono<Void>` response — no payload buffering. — evidence: DataSourceServiceImpl.java:86"
- scaling_characteristics:
  - "Stateless handler — scales horizontally with the platform process. The `existsNonDeletedByDataSourceId` EXISTS query is index-assisted if `data_entity.data_source_id` is indexed; the `UPDATE` targets a single row by primary key. The delete does NOT take the `getIdByOddrnForUpdate` row lock, so it does not serialise against concurrent ingestion of the same data source (see stress_findings resource_boundaries). — evidence: ReactiveDataEntityRepositoryImpl.java:158-163 + DataSourceServiceImpl.java:87-95"
- known_performance_gaps:
  - "Orphan `token` rows accumulate without bound across register/delete cycles — a slow table-growth leak, not a request-path latency issue. — evidence: V0_0_28__add_token.sql:1-13 + ReactiveAbstractSoftDeleteCRUDRepository.java:106-110 — severity: LOW"

## upstream_callers

- entry_point: "ui_route:/management/datasources (Datasources tab — per-card Delete affordance)"
  caller_node: "odd-platform-ui DataSourceApi.deleteDataSource (auto-generated OpenAPI client, invoked from datasources.thunks.ts per the class sidecar)"
  multiplicity_per_trigger: 1
  evidence: "DataSourceController.java:47-51 implements DataSourceApi; the class sidecar's upstream_callers block confirms the UI's datasources.thunks.ts + lib/hooks/api/datasource.ts invoke the generated DataSourceApi client against /api/datasources/* — one DELETE per operator click."
  observation_class: ui-call
  unresolved: true   # the exact UI thunk + onClick handler node is not yet enriched
- entry_point: "rest:DELETE /api/datasources/{data_source_id}"
  caller_node: "external odd-api-consumer (programmatic client with a UI session granting DATA_SOURCE_DELETE, or S2S X-API-Key granting ADMIN)"
  multiplicity_per_trigger: 1
  evidence: "SecurityConstants.java:121-123 binds the DELETE path to DATA_SOURCE_DELETE; the class sidecar's upstream_callers block confirms S2S callers reach this controller with ADMIN scope."
  observation_class: rest-call

## downstream_side_effects

- side_effect_class: db-write
  description: "Soft-deletes the data_source row — `UPDATE data_source SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL`. The row persists; only `deleted_at` changes."
  evidence: "ReactiveAbstractSoftDeleteCRUDRepository.java:50-58 + getDeleteChangedFields:106-110, invoked from DataSourceServiceImpl.java:91"
  cardinality_per_call: "1 if the data source has no live data_entity children and is not already deleted; else 0 (the call 400s instead)"
  reachable_from_entry_points:
    - "ui_route:/management/datasources"
    - "rest:DELETE /api/datasources/{data_source_id}"
- side_effect_class: db-read
  description: "Reads `data_entity` for the cascade-guard — `SELECT EXISTS(SELECT 1 FROM data_entity WHERE data_source_id = ? AND deleted_at IS NULL)`."
  evidence: "ReactiveDataEntityRepositoryImpl.java:158-163, invoked from DataSourceServiceImpl.java:88"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/management/datasources"
    - "rest:DELETE /api/datasources/{data_source_id}"
- side_effect_class: db-write
  description: "ORPHANS the token row — leaves `token` (FK target of the deleted data_source's `token_id`) in the database unreferenced. This is an INADVERTENT side effect: the absence of a token-delete is itself the observable consequence. The token table cannot be soft-deleted (no deleted_at column)."
  evidence: "V0_0_28__add_token.sql:1-13 (token FK + no deleted_at) + ReactiveAbstractSoftDeleteCRUDRepository.java:106-110 (delete touches only data_source.deleted_at) — confirmed by absence; pinned by P-046"
  cardinality_per_call: "1 orphan token per successful delete"
  reachable_from_entry_points:
    - "ui_route:/management/datasources"
    - "rest:DELETE /api/datasources/{data_source_id}"
- side_effect_class: db-write
  description: "Does NOT clear the FTS search_entrypoint vector for the data source (unlike the update path). The stale FTS row is an observable consequence by absence-of-cleanup."
  evidence: "DataSourceServiceImpl.java:85-96 (no searchEntrypointRepository call) vs DataSourceServiceImpl.java:127-136 (update DOES) — pinned by P-048"
  cardinality_per_call: "0 FTS rows cleared (1 stale row left)"
  reachable_from_entry_points:
    - "ui_route:/management/datasources"
    - "rest:DELETE /api/datasources/{data_source_id}"

## coherence_notes

- kind: strengthens
  target: "odd-platform java DataSourceController controller-class:DataSourceController"
  note: |
    The class sidecar's `downstream_side_effects` entry for deleteDataSource
    correctly summarised the guard-then-soft-delete shape and noted the
    orphan-attachment of historical data_entity rows. This method sidecar
    STRENGTHENS that with two facts the class-level summary did not surface:
    (1) the ORPHAN TOKEN — the `token` row (`data_source.token_id` FK,
    V0_0_28__add_token.sql:13) is never cleaned on delete and cannot be soft-
    deleted (no `deleted_at` on `token`), an exact match to the orphan-token
    pattern batch W confirmed for Collector delete; (2) the FTS
    `search_entrypoint` vector is left uncleared by delete, unlike update.
    Both are now pinned by probes P-046 and P-048.
- kind: refines
  target: "odd-platform java DataSourceController controller-class:DataSourceController"
  note: |
    The class sidecar framed the cascade question as "an operator must EITHER
    first delete all data_entities OR keep them orphan-attached". This method
    sidecar REFINES the operator-impact: because `data_entity` rows are
    collector-created and re-created on the next ingest tick, an
    actively-ingested data source is effectively undeletable — the
    delete-children-then-delete-source sequence races the collector
    (P-047 establishes the static precondition; the live race is noted as a
    follow-on). The reliable delete path requires stopping the collector
    first, which no doc page mentions.
- kind: strengthens
  target: "odd-platform java repository reactive repository:ReactiveDataSourceRepositoryImpl"
  note: |
    The repository sidecar's bug `No method to recover a soft-deleted
    datasource` and its note that `data_entity` FK has no ON DELETE clause
    are the persistence-tier substrate of this endpoint's behaviour. This
    method sidecar confirms the consumer: `deleteDataSource` is the SOLE
    UI-side caller of the inherited soft-delete on `data_source`, and it adds
    the service-tier cascade-guard the repository delete itself does not carry.

## sources

- understanding ← DataSourceController.java:47-51 + DataSourceServiceImpl.java:85-96 + ReactiveAbstractSoftDeleteCRUDRepository.java:50-58,106-110 + V0_0_28__add_token.sql:1-13 + V0_0_1__init.sql:82 + SecurityConstants.java:121-123
- concepts.operations.delete ← DataSourceController.java:47-51 + DataSourceServiceImpl.java:85-96
- concepts.invariants (soft-delete) ← ReactiveAbstractSoftDeleteCRUDRepository.java:50-58 + getDeleteChangedFields:106-110
- concepts.invariants (cascade-guard) ← DataSourceServiceImpl.java:88-95
- concepts.invariants (no FK cascade) ← V0_0_1__init.sql:82
- dependencies_semantic.requires-feature.existsNonDeletedByDataSourceId ← ReactiveDataEntityRepositoryImpl.java:158-163
- dependencies_semantic.requires-feature.SecurityRule ← SecurityConstants.java:116-126 (DELETE rule at 121-123)
- tests_coverage_semantic ← DataSourceController class sidecar (Glob sweep — no DataSourceControllerTest / DataSourceServiceImplTest)
- docs_link_semantic.inferred_docs[0] ← WebFetch https://docs.opendatadiscovery.org/features/management (2026-05-21, status 200)
- implicit_adrs[0] ← DataSourceServiceImpl.java:88-95
- implicit_adrs[1] ← ReactiveAbstractSoftDeleteCRUDRepository.java:50-58,106-110
- bugs_limitations_corner_cases.orphan-token ← DataSourceServiceImpl.java:85-96 + ReactiveAbstractSoftDeleteCRUDRepository.java:106-110 + V0_0_28__add_token.sql:1-13
- bugs_limitations_corner_cases.undeletable ← DataSourceServiceImpl.java:88-95 + ReactiveDataEntityRepositoryImpl.java:158-163
- bugs_limitations_corner_cases.FTS-uncleared ← DataSourceServiceImpl.java:85-96 vs DataSourceServiceImpl.java:127-136
- bugs_limitations_corner_cases.FK-orphan ← V0_0_1__init.sql:82
- stress_findings.name_behavior_pairs ← DataSourceController.java:47-51 + DataSourceServiceImpl.java:85-96 + ReactiveAbstractSoftDeleteCRUDRepository.java:50-58
- stress_findings.auth_gates ← SecurityConstants.java:121-123 + DataSourceController.java:47-51 (no @PreAuthorize)
- stress_findings.resource_boundaries ← DataSourceServiceImpl.java:86-95 + ReactiveAbstractSoftDeleteCRUDRepository.java:50-58
- stress_findings.request_inputs ← DataSourceController.java:48-49 + DataSourceServiceImpl.java:87-95 + ReactiveDataEntityRepositoryImpl.java:158-160
- security.authorization_assertions ← SecurityConstants.java:121-123 + DataSourceController.java:47-51
- security.known_security_gaps.orphan-token ← V0_0_28__add_token.sql:1-13
- performance ← DataSourceServiceImpl.java:85-96 + ReactiveDataEntityRepositoryImpl.java:158-163
- upstream_callers ← DataSourceController.java:47-51 + DataSourceController class sidecar (upstream_callers block)
- downstream_side_effects ← DataSourceServiceImpl.java:85-96 + ReactiveAbstractSoftDeleteCRUDRepository.java:50-58 + V0_0_28__add_token.sql:1-13

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: MEDIUM
- security: HIGH
- performance: MEDIUM
- upstream_callers: MEDIUM
- downstream_side_effects: MEDIUM
- stress_findings: MEDIUM

Overall MEDIUM: the static structure (soft-delete, cascade-guard, no FK
cascade, declarative auth) is HIGH-confidence and well-anchored. The three
load-bearing operator-observable claims that route through PROBE-NEEDED — the
orphan-token persistence (P-046), the cascade block/allow split (P-047), and
the FTS-uncleared leak (P-048) — are strongly evidenced by absence-of-code
plus schema reads, but each is finally pinned only when its probe runs;
confidence_overall is held at MEDIUM until the probe-runner resolves them.

## Maintainer notes

(none)

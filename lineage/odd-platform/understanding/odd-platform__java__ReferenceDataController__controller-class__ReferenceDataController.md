---
node_id: "odd-platform java ReferenceDataController controller-class:ReferenceDataController"
node_kind: controller-class
axis: controllers
extracted_at_commit: 9ac6436e9bd36ba132d765076c6bbd5916fde729
enriched_at_commit: 9ac6436e9bd36ba132d765076c6bbd5916fde729
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-V-ReferenceDataController
---

# ReferenceDataController — semantic understanding

## understanding

Thin OpenAPI-generated controller (`implements ReferenceDataApi`) that exposes the 14-endpoint Lookup-Table CRUD + Reference-Data Search surface at `/api/referencedata/*`. Every method is a one-line dispatch from `Mono<FormData>` / `Flux<RowFormData>` straight into either `ReferenceDataService` (the table / column / row CRUD orchestrator) or `LookupDataSearchService` (the faceted-search session pattern). Lookup Tables are first-class Data Entities (`DataEntityTypeDto.LOOKUP_TABLE` inside the `DATA_SET` class — `DataEntityClassDto.java:43`) whose row storage is physical Postgres tables in `lookup_tables_schema` and whose RBAC is gated **outside** the controller by the central `SecurityConstants.SECURITY_RULES` registry (no `@PreAuthorize` annotations on this class — verified by Grep). Search uses the same session-id pattern as the Catalog: POST creates a session, subsequent GET/PUT operate against the persisted facet state, and `/results` paginates.

## concepts

- entities: [LookupTable, LookupTableField (column), LookupTableRow, ReferenceDataSearchSession, Namespace (owning), DataEntity (parent of the lookup table)]
- operations: [create-table, list-rows, get-table, get-column, get-row-list, add-columns, add-rows, update-table, update-column, update-row, delete-table, delete-column, delete-row, search-create, search-get-facets, search-update-facets, search-get-results]
- invariants:
  - "Every lookup table has a backing physical PostgreSQL table in `lookup_tables_schema` named `n_{namespaceId}__{lowercased_underscored_name}` (`ReferenceDataServiceImpl.java:191-194`)"
  - "Column and row mutation requires the column/row to belong to the supplied `lookupTableId`; mismatch raises `BadUserRequestException` for column reads (`ReferenceDataServiceImpl.java:62-66`)"
  - "Delete cascade is service-orchestrated (search-entrypoint rows → table-definitions → tableRepository row → DataEntity) — not enforced by FK constraints (`LookupDataServiceImpl.java:114-118`)"
- audiences: [odd-platform-ui-end-user (Master Data tab), platform-operator (steward-curated reference lists), data-engineer-analyst (downstream pipelines + BI joins)]

## dependencies_semantic

- requires-feature:
  - "OpenAPI codegen — controller implements the generated `ReferenceDataApi` interface (`ReferenceDataController.java:6, 29`)"
  - "Faceted-search session subsystem — `LookupDataSearchService` mirrors the `SearchService` session-id pattern (`LookupDataSearchService.java:9-17`)"
  - "Master Data Management pillar (P-03) — single user-observable surface of this pillar per `lineage/odd-platform/system-mission.md` lines 125-141"
- requires-config:
  - "PostgreSQL `lookup_tables_schema` (DDL convention — `ReferenceDataRepositoryImpl.java:57`)"
  - "No `application.yml` keys consumed by this controller directly; depends on the platform-wide auth.type / S2S config at the SecurityConstants layer"
- requires-runtime:
  - "Spring WebFlux reactive runtime — all methods return `Mono<ResponseEntity<...>>` (`ReferenceDataController.java:23-24`)"
  - "jOOQ DDL execution capability — table creation / drop run as `ReactiveCustomTransactional` DDL (`ReferenceDataRepositoryImpl.java:64, 268`)"
  - "Per-tenant namespace must exist before table creation — `namespaceRepository.getByName(formData.getNamespaceName())` is the entry resolution (`ReferenceDataServiceImpl.java:74`)"

## tests_coverage_semantic

- covered_behaviours:
  - "Service-tier orchestration: table create / column add / row add / update / delete paths (LookupDataServiceTest only — covers `LookupDataServiceImpl` indirectly)"
- uncovered_behaviours:
  - "Controller-tier: no `ReferenceDataControllerTest` exists (Glob `**/ReferenceDataController*Test*.java` returned no files)"
  - "RBAC enforcement at the controller layer — no integration test asserts that an unauthenticated or under-permissioned caller is rejected on each of the 9 mutating endpoints"
  - "Cascade integrity on delete — no test asserts that orphan rows / DDL tables / search-entrypoint rows are left behind on partial-failure"
  - "XSS / HTML-payload value persistence — no test asserts that a value containing `<script>` is escaped on retrieval"
  - "Per-namespace `buildTableName` uniqueness collision (two tables with names that lowercase + space-replace to the same string)"
- test_files:
  - "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/service/LookupDataServiceTest.java (service-tier only; not controller-tier)"
- gaps: |
    A regression on the controller is invisible to the current test suite: change a method signature, drop an `@Override`, swap services, remove a status-mapping — none of those would fail a build. The RBAC wiring is also fragile because it lives at `SecurityConstants.SECURITY_RULES` (path-pattern matcher), which means a route renamed in the OpenAPI spec but not in `SecurityConstants` would silently become unauthenticated. The most likely operator-visible regression is therefore: a successful refactor of `SecurityConstants` rules table that omits one of the 9 lookup-table entries → endpoint accessible to any authenticated user. No test catches this.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/master-data-management/lookup-tables"
    anchor: ""
    rationale: "This is the canonical Master Data Management pillar (P-03) doc page documenting the Lookup Tables feature; the controller backs the entire `/api/referencedata/*` surface described there."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      "The full HTTP API for Lookup Tables is documented at API Reference → Reference Data — 16 endpoints across four groups" covering Table CRUD, Column CRUD, Row CRUD, and Search under `/api/referencedata/`.
      RBAC: 9 permissions across three surfaces (Table-level: LOOKUP_TABLE_CREATE/UPDATE/DELETE; Definition-level: LOOKUP_TABLE_DEFINITION_CREATE/UPDATE/DELETE; Data-level: LOOKUP_TABLE_DATA_CREATE/UPDATE/DELETE). "The split lets operators grant edit-the-data without grant-edit-the-schema (a typical pattern for steward-curated reference lists)."
  - url: "https://docs.opendatadiscovery.org/developer-guides/api-reference/reference-data"
    anchor: ""
    rationale: "P-11 Developer Surface — the canonical per-feature API-reference sub-page for Reference Data is named in the LSN-006 retrospective and in system-mission.md's P-11 sub-feature list (line 313)."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: not-fetched-in-this-session
    confidence: LOW
- doc_drift_findings:
  - "Doc claims **16 endpoints across four groups**, OpenAPI spec carries **14 paths** (counted at `openapi.yaml` lines 3822-4138 — 4 under `/table`, 3 under `/table/.../columns`, 3 under `/table/.../data`, 4 under `/search`). The arithmetic '16' likely counts overloaded methods (GET + PUT + DELETE on `/table/{id}` = 3, etc.) — but the doc reader has no way to reconcile."
  - "Doc claims **9 PostgreSQL field types** (per system-mission.md line 138 sub-feature seed); `LookupTableColumnTypes.java:30-50` enumerates **8 active types** (TYPE_VARCHAR / TYPE_INTEGER / TYPE_SERIAL / TYPE_DECIMAL / TYPE_BOOLEAN / TYPE_DATE / TYPE_TIME / TYPE_JSON / TYPE_UUID = 9 entries, with `TYPE_ENUM` commented out at `LookupTableColumnTypes.java:46`). Count = 9 enum constants but 8 *distinct* SQL data types since TYPE_INTEGER and TYPE_SERIAL share INTEGER. Minor — but the docs page does not explain the SERIAL-vs-INTEGER distinction."
  - "Doc page does NOT discuss cascade behaviour on delete (verified via WebFetch 2026-05-20). The service orchestrates a 4-step transactional cascade (`LookupDataServiceImpl.java:114-118`) + drops the physical Postgres table (`ReferenceDataRepositoryImpl.java:268-277`), but operators have no documented expectation of this behaviour."
  - "Doc page does NOT discuss XSS / input-validation posture on row values, column names, or table names (verified via WebFetch 2026-05-20). The platform writes user-authored values back into the catalog's FTS index (`ReactiveLookupTableSearchEntrypointRepositoryImpl` exists) — same audience surface as F-004 description-editing stored-XSS family."
  - "Doc page does NOT clarify per-tenant scoping for lookup tables. Code uses `Namespace` for grouping (`ReferenceDataServiceImpl.java:74-80`) but no `odd.tenant-id` filter is applied at the controller / service / search layer — lookup tables are read-collaborative-posture by default (sibling to REFACTOR-024 / REFACTOR-203 in system-mission.md line 267)."

## implicit_adrs

- "Lookup tables are first-class Data Entities (sub-type of DATA_SET) — implies the same Discovery / Lineage / Search / Tag / Owner / Description model applies." — evidence: DataEntityClassDto.java:31, 43 — intent_anchor: `"import static org.opendatadiscovery.oddplatform.dto.DataEntityTypeDto.LOOKUP_TABLE; ... DATA_SET(1, Set.of(TABLE, FILE, FEATURE_GROUP, KAFKA_TOPIC, VIEW, GRAPH_NODE, VECTOR_STORE, LOOKUP_TABLE))"` — confidence: HIGH

- "RBAC gating lives at the route matcher (SecurityConstants), not at the controller method — a generated `*Api` interface implementation that holds no annotations is the design." — evidence: SecurityConstants.java:47-55 (9 permission imports), 114-115 (POST `/api/referencedata/table` → LOOKUP_TABLE_CREATE), 325-354 (8 further mutating-endpoint matchers) — intent_anchor: `"new SecurityRule(NO_CONTEXT, new PathPatternParserServerWebExchangeMatcher(\"/api/referencedata/table\", POST), LOOKUP_TABLE_CREATE)"` (this is the consistent pattern across all 9 `LOOKUP_TABLE_*` permissions; the controller layer is intentionally annotation-free) — confidence: HIGH

- "Three-surface permission split (table / definition / data) — operators can grant 'edit the data' without 'edit the schema'." — evidence: PolicyPermissionDto.java:80-88 (the 9-permission enumeration with MANAGEMENT category) + live doc page WebFetched 2026-05-20 quoting "The split lets operators grant edit-the-data without grant-edit-the-schema (a typical pattern for steward-curated reference lists)" — intent_anchor: doc quote + the consistent _CREATE/_UPDATE/_DELETE triad across LOOKUP_TABLE / LOOKUP_TABLE_DEFINITION / LOOKUP_TABLE_DATA in `PolicyPermissionDto` — confidence: HIGH

- "Row storage is delegated to a physical Postgres table in `lookup_tables_schema`, not stored as JSON in the catalog — reflects an operator-facing read pattern: SQL-joinable from downstream BI." — evidence: ReferenceDataRepositoryImpl.java:57 (`private static final String SCHEMA_NAME = "lookup_tables_schema";`), `createLookupTable` issuing DDL `CREATE SEQUENCE` + `CREATE TABLE` (lines 65-76), live-doc P-03 narrative ("direct PostgreSQL access via `lookup_tables_schema`") — intent_anchor: `"private static final String SCHEMA_NAME = \"lookup_tables_schema\";"` + the explicit DDL in `createLookupTable` — confidence: HIGH

- "Faceted-search session pattern is mirrored from the catalog Search — `referenceDataSearch` (POST) creates a session, `/search/{search_id}` (GET/PUT) operates on the session, `/search/{search_id}/results` paginates." — evidence: ReferenceDataController.java:64-78, 103-109, 111-119 + openapi.yaml:3969-4060 — intent_anchor: the method signatures + path layout reproduce the SearchController pattern verbatim (UUID searchId / page / size triad) — confidence: HIGH

## bugs_limitations_corner_cases

- "Read endpoints (`getLookupTableById`, `getLookupTableField`, `getLookupTableRowList`, `referenceDataSearch`, `getReferenceDataSearchFacetList`, `getReferenceDataSearchResults`) carry NO authorization checks at the SecurityConstants layer — only the 9 mutating endpoints have rules. Any authenticated user can read any lookup table in any namespace. Compatible with the platform-wide read-collaborative posture (REFACTOR-024 / REFACTOR-203 per system-mission.md) but not stated in the live docs for this pillar." — evidence: SecurityConstants.java:114-115, 325-354 (9 mutating-endpoint rules — no read-endpoint rules); openapi.yaml:3843-3858 (`GET /api/referencedata/table/{lookup_table_id}` is the canonical anonymous-readable example) — severity: MEDIUM

- "Lookup table row values are persisted unchanged — `LookupCharValidator.getValue` returns the input string verbatim (`LookupCharValidator.java:14-17`). Values are read back via `/api/referencedata/table/{id}/data` and rendered in the UI. Same audience surface as F-004 stored-XSS family (description editing) — no `<script>`-tag stripping, no length cap, no HTML escaping at the storage layer. A row containing `<img src=x onerror=alert(1)>` would round-trip intact." — evidence: LookupCharValidator.java:14-17 (`public Object getValue(final String value, final String columnName) { return value; }`), ReferenceDataRepositoryImpl.java:117-150 (`addDataToLookupTable` uses parameterized `DSL.val(...)` — so SQL injection is safe, but no content-side sanitization), components.yaml:3863-3882 (LookupTableFieldFormData has no `maxLength` / `pattern` / format constraint on `name`, `description`, `default_value`), components.yaml:3996-4025 (LookupTableRowFormData → LookupTableRowColumnFormData has `value: type: string` with no constraint) — severity: HIGH

- "`buildTableName` collisions: two tables named `Customer Lookups` and `customer_lookups` in the same namespace both resolve to `n_{namespaceId}__customer_lookups`. The downstream `DSL.createTable(tableName)` will raise a Postgres `relation already exists` error surfaced as a generic 500 — no friendly 409 / `BadUserRequestException` path." — evidence: ReferenceDataServiceImpl.java:191-194 (`name.toLowerCase().replace(" ", "_")` — lossy normalization, no uniqueness pre-check), ReferenceDataServiceImpl.java:73-86 (`createLookupTable` does not check for an existing table with the same `tableName` before calling `referenceDataRepository.createLookupTable`) — severity: MEDIUM

- "Cascade-on-parent-DataEntity-delete is NOT enforced by FK constraint. If an operator deletes the lookup table's parent DataEntity via `/api/dataentities/{id}` (or via ingestion soft-delete TTL), the rows in `lookup_tables_schema.n_*` and the `lookup_tables` row become orphaned. Cleanup only happens when the operator deletes via `DELETE /api/referencedata/table/{lookup_table_id}` — the controller-orchestrated path." — evidence: LookupDataServiceImpl.java:114-118 (service-orchestrated cascade: `lookupTableSearchEntrypointRepository.deleteByTableId` → `tableDefinitionRepository.deleteByTableId` → `tableRepository.delete` → `dataEntityLookupTableService.deleteByDataEntityId`); ReferenceDataRepositoryImpl.java:268-277 (`deleteLookupTable` drops the physical table); no FK on `lookup_tables.data_entity_id` enforcing the inverse direction (would surface a constraint violation if it existed). Soft-delete via the catalog's `STATUS=DELETED` / housekeeping TTL would also bypass this controller's cleanup. — severity: HIGH

- "No transactional consistency between the catalog-side delete (`tableRepository.delete`) and the `lookup_tables_schema` physical-table DROP. Both use `@ReactiveCustomTransactional` / `@ReactiveTransactional` separately (service-tier vs repository-tier) — a failure between the catalog DELETE (commit A) and the physical DROP TABLE (commit B) leaves the catalog inconsistent with the data store. No compensating action exists." — evidence: LookupDataServiceImpl.java:113 (`@ReactiveTransactional` on `deleteLookupTable`) and ReferenceDataRepositoryImpl.java:267 (`@ReactiveCustomTransactional` on the `deleteLookupTable` DDL). The composition is `referenceDataRepository.deleteLookupTable(table).then(lookupDataService.deleteLookupTable(table))` in `ReferenceDataServiceImpl.java:154-158` — two transactions, one Mono chain, no rollback semantics across the boundary. — severity: MEDIUM

- "`updateLookupTableField(columnId, formData)` discards the `lookupTableId` path parameter — the service signature is `updateLookupTableField(final Long columnId, final LookupTableFieldUpdateFormData formData)` (no table-id) so a client could PATCH `/api/referencedata/table/999/column/{column_id}` and the update succeeds regardless of whether columnId belongs to table 999. Inconsistent with `getLookupTableField` which validates the parent-table linkage (`ReferenceDataServiceImpl.java:62-66`)." — evidence: ReferenceDataController.java:131-141 (controller passes `lookupTableId` in but the service-call only uses `columnId`), ReferenceDataServiceImpl.java:126-143 (service signature drops `lookupTableId`), vs ReferenceDataServiceImpl.java:58-70 (`getLookupTableField` enforces the cross-check) — severity: MEDIUM

- "Hardcoded pagination defaults: `addDataToLookupTable` returns the first 50 rows after insert (`ReferenceDataRepositoryImpl.java:149: getLookupTableRowList(table, 1, 50)`), and `updateLookupTableRow` does the same (line 263). Operator inserting 1000 rows sees only the first 50 in the response — no signal on the success of rows 51-1000 beyond an HTTP 200." — evidence: ReferenceDataRepositoryImpl.java:149, 263 — severity: LOW

- "`updateLookupTable` rebuilds `tableName` by re-running `buildTableName(formData.getName(), table.namespacePojo())` — if the operator renames the lookup table, the physical Postgres table gets renamed too (via `ALTER TABLE ... RENAME TO` in `ReferenceDataRepositoryImpl.java:191-201`). Downstream pipelines that hardcoded `lookup_tables_schema.n_5__customer_lookups` break silently on rename. No deprecation alias / view." — evidence: ReferenceDataServiceImpl.java:107-124 + ReferenceDataRepositoryImpl.java:181-202 — severity: MEDIUM

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP | DISABLED` — controller is on the HTTP `/api/*` surface; the route is protected by `SecurityConstants.SECURITY_RULES` which apply across all UI auth modes. When `auth.type=DISABLED`, all 14 endpoints are reachable by any client per the platform-wide DISABLED stance. S2S `auth.s2s.enabled` grants ADMIN, so an S2S caller bypasses the 9 permission rules. `INTERNAL_ONLY`: N/A — HTTP-bound.

- **ingestion_filter_relevance**: `NO — UI/API surface, not ingestion`. `IngestionDataEntitiesFilter` only registers on `/ingestion/entities` (per system-mission.md line 264 + IngestionDataEntitiesFilter sidecar pattern). The lookup-table controller is on `/api/referencedata/*` — unaffected by `auth.ingestion.filter.enabled`.

- **authorization_assertions**:
  - "`POST /api/referencedata/table` requires `LOOKUP_TABLE_CREATE`" — evidence: SecurityConstants.java:114-115
  - "`PUT /api/referencedata/table/{lookup_table_id}` requires `LOOKUP_TABLE_UPDATE`" — evidence: SecurityConstants.java:326-327
  - "`DELETE /api/referencedata/table/{lookup_table_id}` requires `LOOKUP_TABLE_DELETE`" — evidence: SecurityConstants.java:329-330
  - "`POST /api/referencedata/table/{lookup_table_id}/columns` requires `LOOKUP_TABLE_DEFINITION_CREATE`" — evidence: SecurityConstants.java:331-334
  - "`PATCH /api/referencedata/table/{lookup_table_id}/column/{column_id}` requires `LOOKUP_TABLE_DEFINITION_UPDATE`" — evidence: SecurityConstants.java:335-338
  - "`DELETE /api/referencedata/table/{lookup_table_id}/column/{column_id}` requires `LOOKUP_TABLE_DEFINITION_DELETE`" — evidence: SecurityConstants.java:339-342
  - "`POST /api/referencedata/table/{lookup_table_id}/data` requires `LOOKUP_TABLE_DATA_CREATE`" — evidence: SecurityConstants.java:343-346
  - "`PUT /api/referencedata/table/{lookup_table_id}/data/{row_id}` requires `LOOKUP_TABLE_DATA_UPDATE`" — evidence: SecurityConstants.java:347-350
  - "`DELETE /api/referencedata/table/{lookup_table_id}/data/{row_id}` requires `LOOKUP_TABLE_DATA_DELETE`" — evidence: SecurityConstants.java:351-354
  - "All 9 rules use `NO_CONTEXT` resolver (not the entity-scoped DATA_ENTITY / TERM / DEG resolvers). The lookup_table_id in the URL is NOT used to scope the permission to the specific table's owners — any user with the `LOOKUP_TABLE_*` permission via ANY Policy can mutate ANY lookup table." — evidence: SecurityConstants.java:114, 325 (NO_CONTEXT first-argument to every LOOKUP_TABLE_* `SecurityRule`); contrast with TERM-scoped rules at lines 174-193 and DATA_ENTITY-scoped rules at lines 194-227
  - "All 5 search + read endpoints (`GET /table/{id}`, `GET /table/{id}/columns/{id}`, `GET /table/{id}/data`, POST `/search`, GET/PUT `/search/{id}`, GET `/search/{id}/results`) have NO SecurityRule entries — only authentication (no anonymous) gates them. Authenticated users with zero RBAC permissions can still browse." — evidence: Grep of `referencedata|reference-data|lookup` against SecurityConstants.java returned ONLY the 9 mutating-endpoint rules listed above.

- **owner_scoping**: `BYPASSES — reads return data across owners (no per-tenant filter)`. The PATCH `/column` operation also bypasses parent-table linkage (see `bugs_limitations_corner_cases` item 6). Lookup tables are read-collaborative-posture — consistent with the platform-wide stance, but the doc page does not state this.

- **data_exposure**:
  - "Lookup table row values (operator-curated reference data — codes, lookups, mappings) → any authenticated user across all namespaces"
  - "Lookup table schema (column names, types, default values) → any authenticated user"
  - "Lookup table search facets (namespace counts, type counts) → any authenticated user"
  - "Possible XSS payload round-trip: row value containing HTML/JS is stored verbatim, returned verbatim — UI render contract decides the final attack surface. Same F-004 family."

- **known_security_gaps**:
  - "Read endpoints (6 of 14) carry NO RBAC — only authentication gates them. A lookup table containing sensitive reference data (e.g. internal employee codes, customer-tier mappings) cannot be hidden from non-MANAGEMENT users. The MANAGEMENT category split provides no read-side gradient." — evidence: SecurityConstants.java (no LOOKUP_TABLE_* `_READ` permission exists; PolicyPermissionDto.java:80-88 has only CREATE/UPDATE/DELETE) — severity: MEDIUM
  - "Stored-XSS surface on row values + column names + table name + description (all `type: string` with no maxLength / pattern in OpenAPI; LookupCharValidator returns input verbatim). Sibling to F-004 description-editing stored-XSS family." — evidence: LookupCharValidator.java:14-17 + components.yaml:3863-3882, 4006-4025 — severity: HIGH
  - "Permission scope is global (NO_CONTEXT resolver) — a Policy granting `LOOKUP_TABLE_UPDATE` permits modifying ANY lookup table, not just those owned by the user's Owner. Inconsistent with TERM (TERM resolver) and DATA_ENTITY (DATA_ENTITY resolver) scoping in the same SecurityConstants table." — evidence: SecurityConstants.java:114, 174 (TERM), 195-227 (DATA_ENTITY), 326-354 (NO_CONTEXT for all LOOKUP_TABLE_*) — severity: MEDIUM
  - "`updateLookupTableField` discards path-param `lookupTableId` at the service layer — an authorized caller with `LOOKUP_TABLE_DEFINITION_UPDATE` (granted via Policy on table A) can PATCH a column belonging to table B by spoofing the URL. The NO_CONTEXT permission doesn't catch the cross-table jump." — evidence: ReferenceDataController.java:131-141, ReferenceDataServiceImpl.java:126-143 — severity: MEDIUM

- **canonical references for the security vocabulary used here**: live `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security` family (auth modes / S2S / ingestion filter); live `.../authorization` for Policies / Permissions / Roles / Owners.

## performance

- **hot_paths**:
  - "List rows (`GET /api/referencedata/table/{id}/data`) runs paginated by default but server-side count is `fetchCount(table.tablesPojo().getTableName())` — full-table COUNT(*) on every page request. For a 1M-row reference table this is the dominant cost." — evidence: ReferenceDataRepositoryImpl.java:172-177 (pageifyResult calls fetchCount on every request)
  - "Search-results endpoint (`GET /api/referencedata/search/{search_id}/results`) reuses the catalog-search FTS-vector mechanism via `ReactiveLookupTableSearchEntrypointRepositoryImpl` — Postgres tsvector @@ tsquery on the lookup-tables search-entrypoint."

- **throughput_characteristics**:
  - "Batch insert: `addDataToLookupTable` accepts `Flux<LookupTableRowFormData>` and builds a single `InsertValuesStepN` with all rows (`ReferenceDataRepositoryImpl.java:117-150`). Sized for tens to low-hundreds of rows per request — no streaming insert."
  - "Reactive Mono/Flux signatures across all 14 endpoints — non-blocking but per-call DB round-trip; no aggregation or batching at the controller layer."

- **resource_allocation**:
  - "`fetchCount` and `addDataToLookupTable` are NOT statement-cached — jOOQ rebuilds the DSL each call (no compiled-statement caching observed in the repository implementation)."
  - "DDL operations (createLookupTable, deleteLookupTable, alterTable on rename) acquire Postgres ACCESS EXCLUSIVE LOCK on the lookup-table — blocks all concurrent reads/writes on that table for the lock duration. Significant for delete + rename paths under load."

- **scaling_characteristics**:
  - "Stateless controller — instances scale horizontally"
  - "Per-table data resides in physical Postgres tables in `lookup_tables_schema` — total schema size scales with operator-created lookup tables. No upper bound enforced."
  - "Hardcoded 50-row response cap on insert/update (`getLookupTableRowList(table, 1, 50)` calls at lines 149, 263) — caller cannot influence the response page size after a write."
  - "Hardcoded page=1 on insert/update response — operator inserting/updating row 51+ has no API-side feedback distinguishing 50 from 5000."

- **known_performance_gaps**:
  - "DDL serialization risk: rename / delete take ACCESS EXCLUSIVE LOCK; concurrent read-heavy traffic on a popular reference table blocks during operator edits. No advisory-lock-driven queue, no offline-rebuild pattern." — evidence: ReferenceDataRepositoryImpl.java:181-202 (rename DDL chain), 268-277 (delete DDL chain) — severity: MEDIUM
  - "FTS update is synchronous in the write path (`LookupDataServiceImpl.updateSearchVectors` is composed via `.then(...)` after the row write) — every row write triggers a tsvector rebuild on the search-entrypoint." — evidence: LookupDataServiceImpl.java:129-143 (search-vector update methods composed into the write path) — severity: LOW
  - "fetchCount(*) per page read on row-list endpoint — `O(N)` COUNT(*) over the physical Postgres table — `N = row count`. Operator-curated reference tables typically `N < 10K` so this is acceptable today, but a 1M-row table degrades each read." — evidence: ReferenceDataRepositoryImpl.java:172-177 — severity: LOW

## sources

- understanding ← ReferenceDataController.java:26-174 + ReferenceDataServiceImpl.java:31-194 + LookupDataSearchService.java:9-17 + SecurityConstants.java:114-115, 325-354 + WebFetch `https://docs.opendatadiscovery.org/features/master-data-management/lookup-tables` 2026-05-20
- concepts.entities.LookupTable ← ReferenceDataController.java:7, openapi.yaml:3822-4138
- concepts.entities.LookupTableRow ← components.yaml:4006-4025
- concepts.entities.DataEntity-as-parent ← DataEntityClassDto.java:43, LookupDataServiceImpl.java:38 (`dataEntityLookupTableService.createLookupDataEntity`)
- concepts.invariants.physical-Postgres-table ← ReferenceDataServiceImpl.java:191-194 + ReferenceDataRepositoryImpl.java:57, 65-76
- concepts.invariants.column-belongs-to-table-check ← ReferenceDataServiceImpl.java:62-66
- concepts.invariants.service-orchestrated-cascade ← LookupDataServiceImpl.java:114-118 + ReferenceDataRepositoryImpl.java:268-277
- dependencies_semantic.requires-feature.OpenAPI-codegen ← ReferenceDataController.java:6, 29
- dependencies_semantic.requires-feature.search-session-pattern ← LookupDataSearchService.java:9-17 + openapi.yaml:3969-4060
- dependencies_semantic.requires-runtime.reactive ← ReferenceDataController.java:23-24
- dependencies_semantic.requires-runtime.namespace-precondition ← ReferenceDataServiceImpl.java:74
- tests_coverage_semantic.test_files ← `<odd-platform-repo>/odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/service/LookupDataServiceTest.java`
- docs_link_semantic.inferred_docs[0] ← WebFetch `https://docs.opendatadiscovery.org/features/master-data-management/lookup-tables` 2026-05-20 + WebFetch `https://docs.opendatadiscovery.org/features/master-data-management` 2026-05-20
- docs_link_semantic.doc_drift_findings.endpoint-count ← openapi.yaml:3822-4138 (14 paths, 17 operations) vs live-doc "16 endpoints across four groups"
- docs_link_semantic.doc_drift_findings.field-types ← LookupTableColumnTypes.java:30-50 (9 enum constants incl. SERIAL alias)
- docs_link_semantic.doc_drift_findings.cascade-silence ← live-doc WebFetch 2026-05-20 (cascade behaviour not covered)
- docs_link_semantic.doc_drift_findings.xss-silence ← live-doc WebFetch 2026-05-20 (input validation not covered)
- docs_link_semantic.doc_drift_findings.tenant-silence ← live-doc WebFetch 2026-05-20 (tenant scope not covered)
- implicit_adrs.[0].data-entity-subtype ← DataEntityClassDto.java:31, 43
- implicit_adrs.[1].route-matcher-RBAC ← SecurityConstants.java:47-55, 114-115, 325-354
- implicit_adrs.[2].three-surface-permission-split ← PolicyPermissionDto.java:80-88 + live doc quote
- implicit_adrs.[3].physical-postgres-storage ← ReferenceDataRepositoryImpl.java:57, 65-76 + live doc P-03
- implicit_adrs.[4].search-session-pattern ← ReferenceDataController.java:64-78, 103-119 + openapi.yaml:3969-4060
- bugs_limitations_corner_cases.[0].read-endpoints-no-RBAC ← SecurityConstants.java (Grep confirms no read-endpoint LOOKUP_TABLE_* rule)
- bugs_limitations_corner_cases.[1].XSS-surface ← LookupCharValidator.java:14-17 + components.yaml:3863-3882, 4006-4025
- bugs_limitations_corner_cases.[2].tableName-collision ← ReferenceDataServiceImpl.java:191-194 + 73-86 (no pre-check)
- bugs_limitations_corner_cases.[3].cascade-orphan ← LookupDataServiceImpl.java:114-118 + absence of FK constraint inverse on lookup_tables.data_entity_id
- bugs_limitations_corner_cases.[4].two-transactions ← LookupDataServiceImpl.java:113 + ReferenceDataRepositoryImpl.java:267 + ReferenceDataServiceImpl.java:154-158
- bugs_limitations_corner_cases.[5].PATCH-column-discards-tableId ← ReferenceDataController.java:131-141 + ReferenceDataServiceImpl.java:126-143
- bugs_limitations_corner_cases.[6].hardcoded-50-row-response ← ReferenceDataRepositoryImpl.java:149, 263
- bugs_limitations_corner_cases.[7].rename-breaks-downstream ← ReferenceDataServiceImpl.java:107-124 + ReferenceDataRepositoryImpl.java:181-202
- security.auth_mode_relevance ← SecurityConstants.java SECURITY_RULES list (all path-pattern matchers apply across UI auth modes)
- security.ingestion_filter_relevance ← system-mission.md lines 263-265 (IngestionDataEntitiesFilter on `/ingestion/entities` only)
- security.authorization_assertions.[0-8] ← SecurityConstants.java:114-115, 326-354
- security.authorization_assertions.NO_CONTEXT ← SecurityConstants.java:114, 325 + contrast at lines 174-193 (TERM) and 194-227 (DATA_ENTITY)
- security.authorization_assertions.read-no-rules ← Grep confirms no read-endpoint rules
- security.known_security_gaps.[0] ← SecurityConstants.java + PolicyPermissionDto.java:80-88 (no _READ permission)
- security.known_security_gaps.[1] ← LookupCharValidator.java:14-17 + components.yaml
- security.known_security_gaps.[2] ← SecurityConstants.java:114, 174, 195-227, 326-354
- security.known_security_gaps.[3] ← ReferenceDataController.java:131-141 + ReferenceDataServiceImpl.java:126-143
- performance.hot_paths.list-rows ← ReferenceDataRepositoryImpl.java:172-177
- performance.throughput_characteristics.batch-insert ← ReferenceDataRepositoryImpl.java:117-150
- performance.resource_allocation.DDL-locks ← ReferenceDataRepositoryImpl.java:181-202, 268-277
- performance.scaling_characteristics.hardcoded-50 ← ReferenceDataRepositoryImpl.java:149, 263
- performance.known_performance_gaps.[0].DDL-serialization ← ReferenceDataRepositoryImpl.java:181-202, 268-277
- performance.known_performance_gaps.[1].FTS-synchronous ← LookupDataServiceImpl.java:129-143
- performance.known_performance_gaps.[2].fetchCount-per-page ← ReferenceDataRepositoryImpl.java:172-177

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH (live-fetched 2026-05-20; both fetches returned 200; one inferred sub-page url not fetched in this session — confidence on THAT entry: LOW)
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: MEDIUM (DDL-lock claim is structural — derives from "ALTER TABLE / DROP TABLE in Postgres take ACCESS EXCLUSIVE" which is a Postgres invariant not directly verified by code inspection; the code anchors are correct but the lock-class is a Postgres fact, not a code-side claim)

## Maintainer notes

(Empty — no EXISTING_SIDECAR was supplied as input. Maintainer adds prose here that should survive future enrichment passes; the file-analyser leaves this section alone on refresh.)

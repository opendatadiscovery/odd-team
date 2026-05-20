---
node_id: "odd-platform java repository reactive repository:ReactiveDataSourceRepositoryImpl"
node_kind: repository
axis: repositories
extracted_at_commit: 80637ed
enriched_at_commit: 80637ed
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-batch-R-ReactiveDataSourceRepositoryImpl
feature_hint: "P-10:F-001 (Batch Ingestion / S2S API) — the SQL-tier primary source for the UPSERT-by-ODDRN partial-merge that batch P (IngestionController.createDataSourceEntity) surfaces at the controller layer; ALSO P-08:F-004 (Collector Lifecycle Management) — supplies `existsByCollector(id)` that CollectorServiceImpl.delete (line 73-79) calls for the cascade-delete guard."
related_features:
  - F-008
  - F-020
related_pillar_features:
  - P-10:F-001
  - P-08:F-004
  - P-08:F-NN-Datasources-tab  # unresolved — Datasources-tab in P-08 hasn't been carved into a feature_id yet
related_refactoring_scopes:
  - REFACTOR-422
  - REFACTOR-423
  - REFACTOR-424
  - REFACTOR-425  # NEW: count-vs-query predicate divergence (startsWithIgnoreCase vs containsIgnoreCase)
related_concepts:
  - upsert-by-oddrn-partial-merge-collector-driven-only-name-description
  - namespace-inherited-from-collector-not-payload-collector-scoped-tenancy
  - three-soft-delete-mechanisms-across-the-repository-layer
related_implicit_adrs:
  - ADR-CANDIDATE-142
  - ADR-CANDIDATE-143
related_retrospectives:
  - LSN-001  # attachment-ephemeral-default — same SHAPE as silent-no-propagation default-on-collector-overwrite
upstream_callers:
  - "DataSourceIngestionServiceImpl (DataSourceIngestionServiceImpl.java:35-72) — the SOLE caller invoking the UPSERT pair (`getDtosByOddrns` → `bulkUpdate` for matched + `bulkCreate` for new) inside `@ReactiveTransactional` (line 40). This is the path triggered by `POST /ingestion/datasources` (IngestionController.createDataSource line 47-73, batch P sidecar)."
  - "IngestionServiceImpl (IngestionServiceImpl.java:65-74) — calls `getIdByOddrnForUpdate(dataSourceOddrn)` (line 68) as the FIRST step of `POST /ingestion/entities` ingestion (batch O+P sidecars) to resolve the data_source_id under an explicit `FOR UPDATE` row lock for the duration of the ingestion transaction. `NotFoundException` raised at line 69 if the ODDRN doesn't match a live data_source row."
  - "DataSourceServiceImpl (DataSourceServiceImpl.java:32, methods at lines 39-105) — the UI-side CRUD (`list`, `get`, `create`, `update`, `delete`, `regenerateDataSourceToken`) on `/api/datasources/*`. Mapped via DataSourceController + DataSourceMapper. The `create` path (line 53-66) invokes `dataSourceRepository.create(pojo)` (inherited from ReactiveAbstractCRUDRepository.java:103-106) → single INSERT, NOT through the UPSERT-by-ODDRN merge. The UI `create` does NOT pass through `prepareForUpdate`; if the operator manually creates a datasource whose ODDRN already exists, the partial unique index `data_source_oddrn_unique` (V0_0_31__add_deleted_at_field.sql:29) raises a Postgres SQLSTATE 23505 surfacing as `UniqueConstraintException`."
  - "DirectoryServiceImpl (DirectoryServiceImpl.java:97) — calls `findByPrefix(prefix)` for the 4-level Directory drill-down (P-01 Discovery feature). Used to enumerate datasources by ODDRN prefix (e.g. `//snowflake/...`). NO security filter applied — the result is the COMPLETE catalog of live datasources matching the prefix; this is the read-collaborative posture's substrate at the directory level."
  - "CollectorServiceImpl (CollectorServiceImpl.java:74) — calls `existsByCollector(id)` inside `delete(long id)` (line 73-79) as the cascade-delete guard. If ANY non-soft-deleted data_source row has `collector_id = id`, the delete is REJECTED with `CascadeDeleteException(\"Collector has associated data sources\")`. This is the hard contract on collector deletion."
  - "NamespaceServiceImpl (NamespaceServiceImpl.java:76) — calls `existsByNamespace(id)` inside `delete(long id)` (line 73-90) as one of FOUR cascade guards (alongside `collectorRepository.existsByNamespace`, `termRepository.existsByNamespace`, `dataEntityRepository.existsNonDeletedByNamespaceId`). Any non-soft-deleted datasource using the namespace blocks namespace deletion."
downstream_side_effects:
  - "db-read: every method issues a Postgres SELECT against `data_source` (the 13-column table — id, name, oddrn, description, active, connection_url [removed by V0_0_71], is_deleted [removed by V0_0_64], created_at, updated_at, pulling_interval, namespace_id [V0_0_11], token_id [V0_0_28], collector_id [V0_0_34], deleted_at [V0_0_31]). The DDL is in V0_0_1__init.sql:38-50, mutated by V0_0_11 (namespace_id FK), V0_0_18 (drops UNIQUE on name + oddrn), V0_0_28 (token_id FK), V0_0_31 (deleted_at + partial unique indexes), V0_0_34 (collector_id FK), V0_0_64 (drops is_deleted column), V0_0_71 (drops active + connection_url + pulling_interval columns), V0_0_75 (UTC default on timestamps)."
  - "db-read JOINs: every dto-returning method (getDto / listDto / getDtoByOddrn / getDtosByOddrns) issues a 2-LEFT-JOIN against NAMESPACE and TOKEN (lines 141-149) — namespace via `DATA_SOURCE.NAMESPACE_ID = NAMESPACE.ID`, token via `DATA_SOURCE.TOKEN_ID = TOKEN.ID`. NO `NAMESPACE.DELETED_AT IS NULL` predicate on the JOIN, NO `TOKEN.DELETED_AT IS NULL` predicate (TOKEN has no deleted_at column — `V0_0_28__add_token.sql`). Soft-deleted NAMESPACE rows joined into the result remain visible in the dto — a sibling bug to the batch-N (ReactiveRoleRepositoryImpl) and batch-H (ReactivePolicyRepositoryImpl) findings of `policy.deleted_at IS NULL` missing on join."
  - "db-write (UPSERT path): `bulkUpdate` (inherited @ReactiveTransactional from ReactiveAbstractCRUDRepository.java:128-142) issues per-partition `UPDATE data_source SET name = ?, description = ?, namespace_id = ?, collector_id = ?, token_id = ?, updated_at = NOW() WHERE id = ? AND deleted_at IS NULL RETURNING *` for matched ODDRNs. The columns the UPDATE actually changes depend on which fields were `changed()` on the jOOQ record — `prepareForUpdate` at DataSourceIngestionServiceImpl.java:86-88 only calls `.setName(...).setDescription(...)`, so on the JOOQ record only name + description are flagged 'changed' (the copy-construct from existing then explicit setters); jOOQ's `updateMany` (ReactiveAbstractCRUDRepository.java:203-223) builds the SET clause from `recordTable.fields()` MINUS `getNonUpdatableFields()` (id + created_at + deleted_at) — so the WRITE is `SET (all fields except id, created_at, deleted_at) = (existing-values + override name + description)`. The other fields are re-WRITTEN to their EXISTING values (no-op semantically — but the row is touched, `updated_at` advances)."
  - "db-write (CREATE path): `bulkCreate` (inherited @ReactiveTransactional from ReactiveAbstractCRUDRepository.java:113-126) issues per-partition `INSERT INTO data_source(id, name, oddrn, description, namespace_id, collector_id, token_id, created_at, updated_at, deleted_at) VALUES (?, ?, ...) RETURNING *`. On ODDRN conflict (a soft-deleted row exists with the same ODDRN whose `deleted_at IS NOT NULL`), the INSERT SUCCEEDS because the partial unique index `data_source_oddrn_unique` (V0_0_31__add_deleted_at_field.sql:29) EXCLUDES soft-deleted rows. This is the soft-delete-aware recreation pathway."
  - "db-write (UI-side CREATE only): `create(pojo)` (inherited from ReactiveAbstractCRUDRepository.java:103-106 — invokes `insertOne` at line 158-160) issues a single `INSERT INTO data_source ... RETURNING *` with NO `onDuplicateKey` clause. ODDRN collision with a LIVE row raises SQLSTATE 23505 → `UniqueConstraintException` (mapped via JooqReactiveOperations / ExceptionUtils.translateDatabaseException). This is the path triggered by `DataSourceController.createDataSource` (UI form-based create — DataSourceServiceImpl.java:53)."
  - "db-write (soft-delete): inherited `delete(long id)` (ReactiveAbstractSoftDeleteCRUDRepository.java:50-58) issues `UPDATE data_source SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL RETURNING *`. This is the canonical delete path — both UI (DataSourceServiceImpl.delete line 87-95) and any future ingestion-side delete (none exists today) flow through this. NO `DELETE FROM data_source` is anywhere in the source tree (verified by Grep)."
  - "FK side-effect: `data_source.id` is the parent of `data_entity.data_source_id` (V0_0_1__init.sql:82 `data_entity_fk_data_source FOREIGN KEY (data_source_id) REFERENCES data_source(id)` — NO `ON DELETE CASCADE`, NO `ON DELETE SET NULL`). Postgres default is `RESTRICT`/`NO ACTION` — a HARD-DELETE of `data_source` would fail with FK violation if data_entity rows reference it. Since the repository never hard-deletes (soft-delete only), this is moot in normal operation — but a manual `DELETE FROM data_source` by a DB admin would fail unless they cascade-cleanup data_entity first. DataSourceServiceImpl.delete line 87-95 enforces this at the service tier: `existsNonDeletedByDataSourceId(id)` → `CascadeDeleteException` if data_entity rows still attached."
  - "no-side-effect: NO Activity Event emission, NO Notification, NO Alert raised on datasource create / update / delete. NO audit log of WHO changed name/description on the UPSERT path (a collector's `bulkUpdate` overwrites operator-edited values with no trail per REFACTOR-423). The Datasources tab (P-08) is the post-registration audit surface — it shows the CURRENT row state, not a change history."
coherence_check:
  performed: true
  strengthens:
    - "F-008 (P-10:F-001 Batch Ingestion) `upsert_partial_merge_name_and_description_only` drift facet — SQL-tier PRIMARY-SOURCE confirmation of the batch-P controller-layer surface. The semantic claim 'only name + description propagate' is verified at the SQL layer: (a) the UPSERT pair lives at DataSourceIngestionServiceImpl.java:47-67 not in this repository (the repository merely provides the `getDtosByOddrns / bulkUpdate / bulkCreate` primitives the service composes); (b) the FIELD-list narrowing happens at the SERVICE-tier mapper `prepareForUpdate` (lines 74-92) not at this repository — meaning a service-bypassing caller invoking `dataSourceRepository.bulkUpdate(pojoList)` DIRECTLY could write ANY column on `data_source` (`bulkUpdate` writes ALL non-non-updatable fields per ReactiveAbstractCRUDRepository.java:203-223). The narrowing is a SERVICE-layer convention, NOT a REPOSITORY-layer enforcement. This is a STRENGTHENING refinement to ADR-CANDIDATE-142 — the partial-merge contract is one layer above the persistence."
    - "F-008 `namespace_inherited_from_collector_payload_silently_dropped` drift facet — SQL-tier confirmation. The `data_source.namespace_id` column is a nullable FK to `namespace.id` (V0_0_11__add_namespace_support.sql:1-2) with NO `ON DELETE` clause (Postgres default RESTRICT). The REPOSITORY never reads `namespace_name` from any input — the only namespace input it accepts is `namespace_id` (the joined NamespacePojo at lines 144-148). The service-tier choice (DataSourceIngestionServiceImpl.java:99-111) of which namespace_id to stamp is invisible to this repository — the repository merely WRITES whatever Long is set on `namespace_id`. So the silent-drop is GENUINELY a service-tier convention; the repository would faithfully persist a different namespace_id if the service supplied one."
    - "F-008 `single_transaction_per_batch_no_per_entity_isolation` drift facet — the inherited bulk methods (`bulkCreate`, `bulkUpdate` on ReactiveAbstractCRUDRepository.java:113, 129) are BOTH `@ReactiveTransactional`. A partial-batch failure (e.g. one INSERT fails due to a stale partial unique index race) rolls back ALL inserts and updates from the bulk call. Per-item failure mode CANNOT be reported back — the entire `createDataSources` flow either commits or rolls back. The repository ENFORCES this transactional posture; there's no opt-out at the persistence layer."
    - "REFACTOR-422 (silent-no-propagation) — strengthens the silent-no-propagation finding by adding the COUNTERFACTUAL evidence: the repository's `bulkUpdate` IS capable of writing connection_url / active / type (when those columns existed — they were dropped by V0_0_71 in 2024, but namespace_id / collector_id / token_id are still writable). The narrowing happens UPSTREAM at the service mapper. The doc-caveat surface at `developer-guides/build-and-run/custom-collectors` (WebFetched 2026-05-20 status 200, see docs_link_semantic) confirms doc-side silence on merge semantics."
    - "REFACTOR-423 (silent overwrite of operator UI edits) — strengthens the silent-overwrite finding with one more silent dimension: this repository has NO change-history capture (no `data_source_history` table, no JsonB diff column, no trigger writing into `activity_event`). Every operator-side edit through `DataSourceServiceImpl.update` is followed by `searchEntrypointRepository.updateChangedDataSourceVector(id)` (DataSourceServiceImpl.java:133) — the FTS vector IS updated, but no audit row is written. So a collector overwriting the operator's `name` not only succeeds silently but ALSO updates the FTS index to make the collector's name the search-discoverable one."
    - "REFACTOR-424 (silent namespace drop) — strengthens the silent-namespace-drop finding by confirming the SQL-tier semantics: `data_source.namespace_id` is the ONLY column on data_source that resolves namespace; there is NO `namespace_name` column on `data_source` (verified by reading V0_0_1__init.sql:38-50 + all subsequent ALTERs). The collector's namespace inheritance is the ONLY mechanism for stamping namespace on a data_source. The contract-side `namespace_name` field on the Ingestion API `DataSource` model has NO landing column."
  supersedes: []
  conflicts_surfaced:
    - "NEW finding (NOT in batch P controller sidecar): `listDto(page, size, nameQuery)` (lines 58-82) uses **`DATA_SOURCE.NAME.startsWithIgnoreCase(nameQuery)`** (private `queryCondition` at line 156) for the query, but the count branch (`fetchCount(nameQuery)` at line 80) calls the parent's `listCondition` (ReactiveAbstractCRUDRepository.java:236-249) which uses **`nameField.containsIgnoreCase(nameQuery)`** (line 243) — applied with the soft-delete base override (ReactiveAbstractSoftDeleteCRUDRepository.java:87-89). **The page returns rows whose name STARTS WITH the query; the count reports rows whose name CONTAINS the query.** For a catalog with datasources named 'snowflake-prod', 'my-snowflake-dev', the query 'snow' returns ONLY 'snowflake-prod' on the page, but the count reports BOTH (total = 2, hasNext = false because the page is the only one — but the page only shows 1). Pagination math is broken when `nameQuery` is non-null. Filed as REFACTOR-425. Severity: MEDIUM (UI surface — operators may not notice the discrepancy in a small catalog, but at >50 datasources the pagination is misleading)."
    - "NEW finding: the `data_source` table HAS a `name` column with NO partial-unique index in the current era (V0_0_18__pull_push_data_sources.sql:1-3 DROPPED `data_source_name_key`; V0_0_31__add_deleted_at_field.sql:27 RE-CREATED `data_source_name_unique ON data_source(name) WHERE deleted_at IS NULL`). So `name` IS unique-on-live-rows. This is NOT surfaced at the controller layer (batch P sidecar). An operator creating a datasource with a duplicate `name` via `POST /api/datasources` will see SQLSTATE 23505 → `UniqueConstraintException`. The collector-driven UPSERT pathway is shielded because the UPSERT matches by ODDRN (not by name), and `prepareForUpdate` overwrites name from payload — so a collector renaming a datasource to a name already used by ANOTHER datasource in the catalog would fail at the SQL layer mid-transaction, rolling back the entire `createDataSources` call. This is a SILENT FAILURE MODE: the operator gets a 500 with no clear indication that 'name collision with another datasource' was the cause. Severity: MEDIUM."
  back_links_emitted_to:
    - F-008
    - F-020
    - P-10:F-001
    - P-08:F-004
    - REFACTOR-422
    - REFACTOR-423
    - REFACTOR-424
    - REFACTOR-425  # NEW — count-vs-query predicate divergence
    - ADR-CANDIDATE-142
    - ADR-CANDIDATE-143
    - LSN-001
---

# ReactiveDataSourceRepositoryImpl — semantic understanding

## understanding

The persistence-layer bean owning every read and write to the `data_source` table — the JOIN-target row that every ingested `data_entity` (`data_entity.data_source_id` FK per `V0_0_1__init.sql:82`) hangs from, and the row the S2S authentication filter `IngestionDataSourceFilter` re-INSERTS / UPDATES whenever a Collector POSTs a `DataSourceList`. The implementation file is a 180-line shell (`ReactiveDataSourceRepositoryImpl.java:34-180`) that adds eight custom methods on top of the inherited soft-delete CRUD: three `dto`-returning reads with TOKEN + NAMESPACE joins (`getDto`, `listDto`, `getDtoByOddrn`), one `dto`-flux variant (`getDtosByOddrns` — the UPSERT-pair's resolution call), one for-update row-lock primitive (`getIdByOddrnForUpdate` — the ingestion-transaction's row-lock anchor at IngestionServiceImpl.java:68), two existence checks driving the cascade-delete guards on Collector and Namespace deletion (`existsByCollector`, `existsByNamespace`), and one prefix walker for the Directory drill-down (`findByPrefix`). Soft-delete semantics — `delete(id)` becomes `UPDATE … SET deleted_at = NOW()` and every read is auto-scoped to `WHERE deleted_at IS NULL` (`ReactiveAbstractSoftDeleteCRUDRepository.java:50-89`) — come entirely from the base class. The SQL-tier load-bearing invariants live in the DDL: the partial unique index `data_source_oddrn_unique ON data_source(oddrn) WHERE deleted_at IS NULL` (`V0_0_31__add_deleted_at_field.sql:29`) is what makes ODDRN-based identity stable across soft-deletes (a re-registered ODDRN after a soft-delete creates a NEW row, NOT an update of the soft-deleted one — because the partial unique index excludes the dead row); the partial unique index `data_source_name_unique ON data_source(name) WHERE deleted_at IS NULL` (same migration line 27) is the silent collision surface that can blow up a collector's bulk UPDATE if its payload renames a datasource to a name already used by another live row. The repository's "partial-merge upsert" contract that batch P (createDataSourceEntity) surfaces is NOT enforced HERE — it lives ONE LAYER up at `DataSourceIngestionServiceImpl.prepareForUpdate` (lines 74-92); the repository's inherited `bulkUpdate` (ReactiveAbstractCRUDRepository.java:128-142, 203-223) would faithfully write ANY non-non-updatable column the service passes in. A service-bypassing caller has FULL column-overwrite power. This SQL-tier evidence STRENGTHENS ADR-CANDIDATE-142: the partial-merge contract is a service-tier convention, not a persistence-tier enforcement; deciding to add a new field to the payload-driven set requires an explicit `prepareForUpdate` change, not a schema change.

## concepts

- entities: [DataSourcePojo (jOOQ-generated row record — id, name, oddrn, description, namespace_id, collector_id, token_id, created_at, updated_at, deleted_at; verified by reading V0_0_1__init.sql:38-50 + V0_0_11 + V0_0_28 + V0_0_31 + V0_0_34 + V0_0_64 + V0_0_71 migrations), DataSourceRecord (the typed jOOQ record), DataSourceDto (DataSourcePojo + NamespacePojo + TokenDto — the joined view returned by every `dto`-returning method), DATA_SOURCE (jOOQ Tables constant), NAMESPACE (joined for namespace metadata), TOKEN (joined for the API token presented by the collector — line 70, 145, 148), TokenPojo / TokenDto (the join result for the token slot — nullable on the dto if data_source.token_id is null), data_source_oddrn_unique (partial unique index — V0_0_31:29), data_source_name_unique (partial unique index — V0_0_31:27), data_entity FK (data_entity.data_source_id REFERENCES data_source(id) — V0_0_1:82, no ON DELETE), Page<DataSourceDto> (the paginated wrapper for listDto)]
- operations:
  - "getDto(id) (lines 49-55): SELECT data_source.* + namespace.* + token.* FROM data_source LEFT JOIN namespace ON namespace.id = data_source.namespace_id LEFT JOIN token ON token.id = data_source.token_id WHERE data_source.id = ? AND data_source.deleted_at IS NULL — returns Mono<DataSourceDto>"
  - "listDto(page, size, nameQuery) (lines 58-82): paginated CTE — first selects `data_source_cte` filtered by private `queryCondition(nameQuery)` (deleted_at IS NULL + optional `DATA_SOURCE.NAME.startsWithIgnoreCase`), paginates with `jooqQueryHelper.paginate(... (page-1)*size, size)`, THEN LEFT JOINs NAMESPACE + TOKEN. The count branch (`fetchCount(nameQuery)` at line 80) goes through the INHERITED count path (ReactiveAbstractCRUDRepository.java:225-234) which uses `nameField.containsIgnoreCase` — divergent from the page query (see implicit_adrs / coherence_check.conflicts_surfaced)."
  - "getDtoByOddrn(oddrn) (lines 85-91): SELECT … WHERE data_source.oddrn = ? AND data_source.deleted_at IS NULL — Mono<DataSourceDto>. Soft-deleted rows invisible."
  - "getIdByOddrnForUpdate(oddrn) (lines 94-101): SELECT data_source.id FROM data_source WHERE oddrn = ? AND deleted_at IS NULL FOR UPDATE — Mono<Long>. **The Postgres row-level lock primitive** used by IngestionServiceImpl.java:68 to serialise ingestion against concurrent UI deletes / collector re-registrations of the SAME datasource. Holds the row lock until the surrounding `@ReactiveTransactional` commits."
  - "getDtosByOddrns(oddrns: List<String>) (lines 104-110): SELECT … WHERE data_source.oddrn IN (?, ?, …) AND data_source.deleted_at IS NULL — Flux<DataSourceDto>. The UPSERT-pair's resolution call (DataSourceIngestionServiceImpl.java:47)."
  - "existsByNamespace(namespaceId) (lines 113-121): SELECT EXISTS(SELECT 1 FROM data_source WHERE namespace_id = ? AND deleted_at IS NULL) — Mono<Boolean>. Cascade-delete guard for namespace deletion (NamespaceServiceImpl.java:76)."
  - "existsByCollector(collectorId) (lines 124-132): SELECT EXISTS(SELECT 1 FROM data_source WHERE collector_id = ? AND deleted_at IS NULL) — Mono<Boolean>. Cascade-delete guard for collector deletion (CollectorServiceImpl.java:74)."
  - "findByPrefix(prefix) (lines 135-139): SELECT * FROM data_source WHERE oddrn LIKE 'prefix%' AND deleted_at IS NULL — Flux<DataSourcePojo>. Directory feature (DirectoryServiceImpl.java:97)."
  - "inherited create (INSERT INTO data_source(name, oddrn, description, namespace_id, collector_id, token_id, created_at, updated_at) VALUES (?, ?, …, NOW(), NOW()) RETURNING * — ReactiveAbstractCRUDRepository.java:103-106; ODDRN collision → SQLSTATE 23505 → UniqueConstraintException)"
  - "inherited update (UPDATE data_source SET … WHERE id = ? AND deleted_at IS NULL RETURNING * — ReactiveAbstractCRUDRepository.java:107-110 + ReactiveAbstractSoftDeleteCRUDRepository.java:77-79; soft-delete-filter inherited)"
  - "inherited bulkCreate (per-partition INSERT … RETURNING — ReactiveAbstractCRUDRepository.java:113-126 + insertManyReturning at 175-185; @ReactiveTransactional)"
  - "inherited bulkUpdate (per-partition UPDATE FROM table-of-values pattern — ReactiveAbstractCRUDRepository.java:128-142 + updateMany at 203-223; @ReactiveTransactional; **writes ALL non-non-updatable columns from the supplied records** — the partial-merge narrowing is a SERVICE-TIER concern, not enforced here)"
  - "inherited delete (UPDATE data_source SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL RETURNING * — soft-delete via ReactiveAbstractSoftDeleteCRUDRepository.java:50-58)"
- invariants:
  - "Every read auto-scopes to `deleted_at IS NULL` via the soft-delete base override (ReactiveAbstractSoftDeleteCRUDRepository.java:77-89) for inherited paths AND via explicit `.and(DATA_SOURCE.DELETED_AT.isNull())` predicates on the custom methods (lines 52, 88, 97 [via addSoftDeleteFilter], 107, 116, 128, 137, 154). The pattern is consistent — soft-deleted datasources are universally invisible to defined read paths."
  - "The `data_source.oddrn` column is unique-on-live-rows via the partial unique index `data_source_oddrn_unique ON data_source(oddrn) WHERE deleted_at IS NULL` (V0_0_31__add_deleted_at_field.sql:29). A live row's ODDRN cannot collide; a soft-deleted row with the same ODDRN is EXCLUDED from the uniqueness constraint, enabling soft-delete-aware recreation. This is the SQL-tier identity invariant that the entire collector-side `createDataSources` upsert flow depends on."
  - "The `data_source.name` column ALSO has a partial unique index `data_source_name_unique ON data_source(name) WHERE deleted_at IS NULL` (V0_0_31:27). The constraint was DROPPED then RE-CREATED — V0_0_18__pull_push_data_sources.sql:1-3 dropped `data_source_name_key`; V0_0_31:27 re-established uniqueness ONLY on live rows. **Implication**: a collector UPSERTing a datasource that renames an existing row to a name held by another LIVE row fails with SQLSTATE 23505 mid-transaction — this rolls back the entire `bulkUpdate` AND the paired `bulkCreate`. No partial commit. The operator sees a 500 with the underlying message; no `name collision` distinction at the UI."
  - "**The partial-merge contract on UPSERT is NOT enforced at this repository.** `bulkUpdate` (inherited at ReactiveAbstractCRUDRepository.java:128-142 → updateMany at 203-223) builds the SET clause from `recordTable.fields()` MINUS `getNonUpdatableFields()` (id, created_at, deleted_at per ReactiveAbstractSoftDeleteCRUDRepository.java:113-117). Every other column (name, oddrn, description, namespace_id, collector_id, token_id, updated_at) is in the SET clause. The narrowing to ONLY name + description is enforced by `DataSourceIngestionServiceImpl.prepareForUpdate` (lines 74-92) which `new DataSourcePojo(a).setName(i.getName()).setDescription(i.getDescription())` — copying the existing pojo then overriding ONLY two fields. **The narrowing lives at the SERVICE tier; the repository would faithfully overwrite ANY non-non-updatable column the service supplied.** This is the load-bearing refinement to ADR-CANDIDATE-142."
  - "**The cross-collector preservation is also NOT enforced at this repository.** `prepareForUpdate` does NOT touch `collector_id` (the new pojo is a copy of the EXISTING pojo, which retains the original `collector_id`). So if collector A originally registered ODDRN X, and collector B's payload contains ODDRN X, the existing `collector_id` is preserved (from the copy-construct), and `bulkUpdate` does NOT overwrite it (because the service supplied the existing value). HOWEVER: if a service-bypassing caller DIRECTLY invoked `dataSourceRepository.bulkUpdate(List.of(pojoWithCollectorB))`, the `collector_id` WOULD be overwritten. The cross-collector protection is a SERVICE-tier convention enforced via the `prepareForUpdate` copy-construct shape."
  - "`getIdByOddrnForUpdate(oddrn)` (lines 94-101) uses `forUpdate()` — a SQL-tier `SELECT … FOR UPDATE` row lock held until the surrounding `@ReactiveTransactional` commits or rolls back. This serialises ingestion against concurrent UI deletes of the same datasource AND against concurrent collector re-registrations of the same datasource. Without this lock, the IngestionService's downstream `persistDataEntities` flow could be racing the operator's delete or the collector's UPSERT for the same data_source_id."
  - "`listDto` page query and count query use **DIFFERENT predicates** on `nameQuery`: page uses `DATA_SOURCE.NAME.startsWithIgnoreCase(nameQuery)` (private `queryCondition` line 156); count uses the inherited base `nameField.containsIgnoreCase(nameQuery)` (ReactiveAbstractCRUDRepository.java:243). For `nameQuery = 'snow'` against a catalog with `['snowflake-prod', 'my-snowflake-dev']`, the page returns ONE row, the count reports TWO. Pagination math is broken for non-null nameQuery. (See REFACTOR-425.)"
  - "**Three soft-delete mechanisms across the schema** — observed at this repository through `deleted_at` column on data_source / namespace / token. The platform's soft-delete history: V0_0_1 introduced `is_deleted boolean DEFAULT FALSE`; V0_0_31 added `deleted_at TIMESTAMP DEFAULT NULL` PARALLEL to is_deleted; V0_0_64 DROPPED `is_deleted` and converged on `deleted_at IS NULL` as the canonical filter. The TOKEN table has NO `deleted_at` column (V0_0_28__add_token.sql) — tokens are NEVER soft-deleted; they ARE rotated (DataSourceServiceImpl.regenerateDataSourceToken line 99-106 generates a new token and `tokenRepository.updateToken`-s in place). Implication: a re-generated token loses the OLD token value irrecoverably; there is no grace period."
- audiences: [DataSourceIngestionServiceImpl (the UPSERT pair invoker), IngestionServiceImpl (the row-lock acquirer for entity ingestion), DataSourceServiceImpl (UI-side CRUD), CollectorServiceImpl (cascade-delete guard), NamespaceServiceImpl (cascade-delete guard), DirectoryServiceImpl (prefix walker for Directory P-01), database operators investigating data_source rows directly, schema-migration authors (Flyway V0_0_NN__*.sql files)]

## dependencies_semantic

- requires-feature:
  - "ReactiveAbstractSoftDeleteCRUDRepository (ReactiveDataSourceRepositoryImpl.java:36 — direct base; the entire delete / soft-delete-filter / non-updatable-fields surface lives in the base)."
  - "ReactiveAbstractCRUDRepository (the grandparent — defines create / update / get / list / bulkCreate / bulkUpdate, the pojoToRecord / recordToPojo / insertOne / updateOne plumbing, the @ReactiveTransactional gate on bulk paths, the listCondition / fetchCount / idCondition helpers, the per-partition execution via JooqReactiveOperations.executeInPartitionReturning at lines 175-185, 203-223)."
  - "JooqReactiveOperations bean (constructor param at line 41 — wrapper around R2DBC `DatabaseClient.inConnection` that runs every jOOQ query through R2DBC and maps DataAccessException → ExceptionWithErrorCode via ExceptionUtils.translateDatabaseException, including the SQLSTATE 23505 → UniqueConstraintException translation for `data_source_oddrn_unique` and `data_source_name_unique` collisions)."
  - "JooqQueryHelper bean (constructor param at line 42 — supplies `paginate(...)` for listDto's CTE (line 62) and `selectExists(...)` for the exists checks (lines 114, 125), AND `pageifyResult` for the listDto count-and-data combination (line 77))."
  - "JooqRecordHelper bean (constructor param at line 43 — supplies `extractRelation(record, NAMESPACE, NamespacePojo.class)` and `extractRelation(record, TOKEN, TokenPojo.class)` (lines 163, 166, 172, 176) for unpacking the LEFT-JOINed rows AND `remapCte(record, dataSourceCteName, DATA_SOURCE)` (line 165) for renaming the CTE's columns back to canonical DATA_SOURCE.* shape)."
  - "jOOQ-generated `model.tables.DATA_SOURCE`, `model.tables.NAMESPACE`, `model.tables.TOKEN` constants (static imports at lines 30-32). Produced at build time from the Flyway-migrated PostgreSQL schema by the jOOQ codegen plugin."
- requires-config:
  - "No `@Value` reads, no `@ConfigurationProperties`, no `spring.datasource.*` inline lookups. Bean behaviour is configured exclusively through DI of JooqReactiveOperations (whose own DatabaseClient is configured by Spring R2DBC autoconfiguration: `spring.r2dbc.url`, `spring.r2dbc.username`, `spring.r2dbc.password` at the application level)."
  - "Flyway migrations must have executed at boot for jOOQ codegen to have produced the DATA_SOURCE / NAMESPACE / TOKEN constants. The load-bearing migrations: V0_0_1__init.sql (initial table + data_entity FK), V0_0_11__add_namespace_support.sql (namespace_id FK), V0_0_18__pull_push_data_sources.sql (dropped UNIQUE constraints), V0_0_26__remove_length_constraints.sql (varchar → varchar widening), V0_0_28__add_token.sql (token_id FK), V0_0_31__add_deleted_at_field.sql (deleted_at column + partial unique indexes on oddrn AND name), V0_0_34__add_collector_to_data_source.sql (collector_id FK), V0_0_64__remove_is_deleted_field.sql (drops is_deleted column), V0_0_71__datasource_refactor.sql (drops active + connection_url + pulling_interval), V0_0_75__utc_timezone.sql (UTC defaults on timestamps)."
- requires-runtime:
  - "Spring WebFlux (reactive Mono / Flux pipeline)."
  - "Reactor Core (Mono.just, .map, .flatMap, .collectList)."
  - "jOOQ-on-R2DBC (DSL.select / .from / .leftJoin / .where / .forUpdate / DSL.with translated to parameterised R2DBC SQL execution)."
  - "PostgreSQL with the `data_source`, `namespace`, `token`, `data_entity`, `collector` tables present and the `data_source_oddrn_unique` / `data_source_name_unique` partial indexes in place. The `selectExists` helper assumes the Postgres `EXISTS` predicate; the `selectForUpdate()` call assumes Postgres row-level locking semantics."
- coupling:
  - "Strong coupling to the soft-delete base class — changing the column name (`deleted_at`) or replacing the soft-delete pattern with hard-delete would silently break the partial unique indexes' assumption that `WHERE deleted_at IS NULL` is the canonical 'liveness' predicate. The ENTIRE collector-side re-registration semantic (ODDRN reuse after soft-delete) depends on this column name being stable."
  - "Tight coupling to `DataSourceIngestionServiceImpl.prepareForUpdate` as the SOLE upstream guarantor of the partial-merge contract: the repository's inherited `bulkUpdate` writes ALL non-non-updatable columns. If a NEW field is added to `data_source` (a hypothetical V0_NN migration), the `prepareForUpdate` mapper MUST be updated to either propagate it from payload OR explicitly preserve it; otherwise the repository's `bulkUpdate` will write whatever the jOOQ record's default value is (Java `null` for object types) — silently NULLing-out the existing value. **There is no schema-tier or repository-tier safeguard** against this drift."
  - "Coupling to the partial unique indexes' soft-delete-awareness: BOTH `data_source_oddrn_unique` and `data_source_name_unique` use the `WHERE deleted_at IS NULL` predicate. The repository's read methods all filter `deleted_at IS NULL`, so they see the SAME live-row set the unique indexes enforce — there is no read/write asymmetry. HOWEVER: a future migration that REMOVED the partial predicate (e.g. switching to globally-unique oddrn even across deleted rows) would break the soft-delete-aware recreation pathway. Maintainers changing the index definition MUST also change the soft-delete pattern in lockstep."
  - "Coupling to the AUTHORIZATION-FREE READ PATH: `findByPrefix`, `getDto`, `listDto`, `getDtoByOddrn`, `getDtosByOddrns`, `existsByCollector`, `existsByNamespace` ALL execute with NO security context check at this layer. The platform's read-collaborative posture (every authenticated user can enumerate the entire catalog) is reflected here — any service-tier caller can read ANY datasource. There's no per-owner scoping, no ODDRN-prefix authorization gate. This is the SAME pattern as the rest of the repositories under the read-collaborative posture (concept catalog: `read-collaborative-posture-every-authenticated-user-enumerates-the-catalog`)."
  - "Coupling via `data_entity.data_source_id` FK with NO `ON DELETE` clause (V0_0_1__init.sql:82): a hard DELETE of data_source would fail with FK violation if data_entity rows reference it. Since the repository never hard-deletes (soft-delete only), this is operationally moot — but the structural coupling is REAL: a maintainer who later adds a `hardDelete(id)` method MUST cascade-cleanup data_entity first (or add `ON DELETE CASCADE` to the FK)."

## tests_coverage_semantic

- covered_behaviours:
  - "create + getDto (id) round-trip with namespace + token attached"
    test_class: "DataSourceRepositoryImplTest"
    file_line: "src/test/java/.../repository/DataSourceRepositoryImplTest.java:36-59"
  - "create + getDto (id) round-trip WITHOUT namespace (null namespace_id)"
    test_class: "DataSourceRepositoryImplTest"
    file_line: "src/test/java/.../repository/DataSourceRepositoryImplTest.java:61-81"
  - "listDto pagination across multiple datasources with mixed namespace attachments"
    test_class: "DataSourceRepositoryImplTest"
    file_line: "src/test/java/.../repository/DataSourceRepositoryImplTest.java:83-160 (approximately)"
  - "getDtoByOddrn returns the live row; getDtoByOddrn after delete returns Mono.empty"
    test_class: "DataSourceRepositoryImplTest"
    file_line: "src/test/java/.../repository/DataSourceRepositoryImplTest.java:200-211 (approximately)"
  - "getDtosByOddrns returns multiple rows by ODDRN list"
    test_class: "DataSourceRepositoryImplTest"
    file_line: "src/test/java/.../repository/DataSourceRepositoryImplTest.java:213-250"
  - "existsByNamespace returns true if any live datasource uses the namespace, false otherwise; soft-deleted datasource does NOT count"
    test_class: "DataSourceRepositoryImplTest"
    file_line: "src/test/java/.../repository/DataSourceRepositoryImplTest.java:252-279"
  - "UPSERT-pair (createDataSources) service-tier integration — 6-case parameterized: empty payload + new ODDRN + existing ODDRN + mixed payload + empty payload with existing mock + empty payload with empty mock"
    test_class: "DataSourceIngestionServiceTest"
    file_line: "src/test/java/.../service/DataSourceIngestionServiceTest.java:72-125"
- uncovered_behaviours:
  - "getIdByOddrnForUpdate returns the row-locked id; concurrent calls from a SECOND transaction BLOCK until the first transaction commits (the SELECT … FOR UPDATE row-lock semantic). Pin the lock acquisition behaviour with an integration test using two test transactions racing."
    test_class: "ReactiveDataSourceRepositoryImplTest (new)"
  - "getIdByOddrnForUpdate on a soft-deleted ODDRN returns Mono.empty (the soft-delete filter at line 97 excludes the row)."
    test_class: "ReactiveDataSourceRepositoryImplTest (new)"
  - "findByPrefix returns datasources whose ODDRN starts with the given prefix; excludes soft-deleted; case-sensitive match (verify the SQL emission)."
    test_class: "ReactiveDataSourceRepositoryImplTest (new)"
  - "existsByCollector returns true for live datasources on the collector, false after they are all soft-deleted. **This is the load-bearing guard for the CollectorServiceImpl.delete cascade check.**"
    test_class: "ReactiveDataSourceRepositoryImplTest (new)"
  - "listDto with `nameQuery` non-null — pin the **divergence between page and count predicates** (page uses startsWithIgnoreCase, count uses containsIgnoreCase). Test case: create three datasources `['snowflake-prod', 'my-snowflake-dev', 'redshift-prod']`; query with `nameQuery='snow'`; assert page.data.size == 1 (only 'snowflake-prod' starts with 'snow') AND page.total == 2 (both contain 'snow'). This pins the bug; the test should FAIL with REFACTOR-425 fixed (changing one to match the other)."
    test_class: "ReactiveDataSourceRepositoryImplTest (new)"
  - "create with a name colliding against a LIVE row raises `UniqueConstraintException` via the `data_source_name_unique` partial index. NO existing test pins the UNIQUE name constraint at the repository layer."
    test_class: "ReactiveDataSourceRepositoryImplTest (new)"
  - "create with an ODDRN colliding against a LIVE row raises `UniqueConstraintException` via `data_source_oddrn_unique`. NO existing test pins the UNIQUE ODDRN constraint at the repository layer."
    test_class: "ReactiveDataSourceRepositoryImplTest (new)"
  - "create with an ODDRN colliding against a SOFT-DELETED row SUCCEEDS (the partial unique index excludes the dead row). **This is the soft-delete-aware recreation invariant.**"
    test_class: "ReactiveDataSourceRepositoryImplTest (new)"
  - "delete(id) sets deleted_at = NOW(); subsequent getDto(id) returns Mono.empty; subsequent getDtoByOddrn(same-oddrn) returns Mono.empty."
    test_class: "ReactiveDataSourceRepositoryImplTest (new)"
  - "bulkUpdate writes ALL non-non-updatable columns — pin the SQL-tier behaviour that contradicts the service-tier partial-merge contract. A test calling `dataSourceRepository.bulkUpdate(List.of(pojoWithChangedCollectorId))` SHOULD overwrite collector_id; this verifies the partial-merge is a SERVICE-tier guard, not a repository guard."
    test_class: "ReactiveDataSourceRepositoryImplTest (new)"
  - "soft-deleted NAMESPACE joined via getDto leaks into the dto (no `NAMESPACE.DELETED_AT IS NULL` predicate at lines 144-148). Mirror of batch-N (Role) and batch-H (Policy) findings."
    test_class: "ReactiveDataSourceRepositoryImplTest (new)"
- test_files:
  - "src/test/java/.../repository/DataSourceRepositoryImplTest.java"
  - "src/test/java/.../service/DataSourceIngestionServiceTest.java"
- gaps: |
    A new dedicated `ReactiveDataSourceRepositoryImplTest` integration-test class would carry the lock-acquisition, partial-merge-at-repository-tier, predicate-divergence, soft-deleted-namespace-leak, and partial-unique-index recreation tests. The current `DataSourceRepositoryImplTest` (260+ lines) covers the happy-path read/write/delete round-trips but does NOT pin:
    - the row-lock semantic on `getIdByOddrnForUpdate` (the most operationally-load-bearing behaviour);
    - the partial-merge being a SERVICE-tier guard not a repository-tier guard;
    - the listDto predicate divergence (REFACTOR-425);
    - the partial-unique-index recreation pathway;
    - the soft-deleted namespace JOIN leak.
    A regression most likely to land: someone changes `prepareForUpdate` to add a new field to the propagation list, and inadvertently breaks the cross-collector preservation (if the new field happens to be `collector_id`). The current test suite would NOT catch this.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/developer-guides/build-and-run/custom-collectors"
    anchor: ""
    rationale: "The canonical docs page that custom-collector authors land on; the page tells authors HOW to register datasources but is silent on the merge semantics. WebFetched in this session — see fetched_excerpts below."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    confidence: LOW  # inferred not declared
    fetched_excerpts: |
      The custom-collectors doc page confirms ODDRN identity but is SILENT on the merge semantics:
      Quote (verified verbatim via WebFetch 2026-05-20):
        "ODDRNs are how the platform recognises the same entity across ingests, across collectors, and over time; getting them right is what makes cross-system lineage possible."
      The WebFetch summary for the four specific dimensions probed:
      - UPSERT or merge semantics on re-registration: SILENT.
      - Field propagation caveats (payload vs operator-only): SILENT.
      - Cross-collector ownership / collector_id preservation: SILENT.
      The doc page focuses on GENERATING correct ODDRNs for identity consistency but does not specify the platform's registration/update behavior, payload field semantics, or multi-collector ownership rules.
- doc_drift_findings:
  - "The custom-collectors doc page (WebFetched 2026-05-20 status 200) is SILENT on the UPSERT-by-ODDRN partial-merge semantic, the silent-namespace-drop semantic, AND the cross-collector preservation of `collector_id`. All three are operator-relevant invariants enforced (one at the service tier, one at the schema tier) but unwritten. The doc-drift is identical to the batch-P controller sidecar's finding — this repository sidecar adds the SQL-tier primary-source confirmation that the absence is genuinely silent (no admonition block, no warning, no caveat). Severity: MEDIUM — affects every custom-collector author."
  - "No doc page exists at `https://docs.opendatadiscovery.org/...` describing the partial unique index `data_source_oddrn_unique WHERE deleted_at IS NULL` or the soft-delete-aware recreation invariant. Maintainers debugging a 'why does my re-registered ODDRN appear as a new row, not an update of the old soft-deleted one' question have NO doc to land on. This is a SQL-tier invariant the platform depends on for soft-delete recreation across the catalog (mirrors batch-E `Administrator`-name asymmetry on role). Severity: LOW (operator-internal — most operators never inspect the schema directly)."

## implicit_adrs

- "**Partial-merge UPSERT contract is a SERVICE-tier convention, NOT a REPOSITORY-tier enforcement** — the repository's inherited `bulkUpdate` (ReactiveAbstractCRUDRepository.java:128-142 → updateMany at 203-223) writes ALL non-non-updatable columns from the supplied records. The narrowing to ONLY name + description lives at `DataSourceIngestionServiceImpl.prepareForUpdate` (lines 74-92) via the copy-construct-then-setter pattern `new DataSourcePojo(a).setName(...).setDescription(...)`. The intent is visible in the SHAPE of the service-tier mapper: a maintainer adding a new payload-driven field MUST add it to `prepareForUpdate`; the repository would faithfully propagate it. — evidence: ReactiveDataSourceRepositoryImpl.java:34-180 (no narrowing logic here) + ReactiveAbstractCRUDRepository.java:128-142, 203-223 (bulkUpdate writes ALL fields) + DataSourceIngestionServiceImpl.java:74-92 (the narrowing). — intent_anchor: \"`new DataSourcePojo(a).setName(i.getName()).setDescription(i.getDescription())` — the COPY-CONSTRUCT from EXISTING is the deliberate signal of 'only these two fields are payload-driven; everything else is operator-owned.'\" — confidence: HIGH. STRENGTHENS ADR-CANDIDATE-142."
- "**ODDRN identity is partial-unique-index-enforced; soft-delete enables ODDRN reuse** — the partial unique index `data_source_oddrn_unique ON data_source(oddrn) WHERE deleted_at IS NULL` (V0_0_31__add_deleted_at_field.sql:29) is the SQL-tier mechanism for 'ODDRN is the stable identity for a datasource across re-registrations, but a soft-deleted datasource's ODDRN can be reused by a NEW row'. This is the structural mirror of the batch-N (Role) and batch-H (Policy) findings — the soft-delete-aware recreation pattern is consistent across the platform. — evidence: V0_0_31__add_deleted_at_field.sql:29 (partial unique index) + ReactiveDataSourceRepositoryImpl.java:104-110 (getDtosByOddrns filters deleted_at IS NULL) + DataSourceIngestionServiceImpl.java:79-83 (prepareForUpdate matches live rows by ODDRN). — intent_anchor: \"`CREATE UNIQUE INDEX IF NOT EXISTS data_source_oddrn_unique ON data_source (oddrn) WHERE deleted_at IS NULL;`\" — confidence: HIGH. NEW implicit ADR; promote to `adrs/drafts/oddrn-partial-unique-soft-delete-recreation.md`."
- "**`getIdByOddrnForUpdate` uses Postgres row-level lock to serialise ingestion** — the only `forUpdate()` call in the entire repository layer for the data_source table. The Postgres `SELECT … FOR UPDATE` row-lock is held until the surrounding `@ReactiveTransactional` commits, serialising IngestionServiceImpl's `persistDataEntities` flow (IngestionServiceImpl.java:65-74) against concurrent UI deletes / collector re-registrations of the same datasource. The choice of row-lock (vs optimistic concurrency, vs advisory lock, vs no lock) is deliberate — visible in the explicit `.forUpdate()` call. — evidence: ReactiveDataSourceRepositoryImpl.java:94-101 + IngestionServiceImpl.java:65-74 (the only caller). — intent_anchor: \"`final SelectForUpdateOfStep<Record1<Long>> query = DSL.select(DATA_SOURCE.ID).from(DATA_SOURCE).where(addSoftDeleteFilter(DATA_SOURCE.ODDRN.eq(oddrn))).forUpdate();`\" — confidence: HIGH."
- "**Cascade-delete guards live at the SERVICE tier, enforced via existence checks on this repository** — `existsByCollector` (lines 124-132) for collector deletion (CollectorServiceImpl.java:74), `existsByNamespace` (lines 113-121) for namespace deletion (NamespaceServiceImpl.java:76). The repository PROVIDES the primitive (an EXISTS check); the SERVICE composes it into the guard. This is the deliberate split: cascade-delete is a BUSINESS-LOGIC concern (the service decides what blocks what), not a SCHEMA concern (the FKs have NO `ON DELETE` clauses — V0_0_29__add_collector.sql for collector.namespace_id, V0_0_34__add_collector_to_data_source.sql for data_source.collector_id). — evidence: ReactiveDataSourceRepositoryImpl.java:113-132 (the exists checks) + CollectorServiceImpl.java:73-79 (the cascade-delete consumer) + NamespaceServiceImpl.java:73-90 (the multi-cascade consumer) + V0_0_34 (FK without ON DELETE). — intent_anchor: \"`return dataSourceRepository.existsByCollector(id).filter(exists -> !exists).switchIfEmpty(Mono.error(new CascadeDeleteException(\\\"Collector has associated data sources\\\")))`\" — confidence: HIGH."

## bugs_limitations_corner_cases

- "**`listDto` pagination is mathematically inconsistent on non-null nameQuery** — the page query uses `DATA_SOURCE.NAME.startsWithIgnoreCase(nameQuery)` (private `queryCondition` at line 156), but the count branch goes through the inherited base `listCondition` (ReactiveAbstractCRUDRepository.java:243) which uses `nameField.containsIgnoreCase(nameQuery)`. For a catalog containing `['snowflake-prod', 'my-snowflake-dev']` and `nameQuery='snow'`: page returns `['snowflake-prod']` (1 row, the one starting with 'snow'); count returns `2` (both contain 'snow'). The UI's pagination total is wrong. Severity: MEDIUM (UI surface — operators with a small catalog won't notice, larger catalogs degrade noticeably). Filed as REFACTOR-425." — evidence: ReactiveDataSourceRepositoryImpl.java:58-82 + 151-160 + ReactiveAbstractCRUDRepository.java:225-249 — severity: MEDIUM
- "**`data_source.name` collisions across LIVE rows are a silent failure mode for collector UPSERTs** — the partial unique index `data_source_name_unique ON data_source(name) WHERE deleted_at IS NULL` (V0_0_31:27) means a collector's `prepareForUpdate` overwriting `name = 'foo'` when ANOTHER live datasource already has name 'foo' raises SQLSTATE 23505, which rolls back the ENTIRE `bulkUpdate` AND the paired `bulkCreate` (both inside the same `@ReactiveTransactional`). The operator sees HTTP 500; there's no distinction between 'name collision' and 'server crashed'. No log call explains the rollback root-cause." — evidence: V0_0_31__add_deleted_at_field.sql:27 + ReactiveAbstractCRUDRepository.java:128-142 (transactional bulkUpdate) + DataSourceIngestionServiceImpl.java:40 (@ReactiveTransactional on createDataSources) — severity: MEDIUM
- "**Soft-deleted NAMESPACE rows leak into the DataSourceDto** — every dto-returning method (`getDto`, `listDto`, `getDtoByOddrn`, `getDtosByOddrns`) issues a `LEFT JOIN NAMESPACE ON NAMESPACE.ID = DATA_SOURCE.NAMESPACE_ID` (lines 147, 72) with NO `NAMESPACE.DELETED_AT IS NULL` predicate. If an operator soft-deletes a namespace (which would normally be blocked by NamespaceServiceImpl.delete's cascade guard — but suppose a future migration bypasses the guard, OR an admin runs raw SQL), the soft-deleted namespace's data still surfaces in the dto. Mirror of batch-N (Role / Policy) and batch-H findings. Severity: LOW (cascade-delete guard prevents the prerequisite condition in normal operation; HIGH if the prerequisite leaks)." — evidence: ReactiveDataSourceRepositoryImpl.java:144-148 + ReactiveDataSourceRepositoryImpl.java:72 — severity: LOW
- "**Token regeneration has NO grace period — old token instantly 401s on every endpoint** — `DataSourceServiceImpl.regenerateDataSourceToken` (line 99-106) calls `tokenGenerator.regenerateToken(dto.token().tokenPojo())` then `tokenRepository.updateToken(...)`. The TOKEN row's `value` column is UPDATED IN PLACE. The OLD token is gone from the database; any collector still using the old token will 401 on its next `POST /ingestion/datasources` or `POST /ingestion/entities` (per IngestionDataSourceFilter and IngestionDataEntitiesFilter, batch O+P sidecars). NO grace period. NO 'old + new both work for N hours'. NO UI warning before rotation. Severity: MEDIUM (operational — a collector restart is needed at the same moment as a token rotation; if the new token isn't deployed to the collector before the collector's next call, ingestion stops)." — evidence: DataSourceServiceImpl.java:99-106 + V0_0_28__add_token.sql (no deleted_at on token, no grace-period column) — severity: MEDIUM
- "**`findByPrefix` does NO authorization check** — DirectoryServiceImpl.java:97 invokes `dataSourceRepository.findByPrefix(prefix)` and returns the COMPLETE matching set to whoever calls (per the read-collaborative posture). Any authenticated user navigating the Directory feature sees every datasource matching their prefix walk. Severity: LOW (this is the platform's documented posture; concept catalog has `read-collaborative-posture` as an explicit invariant)." — evidence: ReactiveDataSourceRepositoryImpl.java:135-139 + DirectoryServiceImpl.java:97 — severity: LOW
- "**The hard-coded `data_source_cte` name on listDto (line 64) is a leaky abstraction risk** — the CTE name is a string literal. A future maintainer copying this pattern for another repository must remember to change the CTE name; otherwise a nested CTE collision could shadow the outer query (jOOQ does not statically enforce CTE name uniqueness). Severity: LOW (single use today; no nested CTE pattern is in active use)." — evidence: ReactiveDataSourceRepositoryImpl.java:64 — severity: LOW
- "**No method to recover a soft-deleted datasource** — once `deleted_at` is set, the datasource is invisible to every read method; the only way to 'recover' it is direct SQL (`UPDATE data_source SET deleted_at = NULL WHERE id = ?`). There is no UI affordance, no service method, no repository method. The collector re-registering the SAME ODDRN gets a NEW row (because of the partial unique index excluding the dead row), NOT a recovery of the old row. All historical data_entity rows attached to the OLD data_source_id are now orphaned (FK still points to the soft-deleted row). Severity: MEDIUM (data-recovery operational hazard)." — evidence: ReactiveDataSourceRepositoryImpl.java (no recover method) + V0_0_1__init.sql:82 (data_entity FK without ON DELETE) — severity: MEDIUM

## security

- auth_mode_relevance: INTERNAL_ONLY
  notes: |
    The repository is NOT on the HTTP surface — auth modes don't apply directly.
    The repository's behaviour is identical regardless of DISABLED / LOGIN_FORM /
    OAUTH2 / LDAP — the auth check happens at the HTTP layer (DataSourceController
    for `/api/datasources/*`, IngestionController + IngestionDataSourceFilter for
    `POST /ingestion/datasources`).
- ingestion_filter_relevance: |
    INDIRECT — the repository is called from the ingestion pipeline (via
    DataSourceIngestionServiceImpl.createDataSources → repository.bulkUpdate /
    bulkCreate AND via IngestionServiceImpl.ingest → repository.getIdByOddrnForUpdate).
    The S2S auth gating happens at the SIBLING filter `IngestionDataSourceFilter`
    (UNCONDITIONAL — no `@ConditionalOnProperty`, per batch P sidecar). The repository
    has no awareness of which collector authenticated; it relies on the service tier
    to have correctly resolved `collectorId` from the WebSession and to have stamped
    the right `collector_id` on the pojo. A service-bypassing caller invoking
    `repository.bulkCreate(pojoListWithArbitraryCollectorId)` would write that
    collector_id verbatim.
- authorization_assertions: []
  notes: |
    NO `@PreAuthorize`, NO programmatic `permissionService.hasPermission(...)` call,
    NO ownership filter (the catalog has no per-owner scoping on datasources). This
    is the standard repository-layer posture in the platform — authorization is the
    SERVICE / CONTROLLER tier's responsibility; the repository is intentionally
    auth-agnostic. The read-collaborative posture (every authenticated user can
    enumerate datasources) is the load-bearing implicit ADR (concept catalog:
    `read-collaborative-posture-every-authenticated-user-enumerates-the-catalog`).
- owner_scoping: |
    N/A — the `data_source` table has NO `owner_id` column. Datasources do not
    participate in the catalog's ownership model. Owner-driven filtering does not
    apply at this layer. The catalog's ownership is at the `data_entity` level
    (data_entity.owner_id per V0_0_1__init.sql:73) — NOT at the data_source layer.
- data_exposure:
  - "DataSourceDto (id, name, oddrn, description, namespace pojo, token pojo) → any authenticated user via DataSourceController (UI) under any auth mode AND any caller of /api/directory/* under any auth mode. TOKEN value is included in the DTO via `TokenDto(tokenPojo)` (line 167, 177) — but the TokenMapper applies an `obfuscatedValue` transformation on UI serialization (verify via TokenMapper) — direct repository access RETURNS the plaintext token. **A service-bypassing caller of `dataSourceRepository.getDto(id)` receives the PLAINTEXT collector token.**"
  - "Token plaintext exposure via the Datasources tab (P-08) — the UI's Datasources list shows the obfuscated suffix of every token (per CollectorsList batch Q sidecar). The repository returns the FULL plaintext; the obfuscation is a UI-tier concern. Any service-bypassing caller bypasses the obfuscation."
- known_security_gaps:
  - "**The repository returns plaintext TOKEN values to any caller** (lines 163, 167, 172, 177 — `TokenPojo tokenPojo = jooqRecordHelper.extractRelation(record, TOKEN, TokenPojo.class)` followed by `new TokenDto(tokenPojo)`). A service-bypassing caller (e.g. a future internal job, a misconfigured integration) gets full plaintext tokens. The platform's posture is 'tokens are plaintext in DB and in DTOs; the UI obfuscates on render only'. This is consistent with the concept catalog entry `shared-secret-tokens-stored-plaintext` (batch O finding)." — evidence: ReactiveDataSourceRepositoryImpl.java:163, 167, 172, 177 + TokenPojo (jOOQ-generated, value column) — severity: MEDIUM
  - "**No audit log of datasource mutations** — there is NO write to `activity_event` or any change-history table when a datasource is created / updated / soft-deleted via this repository. An operator-side `DataSourceServiceImpl.update` (UI), a collector-side `bulkUpdate` (ingestion), and a `DataSourceServiceImpl.delete` (UI) are all SILENT in the Activity Feed. The collector's silent-overwrite of operator-edited name + description (REFACTOR-423) has no audit trail. Severity: MEDIUM (mirrors the audit-log-presence-asymmetry concept-catalog entry — Activity Feed covers entity metadata, NOT datasource metadata)." — evidence: ReactiveDataSourceRepositoryImpl.java (no activity_event write) + ReactiveAbstractCRUDRepository.java (no activity_event write) — severity: MEDIUM
  - "**`existsByCollector` is the SOLE cascade-delete guard against collector deletion** — there is no DB-tier `ON DELETE` clause on data_source.collector_id (V0_0_34__add_collector_to_data_source.sql:1-2 declares the FK without ON DELETE). The guard lives at CollectorServiceImpl.java:74-79 via this method. A service-bypassing caller invoking `collectorRepository.delete(id)` DIRECTLY would succeed even with attached datasources (the collector row would soft-delete, but the FK constraint would NOT fire because Postgres FK constraints don't apply to UPDATEs of the parent's id; the data_source rows would orphan-ly reference a soft-deleted collector). Severity: MEDIUM." — evidence: ReactiveDataSourceRepositoryImpl.java:124-132 + V0_0_34 (no ON DELETE clause) + CollectorServiceImpl.java:73-79 (the SOLE consumer) — severity: MEDIUM
  - "**Cross-collector overwrite via service-bypassing call** — a service-bypassing caller invoking `dataSourceRepository.bulkUpdate(List.of(pojoWithNewCollectorId))` (in a hypothetical internal job, a future service path, or via test-harness misconfiguration) would overwrite the collector_id of an existing datasource — effectively transferring 'ownership' of the datasource from collector A to collector B. The cross-collector protection is a SERVICE-TIER convention in `prepareForUpdate`, NOT a repository-tier or schema-tier enforcement. Severity: MEDIUM (no known caller exploits this today; STRUCTURAL hazard for future development)." — evidence: ReactiveDataSourceRepositoryImpl.java (no enforcement) + ReactiveAbstractCRUDRepository.java:203-223 (bulkUpdate writes all fields) + DataSourceIngestionServiceImpl.java:74-92 (the service-tier guard) — severity: MEDIUM

## performance

- hot_paths:
  - "`getIdByOddrnForUpdate(oddrn)` (lines 94-101) is on the ingestion critical path — invoked ONCE PER `POST /ingestion/entities` call by IngestionServiceImpl.java:68 BEFORE persistDataEntities. The `SELECT … FOR UPDATE` row-lock acquisition is a single round-trip, but it BLOCKS the transaction's progress until the lock is acquired. Under high concurrent ingestion (multiple collectors pushing to the SAME datasource simultaneously), the LATER call waits for the EARLIER's transaction commit. Throughput per-datasource is therefore serialised."
  - "`getDtosByOddrns(oddrns)` (lines 104-110) is on the collector-startup critical path — invoked ONCE PER `POST /ingestion/datasources` call by DataSourceIngestionServiceImpl.java:47. The query is a single `WHERE oddrn IN (?, ?, …)` — Postgres can use the `data_source_oddrn_unique` partial index for IN-list lookups. Performance is O(log N) per ODDRN in the list."
  - "`existsByNamespace` / `existsByCollector` are on the cascade-delete critical path — invoked once per `DELETE /api/namespaces/{id}` (NamespaceServiceImpl.java:76 along with three siblings) and once per `DELETE /api/collectors/{id}` (CollectorServiceImpl.java:74). The `EXISTS` subquery has Postgres's short-circuit evaluation — single index lookup on `namespace_id` / `collector_id` (both have indexes? not verified — the FK creation typically does NOT auto-create an index in Postgres)."
  - "`listDto(page, size, nameQuery)` (lines 58-82) on the UI's Datasources tab — invoked on every Datasources-tab refresh. Two round-trips: the CTE-paginated query + the count query. The count's `containsIgnoreCase` (vs page's `startsWithIgnoreCase`) sequential scans `data_source.name` (no GIN/trigram index for substring search) — O(N) per call. For a catalog with 10k+ datasources, the count query is slow."
- throughput_characteristics:
  - "`getDtosByOddrns` accepts a List<String> — bounded by the collector's payload size; typical payloads are 1-100 datasources per call."
  - "`bulkUpdate` / `bulkCreate` (inherited) partition the records via `JooqReactiveOperations.executeInPartitionReturning` (configurable batch size — default likely 32k Postgres parameter limit / N parameters per row)."
  - "Reactive Mono / Flux signatures — non-blocking but per-call R2DBC round-trip."
- resource_allocation:
  - "Each method opens a new R2DBC connection via JooqReactiveOperations (which delegates to `DatabaseClient.inConnection`). Spring R2DBC autoconfiguration manages a connection pool. No explicit pool tuning visible at this layer."
  - "`baseSelect` (lines 141-149) materialises the data_source row + namespace row + token row into memory per record. Standard size — no large-payload concern."
- scaling_characteristics:
  - "Stateless repository — instances scale horizontally with the platform process."
  - "**`getIdByOddrnForUpdate` row-lock serialises ingestion per-datasource** — the row-level `FOR UPDATE` lock means two collectors / processes ingesting to the SAME datasource simultaneously are serialised. Scaling the platform horizontally does NOT remove the bottleneck — it's a Postgres-tier lock. If a single datasource sees high ingestion rate (e.g. a Kafka adapter pushing entity-by-entity), this is the bottleneck."
  - "`listDto` pagination is `(page-1)*size, size` (line 62) — standard offset-pagination; degrades O(offset) at very high page numbers (operator scrolling deep into a large catalog)."
- known_performance_gaps:
  - "**`listDto`'s count query uses `containsIgnoreCase` substring match without a trigram (pg_trgm) index** — Postgres can't use a B-tree index for substring `%term%` patterns. For 10k+ datasources the count query is a sequential scan. Combined with the page-vs-count predicate divergence (REFACTOR-425), the count is both slow AND wrong." — evidence: ReactiveDataSourceRepositoryImpl.java:80 + ReactiveAbstractCRUDRepository.java:240-249 — severity: LOW
  - "**No index on `data_source.collector_id`** verified by reading V0_0_34__add_collector_to_data_source.sql:1-2 — the migration declares only the FK, not an index. Postgres does NOT auto-index FKs. `existsByCollector(id)` therefore sequentially scans data_source on every `DELETE /api/collectors/{id}` invocation. Low frequency (collector deletes are rare) — but the same lack-of-index affects any `WHERE collector_id = ?` query." — evidence: V0_0_34__add_collector_to_data_source.sql:1-2 (no CREATE INDEX) + ReactiveDataSourceRepositoryImpl.java:124-132 — severity: LOW
  - "**No index on `data_source.namespace_id`** — same concern; affects `existsByNamespace` per-namespace-delete and any future namespace-driven datasource list." — evidence: V0_0_11__add_namespace_support.sql:1-2 (no CREATE INDEX) + ReactiveDataSourceRepositoryImpl.java:113-121 — severity: LOW
  - "**No DTO caching, no record-level cache** — every method round-trips to Postgres. For the read-heavy `getDtoByOddrn` / `getDtosByOddrns` (called from EVERY ingestion request), this is a per-request DB round-trip. A future optimisation would be a short TTL cache keyed by ODDRN." — evidence: ReactiveDataSourceRepositoryImpl.java (no cache annotation) — severity: LOW

## sources

- understanding ← ReactiveDataSourceRepositoryImpl.java:34-180 + DataSourceIngestionServiceImpl.java:74-92 + V0_0_31__add_deleted_at_field.sql:29 + V0_0_1__init.sql:38-50, 82 + V0_0_64__remove_is_deleted_field.sql:17-23
- concepts.entities ← ReactiveDataSourceRepositoryImpl.java:30-32 (jOOQ Tables imports) + V0_0_1__init.sql:38-50 (initial schema) + V0_0_11, V0_0_28, V0_0_31, V0_0_34, V0_0_64, V0_0_71 (column evolution) + ReactiveDataSourceRepositoryImpl.java:162-179 (DataSourceDto mapping)
- concepts.operations.getDto ← ReactiveDataSourceRepositoryImpl.java:48-55
- concepts.operations.listDto ← ReactiveDataSourceRepositoryImpl.java:57-82 + 151-160
- concepts.operations.getDtoByOddrn ← ReactiveDataSourceRepositoryImpl.java:84-91
- concepts.operations.getIdByOddrnForUpdate ← ReactiveDataSourceRepositoryImpl.java:93-101
- concepts.operations.getDtosByOddrns ← ReactiveDataSourceRepositoryImpl.java:103-110
- concepts.operations.existsByNamespace ← ReactiveDataSourceRepositoryImpl.java:112-121
- concepts.operations.existsByCollector ← ReactiveDataSourceRepositoryImpl.java:123-132
- concepts.operations.findByPrefix ← ReactiveDataSourceRepositoryImpl.java:134-139
- concepts.operations.inherited-bulkUpdate ← ReactiveAbstractCRUDRepository.java:128-142, 203-223
- concepts.operations.inherited-soft-delete ← ReactiveAbstractSoftDeleteCRUDRepository.java:50-58
- concepts.invariants.[0] soft-delete-auto-scope ← ReactiveAbstractSoftDeleteCRUDRepository.java:77-89 + ReactiveDataSourceRepositoryImpl.java:52, 88, 97, 107, 116, 128, 137, 154
- concepts.invariants.[1] ODDRN-partial-unique ← V0_0_31__add_deleted_at_field.sql:29
- concepts.invariants.[2] name-partial-unique ← V0_0_31__add_deleted_at_field.sql:27 + V0_0_18__pull_push_data_sources.sql:1-3
- concepts.invariants.[3] partial-merge-is-service-tier ← ReactiveDataSourceRepositoryImpl.java (no narrowing) + ReactiveAbstractCRUDRepository.java:128-142, 203-223 + DataSourceIngestionServiceImpl.java:74-92
- concepts.invariants.[4] cross-collector-is-service-tier ← DataSourceIngestionServiceImpl.java:86-88 (copy-construct) + ReactiveAbstractCRUDRepository.java:203-223 (bulkUpdate writes all)
- concepts.invariants.[5] forUpdate-row-lock ← ReactiveDataSourceRepositoryImpl.java:94-101 + IngestionServiceImpl.java:65-74
- concepts.invariants.[6] listDto-predicate-divergence ← ReactiveDataSourceRepositoryImpl.java:58-82, 151-160 + ReactiveAbstractCRUDRepository.java:225-249
- concepts.invariants.[7] three-soft-delete-mechanisms ← V0_0_1__init.sql:46 (is_deleted boolean) + V0_0_31__add_deleted_at_field.sql:4-5 + V0_0_64__remove_is_deleted_field.sql:17-23
- dependencies_semantic.requires-feature.parent-class ← ReactiveDataSourceRepositoryImpl.java:36
- dependencies_semantic.requires-feature.JooqReactiveOperations ← ReactiveDataSourceRepositoryImpl.java:41-43
- dependencies_semantic.requires-config.migrations ← Flyway migrations enumerated (V0_0_1, V0_0_11, V0_0_18, V0_0_26, V0_0_28, V0_0_31, V0_0_34, V0_0_64, V0_0_71, V0_0_75)
- dependencies_semantic.coupling.soft-delete-base ← ReactiveAbstractSoftDeleteCRUDRepository.java:22-118
- dependencies_semantic.coupling.no-FK-ON-DELETE ← V0_0_1__init.sql:82 + V0_0_34__add_collector_to_data_source.sql:1-2
- tests_coverage_semantic.test_files ← src/test/java/.../repository/DataSourceRepositoryImplTest.java + src/test/java/.../service/DataSourceIngestionServiceTest.java
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/developer-guides/build-and-run/custom-collectors 2026-05-20 status 200
- implicit_adrs.[0] partial-merge-is-service-tier ← ReactiveDataSourceRepositoryImpl.java (no narrowing) + DataSourceIngestionServiceImpl.java:74-92 + ADR-CANDIDATE-142
- implicit_adrs.[1] ODDRN-partial-unique-soft-delete ← V0_0_31__add_deleted_at_field.sql:29
- implicit_adrs.[2] forUpdate-row-lock ← ReactiveDataSourceRepositoryImpl.java:94-101 + IngestionServiceImpl.java:65-74
- implicit_adrs.[3] cascade-delete-guards-service-tier ← ReactiveDataSourceRepositoryImpl.java:113-132 + CollectorServiceImpl.java:73-79 + NamespaceServiceImpl.java:73-90 + V0_0_34 (no ON DELETE)
- bugs_limitations_corner_cases.[0] listDto-predicate-divergence ← ReactiveDataSourceRepositoryImpl.java:58-82 + 151-160 + ReactiveAbstractCRUDRepository.java:225-249
- bugs_limitations_corner_cases.[1] name-collision-silent-failure ← V0_0_31__add_deleted_at_field.sql:27 + DataSourceIngestionServiceImpl.java:40
- bugs_limitations_corner_cases.[2] soft-deleted-namespace-leak ← ReactiveDataSourceRepositoryImpl.java:144-148, 72
- bugs_limitations_corner_cases.[3] token-no-grace-period ← DataSourceServiceImpl.java:99-106 + V0_0_28__add_token.sql (no deleted_at on token)
- bugs_limitations_corner_cases.[4] findByPrefix-no-auth ← ReactiveDataSourceRepositoryImpl.java:135-139 + DirectoryServiceImpl.java:97
- bugs_limitations_corner_cases.[5] cte-name-literal ← ReactiveDataSourceRepositoryImpl.java:64
- bugs_limitations_corner_cases.[6] no-soft-delete-recovery ← ReactiveDataSourceRepositoryImpl.java (no recover method)
- security.auth_mode_relevance ← N/A — internal-only (line-level: no @PreAuthorize anywhere in the file)
- security.ingestion_filter_relevance ← IngestionDataSourceFilter (batch P sidecar — unconditional registration) + DataSourceIngestionServiceImpl.java:40-72 (the service consumer)
- security.data_exposure.plaintext-token ← ReactiveDataSourceRepositoryImpl.java:163, 167, 172, 177
- security.known_security_gaps.[0] plaintext-token ← ReactiveDataSourceRepositoryImpl.java:163-177
- security.known_security_gaps.[1] no-audit-log ← ReactiveDataSourceRepositoryImpl.java (no activity_event write) + concept catalog `audit-log-presence-asymmetry-2-tier-audit-story`
- security.known_security_gaps.[2] existsByCollector-sole-guard ← V0_0_34__add_collector_to_data_source.sql:1-2 + CollectorServiceImpl.java:73-79
- security.known_security_gaps.[3] cross-collector-bypass ← ReactiveAbstractCRUDRepository.java:203-223 + DataSourceIngestionServiceImpl.java:74-92
- performance.hot_paths.[0] getIdByOddrnForUpdate ← ReactiveDataSourceRepositoryImpl.java:94-101 + IngestionServiceImpl.java:65-74
- performance.hot_paths.[3] listDto-count-substring-scan ← ReactiveDataSourceRepositoryImpl.java:80 + ReactiveAbstractCRUDRepository.java:240-249
- performance.scaling_characteristics.[1] row-lock-per-datasource-bottleneck ← ReactiveDataSourceRepositoryImpl.java:94-101
- performance.known_performance_gaps.[1] no-index-on-collector_id ← V0_0_34__add_collector_to_data_source.sql:1-2
- performance.known_performance_gaps.[2] no-index-on-namespace_id ← V0_0_11__add_namespace_support.sql:1-2

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (existing tests verified via direct file read; uncovered behaviours inferred from missing methods in DataSourceRepositoryImplTest — file enumerated lines 1-100, 200-279)
- docs_link_semantic: HIGH (live WebFetch performed in this session; doc-drift confirmed verbatim)
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH (file-local — concept-merger will aggregate)
- performance: MEDIUM (Postgres index presence not verified via DDL inspection of every potential index location; the AUTO-INDEX-NO claim on FKs is correct per Postgres documentation but the platform may have added explicit indexes in a separate migration not surfaced by the V0_NN__data_source* glob — a follow-up grep across migrations would HIGH-confidence this)

## Maintainer notes

(empty; this is a new sidecar — no previous version's notes to preserve)

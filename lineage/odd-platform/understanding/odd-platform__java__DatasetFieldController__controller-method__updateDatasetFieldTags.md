---
node_id: "odd-platform java DatasetFieldController controller-method:updateDatasetFieldTags"
node_kind: controller-method
axis: controllers
extracted_at_commit: b56c8c1
enriched_at_commit: b56c8c1
extractor_version: 0.1.0
prompt_version: file-analyser/0.5.0
enrichment_status: complete
confidence_overall: MEDIUM
session_id: session-2026-05-21-A
---

# DatasetFieldController#updateDatasetFieldTags — semantic understanding

## understanding

`updateDatasetFieldTags` is the reactive `PUT /api/datasetfields/{dataset_field_id}/tags` handler — a
four-line method that reads the request body as `Mono<DatasetFieldTagsUpdateFormData>`, calls
`datasetFieldService.updateDatasetFieldTags(datasetFieldId, formData)`, and lifts the resulting
`Flux<Tag>` into `200 OK` via `Mono.just(ResponseEntity.ok(tags))`. It is the third member of the
tag-relation write trio alongside `DataEntityController.createDataEntityTagsRelations` and
`TermController.createTermTagsRelations`. The underlying semantic is **delete-all-then-recreate** for
INTERNAL tag relations on a single dataset field: the service unconditionally deletes every
`tag_to_dataset_field` row whose `origin = 'INTERNAL'` for that field, then auto-creates any
submitted tag name absent from the global `tag` directory and inserts a fresh relation row per
submitted name. EXTERNAL and EXTERNAL_STATISTICS relations (ingestion-sourced, including the
dataset-statistics-derived tags) are not touched. Authorization is **parent-scoped**: the
`DATASET_FIELD` SecurityRule resolves the dataset-field id to its owning data-entity id (via
`DatasetFieldResourceExtractor.getDataEntityIdByDatasetFieldId`), then evaluates the
`DATASET_FIELD_TAGS_UPDATE` permission — itself a `DATA_ENTITY`-scoped enum member — against the
*parent data entity's* Policy context. Tag auto-create-on-miss applies here too, so the same
`TAG_CREATE` side-door observed in `createDataEntityTagsRelations` is present, with the additional
twist that this endpoint never sets the relation `origin` field explicitly and relies on the DB
column default `'INTERNAL'`.

## concepts

- entities: [
    "`Tag` (response payload — `id`, `name`, `important`, `external`, `usedCount`; OpenAPI `TagList` schema referenced at `openapi.yaml:2516`)",
    "`DatasetFieldTagsUpdateFormData` (request body — single optional field `tags: array<string>`; `components.yaml:1827-1833` — note: NO `required` block, contrast with data-entity `TagsFormData` which makes `tag_name_list` required)",
    "`TagPojo` (jOOQ row for the `tag` directory table — `id`, `name`, `important`, `deleted_at`, `created_at`, `updated_at`)",
    "`TagToDatasetFieldPojo` (jOOQ relation row for `tag_to_dataset_field` — `tag_id`, `dataset_field_id`, `origin`; `origin` column is `NOT NULL DEFAULT 'INTERNAL'` per `V0_0_82__add_tag_to_dataset_field.sql:12`)",
    "`TagDto` (service-layer DTO wrapping a `TagPojo` plus `external` aggregate + `count`; produced by `ReactiveTagRepositoryImpl.listDatasetFieldDtos`)",
    "`DatasetFieldTagActivityStateDto` / `DatasetFieldInformationActivityStateDto` (activity-feed BEFORE/AFTER state carriers — `id`, `name` per tag; `DatasetFieldInformationUpdatedActivityHandler.java:53-67`)"
  ]
- operations: [
    "`replace-internal-tags-for-dataset-field` — `datasetFieldService.updateDatasetFieldTags` runs: (a) `reactiveTagRepository.deleteDatasetFieldInternalRelations(datasetFieldId)` — DELETE all `tag_to_dataset_field` rows for this field WHERE `origin = 'INTERNAL'`, (b) `getUpdatedRelations(names, datasetFieldId)` → `tagService.getOrCreateTagsByName(names)` which auto-creates any tag name not in the directory, mapping each to a `TagToDatasetFieldPojo` with `tagId` + `datasetFieldId` set but `origin` LEFT UNSET, (c) `reactiveTagRepository.createDatasetFieldRelations(...)` — batched INSERT with `onDuplicateKeyIgnore`, (d) `reactiveSearchEntrypointRepository.updateDatasetFieldSearchVectors(datasetFieldId)`, (e) `markDataEntityByTags(...)` toggling `data_entity_filled.dataset_field_tags_filled`, (f) re-read `reactiveTagRepository.listDatasetFieldDtos(datasetFieldId)` and map to `Flux<Tag>`",
    "`auto-create-tag-on-miss` — `tagService.getOrCreateTagsByName` → `divideTagsByExistence` splits submitted names against `reactiveTagRepository.listByNames`, then `reactiveTagRepository.bulkCreate` for any novel name with `important = false` (`TagServiceImpl.java:152-157`)",
    "`resolve-dataset-field-to-parent-data-entity` — the authorization layer's `DatasetFieldResourceExtractor.extractResourceId` joins `dataset_field → dataset_structure → dataset_version → data_entity` to map the path's `dataset_field_id` to its owning data-entity id (`DatasetFieldResourceExtractor.java:20-27` + `ReactiveDatasetFieldRepositoryImpl.java:116-125`)"
  ]
- invariants: [
    "Reactive transactional — `DatasetFieldServiceImpl.updateDatasetFieldTags` is annotated `@ReactiveTransactional` (`DatasetFieldServiceImpl.java:118`); the delete, the directory auto-create (`bulkCreate`), the relation re-insert, the search-vector refresh, the `data_entity_filled` toggle, and the final re-read all run inside one DB transaction. Unlike the data-entity path there is NO second `@ReactiveTransactional` on a downstream worker — the service method is the single tx boundary; `TagService.getOrCreateTagsByName` is NOT annotated `@ReactiveTransactional` (`TagServiceImpl.java:79-86`) so it inherits the caller's tx.",
    "Delete-all-then-recreate, NOT a diff — `updateDatasetFieldTags` calls `deleteDatasetFieldInternalRelations(datasetFieldId)` first (`DatasetFieldServiceImpl.java:124`), which is an unconditional `DELETE FROM tag_to_dataset_field WHERE dataset_field_id = ? AND origin = 'INTERNAL'` (`ReactiveTagRepositoryImpl.java:289-295`), then re-inserts the full submitted set. This differs from the data-entity path's `updateRelationsWithDataEntity`, which computes a `current \\ updated` diff and deletes only the removed subset (`TagServiceImpl.java:113-120`). The dataset-field path discards and rebuilds; the data-entity path diffs. Operator-observable result is equivalent (replace-all) but the relation rows are recreated wholesale on every call.",
    "EXTERNAL / EXTERNAL_STATISTICS relations are protected — the delete is gated by `origin = 'INTERNAL'` (`ReactiveTagRepositoryImpl.java:292`). The `TagOrigin` enum has three members: `INTERNAL`, `EXTERNAL`, `EXTERNAL_STATISTICS` (`TagOrigin.java:3-7`). EXTERNAL_STATISTICS relations are written by the ingestion path `DatasetFieldServiceImpl.updateFieldsTags` from `DataSetFieldStat.getTags()` (`DatasetFieldServiceImpl.java:191-231`) and survive this UI/API call. A caller cannot remove ingested-statistics tag relations through this endpoint.",
    "Auto-created tags get `important = false` — `divideTagsByExistence:155` reads `.map(n -> new TagPojo().setName(n).setImportant(false))`; tags minted via this side-channel never inherit a 'promoted' status. Same hardcoded default as the data-entity tag path.",
    "Activity-feed event with FULL before/after tag state — `@ActivityLog(event = DATASET_FIELD_TAGS_UPDATED)` annotates the service method (`DatasetFieldServiceImpl.java:119`); the `@ActivityParameter(DatasetFieldInformationUpdated.DATASET_FIELD_ID)` on the `datasetFieldId` argument (`DatasetFieldServiceImpl.java:121`) is read by `DatasetFieldInformationUpdatedActivityHandler`, whose `getState` serialises the field's complete tag list (id + name per tag) into both `oldState` and `newState` (`DatasetFieldInformationUpdatedActivityHandler.java:53-67`). This is a notably more complete audit story than the data-entity tag path, where only the parent `dataEntityId` parameter is captured and the handler must reconstruct the diff.",
    "`onDuplicateKeyIgnore` on the relation insert — `createDatasetFieldRelations` ends the INSERT with `.onDuplicateKeyIgnore()` (`ReactiveTagRepositoryImpl.java:367`); the PK is `(tag_id, dataset_field_id)` (`V0_0_82__add_tag_to_dataset_field.sql:14`). A duplicate submitted name (the same tag id resolved twice) is silently absorbed rather than raising an error.",
    "Submitted names are de-duplicated into a Set — `new HashSet<>(formData.getTags())` (`DatasetFieldServiceImpl.java:123`) collapses duplicate strings before any DB call; `['x', 'x']` becomes `{'x'}`."
  ]
- audiences: [
    "ODD Platform UI — the dataset-field tags panel on a data entity's Structure tab calls this endpoint. (UI thunk file not read this session; the operationId `updateDatasetFieldTags` is generated into `DatasetFieldApi`; confidence: LOW for the exact UI call-site — recorded as a REFERENCE in `upstream_callers`.)",
    "Third-party API consumers holding `DATASET_FIELD_TAGS_UPDATE` resolved against the dataset field's PARENT data entity — per the live Permissions doc, this permission 'Allows adding or removing tags from an individual dataset field' (WebFetched 2026-05-21, status 200)",
    "Callers whose Policy grants `DATASET_FIELD_TAGS_UPDATE` either unconditionally (admin Policy) or conditionally scoped to the parent data entity (e.g. via a `dataEntity:owner` condition — the permission is `DATA_ENTITY`-typed per `PolicyPermissionDto.java:32`)"
  ]

## dependencies_semantic

- requires-feature: [
    "tagging feature — the dataset-field-side write path for INTERNAL tag relations. Pairs with `DataEntityController.createDataEntityTagsRelations` (data-entity-level tag relations), `TermController.createTermTagsRelations` (term-level tag relations), and `TagController` admin directory CRUD (`POST /api/tags` gated by `TAG_CREATE`).",
    "authorization / policy framework — the `DATASET_FIELD`-typed SecurityRule at `SecurityConstants.java:288-290` that resolves the dataset-field id to its parent data entity and evaluates `DATASET_FIELD_TAGS_UPDATE`",
    "dataset-field activity feed — `@ActivityLog(event = DATASET_FIELD_TAGS_UPDATED)` emits into the activity stream; the handler is `DatasetFieldInformationUpdatedActivityHandler` (shared with description + internal-name events)",
    "search-index pipeline — `reactiveSearchEntrypointRepository.updateDatasetFieldSearchVectors(datasetFieldId)` (`DatasetFieldServiceImpl.java:127`) refreshes the dataset-field search vector",
    "data-entity-filled tracking — `markDataEntityByTags` toggles `data_entity_filled.dataset_field_tags_filled` (column renamed from `dataset_field_labels_filled` in `V0_0_82__add_tag_to_dataset_field.sql:1-2`) used by completeness dashboards"
  ]
- requires-config: [] — N/A. The method reads no config; the gating SecurityRule is unconditional, not `@ConditionalOnProperty`-gated.
- requires-runtime: [
    "Spring WebFlux runtime — `Mono<ResponseEntity<Flux<Tag>>>` return type and `ServerWebExchange exchange` parameter (`DatasetFieldController.java:56-59`); the response is a streaming `Flux` lifted into a single `ResponseEntity` envelope (`DatasetFieldController.java:62`)",
    "jOOQ reactive DB session — `ReactiveTagRepositoryImpl.deleteDatasetFieldInternalRelations` (`:289-295`), `listByNames` (`:120-123`), `bulkCreate`, `createDatasetFieldRelations` (`:350-371`), `listDatasetFieldDtos` (`:84-98`), plus `ReactiveSearchEntrypointRepository` and `DataEntityFilledService` queries",
    "Postgres `tag_to_dataset_field` table — `(tag_id bigint NOT NULL, dataset_field_id bigint NOT NULL, origin varchar NOT NULL DEFAULT 'INTERNAL')`, PK `(tag_id, dataset_field_id)`, FKs to `dataset_field(id)` and `tag(id)` per `V0_0_82__add_tag_to_dataset_field.sql:8-18`. Replaced the pre-rename `label_to_dataset_field` table (dropped at `:100`).",
    "Postgres `tag` table — with the partial unique index on `name` WHERE not soft-deleted (cross-ref `createDataEntityTagsRelations` sidecar; the `tag` directory is shared)"
  ]
- couples-to: [
    "`DatasetFieldApi.updateDatasetFieldTags` (generated interface from `openapi.yaml:2497-2518`) — supplies `@RequestMapping(method = PUT, value = '/api/datasetfields/{dataset_field_id}/tags')` and the OpenAPI-declared response. The controller `@Override` (`DatasetFieldController.java:55-63`) inherits the routing.",
    "`DatasetFieldService.updateDatasetFieldTags(long, DatasetFieldTagsUpdateFormData)` (`DatasetFieldServiceImpl.java:117-132`) — sole downstream call; `@ReactiveTransactional` + `@ActivityLog(event = DATASET_FIELD_TAGS_UPDATED)`.",
    "`TagService.getOrCreateTagsByName(Set<String>)` (`TagServiceImpl.java:79-86`) — the auto-create-on-miss surface, shared with `updateRelationsWithDataEntity` and the ingestion-statistics path.",
    "`ReactiveTagRepository.deleteDatasetFieldInternalRelations(long)` (`ReactiveTagRepositoryImpl.java:289-295`), `createDatasetFieldRelations(Collection)` (`:350-371`), `listDatasetFieldDtos(long)` (`:84-98`) — the relation read/write/delete trio.",
    "`SecurityConstants.SECURITY_RULES` entry at `:288-290` — `new SecurityRule(DATASET_FIELD, new PathPatternParserServerWebExchangeMatcher('/api/datasetfields/{dataset_field_id}/tags', PUT), DATASET_FIELD_TAGS_UPDATE)`; the authoritative authorization gate.",
    "`DatasetFieldResourceExtractor` (`DatasetFieldResourceExtractor.java:10-28`) — resolves the path's `dataset_field_id` to the parent data-entity id for the `DATASET_FIELD` authorization-manager type.",
    "`PolicyPermissionDto.DATASET_FIELD_TAGS_UPDATE` (`PolicyPermissionDto.java:32` — `DATA_ENTITY`-scoped) and `PolicyPermissionDto.TAG_CREATE` (`MANAGEMENT`-scoped per cross-ref `createDataEntityTagsRelations` sidecar) — the scope asymmetry that produces the directory side-door.",
    "`DatasetFieldInformationUpdatedActivityHandler` (`DatasetFieldInformationUpdatedActivityHandler.java:22-69`) — the activity handler that captures full before/after tag state for the `DATASET_FIELD_TAGS_UPDATED` event."
  ]

## tests_coverage_semantic

- covered_behaviours:
  - behaviour: "Tag repository CRUD at the lowest layer — `TagRepositoryImplTest` covers `bulkCreate`, `getTagsByListNames`, data-entity relation create/delete, and `listMostPopular` (cross-ref `createDataEntityTagsRelations` sidecar tests block)."
    test_class: integration
    test_files: ["odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/TagRepositoryImplTest.java"]
- uncovered_behaviours:
  - behaviour: "HTTP-level smoke test — no `@WebFluxTest(DatasetFieldController.class)` or `WebTestClient` test asserts `PUT /api/datasetfields/{id}/tags` end-to-end."
    test_class: integration
    criticality: HIGH
    note: "Grep of `odd-platform-api/src/test` for `updateDatasetFieldTags` / `DatasetFieldTagsUpdate` / `deleteDatasetFieldInternalRelations` returned zero matches."
  - behaviour: "The delete-then-recreate INTERNAL replace-all semantic — no test verifies that calling with `tags: []` removes all internal dataset-field tag relations, nor that EXTERNAL_STATISTICS relations survive a call."
    test_class: integration
    criticality: HIGH
    note: "The `origin = 'INTERNAL'` delete filter is the line that defines what 'replace-all' means here; it is not asserted in code."
  - behaviour: "Relation INSERT with unset `origin` — no test verifies that `createDatasetFieldRelations` for a `TagToDatasetFieldPojo` with `origin` left null actually persists a row, and that the persisted row's `origin` is `'INTERNAL'`. This is the load-bearing untested path (see stress_findings / P-030)."
    test_class: integration
    criticality: CRITICAL
    note: "If jOOQ's newRecord-from-pojo emits an explicit NULL for the unset `origin` field, the INSERT violates the `NOT NULL` column constraint and the endpoint is broken for any non-empty `tags` list. The repository tests cover the data-entity relation path (which DOES set its discriminator `external` explicitly), not the dataset-field path."
  - behaviour: "Auto-create-on-miss for Tag via the dataset-field path — no test exercises `tags: ['name-not-in-directory']` and asserts a fresh `tag` row appears with `important = false`."
    test_class: integration
    criticality: HIGH
  - behaviour: "Parent-scoped authorization — no test asserts that a caller WITHOUT `DATASET_FIELD_TAGS_UPDATE` on the dataset field's PARENT data entity receives 403; no test asserts the `dataEntity:owner`-conditional grant resolves against the parent entity correctly; no test asserts the dataset-field-to-data-entity resolution (`getDataEntityIdByDatasetFieldId`) returns the right parent."
    test_class: security
    criticality: HIGH
  - behaviour: "Auth-mode coverage — no test exercises DISABLED / LOGIN_FORM / OAUTH2 / LDAP against this endpoint; the DISABLED anonymous-bypass is unverified."
    test_class: security
    criticality: HIGH
  - behaviour: "Activity-feed assertion — no test asserts that calling this endpoint produces a `DATASET_FIELD_TAGS_UPDATED` row with the correct before/after tag-state JSON."
    test_class: integration
    criticality: MEDIUM
  - behaviour: "Search-index refresh — no test asserts `updateDatasetFieldSearchVectors` runs after a successful upsert."
    test_class: integration
    criticality: LOW
  - behaviour: "`data_entity_filled.dataset_field_tags_filled` toggle — no test asserts `tags: []` results in `markEntityUnfilledByDatasetFieldId(DATASET_FIELD_TAGS)` and `tags: ['x']` results in `markEntityFilledByDatasetFieldId(DATASET_FIELD_TAGS)`."
    test_class: integration
    criticality: LOW
  - behaviour: "Tag-name validation — no test exercises empty strings, whitespace-only names, leading/trailing whitespace, or oversized strings in the `tags` array."
    test_class: integration
    criticality: MEDIUM
- test_files:
  - "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/TagRepositoryImplTest.java — repository-level CRUD coverage; contains NO dataset-field tag-relation test methods (Grep confirmed)."
- gaps: |
    The integration test_class has the worst coverage on this node, and the highest-leverage gap there is
    CRITICAL: nothing verifies that the relation INSERT path (`createDatasetFieldRelations` with an
    unset-`origin` pojo) actually persists. The data-entity sibling path explicitly sets its `external`
    discriminator on `TagToDataEntityPojo`; this dataset-field path leaves `origin` entirely unset on
    `TagToDatasetFieldPojo` and relies on the DB column default `'INTERNAL'`. Whether jOOQ's
    `newRecord(table, pojo)` sends an explicit `NULL` (constraint violation — endpoint dead for non-empty
    payloads) or omits the column (default applies — correct) is not statically determinable and not
    covered by any test. A regression that flips this — e.g. a jOOQ version bump changing
    null-field-handling, or someone adding `.setOrigin(null)` — would either break the endpoint outright
    or, worse, persist relations the `deleteDatasetFieldInternalRelations` filter cannot later remove
    (if the persisted `origin` ends up something other than `'INTERNAL'`, the next call's delete misses
    them and the field accumulates orphan internal relations). The security test_class is the next worst:
    the parent-scoped authorization (dataset-field id resolved to parent data-entity id, then
    `DATASET_FIELD_TAGS_UPDATE` evaluated against the parent) is a non-trivial resolution path with zero
    coverage. P-030 (emitted by this analysis) pins the relation-INSERT question.

## docs_link_semantic

- declared_docs: [] — N/A. The source file carries no `@docs` Javadoc annotation; consistent with this repo's convention (no `@docs` annotations bootstrapped in `odd-platform-api`). The OpenAPI description at `openapi.yaml:2500` reads only "Updates DatasetField's tags" — it does NOT mention the auto-create-tag side effect (contrast with the data-entity endpoint, whose spec text explicitly documents auto-create at `openapi.yaml:1174`).
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions"
    anchor: ""
    rationale: "Defines `DATASET_FIELD_TAGS_UPDATE` (the permission gating this endpoint) and `TAG_CREATE` / `TAG_UPDATE` (the management-level tag permissions whose scope asymmetry is the side-door finding). Fetched live this session."
    last_verified_at: "2026-05-21T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      WebFetched 2026-05-21, status 200. The page lists `DATASET_FIELD_TAGS_UPDATE` with the
      description "Allows adding or removing tags from an individual dataset field." It lists
      `TAG_CREATE` ("Allows creating a new tag.") and `TAG_UPDATE` ("Allows editing an existing
      tag.") under the Management permissions category. The page does NOT state that
      `DATASET_FIELD_TAGS_UPDATE` can itself create tags in the directory (the auto-create side
      effect), nor that the permission's scope resolves against the dataset field's PARENT data
      entity rather than the dataset field itself.
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization"
    anchor: ""
    rationale: "Authorization overview page; confirms the five-subsection structure (Policies / Permissions / Roles / Owners / User-owner association). Fetched live this session as the entry point to the Permissions sub-page."
    last_verified_at: "2026-05-21T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      WebFetched 2026-05-21, status 200. The overview page does not mention `DATASET_FIELD_TAGS_UPDATE`
      or dataset-field tags specifically; it only links to the Permissions sub-page.
- doc_drift_findings:
  - "The auto-create-tag side effect is UNDOCUMENTED for this endpoint at every layer. The OpenAPI description (`openapi.yaml:2500`, 'Updates DatasetField's tags') does not mention it; the data-entity sibling endpoint's spec text DOES ('Also creates corresponding tags in the system if they don't exist', `openapi.yaml:1174`). The live Permissions doc describes `DATASET_FIELD_TAGS_UPDATE` as 'adding or removing tags from an individual dataset field' — it does not warn that submitting a novel name grows the global `tag` directory. Surface to doc-gap-finder as a DOC-NNN candidate: 'Document that DATASET_FIELD_TAGS_UPDATE auto-creates directory tags, parallel to the data-entity endpoint.'"
  - "The replace-all (delete-then-recreate) semantic is undocumented. The OpenAPI summary 'Update DatasetField's tags' is at least more honest than the data-entity operationId `createDataEntityTagsRelations` (which says 'create' for a replace) — 'Update' implies the right semantic. But neither the spec nor the Permissions doc states that submitting `tags: []` clears all internal dataset-field tags, nor that EXTERNAL_STATISTICS (ingested-statistics) tag relations are preserved across the call. A third-party consumer reading only the spec who sends an incomplete `tags` array silently loses dataset-field tags."
  - "The parent-scoped authorization is undocumented. `DATASET_FIELD_TAGS_UPDATE` is a `DATA_ENTITY`-typed permission (`PolicyPermissionDto.java:32`) evaluated against the dataset field's owning data entity, not the field itself. An operator authoring a Policy with a `dataEntity:owner` condition cannot tell from the Permissions doc that granting this permission for a data entity also grants tag-edit on all of that entity's dataset fields. Surface as a DOC-NNN candidate for the Policies page."
  - "The `dataset_field_labels_filled` → `dataset_field_tags_filled` rename (`V0_0_82__add_tag_to_dataset_field.sql:1-2`) and the historical 'label' → 'tag' terminology migration is invisible in user docs. Operators on an older mental model may still search for 'labels'. Surface to concept-merger as a synonym/alias candidate (cross-ref Gate 2 territory)."

## implicit_adrs

- "Parent-scoped authorization for dataset-field writes — the `DATASET_FIELD` authorization-manager type resolves a dataset-field id to its owning data-entity id before evaluating any permission. `DatasetFieldResourceExtractor.extractResourceId` explicitly chains `.flatMap(datasetFieldRepository::getDataEntityIdByDatasetFieldId)`; the SQL joins `dataset_field → dataset_structure → dataset_version → data_entity`. The intent: dataset fields are not independently authorizable resources — they inherit their parent data entity's Policy scope. Every dataset-field write rule (`name`, `description`, `tags`, `enum_values`, `terms` — `SecurityConstants.java:282-303`) uses the `DATASET_FIELD` type, and every corresponding permission is declared `DATA_ENTITY`-scoped in `PolicyPermissionDto` (`:30-35`). The decision is consistent and structural: the data entity is the authorization unit, the dataset field is a sub-resource of it." — evidence: `DatasetFieldResourceExtractor.java:20-27` (the resolve-to-parent chain) + `ReactiveDatasetFieldRepositoryImpl.java:116-125` (the join) + `PolicyPermissionDto.java:32` (`DATASET_FIELD_TAGS_UPDATE(DATA_ENTITY)`) + `SecurityConstants.java:288-290` — intent_anchor: ".flatMap(datasetFieldRepository::getDataEntityIdByDatasetFieldId)" (`DatasetFieldResourceExtractor.java:26`) — confidence: HIGH

- "INTERNAL tag relations are owned by the UI/API channel; EXTERNAL and EXTERNAL_STATISTICS are owned by ingestion — `deleteDatasetFieldInternalRelations` deliberately scopes its DELETE to `origin = 'INTERNAL'` (`ReactiveTagRepositoryImpl.java:292`). The `TagOrigin` enum's three members (`INTERNAL`, `EXTERNAL`, `EXTERNAL_STATISTICS`) encode a multi-channel ownership model at the relation level: this endpoint's replace-all only ever touches the channel it owns. EXTERNAL_STATISTICS relations are written by `DatasetFieldServiceImpl.updateFieldsTags` from dataset-statistics ingestion (`:191-231`, which filters `listTagsRelations(..., TagOrigin.EXTERNAL_STATISTICS)`). The intent is structural: ingestion-derived tags must survive a UI replace-all." — evidence: `ReactiveTagRepositoryImpl.java:289-295` (`deleteDatasetFieldInternalRelations` with the `origin = 'INTERNAL'` filter) + `TagOrigin.java:3-7` + `DatasetFieldServiceImpl.java:217-227` (the EXTERNAL_STATISTICS-scoped ingestion path) — intent_anchor: ".and(TAG_TO_DATASET_FIELD.ORIGIN.eq(TagOrigin.INTERNAL.toString()))" (`ReactiveTagRepositoryImpl.java:292`) — confidence: HIGH

- "The `tag_to_dataset_field.origin` column default `'INTERNAL'` is the relied-upon mechanism for setting the discriminator — the migration declares `origin varchar NOT NULL DEFAULT 'INTERNAL'` (`V0_0_82__add_tag_to_dataset_field.sql:12`), and `getUpdatedRelations` (`DatasetFieldServiceImpl.java:264-271`) constructs `TagToDatasetFieldPojo` instances with `tagId` and `datasetFieldId` set but never calls `.setOrigin(...)`. The decision encoded is 'UI-path relations are INTERNAL by default; let the DB column default apply rather than set it in code'. This contrasts with the data-entity path, where `updateRelationsWithDataEntity` explicitly calls `.setExternal(false)` on every `TagToDataEntityPojo` (`TagServiceImpl.java:109`). The dataset-field path's reliance on a DB default rather than an explicit set is a deliberate-looking-but-fragile choice: it only works if the jOOQ insert omits the unset column rather than emitting an explicit NULL. Recorded here as an implicit ADR because the column default is clearly the intended source of the value; the fragility is flagged in `bugs_limitations_corner_cases` and probed by P-030." — evidence: `V0_0_82__add_tag_to_dataset_field.sql:12` (`origin varchar NOT NULL DEFAULT 'INTERNAL'`) + `DatasetFieldServiceImpl.java:264-271` (`getUpdatedRelations` — no `.setOrigin`) + `TagServiceImpl.java:106-109` (data-entity path DOES call `.setExternal(false)`) — intent_anchor: "origin varchar NOT NULL DEFAULT 'INTERNAL'::varchar" (`V0_0_82__add_tag_to_dataset_field.sql:12`) — confidence: MEDIUM (the column default is unambiguously intentional; whether the unset-in-code reliance was a considered decision or an oversight is not statically determinable — no comment articulates it)

- "Activity audit captures full before/after tag state at the dataset-field surface — `DatasetFieldInformationUpdatedActivityHandler.getState` serialises the field's complete tag list into both `oldState` and `newState` (`:53-67`); the handler reads `getDatasetFieldWithTags` for both the context (BEFORE) and the updated state (AFTER). The intent: dataset-field tag changes are fully auditable from the activity feed alone, without chaining consecutive events. This is a deliberate improvement over the data-entity tag path, where only the `dataEntityId` parameter is captured and the diff is not directly recorded." — evidence: `DatasetFieldInformationUpdatedActivityHandler.java:32-51` (`getContextInfo` + `getUpdatedState`, both reading `getDatasetFieldWithTags`) + `DatasetFieldInformationUpdatedActivityHandler.java:53-67` (`getState` includes the tag list) + `DatasetFieldServiceImpl.java:119` (`@ActivityLog(event = DATASET_FIELD_TAGS_UPDATED)`) — intent_anchor: "tags = dto.tags().stream().map(l -> new DatasetFieldTagActivityStateDto(l.getId(), l.getName())).toList()" (`DatasetFieldInformationUpdatedActivityHandler.java:58-60`) — confidence: HIGH

- "Single transactional boundary at the service method — `DatasetFieldServiceImpl.updateDatasetFieldTags` carries `@ReactiveTransactional` (`:118`) and the downstream `TagService.getOrCreateTagsByName` is NOT annotated (`TagServiceImpl.java:79`), so directory auto-create inherits the caller's transaction. This differs from the data-entity path, where BOTH `DataEntityServiceImpl.upsertTags` AND `TagServiceImpl.updateRelationsWithDataEntity` carry `@ReactiveTransactional` (the defensive double-annotation noted in the `createDataEntityTagsRelations` sidecar). Here the worker (`getOrCreateTagsByName`) is a plain `Flux` method with no tx of its own — the intent is that the dataset-field service method is the sole, authoritative tx scope." — evidence: `DatasetFieldServiceImpl.java:118` (`@ReactiveTransactional` on the method) + `TagServiceImpl.java:79-86` (`getOrCreateTagsByName` — no annotation) — intent_anchor: "@ReactiveTransactional" (`DatasetFieldServiceImpl.java:118`) — confidence: MEDIUM (the single-annotation pattern is consistent within this service, but no comment articulates 'why only one' versus the data-entity path's two)

## bugs_limitations_corner_cases

- "Relation INSERT relies on an UNSET pojo field plus a DB column default — `getUpdatedRelations` (`DatasetFieldServiceImpl.java:264-271`) builds `TagToDatasetFieldPojo` with only `tagId` + `datasetFieldId`, never `origin`. `createDatasetFieldRelations` maps each pojo via `jooqReactiveOperations.newRecord(TAG_TO_DATASET_FIELD, p)` then INSERTs (`ReactiveTagRepositoryImpl.java:355-368`). If jOOQ's `newRecord(table, pojo)` marks the `origin` field as changed-with-value-NULL, the INSERT emits an explicit `NULL` and violates `origin varchar NOT NULL` (`V0_0_82__add_tag_to_dataset_field.sql:12`) — the endpoint would fail for ANY non-empty `tags` payload. If jOOQ omits the unset column, the `DEFAULT 'INTERNAL'` applies and behaviour is correct. The data-entity sibling path side-steps this entirely by explicitly calling `.setExternal(false)` on its relation pojo (`TagServiceImpl.java:109`). This is statically uncertain (jOOQ null-field-handling + `onDuplicateKeyIgnore` interaction) and untested — probed by P-030." — evidence: `DatasetFieldServiceImpl.java:264-271` (`getUpdatedRelations` — no `.setOrigin`) + `ReactiveTagRepositoryImpl.java:355-368` (`createDatasetFieldRelations` newRecord-from-pojo INSERT) + `V0_0_82__add_tag_to_dataset_field.sql:12` (`NOT NULL DEFAULT 'INTERNAL'`) + `TagServiceImpl.java:106-109` (data-entity path sets its discriminator explicitly) — severity: HIGH

- "Permission side-door: `DATASET_FIELD_TAGS_UPDATE` mints global Tag directory rows without `TAG_CREATE` — submitting `tags: ['arbitrary-new-name']` runs `getOrCreateTagsByName`, which auto-creates a row in the global `tag` directory visible to every user (popular-tags surface, search dropdowns, data-entity and term tag pickers). The live Permissions doc presents `TAG_CREATE` as the permission that 'Allows creating a new tag' — but `DATASET_FIELD_TAGS_UPDATE` also creates tags. The asymmetry is exacerbated by scope: `TAG_CREATE` is `MANAGEMENT`-scoped (unconditional) while `DATASET_FIELD_TAGS_UPDATE` is `DATA_ENTITY`-scoped and conditionally grantable (e.g. `dataEntity:owner`). A per-data-entity owner can therefore mint global tag rows. Same pattern shape as the `createDataEntityTagsRelations` side-door — but with one WORSE property: the data-entity endpoint's spec text at least documents the auto-create (`openapi.yaml:1174`); the dataset-field endpoint's spec (`openapi.yaml:2500`) does not mention it at all." — evidence: `TagServiceImpl.java:79-86` (`getOrCreateTagsByName`) + `DatasetFieldServiceImpl.java:264-271` (call site in `getUpdatedRelations`) + `SecurityConstants.java:288-290` (gate uses `DATASET_FIELD_TAGS_UPDATE`, not `TAG_CREATE`) + `PolicyPermissionDto.java:32` (`DATA_ENTITY`-scoped) + live Permissions doc (WebFetched 2026-05-21, status 200) + cross-ref `createDataEntityTagsRelations` sidecar — severity: MEDIUM

- "`tags: []` clears all internal dataset-field tags, undiscoverably from the spec — the `DatasetFieldTagsUpdateFormData` schema has NO `required` block (`components.yaml:1827-1833`), so an absent or empty `tags` array is a valid request. `new HashSet<>(formData.getTags())` would NPE if `getTags()` returns null for a fully-absent field — UNVERIFIED whether the generated `DatasetFieldTagsUpdateFormData` defaults `tags` to an empty list or null (the OpenAPI generator's collection-default behaviour is not statically determined here; confidence: LOW for the NPE path specifically). For an explicitly-empty `tags: []`, the request means 'remove all internal tags' — `markDataEntityByTags` then calls `markEntityUnfilledByDatasetFieldId` (`DatasetFieldServiceImpl.java:255-257`). A buggy client that forgets to populate `tags` silently wipes a dataset field's internal tags with no warning in the spec." — evidence: `components.yaml:1827-1833` (no `required` block) + `DatasetFieldServiceImpl.java:123` (`new HashSet<>(formData.getTags())`) + `DatasetFieldServiceImpl.java:253-262` (`markDataEntityByTags` empty-list branch) — severity: MEDIUM

- "Delete-then-recreate churns relation rows on every call — `deleteDatasetFieldInternalRelations` (`ReactiveTagRepositoryImpl.java:289-295`) unconditionally deletes every INTERNAL relation row before re-inserting the full submitted set, even when the submitted set is identical to the current one. The data-entity sibling path diffs (`current \\ updated`) and only deletes the genuinely-removed subset (`TagServiceImpl.java:113-120`). For the dataset-field path, a no-op 'save' (re-submitting the same tags) still issues a full DELETE + full INSERT. Operator-visible effect is benign for correctness (the end state is identical), but PK churn and any DELETE/INSERT triggers fire needlessly; under concurrency two simultaneous saves of the same field interleave delete/insert pairs and the loser's INSERT can land before the winner's DELETE." — evidence: `DatasetFieldServiceImpl.java:124-126` (delete then create, no diff) + `ReactiveTagRepositoryImpl.java:289-295` (unconditional delete) + `TagServiceImpl.java:113-120` (the contrasting data-entity diff path) — severity: LOW

- "Under `auth.type=DISABLED`, the `DATASET_FIELD_TAGS_UPDATE` SecurityRule is bypassed — `DisabledAuthSecurityConfiguration` permits all exchanges (cross-ref the DISABLED-bypass pattern across batches A/B/C/E/F sidecars). Anonymous callers can `PUT /api/datasetfields/{id}/tags` and (a) overwrite the internal tag set of any dataset field, (b) mint arbitrary global Tag directory rows. The `@ActivityLog` event still fires but the caller identity is undefined. DISABLED is documented as dev-only, but the absence of a fail-fast on a network-reachable port makes accidental production deployment plausible." — evidence: `SecurityConstants.java:288-290` (rule exists) + cross-ref `createDataEntityTagsRelations` sidecar's DISABLED-bypass finding (`DisabledAuthSecurityConfiguration.java:9-19`) — severity: HIGH (under DISABLED on a network-reachable port; LOW if DISABLED is honestly dev-only)

- "No length / character-set / whitespace validation on `tags` items — the OpenAPI schema declares `tags: array of type: string` (`components.yaml:1830-1833`) with no `maxLength`, `minLength`, or `pattern`. The service does not trim or normalise. `tags: [' x ', 'x']` resolves to two distinct directory tags (whitespace-padded variants); a 10K-character name reaches the DB column constraint; homoglyph variants produce distinct rows. The global `tag` directory accumulates typos and free-text junk over the deployment lifetime. Same shape as the data-entity tag path and the Owner/Title cases in batch-F." — evidence: `components.yaml:1827-1833` (no per-item constraint) + `DatasetFieldServiceImpl.java:123` (input passed verbatim into the Set) + `TagServiceImpl.java:152-155` (no trim/normalise in `divideTagsByExistence`) — severity: MEDIUM

- "No cap on `tags` array size — `components.yaml:1830-1833` declares no `maxItems`. `new HashSet<>(formData.getTags())` (`DatasetFieldServiceImpl.java:123`) materialises the full submitted list into heap; `listByNames` sends an `IN(...)` clause that grows with the list (Postgres parameter limit ~32K); `bulkCreate` attempts a correspondingly large batched INSERT. No application-layer rejection of unreasonable sizes. Abusive-caller-required, low real-world risk." — evidence: `DatasetFieldServiceImpl.java:123` + `components.yaml:1830-1833` + cross-ref `createDataEntityTagsRelations` sidecar (same shape) — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables: []   # No numeric literals >1, no @Value, no constants, no magic-string gates in this
                 # method or its 1-hop service chain. The only literal in the path is the
                 # TagOrigin.INTERNAL discriminator string, covered under request_inputs / name_behavior.
  name_behavior_pairs:
    - name: "updateDatasetFieldTags (PUT /api/datasetfields/{dataset_field_id}/tags)"
      promise: "Update the tags on a dataset field — set the field's tags to the submitted set."
      implementation: "Service deletes ALL tag_to_dataset_field rows for the field WHERE origin='INTERNAL' (deleteDatasetFieldInternalRelations, ReactiveTagRepositoryImpl.java:289-295), then auto-creates any submitted name absent from the global tag directory and re-inserts a relation row per submitted name. EXTERNAL and EXTERNAL_STATISTICS relations are untouched. End state = submitted INTERNAL set + preserved ingested set."
      drift: NONE
      operator_visible_consequence: "The 'Update' verb is accurate — this is a replace of the internal tag set. (Contrast: the data-entity sibling's operationId says 'create' for the same replace semantic — that one IS misnamed; this one is not.)"
      confidence: STATIC-INFERRED
      evidence: "DatasetFieldServiceImpl.java:120-132 + ReactiveTagRepositoryImpl.java:289-295 + openapi.yaml:2499-2501"
    - name: "deleteDatasetFieldInternalRelations"
      promise: "Delete the dataset field's INTERNAL tag relations."
      implementation: "DELETE FROM tag_to_dataset_field WHERE dataset_field_id = ? AND origin = 'INTERNAL', returning the deleted rows. Honors the name exactly — scoped to INTERNAL origin only."
      drift: NONE
      operator_visible_consequence: "N/A — name matches behaviour."
      confidence: STATIC-INFERRED
      evidence: "ReactiveTagRepositoryImpl.java:289-295"
    - name: "getOrCreateTagsByName"
      promise: "Get the tags for these names, creating any that don't exist."
      implementation: "divideTagsByExistence splits names against listByNames; bulkCreate inserts any novel name with important=false; returns union of existing + created. Honors the name."
      drift: NONE
      operator_visible_consequence: "N/A — name matches behaviour; the side effect (global directory growth) is real but the method name does disclose 'Create'."
      confidence: STATIC-INFERRED
      evidence: "TagServiceImpl.java:79-86, 144-159"
  orderings: []   # No ORDER BY, no LIMIT, no paginate(), no Comparator, no in-memory sort in this
                  # method or its 1-hop chain. listDatasetFieldDtos (ReactiveTagRepositoryImpl.java:84-98)
                  # GROUPs BY tag fields but emits no ORDER BY — the returned Flux<Tag> order is
                  # database-natural (unspecified). Recorded as a corner-case-adjacent note rather than
                  # a stress finding because the response is a set the UI renders unordered; no
                  # operator-facing "top N" claim depends on it.
  auth_gates:
    - location: "SecurityConstants.java:288-290"
      endpoint: "PUT /api/datasetfields/{dataset_field_id}/tags"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "LOGIN_FORM / OAUTH2 / LDAP: the SecurityRule (DATASET_FIELD type, DATASET_FIELD_TAGS_UPDATE permission) is enforced — the dataset-field id is resolved to its parent data-entity id and the caller's Policies are evaluated against that parent; authorized callers get 200 + Flux<Tag>, unauthorized get 403. DISABLED: DisabledAuthSecurityConfiguration permits all exchanges (cross-ref the DISABLED-bypass pattern), so the endpoint executes for anonymous callers."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:288-290 + DatasetFieldResourceExtractor.java:20-27 + cross-ref createDataEntityTagsRelations sidecar (DisabledAuthSecurityConfiguration)"
        - q: "What does an unauthenticated caller see?"
          a: "Under LOGIN_FORM/OAUTH2/LDAP: redirected to login or 401 (no session/token) before the SecurityRule is reached — consistent with the controller-mounted auth chain (cross-ref class-level controller sidecars). Under DISABLED: the call executes anonymously; the ActivityContextInfo records no caller identity."
          confidence: REFERENCE
          evidence: "odd-platform java org_opendatadiscovery_oddplatform_controller controller:DataEntityController (class-level sidecar — auth chain behaviour for unauthenticated callers)"
        - q: "What does a wrong-role caller see?"
          a: "A caller authenticated but lacking DATASET_FIELD_TAGS_UPDATE for the dataset field's PARENT data entity is rejected 403 by the AuthorizationCustomizer evaluating the SecurityRule. The check is per-parent-data-entity: a caller authorized for data entity A's fields but not B's can edit A's dataset-field tags only."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:288-290 + DatasetFieldResourceExtractor.java:20-27 + PolicyPermissionDto.java:32"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "The gate lives in the global SecurityConstants.SECURITY_RULES list (path-pattern rule at :288-290), enforced by the AuthorizationCustomizer / ReactiveAuthorizationManagerFactory filter chain. The controller method has NO @PreAuthorize annotation; the service has none; the repository has none. The path-based rule is the sole gate — consistent with every other dataset-field write rule (SecurityConstants.java:282-303)."
          confidence: STATIC-INFERRED
          evidence: "DatasetFieldController.java:55-63 (no annotation) + DatasetFieldServiceImpl.java:117-132 (no annotation) + SecurityConstants.java:288-290"
  resource_boundaries:
    - location: "DatasetFieldServiceImpl.java:118"
      kind: transactional
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "Two concurrent saves of the SAME dataset field: each runs delete-all-INTERNAL then re-insert. The @ReactiveTransactional boundary serialises each call's own delete+insert, but with default READ COMMITTED isolation the two transactions can interleave such that call B's DELETE runs after call A's DELETE but before A's INSERT commits — both end states are valid replace-alls, last-commit-wins. No corrupted state, but the result is non-deterministic between the two submitted sets. Two concurrent calls submitting the SAME novel tag name both pass listByNames then both bulkCreate into the shared tag directory — the partial unique index on tag(name) makes one INSERT lose; the loser's UniqueConstraintException is NOT retried (cross-ref createDataEntityTagsRelations race finding). Whether that exception aborts the whole updateDatasetFieldTags transaction (leaving the field with NO internal tags after the delete) is the operator-visible risk."
          confidence: PROBE-NEEDED
          evidence: "P-030"
        - q: "Is the call replay-safe?"
          a: "Replaying the same payload yields the same end state (delete-all then re-insert the same set is idempotent at the relation level). The directory side effect is idempotent after the first call (the tag already exists, so getOrCreateTagsByName returns it without re-creating). The activity-feed event fires on EVERY call regardless — a replay emits a duplicate DATASET_FIELD_TAGS_UPDATED row with identical before==after state."
          confidence: STATIC-INFERRED
          evidence: "DatasetFieldServiceImpl.java:120-132 + TagServiceImpl.java:79-86 + DatasetFieldServiceImpl.java:119 (@ActivityLog fires per call)"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No cache fronts this write path — no @Cacheable, no manual cache writes in the method or its 1-hop chain. N/A."
          confidence: STATIC-INFERRED
          evidence: "DatasetFieldServiceImpl.java:117-132 (no cache annotations) + TagServiceImpl.java:79-86"
    - location: "ReactiveTagRepositoryImpl.java:367"
      kind: idempotency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "The relation INSERT ends with .onDuplicateKeyIgnore() on PK (tag_id, dataset_field_id). A duplicate (same tag resolved twice within one call, or a race re-inserting an already-present relation) is silently ignored rather than erroring. No duplicate relation rows can exist; no corruption at the relation table."
          confidence: STATIC-INFERRED
          evidence: "ReactiveTagRepositoryImpl.java:359-368 + V0_0_82__add_tag_to_dataset_field.sql:14 (PK)"
        - q: "Is the call replay-safe?"
          a: "Yes at the relation INSERT layer — onDuplicateKeyIgnore makes a re-insert of an existing (tag_id, dataset_field_id) pair a no-op."
          confidence: STATIC-INFERRED
          evidence: "ReactiveTagRepositoryImpl.java:367"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "N/A — no cache."
          confidence: STATIC-INFERRED
          evidence: "ReactiveTagRepositoryImpl.java:350-371 (no cache annotations)"
  request_inputs:
    - location: "DatasetFieldController.java:57"
      input_kind: path-param
      input_name: "datasetFieldId"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The id of the dataset field whose tags are being updated."
          confidence: STATIC-INFERRED
          evidence: "DatasetFieldController.java:56-59 + openapi.yaml:2502-2503 (DatasetFieldIdParam)"
        - q: "When supplied, what does the implementation actually USE the input for?"
          a: "Two distinct uses. (1) Authorization: the SecurityRule's DatasetFieldResourceExtractor reads {dataset_field_id} from the path and resolves it to the PARENT data-entity id via getDataEntityIdByDatasetFieldId, then evaluates DATASET_FIELD_TAGS_UPDATE against that parent (DatasetFieldResourceExtractor.java:20-27, ReactiveDatasetFieldRepositoryImpl.java:116-125). (2) Data write: passed straight through controller -> datasetFieldService.updateDatasetFieldTags(datasetFieldId, ...) -> deleteDatasetFieldInternalRelations(datasetFieldId), getUpdatedRelations(names, datasetFieldId), listDatasetFieldDtos(datasetFieldId) — all keyed on the dataset_field id itself, NOT the parent."
          confidence: STATIC-INFERRED
          evidence: "DatasetFieldController.java:56-61 + DatasetFieldServiceImpl.java:120-132 + DatasetFieldResourceExtractor.java:20-27"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES. The id names a dataset field and the data writes operate on that dataset field's relations. The authorization layer additionally resolves it to the parent data entity, but that is the documented DATASET_FIELD authorization-manager-type behaviour, not a scope mismatch of the input itself."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "DatasetFieldServiceImpl.java:120-132 + DatasetFieldResourceExtractor.java:20-27"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — no silent translation of this input."
          confidence: STATIC-INFERRED
          evidence: "DatasetFieldServiceImpl.java:120-132"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE — the dataset_field id is used directly and completely."
          confidence: STATIC-INFERRED
          evidence: "DatasetFieldServiceImpl.java:120-132"
    - location: "DatasetFieldController.java:58"
      input_kind: body-field
      input_name: "tags (field of DatasetFieldTagsUpdateFormData)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The complete list of tag names the dataset field should have after the call."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:1827-1833 + openapi.yaml:2499-2501 (summary 'Update DatasetField's tags')"
        - q: "When supplied, what does the implementation actually USE the input for?"
          a: "controller (DatasetFieldController.java:60-61) -> datasetFieldService.updateDatasetFieldTags -> new HashSet<>(formData.getTags()) (DatasetFieldServiceImpl.java:123) -> getUpdatedRelations(names, ...) -> tagService.getOrCreateTagsByName(names) (DatasetFieldServiceImpl.java:266) -> divideTagsByExistence: listByNames + bulkCreate (TagServiceImpl.java:144-159). Each resolved tag id becomes a TagToDatasetFieldPojo. The SAME formData.getTags() list is also passed to markDataEntityByTags (DatasetFieldServiceImpl.java:128) to toggle the dataset_field_tags_filled bit. The tag NAMES are used to (a) look up existing directory tags and (b) CREATE new directory tags — i.e. the input both selects and mutates the global tag directory."
          confidence: STATIC-INFERRED
          evidence: "DatasetFieldServiceImpl.java:123-128, 264-271 + TagServiceImpl.java:79-86, 144-159"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY. The field name 'tags' promises 'the tags this dataset field should have'. The implementation honours the relation-replacement promise BUT additionally CREATES rows in the global, cross-tenant tag directory for any name not already present — a side effect the field name does not imply and the OpenAPI description ('Updates DatasetField's tags', openapi.yaml:2500) does not disclose. A caller expecting 'tags' to only attach EXISTING tags has no signal from the API surface that submitting a novel string mutates global state."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "DatasetFieldServiceImpl.java:266 + TagServiceImpl.java:79-86, 152-155 + openapi.yaml:2500"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "A caller submitting tags: ['typo-tag'] expecting the call to either attach an existing tag or fail sees instead a NEW 'typo-tag' row appear in the global tag directory — visible to every other user in popular-tags, search dropdowns, and the data-entity / term tag pickers. There is no per-tenant isolation. Combined with the absence of name validation, this lets any holder of DATASET_FIELD_TAGS_UPDATE (which can be a per-data-entity owner) pollute the shared directory. The caller cannot undo it through this endpoint (no tag-delete here)."
          confidence: STATIC-INFERRED
          evidence: "TagServiceImpl.java:79-86 + cross-ref createDataEntityTagsRelations sidecar (cross-tenant tag pollution finding)"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE in the strict sense — there is no separate 'attach existing only' input. The corner-case is the OPPOSITE: the API offers only one input ('tags') and overloads it with both select-existing and create-new semantics. A caveat-or-bug for doc-gap-finder rather than an unused-column smell."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:1827-1833 + DatasetFieldServiceImpl.java:264-271"
      routes_to_finding: "bugs_limitations_corner_cases (permission side-door + no validation) AND docs_link_semantic.doc_drift_findings (auto-create undocumented for this endpoint)"
  probes_emitted:
    - probe_id: P-030
      question: "Does createDatasetFieldRelations persist a TagToDatasetFieldPojo whose origin field was never set, and does the persisted row's origin end up 'INTERNAL' (DB default) rather than NULL (constraint violation)?"
      probe_path: "lineage/odd-platform/probes/P-030.yaml"
  stress_summary:
    triggers_total: 9
    questions_total: 21
    answers_static_inferred: 17
    answers_probe_needed: 2
    answers_reference: 2
    drift_flags: 1
```

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` — the three modes that protect the UI/API surface this controller is mounted on (cross-ref class-level controller sidecars). Under `DISABLED` the endpoint is anonymously reachable — the SecurityRule remains listed but the filter chain does not enforce it (cross-ref `createDataEntityTagsRelations` DISABLED-bypass finding). `S2S` is not relevant — S2S protects `/ingestion/entities` POST only. The method carries no `@ConditionalOnProperty`; auth wiring is global.
- **ingestion_filter_relevance**: `NO — UI/API surface, not /ingestion/entities`. The `IngestionDataEntitiesFilter` matches `/ingestion/entities` POST only. NOTE: ingested dataset-field tags reach the DB via a separate codepath — `DatasetFieldServiceImpl.updateFieldsTags` (`:191-231`) writes `origin = EXTERNAL_STATISTICS` relations from `DataSetFieldStat.getTags()` during statistics ingestion — and those relations are protected from this controller's INTERNAL-scoped delete.
- **authorization_assertions**:
  - "`SecurityRule(DATASET_FIELD, '/api/datasetfields/{dataset_field_id}/tags' PUT, DATASET_FIELD_TAGS_UPDATE)` — registered in `SecurityConstants.SECURITY_RULES` at `:288-290`. The `DATASET_FIELD` authorization-manager type resolves the path's `dataset_field_id` to the parent data-entity id via `DatasetFieldResourceExtractor` (`getDataEntityIdByDatasetFieldId`), then evaluates the caller's Policies for `DATASET_FIELD_TAGS_UPDATE` (a `DATA_ENTITY`-typed permission) against that parent." — evidence: `SecurityConstants.java:288-290` + `DatasetFieldResourceExtractor.java:20-27` + `PolicyPermissionDto.java:32`
- **owner_scoping**: `RESPECTS at the parent-data-entity layer; BYPASSES at the Tag directory layer` — authorization is per-parent-data-entity (the dataset-field id is resolved to its owning data entity and the caller's Policies are evaluated against that entity). However, the resulting Tag directory rows are GLOBAL and visible to every user via the popular-tags surface, search dropdowns, and every tag picker. A per-data-entity-scoped write produces a global side effect; owner-scoping does NOT extend to the directory.
- **data_exposure**:
  - "`Flux<Tag>` payload (full updated tag set for this dataset field — id, name, important, external, usedCount per `listDatasetFieldDtos`) → caller WITH `DATASET_FIELD_TAGS_UPDATE` resolved against the parent data entity, under LOGIN_FORM/OAUTH2/LDAP. The response includes EXTERNAL / EXTERNAL_STATISTICS tags (preserved across the call) as well as the new INTERNAL set." — evidence: `DatasetFieldController.java:55-63` + `DatasetFieldServiceImpl.java:120-132` + `ReactiveTagRepositoryImpl.java:84-98`
  - "Activity-feed state record — a `DATASET_FIELD_TAGS_UPDATED` event with FULL before/after tag-state JSON (id + name per tag) → any caller who can read the dataset field's activity feed (cross-ref ActivityController.getActivity sidecar), persisting after the call." — evidence: `DatasetFieldServiceImpl.java:119, 121` + `DatasetFieldInformationUpdatedActivityHandler.java:53-67`
  - "Tag directory side effect — a previously-non-existent tag name is added to the GLOBAL `tag` table, observable to ALL authenticated users including those with no permission on the originating dataset field or its parent data entity." — evidence: `TagServiceImpl.java:79-86, 152-155` + cross-ref `createDataEntityTagsRelations` sidecar (popular-tags global surface)
  - "Same payload → ANONYMOUS callers under `auth.type=DISABLED`" — evidence: `SecurityConstants.java:288-290` + cross-ref `createDataEntityTagsRelations` DISABLED finding
- **known_security_gaps**:
  - "Tag side-door past `TAG_CREATE` — a caller holding `DATASET_FIELD_TAGS_UPDATE` on any single data entity (which can be a per-data-entity owner via a `dataEntity:owner` Policy condition) can mint global Tag directory rows by submitting novel names. The live Permissions doc presents `TAG_CREATE` (MANAGEMENT-scoped) as the tag-creation gate; `DATASET_FIELD_TAGS_UPDATE` (DATA_ENTITY-scoped) also creates tags. Worse than the data-entity sibling: that endpoint's OpenAPI text documents the auto-create; this one's does not." — evidence: `TagServiceImpl.java:79-86` + `SecurityConstants.java:288-290` + `PolicyPermissionDto.java:32` + live Permissions doc (WebFetched 2026-05-21, status 200) — severity: MEDIUM
  - "Cross-tenant Tag pollution — no organisation / tenant / namespace concept exists at the Tag directory level; once a row exists it is globally visible. Combined with the absence of tag-name validation (no length/pattern/charset), an authorized caller can saturate the directory with junk names, degrading the popular-tags query for every user." — evidence: `components.yaml:1827-1833` (no validation) + cross-ref `createDataEntityTagsRelations` cross-tenant-pollution finding — severity: MEDIUM
  - "Under `auth.type=DISABLED` the endpoint is anonymously reachable — anyone with network access can overwrite any dataset field's internal tag set and mint global Tag rows; the `@ActivityLog` event fires with undefined caller identity." — evidence: `SecurityConstants.java:288-290` + cross-ref `createDataEntityTagsRelations` DISABLED-bypass finding — severity: HIGH (under DISABLED on a network-reachable port)
  - "Possible endpoint-dead-for-non-empty-payloads failure mode — if jOOQ emits an explicit `NULL` for the unset `origin` field, every non-empty `tags` request fails the `NOT NULL` constraint. This is a correctness/availability gap rather than a classic security gap, but it is load-bearing and untested; probed by P-030." — evidence: `DatasetFieldServiceImpl.java:264-271` + `ReactiveTagRepositoryImpl.java:355-368` + `V0_0_82__add_tag_to_dataset_field.sql:12` — severity: HIGH

## performance

- **hot_paths**:
  - "Dataset-field tag-relation replace is on the per-data-entity-Structure-tab write path, not the read path. Per-call DB cost: 1x `deleteDatasetFieldInternalRelations` (DELETE ... RETURNING), 1x `listByNames` (split existing/new), 0 or 1x `bulkCreate` (only when novel names present), 1x `createDatasetFieldRelations` (batched INSERT, onDuplicateKeyIgnore), 1x `updateDatasetFieldSearchVectors`, 1x `markEntityFilled/markEntityUnfilled`, 1x `listDatasetFieldDtos` (re-read with a GROUP BY). Roughly 6-7 DB round-trips per call, plus the activity handler's two `getDatasetFieldWithTags` reads (BEFORE + AFTER) and one `getDataEntityIdByDatasetFieldId`." — evidence: `DatasetFieldServiceImpl.java:120-132` + `DatasetFieldInformationUpdatedActivityHandler.java:32-51`
- **throughput_characteristics**:
  - "Single reactive call returning a streaming `Flux<Tag>` wrapped in one `ResponseEntity` — `Mono.just(ResponseEntity.ok(tags))` (`DatasetFieldController.java:62`). Non-blocking I/O." — evidence: `DatasetFieldController.java:55-63`
  - "Delete-then-recreate, not diff — every call DELETEs all INTERNAL relations and re-INSERTs the full set, even for a no-op save. The data-entity sibling diffs and touches only changed rows. For a dataset field with many tags, a no-op save still issues a full DELETE + full INSERT." — evidence: `DatasetFieldServiceImpl.java:124-126` + `ReactiveTagRepositoryImpl.java:289-295`
  - "No bulk-dataset-field variant — one `dataset_field_id` per call; tagging N fields requires N calls." — evidence: `openapi.yaml:2497-2518` (single `DatasetFieldIdParam`)
- **resource_allocation**:
  - "`new HashSet<>(formData.getTags())` (`DatasetFieldServiceImpl.java:123`) materialises the full submitted list into heap; bounded for UI use, unbounded for an abusive caller (no `maxItems` in the schema)." — evidence: `DatasetFieldServiceImpl.java:123` + `components.yaml:1830-1833`
- **scaling_characteristics**:
  - "Stateless controller method — horizontal scaling unconstrained at this layer." — evidence: `DatasetFieldController.java:55-63` (no instance state)
  - "Single `@ReactiveTransactional` boundary at the service method (`DatasetFieldServiceImpl.java:118`) holds a DB connection from the delete through the final re-read. Real-world workload is human-scale (UI tagging is sub-second), so connection-pool contention is unlikely to dominate." — evidence: `DatasetFieldServiceImpl.java:118-132`
- **known_performance_gaps**:
  - "No method-level observability — no `@Timed`, no Micrometer counter, no structured log beyond the default WebFlux access log. A regression that, say, drops the `origin = 'INTERNAL'` filter and thereby deletes EXTERNAL_STATISTICS relations too would be invisible to metrics." — evidence: `DatasetFieldController.java:55-63` + `DatasetFieldServiceImpl.java:117-132` — severity: LOW
  - "Delete-then-recreate amplifies write cost versus the data-entity diff path — for fields with many stable tags, every save rewrites all relation rows. Low absolute cost (human-scale traffic), but a structural inefficiency relative to the sibling endpoint." — evidence: `DatasetFieldServiceImpl.java:124-126` + `TagServiceImpl.java:113-120` (the contrasting diff path) — severity: LOW
  - "Directory growth has no compaction — `getOrCreateTagsByName` grows the shared `tag` directory monotonically; the popular-tags query degrades as the directory grows over deployment lifetime (cross-ref `createDataEntityTagsRelations` directory-growth finding)." — evidence: `TagServiceImpl.java:79-86` + cross-ref `createDataEntityTagsRelations` sidecar — severity: LOW

## upstream_callers

- entry_point: "rest:PUT /api/datasetfields/{dataset_field_id}/tags"
  caller_node: "odd-platform java DatasetFieldApi (generated interface) — DatasetFieldController.updateDatasetFieldTags @Override"
  multiplicity_per_trigger: 1
  evidence: "DatasetFieldController.java:55-63 (the @Override) + openapi.yaml:2497-2518 (the generated PUT mapping)"
  observation_class: rest-call
- entry_point: "ui_route:unresolved — dataset-field tags panel on the data entity Structure tab"
  caller_node: "unresolved — odd-platform-ui Redux thunk for dataset-field tag update (not read this session)"
  multiplicity_per_trigger: unresolved
  evidence: "REFERENCE — the operationId updateDatasetFieldTags is generated into the UI's DatasetFieldApi client; the exact thunk file and dispatch multiplicity were not read this session. Future UI-pass should record the thunk and whether a useEffect re-fires (cross-ref LSN-017 view_count-doubling shape)."
  observation_class: ui-call
  unresolved: true

## downstream_side_effects

- side_effect_class: db-write
  description: "Deletes all tag_to_dataset_field rows for the dataset field WHERE origin='INTERNAL'."
  evidence: "ReactiveTagRepositoryImpl.java:289-295 (deleteDatasetFieldInternalRelations) — called at DatasetFieldServiceImpl.java:124"
  cardinality_per_call: "0..N — one DELETE statement; N = current internal relation count for the field"
  reachable_from_entry_points:
    - "rest:PUT /api/datasetfields/{dataset_field_id}/tags"
- side_effect_class: db-write
  description: "Inserts a tag_to_dataset_field relation row per submitted tag name (origin relies on DB default 'INTERNAL'; see P-030)."
  evidence: "ReactiveTagRepositoryImpl.java:350-371 (createDatasetFieldRelations) — called at DatasetFieldServiceImpl.java:126"
  cardinality_per_call: "0..N — N = distinct submitted tag names; 0 when tags is empty"
  reachable_from_entry_points:
    - "rest:PUT /api/datasetfields/{dataset_field_id}/tags"
- side_effect_class: db-write
  description: "Auto-creates a row in the GLOBAL tag directory for each submitted name not already present (important=false)."
  evidence: "TagServiceImpl.java:79-86 (getOrCreateTagsByName) -> ReactiveTagRepositoryImpl bulkCreate; called via DatasetFieldServiceImpl.java:266"
  cardinality_per_call: "0..N — N = count of submitted names absent from the tag directory"
  reachable_from_entry_points:
    - "rest:PUT /api/datasetfields/{dataset_field_id}/tags"
- side_effect_class: db-write
  description: "Toggles data_entity_filled.dataset_field_tags_filled for the dataset field's parent data entity (filled when tags non-empty, unfilled when empty)."
  evidence: "DatasetFieldServiceImpl.java:128, 253-262 (markDataEntityByTags)"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "rest:PUT /api/datasetfields/{dataset_field_id}/tags"
- side_effect_class: db-write
  description: "Refreshes the dataset-field search vector so the new tag set is searchable."
  evidence: "DatasetFieldServiceImpl.java:127 (updateDatasetFieldSearchVectors)"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "rest:PUT /api/datasetfields/{dataset_field_id}/tags"
- side_effect_class: activity-emit
  description: "Emits a DATASET_FIELD_TAGS_UPDATED activity event with full before/after tag-state JSON (id + name per tag)."
  evidence: "DatasetFieldServiceImpl.java:119 (@ActivityLog) + DatasetFieldInformationUpdatedActivityHandler.java:53-67 (getState serialises the tag list)"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "rest:PUT /api/datasetfields/{dataset_field_id}/tags"
- side_effect_class: page-render
  description: "Returns the full updated tag set (Flux<Tag>) for the dataset field, including preserved EXTERNAL / EXTERNAL_STATISTICS tags."
  evidence: "DatasetFieldController.java:60-62 + DatasetFieldServiceImpl.java:129-131 + ReactiveTagRepositoryImpl.java:84-98 (listDatasetFieldDtos)"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "rest:PUT /api/datasetfields/{dataset_field_id}/tags"

## sources

- understanding ← `DatasetFieldController.java:55-63` (the four-line method) + `DatasetFieldServiceImpl.java:117-132` (the service with `@ReactiveTransactional` + `@ActivityLog`) + `ReactiveTagRepositoryImpl.java:289-295` (the INTERNAL-scoped delete) + `TagServiceImpl.java:79-86` (auto-create-on-miss) + `SecurityConstants.java:288-290` (authorization gate) + `DatasetFieldResourceExtractor.java:20-27` (parent-scoped resolution) + `V0_0_82__add_tag_to_dataset_field.sql:12` (the `origin` column default) + cross-ref `createDataEntityTagsRelations` sidecar (sibling-endpoint comparison)
- concepts.entities ← `DatasetFieldController.java:8, 15` (`DatasetFieldTagsUpdateFormData`, `Tag` imports) + `components.yaml:1827-1833` (`DatasetFieldTagsUpdateFormData` schema) + `V0_0_82__add_tag_to_dataset_field.sql:8-18` (`tag_to_dataset_field` table) + `DatasetFieldInformationUpdatedActivityHandler.java:53-67` (activity-state DTOs)
- concepts.operations ← `DatasetFieldServiceImpl.java:117-132` + `TagServiceImpl.java:79-86, 144-159` + `DatasetFieldResourceExtractor.java:20-27` + `ReactiveDatasetFieldRepositoryImpl.java:116-125`
- concepts.invariants[0] (single tx boundary) ← `DatasetFieldServiceImpl.java:118` + `TagServiceImpl.java:79` (no annotation on `getOrCreateTagsByName`)
- concepts.invariants[1] (delete-all-then-recreate) ← `DatasetFieldServiceImpl.java:124-126` + `ReactiveTagRepositoryImpl.java:289-295` + `TagServiceImpl.java:113-120` (contrasting data-entity diff)
- concepts.invariants[2] (EXTERNAL protection) ← `ReactiveTagRepositoryImpl.java:289-295` (the `origin = 'INTERNAL'` filter) + `TagOrigin.java:3-7` + `DatasetFieldServiceImpl.java:191-231` (EXTERNAL_STATISTICS ingestion path)
- concepts.invariants[3] (important=false) ← `TagServiceImpl.java:152-155`
- concepts.invariants[4] (full activity state) ← `DatasetFieldServiceImpl.java:119, 121` + `DatasetFieldInformationUpdatedActivityHandler.java:32-67`
- concepts.invariants[5] (onDuplicateKeyIgnore) ← `ReactiveTagRepositoryImpl.java:367` + `V0_0_82__add_tag_to_dataset_field.sql:14`
- concepts.invariants[6] (HashSet de-dup) ← `DatasetFieldServiceImpl.java:123`
- dependencies_semantic.requires-feature ← `SecurityConstants.java:288-290` + `DatasetFieldServiceImpl.java:119, 127-128` + `V0_0_82__add_tag_to_dataset_field.sql:1-2`
- dependencies_semantic.couples-to ← `openapi.yaml:2497-2518` + `DatasetFieldServiceImpl.java:117-132` + `TagServiceImpl.java:79-86` + `ReactiveTagRepositoryImpl.java:289-295, 350-371, 84-98` + `SecurityConstants.java:288-290` + `DatasetFieldResourceExtractor.java:10-28` + `PolicyPermissionDto.java:32`
- tests_coverage_semantic ← Grep of `odd-platform-api/src/test` for `updateDatasetFieldTags` / `DatasetFieldTagsUpdate` / `deleteDatasetFieldInternalRelations` (zero matches) + `TagRepositoryImplTest.java` (no dataset-field tag-relation methods, Grep confirmed)
- docs_link_semantic.inferred_docs ← WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions` (2026-05-21, status 200) + WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization` (2026-05-21, status 200)
- docs_link_semantic.doc_drift_findings ← `openapi.yaml:2499-2501` (spec summary/description) vs `TagServiceImpl.java:79-86` (auto-create) + `V0_0_82__add_tag_to_dataset_field.sql:1-2` (label->tag rename)
- implicit_adrs[0] (parent-scoped auth) ← `DatasetFieldResourceExtractor.java:20-27` + `ReactiveDatasetFieldRepositoryImpl.java:116-125` + `PolicyPermissionDto.java:32` + `SecurityConstants.java:288-290`
- implicit_adrs[1] (channel ownership) ← `ReactiveTagRepositoryImpl.java:289-295` + `TagOrigin.java:3-7` + `DatasetFieldServiceImpl.java:217-227`
- implicit_adrs[2] (origin column default) ← `V0_0_82__add_tag_to_dataset_field.sql:12` + `DatasetFieldServiceImpl.java:264-271` + `TagServiceImpl.java:106-109`
- implicit_adrs[3] (full activity state) ← `DatasetFieldInformationUpdatedActivityHandler.java:32-67` + `DatasetFieldServiceImpl.java:119`
- implicit_adrs[4] (single tx boundary) ← `DatasetFieldServiceImpl.java:118` + `TagServiceImpl.java:79-86`
- bugs_limitations_corner_cases[0] (unset-origin INSERT) ← `DatasetFieldServiceImpl.java:264-271` + `ReactiveTagRepositoryImpl.java:355-368` + `V0_0_82__add_tag_to_dataset_field.sql:12` + `TagServiceImpl.java:106-109`
- bugs_limitations_corner_cases[1] (TAG_CREATE side-door) ← `TagServiceImpl.java:79-86` + `SecurityConstants.java:288-290` + `PolicyPermissionDto.java:32` + live Permissions doc
- bugs_limitations_corner_cases[2] (empty-tags wipe) ← `components.yaml:1827-1833` + `DatasetFieldServiceImpl.java:123, 253-262`
- bugs_limitations_corner_cases[3] (delete-then-recreate churn) ← `DatasetFieldServiceImpl.java:124-126` + `ReactiveTagRepositoryImpl.java:289-295` + `TagServiceImpl.java:113-120`
- bugs_limitations_corner_cases[4] (DISABLED bypass) ← `SecurityConstants.java:288-290` + cross-ref `createDataEntityTagsRelations` sidecar
- bugs_limitations_corner_cases[5,6] (no validation / no cap) ← `components.yaml:1827-1833` + `DatasetFieldServiceImpl.java:123` + `TagServiceImpl.java:152-155`
- stress_findings ← `DatasetFieldController.java:55-63` + `DatasetFieldServiceImpl.java:117-132` + `ReactiveTagRepositoryImpl.java:289-295, 350-371` + `TagServiceImpl.java:79-86` + `SecurityConstants.java:288-290` + `DatasetFieldResourceExtractor.java:20-27` + P-030
- security ← `SecurityConstants.java:288-290` + `DatasetFieldResourceExtractor.java:20-27` + `PolicyPermissionDto.java:32` + `DatasetFieldServiceImpl.java:191-231` + live Permissions doc + cross-ref `createDataEntityTagsRelations` sidecar
- performance ← `DatasetFieldServiceImpl.java:117-132` + `ReactiveTagRepositoryImpl.java:289-295, 350-371, 84-98` + `DatasetFieldInformationUpdatedActivityHandler.java:32-51`
- upstream_callers ← `DatasetFieldController.java:55-63` + `openapi.yaml:2497-2518`
- downstream_side_effects ← `DatasetFieldServiceImpl.java:120-132` + `ReactiveTagRepositoryImpl.java:289-295, 350-371, 84-98` + `TagServiceImpl.java:79-86` + `DatasetFieldInformationUpdatedActivityHandler.java:53-67`

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: MEDIUM — the two live WebFetches are status 200 and quoted; the inferred-docs confidence stays LOW because no `@docs` annotation declares these pages; doc_drift_findings are HIGH (code-vs-spec, statically grounded).
- implicit_adrs: HIGH (ADRs 0,1,3) / MEDIUM (ADRs 2,4 — column-default-reliance and single-tx-boundary read as intentional but no comment articulates the WHY)
- bugs_limitations_corner_cases: HIGH for the findings themselves; the unset-origin INSERT finding's *severity* is HIGH but its *resolution* (constraint violation vs. correct default) is PROBE-NEEDED — P-030.
- security: HIGH
- performance: HIGH
- upstream_callers: MEDIUM — the REST entry point is HIGH-confidence; the UI caller is an unresolved REFERENCE.
- downstream_side_effects: HIGH — all side effects traced to file:line within this node and its 1-hop chain; the only entry point is the single REST operation.
- stress_findings: MEDIUM — 17 of 21 questions resolve STATIC-INFERRED with strong evidence, but the single load-bearing correctness question (does the unset-origin relation INSERT persist at all?) is PROBE-NEEDED (P-030); until P-030 resolves, the sidecar cannot claim HIGH on whether the endpoint even functions for non-empty payloads. Hence `confidence_overall: MEDIUM`.

## Maintainer notes


---
node_id: "odd-platform java DataEntityController controller-method:upsertDataEntityMetadataFieldValue"
node_kind: controller-method
axis: controllers
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.2.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-19-L
---

# DataEntityController#upsertDataEntityMetadataFieldValue — semantic understanding

## understanding

`upsertDataEntityMetadataFieldValue` is the reactive `PUT /api/dataentities/{data_entity_id}/metadata/{metadata_field_id}` handler — a four-line pipeline that reads `@Valid Mono<MetadataFieldValueUpdateFormData>`, delegates to `dataEntityService.upsertMetadataFieldValue(dataEntityId, metadataFieldId, form)`, and lifts the resulting `MetadataFieldValue` (the persisted field + new value) into `200 OK`. The endpoint is the **per-row mutator on the custom-metadata write surface** (paired with `createDataEntityMetadataFieldValue` POST for bulk-add and `deleteDataEntityMetadataFieldValue` DELETE). Authorization IS enforced — a `SecurityRule(DATA_ENTITY, '/api/dataentities/{data_entity_id}/metadata/{metadata_field_id}', PUT, DATA_ENTITY_CUSTOM_METADATA_UPDATE)` entry at `SecurityConstants.java:204-207` wires the `DATA_ENTITY_CUSTOM_METADATA_UPDATE` Policy permission to this exact path, so this is NOT a REFACTOR-199-family auto-create-on-miss permission-bypass. However, the implementation is misnamed: the underlying repository call is a pure `UPDATE … WHERE (data_entity_id, metadata_field_id) match` (`ReactiveMetadataFieldValueRepositoryImpl.java:95-104`) — if the `(dataEntityId, metadataFieldId)` pair has no existing row in `metadata_field_value`, the UPDATE matches zero rows, the inner `Mono` collapses to empty, and the response is **200 OK with empty body** rather than 404. This is the **same silent-200-on-missing pattern as `upsertDataEntityInternalDescription`** (batch G, identical pattern in the same controller). Three further substantive findings stand out: (1) the underlying value column is `text` and stores `formData.getValue()` (a raw `String` per OpenAPI) verbatim with **no validation against `metadata_field.type`** — a STRING-typed field accepts `"42"` but so does an INTEGER-typed field; (2) **no `@ActivityLog` annotation** despite a `CUSTOM_METADATA_UPDATED` entry existing in `ActivityEventTypeDto.java:18` — so update events are NOT recorded in the activity feed despite the enum reserving the slot; (3) the path accepts ANY `metadataFieldId` including EXTERNAL-origin fields populated by collectors — an authorised user can overwrite ingestion-populated values, and the override persists until the next ingestion run.

## concepts

- entities: [
    "`MetadataFieldValue` (response payload — `{field: MetadataField, value: String}`, both required per `components.yaml:2123-2132`)",
    "`MetadataFieldValueUpdateFormData` (request body — `{value: String (required), origin: MetadataFieldOrigin (optional)}` per `components.yaml:2144-2152`; the `origin` field is accepted by the spec but silently ignored by the impl)",
    "`MetadataFieldPojo` (jOOQ row from `metadata_field` table — `{id, type, name, origin, is_deleted}` per `V0_0_1__init.sql:166-173`; origin is `INTERNAL` or `EXTERNAL`, type is one of 8 `MetadataTypeEnum` values)",
    "`MetadataFieldValuePojo` (jOOQ row from `metadata_field_value` — `{data_entity_id, metadata_field_id, value (text), active (boolean, DEFAULT TRUE)}`, composite PK `(data_entity_id, metadata_field_id)` per `V0_0_1__init.sql:175-186`)",
    "`MetadataDto` (internal tuple wrapping `(MetadataFieldPojo, MetadataFieldValuePojo)` for the mapper)"
  ]
- operations: [
    "`update-metadata-field-value` — `metadataFieldService.get(metadataFieldId)` → `reactiveMetadataFieldValueRepository.update(pojo)` → `reactiveSearchEntrypointRepository.updateMetadataVectors(dataEntityId)` → map to `MetadataFieldValue` response",
    "`resolve-field-metadata` — `MetadataFieldServiceImpl.get` throws `NotFoundException(\"Metadata field with id %d not found\")` if the field row is missing (`MetadataFieldServiceImpl.java:30-34`) — but does NOT validate that the field is INTERNAL-origin or that the value matches the field's declared type",
    "`refresh-metadata-fts-vector` — `reactiveSearchEntrypointRepository.updateMetadataVectors(dataEntityId)` re-tokenises the entity's metadata into the FTS index after every update"
  ]
- invariants: [
    "OpenAPI marks `value` REQUIRED (`components.yaml:2151-2152`) but as a free-form `string` with no `maxLength`, `pattern`, `minLength`, or `format` constraint. The DB column is `text` (unbounded per `V0_0_1__init.sql:179`).",
    "**Endpoint is an UPDATE, not an UPSERT** — `ReactiveMetadataFieldValueRepositoryImpl.update` (line 95-104) is `DSL.update(METADATA_FIELD_VALUE).set(VALUE, ...).set(ACTIVE, pojo.getActive()).where(METADATA_FIELD_ID.eq(...).and(DATA_ENTITY_ID.eq(...))).returning()`. If no row exists for the `(dataEntityId, metadataFieldId)` pair, the query matches zero rows, `mono(query).map(r -> r.into(MetadataFieldValuePojo.class))` returns `Mono.empty`, the rest of the pipeline (search-vector refresh, mapper) is short-circuited via empty-mono propagation, and the controller returns `200 OK` with an empty body. The path lacks any `switchIfEmpty(Mono.error(new NotFoundException(...)))` — there is no 404 for the missing-pair case.",
    "`MetadataFieldServiceImpl.get(metadataFieldId)` DOES throw `NotFoundException` if the metadata-field row is missing (`MetadataFieldServiceImpl.java:31-33`). So a non-existent `metadataFieldId` → 404, but a non-existent `dataEntityId` → 200-with-empty-body, AND a valid-but-unpaired `(dataEntityId, metadataFieldId)` → 200-with-empty-body.",
    "**No type validation** — `formData.getValue()` is a raw `String` written verbatim into the `text` column without coercion to or validation against the field's declared `MetadataTypeEnum` type (INTEGER / FLOAT / BOOLEAN / DATETIME / ARRAY / JSON / STRING / UNKNOWN). A user can write `\"not a number\"` to an INTEGER-typed field; nothing reads or enforces the type at write time.",
    "**No origin check** — the upsert path does not call `metadataFieldPojo.getOrigin()`; both INTERNAL and EXTERNAL fields are writable through this endpoint. EXTERNAL fields are normally populated by collectors during ingestion (`MetadataFieldServiceImpl.java:62-71` `ingestMetadataFields`); a user with `DATA_ENTITY_CUSTOM_METADATA_UPDATE` who knows an EXTERNAL field's id can overwrite the ingested value, and that override persists until the next ingestion cycle replaces it.",
    "**`active` column gets set to NULL on every update** — `ReactiveMetadataFieldValueRepositoryImpl.java:98` does `.set(METADATA_FIELD_VALUE.ACTIVE, pojo.getActive())`, but the upsert path's pojo (constructed at `DataEntityServiceImpl.java:292-295`) never calls `.setActive(...)`. `getActive()` returns `null` (`Boolean` is a boxed reference in the jOOQ-generated POJO). The DB column is `boolean DEFAULT TRUE` per `V0_0_1__init.sql:180`, so an UPDATE writing NULL drops the column from TRUE to NULL — the DEFAULT applies on INSERT only, not UPDATE.",
    "OpenAPI declares an optional `origin` on the form (`components.yaml:2149-2150`) but the impl reads only `value` (`DataEntityServiceImpl.java:295`) — `origin` is silently dropped on the wire.",
    "Search vector refresh happens on success (`DataEntityServiceImpl.java:300-302`); on the silent-200-empty-body path, the refresh is short-circuited and the FTS index retains stale tokens.",
    "`@ReactiveTransactional` on `upsertMetadataFieldValue` (`DataEntityServiceImpl.java:288`) — the metadata-field lookup, the value UPDATE, and the search-vector refresh all commit (or all roll back) atomically."
  ]
- audiences: [
    "ODD Platform UI — entity-detail page `Overview > Metadata` panel, `MetadataItem` row edit. Write via `updateDataEntityCustomMetadata` redux thunk (`metadata.thunks.ts:33-56`) — the UI hardcodes a 'Metadata successfully updated.' toast on any 200 response without inspecting whether the response body is populated.",
    "Callers WITH `DATA_ENTITY_CUSTOM_METADATA_UPDATE` permission resolved per-data-entity. The permission can be granted via admin Policy (global) or per-entity Policy (typically scoped via `\"is\": \"dataEntity:owner\"` for owners-only edit). Listed verbatim in operator docs at `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions` (verified 2026-05-19, 200).",
    "FTS consumers — every catalog search includes the metadata vector content; the upsert touches `metadata_vector` (`search_entrypoint.metadata_vector` per `V0_0_1__init.sql:193`)."
  ]

## dependencies_semantic

- requires-feature: [
    "`DataEntityService.upsertMetadataFieldValue` (`DataEntityServiceImpl.java:287-305`, `@ReactiveTransactional`) — owns the orchestration: resolve field metadata → write value → refresh FTS vector → map to response",
    "`MetadataFieldService.get` (`MetadataFieldServiceImpl.java:30-34`) — throws `NotFoundException` if the metadata-field row is missing; returns `MetadataFieldPojo` if present",
    "`ReactiveMetadataFieldValueRepository.update` (`ReactiveMetadataFieldValueRepositoryImpl.java:95-104`) — the jOOQ UPDATE statement that silently no-ops on missing `(dataEntityId, metadataFieldId)` pair",
    "`ReactiveSearchEntrypointRepository.updateMetadataVectors(long)` — rebuilds the full-text search vector for the data entity's metadata (`search_entrypoint.metadata_vector`)",
    "`MetadataFieldValueMapper.mapDto(MetadataDto)` — combines field metadata + value into the response payload `MetadataFieldValue`",
    "OpenAPI-generated `DataEntityApi.upsertDataEntityMetadataFieldValue` interface — supplies the `PUT /api/dataentities/{data_entity_id}/metadata/{metadata_field_id}` mapping, `@Valid @RequestBody`, the path parameters `DataEntityIdParam` + `DataEntityMetadataFieldIdParam`, and the `200 → MetadataFieldValue` response (`openapi.yaml:1217-1239`)"
  ]
- requires-config: [
    "`auth.type` (DISABLED / LOGIN_FORM / OAUTH2 / LDAP) — gates which `SecurityWebFilterChain` is active. The SECURITY_RULES list (including the `DATA_ENTITY_CUSTOM_METADATA_UPDATE` mapping) is consulted only by the LOGIN_FORM / OAUTH2 / LDAP chains. Under DISABLED, the disabled-auth chain `permitAll()`s every exchange and the metadata-update permission is NEVER checked — anonymous traffic can write metadata values."
  ]
- requires-runtime: [
    "Spring WebFlux (`@RestController` on `DataEntityController.java:67`; reactive `Mono` pipeline)",
    "Reactor Core (`Mono.flatMap` / `map` composition; empty-mono short-circuit semantics that produce the silent-200-on-missing behaviour)",
    "jOOQ + R2DBC reactive Postgres bindings (`ReactiveMetadataFieldValueRepositoryImpl.update`)",
    "Postgres `metadata_field` + `metadata_field_value` tables (`V0_0_1__init.sql:166-186`) — `metadata_field_value.value` is `text` (unbounded), composite PK `(data_entity_id, metadata_field_id)`, FK constraints to `data_entity(id)` and `metadata_field(id)`"
  ]
- coupling: [
    "Authorization — protected by `SecurityRule(DATA_ENTITY, '/api/dataentities/{data_entity_id}/metadata/{metadata_field_id}', PUT, DATA_ENTITY_CUSTOM_METADATA_UPDATE)` (`SecurityConstants.java:204-207`). The controller method has NO `@PreAuthorize`. Permission is resource-scoped via `DataEntityPermissionExtractor` → `permissionService.getResourcePermissionsForCurrentUser(DATA_ENTITY, dataEntityId)`. The Policy condition can scope the permission to entity-owner via `dataEntity:owner`.",
    "**Metadata-field cross-entity coupling** — the `metadata_field` table is GLOBAL (no tenant / owner column per `V0_0_1__init.sql:166-173`). A metadata field name `cost_centre` typed STRING with id 42 is the SAME field for every data entity. Editing the value of `(entity_1, 42)` does not affect `(entity_2, 42)`, but the `MetadataField` definition (name + type + origin) is shared. There is no platform-side mechanism to namespace metadata fields per team / project / owner.",
    "FTS coupling — metadata values are tokenised into the entity's search vector. A long / keyword-dense metadata value gives this entity higher rank on those tokens.",
    "Activity-feed coupling — `CUSTOM_METADATA_UPDATED` is declared as an `ActivityEventTypeDto` enum value (`ActivityEventTypeDto.java:18`) but is NEVER emitted from this code path (no `@ActivityLog` annotation on `upsertMetadataFieldValue`). The activity feed thus shows metadata creations and deletions are also un-annotated; the `CUSTOM_METADATA_CREATED`, `CUSTOM_METADATA_UPDATED`, and `CUSTOM_METADATA_DELETED` enum values are reserved-but-never-fired.",
    "UI-toast coupling — the redux thunk (`metadata.thunks.ts:51-54`) emits 'Metadata successfully updated.' on any non-error response. Because the controller returns 200 with empty body on missing-pair, the UI claims success on writes that did not happen."
  ]

## tests_coverage_semantic

- covered_behaviours: [
    "Happy-path service-layer test — `DataEntityServiceTest.upsertMetadataFieldValueTest` (`DataEntityServiceTest.java:164-191`) mocks `metadataFieldService.get` to return a STRING-typed INTERNAL-origin field, mocks `reactiveMetadataFieldValueRepository.update` to return the persisted pojo, and asserts the mapper output is propagated. Verifies the pipeline composition only — no behavioural assertions about type validation, origin restrictions, or the missing-pair empty-mono case."
  ]
- uncovered_behaviours: [
    "Happy-path HTTP smoke test — no `WebTestClient` exercises `PUT /api/dataentities/{id}/metadata/{field_id}` end-to-end (request → controller → service → repository → response).",
    "**404-on-missing-data-entity path** — no test asserts what happens when `dataEntityId` is invalid (the data entity row doesn't exist). The current code returns `200 OK` with empty body via the silent UPDATE no-op (no `reactiveDataEntityRepository.get(dataEntityId)` validation, unlike `createMetadata` which DOES check at `DataEntityServiceImpl.java:257-258`).",
    "**Missing-pair path** — no test asserts what happens when both `dataEntityId` and `metadataFieldId` are valid but no row exists in `metadata_field_value` for that pair (e.g. caller targets a field that was never `created` for this entity). The current code returns 200-with-empty-body. The UI claims success.",
    "**Type-mismatch validation** — no test asserts that writing `\"not a number\"` to an INTEGER-typed field is accepted (it is). No test asserts what happens at the read side — does the response payload coerce or not?",
    "**EXTERNAL-origin field overwrite** — no test asserts whether a user can overwrite an EXTERNAL field's value (they can; nothing checks `origin` on the upsert path).",
    "**`active`-to-NULL regression** — no test asserts that the UPDATE preserves the `active=TRUE` state. As implemented, every upsert writes `active=NULL` because the pojo's `getActive()` is null (`DataEntityServiceImpl.java:292-295` never calls `setActive`); the `boolean DEFAULT TRUE` column-default only applies on INSERT.",
    "**Missing-metadata-field path** — `MetadataFieldService.get` throws `NotFoundException` (`MetadataFieldServiceImpl.java:31-33`); a test confirms the propagation upward but doesn't verify the HTTP-level 404 response.",
    "Concurrency — no test exercises two simultaneous PUTs against the same `(dataEntityId, metadataFieldId)` (last-writer-wins behaviour vs lost-update).",
    "Activity-event emission — no test asserts whether a `CUSTOM_METADATA_UPDATED` activity event is emitted (it is NOT — the impl has no `@ActivityLog` despite the enum value existing).",
    "Authorization — no test asserts that a caller WITHOUT `DATA_ENTITY_CUSTOM_METADATA_UPDATE` is rejected with 403, no test asserts the `dataEntity:owner` scoped Policy correctly grants only on the entity the caller owns.",
    "**DISABLED-mode reachability** — no test asserts the endpoint accepts unauthenticated requests under `auth.type=DISABLED`.",
    "Very-long value — no test exercises >1 MiB metadata values to confirm the unbounded `text` column accepts them or to characterise the request-size limit at the WebFlux layer.",
    "Bidirectional code↔doc test — no test asserts that the `MetadataFieldType` enum (`components.yaml:2077-2086`) is honoured at write time. The OpenAPI ENUM is documentation-only.",
    "FTS vector refresh — no test asserts that updating a metadata value refreshes the search vector and that the new content is matchable by a subsequent search."
  ]
- test_files: [
    "`odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/service/DataEntityServiceTest.java:164-191` — single happy-path mocked unit test for `upsertMetadataFieldValueTest`. No integration / WebTestClient / 404-path / type-validation / origin-restriction / activity-emission / authorization tests."
  ]
- gaps: |
    The endpoint is a write path with five untested side-effects (DB UPDATE, search vector refresh, no activity emission, `active`-to-NULL regression, EXTERNAL-origin overwrite) and a single happy-path mocked test. The combination of:

    (a) **silent UPDATE-not-UPSERT** (`200 OK` returned when the data entity doesn't exist OR when the (entity, field) pair has no existing row — operators cannot distinguish "successfully wrote" from "id was wrong");
    (b) **no type validation** against `MetadataFieldType` — a STRING-declared field and an INTEGER-declared field both accept arbitrary text bodies;
    (c) **no origin restriction** — EXTERNAL fields (collector-populated) are writable through this endpoint, and the value will persist until the next ingestion cycle overwrites it;
    (d) **no `@ActivityLog`** — the activity feed shows zero record of metadata updates, even though `CUSTOM_METADATA_UPDATED` is reserved in the enum;
    (e) **`active=NULL` regression on update** — every upsert silently drops the row's `active` flag from TRUE to NULL, which may affect downstream queries that filter `WHERE active = TRUE`;
    (f) **DISABLED-mode reachability** — anonymous traffic can rewrite metadata values, including EXTERNAL collector-populated fields;

    makes regressions here invisible and discoverable only by operators who notice metadata values change silently after a UI action. The highest-likelihood regression sites:

    - **Silent overwrite of collector-ingested metadata** — a user with `DATA_ENTITY_CUSTOM_METADATA_UPDATE` (typically granted to entity owners) can overwrite a `cost_centre` field populated by the collector. The next collector run replaces it, but in the interim the catalog shows the user's edit as authoritative. No audit trail records the overwrite.
    - **Stale FTS index on missing-pair** — the search vector refresh is short-circuited in the empty-mono path, so if the caller targets a never-created pair, the vector is stale (but: there was no value to index for that pair anyway, so the practical impact is nil — this is a low-severity inconsistency).
    - **`active=NULL` after first edit** — if any platform code filters `WHERE metadata_field_value.active = TRUE` (rather than `IS DISTINCT FROM FALSE`), edited rows would silently disappear from those queries. The actual downstream usage of the `active` column needs auditing to gauge severity.

## docs_link_semantic

- declared_docs: [] — N/A. The source file carries no `@docs` Javadoc annotation; consistent with this repo's convention.
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions"
    anchor: ""
    rationale: "Defines `DATA_ENTITY_CUSTOM_METADATA_UPDATE` (the permission this endpoint enforces) and its siblings `DATA_ENTITY_CUSTOM_METADATA_CREATE` and `DATA_ENTITY_CUSTOM_METADATA_DELETE`. Verified live this session — 200, verbatim text quoted below."
    last_verified_at: "2026-05-19T00:00:00Z"
    last_verified_status: "200"
    confidence: HIGH
    fetched_excerpts: |
      Verbatim from live fetch 2026-05-19:
        DATA_ENTITY_CUSTOM_METADATA_CREATE: "Allows creating custom metadata for a data entity."
        DATA_ENTITY_CUSTOM_METADATA_UPDATE: "Allows editing custom metadata on a data entity."
        DATA_ENTITY_CUSTOM_METADATA_DELETE: "Allows deleting custom metadata from a data entity."
  - url: "https://docs.opendatadiscovery.org/active-platform-features/activity-feed"
    anchor: ""
    rationale: "Activity Feed page lists supported event types. The `CUSTOM_METADATA_UPDATED` event type is declared in `ActivityEventTypeDto.java:18` but never emitted from this endpoint — the docs may list it as a tracked event type, which would be a doc-code drift if so. Not re-verified this session; flagged as candidate for next-batch verification."
    last_verified_at: "N/A — not fetched this session"
    last_verified_status: "not-verified"
    confidence: LOW
    fetched_excerpts: |
      N/A — not fetched. The maintainer should fetch the live page and confirm whether it lists CUSTOM_METADATA_UPDATED as a tracked event type, which would be a documented capability the code does not actually deliver.
- doc_drift_findings: [
    "**Doc-gap candidate**: no operator-facing documentation page exists for the custom-metadata feature itself (the data-discovery directory `documentation/docs/data-discovery/` has `metadata-stale.md` for the staleness indicator but no page describing the custom-metadata write surface, the type enum, the per-entity metadata panel, the API endpoint, or the EXTERNAL/INTERNAL distinction). Operators who want to use custom metadata cannot read about its semantics anywhere except the permissions reference.",
    "**Doc-gap candidate**: the `MetadataFieldType` enum (INTEGER / STRING / DATETIME / FLOAT / BOOLEAN / ARRAY / JSON per `components.yaml:2077-2086`) is published in the OpenAPI spec but no doc page describes what the types mean, whether they are validated at write time (they are NOT — see `bugs_limitations_corner_cases`), or how mismatched values are rendered.",
    "**Doc-gap candidate**: the misleading `upsert` operationId — the endpoint is documented as 'Upsert DataEntity's metadata field value' (`openapi.yaml:1219-1220`) but the implementation is pure UPDATE with silent no-op on missing pair. A user reading the OpenAPI summary would expect a POST-or-PUT-semantics upsert; the actual semantics are 'replace if exists, silently succeed if missing'.",
    "**Doc-gap candidate**: no documentation page covers the EXTERNAL-vs-INTERNAL origin distinction or the fact that EXTERNAL fields (collector-populated) are mutable through this endpoint. Operators evaluating ODD cannot determine from the docs whether catalog metadata is authoritative-from-source or can-be-overridden-via-UI.",
    "**Doc-code drift candidate**: `CUSTOM_METADATA_UPDATED` is declared as an `ActivityEventTypeDto` enum value (`ActivityEventTypeDto.java:18`) and is exposed via the public `ActivityEventType` OpenAPI enum (consumed by `GET /api/activity`). If the activity-feed documentation lists this event type, that listing is a false promise — the code never emits it. Needs WebFetch verification of the activity-feed doc page."
  ]

## implicit_adrs

- "Metadata-field metadata is GLOBAL across the platform (no tenant / project / owner column on `metadata_field`) — the platform's design intent is that `cost_centre:STRING:INTERNAL` is a single shared definition, and per-entity values are the only thing scoped per data entity." — evidence: `V0_0_1__init.sql:166-173` (no scoping column) + `MetadataFieldServiceImpl.java:43-58` `getOrCreateMetadataFields` (matches existing fields by `MetadataKey(name, type)` regardless of caller, so two teams creating `cost_centre:STRING` collapse to one row). — intent_anchor: the `MetadataKey(fieldName, fieldType)` record (`MetadataKey.java:6-15`) acts as a global natural key — same name+type means same field. — confidence: HIGH
- "Custom-metadata write is gated by THREE distinct permissions (CREATE / UPDATE / DELETE), distinct from `DATA_ENTITY_DESCRIPTION_UPDATE` and `DATA_ENTITY_INTERNAL_NAME_UPDATE` — administrators can grant edit rights to metadata independently of descriptions and names." — evidence: `PolicyPermissionDto.java:15-17` (three separate enum values) + `SecurityConstants.java:201-211` (three separate SECURITY_RULES entries for POST, PUT, DELETE). — intent_anchor: three separate enum values plus three separate SECURITY_RULES entries register the privilege model deliberately (a contrast with the alternative of a single `DATA_ENTITY_METADATA_WRITE` permission). — confidence: HIGH
- "Custom-metadata writes are `@ReactiveTransactional` — the metadata-field lookup, the value UPDATE, and the search-vector refresh all commit (or all roll back) atomically." — evidence: `DataEntityServiceImpl.java:288` (`@ReactiveTransactional` on `upsertMetadataFieldValue`). — intent_anchor: the explicit annotation reflects the intent that a partial-failure state (e.g. value written but search vector not refreshed) is forbidden. — confidence: HIGH
- "Metadata write triggers FTS vector refresh — metadata content drives search ranking." — evidence: `DataEntityServiceImpl.java:300-302` (`reactiveSearchEntrypointRepository.updateMetadataVectors(dataEntityId)` immediately after the value UPDATE) + `V0_0_1__init.sql:193` (`metadata_vector` is a component of `search_entrypoint.search_vector`). — intent_anchor: explicit `.then` chaining of the vector refresh into the same reactive pipeline as the write encodes the intent that metadata is searchable. — confidence: HIGH

## bugs_limitations_corner_cases

- "**Silent 200-on-missing pair** — when `(dataEntityId, metadataFieldId)` has no existing row in `metadata_field_value`, `ReactiveMetadataFieldValueRepositoryImpl.update` matches zero rows, the `Mono` collapses to empty, the FTS vector refresh and mapper are short-circuited, and the controller returns `200 OK` with an empty body rather than `404 Not Found`. The UI's redux thunk (`odd-platform-ui/src/redux/thunks/metadata.thunks.ts:51-54`) hardcodes a 'Metadata successfully updated.' success toast on any non-error response, so the user is told the write succeeded when no row was touched. Same pattern as `upsertDataEntityInternalDescription` (batch G)." — evidence: `ReactiveMetadataFieldValueRepositoryImpl.java:95-104` (UPDATE-with-WHERE, no `switchIfEmpty`) + `DataEntityServiceImpl.java:287-305` (no `reactiveDataEntityRepository.get` check, no `switchIfEmpty`) + `metadata.thunks.ts:51-54` (hardcoded success toast). — severity: MEDIUM
- "**Silent 200-on-missing data entity** — when `dataEntityId` does not exist (no `data_entity` row), the `metadataFieldService.get(metadataFieldId)` still returns the global field metadata, the UPDATE then matches zero rows in `metadata_field_value` (FK to `data_entity(id)` is intact but there's no value row for the non-existent entity), and the response is 200-with-empty-body. Unlike `createMetadata` (`DataEntityServiceImpl.java:257-258` does `reactiveDataEntityRepository.get(dataEntityId).switchIfEmpty(Mono.error(new NotFoundException))`), the upsert path NEVER validates the entity exists." — evidence: `DataEntityServiceImpl.java:287-305` (no entity-existence check) versus `DataEntityServiceImpl.java:257-258` (which does check). — severity: MEDIUM
- "**No type validation against `metadata_field.type`** — `formData.getValue()` is written verbatim into `metadata_field_value.value` (a `text` column) regardless of the field's declared `MetadataTypeEnum` (INTEGER / FLOAT / BOOLEAN / DATETIME / ARRAY / JSON / STRING / UNKNOWN per `MetadataTypeEnum.java:3-12`). A user can write `\"not a number\"` to an INTEGER-typed field, or `\"true\"` to a JSON-typed field. No coercion, no validation, no rejection. Downstream readers must defend against arbitrary string content regardless of the declared type." — evidence: `DataEntityServiceImpl.java:292-295` (only `value` extracted from form) + `ReactiveMetadataFieldValueRepositoryImpl.java:95-104` (UPDATE sets the `value` text column without inspecting field type) + `V0_0_1__init.sql:179` (`value text`). — severity: MEDIUM
- "**EXTERNAL-origin fields are writable** — the upsert path does not check `MetadataFieldPojo.getOrigin()`. EXTERNAL fields are populated by collectors during ingestion (`MetadataFieldServiceImpl.java:62-71` `ingestMetadataFields` creates fields with `origin=EXTERNAL`); a user with `DATA_ENTITY_CUSTOM_METADATA_UPDATE` can overwrite the collector-ingested value through this endpoint. The next ingestion cycle will replace it, but until then the catalog shows the user's edit as authoritative. The user-facing distinction between 'discovered' (EXTERNAL) and 'curated' (INTERNAL) metadata is therefore not enforced at write time." — evidence: `DataEntityServiceImpl.java:287-305` (no origin check) + `MetadataFieldServiceImpl.java:62-71` (EXTERNAL fields created during ingestion). — severity: MEDIUM
- "**`active` column dropped to NULL on every UPDATE** — `ReactiveMetadataFieldValueRepositoryImpl.java:98` writes `.set(METADATA_FIELD_VALUE.ACTIVE, pojo.getActive())`, but the upsert path's pojo construction at `DataEntityServiceImpl.java:292-295` never calls `setActive(...)`. The jOOQ-generated `MetadataFieldValuePojo.getActive()` returns boxed `Boolean` null when unset. The DB column is `boolean DEFAULT TRUE`, but DEFAULTs apply on INSERT only; an UPDATE that sets the column writes the explicit NULL, dropping a previously-TRUE row to NULL. This is a silent state-corruption bug — every edit converts an active=TRUE row to active=NULL." — evidence: `ReactiveMetadataFieldValueRepositoryImpl.java:97-98` (the SET clause) + `DataEntityServiceImpl.java:292-295` (no `setActive` call) + `V0_0_1__init.sql:180` (`active boolean DEFAULT TRUE`). — severity: MEDIUM
- "**No `@ActivityLog` annotation** — `upsertMetadataFieldValue` lacks the `@ActivityLog(event = CUSTOM_METADATA_UPDATED)` annotation despite the `CUSTOM_METADATA_UPDATED` enum value existing in `ActivityEventTypeDto.java:18`. Contrast with `upsertBusinessName` (`DataEntityServiceImpl.java:336` has `@ActivityLog(event = BUSINESS_NAME_UPDATED)`) and `upsertTags` (line 358 has `@ActivityLog(event = TAG_ASSIGNMENT_UPDATED)`). The activity feed therefore shows zero record of metadata updates; the `CUSTOM_METADATA_CREATED` (`ActivityEventTypeDto.java:17`), `CUSTOM_METADATA_UPDATED` (line 18), and `CUSTOM_METADATA_DELETED` (line 19) enum values are reserved-but-never-fired by these methods (`createMetadata` at line 245 and `deleteMetadata` at line 307 are also un-annotated)." — evidence: `DataEntityServiceImpl.java:287-305` (no `@ActivityLog`) versus `DataEntityServiceImpl.java:336` and `:358` (peer methods with the annotation). — severity: MEDIUM
- "**OpenAPI `origin` field is silently dropped** — `MetadataFieldValueUpdateFormData` declares an optional `origin: MetadataFieldOrigin` (`components.yaml:2149-2150`) but the impl reads only `value` (`DataEntityServiceImpl.java:295`). A client posting `{value: \"...\", origin: \"INTERNAL\"}` is told via the spec that origin is meaningful here, but the platform discards it. This is a spec/code drift — either the field should be removed from the spec or the impl should honour it (e.g. by validating it matches the field's declared origin and rejecting mismatches)." — evidence: `components.yaml:2144-2152` (spec includes `origin`) versus `DataEntityServiceImpl.java:292-295` (impl reads only `value`). — severity: LOW
- "**No length cap on `value`** — the `text` column is unbounded (`V0_0_1__init.sql:179`); the OpenAPI spec has no `maxLength` constraint (`components.yaml:2147-2148`). A 100 MiB value is technically accepted, then FTS-indexed, then served back to every consumer of the entity. The WebFlux request-size limit (`spring.codec.max-in-memory-size`, default 256KB) provides an indirect cap, but operators tuning that value up to accept large attachments would also accept large metadata values." — evidence: `V0_0_1__init.sql:179` + `components.yaml:2147-2148` (no length constraints). — severity: LOW
- "**Asymmetric `data_entity_filled` tracking** — `createMetadata` calls `dataEntityFilledService.markEntityFilled(dataEntityId, INTERNAL_METADATA)` (`DataEntityServiceImpl.java:282`) and `deleteMetadata` calls `markEntityUnfilled` when the last INTERNAL metadata row is removed (`DataEntityServiceImpl.java:316`), but `upsertMetadataFieldValue` does NOT toggle the filled flag. This is consistent IF the row already exists (filled=true) and remains (filled stays true) — but in the silent-200-on-missing case the flag is not set, which IS the right behaviour for that bug but contributes to making the bug undetectable." — evidence: `DataEntityServiceImpl.java:282` + `:316` (filled toggles) versus `:287-305` (no filled call). — severity: LOW

## security

- auth_mode_relevance: [
    "LOGIN_FORM — enforced via SECURITY_RULES (`SecurityConstants.java:204-207`)",
    "OAUTH2 — enforced via SECURITY_RULES (`SecurityConstants.java:204-207`)",
    "LDAP — enforced via SECURITY_RULES (`SecurityConstants.java:204-207`)",
    "DISABLED — UNGATED. The `DisabledAuthSecurityConfiguration` chain `permitAll()`s every exchange and SECURITY_RULES are NOT consulted. Anonymous traffic can write metadata values under `auth.type=DISABLED`. The docs label DISABLED as 'demo / development only' but the code does not enforce that posture.",
    "S2S — N/A. The ingestion S2S filter applies only to `/ingestion/entities` paths; this is a UI/API path."
  ]
- ingestion_filter_relevance: "NO — UI/API surface (PUT `/api/dataentities/{id}/metadata/{field_id}`), not ingestion. The S2S `IngestionDataEntitiesFilter` matches `/ingestion/entities` only."
- authorization_assertions: [
    "`SecurityRule(DATA_ENTITY, PathPatternParserServerWebExchangeMatcher('/api/dataentities/{data_entity_id}/metadata/{metadata_field_id}', PUT), DATA_ENTITY_CUSTOM_METADATA_UPDATE)` — evidence: `SecurityConstants.java:204-207`. Permission is resource-scoped on `dataEntityId` via the `DataEntityPermissionExtractor`. Policy condition can scope to `dataEntity:owner` for owner-only edit.",
    "Controller method has NO `@PreAuthorize` annotation (only the OpenAPI-generated interface implementation + `@Override`) — evidence: `DataEntityController.java:213-223`. All authorization is centralised in `SECURITY_RULES`."
  ]
- owner_scoping: "RESPECTS — the `DATA_ENTITY_CUSTOM_METADATA_UPDATE` permission is `DATA_ENTITY` resource-scoped; Policy can grant via `\"is\": \"dataEntity:owner\"` for owners-only edit. The endpoint itself reads `dataEntityId` from the path; no global-list semantics."
- data_exposure: [
    "Response body: `MetadataFieldValue` (`field: MetadataField, value: String`) — the persisted post-update state of this one field for this one entity → caller WITH `DATA_ENTITY_CUSTOM_METADATA_UPDATE`.",
    "Side-channel via FTS: the new metadata value is tokenised into `search_entrypoint.metadata_vector` and becomes searchable to ANY user able to call `/api/search` (subject to entity-level visibility) → any authenticated user.",
    "Activity feed: NONE — the endpoint emits no `CUSTOM_METADATA_UPDATED` activity event (missing `@ActivityLog`), so the audit trail does NOT include this write. A user with read-on-the-entity but not edit-on-the-entity cannot detect that an edit happened via the activity feed."
  ]
- known_security_gaps: [
    "**DISABLED-mode reachability — metadata writes accepted from anonymous traffic** — under `auth.type=DISABLED` (a documented demo / dev mode), the `DATA_ENTITY_CUSTOM_METADATA_UPDATE` permission is NEVER checked because SECURITY_RULES is not consulted by the disabled-auth chain. Anonymous attackers can rewrite any metadata field value, including overwriting EXTERNAL-origin (collector-ingested) values." — evidence: `SecurityConstants.java:204-207` (the rule that does not apply under DISABLED) + `DataEntityServiceImpl.java:287-305` (no programmatic auth re-check). — severity: MEDIUM (DISABLED is documented as dev-only).
    "**No audit trail for metadata writes** — missing `@ActivityLog(event = CUSTOM_METADATA_UPDATED)` annotation. A malicious or compromised user with `DATA_ENTITY_CUSTOM_METADATA_UPDATE` can rewrite metadata values with no record in the activity feed. Other entity-edit endpoints (`upsertBusinessName`, `upsertTags`, `upsertDescription`) DO emit audit events." — evidence: `DataEntityServiceImpl.java:287-305` (no annotation) versus `:336` and `:358` (peer methods that do). — severity: MEDIUM.
    "**EXTERNAL metadata overwrite is silent** — the upsert path does not distinguish INTERNAL (operator-curated) from EXTERNAL (collector-ingested) fields, so an authorised user can overwrite values that originated from source-system metadata. Combined with the no-audit gap, this creates a silent data-quality risk: the catalog can show fabricated 'source-system' values for fields with `origin=EXTERNAL` and no record of the fabrication." — evidence: `DataEntityServiceImpl.java:287-305` (no origin check) + `MetadataFieldServiceImpl.java:86-91` (EXTERNAL field creation in collector path). — severity: LOW (requires permission grant) but elevated by the audit-gap combination."
  ]

## performance

- hot_paths: [
    "Per-row metadata UPDATE — `ReactiveMetadataFieldValueRepositoryImpl.update` runs one `UPDATE … WHERE (metadata_field_id, data_entity_id) match` per call. The composite PK `(data_entity_id, metadata_field_id)` (`V0_0_1__init.sql:182`) provides O(log N) index lookup; expected cost is one B-tree index probe + one row update. — evidence: `ReactiveMetadataFieldValueRepositoryImpl.java:95-104`.",
    "FTS vector refresh — `ReactiveSearchEntrypointRepository.updateMetadataVectors(dataEntityId)` runs a `tsvector` rebuild for the entity's metadata column on every successful update. Cost grows with the number of metadata rows for the entity (the rebuild reads all metadata for the entity). — evidence: `DataEntityServiceImpl.java:300-302`."
  ]
- throughput_characteristics: [
    "Single-row PUT per call — no bulk-update endpoint exists. A client updating N metadata fields for one entity issues N separate PUT requests, each running its own transaction, its own field-metadata lookup, and its own FTS vector rebuild. The N FTS rebuilds for the same entity are redundant (only the last one matters)."
  ]
- resource_allocation: [
    "Per-call DB round-trips — minimum two: (1) `metadataFieldService.get(metadataFieldId)` SELECT, (2) `reactiveMetadataFieldValueRepository.update` UPDATE returning. Plus a third for the FTS vector rebuild via `updateMetadataVectors`. Each is reactive / non-blocking but consumes one connection from the R2DBC pool for the duration.",
    "Unbounded value size — `value` is `text` (no length cap at DB or OpenAPI level); a multi-MiB metadata value consumes proportional memory in the WebFlux decoder, the R2DBC driver, and the FTS tokeniser."
  ]
- scaling_characteristics: [
    "Stateless reactive method — instances scale horizontally; concurrent PUTs against different `(dataEntityId, metadataFieldId)` pairs are independent.",
    "Concurrent PUTs against the SAME `(dataEntityId, metadataFieldId)` — last-writer-wins. The composite PK provides row-level locking; no optimistic-concurrency token (no `If-Match` / `ETag` / row version). A lost-update is possible if two callers edit the same field simultaneously.",
    "`@ReactiveTransactional` (`DataEntityServiceImpl.java:288`) — each call runs in its own R2DBC transaction; no advisory locks taken, no cross-entity contention."
  ]
- known_performance_gaps: [
    "**No bulk-update endpoint** — N field updates for one entity = N separate transactions + N FTS vector rebuilds. The UI's metadata panel saves one field at a time (`MetadataItem` row edit per `MetadataItem.tsx:140-141`), so the N-rebuild waste is the common case for batch edits." — evidence: `openapi.yaml:1217-1239` (PUT is per-pair, no bulk variant). — severity: LOW.
    "**FTS vector rebuilt even on silent-200-no-op** — actually NO; the empty-mono short-circuit (described above) means the vector refresh is skipped on the missing-pair path. This is incidentally correct for performance, but it's a side-effect of the bug, not a deliberate optimisation. Listed here for completeness."
  ]

## sources

- understanding ← `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/DataEntityController.java:213-223` + `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataEntityServiceImpl.java:287-305` + `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveMetadataFieldValueRepositoryImpl.java:95-104` + `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/util/SecurityConstants.java:204-207`
- concepts.entities.MetadataFieldValue ← `odd-platform-specification/components.yaml:2123-2132`
- concepts.entities.MetadataFieldValueUpdateFormData ← `odd-platform-specification/components.yaml:2144-2152`
- concepts.entities.MetadataFieldPojo ← `odd-platform-api/src/main/resources/db/migration/V0_0_1__init.sql:166-173`
- concepts.entities.MetadataFieldValuePojo ← `odd-platform-api/src/main/resources/db/migration/V0_0_1__init.sql:175-186`
- concepts.operations.update-metadata-field-value ← `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataEntityServiceImpl.java:287-305`
- concepts.operations.resolve-field-metadata ← `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/MetadataFieldServiceImpl.java:30-34`
- concepts.invariants.endpoint-is-update-not-upsert ← `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveMetadataFieldValueRepositoryImpl.java:95-104` + `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataEntityServiceImpl.java:287-305`
- concepts.invariants.no-type-validation ← `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataEntityServiceImpl.java:292-295` + `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/dto/metadata/MetadataTypeEnum.java:3-12`
- concepts.invariants.no-origin-check ← `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataEntityServiceImpl.java:287-305`
- concepts.invariants.active-set-to-null ← `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveMetadataFieldValueRepositoryImpl.java:97-98` + `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataEntityServiceImpl.java:292-295` + `odd-platform-api/src/main/resources/db/migration/V0_0_1__init.sql:180`
- dependencies_semantic.requires-feature.upsertMetadataFieldValue ← `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataEntityServiceImpl.java:287-305`
- dependencies_semantic.requires-feature.MetadataFieldService.get ← `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/MetadataFieldServiceImpl.java:30-34`
- dependencies_semantic.requires-feature.ReactiveMetadataFieldValueRepository.update ← `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveMetadataFieldValueRepositoryImpl.java:95-104`
- dependencies_semantic.requires-config.auth.type ← `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/util/SecurityConstants.java:204-207`
- dependencies_semantic.coupling.metadata-field-cross-entity ← `odd-platform-api/src/main/resources/db/migration/V0_0_1__init.sql:166-173` + `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/MetadataFieldServiceImpl.java:43-58`
- dependencies_semantic.coupling.ui-toast ← `odd-platform-ui/src/redux/thunks/metadata.thunks.ts:33-56`
- tests_coverage_semantic.test_files.DataEntityServiceTest ← `odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/service/DataEntityServiceTest.java:164-191`
- docs_link_semantic.inferred_docs[0] ← WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions` (2026-05-19, 200)
- implicit_adrs.metadata-field-is-global ← `odd-platform-api/src/main/resources/db/migration/V0_0_1__init.sql:166-173` + `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/dto/metadata/MetadataKey.java:6-15`
- implicit_adrs.three-distinct-permissions ← `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/dto/policy/PolicyPermissionDto.java:15-17` + `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/util/SecurityConstants.java:201-211`
- implicit_adrs.transactional ← `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataEntityServiceImpl.java:288`
- implicit_adrs.fts-refresh-on-write ← `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataEntityServiceImpl.java:300-302` + `odd-platform-api/src/main/resources/db/migration/V0_0_1__init.sql:193`
- bugs_limitations_corner_cases.silent-200-on-missing-pair ← `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveMetadataFieldValueRepositoryImpl.java:95-104` + `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataEntityServiceImpl.java:287-305` + `odd-platform-ui/src/redux/thunks/metadata.thunks.ts:51-54`
- bugs_limitations_corner_cases.silent-200-on-missing-entity ← `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataEntityServiceImpl.java:287-305` vs `:257-258`
- bugs_limitations_corner_cases.no-type-validation ← `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataEntityServiceImpl.java:292-295` + `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/dto/metadata/MetadataTypeEnum.java:3-12` + `odd-platform-api/src/main/resources/db/migration/V0_0_1__init.sql:179`
- bugs_limitations_corner_cases.external-origin-writable ← `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataEntityServiceImpl.java:287-305` + `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/MetadataFieldServiceImpl.java:62-71`
- bugs_limitations_corner_cases.active-null-regression ← `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveMetadataFieldValueRepositoryImpl.java:97-98` + `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataEntityServiceImpl.java:292-295` + `odd-platform-api/src/main/resources/db/migration/V0_0_1__init.sql:180`
- bugs_limitations_corner_cases.no-activity-log ← `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataEntityServiceImpl.java:287-305` versus `:336` and `:358` + `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/dto/activity/ActivityEventTypeDto.java:17-19`
- bugs_limitations_corner_cases.origin-field-dropped ← `odd-platform-specification/components.yaml:2144-2152` vs `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataEntityServiceImpl.java:292-295`
- security.auth_mode_relevance ← `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/util/SecurityConstants.java:204-207`
- security.authorization_assertions.SECURITY_RULES ← `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/util/SecurityConstants.java:204-207`
- security.known_security_gaps.DISABLED-reachability ← `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/auth/util/SecurityConstants.java:204-207`
- security.known_security_gaps.no-audit-trail ← `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataEntityServiceImpl.java:287-305`
- security.known_security_gaps.external-overwrite ← `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataEntityServiceImpl.java:287-305` + `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/MetadataFieldServiceImpl.java:86-91`
- performance.hot_paths.update ← `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveMetadataFieldValueRepositoryImpl.java:95-104` + `odd-platform-api/src/main/resources/db/migration/V0_0_1__init.sql:182`
- performance.hot_paths.fts ← `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/DataEntityServiceImpl.java:300-302`
- performance.throughput.no-bulk ← `odd-platform-specification/openapi.yaml:1217-1239`

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: MEDIUM (one URL verified live, doc-drift candidate for activity-feed page not re-fetched)
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: MEDIUM (the active-NULL regression's downstream impact depends on whether any query filters `active = TRUE`; not exhaustively audited this session)

## Maintainer notes

(empty — no previous sidecar)

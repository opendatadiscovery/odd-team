---
node_id: "odd-platform java DatasetFieldController controller-class:DatasetFieldController"
node_kind: controller-class
axis: controllers
extracted_at_commit: 4ec2b20
enriched_at_commit: 4ec2b20
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-25-ZG-DatasetFieldController
pillar_anchored_features:
  - P-01:F-004 Entity Description Editing (per-column surface)
  - P-06:F-001 Term-to-Entity Linkage (column-level half)
  - P-09 Security & Access Control (per-endpoint gate audit)
---

# DatasetFieldController — semantic understanding

## understanding

`DatasetFieldController` is the **per-column metadata HTTP surface** — 103 lines, 7 endpoints across 4 collaborating services (`DatasetFieldService`, `EnumValueService`, `MetricService`, `TermService`), implementing the OpenAPI-generated `DatasetFieldApi` interface (`openapi.yaml:2451-2611`). All seven endpoints share the path prefix `/api/datasetfields/{dataset_field_id}/...` and are gated by `SecurityConstants.java:282-303` — six `DATASET_FIELD`-scope `SecurityRule` entries resolving via `DatasetFieldResourceExtractor` (lines 21-27 of that class) → `reactiveDatasetFieldRepository.getDataEntityIdByDatasetFieldId(id)` to the parent DataEntity, on which the actual permission check runs (parent-scoped authorization — there is no field-level permission). The controller is **pure thin-proxy plumbing**: every method is a one-line `formDataMono.flatMap(formData → service.X).map(ResponseEntity::ok)` shape — no validation, no error handling, no annotations beyond `@RestController`. The four edit endpoints (`updateDatasetFieldDescription` lines 35-43, `updateDatasetFieldInternalName` lines 45-53, `updateDatasetFieldTags` lines 55-63, `createEnumValue` lines 65-72) plus the two term endpoints (`addDatasetFieldTerm` lines 88-95, `deleteTermFromDatasetField` lines 97-103) form **F-004's per-column entity-description editing surface** and **F-006's per-column permission audit surface** simultaneously. The OpenAPI spec declares HTTP 201 for the three PUT endpoints (`openapi.yaml:2465, 2488, 2511`) but the controller returns 200 OK via `ResponseEntity::ok` (lines 42, 52, 62) — a spec/code drift that operators using generated client SDKs may not notice. Stress Protocol triggered SIX HIGH-severity findings: (a) the `SecurityConstants.java:299` permission-wiring bug where `/terms POST` is gated by `DATA_ENTITY_ADD_TERM` instead of the documented `DATASET_FIELD_ADD_TERM`; (b) the `SecurityConstants.java:295-296` copy-paste bug where `/api/alerts/{id}/status PUT` is gated by `DATASET_FIELD_ADD_TERM` — a dataset-field-scope permission unrelated to alert mutation; (c) the `createEnumValue` endpoint NAME promises CREATE but the IMPLEMENTATION is BULK-REPLACE; (d) `createEnumValue` is replay-safe-for-state but NOT for audit-trail (row identities churn, activity events double); (e) `createEnumValue` has NO concurrency control — two concurrent POSTs produce silent last-write-wins; (f) `deleteTermFromDatasetField` deletes only manual term-links — description-link rows survive, so a term linked via BOTH paths cannot be removed via this endpoint.

## concepts

- entities: [
    "`DatasetFieldDescriptionUpdateFormData` (the PUT /description body — single `description` field, free-form String; openapi.yaml:2463)",
    "`InternalNameFormData` (the PUT /name body — single `internalName` field, free-form String; openapi.yaml:2486)",
    "`DatasetFieldTagsUpdateFormData` (the PUT /tags body — `tags: [String]` array; openapi.yaml:2509)",
    "`BulkEnumValueFormData` (the POST /enum_values body — `items: [EnumValueFormData]` array; openapi.yaml:2547). The body name uses 'Bulk' truthfully — the body IS bulk — but the endpoint operationId `createEnumValue` (singular CREATE verb, openapi.yaml:2539) does not reflect the bulk-REPLACE semantics.",
    "`DatasetFieldTermFormData` (the POST /terms body — single `termId: Long`; openapi.yaml:2587)",
    "`DataSetFieldDescription` (the PUT /description response — `description` + `linkedTerms: [LinkedTerm]`; assembled by `DatasetFieldServiceImpl.updateDescription` lines 87-95 which calls `termService.handleDatasetFieldDescriptionTerms` to re-extract term mentions in the new description text)",
    "`InternalName` (the PUT /name response — single `internalName` field)",
    "`Tag` / `EnumValueList` / `MetricSet` / `LinkedTerm` (the other return shapes)",
    "`DatasetFieldApi` (the OpenAPI-generated interface this class implements — line 4, line 29)"
  ]
- operations: [
    "`update-internal-description` — PUT /api/datasetfields/{id}/description → `DatasetFieldServiceImpl.updateDescription` (no `@ActivityLog` at this layer) → `DatasetFieldInternalInformationServiceImpl.updateDescription` (HAS `@ActivityLog(DATASET_FIELD_DESCRIPTION_UPDATED)` line 28) → `ReactiveDatasetFieldRepositoryImpl.updateDescription` (verbatim storage) + `termService.handleDatasetFieldDescriptionTerms` (re-extract term mentions, ACTIVITY-LOGGED separately as `DATASET_FIELD_TERM_ASSIGNMENT_UPDATED` per `TermServiceImpl.java:243`).",
    "`update-internal-name` — PUT /api/datasetfields/{id}/name → `DatasetFieldServiceImpl.updateInternalName` (HAS `@ActivityLog(DATASET_FIELD_INTERNAL_NAME_UPDATED)` line 99) → `ReactiveDatasetFieldRepositoryImpl.updateInternalName` + `markEntityFilled/Unfilled` + `reactiveSearchEntrypointRepository.updateDatasetFieldSearchVectors` (line 113).",
    "`update-tags` — PUT /api/datasetfields/{id}/tags → `DatasetFieldServiceImpl.updateDatasetFieldTags` (HAS `@ActivityLog(DATASET_FIELD_TAGS_UPDATED)` line 119) → delete-internal-relations + re-create + search-vector refresh + `markDataEntityByTags`.",
    "`create-enum-values` — POST /api/datasetfields/{id}/enum_values → `EnumValueService.createEnumValues` (the only endpoint returning HTTP 201 — line 71 `HttpStatus.CREATED`). Semantics: BULK-REPLACE for INTERNAL-origin enum values; DESCRIPTION-ONLY-UPDATE for EXTERNAL-origin enum values (EnumValueServiceImpl.java:51-82). Operator-visible: omitting an item from the body soft-deletes it.",
    "`get-enum-values` — GET /api/datasetfields/{id}/enum_values → `EnumValueService.getEnumValues` (read endpoint — NOT in SecurityConstants rule list, gated only by the global auth manager).",
    "`get-metrics` — GET /api/datasetfields/{id}/metrics → `MetricService.getLatestMetricsForDatasetField` (read endpoint — NOT in SecurityConstants rule list).",
    "`add-term` — POST /api/datasetfields/{id}/terms → `TermService.linkTermWithDatasetField` (HAS `@ActivityLog(DATASET_FIELD_TERM_ASSIGNMENT_UPDATED)` `TermServiceImpl.java:211`). Repository uses `onDuplicateKeyIgnore()` (`TermRelationsRepositoryImpl.java:113`) — adding the SAME term twice returns 200 with empty body (the `.flatMap(relation → ...)` short-circuits on empty Mono).",
    "`delete-term` — DELETE /api/datasetfields/{id}/terms/{term_id} → `TermService.removeTermFromDatasetField` (HAS `@ActivityLog(DATASET_FIELD_TERM_ASSIGNMENT_UPDATED)` `TermServiceImpl.java:225`). Repository filters DELETE on `IS_DESCRIPTION_LINK.isFalse()` (`TermRelationsRepositoryImpl.java:179`) — DESCRIPTION-link rows are NOT removed by this endpoint; only manual term-link rows are."
  ]
- invariants: [
    "**Thin-proxy class — zero business logic in the controller.** Every method body is `formDataMono.flatMap(formData → service.X(id, formData)).map(ResponseEntity::ok)` — no validation, no error handling, no logging, no `@PreAuthorize`. The seven methods total 64 lines of method body across lines 36-103.",
    "**Authorization is parent-scoped via `DatasetFieldResourceExtractor`.** Six of seven endpoints have `SecurityRule` entries at `SecurityConstants.java:282-303` keyed on `AuthorizationManagerType.DATASET_FIELD`. The extractor (`DatasetFieldResourceExtractor.java:21-27`) resolves the `dataset_field_id` path variable to the parent `data_entity.id` via the repository method `getDataEntityIdByDatasetFieldId`, on which the actual permission check runs. There is NO field-level permission — every field of a DataEntity has the same effective permissions as the parent.",
    "**Two read endpoints (`getEnumValues`, `getDatasetFieldMetrics`) have NO `SecurityRule` entry** in `SecurityConstants.java:282-303` — they are gated only by the global authentication manager (any authenticated user can read them on any field via any field-id) per the read-collaborative posture of P-09.",
    "**Spec/code response-code drift.** OpenAPI declares HTTP 201 for the three PUT endpoints (`openapi.yaml:2465, 2488, 2511`); the controller returns HTTP 200 via `ResponseEntity::ok` (lines 42, 52, 62). The drift is silent — generated client SDKs that branch on 201 would never take the success branch. Same shape as F-002 batch-various `spec_says_X_impl_does_Y` drift class.",
    "**`/terms` POST endpoint is wired to the WRONG permission** — `SecurityConstants.java:297-299` wires `/api/datasetfields/{dataset_field_id}/terms POST` to `DATA_ENTITY_ADD_TERM` (the DataEntity-scope permission) instead of `DATASET_FIELD_ADD_TERM` (the field-scope permission declared at `PolicyPermissionDto.java:34`). A user holding `DATA_ENTITY_ADD_TERM` but NOT `DATASET_FIELD_ADD_TERM` can therefore add terms to dataset fields — and a user holding `DATASET_FIELD_ADD_TERM` but NOT `DATA_ENTITY_ADD_TERM` CANNOT. The permission catalog at `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions` documents `DATASET_FIELD_ADD_TERM` as the gate for this endpoint (verbatim: 'Allows linking a business glossary term to a specific field within a dataset.') — the wiring at `SecurityConstants.java:299` contradicts the documented permission model. See `known_security_gaps`.",
    "**`/api/alerts/{alert_id}/status PUT` is wired to `DATASET_FIELD_ADD_TERM`** (`SecurityConstants.java:295-296`) — a clear copy-paste bug from the dataset-field block immediately preceding it. The alert-status endpoint is gated by a field-scope term permission with no field involvement. Logged in this sidecar as cross-file evidence (the bug is on the ALERT path, not the DATASET_FIELD path, but the WRONG permission is one of the dataset_field permissions this controller's endpoints rely on for their meaning).",
    "**No `@ActivityLog` lives on the controller layer** — every emit (description, internal-name, tags, term-add, term-delete) happens at the service or inner-service layer. Description's `@ActivityLog` lives at the INNER service `DatasetFieldInternalInformationServiceImpl.java:28`, structurally one layer deeper than internal-name/tags which live at the OUTER `DatasetFieldServiceImpl` (lines 99, 119). The structural asymmetry exists but has NO operator-visible consequence — all three events ARE emitted, ALL three are documented at the live `https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed#event-types` page (verified 2026-05-20, status 200).",
    "**Description-edit returns 404 on missing id, NOT 200 OK with empty body** — `DatasetFieldInternalInformationServiceImpl.java:33` does `.switchIfEmpty(Mono.error(new NotFoundException(\"DatasetField\", datasetFieldId)))` BEFORE the activity-log emission and the downstream filled-flag updates. The outer `DatasetFieldServiceImpl.updateDescription` (lines 87-95) does NOT need its own `switchIfEmpty` because the inner service throws first. F-004 batch-R coherence correction: the prior claim 'API returns 200 OK with empty body for a non-existent field id' was wrong.",
    "**Description body is stored verbatim** — `ReactiveDatasetFieldRepositoryImpl.updateDescription` (lines 73-80) issues `DSL.update(DATASET_FIELD).set(INTERNAL_DESCRIPTION, newDescription).where(ID.eq(?)).returning()` with only empty-to-null normalisation (line 75). NO Jsoup.clean, NO Encode.html, NO length cap, NO allowlist. This is the F-004 verbatim-storage XSS-class fingerprint at the column-level surface; the entity-level sibling is `ReactiveDataEntityRepositoryImpl.setInternalDescription`. UI defence-in-depth (probe P-009) at `Markdown.tsx` is the operative safeguard; it covers the entity-description render path but cross-tab coverage of the DatasetField description render path is unverified per F-004 batch-R notes.",
    "**`createEnumValue` is BULK-REPLACE despite its CREATE name (Stress Cat B).** The OpenAPI summary even reads 'Enum Value CRUD' (openapi.yaml:2537) — but the `operationId` and the controller method name say `createEnumValue` (singular). Implementation at `EnumValueServiceImpl.java:91-122`: items with `id != null` → bulkUpdate; items with `id == null` → bulkCreate; rows whose `id` is NOT in `idsToKeep` → softDeleteExcept. Operator-visible: a partial body (one item) silently deletes every other live enum value on the field.",
    "**`addDatasetFieldTerm` is idempotent-by-empty-body (Stress Cat B).** `TermRelationsRepositoryImpl.createRelationWithDatasetField` (line 113) uses `onDuplicateKeyIgnore()`; re-adding the same term returns no row. The controller's `.flatMap(relation → ...)` short-circuits on empty Mono and the response is 200 OK with no JSON body. Generated client SDKs that try to read `LinkedTerm` from the response will deserialise null.",
    "**`deleteTermFromDatasetField` removes only MANUAL term-links (Stress Cat E).** `TermRelationsRepositoryImpl.java:179` filters DELETE on `IS_DESCRIPTION_LINK.isFalse()`. A term linked via BOTH the explicit POST /terms AND a `[[namespace/name]]` marker in the description body has TWO rows; DELETE removes only the manual row, the description-link row survives, and the term remains visible in the linked-terms tab. The remedy is to edit the description and remove the marker."
  ]
- audiences: [
    "operators-via-API — UI calls and direct REST clients hitting `/api/datasetfields/{id}/...`. The UI bindings at `odd-platform-ui/src/lib/hooks/api/datasetField.ts` (lines 13-60) wrap five of seven endpoints in React Query hooks; the EnumValueForm at `DatasetFieldEnumsForm.tsx:90-105` dispatches a Redux thunk for `createEnumValue`.",
    "`DatasetFieldApi` (OpenAPI-generated interface — the contract surface this controller implements; the spec at `odd-platform-specification/openapi.yaml:2451-2611` defines the public surface)",
    "downstream callers in the activity-feed chain — `DatasetFieldInformationUpdatedActivityHandler` (`DatasetFieldInformationUpdatedActivityHandler.java:27-29`) handles the three activity events emitted by these endpoints; the handler reads the new state via `ReactiveDatasetFieldRepository.getDatasetFieldWithTags` after each mutation."
  ]

## dependencies_semantic

- requires-feature: [
    "`DatasetFieldService` (3 calls: `updateDescription`, `updateInternalName`, `updateDatasetFieldTags`)",
    "`EnumValueService` (2 calls: `createEnumValues`, `getEnumValues`)",
    "`MetricService` (1 call: `getLatestMetricsForDatasetField`)",
    "`TermService` (2 calls: `linkTermWithDatasetField`, `removeTermFromDatasetField`)",
    "OpenAPI-generated `DatasetFieldApi` (the implements-target; the contract that defines path/verb/payload shapes for all 7 endpoints)"
  ]
- requires-config: [] — N/A. The controller reads no config keys; no `@Value`, no `@ConditionalOnProperty`. The four collaborating services each have their own config story (see their sidecars). Behaviour is fixed at compile time.
- requires-runtime: [
    "Spring WebFlux (`@RestController` at line 27; reactive `Mono<ResponseEntity<...>>` / `ResponseEntity<Flux<...>>` signatures throughout)",
    "Lombok (`@RequiredArgsConstructor` at line 28 generates the 4-service constructor injection)",
    "`DatasetFieldResourceExtractor` (the parent-DataEntity auth resolver — every authorized request to `/api/datasetfields/{id}/...` issues a DB round-trip via this extractor BEFORE the controller method runs; cited at `DatasetFieldResourceExtractor.java:21-27`)",
    "`SecurityConstants.SECURITY_RULES` (the SecurityWebFilterChain reading the 6 `DATASET_FIELD`-scope rules at `SecurityConstants.java:282-303` registers the matchers on app boot)",
    "PostgreSQL — the actual writes target `dataset_field` (via `ReactiveDatasetFieldRepositoryImpl`), `enum_value` (via `EnumValueServiceImpl`), `dataset_field_to_term` (via `TermServiceImpl`)"
  ]
- coupling: [
    "**`DatasetFieldResourceExtractor` → `ReactiveDatasetFieldRepository.getDataEntityIdByDatasetFieldId`** — the authorization chain for six of seven endpoints. EVERY authorized request to `/api/datasetfields/{id}/...` issues one DB round-trip via this 3-table join (`dataset_field → dataset_structure → dataset_version → data_entity`) BEFORE the controller method executes. No cache. See `performance.hot_paths`.",
    "**`SecurityConstants.java:282-303`** — the per-endpoint permission wiring. Changes here silently change which permission each endpoint requires; the controller method names give no hint of the gate. Two bugs already present (see invariants 5+6 + `known_security_gaps`).",
    "**`DatasetFieldServiceImpl.updateDescription` (NO `@ActivityLog`) → `DatasetFieldInternalInformationServiceImpl.updateDescription` (HAS `@ActivityLog`)** — the structural asymmetry where description-edit's activity-log emission lives one layer deeper than internal-name/tags. A future refactor that inlines the inner service or skips the inner-service call would silently drop description-edit from the activity feed.",
    "**`DatasetFieldServiceImpl.updateDescription` calls `termService.handleDatasetFieldDescriptionTerms`** — extracts term mentions from the NEW description text and emits a SEPARATE `DATASET_FIELD_TERM_ASSIGNMENT_UPDATED` activity event (`TermServiceImpl.java:243`). One description-edit therefore produces TWO activity-feed events: `DATASET_FIELD_DESCRIPTION_UPDATED` (inner-service) + `DATASET_FIELD_TERM_ASSIGNMENT_UPDATED` (term re-extraction) when the new description contains term references.",
    "**`reactiveSearchEntrypointRepository.updateDatasetFieldSearchVectors(datasetFieldId)`** — invoked by both `DatasetFieldServiceImpl.updateInternalName` (line 113) AND `DatasetFieldInternalInformationServiceImpl.updateDescription` (line 42). After every description / internal-name / tags edit, the search vector is rebuilt for the parent DataEntity. A new write path that skips this would silently desynchronise the search index from the column metadata.",
    "**OpenAPI `DatasetFieldApi` interface** — every controller method signature is dictated by the OpenAPI generator. The controller is purely a thin proxy implementing this interface; signature drift between spec and impl is a compile error. The HTTP response-code mismatch (spec 201 vs impl 200) is NOT a compile error because both 200 and 201 satisfy `ResponseEntity<T>` — the drift is at runtime only.",
    "**`TermRelationsRepositoryImpl.deleteRelationWithDatasetField` (line 179: `IS_DESCRIPTION_LINK.isFalse()`)** — the delete-cascade behaviour. A term that the field uses BOTH manually AND via description-marker has TWO `dataset_field_to_term` rows; DELETE removes only the manual one. See bugs_limitations_corner_cases."
  ]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
  - behaviour: "PUT /api/datasetfields/{id}/description with auth.type=DISABLED + missing dataset_field_id returns 404 NotFoundException"
    test_class: integration
    criticality: MEDIUM
    note: "the 404 contract from the inner service is unverified at the HTTP boundary"
  - behaviour: "PUT /api/datasetfields/{id}/description with Markdown / HTML / <script> payload returns 200 OK and persists the string verbatim — defence-in-depth lives only at UI render"
    test_class: security
    criticality: HIGH
    note: "F-004 verbatim-storage fingerprint unverified at column-level surface"
  - behaviour: "PUT /api/datasetfields/{id}/description emits exactly ONE DATASET_FIELD_DESCRIPTION_UPDATED activity event (and one additional DATASET_FIELD_TERM_ASSIGNMENT_UPDATED if the new description contains term references)"
    test_class: integration
    criticality: MEDIUM
    note: "the dual-event semantics unverified"
  - behaviour: "PUT /api/datasetfields/{id}/description with empty-string body normalises to NULL internal_description and emits the activity event"
    test_class: integration
    criticality: LOW
    note: "the empty-string contract unverified"
  - behaviour: "PUT /api/datasetfields/{id}/name on a soft-deleted parent DataEntity is denied via DatasetFieldResourceExtractor → parent permission check"
    test_class: integration
    criticality: MEDIUM
    note: "the parent-scope auth resolution unverified for soft-deleted parents"
  - behaviour: "POST /api/datasetfields/{id}/terms with a user holding DATA_ENTITY_ADD_TERM but NOT DATASET_FIELD_ADD_TERM SUCCEEDS — surfacing the SecurityConstants.java:299 permission-wiring bug"
    test_class: security
    criticality: HIGH
    note: "P-153 emits this probe"
  - behaviour: "PUT /api/alerts/{alert_id}/status with a user holding DATASET_FIELD_ADD_TERM but NOT any ALERT permission SUCCEEDS — surfacing the SecurityConstants.java:295-296 copy-paste bug"
    test_class: security
    criticality: HIGH
    note: "P-153 emits this probe"
  - behaviour: "PUT /api/datasetfields/{id}/description returns HTTP 200 (NOT the spec-declared 201)"
    test_class: integration
    criticality: MEDIUM
    note: "the spec/code response-code drift unverified"
  - behaviour: "GET /api/datasetfields/{id}/enum_values + /metrics are NOT in the SecurityRule list and are reachable by any authenticated user"
    test_class: security
    criticality: MEDIUM
    note: "the read-collaborative posture unverified at the field-level"
  - behaviour: "updateDatasetFieldTags returns the new tag list as Flux<Tag> with no Tag.deletedAt filter (relies on tagService relations being live)"
    test_class: integration
    criticality: LOW
    note: "the soft-delete-filter contract unverified at the controller boundary"
  - behaviour: "POST /api/datasetfields/{id}/enum_values with a partial body (1 of 3 existing items) soft-deletes the omitted 2 items — BULK-REPLACE semantics"
    test_class: integration
    criticality: HIGH
    note: "Stress Cat B name-vs-behaviour drift; P-154 emits this probe"
  - behaviour: "POST /api/datasetfields/{id}/enum_values with identical bodies twice churns row identities and emits 2 activity events"
    test_class: integration
    criticality: MEDIUM
    note: "Stress Cat B replay semantics; P-154 emits this probe"
  - behaviour: "Two concurrent POST /enum_values calls against the same datasetFieldId produce silent last-write-wins — no optimistic locking"
    test_class: integration
    criticality: HIGH
    note: "Stress Cat E concurrency; P-154 emits this probe"
  - behaviour: "DELETE /api/datasetfields/{id}/terms/{term_id} when the term is ALSO description-linked leaves the description-link row in place — the term remains visible in the linked-terms tab"
    test_class: integration
    criticality: HIGH
    note: "Stress Cat E cascade limit; P-155 emits this probe"
  - behaviour: "POST /api/datasetfields/{id}/terms with the same termId twice returns 200 OK with empty body on the second call"
    test_class: integration
    criticality: LOW
    note: "Stress Cat B onDuplicateKeyIgnore semantics — empty body contract unverified"
- test_files: [
    "(NO direct controller test) — Grep `DatasetFieldController` in `<odd-platform-repo>/odd-platform-api/src/test/java/**` returns zero matches. Adjacent test surfaces: `EnumValueServiceTest` (165 lines, covers happy-path + duplicates + empty), `EnumValueRepositoryImplTest`, `LookupDataServiceTest`, `DatasetFieldApiMapperTest`, `DatasetVersionMapperTest` — none drive HTTP requests against this controller's path patterns.",
    "`<odd-platform-repo>/odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/service/EnumValueServiceTest.java:77-163` — service-tier unit tests for createEnumValues happy-path, duplicates (rejected with BadUserRequestException), getEnumValues (existing + empty). Does NOT exercise concurrency, partial-body BULK-REPLACE, or external-origin description-only update; does NOT exercise the controller surface.",
    "(Spec) — `DatasetFieldApiMapperTest.java` exercises the `DatasetFieldApiMapper` shape; does NOT drive controller requests."
  ]
- gaps: |
    The controller has ZERO direct HTTP-boundary tests. Every behaviour observable at the HTTP boundary — the 404 on missing id, the spec/code response-code drift, the verbatim-storage XSS persistence through the description endpoint, the dual-activity-event emission, the parent-scope auth resolution, the wiring bugs at `SecurityConstants.java:295-296` and `:299`, the BULK-REPLACE semantics of `createEnumValue`, the concurrent-write race, the description-link survival through DELETE — is unverified. The **security** class is the worst-covered: TWO HIGH-severity authorization wiring bugs ride on this controller with no test catching them; a permission renaming or a regenerated SecurityConstants file would not surface either because no integration test asserts the permission-to-endpoint binding. The **integration** class is second-worst: every reactive chain in `DatasetFieldServiceImpl` + `EnumValueServiceImpl` + `TermServiceImpl` reaches across the controller boundary via a service-tier unit test only — the HTTP round-trip is never asserted. The **unit** class has the modest existing coverage (EnumValueService — 4 tests) but does not capture the BULK-REPLACE semantics from the operator's perspective. The highest-leverage gap class is **security**: probes P-153, P-154, P-155 collectively cover the six new HIGH-severity findings (two auth-wiring + BULK-REPLACE + replay + concurrency + cascade).

## docs_link_semantic

- declared_docs: [] — no `@docs` annotation in the source file (Grep across `DatasetFieldController.java` confirms no `@docs`, `// @docs`, or JavaDoc `{@link docs}` pattern; the class is 103 lines and uses zero JavaDoc beyond the OpenAPI-generated `DatasetFieldApi` interface).
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed"
    anchor: "#event-types"
    rationale: "The four mutation endpoints (`updateDescription`, `updateInternalName`, `updateDatasetFieldTags`, `addDatasetFieldTerm`/`deleteTermFromDatasetField`) emit four of the documented `event-types` listed on this live page: `DATASET_FIELD_DESCRIPTION_UPDATED`, `DATASET_FIELD_INTERNAL_NAME_UPDATED`, `DATASET_FIELD_TAGS_UPDATED`, `DATASET_FIELD_TERM_ASSIGNMENT_UPDATED`."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    fetched_excerpts: |
      Verbatim from the live page (2026-05-20, status 200):
      "Dataset fields (columns):
       - `DATASET_FIELD_VALUES_UPDATED`
       - `DATASET_FIELD_DESCRIPTION_UPDATED`
       - `DATASET_FIELD_INTERNAL_NAME_UPDATED`
       - `DATASET_FIELD_TAGS_UPDATED`
       - `DATASET_FIELD_TERM_ASSIGNMENT_UPDATED`"
    confidence: HIGH
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions"
    anchor: ""
    rationale: "The six `DATASET_FIELD`-scope permissions wired at `SecurityConstants.java:282-303` are documented verbatim on this live page. Cross-reference with the wiring bug at `SecurityConstants.java:295-296` (the ALERT path incorrectly gated by DATASET_FIELD_ADD_TERM) and `:299` (the /terms POST gated by DATA_ENTITY_ADD_TERM instead of DATASET_FIELD_ADD_TERM)."
    last_verified_at: "2026-05-25T00:00:00Z"
    last_verified_status: 200
    fetched_excerpts: |
      Verbatim from the live page (2026-05-25, status 200):
      "DATASET_FIELD_ADD_TERM: Allows linking a business glossary term to a specific field within a dataset.
       DATASET_FIELD_DELETE_TERM: Allows removing a linked business glossary term from a specific field within a dataset.
       DATASET_FIELD_DESCRIPTION_UPDATE: Allows editing the description of an individual dataset field.
       DATASET_FIELD_ENUMS_UPDATE: Allows editing a dataset field's enum values.
       DATASET_FIELD_INTERNAL_NAME_UPDATE: Allows editing the business name of an individual dataset field.
       DATASET_FIELD_TAGS_UPDATE: Allows adding or removing tags from an individual dataset field."

      (ALERT-side, on the same page):
      "DATA_ENTITY_ALERT_CONFIG_UPDATE: Allows configuring alert settings for a data entity (e.g., backwards-incompatible schema change alert, failed data quality test, failed job, distribution anomaly).
       DATA_ENTITY_ALERT_RESOLVE: Allows resolving alerts for a data entity."
    confidence: HIGH
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/business-names"
    anchor: ""
    rationale: "Business-name editing is documented as `DATASET_FIELD_INTERNAL_NAME_UPDATE`-gated on this live page — confirming the dataset-field business-name surface and its specific permission."
    last_verified_at: "2026-05-25T00:00:00Z"
    last_verified_status: 200
    fetched_excerpts: |
      Verbatim from the live page (2026-05-25, status 200):
      "Setting a business name on a dataset field is gated by `DATASET_FIELD_INTERNAL_NAME_UPDATE`."
    confidence: HIGH
- doc_drift_findings:
  - "OpenAPI spec declares HTTP 201 for the three PUT endpoints (`openapi.yaml:2465 description-update`, `:2488 internal-name-update`, `:2511 tags-update`) but the controller returns HTTP 200 via `ResponseEntity::ok` (DatasetFieldController.java:42, 52, 62). Spec/code drift. Generated client SDKs branching on 201-vs-200 would silently mishandle the response."
  - "Live docs at `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions` document `DATASET_FIELD_ADD_TERM` as the gate for `POST /api/datasetfields/{id}/terms` (verbatim: 'Allows linking a business glossary term to a specific field within a dataset.'). The actual code at `SecurityConstants.java:299` wires this endpoint to `DATA_ENTITY_ADD_TERM`. Docs and code disagree — operator following docs configures permissions that do not match runtime behaviour. P-153 pins this."
  - "Live docs document `DATA_ENTITY_ALERT_RESOLVE` as the natural alert-state-mutation gate. The actual code at `SecurityConstants.java:295-296` wires `/api/alerts/{alert_id}/status PUT` to `DATASET_FIELD_ADD_TERM` — completely unrelated to alerts. Cross-controller copy-paste bug; surfaced HERE because the wrong permission is a dataset-field permission. P-153 pins this."
  - "Live docs DO list `DATASET_FIELD_DESCRIPTION_UPDATED`, `DATASET_FIELD_INTERNAL_NAME_UPDATED`, `DATASET_FIELD_TAGS_UPDATED`, `DATASET_FIELD_TERM_ASSIGNMENT_UPDATED` as activity-feed event types at `https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed#event-types`. Earlier batches (F-004 batch-R extension notes lines 78-91) claimed `DATASET_FIELD_DESCRIPTION_UPDATED` is 'NEVER emitted' — that prior claim contradicts both the live docs AND the code at `DatasetFieldInternalInformationServiceImpl.java:28`. The doc surface is correct; the prior sidecar inference was wrong."
  - "Live docs do not describe the column-level XSS-class verbatim-storage surface. Operators reading the description-editing surface (Data Discovery / Annotating discovered entities) have no way to discover that Markdown / HTML payloads persist verbatim to `dataset_field.internal_description` with defence-in-depth only at the UI render layer. Same doc-gap class as F-004 entity-side."
  - "Live docs do not describe the parent-scope authorization model. Operators reading the dataset-field permission docs may infer that DATASET_FIELD-scope permissions check against the field itself; in reality every check resolves to the parent DataEntity via `DatasetFieldResourceExtractor`. A user with permission on the parent DataEntity has permission on every field of that entity. The doc surface does not explain this collapse."
  - "Live docs do not describe the BULK-REPLACE semantics of `POST /api/datasetfields/{id}/enum_values`. The OpenAPI summary reads 'Enum Value CRUD' (acknowledging the multi-action shape) but the operationId is `createEnumValue` (singular) and the description says 'Creates/updates/deletes enum values with their description' — without warning that omitting an existing item from the body SOFT-DELETES it. Operator-visible failure: a partial body designed to ADD one value will delete every other value. P-154 pins this."
  - "Live docs do not describe the description-link-survives-DELETE behaviour. The DELETE term endpoint documentation reads 'Delete term from current dataset field terms list' — the operator-visible failure where the deletion appears successful but the term remains visible (because its description-link row survives) is not surfaced. P-155 pins this."

## implicit_adrs

- "**Thin-proxy controllers — every method body is a one-line `formDataMono.flatMap(...).map(ResponseEntity::ok)` shape with NO controller-layer validation or error handling.**" — evidence: DatasetFieldController.java:35-103 — intent_anchor: "Lines 36-43 (`updateDatasetFieldDescription` body): `return formDataMono.flatMap(formData -> datasetFieldService.updateDescription(datasetFieldId, formData)).map(ResponseEntity::ok);` — and the same shape repeats for every endpoint. The controller is a deliberate passthrough; the OpenAPI-generated `DatasetFieldApi` interface dictates the signatures and the services own the business logic. Convention applied uniformly across all 7 endpoints." — confidence: HIGH

- "**Authorization is parent-scoped — every DATASET_FIELD permission resolves to the parent DataEntity's permission via `DatasetFieldResourceExtractor`; there is NO field-level permission check.**" — evidence: DatasetFieldResourceExtractor.java:21-27 + SecurityConstants.java:282-303 — intent_anchor: "`DatasetFieldResourceExtractor.java:26`: `.flatMap(datasetFieldRepository::getDataEntityIdByDatasetFieldId)` — the resolver's final step returns the parent `data_entity.id`, not the `dataset_field.id`. The downstream `ReactiveAuthorizationManager` then evaluates the permission against the parent DataEntity. Identical pattern to `ReactiveDatasetFieldRepositoryImpl` invariant 7. No alternative gating mechanism." — confidence: HIGH

- "**Activity-log emission lives at the service layer or one layer deeper at the inner-service layer — NEVER at the controller layer.**" — evidence: DatasetFieldServiceImpl.java:99 (internal-name) + :119 (tags) + DatasetFieldInternalInformationServiceImpl.java:28 (description) + TermServiceImpl.java:211, :225 (term-link/unlink) — intent_anchor: "The `@ActivityLog` annotation is consistently applied at the FIRST `@Service`-tier method that touches the writable state, never at the controller. The four mutation paths (description, internal-name, tags, term-link/unlink) all carry the annotation at the right structural depth. The structural depth varies (description at inner-service, internal-name/tags at outer-service) because of the additional term-extraction work description does — but every mutation emits exactly one activity event for the primary mutation type." — confidence: HIGH

- "**Two read endpoints (`getEnumValues`, `getDatasetFieldMetrics`) intentionally OMITTED from `SecurityRule` — any authenticated user can read them on any field-id, matching the platform's read-collaborative posture.**" — evidence: DatasetFieldController.java:74-86 + SecurityConstants.java:282-303 — intent_anchor: "Lines 74-86 expose `getEnumValues` (GET /enum_values) and `getDatasetFieldMetrics` (GET /metrics). `SecurityConstants.java:282-303` declares SecurityRule entries for `name PUT`, `description PUT`, `tags PUT`, `enum_values POST`, `terms POST`, `terms/{term_id} DELETE` — but NOT for `enum_values GET` or `metrics GET`. The omission is intentional and uniform across the platform — read endpoints fall back to the global authentication-only gate. Same read-collaborative pattern as `ReactiveDatasetFieldRepositoryImpl.listByTerm` (cross-owner read, no per-owner scoping)." — confidence: HIGH

- "**Description-edit emits TWO activity events when the new description text contains term references (one DATASET_FIELD_DESCRIPTION_UPDATED + one DATASET_FIELD_TERM_ASSIGNMENT_UPDATED).**" — evidence: DatasetFieldServiceImpl.java:87-95 + TermServiceImpl.java:243 + DatasetFieldInternalInformationServiceImpl.java:28 — intent_anchor: "`DatasetFieldServiceImpl.updateDescription` (lines 87-95): the chain is `datasetFieldInternalInformationService.updateDescription(...)` (emits DATASET_FIELD_DESCRIPTION_UPDATED at line 28 of that class) `.then(termService.handleDatasetFieldDescriptionTerms(datasetFieldId, formData.getDescription()))` (emits DATASET_FIELD_TERM_ASSIGNMENT_UPDATED at TermServiceImpl.java:243). Both events are emitted on EVERY description-edit when the new description contains term-marker syntax — single user-visible operation, two activity-feed entries." — confidence: HIGH

- "**Enum-value bulk-replace semantics — the EnumValueService.createEnumValues body IS the new state.**" — evidence: EnumValueServiceImpl.java:91-122 — intent_anchor: "Lines 97-105 partition input by `id != null`, then `softDeleteExcept(datasetFieldId, idsToKeep)` removes every existing row whose id is NOT preserved in the request. The pattern is the documented Bulk-Replace contract: the body IS the desired state. Comments / Javadoc do not declare this intent explicitly — the intent is encoded in the algorithm structure (partition → soft-delete-except → bulkUpdate + bulkCreate). The name 'createEnumValues' is misleading; the operation is replace-state-with-body. The OpenAPI summary 'Enum Value CRUD' (openapi.yaml:2537) hints at it." — confidence: MEDIUM (the algorithm encodes the intent; no comment defends it).

- "**Add-term idempotency via `onDuplicateKeyIgnore` — duplicates return 200 with empty body, never 409 Conflict.**" — evidence: TermRelationsRepositoryImpl.java:109-117 — intent_anchor: "Line 113: `.onDuplicateKeyIgnore()`. The repository emits a JOOQ insert with the JOOQ-level duplicate-handler that silently swallows duplicates. The semantic implication is that the API treats add-term as set-membership-assertion, not as creation. No comment defends the choice; the JOOQ method name IS the declared intent." — confidence: MEDIUM

- "**Delete-term excludes description-links (`IS_DESCRIPTION_LINK.isFalse()`) — description-mention term-links are owned by the description text, not by the explicit term-link surface.**" — evidence: TermRelationsRepositoryImpl.java:175-183 — intent_anchor: "Line 179: `.and(DATASET_FIELD_TO_TERM.IS_DESCRIPTION_LINK.isFalse())`. The WHERE clause filters DELETE to ONLY manual-link rows. The design intent is clear: description-link lifecycle is owned by the description's text content (the marker syntax in the body), not by the term-management surface. Operators using DELETE expect 'remove this term from the list'; the implementation enforces 'remove this term's MANUAL link, leave description-derived links alone'. No comment defends the choice but the same pattern appears at the data-entity sibling (`DATA_ENTITY_TO_TERM.IS_DESCRIPTION_LINK` filtering at TermRelationsRepositoryImpl.java:86-106) — convention applied across the term-linkage subsystem." — confidence: HIGH

## bugs_limitations_corner_cases

- "**`SecurityConstants.java:299` wires `POST /api/datasetfields/{dataset_field_id}/terms` to `DATA_ENTITY_ADD_TERM` instead of `DATASET_FIELD_ADD_TERM`.** The live docs document `DATASET_FIELD_ADD_TERM` as the gate for this endpoint (verbatim: 'Allows linking a business glossary term to a specific field within a dataset.'). The code-doc divergence means: (a) a user granted `DATA_ENTITY_ADD_TERM` (intended for entity-level term-linking) effectively also gets dataset-field term-linking; (b) a user granted `DATASET_FIELD_ADD_TERM` cannot link terms to dataset fields. The permission catalog and the operative gate disagree. SAME endpoint as F-004 surface adjacency — operators following the docs will configure permissions that do not match runtime behaviour. Probe P-153 pins." — evidence: SecurityConstants.java:297-299 + PolicyPermissionDto.java:34 + docs at https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions — severity: HIGH

- "**`SecurityConstants.java:295-296` wires `PUT /api/alerts/{alert_id}/status` to `DATASET_FIELD_ADD_TERM`** — a clear copy-paste bug from the dataset-field block immediately preceding it. An alert-status update endpoint is gated by a dataset-field-scope term permission with no involvement of any dataset_field at the request path. Any user holding `DATASET_FIELD_ADD_TERM` can resolve alerts; any user holding an actual ALERT permission but NOT `DATASET_FIELD_ADD_TERM` CANNOT. Surfaced via this sidecar because the wrong permission is a DATASET_FIELD one — the bug's source is the copy-paste from this controller's auth block. Probe P-153 pins." — evidence: SecurityConstants.java:295-296 — severity: HIGH

- "**Spec/code response-code drift: OpenAPI declares HTTP 201 for the three PUT endpoints, controller returns 200 OK.**" — evidence: openapi.yaml:2465, :2488, :2511 (`'201': description: OK`) vs DatasetFieldController.java:42, :52, :62 (`ResponseEntity::ok` → HTTP 200) — severity: MEDIUM

- "**Description-edit can trigger TWO activity-feed entries for one user operation** — the dual-event semantics (DATASET_FIELD_DESCRIPTION_UPDATED + DATASET_FIELD_TERM_ASSIGNMENT_UPDATED) are not documented at the activity-feed page. Operators reading the description-edit row in the feed see a separate term-assignment-update row immediately after with the same actor/timestamp and may infer two distinct user actions." — evidence: DatasetFieldServiceImpl.java:89-90 + TermServiceImpl.java:243 — severity: LOW

- "**Description body persists verbatim — F-004 XSS-class fingerprint at the per-column surface.** PUT /api/datasetfields/{id}/description with `<script>` / `<img onerror>` / `javascript:` payloads stores them in `dataset_field.internal_description` and surfaces them through the field-description tab on the data-entity detail page. Defence-in-depth lives only at the UI render layer (probe P-009 — Markdown.tsx pipeline strips dangerous tags at DOM-render); cross-tab coverage of the DatasetField description render path is unverified per F-004 batch-R notes." — evidence: DatasetFieldController.java:36-43 + ReactiveDatasetFieldRepositoryImpl.java:73-80 (no Jsoup, no Encode, no length cap, no allowlist) — severity: MEDIUM

- "**`createEnumValue` returns HTTP 201 from the controller AND the spec says 201** — no drift here. Note this asymmetry: ONLY the POST endpoint correctly returns 201; the three PUT endpoints DO drift. The asymmetry implies the controller author followed the spec for one endpoint but not the other three." — evidence: DatasetFieldController.java:71 (`HttpStatus.CREATED`) + openapi.yaml:2549 (`'201': description: The resource has been successfully modified`) — severity: LOW (observational)

- "**`GET /api/datasetfields/{id}/enum_values` and `GET /api/datasetfields/{id}/metrics` have no `SecurityRule` entry** — they are reachable by any authenticated user on any field id, regardless of parent-DataEntity permissions. Intentional per the read-collaborative posture documented at P-09 maintainer notes; not documented at the dataset-field endpoint surface." — evidence: DatasetFieldController.java:74-86 + SecurityConstants.java:282-303 (no rule for GET /enum_values, GET /metrics) — severity: LOW

- "**Per-request DB round-trip via `DatasetFieldResourceExtractor.extractResourceId`** — every authorized request to `/api/datasetfields/{id}/...` issues a 3-table join (`dataset_field → dataset_structure → dataset_version → data_entity`) BEFORE the controller method executes. No cache. For high-edit-frequency users (data-curators bulk-editing column metadata via the UI), this is one extra DB round-trip per HTTP request beyond the actual operation." — evidence: DatasetFieldResourceExtractor.java:21-27 + ReactiveDatasetFieldRepositoryImpl.java:115-125 — severity: LOW

- "**`createEnumValue` is BULK-REPLACE, not BULK-CREATE — the operationId NAME promises CREATE.** A partial body (one item) submitted against a field that has three existing items WILL soft-delete the other two. Operator-visible failure: a UI that does not preserve the full current item list when sending the form can silently destroy data. The DatasetFieldEnumsForm at `<odd-platform-repo>/odd-platform-ui/src/components/.../DatasetFieldEnumsForm/DatasetFieldEnumsForm.tsx:90-105` correctly sends the FULL `data.enums` array (every item), avoiding this trap; a third-party API consumer or a future UI refactor that sends only the changed item would corrupt the data. Probe P-154 pins." — evidence: EnumValueServiceImpl.java:91-122 + DatasetFieldController.java:65-72 + openapi.yaml:2536-2554 (operationId `createEnumValue`) — severity: HIGH

- "**`createEnumValue` is replay-safe-for-state but NOT for audit-trail** — identical bodies submitted twice produce the SAME visible state but DIFFERENT row identities (the second call soft-deletes the first call's rows and bulkCreates new ones), and emits a `DATASET_FIELD_VALUES_UPDATED` activity event per call. Operators inspecting the activity feed see two events with no visible diff in state; auditors using row ids to correlate events lose the chain. Probe P-154 pins." — evidence: EnumValueServiceImpl.java:91-122 (softDeleteExcept always-runs on INTERNAL path) + activity-log emit at :41 — severity: MEDIUM

- "**`createEnumValue` has NO concurrency control — two concurrent POSTs against the same datasetFieldId produce silent last-write-wins.** Each transaction at READ-COMMITTED isolation reads the pre-T2 state, softDeleteExcept its idsToKeep, bulkCreates its body, commits. Whichever transaction COMMITS LAST has its softDeleteExcept run AFTER the other's writes — wiping them. There is no optimistic-lock version check, no advisory lock at the dataset_field_id level, no SERIALIZABLE isolation declaration. The UI typically issues only one PUT per form-submission so this is a thin race window, but two operators editing the same field's enum values concurrently (e.g. one via UI, one via API) will silently lose one set of edits. Probe P-154 pins." — evidence: EnumValueServiceImpl.java:39-82 (no lock, no version check) + ReactiveTransactional annotation — severity: HIGH

- "**`deleteTermFromDatasetField` removes only MANUAL term-links.** The repository DELETE filters on `IS_DESCRIPTION_LINK.isFalse()` (`TermRelationsRepositoryImpl.java:179`). A term linked via BOTH the `[[namespace/name]]` marker in the description AND the explicit POST /terms has TWO `dataset_field_to_term` rows; DELETE returns 204 No Content but only deletes the manual row. The term remains visible in the linked-terms tab (because the description-link row survives). Remedy: edit the description body and remove the marker. The endpoint description ('Delete term from current dataset field terms list') does not warn about this. Probe P-155 pins." — evidence: TermRelationsRepositoryImpl.java:175-183 + TermServiceImpl.java:226-239 — severity: HIGH

- "**`addDatasetFieldTerm` returns 200 OK with EMPTY BODY when the term is already linked.** `TermRelationsRepositoryImpl.createRelationWithDatasetField` (line 113) uses `onDuplicateKeyIgnore()`; the JOOQ insert silently skips the duplicate, returns no row, and the controller's `.flatMap(relation → ...).map(ResponseEntity::ok)` short-circuits on empty Mono. Generated client SDKs expecting a `LinkedTerm` response shape will deserialise null." — evidence: TermRelationsRepositoryImpl.java:109-117 + TermServiceImpl.java:212-220 + DatasetFieldController.java:88-95 — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables: []                                 # No numeric literal tunables, @Value annotations, magic-string gates, or feature-flag constants in this 103-line controller; every tunable lives in the downstream services/repos.
  name_behavior_pairs:
    - name: "createEnumValue (operationId, openapi.yaml:2539)"
      promise: "Single CREATE — the verb says create one resource, the singular noun says one resource."
      implementation: "BULK-REPLACE — body's `items` array IS the new state. items with `id != null` → bulkUpdate; items with `id == null` → bulkCreate; existing rows whose id is NOT in idsToKeep → softDeleteExcept (EnumValueServiceImpl.java:91-122)."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "Partial-body submission silently deletes every other live enum value on the field. The OpenAPI summary 'Enum Value CRUD' hints at the truth; the operationId hides it."
      confidence: STATIC-INFERRED
      evidence: "EnumValueServiceImpl.java:91-122 + openapi.yaml:2536-2554 + DatasetFieldController.java:65-72"
    - name: "addDatasetFieldTerm (operationId, openapi.yaml:2579)"
      promise: "Add — the verb implies adding to a collection; failure modes should be 4xx for invalid input or 409 for conflict."
      implementation: "Idempotent: `onDuplicateKeyIgnore()` at TermRelationsRepositoryImpl.java:113 silently swallows duplicates. The controller returns 200 OK with EMPTY BODY when the term is already linked."
      drift: MINOR
      operator_visible_consequence: "Generated client SDK expecting a `LinkedTerm` response gets null on duplicate-add; manual API consumers may misinterpret 200-with-empty-body as a deserialiser bug rather than as the idempotency-by-empty-response contract."
      confidence: STATIC-INFERRED
      evidence: "TermRelationsRepositoryImpl.java:109-117 + DatasetFieldController.java:88-95"
    - name: "deleteTermFromDatasetField (operationId, openapi.yaml:2602)"
      promise: "Delete term from the field's terms list — the verb says remove; the docs say 'Delete term from current dataset field terms list'."
      implementation: "Removes only MANUAL term-links. Description-derived links (rows where `is_description_link = true`) survive. Filter at TermRelationsRepositoryImpl.java:179: `.and(DATASET_FIELD_TO_TERM.IS_DESCRIPTION_LINK.isFalse())`."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "When a term is linked via BOTH manual-add AND a description-marker, DELETE returns 204 No Content but the term REMAINS visible in the linked-terms tab. Operator sees 'delete succeeded but term is still there'."
      confidence: STATIC-INFERRED
      evidence: "TermRelationsRepositoryImpl.java:175-183 + TermServiceImpl.java:226-239 + openapi.yaml:2602-2611"
    - name: "BulkEnumValueFormData (schema name, openapi.yaml:2547)"
      promise: "Bulk — the schema NAME says bulk operation."
      implementation: "Bulk-REPLACE (covered above). The schema name is honest about the bulk shape; the wrapping operationId hides it."
      drift: NONE
      operator_visible_consequence: "Schema name is accurate; the drift is concentrated in the operationId not the body schema."
      confidence: STATIC-INFERRED
      evidence: "openapi.yaml:2547 + EnumValueServiceImpl.java:91-122"
    - name: "DatasetFieldDescription / InternalName / Tag (return shapes)"
      promise: "Each return shape encodes the operation's effect on the field."
      implementation: "All three return the post-mutation state correctly. No drift."
      drift: NONE
      operator_visible_consequence: "N/A"
      confidence: STATIC-INFERRED
      evidence: "DatasetFieldServiceImpl.java:87-132"
  orderings:
    - location: "DatasetFieldController.java:65-72 (createEnumValue) → EnumValueServiceImpl.java:91-122"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer?"
          a: "No ORDER BY in createEnumValues path — the only read is `getEnumState(datasetFieldId)` (line 51) which returns rows in natural order; the response is then assembled in input-array order, NOT in DB order. The `getEnumValuesByDatasetFieldId` read endpoint (ReactiveEnumValueRepositoryImpl.java:60-66) also has no ORDER BY — Postgres returns rows in natural-storage order which after softDelete+bulkCreate cycles becomes unpredictable."
          confidence: STATIC-INFERRED
          evidence: "EnumValueServiceImpl.java:51-105 + ReactiveEnumValueRepositoryImpl.java:60-66"
        - q: "What is the tie-breaker when sort-key values are equal?"
          a: "N/A — no ORDER BY. Tie-breaker is database-implementation-defined."
          confidence: STATIC-INFERRED
          evidence: "ReactiveEnumValueRepositoryImpl.java:60-66"
        - q: "Which subset is returned when result-set > page size?"
          a: "Not applicable — `getEnumValuesByDatasetFieldId` has no LIMIT clause; the full set is returned. For a field with hundreds of enum values, the full set crosses the wire on every read."
          confidence: STATIC-INFERRED
          evidence: "ReactiveEnumValueRepositoryImpl.java:60-66 (no `.limit(...)`)"
        - q: "Does any upstream layer re-sort or filter the result?"
          a: "The UI's DatasetFieldEnumsForm component preserves input array order; the mapper at EnumValueMapper.java:52-71 walks `pojos` and emits items in iteration order. No re-sort. If two POSTs interleave (P-154 race), the final visible order matches the last committer's body."
          confidence: STATIC-INFERRED
          evidence: "EnumValueMapper.java:52-71 + DatasetFieldEnumsForm.tsx:45-60"
    - location: "DatasetFieldController.java:55-63 (updateDatasetFieldTags) → DatasetFieldServiceImpl.java:117-132"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer?"
          a: "No ORDER BY in the tag-update path. The final `reactiveTagRepository.listDatasetFieldDtos(datasetFieldId)` (line 129) returns rows in natural order from the join."
          confidence: STATIC-INFERRED
          evidence: "DatasetFieldServiceImpl.java:117-132"
        - q: "What is the tie-breaker when sort-key values are equal?"
          a: "N/A — no ORDER BY."
          confidence: STATIC-INFERRED
          evidence: "DatasetFieldServiceImpl.java:117-132"
        - q: "Which subset is returned when result-set > page size?"
          a: "Not applicable — tags is a small set per field; no pagination."
          confidence: STATIC-INFERRED
          evidence: "DatasetFieldServiceImpl.java:117-132"
        - q: "Does any upstream layer re-sort or filter the result?"
          a: "TagMapper does no sort. UI consumers (DatasetFieldTags components) may sort alphabetically; not asserted here."
          confidence: REFERENCE
          evidence: "<UI sidecar — not yet enriched>"
  auth_gates:
    - location: "SecurityConstants.java:282-303 + DatasetFieldController.java:35-103"
      endpoint: "PUT /api/datasetfields/{id}/name + PUT /description + PUT /tags + POST /enum_values + GET /enum_values + GET /metrics + POST /terms + DELETE /terms/{term_id}"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "DISABLED: SECURITY_RULES are not applied (auth disabled bypasses all permission checks per the platform's auth-disabled posture); every endpoint returns success (subject to validation). LOGIN_FORM / OAUTH2 / LDAP: SECURITY_RULES applied uniformly — the auth-mode does not affect which permission gates which endpoint; the permission-to-endpoint binding lives in SecurityConstants.SECURITY_RULES and is auth-mode-invariant. The TWO mis-bindings at lines 295-296 and 297-299 therefore apply across all THREE auth modes."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:282-303 + AuthorizationCustomizer.java:19-31 + ReactiveResourcePermissionAuthorizationManager.java:22-32"
        - q: "What does an unauthenticated caller see?"
          a: "401 Unauthorized at the SecurityWebFilterChain perimeter (AuthorizationCustomizer.java:29-30 `pathMatchers(\"/**\").authenticated()`). The auth filter rejects before resource extractor / permission check."
          confidence: STATIC-INFERRED
          evidence: "AuthorizationCustomizer.java:29-30"
        - q: "What does a wrong-role caller see?"
          a: "For the six gated endpoints: 403 Forbidden when the user does not hold the wired permission. The 'wired permission' for /terms POST is DATA_ENTITY_ADD_TERM (NOT DATASET_FIELD_ADD_TERM per docs) — this is the bug surfaced by P-153. For the two ungated endpoints (GET /enum_values, GET /metrics): any authenticated user returns 200."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:282-303 + ReactiveResourcePermissionAuthorizationManager.java:28 (`.filter(p -> p.name().equals(permission.name()))`)"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "At the SecurityWebFilterChain layer — registered by AuthorizationCustomizer.java:24-27. The controller carries NO @PreAuthorize. The service tier carries NO programmatic permission check. The repository tier reads natively from the database without owner-scoping. Defence-in-depth is single-layer."
          confidence: STATIC-INFERRED
          evidence: "DatasetFieldController.java:1-103 (no @PreAuthorize) + DatasetFieldServiceImpl.java:1-405 (no programmatic check) + ReactiveDatasetFieldRepositoryImpl.java (no auth filter)"
    - location: "PolicyPermissionDto.java:25, 34"
      endpoint: "permission ENUM identity drives the check"
      questions:
        - q: "Are DATA_ENTITY_ADD_TERM and DATASET_FIELD_ADD_TERM the SAME permission under the hood?"
          a: "NO — distinct enum values at PolicyPermissionDto.java:25 and :34 respectively. Both have `type = DATA_ENTITY` (so live under the same policy type), but the `name()` is different. ReactiveResourcePermissionAuthorizationManager.java:28 filters `.filter(p -> p.name().equals(permission.name()))` — strict name equality. A user holding ONE but not the OTHER will pass / fail differently."
          confidence: STATIC-INFERRED
          evidence: "PolicyPermissionDto.java:25, 34 + ReactiveResourcePermissionAuthorizationManager.java:28"
  resource_boundaries:
    - location: "EnumValueServiceImpl.java:39-82 (createEnumValues)"
      kind: transactional
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "YES — the @ReactiveTransactional at line 40 wraps each call in its own transaction at READ-COMMITTED isolation. Two concurrent calls each read getEnumState (the PRE-write state), softDeleteExcept their own idsToKeep, bulkCreate their own items. The last committer wins; the first committer's writes are silently soft-deleted. No optimistic-lock version check on enum_value; no advisory lock on dataset_field_id. Probe P-154 pins."
          confidence: STATIC-INFERRED
          evidence: "EnumValueServiceImpl.java:40 (@ReactiveTransactional alone — no advisory lock, no version field check)"
        - q: "Is the call replay-safe?"
          a: "Replay-safe for VISIBLE STATE but NOT for AUDIT-TRAIL. Identical request bodies twice produce identical visible state but DIFFERENT row identities (softDeleteExcept + bulkCreate cycle), and emit one DATASET_FIELD_VALUES_UPDATED activity event per call. Probe P-154 pins."
          confidence: STATIC-INFERRED
          evidence: "EnumValueServiceImpl.java:91-122 + activity emit at :41"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No cache. Reads go straight to PG; writes invalidate nothing because nothing caches."
          confidence: STATIC-INFERRED
          evidence: "EnumValueServiceImpl.java + ReactiveEnumValueRepositoryImpl.java (no @Cacheable, no caffeine, no Redis)"
    - location: "TermRelationsRepositoryImpl.java:109-117 (createRelationWithDatasetField)"
      kind: idempotency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "NO — `onDuplicateKeyIgnore()` plus the PRIMARY KEY on (dataset_field_id, term_id) means the second call inserts nothing, no duplicate row. Concurrency-safe."
          confidence: STATIC-INFERRED
          evidence: "TermRelationsRepositoryImpl.java:113"
        - q: "Is the call replay-safe?"
          a: "YES — true idempotency at the DB layer. Activity event is still emitted per call (the @ActivityLog at TermServiceImpl.java:211 runs regardless of whether the row was inserted), so audit-trail-wise the call is NOT replay-safe — replay produces extra activity events without visible state change."
          confidence: STATIC-INFERRED
          evidence: "TermRelationsRepositoryImpl.java:113 + TermServiceImpl.java:210-220"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No cache."
          confidence: STATIC-INFERRED
          evidence: "TermServiceImpl.java + TermRelationsRepositoryImpl.java (no @Cacheable)"
    - location: "TermRelationsRepositoryImpl.java:175-183 (deleteRelationWithDatasetField)"
      kind: transactional
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "NO — DELETE with WHERE clause is atomic at row level; concurrent DELETEs against the same row are serialised by PG row-level locks. Both calls return success; only one row is actually deleted."
          confidence: STATIC-INFERRED
          evidence: "TermRelationsRepositoryImpl.java:175-183 + PG row-level lock semantics"
        - q: "Is the call replay-safe?"
          a: "YES — DELETE-on-missing-row is a no-op. Both calls return 204 No Content. Activity event is emitted per call regardless (TermServiceImpl.java:225)."
          confidence: STATIC-INFERRED
          evidence: "TermRelationsRepositoryImpl.java:175-183 + TermServiceImpl.java:223-239"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No cache."
          confidence: STATIC-INFERRED
          evidence: "TermServiceImpl.java + TermRelationsRepositoryImpl.java"
    - location: "DatasetFieldServiceImpl.java:85-95 (updateDescription) + DatasetFieldInternalInformationServiceImpl.java:26-44"
      kind: transactional
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "Description column is single-row UPDATE; PG row-level lock serialises concurrent updates. Last-write-wins for the description text. The term-extraction call (handleDatasetFieldDescriptionTerms) runs WITHIN the same transaction (@ReactiveTransactional at line 86) but operates on the dataset_field_to_term table — concurrent description-edits with different term markers can leave the field with terms from the WRONG description text (T1 description has marker [A]; T2 description has marker [B]; T2 commits last; description-text shows T2; term-link table may or may not show A depending on commit order)."
          confidence: STATIC-INFERRED
          evidence: "DatasetFieldServiceImpl.java:85-95 + TermServiceImpl.java:243-251"
        - q: "Is the call replay-safe?"
          a: "Same description text replayed twice produces same visible state. Activity event emitted per call. Term re-extraction is idempotent (the term-extraction pass first deletes obsolete description-links then creates current ones)."
          confidence: STATIC-INFERRED
          evidence: "TermServiceImpl.java:391-415 (updateDatasetFieldDescriptionTermsState)"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No cache. Search-vector update at reactiveSearchEntrypointRepository.updateDatasetFieldSearchVectors (line 42 of inner-service) refreshes the FTS index synchronously inside the transaction."
          confidence: STATIC-INFERRED
          evidence: "DatasetFieldInternalInformationServiceImpl.java:42-43"
  request_inputs:
    - location: "DatasetFieldController.java:37 (updateDatasetFieldDescription)"
      input_kind: path-param
      input_name: "datasetFieldId"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "The id of the dataset field whose description is being updated."
          confidence: STATIC-INFERRED
          evidence: "DatasetFieldController.java:37"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Controller forwards to DatasetFieldService.updateDescription(datasetFieldId, formData) → DatasetFieldInternalInformationServiceImpl.updateDescription(datasetFieldId, formData) → ReactiveDatasetFieldRepositoryImpl.updateDescription(datasetFieldId, formData.getDescription()) which issues `DSL.update(DATASET_FIELD).set(INTERNAL_DESCRIPTION, ...).where(ID.eq(datasetFieldId))`. The id binds to `dataset_field.id` column."
          confidence: STATIC-INFERRED
          evidence: "DatasetFieldController.java:36-43 + DatasetFieldServiceImpl.java:87-95 + DatasetFieldInternalInformationServiceImpl.java:32"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — name and column are aligned."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "DatasetFieldInternalInformationServiceImpl.java:32"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — matches."
          confidence: STATIC-INFERRED
          evidence: "N/A"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE — `dataset_field.id` is the single identity column. The auth extractor side-effect (resolves to parent data_entity.id) is documented separately as an implicit ADR."
          confidence: STATIC-INFERRED
          evidence: "DatasetFieldResourceExtractor.java:26"
      routes_to_finding: ""
    - location: "DatasetFieldController.java:38 (updateDatasetFieldDescription)"
      input_kind: body-field
      input_name: "DatasetFieldDescriptionUpdateFormData.description"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "The new description text for the dataset field."
          confidence: STATIC-INFERRED
          evidence: "DatasetFieldController.java:38 + openapi.yaml:2463"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Stored verbatim into `dataset_field.internal_description` column (note: the schema column is `internal_description`, the form field is `description`)."
          confidence: STATIC-INFERRED
          evidence: "ReactiveDatasetFieldRepositoryImpl.java:73-80 (sets INTERNAL_DESCRIPTION column)"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_LEGITIMATELY — form field is `description`; column is `internal_description`. The schema separates internal (ODD-user-edited) from external (ingestion-time) descriptions; the form field maps to the INTERNAL slot. The translation is consistent with ODD's documented annotation model where 'internal description' is the user-authored layer."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ReactiveDatasetFieldRepositoryImpl.java:73-80 + ODD docs concept of internal/external annotation layer"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — legitimate translation. A caller assuming they overwrite ALL descriptions (including ingestion-time external_description) would be wrong, but the OpenAPI shape (`description` not `externalDescription`) does not promise the external slot."
          confidence: STATIC-INFERRED
          evidence: "openapi.yaml:2463"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE — there is no `dataset_field.description` column (only internal_description / external_description). The form field's name is a deliberate abbreviation."
          confidence: STATIC-INFERRED
          evidence: "dataset_field table schema"
      routes_to_finding: ""
    - location: "DatasetFieldController.java:48 (updateDatasetFieldInternalName)"
      input_kind: body-field
      input_name: "InternalNameFormData.internalName"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "The new internal (business) name for the dataset field."
          confidence: STATIC-INFERRED
          evidence: "DatasetFieldController.java:48 + openapi.yaml:2486"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Stored into `dataset_field.internal_name` via DatasetFieldServiceImpl.updateInternalName → ReactiveDatasetFieldRepository.updateInternalName(datasetFieldId, internalName)."
          confidence: STATIC-INFERRED
          evidence: "DatasetFieldServiceImpl.java:100-115"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — name and column are aligned (`internalName` ↔ `internal_name`)."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "DatasetFieldServiceImpl.java:103"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — matches."
          confidence: STATIC-INFERRED
          evidence: "N/A"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "N/A"
      routes_to_finding: ""
    - location: "DatasetFieldController.java:58 (updateDatasetFieldTags)"
      input_kind: body-field
      input_name: "DatasetFieldTagsUpdateFormData.tags"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "A list of tag NAMES (strings) to be associated with the field."
          confidence: STATIC-INFERRED
          evidence: "DatasetFieldController.java:58 + openapi.yaml:2509"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Tag names are deduplicated into a Set, then resolved (or auto-created via tagService.getOrCreateTagsByName) to tag ids, then `dataset_field_to_tag` relations are deleted + re-created. DatasetFieldServiceImpl.java:117-132."
          confidence: STATIC-INFERRED
          evidence: "DatasetFieldServiceImpl.java:117-132"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_LEGITIMATELY — the form field carries STRING NAMES; the implementation resolves names to ids AND auto-creates tags that do not exist. The auto-create side-door is a known pattern (see canonicalisation candidate `permission-bypass-via-owner-auto-create-side-door-write-path` in the concepts index) but the form field name `tags` accurately implies tag names (not tag ids)."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "DatasetFieldServiceImpl.java:264-271 + tagService.getOrCreateTagsByName"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — translation is documented in the canonicalisation candidate."
          confidence: STATIC-INFERRED
          evidence: "lineage/odd-platform/concepts/detail/canonicalisation_candidates/permission-bypass-via-owner-auto-create-side-door-write-path.yaml"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE — `tag_to_dataset_field` is the right table; `tag.name` is read for lookup; no closer column."
          confidence: STATIC-INFERRED
          evidence: "tag_to_dataset_field schema"
      routes_to_finding: ""
    - location: "DatasetFieldController.java:67 (createEnumValue)"
      input_kind: body-field
      input_name: "BulkEnumValueFormData.items"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "The items NAME is honest about the array shape; the encompassing operationId `createEnumValue` (singular) is the misleading layer (covered under Stress Cat B name-behavior-pairs)."
          confidence: STATIC-INFERRED
          evidence: "openapi.yaml:2547 + DatasetFieldController.java:67"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "EnumValueServiceImpl.createEnumValues partitions items by `id != null`, dispatches bulkCreate / bulkUpdate, and softDeleteExcept for omitted ids. The input array IS the new state."
          confidence: STATIC-INFERRED
          evidence: "EnumValueServiceImpl.java:91-122"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES at the field-level (items IS a bulk array). The drift lives at the operationId layer, not the field-name layer."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "EnumValueServiceImpl.java:91-122"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A at the field-name layer."
          confidence: STATIC-INFERRED
          evidence: "N/A"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "N/A"
      routes_to_finding: ""
    - location: "DatasetFieldController.java:67 (createEnumValue, items[i])"
      input_kind: body-field
      input_name: "EnumValueFormData.id"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "The id of an EXISTING enum value being updated. The field is nullable per the OpenAPI schema (no `required: true` annotation), which is the conventional signal that null means CREATE-NEW."
          confidence: STATIC-INFERRED
          evidence: "openapi.yaml + EnumValueFormData schema"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "id != null → row included in `idsToKeep` (line 97-100); the bulkUpdate path receives this pojo. id == null → bulkCreate. Items NOT in idsToKeep → softDeleteExcept. The id thus drives the partition between CREATE / UPDATE / SOFT-DELETE-by-omission."
          confidence: STATIC-INFERRED
          evidence: "EnumValueServiceImpl.java:97-105"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES + an undocumented effect: id presence determines whether the row is preserved against the softDeleteExcept sweep. The field name accurately names the row identifier; the BULK-REPLACE semantics is a meta-layer above the field-name promise."
          drift: NONE (at field-name layer)
          confidence: STATIC-INFERRED
          evidence: "EnumValueServiceImpl.java:97-105"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "A caller who reuses an EXISTING enum value by NAME but does NOT pass its id will trigger softDelete-of-existing + create-with-new-id. Row identity churns. Probe P-154 pins."
          confidence: STATIC-INFERRED
          evidence: "EnumValueServiceImpl.java:97-105"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE — `enum_value.id` IS the column. The opportunity to PRE-LOOKUP by name and inject the id server-side (avoiding the row-churn) is a refactor possibility, not a present-day data path."
          confidence: STATIC-INFERRED
          evidence: "EnumValueServiceImpl.java:91-122"
      routes_to_finding: "bugs_limitations_corner_cases (id-churn on replay)"
    - location: "DatasetFieldController.java:89 (addDatasetFieldTerm)"
      input_kind: body-field
      input_name: "DatasetFieldTermFormData.termId"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "The id of the term being linked to the field."
          confidence: STATIC-INFERRED
          evidence: "DatasetFieldController.java:89 + openapi.yaml:2587"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "termService.linkTermWithDatasetField(termId, datasetFieldId) → termRelationsRepository.createRelationWithDatasetField(datasetFieldId, termId) → INSERT into dataset_field_to_term (dataset_field_id, term_id) ON DUPLICATE KEY IGNORE."
          confidence: STATIC-INFERRED
          evidence: "TermServiceImpl.java:212-220 + TermRelationsRepositoryImpl.java:109-117"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — termId binds to term.id."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "TermRelationsRepositoryImpl.java:113"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — matches."
          confidence: STATIC-INFERRED
          evidence: "N/A"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "NONE."
          confidence: STATIC-INFERRED
          evidence: "N/A"
      routes_to_finding: ""
    - location: "DatasetFieldController.java:99 (deleteTermFromDatasetField)"
      input_kind: path-param
      input_name: "termId"
      questions:
        - q: "What does the input NAME promise the caller?"
          a: "The id of the term being deleted from the field's terms list."
          confidence: STATIC-INFERRED
          evidence: "DatasetFieldController.java:99 + openapi.yaml:2605"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "termService.removeTermFromDatasetField(termId, datasetFieldId) → termRelationsRepository.deleteRelationWithDatasetField(datasetFieldId, termId) → DELETE FROM dataset_field_to_term WHERE dataset_field_id = ? AND term_id = ? AND IS_DESCRIPTION_LINK IS FALSE."
          confidence: STATIC-INFERRED
          evidence: "TermServiceImpl.java:226-239 + TermRelationsRepositoryImpl.java:175-183"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY — the endpoint promises 'delete term from the field's terms list' (matching the OpenAPI summary 'Delete term from current dataset field terms list'). The implementation deletes only MANUAL term-links; description-link rows survive. A term with TWO rows (manual + description) returns 204 from DELETE but the term STAYS in the field's terms list when viewed via GET /api/datasetfields/{id}/terms (assuming the linked-terms list reader does not filter by IS_DESCRIPTION_LINK). The user-visible failure: 'delete succeeded but term is still there'."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "TermRelationsRepositoryImpl.java:179 (`.and(IS_DESCRIPTION_LINK.isFalse())`)"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "User clicks 'X' on a term tag; UI calls DELETE; backend returns 204; UI removes the tag from local state — but a page refresh re-fetches the field's term list from the backend, which returns the description-link row, and the term reappears in the UI. The operator perceives this as 'the platform won't let me delete this term'."
          confidence: STATIC-INFERRED
          evidence: "TermRelationsRepositoryImpl.java:175-183 + TermServiceImpl.java:226-239 + UI binding at DatasetFieldTerms.tsx"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used?"
          a: "PARTIAL — the description-link row WITH the same term_id IS present in the table but is NOT touched by the DELETE. The unused-but-name-matching column is `is_description_link`; a complete delete would either (a) ignore IS_DESCRIPTION_LINK and delete both rows OR (b) be documented as 'delete only the manual link' so operators understand."
          confidence: STATIC-INFERRED
          evidence: "TermRelationsRepositoryImpl.java:179"
      routes_to_finding: "bugs_limitations_corner_cases (description-link survives delete)"
  probes_emitted:
    - probe_id: P-153
      question: "Two coupled SecurityConstants wiring bugs at lines 295-303: do they actually produce the operator-visible permission mismatches?"
      probe_path: "lineage/odd-platform/probes/P-153.yaml"
    - probe_id: P-154
      question: "createEnumValue — BULK-REPLACE semantics, replay-safe-for-state-not-for-audit, concurrent-write last-write-wins"
      probe_path: "lineage/odd-platform/probes/P-154.yaml"
    - probe_id: P-155
      question: "deleteTermFromDatasetField — description-link survives the explicit DELETE; term remains visible in UI"
      probe_path: "lineage/odd-platform/probes/P-155.yaml"
  stress_summary:
    triggers_total: 25
    questions_total: 64
    answers_static_inferred: 58
    answers_probe_needed: 0
    answers_reference: 1
    drift_flags: 3                            # createEnumValue NAME vs BULK-REPLACE; deleteTermFromDatasetField NAME vs filtered-DELETE; deleteTerm path-param termId TRANSLATES_SILENTLY
```

## upstream_callers

- entry_point: "ui_route:/dataentities/{id}/structure (DatasetFieldOverview drawer)"
  caller_node: "ts react-component:DatasetFieldOverview"
  multiplicity_per_trigger: 1
  evidence: "DatasetFieldOverview.tsx component (UI side; not yet enriched) loads field metrics + enum values + tags + terms when the user opens the per-column drawer. The hook bindings at `<odd-platform-repo>/odd-platform-ui/src/lib/hooks/api/datasetField.ts:13-25` (`useDataSetFieldMetrics`) call GET /api/datasetfields/{id}/metrics on mount; siblings (DatasetFieldEnums, DatasetFieldTerms, DatasetFieldTags) call the corresponding endpoints."
  observation_class: ui-call
  unresolved: true
- entry_point: "ui_route:/dataentities/{id}/structure (DatasetFieldHeader.InternalNameForm submission)"
  caller_node: "ts react-component:DatasetFieldInternalNameForm"
  multiplicity_per_trigger: 1
  evidence: "<odd-platform-repo>/odd-platform-ui/src/components/.../DatasetFieldHeader/DatasetFieldInternalNameForm/DatasetFieldInternalNameForm.tsx + useUpdateDatasetFieldInternalName hook at datasetField.ts:54-60 — onSubmit dispatches one mutation per form submission, one HTTP PUT per click."
  observation_class: ui-call
  unresolved: true
- entry_point: "ui_route:/dataentities/{id}/structure (DatasetFieldEnumsForm Save)"
  caller_node: "ts react-component:DatasetFieldEnumsForm"
  multiplicity_per_trigger: 1
  evidence: "<odd-platform-repo>/odd-platform-ui/src/components/.../DatasetFieldEnumsForm/DatasetFieldEnumsForm.tsx:90-105 — handleFormSubmit dispatches createDataSetFieldEnum thunk with the FULL items list (every form-row item); one HTTP POST per Save click. The UI correctly sends the FULL state (no risk of accidental partial-body delete) because the form's defaultValues are initialised from the existing enum-list (lines 45-60)."
  observation_class: ui-call
  unresolved: true
- entry_point: "ui_route:/dataentities/{id}/structure (DatasetFieldTerms add term)"
  caller_node: "ts react-component:DatasetFieldTerms"
  multiplicity_per_trigger: 1
  evidence: "<odd-platform-repo>/odd-platform-ui/src/components/.../DatasetFieldTerms/DatasetFieldTerms.tsx + useAddDatasetFieldTerm hook at datasetField.ts:32-41 — adds a term per click."
  observation_class: ui-call
  unresolved: true
- entry_point: "ui_route:/dataentities/{id}/structure (DatasetFieldTerms remove term)"
  caller_node: "ts react-component:DatasetFieldTerms"
  multiplicity_per_trigger: 1
  evidence: "<odd-platform-repo>/odd-platform-ui/src/components/.../DatasetFieldTerms/DatasetFieldTerms.tsx + useDeleteDatasetFieldTerm hook at datasetField.ts:43-52 — removes a term per click. Note the description-link survival caveat (Stress Cat E) is NOT visible at this UI binding; the UI assumes DELETE removes the term completely."
  observation_class: ui-call
  unresolved: true
- entry_point: "rest:PUT /api/datasetfields/{id}/description (direct API consumer — e.g. terraform-odd-provider, glossary-importer scripts)"
  caller_node: "<external — sdk consumer>"
  multiplicity_per_trigger: 1
  evidence: "OpenAPI-generated SDKs expose the endpoint; the unfunded OSS project has no direct telemetry on out-of-tree consumers. Mentioned for completeness — the Category F input_naming alignment analysis above covers the SDK-consumer perspective."
  observation_class: rest-call
  unresolved: true

## downstream_side_effects

- side_effect_class: db-write
  description: "Updates `dataset_field.internal_description` column with verbatim user input."
  evidence: "ReactiveDatasetFieldRepositoryImpl.java:73-80"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/dataentities/{id}/structure (DatasetFieldOverview description editor)"
    - "rest:PUT /api/datasetfields/{id}/description"
- side_effect_class: db-write
  description: "Updates `dataset_field.internal_name` column."
  evidence: "ReactiveDatasetFieldRepositoryImpl.java:updateInternalName"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "ui_route:/dataentities/{id}/structure (DatasetFieldHeader.InternalNameForm)"
    - "rest:PUT /api/datasetfields/{id}/name"
- side_effect_class: db-write
  description: "Replaces `tag_to_dataset_field` rows for the field (delete-then-recreate via tagService.getOrCreateTagsByName, including AUTO-CREATE of new tag rows in `tag` table)."
  evidence: "DatasetFieldServiceImpl.java:117-132 (deleteDatasetFieldInternalRelations + getOrCreateTagsByName + createDatasetFieldRelations)"
  cardinality_per_call: "N (one delete + M creates + 0..M tag-creates)"
  reachable_from_entry_points:
    - "ui_route:/dataentities/{id}/structure (DatasetFieldTags)"
    - "rest:PUT /api/datasetfields/{id}/tags"
- side_effect_class: db-write
  description: "Bulk-replaces `enum_value` rows for the field — soft-delete-except + bulk-update + bulk-create."
  evidence: "EnumValueServiceImpl.java:91-122"
  cardinality_per_call: "N (idsToKeep-many updates + items-without-id-many creates + everything-else-many soft-deletes)"
  reachable_from_entry_points:
    - "ui_route:/dataentities/{id}/structure (DatasetFieldEnumsForm)"
    - "rest:POST /api/datasetfields/{id}/enum_values"
- side_effect_class: db-write
  description: "Inserts `dataset_field_to_term` row (manual link) — silently ignored on duplicate."
  evidence: "TermRelationsRepositoryImpl.java:109-117 (onDuplicateKeyIgnore)"
  cardinality_per_call: "0 or 1 (1 if new pair, 0 if duplicate)"
  reachable_from_entry_points:
    - "ui_route:/dataentities/{id}/structure (DatasetFieldTerms add)"
    - "rest:POST /api/datasetfields/{id}/terms"
- side_effect_class: db-write
  description: "Deletes `dataset_field_to_term` row WHERE is_description_link = false."
  evidence: "TermRelationsRepositoryImpl.java:175-183"
  cardinality_per_call: "0 or 1 (1 if manual link existed, 0 otherwise — description-links never deleted by this path)"
  reachable_from_entry_points:
    - "ui_route:/dataentities/{id}/structure (DatasetFieldTerms remove)"
    - "rest:DELETE /api/datasetfields/{id}/terms/{term_id}"
- side_effect_class: db-write
  description: "Refreshes FTS search vectors for the parent DataEntity (via `reactiveSearchEntrypointRepository.updateDatasetFieldSearchVectors(datasetFieldId)`)."
  evidence: "DatasetFieldInternalInformationServiceImpl.java:42 + DatasetFieldServiceImpl.java:113, :128"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "rest:PUT /api/datasetfields/{id}/description"
    - "rest:PUT /api/datasetfields/{id}/name"
    - "rest:PUT /api/datasetfields/{id}/tags"
- side_effect_class: db-write
  description: "Marks parent DataEntity as filled or unfilled for the DATASET_FIELD_DESCRIPTION / DATASET_FIELD_INTERNAL_NAME / DATASET_FIELD_TAGS / DATASET_FIELD_ENUMS / DATASET_FIELD_TERMS facet (data_entity_filled table)."
  evidence: "DatasetFieldInternalInformationServiceImpl.java:34-40 + DatasetFieldServiceImpl.java:106-112, :128 + EnumValueServiceImpl.java:111-121 + TermServiceImpl.java:218-219, :231-235"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "rest:PUT /api/datasetfields/{id}/description"
    - "rest:PUT /api/datasetfields/{id}/name"
    - "rest:PUT /api/datasetfields/{id}/tags"
    - "rest:POST /api/datasetfields/{id}/enum_values"
    - "rest:POST /api/datasetfields/{id}/terms"
    - "rest:DELETE /api/datasetfields/{id}/terms/{term_id}"
- side_effect_class: activity-emit
  description: "Emits `DATASET_FIELD_DESCRIPTION_UPDATED` activity event (one per description PUT)."
  evidence: "DatasetFieldInternalInformationServiceImpl.java:28 (@ActivityLog annotation)"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "rest:PUT /api/datasetfields/{id}/description"
- side_effect_class: activity-emit
  description: "Emits `DATASET_FIELD_TERM_ASSIGNMENT_UPDATED` activity event (term re-extraction inside description PUT, OR add-term POST, OR remove-term DELETE)."
  evidence: "TermServiceImpl.java:211, :225, :243"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "rest:PUT /api/datasetfields/{id}/description"
    - "rest:POST /api/datasetfields/{id}/terms"
    - "rest:DELETE /api/datasetfields/{id}/terms/{term_id}"
- side_effect_class: activity-emit
  description: "Emits `DATASET_FIELD_INTERNAL_NAME_UPDATED` activity event."
  evidence: "DatasetFieldServiceImpl.java:99 (@ActivityLog annotation)"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "rest:PUT /api/datasetfields/{id}/name"
- side_effect_class: activity-emit
  description: "Emits `DATASET_FIELD_TAGS_UPDATED` activity event."
  evidence: "DatasetFieldServiceImpl.java:119 (@ActivityLog annotation)"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "rest:PUT /api/datasetfields/{id}/tags"
- side_effect_class: activity-emit
  description: "Emits `DATASET_FIELD_VALUES_UPDATED` activity event per enum-value POST."
  evidence: "EnumValueServiceImpl.java:41 (@ActivityLog annotation)"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "rest:POST /api/datasetfields/{id}/enum_values"
- side_effect_class: db-write
  description: "Compound activity-emit on description-PUT — one DESCRIPTION_UPDATED + one TERM_ASSIGNMENT_UPDATED (when description body contains [[ns/name]] markers)."
  evidence: "DatasetFieldServiceImpl.java:87-95 (chained .then(termService.handleDatasetFieldDescriptionTerms))"
  cardinality_per_call: "2 when description contains term markers, 1 when description contains none"
  reachable_from_entry_points:
    - "rest:PUT /api/datasetfields/{id}/description"

## sources

- understanding ← DatasetFieldController.java:1-103 + openapi.yaml:2451-2611 + SecurityConstants.java:282-303 + DatasetFieldResourceExtractor.java:21-27
- concepts.entities.DatasetFieldDescriptionUpdateFormData ← DatasetFieldController.java:7, 38 + openapi.yaml:2463
- concepts.entities.InternalNameFormData ← DatasetFieldController.java:12, 48 + openapi.yaml:2486
- concepts.entities.DatasetFieldTagsUpdateFormData ← DatasetFieldController.java:8, 58 + openapi.yaml:2509
- concepts.operations.update-internal-description ← DatasetFieldController.java:36-43 + DatasetFieldServiceImpl.java:87-95 + DatasetFieldInternalInformationServiceImpl.java:26-44
- concepts.operations.update-internal-name ← DatasetFieldController.java:46-53 + DatasetFieldServiceImpl.java:98-115
- concepts.operations.update-tags ← DatasetFieldController.java:56-63 + DatasetFieldServiceImpl.java:117-132
- concepts.operations.create-enum-values ← DatasetFieldController.java:65-72 + EnumValueServiceImpl.java:39-122
- concepts.operations.add-term ← DatasetFieldController.java:88-95 + TermServiceImpl.java:210-220 + TermRelationsRepositoryImpl.java:109-117
- concepts.operations.delete-term ← DatasetFieldController.java:97-103 + TermServiceImpl.java:223-239 + TermRelationsRepositoryImpl.java:175-183
- concepts.invariants[0] thin-proxy ← DatasetFieldController.java:35-103
- concepts.invariants[1] parent-scoped-auth ← DatasetFieldResourceExtractor.java:21-27 + SecurityConstants.java:282-303
- concepts.invariants[3] spec-code-response-code-drift ← openapi.yaml:2465, :2488, :2511 + DatasetFieldController.java:42, :52, :62
- concepts.invariants[5] wrong-permission-wiring /terms POST ← SecurityConstants.java:297-299 + PolicyPermissionDto.java:34 + WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions (status 200, 2026-05-25)
- concepts.invariants[6] alerts-status copy-paste-bug ← SecurityConstants.java:295-296
- concepts.invariants[7] activity-log-structural-asymmetry-but-no-operator-impact ← DatasetFieldServiceImpl.java:99, :119 + DatasetFieldInternalInformationServiceImpl.java:28 + WebFetch https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed (status 200, 2026-05-20)
- concepts.invariants[8] description-edit-404-on-missing-id ← DatasetFieldInternalInformationServiceImpl.java:33 (`.switchIfEmpty(Mono.error(new NotFoundException(...)))`)
- concepts.invariants[9] enum-bulk-replace ← EnumValueServiceImpl.java:91-122 + DatasetFieldController.java:65-72 + openapi.yaml:2536-2554
- concepts.invariants[10] add-term-idempotent-empty-body ← TermRelationsRepositoryImpl.java:109-117 + DatasetFieldController.java:88-95
- concepts.invariants[11] delete-term-keeps-description-links ← TermRelationsRepositoryImpl.java:175-183
- dependencies_semantic.coupling[0] auth-extractor-coupling ← DatasetFieldResourceExtractor.java:21-27 + ReactiveDatasetFieldRepositoryImpl.java:115-125
- dependencies_semantic.coupling[3] dual-activity-event-on-description-edit ← DatasetFieldServiceImpl.java:89-90 + TermServiceImpl.java:243
- dependencies_semantic.coupling[6] delete-term-cascade-filter ← TermRelationsRepositoryImpl.java:179
- tests_coverage_semantic.test_files ← (NO direct controller tests; grep `DatasetFieldController` in `<odd-platform-repo>/odd-platform-api/src/test/java` returns 0 matches) + EnumValueServiceTest.java:1-164
- docs_link_semantic.inferred_docs[0] activity-feed ← WebFetch https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed (status 200, 2026-05-20) — fetched_excerpt verbatim
- docs_link_semantic.inferred_docs[1] permissions ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions (status 200, 2026-05-25) — fetched_excerpt verbatim
- docs_link_semantic.inferred_docs[2] business-names ← WebFetch https://docs.opendatadiscovery.org/features/data-discovery/business-names (status 200, 2026-05-25) — fetched_excerpt verbatim
- docs_link_semantic.doc_drift_findings[3] coherence-correction-on-prior-batch-R-and-F-004-claim ← grep `DATASET_FIELD_DESCRIPTION_UPDATED` across <odd-platform-repo>/odd-platform-api/src/main/java returns 5 hits (DTO definition, mapper case, inner-service @ActivityLog, activity-handler isHandle, this sidecar's evidence) + WebFetch activity-feed doc confirms the event is documented + DatasetFieldInternalInformationServiceImpl.java:28 carries the annotation
- implicit_adrs[0] thin-proxy ← DatasetFieldController.java:35-103
- implicit_adrs[1] parent-scoped-auth ← DatasetFieldResourceExtractor.java:21-27 + SecurityConstants.java:282-303
- implicit_adrs[2] activity-log-at-service-layer ← DatasetFieldServiceImpl.java:99, :119 + DatasetFieldInternalInformationServiceImpl.java:28 + TermServiceImpl.java:211, :225
- implicit_adrs[3] read-endpoints-omitted-from-security-rules ← DatasetFieldController.java:74-86 + SecurityConstants.java:282-303
- implicit_adrs[4] dual-activity-event-on-description-edit ← DatasetFieldServiceImpl.java:87-95 + TermServiceImpl.java:243 + DatasetFieldInternalInformationServiceImpl.java:28
- implicit_adrs[5] enum-bulk-replace ← EnumValueServiceImpl.java:91-122
- implicit_adrs[6] add-term-idempotent-via-jooq ← TermRelationsRepositoryImpl.java:109-117
- implicit_adrs[7] delete-term-cascade-rule ← TermRelationsRepositoryImpl.java:175-183
- bugs_limitations_corner_cases[0] wrong-permission-/terms POST ← SecurityConstants.java:297-299 + PolicyPermissionDto.java:34 + docs URL
- bugs_limitations_corner_cases[1] alerts-status-copy-paste ← SecurityConstants.java:295-296
- bugs_limitations_corner_cases[2] spec-code-response-code-drift ← openapi.yaml:2465, :2488, :2511 + DatasetFieldController.java:42, :52, :62
- bugs_limitations_corner_cases[4] verbatim-storage-XSS-class ← DatasetFieldController.java:36-43 + ReactiveDatasetFieldRepositoryImpl.java:73-80
- bugs_limitations_corner_cases[7] enum-bulk-replace-deletes-by-omission ← EnumValueServiceImpl.java:91-122 + DatasetFieldEnumsForm.tsx:90-105
- bugs_limitations_corner_cases[8] enum-replay-churns-row-ids ← EnumValueServiceImpl.java:91-122
- bugs_limitations_corner_cases[9] enum-concurrent-last-write-wins ← EnumValueServiceImpl.java:39-82 (no advisory lock, no version field)
- bugs_limitations_corner_cases[10] delete-term-keeps-description-links ← TermRelationsRepositoryImpl.java:179
- bugs_limitations_corner_cases[11] add-term-200-empty-body ← TermRelationsRepositoryImpl.java:113 + DatasetFieldController.java:88-95
- security.authorization_assertions ← SecurityConstants.java:282-303 (line-by-line)
- security.known_security_gaps[0] permission-wiring-bug ← SecurityConstants.java:297-299 + docs URL
- security.known_security_gaps[1] copy-paste-bug-alerts ← SecurityConstants.java:295-296
- performance.hot_paths[0] auth-extractor-DB-roundtrip ← DatasetFieldResourceExtractor.java:21-27 + ReactiveDatasetFieldRepositoryImpl.java:115-125
- performance.hot_paths[1] description-edit-fan-out ← DatasetFieldServiceImpl.java:87-95 + DatasetFieldInternalInformationServiceImpl.java:32-44 + TermServiceImpl.java:243-251
- performance.hot_paths[2] tags-edit-fan-out ← DatasetFieldServiceImpl.java:117-132
- stress_findings.name_behavior_pairs[0] createEnumValue ← EnumValueServiceImpl.java:91-122 + openapi.yaml:2536-2554
- stress_findings.name_behavior_pairs[2] deleteTermFromDatasetField ← TermRelationsRepositoryImpl.java:175-183
- stress_findings.request_inputs[7] termId path-param ← TermRelationsRepositoryImpl.java:175-183
- stress_findings.probes_emitted[0] P-153 ← lineage/odd-platform/probes/P-153.yaml
- stress_findings.probes_emitted[1] P-154 ← lineage/odd-platform/probes/P-154.yaml
- stress_findings.probes_emitted[2] P-155 ← lineage/odd-platform/probes/P-155.yaml
- upstream_callers[0]-[4] UI components ← <odd-platform-repo>/odd-platform-ui/src/lib/hooks/api/datasetField.ts:1-60 + DatasetFieldEnumsForm.tsx:90-105
- downstream_side_effects ← per-section file:line citations

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` (the three UI auth modes that protect this API surface). `DISABLED` bypasses all gates and exposes all seven endpoints to any caller. `S2S` does not apply — `/api/datasetfields/*` paths are UI/API surface, not `/ingestion/*` paths. The controller itself carries no `@ConditionalOnProperty(auth.type=...)` — it is wired unconditionally.
- **ingestion_filter_relevance**: `NO — UI/API surface, not ingestion`. The S2S ingestion filter (`auth.ingestion.filter.enabled`) gates `POST /ingestion/entities`, which does not reach this controller. Ingestion-side dataset_field mutations flow through `DatasetStructureIngestionRequestProcessor → DatasetFieldServiceImpl.createOrUpdateDatasetFields` directly, bypassing this controller.
- **authorization_assertions**:
  - "`SecurityRule(DATASET_FIELD, '/api/datasetfields/{dataset_field_id}/name PUT', DATASET_FIELD_INTERNAL_NAME_UPDATE)` — evidence: SecurityConstants.java:282-284"
  - "`SecurityRule(DATASET_FIELD, '/api/datasetfields/{dataset_field_id}/description PUT', DATASET_FIELD_DESCRIPTION_UPDATE)` — evidence: SecurityConstants.java:285-287"
  - "`SecurityRule(DATASET_FIELD, '/api/datasetfields/{dataset_field_id}/tags PUT', DATASET_FIELD_TAGS_UPDATE)` — evidence: SecurityConstants.java:288-290"
  - "`SecurityRule(DATASET_FIELD, '/api/datasetfields/{dataset_field_id}/enum_values POST', DATASET_FIELD_ENUMS_UPDATE)` — evidence: SecurityConstants.java:291-294"
  - "`SecurityRule(DATASET_FIELD, '/api/datasetfields/{dataset_field_id}/terms POST', DATA_ENTITY_ADD_TERM) [WRONG — should be DATASET_FIELD_ADD_TERM per docs]` — evidence: SecurityConstants.java:297-299"
  - "`SecurityRule(DATASET_FIELD, '/api/datasetfields/{dataset_field_id}/terms/{term_id} DELETE', DATASET_FIELD_DELETE_TERM)` — evidence: SecurityConstants.java:300-303"
  - "NO SecurityRule for `GET /api/datasetfields/{id}/enum_values` or `GET /api/datasetfields/{id}/metrics` — these reads are reachable by any authenticated user (read-collaborative posture)."
- **owner_scoping**: `BYPASSES — read endpoints are platform-wide visible to any authenticated user; mutation endpoints are gated by parent-DataEntity permission, which itself does not enforce owner-scoping (parent permission applies regardless of owner-ship of the DataEntity).` The model is documented in `ReactiveDatasetFieldRepositoryImpl` invariant 6 — read-collaborative posture across the dataset-field surface.
- **data_exposure**:
  - "Description-edit response (`DataSetFieldDescription` — `description` + `linkedTerms: [LinkedTerm]`) → any user authorized via parent-DataEntity check. Contains the verbatim user-supplied description text plus the resolved term references."
  - "Internal-name response (`InternalName` — single field) → any user authorized via parent-DataEntity check. Contains the verbatim user-supplied internal-name string."
  - "Tags response (`Flux<Tag>` — full Tag list) → any user authorized via parent-DataEntity check. Contains the full set of current tags on the field, including INTERNAL-origin tags (operator-curated)."
  - "Enum values + metrics responses → any authenticated user, regardless of parent DataEntity permission. Read-collaborative posture."
- **known_security_gaps**:
  - "`SecurityConstants.java:299` wires `POST /api/datasetfields/{id}/terms` to `DATA_ENTITY_ADD_TERM` instead of `DATASET_FIELD_ADD_TERM`. Live docs at `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions` document `DATASET_FIELD_ADD_TERM` as the correct gate. The drift gives DATA_ENTITY_ADD_TERM holders unintended field-level term-link capability and denies it to DATASET_FIELD_ADD_TERM holders. P-153 pins." — evidence: SecurityConstants.java:297-299 + PolicyPermissionDto.java:25, :34 + docs URL — severity: HIGH

  - "`SecurityConstants.java:295-296` wires `PUT /api/alerts/{alert_id}/status` to `DATASET_FIELD_ADD_TERM` — copy-paste bug from this controller's auth block. The ALERT-side endpoint is gated by a DATASET_FIELD permission unrelated to its function. Any user holding `DATASET_FIELD_ADD_TERM` can resolve alerts; users holding an actual ALERT permission but lacking `DATASET_FIELD_ADD_TERM` cannot. P-153 pins." — evidence: SecurityConstants.java:295-296 — severity: HIGH

  - "Description / internal-name / tags edit endpoints accept verbatim user input with NO backend sanitisation, NO length cap, NO allowlist — F-004 verbatim-storage XSS-class at the per-column surface. Defence-in-depth at the UI render layer (probe P-009 — Markdown.tsx) is the operative safeguard; cross-tab coverage of the DatasetField description render path is unverified." — evidence: DatasetFieldController.java:36-63 + ReactiveDatasetFieldRepositoryImpl.java:73-90 — severity: MEDIUM

  - "Two read endpoints (`getEnumValues`, `getDatasetFieldMetrics`) have no `SecurityRule` — they fall back to global authentication-only and are visible cross-owner. Consistent with read-collaborative posture but undocumented at the endpoint surface; an operator restricting `DATASET_FIELD_ENUMS_UPDATE` may not realize the corresponding GET is unrestricted." — evidence: DatasetFieldController.java:74-86 + SecurityConstants.java:282-303 (no rule for these GETs) — severity: LOW

  - "Parent-scope authorization model collapses field-level access to entity-level — a user with permission on the parent DataEntity has permission on every field of that entity. Intentional per the read-collaborative pillar; not documented at the dataset-field permission docs." — evidence: DatasetFieldResourceExtractor.java:21-27 + SecurityConstants.java:282-303 — severity: LOW (model-level, not bug-level)

## performance

- **hot_paths**:
  - "Every authorized request issues 1 DB round-trip via `DatasetFieldResourceExtractor.extractResourceId` → `ReactiveDatasetFieldRepository.getDataEntityIdByDatasetFieldId` (3-table join `dataset_field → dataset_structure → dataset_version → data_entity`) BEFORE the controller method executes. For the six gated endpoints (name, description, tags, enum_values, terms POST, terms/{term_id} DELETE), this is one extra round-trip per HTTP request beyond the actual operation. No cache, no batching across requests." — evidence: DatasetFieldResourceExtractor.java:21-27 + ReactiveDatasetFieldRepositoryImpl.java:115-125
  - "Description-edit fans out to: (1) `updateDescription` repo write → (2) `markEntityFilled/Unfilled` → (3) `updateDatasetFieldSearchVectors` for the parent DataEntity → (4) `handleDatasetFieldDescriptionTerms` (term re-extraction over the new description text) → (5) term-related repository writes + activity-event emission. One PUT request triggers 4-5 sequential DB operations." — evidence: DatasetFieldServiceImpl.java:87-95 + DatasetFieldInternalInformationServiceImpl.java:32-44 + TermServiceImpl.java:243-251
  - "Tags-edit fans out to: (1) delete-internal-relations → (2) get-tag-relations → (3) create-relations → (4) updateDatasetFieldSearchVectors → (5) markDataEntityByTags → (6) listDatasetFieldDtos. Six sequential DB operations per PUT." — evidence: DatasetFieldServiceImpl.java:117-132
- **throughput_characteristics**:
  - "Per-field user edits — single-item; no batch surface at the controller. The four mutation endpoints accept ONE field id and ONE body each."
  - "Reactive Mono/Flux signatures throughout — non-blocking I/O, but each call still issues sequential DB round-trips via the chained `.flatMap()` / `.then()` calls in the service layer."
  - "Bulk-update across many fields requires the client to issue N HTTP requests (one per field); there is NO bulk-edit endpoint on `/api/datasetfields/*`."
- **resource_allocation**: N/A — the controller allocates no significant memory or I/O resources itself; all allocation happens at the service / repository layers.
- **scaling_characteristics**:
  - "Stateless controller — instances scale horizontally."
  - "Each mutation endpoint runs inside `@ReactiveTransactional` boundaries declared at the service layer (`DatasetFieldServiceImpl.updateDescription :86`, `:98`, `:118`; `DatasetFieldInternalInformationServiceImpl.updateDescription :27`; `EnumValueServiceImpl.createEnumValues :40`). Transactions cover single-field operations; the description-edit transaction additionally covers the term re-extraction work, expanding transaction span proportional to the number of term references in the description body."
  - "Description-edit emits TWO activity events per single user operation when the new description contains term markers — for a user bulk-editing many fields the activity-feed write volume is approximately 2× the operation count."
  - "Enum-value bulk-replace has NO concurrency control — two concurrent POSTs against the same datasetFieldId silent-last-write-wins. UI-driven traffic typically does not collide (one user edit per form submit) but bulk-import scripts or multi-operator concurrent editing will lose writes silently."
- **known_performance_gaps**:
  - "Authorization-extractor DB round-trip per request — `getDataEntityIdByDatasetFieldId` runs on every authorized request to `/api/datasetfields/{id}/...`. For a data-curator session bulk-editing 100 columns, this is 100 extra round-trips beyond the 100 operation round-trips." — evidence: DatasetFieldResourceExtractor.java:21-27 — severity: LOW

  - "Description-edit chains 4-5 sequential DB operations — no parallel execution within the chain. Tags-edit chains 6 sequential DB operations. For high-frequency curator sessions this serialises latency." — evidence: DatasetFieldServiceImpl.java:87-132 — severity: LOW

  - "No bulk-edit endpoint — operators wanting to edit metadata across many fields must issue N HTTP requests. For datasets with hundreds of columns, this is N round-trips of auth-extractor + N round-trips of operation = 2N round-trips total." — evidence: DatasetFieldController.java + openapi.yaml:2451-2611 (no /bulk endpoint) — severity: LOW

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH (the gap is the dominant finding — ZERO direct controller tests, observed via Grep)
- docs_link_semantic: HIGH (three doc pages WebFetched at status 200 with verbatim excerpts)
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH (every claim is file:line-cited with reasoning anchor)
- security: HIGH (the two HIGH-severity wiring bugs are file:line-cited and cross-checked against the live permissions doc)
- performance: HIGH
- upstream_callers: MEDIUM (UI component bindings recorded but UI sidecars not yet enriched — 5 references unresolved)
- downstream_side_effects: HIGH (all side effects traced to file:line; cardinalities verified)
- stress_findings: HIGH (58 of 64 stress questions resolved as STATIC-INFERRED with strong evidence; 3 probes emitted for the operator-visible verification step; only 1 question is REFERENCE-pending — Category C question on UI tag re-sort)

## Maintainer notes

(none — first enrichment of this node, refresh on 2026-05-25 ZG sprint with Stress Protocol)

## coherence_corrections

This sidecar SUPERSEDES three factually-wrong claims from prior batches (LSN-018 Rule 6 — pre-emit coherence check):

1. **F-004 batch-R (lines 78-91 of `feature-flows/detail/F-004.yaml`) + ReactiveDatasetFieldRepositoryImpl sidecar `bugs_limitations_corner_cases[1]`, `doc_drift_findings[2]`, `dependencies_semantic.coupling[5]`**: prior claim "`DatasetFieldServiceImpl.updateDescription` has NO @ActivityLog → description edits are NOT recorded in the activity feed → DATASET_FIELD_DESCRIPTION_UPDATED is NEVER emitted." Correction: description-edit DOES emit `DATASET_FIELD_DESCRIPTION_UPDATED`. The `@ActivityLog` annotation lives one layer deeper at `DatasetFieldInternalInformationServiceImpl.java:28`, NOT at `DatasetFieldServiceImpl.updateDescription`. The handler at `DatasetFieldInformationUpdatedActivityHandler.java:27-29` handles the event; the live docs at `https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed#event-types` (verified 2026-05-20, status 200) list it. The "asymmetric with internal-name" framing is wrong; the symmetry is structural-only (depth of annotation in the service stack) and operator-invisible. Drift facet `dataset_field_description_edit_no_activity_log_asymmetric_with_internal_name` in F-004 batch-R should be RECLASSIFIED as `dataset_field_description_edit_activity_log_at_inner_service_layer_structural_only_no_operator_impact`.

2. **F-004 batch-R (lines 92-107 of `feature-flows/detail/F-004.yaml`) + ReactiveDatasetFieldRepositoryImpl sidecar `bugs_limitations_corner_cases[3]`**: prior claim "`DatasetFieldServiceImpl.updateDescription` does NOT switchIfEmpty → If the chain completes empty, the API returns 200 OK with empty body for a non-existent field id." Correction: the `.switchIfEmpty(Mono.error(NotFoundException))` lives at the INNER service `DatasetFieldInternalInformationServiceImpl.java:33`, BEFORE the activity-log emission and the downstream filled-flag updates. The outer service does not need its own switchIfEmpty because the inner service throws first. PUT /api/datasetfields/{id}/description on a missing id returns 404, NOT 200. Drift facet `dataset_field_update_description_silent_no_op_on_missing_id` in F-004 batch-R should be REMOVED.

3. **Cross-coupling with F-006 audit-silence batch-R framing**: the audit-silence canonicalisation candidate (system-mission.md note on "Audit-log Presence Asymmetry") should NOT include `DatasetField.updateDescription` as a member of the asymmetric class. The dataset-field surface has SYMMETRIC activity-log coverage across description, internal-name, tags, term-link, term-unlink — F-006's audit-silence pattern is at the RBAC mutation surface (role/policy/owner-association), not at the dataset-field metadata surface.

The NEW HIGH/MEDIUM findings this sidecar adds (the prior 2026-05-20 version had four; this 2026-05-25 ZG refresh adds three more, raising the total to seven):

- `SecurityConstants.java:297-299` permission-wiring bug — `/terms POST` gated by `DATA_ENTITY_ADD_TERM` instead of `DATASET_FIELD_ADD_TERM` (live docs confirm DATASET_FIELD_ADD_TERM is the documented gate). HIGH. — pinned by P-153.
- `SecurityConstants.java:295-296` copy-paste bug — `/api/alerts/{id}/status PUT` gated by `DATASET_FIELD_ADD_TERM`. HIGH. — pinned by P-153.
- Spec/code response-code drift — OpenAPI declares 201, controller returns 200, across 3 PUT endpoints. MEDIUM.
- Dual activity-event semantics on description-edit (DESCRIPTION_UPDATED + TERM_ASSIGNMENT_UPDATED) — undocumented. LOW.
- **NEW (ZG)** `createEnumValue` BULK-REPLACE-not-CREATE semantics (Stress Cat B). Partial body silently soft-deletes omitted items. HIGH. — pinned by P-154.
- **NEW (ZG)** `createEnumValue` replay-safe-for-state-not-for-audit (Stress Cat B + E). Row identities churn, activity events double. MEDIUM. — pinned by P-154.
- **NEW (ZG)** `createEnumValue` no concurrency control — silent last-write-wins (Stress Cat E). HIGH. — pinned by P-154.
- **NEW (ZG)** `deleteTermFromDatasetField` removes only manual term-links — description-link rows survive (Stress Cat E + Cat F termId-input-naming drift). HIGH. — pinned by P-155.
- **NEW (ZG)** `addDatasetFieldTerm` 200-OK-empty-body on duplicate (Stress Cat B). LOW.

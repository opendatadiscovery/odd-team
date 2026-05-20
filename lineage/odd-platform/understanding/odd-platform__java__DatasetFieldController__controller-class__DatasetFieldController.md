---
node_id: "odd-platform java DatasetFieldController controller-class:DatasetFieldController"
node_kind: controller-class
axis: controllers
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.3.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-V-DatasetFieldController
---

# DatasetFieldController — semantic understanding

## understanding

`DatasetFieldController` is the **per-column metadata HTTP surface** — 103 lines, 7 endpoints across 4 collaborating services (`DatasetFieldService`, `EnumValueService`, `MetricService`, `TermService`), implementing the OpenAPI-generated `DatasetFieldApi` interface (`openapi.yaml:2451-2611`). All seven endpoints share the path prefix `/api/datasetfields/{dataset_field_id}/...` and are gated by `SecurityConstants.java:282-303` — six `DATASET_FIELD`-scope `SecurityRule` entries resolving via `DatasetFieldResourceExtractor` (lines 21-27 of that class) → `reactiveDatasetFieldRepository.getDataEntityIdByDatasetFieldId(id)` to the parent DataEntity, on which the actual permission check runs (parent-scoped authorization — there is no field-level permission). The controller is **pure thin-proxy plumbing**: every method is a one-line `formDataMono.flatMap(formData → service.X).map(ResponseEntity::ok)` shape — no validation, no error handling, no annotations beyond `@RestController`. The four edit endpoints (`updateDatasetFieldDescription` lines 35-43, `updateDatasetFieldInternalName` lines 45-53, `updateDatasetFieldTags` lines 55-63, `createEnumValue` lines 65-72) plus the two term endpoints (`addDatasetFieldTerm` lines 88-95, `deleteTermFromDatasetField` lines 97-103) form **F-004's per-column entity-description editing surface** and **F-006's per-column permission audit surface** simultaneously. The OpenAPI spec declares HTTP 201 for the three PUT endpoints (`openapi.yaml:2465, 2488, 2511`) but the controller returns 200 OK via `ResponseEntity::ok` (lines 42, 52, 62) — a spec/code drift that operators using generated client SDKs may not notice.

## concepts

- entities: [
    "`DatasetFieldDescriptionUpdateFormData` (the PUT /description body — single `description` field, free-form String; openapi.yaml:2463)",
    "`InternalNameFormData` (the PUT /name body — single `internalName` field, free-form String; openapi.yaml:2486)",
    "`DatasetFieldTagsUpdateFormData` (the PUT /tags body — `tags: [String]` array; openapi.yaml:2509)",
    "`BulkEnumValueFormData` (the POST /enum_values body — `items: [EnumValueFormData]` array; openapi.yaml:2547)",
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
    "`create-enum-values` — POST /api/datasetfields/{id}/enum_values → `EnumValueService.createEnumValues` (the only endpoint returning HTTP 201 — line 71 `HttpStatus.CREATED`).",
    "`get-enum-values` — GET /api/datasetfields/{id}/enum_values → `EnumValueService.getEnumValues` (read endpoint — NOT in SecurityConstants rule list, gated only by the global auth manager).",
    "`get-metrics` — GET /api/datasetfields/{id}/metrics → `MetricService.getLatestMetricsForDatasetField` (read endpoint — NOT in SecurityConstants rule list).",
    "`add-term` — POST /api/datasetfields/{id}/terms → `TermService.linkTermWithDatasetField` (HAS `@ActivityLog(DATASET_FIELD_TERM_ASSIGNMENT_UPDATED)` `TermServiceImpl.java:211`).",
    "`delete-term` — DELETE /api/datasetfields/{id}/terms/{term_id} → `TermService.removeTermFromDatasetField` (HAS `@ActivityLog(DATASET_FIELD_TERM_ASSIGNMENT_UPDATED)` `TermServiceImpl.java:225`)."
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
    "**Description body is stored verbatim** — `ReactiveDatasetFieldRepositoryImpl.updateDescription` (lines 73-80) issues `DSL.update(DATASET_FIELD).set(INTERNAL_DESCRIPTION, newDescription).where(ID.eq(?)).returning()` with only empty-to-null normalisation (line 75). NO Jsoup.clean, NO Encode.html, NO length cap, NO allowlist. This is the F-004 verbatim-storage XSS-class fingerprint at the column-level surface; the entity-level sibling is `ReactiveDataEntityRepositoryImpl.setInternalDescription`. UI defence-in-depth (probe P-009) at `Markdown.tsx` is the operative safeguard; it covers the entity-description render path but cross-tab coverage of the DatasetField description render path is unverified per F-004 batch-R notes."
  ]
- audiences: [
    "operators-via-API — UI calls and direct REST clients hitting `/api/datasetfields/{id}/...`. The UI bindings at `odd-platform-ui/src/lib/api.ts` (verified Grep file-match) wire React components to these endpoints.",
    "`DatasetFieldApi` (OpenAPI-generated interface — the contract surface this controller implements; the spec at `odd-platform-specification/openapi.yaml:2451-2611` defines the public surface)",
    "downstream callers in the activity-feed chain — `DatasetFieldInformationUpdatedActivityHandler` (`DatasetFieldInformationUpdatedActivityHandler.java:27-29`) handles the three activity events emitted by these endpoints; the handler reads the new state via `ReactiveDatasetFieldRepository.getDatasetFieldWithTags` after each mutation."
  ]

## dependencies_semantic

- requires-feature: [
    "`DatasetFieldService` (4 calls: `updateDescription`, `updateInternalName`, `updateDatasetFieldTags`)",
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
    "**OpenAPI `DatasetFieldApi` interface** — every controller method signature is dictated by the OpenAPI generator. The controller is purely a thin proxy implementing this interface; signature drift between spec and impl is a compile error. The HTTP response-code mismatch (spec 201 vs impl 200) is NOT a compile error because both 200 and 201 satisfy `ResponseEntity<T>` — the drift is at runtime only."
  ]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours: [
    "{behaviour: 'PUT /api/datasetfields/{id}/description with auth.type=DISABLED + missing dataset_field_id returns 404 NotFoundException', test_class: 'integration'} — the 404 contract from the inner service is unverified at the HTTP boundary",
    "{behaviour: 'PUT /api/datasetfields/{id}/description with Markdown / HTML / <script> payload returns 200 OK and persists the string verbatim — defence-in-depth lives only at UI render', test_class: 'security'} — F-004 verbatim-storage fingerprint unverified at column-level surface",
    "{behaviour: 'PUT /api/datasetfields/{id}/description emits exactly ONE DATASET_FIELD_DESCRIPTION_UPDATED activity event (and one additional DATASET_FIELD_TERM_ASSIGNMENT_UPDATED if the new description contains term references)', test_class: 'integration'} — the dual-event semantics unverified",
    "{behaviour: 'PUT /api/datasetfields/{id}/description with empty-string body normalises to NULL internal_description and emits the activity event', test_class: 'integration'} — the empty-string contract unverified",
    "{behaviour: 'PUT /api/datasetfields/{id}/name on a soft-deleted parent DataEntity is denied via DatasetFieldResourceExtractor → parent permission check', test_class: 'integration'} — the parent-scope auth resolution unverified for soft-deleted parents",
    "{behaviour: 'POST /api/datasetfields/{id}/terms with a user holding DATA_ENTITY_ADD_TERM but NOT DATASET_FIELD_ADD_TERM SUCCEEDS — surfacing the SecurityConstants.java:299 permission-wiring bug', test_class: 'security'} — the bug-detection test does not exist",
    "{behaviour: 'PUT /api/alerts/{alert_id}/status with a user holding DATASET_FIELD_ADD_TERM but NOT any ALERT permission SUCCEEDS — surfacing the SecurityConstants.java:295-296 copy-paste bug', test_class: 'security'} — the bug-detection test does not exist",
    "{behaviour: 'PUT /api/datasetfields/{id}/description returns HTTP 200 (NOT the spec-declared 201)', test_class: 'integration'} — the spec/code response-code drift unverified",
    "{behaviour: 'GET /api/datasetfields/{id}/enum_values + /metrics are NOT in the SecurityRule list and are reachable by any authenticated user', test_class: 'security'} — the read-collaborative posture unverified at the field-level",
    "{behaviour: 'updateDatasetFieldTags returns the new tag list as Flux<Tag> with no Tag.deletedAt filter (relies on tagService relations being live)', test_class: 'integration'} — the soft-delete-filter contract unverified at the controller boundary"
  ]
- test_files: [
    "(NO direct controller test) — Grep `DatasetFieldController` in `odd-platform-api/src/test/java/**` returns zero matches. Adjacent test surfaces: `EnumValueServiceTest`, `EnumValueRepositoryImplTest`, `LookupDataServiceTest`, `DatasetFieldApiMapperTest`, `DatasetVersionMapperTest`, `LookupDataServiceTest` — none drive HTTP requests against this controller's path patterns.",
    "(Repository-tier) — `ReactiveDatasetFieldRepositoryImplTest.java:1-99` — 2 tests on `getDatasetFieldWithTags` + `updateDescription` (the latter being the verbatim-storage write path; does NOT exercise the controller).",
    "(Spec) — `DatasetFieldApiMapperTest.java` exercises the `DatasetFieldApiMapper` shape; does NOT drive controller requests."
  ]
- gaps: |
    The controller has ZERO direct HTTP-boundary tests. Every behaviour observable at the HTTP boundary — the 404 on missing id, the spec/code response-code drift, the verbatim-storage XSS persistence through the description endpoint, the dual-activity-event emission, the parent-scope auth resolution, the wiring bugs at `SecurityConstants.java:295-296` and `:299` — is unverified. Five regression classes that would fail silently:

    1. **The two SecurityConstants wiring bugs** (lines 295-296 + 299) — a permission renaming or a regenerated SecurityConstants file would not surface these because no integration test asserts the permission-to-endpoint binding for `/api/datasetfields/{id}/terms` or `/api/alerts/{id}/status`. The bugs are STATIC TODAY (the wrong permission still gates access at runtime); any future change would compound the drift.

    2. **The spec/code response-code drift** (200 vs 201) — generated client SDKs that branch on 201 would never enter the success branch; a test asserting the controller returns the spec-declared status would catch a regression but also surface the existing drift as a finding.

    3. **The dual-activity-event semantics on description-edit** — one description PUT can produce TWO activity-feed events (DESCRIPTION_UPDATED + TERM_ASSIGNMENT_UPDATED) when the new description contains term references. No test asserts the count or order.

    4. **The 404 contract on missing dataset_field_id** — the inner service throws NotFoundException; the outer service does NOT need its own switchIfEmpty. A future refactor that bypasses the inner service (inlining it or skipping the switchIfEmpty) would silently change the contract to 200-OK-with-empty-body. F-004 batch-R already documented this regression class for the entity-description sibling — the same regression class applies here.

    5. **The verbatim-storage XSS-class fingerprint at the column-level surface** — F-004 batch-R inferred this from the repository sidecar; no probe / no test exists at the HTTP boundary verifying that `<script>` / `<img onerror>` / `javascript:` payloads persist verbatim through PUT /api/datasetfields/{id}/description and render at the DatasetField description tab. Probe P-009 covers data-entity description render; cross-tab coverage of the column-level render path is unverified.

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
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    fetched_excerpts: |
      Verbatim from the live page (2026-05-20, status 200):
      "DATASET_FIELD_ADD_TERM: Allows linking a business glossary term to a specific field within a dataset.
       DATASET_FIELD_DELETE_TERM: Allows removing a linked business glossary term from a specific field within a dataset.
       DATASET_FIELD_DESCRIPTION_UPDATE: Allows editing the description of an individual dataset field.
       DATASET_FIELD_ENUMS_UPDATE: Allows editing a dataset field's enum values.
       DATASET_FIELD_INTERNAL_NAME_UPDATE: Allows editing the business name of an individual dataset field.
       DATASET_FIELD_TAGS_UPDATE: Allows adding or removing tags from an individual dataset field."
    confidence: HIGH
  - url: "https://docs.opendatadiscovery.org/features/data-discovery"
    anchor: "#annotating-discovered-entities"
    rationale: "Per-column metadata editing (description, internal name, tags, terms, enum values) is part of the Data Discovery pillar's 'Annotating discovered entities' surface. The live page mentions 'Business names' as labels for both data entities AND dataset fields — confirming dataset-field-level annotation is in-scope of Data Discovery."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    fetched_excerpts: |
      Verbatim from the live page (2026-05-20, status 200):
      "Business names: alternative human-readable labels for data entities and dataset fields, surfaced alongside the technical name everywhere the entity is rendered."
    confidence: MEDIUM
- doc_drift_findings:
  - "OpenAPI spec declares HTTP 201 for the three PUT endpoints (`openapi.yaml:2465 description-update`, `:2488 internal-name-update`, `:2511 tags-update`) but the controller returns HTTP 200 via `ResponseEntity::ok` (DatasetFieldController.java:42, 52, 62). Spec/code drift. Generated client SDKs branching on 201-vs-200 would silently mishandle the response."
  - "Live docs at `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions` document `DATASET_FIELD_ADD_TERM` as the gate for `POST /api/datasetfields/{id}/terms` (verbatim: 'Allows linking a business glossary term to a specific field within a dataset.'). The actual code at `SecurityConstants.java:299` wires this endpoint to `DATA_ENTITY_ADD_TERM`. Docs and code disagree."
  - "Live docs DO list `DATASET_FIELD_DESCRIPTION_UPDATED`, `DATASET_FIELD_INTERNAL_NAME_UPDATED`, `DATASET_FIELD_TAGS_UPDATED`, `DATASET_FIELD_TERM_ASSIGNMENT_UPDATED` as activity-feed event types at `https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed#event-types`. Earlier batches (F-004 batch-R extension notes lines 78-91) claimed `DATASET_FIELD_DESCRIPTION_UPDATED` is 'NEVER emitted' — that prior claim contradicts both the live docs AND the code at `DatasetFieldInternalInformationServiceImpl.java:28`. The doc surface is correct; the prior sidecar inference was wrong."
  - "Live docs do not describe the column-level XSS-class verbatim-storage surface. Operators reading the description-editing surface (Data Discovery / Annotating discovered entities) have no way to discover that Markdown / HTML payloads persist verbatim to `dataset_field.internal_description` with defence-in-depth only at the UI render layer. Same doc-gap class as F-004 entity-side."
  - "Live docs do not describe the parent-scope authorization model. Operators reading the dataset-field permission docs may infer that DATASET_FIELD-scope permissions check against the field itself; in reality every check resolves to the parent DataEntity via `DatasetFieldResourceExtractor`. A user with permission on the parent DataEntity has permission on every field of that entity. The doc surface does not explain this collapse."

## implicit_adrs

- "**Thin-proxy controllers — every method body is a one-line `formDataMono.flatMap(...).map(ResponseEntity::ok)` shape with NO controller-layer validation or error handling.**" — evidence: DatasetFieldController.java:35-103 — intent_anchor: "Lines 36-43 (`updateDatasetFieldDescription` body): `return formDataMono.flatMap(formData -> datasetFieldService.updateDescription(datasetFieldId, formData)).map(ResponseEntity::ok);` — and the same shape repeats for every endpoint. The controller is a deliberate passthrough; the OpenAPI-generated `DatasetFieldApi` interface dictates the signatures and the services own the business logic. Convention applied uniformly across all 7 endpoints." — confidence: HIGH

- "**Authorization is parent-scoped — every DATASET_FIELD permission resolves to the parent DataEntity's permission via `DatasetFieldResourceExtractor`; there is NO field-level permission check.**" — evidence: DatasetFieldResourceExtractor.java:21-27 + SecurityConstants.java:282-303 — intent_anchor: "`DatasetFieldResourceExtractor.java:26`: `.flatMap(datasetFieldRepository::getDataEntityIdByDatasetFieldId)` — the resolver's final step returns the parent `data_entity.id`, not the `dataset_field.id`. The downstream `ReactiveAuthorizationManager` then evaluates the permission against the parent DataEntity. Identical pattern to `ReactiveDatasetFieldRepositoryImpl` invariant 7. No alternative gating mechanism." — confidence: HIGH

- "**Activity-log emission lives at the service layer or one layer deeper at the inner-service layer — NEVER at the controller layer.**" — evidence: DatasetFieldServiceImpl.java:99 (internal-name) + :119 (tags) + DatasetFieldInternalInformationServiceImpl.java:28 (description) + TermServiceImpl.java:211, :225 (term-link/unlink) — intent_anchor: "The `@ActivityLog` annotation is consistently applied at the FIRST `@Service`-tier method that touches the writable state, never at the controller. The four mutation paths (description, internal-name, tags, term-link/unlink) all carry the annotation at the right structural depth. The structural depth varies (description at inner-service, internal-name/tags at outer-service) because of the additional term-extraction work description does — but every mutation emits exactly one activity event for the primary mutation type." — confidence: HIGH

- "**Two read endpoints (`getEnumValues`, `getDatasetFieldMetrics`) intentionally OMITTED from `SecurityRule` — any authenticated user can read them on any field-id, matching the platform's read-collaborative posture.**" — evidence: DatasetFieldController.java:74-86 + SecurityConstants.java:282-303 — intent_anchor: "Lines 74-86 expose `getEnumValues` (GET /enum_values) and `getDatasetFieldMetrics` (GET /metrics). `SecurityConstants.java:282-303` declares SecurityRule entries for `name PUT`, `description PUT`, `tags PUT`, `enum_values POST`, `terms POST`, `terms/{term_id} DELETE` — but NOT for `enum_values GET` or `metrics GET`. The omission is intentional and uniform across the platform — read endpoints fall back to the global authentication-only gate. Same read-collaborative pattern as `ReactiveDatasetFieldRepositoryImpl.listByTerm` (cross-owner read, no per-owner scoping)." — confidence: HIGH

- "**Description-edit emits TWO activity events when the new description text contains term references (one DATASET_FIELD_DESCRIPTION_UPDATED + one DATASET_FIELD_TERM_ASSIGNMENT_UPDATED).**" — evidence: DatasetFieldServiceImpl.java:87-95 + TermServiceImpl.java:243 + DatasetFieldInternalInformationServiceImpl.java:28 — intent_anchor: "`DatasetFieldServiceImpl.updateDescription` (lines 87-95): the chain is `datasetFieldInternalInformationService.updateDescription(...)` (emits DATASET_FIELD_DESCRIPTION_UPDATED at line 28 of that class) `.then(termService.handleDatasetFieldDescriptionTerms(datasetFieldId, formData.getDescription()))` (emits DATASET_FIELD_TERM_ASSIGNMENT_UPDATED at TermServiceImpl.java:243). Both events are emitted on EVERY description-edit when the new description contains term-marker syntax — single user-visible operation, two activity-feed entries." — confidence: HIGH

## bugs_limitations_corner_cases

- "**`SecurityConstants.java:299` wires `POST /api/datasetfields/{dataset_field_id}/terms` to `DATA_ENTITY_ADD_TERM` instead of `DATASET_FIELD_ADD_TERM`.** The live docs document `DATASET_FIELD_ADD_TERM` as the gate for this endpoint (verbatim: 'Allows linking a business glossary term to a specific field within a dataset.'). The code-doc divergence means: (a) a user granted `DATA_ENTITY_ADD_TERM` (intended for entity-level term-linking) effectively also gets dataset-field term-linking; (b) a user granted `DATASET_FIELD_ADD_TERM` cannot link terms to dataset fields. The permission catalog and the operative gate disagree. SAME endpoint as F-004 surface adjacency — operators following the docs will configure permissions that do not match runtime behaviour." — evidence: SecurityConstants.java:297-299 + PolicyPermissionDto.java:34 + docs at https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions — severity: HIGH

- "**`SecurityConstants.java:295-296` wires `PUT /api/alerts/{alert_id}/status` to `DATASET_FIELD_ADD_TERM`** — a clear copy-paste bug from the dataset-field block immediately preceding it. An alert-status update endpoint is gated by a dataset-field-scope term permission with no involvement of any dataset_field at the request path. Any user holding `DATASET_FIELD_ADD_TERM` can resolve alerts; any user holding an actual ALERT permission but NOT `DATASET_FIELD_ADD_TERM` CANNOT. Surfaced via this sidecar because the wrong permission is a DATASET_FIELD one — the bug's source is the copy-paste from this controller's auth block." — evidence: SecurityConstants.java:295-296 — severity: HIGH

- "**Spec/code response-code drift: OpenAPI declares HTTP 201 for the three PUT endpoints, controller returns 200 OK.**" — evidence: openapi.yaml:2465, :2488, :2511 (`'201': description: OK`) vs DatasetFieldController.java:42, :52, :62 (`ResponseEntity::ok` → HTTP 200) — severity: MEDIUM

- "**Description-edit can trigger TWO activity-feed entries for one user operation** — the dual-event semantics (DATASET_FIELD_DESCRIPTION_UPDATED + DATASET_FIELD_TERM_ASSIGNMENT_UPDATED) are not documented at the activity-feed page. Operators reading the description-edit row in the feed see a separate term-assignment-update row immediately after with the same actor/timestamp and may infer two distinct user actions." — evidence: DatasetFieldServiceImpl.java:89-90 + TermServiceImpl.java:243 — severity: LOW

- "**Description body persists verbatim — F-004 XSS-class fingerprint at the per-column surface.** PUT /api/datasetfields/{id}/description with `<script>` / `<img onerror>` / `javascript:` payloads stores them in `dataset_field.internal_description` and surfaces them through the field-description tab on the data-entity detail page. Defence-in-depth lives only at the UI render layer (probe P-009 — Markdown.tsx pipeline strips dangerous tags at DOM-render); cross-tab coverage of the DatasetField description render path is unverified per F-004 batch-R notes." — evidence: DatasetFieldController.java:36-43 + ReactiveDatasetFieldRepositoryImpl.java:73-80 (no Jsoup, no Encode, no length cap, no allowlist) — severity: MEDIUM

- "**`createEnumValue` returns HTTP 201 from the controller but the spec says the same** — no drift here. Note this asymmetry: ONLY the POST endpoint correctly returns 201; the three PUT endpoints DO drift. The asymmetry implies the controller author followed the spec for one endpoint but not the other three." — evidence: DatasetFieldController.java:71 (`HttpStatus.CREATED`) + openapi.yaml:2549 (`'201': description: The resource has been successfully modified`) — severity: LOW (observational; informs Spec/code drift severity assessment)

- "**`GET /api/datasetfields/{id}/enum_values` and `GET /api/datasetfields/{id}/metrics` have no `SecurityRule` entry** — they are reachable by any authenticated user on any field id, regardless of parent-DataEntity permissions. Intentional per the read-collaborative posture documented at P-09 maintainer notes; not documented at the dataset-field endpoint surface." — evidence: DatasetFieldController.java:74-86 + SecurityConstants.java:282-303 (no rule for GET /enum_values, GET /metrics) — severity: LOW

- "**Per-request DB round-trip via `DatasetFieldResourceExtractor.extractResourceId`** — every authorized request to `/api/datasetfields/{id}/...` issues a 3-table join (`dataset_field → dataset_structure → dataset_version → data_entity`) BEFORE the controller method executes. No cache. For high-edit-frequency users (data-curators bulk-editing column metadata via the UI), this is one extra DB round-trip per HTTP request beyond the actual operation." — evidence: DatasetFieldResourceExtractor.java:21-27 + ReactiveDatasetFieldRepositoryImpl.java:115-125 — severity: LOW

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
  - "`SecurityConstants.java:299` wires `POST /api/datasetfields/{id}/terms` to `DATA_ENTITY_ADD_TERM` instead of `DATASET_FIELD_ADD_TERM`. Live docs at `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions` document `DATASET_FIELD_ADD_TERM` as the correct gate. The drift gives DATA_ENTITY_ADD_TERM holders unintended field-level term-link capability and denies it to DATASET_FIELD_ADD_TERM holders." — evidence: SecurityConstants.java:297-299 + PolicyPermissionDto.java:25, :34 + docs URL — severity: HIGH

  - "`SecurityConstants.java:295-296` wires `PUT /api/alerts/{alert_id}/status` to `DATASET_FIELD_ADD_TERM` — copy-paste bug from this controller's auth block. The ALERT-side endpoint is gated by a DATASET_FIELD permission unrelated to its function. Any user holding `DATASET_FIELD_ADD_TERM` can resolve alerts; users holding an actual ALERT permission but lacking `DATASET_FIELD_ADD_TERM` cannot." — evidence: SecurityConstants.java:295-296 — severity: HIGH

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
  - "Each mutation endpoint runs inside `@ReactiveTransactional` boundaries declared at the service layer (`DatasetFieldServiceImpl.updateDescription :86`, `:98`, `:118`; `DatasetFieldInternalInformationServiceImpl.updateDescription :27`). Long transactions are unlikely (single-field operations) but the description-edit transaction also covers the term re-extraction work, increasing transaction span when descriptions contain many term references."
  - "Description-edit emits TWO activity events per single user operation when the new description contains term markers — for a user bulk-editing many fields the activity-feed write volume is approximately 2× the operation count."
- **known_performance_gaps**:
  - "Authorization-extractor DB round-trip per request — `getDataEntityIdByDatasetFieldId` runs on every authorized request to `/api/datasetfields/{id}/...`. For a data-curator session bulk-editing 100 columns, this is 100 extra round-trips beyond the 100 operation round-trips." — evidence: DatasetFieldResourceExtractor.java:21-27 — severity: LOW

  - "Description-edit chains 4-5 sequential DB operations — no parallel execution within the chain. Tags-edit chains 6 sequential DB operations. For high-frequency curator sessions this serialises latency." — evidence: DatasetFieldServiceImpl.java:87-132 — severity: LOW

  - "No bulk-edit endpoint — operators wanting to edit metadata across many fields must issue N HTTP requests. For datasets with hundreds of columns, this is N round-trips of auth-extractor + N round-trips of operation = 2N round-trips total." — evidence: DatasetFieldController.java + openapi.yaml:2451-2611 (no /bulk endpoint) — severity: LOW

## sources

- understanding ← DatasetFieldController.java:1-103 + openapi.yaml:2451-2611 + SecurityConstants.java:282-303 + DatasetFieldResourceExtractor.java:21-27
- concepts.entities.DatasetFieldDescriptionUpdateFormData ← DatasetFieldController.java:7, 38 + openapi.yaml:2463
- concepts.entities.InternalNameFormData ← DatasetFieldController.java:12, 48 + openapi.yaml:2486
- concepts.entities.DatasetFieldTagsUpdateFormData ← DatasetFieldController.java:8, 58 + openapi.yaml:2509
- concepts.operations.update-internal-description ← DatasetFieldController.java:36-43 + DatasetFieldServiceImpl.java:87-95 + DatasetFieldInternalInformationServiceImpl.java:26-44
- concepts.operations.update-internal-name ← DatasetFieldController.java:46-53 + DatasetFieldServiceImpl.java:98-115
- concepts.operations.update-tags ← DatasetFieldController.java:56-63 + DatasetFieldServiceImpl.java:117-132
- concepts.invariants[0] thin-proxy ← DatasetFieldController.java:35-103
- concepts.invariants[1] parent-scoped-auth ← DatasetFieldResourceExtractor.java:21-27 + SecurityConstants.java:282-303
- concepts.invariants[3] spec-code-response-code-drift ← openapi.yaml:2465, :2488, :2511 + DatasetFieldController.java:42, :52, :62
- concepts.invariants[5] wrong-permission-wiring /terms POST ← SecurityConstants.java:297-299 + PolicyPermissionDto.java:34 + WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions (status 200, 2026-05-20)
- concepts.invariants[6] alerts-status copy-paste-bug ← SecurityConstants.java:295-296
- concepts.invariants[7] activity-log-structural-asymmetry-but-no-operator-impact ← DatasetFieldServiceImpl.java:99, :119 + DatasetFieldInternalInformationServiceImpl.java:28 + WebFetch https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed (status 200, 2026-05-20)
- concepts.invariants[8] description-edit-404-on-missing-id ← DatasetFieldInternalInformationServiceImpl.java:33 (`.switchIfEmpty(Mono.error(new NotFoundException(...)))`)
- dependencies_semantic.coupling[0] auth-extractor-coupling ← DatasetFieldResourceExtractor.java:21-27 + ReactiveDatasetFieldRepositoryImpl.java:115-125
- dependencies_semantic.coupling[3] dual-activity-event-on-description-edit ← DatasetFieldServiceImpl.java:89-90 + TermServiceImpl.java:243
- tests_coverage_semantic.test_files ← (NO direct controller tests; grep `DatasetFieldController` in `odd-platform-api/src/test/java` returns 0 matches)
- docs_link_semantic.inferred_docs[0] activity-feed ← WebFetch https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed (status 200, 2026-05-20) — fetched_excerpt verbatim
- docs_link_semantic.inferred_docs[1] permissions ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions (status 200, 2026-05-20) — fetched_excerpt verbatim
- docs_link_semantic.inferred_docs[2] data-discovery ← WebFetch https://docs.opendatadiscovery.org/features/data-discovery (status 200, 2026-05-20)
- docs_link_semantic.doc_drift_findings[2] coherence-correction-on-prior-batch-R-and-F-004-claim ← grep `DATASET_FIELD_DESCRIPTION_UPDATED` across odd-platform-api/src/main/java returns 5 hits (DTO definition, mapper case, inner-service @ActivityLog, activity-handler isHandle, this sidecar's evidence) + WebFetch activity-feed doc confirms the event is documented + DatasetFieldInternalInformationServiceImpl.java:28 carries the annotation
- implicit_adrs[0] thin-proxy ← DatasetFieldController.java:35-103
- implicit_adrs[1] parent-scoped-auth ← DatasetFieldResourceExtractor.java:21-27 + SecurityConstants.java:282-303
- implicit_adrs[2] activity-log-at-service-layer ← DatasetFieldServiceImpl.java:99, :119 + DatasetFieldInternalInformationServiceImpl.java:28 + TermServiceImpl.java:211, :225
- implicit_adrs[3] read-endpoints-omitted-from-security-rules ← DatasetFieldController.java:74-86 + SecurityConstants.java:282-303
- implicit_adrs[4] dual-activity-event-on-description-edit ← DatasetFieldServiceImpl.java:87-95 + TermServiceImpl.java:243 + DatasetFieldInternalInformationServiceImpl.java:28
- bugs_limitations_corner_cases[0] wrong-permission-/terms POST ← SecurityConstants.java:297-299 + PolicyPermissionDto.java:34 + docs URL
- bugs_limitations_corner_cases[1] alerts-status-copy-paste ← SecurityConstants.java:295-296
- bugs_limitations_corner_cases[2] spec-code-response-code-drift ← openapi.yaml:2465, :2488, :2511 + DatasetFieldController.java:42, :52, :62
- bugs_limitations_corner_cases[4] verbatim-storage-XSS-class ← DatasetFieldController.java:36-43 + ReactiveDatasetFieldRepositoryImpl.java:73-80
- security.authorization_assertions ← SecurityConstants.java:282-303 (line-by-line)
- security.known_security_gaps[0] permission-wiring-bug ← SecurityConstants.java:297-299 + docs URL
- security.known_security_gaps[1] copy-paste-bug-alerts ← SecurityConstants.java:295-296
- performance.hot_paths[0] auth-extractor-DB-roundtrip ← DatasetFieldResourceExtractor.java:21-27 + ReactiveDatasetFieldRepositoryImpl.java:115-125
- performance.hot_paths[1] description-edit-fan-out ← DatasetFieldServiceImpl.java:87-95 + DatasetFieldInternalInformationServiceImpl.java:32-44 + TermServiceImpl.java:243-251
- performance.hot_paths[2] tags-edit-fan-out ← DatasetFieldServiceImpl.java:117-132

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

## Maintainer notes

(none — first enrichment of this node)

## coherence_corrections

This sidecar SUPERSEDES three factually-wrong claims from prior batches (LSN-018 Rule 6 — pre-emit coherence check):

1. **F-004 batch-R (lines 78-91 of `feature-flows/detail/F-004.yaml`) + ReactiveDatasetFieldRepositoryImpl sidecar `bugs_limitations_corner_cases[1]`, `doc_drift_findings[2]`, `dependencies_semantic.coupling[5]`**: prior claim "`DatasetFieldServiceImpl.updateDescription` has NO @ActivityLog → description edits are NOT recorded in the activity feed → DATASET_FIELD_DESCRIPTION_UPDATED is NEVER emitted." Correction: description-edit DOES emit `DATASET_FIELD_DESCRIPTION_UPDATED`. The `@ActivityLog` annotation lives one layer deeper at `DatasetFieldInternalInformationServiceImpl.java:28`, NOT at `DatasetFieldServiceImpl.updateDescription`. The handler at `DatasetFieldInformationUpdatedActivityHandler.java:27-29` handles the event; the live docs at `https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed#event-types` (verified 2026-05-20, status 200) list it. The "asymmetric with internal-name" framing is wrong; the symmetry is structural-only (depth of annotation in the service stack) and operator-invisible. Drift facet `dataset_field_description_edit_no_activity_log_asymmetric_with_internal_name` in F-004 batch-R should be RECLASSIFIED as `dataset_field_description_edit_activity_log_at_inner_service_layer_structural_only_no_operator_impact`.

2. **F-004 batch-R (lines 92-107 of `feature-flows/detail/F-004.yaml`) + ReactiveDatasetFieldRepositoryImpl sidecar `bugs_limitations_corner_cases[3]`**: prior claim "`DatasetFieldServiceImpl.updateDescription` does NOT switchIfEmpty → If the chain completes empty, the API returns 200 OK with empty body for a non-existent field id." Correction: the `.switchIfEmpty(Mono.error(NotFoundException))` lives at the INNER service `DatasetFieldInternalInformationServiceImpl.java:33`, BEFORE the activity-log emission and the downstream filled-flag updates. The outer service does not need its own switchIfEmpty because the inner service throws first. PUT /api/datasetfields/{id}/description on a missing id returns 404, NOT 200. Drift facet `dataset_field_update_description_silent_no_op_on_missing_id` in F-004 batch-R should be REMOVED.

3. **Cross-coupling with F-006 audit-silence batch-R framing**: the audit-silence canonicalisation candidate (system-mission.md note on "Audit-log Presence Asymmetry") should NOT include `DatasetField.updateDescription` as a member of the asymmetric class. The dataset-field surface has SYMMETRIC activity-log coverage across description, internal-name, tags, term-link, term-unlink — F-006's audit-silence pattern is at the RBAC mutation surface (role/policy/owner-association), not at the dataset-field metadata surface.

The four NEW HIGH/MEDIUM findings this sidecar adds (NOT already in batch-R or F-004):

- `SecurityConstants.java:297-299` permission-wiring bug — `/terms POST` gated by `DATA_ENTITY_ADD_TERM` instead of `DATASET_FIELD_ADD_TERM` (live docs confirm DATASET_FIELD_ADD_TERM is the documented gate). HIGH.
- `SecurityConstants.java:295-296` copy-paste bug — `/api/alerts/{id}/status PUT` gated by `DATASET_FIELD_ADD_TERM`. HIGH.
- Spec/code response-code drift — OpenAPI declares 201, controller returns 200, across 3 PUT endpoints. MEDIUM.
- Dual activity-event semantics on description-edit (DESCRIPTION_UPDATED + TERM_ASSIGNMENT_UPDATED) — undocumented. LOW.

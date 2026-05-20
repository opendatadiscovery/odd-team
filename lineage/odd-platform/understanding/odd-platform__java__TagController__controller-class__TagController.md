---
node_id: "odd-platform java TagController controller-class:TagController"
node_kind: controller-class
axis: controllers
extracted_at_commit: ede5d277be6251b0826026035707c1fb6dbb24b6
enriched_at_commit: ede5d277be6251b0826026035707c1fb6dbb24b6
extractor_version: 0.1.0
prompt_version: file-analyser/0.3.0
schema_version: v0.3.0
enrichment_status: complete
confidence_overall: HIGH
session_id: session-2026-05-20-W-TagController
pillar_anchored_features:
  - P-01:F-018 Manual Object Tagging
  - P-08 Management & Administration (Tags tab)
  - P-09 Security & Access Control
---

# TagController — semantic understanding

## understanding

`TagController` is the **HTTP controller-class for the Manual Object Tagging directory-side surface** (pillar P-01:F-018 per `system-mission.md:94`; pillar P-08 Tags tab per `system-mission.md:240`) — 53 lines, 4 endpoints implementing the OpenAPI-generated `TagApi` interface as pure 2-3-line reactive delegations to a single injected `TagService`. The four endpoints split into one read (`getPopularTagList` line 37 — popularity-ranked browse for the tag-search-facet and Management → Tags vocabulary surfaces) and three writes (`createTag` line 23 — bulk insert from `Flux<TagFormData>`; `updateTag` line 47 — single-tag rename / Important-flag toggle; `deleteTag` line 31 — soft-delete with cascade). The class's authorisation surface is **gated entirely at the controller perimeter via `SecurityConstants.SECURITY_RULES`** (`SecurityConstants.java:138-142`): POST `/api/tags`→`TAG_CREATE`, PUT `/api/tags/{tag_id}`→`TAG_UPDATE`, DELETE `/api/tags/{tag_id}`→`TAG_DELETE`, all `NO_CONTEXT` (Management-scope permissions, not resource-scoped). The read endpoint `getPopularTagList` has **NO SecurityRule** — it falls through to `AuthorizationCustomizer.customize`'s catch-all `pathMatchers("/**").authenticated()` (`AuthorizationCustomizer.java:29-30`), so any authenticated user under LOGIN_FORM / OAUTH2 / LDAP can enumerate the entire global tag directory regardless of which `TAG_*` permissions they hold. **The createTag path is NOT the side-door that REFACTOR-223 / DOC-GAP-168 surfaces**: this controller's `createTag` requires `TAG_CREATE`; the side-door bypasses this controller entirely via `TermServiceImpl.upsertTags` (`TermServiceImpl.java:257`) gated by `TERM_TAGS_UPDATE` and `DataEntityServiceImpl.upsertTags` (the per-entity `PUT /api/dataentities/{id}/tags` path) gated by `DATA_ENTITY_TAGS_UPDATE` — both call `tagService.getOrCreateTagsByName` which mints fresh `tag` rows in the same directory `getPopularTagList` reads from, without holding `TAG_CREATE`. The service layer also calls `getOrCreateTagsByName` from `ExternalTagIngestionRequestProcessor.java:104` (Collector push path, gated only by the `auth.ingestion.filter.enabled` S2S filter) and from `DatasetFieldServiceImpl.java:202, 266` (dataset-field tag-update path, gated by `DATASET_FIELD_TAGS_UPDATE`). **All 4 endpoints inherit `TagServiceImpl`'s zero-permission-checks posture** (`TagServiceImpl.java:31-167` — no `@PreAuthorize`, no programmatic permission calls); the controller perimeter is the SOLE authorisation defence for the directory-side writes. **No tests cover this controller** (`grep TagController <odd-platform-repo>/odd-platform-api/src/test` returns zero matches), and **status-code drift** exists between the controller and the OpenAPI spec on both `createTag` (controller returns 200 via `ResponseEntity::ok` line 27, spec declares 201 at `openapi.yaml:372`) and `updateTag` (controller returns 200 line 51, spec declares 201 at `openapi.yaml:400`).

## concepts

- entities: [
    "`TagApi` — OpenAPI-generated controller interface; the contract this `@RestController` implements (line 18). The 4 method signatures are auto-derived from `openapi.yaml:342-423` (`/api/tags` and `/api/tags/{tag_id}` paths).",
    "`TagFormData` — input payload for create + update (`TagController.java:23, 48`); single-tag shape validated against `components.yaml/#/components/schemas/TagFormData`; carries `name` (string) + `important` (boolean) per the upstream spec.",
    "`Flux<TagFormData>` — bulk-input shape for `createTag` (line 23); the OpenAPI-side request body is declared as `BulkTagFormData` (`openapi.yaml:370`), but the generated `TagApi` interface emits `Flux<TagFormData>` to the controller after the framework unwraps the bulk wrapper. The controller calls `.collectList()` (line 25) to materialise the full batch before delegating to `tagService.bulkCreate(List<TagFormData>)`.",
    "`Tag` — single-tag response shape returned by `updateTag` (line 47) and the per-element shape inside the `Flux<Tag>` returned by `createTag`; carries `id` (long), `name` (string), `important` (boolean), `external` (boolean), `usedCount` (long) per `components.yaml/#/components/schemas/Tag`.",
    "`TagsResponse` — paginated tag-list response shape returned by `getPopularTagList` (line 37); wraps `pageInfo` (total, hasNext) + `items: List<Tag>`. The shape is `TagsResponse` (with the trailing s) NOT `TagList` — the bulk-create response uses `TagList` per OpenAPI (`openapi.yaml:377`), but the popular-list endpoint returns the distinct `TagsResponse` shape with pagination metadata.",
    "`TagService` — the single injected service bean (line 20); 11-method interface (`TagService.java:14-36`) of which this controller invokes exactly 4 (`bulkCreate`, `update`, `delete`, `listMostPopular`); the other 7 are called by `DataEntityServiceImpl`, `TermServiceImpl`, `DatasetFieldServiceImpl`, `ExternalTagIngestionRequestProcessor` — the side-door surfaces that bypass this controller for tag-directory writes.",
    "`ServerWebExchange` — the Spring WebFlux reactive request context; injected on every method (lines 24, 31, 41, 49) but used by NONE of them. The controller does not read request headers, query params via the exchange, or set response state directly via the exchange — pure delegation.",
    "`tagId: Long` — path-parameter for `updateTag` and `deleteTag` (lines 31, 47). The OpenAPI declares `int64` (`openapi.yaml:391, 417`); the controller signature uses `Long` (autoboxed). Note that the path-parameter naming in OpenAPI is `tag_id` (`openapi.yaml:387, 413`) — the snake_case-to-camelCase conversion is handled by the OpenAPI generator.",
    "`page, size, query, ids` — query-parameters for `getPopularTagList` (lines 37-41). `query` is name-substring filter (case-insensitive per `ReactiveAbstractCRUDRepository.java:242-243` `nameField.containsIgnoreCase(nameQuery)`); `ids` is an optional id-set filter (`List<Long>`) passed straight through to `ReactiveTagRepositoryImpl.listMostPopular` (`:138-167`); `page` defaults to 1 + `size` defaults to OpenAPI's `SizeParam` shape (`openapi.yaml:349`)."
  ]
- operations: [
    "`createTag(Flux<TagFormData> tagFormData, ServerWebExchange exchange)` (lines 22-28) — bulk-write; calls `.collectList()` to materialise the input flux into a `List<TagFormData>`, then `.map(tagService::bulkCreate).map(ResponseEntity::ok)`. The double `.map` is the idiomatic pattern: first map materialises the list into the `Flux<Tag>` return shape, second wraps in `ResponseEntity.ok(...)`. Returns 200 (controller line 27) BUT OpenAPI declares 201 (`openapi.yaml:372`) — status-code drift class. Gated by `TAG_CREATE` (`SecurityConstants.java:138`, `NO_CONTEXT` Management scope). The downstream `tagService.bulkCreate` calls `reactiveTagRepository.bulkCreate(pojos)` (`TagServiceImpl.java:38-42`) which is the inherited `ReactiveAbstractCRUDRepository.bulkCreate` — a fail-on-duplicate INSERT that translates unique-constraint violations to `UniqueConstraintException(\"Tag with this name already exists\")` (`ExceptionUtils.java:54-56`). NO `@ReactiveTransactional` on this path (the service's `bulkCreate` has no annotation, only the repository inherits an implicit TX per the parent class).",
    "`deleteTag(Long tagId, ServerWebExchange exchange)` (lines 30-34) — soft-delete-with-cascade write; delegates to `tagService.delete(tagId)` and on completion returns 204 No Content (matches OpenAPI). The downstream `tagService.delete` (`TagServiceImpl.java:57-70`, `@ReactiveTransactional`) performs THREE distinct operations under one TX: (1) fetch the tag DTO and validate `!external` (rejects with `BadUserRequestException(\"Can't delete tag which has external relations\")` if any usage is external — `TagServiceImpl.java:62-63`); (2) HARD-delete cascade rows in `tag_to_term` (via `reactiveTagRepository.deleteTermRelations(tagId)` — `ReactiveTagRepositoryImpl.java:280-286`) AND `tag_to_data_entity` (via `reactiveTagRepository.deleteDataEntityRelations(tagId)` — `:235-241`) concurrently via `Flux.zip` (`TagServiceImpl.java:64-65`); (3) SOFT-delete the `tag` row via the inherited `ReactiveAbstractSoftDeleteCRUDRepository.delete` (UPDATE setting `deleted_at = now()`); and (4) update the term-side search vectors via `reactiveTermSearchEntrypointRepository.updateChangedTagVectors(tagId)` (`:68-69`). **The cascade does NOT cover `tag_to_dataset_field`** — `deleteDatasetFieldRelations` exists in the repository (`:299-306`) but is NOT invoked from `TagServiceImpl.delete`; deleting a tag attached to dataset fields would leave orphaned `tag_to_dataset_field` rows referencing a soft-deleted tag id. Gated by `TAG_DELETE` (`SecurityConstants.java:141-142`, `NO_CONTEXT`). The `!external` guard is the only programmatic policy at the service-tier for this path.",
    "`getPopularTagList(Integer page, Integer size, String query, List<Long> ids, ServerWebExchange exchange)` (lines 36-44) — read; delegates to `tagService.listMostPopular(query, ids, page, size)` (note the argument order swap: controller signature is `(page, size, query, ids)`, service signature is `(query, ids, page, size)` — explicit at line 42). The downstream `listMostPopular` uses an `asTable('tag_cte')` + UNION-ALL CTE over `tag_to_data_entity` + `tag_to_dataset_field` usage counts; orders by descending count; paginates via `paginate(...)`. Public-to-authenticated — **NO SecurityRule** in `SecurityConstants.java` (verified — `grep '\"/api/tags\"' SecurityConstants.java` returns only POST `/api/tags` line 138; PUT and DELETE on `/api/tags/{tag_id}` lines 139-142; no GET entry). The catch-all `pathMatchers(\"/**\").authenticated()` (`AuthorizationCustomizer.java:29-30`) is the only gate. Returns the full global tag directory (filtered by `query` / `ids` only) to every authenticated caller.",
    "`updateTag(Long tagId, Mono<TagFormData> tagFormData, ServerWebExchange exchange)` (lines 46-52) — single-tag write; uses `.flatMap(fd -> tagService.update(tagId, fd))` to unwrap the `Mono<TagFormData>` and delegate to `tagService.update(tagId, formData)` (`TagServiceImpl.java:44-55`, `@ReactiveTransactional`). The service implementation: (1) reads the tag DTO via `reactiveTagRepository.getDto(tagId)`, switching to `NotFoundException(\"Tag\", tagId)` if absent → 404 to caller; (2) validates `!external`, rejecting with `BadUserRequestException(\"Can't update tag which has external relations\")` if any usage is external; (3) applies the new form-data to the pojo via `tagMapper::applyToPojo`; (4) writes via `reactiveTagRepository.update`; (5) updates THREE search-vector indexes via `Mono.zip` (`TagServiceImpl.java:162-167`) — `reactiveSearchEntrypointRepository.updateChangedTagVectors` + `reactiveSearchEntrypointRepository.updateChangedTagStructureVector` + `reactiveTermSearchEntrypointRepository.updateChangedTagVectors`. Returns 200 (controller line 51) BUT OpenAPI declares 201 (`openapi.yaml:400`) — same status-code drift class. Gated by `TAG_UPDATE` (`SecurityConstants.java:139-140`, `NO_CONTEXT`)."
  ]
- invariants: [
    "All 4 method bodies are 2-line or 3-line reactive delegations — no business logic, no transformations, no programmatic auth checks; the controller is a pure stub-implementation of `TagApi`.",
    "Single injected service (`TagService` line 20) constructor-injected via Lombok `@RequiredArgsConstructor` (line 17) — no field-injection, no Setter-injection.",
    "**`getPopularTagList` is NOT RBAC-gated** — only the three write endpoints have SecurityRule entries (`SecurityConstants.java:138-142`). The read endpoint inherits the catch-all `authenticated()` rule. Any authenticated user can enumerate the entire global tag directory regardless of `TAG_*` permissions.",
    "**The three write endpoints are gated by `NO_CONTEXT` Management-scope permissions** — `TAG_CREATE` / `TAG_UPDATE` / `TAG_DELETE` are all `MANAGEMENT` scope per `PolicyPermissionDto.java:62-64`; they are NOT resource-scoped (no per-tag ownership concept). A user with the Management-bundle role can mutate any tag regardless of who created it or how it's used.",
    "**Authorisation is controller-tier-only** — the service-tier (`TagServiceImpl`) has ZERO `@PreAuthorize` or programmatic permission checks (verified by reading lines 1-167 end-to-end). The controller perimeter is the SOLE defence; bypass paths (the side-door via `tagService.getOrCreateTagsByName` from `TermServiceImpl`, `DataEntityServiceImpl`, `DatasetFieldServiceImpl`, `ExternalTagIngestionRequestProcessor`) cannot be caught at service tier.",
    "**Side-door write paths bypass this controller entirely** — `getOrCreateTagsByName` (`TagServiceImpl.java:79-86`) is invoked from FIVE distinct call sites NOT under TagController: (a) `TagServiceImpl.updateRelationsWithDataEntity` (`:98-121`, invoked by `PUT /api/dataentities/{id}/tags` gated by `DATA_ENTITY_TAGS_UPDATE`); (b) `TermServiceImpl.upsertTags` (`:257`, invoked by `PUT /api/terms/{term_id}/tags` gated by `TERM_TAGS_UPDATE`); (c) `DatasetFieldServiceImpl` (`:202, 266`, invoked by `PUT /api/datasetfields/{id}/tags` gated by `DATASET_FIELD_TAGS_UPDATE`); (d) `ExternalTagIngestionRequestProcessor.process` (`:104`, invoked by `POST /ingestion/entities` Collector push gated only by `auth.ingestion.filter.enabled` S2S filter); (e) the `tagService.getOrInjectTagByName` variant (`:88-94`) called from the same Collector path. The Tag DIRECTORY (the `tag` table) grows via these side-doors without `TAG_CREATE` ever being checked. This controller's `createTag` is the ONLY path that requires `TAG_CREATE`; every other write path uses a different permission.",
    "**Status-code drift between controller and OpenAPI on `createTag` + `updateTag`** — both return 200 in the controller (`.map(ResponseEntity::ok)` lines 27, 51) but the OpenAPI declares 201 for create (`openapi.yaml:372`: `'201': The resource has been successfully created`) and 201 for update (`openapi.yaml:400`: `'201': The resource has been successfully updated`). Note: the OpenAPI's use of 201 for `updateTag` is itself unusual (201 is canonically a 'created' status; 200 or 204 fits update semantics) and is consistent with the same drift class observed in `TermController.createTerm` + `TermController.updateTerm` (batch-U). The controller behaviour is the actual ground truth; the spec drift is the publishing concern.",
    "**`deleteTag` cascade is asymmetric across the three relation tables** — `TagServiceImpl.delete` HARD-deletes `tag_to_term` and `tag_to_data_entity` rows (lines 64-65) but does NOT touch `tag_to_dataset_field`. A tag attached to dataset fields via `DATASET_FIELD_TAGS_UPDATE` (the upsert path through `DatasetFieldServiceImpl.upsertTags`) would, on delete via `TAG_DELETE`, leave orphaned `tag_to_dataset_field` rows referencing the soft-deleted tag id. Subsequent reads via `ReactiveTagRepositoryImpl.listDatasetFieldDtos` filter with `addSoftDeleteFilter` on the join (`:84-98`) so the orphaned rows are invisible to UI reads — but they persist in the DB and are not garbage-collected.",
    "**The `!external` guard pattern** — `TagServiceImpl.update` and `TagServiceImpl.delete` both reject tags with `external = true` usages (lines 49-50 + 62-63) via `BadUserRequestException`. The `external` flag is computed by `mapTag` (`ReactiveTagRepositoryImpl.java:394-400`) as `boolOr(TAG_TO_DATA_ENTITY.EXTERNAL)` — true if ANY of the tag's data-entity assignments was created by a Collector (set via `external = true` on the `tag_to_data_entity` row). The semantic: tags that have ANY external relation cannot be edited or deleted via the UI — they are owned by the Collector. The asymmetry: the controller's `createTag` path produces tags with `external = false` always, and the side-door paths produce tags with `external = false` on the data-entity side too (`TagServiceImpl.updateRelationsWithDataEntity` line 109 hardcodes `.setExternal(false)`). The `external = true` rows come ONLY from `ExternalTagIngestionRequestProcessor`."
  ]
- audiences: [
    "odd-platform-ui-end-user — Management → Tags tab (per `system-mission.md:240`) is the UI surface for the three write endpoints; the React component is `odd-platform-ui/src/components/Management/TagsList/TagsList.tsx` (grep confirmed in file list).",
    "odd-platform-ui-end-user — the popular-tags surface (search-facet ranking, Catalog Overview top-tags chip strip) consumes `getPopularTagList`; per `system-mission.md:96` ('Manual Object Tagging') the tag dropdown on data-entity detail pages also surfaces this list.",
    "odd-api-consumer — programmatic clients via the OpenAPI spec at `/api/v3/api-docs`; `tag` is the OpenAPI tag (`openapi.yaml:360, 378, 406, 422`); the 4 endpoints are documented in the Swagger UI.",
    "platform-operator — RBAC author granting `TAG_CREATE` / `TAG_UPDATE` / `TAG_DELETE` to a Role bundle (Management tab → Policies / Roles); the Tags-tab UI requires these permissions to render the create / edit / delete affordances.",
    "data-engineer-analyst / data-steward-owner — every authenticated user who applies tags to entities or columns; the side-door write paths (not this controller) are how their workflows mint directory rows.",
    "Collector runtime (S2S audience) — pushes via `POST /ingestion/entities` containing `dataset.tags[]` field → `ExternalTagIngestionRequestProcessor` → `getOrInjectTagByName` mints directory rows the UI then renders alongside operator-curated ones."
  ]

## dependencies_semantic

- requires-feature: [
    "`TagApi` OpenAPI-generated controller interface (`odd-platform-api-contract` generated code; the 4 method signatures + path/method/parameter bindings)",
    "`TagService` interface (`TagService.java:14-36`) — the 11-method service contract; this controller invokes 4 of them. The remaining 7 methods (`getOrCreateTagsByName`, `getOrInjectTagByName`, `updateRelationsWithDataEntity`, `deleteRelationsWithTerm`, `createRelationsWithTerm`) are the side-door surfaces that bypass this controller.",
    "`SecurityConstants.SECURITY_RULES` (`SecurityConstants.java:138-142`) — the three SecurityRule entries for POST `/api/tags`, PUT `/api/tags/{tag_id}`, DELETE `/api/tags/{tag_id}` that gate the three write endpoints. The absence of a GET entry is the load-bearing observation for the read-collaborative posture.",
    "`AuthorizationCustomizer.customize` (`AuthorizationCustomizer.java:20-30`) — the security-filter wiring that maps `SECURITY_RULES` to Spring's `AuthorizeExchangeSpec` and applies the catch-all `pathMatchers(\"/**\").authenticated()` rule on line 29-30. The catch-all is what permits `getPopularTagList` to authenticate but not authorise."
  ]
- requires-config: []
- requires-runtime: [
    "Spring WebFlux reactive HTTP server — `@RestController` annotation (line 16); reactive `Mono` / `Flux` return shapes throughout; the `ServerWebExchange` injection signals reactive request handling.",
    "Lombok `@RequiredArgsConstructor` (line 17) — generates the constructor taking `TagService` as `final` field (line 20).",
    "`reactor.core.publisher.Mono` / `Flux` — every method returns `Mono<ResponseEntity<...>>`; `createTag` returns `Mono<ResponseEntity<Flux<Tag>>>` (a reactive list wrapped in a reactive response).",
    "Spring Security ReactiveSecurityWebFilterChain — composed via `OAuthSecurityConfiguration` / `LoginFormSecurityConfiguration` / `LdapSecurityConfiguration` / `SecurityConfiguration` (whichever active per `auth.type`); each instantiates `AuthorizationCustomizer` and registers the SECURITY_RULES."
  ]
- couples-to: [
    "`TagApi` (`implements` at line 18) — every method is `@Override` of the generated interface; the controller cannot change a signature without first changing the OpenAPI spec.",
    "`TagService` (constructor-injected line 20; only collaborator) — the controller's behaviour surface IS the service's method shapes. Changing the service signature ripples to this controller.",
    "`SecurityConstants.SECURITY_RULES` (NOT directly imported; coupled by URL convention) — the SecurityRule entries match by path-pattern, not by reference. A path-rename in this controller's OpenAPI spec without updating SecurityConstants would orphan the gate (the same drift class as REFACTOR-217 on the term-tags path).",
    "`ResponseEntity.ok(...)` / `ResponseEntity.noContent().build()` — the HTTP status discipline; the 200 vs 201 drift comes from these choices not matching the OpenAPI's response declarations."
  ]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours: [
    "{
      \"behaviour\": \"`createTag` happy path — POST `/api/tags` with a valid bulk payload, assert `Flux<Tag>` response shape, assert each tag has an id assigned, assert the underlying `tag` table grew by N rows.\",
      \"test_class\": \"TagControllerTest (would be the only WebFluxTest-style integration covering this controller path-end-to-end)\",
      \"severity\": \"HIGH\"
    }",
    "{
      \"behaviour\": \"`createTag` duplicate-name path — POST `/api/tags` with a name that already exists in the directory, assert `UniqueConstraintException` translates to a 4xx response (the underlying `bulkCreate` is a fail-on-duplicate INSERT; this is the operator-explicit error path).\",
      \"test_class\": \"TagControllerTest (`testCreateTag_DuplicateName_Returns4xx`)\",
      \"severity\": \"HIGH\"
    }",
    "{
      \"behaviour\": \"`createTag` status-code drift — assert the controller returns 200 with the body (the de facto behaviour) NOT 201 (the OpenAPI's declaration). The test would document the drift and pin the controller's behaviour against accidental future correction in either direction without coordinated spec update.\",
      \"test_class\": \"TagControllerTest (`testCreateTag_StatusCode200_AgainstSpec201Drift`)\",
      \"severity\": \"MEDIUM\"
    }",
    "{
      \"behaviour\": \"`deleteTag` cascade asymmetry — DELETE `/api/tags/{tag_id}` for a tag attached to BOTH a data entity (via `DATA_ENTITY_TAGS_UPDATE`) AND a dataset field (via `DATASET_FIELD_TAGS_UPDATE`), assert that `tag_to_data_entity` and `tag_to_term` rows are removed but `tag_to_dataset_field` rows persist orphaned referencing the soft-deleted tag id. This is the missing-cascade finding documented in invariants.\",
      \"test_class\": \"TagControllerTest (`testDeleteTag_CascadesToDataEntity_Term_NotDatasetField`)\",
      \"severity\": \"MEDIUM\"
    }",
    "{
      \"behaviour\": \"`deleteTag` external-relations rejection — DELETE `/api/tags/{tag_id}` for a tag with `external = true` (one of its `tag_to_data_entity` rows has `external = true`), assert 4xx response with `Can't delete tag which has external relations` message (the `BadUserRequestException` from `TagServiceImpl.java:63`).\",
      \"test_class\": \"TagControllerTest (`testDeleteTag_ExternalTag_Returns4xx`)\",
      \"severity\": \"MEDIUM\"
    }",
    "{
      \"behaviour\": \"`updateTag` external-relations rejection — same shape on the update path; PUT `/api/tags/{tag_id}` with new form-data for an external-relations tag, assert `BadUserRequestException` from `TagServiceImpl.java:50`.\",
      \"test_class\": \"TagControllerTest (`testUpdateTag_ExternalTag_Returns4xx`)\",
      \"severity\": \"MEDIUM\"
    }",
    "{
      \"behaviour\": \"`updateTag` not-found path — PUT `/api/tags/{tag_id}` for a non-existent / soft-deleted tag id, assert `NotFoundException` → 404.\",
      \"test_class\": \"TagControllerTest (`testUpdateTag_TagNotFound_Returns404`)\",
      \"severity\": \"MEDIUM\"
    }",
    "{
      \"behaviour\": \"`getPopularTagList` authorisation absence — assert that an authenticated user with NO `TAG_*` permissions and NO `MANAGEMENT`-scope role can still hit GET `/api/tags?query=...` and receive a full result set. This is the explicit no-RBAC-on-read posture; a test would document it as intentional rather than a regression.\",
      \"test_class\": \"TagControllerSecurityTest (`testGetPopularTagList_NoTagPermissions_StillReturns200`)\",
      \"severity\": \"MEDIUM\"
    }",
    "{
      \"behaviour\": \"`createTag` authorisation enforcement — assert that an authenticated user WITHOUT `TAG_CREATE` receives 403 on POST `/api/tags`, validating the SecurityRule at `SecurityConstants.java:138` is wired correctly.\",
      \"test_class\": \"TagControllerSecurityTest (`testCreateTag_WithoutTagCreate_Returns403`)\",
      \"severity\": \"HIGH\"
    }",
    "{
      \"behaviour\": \"Side-door write path observability — assert that POST `/api/dataentities/{id}/tags` with novel tag names creates fresh `tag` rows visible from this controller's GET `/api/tags`, even when the caller does NOT hold `TAG_CREATE`. This is the integration test that pins REFACTOR-223 / DOC-GAP-168.\",
      \"test_class\": \"TagControllerSideDoorTest (`testDataEntityTagsUpdate_CreatesGlobalTagDirectoryRow_WithoutTagCreate`)\",
      \"severity\": \"HIGH\"
    }",
    "{
      \"behaviour\": \"`getPopularTagList` pagination + filtering — exercise `page`, `size`, `query`, `ids` parameters across boundaries; the `listMostPopular` integration test exists at the repository level (`TagRepositoryImplTest.testListMostPopular`) but does not cover the controller's parameter binding + the OpenAPI default-values path.\",
      \"test_class\": \"TagControllerTest (`testGetPopularTagList_QueryFiltering`, `testGetPopularTagList_IdsFiltering`, `testGetPopularTagList_Pagination`)\",
      \"severity\": \"LOW\"
    }"
  ]
- test_files: []
- gaps: |
    Where would a regression most likely land that the current tests would miss?
    
    1. **No tests exist for this controller at all** — no `TagControllerTest.java` under `odd-platform-api/src/test`. The only test coverage of the tag surface is at the repository layer (`TagRepositoryImplTest.java`, 10 tests). The controller-perimeter authorisation wiring (does `TAG_CREATE` actually gate POST `/api/tags`?), the OpenAPI request-binding (does the `BulkTagFormData` wrapper unwrap correctly into `Flux<TagFormData>`?), and the response-shape (does `Flux<Tag>` serialise to a JSON array correctly?) are all unverified.
    
    2. **The status-code drift on `createTag` + `updateTag`** is unobserved by tests; a future change to align the controller with the OpenAPI (returning 201 via `ResponseEntity.status(HttpStatus.CREATED)`) would silently change the contract for every consumer expecting the de facto 200. This drift is the same class as TermController's `createTerm` / `updateTerm` (batch-U finding).
    
    3. **The `deleteTag` cascade asymmetry** (no `tag_to_dataset_field` cleanup) is unobserved — a dataset-field-tagged tag, when deleted, leaves orphaned join rows. No repository test exercises this either (`TagRepositoryImplTest` covers `tag_to_data_entity` relations only, not `tag_to_dataset_field` or `tag_to_term` cascades from the controller-side delete).
    
    4. **The read-RBAC absence** (`getPopularTagList` requires only `authenticated()`) is intentional per the read-collaborative posture but not asserted as a test — a future change adding a SecurityRule (e.g., requiring `TAG_CREATE` to view the directory, mirroring some other tabs) would silently lock out users who currently rely on the open-read posture for the search-facet rendering.
    
    5. **The `!external` guards on update / delete** are unobserved — a regression that removed the guards (perhaps in service of a refactor unifying create / update paths) would let UI users overwrite Collector-pushed external tags, with no test to catch it.
    
    6. **The side-door write paths bypass this controller** but the side-door's *effect* (a tag created via DATA_ENTITY_TAGS_UPDATE appears in this controller's GET response) is the audit-relevant observation; no test asserts the integration shape across the two surfaces. REFACTOR-223 / DOC-GAP-168 lives at that integration boundary.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/tagging"
    anchor: ""
    rationale: "Live doc page describing the operator-facing Tag UX — both the Management → Tags vocabulary surface (the three write endpoints this controller exposes) and the per-entity tag assignment surface (the side-door that bypasses this controller). The page documents `TAG_CREATE` / `TAG_UPDATE` / `TAG_DELETE` permissions verbatim; it does NOT mention `DATA_ENTITY_TAGS_UPDATE` as a second write path into the directory."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    fetched_excerpts: |
      Live-page text (WebFetch 2026-05-20, status 200): "Management → Tags (operator-mutating side): Create the canonical tag vocabulary, set Important flags, and govern tagging across teams. Per-entity assignment: 'open the entity (or column) detail surface, click the tag-management control, and pick from the existing tag vocabulary or create a new tag inline.' Three RBAC permissions: TAG_CREATE: 'Create a new tag in the catalog vocabulary.' TAG_UPDATE: 'Edit a tag's name or its Important flag.' TAG_DELETE: 'Remove a tag from the catalog vocabulary.' All three govern vocabulary-level mutations, not assignment operations." Live page makes NO mention of whether deleting a tag cascades to remove it from tagged entities; makes NO mention of DATA_ENTITY_TAGS_UPDATE's relationship with the global tag directory; references 'Top tags' on the Catalog Overview but provides no API endpoint details or visibility scope.
    confidence: HIGH
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions"
    anchor: ""
    rationale: "Permissions catalog — names both TAG_CREATE (MANAGEMENT scope) and DATA_ENTITY_TAGS_UPDATE (DATA_ENTITY scope) but does NOT name the side-channel where DATA_ENTITY_TAGS_UPDATE can grow the directory."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    fetched_excerpts: |
      Live-page text (WebFetch 2026-05-20, status 200): "Management Permissions: TAG_CREATE: 'Allows creating a new tag.' TAG_UPDATE: 'Allows editing an existing tag.' TAG_DELETE: 'Allows deleting a tag.' Data Entity Permissions: DATA_ENTITY_TAGS_UPDATE: 'Allows editing a data entity's tags.' The documentation does not describe any mechanism by which the DATA_ENTITY_TAGS_UPDATE permission can create new global tags. Only TAG_CREATE is listed as enabling tag creation in the Management permissions section. The documentation does not mention owner_scoping or any mechanism related to restricting tag-list visibility based on owner associations."
    confidence: HIGH
- doc_drift_findings:
  - "Live tagging page (WebFetched 2026-05-20, 200) acknowledges the per-entity 'create a new tag inline' UX, but the permission framing names ONLY `TAG_CREATE` / `TAG_UPDATE` / `TAG_DELETE` and explicitly describes them as 'vocabulary-level mutations'. The doc page does NOT state that an operator with `DATA_ENTITY_TAGS_UPDATE` alone (no `TAG_CREATE`) can mint new tag-vocabulary rows visible to every other user via this controller's `getPopularTagList`. This is the directory side-door (DOC-GAP-168 / REFACTOR-223) — the controller's three write endpoints are gated, but the same Tag DIRECTORY is mutable via paths NOT under this controller, gated by permissions whose docs frame them as 'editing a data entity's tags' rather than 'creating a global tag'."
  - "Live tagging page does NOT address whether `deleteTag` (DELETE `/api/tags/{tag_id}`) cascades to remove the tag from already-tagged entities. The controller's downstream `TagServiceImpl.delete` DOES cascade for `tag_to_data_entity` and `tag_to_term` (`TagServiceImpl.java:64-65`) but does NOT cascade for `tag_to_dataset_field`. Operators reading the live page have no way to know that deleting a tag attached to dataset-field tagging leaves orphaned join rows referencing a soft-deleted tag id (invisible to reads via `addSoftDeleteFilter`, but persistent in the DB). This is a missing-caveat finding."
  - "Live permissions page does NOT mention that GET `/api/tags` (the popular-tags surface) has NO RBAC gate beyond authentication — any authenticated user under LOGIN_FORM/OAUTH2/LDAP can enumerate the entire global tag directory, even users with NO `TAG_*` permissions and NO Management-scope role. The page describes Management Permissions as gating tag-vocabulary mutations but is silent on tag-vocabulary visibility. Combined with the side-door write paths, this means a user with only `DATA_ENTITY_TAGS_UPDATE` can both READ and WRITE the global tag directory without holding any `TAG_*` permission — a posture not documented anywhere on the live site."
  - "Live OpenAPI on `docs.opendatadiscovery.org/developer-guides/api-reference` (per `system-mission.md:312`) and the local `openapi.yaml:372, 400` declare `'201'` response status for `createTag` and `updateTag`. The controller (`TagController.java:27, 51`) returns 200 via `ResponseEntity::ok`. Any consumer driving against the OpenAPI spec expecting 201 (e.g., `responseStatus == HttpStatus.CREATED` checks) will fail on this controller's actual responses. Same drift class as `TermController.createTerm` / `updateTerm` (batch-U)."

## implicit_adrs

- "**Thin OpenAPI-delegate controller pattern** — every method body is a 2-3-line reactive delegation `service-call.map(ResponseEntity::ok)` with no transformations, no programmatic auth checks, no business logic. The controller is a pure stub-implementation of `TagApi`; mutation logic lives in `TagServiceImpl`. This is the conventional shape across the platform's controllers (sample: AlertController, OwnerController, AlertManagerController, TermController) — the convention IS the architectural decision." — evidence: TagController.java:18 (`implements TagApi`) + TagController.java:22-52 (every method is a 2-3-line delegation pattern) + the consistency across the controller package — intent_anchor: "Consistent pattern repeated across the 4 methods AND across the controller package (TermController, AlertController, OwnerController etc.); the OpenAPI-generated interface convention IS the architectural statement that business logic stays in services" — confidence: HIGH

- "**Read endpoints are NOT RBAC-gated** — `getPopularTagList` has no SecurityRule entry, falling through to `pathMatchers(\"/**\").authenticated()` (`AuthorizationCustomizer.java:29-30`). The same shape holds across other read endpoints on this controller's siblings (TermController.getTermsList, AlertController.getAllAlerts). The directory IS globally visible to every authenticated user — the read-collaborative posture is consistent (per `system-mission.md:267`)." — evidence: TagController.java:36-44 (no @PreAuthorize, no programmatic check) + SecurityConstants.java:138-142 (only POST/PUT/DELETE entries for `/api/tags`, no GET) + AuthorizationCustomizer.java:29-30 (catch-all `authenticated()` rule) — intent_anchor: "The absence of a GET SecurityRule in SecurityConstants.SECURITY_RULES is the deliberate statement: tag-directory READ is open to all authenticated users by design. Consistency with sibling controllers (TermController, AlertController) — the convention IS the decision" — confidence: HIGH

- "**Management-scope-only writes (no per-tag ownership)** — `TAG_CREATE` / `TAG_UPDATE` / `TAG_DELETE` are all `NO_CONTEXT` Management-scope permissions (`SecurityConstants.java:138-142` + `PolicyPermissionDto.java:62-64`). There is no `AuthorizationManagerType.TAG` resource extractor; no per-tag owner concept; no concept of 'I own this tag'. The Tag directory is intentionally a flat, globally-shared namespace. This is consistent with the table schema (no `tag.owner_id` column per the migration suite) and the read-collaborative posture." — evidence: SecurityConstants.java:138-142 (three SecurityRule with NO_CONTEXT) + PolicyPermissionDto.java:62-64 (TAG_* all MANAGEMENT scope) + AuthorizationManagerType (no TAG entry, per the imports in SecurityConstants line 5-13) — intent_anchor: "Three SecurityRule entries with `NO_CONTEXT` rather than a per-resource scope; the absence of an `AuthorizationManagerType.TAG` value is itself a maintainer decision — Tags are a vocabulary-level concept, not an owned-entity concept" — confidence: HIGH

- "**The `!external` guard protects Collector-pushed tags from UI overwrite** — `TagServiceImpl.update` (`:49-50`) and `TagServiceImpl.delete` (`:62-63`) both reject tags with any `external = true` usage via `BadUserRequestException(\"Can't update tag which has external relations\")` and `BadUserRequestException(\"Can't delete tag which has external relations\")`. The intent: a Collector that pushes a tag via `ExternalTagIngestionRequestProcessor` claims ownership of it; UI mutations would silently override the Collector-side semantics on next push. This is a soft-lock — once the operator removes all external relations, the tag becomes UI-editable again." — evidence: TagServiceImpl.java:49-50, 62-63 — intent_anchor: "Exception messages frame the constraint explicitly: 'Can't update tag which has external relations' / 'Can't delete tag which has external relations' — the maintainer-authored exception text IS the architectural statement" — confidence: HIGH

- "**Bulk-create as the operator-explicit API shape** — `createTag` accepts `Flux<TagFormData>` (line 23) and calls `.collectList()` (line 25) before passing the full list to `tagService.bulkCreate`. The OpenAPI's request body is a `BulkTagFormData` (`openapi.yaml:370`) — a wrapper around a list. The operator-explicit creation path is intentionally bulk; the API does not expose a single-tag-create variant. Distinct from the side-door path (`getOrCreateTagsByName`) which is also bulk but uses different conflict semantics (upsert via `ingestData` rather than fail-on-duplicate via `bulkCreate`). The dual create-shape design (bulk-explicit vs upsert-side-door) is intentional per the batch-N ADR." — evidence: TagController.java:22-28 + openapi.yaml:370 (BulkTagFormData) + TagService.java:16 (bulkCreate signature) + the contrast with TagService.java:24 (getOrCreateTagsByName) — intent_anchor: "Two distinct service methods (`bulkCreate` and `getOrCreateTagsByName`) with different conflict semantics — the dual-method design IS the architectural choice from the batch-N ReactiveTagRepositoryImpl analysis; this controller exposes the bulkCreate half, the side-door exposes the other" — confidence: HIGH

## bugs_limitations_corner_cases

- "**Status-code drift on `createTag`** — controller returns 200 via `ResponseEntity::ok` (line 27); OpenAPI declares 201 (`openapi.yaml:372`: `'201': The resource has been successfully created`). Any consumer expecting `response.status == HttpStatus.CREATED` per the spec would fail on actual responses. Same drift class as `TermController.createTerm` (batch-U) and `AlertController.changeAlertStatus`. — evidence: TagController.java:27 (`.map(ResponseEntity::ok)`) + openapi.yaml:372 (declared 201) — severity: MEDIUM"

- "**Status-code drift on `updateTag`** — controller returns 200 (line 51); OpenAPI declares 201 (`openapi.yaml:400`: `'201': The resource has been successfully updated`). The OpenAPI's use of 201 for an update endpoint is itself non-canonical (201 = created); the controller's 200 is more semantically correct but the spec is published. — evidence: TagController.java:51 (`.map(ResponseEntity::ok)`) + openapi.yaml:400 (declared 201) — severity: MEDIUM"

- "**`deleteTag` cascade asymmetry — `tag_to_dataset_field` rows NOT cleaned up** — `TagServiceImpl.delete` hard-deletes `tag_to_term` and `tag_to_data_entity` rows (`TagServiceImpl.java:64-65`), then soft-deletes the `tag` row (`:66`). It does NOT call `reactiveTagRepository.deleteDatasetFieldRelations(tagId)` (which exists at `ReactiveTagRepositoryImpl.java:299-306`). A tag attached to dataset fields via the side-door `DATASET_FIELD_TAGS_UPDATE` path, when deleted via this controller, leaves orphaned `tag_to_dataset_field` rows referencing the soft-deleted tag id. Reads via `listDatasetFieldDtos` filter these out via `addSoftDeleteFilter` on the join (`:84-98`) so the orphans are UI-invisible — but they persist in the DB indefinitely. Future garbage-collection migrations would need to address this; right now no cleanup job exists. — evidence: TagServiceImpl.java:57-70 (delete method) + ReactiveTagRepositoryImpl.java:299-306 (deleteDatasetFieldRelations exists but is NOT called from TagServiceImpl) + grep `deleteDatasetFieldRelations` returns no caller in TagServiceImpl — severity: MEDIUM"

- "**No RBAC gate on `getPopularTagList` — global tag directory enumeration available to every authenticated user** — the controller's read endpoint at `/api/tags` (GET, lines 37-44) has no SecurityRule entry in `SecurityConstants.SECURITY_RULES` (only POST/PUT/DELETE entries exist for the same path prefix, lines 138-142). Any authenticated user — including a user with only the per-entity `DATA_ENTITY_TAGS_UPDATE` permission — can enumerate every tag in the directory. Combined with the side-door write paths (REFACTOR-223), this enables an authenticated user to both READ and WRITE the global tag directory without ever holding `TAG_CREATE` / `TAG_UPDATE` / `TAG_DELETE`. — evidence: SecurityConstants.java:138-142 (no GET entry for `/api/tags`) + TagController.java:36-44 (no @PreAuthorize) + AuthorizationCustomizer.java:29-30 (catch-all `authenticated()` rule) — severity: MEDIUM"

- "**Side-door directory growth via `DATA_ENTITY_TAGS_UPDATE` / `TERM_TAGS_UPDATE` / `DATASET_FIELD_TAGS_UPDATE` / S2S ingestion** — this controller's `createTag` requires `TAG_CREATE` (`SecurityConstants.java:138`), but four DISTINCT bypass paths grow the same `tag` table without holding `TAG_CREATE`: (a) `TagServiceImpl.updateRelationsWithDataEntity` → `getOrCreateTagsByName` → `bulkCreate` for novel names; (b) `TermServiceImpl.upsertTags` → `getOrCreateTagsByName`; (c) `DatasetFieldServiceImpl` → `getOrCreateTagsByName`; (d) `ExternalTagIngestionRequestProcessor.process` → `getOrInjectTagByName` → `ingestData` upsert. The directory rows produced by any of these surfaces are immediately visible via this controller's `getPopularTagList`. This is the REFACTOR-223 / DOC-GAP-168 finding — the side-door is at the SERVICE layer (`getOrCreateTagsByName` / `getOrInjectTagByName`), NOT the controller layer; this controller is the *gated* path, the side-doors bypass this controller entirely. — evidence: TagController.java:23 (gated by TAG_CREATE) + TagService.java:24 (`getOrCreateTagsByName`) + grep call-sites: TagServiceImpl.java:105 + TermServiceImpl.java:257 + DatasetFieldServiceImpl.java:202, 266 + ExternalTagIngestionRequestProcessor.java:104 — severity: HIGH"

- "**Service-tier zero-permission-checks posture inherited from `TagServiceImpl`** — `TagServiceImpl` (lines 1-167) has ZERO `@PreAuthorize` annotations and ZERO programmatic permission checks. The controller perimeter (the four SecurityRule entries) is the SOLE authorisation defence for the directory-side mutations. Bypass paths like REFACTOR-217 (TermController path-mismatch) or any future controller path drift would NOT be caught at the service layer. This is the same architectural posture documented at the TermController batch-U sidecar — the platform's controllers as the sole RBAC perimeter. — evidence: TagServiceImpl.java:31-167 (no @PreAuthorize, no permissionService calls) — severity: MEDIUM"

- "**No request-body validation on `createTag` beyond OpenAPI `type: string`** — the `BulkTagFormData` schema declares `name` as `type: string` only (no `pattern`, no `minLength`, no `maxLength`); the database `tag.name` column has no `CHECK` constraint visible in the migration suite (per batch-N invariant). An operator with `TAG_CREATE` can mint tag rows with empty names, whitespace-only names, names containing control characters, names of unbounded length. The popular-tags surface then renders these to every other user. Same DoS-shape angle as the side-door path. — evidence: TagController.java:22-28 (no validation) + TagServiceImpl.java:38-42 (no validation) + openapi.yaml:370 (BulkTagFormData schema reference) — severity: LOW"

- "**`updateTag` reactive shape couples to `Mono<TagFormData>` unwrap pattern that could deadlock if `tagFormData` never completes** — the controller calls `.flatMap(fd -> tagService.update(tagId, fd))` (line 50). If the upstream Mono is one that resolves from the request body and the framework's deserialiser fails part-way, the flatMap silently hangs without timeout. Spring WebFlux's default request-body timeout (`spring.codec.max-in-memory-size` and reactor's `timeout()` settings) is the only hand-off; no `.timeout(Duration.ofSeconds(N))` on the controller-level flatMap. This is defensible at this scope (the framework owns the timeout) but undocumented in the codebase. — evidence: TagController.java:46-52 (`.flatMap` with no `.timeout`) — severity: LOW"

- "**`createTag` returns `Mono<ResponseEntity<Flux<Tag>>>` — nested reactive in response** — the response shape (line 23) is a Mono whose body is itself a Flux. The serialiser handles this correctly (JSON array of tags emitted as the Flux completes), but the OpenAPI spec declares the response as `TagList` (`openapi.yaml:377`), a static array shape — not a streaming Flux. Consumers using a generated client expecting a single `TagList` payload may struggle if the framework streams chunks. The behaviour is correct in practice (the response is buffered at HTTP level), but the dual-reactive-shape is non-idiomatic. — evidence: TagController.java:23 (return type) + openapi.yaml:377 (TagList declaration) — severity: LOW"

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` — the controller is on the HTTP UI / API surface and is gated by the four UI-relevant auth modes. `DISABLED` skips auth entirely (the four SecurityRule entries become irrelevant); `S2S` is orthogonal (S2S grants ADMIN per `system-mission.md:263`, which already implies all `TAG_*` permissions). The Tag DIRECTORY is not on the ingestion path — but the side-door via `ExternalTagIngestionRequestProcessor` IS reachable via the S2S-gated `/ingestion/entities` path, growing the same directory this controller reads from.
- **ingestion_filter_relevance**: `NO — UI/API surface at /api/tags/**, not /ingestion/**` for this controller. However: the global tag directory IS mutated by the ingestion path via `ExternalTagIngestionRequestProcessor.process` (`:104` → `getOrInjectTagByName` → `ingestData` upsert), which IS gated by the S2S `IngestionDataEntitiesFilter` per `auth.ingestion.filter.enabled`. The reads via this controller's `getPopularTagList` will reflect the ingestion-side mutations.
- **authorization_assertions**:
  - "POST `/api/tags` gated by `TAG_CREATE` (Management scope, NO_CONTEXT) — evidence: SecurityConstants.java:138"
  - "PUT `/api/tags/{tag_id}` gated by `TAG_UPDATE` (Management scope, NO_CONTEXT) — evidence: SecurityConstants.java:139-140"
  - "DELETE `/api/tags/{tag_id}` gated by `TAG_DELETE` (Management scope, NO_CONTEXT) — evidence: SecurityConstants.java:141-142"
  - "GET `/api/tags` has NO authorization gate beyond `authenticated()` — falls through to AuthorizationCustomizer's catch-all (`AuthorizationCustomizer.java:29-30`) — evidence: SecurityConstants.java:138-142 (no GET entry; the three entries are POST/PUT/DELETE only)"
  - "All four endpoints inherit the service-tier zero-checks posture — no `@PreAuthorize` and no programmatic permission calls in `TagServiceImpl.java:1-167` — evidence: grep '@PreAuthorize\\|permissionService' TagServiceImpl.java returns zero"
- **owner_scoping**: `N/A — Tag directory has no owner concept`. There is no `tag.owner_id` column (per batch-N invariant) and no per-Owner Tag filtering anywhere on the read or write paths. The directory is a flat, globally-shared namespace by design. This is consistent with the `NO_CONTEXT` Management-scope permissions (the absence of an `AuthorizationManagerType.TAG` resource extractor reinforces the design).
- **data_exposure**:
  - "`Mono<ResponseEntity<TagsResponse>>` from `getPopularTagList` → any authenticated user. Returns the full popularity-ranked global tag directory (filtered only by query substring + ids set + page). Includes id + name + important + external flag + usedCount per tag. — evidence: TagController.java:36-44"
  - "`Mono<ResponseEntity<Flux<Tag>>>` from `createTag` → caller holding `TAG_CREATE`. Returns the newly-created tags with assigned ids — useful to the caller for subsequent assignment operations. — evidence: TagController.java:22-28"
  - "`Mono<ResponseEntity<Tag>>` from `updateTag` → caller holding `TAG_UPDATE`. Returns the updated tag. — evidence: TagController.java:46-52"
  - "No body from `deleteTag` (204 No Content). — evidence: TagController.java:30-34"
- **known_security_gaps**:
  - "Side-door directory growth — `DATA_ENTITY_TAGS_UPDATE` / `TERM_TAGS_UPDATE` / `DATASET_FIELD_TAGS_UPDATE` (Data Entity / Term / Dataset Field scope permissions) and S2S ingestion all mint new global Tag rows via `TagServiceImpl.getOrCreateTagsByName` / `getOrInjectTagByName`, WITHOUT holding `TAG_CREATE`. The Tag DIRECTORY this controller's `getPopularTagList` reads from grows without `TAG_CREATE` being required. The live tagging doc page (WebFetched 2026-05-20) does NOT document this asymmetry. — evidence: TagService.java:24-26 + 5 call sites: TagServiceImpl.java:105, TermServiceImpl.java:257, DatasetFieldServiceImpl.java:202, 266, ExternalTagIngestionRequestProcessor.java:104 — severity: HIGH"
  - "Open-read posture on `getPopularTagList` — any authenticated user (under LOGIN_FORM/OAUTH2/LDAP) can enumerate the entire global tag directory regardless of `TAG_*` permissions or Management-scope role. Combined with the side-door write paths, this means a per-entity-tag-editor can both READ and WRITE the global tag namespace without holding any vocabulary-level permission. The live permissions page (WebFetched 2026-05-20) does NOT document the open-read posture. — evidence: SecurityConstants.java:138-142 (no GET entry) + AuthorizationCustomizer.java:29-30 (catch-all authenticated) + WebFetch 2026-05-20 (permissions page silent on read posture) — severity: MEDIUM"
  - "Service-tier zero-checks posture — `TagServiceImpl` performs no `@PreAuthorize` or programmatic permission checks (`:1-167` end-to-end). The controller perimeter is the SOLE authorisation defence. Any future path-drift bug (a SecurityConstants path-pattern mismatch like REFACTOR-217 on the term-tags surface) would silently bypass authorisation. — evidence: TagServiceImpl.java:1-167 (no @PreAuthorize, no permissionService calls) — severity: MEDIUM"
  - "No request-body validation on tag-name shape — name is `type: string` only per OpenAPI; no length / pattern / charset constraint at the controller or service or database level. An operator with `TAG_CREATE` can mint tag rows with arbitrary content (control characters, empty strings, very long strings). The popular-tags surface renders to every user. — evidence: TagController.java:22-28 + TagServiceImpl.java:38-42 + openapi.yaml:370 + (no migration-level CHECK constraint per batch-N) — severity: LOW"
  - "No audit log on this controller's write paths — `createTag` / `updateTag` / `deleteTag` produce NO entries in the Activity Feed. The platform's `@ActivityLog(event = TAG_ASSIGNMENT_UPDATED)` annotation exists at `DataEntityServiceImpl.java:358` (the per-entity tag-assignment path), but NOT at the controller-side directory-vocabulary path here. An operator using the Management → Tags tab to delete or rename a tag produces no audit trace. — evidence: TagController.java:22-52 (no @ActivityLog) + TagServiceImpl.java:31-167 (no @ActivityLog on bulkCreate / update / delete) + DataEntityServiceImpl.java:358 (the only @ActivityLog entry related to tags) — severity: MEDIUM"

## performance

- **hot_paths**:
  - "`getPopularTagList` runs on every UI page-load that renders tag-search-facets, the Catalog Overview Top-tags chip strip, the data-entity detail tag-dropdown, and the Management → Tags tab. Downstream `ReactiveTagRepositoryImpl.listMostPopular` (`:137-167`) executes a UNION-ALL CTE over `tag_to_data_entity` + `tag_to_dataset_field` — per the batch-N invariant, this is a non-trivial query with no index hints; expensive on large directories. — evidence: TagController.java:36-44 + ReactiveTagRepositoryImpl.java:137-167 (CTE)"
  - "`createTag` runs once per Management → Tags create action; bulk shape allows multiple tags per request. Downstream `bulkCreate` is the inherited single-statement INSERT … VALUES (...) with `executeInPartitionReturning` partitioning at `BATCH_SIZE`. — evidence: TagController.java:22-28 + TagServiceImpl.java:38-42 + ReactiveAbstractCRUDRepository.bulkCreate"
  - "`deleteTag` runs once per Management → Tags delete action; downstream performs FOUR sequential operations under one transaction: getDto → !external filter → Flux.zip(deleteTermRelations + deleteDataEntityRelations) → delete(soft) → updateChangedTagVectors (search-vector update). The Flux.zip is concurrent on the two cascade operations but the whole pipeline is serial; for a heavily-used tag, the cascade hard-deletes can scan O(N) join rows. — evidence: TagController.java:30-34 + TagServiceImpl.java:57-70"
  - "`updateTag` runs once per Management → Tags edit action; downstream performs FIVE operations: getDto → !external filter → applyToPojo → update → THREE concurrent search-vector updates via Mono.zip. The triple search-vector update is the heaviest part — three index-update queries against `search_entrypoint`, `search_entrypoint_structure`, and the term-side search entrypoint, all in one TX. — evidence: TagController.java:46-52 + TagServiceImpl.java:44-55, 161-167"
- **throughput_characteristics**:
  - "All four endpoints are reactive `Mono` / `Flux` — non-blocking; the underlying jOOQ-reactive PG driver releases the connection between awaits. No thread is held during DB round-trip."
  - "`createTag` is bulk — multiple tags per request. The OpenAPI's `BulkTagFormData` wrapper enables a single round-trip to create N tags. The `executeInPartitionReturning` inside the inherited `bulkCreate` partitions large batches.",
  - "`updateTag` and `deleteTag` are single-tag — no bulk equivalent at the controller. An operator deleting many tags must issue N HTTP requests serially (the UI doesn't offer multi-select Delete per the React component tree)."
- **resource_allocation**:
  - "Memory: per-call allocations are small. `createTag` materialises the input flux to a list via `.collectList()` (line 25), then passes to the service which maps to pojos — for a 1000-tag batch the memory cost is the full list resident.",
  - "DB connection: each method takes one connection per round-trip; no connection pinning across the TX. The `@ReactiveTransactional` on `delete` and `update` pin the connection for the duration of the multi-step pipeline.",
  - "No client-side caching — every `getPopularTagList` is a fresh round-trip. UI components fetch this list on mount; no platform-level cache layer."
- **scaling_characteristics**:
  - "Stateless — controller has no per-call state; horizontal scaling unconstrained.",
  - "No row-level locking on the write paths — `update` and `delete` are read-then-write within a `@ReactiveTransactional` boundary; PostgreSQL's READ COMMITTED isolation means concurrent updates to the same tag could race (TOCTOU between `getDto` and `update`/`delete`). The unique-name partial index protects against duplicate-name inserts at the directory level but not against concurrent rename/delete on the same id.",
  - "`getPopularTagList` has no size cap at the controller level — the `size` parameter is passed straight through to the service / repository. An attacker submitting `size=100000` would force a full-directory aggregate. — evidence: TagController.java:37-42 (no size validation) + ReactiveTagRepositoryImpl.java:138-167 (no clamp)"
- **known_performance_gaps**:
  - "`getPopularTagList` UNION-ALL CTE runs on every popular-tags fetch — for very large directories (1M+ tags), the per-tag UNION-ALL across `tag_to_data_entity` + `tag_to_dataset_field` is expensive. No materialized view; no caching layer; no `EXPLAIN`-anchored benchmark in the test suite. — evidence: ReactiveTagRepositoryImpl.java:137-167, 373-392 — severity: LOW"
  - "No `size` parameter clamp on `getPopularTagList` — `size=100000` is permitted at the controller layer. A single hostile-or-buggy client can force a large in-memory aggregation. — evidence: TagController.java:37-42 — severity: LOW"
  - "`updateTag` runs three concurrent search-vector update queries on EVERY tag edit (`TagServiceImpl.java:162-167`) — even if the edit is a trivial `important` flag flip with no name change. The search vectors only need re-computation on name change; an early-return optimisation is absent. — evidence: TagServiceImpl.java:44-55, 161-167 — severity: LOW"

## feature_hint

- pillar_id: P-01 (Data Discovery)
- sub_feature: F-018 Manual Object Tagging — this controller is the directory-side write surface for the Tag vocabulary (Management → Tags tab) AND the directory-side read surface for the search-facet / Top-tags rendering across Discovery.
- secondary_pillar_id: P-08 (Management & Administration) — the controller's three write endpoints (createTag / updateTag / deleteTag) are surfaced via the Management → Tags tab (`system-mission.md:240`); the read endpoint is also consumed from Management tab rendering.
- drift_class_facets:
  - REFACTOR-223 / DOC-GAP-168 — Tag side-door — DATA_ENTITY_TAGS_UPDATE + TERM_TAGS_UPDATE + DATASET_FIELD_TAGS_UPDATE + S2S ingestion all mint global Tag rows without TAG_CREATE; this controller is the GATED path, the side-doors bypass it. The substrate is at the SERVICE layer (`getOrCreateTagsByName` / `getOrInjectTagByName`), confirmed from the controller layer here.
  - Status-code drift on `createTag` + `updateTag` — controller returns 200, OpenAPI declares 201 (same drift class as TermController.createTerm / updateTerm batch-U; same as AlertController findings)
  - Cascade asymmetry on `deleteTag` — `tag_to_data_entity` + `tag_to_term` are cleaned up, `tag_to_dataset_field` is NOT — orphans persist invisibly
  - No RBAC gate on `getPopularTagList` read — any authenticated user can enumerate the global Tag directory regardless of `TAG_*` permissions (read-collaborative posture, but not documented as such on the live tagging or permissions pages)
  - Service-tier zero-permission-checks posture — same shape as TermController (batch-U) and inferred across the controller package — the perimeter IS the defence
  - Audit-log absence on directory-vocabulary mutations — `createTag` / `updateTag` / `deleteTag` produce no Activity Feed entries; extends the existing "Audit-log Presence Asymmetry" canonicalisation candidate in system-mission.md
- cross_pillar_relationships: 
  - P-01 → P-09 — Tag directory mutations gated by `TAG_*` permissions on the controller surface; side-door mutations gated by per-entity `*_TAGS_UPDATE` permissions on different controllers — read posture has NO gate (authenticated-only)
  - P-01 → P-08 — Management → Tags tab is the operator UI for these endpoints
  - P-01 → P-10 — S2S ingestion (`ExternalTagIngestionRequestProcessor`) grows the same directory this controller reads from
  - P-01 → P-07 — Tag mutations on the per-entity path emit `TAG_ASSIGNMENT_UPDATED` Activity events upstream; this controller's directory-vocabulary mutations emit NO Activity events (audit-log asymmetry)

## sources

- understanding ← TagController.java:1-53 (full file) + TagService.java:14-36 + TagServiceImpl.java:1-167 + SecurityConstants.java:138-142 + AuthorizationCustomizer.java:20-30
- concepts.entities.TagApi ← TagController.java:5, 18 + openapi.yaml:342-423
- concepts.entities.TagFormData ← TagController.java:7 + openapi.yaml:370, 398
- concepts.entities.Flux<TagFormData> ← TagController.java:23 + openapi.yaml:370 (BulkTagFormData)
- concepts.entities.Tag ← TagController.java:6 + openapi.yaml:405
- concepts.entities.TagsResponse ← TagController.java:8 + openapi.yaml:358
- concepts.entities.TagService ← TagController.java:9, 20 + TagService.java:14-36
- concepts.entities.ServerWebExchange ← TagController.java:12, 24, 31, 41, 49
- concepts.operations.createTag ← TagController.java:22-28 + TagServiceImpl.java:38-42 + SecurityConstants.java:138 + openapi.yaml:372
- concepts.operations.deleteTag ← TagController.java:30-34 + TagServiceImpl.java:57-70 + SecurityConstants.java:141-142 + ReactiveTagRepositoryImpl.java:235-241, 280-286 + ReactiveTagRepositoryImpl.java:299-306 (missing cascade)
- concepts.operations.getPopularTagList ← TagController.java:36-44 + TagServiceImpl.java:72-77 + ReactiveTagRepositoryImpl.java:137-167 + SecurityConstants.java:138-142 (no GET entry)
- concepts.operations.updateTag ← TagController.java:46-52 + TagServiceImpl.java:44-55 + SecurityConstants.java:139-140 + openapi.yaml:400
- concepts.invariants[thin-delegate] ← TagController.java:22-52 (every method 2-3 lines)
- concepts.invariants[no-RBAC-on-getPopularTagList] ← SecurityConstants.java:138-142 + AuthorizationCustomizer.java:29-30
- concepts.invariants[NO_CONTEXT-management-scope] ← SecurityConstants.java:138-142 + PolicyPermissionDto.java:62-64
- concepts.invariants[service-tier-zero-checks] ← TagServiceImpl.java:1-167
- concepts.invariants[side-door-bypass] ← TagService.java:24, 26 + TagServiceImpl.java:79-94 + TermServiceImpl.java:257 + DatasetFieldServiceImpl.java:202, 266 + ExternalTagIngestionRequestProcessor.java:104
- concepts.invariants[status-code-drift] ← TagController.java:27, 51 + openapi.yaml:372, 400
- concepts.invariants[cascade-asymmetry] ← TagServiceImpl.java:64-66 + ReactiveTagRepositoryImpl.java:299-306 (deleteDatasetFieldRelations exists but uncalled)
- concepts.invariants[!external-guard] ← TagServiceImpl.java:49-50, 62-63
- concepts.audiences ← Grep of UI components + system-mission.md P-01 + P-08 mappings
- dependencies_semantic.requires-feature.TagApi ← TagController.java:5, 18
- dependencies_semantic.requires-feature.TagService ← TagController.java:9, 20 + TagService.java:14-36
- dependencies_semantic.requires-feature.SecurityConstants ← SecurityConstants.java:138-142
- dependencies_semantic.requires-feature.AuthorizationCustomizer ← AuthorizationCustomizer.java:20-30
- dependencies_semantic.requires-runtime ← TagController.java:10-14 (imports) + line 16 @RestController
- dependencies_semantic.couples-to ← TagController.java:18 (TagApi) + line 20 (TagService field)
- tests_coverage_semantic.test_files ← grep `TagController` over odd-platform-api/src/test returns zero matches
- tests_coverage_semantic.uncovered_behaviours ← absence-of-tests + the controller's actual logic per file:line refs above
- docs_link_semantic.inferred_docs[0] ← WebFetch 2026-05-20 of https://docs.opendatadiscovery.org/features/data-discovery/tagging (status 200)
- docs_link_semantic.inferred_docs[1] ← WebFetch 2026-05-20 of https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions (status 200)
- docs_link_semantic.doc_drift_findings[0] ← WebFetch result (live page does not document side-door) + REFACTOR-223 evidence chain
- docs_link_semantic.doc_drift_findings[1] ← WebFetch result (live page silent on cascade) + TagServiceImpl.java:64-65 + ReactiveTagRepositoryImpl.java:299-306
- docs_link_semantic.doc_drift_findings[2] ← WebFetch result (permissions page silent on read posture) + SecurityConstants.java:138-142
- docs_link_semantic.doc_drift_findings[3] ← openapi.yaml:372, 400 + TagController.java:27, 51
- implicit_adrs[thin-delegate-pattern] ← TagController.java:18, 22-52 + sibling controllers (consistency across the controller package)
- implicit_adrs[read-collaborative-posture] ← SecurityConstants.java:138-142 + AuthorizationCustomizer.java:29-30 + system-mission.md:267
- implicit_adrs[management-scope-only] ← SecurityConstants.java:138-142 + PolicyPermissionDto.java:62-64 + (no AuthorizationManagerType.TAG)
- implicit_adrs[!external-guard] ← TagServiceImpl.java:49-50, 62-63 (exception messages as intent anchor)
- implicit_adrs[bulk-explicit-vs-upsert-side-door] ← TagController.java:22-28 + TagService.java:16 (bulkCreate) + TagService.java:24 (getOrCreateTagsByName)
- bugs_limitations_corner_cases[status-code-drift-createTag] ← TagController.java:27 + openapi.yaml:372
- bugs_limitations_corner_cases[status-code-drift-updateTag] ← TagController.java:51 + openapi.yaml:400
- bugs_limitations_corner_cases[cascade-asymmetry] ← TagServiceImpl.java:57-70 + ReactiveTagRepositoryImpl.java:299-306
- bugs_limitations_corner_cases[open-read-getPopular] ← SecurityConstants.java:138-142 + AuthorizationCustomizer.java:29-30
- bugs_limitations_corner_cases[side-door-directory-growth] ← TagController.java:23 + TagService.java:24, 26 + grep call-sites (TagServiceImpl.java:105, TermServiceImpl.java:257, DatasetFieldServiceImpl.java:202, 266, ExternalTagIngestionRequestProcessor.java:104)
- bugs_limitations_corner_cases[service-tier-zero-checks] ← TagServiceImpl.java:1-167
- bugs_limitations_corner_cases[no-validation] ← TagController.java:22-28 + TagServiceImpl.java:38-42 + openapi.yaml:370
- bugs_limitations_corner_cases[reactive-deadlock-shape] ← TagController.java:46-52
- bugs_limitations_corner_cases[nested-reactive-response] ← TagController.java:23 + openapi.yaml:377
- security.auth_mode_relevance ← TagController.java:1-53 + SecurityConstants.java:138-142 + system-mission.md:251-265 (auth modes)
- security.ingestion_filter_relevance ← ExternalTagIngestionRequestProcessor.java:104 (side-door from ingestion path) + IngestionDataEntitiesFilter wiring
- security.authorization_assertions ← SecurityConstants.java:138-142 + AuthorizationCustomizer.java:29-30 + TagServiceImpl.java:1-167 (no @PreAuthorize)
- security.owner_scoping ← (no `tag.owner_id` column per batch-N invariant) + SecurityConstants.java:138-142 (NO_CONTEXT entries) + PolicyPermissionDto.java:62-64 (MANAGEMENT scope)
- security.data_exposure ← TagController.java:22-52 + openapi.yaml:342-423 (response shapes)
- security.known_security_gaps[side-door] ← TagService.java:24, 26 + 5 call sites
- security.known_security_gaps[open-read] ← SecurityConstants.java:138-142 + AuthorizationCustomizer.java:29-30 + WebFetch 2026-05-20 permissions page
- security.known_security_gaps[service-tier-zero-checks] ← TagServiceImpl.java:1-167
- security.known_security_gaps[no-validation] ← TagController.java:22-28 + TagServiceImpl.java:38-42 + openapi.yaml:370
- security.known_security_gaps[no-audit-log] ← TagController.java:22-52 (no @ActivityLog) + TagServiceImpl.java:31-167 (no @ActivityLog on bulkCreate/update/delete) + DataEntityServiceImpl.java:358 (the one related @ActivityLog)
- performance.hot_paths[getPopularTagList] ← TagController.java:36-44 + ReactiveTagRepositoryImpl.java:137-167
- performance.hot_paths[createTag] ← TagController.java:22-28 + TagServiceImpl.java:38-42 + ReactiveAbstractCRUDRepository.bulkCreate
- performance.hot_paths[deleteTag] ← TagController.java:30-34 + TagServiceImpl.java:57-70 + ReactiveTagRepositoryImpl.java:235-241, 280-286
- performance.hot_paths[updateTag] ← TagController.java:46-52 + TagServiceImpl.java:44-55, 161-167
- performance.throughput_characteristics ← TagController.java:22-52 (all reactive) + TagService.java:16 (bulkCreate is bulk; update / delete are single)
- performance.resource_allocation ← TagController.java:22-28 (collectList) + TagServiceImpl.java:38-42 (pojo mapping)
- performance.scaling_characteristics ← TagServiceImpl.java:44-55, 57-70 (read-then-write TX) + TagController.java:37-42 (no size clamp)
- performance.known_performance_gaps[UNION-ALL CTE] ← ReactiveTagRepositoryImpl.java:137-167, 373-392
- performance.known_performance_gaps[no-size-clamp] ← TagController.java:37-42
- performance.known_performance_gaps[triple-vector-update] ← TagServiceImpl.java:44-55, 161-167
- feature_hint.pillar_id ← system-mission.md:94 (P-01 sub-feature "Manual Object Tagging")
- feature_hint.secondary_pillar_id ← system-mission.md:240 (P-08 Tags tab)
- feature_hint.drift_class_facets ← bugs_limitations_corner_cases above + batch-N ReactiveTagRepositoryImpl sidecar + batch-U TermController sidecar + REFACTOR-223 / DOC-GAP-168
- feature_hint.cross_pillar_relationships ← system-mission.md `relationships` block (P-10→P-01, P-09→P-01, P-01→P-07, P-01→P-08)

## confidence_per_field

- understanding: HIGH (full 53-line file read; every method shape traced to TagApi interface + TagService + downstream; SecurityConstants wiring verified; side-door framing confirmed by cross-reference to batch-N + batch-U sidecars and 5 grep call sites)
- concepts: HIGH (every entity / operation / invariant / audience traced to source file or migration suite or batch-N sidecar)
- dependencies_semantic: HIGH (TagApi + TagService + SecurityConstants + AuthorizationCustomizer all read at file:line)
- tests_coverage_semantic: HIGH (zero tests exist for this controller — confirmed by grep — and the uncovered-behaviour list is anchored on the actual code paths)
- docs_link_semantic: HIGH (both inferred URLs WebFetched live 2026-05-20 with status 200; excerpts quoted verbatim; four doc-drift findings each tied to a specific live-page absence + a specific code line)
- implicit_adrs: HIGH (five implicit ADRs each with intent_anchor evidence — sibling-controller consistency, absent-SecurityRule shape, NO_CONTEXT scope, exception-message guard text, dual create-shape design)
- bugs_limitations_corner_cases: HIGH (nine concerns each anchored at file:line; the cascade-asymmetry, side-door-directory-growth, and open-read findings are HIGH severity and corroborated by the batch-N ReactiveTagRepositoryImpl sidecar's findings)
- security: HIGH (auth-mode relevance + ingestion-filter relevance + 4 authorisation assertions verified at SecurityConstants line refs; owner-scoping N/A confirmed by absence of tag.owner_id + NO_CONTEXT permission scope; data-exposure traced to response shapes)
- performance: MEDIUM (hot-paths are clear; throughput / resource-allocation / scaling reasoning is sound but no EXPLAIN run this session; the triple-vector-update on every update is a real finding, the UNION-ALL CTE cost is inherited from batch-N sidecar)
- feature_hint: HIGH (pillar mapping verbatim from system-mission.md P-01 + P-08; cross-pillar relationships from system-mission.md relationships block; drift class facets corroborated by 2 sibling sidecars and 2 REFACTOR-NNN refs)

## Maintainer notes

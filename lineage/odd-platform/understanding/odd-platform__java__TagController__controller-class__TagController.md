---
node_id: "odd-platform java TagController controller-class:TagController"
node_kind: controller-class
axis: controllers
extracted_at_commit: ede5d277be6251b0826026035707c1fb6dbb24b6
enriched_at_commit: ede5d277be6251b0826026035707c1fb6dbb24b6
extractor_version: 0.1.0
prompt_version: file-analyser/0.4.0
schema_version: v0.4.0
enrichment_status: complete
confidence_overall: MEDIUM
session_id: session-2026-05-20-LSN-019-canary-TagController
pillar_anchored_features:
  - P-01:F-018 Manual Object Tagging
  - P-08 Management & Administration (Tags tab)
  - P-09 Security & Access Control
---

# TagController — semantic understanding

## understanding

`TagController` is the **HTTP controller-class for the Manual Object Tagging directory-side surface** (pillar P-01:F-018 per `system-mission.md:94`; pillar P-08 Tags tab per `system-mission.md:240`) — 53 lines, 4 endpoints implementing the OpenAPI-generated `TagApi` interface as pure 2-3-line reactive delegations to a single injected `TagService`. The four endpoints split into one read (`getPopularTagList` line 37 — **misleadingly named "popular"; the underlying SQL selects by `TAG.ID ASC` (creation order) BEFORE the count-based re-sort can apply — see stress_findings.name_behavior_pairs[0] + P-010**) and three writes (`createTag` line 23 — bulk insert from `Flux<TagFormData>`; `updateTag` line 47 — single-tag rename / Important-flag toggle; `deleteTag` line 31 — soft-delete with cascade). The class's authorisation surface is **gated entirely at the controller perimeter via `SecurityConstants.SECURITY_RULES`** (`SecurityConstants.java:138-142`): POST `/api/tags`→`TAG_CREATE`, PUT `/api/tags/{tag_id}`→`TAG_UPDATE`, DELETE `/api/tags/{tag_id}`→`TAG_DELETE`, all `NO_CONTEXT` (Management-scope permissions, not resource-scoped). The read endpoint `getPopularTagList` has **NO SecurityRule** — it falls through to `AuthorizationCustomizer.customize`'s catch-all `pathMatchers("/**").authenticated()` (`AuthorizationCustomizer.java:29-30`), so any authenticated user under LOGIN_FORM / OAUTH2 / LDAP can enumerate the entire global tag directory regardless of which `TAG_*` permissions they hold. **The createTag path is NOT the side-door that REFACTOR-223 / DOC-GAP-168 surfaces**: this controller's `createTag` requires `TAG_CREATE`; the side-door bypasses this controller entirely via `TermServiceImpl.upsertTags` (`TermServiceImpl.java:257`) gated by `TERM_TAGS_UPDATE` and `DataEntityServiceImpl.upsertTags` (the per-entity `PUT /api/dataentities/{id}/tags` path) gated by `DATA_ENTITY_TAGS_UPDATE` — both call `tagService.getOrCreateTagsByName` which mints fresh `tag` rows in the same directory `getPopularTagList` reads from, without holding `TAG_CREATE`. **No tests cover this controller** (`grep TagController <odd-platform-repo>/odd-platform-api/src/test` returns zero matches), and **status-code drift** exists between the controller and the OpenAPI spec on both `createTag` (200 vs 201) and `updateTag` (200 vs 201).

## concepts

- entities: [
    "`TagApi` — OpenAPI-generated controller interface; the contract this `@RestController` implements (line 18). The 4 method signatures are auto-derived from `openapi.yaml:342-423` (`/api/tags` and `/api/tags/{tag_id}` paths).",
    "`TagFormData` — input payload for create + update (`TagController.java:23, 48`); single-tag shape carrying `name` (string) + `important` (boolean).",
    "`Flux<TagFormData>` — bulk-input shape for `createTag` (line 23); the OpenAPI request body is `BulkTagFormData`; the controller `.collectList()` materialises the full batch before delegating to `tagService.bulkCreate(List<TagFormData>)`.",
    "`Tag` — single-tag response shape returned by `updateTag` (line 47) and the per-element shape inside the `Flux<Tag>` returned by `createTag`; carries `id, name, important, external, usedCount` per OpenAPI.",
    "`TagsResponse` — paginated tag-list response shape returned by `getPopularTagList` (line 37); wraps `pageInfo` (total, hasNext) + `items: List<Tag>`.",
    "`TagService` — the single injected service bean (line 20); 11-method interface (`TagService.java:14-36`) of which this controller invokes exactly 4 (`bulkCreate`, `update`, `delete`, `listMostPopular`); the other 7 are called by `DataEntityServiceImpl`, `TermServiceImpl`, `DatasetFieldServiceImpl`, `ExternalTagIngestionRequestProcessor` — the side-door surfaces that bypass this controller for tag-directory writes.",
    "`ServerWebExchange` — the Spring WebFlux reactive request context; injected on every method but used by NONE of them — pure delegation.",
    "`tagId: Long` — path-parameter for `updateTag` and `deleteTag` (lines 31, 47).",
    "`page, size, query, ids` — query-parameters for `getPopularTagList` (lines 37-41). `query` is name-substring filter; `ids` is an optional id-set filter; `page` and `size` flow into `paginate(...)` over `TAG.ID ASC` per `ReactiveTagRepositoryImpl.java:148`."
  ]
- operations: [
    "`createTag(Flux<TagFormData> tagFormData, ServerWebExchange exchange)` (lines 22-28) — bulk-write; `.collectList()` → `tagService.bulkCreate` → `ResponseEntity::ok`. Returns 200 (line 27) BUT OpenAPI declares 201 (`openapi.yaml:372`). Gated by `TAG_CREATE` (`SecurityConstants.java:138`).",
    "`deleteTag(Long tagId, ServerWebExchange exchange)` (lines 30-34) — soft-delete-with-cascade; `tagService.delete(tagId)` → 204 No Content. Downstream `TagServiceImpl.delete` (`:57-70`, `@ReactiveTransactional`): (1) fetch + `!external` guard (`BadUserRequestException` rejection); (2) HARD-delete cascade on `tag_to_term` + `tag_to_data_entity` via `Flux.zip`; (3) SOFT-delete the `tag` row; (4) update term-side search vectors. **Cascade does NOT cover `tag_to_dataset_field`** — `deleteDatasetFieldRelations` exists at `ReactiveTagRepositoryImpl.java:299-306` but is NOT called from `TagServiceImpl.delete`. Gated by `TAG_DELETE`.",
    "`getPopularTagList(Integer page, Integer size, String query, List<Long> ids, ServerWebExchange exchange)` (lines 36-44) — read; delegates to `tagService.listMostPopular(query, ids, page, size)` (argument-order swap at line 42). **The downstream SQL pipeline does NOT order by popularity at the row-selection step.** `ReactiveTagRepositoryImpl.listMostPopular` (`:137-167`): (a) builds `selectFrom(TAG).where(conditions)` (lines 144-145); (b) wraps in `paginate(homogeneousQuery, [new OrderByField(TAG.ID, SortOrder.ASC)], offset, size)` — this is the INNER SELECT that picks 30 rows by `TAG.ID ASC` (= creation order, since `id` is serial PK) BEFORE any usage count is computed; (c) `JooqQueryHelper.paginate` (`:63-90`) emits `SELECT u.fields, count() OVER (), row_number() OVER (ORDER BY id ASC) FROM (baseSelect) u ORDER BY id ASC LIMIT size OFFSET offset` — the LIMIT happens on `TAG.ID ASC`; (d) the 30 selected rows become `tag_cte` (line 150); (e) `getDataEntityWithDatasetFields` (`:373-392`) unions usage counts OVER THOSE 30 CTE ROWS ONLY; (f) the outer `cteSelect.orderBy(field(COUNT_FIELD).desc())` (line 158) re-orders those 30 by count DESC — but CANNOT reach the unselected popular tags. Operator-visible: with 35 tags where the YOUNGEST 5 have HIGHER counts than the OLDEST 30, GET /api/tags?page=1&size=30 returns the OLDEST 30 (the 5 actually-popular are missing). **NO SecurityRule** on this endpoint — only `authenticated()` via the catch-all.",
    "`updateTag(Long tagId, Mono<TagFormData> tagFormData, ServerWebExchange exchange)` (lines 46-52) — single-tag write; `.flatMap(fd -> tagService.update(tagId, fd))`. Downstream `TagServiceImpl.update` (`:44-55`, `@ReactiveTransactional`): (1) `getDto` → 404 if absent; (2) `!external` guard; (3) `tagMapper::applyToPojo` → repository.update; (4) THREE concurrent search-vector updates via `Mono.zip`. Returns 200 (line 51) BUT OpenAPI declares 201 (`openapi.yaml:400`). Gated by `TAG_UPDATE`."
  ]
- invariants: [
    "All 4 method bodies are 2-line or 3-line reactive delegations — no business logic, no programmatic auth checks; the controller is a pure stub-implementation of `TagApi`.",
    "Single injected service (`TagService` line 20) constructor-injected via Lombok `@RequiredArgsConstructor` (line 17).",
    "**`getPopularTagList` is misnamed: it returns the OLDEST 30 tags by `TAG.ID ASC`, NOT the 30 most-popular.** The OUTER `cteSelect.orderBy(field(COUNT_FIELD).desc())` (`ReactiveTagRepositoryImpl.java:158`) re-orders the 30 already-selected by `paginate(..., [TAG.ID ASC], ...)` — it cannot reach tags excluded by the inner LIMIT. The method name promises popularity ordering; the implementation delivers creation-order selection with intra-page count-DESC re-sort. **LSN-019 drift class** — empirically reproduced by maintainer 2026-05-20 (35 tags → response returns 30 OLDEST by `created_at` ASC); statically traced through `JooqQueryHelper.paginate` (`:63-90`); pinned permanently by P-010.",
    "**`getPopularTagList` is NOT RBAC-gated** — only the three write endpoints have SecurityRule entries (`SecurityConstants.java:138-142`). The read endpoint inherits the catch-all `authenticated()` rule. Any authenticated user can enumerate the entire global tag directory regardless of `TAG_*` permissions.",
    "**The three write endpoints are gated by `NO_CONTEXT` Management-scope permissions** — `TAG_CREATE` / `TAG_UPDATE` / `TAG_DELETE` are all `MANAGEMENT` scope per `PolicyPermissionDto.java:62-64`; they are NOT resource-scoped (no per-tag ownership concept).",
    "**Authorisation is controller-tier-only** — the service-tier (`TagServiceImpl`) has ZERO `@PreAuthorize` or programmatic permission checks (`:1-167` end-to-end). The controller perimeter is the SOLE defence.",
    "**Side-door write paths bypass this controller entirely** — `getOrCreateTagsByName` (`TagServiceImpl.java:79-86`) is invoked from FIVE distinct call sites NOT under TagController: (a) `TagServiceImpl.updateRelationsWithDataEntity` (`:98-121`, invoked by `PUT /api/dataentities/{id}/tags` gated by `DATA_ENTITY_TAGS_UPDATE`); (b) `TermServiceImpl.upsertTags` (`:257`, invoked by `PUT /api/terms/{term_id}/tags` gated by `TERM_TAGS_UPDATE`); (c) `DatasetFieldServiceImpl` (`:202, 266`, invoked by `PUT /api/datasetfields/{id}/tags` gated by `DATASET_FIELD_TAGS_UPDATE`); (d) `ExternalTagIngestionRequestProcessor.process` (`:104`, invoked by `POST /ingestion/entities` Collector push gated only by `auth.ingestion.filter.enabled` S2S filter); (e) `tagService.getOrInjectTagByName` (`:88-94`) from the Collector path.",
    "**Status-code drift between controller and OpenAPI on `createTag` + `updateTag`** — both return 200 (`.map(ResponseEntity::ok)` lines 27, 51) but OpenAPI declares 201 (`openapi.yaml:372, 400`).",
    "**`deleteTag` cascade is asymmetric across the three relation tables** — `TagServiceImpl.delete` HARD-deletes `tag_to_term` and `tag_to_data_entity` rows (lines 64-65) but does NOT touch `tag_to_dataset_field`. Orphaned rows persist invisibly (filtered out by `addSoftDeleteFilter` on reads).",
    "**The `!external` guard pattern** — `TagServiceImpl.update` and `TagServiceImpl.delete` both reject tags with `external = true` usages (lines 49-50 + 62-63) via `BadUserRequestException`."
  ]
- audiences: [
    "odd-platform-ui-end-user — Management → Tags tab (write endpoints) and tag-search-facet / Catalog Overview Top-tags chip strip (the misnamed read endpoint).",
    "odd-api-consumer — programmatic clients via the OpenAPI spec at `/api/v3/api-docs`.",
    "platform-operator — RBAC author granting `TAG_CREATE` / `TAG_UPDATE` / `TAG_DELETE`.",
    "data-engineer-analyst / data-steward-owner — every authenticated user who applies tags (via the side-door, not this controller).",
    "Collector runtime (S2S audience) — grows the directory via `ExternalTagIngestionRequestProcessor`."
  ]

## dependencies_semantic

- requires-feature: [
    "`TagApi` OpenAPI-generated controller interface (`odd-platform-api-contract` generated code)",
    "`TagService` interface (`TagService.java:14-36`) — 11-method service contract; this controller invokes 4.",
    "`SecurityConstants.SECURITY_RULES` (`SecurityConstants.java:138-142`) — the three SecurityRule entries; the absence of a GET entry is load-bearing.",
    "`AuthorizationCustomizer.customize` (`AuthorizationCustomizer.java:20-30`) — catch-all `authenticated()` rule applies to `GET /api/tags`."
  ]
- requires-config: []
- requires-runtime: [
    "Spring WebFlux reactive HTTP server — `@RestController` (line 16); reactive `Mono` / `Flux` throughout.",
    "Lombok `@RequiredArgsConstructor` (line 17).",
    "`reactor.core.publisher.Mono` / `Flux`.",
    "Spring Security ReactiveSecurityWebFilterChain — composed via `OAuthSecurityConfiguration` / `LoginFormSecurityConfiguration` / `LdapSecurityConfiguration` / `SecurityConfiguration`."
  ]
- couples-to: [
    "`TagApi` (`implements` at line 18) — every method is `@Override` of the generated interface.",
    "`TagService` (constructor-injected line 20).",
    "`SecurityConstants.SECURITY_RULES` — coupled by URL convention (path-pattern match, not reference)."
  ]

## tests_coverage_semantic

- covered_behaviours: []
- uncovered_behaviours:
    - behaviour: "`createTag` happy path — POST `/api/tags` with a valid bulk payload, assert `Flux<Tag>` response shape and each tag has an assigned id."
      test_class: integration
      criticality: HIGH
      test_files: []
      note: "No `TagControllerTest.java` exists; controller perimeter is unverified."
    - behaviour: "`createTag` duplicate-name path — assert `UniqueConstraintException` translates to 4xx."
      test_class: integration
      criticality: HIGH
      test_files: []
    - behaviour: "`createTag` status-code drift — assert controller returns 200 (de facto) vs OpenAPI 201."
      test_class: integration
      criticality: MEDIUM
      test_files: []
    - behaviour: "`deleteTag` cascade asymmetry — DELETE on a dataset-field-attached tag, assert `tag_to_dataset_field` rows persist as orphans."
      test_class: integration
      criticality: MEDIUM
      test_files: []
    - behaviour: "`deleteTag` external-relations rejection — assert `BadUserRequestException` from `TagServiceImpl.java:63` on external-tagged delete."
      test_class: integration
      criticality: MEDIUM
      test_files: []
    - behaviour: "`updateTag` external-relations rejection — assert `BadUserRequestException` from `TagServiceImpl.java:50`."
      test_class: integration
      criticality: MEDIUM
      test_files: []
    - behaviour: "`updateTag` not-found path — PUT for a non-existent tag id, assert `NotFoundException` → 404."
      test_class: integration
      criticality: MEDIUM
      test_files: []
    - behaviour: "`getPopularTagList` LSN-019 drift — 35 tags fixture (5 youngest have higher count than 30 oldest), assert the response contains the OLDEST 30 by id (NOT the 5 most-popular). Pinned by P-010."
      test_class: integration
      criticality: HIGH
      test_files: []
      note: "Existing `TagRepositoryImplTest.testListMostPopular` is structurally blind to this drift — it uses `containsExactlyInAnyOrder` (no order check) and `numberOfTestTags = size` (no LIMIT exercised); see test_files."
    - behaviour: "`getPopularTagList` authorisation absence — assert no-`TAG_*` user gets 200 + full directory."
      test_class: security
      criticality: MEDIUM
      test_files: []
    - behaviour: "`createTag` authorisation enforcement — assert no-`TAG_CREATE` user gets 403."
      test_class: security
      criticality: HIGH
      test_files: []
    - behaviour: "Side-door write path observability — assert `PUT /api/dataentities/{id}/tags` with novel tag names mints rows visible via GET `/api/tags` without `TAG_CREATE`."
      test_class: security
      criticality: HIGH
      test_files: []
    - behaviour: "`getPopularTagList` size-clamp absence — `size=100000` accepted; large in-memory aggregation triggered."
      test_class: performance
      criticality: MEDIUM
      test_files: []
- test_files:
    - "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/TagRepositoryImplTest.java:237-267 (`testListMostPopular` — repository-layer only, structurally blind to LSN-019 ordering drift; uses `containsExactlyInAnyOrder` + `size = numberOfTestTags` so the LIMIT case never fires; covers `query` substring filter, NOT popularity ordering)"
- gaps: |
    The highest-leverage gap is **integration coverage of `getPopularTagList`'s LSN-019 drift**: the controller has zero tests; the repository-layer `testListMostPopular` (`TagRepositoryImplTest.java:237-267`) exercises 8 tags with `size=numberOfTestTags=8` (the LIMIT never fires) and asserts `containsExactlyInAnyOrder` on the popular-name-filtered subset — both choices are structurally incapable of detecting the inner `TAG.ID ASC` selection. Probe P-010 pins the drift; converting P-010's arrange + act + assert into a Testcontainers-backed `@SpringBootTest` (with the same 35-tag fixture and the same set-membership assertion) would put the drift permanently under CI. The second-highest-leverage gap is **security tests** — no `TagControllerSecurityTest` exists, so a future SecurityConstants drift (path rename / pattern mismatch like REFACTOR-217) would not surface in CI. The third is the **side-door observability test** — the integration boundary where `DATA_ENTITY_TAGS_UPDATE` grows the same directory that `getPopularTagList` reads from is the audit-relevant cross-controller observation REFACTOR-223 / DOC-GAP-168 lives at, and no test pins it.

## docs_link_semantic

- declared_docs: []
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/tagging"
    anchor: ""
    rationale: "Operator-facing Tag UX page — both the Management → Tags vocabulary surface (the three write endpoints) and the per-entity tag assignment surface (the side-door). Inherited verification from prior batch-W sidecar's WebFetch 2026-05-20, status 200 (stale-probe cadence — re-verification within the 11-day window not yet required this session)."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    fetched_excerpts: |
      Live-page text (WebFetch 2026-05-20, status 200, inherited from batch-W sidecar verification): "Management → Tags (operator-mutating side): Create the canonical tag vocabulary, set Important flags, and govern tagging across teams. Per-entity assignment: 'open the entity (or column) detail surface, click the tag-management control, and pick from the existing tag vocabulary or create a new tag inline.' Three RBAC permissions: TAG_CREATE / TAG_UPDATE / TAG_DELETE. All three govern vocabulary-level mutations, not assignment operations." Live page makes NO mention of whether deleting a tag cascades to remove it from tagged entities; makes NO mention of the popularity-ordering claim's underlying SQL (i.e., does NOT clarify the LSN-019 drift either way — the page references "Top tags" on the Catalog Overview but provides no API endpoint details, no ordering semantics, and no visibility scope.
    confidence: HIGH
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions"
    anchor: ""
    rationale: "Permissions catalog — names `TAG_CREATE` (MANAGEMENT scope) and `DATA_ENTITY_TAGS_UPDATE` (DATA_ENTITY scope) but does NOT name the side-channel."
    last_verified_at: "2026-05-20T00:00:00Z"
    last_verified_status: 200
    fetched_excerpts: |
      Live-page text (inherited from batch-W sidecar): "Management Permissions: TAG_CREATE / TAG_UPDATE / TAG_DELETE. Data Entity Permissions: DATA_ENTITY_TAGS_UPDATE: 'Allows editing a data entity's tags.' The documentation does not describe any mechanism by which DATA_ENTITY_TAGS_UPDATE can create new global tags."
    confidence: HIGH
- doc_drift_findings:
  - "**LSN-019 — name-vs-behavior drift on `getPopularTagList`:** UI surface labels the response 'Top Tags' / 'popular tags'; method name is `listMostPopular`; the implementation selects the OLDEST 30 tags by `TAG.ID ASC` via the inner `paginate` (`ReactiveTagRepositoryImpl.java:148`) BEFORE counting, then re-orders only those 30 by count DESC. No live doc page describes the popularity semantics with enough specificity to either confirm or refute popularity ordering. Operator-visible: a deployment with > 30 tags where recently-created tags are popular renders OLD-and-unused tags as 'Top Tags'. Verified static-inferred by JOOQ trace + JooqQueryHelper.paginate semantics; empirical confirmation by maintainer 2026-05-20 (35-tag test); pinned by P-010."
  - "Live tagging page (WebFetched 2026-05-20, 200, inherited) does NOT state that an operator with `DATA_ENTITY_TAGS_UPDATE` alone (no `TAG_CREATE`) can mint new tag-vocabulary rows visible to every other user via `getPopularTagList`. This is the directory side-door (DOC-GAP-168 / REFACTOR-223)."
  - "Live tagging page does NOT address whether `deleteTag` cascades to dataset-field assignments — the controller's downstream `TagServiceImpl.delete` does NOT cascade for `tag_to_dataset_field`, leaving orphaned join rows."
  - "Live permissions page does NOT mention that GET `/api/tags` has NO RBAC gate beyond authentication — any authenticated user can enumerate the entire global tag directory."
  - "OpenAPI declares `'201'` response status for `createTag` and `updateTag`; controller returns 200 via `ResponseEntity::ok`."

## implicit_adrs

- "**Thin OpenAPI-delegate controller pattern** — every method body is a 2-3-line reactive delegation `service-call.map(ResponseEntity::ok)` with no transformations, no programmatic auth checks. The convention IS the architectural decision (repeated across AlertController, OwnerController, TermController, etc.)." — evidence: TagController.java:18 (`implements TagApi`) + lines 22-52 (every method 2-3 lines) + consistency across the controller package — intent_anchor: "Consistent pattern repeated across the 4 methods AND across the controller package; the OpenAPI-generated interface convention IS the architectural statement that business logic stays in services" — confidence: HIGH

- "**Read endpoints are NOT RBAC-gated** — `getPopularTagList` has no SecurityRule entry, falling through to `pathMatchers(\"/**\").authenticated()`. Consistent shape across sibling controllers (TermController.getTermsList, AlertController.getAllAlerts) per the read-collaborative posture (`system-mission.md:267`)." — evidence: TagController.java:36-44 + SecurityConstants.java:138-142 (only POST/PUT/DELETE entries; no GET) + AuthorizationCustomizer.java:29-30 — intent_anchor: "Absence of a GET SecurityRule + consistency with sibling controllers — the convention IS the decision: tag-directory READ is open to all authenticated users by design" — confidence: HIGH

- "**Management-scope-only writes (no per-tag ownership)** — `TAG_CREATE` / `TAG_UPDATE` / `TAG_DELETE` are all `NO_CONTEXT` Management-scope. No `AuthorizationManagerType.TAG` exists; no `tag.owner_id` column." — evidence: SecurityConstants.java:138-142 + PolicyPermissionDto.java:62-64 — intent_anchor: "Three SecurityRule entries with `NO_CONTEXT` rather than per-resource scope + absence of `AuthorizationManagerType.TAG` value — Tags are a vocabulary-level concept, not an owned-entity concept" — confidence: HIGH

- "**The `!external` guard protects Collector-pushed tags from UI overwrite** — `TagServiceImpl.update` and `TagServiceImpl.delete` both reject tags with external relations." — evidence: TagServiceImpl.java:49-50, 62-63 — intent_anchor: "Exception messages frame the constraint explicitly: 'Can't update tag which has external relations' / 'Can't delete tag which has external relations' — the maintainer-authored exception text IS the architectural statement" — confidence: HIGH

- "**Bulk-create as the operator-explicit API shape** — `createTag` accepts `Flux<TagFormData>` and `.collectList()`s before passing to `tagService.bulkCreate`. The dual create-shape design (bulk-explicit `bulkCreate` vs upsert-side-door `getOrCreateTagsByName`) is intentional." — evidence: TagController.java:22-28 + TagService.java:16 (bulkCreate) + TagService.java:24 (getOrCreateTagsByName, distinct conflict semantics) — intent_anchor: "Two distinct service methods with different conflict semantics — the dual-method design IS the architectural choice" — confidence: HIGH

## bugs_limitations_corner_cases

- "**`getPopularTagList` LSN-019 name-vs-behavior drift** — the endpoint name + method name + `@GetMapping('/popular')` promise popularity ordering; the implementation in `ReactiveTagRepositoryImpl.listMostPopular` (`:137-167`) uses `paginate(homogeneousQuery, [new OrderByField(TAG.ID, SortOrder.ASC)], offset, size)` (line 148) as the row-SELECTION step. `JooqQueryHelper.paginate` (`:63-90`) emits a SELECT with `ORDER BY id ASC LIMIT size OFFSET offset` as the INNER step; only the 30 rows so-selected enter `tag_cte`. The OUTER `cteSelect.orderBy(field(COUNT_FIELD).desc())` (line 158) re-orders those 30 by count DESC but cannot reach tags excluded by the LIMIT. With > 30 tags where the YOUNGEST have higher counts than the OLDEST 30, the response contains the OLDEST 30 and the actual-most-popular are missing. The previous batch-W sidecar transcribed this as 'orders by descending count' — the WRONG claim, the canonical LSN-019 failure. — evidence: TagController.java:37-44 + TagServiceImpl.java:72-77 + ReactiveTagRepositoryImpl.java:144-158 + JooqQueryHelper.java:63-90 + maintainer's 2026-05-20 empirical test (35 tags returns OLDEST 30 by created_at ASC) — severity: HIGH"

- "**Status-code drift on `createTag`** — controller returns 200 via `ResponseEntity::ok` (line 27); OpenAPI declares 201 (`openapi.yaml:372`). Same drift class as `TermController.createTerm` (batch-U). — evidence: TagController.java:27 + openapi.yaml:372 — severity: MEDIUM"

- "**Status-code drift on `updateTag`** — controller returns 200 (line 51); OpenAPI declares 201 (`openapi.yaml:400`). — evidence: TagController.java:51 + openapi.yaml:400 — severity: MEDIUM"

- "**`deleteTag` cascade asymmetry — `tag_to_dataset_field` rows NOT cleaned up** — `TagServiceImpl.delete` hard-deletes `tag_to_term` and `tag_to_data_entity` rows (`:64-65`), then soft-deletes the `tag`. Does NOT call `reactiveTagRepository.deleteDatasetFieldRelations(tagId)` (which exists at `ReactiveTagRepositoryImpl.java:299-306`). Orphaned join rows persist; reads filter them via `addSoftDeleteFilter` so UI-invisible, but DB-persistent indefinitely. — evidence: TagServiceImpl.java:57-70 + ReactiveTagRepositoryImpl.java:299-306 (deleteDatasetFieldRelations defined but uncalled) — severity: MEDIUM"

- "**No RBAC gate on `getPopularTagList` — global tag directory enumeration available to every authenticated user** — no SecurityRule entry for GET `/api/tags`. Combined with the side-door write paths, an authenticated user with only `DATA_ENTITY_TAGS_UPDATE` can both READ and WRITE the global tag directory without holding any `TAG_*` permission. — evidence: SecurityConstants.java:138-142 (no GET entry) + TagController.java:36-44 (no @PreAuthorize) + AuthorizationCustomizer.java:29-30 — severity: MEDIUM"

- "**Side-door directory growth via `DATA_ENTITY_TAGS_UPDATE` / `TERM_TAGS_UPDATE` / `DATASET_FIELD_TAGS_UPDATE` / S2S ingestion** — this controller's `createTag` requires `TAG_CREATE`, but four distinct bypass paths mint global `tag` rows via `TagServiceImpl.getOrCreateTagsByName` / `getOrInjectTagByName` WITHOUT `TAG_CREATE`. REFACTOR-223 / DOC-GAP-168. — evidence: TagService.java:24, 26 + 5 call sites: TagServiceImpl.java:105, TermServiceImpl.java:257, DatasetFieldServiceImpl.java:202, 266, ExternalTagIngestionRequestProcessor.java:104 — severity: HIGH"

- "**Service-tier zero-permission-checks posture inherited from `TagServiceImpl`** — no `@PreAuthorize` or programmatic permission checks anywhere in `TagServiceImpl.java:1-167`. Controller perimeter is SOLE defence. — evidence: TagServiceImpl.java:1-167 — severity: MEDIUM"

- "**No request-body validation on `createTag` beyond OpenAPI `type: string`** — `BulkTagFormData` schema declares `name` as `type: string` only (no `pattern`, no `minLength`, no `maxLength`); no DB-level `CHECK` constraint. Empty / whitespace / control-char / unbounded-length names accepted. — evidence: TagController.java:22-28 + TagServiceImpl.java:38-42 + openapi.yaml:370 — severity: LOW"

- "**`createTag` returns `Mono<ResponseEntity<Flux<Tag>>>` — nested reactive in response** — OpenAPI declares response as `TagList` (`openapi.yaml:377`), a static array shape. The behaviour is correct in practice (buffered at HTTP level), but the dual-reactive-shape is non-idiomatic. — evidence: TagController.java:23 + openapi.yaml:377 — severity: LOW"

- "**No audit log on this controller's write paths** — `createTag` / `updateTag` / `deleteTag` produce NO Activity Feed entries. `@ActivityLog(event = TAG_ASSIGNMENT_UPDATED)` exists at `DataEntityServiceImpl.java:358` (per-entity tag-assignment path) but NOT at the controller-side directory-vocabulary path. — evidence: TagController.java:22-52 (no @ActivityLog) + TagServiceImpl.java:31-167 (no @ActivityLog on bulkCreate / update / delete) — severity: MEDIUM"

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "TagController.java:38"
      name: "size"
      value: "Integer (caller-controlled; default per OpenAPI SizeParam; no clamp in controller or service or repository)"
      questions:
        - q: "What at N = 0 / N = 1?"
          a: "size=0: paginate(...) emits LIMIT 0 → empty list; pageifyResult (JooqQueryHelper.java:95-101) hits the records.isEmpty() branch and returns Page.builder().data([]).total(fetchCount()).hasNext(false). size=1: paginate selects 1 row by TAG.ID ASC = the OLDEST tag; outer cteSelect returns it with usage count."
          confidence: STATIC-INFERRED
          evidence: "ReactiveTagRepositoryImpl.java:138-167 + JooqQueryHelper.java:63-90, 95-101"
        - q: "What at N = tunable + 1 / tunable × 100?"
          a: "size=31 with 35 tags: same drift as size=30 — selects ids 1..31 (oldest 31), youngest 4 (ids 32..35) still missing. size=3000 with 35 tags: paginate LIMIT 3000 returns all 35; the outer count-DESC then orders all 35 by usage count correctly (the drift only manifests when total > size). size=100000: no validation rejects; the SQL plan runs the inner paginate over the entire TAG table sorted by TAG.ID ASC, then the UNION-ALL CTE aggregates over the full result set — large in-memory aggregation, no protection."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:37-42 (no @Valid, no @Max) + ReactiveTagRepositoryImpl.java:138-167 (no clamp) + JooqQueryHelper.java:63-90"
        - q: "What at null / negative / non-numeric?"
          a: "Integer page/size: null is permitted at the Spring-WebFlux parameter-binding layer; the service signature receives `int page, int size` (TagServiceImpl.java:73-74) so Spring autoboxes — null Integer → NullPointerException on unboxing at the service-call boundary. Negative: page=-1, size=-1: paginate computes offset = (page-1)*size = -2*-1 = 2 (weird arithmetic); LIMIT -1 in PostgreSQL is rejected as 'requested limit cannot be negative' → SQL error → 500 to caller. The controller has no validation."
          confidence: PROBE-NEEDED
          evidence: "P-010 (the realism_caveats describe the null/negative variants as out-of-scope; a follow-up probe should pin them)"
        - q: "What does the operator see at each boundary?"
          a: "size > total tags: full directory returned in correct count-DESC order. size < total tags: LSN-019 drift — the response contains the OLDEST `size` tags by id, with the OUTER count-DESC re-sort applied within those rows. The 'Top Tags' UI surface renders this without indicating the drift. size=0: empty 'Top Tags' surface with no error."
          confidence: STATIC-INFERRED
          evidence: "ReactiveTagRepositoryImpl.java:144-158 + JooqQueryHelper.java:63-90 + maintainer's 2026-05-20 empirical test (35 tags → OLDEST 30)"
    - location: "ReactiveTagRepositoryImpl.java:148"
      name: "OrderByField(TAG.ID, SortOrder.ASC)"
      value: "TAG.ID ASC (load-bearing constant — the actual selection criterion in the inner paginate)"
      questions:
        - q: "What at N = 0 / N = 1?"
          a: "N = total tag count. At N=0 (empty tag table): paginate emits LIMIT size OFFSET 0 over an empty base → empty result. At N=1: one tag, selected regardless of TAG.ID value."
          confidence: STATIC-INFERRED
          evidence: "JooqQueryHelper.java:63-90"
        - q: "What at N > size?"
          a: "LSN-019 — paginate selects the FIRST size rows by TAG.ID ASC. Tags with TAG.ID > the cutoff are EXCLUDED from `tag_cte`; the outer count-DESC re-sort cannot reach them. With 35 tags + size=30: rows 1..30 selected, rows 31..35 excluded — even if rows 31..35 have higher usage counts."
          confidence: STATIC-INFERRED
          evidence: "ReactiveTagRepositoryImpl.java:144-167 + JooqQueryHelper.java:63-90 + maintainer's 2026-05-20 empirical test"
        - q: "What does the operator see at each boundary?"
          a: "Operator-visible: 'Top Tags' UI surface shows OLDEST 30 tags (by serial id, correlating with creation order); the 5 youngest-and-most-popular are invisible. This is the LSN-019 drift, pinned by P-010."
          confidence: STATIC-INFERRED
          evidence: "ReactiveTagRepositoryImpl.java:148 + maintainer's empirical test"
  name_behavior_pairs:
    - name: "TagController.getPopularTagList (line 37) + @GetMapping('/popular') (inherited from TagApi.java generated interface)"
      promise: "Returns the most-popular tags ordered by descending usage count — both the method name (`getPopularTagList`), the service method name (`listMostPopular`), and the OpenAPI path (`/popular`) promise popularity-ordered selection. The UI surfaces the response as 'Top Tags'."
      implementation: "Pipeline: (1) TagController.getPopularTagList delegates to tagService.listMostPopular (line 42). (2) TagServiceImpl.listMostPopular delegates to reactiveTagRepository.listMostPopular (TagServiceImpl.java:75). (3) ReactiveTagRepositoryImpl.listMostPopular (lines 137-167): (a) builds `selectFrom(TAG).where(conditions)` (lines 144-145) — the base select has NO ordering; (b) wraps via `paginate(homogeneousQuery, [new OrderByField(TAG.ID, SortOrder.ASC)], (page - 1) * size, size)` (line 148) — this is the LIMITING step, ordering by TAG.ID ASC; (c) JooqQueryHelper.paginate (:63-90) emits SQL: `SELECT ... FROM (selectFrom(TAG).where(conditions)) u ORDER BY id ASC LIMIT size OFFSET offset`; (d) the resulting `tag_cte` contains the OLDEST `size` tags by TAG.ID; (e) `getDataEntityWithDatasetFields` (:373-392) unions tag_to_data_entity + tag_to_dataset_field counts OVER THE CTE ROWS ONLY; (f) outer cteSelect (lines 153-158) groups + sums and applies `.orderBy(field(COUNT_FIELD).desc())` — this re-orders the already-selected 30 by count DESC, but cannot reach the tags excluded by step (b)'s LIMIT."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "With more than `size` tags in the directory, the response contains the OLDEST `size` tags by creation order, NOT the `size` most-popular. The UI's 'Top Tags' label is operator-misleading. Maintainer's 2026-05-20 test (35 tags, every entity tagged by all 35) returned the OLDEST 30 by created_at ASC — empirical confirmation of the static trace."
      confidence: STATIC-INFERRED
      evidence: "TagController.java:37-44 + TagServiceImpl.java:72-77 + ReactiveTagRepositoryImpl.java:144-158 + JooqQueryHelper.java:63-90 (paginate semantics) + P-010 (runtime pin)"
    - name: "TagController.deleteTag (line 31)"
      promise: "Deletes a tag — by the method name + DELETE verb, the operator expects the tag and all its references to be removed."
      implementation: "Soft-deletes the `tag` row (UPDATE setting deleted_at = NOW()); hard-deletes `tag_to_term` + `tag_to_data_entity`; does NOT touch `tag_to_dataset_field` (TagServiceImpl.delete:57-70 + ReactiveTagRepositoryImpl.deleteDatasetFieldRelations defined at :299-306 but uncalled)."
      drift: MINOR
      operator_visible_consequence: "Tag disappears from UI on read (filtered by addSoftDeleteFilter) — but `tag_to_dataset_field` rows persist as orphans in DB. Reads via listDatasetFieldDtos filter them out (`:84-98`), so UI-invisible. The drift is database-visible only; orphan rows accumulate over delete cycles."
      confidence: STATIC-INFERRED
      evidence: "TagServiceImpl.java:64-66 + ReactiveTagRepositoryImpl.java:299-306"
  orderings:
    - location: "ReactiveTagRepositoryImpl.java:148 (inner paginate) + line 158 (outer cteSelect)"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer (the SQL the database executes)?"
          a: "Two-level ordering: (a) INNER `paginate(...)` emits `ORDER BY id ASC LIMIT size OFFSET offset` over `selectFrom(TAG).where(conditions)` — selects the OLDEST `size` tags by serial PK; (b) OUTER `cteSelect.orderBy(field(COUNT_FIELD).desc())` emits `ORDER BY count DESC` over the GROUPED-and-counted CTE rows — re-orders the already-selected `size` by count. The OUTER ordering does NOT affect WHICH rows are returned; only the INNER ordering does."
          confidence: STATIC-INFERRED
          evidence: "ReactiveTagRepositoryImpl.java:144-158 + JooqQueryHelper.java:63-90"
        - q: "What is the tie-breaker when sort-key values are equal?"
          a: "Inner: TAG.ID ASC is deterministic (id is a serial PK, never tied). Outer: `ORDER BY count DESC` has NO secondary sort key; equal-count rows are in PostgreSQL's implementation-defined order (typically heap-physical order, but plan-dependent). The maintainer's 2026-05-20 test (35 equal-count tags) reported the OLDEST 30 emerged — consistent with the INNER selection step's TAG.ID ASC selection, then the OUTER count-DESC being a stable no-op for equal counts."
          confidence: STATIC-INFERRED
          evidence: "ReactiveTagRepositoryImpl.java:148, 158 (no secondary OrderByField on outer)"
        - q: "Which subset is returned when result-set > page size?"
          a: "The FIRST `size` tags by TAG.ID ASC (the OLDEST). This is the LSN-019 drift. Operator-visible: 'Top Tags' surfaces the oldest, not the most-popular. P-010 pins this empirically."
          confidence: STATIC-INFERRED
          evidence: "ReactiveTagRepositoryImpl.java:148 + JooqQueryHelper.java:63-90 + maintainer's 2026-05-20 empirical reproduction (35 tags → oldest 30)"
        - q: "Does any upstream layer (UI, service) re-sort or filter the result?"
          a: "Service layer (TagServiceImpl.listMostPopular:72-77): no re-sort, only `.map(tagMapper::mapToTagsResponse)`. Controller (TagController.java:37-44): no re-sort. The UI (Catalog Overview / search-facet) renders `items` in the order delivered — no client-side re-sort observed in the React component (not read in this session; REFERENCE to the UI sidecar when enriched)."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:37-44 + TagServiceImpl.java:72-77 (no re-sort) + REFERENCE to ui_route:/management/tags + ui_route:Catalog-Overview Top-tags chip-strip"
  auth_gates:
    - location: "SecurityConstants.java:138-142 + TagController.java:36-44 (the gate-shaped absence)"
      endpoint: "GET /api/tags (getPopularTagList) + POST /api/tags (createTag) + PUT /api/tags/{tag_id} (updateTag) + DELETE /api/tags/{tag_id} (deleteTag)"
      questions:
        - q: "What does each endpoint return for DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "DISABLED: all four endpoints accessible without authentication — the auth.type=DISABLED branch skips Spring Security entirely (per `system-mission.md:251-265` auth-mode wiring); no SecurityRule applies. LOGIN_FORM / OAUTH2 / LDAP: identical — the SecurityRule chain attaches; GET /api/tags requires `authenticated()` only; POST/PUT/DELETE require the respective `TAG_*` permission. The three write endpoints are gated identically across LOGIN_FORM / OAUTH2 / LDAP because SECURITY_RULES is mode-agnostic; the policy is the same across modes that authenticate."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:138-142 + AuthorizationCustomizer.java:29-30 + REFERENCE to OAuthSecurityConfiguration / LoginFormSecurityConfiguration / LdapSecurityConfiguration / SecurityConfiguration"
        - q: "What does an unauthenticated caller see (no cookie / no token)?"
          a: "LOGIN_FORM / OAUTH2 / LDAP: 401 (or 302 redirect to login for LOGIN_FORM) on all four endpoints — the catch-all `pathMatchers(\"/**\").authenticated()` (AuthorizationCustomizer.java:29-30) blocks unauthenticated access regardless of SecurityRule presence. DISABLED: 200 on all four endpoints — no auth check."
          confidence: STATIC-INFERRED
          evidence: "AuthorizationCustomizer.java:29-30 (catch-all)"
        - q: "What does a wrong-role caller see (e.g. READ_ONLY hitting POST)?"
          a: "READ_ONLY-role user with NO `TAG_*` permissions: GET /api/tags returns 200 with full directory (the open-read posture). POST /api/tags returns 403 (missing TAG_CREATE). PUT /api/tags/{id} returns 403 (missing TAG_UPDATE). DELETE /api/tags/{id} returns 403 (missing TAG_DELETE). A user holding ONLY `DATA_ENTITY_TAGS_UPDATE`: same as above on this controller — but can mutate the directory via PUT /api/dataentities/{id}/tags (the side-door, gated by a different permission and a different controller)."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:138-142 + system-mission.md:251-265 (permission-enforcement architecture) + the side-door analysis in invariants"
        - q: "Where exactly does the gate live — controller, service, repository, or nowhere?"
          a: "Controller perimeter ONLY — via SecurityConstants.SECURITY_RULES path-pattern matching (controller annotation is NOT used; gates are path-pattern-matched in the security filter chain). Service tier (`TagServiceImpl.java:1-167`) has ZERO @PreAuthorize and ZERO programmatic permission checks. Repository tier has ZERO checks. The controller path-pattern IS the gate; any path-pattern drift (REFACTOR-217 class) would silently bypass."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:1-53 (no @PreAuthorize) + TagServiceImpl.java:1-167 (no @PreAuthorize, no permissionService) + SecurityConstants.java:138-142 (path-pattern entries)"
  resource_boundaries:
    - location: "TagServiceImpl.java:44-55 (update) + TagServiceImpl.java:57-70 (delete)"
      kind: transactional
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "Two concurrent PUT /api/tags/{id} with same id: both load via `getDto` (READ COMMITTED), both pass the `!external` filter, both call `update` — second update wins (last-write-wins). No optimistic-lock column; no row-level lock acquired. TOCTOU window between `getDto` and `update`. Two concurrent DELETE /api/tags/{id}: similar — both cascade hard-delete `tag_to_term` and `tag_to_data_entity`, then both soft-delete the tag (idempotent setting deleted_at twice = no corruption, but redundant work). Two concurrent POST /api/tags creating the same name: the `tag.name` unique index (per migration suite) protects — the second INSERT raises `UniqueConstraintException`."
          confidence: STATIC-INFERRED
          evidence: "TagServiceImpl.java:44-55, 57-70 (no @Lock, no optimistic-lock version column, no Postgres advisory lock) + ReactiveTagRepositoryImpl.java + ExceptionUtils.java:54-56 (UniqueConstraintException translation)"
        - q: "Is the call replay-safe?"
          a: "createTag: NOT replay-safe — fail-on-duplicate semantics raise UniqueConstraintException on retry (callers must handle 4xx as 'already created'). updateTag: idempotent on the same form-data (same input → same end state). deleteTag: idempotent (deleting an already-soft-deleted tag returns NotFoundException via getDto's switchIfEmpty — second call sees the tag as gone). getPopularTagList: idempotent and read-only."
          confidence: STATIC-INFERRED
          evidence: "TagServiceImpl.java:38-42, 44-55, 57-70 + getDto's NotFoundException behaviour line 47-48 + 60-61"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No cache fronts any of these endpoints — no @Cacheable annotation, no manual cache writes in TagServiceImpl or TagController, no platform-level cache layer visible. Every GET /api/tags is a fresh DB round-trip; every write hits the DB directly."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:1-53 + TagServiceImpl.java:1-167 (no @Cacheable, no cache references)"
    - location: "TagController.java:46-52 (updateTag flatMap chain)"
      kind: concurrency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "See update-tier entry above. Additionally: the `updateTag` controller passes through `Mono<TagFormData> tagFormData` from the request body; if Spring-WebFlux's reactive deserialiser splits the body across multiple network frames, the flatMap awaits completion before delegating. Single-request semantics; the corruption story is at the DB write tier."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:46-52"
        - q: "Is the call replay-safe?"
          a: "Idempotent on same input (covered above)."
          confidence: STATIC-INFERRED
          evidence: "TagServiceImpl.java:44-55"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No cache."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:1-53 (no @Cacheable)"
  probes_emitted:
    - probe_id: P-010
      question: "Name-behavior pair (TagController.getPopularTagList / TagServiceImpl.listMostPopular) — does the implementation actually order by popularity, or by TAG.ID ASC (= creation order)? Pins the LSN-019 drift permanently."
      probe_path: "lineage/odd-platform/probes/P-010.yaml"
  stress_summary:
    triggers_total: 8
    questions_total: 27
    answers_static_inferred: 26
    answers_probe_needed: 1
    answers_reference: 0
    drift_flags: 2
```

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` — the controller is on the HTTP UI / API surface. `DISABLED` skips auth entirely; `S2S` is orthogonal (S2S grants ADMIN per `system-mission.md:263`). The directory is not on the ingestion path — but is mutated via `ExternalTagIngestionRequestProcessor.process` (`:104`, gated by the S2S `IngestionDataEntitiesFilter`).
- **ingestion_filter_relevance**: `NO — UI/API surface at /api/tags/**, not /ingestion/**` for this controller. However: the global tag directory IS mutated by the ingestion path via `ExternalTagIngestionRequestProcessor.process` (`:104` → `getOrInjectTagByName` → `ingestData` upsert), gated by the S2S `IngestionDataEntitiesFilter` per `auth.ingestion.filter.enabled`. The reads via this controller's `getPopularTagList` reflect those mutations.
- **authorization_assertions**:
  - "POST `/api/tags` gated by `TAG_CREATE` (Management scope, NO_CONTEXT) — evidence: SecurityConstants.java:138"
  - "PUT `/api/tags/{tag_id}` gated by `TAG_UPDATE` (Management scope, NO_CONTEXT) — evidence: SecurityConstants.java:139-140"
  - "DELETE `/api/tags/{tag_id}` gated by `TAG_DELETE` (Management scope, NO_CONTEXT) — evidence: SecurityConstants.java:141-142"
  - "GET `/api/tags` has NO authorization gate beyond `authenticated()` — evidence: SecurityConstants.java:138-142 (no GET entry) + AuthorizationCustomizer.java:29-30 (catch-all)"
  - "All four endpoints inherit the service-tier zero-checks posture — no `@PreAuthorize` and no programmatic permission calls in `TagServiceImpl.java:1-167` — evidence: grep '@PreAuthorize\\|permissionService' TagServiceImpl.java returns zero"
- **owner_scoping**: `N/A — Tag directory has no owner concept`. No `tag.owner_id` column; no per-Owner Tag filtering anywhere. The directory is a flat, globally-shared namespace.
- **data_exposure**:
  - "`Mono<ResponseEntity<TagsResponse>>` from `getPopularTagList` → any authenticated user. Returns up to `size` tags labelled 'most popular' — but actually selected by TAG.ID ASC (LSN-019 drift). — evidence: TagController.java:36-44 + ReactiveTagRepositoryImpl.java:144-158"
  - "`Mono<ResponseEntity<Flux<Tag>>>` from `createTag` → caller holding `TAG_CREATE`. — evidence: TagController.java:22-28"
  - "`Mono<ResponseEntity<Tag>>` from `updateTag` → caller holding `TAG_UPDATE`. — evidence: TagController.java:46-52"
  - "No body from `deleteTag` (204). — evidence: TagController.java:30-34"
- **known_security_gaps**:
  - "Side-door directory growth — `DATA_ENTITY_TAGS_UPDATE` / `TERM_TAGS_UPDATE` / `DATASET_FIELD_TAGS_UPDATE` and S2S ingestion mint global Tag rows without `TAG_CREATE`. — evidence: TagService.java:24-26 + 5 call sites — severity: HIGH"
  - "Open-read posture on `getPopularTagList` — any authenticated user can enumerate the entire global tag directory. Live permissions page (WebFetched 2026-05-20) does NOT document this. — evidence: SecurityConstants.java:138-142 (no GET entry) + AuthorizationCustomizer.java:29-30 — severity: MEDIUM"
  - "Service-tier zero-checks posture — controller perimeter is SOLE authorisation defence; any path-pattern drift (REFACTOR-217 class) bypasses authorisation. — evidence: TagServiceImpl.java:1-167 — severity: MEDIUM"
  - "No request-body validation on tag-name shape — arbitrary content accepted; popular-tags surface renders to every user. — evidence: TagController.java:22-28 + TagServiceImpl.java:38-42 + openapi.yaml:370 — severity: LOW"
  - "No audit log on controller's write paths — `createTag` / `updateTag` / `deleteTag` produce NO Activity Feed entries. — evidence: TagController.java:22-52 + TagServiceImpl.java:31-167 + DataEntityServiceImpl.java:358 (the existing related @ActivityLog) — severity: MEDIUM"

## performance

- **hot_paths**:
  - "`getPopularTagList` runs on every UI page-load that renders tag-search-facets, the Catalog Overview Top-tags chip strip, the data-entity detail tag-dropdown, and the Management → Tags tab. Downstream `ReactiveTagRepositoryImpl.listMostPopular` (`:137-167`) executes a paginate(...) + UNION-ALL CTE over `tag_to_data_entity` + `tag_to_dataset_field`; LSN-019 drift means the SQL plan is doing more work than is operator-visible (CTE aggregates run over the WRONG rows). — evidence: TagController.java:36-44 + ReactiveTagRepositoryImpl.java:137-167 + JooqQueryHelper.java:63-90"
  - "`createTag` runs once per Management → Tags create action; bulk shape allows multiple tags per request. — evidence: TagController.java:22-28 + TagServiceImpl.java:38-42"
  - "`deleteTag` runs once per delete action; downstream FOUR sequential operations under one TX (getDto → !external → Flux.zip(deleteTermRelations + deleteDataEntityRelations) → delete → updateChangedTagVectors). — evidence: TagController.java:30-34 + TagServiceImpl.java:57-70"
  - "`updateTag` runs once per edit action; downstream FIVE operations including THREE concurrent search-vector updates via Mono.zip (heaviest per-update cost). — evidence: TagController.java:46-52 + TagServiceImpl.java:44-55, 161-167"
- **throughput_characteristics**:
  - "All four endpoints are reactive `Mono` / `Flux` — non-blocking; the underlying jOOQ-reactive PG driver releases the connection between awaits."
  - "`createTag` is bulk — multiple tags per request; the inherited `bulkCreate` partitions via `executeInPartitionReturning` at BATCH_SIZE."
  - "`updateTag` and `deleteTag` are single-tag — no bulk equivalent at the controller."
- **resource_allocation**:
  - "Memory: per-call allocations are small for normal use. `createTag` materialises the input flux to a list via `.collectList()` — for a 1000-tag batch the memory cost is the full list resident."
  - "DB connection: each method takes one connection per round-trip; `@ReactiveTransactional` on `delete` and `update` pins the connection for the multi-step pipeline."
  - "No client-side caching — every `getPopularTagList` is a fresh round-trip."
- **scaling_characteristics**:
  - "Stateless — controller has no per-call state."
  - "No row-level locking on the write paths — `update` and `delete` are read-then-write within `@ReactiveTransactional`; PostgreSQL's READ COMMITTED means concurrent updates to the same tag could race (TOCTOU between `getDto` and `update`/`delete`)."
  - "`getPopularTagList` has no `size` cap — `size=100000` is permitted at the controller; forces a full-directory aggregate. — evidence: TagController.java:37-42 + ReactiveTagRepositoryImpl.java:138-167 (no clamp)"
- **known_performance_gaps**:
  - "`getPopularTagList` UNION-ALL CTE runs on every popular-tags fetch; for very large directories, the per-tag UNION-ALL across `tag_to_data_entity` + `tag_to_dataset_field` is expensive. No materialized view; no caching layer; no `EXPLAIN`-anchored benchmark in the test suite. The LSN-019 drift compounds the cost — the CTE aggregates over rows that won't be the operator-meaningful response. — evidence: ReactiveTagRepositoryImpl.java:137-167, 373-392 — severity: LOW"
  - "No `size` parameter clamp on `getPopularTagList` — `size=100000` is permitted at the controller layer. — evidence: TagController.java:37-42 — severity: LOW"
  - "`updateTag` runs three concurrent search-vector update queries on EVERY tag edit (`TagServiceImpl.java:162-167`) — even if the edit is a trivial `important` flag flip with no name change. — evidence: TagServiceImpl.java:44-55, 161-167 — severity: LOW"

## upstream_callers

- entry_point: "rest:GET /api/tags"
  caller_node: "rest_api:openapi-generated TagApi.getPopularTagList"
  multiplicity_per_trigger: 1
  evidence: "TagController.java:36-44 + the OpenAPI-generated TagApi interface (`api.contract.api.TagApi`)"
  observation_class: rest-call
  unresolved: false

- entry_point: "ui_route:/management/tags (Management → Tags tab)"
  caller_node: "ts react-component:TagsList.tsx (per existing batch-N audience analysis; not read in this session)"
  multiplicity_per_trigger: unresolved
  evidence: "TagController.java:36-44 + system-mission.md:240 (P-08 Tags tab); the UI dispatch multiplicity is REFERENCE — see ui_route:TagsList.tsx sidecar (not yet enriched)"
  observation_class: ui-call
  unresolved: true

- entry_point: "ui_route:catalog-overview (Top-tags chip strip)"
  caller_node: "ts react-component:Overview.tsx (per LSN-017 / batch-W references)"
  multiplicity_per_trigger: unresolved
  evidence: "TagController.java:36-44 + REFERENCE to ui_route:catalog-overview sidecar (not yet enriched in this session)"
  observation_class: ui-call
  unresolved: true

- entry_point: "ui_route:data-entity-detail (tag-dropdown surface)"
  caller_node: "ts react-component:DataEntityDetails.tsx (tag picker)"
  multiplicity_per_trigger: unresolved
  evidence: "TagController.java:36-44 + system-mission.md:96 (Manual Object Tagging surfaces) + REFERENCE to ui_route:DataEntityDetails sidecar"
  observation_class: ui-call
  unresolved: true

- entry_point: "rest:POST /api/tags"
  caller_node: "rest_api:openapi-generated TagApi.createTag"
  multiplicity_per_trigger: 1
  evidence: "TagController.java:22-28"
  observation_class: rest-call
  unresolved: false

- entry_point: "rest:PUT /api/tags/{tag_id}"
  caller_node: "rest_api:openapi-generated TagApi.updateTag"
  multiplicity_per_trigger: 1
  evidence: "TagController.java:46-52"
  observation_class: rest-call
  unresolved: false

- entry_point: "rest:DELETE /api/tags/{tag_id}"
  caller_node: "rest_api:openapi-generated TagApi.deleteTag"
  multiplicity_per_trigger: 1
  evidence: "TagController.java:30-34"
  observation_class: rest-call
  unresolved: false

## downstream_side_effects

- side_effect_class: page-render
  description: "Returns `TagsResponse` payload to the caller (items + pageInfo); LSN-019 drift means the items are the OLDEST `size` tags by id, not the most-popular."
  evidence: "TagController.java:36-44 + ReactiveTagRepositoryImpl.java:144-158"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "rest:GET /api/tags"
    - "ui_route:/management/tags"
    - "ui_route:catalog-overview"
    - "ui_route:data-entity-detail"

- side_effect_class: db-write
  description: "INSERT N rows into `tag` table per `createTag` bulk; each new tag becomes immediately readable to every authenticated user via `getPopularTagList`."
  evidence: "TagController.java:22-28 + TagServiceImpl.java:38-42 + ReactiveAbstractCRUDRepository.bulkCreate"
  cardinality_per_call: "N (input list size)"
  reachable_from_entry_points:
    - "rest:POST /api/tags"
    - "ui_route:/management/tags (create dialog)"

- side_effect_class: db-write
  description: "UPDATE one row in `tag` table per `updateTag` (rename / important-flag toggle) + THREE concurrent UPDATE queries against search_entrypoint, search_entrypoint_structure, and term_search_entrypoint (search vector reindex)."
  evidence: "TagController.java:46-52 + TagServiceImpl.java:44-55, 161-167"
  cardinality_per_call: 4
  reachable_from_entry_points:
    - "rest:PUT /api/tags/{tag_id}"
    - "ui_route:/management/tags (edit dialog)"

- side_effect_class: db-write
  description: "SOFT-delete one row in `tag` (UPDATE deleted_at = NOW()) + HARD-delete tag_to_term + HARD-delete tag_to_data_entity rows. Does NOT delete `tag_to_dataset_field` rows (cascade asymmetry — orphans persist invisibly)."
  evidence: "TagController.java:30-34 + TagServiceImpl.java:57-70 + ReactiveTagRepositoryImpl.java:235-241, 280-286 + (gap: ReactiveTagRepositoryImpl.java:299-306 deleteDatasetFieldRelations defined but uncalled)"
  cardinality_per_call: "1 + N (tag_to_term rows) + M (tag_to_data_entity rows); tag_to_dataset_field rows NOT deleted"
  reachable_from_entry_points:
    - "rest:DELETE /api/tags/{tag_id}"
    - "ui_route:/management/tags (delete dialog)"

- side_effect_class: db-write
  description: "Search vector reindex on delete — `reactiveTermSearchEntrypointRepository.updateChangedTagVectors(tagId)` runs after soft-delete."
  evidence: "TagServiceImpl.java:68-69"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "rest:DELETE /api/tags/{tag_id}"

## sources

- understanding ← TagController.java:1-53 (full file) + TagService.java:14-36 + TagServiceImpl.java:1-167 + ReactiveTagRepositoryImpl.java:137-167, 373-392 + JooqQueryHelper.java:63-90 + SecurityConstants.java:138-142 + AuthorizationCustomizer.java:20-30 + retrospectives/LSN-019-name-vs-behavior-drift.md
- concepts.entities.TagApi ← TagController.java:5, 18 + openapi.yaml:342-423
- concepts.entities.TagFormData ← TagController.java:7
- concepts.entities.Flux<TagFormData> ← TagController.java:23
- concepts.entities.Tag ← TagController.java:6
- concepts.entities.TagsResponse ← TagController.java:8
- concepts.entities.TagService ← TagController.java:9, 20 + TagService.java:14-36
- concepts.entities.ServerWebExchange ← TagController.java:12, 24, 31, 41, 49
- concepts.entities.tagId ← TagController.java:31, 47
- concepts.entities.page-size-query-ids ← TagController.java:37-41 + ReactiveTagRepositoryImpl.java:148
- concepts.operations.createTag ← TagController.java:22-28 + TagServiceImpl.java:38-42 + SecurityConstants.java:138 + openapi.yaml:372
- concepts.operations.deleteTag ← TagController.java:30-34 + TagServiceImpl.java:57-70 + SecurityConstants.java:141-142 + ReactiveTagRepositoryImpl.java:235-241, 280-286 + ReactiveTagRepositoryImpl.java:299-306 (missing cascade)
- concepts.operations.getPopularTagList ← TagController.java:36-44 + TagServiceImpl.java:72-77 + ReactiveTagRepositoryImpl.java:137-167, 373-392 + JooqQueryHelper.java:63-90 + SecurityConstants.java:138-142 (no GET entry)
- concepts.operations.updateTag ← TagController.java:46-52 + TagServiceImpl.java:44-55 + SecurityConstants.java:139-140 + openapi.yaml:400
- concepts.invariants[thin-delegate] ← TagController.java:22-52
- concepts.invariants[LSN-019-name-vs-behavior] ← TagController.java:37-44 + TagServiceImpl.java:72-77 + ReactiveTagRepositoryImpl.java:144-158 + JooqQueryHelper.java:63-90 + retrospectives/LSN-019-name-vs-behavior-drift.md + maintainer empirical test 2026-05-20
- concepts.invariants[no-RBAC-on-getPopularTagList] ← SecurityConstants.java:138-142 + AuthorizationCustomizer.java:29-30
- concepts.invariants[NO_CONTEXT-management-scope] ← SecurityConstants.java:138-142 + PolicyPermissionDto.java:62-64
- concepts.invariants[service-tier-zero-checks] ← TagServiceImpl.java:1-167
- concepts.invariants[side-door-bypass] ← TagService.java:24, 26 + TagServiceImpl.java:79-94 + TermServiceImpl.java:257 + DatasetFieldServiceImpl.java:202, 266 + ExternalTagIngestionRequestProcessor.java:104
- concepts.invariants[status-code-drift] ← TagController.java:27, 51 + openapi.yaml:372, 400
- concepts.invariants[cascade-asymmetry] ← TagServiceImpl.java:64-66 + ReactiveTagRepositoryImpl.java:299-306
- concepts.invariants[!external-guard] ← TagServiceImpl.java:49-50, 62-63
- dependencies_semantic.requires-feature.TagApi ← TagController.java:5, 18
- dependencies_semantic.requires-feature.TagService ← TagController.java:9, 20
- dependencies_semantic.requires-feature.SecurityConstants ← SecurityConstants.java:138-142
- dependencies_semantic.requires-feature.AuthorizationCustomizer ← AuthorizationCustomizer.java:20-30
- dependencies_semantic.requires-runtime ← TagController.java:10-14 + line 16
- dependencies_semantic.couples-to ← TagController.java:18 + line 20
- tests_coverage_semantic.test_files ← TagRepositoryImplTest.java:237-267 (read end-to-end this session; structurally blind to LSN-019)
- tests_coverage_semantic.uncovered_behaviours[LSN-019] ← TagController.java:37-44 + TagRepositoryImplTest.java:237-267 (containsExactlyInAnyOrder + size=numberOfTestTags = no LIMIT exercise)
- docs_link_semantic.inferred_docs[0] ← WebFetch 2026-05-20 (inherited from batch-W TagController sidecar at status 200; within stale-probe 11-day window)
- docs_link_semantic.inferred_docs[1] ← WebFetch 2026-05-20 (inherited from batch-W; status 200; within stale-probe window)
- docs_link_semantic.doc_drift_findings[LSN-019] ← TagController.java:37-44 + ReactiveTagRepositoryImpl.java:148, 158 + JooqQueryHelper.java:63-90 + retrospectives/LSN-019 + maintainer 2026-05-20 empirical test
- docs_link_semantic.doc_drift_findings[side-door] ← WebFetch result (live page does not document side-door) + REFACTOR-223 evidence chain
- docs_link_semantic.doc_drift_findings[cascade] ← WebFetch result + TagServiceImpl.java:64-65 + ReactiveTagRepositoryImpl.java:299-306
- docs_link_semantic.doc_drift_findings[open-read] ← WebFetch result + SecurityConstants.java:138-142
- docs_link_semantic.doc_drift_findings[status-code] ← openapi.yaml:372, 400 + TagController.java:27, 51
- implicit_adrs[thin-delegate] ← TagController.java:18, 22-52
- implicit_adrs[read-collaborative] ← SecurityConstants.java:138-142 + AuthorizationCustomizer.java:29-30
- implicit_adrs[management-scope-only] ← SecurityConstants.java:138-142 + PolicyPermissionDto.java:62-64
- implicit_adrs[!external-guard] ← TagServiceImpl.java:49-50, 62-63
- implicit_adrs[bulk-explicit-vs-upsert-side-door] ← TagController.java:22-28 + TagService.java:16, 24
- bugs_limitations_corner_cases[LSN-019-popular-drift] ← TagController.java:37-44 + ReactiveTagRepositoryImpl.java:144-158 + JooqQueryHelper.java:63-90 + maintainer 2026-05-20 test + P-010
- bugs_limitations_corner_cases[status-code-drift-createTag] ← TagController.java:27 + openapi.yaml:372
- bugs_limitations_corner_cases[status-code-drift-updateTag] ← TagController.java:51 + openapi.yaml:400
- bugs_limitations_corner_cases[cascade-asymmetry] ← TagServiceImpl.java:57-70 + ReactiveTagRepositoryImpl.java:299-306
- bugs_limitations_corner_cases[open-read-getPopular] ← SecurityConstants.java:138-142 + AuthorizationCustomizer.java:29-30
- bugs_limitations_corner_cases[side-door-directory-growth] ← TagController.java:23 + TagService.java:24, 26 + 5 call sites
- bugs_limitations_corner_cases[service-tier-zero-checks] ← TagServiceImpl.java:1-167
- bugs_limitations_corner_cases[no-validation] ← TagController.java:22-28 + TagServiceImpl.java:38-42 + openapi.yaml:370
- bugs_limitations_corner_cases[nested-reactive-response] ← TagController.java:23 + openapi.yaml:377
- bugs_limitations_corner_cases[no-audit-log] ← TagController.java:22-52 + TagServiceImpl.java:31-167 + DataEntityServiceImpl.java:358
- stress_findings.tunables[size] ← TagController.java:38 + ReactiveTagRepositoryImpl.java:138-167 + JooqQueryHelper.java:63-90
- stress_findings.tunables[OrderByField TAG.ID ASC] ← ReactiveTagRepositoryImpl.java:148
- stress_findings.name_behavior_pairs[getPopularTagList] ← TagController.java:37-44 + TagServiceImpl.java:72-77 + ReactiveTagRepositoryImpl.java:144-158 + JooqQueryHelper.java:63-90 + maintainer 2026-05-20 empirical test + P-010
- stress_findings.name_behavior_pairs[deleteTag] ← TagServiceImpl.java:64-66 + ReactiveTagRepositoryImpl.java:299-306
- stress_findings.orderings ← ReactiveTagRepositoryImpl.java:144-158 + JooqQueryHelper.java:63-90
- stress_findings.auth_gates ← SecurityConstants.java:138-142 + AuthorizationCustomizer.java:29-30 + TagController.java:1-53 + TagServiceImpl.java:1-167
- stress_findings.resource_boundaries ← TagServiceImpl.java:44-55, 57-70 + TagController.java:46-52
- stress_findings.probes_emitted ← lineage/odd-platform/probes/P-010.yaml
- security.auth_mode_relevance ← TagController.java:1-53 + SecurityConstants.java:138-142
- security.ingestion_filter_relevance ← ExternalTagIngestionRequestProcessor.java:104
- security.authorization_assertions ← SecurityConstants.java:138-142 + AuthorizationCustomizer.java:29-30 + TagServiceImpl.java:1-167
- security.owner_scoping ← (no `tag.owner_id` column per batch-N invariant) + SecurityConstants.java:138-142
- security.data_exposure ← TagController.java:22-52 + ReactiveTagRepositoryImpl.java:144-158
- security.known_security_gaps[side-door] ← TagService.java:24, 26 + 5 call sites
- security.known_security_gaps[open-read] ← SecurityConstants.java:138-142 + AuthorizationCustomizer.java:29-30
- security.known_security_gaps[service-tier-zero-checks] ← TagServiceImpl.java:1-167
- security.known_security_gaps[no-validation] ← TagController.java:22-28 + TagServiceImpl.java:38-42 + openapi.yaml:370
- security.known_security_gaps[no-audit-log] ← TagController.java:22-52 + TagServiceImpl.java:31-167 + DataEntityServiceImpl.java:358
- performance.hot_paths[getPopularTagList] ← TagController.java:36-44 + ReactiveTagRepositoryImpl.java:137-167 + JooqQueryHelper.java:63-90
- performance.hot_paths[createTag/deleteTag/updateTag] ← TagController.java:22-28, 30-34, 46-52 + TagServiceImpl.java:38-42, 44-55, 57-70
- performance.throughput_characteristics ← TagController.java:22-52
- performance.resource_allocation ← TagController.java:22-28 + TagServiceImpl.java:38-42
- performance.scaling_characteristics ← TagServiceImpl.java:44-55, 57-70 + TagController.java:37-42
- performance.known_performance_gaps[UNION-ALL CTE] ← ReactiveTagRepositoryImpl.java:137-167, 373-392 + JooqQueryHelper.java:63-90
- performance.known_performance_gaps[no-size-clamp] ← TagController.java:37-42
- performance.known_performance_gaps[triple-vector-update] ← TagServiceImpl.java:44-55, 161-167
- upstream_callers ← TagController.java:22-52 + system-mission.md:96, 240 + REFERENCE entries for unresolved UI sidecars
- downstream_side_effects ← TagController.java:22-52 + TagServiceImpl.java:38-42, 44-55, 57-70, 161-167 + ReactiveTagRepositoryImpl.java:144-158

## confidence_per_field

- understanding: HIGH (full 53-line file read; every method shape traced to TagApi + TagService + downstream JOOQ chain; LSN-019 drift statically traced through JooqQueryHelper.paginate semantics; SecurityConstants wiring verified; side-door framing confirmed)
- concepts: HIGH (every entity / operation / invariant / audience traced to source file or 1-hop neighbour)
- dependencies_semantic: HIGH (TagApi + TagService + SecurityConstants + AuthorizationCustomizer all read at file:line)
- tests_coverage_semantic: HIGH (zero tests for this controller confirmed by grep; TagRepositoryImplTest.testListMostPopular read in full — structurally blind to LSN-019 confirmed)
- docs_link_semantic: MEDIUM (inferred URLs not freshly WebFetched this session; inherited verifications from batch-W sidecar at status 200, within stale-probe 11-day window per established pattern; the live page content quoted is from the inherited fetch, not a fresh fetch)
- implicit_adrs: HIGH (five implicit ADRs each with intent_anchor evidence)
- bugs_limitations_corner_cases: HIGH (ten concerns each anchored at file:line; the LSN-019 finding now correctly cited as the load-bearing operator-observable drift)
- security: HIGH (auth-mode relevance + ingestion-filter relevance + 4 authorisation assertions verified at SecurityConstants line refs; owner-scoping N/A confirmed; data-exposure traced to response shapes including the LSN-019 misnaming)
- performance: MEDIUM (hot-paths clear; the LSN-019 angle on UNION-ALL CTE cost is a new compounding observation; no EXPLAIN this session)
- upstream_callers: MEDIUM (4 REST entry-points anchored; 3 UI-route entry-points recorded as REFERENCE with unresolved: true pending UI sidecar enrichment)
- downstream_side_effects: HIGH (5 side-effect classes each anchored at file:line with cardinality and entry-point reachability)
- stress_findings: HIGH (8 triggers, 27 questions; 26 STATIC-INFERRED with strong file:line + JOOQ chain evidence; 1 PROBE-NEEDED for null/negative tunable variants — out-of-scope of the LSN-019 canary; the load-bearing LSN-019 name-vs-behavior drift is STATIC-INFERRED via the full JOOQ trace and PROBE-EMITTED via P-010 for permanent regression-pin; honest confidence_overall downgraded to MEDIUM because the LSN-019 drift's empirical confirmation is via maintainer's hand-run, not yet via probe-runner — the probe is pending-stress-protocol)

## Maintainer notes


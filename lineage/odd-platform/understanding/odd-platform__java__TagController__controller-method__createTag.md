---
node_id: "odd-platform java TagController controller-method:createTag"
node_kind: controller-method
axis: controllers
extracted_at_commit: 9ac6436e9bd36ba132d765076c6bbd5916fde729
enriched_at_commit: 9ac6436e9bd36ba132d765076c6bbd5916fde729
extractor_version: 0.1.0
prompt_version: file-analyser/0.5.0
schema_version: v0.5.0
enrichment_status: complete
confidence_overall: HIGH
session_id: ontology-rev2-sprint-2026-05-21-TAGGING-batch
stress_protocol_applied: true
pillar_anchored_features:
  - P-01:F-018 Manual Object Tagging
  - P-08 Management & Administration (Tags tab)
  - P-09 Security & Access Control
---

# TagController.createTag — semantic understanding

## understanding

`createTag` is the `POST /api/tags` endpoint method of `TagController` — a
3-line reactive delegation (`TagController.java:22-28`) that `.collectList()`s
the inbound `Flux<TagFormData>` bulk body, hands the materialised list to
`tagService.bulkCreate`, and wraps the resulting `Flux<Tag>` in
`ResponseEntity::ok`. It is the **dedicated, RBAC-gated tag-vocabulary create
route** — gated at the controller perimeter by `TAG_CREATE` (Management scope,
`NO_CONTEXT`) per the `TagController` controller-class sidecar; this is the
endpoint the live docs describe as "Create a new tag in the catalog vocabulary"
(WebFetch 2026-05-21, status 200). The actual create work is `bulkCreate`'s
inherited `ReactiveAbstractCRUDRepository.bulkCreate` (`:114-126`): a single
`insertManyReturning` INSERT under `@ReactiveTransactional` with **no
`ON CONFLICT` clause** — so it is **fail-on-duplicate, not upsert**: a name
already present in the directory (caught by the partial unique index
`tag_name_unique`) translates to `UniqueConstraintException("Tag with this name
already exists")`. Two surfaces a careful operator should know: (1) this
endpoint returns HTTP 200 but the OpenAPI spec declares 201 (`openapi.yaml:372`)
— status-code drift; (2) `createTag` is NOT the only way to mint `tag`
directory rows — four side-door paths (`TermServiceImpl`, `DataEntityServiceImpl`,
`DatasetFieldServiceImpl`, `ExternalTagIngestionRequestProcessor`) reach
`tagService.getOrCreateTagsByName` / `getOrInjectTagByName` and create directory
rows WITHOUT holding `TAG_CREATE` (REFACTOR-223 / DOC-GAP-168).

## concepts

- entities: [
    "`TagFormData` (OpenAPI) — the per-tag input shape: `{ name: string (required), important: boolean }` (`components.yaml:337-345`). The element type inside the bulk array.",
    "`BulkTagFormData` (OpenAPI) — `type: array, items: TagFormData` (`components.yaml:347-350`); the declared request-body schema for `POST /api/tags` (`openapi.yaml:370`). The controller receives it as a reactive `Flux<TagFormData>` (`TagController.java:23`).",
    "`Flux<TagFormData> tagFormData` — the reactive request-body parameter (`TagController.java:23`); `.collectList()` materialises the whole batch before delegation.",
    "`Tag` (OpenAPI) — the per-element response shape inside `Flux<Tag>`: `id, name, important, external, usedCount`; produced by `tagMapper.mapToTag(TagPojo)` (`TagMapper.java:26`).",
    "`TagList` (OpenAPI) — the spec-declared response schema (`openapi.yaml:377`) — a STATIC array; the controller returns `Flux<Tag>` (a nested reactive shape) instead.",
    "`TagPojo` — the jOOQ row pojo (`tag` table: `id, name, important, created_at, updated_at, deleted_at`); `TagFormData` maps to it via `tagMapper.mapToPojo` (`TagMapper.java:19`, `TagServiceImpl.java:39`).",
    "`TagService` — the single injected service bean (`TagController.java:20`); `createTag` invokes exactly one of its methods, `bulkCreate` (`TagService.java:16`).",
    "`ServerWebExchange exchange` — the reactive request context parameter (`TagController.java:24`); injected but UNUSED by the method body — pure delegation."
  ]
- operations: [
    "`createTag(Flux<TagFormData> tagFormData, ServerWebExchange exchange)` (`TagController.java:22-28`) — bulk tag-vocabulary create. Chain: `tagFormData.collectList()` -> `.map(tagService::bulkCreate)` -> `.map(ResponseEntity::ok)`. Returns `Mono<ResponseEntity<Flux<Tag>>>` with HTTP 200.",
    "delegates to `TagServiceImpl.bulkCreate(List<TagFormData>)` (`TagServiceImpl.java:37-42`) — `tags.stream().map(tagMapper::mapToPojo).toList()` then `reactiveTagRepository.bulkCreate(pojos).map(tagMapper::mapToTag)`. NO `@ReactiveTransactional` at the service layer.",
    "delegates transitively to inherited `ReactiveAbstractCRUDRepository.bulkCreate(Collection<P>)` (`:114-126`) — `@ReactiveTransactional`; empty-collection short-circuit to `Flux.just()` (`:115-117`); else stamps `DateTimeUtil.generateNow()`, builds records, emits `insertManyReturning` — a single multi-row `INSERT ... RETURNING *` with NO `ON CONFLICT` clause.",
    "fail-on-duplicate: a `name` collision with a non-deleted directory row hits the partial unique index `tag_name_unique` (`V0_0_64__remove_is_deleted_field.sql:105`); jOOQ's `DataAccessException` is mapped by `JooqReactiveOperations` to `UniqueConstraintException(\"Tag with this name already exists\")` per `ExceptionUtils.java:54-56` (cited via the `ReactiveTagRepositoryImpl` sidecar's E2 stress finding)."
  ]
- invariants: [
    "The method body is a 3-line reactive delegation — zero business logic, zero programmatic auth check, zero transformation; a pure stub-implementation of `TagApi.createTag`.",
    "Authorisation is enforced ONLY at the controller perimeter via `SecurityConstants.SECURITY_RULES` path-pattern matching (`POST /api/tags` -> `TAG_CREATE`, per the `TagController` controller-class sidecar `SecurityConstants.java:138`). There is no `@PreAuthorize` on the method and no programmatic permission check in `TagServiceImpl` (`:1-167`, verified zero by the `TagServiceImpl` sidecar).",
    "`bulkCreate` is fail-on-duplicate, NOT upsert — the inherited repository method has no `ON CONFLICT` clause (`ReactiveAbstractCRUDRepository.java:114-126`). This is the deliberate counterpart to the upsert-shaped `getOrInjectTagByName` (`TagServiceImpl.java:88-94`) used by the Collector path.",
    "The transactional boundary for the create is the INHERITED `@ReactiveTransactional` on `ReactiveAbstractCRUDRepository.bulkCreate` (`:113`); neither `TagController.createTag` nor `TagServiceImpl.bulkCreate` carries the annotation.",
    "An empty bulk body (`[]`) is accepted: `ReactiveAbstractCRUDRepository.bulkCreate` short-circuits to `Flux.just()` (`:115-117`) -> HTTP 200 with an empty `Flux<Tag>`.",
    "New tags are created with `external` unset (defaults to false at the DB level) — `bulkCreate` never sets the `external` flag; it is `TagFormData`-driven and `TagFormData` has only `name` + `important`. The `external = true` rows come only from the Collector path, not from this endpoint.",
    "Status-code drift: the method returns HTTP 200 via `ResponseEntity::ok` (`TagController.java:27`); the OpenAPI operation declares `'201'` (`openapi.yaml:372`).",
    "Response-shape drift: the method returns `Flux<Tag>` (nested reactive); the OpenAPI operation declares `TagList` — a static array (`openapi.yaml:377`)."
  ]
- audiences: [
    "odd-platform-ui-end-user — the Management -> Tags tab 'create tag' action (the live docs' 'create the canonical tag list' surface).",
    "odd-api-consumer — programmatic clients calling `POST /api/tags` per the OpenAPI spec.",
    "platform-operator — the RBAC author who must grant `TAG_CREATE` for this endpoint to be reachable.",
    "Tag directory readers (indirectly) — every authenticated user; tags created here become visible via `getPopularTagList` (`GET /api/tags`), which has no RBAC gate beyond `authenticated()`."
  ]

## dependencies_semantic

- requires-feature: [
    "`TagApi` OpenAPI-generated controller interface — `createTag` is an `@Override` of the generated method (`TagController.java:22`).",
    "`TagService.bulkCreate` (`TagService.java:16`) — the single service method this endpoint invokes.",
    "`TagMapper.mapToPojo` + `TagMapper.mapToTag` (`TagMapper.java:19, 26`) — `TagFormData` -> `TagPojo` on the way in, `TagPojo` -> `Tag` on the way out.",
    "`ReactiveAbstractCRUDRepository.bulkCreate` (`:114-126`) — the inherited create primitive; carries the `@ReactiveTransactional` boundary.",
    "`SecurityConstants.SECURITY_RULES` (`SecurityConstants.java:138`) — the `POST /api/tags` -> `TAG_CREATE` entry; the absence of a method-level annotation makes this load-bearing.",
    "Partial unique index `tag_name_unique` (`V0_0_64__remove_is_deleted_field.sql:105`) — the DB-level uniqueness enforcement that turns a duplicate name into `UniqueConstraintException`."
  ]
- requires-config: [] — N/A. The method reads no Spring properties; behaviour is unconditional.
- requires-runtime: [
    "Spring WebFlux reactive HTTP server — `@RestController` on the enclosing class (`TagController.java:16`); reactive `Mono` / `Flux` throughout.",
    "Spring Reactive Transaction Manager (`reactiveTransactionManager` bean) — required for the inherited `@ReactiveTransactional` on `bulkCreate` to obtain an R2DBC TX.",
    "`reactor.core.publisher.Mono` / `Flux` — `collectList()`, `map()`.",
    "jOOQ reactive (`JooqReactiveOperations`) + PostgreSQL — `insertManyReturning` multi-row INSERT.",
    "Spring Security ReactiveSecurityWebFilterChain — composed via `OAuthSecurityConfiguration` / `LoginFormSecurityConfiguration` / `LdapSecurityConfiguration` / `SecurityConfiguration`; evaluates the `TAG_CREATE` SecurityRule."
  ]
- couples-to: [
    "`TagApi.createTag` — the generated interface method signature; a regen with a different signature would force this method to change.",
    "`TagService` interface — constructor-injected (`TagController.java:20`).",
    "`SecurityConstants.SECURITY_RULES` — coupled by URL convention (path-pattern match, not a code reference); a path rename of `/api/tags` would silently un-gate the endpoint (REFACTOR-217 drift class).",
    "the inherited `ReactiveAbstractCRUDRepository.bulkCreate` — `TagServiceImpl.bulkCreate` has no `@ReactiveTransactional` of its own; if `ReactiveTagRepositoryImpl` ever overrode `bulkCreate` without re-declaring the annotation, this endpoint would silently lose its TX boundary."
  ]

## tests_coverage_semantic

- covered_behaviours: [] — No test exercises `TagController.createTag`. `grep TagController <odd-platform-repo>/odd-platform-api/src/test` returns zero matches (recorded in the `TagController` controller-class sidecar). The `TagServiceImpl` sidecar verified via two Globs that NO `TagServiceImplTest.java` exists. The only adjacent coverage is repository-layer `TagRepositoryImplTest` — `testBulkCreateTag` (`:52-67`, happy path, all names present) and `testCreateTagPojo` (`:30-44`) per the `ReactiveTagRepositoryImpl` sidecar; neither exercises the controller perimeter, the `TAG_CREATE` gate, the duplicate-name failure mode, or the status-code drift.
- uncovered_behaviours:
    - behaviour: "`createTag` happy path — POST `/api/tags` with a valid bulk payload of novel names; assert each returned `Tag` has an assigned `id` and the payload's `name`/`important` round-trip."
      test_class: integration
      criticality: HIGH
      note: "No `TagControllerTest.java` exists; the controller perimeter is unverified end-to-end."
    - behaviour: "`createTag` duplicate-name failure (cross-batch) — POST a name that already exists in the directory; assert `UniqueConstraintException` translates to a 4xx, not a 500."
      test_class: integration
      criticality: HIGH
      note: "Pinned by P-026 (atomicity + status-code)."
    - behaviour: "`createTag` in-batch duplicate — POST `[{\"name\":\"a\"},{\"name\":\"a\"}]`; assert atomic rollback (zero rows created) and a 4xx."
      test_class: integration
      criticality: HIGH
      note: "Pinned by P-026. The risk: a partial-commit outcome would be a silent data-shape bug."
    - behaviour: "`createTag` status-code drift — assert the controller returns HTTP 200 while the OpenAPI spec declares 201; codifies the drift until the spec or controller is reconciled."
      test_class: integration
      criticality: MEDIUM
    - behaviour: "`createTag` empty body — POST `[]`; assert HTTP 200 with an empty list (no error)."
      test_class: integration
      criticality: LOW
      note: "Statically determinable via `ReactiveAbstractCRUDRepository.java:115-117`."
    - behaviour: "`createTag` authorisation enforcement — a caller WITHOUT `TAG_CREATE` (e.g. holding only `DATA_ENTITY_TAGS_UPDATE`) gets 403."
      test_class: security
      criticality: HIGH
    - behaviour: "`createTag` unauthenticated — no cookie / no token gets 401 (or 302 for LOGIN_FORM); under `auth.type=DISABLED` the endpoint is reachable unauthenticated."
      test_class: security
      criticality: MEDIUM
    - behaviour: "`createTag` tag-name validation absence — POST `{\"name\":\"\"}` / whitespace-only / very long names; assert whatever behaviour exists (currently: accepted, no validation)."
      test_class: integration
      criticality: LOW
    - behaviour: "`createTag` audit absence — assert no Activity Feed entry is produced by a tag-create; codifies the current behaviour (the directory-vocabulary write path is not activity-logged)."
      test_class: integration
      criticality: MEDIUM
- test_files:
    - "odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/TagRepositoryImplTest.java:52-67 (`testBulkCreateTag` — repository-layer happy path; per the `ReactiveTagRepositoryImpl` sidecar's covered_behaviours, exercises the all-names-present case only — no duplicate, no controller perimeter, no auth)"
- gaps: |
    Coverage of `createTag` is zero at the controller and service layers; only
    the repository-layer happy path is touched. The highest-leverage gap is the
    **in-batch / cross-batch duplicate atomicity** (the integration class) —
    P-026 pins it; converting P-026 into a Testcontainers `@SpringBootTest`
    would put the data-shape contract permanently under CI. The second is the
    **`TAG_CREATE` authorisation test** (the security class) — no
    `TagControllerSecurityTest` exists, so a `SecurityConstants` path-pattern
    drift (REFACTOR-217 class) that un-gates `POST /api/tags` would not surface
    in CI. The integration class has the worst coverage; the duplicate-atomicity
    gap is the highest-leverage one because a partial-commit regression is both
    silent and operator-visible (a failed batch that left rows behind).

## docs_link_semantic

- declared_docs: [] — No `@docs` annotation in `TagController.java`. Verified via Grep for `@docs` returning zero matches in the file.
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/tagging"
    anchor: ""
    rationale: "Operator-facing Tag UX page — describes the Management -> Tags vocabulary-curation surface that `createTag` backs, and names the `TAG_CREATE` permission."
    last_verified_at: "2026-05-21T00:00:00Z"
    last_verified_status: 200
    fetched_excerpts: |
      Live-page text (WebFetch 2026-05-21, status 200): Management -> Tags is
      where operators "create the canonical tag list, set the Important flag
      where appropriate, and govern the vocabulary across teams." The
      `TAG_CREATE` permission grants the action "Create a new tag in the
      catalog vocabulary." The page also states tags can be created inline:
      "pick from the existing tag vocabulary or create a new tag inline."
      The page contains NO information about bulk tag creation mechanisms
      (the `POST /api/tags` body is `BulkTagFormData`, an array). The page
      surfaces "the most-used tags" as a "Top tags chip strip on the Catalog
      Overview home page" — relevant to the sibling `getPopularTagList`
      endpoint, not `createTag`.
    confidence: HIGH
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions"
    anchor: ""
    rationale: "Permissions catalog — names `TAG_CREATE` (the gate on this endpoint) and the entity-level tags-update permissions involved in the side-door."
    last_verified_at: "2026-05-21T00:00:00Z"
    last_verified_status: 200
    fetched_excerpts: |
      Live-page text (WebFetch 2026-05-21, status 200): `TAG_CREATE` =
      "Allows creating a new tag." `TAG_UPDATE` = "Allows editing an
      existing tag." `TAG_DELETE` = "Allows deleting a tag." Entity-level:
      `DATA_ENTITY_TAGS_UPDATE` = "Allows editing a data entity's tags.";
      `TERM_TAGS_UPDATE` = "Allows editing tags for a term.";
      `DATASET_FIELD_TAGS_UPDATE` = "Allows adding or removing tags from an
      individual dataset field." The page "does not mention whether the
      entity-level tag-update permissions can create new global tags."
- doc_drift_findings:
  - "OpenAPI declares `'201'` for `createTag` (`openapi.yaml:372`); the controller returns HTTP 200 via `ResponseEntity::ok` (`TagController.java:27`). Spec-vs-code status-code drift."
  - "OpenAPI declares the `createTag` response schema as `TagList` — a static array (`openapi.yaml:377`); the controller returns `Mono<ResponseEntity<Flux<Tag>>>` — a nested reactive shape (`TagController.java:23`). Behaviourally equivalent at the HTTP wire (buffered) but a spec-vs-code shape drift."
  - "The live tagging page (WebFetch 2026-05-21, 200) describes tag creation only at the single-tag granularity ('create a new tag inline'); it does NOT document that `POST /api/tags` accepts a BULK array (`BulkTagFormData`). Bulk-create is an undocumented API capability."
  - "The live permissions page (WebFetch 2026-05-21, 200) does NOT state that an operator holding only an entity-level tags-update permission (`DATA_ENTITY_TAGS_UPDATE` / `TERM_TAGS_UPDATE` / `DATASET_FIELD_TAGS_UPDATE`) can create new global tag-vocabulary rows WITHOUT `TAG_CREATE`. `createTag` requires `TAG_CREATE`, but the four side-door paths reaching `getOrCreateTagsByName` / `getOrInjectTagByName` do not — the docs are silent on this directory side-door (REFACTOR-223 / DOC-GAP-168)."

## implicit_adrs

- "Bulk-create is the operator-explicit, fail-on-duplicate API shape — `createTag` accepts `BulkTagFormData` (a `Flux<TagFormData>`), `.collectList()`s it, and delegates to `bulkCreate`, whose inherited repository body has NO `ON CONFLICT` clause. The dual-method design (fail-on-duplicate `bulkCreate` for the UI/API route vs upsert-shaped `getOrInjectTagByName` for the Collector route) is a deliberate split." — evidence: TagController.java:22-28 + TagService.java:16 (bulkCreate) + TagService.java:26 (getOrInjectTagByName, distinct conflict semantics) + ReactiveAbstractCRUDRepository.java:114-126 (no ON CONFLICT) — intent_anchor: "Two distinct service methods with deliberately different conflict semantics — `bulkCreate` raises `UniqueConstraintException` on a name clash, `ingestData`/`getOrInjectTagByName` uses `ON CONFLICT ... DO UPDATE`; the maintainer-authored split IS the architectural statement that operator-driven create surfaces a clear error while ingestion-driven create is silent-idempotent." — confidence: MEDIUM (the split is real and visible; no comment explicitly defends 'fail-on-duplicate for the UI route')
- "Thin OpenAPI-delegate controller-method pattern — `createTag`'s body is a 3-line reactive chain with no business logic, no programmatic auth check, no transformation; an `@Override` of the generated `TagApi` method." — evidence: TagController.java:22-28 + the identical 2-3-line shape of `deleteTag`/`getPopularTagList`/`updateTag` in the same file — intent_anchor: "The pattern is repeated across all four `TagController` methods and across the controller package (per the `TagController` controller-class sidecar's implicit_adrs); the OpenAPI-generated-interface convention IS the architectural statement that business logic stays in services." — confidence: HIGH
- "The transactional boundary lives at the repository's inherited `bulkCreate`, not at the controller or service method — `TagServiceImpl.bulkCreate` is a single-step delegation, so it carries no `@ReactiveTransactional`; the multi-row INSERT's atomicity comes from `ReactiveAbstractCRUDRepository.bulkCreate`'s own annotation." — evidence: TagServiceImpl.java:37-42 (no annotation) + ReactiveAbstractCRUDRepository.java:113 (`@ReactiveTransactional` on the inherited method) — intent_anchor: "Consistent with the `TagServiceImpl` convention (per its sidecar's implicit_adrs: 'TX scope is the multi-statement orchestration, not the call-site') — single-step service methods do not carry the annotation; multi-statement ones do. `bulkCreate` is single-step at the service tier, so the annotation's absence here is the convention applied, not an omission." — confidence: MEDIUM

## bugs_limitations_corner_cases

- "Status-code drift on `createTag` — the controller returns HTTP 200 via `ResponseEntity::ok` (`TagController.java:27`); the OpenAPI operation declares `'201'` (`openapi.yaml:372`). A spec-conformant client expecting 201 on a successful create will mis-classify the response. Same drift class as `updateTag` (`openapi.yaml:400`) and `TermController.createTerm` (batch-U). — evidence: TagController.java:27 + odd-platform-specification/openapi.yaml:372 — severity: MEDIUM"
- "Response-shape drift on `createTag` — the controller returns `Mono<ResponseEntity<Flux<Tag>>>` (a nested reactive shape); the OpenAPI operation declares the response schema as `TagList`, a static array (`openapi.yaml:377`). The behaviour is correct in practice (the `Flux<Tag>` is buffered at the HTTP layer into a JSON array) but the dual-reactive return type is non-idiomatic and diverges from the declared static schema. — evidence: TagController.java:23 + odd-platform-specification/openapi.yaml:377 — severity: LOW"
- "In-batch duplicate-name atomicity is UNVERIFIED — `bulkCreate`'s inherited body emits a single `insertManyReturning` multi-row INSERT with no `ON CONFLICT` (`ReactiveAbstractCRUDRepository.java:114-126`). A payload `[{\"name\":\"a\"},{\"name\":\"a\"}]` hits the `tag_name_unique` partial index on the second row. Whether the whole INSERT rolls back atomically (zero rows created) or partially commits (the distinct names land) depends on the R2DBC `insertManyReturning` emission shape and Spring's reactive-TX rollback semantics — NOT statically determinable. A partial-commit outcome would be a silent data-shape surprise (the operator submits a 5-tag batch, gets an error, 4 tags exist anyway). — evidence: TagController.java:22-28 + TagServiceImpl.java:37-42 + ReactiveAbstractCRUDRepository.java:114-126 + V0_0_64__remove_is_deleted_field.sql:105 — severity: MEDIUM (HIGH if P-026 shows partial commit)"
- "Cross-batch duplicate is fail-on-duplicate, not upsert — a `createTag` payload containing a name already present in the directory raises `UniqueConstraintException(\"Tag with this name already exists\")` (via `ExceptionUtils.java:54-56`, per the `ReactiveTagRepositoryImpl` sidecar E2). The whole batch fails; the caller must treat the 4xx as 'at least one name already exists' and cannot tell WHICH name collided from the exception text. Operators expecting create-or-ignore semantics (which the Collector path's `getOrInjectTagByName` provides) will be surprised. — evidence: TagServiceImpl.java:38-42 + ReactiveAbstractCRUDRepository.java:114-126 (no ON CONFLICT) + the `ReactiveTagRepositoryImpl` sidecar E2 finding — severity: MEDIUM"
- "No tag-name validation on `createTag` beyond OpenAPI `type: string` — `TagFormData.name` is declared `type: string` with NO `pattern`, `minLength`, or `maxLength` (`components.yaml:340-345`); there is no DB-level `CHECK` constraint on `tag.name`. Empty-string, whitespace-only, control-character, and unbounded-length tag names are accepted and become permanently visible in the global directory (which `getPopularTagList` exposes to every authenticated user). — evidence: TagController.java:22-28 + TagServiceImpl.java:38-42 + components.yaml:340-345 — severity: LOW"
- "Side-door directory growth bypasses `createTag`'s `TAG_CREATE` gate — this endpoint requires `TAG_CREATE`, but four distinct paths mint global `tag` rows WITHOUT it: `TagServiceImpl.updateRelationsWithDataEntity` (via `PUT /api/dataentities/{id}/tags`, gated `DATA_ENTITY_TAGS_UPDATE`), `TermServiceImpl.upsertTags` (`TermServiceImpl.java:257`, via `PUT /api/terms/{term_id}/tags`, gated `TERM_TAGS_UPDATE`), `DatasetFieldServiceImpl` (via `PUT /api/datasetfields/{id}/tags`, gated `DATASET_FIELD_TAGS_UPDATE`), and `ExternalTagIngestionRequestProcessor.process` (`:104`, via `POST /ingestion/entities` Collector push, gated only by the S2S `auth.ingestion.filter.enabled` filter). All reach `tagService.getOrCreateTagsByName` / `getOrInjectTagByName`. The live permissions page (WebFetch 2026-05-21, 200) does NOT document this. REFACTOR-223 / DOC-GAP-168. — evidence: TagService.java:24, 26 + TagServiceImpl.java:79-94 + the `TagController` controller-class sidecar's side-door analysis + the `ReactiveTagRepositoryImpl` sidecar's audiences block — severity: HIGH"
- "No audit log on `createTag` — the method produces NO Activity Feed entry. Per the `TagController` controller-class sidecar, `@ActivityLog(event = TAG_ASSIGNMENT_UPDATED)` exists at `DataEntityServiceImpl.java:358` for the per-entity tag-ASSIGNMENT path, but the directory-VOCABULARY create path (`createTag` -> `bulkCreate`) has no `@ActivityLog`. A new tag appearing in the global directory is not attributable to a user or a time via the Activity Feed. — evidence: TagController.java:22-28 (no @ActivityLog) + TagServiceImpl.java:37-42 (no @ActivityLog on bulkCreate) — severity: MEDIUM"
- "Authorisation is controller-perimeter-only and path-pattern-matched — `createTag` carries no `@PreAuthorize`; the `TAG_CREATE` gate is a `SecurityConstants.SECURITY_RULES` entry keyed by the `POST /api/tags` path pattern (`SecurityConstants.java:138`). A rename of the `/api/tags` path without a corresponding `SECURITY_RULES` update would silently un-gate the create endpoint (the REFACTOR-217 drift class). The service tier (`TagServiceImpl.java:1-167`) has zero `@PreAuthorize` and zero programmatic checks (verified by the `TagServiceImpl` sidecar), so the perimeter is the SOLE defence. — evidence: TagController.java:22-28 (no @PreAuthorize) + SecurityConstants.java:138 + TagServiceImpl.java:1-167 — severity: MEDIUM"

## stress_findings

```yaml
stress_findings:
  tunables:
    - location: "TagController.java:23 (the Flux<TagFormData> batch — caller-controlled element count)"
      name: "createTag bulk batch size"
      value: "unbounded — no @Size / @Max on the request body; OpenAPI BulkTagFormData declares no maxItems (components.yaml:347-350)"
      questions:
        - q: "What at N = 0 / N = 1?"
          a: "N = 0 (empty body `[]`): `tagFormData.collectList()` yields an empty list; `TagServiceImpl.bulkCreate` maps it to an empty pojo list; `ReactiveAbstractCRUDRepository.bulkCreate` short-circuits at the `pojos.isEmpty()` guard to `Flux.just()` (`:115-117`) -> HTTP 200 with an empty `Flux<Tag>`. N = 1: a single-row `insertManyReturning` INSERT; one `Tag` returned with an assigned `id`."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:25 + TagServiceImpl.java:38-42 + ReactiveAbstractCRUDRepository.java:114-126"
        - q: "What at N = tunable + 1 / tunable x 100?"
          a: "There is no tunable to exceed — no batch-size limit exists in the controller, service, or the inherited repository method. A 100-tag or 100000-tag batch is `.collectList()`-materialised fully resident in memory, then emitted as a single multi-row INSERT (jOOQ does not partition `bulkCreate` — only `ingestData` uses `executeInPartitionReturning` per the `ReactiveTagRepositoryImpl` sidecar A3). A very large batch is one large INSERT statement + one large resident list."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:22-28 + TagServiceImpl.java:37-42 + ReactiveAbstractCRUDRepository.java:114-126 (no partition, no clamp)"
        - q: "What at null / negative / non-numeric?"
          a: "The batch is a `Flux<TagFormData>`, not a numeric tunable. A `null` JSON body (vs `[]`): the request body is `required: true` in OpenAPI (`openapi.yaml:366`), so Spring-WebFlux rejects a missing body at the parameter-binding layer with a 4xx before the method body runs. A malformed-JSON body fails deserialisation with a 4xx. Per-element `null` fields: `TagFormData.name` is `required` (`components.yaml:344-345`) so a null `name` is a 4xx; `important` is optional and maps to `null` in `TagPojo` if absent."
          confidence: STATIC-INFERRED
          evidence: "openapi.yaml:366 (requestBody required) + components.yaml:337-345 (name required, important optional)"
        - q: "What does the operator see at each boundary?"
          a: "Empty body: HTTP 200, empty response — no error, no rows. Single / small batch: HTTP 200, the created tags with ids. Large batch: HTTP 200 if all names are novel; one large INSERT — latency grows with N but no truncation, no silent drop. A duplicate anywhere in the batch (in-batch or cross-batch): the WHOLE batch fails with a 4xx (`UniqueConstraintException`) — see resource_boundaries and P-026."
          confidence: STATIC-INFERRED
          evidence: "ReactiveAbstractCRUDRepository.java:114-126 + the ReactiveTagRepositoryImpl sidecar E2"
  name_behavior_pairs:
    - name: "TagController.createTag (line 23) — `POST /api/tags`, OpenAPI summary `Create a tag` / description `Creates a tag` (openapi.yaml:362-363)"
      promise: "Creates a tag (or, given the bulk body, a set of tags) in the catalog vocabulary — the operator expects the named tags to exist in the directory after a successful call."
      implementation: "`tagFormData.collectList()` -> `tagService.bulkCreate` (`TagServiceImpl.java:37-42`: map each `TagFormData` to `TagPojo` via `tagMapper.mapToPojo`, then `reactiveTagRepository.bulkCreate`) -> inherited `ReactiveAbstractCRUDRepository.bulkCreate` (`:114-126`): empty-list short-circuit, else a single `insertManyReturning` multi-row INSERT with NO `ON CONFLICT` clause, under `@ReactiveTransactional`. For all-novel names the promise is honoured exactly. The gap vs the plain-English promise: it is fail-on-duplicate (a name clash aborts the whole batch with `UniqueConstraintException`), and it produces NO Activity Feed entry."
      drift: MINOR
      operator_visible_consequence: "For all-novel-name batches, behaviour matches the name. The MINOR drift: the OpenAPI summary 'Creates a tag' implies idempotent-ish create; the implementation aborts the entire batch on the first duplicate (no create-or-ignore), and the create is not audit-logged. An operator re-submitting a batch after a partial failure (if P-026 shows partial commit) would hit a duplicate error on the names that already landed."
      confidence: STATIC-INFERRED
      evidence: "TagController.java:22-28 + TagServiceImpl.java:37-42 + ReactiveAbstractCRUDRepository.java:114-126 + openapi.yaml:362-363"
    - name: "TagServiceImpl.bulkCreate (line 38) — the service method `createTag` delegates to"
      promise: "`bulkCreate` promises to create a batch of tags."
      implementation: "Single-step delegation: `tags.stream().map(tagMapper::mapToPojo).toList()` then `reactiveTagRepository.bulkCreate(pojos).map(tagMapper::mapToTag)`. No `@ReactiveTransactional` at this layer; the TX comes from the inherited repository method. No deduplication, no validation, no conflict handling at the service tier."
      drift: NONE
      operator_visible_consequence: "N/A — the name matches a pure straight-through delegation."
      confidence: STATIC-INFERRED
      evidence: "TagServiceImpl.java:37-42"
  orderings: []   # createTag is a write endpoint — no ORDER BY, no LIMIT, no pagination, no in-memory sort, no aggregation. The bulk INSERT preserves the payload's element order in `insertManyReturning RETURNING *`, but the response order is not a documented contract and no caller depends on it.
  auth_gates:
    - location: "SecurityConstants.java:138 (the POST /api/tags SecurityRule) + TagController.java:22-28 (no method-level annotation)"
      endpoint: "POST /api/tags (createTag)"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "DISABLED: reachable without authentication and without any permission check — the `auth.type=DISABLED` branch skips Spring Security entirely (per the `TagController` controller-class sidecar's auth_gates). LOGIN_FORM / OAUTH2 / LDAP: identical — the caller must be authenticated AND hold `TAG_CREATE` (Management scope, `NO_CONTEXT`); the SecurityRule is mode-agnostic, so the three authenticating modes gate `createTag` the same way."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:138 + the TagController controller-class sidecar's auth_gates block (REFERENCE: OAuthSecurityConfiguration / LoginFormSecurityConfiguration / LdapSecurityConfiguration / SecurityConfiguration)"
        - q: "What does an unauthenticated caller see (no cookie / no token)?"
          a: "LOGIN_FORM / OAUTH2 / LDAP: 401 (or a 302 redirect to login under LOGIN_FORM) — the catch-all `pathMatchers(\"/**\").authenticated()` (`AuthorizationCustomizer.java:29-30`, per the controller-class sidecar) blocks unauthenticated access before the `TAG_CREATE` check is reached. DISABLED: HTTP 200 — no auth check, the tag is created."
          confidence: STATIC-INFERRED
          evidence: "the TagController controller-class sidecar's auth_gates (AuthorizationCustomizer.java:29-30 catch-all)"
        - q: "What does a wrong-role caller see (e.g. READ_ONLY hitting POST)?"
          a: "An authenticated caller WITHOUT `TAG_CREATE` (a READ_ONLY-role user, or a user holding only `DATA_ENTITY_TAGS_UPDATE` / `TERM_TAGS_UPDATE` / `DATASET_FIELD_TAGS_UPDATE`) receives 403 from the SecurityRule chain. NOTE: that same user CAN still grow the global tag directory via the side-door — `PUT /api/dataentities/{id}/tags` etc. reach `getOrCreateTagsByName` and mint `tag` rows without `TAG_CREATE` (REFACTOR-223 / DOC-GAP-168). So a 403 on `createTag` does NOT mean the user cannot create directory rows."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:138 + TagServiceImpl.java:79-94 + the TagController controller-class sidecar's side-door analysis"
        - q: "Where exactly does the gate live — controller, service, repository, or nowhere?"
          a: "Controller perimeter ONLY — via `SecurityConstants.SECURITY_RULES` path-pattern matching on `POST /api/tags` (`SecurityConstants.java:138`); there is no `@PreAuthorize` on `createTag`. The service tier (`TagServiceImpl.java:1-167`) has zero `@PreAuthorize` and zero programmatic permission checks (verified by the `TagServiceImpl` sidecar); the repository tier has zero checks (verified by the `ReactiveTagRepositoryImpl` sidecar D1). The path pattern IS the gate — a path rename (REFACTOR-217 class) would silently bypass it."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:22-28 (no @PreAuthorize) + SecurityConstants.java:138 + TagServiceImpl.java:1-167 + the ReactiveTagRepositoryImpl sidecar D1"
  resource_boundaries:
    - location: "ReactiveAbstractCRUDRepository.java:113-126 (the inherited @ReactiveTransactional bulkCreate that createTag's chain terminates in)"
      kind: transactional
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "Two concurrent `POST /api/tags` each containing the same NOVEL name: both `bulkCreate` INSERTs race; the partial unique index `tag_name_unique` (`V0_0_64:105`) serialises the conflict at the PostgreSQL B-tree level — one INSERT wins, the other raises a constraint violation -> `UniqueConstraintException` -> 4xx to the losing caller. No corrupted row, no duplicate `tag` row. There is no optimistic-lock column and no `SELECT ... FOR UPDATE`; the partial unique index is the entire concurrency-protection mechanism. The in-batch-duplicate atomicity (does a single batch with a self-duplicate roll back wholly or partially) is NOT statically determinable — P-026."
          confidence: STATIC-INFERRED
          evidence: "ReactiveAbstractCRUDRepository.java:114-126 (no ON CONFLICT) + V0_0_64__remove_is_deleted_field.sql:105 + the ReactiveTagRepositoryImpl sidecar E1/E2 + ExceptionUtils.java:54-56"
        - q: "Is the call replay-safe?"
          a: "NO. `createTag` is fail-on-duplicate — replaying the same payload after a successful create raises `UniqueConstraintException` on every already-created name. A client must treat a 4xx as 'some/all of these names already exist' and cannot blindly retry. (Contrast the Collector path's `getOrInjectTagByName`, which IS replay-safe via `ON CONFLICT ... DO UPDATE`.) If P-026 shows in-batch partial commit, replay after a partial failure is also unsafe — the names that landed will collide."
          confidence: STATIC-INFERRED
          evidence: "ReactiveAbstractCRUDRepository.java:114-126 (no ON CONFLICT) + TagServiceImpl.java:88-94 (the upsert sibling, for contrast)"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No cache fronts `createTag` — no `@Cacheable`, no manual cache writes in `TagController` or `TagServiceImpl` (verified by the `TagController` controller-class sidecar resource_boundaries). The create hits the DB directly; the tag is immediately visible to a subsequent `getPopularTagList` read."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:1-53 + TagServiceImpl.java:1-167 (no @Cacheable)"
    - location: "TagController.java:22-28 (the createTag bulk-INSERT atomicity)"
      kind: idempotency
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "Covered in the transactional entry above — the partial unique index prevents duplicate rows; the open question is in-batch self-duplicate atomicity, pinned by P-026."
          confidence: PROBE-NEEDED
          evidence: "P-026"
        - q: "Is the call replay-safe?"
          a: "NO — fail-on-duplicate (covered above)."
          confidence: STATIC-INFERRED
          evidence: "ReactiveAbstractCRUDRepository.java:114-126"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No cache (covered above)."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:1-53 (no @Cacheable)"
  request_inputs:
    - location: "TagController.java:23 (the createTag request-body parameter)"
      input_kind: body-field
      input_name: "tagFormData (Flux<TagFormData>) — OpenAPI body schema BulkTagFormData"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The parameter name `tagFormData` (singular) names a SINGLE tag's form data; the OpenAPI body schema `BulkTagFormData` (`components.yaml:347-350`) is an ARRAY of `TagFormData`. The reactive type `Flux<TagFormData>` correctly carries the array. The name's promise: the body is tag form-data; the implementation receives a BATCH of it. A minor singular-name-for-bulk-payload mismatch — the name does not advertise the bulk capability."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:23 + components.yaml:347-350"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Trace: `TagController.createTag` `.collectList()`s the Flux (`:25`) -> `tagService.bulkCreate(List<TagFormData>)` (`TagServiceImpl.java:38`) -> `tags.stream().map(tagMapper::mapToPojo).toList()` (`:39`) -> `reactiveTagRepository.bulkCreate(pojos)` -> inherited `ReactiveAbstractCRUDRepository.bulkCreate` (`:114-126`) -> `insertManyReturning` INSERT into the `tag` table. Each `TagFormData` element becomes one `tag` row."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:25-26 + TagServiceImpl.java:38-40 + TagMapper.java:19 + ReactiveAbstractCRUDRepository.java:114-126"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — `tagFormData` is used to create tags; the only nuance is that the singular parameter name under-advertises the bulk-array capability. There is no silent translation to a different entity/column (no LSN-020-class drift); the body is consumed exactly as a list of tag-form-data."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "TagController.java:23-26 + TagServiceImpl.java:38-40"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — drift is NONE; no silent translation. The body is used as named."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:23-26"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE. `TagFormData` has exactly two fields (`name`, `important`) and both are consumed (see the per-field records below). The `tag` table additionally has `external` / `created_at` / `updated_at` / `deleted_at`, but none of those is a caller-supplied input — `external` is intentionally NOT settable from `TagFormData` (the UI cannot impersonate a Collector); timestamps are stamped by `DateTimeUtil.generateNow()` in the inherited `bulkCreate`."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:337-345 + ReactiveAbstractCRUDRepository.java:119 (generateNow)"
      routes_to_finding: "bugs_limitations_corner_cases (no tag-name validation entry — the body is consumed faithfully, but unvalidated)"
    - location: "components.yaml:340-341 (TagFormData.name field)"
      input_kind: body-field
      input_name: "name"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "`name` promises the tag's display name — the text label that appears in the global tag vocabulary and on the 'Top Tags' surface."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:340-341"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "`tagMapper.mapToPojo` (`TagMapper.java:19`) copies `TagFormData.name` -> `TagPojo.name`; the inherited `bulkCreate` INSERTs it into `tag.name`. `tag.name` is the column the partial unique index `tag_name_unique` is built on (`V0_0_64:105`), so `name` is also the duplicate-detection key."
          confidence: STATIC-INFERRED
          evidence: "TagMapper.java:19 + ReactiveAbstractCRUDRepository.java:114-126 + V0_0_64__remove_is_deleted_field.sql:105"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — `name` maps to `tag.name`, the directory display name. No translation. Caveat (routed to bugs_limitations_corner_cases): `name` is unvalidated — OpenAPI declares `type: string` with no `pattern`/`minLength`/`maxLength` (`components.yaml:340-345`), so empty/whitespace/control-char/unbounded values are accepted into the directory."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "components.yaml:340-345 + TagMapper.java:19"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — drift is NONE."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:340-341"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE — `tag.name` is exactly the column `name` maps to and it IS used."
          confidence: STATIC-INFERRED
          evidence: "TagMapper.java:19"
      routes_to_finding: "bugs_limitations_corner_cases (the 'no tag-name validation' entry)"
    - location: "components.yaml:342-343 (TagFormData.important field)"
      input_kind: body-field
      input_name: "important"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "`important` promises a boolean flag marking the tag as significant — the live docs describe operators setting 'the Important flag where appropriate' in Management -> Tags (WebFetch 2026-05-21, 200)."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:342-343 + the live tagging-page WebFetch excerpt in docs_link_semantic"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "`tagMapper.mapToPojo` (`TagMapper.java:19`) copies `TagFormData.important` -> `TagPojo.important`; the inherited `bulkCreate` INSERTs it into the `tag.important` boolean column. `important` is optional in the OpenAPI schema (`components.yaml:344-345` lists only `name` as required); if absent it maps to `null` in the pojo."
          confidence: STATIC-INFERRED
          evidence: "TagMapper.java:19 + components.yaml:342-345 + ReactiveAbstractCRUDRepository.java:114-126"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — `important` maps to `tag.important`. No translation. The only nuance: it is optional, so omitting it persists `null` (rather than `false`) — a 3-state column (`true` / `false` / `null`) where the operator likely expects 2-state. This is a minor data-shape nuance, not a name-vs-implementation drift."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "components.yaml:342-345 + TagMapper.java:19"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — drift is NONE."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:342-343"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE — `tag.important` is exactly the column `important` maps to and it IS used."
          confidence: STATIC-INFERRED
          evidence: "TagMapper.java:19"
      routes_to_finding: "N/A — no finding routed; `important` maps faithfully (the null-vs-false nuance is noted inline, below LOW severity)."
  probes_emitted:
    - probe_id: P-026
      question: "Category E — does a createTag bulk INSERT containing an in-batch or cross-batch duplicate name roll back atomically (zero rows created), or partially commit (the distinct names land)? Pins the data-shape contract of the inherited bulkCreate's no-ON-CONFLICT multi-row INSERT."
      probe_path: "lineage/odd-platform/probes/P-026.yaml"
  stress_summary:
    triggers_total: 8
    questions_total: 28
    answers_static_inferred: 27
    answers_probe_needed: 1
    answers_reference: 0
    drift_flags: 1
```

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` — `createTag` is on the HTTP UI/API surface (`POST /api/tags`). `DISABLED` skips auth entirely (the endpoint is then reachable unauthenticated). `S2S` is orthogonal to this endpoint — the S2S ingestion path mutates the tag directory through `ExternalTagIngestionRequestProcessor`, not through `createTag`.
- **ingestion_filter_relevance**: `NO — UI/API surface at POST /api/tags, not /ingestion/**`. `createTag` does not participate in the ingestion filter. (The global tag directory IS also grown by the ingestion path via `ExternalTagIngestionRequestProcessor.process` -> `getOrInjectTagByName`, gated by `auth.ingestion.filter.enabled` — but that is a different endpoint.)
- **authorization_assertions**:
  - "POST `/api/tags` gated by `TAG_CREATE` (Management scope, `NO_CONTEXT`) — evidence: SecurityConstants.java:138 (cited via the TagController controller-class sidecar)"
  - "No `@PreAuthorize` on the `createTag` method and no programmatic permission check in its chain — `TagServiceImpl.bulkCreate` (`:37-42`) and `ReactiveAbstractCRUDRepository.bulkCreate` (`:114-126`) have zero permission logic — evidence: TagController.java:22-28 + TagServiceImpl.java:37-42"
- **owner_scoping**: `N/A — the Tag directory has no owner concept`. There is no `tag.owner_id` column; `createTag` produces flat, globally-shared vocabulary rows with no per-Owner scoping (consistent with the `ReactiveTagRepositoryImpl` sidecar's `owner_scoping: N/A`).
- **data_exposure**:
  - "`Mono<ResponseEntity<Flux<Tag>>>` from `createTag` -> caller holding `TAG_CREATE`. Returns the created tags (`id, name, important, external, usedCount`). — evidence: TagController.java:22-28"
  - "Created tags become readable by EVERY authenticated user via the sibling `getPopularTagList` (`GET /api/tags`), which has no RBAC gate beyond `authenticated()` (per the TagController controller-class sidecar) — a tag created here is not private to its creator. — evidence: TagController.java:36-44 + SecurityConstants.java:138-142"
- **known_security_gaps**:
  - "Side-door directory growth — `DATA_ENTITY_TAGS_UPDATE` / `TERM_TAGS_UPDATE` / `DATASET_FIELD_TAGS_UPDATE` and S2S ingestion mint global tag rows WITHOUT `TAG_CREATE`, while `createTag` itself requires it. The live permissions page (WebFetch 2026-05-21, 200) does not document this. — evidence: TagService.java:24, 26 + TagServiceImpl.java:79-94 + 4 side-door call sites (per the TagController controller-class sidecar) — severity: HIGH"
  - "Authorisation is controller-perimeter-only and path-pattern-matched — a `/api/tags` path rename without a `SecurityConstants.SECURITY_RULES` update would silently un-gate `createTag` (REFACTOR-217 drift class). — evidence: TagController.java:22-28 (no @PreAuthorize) + SecurityConstants.java:138 — severity: MEDIUM"
  - "No tag-name validation — arbitrary content (empty / whitespace / control-char / unbounded length) is accepted into the global directory and rendered to every authenticated user via `getPopularTagList`. — evidence: TagController.java:22-28 + components.yaml:340-345 — severity: LOW"
  - "No audit log on `createTag` — a new tag appearing in the global directory produces no Activity Feed entry, so the create is not attributable to a user or a time. — evidence: TagController.java:22-28 + TagServiceImpl.java:37-42 (no @ActivityLog) — severity: MEDIUM"

## performance

- **hot_paths**:
  - "`createTag` runs once per Management -> Tags 'create' action — not on a rendering or polling path. The bulk shape allows many tags per request; the inherited `bulkCreate` emits ONE multi-row INSERT (it does NOT partition like `ingestData` does — per the `ReactiveTagRepositoryImpl` sidecar A3). — evidence: TagController.java:22-28 + ReactiveAbstractCRUDRepository.java:114-126"
- **throughput_characteristics**:
  - "Reactive `Mono` / `Flux` — non-blocking; the jOOQ-reactive PG driver releases the connection between awaits."
  - "Bulk — `createTag` accepts a `Flux<TagFormData>` array; there is one INSERT per request regardless of batch size (no per-element round-trip)."
- **resource_allocation**:
  - "`tagFormData.collectList()` (`TagController.java:25`) materialises the ENTIRE inbound batch into a resident `List<TagFormData>` before delegation — for a very large batch (no `maxItems` cap) the memory cost is the full list plus the full `List<TagPojo>` plus the multi-row INSERT statement. — evidence: TagController.java:25 + TagServiceImpl.java:39"
  - "One DB connection per call, pinned by the inherited `@ReactiveTransactional` for the duration of the multi-row INSERT. — evidence: ReactiveAbstractCRUDRepository.java:113-126"
- **scaling_characteristics**:
  - "Stateless — the controller method holds no per-call state; instances scale horizontally."
  - "No row-level locking on the create path — concurrency-protection is the `tag_name_unique` partial unique index (a B-tree-level conflict serialisation), not an application lock. — evidence: ReactiveAbstractCRUDRepository.java:114-126 + V0_0_64__remove_is_deleted_field.sql:105"
- **known_performance_gaps**:
  - "No `maxItems` cap on the `createTag` bulk body — a 100000-element `BulkTagFormData` is accepted, fully materialised in memory, and emitted as one very large multi-row INSERT statement. No batch-size limit at the controller, service, or inherited-repository layer. — evidence: TagController.java:22-28 + components.yaml:347-350 + ReactiveAbstractCRUDRepository.java:114-126 — severity: LOW"

## upstream_callers

- entry_point: "rest:POST /api/tags"
  caller_node: "rest_api:openapi-generated TagApi.createTag"
  multiplicity_per_trigger: 1
  evidence: "TagController.java:22-28 — `createTag` is the `@Override` of the generated `TagApi.createTag`; one HTTP POST triggers one invocation."
  observation_class: rest-call
  unresolved: false

- entry_point: "ui_route:/management/tags (Management -> Tags tab, 'create tag' action)"
  caller_node: "ts react-component: the Management Tags create form (not read in this session)"
  multiplicity_per_trigger: unresolved
  evidence: "TagController.java:22-28 + the live tagging-page WebFetch (2026-05-21, 200): Management -> Tags is where operators 'create the canonical tag list'. The UI dispatch component and its per-action multiplicity are a REFERENCE — resolve when the Management Tags UI sidecar is enriched."
  observation_class: ui-call
  unresolved: true

## downstream_side_effects

- side_effect_class: db-write
  description: "INSERTs one `tag` row per `TagFormData` element of the bulk body — a single multi-row `insertManyReturning` INSERT into the `tag` table, under the inherited `@ReactiveTransactional`."
  evidence: "ReactiveAbstractCRUDRepository.java:114-126 (insertManyReturning) + TagServiceImpl.java:38-40"
  cardinality_per_call: "N — one row per non-empty payload element; 0 for an empty `[]` body (short-circuit at ReactiveAbstractCRUDRepository.java:115-117); 0 on a duplicate-name failure IF the batch INSERT rolls back atomically (UNVERIFIED — see P-026)"
  reachable_from_entry_points:
    - "rest:POST /api/tags"
    - "ui_route:/management/tags (Management -> Tags tab)"

- side_effect_class: page-render
  description: "Returns a `Flux<Tag>` of the created tags (`id, name, important, external, usedCount` per element) to the caller as the HTTP response body."
  evidence: "TagController.java:23-27 + TagMapper.java:26 (mapToTag)"
  cardinality_per_call: "N — one `Tag` element per created row; the response is an empty list for an empty payload"
  reachable_from_entry_points:
    - "rest:POST /api/tags"
    - "ui_route:/management/tags (Management -> Tags tab)"

- side_effect_class: log-emit
  description: "NO Activity Feed entry — `createTag` produces no `activity` row. (Recorded as a side-effect ABSENCE: per the `TagController` controller-class sidecar, the directory-vocabulary create path has no `@ActivityLog`, unlike the per-entity tag-ASSIGNMENT path at `DataEntityServiceImpl.java:358`.)"
  evidence: "TagController.java:22-28 + TagServiceImpl.java:37-42 (no @ActivityLog on createTag / bulkCreate)"
  cardinality_per_call: 0
  reachable_from_entry_points:
    - "rest:POST /api/tags"
    - "ui_route:/management/tags (Management -> Tags tab)"

- NOTE — NO search-vector side effect: unlike `updateTag` (which triggers a triple search-vector refresh) and `deleteTag` (which triggers a term-side refresh), `createTag` -> `bulkCreate` updates NO search vectors. A freshly-created tag's name is NOT indexed into `search_entrypoint` until a later entity-level write touches it. Recorded here as a deliberate absence; evidence: TagServiceImpl.java:37-42 (the bulkCreate chain has no `updateSearchVectors` / `reactiveSearchEntrypointRepository` call, in contrast to `update` at TagServiceImpl.java:53).
- NO external I/O (no HTTP / SMTP / Slack / S3 / OTLP), NO cache mutation, NO header-set / redirect — evidence: TagController.java:22-28 + TagServiceImpl.java:37-42.

## sources

- understanding ← TagController.java:22-28 + TagServiceImpl.java:37-42 + ReactiveAbstractCRUDRepository.java:114-126 + openapi.yaml:362-377 + WebFetch https://docs.opendatadiscovery.org/features/data-discovery/tagging (2026-05-21, 200)
- concepts.entities.TagFormData ← components.yaml:337-345
- concepts.entities.BulkTagFormData ← components.yaml:347-350 + openapi.yaml:370 + TagController.java:23
- concepts.entities.TagList ← openapi.yaml:377
- concepts.operations.createTag ← TagController.java:22-28
- concepts.operations.bulkCreate-service ← TagServiceImpl.java:37-42
- concepts.operations.bulkCreate-repository ← ReactiveAbstractCRUDRepository.java:114-126
- concepts.operations.fail-on-duplicate ← ReactiveAbstractCRUDRepository.java:114-126 (no ON CONFLICT) + V0_0_64__remove_is_deleted_field.sql:105 + ExceptionUtils.java:54-56 (via the ReactiveTagRepositoryImpl sidecar E2)
- concepts.invariants.status-code-drift ← TagController.java:27 + openapi.yaml:372
- concepts.invariants.empty-body ← ReactiveAbstractCRUDRepository.java:115-117
- dependencies_semantic.requires-feature.TagMapper ← TagMapper.java:19, 26 + TagServiceImpl.java:39
- dependencies_semantic.requires-feature.SecurityConstants ← SecurityConstants.java:138 (cited via the TagController controller-class sidecar)
- dependencies_semantic.requires-runtime.ReactiveTransactional ← ReactiveAbstractCRUDRepository.java:113
- tests_coverage_semantic.test_files ← odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/TagRepositoryImplTest.java:52-67 (cited via the ReactiveTagRepositoryImpl sidecar)
- docs_link_semantic.inferred_docs.[0] ← WebFetch https://docs.opendatadiscovery.org/features/data-discovery/tagging (2026-05-21, status 200)
- docs_link_semantic.inferred_docs.[1] ← WebFetch https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions (2026-05-21, status 200)
- docs_link_semantic.doc_drift_findings ← TagController.java:27, 23 + openapi.yaml:372, 377 + the two live WebFetch excerpts
- implicit_adrs.[0] ← TagController.java:22-28 + TagService.java:16, 26 + ReactiveAbstractCRUDRepository.java:114-126
- implicit_adrs.[1] ← TagController.java:22-28 (the 3-line delegation shape)
- implicit_adrs.[2] ← TagServiceImpl.java:37-42 + ReactiveAbstractCRUDRepository.java:113
- bugs_limitations_corner_cases.[0] ← TagController.java:27 + openapi.yaml:372
- bugs_limitations_corner_cases.[1] ← TagController.java:23 + openapi.yaml:377
- bugs_limitations_corner_cases.[2] ← TagController.java:22-28 + TagServiceImpl.java:37-42 + ReactiveAbstractCRUDRepository.java:114-126 + V0_0_64__remove_is_deleted_field.sql:105
- bugs_limitations_corner_cases.[3] ← TagServiceImpl.java:38-42 + ReactiveAbstractCRUDRepository.java:114-126 (via the ReactiveTagRepositoryImpl sidecar E2)
- bugs_limitations_corner_cases.[4] ← TagController.java:22-28 + components.yaml:340-345
- bugs_limitations_corner_cases.[5] ← TagService.java:24, 26 + TagServiceImpl.java:79-94 + the TagController controller-class sidecar's side-door analysis
- bugs_limitations_corner_cases.[6] ← TagController.java:22-28 + TagServiceImpl.java:37-42 (no @ActivityLog)
- bugs_limitations_corner_cases.[7] ← TagController.java:22-28 + SecurityConstants.java:138 + TagServiceImpl.java:1-167
- stress_findings.tunables ← TagController.java:23, 25 + TagServiceImpl.java:37-42 + ReactiveAbstractCRUDRepository.java:114-126 + components.yaml:347-350
- stress_findings.name_behavior_pairs ← TagController.java:22-28 + TagServiceImpl.java:37-42 + ReactiveAbstractCRUDRepository.java:114-126 + openapi.yaml:362-363
- stress_findings.auth_gates ← TagController.java:22-28 + SecurityConstants.java:138 + the TagController controller-class sidecar's auth_gates block
- stress_findings.resource_boundaries ← ReactiveAbstractCRUDRepository.java:113-126 + V0_0_64__remove_is_deleted_field.sql:105 + P-026
- stress_findings.request_inputs ← TagController.java:23 + components.yaml:337-345 + TagMapper.java:19 + ReactiveAbstractCRUDRepository.java:114-126, 119
- stress_findings.probes_emitted ← lineage/odd-platform/probes/P-026.yaml
- security ← TagController.java:22-28 + SecurityConstants.java:138 + TagServiceImpl.java:37-42 + components.yaml:340-345 + the two live WebFetch excerpts
- performance ← TagController.java:25 + TagServiceImpl.java:39 + ReactiveAbstractCRUDRepository.java:113-126
- upstream_callers.[0] ← TagController.java:22-28
- upstream_callers.[1] ← TagController.java:22-28 + the live tagging-page WebFetch (2026-05-21, 200)
- downstream_side_effects.[0] ← ReactiveAbstractCRUDRepository.java:114-126 + TagServiceImpl.java:38-40
- downstream_side_effects.[1] ← TagController.java:23-27 + TagMapper.java:26
- downstream_side_effects.[2] ← TagController.java:22-28 + TagServiceImpl.java:37-42

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH
- implicit_adrs: MEDIUM
- bugs_limitations_corner_cases: HIGH
- security: HIGH
- performance: HIGH
- upstream_callers: MEDIUM
- downstream_side_effects: HIGH
- stress_findings: HIGH

(`implicit_adrs` is MEDIUM: the bulk-create/upsert split and the TX-placement
convention are visible and consistent, but no in-file comment explicitly
defends them — intent is inferred from the consistent pattern. `upstream_callers`
is MEDIUM: the REST entry point is HIGH-confidence, but the UI caller and its
per-action dispatch multiplicity are an unresolved REFERENCE awaiting the
Management Tags UI sidecar.)

## Maintainer notes

(none)

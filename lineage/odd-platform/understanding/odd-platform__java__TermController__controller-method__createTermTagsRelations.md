---
node_id: "odd-platform java TermController controller-method:createTermTagsRelations"
node_kind: controller-method
axis: controllers
extracted_at_commit: ede5d277
enriched_at_commit: ede5d277
extractor_version: 0.1.0
prompt_version: file-analyser/0.5.0
enrichment_status: complete
confidence_overall: MEDIUM
session_id: session-2026-05-21-T
---

# TermController#createTermTagsRelations — semantic understanding

## understanding

`createTermTagsRelations` is the reactive `PUT /api/terms/{term_id}/tags`
handler — a five-line method that reads the request body as
`Mono<TagsFormData>`, calls `termService.upsertTags(termId, fd)`, and lifts the
resulting `Flux<Tag>` into `200 OK` via `Mono.just(ResponseEntity.ok(...))`.
Despite the `create*` operationId, the underlying semantic is **replace-all**
for a term's tag set: `TermServiceImpl.upsertTags`
(`TermServiceImpl.java:254-264`) runs a two-phase delete-then-recreate —
phase 1 (`tagService.deleteRelationsWithTerm`) deletes every `tag_to_term`
relation whose tag NAME is absent from the submitted `tag_name_list`, phase 2
auto-creates any submitted name not yet in the global `tag` directory
(`getOrCreateTagsByName`) and (re)inserts relations for the full submitted set.
Authorization is enforced centrally by a `SecurityRule` for
`PUT /api/terms/{term_id}/tags` that demands the dedicated **`TERM_TAGS_UPDATE`**
permission (not `TERM_UPDATE`), evaluated per-term through the `TERM`
`AuthorizationManagerType`. Two material divergences from the already-enriched
sibling `DataEntityController.createDataEntityTagsRelations`: (a) the term path
**emits no activity-feed event** — there is no `@ActivityLog` anywhere on the
`upsertTags` chain, whereas the data-entity path emits `TAG_ASSIGNMENT_UPDATED`;
(b) the term path has **no external/internal tag distinction** — `tag_to_term`
has no `external` column (`V0_0_35__add_terms.sql:18-28`), so the replace-all
diff has no ingested-tag carve-out and removes EVERY tag relation not in the
submitted list.

## concepts

- entities: [
    "`Tag` (response payload — `id`, `name`, `important`, `external`, `usedCount`; `components.yaml` `Tag` schema, referenced via `TagList`)",
    "`TagsFormData` (request body — `tag_name_list: array<string>`, the single required field, `components.yaml:2212-2220`)",
    "`Term` (the entity being tagged — `id`, `name`, `definition`, `namespace_id`; `V0_0_35__add_terms.sql:1-14`)",
    "`TagPojo` (jOOQ row — `id`, `name`, `important`, `deleted_at`)",
    "`TagToTermPojo` (jOOQ relation row — `tag_id`, `term_id`; primary key `(tag_id, term_id)`; NO `external` and NO `origin` column — `V0_0_35__add_terms.sql:18-28`, `deleted_at` dropped by `V0_0_76__term_relations_hard_delete.sql:12-13`)"
  ]
- operations: [
    "`replace-all-tag-relations-for-term` — `termService.upsertTags(termId, fd)` (`TermServiceImpl.java:254-264`) -> (a) `new HashSet<>(tagsFormData.getTagNameList())` materialises the submitted names, (b) `tagService.deleteRelationsWithTerm(termId, names)` (`TagServiceImpl.java:124-134`) reads CURRENT term tags via `listByTerm`, computes `idsToDelete = currentTags where name NOT IN submittedNames`, and `deleteTermRelations(termId, idsToDelete)` HARD-deletes those `tag_to_term` rows, (c) `tagService.getOrCreateTagsByName(names)` (`TagServiceImpl.java:80-86`) splits the names into existing-vs-to-create and `bulkCreate`s any missing directory rows, (d) `tagService.createRelationsWithTerm(termId, tagsToLink)` (`TagServiceImpl.java:138-142`) inserts `tag_to_term` rows for the full submitted set with `.onDuplicateKeyIgnore()` (`ReactiveTagRepositoryImpl.java:326-347`), (e) `termSearchEntrypointRepository.updateTagVectorsForTerm(termId)` refreshes the term search vector, (f) maps each `TagPojo` to a `Tag` and returns the `Flux<Tag>`"
  ]
- invariants: [
    "Reactive transactional at the term-service layer only — `TermServiceImpl.upsertTags` carries `@ReactiveTransactional` (`TermServiceImpl.java:253`); the delete phase, the directory `bulkCreate`, the relation insert, and the search-vector refresh all run inside ONE DB transaction. `TagServiceImpl.deleteRelationsWithTerm` is NOT itself `@ReactiveTransactional` (`TagServiceImpl.java:123-134`); `createRelationsWithTerm` IS (`TagServiceImpl.java:137`) and `bulkCreate` IS (`ReactiveAbstractCRUDRepository.java:113`) — all enclosed by the outer term-service transaction (Spring `PROPAGATION_REQUIRED`).",
    "Replace-all, NOT additive — `deleteRelationsWithTerm(termId, names)` (`TagServiceImpl.java:124-134`) treats the submitted `tag_name_list` as `tagsToKeep`: it deletes every current `tag_to_term` row whose tag name is NOT in the submitted set. A second PUT with `tag_name_list: ['x']` on a term holding `{a, b}` ends with the term tagged exactly `{x}` — `a` and `b` relations are deleted. There is no separate DELETE endpoint; replace-all IS the removal mechanism.",
    "No external-tag carve-out — `tag_to_term` (`V0_0_35__add_terms.sql:18-28`) has no `external` or `origin` column. Unlike `tag_to_data_entity` (which carries `external`) and `tag_to_dataset_field` (which carries `ORIGIN`, see `ReactiveTagRepositoryImpl.java:292`), the term-tag relation has no provenance flag. `listByTerm` (`ReactiveTagRepositoryImpl.java:128-135`) filters only on `TAG.DELETED_AT.isNull()`. Consequence: the replace-all removes EVERY tag relation absent from the submitted list — there is no ingested-tag set to preserve, because terms are a UI/API-authored concept with no ingestion-side tagging path.",
    "Side-effecting auto-creation — `getOrCreateTagsByName(names)` (`TagServiceImpl.java:80-86`) -> `divideTagsByExistence` (`TagServiceImpl.java:144-159`) splits the requested set against `reactiveTagRepository.listByNames` and unconditionally `bulkCreate`s any name not found, with `important = false` hardcoded (`TagServiceImpl.java:155`). `PUT /api/terms/{id}/tags` with `tag_name_list: ['brand-new-tag']` silently creates a `tag` directory row. The endpoint is not idempotent at the directory level.",
    "Relation insert is idempotent — `createTermRelations` (`ReactiveTagRepositoryImpl.java:326-347`) builds a multi-row `INSERT INTO tag_to_term ... onDuplicateKeyIgnore()`. Re-submitting an already-related tag does not raise a primary-key violation on `tag_to_term_pk (tag_id, term_id)`. The directory `bulkCreate` (step c) has NO `ON CONFLICT` and CAN collide (see `bugs_limitations_corner_cases`).",
    "NO activity-feed event — there is no `@ActivityLog` annotation on `TermController.createTermTagsRelations` (`TermController.java:129-136`), on `TermServiceImpl.upsertTags` (`TermServiceImpl.java:252-264`), or on the `TagServiceImpl` methods it calls. This is a divergence from `DataEntityServiceImpl.upsertTags`, which carries `@ActivityLog(event = TAG_ASSIGNMENT_UPDATED)`. A term's tag changes are NOT recorded in the activity feed; other term mutations on the same controller (`linkTermWithDataEntity`, `removeTermFromDataEntity`) DO carry `@ActivityLog` — so the absence on the tag path is asymmetric within `TermServiceImpl` itself.",
    "NO `data_entity_filled` toggle — the data-entity tag path toggles `data_entity_filled.INTERNAL_TAGS_FILLED`; the term path has no equivalent completeness bit. `TermServiceImpl.upsertTags` does not call `dataEntityFilledService` (`TermServiceImpl.java:254-264`)."
  ]
- audiences: [
    "ODD Platform UI — the term-details page tag panel uses this endpoint (the generated `TermApi.createTermTagsRelations` client method; the UI thunk was not read in this session — REFERENCE to a future term-UI sidecar).",
    "Callers WITH the `TERM_TAGS_UPDATE` Permission resolved against this term-id under `LOGIN_FORM | OAUTH2 | LDAP` — typically: (a) callers holding an unconditional admin Policy granting `TERM_TAGS_UPDATE`, OR (b) callers whose Policy conditionally grants `TERM_TAGS_UPDATE` scoped to terms (the exact `TERM`-scope condition vocabulary is resolved by the `TERM` `AuthorizationManagerType`; the specific resolver class was not read this session — confidence on the conditional-grant shape is MEDIUM)",
    "Third-party API consumers reading the OpenAPI spec — the spec summary `Creates tags relations for term` (`openapi.yaml:3185`) implies additive semantics; a consumer sending repeated calls expecting cumulative tagging will silently drop tags between calls"
  ]

## dependencies_semantic

- requires-feature: [
    "tagging feature — the term-side write path for tag relations. Pairs with `DataEntityController.createDataEntityTagsRelations` (the data-entity-side path, already enriched) and `TagController` (admin directory CRUD: `POST /api/tags` gated by `TAG_CREATE`).",
    "glossary / terms feature — the endpoint is mounted on `TermController` and operates on `term` rows; terms are the business-glossary concept defined in `V0_0_35__add_terms.sql`.",
    "authorization / policy framework — the per-term `SecurityRule` (`SecurityConstants.java:185-186`) that turns `TERM_TAGS_UPDATE` into a per-resource permission gate via the `TERM` `AuthorizationManagerType`",
    "term search-index pipeline — `termSearchEntrypointRepository.updateTagVectorsForTerm(termId)` (`TermServiceImpl.java:261`) refreshes the term `tag_vector` (one component of the `term_search_entrypoint.search_vector` generated column, `V0_0_35__add_terms.sql:58-73`) so the new tag set is term-searchable"
  ]
- requires-config: [] — N/A. The method reads no config; the gating `SecurityRule` is unconditional, not `@ConditionalOnProperty`-gated.
- requires-runtime: [
    "Spring WebFlux runtime — `Mono<ResponseEntity<Flux<Tag>>>` return type and `ServerWebExchange exchange` parameter (`TermController.java:129-136`); the response is a streaming `Flux<Tag>` lifted into a single `ResponseEntity` envelope by `Mono.just(ResponseEntity.ok(tagsFormData.flatMapMany(...)))`.",
    "jOOQ reactive DB session — `ReactiveTagRepositoryImpl.listByTerm` (`ReactiveTagRepositoryImpl.java:128-135`), `deleteTermRelations(termId, idsToDelete)` (`ReactiveTagRepositoryImpl.java:267-277`), `listByNames` (`ReactiveTagRepositoryImpl.java:120-125`), `bulkCreate` via `ReactiveAbstractCRUDRepository.bulkCreate` (`ReactiveAbstractCRUDRepository.java:113-126`), `createTermRelations` (`ReactiveTagRepositoryImpl.java:326-347`), plus `updateTagVectorsForTerm` (`ReactiveTermSearchEntrypointRepositoryImpl.java:111`)",
    "Postgres `tag` table — `(id PK, name NOT NULL, important BOOLEAN, deleted_at)` with a partial unique index on `(name)` for non-soft-deleted rows (the index migration was not read this session — the partial-unique-on-name fact is inherited from the sibling `createDataEntityTagsRelations` sidecar at confidence MEDIUM; `listByNames` adds `addSoftDeleteFilter` at `ReactiveTagRepositoryImpl.java:122`, confirming soft-delete is part of the `tag` model)",
    "Postgres `tag_to_term` table — `(tag_id, term_id)`, primary key `(tag_id, term_id)`, FKs to `tag` and `term`; `deleted_at` column DROPPED by `V0_0_76__term_relations_hard_delete.sql:12-13` — the relation is HARD-deleted, no soft-delete on `tag_to_term`",
    "Postgres `term` table — the `{term_id}` path variable references `term.id` (`V0_0_35__add_terms.sql:1-14`)"
  ]
- couples-to: [
    "`TermApi.createTermTagsRelations` (build-time-generated interface from `openapi.yaml:3183-3204`) — supplies `@RequestMapping(method = PUT, value = '/api/terms/{term_id}/tags')`, the OpenAPI-declared 200 response with `TagList` schema. The controller `@Override` (`TermController.java:129-136`) inherits the routing. The generated `TermApi` source is not in the repo (generated at build).",
    "`TermService.upsertTags(Long, TagsFormData)` (`TermService.java:46`, impl `TermServiceImpl.java:254-264`) — sole downstream call; `@ReactiveTransactional`, NO `@ActivityLog`.",
    "`TagService.deleteRelationsWithTerm(long, Set<String>)` (`TagService.java:31-32`, impl `TagServiceImpl.java:124-134`) — phase-1 worker; the `Set<String>` parameter is named `tagsToKeep`.",
    "`TagService.getOrCreateTagsByName(Set<String>)` (`TagService.java:24`, impl `TagServiceImpl.java:80-86`) — the auto-create-on-miss surface, shared with `updateRelationsWithDataEntity`.",
    "`TagService.createRelationsWithTerm(long, List<TagPojo>)` (`TagService.java:34-35`, impl `TagServiceImpl.java:138-142`) — phase-2 relation insert.",
    "`SecurityConstants.SECURITY_RULES` entry at `SecurityConstants.java:185-186` — `new SecurityRule(TERM, new PathPatternParserServerWebExchangeMatcher('/api/terms/{term_id}/tags', PUT), TERM_TAGS_UPDATE)`; the authoritative authorization gate.",
    "`PolicyPermissionDto.TERM_TAGS_UPDATE` (`PolicyPermissionDto.java:48`, `TERM`-scoped) and `PolicyPermissionDto.TAG_CREATE` (`PolicyPermissionDto.java:62`, `MANAGEMENT`-scoped) — the two permissions whose scope asymmetry produces the side-door (term-scoped tag-edit permission mints `MANAGEMENT`-scoped directory rows).",
    "`ReactiveTermSearchEntrypointRepository.updateTagVectorsForTerm(long)` (`ReactiveTermSearchEntrypointRepository.java:13`, impl `ReactiveTermSearchEntrypointRepositoryImpl.java:111-121`) — refreshes the term `tag_vector`."
  ]

## tests_coverage_semantic

- covered_behaviours: [] — N/A. No test exercises any layer of this endpoint's chain. `grep` for `upsertTags`, `createTermTagsRelations`, `deleteRelationsWithTerm`, `createRelationsWithTerm`, `updateTagVectorsForTerm` across `odd-platform-api/src/test` returned NO matches (verified this session). The data-entity sibling at least has repository-level `TagRepositoryImplTest` coverage of `bulkCreate` / `createRelationsWithDataEntity` / `deleteRelations`; the term-relation methods (`deleteTermRelations`, `createTermRelations`, `listByTerm`) have no test cited.
- uncovered_behaviours:
  - behaviour: "HTTP-level smoke test — `PUT /api/terms/{id}/tags` request -> controller -> service -> 200 `Flux<Tag>` response."
    test_class: integration
    criticality: HIGH
    note: "No `@WebFluxTest(TermController.class)` or `WebTestClient` test asserts the endpoint end-to-end."
  - behaviour: "Replace-all semantics — submitting `tag_name_list: ['x']` on a term currently tagged `{a, b}` removes `a` and `b` and leaves `{x}`."
    test_class: integration
    criticality: HIGH
    note: "This is the central operator-surprising semantic (operationId says `create`); pinned by probe P-027."
  - behaviour: "Empty-list clear — `tag_name_list: []` removes ALL tag relations for the term."
    test_class: integration
    criticality: HIGH
    note: "A buggy client that forgets to populate the array silently clears a term's tags; pinned by probe P-027."
  - behaviour: "Auto-create-on-miss — `tag_name_list: ['never-seen-name']` creates a fresh `tag` directory row with `important = false`, visible to subsequent `GET /api/tags/popular` callers."
    test_class: integration
    criticality: HIGH
    note: "The OpenAPI spec promises this (`openapi.yaml:3186`); no test verifies the promise holds; pinned by probe P-027."
  - behaviour: "Authorization regression — a caller WITHOUT `TERM_TAGS_UPDATE` for this term-id receives 403; a caller WITH it (admin or term-scoped) receives 200."
    test_class: security
    criticality: HIGH
    note: "No test asserts the `SecurityRule` at `SecurityConstants.java:185-186` is enforced, nor that `TERM_TAGS_UPDATE` (not `TERM_UPDATE`) is the gate."
  - behaviour: "Auth-mode coverage — `DISABLED / LOGIN_FORM / OAUTH2 / LDAP` against this endpoint; DISABLED-bypass behaviour is unverified."
    test_class: security
    criticality: MEDIUM
  - behaviour: "Unique-index race — two concurrent PUTs submitting the same novel tag name; the directory `bulkCreate` has no `ON CONFLICT`."
    test_class: integration
    criticality: MEDIUM
    note: "Pinned by probe P-028."
  - behaviour: "Term search-vector refresh — `updateTagVectorsForTerm` actually runs after a successful upsert and a term search for the new tag returns this term."
    test_class: integration
    criticality: LOW
  - behaviour: "Tag-name validation absence — `tag_name_list` items with empty strings, leading/trailing whitespace, 10K-char strings, control characters; no trim/normalise in `divideTagsByExistence`."
    test_class: integration
    criticality: MEDIUM
- test_files: [] — no term-tag test file exists; `grep -rln 'upsertTags\|createTermTagsRelations\|deleteRelationsWithTerm' <odd-platform-repo>/odd-platform-api/src/test` returned no matches.
- gaps: |
    The term-tag write path is entirely untested across all four orthogonal
    classes — there is no unit, integration, performance, or security test
    touching `TermController.createTermTagsRelations`, `TermServiceImpl.upsertTags`,
    `TagServiceImpl.deleteRelationsWithTerm`, or `TagServiceImpl.createRelationsWithTerm`.
    The worst-coverage class is **integration**: the load-bearing semantic
    (replace-all + empty-list-clears-all + auto-create) is exactly the kind of
    cross-layer behaviour that a unit test with a mocked `TagService` cannot
    catch. The highest-leverage gap is an integration test pinning the
    replace-all behaviour: a regression that, for example, made
    `deleteRelationsWithTerm` additive would silently change the contract with
    the build still green. The **security** class is the second-worst gap: no
    test confirms `TERM_TAGS_UPDATE` is the gate — a regression swapping it for
    `TERM_UPDATE` (a plausible copy-paste error given the adjacent rules in
    `SecurityConstants.java:174-186`) would broaden or narrow access with no
    test failure. Probes P-027 (replace-all + auto-create + empty-list) and
    P-028 (unique-index race) cover the integration gaps; the auth-matrix gap
    needs a separate security probe.

## docs_link_semantic

- declared_docs: [] — N/A. The source file carries no `@docs` Javadoc annotation (consistent with the `odd-platform-api` convention — no `@docs` annotations are bootstrapped in this repo). An in-spec textual description IS present at `openapi.yaml:3186`: "Creates tags relations for term. Also creates corresponding tags in the system if they don't exist." — the closest the project has to a self-declared documentation pointer; it explicitly names the auto-create side effect but uses create-language for replace-all semantics.
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions"
    anchor: ""
    rationale: "Defines `TERM_TAGS_UPDATE` and `TAG_CREATE` — the two permissions whose scope asymmetry is the central authorization finding for this endpoint."
    last_verified_at: "2026-05-21"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      WebFetched live 2026-05-21, HTTP 200. The page lists 79 permissions
      across five categories (Data entity 25, Term 7, Query Example 7,
      Lookup table 9, Management 26, plus `ALL`). Verbatim quotes returned:
      - `TERM_TAGS_UPDATE`: "Allows editing tags for a term."
      - `TERM_UPDATE`: "Allows editing the name, namespace, and definition of a term."
      - `TAG_CREATE`: "Allows creating a new tag."
      The page documents `TERM_TAGS_UPDATE` as the term-tag-edit permission
      (matching `SecurityConstants.java:185-186`) — so the gate choice IS
      reflected in the docs. The page does NOT note that exercising
      `TERM_TAGS_UPDATE` can also create global `tag` rows (the side-door),
      nor that the operation is replace-all. confidence LOW because the
      anchor for the exact `TERM_TAGS_UPDATE` row was not pinned — only the
      page-level fetch confirmed the text.
  - url: "https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization"
    anchor: ""
    rationale: "Authorization-framework overview — explains the Policies / Permissions / Roles model that the `TERM` `AuthorizationManagerType` plugs into."
    last_verified_at: "2026-05-21"
    last_verified_status: 200
    confidence: LOW
    fetched_excerpts: |
      WebFetched live 2026-05-21, HTTP 200. The page is a high-level
      overview (table of contents linking Policies / Permissions / Roles /
      Owners / User-owner association); it does NOT detail individual
      permissions or term-level tag operations — it points to the dedicated
      Permissions page for that.
- doc_drift_findings:
  - "**The `createTermTagsRelations` operationId / OpenAPI summary use create-language for a replace-all operation.** `openapi.yaml:3185` reads `summary: Creates tags relations for term` and the `operationId` is `createTermTagsRelations`; the implementation (`TermServiceImpl.java:254-264` -> `TagServiceImpl.deleteRelationsWithTerm:124-134`) deletes every tag relation absent from the submitted list. A third-party API consumer reading only the spec who sends repeated `PUT` calls expecting cumulative tagging will silently lose tags between calls. Same drift shape as the data-entity sibling — surface to doc-gap-finder as a DOC-NNN candidate: 'Document the term-tag PUT as replace-all; empty `tag_name_list` clears all term tags.'"
  - "**The auto-create side effect is documented at the spec layer but its permission-asymmetry consequence is not.** `openapi.yaml:3186` says 'Also creates corresponding tags in the system if they don't exist.' — the auto-create itself is acknowledged. But neither the spec nor the live Permissions doc page describes that `TERM_TAGS_UPDATE` (a `TERM`-scoped permission, per `PolicyPermissionDto.java:48`) thereby mints `MANAGEMENT`-scoped global `tag` directory rows that `TAG_CREATE` (`PolicyPermissionDto.java:62`) is the documented gate for. The Permissions doc says `TERM_TAGS_UPDATE` 'Allows editing tags for a term' and `TAG_CREATE` 'Allows creating a new tag' — an operator reading those two lines cannot infer that the former is also a path to the latter."
  - "**The `important` field is not documented and auto-created term tags get `important = false`.** `TagsFormData` (`components.yaml:2212-2220`) has no `important` field — only `tag_name_list`. Tags auto-created via this endpoint get `important = false` hardcoded (`TagServiceImpl.java:155`). A user expecting their term tags to be 'important' must follow up with `PUT /api/tags/{tag_id}` (gated by `TAG_UPDATE`). The semantics of `important` are not documented at the API surface."
  - "**No documented difference between term-tag and data-entity-tag behaviour.** The term path emits no activity-feed event and has no external-tag carve-out; the data-entity path does both. Neither divergence is documented anywhere — an operator who knows the data-entity tag behaviour will incorrectly assume the term path behaves identically (e.g. expecting a term-tag change to appear in the activity feed)."

## implicit_adrs

- "Term-tag management has a DEDICATED permission (`TERM_TAGS_UPDATE`), distinct from the general term-edit permission (`TERM_UPDATE`) — `SecurityConstants.java:185-186` registers `PUT /api/terms/{term_id}/tags` with `TERM_TAGS_UPDATE`, while `PUT /api/terms/{term_id}` (the name/definition edit) uses `TERM_UPDATE` (`SecurityConstants.java:174`). Both are `TERM`-scoped (`PolicyPermissionDto.java:43, 48`). The intent — visible in the deliberate separate enum member and separate `SecurityRule` — is that editing a term's TAGS is a distinct grant from editing its name/definition: an operator can author a Policy that lets a role tag terms without letting it rename them. The live Permissions doc confirms the split with two distinct one-sentence definitions ('Allows editing tags for a term' vs 'Allows editing the name, namespace, and definition of a term')." — evidence: `SecurityConstants.java:185-186` (`new SecurityRule(TERM, ..."/api/terms/{term_id}/tags", PUT), TERM_TAGS_UPDATE)`) + `SecurityConstants.java:174` (`TERM_UPDATE` for `/api/terms/{term_id}` PUT) + `PolicyPermissionDto.java:43, 48` — intent_anchor: "new SecurityRule(TERM, new PathPatternParserServerWebExchangeMatcher(\"/api/terms/{term_id}/tags\", PUT), TERM_TAGS_UPDATE)" (`SecurityConstants.java:185-186`) — confidence: HIGH

- "Term-tag relations are HARD-deleted, not soft-deleted — `V0_0_76__term_relations_hard_delete.sql:8-13` deletes all soft-deleted `tag_to_term` rows and DROPS the `deleted_at` column. The `deleteTermRelations` SQL (`ReactiveTagRepositoryImpl.java:267-277`) is a `DSL.deleteFrom(TAG_TO_TERM)` — a physical DELETE. The migration filename `term_relations_hard_delete` plus the column drop is the evidence of intent: term relations (`tag_to_term`, `data_entity_to_term`) were deliberately moved off soft-delete. The intent is that a removed term-tag relation leaves no tombstone — replace-all genuinely discards history at the relation level." — evidence: `V0_0_76__term_relations_hard_delete.sql:8-13` (delete soft-deleted rows + `ALTER TABLE tag_to_term DROP COLUMN IF EXISTS deleted_at`) + `ReactiveTagRepositoryImpl.java:267-277` (`deleteFrom(TAG_TO_TERM)` physical delete) — intent_anchor: "ALTER TABLE tag_to_term DROP COLUMN IF EXISTS deleted_at" (`V0_0_76__term_relations_hard_delete.sql:12-13`) — confidence: HIGH

- "Term-tag relation INSERT is idempotent by design — `createTermRelations` (`ReactiveTagRepositoryImpl.java:326-347`) terminates the insert with `.onDuplicateKeyIgnore()`. The intent is that re-inserting an already-existing `tag_to_term` row (primary key `(tag_id, term_id)`, `V0_0_35__add_terms.sql:24`) is a no-op rather than a constraint violation — the replace-all phase-2 can re-insert the full submitted set without first checking which relations already survived phase 1. This is a deliberate simplification of the diff: phase 1 deletes the unwanted, phase 2 blindly inserts the wanted, and `onDuplicateKeyIgnore` absorbs the overlap." — evidence: `ReactiveTagRepositoryImpl.java:342-346` (`insertStep.set(...).onDuplicateKeyIgnore().returning(...)`) + `V0_0_35__add_terms.sql:24` (`CONSTRAINT tag_to_term_pk PRIMARY KEY (tag_id, term_id)`) — intent_anchor: ".onDuplicateKeyIgnore()" (`ReactiveTagRepositoryImpl.java:344`) — confidence: HIGH

- "Tag auto-creation on term-tag assignment is INTENTIONAL and documented at the spec layer — `openapi.yaml:3186` explicitly reads 'Also creates corresponding tags in the system if they don't exist.' This is the same deliberate low-friction UX decision as the data-entity tag path: typing a new tag in the term UI just works, no separate admin step. The decision encodes 'tagging is a low-friction operation; gate it at the term level, not the directory level'. The trade-off — `TERM_TAGS_UPDATE` becomes a side-door past `TAG_CREATE` — is the structural consequence (see `bugs_limitations_corner_cases`)." — evidence: `openapi.yaml:3185-3186` (operation summary + description) + `TagServiceImpl.java:80-86` (`getOrCreateTagsByName`) + `TagServiceImpl.java:144-159` (`divideTagsByExistence` auto-create) + `TermServiceImpl.java:257` (call site inside `upsertTags`) — intent_anchor: "description: Creates tags relations for term. Also creates corresponding tags in the system if they don't exist." (`openapi.yaml:3186`) — confidence: HIGH

- "`important = false` default for auto-created tags is hardcoded — `divideTagsByExistence` (`TagServiceImpl.java:155`) maps every to-create name to `new TagPojo().setName(n).setImportant(false)`. The intent is to keep the side-channel benign at the directory level: tags created via the term-tag path do not inherit any 'promoted' status; only an explicit `POST /api/tags` or `PUT /api/tags/{id}` (management-gated) can mark a tag `important`. Shared with the data-entity tag path — same code." — evidence: `TagServiceImpl.java:155` (`.map(n -> new TagPojo().setName(n).setImportant(false))`) — intent_anchor: ".setImportant(false)" (`TagServiceImpl.java:155`) — confidence: HIGH

## bugs_limitations_corner_cases

- "**Operation name vs behaviour drift: PUT replace-all under create-language naming.** The OpenAPI `operationId` (`createTermTagsRelations`), the spec summary (`Creates tags relations for term`, `openapi.yaml:3185`), and the controller method name all say 'create' for an operation that deletes. `TermServiceImpl.upsertTags` (`TermServiceImpl.java:256`) calls `tagService.deleteRelationsWithTerm(termId, names)` FIRST, which removes every `tag_to_term` row whose tag name is absent from `tag_name_list` (`TagServiceImpl.java:124-134`). A consumer sending `PUT /api/terms/{id}/tags` with `tag_name_list: ['new']` expecting 'add new, keep existing' loses ALL other term tags. Unlike the data-entity sibling — where the UI thunk is named `updateDataEntityTagsActionType`, masking the drift for UI users — the term UI usage was not inspected this session, so it is unknown whether the term UI masks the drift; third-party API consumers reading only the spec have no warning regardless." — evidence: `openapi.yaml:3185` (`summary: Creates tags relations for term`) + `TermController.java:130` (method named `createTermTagsRelations`) + `TermServiceImpl.java:256` (`deleteRelationsWithTerm` called first) + `TagServiceImpl.java:124-134` (the actual delete-by-name-absence logic) — severity: MEDIUM

- "**Empty `tag_name_list` silently clears ALL term tags.** `TagsFormData` declares `tag_name_list` REQUIRED (`components.yaml:2219-2220`) but an empty array `[]` satisfies the constraint — there is no `minItems`. `PUT /api/terms/{id}/tags` with `{\"tag_name_list\": []}` flows through `new HashSet<>(emptyList)` (`TermServiceImpl.java:255`), and `deleteRelationsWithTerm(termId, emptySet)` computes `idsToDelete = currentTags where name NOT IN {}` — i.e. EVERY current tag (`TagServiceImpl.java:129-131`). A buggy client that forgets to populate `tag_name_list` silently wipes a term's tag set. There is no separate DELETE endpoint and no empty-list guard. Pinned by probe P-027." — evidence: `components.yaml:2219-2220` (`required: - tag_name_list`, no `minItems`) + `TermServiceImpl.java:255` (`new HashSet<>(tagsFormData.getTagNameList())`) + `TagServiceImpl.java:129-131` (`filter(l -> !tagsToKeep.contains(l.getName()))` — empty `tagsToKeep` selects all) — severity: MEDIUM

- "**Permission side-door: `TERM_TAGS_UPDATE` mints global Tag directory rows without `TAG_CREATE`.** A caller with `TERM_TAGS_UPDATE` on any single term can submit `tag_name_list: ['arbitrary-new-name']` and a new row appears in the global `tag` directory (visible to every other user via `GET /api/tags/popular`). The scope asymmetry exacerbates it: `TAG_CREATE` is `MANAGEMENT`-scoped (`PolicyPermissionDto.java:62`, unconditional in shape), while `TERM_TAGS_UPDATE` is `TERM`-scoped (`PolicyPermissionDto.java:48`, conditionally grantable). The live Permissions doc documents `TERM_TAGS_UPDATE` as 'Allows editing tags for a term' and `TAG_CREATE` as 'Allows creating a new tag' — an operator reading those cannot tell the former is also a path to the latter. Same pattern shape as the data-entity tag side-door; the auto-create itself is spec-acknowledged (`openapi.yaml:3186`) so it routes to `implicit_adrs` for intent, but the cross-tenant pollution + permission-boundary erosion is the limitation." — evidence: `TagServiceImpl.java:80-86` (`getOrCreateTagsByName`) + `TagServiceImpl.java:144-159` (`divideTagsByExistence`) + `TermServiceImpl.java:257` (call site) + `SecurityConstants.java:138` (`TAG_CREATE` gates `POST /api/tags`) + `SecurityConstants.java:185-186` (this endpoint gated by `TERM_TAGS_UPDATE`) + `PolicyPermissionDto.java:48, 62` (scope asymmetry: `TERM` vs `MANAGEMENT`) — severity: MEDIUM

- "**No activity-feed audit for term-tag changes.** There is no `@ActivityLog` on `TermController.createTermTagsRelations` (`TermController.java:129-136`), on `TermServiceImpl.upsertTags` (`TermServiceImpl.java:252-264`), or on the `TagServiceImpl` methods. Other term mutations on the SAME service DO carry `@ActivityLog` — `linkTermWithDataEntity` (`TermServiceImpl.java:169`), `removeTermFromDataEntity` (`TermServiceImpl.java:183`) emit `TERM_ASSIGNMENT_UPDATED`. The data-entity tag sibling emits `TAG_ASSIGNMENT_UPDATED`. An operator auditing 'who changed the tags on term X?' through the activity feed finds NO record — term-tag changes are invisible to the audit trail. The asymmetry (term-tag change unaudited, term-data-entity link audited, data-entity-tag change audited) is most likely an oversight rather than intent — no comment, exception, or convention defends the absence." — evidence: `TermController.java:129-136` (no `@ActivityLog`) + `TermServiceImpl.java:252-264` (`upsertTags` — no `@ActivityLog`) + `TermServiceImpl.java:169, 183` (`@ActivityLog(event = TERM_ASSIGNMENT_UPDATED)` on sibling methods) + `DataEntityServiceImpl.java:358` (`@ActivityLog` on the data-entity tag path, per the sibling sidecar) — severity: MEDIUM

- "**Unique-index race on concurrent novel-tag creation.** `getOrCreateTagsByName` (`TagServiceImpl.java:80-86`) reads `listByNames` first, then `bulkCreate` for the missing names. The directory `bulkCreate` (`ReactiveAbstractCRUDRepository.java:113-126` -> `insertManyReturning`) is a plain INSERT with NO `ON CONFLICT`. Two concurrent requests submitting the same novel `tag_name` both pass `listByNames` and both call `bulkCreate`; the `tag`-table partial unique index on `(name)` lets one INSERT win and rejects the other with an integrity-constraint violation. Because `upsertTags` is `@ReactiveTransactional` (`TermServiceImpl.java:253`), the losing request's WHOLE transaction rolls back — the caller's term-relation writes are lost too, not just the directory row. NOTE: the term-RELATION insert (`createTermRelations`) uses `.onDuplicateKeyIgnore()` (`ReactiveTagRepositoryImpl.java:344`) and does NOT race; only the global `tag` directory insert does. Pinned by probe P-028. Confidence on the exact partial-unique-index definition is MEDIUM — the index migration was not read this session; the index's existence is inherited from the sibling sidecar and confirmed indirectly by `listByNames` applying `addSoftDeleteFilter` (`ReactiveTagRepositoryImpl.java:122`)." — evidence: `TagServiceImpl.java:80-86` (`getOrCreateTagsByName`) + `TagServiceImpl.java:144-159` (`divideTagsByExistence`) + `ReactiveAbstractCRUDRepository.java:113-126` (`bulkCreate` plain INSERT, no `ON CONFLICT`) + `ReactiveTagRepositoryImpl.java:120-125` (`listByNames`) + `ReactiveTagRepositoryImpl.java:344` (term-relation insert DOES use `onDuplicateKeyIgnore`) + `TermServiceImpl.java:253` (`@ReactiveTransactional`) — severity: LOW (narrow race window; under `@ReactiveTransactional` the whole PUT fails, so the caller sees an error rather than silent corruption)

- "**No length / character-set / whitespace validation on `tag_name_list` items.** The OpenAPI schema declares `tag_name_list: array of type: string` (`components.yaml:2215-2218`) with no `maxLength`, no `pattern`, no `minLength`. `TermServiceImpl.upsertTags` does not trim or normalise input (`TermServiceImpl.java:254-255`); `divideTagsByExistence` passes names verbatim into `new TagPojo().setName(n)` (`TagServiceImpl.java:155`). A caller submitting `[' tag ', 'tag']` creates two directory rows (whitespace-padded vs unpadded); a 10K-char string reaches the DB column constraint; homoglyph variants produce distinct rows. The term-tag path shares this gap with the data-entity tag path — same `getOrCreateTagsByName` code." — evidence: `components.yaml:2215-2218` (no per-item constraint) + `TermServiceImpl.java:254-255` (no trim/normalise) + `TagServiceImpl.java:155` (`new TagPojo().setName(n)` — verbatim) — severity: MEDIUM

- "**Under `auth.type=DISABLED`, the `TERM_TAGS_UPDATE` `SecurityRule` is bypassed.** Per the cross-batch DISABLED-bypass pattern (the `DisabledAuthSecurityConfiguration` permits all exchanges and the `AuthorizationCustomizer` is not installed — sibling sidecar evidence), anonymous callers can `PUT /api/terms/{id}/tags` and (a) overwrite the tag set for any term, (b) mint arbitrary new `tag` directory rows. No activity-feed event fires either way (this endpoint has no `@ActivityLog`), so a DISABLED-deployment term-tag overwrite is doubly invisible — no auth AND no audit. DISABLED is documented as dev-only. Confidence MEDIUM — `DisabledAuthSecurityConfiguration` was not read in THIS session; the bypass behaviour is inherited from the sibling sidecar and the batch-A/B/C/E/F DISABLED-bypass case-law." — evidence: `SecurityConstants.java:185-186` (rule exists) + cross-ref `createDataEntityTagsRelations` sidecar `bugs_limitations_corner_cases` (DISABLED-bypass, citing `DisabledAuthSecurityConfiguration.java:9-19`) — severity: MEDIUM (HIGH under DISABLED on a network-reachable port; LOW if DISABLED is honestly dev-only)

- "**`createTermRelations` builds the multi-row INSERT with manual record iteration — fragile for the single-element edge.** `ReactiveTagRepositoryImpl.java:336-346` does `for (i = 0; i < records.size() - 1; i++) insertStep = insertStep.set(records.get(i)).newRecord();` then `insertStep.set(records.get(records.size() - 1))`. For `records.size() == 1` the loop body never runs and the final `set` handles the single record — correct. For `records.size() == 0` the method early-returns `Flux.just()` at line 327-329 BEFORE this code. So the edge cases are handled, but the hand-rolled iteration (vs a `bulkCreate`-style helper) is a maintenance hazard: a future edit that removes the `tagIds.isEmpty()` guard would `IndexOutOfBounds` on `records.get(-1)`. Noted as a code-quality observation, not a live bug." — evidence: `ReactiveTagRepositoryImpl.java:327-346` (the empty-guard + manual iteration) — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables: []   # No numeric literals, @Value defaults, magic strings, or
                 # constant declarations in TermController.java:129-136 or in
                 # TermServiceImpl.upsertTags:254-264. The method body is pure
                 # delegation; no limit / size / timeout / retry literal.
  name_behavior_pairs:
    - name: "createTermTagsRelations / TermService.upsertTags"
      promise: "The operationId and OpenAPI summary ('Creates tags relations for term') promise an additive create — submit tag names, relations get created for the term."
      implementation: "Replace-all. TermServiceImpl.upsertTags (TermServiceImpl.java:254-264) calls tagService.deleteRelationsWithTerm(termId, names) FIRST (TagServiceImpl.java:124-134), which reads current term tags via listByTerm and deletes every tag_to_term row whose tag NAME is absent from the submitted tag_name_list; THEN getOrCreateTagsByName + createRelationsWithTerm (re)inserts the submitted set. The method is named `upsertTags` at the service layer — closer to the truth — but the operationId and spec summary say `create`."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "A consumer sending PUT with tag_name_list:['new'] on a term tagged {a,b} ends with {new} — a and b relations are deleted, not preserved. A repeated-call additive expectation silently loses tags."
      confidence: STATIC-INFERRED
      evidence: "openapi.yaml:3185 + TermController.java:130 + TermServiceImpl.java:256 + TagServiceImpl.java:124-134"
    - name: "TagService.deleteRelationsWithTerm"
      promise: "The verb `delete` promises rows are removed."
      implementation: "Rows ARE removed — but the method is the DELETE PHASE of a replace-all, not a standalone delete. It deletes term tags whose name is NOT in the `tagsToKeep` set. The method name and parameter name (`tagsToKeep`) are internally honest; the drift is purely at the operationId/spec layer above."
      drift: NONE
      operator_visible_consequence: ""
      confidence: STATIC-INFERRED
      evidence: "TagServiceImpl.java:124-134 + TagService.java:31-32"
  orderings:
    - location: "TagServiceImpl.java:124-134 (deleteRelationsWithTerm) + ReactiveTagRepositoryImpl.java:128-135 (listByTerm)"
      questions:
        - q: "What is the actual ORDER BY at the lowest layer?"
          a: "None. listByTerm (ReactiveTagRepositoryImpl.java:128-135) has no ORDER BY clause; createTermRelations (ReactiveTagRepositoryImpl.java:326-347) is an INSERT; deleteTermRelations (ReactiveTagRepositoryImpl.java:267-277) is a DELETE. The response Flux<Tag> order is whatever order the in-memory tagsToLink list holds — ListUtils.union(createdTags, existingTags) in getOrCreateTagsByName (TagServiceImpl.java:84): created tags first, then existing tags, each sublist in DB-return order with no explicit sort."
          confidence: STATIC-INFERRED
          evidence: "ReactiveTagRepositoryImpl.java:128-135 + TagServiceImpl.java:80-86"
        - q: "What is the tie-breaker when sort-key values are equal?"
          a: "N/A — there is no sort key. The response is not a ranked list; it is the term's full tag set after the upsert. Order is non-deterministic from the caller's perspective."
          confidence: STATIC-INFERRED
          evidence: "TagServiceImpl.java:80-86 (ListUtils.union, no sort)"
        - q: "Which subset is returned when result-set > page size?"
          a: "N/A — the endpoint has no pagination. It returns the complete post-upsert tag set for the term as a Flux<Tag>; size is bounded by the number of tags on the term."
          confidence: STATIC-INFERRED
          evidence: "TermController.java:129-136 (no page/size params) + openapi.yaml:3183-3204 (no pagination parameters)"
        - q: "Does any upstream layer re-sort or filter the result?"
          a: "Not in this sidecar's scope. TermController lifts the Flux unchanged into ResponseEntity.ok (TermController.java:133-135). Whether the term-UI re-sorts the tag list before render is a REFERENCE to a future term-UI sidecar."
          confidence: REFERENCE
          evidence: "node_id: term-UI tag-panel component (not yet enriched)"
  auth_gates:
    - location: "SecurityConstants.java:185-186"
      endpoint: "PUT /api/terms/{term_id}/tags"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "LOGIN_FORM / OAUTH2 / LDAP: the SecurityRule (SecurityConstants.java:185-186) requires TERM_TAGS_UPDATE resolved per-term via the TERM AuthorizationManagerType; a caller with the permission gets 200, without it gets 403. DISABLED: the rule is bypassed (DisabledAuthSecurityConfiguration permits all exchanges per the cross-batch pattern) — anonymous callers reach the endpoint. The exact DISABLED wiring was not read this session — confidence MEDIUM on the DISABLED branch."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:185-186 + cross-ref createDataEntityTagsRelations sidecar (DISABLED-bypass)"
        - q: "What does an unauthenticated caller see?"
          a: "Under LOGIN_FORM/OAUTH2/LDAP: redirected to login or 401 (the global security filter chain rejects before the SecurityRule resolves) — exact code is the framework's default, not determinable from this method. Under DISABLED: the call proceeds anonymously."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:185-186 + cross-ref sibling sidecar"
        - q: "What does a wrong-role caller see?"
          a: "A caller authenticated but without TERM_TAGS_UPDATE for this term-id receives 403 — the TERM AuthorizationManagerType resolves the caller's Policies against the term and denies. A caller holding TERM_UPDATE but NOT TERM_TAGS_UPDATE is also denied — the two are distinct enum members (PolicyPermissionDto.java:43, 48) and this rule checks TERM_TAGS_UPDATE specifically."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:185-186 + PolicyPermissionDto.java:43, 48"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "Centrally, in the SecurityConstants.SECURITY_RULES list (SecurityConstants.java:185-186), consumed by the AuthorizationCustomizer / WebFilter chain. NOT on the controller method (TermController.java:129-136 has no @PreAuthorize) and NOT in TermServiceImpl.upsertTags or the TagService methods (no programmatic permissionService.hasPermission call). The path-pattern rule is the sole gate."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:185-186 + TermController.java:129-136 (no annotation) + TermServiceImpl.java:254-264 (no programmatic check)"
  resource_boundaries:
    - location: "TermServiceImpl.java:253 (@ReactiveTransactional on upsertTags)"
      kind: transactional
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "Two concurrent PUTs for the SAME term: each runs delete-then-recreate inside its own transaction. The last-committed transaction's tag set wins (lost-update on the term's tag set — a classic read-modify-write race on the relation set). Two concurrent PUTs submitting the same NOVEL tag name (for any terms): the directory bulkCreate has no ON CONFLICT and one INSERT loses on the tag-table partial unique index — the losing transaction rolls back entirely (its term-relation writes too). Probe P-028 pins the directory race; the same-term lost-update is a separate concurrency probe not yet emitted."
          confidence: PROBE-NEEDED
          evidence: "P-028"
        - q: "Is the call replay-safe?"
          a: "At the relation level YES — replay-safe: createTermRelations uses .onDuplicateKeyIgnore() (ReactiveTagRepositoryImpl.java:344), so re-submitting the same tag_name_list re-runs delete (idempotent — same names kept) + insert (duplicates ignored) and converges to the same state. At the directory level NOT idempotent — a novel name creates a new tag row only on the first call; subsequent calls find it via listByNames. Replaying the SAME request is safe; replaying with a DIFFERENT list replaces the set (by design)."
          confidence: STATIC-INFERRED
          evidence: "ReactiveTagRepositoryImpl.java:344 (onDuplicateKeyIgnore) + TagServiceImpl.java:124-134 (delete is name-set-based) + TagServiceImpl.java:80-86 (getOrCreate)"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No cache. No @Cacheable on TermController.createTermTagsRelations, TermServiceImpl.upsertTags, or the TagService methods. The write goes straight to Postgres; the search-vector refresh (updateTagVectorsForTerm) is also a direct DB write."
          confidence: STATIC-INFERRED
          evidence: "TermController.java:129-136 + TermServiceImpl.java:252-264 + TagServiceImpl.java:124-142 (no @Cacheable)"
  request_inputs:
    - location: "TermController.java:130 (term_id path variable)"
      input_kind: path-param
      input_name: "termId"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "The id of the term whose tag set is being replaced."
          confidence: STATIC-INFERRED
          evidence: "TermController.java:130 + openapi.yaml:3188-3189 (TermIdParam) + components.yaml:4314-4320"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "TermController.createTermTagsRelations(termId, ...) (TermController.java:130) -> termService.upsertTags(termId, fd) (TermController.java:134) -> TermServiceImpl.upsertTags binds it as the term_id in: tagService.deleteRelationsWithTerm(termId, names) -> SQL TAG_TO_TERM.TERM_ID.eq(termId) (ReactiveTagRepositoryImpl.java:131-132, 273); tagService.createRelationsWithTerm(termId, tagsToLink) -> SQL TagToTermPojo.setTermId(termId) (ReactiveTagRepositoryImpl.java:332); termSearchEntrypointRepository.updateTagVectorsForTerm(termId). The id is used consistently as term.id throughout."
          confidence: STATIC-INFERRED
          evidence: "TermController.java:130, 134 + TermServiceImpl.java:254-261 + ReactiveTagRepositoryImpl.java:128-135, 267-277, 326-347"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES. `termId` binds to `TAG_TO_TERM.TERM_ID` / `term.id` at every layer; no translation."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "ReactiveTagRepositoryImpl.java:131-132, 273, 332"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — MATCHES, no translation."
          confidence: STATIC-INFERRED
          evidence: "ReactiveTagRepositoryImpl.java:131-132"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE. term.id is the only term-identity column and it is the one used. No FK validation that the term exists before the tag write — if term_id does not exist, deleteRelationsWithTerm finds no relations and createTermRelations would raise the tag_to_term_term_id_fkey FK violation (V0_0_35__add_terms.sql:26). A non-existent term-id is rejected by the DB FK, not by an application-layer NotFoundException — a minor UX gap (DB error vs clean 404) but not a naming-drift issue."
          confidence: STATIC-INFERRED
          evidence: "V0_0_35__add_terms.sql:26 (tag_to_term_term_id_fkey) + TermServiceImpl.java:254-264 (no term-existence check before the write)"
      routes_to_finding: ""
    - location: "TermController.java:131 (tagsFormData request body) + components.yaml:2212-2220"
      input_kind: body-field
      input_name: "tag_name_list"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "A list of tag names. The plural `list` + the `create`-shaped operationId together imply 'the tags to add to the term'. The name does NOT signal that the list is exhaustive (a replace-all set) rather than additive."
          confidence: STATIC-INFERRED
          evidence: "components.yaml:2214-2218 (tag_name_list) + openapi.yaml:3185 (create-language summary)"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "TermController binds it as Mono<TagsFormData> (TermController.java:131); TermServiceImpl.upsertTags does new HashSet<>(tagsFormData.getTagNameList()) (TermServiceImpl.java:255); the Set<String> `names` is then used for BOTH: (1) tagService.deleteRelationsWithTerm(termId, names) where the parameter is named `tagsToKeep` (TagService.java:31-32) — the SET is the keep-list for the delete phase; (2) tagService.getOrCreateTagsByName(names) — the SET is the create/link list. The single submitted field drives delete-by-absence AND create-by-presence."
          confidence: STATIC-INFERRED
          evidence: "TermController.java:131 + TermServiceImpl.java:255-257 + TagService.java:31-32 + TagServiceImpl.java:124-134"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "TRANSLATES_SILENTLY. The field name `tag_name_list` and the `create`-shaped operationId promise an additive 'tags to add' list. The implementation treats the SAME list as an EXHAUSTIVE replace-all set: any current term tag whose name is absent is deleted (TagServiceImpl.java:129-131 — the parameter is even renamed to `tagsToKeep`, revealing the replace-all intent that the API surface hides). The translation (additive-looking input -> exhaustive set) is not documented in the spec description (openapi.yaml:3186) or anywhere a caller can see from the API surface."
          drift: DRIFT_INPUT_NAME_VS_IMPLEMENTATION
          confidence: STATIC-INFERRED
          evidence: "components.yaml:2214-2218 + openapi.yaml:3185-3186 + TagServiceImpl.java:124-134 (parameter named tagsToKeep)"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "(a) A caller sending tag_name_list:['new'] expecting 'add new' loses every other tag on the term. (b) An EMPTY list [] — a valid request body, schema only requires the field present (components.yaml:2219-2220), no minItems — clears ALL term tags: deleteRelationsWithTerm with an empty tagsToKeep set deletes everything (TagServiceImpl.java:129-131). A buggy client that omits to populate the array silently wipes the term's tags. (c) Across calls: a consumer building up tags incrementally over N requests ends each request with only that request's list. Pinned by probe P-027."
          confidence: STATIC-INFERRED
          evidence: "TagServiceImpl.java:129-131 + components.yaml:2219-2220 + TermServiceImpl.java:255"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE — tag_name_list IS used (and over-used: it drives both phases). The smell here is the inverse: a single field named additively drives an exhaustive replace. The fix anchor is the spec/operationId naming (rename to convey replace-all) OR a documented empty-list semantic, not an unused column."
          confidence: STATIC-INFERRED
          evidence: "TermServiceImpl.java:255-257"
      routes_to_finding: "bugs_limitations_corner_cases (operation-name-vs-behaviour drift + empty-list-clears-all) AND docs_link_semantic.doc_drift_findings (operationId/spec create-language for replace-all)"
  probes_emitted:
    - probe_id: P-027
      question: "Does PUT /api/terms/{id}/tags actually replace-all (drop tags absent from the list), auto-create novel tag names in the global directory with important=false, and clear all tags on an empty list?"
      probe_path: "lineage/odd-platform/probes/P-027.yaml"
    - probe_id: P-028
      question: "Do two concurrent PUTs submitting the same novel tag name collide on the tag-table partial unique index (directory bulkCreate has no ON CONFLICT)?"
      probe_path: "lineage/odd-platform/probes/P-028.yaml"
  stress_summary:
    triggers_total: 7
    questions_total: 21
    answers_static_inferred: 19
    answers_probe_needed: 1
    answers_reference: 1
    drift_flags: 1
```

## security

- **auth_mode_relevance**: `LOGIN_FORM | OAUTH2 | LDAP` — the three modes that protect the UI/API surface this controller is mounted on. Under `DISABLED` the endpoint is anonymously reachable (the `SecurityRule` remains in the list but the filter chain doesn't run — cross-batch DISABLED-bypass pattern; the exact `DisabledAuthSecurityConfiguration` wiring was not read this session, confidence MEDIUM). `S2S` is not relevant — S2S protects `/ingestion/entities` POST only; terms have no ingestion path. The method carries no `@ConditionalOnProperty`; auth wiring is enforced globally.
- **ingestion_filter_relevance**: `NO — UI/API surface, not /ingestion/entities`. Terms have no ingestion-side tagging path at all (there is no `getOrInjectTagByName` equivalent for terms — the `tag_to_term` table has no `origin`/`external` column, `V0_0_35__add_terms.sql:18-28`).
- **authorization_assertions**:
  - "`SecurityRule(TERM, '/api/terms/{term_id}/tags' PUT, TERM_TAGS_UPDATE)` — registered at `SecurityConstants.java:185-186`, consumed by the `AuthorizationCustomizer` to add a per-term permission check. The `TERM` `AuthorizationManagerType` resolves `term_id` from the path and evaluates the caller's Policies against that term. `TERM_TAGS_UPDATE` is a DEDICATED permission, distinct from `TERM_UPDATE` (`PolicyPermissionDto.java:43, 48`)." — evidence: `SecurityConstants.java:185-186`
- **owner_scoping**: `RESPECTS at the term layer; BYPASSES at the Tag directory layer` — authorization is per-term (the `TERM` `AuthorizationManagerType` resolves against the specific `term_id` from the path). However, the resulting `tag` directory rows are GLOBAL and visible to every other user via `GET /api/tags/popular`. A per-term write produces a global directory side effect; term-scoping does NOT extend to the Tag directory.
- **data_exposure**:
  - "`Flux<Tag>` payload (the term's full post-upsert tag set — `id`, `name`, `important`, `external`, `usedCount` per `Tag` row) → caller WITH `TERM_TAGS_UPDATE` resolved against this term-id under `LOGIN_FORM/OAUTH2/LDAP`." — evidence: `TermController.java:129-136` + `TermServiceImpl.java:254-264`
  - "Tag directory side effect: a previously-non-existent `tag_name` is added to the GLOBAL `tag` table and becomes visible to every caller of `GET /api/tags/popular` (and every surface that aggregates `tag` rows: data-entity and dataset-field tag dropdowns, search filters). The directory expansion is observable to ALL authenticated users — including users with no permission on the originating term." — evidence: `TagServiceImpl.java:80-86, 144-159` (auto-create) + cross-ref `createDataEntityTagsRelations` sidecar (`getPopularTagList` is global, no per-resource scoping)
  - "NO activity-feed record — unlike the data-entity tag path, this endpoint emits no `TAG_ASSIGNMENT_UPDATED` (or any) activity event; the term-tag change is not exposed via `ActivityController.getActivity`." — evidence: `TermController.java:129-136` + `TermServiceImpl.java:252-264` (no `@ActivityLog`)
  - "Same `Flux<Tag>` payload → ANONYMOUS callers under `auth.type=DISABLED`." — evidence: `SecurityConstants.java:185-186` + cross-ref sibling sidecar (DISABLED-bypass)
- **known_security_gaps**:
  - "Tag side-door past `TAG_CREATE` — a caller authorized for `TERM_TAGS_UPDATE` on any single term can mint global `tag` directory rows. `TERM_TAGS_UPDATE` is `TERM`-scoped (`PolicyPermissionDto.java:48`, conditionally grantable); `TAG_CREATE` is `MANAGEMENT`-scoped (`PolicyPermissionDto.java:62`). The live Permissions doc (WebFetched 2026-05-21, 200) documents `TERM_TAGS_UPDATE` as 'Allows editing tags for a term' and `TAG_CREATE` as 'Allows creating a new tag' — an operator reading those cannot determine that the former is also a path to the latter. Same pattern shape as the data-entity tag side-door." — evidence: `TagServiceImpl.java:80-86, 144-159` + `SecurityConstants.java:138, 185-186` + `PolicyPermissionDto.java:48, 62` — severity: MEDIUM
  - "No audit trail for term-tag changes — combined with the DISABLED-bypass, a term-tag overwrite under `auth.type=DISABLED` is doubly invisible: no authentication AND no activity-feed event. Even under `LOGIN_FORM/OAUTH2/LDAP`, an operator cannot answer 'who changed term X's tags?' from the activity feed." — evidence: `TermController.java:129-136` + `TermServiceImpl.java:252-264` (no `@ActivityLog`) — severity: MEDIUM
  - "Cross-tenant Tag pollution — there is no organisation/tenant/namespace at the `tag` directory level. A `TERM_TAGS_UPDATE`-holder can mint `tag` rows that appear in every other user's popular-tags surface and search dropdowns. Combined with the absence of tag-name validation (no length/pattern/charset), this enables directory-saturation denial-of-service. Same shape as the data-entity tag path." — evidence: `TagServiceImpl.java:80-86` + `components.yaml:2215-2218` (no validation) — severity: MEDIUM
  - "Under `auth.type=DISABLED`, the endpoint is anonymously reachable — anyone with network access to the ODD Platform port can `PUT /api/terms/{id}/tags` and (a) overwrite a term's tag set, (b) mint arbitrary `tag` directory rows. DISABLED is documented as dev-only. Confidence MEDIUM — `DisabledAuthSecurityConfiguration` was not read this session." — evidence: `SecurityConstants.java:185-186` + cross-ref `createDataEntityTagsRelations` sidecar — severity: MEDIUM (HIGH on a network-reachable port)

## performance

- **hot_paths**:
  - "Term-tag upsert is on the term-details-page WRITE path, not the read path. Per-call DB cost: 1× `listByTerm(termId)` (current relations), 1× `deleteTermRelations(termId, idsToDelete)` (0 rows if nothing to remove), 1× `listByNames(submittedNames)` (split existing/new), 0 or 1× `bulkCreate(toCreate)` (only when novel names present), 1× `createTermRelations(termId, ids)`, 1× `updateTagVectorsForTerm(termId)`. Roughly 5-6 DB round-trips per call. Lower than the data-entity sibling (~7-8) — the term path has no `data_entity_filled` toggle and no separate full re-read." — evidence: `TermServiceImpl.java:254-264` + `TagServiceImpl.java:124-142`
- **throughput_characteristics**:
  - "Single reactive call returning a streaming `Flux<Tag>` wrapped in a single `ResponseEntity` — `Mono.just(ResponseEntity.ok(tagsFormData.flatMapMany(...)))` (`TermController.java:133-135`). Non-blocking I/O; no thread held during DB awaits." — evidence: `TermController.java:129-136`
  - "Per-request cost scales with `|tag_name_list|` — `listByNames(names)` is a single query with an `IN(...)` clause; `bulkCreate(toCreate)` is a single batched INSERT; `createTermRelations` builds a multi-row INSERT by hand-iterating records (`ReactiveTagRepositoryImpl.java:336-346`). Cost bounded by the Postgres parameter limit (~32K), far above any practical UI use case." — evidence: `ReactiveTagRepositoryImpl.java:120-125, 326-347` + `ReactiveAbstractCRUDRepository.java:113-126`
  - "No bulk-term variant — one `term_id` per call. Bulk-tagging across terms requires N parallel calls." — evidence: `openapi.yaml:3183-3204` (single `TermIdParam` in path)
- **resource_allocation**:
  - "Per-request allocations small and bounded — `TagsFormData` deserialises an array of strings; `new HashSet<>(getTagNameList())` (`TermServiceImpl.java:255`) materialises the submitted list into a Set. For UI use this is a few entries; for an abusive caller submitting a huge list this is unbounded heap — no application-layer cap on `tag_name_list` size (`components.yaml:2215-2218` declares no `maxItems`)." — evidence: `TermServiceImpl.java:255` + `components.yaml:2215-2218`
- **scaling_characteristics**:
  - "Stateless controller method — horizontal scaling unconstrained at this layer." — evidence: `TermController.java:129-136` (no instance state)
  - "Single `@ReactiveTransactional` boundary at `TermServiceImpl.upsertTags` (`TermServiceImpl.java:253`) holds a DB connection from the first `listByTerm` read through the search-vector refresh. Under concurrent novel-tag-name load the directory unique-index serialises competing INSERTs; real-world term-tagging is sub-second human-scale activity, so connection-pool contention is unlikely to dominate." — evidence: `TermServiceImpl.java:253-264`
  - "Term search-vector refresh is per-term (single-row vector update via `updateTagVectorsForTerm`, `ReactiveTermSearchEntrypointRepositoryImpl.java:111-121`); bounded by the term's tag count." — evidence: `TermServiceImpl.java:261` + `ReactiveTermSearchEntrypointRepositoryImpl.java:111-121`
- **known_performance_gaps**:
  - "No method-level observability — no `@Timed`, no Micrometer counter, no structured log beyond the default WebFlux access log. A regression in the diff logic would be visible only to the generic WebFlux timer." — evidence: `TermController.java:129-136` + `TermServiceImpl.java:252-264` — severity: LOW
  - "No cap on `tag_name_list` size — `components.yaml:2215-2218` declares no `maxItems`. A caller submitting a very large array causes the `HashSet` materialisation, the `IN(...)` clause, and the batched INSERT to scale unbounded until the Postgres parameter limit. No application-layer rejection. Same gap as the data-entity tag path." — evidence: `TermServiceImpl.java:255` + `components.yaml:2215-2218` — severity: LOW

## upstream_callers

- entry_point: "rest:PUT /api/terms/{term_id}/tags"
  caller_node: "external HTTP client — generated TermApi.createTermTagsRelations routing inherited via @Override"
  multiplicity_per_trigger: 1
  evidence: "TermController.java:129-136 (the @Override method) + openapi.yaml:3183-3204 (the operation definition)"
  observation_class: rest-call

- entry_point: "ui_route:term-details tag panel"
  caller_node: "ts term-UI tag-panel component (not yet enriched)"
  multiplicity_per_trigger: unresolved
  evidence: "REFERENCE — the term-details UI tag panel is the expected caller (by analogy with the data-entity Tags panel); the term-UI thunk/component was not read in this session. A future term-UI sidecar resolves the multiplicity (the data-entity sibling's UI thunk dispatches once per save; the term path is assumed similar but unverified)."
  observation_class: ui-call
  unresolved: true

## downstream_side_effects

- side_effect_class: db-write
  description: "Deletes tag_to_term relation rows for the term whose tag name is absent from the submitted tag_name_list (HARD delete — tag_to_term has no deleted_at)."
  evidence: "TagServiceImpl.java:124-134 (deleteRelationsWithTerm) + ReactiveTagRepositoryImpl.java:267-277 (deleteFrom(TAG_TO_TERM))"
  cardinality_per_call: "0..N — N = count of current term tags whose name is not in the submitted list (N = all current tags when tag_name_list is empty)"
  reachable_from_entry_points:
    - "rest:PUT /api/terms/{term_id}/tags"
    - "ui_route:term-details tag panel"

- side_effect_class: db-write
  description: "Creates new rows in the GLOBAL tag directory for submitted tag names not already present (important=false hardcoded)."
  evidence: "TagServiceImpl.java:80-86 (getOrCreateTagsByName) + TagServiceImpl.java:144-159 (divideTagsByExistence) + ReactiveAbstractCRUDRepository.java:113-126 (bulkCreate)"
  cardinality_per_call: "0..N — N = count of submitted tag names not already in the tag directory"
  reachable_from_entry_points:
    - "rest:PUT /api/terms/{term_id}/tags"
    - "ui_route:term-details tag panel"

- side_effect_class: db-write
  description: "Inserts tag_to_term relation rows for the full submitted tag set (onDuplicateKeyIgnore — re-inserts of surviving relations are no-ops)."
  evidence: "TagServiceImpl.java:138-142 (createRelationsWithTerm) + ReactiveTagRepositoryImpl.java:326-347 (insert with onDuplicateKeyIgnore)"
  cardinality_per_call: "0..M — M = count of submitted tag names (0 when tag_name_list is empty)"
  reachable_from_entry_points:
    - "rest:PUT /api/terms/{term_id}/tags"
    - "ui_route:term-details tag panel"

- side_effect_class: db-write
  description: "Refreshes the term's tag_vector in term_search_entrypoint (one component of the generated search_vector column) so the new tag set is term-searchable."
  evidence: "TermServiceImpl.java:261 (updateTagVectorsForTerm) + ReactiveTermSearchEntrypointRepositoryImpl.java:111-121 + V0_0_35__add_terms.sql:58-73 (term_search_entrypoint schema)"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "rest:PUT /api/terms/{term_id}/tags"
    - "ui_route:term-details tag panel"

- side_effect_class: page-render
  description: "Returns the term's full post-upsert tag set as a Flux<Tag> (each Tag carrying id, name, important, external, usedCount) lifted into 200 OK."
  evidence: "TermController.java:133-135 + TermServiceImpl.java:263 (flatMapIterable mapping TagPojo -> Tag)"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "rest:PUT /api/terms/{term_id}/tags"
    - "ui_route:term-details tag panel"

## sources

- understanding ← `TermController.java:129-136` (the five-line method body) + `TermServiceImpl.java:252-264` (`upsertTags` downstream service, `@ReactiveTransactional`, NO `@ActivityLog`) + `TagServiceImpl.java:124-142` (the delete-then-recreate workers) + `TagServiceImpl.java:80-86, 144-159` (auto-create-on-miss) + `SecurityConstants.java:185-186` (authorization gate) + `V0_0_35__add_terms.sql:18-28` (`tag_to_term` schema — no `external` column) + `openapi.yaml:3183-3204` (spec contract) + cross-ref `createDataEntityTagsRelations` sidecar (sibling-pattern divergences)
- concepts.entities ← `TermController.java:19-20` (`Tag`, `TagsFormData` imports) + `components.yaml:2212-2220` (`TagsFormData` schema) + `V0_0_35__add_terms.sql:1-14, 18-28` (`term`, `tag_to_term` schema) + `V0_0_76__term_relations_hard_delete.sql:12-13` (`deleted_at` dropped)
- concepts.operations ← `TermServiceImpl.java:254-264` + `TagServiceImpl.java:80-86, 124-142`
- concepts.invariants[0] ← `TermServiceImpl.java:253` (`@ReactiveTransactional`) + `TagServiceImpl.java:123, 137` + `ReactiveAbstractCRUDRepository.java:113`
- concepts.invariants[1] ← `TagServiceImpl.java:124-134` (`deleteRelationsWithTerm`, `tagsToKeep` parameter) + `TermServiceImpl.java:256`
- concepts.invariants[2] ← `V0_0_35__add_terms.sql:18-28` (`tag_to_term` schema) + `ReactiveTagRepositoryImpl.java:128-135` (`listByTerm` filters `DELETED_AT.isNull()` only) + `ReactiveTagRepositoryImpl.java:292` (`tag_to_dataset_field` HAS `ORIGIN` — contrast)
- concepts.invariants[3] ← `TagServiceImpl.java:80-86` (`getOrCreateTagsByName`) + `TagServiceImpl.java:144-159, 155` (`.setImportant(false)`)
- concepts.invariants[4] ← `ReactiveTagRepositoryImpl.java:326-347` (`createTermRelations` with `.onDuplicateKeyIgnore()`)
- concepts.invariants[5] ← `TermController.java:129-136` + `TermServiceImpl.java:252-264` (no `@ActivityLog`) + `TermServiceImpl.java:169, 183` (sibling methods DO carry `@ActivityLog`)
- concepts.invariants[6] ← `TermServiceImpl.java:254-264` (no `dataEntityFilledService` call)
- dependencies_semantic.couples-to ← `TermService.java:46` + `TagService.java:24, 31-32, 34-35` + `SecurityConstants.java:185-186` + `PolicyPermissionDto.java:48, 62` + `ReactiveTermSearchEntrypointRepository.java:13`
- tests_coverage_semantic ← `grep` for `upsertTags|createTermTagsRelations|deleteRelationsWithTerm|createRelationsWithTerm|updateTagVectorsForTerm` across `odd-platform-api/src/test` → NO matches (verified this session)
- docs_link_semantic.declared_docs ← `openapi.yaml:3185-3186` (in-spec description)
- docs_link_semantic.inferred_docs[0] ← WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions` 2026-05-21 status 200
- docs_link_semantic.inferred_docs[1] ← WebFetch `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization` 2026-05-21 status 200
- implicit_adrs[0] ← `SecurityConstants.java:174, 185-186` + `PolicyPermissionDto.java:43, 48` + WebFetch Permissions page 2026-05-21
- implicit_adrs[1] ← `V0_0_76__term_relations_hard_delete.sql:8-13` + `ReactiveTagRepositoryImpl.java:267-277`
- implicit_adrs[2] ← `ReactiveTagRepositoryImpl.java:326-347` + `V0_0_35__add_terms.sql:24`
- implicit_adrs[3] ← `openapi.yaml:3185-3186` + `TagServiceImpl.java:80-86, 144-159` + `TermServiceImpl.java:257`
- implicit_adrs[4] ← `TagServiceImpl.java:155`
- bugs_limitations_corner_cases[0] ← `openapi.yaml:3185` + `TermController.java:130` + `TermServiceImpl.java:256` + `TagServiceImpl.java:124-134`
- bugs_limitations_corner_cases[1] ← `components.yaml:2219-2220` + `TermServiceImpl.java:255` + `TagServiceImpl.java:129-131`
- bugs_limitations_corner_cases[2] ← `TagServiceImpl.java:80-86, 144-159` + `TermServiceImpl.java:257` + `SecurityConstants.java:138, 185-186` + `PolicyPermissionDto.java:48, 62`
- bugs_limitations_corner_cases[3] ← `TermController.java:129-136` + `TermServiceImpl.java:252-264, 169, 183`
- bugs_limitations_corner_cases[4] ← `TagServiceImpl.java:80-86, 144-159` + `ReactiveAbstractCRUDRepository.java:113-126` + `ReactiveTagRepositoryImpl.java:120-125, 344` + `TermServiceImpl.java:253`
- bugs_limitations_corner_cases[5] ← `components.yaml:2215-2218` + `TermServiceImpl.java:254-255` + `TagServiceImpl.java:155`
- bugs_limitations_corner_cases[6] ← `SecurityConstants.java:185-186` + cross-ref `createDataEntityTagsRelations` sidecar
- bugs_limitations_corner_cases[7] ← `ReactiveTagRepositoryImpl.java:327-346`
- stress_findings ← `TermController.java:129-136` + `TermServiceImpl.java:252-264` + `TagServiceImpl.java:80-159` + `ReactiveTagRepositoryImpl.java:120-135, 267-277, 326-347` + `SecurityConstants.java:185-186` + `PolicyPermissionDto.java:43, 48` + `components.yaml:2212-2220, 4314-4320` + `openapi.yaml:3183-3204` + probes P-027, P-028
- security ← `SecurityConstants.java:138, 185-186` + `PolicyPermissionDto.java:48, 62` + `V0_0_35__add_terms.sql:18-28` + `TermServiceImpl.java:252-264` + WebFetch Permissions page 2026-05-21
- performance ← `TermController.java:129-136` + `TermServiceImpl.java:253-264` + `TagServiceImpl.java:124-142` + `ReactiveTagRepositoryImpl.java:120-135, 326-347` + `ReactiveTermSearchEntrypointRepositoryImpl.java:111-121` + `components.yaml:2215-2218`
- upstream_callers ← `TermController.java:129-136` + `openapi.yaml:3183-3204` + cross-ref `createDataEntityTagsRelations` sidecar (UI-caller analogy)
- downstream_side_effects ← `TagServiceImpl.java:124-142` + `ReactiveTagRepositoryImpl.java:267-277, 326-347` + `ReactiveAbstractCRUDRepository.java:113-126` + `TermServiceImpl.java:261, 263` + `ReactiveTermSearchEntrypointRepositoryImpl.java:111-121` + `V0_0_35__add_terms.sql:58-73`

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: MEDIUM — the two doc URLs were WebFetched live (status 200) and the Permissions text is verbatim; MEDIUM because no anchor was pinned for the exact `TERM_TAGS_UPDATE` row and the term-UI thunk was not inspected to confirm whether the UI masks the operationId drift.
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: HIGH — all eight observations are file:line-cited; the two items that lean on cross-batch case-law (DISABLED-bypass, partial-unique-index) are explicitly marked MEDIUM-confidence within the entry text.
- security: MEDIUM — `DisabledAuthSecurityConfiguration` and the `TERM` `AuthorizationManagerType` resolver were not read this session; the DISABLED-bypass and the conditional-grant shape are inherited from the sibling sidecar.
- performance: HIGH
- upstream_callers: LOW — only the REST entry point is fully resolved; the UI caller is an unresolved REFERENCE.
- downstream_side_effects: HIGH — every side effect is traced to a file:line within this sidecar's 1-hop neighbour budget.
- stress_findings: MEDIUM — 19 of 21 questions are STATIC-INFERRED with strong evidence; 1 is PROBE-NEEDED (the concurrency question, P-028) and 1 is REFERENCE (UI re-sort). The load-bearing operator-observable claim (replace-all + empty-list-clears-all) is STATIC-INFERRED with strong evidence but is additionally pinned by probe P-027 to flip to PROBE-VERIFIED; until P-027 runs, MEDIUM is the honest level.

## Maintainer notes

(none — no EXISTING_SIDECAR was provided for this node.)

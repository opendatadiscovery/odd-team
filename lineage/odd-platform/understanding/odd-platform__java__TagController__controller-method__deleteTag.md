---
node_id: "odd-platform java TagController controller-method:deleteTag"
node_kind: controller-method
axis: controllers
extracted_at_commit: 9ac6436e9bd36ba132d765076c6bbd5916fde729
enriched_at_commit: 9ac6436e9bd36ba132d765076c6bbd5916fde729
extractor_version: 0.1.0
prompt_version: file-analyser/0.5.0
schema_version: v0.5.0
enrichment_status: complete
confidence_overall: MEDIUM
session_id: ontology-rev2-sprint-2026-05-21-TAGGING-batch
pillar_anchored_features:
  - P-01:F-018 Manual Object Tagging
  - P-08 Management & Administration (Tags tab — delete)
  - P-09 Security & Access Control (TAG_DELETE permission gate)
---

# TagController.deleteTag — semantic understanding

## understanding

`deleteTag` is the `DELETE /api/tags/{tag_id}` operation of the Manual Object
Tagging feature (P-01:F-018) — a 5-line thin controller method
(`TagController.java:30-34`) that delegates straight to `tagService.delete(tagId)`
and maps the completion to HTTP `204 No Content`. The real behaviour lives one
layer down in `TagServiceImpl.delete` (`TagServiceImpl.java:57-70`), a
`@ReactiveTransactional` six-step chain: load the `TagDto`, reject if absent
(`NotFoundException`), reject if the tag has any Collector-set (`external`)
data-entity relation (`BadUserRequestException`), then concurrently HARD-delete
the `tag_to_term` and `tag_to_data_entity` relation rows, SOFT-delete the `tag`
row itself (`UPDATE tag SET deleted_at = now()`), and finally refresh one
search-vector index. The deletion is **asymmetric in two ways the operator
cannot see from the API surface**: the `tag` row is soft-deleted while its
relations are hard-deleted, and the third relation table — `tag_to_dataset_field`
— is never touched, leaving orphan rows that point at the now-soft-deleted tag.

## concepts

- entities: [
    "`tagId` (`Long`) — the path-variable primary key of the `tag` row to delete; the sole business input (`TagController.java:31`)",
    "`TagDto` (`org.opendatadiscovery.oddplatform.dto.TagDto`) — `TagDto(TagPojo tagPojo, Long usedCount, Boolean external)`; loaded by `TagServiceImpl.delete` via `getDto(tagId)` (`TagServiceImpl.java:60`) and consumed for the `!external` guard",
    "`TagPojo` — jOOQ row pojo for the `tag` table (`id`, `name`, `important`, `created_at`, `updated_at`, `deleted_at`); the deleted row, returned to `tagMapper.mapToTag` then discarded by the controller (`Mono<ResponseEntity<Void>>`)",
    "`tag_to_term` — relation table HARD-deleted by `deleteTermRelations(long tagId)` (`ReactiveTagRepositoryImpl.java:280-286`): `DELETE FROM tag_to_term WHERE tag_id = ?`",
    "`tag_to_data_entity` — relation table HARD-deleted by `deleteDataEntityRelations(long tagId)` (`ReactiveTagRepositoryImpl.java:235-241`): `DELETE FROM tag_to_data_entity WHERE tag_id = ?`",
    "`tag_to_dataset_field` — relation table NOT touched by the delete chain; `deleteDatasetFieldRelations(long tagId)` exists (`ReactiveTagRepositoryImpl.java:299-306`) but is never invoked here",
    "`ServerWebExchange` — Spring WebFlux request/response context; accepted but unused by `deleteTag` (`TagController.java:31`)"
  ]
- operations: [
    "`deleteTag(Long tagId, ServerWebExchange)` (`TagController.java:30-34`) — `tagService.delete(tagId).then(Mono.just(ResponseEntity.noContent().build()))`. The `then` discards the `Tag` value `TagServiceImpl.delete` produces; the HTTP body is empty `204`",
    "`TagServiceImpl.delete(long tagId)` (`TagServiceImpl.java:57-70`, `@ReactiveTransactional`) — six-step: (1) `getDto(tagId)` (2) `switchIfEmpty -> NotFoundException(\"Tag\", tagId)` (3) `.filter(tagDto -> !tagDto.external())` else `BadUserRequestException(\"Can't delete tag which has external relations\")` (4) `Flux.zip(deleteTermRelations(tagId), deleteDataEntityRelations(tagId))` — two concurrent hard deletes (5) `reactiveTagRepository.delete(tagId)` SOFT-delete (6) `reactiveTermSearchEntrypointRepository.updateChangedTagVectors(tagId)` single FTS refresh",
    "`ReactiveTagRepositoryImpl.getDto(long id)` (`ReactiveTagRepositoryImpl.java:54-66`) — `SELECT tag.*, count(tag_to_data_entity.tag_id), coalesce(boolOr(tag_to_data_entity.external), false) FROM tag LEFT JOIN tag_to_data_entity ON tag_to_data_entity.tag_id = tag.id WHERE tag.id = ? AND tag.deleted_at IS NULL GROUP BY tag.*`. The `external` field is the aggregate boolean OR across all data-entity relations",
    "`ReactiveAbstractSoftDeleteCRUDRepository.delete(long id)` (`ReactiveAbstractSoftDeleteCRUDRepository.java:50-59`) — `UPDATE tag SET deleted_at = now() WHERE id = ? AND deleted_at IS NULL RETURNING *`. The `idCondition` override (`:77-79`) adds `addSoftDeleteFilter` so an already-deleted id matches nothing",
    "`ReactiveTermSearchEntrypointRepositoryImpl.updateChangedTagVectors(long tagId)` (`ReactiveTermSearchEntrypointRepositoryImpl.java:136-166`) — re-indexes `term_search_entrypoint.tag_vector` for every term found via `SELECT term_id FROM tag_to_term WHERE tag_id = ?`. On the delete path this runs AFTER the `tag_to_term` rows are already gone (step 4 precedes step 6)"
  ]
- invariants: [
    "Tag deletion is SOFT — the `tag` row's `deleted_at` is stamped, the row is not physically removed (`ReactiveAbstractSoftDeleteCRUDRepository.java:50-59`). Every subsequent `tag`-table read in the codebase applies `addSoftDeleteFilter` (`deleted_at IS NULL`), so the soft-deleted tag becomes invisible to the UI but recoverable in the DB",
    "Relation deletion is HARD and asymmetric — `tag_to_term` and `tag_to_data_entity` rows are physically `DELETE`d (`ReactiveTagRepositoryImpl.java:280-286`, `:235-241`); `tag_to_dataset_field` rows are NOT deleted by this path (the `deleteDatasetFieldRelations(long)` method at `:299-306` is not called from `TagServiceImpl.delete`)",
    "A tag with any `external = true` data-entity relation cannot be deleted via this endpoint — `getDto`'s `boolOr(tag_to_data_entity.external)` aggregate gates the `.filter(!external)` at `TagServiceImpl.java:62`; a Collector-owned tag returns `BadUserRequestException`. NOTE: the guard reads ONLY the data-entity-side aggregate; a tag whose only EXTERNAL origin is a `tag_to_dataset_field` row (which uses a `TagOrigin` enum, not a boolean, and is not joined by `getDto`) is NOT protected by this guard",
    "Deletion of a non-existent (or already soft-deleted) `tagId` yields `NotFoundException` — `getDto` filters `tag.deleted_at IS NULL` (`ReactiveTagRepositoryImpl.java:61` via `idCondition` -> `addSoftDeleteFilter`), so `switchIfEmpty` fires (`TagServiceImpl.java:61`)",
    "The whole chain runs inside a single R2DBC transaction (`@ReactiveTransactional` on `TagServiceImpl.delete`, `:58`); the two hard deletes, the soft delete, and the FTS refresh either all commit or all roll back",
    "Authorization is enforced at the HTTP perimeter only — `SecurityConstants.java:141-142` binds `DELETE /api/tags/{tag_id}` to the `TAG_DELETE` permission via a `SecurityRule`; neither `TagController.deleteTag` nor `TagServiceImpl.delete` carries a `@PreAuthorize` or programmatic permission check"
  ]
- audiences: [
    "Platform UI user with `TAG_DELETE` — operates the Management -> Tags tab delete control; sees a tag vanish from the catalog vocabulary",
    "Third-party REST consumer of `DELETE /api/tags/{tag_id}` — the OpenAPI operation `deleteTag` (`openapi.yaml:408-423`); receives `204` on success",
    "Platform operator / DBA — bears the orphan `tag_to_dataset_field` rows and the soft-deleted `tag` rows that accumulate with no reaper job",
    "Search/discovery users — affected by the asymmetric FTS refresh; a deleted tag's name can linger in `search_entrypoint.tag_vector` after deletion (see `bugs_limitations_corner_cases`)"
  ]

## dependencies_semantic

- requires-feature: [
    "`TagService.delete` (`TagService.java:20`) — the service contract; `TagServiceImpl` is the sole implementation",
    "`ReactiveTagRepository` — `getDto` (`:16`), `deleteTermRelations(long)` (`:50`), `deleteDataEntityRelations(long)` (`:38`), inherited `delete(long)` (from `ReactiveCRUDRepository`)",
    "`ReactiveTermSearchEntrypointRepository.updateChangedTagVectors` (`ReactiveTermSearchEntrypointRepository.java`) — the single FTS refresh on the delete path",
    "`@ReactiveTransactional` (`ReactiveTransactional.java:11`) — Spring `@Transactional(\"reactiveTransactionManager\")` qualifier; the delete chain's atomicity depends on it"
  ]
- requires-config: [] — N/A. Neither `deleteTag` nor `TagServiceImpl.delete` reads any Spring property; behaviour is unconditional and code-driven.
- requires-runtime: [
    "Spring WebFlux — `@RestController` `TagController` implementing the generated `TagApi` interface; reactive `Mono<ResponseEntity<Void>>` return",
    "Spring Reactive Transaction Manager (`reactiveTransactionManager` bean) — required for `@ReactiveTransactional` on `TagServiceImpl.delete` to obtain an R2DBC transaction",
    "PostgreSQL — the `tag`, `tag_to_term`, `tag_to_data_entity`, `tag_to_dataset_field`, `term_search_entrypoint` tables; jOOQ-generated DSL",
    "Spring Security `SecurityRule` chain — the `TAG_DELETE` gate on `DELETE /api/tags/{tag_id}` (`SecurityConstants.java:141-142`)"
  ]
- couples-to: [
    "The generated `TagApi` interface (`org.opendatadiscovery.oddplatform.api.contract.api.TagApi`) — `deleteTag`'s signature is OpenAPI-generated from `openapi.yaml:408-423`; the controller `@Override`s it",
    "`SecurityConstants.SECURITY_RULES` — the `DELETE /api/tags/{tag_id}` -> `TAG_DELETE` binding (`:141-142`); the path string here is the SOLE auth coupling, decoupled from the controller code",
    "`TagServiceImpl.delete`'s chain ordering — the delete-then-refresh order (`Flux.zip` at `:64-65` before the FTS refresh at `:68-69`) makes the term-side refresh observe an already-emptied `tag_to_term`",
    "`ReactiveAbstractSoftDeleteCRUDRepository` — the inherited soft-delete; if a future refactor made `ReactiveTagRepositoryImpl` extend the non-soft-delete base, `delete` would become a physical `DELETE FROM tag` and the FK behaviour of the relation tables would change"
  ]

## tests_coverage_semantic

- covered_behaviours: [] — **No test exercises the `deleteTag` delete path.** There is no `TagControllerTest` and no `TagServiceImplTest` (`Glob: odd-platform-api/src/test/**/Tag*.java` returns ONE file — `TagRepositoryImplTest.java` — confirmed via two Glob invocations). `TagRepositoryImplTest` covers the `deleteDataEntityRelations(Collection<TagToDataEntityPojo>)` overload (`TagRepositoryImplTest.java:163-212` — the diff-list variant used by `updateRelationsWithDataEntity`), NOT the `deleteDataEntityRelations(long tagId)` overload that `deleteTag` uses, and NOT `deleteTermRelations`, `deleteDatasetFieldRelations`, the inherited soft-delete, or the service-layer chain.
- uncovered_behaviours:
  - behaviour: "`deleteTag` returns 204 and the `tag` row is soft-deleted (deleted_at stamped, row not physically removed)"
    test_class: integration
    criticality: HIGH
    note: "the soft-vs-hard semantics are load-bearing — a regression to physical delete would change FK cascade behaviour on the relation tables"
  - behaviour: "delete of a tag with an `external = true` data-entity relation is rejected with `BadUserRequestException` / HTTP 422 — the Collector-ownership guard at TagServiceImpl.java:62-63"
    test_class: security
    criticality: HIGH
    note: "this is the permission-bypass-adjacent guard; removing the .filter would let UI users delete Collector-owned tags and pass all existing tests"
  - behaviour: "delete of a non-existent or already-deleted tagId yields `NotFoundException` / HTTP 404"
    test_class: integration
    criticality: MEDIUM
  - behaviour: "delete HARD-deletes `tag_to_term` and `tag_to_data_entity` rows for the tag"
    test_class: integration
    criticality: HIGH
  - behaviour: "delete does NOT delete `tag_to_dataset_field` rows — orphan rows persist pointing at the soft-deleted tag (current behaviour; probe P-032 pins it)"
    test_class: integration
    criticality: HIGH
    note: "this asymmetry is undocumented; a test should either codify it as intended or it is a bug to fix"
  - behaviour: "delete refreshes only the term-side FTS vector; the data-entity-side `search_entrypoint.tag_vector` is NOT refreshed (probe P-033 pins it)"
    test_class: integration
    criticality: MEDIUM
  - behaviour: "the `DELETE /api/tags/{tag_id}` -> `TAG_DELETE` gate rejects a caller without the permission (403) and an unauthenticated caller (401/302 per auth mode)"
    test_class: security
    criticality: HIGH
  - behaviour: "the whole chain rolls back atomically if any step fails (e.g. the FTS refresh errors)"
    test_class: integration
    criticality: MEDIUM
- test_files: [] — N/A. No `TagControllerTest.java`, no `TagServiceImplTest.java`. Only `odd-platform-api/src/test/java/org/opendatadiscovery/oddplatform/repository/TagRepositoryImplTest.java` exists, and it does not cover the delete-tag path.
- gaps: |
    The entire delete-tag path is unverified end-to-end — controller, service
    chain, and the `deleteXxxRelations(long tagId)` repository overloads. The
    worst-leverage gap is **security**: the `!external` guard
    (`TagServiceImpl.java:62-63`) is the only thing stopping a UI user from
    deleting a Collector-owned tag, and no test asserts it; a refactor that
    drops the `.filter` would compile and pass CI silently. The second gap is
    **integration**: the asymmetric cascade (`tag_to_dataset_field` orphaned,
    data-entity FTS vector not refreshed) is observable only by running the
    system — probes P-032 and P-033 are the proposed coverage. A unit test
    cannot catch the cascade asymmetry because it is a property of which
    repository methods the service composes, not of any single method.

## docs_link_semantic

- declared_docs: [] — No `@docs` annotation in `TagController.java` (file read end-to-end, 53 lines; no `@docs`, no doc-pointer comment) nor in `TagServiceImpl.java` (per the existing `TagServiceImpl` sidecar). The delete-tag operation in `openapi.yaml:408-423` carries `summary: Delete tag` and `description: Deletes existing tag` but no `externalDocs`.
- inferred_docs:
  - url: "https://docs.opendatadiscovery.org/features/data-discovery/tagging"
    anchor: ""
    rationale: "Operator-facing Tag UX + RBAC page for P-01:F-018; it is the page that names the `TAG_DELETE` permission. WebFetched live this session."
    last_verified_at: "2026-05-21T00:00:00Z"
    last_verified_status: 200
    confidence: LOW
  - url: "https://docs.opendatadiscovery.org/developer-guides/api-reference"
    anchor: ""
    rationale: "The API-reference index; checked to confirm whether `deleteTag` is enumerated as a documented endpoint. WebFetched live this session."
    last_verified_at: "2026-05-21T00:00:00Z"
    last_verified_status: 200
  - fetched_excerpts: |
      WebFetch `features/data-discovery/tagging` (2026-05-21, status 200):
        "TAG_DELETE — Remove a tag from the catalog vocabulary." (verbatim — the
        only mention of tag deletion on the page; it appears in the RBAC
        permissions table). The fetched response further states the page "does
        not describe what happens to a tag's associations with data entities,
        dataset columns, or other catalog relationships when a tag is deleted"
        and "does not address whether tag deletion is reversible."
      WebFetch `developer-guides/api-reference` (2026-05-21, status 200):
        The page "does not enumerate or document the DELETE /api/tags/{tag_id}
        endpoint or any other tag-related REST endpoints specifically"; it
        mentions tags only in passing in the Glossary feature description and
        directs readers to "The Swagger UI hosted on every running ODD Platform".
- doc_drift_findings:
  - "The live tagging page (WebFetched 2026-05-21, status 200) describes `TAG_DELETE` only as 'Remove a tag from the catalog vocabulary' and is SILENT on the deletion blast radius. The code shows the blast radius is non-trivial and asymmetric: `tag_to_term` + `tag_to_data_entity` rows are HARD-deleted, the `tag` row is SOFT-deleted, and `tag_to_dataset_field` rows are ORPHANED (`TagServiceImpl.java:64-66` + `ReactiveTagRepositoryImpl.java:235-306`). An operator deleting a tag attached to dataset columns is not told their dataset-field tag links survive as orphans."
  - "The live tagging page does NOT state that deleting a Collector-set (`external`) tag is rejected (`BadUserRequestException`, `TagServiceImpl.java:62-63`). An operator who cannot delete a tag has no documented explanation that Collector ownership is the cause."
  - "The live `developer-guides/api-reference` page (WebFetched 2026-05-21, status 200) does not enumerate `DELETE /api/tags/{tag_id}`; it points to Swagger UI. The OpenAPI `deleteTag` operation itself (`openapi.yaml:408-423`) documents only the `204` response — no `404` (not-found) and no `422` (`BadUserRequestException`), so neither the prose docs nor the contract describe the delete failure modes."

## implicit_adrs

- "Tag rows are SOFT-deleted while their relation rows are HARD-deleted — a deliberate, schema-level split: `ReactiveTagRepositoryImpl` extends `ReactiveAbstractSoftDeleteCRUDRepository` (so `delete` is an `UPDATE ... SET deleted_at`), whereas the relation deletes are explicit `DSL.delete(...)` / `DSL.deleteFrom(...)` calls." — evidence: ReactiveTagRepositoryImpl.java:44 (`extends ReactiveAbstractSoftDeleteCRUDRepository`) + ReactiveAbstractSoftDeleteCRUDRepository.java:50-59 (the soft-delete UPDATE) + ReactiveTagRepositoryImpl.java:235-241, 280-286 (explicit hard DELETEs) — intent_anchor: "the class declaration `public class ReactiveTagRepositoryImpl extends ReactiveAbstractSoftDeleteCRUDRepository<...>` is the decision — the maintainer chose the soft-delete base for the directory entity but wrote relation deletes as plain DELETE. The soft-delete base also overrides `idCondition` to add `deleted_at IS NULL` (`:77-79`), an intentional pattern applied consistently across every soft-deleted entity in the repository package." — confidence: HIGH
- "A tag with Collector-set (`external`) relations is immutable to the delete endpoint — the `.filter(tagDto -> !tagDto.external())` guard refuses to delete a tag the Collector owns, mirroring the identical guard on `update`." — evidence: TagServiceImpl.java:62-63 (the delete guard) + :49-50 (the symmetric update guard) — intent_anchor: "the explicit `BadUserRequestException(\"Can't delete tag which has external relations\")` exception message names the contract in user-visible language; the same guard pattern on `update` (`:49-50`) shows it is an intentional cross-method invariant, not an accident — the Collector owns the `external` bit and the UI cannot remove a Collector-owned tag." — confidence: HIGH
- "The delete chain is one atomic transaction — `@ReactiveTransactional` wraps the load, the two hard deletes, the soft delete, and the FTS refresh, so a tag delete is all-or-nothing." — evidence: TagServiceImpl.java:58 (`@ReactiveTransactional` on `delete`) — intent_anchor: "the annotation placement is consistent with the file's convention — every multi-statement service method (`update` :45, `delete` :58, `updateRelationsWithDataEntity` :97, `createRelationsWithTerm` :137) carries `@ReactiveTransactional`; the maintainer deliberately scoped the TX at the multi-statement orchestration." — confidence: HIGH

## bugs_limitations_corner_cases

- "ASYMMETRIC CASCADE — `TagServiceImpl.delete` cleans up only TWO of the three tag-relation tables. `Flux.zip(deleteTermRelations(tagId), deleteDataEntityRelations(tagId))` (`TagServiceImpl.java:64-65`) hard-deletes `tag_to_term` and `tag_to_data_entity`; `tag_to_dataset_field` is never touched. The repository HAS the matching method — `deleteDatasetFieldRelations(long tagId)` at `ReactiveTagRepositoryImpl.java:299-306` (`DELETE FROM tag_to_dataset_field WHERE tag_id = ?`) — but `TagServiceImpl.delete` does not call it. Operator-visible consequence: deleting a tag that is attached to dataset columns leaves `tag_to_dataset_field` rows referencing a soft-deleted `tag.id`. The orphans are invisible to UI reads (`listDatasetFieldDtos` joins `tag` and the soft-deleted row is filtered out) but persist in the DB indefinitely — no reaper job exists. Probe P-032 pins the behaviour." — evidence: TagServiceImpl.java:64-66 (the two-table zip, no dataset-field delete) + ReactiveTagRepositoryImpl.java:299-306 (the unused `deleteDatasetFieldRelations(long)`) — severity: HIGH
- "ASYMMETRIC FTS REFRESH (delete vs update) — `delete` refreshes ONE search vector (`reactiveTermSearchEntrypointRepository.updateChangedTagVectors(tagId)`, `TagServiceImpl.java:68-69`); `update` refreshes THREE (`updateSearchVectors` Mono.zip at `:161-167` — main `search_entrypoint.tag_vector`, structure vector, term-side vector). After a tag delete, the data-entity-side `search_entrypoint.tag_vector` still contains the deleted tag's name token until an unrelated data-entity write refreshes that row — a global search for the deleted tag name can still surface previously-tagged entities. Probe P-033 pins it." — evidence: TagServiceImpl.java:68-69 (delete refreshes only term-side) vs :161-167 (update refreshes all three) + ReactiveSearchEntrypointRepositoryImpl.java:319-342 (the data-entity-side `updateChangedTagVectors` that delete never calls) — severity: MEDIUM
- "FTS REFRESH RUNS TOO LATE on the delete path — `delete` calls `deleteTermRelations(tagId)` in the `Flux.zip` at `:64-65` (which hard-deletes the `tag_to_term` rows) BEFORE the term-side refresh at `:68-69`. `ReactiveTermSearchEntrypointRepositoryImpl.updateChangedTagVectors` discovers which terms to re-index via `SELECT term_id FROM tag_to_term WHERE tag_id = ?` (`ReactiveTermSearchEntrypointRepositoryImpl.java:141-144`) — but those rows are already gone, so the CTE is empty and ZERO term rows get re-indexed. The single FTS refresh the delete path does perform is effectively a no-op for cleaning the deleted tag's name out of `term_search_entrypoint.tag_vector`. Probe P-033 hypothesis H2 pins it." — evidence: TagServiceImpl.java:64-69 (zip-then-refresh ordering) + ReactiveTermSearchEntrypointRepositoryImpl.java:141-144 (the refresh CTE keyed on the just-deleted `tag_to_term` rows) — severity: MEDIUM
- "The `external` guard checks only the DATA-ENTITY side — `getDto`'s `boolOr(tag_to_data_entity.external)` aggregate (`ReactiveTagRepositoryImpl.java:58`) does NOT consult `tag_to_dataset_field.origin` (which carries a `TagOrigin` enum — `INTERNAL` / `EXTERNAL` — not a boolean). A tag whose ONLY Collector-set origin is an `EXTERNAL` `tag_to_dataset_field` row, with no `external` data-entity relation, passes the `.filter(!external)` guard at `TagServiceImpl.java:62` and CAN be deleted by a UI user — silently orphaning a Collector-set dataset-field tag link." — evidence: ReactiveTagRepositoryImpl.java:54-66 (`getDto` joins only `TAG_TO_DATA_ENTITY`, not `TAG_TO_DATASET_FIELD`) + TagServiceImpl.java:62 (the guard reads only that aggregate) + ReactiveTagRepositoryImpl.java:84-93 (`listDatasetFieldDtos` shows `tag_to_dataset_field` uses `ORIGIN`, a separate concept) — severity: MEDIUM
- "The OpenAPI `deleteTag` operation documents only the `204` response (`openapi.yaml:419-421`) — there is no `404` for `NotFoundException` and no `422`/`400` for the `BadUserRequestException` thrown when deleting an `external` tag. A generated client has no typed model for the two failure modes the service actually produces." — evidence: openapi.yaml:408-423 (the `deleteTag` operation block — single `'204'` response) + TagServiceImpl.java:61, 63 (the two exception paths) — severity: LOW
- "Soft-deleted `tag` rows accumulate with no reaper — `delete` only stamps `deleted_at` (`ReactiveAbstractSoftDeleteCRUDRepository.java:50-59`); no housekeeping job purges old soft-deleted tags. Combined with the orphaned `tag_to_dataset_field` rows, repeated create/delete cycles grow the `tag` and `tag_to_dataset_field` tables monotonically. (Cross-check the `HousekeepingJobManager` sidecar — no tag-table entry is expected there.)" — evidence: ReactiveAbstractSoftDeleteCRUDRepository.java:50-59 (soft delete, no purge) — severity: LOW

## stress_findings

```yaml
stress_findings:
  tunables: []   # deleteTag accepts only tagId (Long) + ServerWebExchange; no numeric literals, no @Value, no magic strings, no constants in the delete path. The delete chain has no limits/sizes/timeouts/retries.
  name_behavior_pairs:
    - name: "deleteTag / TagServiceImpl.delete"
      promise: "Delete a tag — remove the tag and its catalog associations."
      implementation: "Loads the TagDto; rejects if absent or if it has an external (Collector-set) data-entity relation; then HARD-deletes tag_to_term and tag_to_data_entity rows, SOFT-deletes the tag row (UPDATE tag SET deleted_at = now()), and refreshes one FTS vector. tag_to_dataset_field rows are NOT deleted (TagServiceImpl.java:57-70 + ReactiveTagRepositoryImpl.java:235-306 + ReactiveAbstractSoftDeleteCRUDRepository.java:50-59)."
      drift: DRIFT_NAME_VS_BEHAVIOR
      operator_visible_consequence: "'Delete' soft-deletes the tag (recoverable in DB, invisible to UI) and only partially removes its associations — tag_to_dataset_field links survive as orphans; the operator believes the tag and all its links are gone."
      confidence: STATIC-INFERRED
      evidence: "TagServiceImpl.java:57-70 + ReactiveTagRepositoryImpl.java:235-241,280-286,299-306 + ReactiveAbstractSoftDeleteCRUDRepository.java:50-59"
    - name: "DELETE /api/tags/{tag_id}"
      promise: "REST DELETE — remove the tag resource at this id."
      implementation: "Maps to deleteTag -> tagService.delete -> the soft-delete-plus-partial-cascade chain above; returns 204. The resource is not physically removed; 2 of 3 relation tables cleaned."
      drift: MINOR
      operator_visible_consequence: "A DELETE returning 204 does not mean the row is physically gone (soft delete) nor that every association is removed (tag_to_dataset_field orphaned) — but the resource does disappear from all UI/API reads, so a consumer's observable expectation of 'gone' is met for read purposes."
      confidence: STATIC-INFERRED
      evidence: "TagController.java:30-34 + openapi.yaml:408-423"
  orderings: []   # the delete path has no ORDER BY, no LIMIT/OFFSET, no paginate(...), no Page<> return, no in-memory sort. getDto returns a single row by primary key; the relation deletes are unordered set deletes.
  auth_gates:
    - location: "SecurityConstants.java:141-142"
      endpoint: "DELETE /api/tags/{tag_id} (deleteTag)"
      questions:
        - q: "What does this endpoint return for each of DISABLED / LOGIN_FORM / OAUTH2 / LDAP?"
          a: "Authentication mode (DISABLED / LOGIN_FORM / OAUTH2 / LDAP) governs IDENTITY only; the TAG_DELETE permission check is the same SecurityRule across all four modes. Under DISABLED there is no authenticated principal — whether the SecurityRule then permits or denies depends on the DisabledAuth security configuration, which is outside this node; REFERENCE the DisabledAuthSecurityConfiguration sidecar. Under LOGIN_FORM/OAUTH2/LDAP an authenticated principal holding TAG_DELETE gets 204; one lacking it gets 403."
          confidence: REFERENCE
          evidence: "odd-platform java DisabledAuthSecurityConfiguration config-key-consumer:auth.type@L10 (for the DISABLED-mode behaviour)"
        - q: "What does an unauthenticated caller see?"
          a: "An unauthenticated caller is rejected before reaching the controller — by the security filter chain. The concrete status (401 vs a 302 redirect to a login form) depends on the active auth mode's configuration, not on this node. STATIC-INFERRED that it never reaches deleteTag; the exact status is a REFERENCE to the auth-config sidecars."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:141-142 (the SecurityRule is evaluated by the filter chain before the controller); TagController.java:30-34 (no auth code in the controller itself)"
        - q: "What does a wrong-role caller see?"
          a: "An authenticated caller WITHOUT the TAG_DELETE permission is denied by the SecurityRule with HTTP 403 — the request never reaches deleteTag. TAG_DELETE is a PolicyPermissionDto granted via the RBAC policy framework (Policies/Roles)."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:141-142 (DELETE /api/tags/{tag_id} -> TAG_DELETE) + SecurityConstants.java:78 (TAG_DELETE import from PolicyPermissionDto)"
        - q: "Where does the gate live — controller, service, repository, or nowhere?"
          a: "ONLY at the HTTP perimeter — the SecurityRule in SecurityConstants.java:141-142. Neither TagController.deleteTag (read end-to-end, 5 lines, no annotation) nor TagServiceImpl.delete (no @PreAuthorize, no programmatic permissionService call) nor any repository method re-checks the permission. A service-layer caller bypassing the controller would delete a tag with no permission check. NOTE: this is distinct from the !external guard, which is a data-ownership check, not a permission check."
          confidence: STATIC-INFERRED
          evidence: "SecurityConstants.java:141-142 + TagController.java:30-34 + TagServiceImpl.java:57-70 (no auth code in either)"
  resource_boundaries:
    - location: "TagServiceImpl.java:58"
      kind: transactional
      questions:
        - q: "Can two simultaneous calls produce corrupted state?"
          a: "Two concurrent deletes of the SAME tagId: both load the TagDto, both pass the guard, both run the hard deletes (idempotent — second deletes zero rows), both run the soft-delete UPDATE. The soft-delete UPDATE has `WHERE id = ? AND deleted_at IS NULL` (idCondition -> addSoftDeleteFilter, ReactiveAbstractSoftDeleteCRUDRepository.java:77-79) so the second UPDATE matches zero rows and `jooqReactiveOperations.mono(query)` emits empty -> the second `delete` chain's `.map(tagMapper::mapToTag)` receives no element and the Mono completes empty. No corruption — but the second caller still gets 204 (the controller's `.then(...)` fires on empty completion too). Two concurrent deletes of DIFFERENT tags do not interact. No lost-update class exists here (no read-modify-write on a counter)."
          confidence: STATIC-INFERRED
          evidence: "TagServiceImpl.java:57-70 + ReactiveAbstractSoftDeleteCRUDRepository.java:50-59,77-79 + TagController.java:32-33"
        - q: "Is the call replay-safe?"
          a: "Yes for the tag row and the relation rows — replaying DELETE /api/tags/{id} after a successful delete: getDto filters `deleted_at IS NULL`, so the now-soft-deleted tag is not found and the replay returns NotFoundException / 404 (NOT 204). So the operation is not idempotent in its STATUS CODE (first call 204, replay 404) but is idempotent in its EFFECT (no duplicate side effect, no double-delete corruption). The relation hard-deletes are naturally idempotent (deleting already-absent rows is a no-op)."
          confidence: STATIC-INFERRED
          evidence: "ReactiveTagRepositoryImpl.java:54-66 (getDto WHERE includes deleted_at IS NULL) + TagServiceImpl.java:60-61 (switchIfEmpty -> NotFoundException)"
        - q: "If a cache fronts this, what is the TTL / eviction key / staleness window?"
          a: "No @Cacheable, no manual cache on the delete path or on getDto. The only stale-data surface is the FTS search vectors (search_entrypoint.tag_vector / term_search_entrypoint.tag_vector) which are an index, not a cache — the delete path refreshes them only partially (see bugs_limitations_corner_cases: ASYMMETRIC FTS REFRESH + FTS REFRESH RUNS TOO LATE). Staleness window for the data-entity-side tag_vector: until the next write to each affected data_entity row. Probe P-033 pins it."
          confidence: PROBE-NEEDED
          evidence: "P-033"
  request_inputs:
    - location: "TagController.java:31"
      input_kind: path-param
      input_name: "tagId"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "tagId promises the primary-key id of the tag (the catalog-vocabulary tag) to delete."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:31 + openapi.yaml:411-418 (operationId deleteTag, path parameter tag_id, type integer/int64)"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Traced end-to-end: TagController.deleteTag(tagId) (TagController.java:31) -> tagService.delete(tagId) (TagController.java:32) -> TagServiceImpl.delete(long tagId) (TagServiceImpl.java:59) -> (a) reactiveTagRepository.getDto(tagId) bound to `tag.id = ?` (ReactiveTagRepositoryImpl.java:55-61, via idCondition); (b) deleteTermRelations(tagId) bound to `tag_to_term.tag_id = ?` (ReactiveTagRepositoryImpl.java:280-283); (c) deleteDataEntityRelations(tagId) bound to `tag_to_data_entity.tag_id = ?` (ReactiveTagRepositoryImpl.java:235-238); (d) reactiveTagRepository.delete(tagId) bound to `tag.id = ?` (ReactiveAbstractSoftDeleteCRUDRepository.java:53-56); (e) reactiveTermSearchEntrypointRepository.updateChangedTagVectors(tagId) bound to `tag_to_term.tag_id = ?` (ReactiveTermSearchEntrypointRepositoryImpl.java:144). Every bind is to a `tag.id` or `*.tag_id` column."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:31-32 + TagServiceImpl.java:59-69 + ReactiveTagRepositoryImpl.java:55-61,235-238,280-283 + ReactiveAbstractSoftDeleteCRUDRepository.java:53-56 + ReactiveTermSearchEntrypointRepositoryImpl.java:144"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES — `tagId` binds consistently to the tag primary key (`tag.id`) and to the `tag_id` foreign-key column of every relation table. The parameter name and every SQL column it reaches are the same concept. The caveat is NOT a name-vs-column drift (Category F): it is a COMPLETENESS drift — tagId reaches only 2 of the 3 `tag_id`-keyed relation tables (tag_to_dataset_field is omitted), which is recorded under Category B and bugs_limitations_corner_cases, not here."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "TagServiceImpl.java:59-69 + ReactiveTagRepositoryImpl.java:235-238,280-283"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — the input does not translate silently; it MATCHES."
          confidence: STATIC-INFERRED
          evidence: "TagServiceImpl.java:59"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "tag_to_dataset_field.tag_id IS a `tag_id`-named column that the delete chain does NOT use — `deleteDatasetFieldRelations(long tagId)` (ReactiveTagRepositoryImpl.java:299-306) binds exactly `TAG_TO_DATASET_FIELD.TAG_ID.eq(tagId)` but is never invoked by TagServiceImpl.delete. This is the available-but-unused smell and the fix anchor for the asymmetric-cascade bug: calling it inside the Flux.zip at TagServiceImpl.java:64-65 would complete the cascade."
          confidence: STATIC-INFERRED
          evidence: "ReactiveTagRepositoryImpl.java:299-306 (deleteDatasetFieldRelations(long) — unused) + TagServiceImpl.java:64-65 (the Flux.zip that omits it)"
      routes_to_finding: "bugs_limitations_corner_cases (ASYMMETRIC CASCADE — HIGH); stress_findings.name_behavior_pairs (DRIFT_NAME_VS_BEHAVIOR)"
    - location: "TagController.java:31"
      input_kind: query-param
      input_name: "exchange (ServerWebExchange)"
      questions:
        - q: "What does the input NAME promise the caller, in plain user-facing English?"
          a: "<generic — no specific entity promised> — ServerWebExchange is the Spring WebFlux request/response context, injected by the framework, not a caller-supplied named input."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:31"
        - q: "When supplied, what does the implementation USE the input for?"
          a: "Not used at all — `deleteTag` accepts `exchange` (it is part of the generated TagApi signature) but never references it in the 5-line body."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:30-34 (exchange parameter unreferenced)"
        - q: "Does the implementation's actual scope MATCH the name's promise?"
          a: "MATCHES (vacuously) — the parameter exists only to satisfy the generated interface signature; it promises nothing and is used for nothing."
          drift: NONE
          confidence: STATIC-INFERRED
          evidence: "TagController.java:30-34"
        - q: "For TRANSLATES_SILENTLY: what does a caller see when their assumption is wrong?"
          a: "N/A — framework-injected parameter, no caller assumption."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:31"
        - q: "Is there a column / field / variable that DOES match the input's name and is NOT being used? (available-but-unused smell)"
          a: "NONE — ServerWebExchange has no domain column counterpart."
          confidence: STATIC-INFERRED
          evidence: "TagController.java:31"
      routes_to_finding: "none — framework-injected unused parameter, no finding"
  probes_emitted:
    - probe_id: P-032
      question: "Does deleting a tag attached to a dataset field leave the tag_to_dataset_field row as an orphan (tag_to_term + tag_to_data_entity cleaned, tag_to_dataset_field not)?"
      probe_path: "lineage/odd-platform/probes/P-032.yaml"
    - probe_id: P-033
      question: "Does the delete path leave the deleted tag's name in the data-entity-side search_entrypoint.tag_vector (H1) and does the single term-side FTS refresh no-op because it runs after the tag_to_term rows are deleted (H2)?"
      probe_path: "lineage/odd-platform/probes/P-033.yaml"
  stress_summary:
    triggers_total: 7
    questions_total: 23
    answers_static_inferred: 21
    answers_probe_needed: 1
    answers_reference: 1
    drift_flags: 2
```

## security

- auth_mode_relevance: LOGIN_FORM | OAUTH2 | LDAP — `DELETE /api/tags/{tag_id}` is on the protected UI/API surface; one of the three modes establishes the principal, then the `TAG_DELETE` SecurityRule authorises. DISABLED mode skips authentication entirely; the SecurityRule's behaviour under DISABLED is governed by `DisabledAuthSecurityConfiguration` (REFERENCE that sidecar). Evidence: `SecurityConstants.java:141-142`.
- ingestion_filter_relevance: NO — UI/API surface, not the ingestion path. `deleteTag` is `DELETE /api/tags/{tag_id}`; the S2S `IngestionDataEntitiesFilter` registers only on `/ingestion/entities`.
- authorization_assertions:
  - "`DELETE /api/tags/{tag_id}` -> `TAG_DELETE` permission" — evidence: SecurityConstants.java:141-142 (the `SecurityRule` with `PathPatternParserServerWebExchangeMatcher(\"/api/tags/{tag_id}\", DELETE)` and `TAG_DELETE`)
  - "No `@PreAuthorize` on the controller method and no programmatic `permissionService` call in the service" — evidence: TagController.java:30-34 + TagServiceImpl.java:57-70 (both read end-to-end; the gate is the perimeter SecurityRule only)
- owner_scoping: N/A — the `tag` table has no `owner_id` column; tags are a global catalog vocabulary with no per-owner scoping. The only ownership-shaped check is the `external` flag (`TagServiceImpl.java:62`), which gates Collector-vs-UI ownership, not user-owner scoping.
- data_exposure: `204 No Content` carries no data — `deleteTag` returns `Mono<ResponseEntity<Void>>` (`TagController.java:31`); the `Tag` value `TagServiceImpl.delete` produces is discarded by the controller's `.then(...)`. The `NotFoundException` / `BadUserRequestException` error responses leak only the `tagId` and a generic message ("Can't delete tag which has external relations") to a caller already past the `TAG_DELETE` gate — no broad exposure.
- known_security_gaps:
  - "Authorization is enforced ONLY at the HTTP perimeter SecurityRule — a service-layer caller invoking `TagServiceImpl.delete` directly (e.g. a future internal feature) bypasses the `TAG_DELETE` check entirely; the service has no defence-in-depth permission assertion." — evidence: TagController.java:30-34 + TagServiceImpl.java:57-70 (no service-tier auth) — severity: MEDIUM
  - "The `!external` guard protects only the data-entity side — a tag whose only Collector-set origin is an `EXTERNAL` `tag_to_dataset_field` row can be deleted by a UI user holding `TAG_DELETE`, silently destroying a Collector-owned dataset-field tag association (the guard's `getDto` aggregate never joins `tag_to_dataset_field`)." — evidence: ReactiveTagRepositoryImpl.java:54-66 (getDto joins only TAG_TO_DATA_ENTITY) + TagServiceImpl.java:62 — severity: MEDIUM
  - "The OpenAPI contract does not declare the `404` / `422` failure responses (`openapi.yaml:419-421` lists only `204`) — a security-conscious client cannot distinguish 'tag not found' from 'tag is Collector-owned' from a typed model; both surface as generic errors." — evidence: openapi.yaml:408-423 — severity: LOW

## performance

- hot_paths: [] — N/A. Tag deletion is a low-frequency administrative action (Management -> Tags tab), not on a request/render/event critical path. The chain issues ~5 DB statements per call; no per-scrape or per-render invocation.
- throughput_characteristics:
  - "Single-tag delete only — `DELETE /api/tags/{tag_id}` takes one id; there is no bulk-delete endpoint. Deleting N tags is N round-trips through the full six-step chain." — evidence: TagController.java:30-34 + openapi.yaml:408-423
  - "Reactive non-blocking — `Mono<ResponseEntity<Void>>` signature; the two relation deletes run concurrently via `Flux.zip` (`TagServiceImpl.java:64-65`), the rest sequentially." — evidence: TagController.java:31 + TagServiceImpl.java:64-65
- resource_allocation:
  - "Bounded — `getDto` returns one row; the relation deletes are keyed on a single `tag_id` and return only the deleted rows (`RETURNING`). No full-table scan, no in-memory graph load. Memory cost is proportional to the number of relation rows the tag has." — evidence: ReactiveTagRepositoryImpl.java:54-66,235-241,280-286
- scaling_characteristics:
  - "Stateless controller — `TagController` holds only the injected `TagService`; instances scale horizontally." — evidence: TagController.java:16-20
  - "No advisory lock, no `SELECT ... FOR UPDATE` — concurrency safety on the soft-delete UPDATE comes from the `deleted_at IS NULL` predicate making a double-delete a zero-row no-op (`ReactiveAbstractSoftDeleteCRUDRepository.java:53-56,77-79`)." — evidence: ReactiveAbstractSoftDeleteCRUDRepository.java:50-59
- known_performance_gaps:
  - "Soft-deleted `tag` rows and orphaned `tag_to_dataset_field` rows are never purged (no reaper job) — over a long-lived deployment with churny tag create/delete cycles these tables grow monotonically; `getDto`'s `LEFT JOIN tag_to_data_entity` and the `listMostPopular` CTEs scan progressively more dead rows. Low severity at typical tag-count scale." — evidence: ReactiveAbstractSoftDeleteCRUDRepository.java:50-59 (soft delete, no purge) + ReactiveTagRepositoryImpl.java:299-306 (the unused dataset-field delete) — severity: LOW

## upstream_callers

- entry_point: "rest:DELETE /api/tags/{tag_id}"
  caller_node: "odd-platform openapi operation:deleteTag (openapi.yaml:408-423)"
  multiplicity_per_trigger: 1
  evidence: "TagController.java:30-34 — the `@RestController` method implementing the generated `TagApi.deleteTag`; one HTTP DELETE -> one `tagService.delete` call"
  observation_class: rest-call
- entry_point: "ui_route:Management -> Tags tab (tag delete control)"
  caller_node: "REFERENCE — odd-platform ts react-component (Management Tags tab) — not yet enriched"
  multiplicity_per_trigger: unresolved
  unresolved: true
  evidence: "The tagging feature P-01:F-018 is operated from the Management -> Tags UI per the live tagging doc page (WebFetched 2026-05-21, status 200); the React component issuing the DELETE and its dispatch multiplicity are not yet enriched. Recorded as a reference for a later UI pass."
  observation_class: ui-call

## downstream_side_effects

- side_effect_class: db-write
  description: "SOFT-deletes the `tag` row — `UPDATE tag SET deleted_at = now() WHERE id = ? AND deleted_at IS NULL`. The row remains physically present; it becomes invisible to all `tag`-table reads."
  evidence: "TagServiceImpl.java:66 + ReactiveAbstractSoftDeleteCRUDRepository.java:50-59"
  cardinality_per_call: "1 if the tag exists and is not already deleted, else 0 (and the chain emits NotFoundException at step 2 before reaching here)"
  reachable_from_entry_points:
    - "rest:DELETE /api/tags/{tag_id}"
    - "ui_route:Management -> Tags tab (tag delete control)"
- side_effect_class: db-write
  description: "HARD-deletes every `tag_to_term` row for the tag — `DELETE FROM tag_to_term WHERE tag_id = ?`."
  evidence: "TagServiceImpl.java:64 + ReactiveTagRepositoryImpl.java:280-286"
  cardinality_per_call: "0..N — one delete per term the tag was attached to"
  reachable_from_entry_points:
    - "rest:DELETE /api/tags/{tag_id}"
    - "ui_route:Management -> Tags tab (tag delete control)"
- side_effect_class: db-write
  description: "HARD-deletes every `tag_to_data_entity` row for the tag — `DELETE FROM tag_to_data_entity WHERE tag_id = ?`."
  evidence: "TagServiceImpl.java:65 + ReactiveTagRepositoryImpl.java:235-241"
  cardinality_per_call: "0..N — one delete per data entity the tag was attached to"
  reachable_from_entry_points:
    - "rest:DELETE /api/tags/{tag_id}"
    - "ui_route:Management -> Tags tab (tag delete control)"
- side_effect_class: db-write
  description: "Refreshes `term_search_entrypoint.tag_vector` for the tag's terms via `updateChangedTagVectors(tagId)` — but on the delete path this runs AFTER the `tag_to_term` rows are deleted, so the discovery CTE (`SELECT term_id FROM tag_to_term WHERE tag_id = ?`) is empty and zero term rows are re-indexed (see bugs_limitations_corner_cases)."
  evidence: "TagServiceImpl.java:68-69 + ReactiveTermSearchEntrypointRepositoryImpl.java:136-166"
  cardinality_per_call: "effectively 0 on the delete path — the CTE keyed on the just-deleted tag_to_term rows finds nothing"
  reachable_from_entry_points:
    - "rest:DELETE /api/tags/{tag_id}"
    - "ui_route:Management -> Tags tab (tag delete control)"
- side_effect_class: db-write
  description: "NEGATIVE side effect — `tag_to_dataset_field` rows for the tag are NOT deleted; they survive as orphans pointing at the soft-deleted tag. The data-entity-side `search_entrypoint.tag_vector` is also NOT refreshed. These absences are operator-observable consequences (orphan rows; stale search index) — recorded as side effects because their absence is a behaviour, not a no-op."
  evidence: "TagServiceImpl.java:64-66 (the cascade omits tag_to_dataset_field) + ReactiveTagRepositoryImpl.java:299-306 (the unused delete method) + ReactiveSearchEntrypointRepositoryImpl.java:319-342 (the data-entity-side vector refresh never called)"
  cardinality_per_call: "0 (no row deleted / no vector refreshed) — leaving N orphan tag_to_dataset_field rows where N = the tag's dataset-field attachments"
  reachable_from_entry_points:
    - "rest:DELETE /api/tags/{tag_id}"
    - "ui_route:Management -> Tags tab (tag delete control)"
- side_effect_class: page-render
  description: "Returns HTTP 204 No Content with an empty body to the caller."
  evidence: "TagController.java:32-33"
  cardinality_per_call: 1
  reachable_from_entry_points:
    - "rest:DELETE /api/tags/{tag_id}"
    - "ui_route:Management -> Tags tab (tag delete control)"

## sources

- understanding ← TagController.java:30-34 + TagServiceImpl.java:57-70 + ReactiveTagRepositoryImpl.java:235-306 + ReactiveAbstractSoftDeleteCRUDRepository.java:50-59
- concepts.entities.tagId ← TagController.java:31
- concepts.entities.TagDto ← TagServiceImpl.java:60 + ReactiveTagRepositoryImpl.java:54-66
- concepts.entities.tag_to_term ← ReactiveTagRepositoryImpl.java:280-286
- concepts.entities.tag_to_data_entity ← ReactiveTagRepositoryImpl.java:235-241
- concepts.entities.tag_to_dataset_field ← ReactiveTagRepositoryImpl.java:299-306
- concepts.operations.deleteTag ← TagController.java:30-34
- concepts.operations.TagServiceImpl.delete ← TagServiceImpl.java:57-70
- concepts.operations.getDto ← ReactiveTagRepositoryImpl.java:54-66
- concepts.operations.soft-delete ← ReactiveAbstractSoftDeleteCRUDRepository.java:50-59,77-79
- concepts.operations.updateChangedTagVectors ← ReactiveTermSearchEntrypointRepositoryImpl.java:136-166
- concepts.invariants.soft-delete ← ReactiveAbstractSoftDeleteCRUDRepository.java:50-59
- concepts.invariants.asymmetric-hard-delete ← ReactiveTagRepositoryImpl.java:235-241,280-286,299-306
- concepts.invariants.external-guard ← TagServiceImpl.java:62 + ReactiveTagRepositoryImpl.java:58
- concepts.invariants.not-found ← ReactiveTagRepositoryImpl.java:61 + TagServiceImpl.java:60-61
- concepts.invariants.transaction ← TagServiceImpl.java:58
- concepts.invariants.perimeter-auth ← SecurityConstants.java:141-142 + TagController.java:30-34
- dependencies_semantic.requires-feature ← TagService.java:20 + ReactiveTagRepository.java:16,38,50
- dependencies_semantic.requires-runtime ← TagController.java:16-18 + TagServiceImpl.java:58 + SecurityConstants.java:141-142
- dependencies_semantic.couples-to ← SecurityConstants.java:141-142 + ReactiveTagRepositoryImpl.java:44 + TagServiceImpl.java:64-69
- tests_coverage_semantic ← Glob odd-platform-api/src/test/**/Tag*.java (one file: TagRepositoryImplTest.java) + TagRepositoryImplTest.java:163-212 (only deleteDataEntityRelations(Collection) covered)
- docs_link_semantic.inferred_docs[0] ← WebFetch https://docs.opendatadiscovery.org/features/data-discovery/tagging (status 200, 2026-05-21)
- docs_link_semantic.inferred_docs[1] ← WebFetch https://docs.opendatadiscovery.org/developer-guides/api-reference (status 200, 2026-05-21)
- docs_link_semantic.doc_drift_findings[delete-cascade-silence] ← WebFetch features/data-discovery/tagging (status 200, 2026-05-21 — "TAG_DELETE — Remove a tag from the catalog vocabulary"; page silent on association consequences) + TagServiceImpl.java:64-66 + ReactiveTagRepositoryImpl.java:235-306
- docs_link_semantic.doc_drift_findings[external-guard-silence] ← WebFetch features/data-discovery/tagging (status 200) + TagServiceImpl.java:62-63
- docs_link_semantic.doc_drift_findings[api-reference-no-enumeration] ← WebFetch developer-guides/api-reference (status 200, 2026-05-21) + openapi.yaml:408-423
- implicit_adrs[soft-vs-hard] ← ReactiveTagRepositoryImpl.java:44 + ReactiveAbstractSoftDeleteCRUDRepository.java:50-59,77-79 + ReactiveTagRepositoryImpl.java:235-241,280-286
- implicit_adrs[external-immutable] ← TagServiceImpl.java:62-63 + :49-50
- implicit_adrs[atomic-tx] ← TagServiceImpl.java:58
- bugs_limitations_corner_cases[asymmetric-cascade] ← TagServiceImpl.java:64-66 + ReactiveTagRepositoryImpl.java:299-306
- bugs_limitations_corner_cases[asymmetric-fts] ← TagServiceImpl.java:68-69 vs :161-167 + ReactiveSearchEntrypointRepositoryImpl.java:319-342
- bugs_limitations_corner_cases[fts-too-late] ← TagServiceImpl.java:64-69 + ReactiveTermSearchEntrypointRepositoryImpl.java:141-144
- bugs_limitations_corner_cases[guard-data-entity-only] ← ReactiveTagRepositoryImpl.java:54-66 + TagServiceImpl.java:62 + ReactiveTagRepositoryImpl.java:84-93
- bugs_limitations_corner_cases[openapi-no-error-responses] ← openapi.yaml:408-423 + TagServiceImpl.java:61,63
- bugs_limitations_corner_cases[no-reaper] ← ReactiveAbstractSoftDeleteCRUDRepository.java:50-59
- stress_findings.name_behavior_pairs ← TagServiceImpl.java:57-70 + ReactiveTagRepositoryImpl.java:235-306 + ReactiveAbstractSoftDeleteCRUDRepository.java:50-59
- stress_findings.auth_gates ← SecurityConstants.java:141-142 + SecurityConstants.java:78 + TagController.java:30-34
- stress_findings.resource_boundaries ← TagServiceImpl.java:57-70 + ReactiveAbstractSoftDeleteCRUDRepository.java:50-59,77-79
- stress_findings.request_inputs ← TagController.java:31 + TagServiceImpl.java:59-69 + ReactiveTagRepositoryImpl.java:55-61,235-238,280-283,299-306 + ReactiveAbstractSoftDeleteCRUDRepository.java:53-56 + ReactiveTermSearchEntrypointRepositoryImpl.java:144
- security.auth_mode_relevance ← SecurityConstants.java:141-142
- security.authorization_assertions ← SecurityConstants.java:141-142 + TagController.java:30-34 + TagServiceImpl.java:57-70
- security.known_security_gaps ← TagController.java:30-34 + TagServiceImpl.java:57-70 + ReactiveTagRepositoryImpl.java:54-66 + openapi.yaml:408-423
- performance.throughput_characteristics ← TagController.java:30-34 + TagServiceImpl.java:64-65 + openapi.yaml:408-423
- performance.scaling_characteristics ← TagController.java:16-20 + ReactiveAbstractSoftDeleteCRUDRepository.java:50-59
- performance.known_performance_gaps ← ReactiveAbstractSoftDeleteCRUDRepository.java:50-59 + ReactiveTagRepositoryImpl.java:299-306
- upstream_callers ← TagController.java:30-34 + openapi.yaml:408-423 + WebFetch features/data-discovery/tagging (status 200, 2026-05-21)
- downstream_side_effects ← TagServiceImpl.java:57-70 + ReactiveTagRepositoryImpl.java:235-306 + ReactiveAbstractSoftDeleteCRUDRepository.java:50-59 + ReactiveTermSearchEntrypointRepositoryImpl.java:136-166 + ReactiveSearchEntrypointRepositoryImpl.java:319-342

## confidence_per_field

- understanding: HIGH
- concepts: HIGH
- dependencies_semantic: HIGH
- tests_coverage_semantic: HIGH
- docs_link_semantic: HIGH
- implicit_adrs: HIGH
- bugs_limitations_corner_cases: MEDIUM
- security: HIGH
- performance: HIGH
- upstream_callers: MEDIUM
- downstream_side_effects: MEDIUM
- stress_findings: MEDIUM

## Maintainer notes


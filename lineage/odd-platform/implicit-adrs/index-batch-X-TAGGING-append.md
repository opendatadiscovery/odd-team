---
artefact: implicit-adrs-batch-append
batch_id: X-TAGGING
generated_at: "2026-05-21T00:00:00Z"
generated_at_commit: 9ac6436e9bd36ba132d765076c6bbd5916fde729
prompt_version: "adr-archaeologist/0.2.0"
sidecars_consumed: 7
new_sidecar_files:
  - understanding/odd-platform__java__TagController__controller-method__createTag.md
  - understanding/odd-platform__java__TagController__controller-method__deleteTag.md
  - understanding/odd-platform__java__TagController__controller-method__getPopularTagList.md
  - understanding/odd-platform__java__TagController__controller-method__updateTag.md
  - understanding/odd-platform__java__TermController__controller-method__createTermTagsRelations.md
  - understanding/odd-platform__java__DatasetFieldController__controller-method__updateDatasetFieldTags.md
  - understanding/odd-platform__openapi__tags__openapi-tag__tag.md
batch_X_TAGGING_summary: { added_adrs: 4, strengthened_adrs: 9, wisdom_test_passes: 4, wisdom_test_reclassifications: 12 }
new_adr_ids: [ADR-CANDIDATE-203, ADR-CANDIDATE-204, ADR-CANDIDATE-205, ADR-CANDIDATE-206]
strengthened_adr_ids: [ADR-CANDIDATE-001, ADR-CANDIDATE-002, ADR-CANDIDATE-003, ADR-CANDIDATE-007, ADR-CANDIDATE-008, ADR-CANDIDATE-065, ADR-CANDIDATE-067, ADR-CANDIDATE-068, ADR-CANDIDATE-069]
new_adrs_by_severity: { HIGH: 1, MEDIUM: 3, LOW: 0 }
coherence_check: { strengthens: 6, supersedes: 0, conflicts_surfaced: 0 }
---

# Implicit ADRs — batch X-TAGGING append (odd-platform — 2026-05-21)

Directed tagging-coverage batch on `feature/graph-query-layer`. Seven new
sidecars enrich the **tag-mutation surface**: the four `TagController`
controller-methods (`createTag` / `deleteTag` / `getPopularTagList` /
`updateTag`), the two entity-tag write paths on sibling controllers
(`TermController.createTermTagsRelations`,
`DatasetFieldController.updateDatasetFieldTags`), and the `tag` OpenAPI-tag node.

## Refresh note (batch X-TAGGING)

The 7 sidecars surfaced ~20 candidate findings. After the 3-question wisdom
test (Nygard 2011 / adr.github.io / AWS Prescriptive Guidance): **4 new ADR
candidates** (`ADR-CANDIDATE-203..206`) and **9 existing ADR candidates
strengthened**. **12 candidate findings failed the wisdom test** and were
reclassified to `refactoring-scopes/` (the deleteTag asymmetric cascade, the
LSN-019 popularity drift, the status-code drift, the activity-audit absence,
the empty-list-clears-all, the unset-origin INSERT, the no-tag-name-validation,
etc. — all gaps, not decisions). See `refactoring-scopes/index-batch-X-TAGGING-append.md`.

### New ADR candidates

- **ADR-CANDIDATE-203 (MEDIUM, promote)** — **Dual conflict-semantics for tag
  directory creation**: the operator/UI/API create route (`createTag` →
  `TagService.bulkCreate` → inherited `ReactiveAbstractCRUDRepository.bulkCreate`,
  NO `ON CONFLICT`) is deliberately **fail-on-duplicate** (a name clash raises
  `UniqueConstraintException`), while the Collector ingestion route
  (`getOrInjectTagByName` / `getOrCreateTagsByName`) is deliberately
  **upsert-shaped / silent-idempotent**. Two distinct service methods, two
  conflict semantics: operator-driven creates surface a clear error, ingestion-
  driven creates are replay-safe. Surfaced by `createTag.md:implicit_adrs[0]`.

- **ADR-CANDIDATE-204 (MEDIUM, extend-existing → ADR-CANDIDATE-062)** —
  **Dedicated per-aspect entity-tag permissions**: tag-edit on each taggable
  entity carries its OWN permission (`TERM_TAGS_UPDATE` distinct from
  `TERM_UPDATE`; `DATASET_FIELD_TAGS_UPDATE` distinct from the general
  dataset-field edit), each registered as a separate `SecurityRule` and a
  separate `PolicyPermissionDto` enum member. An operator can author a Policy
  that grants tag-editing without granting name/definition editing. This
  EXTENDS the batch-K `ADR-CANDIDATE-062` ("two-permission split on the
  data-entity write surface — `DATA_ENTITY_TAGS_UPDATE` distinct from
  `DESCRIPTION_UPDATE` / `INTERNAL_NAME_UPDATE`") from one entity to the full
  tag-assignable entity set (data-entity + term + dataset-field). Surfaced by
  `createTermTagsRelations.md:implicit_adrs[0]`.

- **ADR-CANDIDATE-205 (HIGH, promote)** — **Multi-channel tag-relation
  ownership model**: tag-RELATION rows encode their provenance so a UI
  replace-all only ever touches the channel the UI owns.
  `tag_to_dataset_field` carries an `origin` enum (`INTERNAL` / `EXTERNAL` /
  `EXTERNAL_STATISTICS` — `TagOrigin.java:3-7`); `tag_to_data_entity` carries
  an `external` boolean; `tag_to_term` carries NEITHER (terms have no
  ingestion-side tagging path). The dataset-field replace-all DELETEs only
  `origin='INTERNAL'`; the data-entity delete/update path is gated by the
  `boolOr(tag_to_data_entity.external)` aggregate; the term path replace-all
  removes every relation (no carve-out). The `!external` guard on tag
  delete/update makes Collector-pushed tags immutable to the UI. The model is
  load-bearing for the trust boundary between operator-authored and
  ingestion-authored tagging. Surfaced by
  `updateDatasetFieldTags.md:implicit_adrs[1]` +
  `createTermTagsRelations.md:invariants` + `deleteTag.md:implicit_adrs[1]`.

- **ADR-CANDIDATE-206 (MEDIUM, promote)** — **Search-index consistency is part
  of the synchronous transaction for tag mutations**: `TagServiceImpl.update`
  makes the triple FTS-vector refresh (`updateSearchVectors` — entity
  `tag_vector` + dataset-structure vector + term-side vector) part of the
  awaited `@ReactiveTransactional` chain via `flatMap(this::updateSearchVectors)`,
  NOT a fire-and-forget `subscribe`. A user who renames a tag and immediately
  full-text-searches the new name sees the carrying entities. The triple-zip
  is concurrent (intentional parallelism for latency). Surfaced by
  `updateTag.md:implicit_adrs[1]`. NOTE: the `delete` path's asymmetric
  1-of-3-refresh and run-too-late ordering is the GAP-shaped counterpart —
  REFACTOR-489, not part of this ADR.

### Strengthened ADR candidates

- **ADR-CANDIDATE-001** (controllers-as-delegates) — **7 new confirmations**:
  `createTag` (3-line reactive `.collectList().map(bulkCreate).map(ok)`),
  `deleteTag` (5-line `.then(noContent)`), `getPopularTagList` (2-line
  `.map(ok)`), `updateTag` (2-line `.flatMap(...).map(ok)`),
  `createTermTagsRelations` (5-line `Mono.just(ResponseEntity.ok(...))`),
  `updateDatasetFieldTags` (4-line `Mono.just(ResponseEntity.ok(tags))`), and
  the `tag` openapi-tag node (`TagController implements TagApi`, `TagApi` is
  OpenAPI-generated). Every method is an `@Override` of a generated `*Api`
  interface with zero business logic. See STRENGTHENS block on
  `detail/ADR-CANDIDATE-001.md`.

- **ADR-CANDIDATE-002** (centralised SECURITY_RULES, not `@PreAuthorize`) — **5
  new write-path confirmations**: `createTag` → `(POST /api/tags, TAG_CREATE)`
  at `SecurityConstants.java:138`; `updateTag` → `(PUT /api/tags/{tag_id},
  TAG_UPDATE)` at `:138-142`; `deleteTag` → `(DELETE /api/tags/{tag_id},
  TAG_DELETE)` at `:141-142`; `createTermTagsRelations` →
  `(PUT /api/terms/{term_id}/tags, TERM_TAGS_UPDATE)` at `:185-186` (per-term
  `TERM` resource-context); `updateDatasetFieldTags` →
  `(PUT /api/datasetfields/{dataset_field_id}/tags, DATASET_FIELD_TAGS_UPDATE)`
  at `:288-290` (parent-data-entity-scoped `DATASET_FIELD` resource-context).
  Every controller-method + the service tier carry ZERO `@PreAuthorize`.

- **ADR-CANDIDATE-003** (GET endpoints outside SECURITY_RULES — read-collaborative)
  — **1 new confirmation**: `getPopularTagList` is the ONLY `/api/tags`
  operation with no `SecurityRule` entry; the GET falls through to
  `AuthorizationCustomizer.java:29-30`'s catch-all `.authenticated()`. Any
  authenticated user can enumerate the entire global tag directory regardless
  of `TAG_*` grants. The pattern is confirmed at yet another controller's read
  surface. The blast-radius gap is REFACTOR-490-adjacent (open-read directory
  enumeration).

- **ADR-CANDIDATE-007** (uniform `Mono<ResponseEntity<T>>`) — **6 new
  confirmations** across all six tag controller-methods: `.map(ResponseEntity::ok)`
  (createTag / getPopularTagList / updateTag), `.then(Mono.just(
  ResponseEntity.noContent().build()))` (deleteTag — the documented delete
  sub-pattern), `Mono.just(ResponseEntity.ok(...))` (createTermTagsRelations /
  updateDatasetFieldTags). No controller-level exception translation.

- **ADR-CANDIDATE-008** (OpenAPI tags follow URL-prefix scoping,
  single-tag-per-operation) — **1 PRIMARY-SOURCE confirmation**: the `tag`
  openapi-tag sidecar directly states `implicit_adrs[0]`: "OpenAPI tags in this
  spec follow URL-prefix scoping — the `tag` tag scopes only `/api/tags*`
  operations; the per-entity tag-ASSIGNMENT operations under
  `/api/dataentities/{id}/tags`, `/api/terms/{id}/tags`,
  `/api/datasetfields/{id}/tags` are tagged with the PARENT resource, not
  `tag`." This is the third openapi-tag node (after `alert`, `dataEntity`)
  confirming the convention; `tag` ALSO confirms the single-element
  `tags: [tag]` arrays and the auth-out-of-band finding. Support count
  3 → 4 sidecars.

- **ADR-CANDIDATE-067** (`@ReactiveTransactional` boundary asymmetry — list
  reads OUTSIDE TX, multi-step writes INSIDE TX) — **multiple new
  confirmations**: `getPopularTagList` / `TagServiceImpl.listMostPopular` have
  NO `@ReactiveTransactional` (a pure SELECT-only read); `TagServiceImpl.delete`
  / `.update` / `TermServiceImpl.upsertTags` / `DatasetFieldServiceImpl.
  updateDatasetFieldTags` ALL carry `@ReactiveTransactional` (multi-statement
  orchestrations). `createTag` adds a NUANCE: `TagServiceImpl.bulkCreate` is a
  single-step delegation and carries NO annotation — the TX boundary is the
  INHERITED `@ReactiveTransactional` on `ReactiveAbstractCRUDRepository.bulkCreate`
  (`:113`); the convention "single-step service methods don't carry the
  annotation; multi-statement ones do" holds.

- **ADR-CANDIDATE-068** (two-tier soft-delete taxonomy) — **1 new controller-
  method confirmation**: `deleteTag` confirms from the controller side that the
  `tag` directory entry is SOFT-deleted — `ReactiveTagRepositoryImpl extends
  ReactiveAbstractSoftDeleteCRUDRepository` and `delete(tagId)` is `UPDATE tag
  SET deleted_at = now()`. This re-confirms the batch-N `ReactiveTagRepositoryImpl`
  primary-source finding from the controller-method angle.

- **ADR-CANDIDATE-069** (edge tables are hard-delete) — **1 new controller-
  method confirmation**: `deleteTag` confirms `tag_to_term` and
  `tag_to_data_entity` are HARD-deleted (`DSL.delete(...)`) while the `tag`
  directory row is soft-deleted — the asymmetric soft-on-directory /
  hard-on-relation split this ADR describes. Re-confirms the batch-N
  `ReactiveTagRepositoryImpl` finding from the controller-method angle.

- **ADR-CANDIDATE-065** (tag auto-create-on-miss is INTENTIONAL and
  spec-acknowledged) — **2 new confirmations + 1 spec-asymmetry refinement**:
  `createTermTagsRelations.md:implicit_adrs[3]` confirms the term-tag path
  auto-creates via `getOrCreateTagsByName` and is spec-documented at
  `openapi.yaml:3186` ("Also creates corresponding tags in the system if they
  don't exist"). `updateDatasetFieldTags` confirms the dataset-field path
  auto-creates via the SAME `getOrCreateTagsByName` — BUT with a refinement:
  the dataset-field endpoint's OpenAPI description (`openapi.yaml:2500`,
  "Updates DatasetField's tags") does NOT mention the auto-create, unlike the
  data-entity (`openapi.yaml:1174`) and term (`openapi.yaml:3186`) paths. The
  spec-acknowledgment that distinguishes the Tag side-channel from the Owner/
  Title parallels is PRESENT for data-entity + term, ABSENT for dataset-field.
  Support count 1 → 3 sidecars.

## Coherence check (Rule 6 — pre-emit cross-registry)

Grepped `feature-flows/index.yaml` + the other registries for the tag-mutation
anchors (`TagController`, `TagServiceImpl`, `getOrCreateTagsByName`, `deleteTag`,
`TAG_CREATE`, `tag_to_*`, `getPopularTagList`).

- **`feature-flows/index.yaml` F-018 (Manual Object Tagging, P-01:F-006)** —
  same-polarity STRENGTHENS. F-018's `drift_class_summary` already enumerates
  `delete_tag_cascade_asymmetric_tag_to_dataset_field_rows_orphaned_after_soft_delete`,
  `get_popular_tag_list_no_security_rule_open_read_to_any_authenticated_user`,
  `tag_status_code_drift_controller_200_vs_spec_201_create_and_update`,
  `tag_controller_write_paths_no_activity_log_asymmetric_with_per_entity_tag_assignment_path`,
  `data_entity_tags_update_side_channel_into_global_tag_directory`,
  `name_behavior_drift_list_most_popular_paginate_inside_cte_yields_oldest_by_id_not_most_popular_by_count`.
  This batch's 7 controller-method/openapi sidecars are the PRIMARY-SOURCE
  confirmation of facets F-018 minted from the repository-tier / class-tier
  passes. **0 contradictions** — every new finding agrees with F-018's
  established polarity. The new ADRs declare `related_pillar_features: [P-01:F-006]`.
- All 4 new ADR detail files carry `related_features` back-links to F-018 and
  cross-link the co-surfaced refactoring scopes. No `SUPERSEDES`. No
  `coherence-conflicts` line written.

## Cross-pillar note (Rule 6.5 — system-mission.md)

The tag-mutation surface is **cross-pillar** per `system-mission.md`: P-01
(Data Discovery — Manual Object Tagging F-018), P-06 (Data Glossary —
term-tag relations), P-08 (Management & Administration — the Tags tab CRUD),
P-09 (Security & Access Control — the three `TAG_*` permissions + the
per-aspect entity-tag permissions). ADR-CANDIDATE-205 (multi-channel
ownership model) spans P-01 + P-10 (Integrations & Ingestion — the
EXTERNAL/EXTERNAL_STATISTICS channels are written by the Collector path) and
is the highest-severity new ADR for that reason — the trust boundary it
codifies is the seam between operator-authored and ingestion-authored state.

## Re-ranked Top 20 by leverage (combined set — deterministic)

Ranking = `triangulation_count × severity_weight` (HIGH=4, MEDIUM=2, LOW=1),
ties broken by ID ascending. Heads only; full bodies in `detail/`.

1. ADR-CANDIDATE-002 — centralised SECURITY_RULES — ~21-sidecar — HIGH
2. ADR-CANDIDATE-001 — controllers-as-delegates — ~21-sidecar — HIGH (MEDIUM-anchored, count-dominated)
3. ADR-CANDIDATE-003 — read-collaborative GET — 14-sidecar — HIGH
4. ADR-CANDIDATE-068 — two-tier soft-delete taxonomy — 9-sidecar — HIGH
5. ADR-CANDIDATE-007 — uniform Mono pipeline — ~20-sidecar — MEDIUM
6. ADR-CANDIDATE-067 — `@ReactiveTransactional` boundary asymmetry — ~12-sidecar — MEDIUM
7. ADR-CANDIDATE-069 — edge tables hard-delete — ~5-sidecar — MEDIUM
8. ADR-CANDIDATE-008 — OpenAPI tags by URL-prefix — 4-sidecar — MEDIUM
9. ADR-CANDIDATE-205 — multi-channel tag-relation ownership model — 3-sidecar — HIGH
10. ADR-CANDIDATE-065 — tag auto-create spec-acknowledged — 3-sidecar — MEDIUM
11. ADR-CANDIDATE-062 — two-permission split on data-entity write — 2-sidecar — MEDIUM (extended by ADR-CANDIDATE-204)
12. ADR-CANDIDATE-203 — dual conflict-semantics for tag creation — 1-sidecar — MEDIUM
13. ADR-CANDIDATE-204 — dedicated per-aspect entity-tag permissions — 1-sidecar — MEDIUM
14. ADR-CANDIDATE-206 — search-index consistency in the tag-mutation TX — 1-sidecar — MEDIUM
15. ADR-CANDIDATE-066 — popular ranking `view_count DESC` minimalism — 1-sidecar — MEDIUM
16. (existing entries below the tag surface — unchanged ranking)

(The ranking above is the tag-surface-relevant slice; the full registry
re-rank is unchanged for non-tag entries.)

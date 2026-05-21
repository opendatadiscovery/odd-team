---
artefact: refactoring-scopes-batch-append
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
batch_X_TAGGING_summary: { added_scopes: 12, strengthened_scopes: 2 }
new_scope_ids: [REFACTOR-487, REFACTOR-488, REFACTOR-489, REFACTOR-490, REFACTOR-491, REFACTOR-492, REFACTOR-493, REFACTOR-494, REFACTOR-495, REFACTOR-496, REFACTOR-497, REFACTOR-498]
strengthened_scope_ids: [REFACTOR-223, REFACTOR-226]
new_scopes_by_severity: { CRITICAL: 0, HIGH: 3, MEDIUM: 7, LOW: 2 }
new_scopes_by_category:
  asymmetric-cascade: 1
  missing-defence-in-depth: 1
  stale-index: 1
  name-behaviour-drift: 1
  missing-audit: 1
  contract-drift: 1
  missing-validation: 1
  destructive-default: 1
  fragile-wiring: 1
  contract-typo: 1
  response-shape-drift: 1
  error-mapping: 1
coherence_check: { strengthens: 6, supersedes: 0, conflicts_surfaced: 0 }
---

# Refactoring scopes — batch X-TAGGING append (odd-platform — 2026-05-21)

Directed tagging-coverage batch on `feature/graph-query-layer`. Seven new
sidecars enrich the **tag-mutation surface**. After the 3-question wisdom test,
**12 candidate findings failed it** (no stated rationale in code/docs;
addressing each is refactoring within the existing structure) and land here as
actionable refactoring scopes; **4 findings passed** and went to
`implicit-adrs/index-batch-X-TAGGING-append.md`.

## Refresh note (batch X-TAGGING)

12 new scopes (`REFACTOR-487..498`) + 2 existing scopes strengthened
(`REFACTOR-223` the tag side-door, `REFACTOR-226` the create-vs-replace naming
drift). The 3 HIGH-severity new scopes are:

- **REFACTOR-487 (HIGH, asymmetric-cascade)** — `TagServiceImpl.delete` cleans
  up only 2 of the 3 tag-relation tables; `tag_to_dataset_field` rows are
  ORPHANED, pointing at a soft-deleted `tag.id`, indefinitely (no reaper). The
  fix anchor exists and is unused: `deleteDatasetFieldRelations(long tagId)` at
  `ReactiveTagRepositoryImpl.java:299-306`.
- **REFACTOR-495 (HIGH, fragile-wiring)** — `updateDatasetFieldTags`'s relation
  INSERT relies on an UNSET `origin` pojo field + the DB column DEFAULT
  `'INTERNAL'`. If jOOQ's `newRecord(table, pojo)` emits an explicit `NULL`,
  EVERY non-empty `tags` payload violates the `NOT NULL` constraint and the
  endpoint is dead. Statically uncertain, untested — probe P-030.
- **REFACTOR-490 (MEDIUM→HIGH-adjacent, name-behaviour-drift)** — actually
  filed MEDIUM; the LSN-019 `getPopularTagList` popularity-ranking drift —
  `paginate`-inside-CTE selects the OLDEST `size` tags by `TAG.ID ASC` before
  counting, so the "Top tags" surface renders OLD-and-unused tags for any
  directory beyond `size` tags. Empirically reproduced by the maintainer
  2026-05-20.

(The remaining 9 new scopes are MEDIUM/LOW — see the per-scope detail files.)

## Strengthened scopes

- **REFACTOR-223** (tag side-door — `*_TAGS_UPDATE` mints global Tag directory
  rows without `TAG_CREATE`) — STRENGTHENED to **4 confirmed paths** this batch.
  Batch X-TAGGING adds primary-source controller-method confirmation for the
  term path (`createTermTagsRelations` → `TERM_TAGS_UPDATE` → `getOrCreateTagsByName`)
  and the dataset-field path (`updateDatasetFieldTags` → `DATASET_FIELD_TAGS_UPDATE`
  → `getOrCreateTagsByName`); `createTag` independently enumerates all four
  side-door call sites. The scope-asymmetry (`TAG_CREATE` is MANAGEMENT-scoped /
  unconditional; the `*_TAGS_UPDATE` permissions are resource-scoped /
  conditionally grantable) now has 4 confirmed entry points. See the batch-X
  STRENGTHENS block on `detail/REFACTOR-223.md`.
- **REFACTOR-226** (create-language naming for a replace-all operation) —
  STRENGTHENED with the TERM sibling. `createTermTagsRelations` is the same
  drift shape as the data-entity sibling: the operationId / spec summary
  ("Creates tags relations for term") use create-language for a delete-then-
  recreate replace-all. UNLIKE the data-entity path (whose UI thunk
  `updateDataEntityTagsActionType` masks the drift for UI users), the term-UI
  thunk was not inspected — so the term path's masking is unknown and the
  third-party-API-consumer risk is unmitigated. See the batch-X STRENGTHENS
  block on `detail/REFACTOR-226.md`.

## Coherence check (Rule 6 — pre-emit cross-registry)

Grepped `feature-flows/index.yaml` + the other registries for the tag-mutation
anchors.

- **`feature-flows/index.yaml` F-018 (Manual Object Tagging, P-01:F-006)** —
  same-polarity STRENGTHENS, **0 contradictions**. F-018's `drift_class_summary`
  ALREADY enumerates the facets this batch promotes to standalone scopes:
  `delete_tag_cascade_asymmetric_tag_to_dataset_field_rows_orphaned_after_soft_delete`
  (= REFACTOR-487), `get_popular_tag_list_no_security_rule_open_read_to_any_authenticated_user`
  (= REFACTOR-490's open-read facet), `tag_status_code_drift_controller_200_vs_spec_201_create_and_update`
  (= REFACTOR-492), `tag_controller_write_paths_no_activity_log_asymmetric_with_per_entity_tag_assignment_path`
  (= REFACTOR-491), `name_behavior_drift_list_most_popular_paginate_inside_cte_yields_oldest_by_id_not_most_popular_by_count`
  (= REFACTOR-490), `tag_name_no_validation_no_length_cap_no_charset_filter`
  (= REFACTOR-493), `data_entity_tags_update_side_channel_into_global_tag_directory`
  (= REFACTOR-223 family). The 7 controller-method/openapi sidecars are the
  PRIMARY-SOURCE confirmation of facets F-018 minted at the repository/class
  tier — every new scope AGREES with F-018's established polarity. F-018 already
  carries `TEST-GAP-LSN019-listMostPopular-ranking` for the popularity-drift
  test gap; REFACTOR-490 cross-links it.
- All 12 new scope detail files carry `related_features: [F-018]` back-links.
  No `SUPERSEDES`. No `coherence-conflicts` line written. The batch-VAL-LSN-019
  note in feature-flows records that a batch-W TagController transcription
  ("orders by descending count") was already SUPERSEDED there by the rev-4
  re-enrichment — this batch's sidecars are the rev-5 re-enrichment and carry
  the corrected LSN-019 model, so REFACTOR-490 is consistent with the
  already-superseding-corrected feature-flows state.

## Cross-pillar note (Rule 6.5 — system-mission.md)

The tag-mutation surface spans P-01 (Data Discovery — F-018 Manual Object
Tagging), P-06 (Data Glossary — term-tag relations), P-08 (Management &
Administration — the Tags tab CRUD), P-09 (Security & Access Control), and
P-10 (Integrations & Ingestion — the EXTERNAL/EXTERNAL_STATISTICS channels).
The cross-pillar scopes get a severity bump per Rule 6.5:
- **REFACTOR-487** (deleteTag asymmetric cascade) is HIGH partly because it
  spans P-01 (data-entity + dataset-field tagging) feeding the Tags tab (P-08);
  an orphaned `tag_to_dataset_field` row is a cross-pillar integrity defect.
- **REFACTOR-489** (delete-path FTS refresh) spans P-01 + P-05 (the search-
  vector pipeline) — a deleted tag's name lingers in the data-discovery search
  index across pillar boundaries.

## Suggested sprint groupings

- **SEC-NNN authorization-audit sprint** — REFACTOR-223 (tag side-door, 4
  paths), REFACTOR-488 (the `!external` guard's dataset-field-side hole),
  REFACTOR-490's open-read facet. Pair with the existing REFACTOR-199 /
  REFACTOR-206 (Owner / Title auto-create side-doors) — all share the
  "directory growth via per-resource permission" pattern.
- **"Tag delete-path correctness" sprint** — REFACTOR-487 (orphaned
  `tag_to_dataset_field`), REFACTOR-488 (guard hole), REFACTOR-489 (FTS refresh
  too late / 1-of-3). These three are one coherent fix: complete the cascade,
  complete the guard, complete the index refresh; all on `TagServiceImpl.delete`.
  Probes P-032 + P-033 pin them.
- **DOC-NNN / OpenAPI contract-hardening sprint** — REFACTOR-492 (200-vs-201
  status drift on createTag + updateTag — same class as the REFACTOR-193
  batch-note family), REFACTOR-496 (`IdsParam` "Entity ids" misdescription),
  REFACTOR-226 (create-vs-replace naming). Pair with the REFACTOR-193 family.
- **GENAI-style "tag mutation hardening" sprint** — REFACTOR-493 (no tag-name
  validation), REFACTOR-494 (empty-list clears all relations), REFACTOR-498
  (page/size degenerate inputs → 500).
- **TEST-NNN companion** — REFACTOR-495 needs probe P-030 promoted to a
  Testcontainers integration test (does the unset-`origin` INSERT persist?);
  REFACTOR-490 needs the F-018 `TEST-GAP-LSN019-listMostPopular-ranking`
  fixture (35 tags, size=30).

## Re-ranked Top 20 by leverage (tag-surface slice — deterministic)

Ranking = `triangulation_count × severity_weight` (CRITICAL=8, HIGH=4,
MEDIUM=2, LOW=1), ties broken by ID ascending. Heads only; full bodies in
`detail/`.

1. REFACTOR-073 — no boot-time security-posture validator — 11-sidecar — HIGH (unchanged, registry-wide #1)
2. REFACTOR-185 — DISABLED-mode bypasses all SECURITY_RULES — 11+-sidecar — HIGH (extends to 5 tag-mutation endpoints this batch)
3. REFACTOR-223 — tag side-door (`*_TAGS_UPDATE` mints directory rows) — 4-path — MEDIUM (count-elevated)
4. REFACTOR-487 — deleteTag asymmetric cascade (`tag_to_dataset_field` orphaned) — 1-sidecar — HIGH
5. REFACTOR-495 — updateDatasetFieldTags unset-`origin` INSERT may be dead-on-arrival — 1-sidecar — HIGH
6. REFACTOR-490 — getPopularTagList LSN-019 popularity-ranking drift — 1-sidecar (+ empirical) — MEDIUM
7. REFACTOR-489 — deleteTag FTS refresh 1-of-3 + run-too-late — 1-sidecar — MEDIUM
8. REFACTOR-491 — no `@ActivityLog` on tag-directory + term-tag mutations — 2-sidecar — MEDIUM
9. REFACTOR-492 — tag status-code drift (200 vs spec 201) — 2-sidecar — MEDIUM
10. REFACTOR-494 — empty `tag_name_list`/`tags:[]` clears all relations — 2-sidecar — MEDIUM
11. REFACTOR-488 — `!external` guard's dataset-field-side hole — 2-sidecar — MEDIUM
12. REFACTOR-497 — updateTag response omits `external`/`usedCount` — 1-sidecar — MEDIUM
13. REFACTOR-226 — create-vs-replace naming drift (now + term sibling) — 2-sidecar — MEDIUM
14. REFACTOR-493 — no tag-name validation — 3-sidecar — LOW
15. REFACTOR-496 — `IdsParam` "Entity ids" misdescription on getPopularTagList — 2-sidecar — LOW
16. REFACTOR-498 — getPopularTagList page/size degenerate inputs → 500 — 1-sidecar — LOW
17. (existing non-tag scopes — unchanged ranking)

(The ranking above is the tag-surface-relevant slice; the full-registry
re-rank is unchanged for non-tag entries.)

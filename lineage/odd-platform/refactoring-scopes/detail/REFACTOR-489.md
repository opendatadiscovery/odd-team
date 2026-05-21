## REFACTOR-489 — `deleteTag` FTS refresh is asymmetric (1 of 3 vectors) AND runs too late — it fires after the `tag_to_term` rows are deleted, so its discovery CTE is empty and it cleans nothing

**Severity**: MEDIUM
**Category**: stale-index
**Batch**: X-TAGGING
**Related pillar features**: P-01:F-006 (Manual Object Tagging), P-01 (Data Discovery — full-text search), P-05 (search-vector pipeline cross-cut)
**related_features**: [F-018]

**Surfaced by**:
- `odd-platform__java__TagController__controller-method__deleteTag.md:bugs_limitations_corner_cases[1]` ("ASYMMETRIC FTS REFRESH (delete vs update) — `delete` refreshes ONE search vector; `update` refreshes THREE.")
- `odd-platform__java__TagController__controller-method__deleteTag.md:bugs_limitations_corner_cases[2]` ("FTS REFRESH RUNS TOO LATE on the delete path.")

**Statement**: `TagServiceImpl.delete` has TWO related FTS defects. **(1) Asymmetric refresh** — `delete` refreshes only ONE search vector (`reactiveTermSearchEntrypointRepository.updateChangedTagVectors(tagId)`, `TagServiceImpl.java:68-69`), whereas the sibling `update` refreshes THREE (`updateSearchVectors` triple `Mono.zip` at `:161-167` — the data-entity `search_entrypoint.tag_vector`, the dataset-structure vector, the term-side vector). After a tag delete, the data-entity-side `search_entrypoint.tag_vector` still carries the deleted tag's name token until an unrelated data-entity write refreshes that row — a global search for the deleted tag name still surfaces previously-tagged entities. **(2) Run-too-late ordering** — the one refresh `delete` DOES perform is effectively a no-op: `delete` calls `deleteTermRelations(tagId)` in the `Flux.zip` at `:64-65` (hard-deleting the `tag_to_term` rows) BEFORE the term-side refresh at `:68-69`. `ReactiveTermSearchEntrypointRepositoryImpl.updateChangedTagVectors` discovers which terms to re-index via `SELECT term_id FROM tag_to_term WHERE tag_id = ?` (`:141-144`) — but those rows are already gone, so the CTE is empty and ZERO term rows get re-indexed. Net result: a tag delete cleans NONE of the search vectors carrying the deleted tag's name. Probe P-033 (hypotheses H1 + H2) pins it.

**Evidence**: `TagServiceImpl.java:68-69` (delete refreshes only the term-side) vs `:161-167` (update refreshes all three) + `TagServiceImpl.java:64-69` (the zip-then-refresh ordering) + `ReactiveTermSearchEntrypointRepositoryImpl.java:141-144` (the refresh CTE keyed on the just-deleted `tag_to_term` rows) + `ReactiveSearchEntrypointRepositoryImpl.java:319-342` (the data-entity-side `updateChangedTagVectors` that `delete` never calls) + `lineage/odd-platform/probes/P-033.yaml`.

**Why this is a gap, not an ADR (wisdom test)**:
1. *Intentional?* NO. There is no comment, doc, or ADR defending "tag delete deliberately leaves the search index stale". The `update` path refreshes all three vectors correctly — the maintainer knows the right shape; the `delete` path simply does it wrong (one vector instead of three, and that one after the rows it depends on are gone). The asymmetry against `update` is the smoking gun.
2. *Structural impact?* NO — the fix is to call all three `updateChangedTag*Vectors` on the delete path (matching `update`'s `updateSearchVectors`) and to reorder so the term-side refresh runs BEFORE the `tag_to_term` hard-delete (or to pass the term-id set captured pre-delete).
3. *Refactoring or structural?* REFACTORING — reorder + add the two missing refresh arms within `TagServiceImpl.delete`.
→ refactoring scope.

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-206 (search-index consistency is part of the synchronous transaction for tag mutations) is the TARGET design — the `update` path makes the FTS refresh a synchronous, awaited, in-transaction post-condition. REFACTOR-489 is the `delete` path's deviation from that design: `delete` is supposed to leave the search index consistent (no deleted-tag tokens) but does not. The ADR is the prescription; this scope is the gap.

**Proposed remedy**: In `TagServiceImpl.delete`: (a) refresh all THREE FTS vectors, reusing the `updateSearchVectors` helper or an equivalent triple-zip (data-entity + dataset-structure + term-side); (b) FIX the ordering — capture the affected `term_id` set (and data-entity / dataset-field id sets) BEFORE the `Flux.zip` hard-deletes the relation rows, or run the term-side refresh ahead of `deleteTermRelations`. Promote probe P-033 to an integration test: after a tag delete, assert a full-text search for the deleted tag's name returns ZERO entities and ZERO terms.

**Severity rationale**: MEDIUM — a stale-search-index correctness defect. A deleted tag's name keeps surfacing previously-tagged entities and terms in full-text search until unrelated writes happen to refresh those rows. Operator-visible (search results are wrong) but not data-destructive; severity bounded because the staleness self-heals on the next write to each affected row. Cross-pillar (P-01 tagging → P-05 search-vector pipeline → P-01 search results).

**Suggested backlog grouping**: "Tag delete-path correctness" sprint — pair with REFACTOR-487 (orphaned `tag_to_dataset_field`) and REFACTOR-488 (the `!external` guard hole); all three are one coherent fix on `TagServiceImpl.delete`, pinned by probes P-032 + P-033.

---

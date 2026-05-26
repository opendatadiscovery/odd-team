# SHB-029 — Term delete leaves orphan `term_to_term` rows AND stale `term_search_entrypoint` vectors — deleted terms remain visible in linked-terms panels and search-index storage

**Category**: merged
**Severity**: MEDIUM

## Hypothesis

Operators deleting a term via `DELETE /api/terms/{id}` see the UI navigate them back to the Dictionary tab and observe the term gone from the catalog. But the cleanup is INCOMPLETE in two distinct ways: (1) the service `TermServiceImpl.delete` (lines 155-164) hard-deletes `data_entity_to_term` and `dataset_field_to_term` link rows + soft-deletes the term itself, but **DOES NOT clean up `term_to_term` rows where the deleted term is `assigned_term_id` or `target_term_id`** — those rows persist; (2) compounding the leak, `ReactiveTermRepositoryImpl`'s 7 read sites that join `term_to_term` (lines 198-199, 227-231, 324-325, 345, 429-430, 448-454, 472-491, 510-523) **do NOT filter `term_to_term.deleted_at IS NULL`** (V0_0_91 schema-drift: term_to_term retains a soft-delete column unlike its V0_0_76-dropped siblings, but the application never filters it). Net effect: a deleted term that participated in term-to-term linkages remains visible in OTHER live terms' "Linked Terms" panels (via the Term Details page's Overview tab). Compounding further: the `term_search_entrypoint` row for the deleted term is NEVER cleaned up (`TermServiceImpl.delete` makes no call to any vector-clear method; `ReactiveTermSearchEntrypointRepository` has no `delete` / `clearVectorsForTerm` method — interface has only 7 update methods). The soft-deleted term's tsvector contents persist indefinitely in the FTS index storage; any direct query against `term_search_entrypoint` that doesn't JOIN `term` would surface the deleted term.

## Evidence

- `odd-platform-api/src/main/java/.../service/term/TermServiceImpl.java:155-164` — delete chain calls `deleteRelationsWithDataEntities` + `deleteRelationsWithDatasetFields` + `termRepository.delete(id)`. **No `termRelationsRepository.deleteRelationsWithTerm(termId)` cascade for `term_to_term`. No `termSearchEntrypointRepository.delete(termId)` call.**
- `lineage/odd-platform/understanding/odd-platform__java__TermController__controller-class__TermController.md:227` (bugs[4]) — "deleteTerm cleans up `data_entity_to_term` and `dataset_field_to_term` link rows but NOT `term_to_term` link rows... orphan edges remain visible on `getTermLinkedTerms` indefinitely. Operators deleting a term that had term-to-term linkages will see the deleted term still appear in OTHER terms' linked-terms lists."
- `lineage/odd-platform/understanding/odd-platform__java__repository__reactive__repository__ReactiveTermRepositoryImpl.md:35` (concepts.entities) — "Despite the column's presence, the repository's `term_to_term` reads (lines 198-199, 227-231, 324-325, 345, 429-430, 448-454, 472-491, 510-523) DO NOT filter `term_to_term.deleted_at IS NULL`."
- `lineage/odd-platform/understanding/odd-platform__java__repository__reactive__repository__ReactiveTermRepositoryImpl.md:50` (invariants) — "**Asymmetry:** the term itself is soft-deleted; its link rows in `data_entity_to_term` / `dataset_field_to_term` / `term_to_term` are HARD-DELETED via `deleteRelationsWithDataEntities` (line 162) and `deleteRelationsWithDatasetFields` (line 163), with `term_to_term` cascading via `deleteTermToTermRelations` only when `updateTermDefinitionTermsState` (line 472) runs description reconciliation. Term-itself delete does NOT remove `term_to_term` rows where the deleted term is `assigned_term_id` or `target_term_id`."
- `lineage/odd-platform/understanding/odd-platform__java__repository__reactive__repository__ReactiveTermSearchEntrypointRepositoryImpl.md:128` (bugs[0]) — "**Term DELETE leaves stale vectors in `term_search_entrypoint`.** `TermServiceImpl.delete(long id)` deletes term_to_term, term_to_data_entity, term_to_dataset_field relations [sic] and the term row itself, but never calls any method on this repository to drop the term's row from `term_search_entrypoint`."
- `lineage/odd-platform/understanding/odd-platform__ts__react-component__component__TermDetails.md:120` (bugs) — UI side: "linked-terms panel rendered from `Overview.tsx:27-31` inherits the asymmetry transparently. The F-002 sidecar describes the SQL-layer and repository-layer halves; this UI sidecar describes the user-visible consequence (operators cannot tell logically-deleted term_to_term rows from fresh ones)."

## Notes

- **Two-layer schema-drift compounds**: the V0_0_91 migration added `term_to_term` with a `deleted_at` column (asymmetric to V0_0_76 which DROPPED `deleted_at` from sibling term-link tables). The application never uses the column. Net: it's either a dead column ripe for V0_0_NNN drop migration, OR the application is missing the filter. Either interpretation requires action.
- **Operator-visible behaviour**: an operator who deletes term "Customer" sees the term gone from the Dictionary. They open term "User Account" which had a linked term to "Customer" — the linked-terms panel STILL shows "Customer". Clicking "Customer" 404s (the term details endpoint correctly filters `TERM.DELETED_AT.isNull()`). The result is a broken click-through with no visual cue distinguishing live-link from dead-link.
- **Audit-recovery story is broken**: if the deletion was a mistake, restoring the term would re-link OLD term_to_term rows (because they were never deleted) but NEW term_to_term rows from descriptions written DURING the deletion window would not exist. The platform's lack of a "restore deleted term" affordance bypasses this immediate issue, but the asymmetric state lingers.
- **Storage leak is unbounded**: `term_search_entrypoint` grows monotonically. Per the sibling sidecar, no housekeeping job exists for the search-entrypoint table (verified — `<odd-platform-repo>/odd-platform-api/src/main/java/.../housekeeping/job/` has no entry). A 5-year-old deployment with 100K+ term-delete cycles accumulates 100K+ stale tsvector rows.
- **Cluster with SHB-028 (term-to-term linkage RBAC)**: the same `term_to_term` table is the locus of both findings — SHB-028 says "no permission gate to write"; this says "no cleanup on delete + no filter on read". Together they paint a picture of `term_to_term` as a less-maintained sibling of the term-to-data-entity linkage axis.
- **Cluster with F-002**: F-002 covers term-to-entity linkage; the term_to_term axis is the sibling. Set `Category: clustering`, `Links.cluster_with: [F-002, SHB-028]`.
- guess: a `TermRelationsRepositoryImpl.deleteRelationsWithTerm(termId)` cascade call from `TermServiceImpl.delete` would fix the orphan-rows half; a new `ReactiveTermSearchEntrypointRepository.delete(termId)` method called from the same site would fix the storage-leak half. Two small fixes, single deletion path.

## Next

1. **Mark as ENRICHER for F-002** with the deletion-cleanup asymmetry facet. The feature-flow-builder should attach this to F-002's drift surface alongside the term-to-term linkage axis (SHB-028).
2. **REFACTOR-NNN** (cleanup cascade): add `termRelationsRepository.deleteRelationsWithTerm(termId)` to `TermServiceImpl.delete` before/after the term soft-delete. Decide whether to HARD-delete (consistent with `data_entity_to_term` / `dataset_field_to_term`) or SOFT-delete via the `term_to_term.deleted_at` column (consistent with the schema's intent).
3. **REFACTOR-NNN** (read filter): add `TERM_TO_TERM.DELETED_AT.isNull()` to the 7 read sites in `ReactiveTermRepositoryImpl`. Required either way — if the cleanup cascade hard-deletes, the filter is defence-in-depth; if soft-deletes, the filter is the actual fix.
4. **REFACTOR-NNN** (search-entrypoint cleanup): add `delete(termId)` method to `ReactiveTermSearchEntrypointRepository` + call it from `TermServiceImpl.delete`.
5. **TEST-NNN**: regression test creating term A + term B + link(A,B), deleting A, asserting (a) `getTermLinkedTerms(B)` does NOT return A, (b) `term_search_entrypoint` row for A is absent.
6. **DOC-NNN**: business-glossary doc page does not describe term-delete semantics. Add operator-visible description of what gets removed on delete (and what doesn't, until the fix lands).

## Links

- cluster_with: [F-002, SHB-028]
- merged_into: F-002
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: merged into F-002 (P-06:F-001 Term-to-Entity Linkage) — F-002 already carries `term_delete_cascade_omits_term_to_term_rows` (MEDIUM) + `fts_write_path_term_delete_leaves_stale_vector` (MEDIUM) facets minted in batch U. SHB-029 STRENGTHENS both with (a) the V0_0_76 vs V0_0_91 schema-drift framing (dead column OR missing filter), (b) the 7-read-site enumeration of term_to_term reads that never filter deleted_at, (c) the operator-visible consequence (linked-terms panel of OTHER terms still shows the deleted term; clicking it 404s — broken click-through with no visual cue).

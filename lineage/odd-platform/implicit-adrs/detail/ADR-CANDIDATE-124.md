## ADR-CANDIDATE-124 — `hasDescriptionRelations(termId)` is the SINGLE point of enforcement for the Term-rename-protection / Term-delete-protection invariant — three nested EXISTS subqueries across the three link tables (DATA_ENTITY / DATASET_FIELD / TERM_TO_TERM) OR-combined, with asymmetric parent-soft-delete-aware filters per branch

**Severity**: HIGH
**Classification**: promote
**Pillars affected**: [P-06-data-glossary]
**Support count**: 2 sidecars (batch K TermServiceImpl + batch N ReactiveTermRepositoryImpl primary-source)
**Axes present**: repositories
**Batch**: N (2026-05-19)

**Surfaced by**:
- `ReactiveTermRepositoryImpl.md:implicit_adrs.[4]` (HIGH) — "`hasDescriptionRelations` is the SINGLE point of enforcement for the Term-rename-protection / Term-delete-protection invariant. Lines 409-438. Three nested EXISTS subqueries — one per link table — OR-combined into a single SELECT. The decision-shape is explicit: the guard MUST scan all three link tables (else a Term could be deleted while still mentioned in a dataset-field's description and the mention would dangle); the guard MUST exclude soft-deleted PARENTS (`STATUS.ne(DELETED.getId())` for data-entity and the dataset-field → data-entity chain — to allow operators to clean up the catalog after a wave of entity deletions); the guard MUST exclude soft-deleted TARGET terms in the term-to-term branch (line 432). The semantic distinction between the data-entity branches (parent-STATUS-based) and the term-to-term branch (target-deleted_at-based) reflects the soft-delete-pattern asymmetry between data_entity (status-machine) and term (deleted_at). The asymmetry is intentional and corner-case-prone." — intent_anchor: "the method name `hasDescriptionRelations` is precise; the three EXISTS branches are commented BY THEIR VARIABLE NAMES (`dataEntityDescriptionRelations`, `datasetFieldDescriptionRelations`, `termDescriptionRelations`); the predicate combinations are deliberate (each branch has a distinct `IS_DESCRIPTION_LINK.isTrue()` filter — the only thing being checked is description-mention rows, not manual links)"
- Cross-link: batch K `TermServiceImpl.md` invariants — the `TermServiceImpl.updateTerm` (line 128) and `TermServiceImpl.delete` (line 156) consume the guard; the service-tier "Can't update/delete term, which was mentioned in description" BadUserRequestException at TermServiceImpl.java:130-131 surfaces the 400 response.

**Decision statement**: ODD's Term-lifecycle invariant — "a Term mentioned in any data-entity's, dataset-field's, or another Term's description CANNOT be renamed or hard-deleted" — is enforced through a single repository method `hasDescriptionRelations(termId)` (ReactiveTermRepositoryImpl.java:409-438). The method composes three nested `EXISTS` subqueries OR-combined into a single SELECT BOOLEAN:

1. **Branch 1 — data-entity description mention** (lines 410-416): `EXISTS (SELECT 1 FROM data_entity_to_term JOIN data_entity ON ... WHERE TERM_ID = ? AND IS_DESCRIPTION_LINK = TRUE AND DATA_ENTITY.STATUS != DELETED.getId())`. Filters by the **parent data-entity's STATUS**, NOT by the link table's `deleted_at` (which doesn't exist — V0_0_76 dropped it).
2. **Branch 2 — dataset-field description mention** (lines 417-426): symmetric to Branch 1 but joining via DATASET_FIELD → DATASET_STRUCTURE → DATA_ENTITY chain; same `STATUS != DELETED` filter on the parent data-entity.
3. **Branch 3 — term-to-term description mention** (lines 427-433): `EXISTS (SELECT 1 FROM term_to_term JOIN term AS target ON ... WHERE ASSIGNED_TERM_ID = ? AND IS_DESCRIPTION_LINK = TRUE AND target.DELETED_AT IS NULL)`. Filters by the **target Term's `deleted_at`** (since term uses `deleted_at` soft-delete, not STATUS).

The branches are OR-combined into a single SELECT — the guard returns TRUE if ANY of the three is non-empty. The result is a `Mono<Boolean>` consumed by `TermServiceImpl.updateTerm` and `TermServiceImpl.delete` to decide whether to raise `BadUserRequestException("Can't update/delete term, which was mentioned in description")`.

The architectural choices encoded:
- **(a) Single point of enforcement** — the guard MUST scan all three link tables. A maintainer adding a new link table (e.g., `lookup_table_to_term`) MUST extend `hasDescriptionRelations` with a fourth EXISTS branch, OR the new link table's description mentions will dangle when the Term is deleted.
- **(b) Description-mention vs manual-link distinction** — every branch filters `IS_DESCRIPTION_LINK = TRUE`. The guard intentionally allows hard-delete of a Term that has only MANUAL links (those can be re-attached after recreation); it BLOCKS hard-delete only if the Term is auto-referenced from free-text descriptions (whose `[[ns:term]]` text would dangle).
- **(c) Parent-soft-delete-aware filter — DELIBERATE asymmetry** — the data-entity branches filter `STATUS != DELETED`; the term-to-term branch filters `target.DELETED_AT IS NULL`. The distinction reflects the soft-delete-pattern asymmetry (data_entity uses status-machine per ADR-CANDIDATE-058; term uses `deleted_at` per ADR-CANDIDATE-068). The maintainer chose this asymmetry deliberately to allow operators to delete catalog entities AND THEN delete the now-orphaned Terms in a follow-up cleanup pass — the soft-deleted entity's description references are NOT counted.
- **(d) Trade-off acknowledged**: REFACTOR-361 (NEW) captures the corner case — a Term mentioned only in a soft-deleted entity's description CAN be hard-deleted; when the entity is later restored (per ADR-CANDIDATE-055 — soft-delete is a state), the description's `[[ns:term]]` text is now dangling. The architecture accepts this risk in exchange for the cleanup UX.

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — the method's name (`hasDescriptionRelations`) is precise; the three EXISTS variable names (`dataEntityDescriptionRelations`, `datasetFieldDescriptionRelations`, `termDescriptionRelations`) are descriptive; the asymmetric per-branch filter (`STATUS != DELETED` vs `target.DELETED_AT IS NULL`) is non-coincidental — it composes the soft-delete-pattern of TWO different entities. The method is consumed at TWO service-tier sites (TermServiceImpl.updateTerm, .delete) with matching BadUserRequestException messages.
2. **Structural impact?** YES — affects the Term-lifecycle contract, the description-edit auto-link side-channel (where TermServiceImpl.findTermsInDescription resolves `[[ns:term]]` mentions and calls `markUnhandledTerm` on invalid/missing references — see ADR-CANDIDATE-064 for the manual-vs-description coexistence), the soft-delete-restore UX (the corner case is a structural consequence), the future link-table expansion (every new link table is an extension point on this method).
3. **Removing the guard is REFACTORING or STRUCTURAL?** STRUCTURAL — removing `hasDescriptionRelations` would either (a) allow Term hard-deletion with description mentions dangling, requiring a downstream `markUnhandledTerm` sweep on every Term delete, or (b) require migrating to FK-with-CASCADE on the link tables AND adding the cascading "downgrade mentions to unhandled" trigger. Both are architectural redesigns. The guard IS the architecture.

**Evidence**:
- ReactiveTermRepositoryImpl.md says: "`hasDescriptionRelations` is the SINGLE point of enforcement for the Term-rename-protection / Term-delete-protection invariant. ... the three EXISTS branches are commented BY THEIR VARIABLE NAMES (`dataEntityDescriptionRelations`, `datasetFieldDescriptionRelations`, `termDescriptionRelations`); the predicate combinations are deliberate (each branch has a distinct `IS_DESCRIPTION_LINK.isTrue()` filter — the only thing being checked is description-mention rows, not manual links)"
- ReactiveTermRepositoryImpl.java:409-438 — the three EXISTS branches with the asymmetric per-branch filter
- TermServiceImpl.java:128, 156 — the two service-tier consumers (.updateTerm, .delete) — the only callers
- TermServiceImpl.java:130-131 — the BadUserRequestException message

**Existing ADR**: none. **Composes with ADR-CANDIDATE-068** (two-tier soft-delete taxonomy — the asymmetric per-branch filter is the cross-entity application of -068's choice). **Composes with ADR-CANDIDATE-058** (data-entity status-machine soft-delete — the STATUS != DELETED filter consumes -058's enum). **Composes with ADR-CANDIDATE-064** (manual-vs-description coexistence — the `IS_DESCRIPTION_LINK = TRUE` filter is the criterion that distinguishes -064's two link types). **Composes with ADR-CANDIDATE-055** (soft-delete by-id read with `isStale` — the corner case REFACTOR-361 manifests when a soft-deleted-but-by-id-readable entity is later restored).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-361 NEW — `hasDescriptionRelations` returns FALSE for Terms mentioned only in soft-deleted entities; restore-then-edit-description produces dangling `[[ns:term]]` references that silently downgrade to `unhandled` on next save (MEDIUM — undocumented operator-visible inconsistency surface).
- REFACTOR-385 NEW — `hasDescriptionRelations` is on the permission hot path via TermPermissionExtractor.getContext (every authorized TERM-scoped HTTP request runs the guard). No caching layer; the 3-subquery cost adds to per-request latency.

**Proposed action**: Promote to `adrs/drafts/term-lifecycle-description-relation-guard.md` (new ADR). Document:
- The architectural intent (single point of enforcement for description-mention dangling).
- The three-branch EXISTS topology.
- The deliberate asymmetric per-branch filter (data-entity STATUS vs term `deleted_at`).
- The trade-off (REFACTOR-361 — soft-delete-then-restore corner case).
- The maintainer-extension contract: every new Term link table is a fourth-branch extension point on this method.
- The performance consequence (REFACTOR-385 — hot path on permission resolution).

Cross-link with ADR-CANDIDATE-058, -064, -068, -055.

**Severity rationale**: HIGH — load-bearing for Term lifecycle integrity. The guard is the SINGLE defence against dangling description mentions; a regression weakening any of the three branches would silently break the catalog vocabulary (operators would see `[[ns:term]]` raw text rendered in the UI after a Term-delete-with-mentions-still-existing). Compatible-change calculus for any future Term-related feature (lookup-table terms, query-example terms, glossary-term hierarchy) requires understanding this ADR.

---

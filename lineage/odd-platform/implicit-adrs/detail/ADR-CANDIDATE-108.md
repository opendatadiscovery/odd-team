## ADR-CANDIDATE-108 — Description-link flag (`is_description_link` boolean) on every term-link row — the PK `(parent_id, term_id, is_description_link)` allows manual and description-mention link rows to coexist; read collapses pair into description-link variant via `removeDuplicateNonDescriptionTerms`

**Classification**: promote
**Severity**: MEDIUM
**Pillars affected**: [P-06-data-glossary, P-07-active-platform-features]
**Support**: surfaced by 1 sidecar (`TermServiceImpl`) — primary-source; structural Glossary-link-shape decision
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__TermServiceImpl.md:implicit_adrs.[1]` (HIGH confidence) — "Description-mention rows are stored as `is_description_link=TRUE`; manual links are `is_description_link=FALSE`; the PK `(parent_id, term_id, is_description_link)` allows both to coexist as separate rows. The read-side `removeDuplicateNonDescriptionTerms` collapses the pair into one LinkedTerm at projection time, preferring the description variant. This is intentional — the description-mention flag is preserved so the activity feed and UI can distinguish 'this link was authored by a description edit' from 'this link was manually attached'."

**Decision statement**: Every row in the three Glossary link tables (`data_entity_to_term`, `dataset_field_to_term`, `term_to_term`) carries an `is_description_link` boolean flag. Manual links via `linkTermWithDataEntity` / `linkTermWithDatasetField` / `linkTermWithTerm` insert with `is_description_link=FALSE`; description-mention auto-links via `handleDataEntityDescriptionTerms` / `handleDatasetFieldDescriptionTerms` insert with `is_description_link=TRUE`. The PK `(parent_id, term_id, is_description_link)` permits both rows for the same (parent, term) pair to exist simultaneously. At read time, `removeDuplicateNonDescriptionTerms` (`TermServiceImpl.java:444-448`) groupBy/reduces to a single `LinkedTermDto` per term, preferring the description-link variant when both exist. The architectural posture: preserve the AUTHORSHIP provenance of every link (manual vs description-derived) so the activity feed and UI can distinguish them, but project to a single user-visible link per term at read time so the UI is not surprised by duplicates.

**Wisdom test**: PASS. (1) Deliberate (the PK shape includes the boolean — the maintainer could have used `(parent_id, term_id)` only and had insert/update semantics; the choice to make the boolean part of the PK enables coexistence); (2) Structural impact (every link-table mutation must consider both rows; the read-time collapse is a load-bearing invariant for UI consistency); (3) Changing the shape (collapse the PK to `(parent_id, term_id)`) would be a STRUCTURAL change requiring data-migration + consumer updates.

**Evidence**:
- TermServiceImpl.md says: "`return terms.groupBy(dto -> dto.term().getTerm().getId()).flatMap(group -> group.reduce((dto1, dto2) -> dto1.isDescriptionLink() ? dto1 : dto2));`" (`TermServiceImpl.java:445-447`)
- TermServiceImpl.md says: "the `IS_DESCRIPTION_LINK` column wiring across `buildDataEntityDescriptionTermRelations` (line 481-489), `buildDatasetFieldDescriptionTermRelations` (line 491-499), `buildTermDescriptionTermRelations` (line 524-532)"

**Existing ADR**: none. Composes with **ADR-CANDIDATE-107** (NEW — term natural key case-insensitive) — the case-insensitive identity is the parent for both link variants. Composes with **ADR-CANDIDATE-109** (NEW — description-mention guard on rename/delete) — the guard exists BECAUSE description-link rows store the `(ns, name)` mention text, not a term-id reference.

**Cross-link gaps**:
- The live `data-glossary/business-glossary` doc does NOT name the `is_description_link` flag distinction at the conceptual level — a DOC-NNN follow-up is captured in the sidecar's doc_drift_findings (DOC-NNN, LOW — read-side collapse behaviour).

**Proposed action**: Promote to `adrs/drafts/term-link-description-flag.md` (new ADR). Document the dual-row-coexistence + read-time-collapse explicitly with the operator-facing consequence (manual + description-mention can coexist; the UI shows one row per term). Cross-link with ADR-CANDIDATE-107, ADR-CANDIDATE-109.

**Severity rationale**: MEDIUM — Glossary link-shape architecture decision; affects activity-feed semantics, UI rendering, and the description-mention auto-link reconciliation algorithm.

---

# ADR-CANDIDATE-064 / ADR-CANDIDATE-108 — Description-link flag (`is_description_link` boolean) on every term-link row — PK includes the flag so manual and description-mention rows coexist independently for the same `(parent, term)` pair

## STRENGTHENS — batch ZG (2026-05-25 — DatasetFieldController column-level surface confirms the convention)

The description-link coexistence convention surfaces at the COLUMN-LEVEL term-link surface, confirming the cross-platform symmetry with the entity-level surface.

**New surfaced_by entries**:

- `odd-platform__java__DatasetFieldController__controller-class__DatasetFieldController.md:implicit_adrs.[7]` (HIGH) — "**Delete-term excludes description-links (`IS_DESCRIPTION_LINK.isFalse()`) — description-mention term-links are owned by the description text, not by the explicit term-link surface.**" — intent_anchor: "Line 179: `.and(DATASET_FIELD_TO_TERM.IS_DESCRIPTION_LINK.isFalse())`. The WHERE clause filters DELETE to ONLY manual-link rows. The design intent is clear: description-link lifecycle is owned by the description's text content (the marker syntax in the body), not by the term-management surface. Operators using DELETE expect 'remove this term from the list'; the implementation enforces 'remove this term's MANUAL link, leave description-derived links alone'. No comment defends the choice but the same pattern appears at the data-entity sibling (`DATA_ENTITY_TO_TERM.IS_DESCRIPTION_LINK` filtering at TermRelationsRepositoryImpl.java:86-106) — convention applied across the term-linkage subsystem."

- `odd-platform__java__DatasetFieldController__controller-class__DatasetFieldController.md:implicit_adrs.[6]` (MEDIUM) — "**Add-term idempotency via `onDuplicateKeyIgnore` — duplicates return 200 with empty body, never 409 Conflict.**" — intent_anchor: "Line 113: `.onDuplicateKeyIgnore()`. The repository emits a JOOQ insert with the JOOQ-level duplicate-handler that silently swallows duplicates. The semantic implication is that the API treats add-term as set-membership-assertion, not as creation."

**Cross-batch refinement**:

The convention is now confirmed at BOTH term-link surfaces:
- **Entity-level** (ADR-064 / ADR-108 original anchor) — `DATA_ENTITY_TO_TERM.IS_DESCRIPTION_LINK` filtering at `TermRelationsRepositoryImpl.java:86-106`. The entity-level surface is the original ADR's source.
- **Column-level** (NEW this batch) — `DATASET_FIELD_TO_TERM.IS_DESCRIPTION_LINK` filtering at `TermRelationsRepositoryImpl.java:175-183`. Identical pattern at a different granularity.

The convention is therefore the LINKAGE-SUBSYSTEM PRIMITIVE — every term-link table in the platform carries an `is_description_link` flag in its PK, and every DELETE filters on `is_description_link.isFalse()`. The architectural intent: description text owns its own term-link lifecycle (managed by re-extraction in the description-edit chain — see ADR-CANDIDATE-225 NEW); the explicit term-link surface manages ONLY the manual-add/manual-remove lifecycle. The two lifecycles are coexisting but disjoint.

The cross-platform symmetry is the design-coherence anchor:

| Surface | Table | PK shape | DELETE filter |
|---|---|---|---|
| Entity-level | `data_entity_to_term` | `(data_entity_id, term_id, is_description_link)` | `is_description_link.isFalse()` |
| Column-level | `dataset_field_to_term` | `(dataset_field_id, term_id, is_description_link)` | `is_description_link.isFalse()` |

A future maintainer adding a third term-link surface (e.g., business-glossary-to-term or namespace-to-term) is expected to follow the same pattern.

**Composite-mutation interaction**:

The convention COMPOSES with ADR-CANDIDATE-225 NEW (description-edit dual activity-event emission) — the dual-event chain re-extracts term mentions from the new description text and produces / removes `is_description_link=true` rows; the explicit-add `POST /terms` produces `is_description_link=false` rows. The two row classes coexist; the DELETE filter ensures explicit-remove DOESN'T cascade to description-link rows. The user-visible consequence: a term linked via BOTH paths has TWO rows; DELETE removes only the manual row; the description-link row survives until the user edits the description to remove the marker (gap-side: REFACTOR-664 NEW captures the operator-surprise: "I deleted the term but it's still showing").

**Co-surfaced gaps**:
- **REFACTOR-664 NEW** — deleteTermFromDatasetField removes ONLY manual links; description-link rows survive. Operator-surprise: "deletion succeeded but term is still there".

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-225 NEW (the dual-event chain re-extracts term mentions; this ADR's `is_description_link=true` rows are what the re-extraction creates/removes).
- SUPERSEDES: none.
- CONFLICTS: none. The convention is consistent across both surfaces.

---

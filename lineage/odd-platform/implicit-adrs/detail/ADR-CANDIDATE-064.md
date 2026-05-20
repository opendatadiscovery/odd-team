## ADR-CANDIDATE-064 — Manual term-link vs description-link COEXISTENCE — PK includes `is_description_link` so both row types persist independently for the same `(data_entity, term)` pair

**Severity**: MEDIUM
**Classification**: promote
**Support count**: 2 sidecars
**Axes present**: controllers, services, schema
**Surfaced by**:
- `addDataEntityTerm.md:implicit_adrs[3]` ("Manual link uses `is_description_link = FALSE` by default; description-link rows are managed separately by the description-parsing pipeline")
- `upsertDataEntityInternalDescription.md:implicit_adrs[1]` ("Glossary terms are auto-linked from description bodies via the `[[namespace:term]]` syntax — terms are not assigned separately from the description text, the description IS the term-assignment mechanism for inline references.")

**Decision statement**: The `data_entity_to_term` table's primary key is `(data_entity_id, term_id, is_description_link)` — a three-column composite that intentionally permits TWO rows for the same `(data_entity, term)` pair: one row with `is_description_link = FALSE` (manual link via `POST /api/dataentities/{id}/terms`), and one row with `is_description_link = TRUE` (auto-link from `[[ns:term]]` mentions in the description). The two channels coexist as separate rows. `removeTermFromDataEntity` filters `IS_DESCRIPTION_LINK.isFalse()` so description-link rows are NOT deletable via the manual-link DELETE endpoint; description-link rows lifecycle is governed by the description-parsing pipeline. The architectural decision: keep description-driven term inference structurally orthogonal to operator-driven explicit assignment.

**Evidence**:
- `addDataEntityTerm.md` says: "the PK `(data_entity_id, term_id, is_description_link)` allows BOTH a manual link AND a description-link mention of the same (data-entity, term) pair to coexist as separate rows" (`V0_0_77__data_entity_term_description.sql:13-14`)
- `addDataEntityTerm.md` says: `removeTermFromDataEntity` filter `IS_DESCRIPTION_LINK.isFalse()` (`TermRelationsRepositoryImpl.java:84`)
- `upsertDataEntityInternalDescription.md` says: "the regex `\\[\\[([^:]*?):([^\\]]*?)\\]\\]` is a stable class-level constant, encoding the syntax as part of the platform's contract with description authors"

**Rationale (wisdom test 3-question)**:
1. *Intentional?* YES — migration `V0_0_77` explicitly adds `is_description_link` to the PK; the `removeTermFromDataEntity` filter for `isFalse()` is explicit defensive code; the term-linker regex is a class-level constant.
2. *Structural impact?* YES — affects the schema, the API surface (two channels), the delete semantics, and the audit-feed shape.
3. *Refactoring or structural?* STRUCTURAL — collapsing the two channels into one would require schema migration + reconciliation of orphaned rows.
→ ADR-CANDIDATE.

**Existing ADR**: none.

**Proposed action**: Promote to `adrs/drafts/term-linkage-two-channel-model.md`. The ADR should document the PK design, the regex syntax (`[[namespace:term]]`) as part of the description contract, and the deletion-channel separation.

**Severity rationale**: MEDIUM — pattern-shaping schema decision with operator-visible UX consequences (a description-mentioned term cannot be unlinked via the Terms panel; the user must edit the description). Worth documenting so operators understand the dual-channel model.

---

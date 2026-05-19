## REFACTOR-361 — `hasDescriptionRelations` returns FALSE for Terms mentioned only in soft-deleted entities — restore-soft-deleted-entity creates dangling `[[ns:term]]` references after Term rename-or-delete; undocumented operator-visible inconsistency surface

**Severity**: MEDIUM
**Category**: corner-case (soft-delete-then-restore interaction with Term lifecycle invariant)
**Surfaced by**:
- `ReactiveTermRepositoryImpl.md:bugs_limitations_corner_cases[1]` (PRIMARY-SOURCE)
- `ReactiveTermRepositoryImpl.md:security.known_security_gaps[1]`

**Description**: `ReactiveTermRepositoryImpl.hasDescriptionRelations` (lines 409-438) is the SINGLE point of enforcement for the Term-rename / Term-delete protection invariant (per ADR-CANDIDATE-124 NEW). The data-entity and dataset-field branches filter `DATA_ENTITY.STATUS != DELETED.getId()` (lines 415, 425). The intent (per ADR-CANDIDATE-124): allow operators to clean up the catalog after a wave of entity deletions — soft-deleted entities' description references are NOT counted, so the orphaned Terms can be deleted.

**The corner case**: a Term mentioned ONLY in a soft-deleted data-entity's description (or in the description of a dataset-field belonging to a soft-deleted data-entity) is treated as 'not mentioned'. `hasDescriptionRelations` returns FALSE; `TermServiceImpl.updateTerm` / `TermServiceImpl.delete` succeeds; the Term is renamed-or-deleted.

When the data-entity is LATER restored (per ADR-CANDIDATE-055 NEW — soft-delete-is-a-state; restore is `PUT /api/dataentities/{id}/status → ACTIVE`):
- If the Term was RENAMED: the description's `[[ns:term]]` text still references the OLD Term name; the auto-link resolver `TermServiceImpl.findTermsInDescription` finds no match and emits `markUnhandledTerm`. The description's mention silently downgrades to 'unhandled' on the next description-edit.
- If the Term was DELETED: same as above. The description's `[[ns:term]]` text is now an unresolvable reference.

**The operator-visible inconsistency**: a soft-deleted-then-restored entity loses its description's term-link semantic without any visible signal to the operator. The entity-restore feature documented at the data-entity-soft-delete-by-id-read ADR (per ADR-CANDIDATE-055) does NOT cross-document this interaction with Term lifecycle. The corner case is real but the operator's mental model says "I restored the entity; everything is back to normal".

**Primary source citations**:
- `ReactiveTermRepositoryImpl.java:415, 425` — the `STATUS.ne(DELETED.getId())` filter
- `ReactiveTermRepositoryImpl.java:427-433` — the term-to-term branch with different semantic (`target.DELETED_AT.isNull()`)
- `TermServiceImpl.java:125-145, 154-165` — the service-tier consumers
- Cross-batch: ADR-CANDIDATE-124 NEW + ADR-CANDIDATE-055 + ADR-CANDIDATE-058

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-124 NEW (hasDescriptionRelations single-point-of-enforcement) DOCUMENTS this corner case as the deliberate trade-off — the architecture accepts the risk in exchange for the cleanup UX. This scope is the operator-documentation gap, NOT a defect.

**Proposed remedy**: Three options:
1. **Doc-side remedy** — add a paragraph to `documentation/docs/features/data-discovery/` and `documentation/docs/features/data-glossary.md` explaining the interaction between Term lifecycle and entity-restore. Operator-visible disclosure of the corner case.
2. **Restore-side hook** — `DataEntityInternalStateServiceImpl.applyStatus` (the restore path) detects when the restored entity's description contains `[[ns:term]]` mentions and re-resolves them; emits warnings via the activity feed for unresolvable references. Requires the restore path to know the description's text — already true, no schema change.
3. **Strict guard** — change `hasDescriptionRelations`'s data-entity branches to drop the `STATUS != DELETED` filter; a Term mentioned in a soft-deleted entity's description blocks rename / delete. UX trade-off: operators can no longer clean up the catalog after entity deletions; this contradicts the architectural intent per ADR-CANDIDATE-124.

Option 1 is the smallest blast radius and surfaces the corner case. Option 2 adds operator-visible feedback. Option 3 inverts the architectural choice.

**Severity rationale**: MEDIUM — corner case with operator-visible inconsistency. The fire scenario requires: (a) entity soft-deleted with description containing term mention, (b) Term renamed-or-deleted while entity is soft-deleted, (c) entity restored, (d) operator edits description. Low frequency, real impact. The Glossary feature page should at minimum disclose this interaction.

**Suggested backlog grouping**: `DOC-NNN feature-interaction-disclosure` — Term lifecycle ↔ data-entity-restore interaction. Pair with the operator-docs for ADR-CANDIDATE-055 (soft-delete by-id read with isStale flag).

---

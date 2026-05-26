## REFACTOR-664 — DatasetFieldController's `deleteTermFromDatasetField` removes only MANUAL term-links (`IS_DESCRIPTION_LINK.isFalse()` filter at `TermRelationsRepositoryImpl.java:179`); a term linked via BOTH the `[[ns/name]]` description marker AND the explicit POST /terms has TWO rows; DELETE returns 204 but the description-link row survives → term remains visible in the linked-terms tab

**Severity**: HIGH
**Category**: cascade-incomplete operator-surprise
**Batch**: ZG (2026-05-25)
**Pillars affected**: [P-06 Business Glossary (term-linkage), P-01 Data Discovery (column-level surface), P-11 Platform API (operator-facing contract clarity)]

**Surfaced by**:
- `odd-platform__java__DatasetFieldController__controller-class__DatasetFieldController.md:bugs_limitations_corner_cases.[12]` (HIGH) — "**`deleteTermFromDatasetField` removes only MANUAL term-links.** The repository DELETE filters on `IS_DESCRIPTION_LINK.isFalse()` (`TermRelationsRepositoryImpl.java:179`). A term linked via BOTH the `[[namespace/name]]` marker in the description AND the explicit POST /terms has TWO `dataset_field_to_term` rows; DELETE returns 204 No Content but only deletes the manual row. The term remains visible in the linked-terms tab (because the description-link row survives). Remedy: edit the description body and remove the marker. The endpoint description ('Delete term from current dataset field terms list') does not warn about this."

**Statement**: `DELETE /api/datasetfields/{id}/terms/{term_id}` is supposed to remove a term-link from a dataset field. The repository SQL filters DELETE to only `is_description_link = false` rows:

```sql
-- TermRelationsRepositoryImpl.java:175-183
DELETE FROM dataset_field_to_term
WHERE dataset_field_id = :fieldId
  AND term_id = :termId
  AND is_description_link = false
  -- ↑ HERE: only deletes MANUAL-link rows
```

The architectural intent (ADR-CANDIDATE-064 / -108) is the DESCRIPTION-LINK COEXISTENCE convention: description-link rows are owned by the description text; the explicit term-link surface manages only manual-add/manual-remove. The two lifecycles are coexisting but disjoint.

The operator-visible failure mode: a term linked via BOTH the `[[namespace/name]]` marker in the description body AND the explicit POST /terms call has TWO `dataset_field_to_term` rows:
- Row 1: `is_description_link=false` (manual link)
- Row 2: `is_description_link=true` (description marker)

DELETE returns HTTP 204 No Content (success) but removes only Row 1. Row 2 survives. The term REMAINS visible in the field's linked-terms tab because the UI reads ALL `dataset_field_to_term` rows regardless of `is_description_link` value.

The operator's mental model: "I deleted the term, it should be gone." The actual behaviour: "the manual delete succeeded; the description-marker delete is a SEPARATE action you need to take by editing the description body."

The endpoint description (`https://docs.opendatadiscovery.org/developer-guides/api-reference/...`) reads "Delete term from current dataset field terms list" — does NOT warn about the partial-cascade behaviour.

The fix-anchor (the cascading description-marker source) is the description body itself; the operator must:
1. Identify which description (the field's `internal_description`) contains the `[[ns/name]]` marker referencing this term
2. Edit the description to remove the marker
3. The description-edit chain (per ADR-CANDIDATE-225 NEW) re-extracts terms and removes the now-orphaned description-link row

This 2-step remediation is not signposted anywhere.

**Evidence**:
- DELETE filter: `TermRelationsRepositoryImpl.java:175-183`
- Read path (no filter): UI reads all `dataset_field_to_term` rows regardless of is_description_link
- ADR-CANDIDATE-064 / -108 captures the description-link coexistence intent
- ADR-CANDIDATE-225 NEW captures the description-edit dual-event chain (the remediation path)
- Hypothesis: `lineage/odd-platform/probes/P-155.yaml`

**Existing-ADR-or-implied-prescription**: **ADR-CANDIDATE-064 / -108** captures the architectural intent (description-link coexistence is deliberate). THIS REFACTOR captures the operator-facing cascade-incomplete consequence: the endpoint NAME and the docs do not warn about the partial cascade.

**Proposed remedy**:
- **Option A (response enrichment)**: when the DELETE finds a description-link row that survives, return HTTP 200 with a response body explaining "the term has a description-link row that survives; edit the description to fully remove". (Currently returns 204 No Content.)
- **Option B (cascade-DELETE option)**: add a `?cascade=true` query parameter; when set, also DELETE description-link rows AND emit a follow-up to edit the description (or hard-delete the description-link row and let the next description-edit recompute). Operator-explicit cascade.
- **Option C (doc-side fix)**: surface the partial-cascade behaviour in the live developer-guide page; explain the 2-step remediation; cross-link the description-edit endpoint as the description-link removal path.
- **Option D (endpoint rename)**: rename to `deleteManualTermFromDatasetField` or similar — explicit about what's deleted.

Option A is the smallest change improving operator clarity at the response surface; Option C is the smallest doc-side fix.

**Severity rationale**: HIGH — operator surprise "deletion succeeded but the term is still there"; affects every term-linked-via-both-paths case; the architectural intent is sound but the wire contract has no signal.

**Suggested backlog grouping**: `Term linkage UX sprint` (paired with REFACTOR-227 — description-update side-effect bypasses `DATA_ENTITY_ADD_TERM` permission via `[[ns:term]]` injection — the same description-marker mechanism on a different surface).

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-064 / -108 (description-link coexistence — the architectural intent); ADR-CANDIDATE-225 NEW (the description-edit dual-event chain — the remediation path); REFACTOR-227 (the description-marker mechanism as a permission-bypass on the entity surface — the same mechanism's gap on a different axis).
- SUPERSEDES: none.
- CONFLICTS: none.

---

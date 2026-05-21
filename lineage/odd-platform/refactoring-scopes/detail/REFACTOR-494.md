## REFACTOR-494 — Empty `tag_name_list` / `tags: []` silently clears ALL tag relations for a term or dataset field — no `minItems` guard, no separate DELETE endpoint, no warning in the spec

**Severity**: MEDIUM
**Category**: destructive-default
**Batch**: X-TAGGING
**Related pillar features**: P-06 (Data Glossary — term tags), P-01:F-006 (Manual Object Tagging — dataset-field tags)
**related_features**: [F-018]

**Surfaced by**:
- `odd-platform__java__TermController__controller-method__createTermTagsRelations.md:bugs_limitations_corner_cases[1]` ("Empty `tag_name_list` silently clears ALL term tags.")
- `odd-platform__java__DatasetFieldController__controller-method__updateDatasetFieldTags.md:bugs_limitations_corner_cases[2]` ("`tags: []` clears all internal dataset-field tags, undiscoverably from the spec.")

**Statement**: The term-tag and dataset-field-tag write paths are replace-all (delete-then-recreate). An empty array `[]` is a valid request body — `TagsFormData` declares `tag_name_list` REQUIRED but with no `minItems` (`components.yaml:2219-2220`); `DatasetFieldTagsUpdateFormData` has NO `required` block at all (`components.yaml:1827-1833`). For the term path, `PUT /api/terms/{term_id}/tags` with `{"tag_name_list": []}` flows through `new HashSet<>(emptyList)` and `deleteRelationsWithTerm(termId, emptySet)` computes `idsToDelete = currentTags where name NOT IN {}` — i.e. EVERY current tag (`TagServiceImpl.java:129-131`). For the dataset-field path, `tags: []` triggers `markEntityUnfilledByDatasetFieldId` and deletes every `origin='INTERNAL'` relation. There is no separate DELETE endpoint and no empty-list guard. **A buggy third-party client that forgets to populate the array silently wipes a term's or dataset field's entire tag set** — and (per REFACTOR-491) the wipe is not even recorded in the activity feed for the term path. Probe P-027 pins the term-path empty-list-clears-all behaviour.

**Evidence**: `components.yaml:2219-2220` (`tag_name_list` required, no `minItems`) + `components.yaml:1827-1833` (`DatasetFieldTagsUpdateFormData` has no `required` block) + `TermServiceImpl.java:255` (`new HashSet<>(getTagNameList())`) + `TagServiceImpl.java:129-131` (`filter(l -> !tagsToKeep.contains(l.getName()))` — empty `tagsToKeep` selects all) + `DatasetFieldServiceImpl.java:123, 253-262` (the empty-list branch) + `lineage/odd-platform/probes/P-027.yaml`.

**Why this is a gap, not an ADR (wisdom test)**:
1. *Intentional?* PARTIALLY — the replace-all semantic IS deliberate (it is HOW tag removal works; there is no separate DELETE endpoint by design). But the empty-list-as-clear-all behaviour is an UNGUARDED CORNER of that design, not a deliberate "submitting [] is the documented way to clear all tags" feature. Neither the OpenAPI description nor the Permissions doc states that `[]` clears all tags; a caller has no warning from the API surface. The replace-all design is an ADR-shaped decision (see ADR-CANDIDATE-205 / the per-entity replace-all semantics); the unguarded empty-list corner is the gap.
2. *Structural impact?* NO — the fix is a `minItems` constraint OR an explicit empty-list guard OR documented confirmation; the replace-all structure is unchanged.
3. *Refactoring or structural?* REFACTORING — add a guard / `minItems` / spec documentation; the replace-all design stays.
→ refactoring scope.

**Existing-ADR-or-implied-prescription**: the replace-all semantic itself is intentional (no governing ADR yet, but it is the deliberate design — there is no separate DELETE endpoint). REFACTOR-226 (create-vs-replace naming drift) is the related contract-clarity gap. The implied prescription is destructive-action-confirmation best practice: a write that can silently delete everything should either reject the all-clearing input, require an explicit confirmation, or at minimum document the behaviour. NOTE: do NOT "fix" this by making empty-list a no-op — that would break the legitimate "remove the last tag" flow; the right fix is documentation + (optionally) a UI-side confirmation, OR accept-and-document.

**Proposed remedy**: Two layers. (1) **Spec + docs** — document explicitly in the OpenAPI description for both operations that the body is an EXHAUSTIVE replace-all set and that an empty array removes ALL (internal) tag relations; this is the cheapest, highest-value fix and pairs with REFACTOR-226's contract-clarity remedy. (2) **Optional guard** — if the maintainer wants a safety rail, the API could require an explicit query param or a distinct endpoint for the clear-all case; this is a UX call, not mandatory. Add an integration test (promote probe P-027) asserting `[]` clears all relations AND that the behaviour is the documented contract.

**Severity rationale**: MEDIUM — a silently-destructive corner of a write endpoint. A third-party client bug (an unpopulated array, a serialisation default) wipes a term's or dataset field's entire tag set with no warning and (for the term path) no audit trail. Filed MEDIUM not HIGH because the replace-all design is legitimate and the fix is primarily documentation — but the "silent + destructive + unattributed (term path)" combination is the LSN-001-adjacent class.

**Suggested backlog grouping**: "Tag mutation hardening" sprint + DOC-NNN OpenAPI contract-hardening sprint — pair the spec-documentation remedy with REFACTOR-226 (the create-vs-replace naming drift) since both are the same "replace-all is undisclosed at the API surface" problem.

---

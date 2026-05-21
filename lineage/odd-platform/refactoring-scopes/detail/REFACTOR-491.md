## REFACTOR-491 — No `@ActivityLog` on tag-directory mutations (createTag / updateTag / deleteTag) or the term-tag write path — directory vocabulary changes are not attributable to a user or a time via the Activity Feed

**Severity**: MEDIUM
**Category**: missing-audit
**Batch**: X-TAGGING
**Related pillar features**: P-01:F-006 (Manual Object Tagging), P-06 (Data Glossary — term-tag changes), P-08 (Management & Administration — Tags tab), P-09 (Security & Access Control — audit trail)
**related_features**: [F-018]

**Surfaced by**:
- `odd-platform__java__TagController__controller-method__createTag.md:bugs_limitations_corner_cases[6]` ("No audit log on `createTag`.")
- `odd-platform__java__TagController__controller-method__updateTag.md:bugs_limitations_corner_cases[4]` ("No audit-log entry on `updateTag`.")
- `odd-platform__java__TermController__controller-method__createTermTagsRelations.md:bugs_limitations_corner_cases[3]` ("No activity-feed audit for term-tag changes.")
- cross-confirm: `feature-flows/index.yaml` F-018 facet `tag_controller_write_paths_no_activity_log_asymmetric_with_per_entity_tag_assignment_path`

**Statement**: The tag-directory VOCABULARY mutation paths produce NO Activity Feed entry. `createTag` / `TagServiceImpl.bulkCreate`, `updateTag` / `TagServiceImpl.update`, and `deleteTag` / `TagServiceImpl.delete` carry NO `@ActivityLog` annotation; `TermController.createTermTagsRelations` / `TermServiceImpl.upsertTags` carry none either. A new tag appearing in the global directory, a tag rename (which propagates into FTS vectors across every carrying entity), a tag deletion, and a term's tag-set change are all INVISIBLE to the activity feed — there is no record of who did it or when. This is an **asymmetry within the codebase**: `@ActivityLog(event = TAG_ASSIGNMENT_UPDATED)` exists at `DataEntityServiceImpl.java:358` for the per-entity tag-ASSIGNMENT path; `DatasetFieldServiceImpl.updateDatasetFieldTags` carries `@ActivityLog(event = DATASET_FIELD_TAGS_UPDATED)` (`:119`); other term mutations on the SAME `TermServiceImpl` (`linkTermWithDataEntity` `:169`, `removeTermFromDataEntity` `:183`) carry `@ActivityLog(event = TERM_ASSIGNMENT_UPDATED)`. The tag-directory-vocabulary path and the term-tag path are the audit holes — the per-entity tag-assignment paths and the dataset-field tag path ARE audited.

**Evidence**: `TagController.java:22-28` + `TagServiceImpl.java:37-42` (no `@ActivityLog` on createTag/bulkCreate) + `TagController.java:46-52` + `TagServiceImpl.java:44-55` (no `@ActivityLog` on updateTag/update) + `TagServiceImpl.java:57-70` (no `@ActivityLog` on delete) + `TermController.java:129-136` + `TermServiceImpl.java:252-264` (no `@ActivityLog` on upsertTags) + `DataEntityServiceImpl.java:358` + `DatasetFieldServiceImpl.java:119` + `TermServiceImpl.java:169, 183` (the audited siblings — the asymmetry).

**Why this is a gap, not an ADR (wisdom test)**:
1. *Intentional?* NO. The codebase audits the per-entity tag-assignment paths AND the dataset-field tag path AND the term-link paths via `@ActivityLog` — but not the tag-directory-vocabulary path or the term-tag path. No comment, doc, or ADR defends "directory-vocabulary changes are deliberately not audited". The asymmetry within `TermServiceImpl` itself (`upsertTags` unaudited, `linkTermWithDataEntity`/`removeTermFromDataEntity` audited) is the smoking gun — most likely an oversight per the `createTermTagsRelations` sidecar's own assessment ("most likely an oversight rather than intent — no comment, exception, or convention defends the absence").
2. *Structural impact?* NO — the fix is to add `@ActivityLog` annotations + the corresponding activity-event enum members + handlers, matching the existing audited paths; the activity-feed infrastructure already exists.
3. *Refactoring or structural?* REFACTORING — add the missing annotations + event types within the existing `@ActivityLog` AOP infrastructure.
→ refactoring scope.

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-060 (programmatic activity-event emission for bulk mutations that don't fit the single-resource `@ActivityLog` AOP shape) is relevant — `createTag` is bulk, so its audit path may need the programmatic-emission pattern rather than the AOP annotation; `updateTag` / `deleteTag` are single-resource and fit the AOP `@ActivityLog` shape directly. There is no ADR that PRESCRIBES auditing the directory-vocabulary path, but the codebase-wide pattern (every other tag-touching mutation is audited) is the implied prescription. ADR-CANDIDATE-069 (edge-tables-hard-delete) explicitly relies on the activity feed as the reconstruction substitute for hard-deleted edges — that ADR's reconstruction guarantee is WEAKER for tag relations because the directory-vocabulary side of the tag lifecycle is not audited.

**Proposed remedy**: Add activity-event emission to the four unaudited paths: `@ActivityLog(event = TAG_CREATED)` / `TAG_UPDATED` / `TAG_DELETED` on `TagServiceImpl.update` + `delete` (single-resource — AOP fits); programmatic emission (per ADR-CANDIDATE-060) for `bulkCreate` (the bulk shape); `@ActivityLog(event = TERM_TAGS_UPDATED)` on `TermServiceImpl.upsertTags`. Define the corresponding `ActivityEventTypeDto` members + handlers, mirroring `TAG_ASSIGNMENT_UPDATED` / `DATASET_FIELD_TAGS_UPDATED`. Add a test asserting each tag-directory + term-tag mutation produces exactly one activity row with the correct before/after state.

**Severity rationale**: MEDIUM — an operability + compliance gap. A malicious or mistaken rename/delete of a widely-used tag (which propagates into FTS vectors across thousands of entities) is untraceable; an operator auditing "who changed this tag?" finds no record. Not data-destructive in itself, but it is the canonical "we made the change but nobody can see who" failure mode, and it weakens ADR-CANDIDATE-069's audit-trail-as-reconstruction guarantee for the tag lifecycle.

**Suggested backlog grouping**: SEC-NNN / compliance audit-logging batch — pair with REFACTOR-188 (no audit logging on RBAC mutations) and REFACTOR-097-family (codebase-wide audit-logging gaps). The term-tag path's audit hole is cross-pillar (P-06 Glossary).

---

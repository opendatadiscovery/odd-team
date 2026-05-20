## REFACTOR-440 — `dataset_field.updateDescription` NOT activity-logged (asymmetric with `updateInternalName` + `updateDatasetFieldTags`)

**Severity**: MEDIUM
**Category**: audit-coverage-gap / inconsistent-annotation
**Batch**: R (2026-05-20)
**Pillars affected**: [P-01-data-discovery, P-07-active-platform-features (Activity Feed)]

**Surfaced by**:
- `ReactiveDatasetFieldRepositoryImpl.md:bugs_limitations_corner_cases.[1]` (MEDIUM): "`updateDescription` on a dataset_field has NO @ActivityLog annotation — description edits are NOT recorded in the activity feed, while `updateInternalName` (line 99) and `updateDatasetFieldTags` (line 119) DO emit activity events. Operators auditing a description change on a column will find no activity-feed evidence."
- `ReactiveDatasetFieldRepositoryImpl.md:concepts.invariants.[9]` (HIGH): "`updateDescription` / `updateInternalName` are NOT @ActivityLog-annotated at the repository layer (lines 72-90) — activity-log emission happens one layer up at `DatasetFieldServiceImpl.updateInternalName` (line 98-99) via `@ActivityLog(event = ActivityEventTypeDto.DATASET_FIELD_INTERNAL_NAME_UPDATED)`. `updateDescription` at the service layer (line 86-95) has NO `@ActivityLog`."
- `ReactiveDatasetFieldRepositoryImpl.md:docs_link_semantic.doc_drift_findings.[2]`: "Live docs do not describe that `updateDescription` on a dataset_field does NOT emit an activity-feed event (no `@ActivityLog` annotation on `DatasetFieldServiceImpl.updateDescription` line 87) while `updateInternalName` and `updateDatasetFieldTags` DO (lines 99, 119). The asymmetry is invisible at the doc surface."
- `ReactiveDatasetFieldRepositoryImpl.md:coherence_with_prior.conflicts_surfaced.[0]`: "system-mission.md P-07 sub-feature 'Activity Feed (global page + per-entity tab)' implicitly claims activity events for all curated metadata edits. The asymmetry on this surface — `updateDescription` is NOT logged while `updateInternalName` and `updateDatasetFieldTags` ARE (bugs_limitations_corner_cases entry 1) — surfaces a hidden gap in the Activity Feed's coverage promise."

**Statement**: `DatasetFieldServiceImpl.updateDescription` lines 87-95 carries NO `@ActivityLog` annotation, while `DatasetFieldServiceImpl.updateInternalName` line 99 carries `@ActivityLog(event = ActivityEventTypeDto.DATASET_FIELD_INTERNAL_NAME_UPDATED)` and `updateDatasetFieldTags` line 119 carries `@ActivityLog(event = ActivityEventTypeDto.DATASET_FIELD_TAGS_UPDATED)`. The asymmetry is silent at the doc surface; the Activity Feed audit-coverage promise is implicitly broken on the description-edit surface.

**Operator-side consequences**:
- An operator-edit to a dataset_field's INTERNAL_DESCRIPTION via `PUT /api/datasetfields/{id}/description` is INVISIBLE to the Activity Feed
- The forward-copy mechanism (ADR-CANDIDATE-148) propagates the description across schema-version forks — but the propagation is also invisible to the audit log
- A reviewer investigating "who changed this column's description last week" has no Activity-Feed evidence; the only available trace is the database row's `updated_at` (which doesn't carry `updated_by` on dataset_field — the dataset_field table has no audit columns of its own)
- Per the F-006 family refinement at batch F: the dataset-entity tier IS audited (`DATA_ENTITY_DESCRIPTION_UPDATED` exists); but the dataset_field sub-tier description is NOT audited — the asymmetry is INSIDE the data-entity-metadata audit coverage

The system-mission.md P-07 sub-feature "Activity Feed (global page + per-entity tab)" implicitly claims activity events for all curated metadata edits. The asymmetry on this surface surfaces a hidden gap in the Activity Feed's coverage promise.

**Evidence**:
- `DatasetFieldServiceImpl.java:87-95` — `updateDescription` method body, NO `@ActivityLog`
- `DatasetFieldServiceImpl.java:98-99` — `updateInternalName` method body, WITH `@ActivityLog(event = ActivityEventTypeDto.DATASET_FIELD_INTERNAL_NAME_UPDATED)`
- `DatasetFieldServiceImpl.java:115-119` — `updateDatasetFieldTags` method body, WITH `@ActivityLog(event = ActivityEventTypeDto.DATASET_FIELD_TAGS_UPDATED)`
- `ActivityEventTypeDto.java:3-31` — enum has `DATASET_FIELD_INTERNAL_NAME_UPDATED` + `DATASET_FIELD_TAGS_UPDATED` + `DATASET_FIELD_VALUES_UPDATED` but NO `DATASET_FIELD_DESCRIPTION_UPDATED`
- `DatasetFieldInformationUpdatedActivityHandler.java:22-69` — handles only the existing event types; does not handle a (yet-to-be-added) description event

**Existing-ADR-or-implied-prescription**: Cross-references the F-006 family audit-log-presence-asymmetry; this is a sub-finding within the data-entity-mutation audit tier (which DOES emit events per batch F REFACTOR-188 refinement). The asymmetry is at a different level — WITHIN the dataset_field-edit family, three of four methods log and one does not. ADR-CANDIDATE-146 (audit table schema-rooted) confirms the audit subsystem's STRUCTURAL scope; this gap is annotation-level, not schema-level.

**Proposed remedy**:
1. Add `DATASET_FIELD_DESCRIPTION_UPDATED` value to `ActivityEventTypeDto.java`
2. Annotate `DatasetFieldServiceImpl.updateDescription` line 87 with `@ActivityLog(event = ActivityEventTypeDto.DATASET_FIELD_DESCRIPTION_UPDATED)`
3. Add the new event type to `DatasetFieldInformationUpdatedActivityHandler` (lines 22-69) to assemble the old-state / new-state JSON
4. Update the live-doc `features/active-platform-features/activity-feed` event-types enumeration (which today lists 20 event types organised in 6 groups; the dataset-field-internal-name and dataset-field-tags are already there; description is missing)
5. Verify other text-input surfaces for the same asymmetry: sweep for `update*Description` methods across the service layer (TermService, DataEntityService, QueryExampleService, etc.) and audit `@ActivityLog` coverage

**Severity rationale**: MEDIUM — single-event-type audit gap; operationally the operator cannot audit who changed a column's description and when; doc-site silent. The forward-copy mechanism (ADR-148) compounds — once the description is set and propagated across version forks, an operator looking at the per-entity activity-feed tab sees NO record of the original edit.

**Suggested backlog grouping**: "Activity Feed coverage audit" — together with the F-006 family + DOC-NNN follow-up for the description-edit asymmetry doc-coverage surface.

---

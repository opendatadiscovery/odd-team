## ADR-CANDIDATE-146 — STRENGTHENED BATCH V — Audit-pattern family scope-corrected; dataset-field surface has SYMMETRIC `@ActivityLog` coverage; F-006 audit-silence stays scoped to RBAC tier ONLY

**Severity unchanged**: HIGH
**Updated support count**: now **2 sidecars** (batch R ReactiveActivityRepositoryImpl primary source + batch V DatasetFieldController class-level scope correction)
**Batch**: V (2026-05-20)

**New surfaced_by**:
- `DatasetFieldController__controller-class__DatasetFieldController.md:implicit_adrs.[2]` (HIGH) — "**Activity-log emission lives at the service layer or one layer deeper at the inner-service layer — NEVER at the controller layer.**" — evidence: DatasetFieldServiceImpl.java:99 (internal-name) + :119 (tags) + DatasetFieldInternalInformationServiceImpl.java:28 (description) + TermServiceImpl.java:211, :225 (term-link/unlink) — intent_anchor: "The `@ActivityLog` annotation is consistently applied at the FIRST `@Service`-tier method that touches the writable state, never at the controller. The four mutation paths (description, internal-name, tags, term-link/unlink) all carry the annotation at the right structural depth."
- `DatasetFieldController__controller-class__DatasetFieldController.md:coherence_corrections` (HIGH) — the SCOPE CORRECTION (per LSN-018 Rule 6): "the dataset-field surface has SYMMETRIC activity-log coverage across description, internal-name, tags, term-link, term-unlink — F-006's audit-silence pattern is at the RBAC mutation surface (role/policy/owner-association), not at the dataset-field metadata surface"

**Cross-batch insight (SCOPE CORRECTION)**: Batch R's `ReactiveActivityRepositoryImpl` sidecar established that the audit table is STRUCTURALLY scoped to data-entity events via `activity.data_entity_id NOT NULL` FK (the schema-rooted commitment at V0_0_48__add_activity.sql:4,12). Batch V's `DatasetFieldController` adds a critical scope correction:

**The dataset-field tier of data-entity mutations DOES emit activity events for ALL five mutation paths.** The five emissions are:

1. `DATASET_FIELD_DESCRIPTION_UPDATED` — emitted at `DatasetFieldInternalInformationServiceImpl.java:28` (one layer DEEPER than the outer service)
2. `DATASET_FIELD_INTERNAL_NAME_UPDATED` — emitted at `DatasetFieldServiceImpl.java:99`
3. `DATASET_FIELD_TAGS_UPDATED` — emitted at `DatasetFieldServiceImpl.java:119`
4. `DATASET_FIELD_TERM_ASSIGNMENT_UPDATED` (link) — emitted at `TermServiceImpl.java:211`
5. `DATASET_FIELD_TERM_ASSIGNMENT_UPDATED` (unlink) — emitted at `TermServiceImpl.java:225`

The handler at `DatasetFieldInformationUpdatedActivityHandler.java:27-29` handles every emission. Live docs at `https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed#event-types` (verified 2026-05-20, status 200) enumerate FIVE dataset-field event types verbatim:
- `DATASET_FIELD_VALUES_UPDATED`
- `DATASET_FIELD_DESCRIPTION_UPDATED`
- `DATASET_FIELD_INTERNAL_NAME_UPDATED`
- `DATASET_FIELD_TAGS_UPDATED`
- `DATASET_FIELD_TERM_ASSIGNMENT_UPDATED`

The audit-asymmetry framing in F-006 + system-mission.md canonicalisation candidate `audit-log-presence-asymmetry-2-tier-audit-story` (lines 386-395) was OVERLY BROAD prior to batch V. The corrected framing:

- **POSITIVE half of the 2-tier audit story** — the data-entity-mutation surface has FULL audit coverage. Description / internal-name / tags / term-link / term-unlink at the data-entity tier AND at the dataset-field sub-tier ALL emit activity events. Per ADR-CANDIDATE-167 NEW batch V, the OwnerAssociationRequest workflow ALSO has full audit coverage via its dedicated table.

- **NEGATIVE half of the 2-tier audit story** — the RBAC-DIRECTORY-CRUD surface (Role create/update/delete, Policy create/update/delete, Owner directory create/update/delete) has NO `@ActivityLog` emission and the schema-rooted scope (per this ADR) PREVENTS the activity table from receiving these events. F-006's audit-silence pattern stays SCOPED to this RBAC-tier surface ONLY.

**Three structural-only asymmetries within the audit coverage** (per DatasetFieldController sidecar):

1. **Depth-of-annotation asymmetry** — internal-name + tags @ActivityLog lives at the OUTER `DatasetFieldServiceImpl`; description's @ActivityLog lives one layer DEEPER at `DatasetFieldInternalInformationServiceImpl`. The depth varies because description-edit additionally re-extracts term references; a future refactor that inlines the inner service or skips the inner-service call would silently drop description-edit from the activity feed. Operationally invisible today; latent regression vector.

2. **Dual-event semantics on description-edit** — one description PUT can produce TWO activity-feed events (DESCRIPTION_UPDATED + TERM_ASSIGNMENT_UPDATED) when the new description contains term references. Operators see two activity rows with the same actor + timestamp and may infer two distinct user actions. Operationally visible but not currently documented.

3. **Per-sub-feature dedicated audit tables** — OwnerAssociationRequest uses its own audit table (per ADR-CANDIDATE-167); per-data-entity mutations use the global `activity` table; RBAC-directory-CRUD uses NEITHER. The pattern is: workflow-specific audit needs get dedicated tables; the per-data-entity activity feed is the centralized surface; RBAC-directory-CRUD is the gap.

**Severity unchanged at HIGH**. The schema-rooted commitment from batch R is unchanged; the scope correction sharpens the audit-asymmetry framing without weakening it; the RBAC-tier gap is the only audit-silence surface that remains.

**Updated full triangulation enumeration**:
- Batch R: `ReactiveActivityRepositoryImpl` — SQL-substrate primary source (the NOT NULL FK at V0_0_48__add_activity.sql:4,12)
- Batch V: `DatasetFieldController` — scope correction (the dataset-field surface has SYMMETRIC audit coverage; F-006 stays scoped to RBAC tier)
- Cross-link with ADR-CANDIDATE-167 (NEW batch V): the OwnerAssociationRequest workflow has its OWN dedicated audit table — the POSITIVE half of the 2-tier audit story

**Cross-references with batch-V sibling artefacts**:
- REFACTOR-440 SUPERSEDED batch V — the prior "no @ActivityLog on dataset_field updateDescription" finding was wrong; see `REFACTOR-440-supersede-batch-V.md`
- F-004 batch-R drift facet `dataset_field_update_description_silent_no_op_on_missing_id` SUPERSEDED batch V — the 404 actually fires from the inner service; see `F-004-drift-facet-supersede-batch-V.md`
- ADR-CANDIDATE-167 NEW batch V — the POSITIVE half of the 2-tier audit story for the OwnerAssociationRequest workflow

---

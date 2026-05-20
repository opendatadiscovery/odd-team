## REFACTOR-440 — SUPERSEDED BATCH V — dataset_field updateDescription IS @ActivityLog'd at the inner-service layer; the prior finding was wrong

**Per LSN-018 Rule 6 (pre-emit coherence check)**: this file documents the supersede of REFACTOR-440 (batch R original finding) per the DatasetFieldController class-level sidecar's `coherence_corrections` section (lines 304-319).

**Action**: REMOVE REFACTOR-440 from the open-scope list. The successor (a structural-only depth asymmetry; no operator impact) is captured in `ADR-CANDIDATE-146-strengthen-batch-V.md`.

**Original finding (batch R, REFACTOR-440)**: "dataset_field updateDescription NOT activity-logged (asymmetric with updateInternalName + updateDatasetFieldTags). Operators auditing a description change on a column will find no activity-feed evidence."

**The original finding was WRONG**. Three layers of evidence in batch V confirm:

1. **Code-side evidence**: `DatasetFieldInternalInformationServiceImpl.java:28` carries `@ActivityLog(event = ActivityEventTypeDto.DATASET_FIELD_DESCRIPTION_UPDATED)` — verified by direct read in DatasetFieldController class sidecar (batch V). The annotation lives ONE LAYER DEEPER than the outer `DatasetFieldServiceImpl.updateDescription` (lines 87-95). The prior batch-R inference reading only the OUTER service missed the INNER service's annotation.

2. **Handler-side evidence**: `DatasetFieldInformationUpdatedActivityHandler.java:27-29` handles the `DATASET_FIELD_DESCRIPTION_UPDATED` event type. The handler exists; the dispatch chain works; the event is consumed.

3. **Live-doc-side evidence**: `https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed#event-types` (verified 2026-05-20, status 200) lists `DATASET_FIELD_DESCRIPTION_UPDATED` verbatim as a documented event type alongside `DATASET_FIELD_INTERNAL_NAME_UPDATED`, `DATASET_FIELD_TAGS_UPDATED`, `DATASET_FIELD_TERM_ASSIGNMENT_UPDATED`, and `DATASET_FIELD_VALUES_UPDATED`. The doc-side is correct; the prior sidecar's inference of "the event is NEVER emitted" contradicted the live docs.

**Root cause of the original miss**: The batch-R `ReactiveDatasetFieldRepositoryImpl` sidecar walked the description-edit chain at the REPOSITORY tier (`updateDescription` at ReactiveDatasetFieldRepositoryImpl.java:73-80) and noted the absence of `@ActivityLog` at THAT tier. The negative inference jumped one level (from "no annotation at the repository tier" to "no annotation anywhere in the chain"), missing the inner service tier. This is the same class of failure that LSN-018 documents — narrow-scope inference produces wrong negative claims when the architecture spans multiple layers.

**Corrected understanding** (captured in `ADR-CANDIDATE-146-strengthen-batch-V.md`):

- The dataset-field surface has SYMMETRIC activity-log coverage across 5 mutation paths (description, internal-name, tags, term-link, term-unlink).
- A STRUCTURAL-ONLY asymmetry exists at the annotation-depth tier: description's @ActivityLog lives at the inner service (`DatasetFieldInternalInformationServiceImpl`) while internal-name's + tags' annotations live at the outer service (`DatasetFieldServiceImpl`). This asymmetry exists because description-edit additionally re-extracts term references — the inner service is the right structural depth for the activity emission.
- The asymmetry is OPERATOR-INVISIBLE — every mutation produces exactly one (or, for description with term references, two) activity row(s) at the right event type. Operators auditing "who changed this column's description last week" can find the answer via the Activity Feed.
- A future refactor that inlines the inner service or skips the inner-service call WOULD silently drop description-edit from the activity feed — this is a LATENT regression vector, not a current gap.

**What replaces REFACTOR-440**: The structural-only depth asymmetry is captured as a NOTE within `ADR-CANDIDATE-146-strengthen-batch-V.md` — NOT as a refactoring scope. It is not an actionable gap; it is an architectural observation that future maintainers should know.

**Action items**:
1. REMOVE REFACTOR-440 from `refactoring-scopes/index.md` open-scope list. Mark as SUPERSEDED in the detail file's frontmatter.
2. UPDATE F-004 batch-R drift list: REMOVE the facet `dataset_field_description_edit_no_activity_log_asymmetric_with_internal_name`. The asymmetry exists ONLY at the structural depth tier; operator impact is zero.
3. UPDATE F-006 batch-R audit-silence consolidation: REMOVE dataset-field-tier from the asymmetric class. The asymmetry is scoped to the RBAC tier (Role / Policy / Owner directory-CRUD).
4. The maintainer-curated `concepts/index.yaml` entry `audit-log-presence-asymmetry-2-tier-audit-story` already framed the audit-asymmetry at the 2-tier story; the resolution per batch V is the POSITIVE/NEGATIVE tier framing in ADR-CANDIDATE-167.

**Severity now**: N/A — the finding was wrong; the closer is `ADR-CANDIDATE-146-strengthen-batch-V.md` + `ADR-CANDIDATE-167.md`.

**Per LSN-018 Rule 6 sweep**: The supersede was caught by the DatasetFieldController class-level sidecar's coherence check during batch V. Per Rule 1 (back-link bidirectionality), the corrected ADR-146 strengthening AND the REFACTOR-440 supersede file both reference each other; the F-004 detail file should be updated by the feature-flow-builder reducer to remove the corrected drift facet.

---

## F-004 batch-R drift facet `dataset_field_update_description_silent_no_op_on_missing_id` — SUPERSEDED BATCH V

**Per LSN-018 Rule 6 (pre-emit coherence check)**: this file documents the supersede of an F-004 batch-R drift facet per the DatasetFieldController class-level sidecar's `coherence_corrections` section (lines 304-319).

**Action**: REMOVE the drift facet `dataset_field_update_description_silent_no_op_on_missing_id` from `feature-flows/detail/F-004.yaml`. The feature-flow-builder reducer should pick up this supersede on the next refresh.

**Original drift facet (batch R, F-004)**: "`DatasetFieldServiceImpl.updateDescription` does NOT switchIfEmpty → If the chain completes empty, the API returns 200 OK with empty body for a non-existent field id."

**The original finding was WRONG**. The DatasetFieldController class-level sidecar (batch V, line 52 of the sidecar's `concepts.invariants` block) establishes the corrected truth:

> "**Description-edit returns 404 on missing id, NOT 200 OK with empty body** — `DatasetFieldInternalInformationServiceImpl.java:33` does `.switchIfEmpty(Mono.error(new NotFoundException(\"DatasetField\", datasetFieldId)))` BEFORE the activity-log emission and the downstream filled-flag updates. The outer `DatasetFieldServiceImpl.updateDescription` (lines 87-95) does NOT need its own `switchIfEmpty` because the inner service throws first."

**Code-side evidence**:
- `DatasetFieldInternalInformationServiceImpl.java:33` — `.switchIfEmpty(Mono.error(new NotFoundException("DatasetField", datasetFieldId)))`
- The Mono chain: outer `DatasetFieldServiceImpl.updateDescription` (lines 87-95) → inner `datasetFieldInternalInformationService.updateDescription(...)` → which carries the `switchIfEmpty` at line 33 BEFORE the activity-log emission and the downstream `markEntityFilled/Unfilled` + `updateDatasetFieldSearchVectors`
- The 404 fires from the INNER service; the outer service never needs to fire it independently

**Root cause of the original miss** (same class as REFACTOR-440 supersede): The batch-R `ReactiveDatasetFieldRepositoryImpl` sidecar walked the description-edit chain at the OUTER service tier (`DatasetFieldServiceImpl.updateDescription`) and noted the absence of `.switchIfEmpty` at THAT tier. The negative inference jumped one level (from "no switchIfEmpty at the outer tier" to "the chain completes empty and the API returns 200 OK"), missing the inner service's switchIfEmpty. This is the same narrow-scope-inference failure class that LSN-018 documents.

**Corrected understanding**:
- PUT /api/datasetfields/{id}/description on a missing id returns HTTP 404 with a `NotFoundException` body (`{"resource": "DatasetField", "id": <datasetFieldId>}`).
- The 404 contract is verified at the inner service tier and propagates correctly through the outer service's `.then(...)` chain.
- A test asserting this contract WOULD pass today; a regression that inlines the inner service or removes the `.switchIfEmpty` from the inner service WOULD silently change the contract to 200-OK-with-empty-body — a LATENT regression vector worth a test-pin (see DatasetFieldController sidecar `tests_coverage_semantic.gaps.[3]`).

**What replaces this drift facet**: A test gap (`PUT /api/datasetfields/{id}/description with auth.type=DISABLED + missing dataset_field_id returns 404 NotFoundException`) — captured in the DatasetFieldController sidecar's `tests_coverage_semantic.uncovered_behaviours.[0]`. This will be picked up by the test-coverage-mapper reducer on the next batch.

**Action items**:
1. REMOVE the F-004 batch-R drift facet `dataset_field_update_description_silent_no_op_on_missing_id` from `feature-flows/detail/F-004.yaml`.
2. ADD a test-gap (`TEST-GAP-NNN`) for the 404-contract regression-pin via the test-coverage-mapper reducer.
3. Cross-link with `REFACTOR-440-supersede-batch-V.md` — same root cause (narrow-scope inference at the outer service tier).

**Per LSN-018 Rule 6 sweep**: The supersede was caught by the DatasetFieldController class-level sidecar's coherence check during batch V. Per Rule 1 (back-link bidirectionality), the feature-flow-builder reducer should:
- Update `feature-flows/detail/F-004.yaml` to remove the drift facet.
- Add a `superseded_by` back-link to this file.

---

# ADR-CANDIDATE-060 — Bulk mutations that don't fit the single-resource shape of `@ActivityLog` AOP use programmatic activity-event emission at the service layer

## STRENGTHENS — batch ZG (2026-05-25 — DatasetFieldController surface: dual-event description-edit chain)

A new instance of programmatic + annotation-driven activity-event emission surfaces at the column-level description-edit path; **the composite-mutation variant** of ADR-060.

**New surfaced_by entry**:

- `odd-platform__java__DatasetFieldController__controller-class__DatasetFieldController.md:implicit_adrs.[2]` (HIGH) — "**Activity-log emission lives at the service layer or one layer deeper at the inner-service layer — NEVER at the controller layer.**" — intent_anchor: "The `@ActivityLog` annotation is consistently applied at the FIRST `@Service`-tier method that touches the writable state, never at the controller. The four mutation paths (description, internal-name, tags, term-link/unlink) all carry the annotation at the right structural depth. The structural depth varies (description at inner-service, internal-name/tags at outer-service) because of the additional term-extraction work description does — but every mutation emits exactly one activity event for the primary mutation type."

- `odd-platform__java__DatasetFieldController__controller-class__DatasetFieldController.md:implicit_adrs.[4]` (HIGH) — "**Description-edit emits TWO activity events when the new description text contains term references (one DATASET_FIELD_DESCRIPTION_UPDATED + one DATASET_FIELD_TERM_ASSIGNMENT_UPDATED).**" — see ADR-CANDIDATE-225 NEW (the standalone ADR for the dual-event semantics).

**Cross-batch refinement**:

ADR-060 originally captured **bulk** mutations (e.g., `DataEntityInternalStateServiceImpl.changeStatuses` for multi-entity status changes) that don't fit single-resource `@ActivityLog` AOP. The batch-ZG addition extends the pattern to **composite** mutations — a single resource undergoing multiple structural-mutation classes (description text + re-extracted term-link graph). The composite variant emits TWO events for one user operation; the bulk variant emits one event per resource in the bulk.

Three patterns now coexist under ADR-060's umbrella:
1. **Single-resource single-mutation** (the default): `@ActivityLog` annotation at the service method emits one event. Most CRUD methods use this.
2. **Bulk multi-resource** (the original ADR-060 case): programmatic emission inside the service method, one event per affected resource. `changeStatuses` is the canonical case.
3. **Single-resource composite-mutation** (NEW batch ZG): chain composition where each component has its own `@ActivityLog`, emitting multiple events for one user operation. The description-edit chain is the canonical case.

ADR-CANDIDATE-225 NEW (Description-edit dual activity-event emission) is the standalone ADR for the third pattern; this strengthen records that the pattern is consistent with ADR-060's family.

**The structural anchor**:
```java
// DatasetFieldServiceImpl.updateDescription (lines 87-95) — composite-mutation chain
return datasetFieldInternalInformationService.updateDescription(datasetFieldId, formData)
    // @ActivityLog at inner service line 28 → emits DATASET_FIELD_DESCRIPTION_UPDATED
    .then(termService.handleDatasetFieldDescriptionTerms(datasetFieldId, formData.getDescription()))
    // @ActivityLog at TermServiceImpl line 243 → emits DATASET_FIELD_TERM_ASSIGNMENT_UPDATED
    .thenReturn(...);
```

The `.then(...)` chain composition is the deliberate sequential-event-emission primitive; each step has its own `@ActivityLog` annotation; the chain composes the events without collapsing them.

**Live-doc anchor**:
- `https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed#event-types` — WebFetched 2026-05-20 status 200. Lists BOTH `DATASET_FIELD_DESCRIPTION_UPDATED` and `DATASET_FIELD_TERM_ASSIGNMENT_UPDATED` as event types. The doc-side commitment confirms the two-event surface; the dual-event semantics (one user click → two events) is the operator-surprise point (REFACTOR-665 captures the doc-side gap).

**Co-surfaced gaps**:
- **REFACTOR-665 NEW** — the dual-event semantics is NOT documented at the activity-feed page. Operators may infer two distinct user actions from two activity-feed rows.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-225 NEW (the standalone ADR for the dual-event semantics).
- SUPERSEDES: none.
- CONFLICTS: none.

---

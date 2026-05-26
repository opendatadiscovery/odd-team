# ADR-CANDIDATE-225 — Description-edit on a dataset-field (or data-entity) emits TWO activity events for a SINGLE user operation — one for the description body + one for re-extracted term mentions in the new text

**Classification**: promote
**Severity**: MEDIUM
**Pillars affected**: [P-07 Active Platform Features (Activity Feed), P-01 Data Discovery (description editing), P-06 Business Glossary (term-link coupling via [[ns/name]] markers)]
**Batch**: ZG (2026-05-25)

**Surfaced by**:
- `odd-platform__java__DatasetFieldController__controller-class__DatasetFieldController.md:implicit_adrs.[4]` (HIGH) — "**Description-edit emits TWO activity events when the new description text contains term references (one DATASET_FIELD_DESCRIPTION_UPDATED + one DATASET_FIELD_TERM_ASSIGNMENT_UPDATED).**" — intent_anchor: "`DatasetFieldServiceImpl.updateDescription` (lines 87-95): the chain is `datasetFieldInternalInformationService.updateDescription(...)` (emits DATASET_FIELD_DESCRIPTION_UPDATED at line 28 of that class) `.then(termService.handleDatasetFieldDescriptionTerms(datasetFieldId, formData.getDescription()))` (emits DATASET_FIELD_TERM_ASSIGNMENT_UPDATED at TermServiceImpl.java:243). Both events are emitted on EVERY description-edit when the new description contains term-marker syntax."

**Decision statement**: A user's `PUT /api/datasetfields/{id}/description` (or the entity-level sibling `PUT /api/dataentities/{id}/description`) triggers TWO distinct activity events on the platform's Activity Feed:

1. **`DATASET_FIELD_DESCRIPTION_UPDATED`** (or `DATA_ENTITY_DESCRIPTION_UPDATED` for the entity-level surface) — emitted at the inner-service `DatasetFieldInternalInformationServiceImpl.java:28` via the `@ActivityLog` annotation. Records the description text change with before/after values.

2. **`DATASET_FIELD_TERM_ASSIGNMENT_UPDATED`** (or `DATA_ENTITY_TERM_ASSIGNMENT_UPDATED` for the entity-level surface) — emitted at `TermServiceImpl.handleDatasetFieldDescriptionTerms` (line 243) when the new description body contains `[[namespace/name]]` term markers. Records the re-extracted term-link graph change.

The chain at `DatasetFieldServiceImpl.updateDescription` (lines 87-95):

```java
return datasetFieldInternalInformationService.updateDescription(datasetFieldId, formData)
    // ← emits DATASET_FIELD_DESCRIPTION_UPDATED at the inner service's @ActivityLog
    .then(termService.handleDatasetFieldDescriptionTerms(datasetFieldId, formData.getDescription()))
    // ← emits DATASET_FIELD_TERM_ASSIGNMENT_UPDATED at the term-handling step
    .thenReturn(...);
```

The structural intent is to record BOTH the TEXTUAL change AND the structural TERM-GRAPH change as separately audit-able events. Description text changes (typo fixes, clarifications, formatting) are operationally distinct from term-link changes (linking a column to a Glossary term affects the catalog's semantic graph, not its descriptive content). The two-event emission lets operators reviewing the Activity Feed see exactly what changed — text or semantic-graph — without ambiguity.

The structural anchor: the `.then(termService.handleDatasetFieldDescriptionTerms(...))` chain segment is a deliberate sequential composition; the term-handling step is NOT folded into the inner service's @ActivityLog scope; the two events have independent SAGA semantics. The pattern repeats at the entity-level (`DataEntityServiceImpl.updateDataEntityInternalDescription` has the same chain shape).

**Wisdom test**: PASS. Three intent anchors:
1. **Annotation-anchored** — `@ActivityLog(DATASET_FIELD_DESCRIPTION_UPDATED)` at the inner service explicitly emits the description event. A SECOND `@ActivityLog(DATASET_FIELD_TERM_ASSIGNMENT_UPDATED)` at `TermServiceImpl.java:243` explicitly emits the term-assignment event. Both annotations are deliberate.
2. **Chain composition** — the `.then(...)` chain composition is explicit; folding the term-handling into the inner service would collapse to ONE event but lose the structural distinction.
3. **Wire-surface consistency** — the activity-feed doc page (`https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed`) lists BOTH event types — the two-event surface is documented as a feature.

Structural impact: the Activity Feed's event taxonomy commits to fine-grained event types. An operator reviewing the feed sees both events with the same actor + timestamp; UI filtering by event type works (filter by `DATASET_FIELD_DESCRIPTION_UPDATED` to see only text changes). Collapsing to one event would lose the filtering granularity.

**Operator-visible consequence**:
- One user edits a column description that contains `[[business_glossary/customer_id]]`; the Activity Feed shows TWO rows back-to-back with the same actor + timestamp.
- A description edit with NO term markers emits ONLY the description event (the term-handler short-circuits when no markers are present).
- A description edit that REMOVES previously-present markers also emits the term-assignment event (the term-link is severed; the event records the graph change).
- An operator filtering by `DATASET_FIELD_TERM_ASSIGNMENT_UPDATED` to track glossary-graph changes sees those events whether they came from this description-edit path OR from the explicit `POST /terms` path — both paths emit the same event type.

**Existing ADR**: closely related to **ADR-CANDIDATE-060** (programmatic activity-event emission at the service tier — bulk mutations don't fit single-resource `@ActivityLog` AOP). This ADR is the COMPOSITE-MUTATION variant: description-edit is one user operation but spans two structural mutation classes (text + graph); the composite emits two events. ADR-060 governs bulk mutations that need programmatic emission; ADR-225 governs composite mutations whose components each have their own `@ActivityLog`.

Also related to **ADR-CANDIDATE-064 / -108** (description-link coexistence — `is_description_link` flag on every term-link row). The two ADRs are linked because the term re-extraction creates/removes description-link rows; the `is_description_link` flag is what the cascade-DELETE filter at REFACTOR-664 keys on.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- **REFACTOR-665 NEW** — the dual-event semantics is NOT documented at the activity-feed page. Operators reading the feed see two rows with the same actor + timestamp and may infer two distinct user actions; the doc page should clarify that one description edit produces two events.

**Proposed action**: Promote to `adrs/drafts/description-edit-dual-activity-event.md` (new ADR). Document:
1. The decision: description-edit on a dataset/dataset-field emits TWO activity events when the new text contains term markers.
2. The chain anchor: `DatasetFieldServiceImpl.updateDescription` (and the entity-level sibling) — the `.then(termService.handleDatasetFieldDescriptionTerms(...))` composition is the structural primitive.
3. The event taxonomy commitment: fine-grained event types (text-change vs graph-change) are preserved deliberately.
4. The cross-platform consistency: the same shape applies to the data-entity-level description-edit surface.
5. The doc-side gap: the activity-feed page should clarify the dual-event semantics.

**Severity rationale**: MEDIUM — activity-feed-taxonomy decision affecting one composite-mutation class; load-bearing for operator audit-review workflows + the term-link graph's audit trail. Not security-architecture, but a structural commitment that future maintainers must understand to evolve the Activity Feed safely.

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-060 (programmatic activity-event emission — the composite-mutation variant); ADR-CANDIDATE-064 / -108 (description-link coexistence — the term re-extraction populates the `is_description_link=true` rows).
- SUPERSEDES: none.
- CONFLICTS: REFACTOR-665 captures the doc-side gap (the dual-event semantics is undocumented at the activity-feed page); the ADR's documentation step closes this gap.

---

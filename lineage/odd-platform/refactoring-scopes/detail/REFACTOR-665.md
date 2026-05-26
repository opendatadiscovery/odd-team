## REFACTOR-665 — DatasetFieldController's description-edit dual activity-event semantics (one `DATASET_FIELD_DESCRIPTION_UPDATED` + one `DATASET_FIELD_TERM_ASSIGNMENT_UPDATED`) is NOT documented at the live activity-feed page — operators reading the feed see two rows with same actor + timestamp and may infer two distinct user actions

**Severity**: LOW
**Category**: dual-event-undocumented
**Batch**: ZG (2026-05-25)
**Pillars affected**: [P-07 Active Platform Features (Activity Feed)]

**Surfaced by**:
- `odd-platform__java__DatasetFieldController__controller-class__DatasetFieldController.md:bugs_limitations_corner_cases.[3]` (LOW) — "**Description-edit can trigger TWO activity-feed entries for one user operation** — the dual-event semantics (DATASET_FIELD_DESCRIPTION_UPDATED + DATASET_FIELD_TERM_ASSIGNMENT_UPDATED) are not documented at the activity-feed page. Operators reading the description-edit row in the feed see a separate term-assignment-update row immediately after with the same actor/timestamp and may infer two distinct user actions."

**Statement**: Per ADR-CANDIDATE-225 NEW, a description-edit on a dataset-field that contains `[[ns/name]]` term markers emits TWO activity events:
1. `DATASET_FIELD_DESCRIPTION_UPDATED` (text change)
2. `DATASET_FIELD_TERM_ASSIGNMENT_UPDATED` (term-link graph change from re-extraction)

The Activity Feed at `https://docs.opendatadiscovery.org/features/active-platform-features/activity-feed#event-types` (WebFetch 2026-05-20 status 200) LISTS both event types as separate items but does NOT state that ONE user action emits BOTH. The operator-visible consequence: the Activity Feed shows two rows back-to-back with the same actor + timestamp; the operator may infer two distinct user actions (e.g., "Alice edited the description, then Alice updated the term assignment"). The truth is "Alice edited the description, which contained a term marker; the system re-extracted terms automatically."

**Evidence**:
- Live doc page: WebFetch 2026-05-20 status 200 — lists event types separately, no narrative of dual emission
- Chain: `DatasetFieldServiceImpl.updateDescription` (lines 87-95) — `.then(termService.handleDatasetFieldDescriptionTerms(...))` produces the dual emission

**Existing-ADR-or-implied-prescription**: **ADR-CANDIDATE-225 NEW** captures the architectural intent (dual-emission is deliberate). THIS REFACTOR captures the doc-side gap: the operator cannot understand the dual-row appearance without reading the code.

**Proposed remedy**: add a section to the live `/features/active-platform-features/activity-feed` page titled "Composite events" or similar; explain that description-edits with term markers emit BOTH `*_DESCRIPTION_UPDATED` and `*_TERM_ASSIGNMENT_UPDATED`; the same pattern at the entity-level (`DATA_ENTITY_*` siblings). One paragraph; closes the operator-surprise without changing the code.

**Severity rationale**: LOW — operator-clarity gap; not a security or correctness bug.

**Suggested backlog grouping**: `Activity Feed audit hygiene sprint` (consolidates with REFACTOR-662 — replay churn).

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-225 NEW (the dual-event ADR).
- SUPERSEDES: none.
- CONFLICTS: none.

---

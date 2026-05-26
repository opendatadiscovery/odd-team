## REFACTOR-662 — DatasetFieldController's `createEnumValue` is replay-safe-for-state but NOT for audit-trail: identical bodies twice produce the same visible state but DIFFERENT row identities (the second call's softDeleteExcept removes the first call's rows; bulkCreate makes new ones); auditors using row ids lose the chain

**Severity**: MEDIUM
**Category**: audit-trail-replay-churn
**Batch**: ZG (2026-05-25)
**Pillars affected**: [P-01 Data Discovery (column-level enum values), P-07 Active Platform Features (Activity Feed audit)]

**Surfaced by**:
- `odd-platform__java__DatasetFieldController__controller-class__DatasetFieldController.md:bugs_limitations_corner_cases.[10]` (MEDIUM) — "**`createEnumValue` is replay-safe-for-state but NOT for audit-trail** — identical bodies submitted twice produce the SAME visible state but DIFFERENT row identities (the second call soft-deletes the first call's rows and bulkCreates new ones), and emits a `DATASET_FIELD_VALUES_UPDATED` activity event per call. Operators inspecting the activity feed see two events with no visible diff in state; auditors using row ids to correlate events lose the chain."

**Statement**: Per ADR-CANDIDATE-226 NEW, `createEnumValues` runs the three-step reconciliation (softDeleteExcept → bulkUpdate → bulkCreate). When the body's items have NO ids (all id-absent — bulkCreate path), each submission:

1. softDeleteExcept with `idsToKeep = {}` → deletes EVERY existing row
2. bulkCreate → creates NEW rows for every body item

The visible state stabilises (same items, same values), but the row ids CHURN on every submission. Identical resubmits produce:
- Submission 1: rows R1, R2, R3 created
- Submission 2: rows R1, R2, R3 soft-deleted; rows R4, R5, R6 created

Two `DATASET_FIELD_VALUES_UPDATED` activity events fire (one per submission). Operators inspecting the Activity Feed see two events back-to-back with the same actor + timestamp; the visible state is identical; the row ids change between events.

The audit-trail consequences:
- **Auditor using `enum_value.id` to correlate** an activity event with a row → the row from event 1 was soft-deleted by event 2; the correlation chain breaks across resubmits.
- **External system caching enum_value ids** (e.g., a BI tool that joins to enum_values by id) silently loses references on every resubmit.
- **Soft-delete table accumulation** — every resubmit grows the `deleted_at` rows; no housekeeping job removes them (cross-link with the broader soft-delete housekeeping family).

The replay-safe-for-state property is operationally useful (idempotent submissions don't corrupt state); the replay-NOT-safe-for-audit property is the operationally invisible cost.

**Evidence**:
- Service three-step: `EnumValueServiceImpl.java:91-122`
- Activity emit per call: `EnumValueServiceImpl.java:41` (or the equivalent `@ActivityLog`)
- Soft-delete columnar persistence: `enum_value.deleted_at` column

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-226 NEW captures the REPLACE-AS-STATE intent. THIS REFACTOR captures the audit-side cost of the choice — the architectural intent is sound; the operational consequence is row-id churn invisible to operators.

**Proposed remedy**:
- **Option A (audit-event enrichment)**: include the diff (added/removed/preserved item values) in the activity-event payload, not just the row ids. Auditors can reconstruct intent across resubmits.
- **Option B (id-stable bulkUpdate)**: when an id-less item's `value` matches an existing row's value, treat as id-present (no churn). Preserves row ids across identical resubmits.
- **Option C (operator-side hint)**: surface the audit-churn behaviour in the OpenAPI doc + the developer-guide page; tell operators NOT to use `enum_value.id` for cross-event correlation.

Option B preserves row ids across resubmits AT THE COST of additional matching logic; Option A is the audit-friendly fix without changing the row-id semantic.

**Severity rationale**: MEDIUM — audit-trail completeness gap; not a security or data-integrity bug at the state level; visible only to auditors / forensic-reconstruction use cases.

**Suggested backlog grouping**: `Activity Feed audit hygiene sprint` (consolidates audit-trail-quality findings).

**Coherence check** (LSN-018):
- STRENGTHENS: ADR-CANDIDATE-226 NEW (the WHY of REPLACE-AS-STATE); ADR-CANDIDATE-225 NEW (the dual-event semantics — both surfaces share the property that activity events fire on operations that don't visibly change state).
- SUPERSEDES: none.
- CONFLICTS: none.

---

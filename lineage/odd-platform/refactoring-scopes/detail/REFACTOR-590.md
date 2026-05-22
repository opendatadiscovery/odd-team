## REFACTOR-590 — `data_source` mutations (register / update / delete) emit NO Activity Event — `DataSourceServiceImpl` imports no activity emitter; there is no audit trail of who registered / edited / deleted a data source or when; 3-sidecar triangulated

**Severity**: MEDIUM
**Category**: missing-audit
**Pillars affected**: [P-08 (Data-Source Lifecycle Management), P-09 (RBAC / Governance — audit substrate)]
**related_features**: [F-008]
**Batch**: ZB (2026-05-21)

**Surfaced by** (3-sidecar triangulated — register + update + delete all surface the same absence):
- `odd-platform__java__DataSourceController__controller-method__registerDataSource.md:bugs_limitations_corner_cases.[4]` (MEDIUM) — "No Activity Event is emitted on register — the create is invisible to the Activity Feed" — evidence: `DataSourceServiceImpl.java:51-66` (the `create` method makes no `activityEventEmitter` call; the class imports no `ActivityEvent`).
- `odd-platform__java__DataSourceController__controller-method__updateDataSource.md:bugs_limitations_corner_cases.[3]` (MEDIUM) — "No Activity Event on the `data_source` UPDATE — the edit is invisible to the Activity Feed; the Datasources tab shows only current state, not a change history" — evidence: `DataSourceServiceImpl.java` entire file (no activity emitter import).
- `odd-platform__java__DataSourceController__controller-method__deleteDataSource.md:bugs_limitations_corner_cases.[4]` (MEDIUM) — "**No Activity Event on data source delete.** `DataSourceServiceImpl` emits no Activity Event for any mutation ... An operator auditing 'who deleted which data source and when' has no audit trail; the only signal is the row's `deleted_at` timestamp, which carries no actor" — evidence: `DataSourceServiceImpl.java:85-96` (no `activityEventEmitter`).
- `odd-platform__java__DataSourceController__controller-method__updateDataSource.md:security.known_security_gaps.[2]` + `deleteDataSource.md:security.known_security_gaps.[1]` (both MEDIUM — the audit-gap as a security finding).

**Description**: `DataSourceServiceImpl` — the service owning all three operator-facing data-source mutations (`create` lines 51-66, `update` lines 68-83, `delete` lines 85-96) — imports no `ActivityEvent` type and makes no `activityEventEmitter` call on any mutation path (verified across all three batch-ZB method sidecars + the batch-W class sidecar). So registering, editing, or deleting a data source produces NO row in the Activity Feed. An operator (or a security reviewer) asking "who registered this data source, who renamed it, who deleted it, and when" has no answer: the `data_source` row's `created_at` / `updated_at` / `deleted_at` timestamps carry no ACTOR, and there is no append-only event record. The Management → Datasources tab shows only current state, never a change history.

This is the data-source-tier instance of the audit-asymmetry the catalog has tracked across surfaces. NOTE the important distinction from REFACTOR-188: REFACTOR-188 (no audit logging on RBAC mutations) was explicitly REFINED in batch F to be RBAC-directory-CRUD-tier specifically — and that refinement noted that **DataEntity-tier** mutations DO emit audit events (`OWNERSHIP_CREATED`, `DATA_ENTITY_STATUS_UPDATED` via `@ActivityLog` / programmatic emission). The `data_source`-tier mutations are a THIRD surface — neither RBAC-directory nor DataEntity — and they emit NOTHING. So the platform's audit coverage is: DataEntity mutations audited; RBAC-directory mutations un-audited (REFACTOR-188); data-source mutations un-audited (this REFACTOR-590). REFACTOR-590 is a distinct entry, not a strengthen of REFACTOR-188 — different service, different entity tier.

(The token-rotation no-audit gap on `regenerateDataSourceToken` is tracked separately under REFACTOR-046 — the rotation path. REFACTOR-590 is the register/update/delete data-source-mutation audit gap.)

**Primary source citations**:
- `DataSourceServiceImpl.java:51-66` (`create` — no `activityEventEmitter` call) + `:68-83` (`update`) + `:85-96` (`delete`)
- `DataSourceServiceImpl.java` (whole file — no `ActivityEvent` import; verified across batch-W class sidecar + 3 batch-ZB method sidecars)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-060 (programmatic activity-event emission for bulk mutations) + the `@ActivityLog` AOP pattern establish that the platform HAS an activity-event mechanism and DOES use it for DataEntity mutations. There is no ADR justifying the ABSENCE of activity emission on `data_source` mutations — the absence has no stated rationale. The platform has the audit substrate; the `data_source`-mutation paths simply do not use it. GAP, not a deliberate decision.

**Proposed remedy**: Emit an Activity Event on each `data_source` mutation — `DATA_SOURCE_CREATED`, `DATA_SOURCE_UPDATED`, `DATA_SOURCE_DELETED` — via the existing activity mechanism (`@ActivityLog` AOP for the single-resource shape, or programmatic emission per ADR-CANDIDATE-060), capturing the actor and (for update) the before/after state. The emission should be inside the existing `@ReactiveTransactional` boundary so the audit row commits atomically with the mutation. This brings `data_source`-tier auditing into line with the DataEntity-tier coverage the platform already has.

**Severity rationale**: MEDIUM — an audit-trail gap on operator-facing infrastructure mutations. A malicious or mistaken data-source edit (e.g. renaming a source to impersonate another) or deletion leaves no actor trail; incident-response and compliance review cannot reconstruct data-source lifecycle history. Consistent with the MEDIUM rating of the sibling RBAC-mutation audit gap (REFACTOR-188).

**Suggested backlog grouping**: `SEC-NNN audit-coverage completion` — pair with REFACTOR-188 (RBAC-mutation audit gap); together they define the platform's remaining un-audited mutation surfaces (RBAC-directory + data-source) vs the already-audited DataEntity tier.

---

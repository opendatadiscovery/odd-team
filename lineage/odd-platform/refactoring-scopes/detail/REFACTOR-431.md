## REFACTOR-431 — No activity-feed event on datasource registration via `POST /ingestion/datasources` — audit gap on the FIRST step of every collector's lifecycle; cross-platform mirror of REFACTOR-188's RBAC audit gap

**Severity**: HIGH (the operator-audit gap on the most-frequent collector-platform interaction)
**Category**: missing-audit (cross-cutting; cross-platform with REFACTOR-188's RBAC mutation gap)
**Pillars affected**: [P-07-active-platform-features, P-09-security-access-control, P-10-integrations-ingestion]
**Batch**: P (2026-05-20)

**Surfaced by**: `IngestionController__controller-method__createDataSourceEntity.md:bugs_limitations_corner_cases.[8]` (MEDIUM elevated to HIGH after cross-cutting consequence analysis) + `:security.known_security_gaps.[5]` (MEDIUM)

**Description**: The platform's Activity Feed (P-07) records entity-side metadata changes (description edits, tag assignments, status changes) and emits `DATA_ENTITY_CREATED` events for new entities. But `DataSourceIngestionServiceImpl.createDataSources` (lines 41-72) writes new `DataSource` rows DIRECTLY via `bulkCreate` / `bulkUpdate` with NO `activityEventEmitter` reference and no `@ActivityLog` annotation. An operator auditing "who registered which datasource and when" has no audit log to consult; the only signal is the row's `created_at` timestamp (which doesn't carry the actor identity).

The cross-cutting alignment: this is the DATASOURCE-side mirror of REFACTOR-188 (RBAC-directory CRUD audit gap) + REFACTOR-332 (DEG-membership audit gap) + REFACTOR-426 (Owner-directory CRUD audit gap). The pattern across batches: per-data-entity write surfaces ARE audited; meta-level directory writes (RBAC, Owner, Namespace, Collector, Datasource) ARE NOT audited. The substrate is now ready to elevate this to a unified "directory-mutation audit absence" cross-cutting finding.

**Primary source citations**:
- `DataSourceIngestionServiceImpl.java:41-72` (no ActivityEventEmitter reference)
- grep `activityEventEmitter` in `DataSourceIngestionServiceImpl.java` returns ZERO matches

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-088 (Activity feed cursor pagination — the audit surface). REFACTOR-188 (RBAC audit gap; 3-sidecar). The implied prescription is the same as REFACTOR-426: add `@ActivityLog(event = DATASOURCE_CREATED/UPDATED)` + new enum values + a `DataSourceActivityHandler` capturing BEFORE/AFTER state per call.

**Proposed remedy**: Add `DATASOURCE_REGISTERED` + `DATASOURCE_UPDATED` enum values to `ActivityEventTypeDto`; annotate `createDataSources` / `prepareForUpdate` / `prepareForCreate` paths with `@ActivityLog`; implement the handler. Pair with REFACTOR-426 + REFACTOR-188 + REFACTOR-332 in a single "directory-mutation audit-coverage sprint."

**Severity rationale**: HIGH — collector boot is the most-frequent platform-write interaction (per the documented `POST /ingestion/datasources once at startup` pattern multiplied by N collectors restarting after upgrades, OOMs, etc.); the audit gap silently misses the WHO/WHEN signal for every collector's appearance in the directory.

**Suggested backlog grouping**: `Directory-mutation audit-coverage sprint` (REFACTOR-188 + REFACTOR-332 + REFACTOR-337 + REFACTOR-426 + THIS — five entries across RBAC + DEG membership + custom-metadata + Owner CRUD + Datasource registration; the cross-cutting audit-coverage gap).

---

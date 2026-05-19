## REFACTOR-342 — `GET /api/dataentities/{data_entity_id}/alerts` has NO `status` filter parameter while the sibling `getDataEntityAlertsCounts` accepts one — UI must paginate the full set to filter, and the audit-export workaround returns RESOLVED rows the operator may not want in the export

**Severity**: LOW
**Category**: missing-feature (API-contract asymmetry; UX gap)
**Pillars affected**: [P-07-active-platform-features, P-11-platform-api-developer-surface]
**Batch**: L (2026-05-19)

**Surfaced by**:
- `odd-platform__java__DataEntityController__controller-method__getDataEntityAlerts.md:bugs_limitations_corner_cases.[3]` (LOW) — "No alert-status filter on the listing endpoint, while the sibling counts endpoint accepts one. `getDataEntityAlertsCounts` (`DataEntityController.java:324-330`) accepts an `AlertStatus status` query param and filters the count by status (`ReactiveAlertRepositoryImpl.java:202-215`); `getDataEntityAlerts` does NOT — it always returns ALL statuses (OPEN, RESOLVED, RESOLVED_AUTOMATICALLY). The asymmetry means: (a) a caller wanting only OPEN alerts must paginate the full set and filter client-side, or hit `getDataEntityAlertsCounts(status=OPEN)` for the count and `getDataEntityAlerts` for an unfiltered page (mismatch on totals); (b) the audit-export workaround from the doc page returns RESOLVED rows that may be deleted on the next housekeeping cycle (intentional — that's the use case) but also returns OPEN rows the operator may not want in the export. No comment or annotation defends the asymmetry as intentional"

**Description**: The platform exposes two sibling per-entity alert endpoints:
- `GET /api/dataentities/{id}/alerts` (listing — `DataEntityController.java:315-321`): NO status parameter; returns ALL alerts regardless of status (OPEN, RESOLVED, RESOLVED_AUTOMATICALLY).
- `GET /api/dataentities/{id}/alerts/counts?status={status}` (counts — `DataEntityController.java:324-330`): ACCEPTS an `AlertStatus` query parameter; filters by status at the repository layer (`ReactiveAlertRepositoryImpl.java:202-215`).

The asymmetry creates two user-facing problems:
- (a) **Filtered-listing N+1**: a UI consumer wanting only OPEN alerts has two unappealing options: paginate the unfiltered listing endpoint and filter client-side (extra rows transferred + complex pagination); OR hit `counts(status=OPEN)` for the total + `listing` for unfiltered pages (mismatch on totals + double round-trip).
- (b) **Audit-export inclusion**: the live alerting page recommends `getDataEntityAlerts` for compliance audit exports BEFORE manually resolving alerts. Operators want to export OPEN + RESOLVED rows that are about to be auto-deleted by housekeeping; they DON'T want already-stable RESOLVED rows. The endpoint returns ALL three statuses indiscriminately.
- (c) **API consistency**: the counts endpoint supports filtering; the listing endpoint does not. Operators familiar with the counts endpoint reach for `?status=OPEN` on the listing and receive 500 / silent-ignore depending on Spring's parameter-binding strictness.

The fix is straightforward — add an optional `status` query parameter to the listing endpoint with the same semantics as the counts endpoint.

**Primary source citations**:
- `DataEntityController.java:315-321` (listing endpoint; no status parameter)
- `DataEntityController.java:324-330` (counts endpoint; status parameter exists)
- `ReactiveAlertRepositoryImpl.java:182-199` (listing query; no status filter)
- `ReactiveAlertRepositoryImpl.java:202-215` (counts query; DOES filter by status)
- WebFetch live alerting page 2026-05-19 (audit-export workaround recommended; status-filter not mentioned)

**Existing-ADR-or-implied-prescription**: **ADR-CANDIDATE-001** (controllers as delegates, OpenAPI-generator-emitted interfaces). The IMPLIED prescription is API consistency across sibling endpoints; the gap is contract asymmetry without stated rationale.

**Proposed remedy**: Edit `odd-platform-specification/openapi.yaml:1321-1338` to add an optional `status` query parameter to the `getDataEntityAlerts` operation (mirror the parameter definition from `getDataEntityAlertsCounts`). Update `AlertService.getDataEntityAlerts` to accept the optional status; update `ReactiveAlertRepositoryImpl.getAlertsByDataEntityId` to apply the status filter when present (mirror the existing `getAlertsByDataEntityIdAndStatus`-style shape). Companion: doc-side, the live alerting page's audit-export workaround section should recommend `?status=OPEN,RESOLVED` for export-then-resolve workflows.

**Severity rationale**: LOW — UX/API hygiene gap; no security or correctness impact. Operators can work around it client-side; the fix is mechanical (one parameter add + service+repository plumbing).

**Suggested backlog grouping**: `OpenAPI contract hardening` (cluster with REFACTOR-339, REFACTOR-341 — spec consistency batch).

---

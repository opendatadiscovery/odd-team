## REFACTOR-426 — Owner mutations emit NO activity-feed events — `OwnerServiceImpl.create/update/delete` carry NO `@ActivityLog`; rename + role-rebind + cascade-delete are forensically silent; FIFTH corroborating sidecar of F-006 audit-silence family

**Severity**: HIGH
**Category**: missing-audit (cross-cutting; strengthens batch-N RBAC audit-silence family from 4-sidecar to 6-sidecar)
**Pillars affected**: [P-09-security-access-control, P-08-management-administration, P-07-active-platform-features]
**Batch**: P (2026-05-20)

**Surfaced by**:
- `OwnerController__controller-method__updateOwner.md:bugs_limitations_corner_cases.[1]` (MEDIUM) — "Owner rename emits NO activity-feed event — `@ActivityLog` is applied to `AlertServiceImpl`, `DataEntityServiceImpl`, `DataEntityGroupServiceImpl`, `AlertHaltConfigServiceImpl`, `DataEntityInternalStateServiceImpl`, `OwnershipServiceImpl` (Ownership ≠ Owner) but NOT to `OwnerServiceImpl.update`"
- `OwnerController__controller-method__updateOwner.md:security.known_security_gaps.[0]` (MEDIUM) — same finding restated as security gap
- `OwnerController__controller-method__deleteOwner.md:bugs_limitations_corner_cases.[0]` (HIGH) — "Owner deletion emits NO activity-feed event … **STRENGTHENS the F-006 4-sidecar audit-silence pattern — this is the FIFTH corroborating sidecar**"
- `OwnerController__controller-method__deleteOwner.md:security.known_security_gaps.[0]` (HIGH)

**Description**: `OwnerServiceImpl.create` (lines 38-66), `OwnerServiceImpl.update` (lines 68-85), and `OwnerServiceImpl.delete` (lines 87-100) all carry NO `@ActivityLog` annotation. The Activity Feed therefore does NOT record:
- "Owner X was created by Y at T with roles [A, B]" (the createOwner batch-E sidecar's same gap)
- "Owner X was renamed from A to B by Y at T" / "Owner X had roles [A, B] before, now has [B, C]" (THIS batch's updateOwner finding)
- "Owner X was deleted by Y at T; their role bindings [A, B, C] were permanently removed" (THIS batch's deleteOwner finding)

The asymmetry across the platform:
- **Data-entity mutations** (description edits, tag assignments, ownership creations, status changes) DO emit activity events.
- **Ownership relations** (the entity↔owner binding) DO emit `OWNERSHIP_CREATED/UPDATED/DELETED` events via `OwnershipServiceImpl.@ActivityLog` at lines 48, 77, 100.
- **Owner directory CRUD** (create/update/delete on the OWNER entity itself) does NOT emit anything.
- **Policy / Role directory CRUD** (the F-006 batch N 4-sidecar finding) does NOT emit anything.

The 6-sidecar audit-silence family pattern is: RBAC-directory and Owner-directory CRUD silent; per-data-entity mutations audited. Combined with REFACTOR-425 (the destructive-empty role-rebind), the security implication is that an operator with `OWNER_UPDATE` permission can silently strip ALL roles from an Owner with NO forensic trail; the only signal would be the role bindings' absence at the next observation point (which has no timestamp).

**Primary source citations**:
- `OwnerServiceImpl.java:38-100` (the entire CRUD class — no `@ActivityLog`)
- `grep -l '@ActivityLog' <odd-platform-api>/service/*.java` returns 6 files (AlertServiceImpl, DataEntityServiceImpl, DataEntityGroupServiceImpl, AlertHaltConfigServiceImpl, DataEntityInternalStateServiceImpl, OwnershipServiceImpl) — NONE of them OwnerServiceImpl, NONE of them PolicyServiceImpl, NONE of them RoleServiceImpl
- `OwnershipServiceImpl.java:48, 77, 100` (the CONTRAST — Ownership IS audited)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-088 (Activity feed cursor pagination — established the audit surface) + REFACTOR-188 (no audit logging on RBAC mutations — the 4-sidecar pattern this scope extends). The implied prescription is that EVERY directory-CRUD-mutation surface emits a corresponding activity event; the gap is the missing `@ActivityLog` annotations on the Owner CRUD service methods.

**Proposed remedy**:
1. Add three new enum values to `ActivityEventTypeDto.java`: `OWNER_CREATED`, `OWNER_UPDATED`, `OWNER_DELETED`.
2. Annotate the three methods with `@ActivityLog(event = OWNER_*)`.
3. Implement a corresponding `OwnerActivityHandler` that captures BEFORE/AFTER state per call.
4. Companion `@WebFluxTest` regressions asserting (a) POST creates an activity row; (b) PUT renames captured in activity; (c) DELETE creates a deletion-record activity row.
5. Apply the SAME shape to `PolicyServiceImpl` + `RoleServiceImpl` (REFACTOR-188 closure) — six new enum values, six new annotations, two new ActivityHandlers.

**Severity rationale**: HIGH — privileged directory mutations + destructive role-rebind + cascade-delete invisible to audit; combined with REFACTOR-425 the operational impact is "an admin-permission caller can silently rewrite the directory with no trace."

**Suggested backlog grouping**: `Activity-feed enum-cleanup sprint` (group with REFACTOR-188 RBAC-audit + REFACTOR-332 DEG-membership + REFACTOR-337 CUSTOM_METADATA — the cohesive audit-coverage sprint).

---

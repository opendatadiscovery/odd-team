## REFACTOR-609 — `PermissionController` has NO `@Slf4j` / Logger / `log.*` call — privilege-enumeration surface silent

**Severity**: MEDIUM
**Category**: missing-audit / observability
**Batch**: ZD (2026-05-25)
**Pillars affected**: [P-09 Security & Access Control (the read-side privilege-discovery surface)]

**Surfaced by**:
- `odd-platform__java__PermissionController__controller-class__PermissionController.md:bugs_limitations_corner_cases.[3]` (MEDIUM) — "No `@Slf4j`, no Logger, no log call — the class has zero observability. A caller iterating resource ids to enumerate which entities they have elevated permissions on leaves no controller-tier trace. Combined with the absence of `SECURITY_RULES` gating, the privilege-enumeration surface is silent."
- `odd-platform__java__PermissionController__controller-class__PermissionController.md:concepts.invariants.[no-observability]` ("No `@Slf4j`, no Logger, no log call — the class has zero observability annotations. A permission-read for a resource is invisible to the audit log.")

**Statement**: `PermissionController.java:1-27` declares no `@Slf4j`, has no `Logger` field, and emits zero log calls. The endpoint `GET /api/resource/{permission_resource_type}/{resource_id}/permissions` is the canonical UI-permission-gate discovery surface — every UI page-mount that renders a permission-gated control hits this endpoint per resource. An authenticated caller iterating resource ids to enumerate which entities they have ELEVATED permissions on (e.g. probing every data_entity_id from 1 to N looking for entities where they have `DATA_ENTITY_INTERNAL_NAME_UPDATE`) leaves no controller-tier trace. Combined with the absence of `SECURITY_RULES` gating (per ADR-CANDIDATE-003 read-collaborative posture), the privilege-enumeration surface is silent.

**Evidence**:
- `PermissionController.java:1-27` (full file — no `@Slf4j` import, no Logger declaration, no log invocation)

**Existing-ADR-or-implied-prescription**: REFACTOR-097 (cross-cutting "no audit logging infrastructure"). The PermissionController surface is the IDENTITY-DISCOVERY MIRROR of the IdentityController whoami silence (REFACTOR-608) — both are reconnaissance surfaces that leave no trace.

**Proposed remedy**: Add `@Slf4j` to the controller; emit `log.debug` on every getResourcePermissions invocation with `(principal, resourceType, resourceId, returnedPermissionCount)` — at DEBUG level so it's opt-in for forensic deep-dive but not noisy by default. Alternative remedy: defer to REFACTOR-097's cross-cutting audit infrastructure.

**Severity rationale**: MEDIUM — privilege-enumeration is bounded to the caller's OWN permissions (per ADR-CANDIDATE-003 — reads reveal only what the policy graph would already grant); the enumeration is not a privilege escalation. The forensic gap is the absence of "who probed which entities" data when investigating a credential-theft scenario.

**Suggested backlog grouping**: "Authorization audit batch" / cross-cutting "Audit logging infrastructure" (REFACTOR-097's eventual fix).

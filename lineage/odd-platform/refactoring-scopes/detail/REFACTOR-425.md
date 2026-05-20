## REFACTOR-425 — Owner role-rebind on `PUT /api/owners/{owner_id}` with `roles` omitted/empty SILENTLY DESTROYS all role bindings — destructive-default UX hazard with NO confirmation, NO partial-update mechanism

**Severity**: HIGH
**Category**: silent-overwrite (destructive-default at write boundary)
**Pillars affected**: [P-09-security-access-control, P-08-management-administration]
**Batch**: P (2026-05-20)

**Surfaced by**: `OwnerController__controller-method__updateOwner.md:bugs_limitations_corner_cases.[3]` (HIGH) + `:security.known_security_gaps.[2]` (HIGH — same finding restated as security gap)

**Description**: `OwnerFormData.roles` is OpenAPI-optional (`components.yaml:419-422`; no `required` marker); the service-layer helper `getRoleIdsList` (`OwnerServiceImpl.java:117-122`) collapses both null and empty list to `List.of()`. The update transaction at `OwnerServiceImpl.java:76-81` then calls `deleteOwnerRelationsExcept(ownerId, List.of()).then(createRelations(ownerId, List.of()))` — the first half DELETES all current role-links (no existing link is in the empty-set), and the second half INSERTS nothing. **An operator updating ONLY the owner's name (e.g. via a script PUT-ing `{"name":"new-name"}` with `roles` omitted to mean "don't touch the assignments") instead REMOVES all role assignments from the Owner.** No confirmation step, no "are you sure" check, no partial-update mode (PATCH-shape).

The UI in practice always sends the current `roles` list (per `owners.thunks.ts` reading the existing list and re-submitting it on save), so the hazard is masked in normal UI flows — but ANY API consumer (script, integration, malformed request) that omits `roles` silently strips ALL roles. Combined with REFACTOR-426 NEW (no audit log on the role-rebind), role-stripping is silent AND irrecoverable from logs.

**Primary source citations**:
- `OwnerServiceImpl.java:71, 76-81, 117-122` (the destructive-empty semantic)
- `components.yaml:419-422` (`roles` optional, no `required` marker)
- `ReactiveOwnerToRoleRepositoryImpl.java:52-56` (the `DSL.delete(OWNER_TO_ROLE).where(OWNER_ID.eq(...).and(ROLE_ID.notIn(roleIds)))` predicate that wipes everything when `roleIds = []`)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-144 NEW (batch P — set-replacement role-rebind) codifies the SEMANTIC choice (PUT replaces, not merges). This scope is the OPERATIONAL hazard of that semantic when the contract has no required-field marker.

**Proposed remedy**:
1. **Path A — make `roles` required**: update `components.yaml:419-422` to set `required: [roles]` on `OwnerFormData`; the OpenAPI validator at the controller boundary will reject PUTs without it (HTTP 400). The UI and all SDK clients regenerate.
2. **Path B — introduce PATCH semantics**: add a new endpoint `PATCH /api/owners/{owner_id}` that accepts only the fields the caller wants to change; preserve PUT as the full-replace semantic.
3. **Path C — service-layer guardrail**: at `OwnerServiceImpl.update`, treat `roles == null` distinctly from `roles == []` — the null case as "preserve existing"; the empty list as "explicitly clear." Requires distinguishing the two at the Jackson deserialisation layer.

The Principal-engineer recommendation: Path A (make `roles` required at the contract) — it's the cleanest fix and aligns with the PUT-replaces-not-merges semantic of ADR-CANDIDATE-144. Pair with a `@WebFluxTest` regression asserting (a) PUT with `roles: []` succeeds AND strips all bindings (the explicit-clear behaviour); (b) PUT without `roles` field returns 400 with the missing-required-field error; (c) PUT with `roles: [A, B]` succeeds AND replaces to that exact set.

**Severity rationale**: HIGH — destructive-default at a privileged write surface; silent on errors; combined with audit-log absence (REFACTOR-426) the data loss is forensically invisible.

**Suggested backlog grouping**: `Owner directory UX hardening sprint` (pair with REFACTOR-426 + REFACTOR-427 + REFACTOR-429 — the cluster of Owner-mutation operational gaps).

---

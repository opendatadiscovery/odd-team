## STRENGTHENS — Batch ZD (PolicyController class-level — controller-tier primary source for the lost-update race)

**One new class-level sidecar PROMOTES the lost-update race finding from service-tier (batch S — PolicyServiceImpl) primary source to CONTROLLER-TIER PRIMARY SOURCE**:

- **PolicyController (CLASS-LEVEL)** — `PolicyController.updatePolicy` at `:43-50` is a thin `.flatMap` delegation to `policyService.update(policyId, formData)` with NO `@ReactiveTransactional` annotation on the controller method. The only available transactional bracket would have to come from the service tier, which (per batch-S PolicyServiceImpl finding) ALSO has no annotation. Two layers of missing bracket — controller above + service below — confirm the lost-update race is observable from the HTTP boundary inward.

Per `bugs_limitations_corner_cases[0]` of the new PolicyController sidecar: "Lost-update race on PUT /api/policies/{id} — surfaced at the controller boundary. PolicyController.updatePolicy at lines 43-50 is a thin .flatMap delegation to policyService.update(policyId, formData) with NO @ReactiveTransactional annotation on the controller method; the only available transactional bracket would have to come from the service tier, which (per batch-S PolicyServiceImpl finding) ALSO has no annotation. Two concurrent PUTs against the same policy_id with different bodies both succeed, second-arriving wins, first-arriving change is silently lost — NO 409 Conflict response, NO ETag protocol, NO `If-Match` header check, NO server-side log line warning of contention. The operator hitting the HTTP boundary cannot tell that their write was overwritten."

The class-level sidecar also confirms the **asymmetry** with `PUT /api/roles/{id}` which IS `@ReactiveTransactional` at the service tier (`RoleServiceImpl.java:64`) — the platform's choice to bracket Role updates transactionally but NOT Policy updates is an unintentional asymmetry between the two halves of the RBAC mutation stack.

**Updated triangulation count**: 2-sidecar (batch S PolicyServiceImpl + batch ZD PolicyController) — but the BLAST RADIUS is now observed at the HTTP boundary, which is the operator's surface. Cross-link with sibling RoleService asymmetry.

**Severity unchanged**: HIGH — silent data corruption on concurrent admin writes; the asymmetry vs sibling Role updates makes the omission look like a regression in retrospect.

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-267 (orphan-binding race on DELETE /api/policies/{id} — same non-atomic shape, also confirmed at controller-tier this batch).
- SUPERSEDES: none.
- CONFLICTS: none.

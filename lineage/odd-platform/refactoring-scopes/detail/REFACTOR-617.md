## REFACTOR-617 — `GET /api/policies/{id}` + `GET /api/policies` + `GET /api/policies/schema` have NO SECURITY_RULES entry — confidentiality exposure of the RBAC system's own configuration to any authenticated user

**Severity**: HIGH
**Category**: missing-auth / confidentiality-exposure / meta-layer-blast-radius
**Batch**: ZD (2026-05-25)
**Pillars affected**: [P-09 Security & Access Control (the RBAC read surface — the most-sensitive read in the catalog)]

**Surfaced by**:
- `odd-platform__java__PolicyController__controller-class__PolicyController.md:bugs_limitations_corner_cases.[3]` (HIGH) — "Read-side authorization gap is class-wide. Three of the six controller methods — `getPolicyDetails` (lines 27-32), `getPolicyList` (lines 34-41), `getPolicySchema` (lines 59-63) — have NO entry in `SecurityConstants.SECURITY_RULES`. They fall through to `AuthorizationCustomizer.java:29-30`'s catch-all `pathMatchers(\"/**\").authenticated()` and are gated only by AUTHENTICATION, NOT by any Permission. Any authenticated user — including a user whose ONLY granted permission is the most basic data-view permission — can: (a) enumerate every policy by id (1, 2, 3, ...) via `GET /api/policies/{id}` and read every policy's statements (since `PolicyServiceImpl.getPolicyDetails` at lines 45-50 applies NO role-based filter — confirmed by batch-S); (b) hit `GET /api/policies` and see at minimum the policy NAMES of every policy attached to roles they belong to (subject to the in-memory non-admin filter — for an admin user it's every policy in the system); (c) hit `GET /api/policies/schema` and read the full JSON-Schema document including the entire Permission enum partition. The confidentiality exposure: a non-admin user can iterate ids and read MANAGEMENT/ALL policy statements, learning which permissions are bundled into which role — useful reconnaissance for credential-theft escalation."
- `odd-platform__java__PolicyController__controller-class__PolicyController.md:bugs_limitations_corner_cases.[7]` (HIGH) — "`getPolicyDetails` applies NO role-based filter — confidentiality exposure for non-admin users. Combined with the read-side authorization gap, this exposure is unauthenticated-discoverable on a DISABLED-mode platform and authenticated-discoverable on any other mode."

**Statement**: THREE read endpoints on `PolicyController` — `getPolicyDetails`, `getPolicyList`, `getPolicySchema` — have NO entry in `SecurityConstants.SECURITY_RULES` (verified by reading SecurityConstants.java:163-168 which contains entries ONLY for POST/PUT/DELETE /api/policies). All three fall through to `AuthorizationCustomizer.java:29-30`'s catch-all `pathMatchers("/**").authenticated()` and are gated only by AUTHENTICATION, NOT by any Permission.

The combined operator-visible blast radius — for any authenticated user (including a user whose ONLY granted permission is the most basic data-view) under LOGIN_FORM/OAUTH2/LDAP:

- **(a)** Enumerate every policy by id (1, 2, 3, ...) via `GET /api/policies/{id}` and read every policy's full `statements` JSON. `PolicyServiceImpl.getPolicyDetails` at `:45-50` applies NO role-based filter (confirmed by batch-S sidecar) — every policy is fully visible.
- **(b)** Hit `GET /api/policies` — admin sees full paginated catalogue of every policy; non-admin sees the policies attached to their roles (filtered via `RoleService.getCurrentUserRoles` chain) — at minimum, EVERY user sees the policies their own role is bound to (including the policy's NAME, which usually telegraphs its intent — e.g. "Administrator", "Read-Only Auditor", "MANAGEMENT/ALL").
- **(c)** Hit `GET /api/policies/schema` — read the full JSON Schema document, including the entire Permission enum partition by resource type (per batch-P phantom-node finding, the schema is public-by-design; PolicyController has no rule on it).

Concretely: a non-admin user (e.g. someone with only `DATA_ENTITY_TAGS_UPDATE`) can iterate policy ids 1, 2, 3, ..., read every MANAGEMENT/ALL policy statement, learn which permissions are bundled into which role, and use the inventory as reconnaissance for credential-theft escalation paths.

Per ADR-CANDIDATE-003 (read-collaborative GET) the absence-of-rule is the intentional architectural posture for read endpoints — but the PolicyController case is the **META-LAYER** of that posture: the RBAC system's OWN configuration is the most-sensitive read in the catalog. The architectural commitment may not have been deliberate at this layer; maintainer triage decides whether (a) the read-collaborative posture genuinely extends to RBAC management reads, OR (b) PolicyController read endpoints warrant a `POLICY_READ` permission that doesn't currently exist in `PolicyPermissionDto`.

**Evidence**:
- `SecurityConstants.java:163-168` (entries ONLY for POST/PUT/DELETE)
- `PolicyController.java:27-32, 34-41, 59-63` (no `@PreAuthorize` on the three read methods)
- `PolicyServiceImpl.java:45-50` (`getPolicyDetails` applies no role filter — batch-S confirmation)
- `AuthorizationCustomizer.java:29-30` (`pathMatchers("/**").authenticated()` catch-all)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-003 (read-collaborative GET) anchors the absence-of-rule pattern; this scope is the most-sensitive instance of it. The implied prescription is either (a) keep the read-collaborative posture and DOCUMENT the confidentiality consequence on the live `/authorization/policies` page (currently silent — confirmed by WebFetch 2026-05-25), OR (b) add a `POLICY_READ` permission to `PolicyPermissionDto` + register the three SECURITY_RULES entries.

**Proposed remedy**: Maintainer triage between the two paths. Path (a) — keep the posture: the live `/authorization/policies` page must enumerate that any authenticated user reads every policy's full statements. Path (b) — restrict reads: add `POLICY_READ` to `PolicyPermissionDto`; register `SECURITY_RULES` entries for the three GET endpoints; the predefined Administrator policy auto-includes the new permission; non-admin users lose read access to policies they're not bound to. Path (a) preserves the read-collaborative architectural commitment; path (b) defends the meta-layer confidentiality.

**Severity rationale**: HIGH — the RBAC system's own configuration is the most-sensitive read in the catalog. Confidentiality exposure is observable today (any authenticated user can enumerate); under DISABLED + REFACTOR-185, the exposure is anonymous-reachable.

**Suggested backlog grouping**: "Authorization audit batch" (compose with REFACTOR-024 + REFACTOR-053 + REFACTOR-187 + REFACTOR-200 + REFACTOR-203 — the read-collaborative-blast-radius family; this one is the META-LAYER addition).

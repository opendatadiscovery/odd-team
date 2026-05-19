## REFACTOR-368 — RBAC forensic-silence on Role mutations — `ReactiveRoleRepositoryImpl` + `RoleServiceImpl` emit zero log/event/audit-table writes; STRENGTHENS REFACTOR-188 to 4-sidecar triangulation across controllers/services/repositories on the RBAC mutation tier

**Severity**: HIGH
**Category**: missing-audit (RBAC observability)
**Surfaced by**:
- `ReactiveRoleRepositoryImpl.md:bugs_limitations_corner_cases[DRIFT-FACET-B]` + `ReactiveRoleRepositoryImpl.md:security.known_security_gaps[1]`
- Cross-batch: REFACTOR-188 (batch E primary-source — controller-side RBAC audit gap), REFACTOR-244 (batch H — repository-tier observability gap across 5 repositories), REFACTOR-230 (batch H — soft-delete-filter on RBAC hot path)

**Description**: Batch N's `ReactiveRoleRepositoryImpl` sidecar surfaces ZERO log lines on any of the three custom DTO methods (`getDto`, `listDto`, `getByName`) and ZERO log lines through the inherited base-class CRUD on Role mutations (`create`, `update`, `delete`, `bulkCreate`, `bulkUpdate`). `RoleServiceImpl.java:39-92` also has NO log calls, NO event publication, NO insert into any audit table. A privileged caller (or an S2S API-key holder per REFACTOR-108) who creates / mutates / deletes Roles leaves NO trail in the platform's logs.

**The 4-sidecar triangulation** (across batches E, F, H, N):

| Sidecar (batch) | Layer | Finding |
|---|---|---|
| RoleController.createRole (batch E) | controller | No log; no event; no audit table |
| PolicyController.createPolicy (batch E) | controller | Same |
| OwnerController.createOwner (batch E) | controller | Same |
| ReactivePolicyRepositoryImpl (batch H) | repository | Same — REFACTOR-230 context |
| ReactiveRoleRepositoryImpl (batch N) | repository | Same — this scope |
| RoleServiceImpl (cross-batch) | service | Same (no log calls in RoleServiceImpl.java:39-92) |
| PolicyServiceImpl (cross-batch) | service | Same |
| OwnershipServiceImpl (batch K) | service | Same — REFACTOR-199/206 context |

The pattern is uniform across THREE layers (controller, service, repository) at the RBAC mutation surface. The activity feed (`/api/activity`) does NOT extend to Role / Policy / Permission mutations (cross-axis observation — confirmed across batches E, F, H, N — refined by this batch with the fourth confirming sidecar).

**This is the highest-leverage audit gap in the RBAC surface**: a security incident reviewer reconstructing "who created/modified/deleted the Administrator role on date X" has zero in-application records. Compounds with REFACTOR-230 (soft-deleted policies still grant permissions) + REFACTOR-357 (Role-side mirror of -230) to produce the "soft-deleted policy could continue granting permissions without ANY operator-visible signal" surface.

**Primary source citations**:
- `ReactiveRoleRepositoryImpl.java:1-94` — no log imports beyond inherited
- `ReactiveAbstractSoftDeleteCRUDRepository.java:1-118` — no @Slf4j-emitted lines on mutations
- `ReactiveAbstractCRUDRepository.java:35-36` — `@Slf4j` on class but no application-level log call on success paths
- `RoleServiceImpl.java:39-92` — no log calls, no event publication
- Cross-batch: REFACTOR-188 (batch E primary-source — controller-side), REFACTOR-244 (batch H — repository-tier cross-cutting), REFACTOR-230 (batch H — the soft-delete-filter gap that compounds with this audit-silence)

**Existing-ADR-or-implied-prescription**: REFACTOR-188 (batch E) was REFINED at batch F to "NOT codebase-wide; specifically RBAC-tier directory-CRUD". This scope STRENGTHENS that refinement — the Role-tier RBAC mutation IS forensically silent at all three layers. The Activity-feed retention scope (REFACTOR-085) is the indirect consequence — even if RBAC audit events WERE emitted, the activity table has no retention.

**Proposed remedy**: Three-tiered, additive:
1. **AOP-driven repository instrumentation** (cleanest baseline) — one `@Aspect` class that wraps every method in `org.opendatadiscovery.oddplatform.repository.reactive` with a Timer + structured log. Per REFACTOR-244's proposal. Zero per-class change.
2. **`@ActivityLog` AOP at the service** — annotate every RBAC mutation method (`RoleServiceImpl.create/update/delete`, `PolicyServiceImpl.*`, `OwnerServiceImpl.delete`) with `@ActivityLog(event = ROLE_CREATED / UPDATED / DELETED)` mirroring the entity-side pattern (per ADR-CANDIDATE-060). Pair with the AlertActionResolver / ActivityHandler chain.
3. **Structured warn-log on mutations** — emit `log.warn("rbac.role.create username=... oldRoles=... newRoles=...", ...)` at the service tier. Operator-visible signal even before a full audit-log subsystem.

Option 2 is the platform-aligned fix (uses the existing AOP) and would close the gap symmetrically across Role/Policy/Owner mutation paths.

**Severity rationale**: HIGH — RBAC observability gap with confirmed reach across 3+ layers and 4+ sidecars. A successful exploit (per REFACTOR-189 + REFACTOR-367 + REFACTOR-230 + REFACTOR-357 chain) produces zero forensic signal. The combined risk surface (architectural drift × audit silence × soft-delete-on-orphan-bindings) is the "RBAC is invisibly compromisable" pattern.

**Suggested backlog grouping**: `Authorization audit batch` — pair with REFACTOR-188 (controller-side), REFACTOR-230 (soft-delete-filter gap), REFACTOR-357 (Role-side mirror), REFACTOR-073 (no boot-time security-posture validator). The five together describe the RBAC observability + correctness surface.

---

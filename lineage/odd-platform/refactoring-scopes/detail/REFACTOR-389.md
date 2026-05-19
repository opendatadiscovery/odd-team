## REFACTOR-389 — `ReactiveUserOwnerMappingRepositoryImpl.getUserRolesByOwner` (4-way JOIN) is on the RBAC authorization hot path with NO caching — every authorized HTTP request runs the JOIN; multiplicative cost on /my page loads

**Severity**: LOW
**Category**: missing-cache (performance gap on hot path; mirror of REFACTOR-384)
**Surfaced by**: `ReactiveUserOwnerMappingRepositoryImpl.md:performance.known_performance_gaps[0]`

**Description**: `ReactiveUserOwnerMappingRepositoryImpl.getUserRolesByOwner(ownerId)` (lines 99-114) is a 4-way JOIN: `ROLE LEFT JOIN ROLE_TO_POLICY ON ROLE.ID LEFT JOIN POLICY ON POLICY_ID JOIN OWNER_TO_ROLE ON ROLE.ID JOIN USER_OWNER_MAPPING ON OWNER_ID = OWNER_TO_ROLE.OWNER_ID WHERE getConditions GROUP BY ROLE.fields` with a `jsonArrayAgg(policy.*)` aggregation.

Invoked transitively from `PolicyServiceImpl.getCurrentUserPolicies` on EVERY authorized HTTP request via the RBAC permission framework. The single most-frequent query against `user_owner_mapping`. The JOIN size depends on the user's role count × policy count per role — typically small (1-3 roles, 5-15 policies). Sub-millisecond per call; multiplicative across requests.

The result for stable user-role bindings is stable until role-attach/detach mutations. Cache-eligibility is high; no caching layer exists.

**Primary source citations**:
- `ReactiveUserOwnerMappingRepositoryImpl.java:99-114` — the 4-way JOIN
- `RoleServiceImpl.java:96-101` — the consumer
- `PolicyServiceImpl.java:103-104` — parallel hot-path call

**Existing-ADR-or-implied-prescription**: Same as REFACTOR-384 — the platform's stateless reactive posture deliberately omits caching.

**Proposed remedy**: Same options as REFACTOR-384:
1. **Short-TTL Caffeine cache** keyed on (ownerId); TTL ≈ 1 minute.
2. **Reactor Context-scoped cache** — one fetch per HTTP request.
3. **Materialised in-memory user-role bindings** — refresh on role-attach/detach events.

Option 1 is the smallest blast radius.

**Severity rationale**: LOW — performance gap, correctness preserved.

**Suggested backlog grouping**: `Performance-baseline sprint` — pair with REFACTOR-384 (the parallel Role hot path), REFACTOR-240 (the parallel Policy hot path), REFACTOR-244 (the cross-cutting observability gap).

---

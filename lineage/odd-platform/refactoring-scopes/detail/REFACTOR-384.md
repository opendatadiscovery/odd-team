## REFACTOR-384 — `ReactiveRoleRepositoryImpl.getByName` is on the RBAC authorization hot path with NO caching — every authorized HTTP request resolves the user-provider-role via a DB round-trip; combined with the parallel `PolicyRepository.getRolesPolicies` round-trip, 2 uncached DB calls per authorized request

**Severity**: LOW
**Category**: missing-cache (performance gap on hot path)
**Surfaced by**: `ReactiveRoleRepositoryImpl.md:performance.known_performance_gaps[0]`

**Description**: `RoleServiceImpl.getCurrentUserRoles` (lines 95-101, 123-126) calls `roleRepository.getByName(role.getValue())` on the fall-back path (no explicit owner-attached role). The query is a single JOIN (role ⋈ role_to_policy ⋈ policy) with `WHERE role.name = ? AND role.deleted_at IS NULL` — sub-millisecond on typical row counts. But it fires on EVERY authorized HTTP request via the permission-extractor chain.

The result for stable seeded role names (`'Administrator'`, `'User'`) is essentially NEVER invalidated for the lifetime of the seeded rows. On a busy platform with N authorized req/s, this is N DB calls (resolving the user-provider-role).

Combined with the parallel `ReactivePolicyRepositoryImpl.getRolesPolicies` (also on the hot path per REFACTOR-240) — also uncached — the authorization hot path costs TWO DB round-trips per request.

**Primary source citations**:
- `ReactiveRoleRepositoryImpl.java:82-93` — no @Cacheable, no caching layer
- `RoleServiceImpl.java:95-101, 123-126` — also no caching
- `PolicyServiceImpl.java:103-104` — parallel call to PolicyRepository.getRolesPolicies (REFACTOR-240)

**Existing-ADR-or-implied-prescription**: none for caching. The platform's broader stateless reactive posture means the maintainer DELIBERATELY did not add caching. This scope is the operational consequence.

**Proposed remedy**:
1. **Short-TTL Caffeine cache** at the service tier — keyed on (username, provider, role-name); TTL ≈ 1 minute. Reduces DB round-trip rate by ~99% for seeded-role lookups.
2. **Reactor Context-scoped cache** — same as REFACTOR-383's option; one fetch per HTTP request.
3. **Materialised in-memory roles** at boot — load all roles into a Spring bean; refresh on role-create/update/delete events (requires event publication — see REFACTOR-368).

Option 1 is the smallest blast radius; Option 3 is the most performance-optimal.

**Severity rationale**: LOW — performance gap, correctness preserved. Multiplicative cost only matters at scale.

**Suggested backlog grouping**: `Performance-baseline sprint` — pair with REFACTOR-240 (the parallel PolicyRepository hot path), REFACTOR-244 (the cross-cutting observability gap that would surface this), REFACTOR-383 (the Tag triple-fetch).

---

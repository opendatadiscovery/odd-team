## REFACTOR-240 — `ReactivePolicyRepositoryImpl.getRolesPolicies` is on the RBAC hot path with no caching — every authorized HTTP request hits Postgres

**Severity**: MEDIUM
**Category**: missing-cache (performance hot-path)
**Surfaced by**:
- `ReactivePolicyRepositoryImpl.md:performance.known_performance_gaps[0]`
- `ReactivePolicyRepositoryImpl.md:performance.hot_paths` (the explicit "AUTHORIZATION HOT PATH" framing)

**Description**: `getRolesPolicies` is invoked on EVERY authorized HTTP request through both permission extractors:
- `ManagementPermissionExtractor.getNonContextualPermissions` (`ManagementPermissionExtractor.java:31-41`) — fires on every Management-scoped action.
- `AbstractContextualPermissionExtractor.getContextualResourcePermissions` (`AbstractContextualPermissionExtractor.java:24-35`) — fires on every per-resource action (DATA_ENTITY, TERM, QUERY_EXAMPLE).

The SQL is a single JOIN (policy ⋈ role_to_policy) with `WHERE role_id IN (...)` — sub-millisecond on typical row counts (single-digit policies per user). The result list is collected to memory (`.collectList()` at `ReactivePolicyRepositoryImpl.java:38`) and consumed in-memory by the extractor. **No caching layer exists at the repository, service, or extractor level.** Every authorized request hits Postgres.

For a busy platform with N authorized req/s:
- N+M DB calls total (N for permission resolution, M for actual mutations + reads).
- Result data is highly cacheable: for a stable `(roleIds)` set, the result is stable for the lifetime of the role-policy edges. Changes only on `POST /api/roles`, `PUT /api/roles/{id}`, `DELETE /api/roles/{id}`, `POST /api/policies`, `PUT /api/policies/{id}`, `DELETE /api/policies/{id}` (i.e. RBAC-directory mutations — operator-driven, low-frequency).

A short-TTL (e.g. 30-second or request-scoped) cache keyed on `(roleIds, hash-of-role-policy-edges)` would absorb 99%+ of DB load. Today's behaviour is correct (always-fresh) but wasteful.

The platform has the Spring Cache infrastructure available (verified via `Grep @Cacheable` across the codebase — used at `OwnerAssociationRequestServiceImpl` and a few other sites). The pattern is established; the RBAC hot path is the highest-leverage missing application.

**Primary source citations**:
- `ReactivePolicyRepositoryImpl.java:32-38` — the JOIN + collectList (no @Cacheable)
- `ManagementPermissionExtractor.java:31-41` — non-contextual hot-path consumer
- `AbstractContextualPermissionExtractor.java:24-35` — contextual hot-path consumer
- `PolicyServiceImpl.java:102-107` — `getCurrentUserPolicies` (the service-level wrapper, also uncached)
- `PolicyServiceImpl.java:62-95` — the mutation paths that would invalidate any cache (low-frequency)

**Existing-ADR-or-implied-prescription**: implicit — the platform has Spring Cache infrastructure and uses `@Cacheable` selectively elsewhere. The RBAC hot path is the largest single uncached read in the platform. No comment defends the absence of caching here.

**Proposed remedy**: Three-layered cache strategy:
1. **Request-scoped cache** (simplest, immediate win): use Reactor's `Context` or a per-request `Map<List<Long>, List<PolicyPojo>>` cache. A single HTTP request can invoke `getCurrentUserPolicies()` multiple times (once per security-rule evaluation across multiple resource paths). Cache for the request lifetime; no invalidation needed.
2. **Short-TTL cache** (`@Cacheable` with 30-second TTL):
   ```java
   @Cacheable(value = "rolesPolicies", key = "#roleIds")
   public Mono<List<PolicyPojo>> getRolesPolicies(List<Long> roleIds) { ... }
   ```
   Couple with `@CacheEvict(value = "rolesPolicies", allEntries = true)` on every RBAC mutation. Acceptable staleness: 30 seconds for permission propagation.
3. **Event-driven cache invalidation** (most correct): use Spring's `ApplicationEventPublisher` to emit `RbacChangedEvent` from policy/role mutation paths; a cache listener invalidates. Zero staleness, but more wiring.

Start with (1) — request-scoped cache. Even that alone absorbs the per-request N+1 from the extractor chain. Move to (2) or (3) based on profiling data.

**Severity rationale**: MEDIUM — performance optimisation, not a correctness gap. Latency per call is small (sub-millisecond), but the DB call rate is proportional to total request rate × the number of authorized resources in each request. For a UI rendering a data-entity list with permission checks on every row, the per-request DB cost is N × T (N = list size, T = number of permission-types checked per resource). The aggregate DB load is the largest single avoidable cost in the platform's hot path.

**Suggested backlog grouping**: `PERF-NNN RBAC hot-path optimisation sprint` — pair with REFACTOR-191 (the existing PermissionController per-resource N+1 finding) and REFACTOR-230 (the soft-deleted-policy correctness gap). All three together close the RBAC performance + correctness story.

---

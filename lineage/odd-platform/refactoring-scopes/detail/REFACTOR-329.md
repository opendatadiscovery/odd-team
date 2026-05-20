## REFACTOR-329 — `AuthIdentityProviderImpl` no per-request memoization — a single HTTP request can invoke `getCurrentUser` / `fetchAssociatedOwner` 3-5 times via separate consumers (controller + permission extractor + activity-logging path); a reactor-Context attribute would eliminate the duplicate work

**Severity**: LOW
**Category**: missing-cache (per-request)
**Pillars affected**: [P-09-security-access-control]
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__AuthIdentityProviderImpl.md:performance.known_performance_gaps.[0]` (LOW) — "No per-request memoization. A single HTTP request can invoke `getCurrentUser` or `fetchAssociatedOwner` multiple times (e.g., once at the controller for owner-scoping + once in a permission extractor + once in an activity-logging path). A reactor-Context attribute carrying the resolved UserDto / OwnerPojo would eliminate the duplicate work."

**Description**: A single HTTP request enters the controller; the controller's owner-scoping flow invokes `fetchAssociatedOwner()` (first DB round-trip); the `DataEntityPermissionExtractor` evaluates a Policy condition requiring the caller's owner-id and invokes `fetchAssociatedOwner()` AGAIN (second DB round-trip); the `@ActivityLog` AOP advice may invoke `getCurrentUser()` to record the actor (third DB round-trip — if it also resolves the owner). Per ADR-CANDIDATE-106 (stateless / no-caching), there is no in-memory cache; per the implementation, there is no reactor-Context attribute carrying the resolved tuple within the request lifecycle. Each invocation pays the full per-call DB cost.

**Failure mode**: A UI page loads `/api/dataentities/{id}` triggering one HTTP request; the request internally invokes `fetchAssociatedOwner()` three times (controller + extractor + activity); three identical `SELECT owner.* FROM user_owner_mapping JOIN owner WHERE ...` queries hit Postgres. Across a 100-request page-load (rendering the home page with multiple per-entity affordances), the multiplier is 3-5× the necessary DB load.

**Primary source citations**:
- `AuthIdentityProviderImpl.java:50-53` (raw flatMap chain; no Context.put / Context.get)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-106 (NEW batch K — stateless / no-cache by deliberate omission) defends the LONG-LIVED cache absence (no `@Cacheable`, no ConcurrentHashMap) — but does NOT defend the absence of REQUEST-SCOPED memoization. A reactor-Context attribute is bounded to one request and introduces NO long-lived cache-invalidation surface; it is a candidate for closing without breaking the ADR's contract.

**Proposed remedy**: Add a request-scoped memoization via reactor Context. In `fetchAssociatedOwner`, write the resolved `OwnerPojo` to the Context on first read; on subsequent reads within the same request, return the Context value. The implementation: `Mono.deferContextual(ctx -> ctx.getOrEmpty("_resolved_owner").map(o -> Mono.just((OwnerPojo) o)).orElseGet(() -> [original DB lookup chain].contextWrite(ctx -> ctx.put("_resolved_owner", ...))))`. The complexity is small; the cost saving is 2-4× per page-load. Same pattern for `getCurrentUser`.

**Severity rationale**: LOW — per-request cost is small; cumulative cost is bounded but multiplicative. The fix is small and does not contradict ADR-CANDIDATE-106.

**Suggested backlog grouping**: `Performance hot-path sprint` (with REFACTOR-240 RBAC hot-path no-caching)

---

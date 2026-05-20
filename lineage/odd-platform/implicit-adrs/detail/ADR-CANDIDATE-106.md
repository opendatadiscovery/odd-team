## ADR-CANDIDATE-106 — Stateless/no-caching by deliberate omission in AuthIdentityProviderImpl — per-request DB round-trip on every owner-scoped operation; no per-session memoization, no `@Cacheable`, no reactor-Context attribute

**Classification**: promote
**Severity**: LOW
**Pillars affected**: [P-09-security-access-control]
**Support**: surfaced by 1 sidecar (`AuthIdentityProviderImpl`) — primary-source; structural caching-stance decision; MEDIUM-confidence on absence-as-intent inference (but consistent with the codebase's broader reactive-stateless posture)
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__AuthIdentityProviderImpl.md:implicit_adrs.[3]` (MEDIUM confidence) — "Stateless / no-caching by deliberate omission. Every invocation goes through `ReactiveSecurityContextHolder.getContext()` AND (for fetchAssociatedOwner) the DB lookup. There is no in-memory map keyed by username, no per-session memoization, no `@Cacheable`."

**Decision statement**: `AuthIdentityProviderImpl` is a 31-line lombok'd reactive chain with ONE private final field (the injected repository). There is NO `@Cacheable` annotation, NO ConcurrentHashMap field, NO `volatile`/atomic state, NO reactor-Context attribute write to memoize the resolved UserDto / OwnerPojo within a request, NO per-session in-memory cache. Every `getCurrentUser()` invocation invokes `ReactiveSecurityContextHolder.getContext()` (typically in-memory, but reactor-Context-switch overhead applies); every `fetchAssociatedOwner()` invocation invokes the DB lookup against `user_owner_mapping JOIN owner`. The architectural posture: stateless service; resolve per-request; trust the DB. The trade-off: a UI rendering `Recommended → My Objects` + `My Alerts` count + Activity feed simultaneously triggers 3-5 sequential identical DB queries to user_owner_mapping per page-load; the accepted cost is per-call DB round-trip in exchange for no cache-invalidation surface (no stale-Owner-after-rebind bug class).

**Wisdom test**: PASS (with MEDIUM confidence on the absence-as-intent inference, per the file-analyser's own note). (1) Deliberate (the absence of any cache annotation across the entire service layer is the consistent pattern — not just this file; the maintainer's stance is "per-request resolution, no shared state"); (2) Structural impact (every authenticated request inherits the per-call DB round-trip cost; cache-invalidation surfaces are deliberately absent); (3) Changing the stance (adding a session-scoped cache or a reactor-Context attribute) would be a STRUCTURAL change with new cache-invalidation contracts.

**Evidence**:
- AuthIdentityProviderImpl.md says: "the class is a 31-line lombok'd reactive chain with one private final field (the repository) — the absence of any state or cache annotation IS the architectural posture; the maintainer didn't add caching because the contract is 'resolve per-request, trust the DB'."
- Cross-codebase corroboration: `system-mission.md` documents the platform as "Spring Boot 3 / WebFlux reactive Java 17 application" — the stateless-reactive convention is platform-wide; this file is consistent.

**Existing ADR**: none. Composes with **ADR-CANDIDATE-015** (owner-scoped reads via reactor Context principal flow) — together they describe the per-request principal-resolution model: read context, read DB, no cache. Composes with **ADR-CANDIDATE-104** (OAuth2-only provider distinction) and **ADR-CANDIDATE-105** (single-Mono owner resolution) — the per-call cost is paid against the compound-key lookup.

**Cross-link gaps**:
- REFACTOR-274 NEW — no per-request memoization (a reactor-Context attribute carrying the resolved UserDto/OwnerPojo would eliminate the duplicate work).
- REFACTOR-240 (batch H) — `ReactivePolicyRepositoryImpl.getRolesPolicies` is on the RBAC hot path with no caching — same per-request DB round-trip pattern for the RBAC tier.

**Proposed action**: Promote to `adrs/drafts/auth-stateless-no-cache.md` (new ADR). Document the no-caching stance explicitly + the trade-off (no cache-invalidation surface vs per-request DB round-trip). Cross-link with ADR-CANDIDATE-015 and the per-request hot-path REFACTOR scopes (-274, -240). Note that REFACTOR-274 is a candidate for closing without breaking the ADR's contract — a per-REQUEST Context-attribute is bounded to one HTTP request and does not introduce a long-lived cache-invalidation surface.

**Severity rationale**: LOW — stylistic / convention decision; correctness preserved; performance gap measurable but bounded.

---

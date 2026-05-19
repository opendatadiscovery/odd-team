## ADR-CANDIDATE-077 — `AuthIdentityProvider` is consulted at the SERVICE tier, never the controller — principal resolution is a service-layer concern, controllers stay principal-naive

**Severity**: MEDIUM
**Classification**: promote
**Support count**: 4 sidecars (batch I — AlertService + DataEntityService + LineageService negative-case + earlier-batch positive cases via DataEntityRelationsServiceImpl)
**Axes present**: controllers, services

**Surfaced by**:
- `AlertServiceImpl.md:implicit_adrs[4]` ("Authentication context is consulted at the service, not the controller. The `AuthIdentityProvider` interface is used at lines 84 (`fetchAssociatedOwner` for `listByOwner`), 93 (same for `getTotals`), 117 (`getCurrentUser` for `updateStatus`), 235 (same for `listDependentObjectsAlerts`). The four read sites resolve the SecurityContext at service-layer entry; controllers do not handle the SecurityContext themselves.")
- `DataEntityServiceImpl.md:implicit_adrs[1]` (the `listAssociated` exemplar at line 213 `authIdentityProvider.fetchAssociatedOwner()`; the controller `DataEntityController.java:280` does not pass any Authentication parameter, only the path/query args — the service resolves the principal itself)
- `LineageServiceImpl.md:bugs_limitations_corner_cases[0]` (the NEGATIVE case: `LineageServiceImpl` has NO `AuthIdentityProvider` field — line 54-57 verified — yet still resolves the call internally; the controller `DataEntityController.java:255-281` does not pass Authentication either)
- cross-batch positive case: `DataEntityRelationsServiceImpl.java:25-39` (the canonical anchor-set pattern documented in batch G — `authIdentityProvider.fetchAssociatedOwner()` at line 26)

**Decision statement**: Across the `odd-platform-api` codebase, the principal resolution boundary is the **service tier, not the controller**. Controllers carry no `Authentication`, `Principal`, or `ServerWebExchange` parameter on their method signatures; they consume only the path/query/body args of the OpenAPI-generated `*Api` interface. When a service method needs to know who the caller is, it calls `authIdentityProvider.fetchAssociatedOwner()` or `authIdentityProvider.getCurrentUser()` INSIDE the service method's reactive chain — typically inside a `.flatMap(owner -> ...)`. The decision codifies:

- **(a)** Controllers are uniformly thin reactive proxies (per ADR-CANDIDATE-001) and remain free of authentication-context plumbing.
- **(b)** Principal resolution is centralised at one bean — `AuthIdentityProvider` — that wraps the reactor `Context` lookup. The service depends on the bean, not on `ServerWebExchange` or the security context directly.
- **(c)** The pattern enables clean three-layer testing: controllers can be unit-tested without a SecurityContext mock; services can be tested with an `AuthIdentityProvider` mock that returns a synthetic Owner; only WebFluxTest integration tests need the full security chain.
- **(d)** The CORRECT placement of principal resolution is at the SERVICE method that NEEDS it — not at the controller. When a service method doesn't need the principal (`AlertServiceImpl.listAll`, `LineageServiceImpl.getLineage`, `DataEntityServiceImpl.getDetails`), it doesn't resolve one — this is intentional and aligned with ADR-CANDIDATE-003 (read-collaborative posture).

The architectural alternative — passing the principal through the controller signature into the service — was deliberately not chosen. Evidence: not a single controller method in the codebase (across 18+ controller sidecars examined) carries an `Authentication` or `Principal` argument on its public signature. The pattern is uniform and load-bearing.

The Lineage sidecar surfaces the NEGATIVE case at primary source: `LineageServiceImpl` does NOT have an `AuthIdentityProvider` field (verified — line 54-57), in contrast to `DataEntityRelationsServiceImpl` which DOES (line 20). This absence is not a coding oversight — it is the architectural choice for a method that intentionally bypasses owner-scoping (per ADR-CANDIDATE-003). The decision codifies that **the presence of `AuthIdentityProvider` in a service is a positive signal that some method on that service is principal-aware**; its absence is a positive signal that the service is uniformly principal-naive.

**Wisdom test (3-question)**:
1. *Intentional?* YES — uniformly absent on controllers (zero controller methods have Authentication args across 18+ sidecars), uniformly present on services that need it (AlertServiceImpl, DataEntityServiceImpl listAssociated, DataEntityRelationsServiceImpl), uniformly absent on services that don't (LineageServiceImpl). The pattern's three-way uniformity is the intent anchor.
2. *Structural impact?* YES — affects controller signatures (no Authentication arg), service signatures (no Authentication arg either; the service resolves internally), test architecture (mock the AuthIdentityProvider bean, not the SecurityContext), and the consequence chain when a security architecture change happens (the AuthIdentityProvider implementation is the only place that needs to know about the WebFilter chain).
3. *Refactoring or structural?* STRUCTURAL — moving principal resolution to the controller would require changing every controller method signature in the codebase + breaking the OpenAPI-generated interface contract (the interface methods don't carry Authentication args either). Not a refactor.
→ ADR-CANDIDATE.

**Evidence**:
- `AlertServiceImpl.md` says: "`return authIdentityProvider.fetchAssociatedOwner().flatMap(o -> alertRepository.listByOwner(page, size, o.getId())).map(alertMapper::mapAlerts);` (lines 84-86) — the service resolves the owner BEFORE delegating to the repository, the controller never touches the SecurityContext"
- `DataEntityServiceImpl.md` says: "the deliberate presence of an OwnerPojo parameter on findByState (line 181-185) demonstrates the codebase knows how to thread the principal through; the absence of that parameter on every other list-shape method is therefore intentional, not omission."
- `LineageServiceImpl.md` says (negative case primary source): "LineageServiceImpl.java:87-122 (no AuthIdentityProvider import at line 19; no field at lines 54-57; no fetchAssociatedOwner call anywhere in the method body) vs DataEntityRelationsServiceImpl.java:20, 26 (the positive case)"

**Existing ADR**: composes with:
- **ADR-CANDIDATE-001** (controllers-as-delegates) — this ADR is the auth-side corollary: controllers stay thin AND principal-naive.
- **ADR-CANDIDATE-002** (centralised SECURITY_RULES) — authorization at the path-matcher layer; principal resolution at the service tier; the two together describe the security layering.
- **ADR-CANDIDATE-003** (read-collaborative GET-uniformly-authenticated) — explains the LineageServiceImpl negative case: when the architecture says "any authenticated user can read", the service doesn't need the principal.
- **ADR-CANDIDATE-015** (owner-scoped routes — `/my`, `/my/upstream`, `/my/downstream`) — the architecture for owner-scoped reads; principal resolution lives at the service via this ADR's pattern.
- **ADR-CANDIDATE-075** (Repositories take NO Principal/Authentication parameter) — the repository-side counterpart: owner-id flows as a Long parameter into repositories, having been resolved at the service.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-237 (existing — anchor-set defence-in-depth gap): the LineageServiceImpl negative case is now primary-source confirmed; the gap is the missing JOIN-side defence beyond the anchor-set computation.
- REFACTOR-225 (existing — anchor-set single-point-of-failure on the lineage variants of `/my`)
- REFACTOR-203 (existing — lineage cross-owner enumeration): the bypass of owner-scoping at LineageServiceImpl is the architecture (per ADR-CANDIDATE-003), not the gap; the gap is the live-doc silence about it.

**Proposed action**: Promote to `adrs/drafts/principal-resolution-at-service-tier.md` (new ADR). Document:
- The boundary: principal resolution lives at the service, not the controller.
- The AuthIdentityProvider bean as the singular abstraction; services depend on it, not on SecurityContext / ServerWebExchange.
- The negative-case signal: services with no AuthIdentityProvider field are intentionally principal-naive (LineageServiceImpl, the catalog-wide read paths).
- The positive-case signal: services with AuthIdentityProvider field are principal-aware on at least some methods (AlertServiceImpl, DataEntityRelationsServiceImpl).
- The compatibility-change calculus: a future maintainer adding owner-scoping to a read path adds `AuthIdentityProvider` to the service constructor + calls `fetchAssociatedOwner()` inside the method; they do NOT thread the principal through the controller.
- Cross-link with ADR-CANDIDATE-001 (thin controllers), ADR-CANDIDATE-002 (centralised SECURITY_RULES), ADR-CANDIDATE-015 (owner-scoped routes), ADR-CANDIDATE-075 (repositories take no Authentication).

**Severity rationale**: MEDIUM — pattern-shaping decision for every controller and service in the platform. Not load-bearing for security architecture (that's ADR-CANDIDATE-002), but structural for the testability and layering of every endpoint. A future maintainer who threads `Authentication` through a controller signature is violating this pattern.

---

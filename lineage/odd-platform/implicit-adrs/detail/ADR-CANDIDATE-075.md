## ADR-CANDIDATE-075 — Repositories take NO Principal/Authentication parameter — owner-scoping is caller-resolved at the service layer via `authIdentityProvider.fetchAssociatedOwner()`; owner-id flows as a Long parameter into sibling repositories that build the JOIN OWNERSHIP locally

**Severity**: HIGH
**Classification**: promote
**Support count**: 3 sidecars (this batch — Ownership explicit; DataEntity + Alert by absence pattern) + cross-batch ADR-CANDIDATE-015 (existing — Owner-scoped routes) context
**Axes present**: repositories, authorization

**Surfaced by**:
- `ReactiveOwnershipRepositoryImpl.md:implicit_adrs[4]` (the explicit "repository takes no principal" pattern with the architectural-separation enumeration of 12 JOIN OWNERSHIP sites across sibling repositories)
- `ReactiveDataEntityRepositoryImpl.md:concepts.invariants[5]` (no owner-scoping at repository — the interface signature lacks Authentication parameter)
- `ReactiveAlertRepositoryImpl.md:security.owner_scoping` ("the ownerId is passed in as a parameter; the repository trusts the caller to supply the CALLING USER's owner id")

**Decision statement**: ODD's reactive repositories carry **NO Principal / Authentication / ServerWebExchange** parameter on any method signature. Every method accepts only domain-typed arguments: `long id`, `OwnershipPojo pojo`, `Collection<Long>`, `String oddrn`, etc. Authentication is structurally invisible to the repository layer.

The owner-scoping responsibility chain is:
1. **WebFilter chain** resolves the OIDC principal from the request (per the SecurityConfiguration of the active auth mode).
2. **Service layer** consumes Reactor `Context` to extract the principal, then calls `authIdentityProvider.fetchAssociatedOwner()` (per ADR-CANDIDATE-015) to resolve the user's owner-id via `user_owner_mapping`.
3. **Service layer passes the resolved owner-id as a `Long` parameter** into the sibling repository that owns the primary entity's table.
4. **Sibling repository builds the JOIN OWNERSHIP locally** — e.g. `ReactiveDataEntityRepositoryImpl.listByOwner(ownerId, ...)` builds `JOIN OWNERSHIP ON DATA_ENTITY.ID = OWNERSHIP.DATA_ENTITY_ID WHERE OWNERSHIP.OWNER_ID = ?` (lines 526-527).

The architectural separation makes `ReactiveOwnershipRepository` purely the storage gateway for the OWNERSHIP row; **the owner-scoping JOIN responsibility lives at the primary-entity repository, not at the OwnershipRepository.** A grep across the repository layer surfaces 12 JOIN OWNERSHIP sites — across `ReactiveAlertRepositoryImpl`, `ReactiveSearchEntrypointRepositoryImpl`, `ReactiveSearchFacetRepositoryImpl`, `ReactiveActivityRepositoryImpl`, `ReactiveDataQualityRunsRepositoryImpl`, `ReactiveDataEntityRepositoryImpl`, `ReactiveDatasetFieldRepositoryImpl`, `DataCollaborationRepositoryImpl`, `AlertNotificationMessageTranslator`. NONE of these JOINs originate from `ReactiveOwnershipRepository`.

The decision codifies:
- **(a)** Repositories are AUTH-INVISIBLE. A repository can be invoked from any caller (service, scheduled job, test, future ingestion-driven path) without needing a security context. Test code can construct mock OwnershipPojo instances and exercise the CRUD; production code resolves the owner-id elsewhere.
- **(b)** Owner-scoping is a SERVICE-LAYER responsibility. The service composes principal-resolution + owner-id-resolution + parameter-passing; the repository receives plain Longs and builds SQL.
- **(c)** Cross-entity JOIN OWNERSHIP is OWNED BY THE PRIMARY-ENTITY REPOSITORY. Alert's owner-scoped reads JOIN OWNERSHIP in `ReactiveAlertRepositoryImpl` itself (line 165-167); DataEntity's owner-scoped reads JOIN OWNERSHIP in `ReactiveDataEntityRepositoryImpl` (lines 526-527). Each primary-entity repository embeds the JOIN locally rather than delegating to `ReactiveOwnershipRepository`. The asymmetry is deliberate: a repository owns its primary table; sibling repositories embed the JOIN.
- **(d)** The pattern implies a TRUST BOUNDARY: the repository trusts the caller to pass the correct owner-id. A direct caller (test, admin tool, future endpoint that bypasses authIdentityProvider) supplying a different owner's id would read across owners. The trust is structurally enforced by the absence of any other principal-resolution mechanism — the repository CAN'T resolve the principal itself, so it can't validate. The service layer IS the single point of enforcement.

**Wisdom test**: PASS. All three questions resolve toward ADR:
1. *Intentional?* YES — the consistent absence of Authentication parameters across every repository in this batch (5 repositories, 90+ method signatures) is documentation-as-code. The cross-batch ADR-CANDIDATE-015 (existing) is the corollary at the controller layer ("controllers don't read Authentication; the service does"). The repository-layer pattern is the deeper architectural commitment.
2. *Structural impact?* YES — affects every repository's signature (parameter-only, never principal), every service's composition shape (resolve-then-pass), every test's setup (no security mock needed at repository tests), every future endpoint's wiring discipline (service must resolve principal before calling repository).
3. *Refactoring or structural?* STRUCTURAL — switching to "every repository takes Authentication" would change every signature, every test, every wiring point. The absence of Authentication is the architecture.
→ ADR-CANDIDATE.

**Evidence**:
- `ReactiveOwnershipRepositoryImpl.md` says: "Repository takes no principal — all owner-id parameters arrive pre-resolved at the service layer. Every method signature is `(long)` / `(OwnershipPojo)` / `(Collection<OwnershipPojo>)` / `(long, long)` only — no `Authentication`, no `Principal`, no `Owner`, no `ServerWebExchange`. The class is `@Repository @RequiredArgsConstructor` (lines 27-28), not a Spring Security `@Configuration` and not an auth-aware bean."
- `ReactiveOwnershipRepositoryImpl.md` says: "The architectural separation: `ReactiveOwnershipRepository` owns CRUD on the `ownership` row; other repositories own the read-side JOIN against `ownership` when filtering their primary entity by owner. The asymmetry is deliberate and consistent: a repository owns its primary table; sibling repositories embed the JOIN OWNERSHIP into their own queries rather than calling into this repository for it."
- `ReactiveDataEntityRepositoryImpl.java:526-527` — the canonical JOIN OWNERSHIP site for /my reads
- `ReactiveAlertRepositoryImpl.java:165-167` — Alert's owner-scoped reads embedding JOIN OWNERSHIP locally
- Grep enumeration of 12 JOIN OWNERSHIP sites across the repository layer (none in ReactiveOwnershipRepositoryImpl)

**Existing ADR**: composes with **ADR-CANDIDATE-015** (existing — Owner-scoped routes). ADR-CANDIDATE-015 documents the controller-layer corollary ("controllers don't take Authentication; the service resolves via Reactor Context"). This ADR is the repository-layer COROLLARY: the same trust pattern extended one layer deeper. The two ADRs together describe the full authorization plumbing:
- Controller: Reactor Context for principal access (ADR-CANDIDATE-015).
- Service: principal → owner-id resolution via authIdentityProvider (ADR-CANDIDATE-015).
- Repository: owner-id as plain Long parameter; JOIN OWNERSHIP locally (this ADR).

Composes with:
- ADR-CANDIDATE-067 (existing — `@ReactiveTransactional` boundary asymmetry) — both ADRs describe the service-layer's coordinating role between controllers and repositories.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-225 (existing — anchor-set single-point-of-failure on lineage `/my` variants).
- REFACTOR-237 (NEW — SQL-layer confirmation of REFACTOR-225; the missing defence-in-depth at the lineage CTE).
- The pattern's INHERENT RISK: a regression in `authIdentityProvider.fetchAssociatedOwner()` propagates undetected across every repository that consumes its output. There is no defence-in-depth at the repository layer. This is the documented trust boundary — accept-the-risk.

**Proposed action**: Promote to `adrs/drafts/repositories-take-no-principal.md` (new ADR). Document:
- The pattern (no Authentication parameter on repository methods).
- The owner-scoping chain (WebFilter → service → owner-id → JOIN OWNERSHIP at primary-entity repository).
- The trust boundary (service is the single point of principal-resolution; repository trusts the caller).
- The architectural separation (OwnershipRepository owns the row; sibling repositories embed the JOIN).
- The implication for tests (repository tests don't need security setup; service tests carry the security mocks).
- The cross-link with ADR-CANDIDATE-015 (the two-ADR family describing authorization plumbing).
- The price (no defence-in-depth at the repository — see REFACTOR-225 / -237).

Cross-link with ADR-CANDIDATE-001 (controller-layer thin-proxy) and ADR-CANDIDATE-067 (service-layer transactional boundary) — the three-ADR family that describes the layered architecture.

**Severity rationale**: HIGH — codebase-wide authorization architecture. Affects every repository's signature, every service's composition shape, every test's setup, every future endpoint's wiring discipline. The pattern is load-bearing: a future maintainer who adds a new repository or refactors an existing one must follow this convention or break the architecture. Compatible-change calculus requires understanding this ADR.

---

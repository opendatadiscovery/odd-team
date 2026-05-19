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

## STRENGTHENS — TermServiceImpl + OwnershipServiceImpl + AuthIdentityProviderImpl (batch K — SERVICE-LAYER triangulation)

**Triple service-layer confirmation that the trust boundary lives at the SERVICE LAYER, not at the repository**. Three new batch-K service-tier sidecars confirm the corollary: services consume `authIdentityProvider.fetchAssociatedOwner()` (or DON'T consume it — see TermServiceImpl + OwnershipServiceImpl gaps below) and pass the owner-id as a parameter into sibling repositories. The defence-in-depth ABSENCE at the repository layer (ADR-CANDIDATE-075's accept-the-risk clause) is now triangulated against three NEW service-layer findings.

**New batch-K evidence**:

1. **AuthIdentityProviderImpl.md (PRIMARY-SOURCE chokepoint)** — the service that PRODUCES the owner-id:
   - `implicit_adrs.[0]` (HIGH): "Per-request principal resolution flows through reactor Context, not method parameters. ... the public contract on `AuthIdentityProvider.java:8-14` is three parameter-less Mono returns — no API accepts an Authentication argument; the maintainer's design choice is that the principal is ALWAYS read from the reactor Context, never threaded through method signatures." (15-callsite blast radius enumerated)
   - This sidecar is the upstream architectural anchor for the entire owner-scoping plumbing.

2. **TermServiceImpl.md** — confirms the trust-boundary RISK at the service layer (where defence-in-depth could live but doesn't):
   - `security.authorization_assertions: []` — explicit absence. `TermServiceImpl` performs NO service-tier permission checks. All authorization is supposed to happen at the controller perimeter via `SecurityConstants.SECURITY_RULES` matchers; the service tier blindly trusts the call.
   - Cross-link: per REFACTOR-217 path-mismatch (`/term` vs `/terms`), the controller-tier gate does NOT fire for `POST /api/dataentities/{id}/terms` and `DELETE /api/dataentities/{id}/terms/{term_id}` — making the entire term-linkage surface effectively unauthenticated-mutation-allowed. The service-tier defence-in-depth ABSENCE (NEW REFACTOR-263 in batch K) means the path-mismatch is the SOLE control.
   - This is the load-bearing batch-K observation: when controller-tier authorisation is broken (REFACTOR-217), there is NO service-tier safety net (REFACTOR-263 NEW) because the pattern THIS ADR endorses (auth-at-service, not at repository) is itself not exercised at the service tier — Term mutations have no `permissionService.hasPermission(...)` calls. The pattern's "service is single point of enforcement" wording presumes the service ACTUALLY enforces; for Term endpoints it does not.

3. **OwnershipServiceImpl.md** — confirms the trust-boundary at owner-DIRECTORY mutations:
   - `concepts.invariants.[1]`: "**No service-tier permission gate** — the class is `@Service @RequiredArgsConstructor` only (lines 35-37); there is no `@PreAuthorize`, no programmatic `permissionService.hasPermission(...)`, no `@Secured`. Authorization is enforced upstream at `SecurityConstants.SECURITY_RULES[215-227]`. The service is **architecturally outside** the auth path."
   - Cross-link: `OwnershipServiceImpl` IS the auto-create-on-miss vector (REFACTOR-199 batch F / batch K primary-source) — the architectural decoupling means an authorised `DATA_ENTITY_OWNERSHIP_CREATE` holder bypasses `OWNER_CREATE`.

**Architectural refinement**: The original ADR-CANDIDATE-075 claim "owner-scoping is caller-resolved at the SERVICE LAYER" is sharpened by the batch-K observation that the service layer does NOT uniformly perform AUTHORISATION (the principal-resolution chokepoint at AuthIdentityProvider IS at the service layer; the per-resource permission checks generally are NOT). The TRUST BOUNDARY claim in the ADR is therefore: services trust the WebFilter chain + SecurityConstants.SECURITY_RULES matcher chain to have already authorised the call BEFORE entering the service; the service consumes the principal-Mono only to RESOLVE owner-id for owner-scoped reads (not to AUTHORISE). The two functions (resolve-principal vs check-permission) live in different layers: principal at the service via AuthIdentityProvider; permission at the WebFilter chain via SecurityConstants + DataEntityPermissionExtractor.

**Cross-batch evidence stack**:
- Controller layer (ADR-CANDIDATE-015): no `Authentication` parameter; reactor `Context` is the principal carrier.
- Service-principal-resolution layer (ADR-CANDIDATE-015 STRENGTHENED via batch K AuthIdentityProviderImpl primary-source): `fetchAssociatedOwner` reads reactor `Context`, resolves owner-id.
- Service-business-logic layer (BATCH K refinement via TermServiceImpl + OwnershipServiceImpl): NO programmatic permission checks; trusts upstream WebFilter + SecurityConstants enforcement.
- Repository layer (this ADR): no `Authentication` parameter; owner-id is a `Long`.

**New batch-K refactoring scopes** (the defence-in-depth ABSENCES this ADR's trust-boundary accepts):
- REFACTOR-263 NEW — TermServiceImpl has ZERO service-tier permission checks; defence-in-depth absence (HIGH; combined with REFACTOR-217 path-mismatch, this is the COMPOUNDING failure mode where both the primary gate AND the absence of a secondary gate together produce the cross-owner-mutation surface)
- REFACTOR-225/237 (batch H/I) already covers the lineage anchor-set defence-in-depth absence.
- REFACTOR-199 / REFACTOR-206 — Owner / Title auto-create bypass the dedicated `OWNER_CREATE` / `TITLE_CREATE` gates because OwnershipServiceImpl has no service-tier permission check on the directory growth.

**Severity unchanged**: HIGH (codebase-wide authorization architecture). The batch-K strengthening makes the price clearer: the architecture pays the cost of TWO complete failure modes — (a) WebFilter / SecurityConstants drift bypasses gating (REFACTOR-217); (b) service-tier defence-in-depth absence means the failure has no second line. Both are visible only when the gate fails — defence-in-depth at the service layer would surface (a) faster.

## STRENGTHENS — Batch M (`getMyObjectsWithUpstream` + `getMyObjectsWithDownstream` — `listByOddrns` PRIMARY-SOURCE for owner-agnostic-by-design repository methods)

**Primary-source confirmation at `ReactiveDataEntityRepositoryImpl.listByOddrns(Collection<String>, boolean, boolean, Integer, Integer)` (lines 228-253)** — the repository method that batch M's lineage-variant `/my*` endpoints route through is the canonical example of an **owner-agnostic-by-design** repository method. The architectural choice is deliberate: `listByOddrns` is reused across many call sites (lineage tab, group-lineage, search results materialisation) with different scoping rules, so folding owner-scoping into it would couple the method to a specific use case. The design is consistent with this ADR's architectural separation.

**New batch-M evidence**:

1. **`getMyObjectsWithUpstream.md:implicit_adrs.[2]`** (HIGH): "**No defence-in-depth at the derived-set SQL retrieval — `listByOddrns` is owner-agnostic by design.** `ReactiveDataEntityRepositoryImpl.listByOddrns` at lines 228-253 is a generic `WHERE DATA_ENTITY.ODDRN IN (?, ?, ...)` scan with no JOIN against OWNERSHIP. The architectural choice: the input oddrn set is **assumed to be already correctly-scoped** by the caller. This is a deliberate design — `listByOddrns` is reused by many call sites (e.g. lineage tab, group-lineage, search results materialisation) that have different scoping rules; folding owner-scoping into the method would couple the method to a specific use case. The trade-off: the lineage-variant endpoints have NO JOIN-side defence-in-depth — the owner-scoping invariant is single-point-of-failure at `fetchAssociatedOwner` (REFACTOR-225). The base `/my` endpoint uses a DIFFERENT repository method (`listByOwner`, `ReactiveDataEntityRepositoryImpl.java:515-534`) that DOES JOIN OWNERSHIP — the inconsistency between the two paths is itself the architectural finding."

2. **The contrast in repository-method choice**: ReactiveDataEntityRepositoryImpl exposes BOTH `listByOwner` (with JOIN OWNERSHIP — for owner-scoped consumers) AND `listByOddrns` (without JOIN OWNERSHIP — for caller-already-scoped consumers). The two methods serve different architectural patterns: `listByOwner` for endpoints that compute "what does this user own?" at the repository layer; `listByOddrns` for endpoints that compute the oddrn set at the service layer (anchor + expand + filter, per ADR-CANDIDATE-117 NEW) and then materialise the rows. The maintainer's intent: the repository is owner-agnostic by default; per-use-case owner-scoping is the service's responsibility (per this ADR's claim).

3. **`getMyObjectsWithDownstream.md` confirms symmetrically**: "the controller method carries no `@PreAuthorize`, no `@Secured`, no programmatic `permissionService.hasPermission(...)` call at the controller, the generated `DataEntityApi` interface, the service, the relations service, the lineage repository, or the data-entity repository. The only access control is the SecurityWebFilterChain's `.authenticated()` fallback in `AuthorizationCustomizer.java:29-30`. The owner-scoping is purely data-shape (anchor-set + downstream filter); the authorization framework's permission gates are not applied."

**Architectural refinement**: The original ADR-CANDIDATE-075 claim about "auth-invisible repositories" gains a sharper edge in batch M — the `listByOddrns` method is the canonical example of the architecture's deliberate trade-off. The maintainer COULD have written a `listByOddrnsAndOwner(oddrns, ownerId)` variant or added a `Long ownerId` parameter to `listByOddrns` to make the lineage-variant endpoints defended-in-depth at the SQL layer. The maintainer DID NOT — `listByOddrns` stays generic, and the lineage variants' owner-scoping lives entirely at the service-layer anchor set. The ADR's trust-boundary claim is concretely demonstrated: the repository is owner-agnostic-by-design; the service is the single point of enforcement; the price is REFACTOR-225 (no SQL-side defence-in-depth at the listByOddrns layer for the lineage-variant endpoints).

**New batch-M refactoring scopes** (the defence-in-depth ABSENCES this ADR's architecture accepts):
- REFACTOR-225 STRENGTHENED — anchor-set defence-in-depth absence; controller-method PRIMARY-SOURCE for both UPSTREAM and DOWNSTREAM siblings; the gap is the missing JOIN-side filter at `listByOddrns` for owner-scoped consumers.
- REFACTOR-346 NEW — in-memory derivation + anchor-set materialisation defeats SQL pagination on `/my/upstream` and `/my/downstream`.
- REFACTOR-347 NEW — `listByOddrns` pagination has no ORDER BY → unstable pagination across consecutive page reads.

**Cross-batch evidence stack** (now 5-layer):
- Controller layer (ADR-CANDIDATE-015): no `Authentication` parameter; reactor `Context` is the principal carrier.
- Service-principal-resolution layer (ADR-CANDIDATE-015 STRENGTHENED via batch K AuthIdentityProviderImpl primary-source): `fetchAssociatedOwner` reads reactor `Context`, resolves owner-id.
- Service-business-logic layer (BATCH K refinement via TermServiceImpl + OwnershipServiceImpl): NO programmatic permission checks; trusts upstream WebFilter + SecurityConstants enforcement.
- Service-anchor-set composition layer (BATCH M NEW via DataEntityRelationsServiceImpl): anchor + expand + filter; the service-layer owner-id resolution is the ONLY scoping site.
- Repository layer (this ADR): no `Authentication` parameter; owner-id is a `Long`; `listByOddrns` is owner-agnostic by design (BATCH M PRIMARY-SOURCE).

**Severity unchanged**: HIGH (codebase-wide authorization architecture). The batch-M strengthening makes the architectural separation concrete at the repository-method choice (`listByOwner` vs `listByOddrns`) and binds the gap (REFACTOR-225) to the ADR's accept-the-risk clause.

## STRENGTHENS — Batch N (Term + Tag + Role + UserOwnerMapping primary-source — 4 NEW REPOSITORY confirmations across the RBAC + glossary + tag surfaces; the JOIN-source primary location anchor moves to ReactiveUserOwnerMappingRepositoryImpl)

**Four batch-N repository sidecars confirm the auth-invisible-repository pattern at the repositories that produce / consume the owner-id**:

1. **ReactiveUserOwnerMappingRepositoryImpl (PRIMARY-SOURCE for the owner-scoping mechanism's JOIN source)** — this batch's most architecturally-foundational sidecar:
   - `implicit_adrs.[3]` (HIGH): "Service-layer-agnostic persistence — every business rule lives upstream. This file enforces NO business rules: no permission checks, no role-validation, no provider-string validation ... no audit-log emission, no error wrapping ... The maintainer's intent: this repository is policy-agnostic; UserOwnerMappingServiceImpl is the policy boundary. ... The design payoff: the partial unique indexes and the case-sensitive .eq() predicates are the LOAD-BEARING invariants — a service-layer regression that bypassed the service layer (e.g., a future fast-path that called the repository directly) would still be caught by the DB-side enforcement."
   - `security.owner_scoping`: "RESPECTS — this repository IS the persistence-layer enforcement of the owner-scoping mechanism. Every owner-scoped read in the platform consumes the OwnerPojo this repository's `getAssociatedOwner` returns (via AuthIdentityProvider.fetchAssociatedOwner). The case-sensitive `.eq()` predicates AT lines 119 and 122 are the SQL-layer load-bearing component of the entire defence-in-depth anchor-set pattern documented in ADR-CANDIDATE-015 (DataEntityController.getMyObjects sidecar)."
   - **Architectural-anchor shift**: prior batches treated `AuthIdentityProviderImpl.fetchAssociatedOwner` as the chokepoint; batch N PRIMARY-SOURCES the SQL-layer producer of the owner-id at `ReactiveUserOwnerMappingRepositoryImpl.getAssociatedOwner` (lines 76-85). The two-table JOIN `USER_OWNER_MAPPING JOIN OWNER ON OWNER_ID = OWNER.ID WHERE OIDC_USERNAME = ? AND DELETED_AT IS NULL AND (PROVIDER = ? OR PROVIDER IS NULL)` is the SQL embodiment of the architectural triangle (with ADR-CANDIDATE-130 NEW providing the provider-null vertex). The 17 invocations from AuthIdentityProviderImpl.fetchAssociatedOwner's blast radius all funnel through this single repository method.

2. **ReactiveTermRepositoryImpl** — confirms the pattern at the Term-glossary surface:
   - `implicit_adrs.[3]` (HIGH): "Business invariants (rename-protection / delete-protection guards, duplicate-name pre-check, namespace side-channel creation, FTS vector refresh orchestration) live in `TermServiceImpl` — the repository is intentionally a thin, dumb persistence shell. ... This is consistent with the package layout: `repository.reactive.*` for persistence, `service.term.*` for business invariants. The repository pattern is uniform across the codebase (cross-ref `ReactivePolicyRepositoryImpl.md` ADR-3: 'Repository CRUD is policy-AGNOSTIC at the persistence layer')."
   - `security.owner_scoping`: "N/A — Terms are platform-global, not owner-scoped" — Term reads do NOT JOIN OWNERSHIP; the cross-namespace exposure surface is documented at REFACTOR-024-family scopes (read-collaborative posture). The Term repository is the maintainer-extension example of "auth-invisible AND owner-agnostic" — no JOIN OWNERSHIP at all.

3. **ReactiveTagRepositoryImpl** — confirms the pattern at the tag-directory surface:
   - `security.authorization_assertions: []` — "repository performs zero authorization checks. The class trusts the caller to have already evaluated permissions. The 18 method contract surfaces would, if mistakenly invoked from an unauthorised path, write directly to the `tag` directory or the relation tables with no native defence. The architectural assumption is that `SecurityConstants.SECURITY_RULES` covers every controller path that reaches here."
   - `security.owner_scoping: N/A` — Tag directory has no owner concept; flat globally-shared namespace by design. Confirms the auth-invisible-AND-owner-agnostic shape at the second non-owner-scoped surface.

4. **ReactiveRoleRepositoryImpl** — confirms the pattern at the RBAC role-mutation surface:
   - `implicit_adrs.[3]` (HIGH): "Repository CRUD is role-AGNOSTIC at the persistence layer — there is NO Administrator-name protection, NO User-role-name protection, NO owner-binding cascade check inside the repository. All those invariants live in the SERVICE layer (RoleServiceImpl). The repository is intentionally a thin, dumb persistence shell; business invariants are owned by the service. This is the consistent pattern across every Reactive*Repository in the codebase — and the structural mirror of batch-H's same finding on ReactivePolicyRepositoryImpl."
   - The Role primary-source mirror joins the batch-H Policy primary-source to confirm the pattern at BOTH halves of the RBAC mutation surface — Role-and-Policy are both auth-invisible repositories with service-layer-only business invariants.

**Architectural refinement (batch N)**: The original ADR-CANDIDATE-075 claim is now triangulated against SIX repository primary-sources (Ownership + DataEntity + Alert from the original batch; Term + Tag + Role + UserOwnerMapping from batch N). The pattern is verifiably consistent: every repository in the platform extends `ReactiveAbstractCRUDRepository` or `ReactiveAbstractSoftDeleteCRUDRepository`, takes only domain-typed parameters, performs zero authorization checks, and trusts the upstream service. The 12 JOIN OWNERSHIP sites enumerated in the original batch are now joined by ZERO JOIN OWNERSHIP sites in Term / Tag / Role / UserOwnerMapping (because the latter four are NOT owner-scoped data — Terms are platform-global, Tags are globally-shared, Roles are platform-global, UserOwnerMapping IS the JOIN source itself). The architectural separation is the universal repository discipline.

**Architectural refinement (batch N — JOIN-source PRIMARY LOCATION)**: Where prior batches centred the architectural anchor on `AuthIdentityProviderImpl.fetchAssociatedOwner` (the producer), batch N's primary-source at `ReactiveUserOwnerMappingRepositoryImpl.getAssociatedOwner` (the SQL embodiment) is the SECOND vertex of the same architecture. The chain is now: principal (Reactor Context) → fetchAssociatedOwner (service) → getAssociatedOwner (repository SQL) → OwnerPojo (return type) → owner-id (Long passed to sibling repositories' JOIN OWNERSHIP). The case-sensitive `.eq()` at line 119 of ReactiveUserOwnerMappingRepositoryImpl is THE point at which the principal's username string becomes a concrete owner-id; the SQL-side correctness invariants documented in ADR-CANDIDATE-130 NEW (provider-null collapse) AND in the new REFACTOR-353/354/355 family are ALL grounded at this method.

**New batch-N refactoring scopes** (the defence-in-depth ABSENCES this ADR's architecture accepts AT the JOIN-source primary-location):
- REFACTOR-353 NEW — PROVIDER-NULL CROSS-MODE BLEED at the SQL embodiment of fetchAssociatedOwner; the case-sensitive .eq() + provider-null collapse means LOGIN_FORM/LDAP/S2S share identity.
- REFACTOR-354 NEW — S2S username='ADMIN' literal collision via provider=null bucket.
- REFACTOR-355 NEW — Cross-provider username display collision in external JOINs (Alert/Activity/OwnerAssociationRequest/Owner repositories LEFT JOIN on OIDC_USERNAME only; row-duplication on cross-provider collision).
- REFACTOR-357 NEW — Role.getDto/listDto/getByName don't filter soft-deleted policies on LEFT JOIN; symmetric mirror of batch-H REFACTOR-230 (Policy-side).
- REFACTOR-368 NEW — RBAC forensic-silence on role mutations strengthens REFACTOR-188 (now 4-sidecar across controllers/services/repositories).
- REFACTOR-386 NEW — Role service-bypassing update silent no-op on soft-deleted role (mirror of batch-H Policy DRIFT-FACET-D).

**Cross-batch evidence stack** (now 6-layer):
- Controller layer (ADR-CANDIDATE-015): no `Authentication` parameter; reactor `Context` is the principal carrier.
- Service-principal-resolution layer (ADR-CANDIDATE-015 STRENGTHENED via batch K AuthIdentityProviderImpl primary-source): `fetchAssociatedOwner` reads reactor `Context`, resolves owner-id.
- Service-business-logic layer (BATCH K refinement via TermServiceImpl + OwnershipServiceImpl): NO programmatic permission checks; trusts upstream WebFilter + SecurityConstants enforcement.
- Service-anchor-set composition layer (BATCH M NEW via DataEntityRelationsServiceImpl): anchor + expand + filter; the service-layer owner-id resolution is the ONLY scoping site.
- Repository owner-id-producer layer (BATCH N NEW PRIMARY-SOURCE via ReactiveUserOwnerMappingRepositoryImpl.getAssociatedOwner): the SQL embodiment of the principal→owner-id resolution; case-sensitive `.eq()` + provider-null branch IS the architectural triangle.
- Repository owner-id-consumer layer (this ADR): no `Authentication` parameter; owner-id is a `Long`; `listByOddrns` is owner-agnostic by design; `listByOwner` JOINs OWNERSHIP locally.

**Severity unchanged**: HIGH (codebase-wide authorization architecture). The batch-N strengthening adds the JOIN-source primary-location to the chain — the architecture is now traced from the principal at the WebFilter all the way to the SQL .eq() that produces the owner-id. Every gap surface (REFACTOR-353/354/355 + 357/368/386) is documented at the SQL-embodiment layer.

---

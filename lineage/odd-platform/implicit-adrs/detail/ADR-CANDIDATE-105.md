## ADR-CANDIDATE-105 — Single-Mono owner resolution (Mono not Flux) — `fetchAssociatedOwner` returns `Mono<OwnerPojo>`; the architectural invariant is "one user maps to AT MOST one active Owner" enforced application-side via clear-active-then-insert pattern

**Classification**: promote
**Severity**: MEDIUM
**Pillars affected**: [P-09-security-access-control, P-08-management-administration]
**Support**: surfaced by 1 sidecar (`AuthIdentityProviderImpl`) — primary-source; doc-confirmed verbatim on the live user-owner-association page
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__AuthIdentityProviderImpl.md:implicit_adrs.[2]` (HIGH confidence) — "Single-Mono owner resolution (not Flux) — one user, at most one active Owner. `fetchAssociatedOwner` returns `Mono<OwnerPojo>` (line 50) chained via `flatMap` to a `Mono` return from the repository (ReactiveUserOwnerMappingRepositoryImpl.java:83 uses `jooqReactiveOperations.mono`, not `.flux`)."

**Decision statement**: The platform's identity contract binds AT MOST ONE active Owner to any (oidc_username, provider) tuple. The contract is encoded in two reinforcing places: (a) the public API at `AuthIdentityProvider.fetchAssociatedOwner(): Mono<OwnerPojo>` returns a single Mono — multi-Owner support would be `Flux<OwnerPojo>`; (b) the application-side cleanup at `ReactiveUserOwnerMappingRepositoryImpl.deleteActiveRelationByOwner` (`ReactiveUserOwnerMappingRepositoryImpl.java:65-74`) clears any existing active row for the (username, provider) before INSERTing a new one — keep-at-most-one-active row per tuple. The DB schema does NOT enforce the invariant via a partial unique index; the application-side clear-then-insert pattern is the only guarantor. The architectural posture: simplicity at the consumer level (every owner-scoped read filters on a single owner-id, not on `IN (owner_ids)`); the trade-off is operator-facing — "one user = one owner" is the documented model per the live page, and operators wanting multi-team membership must work around it.

**Wisdom test**: PASS. (1) Deliberate (the Mono return type is the contract — if multi-owner were intended, this would be Flux and downstream owner-scoped reads would consume `IN (...)` predicates; doc-side confirmation is verbatim: "One user can be associated only with one owner and vice versa" per the live user-owner-association doc WebFetched 2026-05-19 status 200); (2) Structural impact (every owner-scoped consumer's SQL — `WHERE OWNERSHIP.OWNER_ID = ?` not `IN ?` — depends on this invariant; 15+ callsites affected); (3) Changing the shape (Flux + multi-owner) would be a STRUCTURAL change cascading through the entire owner-scoping surface.

**Evidence**:
- AuthIdentityProviderImpl.md says: "`Mono<OwnerPojo> fetchAssociatedOwner();` — the return type is the contract; if multi-owner were intended, this would be `Flux<OwnerPojo>` and downstream owner-scoped reads would consume `IN (...)` predicates."
- AuthIdentityProviderImpl.md says (doc anchor): "the live doc anchor 'one user can be associated only with one owner and vice versa' (WebFetched 2026-05-19 status 200)" + "the schema relies on application-side cleanup at `deleteActiveRelationByOwner` (ReactiveUserOwnerMappingRepositoryImpl.java:65-74) to keep at most one active row per (oidc_username, provider)"

**Existing ADR**: none. Composes with **ADR-CANDIDATE-104** (NEW — OAuth2-only provider distinction) — together they define the identity contract: at most one Owner per (oidc_username, provider) tuple. Composes with **ADR-CANDIDATE-015** (owner-scoped routes via reactor Context) — the Mono is the principal-resolution primitive ADR-CANDIDATE-015's `/my*` routes consume. Composes with **ADR-CANDIDATE-049** (identity-decoupled Owner directory CRUD) — the directory-CRUD is decoupled, but the user→owner association produced by `OwnerAssociationRequest` flow honors this single-Mono invariant.

**Cross-link gaps**:
- REFACTOR-247 NEW — no auto-create of Owner on OAUTH2/LDAP first login; the Mono is empty for unmapped users.
- REFACTOR-248 NEW — empty SecurityContext silently propagates rather than fail-fast.

**Proposed action**: Promote to `adrs/drafts/auth-single-owner-per-user.md` (new ADR). Document the at-most-one-active-Owner invariant explicitly with the doc-side quote and the application-side enforcement (`deleteActiveRelationByOwner` clear-then-insert). Cross-link with ADR-CANDIDATE-104, ADR-CANDIDATE-015, and ADR-CANDIDATE-049. The DB-level partial unique index is a maintainer-followup decision (defence-in-depth for the application-side invariant).

**Severity rationale**: MEDIUM — identity-contract architecture decision; affects every owner-scoped consumer's SQL shape and the operator-facing "one user = one owner" mental model.

---

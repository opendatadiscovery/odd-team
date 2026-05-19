## REFACTOR-254 — `DataEntityServiceImpl.listAssociated` returns empty Flux silently when caller has no associated Owner — operator-UX trap (companion to REFACTOR-224)

**Severity**: LOW
**Category**: ux-bug
**Surfaced by**:
- `DataEntityServiceImpl.md:bugs_limitations_corner_cases[4]`

**Description**: `DataEntityServiceImpl.listAssociated` (lines 212-225) is the service backing the `/my` data-entity listing — it filters the catalog to entities owned by the calling user's associated Owner. The pattern:

```java
return authIdentityProvider.fetchAssociatedOwner()
  .flatMapMany(owner -> repository.listByOwner(owner.getId(), page, size));
```

`authIdentityProvider.fetchAssociatedOwner()` returns `Mono.empty` for users WITHOUT a user-owner mapping (per `UserOwnerMappingRepository.getAssociatedOwner` returning empty when no row exists for the username, inferred from `AuthIdentityProviderImpl.java:50-53`). The downstream `.flatMapMany` never fires → the caller sees `Flux.empty()` → the controller returns `200 OK` with an empty `DataEntityList`.

No error, no 404, no "no associated owner" signal. A user navigating to "My Objects" sees an empty page with no indication that the underlying issue is account-association, not absence of data. The user can't tell:
- "I have no entities in my Owner's portfolio" (which is fine, they're new)
- "I have no Owner association at all" (which is a problem they should fix in account settings)
- "My Owner has been soft-deleted out of band" (which is a problem operators should see)

This is the same shape as REFACTOR-224 (`getMyObjects` returns silent empty Flux for unlinked users — already in the index from a prior batch). The present finding is the SAME PATTERN at a different surface (listAssociated vs getMyObjects); both are surfaces of the same underlying class of bug. The fix shape would be uniform: detect the no-owner case at the service tier and either (a) return 404 ("no Owner association"), or (b) return a richer response payload that signals the empty-vs-no-owner distinction.

**Primary source citations**:
- `DataEntityServiceImpl.java:212-225` — the no-empty-handling chain
- `AuthIdentityProviderImpl.java:50-53` — the upstream Mono.empty source on no association
- cross-reference REFACTOR-224 (the original finding at the `getMyObjects` surface)

**Existing-ADR-or-implied-prescription**: composes with REFACTOR-224's existing prescription. The fix should be unified at the AuthIdentityProvider level — a single "no associated owner" handler that propagates a typed marker (rather than empty) to differentiate from the legitimate-empty case.

**Proposed remedy**: Three composable fixes:
1. **Service-tier `switchIfEmpty(Mono.error(new NoAssociatedOwnerException(...)))`** — convert the missing-owner case to a typed exception; map to 404 with body `{"error": "NO_ASSOCIATED_OWNER", "message": "User has no associated Owner. Configure account → Owners to bind to an Owner."}` at the controller boundary.
2. **Richer response shape** — wrap the response in `MyObjectsResponse { entities: List<DataEntityRef>, ownerAssociation: AssociationStatus }` where AssociationStatus distinguishes ASSOCIATED, NOT_ASSOCIATED, ASSOCIATION_PENDING.
3. **UI affordance** — the UI's "My Objects" page should display a banner when the owner-association is missing, pointing users to the association settings.

Option (1) is the simplest backend fix; option (2) is the cleanest API contract; option (3) is the operator-UX affordance.

**Severity rationale**: LOW — operator-UX nuance, no data exposure or security gap. Compounds with REFACTOR-224's same-pattern finding; together they argue for the unified `AuthIdentityProvider` fix.

**Suggested backlog grouping**: `Owner-association UX sprint` — pair with REFACTOR-224. A single service-tier fix can address both surfaces.

---

## REFACTOR-365 — No `@ReactiveTransactional` on `userOwnerMappingRepository.createRelation` multi-statement chain — partial failure between the inner clear and the INSERT leaves the user UNMAPPED with no rollback

**Severity**: MEDIUM
**Category**: transactional-consistency
**Surfaced by**: `ReactiveUserOwnerMappingRepositoryImpl.md:bugs_limitations_corner_cases[6]`

**Description**: `ReactiveUserOwnerMappingRepositoryImpl.createRelation` (lines 41-51) issues TWO SQL statements chained via `.then()`:

```java
return deleteActiveRelationByOwner(ownerId)       // UPDATE deleted_at = NOW()
    .then(jooqReactiveOperations.mono(insert));   // INSERT
```

The reactive `.then()` operator chains Monos but does NOT imply a single transaction. Under reactive backpressure, the two statements may happen on potentially different R2DBC connections. If the UPDATE succeeds and the INSERT fails (e.g., the partial unique index violation from REFACTOR-364), the UPDATE's soft-delete of the previous mapping is NOT rolled back. The user is left in an UNMAPPED state — the prior owner's mapping is soft-deleted; the new owner's mapping never inserted.

**Whether the partial-state surfaces depends on the caller's transactional context**:
- `UserOwnerMappingServiceImpl.createRelation` (lines 14-18) does NOT carry @ReactiveTransactional — neither at the class level nor at the method level. A direct caller of this service IS exposed.
- `OwnerAssociationRequestServiceImpl.approveAssociation` (line 53) DOES carry @ReactiveTransactional — transitive calls to `userOwnerMappingService.createRelation` ARE atomic within THIS flow.

**The asymmetry across the service surface**:
- Manual mapping (`POST /api/owners/associations/manual` → `UserOwnerMappingServiceImpl.createRelation`) — NO transaction; partial-state on failure.
- Approval-based mapping (`POST /api/owners/associations/{id}/approve` → `OwnerAssociationRequestServiceImpl.approveAssociation` → `userOwnerMappingService.createRelation`) — transactional via the parent service.

Two production-facing user paths with different consistency guarantees.

**Primary source citations**:
- `ReactiveUserOwnerMappingRepositoryImpl.java:41-51` — no @ReactiveTransactional
- `UserOwnerMappingServiceImpl.java:14-18` — no @ReactiveTransactional at service
- `OwnerAssociationRequestServiceImpl.java:53` — @ReactiveTransactional on the parent service (transitive coverage)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-067 (the @ReactiveTransactional boundary asymmetry — list reads outside TX, multi-step writes inside TX). The architecture prescribes that multi-step writes should be inside a transaction; this scope is the conformance gap.

**Proposed remedy**: Add @ReactiveTransactional at the service tier (UserOwnerMappingServiceImpl.createRelation). The change is one annotation; no breaking schema changes. Pair with REFACTOR-364 (the bypass-vulnerability companion).

```java
@ReactiveTransactional
public Mono<UserOwnerMappingPojo> createRelation(String username, String provider, long ownerId) {
  return repository.deleteRelation(username, provider)
      .then(repository.createRelation(username, provider, ownerId));
}
```

The annotation wraps both the OUTER clear (deleteRelation), the INNER clear (inside repository.createRelation), and the INSERT (inside repository.createRelation) into a single atomic transaction. Partial failure rolls back all three.

**Severity rationale**: MEDIUM — consistency bug on rare-but-possible failures (DB connection drop, partial unique index violation, lost ROW after UPDATE but before INSERT). The fix is one annotation; small blast radius; architecturally aligned.

**Suggested backlog grouping**: `SEC-NNN auth-mode migration audit sprint` — pair with REFACTOR-364.

---

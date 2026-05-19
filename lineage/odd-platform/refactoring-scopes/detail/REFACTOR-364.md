## REFACTOR-364 — No service-layer wrapper enforces the `(username, provider)` outer clear on `userOwnerMappingRepository.createRelation` — a bypass-service caller skips the outer clear, triggers UniqueConstraintException at the `(oidc_username, provider, deleted_at)` partial unique index, leaving the system in partial state (inner clear-by-owner applied, INSERT failed, no @ReactiveTransactional)

**Severity**: MEDIUM
**Category**: transactional-consistency / bypass-vulnerability
**Surfaced by**: `ReactiveUserOwnerMappingRepositoryImpl.md:bugs_limitations_corner_cases[2]` + `ReactiveUserOwnerMappingRepositoryImpl.md:security.known_security_gaps[3]`

**Description**: `UserOwnerMappingServiceImpl.createRelation` (lines 15-18) wraps the repository call with an outer clear by `(username, provider)`:

```java
return repository.deleteRelation(username, provider)
    .then(repository.createRelation(username, provider, ownerId));
```

The repository's `createRelation` (lines 47-51) does an INNER clear by `(owner_id)`:

```java
return deleteActiveRelationByOwner(ownerId).then(insert);
```

Both clears are required to cover BOTH partial unique indexes from V0_0_89:9-15 (per ADR-CANDIDATE-129 NEW). A caller that bypasses the SERVICE and calls `repository.createRelation` DIRECTLY:
- Inner clear (by `owner_id`) runs.
- INSERT fails on `user_owner_mapping_oidc_username_provider_deleted_key` (the (oidc_username, provider) partial unique index) because the OUTER clear by (username, provider) was skipped.
- The translation layer (ADR-CANDIDATE-071) surfaces `UniqueConstraintException`.
- BUT the inner clear's UPDATE `deleted_at = NOW()` ALREADY COMMITTED because there is **NO @ReactiveTransactional on the repository method** (see REFACTOR-365 for the separate transactional gap).
- The user is left in an UNMAPPED state — the prior owner's mapping is soft-deleted; the new owner's mapping never inserted.

**Today the only documented bypass-service caller is test-fixture setup** (`ReactiveOwnerAssociationRequestRepositoryImplTest.java:50`). A hypothetical future caller (a new admin-tool endpoint, a Spring-mediated direct injection of the repository, or a refactor that flattens UserOwnerMappingServiceImpl) would inherit this risk.

**Primary source citations**:
- `ReactiveUserOwnerMappingRepositoryImpl.java:47-51` — `.then(insert)` chain without outer clear
- `UserOwnerMappingServiceImpl.java:15-18` — the service-tier outer clear
- `V0_0_89__update_user_owner.sql:9-15` — the two partial unique indexes
- `ReactiveOwnerAssociationRequestRepositoryImplTest.java:50` — the test-fixture direct call (today's only bypass caller)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-129 NEW (clear-active-then-INSERT) describes the architecture but DELIBERATELY places the outer clear at the SERVICE LAYER, not at the repository. The architecture accepts the bypass surface as the cost. This scope is the operational consequence.

**Proposed remedy**: Three options:
1. **Move the outer clear INTO the repository** — repository.createRelation does BOTH clears: by (username, provider) AND by (owner_id). Service becomes a passthrough. UX trade-off: the repository becomes "less thin"; the trust-boundary claim of ADR-CANDIDATE-075 shifts.
2. **Add @ReactiveTransactional on the repository createRelation** — at least makes the partial-state-on-failure atomic. The bypass caller still gets the UniqueConstraintException, but the inner clear is rolled back, returning the system to the prior state.
3. **Document the bypass risk** — add a Javadoc warning on `repository.createRelation` enumerating the precondition "outer (username, provider) clear MUST happen at the caller" + add a runtime assertion at the start of the method that throws IllegalStateException if the OUTER clear wasn't applied (detectable via a sentinel).

Option 2 is the smallest fix; Option 1 is the cleanest at the cost of architectural shift.

**Severity rationale**: MEDIUM — bypass-vulnerability with non-trivial blast radius. Today fired only by test fixtures; future code edits could expose it inadvertently. The fix is small (one annotation) and architecturally compatible.

**Suggested backlog grouping**: `SEC-NNN auth-mode migration audit sprint` — pair with REFACTOR-353/354/355 and REFACTOR-365 (the transactional companion).

---

## REFACTOR-267 — Policy cascade-delete check non-atomic with delete: concurrent role-bind + delete race produces orphan-binding permission-leak state

**Severity**: HIGH
**Category**: race-condition (orphan-binding permission leak)
**Surfaced by**:
- `PolicyServiceImpl.md:bugs_limitations_corner_cases[5]`
- `PolicyServiceImpl.md:security.known_security_gaps[0]`

**Description**: `PolicyServiceImpl.delete` (lines 83-95) implements policy deletion with FOUR separate R2DBC calls OUTSIDE any `@ReactiveTransactional`:

```java
public Mono<Void> delete(long id) {
  return policyRepository.get(id)                                       // line 86 — READ existence
      .switchIfEmpty(...)                                                // 404 if missing
      .filter(p -> !ADMINISTRATOR_POLICY.equals(p.getName()))            // line 87 — name guard
      .switchIfEmpty(Mono.error(new BadUserRequestException("Administrator policy cannot be deleted")))  // 88
      .flatMap(p -> roleToPolicyRepository.isPolicyAttachedToRole(id))   // line 89 — READ binding check
      .filter(attached -> !attached)                                      // line 91 — guard
      .switchIfEmpty(Mono.error(new CascadeDeleteException("Policy is attached to a role")))  // 92
      .flatMap(p -> policyRepository.delete(id))                          // line 93 — WRITE delete
      ...;
}
```

The race window: line 89 (`isPolicyAttachedToRole`) and line 93 (`policyRepository.delete`) are SEPARATE R2DBC calls outside any transaction.

Scenario:
1. Client A invokes `DELETE /api/policies/123`; reads `isPolicyAttachedToRole(123) → false` (line 89).
2. Client B concurrently invokes `POST /api/roles` or `PUT /api/roles/{id}` adding a row to `role_to_policy` referencing policy 123.
3. Client B's role-binding write succeeds.
4. Client A proceeds to `policyRepository.delete(123)` (line 93) and SOFT-DELETES the now-bound policy.

Result: a SURVIVING `role_to_policy` row referencing a SOFT-DELETED policy. The CASCADE-DELETE EXCEPTION at line 92 was bypassed by the race; the policy is soft-deleted while still bound to a role.

This is the **orphan-binding permission-leak** state that batch H REFACTOR-230 identified at the repository tier (`ReactivePolicyRepositoryImpl.getRolesPolicies` JOIN at lines 32-35 has NO `AND policy.deleted_at IS NULL` filter — soft-deleted policies STILL grant permissions). The present finding identifies the SERVICE-TIER race that CREATES the orphan-binding state.

The full chain:
1. **Race window (this scope)**: cascade-delete check (line 89) + delete (line 93) are non-atomic.
2. **Repository-tier leak (REFACTOR-230)**: `getRolesPolicies` JOIN doesn't filter soft-deleted policies.
3. **Authorization-time consequence**: the orphan binding continues to grant the soft-deleted policy's permissions to the bound role's members on every authorized request (`getCurrentUserPolicies` per `PolicyServiceImpl.java:102-107`).

The two findings COMPOUND. REFACTOR-230 alone is recoverable (fix the JOIN to filter soft-deleted). REFACTOR-267 alone is recoverable (add the transaction + FOR UPDATE). Together they represent the FULL exploit chain: race-to-create-orphan + JOIN-doesn't-filter = silent permission leak.

The defence at lines 89-92 closes the SEQUENTIAL operator case (one admin deleting + the same admin checking bindings in sequence) but NOT the concurrent-mutation case.

**Primary source citations**:
- `PolicyServiceImpl.java:83-95` — the multi-call delete flow under no transaction
- `ReactiveRoleToPolicyRepositoryImpl.java:43-49` — `isPolicyAttachedToRole` is read-only EXISTS
- `ReactiveAbstractSoftDeleteCRUDRepository.java:50-59` — base delete — single UPDATE, self-atomic
- composes with REFACTOR-230 (the JOIN-side soft-delete filter gap that makes the orphan exploitable)
- composes with REFACTOR-266 (the sibling lost-update race on `PUT /api/policies/{id}`)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-067 (txn boundary asymmetry — PolicyServiceImpl is the negative case) + ADR-CANDIDATE-076 (application-level invariants with hand-written messages) define the architectural shape. The gap is the lack of concurrency-safety at the cascade-delete check. The fix is refactoring within the existing structure (add transaction + FOR UPDATE).

**Proposed remedy**: Three composable fixes:
1. **Add `@ReactiveTransactional` to PolicyServiceImpl.delete** at line 83: scopes the read + check + delete to one R2DBC connection. Closes the within-instance race.
2. **Add `SELECT ... FOR UPDATE` to `isPolicyAttachedToRole`** at the repository: prevents concurrent role-binding writes from succeeding while the delete transaction holds the lock.
3. **Add `AND policy.deleted_at IS NULL` to `getRolesPolicies` JOIN** at `ReactivePolicyRepositoryImpl.java:32-35`: defence-in-depth — even if an orphan binding is created, the authorization-time lookup doesn't grant the soft-deleted policy's permissions. This is the REFACTOR-230 fix; it CLOSES THE EXPLOIT END-TO-END independent of the race fix.

Either (1) + (2) OR just (3) closes the security exposure. (3) is the cheapest one-line SQL fix at the canonical site; (1) + (2) closes the orphan-creation race more strictly. The combination is defence-in-depth.

**Severity rationale**: HIGH — orphan-binding permission leak; affects the platform's authorisation graph; silent (no log, no activity event per REFACTOR-188); compound exploit chain with REFACTOR-230.

**Suggested backlog grouping**: `RBAC hardening sprint` — pair with REFACTOR-266 (lost-update race), REFACTOR-230 (orphan-JOIN gap), REFACTOR-189 (Administrator CREATE asymmetry), REFACTOR-188 (RBAC audit silence). Composes the full RBAC race + audit gap cluster.

---

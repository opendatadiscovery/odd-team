## REFACTOR-189 — Administrator-name CREATE-side asymmetry: PolicyServiceImpl.create has NO name guard, but UPDATE / DELETE DO; relies on DB UNIQUE constraint which is bypassable on out-of-band soft-delete of the seeded row

**Severity**: MEDIUM (DB-defended in steady state; gap surfaces on out-of-band soft-delete of seeded row)
**Category**: missing-validation + defence-in-depth gap
**Surfaced by**:
- batch E `createPolicy.md:bugs_limitations_corner_cases` (originally surfaced; never sharded as standalone scope)
- **STRENGTHENED 2026-05-19I** `PolicyServiceImpl.md:bugs_limitations_corner_cases[1]` (PRIMARY-SOURCE confirmed at service tier)
- `PolicyServiceImpl.md:security.known_security_gaps[1]`

**Description**: `PolicyServiceImpl` defines `ADMINISTRATOR_POLICY = "Administrator"` at line 29 and consults it at:
- Line 76-77: `update` — name guard with `BadUserRequestException("Administrator policy cannot be updated")`
- Line 87-88: `delete` — name guard with `BadUserRequestException("Administrator policy cannot be deleted")`

But NOT at:
- Line 62-69: `create` — NO name check. A caller submitting `POST /api/policies` with `name="Administrator"` is NOT rejected by the service tier.

The only protection against a duplicate `Administrator` policy is the DB partial UNIQUE INDEX at `V0_0_55__add_policies_and_roles.sql:30`:
```sql
CREATE UNIQUE INDEX policy_name_idx ON policy (name) WHERE deleted_at IS NULL;
```

This index defends WHILE the seeded `Administrator` row is LIVE (`deleted_at IS NULL`). It DOES NOT defend if:
- (a) The seeded `Administrator` row is ever SOFT-DELETED out-of-band (e.g., a DB-direct `UPDATE policy SET deleted_at = NOW() WHERE name = 'Administrator'`).
- (b) A broken migration drops the seeded row but leaves the partial index intact.
- (c) A future endpoint somehow bypasses the name guard and creates a parallel Administrator-named row.

If any of these conditions arise, a caller with `POLICY_CREATE` permission can create a NEW `Administrator` policy with arbitrary statements (including MANAGEMENT/ALL grants), effectively REPLACING the platform's bootstrap admin policy. The cascade-binding behaviour (per REFACTOR-230 / REFACTOR-267) compounds the risk.

Additionally, when the DB UNIQUE constraint DOES fire (steady state), it produces a `UniqueConstraintException` translated by `ExceptionUtils` (per ADR-CANDIDATE-071) and surfaced as HTTP 400. The error message is the constraint-violation code, NOT the cleaner `BadUserRequestException("Administrator name is reserved")` that the rest of the file emits for the UPDATE/DELETE asymmetry — UX inconsistency.

This is the SERVICE-TIER PRIMARY SOURCE confirmation of the batch-E finding (originally referenced as DOC-GAP-D + bugs_limitations_corner_cases[3] in `createPolicy.md`). Carries forward as REFACTOR-189 for index continuity.

**Primary source citations**:
- `PolicyServiceImpl.java:29` — the constant
- `PolicyServiceImpl.java:62-69` — NO name check on create (PRIMARY SOURCE for the gap)
- `PolicyServiceImpl.java:76-77` — name check on update
- `PolicyServiceImpl.java:87-88` — name check on delete
- `V0_0_55__add_policies_and_roles.sql:30` — the partial UNIQUE INDEX
- composes with batch E `createPolicy.md` (the original finding)
- composes with REFACTOR-267 (cascade-delete race — if the seeded Administrator policy ever has orphan bindings created via the race, the cross-batch exploit chain widens)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-076 (application-level invariants with hand-written messages) is the architectural intent — the maintainer chose service-tier name-reservation for UPDATE/DELETE. The gap is the CREATE-side asymmetry. The fix is ONE LINE at line 64-67.

**Proposed remedy**: Add the name guard to `create`:
```java
public Mono<PolicyDetails> create(PolicyFormData formData) {
  policyJSONValidator.validate(formData.getPolicy());
  // NEW: Administrator name reservation on CREATE (closing the asymmetry vs UPDATE/DELETE)
  if (ADMINISTRATOR_POLICY.equals(formData.getName())) {
    return Mono.error(new BadUserRequestException("Administrator name is reserved"));
  }
  return Mono.just(formData)
      .map(policyMapper::mapForm)
      .flatMap(policyRepository::create)
      .map(policyMapper::mapPolicy);
}
```

The same fix is needed at `RoleServiceImpl.create` and `OwnerServiceImpl.create` (per the batch-E cross-cutting finding — all three RBAC-directory CREATE paths share the asymmetry).

**Severity rationale**: MEDIUM — gap-of-gaps. The DB UNIQUE constraint defends in steady state; the service-tier asymmetry surfaces only if the seeded row is ever soft-deleted out-of-band. But the CLEANER error UX + the defence-in-depth value justify the one-line fix.

**Suggested backlog grouping**: `RBAC hardening sprint` — pair with REFACTOR-266 (lost-update race), REFACTOR-267 (cascade-delete race), REFACTOR-188 (RBAC audit silence), REFACTOR-230 (orphan-JOIN gap). The full RBAC race + audit + asymmetry cluster.

---

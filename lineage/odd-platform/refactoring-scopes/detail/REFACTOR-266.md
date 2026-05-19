## REFACTOR-266 — Lost-update race on `PUT /api/policies/{id}`: PolicyServiceImpl.update reads then writes OUTSIDE any transaction; no version column on PolicyPojo; concurrent admins can silently overwrite each other's policy edits

**Severity**: HIGH
**Category**: race-condition
**Surfaced by**:
- `PolicyServiceImpl.md:bugs_limitations_corner_cases[0]`

**Description**: `PolicyServiceImpl.update` (lines 71-81) implements policy update with TWO separate R2DBC calls OUTSIDE any `@ReactiveTransactional`:

```java
public Mono<PolicyDetails> update(long id, PolicyUpdateFormData formData) {
  policyJSONValidator.validate(formData.getPolicy());  // schema check
  return policyRepository.get(id)                       // line 74 — READ
      .switchIfEmpty(...)                                // 404 if missing
      .filter(p -> !ADMINISTRATOR_POLICY.equals(p.getName()))  // line 76 — name guard
      .switchIfEmpty(Mono.error(new BadUserRequestException("Administrator policy cannot be updated")))  // 77
      .map(p -> policyMapper.applyToPojo(formData, p))   // line 78 — APPLY in memory
      .flatMap(policyRepository::update)                 // line 79 — WRITE
      .map(policyMapper::mapPolicy);
}
```

The race window: lines 74 (read) and 79 (write) are NOT inside a transaction. Two concurrent `PUT /api/policies/{id}` requests for the same policy:
1. Client A reads v1 (line 74).
2. Client B reads v1 concurrently (line 74).
3. Client A's mapper applies form-data to v1 → builds v2 (line 78).
4. Client A writes v2 → success (line 79).
5. Client B's mapper applies its DIFFERENT form-data to its OWN copy of v1 → builds v3 (where v3 was DERIVED FROM v1, not v2).
6. Client B writes v3 → success (line 79).
7. Client A's change is SILENTLY OVERWRITTEN.

No defence at the persistence layer:
- No `version` column on `PolicyPojo` (verified by reading imports at lines 7-21).
- No optimistic-concurrency check.
- No `SELECT ... FOR UPDATE`.
- No row-level lock.
- No DB UNIQUE constraint that would catch overlapping writes.

The sibling `RoleServiceImpl.update` IS `@ReactiveTransactional` (`RoleServiceImpl.java:64`). Even there, the wrapping transaction alone does not prevent lost-update without `FOR UPDATE` or row-version tracking — but it AT LEAST scopes the read+write to a single R2DBC connection. For `PolicyServiceImpl`, even the connection-scope guarantee is absent.

The asymmetry vs sibling RoleServiceImpl is itself a finding (per ADR-CANDIDATE-067 batch I strengthening — PolicyServiceImpl is the NEGATIVE case in the service-tier transactional placement pattern). The maintainer's intent is ambiguous: either (a) policy authoring is rare enough that races are acceptable, or (b) the missing annotation is an oversight.

Severity is HIGH (not MEDIUM as the sidecar conservatively rated) because:
- Policy mutations affect the platform's authorisation graph (per ADR-CANDIDATE-002).
- A silently-overwritten policy edit can grant or revoke permissions inadvertently.
- The multi-admin scenario (multiple security stewards triaging policies) is the EXACT case where this race manifests.
- No log entry, no activity event (per REFACTOR-188), no operator-visible signal.

**Primary source citations**:
- `PolicyServiceImpl.java:71-81` — read-then-write under no transaction
- `ReactiveTransactional.java:9-13` — the annotation exists and is the wrap mechanism used elsewhere
- `ReactiveAbstractCRUDRepository.java:107-110` — base update — un-annotated; the repository layer is uniformly non-transactional per ADR-CANDIDATE-067
- `RoleServiceImpl.java:64` — sibling IS annotated; asymmetry confirms the gap
- `PolicyPojo` (imports at lines 7-21) — no `version` field
- composes with ADR-CANDIDATE-067 (batch I negative case strengthening)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-067 (txn boundary asymmetry) codifies the service-tier transactional placement as opt-in. The maintainer's choice to NOT annotate PolicyServiceImpl is the gap; the sibling RoleServiceImpl's annotation is the prescription. The fix is refactoring within the existing pattern — adding the annotation.

**Proposed remedy**: Three composable fixes:
1. **Add `@ReactiveTransactional` to PolicyServiceImpl.update** (lines 71-81): scopes the read + write to one R2DBC connection. Not a complete fix for lost-update under multi-instance deployments (the connection is per-instance), but closes the within-instance race.
2. **Add `SELECT ... FOR UPDATE`** to the read at line 74: replace `policyRepository.get(id)` with a new `getForUpdate(id)` that issues `SELECT ... FOR UPDATE`. The DB row-lock prevents Client B from reading v1 while Client A's transaction is in flight. Closes the multi-instance race.
3. **Add an optimistic-concurrency `version` column to PolicyPojo**: increment on every UPDATE; reject the UPDATE if the version doesn't match the read. Closes the race without holding DB locks; preferred for high-write-rate surfaces (less applicable here since policy edits are admin-rare).

For policy authoring (admin-rare workload), option (1) + (2) together is the cleanest fix. Option (3) is over-engineering for the workload.

**Severity rationale**: HIGH — affects the platform's authorisation graph; silent lost-update on RBAC mutations is a security-architecture concern, not just a UX issue.

**Suggested backlog grouping**: `RBAC hardening sprint` — pair with REFACTOR-267 (cascade-delete race), REFACTOR-189 (Administrator CREATE asymmetry), REFACTOR-188 (RBAC audit silence), REFACTOR-230 (orphan role_to_policy bindings). The RBAC subsystem has multiple race + audit gaps that compound.

---

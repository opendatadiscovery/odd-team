## ADR-CANDIDATE-129 — Clear-active-then-INSERT (NOT upsert) for user_owner_mapping createRelation — the deliberate preservation of soft-delete audit history at every binding transition over the simpler ON CONFLICT DO UPDATE upsert

**Severity**: HIGH
**Classification**: promote
**Pillars affected**: [P-09-security-access-control]
**Support count**: 1 sidecar (batch N ReactiveUserOwnerMappingRepositoryImpl) — load-bearing single-source for the RBAC user-owner binding write path
**Axes present**: repositories
**Batch**: N (2026-05-19)

**Surfaced by**:
- `ReactiveUserOwnerMappingRepositoryImpl.md:implicit_adrs.[1]` (HIGH) — "**Clear-active-then-insert pattern, not upsert — the application-side enforcement of the at-most-one invariant.** `createRelation` (lines 47-51) issues `deleteActiveRelationByOwner(ownerId).then(insert)` rather than an ON CONFLICT DO UPDATE upsert. UserOwnerMappingServiceImpl.createRelation (UserOwnerMappingServiceImpl.java:16-17) adds an OUTER clear by (username, provider). The maintainer's intent: preserve the soft-delete history at every transition (an ON CONFLICT DO UPDATE would mutate the existing row's owner_id in place, losing the audit trail of the prior binding). The two clears together cover both partial unique indexes: clear-by-username-provider covers `user_owner_mapping_oidc_username_provider_deleted_key`, clear-by-owner-id covers `unique_deleted_at_per_owner`. Either index alone would suffice for uniqueness, but the maintainer chose to apply both clears at every write so that the audit history is symmetric: every prior binding from BOTH directions (this user previously mapped to which owner; this owner previously had which user) is soft-deleted at the moment of the new binding." — intent_anchor: "the codepath is `deleteRelation(username, provider).then(deleteActiveRelationByOwner(ownerId).then(insert))` — two explicit clears, not an upsert; the maintainer's design choice is 'soft-delete every prior binding, then insert', NOT 'mutate the latest binding in place'"

**Decision statement**: ODD's user-owner binding write path (`POST /api/owners/associations/manual` and `POST /api/owners/associations/{id}/approve` flowing through `UserOwnerMappingServiceImpl.createRelation` → `ReactiveUserOwnerMappingRepositoryImpl.createRelation`) deliberately **clears every prior binding via soft-delete UPDATE, then INSERTs a fresh row** — instead of using a simpler `INSERT ... ON CONFLICT DO UPDATE` upsert that would mutate the existing row's `owner_id` in place.

The mechanical write path:

```java
// Repository (ReactiveUserOwnerMappingRepositoryImpl.createRelation):
public Mono<UserOwnerMappingPojo> createRelation(String oidcUsername,
                                                   String provider,
                                                   long ownerId) {
  return deleteActiveRelationByOwner(ownerId)   // clear by (owner_id) — UPDATE deleted_at = NOW()
      .then(jooqReactiveOperations.mono(
          insert.values(ownerId, oidcUsername, provider, null)));
}

// Service (UserOwnerMappingServiceImpl.createRelation):
public Mono<UserOwnerMappingPojo> createRelation(String username, String provider, long ownerId) {
  return repository.deleteRelation(username, provider)           // clear by (username, provider)
      .then(repository.createRelation(username, provider, ownerId)); // which itself clears by (owner_id)
}
```

The two clears together cover BOTH partial unique indexes (V0_0_89:9-15):
- `unique_deleted_at_per_owner` on `(owner_id) WHERE deleted_at IS NULL` — covered by `deleteActiveRelationByOwner(ownerId)`.
- `user_owner_mapping_oidc_username_provider_deleted_key` on `(oidc_username, provider) WHERE deleted_at IS NULL` — covered by `deleteRelation(username, provider)`.

The architectural choices encoded:
- **(a) Soft-delete audit-history preservation at every transition** — a binding change leaves N+1 rows in `user_owner_mapping`: 1 active (`deleted_at IS NULL`) + N soft-deleted (each with a `deleted_at` timestamp). A user who has been mapped → unmapped → remapped 100 times leaves 100 rows. The forensic query "when was alice mapped to which owner?" is answered by reading the history; the schema preserves the full audit trail.
- **(b) Symmetric clear from BOTH directions** — the maintainer chose to clear BOTH the (owner_id) side AND the (username, provider) side at every write. Either clear alone would suffice for uniqueness; both together produce a symmetric audit history (the OWNER's mapping history is parallel to the USER's mapping history). A future query "which users have been mapped to owner X?" is answered by reading the (owner_id) side; "which owners has user alice been mapped to?" by reading the (username, provider) side.
- **(c) The trade-off: upsert simplicity vs audit preservation** — `INSERT ... ON CONFLICT (oidc_username, provider) DO UPDATE SET owner_id = ?` would be one statement instead of three; the operator-observable correctness would be identical (the user ends up mapped to the new owner). The maintainer rejected this in favour of audit-history. The two service-tier calls + one repository-tier clear + one INSERT are deliberate.
- **(d) The trust boundary is the SERVICE LAYER** — the repository's `createRelation` clears by `(owner_id)` only. The OUTER clear by `(username, provider)` lives at `UserOwnerMappingServiceImpl.createRelation`. A future bypass-service caller invoking `repository.createRelation` directly would skip the outer clear and trigger a UniqueConstraintException at the DB layer; the partial-state-on-failure surface (REFACTOR-364) is the cost.

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — the explicit `.then()` chain (NOT a single upsert) is the code-level signature. The two-clear shape is a deliberate engineering decision documented by the migration V0_0_89's TWO partial unique indexes (not one). The maintainer designed the schema and the application code to mirror each other.
2. **Structural impact?** YES — affects the user-owner binding audit trail (the audit substrate for RBAC forensics, even though there's no audit log per REFACTOR-188); affects the schema's partial-index design (V0_0_89 added TWO partial-unique-indexes specifically because the application uses two clears); affects the service-vs-repository trust boundary (the outer clear lives at the service layer — see REFACTOR-364 for the bypass risk).
3. **Switching to upsert is REFACTORING or STRUCTURAL?** STRUCTURAL — switching to `INSERT ... ON CONFLICT DO UPDATE` would lose the audit history; the migration to restore the audit trail would require either adding an `audit_log` table (currently absent per REFACTOR-188) or maintaining the soft-delete-history shape via different code. The choice is the architecture.

**Evidence**:
- ReactiveUserOwnerMappingRepositoryImpl.md says: "Clear-active-then-insert pattern, not upsert ... the maintainer's intent: preserve the soft-delete history at every transition (an ON CONFLICT DO UPDATE would mutate the existing row's owner_id in place, losing the audit trail of the prior binding). The two clears together cover both partial unique indexes ... the maintainer's design choice is 'soft-delete every prior binding, then insert', NOT 'mutate the latest binding in place'"
- ReactiveUserOwnerMappingRepositoryImpl.java:47-51 — the repository's `.then(insert)` chain
- UserOwnerMappingServiceImpl.java:15-18 — the service's outer clear-by-(username, provider)
- V0_0_89__update_user_owner.sql:9-15 — the TWO partial unique indexes that mirror the TWO clears

**Existing ADR**: none. **Composes with ADR-CANDIDATE-068** (two-tier soft-delete taxonomy — user_owner_mapping uses the `deleted_at` soft-delete pattern). **Composes with ADR-CANDIDATE-074** (soft-delete-aware identity LEFT JOIN — the read-side complement; this ADR is the write-side that produces the history that -074's reads filter). **Composes with ADR-CANDIDATE-070** (partial unique index — the DB-layer enforcement under both indexes). **Composes with ADR-CANDIDATE-130 NEW** (provider-null collapse — the principal-mapping-collapse-by-design at the schema level; this ADR is the write-mechanic that PERPETUATES the collapse across binding changes).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-364 NEW — no service-layer pre-check on (username, provider) clearance before repository.createRelation; bypass-service caller (test today, future hypothetically) skips outer clear and triggers partial-state-on-failure (MEDIUM).
- REFACTOR-365 NEW — no @ReactiveTransactional on the multi-statement createRelation chain (UPDATE + INSERT); partial failure between UPDATE and INSERT leaves user unmapped (MEDIUM).
- REFACTOR-387 NEW — soft-delete-only growth without operator-driven pruning (LOW; documented operational consequence).

**Proposed action**: Promote to `adrs/drafts/clear-active-then-insert-not-upsert.md` (new ADR). Document:
- The architecture (clear-by-(owner_id) + clear-by-(username,provider) + INSERT).
- The audit-history preservation intent.
- The schema mirror (V0_0_89's two partial unique indexes match the two clears).
- The trust boundary (outer clear at service; inner clear at repository — bypass surface per REFACTOR-364).
- The transactional gap (REFACTOR-365).
- The growth consequence (REFACTOR-387).
- The maintainer-extension contract: future audit-relevant mutations should preserve history via soft-delete-then-INSERT, not upsert.

Cross-link with ADR-CANDIDATE-068, -070, -074, -130.

**Severity rationale**: HIGH — load-bearing for RBAC audit substrate. The user-owner binding is the canonical anchor for "who has had access to what, when" forensics. A regression replacing this with a simpler upsert would silently destroy the audit history that the schema is designed to preserve; the operator-visible correctness would be unchanged (users still see the right owner mapping) but the forensic capability would be lost. Compatible-change calculus for any future RBAC-audit feature (REFACTOR-188 family) depends on this ADR.

---

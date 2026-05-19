## REFACTOR-355 — Cross-provider username row-duplication via OIDC_USERNAME-only LEFT JOINs — Alert / Activity / OwnerAssociationRequest / Owner repositories JOIN user_owner_mapping ON OIDC_USERNAME without the matching provider clause, producing Cartesian-product row duplication when two ACTIVE mappings exist for the same username under different providers

**Severity**: HIGH
**Category**: missing-defence-in-depth (data-integrity correctness on cross-provider naming collision)
**Surfaced by**:
- `ReactiveUserOwnerMappingRepositoryImpl.md:bugs_limitations_corner_cases[1]`
- `ReactiveUserOwnerMappingRepositoryImpl.md:security.known_security_gaps[2]`
- `ReactiveUserOwnerMappingRepositoryImpl.md:docs_link_semantic.doc_drift_findings.[3]`

**Description**: Four downstream repositories LEFT JOIN `USER_OWNER_MAPPING` to surface the Owner-display for audit/UX purposes:

- `ReactiveAlertRepositoryImpl.java:83-86`: `LEFT JOIN USER_OWNER_MAPPING ON ALERT.STATUS_UPDATED_BY = USER_OWNER_MAPPING.OIDC_USERNAME AND USER_OWNER_MAPPING.DELETED_AT.isNull()` — **no provider equality clause**.
- `ReactiveActivityRepositoryImpl.java:156-158`: `LEFT JOIN ... ON USER_OWNER_MAPPING.OIDC_USERNAME = ACTIVITY.CREATED_BY AND USER_OWNER_MAPPING.DELETED_AT.isNull()` — same shape.
- `ReactiveOwnerAssociationRequestRepositoryImpl.java:80-84` — same shape.
- `ReactiveOwnerRepositoryImpl.java:77-78` — same shape.

These JOINs implement ADR-CANDIDATE-074's "soft-delete-aware identity LEFT JOIN" pattern but OMIT the provider equality predicate. The omission is consistent across all four sites — the maintainer applied the same pattern verbatim. In the OAuth2-only-or-LOGIN_FORM-only deployments (the common case), the omission is harmless: there's only one provider in use; `(alice, NULL)` is the only row.

**The failure mode arises in mixed-mode or migrated deployments**: if two ACTIVE rows exist for the same `OIDC_USERNAME` under different providers — e.g., `(alice, NULL)` from a LOGIN_FORM mapping AND `(alice, 'github')` from an OAuth2 mapping (perhaps a result of an incomplete migration) — the LEFT JOIN matches BOTH rows:

- **Alert listing**: an Alert row with `STATUS_UPDATED_BY = 'alice'` produces TWO result rows in `getAllAlerts` (one per matching user_owner_mapping row), with the Owner display being EITHER owner-A (from `alice, NULL`) OR owner-B (from `alice, 'github'`) depending on Postgres's physical row order.
- **Activity feed**: an Activity row with `CREATED_BY = 'alice'` similarly duplicates.
- **OwnerAssociationRequest**: pending-request listing duplicates.
- **Owner display**: the rendered "Updated by" field on an entity detail page is non-deterministic.

**Row-duplication is more severe than display-only mismatch**: page-load counts double; pagination skips rows; HTTP-cache layers fragment; consumers expecting at-most-one Owner per audit-row get unexpected cardinality.

The case is RARE in production (requires concurrent multi-mode deployments OR an incomplete migration with overlapping usernames) but the cardinality break IS the architectural drift — every JOIN to `USER_OWNER_MAPPING` SHOULD include the provider equality clause to match the source repository's `(oidc_username, provider)` compound-key contract.

**Primary source citations**:
- `ReactiveAlertRepositoryImpl.java:83-86, 105-108, 499-502` — three JOIN sites with the shape, ALL missing provider
- `ReactiveActivityRepositoryImpl.java:156-158`
- `ReactiveOwnerAssociationRequestRepositoryImpl.java:80-84`
- `ReactiveOwnerRepositoryImpl.java:77-78`
- `ReactiveUserOwnerMappingRepositoryImpl.java:116-127` — the authoritative compound-key contract (oidc_username + provider in the WHERE clause)
- `V0_0_89__update_user_owner.sql:13-15` — the partial unique index `(oidc_username, provider) WHERE deleted_at IS NULL` — the schema's compound-key declaration

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-074 (soft-delete-aware identity LEFT JOIN) documents the IDIOM ("LEFT JOIN USER_OWNER_MAPPING ON username AND DELETED_AT IS NULL"). The ADR's maintainer-extension contract presumes provider matching but does NOT prescribe it; this scope is the precision tightening — the four JOIN sites should also match provider when the audit-row's principal context is known. The fix:

**Proposed remedy**: Tightening the four LEFT JOIN sites to compound-key match:

```java
// Before:
.leftJoin(USER_OWNER_MAPPING)
  .on(USER_OWNER_MAPPING.OIDC_USERNAME.eq(ALERT.STATUS_UPDATED_BY)
      .and(USER_OWNER_MAPPING.DELETED_AT.isNull()));

// After:
.leftJoin(USER_OWNER_MAPPING)
  .on(USER_OWNER_MAPPING.OIDC_USERNAME.eq(ALERT.STATUS_UPDATED_BY)
      .and(USER_OWNER_MAPPING.PROVIDER.eq(...) /* OR isNull when null */)
      .and(USER_OWNER_MAPPING.DELETED_AT.isNull()));
```

The complication: the AUDIT-ROW does NOT record the provider that wrote it. Alert's `STATUS_UPDATED_BY` is a username string only; `CREATED_BY` similarly. The provider context is lost at the write side. Three fixes are possible:

1. **Schema extension** — add `STATUS_UPDATED_BY_PROVIDER VARCHAR(255)` (or `CREATED_BY_PROVIDER`) to each audit table, populated at write time. JOINs match `(username, provider)`. Migration cost: alter the four tables + backfill from current bindings.
2. **LATERAL JOIN with priority** — pick the matching `user_owner_mapping` row by a deterministic priority (e.g., prefer OAuth2 provider over null, or prefer the most recently-active mapping). Avoids schema changes but encodes a heuristic.
3. **Document the gap** — accept the multi-row case as a known behaviour in mixed-mode deployments; surface a warning in `documentation/docs/configuration-and-deployment/enable-security/`. Smallest-blast-radius fix; doesn't actually fix the row-duplication.

Option 1 is the structural fix; Option 2 is the cheapest. Today's prod deployments are single-mode, so the issue is theoretical, but pre-empting the mixed-mode case avoids future operator confusion.

**Severity rationale**: HIGH — data-correctness gap on a cross-provider naming collision. Row-duplication breaks pagination, count totals, and UI cardinality. The case is RARE in current single-mode deployments but the architecture allows mixed-mode deployments (composing-not-mutex per the SecurityConfiguration's `@ConditionalOnProperty` design). A future operator running both LOGIN_FORM and OAuth2 (e.g., for dev-vs-prod-user separation) hits the cardinality break on every cross-provider username overlap.

**Suggested backlog grouping**: `SEC-NNN auth-mode migration audit sprint` — pair with REFACTOR-353 (provider-null collapse cost) and REFACTOR-354 (S2S ADMIN collision). The three together describe the cross-provider risk surface.

---

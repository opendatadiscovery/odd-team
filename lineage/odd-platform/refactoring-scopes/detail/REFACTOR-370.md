## REFACTOR-370 — Positional `.values(...)` INSERT in ReactiveUserOwnerMappingRepositoryImpl — schema-evolution fragility; a future migration adding a column BETWEEN existing columns silently inserts into the wrong columns

**Severity**: LOW
**Category**: refactor-risk (schema-evolution fragility; latent migration-time bug)
**Surfaced by**: `ReactiveUserOwnerMappingRepositoryImpl.md:bugs_limitations_corner_cases[4]`

**Description**: `ReactiveUserOwnerMappingRepositoryImpl.createRelation` at line 45 calls `.values(ownerId, oidcUsername, provider, DSL.val(null, DATE))` passing values POSITIONALLY. The order is bound to the current column order of `USER_OWNER_MAPPING` (owner_id, oidc_username, provider, deleted_at per V0_0_89). If a future migration adds a column BETWEEN existing columns (e.g., `created_at TIMESTAMP DEFAULT NOW()` inserted at position 4), the jOOQ-generated `USER_OWNER_MAPPING` table constant re-codegens WITH the new column, BUT the literal `.values(...)` call silently inserts into the wrong columns — `ownerId` → owner_id (correct); `oidcUsername` → oidc_username (correct); `provider` → provider (correct); `null` → created_at (WRONG); the actual `deleted_at` column gets no value (uses default).

The bug surfaces only on migration; today the order is correct. The maintainer-extension contract is brittle — a future schema migration without a corresponding code edit would produce subtle data corruption.

**Primary source citations**:
- `ReactiveUserOwnerMappingRepositoryImpl.java:44-46`

**Existing-ADR-or-implied-prescription**: Cross-batch — most repositories use the `.set(FIELD, value).set(FIELD, value)...newRecord()` form which is column-name-bound. This scope is the deviation.

**Proposed remedy**: Use the `.set()`-based form:

```java
DSL.insertInto(USER_OWNER_MAPPING)
   .set(USER_OWNER_MAPPING.OWNER_ID, ownerId)
   .set(USER_OWNER_MAPPING.OIDC_USERNAME, oidcUsername)
   .set(USER_OWNER_MAPPING.PROVIDER, provider)
   .set(USER_OWNER_MAPPING.DELETED_AT, (LocalDateTime) null)
   .returning()
```

OR use `.columns(...).values(...)` form which explicitly names columns. Either form is column-name-bound.

**Severity rationale**: LOW — latent migration-time bug; no impact today.

**Suggested backlog grouping**: `Code hygiene` — small cosmetic refactor.

---

## REFACTOR-371 — Type mismatch `DSL.val(null, DATE)` for `deleted_at` (TIMESTAMP) in ReactiveUserOwnerMappingRepositoryImpl — cosmetic code-smell; would cause confusion if the literal were ever changed to non-null

**Severity**: LOW
**Category**: refactor-risk (type-binding cosmetic)
**Surfaced by**: `ReactiveUserOwnerMappingRepositoryImpl.md:bugs_limitations_corner_cases[5]`

**Description**: Line 45: `DSL.val(null, DATE)` declares the type of the null literal as `DATE`. But the schema column is `TIMESTAMP WITHOUT TIME ZONE` (V0_0_89:2). Postgres tolerates this because both casts of NULL to DATE / TIMESTAMP are equivalent — but the type mismatch is a code-smell that would cause confusion if someone later changes the value to a non-null literal (e.g., changes `DSL.val(null, DATE)` to `DSL.val(LocalDate.now(), DATE)` — the resulting cast to TIMESTAMP would lose the time component).

**Primary source citations**:
- `ReactiveUserOwnerMappingRepositoryImpl.java:45`
- `V0_0_89__update_user_owner.sql:2`

**Proposed remedy**: Change `DSL.val(null, DATE)` to `DSL.val((LocalDateTime) null)` or use the column-typed reference `USER_OWNER_MAPPING.DELETED_AT.getDataType()` — both align with the schema's TIMESTAMP type.

**Severity rationale**: LOW — cosmetic code-smell; no impact today. Future maintainer pitfall.

**Suggested backlog grouping**: `Code hygiene` — small cosmetic refactor.

---

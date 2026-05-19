## REFACTOR-369 — Empty-string vs null `provider` indistinguishable in `IS NULL` branch — `getConditions` at `ReactiveUserOwnerMappingRepositoryImpl.java:121-125` treats `provider=""` and `provider=null` identically, producing unreachable rows on the empty-string write path

**Severity**: LOW
**Category**: data-consistency (unreachable rows; latent migration-time bug)
**Surfaced by**: `ReactiveUserOwnerMappingRepositoryImpl.md:bugs_limitations_corner_cases[3]`

**Description**: `ReactiveUserOwnerMappingRepositoryImpl.getConditions` lines 121-125: `if (StringUtils.isNotEmpty(provider)) PROVIDER.eq(provider) else PROVIDER.isNull()`. An operator who sets `provider=''` via the manual-mapping endpoint `POST /api/owners/associations/manual` (which accepts a free-form provider string) lands in the IS-NULL bucket. The partial unique index `user_owner_mapping_oidc_username_provider_deleted_key` IS on `(oidc_username, provider)`; Postgres treats `''` and `NULL` as DISTINCT values in unique constraints — both rows could theoretically coexist. The `.eq()` predicate would never retrieve the empty-string row — the read path bypasses it.

The result: an empty-string write produces an unreachable row that:
- Cannot be matched by any subsequent lookup (read path uses IS_NULL).
- Counts against the unique index (so a fresh write of `(alice, NULL)` would not collide, but a fresh write of `(alice, '')` would).
- Surfaces only if an operator queries the DB directly.

**Primary source citations**:
- `ReactiveUserOwnerMappingRepositoryImpl.java:121-125`

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-130 NEW (provider-null collapse) describes the architectural intent. This scope is the off-by-one of that architecture — empty-string and null are NOT the same value in Postgres unique constraints but the application reads them as the same.

**Proposed remedy**: Normalise at the controller boundary — `StringUtils.trimToNull(provider)` in the controller binding before reaching the service. Empty-string maps to NULL on the write path; both write and read use NULL consistently.

**Severity rationale**: LOW — latent migration-time bug; unreachable rows but no security or correctness impact today. The manual-mapping endpoint is a low-traffic operator surface.

**Suggested backlog grouping**: `SEC-NNN auth-mode migration audit sprint` — small cosmetic fix that strengthens the provider-null collapse architecture.

---

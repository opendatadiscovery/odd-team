## REFACTOR-387 — `user_owner_mapping` soft-delete-only growth — table grows monotonically with every binding change; no operator-driven pruning path documented; a platform with 1000 users churning mappings monthly accumulates ~12,000 rows annually

**Severity**: LOW
**Category**: missing-retention (operator-surprise; not data loss)
**Surfaced by**: `ReactiveUserOwnerMappingRepositoryImpl.md:performance.scaling_characteristics` + `ReactiveUserOwnerMappingRepositoryImpl.md:performance.known_performance_gaps[1]`

**Description**: `ReactiveUserOwnerMappingRepositoryImpl` has NO hard-delete code path; every "delete" is `UPDATE deleted_at = NOW()` (per ADR-CANDIDATE-129 NEW — the deliberate audit-history preservation). The schema's partial unique indexes (V0_0_89:9-15) ensure "at most one ACTIVE row per (owner_id)" and "at most one ACTIVE row per (oidc_username, provider)", but ALL prior soft-deleted rows remain.

`Grep "DELETE FROM user_owner_mapping"` returns ZERO matches across the codebase. No operator-driven pruning path. A platform with 1000 users churning mappings monthly accumulates ~12,000 rows annually — small enough that the partial unique indexes' WHERE-clause coverage keeps query times bounded, but the operator may not know they CAN safely `DELETE FROM user_owner_mapping WHERE deleted_at IS NOT NULL` (deleted rows have no live references and no FK cascade implications).

**Primary source citations**:
- `ReactiveUserOwnerMappingRepositoryImpl.java:56-74` — every delete is UPDATE
- `V0_0_89__update_user_owner.sql:9-15` — the partial unique indexes
- Cross-batch: ADR-CANDIDATE-129 NEW (the audit-history preservation architecture)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-129 NEW (clear-active-then-INSERT) PRESCRIBES the soft-delete-history preservation. This scope is the documented operational consequence — the maintainer DELIBERATELY chose growth as the trade-off for audit history.

**Proposed remedy**:
1. **Doc-side remedy** — document the safe pruning operation in `documentation/docs/configuration-and-deployment/`: "operators can safely `DELETE FROM user_owner_mapping WHERE deleted_at < NOW() - INTERVAL 'N days'` to prune old mappings; the audit history loss is the trade-off".
2. **Add a housekeeping job** — extend the housekeeping subsystem (per ADR-CANDIDATE-045) with a `UserOwnerMappingHousekeepingJob` that prunes by TTL. Requires a new `housekeeping.user-owner-mapping.ttl-days` config key.
3. **Accept the growth** — at typical scale (1000 users churning monthly), 12K rows/year is operationally invisible.

Option 1 is the smallest blast radius; Option 2 is the structural fix.

**Severity rationale**: LOW — operational-surprise; not data loss or correctness gap. Pairs with REFACTOR-085 (no activity retention — similar soft-delete-only growth pattern).

**Suggested backlog grouping**: `DOC-NNN operational-runbook` — companion to REFACTOR-085.

---

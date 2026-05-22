## REFACTOR-581 — `DELETE /api/datasources/{id}` orphans the `token` row — the soft-delete UPDATEs only `data_source.deleted_at`; the FK-referenced `token` row is never cleaned and CANNOT be soft-deleted (no `deleted_at` on `token`); every register-then-delete cycle leaks one plaintext-credential row

**Severity**: HIGH
**Category**: missing-audit + plaintext-at-rest (orphan-credential accumulation)
**Pillars affected**: [P-08 (Collector / Data-Source Lifecycle Management), P-08:F-002 (Housekeeping)]
**related_features**: [F-010]
**Batch**: ZB (2026-05-21)

**Surfaced by**:
- `odd-platform__java__DataSourceController__controller-method__deleteDataSource.md:bugs_limitations_corner_cases.[0]` (MEDIUM per sidecar) — "**The `token` row is orphaned on every data source delete.** `data_source.token_id` is a FK to the `token` table (`V0_0_28__add_token.sql:13`). The soft-delete sets only `data_source.deleted_at` (`ReactiveAbstractSoftDeleteCRUDRepository.java:106-110`); it never deletes the `token` row, and the `token` table has NO `deleted_at` column (`V0_0_28__add_token.sql:1-9`) so it cannot even be soft-deleted. No code path GCs orphan tokens (no scheduled job, no Flyway migration found by Grep). Each register-then-delete cycle leaks one `token` row."
- `odd-platform__java__DataSourceController__controller-method__deleteDataSource.md:security.known_security_gaps.[0]` (MEDIUM) — "Orphan plaintext token persists after delete — the deleted data source's token row is never removed (token table has no `deleted_at`, no GC path). Stale-secret-at-rest."
- `odd-platform__java__DataSourceController__controller-method__deleteDataSource.md:downstream_side_effects` (the `db-write` ORPHANS-the-token-row side effect — "1 orphan token per successful delete").

**Description**: `DataSourceServiceImpl.delete` (lines 85-96, `@ReactiveTransactional`) performs the cascade-guard check then `dataSourceRepository.delete(id)` — the inherited `ReactiveAbstractSoftDeleteCRUDRepository.delete` (lines 50-58), whose `getDeleteChangedFields` (lines 106-110) writes ONLY `deleted_at = NOW()` on the `data_source` row. The `data_source.token_id` FK still points at the `token` row; that `token` row is never touched. The `token` table (`V0_0_28__add_token.sql:1-9`) has no `deleted_at` column, so the orphan cannot even be soft-deleted — it simply persists. No scheduled job covers the `token` table (the 5-job housekeeping cycle has no `token`-table reaper — confirmed in the feature-flows F-010 registry: `orphan_token_row_no_housekeeping`). The `token.value` column carries the 40-char plaintext credential (`token.value varchar(40)`, `V0_0_28__add_token.sql:4`); a DB read / replica / backup sees a live-shaped credential that no longer maps to any live data source.

This is the EXACT structural pattern the test-map registry already pins for the **Collector** delete path — `TEST-GAP-755` ("Soft-deleted collector leaves an orphaned TOKEN row with plaintext credential indefinitely", HIGH). The `data_source` delete and the `collector` delete both inherit `ReactiveAbstractSoftDeleteCRUDRepository.delete`; both leave the FK-referenced `token` row intact; neither has a GC path. REFACTOR-581 is the **data-source** instance of the same gap.

**Primary source citations**:
- `DataSourceServiceImpl.java:85-96` (the delete method — no `tokenRepository.delete` call)
- `ReactiveAbstractSoftDeleteCRUDRepository.java:50-58` + `:106-110` (soft-delete UPDATEs only `data_source.deleted_at`)
- `V0_0_28__add_token.sql:1-13` (`token` table — `value varchar(40)` at line 4, `data_source.token_id` FK at line 13, NO `deleted_at` column)
- Probe `P-046` (`lineage/odd-platform/probes/P-046.yaml`) — pins the orphan-token persistence

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-068 (two-tier soft-delete taxonomy — `data_source` is base-tier, strengthened by batch ZB) codifies that `data_source` soft-deletes via the base class. The base class only ever touches the entity's own `deleted_at`; cascading to FK-referenced auxiliary rows (`token`) is NOT part of the base contract. The orphan-token accumulation is a GAP — the absence has no stated rationale, and addressing it (a `tokenRepository.delete(token_id)` call inside the `@ReactiveTransactional` delete, or a housekeeping reaper) is refactoring within the existing structure.

**Proposed remedy**: Either (a) add `tokenRepository.delete(dto.token().tokenPojo().getId())` to `DataSourceServiceImpl.delete` inside the existing `@ReactiveTransactional` boundary (the `token` table would need a `deleted_at` column to soft-delete it, or a hard `DELETE FROM token` since `token` is a leaf auxiliary table — decide soft-vs-hard per ADR-CANDIDATE-069's edge-table reasoning); OR (b) add an orphan-`token` reaper to the housekeeping cycle (F-010) — a job that hard-deletes `token` rows referenced by no live `data_source` and no live `collector`. Option (b) is the cross-cutting fix that ALSO closes the Collector orphan-token gap (TEST-GAP-755). Document the chosen behaviour; the live `features/management` page is currently silent on token cleanup at delete.

**Severity rationale**: HIGH — (a) unbounded `token`-table growth across every register/delete cycle; (b) a stale plaintext credential at rest is a GDPR/SOX hazard operators cannot mitigate without raw DB access; (c) the audit-asymmetry (UI shows "deleted", DB shows the `token` row still present) is a forensic-investigation hazard. The data-source path joins the Collector path (TEST-GAP-755 HIGH) — both halves of the platform's credential-bearing-resource delete surface leak.

**Suggested backlog grouping**: `SEC-NNN orphan-credential cleanup` — pair with the Collector orphan-token gap (TEST-GAP-755) and route the housekeeping-reaper option through the F-010 Housekeeping feature. A single orphan-`token` reaper closes both.

---

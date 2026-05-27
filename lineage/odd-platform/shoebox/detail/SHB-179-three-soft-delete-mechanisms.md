# SHB-179 — Three soft-delete mechanisms coexist; operator-observable deletion semantics drift across the schema

**Category**: merged
**Severity**: MEDIUM

## Hypothesis

Operators querying ODD's PostgreSQL database directly (BI tools, ETL jobs, admin scripts, audit reviews) and developers writing new reactive repositories encounter THREE distinct soft-delete mechanisms across the schema: (1) `deleted_at TIMESTAMP` (the canonical convergence point post-V0_0_64, used by `role`, `policy`, `data_source`, `collector`, `namespace`, `tag`, `term`, `data_entity`, `metadata_field`, `user_owner_mapping`, etc.); (2) `STATUS` enum column with `DELETED` value (used by `data_entity` IN ADDITION TO `deleted_at` — the entity-status state machine is independent of the soft-delete column); (3) NO soft-delete column at all (used by `ownership`, `token`, `role_to_policy`, `dataset_field`, every M:N join table). The inconsistency means: querying "all live data sources" requires `WHERE deleted_at IS NULL`; querying "all live data entities" requires `WHERE deleted_at IS NULL AND status != 'DELETED'`; querying "all live tokens" or "all live ownerships" requires NO predicate because they are hard-deleted. A reader of the schema cannot tell from the schema alone which mechanism applies to a given table.

## Evidence

- `odd-platform-api/src/main/resources/db/migration/V0_0_64__remove_is_deleted_field.sql:1-105` — the convergence migration: dropped the parallel `is_deleted` boolean and added partial unique indexes scoped to `deleted_at IS NULL` across role, policy, namespace, data_source, collector, tag, term, metadata_field. The migration NAME ("remove_is_deleted_field") declares the intent: converge on `deleted_at` as canonical.
- `lineage/odd-platform/understanding/odd-platform__java__repository__reactive__repository__ReactiveDataSourceRepositoryImpl.md` — invariants section: "Three soft-delete mechanisms across the schema — observed at this repository through `deleted_at` column on data_source / namespace / token. The platform's soft-delete history: V0_0_1 introduced `is_deleted boolean DEFAULT FALSE`; V0_0_31 added `deleted_at TIMESTAMP DEFAULT NULL` PARALLEL to is_deleted; V0_0_64 DROPPED `is_deleted` and converged on `deleted_at IS NULL` as the canonical filter."
- `odd-platform-api/src/main/resources/db/migration/V0_0_28__add_token.sql:1-9` — `token` table schema: `id, value, created_at, created_by, updated_at, updated_by` — NO `deleted_at`. Tokens are never soft-deleted; they are rotated in-place (cf. ReactiveCollectorRepositoryImpl regenerateToken sidecar).
- `odd-platform-api/src/main/resources/db/migration/V0_0_3__add_ownership.sql:10-22` — `ownership` table schema: `id, data_entity_id, owner_id, role_id [later renamed title_id]` — NO `deleted_at`. Ownerships are HARD-DELETED via `DELETE FROM ownership` (`ReactiveOwnershipRepositoryImpl.java:85-91, 94-107`).
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveDataEntityRepositoryImpl.java` (cross-reference) — the data_entity STATUS column (`DataEntityStatusDto.DELETED`) is checked independently of `deleted_at IS NULL` in reads; `DataEntityStatusSwitchJob` (a `@Scheduled` job) moves entities into DELETED status (status mutation), then later HousekeepingJobManager hard-deletes them or sets `deleted_at`.
- `lineage/odd-platform/understanding/odd-platform__java__repository__reactive__repository__ReactiveDatasetFieldRepositoryImpl.md` — invariants section: "dataset_field has NO native soft-delete column" — every `delete(id)` is a hard DELETE.
- `lineage/odd-platform/understanding/odd-platform__java__repository__reactive__repository__ReactiveMetadataFieldRepositoryImpl.md` — invariants section: "Partial unique indexes do NOT include `deleted_at IS NULL`" — the metadata_field partial unique indexes still filter only by `origin`, so a soft-deleted INTERNAL metadata field's name remains blocked. Tag-side was fixed in V0_0_64; metadata_field-side was not. **The convergence is incomplete.**

## Notes

- **The deletion-semantics inconsistency is operator-observable.** An operator deleting a Collector then trying to re-create with the same name hits `UniqueConstraintException` (collector.name is FULL UNIQUE per V0_0_29:4 — NOT partial-scoped to deleted_at IS NULL); an operator deleting a Role then re-creating with the same name SUCCEEDS (role.name partial unique index per V0_0_55:42 + V0_0_64:88-90). Same operator action, different outcomes. The error message is the same shape ("Collector with this name already exists" vs "Role with this name already exists") but the cause is different (full vs partial unique constraint).
- **The metadata_field convergence gap is a real bug.** Soft-deleted INTERNAL metadata fields BLOCK re-creation of the same name because the partial unique index lacks `WHERE deleted_at IS NULL`. The READ side (`listInternalMetadata`) filters out soft-deleted via the soft-delete-base override; so an operator sees "this field doesn't exist" but cannot create it. There is no UI affordance, no service method to hard-delete a soft-deleted metadata_field.
- **The data_entity STATUS+deleted_at double-tracking is the most complex.** A DataEntity can be: (a) live (`status='LIVE' AND deleted_at IS NULL`), (b) status-deleted-but-row-present (`status='DELETED' AND deleted_at IS NULL` — the housekeeping waiting room), (c) soft-deleted (`deleted_at IS NOT NULL`), (d) hard-deleted (not in the table). The status-vs-deleted_at relationship is enforced by `DataEntityStatusSwitchJob` running on a separate cadence (10min) from `HousekeepingJobManager` (15min); these two `@Scheduled` jobs racing on the same thread (SHB-176) means the state machine can stall.
- **Ownerships are HARD-DELETED — operator cannot recover ownership history.** `OwnershipServiceImpl.delete` issues `DELETE FROM ownership` — the row is gone. The activity-feed handlers capture before/after state in the `activity` table (`AbstractOwnershipActivityHandler`), so an audit reviewer can reconstruct, but the `ownership` table itself has no history. Note: this is inconsistent with the rest of the platform's soft-delete posture.
- **The "three mechanisms" naming is the cross-cutting feature candidate.** No F-NNN anchors "deletion semantics consistency" as a feature. The operator-observable surface is: (a) which tables can I recover from after delete? (b) which delete operations leave audit trail? (c) which delete operations free a unique-name slot? The answers are all "it depends on the table" — and the substrate evidence for the answer lives in the migration files, not the documentation.
- This thread is `open` — the FEATURE name needs more thought. Candidates: `F-NNN — Platform-Wide Deletion Semantics`, `F-NNN — Soft-Delete vs Hard-Delete Per-Resource Contract`, or fold as a multi-feature drift facet (every F-NNN that includes a CRUD lifecycle would gain a `deletion_mechanism` field with values `soft-delete-deleted-at | status-and-deleted-at | hard-delete | no-delete-supported`).
- Related: F-031 (Data Source Lifecycle), F-020 (Collector Lifecycle), F-019 (Owner Lifecycle), F-028 (Namespace Lifecycle), F-002 (Term linking permission gate), F-006 (RBAC policy lifecycle — soft delete). All of these implicitly inherit the deletion-mechanism but none document the per-resource shape.

## Next

1. **Decide feature shape** — either (a) graduate `F-NNN — Platform-Wide Deletion Semantics Catalog` as a cross-cutting feature with per-resource enumeration; (b) update every existing lifecycle F-NNN with a `deletion_mechanism` facet. Recommend (a) — the consistency drift is the feature, and a single catalog gives BI / ETL / admin-script authors a single doc page to consult.
2. **Open follow-ups**:
   - REFACTOR-NNN — metadata_field partial unique index should be migrated to include `WHERE deleted_at IS NULL` (matching the Tag-side fix from V0_0_64); current behaviour blocks soft-deleted-then-recreate.
   - REFACTOR-NNN — collector.name should be migrated from FULL UNIQUE to partial unique `WHERE deleted_at IS NULL` to match the platform's recreation pattern.
   - REFACTOR-NNN — `ownership` deletion via hard-delete should be reconsidered; consider adding `deleted_at` to enable audit-trail recovery without depending on the `activity` table.
   - DOC-NNN — add a "Deletion Semantics" page to the operator docs enumerating each resource (DataSource, Collector, Owner, Namespace, Role, Policy, Tag, Term, Metadata Field, Ownership, Token, DataEntity, DatasetField) with its mechanism.
3. **Probe** — manually delete a Collector via UI, then re-create with the same name; confirm the UniqueConstraintException. Then delete a Role and re-create; confirm success. The contrast is the operator-observable manifestation of the inconsistency.
4. **Concept-merger candidate** — `three-soft-delete-mechanisms-across-the-repository-layer` should be promoted from a cross-sidecar reference into a canonical concept catalog entry with the full per-table enumeration.

## Links

- cluster_with: [F-019, F-020, F-028, F-031, F-006]
- merged_into: F-123
- supersedes: []

## evaluation

- **feature-flow-builder 2026-05-26**: graduate — evidence rich (4 substrate axes: SQL migration files + repository sidecars + invariants sections + concept-catalog cross-refs). Minted F-123 (P-08:F-016 Deletion Semantics Per-Resource Contract) with `sme_consultation_recommended: true` because the intent question (deliberate contract vs accidental drift) is not resolvable from code alone — needs data-platform-architect SME validation. Cluster_with [F-019, F-020, F-028, F-031, F-006] preserved as related lifecycle features.

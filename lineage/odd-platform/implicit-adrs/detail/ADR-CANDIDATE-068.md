## ADR-CANDIDATE-068 — Two-tier soft-delete inheritance taxonomy — `ReactiveAbstractSoftDeleteCRUDRepository` base provides `deleted_at` timestamp default; subclasses override `getDeleteChangedFields` + `addSoftDeleteFilter` for richer lifecycles (status-machine override at DataEntity)

**Severity**: HIGH
**Classification**: promote
**Support count**: 4 sidecars (this batch — DataEntity, Lineage, Policy, Alert; cross-batch evidence in earlier sidecars naming the base class)
**Axes present**: repositories

**Surfaced by**:
- `ReactivePolicyRepositoryImpl.md:implicit_adrs[0]` ("The `policy` table uses SOFT-DELETE inherited via `ReactiveAbstractSoftDeleteCRUDRepository.delete`")
- `ReactiveDataEntityRepositoryImpl.md:implicit_adrs[0]` ("Soft-delete is implemented via a STATUS-column state machine — the base class assumes `deleted_at`; this subclass overrides because data entities carry richer lifecycle")
- `ReactiveLineageRepositoryImpl.md:implicit_adrs[0]` ("Soft-delete is the canonical deletion mechanism for lineage edges — every read filters `is_deleted = false` and the only hard-delete path is the ingestion rewrite-by-establisher")
- `ReactiveAlertRepositoryImpl.md:implicit_adrs[0]` (cross-link via "the standard ODD pattern: service-layer transaction boundary, repository-layer pure query" — confirms the same base-class convention)

**Decision statement**: ODD's persistence layer codifies a **two-tier soft-delete taxonomy** at the repository inheritance level:

1. **Tier-1 (base)** — `ReactiveAbstractSoftDeleteCRUDRepository` extends `ReactiveAbstractCRUDRepository` and provides a single soft-delete column convention: a `deletedAtField` (defaulting to `DELETED_AT`, a TIMESTAMP column). The base implements three hook methods:
   - `getDeleteChangedFields()` — returns `Map.of(deletedAtField, DSL.localDateTime(DateTimeUtil.generateNow()))` — what fields the `delete(id)` UPDATE writes.
   - `addSoftDeleteFilter(Condition cond)` — appends `AND deletedAtField IS NULL` to every read.
   - `delete(id)` — issues `UPDATE table SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL RETURNING *`.
   The base's behaviour is: soft-deleted rows are invisible to `get` / `list`; double-deletion is a no-op (zero rows matched).

2. **Tier-2 (overrides)** — Subclasses that need a richer lifecycle override the hook methods AND pass `null` for the parent's `deletedAtField` constructor parameter. The `null` makes the parent's `deletedAtField`-touching helpers unusable, forcing the subclass to take complete ownership of the soft-delete semantics. The canonical example is `ReactiveDataEntityRepositoryImpl` (lines 103, 109-123):
   - Constructor: `super(..., DATA_ENTITY, DataEntityPojo.class, /*deletedAtField*/ null)`.
   - `getDeleteChangedFields()`: returns a map setting `STATUS = DELETED.code, STATUS_UPDATED_AT = NOW()` — soft-delete is a status-machine transition, not a timestamp write.
   - `addSoftDeleteFilter(Condition cond)`: returns `cond.and(DATA_ENTITY.STATUS.notEqual(DELETED.code))` — reads filter by status, not by deleted_at.

The decision codifies:
- **(a)** Soft-delete is the platform's DEFAULT deletion mechanism for all CRUDable platform entities (`policy`, `role`, `owner`, `data_source`, `collector`, `namespace`, `tag`, `term`, `data_entity` — every operator-facing entity inherits this base). Hard-delete is the EXCEPTION reserved for edge tables (Ownership per ADR-CANDIDATE-069) and ingestion-rewrite paths.
- **(b)** The base class's `deleted_at` timestamp is the convention; overrides exist to encode entity-specific lifecycle semantics (data_entity's five-status enum, alert's three-status enum, lineage's `is_deleted` boolean column with hard-delete-by-establisher exception). The override pattern is a maintainer-extension point: future entities with rich lifecycle can override without changing the base.
- **(c)** The `null deletedAtField` argument in subclass constructors is the architectural signal — "this subclass owns the soft-delete semantics; the parent's helpers don't apply here." The maintainer reading the constructor immediately sees the override commitment.

**Wisdom test**: PASS. All three questions resolve toward ADR:
1. *Intentional?* YES — the explicit override pattern at `ReactiveDataEntityRepositoryImpl.java:103, 109-123` is documentation-as-code; the `null` constructor argument is a deliberate signal. The base class is named `ReactiveAbstractSoftDeleteCRUDRepository` (not `ReactiveAbstractCRUDRepository`) — the soft-delete commitment is in the class name.
2. *Structural impact?* YES — affects every CRUDable platform entity's lifecycle, the housekeeping subsystem's hard-delete cadence (ADR-CANDIDATE-046), the partial unique-index pattern (ADR-CANDIDATE-070), the audit-trail strategy (the platform DOES preserve historical row state via soft-delete), and the schema migration discipline (every new entity must decide soft-delete-vs-hard-delete at table-creation time).
3. *Refactoring or structural?* STRUCTURAL — switching the platform to hard-delete-by-default would require changes to every controller's delete endpoint, every audit query, every recovery flow, and every operator-facing doc. Soft-delete is the architectural anchor.
→ ADR-CANDIDATE.

**Evidence**:
- `ReactivePolicyRepositoryImpl.md` says: "The `policy` table uses SOFT-DELETE (UPDATE setting `deleted_at = NOW()`, never DELETE FROM) — inherited via `ReactiveAbstractSoftDeleteCRUDRepository.delete` (ReactiveAbstractSoftDeleteCRUDRepository.java:50-59,61-74). The decision is encoded structurally — this repository extends the soft-delete base class rather than the non-soft-delete `ReactiveAbstractCRUDRepository`"
- `ReactiveDataEntityRepositoryImpl.md` says: "Soft-delete is implemented via a STATUS-column state machine (DELETED is one of 5 statuses) rather than the conventional `deleted_at` timestamp column. The base class assumes `deleted_at`; this subclass overrides because data entities carry richer lifecycle (STABLE / DEPRECATED / DRAFT / UNASSIGNED / DELETED) where DELETED is just one terminal state."
- `ReactiveLineageRepositoryImpl.md` says: "Soft-delete is the canonical deletion mechanism for lineage edges — every read filters `is_deleted = false` and the only hard-delete path is the ingestion rewrite-by-establisher (batchDeleteByEstablisherOddrn). The schema enforces this at V0_0_79__data_deprecation.sql:11-12 (`NOT NULL DEFAULT FALSE`)"

**Existing ADR**: none. Composes with:
- **ADR-CANDIDATE-058** (closed five-member status enum + soft-delete-as-state for data_entity) — specialises this ADR for the data_entity lifecycle.
- **ADR-CANDIDATE-069** (NEW — edge tables are hard-delete) — the complementary exception that defines when soft-delete does NOT apply.
- **ADR-CANDIDATE-070** (NEW — partial unique index `name WHERE deleted_at IS NULL`) — the DB-layer enforcement enabled by the soft-delete model.
- **ADR-CANDIDATE-067** (existing — `@ReactiveTransactional` boundary asymmetry at the service) — soft-delete is the read-side filter; the boundary is the write-side composition.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-230 (`getRolesPolicies` does NOT filter soft-deleted policies — RBAC hot path gap; the base class's `addSoftDeleteFilter` is NOT applied to custom JOINs unless the subclass adds it manually).
- REFACTOR-239 (`is_deleted` boolean column on `policy` table is dead schema — the soft-delete base writes only `deleted_at`).
- REFACTOR-198 (cross-batch, batch F — `applyStatus` ordering bug nulls `statusUpdatedAt` on every transition; defeats the data_entity housekeeping TTL).

**Proposed action**: Promote to `adrs/drafts/two-tier-soft-delete-taxonomy.md` (new ADR). Document:
- The base class contract (`deleted_at` timestamp default + three hook methods).
- The override pattern (subclass passes `null` for parent's `deletedAtField`; overrides the three hook methods).
- The hard-delete exception (edge tables — see ADR-CANDIDATE-069).
- The DB-layer enforcement pattern (partial unique index — see ADR-CANDIDATE-070).
- The maintainer-extension contract: future entities with rich lifecycle inherit the same pattern.
- The forensic / audit-trail consequence: soft-deleted rows preserve history until the housekeeping TTL fires hard-delete.

Cross-link with the housekeeping subsystem ADRs (ADR-CANDIDATE-045/-046) which govern the eventual hard-delete cadence.

**Severity rationale**: HIGH — codebase-wide lifecycle architecture. The soft-delete contract affects every CRUDable platform entity, every audit query, every operator-facing delete UX, every doc page that discusses lifecycle, every future entity added to the schema, and the housekeeping subsystem's behaviour. Compatible-change calculus for ANY future maintainer requires understanding this two-tier model.

## STRENGTHENS — Batch N (Term + Role + UserOwnerMapping primary-source — 3 additional repository confirmations)

**Three additional batch-N repository sidecars confirm the two-tier soft-delete taxonomy as base-class-only with no overrides at these tables**:

1. **ReactiveTermRepositoryImpl** — Term is base-tier soft-delete. The class extends `ReactiveAbstractSoftDeleteCRUDRepository<TermRecord, TermPojo>` (line 79); every read filters `TERM.DELETED_AT IS NULL` (verified at 13 distinct sites: lines 143, 156, 188, 234, 257, 279, 367, 387, 403, 432, 451, 461, 505). The partial unique index `term_name_namespace_unique ON term(name, namespace_id) WHERE deleted_at IS NULL` (V0_0_35:16) implements the soft-delete-aware uniqueness rule (composes with ADR-CANDIDATE-070).
2. **ReactiveRoleRepositoryImpl** — Role is base-tier soft-delete. The class extends `ReactiveAbstractSoftDeleteCRUDRepository` (line 28); standard CRUD is entirely inherited. `getDto` / `listDto` / `getByName` apply `addSoftDeleteFilter` on the ROLE table (lines 47, 56, 89). The `is_deleted` column was historically present (V0_0_55:38) but DROPPED by V0_0_64 — the schema cleanly converged on `deleted_at` as the sole soft-delete signal. This is the CLEANER mirror of batch-H Policy (where `is_deleted` remains in the DDL as dead schema per REFACTOR-239).
3. **ReactiveUserOwnerMappingRepositoryImpl** — user_owner_mapping is base-tier soft-delete. All three 'delete' methods (deleteRelation lines 56-62, deleteActiveRelationByOwner lines 65-74, implicit clear in createRelation lines 47-48) are UPDATE statements setting `DELETED_AT = generateNow()`. The migration V0_0_89's sequence `ADD COLUMN deleted_at` + `DROP CONSTRAINT user_owner_mapping_owner_id_key` + `CREATE UNIQUE INDEX ... WHERE deleted_at IS NULL` IS the decision narrative; the maintainer EXPLICITLY converted a hard-delete schema (V0_0_4) into a soft-delete schema (V0_0_89). Importantly, the user_owner_mapping table uses the CLEAR-ACTIVE-THEN-INSERT pattern (ADR-CANDIDATE-129 NEW) instead of upsert specifically to PRESERVE the soft-delete-history audit trail — soft-delete is load-bearing for audit substrate here.

**Cross-tier consistency observation (batch N)**: The taxonomy at base-tier reaches across the RBAC surface (Role + UserOwnerMapping) AND the glossary surface (Term) AND the tag-directory surface (Tag — ReactiveTagRepositoryImpl batch N also extends `ReactiveAbstractSoftDeleteCRUDRepository<TagRecord, TagPojo>` at line 44 with `tag.deleted_at` per V0_0_64:95-108). Four NEW confirmations join the four batch-H originals — the base class is now used at 8+ repositories with documented `deleted_at` column at every table. Tier-2 overrides remain limited to `data_entity` (status-machine — ADR-CANDIDATE-058) and `data_entity_lineage_edges` (is_deleted boolean — batch H ReactiveLineageRepositoryImpl).

**New batch-N cross-surface gap**:
- REFACTOR-357 NEW — `ReactiveRoleRepositoryImpl.getDto/listDto/getByName` does NOT filter `policy.deleted_at IS NULL` on the LEFT JOIN feeding `jsonArrayAgg(POLICY.asterisk())` — symmetric mirror of batch-H REFACTOR-230 (the policy-side); now BOTH halves of the RBAC role-policy retrieval surface have the soft-delete-filter gap on custom JOINs. The `addSoftDeleteFilter` helper from the base class is NOT applied to custom JOINs unless the subclass adds it manually — this is the maintainer-extension contract failure at TWO sites (Role + Policy).
- REFACTOR-356 NEW — `term_to_term.deleted_at` retained in V0_0_91 schema but never filtered at 7+ read sites in `ReactiveTermRepositoryImpl` — either dead schema (candidate for V0_0_NNN migration mirroring V0_0_76's data_entity_to_term cleanup) or missing-filter. Today no code path writes `term_to_term.deleted_at` so the concern is theoretical, but the inconsistency against V0_0_76's hard-delete decision is the architectural drift.

**Severity unchanged**: HIGH — the four NEW confirmations strengthen the codebase-wide claim. The soft-delete taxonomy now has primary-source evidence across 8+ repositories spanning every major pillar (P-01, P-06, P-08, P-09). The gap surface (REFACTOR-357 — Role mirror of REFACTOR-230) is REPEATED — two service-layer defences (PolicyServiceImpl.delete + RoleServiceImpl.delete) cover the same kind of orphan-binding-grants-permissions risk, with NO repository-layer defence in either.

---

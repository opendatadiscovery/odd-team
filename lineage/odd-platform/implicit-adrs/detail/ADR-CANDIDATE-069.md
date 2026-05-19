## ADR-CANDIDATE-069 — Edge tables are HARD-DELETE by design; reconstruction relies on the activity-feed audit trail — the architectural exception to the soft-delete-by-default convention (ADR-CANDIDATE-068)

**Severity**: MEDIUM
**Classification**: promote
**Support count**: 1 sidecar (this batch — Ownership) + cross-migration evidence (V0_0_76 explicit rename)
**Axes present**: repositories, schema

**Surfaced by**:
- `ReactiveOwnershipRepositoryImpl.md:implicit_adrs[0]` (the explicit hard-delete-by-design statement with migration-history evidence)

**Decision statement**: ODD's `ownership` table — and by extension every **edge/join table** between hard-deletable entities — is HARD-DELETE by design. The choice is explicit in two migrations:
- **`V0_0_3__add_ownership.sql:10-22`** deliberately OMITS a `deleted_at` column when the `ownership` table is created.
- **`V0_0_76__term_relations_hard_delete.sql:8-13`** RENAMED the `term_ownership` table to remove its `deleted_at` column — confirming the design intent: ownership-edge tables that originally had soft-delete are MIGRATED TO hard-delete.

The repository implementation cements the decision: `ReactiveOwnershipRepositoryImpl.delete(id)` (line 86-89) and `deleteByDataEntityAndOwner(...)` (lines 102-104) are physical `DELETE FROM ownership WHERE ...` statements; no soft-delete code path exists. The class extends `ReactiveAbstractCRUDRepository` (NOT `ReactiveAbstractSoftDeleteCRUDRepository`).

The architectural choice codifies:
- **(a)** Edges between hard-deletable entities don't need their own soft-delete. The reasoning: an edge between A and B is a derived concept — if A is soft-deleted, the edge (A, B) is meaningless; if A is hard-deleted (after the TTL), the edge MUST be hard-deleted to satisfy FK integrity. Maintaining soft-delete on the edge would create orphan rows referencing soft-deleted entities; the soft-delete-aware reads would have to JOIN the entities and filter their `deleted_at` — adding cost on every read. Hard-delete eliminates the orphan problem at the schema level.
- **(b)** Historical state reconstruction is delegated to the **activity-feed audit trail**. `OwnershipServiceImpl.delete` (line 77) carries `@ActivityLog(event = OWNERSHIP_DELETED)`; the activity event captures the deleted ownership pre-state. A forensic query "who was the owner of entity X on date Y" is answered by replaying the activity feed, not by querying soft-deleted ownership rows.
- **(c)** The pattern applies to every edge table in the schema. Cross-confirmation: `term_ownership` was MIGRATED from soft-delete to hard-delete (`V0_0_76`); `tag_to_data_entity`, `data_entity_to_term`, `role_to_policy` (the policy JOIN target referenced in REFACTOR-230) — all use the same hard-delete-only pattern. The migrations consistently OMIT `deleted_at` on edge tables.
- **(d)** The exception is intentional: edge tables are NOT in scope for the soft-delete ADR-CANDIDATE-068 contract. The maintainer reading a schema migration that omits `deleted_at` on an edge table sees this ADR; the audit-trail expectation is the substitute for soft-delete's "I can undo" property.

**Wisdom test**: PASS. All three questions resolve toward ADR:
1. *Intentional?* YES — the V0_0_76 migration is the canonical intent anchor: a deliberate RENAME of an existing table to remove `deleted_at`. The migration file's name (`V0_0_76__term_relations_hard_delete.sql`) is itself the architectural statement. The original `V0_0_3__add_ownership.sql` declined to add `deleted_at` at creation time — another positive choice.
2. *Structural impact?* YES — affects every edge-table CRUD, the activity-emission contract on every edge mutation, the audit-trail replay model, the FK cascade strategy. Operators and future maintainers see "if it's an edge, it's hard-delete" as the rule.
3. *Refactoring or structural?* STRUCTURAL — switching edges to soft-delete would require: (i) every edge table schema migration to add `deleted_at`; (ii) every edge repository to extend the soft-delete base; (iii) every edge read to filter `deleted_at IS NULL`; (iv) every FK to handle the orphan-edge-to-soft-deleted-entity case; (v) every activity-handler to consider whether soft-delete or hard-delete fired. A structural redesign, not a refactor.
→ ADR-CANDIDATE.

**Evidence**:
- `ReactiveOwnershipRepositoryImpl.md` says: "The migration `V0_0_3__add_ownership.sql:10-22` deliberately omits a `deleted_at` column, in contrast to `data_entity`, `owner`, `dataset_field`, and other domain entities that DO carry `deleted_at`. The `term_ownership` sibling table similarly removed its `deleted_at` column in `V0_0_76__term_relations_hard_delete.sql:8-13` — confirming the design pattern: ownership-edge tables are hard-delete; reconstruction relies on the activity-feed audit trail."
- `V0_0_76__term_relations_hard_delete.sql` — the filename itself is the architectural commit message.
- `OwnershipServiceImpl.java:77` — `@ActivityLog(event = OWNERSHIP_DELETED)` is the audit-trail substitute.

**Existing ADR**: none. Composes with:
- **ADR-CANDIDATE-068** (NEW — two-tier soft-delete taxonomy) — this ADR is the architectural EXCEPTION that defines the boundary of -068's domain. Together they describe the full lifecycle rule: "domain entities are soft-delete + housekeeping-TTL hard-delete; edge tables are hard-delete + activity-feed audit trail."
- ADR-CANDIDATE-067 (existing — `@ReactiveTransactional` boundary asymmetry) — the activity-emission lives inside the transaction; rollback also rolls back the audit event. The hard-delete + audit-emission pair is atomic.

**Co-surfaced gaps** (link from `refactoring-scopes.md`): none directly; the architectural choice is sound. The ADR's RISK is the dependence on the activity-feed being intact and retained — see REFACTOR-085 (no activity retention; the activity table grows without time-based purge). If activity-feed retention is ever added, edge-table reconstruction beyond the retention window becomes impossible.

**Proposed action**: Promote to `adrs/drafts/edge-tables-are-hard-delete.md` (new ADR). Document:
- The architectural rule (edges are hard-delete; domain entities are soft-delete).
- The migration discipline (V0_0_3, V0_0_76 as case studies).
- The activity-feed audit-trail substitute (and the cross-link with REFACTOR-085's no-retention gap).
- The FK cascade strategy (edge tables CASCADE on entity hard-delete from housekeeping).
- The maintainer-extension contract: future edge tables follow this pattern; future schema migrations on existing soft-delete tables MIGHT migrate to hard-delete (per V0_0_76 precedent) if the table is reclassified as an edge.

Cross-link with the housekeeping subsystem ADRs (ADR-CANDIDATE-045/-046) and the activity-feed retention discussion (REFACTOR-085) — the trio together describes the data-retention architecture of the platform.

**Severity rationale**: MEDIUM — pattern-shaping decision that affects every edge table in the schema. Less codebase-wide than ADR-CANDIDATE-068 (which affects every CRUDable entity), but the same conceptual depth — the rule for "edge vs domain" is structural.

---

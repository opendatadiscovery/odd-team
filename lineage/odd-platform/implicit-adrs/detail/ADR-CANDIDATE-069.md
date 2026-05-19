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

## STRENGTHENS — Batch N (Tag-relation + Term-link-table primary-source — 7 NEW edge-table tables confirm the pattern; V0_0_91 term_to_term asymmetry surfaced as drift)

**Two batch-N repository sidecars confirm the edge-table hard-delete pattern at SEVEN additional join tables**:

1. **ReactiveTagRepositoryImpl** — Tag's three relation tables (`tag_to_data_entity`, `tag_to_dataset_field`, `tag_to_term`) are hard-delete by design. The class extends `ReactiveAbstractSoftDeleteCRUDRepository<TagRecord, TagPojo>` (line 44) for the TAG DIRECTORY entry, but every `delete*Relations` method uses `DSL.delete(...)` (hard delete) at lines 217-323 (six hard-delete methods spanning the three relation tables). The asymmetric base-class choice (soft-delete on directory; hard-delete on relations via direct DSL) is the architectural statement. Implicit_adrs[3] in the sidecar names this explicitly: "Soft-delete on `tag`, hard-delete on `tag_to_*` relations". Composes with ADR-CANDIDATE-128 NEW (the `onDuplicateKeyIgnore` create-side that matches the hard-delete delete-side — relation rows EITHER exist OR don't; there's no soft-state-in-between).

2. **ReactiveTermRepositoryImpl** — Term has THREE link tables all hard-delete: `data_entity_to_term`, `dataset_field_to_term`, `tag_to_term`. The V0_0_76 migration (`V0_0_76__term_relations_hard_delete.sql:1-22`) is named verbatim — the maintainer DELETED rows with `deleted_at IS NOT NULL` then DROPPED the column at THREE places. The V0_0_77 migration extended the PK to include `is_description_link` (lines 13-14, 28-29) — that PK extension ONLY works with hard-delete semantics (a soft-deleted row would block re-insertion of the same `(de, term, FALSE)` tuple).

3. **NEW asymmetric drift surface — `term_to_term`**: V0_0_91 (`V0_0_91__add_term_to_term.sql:6`) RETAINS `deleted_at TIMESTAMP` on the `term_to_term` link table — UNLIKE its V0_0_76-cleaned siblings. The application code at 7 distinct read sites (lines 198-199, 227-231, 324-325, 345, 429-430, 448-454, 472-491, 510-523 of ReactiveTermRepositoryImpl) DOES NOT filter `term_to_term.deleted_at IS NULL`. This is either:
   - **(a) Dead schema** — the V0_0_76 hard-delete decision was intended for ALL term-link tables but the V0_0_91 migration was incomplete; a future V0_0_NNN migration mirroring V0_0_76's data_entity_to_term cleanup would close the inconsistency.
   - **(b) Missing-filter** — the V0_0_91 migration deliberately retained the column for a future soft-delete feature that has not been implemented; the application code missed adding the filter.

   Either way, the asymmetry against the V0_0_76 hard-delete decision is the architectural drift. Documented as REFACTOR-356 NEW (HIGH — schema-vs-application drift on a load-bearing audit-trail table). Today no code path writes `term_to_term.deleted_at`, so the concern is theoretical; but a direct DB UPDATE setting it (operator hot-fix) would NOT remove the relationship from any read path, producing soft-delete-resurrection behaviour that NO other term-link table exhibits.

**Cross-batch maintainer-extension reinforcement**: The V0_0_76 migration's pattern (RENAME the table, DROP COLUMN deleted_at) is now triangulated against TWO migration generations: V0_0_3 (original Ownership omission) + V0_0_76 (term relations cleanup) + V0_0_77 (PK-extension that depends on hard-delete) + V0_0_91 (term_to_term inconsistency — to be resolved). The architectural rule "edges are hard-delete" is the dominant pattern with one documented exception that REFACTOR-356 captures as a conformance task.

**New batch-N gap surfaces**:
- REFACTOR-356 NEW — `term_to_term.deleted_at` retained in V0_0_91 but never filtered at 7+ read sites; schema-vs-application drift (HIGH).
- REFACTOR-380 NEW — Tag resurrection of soft-deleted tag does NOT restore relations (the architecture's accept-the-risk clause: hard-delete-relations means resurrected tags lose attachment history).

**Severity unchanged**: MEDIUM — the additional confirmations strengthen the pattern. The seven NEW edge-tables (3 Tag-relation + 3 Term-link + 1 term_to_term) bring the total to 10+ edge tables documented under this ADR. The V0_0_91 inconsistency is itself the ADR's first documented drift — recorded as a conformance task per the maintainer-extension contract.

---

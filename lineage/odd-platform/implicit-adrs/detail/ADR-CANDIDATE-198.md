## ADR-CANDIDATE-198 — Activity table is APPEND-ONLY by design — `ReactiveActivityRepositoryImpl` does NOT extend any `ReactiveAbstract*CRUDRepository` inheritance; the schema has NO `updated_at` or `deleted_at` column; the interface declares ONLY save + find + count methods, no delete + no update — type-level encoding of "audit rows are immutable history"

**Severity**: MEDIUM
**Classification**: promote (new — type-level architectural distinction)
**Support count**: 2 sidecars (`ReactiveActivityRepositoryImpl` PRIMARY-SOURCE + `ActivityEmptyPartitionsHousekeepingJob` confirms via the partition-only retention strategy)
**Axes present**: repository-inheritance, schema-design, interface-method-surface
**Pillars affected**: P-01, P-09 — audit-log immutability, data-architecture

**Surfaced by**:
- `ReactiveActivityRepositoryImpl.md:implicit_adrs[4]` (PRIMARY-SOURCE — "**Repository implements interface directly — NO ReactiveAbstract*CRUDRepository inheritance**: line 45 `class ReactiveActivityRepositoryImpl implements ReactiveActivityRepository` — there is no `extends ReactiveAbstractSoftDeleteCRUDRepository` or `extends ReactiveAbstractCRUDRepository`. The decision encodes that activity rows are APPEND-ONLY: no `delete(long)`, no `update(...)`, no `idCondition(...)`, no `addSoftDeleteFilter`. The schema HAS `created_at` and `created_by` but NO `updated_at` or `deleted_at` column. Combined with the lack of a `paginate(...)` call (Stress Protocol C1), this is the strongest architectural distinction between this repository and the rest of the data layer")
- `ActivityEmptyPartitionsHousekeepingJob.md:implicit_adrs[1]` (CONFIRMS — "Empty-only contract preserved by template method: the abstract parent class does NOT expose a 'drop by date' or 'drop all past' API; the only exported behaviour is 'past AND empty'. Concrete subclasses cannot bypass the empty-check because they only inject the target-table name. The 'empty partitions' promise in the class name is structurally enforced" — the partition-only retention strategy is consistent with append-only row-level immutability)
- `ReactiveActivityRepositoryImpl.java:45` (verified — class declaration, no `extends`)
- `ReactiveActivityRepository.java:11-87` (the interface — 8 methods: 2 save + 4 find + 2 count; NO delete; NO update)
- `V0_0_48__add_activity.sql:1-13` (the schema — `id BIGSERIAL`, `data_entity_id BIGINT NOT NULL`, `event_type SMALLINT NOT NULL`, `old_state JSONB`, `new_state JSONB`, `is_system_event BOOLEAN NOT NULL`, `created_at TIMESTAMP NOT NULL`, `created_by VARCHAR(512)` — NO `updated_at`, NO `deleted_at`)

**Decision statement**: The platform's activity table is APPEND-ONLY by structural design. The maintainer's commitment is encoded at THREE distinct levels:

1. **Class-level (Java type)**: `ReactiveActivityRepositoryImpl` (`:45`) implements `ReactiveActivityRepository` directly — does NOT extend `ReactiveAbstractCRUDRepository` (which would provide `delete()`, `update()`) OR `ReactiveAbstractSoftDeleteCRUDRepository` (which would provide `softDelete()`, `restore()`, `addSoftDeleteFilter()`). The class does NOT inherit any CRUD machinery beyond what `ReactiveActivityRepository` declares.

2. **Interface-level (method surface)**: `ReactiveActivityRepository.java:11-87` declares ONLY:
   - `Mono<ActivityPojo> saveReturning(ActivityPojo)` — single-row INSERT
   - `Mono<Void> save(List<ActivityPojo>)` — batch INSERT
   - `Flux<ActivityDto> findAllActivities(...)` — read
   - `Flux<ActivityDto> findMyActivities(...)` — read
   - `Flux<ActivityDto> findDependentActivities(...)` — read
   - `Flux<ActivityDto> findDataEntityActivities(...)` — read
   - `Mono<Long> getTotalActivitiesCount(...)` — count
   - `Mono<Long> getMyObjectsActivitiesCount(...)` — count

   No `delete(...)`, no `update(...)`, no `softDelete(...)` declared. The interface is a CLOSED contract for append-only access.

3. **Schema-level (Postgres table)**: `V0_0_48__add_activity.sql:1-13` has NO `updated_at` column, NO `deleted_at` column. The table is structurally immutable at the row level — there is no mechanism to update a row's content or mark it as soft-deleted. Rows can only be INSERTed and then read.

The decision INTENT is to make audit rows IMMUTABLE HISTORY:
- An audit row, once written, is a fact-of-record. Modifying it would break the audit-trail contract.
- The only retention mechanism is at the PARTITION level — drop EMPTY past partitions (per `ActivityEmptyPartitionsHousekeepingJob` + ADR-CANDIDATE-199 NEW).
- Row-level deletes via `DELETE FROM activity WHERE ...` are STRUCTURALLY UNAVAILABLE (no DELETE method on the repository, no DELETE machinery via inheritance).

The decision contrasts with the platform's OTHER repositories (which use `ReactiveAbstractSoftDeleteCRUDRepository` — per ADR-CANDIDATE-068 — for data-entity / role / policy / owner lifecycle). Activity is the ARCHITECTURAL EXCEPTION.

**Wisdom test (3-question)**:
1. *Intentional?* YES — multiple converging signals:
   - The class-level absence of `extends` is verifiable at one line of code (`:45`).
   - The interface-level absence of delete/update methods is verifiable (8 methods named).
   - The schema-level absence of `updated_at`/`deleted_at` columns is verifiable (13-line migration).
   - The CONTRASTING pattern (sibling repositories inherit CRUD) is the proof-of-deliberate-deviation.
2. *Structural impact?* YES — defines the audit-row immutability contract for the entire feature. Compliance use-cases (SOX, GDPR records-of-processing) depend on audit-row immutability.
3. *Refactoring or structural?* STRUCTURAL — adding row-level mutability would require:
   - Adding methods to `ReactiveActivityRepository` interface (breaking change).
   - Adding columns to the activity table (schema migration).
   - Reasoning about INSERT-vs-UPDATE-vs-DELETE semantics throughout the audit-trail consumers.
   NOT a refactor.

→ ADR.

**Evidence**:
- `ReactiveActivityRepositoryImpl.md` says: "Repository implements interface directly — NO ReactiveAbstract*CRUDRepository inheritance — APPEND-ONLY at the type level"
- `ReactiveActivityRepositoryImpl.java:45` (`class ReactiveActivityRepositoryImpl implements ReactiveActivityRepository` — no extends)
- `V0_0_48__add_activity.sql:1-13` (no `updated_at`, no `deleted_at`)
- `ReactiveActivityRepository.java:11-87` (the 8-method contract — no delete, no update)
- intent_anchor: the SAME maintainer wrote 17 other repositories that DO inherit CRUD machinery; the deliberate choice to NOT inherit here signals "this is structurally different".

**Existing ADR**: STRENGTHENS / COMPOSES with:
- ADR-CANDIDATE-068 (existing — Two-tier soft-delete inheritance taxonomy — `ReactiveAbstractSoftDeleteCRUDRepository` base provides `deleted_at` timestamp default; subclasses override richer lifecycles). This ADR-198 is the EXCEPTION to ADR-068: activity is APPEND-ONLY and does NOT inherit the base. ADR-198 makes the exception explicit.
- ADR-CANDIDATE-069 (existing — Edge tables are HARD-DELETE by design; reconstruction relies on the activity-feed audit trail — the architectural exception to soft-delete-by-default). This ADR-198 EXPLAINS WHY the audit trail can be relied upon for reconstruction: because activity rows are immutable.
- ADR-CANDIDATE-195 (NEW from this batch — data-entity-scoped audit log) — composes: data-entity-scoped AND append-only AND transactionally-consistent.
- ADR-CANDIDATE-196 (NEW from this batch — activity-emit transactional coupling) — composes with append-only: rows are committed-once OR not-at-all (no partial UPDATE).
- ADR-CANDIDATE-199 (NEW from this batch — empty-only partition drop) — composes with append-only: retention is at the PARTITION level, not the ROW level.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-085 (existing — activity table monotonic growth — the consequence of append-only without row-level retention)
- REFACTOR-570 (NEW from this batch — strengthens REFACTOR-085 with FK-cascade concerns)
- REFACTOR-557 (NEW from this batch — empty-check + drop race) — composes with the partition-only retention; the race window is bounded by the partition-level retention strategy

**Proposed action**: Promote to `adrs/drafts/activity-table-append-only.md`. Document:
- The three-level encoding (class, interface, schema).
- The architectural exception framing — this is the deliberate deviation from ADR-068's soft-delete taxonomy.
- The audit-trail immutability contract for compliance use-cases.
- The retention strategy: partition-level only (cross-link to ADR-CANDIDATE-199).
- The cross-reference to REFACTOR-085 (growth) as the operational consequence.
- The future-design hook: if row-level retention is needed (e.g. for GDPR right-to-erasure of specific events), a NEW design would be required (out-of-scope for this ADR).

**Severity rationale**: MEDIUM — type-level architectural distinction. The decision IS sound (audit immutability) and well-encoded at three levels. The cost is operational (REFACTOR-085 growth) which is captured separately. Promoting to ADR codifies the deliberate-exception framing for future maintainers.

**Cross-pillar bump**: P-01 × P-09 — audit-log immutability + data-architecture. Severity stays MEDIUM.

**Suggested backlog grouping**: ADR draft. Pair with ADR-CANDIDATE-068 (soft-delete taxonomy) and ADR-CANDIDATE-199 (partition-only retention) for the complete activity-lifecycle architectural pack.

---

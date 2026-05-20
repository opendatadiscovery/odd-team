## ADR-CANDIDATE-125 — Partial-unique-index + `ON CONFLICT WHERE deleted_at IS NULL DO UPDATE SET name = EXCLUDED.name` is the platform's idempotent-upsert race-protection idiom for ingestion-side novel-name creation — the no-op `DO UPDATE` is a deliberate RETURNING-trigger that surfaces the existing-row id

**Severity**: HIGH
**Classification**: promote
**Pillars affected**: [P-01-data-discovery, P-08-management, P-10-integrations]
**Support count**: 1 sidecar (batch N ReactiveTagRepositoryImpl `ingestData`) — primary-source; cross-batch-related to ADR-CANDIDATE-070 (partial unique index as schema-layer enforcement)
**Axes present**: repositories
**Batch**: N (2026-05-19)

**Surfaced by**:
- `ReactiveTagRepositoryImpl.md:implicit_adrs.[0]` (HIGH) — "Partial-unique-index-as-race-protection — `tag_name_unique ON tag (name) WHERE tag.deleted_at IS NULL` is the platform's only locking mechanism for the auto-create-on-miss path. The `ingestData` upsert (`:204-210`) leans on `ON CONFLICT (name) WHERE deleted_at IS NULL DO UPDATE SET name = EXCLUDED.name` to make concurrent novel-name inserts idempotent without an application-level lock; the same mechanism does NOT protect the `bulkCreate` path used by `TagServiceImpl.getOrCreateTagsByName` (no `onConflict` clause inherited). Three migrations (`V0_0_36`, `V0_0_57`, `V0_0_64`) iterated on this index — a deliberate design choice and the load-bearing protection." — intent_anchor: "`DROP INDEX IF EXISTS tag_name_unique; CREATE UNIQUE INDEX IF NOT EXISTS tag_name_unique ON tag (name) WHERE tag.deleted_at IS NULL;` (V0_0_64:103-105) — the explicit re-creation after the `is_deleted` column removal is the maintainer-authored statement that the partial filter is the protection"
- `ReactiveTagRepositoryImpl.md:implicit_adrs.[2]` (HIGH) — "RETURNING-trigger via no-op `DO UPDATE SET name = EXCLUDED.name` — the upsert sets the conflicting row's name to itself (`DSL.excluded(TAG.NAME)` at `:209`). The semantic-equivalent of `DO NOTHING` would NOT return the existing row's id; the no-op update exists solely to trigger the RETURNING clause. The caller (`TagServiceImpl.getOrInjectTagByName`) needs the id of every row (existing or newly inserted) to build `TagToDataEntityPojo` relations. This is a deliberate trade-off: a per-row touch on every ingestion-time conflict in exchange for caller convenience."

**Decision statement**: ODD's ingestion-side novel-name auto-create surface uses a **partial-unique-index + ON CONFLICT DO UPDATE-no-op-SET** idiom to make concurrent same-name inserts idempotent WITHOUT application-level locking AND to guarantee the caller receives the row's `id` regardless of whether the row was newly-inserted or already-existed.

The canonical implementation is `ReactiveTagRepositoryImpl.ingestData(List<TagPojo>)` (lines 191-213):

```java
// Conflict target dynamically resolved from the jOOQ index handle:
final List<Field<Object>> conflictFields = Indexes.TAG_NAME_UNIQUE.getFields()
    .stream().map(of -> field(of.getName())).toList();

InsertOnDuplicateSetStep<TagRecord> upsert = DSL.insertInto(TAG)
    .columns(TAG.NAME)
    .values(/* per-row name */)
    .onConflict(conflictFields)
    .where(TAG.DELETED_AT.isNull())        // matches the partial-index predicate
    .doUpdate()
    .set(TAG.NAME, DSL.excluded(TAG.NAME)) // ← THE NO-OP: name = name
    .returning();
```

The choice composes three deliberate design elements:

1. **Partial-unique-index as the race-protection mechanism** — `tag_name_unique ON tag (name) WHERE tag.deleted_at IS NULL` (V0_0_64:103-105) is the DB-layer concurrent-write serialisation point. Two simultaneous `INSERT TAG ('PII')` from parallel ingestion pipelines hit the index: ONE wins, the OTHER triggers `ON CONFLICT`. No `SELECT ... FOR UPDATE`, no advisory lock, no application-level mutex. The DB-side partial index IS the only protection.
2. **DO UPDATE SET name = EXCLUDED.name is a no-op WITH RETURNING semantics** — the maintainer chose `DO UPDATE` over `DO NOTHING` deliberately. The semantic difference: `DO NOTHING` would not produce a RETURNING row for the existing row (the INSERT was suppressed); `DO UPDATE SET name = name` performs an UPDATE statement that DOES participate in RETURNING. The caller (`TagServiceImpl.getOrInjectTagByName`) needs the id of every row (existing or newly inserted) to build `TagToDataEntityPojo` relations. The no-op update is a per-row touch — accepted as the cost of caller convenience.
3. **WHERE clause matches the partial-index predicate** — the `.where(TAG.DELETED_AT.isNull())` at line 207 is the application-side echo of the index's `WHERE deleted_at IS NULL`. The two predicates MUST match — if a future migration broadens the index (e.g., adds `AND important IS NOT NULL`), the `ON CONFLICT` would not match and PostgreSQL would raise a unique-violation that translates to `UniqueConstraintException` on every Collector push. The coupling is documented as REFACTOR-379 (LOW; the hardcoded predicate is a maintainer-extension warning).

The architecture pays explicit costs:
- **(a) Per-row update touch** on every ingestion conflict — `tag.name` is overwritten with itself (no change, but the row's MVCC version increments). Postgres tolerates this; the cost is per-row I/O on each conflict resolution.
- **(b) Hard-coded `WHERE` predicate** — the application code must stay in sync with the partial index's predicate. A future migration change requires editing both places.
- **(c) Dual-contract write paths** — `ingestData` (upsert, idempotent) is the conflict-tolerant path used by ingestion; `bulkCreate` inherited from `ReactiveAbstractCRUDRepository` (no `onConflict`, fail-on-duplicate) is the operator-explicit path used by `TagController.createTag`. The duality is intentional (see ADR-CANDIDATE-127 NEW) but introduces a TOCTOU surface in `TagServiceImpl.getOrCreateTagsByName` (REFACTOR-358 — uses `listByNames + bulkCreate`, not the safe `ingestData`).

**Wisdom test**: PASS on all three questions.
1. **Intentional?** YES — the three migrations (V0_0_36 / V0_0_57 / V0_0_64) iteratively refined the partial index; the V0_0_64 migration's name (`remove_is_deleted_field`) plus the explicit `DROP INDEX ... CREATE UNIQUE INDEX ... WHERE deleted_at IS NULL` (V0_0_64:103-105) is the maintainer's signature on the design. The no-op `DO UPDATE SET name = EXCLUDED.name` is a deliberate choice — `DO NOTHING` would have been the lazy alternative.
2. **Structural impact?** YES — affects every ingestion-side novel-entity-name path (today Tag; tomorrow potentially Owner, Title, Term per the auto-create-on-miss family). Affects the schema migration discipline (every new ingestion-target table needs a partial unique index). Affects the application-vs-schema coupling (the WHERE-predicate match is structural).
3. **Switching to advisory locks or SELECT FOR UPDATE is REFACTORING or STRUCTURAL?** STRUCTURAL — switching to advisory locks would require an `advisory_lock_id` registry (REFACTOR-183 cross-cutting); switching to `SELECT FOR UPDATE` would force a transaction boundary; switching to a separate "claim a name" subsystem would require multi-step orchestration. The current pattern is the architectural anchor for fast, lock-free ingestion-side novel-name handling.

**Evidence**:
- ReactiveTagRepositoryImpl.md says: "Partial-unique-index-as-race-protection — `tag_name_unique ON tag (name) WHERE tag.deleted_at IS NULL` is the platform's only locking mechanism for the auto-create-on-miss path. The `ingestData` upsert (`:204-210`) leans on `ON CONFLICT (name) WHERE deleted_at IS NULL DO UPDATE SET name = EXCLUDED.name` to make concurrent novel-name inserts idempotent without an application-level lock"
- V0_0_64__remove_is_deleted_field.sql:103-105 — the migration that converged on the partial-index design
- ReactiveTagRepositoryImpl.java:199-210 — the `onConflict + WHERE + doUpdate + DSL.excluded` jOOQ DSL chain

**Existing ADR**: none. **Composes with ADR-CANDIDATE-070** (partial unique index as soft-delete-aware name uniqueness — the DB-layer enforcement). **Composes with ADR-CANDIDATE-065** (Tag auto-create-on-miss IS INTENTIONAL — this ADR is the SQL-level mechanism that makes -065's spec-acknowledged behaviour race-safe). **Composes with ADR-CANDIDATE-126 NEW** (dynamic conflict-target via Indexes.X.getFields() — this ADR's jOOQ idiom that frees the conflict target from hardcoded TAG.NAME literal). **Composes with ADR-CANDIDATE-127 NEW** (dual-contract write paths — bulkCreate fail-on-duplicate vs ingestData upsert).

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-358 NEW — `TagServiceImpl.getOrCreateTagsByName` uses unsafe `listByNames + bulkCreate` (NOT the safe ingestData) — TOCTOU race produces UniqueConstraintException → 500 on the user (HIGH).
- REFACTOR-379 NEW — hardcoded `WHERE TAG.DELETED_AT.isNull()` predicate at line 207 couples the repository's correctness to the index predicate; a future migration broadening the index breaks the upsert (LOW).

**Proposed action**: Promote to `adrs/drafts/partial-unique-index-on-conflict-do-update-noop.md` (new ADR). Document:
- The SQL pattern (`onConflict(...).where(predicate).doUpdate().set(col, EXCLUDED.col).returning()`).
- The RETURNING-trigger trick (why DO UPDATE SET col = col, not DO NOTHING).
- The migration discipline (every new ingestion-target table needs a partial unique index AND a matching `WHERE` predicate in the application code).
- The cross-link with ADR-CANDIDATE-065 / -070 / -126 / -127.
- The TOCTOU gap surface (REFACTOR-358 — the bulkCreate path is NOT covered by this protection).
- The maintainer-extension contract: ANY future "auto-create-on-miss" feature MUST use the `ingestData`-style upsert, NOT a `listBy + bulkCreate` pattern.

**Severity rationale**: HIGH — load-bearing for the ingestion-side auto-create surface. Affects every Collector push that names a new Tag (currently the only ingestion-side use case but the pattern is intended to extend to Owner / Title / Term auto-create-on-miss family per the cross-pillar findings in REFACTOR-223). A regression replacing the partial-index with a full-unique-index (or dropping the partial filter) would break the soft-delete-aware recreate UX (ADR-CANDIDATE-070); replacing the no-op DO UPDATE with DO NOTHING would break the RETURNING-id contract that downstream callers depend on. Compatible-change calculus requires this ADR.

---

## REFACTOR-236 — Alert reopen-guard read-then-write race lacks DB-level UNIQUE constraint backstop (SQL-layer confirmation; STRENGTHENS REFACTOR-037)

**Severity**: MEDIUM
**Category**: race-condition (defence-in-depth at SQL layer)
**Surfaced by**:
- `ReactiveAlertRepositoryImpl.md:bugs_limitations_corner_cases[1]`
- `ReactiveAlertRepositoryImpl.md:security.known_security_gaps[2]`

**Description**: This finding is the SQL-layer primary-source confirmation of the previously-recorded REFACTOR-037 (reopen-guard race at the service layer). The repository-level evidence completes the picture:

1. **The read**: `openAlertWithTheSameTypeExistsForDataEntity` (`ReactiveAlertRepositoryImpl.java:397-420`) is a read-only `SELECT EXISTS` over a self-join CTE. There is **no `FOR UPDATE`**, **no `FOR SHARE`** clause; the read does not acquire any row lock.
2. **The write**: `updateAlertStatus` (`ReactiveAlertRepositoryImpl.java:297-306`) is a single-row UPDATE. There is no SELECT FOR UPDATE preceding it; the UPDATE acquires Postgres MVCC's default row-level lock during execution but nothing stops a concurrent transaction from passing the EXISTS check.
3. **The composition**: `AlertServiceImpl.updateStatus` (lines 124-131) composes the read and write outside any `@ReactiveTransactional` boundary (note: `updateStatus` deliberately lacks the annotation per `ReactiveAlertRepositoryImpl.md:concepts.invariants[1]`). Two concurrent reopen requests for two different alerts of the same type on the same data entity can BOTH pass the EXISTS check (each query sees the other in RESOLVED state) and BOTH proceed to UPDATE.
4. **The structural backstop is absent**: there is NO `CREATE UNIQUE INDEX ... WHERE status = 'OPEN'` partial-index constraint on the ALERT table. The schema permits multiple OPEN rows for the same (data_entity_oddrn, type) at the storage level.

REFACTOR-037 (existing, batch B) named the service-layer guard. This finding (NEW 2026-05-19) confirms at the SQL primary source:
- The exact line of the unfenced read (`ReactiveAlertRepositoryImpl.java:397-420`).
- The exact line of the unfenced write (`ReactiveAlertRepositoryImpl.java:297-306`).
- The absence of the DB-level UNIQUE constraint backstop (verified across all migrations).
- The deliberate `@ReactiveTransactional` absence on `updateStatus` (per `ReactiveAlertRepositoryImpl.md:concepts.invariants[1]` and the comment at `ReactiveAlertRepositoryImpl.java:130-132` framing the FOR UPDATE intent ONLY for the ingestion path — `getOpenAlertsForEntities` — not the status-mutation path).

**Primary source citations**:
- `ReactiveAlertRepositoryImpl.java:397-420` — `openAlertWithTheSameTypeExistsForDataEntity` (the read, no FOR UPDATE)
- `ReactiveAlertRepositoryImpl.java:297-306` — `updateAlertStatus` (the write, no FOR UPDATE)
- `AlertServiceImpl.java:124-131` — the unsequenced read-then-write composition
- `ReactiveAlertRepositoryImpl.java:130-132` — the comment that frames FOR UPDATE intent for ingestion-only ("preventing potential concurrent issues" for FDQT alerts)
- absence of `CREATE UNIQUE INDEX ... WHERE status = 'OPEN'` in any of the alert-related migrations (verified across all 91 migration files per the substrate)
- cross-batch: REFACTOR-037 (the existing service-layer naming of the same gap)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-073 (NEW — selective FOR UPDATE on ingestion-read paths only) is the architectural intent: the platform deliberately uses row locks on ingestion but NOT on status mutations. The trade-off is documented in the inline comment. The reopen-guard race is the **price** of that ADR — the maintainer accepted application-level guards because under typical operator-driven status flips the concurrency is low. The gap is that the price is not enforced by any structural backstop.

**Proposed remedy**: Two-path:
1. **DB-level enforcement** (preferred): add a partial unique index migration:
   ```sql
   CREATE UNIQUE INDEX IF NOT EXISTS alert_one_open_per_type_per_entity
   ON alert (data_entity_oddrn, type) WHERE status = 'OPEN';
   ```
   Any concurrent second OPEN-of-same-type-on-same-entity attempt fails at the DB layer with `UniqueConstraintException`, translated by `ExceptionUtils` (per ADR-CANDIDATE-071) to HTTP 400 + a friendly message. The race becomes safe.
2. **Application-level transactional fence** (fallback if (1) is rejected): add `@ReactiveTransactional(isolation = SERIALIZABLE)` to `AlertServiceImpl.updateStatus` and rely on Postgres SSI to detect the read-write conflict at commit time. Side effect: some valid transactions will retry. Acceptable for an operator-driven flow but adds latency on every status flip.

Option (1) is strictly preferable: structural enforcement, zero application change beyond error handling, no retry semantics needed, and the unique index also documents the invariant for future maintainers.

**Severity rationale**: MEDIUM — data-integrity gap. The duplicate OPEN alerts are confusing (operator sees two copies of the same alert) and break the invariant the comment at line 130-132 expressed for the ingestion path. Not a security issue per se — the gap doesn't grant unauthorized access — but the eventual-consistency state after a race is hard to reason about and contradicts the platform's documented one-OPEN-per-type-per-entity model.

**Suggested backlog grouping**: `Alert reliability cleanup` — bundle with REFACTOR-037 (the existing service-layer naming) and REFACTOR-233 (the listByOwner empty-result count bug; same controller surface). Migration goes alongside the next housekeeping or RBAC migration.

---

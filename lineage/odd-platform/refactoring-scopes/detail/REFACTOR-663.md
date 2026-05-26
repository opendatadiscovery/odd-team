## REFACTOR-663 — DatasetFieldController's `createEnumValue` has NO concurrency control — two concurrent POSTs against the same `datasetFieldId` produce silent last-write-wins; both READ-COMMITTED transactions softDeleteExcept-then-bulkCreate; whichever commits LAST wipes the other's writes

**Severity**: HIGH
**Category**: data-loss-on-concurrent-write
**Batch**: ZG (2026-05-25)
**Pillars affected**: [P-01 Data Discovery (column-level enum values), P-08 Concurrency control]

**Surfaced by**:
- `odd-platform__java__DatasetFieldController__controller-class__DatasetFieldController.md:bugs_limitations_corner_cases.[11]` (HIGH) — "**`createEnumValue` has NO concurrency control — two concurrent POSTs against the same datasetFieldId produce silent last-write-wins.** Each transaction at READ-COMMITTED isolation reads the pre-T2 state, softDeleteExcept its idsToKeep, bulkCreates its body, commits. Whichever transaction COMMITS LAST has its softDeleteExcept run AFTER the other's writes — wiping them. There is no optimistic-lock version check, no advisory lock at the dataset_field_id level, no SERIALIZABLE isolation declaration."

**Statement**: `createEnumValues` runs inside `@ReactiveTransactional` at PostgreSQL's default READ-COMMITTED isolation level. Two concurrent submits against the same `datasetFieldId` race:

```
Time  T1 (3 items: A,B,C)            T2 (3 items: D,E,F)
----  -----------------------------  -----------------------------
t0    BEGIN
t1                                   BEGIN
t2    softDeleteExcept(field, {})    softDeleteExcept(field, {})
        ↓ wipes pre-T1 state           ↓ wipes pre-T2 state (which is post-T1's delete-state)
t3    bulkCreate(A, B, C)            
t4    COMMIT  ← state: A, B, C
t5                                   bulkCreate(D, E, F)
t6                                   COMMIT  ← state: D, E, F
                                       ↑ T1's writes are GONE
```

The bug:
- T2 reads state at t1 (pre-T1's COMMIT) — the row count is what it was before T1 started
- T2 softDeleteExcept at t2 — deletes all rows visible to T2 (the pre-T1 state)
- T2 commits at t6 — after T1's commit, T2's state replaces T1's state
- T1's items A, B, C are gone

There is NO defence:
- No optimistic-lock `version` column on `enum_value`
- No advisory lock at `dataset_field_id` level (e.g., `SELECT pg_advisory_xact_lock(...)`)
- No SERIALIZABLE isolation declaration
- No precondition `If-Match` header support

Operator-visible failure mode:
- Two operators editing the same field's enum values via the UI concurrently (one via UI, one via API; or two via UI with stale caches) — whichever submits LAST wins.
- An API consumer running batch updates against many fields in parallel may overwrite its own writes if the same field is hit twice in flight.
- The UI typically issues one PUT per form-submission, so the race window is small for single-user flows; the window opens for multi-user / parallel-API scenarios.

**Evidence**:
- Service tx scope: `EnumValueServiceImpl.java:39-82` (no lock, no version check)
- `@ReactiveTransactional` at default READ-COMMITTED isolation
- No `OptimisticLockingFailureException` import; no version column on `enum_value` table (would surface in migration history but is not present)
- Hypothesis: `lineage/odd-platform/probes/P-154.yaml`

**Existing-ADR-or-implied-prescription**: no governing ADR specifically defends the absence of concurrency control. The REPLACE-AS-STATE choice (ADR-CANDIDATE-226 NEW) is orthogonal — additive-PATCH semantics would have the same concurrency hazard.

**Proposed remedy**:
- **Option A (advisory lock)**: prepend `SELECT pg_advisory_xact_lock(hash('enum_value', :datasetFieldId))` at the start of the transaction. Serialises concurrent submits on the same field. Lowest-friction fix.
- **Option B (optimistic lock)**: add a `version` column to `enum_value`; require client to supply `If-Match` header with the version; reject on mismatch with HTTP 409. Operator-visible — clients must handle 409 retries.
- **Option C (SERIALIZABLE isolation)**: declare `@ReactiveTransactional(isolation = Isolation.SERIALIZABLE)`. Postgres-supported; raises serialization errors on conflict; client retries. Higher overhead per transaction.

Option A is the smallest change with no client-side impact; closes the race without changing the wire contract.

**Severity rationale**: HIGH — silent data loss on concurrent writes; no defence-in-depth; the operator has no signal that their write was overwritten. Cross-link with REFACTOR-586 (data_source no optimistic lock) + REFACTOR-210 (data-entity status concurrent PUTs) — same shape; same prescription.

**Suggested backlog grouping**: `Concurrency control audit` (paired with REFACTOR-586, REFACTOR-210, REFACTOR-011 — chunks race-overwrite).

**Coherence check** (LSN-018):
- STRENGTHENS: REFACTOR-586 (data_source no optimistic lock); REFACTOR-210 (data-entity status concurrent PUT race); REFACTOR-011 (attachment chunks race-overwrite) — all variants of "no concurrency control on a mutation surface".
- SUPERSEDES: none.
- CONFLICTS: none.

---

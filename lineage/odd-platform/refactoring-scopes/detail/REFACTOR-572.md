## REFACTOR-572 — `ReactiveActivityRepositoryImpl.save(List<ActivityPojo>)` partial-commit semantics under reactive `.zipWith` chunk error — N events submitted, chunk 3 of 5 fails → chunks 1, 2 already INSERTed but error surfaces; partial audit data committed with no compensating delete

**Severity**: MEDIUM (audit-trail completeness gap; forensic-integrity violation under failure)
**Category**: deferred-failure
**Surfaced by**:
- `ReactiveActivityRepositoryImpl.md:bugs_limitations_corner_cases[5]` (CANARY HEADLINE — "**`save(List<ActivityPojo>)` partial-commit semantics under reactive-Mono.zip error**: line 62-70 dispatches to `executeInPartition` which chunks at 1000 rows and reduces via `.zipWith(Integer::sum)`. If chunk 3 of 5 fails... chunks 1, 2, and any chunk that completed before chunk-3's error already INSERTed to PG (no transaction wraps the chunked save at this level). The result: a `save(List<ActivityPojo>)` call that surfaces an error to the caller has nonetheless committed PARTIAL audit data. AlertServiceImpl which calls this method twice (lines 258, 324) with multiple alert events could see N/2 alert-receive activity rows committed and N/2 lost, with no compensating delete" — MEDIUM)
- `ReactiveActivityRepositoryImpl.md:security.known_security_gaps[4]` ("Partial-commit on batch `save(List<ActivityPojo>)` leaves audit gaps: a failed batch save... commits the successful chunks while surfacing the error to the caller — the audit trail has 'holes' that an attacker triggering ingestion-side errors could exploit to hide individual events" — MEDIUM)
- `ReactiveActivityRepositoryImpl.java:57-71` (the `save(List)` method — verified delegation to `executeInPartition`, no `@Transactional` / `Mono.usingWhen`)
- `JooqReactiveOperations.java:24, 51-67` (the shared `BATCH_SIZE=1000` constant + `executeInPartition` implementation — verified no rollback path; `.reduce((m1, m2) -> m1.zipWith(m2, Integer::sum))` pattern)
- `AlertServiceImpl.java:252-258, 318-324` (the batch-emit callers — verified to invoke `createActivityEvents` which chains to `save(List)`)

**Description**: `ReactiveActivityRepositoryImpl.save(List<ActivityPojo>)` (`:57-71`) chunks the input at 1000 rows via `JooqReactiveOperations.executeInPartition`:

```java
public Mono<Void> save(List<ActivityPojo> activities) {
  return jooqReactiveOperations.executeInPartition(
    activities, 
    activitiesChunk -> {
      // emit INSERT VALUES (...), (...), ... statement for the chunk
      return jooqReactiveOperations.mono(insertChunkQuery);
    }
  ).then();
}
```

The `executeInPartition` (line 51-67 of `JooqReactiveOperations`) implements:

```java
public <T, R> Mono<R> executeInPartition(List<T> items, Function<List<T>, Mono<R>> action) {
  List<List<T>> chunks = chunk(items, BATCH_SIZE);
  return Flux.fromIterable(chunks)
    .flatMap(action)               // executes per-chunk concurrently (default parallelism)
    .reduce((m1, m2) -> m1.zipWith(m2, Integer::sum));
}
```

**The failure semantics**:
- Each `action(chunk)` returns a `Mono<Integer>` (row-count).
- `.flatMap(action)` subscribes to each chunk's Mono concurrently (default concurrency = Integer.MAX_VALUE).
- Each chunk INSERTs to Postgres via R2DBC connection acquired from the pool. The INSERT commits per-chunk (R2DBC autocommit).
- `.reduce(...)` waits for ALL chunk Monos to complete (success or error) THEN composes.
- If chunk 3's INSERT raises an error (e.g. constraint violation, partition coverage gap, connection lost), the `.reduce` propagates the error to the outer Mono.
- BUT chunks 1, 2, 4, 5 (whichever completed-success before chunk-3's error) have ALREADY committed their INSERTs.

**There is NO transactional wrapper at this level** — the `save(List)` method does not call `Mono.fromCallable(() -> DSL.using(...).transaction(ctx -> ...))` or similar. The chunked INSERTs commit independently per chunk.

**The operator-visible consequence**: AlertServiceImpl's batch-emit calls (lines 252-258 — `registerAutomaticallyResolvedAlertsActivityEvents` for ALERT_STATUS_UPDATED; lines 318-324 — `registerNewAlertsActivityEvents` for OPEN/RESOLVED_ALERT_RECEIVED) invoke `createActivityEvents(events)` which delegates to `save(List<ActivityPojo>)`. If the platform receives 50 alerts in a single batch:
- Chunks of 1000 (50 fits in one chunk → single INSERT)... OR for larger batches (1500 alerts), TWO chunks.
- A failure on chunk 2 leaves chunk 1's events committed, chunk 2 NOT committed, and the operator sees "failure" on the alert-batch processing.
- The audit trail has HOLES for the failed chunk; no compensating mechanism reconstructs the missing events.

**The structural fix**: wrap the entire batch in a single transaction.

**Cross-cutting context**: This is the **partial-commit-without-rollback defect class** in reactive batch INSERTs. Standard fix: wrap in `Mono.usingWhen` with the connection / transaction. The cost is performance (one connection holds across N chunks) — but for audit logs the correctness trade-off favours atomicity.

**Primary source citations**:
- `ReactiveActivityRepositoryImpl.java:57-71` (verified `save(List)` — no transaction wrapper)
- `JooqReactiveOperations.java:51-67` (verified `executeInPartition` — concurrent flatMap, no rollback)
- `JooqReactiveOperations.java:24` (`BATCH_SIZE = 1000` — the shared constant)
- `AlertServiceImpl.java:252-258, 318-324` (the batch-emit callers)
- `ActivityIngestionRequestProcessor.java:24-32` (the ingestion-FINALIZING DATA_ENTITY_CREATED batch-emit caller — also affected)

**Existing-ADR-or-implied-prescription**: NONE. The `executeInPartition` primitive is the project-wide convention (per ADR-CANDIDATE-???). It is used by every batched INSERT. The defect is the absence of a transactional wrap at the activity-save level.

**Proposed remedy**: Two options:

1. **LOWEST cost — wrap `save(List)` in a single transaction**:
   ```java
   public Mono<Void> save(List<ActivityPojo> activities) {
     return jooqReactiveOperations.mono(connection ->
       DSL.using(connection).transaction(ctx -> {
         // execute all chunks within the SAME transaction
         return Flux.fromIterable(chunk(activities, BATCH_SIZE))
           .concatMap(chunkOfRecords -> {
             // INSERT VALUES (...) for the chunk
             return ctx.insertInto(ACTIVITY, ACTIVITY.fields()).values(chunkOfRecords).execute();
           })
           .then();
       })
     );
   }
   ```
   The entire batch commits-or-rolls-back atomically. Cost: one connection held for the duration of the batch (vs. N connections in the current parallel pattern). Performance trade-off favours correctness for audit.

2. **MEDIUM cost — explicit compensating delete on partial-failure**:
   Track the row-ids committed by successful chunks; on failure of any chunk, issue a DELETE for the committed-but-orphaned rows. Mechanically more complex; preserves the parallel-INSERT performance.

**Recommended**: Option 1 — wrap in a transaction. The performance cost (sequential chunk INSERT vs concurrent) is negligible at typical batch sizes (50-500 rows for alerts, hundreds for ingestion); the correctness benefit is substantial.

**Severity rationale**: MEDIUM — audit-trail completeness gap. Severity is bounded by:
- The defect triggers under chunk-INSERT failures, which are rare (constraint violations, partition gaps, network blips).
- The failed batches surface errors to the caller — operators know SOMETHING failed; they just don't know exactly what.
- The fix is local to the activity-save method; no cross-cutting impact.

**Suggested backlog grouping**: `SEC-NNN activity-audit correctness sprint`. Pair with REFACTOR-556 (transactional coupling), REFACTOR-566 (non-idempotency), REFACTOR-560 (system_event flag asymmetry). The five activity-audit-correctness scopes together define the audit-trail trust contract.

---

## REFACTOR-558 — Concurrent `@ActivityLog` mutations on the same data entity capture the SAME pre-mutation `oldState`; the second handler's diff is wrong-by-construction — audit-log attribution misattributes the second actor's change to the first actor's window

**Severity**: HIGH (forensic-integrity violation)
**Category**: race-condition
**Surfaced by**:
- `ActivityHandler.md:stress_findings.S-E-2` (CANARY HEADLINE — ORDERING RACE — "both transactions start `getContextInfo` with the same pre-mutation owners. Tx A runs its mutation, Tx B runs its mutation. Tx A's `getUpdatedState` reads post-A state; Tx B's `getUpdatedState` reads post-A+post-B state... Both ActivityPojo rows show `pre-mutation → post-A+post-B`, with two rows attributed to A and B" — probe P-019)
- `ActivityHandler.md:bugs_limitations_corner_cases[0]` ("OLD-vs-NEW state race: two concurrent `@ActivityLog`-annotated mutations on the SAME data entity both capture `oldState = pre-mutation`, both wrapped mutations run interleaved, and `getUpdatedState` (called after each mutation completes) sees the AFTER-BOTH state. Handler A's emitted ActivityPojo records `pre-mutation → after-A+B` (wrong: A only saw its own change happen). Handler B records the same. The Activity Feed shows two activity rows each claiming credit for the other's change." — HIGH)
- `ActivityHandler.md:stress_findings.S-E-6` ("Stale-read within transaction" — composes with S-E-2 under READ_COMMITTED isolation)
- `ActivityAspect.java:48-58` (the pre-mutation capture — `getContextInfo` runs BEFORE `joinPoint.proceed()`)
- `ActivityServiceImpl.java:65-69` (the `getContextInfo` orchestration)
- `ActivityAspect.java:82` (the post-mutation `getUpdatedState` read)
- Probe `P-019` (`lineage/odd-platform/probes/P-019.yaml`) — pending experimental confirmation

**Description**: The `@ActivityLog` AOP framework (`ActivityAspect.java:41-95`) wraps each annotated business method with this orchestration:

```
@Around("@ActivityLog")
@ReactiveTransactional
public Mono<?> monoActivityAspect(ProceedingJoinPoint joinPoint, ActivityLog activityLog) {
  return getContextInfo(activityLog, joinPoint.getArgs())     // PRE-mutation snapshot (line 48)
    .flatMap(info -> joinPoint.proceed()                        // business mutation (line 62)
      .flatMap(result -> postActivity(info, joinPoint, activityLog)));  // POST-mutation snapshot + diff + emit (line 82)
}
```

`getContextInfo` (line 48) dispatches to the appropriate `ActivityHandler.getContextInfo(...)` impl which reads the CURRENT state of the data entity via a DB query (e.g. `DescriptionUpdatedActivityHandler` reads `dataEntity.internal_description`). This read captures the pre-mutation state ONCE before the wrapped method begins.

Under concurrent mutations by two different users (Alice and Bob) on the SAME data entity:

```
T=0: Alice's mutation begins; pre-mutation state captured (description = "hello").
T=1: Bob's mutation begins; pre-mutation state captured (description = "hello" — SAME, no mutation yet committed).
T=2: Alice's mutation executes — UPDATE description = "hello-A"; commits.
T=3: Alice's `getUpdatedState` reads post-mutation state (description = "hello-A"); emits activity row { oldState: "hello", newState: "hello-A", actor: alice }.
T=4: Bob's mutation executes — UPDATE description = "hello-B" (overwriting Alice's); commits.
T=5: Bob's `getUpdatedState` reads post-mutation state (description = "hello-B"); emits activity row { oldState: "hello", newState: "hello-B", actor: bob }.
```

**The CORRECT audit trail** would show:
- Alice: `oldState: "hello", newState: "hello-A"` ✓
- Bob: `oldState: "hello-A", newState: "hello-B"` (Bob mutated Alice's update) ✗ — but actual emits `oldState: "hello"`.

**Bob's emitted diff is WRONG**: he captured pre-mutation `oldState` at T=1 (before Alice committed at T=2). His row shows the state changing from "hello" → "hello-B", erasing the fact that Alice was the one who changed it from "hello" → "hello-A" first. A future operator reading the audit trail to investigate "who changed description from hello-A to hello-B" finds NO row matching that diff — both rows show pre-state "hello", neither bridges the Alice → Bob transition.

**Cross-cutting context**: Under READ_COMMITTED isolation (the R2DBC default), `getContextInfo`'s read at T=1 sees the most-recent-committed state, NOT a snapshot at T=0. If Alice committed at T=0.5, Bob's `getContextInfo` at T=1 would see "hello-A" — the race window is between Alice's commit time and Bob's `getContextInfo` execution. If they run truly concurrent (Bob's `getContextInfo` fires before Alice's COMMIT lands), both see "hello".

The race is structural: `getContextInfo` is called OUTSIDE the joinPoint TX boundary. Even though the wrapping `@ReactiveTransactional` (`ActivityAspect.java:42`) opens a TX, the `getContextInfo` read happens BEFORE the wrapped business method runs — so the read snapshot is at the start of the TX, not at the moment of the mutation. Two TXs that begin at the same moment see the same pre-mutation state regardless of which commits first.

**Operator-visible consequence**: forensic integrity violation. The audit trail's `oldState`/`newState` diff is the primary tool for incident response ("who changed X from Y to Z?"). The race produces audit rows whose diff is INCORRECT — they show changes that don't actually occurred at the recorded times. Severity bounds:
- Visible only on collision-prone fields (description, business_name, tags) under genuinely concurrent edits.
- Most platform deployments have few concurrent editors per entity in practice — the race triggers under hot collaborative editing.
- The activity feed UI displays the rows side-by-side; a manual reviewer can spot the contradiction (two rows with same `oldState`).

**The structural fix**: capture `oldState` INSIDE the same TX as the mutation (not before). This is the standard "pessimistic read-lock + capture" pattern for audit trails. The CURRENT design (capture before TX) was chosen for reactive-composition simplicity at the aspect layer; the cost is paid in audit correctness under concurrent edits.

**Primary source citations**:
- `ActivityAspect.java:48` (`getContextInfo(activityLog, joinPoint.getArgs())` — the pre-mutation capture site)
- `ActivityAspect.java:62` (`joinPoint.proceed()` — the wrapped business mutation; runs AFTER the capture)
- `ActivityAspect.java:82` (`postActivity` — the post-mutation `getUpdatedState` read)
- `ActivityServiceImpl.java:65-69` (the `getContextInfo` orchestration — dispatches to `ActivityHandler.getContextInfo`)
- `ActivityHandler.java:12` (the handler interface — `getContextInfo` is the READ-only capture method)
- 16 of 18 concrete handler implementations (each reads from the repository at the moment `getContextInfo` is invoked — verified by inspection)
- Probe `P-019` for experimental confirmation under live concurrent mutation

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-200 (NEW — ActivityHandler is a state-snapshot differ) codifies the read-only stance. The "capture before TX" choice is a structural consequence of placing `getContextInfo` outside `joinPoint.proceed()` in `ActivityAspect`. There is no explicit ADR defending the placement; the absence is paid in audit-correctness under concurrent edits.

ADR-CANDIDATE-073 (Selective `FOR UPDATE` on ingestion-read paths only) is the contrasting pattern — for ingestion (non-user-driven), the platform explicitly serializes via `FOR UPDATE`. For user-driven mutations (the `@ActivityLog` AOP path), there is no equivalent serialization.

**Proposed remedy**: Two options:

1. **MEDIUM cost — move `getContextInfo` INSIDE the joinPoint TX boundary**:
   ```java
   @Around("@ActivityLog")
   @ReactiveTransactional
   public Mono<?> monoActivityAspect(...) {
     return Mono.defer(() -> {
       // BOTH the context capture AND the business mutation run in the same TX
       return getContextInfo(activityLog, joinPoint.getArgs())
         .flatMap(info -> Mono.fromCallable(() -> joinPoint.proceed())
           .flatMap(result -> postActivity(info, joinPoint, activityLog))
         );
     });
   }
   ```
   Under SERIALIZABLE or REPEATABLE READ isolation, the pre-mutation snapshot is consistent with the start-of-TX. Under READ_COMMITTED (the default), still racey but smaller window. The fix-fix is to also use SERIALIZABLE isolation on `@ActivityLog`-annotated methods.

2. **HIGHER cost — pessimistic `SELECT ... FOR UPDATE` in `getContextInfo`**: Modify each `ActivityHandler.getContextInfo` impl to acquire a row-lock on the target data entity via `FOR UPDATE`. The lock prevents concurrent mutations from observing inconsistent pre-states; serializes the audit-write per-entity. UX trade-off: concurrent edits on the same entity SERIALIZE — Bob waits for Alice's mutation to complete before he can begin his own. May be acceptable for a small platform; degrades collaborative editing throughput on hot entities.

**Recommended**: Option 1 (move `getContextInfo` inside TX + SERIALIZABLE isolation) — most architecturally clean. The remaining race window under READ_COMMITTED is acceptable for non-hot entities; for hot entities, escalate to SERIALIZABLE per-method via the aspect.

**Severity rationale**: HIGH — forensic integrity violation. The audit trail is the primary tool for incident response and compliance audits; rows with incorrect `oldState`/`newState` diffs undermine the trust contract. The race triggers under concurrent collaborative editing — which is exactly the operational state where audit-trail trustworthiness matters most. Severity is bounded by:
- The race requires genuinely concurrent edits on the SAME entity within a millisecond window — empirically rare.
- The audit UI's side-by-side rendering allows a manual reviewer to spot the contradiction (two rows, same `oldState`).
- No business data is corrupted — only the audit diff is wrong.

**Suggested backlog grouping**: `SEC-NNN activity-audit correctness sprint`. Pair with REFACTOR-556 (transactional coupling — also activity-audit-correctness), REFACTOR-566 (activity emit non-idempotency), REFACTOR-561 (spurious activity events from row-order non-determinism — also activity-audit-correctness). The four findings collectively define the "activity audit log is approximate, not authoritative" framing.

---

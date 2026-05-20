## ADR-CANDIDATE-200 — `ActivityHandler` is a STATE-SNAPSHOT DIFFER (read-only contract), NOT a write-handler — interface declares only read methods; diff computation lives outside in `ActivityAspect.postActivity`; the read-only stance is the deliberate failure-mode-isolation choice: a handler's mistake at worst produces a wrong DIFF (visible to operator), never a wrong WRITE (corrupting business state)

**Severity**: MEDIUM
**Classification**: promote (new — codifies the intentional read-only-interface design)
**Support count**: 2 sidecars (`ActivityHandler` PRIMARY-SOURCE + `ActivityServiceImpl` confirms via the orchestration pattern)
**Axes present**: interface-design, AOP-orchestration, failure-mode-isolation
**Pillars affected**: P-01, P-05 — activity-audit, AOP-framework

**Surfaced by**:
- `ActivityHandler.md:implicit_adrs[0]` (PRIMARY-SOURCE — "**State-snapshot differ pattern over write-handler pattern**: the interface defines READ-only methods (`getContextInfo` + `getUpdatedState`); diff computation lives outside in `ActivityAspect.postActivity` (`:81-95`). The decision is intentional: keeping handlers read-only means a handler's mistake at worst produces a wrong DIFF (visible to operator), not a wrong WRITE (corrupting business state). The aspect's transactional wrap makes the audit-emit failure roll back the business mutation — `audit or nothing` semantic" — confidence: HIGH; intent_anchor: "the interface signature `Mono<ActivityContextInfo> getContextInfo(...)` and `Mono<String> getUpdatedState(...)` — both READ; no `Mono<Void> write(...)` analogue. The aspect's `@ReactiveTransactional` on the around-advice is the explicit coupling")
- `ActivityServiceImpl.md:upstream_callers` (corroborates — "`ActivityAspect.postActivity` invokes `getContextInfo` (pre-mutation), `getUpdatedInfo` single-id (post-mutation), `createActivityEvent`. The PRIMARY write funnel for 10 service files / 18+ `@ActivityLog`-annotated methods")
- `ActivityHandler.java:9-22` (verified — 4 method signatures, all READ-only: `isHandle()` boolean, `getContextInfo()` Mono, `getUpdatedState()` Mono single-id, `getUpdatedState()` Mono multi-id)
- `ActivityAspect.java:48, 82, 86, 94` (the orchestration around the read-only handler: pre-capture at 48, post-capture at 82, diff at 86, write at 94)
- The 18 concrete `service/activity/handler/*.java` implementations — verified by inspection — ALL provide only read-only methods

**Decision statement**: The `ActivityHandler` interface (`:9-22`) is deliberately designed as a READ-ONLY contract for state-snapshot capture. The four methods are:

```java
public interface ActivityHandler {
  boolean isHandle(ActivityEventTypeDto eventType);
  Mono<ActivityContextInfo> getContextInfo(Map<String, Object> parameters, Long dataEntityId);
  Mono<String> getUpdatedState(Map<String, Object> parameters, Long dataEntityId);
  default Mono<Map<Long, String>> getUpdatedState(Map<String, Object> parameters, List<Long> dataEntityIds) {
    return Mono.error(new UnsupportedOperationException(...));
  }
}
```

ALL FOUR methods are READ-ONLY by signature:
- `isHandle` returns boolean (dispatch question).
- `getContextInfo` returns `Mono<ActivityContextInfo>` (PRE-mutation snapshot).
- `getUpdatedState(parameters, Long)` returns `Mono<String>` (POST-mutation snapshot, JSON-serialized).
- `getUpdatedState(parameters, List<Long>)` returns `Mono<Map<Long, String>>` (batch POST-mutation snapshot).

There is NO `Mono<Void> write(...)`, no `void handle(...)`, no method that mutates state.

**The orchestration architecture** (the WHY):
The actual write happens OUTSIDE the handler — at `ActivityAspect.postActivity:94` → `ActivityServiceImpl.createActivityEvent:50` → `ActivityRepository.saveReturning`. The handler is dispatched TWICE by the aspect (pre + post). The diff (`info.getOldState().equals(newState)`) at `ActivityAspect.java:86` computes whether the state changed; the aspect orchestrates the write.

**The failure-mode-isolation rationale**:
- If a handler's `getContextInfo` or `getUpdatedState` has a bug (e.g. wrong field captured, wrong serialization), the WORST outcome is a WRONG DIFF in the activity row — visible to the operator, reviewable, fixable.
- If the handler were also responsible for the WRITE (i.e. a `void handle()` pattern), a buggy handler could CORRUPT business state.
- The read-only contract is the architectural firewall between "audit-trail correctness" and "business-data correctness".

**The 18 concrete implementations consistency**:
- All 18 implementations follow the read-only contract.
- The naming convention `XxxActivityHandler` is consistent (despite the misleading verb — see REFACTOR-555).
- The dispatch pattern via `ActivityServiceImpl.getActivityHandler` is uniform.

**Wisdom test (3-question)**:
1. *Intentional?* YES — multiple positive signals:
   - The interface signature explicitly omits any `Mono<Void> write(...)` method.
   - The aspect orchestration explicitly places the write OUTSIDE the handler.
   - The 18 concrete implementations consistently apply the contract.
   - The Mono return types (vs `void` or `Mono<Void>`) signal "this method PRODUCES a value", not "this method PERFORMS a side effect".
2. *Structural impact?* YES — defines the failure-mode-isolation between audit and business state. Wide blast radius across the @ActivityLog framework's 18+ business methods.
3. *Refactoring or structural?* STRUCTURAL — adding write-side capability to the handler interface would require:
   - New method signatures.
   - Reasoning about transactional context for the handler's write.
   - Reasoning about ordering between handler-side write and aspect-side write.
   NOT a refactor.

→ ADR.

**Evidence**:
- `ActivityHandler.md` says: "State-snapshot differ pattern over write-handler pattern: the interface defines READ-only methods; diff computation lives outside in `ActivityAspect.postActivity`. The decision is intentional: keeping handlers read-only means a handler's mistake at worst produces a wrong DIFF (visible to operator), not a wrong WRITE (corrupting business state)"
- `ActivityHandler.java:9-22` — verified — all four methods are read-only by signature.
- intent_anchor: the Mono return types + the absence of `Mono<Void> write(...)` + the consistent 18-implementation pattern + the aspect orchestration architecture.

**Existing ADR**: NEW (codifies the read-only-interface architectural commitment). Composes with:
- ADR-CANDIDATE-196 (NEW from this batch — activity-emit transactional coupling) — composes: the handler is read-only AND the aspect orchestrates the write inside a TX. Two halves of the same audit-architecture decision.
- ADR-CANDIDATE-202 (NEW from this batch — linear-scan handler dispatch tolerates multi-event-type handlers via || chain) — composes with the read-only contract: dispatch is for read-only methods.
- ADR-CANDIDATE-067 (existing — `@ReactiveTransactional` boundary asymmetry) — composes: the handler is read-only; the writes are inside TX.

**Co-surfaced gaps** (link from `refactoring-scopes.md`):
- REFACTOR-555 (NEW from this batch — `ActivityHandler` name-vs-contract drift) — the gap this ADR codifies: the read-only contract IS the design, BUT the name `Handler` misleads. The proposed fix is to rename to `ActivityStateDiffer`.
- REFACTOR-558 (NEW from this batch — concurrent oldState capture race) — the gap this ADR doesn't address: the read-only contract is good, but the timing of the read (before TX boundary) creates a race.
- REFACTOR-574 (NEW from this batch — default-throw multi-id getUpdatedState) — the gap: the read-only contract has an UNDER-implemented batch variant.

**Proposed action**: Promote to `adrs/drafts/activity-handler-state-snapshot-differ.md`. Document:
- The read-only interface design as the deliberate failure-mode-isolation choice.
- The aspect orchestration architecture (read-twice + diff + write-outside).
- The 18-implementation consistency.
- The cross-link to REFACTOR-555 (the proposed RENAME of the interface to `ActivityStateDiffer` — codifying the deliberate design at the naming level).
- The cross-link to REFACTOR-558 (the race that the read-only contract doesn't address; future-design opportunity).

**Severity rationale**: MEDIUM — pattern-shaping decision for the audit-AOP framework. The decision IS sound (failure-mode-isolation via read-only contract) but undocumented. Promoting to ADR codifies the design and provides future-maintainers with the WHY behind the unusual handler interface.

**Cross-pillar bump**: P-01 × P-05 — activity-audit + AOP-framework. Severity stays MEDIUM.

**Suggested backlog grouping**: ADR draft + REFACTOR-555 (the rename) as the immediate operational follow-up.

---

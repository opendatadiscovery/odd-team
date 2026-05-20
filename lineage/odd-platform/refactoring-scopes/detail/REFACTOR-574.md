## REFACTOR-574 — `ActivityHandler.getUpdatedState(parameters, List<Long>)` default-throws `UnsupportedOperationException` at FIRST runtime call — 16 of 18 concrete impls inherit the throwing default; a future caller dispatching to an unimplemented event-type produces a runtime crash, not a compile-time error

**Severity**: LOW (loud-failure at runtime; not silent)
**Category**: misleading-code
**Surfaced by**:
- `ActivityHandler.md:stress_findings.S-B-3` (CANARY HEADLINE — "**`getUpdatedState(parameters, List<Long>)` default-throws — but is advertised as a polymorphic API.** 2 of 18 override the default — `DataEntityCreatedActivityHandler:46-49` and `DataEntityStatusUpdatedActivityHandler:51-55`. All other 16 inherit the throwing default. The ONLY caller dispatches DATA_ENTITY_CREATED only (`ActivityIngestionRequestProcessor:25-32`)")
- `ActivityHandler.md:bugs_limitations_corner_cases[2]` ("Default multi-id `getUpdatedState` throws at first subscription, not at boot... No boot-time validation enumerates impls × method-overrides" — MEDIUM)
- `ActivityHandler.md:implicit_adrs[2]` (the implicit ADR — "Default-throw multi-id getUpdatedState as a 'lazy override' opt-in" — codified as ADR-CANDIDATE-? possibly NEW)
- `ActivityHandler.java:17-21` (the default-throw method)
- `DataEntityCreatedActivityHandler.java:46-49` (one of two overriders)
- `DataEntityStatusUpdatedActivityHandler.java:51-55` (the other overrider)
- `ActivityIngestionRequestProcessor.java:25-32` (the current sole caller)

**Description**: `ActivityHandler.java:17-21`:

```java
default Mono<Map<Long, String>> getUpdatedState(
    Map<String, Object> parameters,
    List<Long> dataEntityIds
) {
  return Mono.error(new UnsupportedOperationException(
    "getUpdatedState for multiple ids is not implemented yet for this handler"
  ));
}
```

The interface advertises a polymorphic method for batch-state-capture across multiple data entities. 16 of 18 concrete implementations inherit this default-throwing behaviour. ONLY 2 override:
- `DataEntityCreatedActivityHandler.java:46-49` (ingestion-driven DATA_ENTITY_CREATED batch)
- `DataEntityStatusUpdatedActivityHandler.java:51-55` (bulk status transitions; per ADR-CANDIDATE-060)

The current caller (`ActivityIngestionRequestProcessor.java:25-32`) dispatches ONLY DATA_ENTITY_CREATED — which IS overridden. No production code path hits the default-throw.

**The latent risk**: A future maintainer extending the batch-dispatch capability (e.g. supporting `BUSINESS_NAME_UPDATED` for bulk-name-edit, or `TAG_UPDATED` for bulk-tag-application) would face this defect:
1. Add a new caller (controller / service) that dispatches multi-id state-capture.
2. Compile passes — the interface signature is valid.
3. Boot succeeds — no startup check enumerates implementor × method-override.
4. At runtime, the new caller invokes a handler whose `getUpdatedState(parameters, List)` is the default-throw → `Mono.error(UnsupportedOperationException)` propagates up the reactive chain.
5. The user sees HTTP 500 "Internal Server Error". The error log shows the UnsupportedOperationException with the message "getUpdatedState for multiple ids is not implemented yet for this handler".

The MESSAGE is loud and explicit — the operator CAN diagnose. But the defect could be caught at compile time IF the interface required the override.

**Cross-cutting context**: This is the **default-method-with-runtime-throw defect class**. Standard Java idiom: if a method MUST be overridden, make it abstract; if it's truly optional, the default should be a no-op or sensible behaviour. The throwing default here is "I exist as a polymorphic API but throw at runtime if you call me" — a smell.

**The implicit ADR (potentially codified as ADR-CANDIDATE-?)** is that the default-throw IS the chosen failure mode — the maintainer prefers loud-runtime-failure over forcing every implementation to override. This is defensible for an extension point that's rarely used; the cost is the latent regression risk.

**Primary source citations**:
- `ActivityHandler.java:17-21` (verified file:line)
- Glob of `service/activity/handler/*.java` (18 files; verified 2 overriders by inspection)
- `ActivityIngestionRequestProcessor.java:25-32` (the sole current caller)
- `ActivityServiceImpl.java:75` (the dispatcher path for the multi-id call — verified)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-? (NEW from this batch — possibly "ActivityHandler default-throw multi-id as opt-in"). The intent is clear from the explicit error message; the cost is the regression risk.

**Proposed remedy**: Two options:

1. **LOWEST cost — Add a boot-time validation enumerating implementations × method-overrides**:
   On Spring `ApplicationListener<ApplicationReadyEvent>`, iterate `List<ActivityHandler>` × the multi-id-batch-supported event types (currently DATA_ENTITY_CREATED, DATA_ENTITY_STATUS_UPDATED), assert each implementor overrides `getUpdatedState(parameters, List)`. Log a WARN at boot for missing overrides (or fail-fast).

   Effort: small (one boot-listener bean).

2. **MEDIUM cost — Make the interface method abstract; require every impl to override**:
   - Remove the `default` keyword from `getUpdatedState(parameters, List<Long>)`.
   - Every concrete `ActivityHandler` must provide an explicit impl.
   - For event types that don't support batch, the override can be `Mono.error(...)` — same runtime behaviour, but the AUTHOR explicitly opts in.
   - Compile-time check: missing overrides fail to compile.
   - Trade-off: forces 16 handlers to add a throwing override (boilerplate); but the regression-risk closes.

3. **HIGHER cost — Refactor into capability-traits**:
   - Define `ActivityHandler` (single-id contract) and `BatchableActivityHandler extends ActivityHandler` (multi-id contract).
   - Only DATA_ENTITY_CREATED + DATA_ENTITY_STATUS_UPDATED implement the batchable variant.
   - Dispatcher distinguishes batch-vs-single via instanceof check.
   - Architecturally cleanest; heaviest refactor.

**Recommended**: Option 1 (boot-time validation) — preserves the current architecture, closes the regression risk with minimal change.

**Severity rationale**: LOW — loud failure at runtime (not silent). The error is loud + explicit + diagnosable. The latent regression risk is real but bounded to "future maintainer extends batch capability". Severity is bounded by:
- Current callers all dispatch to overridden handlers (no production defect today).
- The error message is explicit and developer-friendly.
- The fix is incremental.

**Suggested backlog grouping**: `Code clarity sprint`. Pair with REFACTOR-555 (the handler name-vs-contract drift), REFACTOR-575 (linear handler-list ambiguity). The three findings collectively are the "ActivityHandler interface needs hardening" cluster.

---

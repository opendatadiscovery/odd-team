## REFACTOR-271 — Policy JSON-Schema validation runs synchronously on the WebFlux event-loop thread; pathological body sizes block the non-blocking thread

**Severity**: LOW
**Category**: refactor-risk + reactor-convention-drift
**Surfaced by**:
- `PolicyServiceImpl.md:bugs_limitations_corner_cases[6]`
- `PolicyServiceImpl.md:performance.known_performance_gaps[2]`

**Description**: `PolicyJSONValidator.validate` (PolicyJSONValidator.java:24-33) performs:
1. `objectMapper.readTree(policyJson)` — Jackson parse (synchronous, CPU-bound, scales with body size).
2. `jsonSchema.validate(...)` — schema walk over the parsed JSON (synchronous, CPU-bound, scales with body size × schema complexity).

The validator is invoked at `PolicyServiceImpl.java:64` and `:73` OUTSIDE any `.publishOn(Schedulers.boundedElastic())` — the work runs on the CALLING thread, which under WebFlux is the event-loop thread (typically named `reactor-http-nio-N`).

For typical policies (sub-millisecond schema walks on small bodies), the synchronous placement is appropriate — the cost is negligible, and the alternative (`Mono.fromCallable(() -> { validator.validate(...); return formData; }).subscribeOn(boundedElastic)`) adds reactor-scheduler overhead exceeding the validation cost.

For PATHOLOGICAL body sizes (a 1MB policy body — possible if an operator pastes a generated policy with many statements / conditions / permissions), the parse + validate become a non-trivial CPU spike on the event-loop thread. While the spike runs, the thread cannot process OTHER REQUESTS — Reactor's threading model is "one thread serves many requests via non-blocking I/O; blocking work blocks the thread."

This is a Reactor-convention drift: the convention is to push CPU-bound work to `boundedElastic` (or any non-event-loop scheduler). The validator's synchronous placement violates this convention. Today the impact is bounded by typical body sizes; future API consumers submitting larger policies (e.g. machine-generated, or operator-pasted from policy-generation tools) shift the cost.

The maintainer's choice IS consistent with ADR-CANDIDATE-053 (validate-at-write fail-fast). The ADR's stance is "fail fast on malformed input." The fix is refactoring within the architecture — push the validation to `boundedElastic` while preserving fail-fast semantics.

**Primary source citations**:
- `PolicyServiceImpl.java:64` — synchronous validate before any Mono composition
- `PolicyServiceImpl.java:73` — same pattern on update path
- `PolicyJSONValidator.java:24-33` — `objectMapper.readTree` + `jsonSchema.validate` synchronously
- composes with ADR-CANDIDATE-053 (validate-at-write architectural intent)
- composes with batch-E observation that the validator was treated as "effectively non-blocking"

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-053 codifies the fail-fast intent. The synchronous placement is an implementation choice that the ADR does not mandate. The fix is refactoring within the architecture.

**Proposed remedy**: Two composable fixes:
1. **Wrap the validator call in `Mono.fromCallable` with boundedElastic**:
   ```java
   public Mono<PolicyDetails> create(PolicyFormData formData) {
     return Mono.fromCallable(() -> {
       policyJSONValidator.validate(formData.getPolicy());
       return formData;
     })
     .subscribeOn(Schedulers.boundedElastic())
     .flatMap(fd -> policyRepository.create(...))
     .map(policyMapper::mapPolicy);
   }
   ```
   Trade-off: scheduler-switching overhead per request (~microseconds) — negligible vs the typical sub-millisecond validation, but always present.
2. **Body-size cap at the OpenAPI / controller layer**: add `@Size(max=65536)` (or similar) on the `PolicyFormData.policy` field; reject pathological body sizes BEFORE the validator runs. Closes the worst-case CPU spike at the entry boundary.

Option (2) is the cheaper fix; option (1) is the Reactor-convention-correct fix. Combine for defence-in-depth.

**Severity rationale**: LOW — no observed bug today; the gap is the pathological-body-size CPU spike. Becomes a concern at high policy authoring throughput (admin-rare today; could change).

**Suggested backlog grouping**: `Reactor-convention sweep` — bundle with any other synchronous-CPU-work-on-event-loop findings. The fix shape is uniform (wrap in `Mono.fromCallable + subscribeOn(boundedElastic)`).

---

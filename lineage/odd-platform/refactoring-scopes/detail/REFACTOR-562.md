## REFACTOR-562 — `ActivityController.getActivity` asymmetric error seam: `Mono.just(Flux.error(BadUserRequestException))` wraps a Flux-error inside a Mono-success — Spring's @RestControllerAdvice may rescue, or headers may commit 200 before subscription — outcome is undefined and runtime-test-dependent

**Severity**: MEDIUM (error-response shape ambiguity; operator-visible UX inconsistency)
**Category**: error-handling
**Surfaced by**:
- `ActivityController.md:bugs_limitations_corner_cases[validation-error-shape-ambiguity]` (CANARY HEADLINE — "Validation-error response shape ambiguity (NEW finding, STRESS_B2): getActivity's validation path uses Flux.error(BadUserRequestException) from the service layer (ActivityServiceImpl.java:99), wrapped by the controller as Mono.just(<error-flux>).map(ResponseEntity::ok) (lines 37-40). The OUTER Mono of ResponseEntity<Flux<Activity>> succeeds — .ok(<flux>) produces a 200 status. The Flux body errors only when WebFlux subscribes to write the response body" — pinned to probe P-015 — HIGH per sidecar, but on Wisdom Test classified MEDIUM as it requires runtime to determine actual operator-visible behaviour)
- `ActivityController.md:stress_findings.S-B-2` (the PROBE-NEEDED finding — emitted P-015; outcomes possible: (a) Spring rescues HTTP 400, (b) headers commit 200 then error mid-stream, (c) HTTP 500)
- `ActivityController.java:37-40` (the `getActivity` method body — verified the asymmetric wrap)
- `ActivityServiceImpl.java:98-100` (the validation `Flux.error(new BadUserRequestException("Begin date and end date can't be null"))`)
- `ControllerAdvice.java:24-28` (the `@RestControllerAdvice` handler that maps `BadUserRequestException` → 400)
- Probe `P-015` (`lineage/odd-platform/probes/P-015.yaml`) — pending experimental confirmation

**Description**: `ActivityController.getActivity` (lines 23-41) has this asymmetric error-handling shape:

```java
@Override
public Mono<ResponseEntity<Flux<Activity>>> getActivity(
    OffsetDateTime beginDate, OffsetDateTime endDate, Integer size, ...
) {
  return Mono.just(activityService.getActivityList(
    beginDate, endDate, size, ...
  )).map(ResponseEntity::ok);   // <-- problematic: ALWAYS produces 200, even if the Flux errors
}
```

The service-level validation is at `ActivityServiceImpl.java:98-100`:

```java
if (beginDate == null || endDate == null) {
  return Flux.error(new BadUserRequestException("Begin date and end date can't be null"));
}
```

The validation returns `Flux.error(...)`, NOT `Mono.error(...)` or a thrown exception. The controller wraps this with `Mono.just(<flux>)` — which is a SUCCESSFUL Mono carrying an error-Flux as its payload.

`.map(ResponseEntity::ok)` then maps the Mono's payload through `ResponseEntity.ok(<error-flux>)` — which constructs a **successful** ResponseEntity with HTTP 200 status carrying the error-Flux as the body.

**The seam**: when Spring's `ResponseEntityResultHandler` subscribes to the response body Flux to write it, the Flux materialises the error. At this point:
- If Spring has already written the 200 status headers → the client sees HTTP 200 followed by a streaming-body error (Reactor onError signal, possibly translated to a connection-reset or malformed-JSON-array).
- If Spring has NOT yet committed headers → Spring's `AbstractErrorWebExceptionHandler` may rescue and return HTTP 400 (per `@RestControllerAdvice.handleBadRequest`).
- A third possibility: Spring's `Exception` handler catches what the BadUserRequestException handler missed → HTTP 500.

**This is undefined without runtime testing** — Probe P-015 is the experimental confirmation.

**The 7 sibling Mono-return controllers** (e.g. `getActivityCounts` at line 53) propagate errors UP the outer Mono (return type `Mono<ResponseEntity<ActivityCountInfo>>` — a single Mono signal). For those, `@RestControllerAdvice` catches the BadUserRequestException at the boundary cleanly → HTTP 400. The `getActivity` path is structurally asymmetric BECAUSE its return type is `Mono<ResponseEntity<Flux<T>>>` — the nested Flux is what creates the seam.

**Operator-visible consequence**: callers submitting an invalid `getActivity` request (e.g. `begin_date` query param missing) get an UNDEFINED response shape depending on Spring internals. Possible outcomes:
- HTTP 400 with proper `ErrorResponse` JSON body — clean, correct.
- HTTP 200 with malformed body or connection-reset mid-stream — operator sees "request succeeded but no data" or "connection failed".
- HTTP 500 with generic Internal Server Error — operator sees "platform broken" when really their request was malformed.

For consumers building tools against the OpenAPI spec, this asymmetric behaviour breaks expectations. The spec's `getActivity` operation documents validation-error responses; the actual platform behaviour may not match.

**Cross-cutting context**: This is the **`Mono<ResponseEntity<Flux<T>>>` error-handling defect class**. The pattern appears in any controller method whose response is a streaming Flux. The fix is to use `Mono.error` for validation-stage errors (NOT `Flux.error`), OR to use `.flatMap` instead of `Mono.just` so the inner-Flux's error propagates to the outer Mono.

**Primary source citations**:
- `ActivityController.java:37-40` (verified: `Mono.just(activityService.getActivityList(...)).map(ResponseEntity::ok)`)
- `ActivityServiceImpl.java:98-100` (verified: `Flux.error(new BadUserRequestException(...))`)
- `ActivityServiceImpl.java:128-130` (the symmetric validation in `getDataEntityActivityList` — same pattern)
- `ControllerAdvice.java:24-28` (the BadUserRequestException → 400 handler)
- `ControllerAdvice.java:61-66` (the generic Exception → 500 handler)
- Spring WebFlux `ResponseEntityResultHandler` (not statically determinable; runtime-dependent)
- Probe `P-015` for runtime confirmation

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-007 (Reactive endpoints expose uniform `Mono<ResponseEntity<T>>` return type; success path is `.map(ResponseEntity::ok)`; no controller-level exception translation) prescribes the pattern. The 7 sibling controllers follow it cleanly. The defect: `getActivity`'s return type is `Mono<ResponseEntity<Flux<T>>>` (streaming inner-Flux for the activity list) — which makes the ADR's pattern produce an asymmetric error seam.

The ADR was implicitly authored for non-streaming return types. The activity controller's streaming Flux return is the EDGE CASE.

**Proposed remedy**: Three options:

1. **LOWEST cost — change `Flux.error` to `Mono.error` at the validation site**: Modify `ActivityServiceImpl.getActivityList` (line 98-100) and `ActivityServiceImpl.getDataEntityActivityList` (line 128-130):
   ```java
   // BEFORE:
   if (beginDate == null || endDate == null) {
     return Flux.error(new BadUserRequestException("Begin date and end date can't be null"));
   }

   // AFTER:
   if (beginDate == null || endDate == null) {
     // Validation errors should propagate up the outer Mono via .flatMapMany pattern
     throw new BadUserRequestException("Begin date and end date can't be null");
   }
   ```
   The thrown exception bubbles up to the outer Mono via Reactor's implicit `Mono.fromCallable` semantics, and the `@RestControllerAdvice` catches it cleanly. The activity-list-Flux carries no error signal.

   ALTERNATIVELY:
   ```java
   // Make the validation a Mono-Mono pattern at the controller:
   return Mono.fromCallable(() -> validateInputs(beginDate, endDate))
     .flatMap(unused -> Mono.just(activityService.getActivityList(...)))
     .map(ResponseEntity::ok);
   ```
   Same outcome.

2. **MEDIUM cost — change the controller to use `.flatMap` instead of `Mono.just`**:
   ```java
   // BEFORE:
   return Mono.just(activityService.getActivityList(...)).map(ResponseEntity::ok);

   // AFTER:
   return Mono.fromCallable(() -> activityService.getActivityList(beginDate, endDate, ...))
     .map(ResponseEntity::ok);
   ```
   Subtle but distinct: `Mono.fromCallable` defers the call until subscription, allowing exceptions to propagate UP the outer Mono. Combined with Option 1's `throw` at the validation site, the outer Mono cleanly errors.

3. **HIGHEST cost — fix the @RestControllerAdvice to handle Flux-error-inside-Mono-success cases**: Modify `ControllerAdvice` to add an `@ExceptionHandler(BadUserRequestException.class)` that catches BEFORE Spring commits 200 headers. Architecturally more invasive; risk: breaks other working error paths.

**Recommended**: Option 1 (replace `Flux.error` with `throw new BadUserRequestException(...)`) + a regression test asserting the response is HTTP 400 with the proper ErrorResponse body. Mechanical change at two service-method bodies (~6 lines total).

**Severity rationale**: MEDIUM — operator-visible inconsistency. The validation error case is a corner-case (malformed requests); most callers submit valid requests. But the inconsistency between this controller's error behaviour and the 7 sibling controllers' error behaviour is operationally hostile — operators debugging a "platform error" may get different signals depending on which endpoint they're calling. Severity is bounded by:
- Validation errors are a small fraction of total traffic.
- The actual outcome (case (a), (b), or (c)) is determinable via Probe P-015 — once known, the severity can be re-tuned.
- The fix is mechanical and high-confidence.

**Suggested backlog grouping**: `Code-comment hygiene sprint` + `Activity feed hardening sprint`. Pair with REFACTOR-061 (`lasEventId` typo on the public API contract — also Activity controller surface quality), REFACTOR-249 (Mono.zipDelayError comment-absence — also error-handling-comment gap).

---

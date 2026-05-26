## REFACTOR-610 — `PermissionServiceImpl.getExtractor` throws `IllegalArgumentException` on missing extractor → ControllerAdvice catch-all → HTTP 500 (not 400)

**Severity**: MEDIUM
**Category**: error-mapping
**Batch**: ZD (2026-05-25)
**Pillars affected**: [P-09 Security & Access Control (the read-side permission-discovery surface)]

**Surfaced by**:
- `odd-platform__java__PermissionController__controller-class__PermissionController.md:bugs_limitations_corner_cases.[7]` (MEDIUM) — "A new `hasContext=true` `PolicyTypeDto` value without a corresponding `ContextualPermissionExtractor` bean raises `IllegalArgumentException` at runtime — `PermissionServiceImpl.java:47-48` throws `IllegalArgumentException(\"No extractor for resource type %s\")`. `IllegalArgumentException` has NO dedicated handler in `ControllerAdvice.java:23-66`; the catch-all `@ExceptionHandler(Exception.class)` at line 61 surfaces it as HTTP 500 with body `{message: 'Internal Server Error', code: 'SYS001'}` — losing the specific message. A maintainer adding a new resource type and forgetting the extractor sees 500 not 400; the diagnostic clue is in the log only."

**Statement**: When a new `PolicyTypeDto` enum value is added with `hasContext=true` but the corresponding `ContextualPermissionExtractor` bean is NOT registered, `PermissionServiceImpl.getExtractor` throws `IllegalArgumentException("No extractor for resource type %s")` at lines 47-48. The exception falls through ControllerAdvice's exception handler chain to the catch-all `@ExceptionHandler(Exception.class)` at line 61 and surfaces as HTTP 500 with body `{message: 'Internal Server Error', code: 'SYS001'}` — discarding the specific error message that names the missing extractor. A maintainer adding a new resource type and forgetting the extractor bean sees a 500 with no diagnostic clue at the HTTP layer; only the application log carries the actual exception message.

The same problem affects `PolicyJSONValidator.validate(...)` (raises `IllegalArgumentException("Policy is not valid: " + errors)` at `PolicyJSONValidator.java:28-32`) — see REFACTOR-618 for the parallel scope on `PolicyController.createPolicy` / `updatePolicy`.

**Evidence**:
- `PermissionServiceImpl.java:47-48` (the throw)
- `ControllerAdvice.java:23-66` (no `@ExceptionHandler(IllegalArgumentException.class)` entry)
- `ControllerAdvice.java:61-66` (the catch-all `@ExceptionHandler(Exception.class)` that swallows the specific message)

**Existing-ADR-or-implied-prescription**: no ADR. The standard pattern is `@ExceptionHandler(IllegalArgumentException.class)` mapping to HTTP 400 with the exception message verbatim — a one-line addition to ControllerAdvice.

**Proposed remedy**: Add to `ControllerAdvice.java`: `@ExceptionHandler(IllegalArgumentException.class) Mono<ResponseEntity<ErrorBody>> handleIllegalArgument(IllegalArgumentException ex) { return Mono.just(ResponseEntity.badRequest().body(new ErrorBody(ex.getMessage(), "USR001"))); }`. This single-line change addresses REFACTOR-610 (PermissionController missing-extractor) AND REFACTOR-618 (PolicyJSONValidator schema-failure) in one fix. Alternative remedy: change `PermissionServiceImpl.java:47-48` to throw `BadUserRequestException` (which IS handled by ControllerAdvice — HTTP 400 USR001), but the cross-cutting fix is the ControllerAdvice addition.

**Severity rationale**: MEDIUM — the operator-visible breakage is degraded developer experience (500 instead of clear 400 + extractor-name), not a security or data-integrity issue. The fix is one line.

**Suggested backlog grouping**: "ControllerAdvice exception-mapping batch" (compose with REFACTOR-618 — same root cause; one-line fix benefits both).

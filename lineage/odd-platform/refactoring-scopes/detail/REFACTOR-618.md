## REFACTOR-618 — `PolicyJSONValidator` throws `IllegalArgumentException("Policy is not valid: ...")` on schema failure → ControllerAdvice catch-all → HTTP 500 (`Internal Server Error`) instead of HTTP 400 with the validator's actual error message

**Severity**: HIGH
**Category**: error-mapping
**Batch**: ZD (2026-05-25)
**Pillars affected**: [P-09 Security & Access Control (the Policy authoring UX), P-11 Developer Surface (SDK clients consuming the OpenAPI error contract)]

**Surfaced by**:
- `odd-platform__java__PolicyController__controller-class__PolicyController.md:bugs_limitations_corner_cases.[2]` (HIGH) — "Schema-validation failure surfaces as HTTP 500 — operator visibility. PolicyController.createPolicy (lines 19-25) and PolicyController.updatePolicy (lines 43-50) both delegate to `policyService.create / update` which call `policyJSONValidator.validate(...)` synchronously at the entry of the service method (PolicyServiceImpl.java:64, 73). The validator throws `IllegalArgumentException(\"Policy is not valid: \" + errors)` on schema violation. ControllerAdvice.java:23-66 has NO `@ExceptionHandler(IllegalArgumentException.class)` — the exception falls through to the catch-all `@ExceptionHandler(Exception.class)` at line 61-66 and surfaces as HTTP 500 with body `\"Internal Server Error\"` (NOT the validator's actual error message). The operator POSTing or PUTing a malformed policy sees a 500 and must read server logs to discover that the schema validation failed."

**Statement**: Both `PolicyController.createPolicy` (lines 19-25) and `PolicyController.updatePolicy` (lines 43-50) delegate to `policyService.create / update` which synchronously call `policyJSONValidator.validate(...)` at the entry of the service method (`PolicyServiceImpl.java:64, 73`). When the policy document fails JSON Schema validation, the validator throws `IllegalArgumentException("Policy is not valid: " + errors)` at `PolicyJSONValidator.java:28-32` — the message contains the SPECIFIC validation error (which field failed, what the expected shape is).

`ControllerAdvice.java:23-66` has NO `@ExceptionHandler(IllegalArgumentException.class)` — the exception falls through to the catch-all `@ExceptionHandler(Exception.class)` at line 61-66 and surfaces as HTTP 500 with body `{message: 'Internal Server Error', code: 'SYS001'}`. The operator POSTing or PUTing a malformed policy sees a 500 with no diagnostic clue at the HTTP layer; the validator's specific error message is in the application log only.

This is the parallel scope to REFACTOR-610 (PermissionController missing-extractor surfaces as 500 via the same root cause). Both are one-line fixes via a shared remedy.

**Evidence**:
- `PolicyController.java:19-25` (createPolicy thin delegation)
- `PolicyController.java:43-50` (updatePolicy thin delegation)
- `PolicyServiceImpl.java:64, 73` (validator entry points)
- `PolicyJSONValidator.java:28-32` (the throw with the specific error message)
- `ControllerAdvice.java:23-66` (no IllegalArgumentException handler; the catch-all swallows the message)

**Existing-ADR-or-implied-prescription**: no ADR. The standard pattern is HTTP 400 with the validation message verbatim — a one-line fix.

**Proposed remedy**: Two paths share the same root fix. Path (a) — preferred: add `@ExceptionHandler(IllegalArgumentException.class) Mono<ResponseEntity<ErrorBody>> handleIllegalArgument(IllegalArgumentException ex) { return Mono.just(ResponseEntity.badRequest().body(new ErrorBody(ex.getMessage(), "USR001"))); }` to ControllerAdvice. This single-line change addresses REFACTOR-610 + REFACTOR-618 simultaneously and any future `IllegalArgumentException` from any service. Path (b) — narrower: change `PolicyJSONValidator.java:28-32` to throw `BadUserRequestException(...)` instead of `IllegalArgumentException(...)`; ControllerAdvice already maps `BadUserRequestException` → 400 USR001. Path (a) is cross-cutting and preferred.

**Severity rationale**: HIGH — degraded operator experience on policy authoring; the validator's specific error message is the operator's primary fix-it signal. Hiding it behind a generic 500 forces operators to read application logs, which most operator-onboarding-velocity teams don't do until a problem is reproduced.

**Suggested backlog grouping**: "ControllerAdvice exception-mapping batch" (one-line fix benefits REFACTOR-610 + REFACTOR-618 together).

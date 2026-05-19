## REFACTOR-268 — Policy schema-validation failure surfaces as HTTP 500, not 400: `PolicyJSONValidator` throws `IllegalArgumentException`, `ControllerAdvice` has no dedicated handler

**Severity**: MEDIUM
**Category**: error-mapping
**Surfaced by**:
- `PolicyServiceImpl.md:bugs_limitations_corner_cases[2]`
- `PolicyServiceImpl.md:security.known_security_gaps[3]`

**Description**: `PolicyJSONValidator.validate` (PolicyJSONValidator.java:24-33) throws `IllegalArgumentException("Policy is not valid: " + errors)` on schema violations. The exception is raised SYNCHRONOUSLY at the entry of `PolicyServiceImpl.create` (line 64) and `PolicyServiceImpl.update` (line 73) BEFORE the reactive composition.

`ControllerAdvice` (ControllerAdvice.java:22-89) has handlers for the project's typed exceptions:
- `BadUserRequestException` → HTTP 400
- `NotFoundException` → HTTP 404
- `UniqueConstraintException` → HTTP 400
- `CascadeDeleteException` → HTTP 400
- `WebExchangeBindException` → HTTP 400
- `GenAIException` → HTTP 500
- catch-all `Exception.class` → HTTP 500 with body `"Internal Server Error"`

`IllegalArgumentException` has NO dedicated handler. It falls through to the catch-all at lines 61-66 and surfaces as HTTP 500 with body `"Internal Server Error"` — NOT the validator's actual error message ("Policy is not valid: ..." with field-level details).

An operator POSTing a malformed policy receives a generic 500 + opaque body. They must read server logs to see the schema violation. The error class is structurally wrong:
- The request WAS syntactically invalid (operator's input fault → should be 4xx).
- The response code says "server bug" (5xx → operator escalates to platform team).
- The body says "Internal Server Error" — no actionable signal.

This is REFACTOR-208's finding from batch E surfaced again at the SERVICE-TIER PRIMARY SOURCE. The two findings are the same; this entry CONFIRMS at the canonical call sites (PolicyServiceImpl.java:64, 73). Carried forward as REFACTOR-268 for this batch's index continuity; the maintainer may consolidate with REFACTOR-208 during triage.

**Primary source citations**:
- `PolicyJSONValidator.java:28-32` — `throw new IllegalArgumentException("Policy is not valid: " + errors)`
- `ControllerAdvice.java:22-89` — handlers list with NO IllegalArgumentException entry
- `ControllerAdvice.java:61-66` — catch-all `Exception.class` → 500 with `"Internal Server Error"`
- `PolicyServiceImpl.java:13` — imports BadUserRequestException — USED ELSEWHERE in the same class (e.g. line 77, 88 for name-reservation) — proves the project knows the right type
- `PolicyServiceImpl.java:64, 73` — the validator invocation sites
- cross-reference REFACTOR-208 (the original finding at the controller-method tier, batch E)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-053 (Policy JSON Schema validation at write-time) is the architectural intent. The ADR's stance is "validate at write-time, fail fast." The fail-fast IS correct; the gap is the EXCEPTION TYPE. The fix is refactoring within the existing structure: either change the exception class or add a ControllerAdvice handler.

**Proposed remedy**: Three composable fixes (any one closes the gap):
1. **Change PolicyJSONValidator to throw BadUserRequestException** (one-line fix at PolicyJSONValidator.java:28):
   ```java
   throw new BadUserRequestException("Policy is not valid: " + errors);
   ```
   The existing `ControllerAdvice` handler routes BadUserRequestException → 400. Single change; closes the gap.
2. **Add an IllegalArgumentException handler to ControllerAdvice** (lines 22-89):
   ```java
   @ExceptionHandler(IllegalArgumentException.class)
   public Mono<ResponseEntity<ErrorResponse>> handle(IllegalArgumentException e) {
       return Mono.just(ResponseEntity.badRequest().body(new ErrorResponse(e.getMessage())));
   }
   ```
   Broader fix; catches IllegalArgumentException from ANY caller, not just the policy validator. Trade-off: may catch legitimate internal bugs that SHOULD surface as 500.
3. **Wrap at the service tier**: change `PolicyServiceImpl.create/update` to catch IllegalArgumentException and re-throw as BadUserRequestException with the same message. Localised fix; preserves the validator's exception choice.

Option (1) is the cleanest semantic — the exception type SHOULD match the operator-visible error class. Option (2) is the broadest catch (handles other call sites that throw IllegalArgumentException). Option (3) is the localised wrapper.

**Severity rationale**: MEDIUM — operator UX trap. Operators receive a misleading 500 and must read logs to understand the actual issue. Compounds with REFACTOR-244 (no method-level observability) — if the log isn't structured, finding the schema-violation message is harder.

**Suggested backlog grouping**: `Error-mapping hygiene sprint` — pair with REFACTOR-208 (the original finding), REFACTOR-215 (Unknown data_source_oddrn → 5xx not 404), REFACTOR-262 (ingestion 5xx with no body shape). The exception-type vs HTTP-code mismatch is a cross-cutting pattern.

---

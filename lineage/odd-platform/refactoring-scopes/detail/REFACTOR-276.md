## REFACTOR-276 — Spring proxy self-invocation caveat undocumented for `LineageServiceImpl.replaceLineagePaths`; a future internal method calling `this.replaceLineagePaths(...)` would silently bypass `@ReactiveTransactional`

**Severity**: LOW
**Category**: refactor-risk (no observed bug)
**Surfaced by**:
- `LineageServiceImpl.md:bugs_limitations_corner_cases[9]`

**Description**: Spring's `@ReactiveTransactional` annotation is implemented via a CGLIB/AOP proxy at the bean boundary. The proxy intercepts EXTERNAL calls (from outside the bean) and starts the transaction; it does NOT intercept INTERNAL self-invocations (calls from within the same bean instance via `this.method(...)`).

Today, `LineageServiceImpl.replaceLineagePaths` (lines 124-133) is invoked only EXTERNALLY:
- From `LineageIngestionRequestProcessor.process` (the ingestion-side caller).
- From `LineageController.replaceLineage` (if any direct HTTP path exists — verified absent for the current sidecar batch).

A FUTURE refactor that splits `replaceLineagePaths` into two helpers and invokes them from a third internal method (e.g. `private Mono<Void> replaceInChunks(List<LineagePojo> pojos) { ... this.replaceLineagePaths(chunk) ... }`) would:
- Bypass the proxy.
- Lose the `@ReactiveTransactional` annotation's effect.
- The `batchDeleteByEstablisherOddrn` + `batchInsertLineages` pair would run OUTSIDE the transaction.
- A failure between the delete and the insert would leave the lineage table in an inconsistent state (edges deleted but not re-inserted).

This is the well-known Spring caveat ("self-invocation does not trigger the proxy") — but it is UNDOCUMENTED at the service. A code reviewer scanning the file for the `@ReactiveTransactional` annotation correctly notes "this is transactional." A code reviewer scanning a future refactor that adds an internal call may not notice the proxy bypass.

The fix shape is documentation + structural defence:
1. Document the caveat at the method declaration.
2. Consider extracting the transactional method to a separate bean to make the proxy boundary explicit.
3. OR rely on tests that pin the transactional contract.

**Primary source citations**:
- `LineageServiceImpl.java:124-133` — the @ReactiveTransactional method
- Spring proxy semantics — out-of-class only; well-documented in Spring docs but absent from this file
- No self-invocation in the file today (verified by grep `this.replaceLineagePaths` returning zero matches)

**Existing-ADR-or-implied-prescription**: none. ADR-CANDIDATE-067 (txn boundary asymmetry) codifies the placement; the proxy caveat is a Spring framework detail, not an architectural decision.

**Proposed remedy**: Two composable fixes:
1. **Defending comment** at line 124:
   ```java
   /**
    * Atomically replace lineage edges for the establishers in `pojos`.
    *
    * SPRING PROXY CAVEAT: `@ReactiveTransactional` only applies on EXTERNAL calls.
    * A future internal `this.replaceLineagePaths(...)` invocation from another
    * method on this class would bypass the proxy and lose the transactional
    * boundary, leading to inconsistent state on partial failures. If chunking is
    * needed, extract the chunked variant to a SEPARATE @Service bean so the
    * proxy boundary is preserved.
    */
   @ReactiveTransactional
   public Flux<LineagePojo> replaceLineagePaths(final List<LineagePojo> pojos) { ... }
   ```
2. **Architectural test** (optional): use Spring's `@SpyBean` or AspectJ load-time-weaving introspection to assert at test time that every `@ReactiveTransactional` method on every service is reachable via the proxy in production.

Option (1) is the cheap documentation fix; option (2) is the structural defence. Option (1) suffices for typical maintainers; option (2) is for high-stakes services.

**Severity rationale**: LOW — no observed bug; the gap is the future-refactor fragility. A maintainer reading the file today understands the @ReactiveTransactional placement; a maintainer adding an internal call later may not.

**Suggested backlog grouping**: `Code-comment hygiene sprint` — pair with REFACTOR-249, REFACTOR-251, REFACTOR-261, REFACTOR-263, REFACTOR-270, REFACTOR-275. The intent-anchor + framework-caveat comment gaps form a cross-cutting cluster.

---

## REFACTOR-321 — `OwnershipServiceImpl.delete` does NOT validate that the ownership existed — the repository's `delete` returns empty `Mono` on non-existent id; the service propagates empty silently; HTTP 204 returned indistinguishably from "I deleted it" vs "it wasn't there"

**Severity**: MEDIUM
**Category**: idempotency (silent-no-op-on-non-existent)
**Pillars affected**: [P-01-data-discovery, P-08-management-administration]
**Batch**: K (2026-05-19)

**Surfaced by**:
- `odd-platform__java__service__service__OwnershipServiceImpl.md:bugs_limitations_corner_cases.[3]` (MEDIUM) — "The `delete` flow does NOT validate that the ownership existed. Line 81 calls `ownershipRepository.delete(ownershipId)`; per batch-H `bugs_limitations_corner_cases[3]`, the repository's `delete` returns an empty `Mono` when the id doesn't exist (no NotFoundException). The service propagates the empty: the `flatMap` at line 82 receives no item, the entire chain short-circuits to `Mono.empty()`, and `.then()` at line 96 returns `Mono<Void>` as if successful. `DataEntityController.deleteOwnership` maps this to `noContent().build()` (HTTP 204). The caller cannot distinguish 'I deleted it' from 'it wasn't there to delete'."

**Description**: `OwnershipServiceImpl.delete(long ownershipId, Boolean propagate)` at lines 76-97 calls `ownershipRepository.delete(ownershipId)` at line 81. Per the batch-H `ReactiveOwnershipRepositoryImpl` sidecar `bugs_limitations_corner_cases[3]`, the repository's `delete` uses `DELETE ... RETURNING ...` semantics that emit empty on non-existent id (no NotFoundException). The service's chain at line 82 (`.flatMap(this::handleDelete)`) short-circuits to `Mono.empty()`; the `.then()` at line 96 returns `Mono<Void>` as if the delete succeeded. The controller at `DataEntityController.deleteOwnership` maps the empty `Mono<Void>` to `ResponseEntity.noContent().build()` (HTTP 204).

**Failure mode**: An admin double-clicks the "Remove ownership" button on the UI. The first DELETE succeeds and removes the row. The second DELETE hits a non-existent id (the row is gone) and silently returns HTTP 204. The admin sees TWO success notifications and believes both clicks did distinct work. A scripted operator using the API to verify a delete has no signal — the 204 looks identical between "I deleted it" and "it wasn't there." Combined with REFACTOR-320 (delete doesn't refresh FTS vector), the operator's downstream signals are also broken.

**Primary source citations**:
- `OwnershipServiceImpl.java:81-96` (the delete chain has no `.switchIfEmpty(error)` before propagation)
- batch-H `ReactiveOwnershipRepositoryImpl.md:bugs_limitations_corner_cases[3]` (the repository's empty-Mono on non-existent id)
- `DataEntityController.java:175-181` (HTTP 204 mapping)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-007 (uniform Mono pipeline) frames the controller-level shape — `Mono<Void>` returning 204 is standard. There is NO ADR mandating idempotent-delete; the implicit pattern across the codebase is mixed (some deletes are strict — emit 404 on non-existent; some are idempotent — emit 204 always). The absence of a clear convention is the gap.

**Proposed remedy**: Two options. (a) **Strict-delete**: add `.switchIfEmpty(Mono.error(new NotFoundException("Ownership", ownershipId)))` at line 82 of the service; surface 404 on non-existent. (b) **Idempotent-delete with audit**: keep 204 but emit an audit event distinguishing "deleted" from "no-op." The maintainer's triage decides — the platform's other delete endpoints' behaviour is the reference; cross-check.

**Severity rationale**: MEDIUM — UX-ambiguity; idempotent-friendly for retries but masks operator typos and double-clicks.

**Suggested backlog grouping**: `Owner / Title directory hygiene` (with REFACTOR-320, REFACTOR-199, REFACTOR-206)

---

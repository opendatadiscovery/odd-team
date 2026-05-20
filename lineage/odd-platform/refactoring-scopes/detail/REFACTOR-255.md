## REFACTOR-255 — `DataEntityServiceImpl.upsertDescription` response echoes request payload, not DB state — empty-string-to-NULL normalisation hidden from client

**Severity**: LOW
**Category**: misleading-api (response vs persisted state drift)
**Surfaced by**:
- `DataEntityServiceImpl.md:bugs_limitations_corner_cases[5]`
- `DataEntityServiceImpl.md:implicit_adrs[6]` ("upsertDescription response binding — bound from request payload, not from a post-write DB re-read")

**Description**: `DataEntityServiceImpl.upsertDescription` (lines 323-333) ends with `new InternalDescription(formData.getInternalDescription(), linkedTerms)` (lines 329-332) — the response payload is built FROM THE REQUEST, not from a post-write DB re-read. The decision avoids a redundant SELECT after the UPDATE, which is a reasonable perf choice.

The trade-off: the response doesn't reflect any SERVER-SIDE normalisation. The repository's `setInternalDescription` (`ReactiveDataEntityRepositoryImpl.java:431`) applies an empty-string-to-NULL conversion before the UPDATE — a request with `{"internal_description": ""}` writes `NULL` to the DB column. The response, however, echoes `{"internal_description": ""}` to the caller.

A client that:
- POSTs `{"internal_description": ""}` and receives `{"internal_description": ""}` in the response, then
- GETs `/api/dataentities/{id}` and receives `{"internal_description": null}` (the DB-truth state)

…sees a contradiction. The two endpoints disagree on the value of the field for the same entity at the same moment. A client reconciling response-vs-stored-value (e.g. an integration test, a frontend caching layer) flags this as a bug.

**Primary source citations**:
- `DataEntityServiceImpl.java:329-332` — the response binding from formData
- `ReactiveDataEntityRepositoryImpl.java:431` — the empty-to-null normalisation at the repo tier
- composes with REFACTOR-219 (silent UPDATE on missing entity — the same upsertDescription surface has a different gap)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-058 (data-entity status state machine) doesn't address this. The maintainer's implicit choice is "trust the request" — the response is the writer's view of what they just sent, not the persisted state. The fix is refactoring within the existing structure.

**Proposed remedy**: Three options:
1. **Apply the normalisation client-side too**: handle `formData.getInternalDescription()` at line 329 with `formData.getInternalDescription().isEmpty() ? null : formData.getInternalDescription()`. Cheap; the response now reflects DB-truth.
2. **Re-read after write**: replace lines 329-332 with `dataEntityInternalStateService.getDescription(dataEntityId)`. One extra SELECT per write but eliminates the divergence.
3. **Reject empty strings at validation time**: at the controller / OpenAPI layer, add `@NotBlank` or `@Size(min=1)` to the `internal_description` field. The empty case never reaches the service; the response-vs-DB drift never happens.

Option (1) is the cheapest; option (3) is the strictest contract. Option (2) is the cleanest semantic but the most expensive.

**Severity rationale**: LOW — minor UX inconsistency. No security gap, no data loss. Client-visible only on reconcile workflows.

**Suggested backlog grouping**: `Description endpoint hygiene` — pair with REFACTOR-219 (silent UPDATE), REFACTOR-218 (XSS sanitisation), REFACTOR-226 (operationId vs implementation drift), REFACTOR-228 (TermAssignmentActivityHandler N+1). The description endpoint family has several minor consistency gaps; bundling fixes is efficient.

---

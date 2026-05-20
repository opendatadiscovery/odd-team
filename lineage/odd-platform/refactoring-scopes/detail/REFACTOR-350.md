## REFACTOR-350 — DEG-lineage hard-delete race window → bare RuntimeException → generic 500 with no error-code mapping; between member-resolution (line 61) and metadata fetch (line 65), a member entity hard-deleted is unrecoverable for the caller

**Severity**: LOW
**Category**: race-condition (error-mapping gap)
**Pillars affected**: [P-05-data-lineage]
**Batch**: M (2026-05-19)

**Surfaced by**:
- `odd-platform__java__DataEntityController__controller-method__getDataEntityGroupsLineage.md:bugs_limitations_corner_cases.[7]` (LOW) — "**Hard-delete race window** — between `getDEGEntitiesOddrns` (line 61) and `getDataEntityWithDatasourceMap` (line 65), an entity member of the DEG could be hard-deleted (rare; typically entities are soft-deleted via DataEntityInternalStateServiceImpl). If this race fires, the `Optional.orElseThrow` at LineageServiceImpl.java:169-173 throws `RuntimeException(\"Entity with oddrn %s wasn't fetched\")` with no error-code mapping → generic 500. The race window for hard-deletes is small but the failure mode is unrecoverable for the caller."
- `odd-platform__java__DataEntityController__controller-method__getDataEntityGroupsLineage.md:downstream_side_effects` (LOW — same finding restated in the failure-modes section)

**Description**: `LineageServiceImpl.getDataEntityGroupLineage` (lines 59-85) performs three sequential DB calls + an in-memory assembly:

1. **Line 61**: `groupEntityRelationRepository.getDEGEntitiesOddrns(dataEntityGroupId)` — fetches the transitive member oddrn set.
2. **Line 65**: `getDataEntityWithDatasourceMap(entitiesOddrns)` → `reactiveDataEntityRepository.getDataEntitiesWithDataSourceAndNamespace(oddrns)` — fetches the per-member metadata (DataEntityDimensionsDto).
3. **Line 66**: `lineageRepository.getLineageRelations(entitiesOddrns).collectList()` — fetches the inter-member edges.
4. **Assembly**: `establishDEGRelations` + `getLineageStream` builds the response.

The race window is between **lines 61 and 65**: a member entity present at line-61's resolution may be hard-deleted before line-65's fetch. Hard-deletes are rare (typically entities are soft-deleted via `DataEntityInternalStateServiceImpl`), but they DO happen — the `DataEntityHousekeepingJob` (per batch D sidecar) is the canonical hard-delete path; a member entity that crosses the housekeeping TTL boundary between line 61 and line 65 hits the race.

When the race fires, the assembly code at `LineageServiceImpl.java:169-173` (inside `getLineageStream`) hits an `Optional.orElseThrow`:

```java
final DataEntityDimensionsDto dimensions = dict.get(oddrn);
// (implied: dimensions is null because the entity was hard-deleted between line 61 and line 65)
// LineageServiceImpl.java:169-173:
Optional.ofNullable(dimensions)
    .orElseThrow(() -> new RuntimeException("Entity with oddrn %s wasn't fetched".formatted(oddrn)));
```

The thrown `RuntimeException` has NO error-code mapping in the `ControllerAdvice` chain (per batch K sidecar — `IllegalArgumentException` and bare `RuntimeException` both produce generic 500). The caller receives `HTTP 500 Internal Server Error` with no useful payload; the operator's debugging path is `tail -f application.log` to find the stack trace.

**Operator-impact paths**:
- A DEG with a member that gets hard-deleted mid-request returns 500. The DEG itself is fine; a retry succeeds (the member is no longer in `group_entity_relations` after the hard-delete cascade). The caller sees a transient 500.
- For a DEG with many members and a busy housekeeping schedule, the race window aggregates — occasional 500s on DEG-lineage reads with no clear trigger.

**Primary source citations**:
- `LineageServiceImpl.java:61` (`getDEGEntitiesOddrns` — the member-resolution query)
- `LineageServiceImpl.java:65` (`getDataEntityWithDatasourceMap` — the metadata fetch)
- `LineageServiceImpl.java:169-173` (the `Optional.orElseThrow(() -> new RuntimeException(...))` assembly site)
- `DataEntityHousekeepingJob.java:99-126` (the canonical hard-delete path — per batch D sidecar)
- (contrast) `ControllerAdvice` chain — does NOT map bare `RuntimeException` to a specific HTTP code

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-101 (per-job failure isolation — batch K) describes the housekeeping job's posture; the gap here is the request-path side that has no equivalent isolation — a single missing dictionary entry fails the entire response.

**Proposed remedy**: Two-path:

1. **Tolerate the missing member**: replace the `Optional.orElseThrow(...)` at lines 169-173 with `Optional.ofNullable(dimensions).map(d -> buildNode(d)).orElse(null)`; filter out null nodes from the response. The caller receives a slightly smaller DEG-lineage graph (missing the hard-deleted member's node + its edges), but the request succeeds. The trade-off: the response is silently incomplete; combined with REFACTOR-345 (empty-DEG 404 vs DEG-not-found 404), the response-completeness contract is structurally underdetermined.

2. **Map the race to a 409 Conflict**: add a `RuntimeException`-to-`HttpStatus.CONFLICT` mapping in the `ControllerAdvice` with a message like "Data entity {oddrn} was modified concurrently — please retry". The caller knows to retry; the operator's log carries a structured error rather than a generic 500.

Option (1) is the lower-friction fix for typical use cases; option (2) is the contract-preserving fix that signals the race to the caller.

**Severity rationale**: LOW — rare race window; the failure mode is transient (retry succeeds). The fix is one-line at either the assembly site or the ControllerAdvice. Not MEDIUM because production impact is bounded; not absent because the failure mode is reachable under normal operation (housekeeping is a default-on job per ADR-CANDIDATE-046).

**Suggested backlog grouping**: `Error-mapping cleanup` — couple with REFACTOR-345 (DEG-lineage 404 conflation — same endpoint, related error-mapping gap), REFACTOR-208 series (generic-exception-handling gaps).

---

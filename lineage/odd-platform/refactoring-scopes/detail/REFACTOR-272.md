## REFACTOR-272 — `LineageServiceImpl` orElseThrow with bare `RuntimeException` on race-window missing-oddrn lookup; user sees generic 500 with no error-code mapping

**Severity**: LOW
**Category**: error-mapping
**Surfaced by**:
- `LineageServiceImpl.md:bugs_limitations_corner_cases[5]`

**Description**: `LineageServiceImpl` has two race-window guards that throw bare `RuntimeException`:
- Line 152-154 (`getLineageStream` overload 1)
- Line 170-173 (`getLineageStream` overload 2)

The pattern:
```java
Optional.ofNullable(dtoRepository.get(oddrn))
    .orElseThrow(() -> new RuntimeException("Entity with oddrn %s wasn't fetched".formatted(oddrn)));
```

The race window: if an entity is HARD-deleted between the lineage walk (`getLineageRelations` at lines 95-99) and the metadata fetch (`getDataEntityWithDatasourceMap` at lines 110-111 + 113-114), the `dtoRepository` map does not contain the oddrn referenced by the edge set. The orElseThrow fires and propagates a `RuntimeException` upstream.

`ControllerAdvice` has no dedicated handler for bare `RuntimeException`. The exception falls through to the catch-all `Exception.class` handler → HTTP 500 with body `"Internal Server Error"`. The user sees a generic server error; the actual diagnostic ("Entity with oddrn X wasn't fetched") is in the application log.

Mitigating factor: entities are typically SOFT-deleted (via `DataEntityInternalStateServiceImpl`) which ALSO soft-deletes their lineage edges. The race window is for HARD-deletes (rare, typically only via housekeeping TTL purge) OR for the moment between soft-delete-of-entity and soft-delete-of-edges propagating. The window is millisecond-scale.

The fix shape is similar to REFACTOR-268: the exception class should match the operator-visible error semantic. A "the entity was deleted concurrently with this read" is structurally a transient state (re-issue the read after a moment) — could surface as HTTP 503 with Retry-After, or HTTP 410 Gone (the entity existed and is now gone), or just a typed exception that ControllerAdvice maps to 404 with body `{"error": "ENTITY_RACE_WINDOW", ...}`.

**Primary source citations**:
- `LineageServiceImpl.java:152-154` — first orElseThrow site
- `LineageServiceImpl.java:169-173` — second orElseThrow site
- `ControllerAdvice.java:22-89` — handlers list (no RuntimeException entry; catches via `Exception.class` → 500)
- composes with ADR-CANDIDATE-058 (soft-delete-as-state — soft-deleted entities ARE returned; the race window is around hard-delete edges)

**Existing-ADR-or-implied-prescription**: none specific. ADR-CANDIDATE-068 (soft-delete inheritance) + DataEntityInternalStateServiceImpl ownership of soft-delete-edges (per batch H) covers the architectural intent. The fix is refactoring within the existing pattern.

**Proposed remedy**: Two composable fixes:
1. **Replace bare RuntimeException with a typed exception** + ControllerAdvice handler:
   ```java
   .orElseThrow(() -> new LineageEntityRaceException("Entity with oddrn %s was deleted during lineage assembly".formatted(oddrn)));
   ```
   Add `LineageEntityRaceException extends RuntimeException` + ControllerAdvice handler routing to HTTP 410 Gone with the message.
2. **Or, just swallow the missing entity**: skip the edge in the response (filter out edges whose endpoint is missing in the metadata map) rather than failing. This is the operator-friendlier choice for a race-window: the canvas renders the available subgraph and silently omits the deleted entity.

Option (2) is preferable for UX — the canvas continues to render usable content; the user doesn't see a 500. Trade-off: a TRUE consistency bug (the metadata fetch genuinely missing for a non-race reason) is silently masked.

**Severity rationale**: LOW — millisecond-scale race window, rare in practice. The user-facing 500 is a UX consequence; the data integrity is unaffected.

**Suggested backlog grouping**: `Error-mapping hygiene sprint` — pair with REFACTOR-268, REFACTOR-215, REFACTOR-262.

---

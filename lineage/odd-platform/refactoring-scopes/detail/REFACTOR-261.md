## REFACTOR-261 — MICROSERVICE specific-attributes exclusion is undocumented and silent; a future refactor removing the filter would suddenly emit BIS alerts for every microservice ingestion

**Severity**: MEDIUM
**Category**: silent-feature-ignored
**Surfaced by**:
- `IngestionService.md:bugs_limitations_corner_cases[4]`

**Description**: `IngestionServiceImpl.persistDataEntities` (line 103) carries a deliberate filter:
```java
.filter(e -> DataEntityTypeDto.MICROSERVICE != e.getValue().getType())
```

This excludes MICROSERVICE-typed entities from the `DataEntitySpecificAttributesDelta` computation. The delta drives `DatasetStructureIngestionRequestProcessor.setDatasetSchemaChanged` (which sets a flag that `AlertIngestionRequestProcessor` consumes to raise BIS — Business-Impacting-Schema — alerts).

The consequence: MICROSERVICE entities CAN NEVER TRIGGER schema-diff BIS alerts via the specific-attributes path, regardless of how their attributes change. This is an intentional carve-out — but:
- No comment defends the exclusion at line 103.
- No `@docs` link explains why.
- The live docs don't mention "MICROSERVICE entities have a different alerting behaviour than other types."
- A code-spelunking maintainer cannot tell from the source whether this is (a) intentional, (b) an oversight, (c) a workaround for a now-fixed bug.

A future refactor that removes the filter (e.g. "I'm adding a new check; let me clean up these weird filters") would SUDDENLY emit BIS alerts for every microservice ingestion. The alerting infrastructure would flood with alerts; operators would be paged. The regression would land green in all existing tests (no test pins the current carve-out).

The wisdom test for this finding sits between ADR and gap:
- The carve-out IS a deliberate decision (the maintainer wrote the filter at line 103 with the explicit MICROSERVICE check). So it's not purely an "absent feature."
- But there's no RATIONALE captured in the code or docs. No comment, no ADR, no live-doc mention.
- The 3-question test: (1) Intentional? Partially — the code says yes but the absence of rationale makes it half-intentional. (2) Structural? It's a one-line filter — easy to remove; not structural. (3) Refactor or structural? REFACTOR — adding the rationale comment (or removing the filter) is a one-line change.
- Verdict: GAP-shaped (the rationale absence is the gap; the filter itself is correct).

**Primary source citations**:
- `IngestionServiceImpl.java:103` — the filter line with no surrounding comment
- `DatasetStructureIngestionRequestProcessor.java:132-165` — `setDatasetSchemaChanged` (the downstream that processes the delta)
- `IngestionRequest.java:66-78` — `getChangedDatasetOddrns/Ids` (consumed by AlertIngestionRequestProcessor)
- `AlertIngestionRequestProcessor.java:60-65` — consumes `changedDatasetIds` to compute BIS alerts
- No comment in any of these files defends the MICROSERVICE exclusion

**Existing-ADR-or-implied-prescription**: none. No ADR addresses MICROSERVICE-specific behaviour. The fix is documentation, not refactoring.

**Proposed remedy**: Three composable fixes:
1. **Add a defending comment** at line 103:
   ```java
   // MICROSERVICE entities are excluded from specific-attributes-delta computation
   // because their attributes (port, protocol, etc.) are infrastructure config rather
   // than business-schema. Schema-diff BIS alerts on microservices would produce
   // noise without operator-actionable signal. If a microservice's attributes change
   // sufficiently, the operator updates the entity definition; the alert path is not
   // the right surface for that signal.
   .filter(e -> DataEntityTypeDto.MICROSERVICE != e.getValue().getType())
   ```
2. **Add a regression test**: pin the current behaviour. `MetricsIngestionTest` or `AlertIngestionTest` should have a test that ingests a MICROSERVICE entity with changed attributes and asserts NO BIS alert is raised.
3. **Doc-side reflection**: the live `/features/alerts/business-impacting-schema` page (or equivalent) should mention that MICROSERVICE entities are excluded from the BIS alert path.

**Severity rationale**: MEDIUM — operator-blindness compounded by future-refactor fragility. The bug isn't a defect today; the gap is the rationale absence that makes the code structurally fragile.

**Suggested backlog grouping**: `Code-comment hygiene sprint` — pair with REFACTOR-249, REFACTOR-251, the various intent-anchor-comment gaps. Cheap, additive.

---

## REFACTOR-622 — `getSearchSuggestions.entityClassId` is a single Integer — cannot filter multi-class entities by multiple classes; OR-filtering requires multiple round-trips + client-side de-duplication

**Severity**: LOW
**Category**: feature-gap (over-narrow parameter shape)
**Pillars affected**: [P-04 Data Discovery]
**Batch**: ZE (2026-05-25)

**Surfaced by**:
- `odd-platform__java__SearchController__controller-class__SearchController.md:bugs_limitations_corner_cases.[8]` (LOW) — "**`getSearchSuggestions.entityClassId` parameter is a single Integer — cannot filter multi-class entities by multiple classes.** `SearchController.java:78` declares `final Integer entityClassId`; `ReactiveDataEntityRepositoryImpl.java:482-484` does `DATA_ENTITY.ENTITY_CLASS_IDS.contains(new Integer[] {entityClassId})`. The column is a `int[]` (a data entity may have multiple classes — e.g. a `DataSet` that's also a `DataInput`); the filter is a subset-check against a single-element array. Operator-visible: if a user wants suggestions for `DataInput`-or-`DataSet`, they have to call the endpoint twice + de-duplicate; the API does not support OR-filtering on entity_class even though the underlying column model supports it."

**Description**: `getSearchSuggestions` accepts `entityClassId: Integer` as a single-value query parameter (`SearchController.java:78`). The SQL filter at `ReactiveDataEntityRepositoryImpl.java:482-484` wraps the single value into a 1-element array and uses array-contains:

```java
DATA_ENTITY.ENTITY_CLASS_IDS.contains(new Integer[] {entityClassId})
```

But `DATA_ENTITY.ENTITY_CLASS_IDS` is a `INTEGER[]` column — a data entity may belong to MULTIPLE entity classes simultaneously (e.g. a record can be both a `DataSet` and a `DataInput`). The filter correctly handles multi-class entities for a single class id (it asks "does the entity's class array contain the given id?"). What it does NOT handle: filtering by multiple classes in a single call.

The OpenAPI contract at `openapi.yaml:788-792` declares `entity_class_id` as a singular integer parameter, not an array. An API consumer wanting "suggestions for DataInput-or-DataSet entities" must:
1. Call `/api/search/suggestions?query=foo&entity_class_id=2` (DataInput class id)
2. Call `/api/search/suggestions?query=foo&entity_class_id=3` (DataSet class id)
3. De-duplicate the two result sets client-side (some entities will appear in both — the multi-class entities)
4. Render the merged set in the UI

**Operator-visible consequence**:
- The UI today exercises only the SINGLE-class case (per the `AddDataEntityToGroupForm.tsx:82` consumer that always passes a fixed class id). The gap is therefore not operator-visible IN THE UI.
- The gap IS API-consumer-visible: a third-party integration wanting cross-class autocomplete has to double-fetch + merge.
- The gap is also forward-looking: a future UI feature (e.g. "global autocomplete across all entity classes") would have to either iterate over all class ids or REFACTOR the parameter shape.

**Primary source citations**:
- `SearchController.java:76-83` (singular `Integer entityClassId` parameter)
- `ReactiveDataEntityRepositoryImpl.java:482-484` (1-element array wrap + contains-check)
- `openapi.yaml:788-792` (single integer schema)
- `AddDataEntityToGroupForm.tsx:82` (the only UI consumer, fixed-class case)

**Existing-ADR-or-implied-prescription**: none. The platform's convention for multi-value filters is the `IdsParam` shape (a comma-separated `List<Long>` query param; used by `getPopularTagList`, `getDataEntityList`, etc.). `getSearchSuggestions` is a DEVIATION from the convention.

**Proposed remedy**: Two-path:
1. **Preserve and document** — accept the current singular shape; add an `Implementation Notes` block to the docs/api page explaining the cross-class autocomplete requires multiple calls. Suggested for low-priority maintenance.
2. **Migrate to List** — change `Integer entityClassId` → `List<Integer> entityClassIds` (plural) following the platform's `IdsParam` convention. Adjust the SQL to `DATA_ENTITY.ENTITY_CLASS_IDS.overlaps(entityClassIds)` (jOOQ array-overlap). Update the OpenAPI spec. Backward-compatible if the old singular parameter is preserved as an alias for `[entityClassId]`.

**Severity rationale**: LOW — feature-gap, not bug; API-consumer-visible only (no UI consumer exercises the gap today); the underlying column model supports the desired behaviour, the parameter shape is the limiting factor.

**Suggested backlog grouping**: `Search UX hardening` — couple with REFACTOR-621 (suggestions determinism), REFACTOR-496 (IdsParam descriptor reuse drift).

**Coherence check** (LSN-018):
- STRENGTHENS: none (sibling pattern would be a future shared-IdsParam refactor).
- SUPERSEDES: none.
- CONFLICTS: none.

---

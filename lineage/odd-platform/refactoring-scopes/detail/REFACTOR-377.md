## REFACTOR-377 — Tag `listTagsRelations(datasetFieldIds, origin)` accepts `origin=null` and skips the filter, returning ALL origins; no current caller passes null but contract is not consumer-discoverable from the method shape

**Severity**: LOW
**Category**: missing-doc / fragile-contract
**Surfaced by**: `ReactiveTagRepositoryImpl.md:bugs_limitations_corner_cases[6]`

**Description**: `ReactiveTagRepositoryImpl.listTagsRelations` (lines 101-117) accepts an `origin` parameter and conditionally adds the origin filter: `if (origin != null) query = query.and(TAG_TO_DATASET_FIELD.ORIGIN.eq(origin.name()))`. Callers that pass `null` get ALL origins (INTERNAL + EXTERNAL + EXTERNAL_STATISTICS).

There is no current caller that passes null (every caller specifies EXTERNAL or INTERNAL explicitly per the grep). But the contract is not documented at the interface; only the implementation encodes the behaviour.

**Primary source citations**:
- `ReactiveTagRepositoryImpl.java:101-117`

**Proposed remedy**: Either:
1. Make `origin` non-nullable in the method signature (`@NonNull TagOrigin origin`); callers explicitly opt-in to the "all origins" case via a sentinel like `TagOrigin.ANY` or via a separate overload `listTagsRelationsAllOrigins(datasetFieldIds)`.
2. Document the null-origin semantic in the Javadoc + add an assertion at the method start: `Objects.requireNonNull(origin, ...)`.

Option 1 is the cleanest contract; Option 2 is the smallest fix.

**Severity rationale**: LOW — latent contract bug.

**Suggested backlog grouping**: `Code hygiene`.

---

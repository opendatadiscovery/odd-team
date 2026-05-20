## REFACTOR-553 — `TagServiceImpl.delete` search-vector refresh INCOMPLETE — only term-search vectors refreshed; main search_entrypoint + tag-structure vectors retain deleted tag's tokens until next data-entity write

**Severity**: LOW
**Category**: observability + stale-index (data-freshness)
**Surfaced by**:
- `TagServiceImpl.md:bugs_limitations_corner_cases[delete-search-vector-incomplete]` (LOW) — "`delete` updates only `reactiveTermSearchEntrypointRepository.updateChangedTagVectors(tagId)` (`:68-69`); it does NOT call `reactiveSearchEntrypointRepository.updateChangedTagVectors` or `.updateChangedTagStructureVector` despite `update` updating all three"
- `TagServiceImpl.md:invariants[search vector refresh asymmetry]` (not surfaced as a named invariant but implicit in the per-method comparison)
- `TagServiceImpl.md:downstream_side_effects` (`update` triggers 3 search-vector refreshes; `delete` triggers 1)
- `TagServiceImpl.md:tests_coverage_semantic.uncovered_behaviours[update triple-zip search-vector refresh]` (MEDIUM per sidecar — for update; the delete-side asymmetry is also uncovered)

**Description**: `TagServiceImpl` has THREE search-vector refresh dependencies:
1. `reactiveSearchEntrypointRepository.updateChangedTagVectors(tagId)` — main `search_entrypoint` table refresh
2. `reactiveSearchEntrypointRepository.updateChangedTagStructureVector(tagId)` — `search_entrypoint_structure` table refresh (column-structure search includes tag tokens)
3. `reactiveTermSearchEntrypointRepository.updateChangedTagVectors(tagId)` — `term_search_entrypoint` table refresh (term-search includes tag tokens)

The `update` method (`:44-55`) calls `updateSearchVectors(updatedPojo)` (line 53) which runs all THREE concurrent via `Mono.zip` (`:161-167`). The `delete` method (`:57-70`) calls only the THIRD repository's method at line 68-69:

```java
.flatMap(t -> reactiveTermSearchEntrypointRepository.updateChangedTagVectors(tagId))
```

The first TWO refreshes — main search_entrypoint + tag-structure — are NOT called on delete.

**Operator-visible consequence**: After a `DELETE /api/tags/{tag_id}` succeeds:
- `tag` row: soft-deleted (`deleted_at = NOW()`)
- `tag_to_term` rows: hard-deleted
- `tag_to_data_entity` rows: hard-deleted
- `term_search_entrypoint` table: refreshed (the term-side tokens for the deleted tag are removed)
- `search_entrypoint` table: STALE (the main search index still contains the deleted tag's tokens for affected entities)
- `search_entrypoint_structure` table: STALE (the column-structure search index still contains the deleted tag's tokens for affected columns)

The deleted tag's NAME may continue to surface in the main search facet UNTIL the next entity-level refresh — which happens when any entity tagged by that tag is updated, when an ingestion batch touches an affected entity, OR when the search-entrypoint reaper job runs. The staleness window is operator-visible but bounded.

**Comparison with `update` (the symmetric concern)**: 
- `update` refreshes ALL three; if any of them fails, the entire update fails (via `Mono.zip`'s error propagation under `@ReactiveTransactional` semantic — REFACTOR-554 captures the rollback nuance).
- `delete` refreshes ONE; failures in the term-search refresh DO roll back the soft-delete (the `flatMap` chain runs under `@ReactiveTransactional`). The main search and column-structure refreshes are SIMPLY NOT INVOKED — no failure, just incomplete cleanup.

**Why the asymmetry**: no comment defends the choice. The maintainer's intent is ambiguous:
- POSSIBLE intent A: the main search + column-structure indexes are refreshed via a separate path (e.g., the entity-level write that drops the relation). Verified by reading the search-entrypoint repository: `updateChangedTagVectors` is called by `TagActivityHandlerImpl` (`:41`) on tag-assignment activity, which would NOT fire on tag-delete (delete is a directory-level event, not a per-entity event).
- POSSIBLE intent B: the cost of refreshing the main search is bounded by the affected entity count, which on delete is "all entities ever tagged by this tag" — potentially large. The maintainer may have chosen to defer it to natural refresh (the cost is paid lazily). But no code comment defends this.
- POSSIBLE intent C: BUG. The omission is unintentional; the maintainer copy-pasted from a similar method's shape and missed one of the three.

**Primary source citations**:
- `TagServiceImpl.java:44-55` (update — triggers triple refresh via `updateSearchVectors`)
- `TagServiceImpl.java:57-70` (delete — triggers only single refresh)
- `TagServiceImpl.java:161-167` (the private `updateSearchVectors` method — Mono.zip of three)
- `TagServiceImpl.java:68-69` (delete's lone search-vector call)
- The asymmetry between `:53` and `:68-69` is the anchor

**Existing-ADR-or-implied-prescription**: None. The platform's convention "search-vector refresh is part of the write contract" (the `update` triple-zip) is an implicit_adr surfaced in this batch. The `delete` partial-refresh contradicts it without explanation.

**Proposed remedy**: Two options:

1. **Refresh all three on delete (symmetric with update)**: Replace the lone `updateChangedTagVectors` call at line 68-69 with a call to the (currently private) `updateSearchVectors(deletedTagPojo)` method. The `deletedTagPojo` needs to be the pre-delete pojo (otherwise the search-vector refresh has no name to remove). Trade-off: extra cost on every tag delete; symmetric with update; aligns with the platform's "search-vector refresh is part of the write contract" convention.

2. **Document the asymmetry**: If the maintainer's intent is "lazy refresh post-delete" (Intent B above), add a code comment defending the choice. Add an operator-facing doc note that deleted tags may surface in the main search facet for a brief window. Verify the natural refresh actually closes the window (write integration test that deletes a tag, then asserts main search facet stops including its name within N seconds).

**Recommended**: Option 1 — the asymmetry has no defended rationale; the cost is bounded; the symmetric shape aligns with the platform's convention. The test scaffolding is straightforward: `testDelete_RefreshesAllThreeSearchVectors` asserting all three repository methods are called.

**Severity rationale**: LOW — the staleness window is bounded (next entity-level write closes it; or the search-entrypoint reaper job if one runs). No security implication. The data-freshness UX gap is small. The fix is one line; the alignment with the convention is positive.

**Suggested backlog grouping**: Data-freshness consistency sprint. Pair with REFACTOR-548 (delete cascade asymmetry — tag_to_dataset_field orphans) — both are TagServiceImpl.delete cleanup gaps; the maintainer might fix them in one commit.

---

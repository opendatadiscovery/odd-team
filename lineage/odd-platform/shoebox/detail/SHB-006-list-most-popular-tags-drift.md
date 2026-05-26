# SHB-006 — `listMostPopular` tags returns OLDEST tags re-sorted by usage_count, not the most-popular

**Category**: clustering
**Severity**: MEDIUM

## Hypothesis

Operators see a "Popular Tags" list that does NOT reflect the platform's most-used tags because `ReactiveTagRepositoryImpl.listMostPopular` paginates with `paginate(homogeneousQuery, List.of(new OrderByField(TAG.ID, SortOrder.ASC)), (page - 1) * size, size)` — pagination orders by `TAG.ID ASC` (effectively oldest-by-creation), selects the first `size` lowest-id rows, and ONLY THEN sorts those rows by descending `COUNT_FIELD`. On a platform with N tags and a popular-page-size of 30, the response is the **oldest 30 tags re-ordered by usage_count locally**, not the 30 tags with the highest usage globally. Empirically verified against demo.oddp.io 2026-05-20 per the TagServiceImpl sidecar's Stress Protocol finding S-B-1. The endpoint name (`listMostPopular`) and the API operation (`getPopularTagList`) both promise popularity ranking; the implementation delivers oldest-first.

## Evidence

- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/service/TagServiceImpl.java:73-77` — service is a straight-through pass-through: `reactiveTagRepository.listMostPopular(query, ids, page, size).map(tagMapper::mapToTagsResponse)`. The drift propagates one-to-one to the controller.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveTagRepositoryImpl.java:148` — `paginate(homogeneousQuery, List.of(new OrderByField(TAG.ID, SortOrder.ASC)), (page - 1) * size, size)` — the OFFSET/LIMIT applies AFTER the `TAG.ID ASC` order. The popularity sort happens INSIDE the window.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/repository/reactive/ReactiveTagRepositoryImpl.java:158` — the outer SELECT then sorts by `COUNT_FIELD DESC` — but only over the already-windowed set.
- `odd-platform-api/src/main/java/org/opendatadiscovery/oddplatform/controller/TagController.java:42` — the controller method `getPopularTagList` exposes this via `GET /api/tags/popular`. Wire shape: pageInfo + items[Tag].
- Live doc: `https://docs.opendatadiscovery.org/configuration-and-deployment/enable-security/authorization/permissions` (verified 2026-05-20 status 200) does not document the popular-tags semantics.
- Cross-ref: `lineage/odd-platform/understanding/odd-platform__java__service__TagServiceImpl.md:understanding` (the NAME-BEHAVIOUR DRIFT paragraph + the demo.oddp.io empirical verification).
- Cross-ref: `lineage/odd-platform/understanding/odd-platform__java__service__TagServiceImpl.md:bugs_limitations_corner_cases` (the `listMostPopular` drift entry).

## Notes

- **UI consumer**: the TagsForm autocomplete on the entity-detail page calls `getPopularTagList` to populate the dropdown of suggested tags as the user types. Operators see oldest tags ranked first, not the platform's actually-popular tags — UX confusion for any deployment older than the popular-page-size.
- **Fix is structurally simple**: replace `OrderByField(TAG.ID, SortOrder.ASC)` with `OrderByField(COUNT_FIELD, SortOrder.DESC)` in the paginate call, so the window selects the top-`size` most-popular tags rather than the oldest-`size` then re-sorts. The two-line change has user-visible behaviour improvement.
- **Why this slipped past review**: the homogeneous SELECT chain looks correct in isolation (COUNT_FIELD is computed, the outer SELECT orders by it DESC); the paginate wrapper's ordering parameter is an easy-to-miss correctness defect because the COUNT_FIELD ordering downstream is visible and conceptually-right. The two-stage shape (inner pagination order + outer popularity order) is the smell.
- **Cross-cutting with F-018**: F-018 (Manual Object Tagging) anchors the tag-directory side-door and per-entity tag operator-flow. This thread is a DRIFT facet of the popular-tags read surface — the popular-tags ranking is the user-visible feature that F-018 implicitly depends on but does not explicitly enumerate. May merge into F-018 as a drift facet.
- **Test gap**: no test in `TagRepositoryImplTest` exercises a scenario where N > size, with high-id rows having higher COUNT than low-id rows. Any such test would catch this immediately.
- **Empirical verification**: per the TagServiceImpl sidecar's Stress Protocol record, the 2026-05-20 test against demo.oddp.io confirmed the endpoint returns the oldest 30 tags re-sorted, not the 30 tags with the highest global usage count. This is not a hypothesis — it's a fact awaiting upstream fix.

## Next

1. **REFACTOR-NNN — MEDIUM** — flip the paginate ordering from `TAG.ID ASC` to `COUNT_FIELD DESC` so the window selects truly most-popular rows. Two-line diff in `ReactiveTagRepositoryImpl.listMostPopular`.
2. **TEST-NNN — HIGH** — add a `TagRepositoryImplTest` case that creates 60 tags with descending usage_count (newest tags have highest counts) and asserts page=1 size=30 returns the 30 tags with the highest counts, not the oldest 30. DRIFT-locking test before AND after the fix.
3. **Merge into F-018** — this is a drift facet of an existing flow, not its own feature. Set `merged_into: F-018` once F-018's feature flow has been refreshed to enumerate the popular-tags ranking. Alternatively: graduate to its own F-NNN if the maintainer decides "Popular Tags" deserves its own anchor (the surface is small but operator-visible).
4. **DOC-NNN** — the live `/active-platform-features/manual-object-tagging` page (status TBD; not yet fetched) should explain how Popular ranking is computed — currently this surface is undocumented end-to-end.
5. **Cluster** with SHB-005 (Tag Origin Channel Ownership) — both are facets of the broader manual-tagging feature.

## Links

- cluster_with: [SHB-005, F-018]
- merged_into: (open)
- supersedes: []

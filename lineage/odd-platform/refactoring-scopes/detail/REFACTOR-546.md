## REFACTOR-546 — `listMostPopular` paginate-inside-CTE drift — endpoint NAME promises popularity-ordered tags; SQL DELIVERS oldest-by-id with intra-page count-DESC re-sort (LSN-019 SMOKING GUN)

**Severity**: HIGH
**Category**: name-behaviour-drift
**Surfaced by**:
- `TagController.md:bugs_limitations_corner_cases[0]` ("`getPopularTagList` LSN-019 name-vs-behavior drift" — HIGH)
- `TagController.md:stress_findings.name_behavior_pairs[0]` (drift: DRIFT_NAME_VS_BEHAVIOR; STATIC-INFERRED + EMPIRICAL via P-010)
- `TagController.md:stress_findings.orderings` (the SQL-level trace of inner paginate ordering)
- `ReactiveTagRepositoryImpl.md:stress_findings.B1` (SMOKING GUN — full JOOQ chain trace lines 84-93)
- `ReactiveTagRepositoryImpl.md:bugs_limitations_corner_cases[0]` ("LSN-019 SMOKING GUN" — HIGH)
- `ReactiveTagRepositoryImpl.md:invariants[3]` ("`listMostPopular`'s pagination is applied INSIDE the CTE (before counts), not OUTSIDE (after ranking).")
- `ReactiveTagRepositoryImpl.md:docs_link_semantic.doc_drift_findings[0]` (Spec-vs-code drift on popular-tags ordering)
- `TagServiceImpl.md:stress_findings.S-B-1` (CANARY HEADLINE; REFERENCE to repository sidecar as authoritative trace)
- `TagServiceImpl.md:bugs_limitations_corner_cases` (via the listMostPopular line propagation)
- `TagServiceImpl.md:tests_coverage_semantic.uncovered_behaviours[listMostPopular drift]` (HIGH — no test pins the drift)
- `retrospectives/LSN-019-file-analyser-describes-not-interrogates.md:23-32` (maintainer's 2026-05-20 empirical reproduction)

**Description**: The endpoint `GET /api/tags` (path `/api/tags`, summary "Gets the list of existing tags sorted by popularity" — `odd-platform-specification/openapi.yaml:344-346`) promises popularity-ranked tags. The method names — controller `getPopularTagList` (`TagController.java:37`), service `listMostPopular` (`TagServiceImpl.java:73`), repository `listMostPopular` (`ReactiveTagRepositoryImpl.java:138`) — all promise popularity ordering. The UI surfaces the response as "Top Tags" (Catalog Overview chip strip, search facet dropdown). The actual SQL delivers DIFFERENT semantics:

Chain trace (line-by-line, repository tier):
1. Line 144-145: build `selectFrom(TAG).where(conditions)` — homogeneous tag select, no ordering.
2. **Line 148: `paginate(homogeneousQuery, List.of(new OrderByField(TAG.ID, SortOrder.ASC)), (page - 1) * size, size)`** — this is the LIMITING step. `JooqQueryHelper.paginate` (`:63-90`) emits SQL: `SELECT u.*, count(*) OVER () AS _total, row_number() OVER (ORDER BY tag.id ASC) AS _row FROM (selectFrom(TAG).where(conditions)) u ORDER BY u.id ASC LIMIT size OFFSET offset`. The candidate set is truncated to the `size` lowest-ID rows BEFORE counts are computed.
3. Line 150: the size-truncated result becomes `tag_cte`.
4. Line 151 + lines 373-391: `getDataEntityWithDatasetFields` builds `WITH tag_cte AS (size-truncated-paginated-select) SELECT tag_cte.fields, ... LEFT JOIN tag_to_data_entity ... GROUP BY tag_cte.fields UNION ALL SELECT tag_cte.fields, ... LEFT JOIN tag_to_dataset_field ... GROUP BY tag_cte.fields AS union_usages`. The CTE is fixed at this point.
5. Lines 153-158: outer select sums counts across the UNION-ALL arms and `.orderBy(field(COUNT_FIELD).desc())`. This DOES re-rank by count desc — but only WITHIN the already-truncated candidate pool.

Net behaviour: "pick the `size` lowest-ID tags matching the search/id filter; rank those `size` tags by usage count desc; on ties, PostgreSQL preserves the CTE-natural row order (tag.id ASC)."

**Operator-visible consequence**: With a directory of 35 tags (all equally popular) and size=30, page=1: tags with id=1..30 are returned in tag.id ASC order; tags with id=31..35 are MISSING from the response despite being equally popular. Empirically reproduced by maintainer 2026-05-20 (35 tags created, every entity tagged by all 35, the 5 youngest tags absent from response). With more than `size` tags where the YOUNGEST tags have HIGHER counts than the OLDEST 30, the 5 actually-most-popular are INVISIBLE on page 1 — only visible by paginating through every page, and even then the ordering within each page is broken. The UI's "Top Tags" surface is operator-misleading.

**Primary source citations**:
- `ReactiveTagRepositoryImpl.java:138-167` (the full `listMostPopular` method body)
- `ReactiveTagRepositoryImpl.java:148` (the load-bearing `paginate(...)` call with inner `OrderByField(TAG.ID, SortOrder.ASC)`)
- `ReactiveTagRepositoryImpl.java:158` (outer `.orderBy(field(COUNT_FIELD).desc())` — the cosmetic re-rank)
- `JooqQueryHelper.java:63-90` (paginate semantics — inner ORDER BY tag.id ASC + LIMIT)
- `TagServiceImpl.java:72-77` (service-tier straight-through delegation)
- `TagController.java:37-44` (controller-tier straight-through delegation)
- `odd-platform-specification/openapi.yaml:344-346` (spec description "sorted by popularity")
- `retrospectives/LSN-019-file-analyser-describes-not-interrogates.md:23-32` (empirical reproduction 2026-05-20)
- `lineage/odd-platform/probes/P-010.yaml` (probe emitted to pin SQL contract in CI)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-070 (partial unique index) and ADR-CANDIDATE-067 (transaction-boundary asymmetry) describe the platform's data-layer conventions but do not defend popularity-NOT-being-popularity. The repository-tier "paginate-inside-CTE" pattern is internally consistent (every list-with-pagination endpoint uses the same shape — `ReactiveAbstractCRUDRepository.list` at lines 88-100), but the pattern's correctness depends on the ORDERING field matching the OPERATION'S NAME. For `listAlerts(ORDER BY id ASC)`, "by id ASC" matches the name. For `listMostPopular`, "by id ASC" does NOT match the name. The structural choice is intentional for performance reasons (you don't want to aggregate over the entire directory); the consequence — that `listMostPopular` cannot deliver count-ranked results when N > size — is the name-vs-behaviour drift.

**Proposed remedy**: THREE options for the maintainer to triage (the choice has UX + performance trade-offs):

1. **Honour the name (fix the SQL)**: Restructure `listMostPopular` to apply ORDER BY count DESC inside the paginate window. This requires computing per-tag counts over the FULL directory (no inner CTE truncation) and ordering by count before applying LIMIT. Trade-off: counts are computed across the entire `tag` table per query — bounded above by directory size. Add an index on `tag_to_data_entity(tag_id)` and `tag_to_dataset_field(tag_id)` to keep the cost manageable. Pair with caching (5-30 second TTL) since the popular list does not change at human reaction time.

2. **Honour the implementation (rename)**: Rename `listMostPopular` / `getPopularTagList` / OpenAPI `summary` to reflect actual behaviour ("List tags by creation order, ranked within page by usage"). Trade-off: breaking spec change; consumers depending on the spec text need to be notified. UI label "Top Tags" needs to change too. This is the spec-honesty path.

3. **Add a doc warning + new endpoint**: Keep `listMostPopular` as-is for backwards compatibility; add a doc admonition acknowledging the paginate-inside-CTE behaviour; introduce a NEW endpoint `GET /api/tags/by-popularity` with the corrected semantics. Trade-off: API surface duplication.

**Recommended fix**: Option 1 is the only one that preserves the operator's mental model. The performance cost is the maintainer's responsibility to bound (with caching, with a secondary index). Probe P-010 should be promoted to a regression test that locks the chosen behaviour.

**Severity rationale**: HIGH — the endpoint is on the UI's most-trafficked surface (Catalog Overview chip strip + tag-search facet) and the spec text directly contradicts the implementation. An operator deploying ODD with a growing tag directory will see their "most popular" tags drift from "actually most popular" to "oldest tags ranked by usage among themselves" silently. Empirically reproduced; pinned by P-010; uncovered by tests at every layer (controller has zero tests; repository's `testListMostPopular` uses `containsExactlyInAnyOrder` + `size = numberOfTestTags` so the LIMIT case never fires).

**Suggested backlog grouping**: LSN-019 hardening sprint. Cross-link with REFACTOR-220 (view_count inflation — the OTHER way Popular ranking is operator-misleading) and REFACTOR-226 (the `createDataEntityTagsRelations` name-behaviour drift). The trio share the name-vs-behaviour pattern: the spec / method name promises X, the implementation delivers Y, the UI surfaces the result without distinguishing.

---

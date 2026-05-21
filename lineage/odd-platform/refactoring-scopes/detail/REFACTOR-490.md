## REFACTOR-490 — `getPopularTagList` LSN-019 popularity-ranking drift — `paginate`-inside-CTE selects the OLDEST `size` tags by `TAG.ID ASC` before counting, so "Top tags" renders old-and-unused tags for any directory beyond `size` tags

**Severity**: MEDIUM
**Category**: name-behaviour-drift
**Batch**: X-TAGGING
**Related pillar features**: P-01:F-006 (Manual Object Tagging), P-01 (Data Discovery — Catalog Overview "Top tags" strip), P-08 (Management & Administration — Tags tab listing)
**related_features**: [F-018]

**Surfaced by**:
- `odd-platform__java__TagController__controller-method__getPopularTagList.md:bugs_limitations_corner_cases[0]` (the LSN-019 name-vs-behavior drift, with the full `paginate`-inside-CTE trace)
- `odd-platform__java__TagController__controller-method__getPopularTagList.md:stress_findings.name_behavior_pairs[0]` + `orderings`
- `odd-platform__openapi__tags__openapi-tag__tag.md:bugs_limitations_corner_cases` (the spec-side drift — `openapi.yaml:345` literally asserts "sorted by popularity")
- cross-confirm: `feature-flows/index.yaml` F-018 facet `name_behavior_drift_list_most_popular_paginate_inside_cte_yields_oldest_by_id_not_most_popular_by_count` + `TEST-GAP-LSN019-listMostPopular-ranking`

**Statement**: `GET /api/tags` (`getPopularTagList`) — the method name, the service method (`listMostPopular`), and the OpenAPI description (`openapi.yaml:345`: "Gets the list of existing tags sorted by popularity") all promise popularity-ranked results. The implementation does NOT deliver that. `ReactiveTagRepositoryImpl.listMostPopular` (`:137-167`) uses `paginate(homogeneousQuery, [new OrderByField(TAG.ID, SortOrder.ASC)], (page-1)*size, size)` at line 148 as the row-SELECTION step — `JooqQueryHelper.paginate` emits `ORDER BY tag.id ASC LIMIT size OFFSET ...`, selecting the OLDEST `size` tags by serial PK BEFORE any usage count is computed. Only those `size` rows enter `tag_cte` (line 150). The outer `cteSelect.orderBy(field(COUNT_FIELD).desc())` (line 158) re-ranks the already-selected rows by summed count desc but CANNOT reach tags excluded by the inner LIMIT. For any directory with more than `size` tags where the youngest are more popular, the response contains the OLDEST `size` tags and the actual-most-popular are absent. The UI's "Top tags" chip strip on the Catalog Overview renders this — effectively "Oldest Tags" beyond `size` tags. Empirically reproduced by the maintainer 2026-05-20 (35 equally-popular tags, size=30 → response = the oldest 30 by `tag.id` ASC; the 5 youngest absent — `retrospectives/LSN-019`). Probe P-010 pins it.

**Evidence**: `TagController.java:36-44` + `TagServiceImpl.java:72-77` + `ReactiveTagRepositoryImpl.java:140-167` (line 148 the inner `paginate`, line 158 the outer count-DESC) + `ReactiveTagRepositoryImpl.java:373-392` (the UNION-ALL CTE over `tag_cte` rows only) + `openapi.yaml:345` (the spec's false "sorted by popularity" claim) + `lineage/odd-platform/probes/P-010.yaml` + `retrospectives/LSN-019-file-analyser-describes-not-interrogates.md:23-32` (empirical).

**Why this is a gap, not an ADR (wisdom test)**:
1. *Intentional?* NO. The method is NAMED `getPopularTagList`, the service method `listMostPopular`, the spec says "sorted by popularity" — every layer promises popularity ranking. The implementation contradicts its own name at three layers. No comment defends "we select oldest then re-rank within the page". The `paginate`-inside-CTE is a query-construction bug (the count-ordering must drive the LIMIT, not be applied after it), not a deliberate design.
2. *Structural impact?* NO — the fix is to move the count computation BEFORE the `paginate` LIMIT (count all candidates, then `ORDER BY count DESC LIMIT size`), within the existing repository method.
3. *Refactoring or structural?* REFACTORING — restructure the `listMostPopular` query so the LIMIT is applied to a count-ordered candidate set, not a `tag.id`-ordered one.
→ refactoring scope.

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-066 (popular ranking is exclusively `view_count DESC` — for the DATA-ENTITY popular surface) is the sibling design for a different popular surface; there is no ADR prescribing the TAG popularity ranking, but the method name + the OpenAPI description ARE the implied contract. The implied prescription: `getPopularTagList` returns the `size` MOST-USED tags. The implementation violates it.

**Proposed remedy**: Restructure `ReactiveTagRepositoryImpl.listMostPopular` so the usage-count is computed over the FULL filtered candidate set FIRST, then `ORDER BY count DESC` drives the `LIMIT size OFFSET ...` — i.e. the count-ordering must be the row-SELECTION step, not a within-page re-sort. Add a secondary sort key (e.g. `tag.id`) for deterministic tie-breaking on equal counts. THEN reconcile the OpenAPI description if the semantic is intentionally something else. Promote the F-018 `TEST-GAP-LSN019-listMostPopular-ranking` to a CI integration test (35-tag fixture, size=30, assert the response is the count-ranked 30, not the oldest 30); note `TagRepositoryImplTest.testListMostPopular` is structurally blind (it uses `size = numberOfTestTags` so the LIMIT never fires + `containsExactlyInAnyOrder` so order is never checked).

**Severity rationale**: MEDIUM — a name-vs-behaviour drift on a home-page recommendation surface; the "Top tags" strip is operator-misleading (it shows oldest, not most-used) for any deployment with more than `size` tags. Filed MEDIUM (not HIGH) because it is a ranking-quality defect, not a data-loss or security defect — but it is the LSN-019 canonical case and the OpenAPI spec itself carries the false claim, so it is a HIGH-visibility correctness gap.

**Suggested backlog grouping**: "Tag mutation hardening" / data-discovery-quality sprint + TEST-NNN companion (the LSN-019 fixture). The spec-text correction belongs in the DOC-NNN / OpenAPI contract-hardening sprint.

---

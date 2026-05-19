## REFACTOR-346 — `/my/upstream` and `/my/downstream` in-memory derivation + unpaginated anchor-set materialisation defeats SQL pagination — for admin/CI-bot owners the JVM heap holds the full owned-oddrn set + full lineage-CTE output before SQL `LIMIT/OFFSET` clips to page-size

**Severity**: MEDIUM
**Category**: missing-pagination (defeated-by-materialisation)
**Pillars affected**: [P-01-data-discovery, P-05-data-lineage]
**Batch**: M (2026-05-19)

**Surfaced by**:
- `odd-platform__java__DataEntityController__controller-method__getMyObjectsWithUpstream.md:bugs_limitations_corner_cases.[2]` (MEDIUM) — "**Unbounded lineage-CTE fan-out when the anchor set is large.** `getLineageRelations(oddrns, LineageDepth.empty(), UPSTREAM)` at `DataEntityRelationsServiceImpl.java:34` constructs a CTE with `WHERE CHILD_ODDRN IN (?, ?, ...)` (for UPSTREAM) using the entire owned-oddrn set as the input. A user owning thousands of entities (e.g. an admin owner, or a CI-bot owner that owns every test entity in the catalog) triggers a wide IN-clause that the Postgres planner must materialise; jOOQ does not paginate the IN clause. The lineage-CTE result is then `.distinct()` + `.filter` + `Collectors.toList()` — fully materialised in memory before pagination kicks in at `listByOddrns`'s SQL LIMIT/OFFSET. Memory and DB-CPU cost scale with anchor set size, NOT with the requested page size."
- `odd-platform__java__DataEntityController__controller-method__getMyObjectsWithUpstream.md:performance.known_performance_gaps.[0]` (MEDIUM — anchor-set materialisation has no pagination) + `[1]` (MEDIUM — lineage IN-clause unbounded) + `[2]` (MEDIUM — in-memory deduplication defeats SQL pagination)
- `odd-platform__java__DataEntityController__controller-method__getMyObjectsWithDownstream.md:bugs_limitations_corner_cases.[4]` (MEDIUM — unbounded `size` at `listByOddrns` + DOC-GAP-105 lineage CTE no upper bound)

**Description**: The `/my/upstream` and `/my/downstream` endpoints route through a four-stage pipeline that materialises three intermediate buffers BEFORE the controller-supplied `page` and `size` parameters get applied at the final SQL projection:

1. **Anchor-set materialisation** (unpaginated): `dataEntityRepository.listByOwner(o.getId())` at `DataEntityRelationsServiceImpl.java:27` — the **no-page overload** at `ReactiveDataEntityRepository.java:83-86` fetches ALL owned entities for the user with NO pagination. For an admin owner or a CI-bot owner owning thousands of entities (a realistic operational scenario), this fetches the full owned-entity row set into the JVM before the lineage step.
2. **Anchor-oddrn Set materialisation**: `.map(de -> de.getDataEntity().getOddrn()).collect(Collectors.toSet())` (line 28-29) — the full oddrn set is held in JVM heap as a `Set<String>`.
3. **Lineage CTE with wide IN-clause**: `lineageRepository.getLineageRelations(oddrns, LineageDepth.empty(), streamKind)` at line 34 — constructs a CTE with `WHERE CHILD_ODDRN IN (?, ?, ...)` (for UPSTREAM) or `WHERE PARENT_ODDRN IN (?, ?, ...)` (for DOWNSTREAM) using the entire owned-oddrn set as the IN parameter list. PostgreSQL has no hard limit on IN-list cardinality but planner cost is non-linear above ~1000 elements; jOOQ does not paginate the IN clause.
4. **In-memory deduplication + filter**: `.flatMap(lp -> Flux.just(lp.getParentOddrn(), lp.getChildOddrn())).distinct().filter(Predicate.not(oddrns::contains)).collectList()` at lines 35-38 — the full derived oddrn set is fully materialised in JVM heap as a `List<String>` BEFORE pagination kicks in.
5. **Final SQL projection (the ONLY paginated step)**: `listByOddrns(oddrns, false, false, page, size)` at `DataEntityServiceImpl.java:223` — applies `LIMIT $size OFFSET ($page-1) * $size` to the materialised oddrn list.

The architecture defeats SQL pagination at three of four buffering points. The cost-per-call is O(anchor-set-size + derived-set-size), NOT O(page-size). For an admin owner owning 10k entities with average out-degree of 5 lineage neighbours, the call:
- Fetches 10k DataEntity rows from `listByOwner` (anchor).
- Holds 10k oddrns in JVM heap.
- Issues a CTE with `WHERE CHILD_ODDRN IN (10k literals)` to Postgres.
- Materialises ~50k lineage edges → ~100k oddrns flat → ~50k distinct → ~50k after the filter.
- Then SQL-paginates the 50k to `size=5` for the UI.

The home-page `Recommended` panel rendering 5 entities pays the full 50k materialisation cost per refresh. The TanStack Query hook in the UI has `gcTime: 0` (verified in the sibling batch-J sidecar) — every component re-mount re-issues the request.

**Primary source citations**:
- `DataEntityRelationsServiceImpl.java:27` (`listByOwner(o.getId())` — no `(page, size)` parameters)
- `ReactiveDataEntityRepository.java:83-86` (the no-page overload — delegates to `listByOwner(ownerId, null, null)`)
- `DataEntityRelationsServiceImpl.java:34` (the CTE call with full oddrns)
- `ReactiveLineageRepositoryImpl.java:160-176` (the CTE construction — no IN-clause cap)
- `DataEntityRelationsServiceImpl.java:35-38` (the `.distinct().filter().collectList()` chain — full materialisation)
- `DataEntityServiceImpl.java:223` (`listByOddrns(oddrns, false, false, page, size)` — the SQL pagination applied to the materialised list)

**Existing-ADR-or-implied-prescription**: **ADR-CANDIDATE-117 NEW** (batch M — anchor + derived-set lineage neighbourhood architecture) endorses the pipeline shape; the cost is the price the architecture pays. The ADR's "single-hop scope via `LineageDepth.empty()`" decision (ADR-CANDIDATE-118 NEW) caps the breadth at single-hop, but the anchor-set itself is unpaginated.

**Proposed remedy**: Three composable fixes:
1. **Paginate the anchor**: Replace `listByOwner(o.getId())` with `listByOwner(o.getId(), page, size)` (the existing paginated overload at `ReactiveDataEntityRepositoryImpl.java:515-534`). This bounds the anchor set to the page-size. The semantic change: the response is now "lineage neighbourhood of THE FIRST `size` owned entities" rather than "lineage neighbourhood of ALL owned entities". For the home-page panel use case (size=5), this is acceptable; for a third-party consumer paginating through every owned entity's neighbourhood, this is a behaviour change requiring contract update.
2. **Cap the anchor**: Add a `MAX_ANCHOR_SIZE` constant (e.g. 100); if `oddrns.size() > MAX_ANCHOR_SIZE`, sample the first N or raise an error advising the caller to use the per-entity lineage endpoints instead.
3. **Stream the lineage CTE result**: Convert the `.collectList()` to a streaming Flux pipeline; the CTE output streams through `.distinct()` (in-memory dedup is necessary; cap via a `LinkedHashSet` with a size limit) and the filter, then SQL `LIMIT/OFFSET` at `listByOddrns`. This still pays the CTE-fan-out cost at the DB layer but bounds JVM heap.

Option (1) is the simplest contract-coherent fix for the home-page use case. Option (2) is the defence-in-depth fix preventing accidental admin-owner DoS. Option (3) is the most invasive (touches the lineage CTE + the projection chain) but provides true bounded JVM heap.

**Severity rationale**: MEDIUM — pagination correctness gap; affects admin / CI-bot owners disproportionately (large ownership cardinality). Not HIGH because typical operator deployments have human owners with small ownership cardinality where the cost is bounded; the gap is realised at admin/CI-bot scale or under operator-error scenarios.

**Suggested backlog grouping**: `Lineage performance hardening` — couple with REFACTOR-208 (no pagination on per-entity lineage — same pattern at the per-entity endpoint), REFACTOR-207 (recursive CTE no cycle detection — compounds for the per-entity lineage endpoint where depth can be set), REFACTOR-347 NEW (no ORDER BY on listByOddrns — the pagination instability sibling).

---

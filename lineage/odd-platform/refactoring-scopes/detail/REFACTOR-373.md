## REFACTOR-373 — `getTermDetailsDto` Cartesian-product fan-out scales O(N×M×P×Q×R) before DISTINCT — 11 LEFT JOINs + 7 jsonArrayAgg + 4 countDistinct on a single root row; performance ceiling undocumented

**Severity**: LOW
**Category**: missing-defence-in-depth (performance ceiling on a hot-path read)
**Surfaced by**: `ReactiveTermRepositoryImpl.md:bugs_limitations_corner_cases[4]` + `ReactiveTermRepositoryImpl.md:performance.known_performance_gaps[1]`

**Description**: `ReactiveTermRepositoryImpl.getTermDetailsDto` (lines 194-238) materialises the Term + namespace + ownership chain + tags + assigned-terms graph + 4 usage counts in a single query — 11 LEFT JOINs + 1 hard JOIN on a single root row. For a Term with N owners × M tags × P linked data-entities × Q linked dataset-fields × R linked query-examples × S assigned-terms, the intermediate result is N×M×P×Q×R×S rows BEFORE the 4 countDistinct aggregates reduce.

For a moderate Term (10 owners, 20 tags, 100 data-entities, 50 dataset-fields, 20 query-examples, 10 assigned-terms) the intermediate is ~2M rows. The countDistinct aggregates correctly compute the cardinalities, but the query plan is fragile to JOIN reordering and statistics drift.

`TermPermissionExtractor.getContext` (TermPermissionExtractor.java:43) calls `getTermDetailsDto(resourceId)` on EVERY authorized HTTP request to a TERM-scoped endpoint — this is the permission-resolution hot path for Terms.

**Today's typical Term sizes do not trigger the issue**. The undocumented ceiling means a heavily-linked Term (1000+ entities, 200+ tags, 100+ assigned terms) could push response time into the seconds.

**Primary source citations**:
- `ReactiveTermRepositoryImpl.java:194-238` — the 12-JOIN topology
- `TermPermissionExtractor.java:43` — the per-request consumer

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-131 NEW (jsonArrayAgg single-query DTO materialisation) PRESCRIBES this pattern as the architecture's deliberate choice. This scope is the documented cost.

**Proposed remedy**:
1. **Add a documented performance budget** — Javadoc on `getTermDetailsDto` enumerating the fan-out cost.
2. **Add an EXPLAIN-benchmarked integration test** — pin the query cost at a baseline Term size; CI detects plan regression.
3. **Add a per-relation cap** — e.g., a LIMIT 100 inside the LATERAL subquery for each relation aggregation. Trade-off: high-link Terms have truncated detail views.
4. **Add an HTTP-tier cache** — cache the result for stable Terms with TTL=N seconds; permission-extractor cache hit avoids the DB round-trip. (Cross-link: REFACTOR-385 — also calls for caching on the same hot path.)

Option 1 is the smallest blast radius; Option 4 is the highest-leverage performance fix.

**Severity rationale**: LOW — performance ceiling undocumented; correctness preserved. No production incident today. Worth documenting as part of ADR-CANDIDATE-131's drafted ADR.

**Suggested backlog grouping**: `Performance-baseline sprint` — pair with REFACTOR-385 (caching on the same hot path) and REFACTOR-228 (the triple-re-query on the same repository).

---

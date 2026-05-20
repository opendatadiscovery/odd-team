## REFACTOR-385 — `getTermDetailsDto` on the Term-permission hot path — `TermPermissionExtractor.getContext` calls it on EVERY authorized TERM-scoped request; no caching layer; the 12-JOIN aggregation runs per-request

**Severity**: LOW
**Category**: missing-cache (performance gap on hot path)
**Surfaced by**: `ReactiveTermRepositoryImpl.md:performance.known_performance_gaps[4]`

**Description**: `TermPermissionExtractor.getContext` (TermPermissionExtractor.java:43) calls `termRepository.getTermDetailsDto(resourceId)` to assemble the `TermPolicyResolverContext` for the contextual permission framework. This runs on EVERY authorized request that traverses a TERM-scoped SecurityRule (e.g., `PUT /api/terms/{term_id}` for TERM_UPDATE; `POST /api/terms/{term_id}/ownership`).

The `getTermDetailsDto` query is the 12-JOIN + 7-jsonArrayAgg + 4-countDistinct topology documented at REFACTOR-373. The per-request cost is sub-second for typical Term sizes; the multiplicative cost across many TERM-scoped requests adds up.

The Term-details result for a stable Term is stable until the Term or one of its link rows changes; cache-eligibility is high.

**Primary source citations**:
- `TermPermissionExtractor.java:36-51` — the per-request consumer
- `ReactiveTermRepositoryImpl.java:194-238` — the 12-JOIN query

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-131 NEW (jsonArrayAgg single-query DTO materialisation) PRESCRIBES the dense query; ADR-CANDIDATE-124 NEW (hasDescriptionRelations single-point-of-enforcement) prescribes the hot-path consumer. This scope is the missing caching layer.

**Proposed remedy**: Similar to REFACTOR-384:
1. **Short-TTL Caffeine cache** at the extractor — keyed on `(termId)`; TTL ≈ 30s.
2. **Reactor Context-scoped cache** — one fetch per HTTP request, shared by extractor + service.
3. **Targeted invalidation** — cache invalidates on the term's mutation activity events.

Option 1 is the smallest blast radius.

**Severity rationale**: LOW — performance gap, correctness preserved.

**Suggested backlog grouping**: `Performance-baseline sprint` — pair with REFACTOR-373 (the fan-out ceiling), REFACTOR-384 (the parallel hot-path cache gap).

---

## REFACTOR-366 — Tag `listByTerm` pagination inconsistency — outer LIMIT/OFFSET applied without `pageifyResult`, caller's `Flux<TagPojo>` materialisation does not surface total or hasNext; mirror of Term `listByTerm` (the same broken-paginator pattern in two different repositories)

**Severity**: MEDIUM
**Category**: missing-defence-in-depth (CTE-first paginate-then-aggregate contract violation)
**Surfaced by**:
- `ReactiveTermRepositoryImpl.md:bugs_limitations_corner_cases[2]` — Term primary-source
- Cross-batch: `TermServiceImpl.md` (the broken-paginator at the service consumer)
- Cross-batch potential mirror: `ReactiveTagRepositoryImpl` may have a similar pattern at `listByTerm` (lines 137-167 list-most-popular uses pageifyResult correctly; verification of OTHER list methods is needed)

**Description**: `ReactiveTermRepositoryImpl.listByTerm(termId, query, page, size)` (lines 457-499) applies `.limit(size).offset((page-1)*size)` to the OUTER query at lines 494-495 WITHOUT calling `jooqQueryHelper.pageifyResult`. The contract for `pageifyResult` is to wrap the Flux with `total + hasNext` via a separate count Mono. Without it, the caller (`TermServiceImpl.listByTerm` at lines 281-286) is forced to manufacture:

```java
return repository.listByTerm(...)
    .collectList()
    .map(items -> Page.builder()
        .data(items)
        .total(items.size())   // ← WRONG: items.size() is page-size-bound
        .hasNext(false)        // ← WRONG: hardcoded
        .build());
```

The structural mismatch means `listByTerm` cannot honour `total > size` correctly. The UI's pagination for "list terms linked TO this term" never shows pagination affordances even when more pages exist.

Compared to the sibling methods in the same repository:
- `listTermRefDtos` (line 117) — uses `paginate + pageifyResult` correctly.
- `findByState` (line 316) — same correct pattern.
- `listByTerm` (lines 494-495) — broken pattern.

**The inconsistency means a maintainer copying patterns from `listTermRefDtos` to `listByTerm` would silently lose the `total` / `hasNext` contract**.

**Primary source citations**:
- `ReactiveTermRepositoryImpl.java:116-126 vs 467-499` — the CORRECT and BROKEN patterns side-by-side
- `TermServiceImpl.java:281-286` — the consumer's manufactured Page with broken totals
- Cross-batch: ADR-CANDIDATE-123 NEW (the architectural prescription)

**Existing-ADR-or-implied-prescription**: ADR-CANDIDATE-123 NEW (CTE-first paginate-then-aggregate) prescribes the pattern. This scope is the conformance gap.

**Proposed remedy**: Restructure `listByTerm` to use the CTE-first pattern + `pageifyResult`:

```java
// Before:
.limit(size).offset((page-1)*size)
// + caller's Page.builder().total(items.size())

// After:
final Table<?> termCTE = paginate(homogeneousQuery, orderFields, (page-1)*size, size)
    .asTable("term_cte");
final Mono<Long> countMono = countByTerm(termId, query);
return jooqQueryHelper.pageifyResult(buildOuterSelect(termCTE), countMono);
```

Implement `countByTerm(termId, query)` as a paired method (per the count-side discipline of ADR-CANDIDATE-123).

Add a regression test asserting `total == real_count` and `hasNext == (page * size < real_count)`.

**Severity rationale**: MEDIUM — UI-pagination-correctness regression on a real user-visible page (the Term-detail's "Linked Terms" section). The fix follows the established architectural pattern; small blast radius.

**Suggested backlog grouping**: `Glossary-tier hardening sprint` — pair with REFACTOR-362, REFACTOR-363 (the count-vs-list contract failures on the same repository).

---
